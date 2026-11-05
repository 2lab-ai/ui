import type { ComponentDoc } from '../../docs/types';
import './agent-island';
import type { AgentIslandData, IslandAction, IslandActionDetail, UiAgentIsland } from './agent-island';

const S = 1000;
const M = 60 * S;

const STOP: IslandAction = { id: 'stop', label: 'Stop', icon: 'stop', tone: 'danger' };
const OPEN: IslandAction = { id: 'open', label: 'Open', icon: 'external' };

/** A demo island whose "host" answers like the dashboard: Stop ends the run, Approve starts the deploy. */
function island(data: AgentIslandData, attrs: Record<string, string> = {}): UiAgentIsland {
  const el = document.createElement('ui-agent-island');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  el.addEventListener('ui-action', (e) => {
    const { id } = (e as CustomEvent<IslandActionDetail>).detail;
    const d = el.data;
    if (!d) return;
    const ko = el.getAttribute('lang') === 'ko';
    if (id === 'stop')
      setTimeout(() => {
        el.data = {
          ...d,
          status: 'done',
          endedAt: Date.now(),
          step: ko ? '직접 중지함' : 'Stopped by you',
          actions: d.actions?.filter((a) => a.id !== 'stop'),
        };
      }, 700);
    if (id === 'approve')
      setTimeout(() => {
        el.data = {
          ...d,
          status: 'running',
          step: 'Deploying 0.29.0 to prod — 2 of 4 regions',
          progress: { done: 2, total: 4 },
          actions: [STOP, OPEN],
        };
      }, 600);
  });
  return el;
}

function stage(...els: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:16px;width:100%;padding:20px 16px';
  box.append(...els);
  return box;
}

function row(...els: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText =
    'display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-start;gap:12px;width:100%;padding:20px 16px';
  box.append(...els);
  return box;
}

export const doc: ComponentDoc = {
  slug: 'agent-island',
  name: 'Agent Island',
  tag: 'ui-agent-island',
  group: 'Components',
  summary:
    'A run you are not looking at — what it is doing and for how long — with Stop and Open one press away, without leaving the page you are on.',
  description:
    'One pill for a live run elsewhere: its status mark (a spinning ring while it runs, a pulsing dot when it needs you, a check, a cross), a short title and the elapsed clock, plus a +N chip for the other runs. Press it and the pill grows into a card: the status and a big clock, the title, the current step, the progress (“3 of 7” on a thin rail) and the host’s actions — Stop as a round red button, Open. Width, height and corners move together on one spring, anchored at the top edge, so the pill grows as one object; the content does not stretch with it — the compact row and the card crossfade through a little blur and scale, the new one a beat after the old one. The clock ticks in place once a second while the run is live and stops by itself when it ends. Ink (the default) inverts with the theme; surface is a raised card. The element is a block: the pill sits at its top, centred (`--island-align` moves it), and the card takes min(340px, the room it has). It grows in place — put it somewhere it may grow over (an app bar’s overlay, a fixed corner) if it should not push the page.',
  usedIn:
    'soma-work dashboard: a live run you are not looking at — in the app bar on phones, in the board’s corner — showing the session’s status, elapsed time and current activity, with Stop and Open.',
  reference: { name: 'bencho.dev — Dynamic island (MIT)', url: 'https://bencho.dev/blocks/dynamic-island' },
  props: [
    {
      name: 'data.title',
      type: 'string',
      required: true,
      description: 'The run’s name. The pill shows about 14 characters of it.',
    },
    {
      name: 'data.status',
      type: "'running' | 'waiting' | 'done' | 'failed'",
      required: true,
      description: 'Running, Needs you, Done, Failed — a mark and a word. Unknown values draw as running.',
    },
    {
      name: 'data.startedAt',
      type: 'number (epoch ms)',
      description: 'The clock counts from here: 0:42 · 12:05 · 1:02:09. Without it there is no clock.',
    },
    {
      name: 'data.endedAt',
      type: 'number (epoch ms)',
      description: 'The clock stops at the run’s time. Running or waiting with no end: it ticks once a second.',
    },
    {
      name: 'data.step',
      type: 'string',
      description: 'What it is doing now (“Running npm test — 1,942 tests”), in the card, up to two lines.',
    },
    {
      name: 'data.progress',
      type: '{ done: number; total: number }',
      description: '“3 of 7” and a thin rail in the card. A total under 1 draws nothing.',
    },
    { name: 'data.more', type: 'number', description: 'Other live runs: a +N chip, and “N more” in the name.' },
    {
      name: 'data.actions',
      type: "Array<{ id: string; label: string; icon?: IconName; tone?: 'danger' }>",
      description:
        'Buttons in the card. `tone: "danger"` with an icon is the round red button (its label is its name and tooltip); the others are pills with icon and label.',
    },
    {
      name: 'data.open',
      type: 'boolean',
      description:
        'The state the host wants, applied when the value changes — sending the same value again does not undo a person’s own toggle.',
    },
    {
      name: 'open',
      type: 'boolean attribute / property',
      description: 'Reflects whether the card is open. Setting it opens or closes without an event.',
    },
    {
      name: 'show() / hide() / toggle()',
      type: 'methods',
      description: 'Open, close or flip the card from the host’s own control (no event).',
    },
    {
      name: 'tone',
      type: "'ink' | 'surface'",
      default: "'ink'",
      description: 'Ink: the pill is ink and inverts with the theme. Surface: a raised card with a border.',
    },
    { name: 'lang', type: "'en' | 'ko'", default: "'en'", description: 'UI language (attribute).' },
    {
      name: '--island-align',
      type: 'CSS property on the element',
      default: 'center',
      description: 'Where the pill sits in the element’s width: center, flex-start or flex-end (a right corner).',
    },
    {
      name: 'islandClock(ms) / islandElapsed / islandTicks / islandProgress / islandFit',
      type: 'helpers',
      description: 'Pure: the clock text, the elapsed time, whether it ticks, a usable progress and the box size.',
    },
  ],
  events: [
    {
      name: 'ui-toggle',
      detail: '{ open: boolean }',
      description:
        'The person pressed the pill or the card’s head, or Esc in the open card: the state they asked for. Cancelable — preventDefault() keeps it as it was.',
    },
    {
      name: 'ui-action',
      detail: '{ id: string }',
      description: 'An action was pressed (Stop, Open …). Cancelable — preventDefault() silences its cue.',
    },
  ],
  keyboard: [
    ['Tab', 'Move to the pill; in the card, through the head and the actions'],
    ['Enter / Space', 'On the pill: open. On the card’s head: close. On an action: press it'],
    ['Esc', 'Close the card; focus goes back to the pill (does not reach the page)'],
  ],
  a11y: [
    'The toggle is one button with aria-expanded and aria-controls — the pill, or the card’s head — named “<status>, <title>” (and “, N more”). Actions are its siblings, never inside it. The face that is not on screen is inert.',
    'Status is a mark and a word, never colour alone. On ink the marks are mixed 30% toward the pill’s foreground so they hold contrast in both themes.',
    'The ticking clock is aria-hidden on the pill; in the card it is a <time datetime>. One text node changes in place each second — never a re-render.',
    'A visually hidden role="status" says a status change (“Done: Fix flaky checkout test”) — not the ticks, not the first render.',
    'Focus that was in the island moves with it: to the card’s head when it opens, back to the pill when it closes (Esc included).',
    'Targets are 44px on touch and narrow screens (the pill grows to 44px). Reduced motion: no spring, scale or blur — the size changes at once and the faces at most fade; the spinner and the pulse stop.',
    'Sound (opt-in, @2lab.ai/ui/sound): the pill, the head and Esc play open / close unless ui-toggle is cancelled; an action plays tap unless ui-action is cancelled; show() / hide() / toggle() play open / close only inside a click or key press; data, the open attribute and status changes are silent. Silent until the page turns sound on.',
  ],
  usage: `<ui-agent-island></ui-agent-island>
<script type="module">
  import '@2lab.ai/ui/agent-island';
  const island = document.querySelector('ui-agent-island');
  island.data = {
    title: 'Fix flaky checkout test',
    status: 'running',
    startedAt: Date.now() - 252_000,
    step: 'Running npm test — 1,942 tests',
    progress: { done: 3, total: 7 },
    actions: [
      { id: 'stop', label: 'Stop', icon: 'stop', tone: 'danger' },
      { id: 'open', label: 'Open', icon: 'external' },
    ],
  };
  island.addEventListener('ui-action', async (e) => {
    if (e.detail.id === 'open') location.href = '/sessions/42';
    if (e.detail.id !== 'stop') return;
    await fetch('/sessions/42/stop', { method: 'POST' });
    island.data = { ...island.data, status: 'done', endedAt: Date.now(), actions: [] };
  });
</script>`,
  demos: [
    {
      id: 'running',
      title: 'Running · open',
      description:
        'A test run in its fourth minute, step 3 of 7. Press the head to fold it into the pill and again to open it; Stop ends the run a moment later.',
      height: 300,
      create: () =>
        stage(
          island({
            title: 'Fix flaky checkout test',
            status: 'running',
            startedAt: Date.now() - 4 * M - 12 * S,
            step: 'Running npm test — 1,942 tests',
            progress: { done: 3, total: 7 },
            actions: [STOP, OPEN],
            open: true,
          }),
        ),
    },
    {
      id: 'needs-you',
      title: 'Needs you · two more',
      description:
        'A release waiting for approval, with two other runs behind it. Open it and Approve: the run goes on — the mark turns and the content pops.',
      height: 300,
      create: () =>
        stage(
          island({
            title: 'Release 0.29.0',
            status: 'waiting',
            startedAt: Date.now() - 12 * M - 5 * S,
            step: 'Approve: deploy 0.29.0 to prod',
            more: 2,
            actions: [{ id: 'approve', label: 'Approve', icon: 'check' }, OPEN],
          }),
        ),
    },
    {
      id: 'statuses',
      title: 'Every status',
      description:
        'Running and Needs you tick; Done and Failed show the run’s time and stand still. Each one opens on its own.',
      height: 320,
      create: () => {
        const now = Date.now();
        return row(
          island({
            title: 'Refactor auth middleware',
            status: 'running',
            startedAt: now - 42 * S,
            actions: [STOP, OPEN],
          }),
          island({
            title: 'Pick a DB for the queue',
            status: 'waiting',
            startedAt: now - 9 * M - 22 * S,
            step: 'Asked: Postgres or Redis streams?',
            actions: [OPEN],
          }),
          island({
            title: 'Write release notes',
            status: 'done',
            startedAt: now - 30 * M,
            endedAt: now - 30 * M + 6 * M + 41 * S,
            step: 'Posted to #releases',
            actions: [OPEN],
          }),
          island({
            title: 'Migrate billing tables',
            status: 'failed',
            startedAt: now - 2 * 60 * M,
            endedAt: now - 2 * 60 * M + M + 4 * S,
            step: 'psql: relation "invoices_v2" already exists',
            progress: { done: 1, total: 4 },
            actions: [OPEN],
          }),
        );
      },
    },
    {
      id: 'ko',
      title: '한국어 · surface',
      description: 'lang="ko" and tone="surface": the raised card, an hour into a research run.',
      height: 300,
      create: () =>
        stage(
          island(
            {
              title: '주간 리포트 초안 작성',
              status: 'running',
              startedAt: Date.now() - 62 * M - 9 * S,
              step: '웹 검색 중 — 출처 12개 확인',
              progress: { done: 2, total: 5 },
              actions: [
                { id: 'stop', label: '중지', icon: 'stop', tone: 'danger' },
                { id: 'open', label: '열기', icon: 'external' },
              ],
              open: true,
            },
            { lang: 'ko', tone: 'surface' },
          ),
        ),
    },
  ],
};
