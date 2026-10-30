import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import { resetSoundQueue } from '../../sound/sound';
import { doc } from './docs';
import {
  GOAL_ARM_GUARD_MS,
  GOAL_ARM_MS,
  type GoalCardData,
  goalActions,
  goalAgo,
  goalMetaHtml,
  goalProgress,
  goalStatus,
  objectiveOverflows,
  type UiGoalCard,
} from './goal-card';
import { styles } from './styles';

const NOW = Date.UTC(2026, 9, 30, 12, 0, 0);
const MIN = 60_000;
const HOUR = 60 * MIN;

const BASE: GoalCardData = {
  now: NOW,
  current: {
    id: 'g1',
    objective: 'Ship the migration guide',
    status: 'active',
    progress: { done: 3, total: 5 },
    startedAt: NOW - 2 * HOUR,
    updatedAt: NOW - 5 * MIN,
  },
  queue: [
    { id: 'q1', objective: 'Audit contrast' },
    { id: 'q2', objective: 'Write release notes', addedAt: NOW - 10 * MIN },
  ],
  history: [
    { id: 'h1', objective: 'Fix the flaky test', status: 'complete', endedAt: NOW - 3 * HOUR },
    { id: 'h2', objective: 'Speed up search', status: 'failed', endedAt: NOW - 26 * HOUR },
  ],
};

function mount(data: GoalCardData | undefined, attrs: Record<string, string> = {}): UiGoalCard {
  const el = document.createElement('ui-goal-card');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = (el: UiGoalCard, s: string) => el.shadowRoot!.querySelector<HTMLElement>(s);
const qa = (el: UiGoalCard, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const press = (el: UiGoalCard, s: string) => {
  q(el, s)!.click();
  el.renderNow();
};
const key = (target: Element, k: string, init: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
};
const type = (el: UiGoalCard, text: string) => {
  const ta = q(el, '.gc-input') as HTMLTextAreaElement;
  ta.value = text;
  ta.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  return ta;
};
const acts = (el: UiGoalCard) => qa(el, '.gc-acts .gc-btn').map((b) => b.dataset.act);
const listen = (el: UiGoalCard, name: string, prevent = false) => {
  const fn = vi.fn((e: Event) => {
    if (prevent) e.preventDefault();
  });
  el.addEventListener(name, fn);
  return fn;
};
const detail = (fn: ReturnType<typeof listen>, i = 0) => (fn.mock.calls[i][0] as CustomEvent).detail;

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('helpers', () => {
  it('maps a status to tone, word and finality', () => {
    expect(goalStatus('active')).toEqual({ key: 'active', tone: 'run', label: 'Active', terminal: false });
    expect(goalStatus('Running')).toMatchObject({ key: 'active', tone: 'run' });
    expect(goalStatus('paused')).toMatchObject({ tone: 'wait', label: 'Paused', terminal: false });
    expect(goalStatus('completed')).toMatchObject({ key: 'complete', tone: 'done', label: 'Complete', terminal: true });
    expect(goalStatus('error')).toMatchObject({ key: 'failed', tone: 'fail', label: 'Failed', terminal: true });
    expect(goalStatus('canceled')).toMatchObject({
      key: 'cancelled',
      tone: 'idle',
      label: 'Cancelled',
      terminal: true,
    });
    expect(goalStatus('paused', 'ko').label).toBe('일시정지');
    expect(goalStatus('active', 'ko').label).toBe('진행 중');
    expect(goalStatus('evaluating')).toEqual({ key: 'other', tone: 'idle', label: 'evaluating', terminal: false });
    expect(goalStatus(undefined)).toEqual({ key: 'other', tone: 'idle', label: '', terminal: false });
  });

  it('offers the actions the status allows', () => {
    expect(goalActions('active')).toEqual(['complete', 'pause', 'delete']);
    expect(goalActions('paused')).toEqual(['complete', 'resume', 'delete']);
    expect(goalActions('complete')).toEqual(['delete']);
    expect(goalActions('failed')).toEqual(['delete']);
    expect(goalActions('evaluating')).toEqual(['complete', 'delete']);
  });

  it('keeps only the actions the host answers, in the card’s order', () => {
    expect(goalActions('active', ['delete'])).toEqual(['delete']);
    expect(goalActions('active', ['delete', 'complete'])).toEqual(['complete', 'delete']);
    expect(goalActions('paused', ['pause', 'resume'])).toEqual(['resume']);
    expect(goalActions('active', [])).toEqual([]);
    expect(goalActions('complete', ['complete', 'pause'])).toEqual([]);
    expect(goalActions('active', undefined)).toEqual(['complete', 'pause', 'delete']);
    expect(goalActions('active', null)).toEqual(['complete', 'pause', 'delete']);
  });

  it('draws meta items as quiet label · value spans, escaped, skipping empty ones', () => {
    const html = goalMetaHtml([{ label: 'Continues', value: '3/10' }, '$0.42', '', { label: '', value: '' }, 7]);
    expect(html).toBe(
      '<span class="gc-kv"><span class="gc-k">Continues</span> <span class="gc-v">3/10</span></span><span class="gc-dot" aria-hidden="true">·</span><span class="gc-kv">$0.42</span>',
    );
    expect(goalMetaHtml([{ label: '<b>', value: '<i>' }])).toContain('&lt;b&gt;</span> <span class="gc-v">&lt;i&gt;');
    expect(goalMetaHtml([{ value: '2×' }])).toBe('<span class="gc-kv"><span class="gc-v">2×</span></span>');
    expect(goalMetaHtml('x')).toBe('');
    expect(goalMetaHtml(undefined)).toBe('');
  });

  it('normalises progress from a fraction or steps', () => {
    expect(goalProgress(0.6)).toEqual({ ratio: 0.6, pct: 60 });
    expect(goalProgress(1.4)).toEqual({ ratio: 1, pct: 100 });
    expect(goalProgress(-2)).toEqual({ ratio: 0, pct: 0 });
    expect(goalProgress(Number.NaN)).toBeNull();
    expect(goalProgress({ done: 3, total: 5 })).toEqual({ ratio: 0.6, pct: 60, done: 3, total: 5 });
    expect(goalProgress({ done: 199, total: 200 })?.pct).toBe(99);
    expect(goalProgress({ done: 7, total: 5 })).toEqual({ ratio: 1, pct: 100, done: 5, total: 5 });
    expect(goalProgress({ done: -1, total: 5 })?.done).toBe(0);
    expect(goalProgress({ done: 0, total: 0 })).toBeNull();
    expect(goalProgress({ done: 'x', total: 5 } as never)).toBeNull();
    expect(goalProgress('0.5')).toBeNull();
    expect(goalProgress(undefined)).toBeNull();
  });

  it('says relative times in English and Korean', () => {
    expect(goalAgo(NOW - 10_000, NOW)).toBe('just now');
    expect(goalAgo(NOW - 5 * MIN, NOW)).toBe('5m ago');
    expect(goalAgo(NOW - 3 * HOUR, NOW)).toBe('3h ago');
    expect(goalAgo(NOW - 50 * HOUR, NOW)).toBe('2d ago');
    expect(goalAgo(NOW - 10_000, NOW, 'ko')).toBe('방금');
    expect(goalAgo(NOW - 50_000, NOW, 'ko')).toBe('1분 전');
    expect(goalAgo(NOW - 5 * MIN, NOW, 'ko')).toBe('5분 전');
    expect(goalAgo(NOW - 3 * HOUR, NOW, 'ko')).toBe('3시간 전');
    expect(goalAgo(NOW - 50 * HOUR, NOW, 'ko')).toBe('2일 전');
  });

  it('decides whether the fold cuts the objective', () => {
    expect(objectiveOverflows({ scrollHeight: 100, lineHeight: 20 })).toBe(true);
    expect(objectiveOverflows({ scrollHeight: 61, lineHeight: 20 })).toBe(false);
    expect(objectiveOverflows({ scrollHeight: 100, lineHeight: 20, open: true })).toBe(true);
    expect(objectiveOverflows({ scrollHeight: 100, lineHeight: 20 }, 5)).toBe(false);
    // Unknown line height: folded text against its box; an open text keeps its toggle.
    expect(objectiveOverflows({ scrollHeight: 80, clientHeight: 60, lineHeight: Number.NaN })).toBe(true);
    expect(objectiveOverflows({ scrollHeight: 60, clientHeight: 60 })).toBe(false);
    expect(objectiveOverflows({ scrollHeight: 60, clientHeight: 60, open: true })).toBe(true);
    // Not laid out yet.
    expect(objectiveOverflows({ scrollHeight: 0, lineHeight: 20 })).toBe(false);
    expect(objectiveOverflows({ scrollHeight: 0, open: true })).toBe(true);
  });
});

describe('<ui-goal-card> rendering', () => {
  it('renders nothing without data', () => {
    expect(q(mount(undefined), '.gc')).toBeNull();
  });

  it('draws the head, the status as icon + word, the objective, progress and times', () => {
    const el = mount(BASE);
    expect(q(el, '.gc')?.getAttribute('role')).toBe('group');
    expect(q(el, '.gc-title')?.textContent).toBe('Goal');
    expect(q(el, '.gc-title svg')?.getAttribute('data-icon')).toBe('target');
    const chip = q(el, '.gc-head .gc-chip')!;
    expect(chip.textContent).toBe('Active');
    expect(chip.dataset.tone).toBe('run');
    expect(chip.querySelector('svg')?.getAttribute('data-icon')).toBe('play');
    expect(q(el, '.gc-obj')?.textContent).toBe('Ship the migration guide');
    const bar = q(el, '[role="progressbar"]')!;
    expect(bar.getAttribute('aria-valuenow')).toBe('60');
    expect(bar.getAttribute('aria-valuetext')).toBe('3 of 5 done, 60%');
    expect(q(el, '.gc-prog-t')?.textContent).toBe('3 / 5 · 60%');
    expect(q(el, '.gc-fill')?.getAttribute('style')).toBe('--p:0.6');
    const times = qa(el, '.gc-meta .gc-when');
    expect(times.map((t) => t.textContent)).toEqual(['Started 2h ago', 'Updated 5m ago']);
    expect(times[0].getAttribute('datetime')).toBe(new Date(NOW - 2 * HOUR).toISOString());
  });

  it('shows a fraction as a percent, accepts ISO times, and leaves out an update within a minute of the start', () => {
    const el = mount({
      now: NOW,
      current: {
        id: 'g',
        objective: 'x',
        status: 'active',
        progress: 0.4,
        startedAt: new Date(NOW - HOUR).toISOString(),
        updatedAt: NOW - HOUR + 20_000,
      },
    });
    expect(q(el, '.gc-prog-t')?.textContent).toBe('40%');
    expect(q(el, '[role="progressbar"]')?.getAttribute('aria-valuetext')).toBe('40%');
    expect(qa(el, '.gc-when').map((t) => t.textContent)).toEqual(['Started 1h ago']);
  });

  it('draws no bar or times when they are missing or unusable', () => {
    const el = mount({
      current: { id: 'g', objective: 'x', status: 'active', progress: { done: 1, total: 0 }, startedAt: 'soon' },
    });
    expect(q(el, '.gc-prog')).toBeNull();
    expect(q(el, '.gc-meta')).toBeNull();
  });

  it('offers actions by status', () => {
    expect(acts(mount(BASE))).toEqual(['complete', 'pause', 'delete']);
    const paused = mount({ ...BASE, current: { ...BASE.current!, status: 'paused' } });
    expect(acts(paused)).toEqual(['complete', 'resume', 'delete']);
    expect(q(paused, '.gc-head .gc-chip')?.textContent).toBe('Paused');
    expect(q(paused, '.gc-head .gc-chip svg')?.getAttribute('data-icon')).toBe('pause');
    expect(q(paused, '.gc-prog')?.dataset.tone).toBe('wait');
    const done = mount({ ...BASE, current: { ...BASE.current!, status: 'complete' } });
    expect(acts(done)).toEqual(['delete']);
    expect(q(done, '.gc-head .gc-chip svg')?.getAttribute('data-icon')).toBe('check');
    expect(q(done, '.gc-input')?.getAttribute('placeholder')).toBe('Add a goal — starts now');
  });

  it('numbers the queue and labels each remove', () => {
    const el = mount(BASE);
    expect(q(el, '.gc-sub')?.textContent).toBe('Up next2');
    expect(qa(el, '.gc-q-text').map((t) => t.textContent)).toEqual(['Audit contrast', 'Write release notes']);
    expect(qa(el, '.gc-q-n').map((t) => t.textContent)).toEqual(['1', '2']);
    expect(qa(el, '.gc-rm').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Remove queued goal 1',
      'Remove queued goal 2',
    ]);
    expect(q(el, '.gc-q-row:nth-child(2) .gc-when')?.textContent).toBe('Added 10m ago');
    expect(q(el, '.gc-input')?.getAttribute('placeholder')).toBe('Add a goal — starts after the current one');
  });

  it('keeps past goals collapsed and inert until opened', () => {
    const el = mount(BASE);
    const head = q(el, '.gc-hist-head')!;
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(head.querySelector('.gc-n')?.textContent).toBe('2');
    expect(q(el, '.gc-hist-region')?.hasAttribute('inert')).toBe(true);
    expect(q(el, '.gc-hist')?.hasAttribute('data-open')).toBe(false);
    press(el, '.gc-hist-head');
    expect(q(el, '.gc-hist-head')).toBe(head);
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(q(el, '.gc-hist')?.hasAttribute('data-open')).toBe(true);
    expect(q(el, '.gc-hist-region')?.hasAttribute('inert')).toBe(false);
    const rows = qa(el, '.gc-h-row');
    expect(rows.map((r) => r.querySelector('.gc-chip')?.textContent)).toEqual(['Complete', 'Failed']);
    expect(rows.map((r) => r.querySelector('.gc-chip')?.getAttribute('data-tone'))).toEqual(['done', 'fail']);
    expect(rows.map((r) => r.querySelector('.gc-when')?.textContent)).toEqual(['3h ago', '26h ago']);
    // Survives a data update.
    el.data = { ...BASE, error: 'x' };
    el.renderNow();
    expect(q(el, '.gc-hist')?.hasAttribute('data-open')).toBe(true);
    press(el, '.gc-hist-head');
    expect(q(el, '.gc-hist-region')?.hasAttribute('inert')).toBe(true);
  });

  it('shows the error as an alert', () => {
    const el = mount({ ...BASE, error: 'Could not delete the goal.' });
    const alert = q(el, '.gc-error')!;
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toBe('Could not delete the goal.');
    expect(alert.querySelector('svg')?.getAttribute('data-icon')).toBe('alert');
    expect(q(mount(BASE), '[role="alert"]')).toBeNull();
  });

  it('says “No goal yet” with the add box when there is nothing', () => {
    const el = mount({});
    expect(q(el, '.gc-empty')?.textContent).toBe('No goal yet');
    expect(q(el, '.gc-head .gc-chip')).toBeNull();
    expect(q(el, '.gc-input')).not.toBeNull();
    expect(q(el, '.gc-input')?.getAttribute('placeholder')).toBe('Add a goal — starts now');
    expect(q(el, '.gc-hist')).toBeNull();
    expect(q(el, '.gc-q')).toBeNull();
    const queued = mount({ queue: [{ id: 'a', objective: 'A' }] });
    expect(q(queued, '.gc-empty')?.textContent).toBe('No current goal');
  });

  it('is read-only with canEdit: false — no actions, no add box; the fold and history still work', () => {
    const el = mount({ ...BASE, canEdit: false });
    expect(qa(el, '.gc-btn')).toHaveLength(0);
    expect(qa(el, '.gc-rm')).toHaveLength(0);
    expect(q(el, '.gc-input')).toBeNull();
    expect(q(el, '.gc-add-btn')).toBeNull();
    expect(q(el, '.gc-more')).not.toBeNull();
    press(el, '.gc-hist-head');
    expect(q(el, '.gc-hist')?.hasAttribute('data-open')).toBe(true);
    const empty = mount({ canEdit: false });
    expect(q(empty, '.gc-empty')?.textContent).toBe('No goal yet');
    expect(q(empty, '.gc-input')).toBeNull();
  });

  it('limits the actions to what the host answers; the add box stays with canEdit', () => {
    const el = mount({ ...BASE, actions: ['delete'] });
    expect(acts(el)).toEqual(['delete']);
    expect(q(el, '.gc-input')).not.toBeNull();
    expect(qa(el, '.gc-rm')).toHaveLength(2);
    const paused = mount({ ...BASE, current: { ...BASE.current!, status: 'paused' }, actions: ['pause', 'resume'] });
    expect(acts(paused)).toEqual(['resume']);
    expect(qa(paused, '.gc-rm')).toHaveLength(0);
    const none = mount({ ...BASE, actions: [] });
    expect(q(none, '.gc-acts')).toBeNull();
    expect(qa(none, '.gc-rm')).toHaveLength(0);
    expect(q(none, '.gc-add-btn')).not.toBeNull();
    const ro = mount({ ...BASE, actions: ['delete'], canEdit: false });
    expect(qa(ro, '.gc-btn')).toHaveLength(0);
    expect(q(ro, '.gc-input')).toBeNull();
  });

  it('disarms an armed action the host stops answering', () => {
    vi.useFakeTimers({ now: NOW });
    const el = mount(BASE);
    press(el, '.gc-btn[data-act="delete"]');
    expect(q(el, '[data-armed]')).not.toBeNull();
    el.data = { ...BASE, actions: ['complete'] };
    el.renderNow();
    expect(q(el, '[data-armed]')).toBeNull();
    expect(q(el, '.gc-live')?.textContent).toBe('');
    el.data = BASE;
    el.renderNow();
    press(el, '.gc-q-row:nth-child(1) .gc-rm');
    expect(q(el, '.gc-rm[data-armed]')).not.toBeNull();
    el.data = { ...BASE, actions: ['complete'] };
    el.renderNow();
    expect(q(el, '.gc-rm')).toBeNull();
    expect(q(el, '.gc-live')?.textContent).toBe('');
  });

  it('draws the current goal’s budget meta after the times and its note under them', () => {
    const el = mount({
      ...BASE,
      current: {
        ...BASE.current!,
        meta: [{ label: 'Continues', value: '3/10' }, '$0.42'],
        note: '  Left: the rollback runbook.\nAnd the checklist.  ',
      },
    });
    const meta = q(el, '.gc-meta')!;
    expect(meta.textContent).toBe('Started 2h ago·Updated 5m ago·Continues 3/10·$0.42');
    expect(qa(el, '.gc-meta .gc-kv').map((k) => k.textContent)).toEqual(['Continues 3/10', '$0.42']);
    expect(q(el, '.gc-meta .gc-v')?.textContent).toBe('3/10');
    expect(q(el, '.gc-note')?.textContent).toBe('Left: the rollback runbook.\nAnd the checklist.');
    expect(q(el, '.gc-note')?.nextElementSibling?.className).toBe('gc-acts');
    // Meta alone makes the line; a blank note draws nothing.
    const only = mount({ current: { id: 'g', objective: 'x', status: 'active', meta: ['$1'], note: '  ' } });
    expect(q(only, '.gc-meta')?.textContent).toBe('$1');
    expect(q(only, '.gc-note')).toBeNull();
    expect(q(mount(BASE), '.gc-note')).toBeNull();
  });

  it('draws a past goal’s meta line and note', () => {
    const el = mount({
      ...BASE,
      history: [
        {
          id: 'h1',
          objective: 'Fix the flaky test',
          status: 'complete',
          endedAt: NOW - 3 * HOUR,
          meta: ['2h 10m active', { label: 'Continued', value: '2×' }],
          note: 'The retry loop masked a race.',
        },
        { id: 'h2', objective: 'Speed up search', status: 'failed' },
      ],
    });
    const rows = qa(el, '.gc-h-row');
    expect(rows[0].querySelector('.gc-h-meta')?.textContent).toBe('2h 10m active·Continued 2×');
    expect(rows[0].querySelector('.gc-h-note')?.textContent).toBe('The retry loop masked a race.');
    expect(rows[0].querySelector('.gc-h-obj')?.nextElementSibling?.className).toBe('gc-h-meta');
    expect(rows[1].querySelector('.gc-h-meta')).toBeNull();
    expect(rows[1].querySelector('.gc-h-note')).toBeNull();
  });

  it('draws a raw unknown status as written, neutral', () => {
    const el = mount({ current: { id: 'g', objective: 'x', status: 'evaluating' } });
    const chip = q(el, '.gc-head .gc-chip')!;
    expect(chip.textContent).toBe('evaluating');
    expect(chip.dataset.tone).toBe('idle');
    expect(acts(el)).toEqual(['complete', 'delete']);
  });
});

describe('<ui-goal-card> escaping', () => {
  const X = '<img src=x onerror=alert(1)>';
  const Q = `"><script>alert(2)</script>`;

  it('escapes every user and model string', () => {
    const el = mount({
      now: NOW,
      current: { id: Q, objective: X, status: X, progress: 0.5, meta: [X, { label: X, value: Q }], note: X },
      queue: [{ id: `${Q}q`, objective: X }],
      history: [{ id: `${Q}h`, objective: X, status: Q, meta: [{ label: Q, value: X }], note: Q }],
      error: X,
    });
    const root = el.shadowRoot!;
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('script')).toBeNull();
    expect(qa(el, '.gc-meta .gc-kv').map((k) => k.textContent)).toEqual([X, `${X} ${Q}`]);
    expect(q(el, '.gc-note')?.textContent).toBe(X);
    expect(q(el, '.gc-h-meta')?.textContent).toBe(`${Q} ${X}`);
    expect(q(el, '.gc-h-note')?.textContent).toBe(Q);
    expect(q(el, '.gc-obj')?.textContent).toBe(X);
    expect(q(el, '.gc-head .gc-chip')?.textContent).toBe(X);
    expect(q(el, '.gc-q-text')?.textContent).toBe(X);
    expect(q(el, '.gc-h-obj')?.textContent).toBe(X);
    expect(q(el, '.gc-h-row .gc-chip')?.textContent).toBe(Q);
    expect(q(el, '.gc-error-t')?.textContent).toBe(X);
    expect(q(el, '.gc-cur')?.getAttribute('data-mk')).toBe(`goal:${Q}`);
    expect(q(el, '.gc-btn[data-act="delete"]')?.dataset.id).toBe(Q);
    expect(q(el, '.gc-rm')?.dataset.id).toBe(`${Q}q`);
    expect(q(el, '.gc-obj')?.innerHTML).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('hands back the exact id of a goal whose id needs escaping', () => {
    vi.useFakeTimers({ now: NOW });
    const el = mount({
      current: { id: Q, objective: 'x', status: 'active' },
      queue: [{ id: `a"b<c>`, objective: 'y' }],
    });
    const pause = listen(el, 'ui-pause');
    const del = listen(el, 'ui-delete');
    press(el, '.gc-btn[data-act="pause"]');
    expect(detail(pause)).toEqual({ id: Q });
    press(el, '.gc-rm');
    vi.advanceTimersByTime(GOAL_ARM_GUARD_MS + 10);
    press(el, '.gc-rm');
    expect(detail(del)).toEqual({ id: 'a"b<c>', queued: true });
  });

  it('keeps the newlines of an objective as text', () => {
    const el = mount({ current: { id: 'g', objective: 'line one\nline two', status: 'active' } });
    expect(q(el, '.gc-obj')?.textContent).toBe('line one\nline two');
  });
});

describe('<ui-goal-card> fold', () => {
  const stubLayout = (el: UiGoalCard, scrollHeight: number, lineHeight = '20px', clientHeight = 60) => {
    const obj = q(el, '.gc-obj')!;
    Object.defineProperty(obj, 'scrollHeight', { configurable: true, get: () => scrollHeight });
    Object.defineProperty(obj, 'clientHeight', { configurable: true, get: () => clientHeight });
    vi.spyOn(globalThis, 'getComputedStyle').mockImplementation(
      () => ({ lineHeight }) as unknown as CSSStyleDeclaration,
    );
    return obj;
  };

  it('hides More until the objective is measured past three lines', () => {
    const el = mount(BASE);
    const more = q(el, '.gc-more')!;
    expect(more.hidden).toBe(true);
    stubLayout(el, 100);
    el.renderNow();
    expect(q(el, '.gc-more')).toBe(more);
    expect(more.hidden).toBe(false);
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(more.getAttribute('aria-controls')).toBe('gc-obj');
    expect(more.textContent).toBe('More');
  });

  it('keeps More hidden for an objective that fits', () => {
    const el = mount(BASE);
    stubLayout(el, 60);
    el.renderNow();
    expect(q(el, '.gc-more')?.hidden).toBe(true);
  });

  it('measures against the box when the line height is unknown', () => {
    const el = mount(BASE);
    stubLayout(el, 100, 'normal', 60);
    el.renderNow();
    expect(q(el, '.gc-more')?.hidden).toBe(false);
  });

  it('unfolds and folds the objective, which stays plain text', () => {
    const el = mount(BASE);
    const obj = stubLayout(el, 100);
    el.renderNow();
    press(el, '.gc-more');
    expect(q(el, '.gc-obj')).toBe(obj);
    expect(obj.hasAttribute('data-open')).toBe(true);
    expect(q(el, '.gc-more')?.getAttribute('aria-expanded')).toBe('true');
    expect(q(el, '.gc-more')?.textContent).toBe('Less');
    expect(obj.tagName).toBe('P');
    expect(obj.querySelector('button, a')).toBeNull();
    // A data update keeps it open.
    el.data = { ...BASE, error: 'x' };
    el.renderNow();
    expect(q(el, '.gc-obj')?.hasAttribute('data-open')).toBe(true);
    press(el, '.gc-more');
    expect(obj.hasAttribute('data-open')).toBe(false);
    expect(q(el, '.gc-more')?.textContent).toBe('More');
  });

  it('starts a new goal folded', () => {
    const el = mount(BASE);
    stubLayout(el, 100);
    el.renderNow();
    press(el, '.gc-more');
    el.data = { ...BASE, current: { ...BASE.current!, id: 'g2', objective: 'Next' } };
    el.renderNow();
    expect(q(el, '.gc-obj')?.hasAttribute('data-open')).toBe(false);
    expect(q(el, '.gc-obj')?.textContent).toBe('Next');
  });

  it('re-measures when the objective resizes (ResizeObserver), without a render', () => {
    const observers: Array<{ cb: () => void; targets: Element[] }> = [];
    class FakeRO {
      targets: Element[] = [];
      constructor(public cb: () => void) {
        observers.push(this);
      }
      observe(t: Element) {
        this.targets.push(t);
      }
      unobserve() {}
      disconnect() {
        this.targets = [];
      }
    }
    vi.stubGlobal('ResizeObserver', FakeRO);
    const el = mount(BASE);
    expect(observers).toHaveLength(1);
    expect(observers[0].targets).toEqual([q(el, '.gc-obj')]);
    expect(q(el, '.gc-more')?.hidden).toBe(true);
    stubLayout(el, 100);
    observers[0].cb();
    expect(q(el, '.gc-more')?.hidden).toBe(false);
    // A new goal's objective is observed instead.
    el.data = { ...BASE, current: { ...BASE.current!, id: 'g2' } };
    el.renderNow();
    expect(observers).toHaveLength(1);
    expect(observers[0].targets).toEqual([q(el, '.gc-obj')]);
    el.remove();
    expect(observers[0].targets).toEqual([]);
  });
});

describe('<ui-goal-card> two-press', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });
  const confirm = (el: UiGoalCard, s: string) => {
    press(el, s);
    vi.advanceTimersByTime(GOAL_ARM_GUARD_MS + 50);
    press(el, s);
  };

  it('arms Delete on the first press and deletes on the second', () => {
    const el = mount(BASE);
    const fired = listen(el, 'ui-delete');
    press(el, '.gc-btn[data-act="delete"]');
    const b = q(el, '.gc-btn[data-act="delete"]')!;
    expect(b.hasAttribute('data-armed')).toBe(true);
    expect(b.textContent).toBe('Delete?');
    expect(q(el, '.gc-live')?.textContent).toBe('Press again to delete the goal — the next one starts');
    expect(fired).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    press(el, '.gc-btn[data-act="delete"]');
    expect(fired).toHaveBeenCalledTimes(1);
    expect(detail(fired)).toEqual({ id: 'g1', queued: false });
    expect(q(el, '.gc-btn[data-act="delete"]')?.hasAttribute('data-armed')).toBe(false);
    expect(q(el, '.gc-live')?.textContent).toBe('');
  });

  it('treats a double click as one press', () => {
    const el = mount(BASE);
    const fired = listen(el, 'ui-delete');
    press(el, '.gc-btn[data-act="delete"]');
    vi.advanceTimersByTime(100);
    press(el, '.gc-btn[data-act="delete"]');
    expect(fired).not.toHaveBeenCalled();
    expect(q(el, '.gc-btn[data-act="delete"]')?.hasAttribute('data-armed')).toBe(true);
  });

  it('disarms after 4 s; a later press only arms again', () => {
    const el = mount(BASE);
    const fired = listen(el, 'ui-delete');
    press(el, '.gc-btn[data-act="delete"]');
    vi.advanceTimersByTime(GOAL_ARM_MS);
    el.renderNow();
    const b = q(el, '.gc-btn[data-act="delete"]')!;
    expect(b.hasAttribute('data-armed')).toBe(false);
    expect(b.textContent).toBe('Delete');
    press(el, '.gc-btn[data-act="delete"]');
    expect(fired).not.toHaveBeenCalled();
    expect(q(el, '.gc-btn[data-act="delete"]')?.hasAttribute('data-armed')).toBe(true);
  });

  it('disarms on Escape without letting it out of the card', () => {
    const el = mount(BASE);
    const outside = vi.fn();
    el.addEventListener('keydown', outside);
    press(el, '.gc-btn[data-act="delete"]');
    key(q(el, '.gc-btn[data-act="delete"]')!, 'Escape');
    el.renderNow();
    expect(q(el, '.gc-btn[data-act="delete"]')?.hasAttribute('data-armed')).toBe(false);
    expect(outside).not.toHaveBeenCalled();
    // Escape with nothing armed is not swallowed.
    key(q(el, '.gc-btn[data-act="delete"]')!, 'Escape');
    expect(outside).toHaveBeenCalledTimes(1);
  });

  it('disarms when focus leaves the armed button, not when it stays on it', () => {
    const el = mount(BASE);
    press(el, '.gc-btn[data-act="delete"]');
    const b = q(el, '.gc-btn[data-act="delete"]')!;
    b.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true, relatedTarget: b }));
    el.renderNow();
    expect(b.hasAttribute('data-armed')).toBe(true);
    b.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true, relatedTarget: document.body }));
    el.renderNow();
    expect(b.hasAttribute('data-armed')).toBe(false);
  });

  it('ignores a held Enter (key repeat) on a button', () => {
    const el = mount(BASE);
    press(el, '.gc-btn[data-act="delete"]');
    const e = key(q(el, '.gc-btn[data-act="delete"]')!, 'Enter', { repeat: true });
    expect(e.defaultPrevented).toBe(true);
    const first = key(q(el, '.gc-btn[data-act="delete"]')!, 'Enter');
    expect(first.defaultPrevented).toBe(false);
  });

  it('asks twice for Complete', () => {
    const el = mount(BASE);
    const fired = listen(el, 'ui-complete');
    press(el, '.gc-btn[data-act="complete"]');
    expect(q(el, '.gc-btn[data-act="complete"]')?.textContent).toBe('Complete?');
    expect(q(el, '.gc-live')?.textContent).toBe('Press again to mark the goal complete');
    expect(fired).not.toHaveBeenCalled();
    vi.advanceTimersByTime(GOAL_ARM_GUARD_MS + 50);
    press(el, '.gc-btn[data-act="complete"]');
    expect(detail(fired)).toEqual({ id: 'g1' });
  });

  it('asks twice to remove a queued goal', () => {
    const el = mount(BASE);
    const fired = listen(el, 'ui-delete');
    press(el, '.gc-q-row:nth-child(2) .gc-rm');
    const rm = q(el, '.gc-q-row:nth-child(2) .gc-rm')!;
    expect(rm.hasAttribute('data-armed')).toBe(true);
    expect(rm.getAttribute('aria-label')).toBe('Press again to remove queued goal 2');
    expect(rm.querySelector('.gc-btn-t')?.textContent).toBe('Remove?');
    expect(q(el, '.gc-live')?.textContent).toBe('Press again to remove queued goal 2');
    expect(q(el, '.gc-q-row:nth-child(1) .gc-rm')?.hasAttribute('data-armed')).toBe(false);
    vi.advanceTimersByTime(GOAL_ARM_GUARD_MS + 50);
    press(el, '.gc-q-row:nth-child(2) .gc-rm');
    expect(detail(fired)).toEqual({ id: 'q2', queued: true });
  });

  it('moves the arm to the last button pressed', () => {
    const el = mount(BASE);
    const fired = listen(el, 'ui-delete');
    press(el, '.gc-btn[data-act="delete"]');
    vi.advanceTimersByTime(500);
    press(el, '.gc-q-row:nth-child(1) .gc-rm');
    expect(q(el, '.gc-btn[data-act="delete"]')?.hasAttribute('data-armed')).toBe(false);
    expect(q(el, '.gc-q-row:nth-child(1) .gc-rm')?.hasAttribute('data-armed')).toBe(true);
    vi.advanceTimersByTime(500);
    press(el, '.gc-btn[data-act="delete"]');
    expect(fired).not.toHaveBeenCalled();
  });

  it('pauses and resumes in one press, disarming whatever was armed', () => {
    const el = mount(BASE);
    const pause = listen(el, 'ui-pause');
    press(el, '.gc-btn[data-act="delete"]');
    press(el, '.gc-btn[data-act="pause"]');
    expect(detail(pause)).toEqual({ id: 'g1' });
    expect(q(el, '[data-armed]')).toBeNull();
    const paused = mount({ ...BASE, current: { ...BASE.current!, status: 'paused' } });
    const resume = listen(paused, 'ui-resume');
    press(paused, '.gc-btn[data-act="resume"]');
    expect(detail(resume)).toEqual({ id: 'g1' });
  });

  it('disarms when the armed goal leaves the data or a write starts', () => {
    const el = mount(BASE);
    press(el, '.gc-q-row:nth-child(1) .gc-rm');
    el.data = { ...BASE, queue: BASE.queue!.slice(1) };
    el.renderNow();
    expect(q(el, '[data-armed]')).toBeNull();
    expect(q(el, '.gc-live')?.textContent).toBe('');
    press(el, '.gc-btn[data-act="delete"]');
    el.data = { ...BASE, busy: 'add' };
    el.renderNow();
    expect(q(el, '[data-armed]')).toBeNull();
  });

  it('confirms with the keyboard: Enter, then Enter again', () => {
    const el = mount(BASE);
    const fired = listen(el, 'ui-delete');
    confirm(el, '.gc-btn[data-act="delete"]');
    expect(fired).toHaveBeenCalledTimes(1);
  });
});

describe('<ui-goal-card> busy', () => {
  it('spins the busy action and holds every other one', () => {
    vi.useFakeTimers({ now: NOW });
    const el = mount({ ...BASE, busy: 'delete' });
    const del = q(el, '.gc-btn[data-act="delete"]')!;
    expect(del.getAttribute('aria-busy')).toBe('true');
    expect(del.textContent).toBe('Deleting…');
    expect(del.querySelector('.gc-spin')).not.toBeNull();
    for (const b of qa(el, '.gc-btn, .gc-rm')) expect(b.getAttribute('aria-disabled')).toBe('true');
    expect(q(el, '.gc-btn[data-act="complete"]')?.hasAttribute('aria-busy')).toBe(false);
    const fired = vi.fn();
    for (const n of ['ui-complete', 'ui-pause', 'ui-delete']) el.addEventListener(n, fired);
    press(el, '.gc-btn[data-act="pause"]');
    press(el, '.gc-btn[data-act="complete"]');
    vi.advanceTimersByTime(500);
    press(el, '.gc-btn[data-act="complete"]');
    expect(fired).not.toHaveBeenCalled();
    expect(q(el, '[data-armed]')).toBeNull();
    // Not `disabled`: a focused busy button keeps its focus.
    expect(del.hasAttribute('disabled')).toBe(false);
  });

  it('spins a queued goal’s remove by busyId', () => {
    const el = mount({ ...BASE, busy: 'delete', busyId: 'q2' });
    const rm = q(el, '.gc-q-row:nth-child(2) .gc-rm')!;
    expect(rm.getAttribute('aria-busy')).toBe('true');
    expect(rm.getAttribute('aria-label')).toBe('Removing…');
    expect(q(el, '.gc-q-row:nth-child(1) .gc-rm')?.hasAttribute('aria-busy')).toBe(false);
    expect(q(el, '.gc-btn[data-act="delete"]')?.hasAttribute('aria-busy')).toBe(false);
    expect(q(el, '.gc-btn[data-act="delete"]')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('says Resuming… on a paused goal’s toggle', () => {
    const el = mount({ ...BASE, current: { ...BASE.current!, status: 'paused' }, busy: 'pause' });
    expect(q(el, '.gc-btn[data-act="resume"]')?.textContent).toBe('Resuming…');
  });

  it('holds Add while a write is in flight but keeps the box editable', () => {
    const el = mount({ ...BASE, busy: 'add' });
    const fired = listen(el, 'ui-add');
    const btn = q(el, '.gc-add-btn')!;
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.textContent).toBe('Adding…');
    const ta = type(el, 'Another goal');
    expect(ta.disabled).toBe(false);
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    key(ta, 'Enter');
    btn.click();
    expect(fired).not.toHaveBeenCalled();
    expect(ta.value).toBe('Another goal');
  });
});

describe('<ui-goal-card> add', () => {
  it('adds the trimmed objective on Enter and clears the box', () => {
    const el = mount(BASE);
    const fired = listen(el, 'ui-add');
    const btn = q(el, '.gc-add-btn')!;
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    const ta = type(el, '  Write the changelog  ');
    expect(btn.hasAttribute('aria-disabled')).toBe(false);
    const e = key(ta, 'Enter');
    expect(e.defaultPrevented).toBe(true);
    expect(detail(fired)).toEqual({ objective: 'Write the changelog' });
    expect(ta.value).toBe('');
    expect(el.draft).toBe('');
    expect(btn.getAttribute('aria-disabled')).toBe('true');
  });

  it('adds with the Add button too', () => {
    const el = mount({});
    const fired = listen(el, 'ui-add');
    type(el, 'First goal');
    press(el, '.gc-add-btn');
    expect(detail(fired)).toEqual({ objective: 'First goal' });
  });

  it('keeps Shift+Enter and IME Enter as text', () => {
    const el = mount(BASE);
    const fired = listen(el, 'ui-add');
    const ta = type(el, 'Line one');
    expect(key(ta, 'Enter', { shiftKey: true }).defaultPrevented).toBe(false);
    expect(key(ta, 'Enter', { isComposing: true }).defaultPrevented).toBe(false);
    expect(key(ta, 'Enter', { keyCode: 229 } as KeyboardEventInit).defaultPrevented).toBe(false);
    expect(fired).not.toHaveBeenCalled();
    expect(ta.value).toBe('Line one');
  });

  it('rejects an empty objective', () => {
    const el = mount(BASE);
    const fired = listen(el, 'ui-add');
    const ta = type(el, '   ');
    key(ta, 'Enter');
    q(el, '.gc-add-btn')!.click();
    expect(fired).not.toHaveBeenCalled();
  });

  it('keeps the text when a listener prevents ui-add; draft = "" clears it later', () => {
    const el = mount(BASE);
    const fired = listen(el, 'ui-add', true);
    const ta = type(el, 'Keep me');
    key(ta, 'Enter');
    expect(fired).toHaveBeenCalledTimes(1);
    expect(ta.value).toBe('Keep me');
    expect(el.draft).toBe('Keep me');
    el.draft = '';
    expect(ta.value).toBe('');
    expect(q(el, '.gc-add-btn')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('keeps the draft through re-renders and when the box comes back', () => {
    const el = mount(BASE);
    const ta = type(el, 'Half-typed');
    el.data = { ...BASE, queue: [...BASE.queue!, { id: 'q3', objective: 'New' }] };
    el.renderNow();
    expect(q(el, '.gc-input')).toBe(ta);
    expect(ta.value).toBe('Half-typed');
    el.data = { ...BASE, canEdit: false };
    el.renderNow();
    expect(q(el, '.gc-input')).toBeNull();
    el.data = BASE;
    el.renderNow();
    expect((q(el, '.gc-input') as HTMLTextAreaElement).value).toBe('Half-typed');
  });

  it('honours maxLength with a counter', () => {
    const el = mount({ ...BASE, maxLength: 40 });
    const ta = q(el, '.gc-input') as HTMLTextAreaElement;
    expect(ta.getAttribute('maxlength')).toBe('40');
    expect(q(el, '.gc-count')?.textContent).toBe('0 / 40');
    type(el, 'Twelve chars');
    expect(q(el, '.gc-count')?.textContent).toBe('12 / 40');
    el.draft = 'x'.repeat(60);
    expect(el.draft).toHaveLength(40);
    expect(q(el, '.gc-input')).toBe(ta);
  });

  it('labels the box and points at the hint', () => {
    const el = mount(BASE);
    const ta = q(el, '.gc-input')!;
    expect(ta.getAttribute('aria-label')).toBe('Add a goal');
    expect(ta.getAttribute('aria-describedby')).toBe('gc-hint');
    expect(q(el, '#gc-hint')?.textContent).toBe('Enter to add · Shift+Enter for a new line');
  });
});

describe('<ui-goal-card> focus', () => {
  it('moves focus to the card when the focused control’s goal leaves', () => {
    const el = mount(BASE);
    const del = q(el, '.gc-btn[data-act="delete"]')!;
    del.focus();
    expect(el.shadowRoot!.activeElement).toBe(del);
    el.data = {
      ...BASE,
      current: { id: 'q1', objective: 'Audit contrast', status: 'active' },
      queue: BASE.queue!.slice(1),
    };
    el.renderNow();
    expect(q(el, '.gc-btn[data-act="delete"]')).not.toBe(del);
    expect(el.shadowRoot!.activeElement).toBe(q(el, '.gc'));
  });

  it('keeps focus on the pause toggle when it turns into Resume', () => {
    const el = mount(BASE);
    const b = q(el, '.gc-btn[data-act="pause"]')!;
    b.focus();
    el.data = { ...BASE, current: { ...BASE.current!, status: 'paused' } };
    el.renderNow();
    expect(q(el, '.gc-btn[data-act="resume"]')).toBe(b);
    expect(el.shadowRoot!.activeElement).toBe(b);
  });

  it('keeps the busy button focused', () => {
    const el = mount(BASE);
    const b = q(el, '.gc-btn[data-act="delete"]')!;
    b.focus();
    el.data = { ...BASE, busy: 'delete' };
    el.renderNow();
    expect(el.shadowRoot!.activeElement).toBe(b);
  });
});

describe('<ui-goal-card> times', () => {
  it('refreshes relative times in place every 30 s without a host clock', () => {
    vi.useFakeTimers({ now: NOW });
    const el = mount({ current: { id: 'g', objective: 'x', status: 'active', startedAt: NOW - 30_000 } });
    const t = q(el, '.gc-when')!;
    expect(t.textContent).toBe('Started just now');
    vi.advanceTimersByTime(30_000);
    expect(q(el, '.gc-when')).toBe(t);
    expect(t.textContent).toBe('Started 1m ago');
    el.remove();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not tick when the host passes now', () => {
    vi.useFakeTimers({ now: NOW });
    mount(BASE);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('<ui-goal-card> lang="ko"', () => {
  it('speaks Korean', () => {
    vi.useFakeTimers({ now: NOW });
    const el = mount(BASE, { lang: 'ko' });
    expect(q(el, '.gc-title')?.textContent).toBe('목표');
    expect(q(el, '.gc-head .gc-chip')?.textContent).toBe('진행 중');
    expect(qa(el, '.gc-meta .gc-when').map((t) => t.textContent)).toEqual(['2시간 전 시작', '5분 전 갱신']);
    expect(q(el, '[role="progressbar"]')?.getAttribute('aria-valuetext')).toBe('5개 중 3개 완료, 60%');
    expect(acts(el).length).toBe(3);
    expect(qa(el, '.gc-acts .gc-btn').map((b) => b.textContent)).toEqual(['완료', '일시정지', '삭제']);
    expect(q(el, '.gc-sub')?.textContent).toBe('다음 목표2');
    expect(q(el, '.gc-rm')?.getAttribute('aria-label')).toBe('1번째 대기 목표 삭제');
    expect(q(el, '.gc-input')?.getAttribute('placeholder')).toBe('목표 추가 — 지금 목표 다음에 시작');
    expect(q(el, '.gc-add-btn')?.textContent).toBe('추가');
    expect(q(el, '.gc-hint')?.textContent).toBe('Enter 추가 · Shift+Enter 줄바꿈');
    expect(q(el, '.gc-hist-t')?.textContent).toBe('지난 목표');
    expect(q(el, '.gc-more')?.textContent).toBe('펼치기');
    press(el, '.gc-btn[data-act="delete"]');
    expect(q(el, '.gc-btn[data-act="delete"]')?.textContent).toBe('삭제할까요?');
    expect(q(el, '.gc-live')?.textContent).toBe('한 번 더 누르면 목표를 삭제합니다 — 다음 목표가 시작됩니다');
    expect(q(mount({}, { lang: 'ko' }), '.gc-empty')?.textContent).toBe('아직 목표가 없습니다');
    const budget = mount(
      { ...BASE, actions: ['delete'], current: { ...BASE.current!, meta: [{ label: '이어하기', value: '3/10' }] } },
      { lang: 'ko' },
    );
    expect(q(budget, '.gc-meta')?.textContent).toBe('2시간 전 시작·5분 전 갱신·이어하기 3/10');
    expect(qa(budget, '.gc-acts .gc-btn').map((b) => b.textContent)).toEqual(['삭제']);
  });

  it('switches language when the attribute changes', () => {
    const el = mount(BASE);
    el.setAttribute('lang', 'ko');
    el.renderNow();
    expect(q(el, '.gc-title')?.textContent).toBe('목표');
  });
});

describe('styles and docs', () => {
  it('uses tokens only — no hex or rgba literals', () => {
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(styles).not.toMatch(/rgba?\(/i);
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('@media (hover: hover) and (pointer: fine)');
  });

  it('ships ≥ 3 demos that build without the network', () => {
    const fetchSpy = vi.fn(() => {
      throw new Error('no network in demos');
    });
    vi.stubGlobal('fetch', fetchSpy);
    expect(doc.tag).toBe('ui-goal-card');
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const d of doc.demos) {
      const el = d.create();
      document.body.append(el);
      for (const card of Array.from(el.matches('ui-goal-card') ? [el] : el.querySelectorAll('ui-goal-card')))
        (card as UiGoalCard).renderNow();
      expect(el).toBeInstanceOf(HTMLElement);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('the host-actions demo draws only Delete, with meta and notes', () => {
    const el = doc.demos.find((d) => d.id === 'host-actions')!.create() as UiGoalCard;
    document.body.append(el);
    el.renderNow();
    expect(acts(el)).toEqual(['delete']);
    expect(q(el, '.gc-note')).not.toBeNull();
    expect(qa(el, '.gc-meta .gc-kv').length).toBeGreaterThan(0);
    expect(qa(el, '.gc-h-meta')).toHaveLength(2);
  });

  it('the demo host answers intents with new data', () => {
    vi.useFakeTimers({ now: NOW });
    const el = doc.demos[0].create() as UiGoalCard;
    document.body.append(el);
    el.renderNow();
    press(el, '.gc-btn[data-act="pause"]');
    expect(el.data?.busy).toBe('pause');
    vi.advanceTimersByTime(700);
    el.renderNow();
    expect(el.data?.current?.status).toBe('paused');
    expect(q(el, '.gc-btn[data-act="resume"]')).not.toBeNull();
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
    spy = soundSpy();
  });
  afterEach(() => spy.restore());
  /** Fake timers: play what the queue holds, then start a fresh gesture. */
  const settle = () => {
    vi.advanceTimersByTime(40);
    resetSoundQueue();
  };
  const click = (el: UiGoalCard, s: string) => {
    q(el, s)!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail: 1 }));
    el.renderNow();
    settle();
  };
  const confirm = (el: UiGoalCard, s: string) => {
    click(el, s);
    vi.advanceTimersByTime(GOAL_ARM_GUARD_MS);
    click(el, s);
  };
  const ARM = ['tap', { emphasis: 'subtle', input: 'mouse' }];

  it('delete: arming taps subtly, confirming plays a strong close; a double click is one press', () => {
    const el = mount(BASE);
    click(el, '.gc-btn[data-act="delete"]');
    click(el, '.gc-btn[data-act="delete"]');
    vi.advanceTimersByTime(GOAL_ARM_GUARD_MS);
    click(el, '.gc-btn[data-act="delete"]');
    expect(spy.calls).toEqual([ARM, ['close', { emphasis: 'strong', input: 'mouse' }]]);
  });

  it('complete: arming taps subtly, confirming taps; removing a queued goal closes strongly', () => {
    const el = mount(BASE);
    confirm(el, '.gc-btn[data-act="complete"]');
    confirm(el, '.gc-q-row:nth-child(1) .gc-rm');
    expect(spy.calls).toEqual([
      ARM,
      ['tap', { input: 'mouse' }],
      ARM,
      ['close', { emphasis: 'strong', input: 'mouse' }],
    ]);
  });

  it('pause plays toggle back, resume toggle forward', () => {
    click(mount(BASE), '.gc-btn[data-act="pause"]');
    click(mount({ ...BASE, current: { ...BASE.current!, status: 'paused' } }), '.gc-btn[data-act="resume"]');
    expect(spy.calls).toEqual([
      ['toggle', { direction: 'back', input: 'mouse' }],
      ['toggle', { direction: 'forward', input: 'mouse' }],
    ]);
  });

  it('add taps; keystrokes in the box play type while typing is on; prevented events are silent', () => {
    spy.restore();
    spy = soundSpy({ typing: true });
    const el = mount(BASE);
    const ta = type(el, 'Write the changelog');
    ta.setSelectionRange(ta.value.length, ta.value.length);
    key(ta, 'x');
    settle();
    key(ta, 'Enter', { shiftKey: true });
    settle();
    key(ta, 'Enter');
    settle();
    expect(spy.calls).toEqual([
      ['type', { key: 'printable', input: 'keyboard' }],
      ['type', { key: 'enter', input: 'keyboard' }],
      ['tap', { input: 'keyboard' }],
    ]);
    for (const name of ['ui-add', 'ui-delete', 'ui-pause']) listen(el, name, true);
    type(el, 'Kept');
    click(el, '.gc-add-btn');
    click(el, '.gc-btn[data-act="pause"]');
    vi.advanceTimersByTime(GOAL_ARM_GUARD_MS);
    confirm(el, '.gc-btn[data-act="delete"]');
    expect(spy.calls.slice(3)).toEqual([ARM]);
  });

  it('el.data from code is silent, and so is a card inside data-ui-sound="off"', () => {
    const el = mount(BASE);
    el.data = { ...BASE, current: { ...BASE.current!, status: 'paused' }, busy: 'pause' };
    el.renderNow();
    el.data = { ...BASE, current: { ...BASE.current!, status: 'complete' } };
    el.renderNow();
    settle();
    expect(spy.calls).toEqual([]);
    const quiet = document.createElement('div');
    quiet.setAttribute('data-ui-sound', 'off');
    document.body.append(quiet);
    const muted = document.createElement('ui-goal-card');
    quiet.append(muted);
    muted.data = BASE;
    muted.renderNow();
    click(muted, '.gc-btn[data-act="pause"]');
    confirm(muted, '.gc-btn[data-act="delete"]');
    expect(spy.calls).toEqual([]);
  });
});
