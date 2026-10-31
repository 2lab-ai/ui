import type { PlanStep } from '../../core/plan';
import type { ComponentDoc } from '../../docs/types';
import '../elapsed/elapsed';
import './task-plan';
import type { TaskPlanData, TaskPlanEarlier, UiTaskPlan } from './task-plan';

const S = 1000;
const M = 60 * S;

function make(data: TaskPlanData, attrs: Record<string, string> = {}): UiTaskPlan {
  const el = document.createElement('ui-task-plan');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

/** A demo that moves on by itself; stops once the element is gone. */
function every(el: HTMLElement, ms: number, step: () => boolean): void {
  const id = window.setInterval(() => {
    if (!el.isConnected || !step()) window.clearInterval(id);
  }, ms);
}

function liveSteps(now: number, stage: number): PlanStep[] {
  const t0 = now - 9 * M - 40 * S;
  const sub = (i: number): PlanStep['status'] => (stage > i ? 'done' : stage === i ? 'running' : 'pending');
  const subAt = (i: number) => now - (3 - i) * 20 * S;
  return [
    {
      id: 't1',
      ref: '#1',
      label: 'Reproduce the failing checkout test',
      status: 'done',
      startedAt: t0,
      endedAt: t0 + 1 * M + 12 * S,
      toolCalls: 4,
    },
    {
      id: 't2',
      ref: '#2',
      label: 'Find why the coupon total rounds down',
      status: 'done',
      startedAt: t0 + 1 * M + 12 * S,
      endedAt: t0 + 6 * M + 5 * S,
      toolCalls: 11,
    },
    {
      id: 't3',
      ref: '#3',
      label: 'Fix the rounding in the cart total',
      detail: stage < 3 ? 'Editing src/cart/total.ts' : 'Checking the last case',
      status: stage < 3 ? 'running' : 'done',
      startedAt: t0 + 6 * M + 5 * S,
      endedAt: stage < 3 ? undefined : now,
      toolCalls: 3 + stage,
      steps: [
        {
          id: 't3a',
          label: 'Round once, after the discount',
          status: sub(0),
          startedAt: subAt(0),
          endedAt: stage > 0 ? subAt(1) : undefined,
        },
        {
          id: 't3b',
          label: 'Keep cents as integers',
          status: sub(1),
          startedAt: stage >= 1 ? subAt(1) : undefined,
          endedAt: stage > 1 ? subAt(2) : undefined,
        },
        {
          id: 't3c',
          label: 'Add a regression test for 3 × $0.10',
          status: sub(2),
          startedAt: stage >= 2 ? subAt(2) : undefined,
          endedAt: stage > 2 ? now : undefined,
        },
      ],
    },
    {
      id: 't4',
      ref: '#4',
      label: 'Run the checkout suite',
      status: stage >= 3 ? 'running' : 'pending',
      startedAt: stage >= 3 ? now : undefined,
      note: stage >= 3 ? undefined : '~2 min',
    },
    { id: 't5', ref: '#5', label: 'Update the pricing docs', status: 'paused', startedAt: t0 - 12 * M, toolCalls: 2 },
    { id: 't6', ref: '#6', label: 'Open the pull request', status: 'pending' },
  ];
}

function earlierPlans(now: number): TaskPlanEarlier[] {
  const t0 = now - 31 * M;
  return [
    {
      id: 'p1',
      title: 'Plan 1 · first pass',
      steps: [
        {
          id: 'p1-1',
          label: 'Read the bug report',
          status: 'done',
          startedAt: t0,
          endedAt: t0 + 2 * M + 4 * S,
          toolCalls: 2,
        },
        {
          id: 'p1-2',
          label: 'Patch the coupon parser',
          status: 'running',
          startedAt: t0 + 2 * M + 4 * S,
          toolCalls: 6,
        },
        { id: 'p1-3', label: 'Ship a hotfix', status: 'pending' },
      ],
    },
    {
      id: 'p2',
      title: 'Plan 2 · after the repro',
      steps: [
        {
          id: 'p2-1',
          label: 'Reproduce the failing checkout test',
          status: 'done',
          startedAt: t0 + 9 * M,
          endedAt: t0 + 10 * M,
          toolCalls: 3,
        },
        { id: 'p2-2', label: 'Fix the rounding in the cart total', status: 'running', movedTo: 'Plan 3' },
        { id: 'p2-3', label: 'Ask finance about rounding rules', status: 'pending' },
        { id: 'p2-4', label: 'Update the pricing docs', status: 'pending', movedTo: 'Plan 3' },
      ],
    },
  ];
}

function finished(): TaskPlanData {
  const t0 = Date.now() - 52 * M;
  const step = (i: number, label: string, mins: number, calls: number): PlanStep => ({
    id: `f${i}`,
    ref: `#${i + 1}`,
    label,
    status: 'done',
    startedAt: t0 + i * 3 * M,
    endedAt: t0 + i * 3 * M + mins * M + 14 * S,
    toolCalls: calls,
  });
  return {
    title: 'Weekly dependency upgrade',
    steps: [
      step(0, 'List outdated packages', 1, 2),
      step(1, 'Upgrade vite and vitest', 2, 5),
      step(2, 'Fix two type errors from the new React types', 2, 9),
      step(3, 'Run the test suite', 2, 3),
      step(4, 'Open the pull request', 1, 4),
      { id: 'f5', ref: '#6', label: 'Post the summary to the team channel', status: 'skipped', note: 'Not needed' },
    ],
  };
}

function koPlan(): TaskPlanData {
  const now = Date.now();
  const t0 = now - 14 * M;
  return {
    title: '결제 화면 반올림 오류 수정',
    steps: [
      {
        id: 'k1',
        ref: '#1',
        label: '실패하는 테스트 재현',
        status: 'done',
        startedAt: t0,
        endedAt: t0 + 2 * M,
        toolCalls: 4,
      },
      {
        id: 'k2',
        ref: '#2',
        label: '장바구니 합계 반올림 수정',
        detail: 'src/cart/total.ts 수정 중',
        status: 'running',
        startedAt: t0 + 2 * M,
        toolCalls: 6,
        steps: [
          { id: 'k2a', label: '할인 후 한 번만 반올림', status: 'done', startedAt: t0 + 2 * M, endedAt: t0 + 5 * M },
          { id: 'k2b', label: '센트를 정수로 유지', status: 'running', startedAt: t0 + 5 * M },
        ],
      },
      { id: 'k3', ref: '#3', label: '가격 문서 갱신', status: 'paused', startedAt: t0 - 20 * M, toolCalls: 1 },
      { id: 'k4', ref: '#4', label: '풀 리퀘스트 열기', status: 'pending', note: '약 2분' },
    ],
    earlier: [
      {
        id: 'kp1',
        title: '계획 1',
        steps: [
          { id: 'kp1-1', label: '버그 리포트 읽기', status: 'done', startedAt: t0 - 9 * M, endedAt: t0 - 8 * M },
          { id: 'kp1-2', label: '쿠폰 파서 패치', status: 'pending', movedTo: '계획 2' },
          { id: 'kp1-3', label: '핫픽스 배포', status: 'pending' },
        ],
      },
    ],
  };
}

function longPlan(): TaskPlanData {
  const now = Date.now();
  const t0 = now - 41 * M;
  const labels = [
    'Collect the error logs from the last 24 hours',
    'Group the errors by endpoint',
    'Read the three noisiest handlers',
    'Find the shared timeout setting',
    'Raise the upstream timeout to 8 s',
    'Add a retry with jitter',
  ];
  const steps: PlanStep[] = labels.map((label, i) => ({
    id: `l${i}`,
    ref: `#${i + 1}`,
    label,
    status: 'done',
    startedAt: t0 + i * 5 * M,
    endedAt: t0 + i * 5 * M + 4 * M + 10 * S,
    toolCalls: 2 + ((i * 3) % 7),
  }));
  steps.push(
    {
      id: 'l6',
      ref: '#7',
      label: 'Load-test the checkout endpoint',
      detail: 'k6 run · 200 virtual users',
      status: 'failed',
      startedAt: t0 + 30 * M,
      endedAt: t0 + 33 * M,
      toolCalls: 5,
    },
    {
      id: 'l7',
      ref: '#8',
      label: 'Retry the load test',
      status: 'running',
      startedAt: now - 3 * M - 8 * S,
      toolCalls: 1,
    },
    { id: 'l8', ref: '#9', label: 'Write the incident note', status: 'pending' },
    { id: 'l9', ref: '#10', label: 'Page the on-call reviewer', status: 'dropped', note: 'Not needed' },
  );
  return { title: 'Investigate the checkout timeouts', steps };
}

/** The long plan in Korean, for the window demo's second card. */
function koLongPlan(): TaskPlanData {
  const base = longPlan();
  const labels = [
    '최근 24시간 오류 로그 수집',
    '엔드포인트별로 오류 묶기',
    '가장 시끄러운 핸들러 세 개 읽기',
    '공유 타임아웃 설정 찾기',
    '업스트림 타임아웃 8초로 올리기',
    '지터가 있는 재시도 추가',
    '결제 엔드포인트 부하 테스트',
    '부하 테스트 다시 실행',
    '장애 노트 작성',
    '온콜 리뷰어 호출',
  ];
  return {
    title: '결제 타임아웃 조사',
    steps: base.steps.map((s, i) => ({
      ...s,
      label: labels[i] ?? s.label,
      detail: s.detail ? 'k6 실행 · 가상 사용자 200명' : undefined,
      note: s.note ? '불필요' : undefined,
    })),
  };
}

export const doc: ComponentDoc = {
  slug: 'task-plan',
  name: 'Task Plan',
  tag: 'ui-task-plan',
  group: 'Components',
  summary: 'What the agent plans to do for this task, where it is now — and what happened to the plans it replaced.',
  description:
    'The agent’s plan as one rail: a marker per step (check, spinner, ring, cross, dash, pause, slash), the running step bold with its clock ticking in place, sub-steps nested under their step, and a status chip (icon + word) on paused, failed, skipped and dropped steps. Leading completed steps past three fold behind “Show N more completed”; plans the agent replaced fold behind “Earlier plans”, each step with its fate — done, dropped, or moved to a later plan. The foot carries the phase, done/total and the time. The rail, markers and foot are the same renderer `<ui-agent-run>` draws its plan with (`src/core/plan.ts`).',
  usedIn: 'soma-work dashboard › session panel › Tasks (plan)',
  reference: { name: 'affectUI Agent Run (plan)', url: 'https://www.affectui.com/components/agent-run' },
  props: [
    {
      name: 'data.steps',
      type: 'PlanStep[]',
      required: true,
      description:
        'The current plan in order: `{ id, label, status, ref?, detail?, startedAt?, endedAt?, toolCalls?, note?, fate?, movedTo?, steps? }`. Status: pending · running · done · failed · skipped · paused · dropped. Ids are unique across the plan, sub-steps included.',
    },
    {
      name: 'data.steps[].steps',
      type: 'PlanStep[]',
      description: 'Sub-steps, drawn as a smaller rail under the step (up to four levels).',
    },
    {
      name: 'data.steps[].note',
      type: 'string',
      description:
        'The right column when no clock runs (`~2 min`, `Not needed`). A running step shows its live clock instead; a note wins over a finished step’s run time.',
    },
    {
      name: 'data.steps[].fate / movedTo',
      type: "'done' | 'dropped' | 'moved' / string",
      description:
        'A badge for a step that left its plan: `Done`, `Dropped`, `Moved to Plan 3`. Earlier plans derive it when absent (movedTo → moved, done → done, else dropped).',
    },
    {
      name: 'data.earlier',
      type: 'Array<{ id: string; title: string; steps: PlanStep[] }>',
      description:
        'Plans this one replaced, oldest first, folded behind “Earlier plans” with their fate counts. Nothing in them runs: a step still marked running shows as paused.',
    },
    {
      name: 'data.labels',
      type: '{ earlier?: string; earlierList?: string; noSteps?: string }',
      description:
        'The host’s own words: the earlier fold’s label (“Dropped before they ran”) and its region’s name, and the line for a plan with no step left (`""` draws none — when the fold says it all).',
    },
    {
      name: 'setOpen(id, open) / isOpen(id)',
      type: 'method',
      description:
        'Open or close a fold (`earlier-plans` | `earlier-steps`) from the host — a “see every task” landing — without an event or a sound; and read whether it is open.',
    },
    {
      name: 'data.title',
      type: 'string',
      default: "'Plan' / '계획'",
      description: 'Heading. An empty string draws none (the host has its own).',
    },
    {
      name: 'data.now',
      type: 'number',
      description:
        'The host’s clock (epoch ms) when it built the data. Running clocks correct for the skew between it and this device.',
    },
    {
      name: 'max',
      type: 'attribute / data.max: number',
      description:
        'Window mode — for a narrow card that shows a few rows of a plan and links to the whole one: at most this many step rows. When the plan is longer, the earliest done steps leave first, then the latest pending ones from the end; the running step always stays. No lead fold inside a window; the rows left out are one quiet “+N” button at the end. The list’s name says the window (“Plan steps, 3 of 12”). `taskWindow(steps, max)` is the rule, exported.',
    },
    {
      name: 'foot',
      type: "attribute / data.foot: 'none'",
      description: 'No phase foot — when the host’s face (a card’s status row) already says the phase and the time.',
    },
    {
      name: 'data.more',
      type: 'string',
      default: "'+N more' / '+N개 더'",
      description:
        'The window’s “+N” button in the host’s words (`+3 done · all 12 tasks →`, `+3 완료 · 전체 task 12개 →`). Its press is `ui-more`; the host opens its full plan.',
    },
    { name: 'lang', type: "'en' | 'ko'", default: "'en'", description: 'UI language (attribute).' },
    {
      name: 'flush',
      type: 'boolean attribute',
      description: 'Drops the card chrome (border, padding, shadow) to sit inside a host panel.',
    },
  ],
  events: [
    {
      name: 'ui-toggle',
      detail: "{ id: 'earlier-plans' | 'earlier-steps'; open: boolean }",
      description:
        'A fold was opened or closed (a report, not cancelable). The fold state is the element’s own; the host may store it.',
    },
    {
      name: 'ui-more',
      detail: '{ hidden: number; total: number }',
      description:
        'The window’s “+N” button was pressed (a report, not cancelable): the host opens the whole plan — the panel’s `<ui-task-plan>`, a drawer. Nothing changes in the element.',
    },
  ],
  keyboard: [
    [
      'Tab',
      'Moves to the “Earlier plans” and “Show N more completed” toggles, or a window’s “+N” button (the steps are not focusable).',
    ],
    ['Enter / Space', 'Opens or closes the focused fold; presses “+N” (ui-more).'],
  ],
  a11y: [
    'A section labelled by the heading; each list is an `<ol>` with a name, sub-steps a nested `<ol>` named after their step.',
    'Each step ends with its state as text (“, in progress”); the running step has `aria-current="step"`. Status chips are icon + word and hidden from screen readers where that text already says it.',
    'Folds are buttons with `aria-expanded` / `aria-controls`; a closed region is `inert` (nothing inside takes focus or clicks).',
    'A polite live region says when a step is done, failed or paused (never on the first render). Clocks tick in text nodes, never re-rendering; the foot’s clock is hidden from screen readers.',
    'Reduced motion: no marker pop or rail draw; folds fade (120 ms) without growing; the “+N” button does not press-scale.',
    'A window’s “+N” is a native button (44px on coarse pointers) that keeps focus across new data; the list’s name says how many of the plan’s steps it shows.',
    'Sound (opt-in, @2lab.ai/ui/sound): a quiet open / close when the person opens or folds earlier plans or steps. The “+N” button is silent — the host’s surface that opens plays its own cue. Silent until the page turns sound on.',
  ],
  usage: `<ui-task-plan id="plan"></ui-task-plan>
<script type="module">
  import '@2lab.ai/ui/task-plan';
  const plan = document.getElementById('plan');
  plan.data = {
    title: 'Fix the checkout rounding bug',
    steps: [
      { id: 't1', label: 'Reproduce the failing test', status: 'done', startedAt: t0, endedAt: t1, toolCalls: 4 },
      { id: 't2', label: 'Fix the cart total', status: 'running', startedAt: t1, steps: [
        { id: 't2a', label: 'Round once, after the discount', status: 'done' },
        { id: 't2b', label: 'Keep cents as integers', status: 'running', startedAt: t2 },
      ] },
      { id: 't3', label: 'Run the checkout suite', status: 'pending', note: '~2 min' },
    ],
    earlier: [{ id: 'p1', title: 'Plan 1', steps: [
      { id: 'p1-1', label: 'Patch the coupon parser', status: 'running', movedTo: 'Plan 2' },
    ] }],
  };
  plan.addEventListener('ui-toggle', (e) => console.log(e.detail)); // { id: 'earlier-plans', open: true }
</script>`,
  demos: [
    {
      id: 'live',
      title: 'Live plan with sub-steps and earlier plans',
      description:
        'The running step and sub-step tick in place; every few seconds a sub-step finishes (its marker pops, the rail draws down). Open “Earlier plans” to see how the replaced plans’ steps ended.',
      height: 640,
      create() {
        const now = Date.now();
        const earlier = earlierPlans(now);
        let stage = 0;
        const el = make({ title: 'Fix the checkout rounding bug', steps: liveSteps(now, stage), earlier });
        every(el, 4000, () => {
          stage++;
          el.data = { title: 'Fix the checkout rounding bug', steps: liveSteps(now, stage), earlier };
          return stage < 3;
        });
        return el;
      },
    },
    {
      id: 'finished',
      title: 'Finished plan',
      description: 'Every step done (one skipped with a note): the foot says Done with the total time.',
      height: 340,
      create: () => make(finished()),
    },
    {
      id: 'long',
      title: 'Long plan, earlier steps folded',
      description:
        'Six completed steps lead the plan: the first three fold behind “Show 3 more completed” (0fr → 1fr). A failed load test, its retry running, and a dropped step.',
      height: 520,
      create: () => make(longPlan()),
    },
    {
      id: 'window',
      title: 'Window — a card’s few rows',
      description:
        'max="4" foot="none": a narrow card shows four rows of a ten-step plan — the earliest done steps fold first, the latest pending ones are cut, the running step stays — and one quiet “+N” button in the host’s words. The card’s face already says the phase and the time, so there is no foot. Press “+N”: the host gets ui-more and, here, opens the whole plan in place (Replay to window it again).',
      height: 420,
      create: () => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;padding:4px 0';
        const card = (lang: 'en' | 'ko', data: TaskPlanData, face: string, opened: string) => {
          const box = document.createElement('div');
          box.style.cssText =
            'flex:1 1 280px;max-width:340px;min-width:0;padding:12px 14px;border:1px solid var(--ui-ib-card-border);border-radius:12px;background:var(--ui-ib-card);box-shadow:var(--ui-ib-shadow)';
          if (lang === 'ko') box.lang = 'ko';
          const head = document.createElement('div');
          head.style.cssText = 'display:flex;align-items:center;gap:8px;margin:0 0 8px;font-size:13px';
          head.innerHTML = `<span class="ui-status is-pill" data-tone="run"></span><ui-elapsed style="margin-left:auto;font-size:12px;color:var(--ui-ib-muted)"></ui-elapsed>`;
          (head.querySelector('.ui-status') as HTMLElement).textContent = face;
          const clock = head.querySelector('ui-elapsed') as HTMLElement & { data?: unknown };
          clock.setAttribute('lang', lang);
          clock.data = { since: data.steps[0]?.startedAt };
          const el = make(data, { lang, flush: '', max: '4', foot: 'none' });
          const said = document.createElement('p');
          said.className = 'ui-status-line';
          said.style.cssText = 'margin:8px 0 0;min-height:18px';
          el.addEventListener('ui-more', (e) => {
            const { hidden, total } = (e as CustomEvent<{ hidden: number; total: number }>).detail;
            el.removeAttribute('max');
            el.removeAttribute('foot');
            said.textContent = `${opened} — ui-more { hidden: ${hidden}, total: ${total} }`;
            said.dataset.tone = 'done';
          });
          box.append(head, el, said);
          return box;
        };
        const en = longPlan();
        const ko = koLongPlan();
        row.append(
          card('en', { ...en, title: '', more: '+6 done · all 10 tasks →' }, 'Running · 6/10', 'Opened the whole plan'),
          card(
            'ko',
            { ...ko, title: '', more: '+6 완료 · 전체 task 10개 →' },
            '실행 중 · 6/10',
            '전체 계획을 열었습니다',
          ),
        );
        return row;
      },
    },
    {
      id: 'empty',
      title: 'Empty',
      description: 'No plan yet.',
      height: 200,
      create: () => make({ steps: [] }),
    },
    {
      id: 'dropped',
      title: 'Nothing left to run, opened by the host',
      description:
        'A new plan dropped every task before it ran: no step is left, so the host names the fold (“Dropped before they ran”), draws no “no steps” line and opens the fold itself with setOpen() — as a “see every task” landing would.',
      height: 320,
      create: () => {
        const el = make({
          title: 'Plan 3',
          steps: [],
          earlier: earlierPlans(Date.now()),
          labels: { earlier: 'Dropped before they ran', earlierList: 'Tasks dropped before they ran', noSteps: '' },
        });
        el.setOpen('earlier-plans', true);
        return el;
      },
    },
    {
      id: 'ko',
      title: 'Korean (lang="ko")',
      description: 'Status chips, fates, fold labels and the foot in Korean.',
      height: 460,
      create: () => make(koPlan(), { lang: 'ko' }),
    },
  ],
};
