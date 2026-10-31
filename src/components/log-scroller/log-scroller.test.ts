import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import './log-scroller';
import {
  anchorHidden,
  anchorsIn,
  type LogScrollerData,
  logAtBottom,
  logJumpText,
  logPageDue,
  type UiLogScroller,
} from './log-scroller';

const ITEM_H = 40;
const VIEW_H = 200;
const TOP_H = 40;

/** A row's height in the fake layout: ITEM_H unless the test grew it (`data-h`). */
const rowH = (r: Element) => Number((r as HTMLElement).dataset.h) || ITEM_H;

/** A fake layout: items stacked ITEM_H apart (or their own `data-h`) under a TOP_H top row, a VIEW_H box that scrolls. */
function layout(el: UiLogScroller): HTMLElement {
  const vp = el.shadowRoot!.querySelector<HTMLElement>('.ls-vp')!;
  let top = 0;
  const height = () => el.items.reduce((h, r) => h + rowH(r), TOP_H);
  Object.defineProperty(vp, 'scrollHeight', { configurable: true, get: height });
  Object.defineProperty(vp, 'clientHeight', { configurable: true, get: () => VIEW_H });
  Object.defineProperty(vp, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (v: number) => {
      top = Math.max(0, Math.min(Number(v) || 0, Math.max(0, height() - VIEW_H)));
    },
  });
  vp.getBoundingClientRect = () =>
    ({ top: 0, bottom: VIEW_H, left: 0, right: 300, height: VIEW_H, width: 300 }) as DOMRect;
  vp.scrollTo = ((opts: ScrollToOptions) => {
    vp.scrollTop = Number(opts.top);
  }) as typeof vp.scrollTo;
  return vp;
}

/** A row whose box follows the fake layout. */
function row(el: UiLogScroller, key: string): HTMLElement {
  const r = document.createElement('div');
  r.dataset.item = key;
  r.textContent = `Row ${key}`;
  r.getBoundingClientRect = () => {
    const vp = el.shadowRoot!.querySelector<HTMLElement>('.ls-vp')!;
    const items = el.items;
    const i = items.indexOf(r);
    const t = items.slice(0, i).reduce((h, x) => h + rowH(x), TOP_H) - vp.scrollTop;
    const h = rowH(r);
    return { top: t, bottom: t + h, height: h, left: 0, right: 300, width: 300 } as DOMRect;
  };
  r.getClientRects = () => [r.getBoundingClientRect()] as unknown as DOMRectList;
  return r;
}

function rows(el: UiLogScroller, from: number, n: number): HTMLElement[] {
  return Array.from({ length: n }, (_, i) => row(el, `k${from + i}`));
}

function mount(data?: LogScrollerData, lang?: string): { el: UiLogScroller; vp: HTMLElement } {
  const el = document.createElement('ui-log-scroller') as UiLogScroller;
  if (lang) el.setAttribute('lang', lang);
  document.body.append(el);
  if (data) el.data = data;
  el.renderNow();
  return { el, vp: layout(el) };
}

const q = (el: UiLogScroller, s: string) => el.shadowRoot!.querySelector<HTMLElement>(s);

/** The reader scrolls the box to `top`. */
function scrollTo(vp: HTMLElement, top: number): void {
  vp.scrollTop = top;
  vp.dispatchEvent(new Event('scroll'));
}

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('log-scroller helpers', () => {
  it('logAtBottom: within the slack of the bottom, or a box that cannot scroll', () => {
    expect(logAtBottom(300, 500, 200)).toBe(true);
    expect(logAtBottom(297, 500, 200)).toBe(true);
    expect(logAtBottom(290, 500, 200)).toBe(false);
    expect(logAtBottom(0, 100, 200)).toBe(true);
  });

  it('logPageDue: fill a box that cannot scroll; else only when armed and near the top', () => {
    expect(logPageDue(0, 150, 200, false)).toBe(true);
    expect(logPageDue(0, 900, 200, false)).toBe(false);
    expect(logPageDue(150, 900, 200, true)).toBe(true);
    expect(logPageDue(450, 900, 200, true)).toBe(false);
    expect(logPageDue(0, 0, 0, true)).toBe(false);
  });

  it('logJumpText: count or "Latest", en and ko', () => {
    expect(logJumpText(0)).toBe('Latest');
    expect(logJumpText(3)).toBe('3 new');
    expect(logJumpText(3, 'ko')).toBe('새 항목 3개');
    expect(logJumpText(0, 'ko')).toBe('최신');
    expect(logJumpText(-2)).toBe('Latest');
  });
});

describe('<ui-log-scroller>', () => {
  it('renders an empty state; a named-slot child is not an item', () => {
    const { el } = mount();
    expect(el.items).toHaveLength(0);
    const empty = q(el, '.ls-empty')!;
    expect(empty.hidden).toBe(false);
    expect(empty.textContent).toContain('Nothing here yet');
    const custom = document.createElement('p');
    custom.slot = 'empty';
    custom.textContent = 'No messages';
    el.append(custom);
    el.renderNow();
    expect(el.items).toHaveLength(0);
    expect(q(el, '.ls-vp')?.getAttribute('role')).toBe('log');
    expect(q(el, '.ls-vp')?.getAttribute('aria-label')).toBe('Log');
    expect(q(el, '.ls-vp')?.getAttribute('tabindex')).toBe('0');
  });

  it('first page loading: the loading block, aria-busy, no empty text', () => {
    const { el } = mount({ loading: true });
    expect(q(el, '.ls-loading')?.hidden).toBe(false);
    expect(q(el, '.ls-empty')?.hidden).toBe(true);
    expect(q(el, '.ls-vp')?.getAttribute('aria-busy')).toBe('true');
    expect(el.shadowRoot!.querySelectorAll('.ls-sk')).toHaveLength(3);
  });

  it('escapes the label, empty and start texts', () => {
    const { el } = mount({ label: '<b>L</b>', emptyText: '<img src=x onerror=alert(1)>' });
    expect(q(el, '.ls-vp')?.getAttribute('aria-label')).toBe('<b>L</b>');
    expect(q(el, '.ls-empty img')).toBeNull();
    expect(q(el, '.ls-empty')?.textContent).toContain('<img');
    el.appendItems(rows(el, 0, 2));
    el.data = { startText: '<i>start</i>' };
    el.renderNow();
    expect(q(el, '.ls-start i')).toBeNull();
    expect(q(el, '.ls-start')?.textContent).toBe('<i>start</i>');
  });

  it('appends at the bottom and follows while pinned; the first batch does not animate, later ones do', () => {
    const { el, vp } = mount();
    el.appendItems(rows(el, 0, 10));
    expect(el.items.map((r) => r.dataset.item)).toEqual(['k0', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8', 'k9']);
    expect(el.items.some((r) => r.hasAttribute('data-ls-enter'))).toBe(false);
    expect(q(el, '.ls-empty')?.hidden).toBe(true);
    expect(vp.scrollTop).toBe(TOP_H + 10 * ITEM_H - VIEW_H);
    expect(el.pinned).toBe(true);
    const [next] = rows(el, 10, 1);
    el.appendItems(next);
    expect(next.hasAttribute('data-ls-enter')).toBe(true);
    expect(vp.scrollTop).toBe(TOP_H + 11 * ITEM_H - VIEW_H);
    expect(el.unread).toBe(0);
    expect(q(el, '.ls-jump')?.hasAttribute('data-show')).toBe(false);
    // The entry attribute goes when its animation ends.
    next.dispatchEvent(new Event('animationend', { bubbles: true }));
    expect(next.hasAttribute('data-ls-enter')).toBe(false);
  });

  it('existing nodes are never re-rendered by append, prepend or upsert', () => {
    const { el } = mount();
    const first = rows(el, 0, 5);
    el.appendItems(first);
    el.appendItems(rows(el, 5, 2));
    el.prependItems(rows(el, -3, 3));
    el.upsertItem('k6', row(el, 'k6'));
    for (const r of first) expect(r.isConnected).toBe(true);
    expect(el.items.slice(3, 8)).toEqual(first);
  });

  it('an older page goes in with the log silenced; the log speaks again a frame later', async () => {
    const { el } = mount();
    el.appendItems(rows(el, 0, 5));
    const vp = () => q(el, '.ls-vp')!;
    expect(vp().getAttribute('role')).toBe('log');
    expect(vp().getAttribute('aria-live')).toBeNull();
    let atInsert: string | null = 'unset';
    const prepend = el.prepend.bind(el);
    el.prepend = (...nodes: (Node | string)[]) => {
      atInsert = vp().getAttribute('aria-live');
      prepend(...nodes);
    };
    el.prependItems(rows(el, -3, 3));
    expect(atInsert).toBe('off');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0))));
    expect(vp().getAttribute('aria-live')).toBeNull();
    expect(vp().getAttribute('role')).toBe('log');
  });

  it('live: false is a plain region and stays one through a prepend', () => {
    const { el } = mount({ live: false });
    el.appendItems(rows(el, 0, 3));
    el.prependItems(rows(el, -2, 2));
    expect(q(el, '.ls-vp')!.getAttribute('role')).toBe('region');
    expect(q(el, '.ls-vp')!.getAttribute('aria-live')).toBeNull();
  });

  it('a reader above the newest keeps the place: unread count and the latest pill', () => {
    const { el, vp } = mount();
    el.appendItems(rows(el, 0, 20));
    scrollTo(vp, 100);
    expect(el.pinned).toBe(false);
    el.appendItems(rows(el, 20, 2));
    expect(vp.scrollTop).toBe(100);
    expect(el.unread).toBe(2);
    const jump = q(el, '.ls-jump')!;
    expect(jump.hasAttribute('data-show')).toBe(true);
    expect(jump.textContent).toBe('2 new');
    expect(jump.getAttribute('aria-label')).toBe('Jump to latest, 2 new items');
    el.appendItems(rows(el, 22, 1), { unread: 0 });
    expect(el.unread).toBe(2);
  });

  it('noteUnread counts growth inside a shown item for a reader higher up — not while pinned', () => {
    const { el, vp } = mount();
    el.appendItems(rows(el, 0, 20));
    el.noteUnread(3);
    expect(el.unread).toBe(0);
    scrollTo(vp, 100);
    el.noteUnread(2);
    el.noteUnread(0);
    el.noteUnread(-1);
    expect(el.unread).toBe(2);
    expect(q(el, '.ls-jump')!.textContent).toBe('2 new');
    expect(vp.scrollTop).toBe(100);
  });

  it('the pill jumps to the newest item, clears unread and keeps focus in the box', () => {
    const { el, vp } = mount();
    el.appendItems(rows(el, 0, 20));
    scrollTo(vp, 0);
    el.appendItems(rows(el, 20, 3));
    q(el, '.ls-jump')!.click();
    expect(el.pinned).toBe(true);
    expect(el.unread).toBe(0);
    expect(vp.scrollTop).toBe(TOP_H + 23 * ITEM_H - VIEW_H);
    expect(q(el, '.ls-jump')?.hasAttribute('data-show')).toBe(false);
    expect(el.shadowRoot!.activeElement).toBe(vp);
  });

  it('far from the bottom with nothing unread, the pill says Latest', () => {
    const { el, vp } = mount();
    el.appendItems(rows(el, 0, 30));
    scrollTo(vp, 0);
    const jump = q(el, '.ls-jump')!;
    expect(jump.hasAttribute('data-show')).toBe(true);
    expect(jump.textContent).toBe('Latest');
    expect(jump.getAttribute('aria-label')).toBe('Jump to latest');
  });

  it('Load older sends a cancelable ui-load-older with the oldest key and shows the loading row', () => {
    const { el } = mount({ hasMore: true });
    el.appendItems(rows(el, 0, 10));
    const btn = q(el, '.ls-older')!;
    expect(btn.textContent).toBe('Load older');
    const fired = vi.fn();
    el.addEventListener('ui-load-older', (e) => fired((e as CustomEvent).detail));
    btn.click();
    expect(fired).toHaveBeenCalledWith({ oldest: 'k0' });
    expect(q(el, '.ls-older')?.getAttribute('aria-busy')).toBe('true');
    expect(q(el, '.ls-older')?.textContent).toBe('Loading older…');
    expect(q(el, '.ls-vp')?.getAttribute('aria-busy')).toBe('true');
    // One page at a time.
    q(el, '.ls-older')!.click();
    expect(fired).toHaveBeenCalledTimes(1);
  });

  it('preventDefault on ui-load-older keeps the button as it was', () => {
    const { el } = mount({ hasMore: true });
    el.appendItems(rows(el, 0, 10));
    el.addEventListener('ui-load-older', (e) => e.preventDefault());
    q(el, '.ls-older')!.click();
    expect(q(el, '.ls-older')?.hasAttribute('aria-busy')).toBe(false);
  });

  it('a host update after the request settles the loading row (failed page)', () => {
    const { el } = mount({ hasMore: true });
    el.appendItems(rows(el, 0, 10));
    q(el, '.ls-older')!.click();
    el.data = { hasMore: true };
    el.renderNow();
    expect(q(el, '.ls-older')?.textContent).toBe('Load older');
  });

  it('prepending an older page keeps the rows the reader sees exactly where they were', () => {
    const { el, vp } = mount({ hasMore: true });
    el.appendItems(rows(el, 0, 20));
    scrollTo(vp, 200);
    const seen = el.itemFor('k4')!;
    const before = seen.getBoundingClientRect().top;
    el.prependItems(rows(el, -10, 10), { hasMore: true });
    expect(el.items[0].dataset.item).toBe('k-10');
    expect(seen.getBoundingClientRect().top).toBe(before);
    expect(vp.scrollTop).toBe(200 + 10 * ITEM_H);
    expect(el.unread).toBe(0);
  });

  it('the last page shows the start-of-history marker; an empty startText hides the top row', () => {
    const { el } = mount({ hasMore: true });
    el.appendItems(rows(el, 0, 5));
    q(el, '.ls-older')!.click();
    el.prependItems(rows(el, -2, 2), { hasMore: false });
    expect(q(el, '.ls-older')).toBeNull();
    expect(q(el, '.ls-start')?.textContent).toBe('Start of history');
    expect(el.data?.hasMore).toBe(false);
    el.data = { hasMore: false, startText: '' };
    el.renderNow();
    expect(q(el, '.ls-top')?.hidden).toBe(true);
  });

  it('upsertItem replaces in place; a new key appends; removeItem and clearItems', () => {
    const { el } = mount();
    el.appendItems(rows(el, 0, 3));
    const next = row(el, 'k1');
    next.textContent = 'Row k1 (edited)';
    el.upsertItem('k1', next);
    expect(el.items[1]).toBe(next);
    expect(el.items).toHaveLength(3);
    el.upsertItem('k9', row(el, 'k9'));
    expect(el.items.map((r) => r.dataset.item)).toEqual(['k0', 'k1', 'k2', 'k9']);
    el.removeItem('k0');
    expect(el.itemFor('k0')).toBeNull();
    el.clearItems();
    expect(el.items).toHaveLength(0);
    expect(q(el, '.ls-empty')?.hidden).toBe(false);
    expect(el.pinned).toBe(true);
  });

  it('an item changing size above the reader does not move what they read', () => {
    const { el, vp } = mount();
    el.appendItems(rows(el, 0, 20));
    scrollTo(vp, 300);
    const seen = el.itemFor('k8')!;
    const before = seen.getBoundingClientRect().top;
    // k2 becomes two rows tall (an answer loaded).
    const tall = row(el, 'k2');
    el.upsertItem('k2', tall);
    expect(seen.getBoundingClientRect().top).toBe(before);
  });

  it('auto-fills a box that cannot scroll yet: one ui-load-older after the first page', async () => {
    const { el } = mount({ hasMore: true });
    const fired = vi.fn();
    el.addEventListener('ui-load-older', fired);
    el.appendItems(rows(el, 0, 2));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(fired).toHaveBeenCalledTimes(1);
  });

  it('live=false makes it a plain region', () => {
    const { el } = mount({ live: false, label: 'Activity' });
    expect(q(el, '.ls-vp')?.getAttribute('role')).toBe('region');
    expect(q(el, '.ls-vp')?.getAttribute('aria-label')).toBe('Activity');
  });

  it('speaks Korean with lang="ko"', () => {
    const { el, vp } = mount({ hasMore: true }, 'ko');
    expect(q(el, '.ls-empty')?.textContent).toContain('아직 항목이 없습니다');
    el.appendItems(rows(el, 0, 20));
    expect(q(el, '.ls-older')?.textContent).toBe('이전 항목 불러오기');
    scrollTo(vp, 100);
    el.appendItems(rows(el, 20, 4));
    expect(q(el, '.ls-jump')?.textContent).toBe('새 항목 4개');
    expect(q(el, '.ls-jump')?.getAttribute('aria-label')).toBe('최신으로 이동, 새 항목 4개');
    el.prependItems([], { hasMore: false });
    expect(q(el, '.ls-start')?.textContent).toBe('기록의 시작');
    expect(q(el, '.ls-vp')?.getAttribute('aria-label')).toBe('기록');
  });
});

describe('G2-1: anchors inside a folded (inert) region are not the reader’s place', () => {
  it('anchorHidden: an inert ancestor inside the item, read through shadow hosts; never the item itself', () => {
    const item = document.createElement('div');
    item.innerHTML = '<div class="head" data-anchor></div><div inert><p data-anchor>hidden</p></div>';
    expect(anchorHidden(item.querySelector('.head')!, item)).toBe(false);
    expect(anchorHidden(item.querySelector('p')!, item)).toBe(true);
    expect(anchorHidden(item, item)).toBe(false);
    // An inert ancestor above the item does not count (the item is still the list's business).
    const inertHost = document.createElement('div');
    inertHost.setAttribute('inert', '');
    inertHost.append(item);
    expect(anchorHidden(item.querySelector('.head')!, item)).toBe(false);
    // Through a shadow root: the region is in the item's shadow, the row inside it.
    const sh = document.createElement('div');
    const sr = sh.attachShadow({ mode: 'open' });
    sr.innerHTML = '<section inert><p data-anchor>x</p></section><p data-anchor>y</p>';
    expect(anchorHidden(sr.querySelector('section p')!, sh)).toBe(true);
    expect(anchorHidden(sr.querySelectorAll('p')[1], sh)).toBe(false);
  });

  it('an older page that also adds rows to a folded group above the reader does not move the rows they see', async () => {
    const { el, vp } = mount({ hasMore: true });
    el.appendItems(rows(el, 0, 20));
    // k5 is a folded group: its entries sit in an inert region, laid out over the rows below (a clipped 0fr row).
    const g = row(el, 'k5');
    const region = document.createElement('div');
    region.setAttribute('inert', '');
    g.append(region);
    const hidden: HTMLElement[] = [];
    const hiddenRow = (key: string) => {
      const h = document.createElement('div');
      h.setAttribute('data-anchor', '');
      h.textContent = key;
      h.getBoundingClientRect = () => {
        const t = g.getBoundingClientRect().bottom + hidden.indexOf(h) * ITEM_H;
        return { top: t, bottom: t + ITEM_H, height: ITEM_H, left: 0, right: 300, width: 300 } as DOMRect;
      };
      h.getClientRects = () => [h.getBoundingClientRect()] as unknown as DOMRectList;
      return h;
    };
    for (const k of ['h0', 'h1']) {
      const h = hiddenRow(k);
      hidden.push(h);
      region.append(h);
    }
    el.upsertItem('k5', g);
    // The reader stops with k5's head cut by the top edge: the first row wholly in view is k6 — and, laid out, h0.
    scrollTo(vp, TOP_H + 5 * ITEM_H + 20);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const k6 = el.itemFor('k6')!;
    const before = k6.getBoundingClientRect().top;
    expect(before).toBe(20);
    // The older page: a row lands in the folded group (h0 moves down) and ten older groups go in above.
    const h = hiddenRow('h-1');
    hidden.unshift(h);
    region.prepend(h);
    el.prependItems(rows(el, -10, 10), { hasMore: true });
    expect(k6.getBoundingClientRect().top).toBe(before);
    expect(vp.scrollTop).toBe(TOP_H + 5 * ITEM_H + 20 + 10 * ITEM_H);
  });
});

describe('P3-1: the Load older button holds the reader’s place for the page it asks for', () => {
  const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
  /** The host's answer: a group already shown takes older entries (k1 grows by 80px), then ten older groups go in above. */
  const answer = (el: UiLogScroller, prepend = true) => {
    el.addEventListener('ui-load-older', () => {
      el.itemFor('k1')!.dataset.h = String(ITEM_H + 80);
      if (prepend) el.prependItems(rows(el, -10, 10), { hasMore: true });
    });
  };
  const press = (btn: HTMLElement) => {
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    btn.click();
  };

  it('pressed with the pointer: the rows the reader sees stay where they were (±1px) through the growth and the page', async () => {
    const { el, vp } = mount({ hasMore: true });
    el.appendItems(rows(el, 0, 20));
    scrollTo(vp, 240); // six rows down: the sentinel is not due, the button is the way
    await frame(); // the scroll's own capture
    const seen = el.itemFor('k6')!;
    const before = seen.getBoundingClientRect().top;
    expect(before).toBe(40);
    answer(el);
    press(q(el, '.ls-older')!);
    expect(el.items[0].dataset.item).toBe('k-10');
    expect(Math.abs(seen.getBoundingClientRect().top - before)).toBeLessThan(1);
    expect(vp.scrollTop).toBe(240 + 80 + 10 * ITEM_H);
    expect(el.pinned).toBe(false);
    expect(el.unread).toBe(0);
  });

  it('pressed with a key, before the scroll’s own capture ran: the request captures the place itself', () => {
    const { el, vp } = mount({ hasMore: true });
    el.appendItems(rows(el, 0, 20));
    scrollTo(vp, 240); // no frame in between: nothing is held yet
    const seen = el.itemFor('k6')!;
    const before = seen.getBoundingClientRect().top;
    answer(el);
    const btn = q(el, '.ls-older')!;
    btn.focus();
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
    btn.click();
    expect(Math.abs(seen.getBoundingClientRect().top - before)).toBeLessThan(1);
    expect(vp.scrollTop).toBe(240 + 80 + 10 * ITEM_H);
  });

  it('a page that only grows what is shown: the box’s resize puts the rows back', async () => {
    const ros: Array<() => void> = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          ros.push(cb);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const { el, vp } = mount({ hasMore: true });
    expect(ros).toHaveLength(1);
    el.appendItems(rows(el, 0, 20));
    scrollTo(vp, 240);
    await frame();
    const seen = el.itemFor('k6')!;
    const before = seen.getBoundingClientRect().top;
    answer(el, false);
    press(q(el, '.ls-older')!);
    // The list grew under the reader; the observer fires after the layout.
    expect(seen.getBoundingClientRect().top).toBe(before + 80);
    for (const cb of ros) cb();
    expect(Math.abs(seen.getBoundingClientRect().top - before)).toBeLessThan(1);
    expect(vp.scrollTop).toBe(240 + 80);
  });

  it('contrast: a press on a row (not the button) is the reader’s own hand — the growth before a page is theirs', async () => {
    const { el, vp } = mount({ hasMore: true });
    el.appendItems(rows(el, 0, 20));
    scrollTo(vp, 240);
    await frame();
    const seen = el.itemFor('k6')!;
    const before = seen.getBoundingClientRect().top;
    // A press in the list (happy-dom does not carry a slotted row's event through the shadow tree: the list stands in).
    q(el, '.ls-list')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    el.itemFor('k1')!.dataset.h = String(ITEM_H + 80);
    el.prependItems(rows(el, -10, 10), { hasMore: true });
    // The page itself never moves the rows; the growth the reader caused is kept as they left it.
    expect(seen.getBoundingClientRect().top).toBe(before + 80);
  });
});

describe('G1-1: anchors inside an element item (rows in its shadow root, or named by anchorsFor)', () => {
  const ROW_H = 30;
  /** A ResizeObserver the test fires by hand (happy-dom has none). */
  class FakeRO {
    static cbs: Array<() => void> = [];
    constructor(cb: () => void) {
      FakeRO.cbs.push(cb);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    static fire() {
      for (const cb of FakeRO.cbs) cb();
    }
  }
  beforeEach(() => {
    FakeRO.cbs = [];
    vi.stubGlobal('ResizeObserver', FakeRO);
  });
  afterEach(() => vi.unstubAllGlobals());

  /** One item — a "tree" that draws its rows in its own shadow root — as the whole list. */
  function mountTree(n: number, opts: { anchor?: boolean; hook?: boolean } = {}) {
    const el = document.createElement('ui-log-scroller') as UiLogScroller;
    document.body.append(el);
    el.renderNow();
    const vp = el.shadowRoot!.querySelector<HTMLElement>('.ls-vp')!;
    const tree = document.createElement('div');
    tree.dataset.item = 'tree';
    const list = document.createElement('ul');
    tree.attachShadow({ mode: 'open' }).append(list);
    const rows: HTMLElement[] = [];
    const addRow = (key: string, atStart: boolean) => {
      const li = document.createElement('li');
      li.textContent = key;
      if (opts.anchor) li.setAttribute('data-anchor', '');
      li.getBoundingClientRect = () => {
        const t = TOP_H + rows.indexOf(li) * ROW_H - vp.scrollTop;
        return { top: t, bottom: t + ROW_H, height: ROW_H, left: 0, right: 300, width: 300 } as DOMRect;
      };
      li.getClientRects = () => [li.getBoundingClientRect()] as unknown as DOMRectList;
      if (atStart) {
        rows.unshift(li);
        list.prepend(li);
      } else {
        rows.push(li);
        list.append(li);
      }
      return li;
    };
    for (let i = 0; i < n; i++) addRow(`r${i}`, false);
    tree.getBoundingClientRect = () => {
      const t = TOP_H - vp.scrollTop;
      const h = rows.length * ROW_H;
      return { top: t, bottom: t + h, height: h, left: 0, right: 300, width: 300 } as DOMRect;
    };
    tree.getClientRects = () => [tree.getBoundingClientRect()] as unknown as DOMRectList;
    let top = 0;
    const height = () => TOP_H + rows.length * ROW_H;
    Object.defineProperty(vp, 'scrollHeight', { configurable: true, get: height });
    Object.defineProperty(vp, 'clientHeight', { configurable: true, get: () => VIEW_H });
    Object.defineProperty(vp, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (v: number) => {
        top = Math.max(0, Math.min(Number(v) || 0, Math.max(0, height() - VIEW_H)));
      },
    });
    vp.getBoundingClientRect = () =>
      ({ top: 0, bottom: VIEW_H, left: 0, right: 300, height: VIEW_H, width: 300 }) as DOMRect;
    if (opts.hook) el.anchorsFor = (item) => (item === tree ? rows : null);
    el.appendItems(tree);
    return { el, vp, tree, rows, pageOlder: (k: number) => Array.from({ length: k }, (_, i) => addRow(`o${i}`, true)) };
  }

  it('anchorsIn: the hook first, then light [data-anchor], then [data-anchor] in the open shadow root, else nothing', () => {
    const item = document.createElement('div');
    const sr = item.attachShadow({ mode: 'open' });
    sr.innerHTML = '<p data-anchor>s1</p><p data-anchor>s2</p>';
    expect(anchorsIn(item)).toHaveLength(2);
    expect(anchorsIn(item)[0].textContent).toBe('s1');
    item.innerHTML = '<span data-anchor>l1</span>';
    expect(anchorsIn(item).map((n) => n.textContent)).toEqual(['l1']);
    const own = document.createElement('i');
    expect(anchorsIn(item, () => [own])).toEqual([own]);
    // Nothing from the hook (null, empty, a throw): the attribute lookup.
    expect(anchorsIn(item, () => null).map((n) => n.textContent)).toEqual(['l1']);
    expect(anchorsIn(item, () => []).map((n) => n.textContent)).toEqual(['l1']);
    expect(
      anchorsIn(item, () => {
        throw new Error('no');
      }).map((n) => n.textContent),
    ).toEqual(['l1']);
    expect(anchorsIn(document.createElement('div'))).toEqual([]);
  });

  it('the element exposes anchorsFor (null by default)', () => {
    const el = document.createElement('ui-log-scroller') as UiLogScroller;
    expect(el.anchorsFor).toBeNull();
  });

  it('a page of older rows paged into the one item above the reader: rows marked data-anchor in its shadow stay put', async () => {
    const { el, vp, rows, pageOlder } = mountTree(20, { anchor: true });
    scrollTo(vp, 300);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(el.pinned).toBe(false);
    const seen = rows[9];
    const before = seen.getBoundingClientRect().top;
    expect(before).toBe(10);
    pageOlder(5);
    FakeRO.fire();
    expect(seen.getBoundingClientRect().top).toBe(before);
    expect(vp.scrollTop).toBe(300 + 5 * ROW_H);
  });

  it('…or the rows a host names with anchorsFor', async () => {
    const { el, vp, rows, pageOlder } = mountTree(20, { hook: true });
    scrollTo(vp, 300);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(el.pinned).toBe(false);
    const seen = rows[9];
    const before = seen.getBoundingClientRect().top;
    pageOlder(5);
    FakeRO.fire();
    expect(seen.getBoundingClientRect().top).toBe(before);
    expect(vp.scrollTop).toBe(300 + 5 * ROW_H);
  });

  it('contrast: a plain element item is held by its own top edge, so growing it moves the rows (the gap)', async () => {
    const { vp, rows, pageOlder } = mountTree(20);
    scrollTo(vp, 300);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const seen = rows[9];
    const before = seen.getBoundingClientRect().top;
    pageOlder(5);
    FakeRO.fire();
    expect(seen.getBoundingClientRect().top).toBe(before + 5 * ROW_H);
    expect(vp.scrollTop).toBe(300);
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    spy = soundSpy();
  });
  afterEach(() => spy.restore());
  const tap = (t: EventTarget, detail = 1) =>
    t.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail }));

  it('the “latest” pill plays a subtle navigate', async () => {
    const { el, vp } = mount();
    el.appendItems(rows(el, 0, 20));
    scrollTo(vp, 0);
    el.appendItems(rows(el, 20, 3));
    tap(q(el, '.ls-jump')!, 0);
    await spy.settle();
    expect(el.pinned).toBe(true);
    expect(spy.calls).toEqual([['navigate', { emphasis: 'subtle', input: 'keyboard' }]]);
  });

  it('silent for scrolling, loading older items, new items, and the host’s scrollToLatest()', async () => {
    const { el, vp } = mount({ hasMore: true });
    el.appendItems(rows(el, 0, 20));
    scrollTo(vp, 0);
    el.appendItems(rows(el, 20, 3));
    tap(q(el, '.ls-older')!);
    el.prependItems(rows(el, -5, 5), { hasMore: false });
    el.data = { hasMore: false };
    el.renderNow();
    el.scrollToLatest();
    tap(q(el, '.ls-jump')!); // already at the newest: nothing to jump to
    await spy.settle();
    expect(spy.calls).toEqual([]);
  });

  it('a quiet region silences the pill', async () => {
    const quiet = document.createElement('div');
    quiet.setAttribute('data-ui-sound', 'off');
    document.body.append(quiet);
    const { el, vp } = mount();
    quiet.append(el);
    el.appendItems(rows(el, 0, 20));
    scrollTo(vp, 0);
    expect(el.pinned).toBe(false);
    tap(q(el, '.ls-jump')!);
    expect(el.pinned).toBe(true);
    await spy.settle();
    expect(spy.calls).toEqual([]);
  });
});

describe('layout="page" (D5 G5-5)', () => {
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0))));
  function page(data: LogScrollerData): { el: UiLogScroller; seen: Array<string | null> } {
    const el = document.createElement('ui-log-scroller') as UiLogScroller;
    el.setAttribute('layout', 'page');
    document.body.append(el);
    el.data = data;
    el.renderNow();
    layout(el);
    const seen: Array<string | null> = [];
    el.addEventListener('ui-load-older', (e) => {
      seen.push((e as CustomEvent<{ oldest: string | null }>).detail.oldest);
      e.preventDefault();
    });
    return { el, seen };
  }
  const scrollWindow = (y: number) => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
    window.dispatchEvent(new Event('scroll'));
  };

  it('never fills itself: a short list with older pages waits for the button or a scroll up to the top row', async () => {
    scrollWindow(0);
    const { el, seen } = page({ hasMore: true });
    el.appendItems(rows(el, 0, 3));
    await frame();
    expect(seen).toEqual([]); // a box that "cannot scroll" would have paged in
    q(el, '.ls-older')!.click();
    expect(seen).toEqual(['k0']);
    // The reader scrolls the page down (a landing), then up with the top row within a window height: one more.
    const top = q(el, '.ls-top')!;
    top.getBoundingClientRect = () => ({ top: -200, bottom: -160, height: 40 }) as DOMRect;
    scrollWindow(900);
    expect(seen).toEqual(['k0']);
    scrollWindow(600);
    expect(seen).toEqual(['k0', 'k0']);
    // Far above the view (more than a window height): not yet.
    top.getBoundingClientRect = () => ({ top: -5000, bottom: -4960, height: 40 }) as DOMRect;
    scrollWindow(300);
    expect(seen).toEqual(['k0', 'k0']);
    // The page that came back arms nothing by itself; no pill either, whatever is appended.
    el.prependItems(rows(el, -2, 2), { hasMore: true });
    el.appendItems(rows(el, 10, 4));
    expect(q(el, '.ls-jump')?.hasAttribute('data-show')).toBe(false);
    expect(el.pinned).toBe(true);
    el.remove();
    scrollWindow(100);
    expect(seen).toEqual(['k0', 'k0']); // let go of the window once removed
  });

  it('scrollToLatest scrolls the newest item into view (the page scrolls, not the box); the attribute can go', () => {
    const { el } = page({});
    el.appendItems(rows(el, 0, 2));
    const into = vi.fn();
    el.items[1].scrollIntoView = into;
    el.scrollToLatest({ smooth: false });
    expect(into).toHaveBeenCalledWith({ block: 'end', behavior: 'auto' });
    el.removeAttribute('layout');
    el.renderNow();
    expect(el.getAttribute('layout')).toBeNull();
  });
});
