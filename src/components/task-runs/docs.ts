import type { ComponentDoc } from '../../docs/types';
import './task-runs';
import type { TaskRun, TaskRunsData, UiTaskRuns } from './task-runs';

const S = 1000;
const M = 60 * S;

function make(data: TaskRunsData, attrs: Record<string, string> = {}, open: string[] = []): UiTaskRuns {
  const el = document.createElement('ui-task-runs');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  for (const id of open) el.setOpen(id, true);
  // The demo host opens nothing: it keeps the page where it is.
  el.addEventListener('ui-open', (e) => e.preventDefault());
  return el;
}

function checkoutRuns(now: number): TaskRun[] {
  const t0 = now - 24 * M;
  return [
    {
      id: 'T1',
      ref: '#T1',
      title: 'Reproduce the failing checkout test',
      status: 'done',
      startedAt: t0,
      endedAt: t0 + 1 * M + 12 * S,
      tokens: { input: 1_840, output: 920, cacheRead: 38_400, cacheWrite: 2_100 },
      tools: [
        { name: 'Bash', count: 3 },
        { name: 'Read', count: 2 },
      ],
      costUsd: 0.06,
      href: 'https://example.com/runs/T1',
    },
    {
      id: 'T2',
      ref: '#T2',
      title: 'Find why the coupon total rounds down',
      status: 'done',
      startedAt: t0 + 1 * M + 12 * S,
      endedAt: t0 + 7 * M + 5 * S,
      tokens: { input: 6_210, output: 3_480, cacheRead: 152_300, cacheWrite: 8_800 },
      tools: [
        { name: 'Grep', count: 6 },
        { name: 'Read', count: 9 },
        { name: 'Bash', count: 2 },
      ],
      costUsd: 0.31,
      revisions: [
        { at: t0 + 1 * M + 12 * S, note: 'Find why the coupon total is wrong' },
        { at: t0 + 3 * M + 40 * S, note: 'Narrowed to rounding: “why the coupon total rounds down”' },
      ],
      href: 'https://example.com/runs/T2',
    },
    {
      id: 'T3',
      ref: '#T3',
      title: 'Patch the coupon parser',
      status: 'dropped',
      startedAt: t0 + 7 * M + 5 * S,
      endedAt: t0 + 9 * M + 30 * S,
      tokens: { input: 2_020, output: 1_150, cacheRead: 61_000 },
      tools: [{ name: 'Edit', count: 2 }],
      costUsd: 0.09,
      revisions: [{ at: t0 + 9 * M + 30 * S, note: 'Replaced by the new plan: the parser was not the cause' }],
    },
    {
      id: 'T4',
      ref: '#T4',
      title: 'Fix the rounding in the cart total',
      status: 'running',
      startedAt: now - 3 * M - 8 * S,
      tokens: { input: 3_400, output: 2_100, cacheRead: 88_000, cacheWrite: 1_200 },
      tools: [
        { name: 'Edit', count: 3 },
        { name: 'Bash', count: 1 },
      ],
      costUsd: 0.14,
      canOpen: true,
    },
  ];
}

function finishedRuns(now: number): TaskRun[] {
  const t0 = now - 3 * 60 * M;
  const run = (i: number, title: string, mins: number, tokens: number, tools: number, cost: number): TaskRun => ({
    id: `W${i}`,
    ref: `#${i + 1}`,
    title,
    status: 'done',
    startedAt: t0 + i * 4 * M,
    endedAt: t0 + i * 4 * M + mins * M + 20 * S,
    tokens: {
      input: Math.round(tokens * 0.08),
      output: Math.round(tokens * 0.04),
      cacheRead: Math.round(tokens * 0.88),
    },
    toolCalls: tools,
    costUsd: cost,
  });
  return [
    run(0, 'List outdated packages', 1, 18_400, 2, 0.03),
    run(1, 'Upgrade vite and vitest', 2, 52_100, 5, 0.09),
    run(2, 'Fix two type errors from the new React types', 3, 131_800, 9, 0.24),
    {
      ...run(3, 'Run the test suite', 2, 24_600, 3, 0.04),
      status: 'failed',
      revisions: [{ at: t0 + 14 * M, note: 'Two snapshot tests failed on the new date format' }],
    },
    run(4, 'Update the snapshots and rerun', 2, 40_200, 4, 0.07),
    {
      ...run(5, 'Write the release note', 1, 9_900, 1, 0.02),
      status: 'paused',
      endedAt: undefined,
      durationMs: 50 * S,
    },
  ];
}

function koRuns(now: number): TaskRun[] {
  const t0 = now - 18 * M;
  return [
    {
      id: 'K1',
      ref: '#T1',
      title: '실패하는 결제 테스트 재현',
      status: 'done',
      startedAt: t0,
      endedAt: t0 + 2 * M + 4 * S,
      tokens: { input: 1_900, output: 800, cacheRead: 41_000, cacheWrite: 1_600 },
      tools: [
        { name: 'Bash', count: 4 },
        { name: 'Read', count: 1 },
      ],
      costUsd: 0.07,
      revisions: [{ at: t0 + 30 * S, note: '테스트 이름을 정확히 지정' }],
    },
    {
      id: 'K2',
      ref: '#T2',
      title: '장바구니 합계 반올림 수정',
      status: 'running',
      startedAt: now - 5 * M - 12 * S,
      tokens: { input: 4_100, output: 2_600, cacheRead: 97_000 },
      tools: [{ name: 'Edit', count: 5 }],
      costUsd: 0.18,
      canOpen: true,
    },
  ];
}

export const doc: ComponentDoc = {
  slug: 'task-runs',
  name: 'Task Runs',
  tag: 'ui-task-runs',
  group: 'Components',
  summary: 'Which tasks the agent actually ran — how long each took, what it spent, and what changed along the way.',
  description:
    'A ledger of task runs: one row per run — title, status (icon + word), start time and run time, tokens and tool calls — that opens its detail in place (0fr → 1fr): when it started and ended, tokens split into input, output and cache, the tools it used with counts, the cost, and the revisions the task went through. A totals row sums runs, tokens, tool calls, time and cost. Several runs can be open at once so two can be compared; the rows are one tab stop, moved through with the arrow keys.',
  usedIn: 'soma-work dashboard › session panel › Tasks (실행된 태스크)',
  reference: { name: 'affectUI Agent Run', url: 'https://www.affectui.com/components/agent-run' },
  props: [
    {
      name: 'data.runs',
      type: 'TaskRun[]',
      required: true,
      description:
        'In the order to show (oldest first reads like a log): `{ id, title, status, ref?, startedAt?, endedAt?, durationMs?, tokens?, tools?, toolCalls?, costUsd?, revisions?, href?, canOpen? }`. Status: running · paused · done · failed · dropped.',
    },
    {
      name: 'data.runs[].tokens',
      type: '{ input?, output?, cacheRead?, cacheWrite? }',
      description: 'Token counts (shown as 12.3K). The row and the totals use the sum of all four.',
    },
    {
      name: 'data.runs[].tools / toolCalls',
      type: 'Array<{ name: string; count: number }> / number',
      description: 'Tools used with counts (chips in the detail). `toolCalls` overrides the summed count.',
    },
    {
      name: 'data.runs[].durationMs',
      type: 'number',
      description:
        'Run time the host measured itself (e.g. active time only). A running run with a start time ticks instead.',
    },
    {
      name: 'data.runs[].revisions',
      type: 'Array<{ at?: number; note: string }>',
      description: 'How the task changed while it ran — its earlier wording, a narrowed scope — with the time.',
    },
    {
      name: 'data.runs[].href / canOpen',
      type: 'string / boolean',
      description:
        'An Open link (http/https/mailto only) or an Open button in the detail. Either sends a cancelable `ui-open` first.',
    },
    { name: 'data.totals', type: 'boolean', default: 'true', description: '`false` hides the totals row.' },
    {
      name: 'data.title',
      type: 'string',
      default: "'Task runs' / '실행된 태스크'",
      description: 'Heading with the run count. An empty string draws none.',
    },
    {
      name: 'data.now',
      type: 'number',
      description: 'The host’s clock (epoch ms) when it built the data; running clocks correct for the skew.',
    },
    { name: 'lang', type: "'en' | 'ko'", default: "'en'", description: 'UI language (attribute).' },
    { name: 'flush', type: 'boolean attribute', description: 'Drops the card chrome to sit inside a host panel.' },
    {
      name: 'isOpen(id) / setOpen(id, open)',
      type: 'method',
      description: 'Read or set a run’s open state without an event (restore what the host stored from `ui-toggle`).',
    },
  ],
  events: [
    {
      name: 'ui-toggle',
      detail: '{ id: string; open: boolean }',
      description: 'A run’s detail was opened or closed by the person (a report, not cancelable).',
    },
    {
      name: 'ui-open',
      detail: '{ id: string }',
      description:
        'Open was pressed on a run with `href` or `canOpen`. Cancelable: `preventDefault()` keeps a link from navigating (route it yourself).',
    },
  ],
  keyboard: [
    ['Tab', 'Enters the list on one row (the last one used), then moves on to an open detail’s Open action.'],
    ['↑ / ↓', 'Moves between run rows (wraps).'],
    ['Home / End', 'First / last run row.'],
    ['Enter / Space', 'Opens or closes the focused run’s detail.'],
  ],
  a11y: [
    'A section labelled by the heading; the runs are a named list of buttons with `aria-expanded` / `aria-controls` (one tab stop, roving).',
    'Each row button reads its title, status word, start, run time, tokens and tool calls; status is always icon + word.',
    'A closed detail is `inert`: nothing inside takes focus or clicks. Details are definition lists.',
    'Running clocks tick in text nodes, never re-rendering; the total time ticks in place while a run is running.',
    'Reduced motion: details fade (120 ms) without growing; the chevron does not turn.',
  ],
  usage: `<ui-task-runs id="runs"></ui-task-runs>
<script type="module">
  import '@2lab.ai/ui/task-runs';
  const runs = document.getElementById('runs');
  runs.data = {
    runs: [
      { id: 'T1', ref: '#T1', title: 'Reproduce the failing test', status: 'done', startedAt: t0, endedAt: t1,
        tokens: { input: 1840, output: 920, cacheRead: 38400 }, tools: [{ name: 'Bash', count: 3 }], costUsd: 0.06,
        href: '/runs/T1' },
      { id: 'T2', ref: '#T2', title: 'Fix the cart total', status: 'running', startedAt: t1,
        revisions: [{ at: t1, note: 'Narrowed to rounding' }] },
    ],
  };
  runs.addEventListener('ui-open', (e) => { e.preventDefault(); router.go('/runs/' + e.detail.id); });
</script>`,
  demos: [
    {
      id: 'runs',
      title: 'Runs with revisions',
      description:
        'Four runs: two done, one dropped by a newer plan, one running (its clock and the total tick). T2 is open: tokens by kind, tools with counts, cost and its two revisions.',
      height: 600,
      create: () => make({ runs: checkoutRuns(Date.now()) }, {}, ['T2']),
    },
    {
      id: 'totals',
      title: 'Finished runs and their totals',
      description:
        'A finished upgrade: six runs (one failed, one paused) and the totals row — runs, tokens, tool calls, time and cost.',
      height: 480,
      create: () => make({ title: 'Weekly dependency upgrade', runs: finishedRuns(Date.now()) }),
    },
    {
      id: 'empty',
      title: 'Empty',
      description: 'Nothing has run yet.',
      height: 200,
      create: () => make({ runs: [] }),
    },
    {
      id: 'ko',
      title: 'Korean (lang="ko")',
      description: 'Row meta, detail labels and totals in Korean; the first run is open.',
      height: 460,
      create: () => make({ runs: koRuns(Date.now()) }, { lang: 'ko' }, ['K1']),
    },
  ],
};
