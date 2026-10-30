import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { attrs, esc, escAttr } from '../../core/html';
import { morphInto } from '../../core/morph';
import { icon } from '../../icons/icons';
import { styles } from './styles';

export type LogScrollerLang = 'en' | 'ko';

export interface LogScrollerData {
  /** Older items exist before the first one shown: the top row offers them and scrolling up fetches them. */
  hasMore?: boolean;
  /** A page is on its way (the first page when there are no items yet, else an older page). */
  loading?: boolean;
  /** Accessible name of the log (default "Log" / "기록"). */
  label?: string;
  /** Text of the empty state (or slot `empty`). */
  emptyText?: string;
  /** Text of the start-of-history marker. Empty string hides the marker. */
  startText?: string;
  /** Announce appended items (`role="log"`, polite). Default true; false makes it a plain labelled region. */
  live?: boolean;
}

/** `ui-load-older` detail: the key (`data-item`) of the oldest item shown, null when it has none. */
export interface LogLoadOlderDetail {
  oldest: string | null;
}

export interface LogAppendOptions {
  /** How many of the appended items count as unread for the "latest" pill. Default: the number of elements. */
  unread?: number;
  /** Play the entry motion. Default true, except for the first items of an empty list. */
  animate?: boolean;
}

export interface LogPrependOptions {
  /** Whether still older items exist after this page. Omit to keep the current value. */
  hasMore?: boolean;
}

/** Within this many px of the bottom the reader is "at the newest" (pinned). */
export const LOG_PIN_SLACK = 4;
const ANCHOR_MAX = 6;
const GLIDE_MS = 700;

const STRINGS = {
  en: {
    label: 'Log',
    older: 'Load older',
    loading: 'Loading older…',
    first: 'Loading…',
    start: 'Start of history',
    empty: 'Nothing here yet',
    latest: 'Latest',
    unread: (n: number) => `${n} new`,
    jump: (n: number) => (n ? `Jump to latest, ${n} new ${n === 1 ? 'item' : 'items'}` : 'Jump to latest'),
  },
  ko: {
    label: '기록',
    older: '이전 항목 불러오기',
    loading: '이전 항목 불러오는 중…',
    first: '불러오는 중…',
    start: '기록의 시작',
    empty: '아직 항목이 없습니다',
    latest: '최신',
    unread: (n: number) => `새 항목 ${n}개`,
    jump: (n: number) => (n ? `최신으로 이동, 새 항목 ${n}개` : '최신으로 이동'),
  },
};

/** The reader is at the newest item: within `slack` px of the bottom (a box that cannot scroll always is). */
export function logAtBottom(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  slack = LOG_PIN_SLACK,
): boolean {
  return scrollHeight - clientHeight - scrollTop <= slack;
}

/**
 * Whether the next older page is due: the box cannot scroll yet (fill it — the reader would otherwise have only the
 * button), or the reader moved up since landing (`armed`) and the top is within one box height of the view.
 */
export function logPageDue(scrollTop: number, scrollHeight: number, clientHeight: number, armed: boolean): boolean {
  if (!(clientHeight > 0)) return false;
  if (scrollHeight <= clientHeight + 1) return true;
  return armed && scrollTop <= clientHeight;
}

/** The pill's visible text: "3 new" / "새 항목 3개", or "Latest" with nothing unread. */
export function logJumpText(unread: number, lang: LogScrollerLang = 'en'): string {
  const t = STRINGS[lang] ?? STRINGS.en;
  const n = Math.max(0, Math.floor(Number(unread) || 0));
  return n ? t.unread(n) : t.latest;
}

interface Anchor {
  el: Element;
  /** Px below the top edge of the box when captured. */
  at: number;
}

/**
 * `<ui-log-scroller>` — a scroll box for newest-at-bottom streams (chat, logs). It follows the newest item while the
 * reader is at the bottom; a reader who scrolled up keeps their place and gets a "latest" pill with the unread count.
 * Scrolling near the top asks for older items (`ui-load-older`, cancelable) and the reader's place is restored after
 * they are prepended. Items are the element's children (`data-item` keys): `appendItems` / `prependItems` /
 * `upsertItem` / `removeItem` touch only the nodes they name — existing nodes are never re-rendered.
 */
export class UiLogScroller extends UiElement<LogScrollerData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang'];
  }

  #vp: HTMLElement | null = null;
  /** The viewport node whose listeners are wired (once per node). */
  #listened: HTMLElement | null = null;
  /** `show|unread|lang` of the pill as last drawn. */
  #chrome = '';
  #pinned = true;
  #unread = 0;
  #armed = false;
  /** A ui-load-older went out and the page has not come back. */
  #olderLoading = false;
  /** A page request ended without a page: wait for the reader before asking again on our own. */
  #stalled = false;
  /** While an older page goes in above, the live region is off: a page of history is not news to announce. */
  #muted = false;
  #unmute = 0;
  #lastTop = 0;
  #held: Anchor[] | null = null;
  #capture = false;
  #glideUntil = 0;
  #ro: ResizeObserver | null = null;
  #io: IntersectionObserver | null = null;
  #fillQueued = false;

  constructor() {
    super();
    this.root.addEventListener('click', (e) => {
      const t = e.target as Element | null;
      if (t?.closest?.('.ls-older')) this.#requestOlder(true);
      else if (t?.closest?.('.ls-jump')) this.#jump(e);
    });
    this.root.addEventListener('slotchange', () => this.requestRender());
    // The entry motion runs once: the attribute goes when it ends (the event bubbles from the slotted item).
    this.addEventListener('animationend', (e) => {
      const el = e.target as Element | null;
      if (el && el.parentElement === this && el.hasAttribute('data-ls-enter')) el.removeAttribute('data-ls-enter');
    });
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override set data(value: LogScrollerData | undefined) {
    // A host update settles any page this element was waiting for (failed or done): its own loading flag goes.
    if (this.#olderLoading) {
      this.#olderLoading = false;
      this.#stalled = true;
    }
    super.data = value;
  }

  override get data(): LogScrollerData | undefined {
    return super.data;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.renderNow();
  }

  override disconnectedCallback(): void {
    cancelAnimationFrame(this.#unmute);
    this.#muted = false;
    this.#ro?.disconnect();
    this.#io?.disconnect();
    this.#ro = null;
    this.#io = null;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** The reader is following the newest item. */
  get pinned(): boolean {
    return this.#pinned;
  }

  /** Items appended since the reader left the bottom. */
  get unread(): number {
    return this.#unread;
  }

  /** The item elements, oldest first (children without a `slot`). */
  get items(): HTMLElement[] {
    return Array.from(this.children).filter((c): c is HTMLElement => !c.hasAttribute('slot'));
  }

  /** The item with this `data-item` key. */
  itemFor(key: string): HTMLElement | null {
    return this.items.find((el) => el.dataset.item === key) ?? null;
  }

  /** New items at the bottom. A pinned reader follows them; a reader higher up keeps the place and is told. */
  appendItems(nodes: Node | Node[], opts: LogAppendOptions = {}): void {
    const list = toNodes(nodes);
    if (!list.length) return;
    const wasEmpty = this.items.length === 0;
    const animate = opts.animate ?? !wasEmpty;
    const els = list.filter((n): n is Element => n.nodeType === 1);
    if (animate && !prefersReducedMotion()) for (const el of els) el.setAttribute('data-ls-enter', '');
    const pinned = this.#pinned;
    this.#mutate(() => this.append(...list));
    if (!pinned) this.#unread += Math.max(0, opts.unread ?? els.length);
    this.renderNow();
    if (pinned) this.#stick();
    if (wasEmpty) this.#fillSoon();
  }

  /**
   * Something new arrived inside an item already shown (a line added to an open group). A pinned reader keeps
   * following it (the box sticks to the bottom as it grows); a reader higher up is told — the pill counts `n` more.
   */
  noteUnread(n = 1): void {
    if (this.#pinned || !(n > 0)) return;
    this.#unread += Math.floor(n);
    this.renderNow();
  }

  /** An older page above the first item. The reader's place stays exactly where it was. */
  prependItems(nodes: Node | Node[], opts: LogPrependOptions = {}): void {
    const list = toNodes(nodes);
    this.#olderLoading = false;
    this.#stalled = false;
    if (opts.hasMore !== undefined) this.#setData({ hasMore: opts.hasMore, loading: false });
    else if (this.data?.loading) this.#setData({ loading: false });
    if (list.length) {
      // Silence the log before the nodes go in, and only lift it a frame later, so assistive tech never reads
      // the older page as new entries.
      this.#muted = true;
      this.renderNow();
      this.#mutate(() => this.prepend(...list));
      cancelAnimationFrame(this.#unmute);
      this.#unmute = requestAnimationFrame(() => {
        this.#unmute = requestAnimationFrame(() => {
          this.#muted = false;
          if (this.isConnected) this.renderNow();
        });
      });
    } else this.renderNow();
    this.#fillSoon();
  }

  /** Replace the item with this key in place (or append it when new). Nothing else re-renders. */
  upsertItem(key: string, node: HTMLElement, opts: LogAppendOptions = {}): void {
    node.dataset.item = key;
    const old = this.itemFor(key);
    if (!old) {
      this.appendItems(node, opts);
      return;
    }
    if (old === node) return;
    this.#mutate(() => {
      old.replaceWith(node);
      if (this.#held) for (const a of this.#held) if (a.el === old) a.el = node;
    });
  }

  /** Remove the item with this key. */
  removeItem(key: string): void {
    const old = this.itemFor(key);
    if (!old) return;
    this.#mutate(() => old.remove());
    this.renderNow();
  }

  /** Remove every item (named-slot children stay) and land at the bottom again. */
  clearItems(): void {
    for (const el of this.items) el.remove();
    this.#unread = 0;
    this.#pinned = true;
    this.#armed = false;
    this.#held = null;
    this.#olderLoading = false;
    this.#stalled = false;
    this.renderNow();
  }

  /** Go to the newest item (smooth unless reduced motion or `smooth: false`). */
  scrollToLatest(opts: { smooth?: boolean } = {}): void {
    const vp = this.#vp;
    this.#pinned = true;
    this.#unread = 0;
    this.#held = null;
    this.#armed = false;
    this.#syncChrome();
    if (!vp) return;
    const smooth = opts.smooth !== false && !prefersReducedMotion() && typeof vp.scrollTo === 'function';
    if (smooth) {
      this.#glideUntil = Date.now() + GLIDE_MS;
      vp.scrollTo({ top: vp.scrollHeight, behavior: 'smooth' });
    } else this.#stick();
  }

  // ── Render ───────────────────────────────────────────────────────────────

  get #lang(): LogScrollerLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  protected override update(): void {
    const active = this.root.activeElement as HTMLElement | null;
    const had = !!active && this.content.contains(active);
    morphInto(this.content, this.render());
    this.updated();
    // The focused control went away (the older row became the start marker): the box keeps focus.
    if (had && active && !active.isConnected) this.#vp?.focus({ preventScroll: true });
  }

  protected render(): string {
    const d = this.data ?? {};
    const t = STRINGS[this.#lang];
    const count = this.items.length;
    const loading = !!d.loading || this.#olderLoading;
    const hasMore = !!d.hasMore;
    const startText = d.startText ?? t.start;
    const showTop = count > 0 && (hasMore || startText !== '');
    const top = !showTop
      ? '<div class="ls-top" hidden></div>'
      : hasMore
        ? `<div class="ls-top"><button${attrs({
            type: 'button',
            class: 'ls-older',
            'data-key': 'older',
            'aria-busy': loading ? 'true' : undefined,
          })}>${loading ? '<span class="ls-spin" aria-hidden="true"></span>' : icon('chevron-up')}<span>${esc(
            loading ? t.loading : t.older,
          )}</span></button></div>`
        : `<div class="ls-top"><p class="ls-start">${esc(startText)}</p></div>`;
    const live = d.live !== false;
    const empty = `<div class="ls-state ls-empty" part="empty"${count || loading ? ' hidden' : ''}><slot name="empty">${esc(
      d.emptyText ?? t.empty,
    )}</slot></div>`;
    const first = `<div class="ls-state ls-loading" part="loading"${count || !loading ? ' hidden' : ''} aria-label="${escAttr(
      t.first,
    )}"><slot name="loading"><span class="ls-sk"></span><span class="ls-sk"></span><span class="ls-sk"></span></slot></div>`;
    return `<div${attrs({
      class: 'ls-vp',
      part: 'viewport',
      tabindex: '0',
      role: live ? 'log' : 'region',
      'aria-live': live && this.#muted ? 'off' : undefined,
      'aria-label': d.label || t.label,
      'aria-busy': loading ? 'true' : undefined,
    })}>${top}<div class="ls-list" part="list"><slot></slot></div>${empty}${first}</div>${this.#jumpHtml()}`;
  }

  #jumpHtml(): string {
    const t = STRINGS[this.#lang];
    const show = this.#showJump();
    return `<button${attrs({
      type: 'button',
      class: 'ls-jump',
      part: 'jump',
      'data-key': 'jump',
      'data-show': show,
      'aria-label': t.jump(this.#unread),
      'aria-hidden': show ? undefined : 'true',
      tabindex: show ? undefined : '-1',
    })}>${icon('chevron-down')}<span class="${this.#unread ? 'ls-jump-n' : ''}">${esc(logJumpText(this.#unread, this.#lang))}</span></button>`;
  }

  #showJump(): boolean {
    if (this.#pinned) return false;
    if (this.#unread > 0) return true;
    const vp = this.#vp;
    return !!vp && vp.scrollHeight - vp.clientHeight - vp.scrollTop > vp.clientHeight;
  }

  protected override updated(): void {
    this.#chrome = this.#chromeKey();
    const vp = this.$('.ls-vp');
    if (!vp) return;
    if (vp !== this.#listened) this.#listen(vp);
    if (this.isConnected && !this.#ro && !this.#io) this.#observe();
  }

  #chromeKey(): string {
    return `${this.#showJump()}|${this.#unread}|${this.#lang}`;
  }

  /** The pill only (scroll-driven): no full morph per scroll event, nothing when it did not change. */
  #syncChrome(): void {
    const key = this.#chromeKey();
    if (key === this.#chrome) return;
    this.#chrome = key;
    const old = this.$('.ls-jump');
    if (!old) return;
    const tpl = document.createElement('template');
    tpl.innerHTML = this.#jumpHtml();
    const next = tpl.content.firstElementChild;
    if (!next) return;
    for (const a of Array.from(old.attributes)) if (!next.hasAttribute(a.name)) old.removeAttribute(a.name);
    for (const a of Array.from(next.attributes))
      if (old.getAttribute(a.name) !== a.value) old.setAttribute(a.name, a.value);
    if (old.innerHTML !== next.innerHTML) old.innerHTML = next.innerHTML;
  }

  #setData(patch: Partial<LogScrollerData>): void {
    // Not through the setter: a page this element asked for is being answered, not abandoned.
    const next = { ...(this.data ?? {}), ...patch };
    const loading = this.#olderLoading;
    super.data = next;
    this.#olderLoading = loading;
  }

  // ── Scroll mechanics ─────────────────────────────────────────────────────

  #listen(vp: HTMLElement): void {
    this.#vp = vp;
    this.#listened = vp;
    this.#lastTop = vp.scrollTop;
    vp.addEventListener('scroll', () => this.#onScroll(), { passive: true });
    // The reader acting on a row (opening a detail, a fold) changes the list by their own hand: nothing is held against it.
    for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
      vp.addEventListener(
        type,
        () => {
          this.#held = null;
          if (type !== 'pointerdown') this.#glideUntil = 0;
        },
        { passive: true },
      );
    }
    this.#stick();
  }

  #observe(): void {
    const vp = this.#vp;
    if (!vp) return;
    this.#ro?.disconnect();
    if (typeof ResizeObserver === 'function') {
      this.#ro = new ResizeObserver(() => this.#onResize());
      this.#ro.observe(vp);
      const list = this.$('.ls-list');
      if (list) this.#ro.observe(list);
    }
    this.#io?.disconnect();
    const top = this.$('.ls-top');
    if (top && typeof IntersectionObserver === 'function') {
      this.#io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) this.#maybeFill();
        },
        { root: vp, rootMargin: '100% 0px 0px 0px' },
      );
      this.#io.observe(top);
    }
  }

  #setTop(top: number): void {
    const vp = this.#vp;
    if (!vp) return;
    if (Math.abs(vp.scrollTop - top) >= 1) vp.scrollTop = top;
    this.#lastTop = vp.scrollTop;
  }

  #stick(): void {
    const vp = this.#vp;
    if (vp) this.#setTop(vp.scrollHeight);
  }

  #onScroll(): void {
    const vp = this.#vp;
    if (!vp) return;
    const top = vp.scrollTop;
    // Our own scroll (#setTop) — no reader intent in it.
    if (Math.abs(top - this.#lastTop) < 1) return;
    const up = top < this.#lastTop;
    this.#lastTop = top;
    const bottom = logAtBottom(top, vp.scrollHeight, vp.clientHeight);
    if (this.#glideUntil) {
      if (!bottom && Date.now() < this.#glideUntil) return;
      this.#glideUntil = 0;
    }
    this.#pinned = bottom;
    if (bottom) this.#unread = 0;
    // The reader's own place now: the rows they see, read once a frame.
    this.#held = null;
    if (!bottom && !this.#capture) {
      this.#capture = true;
      requestAnimationFrame(() => {
        this.#capture = false;
        if (!this.#pinned) this.#held = this.#viewAnchor();
      });
    }
    // Moving up arms the sentinel; a landing never does, nor the box shrinking under a reader at the newest.
    if (up && !bottom) {
      this.#armed = true;
      this.#stalled = false;
    }
    this.#syncChrome();
    this.#maybeFill();
  }

  #onResize(): void {
    if (this.#pinned) this.#stick();
    else if (this.#held) this.#restore(this.#held);
    this.#syncChrome();
  }

  /** Change the items; a reader above the newest keeps the rows they see where they were. */
  #mutate(change: () => void): void {
    const vp = this.#vp;
    if (!vp || this.#pinned) {
      change();
      this.renderNow();
      if (vp && this.#pinned) this.#stick();
      return;
    }
    const anchor = this.#held ?? this.#viewAnchor();
    const fromBottom = vp.scrollHeight - vp.scrollTop;
    change();
    this.renderNow();
    if (anchor && this.#restore(anchor)) {
      // Held while what changed settles (cards render after this), until the reader moves on.
      this.#held = anchor;
    } else {
      this.#held = null;
      this.#setTop(vp.scrollHeight - fromBottom);
    }
  }

  /** The rows the reader is on: those wholly below the top edge first, then one the edge cuts. Null: none. */
  #viewAnchor(): Anchor[] | null {
    const vp = this.#vp;
    const items = this.items;
    if (!vp || !items.length) return null;
    const top = vp.getBoundingClientRect().top;
    const bottom = top + vp.clientHeight;
    // The first item whose bottom is below the top edge (items are in order).
    let lo = 0;
    let hi = items.length - 1;
    let first = items.length;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (items[mid].getBoundingClientRect().bottom > top) {
        first = mid;
        hi = mid - 1;
      } else lo = mid + 1;
    }
    const out: Anchor[] = [];
    const cut: Anchor[] = [];
    for (let i = first; i < items.length && out.length < ANCHOR_MAX; i++) {
      const item = items[i];
      const r = item.getBoundingClientRect();
      if (r.top >= bottom) break;
      // A host can mark finer anchors inside an item (entries inside a group): `data-anchor`.
      const fine = Array.from(item.querySelectorAll('[data-anchor]'));
      for (const el of fine.length ? fine : [item]) {
        const rr = el.getBoundingClientRect();
        if (!rr.height || rr.bottom <= top) continue;
        if (rr.top >= bottom) break;
        (rr.top >= top ? out : cut).push({ el, at: rr.top - top });
        if (out.length >= ANCHOR_MAX) break;
      }
    }
    const all = out.concat(cut).slice(0, ANCHOR_MAX);
    return all.length ? all : null;
  }

  /** The first anchor still shown goes back where it was. False when all are gone. */
  #restore(anchor: Anchor[]): boolean {
    const vp = this.#vp;
    if (!vp) return false;
    for (const a of anchor) {
      if (!a.el.isConnected || !a.el.getClientRects().length) continue;
      const shift = a.el.getBoundingClientRect().top - vp.getBoundingClientRect().top - a.at;
      if (Math.abs(shift) >= 1) this.#setTop(vp.scrollTop + shift);
      return true;
    }
    return false;
  }

  #fillSoon(): void {
    if (this.#fillQueued) return;
    this.#fillQueued = true;
    requestAnimationFrame(() => {
      this.#fillQueued = false;
      this.#maybeFill();
    });
  }

  #maybeFill(): void {
    const vp = this.#vp;
    if (!vp || !this.data?.hasMore || this.data?.loading || this.#olderLoading || !this.items.length) return;
    const cannotScroll = vp.scrollHeight <= vp.clientHeight + 1;
    if (this.#stalled && (cannotScroll || !this.#armed)) return;
    if (!logPageDue(vp.scrollTop, vp.scrollHeight, vp.clientHeight, this.#armed)) return;
    this.#requestOlder(false);
  }

  /** Ask the host for the page before the oldest item (button press or the sentinel). */
  #requestOlder(byHand: boolean): void {
    const d = this.data;
    if (!d?.hasMore || d.loading || this.#olderLoading) return;
    if (byHand) this.#stalled = false;
    const detail: LogLoadOlderDetail = { oldest: this.items[0]?.dataset.item ?? null };
    if (!this.emit('ui-load-older', detail)) return;
    this.#olderLoading = true;
    this.renderNow();
  }

  #jump(e: Event): void {
    const away = !this.#pinned;
    this.scrollToLatest();
    this.#vp?.focus({ preventScroll: true });
    if (away) this.sound('navigate', { emphasis: 'subtle' }, e);
  }
}

function toNodes(nodes: Node | Node[]): Node[] {
  if (Array.isArray(nodes)) return nodes;
  if (nodes.nodeType === 11) return Array.from(nodes.childNodes);
  return [nodes];
}

define('ui-log-scroller', UiLogScroller);

declare global {
  interface HTMLElementTagNameMap {
    'ui-log-scroller': UiLogScroller;
  }
}
