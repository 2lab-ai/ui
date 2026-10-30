import type { ComponentDoc } from '../../docs/types';
import './status-bar';
import type { StatusBarActionDetail, StatusBarData, StatusBarStatus, UiStatusBar } from './status-bar';

const S = 1000;
const M = 60 * S;

/** A demo element whose "host" answers like a dashboard: Stop settles a moment later, other actions say so. */
function make(data: StatusBarData, attrs: Record<string, string> = {}, extra?: string): HTMLElement {
  const el = document.createElement('ui-status-bar') as UiStatusBar;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (extra) el.innerHTML = extra;
  el.data = data;
  el.addEventListener('ui-action', (e) => {
    const { id } = (e as CustomEvent<StatusBarActionDetail>).detail;
    if (id === 'link') {
      // The demo stays on the page.
      e.preventDefault();
      return;
    }
    if (id !== 'stop') return;
    setTimeout(() => {
      el.data = {
        ...el.data!,
        status: 'stopped',
        endedAt: Date.now(),
        actions: [{ id: 'close', label: 'Close', icon: 'close' }],
      };
    }, 900);
  });
  return el;
}

function stack(...els: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:12px;width:100%';
  box.append(...els);
  return box;
}

function narrow(el: HTMLElement, width: number): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = `width:${width}px;max-width:100%;padding:12px;border:1px dashed var(--ui-ib-card-border);border-radius:12px`;
  box.append(el);
  return box;
}

const running = (): StatusBarData => ({
  status: 'running',
  startedAt: Date.now() - 3 * M - 12 * S,
  link: { href: 'https://chat.example.com/archives/C042/p1730296', label: 'Thread' },
  actions: [{ id: 'stop', label: 'Stop', icon: 'stop', tone: 'danger' }],
});

export const doc: ComponentDoc = {
  slug: 'status-bar',
  name: 'Status Bar',
  tag: 'ui-status-bar',
  group: 'Components',
  summary: 'Where the session stands — status, how long it has been going, and the one thing you can do about it.',
  description:
    'One row for the head of a detail panel: the status as an icon and a word in the st-* tones (Running with a spinner, Needs input, Idle, Done, Failed, Stopped — the words of <ui-agent-run>’s head chip, overridable), when it started on a 24-hour clock with the elapsed time ticking in place, the host’s actions at the end (one ink primary at most; a danger action takes two presses within 4 s), an optional link that opens in a new tab, and a default slot for anything else. In a narrow container the row wraps: the actions keep to the end of the line they land on.',
  usedIn:
    'soma-work dashboard › detail panel › head (session chip: status · started · elapsed · thread link · Stop / Close)',
  reference: { name: 'affectUI Agent Run (head chip)', url: 'https://www.affectui.com/screens/agent-run' },
  props: [
    {
      name: 'data.status',
      type: "'running' | 'waiting' | 'idle' | 'done' | 'failed' | 'stopped'",
      required: true,
      description: 'Running and waiting are live: the elapsed clock ticks. Unknown values draw as idle.',
    },
    {
      name: 'data.words',
      type: 'Partial<Record<status, string>>',
      description: 'Replace status words, e.g. `{ waiting: "Waiting for review" }`. Empty strings fall back.',
    },
    {
      name: 'data.startedAt',
      type: 'number (epoch ms)',
      description: '`Started 14:05`. Live: `· 3m 12s`, ticking once a second in place.',
    },
    {
      name: 'data.endedAt',
      type: 'number (epoch ms)',
      description: 'A finished run (not live) shows its run time `· 9m 22s` instead of a clock.',
    },
    {
      name: 'data.activeMs',
      type: 'number',
      description: 'Accumulated active time, shown as `Active 6m 00s` when the run is not live and has no run time.',
    },
    {
      name: 'data.actions',
      type: "Array<{ id, label, icon?, tone?: 'danger', primary?, disabled?: boolean | string, busy? }>",
      description:
        'Buttons at the end of the row. `icon` is a glyph name from the icon set. `primary` = the surface’s one ink button. `tone: "danger"` takes two presses within 4 s and then shows busy until the next data. `disabled` as a string disables and says why (tooltip). `busy` = a request in flight (spinner, aria-busy).',
    },
    {
      name: 'data.link',
      type: '{ href: string; label: string; id?: string }',
      description:
        'A link before the actions (a thread, a log), opened in a new tab. http(s) / mailto only — anything else is not drawn.',
    },
    { name: 'slot (default)', type: 'nodes', description: 'Extra items in the row, after the time (a chip, a note).' },
    { name: 'lang', type: "'en' | 'ko'", default: "'en'", description: 'UI language (attribute).' },
    {
      name: 'theme',
      type: "'light' | 'dark'",
      description: 'Pins the theme (attribute). Default follows prefers-color-scheme or page tokens.',
    },
  ],
  events: [
    {
      name: 'ui-action',
      detail: '{ id: string; href?: string }',
      description:
        'An action was pressed (a danger action: the second press within 4 s), or the link was followed (`href` set; id `link` unless given). Cancelable: preventDefault() on the link keeps the browser from opening it (route it yourself); on a confirmed danger action it keeps the button pressable instead of busy.',
    },
  ],
  keyboard: [
    ['Tab', 'Move through the link and the actions'],
    ['Enter / Space', 'Press an action. A danger action: the first press arms (“Press again”), the second sends'],
    ['Esc', 'Disarm an armed danger action (does not reach the page)'],
    ['Tab away from the armed button', 'Disarm'],
  ],
  a11y: [
    'Status is an icon and a word, never colour alone; the icon is decorative. Tone text is the st-* colour mixed 70% toward ink (≥ 4.5:1 on its 14% tint in both themes).',
    'A polite live region says status changes (“Status: Done”) and the armed state (“Press again to confirm: Stop”) — never the ticking clock.',
    'The clock is one text node updated in place; data updates patch the row, so focus stays on the button it was on.',
    'The link’s accessible name starts with its visible label and says it opens a new tab.',
    'Buttons and the link are 44px tall on coarse pointers and narrow screens. Reduced motion: no press scale, the spinner stops.',
  ],
  usage: `<ui-status-bar></ui-status-bar>
<script type="module">
  import '@2lab.ai/ui/status-bar';
  const bar = document.querySelector('ui-status-bar');
  bar.data = {
    status: 'running',
    startedAt: Date.now() - 192_000,
    link: { href: 'https://chat.example.com/archives/C042/p1730296', label: 'Thread' },
    actions: [{ id: 'stop', label: 'Stop', icon: 'stop', tone: 'danger' }],
  };
  bar.addEventListener('ui-action', async (e) => {
    if (e.detail.id !== 'stop') return;
    await fetch('/sessions/42/stop', { method: 'POST' });
    bar.data = { ...bar.data, status: 'stopped', endedAt: Date.now(), actions: [] };
  });
</script>`,
  demos: [
    {
      id: 'running',
      title: 'Running',
      description:
        'Live elapsed time, a thread link and a two-press Stop — press it twice; the host settles a moment later.',
      height: 200,
      create: () => make(running()),
    },
    {
      id: 'waiting',
      title: 'Needs input · one primary',
      description: 'A waiting run with the surface’s ink primary and a quiet second action.',
      height: 200,
      create: () =>
        make({
          status: 'waiting',
          startedAt: Date.now() - 11 * M - 40 * S,
          actions: [
            { id: 'snooze', label: 'Later', icon: 'clock' },
            { id: 'answer', label: 'Answer', icon: 'arrow-right', primary: true },
          ],
        }),
    },
    {
      id: 'finished',
      title: 'Finished',
      description: 'Done shows the run time instead of a clock; Failed keeps the start and offers a retry.',
      height: 220,
      create: () => {
        const t0 = Date.now() - 2 * 60 * M;
        return stack(
          make({
            status: 'done',
            startedAt: t0,
            endedAt: t0 + 9 * M + 22 * S,
            link: { href: 'https://example.com/runs/8812/log', label: 'Log' },
            actions: [{ id: 'archive', label: 'Archive', icon: 'download' }],
          }),
          make({
            status: 'failed',
            startedAt: t0 + 20 * M,
            endedAt: t0 + 21 * M + 4 * S,
            actions: [{ id: 'retry', label: 'Retry', icon: 'refresh' }],
          }),
        );
      },
    },
    {
      id: 'states',
      title: 'Every status',
      description: 'Icon and word in the st-* tones; idle and stopped stay neutral. Words are overridable.',
      height: 340,
      create: () => {
        const t0 = Date.now() - 6 * M;
        const all: Array<[StatusBarStatus, Partial<StatusBarData>]> = [
          ['running', { startedAt: t0 }],
          ['waiting', { startedAt: t0, words: { waiting: 'Waiting for review' } }],
          ['idle', { activeMs: 14 * M + 5 * S }],
          ['done', { startedAt: t0, endedAt: t0 + 4 * M + 51 * S }],
          ['failed', { startedAt: t0, endedAt: t0 + 38 * S }],
          ['stopped', { startedAt: t0 }],
        ];
        return stack(...all.map(([status, rest]) => make({ status, ...rest })));
      },
    },
    {
      id: 'narrow',
      title: 'Narrow container · slot',
      description:
        'At 260px the row wraps: the time and the slotted note take their own lines, the actions keep to the end.',
      height: 260,
      create: () =>
        narrow(
          make(
            {
              ...running(),
              actions: [
                { id: 'log', label: 'Log', icon: 'file-text' },
                { id: 'stop', label: 'Stop', icon: 'stop', tone: 'danger' },
              ],
            },
            {},
            '<span class="ui-chip is-quiet">Retry 2 of 3 at 14:40</span>',
          ),
          260,
        ),
    },
    {
      id: 'readonly',
      title: 'Read-only · busy',
      description: 'A disabled action says why on hover; a request in flight shows a spinner.',
      height: 220,
      create: () =>
        stack(
          make({
            ...running(),
            actions: [
              { id: 'stop', label: 'Stop', icon: 'stop', tone: 'danger', disabled: 'Read-only — not your session' },
            ],
          }),
          make({ ...running(), actions: [{ id: 'stop', label: 'Stopping…', tone: 'danger', busy: true }] }),
        ),
    },
    {
      id: 'ko',
      title: '한국어 (lang="ko")',
      height: 200,
      create: () =>
        make(
          {
            ...running(),
            link: { href: 'https://chat.example.com/archives/C042/p1730296', label: '스레드' },
            actions: [{ id: 'stop', label: '중지', icon: 'stop', tone: 'danger' }],
          },
          { lang: 'ko' },
        ),
    },
  ],
};
