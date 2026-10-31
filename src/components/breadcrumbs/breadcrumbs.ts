import { define, UiElement } from '../../core/element';
import { esc, escAttr, safeLink } from '../../core/html';
import { morphInto } from '../../core/morph';
import { icon } from '../../icons/icons';
import { styles } from './styles';

export interface BreadcrumbItem {
  /** Reported in `ui-select` for an item without `href`. */
  id?: string;
  label: string;
  /** A link (http(s) or same-site relative; `safeLink`): the browser follows it, no event. Without one the crumb is a button that says `ui-select`. */
  href?: string;
  /** A tooltip (the full name of a crumb that ellipsizes). */
  title?: string;
}

export interface BreadcrumbsData {
  /** The trail, root first; the last one is the current page (`aria-current="page"`, not a control). */
  items: BreadcrumbItem[];
  /** The `<nav>`'s accessible name. Default `Breadcrumbs` / `위치`. */
  label?: string;
}

/** `ui-select` detail (cancelable): a crumb without `href` was chosen — the host goes there. */
export interface BreadcrumbsSelect {
  id: string | undefined;
  index: number;
  item: BreadcrumbItem;
}

export type BreadcrumbsCollapse = 'auto' | 'never';
export type BreadcrumbsLang = 'en' | 'ko';

const STRINGS = {
  en: { label: 'Breadcrumbs', more: (n: number) => `Show ${n} more` },
  ko: { label: '위치', more: (n: number) => `${n}개 더 보기` },
};
type Strings = (typeof STRINGS)['en'];

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

// ── Pure helpers ────────────────────────────────────────────────────────────

/** The items as drawn: objects with a label (junk left out). */
export function breadcrumbItems(v: unknown): BreadcrumbItem[] {
  return Array.isArray(v)
    ? v
        .filter((x): x is BreadcrumbItem => !!x && typeof x === 'object')
        .map((x) => ({ ...x, label: str(x.label), id: x.id == null ? undefined : str(x.id) }))
    : [];
}

/** Which crumbs a trail of `n` shows: every index, or — folded with three or more — the first and the last only. */
export function breadcrumbVisible(n: number, folded: boolean): number[] {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  if (!folded || count < 3) return Array.from({ length: count }, (_, i) => i);
  return [0, count - 1];
}

/** `auto` (fold the middle crumbs when the row overflows) unless the attribute says `never`. */
export function breadcrumbCollapse(v: unknown): BreadcrumbsCollapse {
  return v === 'never' ? 'never' : 'auto';
}

/**
 * `<ui-breadcrumbs>` — where you are: a `<nav>` with the trail root first, separators drawn here (hidden from
 * screen readers), a link for each crumb with an `href`, a button (`ui-select`) for one without, the last crumb the
 * current page. When the row overflows its box the middle crumbs fold into one "…" button that reveals them
 * inline; the first and the last always show. A trailing `slot="end"` takes the host's status chip.
 */
export class UiBreadcrumbs extends UiElement<BreadcrumbsData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang', 'size', 'collapse'];
  }

  #ro: ResizeObserver | null = null;
  /** The node the observer watches (the list persists across morphs; a new one is observed again). */
  #watched: Element | null = null;
  /** The middle crumbs are folded behind "…". */
  #folded = false;
  /** The person opened the fold: it stays open until the trail changes. */
  #expanded = false;
  /** The width the whole row needed when it last overflowed (0 = fits / not measured). */
  #needed = 0;
  /** The next render reveals the middle crumbs (they fade in once). */
  #reveal = false;
  /** Guards the measure → render → measure loop. */
  #fitting = false;
  #seen: BreadcrumbsData | undefined;

  constructor() {
    super();
    this.root.addEventListener('click', (e) => this.#onClick(e));
    // The end slot's content changed size or came: the list's room did too.
    this.root.addEventListener('slotchange', () => this.#fit());
  }

  attributeChangedCallback(name: string): void {
    if (name === 'collapse') this.#expanded = false;
    this.requestRender();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof ResizeObserver === 'function' && !this.#ro) this.#ro = new ResizeObserver(() => this.#fit());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#ro?.disconnect();
    this.#ro = null;
    this.#watched = null;
  }

  get #lang(): BreadcrumbsLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  get #t(): Strings {
    return STRINGS[this.#lang];
  }

  get #items(): BreadcrumbItem[] {
    return breadcrumbItems(this.data?.items);
  }

  /** Whether the middle crumbs are folded behind "…" now. */
  get folded(): boolean {
    return this.#folded;
  }

  #onClick(e: Event): void {
    const target = e.target as Element | null;
    const more = target?.closest?.('.bc-more');
    if (more) {
      this.#expanded = true;
      this.#reveal = true;
      this.#folded = false;
      this.renderNow();
      this.sound('open', { emphasis: 'subtle' }, e);
      return;
    }
    const btn = target?.closest?.('.bc-btn') as HTMLElement | null;
    if (!btn) return;
    const index = Number(btn.dataset.i);
    const item = this.#items[index];
    if (!item) return;
    if (!this.emit<BreadcrumbsSelect>('ui-select', { id: item.id, index, item })) {
      e.preventDefault();
      return;
    }
    this.sound('navigate', { emphasis: 'subtle', direction: 'back' }, e);
  }

  // ── Render cycle ──────────────────────────────────────────────────────────

  /** Morph instead of replacing: the list node persists (the observer keeps it), focus and hover states stay. */
  protected override update(): void {
    const d = this.data;
    if (d !== this.#seen) {
      // A new trail: whatever the person opened is over; measure it fresh.
      this.#seen = d;
      this.#expanded = false;
      this.#folded = false;
      this.#needed = 0;
    }
    const active = this.root.activeElement as HTMLElement | null;
    const key = active?.dataset?.key;
    morphInto(this.content, this.render());
    const revealed = this.#reveal;
    this.#reveal = false;
    if (key && !this.root.activeElement) {
      // The "…" button that had focus is gone: the first crumb it revealed takes it.
      const next = revealed
        ? this.$('.bc-item[data-i="1"] > [data-key]')
        : this.$$('[data-key]').find((el) => el.dataset.key === key);
      next?.focus({ preventScroll: true });
    }
    this.updated();
  }

  protected override updated(): void {
    const list = this.$('.bc-list');
    if (this.#ro && list !== this.#watched) {
      if (this.#watched) this.#ro.unobserve(this.#watched);
      this.#watched = list;
      if (list) this.#ro.observe(list);
    }
    if (!this.#fitting) this.#fit();
  }

  /**
   * Fold or unfold from the row's measured overflow. Folding happens when the whole row is wider than its box;
   * unfolding when the box is at least as wide as the row needed — so a box between the two never flips.
   */
  #fit(): void {
    const list = this.$('.bc-list');
    if (!list || !this.isConnected) return;
    const n = this.#items.length;
    let folded = this.#folded;
    if (breadcrumbCollapse(this.getAttribute('collapse')) === 'never' || this.#expanded || n < 3) folded = false;
    else if (!folded) {
      if (list.scrollWidth > list.clientWidth) {
        folded = true;
        this.#needed = list.scrollWidth;
      }
    } else if (list.clientWidth >= this.#needed) folded = false;
    if (folded === this.#folded) return;
    this.#folded = folded;
    this.#fitting = true;
    try {
      this.renderNow();
    } finally {
      this.#fitting = false;
    }
    // Unfolded: it may still not fit — measure once more (it folds again with a larger `needed`, and stops).
    if (!folded) this.#fit();
  }

  protected render(): string {
    const items = this.#items;
    const t = this.#t;
    const label = str(this.data?.label).trim() || t.label;
    const shown = breadcrumbVisible(items.length, this.#folded);
    const hidden = items.length - shown.length;
    const sep = `<li class="bc-sep" aria-hidden="true">${icon('chevron-right', { size: 12, stroke: 1.75 })}</li>`;
    let rows = '';
    for (const i of shown) {
      if (i > 0) {
        if (this.#folded && i === items.length - 1) {
          rows += `${sep}<li class="bc-item bc-fold"><button type="button" class="bc-more" data-key="more" aria-expanded="false" aria-label="${escAttr(
            t.more(hidden),
          )}">${icon('more', { size: 14 })}</button></li>`;
        }
        rows += sep;
      }
      rows += this.#crumb(items[i], i, i === items.length - 1);
    }
    return `<nav class="bc" aria-label="${escAttr(label)}"><ol class="bc-list">${rows}</ol><div class="bc-end"><slot name="end"></slot></div></nav>`;
  }

  #crumb(item: BreadcrumbItem, i: number, last: boolean): string {
    const title = str(item.title).trim();
    const tt = title ? ` title="${escAttr(title)}"` : '';
    const cls = `bc-item${this.#reveal && i > 0 && !last ? ' is-in' : ''}`;
    const href = str(item.href).trim();
    let el: string;
    if (last) el = `<span class="bc-cur" aria-current="page"${tt}>${esc(item.label)}</span>`;
    else if (href) el = `<a class="bc-link" href="${safeLink(href)}" data-key="c${i}"${tt}>${esc(item.label)}</a>`;
    else el = `<button type="button" class="bc-btn" data-key="c${i}" data-i="${i}"${tt}>${esc(item.label)}</button>`;
    return `<li class="${cls}" data-i="${i}">${el}</li>`;
  }
}

define('ui-breadcrumbs', UiBreadcrumbs);

declare global {
  interface HTMLElementTagNameMap {
    'ui-breadcrumbs': UiBreadcrumbs;
  }
}
