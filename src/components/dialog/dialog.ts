import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { attrs, esc, escAttr } from '../../core/html';
import { morphInto } from '../../core/morph';
import { deepActive } from '../../core/popover';
import { icon } from '../../icons/icons';
import { styles } from './styles';

/** Panel width: 400 · 560 · 720 · 960 px, or the whole viewport less 16px on each side. */
export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
/** Phones (< 640px): `auto` turns the panel into a bottom sheet, `never` keeps it centred. */
export type DialogSheet = 'auto' | 'never';
/** What the person did to ask for the close. */
export type DialogCloseReason = 'escape' | 'scrim' | 'close-button';

/** `ui-close` detail. */
export interface DialogCloseDetail {
  reason: DialogCloseReason;
}

const SIZES: readonly DialogSize[] = ['sm', 'md', 'lg', 'xl', 'full'];

/** The `size` attribute as a size (unknown or missing → `md`). */
export function dialogSize(value: string | null | undefined): DialogSize {
  return SIZES.includes(value as DialogSize) ? (value as DialogSize) : 'md';
}

/** The longest exit the styles define (centred panel, sheet and scrim all leave in 180ms). */
export const DIALOG_EXIT_MS = 180;
/** Under reduced motion only a 120ms opacity fade is left. */
const REDUCED_EXIT_MS = 120;

const STRINGS = {
  en: { close: 'Close' },
  ko: { close: '닫기' },
};
type Strings = (typeof STRINGS)['en'];

type State = 'closed' | 'open' | 'closing';

/** True when nothing in particular holds focus (it fell to the body when something under it went away). */
function focusOnBody(): boolean {
  const a = document.activeElement;
  return !a || a === document.body || a === document.documentElement;
}

/**
 * `<ui-dialog>` — a modal dialog over a dimmed page: a native `<dialog>` opened with `showModal()` (focus trap,
 * inert page, top layer) whose panel rises in (opacity + translateY(8px) scale(.97), 240ms) and settles back out
 * in 180ms; on phones it is a bottom sheet. Escape, the scrim and the close button send a cancelable `ui-close`;
 * `show()` / `hide()` / `open` open and close without one.
 */
export class UiDialog extends UiElement {
  static override styles = [styles];
  static get observedAttributes() {
    return ['open', 'heading', 'label', 'size', 'sheet', 'hide-close', 'lang'];
  }

  /** Asked to be open (the `open` attribute). False from the moment a close starts. */
  #want = false;
  #state: State = 'closed';
  #reflecting = false;
  #timer = 0;
  #closeAt = 0;
  #returnTo: Element | null = null;
  #downOnScrim = false;
  #escHandled = false;
  #head = false;
  #foot = false;

  constructor() {
    super();
    const r = this.root;
    r.addEventListener('click', (e) => this.#onClick(e));
    r.addEventListener('pointerdown', (e) => this.#onPointerDown(e));
    // On the host: keys from slotted content and from the shadow tree both arrive here.
    this.addEventListener('keydown', (e) => this.#onKey(e));
    r.addEventListener('transitionend', (e) => this.#onTransitionEnd(e));
    r.addEventListener('slotchange', () => this.#syncSlots());
    // Neither bubbles: catch them on the way down.
    r.addEventListener('cancel', (e) => this.#onCancel(e), true);
    r.addEventListener('close', (e) => this.#onNativeClose(e), true);
  }

  /** Whether the dialog is open (false while it is on its way out). Setting it is `show()` / `hide()`. */
  get open(): boolean {
    return this.#want;
  }

  set open(v: boolean) {
    this.#setOpen(!!v);
  }

  /** Open (no event). */
  show(): void {
    this.#setOpen(true);
  }

  /** Close with the exit motion (no event). */
  hide(): void {
    this.#setOpen(false);
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === 'open') {
      if (!this.#reflecting) this.#setOpen(value !== null);
      return;
    }
    this.requestRender();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.renderNow();
    if (this.#want && this.#state === 'closed') this.#enter();
  }

  override disconnectedCallback(): void {
    // A removed dialog leaves the top layer by itself; settle the state so a re-insert opens it cleanly.
    clearTimeout(this.#timer);
    this.#timer = 0;
    this.#returnTo = null;
    this.#state = 'closed';
    const dlg = this.#dlg();
    if (!dlg) return;
    dlg.setAttribute('data-state', 'closed');
    if (dlg.open) dlg.close();
  }

  get #t(): Strings {
    return this.getAttribute('lang') === 'ko' ? STRINGS.ko : STRINGS.en;
  }

  protected override update(): void {
    morphInto(this.content, this.render());
    this.updated();
  }

  protected override updated(): void {
    this.#syncSlots();
  }

  protected render(): string {
    const heading = this.getAttribute('heading') ?? '';
    const label = this.getAttribute('label') ?? '';
    const hideClose = this.hasAttribute('hide-close');
    const titled = !!heading || this.#head;
    // The live dialog's own `open` is carried over: a re-render never opens, closes or rebuilds it.
    const live = this.#dlg();
    const close = hideClose
      ? ''
      : `<button type="button" class="dg-close" part="close" aria-label="${escAttr(this.#t.close)}">${icon('close')}</button>`;
    return `<dialog${attrs({
      class: 'dg',
      part: 'dialog',
      open: !!live?.open,
      'data-state': this.#state,
      'data-size': dialogSize(this.getAttribute('size')),
      'data-sheet': this.getAttribute('sheet') === 'never' ? 'never' : 'auto',
      'aria-labelledby': heading ? 'dg-title' : undefined,
      'aria-label': !heading && label ? label : undefined,
    })}><div class="dg-scrim" part="scrim" aria-hidden="true"></div><div class="dg-panel" part="panel" tabindex="-1"><div class="dg-grab" aria-hidden="true"></div><header${attrs(
      { class: 'dg-head', part: 'header', hidden: !titled && hideClose },
    )}><h2${attrs({ class: 'dg-title', id: 'dg-title', part: 'title', hidden: !titled })}><slot name="header">${esc(
      heading,
    )}</slot></h2>${close}</header><div class="dg-body" part="body"><slot></slot></div><footer${attrs({
      class: 'dg-foot',
      part: 'footer',
      hidden: !this.#foot,
    })}><slot name="footer"></slot></footer></div></dialog>`;
  }

  #dlg(): HTMLDialogElement | null {
    return this.$<HTMLDialogElement>('dialog');
  }

  /** Header / footer rows show only when something is slotted into them. */
  #syncSlots(): void {
    const has = (name: string) => Array.from(this.children).some((c) => c.getAttribute('slot') === name);
    const head = has('header');
    const foot = has('footer');
    if (head === this.#head && foot === this.#foot) return;
    this.#head = head;
    this.#foot = foot;
    if (this.#dlg()) this.renderNow();
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
    return prefersReducedMotion() ? REDUCED_EXIT_MS : DIALOG_EXIT_MS;
  }

  #enter(): void {
    if (this.#state === 'open') return;
    if (!this.#dlg()) this.renderNow();
    const dlg = this.#dlg();
    if (!dlg) return;
    clearTimeout(this.#timer);
    this.#timer = 0;
    if (this.#state === 'closing') {
      // Still on screen: the transitions turn around from wherever they are.
      this.#setState(dlg, 'open');
      return;
    }
    this.#returnTo = deepActive();
    this.#setState(dlg, 'closed');
    if (dlg.open) dlg.close(); // never left open non-modally underneath
    dlg.showModal();
    void dlg.offsetWidth; // the closed-state styles land first, so the change below transitions
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

  /** The exit is over: close the native dialog and send focus home. */
  #finish(): void {
    clearTimeout(this.#timer);
    this.#timer = 0;
    if (this.#state !== 'closing') return;
    const dlg = this.#dlg();
    const back = this.#returnTo;
    this.#returnTo = null;
    // Only take focus back when it is still ours to give (inside, or dropped on the body).
    const restore = this.#focusWithin() || focusOnBody();
    this.#state = 'closed';
    if (dlg) {
      dlg.setAttribute('data-state', 'closed');
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
    else this.$<HTMLElement>('.dg-panel')?.focus({ preventScroll: true });
  }

  /** Focus is in this element (its shadow tree or slotted content, through nested shadow roots). */
  #focusWithin(): boolean {
    let n: Node | null = deepActive();
    while (n) {
      if (n === this) return true;
      n = n.parentNode ?? (n instanceof ShadowRoot ? n.host : null);
    }
    return false;
  }

  #request(reason: DialogCloseReason): void {
    if (this.#state !== 'open') return;
    if (this.emit<DialogCloseDetail>('ui-close', { reason })) this.#setOpen(false);
  }

  // ── events ────────────────────────────────────────────────────────────────

  #onKey(e: KeyboardEvent): void {
    // A control inside that used Escape itself (a menu, an IME composition) keeps it.
    if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing || this.#state !== 'open') return;
    e.preventDefault(); // no native cancel for this press
    this.#escHandled = true;
    setTimeout(() => {
      this.#escHandled = false;
    }, 0);
    this.#request('escape');
  }

  #onCancel(e: Event): void {
    if (e.target !== this.#dlg()) return;
    e.preventDefault(); // the close is ours to run (with its exit), or the host's to refuse
    if (!this.#escHandled) this.#request('escape');
  }

  #onNativeClose(e: Event): void {
    const dlg = this.#dlg();
    if (!dlg || e.target !== dlg || dlg.open || this.#state === 'closed') return;
    // Closed by other means (script on the inner dialog): settle at once, no exit to play.
    clearTimeout(this.#timer);
    this.#timer = 0;
    const back = this.#returnTo;
    this.#returnTo = null;
    this.#setState(dlg, 'closed');
    this.#want = false;
    this.#reflect(false);
    if (this.#focusWithin() || focusOnBody()) this.#focusBack(back);
  }

  #onPointerDown(e: Event): void {
    this.#downOnScrim = e.target === this.$('.dg-scrim');
  }

  #onClick(e: Event): void {
    const t = e.target as Element | null;
    // Both ends on the scrim: a selection dragged out of the panel is not a dismissal.
    const scrim = this.#downOnScrim && t === this.$('.dg-scrim');
    this.#downOnScrim = false;
    if (scrim) {
      this.#request('scrim');
      return;
    }
    const b = t?.closest?.('.dg-close');
    if (b && b.getRootNode() === this.root) this.#request('close-button');
  }

  #onTransitionEnd(e: Event): void {
    if (this.#state !== 'closing' || e.target !== this.$('.dg-panel')) return;
    // A transitionend this early belongs to the enter that was cut short.
    if (performance.now() - this.#closeAt < this.#exitMs() / 2) return;
    this.#finish();
  }
}

define('ui-dialog', UiDialog);

declare global {
  interface HTMLElementTagNameMap {
    'ui-dialog': UiDialog;
  }
}
