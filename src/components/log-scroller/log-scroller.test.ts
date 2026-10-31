import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import './log-scroller';
import {
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

/** A fake layout: items stacked ITEM_H apart under a TOP_H top row, a VIEW_H box that scrolls. */
function layout(el: UiLogScroller): HTMLElement {
  const vp = el.shadowRoot!.querySelector<HTMLElement>('.ls-vp')!;
  let top = 0;
  const height = () => TOP_H + el.items.length * ITEM_H;
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
    const i = el.items.indexOf(r);
    const t = TOP_H + i * ITEM_H - vp.scrollTop;
    return { top: t, bottom: t + ITEM_H, height: ITEM_H, left: 0, right: 300, width: 300 } as DOMRect;
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
