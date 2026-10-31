import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { attrs, esc } from '../../core/html';
import { morphInto } from '../../core/morph';
import { icon } from '../../icons/icons';
import { userGesture } from '../../sound/sound';
import { styles } from './styles';

export interface DisclosureData {
  /** The summary row's text (or slot `summary`). */
  summary?: string;
  /** Quiet text at the end of the row — a count, a time (or slot `meta`). */
  meta?: string;
  /** The row does not toggle (aria-disabled). */
  disabled?: boolean;
}

/** `ui-toggle` detail: the state the person asked for. */
export interface DisclosureToggle {
  open: boolean;
}

/** `ui-toggled` detail: the state the region has settled in (its grow / shrink transition ended). */
export interface DisclosureToggled {
  open: boolean;
}

/** The expand duration when the computed one cannot be read (the --dur-expand token). */
const EXPAND_MS = 240;
/** Slack after the transition before the fallback timer reports the region settled anyway. */
const SETTLE_SLACK_MS = 80;

let seq = 0;

/** The first duration in a computed `transition-duration` / `-delay` list, in ms (NaN when unreadable). */
export function cssMs(value: string | null | undefined): number {
  const first = String(value ?? '')
    .split(',')[0]
    .trim();
  if (!first) return Number.NaN;
  const n = Number.parseFloat(first);
  if (!Number.isFinite(n)) return Number.NaN;
  return first.endsWith('ms') ? n : n * 1000;
}

/**
 * `<ui-disclosure>` — a summary row that shows or hides a region: the chevron turns, the region grows from 0fr to
 * 1fr with a fade, and while closed it is inert (nothing inside takes focus or clicks). Toggling sends a cancelable
 * `ui-toggle`; the `open` attribute / property set by the host changes state without an event. Once the region
 * has settled (open or closed) a `ui-toggled` notification follows, so a host can drop a closed region's nodes.
 * Slot `links` is a row under the summary and outside the region — links that stay in view while closed.
 * `trigger="external"` draws no row: the host's own button (`for="<its id>"`) opens it.
 */
export class UiDisclosure extends UiElement<DisclosureData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['open', 'summary', 'meta', 'level', 'trigger', 'for', 'head-tabindex'];
  }

  #open = false;
  #reflecting = false;
  /** The region finished opening (stops clipping). */
  #settled = false;
  /** Rendered once: before that a state is drawn as is, without a transition to wait for. */
  #painted = false;
  /** A state change waiting to report `ui-toggled` (its region is still moving). */
  #pending: { open: boolean; timer: ReturnType<typeof setTimeout> | undefined } | null = null;
  /** A state change made after the first paint: report it once this render is drawn. */
  #changed = false;
  /** The external trigger we put aria-expanded / aria-controls on. */
  #decorated: Element | null = null;
  #docListening: Document | ShadowRoot | null = null;

  constructor() {
    super();
    // On the host, not the shadow root: it hears the row's own (composed) clicks and clicks on slotted summary
    // content alike.
    this.addEventListener('click', (e) => this.#onClick(e));
    this.root.addEventListener('transitionend', (e) => this.#onTransitionEnd(e as TransitionEvent));
    // The links row shows only while something is slotted into it.
    this.root.addEventListener('slotchange', (e) => {
      if ((e.target as HTMLSlotElement | null)?.name === 'links') this.requestRender();
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#listenExternal();
  }

  override disconnectedCallback(): void {
    this.#cancelSettle();
    this.#undecorate();
    this.#unlistenExternal();
  }

  /** Focus the summary row (a roved list moves focus with `el.focus()`), unless the host itself takes focus. */
  override focus(options?: FocusOptions): void {
    const head = this.hasAttribute('tabindex') ? null : this.$<HTMLElement>('.dc-head');
    if (head) head.focus(options);
    else super.focus(options);
  }

  get open(): boolean {
    return this.#open;
  }

  set open(v: boolean) {
    this.#set(!!v);
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === 'open') {
      if (!this.#reflecting) this.#set(value !== null);
      return;
    }
    if (name === 'trigger' || name === 'for') {
      this.#undecorate();
      this.#listenExternal();
    }
    this.requestRender();
  }

  /** The person asked to open it (from the host's own control): a cancelable `ui-toggle` first. */
  show(): void {
    if (!this.#open) this.toggle();
  }

  /** The person asked to close it: a cancelable `ui-toggle` first. */
  hide(): void {
    if (this.#open) this.toggle();
  }

  get #external(): boolean {
    return this.getAttribute('trigger') === 'external';
  }

  /** Open or close without an event. Opened before the first paint or under reduced motion: settled at once. */
  #set(v: boolean): void {
    if (v === this.#open) return;
    this.#open = v;
    this.#changed = this.#painted;
    this.#settled = v && (!this.#painted || prefersReducedMotion());
    this.#reflecting = true;
    this.toggleAttribute('open', v);
    this.#reflecting = false;
    this.requestRender();
  }

  /** The person asked to toggle: a cancelable `ui-toggle`, then the change unless a listener cancelled it. */
  toggle(): void {
    this.#toggle();
  }

  /** `e`: the click on the row or the external trigger. Without one (the host's own control) it sounds only in a gesture. */
  #toggle(e?: Event): void {
    if (this.data?.disabled) return;
    const next = !this.#open;
    const detail: DisclosureToggle = { open: next };
    if (!this.emit('ui-toggle', detail)) return;
    this.#set(next);
    if (e || userGesture()) this.sound(next ? 'open' : 'close', { emphasis: 'subtle' }, e);
  }

  protected override update(): void {
    morphInto(this.content, this.render());
    this.updated();
  }

  protected render(): string {
    const d = this.data;
    const summary = d?.summary ?? this.getAttribute('summary') ?? '';
    const meta = d?.meta ?? this.getAttribute('meta') ?? '';
    const level = Number(this.getAttribute('level'));
    const headTab = this.getAttribute('head-tabindex');
    const head = `<button${attrs({
      type: 'button',
      class: 'dc-head',
      id: 'dc-head',
      part: 'summary',
      'aria-expanded': String(this.#open),
      'aria-controls': 'dc-region',
      'aria-disabled': d?.disabled ? 'true' : undefined,
      tabindex: headTab !== null && /^-?\d+$/.test(headTab.trim()) ? headTab.trim() : undefined,
    })}>${icon('chevron-right', { class: 'dc-chev', size: 12 })}<span class="dc-summary"><slot name="summary">${esc(
      summary,
    )}</slot></span><span class="dc-meta"><slot name="meta">${esc(meta)}</slot></span></button>`;
    const wrapped = this.#external
      ? ''
      : level >= 1 && level <= 6
        ? `<div class="dc-heading" role="heading" aria-level="${level}">${head}</div>`
        : head;
    // Links (Issue · PR · Full conversation) under the row, outside the region: in view and reachable while closed.
    const links = `<div${attrs({ class: 'dc-links', part: 'links', hidden: !this.hasLinks })}><slot name="links"></slot></div>`;
    return `<div${attrs({ class: 'dc', 'data-open': this.#open, 'data-settled': this.#open && this.#settled })}>${wrapped}${links}<div${attrs(
      {
        class: 'dc-region',
        id: 'dc-region',
        part: 'region',
        inert: !this.#open,
      },
    )}><div class="dc-inner"><div class="dc-body" part="body"><slot></slot></div></div></div></div>`;
  }

  /** Something is slotted into `links` (a child with `slot="links"`). */
  get hasLinks(): boolean {
    return Array.from(this.children).some((c) => c.getAttribute('slot') === 'links');
  }

  protected override updated(): void {
    this.#painted = true;
    this.#decorate();
    if (this.#changed) {
      this.#changed = false;
      this.#awaitSettle();
    }
  }

  /**
   * A click anywhere in the row — slotted summary content included: its target is the light-DOM node, whose
   * `closest()` never reaches the shadow row, so read the composed path (and, where an engine does not route
   * slotted events through the slot, this element's own summary / meta child).
   */
  #onClick(e: Event): void {
    const head = this.$('.dc-head');
    if (!head) return;
    if (e.composedPath().includes(head)) {
      this.#toggle(e);
      return;
    }
    const own = (e.target as Element | null)?.closest?.('[slot="summary"], [slot="meta"]');
    if (own && own.parentElement === this) this.#toggle(e);
  }

  #onTransitionEnd(e: TransitionEvent): void {
    if (e.propertyName !== 'grid-template-rows' || e.target !== this.$('.dc-region')) return;
    if (this.#open && !this.#settled) {
      this.#settled = true;
      this.$('.dc')?.setAttribute('data-settled', '');
    }
    if (this.#pending && this.#pending.open === this.#open) this.#settle();
  }

  // ── ui-toggled: after the region settles ─────────────────────────────────

  /** Wait for the region's grow / shrink to end (or its duration, if no transitionend comes), then report. */
  #awaitSettle(): void {
    this.#cancelSettle();
    const region = this.$('.dc-region');
    let ms = Number.NaN;
    if (region && !prefersReducedMotion()) {
      const cs = getComputedStyle(region);
      const dur = cssMs(cs.transitionDuration);
      ms = Number.isNaN(dur) ? EXPAND_MS : dur + Math.max(0, cssMs(cs.transitionDelay) || 0);
    } else {
      ms = 0;
    }
    const pending: { open: boolean; timer: ReturnType<typeof setTimeout> | undefined } = {
      open: this.#open,
      timer: undefined,
    };
    this.#pending = pending;
    if (ms <= 0) queueMicrotask(() => this.#pending === pending && this.#settle());
    else pending.timer = setTimeout(() => this.#pending === pending && this.#settle(), ms + SETTLE_SLACK_MS);
  }

  #settle(): void {
    const p = this.#pending;
    if (!p) return;
    this.#cancelSettle();
    if (p.open !== this.#open) return;
    if (p.open && !this.#settled) {
      this.#settled = true;
      this.$('.dc')?.setAttribute('data-settled', '');
    }
    const detail: DisclosureToggled = { open: p.open };
    this.notify('ui-toggled', detail);
  }

  #cancelSettle(): void {
    if (this.#pending?.timer !== undefined) clearTimeout(this.#pending.timer);
    this.#pending = null;
  }

  // ── trigger="external": the host's own button (for="<id>") ───────────────

  /** The host's trigger, looked up by id each time (a host that repaints its button keeps working). */
  #externalTrigger(): HTMLElement | null {
    const id = this.getAttribute('for');
    if (!this.#external || !id || !this.isConnected) return null;
    const scope = this.getRootNode() as Document | ShadowRoot;
    return typeof scope.getElementById === 'function' ? (scope.getElementById(id) as HTMLElement | null) : null;
  }

  /** aria-expanded + aria-controls (this element — an id inside the shadow root is out of the button's reach). */
  #decorate(): void {
    const t = this.#externalTrigger();
    if (t !== this.#decorated) this.#undecorate();
    if (!t) return;
    if (!this.id) this.id = `ui-dc-${++seq}`;
    if (t.getAttribute('aria-expanded') !== String(this.#open)) t.setAttribute('aria-expanded', String(this.#open));
    if (t.getAttribute('aria-controls') !== this.id) t.setAttribute('aria-controls', this.id);
    this.#decorated = t;
  }

  #undecorate(): void {
    const t = this.#decorated;
    this.#decorated = null;
    if (!t) return;
    t.removeAttribute('aria-expanded');
    if (t.getAttribute('aria-controls') === this.id) t.removeAttribute('aria-controls');
  }

  #listenExternal(): void {
    const scope = this.#external && this.isConnected ? (this.getRootNode() as Document | ShadowRoot) : null;
    if (scope === this.#docListening) return;
    this.#unlistenExternal();
    if (!scope) return;
    scope.addEventListener('click', this.#onExternalClick);
    this.#docListening = scope;
  }

  #unlistenExternal(): void {
    this.#docListening?.removeEventListener('click', this.#onExternalClick);
    this.#docListening = null;
  }

  readonly #onExternalClick = (e: Event): void => {
    const t = this.#externalTrigger();
    if (!t || !e.composedPath().includes(t)) return;
    if ((t as HTMLButtonElement).disabled || t.getAttribute('aria-disabled') === 'true') return;
    this.#toggle(e);
    this.#decorate();
  };
}

define('ui-disclosure', UiDisclosure);

declare global {
  interface HTMLElementTagNameMap {
    'ui-disclosure': UiDisclosure;
  }
}
