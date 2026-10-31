import type { ComponentDoc } from '../../docs/types';
import './tool-call-card';
import './tool-call-group';
import type { ToolCallData, ToolCallGroupData } from './logic';

function card(data: ToolCallData, attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('ui-tool-call-card');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

function group(data: ToolCallGroupData, attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('ui-tool-call-group');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

function stack(...els: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:grid;gap:10px';
  box.append(...els);
  return box;
}

const READ_ARGS = '{"file_path":"/opt/soma-work/src/conversation/dashboard.ts","offset":14468,"limit":12}';
const READ_RESULT = ` 14468→function renderWorkLogEntry(e) {
 14469→  var kind = Object.prototype.hasOwnProperty.call(WL_LABELS, e.kind) ? e.kind : 'narration';
 14470→  var time = typeof e.ts === 'number' && isFinite(e.ts)
 14471→    ? new Date(e.ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
 14472→    : '';
 14473→  var timeHtml = time ? '<span class="wl-time">' + time + '</span>' : '';
 14474→  var seq = Math.floor(Number(e.seq) || 0);
 14475→  var seqAttr = ' data-seq="' + seq + '"';`;

const GREP_ARGS = { pattern: 'renderWorkLogDetail', path: 'src/conversation', output_mode: 'content', '-n': true };
const GREP_RESULT = `src/conversation/dashboard.ts:14048:function renderWorkLogDetail(r) {
src/conversation/dashboard.ts:14174:  if (detail) detail.innerHTML = renderWorkLogDetail(result);`;

const BASH_ARGS = {
  command: 'npx vitest run src/conversation/dashboard.test.ts',
  description: 'Run the dashboard tests',
  timeout: 120000,
};
const BASH_FAIL = `Command failed with exit code 1

 FAIL  src/conversation/dashboard.test.ts > work log > renders a tool row
AssertionError: expected '<span class="wl-mark">▸</span>' to contain 'ui-tool-call-card'
 ❯ src/conversation/dashboard.test.ts:812:31`;

const FETCH_ARGS = {
  url: 'https://docs.anthropic.com/en/docs/claude-code/hooks',
  prompt: 'Which hook events exist and what does each receive?',
};
const FETCH_RESULT = `Claude Code exposes these hook events: PreToolUse, PostToolUse, Notification, UserPromptSubmit, Stop, SubagentStop, PreCompact, SessionStart and SessionEnd. Each receives a JSON object on stdin with session_id, transcript_path and hook_event_name, plus event-specific fields (tool_name and tool_input for the tool hooks).`;

const ISSUE = JSON.stringify({
  number: 812,
  title: '작업 로그: tool calls as one card each',
  state: 'open',
  user: { login: 'zhugehyuk', type: 'User' },
  labels: [
    { name: 'dashboard', color: '1f6dc2' },
    { name: 'ui', color: '7c3aed' },
  ],
  assignees: [{ login: 'zhugehyuk' }],
  milestone: null,
  comments: 3,
  locked: false,
  created_at: '2026-10-27T08:41:12Z',
  updated_at: '2026-10-27T09:02:47Z',
  body: 'Render every tool call and its result in 작업 로그 as one <ui-tool-call-card>: name, summary, status and time on one line, the raw input and output on open.',
  reactions: { total_count: 2, '+1': 2, heart: 0 },
  pull_request: null,
  html_url: 'https://github.com/2lab-ai/soma-work/issues/812',
  repository_url: 'https://api.github.com/repos/2lab-ai/soma-work',
  author_association: 'OWNER',
});

function failingFetch(): HTMLElement {
  const started = Date.now();
  const base: ToolCallData = {
    id: 'toolu_fetch',
    name: 'WebFetch',
    summary: 'docs.anthropic.com/en/docs/claude-code/hooks',
    status: 'running',
    startedAt: started,
    at: started,
    args: FETCH_ARGS,
    canRetry: true,
  };
  const el = card(base) as HTMLElementTagNameMap['ui-tool-call-card'];
  setTimeout(() => {
    el.data = {
      ...base,
      status: 'error',
      duration: 1200,
      error: 'Request timed out after 30s — docs.anthropic.com didn’t respond.',
    };
  }, 1200);
  el.addEventListener('ui-retry', () => {
    const again = Date.now();
    el.data = { ...base, status: 'running', startedAt: again, at: again };
    setTimeout(() => {
      el.data = { ...base, status: 'success', startedAt: again, at: again, duration: 1480, result: FETCH_RESULT };
    }, 1480);
  });
  return el;
}

function lazyCards(lang?: string): HTMLElement {
  const attrs: Record<string, string> = lang ? { lang } : {};
  const now = Date.now();
  const loading = card(
    {
      id: 'toolu_read',
      name: 'Read',
      summary: 'src/conversation/dashboard.ts (lines 14468-14479)',
      status: 'success',
      duration: 38,
      at: now - 42_000,
      args: READ_ARGS,
      defaultOpen: true,
      loading: true,
    },
    attrs,
  );
  const failedBase: ToolCallData = {
    id: 'toolu_bash',
    name: 'Bash',
    summary: 'npm run build:site',
    status: 'success',
    duration: 8_420,
    at: now - 31_000,
    args: { command: 'npm run build:site', description: 'Build the library and the demo site' },
    defaultOpen: true,
  };
  const failed = card(
    { ...failedBase, detailError: 'Couldn’t load the stored output (HTTP 502).' },
    attrs,
  ) as HTMLElementTagNameMap['ui-tool-call-card'];
  failed.addEventListener('ui-reload', () => {
    failed.data = { ...failedBase, loading: true };
    setTimeout(() => {
      failed.data = {
        ...failedBase,
        result: `vite v7.2.7 building for production...\n✓ 64 modules transformed.\ndist/index.js        212.41 kB\ndist/tool-call-card.js  31.87 kB\n✓ built in 1.84s\ncheck-dist: 10 exports ok, 118 relative imports resolve\nsite-dist/lib ready`,
        note: 'Showing the first 256 KiB of 1.2 MB',
      };
    }, 900);
  });
  return stack(loading, failed);
}

export const doc: ComponentDoc = {
  slug: 'tool-call-card',
  name: 'Tool Call Card',
  tag: 'ui-tool-call-card',
  group: 'Components',
  summary: 'What the agent called, with what, what came back — and how long it took.',
  description:
    'One tool call on one line: the tool’s icon, its name in mono, a short summary and the status — a spinner with a live timer, a drawn check with the duration, Failed, or No result when the run ended first. Open it for the arguments and the result as highlighted JSON (plain text stays plain), each with a copy button; blocks taller than maxCodeHeight are capped with a fade and Show all. A failed call opens itself and offers Retry. <ui-tool-call-group> folds several calls into one quiet line — “Used 4 tools · 1 failed · 2.4s” — and keeps its cards alive across updates. The host owns the data: it can hand over args and result lazily (loading, detailError + Try again, note).',
  usedIn: 'soma-work dashboard — 작업 로그: each tool call and its result as one card',
  reference: { name: 'affectUI Tool Call Card', url: 'https://www.affectui.com/components/tool-call-card' },
  props: [
    { name: 'data.name', type: 'string', required: true, description: 'Tool name as the agent calls it, in mono.' },
    {
      name: 'data.status',
      type: "'running' | 'success' | 'error' | 'interrupted'",
      required: true,
      description:
        'interrupted = the run ended (stopped turn, crashed process) before this call returned: a neutral “No result”, no timer.',
    },
    {
      name: 'data.summary',
      type: 'string',
      description: 'One human line after the name. Truncates with an ellipsis; the full text is its tooltip.',
    },
    {
      name: 'data.icon',
      type: "'wrench' | 'search' | 'file' | 'edit' | 'terminal' | 'globe' | 'agent' | 'list' | 'plug'",
      default: 'toolIcon(name)',
      description:
        'Tile icon. Default from the name: Read/Write → file, Edit → edit, Bash → terminal, Grep/Glob/WebSearch → search, WebFetch → globe, Agent/Task → agent, TodoWrite → list, mcp__* → plug, else wrench.',
    },
    {
      name: 'data.args',
      type: 'unknown',
      description:
        'Object → pretty JSON; a string holding JSON is parsed; other text is shown as written. Up to 256 KiB.',
    },
    {
      name: 'data.result',
      type: 'unknown',
      description: 'Same rules as args. Without a result a running call reads “Waiting for result…”.',
    },
    {
      name: 'data.error',
      type: 'string',
      description: 'Shown in the error box when status is error. Default “The tool call failed.”',
    },
    {
      name: 'data.startedAt',
      type: 'number (epoch ms)',
      description: 'The live timer counts from here while running (else from when the card first saw it running).',
    },
    {
      name: 'data.duration',
      type: 'number (ms)',
      description:
        'Final duration: 350ms, 12.3s, 2m 05s. Without it a call the card watched run shows the measured time.',
    },
    {
      name: 'data.at',
      type: 'number (epoch ms)',
      description: 'Clock time the call started, shown muted at the body’s top right as HH:MM:SS (24h).',
    },
    {
      name: 'data.open',
      type: 'boolean',
      description: 'Set → controlled (the card only emits ui-toggle). Unset → the card keeps its own open state.',
    },
    {
      name: 'data.defaultOpen',
      type: 'boolean',
      default: 'false',
      description: 'Initial open state while uncontrolled (first render only).',
    },
    {
      name: 'data.openOnError',
      type: 'boolean',
      default: 'true',
      description:
        'Opens when the call turns to error; closes again on the next run unless someone toggled it by hand. A card that first appears failed stays closed.',
    },
    {
      name: 'data.canRetry',
      type: 'boolean',
      default: 'false',
      description: 'Shows Retry next to the error (ui-retry).',
    },
    {
      name: 'data.maxCodeHeight',
      type: 'number (px)',
      default: '220',
      description: 'Taller blocks are capped with a fade and Show all / Show less.',
    },
    {
      name: 'data.loading',
      type: 'boolean',
      default: 'false',
      description: 'The host is fetching args/result: a quiet “Loading…” line.',
    },
    {
      name: 'data.detailError',
      type: 'string',
      description: 'The host’s fetch failed: this message plus Try again (ui-reload).',
    },
    {
      name: 'data.note',
      type: 'string',
      description: 'One muted line at the end of the body, e.g. “Showing the first 256 KiB of 1.2 MB”.',
    },
    {
      name: 'data.focusable',
      type: 'boolean',
      default: 'true',
      description: 'false → the header button is tabindex=-1 (the host runs a roving focus and calls el.focus()).',
    },
    {
      name: 'head-tabindex',
      type: 'number',
      description:
        'Attribute. The header button’s tabindex — "-1" for a card in a list that owns the tab stop and the arrow keys (a <ui-work-log> sets it on the cards slotted into it). Wins over data.focusable. el.focus() focuses the header either way.',
    },
    {
      name: 'data.id',
      type: 'string',
      description: 'Host key, echoed as detail.id in every event; the group keys its cards by it.',
    },
    {
      name: 'group: data.calls',
      type: 'ToolCallData[]',
      required: true,
      description:
        '<ui-tool-call-group>: one card per call, keyed by id (else index). Interrupted calls count as neither running nor failed.',
    },
    {
      name: 'group: data.label / runningLabel',
      type: 'string',
      default: '“Used N tools” / “Using tools…”',
      description: 'The line’s text once done / while any call runs (with a light sweep).',
    },
    {
      name: 'group: data.duration',
      type: 'number (ms)',
      description: 'Total. Default: the sum of the calls’ durations, or the time measured while running.',
    },
    {
      name: 'group: data.open / defaultOpen / focusable',
      type: 'boolean',
      description: 'As on the card; focusable=false also applies to every card that does not set its own.',
    },
    {
      name: 'el.isOpen · el.focus()',
      type: 'boolean (read-only) · method',
      description:
        'Whether the body is open now; focus() moves focus to the header button (card and group), for a host that runs a roving focus.',
    },
    {
      name: 'group: el.cards',
      type: 'UiToolCallCard[] (read-only)',
      description:
        'The card elements in call order. They are kept across updates (keyed by id), so a host may hold on to them.',
    },
    {
      name: 'lang',
      type: "'en' | 'ko'",
      default: "'en'",
      description: 'UI language (attribute). The group passes it to its cards.',
    },
    {
      name: 'theme',
      type: "'light' | 'dark'",
      description: 'Pins the theme (attribute). The group passes it to its cards.',
    },
  ],
  events: [
    {
      name: 'ui-toggle',
      detail: '{ open: boolean; id?: string }',
      description:
        'Header pressed (card or group). Cancelable: preventDefault() keeps it as it is. With data.open set the host must answer by setting data.open.',
    },
    {
      name: 'ui-retry',
      detail: '{ id?: string }',
      description: 'Retry in the error box (canRetry). Set status back to running for the new attempt.',
    },
    {
      name: 'ui-reload',
      detail: '{ id?: string }',
      description: 'Try again after detailError. Fetch again and set loading / result.',
    },
    {
      name: 'ui-copy',
      detail: "{ part: 'args' | 'result'; text: string; id?: string }",
      description:
        'Copy pressed. Not cancelled → the card writes the clipboard (or selects the text when it cannot) and morphs the icon into a check for 1.4 s.',
    },
  ],
  keyboard: [
    ['Tab', 'Header button; inside an open card: Copy, Show all, Retry / Try again'],
    ['Enter / Space', 'Open or close (header), or press the focused button'],
  ],
  a11y: [
    'The header is a button with aria-expanded and aria-controls; the closed body is inert, so its buttons leave the tab order.',
    'Status is spoken as words (Running, Finished, Failed, No result), not just an icon or a colour.',
    'A polite live region outside the re-rendered markup announces status changes once (“Read finished”, “Bash failed: …”, “Task ended without a result”); a card that first appears finished stays quiet, so a long log does not chatter.',
    'Copy buttons are labelled “Copy arguments” / “Copy result” and say “Copied”; without clipboard access the text is selected and the region says how to copy.',
    'Touch: every control has a 44px target on coarse pointers. Reduced motion: no spinner turn, no sweep, no drawn check, no height animation.',
    'Sound (opt-in, @2lab.ai/ui/sound): a quiet open / close when the user opens or closes a card or a group, a soft success when a copy lands, a tap for Retry and Try again. Silent until the page turns sound on.',
  ],
  usage: `<ui-tool-call-card lang="ko"></ui-tool-call-card>
<script type="module">
  import '@2lab.ai/ui/tool-call-card';
  const card = document.querySelector('ui-tool-call-card');
  card.data = { id: 'toolu_01', name: 'Read', summary: 'src/app.ts (lines 1-80)', status: 'running',
    startedAt: Date.now(), at: Date.now(), args: '{"file_path":"src/app.ts","limit":80}' };

  // The result arrived (assign a new object — in-place mutation does not re-render)
  card.data = { ...card.data, status: 'success', duration: 412 };

  // Lazy detail: fetch the stored output the first time the card opens
  card.addEventListener('ui-toggle', (e) => { if (e.detail.open && card.data.result === undefined) load(); });
  card.addEventListener('ui-reload', load);
  async function load() {
    card.data = { ...card.data, loading: true, detailError: undefined };
    try {
      const r = await fetch('/api/worklog/raw?seq=42').then((res) => res.json());
      card.data = { ...card.data, loading: false, result: r.raw, note: r.truncated ? 'Showing the first 256 KiB' : undefined };
    } catch {
      card.data = { ...card.data, loading: false, detailError: '원본 출력을 불러오지 못했어요' };
    }
  }
</script>

<ui-tool-call-group></ui-tool-call-group>
<script type="module">
  document.querySelector('ui-tool-call-group').data = { calls: [readCall, grepCall, bashCall] };
</script>`,
  demos: [
    {
      id: 'running',
      title: 'Running',
      description: 'A live timer (tenths below a minute) next to the spinner; the open body waits for the result.',
      height: 320,
      frame: false,
      create: () => {
        const started = Date.now() - 2_300;
        return card({
          id: 'toolu_bash',
          name: 'Bash',
          summary: 'npx vitest run src/conversation/dashboard.test.ts',
          status: 'running',
          startedAt: started,
          at: started,
          args: BASH_ARGS,
          defaultOpen: true,
        });
      },
    },
    {
      id: 'done',
      title: 'Done',
      description: 'Arguments as highlighted JSON, the result as written, each with a copy button.',
      height: 520,
      frame: false,
      create: () =>
        card({
          id: 'toolu_read',
          name: 'Read',
          summary: 'src/conversation/dashboard.ts (lines 14468-14475)',
          status: 'success',
          duration: 38,
          at: Date.now() - 64_000,
          args: READ_ARGS,
          result: READ_RESULT,
          defaultOpen: true,
        }),
    },
    {
      id: 'failed',
      title: 'Failed + Retry',
      description:
        'Runs for 1.2 s, fails and opens itself. Retry runs it again (the card closes for the new run) and it succeeds.',
      height: 420,
      frame: false,
      create: failingFetch,
    },
    {
      id: 'long',
      title: 'Long result',
      description: 'Blocks taller than maxCodeHeight (220px) fade out; Show all opens to the full height.',
      height: 560,
      frame: false,
      create: () =>
        card({
          id: 'toolu_issue',
          name: 'mcp__github__get_issue',
          summary: '2lab-ai/soma-work#812',
          status: 'success',
          duration: 640,
          at: Date.now() - 120_000,
          args: { owner: '2lab-ai', repo: 'soma-work', issue_number: 812 },
          result: ISSUE,
          defaultOpen: true,
        }),
    },
    {
      id: 'group',
      title: 'Group',
      description:
        'Four calls on one line — one failed. Open, every call is its own card. Shown on a panel surface, as in the dashboard.',
      height: 520,
      frame: true,
      create: () => {
        const now = Date.now();
        return group({
          defaultOpen: true,
          calls: [
            {
              id: 'g1',
              name: 'Grep',
              summary: 'renderWorkLogDetail in src/conversation',
              status: 'success',
              duration: 182,
              at: now - 9_000,
              args: GREP_ARGS,
              result: GREP_RESULT,
            },
            {
              id: 'g2',
              name: 'Read',
              summary: 'src/conversation/dashboard.ts (lines 14468-14475)',
              status: 'success',
              duration: 38,
              at: now - 8_600,
              args: READ_ARGS,
              result: READ_RESULT,
            },
            {
              id: 'g3',
              name: 'Bash',
              summary: 'npx vitest run src/conversation/dashboard.test.ts',
              status: 'error',
              duration: 2_710,
              at: now - 8_400,
              args: BASH_ARGS,
              error: BASH_FAIL,
            },
            {
              id: 'g4',
              name: 'WebFetch',
              summary: 'docs.anthropic.com/en/docs/claude-code/hooks',
              status: 'success',
              duration: 1_240,
              at: now - 5_600,
              args: FETCH_ARGS,
              result: FETCH_RESULT,
            },
          ],
        });
      },
    },
    {
      id: 'lazy',
      title: 'Loading',
      description:
        'The host fetches the stored output on open: Loading…, and a failed fetch with Try again (it loads, with a note).',
      height: 460,
      frame: false,
      create: () => lazyCards(),
    },
    {
      id: 'interrupted',
      title: 'No result',
      description: 'The run stopped before the call returned — neutral, not a failure, and no timer.',
      height: 300,
      frame: false,
      create: () =>
        card({
          id: 'toolu_task',
          name: 'Task',
          summary: 'Explore: find every caller of renderWorkLogEntry',
          status: 'interrupted',
          at: Date.now() - 300_000,
          args: {
            subagent_type: 'Explore',
            description: 'Find callers',
            prompt: 'Find every caller of renderWorkLogEntry in src/conversation and list file:line.',
          },
          defaultOpen: true,
        }),
    },
    {
      id: 'ko',
      title: '한국어 (lang="ko")',
      height: 480,
      frame: true,
      create: () => {
        const now = Date.now();
        return group(
          {
            defaultOpen: true,
            calls: [
              {
                id: 'k1',
                name: 'Read',
                summary: 'src/conversation/dashboard.ts (14468-14475행)',
                status: 'success',
                duration: 38,
                at: now - 6_000,
                args: READ_ARGS,
                result: READ_RESULT,
              },
              {
                id: 'k2',
                name: 'Grep',
                summary: 'src/conversation에서 renderWorkLogDetail 찾기',
                status: 'success',
                duration: 210,
                at: now - 5_200,
                args: GREP_ARGS,
                result: GREP_RESULT,
              },
              {
                id: 'k3',
                name: 'Bash',
                summary: '대시보드 테스트 실행',
                status: 'running',
                startedAt: now - 4_100,
                at: now - 4_100,
                args: BASH_ARGS,
                defaultOpen: true,
              },
            ],
          },
          { lang: 'ko' },
        );
      },
    },
  ],
};
