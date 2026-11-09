import { define, UiElement } from '../../core/element';
import { attrs, cls, esc, escAttr, safeLink } from '../../core/html';
import { morphInto } from '../../core/morph';
import { type IconName, icon, iconName } from '../../icons/icons';
import '../menu/menu';
import type { MenuItem, MenuSelect, UiMenu } from '../menu/menu';
import { styles } from './styles';

/** One destination in the dock (a tab in the bar, an icon in the rail, a row behind More). */
export interface DockItem {
  /** Stable id; `ui-navigate` carries it back. */
  id: string;
  label: string;
  /** Where it goes: http(s), mailto or a same-site relative URL. Without one (or an unsafe one) it is a button. */
  href?: string;
  /** A glyph from `@2lab.ai/ui/icons` — a name or an alias such as `settings` (20px in the bar, 18px in the rail). Default: a dot. */
  icon?: IconName | (string & {});
  /** The section you are in (`aria-current="page"`). The first current item wins. */
  current?: boolean;
  /** A count on the glyph ("3"). Zero, empty or missing: none. A number over 99 reads "99+". */
  badge?: number | string;
  /** What the section is for: the item's hover title and, behind More, the row's second line. */
  title?: string;
  /** Rail: drawn after a hairline at the end (settings, help). The bar keeps its order. */
  end?: boolean;
}

/** The one primary action (New task): the raised round button in the middle of the bar, the first button of the rail. */
export interface DockAction {
  id: string;
  label: string;
  /** Default `plus`. */
  icon?: IconName | (string & {});
}

export interface DockData {
  items: DockItem[];
  action?: DockAction;
  /** Accessible name of the navigation. Default "Sections" / "구역". */
  label?: string;
  /**
   * The bar's tabs before the rest fold behind More (the action is not counted). Default 4; clamped 2 … 6. With
   * one item over, the item shows instead of a More that would hold only it.
   */
  max?: number;
  /** The More tab's word. Default "More" / "더보기". */
  moreLabel?: string;
}

/** `bar` — the phone's bottom tab bar · `rail` — a floating icon column · `auto` — the bar under 640px, else the rail. */
export type DockLayout = 'bar' | 'rail' | 'auto';
export type DockLang = 'en' | 'ko';

/** `ui-navigate` detail. `href` is the item's target when it is safe to follow, else ''. */
export interface DockNavigate {
  id: string;
  href: string;
}

/** `ui-action` detail. */
export interface DockActionEvent {
  id: string;
}

const STRINGS = {
  en: {
    nav: 'Sections',
    more: 'More',
    badge: (n: string) => `${n} new`,
  },
  ko: {
    nav: '구역',
    more: '더보기',
    badge: (n: string) => `새 항목 ${n}개`,
  },
};

const LAYOUTS: readonly DockLayout[] = ['bar', 'rail', 'auto'];
const MORE_VALUE = 'dock:';
const PHONE = '(max-width: 639px)';

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export function dockLayout(v: unknown): DockLayout {
  return LAYOUTS.includes(v as DockLayout) ? (v as DockLayout) : 'bar';
}

/** A link target that cannot run script, or '' (the item is then a button). */
export function dockTarget(href: unknown): string {
  const s = str(href).trim();
  return s && safeLink(s) !== '#' ? s : '';
}

/** Items worth drawing: objects with a string id and label; a repeated id keeps the first; one current at most. */
export function dockItems(items: unknown): DockItem[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  let current = false;
  const out: DockItem[] = [];
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    const d = it as DockItem;
    const id = str(d.id).trim();
    const label = str(d.label).trim();
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    const cur = !!d.current && !current;
    if (cur) current = true;
    out.push({ ...d, id, label, current: cur });
  }
  return out;
}

/** The words a badge reads: '' for none (0, '', junk), "99+" over 99, the string as given otherwise. */
export function dockBadge(v: unknown): string {
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v <= 0) return '';
    return v > 99 ? '99+' : String(Math.floor(v));
  }
  return str(v).trim();
}

/** The bar's tab limit: 4 by default, clamped 2 … 6. */
export function dockMax(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : 4;
  return Math.min(6, Math.max(2, n));
}

/**
 * The bar's split: the tabs drawn and the items behind More. Over `max`, the first `max - 1` show and the rest fold —
 * unless only one would fold (then it shows: a More holding one item is a worse tab). The current item always shows:
 * when it would fold, it takes the last visible place.
 */
export function dockSplit(items: DockItem[], max: number): { shown: DockItem[]; more: DockItem[] } {
  if (items.length <= max + 1) return { shown: items, more: [] };
  let shown = items.slice(0, max - 1);
  let more = items.slice(max - 1);
  const cur = more.find((i) => i.current);
  if (cur) {
    const last = shown[shown.length - 1] as DockItem;
    shown = [...shown.slice(0, -1), cur];
    more = [last, ...more.filter((i) => i !== cur)];
  }
  return { shown, more };
}

/** The More tab's badge: the sum of the folded items' numeric badges ('' when none), or "•" when only words fold. */
export function dockMoreBadge(more: DockItem[]): string {
  let sum = 0;
  let words = false;
  for (const i of more) {
    const b = i.badge;
    if (typeof b === 'number' && Number.isFinite(b) && b > 0) sum += Math.floor(b);
    else if (dockBadge(b)) {
      const n = Number(dockBadge(b));
      if (Number.isFinite(n) && n > 0) sum += n;
      else words = true;
    }
  }
  if (sum > 0) return sum > 99 ? '99+' : String(sum);
  return words ? '•' : '';
}

/**
 * `<ui-dock>` — where you can go, one press away, and the one thing you start from anywhere. On a phone it is the
 * bottom tab bar: equal tabs with a glyph on a capsule and a word under it, the current section's capsule filled, a
 * count on a glyph, the primary action raised in the middle, and More for the rest (a menu). On a wide screen it is
 * the rail: a floating column of glyphs with their names as hover labels, the action first, settings-like items
 * after a hairline. `layout="auto"` switches at 640px; `fixed` pins it to the viewport's bottom (bar) or left (rail).
 * Items send a cancelable `ui-navigate`, the action `ui-action`.
 */
export class UiDock extends UiElement<DockData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return ['layout', 'fixed', 'lang'];
  }

  #mq: MediaQueryList | null = null;
  readonly #onMq = () => this.requestRender();
  readonly #nav: HTMLElement;
  readonly #body: HTMLElement;
  readonly #moreBox: HTMLElement;
  readonly #menu: UiMenu;
  readonly #moreBtn: HTMLButtonElement;
  #moreItems: DockItem[] = [];

  constructor() {
    super();
    // The More menu is a live primitive built once (its open state and the trigger's aria-expanded are its own);
    // the rest is patched in place, so a new badge or current tab never re-enters.
    this.#nav = document.createElement('nav');
    this.#nav.className = 'dk';
    this.#nav.setAttribute('part', 'dock');
    // The drawn tabs (patched in place) and, after them, More — a sibling the patch never touches, so an open menu
    // survives a new badge. Both are laid out by the nav's grid (the body is display: contents).
    this.#body = document.createElement('div');
    this.#body.className = 'dk-body';
    this.#moreBox = document.createElement('div');
    this.#moreBox.className = 'dk-more';
    this.#moreBox.hidden = true;
    this.#menu = document.createElement('ui-menu') as UiMenu;
    this.#menu.setAttribute('placement', 'top-end');
    this.#moreBtn = document.createElement('button');
    this.#moreBtn.type = 'button';
    this.#moreBtn.slot = 'trigger';
    this.#moreBtn.className = 'dk-item dk-more-btn';
    this.#moreBtn.dataset.key = 'more';
    this.#menu.append(this.#moreBtn);
    this.#moreBox.append(this.#menu);
    this.#nav.append(this.#body, this.#moreBox);
    this.content.append(this.#nav);
    this.root.addEventListener('click', (e) => this.#onClick(e as MouseEvent));
    this.root.addEventListener('ui-select', (e) => {
      if (e.target === this.#menu) this.#onMenuSelect(e as CustomEvent<MenuSelect>);
    });
    this.root.addEventListener('ui-open-change', (e) => {
      if (e.target === this.#menu) e.stopPropagation();
    });
  }

  attributeChangedCallback(name: string): void {
    if (name === 'layout') this.#syncMedia();
    this.requestRender();
  }

  override connectedCallback(): void {
    this.#syncMedia();
    super.connectedCallback();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#syncMedia();
  }

  /** The layout drawn now: `auto` resolves to the bar under 640px (watched only while connected), else the rail. */
  get layout(): 'bar' | 'rail' {
    const l = dockLayout(this.getAttribute('layout'));
    if (l !== 'auto') return l;
    return this.#mq?.matches ? 'bar' : 'rail';
  }

  get #lang(): DockLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  #syncMedia(): void {
    const want = this.isConnected && this.getAttribute('layout') === 'auto' && typeof matchMedia === 'function';
    if (want === !!this.#mq) return;
    if (want) {
      this.#mq = matchMedia(PHONE);
      this.#mq.addEventListener('change', this.#onMq);
      return;
    }
    this.#mq?.removeEventListener('change', this.#onMq);
    this.#mq = null;
  }

  /** Patched in place: a tab's capsule and badge move with CSS, and the More menu (a live primitive) stays put. */
  protected override update(): void {
    const focused = this.#focusedKey();
    const layout = this.layout;
    const d = this.data;
    const s = STRINGS[this.#lang];
    const items = dockItems(d?.items);
    const action = this.#action(d?.action);
    const { shown, more } = layout === 'bar' ? dockSplit(items, dockMax(d?.max)) : { shown: items, more: [] };
    this.#moreItems = more;
    this.#nav.setAttribute('aria-label', str(d?.label).trim() || s.nav);
    this.#nav.dataset.layout = layout;
    this.toggleAttribute('data-bar', layout === 'bar');
    morphInto(this.#body, this.render());
    if (more.length) {
      const word = str(d?.moreLabel).trim() || s.more;
      const badge = dockMoreBadge(more);
      const cur = more.some((i) => i.current);
      this.#moreBtn.className = cls('dk-item', 'dk-more-btn', cur && 'is-current');
      this.#moreBtn.setAttribute('aria-label', badge && badge !== '•' ? `${word}, ${s.badge(badge)}` : word);
      this.#moreBtn.innerHTML = `<span class="dk-cap" aria-hidden="true">${icon('more', { size: 20 })}${
        badge ? `<span class="dk-badge${badge === '•' ? ' is-dot' : ''}">${badge === '•' ? '' : esc(badge)}</span>` : ''
      }</span><span class="dk-word" aria-hidden="true">${esc(word)}</span>`;
      this.#menu.data = { label: word, items: this.#menuItems(more) };
      this.#menu.setAttribute('lang', this.#lang);
      // The last cell of the grid: More comes after every tab (and after the action's right half).
      this.#moreBox.hidden = false;
    } else {
      this.#menu.hide();
      this.#moreBox.hidden = true;
    }
    this.#nav.style.setProperty('--dk-cols', String(shown.length + (more.length ? 1 : 0) + (action ? 1 : 0)));
    this.updated();
    if (focused) {
      const next =
        focused === 'more'
          ? this.#moreBtn
          : Array.from(this.#body.querySelectorAll<HTMLElement>('[data-key]')).find((el) => el.dataset.key === focused);
      next?.focus({ preventScroll: true });
    }
  }

  #focusedKey(): string | undefined {
    try {
      const a = this.root.activeElement as HTMLElement | null;
      return a && this.#nav.contains(a) ? a.dataset?.key : undefined;
    } catch {
      return undefined;
    }
  }

  #action(a: unknown): DockAction | null {
    if (!a || typeof a !== 'object') return null;
    const d = a as DockAction;
    const id = str(d.id).trim();
    const label = str(d.label).trim();
    return id && label ? { id, label, icon: d.icon } : null;
  }

  #menuItems(more: DockItem[]): MenuItem[] {
    return more.map((i) => ({
      kind: 'radio' as const,
      value: MORE_VALUE + i.id,
      label: i.label,
      icon: iconName(str(i.icon)),
      checked: !!i.current,
      description: [dockBadge(i.badge), str(i.title).trim()].filter(Boolean).join(' · ') || undefined,
    }));
  }

  protected render(): string {
    const d = this.data;
    const layout = this.layout;
    const s = STRINGS[this.#lang];
    const items = dockItems(d?.items);
    const action = this.#action(d?.action);
    if (layout === 'rail') {
      const main = items.filter((i) => !i.end);
      const end = items.filter((i) => i.end);
      return `${action ? this.#actionHtml(action, 'rail') : ''}<ul class="dk-list" role="list">${main
        .map((i) => this.#itemHtml(i, 'rail', s))
        .join('')}</ul>${
        end.length
          ? `<span class="dk-sep" aria-hidden="true"></span><ul class="dk-list" role="list">${end
              .map((i) => this.#itemHtml(i, 'rail', s))
              .join('')}</ul>`
          : ''
      }`;
    }
    const { shown, more } = dockSplit(items, dockMax(d?.max));
    // The action sits in the middle: half the tabs (rounded up) before it, the rest — and More — after.
    const cells = shown.map((i) => `<li class="dk-cell">${this.#itemHtml(i, 'bar', s)}</li>`);
    // The middle counts More (drawn after these cells, outside the patch) as a tab.
    const tabs = cells.length + (more.length ? 1 : 0);
    if (action)
      cells.splice(Math.ceil(tabs / 2), 0, `<li class="dk-cell dk-cell-act">${this.#actionHtml(action, 'bar')}</li>`);
    return `<ul class="dk-tabs" role="list">${cells.join('')}</ul>`;
  }

  #itemHtml(i: DockItem, layout: 'bar' | 'rail', s: (typeof STRINGS)['en']): string {
    const href = dockTarget(i.href);
    const badge = dockBadge(i.badge);
    const glyph = icon(i.icon ?? 'dot', { size: layout === 'bar' ? 20 : 18 }) || icon('dot', { size: 20 });
    const name = badge ? `${i.label}, ${s.badge(badge)}` : i.label;
    const inner = `<span class="dk-cap" aria-hidden="true">${glyph}${
      badge ? `<span class="dk-badge">${esc(badge)}</span>` : ''
    }</span>${
      layout === 'bar'
        ? `<span class="dk-word" aria-hidden="true">${esc(i.label)}</span>`
        : `<span class="dk-tip" aria-hidden="true">${esc(i.label)}</span>`
    }`;
    const a = attrs({
      class: cls('dk-item', i.current && 'is-current'),
      'data-act': 'nav',
      'data-id': i.id,
      'data-key': `item:${i.id}`,
      'aria-label': name,
      'aria-current': i.current ? 'page' : undefined,
      title: str(i.title).trim() || undefined,
    });
    const li = layout === 'rail' ? (x: string) => `<li>${x}</li>` : (x: string) => x;
    return li(href ? `<a href="${escAttr(href)}"${a}>${inner}</a>` : `<button type="button"${a}>${inner}</button>`);
  }

  #actionHtml(a: DockAction, layout: 'bar' | 'rail'): string {
    return `<button type="button"${attrs({
      class: 'dk-act',
      'data-act': 'action',
      'data-key': 'action',
      'aria-label': a.label,
      title: a.label,
    })}><span class="dk-act-face" aria-hidden="true">${icon(a.icon ?? 'plus', { size: layout === 'bar' ? 22 : 18 }) || icon('plus', { size: 22 })}</span>${
      layout === 'rail' ? `<span class="dk-tip" aria-hidden="true">${esc(a.label)}</span>` : ''
    }</button>`;
  }

  #onClick(e: MouseEvent): void {
    const el = (e.target as Element | null)?.closest?.<HTMLElement>('[data-act]');
    if (!el || !this.#nav.contains(el)) return;
    if (el.dataset.act === 'action') {
      const a = this.#action(this.data?.action);
      if (!a) return;
      if (this.emit<DockActionEvent>('ui-action', { id: a.id })) this.sound('open', undefined, e);
      return;
    }
    const item = dockItems(this.data?.items).find((i) => i.id === el.dataset.id);
    if (!item) return;
    const href = dockTarget(item.href);
    // A modified click on a real link (new tab, window) is the browser's — no event.
    if (href && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return;
    const sent = this.emit<DockNavigate>('ui-navigate', { id: item.id, href });
    this.sound('navigate', undefined, e);
    if (!sent || !href) e.preventDefault();
  }

  /** A row behind More was chosen: the menu mirrors the data, so it never checks a row itself. */
  #onMenuSelect(e: CustomEvent<MenuSelect>): void {
    e.stopPropagation();
    e.preventDefault();
    this.#menu.hide();
    const value = str(e.detail?.value);
    const item = this.#moreItems.find((i) => MORE_VALUE + i.id === value);
    if (!item) return;
    const href = dockTarget(item.href);
    this.sound('navigate');
    if (this.emit<DockNavigate>('ui-navigate', { id: item.id, href }) && href) globalThis.location?.assign(href);
  }
}

define('ui-dock', UiDock);

declare global {
  interface HTMLElementTagNameMap {
    'ui-dock': UiDock;
  }
}
