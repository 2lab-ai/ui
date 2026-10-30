import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { attrs, esc, escAttr } from '../../core/html';
import { morphInto } from '../../core/morph';
import { deepActive } from '../../core/popover';
import { applyViewportVars, type ViewportBox, viewportVars, watchVisualViewport } from '../../core/viewport';
import { icon } from '../../icons/icons';
import { styles } from './styles';

/** `sheet` = modal over a scrim (focus trapped); `dock` = beside the page, which stays interactive. */
export type DrawerMode = 'sheet' | 'dock';
export type DrawerSide = 'right' | 'left';
/** `visual` (default): the drawer box follows `window.visualViewport` (above a soft keyboard); `layout`: it does not. */
export type DrawerViewport = 'visual' | 'layout';
/** What the person did to ask for the close. */
export type DrawerCloseReason = 'escape' | 'scrim' | 'close-button';

/** `ui-close` detail. */
export interface DrawerCloseDetail {
  reason: DrawerCloseReason;
}

/** `ui-resize` detail: the new panel width in px. */
export interface DrawerResizeDetail {
  width: number;
}

/** `ui-mode-change` detail. */
export interface DrawerModeChange {
  mode: DrawerMode;
}

/** Defaults for the width attributes and the auto-mode breakpoint (px). */
export const DRAWER_DEFAULTS = { width: 480, minWidth: 320, maxWidth: 960, dockAt: 840 } as const;
/** The panel always leaves this much of the viewport to the page (px). */
const EDGE = 48;
/** Exit = the enter path on the same curve: `--dur-move`. */
export const DRAWER_EXIT_MS = 320;
/** Under reduced motion only a 120ms opacity fade is left. */
const REDUCED_EXIT_MS = 120;
/** sheet ↔ dock while open: the panel's box morphs from where it was drawn (`--dur-move`, ease-out). */
export const DRAWER_MORPH_MS = 320;
/** …and the scrim fades in or out (`--dur-fade`). */
const SCRIM_FADE_MS = 180;
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
const STEP = 16;
const BIG_STEP = 64;

/** The width range `[min, max]` the panel may take in a viewport this wide (max never below min). */
export function drawerWidthBounds(min: number, max: number, viewport: number): [number, number] {
  const lo = Number.isFinite(min) && min > 0 ? min : 0;
  const room = Number.isFinite(viewport) && viewport > 0 ? viewport - EDGE : Number.POSITIVE_INFINITY;
  const top = Number.isFinite(max) && max > 0 ? max : Number.POSITIVE_INFINITY;
  return [Math.round(lo), Math.round(Math.max(lo, Math.min(top, room)))];
}

/**
 * A panel width clamped to `[min, min(max, viewport - 48)]`, rounded to whole px. When the viewport is too narrow
 * for `min`, `min` wins (the sheet's CSS caps it at the viewport). A non-number width takes `min`.
 */
export function clampDrawerWidth(w: number, min: number, max: number, viewport: number): number {
  const [lo, hi] = drawerWidthBounds(min, max, viewport);
  return Number.isFinite(w) ? Math.round(Math.max(lo, Math.min(w, hi))) : lo;
}

/** The effective mode: an explicit `sheet` / `dock`, else dock when the viewport is wide enough. */
export function resolveDrawerMode(attr: string | null | undefined, wide: boolean): DrawerMode {
  if (attr === 'sheet' || attr === 'dock') return attr;
  return wide ? 'dock' : 'sheet';
}

const STRINGS = {
  en: { close: 'Close', resize: 'Resize panel' },
  ko: { close: '닫기', resize: '패널 크기 조절' },
};
type Strings = (typeof STRINGS)['en'];

type State = 'closed' | 'open' | 'closing';

/** A scroll place: the element and its offsets. */
type ScrollPlace = [Element, number, number];

/** Every scrolled element under these roots, through open shadow roots (the panel's own body, a slotted list). */
function scrollPlaces(roots: Iterable<Element>): ScrollPlace[] {
  const out: ScrollPlace[] = [];
  const visit = (el: Element) => {
    if (el.scrollTop || el.scrollLeft) out.push([el, el.scrollTop, el.scrollLeft]);
    for (const c of Array.from(el.children)) visit(c);
    if (el.shadowRoot) for (const c of Array.from(el.shadowRoot.children)) visit(c);
  };
  for (const r of roots) visit(r);
  return out;
}

function focusOnBody(): boolean {
  const a = document.activeElement;
  return !a || a === document.body || a === document.documentElement;
}

/**
 * `<ui-drawer>` — a side panel on a native `<dialog>`: a modal sheet over a scrim on narrow screens, docked beside
 * the page (non-modal) on wide ones, sliding on the drawer curve (320ms) both ways and turning around when it is
 * re-opened mid-exit. Optionally resizable from its inner edge (pointer or arrows). Escape, the scrim and the
 * close button send a cancelable `ui-close`; `show()` / `hide()` / `toggle()` / `open` send nothing.
 */
export class UiDrawer extends UiElement {
  static override styles = [styles];
  static get observedAttributes() {
    return [
      'open',
      'heading',
      'label',
      'mode',
      'dock-at',
      'side',
      'resizable',
      'width',
      'min-width',
      'max-width',
      'hide-close',
      'viewport',
      'lang',
    ];
  }

  #want = false;
  #state: State = 'closed';
  #mode: DrawerMode = 'sheet';
  #reflecting = false;
  #switching = false;
  #timer = 0;
  #closeAt = 0;
  #returnTo: Element | null = null;
  #downOnScrim = false;
  #escHandled = false;
  #head = false;
  #foot = false;
  #mql: MediaQueryList | null = null;
  #drag: { id: number; x: number; w: number; cur: number } | null = null;
  /** The visual viewport box while it is followed, and the stop for that. */
  #vv: ViewportBox | null = null;
  #vvStop: (() => void) | null = null;
  /** The running sheet ↔ dock morph (panel box, scrim). */
  #morph: Animation[] = [];

  constructor() {
    super();
    const r = this.root;
    r.addEventListener('click', (e) => this.#onClick(e));
    r.addEventListener('pointerdown', (e) => this.#onPointerDown(e as PointerEvent));
    r.addEventListener('pointermove', (e) => this.#onPointerMove(e as PointerEvent));
    r.addEventListener('pointerup', (e) => this.#onPointerEnd(e as PointerEvent));
    r.addEventListener('pointercancel', (e) => this.#onPointerEnd(e as PointerEvent));
    r.addEventListener('lostpointercapture', (e) => this.#onPointerEnd(e as PointerEvent));
    r.addEventListener('keydown', (e) => this.#onHandleKey(e as KeyboardEvent));
    r.addEventListener('transitionend', (e) => this.#onTransitionEnd(e));
    r.addEventListener('slotchange', () => this.#syncSlots());
    r.addEventListener('cancel', (e) => this.#onCancel(e), true);
    r.addEventListener('close', (e) => this.#onNativeClose(e), true);
    // On the host: keys from slotted content and from the shadow tree both arrive here.
    this.addEventListener('keydown', (e) => this.#onKey(e));
  }

  /** Whether the drawer is open (false while it is on its way out). Setting it is `show()` / `hide()`. */
  get open(): boolean {
    return this.#want;
  }

  set open(v: boolean) {
    this.#setOpen(!!v);
  }

  /** True when the effective mode is `dock` (beside the page, non-modal). */
  get docked(): boolean {
    return (this.isConnected ? this.#mode : this.#computeMode()) === 'dock';
  }

  /** Panel width in px, clamped to `[min-width, min(max-width, viewport - 48)]`. Setting it sets the attribute. */
  get width(): number {
    return clampDrawerWidth(this.#num('width', DRAWER_DEFAULTS.width), this.#min, this.#max, innerWidth);
  }

  set width(v: number) {
    if (Number.isFinite(v)) this.setAttribute('width', String(Math.round(v)));
  }

  show(): void {
    this.#setOpen(true);
  }

  hide(): void {
    this.#setOpen(false);
  }

  toggle(): void {
    this.#setOpen(!this.#want);
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === 'open') {
      if (!this.#reflecting) this.#setOpen(value !== null);
      return;
    }
    if (name === 'viewport') this.#syncViewport();
    if (name === 'dock-at' && this.isConnected) this.#listen();
    if (name === 'mode' || name === 'dock-at') this.#syncMode();
    this.requestRender();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#listen();
    this.#mode = this.#computeMode();
    window.addEventListener('resize', this.#onResize);
    this.renderNow();
    if (this.#want && this.#state === 'closed') this.#enter();
  }

  override disconnectedCallback(): void {
    this.#unlisten();
    window.removeEventListener('resize', this.#onResize);
    clearTimeout(this.#timer);
    this.#timer = 0;
    this.#returnTo = null;
    this.#drag = null;
    this.#state = 'closed';
    this.#syncViewport();
    this.#stopMorph();
    const dlg = this.#dlg();
    if (!dlg) return;
    dlg.setAttribute('data-state', 'closed');
    dlg.removeAttribute('data-resizing');
    if (dlg.open) dlg.close();
  }

  get #t(): Strings {
    return this.getAttribute('lang') === 'ko' ? STRINGS.ko : STRINGS.en;
  }

  get #side(): DrawerSide {
    return this.getAttribute('side') === 'left' ? 'left' : 'right';
  }

  get #min(): number {
    return this.#num('min-width', DRAWER_DEFAULTS.minWidth);
  }

  get #max(): number {
    return this.#num('max-width', DRAWER_DEFAULTS.maxWidth);
  }

  #num(name: string, fallback: number): number {
    const v = Number.parseFloat(this.getAttribute(name) ?? '');
    return Number.isFinite(v) && v > 0 ? v : fallback;
  }

  protected override update(): void {
    morphInto(this.content, this.render());
    this.updated();
  }

  protected override updated(): void {
    this.#syncSlots();
  }

  protected render(): string {
    const t = this.#t;
    const heading = this.getAttribute('heading') ?? '';
    const label = this.getAttribute('label') ?? '';
    const hideClose = this.hasAttribute('hide-close');
    const titled = !!heading || this.#head;
    const live = this.#dlg();
    const [lo, hi] = drawerWidthBounds(this.#min, this.#max, innerWidth);
    const w = this.#drag?.cur ?? this.width;
    const close = hideClose
      ? ''
      : `<button type="button" class="dr-close" part="close" aria-label="${escAttr(t.close)}">${icon('close')}</button>`;
    const handle = this.hasAttribute('resizable')
      ? `<div${attrs({
          class: 'dr-handle',
          part: 'handle',
          role: 'separator',
          'aria-orientation': 'vertical',
          'aria-label': t.resize,
          'aria-valuenow': w,
          'aria-valuemin': lo,
          'aria-valuemax': hi,
          tabindex: '0',
        })}></div>`
      : '';
    return `<dialog${attrs({
      class: 'dr',
      part: 'dialog',
      open: !!live?.open,
      'data-state': this.#state,
      'data-mode': this.isConnected ? this.#mode : this.#computeMode(),
      'data-side': this.#side,
      'data-resizing': !!this.#drag,
      // A heading attribute or a slotted header names it; the label only when neither is there.
      'aria-labelledby': titled ? 'dr-title' : undefined,
      'aria-label': !titled && label ? label : undefined,
      style: viewportVars(this.#vv) || undefined,
    })}><div class="dr-scrim" part="scrim" aria-hidden="true"></div><div${attrs({
      class: 'dr-panel',
      part: 'panel',
      tabindex: '-1',
      style: `--dr-w: ${w}px`,
    })}><header${attrs({ class: 'dr-head', part: 'header', hidden: !titled && hideClose })}><h2${attrs({
      class: 'dr-title',
      id: 'dr-title',
      part: 'title',
      hidden: !titled,
    })}><slot name="header">${esc(heading)}</slot></h2>${close}</header><div class="dr-body" part="body"><slot></slot></div><footer${attrs(
      { class: 'dr-foot', part: 'footer', hidden: !this.#foot },
    )}><slot name="footer"></slot></footer>${handle}</div></dialog>`;
  }

  #dlg(): HTMLDialogElement | null {
    return this.$<HTMLDialogElement>('dialog');
  }

  #syncSlots(): void {
    const has = (name: string) => Array.from(this.children).some((c) => c.getAttribute('slot') === name);
    const head = has('header');
    const foot = has('footer');
    if (head === this.#head && foot === this.#foot) return;
    this.#head = head;
    this.#foot = foot;
    if (this.#dlg()) this.renderNow();
  }

  // ── mode ──────────────────────────────────────────────────────────────────

  get #dockAt(): number {
    return this.#num('dock-at', DRAWER_DEFAULTS.dockAt);
  }

  #computeMode(): DrawerMode {
    const wide = typeof matchMedia === 'function' && matchMedia(`(min-width: ${this.#dockAt}px)`).matches;
    return resolveDrawerMode(this.getAttribute('mode'), wide);
  }

  #listen(): void {
    this.#unlisten();
    if (typeof matchMedia !== 'function') return;
    const mql = matchMedia(`(min-width: ${this.#dockAt}px)`);
    mql.addEventListener?.('change', this.#onMedia);
    this.#mql = mql;
  }

  #unlisten(): void {
    this.#mql?.removeEventListener?.('change', this.#onMedia);
    this.#mql = null;
  }

  readonly #onMedia = (): void => this.#syncMode();

  readonly #onResize = (): void => {
    if (this.#state !== 'closed') this.requestRender();
  };

  /** Follow a change of the effective mode; an open drawer switches over in place (the 320ms morph, none under reduced motion). */
  #syncMode(): void {
    if (!this.isConnected) return;
    const next = this.#computeMode();
    if (next === this.#mode) return;
    this.#mode = next;
    this.#switchOpen();
    this.renderNow();
    this.notify<DrawerModeChange>('ui-mode-change', { mode: next });
  }

  /**
   * The mode changed while open. A native dialog changes modality only through close() + showModal() / show(), so
   * both run in one task (no frame shows it closed) on the same node: the DOM, form state and the caret stay, every
   * scroll place in the panel and focus are put back, and the panel's box then morphs from where it was drawn
   * (320ms, retargeting a morph still running) while the scrim fades. Reduced motion: it switches at once.
   */
  #switchOpen(): void {
    const dlg = this.#dlg();
    if (!dlg) return;
    if (this.#state !== 'open') {
      dlg.setAttribute('data-mode', this.#mode);
      if (this.#state === 'closing') this.#finish();
      return;
    }
    const panel = this.$<HTMLElement>('.dr-panel');
    const scrim = this.$<HTMLElement>('.dr-scrim');
    // Where it is drawn now, mid-morph included.
    const from = panel?.getBoundingClientRect();
    const scrimFrom = scrim ? Number.parseFloat(getComputedStyle(scrim).opacity) : Number.NaN;
    this.#stopMorph();
    const places = scrollPlaces([...(panel ? [panel] : []), ...Array.from(this.children)]);
    const active = deepActive();
    const inside = this.#focusWithin();
    dlg.setAttribute('data-instant', '');
    dlg.setAttribute('data-mode', this.#mode);
    this.#switching = true;
    try {
      this.#openNative(dlg);
    } finally {
      this.#switching = false;
    }
    void dlg.offsetWidth;
    for (const [el, top, left] of places) {
      el.scrollTop = top;
      el.scrollLeft = left;
    }
    dlg.removeAttribute('data-instant');
    if (inside && active?.isConnected) (active as HTMLElement).focus?.({ preventScroll: true });
    else if (this.#mode === 'sheet') this.#focusFirst();
    if (!this.#drag && !prefersReducedMotion()) this.#morphFrom(dlg, from, scrimFrom);
  }

  /** Glide the panel's box (width, top) from `from` to where the new mode puts it; fade the scrim to its new end. */
  #morphFrom(dlg: HTMLDialogElement, from: DOMRect | undefined, scrimFrom: number): void {
    const panel = this.$<HTMLElement>('.dr-panel');
    const scrim = this.$<HTMLElement>('.dr-scrim');
    if (!panel || !from || typeof panel.animate !== 'function') return;
    const box = dlg.getBoundingClientRect();
    const to = panel.getBoundingClientRect();
    if (Math.abs(to.width - from.width) > 1 || Math.abs(to.top - from.top) > 1) {
      this.#morph.push(
        panel.animate(
          [
            { width: `${from.width}px`, top: `${from.top - box.top}px` },
            { width: `${to.width}px`, top: `${to.top - box.top}px` },
          ],
          { duration: DRAWER_MORPH_MS, easing: EASE_OUT },
        ),
      );
    }
    const scrimTo = this.#mode === 'sheet' ? 1 : 0;
    if (scrim && Number.isFinite(scrimFrom) && Math.abs(scrimFrom - scrimTo) > 0.01) {
      this.#morph.push(
        scrim.animate(
          [
            { opacity: scrimFrom, visibility: 'visible' },
            { opacity: scrimTo, visibility: 'visible' },
          ],
          { duration: SCRIM_FADE_MS, easing: EASE_OUT },
        ),
      );
    }
    // Settled or cancelled (a retarget, a close), it is no longer ours to cancel.
    for (const a of this.#morph) {
      a.finished?.then(
        () => this.#forget(a),
        () => this.#forget(a),
      );
    }
  }

  #forget(a: Animation): void {
    this.#morph = this.#morph.filter((m) => m !== a);
  }

  #stopMorph(): void {
    for (const a of this.#morph) a.cancel();
    this.#morph = [];
  }

  #openNative(dlg: HTMLDialogElement): void {
    if (dlg.open) dlg.close();
    if (this.#mode === 'sheet') dlg.showModal();
    else dlg.show();
  }

  /**
   * Open or on its way out (and not `viewport="layout"`): the box follows the visual viewport in both modes, so the
   * panel's foot (a composer) stays above the soft keyboard. Closed: nothing is listened to and the properties go.
   */
  #syncViewport(): void {
    const follow =
      this.isConnected && (this.#want || this.#state !== 'closed') && this.getAttribute('viewport') !== 'layout';
    if (follow === !!this.#vvStop) return;
    if (follow) {
      this.#vvStop = watchVisualViewport((box) => {
        this.#vv = box;
        applyViewportVars(this.#dlg(), box);
      });
      return;
    }
    this.#vvStop?.();
    this.#vvStop = null;
    this.#vv = null;
    applyViewportVars(this.#dlg(), null);
  }

  // ── open / close ──────────────────────────────────────────────────────────

  #setOpen(v: boolean): void {
    this.#want = v;
    this.#reflect(v);
    if (!this.isConnected) return;
    if (v) this.#enter();
    else this.#leave();
  }

  #reflect(v: boolean): void {
    if (this.hasAttribute('open') === v) return;
    this.#reflecting = true;
    this.toggleAttribute('open', v);
    this.#reflecting = false;
  }

  #setState(dlg: HTMLDialogElement, s: State): void {
    this.#state = s;
    dlg.setAttribute('data-state', s);
  }

  #exitMs(): number {
    return prefersReducedMotion() ? REDUCED_EXIT_MS : DRAWER_EXIT_MS;
  }

  #enter(): void {
    if (this.#state === 'open') return;
    if (!this.#dlg()) this.renderNow();
    const dlg = this.#dlg();
    if (!dlg) return;
    clearTimeout(this.#timer);
    this.#timer = 0;
    if (this.#state === 'closing') {
      this.#setState(dlg, 'open');
      return;
    }
    this.#syncMode(); // a breakpoint crossed while closed, unheard
    this.#returnTo = deepActive();
    this.#setState(dlg, 'closed');
    dlg.setAttribute('data-mode', this.#mode);
    this.#syncViewport(); // sized to the visible area before the first frame
    this.#openNative(dlg);
    void dlg.offsetWidth;
    this.#setState(dlg, 'open');
    this.#focusFirst();
  }

  #leave(): void {
    if (this.#state !== 'open') return;
    const dlg = this.#dlg();
    if (!dlg) {
      this.#state = 'closed';
      return;
    }
    this.#setState(dlg, 'closing');
    this.#closeAt = performance.now();
    clearTimeout(this.#timer);
    this.#timer = window.setTimeout(() => this.#finish(), this.#exitMs());
  }

  #finish(): void {
    clearTimeout(this.#timer);
    this.#timer = 0;
    if (this.#state !== 'closing') return;
    const dlg = this.#dlg();
    const back = this.#returnTo;
    this.#returnTo = null;
    // A docked drawer leaves focus alone when the person has moved on into the page.
    const restore = this.#focusWithin() || focusOnBody();
    this.#state = 'closed';
    this.#drag = null;
    this.#syncViewport();
    this.#stopMorph();
    if (dlg) {
      dlg.setAttribute('data-state', 'closed');
      dlg.removeAttribute('data-resizing');
      if (dlg.open) dlg.close();
    }
    if (restore) this.#focusBack(back);
  }

  #focusBack(el: Element | null): void {
    if (el?.isConnected && typeof (el as HTMLElement).focus === 'function')
      (el as HTMLElement).focus({ preventScroll: true });
  }

  #focusFirst(): void {
    const auto = this.querySelector<HTMLElement>('[autofocus]');
    if (auto) auto.focus();
    else this.$<HTMLElement>('.dr-panel')?.focus({ preventScroll: true });
  }

  #focusWithin(): boolean {
    let n: Node | null = deepActive();
    while (n) {
      if (n === this) return true;
      n = n.parentNode ?? (n instanceof ShadowRoot ? n.host : null);
    }
    return false;
  }

  #request(reason: DrawerCloseReason): void {
    if (this.#state !== 'open') return;
    if (this.emit<DrawerCloseDetail>('ui-close', { reason })) this.#setOpen(false);
  }

  // ── resize ────────────────────────────────────────────────────────────────

  #resizeTo(w: number): void {
    const next = clampDrawerWidth(w, this.#min, this.#max, innerWidth);
    if (next === this.width) return;
    this.setAttribute('width', String(next));
    this.renderNow();
    this.notify<DrawerResizeDetail>('ui-resize', { width: next });
  }

  #onHandleKey(e: KeyboardEvent): void {
    const h = (e.target as Element | null)?.closest?.('.dr-handle');
    if (!h || h.getRootNode() !== this.root) return;
    const [lo, hi] = drawerWidthBounds(this.#min, this.#max, innerWidth);
    const cur = this.width;
    const step = e.shiftKey ? BIG_STEP : STEP;
    // The inner edge moves toward the page to widen: left for a right drawer, right for a left one.
    const wider = this.#side === 'left' ? 'ArrowRight' : 'ArrowLeft';
    const narrower = this.#side === 'left' ? 'ArrowLeft' : 'ArrowRight';
    let next: number;
    if (e.key === wider) next = cur + step;
    else if (e.key === narrower) next = cur - step;
    else if (e.key === 'Home') next = lo;
    else if (e.key === 'End') next = hi;
    else return;
    e.preventDefault();
    this.#resizeTo(next);
  }

  #onPointerDown(e: PointerEvent): void {
    const t = e.target as Element | null;
    this.#downOnScrim = t === this.$('.dr-scrim');
    const h = t?.closest?.<HTMLElement>('.dr-handle');
    if (!h || h.getRootNode() !== this.root || e.button !== 0) return;
    e.preventDefault(); // no text selection while dragging
    try {
      h.setPointerCapture(e.pointerId);
    } catch {
      // a synthetic or already-gone pointer: the drag still works while the pointer stays on the handle
    }
    const w = this.width;
    this.#drag = { id: e.pointerId, x: e.clientX, w, cur: w };
    this.#dlg()?.setAttribute('data-resizing', '');
  }

  #onPointerMove(e: PointerEvent): void {
    const d = this.#drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    const next = clampDrawerWidth(this.#side === 'left' ? d.w + dx : d.w - dx, this.#min, this.#max, innerWidth);
    if (next === d.cur) return;
    d.cur = next;
    // Live, without a render: only the width and the value move.
    this.$('.dr-panel')?.style.setProperty('--dr-w', `${next}px`);
    this.$('.dr-handle')?.setAttribute('aria-valuenow', String(next));
  }

  #onPointerEnd(e: PointerEvent): void {
    const d = this.#drag;
    if (!d || e.pointerId !== d.id) return;
    this.#drag = null;
    try {
      this.$('.dr-handle')?.releasePointerCapture(d.id);
    } catch {
      // not captured
    }
    this.#dlg()?.removeAttribute('data-resizing');
    const moved = d.cur !== d.w;
    if (moved) this.setAttribute('width', String(d.cur));
    this.renderNow();
    if (moved) this.notify<DrawerResizeDetail>('ui-resize', { width: d.cur });
  }

  // ── dismiss ───────────────────────────────────────────────────────────────

  #onKey(e: KeyboardEvent): void {
    if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing || this.#state !== 'open') return;
    // Docked, the page is live: Escape belongs to the drawer only while focus is in it.
    if (this.#mode === 'dock' && !this.#focusWithin()) return;
    e.preventDefault();
    this.#escHandled = true;
    setTimeout(() => {
      this.#escHandled = false;
    }, 0);
    this.#request('escape');
  }

  #onCancel(e: Event): void {
    if (e.target !== this.#dlg()) return;
    e.preventDefault();
    if (this.#escHandled || (this.#mode === 'dock' && !this.#focusWithin())) return;
    this.#request('escape');
  }

  #onNativeClose(e: Event): void {
    const dlg = this.#dlg();
    if (this.#switching || !dlg || e.target !== dlg || dlg.open || this.#state === 'closed') return;
    clearTimeout(this.#timer);
    this.#timer = 0;
    const back = this.#returnTo;
    this.#returnTo = null;
    this.#drag = null;
    this.#setState(dlg, 'closed');
    this.#want = false;
    this.#reflect(false);
    this.#syncViewport();
    if (this.#focusWithin() || focusOnBody()) this.#focusBack(back);
  }

  #onClick(e: Event): void {
    const t = e.target as Element | null;
    const scrim = this.#downOnScrim && t === this.$('.dr-scrim');
    this.#downOnScrim = false;
    if (scrim) {
      this.#request('scrim');
      return;
    }
    const b = t?.closest?.('.dr-close');
    if (b && b.getRootNode() === this.root) this.#request('close-button');
  }

  #onTransitionEnd(e: Event): void {
    if (this.#state !== 'closing' || e.target !== this.$('.dr-panel')) return;
    if (performance.now() - this.#closeAt < this.#exitMs() / 2) return;
    this.#finish();
  }
}

define('ui-drawer', UiDrawer);

declare global {
  interface HTMLElementTagNameMap {
    'ui-drawer': UiDrawer;
  }
}
