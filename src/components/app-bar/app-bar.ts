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
  /** What the page is for ("Every past conversation"): the link's `title`, and the folded menu row's second line. */
  title?: string;
}

export type AppBarTone = 'run' | 'wait' | 'done' | 'fail' | 'idle';

/** Is it live: a tone dot plus a short word. */
export interface AppBarStatus {
  tone: AppBarTone;
  label: string;
  /** Pulse the dot (a live connection, a running sync). */
  live?: boolean;
  /**
   * What the status is about ("Live updates"): read before the word (visually hidden, so the region says
   * "Live updates: Connected") and shown with it as the status's hover title.
   */
  description?: string;
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
  /** A glyph before the label: an icon name, or `true` for the library's own mark. Default none. */
  mark?: boolean | IconName;
  /** The brand is the page's heading: drawn inside an `<h1>` (the link, when there is one, stays inside it). */
  heading?: boolean;
}

export type AppBarTheme = 'light' | 'dark';
/** The palette beside the theme (0.25.0): the colour themes, or their restrained mono pair (status colour on marks only). */
export type AppBarPalette = 'color' | 'mono';
/**
 * A design the page can switch to (0.39.0) — a whole look applied with `data-design="<id>"` (see `DESIGNS` in
 * `@2lab.ai/ui/server`). `scheme` is the one light / dark it is drawn for.
 */
export interface AppBarDesign {
  id: string;
  label: string;
  scheme: AppBarTheme;
}
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
  /**
   * The page's current palette (0.25.0). When set beside `theme`, the toggle cycles four themes — light → dark →
   * light·mono → dark·mono → light — and `ui-theme-change` carries the palette too. Unset: light ⇄ dark, as before.
   */
  palette?: AppBarPalette;
  /**
   * The designs the page offers (0.39.0). When set beside `theme`, the theme button opens one menu with every theme
   * (light, dark and — with a palette — light·mono, dark·mono) and these designs, the current one checked; choosing
   * sends `ui-theme-change` with `design` (the id, or null for a plain theme). Unset: the toggle, as before.
   */
  designs?: AppBarDesign[];
  /** The page's current design id (0.39.0), or null / unset for none. Read only while `designs` lists it. */
  design?: string | null;
  /**
   * The page's interface-sound choice (`@2lab.ai/ui/sound`). When set, a speaker toggle shows before the theme toggle
   * (pressed while on) and sends `ui-sound-change`; the host keeps the choice and calls `setSound`.
   */
  sound?: boolean;
  /** The bar's own width (px) below which the nav folds into a menu. Default 720. */
  collapseAt?: number;
  /**
   * The bar's own width (px) below which the `toolbar` slot takes the row under the bar. Default 0: it moves
   * only when the bar would overflow with it inline.
   */
  toolbarAt?: number;
}

/** `ui-navigate` detail. `href` is the link's target when it is safe to follow, else ''. */
export interface AppBarNavigate {
  id: string;
  href: string;
}

/** `ui-theme-change` detail: the theme the person asked for (and its palette, when the bar was given one). */
export interface AppBarThemeChange {
  theme: AppBarTheme;
  palette?: AppBarPalette;
  /** With `designs` (0.39.0): the design chosen — its id, its scheme in `theme` — or null for a plain theme. */
  design?: string | null;
}

/** One step of the theme cycle: light → dark → light·mono → dark·mono → light, or light ⇄ dark without a palette. */
export function nextAppBarTheme(
  theme: AppBarTheme,
  palette?: AppBarPalette,
): { theme: AppBarTheme; palette?: AppBarPalette } {
  const next: AppBarTheme = theme === 'dark' ? 'light' : 'dark';
  if (!palette) return { theme: next };
  // The palette turns over on the way back to light: dark → light·mono, dark·mono → light.
  return { theme: next, palette: theme === 'dark' ? (palette === 'mono' ? 'color' : 'mono') : palette };
}

/** `ui-sound-change` detail: whether the person turned interface sound on. */
export interface AppBarSoundChange {
  sound: boolean;
}

const STRINGS = {
  en: {
    nav: 'Main',
    menu: 'Menu',
    account: 'Account',
    toLight: 'Switch to light theme',
    toDark: 'Switch to dark theme',
    toLightMono: 'Switch to light mono theme',
    toDarkMono: 'Switch to dark mono theme',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    lightMono: 'Light mono',
    darkMono: 'Dark mono',
    designs: 'Designs',
    soundOn: 'Turn sound on',
    soundOff: 'Turn sound off',
  },
  ko: {
    nav: '주 메뉴',
    menu: '메뉴',
    account: '계정',
    toLight: '라이트 테마로 전환',
    toDark: '다크 테마로 전환',
    toLightMono: '라이트 모노 테마로 전환',
    toDarkMono: '다크 모노 테마로 전환',
    theme: '테마',
    light: '라이트',
    dark: '다크',
    lightMono: '라이트 모노',
    darkMono: '다크 모노',
    designs: '디자인',
    soundOn: '소리 켜기',
    soundOff: '소리 끄기',
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

/**
 * Whether the `toolbar` slot takes the row under the bar: never without toolbar content or an unmeasured width;
 * otherwise below `toolbarAt` (default 0) or below `needed` — the width at which the bar last overflowed with the
 * toolbar inline.
 */
export function appBarToolbarRow(width: number, toolbarAt?: number, needed = 0, hasToolbar = true): boolean {
  const w = Number(width);
  if (!hasToolbar || !(w > 0)) return false;
  const at = typeof toolbarAt === 'number' && Number.isFinite(toolbarAt) && toolbarAt > 0 ? toolbarAt : 0;
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

function paletteOf(v: unknown): AppBarPalette | undefined {
  return v === 'color' || v === 'mono' ? v : undefined;
}

const DESIGN_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const THEME_VALUE = 'theme:';
const DESIGN_VALUE = 'design:';

/** The well-formed designs (a kebab-case id, a label, a light / dark scheme), each id once, in order. */
export function appBarDesigns(v: unknown): AppBarDesign[] {
  if (!Array.isArray(v)) return [];
  const out: AppBarDesign[] = [];
  for (const x of v) {
    if (!x || typeof x !== 'object') continue;
    const d = x as AppBarDesign;
    const id = str(d.id);
    const label = str(d.label).trim();
    const scheme = themeOf(d.scheme);
    if (!DESIGN_ID.test(id) || !label || !scheme || out.some((o) => o.id === id)) continue;
    out.push({ id, label, scheme });
  }
  return out;
}

/** What the theme menu reads: the bar's theme, palette, design and designs. */
type ThemeState = Pick<AppBarData, 'theme' | 'palette' | 'design' | 'designs'>;

/** The current design, when the page has one the list offers. */
function currentDesign(d: ThemeState | undefined): AppBarDesign | undefined {
  const id = str(d?.design);
  return id ? appBarDesigns(d?.designs).find((x) => x.id === id) : undefined;
}

/** The plain themes a bar offers: light and dark, and their mono pair when it was given a palette. */
function themeRows(palette: AppBarPalette | undefined): Array<{ theme: AppBarTheme; palette?: AppBarPalette }> {
  const rows: Array<{ theme: AppBarTheme; palette?: AppBarPalette }> = [{ theme: 'light' }, { theme: 'dark' }];
  if (palette) rows.push({ theme: 'light', palette: 'mono' }, { theme: 'dark', palette: 'mono' });
  return rows;
}

function themeName(theme: AppBarTheme, palette: AppBarPalette | undefined, t: Strings): string {
  if (palette === 'mono') return theme === 'dark' ? t.darkMono : t.lightMono;
  return theme === 'dark' ? t.dark : t.light;
}

/**
 * The theme menu's rows (0.39.0): one radio group — light, dark (and light·mono, dark·mono with a palette), then the
 * designs under a heading. The current one is checked: the design when one is on, else the theme and palette.
 */
export function appBarThemeItems(d: ThemeState, lang: 'en' | 'ko' = 'en'): MenuItem[] {
  const t = lang === 'ko' ? STRINGS.ko : STRINGS.en;
  const theme = themeOf(d.theme);
  const palette = paletteOf(d.palette);
  const on = currentDesign(d);
  const items: MenuItem[] = themeRows(palette).map((r) => ({
    kind: 'radio',
    group: 'theme',
    value: `${THEME_VALUE}${r.theme}${r.palette === 'mono' ? ':mono' : ''}`,
    label: themeName(r.theme, r.palette, t),
    checked: !on && r.theme === theme && (r.palette === 'mono') === (palette === 'mono'),
  }));
  const designs = appBarDesigns(d.designs);
  if (designs.length) items.push({ kind: 'heading', label: t.designs });
  for (const x of designs)
    items.push({ kind: 'radio', group: 'theme', value: DESIGN_VALUE + x.id, label: x.label, checked: on?.id === x.id });
  return items;
}

/**
 * The `ui-theme-change` a theme-menu row asks for (0.39.0): a theme row clears the design; a design row brings its
 * scheme as the theme. The palette rides along only when the bar was given one (a design resets it to colour).
 * null for a row the bar does not offer.
 */
export function appBarThemeChoice(value: string, d: ThemeState): AppBarThemeChange | null {
  const palette = paletteOf(d.palette);
  const v = str(value);
  if (v.startsWith(DESIGN_VALUE)) {
    const x = appBarDesigns(d.designs).find((o) => o.id === v.slice(DESIGN_VALUE.length));
    if (!x) return null;
    return palette ? { theme: x.scheme, palette: 'color', design: x.id } : { theme: x.scheme, design: x.id };
  }
  if (!v.startsWith(THEME_VALUE)) return null;
  const row = themeRows(palette).find((r) => `${THEME_VALUE}${r.theme}${r.palette === 'mono' ? ':mono' : ''}` === v);
  if (!row) return null;
  return palette
    ? { theme: row.theme, palette: row.palette ?? 'color', design: null }
    : { theme: row.theme, design: null };
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
    // A count is not a key hint: it reads as the row's description (before the link's title), never in the
    // shortcut slot.
    description: [badgeText(l.badge), str(l.title).trim()].filter(Boolean).join(' · ') || undefined,
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
 * send a cancelable `ui-navigate`, the account pill `ui-account`, the toggle `ui-theme-change`. Wide host
 * controls go in the `toolbar` slot: inline while they fit, the row under the bar (wrapping) when they do not.
 */
export class UiAppBar extends UiElement<AppBarData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang', 'collapse', 'theme'];
  }

  #ro: ResizeObserver | null = null;
  /** The host's measured width (0 = not measured). */
  #width = 0;
  /** The width the content needed when it last overflowed (0 = fits / not measured). */
  #needed = 0;
  /** Folded and narrow: the width the brand's name needed when it last ellipsized (0 = fits / not measured). */
  #brandNeed = 0;
  /** The width the bar needed with the toolbar inline when it last overflowed (0 = fits / not measured). */
  #toolNeed = 0;
  /** The toolbar slot sits in the row under the bar (`toolbar-row`). */
  #toolRow = false;
  /** The light-DOM children and their slots when last seen: a slotchange that changed none of them is ours. */
  #light: Array<[Element, string]> = [];
  /** What the content's width depends on; a change measures again. */
  #sig = '';
  /** The theme was toggled here: the next glyph enters. */
  #swapped = false;
  readonly #bar: HTMLElement;
  readonly #parts: HTMLElement;
  readonly #fold: HTMLElement;
  readonly #menu: UiMenu;
  readonly #trigger: HTMLButtonElement;
  /** The theme menu (0.39.0, with `designs`): a live primitive like the folded menu, its button the trigger. */
  readonly #themePick: HTMLElement;
  readonly #themeMenu: UiMenu;
  readonly #themeBtn: HTMLButtonElement;
  readonly #row: HTMLElement;

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
    // The theme menu sits where the toggle does — after the parts, before the folded menu — and shows only with designs.
    this.#themePick = document.createElement('span');
    this.#themePick.className = 'ab-theme-pick';
    this.#themePick.hidden = true;
    this.#themeMenu = document.createElement('ui-menu') as UiMenu;
    this.#themeMenu.className = 'ab-theme-menu';
    this.#themeMenu.setAttribute('placement', 'bottom-end');
    this.#themeBtn = document.createElement('button');
    this.#themeBtn.type = 'button';
    this.#themeBtn.slot = 'trigger';
    this.#themeBtn.className = 'ab-icon-btn';
    // The same key as the toggle: focus moves between the two when designs come or go (update() finds it by key).
    this.#themeBtn.dataset.key = 'theme';
    this.#themeMenu.append(this.#themeBtn);
    this.#themePick.append(this.#themeMenu);
    this.#bar.append(this.#parts, this.#themePick, this.#fold);
    // The row under the bar. Its toolbar slot comes after the bar's in tree order, so it holds the toolbar only
    // while the bar draws none (toolbar-row): the host's nodes never move, only which slot shows them.
    this.#row = document.createElement('div');
    this.#row.className = 'ab-row';
    this.#row.setAttribute('part', 'toolbar-row');
    this.#row.innerHTML = '<slot name="toolbar"></slot>';
    this.content.append(this.#bar, this.#row);

    this.root.addEventListener('click', (e) => this.#onClick(e as MouseEvent));
    // The menu's own events never leave the bar: its choice becomes ui-navigate / ui-account.
    // Only the bar's own menus: a host's <ui-menu> slotted into the bar sends its events through this shadow tree too.
    this.root.addEventListener('ui-select', (e) => {
      if (e.target === this.#themeMenu) this.#onThemeSelect(e as CustomEvent<MenuSelect>);
      else if (e.target === this.#menu) this.#onMenuSelect(e as CustomEvent<MenuSelect>);
    });
    this.root.addEventListener('ui-open-change', (e) => {
      if (e.target === this.#menu || e.target === this.#themeMenu) e.stopPropagation();
    });
    // Slotted actions changed: the content's width did too. The toolbar moving between its two slots is not a
    // change of content (no child came, left or changed its slot): measuring again then would only loop.
    this.root.addEventListener('slotchange', () => {
      if (this.#lightChanged()) this.#refit();
    });
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

  /** Did a light-DOM child come, leave or change its slot since the last look? */
  #lightChanged(): boolean {
    const now = Array.from(this.children, (c): [Element, string] => [c, c.getAttribute('slot') ?? '']);
    const prev = this.#light;
    this.#light = now;
    return now.length !== prev.length || now.some(([c, s], i) => prev[i][0] !== c || prev[i][1] !== s);
  }

  #hasToolbar(): boolean {
    for (const c of Array.from(this.children)) if (c.getAttribute('slot') === 'toolbar') return true;
    return false;
  }

  /** Move the toolbar between the bar and the row under it (the bar's slot is drawn or not). */
  #setToolRow(on: boolean): void {
    if (this.#toolRow === on) return;
    this.#toolRow = on;
    this.toggleAttribute('toolbar-row', on);
    morphInto(this.#parts, this.render());
  }

  /** Reflect `collapsed` / `narrow` / `toolbar-row` from the measured width; unfolding closes the menu. */
  #sync(): void {
    this.#setToolRow(appBarToolbarRow(this.#width, this.data?.toolbarAt, this.#toolNeed, this.#hasToolbar()));
    const mode = appBarCollapseMode(this.getAttribute('collapse'));
    const on = appBarCollapsed(this.#width, this.data?.collapseAt, mode, this.#needed);
    this.toggleAttribute('narrow', this.#width > 0 && this.#width < APP_BAR_NARROW_AT);
    if (this.hasAttribute('collapsed') === on) return;
    this.toggleAttribute('collapsed', on);
    if (!on && this.#menu.open) this.#menu.hide();
  }

  /**
   * Overflowing (long names, many actions): first the toolbar takes the row under the bar, then — unfolded and
   * still overflowing — the links fold. Each remembers the width it needed.
   */
  #fit(): void {
    if (this.#width <= 0) return;
    if (!this.#toolRow && this.#hasToolbar()) {
      const over = this.#bar.scrollWidth - this.#bar.clientWidth;
      if (over > 1) {
        this.#toolNeed = Math.ceil(this.#width + over + FIT_SLACK);
        this.#setToolRow(true);
      }
    }
    if (this.hasAttribute('collapsed')) return;
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
    this.#toolNeed = 0;
    this.removeAttribute('mark-only');
    this.#sync();
    this.#fit();
    this.#fitBrand();
  }

  /** Everything the unfolded content's width depends on. */
  #signature(): string {
    const d = this.data;
    const parts: string[] = [
      str(d?.brand?.label),
      String(d?.brand?.mark ?? ''),
      str(d?.status?.label),
      String(d?.toolbarAt ?? ''),
    ];
    for (const l of appBarLinks(d?.nav)) parts.push(l.label, str(l.icon), badgeText(l.badge));
    const acc = accountOf(d?.account);
    parts.push(acc.name, acc.role, String(!!themeOf(d?.theme)), String(typeof d?.sound === 'boolean'));
    parts.push(String(appBarDesigns(d?.designs).length > 0));
    parts.push(this.getAttribute('lang') ?? '');
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
      this.#toggleTheme(e);
    } else if (act === 'sound') {
      this.#toggleSound(e);
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
   * Otherwise the event goes out; cancelled, or with nowhere safe to go, the link does not navigate. It sounds either
   * way: cancelling `ui-navigate` is how a host routes on the client, so the person still went somewhere.
   */
  #follow(e: MouseEvent, href: string, send: () => boolean): void {
    if (href && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return;
    const sent = send();
    this.sound('navigate', undefined, e);
    if (!sent || !href) e.preventDefault();
  }

  /**
   * The speaker: `ui-sound-change` with the new choice, then optimistic. Its toggle cue plays through the page's
   * setting as it stands once listeners ran — heard when the host turned sound on synchronously, silent once off.
   */
  #toggleSound(e: Event): void {
    const cur = this.data?.sound;
    if (typeof cur !== 'boolean') return;
    const next = !cur;
    if (!this.emit<AppBarSoundChange>('ui-sound-change', { sound: next })) return;
    this.sound('toggle', { direction: next ? 'forward' : 'back' }, e);
    const now = this.data;
    if (now && now.sound === cur) this.data = { ...now, sound: next };
  }

  #toggleTheme(e: Event): void {
    const cur = themeOf(this.data?.theme);
    if (!cur) return;
    const pal = paletteOf(this.data?.palette);
    const next = nextAppBarTheme(cur, pal);
    if (!this.emit<AppBarThemeChange>('ui-theme-change', next)) return;
    this.sound('toggle', { direction: next.theme === 'dark' ? 'forward' : 'back' }, e);
    // Optimistic on the latest data: a listener that already set the theme wins.
    const now = this.data;
    if (now && themeOf(now.theme) === cur && paletteOf(now.palette) === pal) {
      this.#swapped = true;
      this.data = { ...now, ...next };
    }
  }

  /** A row of the theme menu was chosen (0.39.0): the menu mirrors this bar's data, so it never checks a row itself. */
  #onThemeSelect(e: CustomEvent<MenuSelect>): void {
    e.stopPropagation();
    e.preventDefault();
    this.#themeMenu.hide();
    const d = this.data;
    const cur = themeOf(d?.theme);
    if (!d || !cur) return;
    const next = appBarThemeChoice(str(e.detail?.value), d);
    if (!next) return;
    const was = currentDesign(d)?.id ?? null;
    // Read before the event: a listener may change the data in place.
    const pal = paletteOf(d.palette);
    if (next.theme === cur && paletteOf(next.palette) === pal && next.design === was) return;
    if (!this.emit<AppBarThemeChange>('ui-theme-change', next)) return;
    // Like a folded-menu row: the cue plays without the menu's event (the row's own click is inside the menu).
    this.sound('toggle', { direction: next.theme === 'dark' ? 'forward' : 'back' });
    // Optimistic on the latest data: a listener that already set the theme wins.
    const now = this.data;
    if (
      now &&
      themeOf(now.theme) === cur &&
      paletteOf(now.palette) === pal &&
      (currentDesign(now)?.id ?? null) === was
    ) {
      this.#swapped = true;
      this.data = { ...now, ...next };
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
      if (!acc.name) return;
      // Sounds whether or not the host takes it over (cancelling is client-side routing): the menu stays quiet.
      this.sound('navigate');
      if (this.emit('ui-account', {})) this.#assign(appBarTarget(acc.href));
      return;
    }
    const link = appBarLinks(d?.nav).find((l) => NAV_VALUE + l.id === value);
    if (!link) return;
    const href = appBarTarget(link.href);
    this.sound('navigate');
    if (this.emit<AppBarNavigate>('ui-navigate', { id: link.id, href })) this.#assign(href);
  }

  /** A menu row's event went through: follow its link (a real `<a>` follows itself). Only targets that passed `appBarTarget`. */
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
      this.#toolNeed = 0;
      this.removeAttribute('mark-only');
    }
    // What had focus: its key, or — inside the theme menu (its button, or the menu host while a row has focus) — the
    // theme control's key.
    const before = this.#active();
    const own = before?.dataset?.key;
    const key = own ?? (before && this.#themePick.contains(before) ? 'theme' : undefined);
    morphInto(this.#parts, this.render());
    this.updated();
    // Focus was lost when its node left; when morph reused that node for another control (the toggle became the
    // speaker: its key changed); or when it sits in the theme menu that just hid (designs went: the toggle takes it).
    const at = this.#active();
    if (key && (!at || at.dataset?.key !== own || (this.#themePick.hidden && this.#themePick.contains(at)))) {
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
    // The menus are elements of their own: the bar's lang and a pinned theme reach them.
    for (const name of ['lang', 'theme']) {
      const v = this.getAttribute(name);
      for (const m of [this.#menu, this.#themeMenu]) {
        if (v) m.setAttribute(name, v);
        else m.removeAttribute(name);
      }
    }
    this.#menu.data = { label, items };
    if (!items.length && this.#menu.open) this.#menu.hide();
    this.#syncThemePick();
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
      this.#toolRow ? '' : '<slot name="toolbar" data-mk="slot:toolbar"></slot>',
      '<slot name="actions" data-mk="slot:actions"></slot>',
      this.#status(d.status),
      this.#account(d.account, t),
      this.#sound(d.sound, t),
      this.#picker() ? '' : this.#theme(d.theme, d.palette, t),
    ].join('');
  }

  #brand(b: AppBarBrand | undefined): string {
    const label = str(b?.label).trim();
    if (!b || !label) return '<slot name="brand" data-mk="slot:brand"></slot>';
    const glyph: IconName | '' = b.mark === true ? 'brand' : typeof b.mark === 'string' ? b.mark : '';
    const mark = glyph ? `<span class="ab-mark" aria-hidden="true">${icon(glyph, { size: 20 })}</span>` : '';
    const inner = `${mark}<span class="ab-brand-label">${esc(label)}</span>`;
    const brand = str(b.href).trim()
      ? `<a class="ab-brand" href="${safeLink(b.href)}" data-act="brand" data-key="brand">${inner}</a>`
      : `<span class="ab-brand">${inner}</span>`;
    return `<slot name="brand" data-mk="slot:brand">${b.heading ? `<h1 class="ab-heading">${brand}</h1>` : brand}</slot>`;
  }

  #nav(nav: AppBarLink[] | undefined): string {
    const links = appBarLinks(nav);
    if (!links.length) return '';
    const rows = links
      .map((l) => {
        const badge = badgeText(l.badge);
        return `<li class="ab-li" data-mk="${escAttr(l.id)}"><a class="ab-link" href="${safeLink(l.href)}"${attrs({
          title: str(l.title).trim() || undefined,
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
    const about = str(s.description).trim();
    return `<span${attrs({
      class: 'ab-status',
      role: 'status',
      'aria-live': 'polite',
      title: about ? `${about}: ${label}` : undefined,
      'data-tone': tone,
      'data-live': !!s.live,
    })}><span class="ab-dot" aria-hidden="true"></span>${
      about ? `<span class="ab-vh">${esc(about)}: </span>` : ''
    }<span class="ab-status-label">${esc(label)}</span></span>`;
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

  #sound(on: boolean | undefined, t: Strings): string {
    if (typeof on !== 'boolean') return '';
    const glyph = on ? 'sound' : 'sound-off';
    return `<button type="button" class="ab-icon-btn ab-sound" aria-pressed="${on}" aria-label="${escAttr(
      on ? t.soundOff : t.soundOn,
    )}" data-act="sound" data-key="sound"><span class="ab-glyph" data-mk="${glyph}">${icon(glyph)}</span></button>`;
  }

  /** The theme menu replaces the toggle: a theme is set and the page offers designs (0.39.0). */
  #picker(): boolean {
    return !!themeOf(this.data?.theme) && appBarDesigns(this.data?.designs).length > 0;
  }

  /** The theme menu mirrors the data: shown with designs, its rows, the button's name and glyph. */
  #syncThemePick(): void {
    const on = this.#picker();
    this.#themePick.hidden = !on;
    // `.ab-theme` names the bar's one live theme control: this button only while it is the one.
    this.#themeBtn.classList.toggle('ab-theme', on);
    if (!on) {
      if (this.#themeMenu.open) this.#themeMenu.hide();
      return;
    }
    const d = this.data ?? {};
    const t = this.#t;
    const lang = this.getAttribute('lang');
    this.#themeMenu.data = { label: t.theme, items: appBarThemeItems(d, lang === 'ko' ? 'ko' : 'en') };
    const theme = themeOf(d.theme) ?? 'dark';
    const name = currentDesign(d)?.label ?? themeName(theme, paletteOf(d.palette), t);
    this.#themeBtn.setAttribute('aria-label', `${t.theme}: ${name}`);
    // The same glyph as the toggle (a sun while dark, a moon while light); it enters when the person changed it here.
    const glyph = theme === 'dark' ? 'sun' : 'moon';
    const span = this.#themeBtn.firstElementChild as HTMLElement | null;
    if (span?.dataset.mk !== glyph) {
      this.#themeBtn.innerHTML = `<span class="${cls('ab-glyph', this.#swapped && 'is-in')}" data-mk="${glyph}">${icon(glyph)}</span>`;
    }
    this.#swapped = false;
  }

  #theme(theme: AppBarTheme | undefined, palette: AppBarPalette | undefined, t: Strings): string {
    const cur = themeOf(theme);
    if (!cur) return '';
    const glyph = cur === 'dark' ? 'sun' : 'moon';
    const next = nextAppBarTheme(cur, paletteOf(palette));
    const label =
      next.palette === 'mono'
        ? next.theme === 'dark'
          ? t.toDarkMono
          : t.toLightMono
        : next.theme === 'dark'
          ? t.toDark
          : t.toLight;
    return `<button type="button" class="ab-icon-btn ab-theme" aria-label="${escAttr(label)}" data-act="theme" data-key="theme"><span class="${cls('ab-glyph', this.#swapped && 'is-in')}" data-mk="${glyph}">${icon(glyph)}</span></button>`;
  }
}

define('ui-app-bar', UiAppBar);

declare global {
  interface HTMLElementTagNameMap {
    'ui-app-bar': UiAppBar;
  }
}
