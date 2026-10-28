import type { ComponentDoc } from '../../docs/types';
import './ai-answer';
import type { AiAnswerData, UiAiAnswer } from './ai-answer';

function make(data: AiAnswerData, attrs: Record<string, string> = {}): UiAiAnswer {
  const el = document.createElement('ui-ai-answer');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

const PR = 'https://github.com/2lab-ai/soma-work/pull/999';
const TITLES = { [PR]: 'feat(dashboard): model picker' };

const ANSWER = `The model picker now shows **three bars** per model — speed, quality and cost — and the tray under it shows first-token time and price. PR: ${PR}

### What changed
- [\`model-picker.ts\`](https://github.com/2lab-ai/soma-work/blob/main/src/dashboard/model-picker.ts) draws the bars from \`MODEL_STATS\`.
- The effort control moved under *thinking*; the old toggle is ~~kept~~ gone.
- Also fixes the overflow from https://github.com/2lab-ai/soma-work/issues/457 (commit https://github.com/2lab-ai/soma-work/commit/3f9c2e1b7a04).

| Bar | Measured as | Scale |
| --- | --- | --- |
| Speed | p50 output tokens/s | 0–200 |
| Cost | $ per 1M output tokens | log |

> Checked on the 390px sheet:
> \`\`\`sh
> npx vitest run src/dashboard   # https://example.com stays code
> \`\`\`

Why first-token time and not total time: https://en.wikipedia.org/wiki/Latency_(engineering). The [1] and [2] the model wrote are plain text — nothing defines them.`;

const PARTIAL = `Docs PR https://github.com/2lab-ai/soma-work/pull/463 is still waiting on the CI runner: \`quality-gates\` passed, while \`scan\` and \`lean-verify\` are`;

const STREAM = [
  'Docs PR https://github.com/2lab-ai/soma-work/pull/463 is green. ',
  'All three checks passed — `quality-gates`, `scan` and `lean-verify`.\n\n',
  '- Merged as squash commit https://github.com/2lab-ai/soma-work/commit/b81e0c4d9f2a.\n',
  '- Deploy to **dev** starts on the next push to `deploy/dev`.\n',
  '- Follow-up review notes are bundled in https://github.com/2lab-ai/soma-work/issues/464.\n\n',
  'Nothing else is waiting on you.',
];

const PLAIN = `The run stopped because the **sandbox denied** a write outside the workspace:

\`\`\`text
EACCES: permission denied, open '/etc/hosts'
\`\`\`

1. The agent tried to pin \`api.local\` for the integration test.
2. Writes outside \`/tmp/<user>/\` are blocked by design.
3. Retrying with \`--resolve api.local:443:127.0.0.1\` avoids the write.

No files were changed.`;

const KO = `모델 피커에 모델마다 **막대 세 개**(속도·품질·비용)가 생겼고, 트레이에는 첫 토큰 시간과 가격이 보입니다. PR: ${PR}

- [\`model-picker.ts\`](https://github.com/2lab-ai/soma-work/blob/main/src/dashboard/model-picker.ts)가 \`MODEL_STATS\`에서 막대를 그립니다.
- 노력 조절을 *thinking* 아래로 옮겼습니다.
- 이슈 https://github.com/2lab-ai/soma-work/issues/457 의 넘침도 함께 고쳤습니다.

> 390px 시트에서 확인했습니다. 원문의 [1]·[2]는 정의가 없어 글자로 남습니다.`;

/** Streams the chunks in, then settles with a response time. Stops when the demo is removed. */
function streaming(): UiAiAnswer {
  const el = make({ markdown: '', streaming: true });
  let i = 0;
  let text = '';
  const tick = () => {
    if (i > 0 && !el.isConnected) return;
    if (i < STREAM.length) {
      text += STREAM[i++];
      el.data = { markdown: text, streaming: true };
      setTimeout(tick, 650);
    } else el.data = { markdown: text, responseMs: 41_800 };
  };
  setTimeout(tick, 700);
  return el;
}

/** “Try again” loads, then shows the answer. */
function failed(): UiAiAnswer {
  const el = make({ markdown: '', error: 'HTTP 404', canRetry: true });
  el.addEventListener('ui-retry', () => {
    el.data = { markdown: '', loading: true };
    setTimeout(() => {
      if (el.isConnected) el.data = { markdown: PLAIN, responseMs: 8_400 };
    }, 900);
  });
  return el;
}

export const doc: ComponentDoc = {
  slug: 'ai-answer',
  name: 'AI Answer',
  tag: 'ui-ai-answer',
  group: 'Components',
  summary: 'An assistant reply you can read, follow and take away: the answer, the links it contains, Copy.',
  description:
    'The answer’s markdown rendered safely (headings, lists, emphasis, code, tables, quotes). Every http(s) link the answer contains becomes a numbered link card in a sideways row above the body and a chip where it stood in the text — hover or focus one and its pair lights. They are links the answer contains, not proven sources, so the card says “links”, never “sources” or “citations”; a “[1]” the model writes without a URL stays text. The footer copies the answer with its numbered links and shows the response time; while the answer is written a “Writing the answer” row pulses instead.',
  usedIn: 'soma-work dashboard › session panel › 대화 › assistant turn › 답변 전문',
  reference: { name: 'affectUI AI Answer', url: 'https://www.affectui.com/components/ai-answer' },
  props: [
    {
      name: 'data.markdown',
      type: 'string',
      required: true,
      description:
        'The answer as written. Raw HTML never survives; only http(s) links are links. Bare URLs, `<url>` and `<url|label>` are linked; URLs inside code spans and fences are not.',
    },
    {
      name: 'data.responseMs',
      type: 'number',
      description: 'Instruction → answer time in ms (“Responded in 4m 12s”). Omitted or ≤ 0: no time is shown.',
    },
    {
      name: 'data.streaming',
      type: 'boolean',
      default: 'false',
      description:
        "More text is coming: renders the text so far, replaces the footer with the writing row, sets aria-busy. With no text yet (`markdown: ''`) only the writing row is drawn — no label, no body, no footer rule.",
    },
    {
      name: 'data.loading',
      type: 'boolean',
      default: 'false',
      description: 'Fetching a recorded answer (shown only while there is no text).',
    },
    { name: 'data.title', type: 'string', description: 'Optional heading above the card (the question, a summary).' },
    {
      name: 'data.error',
      type: 'string',
      description:
        'Failure detail, e.g. `HTTP 404`. Without text it is the whole card; with text it takes the response time’s place.',
    },
    {
      name: 'data.canRetry',
      type: 'boolean',
      default: 'false',
      description: 'Show “Try again” next to an error. Only set it when you handle `ui-retry`.',
    },
    {
      name: 'data.linkTitles',
      type: 'Record<string, string>',
      description:
        'Titles you already know for some URLs (e.g. the PR this session opened). Beat the link’s label and the title read off the URL. Trailing slashes are ignored.',
    },
    {
      name: 'data.animate',
      type: 'boolean',
      default: 'true',
      description:
        'Play the entry fade and card pop when this text first shows. Set false when a fresh element repaints an answer the person already saw (e.g. from your cache after the turn re-rendered).',
    },
    {
      name: 'links',
      type: 'AnswerLink[] (read-only)',
      description: '`{ n, href, name, title, chip }` for each link of the last render, in card order.',
    },
    { name: 'lang', type: "'en' | 'ko'", default: "'en'", description: 'UI language (attribute).' },
    {
      name: 'flat',
      type: 'boolean attribute',
      default: 'absent',
      description:
        'For a host surface that is already the card (a conversation turn): no border, radius, background or shadow, no side padding; the link row starts at the text’s edge and fades only where it continues.',
    },
    {
      name: 'theme',
      type: "'light' | 'dark'",
      description: 'Pins the theme (attribute). Default follows prefers-color-scheme or page tokens.',
    },
  ],
  events: [
    {
      name: 'ui-copy',
      detail: '{ text: string }',
      description:
        'Copy pressed. `text` = the markdown as written + “Links:” and `[n] title – url` lines. Unless you call preventDefault(), the component writes it with navigator.clipboard (hidden-textarea fallback, else it selects the answer) and shows “Copied”.',
    },
    {
      name: 'ui-link',
      detail: "{ url: string; index: number; from: 'card' | 'chip' }",
      description:
        'A link card or chip was activated. `index` is 0-based into `links` (the card shows index + 1). Default: the link opens in a new tab; preventDefault() keeps the page.',
    },
    { name: 'ui-retry', detail: '{}', description: '“Try again” pressed (only rendered with `canRetry`).' },
  ],
  keyboard: [
    ['Tab', 'Link cards → chips in the text → Copy (→ Try again)'],
    ['Enter', 'Open the focused link (ui-link) · press Copy'],
    ['Space', 'Press Copy / Try again'],
    ['Focus', 'A focused chip or card lights its pair; the row slides sideways to show the card'],
  ],
  a11y: [
    'The card is a section named by its label (“Answer · 3 links”); the link row is an ordered list named “3 links in this answer”.',
    'Each chip is a link named “Link n: title (site)”; a card’s name is its visible site, number and title, its tooltip the URL.',
    'Copy results are read by a polite status region (“Copied the answer and 3 links”); the button label changes in place.',
    'While streaming or loading the card is aria-busy; the pulsing dot is aria-hidden.',
    'Reduced motion: no entry fade or pop, the sweep and pulse stop (the writing text turns static), the row jumps instead of gliding.',
    'Coarse pointers: buttons are 44px, chips are never truncated and get a 10px-taller hit area.',
  ],
  usage: `<ui-ai-answer lang="en"></ui-ai-answer>
<script type="module">
  import '@2lab.ai/ui/ai-answer';
  const el = document.querySelector('ui-ai-answer');
  el.data = { markdown: '', streaming: true };
  for await (const chunk of stream) el.data = { markdown: (text += chunk), streaming: true };
  el.data = { markdown: text, responseMs: Date.now() - askedAt,
              linkTitles: { 'https://github.com/o/r/pull/9': 'feat: model picker' } };
  el.addEventListener('ui-copy', (e) => console.log('copied', e.detail.text.length));
  el.addEventListener('ui-link', (e) => {
    if (e.detail.url.startsWith(location.origin)) { e.preventDefault(); router.go(e.detail.url); }
  });
</script>`,
  demos: [
    {
      id: 'default',
      title: 'Answer with links',
      description:
        'Five links found in the text: a PR (titled by linkTitles), a code-span-labelled file link, an issue, a commit, a URL with parentheses. The URL inside the quoted code fence stays code; [1] stays text.',
      height: 720,
      frame: false,
      create: () => make({ markdown: ANSWER, responseMs: 252_000, linkTitles: TITLES }),
    },
    {
      id: 'writing',
      title: 'Writing',
      description: 'streaming: true — the text so far, the writing row instead of Copy, aria-busy.',
      height: 300,
      frame: false,
      create: () => make({ markdown: PARTIAL, streaming: true }),
    },
    {
      id: 'pending',
      title: 'Writing, no text yet',
      description: "streaming: true with markdown: '' — only the writing row, aria-busy.",
      height: 140,
      frame: false,
      create: () => make({ markdown: '', streaming: true }),
    },
    {
      id: 'stream',
      title: 'Live stream',
      description: 'Chunks arrive every 650 ms; link cards join the row as their URLs appear, then the answer settles.',
      height: 400,
      frame: false,
      create: streaming,
    },
    {
      id: 'plain',
      title: 'No links',
      description: 'A titled answer without links: the label is just “Answer”, no row, no chips.',
      height: 440,
      frame: false,
      create: () => make({ title: 'Why did the run stop?', markdown: PLAIN, responseMs: 8_400 }),
    },
    {
      id: 'failed',
      title: 'Failed',
      description: 'error + canRetry. Try again → loading → the answer.',
      height: 220,
      frame: false,
      create: failed,
    },
    {
      id: 'empty',
      title: 'Empty',
      description: 'The turn was recorded without text.',
      height: 200,
      frame: false,
      create: () => make({ markdown: '' }),
    },
    {
      id: 'flat',
      title: 'Flat (inside a turn)',
      description:
        'flat + animate: false — no card frame, as in a conversation turn; repainted from the host cache, so no entry motion.',
      height: 520,
      frame: true,
      create: () =>
        make({ markdown: KO, responseMs: 252_000, linkTitles: TITLES, animate: false }, { lang: 'ko', flat: '' }),
    },
    {
      id: 'ko',
      title: '한국어 (lang="ko")',
      height: 520,
      frame: false,
      create: () => make({ markdown: KO, responseMs: 252_000, linkTitles: TITLES }, { lang: 'ko' }),
    },
  ],
};
