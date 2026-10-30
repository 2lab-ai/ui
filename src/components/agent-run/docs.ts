import type { ComponentDoc } from '../../docs/types';
import './agent-run';
import type { AgentRunAnswerDetail, AgentRunApproveDetail, AgentRunData, AgentRunStep, UiAgentRun } from './agent-run';

const S = 1000;
const M = 60 * S;

/** A demo element whose "host" answers like the dashboard does: the request settles a moment later. */
function make(data: AgentRunData, attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('ui-agent-run') as UiAgentRun;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  el.addEventListener('ui-approve', (e) => {
    const { id, decision } = (e as CustomEvent<AgentRunApproveDetail>).detail;
    setTimeout(() => {
      const d = el.data!;
      el.data = { ...d, approvals: d.approvals?.map((a) => (a.id === id ? { ...a, answered: decision } : a)) };
    }, 650);
  });
  el.addEventListener('ui-answer', (e) => {
    const { questionId, choiceId } = (e as CustomEvent<AgentRunAnswerDetail>).detail;
    setTimeout(() => {
      const d = el.data!;
      el.data = { ...d, questions: d.questions?.map((q) => (q.id === questionId ? { ...q, answered: choiceId } : q)) };
    }, 650);
  });
  el.addEventListener('ui-stop', () => {
    el.data = { ...el.data!, stopping: true };
    setTimeout(() => {
      const d = el.data!;
      el.data = {
        ...d,
        status: 'stopped',
        stopping: false,
        endedAt: Date.now(),
        plan: d.plan && {
          steps: d.plan.steps.map((s) =>
            s.status === 'running' ? { ...s, status: 'failed', endedAt: Date.now() } : s,
          ),
        },
      };
    }, 900);
  });
  return el;
}

function boardSteps(now: number, waiting = false): AgentRunStep[] {
  const t0 = now - 4 * M - 12 * S;
  return [
    {
      id: 's1',
      label: 'Pull Q3 revenue and churn',
      detail: 'From Stripe, July to September',
      status: 'done',
      startedAt: t0,
      endedAt: t0 + 38 * S,
      toolCalls: 4,
    },
    {
      id: 's2',
      label: 'Read last quarter’s board memo',
      detail: 'Keeps the structure the board knows',
      status: 'done',
      startedAt: t0 + 38 * S,
      endedAt: t0 + 61 * S,
      toolCalls: 2,
    },
    {
      id: 's3',
      label: 'Update the memo draft',
      detail: 'Revenue, churn and the Q4 outlook',
      status: 'done',
      startedAt: t0 + 61 * S,
      endedAt: t0 + 3 * M + 4 * S,
      toolCalls: 6,
    },
    {
      id: 's4',
      label: 'Send the draft to Maya',
      detail: waiting ? 'Needs your approval first' : 'Writing the cover email',
      status: 'running',
      startedAt: t0 + 3 * M + 4 * S,
      toolCalls: 1,
    },
    { id: 's5', label: 'Book a review with Maya', detail: '30 minutes before the board meeting', status: 'pending' },
  ];
}

function boardRun(waiting: boolean): AgentRunData {
  const now = Date.now();
  const started = now - 4 * M - 12 * S;
  return {
    title: 'Prepare the Q3 board update',
    subtitle: 'Board prep · triggered from #finance',
    status: waiting ? 'waiting' : 'running',
    startedAt: started,
    canStop: true,
    plan: { steps: boardSteps(now, waiting) },
    approvals: waiting
      ? [
          {
            id: 'ap_7f3c',
            tool: 'gmail.send',
            title: 'Send the draft to Maya',
            summary: 'Emails the Q3 board memo draft for review',
            fields: [
              ['to', 'Maya Chen (CFO) <maya@acme.co>'],
              ['subject', 'Q3 board update – draft'],
              ['attachment', 'Board memo – Q3 2026.docx'],
            ],
            requestedAt: now - 9 * S,
            expiresAt: now + 4 * M + 51 * S,
          },
        ]
      : [],
    details: [
      ['Agent', 'opus-4-5'],
      ['Triggered by', 'Alex Morgan'],
      ['Tool calls', 13],
      ['Cost', '$0.14'],
      ['Active time', { since: started }],
    ],
  };
}

function migrationRun(): AgentRunData {
  const now = Date.now();
  const t0 = now - 43 * M - 5 * S;
  return {
    title: 'Migrate users table to accounts and profiles',
    subtitle: 'Split users into accounts/profiles – verified on staging',
    status: 'waiting',
    startedAt: t0,
    canStop: true,
    plan: {
      steps: [
        {
          id: 'T1',
          ref: '#1',
          label: 'Read schema and 14 migrations',
          status: 'done',
          startedAt: t0,
          endedAt: t0 + 5 * M,
          toolCalls: 9,
        },
        {
          id: 'T2',
          ref: '#2',
          label: 'Dry run on staging',
          status: 'done',
          startedAt: t0 + 5 * M,
          endedAt: t0 + 13 * M,
          toolCalls: 6,
        },
        {
          id: 'T3',
          ref: '#3',
          label: 'Run on production',
          detail: 'Waiting for approval to run psql',
          status: 'running',
          startedAt: t0 + 14 * M,
          toolCalls: 0,
        },
        { id: 'T4', ref: '#4', label: 'Verify row counts and foreign keys', status: 'pending' },
      ],
    },
    approvals: [
      {
        id: 'perm_41c9',
        tool: 'Bash',
        summary: 'Run the users split on production',
        fields: [
          ['command', 'psql "$PROD_URL" -f migrations/0042_split_users.sql'],
          ['timeout', 600000],
        ],
        rules: [
          {
            id: 'prod-db-write',
            label: 'production database write',
            description: 'Writes through a connection string marked production',
          },
        ],
        canDisableRule: true,
        requestedAt: now - 22 * S,
        expiresAt: now + 3 * M + 41 * S,
      },
    ],
    questions: [
      {
        id: 'q_run_now',
        title: 'The dry run on staging passed. Run the migration on production now?',
        choices: [
          { id: 'run', label: 'Run on production', description: 'Applies 0042_split_users' },
          { id: 'wait', label: 'Wait for the backup', description: 'Retry after the 02:00 backup', recommended: true },
          { id: 'cancel', label: 'Cancel the migration', description: 'Staging stays migrated' },
        ],
      },
    ],
    details: [
      ['Agent', 'sonnet-4-5'],
      ['Triggered by', 'Jun Park'],
      ['Tool calls', 15],
      ['Cost', '$1.92'],
      ['Active time', { since: now - 6 * M, addMs: 31 * M }],
      ['Workflow', 'default'],
    ],
  };
}

function doneRun(): AgentRunData {
  const now = Date.now();
  const t0 = now - 2 * 60 * M;
  const step = (i: number, label: string, mins: number, calls: number): AgentRunStep => ({
    id: `d${i}`,
    label,
    status: 'done',
    startedAt: t0 + i * 3 * M,
    endedAt: t0 + i * 3 * M + mins * M,
    toolCalls: calls,
  });
  return {
    title: 'Weekly dependency upgrade',
    subtitle: 'web-app · 7 packages',
    status: 'done',
    startedAt: t0,
    endedAt: t0 + 18 * M + 40 * S,
    plan: {
      steps: [
        step(0, 'List outdated packages', 1, 2),
        step(1, 'Upgrade vite and vitest', 2, 5),
        step(2, 'Fix two type errors from the new React types', 3, 9),
        step(3, 'Run the test suite', 2, 3),
        step(4, 'Open the pull request', 1, 4),
        step(5, 'Post the summary to #eng-web', 1, 1),
      ],
    },
    approvals: [
      { id: 'ap_push', tool: 'Bash', title: 'Push branch deps/2026-10-27', answered: 'approve' },
      { id: 'ap_force', tool: 'Bash', title: 'Force-push to main', answered: 'deny' },
    ],
    details: [
      ['Agent', 'opus-4-5'],
      ['Triggered by', 'Weekly schedule'],
      ['Tool calls', 24],
      ['Cost', '$0.61'],
      ['Active time', { addMs: 18 * M + 40 * S }],
    ],
  };
}

function failedRun(): AgentRunData {
  const now = Date.now();
  const t0 = now - 26 * M;
  return {
    title: 'Backfill invoice totals',
    status: 'failed',
    startedAt: t0,
    endedAt: t0 + 6 * M + 12 * S,
    plan: {
      steps: [
        {
          id: 'b1',
          label: 'Count invoices without totals',
          status: 'done',
          startedAt: t0,
          endedAt: t0 + 40 * S,
          toolCalls: 2,
        },
        {
          id: 'b2',
          label: 'Backfill in batches of 5,000',
          detail: 'psql: could not connect to server: Connection refused (staging-db:5432)',
          status: 'failed',
          startedAt: t0 + 40 * S,
          endedAt: t0 + 6 * M + 12 * S,
          toolCalls: 11,
        },
        { id: 'b3', label: 'Recompute monthly revenue', status: 'skipped' },
        { id: 'b4', label: 'Report the diff', status: 'skipped' },
      ],
    },
    details: [
      ['Agent', 'sonnet-4-5'],
      ['Triggered by', 'Mina Lee'],
      ['Tool calls', 13],
      ['Cost', '$0.38'],
    ],
  };
}

function readOnlyRun(): AgentRunData {
  const now = Date.now();
  return {
    title: 'Rotate the staging API keys',
    subtitle: 'Viewing Jun Park’s run',
    status: 'waiting',
    startedAt: now - 2 * M - 5 * S,
    canStop: 'Read-only — only the owner can stop this run',
    plan: {
      steps: [
        {
          id: 'k1',
          label: 'Generate new keys',
          status: 'done',
          startedAt: now - 2 * M,
          endedAt: now - 70 * S,
          toolCalls: 3,
        },
        { id: 'k2', label: 'Update the secret store', status: 'running', startedAt: now - 70 * S, toolCalls: 1 },
        { id: 'k3', label: 'Revoke the old keys', status: 'pending' },
      ],
    },
    approvals: [
      {
        id: 'perm_vault',
        tool: 'Bash',
        raw: 'vault kv put secret/staging/api \\\n  STRIPE_KEY=@/tmp/stripe.key \\\n  SENDGRID_KEY=@/tmp/sendgrid.key',
        canAnswer: 'Only the requester can answer this prompt',
        requestedAt: now - 40 * S,
        expiresAt: now + 48 * S,
      },
    ],
  };
}

function koRun(): AgentRunData {
  const now = Date.now();
  const t0 = now - 58 * M - 6 * S;
  return {
    title: '대시보드 UI 개선 (affectui 리버스 엔지니어링)',
    subtitle: 'soma-work 대시보드 UI 개선 작업',
    status: 'waiting',
    startedAt: t0,
    canStop: true,
    plan: {
      steps: [
        {
          id: 'T85',
          ref: '#T85',
          label: '승인 카드 스크린샷 찍기',
          status: 'done',
          startedAt: t0,
          endedAt: t0 + 12 * M + 40 * S,
          toolCalls: 21,
        },
        {
          id: 'T86',
          ref: '#T86',
          label: '실제 승인 카드를 실서버 코드로 그리기',
          detail: '실제 승인 카드 캡처 중',
          status: 'running',
          startedAt: now - 2 * M - 28 * S,
          toolCalls: 4,
        },
        { id: 'T87', ref: '#T87', label: '시트 다시 만들고 이미지 확인 후 업로드', status: 'pending' },
      ],
    },
    approvals: [
      {
        id: 'perm_merge',
        tool: 'Bash',
        summary: 'Merge docs PR #463 pinned to reviewed head',
        fields: [
          [
            'command',
            'curl -s -X PUT -H "Authorization: Bearer $T" https://api.github.com/repos/2lab-ai/soma-work/pulls/463/merge -d \'{"merge_method":"merge"}\' | python3 -c "import json,sys; print(json.load(sys.stdin)[\'sha\'])"',
          ],
        ],
        rules: [
          { id: 'pipe-to-interpreter', label: 'pipe to interpreter', description: 'Pipe to shell/script interpreter' },
        ],
        canDisableRule: true,
        requestedAt: now - 15 * S,
        expiresAt: now + 7 * M + 30 * S,
      },
    ],
    details: [
      ['에이전트', 'opus-5-5[1m]'],
      ['시작한 사람', 'Z'],
      ['도구 호출', 3589],
      ['비용', '$61.33'],
      ['활성 시간', { since: t0, addMs: 105 * M }],
      ['워크플로', 'default'],
    ],
  };
}

export const doc: ComponentDoc = {
  slug: 'agent-run',
  name: 'Agent Run',
  tag: 'ui-agent-run',
  group: 'Screens',
  summary:
    'Where one autonomous run is, whether it is waiting on you — answer it in place — and who ran it at what cost.',
  description:
    'The session panel of the soma-work dashboard as one element. The head carries the status pill, the start time with a live elapsed clock and Stop. The plan draws one marker per step on a rail — check, spinner, empty ring, ✕, dash — with the current step bold, each step’s time and tool calls, and a footer with the phase and done/total. “Needs input” holds approval cards (tool input as rows, matched dangerous-command rules, an expiry countdown, Explain / Approve & disable rule / Deny / Approve — one ink primary) and question cards (recommended choice first). The details list closes the screen. From 760px it splits into the plan and a side column.',
  usedIn:
    'soma-work dashboard › session panel — head chip row, Tasks (plan), 입력 필요 (approval and question cards), 세션 정보 › 세부',
  reference: { name: 'affectUI Agent Run', url: 'https://www.affectui.com/screens/agent-run' },
  props: [
    { name: 'data.title', type: 'string', required: true, description: 'Run title (the screen heading).' },
    { name: 'data.subtitle', type: 'string', description: 'One line under the title.' },
    {
      name: 'data.status',
      type: "'running' | 'waiting' | 'idle' | 'done' | 'failed' | 'stopped'",
      required: true,
      description: 'Status pill. running / waiting are live: the elapsed clock ticks and Stop can show.',
    },
    {
      name: 'data.startedAt',
      type: 'number (epoch ms)',
      description:
        'Start of this run or turn: “Started 6:56 PM · 4m 12s”, ticking in place while live; with endedAt, the run time.',
    },
    { name: 'data.endedAt', type: 'number (epoch ms)', description: 'End of a finished run (static run time).' },
    {
      name: 'data.activeMs',
      type: 'number',
      description: 'Accumulated active time, shown as “Active …” when there is no start time.',
    },
    {
      name: 'data.plan.steps',
      type: 'AgentRunStep[]',
      description:
        '`{ id, label, status, ref?, detail?, startedAt?, endedAt?, toolCalls? }` in plan order. status: pending · running · done · failed · skipped. A running step ticks from startedAt; a finished one shows endedAt − startedAt. More than three done steps fold the earliest behind a toggle. An empty array says “No steps yet”; omit plan to hide the card.',
    },
    {
      name: 'data.approvals',
      type: 'AgentRunApproval[]',
      description:
        '`{ id, tool, title?, summary?, fields?, raw?, truncated?, rules?, requestedAt?, expiresAt?, canDisableRule?, canAnswer?, answered?, error? }`. fields are label → value rows (non-strings as pretty JSON); raw is shown in a <pre> when the input is not an object (runApprovalFields() converts a JSON input). answered turns the card into one resolved row; error unlocks the answers and is announced.',
    },
    {
      name: 'data.approvals[].canAnswer',
      type: 'boolean | string',
      default: 'true',
      description: '`false` disables the answers; a string disables them and shows why (also as the tooltip).',
    },
    {
      name: 'data.questions',
      type: 'AgentRunQuestion[]',
      description:
        '`{ id, title, body?, choices: { id, label, description?, recommended? }[], canAnswer?, answered?, error? }`. The recommended choice goes first as the card’s primary (⌘/Ctrl+Enter).',
    },
    {
      name: 'data.details',
      type: 'Array<[label, string | number | { since?, addMs? }]>',
      description:
        'The details list, label → value. `{ since, addMs }` is a live duration (addMs + now − since), `{ addMs }` a static one.',
    },
    {
      name: 'data.canStop',
      type: 'boolean | string',
      default: 'undefined',
      description: '`true` shows Stop while the run is live; a string shows it disabled with that reason.',
    },
    {
      name: 'data.stopping',
      type: 'boolean',
      default: 'false',
      description: 'A stop request is in flight: Stop is disabled and busy.',
    },
    { name: 'lang', type: "'en' | 'ko'", default: "'en'", description: 'UI language (attribute).' },
    {
      name: 'theme',
      type: "'light' | 'dark'",
      description: 'Pins the theme (attribute). Default follows prefers-color-scheme or page tokens.',
    },
  ],
  events: [
    {
      name: 'ui-approve',
      detail: "{ id: string; decision: 'approve' | 'deny' | 'explain' | 'approve_disable_rule' }",
      description:
        'An answer to an approval. The card locks (busy) until new data settles it — set answered, or error to unlock. preventDefault() keeps it unlocked.',
    },
    {
      name: 'ui-answer',
      detail: '{ questionId: string; choiceId: string }',
      description: 'A choice for a question. Locks like ui-approve; set answered (the choice id) or error.',
    },
    {
      name: 'ui-stop',
      detail: '{}',
      description: 'Stop pressed while the run is live and canStop is true. Set stopping, then the new status.',
    },
  ],
  keyboard: [
    ['Tab', 'Stop, the plan’s fold toggle, then each card’s answers'],
    ['Enter / Space', 'Press the focused answer, choice or Stop'],
    ['⌘ Enter / Ctrl Enter', 'In an approval card (card or any of its buttons): Approve'],
    ['⌘ Enter / Ctrl Enter', 'In a question card: the recommended choice (nothing when none is recommended)'],
    ['Esc', 'On an approval card’s button: Deny — handled here, it does not reach the page'],
    ['Esc', 'Anywhere else (including the card itself): not handled, so the page can close its panel'],
  ],
  a11y: [
    'A section labelled by the run title; Plan, Needs input and Details are headed sections. The plan is an <ol> labelled “Plan steps”; the running step has aria-current="step" and every step carries its state in text (“, done”).',
    'One persistent polite status region (outside the re-rendered markup) says what changed: status, a step done or failed, a new approval or question, an answer sent, an answer error. The first render is silent; ticking clocks and the expiry countdown are never announced.',
    'Approval and question cards are role="group" (tabindex −1) labelled by their title and described by the summary and a static “Expires at …”. Approve and Deny carry aria-keyshortcuts; the key hints are aria-hidden.',
    'Focus safety: every card and answer is keyed by its exact identity (data-key = the serialized [ap, request id, answer] or [q, the whole question, choice], never a hash). A live update never moves focus onto another request’s button; when the focused card leaves, focus goes to its resolved row, else the Needs input heading, else the title — never to a decision button.',
    'Keyboard landing: el.focusNeeds() focuses the first unanswered card itself (not its Approve), as the dashboard does when the panel opens from the keyboard — Esc still reaches the page, ⌘/Ctrl+Enter is a deliberate second step.',
    'Colour is never the only cue: step markers and the status pill have distinct shapes and words. Touch: answers, choices, Stop and the fold toggle are 44px tall on coarse pointers; key hints hide without hover.',
    'Reduced motion: marker pop, rail fill, badge pop and the resolved-row rise collapse to their end state; spinners stop.',
    'Sound (opt-in, @2lab.ai/ui/sound): Stop plays close once ui-stop is not prevented. Silent until the page turns sound on.',
  ],
  usage: `<ui-agent-run></ui-agent-run>
<script type="module">
  import '@2lab.ai/ui/agent-run';
  const run = document.querySelector('ui-agent-run');
  const t0 = Date.now() - 252_000;
  run.data = {
    title: 'Prepare the Q3 board update',
    status: 'waiting',
    startedAt: t0,
    canStop: true,
    plan: { steps: [
      { id: 's1', label: 'Pull Q3 revenue and churn', status: 'done', startedAt: t0, endedAt: t0 + 38_000, toolCalls: 4 },
      { id: 's2', label: 'Send the draft to Maya', status: 'running', startedAt: t0 + 38_000, toolCalls: 1 },
      { id: 's3', label: 'Book a review with Maya', status: 'pending' },
    ] },
    approvals: [{
      id: 'ap_7f3c', tool: 'gmail.send', title: 'Send the draft to Maya',
      fields: [['to', 'Maya Chen (CFO)'], ['subject', 'Q3 board update – draft']],
      expiresAt: Date.now() + 290_000,
    }],
    details: [['Agent', 'opus-4-5'], ['Cost', '$0.14']],
  };
  run.addEventListener('ui-approve', async (e) => {
    const { id, decision } = e.detail;
    const res = await fetch('/permission', { method: 'POST', body: JSON.stringify({ id, decision }) });
    run.data = { ...run.data, approvals: run.data.approvals.map((a) =>
      a.id !== id ? a : res.ok ? { ...a, answered: decision } : { ...a, error: 'Could not send — try again' }) };
  });
  run.addEventListener('ui-stop', () => { /* POST /stop, then set status */ });
</script>`,
  demos: [
    {
      id: 'waiting',
      title: 'Needs input',
      description:
        'Waiting on one approval: tool input as rows, an expiry countdown, ⌘/Ctrl+Enter approves, Esc on a button denies. Answer it to see the resolved row.',
      height: 640,
      frame: false,
      create: () => make(boardRun(true)),
    },
    {
      id: 'running',
      title: 'Running',
      description: 'The current step ticks in place; Stop hands the request to the host.',
      height: 520,
      frame: false,
      create: () => make(boardRun(false)),
    },
    {
      id: 'approval-question',
      title: 'Approval + question',
      description:
        'A matched dangerous-command rule, Approve & disable rule, and a question whose recommended choice comes first.',
      height: 900,
      frame: false,
      create: () => make(migrationRun()),
    },
    {
      id: 'done',
      title: 'Done',
      description: 'Six done steps fold the earliest three; answered approvals stay as resolved rows.',
      height: 560,
      frame: false,
      create: () => make(doneRun()),
    },
    {
      id: 'failed',
      title: 'Failed',
      description: 'A failed step shows its error; the steps after it were skipped.',
      height: 460,
      frame: false,
      create: () => make(failedRun()),
    },
    {
      id: 'read-only',
      title: 'Read-only',
      description:
        'Another person’s run: the answers and Stop are disabled with the reason; a non-object input stays raw text. The last minute of the countdown warns.',
      height: 560,
      frame: false,
      create: () => make(readOnlyRun()),
    },
    {
      id: 'ko',
      title: '한국어',
      description: 'lang="ko" — the strings the dashboard shows.',
      height: 820,
      frame: false,
      create: () => make(koRun(), { lang: 'ko' }),
    },
  ],
};
