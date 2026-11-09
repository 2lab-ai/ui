import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import type { UiMenu } from '../menu/menu';
import {
  type DockData,
  type DockItem,
  dockBadge,
  dockItems,
  dockLayout,
  dockMax,
  dockMoreBadge,
  dockSplit,
  dockTarget,
  type UiDock,
} from './dock';
import './dock';

const XSS = '<img src=x onerror=alert(1)>';

function mount(data: DockData, attrs: Record<string, string> = {}): UiDock {
  const el = document.createElement('ui-dock') as UiDock;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = (el: UiDock, s: string) => el.shadowRoot!.querySelector<HTMLElement>(s);
const qa = (el: UiDock, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const press = (t: Element, init: MouseEventInit = {}) =>
  t.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, ...init }));

const FOUR: DockData = {
  action: { id: 'new', label: 'New task' },
  items: [
    { id: 'board', label: 'Board', icon: 'board', href: '/dashboard', current: true, badge: 3 },
    { id: 'chats', label: 'Chats', icon: 'conversations', href: '/conversations' },
    { id: 'memory', label: 'Memory', icon: 'memory', href: '/memory' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ],
};
const SIX: DockItem[] = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B', badge: 2 },
  { id: 'c', label: 'C' },
  { id: 'd', label: 'D', badge: 1 },
  { id: 'e', label: 'E', badge: 4 },
  { id: 'f', label: 'F' },
];

let mq: { matches: boolean; listeners: Array<() => void> };
beforeEach(() => {
  document.body.innerHTML = '';
  mq = { matches: false, listeners: [] };
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.includes('max-width: 639px') ? mq.matches : false;
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => mq.listeners.push(fn),
    removeEventListener: (_: string, fn: () => void) => {
      mq.listeners = mq.listeners.filter((f) => f !== fn);
    },
  }));
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('helpers', () => {
  it('dockLayout falls back to bar', () => {
    expect(dockLayout('rail')).toBe('rail');
    expect(dockLayout('auto')).toBe('auto');
    expect(dockLayout('side')).toBe('bar');
    expect(dockLayout(null)).toBe('bar');
  });
  it('dockTarget keeps safe targets only', () => {
    expect(dockTarget('/memory')).toBe('/memory');
    expect(dockTarget('https://x.dev/a')).toBe('https://x.dev/a');
    expect(dockTarget('javascript:alert(1)')).toBe('');
    expect(dockTarget('//evil.dev')).toBe('');
    expect(dockTarget(7)).toBe('');
  });
  it('dockItems drops junk, keeps the first of a repeated id and one current', () => {
    const out = dockItems([
      { id: 'a', label: 'A', current: true },
      { id: 'a', label: 'A2' },
      { id: 'b', label: 'B', current: true },
      { id: '', label: 'x' },
      null,
      { id: 'c' },
    ]);
    expect(out.map((i) => i.id)).toEqual(['a', 'b']);
    expect(out.map((i) => i.current)).toEqual([true, false]);
    expect(dockItems('nope')).toEqual([]);
  });
  it('dockBadge words', () => {
    expect(dockBadge(0)).toBe('');
    expect(dockBadge(-2)).toBe('');
    expect(dockBadge(Number.NaN)).toBe('');
    expect(dockBadge(3)).toBe('3');
    expect(dockBadge(3.7)).toBe('3');
    expect(dockBadge(120)).toBe('99+');
    expect(dockBadge(' new ')).toBe('new');
    expect(dockBadge(null)).toBe('');
  });
  it('dockMax clamps 2 … 6 with 4 by default', () => {
    expect(dockMax(undefined)).toBe(4);
    expect(dockMax(1)).toBe(2);
    expect(dockMax(9)).toBe(6);
    expect(dockMax(3.9)).toBe(3);
  });
  it('dockSplit folds past max, never one alone, and keeps the current item on the bar', () => {
    expect(dockSplit(SIX.slice(0, 4), 4).more).toEqual([]);
    expect(dockSplit(SIX.slice(0, 5), 4).more).toEqual([]);
    const s = dockSplit(SIX, 4);
    expect(s.shown.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(s.more.map((i) => i.id)).toEqual(['d', 'e', 'f']);
    const cur = dockSplit(
      SIX.map((i) => ({ ...i, current: i.id === 'e' })),
      4,
    );
    expect(cur.shown.map((i) => i.id)).toEqual(['a', 'b', 'e']);
    expect(cur.more.map((i) => i.id)).toEqual(['c', 'd', 'f']);
  });
  it('dockMoreBadge sums counts, or a dot for words', () => {
    expect(dockMoreBadge(SIX.slice(3))).toBe('5');
    expect(dockMoreBadge([{ id: 'x', label: 'X', badge: 'new' }])).toBe('•');
    expect(dockMoreBadge([{ id: 'x', label: 'X', badge: '7' }])).toBe('7');
    expect(
      dockMoreBadge([
        { id: 'x', label: 'X', badge: 90 },
        { id: 'y', label: 'Y', badge: 20 },
      ]),
    ).toBe('99+');
    expect(dockMoreBadge([{ id: 'x', label: 'X' }])).toBe('');
  });
});

describe('<ui-dock> bar', () => {
  it('draws a named nav with links, the current tab and the action in the middle', () => {
    const el = mount(FOUR);
    const nav = q(el, 'nav')!;
    expect(nav.getAttribute('aria-label')).toBe('Sections');
    expect(el.hasAttribute('data-bar')).toBe(true);
    const cells = qa(el, '.dk-tabs > li');
    expect(cells.length).toBe(5);
    expect(cells[2]!.classList.contains('dk-cell-act')).toBe(true);
    const links = qa(el, 'a.dk-item');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/dashboard', '/conversations', '/memory']);
    expect(q(el, 'button.dk-item[data-id="settings"]')).not.toBeNull();
    expect(links[0]!.getAttribute('aria-current')).toBe('page');
    expect(links[1]!.hasAttribute('aria-current')).toBe(false);
    expect(links[0]!.getAttribute('aria-label')).toBe('Board, 3 new');
    expect(q(el, '.dk-badge')!.textContent).toBe('3');
    expect(q(el, '.dk-act')!.getAttribute('aria-label')).toBe('New task');
    expect(nav.style.getPropertyValue('--dk-cols')).toBe('5');
  });

  it('names the nav from data and speaks Korean', () => {
    const el = mount({ ...FOUR, label: '대시보드' }, { lang: 'ko' });
    expect(q(el, 'nav')!.getAttribute('aria-label')).toBe('대시보드');
    expect(qa(el, 'a.dk-item')[0]!.getAttribute('aria-label')).toBe('Board, 새 항목 3개');
    const ko = mount({ items: FOUR.items }, { lang: 'ko' });
    expect(q(ko, 'nav')!.getAttribute('aria-label')).toBe('구역');
  });

  it('folds the rest behind More with the summed badge and a menu of radios', () => {
    const el = mount({ items: SIX, action: { id: 'new', label: 'New' } });
    expect(qa(el, '.dk-tabs .dk-item').map((b) => b.dataset.id)).toEqual(['a', 'b', 'c']);
    const more = q(el, '.dk-more')!;
    expect(more.hidden).toBe(false);
    const btn = q(el, '.dk-more-btn')!;
    expect(btn.getAttribute('aria-label')).toBe('More, 5 new');
    expect(btn.querySelector('.dk-badge')!.textContent).toBe('5');
    const menu = q(el, 'ui-menu') as UiMenu;
    expect(menu.data!.items.map((i) => i.value)).toEqual(['dock:d', 'dock:e', 'dock:f']);
    expect(menu.data!.items[0]!.description).toBe('1');
    // the action sits in the middle of four tabs (three + More)
    const cells = qa(el, '.dk-tabs > li');
    expect(cells[2]!.classList.contains('dk-cell-act')).toBe(true);
    expect(q(el, 'nav')!.style.getPropertyValue('--dk-cols')).toBe('5');
  });

  it('hides More when everything fits and keeps the same menu node across renders', () => {
    const el = mount({ items: SIX });
    const menu = q(el, 'ui-menu');
    el.data = { items: SIX, max: 6 };
    el.renderNow();
    expect(q(el, '.dk-more')!.hidden).toBe(true);
    el.data = { items: SIX };
    el.renderNow();
    expect(q(el, 'ui-menu')).toBe(menu);
    expect(q(el, '.dk-more')!.hidden).toBe(false);
  });

  it('patches in place: a new badge keeps the tab node', () => {
    const el = mount(FOUR);
    const a = q(el, 'a.dk-item[data-id="board"]');
    el.data = { ...FOUR, items: FOUR.items.map((i) => (i.id === 'board' ? { ...i, badge: 5 } : i)) };
    el.renderNow();
    expect(q(el, 'a.dk-item[data-id="board"]')).toBe(a);
    expect(q(el, '.dk-badge')!.textContent).toBe('5');
  });

  it('escapes every string', () => {
    const el = mount({
      label: XSS,
      moreLabel: XSS,
      action: { id: 'x', label: XSS },
      items: [
        { id: 'a', label: XSS, title: XSS, badge: XSS, href: 'javascript:alert(1)' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
        { id: 'd', label: 'D' },
        { id: 'e', label: XSS, title: XSS },
        { id: 'f', label: 'F' },
      ],
    });
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    expect(q(el, '[data-id="a"]')!.tagName).toBe('BUTTON');
    expect(q(el, '.dk-word')!.textContent).toBe(XSS);
    expect(q(el, '.dk-more-btn .dk-word')!.textContent).toBe(XSS);
  });
});

describe('<ui-dock> rail and auto', () => {
  it('draws the rail: action first, end items after a hairline, labels as tips', () => {
    const el = mount(
      {
        action: { id: 'new', label: 'New task' },
        items: [
          { id: 'board', label: 'Board', current: true },
          { id: 'settings', label: 'Settings', end: true },
        ],
      },
      { layout: 'rail' },
    );
    expect(el.hasAttribute('data-bar')).toBe(false);
    expect(q(el, 'nav')!.dataset.layout).toBe('rail');
    const body = q(el, '.dk-body')!;
    expect(body.firstElementChild!.classList.contains('dk-act')).toBe(true);
    expect(qa(el, '.dk-list').length).toBe(2);
    expect(q(el, '.dk-sep')).not.toBeNull();
    expect(qa(el, '.dk-tip').map((t) => t.textContent)).toEqual(['New task', 'Board', 'Settings']);
    expect(q(el, '.dk-more')!.hidden).toBe(true);
  });

  it('auto follows the phone breakpoint while connected', () => {
    const el = mount(FOUR, { layout: 'auto' });
    expect(el.layout).toBe('rail');
    expect(mq.listeners.length).toBe(1);
    mq.matches = true;
    for (const fn of mq.listeners) fn();
    el.renderNow();
    expect(el.layout).toBe('bar');
    expect(el.hasAttribute('data-bar')).toBe(true);
    el.remove();
    expect(mq.listeners.length).toBe(0);
  });

  it('watches the breakpoint only in auto', () => {
    mount(FOUR, { layout: 'bar' });
    expect(mq.listeners.length).toBe(0);
  });
});

describe('<ui-dock> events', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    spy = soundSpy();
  });
  afterEach(() => spy.restore());

  it('a tab sends ui-navigate; cancelling stops the link', async () => {
    const el = mount(FOUR);
    const seen: Array<{ id: string; href: string }> = [];
    el.addEventListener('ui-navigate', (e) => {
      seen.push((e as CustomEvent).detail);
      e.preventDefault();
    });
    const a = q(el, 'a.dk-item[data-id="chats"]')!;
    const ok = press(a);
    expect(seen).toEqual([{ id: 'chats', href: '/conversations' }]);
    expect(ok).toBe(false);
    await spy.settle();
    expect(spy.cues()).toEqual(['navigate']);
  });

  it('a modified click on a link is the browser’s', () => {
    const el = mount(FOUR);
    const fn = vi.fn();
    el.addEventListener('ui-navigate', fn);
    press(q(el, 'a.dk-item[data-id="chats"]')!, { metaKey: true });
    expect(fn).not.toHaveBeenCalled();
  });

  it('a button tab sends ui-navigate with an empty href', () => {
    const el = mount(FOUR);
    const fn = vi.fn();
    el.addEventListener('ui-navigate', (e) => fn((e as CustomEvent).detail));
    press(q(el, '[data-id="settings"]')!);
    expect(fn).toHaveBeenCalledWith({ id: 'settings', href: '' });
  });

  it('the action sends ui-action, sounding only when not cancelled', async () => {
    const el = mount(FOUR);
    const fn = vi.fn();
    el.addEventListener('ui-action', (e) => fn((e as CustomEvent).detail));
    press(q(el, '.dk-act')!);
    expect(fn).toHaveBeenCalledWith({ id: 'new' });
    await spy.settle();
    expect(spy.cues()).toEqual(['open']);
    el.addEventListener('ui-action', (e) => e.preventDefault());
    press(q(el, '.dk-act')!);
    await spy.settle();
    expect(spy.cues()).toEqual(['open']);
  });

  it('a row behind More becomes ui-navigate and the menu’s own events stay inside', () => {
    const el = mount({ items: SIX.map((i) => ({ ...i, href: `/${i.id}` })) });
    const nav = vi.fn();
    const outer = vi.fn();
    el.addEventListener('ui-navigate', (e) => {
      nav((e as CustomEvent).detail);
      e.preventDefault();
    });
    document.body.addEventListener('ui-select', outer);
    const menu = q(el, 'ui-menu')!;
    menu.dispatchEvent(
      new CustomEvent('ui-select', {
        detail: { value: 'dock:e', kind: 'radio', checked: true },
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    expect(nav).toHaveBeenCalledWith({ id: 'e', href: '/e' });
    expect(outer).not.toHaveBeenCalled();
  });

  it('focus survives a re-render on the same tab', () => {
    const el = mount(FOUR);
    const a = q(el, 'a.dk-item[data-id="memory"]')!;
    a.focus();
    el.data = { ...FOUR, items: FOUR.items.map((i) => ({ ...i, current: i.id === 'memory' })) };
    el.renderNow();
    expect(el.shadowRoot!.activeElement).toBe(q(el, 'a.dk-item[data-id="memory"]'));
  });
});
