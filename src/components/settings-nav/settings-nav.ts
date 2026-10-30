import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { attrs, esc, escAttr } from '../../core/html';
import { morphInto } from '../../core/morph';
import { icon } from '../../icons/icons';
import { styles } from './styles';

/** One link of the nav: a section of the settings page, found by `id` in the nav's root node. */
export interface SettingsNavSection {
  id: string;
  label: string;
  /** Rows in the section (e.g. `applySettingsFilter(...).sections[id]`). Drawn as a quiet number. */
  count?: number;
  /** Rows that differ from their defaults: an ink dot (and “n modified” for screen readers). */
  modified?: number;
}

export interface SettingsNavData {
  sections: SettingsNavSection[];
  /** The section the page is on. Set by the host to move it; tracking and links move it too. */
  current?: string;
  /** Search box + “Modified only”. Default true. */
  filter?: boolean;
  /** The search text. Adopted when the host changes it — typing is never overwritten by an echo. */
  query?: string;
  modifiedOnly?: boolean;
  /** Nothing matches the filter: “No settings match” with a Clear filters button. */
  empty?: boolean;
  /** The nav’s accessible name. Default “Settings sections”. */
  label?: string;
  /** Search placeholder. Default “Search settings”. */
  placeholder?: string;
  /** Follow the scroll position (IntersectionObserver). Default true. */
  track?: boolean;
}

/** `ui-navigate` detail (cancelable: preventDefault stops the scroll). */
export interface SettingsNavigateDetail {
  id: string;
}
/** `ui-filter` detail. */
export interface SettingsFilterDetail {
  query: string;
  modifiedOnly: boolean;
}
/** `ui-section-change` detail (a notification: the scroll moved the current section). */
export interface SettingsSectionChange {
  id: string;
}

/** Typing settles this long before `ui-filter` goes out. */
export const FILTER_DEBOUNCE_MS = 120;
/** After a link press, tracking waits for the scroll to end (or this long) before it follows the page again. */
export const NAV_PIN_MS = 1000;

const STRINGS = {
  en: {
    nav: 'Settings sections',
    search: 'Search settings',
    placeholder: 'Search settings',
    clearSearch: 'Clear search',
    modifiedOnly: 'Modified only',
    empty: 'No settings match',
    clear: 'Clear filters',
    modified: (n: number) => `, ${n} modified`,
  },
  ko: {
    nav: '설정 섹션',
    search: '설정 검색',
    placeholder: '설정 검색',
    clearSearch: '검색어 지우기',
    modifiedOnly: '바꾼 것만',
    empty: '맞는 설정이 없습니다',
    clear: '필터 지우기',
    modified: (n: number) => `, ${n}개 변경됨`,
  },
};
type Strings = (typeof STRINGS)['en'];

/** The sections worth drawing: a string id and a label, first of each id. */
export function navSections(d: SettingsNavData | undefined): SettingsNavSection[] {
  const seen = new Set<string>();
  const out: SettingsNavSection[] = [];
  for (const s of Array.isArray(d?.sections) ? d.sections : []) {
    if (!s || typeof s.id !== 'string' || !s.id || seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out;
}

const count = (v: unknown): number | undefined => {
  const n = Number(v);
  return v != null && Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
};

/** The nearest ancestor of `el` that actually scrolls vertically (the tracking root), else null (the viewport). */
function scrollRoot(el: Element): Element | null {
  for (let p = el.parentElement; p && p !== document.documentElement && p !== document.body; p = p.parentElement) {
    try {
      const oy = getComputedStyle(p).overflowY;
      if (/(auto|scroll|overlay)/.test(oy) && p.scrollHeight > p.clientHeight + 1) return p;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * `<ui-settings-nav>` — the side nav of a settings page: section links, a search box and “Modified only”, the
 * current section following the scroll, and a `notice` slot above it all. From an 840px viewport it is a column
 * (`layout="auto"`); below that a filter row over a scrolling row of chips. Links send a cancelable `ui-navigate`
 * and then scroll the section into view (never touching location.hash); the filter sends `ui-filter` — the host
 * hides rows (`applySettingsFilter`) and sends back counts and `empty`.
 */
export class UiSettingsNav extends UiElement<SettingsNavData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang', 'layout'];
  }

  #current: string | undefined;
  #hostCurrent: string | undefined;
  #query = '';
  #hostQuery: string | undefined;
  #emitted: string | undefined;
  #mod = false;
  #hostMod: boolean | undefined;
  #debounce = 0;
  #io: IntersectionObserver | null = null;
  #observed: HTMLElement[] = [];
  #visible = new Set<string>();
  #pinned: string | null = null;
  #pinTimer = 0;
  #revealed: string | undefined;
  #painted = false;
  #release = (): void => this.#unpin(true);

  constructor() {
    super();
    const r = this.root;
    r.addEventListener('click', (e) => this.#onClick(e));
    r.addEventListener('input', (e) => this.#onInput(e));
    r.addEventListener('change', (e) => this.#onChange(e));
    r.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    r.addEventListener('slotchange', () => this.requestRender());
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#disconnect();
    window.clearTimeout(this.#debounce);
    this.#debounce = 0;
    this.#unpin(false);
  }

  get #t(): Strings {
    return (this.getAttribute('lang') ?? '').toLowerCase().startsWith('ko') ? STRINGS.ko : STRINGS.en;
  }

  /** The current section id. */
  get current(): string | undefined {
    return this.#current;
  }

  /** The search text as typed (may be ahead of the last `ui-filter`). */
  get query(): string {
    return this.#query;
  }

  get modifiedOnly(): boolean {
    return this.#mod;
  }

  /**
   * Go to section `id` as if its link was pressed: a cancelable `ui-navigate`; unless prevented, the section is
   * scrolled into view (smooth unless reduced motion) and becomes current. Returns false when cancelled or unknown.
   */
  navigate(id: string): boolean {
    if (!navSections(this.data).some((s) => s.id === id)) return false;
    const detail: SettingsNavigateDetail = { id };
    if (!this.emit('ui-navigate', detail)) return false;
    const target = this.#target(id);
    if (target) {
      this.#pin(id);
      target.scrollIntoView?.({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }
    this.#setCurrent(id, false);
    return true;
  }

  /** Adopt what the host changed since the last data (and only that): current, query, modifiedOnly. */
  #sync(): void {
    const d = this.data;
    if (!d) return;
    if (d.current !== this.#hostCurrent) {
      this.#hostCurrent = d.current;
      if (d.current !== undefined) this.#current = d.current;
    }
    const q = d.query ?? '';
    if (q !== this.#hostQuery) {
      this.#hostQuery = q;
      // An echo of what this nav sent is not a change by the host: the person may already have typed further.
      if (q !== this.#emitted) this.#query = q;
    }
    const m = !!d.modifiedOnly;
    if (m !== this.#hostMod) {
      this.#hostMod = m;
      this.#mod = m;
    }
  }

  protected override update(): void {
    this.#sync();
    morphInto(this.content, this.render());
    this.updated();
  }

  protected render(): string {
    const d = this.data;
    const t = this.#t;
    const sections = navSections(d);
    const filter = d?.filter !== false;
    const cur = this.#current;
    const hasNotice = Array.from(this.children).some((c) => c.getAttribute('slot') === 'notice');
    const links = sections
      .map((s) => {
        const n = count(s.count);
        const mod = count(s.modified) ?? 0;
        return `<li><button${attrs({
          type: 'button',
          class: 'sn-link',
          part: 'link',
          'data-id': s.id,
          'data-key': `nav:${s.id}`,
          'data-zero': n === 0,
          'aria-current': s.id === cur ? 'true' : undefined,
        })}><span class="sn-label">${esc(s.label)}</span>${
          mod > 0
            ? `<span class="sn-dot" aria-hidden="true"></span><span class="sr-only">${esc(t.modified(mod))}</span>`
            : ''
        }${n !== undefined ? `<span class="sn-count">${n}</span>` : ''}</button></li>`;
      })
      .join('');
    const search = filter
      ? `<div class="sn-filter" part="filter"><div class="sn-search">${icon('search', { size: 14, class: 'sn-sicon' })}<input${attrs(
          {
            type: 'search',
            class: 'sn-q',
            'data-key': 'q',
            'aria-label': t.search,
            placeholder: d?.placeholder ?? t.placeholder,
            autocomplete: 'off',
            spellcheck: 'false',
            enterkeyhint: 'search',
          },
        )}><button${attrs({
          type: 'button',
          class: 'sn-qclear',
          'data-key': 'qclear',
          'aria-label': t.clearSearch,
          hidden: !this.#query,
        })}>${icon('close', { size: 12 })}</button></div><label class="sn-mod"><input${attrs({
          type: 'checkbox',
          class: 'sn-modchk',
          'data-key': 'mod',
        })}><span>${esc(t.modifiedOnly)}</span></label></div>`
      : '';
    const empty = d?.empty
      ? `<span class="sn-empty-text">${esc(t.empty)}</span>${
          filter ? `<button type="button" class="sn-clear" data-key="clear">${esc(t.clear)}</button>` : ''
        }`
      : '';
    return `<div class="sn"><div${attrs({
      class: 'sn-notice',
      part: 'notice',
      hidden: !hasNotice,
    })}><slot name="notice"></slot></div>${search}<nav class="sn-nav" part="nav" aria-label="${escAttr(
      d?.label ?? t.nav,
    )}"><ul class="sn-list" role="list">${links}</ul></nav><div class="sn-empty" role="status" part="empty">${empty}</div></div>`;
  }

  protected override updated(): void {
    this.#painted = true;
    const q = this.$<HTMLInputElement>('.sn-q');
    if (q && q.value !== this.#query) q.value = this.#query;
    const m = this.$<HTMLInputElement>('.sn-modchk');
    if (m && m.checked !== this.#mod) m.checked = this.#mod;
    this.#observe();
    if (this.#current !== this.#revealed) {
      this.#revealed = this.#current;
      this.#reveal();
    }
  }

  // ── current section ──

  #setCurrent(id: string, notify: boolean): void {
    if (id === this.#current) return;
    this.#current = id;
    for (const b of this.$$<HTMLElement>('.sn-link')) {
      if (b.dataset.id === id) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    }
    this.#revealed = id;
    this.#reveal();
    if (notify) {
      const detail: SettingsSectionChange = { id };
      this.notify('ui-section-change', detail);
    }
  }

  /** Bring the current chip into the row's view — sideways only, so the page never scrolls up or down for it. */
  #reveal(): void {
    const list = this.$('.sn-list');
    const link = this.$('.sn-link[aria-current="true"]');
    if (!list || !link || list.scrollWidth <= list.clientWidth + 1) return;
    const pad = 12;
    const left = link.offsetLeft;
    const right = left + link.offsetWidth;
    let to = list.scrollLeft;
    if (left - pad < to) to = left - pad;
    else if (right + pad > to + list.clientWidth) to = right + pad - list.clientWidth;
    to = Math.max(0, to);
    if (to === list.scrollLeft) return;
    const behavior: ScrollBehavior = this.#painted && !prefersReducedMotion() ? 'smooth' : 'auto';
    if (typeof list.scrollTo === 'function') list.scrollTo({ left: to, behavior });
    else list.scrollLeft = to;
  }

  /** Section `id` in the nav's root node (its document or shadow root), else in the document. */
  #target(id: string): HTMLElement | null {
    const root = this.getRootNode() as Document | ShadowRoot;
    const found = typeof root.getElementById === 'function' ? root.getElementById(id) : null;
    return (found as HTMLElement | null) ?? document.getElementById(id);
  }

  // ── tracking ──

  #observe(): void {
    const d = this.data;
    const on = this.isConnected && d?.track !== false && typeof IntersectionObserver === 'function';
    const targets = on
      ? navSections(d)
          .map((s) => this.#target(s.id))
          .filter((x): x is HTMLElement => !!x)
      : [];
    if (targets.length === this.#observed.length && targets.every((t, i) => t === this.#observed[i])) return;
    this.#disconnect();
    this.#observed = targets;
    if (!targets.length) return;
    try {
      let top = 0;
      try {
        top = Number.parseFloat(getComputedStyle(targets[0]).scrollMarginTop) || 0;
      } catch {
        top = 0;
      }
      // The reading band: from below a sticky bar (the sections' scroll-margin-top) down to 45% of the scroller.
      this.#io = new IntersectionObserver((entries) => this.#onIntersect(entries), {
        root: scrollRoot(targets[0]),
        rootMargin: `${-Math.max(0, Math.round(top))}px 0px -55% 0px`,
        threshold: 0,
      });
      for (const t of targets) this.#io.observe(t);
    } catch {
      this.#io = null;
    }
  }

  #disconnect(): void {
    this.#io?.disconnect();
    this.#io = null;
    this.#observed = [];
    this.#visible.clear();
  }

  #onIntersect(entries: IntersectionObserverEntry[]): void {
    for (const e of entries) {
      const id = (e.target as HTMLElement).id;
      if (e.isIntersecting) this.#visible.add(id);
      else this.#visible.delete(id);
    }
    if (!this.#pinned) this.#pick();
  }

  /** The topmost section in the reading band wins; when none is, the current one stays. */
  #pick(): void {
    const hit = this.#observed.find((t) => this.#visible.has(t.id) && !t.hidden);
    if (hit) this.#setCurrent(hit.id, true);
  }

  /** A link was pressed: hold that section while the page scrolls past the others. */
  #pin(id: string): void {
    this.#unpin(false);
    this.#pinned = id;
    document.addEventListener('scrollend', this.#release, { capture: true, once: true });
    this.#pinTimer = window.setTimeout(this.#release, NAV_PIN_MS);
  }

  #unpin(pick: boolean): void {
    const was = this.#pinned;
    this.#pinned = null;
    window.clearTimeout(this.#pinTimer);
    this.#pinTimer = 0;
    document.removeEventListener('scrollend', this.#release, { capture: true });
    // Still in view: the pressed section stays current even if one above it shows its last rows.
    if (pick && was && !this.#visible.has(was)) this.#pick();
  }

  // ── filter ──

  #emitFilter(): void {
    window.clearTimeout(this.#debounce);
    this.#debounce = 0;
    this.#emitted = this.#query;
    const detail: SettingsFilterDetail = { query: this.#query, modifiedOnly: this.#mod };
    this.emit('ui-filter', detail);
  }

  #setQuery(v: string): void {
    this.#query = v;
    const q = this.$<HTMLInputElement>('.sn-q');
    if (q && q.value !== v) q.value = v;
    this.$('.sn-qclear')?.toggleAttribute('hidden', !v);
  }

  #onInput(e: Event): void {
    const el = e.target as HTMLInputElement | null;
    if (!el?.classList?.contains('sn-q')) return;
    this.#setQuery(el.value);
    window.clearTimeout(this.#debounce);
    this.#debounce = window.setTimeout(() => this.#emitFilter(), FILTER_DEBOUNCE_MS);
  }

  #onChange(e: Event): void {
    const el = e.target as HTMLInputElement | null;
    if (!el?.classList?.contains('sn-modchk')) return;
    this.#mod = el.checked;
    this.#emitFilter();
  }

  #onKey(e: KeyboardEvent): void {
    const el = e.target as HTMLElement | null;
    if (!el?.classList?.contains('sn-q')) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      this.#emitFilter();
    } else if (e.key === 'Escape' && this.#query) {
      // Esc clears the search first; only an empty box lets Esc through (to close a drawer around it).
      e.preventDefault();
      e.stopPropagation();
      this.#setQuery('');
      this.#emitFilter();
    }
  }

  #onClick(e: Event): void {
    const t = e.target as Element | null;
    const link = t?.closest?.<HTMLElement>('.sn-link');
    if (link?.dataset.id) {
      this.navigate(link.dataset.id);
      return;
    }
    if (t?.closest?.('.sn-qclear')) {
      this.#setQuery('');
      this.#emitFilter();
      this.$<HTMLInputElement>('.sn-q')?.focus();
      return;
    }
    if (t?.closest?.('.sn-clear')) {
      this.#setQuery('');
      this.#mod = false;
      const m = this.$<HTMLInputElement>('.sn-modchk');
      if (m) m.checked = false;
      this.#emitFilter();
      this.$<HTMLInputElement>('.sn-q')?.focus();
    }
  }
}

define('ui-settings-nav', UiSettingsNav);

declare global {
  interface HTMLElementTagNameMap {
    'ui-settings-nav': UiSettingsNav;
  }
}
