import { define, UiElement } from '../../core/element';
import { attrs, cls, esc, safeSrc } from '../../core/html';
import { icon } from '../../icons/icons';

/** One picture in the grid. The shape of a `FileItem` (file-card, artifact-viewer), so one list serves all three. */
export interface MediaItem {
  id: string;
  /** The file name: the tile's title and part of its name. */
  name?: string;
  /** The picture: `thumb` for the tile, else `url`. */
  url?: string;
  thumb?: string;
  /** What the picture shows, for the name ("the login screen with the error"). */
  alt?: string;
}

export interface MediaGridData {
  items: MediaItem[];
  /** Tiles shown (default 4); the last one says "+N" for the rest. */
  max?: number;
  /** One picture on its own sits in a wide box that shows it whole (default: yes, unless compact). */
  single?: boolean;
}

/** `ui-open` detail (cancelable): the person asked to open this picture — `index` counts every item, shown or not. */
export interface MediaOpenDetail {
  id: string;
  index: number;
  item: MediaItem;
}

export type MediaGridSize = 'default' | 'compact';
export type MediaGridLang = 'en' | 'ko';

export const MEDIA_GRID_MAX = 4;

export const MEDIA_STRINGS = {
  en: {
    image: 'Image',
    images: (n: number) => (n === 1 ? '1 image' : `${n} images`),
    open: (pos: number, total: number, name: string) => `Open image ${pos} of ${total}: ${name}`,
    more: (n: number) => `, and ${n} more`,
    none: 'No preview',
  },
  ko: {
    image: '이미지',
    images: (n: number) => `이미지 ${n}개`,
    open: (pos: number, total: number, name: string) => `이미지 열기 ${pos}/${total}: ${name}`,
    more: (n: number) => ` 외 ${n}개`,
    none: '미리보기 불가',
  },
};

/** The tiles to draw: at most `max` (1 or more), and how many pictures the last one stands in for. */
export function mediaShown(items: MediaItem[], max?: number | null): { shown: MediaItem[]; more: number } {
  const n = Math.max(1, Math.floor(Number(max) || MEDIA_GRID_MAX));
  const shown = items.slice(0, n);
  return { shown, more: Math.max(0, items.length - shown.length) };
}

/**
 * The picture a tile shows: its `thumb`, else its `url` — '' when neither is a source a page may load. With the
 * sources that `failed` to load: a thumb that failed gives way to the `url` once (when it differs and is a source the
 * tile would draw); a url that failed too gives '' ("No preview").
 */
export function mediaSrc(item: Partial<MediaItem> | null | undefined, failed?: ReadonlySet<string>): string {
  for (const s of [safeSrc(item?.thumb), safeSrc(item?.url)]) if (s && !failed?.has(s)) return s;
  return '';
}

/** A tile's name: "Open image 2 of 5: login.png, and 3 more — the login screen" (ko: 이미지 열기 2/5: …). */
export function mediaLabel(
  item: Partial<MediaItem>,
  pos: number,
  total: number,
  more: number,
  lang: MediaGridLang = 'en',
): string {
  const s = MEDIA_STRINGS[lang] ?? MEDIA_STRINGS.en;
  const name = String(item.name ?? '').trim() || s.image;
  const alt = String(item.alt ?? '').trim();
  return `${s.open(pos, total, name)}${more > 0 ? s.more(more) : ''}${alt ? ` — ${alt}` : ''}`;
}

const css = `
:host { display: block; min-width: 0; }
.mg { display: flex; flex-wrap: wrap; gap: 4px; min-width: 0; }
/* The "+N" veil sits on the picture, not on the theme: the same dark wash and white figure in light and dark. */
.mg { --mg-scrim: color-mix(in srgb, #000 55%, transparent); --mg-on: #fff; }
.mg-tile {
  position: relative; flex: 0 0 auto; width: 80px; height: 80px; padding: 0; overflow: hidden;
  border: 1px solid var(--ib-card-border); border-radius: 8px; background: var(--ib-col); color: var(--ib-muted);
  font: inherit; cursor: zoom-in; -webkit-tap-highlight-color: transparent;
  transition: border-color var(--dur-press) ease, transform var(--dur-press) var(--ease-out);
}
.mg-tile img { display: block; width: 100%; height: 100%; object-fit: cover; }
.mg.is-single .mg-tile { width: 280px; max-width: 100%; height: 200px; background: var(--bg); }
.mg.is-single img { object-fit: contain; }
.mg-tile:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
.mg-tile:active:not(:focus-visible) { transform: scale(0.97); }
.mg-more {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: var(--mg-scrim); color: var(--mg-on); font-size: 17px; font-weight: 600; font-variant-numeric: tabular-nums;
}
.mg-none {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  padding: 4px; font-size: 10.5px; line-height: 1.3; text-align: center; color: var(--ib-muted); overflow-wrap: anywhere;
}
.mg-none svg { width: 16px; height: 16px; }
.mg.is-compact .mg-tile { width: 40px; height: 40px; border-radius: 6px; }
.mg.is-compact .mg-more { font-size: 12px; }
.mg.is-compact .mg-none span { display: none; }
@media (hover: hover) and (pointer: fine) {
  .mg-tile:hover { border-color: var(--ib-muted); }
}
@media (pointer: coarse) {
  .mg.is-compact .mg-tile { width: 44px; height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .mg-tile { transition: none; }
}
`;

/**
 * `<ui-media-grid>` — the pictures a person attached, as a row of 80px tiles (40px with `size="compact"`); past
 * `max` (4) the last tile says "+N" for the rest, one picture alone sits in a wide box that shows it whole. Every
 * tile is a button named by its action ("Open image 2 of 5: login.png, and 3 more"); activating one sends a
 * cancelable `ui-open` with the item and its index — the host opens its viewer at that picture (an artifact viewer
 * pages through the rest). Images load lazily; a thumb that fails to load tries the picture itself (`url`) once, and
 * one that fails shows "No preview" in its place.
 */
export class UiMediaGrid extends UiElement<MediaGridData> {
  static override styles = [css];
  static get observedAttributes(): string[] {
    return ['size', 'max', 'lang'];
  }

  /** Sources that failed to load: a thumb gives way to its url, a url to "No preview", from then on. */
  readonly #broken = new Set<string>();
  /** The tile activated last: where `focus()` returns after a viewer closes. */
  #last = '';

  constructor() {
    super();
    this.root.addEventListener('click', (e) => this.#onClick(e));
    // `error` does not bubble: catch it on the way down.
    this.root.addEventListener(
      'error',
      (e) => {
        const el = e.target as Element | null;
        if (el?.tagName !== 'IMG') return;
        const src = el.getAttribute('src') ?? '';
        if (!src || this.#broken.has(src)) return;
        this.#broken.add(src);
        this.requestRender();
      },
      true,
    );
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  /** `size="compact"`: 40px tiles (44px on a coarse pointer), no wide box for one picture. */
  get size(): MediaGridSize {
    return this.getAttribute('size') === 'compact' ? 'compact' : 'default';
  }

  set size(v: MediaGridSize) {
    if (v === 'compact') this.setAttribute('size', 'compact');
    else this.removeAttribute('size');
  }

  get #lang(): MediaGridLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  get #items(): MediaItem[] {
    return (this.data?.items ?? []).filter((x): x is MediaItem => !!x && typeof x === 'object' && x.id !== undefined);
  }

  get #max(): number | undefined {
    const own = this.data?.max;
    if (own !== undefined && own !== null) return Number(own);
    const attr = this.getAttribute('max');
    return attr === null ? undefined : Number(attr);
  }

  /** Focus the tile activated last (else the first): `viewer.open(items, i, grid)` returns focus here. */
  override focus(options?: FocusOptions): void {
    if (!this.$('.mg') && this.isConnected) this.renderNow();
    const tiles = this.$$<HTMLButtonElement>('.mg-tile');
    const tile = tiles.find((t) => t.dataset.key === this.#last) ?? tiles[0];
    if (tile) tile.focus(options);
    else super.focus(options);
  }

  #onClick(e: Event): void {
    const t = e.target as Element | null;
    const tile = t?.closest?.<HTMLElement>('.mg-tile');
    if (!tile) return;
    const index = Number(tile.dataset.index);
    const item = this.#items[index];
    if (!item) return;
    this.#last = String(item.id);
    if (this.emit<MediaOpenDetail>('ui-open', { id: String(item.id), index, item })) this.sound('tap', undefined, e);
  }

  protected render(): string {
    const items = this.#items;
    if (!items.length) return '';
    const s = MEDIA_STRINGS[this.#lang];
    const compact = this.size === 'compact';
    const { shown, more } = mediaShown(items, this.#max);
    const single = items.length === 1 && !compact && this.data?.single !== false;
    const tiles = shown
      .map((item, i) => {
        const rest = i === shown.length - 1 ? more : 0;
        const src = mediaSrc(item, this.#broken);
        const broken = !src;
        const name = String(item.name ?? '').trim();
        const a = attrs({
          type: 'button',
          class: cls('mg-tile', broken && 'is-broken'),
          part: 'tile',
          'data-key': String(item.id),
          'data-mk': String(item.id),
          'data-index': i,
          'aria-label': mediaLabel(item, i + 1, items.length, rest, this.#lang),
          title: name || undefined,
        });
        const img = broken
          ? `<span class="mg-none" aria-hidden="true">${icon('image')}<span>${esc(s.none)}</span></span>`
          : `<img src="${src}" alt="" loading="lazy" decoding="async" draggable="false">`;
        const veil = rest > 0 ? `<span class="mg-more" part="more" aria-hidden="true">+${rest}</span>` : '';
        return `<button${a}>${img}${veil}</button>`;
      })
      .join('');
    return `<div class="${cls('mg', single && 'is-single', compact && 'is-compact')}" part="grid" role="group" aria-label="${esc(s.images(items.length))}">${tiles}</div>`;
  }
}

define('ui-media-grid', UiMediaGrid);

declare global {
  interface HTMLElementTagNameMap {
    'ui-media-grid': UiMediaGrid;
  }
}
