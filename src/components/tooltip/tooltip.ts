import { define, UiElement } from '../../core/element';
import { attrs, cls } from '../../core/html';
import { morphInto } from '../../core/morph';
import { type PopPlace, parsePlacement, positionFixed, watchViewport } from '../../core/popover';
import { styles } from './styles';

export interface TooltipData {
  /** The tooltip's text (wins over the `text` attribute). Plain text, never parsed as HTML. */
  text?: string;
}

export type TooltipVariant = 'ink' | 'card';

const DEFAULT_DELAY = 500;
/** Time to cross from the trigger to the bubble (WCAG 1.4.13 hoverable) before it hides. */
const GRACE_MS = 100;
/** A tooltip that hid less than this long ago makes the next one show at once (moving along a toolbar). */
const WARM_MS = 300;
const GAP = 6;

let seq = 0;
let lastHiddenAt = Number.NEGATIVE_INFINITY;
let current: UiTooltip | null = null;

/** `delay="…"` in ms; anything but a finite number ≥ 0 is the default 500. */
export function tooltipDelay(value: string | null): number {
  if (value === null || value.trim() === '') return DEFAULT_DELAY;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DELAY;
}

/** An IDREF list (`aria-describedby`) with `add` appended and `remove` dropped; the other ids keep their order. */
export function idrefList(value: string | null, add: string[], remove: string[] = []): string {
  const out = String(value ?? '')
    .split(/\s+/)
    .filter((id) => id && !remove.includes(id));
  for (const id of add) if (id && !out.includes(id)) out.push(id);
  return out.join(' ');
}

/**
 * `<ui-tooltip>` — a short description for the element it wraps: after a hover delay, at once on keyboard focus,
 * never on touch. It stays while the pointer moves onto it, hides on Esc, when the pointer leaves or focus goes,
 * and pops from the side it sits on. The text lives in the light DOM and the trigger points at it with
 * aria-describedby, so screen readers read it as the trigger's description.
 */
export class UiTooltip extends UiElement<TooltipData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['text', 'placement', 'disabled'];
  }

  #open = false;
  #placed = false;
  #pos: PopPlace | null = null;
  /** The trigger we listen on and describe. */
  #trigger: Element | null = null;
  /** Our ids in the trigger's aria-describedby. */
  #ids: string[] = [];
  /** The light-DOM span that carries `text`. */
  #textEl: HTMLSpanElement | null = null;
  #pop: HTMLElement | null = null;
  #showTimer: ReturnType<typeof setTimeout> | undefined;
  #hideTimer: ReturnType<typeof setTimeout> | undefined;
  #unwatch: (() => void) | null = null;

  constructor() {
    super();
    this.root.addEventListener('slotchange', () => this.#sync());
  }

  /** The text shown: `data.text` when set, else the `text` attribute. Setting it sets the attribute. */
  get text(): string {
    const t = this.data?.text;
    return typeof t === 'string' ? t : (this.getAttribute('text') ?? '');
  }

  set text(v: string) {
    this.setAttribute('text', String(v ?? ''));
  }

  /** Whether the bubble is showing (read-only). */
  get open(): boolean {
    return this.#open;
  }

  /** Show now (no delay). Does nothing when disabled or empty. */
  show(): void {
    this.#show();
  }

  /** Hide now. */
  hide(): void {
    this.#hide();
  }

  attributeChangedCallback(name: string): void {
    if (name === 'disabled' && this.hasAttribute('disabled')) this.#hide();
    if (name === 'placement') this.#pos = null; // the next show places it on the new side
    this.requestRender();
  }

  override disconnectedCallback(): void {
    this.#hide();
    if (this.#trigger) this.#describe(this.#trigger, [], this.#ids);
    this.#ids = [];
    this.#bind(null);
  }

  get #placement() {
    return parsePlacement(this.getAttribute('placement'), { side: 'top', align: 'center' });
  }

  #off(): boolean {
    return this.hasAttribute('disabled');
  }

  #contents(): Element[] {
    return Array.from(this.children).filter((c) => c.getAttribute('slot') === 'content');
  }

  // ── light DOM: the text span, the description ids, the trigger ────────────

  /**
   * An id inside this shadow root cannot be referenced from the light-DOM trigger, so the description lives in
   * the light DOM: our own `<span slot="content">` for `text`, or the host's `slot="content"` element(s), shown
   * in the bubble through `<slot name="content">`. Their ids go into the trigger's aria-describedby, next to
   * any ids already there.
   */
  #sync(): void {
    if (!this.isConnected) return;
    const text = this.text;
    if (text) {
      if (!this.#textEl || this.#textEl.parentNode !== this) {
        const own = Array.from(this.children).find((c) => c.hasAttribute('data-ui-tooltip-text'));
        const span = (own as HTMLSpanElement | undefined) ?? document.createElement('span');
        span.slot = 'content';
        span.setAttribute('data-ui-tooltip-text', '');
        if (!span.id) span.id = nextId();
        if (span.parentNode !== this) this.append(span);
        this.#textEl = span;
      }
      // textContent, never innerHTML: the text is never parsed as markup.
      if (this.#textEl.textContent !== text) this.#textEl.textContent = text;
    } else if (this.#textEl) {
      this.#textEl.remove();
      this.#textEl = null;
    }
    const ids = this.#contents().map((c) => {
      if (!c.id) c.id = nextId();
      return c.id;
    });
    const trig = Array.from(this.children).find((c) => !c.getAttribute('slot')) ?? null;
    if (trig !== this.#trigger) {
      if (this.#trigger) this.#describe(this.#trigger, [], this.#ids);
      this.#bind(trig);
      if (trig) this.#describe(trig, ids);
    } else if (trig) {
      this.#describe(
        trig,
        ids,
        this.#ids.filter((id) => !ids.includes(id)),
      );
    }
    this.#ids = ids;
    if (this.#open && !ids.length) this.#hide();
  }

  #describe(el: Element, add: string[], remove: string[] = []): void {
    const before = el.getAttribute('aria-describedby');
    const next = idrefList(before, add, remove);
    if (next === (before ?? '')) return;
    if (next) el.setAttribute('aria-describedby', next);
    else el.removeAttribute('aria-describedby');
  }

  #bind(t: Element | null): void {
    const old = this.#trigger;
    if (old === t) return;
    if (old) {
      old.removeEventListener('pointerenter', this.#onEnter as EventListener);
      old.removeEventListener('pointerleave', this.#onLeave);
      old.removeEventListener('pointerdown', this.#onDown);
      old.removeEventListener('focusin', this.#onFocusIn);
      old.removeEventListener('focusout', this.#onFocusOut as EventListener);
    }
    this.#trigger = t;
    if (old && this.#open) this.#hide();
    if (t) {
      t.addEventListener('pointerenter', this.#onEnter as EventListener);
      t.addEventListener('pointerleave', this.#onLeave);
      t.addEventListener('pointerdown', this.#onDown);
      t.addEventListener('focusin', this.#onFocusIn);
      t.addEventListener('focusout', this.#onFocusOut as EventListener);
    }
  }

  #bindPop(): void {
    const pop = this.$('.tt-pop');
    if (pop === this.#pop) return;
    this.#pop?.removeEventListener('pointerenter', this.#onPopEnter);
    this.#pop?.removeEventListener('pointerleave', this.#onPopLeave);
    this.#pop = pop;
    pop?.addEventListener('pointerenter', this.#onPopEnter);
    pop?.addEventListener('pointerleave', this.#onPopLeave);
  }

  // ── input ─────────────────────────────────────────────────────────────────

  /** Mouse / pen only: touch never shows a tooltip (there is no hover to end it). */
  readonly #onEnter = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    clearTimeout(this.#hideTimer);
    if (this.#open || this.#off()) return;
    clearTimeout(this.#showTimer);
    if ((current && current !== this) || Date.now() - lastHiddenAt < WARM_MS) this.#show();
    else this.#showTimer = setTimeout(() => this.#show(), tooltipDelay(this.getAttribute('delay')));
  };

  readonly #onLeave = (): void => {
    clearTimeout(this.#showTimer);
    if (this.#open) this.#graceHide();
  };

  /** A press means the person is acting on the trigger: the tooltip gets out of the way. */
  readonly #onDown = (): void => {
    this.#hide();
  };

  /** Keyboard focus shows it at once; a click's focus does not. */
  readonly #onFocusIn = (e: Event): void => {
    let keyboard = true; // an engine without :focus-visible: show on focus
    try {
      keyboard = (e.target as Element).matches(':focus-visible');
    } catch {}
    if (keyboard) this.#show();
  };

  readonly #onFocusOut = (e: FocusEvent): void => {
    // Focus moving within the trigger keeps it. Focus going into the trigger's own shadow root (a menu it opens)
    // is retargeted to the trigger itself: that hides it, so the bubble never sits over the open menu.
    const to = e.relatedTarget as Node | null;
    if (to && to !== this.#trigger && this.#trigger?.contains(to)) return;
    this.#hide();
  };

  readonly #onPopEnter = (): void => {
    clearTimeout(this.#hideTimer);
  };

  readonly #onPopLeave = (): void => {
    if (this.#open) this.#graceHide();
  };

  /** Esc dismisses it without moving focus — and without taking the key from anyone else. */
  readonly #onDocKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.#hide();
  };

  #graceHide(): void {
    clearTimeout(this.#hideTimer);
    this.#hideTimer = setTimeout(() => this.#hide(), GRACE_MS);
  }

  // ── show / hide ───────────────────────────────────────────────────────────

  #show(): void {
    clearTimeout(this.#showTimer);
    clearTimeout(this.#hideTimer);
    if (this.#open || this.#off() || !this.isConnected) return;
    this.#sync();
    if (!this.#trigger || !this.#contents().length) return;
    // One tooltip at a time.
    if (current && current !== this) current.hide();
    current = this;
    this.#open = true;
    this.#placed = false;
    document.addEventListener('keydown', this.#onDocKey, true);
    this.#unwatch = watchViewport(() => this.#place());
    this.renderNow();
  }

  #hide(): void {
    clearTimeout(this.#showTimer);
    clearTimeout(this.#hideTimer);
    if (!this.#open) return;
    this.#open = false;
    lastHiddenAt = Date.now();
    if (current === this) current = null;
    document.removeEventListener('keydown', this.#onDocKey, true);
    this.#unwatch?.();
    this.#unwatch = null;
    if (this.isConnected) this.renderNow();
  }

  /** Fixed placement from the trigger; a trigger that leaves the screen after it was placed hides it. */
  #place(): void {
    if (!this.#open || !this.isConnected) return;
    const t = this.#trigger;
    const pop = this.$('.tt-pop');
    if (!t || !pop) return;
    const { side, align } = this.#placement;
    const p = positionFixed(t, pop, this.$('.tt-probe'), side, align, GAP);
    if (!p) {
      if (this.#placed) this.#hide();
      return;
    }
    this.#placed = true;
    this.#pos = p;
  }

  // ── render ────────────────────────────────────────────────────────────────

  /** Patch the live tree: the bubble node (and its running transition) survives every render. */
  protected override update(): void {
    morphInto(this.content, this.render());
    this.updated();
  }

  protected override updated(): void {
    this.#sync();
    this.#bindPop();
    if (this.#open) this.#place();
  }

  protected render(): string {
    const { side, align } = this.#placement;
    const pos = this.#pos;
    return `<slot></slot><i class="tt-probe" aria-hidden="true"></i><div${attrs({
      class: cls('tt-pop', this.#open && 'is-open'),
      role: 'tooltip',
      part: 'tooltip',
      'data-side': pos?.side ?? side,
      'data-align': align,
      // The last placement stays while hidden, so the exit runs in place.
      style: pos ? `left:${pos.left}px;top:${pos.top}px;max-height:${pos.maxHeight}px` : undefined,
    })}><slot name="content"></slot></div>`;
  }
}

function nextId(): string {
  seq += 1;
  return `ui-tt-${seq}`;
}

define('ui-tooltip', UiTooltip);

declare global {
  interface HTMLElementTagNameMap {
    'ui-tooltip': UiTooltip;
  }
}
