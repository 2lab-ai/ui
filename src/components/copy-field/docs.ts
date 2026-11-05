import type { ComponentDoc } from '../../docs/types';
import './copy-field';
import type { CopyFieldCopyDetail, CopyFieldData, UiCopyField } from './copy-field';

function field(data: CopyFieldData, attrs: Record<string, string> = {}): UiCopyField {
  const el = document.createElement('ui-copy-field');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

function col(width: number, ...kids: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = `display:flex;flex-direction:column;gap:10px;padding:18px 20px;max-width:${width}px`;
  box.append(...kids);
  return box;
}

/** A quiet line of context: what the fields belong to. */
function context(text: string): HTMLElement {
  const p = document.createElement('p');
  p.style.cssText = 'margin:0;font-size:13px;line-height:1.5;color:var(--ui-ib-text-2)';
  p.textContent = text;
  return p;
}

/** The host's status line: what it heard. */
function said(text: string): HTMLElement {
  const p = document.createElement('p');
  p.className = 'ui-status-line';
  p.style.margin = '0';
  p.textContent = text;
  return p;
}

const clock = () => new Date().toTimeString().slice(0, 8);

/** Log every ui-copy the fields send into `line`. A secret is logged by its label only — never its value or length. */
function logCopies(line: HTMLElement, ...els: UiCopyField[]): void {
  for (const el of els)
    el.addEventListener('ui-copy', (e) => {
      const { value } = (e as CustomEvent<CopyFieldCopyDetail>).detail;
      const said = el.data?.secret
        ? `${el.data.label ?? 'secret'} (value not shown)`
        : value.length > 48
          ? `${value.slice(0, 47)}…`
          : value;
      line.textContent = `${clock()} ui-copy → ${said}`;
    });
}

const SESSION = '7f3c2a91-5e0b-4c1d-9a7e-2b6f8d4e1c03';
const PERMALINK = 'https://soma.2lab.ai/dashboard/sessions/7f3c2a91';
const PR = 'https://github.com/2lab-ai/soma-work/pull/1287';
const SIGNING = 'whsec_5Kq2vR8mN1xT7bY4cH9eJ3wL6pD0fG2a';

/** The conversation as Markdown — what “copy full context” puts on the clipboard. Built after a wait, like a fetch. */
function buildContext(): Promise<string> {
  const turns = [
    ['user', 'The upload e2e fails about one run in five on CI. Find out why and fix it.'],
    ['assistant', 'Reading tests/upload.spec.ts and the last 20 CI logs.'],
    ['tool', 'grep -n "waitForResponse" tests/upload.spec.ts → 3 matches'],
    ['assistant', 'The test waits for the response before the upload starts: a race. Moving the wait first.'],
  ];
  const md = [
    '# Fix flaky upload e2e',
    `session ${SESSION} · fix/flaky-upload-e2e · PR #1287`,
    '',
    ...turns.map(([who, text]) => `**${who}**: ${text}\n`),
  ].join('\n');
  return new Promise((resolve) => setTimeout(() => resolve(md), 700));
}

/**
 * Write text that is still being built. Safari keeps the press's permission only for a write that starts inside
 * the press: a ClipboardItem that holds the promise. Elsewhere, or if that throws, the plain write once it is ready.
 */
async function writeLater(text: Promise<string>): Promise<boolean> {
  const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (!clip) return false;
  try {
    if (typeof ClipboardItem === 'function' && typeof clip.write === 'function') {
      const blob = text.then((t) => new Blob([t], { type: 'text/plain' }));
      await clip.write([new ClipboardItem({ 'text/plain': blob })]);
      return true;
    }
  } catch {
    // try the plain write
  }
  try {
    await clip.writeText(await text);
    return true;
  } catch {
    return false;
  }
}

export const doc: ComponentDoc = {
  slug: 'copy-field',
  name: 'Copy Field',
  tag: 'ui-copy-field',
  group: 'Primitives',
  summary:
    'A value you will paste somewhere else — shown whole (or masked), copied in one press, with proof it worked.',
  description:
    'A value and a copy button. Inline it is a pill-height row: a muted label, the value in mono on one line, the button. Text that does not fit ends in “…”; a URL gives way in the middle instead, so its last segment stays in view (https://soma.2lab.ai/dash…/7f3c2a91). As a block it is a box for a command or a snippet: a <pre> that never wraps and scrolls sideways, the button in its top-right corner. The value is one unit to select (user-select: all), so selecting it by hand and copying works too. A press sends a cancelable ui-copy { value }; not prevented, the element copies the value and shows the outcome: the copy icon cross-fades into a check in the done colour that settles from 0.6 to 1, the edge tints, the button is named Copied and a polite live region says so — all back to rest after 1.6 s, one timer that a new press starts again. If the copy fails, the icon turns to a warning, the field says “Copy failed — select the text” (for 4 s, long enough to read) and selects the value, so ⌘C / Ctrl+C is all that is left. A secret shows eight dots whatever its length, with a Show toggle; the copy is always the real value. It is never shown for the person: a failed copy of a masked secret keeps it masked and says “Copy failed — press Show, then copy”. A host that copies something else — built on demand, like a conversation’s full context — prevents ui-copy, writes it itself and calls confirm(ok).',
  usedIn:
    'soma-work dashboard: the session permalink and “copy full context” (copyPanelPermalink / copyToClipboard in src/conversation/dashboard.ts, hand-rolled today), the resume command (claude --resume <id>), a branch name or PR URL on a card, and webhook URLs and tokens on the settings page (masked).',
  reference: {
    name: 'soma-work dashboard — copy permalink / copy context',
    url: 'https://github.com/2lab-ai/soma-work',
  },
  props: [
    {
      name: 'data.value / value',
      type: 'string',
      required: true,
      description:
        'What gets copied, exactly as written. Empty (or only spaces): a muted “—” and a disabled button. A new value masks a secret again and drops the proof of the last copy.',
    },
    {
      name: 'data.label / label',
      type: 'string',
      description:
        'What the value is (“Permalink”). Before the value inline, above it as a block; also names the buttons.',
    },
    {
      name: 'data.view / view',
      type: "'inline' | 'block'",
      default: "'inline'",
      description: 'inline: one line in a pill. block: a <pre> box that scrolls sideways, for a command or a snippet.',
    },
    {
      name: 'data.secret / secret',
      type: 'boolean',
      description:
        'Show eight dots — never the value or its length — and a Show toggle. Showing is the person’s, local only, and ends when the value changes; the copy is always the real value. Never a link.',
    },
    {
      name: 'data.href / href',
      type: 'string',
      description:
        'Draw the value as a link (new tab): http(s), mailto or a same-site path. Anything else (javascript:, data:, //host) draws plain text. Still copyable.',
    },
    {
      name: 'data.copyLabel / copy-label',
      type: 'string',
      default: '"Copy <label>" · ko "<label> 복사"',
      description: 'The copy button’s name, when the default does not say what is copied (“Copy full context”).',
    },
    {
      name: 'data.disabled / disabled',
      type: 'boolean',
      description: 'No copy, no Show: both buttons disabled, the value muted.',
    },
    { name: 'lang', type: '"en" | "ko"', default: '"en"', description: 'The built-in words in Korean.' },
    { name: 'copied', type: 'boolean (read-only)', description: 'True while the proof of a copy shows.' },
    {
      name: 'copy()',
      type: '() => Promise<boolean>',
      description:
        'Copy as if pressed: ui-copy first, then the outcome. True when the element copied it (false when prevented, empty, disabled or failed). Plays no sound.',
    },
    {
      name: 'confirm(ok = true)',
      type: '(ok?: boolean) => void',
      description:
        'Show the outcome of a copy the host did itself after preventing ui-copy: Copied, or “Copy failed” (nothing is selected — the element does not know what you copied).',
    },
    {
      name: 'copyMiddle / copyMask / copyLabel / copyView',
      type: 'helpers',
      description:
        'Pure: the value split into a head that gives way and a tail that stays (a URL’s last segment); the mask (eight dots, or nothing for no value); the copy button’s name in en / ko; the view from any input.',
    },
  ],
  events: [
    {
      name: 'ui-copy',
      detail: '{ value: string }',
      description:
        'The person pressed Copy (or you called copy()). Cancelable: preventDefault() and the element copies nothing — copy what you want yourself, then call confirm(ok) to show how it went.',
    },
  ],
  keyboard: [
    ['Tab', 'Focus Show (a secret), then Copy; a block’s value box too, so the arrows can scroll it'],
    ['Enter / Space', 'On Copy: copy. On Show: show or hide the secret'],
    ['← / →', 'In a block’s value box: scroll a long line'],
  ],
  a11y: [
    'Real <button>s. Copy is named “Copy <label>” (or copyLabel); while the outcome shows it is named “Copied” or the failed words. A visually hidden role="status" (polite) says the same once per press — the same words twice in a row are said twice.',
    'Show is a toggle: its name stays “Show <label>” and aria-pressed says whether the secret shows. The dots are aria-hidden; screen readers hear “Hidden”, and “No value” for the “—”.',
    'The outcome is never colour alone: the icon changes shape (check / warning), and a failure is written under the field.',
    'A failed copy selects the value. A masked secret is never shown or selected for the person — not in a title, a name or the live text either; its words send them to Show. A block’s scroller takes focus (tabindex="0") so the keyboard can scroll it.',
    'Focus ring: 2px --border-focus. Coarse pointer: the buttons are 44 × 44 and the inline row grows to fit them.',
    'Reduced motion: no cross-fade or scale — the icons swap at once.',
    'Sound (opt-in, @2lab.ai/ui/sound): a person’s press that copied plays success (subtle); one that failed plays error (subtle); Show / Hide plays toggle. Nothing for a prevented ui-copy, copy() or confirm() — the host plays its own cue if it wants one.',
  ],
  usage: `<ui-copy-field label="Permalink" value="https://soma.2lab.ai/dashboard/sessions/7f3c2a91"
  href="https://soma.2lab.ai/dashboard/sessions/7f3c2a91"></ui-copy-field>
<ui-copy-field view="block" label="Resume in your terminal"
  value="claude --resume 7f3c2a91-5e0b-4c1d-9a7e-2b6f8d4e1c03"></ui-copy-field>
<ui-copy-field id="secret"></ui-copy-field>
<ui-copy-field id="context" label="Context" copy-label="Copy full context"
  value="session 7f3c2a91 · 48 turns"></ui-copy-field>
<script type="module">
  import '@2lab.ai/ui/copy-field';
  document.querySelector('#secret').data = { label: 'Signing secret', value: token, secret: true };
  const ctx = document.querySelector('#context');
  ctx.addEventListener('ui-copy', async (e) => {
    e.preventDefault();                                          // copy something else, built on demand
    try {
      await navigator.clipboard.writeText(await buildContext()); // your call
      ctx.confirm(true);
    } catch {
      ctx.confirm(false);
    }
  });
</script>`,
  demos: [
    {
      id: 'permalink',
      title: 'On a session card',
      description:
        'A 380px card: the permalink and the PR give way in the middle, so the session id and the PR number stay in view; the branch is plain text. The line logs each ui-copy.',
      height: 260,
      create: () => {
        const permalink = field({ label: 'Permalink', value: PERMALINK, href: PERMALINK });
        const pr = field({ label: 'PR', value: PR, href: PR });
        const branch = field({ label: 'Branch', value: 'fix/flaky-upload-e2e' });
        const line = said('Press a copy button.');
        logCopies(line, permalink, pr, branch);
        return col(380, context('“Fix flaky upload e2e” · running 14m · zhuge'), permalink, pr, branch, line);
      },
    },
    {
      id: 'commands',
      title: 'Commands to paste in a terminal',
      description:
        'view="block": the resume command, the install line, and two long lines that scroll sideways instead of wrapping.',
      height: 340,
      create: () =>
        col(
          520,
          field({ view: 'block', label: 'Resume in your terminal', value: `claude --resume ${SESSION}` }),
          field({ view: 'block', label: 'Install', value: 'npm i @2lab.ai/ui@0.29.0' }),
          field({
            view: 'block',
            label: 'Run it locally',
            value:
              'git switch fix/flaky-upload-e2e && npm ci\nnpx playwright test tests/upload.spec.ts --repeat-each=20 --reporter=line --retries=0',
          }),
        ),
    },
    {
      id: 'secrets',
      title: 'Settings — masked tokens',
      description:
        'secret: eight dots whatever the length, a Show toggle (aria-pressed), and the copy is always the real value. A key not made yet has no value: “—” and a disabled button.',
      height: 260,
      create: () => {
        const hook = field({
          label: 'Webhook URL',
          value: 'https://hooks.slack.com/services/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',
          secret: true,
        });
        const signing = field({ label: 'Signing secret', value: SIGNING, secret: true });
        const deploy = field({ label: 'Deploy key', value: '', secret: true });
        const line = said('Slack · #soma-alerts · last delivery 2m ago (200)');
        logCopies(line, hook, signing);
        return col(440, context('Settings · Integrations · Slack'), hook, signing, deploy, line);
      },
    },
    {
      id: 'ko',
      title: '한국어',
      description: 'lang="ko": 복사 / 복사됨 / 보기, and every button name in Korean.',
      height: 300,
      create: () =>
        col(
          440,
          field({ label: '퍼머링크', value: PERMALINK, href: PERMALINK }, { lang: 'ko' }),
          field({ label: '브랜치', value: 'fix/flaky-upload-e2e' }, { lang: 'ko' }),
          field(
            { view: 'block', label: '터미널에서 이어서 하기', value: `claude --resume ${SESSION}` },
            { lang: 'ko' },
          ),
          field({ label: '서명 키', value: SIGNING, secret: true }, { lang: 'ko' }),
        ),
    },
    {
      id: 'context',
      title: 'Copy full context — the host copies',
      description:
        'The host prevents ui-copy, builds the conversation as Markdown (a 700ms wait stands in for the fetch), writes it itself and calls confirm(ok). Turn on “blocked” to see confirm(false).',
      height: 220,
      create: () => {
        const el = field({
          label: 'Context',
          value: 'session 7f3c2a91 · 48 turns · 31.2k tokens',
          copyLabel: 'Copy full context',
        });
        const line = said('The copy is the whole conversation, not the line above.');
        const blocked = document.createElement('label');
        blocked.className = 'ui-switch';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.setAttribute('role', 'switch');
        const word = document.createElement('span');
        word.textContent = 'Clipboard blocked (confirm(false))';
        blocked.append(box, word);
        el.addEventListener('ui-copy', (e) => {
          e.preventDefault();
          line.textContent = `${clock()} ui-copy prevented → building 48 turns…`;
          const text = buildContext();
          const write = box.checked ? text.then(() => false) : writeLater(text);
          void write.then(async (ok) => {
            el.confirm(ok);
            const md = await text;
            line.textContent = ok
              ? `${clock()} copied the conversation as Markdown (${md.length} characters)`
              : `${clock()} the clipboard said no — confirm(false)`;
          });
        });
        return col(440, el, line, blocked);
      },
    },
  ],
};
