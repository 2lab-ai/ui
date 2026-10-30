import { fmtAgo } from '../../core/format';
import type { ComponentDoc } from '../../docs/types';
import './agent-inbox';
import {
  type AgentInboxData,
  columnsByStatus,
  type InboxCard,
  type InboxColumn,
  type InboxStringOverrides,
  type UiAgentInbox,
} from './agent-inbox';

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
        meta: '6분 17초 · 툴 20회',
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

// ── The dashboard's board (host gaps) ──

/** The board's mixed wording, kept by overrides: English status words, Korean sub-agents, tooltips and sentence. */
const BOARD_STRINGS: InboxStringOverrides = {
  agents: '서브에이전트',
  agentsRunning: (n: number) => `실행 ${n}`,
  agentsFailed: (n: number) => `실패 ${n}`,
  tokTitle: '총 토큰',
  costTitle: 'API 환산 비용',
  steps: '완료한 task / 전체',
  ctx: (p: number) => `컨텍스트 ${p}%`,
  arts: '모델이 만든 산출물',
  artOpen: (name: string) => `${name} — 크게 보기`,
  announce: (w: number, r: number) => `응답이 필요한 세션 ${w}개, 실행 중 ${r}개`,
  ago: (at: number, now?: number) => fmtAgo(at, now),
  duration: (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  },
};

/** A small row of demo buttons (inline-styled: the demo is light DOM on the docs page). */
function toolbar(buttons: Array<[label: string, onClick: (b: HTMLButtonElement) => void]>): HTMLElement {
  const bar = document.createElement('div');
  bar.style.cssText =
    'display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 12px;color:var(--ui-text, #18181a)';
  for (const [label, onClick] of buttons) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText =
      'height:30px;padding:0 12px;border:1px solid color-mix(in srgb,currentColor 22%,transparent);border-radius:8px;background:none;color:inherit;font:inherit;font-size:12.5px;cursor:pointer';
    b.addEventListener('click', () => onClick(b));
    bar.append(b);
  }
  return bar;
}

function note(): HTMLElement {
  const p = document.createElement('p');
  p.setAttribute('aria-live', 'polite');
  p.style.cssText = 'margin:10px 2px 0;font-size:12.5px;color:var(--ui-text-secondary, #57575d);min-height:1.4em';
  return p;
}

/** The session board as the dashboard maps it: owner badges, a CRON run, PR / media metrics, DONE by day. */
function dashboardColumns(now: number): InboxColumn[] {
  const migrate: InboxCard = {
    id: 'migrate',
    title: 'Migrate users table',
    summary: 'Wants to run 0042_split_users on production. The dry run on staging passed.',
    status: 'waiting',
    since: now - 6 * MIN - 12_000,
    badge: { text: 'zhuge', hue: 0, title: 'Zhuge Liang' },
    tokens: 1_284_310,
    costUsd: 4.53,
    steps: { done: 3, total: 5 },
    contextPct: 24,
    metrics: [{ text: '2', glyph: 'attach', title: '지시 첨부 2개', label: '지시 첨부 2개' }],
    details: ['Read schema and 14 migrations', 'Dry run on staging – no errors', 'Wants to run it on production'],
    primary: { id: 'approve', label: 'Approve' },
  };
  const review: InboxCard = {
    id: 'review',
    title: 'Review PR #482 — billing webhooks',
    summary: 'Writing review comments on the retry path.',
    status: 'running',
    since: now - 21 * MIN - 57_000,
    badge: { text: 'elon', hue: 5 },
    task: { id: 'T61', label: 'Writing review comments on the retry path', startedAt: now - 6 * MIN - 17_000 },
    agents: {
      total: 7,
      running: 2,
      done: 3,
      failed: 1,
      dots: ['done', 'done', 'stopped', 'failed', 'done', 'running', 'running'],
    },
    tokens: 35_129_938,
    costUsd: 61.33,
    titles: {
      tokens: '총 토큰 (task 합계: 메인 + 서브에이전트 7개) — 입력 412K · 출력 1.9M · 캐시 읽기 32.6M · 캐시 쓰기 210K',
      context: '컨텍스트 72% · 자동 압축 750K까지 210K',
    },
    artifactsCount: 6,
    artifacts: [
      { id: 'a-review', name: 'review-482.md' },
      { id: 'a-shot', name: 'webhook-retry.png' },
      { id: 'a-cov', name: 'coverage.html' },
    ],
    steps: { done: 3, total: 6 },
    contextPct: 72,
    contextLevel: 'warn',
    metrics: [{ text: '#482 열림', glyph: 'pr', tone: 'run', title: 'PR #482 — billing webhooks (열림)' }],
    actions: [{ id: 'stop', label: 'Stop' }],
  };
  const nightly: InboxCard = {
    id: 'nightly',
    title: 'Nightly dependency audit',
    summary: 'Checking 214 packages against the advisory feed.',
    status: 'running',
    since: now - 2 * MIN - 8_000,
    lead: { text: 'CRON', glyph: 'clock', title: '크론 잡: nightly-audit' },
    tokens: 88_410,
    costUsd: 0.21,
  };
  const digest: InboxCard = {
    id: 'digest',
    title: 'Weekly metrics digest',
    summary: 'Posted the summary to #metrics.',
    status: 'done',
    since: now - 2 * 60 * MIN,
    elapsedMs: 4 * MIN + 12_000,
    badge: { text: 'zhuge', hue: 0, title: 'Zhuge Liang' },
    tokens: 98_220,
    costUsd: 0.31,
    artifactsCount: 7,
    artifacts: [
      { id: 'a-png', name: 'metrics-week-43.png' },
      { id: 'a-html', name: 'digest.html' },
      { id: 'a-md', name: 'digest.md' },
      { id: 'a-csv', name: 'raw.csv' },
    ],
    metrics: [{ text: '#477 머지됨', glyph: 'pr', tone: 'done', title: 'PR #477 머지됨' }],
  };
  const spike: InboxCard = {
    id: 'spike',
    title: 'Spike: SSE vs WebSocket for the board',
    summary: 'Parked until the infra review.',
    status: 'idle',
    statusText: 'Sleeping',
    since: now - 26 * 60 * MIN,
    badge: { text: 'pang', hue: 2 },
    tokens: 1_920_442,
    costUsd: 6.4,
  };
  const rotate: InboxCard = {
    id: 'rotate',
    title: 'Rotate staging API keys',
    summary: 'Rotated 6 keys and updated the vault.',
    status: 'done',
    since: now - 3 * 24 * 60 * MIN,
    elapsedMs: 2 * MIN + 40_000,
    badge: { text: 'elon', hue: 5 },
    details: ['Listed 6 keys older than 90 days', 'Rotated and stored in the vault'],
  };
  return [
    { id: 'needs-you', label: 'Needs you', cards: [migrate] },
    { id: 'running', label: 'Running', cards: [review, nightly] },
    {
      id: 'done',
      label: 'Done',
      cards: [],
      groups: [
        { id: 'today', label: 'Today', cards: [digest] },
        { id: 'yesterday', label: '어제', cards: [spike] },
        { id: '2026-10-24', label: '10월 24일 (금)', open: false, cards: [rotate] },
      ],
    },
  ];
}

/** The board the dashboard will draw: Board / List and a docked panel glide; a deep link opens a closed day. */
function dashboardDemo(): HTMLElement {
  const wrap = document.createElement('div');
  const el = make({ columns: dashboardColumns(Date.now()), strings: BOARD_STRINGS });
  const said = note();
  const area = document.createElement('div');
  area.style.cssText = 'transition:none';
  area.append(el);
  let docked = false;
  wrap.append(
    toolbar([
      ['Board', () => el.setAttribute('view', 'board')],
      ['List', () => el.setAttribute('view', 'list')],
      [
        'Dock a panel',
        (b) => {
          // A layout change the element cannot see: measure, change, glide from where it was.
          const before = el.measure();
          docked = !docked;
          area.style.maxWidth = docked ? '62%' : '';
          b.textContent = docked ? 'Undock' : 'Dock a panel';
          el.flipFrom(before);
        },
      ],
      ['Deep link: Rotate staging API keys', () => el.reveal('rotate')],
    ]),
    area,
    said,
  );
  el.addEventListener('ui-artifact', (e) => {
    said.textContent = `ui-artifact → ${JSON.stringify((e as CustomEvent).detail)}`;
  });
  el.addEventListener('ui-group-toggle', (e) => {
    said.textContent = `ui-group-toggle → ${JSON.stringify((e as CustomEvent).detail)}`;
  });
  return wrap;
}

/** The open card's body is the host's own markup, projected through `<slot name="body:<id>">`. */
function hostBodyDemo(): HTMLElement {
  const now = Date.now();
  const el = make({
    columns: [
      {
        id: 'needs-you',
        label: 'Needs you',
        cards: [
          {
            id: 'deploy',
            title: 'Deploy billing service',
            summary: 'Asks which region to roll out first.',
            status: 'waiting',
            since: now - 3 * MIN,
            bodyMode: 'slot',
            steps: { done: 2, total: 4 },
          },
        ],
      },
    ],
    expanded: ['deploy'],
    strings: BOARD_STRINGS,
  });
  const body = document.createElement('div');
  body.slot = 'body:deploy';
  body.style.cssText =
    'margin:0 14px;padding:12px 0 14px;border-top:1px solid color-mix(in srgb,currentColor 14%,transparent);font-size:13px;display:grid;gap:10px';
  const btn =
    'height:32px;padding:0 12px;border-radius:8px;border:1px solid color-mix(in srgb,currentColor 22%,transparent);background:none;color:inherit;font:inherit;font-size:13px;cursor:pointer';
  body.innerHTML = `<div style="font-weight:600">Which region first?</div>
<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" style="${btn}">eu-west-1</button><button type="button" style="${btn}">us-east-1</button></div>
<label style="display:grid;gap:4px"><span style="opacity:.75">Goal (Esc here keeps the card open)</span><textarea rows="2" style="font:inherit;font-size:13px;padding:6px 8px;border-radius:8px;border:1px solid color-mix(in srgb,currentColor 22%,transparent);background:none;color:inherit">Roll out with zero downtime.</textarea></label>
<div style="display:flex;gap:6px;justify-content:flex-end"><button type="button" style="${btn}">Stop</button><button type="button" style="${btn}">작업 로그</button></div>`;
  el.append(body);
  const wrap = document.createElement('div');
  wrap.style.maxWidth = '460px';
  wrap.style.marginInline = 'auto';
  wrap.append(el);
  return wrap;
}

/** Loading → (failed) → ready: skeletons, then this instance's cards without claims, then the certified board. */
function loadDemo(): HTMLElement {
  const now = Date.now();
  const cards = boardCards(now);
  const el = make({ columns: columnsByStatus([]), load: 'loading' });
  const wrap = document.createElement('div');
  wrap.append(
    toolbar([
      ['Loading', () => (el.data = { columns: columnsByStatus([]), load: 'loading' })],
      ['Failed (partial)', () => (el.data = { columns: columnsByStatus([cards[2]]), load: 'failed' })],
      ['Ready', () => (el.data = { columns: columnsByStatus(cards) })],
    ]),
    el,
  );
  return wrap;
}

/** The CRON lane: each job's runs are their own single-column, bare list under the host's job head. */
function cronLaneDemo(): HTMLElement {
  const now = Date.now();
  const lane = document.createElement('div');
  lane.style.cssText = 'display:grid;gap:14px';
  const job = (name: string, cards: InboxCard[]) => {
    const sec = document.createElement('section');
    const h = document.createElement('h4');
    h.textContent = name;
    h.style.cssText =
      'margin:0 0 8px 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--ui-text-secondary, #57575d)';
    const el = make(
      { columns: [{ id: `cron:${name}`, label: name, bare: true, cards }], announce: false, strings: BOARD_STRINGS },
      { view: 'list' },
    );
    sec.append(h, el);
    return sec;
  };
  const cron = (id: string, title: string, status: InboxCard['status'], ago: number, jobName: string): InboxCard => ({
    id,
    title,
    status,
    since: now - ago,
    elapsedMs: status === 'done' ? 3 * MIN + 12_000 : 0,
    lead: { text: 'CRON', glyph: 'clock', title: `크론 잡: ${jobName}` },
    tokens: 80_000 + Math.round(ago / 100),
    costUsd: 0.2,
  });
  lane.append(
    job('nightly-audit', [
      cron('audit-3', 'Nightly dependency audit', 'running', 2 * MIN, 'nightly-audit'),
      cron('audit-2', 'Nightly dependency audit', 'done', 24 * 60 * MIN, 'nightly-audit'),
    ]),
    job('weekly-digest', [cron('digest-9', 'Weekly metrics digest', 'done', 3 * 60 * MIN, 'weekly-digest')]),
  );
  lane.style.maxWidth = '520px';
  return lane;
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
        '{ id, label, emptyText?, cards, groups?, bare? } in display order. The host decides which column a card is in; `columnsByStatus(cards, lang)` builds the reference three (Needs you · Running · Done).',
    },
    {
      name: 'data.columns[].groups',
      type: 'Array<{ id, label, open?, cards }>',
      description:
        'Disclosure groups after the column’s own cards (DONE by finish day: Today · 어제 · 10월 24일 (금)). A head button with a chevron, the label, a count and aria-expanded. A closed group draws no cards. `open` (default true) rules until the person toggles the group (ui-group-toggle); then their choice does. The column count covers every group, open or closed; a group that leaves fades out. Holds and FLIP work across groups.',
    },
    {
      name: 'data.columns[].bare',
      type: 'boolean',
      description:
        'Just the list: no head, no tint, no empty hint; the section is labelled by `label`. For a single-column instance under the host’s own head (a CRON job’s runs, view="list", announce: false).',
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
      type: "{ total, running?, done?, failed?, dots?: Array<'running' | 'done' | 'failed' | 'stopped' | 'unknown'> }",
      description:
        'Sub-agents: dots from these counts only (the rest of total hollow) + “Sub-agents 40 · running 2”. `dots` draws them in the host’s order instead (spawn order; `stopped` is a square), six at most + `+N`.',
    },
    {
      name: 'data.columns[].cards[].tokens / costUsd',
      type: 'number',
      description: 'Total tokens · API-equivalent cost. Shown only when given; they count up when they grow.',
    },
    {
      name: 'data.columns[].cards[].artifacts',
      type: 'Array<string | { id, name, kind? }>',
      description:
        'Files the run made, newest first: count, up to four chips (glyph by extension or `kind`), +N. A name is an inert chip; `{ id, name }` is a chip button that sends ui-artifact and never toggles the card.',
    },
    {
      name: 'data.columns[].cards[].artifactsCount',
      type: 'number',
      description:
        'How many files the run made in all, when the chips are only the newest few. Default: artifacts.length.',
    },
    { name: 'data.columns[].cards[].steps', type: '{ done, total }', description: 'Progress in the foot (3/5).' },
    {
      name: 'data.columns[].cards[].contextPct',
      type: 'number',
      description: 'Context window used. >60 warns, >80 danger — unless contextLevel says otherwise.',
    },
    {
      name: 'data.columns[].cards[].contextLevel',
      type: "'warn' | 'danger' | ''",
      description:
        "The context metric’s level from the host (against the session’s auto-compact point). `''` = no level.",
    },
    {
      name: 'data.columns[].cards[].titles',
      type: '{ tokens?, cost?, context?, steps? }',
      description:
        'Tooltips that replace the built-in ones (`총 토큰 (task 합계: 메인 + 서브에이전트 4개) — 입력 · 출력 …`, `컨텍스트 72% · 자동 압축 750K까지 120K`).',
    },
    {
      name: 'data.columns[].cards[].lead',
      type: '{ text, glyph?, title? }',
      description:
        "Leads the head instead of the ✦ spark — a CRON badge (`{ text: 'CRON', glyph: 'clock', title: '크론 잡: nightly' }`). Glyphs: clock · pr · attach · file · tasks · context · agents · spark.",
    },
    {
      name: 'data.columns[].cards[].badge',
      type: '{ text, hue?, title? }',
      description:
        'A name pill at the right end of the head (the owner on an all-users board). `hue` 0–7 picks one of eight tints (≥ 4.5:1 in both themes); the title truncates first.',
    },
    {
      name: 'data.columns[].cards[].metrics',
      type: "Array<{ text, glyph?, tone?: 'run' | 'done' | 'fail' | 'wait' | 'warn' | 'danger', title?, label? }>",
      description:
        'Host metrics after tasks and context: a PR badge (`#12 머지됨`, tone done), a media count (`2`, label `지시 첨부 2개`). Text only — never markup.',
    },
    {
      name: 'data.columns[].cards[].bodyMode',
      type: "'steps' | 'slot'",
      default: "'steps'",
      description:
        '`slot`: the open card shows `<slot name="body:<id>">` instead of its steps and buttons, so the host’s light-DOM child with `slot="body:<id>"` is the body — its CSS, its controls (approval cards, a question, a picker, Stop / Close, 작업 로그) and its gates. It is inert while the card is closed; Esc inside it closes the card (not from a field); its buttons never send ui-action / ui-open. The slot node is never rewritten, so drafts and focus survive renders.',
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
      name: 'data.load',
      type: "'loading' | 'failed' | 'ready'",
      default: "'ready'",
      description:
        'loading: skeleton cards where no card is drawn yet, the board aria-busy, no counts, no empty hints, nothing announced. failed: the cards given (this instance’s, under the host’s 다시 시도 bar), still no counts, hints or announcement. ready: the certified board.',
    },
    {
      name: 'data.announce',
      type: '{ needs, running } | false',
      description:
        'What the live region counts: the host’s own numbers (a CRON lane on other instances included), or false for silence (a lane instance, a partial paint). Default: counted from this element’s cards.',
    },
    {
      name: 'data.strings',
      type: 'Partial<InboxStrings>',
      description:
        "Merged over the lang table, so a board keeps its own wording: status.{waiting,running,done,failed,idle}, doneIn, empty, open, agents, agentsRunning(n), agentsFailed(n), tok, tokTitle, costTitle, steps, ctx(p), arts, artOpen(name), earlier(n), announce(w, r), changed(title, word) (return '' to drop the prefix), ago(at, now), duration(ms). A value of the wrong type is ignored. Compared by value (shallowly, status one level deeper) on each render and clock tick, so an object changed in place is seen too.",
    },
    {
      name: 'reveal(cardId, { open?, scroll? })',
      type: 'method → boolean',
      description:
        'A deep link: renders pending data, opens the card’s closed group (ui-group-toggle), opens the card without transition (ui-toggle) unless open: false, and scrolls it to the centre unless scroll: false. False (no scroll) when the card is not on the board or the host prevented its group or the card from opening; a card with nothing to open is just scrolled to.',
    },
    {
      name: 'measure() / flipFrom(layout)',
      type: 'methods',
      description:
        'For layout changes the element cannot see (a panel docks, a section folds): `const at = el.measure()` before, change the layout, then `el.flipFrom(at)` glides every card and head from where it was (translate, 320 ms). A card or head still gliding starts again from where it is drawn, not from `at`, so a host may re-flip from its last settled `measure()` during a resize burst. Nothing moves on the first paint, in a hidden tab or under reduced motion.',
    },
    {
      name: 'data.openLabel',
      type: 'string | false',
      default: "'Open'",
      description: 'Label of the Open button (ui-open); false hides it. Ink when the card has no live primary.',
    },
    {
      name: 'view',
      type: "'board' | 'list'",
      description:
        'Attribute. Default: board from 640px of width (columns scroll sideways below 840px), list below. Switching it glides the cards and heads to their new places (FLIP).',
    },
    {
      name: 'lang',
      type: "'en' | 'ko'",
      default: "'en'",
      description:
        'UI language (attribute). ko: status words, 비어 있음, 서브에이전트, 5분 전, and durations as 7분 12초 · 2시간 3분 (running timers, Done in, task times).',
    },
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
        'A card opened or closed (click, Enter / Space, Esc, reveal). Cancelable: preventDefault keeps it as it was. A click that ends a text selection in the face does not toggle.',
    },
    {
      name: 'ui-artifact',
      detail: '{ cardId: string; artifactId: string }',
      description: 'A file chip (`artifacts[] { id, name }`) was pressed — open the viewer. The card does not toggle.',
    },
    {
      name: 'ui-group-toggle',
      detail: '{ columnId: string; groupId: string; open: boolean }',
      description:
        'A group head was pressed (or reveal opened it). Cancelable. The person’s choice then rules over group.open.',
    },
  ],
  keyboard: [
    ['Tab', 'Through the cards, then the buttons inside an open card'],
    ['Enter / Space', 'Open or close the focused card (no transition); press a button'],
    ['Enter / Space on a group head', 'Open or close the group'],
    [
      'Esc',
      'Close the open card the focus is in — its own body or the host’s slotted body — and put focus back on it (not from a text field or select)',
    ],
  ],
  a11y: [
    'Each column is a <section> labelled by its name and count (“Needs you 2”); cards are a list.',
    'A card face is a button with aria-expanded and aria-controls; a closed card’s details are inert.',
    'A polite live region says “N need you, M running” — the first sentence at once, then only changes, a burst within 1 s said once; a single card’s change is named first.',
    'Status is icon + word + colour, never colour alone; the tag text is ≥ 4.5:1 on its tint in both themes.',
    'A disabled action stays focusable (aria-disabled) and carries its reason.',
    'A group head is a button with aria-expanded and aria-controls; its list is labelled by the group’s label.',
    'While the board loads it is aria-busy and makes no claims: no counts, no “Nothing here”, no announcement.',
    'Host face extras are text only (escaped): a metric’s label is its accessible name; a file chip button says “Open <name>” (`artOpen`).',
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
      id: 'dashboard',
      title: 'The dashboard board (host extras)',
      description:
        'Owner badges, a CRON run, PR and media metrics, host tooltips and a context level, file chips that send ui-artifact, DONE grouped by day (a closed day draws no cards), the board’s mixed wording through data.strings. Board / List and Dock a panel glide; the deep link opens the closed day and the card.',
      height: 900,
      frame: false,
      create: dashboardDemo,
    },
    {
      id: 'host-body',
      title: 'Host body (bodyMode: slot)',
      description:
        'The open card’s body is the host’s light-DOM markup in slot="body:deploy": its buttons stay the host’s, Esc in the textarea keeps the card open, Esc on a button closes it.',
      height: 420,
      frame: false,
      create: hostBodyDemo,
    },
    {
      id: 'load',
      title: 'Loading · failed · ready',
      description:
        'Skeletons until the first answer; a failed first load shows only this instance’s cards with no counts or hints; ready certifies the board.',
      height: 760,
      frame: false,
      create: loadDemo,
    },
    {
      id: 'cron-lane',
      title: 'CRON lane (bare single-column instances)',
      description:
        'Each job’s runs are their own <ui-agent-inbox view="list"> with one bare column under the host’s job head, announce: false.',
      height: 520,
      frame: false,
      create: cronLaneDemo,
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
