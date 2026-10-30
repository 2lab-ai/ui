import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import {
  type TaskRun,
  type TaskRunOpen,
  type TaskRunsData,
  type TaskRunToggle,
  taskRunMs,
  taskRunStamp,
  taskRunTokenTotal,
  taskRunToolCount,
  taskRunTotals,
  type UiTaskRuns,
} from './task-runs';

const XSS = '<img src=x onerror=alert(1)>';
const NOW = Date.UTC(2026, 9, 27, 9, 0, 0);

function mount(data: TaskRunsData | undefined, attrs: Record<string, string> = {}): UiTaskRuns {
  const el = document.createElement('ui-task-runs');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiTaskRuns, s: string) => el.shadowRoot!.querySelector<E>(s);
const qa = (el: UiTaskRuns, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const text = (n: Element | null | undefined) => (n?.textContent ?? '').replace(/\s+/g, ' ').trim();
const row = (el: UiTaskRuns, id: string) => qa(el, '.tr-row').find((r) => r.dataset.id === id)!;
const run = (el: UiTaskRuns, id: string) => qa(el, '.tr-run').find((r) => r.dataset.id === id)!;
const dd = (li: HTMLElement, label: string) =>
  (Array.from(li.querySelectorAll('dt')).find((d) => d.textContent === label)?.nextElementSibling ??
    null) as HTMLElement | null;
const key = (target: Element, k: string) => {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true });
  target.dispatchEvent(ev);
  return ev;
};

const RUNS: TaskRun[] = [
  {
    id: 'T1',
    ref: '#T1',
    title: 'Reproduce the failing test',
    status: 'done',
    startedAt: NOW - 600_000,
    endedAt: NOW - 528_000,
    tokens: { input: 1_800, output: 900, cacheRead: 38_400, cacheWrite: 2_100 },
    tools: [
      { name: 'Bash', count: 3 },
      { name: 'Read', count: 2 },
    ],
    costUsd: 0.06,
    href: 'https://example.com/runs/T1',
  },
  {
    id: 'T2',
    title: 'Patch the parser',
    status: 'dropped',
    startedAt: NOW - 528_000,
    endedAt: NOW - 300_000,
    toolCalls: 7,
    revisions: [{ at: NOW - 500_000, note: 'Narrowed to rounding' }, { note: 'No time on this one' }, { note: '' }],
  },
  {
    id: 'T3',
    title: 'Fix the cart total',
    status: 'running',
    startedAt: NOW - 68_000,
    tokens: { input: 1_000, output: 500 },
    tools: [{ name: 'Edit', count: 2 }],
    costUsd: 0.1,
    canOpen: true,
  },
];
const BASE: TaskRunsData = { runs: RUNS };

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('pure helpers', () => {
  it('measures a run: live while running, else the host’s duration, else end − start', () => {
    expect(taskRunMs(RUNS[2], NOW)).toBe(68_000);
    expect(taskRunMs(RUNS[2], NOW + 2_000)).toBe(70_000);
    expect(taskRunMs(RUNS[0], NOW)).toBe(72_000);
    expect(taskRunMs({ status: 'done', startedAt: 10, endedAt: 5_000, durationMs: 1_234 })).toBe(1_234);
    expect(taskRunMs({ status: 'paused', durationMs: 50_000 })).toBe(50_000);
    expect(taskRunMs({ status: 'running', durationMs: 9_000 })).toBe(9_000);
    expect(taskRunMs({ status: 'done', startedAt: 5_000, endedAt: 10 })).toBe(0);
    expect(taskRunMs({ status: 'done' })).toBe(0);
    expect(taskRunMs({ status: 'running', startedAt: NOW + 5_000 }, NOW)).toBe(0);
  });

  it('sums tokens of every kind and counts tool calls', () => {
    expect(taskRunTokenTotal(RUNS[0].tokens)).toBe(43_200);
    expect(taskRunTokenTotal({ input: 10, output: -5, cacheRead: Number.NaN })).toBe(10);
    expect(taskRunTokenTotal(undefined)).toBe(0);
    expect(taskRunToolCount(RUNS[0])).toBe(5);
    expect(taskRunToolCount(RUNS[1])).toBe(7);
    expect(taskRunToolCount({ toolCalls: 2, tools: [{ name: 'A', count: 9 }] })).toBe(2);
    expect(taskRunToolCount({ tools: [{ name: 'A', count: 1.6 }, null as never] })).toBe(2);
    expect(taskRunToolCount({})).toBe(0);
  });

  it('totals runs, tokens, tools, time and cost; knows when the time is live', () => {
    const all = taskRunTotals(RUNS, NOW);
    expect(all).toMatchObject({ runs: 3, tokens: 44_700, hasTokens: true, tools: 14, ms: 368_000, hasCost: true });
    expect(all.costUsd).toBeCloseTo(0.16, 10);
    expect(all.live).toBe(true);
    const quiet = taskRunTotals([RUNS[1], null as never], NOW);
    expect(quiet).toMatchObject({ runs: 1, tokens: 0, hasTokens: false, tools: 7, ms: 228_000, hasCost: false });
    expect(quiet.live).toBe(false);
    expect(taskRunTotals([{ id: 'x', title: 'x', status: 'done', costUsd: -3 }]).costUsd).toBe(0);
    expect(taskRunTotals([])).toMatchObject({ runs: 0, ms: 0, hasCost: false });
  });

  it('stamps a date and time, nothing without one', () => {
    expect(taskRunStamp(NOW)).toMatch(/^Oct 27, \d{1,2}:00 (AM|PM)$/);
    expect(taskRunStamp(NOW, 'ko')).toMatch(/^10월 27일 (오전|오후) \d{2}:00$/);
    expect(taskRunStamp(0)).toBe('');
  });
});

describe('<ui-task-runs> rendering', () => {
  it('renders nothing without data', () => {
    expect(q(mount(undefined), '.tr')).toBeNull();
  });

  it('draws a button row per run: ref, title, status icon + word, start, time, tokens, tool calls', () => {
    const el = mount(BASE);
    expect(text(q(el, '.tr-title'))).toBe('Task runs');
    expect(text(q(el, '.tr-count'))).toBe('3');
    expect(q(el, '.tr-list')?.getAttribute('aria-label')).toBe('Task runs');
    const rows = qa(el, '.tr-row');
    expect(rows.map((r) => r.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON']);
    expect(rows.map((r) => r.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false']);
    expect(rows.map((r) => r.getAttribute('aria-controls'))).toEqual(['tr-r-0', 'tr-r-1', 'tr-r-2']);
    expect(text(rows[0].querySelector('.tr-ref'))).toBe('#T1');
    expect(text(rows[0].querySelector('.tr-name'))).toBe('Reproduce the failing test');
    expect(rows.map((r) => r.querySelector('.pl-state')?.getAttribute('data-st'))).toEqual([
      'done',
      'dropped',
      'running',
    ]);
    expect(rows.map((r) => text(r.querySelector('.pl-state')))).toEqual(['Done', 'Dropped', 'Running']);
    expect(rows.every((r) => r.querySelector('.pl-state svg, .pl-state .pl-spin'))).toBe(true);
    const meta = rows.map((r) => Array.from(r.querySelectorAll('.tr-m')).map(text));
    expect(meta[0].slice(1)).toEqual(['1m 12s', '43.2K tokens', '5 tool calls']);
    expect(meta[0][0]).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    expect(meta[1].slice(1)).toEqual(['3m 48s', '7 tool calls']);
    expect(meta[2].slice(1)).toEqual(['1m 08s', '1.5K tokens', '2 tool calls']);
    expect(rows[2].querySelector('[data-since]')).not.toBeNull();
    expect(qa(el, '.tr-region').every((r) => r.hasAttribute('inert'))).toBe(true);
  });

  it('expands and collapses a run in place (0fr → 1fr) and reports ui-toggle; several can be open', () => {
    const el = mount(BASE);
    const seen: Array<{ detail: TaskRunToggle; cancelable: boolean }> = [];
    el.addEventListener('ui-toggle', (e) => {
      const ev = e as CustomEvent<TaskRunToggle>;
      seen.push({ detail: ev.detail, cancelable: ev.cancelable });
    });
    const li = run(el, 'T1');
    const btn = row(el, 'T1');
    const region = li.querySelector('.tr-region')!;
    btn.click();
    expect(seen).toEqual([{ detail: { id: 'T1', open: true }, cancelable: false }]);
    expect(run(el, 'T1')).toBe(li);
    expect(li.querySelector('.tr-region')).toBe(region);
    expect(li.hasAttribute('data-open')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(region.hasAttribute('inert')).toBe(false);
    expect(el.isOpen('T1')).toBe(true);
    row(el, 'T3').click();
    expect(qa(el, '.tr-run[data-open]').map((r) => r.dataset.id)).toEqual(['T1', 'T3']);
    btn.click();
    expect(seen.map((s) => s.detail)).toEqual([
      { id: 'T1', open: true },
      { id: 'T3', open: true },
      { id: 'T1', open: false },
    ]);
    expect(region.hasAttribute('inert')).toBe(true);
    expect(qa(el, '.tr-run[data-open]').map((r) => r.dataset.id)).toEqual(['T3']);
  });

  it('details a run: start, end, run time, tokens by kind, tools with counts, cost, Open', () => {
    const el = mount(BASE);
    el.setOpen('T1', true);
    el.renderNow();
    const li = run(el, 'T1');
    expect(Array.from(li.querySelectorAll('dt')).map(text)).toEqual([
      'Started',
      'Ended',
      'Took',
      'Tokens',
      'Tools',
      'Cost',
    ]);
    expect(text(dd(li, 'Started'))).toMatch(/^Oct 27, /);
    expect(text(dd(li, 'Took'))).toBe('1m 12s');
    expect(text(dd(li, 'Tokens')?.querySelector('.tr-tok-total'))).toBe('43.2K');
    expect(Array.from(dd(li, 'Tokens')!.querySelectorAll('.tr-part')).map(text)).toEqual([
      'in 1.8K',
      'out 900',
      'cache read 38.4K',
      'cache write 2.1K',
    ]);
    expect(Array.from(li.querySelectorAll('.tr-tool')).map(text)).toEqual(['Bash ×3', 'Read ×2']);
    expect(text(dd(li, 'Cost'))).toBe('$0.06');
    const open = li.querySelector<HTMLAnchorElement>('a.tr-open')!;
    expect(open.getAttribute('href')).toBe('https://example.com/runs/T1');
    expect(open.getAttribute('aria-label')).toBe('Open Reproduce the failing test');
  });

  it('details a dropped run with its revisions, and a running one as still running with a live time', () => {
    const el = mount(BASE);
    el.setOpen('T2', true);
    el.setOpen('T3', true);
    el.renderNow();
    const dropped = run(el, 'T2');
    expect(text(dd(dropped, 'Ended'))).toMatch(/· left the plan$/);
    expect(text(dd(dropped, 'Tools'))).toBe('7 tool calls');
    expect(dd(dropped, 'Tokens')).toBeNull();
    expect(dd(dropped, 'Cost')).toBeNull();
    const revs = Array.from(dropped.querySelectorAll('.tr-revs > li'));
    expect(revs).toHaveLength(2);
    expect(text(revs[0].querySelector('.tr-rev-at'))).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    expect(text(revs[0].querySelector('.tr-rev-note'))).toBe('Narrowed to rounding');
    expect(revs[1].querySelector('.tr-rev-at')).toBeNull();
    expect(dropped.querySelector('.tr-open')).toBeNull();
    const running = run(el, 'T3');
    expect(text(dd(running, 'Ended'))).toBe('Still running');
    expect(text(dd(running, 'Took'))).toBe('1m 08s');
    expect(Array.from(dd(running, 'Tokens')!.querySelectorAll('.tr-part')).map(text)).toEqual(['in 1K', 'out 500']);
    expect(running.querySelector('button.tr-open')).not.toBeNull();
    const paused = mount({
      runs: [{ id: 'p', title: 'P', status: 'paused', startedAt: NOW - 9_000, durationMs: 4_000 }],
    });
    paused.setOpen('p', true);
    paused.renderNow();
    expect(text(dd(run(paused, 'p'), 'Ended'))).toBe('Paused');
    expect(text(dd(run(paused, 'p'), 'Took'))).toBe('4s');
  });

  it('ticks run times and the total in place, and stops when disconnected', () => {
    const el = mount(BASE);
    el.setOpen('T3', true);
    el.renderNow();
    const rowTime = row(el, 'T3').querySelector('[data-since]')!;
    const took = dd(run(el, 'T3'), 'Took')!.querySelector('[data-since]')!;
    const total = q(el, '.tr-total-time')!;
    expect([rowTime.textContent, took.textContent, total.textContent]).toEqual(['1m 08s', '1m 08s', '6m 08s']);
    vi.advanceTimersByTime(3000);
    expect(row(el, 'T3').querySelector('[data-since]')).toBe(rowTime);
    expect(q(el, '.tr-total-time')).toBe(total);
    expect([rowTime.textContent, took.textContent, total.textContent]).toEqual(['1m 11s', '1m 11s', '6m 11s']);
    el.remove();
    vi.advanceTimersByTime(5000);
    expect(rowTime.textContent).toBe('1m 11s');
    expect(vi.getTimerCount()).toBe(0);
    // Nothing running: no timer at all.
    mount({ runs: RUNS.slice(0, 2) });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('corrects the clocks for the host’s clock skew (data.now)', () => {
    const el = mount({ runs: [RUNS[2]], now: NOW + 60_000 });
    expect(text(row(el, 'T3').querySelector('[data-since]'))).toBe('2m 08s');
    expect(text(q(el, '.tr-total-time'))).toBe('2m 08s');
  });

  it('sums the runs in a totals row; leaves out what no run carries; can be hidden', () => {
    const el = mount(BASE);
    expect(text(q(el, '.tr-total-k'))).toBe('Total');
    expect(qa(el, '.tr-total .tr-m').map(text)).toEqual(['3 runs', '44.7K tokens', '14 tool calls', '6m 08s', '$0.16']);
    const bare = mount({ runs: [RUNS[1]] });
    expect(qa(bare, '.tr-total .tr-m').map(text)).toEqual(['1 run', '7 tool calls', '3m 48s']);
    expect(q(mount({ ...BASE, totals: false }), '.tr-total')).toBeNull();
  });

  it('says when nothing has run yet', () => {
    const el = mount({ runs: [] });
    expect(text(q(el, '.tr-empty strong'))).toBe('No runs yet');
    expect(q(el, '.tr-empty svg')).not.toBeNull();
    expect(q(el, '.tr-total')).toBeNull();
    expect(q(el, '.tr-count')).toBeNull();
    expect(q(mount({ title: '', runs: [] }), '.tr-head')).toBeNull();
  });

  it('forgets open rows of runs that are gone', () => {
    const el = mount(BASE);
    row(el, 'T1').click();
    el.data = { runs: RUNS.slice(1) };
    el.renderNow();
    expect(el.isOpen('T1')).toBe(false);
    el.data = BASE;
    el.renderNow();
    expect(run(el, 'T1').hasAttribute('data-open')).toBe(false);
  });
});

describe('events', () => {
  it('sends a cancelable ui-open from an Open link; cancelling keeps the link from navigating', () => {
    const el = mount(BASE);
    el.setOpen('T1', true);
    el.renderNow();
    const seen: Array<{ detail: TaskRunOpen; cancelable: boolean }> = [];
    let prevent = true;
    el.addEventListener('ui-open', (e) => {
      const ev = e as CustomEvent<TaskRunOpen>;
      seen.push({ detail: ev.detail, cancelable: ev.cancelable });
      if (prevent) e.preventDefault();
    });
    const followed: boolean[] = [];
    document.addEventListener('click', (e) => {
      followed.push(!e.defaultPrevented);
      e.preventDefault(); // the test page itself never navigates
    });
    const link = run(el, 'T1').querySelector<HTMLAnchorElement>('a.tr-open')!;
    link.click();
    prevent = false;
    link.click();
    expect(seen).toEqual([
      { detail: { id: 'T1' }, cancelable: true },
      { detail: { id: 'T1' }, cancelable: true },
    ]);
    expect(followed).toEqual([false, true]);
    // Opening is not toggling.
    expect(el.isOpen('T1')).toBe(true);
  });

  it('sends ui-open from an Open button (canOpen)', () => {
    const el = mount(BASE);
    el.setOpen('T3', true);
    el.renderNow();
    const ids: string[] = [];
    el.addEventListener('ui-open', (e) => ids.push((e as CustomEvent<TaskRunOpen>).detail.id));
    run(el, 'T3').querySelector<HTMLButtonElement>('button.tr-open')!.click();
    expect(ids).toEqual(['T3']);
  });
});

describe('keyboard', () => {
  it('rows are one tab stop; ↑/↓ move between them (wrapping), Home/End to the ends', () => {
    const el = mount(BASE);
    const tabs = () => qa(el, '.tr-row').map((r) => r.tabIndex);
    const focused = () => (el.shadowRoot!.activeElement as HTMLElement | null)?.dataset.id;
    expect(tabs()).toEqual([0, -1, -1]);
    row(el, 'T1').focus();
    expect(key(row(el, 'T1'), 'ArrowDown').defaultPrevented).toBe(true);
    expect(focused()).toBe('T2');
    expect(tabs()).toEqual([-1, 0, -1]);
    key(row(el, 'T2'), 'ArrowDown');
    key(row(el, 'T3'), 'ArrowDown');
    expect(focused()).toBe('T1');
    key(row(el, 'T1'), 'ArrowUp');
    expect(focused()).toBe('T3');
    key(row(el, 'T3'), 'Home');
    expect(focused()).toBe('T1');
    key(row(el, 'T1'), 'End');
    expect(focused()).toBe('T3');
    expect(key(row(el, 'T3'), 'a').defaultPrevented).toBe(false);
    expect(focused()).toBe('T3');
    // The tab stop and focus survive new data.
    el.data = { runs: RUNS.map((r) => ({ ...r })) };
    el.renderNow();
    expect(focused()).toBe('T3');
    expect(tabs()).toEqual([-1, -1, 0]);
  });

  it('a clicked row takes the tab stop; a removed one gives it back to the first row', () => {
    const el = mount(BASE);
    row(el, 'T2').click();
    expect(qa(el, '.tr-row').map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
    el.data = { runs: [RUNS[0], RUNS[2]] };
    el.renderNow();
    expect(qa(el, '.tr-row').map((r) => r.tabIndex)).toEqual([0, -1]);
  });
});

describe('escaping', () => {
  it('escapes every host / model / tool string; unsafe links become #', () => {
    const el = mount({
      title: XSS,
      runs: [
        {
          id: XSS,
          ref: XSS,
          title: XSS,
          status: 'dropped',
          startedAt: NOW - 5_000,
          endedAt: NOW,
          tokens: { input: 1 },
          tools: [{ name: XSS, count: 1 }],
          revisions: [{ at: NOW, note: XSS }],
          href: 'javascript:alert(1)',
        },
        { id: `${XSS}2`, title: XSS, status: XSS as never, canOpen: true },
      ],
    });
    el.setOpen(XSS, true);
    el.setOpen(`${XSS}2`, true);
    el.renderNow();
    const html = el.shadowRoot!.innerHTML;
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    const all = Array.from(el.shadowRoot!.querySelectorAll('*'));
    expect(all.some((n) => n.getAttributeNames().some((a) => a.startsWith('on')))).toBe(false);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(text(q(el, '.tr-title'))).toBe(XSS);
    expect(run(el, XSS).dataset.id).toBe(XSS);
    expect(text(run(el, XSS).querySelector('.tr-name'))).toBe(XSS);
    expect(text(run(el, XSS).querySelector('.tr-tool-name'))).toBe(XSS);
    expect(text(run(el, XSS).querySelector('.tr-rev-note'))).toBe(XSS);
    expect(run(el, XSS).querySelector('a.tr-open')?.getAttribute('href')).toBe('#');
    expect(run(el, `${XSS}2`).querySelector('button.tr-open')?.getAttribute('aria-label')).toBe(`Open ${XSS}`);
    // An unknown status reads as done (never colour alone, never a blank chip).
    expect(text(run(el, `${XSS}2`).querySelector('.pl-state'))).toBe('Done');
  });
});

describe('lang="ko"', () => {
  it('uses Korean strings throughout', () => {
    const el = mount(BASE, { lang: 'ko' });
    el.setOpen('T1', true);
    el.setOpen('T2', true);
    el.renderNow();
    expect(text(q(el, '.tr-title'))).toBe('실행된 태스크');
    expect(qa(el, '.pl-state').map(text)).toEqual(['완료', '제외됨', '진행 중']);
    expect(Array.from(row(el, 'T1').querySelectorAll('.tr-m')).map(text).slice(1)).toEqual([
      '1m 12s',
      '토큰 43.2K',
      '툴 5회',
    ]);
    const li = run(el, 'T1');
    expect(Array.from(li.querySelectorAll('dt')).map(text)).toEqual(['시작', '종료', '소요', '토큰', '도구', '비용']);
    expect(Array.from(li.querySelectorAll('.tr-part')).map(text)).toEqual([
      '입력 1.8K',
      '출력 900',
      '캐시 읽기 38.4K',
      '캐시 쓰기 2.1K',
    ]);
    expect(text(li.querySelector('.tr-open'))).toBe('열기');
    expect(text(dd(run(el, 'T2'), '종료'))).toMatch(/· 계획에서 빠짐$/);
    expect(text(dd(run(el, 'T2'), '변경 기록')?.querySelector('.tr-rev-at'))).toMatch(/^(오전|오후) \d{2}:\d{2}$/);
    expect(qa(el, '.tr-total .tr-m').map(text)).toEqual(['실행 3', '토큰 44.7K', '툴 14회', '6m 08s', '$0.16']);
    expect(text(q(el, '.tr-total-k'))).toBe('합계');
    expect(text(q(mount({ runs: [] }, { lang: 'ko' }), '.tr-empty strong'))).toBe('아직 실행된 태스크가 없습니다');
  });

  it('switches language when the attribute changes', async () => {
    const el = mount(BASE);
    el.setAttribute('lang', 'ko');
    await Promise.resolve();
    expect(text(q(el, '.tr-total-k'))).toBe('합계');
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    vi.useRealTimers(); // settle() waits real time
    spy = soundSpy();
  });
  afterEach(() => spy.restore());
  const tap = (n: Element | null, detail = 1) =>
    n!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail }));

  it('a row opens / closes its detail; Open → navigate', async () => {
    const el = mount(BASE);
    tap(row(el, 'T3'));
    await spy.settle();
    tap(row(el, 'T3'), 0);
    await spy.settle();
    el.setOpen('T3', true);
    el.renderNow();
    tap(run(el, 'T3').querySelector('button.tr-open'));
    await spy.settle();
    expect(spy.calls).toEqual([
      ['open', { emphasis: 'subtle', input: 'mouse' }],
      ['close', { emphasis: 'subtle', input: 'keyboard' }],
      ['navigate', { input: 'mouse' }],
    ]);
  });

  it('nothing for a prevented ui-open, setOpen() / data from the app, or a data-ui-sound="off" region', async () => {
    const el = mount(BASE);
    el.setOpen('T3', true);
    el.data = { runs: RUNS.map((r) => ({ ...r, status: 'done' as const })) };
    el.renderNow();
    el.addEventListener('ui-open', (e) => e.preventDefault());
    tap(run(el, 'T3').querySelector('button.tr-open'));
    await spy.settle();
    expect(spy.calls).toEqual([]);
    const quiet = document.createElement('div');
    quiet.setAttribute('data-ui-sound', 'off');
    document.body.append(quiet);
    quiet.append(el);
    tap(row(el, 'T1'));
    await spy.settle();
    expect(spy.calls).toEqual([]);
  });
});
