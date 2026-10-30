import { define, UiElement } from '../../core/element';
import { esc, escAttr, safeHref } from '../../core/html';
import type { SoundCue } from '../../sound/sound';
import {
  errorText,
  messageFields,
  NARROW_PX,
  normTone,
  parsePlacement,
  rubber,
  type StackSlot,
  type SwipeSample,
  stackLayout,
  str,
  swipeDismisses,
  swipeOpacity,
  type ToastAction,
  type ToasterData,
  type ToastInput,
  type ToastLink,
  type ToastOptions,
  type ToastPromiseMessages,
  type ToastTone,
  toastDuration,
  visibleCount,
} from './logic';
import { type ToasterStrings, toasterStrings } from './strings';
import { styles } from './styles';

export interface ToastActionDetail {
  /** The toast's id. */
  id: string;
  /** `action.id`. */
  actionId: string;
}

/** Why a toast left: its timer ran out, the close button, a swipe, Esc, its action, or the host's dismiss(). */
export type ToastDismissReason = 'timeout' | 'close' | 'swipe' | 'escape' | 'action' | 'api';

export interface ToastDismissDetail {
  id: string;
  reason: ToastDismissReason;
}

/** A toast on screen (read-only snapshot). */
export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  action?: ToastAction;
  link?: ToastLink;
  /** Effective time on screen in ms (Infinity = until closed). */
  duration: number;
}

interface Toast {
  id: string;
  title: string;
  description: string;
  tone: ToastTone;
  action?: ToastAction;
  link?: ToastLink;
  /** As the host passed it. */
  duration: unknown;
  /** Bumped on every update: the timer restarts. */
  version: number;
  /** The tone whose cue already played: a toast sounds once as it appears and once per tone it changes to. */
  sounded?: ToastTone;
  /** Effective duration of this version. */
  ms: number;
  /** Time left on the timer (counts down only while it runs). */
  left: number;
  startedAt: number;
  timer: number;
  removeTimer: number;
  ghostTimer: number;
  /** Measured content height, 0 until known. */
  height: number;
  mounted: boolean;
  removing: boolean;
  swiping: boolean;
  pos: StackSlot;
  el?: HTMLLIElement;
}

interface Drag {
  t: Toast;
  pointer: number;
  x: number;
  y: number;
  axis: 'x' | 'y' | null;
  samples: SwipeSample[];
}

/** A closed toast fades and sinks, then leaves the DOM. */
const REMOVE_MS = 420;
/** The old text crossfades out this long after an update. */
const GHOST_MS = 320;
const FREE: StackSlot = { y: 0, scale: 1, height: 0, z: 0, behind: false, hidden: false };
/** The outcome cue of each tone; a plain toast is `ready`. */
const TONE_CUE: Record<ToastTone, SoundCue> = {
  neutral: 'ready',
  success: 'success',
  error: 'error',
  warning: 'warning',
  loading: 'loading',
};

const STATUS_SVG =
  '<svg class="ts-status" viewBox="0 0 24 24" aria-hidden="true"><g class="ts-spin"><circle class="ts-ring" cx="12" cy="12" r="9.2" pathLength="1"/></g><path class="ts-mark ts-check" d="m8.2 12.3 2.6 2.6 5-5.4" pathLength="1"/><path class="ts-mark ts-x1" d="m9.4 9.4 5.2 5.2" pathLength="1"/><path class="ts-mark ts-x2" d="m14.6 9.4-5.2 5.2" pathLength="1"/><path class="ts-mark ts-bang" d="M12 7.6v5" pathLength="1"/><path class="ts-dot" d="M12 16.1h.01"/></svg>';
const CLOSE_SVG = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="m2.2 2.2 5.6 5.6m0-5.6L2.2 7.8"/></svg>';

let seq = 0;

function normAction(a: unknown): ToastAction | undefined {
  if (!a || typeof a !== 'object') return undefined;
  const { id, label } = a as { id?: unknown; label?: unknown };
  if (id === undefined || id === null || id === '') return undefined;
  return label === undefined || label === null || label === ''
    ? { id: String(id) }
    : { id: String(id), label: String(label) };
}

function normLink(l: unknown): ToastLink | undefined {
  if (!l || typeof l !== 'object') return undefined;
  const label = str((l as { label?: unknown }).label);
  return label ? { label, href: str((l as { href?: unknown }).href) } : undefined;
}

/** The focused element, looking into open shadow roots (so focus can go back exactly there). */
function deepActive(): HTMLElement | null {
  let a = document.activeElement as HTMLElement | null;
  while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement as HTMLElement;
  return a && a !== document.body ? a : null;
}

/**
 * `<ui-toaster>` — one stack of calm toasts for a page (or, with `inline`, for a panel). Toasts come in from the
 * edge; the ones behind shrink and peek out, and the stack fans out on hover, keyboard focus or a tap. Timers pause
 * while the pointer or focus is in the stack and while the tab is hidden. Promise toasts turn their spinner into a
 * check or a cross. Swipe, Esc or the close button dismiss; F8 jumps to the newest toast.
 */
export class UiToaster extends UiElement<ToasterData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang'];
  }

  /** Newest first. */
  #list: Toast[] = [];
  #section: HTMLElement | null = null;
  #ol: HTMLElement | null = null;
  #more: HTMLElement | null = null;
  #dirty = true;
  #narrow = false;
  #frontH = 0;
  #hover = false;
  #focusIn = false;
  #focusVisible = false;
  #tapped = false;
  #tabHidden = false;
  #returnFocus: HTMLElement | null = null;
  #keepReturn = false;
  /** Set while a closing toast hands focus to the next one: that focusout is not focus leaving the stack. */
  #moving = false;
  #drag: Drag | null = null;
  #swiped = false;
  #pointerType = 'mouse';
  #ro: ResizeObserver | undefined;
  readonly #polite: HTMLElement;
  readonly #alert: HTMLElement;

  constructor() {
    super();
    // Outside the re-rendered markup, so a render never re-creates (or re-reads) the live regions.
    this.#polite = document.createElement('div');
    this.#polite.className = 'sr-only';
    this.#polite.setAttribute('role', 'status');
    this.#polite.setAttribute('aria-live', 'polite');
    this.#alert = document.createElement('div');
    this.#alert.className = 'sr-only';
    this.#alert.setAttribute('role', 'alert');
    this.root.append(this.#polite, this.#alert);
    this.root.addEventListener('click', (e) => this.#onClick(e as MouseEvent), true);
    this.root.addEventListener('keydown', (e) => this.#onKeyDown(e as KeyboardEvent));
    this.root.addEventListener('focusin', (e) => this.#onFocusIn(e as FocusEvent));
    this.root.addEventListener('focusout', (e) => this.#onFocusOut(e as FocusEvent));
    this.root.addEventListener('pointerdown', (e) => this.#onPointerDown(e as PointerEvent));
    this.root.addEventListener('pointermove', (e) => this.#onPointerMove(e as PointerEvent));
    this.root.addEventListener('pointerup', (e) => this.#onPointerUp(e as PointerEvent));
    this.root.addEventListener('pointercancel', (e) => this.#onPointerUp(e as PointerEvent));
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override connectedCallback(): void {
    window.addEventListener('keydown', this.#onHotkey);
    document.addEventListener('visibilitychange', this.#onVisibility);
    this.#tabHidden = document.visibilityState === 'hidden';
    super.connectedCallback();
  }

  /** Every timer stops: running toasts keep the time they had left, closing ones leave at once. */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.#onHotkey);
    document.removeEventListener('visibilitychange', this.#onVisibility);
    document.removeEventListener('pointerdown', this.#onDocDown, true);
    this.#ro?.disconnect();
    this.#hover = this.#focusIn = this.#focusVisible = this.#tapped = false;
    this.#drag = null;
    for (const t of [...this.#list]) {
      this.#pause(t);
      t.swiping = false;
      clearTimeout(t.ghostTimer);
      t.ghostTimer = 0;
      if (t.removing) this.#drop(t);
    }
  }

  override requestRender(): void {
    this.#dirty = true;
    super.requestRender();
  }

  // ── Public API ──

  /** Shows a toast and returns its id. An `id` that is on screen updates that toast in place instead. */
  show(input: ToastInput | string, options?: ToastOptions): string {
    const inp: ToastInput = typeof input === 'string' ? { ...options, title: input } : { ...input };
    const id = inp.id === undefined || inp.id === null || inp.id === '' ? `toast-${++seq}` : String(inp.id);
    const old = this.#find(id);
    if (old && !old.removing) {
      this.update(id, inp);
      return id;
    }
    if (old) this.#drop(old);
    this.#ensure();
    const t: Toast = {
      id,
      title: str(inp.title),
      description: str(inp.description),
      tone: normTone(inp.tone),
      action: normAction(inp.action),
      link: normLink(inp.link),
      duration: inp.duration,
      version: 0,
      ms: 0,
      left: 0,
      startedAt: 0,
      timer: 0,
      removeTimer: 0,
      ghostTimer: 0,
      height: 0,
      mounted: false,
      removing: false,
      swiping: false,
      pos: FREE,
    };
    this.#arm(t);
    this.#list.unshift(t);
    if (this.#ol) {
      this.#ol.insertAdjacentHTML('afterbegin', this.#toastHtml(t, false));
      t.el = this.#ol.firstElementChild as HTMLLIElement;
      this.#observeOne(t);
      this.#measure(t);
      this.#layout();
      this.#enter();
    }
    this.#announce(t);
    this.#chime(t);
    return id;
  }

  /**
   * Changes a toast on screen: fields in `patch` replace the toast's (an `undefined` value clears description,
   * action or link). The text crossfades, a tone change morphs the icon, the timer starts over. False when the id is
   * not on screen. (Without arguments it is the base class's render step: `UiElement` renders through `update()`.)
   */
  override update(): void;
  override update(id: string, patch: Partial<ToastInput>): boolean;
  override update(...args: [] | [id: string, patch: Partial<ToastInput>]): boolean | undefined {
    if (!args.length) {
      this.#dirty = false;
      super.update();
      return undefined;
    }
    return this.#updateToast(String(args[0]), args[1] ?? {});
  }

  #updateToast(id: string, patch: Partial<ToastInput>): boolean {
    const t = this.#find(id);
    if (!t || t.removing) return false;
    // A queued render goes first, so the in-place steps below land on markup that matches the state before them.
    this.#ensure();
    const before = { title: t.title, description: t.description, tone: t.tone, controls: this.#controlsKey(t) };
    if ('title' in patch) t.title = str(patch.title);
    if ('description' in patch) t.description = str(patch.description);
    if ('tone' in patch) t.tone = normTone(patch.tone);
    if ('action' in patch) t.action = normAction(patch.action);
    if ('link' in patch) t.link = normLink(patch.link);
    if ('duration' in patch) t.duration = patch.duration;
    t.version++;
    this.#pause(t);
    this.#arm(t);
    this.#patch(t, before);
    this.#measure(t);
    this.#layout();
    if (before.title !== t.title || before.description !== t.description || before.tone !== t.tone) this.#announce(t);
    this.#chime(t);
    return true;
  }

  /** Closes one toast, or every toast without an id. */
  dismiss(id?: string): void {
    const live = this.#liveList();
    for (const t of id === undefined ? live : live.filter((x) => x.id === String(id))) this.#dismiss(t, 'api');
  }

  /**
   * A loading toast (spinner, no timer) that turns into success or error when `task` settles: the arc closes into a
   * ring while a check or cross draws in, and the text crossfades. Each message is a title, `{ title, description,
   * action, link }` or a function of the result / error. `options.id` reuses a toast on screen (Retry morphs it back
   * into a spinner). Returns `task` as given, so the caller can await it.
   */
  promise<T>(
    task: Promise<T> | (() => Promise<T>),
    messages: ToastPromiseMessages<T> = {},
    options: ToastOptions = {},
  ): Promise<T> {
    let run: Promise<T>;
    try {
      run = Promise.resolve(typeof task === 'function' ? task() : task);
    } catch (e) {
      run = Promise.reject(e);
    }
    const tr = this.#t;
    const { id: want, tone: _tone, ...base } = options;
    const id = this.show({
      ...base,
      description: undefined,
      ...messageFields(messages.loading, undefined, tr.working),
      id: want,
      tone: 'loading',
    });
    const settle = (fields: Omit<ToastInput, 'id' | 'tone'>, tone: ToastTone): void => {
      const patch: ToastInput = { ...base, description: undefined, ...fields, tone };
      if (this.#liveList().some((t) => t.id === id)) this.update(id, patch);
      // A failure still reaches someone who closed the loading toast; a success does not come back.
      else if (tone === 'error') this.show({ ...patch, id });
    };
    run.then(
      (v) => settle(messageFields(messages.success, v, tr.done), 'success'),
      (e) =>
        settle(
          messageFields(messages.error, e, tr.failed, messages.error === undefined ? errorText(e) : undefined),
          'error',
        ),
    );
    return run;
  }

  /** The toasts on screen, newest first. */
  get toasts(): ToastItem[] {
    return this.#liveList().map((t) => ({
      id: t.id,
      title: t.title,
      ...(t.description ? { description: t.description } : {}),
      tone: t.tone,
      ...(t.action ? { action: { ...t.action } } : {}),
      ...(t.link ? { link: { ...t.link } } : {}),
      duration: t.ms,
    }));
  }

  /** Focus the newest toast (what the hotkey does); focus goes back where it was after the last one closes. */
  override focus(options?: FocusOptions): void {
    this.#ensure();
    const t = this.#liveList().find((x) => !x.pos.hidden && x.el);
    if (!t?.el) {
      super.focus(options);
      return;
    }
    this.#remember();
    t.el.focus(options);
  }

  /** After a re-render took the focused toast away: the newest toast. */
  protected override focusFallback(): HTMLElement | null {
    return this.#liveList().find((x) => !x.pos.hidden)?.el ?? null;
  }

  // ── Settings ──

  get #cfg(): ToasterData {
    return this.data ?? {};
  }

  get #t(): ToasterStrings {
    return toasterStrings(this.getAttribute('lang'));
  }

  get #hotkey(): string | null {
    const h = this.#cfg.hotkey;
    return h === undefined ? 'F8' : h ? String(h) : null;
  }

  get #place(): { y: 'top' | 'bottom'; x: 'left' | 'center' | 'right' } {
    return parsePlacement(this.#cfg.placement, this.#narrow, this.#cfg.mobilePlacement);
  }

  /** 1 when the stack sits on the bottom edge (cards lift up), -1 on the top edge. */
  get #edge(): 1 | -1 {
    return this.#place.y === 'bottom' ? 1 : -1;
  }

  /** Hover, keyboard focus, a tap (touch) or a hidden tab stop every timer, so nothing vanishes mid-read. */
  get #paused(): boolean {
    return !this.isConnected || this.#hover || this.#focusVisible || this.#tapped || this.#tabHidden;
  }

  get #expanded(): boolean {
    return !!this.#cfg.expand || this.#hover || this.#focusVisible || this.#tapped;
  }

  #find(id: string | undefined): Toast | undefined {
    return id === undefined ? undefined : this.#list.find((t) => t.id === id);
  }

  #liveList(): Toast[] {
    return this.#list.filter((t) => !t.removing);
  }

  #isNarrow(): boolean {
    const w = this.getBoundingClientRect().width;
    return w > 0 && w < NARROW_PX;
  }

  /** Render now when the shell is missing or a render is queued, so the next DOM step lands on current markup. */
  #ensure(): void {
    if (this.isConnected && (!this.#ol || this.#dirty)) this.renderNow();
  }

  // ── Markup ──

  protected render(): string {
    this.#narrow = this.#isNarrow();
    const { x, y } = this.#place;
    const label = str(this.#cfg.label) || this.#t.label;
    const hk = this.#hotkey;
    return `<section class="ts" data-x="${x}" data-y="${y}"${this.#narrow ? ' data-narrow' : ''}${
      this.#liveList().length ? '' : ' data-empty'
    } aria-label="${escAttr(hk ? `${label} (${hk})` : label)}" tabindex="-1"${this.#offsetAttr()}><ol class="ts-list">${this.#list
      .map((t) => this.#toastHtml(t, t.mounted))
      .join(
        '',
      )}</ol><p class="ts-more" hidden><span class="ts-more-n" aria-hidden="true"></span><span class="sr-only"></span></p></section>`;
  }

  #offsetAttr(): string {
    const o = this.#offset();
    return o === undefined ? '' : ` style="--ts-offset:${o}px"`;
  }

  #offset(): number | undefined {
    const raw = this.#cfg.offset;
    const o = raw === undefined || raw === null ? Number.NaN : Number(raw);
    return !this.#narrow && Number.isFinite(o) && o >= 0 ? o : undefined;
  }

  /** `still` = already on screen: no entrance animation for its icon. */
  #toastHtml(t: Toast, still: boolean): string {
    const key = escAttr(t.id);
    const controls = this.#controlsHtml(t);
    const close =
      this.#cfg.closeButton === false
        ? ''
        : `<button type="button" class="ts-close" data-act="close" data-key="c:${key}" aria-label="${escAttr(
            this.#t.close,
          )}">${CLOSE_SVG}</button>`;
    return `<li class="ts-toast" data-id="${key}" data-key="t:${key}" data-tone="${t.tone}" tabindex="0"${this.#liAttrs(
      t,
    )}><div class="ts-swipe"><div class="ts-card"><div class="ts-content"${controls ? ' data-controls' : ''}>${this.#iconHtml(
      t.tone,
      still,
    )}<div class="ts-text">${this.#copyHtml(t, false)}</div>${controls}</div>${this.#timerHtml(t)}</div>${close}</div></li>`;
  }

  /** Position styles in the markup, so a re-render puts every toast where it already is. */
  #liAttrs(t: Toast): string {
    if (!t.el && !t.mounted) return ' style="opacity:0"';
    const p = t.pos;
    return ` style="transform:${this.#transform(t)};opacity:${this.#opacity(t)};z-index:${p.z}${
      p.height ? `;height:${p.height}px` : ''
    }"${p.behind && !t.removing ? ' data-behind' : ''}${t.removing ? ' data-removing' : ''}${
      p.hidden || t.removing ? ' inert' : ''
    }`;
  }

  #iconHtml(tone: ToastTone, still: boolean): string {
    return tone === 'neutral'
      ? ''
      : `<span class="ts-icon" data-tone="${tone}"${still ? ' data-still' : ''}>${STATUS_SVG}</span>`;
  }

  #copyHtml(t: Toast, changed: boolean): string {
    const tr = this.#t;
    const say = t.tone === 'error' ? tr.error : t.tone === 'warning' ? tr.warning : '';
    return `<div class="ts-copy"${changed ? ' data-changed' : ''}>${
      say ? `<span class="sr-only">${esc(say)}: </span>` : ''
    }<div class="ts-title" dir="auto">${esc(t.title)}</div>${
      t.description ? `<div class="ts-desc" dir="auto">${esc(t.description)}</div>` : ''
    }</div>`;
  }

  #actionLabel(a: ToastAction): string {
    if (a.label) return a.label;
    const words = this.#t.actions;
    return Object.hasOwn(words, a.id) ? words[a.id] : a.id;
  }

  #controlsKey(t: Toast): string {
    return JSON.stringify([t.link ?? null, t.action ?? null]);
  }

  #controlsHtml(t: Toast): string {
    const key = escAttr(t.id);
    const link = t.link
      ? `<a class="ts-link" href="${safeHref(t.link.href)}" target="_blank" rel="noopener noreferrer" data-key="l:${key}"><span class="ts-label">${esc(
          t.link.label,
        )}</span></a>`
      : '';
    const label = t.action ? this.#actionLabel(t.action) : '';
    const action = t.action
      ? `<button type="button" class="ts-action" data-act="action" data-key="a:${key}" title="${escAttr(
          label,
        )}"><span class="ts-label">${esc(label)}</span></button>`
      : '';
    return link || action ? `<div class="ts-controls">${link}${action}</div>` : '';
  }

  #timerHtml(t: Toast): string {
    if (this.#cfg.hairline === false || !Number.isFinite(t.ms)) return '';
    const spent = Math.max(0, t.ms - this.#left(t));
    return `<span class="ts-timer" aria-hidden="true" style="--ts-dur:${t.ms}ms;animation-delay:-${spent}ms;animation-play-state:${
      t.timer ? 'running' : 'paused'
    }"></span>`;
  }

  // ── DOM after a render, and the small steps in between ──

  protected override updated(): void {
    this.#section = this.$('.ts');
    this.#ol = this.$('.ts-list');
    this.#more = this.$('.ts-more');
    for (const li of this.$$<HTMLLIElement>('.ts-toast')) {
      const t = this.#find(li.dataset.id);
      if (t) t.el = li;
    }
    this.#section?.addEventListener('pointerenter', this.#onEnter);
    this.#section?.addEventListener('pointerleave', this.#onLeave);
    this.#observe();
    for (const t of this.#list) this.#measure(t);
    this.#layout();
    this.#enter();
  }

  /** New toasts start at the edge; one forced layout later they glide to their slot. */
  #enter(): void {
    const fresh = this.#list.filter((t) => !t.mounted && !t.removing && t.el);
    if (!fresh.length || !this.isConnected) return;
    fresh[0].el!.getBoundingClientRect();
    for (const t of fresh) {
      t.mounted = true;
      this.#paint(t);
    }
  }

  /** Brings an updated toast's DOM in line with its state, in place: icon morph, text crossfade, new controls. */
  #patch(t: Toast, before: { title: string; description: string; tone: ToastTone; controls: string }): void {
    const li = t.el;
    if (!li) return;
    li.dataset.tone = t.tone;
    const content = li.querySelector<HTMLElement>('.ts-content');
    const text = li.querySelector<HTMLElement>('.ts-text');
    if (!content || !text) return;
    const icon = content.querySelector<HTMLElement>('.ts-icon');
    if (t.tone === 'neutral') icon?.remove();
    else if (!icon) content.insertAdjacentHTML('afterbegin', this.#iconHtml(t.tone, false));
    else {
      icon.removeAttribute('data-still');
      icon.dataset.tone = t.tone;
    }
    const textChanged = before.title !== t.title || before.description !== t.description;
    if (textChanged || before.tone !== t.tone) {
      for (const g of Array.from(text.querySelectorAll('.ts-ghost'))) g.remove();
      const old = text.querySelector<HTMLElement>('.ts-copy');
      if (old && textChanged) {
        old.classList.add('ts-ghost');
        old.removeAttribute('data-changed');
        old.setAttribute('aria-hidden', 'true');
        clearTimeout(t.ghostTimer);
        t.ghostTimer = window.setTimeout(() => {
          t.ghostTimer = 0;
          old.remove();
        }, GHOST_MS);
      } else old?.remove();
      text.insertAdjacentHTML('afterbegin', this.#copyHtml(t, textChanged));
    }
    if (this.#controlsKey(t) !== before.controls) {
      content.querySelector('.ts-controls')?.remove();
      const c = this.#controlsHtml(t);
      if (c) content.insertAdjacentHTML('beforeend', c);
      content.toggleAttribute('data-controls', !!c);
    }
    // A fresh hairline restarts its run.
    const card = li.querySelector<HTMLElement>('.ts-card');
    card?.querySelector('.ts-timer')?.remove();
    card?.insertAdjacentHTML('beforeend', this.#timerHtml(t));
  }

  #measure(t: Toast): void {
    const h = t.el?.querySelector<HTMLElement>('.ts-content')?.offsetHeight ?? 0;
    if (h) t.height = h;
  }

  #observe(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.#ro ??= new ResizeObserver((entries) => this.#onResize(entries));
    this.#ro.disconnect();
    this.#ro.observe(this);
    for (const t of this.#list) this.#observeOne(t);
  }

  #observeOne(t: Toast): void {
    const c = t.el?.querySelector('.ts-content');
    if (c && this.#ro) this.#ro.observe(c);
  }

  /** Text that wraps differently, an icon or a button that came or went, a host that became narrow or wide. */
  #onResize(entries: ResizeObserverEntry[]): void {
    let relayout = false;
    for (const en of entries) {
      if (en.target === this) {
        const narrow = this.#isNarrow();
        if (narrow !== this.#narrow) {
          this.#narrow = narrow;
          this.#applyPlace();
          relayout = true;
        }
        continue;
      }
      const li = (en.target as Element).closest<HTMLElement>('.ts-toast');
      const t = this.#find(li?.dataset.id);
      const h = (en.target as HTMLElement).offsetHeight;
      if (t && h && h !== t.height) {
        t.height = h;
        relayout = true;
      }
    }
    if (relayout) this.#layout();
  }

  #applyPlace(): void {
    const s = this.#section;
    if (!s) return;
    const { x, y } = this.#place;
    s.dataset.x = x;
    s.dataset.y = y;
    s.toggleAttribute('data-narrow', this.#narrow);
    const o = this.#offset();
    if (o === undefined) s.style.removeProperty('--ts-offset');
    else s.style.setProperty('--ts-offset', `${o}px`);
  }

  /** Every toast to its slot (collapsed stack or fanned-out list), the list's height, “+N”, then the timers. */
  #layout(): void {
    const ol = this.#ol;
    const live = this.#liveList();
    const max = visibleCount(this.#cfg.visible);
    if (ol) {
      const expanded = this.#expanded;
      const { slots, height } = stackLayout(
        live.map((t) => t.height),
        { expanded, visible: max, frontHeight: this.#frontH },
      );
      if (live[0]?.height) this.#frontH = live[0].height;
      live.forEach((t, i) => {
        t.pos = slots[i];
      });
      for (const t of this.#list) this.#paint(t);
      ol.style.height = `${height}px`;
      this.#section?.toggleAttribute('data-expanded', expanded && live.length > 0);
      this.#section?.toggleAttribute('data-empty', !live.length);
      const more = this.#more;
      const waiting = Math.max(0, live.length - max);
      if (more) {
        more.hidden = !waiting;
        const [n, say] = Array.from(more.children);
        const nText = waiting ? this.#t.more(waiting) : '';
        const sayText = waiting ? this.#t.moreSay(waiting) : '';
        if (n && n.textContent !== nText) n.textContent = nText;
        if (say && say.textContent !== sayText) say.textContent = sayText;
      }
    }
    this.#syncTimers();
  }

  #transform(t: Toast): string {
    const e = this.#edge;
    const p = t.pos;
    if (!t.mounted) return `translateY(${e * 100}%) scale(${p.scale})`;
    if (t.removing) return `translateY(${-e * p.y + e * 10}px) scale(${p.scale * 0.96})`;
    return `translateY(${-e * p.y}px) scale(${p.scale})`;
  }

  #opacity(t: Toast): string {
    return !t.mounted || t.removing || t.pos.hidden ? '0' : '1';
  }

  #paint(t: Toast): void {
    const li = t.el;
    if (!li) return;
    const p = t.pos;
    li.style.transform = this.#transform(t);
    li.style.opacity = this.#opacity(t);
    li.style.height = p.height ? `${p.height}px` : '';
    li.style.zIndex = String(p.z);
    li.toggleAttribute('data-behind', p.behind && !t.removing);
    li.toggleAttribute('data-removing', t.removing);
    li.toggleAttribute('inert', p.hidden || t.removing);
  }

  // ── Timers ──

  #arm(t: Toast): void {
    t.ms = toastDuration(t.tone, t.duration, this.#cfg.duration);
    t.left = t.ms;
  }

  #left(t: Toast): number {
    return t.timer ? Math.max(0, t.left - (Date.now() - t.startedAt)) : t.left;
  }

  #pause(t: Toast): void {
    if (!t.timer) return;
    clearTimeout(t.timer);
    t.left = this.#left(t);
    t.timer = 0;
  }

  /** A toast's timer runs only while connected, nothing pauses the stack, and the toast is visible and still. */
  #syncTimers(): void {
    const paused = this.#paused;
    for (const t of this.#list) {
      const run = !paused && !t.removing && !t.swiping && !t.pos.hidden && Number.isFinite(t.ms);
      if (run && !t.timer) {
        t.startedAt = Date.now();
        t.timer = window.setTimeout(() => {
          t.timer = 0;
          t.left = 0;
          this.#dismiss(t, 'timeout');
        }, t.left);
      } else if (!run && t.timer) this.#pause(t);
      const bar = t.el?.querySelector<HTMLElement>('.ts-timer');
      if (bar) bar.style.animationPlayState = run ? 'running' : 'paused';
    }
  }

  // ── Leaving ──

  #dismiss(t: Toast, reason: ToastDismissReason): void {
    if (t.removing) return;
    const focusNext = this.#nextFocus(t);
    this.#pause(t);
    t.removing = true;
    this.#moving = focusNext !== undefined;
    try {
      this.#layout();
      if (focusNext) focusNext.focus({ preventScroll: true });
      else if (focusNext === null) this.#restoreFocus();
    } finally {
      this.#moving = false;
    }
    if (this.isConnected && t.el) t.removeTimer = window.setTimeout(() => this.#drop(t), REMOVE_MS);
    else this.#drop(t);
    this.emit<ToastDismissDetail>('ui-dismiss', { id: t.id, reason });
  }

  /** Focus inside a closing toast moves to the next toast (null: back where it was before the stack). */
  #nextFocus(t: Toast): HTMLElement | null | undefined {
    const active = this.root.activeElement;
    if (!t.el || !active || !t.el.contains(active)) return undefined;
    const live = this.#liveList();
    const i = live.indexOf(t);
    const rest = live.filter((x) => x !== t);
    return rest[Math.min(i, rest.length - 1)]?.el ?? null;
  }

  #restoreFocus(): void {
    const back = this.#returnFocus;
    this.#returnFocus = null;
    if (back?.isConnected) back.focus({ preventScroll: true });
    else (this.root.activeElement as HTMLElement | null)?.blur();
  }

  #drop(t: Toast): void {
    clearTimeout(t.timer);
    clearTimeout(t.removeTimer);
    clearTimeout(t.ghostTimer);
    t.timer = t.removeTimer = t.ghostTimer = 0;
    t.el?.remove();
    t.el = undefined;
    const i = this.#list.indexOf(t);
    if (i >= 0) this.#list.splice(i, 1);
    if (!this.#liveList().length && this.#tapped) this.#untap();
  }

  // ── Announcements ──

  #announce(t: Toast): void {
    const tr = this.#t;
    const prefix = t.tone === 'error' ? `${tr.error}: ` : t.tone === 'warning' ? `${tr.warning}: ` : '';
    const sep = /[.!?…:]$/.test(t.title) ? ' ' : '. ';
    const text = `${prefix}${t.title}${t.description ? `${sep}${t.description}` : ''}`;
    const region = t.tone === 'error' ? this.#alert : this.#polite;
    // The same words twice are still news: a trailing no-break space makes the region change.
    region.textContent = region.textContent === text ? `${text} ` : text;
  }

  /**
   * Toasts come from code, so their cue is the one sound not tied to a click: the outcome, subtle, as a toast appears
   * or changes tone (a promise that settles). The page's sound setting decides; leaving is silent.
   */
  #chime(t: Toast): void {
    if (t.sounded === t.tone) return;
    t.sounded = t.tone;
    this.sound(TONE_CUE[t.tone], { emphasis: 'subtle' });
  }

  // ── Input ──

  #onClick(e: MouseEvent): void {
    if (this.#swiped) {
      this.#swiped = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const el = e.target as Element | null;
    const li = el?.closest?.<HTMLElement>('.ts-toast');
    const t = this.#find(li?.dataset.id);
    const act = el?.closest?.('[data-act]')?.getAttribute('data-act');
    if (t && !t.removing && act === 'close') {
      this.#dismiss(t, 'close');
      return;
    }
    if (t && !t.removing && act === 'action' && t.action) {
      const v = t.version;
      const ok = this.emit<ToastActionDetail>('ui-action', { id: t.id, actionId: t.action.id });
      if (ok) this.sound('tap', undefined, e);
      // Not cancelled → the toast closes, unless the handler already updated it in place (a retry).
      if (ok && t.version === v) this.#dismiss(t, 'action');
      return;
    }
    // Touch and pen: a tap on the stack fans it out; a tap outside folds it again.
    if (
      this.#pointerType !== 'mouse' &&
      !this.#tapped &&
      !el?.closest?.('a, button') &&
      el?.closest?.('.ts') &&
      this.#liveList().length > 1
    ) {
      this.#tapped = true;
      document.addEventListener('pointerdown', this.#onDocDown, true);
      this.#layout();
    }
  }

  readonly #onDocDown = (e: Event): void => {
    if (this.#section && e.composedPath().includes(this.#section)) return;
    this.#untap();
    this.#layout();
  };

  #untap(): void {
    this.#tapped = false;
    document.removeEventListener('pointerdown', this.#onDocDown, true);
  }

  #onKeyDown(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    const live = this.#liveList();
    if (!live.length) return;
    e.preventDefault();
    e.stopPropagation();
    const li = (e.target as Element | null)?.closest?.<HTMLElement>('.ts-toast');
    const t = (li && live.find((x) => x.id === li.dataset.id)) || live[0];
    this.#dismiss(t, 'escape');
  }

  readonly #onHotkey = (e: KeyboardEvent): void => {
    const hk = this.#hotkey;
    if (!hk || (e.key !== hk && e.code !== hk)) return;
    const t = this.#liveList().find((x) => !x.pos.hidden && x.el);
    if (!t?.el) return;
    e.preventDefault();
    this.#remember();
    t.el.focus();
  };

  /** Where focus goes back after the last toast: wherever it is now, unless it is already in the stack. */
  #remember(): void {
    if (this.#focusIn) return;
    this.#returnFocus = deepActive();
    this.#keepReturn = true;
  }

  readonly #onVisibility = (): void => {
    this.#tabHidden = document.visibilityState === 'hidden';
    this.#syncTimers();
  };

  readonly #onEnter = (e: Event): void => {
    if ((e as PointerEvent).pointerType !== 'mouse') return;
    this.#hover = true;
    this.#layout();
  };

  readonly #onLeave = (e: Event): void => {
    if ((e as PointerEvent).pointerType !== 'mouse') return;
    this.#hover = false;
    this.#layout();
  };

  #onFocusIn(e: FocusEvent): void {
    if (!this.#focusIn && !this.#keepReturn) {
      const from = e.relatedTarget as HTMLElement | null;
      this.#returnFocus = from && !this.root.contains(from) ? from : null;
    }
    this.#keepReturn = false;
    this.#focusIn = true;
    let visible = false;
    try {
      visible = (e.target as Element).matches(':focus-visible');
    } catch {
      visible = false;
    }
    if (visible) this.#focusVisible = true;
    this.#layout();
  }

  #onFocusOut(e: FocusEvent): void {
    const to = e.relatedTarget as Node | null;
    if (this.#moving || (to && this.root.contains(to))) return;
    // Focus left on its own: nothing to send it back to later.
    this.#returnFocus = null;
    this.#focusIn = false;
    this.#focusVisible = false;
    this.#layout();
  }

  #onPointerDown(e: PointerEvent): void {
    this.#pointerType = e.pointerType || 'mouse';
    const el = e.target as Element | null;
    const li = el?.closest?.<HTMLElement>('.ts-toast');
    const t = this.#find(li?.dataset.id);
    if (!t || t.removing || e.button !== 0 || el?.closest?.('button, a')) return;
    this.#drag = { t, pointer: e.pointerId, x: e.clientX, y: e.clientY, axis: null, samples: [] };
    this.#swiped = false;
  }

  #onPointerMove(e: PointerEvent): void {
    const d = this.#drag;
    if (!d || d.pointer !== e.pointerId) return;
    const sw = d.t.el?.querySelector<HTMLElement>('.ts-swipe');
    if (!sw || !d.t.el) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.axis) {
      if (Math.hypot(dx, dy) < 6) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      try {
        d.t.el.setPointerCapture(e.pointerId);
      } catch {
        /* capture is best effort */
      }
      this.#swiped = true;
      d.t.swiping = true;
      d.t.el.toggleAttribute('data-swiping', true);
      sw.style.transition = 'none';
      this.#syncTimers();
    }
    let v = d.axis === 'x' ? dx : dy;
    const toward = d.axis === 'x' || v * this.#edge > 0;
    if (!toward) v = rubber(v);
    const size = d.axis === 'x' ? sw.offsetWidth : sw.offsetHeight * 2;
    sw.style.transform = d.axis === 'x' ? `translateX(${v}px)` : `translateY(${v}px)`;
    sw.style.opacity = toward ? String(swipeOpacity(v, size)) : '';
    d.samples.push({ v, at: e.timeStamp });
    if (d.samples.length > 6) d.samples.shift();
  }

  /** Released far or fast enough toward a dismiss: it flies out that way. Otherwise it springs back. */
  #onPointerUp(e: PointerEvent): void {
    const d = this.#drag;
    if (!d || d.pointer !== e.pointerId) return;
    this.#drag = null;
    if (!d.axis) return;
    const t = d.t;
    t.swiping = false;
    t.el?.removeAttribute('data-swiping');
    const sw = t.el?.querySelector<HTMLElement>('.ts-swipe');
    if (!sw) return;
    if (e.type === 'pointerup' && swipeDismisses(d.samples, d.axis, this.#edge)) {
      const last = d.samples[d.samples.length - 1]?.v ?? 0;
      const size = (d.axis === 'x' ? sw.offsetWidth : sw.offsetHeight) + 48;
      sw.style.transition = 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 240ms ease';
      sw.style.transform = `${d.axis === 'x' ? 'translateX' : 'translateY'}(${Math.sign(last) * size}px)`;
      sw.style.opacity = '0';
      this.#dismiss(t, 'swipe');
    } else {
      sw.style.transition = '';
      sw.style.transform = '';
      sw.style.opacity = '';
      this.#syncTimers();
    }
  }
}

define('ui-toaster', UiToaster);

declare global {
  interface HTMLElementTagNameMap {
    'ui-toaster': UiToaster;
  }
}

/** The page's `<ui-toaster>` (not an `inline` one), created at the end of <body> when there is none. */
export function pageToaster(): UiToaster {
  const found = document.querySelector<UiToaster>('ui-toaster:not([inline])');
  if (found) return found;
  const el = document.createElement('ui-toaster');
  if (/^ko\b/i.test(document.documentElement.getAttribute('lang') ?? '')) el.setAttribute('lang', 'ko');
  document.body.append(el);
  return el;
}

export interface ToastFn {
  /** Shows a toast on the page's toaster (creating it once) and returns its id. */
  (input: ToastInput | string, options?: ToastOptions): string;
  success(title: string, options?: ToastOptions): string;
  error(title: string, options?: ToastOptions): string;
  warning(title: string, options?: ToastOptions): string;
  update(id: string, patch: Partial<ToastInput>): boolean;
  dismiss(id?: string): void;
  promise<T>(
    task: Promise<T> | (() => Promise<T>),
    messages?: ToastPromiseMessages<T>,
    options?: ToastOptions,
  ): Promise<T>;
}

const toned =
  (tone: ToastTone) =>
  (title: string, options?: ToastOptions): string =>
    pageToaster().show({ ...options, title, tone });

/** `toast('Saved')`, `toast.error('Couldn’t stop', { action: { id: 'retry' } })`, `toast.promise(fetch(…), {…})`. */
export const toast: ToastFn = Object.assign(
  (input: ToastInput | string, options?: ToastOptions): string => pageToaster().show(input, options),
  {
    success: toned('success'),
    error: toned('error'),
    warning: toned('warning'),
    update: (id: string, patch: Partial<ToastInput>): boolean => pageToaster().update(id, patch),
    dismiss: (id?: string): void => pageToaster().dismiss(id),
    promise: <T>(
      task: Promise<T> | (() => Promise<T>),
      messages?: ToastPromiseMessages<T>,
      options?: ToastOptions,
    ): Promise<T> => pageToaster().promise(task, messages, options),
  },
);
