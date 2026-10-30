import type { ComponentDoc } from '../../docs/types';
import './conversation';
import type { UiConversation } from './conversation';
import type { ConversationData, ConversationTurn } from './logic';

const MIN = 60_000;
const BASE = new Date(2026, 9, 30, 9, 12, 0).getTime();

const RELEASE_SKILL = `# Release notes
- One line per change, present tense, no ticket numbers in the text.
- Group by area (Editor, Sync, Accounts); breaking changes first.
- Link the pull request at the end of the line.`;

const NOTES = `## 2.4 release notes

**Editor**
- Paste an image straight into a comment; it uploads in the background. ([#1412](https://github.com/acme/notes/pull/1412))
- \`Cmd+K\` opens the link dialog on the selected text.

**Sync**
- Offline edits merge line by line instead of the whole note.
- A conflict now shows both versions side by side.

**Accounts**
- Sign-in links expire after 15 minutes.

Two pull requests had no user-facing change and are left out: https://github.com/acme/notes/pull/1407`;

const CHANGELOG_TIP = `Here is what changed in the sync engine between 2.3 and 2.4:

1. **Merging** — the server now diffs notes by line, so two people editing different paragraphs no longer conflict.
2. **Conflicts** — when the same line changed on both sides, the note keeps both versions and marks the block.
3. **Retries** — failed uploads back off from 2 s up to 1 min.

Nothing changes for notes that were never edited offline.`;

/** A first page: an instruction with a skill, the answer, a compaction, a long instruction with media, an answer with files. */
function firstPage(): ConversationTurn[] {
  return [
    {
      id: 'u-21',
      role: 'user',
      name: 'Mina Park',
      at: BASE,
      text: 'Draft the release notes for 2.4 from the merged pull requests. One line per change, grouped by area.',
      skills: [{ name: 'release-notes', text: RELEASE_SKILL }],
    },
    {
      id: 'a-21',
      role: 'assistant',
      at: BASE + 48_000,
      responseMs: 48_000,
      markdown: NOTES,
      summary: { title: 'Drafted the 2.4 notes', text: '5 changes in 3 areas, from 7 merged pull requests.' },
      attachments: true,
    },
    {
      id: 's-21',
      role: 'system',
      at: BASE + 6 * MIN,
      kind: 'compact',
      text: '182K → 41K tokens · 1m 52s',
      facts: [
        ['Before', '182,400 tokens'],
        ['After', '41,050 tokens (−77%)'],
        ['Took', '1m 52s'],
        ['Kept', 'The release checklist and the draft'],
      ],
      raw: '/compact keep the release checklist and the current draft',
    },
    {
      id: 'u-22',
      role: 'user',
      name: 'Mina Park',
      at: BASE + 9 * MIN,
      media: true,
      text: [
        'Looks good. A few changes before we publish:',
        '',
        '1. Move the sync changes to the top — that is what people asked about most.',
        '2. The conflict line should say what the person sees, not what the server does.',
        '3. Add a short "Before you update" note: the desktop app needs 2.4 too, or offline edits stay on the old merge.',
        '4. Keep the link to #1412, drop the other two.',
        '5. The screenshot shows the new conflict view — describe it in one line under Sync.',
        '6. Use the same tone as the 2.3 notes: plain, no exclamation marks.',
        '7. When it is done, write a short summary of the sync changes for the support team.',
        '',
        'Thanks!',
      ].join('\n'),
    },
    {
      id: 'a-22',
      role: 'assistant',
      at: BASE + 10 * MIN,
      responseMs: 71_000,
      markdown: CHANGELOG_TIP,
      summary: { title: 'Summarised the sync changes', text: 'Merging, conflicts and retries, for the support team.' },
    },
  ];
}

/** Older pages for the paging demo, oldest first. */
function olderPage(page: number): ConversationTurn[] {
  const at = BASE - (page + 1) * 40 * MIN;
  return [
    {
      id: `u-${10 - page * 2}`,
      role: 'user',
      name: 'Mina Park',
      at,
      text:
        page === 0 ? 'Which pull requests were merged since the 2.3 tag?' : 'Start a new branch for the 2.4 release.',
    },
    {
      id: `a-${10 - page * 2}`,
      role: 'assistant',
      at: at + 21_000,
      responseMs: 21_000,
      markdown:
        page === 0
          ? 'Seven pull requests were merged since `v2.3.0`: #1401, #1403, #1405, #1407, #1409, #1410 and #1412.'
          : 'Created `release/2.4` from `main` at `4f2c9e1`.',
    },
  ];
}

function make(data: ConversationData, height = 460, lang?: string): UiConversation {
  const el = document.createElement('ui-conversation');
  if (lang) el.setAttribute('lang', lang);
  el.style.cssText = `height:${height}px;width:100%`;
  el.data = data;
  return el;
}

/** Light-DOM media and file chips the host puts in the turn slots. */
function slotted(el: UiConversation): void {
  const shot = document.createElement('div');
  shot.slot = 'media-u-22';
  shot.style.cssText =
    'display:grid;place-items:center;width:min(260px,100%);aspect-ratio:16/9;border:1px solid var(--ui-ib-card-border);border-radius:8px;background:color-mix(in srgb,var(--ui-ib-pill) 70%,var(--ui-ib-card));color:var(--ui-ib-muted);font-size:12px';
  shot.textContent = 'conflict-view.png · 1280 × 720';
  const files = document.createElement('div');
  files.slot = 'attachments-a-21';
  files.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
  for (const name of ['release-notes-2.4.md', 'changes.csv']) {
    const chip = document.createElement('span');
    chip.textContent = name;
    chip.style.cssText =
      'display:inline-flex;align-items:center;height:28px;padding:0 10px;border:1px solid var(--ui-ib-card-border);border-radius:8px;background:var(--ui-ib-card);color:var(--ui-ib-text);font-size:12px';
    files.append(chip);
  }
  el.append(shot, files);
}

/** A live session: older pages on ui-load-older, then a new instruction, the writing row and a streamed answer. */
function liveDemo(): UiConversation {
  let turns = firstPage();
  let pages = 2;
  let hasMore = true;
  const el = make({ turns, hasMore, clampLines: 6 });
  slotted(el);
  const set = (extra: Partial<ConversationData> = {}) => {
    el.data = { turns, hasMore, clampLines: 6, ...extra };
  };
  el.addEventListener('ui-load-older', () => {
    setTimeout(() => {
      if (!el.isConnected) return;
      pages--;
      hasMore = pages > 0;
      turns = [...olderPage(1 - pages), ...turns];
      set();
    }, 700);
  });
  const words =
    'Before you update: install 2.4 on every device you use. Until the desktop app is on 2.4 too, offline edits made there still merge the whole note at once.'.split(
      ' ',
    );
  const askAt = BASE + 14 * MIN;
  setTimeout(() => {
    if (!el.isConnected) return;
    turns = [
      ...turns,
      { id: 'u-23', role: 'user', name: 'Mina Park', at: askAt, text: 'Write the "Before you update" note.' },
    ];
    set({ pending: true });
    setTimeout(() => {
      let n = 0;
      const tick = () => {
        if (!el.isConnected) return;
        n = Math.min(words.length, n + 3);
        const done = n >= words.length;
        const answer: ConversationTurn = {
          id: 'a-23',
          role: 'assistant',
          at: askAt + 9000,
          markdown: words.slice(0, n).join(' '),
          streaming: !done,
          responseMs: done ? 9000 : undefined,
          summary: done
            ? { title: 'Wrote the update note', text: 'One paragraph for the top of the notes.' }
            : undefined,
        };
        turns = [...turns.filter((t) => t.id !== 'a-23'), answer];
        set();
        if (!done) setTimeout(tick, 220);
      };
      tick();
    }, 1600);
  }, 2200);
  return el;
}

/** System turns: a compaction running, a restart past its estimate, and the kinds once done. */
function systemDemo(): UiConversation {
  const now = Date.now();
  const at = (ago: number) => now - ago;
  return make(
    {
      turns: [
        {
          id: 's-1',
          role: 'system',
          at: at(40 * MIN),
          kind: 'goal',
          text: 'Ship the 2.4 release notes',
          facts: [
            ['Set by', 'Mina Park'],
            ['Check', 'Every 30 minutes'],
          ],
        },
        {
          id: 's-2',
          role: 'system',
          at: at(31 * MIN),
          kind: 'cron',
          text: 'Nightly changelog check',
          facts: [['Schedule', 'Every day at 02:00']],
          raw: 'Check for merged pull requests without a changelog line.',
        },
        {
          id: 's-3',
          role: 'system',
          at: at(22 * MIN),
          kind: 'retry',
          text: 'Upload failed (HTTP 503) — retried after 4 s',
          facts: [
            ['Attempt', '2 of 5'],
            ['Waited', '4 s'],
          ],
        },
        { id: 's-4', role: 'system', at: at(12 * MIN), kind: 'background', text: 'Indexing 1,284 files' },
        {
          id: 's-5',
          role: 'system',
          at: at(200_000),
          kind: 'restart',
          text: 'Restarting the session',
          progress: { startedAt: at(200_000), estimateMs: 90_000, verb: 'Restarting…' },
        },
        {
          id: 's-6',
          role: 'system',
          at: at(40_000),
          kind: 'compact',
          progress: { startedAt: at(40_000), estimateMs: 150_000 },
          facts: [
            ['Estimate', '2m 30s (from the last compaction)'],
            ['Context', '182,400 tokens'],
          ],
        },
      ],
      startText: '',
    },
    440,
  );
}

/** First load, empty, a failed load, and a failed answer with Try again. */
function statesDemo(): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;width:100%';
  const frame = (el: UiConversation) => {
    el.style.border = '1px solid var(--ui-ib-card-border)';
    el.style.borderRadius = '12px';
    el.style.padding = '8px';
    return el;
  };
  const loading = frame(make({ turns: [], loading: true }, 260));
  const empty = frame(make({ turns: [], emptyText: 'Ask the assistant anything to start.' }, 260));
  const failed = frame(make({ turns: [], error: 'HTTP 502' }, 260));
  failed.addEventListener('ui-retry', () => {
    failed.data = { turns: [], loading: true };
    setTimeout(() => {
      if (failed.isConnected) failed.data = { turns: firstPage().slice(0, 2) };
    }, 900);
  });
  const ask: ConversationTurn = {
    id: 'u-1',
    role: 'user',
    name: 'Mina Park',
    at: BASE,
    text: 'Summarise yesterday’s incident.',
  };
  let answer: ConversationTurn = {
    id: 'a-1',
    role: 'assistant',
    at: BASE + 30_000,
    error: 'HTTP 404',
    canRetry: true,
    summary: { title: 'Incident summary' },
  };
  const partial = frame(make({ turns: [ask, answer], error: 'HTTP 500' }, 260));
  partial.addEventListener('ui-retry', (e) => {
    const id = (e as CustomEvent<{ id: string | null }>).detail.id;
    if (id === 'a-1') {
      answer = { ...answer, error: undefined, canRetry: undefined, loading: true };
      partial.data = { turns: [ask, answer] };
      setTimeout(() => {
        if (!partial.isConnected) return;
        answer = {
          ...answer,
          loading: undefined,
          responseMs: 30_000,
          markdown:
            'The search service was down for **14 minutes** after a certificate expired. It was renewed by hand; renewal is now automatic.',
        };
        partial.data = { turns: [ask, answer] };
      }, 900);
    } else partial.data = { turns: [ask, answer] };
  });
  box.append(loading, empty, failed, partial);
  return box;
}

function koreanDemo(): UiConversation {
  const t0 = BASE;
  return make(
    {
      assistantName: '도우미',
      turns: [
        {
          id: 'u-1',
          role: 'user',
          name: '박민아',
          at: t0,
          text: '2.4 릴리스 노트 초안을 써 줘. 변경 하나에 한 줄, 영역별로 묶어서.',
          skills: [{ name: 'release-notes', text: '# 릴리스 노트\n- 변경 하나에 한 줄\n- 영역별로 묶기' }],
        },
        {
          id: 'a-1',
          role: 'assistant',
          at: t0 + 52_000,
          responseMs: 52_000,
          markdown:
            '## 2.4 릴리스 노트\n\n**편집기**\n- 댓글에 이미지를 바로 붙여 넣을 수 있습니다.\n\n**동기화**\n- 오프라인 수정이 줄 단위로 합쳐집니다.',
          summary: { title: '2.4 노트 초안 작성', text: '3개 영역, 변경 5건' },
        },
        {
          id: 's-1',
          role: 'system',
          at: t0 + 5 * MIN,
          kind: 'compact',
          text: '182K → 41K 토큰 · 1분 52초',
          facts: [
            ['압축 전', '182,400 토큰'],
            ['압축 후', '41,050 토큰 (−77%)'],
          ],
          raw: '/compact 릴리스 체크리스트는 남겨 줘',
        },
        { id: 'u-2', role: 'user', name: '박민아', at: t0 + 8 * MIN, text: '동기화 항목을 맨 위로 올려 줘.' },
      ],
      pending: true,
    },
    420,
    'ko',
  );
}

export const doc: ComponentDoc = {
  slug: 'conversation',
  name: 'Conversation',
  tag: 'ui-conversation',
  group: 'Components',
  summary:
    'What was asked, and what came back? — the whole conversation, newest at the bottom, without losing your place.',
  description:
    'A conversation with an agent: the person’s instructions, the assistant’s answers and the turns the system put there (a compaction, a restart, a scheduled run), in a <ui-log-scroller> that follows new turns while you are at the bottom and never moves what you are reading. Turns are keyed by id: when the data changes only the turn that changed is rebuilt — a streaming answer does not repaint the rest — older turns are prepended without a jump, and new ones fade in at the bottom. A long instruction folds to a few lines with Show more; an answer is rendered by a nested <ui-ai-answer> with its source one click away under Raw; a system turn is one quiet line that opens to its facts, and a long operation shows a bar, the elapsed time against its estimate and a sweep once it runs over.',
  usedIn:
    'Agent dashboard › session panel › Conversation (instructions and answers, system turns, compaction progress).',
  reference: { name: 'WAI-ARIA log role', url: 'https://www.w3.org/TR/wai-aria-1.2/#log' },
  props: [
    {
      name: 'data.turns',
      type: 'ConversationTurn[]',
      required: true,
      description:
        'The turns, oldest first. `id` (stable) and `role` ("user" | "assistant" | "system" | "pending") are required. Unchanged ids keep their nodes; new ids before the first shown are history, after the last are live.',
    },
    {
      name: 'data.turns[].name · at',
      type: 'string · number | string',
      description:
        'Who (defaults: "User", data.assistantName, "System") and when (epoch ms or ISO): HH:MM, the full date as a tooltip.',
    },
    {
      name: 'data.turns[].text · media · skills',
      type: 'string · boolean · { name, text?, tokens? }[]',
      description:
        'user: the instruction as typed (plain text, folded to data.clampLines with Show more when it overflows); media in slot "media-<id>" above the words; skill chips that open their text.',
    },
    {
      name: 'data.turns[].markdown · source · summary',
      type: 'string · string · { title?, text? }',
      description:
        'assistant: the answer (markdown, rendered safely by <ui-ai-answer>); Raw shows the summary and the source as written (source defaults to markdown). The summary heads an answer that is empty or failed.',
    },
    {
      name: 'data.turns[].responseMs · streaming · loading · error · canRetry',
      type: 'number · boolean · boolean · string · boolean',
      description:
        'assistant: the response-time chip; more text coming (no Raw yet); the recorded answer is being fetched; it could not be had, with Try again (ui-retry with the turn id).',
    },
    {
      name: 'data.turns[].attachments · linkTitles',
      type: 'boolean · Record<string, string>',
      description:
        'assistant: files in slot "attachments-<id>" under the answer; titles the host knows for URLs in it.',
    },
    {
      name: 'data.turns[].kind · label · facts · raw',
      type: 'string · string · [label, value][] · string',
      description:
        'system: compact · restart · retry · goal · cron · background (or any word, shown as is) as an icon + word badge, or `label` instead; the row opens to the facts and the raw text (Copy).',
    },
    {
      name: 'data.turns[].progress',
      type: '{ startedAt, estimateMs?, verb?, done? }',
      description:
        'system: a long operation. A bar, the elapsed time ticking in place against the estimate, the percent; past the estimate the bar sweeps and says it is taking longer. done: the line shows `text` (or "Done").',
    },
    {
      name: 'data.pending',
      type: 'boolean',
      default: 'false',
      description:
        'The answer is being written: a writing row under the assistant’s avatar, always last. (A { role: "pending" } turn does the same with its own id.)',
    },
    {
      name: 'data.hasMore · loading',
      type: 'boolean',
      default: 'false',
      description:
        'Older turns exist (scrolling near the top sends ui-load-older). loading: skeleton turns with no turns yet, else the "Loading older…" row.',
    },
    {
      name: 'data.error · canRetry',
      type: 'string · boolean',
      default: 'canRetry: true',
      description:
        'Loading failed: “Couldn’t load the conversation (…)” fills the box without turns; “Couldn’t load some turns (…)” is a bar above them. Pass a short reason ("HTTP 502"). Try again sends ui-retry with id null.',
    },
    {
      name: 'data.assistantName',
      type: 'string',
      default: '"Assistant"',
      description: 'Name over the assistant’s turns.',
    },
    {
      name: 'data.clampLines',
      type: 'number',
      default: '12',
      description: 'Lines a long instruction shows before Show more (1–200).',
    },
    {
      name: 'data.now',
      type: 'number',
      default: 'Date.now()',
      description: 'The host’s clock (epoch ms) for progress rows; it keeps ticking from there.',
    },
    { name: 'data.label', type: 'string', default: '"Conversation"', description: 'Accessible name of the list.' },
    { name: 'data.emptyText', type: 'string', default: '"No messages yet"', description: 'Empty-state text.' },
    {
      name: 'data.startText',
      type: 'string',
      default: '"Start of conversation"',
      description: 'Marker at the top once there is nothing older. Empty string hides it.',
    },
    {
      name: 'lang',
      type: '"en" | "ko"',
      default: '"en"',
      description: 'Attribute. Strings in English or Korean (passed to the scroller and answers).',
    },
    {
      name: 'turnElement(id) · scrollToLatest({ smooth? })',
      type: 'method',
      description: 'The node of a turn (to measure or scroll to it); jump to the newest turn.',
    },
    {
      name: 'slot="media-<id>" · slot="attachments-<id>"',
      type: 'slot',
      description:
        'Host content for a turn: media above a user turn’s words (turn.media), files under an answer (turn.attachments).',
    },
    { name: '::part(log) · ::part(error)', type: 'part', description: 'The scroller and the error bar.' },
  ],
  events: [
    {
      name: 'ui-load-older',
      detail: '{ oldest: string | null }',
      description:
        'The reader scrolled near the top (or pressed Load older): fetch the turns before `oldest` and set them in front. Cancelable. The row shows Loading older… until older turns arrive or hasMore / loading / error change.',
    },
    {
      name: 'ui-retry',
      detail: '{ id: string | null }',
      description: 'Try again: a turn’s answer (its id) or the conversation itself (null). Cancelable.',
    },
    {
      name: 'ui-copy',
      detail: "{ id: string, text: string, from: 'answer' | 'summary' | 'source' | 'raw' }",
      description:
        'Notification: text was copied — an answer’s Copy, Raw’s summary or source, a system turn’s raw text.',
    },
    {
      name: 'ui-link',
      detail: "{ url: string, index: number, from: 'chip' | 'card' }",
      description:
        'From a nested answer, unchanged: a link in it was opened. Cancelable (preventDefault keeps the page).',
    },
  ],
  keyboard: [
    ['Tab', 'The list takes focus (arrows, Page Up/Down, Home, End scroll it); then each turn’s controls in order.'],
    ['Enter / Space on Show more', 'Show the whole instruction; again to fold it.'],
    ['Enter / Space on Raw or a system row', 'Open or close it.'],
    ['Escape inside an open Raw or system row', 'Close it; focus returns to its toggle.'],
    ['Enter / Space on the latest pill', 'Jump to the newest turn.'],
  ],
  a11y: [
    'The list is role="log" with an accessible name: new turns are announced politely; a turn that is still being written is aria-busy, so it is read once it is done.',
    'Each turn is an <article> named by its author and time; times are <time datetime> with the full date as the tooltip.',
    'Show more, Raw and system rows are buttons with aria-expanded / aria-controls; a closed region is inert, so nothing hidden takes focus.',
    'The progress row is role="progressbar" with aria-valuenow and a spoken aria-valuetext (“1:12 / ~2:30, 48%”); the bar itself is decoration.',
    'Status is never colour alone: errors carry an icon and words, system kinds an icon and a word. Focus survives a turn’s rebuild.',
    'Reduced motion: no press scale, no slide; regions fade only; the over-run sweep becomes a still bar.',
  ],
  usage: `<ui-conversation style="height: 560px"></ui-conversation>
<script type="module">
  import '@2lab.ai/ui/conversation';
  const chat = document.querySelector('ui-conversation');
  let turns = await loadTurns();             // [{ id, role: 'user' | 'assistant' | 'system', … }]
  chat.data = { turns, hasMore: true, assistantName: 'Helper' };

  chat.addEventListener('ui-load-older', async (e) => {
    const page = await loadTurns({ before: e.detail.oldest });
    turns = [...page.turns, ...turns];
    chat.data = { turns, hasMore: page.hasMore };
  });
  chat.addEventListener('ui-retry', (e) => (e.detail.id ? refetchAnswer(e.detail.id) : reload()));
  socket.onmessage = (m) => {                // live: only the turn that changed is rebuilt
    turns = upsertById(turns, m.turn);
    chat.data = { turns, pending: m.working };
  };
</script>`,
  demos: [
    {
      id: 'live',
      title: 'A live conversation',
      description:
        'Instructions with a skill and media, answers with files and Raw, a compaction. A new instruction lands, the writing row shows, and the answer streams in — only that turn is rebuilt. Scroll to the top: two older pages load above without moving what you see.',
      height: 500,
      create: liveDemo,
    },
    {
      id: 'system',
      title: 'System turns and long operations',
      description:
        'One quiet line each — goal, scheduled, retried, background — that opens to its facts. A compaction runs against its estimate; a restart has run past its estimate and sweeps.',
      height: 480,
      create: systemDemo,
    },
    {
      id: 'states',
      title: 'Loading, empty and errors',
      description:
        'Skeleton turns for the first page; the empty text; a failed load as the whole box (Try again loads it); a bar above the turns, and an answer that failed with its own Try again.',
      height: 600,
      create: statesDemo,
    },
    {
      id: 'ko',
      title: 'Korean',
      description: 'lang="ko": 사용자 · 압축 · 원본 · 더 보기 · 응답 작성 중.',
      height: 460,
      create: koreanDemo,
    },
  ],
};
