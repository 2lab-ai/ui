import type { ComponentDoc } from '../../docs/types';
import './agent-inbox';
import { type AgentInboxData, columnsByStatus, type InboxCard, type UiAgentInbox } from './agent-inbox';

const MIN = 60_000;

function make(data: AgentInboxData, attrs: Record<string, string> = {}): UiAgentInbox {
  const el = document.createElement('ui-agent-inbox');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

/** The board a team sees mid-morning: one permission to approve, one failure, two runs, two finished. */
function boardCards(now: number): InboxCard[] {
  return [
    {
      id: 'migrate',
      title: 'Migrate users table',
      summary: 'Wants to run 0042_split_users on production. The dry run on staging passed with no errors.',
      status: 'waiting',
      since: now - 6 * MIN - 12_000,
      task: { id: 'T4', label: 'Run the migration on production', startedAt: now - 6 * MIN - 12_000 },
      tokens: 1_284_310,
      costUsd: 4.53,
      artifacts: ['0042_split_users.sql', 'dry-run-staging.log'],
      steps: { done: 3, total: 5 },
      contextPct: 24,
      model: 'opus-4-5',
      details: [
        { label: 'Read schema and 14 migrations', meta: '1m 40s' },
        { label: 'Wrote migration 0042_split_users', meta: '2m 05s' },
        { label: 'Dry run on staging – no errors', meta: '48s' },
        { label: 'Wants to run it on production' },
      ],
      actions: [{ id: 'reject', label: 'Reject' }],
      primary: { id: 'approve', label: 'Approve' },
    },
    {
      id: 'crm',
      title: 'Clean up CRM contacts',
      summary: 'Matched 1,312 likely duplicates, then the merge hit the API rate limit (429).',
      status: 'failed',
      since: now - 4 * MIN,
      tokens: 402_118,
      costUsd: 1.08,
      steps: { done: 2, total: 3 },
      model: 'sonnet-4-5',
      details: ['Loaded 18,240 contacts', 'Matched 1,312 likely duplicates', 'Merge stopped – API rate limit (429)'],
      primary: { id: 'retry', label: 'Retry' },
    },
    {
      id: 'review',
      title: 'Review PR #482 — billing webhooks',
      summary: 'Reading the diff and the test run, writing review comments.',
      status: 'running',
      since: now - 21 * MIN - 57_000,
      task: { id: 'T61', label: 'Writing review comments on the retry path', startedAt: now - 6 * MIN - 17_000 },
      agents: { total: 40, running: 1, done: 38, failed: 1 },
      tokens: 35_129_938,
      costUsd: 61.33,
      artifacts: ['review-482.md', 'webhook-retry.png', 'coverage.html', 'test-run.log', 'notes.md'],
      steps: { done: 3, total: 6 },
      contextPct: 72,
      model: 'opus-4-5',
      details: [
        { label: 'Read 12 changed files', meta: '4m 10s · 31 tools' },
        { label: 'Ran the test suite – 214 passed', meta: '2m 02s · 6 tools' },
        { label: 'Writing review comments', meta: '6m 17s · 20 tools' },
      ],
      actions: [{ id: 'stop', label: 'Stop' }],
    },
    {
      id: 'notes',
      title: 'Release notes v2.4',
      summary: 'Grouping 23 merged pull requests into features and fixes.',
      status: 'running',
      since: now - 3 * MIN - 49_000,
      task: { id: 'T3', label: 'Drafting the highlights', startedAt: now - 58_000 },
      agents: { total: 4, running: 2, done: 2 },
      tokens: 312_904,
      costUsd: 1.12,
      steps: { done: 2, total: 4 },
      contextPct: 18,
      model: 'sonnet-4-5',
      details: ['Collected 23 merged pull requests', 'Drafting the highlights'],
    },
    {
      id: 'digest',
      title: 'Weekly metrics digest',
      summary: 'Pulled numbers from three dashboards and posted the summary to #metrics.',
      status: 'done',
      since: now - 13 * 60 * MIN,
      elapsedMs: 4 * MIN + 12_000,
      tokens: 98_220,
      costUsd: 0.31,
      artifacts: ['metrics-week-43.png', 'digest.html', 'digest.md'],
      steps: { done: 6, total: 6 },
      model: 'haiku-4-5',
      details: ['Pulled numbers from 3 dashboards', 'Posted to #metrics'],
    },
    {
      id: 'spike',
      title: 'Spike: SSE vs WebSocket for the board',
      summary: 'Compared reconnect behaviour behind the proxy; parked until the infra review.',
      status: 'idle',
      statusText: 'Sleeping',
      since: now - 2 * 24 * 60 * MIN,
      tokens: 1_920_442,
      costUsd: 6.4,
    },
  ];
}

const sideCards = (now: number): InboxCard[] => {
  const cards = boardCards(now);
  const migrate = {
    ...cards[0],
    primary: { id: 'approve', label: 'Approve', disabled: 'Only the requester can approve' },
  };
  return [migrate, cards[1], cards[3]];
};

const KO_CARDS = (now: number): InboxCard[] => [
  {
    id: 'auto-mode',
    title: 'auto mode 권한 프롬프트 차이 분석',
    summary: '[medium] auto mode 개선 TO-BE 컨펌 — 결정 3개',
    status: 'waiting',
    since: now - 1 * MIN,
    tokens: 9_719_249,
    costUsd: 4.53,
    artifacts: ['auto mode는 고장 나지 않았다.md'],
    contextPct: 24,
    model: 'opus-4-5',
    details: ['권한 프롬프트 로그 비교', 'TO-BE 초안 작성', '결정 3개 확인 요청'],
    actions: [{ id: 'reject', label: '거절' }],
    primary: { id: 'approve', label: '승인' },
  },
  {
    id: 'dash-ui',
    title: '대시보드 UI 개선 (affectui 리버스 엔지니어링)',
    summary: 'Review every image myself, then upload map + 7 sheets to Slack thread',
    status: 'running',
    since: now - 163 * MIN - 39_000,
    task: {
      id: 'T61',
      label: 'Start fixture preview (agent-run approval card) on main code',
      startedAt: now - 6 * MIN - 17_000,
    },
    agents: { total: 40, done: 40 },
    tokens: 35_129_938,
    costUsd: 61.33,
    artifacts: ['대시보드 × affectUI 7종.html', 'agent-inbox-card.png', 'agent-inbox-col.png', 'where.png'],
    steps: { done: 0, total: 4 },
    contextPct: 27,
    model: 'opus-4-5',
    details: [
      {
        label: 'Start fixture preview (agent-run approval card) on main code',
        meta: '6m 17s · 툴 20회',
        state: 'current',
      },
      { label: 'Shoot live dev: 7 surfaces — location shot with box + close-up', state: 'pending' },
      { label: 'Compose per-reference sheets: reference | live result | where', state: 'pending' },
      { label: 'Review every image myself, then upload map + 7 sheets to Slack thread', state: 'pending' },
    ],
  },
  {
    id: 'cron-lane',
    title: '대시보드: 크론 잡 레인 + LLM 가용량 타임라인 (#357)',
    summary: 'Final report posted; cron deleted; done marker written',
    status: 'done',
    since: now - 13 * 60 * MIN,
    elapsedMs: 592 * MIN + 47_000,
    agents: { total: 44, done: 43, failed: 1 },
    tokens: 12_400_310,
    costUsd: 22.1,
    artifacts: ['dev-lane.png', 'dev-timeline.png', 'dev-dark.png', 'dev-mobile.png', 'report.html'],
    steps: { done: 6, total: 6 },
  },
];

/** The live demo: one run goes Running → Waiting for you → Running → Done → Running…, a step every 3.2 s. */
function liveDemo(): HTMLElement {
  const now = Date.now();
  const base = boardCards(now);
  const loop: InboxCard['status'][] = ['running', 'waiting', 'running', 'done'];
  let i = 0;
  const data = (): AgentInboxData => {
    const s = loop[i % loop.length];
    const t = Date.now();
    const deploy: InboxCard = {
      id: 'deploy',
      title: 'Deploy billing service',
      summary:
        s === 'waiting'
          ? 'Wants to switch production traffic to the new build.'
          : s === 'done'
            ? 'Rolled out to production; error rate unchanged.'
            : 'Rolling out to the canary group.',
      status: s,
      since: t,
      elapsedMs: s === 'done' ? 5 * MIN + 31_000 : 0,
      tokens: 210_000 + i * 48_000,
      costUsd: 0.62 + i * 0.14,
      steps: { done: s === 'done' ? 4 : 2, total: 4 },
      model: 'sonnet-4-5',
      details: [
        'Built the image',
        'Canary at 5%',
        s === 'waiting' ? 'Wants to switch all traffic' : 'Watching error rate',
      ],
      primary: s === 'waiting' ? { id: 'approve', label: 'Approve' } : undefined,
    };
    return { columns: columnsByStatus([deploy, base[0], base[3], base[4]]) };
  };
  const el = make(data());
  let seen = false;
  const timer = window.setInterval(() => {
    if (!el.isConnected) {
      if (seen) window.clearInterval(timer);
      return;
    }
    seen = true;
    i++;
    el.data = data();
  }, 3200);
  return el;
}

export const doc: ComponentDoc = {
  slug: 'agent-inbox',
  name: 'Agent Inbox',
  tag: 'ui-agent-inbox',
  group: 'Components',
  summary: 'One calm board of background agent runs: what waits for you, what runs, what finished.',
  description:
    'Labelled columns with a count, cards that carry a tinted status tag (Waiting for you · Running · Done · Failed) with a live clock or age, the task in progress, sub-agents, tokens · cost, files and progress. A card opens in place to its steps and one ink button — the decision you can make now. When a card’s column changes it shows the new status where it is for 900 ms, then glides to its new column; a polite live region says how many runs need you.',
  usedIn: 'soma-work dashboard › Agent inbox (세션 보드) — NEEDS YOU · RUNNING · DONE',
  reference: { name: 'affectUI Agent Inbox', url: 'https://www.affectui.com/components/agent-inbox' },
  props: [
    {
      name: 'data.columns',
      type: 'InboxColumn[]',
      required: true,
      description:
        '{ id, label, emptyText?, cards } in display order. The host decides which column a card is in; `columnsByStatus(cards, lang)` builds the reference three (Needs you · Running · Done).',
    },
    {
      name: 'data.columns[].cards[].id',
      type: 'string',
      required: true,
      description: 'Stable id. A card keeps its DOM node (and open state) for as long as its id is on the board.',
    },
    { name: 'data.columns[].cards[].title', type: 'string', required: true, description: 'One line, ellipsised.' },
    {
      name: 'data.columns[].cards[].summary',
      type: 'string',
      description: 'Why it is here / where it stands. Clamped to two lines (one in list view).',
    },
    {
      name: 'data.columns[].cards[].status',
      type: "'waiting' | 'running' | 'done' | 'failed' | 'idle'",
      required: true,
      description:
        'Drives the tag: amber Waiting for you, blue Running with a ring, green Done, red Failed, grey Idle.',
    },
    {
      name: 'data.columns[].cards[].statusText',
      type: 'string',
      description: 'Replaces the status word (Sleeping, Archived, Retrying…).',
    },
    {
      name: 'data.columns[].cards[].since',
      type: 'number (epoch ms)',
      description:
        'When the status began. Running: the live clock starts here. Other statuses: shown as age (· 6m ago). No value, no clock.',
    },
    {
      name: 'data.columns[].cards[].elapsedMs',
      type: 'number',
      description: 'Active time. Done: “Done in 4m 12s”. Running: time before `since`, added to the clock.',
    },
    {
      name: 'data.columns[].cards[].task',
      type: '{ id?, label, startedAt?, elapsedMs? }',
      description: 'The task in progress: #id label · live time (from startedAt) or a fixed time.',
    },
    {
      name: 'data.columns[].cards[].agents',
      type: '{ total, running?, done?, failed? }',
      description: 'Sub-agents: dots from these counts only (the rest of total hollow) + “Sub-agents 40 · running 2”.',
    },
    {
      name: 'data.columns[].cards[].tokens / costUsd',
      type: 'number',
      description: 'Total tokens · API-equivalent cost. Shown only when given; they count up when they grow.',
    },
    {
      name: 'data.columns[].cards[].artifacts',
      type: 'string[]',
      description: 'File names the run made: count, up to four chips (glyph by extension), +N.',
    },
    { name: 'data.columns[].cards[].steps', type: '{ done, total }', description: 'Progress in the foot (3/5).' },
    {
      name: 'data.columns[].cards[].contextPct',
      type: 'number',
      description: 'Context window used. >60 warns, >80 danger.',
    },
    {
      name: 'data.columns[].cards[].details',
      type: 'Array<string | { label, meta?, state? }>',
      description:
        'The open card’s steps, oldest first; the last is current unless states are given. Over five, the earliest fold.',
    },
    {
      name: 'data.columns[].cards[].primary',
      type: '{ id, label, disabled? }',
      description:
        'The one decision this viewer can make here — the card’s only ink button. Disabled (a string = the reason) it steps back and Open takes the ink.',
    },
    {
      name: 'data.columns[].cards[].actions',
      type: 'Array<{ id, label, disabled? }>',
      description: 'Secondary outline buttons, left of the primary.',
    },
    {
      name: 'data.columns[].cards[].model',
      type: 'string',
      description: 'Model name at the left of the open card’s button row.',
    },
    { name: 'data.expanded', type: 'string[]', description: 'Card ids that start open the first time they appear.' },
    {
      name: 'data.openLabel',
      type: 'string | false',
      default: "'Open'",
      description: 'Label of the Open button (ui-open); false hides it. Ink when the card has no live primary.',
    },
    {
      name: 'view',
      type: "'board' | 'list'",
      description: 'Attribute. Default: board from 640px of width (columns scroll sideways below 840px), list below.',
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
      name: 'ui-open',
      detail: '{ cardId: string }',
      description: 'Open pressed in an open card (show the run’s full log / panel).',
    },
    {
      name: 'ui-action',
      detail: '{ cardId: string; actionId: string }',
      description: 'The primary or a secondary action was pressed. Not sent for a disabled action.',
    },
    {
      name: 'ui-toggle',
      detail: '{ cardId: string; expanded: boolean }',
      description:
        'A card opened or closed (click, Enter / Space, Esc). Cancelable: preventDefault keeps it as it was.',
    },
  ],
  keyboard: [
    ['Tab', 'Through the cards, then the buttons inside an open card'],
    ['Enter / Space', 'Open or close the focused card (no transition); press a button'],
    ['Esc', 'Close the open card the focus is in and put focus back on it (not from a text field or select)'],
  ],
  a11y: [
    'Each column is a <section> labelled by its name and count (“Needs you 2”); cards are a list.',
    'A card face is a button with aria-expanded and aria-controls; a closed card’s details are inert.',
    'A polite live region says “N need you, M running” — the first sentence at once, then only changes, a burst within 1 s said once; a single card’s change is named first.',
    'Status is icon + word + colour, never colour alone; the tag text is ≥ 4.5:1 on its tint in both themes.',
    'A disabled action stays focusable (aria-disabled) and carries its reason.',
    'Reduced motion: no hold, no travel — a card that changes column fades in where it lands; the ring and pulses stop.',
  ],
  usage: `<ui-agent-inbox lang="en"></ui-agent-inbox>
<script type="module">
  import { columnsByStatus } from '@2lab.ai/ui/agent-inbox';
  const el = document.querySelector('ui-agent-inbox');
  const render = (runs) => (el.data = { columns: columnsByStatus(runs) });
  render([
    { id: 'migrate', title: 'Migrate users table', status: 'waiting', since: Date.now() - 6 * 60_000,
      summary: 'Wants to run 0042_split_users on production.',
      actions: [{ id: 'reject', label: 'Reject' }], primary: { id: 'approve', label: 'Approve' } },
    { id: 'notes', title: 'Release notes v2.4', status: 'running', since: Date.now() - 80_000 },
    { id: 'digest', title: 'Weekly metrics digest', status: 'done', elapsedMs: 252_000 },
  ]);
  el.addEventListener('ui-action', (e) => api.decide(e.detail.cardId, e.detail.actionId)); // then render() the new status
  el.addEventListener('ui-open', (e) => openRun(e.detail.cardId));
</script>`,
  demos: [
    {
      id: 'board',
      title: 'Board',
      description: 'Needs you · Running · Done. The waiting card is open with its one ink decision (Approve).',
      height: 760,
      frame: false,
      create: () => {
        const now = Date.now();
        return make({ columns: columnsByStatus(boardCards(now)), expanded: ['migrate'] });
      },
    },
    {
      id: 'live',
      title: 'Status first, then move',
      description:
        'Every 3.2 s “Deploy billing service” changes status: its tag changes in place first, then after 900 ms it glides to its new column.',
      height: 640,
      frame: false,
      create: liveDemo,
    },
    {
      id: 'list',
      title: 'Side panel (list)',
      description:
        'view="list" in a narrow panel. The Approve here is someone else’s to give, so it is disabled with its reason and Open keeps the ink.',
      height: 700,
      frame: false,
      create: () => {
        const now = Date.now();
        const cards = sideCards(now);
        const el = make(
          {
            columns: [
              { id: 'needs-you', label: 'Needs you', cards: cards.slice(0, 2) },
              { id: 'running', label: 'Running', cards: cards.slice(2) },
            ],
            expanded: ['migrate', 'crm'],
          },
          { view: 'list' },
        );
        el.style.maxWidth = '440px';
        el.style.marginInline = 'auto';
        return el;
      },
    },
    {
      id: 'empty',
      title: 'Empty',
      description: 'Nothing running yet — every column says so.',
      height: 300,
      frame: false,
      create: () => make({ columns: columnsByStatus([]) }),
    },
    {
      id: 'ko',
      title: '한국어 (lang="ko")',
      height: 780,
      frame: false,
      create: () => {
        const now = Date.now();
        return make(
          { columns: columnsByStatus(KO_CARDS(now), 'ko'), expanded: ['dash-ui'], openLabel: '작업 로그' },
          { lang: 'ko' },
        );
      },
    },
  ],
};
