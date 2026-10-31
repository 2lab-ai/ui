import type { ComponentDoc } from '../../docs/types';
import '../tool-call-card/tool-call-card';
import type { ToolCallData } from '../tool-call-card/logic';
import type { WorkEntry, WorkGroup, WorkLogData } from './logic';
import './work-log';
import type { UiWorkLog } from './work-log';

const MIN = 60_000;

function make(data: WorkLogData, height = 460, lang?: string): UiWorkLog {
  const el = document.createElement('ui-work-log');
  if (lang) el.setAttribute('lang', lang);
  el.style.cssText = `height:${height}px;width:100%;border-radius:12px`;
  el.data = data;
  return el;
}

/** A copy of the groups the element can tell apart from the last one (new arrays, same entry objects). */
function copy(groups: WorkGroup[]): WorkGroup[] {
  return groups.map((g) => ({ ...g, entries: [...(g.entries ?? [])] }));
}

/** Patch one entry by id (immutably) — what a host does when a raw output loads. */
function patch(groups: WorkGroup[], id: string, change: Partial<WorkEntry>): WorkGroup[] {
  return groups.map((g) => ({
    ...g,
    entries: (g.entries ?? []).map((e) => (e.id === id ? { ...e, ...change } : e)),
  }));
}

const RAW_PROMPT = `Fix the router so an empty path goes to the home page instead of the 404 page.
Keep the existing redirects. Add tests for "", "/" and "//".`;

const RAW_RESPONSE = `Changed src/router.ts:
- normalise the path before matching ("" and "//" become "/")
- keep the redirect table as it is

Tests: src/router.test.ts — 4 new cases, all passing.
npm test: 132 passed, 2 skipped.`;

/** The run the first demo shows: three tasks, the newest still going. */
function runGroups(now: number): WorkGroup[] {
  const t1 = now - 38 * MIN;
  const t2 = now - 21 * MIN;
  const t3 = now - 6 * MIN;
  return [
    {
      id: 'task-1',
      ref: 'T-1',
      title: 'Read the routing code',
      at: t1,
      meta: ['Done in 3m', { label: 'Tools', value: '1' }],
      entries: [
        { id: 'w1', kind: 'instruction', text: 'Find out why an empty path shows the 404 page.', at: t1, hasRaw: true },
        { id: 'w2', kind: 'narration', text: 'Reading the router and its tests first.', at: t1 + 9_000 },
        {
          id: 'w3',
          kind: 'tool',
          tool: { name: 'Read', status: 'success', summary: 'src/router.ts (212 lines)' },
          at: t1 + 12_000,
        },
        {
          id: 'w4',
          kind: 'final',
          text: 'The matcher compares the raw path, so "" never equals "/".',
          at: t1 + 3 * MIN,
          hasRaw: true,
        },
      ],
    },
    {
      id: 'task-2',
      ref: 'T-2',
      title: 'Fix the empty path',
      at: t2,
      meta: ['Done in 8m', { label: 'Tools', value: '3' }, { label: 'Agents', value: '1' }],
      entries: [
        {
          id: 'w5',
          kind: 'instruction',
          text: 'Fix it and add tests.',
          at: t2,
          hasRaw: true,
          skills: [
            { name: 'test-first', text: 'Write the failing test before the fix. Run it, see it fail, then fix.' },
            { name: 'code-review', tokens: 1_840 },
          ],
        },
        {
          id: 'w6',
          kind: 'system',
          system: { kind: 'compact' },
          text: 'Context compacted to make room',
          at: t2 + 40_000,
        },
        {
          id: 'w7',
          kind: 'tool',
          tool: { name: 'Edit', status: 'success', summary: 'src/router.ts — normalise the path' },
          at: t2 + 2 * MIN,
        },
        {
          id: 'w8',
          kind: 'agent',
          agent: { id: 'agent-tests', name: 'Test runner', status: 'done', duration: 94_000, tools: 6 },
          at: t2 + 3 * MIN,
        },
        { id: 'w9', kind: 'notice', text: 'The linter was slow to start; nothing changed.', at: t2 + 6 * MIN },
        { id: 'w10', kind: 'final', text: 'Fixed. 4 new tests pass.', at: t2 + 8 * MIN, hasRaw: true },
      ],
    },
    // Outside any task: the instruction that starts the next turn, in line between the groups.
    {
      id: 'turn-3',
      headless: true,
      entries: [
        {
          id: 'w15',
          kind: 'instruction',
          text: 'Open a pull request once the tests are green.',
          at: t3 - 20_000,
          hasRaw: true,
        },
      ],
    },
    {
      id: 'task-3',
      ref: 'T-3',
      title: 'Open a pull request',
      at: t3,
      entries: [
        { id: 'w11', kind: 'system', system: { kind: 'goal', label: 'Goal 3/3' }, text: 'Ship the fix', at: t3 },
        {
          id: 'w12',
          kind: 'error',
          text: 'Push rejected: the branch is behind main.',
          at: t3 + MIN,
          raw: { state: 'error' },
        },
        { id: 'w13', kind: 'narration', text: 'Rebasing on main, then pushing again.', at: t3 + 2 * MIN },
        {
          id: 'w14',
          kind: 'agent',
          agent: {
            id: 'agent-ci',
            name: 'CI watcher',
            status: 'running',
            startedAt: now - 95_000,
            tools: 2,
            activity: 'Waiting for the checks on #482',
          },
          at: now - 95_000,
        },
      ],
    },
  ];
}

const RAW_TEXT: Record<string, string> = {
  w1: 'Find out why an empty path shows the 404 page.\n\n(Sent from the web app, 2 attachments.)',
  w4: RAW_RESPONSE.split('\n')[0],
  w5: RAW_PROMPT,
  w10: RAW_RESPONSE,
  w15: 'Open a pull request once the tests are green.\n\n(Sent from Slack.)',
};

/** Loads a raw output when a row opens; Retry works after a short wait. */
function wireRaw(el: UiWorkLog, get: () => WorkGroup[], set: (g: WorkGroup[]) => void): void {
  el.addEventListener('ui-toggle', (e) => {
    const d = (e as CustomEvent).detail as { kind: string; id: string; open: boolean };
    if (d.kind !== 'entry' || !d.open || !(d.id in RAW_TEXT)) return;
    setTimeout(() => set(patch(get(), d.id, { raw: { state: 'ready', text: RAW_TEXT[d.id] } })), 450);
  });
  el.addEventListener('ui-retry', (e) => {
    const id = (e as CustomEvent).detail.id as string;
    setTimeout(
      () =>
        set(
          patch(get(), id, {
            raw: {
              state: 'ready',
              text: '! [rejected] feat/empty-path -> feat/empty-path (non-fast-forward)\nhint: Updates were rejected because the tip of your current branch is behind',
              note: 'From the stored copy',
            },
          }),
        ),
      600,
    );
  });
}

/** A few more steps land in the newest group while the demo is on screen. */
function stream(el: UiWorkLog, get: () => WorkGroup[], set: (g: WorkGroup[]) => void): void {
  const steps: Array<Omit<WorkEntry, 'id' | 'at'>> = [
    { kind: 'tool', tool: { name: 'Bash', status: 'success', summary: 'git rebase origin/main' } },
    { kind: 'tool', tool: { name: 'Bash', status: 'success', summary: 'git push --force-with-lease' } },
    { kind: 'narration', text: 'Pushed. Waiting for the checks.' },
    { kind: 'final', text: 'Pull request #482 is open and the checks are green.' },
  ];
  let n = 0;
  const tick = () => {
    if (!el.isConnected || n >= steps.length) return;
    const groups = copy(get());
    groups[groups.length - 1].entries?.push({ ...steps[n], id: `live-${n}`, at: Date.now() } as WorkEntry);
    n++;
    set(groups);
    setTimeout(tick, 3_200);
  };
  setTimeout(tick, 3_200);
}

/** Older page `page` (-1, -2): two groups each, numbered below the ones shown (T-5 … T-7). */
function olderPage(page: number, now: number): WorkGroup[] {
  const titles = ['Read the issue thread', 'Triage the bug report', 'Reproduce it locally', 'Check the last release'];
  const first = (2 + page) * 2;
  return [0, 1].map((i) => {
    const at = now - (2 - page) * 60 * MIN + i * 25 * MIN;
    const id = `old${page}-${i}`;
    return {
      id,
      ref: `T-${first + i + 1}`,
      title: titles[first + i] ?? 'Earlier task',
      at,
      entries: [
        { id: `${id}-a`, kind: 'instruction', text: 'Look into the 404 on an empty path.', at },
        { id: `${id}-b`, kind: 'narration', text: 'Collecting what the report says.', at: at + 40_000 },
        { id: `${id}-c`, kind: 'final', text: 'Noted the steps to reproduce.', at: at + 4 * MIN },
      ],
    };
  });
}

function cardsDemo(): HTMLElement {
  const now = Date.now();
  const at = now - 4 * MIN;
  const groups: WorkGroup[] = [
    {
      id: 'c1',
      ref: 'T-7',
      title: 'Check the config loader',
      at,
      entries: [
        { id: 'c-1', kind: 'narration', text: 'Reading the loader and its schema.', at },
        { id: 'c-2', kind: 'tool', tool: { name: 'Read', status: 'success', summary: 'src/config/load.ts' }, at },
        {
          id: 'c-3',
          kind: 'tool',
          tool: { name: 'Bash', status: 'error', summary: 'npm run typecheck' },
          at: at + 30_000,
        },
        {
          id: 'c-4',
          kind: 'tool',
          tool: { name: 'Grep', status: 'success', summary: '“loadConfig(” in src — 7 matches' },
          at: at + 50_000,
        },
        { id: 'c-5', kind: 'final', text: 'One call site passed a string path; fixed.', at: at + 2 * MIN },
      ],
    },
  ];
  const el = make({ groups }, 520);
  const cards: Array<[string, ToolCallData]> = [
    [
      'c-2',
      {
        name: 'Read',
        summary: 'src/config/load.ts (lines 1-60)',
        status: 'success',
        duration: 41,
        at,
        args: { file_path: 'src/config/load.ts', limit: 60 },
        result:
          'export async function loadConfig(path: URL) {\n  const text = await readFile(path, "utf8");\n  return parse(text);\n}',
      },
    ],
    [
      'c-3',
      {
        name: 'Bash',
        summary: 'npm run typecheck',
        status: 'error',
        duration: 6_420,
        at: at + 30_000,
        args: { command: 'npm run typecheck' },
        error:
          "src/cli.ts(14,22): error TS2345: Argument of type 'string' is not assignable to parameter of type 'URL'.",
      },
    ],
    // c-4 has no card: the plain line stands in.
  ];
  for (const [id, data] of cards) {
    const card = document.createElement('ui-tool-call-card');
    card.slot = `tool-${id}`;
    card.data = data;
    el.append(card);
  }
  return el;
}

export const doc: ComponentDoc = {
  slug: 'work-log',
  name: 'Work Log',
  tag: 'ui-work-log',
  group: 'Components',
  summary: 'What did the agent actually do? — every step, grouped by task, with the raw output one click away.',
  description:
    'A chronological log of an agent’s work, folded under the task each step belongs to. A group head shows the task’s reference, title, entry count and start time; the newest group is open and older ones are folded (the reader’s choice sticks). Inside: instructions with the skills they invoked, progress lines, responses, notices, errors, system turns (compacted, restarted, goal …), tool calls — your <ui-tool-call-card> in the entry’s slot, or a plain status line — and child agents with an Open action. A row with stored output opens a raw viewer with size, Copy and Retry. It sits on <ui-log-scroller>: it follows the newest step, pages older groups on request and never moves what you are reading; a new data object only touches the groups and entries that changed.',
  usedIn:
    'soma-work dashboard › detail panel › 작업 로그 section (F-01 list, F-02 task groups, F-03 entry rows, F-04/F-05 tool rows and cards, F-06 raw output, F-07 child agents, F-08 system lines, F-09 skill badges, F-10 empty / owner-only / legacy).',
  reference: { name: 'WAI-ARIA log role', url: 'https://www.w3.org/TR/wai-aria-1.2/#log' },
  props: [
    {
      name: 'data.groups',
      type: 'WorkGroup[]',
      required: true,
      description:
        'Oldest first. { id, ref?, title?, at?, count?, open?, meta?, headless?, entries }. ref defaults to the id ("" hides it); open set → controlled.',
    },
    {
      name: 'group.meta',
      type: '(string | { label, value? })[]',
      description:
        'The task’s ledger as one quiet · separated line under the title: how it ended, its time, { label: "Tools", value: "12" }. Strings as they are.',
    },
    {
      name: 'group.headless',
      type: 'boolean',
      description:
        'No head: the entries stand in line between the task groups (the instruction that starts a turn, the response that ends it) — always shown, never folded, on the arrow path. The newest group with a head is the one open by default.',
    },
    {
      name: 'data.groups[].entries',
      type: 'WorkEntry[]',
      description:
        'Oldest first. { id (unique in the log), kind, text?, at?, label?, tool?, system?, agent?, skills?, raw?, hasRaw? }. kind: instruction · narration · final · notice · error · tool · system · agent.',
    },
    {
      name: 'entry.tool',
      type: '{ name, status, summary? }',
      description:
        'kind tool. Put <ui-tool-call-card slot="tool-<entry id>"> in the element for the full card; without one a plain line shows (status icon + word, name, summary).',
    },
    {
      name: 'entry.agent',
      type: '{ id, name, status?, startedAt?, duration?, tools?, activity? }',
      description:
        'A child agent the entry started (kind agent, or under any entry): status icon + word, time (counts up while running), tool count, Open → ui-open.',
    },
    {
      name: 'entry.system',
      type: '{ kind: "compact" | "restart" | "retry" | "goal" | "cron" | "background" | string, label? }',
      description: 'kind system: a badge (icon + word) and the entry’s text as one line.',
    },
    {
      name: 'entry.skills',
      type: '{ name, tokens?, text? }[]',
      description: 'Skill chips under the row; a chip opens the skill’s text below (tokens estimated from the text).',
    },
    {
      name: 'entry.raw · entry.hasRaw',
      type: '{ state, text?, bytes?, truncated?, note?, canRetry? } · boolean',
      description:
        'The row opens to its raw output: ready (size, Copy, the text), loading, missing, denied or error (Retry). hasRaw without raw: Loading… until you set raw after ui-toggle.',
    },
    {
      name: 'data.hasMore',
      type: 'boolean',
      default: 'false',
      description: 'Older groups exist (Load older row; scrolling up asks).',
    },
    {
      name: 'data.loading',
      type: 'boolean',
      default: 'false',
      description: 'First page: skeleton lines. With groups: the older row loads.',
    },
    {
      name: 'data.denied',
      type: 'boolean | string',
      description: 'The reader may not see the log: no groups, an owner-only notice (string = your text).',
    },
    {
      name: 'data.legacy',
      type: 'boolean | string',
      description: 'A note above the log: an older log that did not record which agent wrote each entry.',
    },
    { name: 'data.label', type: 'string', default: '"Work log"', description: 'Accessible name of the log.' },
    {
      name: 'data.emptyText · data.startText',
      type: 'string',
      description: 'Empty state; start-of-history marker ("" hides it).',
    },
    {
      name: 'data.live',
      type: 'boolean',
      default: 'true',
      description: 'role="log": new steps are announced politely.',
    },
    {
      name: 'lang · theme',
      type: '"en" | "ko" · "light" | "dark"',
      description: 'Attributes (mirrored to the inner scroller).',
    },
    {
      name: 'scrollToLatest({ smooth? }) · entryFor(id) · isOpen(groupId)',
      type: 'method',
      description: 'Jump to the newest step; the element of an entry; whether a group is open.',
    },
    {
      name: 'slot="tool-<entry id>"',
      type: 'slot',
      description: 'One per tool entry: the host’s <ui-tool-call-card>. Set lang / theme on the cards you slot.',
    },
    {
      name: '::part(viewport) · ::part(jump)',
      type: 'part',
      description: 'The scroll box and the “new” pill of the inner <ui-log-scroller>.',
    },
  ],
  events: [
    {
      name: 'ui-toggle',
      detail: "{ kind: 'group' | 'entry', id: string, group: string, open: boolean }",
      description:
        'A group head or an entry row was pressed. Cancelable: preventDefault keeps it as it was. For an entry opening with no raw yet, load it and set entry.raw.',
    },
    {
      name: 'ui-open',
      detail: '{ id: string, entry: string }',
      description: 'Open a child agent (its id and the entry it sits on). Cancelable.',
    },
    {
      name: 'ui-retry',
      detail: '{ id: string, group: string }',
      description:
        'Retry loading an entry’s raw output. Cancelable; otherwise the viewer shows Loading… until that entry’s raw changes.',
    },
    {
      name: 'ui-copy',
      detail: '{ id: string, group: string, text: string }',
      description: 'The raw output was copied (clipboard written when available). Notification, not cancelable.',
    },
    {
      name: 'ui-load-older',
      detail: '{ oldest: string | null }',
      description:
        'From the inner scroller (composed): the oldest group id shown. Answer with data whose groups start with the older ones (and hasMore); a data without them ends the loading row.',
    },
  ],
  keyboard: [
    ['Tab', 'The log has one stop: the newest row (or the one you last focused). The scroll box itself is a stop too.'],
    ['↑ / ↓', 'Previous / next group head, openable row or child agent (rows of folded groups are skipped).'],
    ['Home / End', 'First / last of those.'],
    ['Enter / Space', 'Open or fold a group; open or close a row’s raw output; open a child agent.'],
    ['→ / ← on a group head', 'Open / fold the group.'],
  ],
  a11y: [
    'The list is the scroller’s role="log" (polite); opened raw outputs are aria-live="off" so a long output is never read out.',
    'Group heads are buttons inside headings with aria-expanded and aria-controls; a folded group’s body is inert. Focus inside a group that folds moves to its head. A headless group has no head: its entries are always shown and on the arrow path.',
    'Openable rows are role="button" with aria-expanded / aria-controls; child agents are buttons named “Open <name> — <status>, <n> tools”.',
    'Status is always an icon plus a word (Done, Failed, Running …), never colour alone; times are <time datetime>.',
    'Reduced motion: groups open without the height glide or chevron turn; spinners stand still.',
    'Sound (opt-in, @2lab.ai/ui/sound): a quiet open / close when the user opens or folds a group or a row, a soft success when a copy lands, a tap for Retry, a navigate for Open on a child agent. Silent until the page turns sound on.',
  ],
  usage: `<ui-work-log style="height: 480px"></ui-work-log>
<script type="module">
  import '@2lab.ai/ui/work-log';
  import '@2lab.ai/ui/tool-call-card';
  const log = document.querySelector('ui-work-log');
  log.data = { groups, hasMore: true };          // oldest first; live updates: set a new data object
  log.addEventListener('ui-toggle', async (e) => {
    if (e.detail.kind !== 'entry' || !e.detail.open) return;
    const raw = await loadRaw(e.detail.id);       // { state: 'ready', text, bytes } or { state: 'missing' }
    log.data = withRaw(log.data, e.detail.id, raw);
  });
  log.addEventListener('ui-load-older', async (e) => {
    const page = await fetchOlder(e.detail.oldest);
    log.data = { ...log.data, groups: [...page.groups, ...log.data.groups], hasMore: page.hasMore };
  });
  log.addEventListener('ui-open', (e) => openAgentTab(e.detail.id));
  // A tool call as a card: one per tool entry.
  const card = document.createElement('ui-tool-call-card');
  card.slot = 'tool-' + entry.id;
  card.data = toolCall;
  log.append(card);
</script>`,
  demos: [
    {
      id: 'run',
      title: 'A run, live',
      description:
        'Three tasks; the newest is open and still going (a child agent counts up, steps keep landing). Open a row for its raw output, try Copy, Retry the failed push, open a skill chip.',
      height: 560,
      create: () => {
        let groups = runGroups(Date.now());
        const el = make({ groups, label: 'Agent work' }, 520);
        const set = (g: WorkGroup[]) => {
          groups = g;
          el.data = { groups, label: 'Agent work' };
        };
        wireRaw(el, () => groups, set);
        stream(el, () => groups, set);
        return el;
      },
    },
    {
      id: 'older',
      title: 'Older tasks on demand',
      description:
        'Scroll to the top (or press Load older): two earlier pages arrive above without moving what you read, then the start of the log.',
      height: 480,
      create: () => {
        const now = Date.now();
        // A first page taller than the box: nothing older is fetched until the reader scrolls up.
        let groups: WorkGroup[] = runGroups(now).map((g, i) => ({ ...g, ref: `T-${5 + i}` }));
        const newest = groups[groups.length - 1];
        const bash = (id: string, summary: string, ago: number): WorkEntry => ({
          id,
          kind: 'tool',
          tool: { name: 'Bash', status: 'success', summary },
          at: now - ago,
        });
        newest.entries = [
          ...(newest.entries ?? []),
          bash('f1', 'git fetch origin main', 80_000),
          bash('f2', 'git rebase origin/main', 70_000),
          bash('f3', 'npm test — 128 passed', 45_000),
          { id: 'f4', kind: 'narration', text: 'Rebased cleanly and the tests pass. Pushing again.', at: now - 20_000 },
        ];
        let page = 0;
        const el = make({ groups, hasMore: true }, 440);
        el.addEventListener('ui-load-older', () => {
          setTimeout(() => {
            page--;
            groups = [...olderPage(page, now), ...groups];
            el.data = { groups, hasMore: page > -2 };
          }, 700);
        });
        return el;
      },
    },
    {
      id: 'cards',
      title: 'Tool calls as cards',
      description:
        'Each tool entry has a slot (tool-<entry id>) for the host’s <ui-tool-call-card>. The Grep call has no card, so its plain line stands in.',
      height: 560,
      create: cardsDemo,
    },
    {
      id: 'states',
      title: 'Empty, owner-only and legacy',
      description:
        'No steps yet; a reader who is not the owner; and a log from an older format, with a note that it does not say which agent wrote each step.',
      height: 340,
      create: () => {
        const box = document.createElement('div');
        box.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;width:100%';
        const legacy = runGroups(Date.now())
          .slice(0, 1)
          .map((g) => ({ ...g, open: true }));
        const items = [
          make({ groups: [] }, 300),
          make({ denied: true }, 300),
          make({ groups: legacy, legacy: true }, 300),
        ];
        for (const el of items) el.style.border = '1px solid var(--ui-ib-card-border)';
        box.append(...items);
        return box;
      },
    },
    {
      id: 'ko',
      title: 'Korean',
      description: 'lang="ko": 지시 · 진행 · 응답 · 알림 · 오류, 툴 N개, 열기, 항목 N개.',
      height: 500,
      create: () => {
        const now = Date.now();
        const at = now - 12 * MIN;
        const groups: WorkGroup[] = [
          {
            id: 'k1',
            ref: 'T-4',
            title: '설정 로더 점검',
            at: at - 30 * MIN,
            meta: ['8분 만에 완료', { label: '툴', value: '3회' }],
            entries: [
              { id: 'k-1', kind: 'instruction', text: '설정 파일을 못 읽는 원인을 찾아 주세요.', at: at - 30 * MIN },
              { id: 'k-2', kind: 'final', text: '경로를 문자열로 넘기는 호출이 원인이었어요.', at: at - 22 * MIN },
            ],
          },
          {
            id: 'k2',
            ref: 'T-5',
            title: '수정하고 테스트 추가',
            at,
            entries: [
              {
                id: 'k-3',
                kind: 'instruction',
                text: '고치고 테스트를 추가해 주세요.',
                at,
                skills: [{ name: 'test-first', text: '실패하는 테스트를 먼저 작성하고, 실패를 확인한 뒤 고칩니다.' }],
              },
              { id: 'k-4', kind: 'narration', text: '호출부 7곳을 확인하는 중이에요.', at: at + 30_000 },
              {
                id: 'k-5',
                kind: 'tool',
                tool: { name: 'Edit', status: 'success', summary: 'src/cli.ts — URL로 변환' },
                at: at + 2 * MIN,
              },
              {
                id: 'k-6',
                kind: 'system',
                system: { kind: 'restart' },
                text: '세션을 다시 시작했어요',
                at: at + 4 * MIN,
              },
              {
                id: 'k-7',
                kind: 'agent',
                agent: { id: 'k-agent', name: '테스트 실행기', status: 'failed', duration: 41_000, tools: 4 },
                at: at + 5 * MIN,
              },
              {
                id: 'k-8',
                kind: 'error',
                text: '테스트 1개 실패: loadConfig가 빈 파일에서 멈춤',
                at: at + 6 * MIN,
                raw: { state: 'denied' },
              },
              { id: 'k-9', kind: 'notice', text: '네트워크가 느려 재시도했어요.', at: at + 7 * MIN },
            ],
          },
        ];
        return make({ groups, hasMore: false }, 460, 'ko');
      },
    },
  ],
};
