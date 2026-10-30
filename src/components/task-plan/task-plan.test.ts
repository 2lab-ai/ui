import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type PlanStep, planCss } from '../../core/plan';
import {
  type TaskPlanData,
  type TaskPlanToggle,
  taskEarlierSteps,
  taskFateCounts,
  taskFateSummary,
  taskStepFate,
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
