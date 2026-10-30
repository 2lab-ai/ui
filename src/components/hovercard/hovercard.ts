import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { attrs, cls } from '../../core/html';
import { morphInto } from '../../core/morph';
import { type PopPlace, parsePlacement, positionFixed, watchViewport } from '../../core/popover';
import { styles } from './styles';

/** `ui-open` detail (cancelable, before it shows: fill the card for this trigger) and `ui-closed` detail. */
export interface HovercardDetail {
  trigger: Element;
}

/** Hover intent before the card opens: a sweep across a row of tiles stays quiet. */
export const HOVERCARD_DELAY_MS = 350;
/** Time to move the pointer from the trigger onto the card (WCAG 1.4.13 hoverable) before it hides. */
export const HOVERCARD_GRACE_MS = 200;
/** While a card is open, the next trigger takes it over this fast. */
export const HOVERCARD_SWAP_MS = 90;
/** The exit (opacity + transform); `ui-closed` follows it. Reduced motion: a 120ms fade. */
export const HOVERCARD_EXIT_MS = 180;
const REDUCED_EXIT_MS = 120;
const DEFAULT_WIDTH = 360;
const GAP = 8;

/** `delay="…"` in ms; anything but a finite number ≥ 0 is the default 350. */
export function hovercardDelay(value: string | null): number {
  if (value === null || value.trim() === '') return HOVERCARD_DELAY_MS;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : HOVERCARD_DELAY_MS;
}

/** A px size attribute: a finite number > 0, rounded; else null. */
export function hovercardSize(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** The first element on an event path that matches `selector`, stopping at `stop` (the card). Bad selectors: none. */
export function triggerOnPath(path: EventTarget[], selector: string | null, stop?: Node): Element | null {
  if (!selector) return null;
  for (const n of path) {
    if (n === stop) return null;
    if (!(n instanceof Element)) continue;
    try {
      if (n.matches(selector)) return n;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * `<ui-hovercard>` — one preview card for many triggers (`for="selector"`, or `anchor(el)` from code). After a
 * hover intent (350ms), at once on keyboard focus, it sends a cancelable `ui-open` with the trigger — fill the
 * card's light-DOM content then — and pops beside the trigger. It stays while the pointer is on it, moves to the
 * next trigger quickly while open, and hides after a 200ms grace when the pointer leaves, on Esc, on a press, when
 * focus goes or the trigger scrolls away; `ui-closed` follows the exit. A preview, not a description: no
 * aria-describedby, no role — what it shows must also be reachable another way.
 */
export class UiHovercard extends UiElement {
  static override styles = [styles];
  static get observedAttributes() {
    return ['for', 'placement', 'width', 'height', 'disabled'];
  }

  #open = false;
  #placed = false;
  #pos: PopPlace | null = null;
  /** The trigger the card is showing for (kept through the exit, for `ui-closed`). */
  #trigger: Element | null = null;
  /** The trigger under the pointer (its pointerleave is armed). */
  #hovered: Element | null = null;
  /** The trigger the intent timer will open for. */
  #pending: Element | null = null;
  #openTimer: ReturnType<typeof setTimeout> | undefined;
  #closeTimer: ReturnType<typeof setTimeout> | undefined;
  #exitTimer: ReturnType<typeof setTimeout> | undefined;
  #unwatch: (() => void) | null = null;
  #card: HTMLElement | null = null;

  /** Whether the card is showing (read-only). */
  get open(): boolean {
    return this.#open;
  }

  /** The element the card is showing for, or null (read-only). */
  get trigger(): Element | null {
    return this.#open ? this.#trigger : null;
  }

  /** Show the card for `el` now (it sends `ui-open` first); `null` hides it. */
  anchor(el: Element | null): void {
    if (el) this.#show(el);
    else this.#hide();
  }

  /** Hide now (the exit runs; `ui-closed` follows). */
  hide(): void {
    this.#hide();
  }

  attributeChangedCallback(name: string): void {
    if (name === 'disabled' && this.hasAttribute('disabled')) this.#hide();
    if (name === 'placement') this.#pos = null;
    this.requestRender();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('pointerover', this.#onOver, true);
    document.addEventListener('focusin', this.#onFocusIn, true);
    document.addEventListener('focusout', this.#onFocusOut, true);
    document.addEventListener('pointerdown', this.#onDocDown, true);
  }

  override disconnectedCallback(): void {
    document.removeEventListener('pointerover', this.#onOver, true);
    document.removeEventListener('focusin', this.#onFocusIn, true);
    document.removeEventListener('focusout', this.#onFocusOut, true);
    document.removeEventListener('pointerdown', this.#onDocDown, true);
    this.#hide();
    clearTimeout(this.#exitTimer);
    this.#disarm();
  }

  get #placement() {
    return parsePlacement(this.getAttribute('placement'), { side: 'bottom', align: 'start' });
  }

  #off(): boolean {
    return this.hasAttribute('disabled');
  }

  #exitMs(): number {
    return prefersReducedMotion() ? REDUCED_EXIT_MS : HOVERCARD_EXIT_MS;
  }

  #hasContent(): boolean {
    return Array.from(this.childNodes).some(
      (n) => n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && !!n.textContent?.trim()),
    );
  }

  // ── input ─────────────────────────────────────────────────────────────────

  /** The pointer reached a trigger (or the card). Touch has no hover: a tap is the trigger's own business. */
  readonly #onOver = (e: PointerEvent): void => {
    if (e.pointerType === 'touch' || this.#off()) return;
    const path = e.composedPath();
    if (path.includes(this)) {
      clearTimeout(this.#closeTimer); // onto the card
      return;
    }
    const t = triggerOnPath(path, this.getAttribute('for'), this);
    if (!t) return;
    clearTimeout(this.#closeTimer);
    if (t === this.#hovered) return;
    this.#hovered?.removeEventListener('pointerleave', this.#onTriggerLeave);
    this.#hovered = t;
    t.addEventListener('pointerleave', this.#onTriggerLeave);
    if (this.#open && this.#trigger === t) return;
    this.#intend(t, this.#open ? HOVERCARD_SWAP_MS : hovercardDelay(this.getAttribute('delay')));
  };

  readonly #onTriggerLeave = (e: Event): void => {
    const t = e.currentTarget as Element;
    t.removeEventListener('pointerleave', this.#onTriggerLeave);
    if (this.#hovered === t) this.#hovered = null;
    if (this.#pending === t) this.#cancelIntent();
    if (this.#open) this.#graceHide();
  };

  readonly #onCardEnter = (): void => {
    clearTimeout(this.#closeTimer);
  };

  readonly #onCardLeave = (): void => {
    if (this.#open && !this.#hovered) this.#graceHide();
  };

  /** Keyboard focus on a trigger shows the card at once; a click's focus does not. */
  readonly #onFocusIn = (e: FocusEvent): void => {
    if (this.#off()) return;
    const t = triggerOnPath(e.composedPath(), this.getAttribute('for'), this);
    if (!t) return;
    let keyboard = true; // an engine without :focus-visible: show on focus
    try {
      keyboard = (e.composedPath()[0] as Element).matches(':focus-visible');
    } catch {}
    if (keyboard) this.#show(t);
  };

  readonly #onFocusOut = (e: FocusEvent): void => {
    if (!this.#open || !this.#trigger) return;
    // Focus leaving the trigger, or leaving the card's own content after a Tab into it.
    const path = e.composedPath();
    if (!path.includes(this.#trigger) && !path.includes(this)) return;
    const to = e.relatedTarget as Node | null;
    // Within the trigger, or into the card's content: it stays.
    if (to && (this.#trigger.contains(to) || this.contains(to))) return;
    this.#graceHide();
  };

  /** A press anywhere but the card: the person is acting (opening the tile, moving on) — no card, none pending. */
  readonly #onDocDown = (e: PointerEvent): void => {
    if ((!this.#open && !this.#pending) || e.composedPath().includes(this)) return;
    this.#cancelIntent();
    this.#hide();
  };

  /** Esc closes the card first: the key is marked used (defaultPrevented), so a dialog or drawer under it stays. */
  readonly #onDocKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || !this.#open || e.isComposing) return;
    e.preventDefault();
    this.#hide();
  };

  #intend(t: Element, ms: number): void {
    clearTimeout(this.#openTimer);
    this.#pending = t;
    this.#openTimer = setTimeout(() => {
      this.#pending = null;
      this.#show(t);
    }, ms);
  }

  #cancelIntent(): void {
    clearTimeout(this.#openTimer);
    this.#pending = null;
  }

  #graceHide(): void {
    clearTimeout(this.#closeTimer);
    this.#closeTimer = setTimeout(() => this.#hide(), HOVERCARD_GRACE_MS);
  }

  #disarm(): void {
    this.#hovered?.removeEventListener('pointerleave', this.#onTriggerLeave);
    this.#hovered = null;
    this.#cancelIntent();
  }

  // ── show / hide ───────────────────────────────────────────────────────────

  #show(t: Element): void {
    this.#cancelIntent();
    clearTimeout(this.#closeTimer);
    if (this.#off() || !this.isConnected || !t.isConnected) return;
    if (this.#open && this.#trigger === t) return;
    // The host fills the card for this trigger now — or refuses.
    if (!this.emit<HovercardDetail>('ui-open', { trigger: t }) || !this.#hasContent()) {
      this.#hide();
      return;
    }
    clearTimeout(this.#exitTimer);
    this.#trigger = t;
    this.#placed = false;
    if (!this.#open) {
      this.#open = true;
      document.addEventListener('keydown', this.#onDocKey, true);
      this.#unwatch = watchViewport(() => this.#place());
    }
    this.renderNow();
  }

  #hide(): void {
    this.#cancelIntent();
    clearTimeout(this.#closeTimer);
    if (!this.#open) return;
    this.#open = false;
    document.removeEventListener('keydown', this.#onDocKey, true);
    this.#unwatch?.();
    this.#unwatch = null;
    const t = this.#trigger;
    if (this.isConnected) this.renderNow();
    clearTimeout(this.#exitTimer);
    if (t)
      this.#exitTimer = setTimeout(() => {
        if (!this.#open) this.notify<HovercardDetail>('ui-closed', { trigger: t });
      }, this.#exitMs());
  }

  /** Fixed beside the trigger; a trigger that leaves the screen after it was placed takes the card with it. */
  #place(): void {
    if (!this.#open || !this.isConnected) return;
    const t = this.#trigger;
    const card = this.$('.hc-card');
    if (!t || !card) return;
    if (!t.isConnected) {
      this.#hide();
      return;
    }
    const { side, align } = this.#placement;
    const p = positionFixed(t, card, this.$('.hc-probe'), side, align, GAP);
    if (!p) {
      if (this.#placed) this.#hide();
      return;
    }
    this.#placed = true;
    this.#pos = p;
  }

  // ── render ────────────────────────────────────────────────────────────────

  /** Patch the live tree: the card node (and its running transition) survives every render. */
  protected override update(): void {
    morphInto(this.content, this.render());
    this.updated();
  }

  protected override updated(): void {
    const card = this.$('.hc-card');
    if (card !== this.#card) {
      this.#card?.removeEventListener('pointerenter', this.#onCardEnter);
      this.#card?.removeEventListener('pointerleave', this.#onCardLeave);
      this.#card = card;
      card?.addEventListener('pointerenter', this.#onCardEnter);
      card?.addEventListener('pointerleave', this.#onCardLeave);
    }
    if (this.#open) this.#place();
  }

  protected render(): string {
    const { side, align } = this.#placement;
    const pos = this.#pos;
    const w = hovercardSize(this.getAttribute('width')) ?? DEFAULT_WIDTH;
    const h = hovercardSize(this.getAttribute('height'));
    const style = [
      `--hc-w:${w}px`,
      h ? `--hc-h:${h}px` : '',
      // The last placement stays while hidden, so the exit runs in place.
      pos ? `left:${pos.left}px;top:${pos.top}px;max-height:${pos.maxHeight}px` : '',
    ]
      .filter(Boolean)
      .join(';');
    return `<i class="hc-probe" aria-hidden="true"></i><div${attrs({
      class: cls('hc-card', this.#open && 'is-open'),
      part: 'card',
      'data-side': pos?.side ?? side,
      'data-align': align,
      'data-sized': !!h,
      style,
    })}><slot></slot></div>`;
  }
}

define('ui-hovercard', UiHovercard);

declare global {
  interface HTMLElementTagNameMap {
    'ui-hovercard': UiHovercard;
  }
}
