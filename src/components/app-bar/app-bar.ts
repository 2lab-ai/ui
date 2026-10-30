import { define, UiElement } from '../../core/element';
import { fmtInt } from '../../core/format';
import { attrs, cls, esc, escAttr, safeLink } from '../../core/html';
import { morphInto } from '../../core/morph';
import { type IconName, icon } from '../../icons/icons';
import '../menu/menu';
import type { MenuItem, MenuSelect, UiMenu } from '../menu/menu';
import { styles } from './styles';

/** One page link in the bar (and, folded, one radio row of its menu). */
export interface AppBarLink {
  /** Stable id; `ui-navigate` carries it back. */
  id: string;
  label: string;
  /** Where the link goes: http(s), mailto or a same-site relative URL. Anything else draws `#`. */
  href?: string;
  /** A glyph from `@2lab.ai/ui/icons` drawn before the label (14px). */
  icon?: IconName;
  /** The page you are on (`aria-current="page"`). The first current link wins. */
  current?: boolean;
  /** A small count after the label (tabular). */
  badge?: number | string;
}

export type AppBarTone = 'run' | 'wait' | 'done' | 'fail' | 'idle';

/** Is it live: a tone dot plus a short word. */
export interface AppBarStatus {
  tone: AppBarTone;
  label: string;
  /** Pulse the dot (a live connection, a running sync). */
  live?: boolean;
}

/** Who is signed in. */
export interface AppBarAccount {
  name: string;
  /** The account page. Without it the pill is a button (`ui-account` only). */
  href?: string;
  /** A small neutral tag after the name ("Admin"). */
  role?: string;
  /** Avatar letters. Default: derived from the name (`appBarInitials`). */
  initials?: string;
}

export interface AppBarBrand {
  label: string;
  href?: string;
  /** Draw the brand mark glyph before the label. Default true. */
  mark?: boolean;
}

export type AppBarTheme = 'light' | 'dark';
export type AppBarCollapse = 'auto' | 'always' | 'never';

export interface AppBarData {
  brand?: AppBarBrand;
  nav?: AppBarLink[];
  /** Accessible name of the navigation. Default "Main" / "주 메뉴". */
  navLabel?: string;
  status?: AppBarStatus;
  account?: AppBarAccount;
  /** The page's current theme. When set, the theme toggle shows (a sun while dark, a moon while light). */
  theme?: AppBarTheme;
  /** The bar's own width (px) below which the nav folds into a menu. Default 720. */
  collapseAt?: number;
}

/** `ui-navigate` detail. `href` is the link's target when it is safe to follow, else ''. */
export interface AppBarNavigate {
  id: string;
  href: string;
}

/** `ui-theme-change` detail: the theme the person asked for. */
export interface AppBarThemeChange {
  theme: AppBarTheme;
}

const STRINGS = {
  en: {
    nav: 'Main',
    menu: 'Menu',
    account: 'Account',
    toLight: 'Switch to light theme',
    toDark: 'Switch to dark theme',
  },
  ko: {
    nav: '주 메뉴',
    menu: '메뉴',
    account: '계정',
    toLight: '라이트 테마로 전환',
    toDark: '다크 테마로 전환',
  },
};
type Strings = (typeof STRINGS)['en'];

/** Default `collapseAt`: below this width (px) the nav folds into a menu. */
export const APP_BAR_COLLAPSE_AT = 720;
/** Below this width (px) the status keeps only its dot and the account pill only its avatar (`narrow`). */
export const APP_BAR_NARROW_AT = 560;
/** The id `ui-navigate` carries for the brand link. */
export const APP_BAR_BRAND_ID = 'brand';

const TONES: ReadonlySet<string> = new Set(['run', 'wait', 'done', 'fail', 'idle']);
const NAV_VALUE = 'nav:';
const ACCOUNT_VALUE = 'account';
/** Room (px) added to a measured overflow, so the bar does not unfold right at the edge it overflowed at. */
const FIT_SLACK = 8;
const LETTER = /[\p{L}\p{N}]/u;
const CJK = /\p{Script=Hangul}|\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * Avatar letters for a name: first + last word ("Mina Park" → "MP"), one word → its first letter, an email →
 * its local part ("mina.park@acme.io" → "MP"), Korean / Chinese / Japanese → the first syllable ("김민아" → "김").
 * Empty for an empty or letterless name.
 */
export function appBarInitials(name: unknown): string {
  let s = str(name).trim();
  const at = s.indexOf('@');
  if (at > 0) s = s.slice(0, at);
  const firsts = s
    .split(/[\s._+-]+/)
    .map((w) => Array.from(w).find((c) => LETTER.test(c)) ?? '')
    .filter(Boolean);
  if (!firsts.length) return '';
  const a = firsts[0];
  if (CJK.test(a)) return a;
  const b = firsts.length > 1 ? firsts[firsts.length - 1] : '';
  return (a + (b && !CJK.test(b) ? b : '')).toUpperCase();
}

/** The `collapse` attribute: `always` · `never` · anything else is `auto`. */
export function appBarCollapseMode(value: unknown): AppBarCollapse {
  return value === 'always' || value === 'never' ? value : 'auto';
}

/**
 * Whether the nav folds into the menu. `always` / `never` decide alone; `auto` folds when the measured width is
 * below `collapseAt` (default 720) or below `needed` — the width at which the bar's content last overflowed.
 * An unmeasured width (0) never folds.
 */
export function appBarCollapsed(
  width: number,
  collapseAt?: number,
  mode: AppBarCollapse = 'auto',
  needed = 0,
): boolean {
  if (mode === 'always') return true;
  if (mode === 'never') return false;
  const w = Number(width);
  if (!(w > 0)) return false;
  const at =
    typeof collapseAt === 'number' && Number.isFinite(collapseAt) && collapseAt >= 0 ? collapseAt : APP_BAR_COLLAPSE_AT;
  return w < Math.max(at, Number(needed) || 0);
}

/** Where a link may go: its trimmed href when `safeLink` accepts it, else '' (javascript:, data:, //host, `#`, empty). */
export function appBarTarget(href: unknown): string {
  const s = str(href).trim();
  return s && safeLink(s) !== '#' ? s : '';
}

/** Links worth drawing: objects with a string id and label; a repeated id keeps the first; one current at most. */
export function appBarLinks(nav: unknown): AppBarLink[] {
  if (!Array.isArray(nav)) return [];
  const seen = new Set<string>();
  let current = false;
  const out: AppBarLink[] = [];
  for (const raw of nav) {
    if (!raw || typeof raw !== 'object') continue;
    const l = raw as AppBarLink;
    if (!str(l.id) || !str(l.label) || seen.has(l.id)) continue;
    seen.add(l.id);
    const on: boolean = !!l.current && !current;
    current ||= on;
    out.push({ ...l, current: on });
  }
  return out;
}

interface Account {
  name: string;
  role: string;
  initials: string;
  /** Set (possibly unsafe — draw it through `safeLink`) when the account has a page. */
  href?: string;
}

/** The account's fields as trimmed strings ('' name = no account); initials capped at two letters. */
function accountOf(a: unknown): Account {
  const acc = (a && typeof a === 'object' ? a : {}) as AppBarAccount;
  const name = str(acc.name).trim();
  const initials = Array.from(str(acc.initials).trim()).slice(0, 2).join('') || appBarInitials(name);
  return { name, role: str(acc.role).trim(), initials, href: str(acc.href).trim() ? acc.href : undefined };
}

function badgeText(b: unknown): string {
  if (typeof b === 'number') return Number.isFinite(b) ? fmtInt(b) : '';
  return str(b);
}

function themeOf(v: unknown): AppBarTheme | undefined {
  return v === 'light' || v === 'dark' ? v : undefined;
}

/**
 * The folded menu's rows: every link as a radio (checked = current, its badge on the right), then — when an
 * account is set — a separator and the account. No links, no menu.
 */
export function appBarMenuItems(nav: unknown, account?: AppBarAccount | null): MenuItem[] {
  const links = appBarLinks(nav);
  if (!links.length) return [];
  const items: MenuItem[] = links.map((l) => ({
    kind: 'radio',
    value: NAV_VALUE + l.id,
    label: l.label,
    icon: l.icon,
    checked: !!l.current,
    shortcut: badgeText(l.badge) || undefined,
  }));
  const acc = accountOf(account);
  if (acc.name) {
    items.push({ kind: 'separator' });
    items.push({ value: ACCOUNT_VALUE, label: acc.name, description: acc.role || undefined, icon: 'user' });
  }
  return items;
}

/**
 * `<ui-app-bar>` — the page's top bar: brand, page links, a live status, the signed-in account and a theme
 * toggle, sticky and translucent over the page. Below its `collapseAt` width the links fold into a menu; links
 * send a cancelable `ui-navigate`, the account pill `ui-account`, the toggle `ui-theme-change`.
 */
export class UiAppBar extends UiElement<AppBarData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang', 'collapse'];
  }

  #ro: ResizeObserver | null = null;
  /** The host's measured width (0 = not measured). */
  #width = 0;
  /** The width the content needed when it last overflowed (0 = fits / not measured). */
  #needed = 0;
  /** Folded and narrow: the width the brand's name needed when it last ellipsized (0 = fits / not measured). */
  #brandNeed = 0;
  /** What the content's width depends on; a change measures again. */
  #sig = '';
  /** The theme was toggled here: the next glyph enters. */
  #swapped = false;
  readonly #bar: HTMLElement;
  readonly #parts: HTMLElement;
  readonly #fold: HTMLElement;
  readonly #menu: UiMenu;
  readonly #trigger: HTMLButtonElement;

  constructor() {
    super();
    // Built once: the rendered parts are patched in place (morph), and the folded menu with its trigger is a live
    // primitive no re-render touches (its open state and the trigger's aria-expanded belong to it).
    this.#bar = document.createElement('div');
    this.#bar.className = 'ab-bar';
    this.#bar.setAttribute('part', 'bar');
    this.#parts = document.createElement('div');
    this.#parts.className = 'ab-parts';
    this.#fold = document.createElement('nav');
    this.#fold.className = 'ab-fold';
    this.#fold.hidden = true;
    this.#menu = document.createElement('ui-menu') as UiMenu;
    this.#menu.className = 'ab-menu';
    this.#menu.setAttribute('placement', 'bottom-end');
    this.#trigger = document.createElement('button');
    this.#trigger.type = 'button';
    this.#trigger.slot = 'trigger';
    this.#trigger.className = 'ab-icon-btn ab-menu-btn';
    this.#trigger.dataset.key = 'menu';
    this.#trigger.innerHTML = icon('menu');
    this.#menu.append(this.#trigger);
    this.#fold.append(this.#menu);
    this.#bar.append(this.#parts, this.#fold);
    this.content.append(this.#bar);

    this.root.addEventListener('click', (e) => this.#onClick(e as MouseEvent));
    // The menu's own events never leave the bar: its choice becomes ui-navigate / ui-account.
    this.root.addEventListener('ui-select', (e) => this.#onMenuSelect(e as CustomEvent<MenuSelect>));
    this.root.addEventListener('ui-open-change', (e) => e.stopPropagation());
    // Slotted actions changed: the content's width did too.
    this.root.addEventListener('slotchange', () => this.#refit());
  }

  attributeChangedCallback(name: string): void {
    if (name === 'collapse' && this.isConnected) this.#refit();
    this.requestRender();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof ResizeObserver === 'function' && !this.#ro) {
      this.#ro = new ResizeObserver((entries) => {
        const w = entries[entries.length - 1]?.contentRect?.width;
        this.#width = typeof w === 'number' && Number.isFinite(w) ? w : this.getBoundingClientRect().width;
        this.#sync();
        this.#fit();
        this.#fitBrand();
      });
      this.#ro.observe(this);
    }
    this.#sync();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#ro?.disconnect();
    this.#ro = null;
  }

  get #t(): Strings {
    return this.getAttribute('lang') === 'ko' ? STRINGS.ko : STRINGS.en;
  }

  #navLabel(): string {
    const l = str(this.data?.navLabel).trim();
    return l || this.#t.nav;
  }

  // ── fold ──────────────────────────────────────────────────────────────────

  /** Reflect `collapsed` / `narrow` from the measured width; unfolding closes the menu. */
  #sync(): void {
    const mode = appBarCollapseMode(this.getAttribute('collapse'));
    const on = appBarCollapsed(this.#width, this.data?.collapseAt, mode, this.#needed);
    this.toggleAttribute('narrow', this.#width > 0 && this.#width < APP_BAR_NARROW_AT);
    if (this.hasAttribute('collapsed') === on) return;
    this.toggleAttribute('collapsed', on);
    if (!on && this.#menu.open) this.#menu.hide();
  }

  /** Unfolded but overflowing (long names, many actions): remember the width it needs and fold. */
  #fit(): void {
    if (this.#width <= 0 || this.hasAttribute('collapsed')) return;
    if (appBarCollapseMode(this.getAttribute('collapse')) !== 'auto') return;
    const over = this.#bar.scrollWidth - this.#bar.clientWidth;
    if (over > 1) {
      this.#needed = Math.ceil(this.#width + over + FIT_SLACK);
      this.#sync();
    }
  }

  /**
   * Folded, narrow, and the brand's name still ellipsizes: show the mark alone (`mark-only`; the name stays the
   * link's accessible name) until the bar has the room it measured. Never unfolded, never without a mark.
   */
  #fitBrand(): void {
    const label = this.#parts.querySelector<HTMLElement>('.ab-brand-label');
    const can =
      this.#width > 0 &&
      this.hasAttribute('collapsed') &&
      this.hasAttribute('narrow') &&
      !!label &&
      !!this.#parts.querySelector('.ab-mark');
    if (!can || !label) {
      this.#brandNeed = 0;
      this.removeAttribute('mark-only');
      return;
    }
    if (this.hasAttribute('mark-only')) {
      if (this.#width < this.#brandNeed) return;
      this.removeAttribute('mark-only');
    }
    const over = label.scrollWidth - label.clientWidth;
    if (over > 1) {
      this.#brandNeed = Math.ceil(this.#width + over + FIT_SLACK);
      this.setAttribute('mark-only', '');
    }
  }

  /** The content changed: forget the overflow widths and measure again. */
  #refit(): void {
    this.#needed = 0;
    this.#brandNeed = 0;
    this.removeAttribute('mark-only');
    this.#sync();
    this.#fit();
    this.#fitBrand();
  }

  /** Everything the unfolded content's width depends on. */
  #signature(): string {
    const d = this.data;
    const parts: string[] = [str(d?.brand?.label), String(d?.brand?.mark !== false), str(d?.status?.label)];
    for (const l of appBarLinks(d?.nav)) parts.push(l.label, str(l.icon), badgeText(l.badge));
    const acc = accountOf(d?.account);
    parts.push(acc.name, acc.role, String(!!themeOf(d?.theme)), this.getAttribute('lang') ?? '');
    return parts.join('\u0000');
  }

  // ── input ─────────────────────────────────────────────────────────────────

  #onClick(e: MouseEvent): void {
    const el = (e.target as Element | null)?.closest?.<HTMLElement>('[data-act]');
    // Slotted host content is light DOM: never ours, even when it carries a data-act of its own.
    if (!el || !this.#parts.contains(el)) return;
    const d = this.data;
    const act = el.dataset.act;
    if (act === 'theme') {
      this.#toggleTheme();
    } else if (act === 'account') {
      this.#follow(e, appBarTarget(d?.account?.href), () => this.emit('ui-account', {}));
    } else if (act === 'brand') {
      const href = appBarTarget(d?.brand?.href);
      this.#follow(e, href, () => this.emit<AppBarNavigate>('ui-navigate', { id: APP_BAR_BRAND_ID, href }));
    } else if (act === 'nav') {
      const link = appBarLinks(d?.nav).find((l) => l.id === el.dataset.id);
      if (!link) return;
      const href = appBarTarget(link.href);
      this.#follow(e, href, () => this.emit<AppBarNavigate>('ui-navigate', { id: link.id, href }));
    }
  }

  /**
   * A link press: a modified click on a real link (new tab, window, download) is the browser's — no event.
   * Otherwise the event goes out; cancelled, or with nowhere safe to go, the link does not navigate.
   */
  #follow(e: MouseEvent, href: string, send: () => boolean): void {
    if (href && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return;
    if (!send() || !href) e.preventDefault();
  }

  #toggleTheme(): void {
    const cur = themeOf(this.data?.theme);
    if (!cur) return;
    const next: AppBarTheme = cur === 'dark' ? 'light' : 'dark';
    if (!this.emit<AppBarThemeChange>('ui-theme-change', { theme: next })) return;
    // Optimistic on the latest data: a listener that already set the theme wins.
    const now = this.data;
    if (now && themeOf(now.theme) === cur) {
      this.#swapped = true;
      this.data = { ...now, theme: next };
    }
  }

  /** A row of the folded menu was chosen. The menu mirrors this bar's data, so it never checks a row itself. */
  #onMenuSelect(e: CustomEvent<MenuSelect>): void {
    e.stopPropagation();
    e.preventDefault();
    this.#menu.hide();
    const d = this.data;
    const value = str(e.detail?.value);
    if (value === ACCOUNT_VALUE) {
      const acc = accountOf(d?.account);
      if (acc.name && this.emit('ui-account', {})) this.#assign(appBarTarget(acc.href));
      return;
    }
    const link = appBarLinks(d?.nav).find((l) => NAV_VALUE + l.id === value);
    if (!link) return;
    const href = appBarTarget(link.href);
    if (this.emit<AppBarNavigate>('ui-navigate', { id: link.id, href })) this.#assign(href);
  }

  /** Follow a menu row's link (a real `<a>` follows itself). Only targets that passed `appBarTarget`. */
  #assign(href: string): void {
    if (href) globalThis.location?.assign(href);
  }

  // ── render ────────────────────────────────────────────────────────────────

  #active(): HTMLElement | null {
    try {
      return this.root.activeElement as HTMLElement | null;
    } catch {
      return null;
    }
  }

  /** Patch the parts in place (focus, the status live region and the menu survive); refit when the content changed. */
  protected override update(): void {
    const sig = this.#signature();
    if (sig !== this.#sig) {
      this.#sig = sig;
      this.#needed = 0;
      this.#brandNeed = 0;
      this.removeAttribute('mark-only');
    }
    const key = this.#active()?.dataset?.key;
    morphInto(this.#parts, this.render());
    this.updated();
    if (key && !this.#active()) {
      this.$$<HTMLElement>('[data-key]')
        .find((x) => x.dataset.key === key)
        ?.focus({ preventScroll: true });
    }
  }

  protected override updated(): void {
    const d = this.data;
    const label = this.#navLabel();
    const items = appBarMenuItems(d?.nav, d?.account);
    this.#fold.hidden = !items.length;
    this.#fold.setAttribute('aria-label', label);
    this.#trigger.setAttribute('aria-label', this.#t.menu);
    const lang = this.getAttribute('lang');
    if (lang) this.#menu.setAttribute('lang', lang);
    else this.#menu.removeAttribute('lang');
    this.#menu.data = { label, items };
    if (!items.length && this.#menu.open) this.#menu.hide();
    this.#sync();
    this.#fit();
    this.#fitBrand();
  }

  protected render(): string {
    const d = this.data ?? {};
    const t = this.#t;
    return [
      this.#brand(d.brand),
      this.#nav(d.nav),
      '<span class="ab-grow" aria-hidden="true"></span>',
      '<slot name="actions" data-mk="slot:actions"></slot>',
      this.#status(d.status),
      this.#account(d.account, t),
      this.#theme(d.theme, t),
    ].join('');
  }

  #brand(b: AppBarBrand | undefined): string {
    const label = str(b?.label).trim();
    if (!b || !label) return '<slot name="brand" data-mk="slot:brand"></slot>';
    const mark =
      b.mark === false ? '' : `<span class="ab-mark" aria-hidden="true">${icon('brand', { size: 20 })}</span>`;
    const inner = `${mark}<span class="ab-brand-label">${esc(label)}</span>`;
    const brand = str(b.href).trim()
      ? `<a class="ab-brand" href="${safeLink(b.href)}" data-act="brand" data-key="brand">${inner}</a>`
      : `<span class="ab-brand">${inner}</span>`;
    return `<slot name="brand" data-mk="slot:brand">${brand}</slot>`;
  }

  #nav(nav: AppBarLink[] | undefined): string {
    const links = appBarLinks(nav);
    if (!links.length) return '';
    const rows = links
      .map((l) => {
        const badge = badgeText(l.badge);
        return `<li class="ab-li" data-mk="${escAttr(l.id)}"><a class="ab-link" href="${safeLink(l.href)}"${attrs({
          'aria-current': l.current ? 'page' : undefined,
          'data-act': 'nav',
          'data-id': l.id,
          'data-key': `nav:${l.id}`,
        })}>${l.icon ? icon(l.icon, { size: 14 }) : ''}<span class="ab-label">${esc(l.label)}</span>${
          badge ? `<span class="ab-badge">${esc(badge)}</span>` : ''
        }</a></li>`;
      })
      .join('');
    return `<nav class="ab-nav" aria-label="${escAttr(this.#navLabel())}"><ul class="ab-links" role="list">${rows}</ul></nav>`;
  }

  #status(s: AppBarStatus | undefined): string {
    const label = str(s?.label).trim();
    if (!s || !label) return '';
    const tone = TONES.has(s.tone) ? s.tone : 'idle';
    return `<span${attrs({
      class: 'ab-status',
      role: 'status',
      'aria-live': 'polite',
      'data-tone': tone,
      'data-live': !!s.live,
    })}><span class="ab-dot" aria-hidden="true"></span><span class="ab-status-label">${esc(label)}</span></span>`;
  }

  #account(a: AppBarAccount | undefined, t: Strings): string {
    const acc = accountOf(a);
    if (!acc.name) return '';
    const avatar = `<span class="ab-avatar" aria-hidden="true">${
      acc.initials ? esc(acc.initials) : icon('user', { size: 14 })
    }</span>`;
    const role = acc.role ? `<span class="ab-role">${esc(acc.role)}</span>` : '';
    const inner = `${avatar}<span class="ab-name">${esc(acc.name)}</span>${role}`;
    const common = attrs({
      class: 'ab-account',
      'aria-label': `${t.account}: ${acc.name}${acc.role ? `, ${acc.role}` : ''}`,
      'data-act': 'account',
      'data-key': 'account',
    });
    return acc.href !== undefined
      ? `<a href="${safeLink(acc.href)}"${common}>${inner}</a>`
      : `<button type="button"${common}>${inner}</button>`;
  }

  #theme(theme: AppBarTheme | undefined, t: Strings): string {
    const cur = themeOf(theme);
    if (!cur) return '';
    const glyph = cur === 'dark' ? 'sun' : 'moon';
    return `<button type="button" class="ab-icon-btn ab-theme" aria-label="${escAttr(
      cur === 'dark' ? t.toLight : t.toDark,
    )}" data-act="theme" data-key="theme"><span class="${cls('ab-glyph', this.#swapped && 'is-in')}" data-mk="${glyph}">${icon(glyph)}</span></button>`;
  }
}

define('ui-app-bar', UiAppBar);

declare global {
  interface HTMLElementTagNameMap {
    'ui-app-bar': UiAppBar;
  }
}
