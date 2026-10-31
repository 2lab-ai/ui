import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import { capacityNews, laneNews, type UiAgentQueue } from './agent-queue';
import {
  type AgentQueueData,
  type AqAccount,
  type AqJob,
  type AqProvider,
  type AqRun,
  accountStacks,
  advanceProvider,
  dayRuns,
  fmtCount,
  fmtPct,
  nextRefill,
  niceMax,
  normalize,
  orderJobs,
  plain,
  poolState,
  runBins,
  runKind,
  scheduleLabel,
  stripFolds,
  timelineMarks,
  toMs,
  upNext,
} from './logic';
import { STRINGS, timeText } from './strings';

const NOW = Date.UTC(2026, 9, 27, 3, 0, 0);
const S = 1000;
const M = 60_000;
const H = 3_600_000;
const D = 86_400_000;
const XSS = '<img src=x onerror=alert(1)>';
const XSS_ATTR = '"><img src=x onerror=alert(1)>';

function claude(over: Partial<AqProvider> = {}): AqProvider {
  return {
    id: 'claude',
    name: 'Claude',
    source: 'llmux',
    total: 4,
    fiveHour: 1.5,
    weekly: 2,
    measuredAt: NOW - 4 * H - 5 * M,
    accounts: [
      { id: 'ai7', name: 'ai7', state: 'available', binding: '5h', tier: 'Max x20', fiveHour: 0.4, weekly: 0.6 },
      { id: 'ai3', name: 'ai3', state: 'available', binding: '7d', fiveHour: 0.9, weekly: 0.5 },
      { id: 'ai43', name: 'ai43', state: 'limited', reason: 'weekly', returnAt: NOW + 7 * H + 22 * M + 30 * S },
      { id: 'icedac', name: 'icedac', state: 'paused', reason: 'paused' },
    ],
    refills: [
      { at: NOW + 22 * M + 30 * S, cause: '5h', fiveHour: 0.4, weekly: 0, account: 'ai7' },
      { at: NOW + 7 * H + 22 * M + 30 * S, cause: '7d', fiveHour: 1, weekly: 1, account: 'ai43' },
    ],
    ...over,
  };
}

/** The 20 llmux accounts of the 2026-10-30 dashboard screenshot, in llmux order. */
function twenty(): AqAccount[] {
  const ok = (name: string, binding: '5h' | '7d'): AqAccount => ({ id: name, name, state: 'available', binding });
  const cool = (name: string, back?: number): AqAccount => ({
    id: name,
    name,
    state: 'limited',
    reason: 'cooldown',
    ...(back ? { returnAt: NOW + back } : {}),
  });
  const weekly = (name: string, back: number): AqAccount => ({
    id: name,
    name,
    state: 'limited',
    reason: 'weekly',
    returnAt: NOW + back,
  });
  const held = (name: string, reason: 'auth' | 'paused'): AqAccount => ({ id: name, name, state: 'paused', reason });
  return [
    ok('ai5', '7d'),
    ok('ai6', '5h'),
    ok('ai4', '7d'),
    ok('ai2', '5h'),
    held('ai8', 'auth'),
    cool('ai3'),
    cool('ai7'),
    cool('ai15'),
    cool('ai40', 13 * H + 38 * M + 30 * S),
    cool('ai30'),
    weekly('ai43', 4 * D + 2 * H + 30 * S),
    cool('ai41'),
    cool('info'),
    cool('dev1'),
    held('icedac', 'paused'),
    cool('ai'),
    cool('ai44'),
    held('z', 'paused'),
    cool('ai16', 14 * H + 38 * M + 30 * S),
    weekly('ai17', 38 * M + 30 * S),
  ];
}

/** Mount at a given element width (the strip fits itself to it). */
function mountAt(width: number, data: AgentQueueData, attrs: Record<string, string> = {}): UiAgentQueue {
  const el = document.createElement('ui-agent-queue') as UiAgentQueue;
  Object.defineProperty(el, 'clientWidth', { value: width });
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const names = (box: Element) =>
  Array.from(box.querySelectorAll('.aq-mark')).map((m) => m.textContent?.replace(/\s+/g, ' ').trim());

function jobs(): AqJob[] {
  return [
    {
      id: 'audit',
      name: 'dependency-audit',
      expression: '0 */6 * * *',
      nextRunAt: NOW + 2 * H + 12 * M + 30 * S,
      runs: [
        { at: NOW - 3 * H, status: 'ok' },
        { at: NOW - 9 * H, status: 'failed', error: 'npm audit timed out' },
      ],
    },
    {
      id: 'sweep',
      name: 'pr-sweeper',
      schedule: 'Every 30 min',
      nextRunAt: NOW + 18 * M + 30 * S,
      state: 'running',
      runs: [
        { at: NOW - 4 * M, status: 'running' },
        { at: NOW - 34 * M, status: 'ok' },
        { at: NOW - 64 * M, status: 'unknown', label: 'DM sent (no session)' },
      ],
    },
    {
      id: 'digest',
      name: 'morning-digest',
      nextRunAt: NOW + 21 * H,
      state: 'waiting',
      runs: [{ at: NOW - 3 * H, status: 'waiting' }],
    },
  ];
}

function mount(data: AgentQueueData, attrs: Record<string, string> = {}): UiAgentQueue {
  const el = document.createElement('ui-agent-queue') as UiAgentQueue;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = (el: UiAgentQueue, s: string) => el.shadowRoot!.querySelector<HTMLElement>(s);
const qa = (el: UiAgentQueue, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const text = (el: UiAgentQueue, s: string) => q(el, s)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const key = (k: string) => new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true });

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  vi.useRealTimers();
});

describe('units and time text', () => {
  it('converts epoch seconds once, at the boundary', () => {
    expect(toMs(1_793_000_000, 's')).toBe(1_793_000_000_000);
    expect(toMs(5, 'ms')).toBe(5);
    expect(toMs('x')).toBeUndefined();
    const sec = normalize({
      timeUnit: 's',
      now: NOW / 1000,
      providers: [claude({ refills: [{ at: (NOW + H) / 1000, cause: '5h', fiveHour: 1 }] })].map((p) => ({
        ...p,
        measuredAt: (p.measuredAt as number) / 1000,
        accounts: p.accounts?.map((a) => ({ ...a, returnAt: a.returnAt && a.returnAt / 1000 })),
      })),
      lane: {
        jobs: [{ id: 'a', name: 'a', nextRunAt: (NOW + M) / 1000, runs: [{ at: (NOW - M) / 1000, status: 'ok' }] }],
      },
    });
    expect(sec.now).toBe(NOW);
    expect(sec.providers?.[0].refills?.[0].at).toBe(NOW + H);
    expect(sec.providers?.[0].accounts?.[2].returnAt).toBe(NOW + 7 * H + 22 * M + 30 * S);
    expect(sec.lane?.jobs[0].nextRunAt).toBe(NOW + M);
    expect(sec.lane?.jobs[0].runs?.[0].at).toBe(NOW - M);
  });

  it('renders the same countdown from seconds and from milliseconds', () => {
    const ms = mount({ now: NOW, providers: [claude()] });
    const p = claude();
    const s = mount({
      now: NOW / 1000,
      timeUnit: 's',
      providers: [
        {
          ...p,
          measuredAt: (p.measuredAt as number) / 1000,
          refills: p.refills?.map((e) => ({ ...e, at: e.at / 1000 })),
          accounts: p.accounts?.map((a) => ({ ...a, returnAt: a.returnAt && a.returnAt / 1000 })),
        },
      ],
    });
    expect(text(ms, '.aq-pill')).toBe('⏸ Limited 1 · back in 7h 22m');
    expect(text(s, '.aq-pill')).toBe(text(ms, '.aq-pill'));
    expect(text(s, '.cap-disc')).toBe(text(ms, '.cap-disc'));
  });

  it('floors time left and never says “in soon”', () => {
    const en = STRINGS.en;
    const ko = STRINGS.ko;
    expect(timeText('left', NOW + D + 5 * H + 59 * M, NOW, en)).toBe('1d 5h');
    expect(timeText('left', NOW + H + 20 * M + 59 * S, NOW, en)).toBe('1h 20m');
    expect(timeText('left', NOW + 24 * M + 59 * S, NOW, en)).toBe('24m');
    expect(timeText('left', NOW + 42 * S, NOW, en)).toBe('42s');
    expect(timeText('in', NOW, NOW, en)).toBe('soon');
    expect(timeText('back', NOW + 24 * M, NOW, en)).toBe('back in 24m');
    expect(timeText('back', NOW - 1, NOW, en)).toBe('back soon');
    expect(timeText('back', NOW + 24 * M, NOW, ko)).toBe('24분 후 복귀');
    expect(timeText('back', NOW, NOW, ko)).toBe('곧 복귀');
    expect(timeText('in', NOW + D + 5 * H, NOW, ko)).toBe('1일 5시간 후');
    expect(timeText('since', NOW - 11 * M, NOW, en)).toBe('11m ago');
    // The since phrase in Korean too (0.15.2): the cron lane's 'ago' was '1d 0h 전' on a Korean board.
    expect(timeText('since', NOW - 11 * M, NOW, ko)).toBe('11분 전');
    expect(timeText('since', NOW - 30 * S, NOW, ko)).toBe('방금 전');
    expect(timeText('since', NOW - (3 * H + 5 * M), NOW, ko)).toBe('3시간 5분 전');
    expect(timeText('since', NOW - D, NOW, ko)).toBe('1일 0시간 전');
    for (const ms of [30 * S, 11 * M, 3 * H, D + 6 * H])
      expect(timeText('since', NOW - ms, NOW, ko)).not.toMatch(/[A-Za-z]/);
    expect(timeText('fetched', NOW - 12 * S, NOW, ko)).toBe('12초 전 갱신');
  });
});

describe('capacity math', () => {
  it('derives the pool state from the primary measure (5-hour, else weekly)', () => {
    expect(poolState({ id: 'a', name: 'a', total: 0, weekly: 0 })).toBe('unknown');
    expect(poolState({ id: 'a', name: 'a', total: 4, fiveHour: 0, weekly: 3 })).toBe('empty');
    expect(poolState({ id: 'a', name: 'a', total: 4, fiveHour: 0.7, weekly: 3 })).toBe('low');
    expect(poolState({ id: 'a', name: 'a', total: 4, weekly: 0.9 })).toBe('ok');
    expect(poolState({ id: 'a', name: 'a', total: 4, weekly: 0.9, state: 'low' })).toBe('low');
  });

  it('folds refills whose time has come into the measures', () => {
    const p = advanceProvider(claude(), NOW + 30 * M);
    expect(p.fiveHour).toBeCloseTo(1.9);
    expect(p.weekly).toBe(2);
    expect(p.refills).toHaveLength(1);
  });

  it('finds the next gain ≥ 0.05 within 7 days', () => {
    const p = claude({
      refills: [
        { at: NOW + M, cause: '5h', fiveHour: 0.01 },
        { at: NOW + 2 * M, cause: '5h', fiveHour: 0.3 },
        { at: NOW + 8 * D, cause: '7d', weekly: 1 },
      ],
    });
    expect(nextRefill(p, 'fiveHour', NOW)?.at).toBe(NOW + 2 * M);
    expect(nextRefill(p, 'weekly', NOW)).toBeNull();
  });

  it('keeps counts honest: never “2.4 / 2.4 99%”', () => {
    expect(fmtCount(2.37, 2.4)).toBe('2.37');
    expect(fmtCount(3.5, 16)).toBe('3.5');
    expect(fmtPct(3.5, 16)).toBe('22%');
    expect(fmtPct(2.39, 2.4)).toBe('99%');
    expect(fmtPct(2.399, 2.4)).toBe('100%');
    expect(fmtPct(2.4, 2.4)).toBe('100%');
    expect(fmtPct(1, 0)).toBe('—');
  });

  it('merges close timeline marks of one kind', () => {
    const p = claude({
      refills: [
        { at: NOW + 20 * M, cause: '5h', fiveHour: 0.4, account: 'a' },
        { at: NOW + 25 * M, cause: '5h', fiveHour: 0.2, account: 'b' },
        { at: NOW + 3 * D, cause: '7d', weekly: 1, account: 'c' },
      ],
    });
    const marks = timelineMarks(p, 900, NOW);
    expect(marks.map((m) => [m.c, Number(m.gain.toFixed(1)), m.names.join(',')])).toEqual([
      ['h5', 0.6, 'a,b'],
      ['wk', 1, 'c'],
    ]);
  });
});

describe('lane math', () => {
  it('counts run records only; unknown results apart, never as success', () => {
    const d = dayRuns({ jobs: jobs() }, NOW);
    expect([d.n, d.ok, d.fail, d.run, d.unknown]).toEqual([5, 2, 1, 2, 1]);
    expect(runKind('unknown')).toBe('unknown');
    expect(runKind('whatever')).toBe('unknown');
    const bins = runBins(d, NOW);
    expect(bins).toHaveLength(24);
    expect(bins.reduce((t, b) => t + b.ok + b.run + b.fail, 0)).toBe(d.n);
  });

  it('turns counts into lower bounds when a capped history starts inside the window', () => {
    const runs = Array.from({ length: 20 }, (_, i) => ({ at: NOW - i * 15 * M, status: 'ok' as const }));
    const d = dayRuns({ jobs: [{ id: 'p', name: 'poll', historyCap: 20, runs }] }, NOW);
    expect(d.cut).toHaveLength(1);
    expect(d.cutFrom).toBe(NOW - 19 * 15 * M);
    expect(dayRuns({ jobs: [{ id: 'p', name: 'poll', runs }] }, NOW).cut).toHaveLength(0);
  });

  it('uses runs24h when given', () => {
    const d = dayRuns({ jobs: jobs(), runs24h: [{ at: NOW - H, status: 'failed' }] }, NOW);
    expect([d.n, d.fail]).toEqual([1, 1]);
  });

  it('orders the lane and the up-next queue', () => {
    expect(orderJobs(jobs()).map((j) => j.id)).toEqual(['digest', 'sweep', 'audit']);
    expect(upNext(jobs()).map((j) => j.id)).toEqual(['sweep', 'audit', 'digest']);
    expect(niceMax(0)).toBe(4);
    expect(niceMax(13)).toBe(16);
  });

  it('says common schedules in words', () => {
    expect(scheduleLabel('*/15 * * * *', undefined)).toBe('Every 15 min');
    expect(scheduleLabel('*/15 * * * *', undefined, 'ko')).toBe('15분마다');
    expect(scheduleLabel('0 */6 * * *', undefined, 'ko')).toBe('6시간마다');
    expect(scheduleLabel('0 12-20 25 10 *', undefined)).toBe('0 12-20 25 10 *');
  });

  it('makes one plain line for the live region', () => {
    expect(plain('a\n\tb\u0007  c', 0)).toBe('a b c');
    expect(plain('x'.repeat(100), 10)).toBe(`${'x'.repeat(9)}…`);
  });
});

describe('<ui-agent-queue> capacity', () => {
  it('renders nothing without data and hides an absent section', () => {
    const el = mount(undefined as unknown as AgentQueueData);
    expect(q(el, '.aq')).toBeNull();
    const lane = mount({ now: NOW, lane: { jobs: jobs() } });
    expect(q(lane, '.capacity')).toBeNull();
    expect(q(lane, '.aq-lane')).not.toBeNull();
  });

  it('draws the provider card: head, disclosure, two bars, marks, timeline', () => {
    const el = mount({ now: NOW, providers: [claude()], fetchedAt: NOW - 12 * S });
    expect(text(el, '.cap-sub')).toBe('updated 12s ago');
    expect(text(el, '.cap-pname')).toBe('Claude');
    expect(text(el, '.aq-name')).toBe('llmux · 4 accounts');
    expect(text(el, '.cap-disc')).toBe('3/4 reflected (1 limited incl.) · excluded 1 (held) · measured 4h ago');
    const rows = qa(el, '.cap-bar-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('.cap-bar-val')?.textContent).toBe('1.5 / 4.0 accounts 38%');
    expect(rows[0].querySelector('.cap-bar-next')?.textContent).toBe('next +0.4 · in 22m');
    expect(rows[1].querySelector('.cap-bar-next')?.textContent).toBe('next +1.0 · in 7h 22m');
    expect(qa(el, '.cap-low')).toHaveLength(2);
    expect(q(el, '.cap-bar')?.getAttribute('aria-label')).toBe('5-hour 1.5 of 4.0 accounts, 38%');
    expect(text(el, '.aq-workers .aq-col-head')).toBe('Accounts 2/4');
    // The head sits on the badges' own row.
    expect(q(el, '.aq-marks')?.firstElementChild?.className).toBe('aq-col-head');
    const marks = qa(el, '.aq-mark');
    expect(marks.map((m) => m.className)).toEqual([
      'aq-mark is-available',
      'aq-mark is-available',
      'aq-mark is-limited',
      'aq-mark is-paused',
    ]);
    // A badge is its name: the reason and the return live in the label, the title and the card.
    expect(marks[2].textContent).toBe('ai43');
    expect(marks[2].getAttribute('aria-label')).toBe('ai43, weekly limit, back in 7h 22m');
    expect(marks[2].getAttribute('title')).toBe('ai43 · weekly limit · back in 7h 22m');
    expect(marks[3].textContent).toBe('icedac');
    expect(marks[3].getAttribute('title')).toBe('icedac · paused');
    expect(qa(el, '.aq-stack').map((s) => s.className)).toEqual(['aq-stack is-warn', 'aq-stack is-mute']);
    expect(q(el, '.aq-wdot.is-h5')).not.toBeNull();
    expect(qa(el, '.cap-tl circle')).toHaveLength(1);
    expect(qa(el, '.cap-tl-mk rect')).toHaveLength(1);
    expect(qa(el, '.cap-tl-ax').map((t) => t.textContent)).toEqual(['now', '1h', '6h', '24h', '3d', '5d', '7d']);
  });

  it('shows one bar for a weekly-only provider and flags a reading over a day old', () => {
    const el = mount({
      now: NOW,
      providers: [{ id: 'codex', name: 'Codex', total: 3.2, weekly: 2.4, measuredAt: NOW - 6 * D }],
    });
    expect(qa(el, '.cap-bar-row')).toHaveLength(1);
    expect(text(el, '.cap-stale')).toBe('⚠ measured 6d ago');
    expect(text(el, '.aq-pill')).toBe('● Available');
  });

  it('says all limited, counts down to the first return and shades the timeline', () => {
    const el = mount({
      now: NOW,
      providers: [
        {
          id: 'c',
          name: 'Claude',
          total: 2,
          fiveHour: 0,
          weekly: 0.3,
          accounts: [
            { id: 'a', name: 'a', state: 'limited', reason: '5h', returnAt: NOW + 22 * M + 30 * S },
            { id: 'b', name: 'b', state: 'limited', reason: 'cooldown', returnAt: NOW + 2 * H },
          ],
          refills: [{ at: NOW + 22 * M + 30 * S, cause: 'release', fiveHour: 0.8 }],
        },
      ],
    });
    expect(text(el, '.aq-pill')).toBe('✗ All limited · back in 22m');
    expect(q(el, '.cap-prov')?.classList.contains('is-empty')).toBe(true);
    expect(q(el, '.cap-tl-lim title')?.textContent).toMatch(/^All limited — until /);
  });

  it("says it can't compute a pool with no countable account", () => {
    const el = mount({
      now: NOW,
      providers: [{ id: 'g', name: 'Gemini', total: 0, accounts: [{ id: 'g1', name: 'g1', state: 'excluded' }] }],
    });
    expect(text(el, '.aq-pill')).toBe('◌ Can’t compute');
    expect(text(el, '.cap-bar-next')).toBe('Can’t compute — no countable accounts');
    expect(qa(el, '.cap-bar')).toHaveLength(0);
  });

  it('shows the capacity error instead of the cards', () => {
    const el = mount({ capacityError: 'ECONNREFUSED', providers: [claude()] });
    expect(text(el, '.cap-off')).toBe('Couldn’t load capacity — ECONNREFUSED');
    expect(q(el, '.cap-prov')).toBeNull();
  });
});

describe('<ui-agent-queue> lane', () => {
  it('draws four stats, the queue, job cards and a 24-hour chart', () => {
    const el = mount({ now: NOW, lane: { jobs: jobs() } });
    expect(text(el, '.aq-lane-title')).toBe('CRON');
    expect(text(el, '.aq-count')).toBe('3');
    expect(qa(el, '.aq-lane-head .aq-pill').map((p) => p.textContent)).toEqual(['● Running 1', '▲ Needs reply 1']);
    const dd = qa(el, '.aq-stat dd').map((d) => d.textContent);
    expect(dd).toEqual(['in 18mpr-sweeper', '1/3', '5+1 unknown', '1']);
    expect(q(el, '.aq-stat[data-kind="failed"]')).not.toBeNull();
    expect(qa(el, '.aq-q .aq-q-name').map((n) => n.textContent)).toEqual([
      'pr-sweeper',
      'dependency-audit',
      'morning-digest',
    ]);
    expect(qa(el, '.cron-group .cron-name').map((n) => n.textContent)).toEqual([
      'morning-digest',
      'pr-sweeper',
      'dependency-audit',
    ]);
    expect(q(el, '.cron-group')?.classList.contains('is-waiting')).toBe(true);
    const audit = qa(el, '.cron-group')[2];
    expect(audit.querySelector('.cron-expr')?.textContent).toBe('Every 6 h');
    expect(audit.querySelector('.cron-history-btn')?.textContent).toBe('Past runs 2');
    expect(Array.from(audit.querySelectorAll('.cr-tick')).map((t) => t.className)).toEqual([
      'cr-tick is-fail',
      'cr-tick is-ok',
    ]);
    const sweep = qa(el, '.cron-group')[1];
    expect(Array.from(sweep.querySelectorAll('.cr-tick')).map((t) => t.className)).toEqual([
      'cr-tick is-none',
      'cr-tick is-ok',
      'cr-tick is-run',
    ]);
    expect(sweep.querySelector('.cron-strip')?.getAttribute('aria-label')).toBe(
      'pr-sweeper: last 3 runs (1 ok, 1 in progress, 1 unknown) — show past runs',
    );
    expect(qa(el, '.aq-ch-col')).toHaveLength(24);
    const said = q(el, '.aq-plot')?.getAttribute('aria-label') ?? '';
    expect(said).toContain('5 cron run records in the last 24 hours: 2 ok, 1 failed, 2 in progress');
    expect(said).toContain('1 runs with an unknown result are not counted.');
  });

  it('shows +N past four queued jobs', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ id: `j${i}`, name: `job-${i}`, nextRunAt: NOW + (i + 1) * M }));
    const el = mount({ now: NOW, lane: { jobs: many } });
    expect(qa(el, '.aq-q')).toHaveLength(4);
    expect(text(el, '.aq-more')).toBe('+2');
    expect(text(el, '.aq-queue .aq-col-head b')).toBe('6');
  });

  it('marks lower bounds and hatches the truncated stretch', () => {
    const runs = Array.from({ length: 20 }, (_, i) => ({ at: NOW - i * 15 * M - S, status: 'ok' as const }));
    const el = mount({ now: NOW, lane: { jobs: [{ id: 'p', name: 'poll', historyCap: 20, runs }] } });
    expect(qa(el, '.aq-stat dd')[2].textContent).toBe('≥20');
    expect(q(el, '.aq-ch-cut')).not.toBeNull();
  });

  it('says so when nothing is scheduled', () => {
    const el = mount({ now: NOW, lane: { jobs: [] } });
    expect(text(el, '.aq-empty')).toBe('Nothing scheduled');
    expect(qa(el, '.aq-stat dd')[0].textContent).toBe('—');
    expect(q(el, '.cron-groups')).toBeNull();
  });
});

describe('escaping', () => {
  it('rejects host enum values it does not know (state cannot inject attributes)', () => {
    const p = claude({
      state: XSS_ATTR as never,
      accounts: [{ id: 'a1', name: 'acct', state: XSS_ATTR as never }],
    });
    const el = mount({ now: NOW, providers: [p] });
    const root = el.shadowRoot!;
    expect(root.querySelector('[onerror], [onmouseover], img')).toBeNull();
    expect(root.querySelector('.cap-prov')?.className).not.toContain('"');
    expect(root.querySelector('.aq-mark')?.className).toBe('aq-mark is-unmeasured');
  });

  it('drops timestamps outside the Date range instead of throwing', () => {
    expect(() =>
      mount({
        now: NOW,
        providers: [claude({ measuredAt: 9e15, accounts: [{ id: 'x', name: 'x', state: 'limited', returnAt: 9e15 }] })],
      }),
    ).not.toThrow();
  });

  it('escapes every host-written string, in text and in attributes', () => {
    const p = claude({
      id: XSS_ATTR,
      name: XSS,
      source: XSS,
      accounts: [
        {
          id: XSS_ATTR,
          name: XSS,
          state: 'limited',
          reason: XSS,
          tier: XSS,
          returnAt: NOW + H,
        },
        { id: 'ok', name: XSS_ATTR, state: 'available' },
      ],
      refills: [{ at: NOW + H, cause: '5h', fiveHour: 1, account: XSS }],
    });
    const el = mount({
      now: NOW,
      capacityNote: XSS,
      providers: [p],
      lane: {
        title: XSS,
        jobs: [
          {
            id: XSS_ATTR,
            name: XSS,
            schedule: XSS,
            expression: XSS_ATTR,
            nextRunAt: NOW + M,
            runs: [{ at: NOW - M, status: 'failed', label: XSS, error: XSS }],
          },
          { id: 'b', name: XSS_ATTR, expression: XSS, nextRunAt: NOW + 2 * M },
        ],
      },
    });
    (qa(el, '.aq-mark').find((m) => m.dataset.aid === XSS_ATTR) as HTMLButtonElement).click();
    expect(q(el, '.aq-pop')).not.toBeNull();
    // No element was injected and no handler attribute exists (attribute values may contain a literal `<`).
    expect(q(el, 'img')).toBeNull();
    expect(q(el, '[onerror]')).toBeNull();
    expect(qa(el, '*').every((n) => ['img', 'script'].indexOf(n.localName) < 0)).toBe(true);
    expect(text(el, '.cap-pname')).toBe(XSS);
    expect(text(el, '.cap-sub')).toBe(XSS);
    expect(text(el, '.aq-lane-title')).toBe(XSS);
    expect(text(el, '.aq-pop-name')).toBe(XSS);
    expect(qa(el, '.aq-q')[0].dataset.job).toBe(XSS_ATTR);
    // happy-dom's ShadowRoot.activeElement throws while focus sits in another component's shadow root.
    (el.shadowRoot!.activeElement as HTMLElement | null)?.blur();
    const errEl = mount({ capacityError: XSS });
    expect(q(errEl, 'img')).toBeNull();
    expect(text(errEl, '.cap-off')).toContain(XSS);
  });

  it('writes the live region as text only', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const el = mount({ providers: [claude({ name: `<b>${XSS}</b>` })] });
    el.data = { providers: [claude({ name: `<b>${XSS}</b>`, fiveHour: 0, weekly: 0, state: 'empty' })] };
    el.renderNow();
    vi.advanceTimersByTime(80);
    const live = el.shadowRoot!.querySelector('[aria-live="polite"]')!;
    expect(live.children).toHaveLength(0);
    expect(live.textContent).toContain('<b><img src=x onerror=alert(1)></b>: all accounts limited — back in 7h 22m');
  });
});

describe('events', () => {
  it('emits ui-job-open from a queue chip, the past-runs button and the run strip', () => {
    const el = mount({ now: NOW, lane: { jobs: jobs() } });
    const got: string[] = [];
    el.addEventListener('ui-job-open', (e) => got.push((e as CustomEvent<{ jobId: string }>).detail.jobId));
    q(el, '.aq-q')!.click();
    qa(el, '.cron-history-btn')[2].click();
    qa(el, '.cron-strip')[1].click();
    expect(got).toEqual(['sweep', 'audit', 'sweep']);
  });

  it('emits ui-account-open and opens the account card; Esc closes and refocuses the mark', () => {
    const el = mount({ now: NOW, providers: [claude()] });
    const fired = vi.fn();
    el.addEventListener('ui-account-open', (e) => fired((e as CustomEvent).detail));
    const mark = qa(el, '.aq-mark')[2];
    mark.focus();
    mark.click();
    expect(fired).toHaveBeenCalledWith({ providerId: 'claude', accountId: 'ai43' });
    const pop = q(el, '.aq-pop[role="dialog"]');
    expect(pop?.getAttribute('aria-label')).toBe('ai43 details');
    expect(qa(el, '.aq-pop-stats dt').map((d) => d.textContent)).toEqual([
      'Available now',
      'Left this week',
      'State',
      'Returns',
    ]);
    expect(qa(el, '.aq-mark')[2].getAttribute('aria-expanded')).toBe('true');
    q(el, '.aq-pop-close')!.focus();
    q(el, '.aq-pop-close')!.dispatchEvent(key('Escape'));
    expect(q(el, '.aq-pop')).toBeNull();
    expect(el.shadowRoot!.activeElement?.getAttribute('data-aid')).toBe('ai43');
  });

  it('keeps the built-in card closed when ui-account-open is cancelled', () => {
    const el = mount({ now: NOW, providers: [claude()] });
    el.addEventListener('ui-account-open', (e) => e.preventDefault());
    qa(el, '.aq-mark')[0].click();
    expect(q(el, '.aq-pop')).toBeNull();
  });

  it('closes the card from its close button, a second press, and an outside click', () => {
    const el = mount({ now: NOW, providers: [claude()] });
    qa(el, '.aq-mark')[0].click();
    q(el, '.aq-pop-close')!.click();
    expect(q(el, '.aq-pop')).toBeNull();
    qa(el, '.aq-mark')[0].click();
    qa(el, '.aq-mark')[0].click();
    expect(q(el, '.aq-pop')).toBeNull();
    qa(el, '.aq-mark')[0].click();
    document.body.click();
    expect(q(el, '.aq-pop')).toBeNull();
  });

  it('closes the card when its account leaves the data', () => {
    const el = mount({ now: NOW, providers: [claude()] });
    qa(el, '.aq-mark')[2].click();
    expect(q(el, '.aq-pop')).not.toBeNull();
    const p = claude();
    el.data = { now: NOW, providers: [{ ...p, accounts: p.accounts?.filter((a) => a.id !== 'ai43') }] };
    el.renderNow();
    expect(q(el, '.aq-pop')).toBeNull();
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    spy = soundSpy();
  });
  afterEach(() => spy.restore());
  const press = (t: Element, detail = 1) =>
    t.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail }));
  const FOLDS: AgentQueueData = {
    now: NOW,
    providers: [claude()],
    lane: { jobs: jobs() },
    collapsible: true,
    collapsed: { capacity: true },
  };

  it('a fold toggle plays a subtle open when it unfolds, close when it folds', async () => {
    const el = mount(FOLDS);
    press(q(el, '.cap-head .aq-fold')!);
    await spy.settle();
    press(q(el, '.aq-lane-head .aq-fold')!, 0);
    await spy.settle();
    expect(spy.calls).toEqual([
      ['open', { emphasis: 'subtle', input: 'mouse' }],
      ['close', { emphasis: 'subtle', input: 'keyboard' }],
    ]);
  });

  it('an account mark opens its card (open); the close button, Esc or a second press close it (close)', async () => {
    const el = mount({ now: NOW, providers: [claude()] });
    const steps: Array<() => void> = [
      () => press(qa(el, '.aq-mark')[2]),
      () => press(q(el, '.aq-pop-close')!, 0),
      () => press(qa(el, '.aq-mark')[2]),
      () => q(el, '.aq-pop-close')!.dispatchEvent(key('Escape')),
      () => press(qa(el, '.aq-mark')[0]),
      () => press(qa(el, '.aq-mark')[0]),
      () => press(qa(el, '.aq-mark')[0]),
      () => document.body.click(),
    ];
    for (const step of steps) {
      step();
      await spy.settle();
    }
    expect(q(el, '.aq-pop')).toBeNull();
    expect(spy.calls).toEqual([
      ['open', { input: 'mouse' }],
      ['close', { input: 'keyboard' }],
      ['open', { input: 'mouse' }],
      ['close', { input: 'keyboard' }],
      ['open', { input: 'mouse' }],
      ['close', { input: 'mouse' }],
      ['open', { input: 'mouse' }],
    ]);
  });

  it('opening a job plays navigate', async () => {
    const el = mount({ now: NOW, lane: { jobs: jobs() } });
    press(q(el, '.aq-q')!);
    await spy.settle();
    expect(spy.calls).toEqual([['navigate', { input: 'mouse' }]]);
  });

  it('a cancelled ui-collapse, ui-account-open or ui-job-open, or data from code plays nothing', async () => {
    const el = mount(FOLDS);
    for (const n of ['ui-collapse', 'ui-account-open', 'ui-job-open'])
      el.addEventListener(n, (e) => e.preventDefault());
    press(q(el, '.cap-head .aq-fold')!);
    press(q(el, '.aq-lane-head .aq-fold')!);
    press(q(el, '.aq-q')!);
    el.data = { ...FOLDS, collapsed: { capacity: false, lane: true } };
    el.renderNow();
    press(qa(el, '.aq-mark')[2]);
    await spy.settle();
    expect(q(el, '.aq-pop')).toBeNull();
    expect(spy.calls).toEqual([]);
  });

  it('is silent inside data-ui-sound="off"', async () => {
    const wrap = document.createElement('div');
    wrap.setAttribute('data-ui-sound', 'off');
    document.body.append(wrap);
    const el = mount(FOLDS);
    wrap.append(el);
    el.renderNow();
    press(q(el, '.cap-head .aq-fold')!);
    press(q(el, '.aq-q')!);
    await spy.settle();
    expect(spy.calls).toEqual([]);
  });
});

describe('keyboard', () => {
  it('roves the account marks with one tab stop; arrows, Home and End', () => {
    const el = mount({ now: NOW, providers: [claude()] });
    const tabs = () => qa(el, '.aq-mark').map((m) => m.getAttribute('tabindex'));
    expect(tabs()).toEqual(['0', '-1', '-1', '-1']);
    qa(el, '.aq-mark')[0].focus();
    qa(el, '.aq-mark')[0].dispatchEvent(key('ArrowRight'));
    expect(tabs()).toEqual(['-1', '0', '-1', '-1']);
    expect(el.shadowRoot!.activeElement?.getAttribute('data-aid')).toBe('ai3');
    qa(el, '.aq-mark')[1].dispatchEvent(key('End'));
    expect(el.shadowRoot!.activeElement?.getAttribute('data-aid')).toBe('icedac');
    qa(el, '.aq-mark')[3].dispatchEvent(key('Home'));
    expect(el.shadowRoot!.activeElement?.getAttribute('data-aid')).toBe('ai7');
    qa(el, '.aq-mark')[0].dispatchEvent(key('ArrowUp'));
    expect(el.shadowRoot!.activeElement?.getAttribute('data-aid')).toBe('ai7');
  });

  it('keeps the roving stop across a re-render', () => {
    const el = mount({ now: NOW, lane: { jobs: jobs() } });
    qa(el, '.aq-q')[0].focus();
    qa(el, '.aq-q')[0].dispatchEvent(key('ArrowDown'));
    el.data = { now: NOW, lane: { jobs: jobs() } };
    el.renderNow();
    expect(qa(el, '.aq-q').map((m) => m.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
    expect(el.shadowRoot!.activeElement?.getAttribute('data-job')).toBe('audit');
  });

  it('keeps every name on a phone when the strip fits two lines', () => {
    const el = mountAt(390, { now: NOW, providers: [claude()] });
    expect(names(q(el, '.aq-marks')!)).toEqual(['ai7', 'ai3', 'ai43', 'icedac']);
    expect(qa(el, '.aq-mark.is-fold')).toHaveLength(0);
  });

  it('roves through stacks and folded badges as one strip', () => {
    const el = mountAt(390, { now: NOW, providers: [claude({ accounts: twenty() })] });
    const marks = qa(el, '.aq-mark');
    expect(marks.map((m) => m.dataset.aid ?? m.dataset.grp)).toEqual([
      'ai5',
      'ai6',
      'ai4',
      'ai2',
      'limited|weekly',
      'limited|cooldown',
      'ai8',
      'paused|paused',
    ]);
    marks[0].focus();
    marks[0].dispatchEvent(key('End'));
    expect(el.shadowRoot!.activeElement?.getAttribute('data-grp')).toBe('paused|paused');
    qa(el, '.aq-mark')[7].dispatchEvent(key('ArrowLeft'));
    expect(el.shadowRoot!.activeElement?.getAttribute('data-aid')).toBe('ai8');
    qa(el, '.aq-mark')[6].dispatchEvent(key('Home'));
    expect(el.shadowRoot!.activeElement?.getAttribute('data-aid')).toBe('ai5');
  });
});

describe('workers strip (stacks, one icon, two lines)', () => {
  it('stacks the same state and reason; usable first, then limited, held, left out', () => {
    const stacks = accountStacks(twenty());
    expect(stacks.map((s) => [s.key, s.accounts.map((a) => a.name).join(' ')])).toEqual([
      ['available', 'ai5 ai6 ai4 ai2'],
      ['limited|weekly', 'ai43 ai17'],
      ['limited|cooldown', 'ai3 ai7 ai15 ai40 ai30 ai41 info dev1 ai ai44 ai16'],
      ['paused|auth', 'ai8'],
      ['paused|paused', 'icedac z'],
    ]);
    expect(accountStacks(undefined)).toEqual([]);
  });

  it('folds nothing when the strip fits; the widest blocked stack first; the usable run last', () => {
    const stacks = accountStacks(twenty());
    expect([...stripFolds(stacks, '계정 4/20', 1336)]).toEqual([]);
    expect([...stripFolds(stacks, '계정 4/20', 326)]).toEqual(['limited|cooldown', 'limited|weekly']);
    // Too narrow for anything: every run that a fold makes smaller folds, the usable run last.
    expect([...stripFolds(stacks, '계정 4/20', 120)].at(-1)).toBe('available');
    // A run of one is never folded: its badge is no wider than the fold.
    expect(stripFolds(stacks, '계정 4/20', 120).has('paused|auth')).toBe(false);
  });

  it('folds one stack wider than the row even when the line count fits (no clipped names)', () => {
    const all = twenty().map((a): AqAccount => ({ ...a, state: 'limited', reason: 'cooldown', binding: undefined }));
    const stacks = accountStacks(all);
    expect(stacks.map((s) => s.key)).toEqual(['limited|cooldown']);
    expect([...stripFolds(stacks, '계정 0/20', 326)]).toEqual(['limited|cooldown']);
    expect([...stripFolds(stacks, '계정 0/20', 2000)]).toEqual([]);
    const el = mountAt(390, { now: NOW, providers: [claude({ accounts: all })] }, { lang: 'ko' });
    expect(qa(el, '.aq-mark').map((m) => m.textContent)).toEqual(['20']);
    // 4 usable + 16 cooldown on a phone: the cooldown stack folds, the usable names stay.
    const mixed = twenty().map(
      (a): AqAccount => (a.state === 'available' ? a : { ...a, state: 'limited', reason: 'cooldown' }),
    );
    expect([...stripFolds(accountStacks(mixed), '계정 4/20', 326)]).toEqual(['limited|cooldown']);
  });

  it('treats a host reason that names an Object.prototype key as free text', () => {
    const el = mount({
      now: NOW,
      providers: [
        claude({
          accounts: [
            { id: 'p1', name: 'p1', state: 'limited', reason: 'toString' },
            { id: 'p2', name: 'p2', state: 'limited', reason: '__proto__' },
          ],
        }),
      ],
    });
    expect(q(el, '.aq-si')?.innerHTML).not.toContain('function');
    expect(q(el, '.aq-si')?.innerHTML).not.toContain('[object');
    const titles = qa(el, '.aq-mark').map((m) => m.getAttribute('title'));
    expect(titles).toEqual(['p1 · toString · no return time', 'p2 · __proto__ · no return time']);
  });

  it("draws the screenshot's 20 accounts on one line: names only, one icon per stack", () => {
    const el = mountAt(1400, { now: NOW, providers: [claude({ accounts: twenty() })] }, { lang: 'ko' });
    expect(text(el, '.aq-col-head')).toBe('계정 4/20');
    const box = q(el, '.aq-marks')!;
    const kids = Array.from(box.children).map((c) => c.className);
    expect(kids).toEqual([
      'aq-col-head',
      'aq-mark is-available',
      'aq-mark is-available',
      'aq-mark is-available',
      'aq-mark is-available',
      'aq-stack is-warn',
      'aq-stack is-warn',
      'aq-stack is-fail',
      'aq-stack is-mute',
    ]);
    const stacks = qa(el, '.aq-stack');
    expect(stacks.map((s) => names(s).join(' '))).toEqual([
      'ai43 ai17',
      'ai3 ai7 ai15 ai40 ai30 ai41 info dev1 ai ai44 ai16',
      'ai8',
      'icedac z',
    ]);
    // One icon per stack, on its first badge; no badge says a reason, a countdown or "복귀 약속 없음".
    for (const st of stacks) {
      expect(st.querySelectorAll('.aq-si')).toHaveLength(1);
      expect(st.querySelector('.aq-mark')?.querySelector('.aq-si')).not.toBeNull();
    }
    const said = qa(el, '.aq-mark').map((m) => m.textContent ?? '');
    expect(said.some((x) => /·|쿨다운|복귀|주간|일시정지|인증|⏸/.test(x))).toBe(false);
    expect(
      qa(el, '.aq-mark')
        .find((m) => m.dataset.aid === 'ai3')
        ?.getAttribute('aria-label'),
    ).toBe('ai3, 쿨다운, 복귀 약속 없음');
    expect(
      qa(el, '.aq-mark')
        .find((m) => m.dataset.aid === 'ai8')
        ?.getAttribute('title'),
    ).toBe('ai8 · 인증 실패');
  });

  it("folds the wide stacks to icon + count on a phone; the fold's card lists who and when", () => {
    const el = mountAt(390, { now: NOW, providers: [claude({ accounts: twenty() })] }, { lang: 'ko' });
    const folds = qa(el, '.aq-mark.is-fold');
    expect(folds.map((f) => [f.dataset.grp, f.textContent])).toEqual([
      ['limited|weekly', '2'],
      ['limited|cooldown', '11'],
    ]);
    expect(folds[1].querySelector('.aq-si')).not.toBeNull();
    expect(folds[1].getAttribute('aria-label')).toBe('쿨다운 계정 11개 — 목록 보기');
    // The usable accounts, the failed login and the paused pair keep their names.
    expect(names(q(el, '.aq-marks')!).filter((x) => /^[a-z]/.test(x ?? ''))).toEqual([
      'ai5',
      'ai6',
      'ai4',
      'ai2',
      'ai8',
      'icedac',
      'z',
    ]);
    folds[1].click();
    expect(q(el, '.aq-pop')?.getAttribute('aria-label')).toBe('쿨다운 계정 세부');
    expect(text(el, '.aq-pop-name')).toBe('쿨다운');
    expect(text(el, '.aq-pop-kind')).toBe('Claude · 계정 11');
    const rows = qa(el, '.aq-pop-stats > div').map((d) => [
      d.querySelector('dt')?.textContent,
      d.querySelector('dd')?.textContent,
    ]);
    expect(rows.find((r) => r[0] === 'ai40')?.[1]).toBe('13시간 38분');
    expect(rows.find((r) => r[0] === 'ai3')?.[1]).toBe('—');
    expect(qa(el, '.aq-mark.is-fold')[1].getAttribute('aria-expanded')).toBe('true');
    // Esc closes it and puts focus back on the fold.
    q(el, '.aq-pop-close')!.focus();
    q(el, '.aq-pop-close')!.dispatchEvent(key('Escape'));
    expect(q(el, '.aq-pop')).toBeNull();
    expect(el.shadowRoot!.activeElement?.getAttribute('data-grp')).toBe('limited|cooldown');
  });

  it("keeps a fold's card open across a data refresh; closes it when the run is gone", () => {
    const el = mountAt(390, { now: NOW, providers: [claude({ accounts: twenty() })] }, { lang: 'ko' });
    qa(el, '.aq-mark.is-fold')
      .find((f) => f.dataset.grp === 'limited|cooldown')!
      .click();
    expect(q(el, '.aq-pop')).not.toBeNull();
    // The host hands the same data again (the dashboard re-sets it every minute).
    el.data = { now: NOW, providers: [claude({ accounts: twenty() })] };
    el.renderNow();
    expect(q(el, '.aq-pop')?.getAttribute('aria-label')).toBe('쿨다운 계정 세부');
    // A later response with no cooldown left: the card closes and does not come back.
    el.data = { now: NOW, providers: [claude({ accounts: twenty().filter((a) => a.reason !== 'cooldown') })] };
    el.renderNow();
    expect(q(el, '.aq-pop')).toBeNull();
    el.data = { now: NOW, providers: [claude({ accounts: twenty() })] };
    el.renderNow();
    expect(q(el, '.aq-pop')).toBeNull();
  });

  it('folds the usable run last, to a dot and a count, with its list card', () => {
    const many = Array.from(
      { length: 12 },
      (_, i): AqAccount => ({
        id: `acct${i}`,
        name: `account-${i}`,
        state: 'available',
        binding: '5h',
        fiveHour: 0.5,
        weekly: 0.25,
      }),
    );
    const el = mountAt(390, { now: NOW, providers: [claude({ accounts: [...many, ...twenty()] })] });
    const ok = qa(el, '.aq-mark.is-fold').find((f) => f.dataset.grp === 'available')!;
    expect(ok.textContent).toBe('16');
    expect(ok.querySelector('.aq-wdot')).not.toBeNull();
    ok.click();
    expect(q(el, '.aq-pop')?.getAttribute('aria-label')).toBe('Available accounts');
    expect(qa(el, '.aq-pop-stats dd')[0].textContent).toBe('now 50% · week 25%');
  });
});

describe('live time and announcements', () => {
  it('ticks countdowns in place once a second, without re-rendering', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const el = mount({ providers: [claude()], lane: { jobs: jobs() } });
    const pill = q(el, '.aq-pill time')!;
    const chip = q(el, '.aq-q time')!;
    expect(pill.textContent).toBe('back in 7h 22m');
    expect(chip.textContent).toBe('18m');
    vi.advanceTimersByTime(2 * M);
    expect(q(el, '.aq-pill time')).toBe(pill);
    expect(pill.textContent).toBe('back in 7h 20m');
    expect(chip.textContent).toBe('16m');
  });

  it('repaints once when a countdown reaches zero, folding the refill in', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const el = mount({ providers: [claude()] });
    expect(qa(el, '.cap-bar-val')[0].textContent).toBe('1.5 / 4.0 accounts 38%');
    vi.advanceTimersByTime(23 * M);
    await Promise.resolve();
    expect(qa(el, '.cap-bar-val')[0].textContent).toBe('1.9 / 4.0 accounts 48%');
  });

  it('announces state changes once, never the first data', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const el = mount({ providers: [claude()], lane: { jobs: jobs() } });
    const live = el.shadowRoot!.querySelector('[aria-live="polite"]')!;
    vi.advanceTimersByTime(100);
    expect(live.textContent).toBe('');
    const next = jobs();
    next[0].runs = [{ at: NOW - M, status: 'failed', error: 'npm audit\ntimed out' }, ...(next[0].runs ?? [])];
    el.data = { providers: [claude({ fiveHour: 0.5 })], lane: { jobs: next } };
    el.renderNow();
    vi.advanceTimersByTime(100);
    expect(live.textContent).toBe(
      'Claude below 20% now — 0.5/4.0 accounts · Cron dependency-audit failed: npm audit timed out',
    );
  });

  it('stops ticking when disconnected', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const el = mount({ providers: [claude()] });
    const pill = q(el, '.aq-pill time')!;
    el.remove();
    vi.advanceTimersByTime(5 * M);
    expect(pill.textContent).toBe('back in 7h 22m');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('builds announcement sentences from data changes', () => {
    const empty = claude({ fiveHour: 0, state: 'empty' });
    expect(capacityNews([claude()], [empty], NOW)).toBe('Claude: all accounts limited — back in 7h 22m');
    expect(capacityNews([empty], [claude()], NOW)).toBe('Claude available again — 2/4 accounts');
    expect(capacityNews(undefined, [empty], NOW)).toBe('');
    expect(capacityNews([claude()], [empty], NOW, STRINGS.ko)).toBe('Claude 계정이 모두 막힘 — 7시간 22분 후 복귀');
    const a = jobs();
    const b = jobs();
    b[1].state = 'idle';
    b[0].state = 'waiting';
    expect(laneNews({ jobs: a }, { jobs: b })).toBe('Cron dependency-audit needs a reply');
    expect(laneNews({ jobs: a }, { jobs: [...b, { id: 'new', name: 'new', state: 'waiting' }] })).toBe(
      'Cron dependency-audit needs a reply',
    );
  });
});

describe('host gaps for the dashboard swap', () => {
  const capped = () => Array.from({ length: 20 }, (_, i): AqRun => ({ at: NOW - i * 15 * M - S, status: 'ok' }));

  it('keeps the lower bounds when runs24h supplies the counts (the kept records decide)', () => {
    const runs = capped();
    const job: AqJob = { id: 'p', name: 'poll', historyCap: 20, runs };
    const d = dayRuns({ jobs: [job], runs24h: runs.slice(0, 5) }, NOW);
    expect(d.n).toBe(5);
    expect(d.cut).toEqual([{ name: 'poll', from: NOW - 19 * 15 * M - S, cap: 20 }]);
    const el = mount({ now: NOW, lane: { jobs: [job], runs24h: runs.slice(0, 5) } });
    const dd = qa(el, '.aq-stat dd');
    expect(dd[2].textContent).toBe('≥5');
    expect(dd[3].textContent).toBe('≥0');
    expect(dd[2].getAttribute('title')).toContain('poll keeps 20 runs, so its history starts at');
    expect(q(el, '.aq-ch-cut')).not.toBeNull();
    expect(q(el, '.aq-plot')!.getAttribute('aria-label')).toContain('some job histories are truncated');
  });

  it('never counts a run shown before its record exists toward historyCap', () => {
    const live: AqRun = { at: NOW - S, status: 'running', recorded: false };
    const job: AqJob = { id: 'p', name: 'poll', historyCap: 20, runs: [live, ...capped().slice(0, 19)] };
    expect(dayRuns({ jobs: [job], runs24h: [] }, NOW).cut).toHaveLength(0);
    expect(dayRuns({ jobs: [job] }, NOW).cut).toHaveLength(0);
    expect(dayRuns({ jobs: [{ ...job, runs: [live, ...capped()] }], runs24h: [] }, NOW).cut).toHaveLength(1);
  });

  it('draws a job note after the name, escaped, with its tooltip', () => {
    const el = mount({
      now: NOW,
      lane: {
        jobs: [
          { id: 'gone', name: 'old-job', note: { text: XSS, title: XSS_ATTR } },
          { id: 'here', name: 'plain', runs: [] },
        ],
      },
    });
    const notes = qa(el, '.cron-note');
    expect(notes).toHaveLength(1);
    expect(notes[0].textContent).toBe(XSS);
    expect(notes[0].getAttribute('title')).toBe(XSS_ATTR);
    expect(q(el, '.cron-note img')).toBeNull();
    expect(notes[0].previousElementSibling?.classList.contains('cron-name')).toBe(true);
    expect(notes[0].closest('.cron-group')?.getAttribute('aria-label')).toBe('old-job');
  });

  it('collapsed capacity: the head and one chip per provider — measures, ⏸ limited · first return, ⚠ flags', () => {
    const codex: AqProvider = {
      id: 'codex',
      name: 'Codex',
      total: 3.2,
      weekly: 0.4,
      measuredAt: NOW - 2 * D - H,
      accounts: [
        { id: 'c1', name: 'c1', state: 'available', tier: 'x20', tierAssumed: true },
        { id: 'c2', name: 'c2', state: 'available' },
      ],
    };
    const el = mount({ now: NOW, providers: [claude(), codex], collapsed: { capacity: true } });
    expect(q(el, '.capacity')!.classList.contains('is-collapsed')).toBe(true);
    expect(q(el, '.cap-prov')).toBeNull();
    expect(q(el, '.cap-sub')).toBeNull();
    expect(q(el, '.aq-fold')).toBeNull(); // not collapsible: folded by the host, no toggle
    const chips = qa(el, '.cap-chip');
    expect(chips).toHaveLength(2);
    const vis = (c: HTMLElement) => c.querySelector('.cap-chip-v')!.textContent!.replace(/\s+/g, ' ').trim();
    expect(vis(chips[0])).toBe('Claude now 1.5/4.0 38% · week 2.0/4.0 50% ⏸ 1 · 7h 22m ⚠ 3/4 reflected');
    expect(chips[0].querySelector('.cap-chip-v')!.innerHTML).toMatch(
      /<em>50%<\/em><\/span> <i class="cap-chip-lim">⏸ 1 · <time class="aq-left" role="timer"[^>]*>7h 22m<\/time><\/i> <i class="cap-chip-flag">⚠ 3\/4 reflected<\/i>$/,
    );
    expect(chips[0].querySelector('.cap-chip-v')!.getAttribute('aria-hidden')).toBe('true');
    const said = chips[0].querySelector('.sr-only')!.textContent!;
    expect(said).toMatch(
      /^Claude 5-hour \(now\) 1\.5\/4\.0 accounts \(38%\), weekly 2\.0\/4\.0 accounts \(50%\) · 3\/4 reflected · limited 1 — first back in 7h 22m — next \+0\.4 · in 22m \(\d\d:\d\d\) · 5-hour reset · ai7$/,
    );
    expect(chips[0].getAttribute('title')).toBe(said.slice('Claude '.length));
    // Weekly only, low, a reading two days old, an assumed tier.
    expect(chips[1].classList.contains('is-low')).toBe(true);
    expect(vis(chips[1])).toBe('▲ Codex week 0.4/3.2 13% ⚠ 2d ago · x20 assumed 1');
    expect(chips[1].querySelector('.sr-only')!.textContent).toContain(
      'weekly 0.4/3.2 accounts (13%) · measured 2d ago · no tier 1 (x20 assumed) · low — nothing returns within 7 days',
    );
  });

  it('collapsed capacity: an error or an empty pool is one chip', () => {
    const err = mount({ now: NOW, capacityError: XSS, collapsed: { capacity: true } });
    expect(text(err, '.cap-chip.is-error')).toBe(`Capacity unknown · ${XSS}`);
    expect(q(err, '.cap-chip img')).toBeNull();
    expect(q(err, '.cap-off')).toBeNull();
    const none = mount({ now: NOW, providers: [], collapsed: { capacity: true } });
    expect(text(none, '.cap-chip.is-unknown')).toBe('No accounts');
  });

  it('collapsed lane: the head and only the jobs waiting for a reply — no stats, queue or chart', () => {
    const el = mount({ now: NOW, lane: { jobs: jobs() }, collapsed: { lane: true } });
    expect(q(el, '.aq-lane')!.classList.contains('is-collapsed')).toBe(true);
    expect(text(el, '.aq-lane-head')).toBe('CRON3● Running 1▲ Needs reply 1');
    expect(q(el, '.aq-stats')).toBeNull();
    expect(q(el, '.aq-queue')).toBeNull();
    expect(q(el, '.aq-chart')).toBeNull();
    expect(qa(el, '.cron-group').map((g) => g.getAttribute('aria-label'))).toEqual(['morning-digest']);
    expect(qa(el, 'slot').map((s) => s.getAttribute('name'))).toEqual(['job:digest']);
    el.data = { now: NOW, lane: { jobs: jobs().filter((j) => j.state !== 'waiting') }, collapsed: { lane: true } };
    el.renderNow();
    expect(q(el, '.cron-group')).toBeNull();
    expect(q(el, '.aq-lane-head')).not.toBeNull();
  });

  it('collapsible: the toggle in each head says what a press does and sends a cancelable ui-collapse', () => {
    const el = mount({
      now: NOW,
      providers: [claude()],
      lane: { jobs: jobs() },
      collapsible: true,
      collapsed: { capacity: true },
    });
    const seen: unknown[] = [];
    el.addEventListener('ui-collapse', (e) => seen.push((e as CustomEvent).detail));
    const cap = q(el, '.cap-head .aq-fold')!;
    expect(cap.getAttribute('aria-expanded')).toBe('false');
    expect(cap.textContent).toBe('Expand');
    expect(cap.getAttribute('aria-label')).toBe('Expand LLM capacity');
    const lane = q(el, '.aq-lane-head .aq-fold')!;
    expect(lane.getAttribute('aria-expanded')).toBe('true');
    expect(lane.textContent).toBe('Collapse');
    // A press the host lets through applies at once; focus stays on the toggle.
    cap.focus();
    cap.click();
    expect(seen).toEqual([{ section: 'capacity', collapsed: false }]);
    expect(q(el, '.cap-prov')).not.toBeNull();
    expect(q(el, '.cap-summary')).toBeNull();
    expect(el.shadowRoot!.activeElement?.getAttribute('data-key')).toBe('fold-capacity');
    expect(q(el, '.cap-head .aq-fold')!.getAttribute('aria-expanded')).toBe('true');
    // A prevented press keeps the state.
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener('ui-collapse', stop);
    q(el, '.aq-lane-head .aq-fold')!.click();
    expect(seen[1]).toEqual({ section: 'lane', collapsed: true });
    expect(q(el, '.aq-stats')).not.toBeNull();
    el.removeEventListener('ui-collapse', stop);
    q(el, '.aq-lane-head .aq-fold')!.click();
    expect(q(el, '.aq-stats')).toBeNull();
    // The host's value wins on the next data set; a section it leaves out keeps the element's own.
    el.data = {
      now: NOW,
      providers: [claude()],
      lane: { jobs: jobs() },
      collapsible: true,
      collapsed: { capacity: true },
    };
    el.renderNow();
    expect(q(el, '.capacity')!.classList.contains('is-collapsed')).toBe(true);
    expect(q(el, '.aq-lane')!.classList.contains('is-collapsed')).toBe(true);
    // Keyboard: the toggle is a real button (Enter / Space are its click); nothing roves on it.
    q(el, '.cap-head .aq-fold')!.dispatchEvent(key('ArrowRight'));
    expect(q(el, '.capacity')!.classList.contains('is-collapsed')).toBe(true);
  });

  it('per-job slot: the host’s live card sits under its tile and survives every re-render', () => {
    const el = mount({ now: NOW, lane: { jobs: jobs() } });
    const slots = qa(el, '.cron-group > slot');
    expect(slots.map((s) => s.getAttribute('name'))).toEqual(['job:digest', 'job:sweep', 'job:audit']);
    expect(slots.every((s) => s.parentElement!.lastElementChild === s)).toBe(true);
    const card = document.createElement('article');
    card.slot = 'job:sweep';
    card.innerHTML = '<button type="button" data-job="x" class="aq-fold" data-fold="lane">Stop</button>';
    el.append(card);
    const btn = card.querySelector('button')!;
    const assigned = () => (q(el, 'slot[name="job:sweep"]') as HTMLSlotElement).assignedElements?.() ?? [];
    expect(assigned()).toEqual([card]);
    btn.focus();
    expect(document.activeElement).toBe(btn);
    // A data update, a tick repaint and a fold all replace the shadow markup — never the host's card.
    el.data = { now: NOW + M, lane: { jobs: jobs() } };
    el.renderNow();
    expect(card.isConnected && card.parentElement).toBe(el);
    expect(assigned()).toEqual([card]);
    expect(document.activeElement).toBe(btn);
    // The card's own clicks and keys are the host's: no ui-job-open, no fold, Esc is not swallowed.
    const evs = vi.fn();
    el.addEventListener('ui-job-open', evs);
    el.addEventListener('ui-collapse', evs);
    btn.click();
    expect(evs).not.toHaveBeenCalled();
    expect(q(el, '.aq-lane')!.classList.contains('is-collapsed')).toBe(false);
    const esc = vi.fn();
    document.addEventListener('keydown', esc);
    btn.dispatchEvent(key('Escape'));
    document.removeEventListener('keydown', esc);
    expect(esc).toHaveBeenCalledTimes(1);
  });

  it('per-job slot: a slotted card does not swallow Esc or keep the account card open on a press', () => {
    const el = mount({ now: NOW, providers: [claude()], lane: { jobs: jobs() } });
    const card = document.createElement('button');
    card.type = 'button';
    card.slot = 'job:digest';
    el.append(card);
    (qa(el, '.aq-mark')[0] as HTMLElement).click();
    expect(q(el, '.aq-pop')).not.toBeNull();
    const outer = vi.fn();
    document.addEventListener('keydown', outer);
    card.dispatchEvent(key('Escape'));
    document.removeEventListener('keydown', outer);
    expect(outer).toHaveBeenCalledTimes(1);
    card.click(); // a press outside the account card closes it, as anywhere else
    expect(q(el, '.aq-pop')).toBeNull();
  });

  it('escapes a job id in its slot name', () => {
    const el = mount({ now: NOW, lane: { jobs: [{ id: XSS_ATTR, name: 'x' }] } });
    expect(q(el, 'slot')!.getAttribute('name')).toBe(`job:${XSS_ATTR}`);
    expect(q(el, 'slot img')).toBeNull();
  });

  it('speaks Korean when folded: 펼치기 / 접기 and the dashboard’s chip words', () => {
    const el = mount(
      { now: NOW, providers: [claude()], lane: { jobs: jobs() }, collapsible: true, collapsed: { capacity: true } },
      { lang: 'ko' },
    );
    expect(q(el, '.cap-head .aq-fold')!.textContent).toBe('펼치기');
    expect(q(el, '.cap-head .aq-fold')!.getAttribute('aria-label')).toBe('LLM 가용량 펼치기');
    expect(q(el, '.aq-lane-head .aq-fold')!.textContent).toBe('접기');
    expect(q(el, '.cap-chip-v')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      'Claude 지금 1.5/4.0 38% · 주 2.0/4.0 50% ⏸ 1 · 7시간 22분 ⚠ 3/4 반영',
    );
    expect(q(el, '.cap-chip .sr-only')!.textContent).toContain(
      'Claude 5시간(지금) 1.5/4.0 계정 (38%), 일주일 2.0/4.0 계정 (50%) · 3/4 반영 · 제한 1 — 7시간 22분 후 첫 복귀 — 다음 +0.4계정 · 22분 후',
    );
  });
});

describe('lang="ko"', () => {
  it('speaks Korean the way the dashboard does', () => {
    const el = mount({ now: NOW, providers: [claude()], lane: { jobs: jobs() } }, { lang: 'ko' });
    expect(text(el, '.cap-title')).toBe('LLM 가용량');
    expect(text(el, '.aq-name')).toBe('llmux · 계정 4');
    expect(text(el, '.aq-pill')).toBe('⏸ 제한 1 · 7시간 22분 후 복귀');
    expect(text(el, '.cap-disc')).toBe('3/4 반영(차단 1 포함) · 제외 1(보류) · 측정 4시간 전');
    expect(qa(el, '.cap-bar-next')[0].textContent).toBe('다음 +0.4계정 · 22분 후');
    expect(qa(el, '.cap-bar-val')[0].textContent).toBe('1.5 / 4.0 계정 38%');
    expect(text(el, '.aq-workers .aq-col-head')).toBe('계정 2/4');
    expect(qa(el, '.aq-mark')[2].textContent).toBe('ai43');
    expect(qa(el, '.aq-mark')[2].getAttribute('title')).toBe('ai43 · 주간 한도 · 7시간 22분 후 복귀');
    expect(qa(el, '.aq-stat dt').map((d) => d.textContent)).toEqual([
      '다음 실행',
      '실행 중',
      '24시간 실행 기록',
      '실패 · 24시간',
    ]);
    expect(qa(el, '.aq-stat dd')[0].textContent).toBe('18분 후pr-sweeper');
    expect(qa(el, '.aq-stat dd')[2].textContent).toBe('5+미확인 1');
    expect(qa(el, '.cron-history-btn')[0].textContent).toBe('지난 실행 1');
    expect(qa(el, '.cron-group')[2].querySelector('.cron-expr')?.textContent).toBe('6시간마다');
    expect(text(el, '.aq-chart-title')).toBe('실행 기록 · 24시간');
    expect(qa(el, '.aq-ch-axis span').map((s) => s.textContent)).toEqual(['24시간 전', '12시간 전', '지금']);
  });
});
