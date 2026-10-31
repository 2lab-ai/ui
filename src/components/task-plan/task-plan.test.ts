import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type PlanStep, planCss } from '../../core/plan';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import {
  type TaskPlanData,
  type TaskPlanMore,
  type TaskPlanToggle,
  taskEarlierSteps,
  taskFateCounts,
  taskFateSummary,
  taskStepFate,
  taskWindow,
  type UiTaskPlan,
} from './task-plan';

const XSS = '<img src=x onerror=alert(1)>';
const NOW = Date.UTC(2026, 9, 27, 9, 0, 0);

function mount(data: TaskPlanData | undefined, attrs: Record<string, string> = {}): UiTaskPlan {
  const el = document.createElement('ui-task-plan');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiTaskPlan, s: string) => el.shadowRoot!.querySelector<E>(s);
const qa = (el: UiTaskPlan, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const live = (el: UiTaskPlan) => el.shadowRoot!.querySelector('[aria-live]')!.textContent ?? '';
const text = (n: Element | null | undefined) => n?.textContent ?? '';

const STEPS: PlanStep[] = [
  {
    id: 's1',
    ref: '#1',
    label: 'Read the failing test',
    status: 'done',
    startedAt: NOW - 600_000,
    endedAt: NOW - 562_000,
    toolCalls: 3,
  },
  { id: 's2', label: 'Find the cause', status: 'done', startedAt: NOW - 562_000, endedAt: NOW - 300_000, toolCalls: 9 },
  {
    id: 's3',
    label: 'Fix the parser',
    detail: 'Editing src/parse.ts',
    status: 'running',
    startedAt: NOW - 68_000,
    toolCalls: 2,
    steps: [
      { id: 's3a', label: 'Handle empty input', status: 'done', startedAt: NOW - 68_000, endedAt: NOW - 40_000 },
      { id: 's3b', label: 'Handle nested quotes', status: 'running', startedAt: NOW - 40_000 },
      { id: 's3c', label: 'Add a regression test', status: 'pending' },
    ],
  },
  { id: 's4', label: 'Run the suite', status: 'pending', note: '~2 min' },
  { id: 's5', label: 'Update the changelog', status: 'paused', startedAt: NOW - 900_000, toolCalls: 1 },
];

const EARLIER: TaskPlanData['earlier'] = [
  {
    id: 'p1',
    title: 'Plan 1',
    steps: [
      { id: 'p1a', label: 'Read the report', status: 'done', startedAt: NOW - 2_000_000, endedAt: NOW - 1_940_000 },
      { id: 'p1b', label: 'Patch the coupon parser', status: 'running', startedAt: NOW - 1_900_000 },
      { id: 'p1c', label: 'Ship a hotfix', status: 'pending', movedTo: 'Plan 2' },
    ],
  },
];

const BASE: TaskPlanData = { title: 'Fix the checkout bug', steps: STEPS, earlier: EARLIER };

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('0.15.1 — step times in the surface language', () => {
  it('a done step under lang="ko" says its time in Korean (9분 22초), not 9m 22s', async () => {
    const { UiTaskPlan } = await import('./task-plan');
    void UiTaskPlan;
    const el = document.createElement('ui-task-plan') as HTMLElement & { data: unknown; renderNow(): void };
    el.setAttribute('lang', 'ko');
    document.body.append(el);
    el.data = {
      steps: [
        { id: 'a', title: '설계', status: 'done', startedAt: 1_000_000, endedAt: 1_000_000 + 9 * 60_000 + 22_000 },
      ],
    };
    el.renderNow();
    const text = el.shadowRoot!.textContent ?? '';
    expect(text).toContain('9분 22초');
    expect(text).not.toMatch(/\b9m 22s\b/);
    el.remove();
  });
});

describe('pure helpers', () => {
  it('derives an earlier step’s fate: its own, else moved / done / dropped', () => {
    expect(taskStepFate({ status: 'done' })).toBe('done');
    expect(taskStepFate({ status: 'pending' })).toBe('dropped');
    expect(taskStepFate({ status: 'running' })).toBe('dropped');
    expect(taskStepFate({ status: 'done', movedTo: 'Plan 2' })).toBe('moved');
    expect(taskStepFate({ status: 'pending', fate: 'done' })).toBe('done');
    expect(taskStepFate({ status: 'pending', fate: 'bogus' as never })).toBe('dropped');
  });

  it('stills an earlier plan: running becomes paused (sub-steps too), unknown becomes pending, fates attach', () => {
    const out = taskEarlierSteps([
      { id: 'a', label: 'A', status: 'running', steps: [{ id: 'a1', label: 'A1', status: 'running' }] },
      { id: 'b', label: 'B', status: 'weird' as never },
      { id: 'c', label: 'C', status: 'done', movedTo: 'Plan 3' },
    ]);
    expect(out.map((s) => [s.status, s.fate])).toEqual([
      ['paused', 'dropped'],
      ['pending', 'dropped'],
      ['done', 'moved'],
    ]);
    expect(out[0].steps?.[0].status).toBe('paused');
    expect(out[0].steps?.[0].fate).toBeUndefined();
    expect(taskEarlierSteps(undefined as never)).toEqual([]);
  });

  it('windows a plan: the earliest done leave first, then the latest pending; the running step stays', () => {
    const s = (...st: string[]) => st.map((status) => ({ status }) as PlanStep);
    // 3 done · running · 4 pending, max 4: the three done fold, then one pending off the end.
    expect(taskWindow(s('done', 'done', 'done', 'running', 'pending', 'pending', 'pending', 'pending'), 4)).toEqual({
      shown: [3, 4, 5, 6],
      hidden: 4,
    });
    // Fits: nothing hidden. 0 / junk: the whole plan.
    expect(taskWindow(s('done', 'running', 'pending'), 3)).toEqual({ shown: [0, 1, 2], hidden: 0 });
    expect(taskWindow(s('done', 'running', 'pending'), 0)).toEqual({ shown: [0, 1, 2], hidden: 0 });
    expect(taskWindow(s('done', 'running', 'pending'), Number.NaN)).toEqual({ shown: [0, 1, 2], hidden: 0 });
    // Only pending to cut: the last ones go, the running step (last) stays.
    expect(taskWindow(s('pending', 'pending', 'pending', 'running'), 2)).toEqual({ shown: [0, 3], hidden: 2 });
    // Nothing done or pending to cut: paused / failed go from the end; a running step never goes.
    expect(taskWindow(s('failed', 'paused', 'running', 'paused'), 2)).toEqual({ shown: [0, 2], hidden: 2 });
    expect(taskWindow(s('running', 'running', 'running'), 1)).toEqual({ shown: [0, 1, 2], hidden: 0 });
    expect(taskWindow(s('done', 'bogus' as never, 'running'), 1)).toEqual({ shown: [2], hidden: 2 });
  });

  it('counts fates and says them, leaving out zeros', () => {
    const c = taskFateCounts(EARLIER![0].steps);
    expect(c).toEqual({ done: 1, dropped: 1, moved: 1 });
    expect(taskFateSummary(c)).toBe('1 done · 1 dropped · 1 moved');
    expect(taskFateSummary({ done: 3, dropped: 0, moved: 2 }, 'ko')).toBe('완료 3 · 이동 2');
    expect(taskFateSummary({ done: 0, dropped: 0, moved: 0 })).toBe('');
  });
});

describe('<ui-task-plan> rendering', () => {
  it('carries the shared plan look (planCss) before its own styles', () => {
    const el = mount(BASE);
    const css = el.shadowRoot?.querySelector('style')?.textContent ?? '';
    expect(css).toContain(planCss.trim().slice(0, 60));
    expect(css.indexOf(planCss.trim().slice(0, 60))).toBeLessThan(css.indexOf('.tp {'));
  });

  it('renders nothing without data', () => {
    const el = mount(undefined);
    expect(q(el, '.tp')).toBeNull();
  });

  it('draws the plan: heading, a marker per state, the current step, sub-steps, chips, notes and the foot', () => {
    const el = mount(BASE);
    expect(text(q(el, '.tp-title'))).toBe('Fix the checkout bug');
    expect(q(el, '.tp')?.getAttribute('aria-labelledby')).toBe('tp-title');
    const rows = qa(el, '.tp-list > .pl-step');
    expect(rows.map((r) => r.dataset.step)).toEqual(['done', 'done', 'running', 'pending', 'paused']);
    expect(qa(el, '[aria-current="step"]').map((r) => r.querySelector('.pl-text')?.textContent)).toEqual([
      'Fix the parser',
      'Handle nested quotes',
    ]);
    expect(rows[0].querySelector('.pl-ref')?.textContent).toBe('#1');
    expect(rows[0].querySelector('.pl-chip')?.textContent).toBe('3 tool calls');
    expect(rows[0].querySelector(':scope > .pl-aside')?.textContent).toBe('38s');
    expect(rows[2].querySelector(':scope > .pl-main > .pl-sub')?.textContent).toBe('Editing src/parse.ts');
    expect(rows[3].querySelector(':scope > .pl-aside')?.textContent).toBe('~2 min');
    // Sub-steps: a nested, named list under their step.
    const subs = rows[2].querySelector('.pl-subs')!;
    expect(subs.getAttribute('aria-label')).toBe('Sub-steps of Fix the parser');
    expect(Array.from(subs.children).map((r) => (r as HTMLElement).dataset.step)).toEqual([
      'done',
      'running',
      'pending',
    ]);
    // A chip (icon + word) on paused, none on the obvious states.
    expect(rows[4].querySelector('.pl-state')?.textContent).toBe('Paused');
    expect(rows[4].querySelector('.pl-state svg')).not.toBeNull();
    expect(rows[4].querySelector('.pl-state')?.getAttribute('aria-hidden')).toBe('true');
    expect(rows.slice(0, 4).some((r) => r.querySelector(':scope > .pl-main > .pl-line > .pl-state'))).toBe(false);
    expect(rows.map((r) => r.querySelector(':scope > .pl-main > .sr-only')?.textContent)).toEqual([
      ', done',
      ', done',
      ', in progress',
      ', pending',
      ', paused',
    ]);
    expect(q(el, '.pl-foot')?.dataset.phase).toBe('running');
    expect(text(q(el, '.pl-foot-st'))).toBe('Running · 2/5');
    expect(text(q(el, '.pl-foot-time'))).toBe('15m 00s');
  });

  it('ticks the running clocks in place once a second and stops when disconnected', () => {
    const el = mount(BASE);
    const step = q(el, '.tp-list > .pl-step[data-step="running"] > .pl-aside > span')!;
    const sub = q(el, '.pl-subs > .pl-step[data-step="running"] > .pl-aside > span')!;
    const foot = q(el, '.pl-foot-time > span')!;
    const section = q(el, '.tp');
    expect([step.textContent, sub.textContent, foot.textContent]).toEqual(['1m 08s', '40s', '15m 00s']);
    vi.advanceTimersByTime(3000);
    expect(q(el, '.tp-list > .pl-step[data-step="running"] > .pl-aside > span')).toBe(step);
    expect(q(el, '.tp')).toBe(section);
    expect([step.textContent, sub.textContent, foot.textContent]).toEqual(['1m 11s', '43s', '15m 03s']);
    el.remove();
    vi.advanceTimersByTime(5000);
    expect(step.textContent).toBe('1m 11s');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not tick when nothing runs, and stops ticking once the plan finishes', () => {
    const el = mount(BASE);
    expect(vi.getTimerCount()).toBe(1);
    el.data = { steps: STEPS.map((s) => ({ ...s, status: 'done' as const, endedAt: NOW, steps: undefined })) };
    el.renderNow();
    expect(vi.getTimerCount()).toBe(0);
    expect(q(el, '[data-since]')).toBeNull();
    expect(text(q(el, '.pl-foot-st'))).toBe('Done · 5/5');
    expect(text(q(el, '.pl-foot-time'))).toBe('15m 00s');
  });

  it('corrects the clocks for the host’s clock skew (data.now)', () => {
    const el = mount({ steps: [STEPS[2]], now: NOW + 60_000 });
    expect(text(q(el, '.tp-list > .pl-step > .pl-aside'))).toBe('2m 08s');
    vi.advanceTimersByTime(2000);
    expect(text(q(el, '.tp-list > .pl-step > .pl-aside'))).toBe('2m 10s');
  });

  it('folds earlier plans behind one toggle; opening shows each step’s fate and reports ui-toggle', () => {
    const el = mount(BASE);
    const btn = q<HTMLButtonElement>(el, '.pl-earlier-btn[data-earlier="earlier-plans"]')!;
    const region = q(el, '#pl-earlier-earlier-plans')!;
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-controls')).toBe('pl-earlier-earlier-plans');
    expect(text(btn.querySelector('.pl-earlier-label'))).toBe('Earlier plans');
    expect(text(btn.querySelector('.pl-earlier-count'))).toBe('1');
    expect(text(btn.querySelector('.pl-earlier-meta'))).toBe('1 done · 1 dropped · 1 moved');
    expect(region.hasAttribute('inert')).toBe(true);
    expect(region.closest('.pl-earlier')?.hasAttribute('data-open')).toBe(false);

    const seen: Array<{ detail: TaskPlanToggle; cancelable: boolean }> = [];
    el.addEventListener('ui-toggle', (e) => {
      const ev = e as CustomEvent<TaskPlanToggle>;
      seen.push({ detail: ev.detail, cancelable: ev.cancelable });
    });
    btn.focus();
    btn.click();
    expect(seen).toEqual([{ detail: { id: 'earlier-plans', open: true }, cancelable: false }]);
    // Morphed, not replaced: the same nodes, so the 0fr → 1fr transition runs and focus stays.
    expect(q(el, '.pl-earlier-btn[data-earlier="earlier-plans"]')).toBe(btn);
    expect(q(el, '#pl-earlier-earlier-plans')).toBe(region);
    expect(el.shadowRoot!.activeElement).toBe(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(region.hasAttribute('inert')).toBe(false);
    expect(region.closest('.pl-earlier')?.hasAttribute('data-open')).toBe(true);

    expect(text(region.querySelector('.tp-past-title'))).toBe('Plan 1');
    expect(text(region.querySelector('.tp-past-meta'))).toBe('1 done · 1 dropped · 1 moved');
    const past = Array.from(region.querySelectorAll<HTMLElement>('.tp-past-list > .pl-step'));
    expect(past.map((r) => r.dataset.step)).toEqual(['done', 'paused', 'pending']);
    expect(past.map((r) => r.querySelector('.pl-fate')?.getAttribute('data-fate'))).toEqual([
      'done',
      'dropped',
      'moved',
    ]);
    expect(past.map((r) => text(r.querySelector('.pl-fate')))).toEqual(['Done', 'Dropped', 'Moved to Plan 2']);
    expect(past.every((r) => r.querySelector('.pl-fate svg'))).toBe(true);
    // Nothing in a replaced plan runs or ticks.
    expect(region.querySelector('[data-since]')).toBeNull();
    expect(region.querySelector('[aria-current]')).toBeNull();
    expect(text(past[0].querySelector('.pl-aside'))).toBe('1m 00s');

    btn.click();
    expect(seen[1].detail).toEqual({ id: 'earlier-plans', open: false });
    expect(region.hasAttribute('inert')).toBe(true);
  });

  it('folds the leading done steps past three behind “Show N more completed”, in order', () => {
    const done = (i: number): PlanStep => ({ id: `d${i}`, label: `Step ${i}`, status: 'done' });
    const el = mount({ steps: [...[0, 1, 2, 3, 4, 5].map(done), { id: 'r', label: 'Now', status: 'running' }] });
    const btn = q<HTMLButtonElement>(el, '.pl-earlier-btn[data-earlier="earlier-steps"]')!;
    expect(text(btn)).toBe('Show 3 more completed');
    expect(qa(el, '.tp-lead > .pl-step').map((r) => text(r.querySelector('.pl-text')))).toEqual([
      'Step 0',
      'Step 1',
      'Step 2',
    ]);
    expect(qa(el, '.tp-list > .pl-step').map((r) => text(r.querySelector('.pl-text')))).toEqual([
      'Step 3',
      'Step 4',
      'Step 5',
      'Now',
    ]);
    expect(q(el, '#pl-earlier-earlier-steps')?.hasAttribute('inert')).toBe(true);
    const seen: TaskPlanToggle[] = [];
    el.addEventListener('ui-toggle', (e) => seen.push((e as CustomEvent<TaskPlanToggle>).detail));
    btn.click();
    expect(seen).toEqual([{ id: 'earlier-steps', open: true }]);
    expect(text(btn)).toBe('Hide completed');
    expect(q(el, '#pl-earlier-earlier-steps')?.hasAttribute('inert')).toBe(false);
    // The foot counts the whole plan, folded steps included.
    expect(text(q(el, '.pl-foot-st'))).toBe('Running · 6/7');
    // Three or fewer leading done steps: no fold.
    const short = mount({ steps: [done(0), done(1), done(2), { id: 'p', label: 'P', status: 'pending' }] });
    expect(q(short, '.pl-earlier')).toBeNull();
  });

  it('keeps the fold open and focus on its toggle across new data', () => {
    const el = mount(BASE);
    const btn = q<HTMLButtonElement>(el, '.pl-earlier-btn')!;
    btn.focus();
    btn.click();
    el.data = { ...BASE, steps: STEPS.map((s) => (s.id === 's4' ? { ...s, status: 'running' as const } : s)) };
    el.renderNow();
    expect(el.shadowRoot!.activeElement).toBe(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('opens a fold from the host with setOpen() — no event, no sound — and takes the host’s labels (D3 G5-3)', () => {
    const el = mount({ ...BASE, labels: { earlier: 'Dropped before they ran', earlierList: 'Dropped tasks' } });
    const seen: TaskPlanToggle[] = [];
    el.addEventListener('ui-toggle', (e) => seen.push((e as CustomEvent<TaskPlanToggle>).detail));
    const btn = q<HTMLButtonElement>(el, '.pl-earlier-btn[data-earlier="earlier-plans"]')!;
    expect(text(btn.querySelector('.pl-earlier-label'))).toBe('Dropped before they ran');
    expect(q(el, '.tp-pasts')?.getAttribute('aria-label')).toBe('Dropped tasks');
    expect(el.isOpen('earlier-plans')).toBe(false);
    el.setOpen('earlier-plans', true);
    el.renderNow();
    expect(el.isOpen('earlier-plans')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(q(el, '#pl-earlier-earlier-plans')?.hasAttribute('inert')).toBe(false);
    el.setOpen('earlier-plans', false);
    el.renderNow();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    el.setOpen('nope' as never, true);
    expect(el.isOpen('nope' as never)).toBe(false);
    expect(seen).toEqual([]);
    // No step left: the host's own line, or none at all when the fold says it.
    const none = mount({ steps: [], earlier: EARLIER, labels: { noSteps: 'Every task was dropped before it ran' } });
    expect(text(q(none, '.tp-none'))).toBe('Every task was dropped before it ran');
    expect(q(mount({ steps: [], earlier: EARLIER, labels: { noSteps: '' } }), '.tp-none')).toBeNull();
    expect(text(q(mount({ steps: [], earlier: EARLIER, labels: { earlier: ' ' } }), '.pl-earlier-label'))).toBe(
      'Earlier plans',
    );
  });

  it('says what is empty: no plan, or no steps in the current plan', () => {
    const empty = mount({ steps: [] });
    expect(text(q(empty, '.tp-empty strong'))).toBe('No plan yet');
    expect(q(empty, '.tp-empty svg')).not.toBeNull();
    expect(q(empty, '.pl-foot')).toBeNull();
    const none = mount({ steps: [], earlier: EARLIER });
    expect(text(q(none, '.tp-none'))).toBe('No steps in this plan yet');
    expect(q(none, '.pl-earlier')).not.toBeNull();
    expect(q(none, '.pl-foot')).toBeNull();
    expect(q(mount({ steps: [], earlier: [{ id: 'x', title: 'X', steps: [] }] }), '.tp-empty')).not.toBeNull();
  });

  it('draws the default heading, none for an empty title, and survives junk', () => {
    expect(text(q(mount({ steps: STEPS }), '.tp-title'))).toBe('Plan');
    const bare = mount({ title: '', steps: STEPS });
    expect(q(bare, '.tp-head')).toBeNull();
    expect(q(bare, '.tp')?.getAttribute('aria-label')).toBe('Plan');
    const junk = mount({ steps: [null, { id: 'a', label: 'A', status: 'bogus' }] as never, earlier: 'x' as never });
    expect(qa(junk, '.tp-list > .pl-step').map((r) => r.dataset.step)).toEqual(['pending']);
  });
});

describe('window mode (max) — a card’s few rows and one “+N” button to the whole plan (D7 D-12)', () => {
  const done = (i: number): PlanStep => ({
    id: `d${i}`,
    label: `Step ${i}`,
    status: 'done',
    startedAt: NOW - (i + 2) * 60_000,
    endedAt: NOW - (i + 1) * 60_000,
  });
  const LONG: PlanStep[] = [
    ...[0, 1, 2, 3, 4, 5].map(done),
    { id: 'r', label: 'Now', status: 'running', startedAt: NOW - 30_000 },
    { id: 'p1', label: 'Next', status: 'pending' },
    { id: 'p2', label: 'Then', status: 'pending' },
    { id: 'p3', label: 'Last', status: 'pending' },
  ];

  it('keeps at most max rows — the earliest done folded, the latest pending cut — with no lead fold and a “+N more” button', () => {
    const el = mount({ title: '', steps: LONG }, { max: '4' });
    expect(qa(el, '.tp-list > .pl-step').map((r) => text(r.querySelector('.pl-text')))).toEqual([
      'Now',
      'Next',
      'Then',
      'Last',
    ]);
    expect(q(el, '.tp-list')?.classList.contains('tp-window')).toBe(true);
    expect(q(el, '.tp-list')?.getAttribute('aria-label')).toBe('Plan steps, 4 of 10');
    expect(q(el, '.pl-earlier')).toBeNull();
    expect(q(el, '.pl-fold')).toBeNull();
    const btn = q<HTMLButtonElement>(el, '.tp-more-btn')!;
    expect(text(btn)).toBe('+6 more');
    expect(btn.dataset.key).toBe('tp-more');
    expect(btn.type).toBe('button');
    // The running row still ticks; the foot still counts the whole plan.
    expect(text(q(el, '.tp-list > .pl-step[data-step="running"] > .pl-aside'))).toBe('30s');
    expect(text(q(el, '.pl-foot-st'))).toBe('Running · 6/10');
    // The button follows the list and comes before the foot.
    const kids = Array.from(q(el, '.tp')!.children).map((c) => c.className);
    expect(kids).toEqual(['pl-list tp-list tp-window', 'tp-more', 'pl-foot']);
  });

  it('data.max wins over the attribute; a plan that fits draws no “+N”; max off draws the lead fold again', () => {
    const el = mount({ steps: LONG, max: 3 }, { max: '8' });
    expect(qa(el, '.tp-list > .pl-step').length).toBe(3);
    expect(text(q(el, '.tp-more-btn'))).toBe('+7 more');
    el.data = { steps: LONG.slice(5), max: 5 };
    el.renderNow();
    expect(qa(el, '.tp-list > .pl-step').length).toBe(5);
    expect(q(el, '.tp-more')).toBeNull();
    expect(q(el, '.tp-list')?.getAttribute('aria-label')).toBe('Plan steps');
    el.data = { steps: LONG };
    el.removeAttribute('max');
    el.renderNow();
    expect(q(el, '.tp-more')).toBeNull();
    expect(q(el, '.pl-earlier-btn[data-earlier="earlier-steps"]')).not.toBeNull();
    expect(qa(el, '.tp-list > .pl-step').length).toBe(7);
    // Junk caps mean the whole plan.
    el.setAttribute('max', 'lots');
    el.renderNow();
    expect(qa(el, '.tp-list > .pl-step').length).toBe(7);
    expect(q(el, '.tp-window')).toBeNull();
  });

  it('foot="none" draws no phase foot — in a window or not — and data.foot does the same', () => {
    const el = mount({ title: '', steps: LONG }, { max: '3', foot: 'none' });
    expect(q(el, '.pl-foot')).toBeNull();
    expect(q(el, '.tp-more-btn')).not.toBeNull();
    const full = mount({ ...BASE, foot: 'none' });
    expect(q(full, '.pl-foot')).toBeNull();
    expect(q(full, '.pl-earlier')).not.toBeNull();
    full.data = BASE;
    full.renderNow();
    expect(q(full, '.pl-foot')).not.toBeNull();
    // Only "none" turns it off.
    expect(q(mount({ steps: STEPS }, { foot: 'yes' }), '.pl-foot')).not.toBeNull();
  });

  it('draws the host’s own “+N” words, escaped, and reports ui-more (not cancelable) with hidden and total', () => {
    const el = mount({ title: '', steps: LONG, more: `+3 done · all 10 tasks → ${XSS}` }, { max: '4' });
    const btn = q<HTMLButtonElement>(el, '.tp-more-btn')!;
    expect(text(btn)).toBe(`+3 done · all 10 tasks → ${XSS}`);
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    const seen: Array<{ detail: TaskPlanMore; cancelable: boolean; bubbles: boolean; composed: boolean }> = [];
    el.addEventListener('ui-more', (e) => {
      const ev = e as CustomEvent<TaskPlanMore>;
      seen.push({ detail: ev.detail, cancelable: ev.cancelable, bubbles: ev.bubbles, composed: ev.composed });
    });
    btn.focus();
    btn.click();
    expect(seen).toEqual([{ detail: { hidden: 6, total: 10 }, cancelable: false, bubbles: true, composed: true }]);
    // Nothing changed here: the same rows, no fold opened, no ui-toggle.
    expect(qa(el, '.tp-list > .pl-step').length).toBe(4);
    // Focus survives new data (data-key).
    el.data = {
      title: '',
      steps: LONG.map((s) => (s.id === 'p1' ? { ...s, status: 'running' as const } : s)),
      more: ' ',
    };
    el.renderNow();
    expect(el.shadowRoot!.activeElement).toBe(q(el, '.tp-more-btn'));
    // Blank host words: the element's own.
    expect(text(q(el, '.tp-more-btn'))).toBe('+6 more');
  });

  it('a window keeps the current step in view even past max, and the sr list name says the window', () => {
    const el = mount(
      { title: '', steps: [...[0, 1, 2].map(done), { id: 'r', label: 'Now', status: 'running' }] },
      { max: '1' },
    );
    expect(qa(el, '.tp-list > .pl-step').map((r) => text(r.querySelector('.pl-text')))).toEqual(['Now']);
    expect(q(el, '[aria-current="step"]')).not.toBeNull();
    expect(q(el, '.tp-list')?.getAttribute('aria-label')).toBe('Plan steps, 1 of 4');
    expect(text(q(el, '.tp-more-btn'))).toBe('+3 more');
  });

  it('says it in Korean: “+N개 더” and the window’s list name', () => {
    const el = mount({ title: '', steps: LONG }, { max: '3', lang: 'ko' });
    expect(text(q(el, '.tp-more-btn'))).toBe('+7개 더');
    expect(q(el, '.tp-list')?.getAttribute('aria-label')).toBe('계획 단계, 전체 10개 중 3개');
    el.data = { steps: LONG, more: '+6 완료 · 전체 task 10개 →' };
    el.renderNow();
    expect(text(q(el, '.tp-more-btn'))).toBe('+6 완료 · 전체 task 10개 →');
  });

  it('the “+N” button is a 44px target on coarse pointers, quiet otherwise, and still under reduced motion', () => {
    const el = mount({ steps: LONG }, { max: '3' });
    const css = el.shadowRoot?.querySelector('style')?.textContent ?? '';
    expect(css).toMatch(/\(pointer: coarse\)[^{]*\{\s*\.tp-more-btn \{ min-height: 44px; \}/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[^}]*\.tp-more-btn \{ transition: none !important; \}/);
    expect(css).toContain('.tp-more-btn:hover { background: var(--ib-pill); color: var(--text); }');
    expect(css).not.toMatch(/\.tp-more-btn[^{]*\{[^}]*#[0-9a-f]{3,6}/i);
  });
});

describe('escaping', () => {
  it('escapes every host / model string', () => {
    const el = mount({
      title: XSS,
      steps: [
        {
          id: XSS,
          ref: XSS,
          label: XSS,
          detail: XSS,
          note: XSS,
          status: 'paused',
          fate: 'moved',
          movedTo: XSS,
          toolCalls: 2,
          steps: [{ id: `${XSS}2`, label: XSS, detail: XSS, note: XSS, status: 'running', startedAt: NOW - 1000 }],
        },
      ],
      earlier: [
        { id: XSS, title: XSS, steps: [{ id: `${XSS}3`, label: XSS, ref: XSS, status: 'pending', movedTo: XSS }] },
      ],
    });
    q<HTMLButtonElement>(el, '.pl-earlier-btn')!.click();
    const html = el.shadowRoot!.innerHTML;
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    const all = Array.from(el.shadowRoot!.querySelectorAll('*'));
    expect(all.some((n) => n.getAttributeNames().some((a) => a.startsWith('on')))).toBe(false);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(text(q(el, '.tp-title'))).toBe(XSS);
    expect(text(q(el, '.tp-list .pl-fate'))).toBe(`Moved to ${XSS}`);
    expect(text(q(el, '.tp-list > .pl-step > .pl-aside'))).toBe(XSS);
    expect(q(el, '.pl-subs')?.getAttribute('aria-label')).toBe(`Sub-steps of ${XSS}`);
    expect(text(q(el, '.tp-past-title'))).toBe(XSS);
    expect(q(el, '.tp-past-list')?.getAttribute('aria-label')).toBe(XSS);
  });
});

describe('announcements', () => {
  it('is silent on the first render, then says what finished, failed or paused — and pops those markers', () => {
    const el = mount(BASE);
    expect(live(el)).toBe('');
    expect(q(el, '.pl-pop')).toBeNull();
    const next = STEPS.map((s) =>
      s.id === 's3'
        ? {
            ...s,
            status: 'done' as const,
            endedAt: NOW,
            steps: s.steps!.map((c) => (c.id === 's3b' ? { ...c, status: 'failed' as const } : c)),
          }
        : s,
    );
    el.data = { ...BASE, steps: next };
    el.renderNow();
    expect(live(el)).toBe('Step done: Fix the parser. Step failed: Handle nested quotes');
    expect(qa(el, '.pl-pop').map((r) => r.dataset.step)).toEqual(['done', 'failed']);
    el.data = { ...BASE, steps: next };
    el.renderNow();
    expect(q(el, '.pl-pop')).toBeNull();
  });

  it('an emptied and refilled plan is a new plan, not changes', () => {
    const el = mount(BASE);
    el.data = { steps: [] };
    el.renderNow();
    el.data = { steps: STEPS.map((s) => ({ ...s, status: 'done' as const })) };
    el.renderNow();
    expect(live(el)).toBe('');
  });
});

describe('lang="ko"', () => {
  it('uses Korean strings throughout', () => {
    const el = mount({ ...BASE, title: undefined }, { lang: 'ko' });
    expect(text(q(el, '.tp-title'))).toBe('계획');
    expect(q(el, '.tp-list')?.getAttribute('aria-label')).toBe('계획 단계');
    expect(text(q(el, '.tp-list .pl-chip'))).toBe('툴 3회');
    expect(text(q(el, '.pl-state'))).toBe('멈춤');
    expect(text(q(el, '.pl-foot-st'))).toBe('실행 중 · 2/5');
    expect(q(el, '.pl-subs')?.getAttribute('aria-label')).toBe('Fix the parser 하위 단계');
    expect(
      qa(el, '.tp-list > .pl-step').map((r) => r.querySelector(':scope > .pl-main > .sr-only')?.textContent),
    ).toEqual([', 완료', ', 완료', ', 진행 중', ', 대기', ', 멈춤']);
    const btn = q(el, '.pl-earlier-btn')!;
    expect(text(btn.querySelector('.pl-earlier-label'))).toBe('이전 계획');
    expect(text(btn.querySelector('.pl-earlier-meta'))).toBe('완료 1 · 제외 1 · 이동 1');
    expect(qa(el, '.tp-past-list .pl-fate').map(text)).toEqual(['완료', '제외됨', '이동 → Plan 2']);
    expect(text(q(mount({ steps: [] }, { lang: 'ko' }), '.tp-empty strong'))).toBe('아직 계획이 없습니다');
    const many = mount(
      { steps: [0, 1, 2, 3].map((i) => ({ id: `d${i}`, label: `S${i}`, status: 'done' as const })) },
      { lang: 'ko' },
    );
    expect(text(q(many, '.pl-earlier-btn'))).toBe('완료 1개 더 보기');
    el.data = { ...BASE, steps: STEPS.map((s) => (s.id === 's3' ? { ...s, status: 'done' as const } : s)) };
    el.renderNow();
    expect(live(el)).toBe('단계 완료: Fix the parser');
  });

  it('switches language when the attribute changes', async () => {
    const el = mount(BASE);
    el.setAttribute('lang', 'ko');
    await Promise.resolve();
    expect(text(q(el, '.pl-foot-st'))).toBe('실행 중 · 2/5');
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
    n!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail }));

  it('an earlier fold opens / closes (ui-toggle cannot be prevented, so every press sounds)', async () => {
    const el = mount(BASE);
    tap(q(el, '.pl-earlier-btn'));
    await spy.settle();
    tap(q(el, '.pl-earlier-btn'), 0);
    await spy.settle();
    expect(spy.calls).toEqual([
      ['open', { emphasis: 'subtle', input: 'mouse' }],
      ['close', { emphasis: 'subtle', input: 'keyboard' }],
    ]);
  });

  it('the window’s “+N” is silent: the host’s surface that opens says it', async () => {
    const el = mount({ steps: [...STEPS, { id: 'x', label: 'X', status: 'pending' }] }, { max: '2' });
    const seen: TaskPlanMore[] = [];
    el.addEventListener('ui-more', (e) => seen.push((e as CustomEvent<TaskPlanMore>).detail));
    tap(q(el, '.tp-more-btn'));
    await spy.settle();
    expect(seen.length).toBe(1);
    expect(spy.calls).toEqual([]);
  });

  it('nothing for data the app sets or in a data-ui-sound="off" region', async () => {
    const el = mount(BASE);
    el.data = { ...BASE, steps: STEPS.map((s) => ({ ...s, status: 'done' as const })) };
    el.renderNow();
    await spy.settle();
    expect(spy.calls).toEqual([]);
    const quiet = document.createElement('div');
    quiet.setAttribute('data-ui-sound', 'off');
    document.body.append(quiet);
    quiet.append(el);
    tap(q(el, '.pl-earlier-btn'));
    await spy.settle();
    expect(spy.calls).toEqual([]);
  });
});
