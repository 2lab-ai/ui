import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import type { MenuItem, UiMenu } from '../menu/menu';
import {
  type AppBarData,
  appBarCollapsed,
  appBarCollapseMode,
  appBarInitials,
  appBarLinks,
  appBarMenuItems,
  appBarTarget,
  appBarToolbarRow,
  type UiAppBar,
} from './app-bar';
import { styles } from './styles';

const XSS = '<img src=x onerror=alert(1)>';
const BREAK = '"><b>x</b>';

const DATA: AppBarData = {
  brand: { label: 'Workbench', href: '/', mark: true },
  nav: [
    { id: 'conversations', label: 'Conversations', href: '/conversations', icon: 'chat', current: true, badge: 3 },
    { id: 'settings', label: 'Settings', href: '/settings', icon: 'gear' },
    { id: 'memory', label: 'Memory', href: '/memory', icon: 'brain' },
  ],
  status: { tone: 'done', label: 'Live', live: true },
  account: { name: 'Mina Park', role: 'Admin', href: '/account' },
  theme: 'dark',
};

/** A ResizeObserver the test drives: `fire(width)` reports a new size for the bar. */
class FakeRO {
  static all: FakeRO[] = [];
  targets: Element[] = [];
  constructor(readonly cb: ResizeObserverCallback) {
    FakeRO.all.push(this);
  }
  observe(t: Element): void {
    this.targets.push(t);
  }
  unobserve(): void {}
  disconnect(): void {
    this.targets = [];
  }
  static fire(el: Element, width: number): void {
    for (const ro of FakeRO.all)
      if (ro.targets.includes(el))
        ro.cb([{ contentRect: { width } } as unknown as ResizeObserverEntry], ro as unknown as ResizeObserver);
  }
}

function mount(data: AppBarData, attrs: Record<string, string> = {}): UiAppBar {
  const el = document.createElement('ui-app-bar');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = (el: Element, s: string) => el.shadowRoot!.querySelector<HTMLElement>(s);
const qa = (el: Element, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const menuOf = (el: UiAppBar) => q(el, 'ui-menu') as unknown as UiMenu;
const trigger = (el: UiAppBar) => q(el, '.ab-menu-btn') as HTMLButtonElement;
const menuRows = (el: UiAppBar) => Array.from(menuOf(el).shadowRoot!.querySelectorAll<HTMLElement>('.mn-item'));

/** Click like a person; returns whether the bar prevented the default (the page stays put either way). */
function click(t: Element, init: MouseEventInit = {}): boolean {
  let prevented = false;
  const late = (e: Event) => {
    prevented = e.defaultPrevented;
    e.preventDefault();
  };
  document.addEventListener('click', late);
  t.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, ...init }));
  document.removeEventListener('click', late);
  return prevented;
}

function record<T = unknown>(el: EventTarget, name: string, cancel = false): Array<T> {
  const out: T[] = [];
  el.addEventListener(name, (e) => {
    out.push((e as CustomEvent<T>).detail);
    if (cancel) e.preventDefault();
  });
  return out;
}

beforeEach(() => {
  document.body.innerHTML = '';
  FakeRO.all = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('helpers', () => {
  it('appBarInitials: first + last word, emails, Korean first syllable, empty', () => {
    expect(appBarInitials('Mina Park')).toBe('MP');
    expect(appBarInitials('mina')).toBe('M');
    expect(appBarInitials('Mary Ann van der Berg')).toBe('MB');
    expect(appBarInitials('mina.park@acme.io')).toBe('MP');
    expect(appBarInitials('ops@acme.io')).toBe('O');
    expect(appBarInitials('@mina')).toBe('M');
    expect(appBarInitials('김민아')).toBe('김');
    expect(appBarInitials('박 지훈')).toBe('박');
    expect(appBarInitials('山田太郎')).toBe('山');
    expect(appBarInitials('Jordan 이')).toBe('J');
    expect(appBarInitials('   ')).toBe('');
    expect(appBarInitials('!!!')).toBe('');
    expect(appBarInitials(null)).toBe('');
    expect(appBarInitials(42)).toBe('');
  });

  it('appBarCollapsed: always / never decide; auto folds below collapseAt or the overflow width', () => {
    expect(appBarCollapsed(2000, undefined, 'always')).toBe(true);
    expect(appBarCollapsed(300, undefined, 'never')).toBe(false);
    expect(appBarCollapsed(0)).toBe(false);
    expect(appBarCollapsed(Number.NaN)).toBe(false);
    expect(appBarCollapsed(719)).toBe(true);
    expect(appBarCollapsed(720)).toBe(false);
    expect(appBarCollapsed(500, 400)).toBe(false);
    expect(appBarCollapsed(500, 0)).toBe(false);
    expect(appBarCollapsed(800, 720, 'auto', 908)).toBe(true);
    expect(appBarCollapsed(950, 720, 'auto', 908)).toBe(false);
    expect(appBarCollapseMode('always')).toBe('always');
    expect(appBarCollapseMode('never')).toBe('never');
    expect(appBarCollapseMode('bogus')).toBe('auto');
    expect(appBarCollapseMode(null)).toBe('auto');
  });

  it('appBarTarget: safe app links only, never #', () => {
    expect(appBarTarget(' /settings ')).toBe('/settings');
    expect(appBarTarget('https://example.com/a')).toBe('https://example.com/a');
    expect(appBarTarget('#memory')).toBe('#memory');
    expect(appBarTarget('#')).toBe('');
    expect(appBarTarget('javascript:alert(1)')).toBe('');
    expect(appBarTarget('data:text/html,x')).toBe('');
    expect(appBarTarget('//evil.example')).toBe('');
    expect(appBarTarget(undefined)).toBe('');
  });

  it('appBarLinks drops junk and repeated ids, keeps one current', () => {
    const out = appBarLinks([
      { id: 'a', label: 'A', current: true },
      { id: 'a', label: 'A again' },
      { id: 'b', label: 'B', current: true },
      { id: '', label: 'no id' },
      { id: 'c' },
      null,
      'x',
    ]);
    expect(out.map((l) => [l.id, l.label, l.current])).toEqual([
      ['a', 'A', true],
      ['b', 'B', false],
    ]);
    expect(appBarLinks(undefined)).toEqual([]);
  });

  it('appBarMenuItems: links as radios, then a separator and the account; no links, no menu', () => {
    const items = appBarMenuItems(DATA.nav, DATA.account);
    expect(items.map((i) => [i.kind ?? 'item', i.value, i.checked])).toEqual([
      ['radio', 'nav:conversations', true],
      ['radio', 'nav:settings', false],
      ['radio', 'nav:memory', false],
      ['separator', undefined, undefined],
      ['item', 'account', undefined],
    ]);
    expect(items[0]).toMatchObject({ label: 'Conversations', icon: 'chat', description: '3' });
    expect(items[0]).not.toHaveProperty('shortcut');
    expect(items[4]).toMatchObject({ label: 'Mina Park', description: 'Admin', icon: 'user' });
    expect(appBarMenuItems(DATA.nav).some((i) => i.kind === 'separator')).toBe(false);
    expect(appBarMenuItems([], DATA.account)).toEqual([]);
  });
});

describe('rendering', () => {
  it('draws the brand mark and label as a link', () => {
    const el = mount(DATA);
    const brand = q(el, 'a.ab-brand')!;
    expect(brand.getAttribute('href')).toBe('/');
    expect(brand.querySelector('svg[data-icon="brand"]')).not.toBeNull();
    expect(q(el, '.ab-brand-label')!.textContent).toBe('Workbench');
    expect(brand.parentElement!.tagName).toBe('SLOT');
    expect(q(el, 'slot[name="actions"]')).not.toBeNull();
  });

  it('brand without href is plain text; no glyph unless mark asks for one; no brand leaves the slot empty', () => {
    const el = mount({ brand: { label: 'Acme Ops' } });
    expect(q(el, 'a.ab-brand')).toBeNull();
    expect(q(el, 'span.ab-brand')!.textContent).toBe('Acme Ops');
    expect(q(el, '.ab-mark')).toBeNull();
    el.data = { brand: { label: 'Acme Ops', mark: 'chat' } };
    el.renderNow();
    expect(q(el, '.ab-mark svg')).not.toBeNull();
    el.data = { brand: { label: 'Acme Ops', mark: true } };
    el.renderNow();
    expect(q(el, '.ab-mark svg')).not.toBeNull();
    el.data = {};
    el.renderNow();
    expect(q(el, '.ab-brand')).toBeNull();
    expect(q(el, 'slot[name="brand"]')!.childNodes.length).toBe(0);
  });

  it('nav: chip links with icons, the current page, a tabular badge, a named landmark', () => {
    const el = mount(DATA);
    const nav = q(el, 'nav.ab-nav')!;
    expect(nav.getAttribute('aria-label')).toBe('Main');
    const links = qa(el, 'a.ab-link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/conversations', '/settings', '/memory']);
    expect(links.map((a) => a.getAttribute('aria-current'))).toEqual(['page', null, null]);
    expect(links[1].querySelector('svg[data-icon="gear"]')).not.toBeNull();
    expect(links[0].querySelector('.ab-badge')!.textContent).toBe('3');
    expect(links[1].querySelector('.ab-badge')).toBeNull();
    el.data = { ...DATA, navLabel: 'Workspace', nav: [{ id: 'a', label: 'A', badge: 12400 }] };
    el.renderNow();
    expect(q(el, 'nav.ab-nav')!.getAttribute('aria-label')).toBe('Workspace');
    expect(q(el, '.ab-badge')!.textContent).toBe('12,400');
    expect(q(el, 'a.ab-link')!.getAttribute('href')).toBe('#');
  });

  it('status: tone dot + word in a polite live region; unknown tone → idle', () => {
    const el = mount(DATA);
    const s = q(el, '.ab-status')!;
    expect(s.getAttribute('role')).toBe('status');
    expect(s.getAttribute('aria-live')).toBe('polite');
    expect(s.dataset.tone).toBe('done');
    expect(s.hasAttribute('data-live')).toBe(true);
    expect(s.textContent).toBe('Live');
    el.data = { ...DATA, status: { tone: 'bogus' as never, label: 'Paused' } };
    el.renderNow();
    expect(q(el, '.ab-status')).toBe(s); // patched in place: the live region persists
    expect(s.dataset.tone).toBe('idle');
    expect(s.hasAttribute('data-live')).toBe(false);
    expect(s.textContent).toBe('Paused');
    el.data = { ...DATA, status: undefined };
    el.renderNow();
    expect(q(el, '.ab-status')).toBeNull();
  });

  it('account: link with derived initials, name and role tag, named for screen readers', () => {
    const el = mount(DATA);
    const a = q(el, 'a.ab-account')!;
    expect(a.getAttribute('href')).toBe('/account');
    expect(a.getAttribute('aria-label')).toBe('Account: Mina Park, Admin');
    expect(q(el, '.ab-avatar')!.textContent).toBe('MP');
    expect(q(el, '.ab-avatar')!.getAttribute('aria-hidden')).toBe('true');
    expect(q(el, '.ab-name')!.textContent).toBe('Mina Park');
    expect(q(el, '.ab-role')!.textContent).toBe('Admin');
  });

  it('account without href is a button; custom initials are capped at two letters; letterless → user glyph', () => {
    const el = mount({ account: { name: 'Sam Rivera', initials: 'XYZ' } });
    expect(q(el, 'button.ab-account')).not.toBeNull();
    expect(q(el, 'a.ab-account')).toBeNull();
    expect(q(el, '.ab-avatar')!.textContent).toBe('XY');
    expect(q(el, '.ab-role')).toBeNull();
    el.data = { account: { name: '!!!' } };
    el.renderNow();
    expect(q(el, '.ab-avatar svg[data-icon="user"]')).not.toBeNull();
    el.data = { account: { name: '  ' } };
    el.renderNow();
    expect(q(el, '.ab-account')).toBeNull();
  });

  it('theme toggle shows only with a theme: sun while dark, moon while light', () => {
    const el = mount({ ...DATA, theme: undefined });
    expect(q(el, '.ab-theme')).toBeNull();
    el.data = DATA;
    el.renderNow();
    expect(q(el, '.ab-theme')!.getAttribute('aria-label')).toBe('Switch to light theme');
    expect(q(el, '.ab-theme svg')!.dataset.icon).toBe('sun');
    el.data = { ...DATA, theme: 'light' };
    el.renderNow();
    expect(q(el, '.ab-theme')!.getAttribute('aria-label')).toBe('Switch to dark theme');
    expect(q(el, '.ab-theme svg')!.dataset.icon).toBe('moon');
    expect(q(el, '.ab-glyph.is-in')).toBeNull(); // no entrance unless toggled here
  });
});

describe('escaping', () => {
  it('escapes every label, id, role and attribute value', () => {
    const el = mount(
      {
        brand: { label: XSS, href: BREAK },
        navLabel: BREAK,
        nav: [
          { id: BREAK, label: XSS, href: BREAK, badge: XSS },
          { id: 'b', label: BREAK },
        ],
        status: { tone: 'run', label: XSS },
        account: { name: XSS, role: BREAK, initials: '<b', href: BREAK },
        theme: 'light',
      },
      { collapse: 'always' },
    );
    menuOf(el).renderNow();
    expect(qa(el, 'img').length + qa(el, 'b').length).toBe(0);
    expect(menuOf(el).shadowRoot!.querySelectorAll('img, b').length).toBe(0);
    expect(q(el, '.ab-brand-label')!.textContent).toBe(XSS);
    expect(qa(el, '.ab-label').map((x) => x.textContent)).toEqual([XSS, BREAK]);
    expect(q(el, '.ab-badge')!.textContent).toBe(XSS);
    expect(q(el, '.ab-status-label')!.textContent).toBe(XSS);
    expect(q(el, '.ab-name')!.textContent).toBe(XSS);
    expect(q(el, '.ab-role')!.textContent).toBe(BREAK);
    expect(q(el, '.ab-avatar')!.textContent).toBe('<b');
    expect(q(el, 'nav.ab-nav')!.getAttribute('aria-label')).toBe(BREAK);
    expect(q(el, 'a.ab-link')!.dataset.id).toBe(BREAK);
    expect(q(el, '.ab-account')!.getAttribute('aria-label')).toBe(`Account: ${XSS}, ${BREAK}`);
    // A relative-looking href with markup stays one escaped attribute value.
    expect(q(el, 'a.ab-link')!.getAttribute('href')).toBe(BREAK);
    expect(q(el, 'a.ab-brand')!.getAttribute('href')).toBe(BREAK);
  });

  it('javascript: and other schemes become #', () => {
    const el = mount({
      brand: { label: 'B', href: 'javascript:alert(1)' },
      nav: [
        { id: 'a', label: 'A', href: 'javascript:alert(1)' },
        { id: 'b', label: 'B', href: 'data:text/html,<b>x</b>' },
        { id: 'c', label: 'C', href: '//evil.example/x' },
      ],
      account: { name: 'Mina', href: 'JavaScript:alert(1)' },
    });
    expect(q(el, 'a.ab-brand')!.getAttribute('href')).toBe('#');
    expect(qa(el, 'a.ab-link').map((a) => a.getAttribute('href'))).toEqual(['#', '#', '#']);
    expect(q(el, 'a.ab-account')!.getAttribute('href')).toBe('#');
  });
});

describe('events', () => {
  it('a link sends ui-navigate { id, href }; not cancelled, the link follows', () => {
    const el = mount(DATA);
    const got = record(el, 'ui-navigate');
    expect(click(qa(el, 'a.ab-link')[1])).toBe(false);
    expect(got).toEqual([{ id: 'settings', href: '/settings' }]);
  });

  it('cancelling ui-navigate cancels the link; a link with nowhere safe to go never navigates', () => {
    const el = mount({ ...DATA, nav: [...DATA.nav!, { id: 'x', label: 'X', href: 'javascript:alert(1)' }] });
    const got = record(el, 'ui-navigate', true);
    expect(click(qa(el, 'a.ab-link')[2])).toBe(true);
    const free = mount({
      nav: [
        { id: 'x', label: 'X', href: 'javascript:alert(1)' },
        { id: 'y', label: 'Y' },
      ],
    });
    const got2 = record(free, 'ui-navigate');
    expect(click(qa(free, 'a.ab-link')[0])).toBe(true);
    expect(click(qa(free, 'a.ab-link')[1])).toBe(true);
    expect(got).toEqual([{ id: 'memory', href: '/memory' }]);
    expect(got2).toEqual([
      { id: 'x', href: '' },
      { id: 'y', href: '' },
    ]);
  });

  it('a modified click on a real link is left to the browser (no event)', () => {
    const el = mount(DATA);
    const got = record(el, 'ui-navigate', true);
    expect(click(qa(el, 'a.ab-link')[1], { metaKey: true })).toBe(false);
    expect(click(qa(el, 'a.ab-link')[1], { ctrlKey: true })).toBe(false);
    expect(got).toEqual([]);
  });

  it('the brand sends ui-navigate with id "brand"', () => {
    const el = mount(DATA);
    const got = record(el, 'ui-navigate', true);
    expect(click(q(el, '.ab-brand-label')!)).toBe(true);
    expect(got).toEqual([{ id: 'brand', href: '/' }]);
  });

  it('the account sends ui-account; cancelling it cancels the link; the button form only sends', () => {
    const el = mount(DATA);
    const got = record(el, 'ui-account');
    expect(click(q(el, '.ab-name')!)).toBe(false);
    expect(got).toEqual([{}]);
    el.addEventListener('ui-account', (e) => e.preventDefault());
    expect(click(q(el, '.ab-account')!)).toBe(true);
    const btn = mount({ account: { name: 'Sam' } });
    const got2 = record(btn, 'ui-account');
    q(btn, 'button.ab-account')!.click();
    expect(got2).toEqual([{}]);
  });

  it('theme toggle sends ui-theme-change and shows the new theme at once; focus stays', () => {
    const el = mount(DATA);
    const got = record(el, 'ui-theme-change');
    const btn = q(el, '.ab-theme')!;
    btn.focus();
    btn.click();
    el.renderNow();
    expect(got).toEqual([{ theme: 'light' }]);
    expect(el.data!.theme).toBe('light');
    expect(q(el, '.ab-theme')).toBe(btn);
    expect(el.shadowRoot!.activeElement).toBe(btn);
    expect(btn.getAttribute('aria-label')).toBe('Switch to dark theme');
    expect(q(el, '.ab-glyph.is-in svg')!.dataset.icon).toBe('moon');
    btn.click();
    expect(got).toEqual([{ theme: 'light' }, { theme: 'dark' }]);
    expect(el.data!.theme).toBe('dark');
  });

  it('a cancelled ui-theme-change keeps the toggle as it was', () => {
    const el = mount(DATA);
    const got = record(el, 'ui-theme-change', true);
    q(el, '.ab-theme')!.click();
    el.renderNow();
    expect(got).toEqual([{ theme: 'light' }]);
    expect(el.data!.theme).toBe('dark');
    expect(q(el, '.ab-theme')!.getAttribute('aria-label')).toBe('Switch to light theme');
  });

  it('host light-DOM content in the actions slot is never taken for a bar control', () => {
    const el = mount(DATA);
    const mine = document.createElement('button');
    mine.slot = 'actions';
    mine.dataset.act = 'theme';
    el.append(mine);
    const got = record(el, 'ui-theme-change');
    mine.click();
    expect(got).toEqual([]);
  });
});

describe('collapse', () => {
  it('collapse="always" folds the links into a Menu holding links and the account', () => {
    const el = mount(DATA, { collapse: 'always' });
    expect(el.hasAttribute('collapsed')).toBe(true);
    const fold = q(el, 'nav.ab-fold')!;
    expect(fold.hidden).toBe(false);
    expect(fold.getAttribute('aria-label')).toBe('Main');
    expect(trigger(el).getAttribute('aria-label')).toBe('Menu');
    expect(trigger(el).getAttribute('aria-haspopup')).toBe('menu');
    const items = menuOf(el).data!.items as MenuItem[];
    expect(items.map((i) => i.value ?? i.kind)).toEqual([
      'nav:conversations',
      'nav:settings',
      'nav:memory',
      'separator',
      'account',
    ]);
    expect(menuOf(el).data!.label).toBe('Main');
  });

  it('auto follows the measured width and collapseAt; never keeps the links out; narrow below 560', () => {
    vi.stubGlobal('ResizeObserver', FakeRO);
    const el = mount(DATA);
    expect(el.hasAttribute('collapsed')).toBe(false); // not measured yet
    FakeRO.fire(el, 500);
    expect(el.hasAttribute('collapsed')).toBe(true);
    expect(el.hasAttribute('narrow')).toBe(true);
    FakeRO.fire(el, 900);
    expect(el.hasAttribute('collapsed')).toBe(false);
    expect(el.hasAttribute('narrow')).toBe(false);
    el.data = { ...DATA, collapseAt: 400 };
    el.renderNow();
    FakeRO.fire(el, 500);
    expect(el.hasAttribute('collapsed')).toBe(false);
    el.setAttribute('collapse', 'never');
    FakeRO.fire(el, 300);
    expect(el.hasAttribute('collapsed')).toBe(false);
    expect(el.hasAttribute('narrow')).toBe(true);
    el.setAttribute('collapse', 'always');
    expect(el.hasAttribute('collapsed')).toBe(true);
  });

  it('auto folds when the content overflows, and unfolds once there is room for it', () => {
    vi.stubGlobal('ResizeObserver', FakeRO);
    const el = mount(DATA);
    const bar = q(el, '.ab-bar')!;
    const size = (scroll: number, client: number) => {
      Object.defineProperty(bar, 'scrollWidth', { value: scroll, configurable: true });
      Object.defineProperty(bar, 'clientWidth', { value: client, configurable: true });
    };
    size(900, 800);
    FakeRO.fire(el, 800);
    expect(el.hasAttribute('collapsed')).toBe(true);
    size(700, 860);
    FakeRO.fire(el, 860); // still narrower than the 908px it needed
    expect(el.hasAttribute('collapsed')).toBe(true);
    size(900, 950);
    FakeRO.fire(el, 950);
    expect(el.hasAttribute('collapsed')).toBe(false);
  });

  it('folded and narrow with the name still cut: the brand shows its mark alone until there is room', () => {
    vi.stubGlobal('ResizeObserver', FakeRO);
    const el = mount(DATA, { collapse: 'always' });
    const label = q(el, '.ab-brand-label')!;
    const size = (scroll: number, client: number) => {
      Object.defineProperty(label, 'scrollWidth', { value: scroll, configurable: true });
      Object.defineProperty(label, 'clientWidth', { value: client, configurable: true });
    };
    size(80, 50);
    FakeRO.fire(el, 330);
    expect(el.hasAttribute('mark-only')).toBe(true);
    // The name stays in the link: its accessible name.
    expect(q(el, 'a.ab-brand .ab-brand-label')!.textContent).toBe('Workbench');
    FakeRO.fire(el, 360); // short of the 368px it needed
    expect(el.hasAttribute('mark-only')).toBe(true);
    size(80, 80);
    FakeRO.fire(el, 370);
    expect(el.hasAttribute('mark-only')).toBe(false);
    // A new brand forgets the measure and measures again; unfolded or wide, the name never gives way.
    size(80, 50);
    FakeRO.fire(el, 330);
    expect(el.hasAttribute('mark-only')).toBe(true);
    size(36, 36);
    el.data = { ...DATA, brand: { label: 'Acme', href: '/', mark: true } };
    el.renderNow();
    expect(el.hasAttribute('mark-only')).toBe(false);
    size(80, 50);
    FakeRO.fire(el, 600);
    expect(el.hasAttribute('narrow')).toBe(false);
    expect(el.hasAttribute('mark-only')).toBe(false);
    el.setAttribute('collapse', 'never');
    FakeRO.fire(el, 330);
    expect(el.hasAttribute('mark-only')).toBe(false);
  });

  it('a brand without a mark keeps its name (ellipsis), even folded and narrow', () => {
    vi.stubGlobal('ResizeObserver', FakeRO);
    const el = mount({ ...DATA, brand: { label: 'Workbench', mark: false } }, { collapse: 'always' });
    const label = q(el, '.ab-brand-label')!;
    Object.defineProperty(label, 'scrollWidth', { value: 80, configurable: true });
    Object.defineProperty(label, 'clientWidth', { value: 50, configurable: true });
    FakeRO.fire(el, 330);
    expect(el.hasAttribute('mark-only')).toBe(false);
  });

  it('no links → no Menu, even folded', () => {
    const el = mount({ brand: { label: 'Acme' }, account: { name: 'Mina' } }, { collapse: 'always' });
    expect(q(el, 'nav.ab-fold')!.hidden).toBe(true);
    expect(q(el, 'nav.ab-nav')).toBeNull();
  });

  it('unfolding closes an open menu without leaking its events', () => {
    const el = mount(DATA, { collapse: 'always' });
    const leaks = [...['ui-open-change', 'ui-select'].map((n) => record(el, n))];
    trigger(el).click();
    expect(menuOf(el).open).toBe(true);
    expect(trigger(el).getAttribute('aria-expanded')).toBe('true');
    el.setAttribute('collapse', 'never');
    expect(el.hasAttribute('collapsed')).toBe(false);
    expect(menuOf(el).open).toBe(false);
    expect(leaks.flat()).toEqual([]);
  });
});

describe('folded menu', () => {
  function open(data: AppBarData = DATA): UiAppBar {
    const el = mount(data, { collapse: 'always' });
    menuOf(el).renderNow();
    trigger(el).click();
    return el;
  }

  it('choosing a link sends ui-navigate and follows it with location.assign; inner events never leak', () => {
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    const el = open();
    const leaks = ['ui-select', 'ui-open-change'].map((n) => record(document, n));
    const got = record(el, 'ui-navigate');
    expect(menuRows(el)[0].getAttribute('aria-checked')).toBe('true');
    menuRows(el)[1].click();
    expect(got).toEqual([{ id: 'settings', href: '/settings' }]);
    expect(assign).toHaveBeenCalledWith('/settings');
    expect(menuOf(el).open).toBe(false);
    expect(leaks.flat()).toEqual([]);
    // The menu mirrors the bar: the current page stays checked until the host says otherwise.
    menuOf(el).renderNow();
    expect(menuRows(el)[0].getAttribute('aria-checked')).toBe('true');
  });

  it('a cancelled ui-navigate does not navigate, but the menu still closes', () => {
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    const el = open();
    const got = record(el, 'ui-navigate', true);
    menuRows(el)[2].click();
    expect(got).toEqual([{ id: 'memory', href: '/memory' }]);
    expect(assign).not.toHaveBeenCalled();
    expect(menuOf(el).open).toBe(false);
  });

  it('a row without a safe href sends ui-navigate but never calls location.assign', () => {
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    const el = open({
      nav: [
        { id: 'a', label: 'A', current: true },
        { id: 'b', label: 'B', href: 'javascript:alert(1)' },
        { id: 'c', label: 'C', href: '#' },
      ],
    });
    const got = record(el, 'ui-navigate');
    menuRows(el)[1].click();
    trigger(el).click();
    menuRows(el)[2].click();
    expect(got).toEqual([
      { id: 'b', href: '' },
      { id: 'c', href: '' },
    ]);
    expect(assign).not.toHaveBeenCalled();
  });

  it('the account row sends ui-account and follows the account link unless cancelled', () => {
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    const el = open();
    const got = record(el, 'ui-account');
    const rows = menuRows(el);
    expect(rows[3].querySelector('.mn-label')!.textContent).toBe('Mina Park');
    rows[3].click();
    expect(got).toEqual([{}]);
    expect(assign).toHaveBeenCalledWith('/account');
    el.addEventListener('ui-account', (e) => e.preventDefault());
    trigger(el).click();
    menuRows(el)[3].click();
    expect(assign).toHaveBeenCalledTimes(1);
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    spy = soundSpy();
  });
  afterEach(() => spy.restore());
  const press = (t: Element, init: MouseEventInit = {}) =>
    t.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail: 1, ...init }));

  it('a link, the brand and the account play navigate with the input that pressed them', async () => {
    const el = mount(DATA);
    el.addEventListener('click', (e) => e.preventDefault());
    press(qa(el, 'a.ab-link')[1]);
    await spy.settle();
    press(q(el, '.ab-brand-label')!, { detail: 0 });
    await spy.settle();
    press(q(el, '.ab-name')!);
    await spy.settle();
    expect(spy.calls).toEqual([
      ['navigate', { input: 'mouse' }],
      ['navigate', { input: 'keyboard' }],
      ['navigate', { input: 'mouse' }],
    ]);
  });

  it('the theme toggle plays toggle: back to light, forward to dark', async () => {
    const el = mount(DATA);
    press(q(el, '.ab-theme')!);
    await spy.settle();
    press(q(el, '.ab-theme')!);
    await spy.settle();
    expect(spy.calls).toEqual([
      ['toggle', { direction: 'back', input: 'mouse' }],
      ['toggle', { direction: 'forward', input: 'mouse' }],
    ]);
  });

  it('a folded menu row that goes through plays navigate once (the menu, cancelled here, stays quiet)', async () => {
    vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    const el = mount(DATA, { collapse: 'always' });
    menuOf(el).renderNow();
    trigger(el).click();
    await spy.settle();
    spy.calls.length = 0;
    menuRows(el)[1].click();
    await spy.settle();
    expect(spy.calls).toEqual([['navigate', undefined]]);
  });

  it('a cancelled ui-navigate still plays navigate (the host routes on the client); a cancelled theme change, a modified click or data from code plays nothing', async () => {
    const el = mount(DATA);
    for (const n of ['ui-navigate', 'ui-account', 'ui-theme-change', 'ui-sound-change'])
      el.addEventListener(n, (e) => e.preventDefault());
    el.addEventListener('click', (e) => e.preventDefault());
    press(qa(el, 'a.ab-link')[1]);
    await spy.settle();
    expect(spy.calls).toEqual([['navigate', { input: 'mouse' }]]);
    spy.calls.length = 0;
    press(q(el, '.ab-theme')!);
    el.data = { ...DATA, sound: false };
    el.renderNow();
    press(q(el, '.ab-sound')!);
    const free = mount(DATA);
    free.addEventListener('click', (e) => e.preventDefault());
    press(qa(free, 'a.ab-link')[1], { metaKey: true });
    free.data = { ...DATA, theme: 'light', sound: true, nav: DATA.nav!.slice(1) };
    free.renderNow();
    await spy.settle();
    expect(spy.calls).toEqual([]);
  });

  it('the speaker sends ui-sound-change and plays its toggle through the page setting as the host leaves it', async () => {
    const el = mount({ ...DATA, sound: false });
    const asked: boolean[] = [];
    el.addEventListener('ui-sound-change', (e) => asked.push((e as CustomEvent<{ sound: boolean }>).detail.sound));
    const b = q(el, '.ab-sound')!;
    expect(b.getAttribute('aria-pressed')).toBe('false');
    expect(b.getAttribute('aria-label')).toBe('Turn sound on');
    expect(b.querySelector('[data-icon]')!.getAttribute('data-icon')).toBe('sound-off');
    // The theme toggle stays last; the speaker sits right before it.
    expect(b.nextElementSibling?.classList.contains('ab-theme')).toBe(true);
    press(b);
    await spy.settle();
    el.renderNow();
    expect(asked).toEqual([true]);
    expect(spy.calls).toEqual([['toggle', { direction: 'forward', input: 'mouse' }]]);
    const on = q(el, '.ab-sound')!;
    expect(on.getAttribute('aria-pressed')).toBe('true');
    expect(on.getAttribute('aria-label')).toBe('Turn sound off');
    expect(on.querySelector('[data-icon]')!.getAttribute('data-icon')).toBe('sound');
    // A host that turns sound off in its listener hears nothing for the off switch.
    el.addEventListener('ui-sound-change', () => spy.restore(), { once: true });
    press(on);
    await spy.settle();
    expect(asked).toEqual([true, false]);
    expect(spy.calls).toHaveLength(1);
  });

  it('no speaker without data.sound; Korean labels with lang="ko"', () => {
    expect(q(mount(DATA), '.ab-sound')).toBeNull();
    const ko = mount({ ...DATA, sound: true }, { lang: 'ko' });
    expect(q(ko, '.ab-sound')!.getAttribute('aria-label')).toBe('소리 끄기');
  });

  it('is silent inside data-ui-sound="off"', async () => {
    const wrap = document.createElement('div');
    wrap.setAttribute('data-ui-sound', 'off');
    document.body.append(wrap);
    const el = mount(DATA);
    wrap.append(el);
    el.addEventListener('click', (e) => e.preventDefault());
    press(qa(el, 'a.ab-link')[1]);
    press(q(el, '.ab-theme')!);
    await spy.settle();
    expect(spy.calls).toEqual([]);
  });
});

describe('lang="ko"', () => {
  it('menu, nav, account and theme strings in Korean; switching lang re-renders', () => {
    const el = mount(
      {
        ...DATA,
        nav: [
          { id: 'c', label: '대화', href: '/c', current: true },
          { id: 's', label: '설정', href: '/s' },
          { id: 'm', label: '기억', href: '/m' },
        ],
        status: { tone: 'done', label: '실시간 연결됨', live: true },
        account: { name: '김민아', role: '관리자' },
      },
      { lang: 'ko', collapse: 'always' },
    );
    expect(trigger(el).getAttribute('aria-label')).toBe('메뉴');
    expect(q(el, 'nav.ab-nav')!.getAttribute('aria-label')).toBe('주 메뉴');
    expect(q(el, 'nav.ab-fold')!.getAttribute('aria-label')).toBe('주 메뉴');
    expect(q(el, '.ab-account')!.getAttribute('aria-label')).toBe('계정: 김민아, 관리자');
    expect(q(el, '.ab-avatar')!.textContent).toBe('김');
    expect(q(el, '.ab-theme')!.getAttribute('aria-label')).toBe('라이트 테마로 전환');
    expect(menuOf(el).getAttribute('lang')).toBe('ko');
    el.setAttribute('lang', 'en');
    el.renderNow();
    expect(trigger(el).getAttribute('aria-label')).toBe('Menu');
    expect(q(el, '.ab-theme')!.getAttribute('aria-label')).toBe('Switch to light theme');
    expect(menuOf(el).getAttribute('lang')).toBe('en');
    el.removeAttribute('lang');
    el.renderNow();
    expect(menuOf(el).hasAttribute('lang')).toBe(false);
  });
});

describe('D2 gaps: toolbar row, link title, brand heading, status description', () => {
  it('appBarToolbarRow: never without a toolbar or a measure; below toolbarAt or the width it needed', () => {
    expect(appBarToolbarRow(0, 1280, 0, true)).toBe(false);
    expect(appBarToolbarRow(900, 1280, 0, false)).toBe(false);
    expect(appBarToolbarRow(900, undefined, 0, true)).toBe(false);
    expect(appBarToolbarRow(900, 1280, 0, true)).toBe(true);
    expect(appBarToolbarRow(1300, 1280, 0, true)).toBe(false);
    expect(appBarToolbarRow(900, 0, 1000, true)).toBe(true);
    expect(appBarToolbarRow(1100, Number.NaN, 1000, true)).toBe(false);
  });

  it('a link title is the link’s title and, folded, the menu row’s second line (after its count)', () => {
    const nav = [
      { id: 'a', label: 'Conversations', title: 'Every past conversation', badge: 3 },
      { id: 'b', label: 'Settings', title: '  ' },
    ];
    const items = appBarMenuItems(nav);
    expect(items[0].description).toBe('3 · Every past conversation');
    expect(items[1].description).toBeUndefined();
    const el = mount({ nav: [{ id: 'a', label: 'Memory', href: '/m', title: `Kept facts ${BREAK}` }] });
    const a = q(el, 'a.ab-link')!;
    expect(a.getAttribute('title')).toBe(`Kept facts ${BREAK}`);
    expect(q(el, 'a.ab-link b')).toBeNull();
    const plain = mount({ nav: [{ id: 'a', label: 'Memory', href: '/m' }] });
    expect(q(plain, 'a.ab-link')!.hasAttribute('title')).toBe(false);
  });

  it('brand.heading draws the brand inside an h1 (the link inside it); without it no heading', () => {
    const el = mount({ brand: { label: `soma ${XSS}`, href: '/', mark: true, heading: true } });
    const h1 = q(el, 'h1.ab-heading')!;
    expect(h1).not.toBeNull();
    expect(h1.querySelector('a.ab-brand .ab-brand-label')!.textContent).toBe(`soma ${XSS}`);
    expect(q(el, 'img')).toBeNull();
    const span = mount({ brand: { label: 'soma', heading: true } });
    expect(q(span, 'h1.ab-heading > span.ab-brand')).not.toBeNull();
    expect(q(mount({ brand: { label: 'soma' } }), 'h1')).toBeNull();
  });

  it('status.description is read before the word and shown as its title', () => {
    const el = mount({ status: { tone: 'done', label: 'Connected', description: `Live updates ${XSS}` } });
    const st = q(el, '.ab-status')!;
    expect(st.textContent).toBe(`Live updates ${XSS}: Connected`);
    expect(st.getAttribute('title')).toBe(`Live updates ${XSS}: Connected`);
    expect(q(el, '.ab-status .ab-vh')!.textContent).toBe(`Live updates ${XSS}: `);
    expect(q(el, 'img')).toBeNull();
    const plain = mount({ status: { tone: 'done', label: 'Live' } });
    expect(q(plain, '.ab-status')!.hasAttribute('title')).toBe(false);
    expect(q(plain, '.ab-vh')).toBeNull();
  });

  function withToolbar(data: AppBarData = DATA): { el: UiAppBar; tools: HTMLElement } {
    const el = document.createElement('ui-app-bar');
    const tools = document.createElement('div');
    tools.slot = 'toolbar';
    tools.textContent = 'Model · Effort · All users';
    const act = document.createElement('button');
    act.slot = 'actions';
    act.textContent = 'New task';
    el.append(tools, act);
    document.body.append(el);
    el.data = data;
    el.renderNow();
    return { el, tools };
  }
  /** The bar overflows by `over` px while the toolbar is inline, and by `rest` once it has left. */
  function overflow(el: UiAppBar, width: number, over: number, rest = -50): void {
    const bar = q(el, '.ab-bar')!;
    Object.defineProperty(bar, 'clientWidth', { get: () => width, configurable: true });
    Object.defineProperty(bar, 'scrollWidth', {
      get: () => width + (el.hasAttribute('toolbar-row') ? rest : over),
      configurable: true,
    });
  }
  const toolbarSlot = (el: UiAppBar) => q(el, 'slot[name="toolbar"]')!;

  it('the toolbar rides in the bar while it fits, before the actions', () => {
    vi.stubGlobal('ResizeObserver', FakeRO);
    const { el } = withToolbar();
    overflow(el, 1400, -20);
    FakeRO.fire(el, 1400);
    expect(el.hasAttribute('toolbar-row')).toBe(false);
    const slots = qa(el, '.ab-bar slot').map((x) => x.getAttribute('name'));
    expect(slots.indexOf('toolbar')).toBeLessThan(slots.indexOf('actions'));
    expect(toolbarSlot(el).closest('.ab-bar')).not.toBeNull();
  });

  it('overflowing, the toolbar takes the row under the bar first; the links fold only if it still overflows', () => {
    vi.stubGlobal('ResizeObserver', FakeRO);
    const { el, tools } = withToolbar();
    overflow(el, 1000, 300);
    FakeRO.fire(el, 1000);
    expect(el.hasAttribute('toolbar-row')).toBe(true);
    expect(el.hasAttribute('collapsed')).toBe(false);
    // The bar draws no toolbar slot now; the row's slot (the first left in tree order) shows the host's node.
    expect(q(el, '.ab-bar slot[name="toolbar"]')).toBeNull();
    expect(toolbarSlot(el).closest('.ab-row')).not.toBeNull();
    expect(tools.parentElement).toBe(el);
    // Still short of the 1308px it needed with the toolbar inline.
    overflow(el, 1200, 100);
    FakeRO.fire(el, 1200);
    expect(el.hasAttribute('toolbar-row')).toBe(true);
    overflow(el, 1320, -10);
    FakeRO.fire(el, 1320);
    expect(el.hasAttribute('toolbar-row')).toBe(false);
    // Overflowing even without the toolbar: it leaves, then the links fold.
    overflow(el, 600, 700, 200);
    FakeRO.fire(el, 600);
    expect(el.hasAttribute('toolbar-row')).toBe(true);
    expect(el.hasAttribute('collapsed')).toBe(true);
  });

  it('toolbarAt sends the toolbar to its row below a width; no toolbar child, no row', () => {
    vi.stubGlobal('ResizeObserver', FakeRO);
    const { el } = withToolbar({ ...DATA, toolbarAt: 1280 });
    overflow(el, 1200, -100);
    FakeRO.fire(el, 1200);
    expect(el.hasAttribute('toolbar-row')).toBe(true);
    overflow(el, 1300, -100);
    FakeRO.fire(el, 1300);
    expect(el.hasAttribute('toolbar-row')).toBe(false);
    const bare = mount({ ...DATA, toolbarAt: 1280 });
    FakeRO.fire(bare, 900);
    expect(bare.hasAttribute('toolbar-row')).toBe(false);
    expect(q(bare, '.ab-bar slot[name="toolbar"]')).not.toBeNull();
  });

  it('the toolbar moving between its slots is not new content: a slotchange keeps the measures', () => {
    vi.stubGlobal('ResizeObserver', FakeRO);
    const { el, tools } = withToolbar();
    overflow(el, 1000, 300);
    FakeRO.fire(el, 1000);
    expect(el.hasAttribute('toolbar-row')).toBe(true);
    // The move fires slotchange on both slots; neither may forget the 1308px.
    overflow(el, 1000, 300, -50);
    for (const s of qa(el, 'slot')) s.dispatchEvent(new Event('slotchange', { bubbles: true }));
    expect(el.hasAttribute('toolbar-row')).toBe(true);
    // A real change (a control left the toolbar for the actions) measures again.
    tools.slot = 'actions';
    for (const s of qa(el, 'slot')) s.dispatchEvent(new Event('slotchange', { bubbles: true }));
    expect(el.hasAttribute('toolbar-row')).toBe(false);
  });

  it('styles: the row is the bar’s surface under a hairline, wraps, and grows the sticky host', () => {
    expect(styles).toMatch(/:host\(\[toolbar-row\]\) \{ height: auto; \}/);
    expect(styles).toMatch(/:host\(\[toolbar-row\]\) \.ab-row \{ display: flex; flex-wrap: wrap/);
    expect(styles).toMatch(/\.ab-row \{[^}]*border-top: 1px solid var\(--border\)/);
    expect(styles).toMatch(/\.ab-vh, :host\(\[narrow\]\) \.ab-status-label/);
  });
});

describe('styles', () => {
  it('sticky, translucent with an opaque fallback; tokens only', () => {
    expect(styles).toContain('position: sticky');
    expect(styles).toContain('backdrop-filter: saturate(1.4) blur(10px)');
    expect(styles).toContain('prefers-reduced-transparency: reduce');
    expect(styles).toContain('@supports not');
    expect(styles).toContain('var(--ui-app-bar-z, 30)');
    expect(styles).toMatch(/@media \(pointer: coarse\)/);
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    expect(styles).not.toMatch(/:hover[^}]*(transform|scale)/);
  });

  it('the blur lives on :host::before, so the host never becomes the containing block of the fixed menu', () => {
    const css = styles.replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => [sel.trim(), body] as const);
    for (const [sel, body] of rules) {
      if (/backdrop-filter:\s*(saturate|blur)/.test(body)) expect(sel).toBe(':host::before');
      if (sel === ':host') expect(body).not.toMatch(/backdrop-filter|filter:|transform:|contain:|will-change/);
    }
    expect(styles).toMatch(/:host::before \{[^}]*position: absolute; inset: 0 0 -1px; z-index: -1/);
  });
});
