import type { ComponentDoc } from '../../docs/types';
import '../agent-inbox/agent-inbox';
import './distortion-wave';
import type { AgentInboxData, InboxCard, InboxStatus } from '../agent-inbox/agent-inbox';
import type { DistortionWaveData, UiDistortionWave } from './distortion-wave';

function wave(data: DistortionWaveData, style: string): UiDistortionWave {
  const el = document.createElement('ui-distortion-wave');
  el.style.cssText = style;
  el.data = data;
  return el;
}

function view(html: string, style: string, slot = ''): HTMLElement {
  const d = document.createElement('div');
  if (slot) d.slot = slot;
  d.style.cssText = style;
  d.innerHTML = html;
  return d;
}

const PANEL =
  'display:flex;flex-direction:column;gap:10px;padding:22px 22px 84px;min-height:240px;background:var(--ui-surface-raised);color:var(--ui-text);font-size:14px;line-height:1.5';
const ROW = 'display:flex;justify-content:space-between;color:var(--ui-text-secondary)';
const BTN =
  'position:absolute;left:22px;right:22px;bottom:20px;height:44px;border-radius:12px;border:0;font:inherit;font-weight:650;cursor:pointer;background:var(--ui-text);color:var(--ui-surface)';

/** Review → receipt: the wave rises from the Confirm button and leaves the receipt behind; Back collapses it. */
function transfer(): HTMLElement {
  const el = wave(
    { type: 'vertical' },
    'width:min(100%, 420px);margin:0 auto;border-radius:22px;overflow:hidden;border:1px solid var(--ui-border)',
  );
  el.append(
    view(
      `<b style="font-size:17px">Send 1,250.00 USD</b><div style="${ROW}"><span>To</span><span>Kim Design Studio</span></div><div style="${ROW}"><span>From</span><span>Business · 4021</span></div><div style="${ROW}"><span>Arrives</span><span>Today, 18:00</span></div>`,
      PANEL,
    ),
    view(
      `<b style="font-size:17px">Sent ✓</b><div style="${ROW}"><span>Reference</span><span>TX-48211</span></div><div style="${ROW}"><span>Amount</span><span>1,250.00 USD</span></div><div style="color:var(--ui-text-secondary)">A receipt is on its way to your inbox.</div>`,
      PANEL,
      'revealed',
    ),
  );
  const btn = document.createElement('button');
  btn.slot = 'overlay';
  btn.type = 'button';
  btn.style.cssText = BTN;
  btn.textContent = 'Confirm';
  let sent = false;
  btn.addEventListener('click', () => {
    sent = !sent;
    el.data = { ...el.data, revealed: sent, source: btn };
    btn.textContent = sent ? 'Back' : 'Confirm';
  });
  el.append(btn);
  return el;
}

/** A side tab: the horizontal front sweeps across from the left edge. */
function sideTab(): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;gap:10px;align-items:stretch;max-width:520px;margin:0 auto';
  const tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;flex-direction:column;gap:6px';
  const el = wave(
    { type: 'horizontal', palette: 'ocean' },
    'flex:1;border-radius:16px;overflow:hidden;border:1px solid var(--ui-border)',
  );
  el.append(
    view(
      '<b>Plan</b><ol style="margin:0;padding-left:18px"><li>Read the failing test</li><li>Trace the call</li><li>Fix and re-run</li></ol>',
      PANEL.replace('84px', '22px'),
    ),
    view(
      '<b>Changes</b><div style="font-family:var(--ui-mono);font-size:12.5px">src/session/queue.ts +14 −3<br>src/session/queue.test.ts +41</div>',
      PANEL.replace('84px', '22px'),
      'revealed',
    ),
  );
  let on = false;
  for (const [label, want] of [
    ['Plan', false],
    ['Changes', true],
  ] as const) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ui-btn';
    b.textContent = label;
    b.style.cssText = 'height:auto;flex:1;writing-mode:vertical-rl;padding:10px 6px';
    b.addEventListener('click', () => {
      if (on === want) return;
      on = want;
      el.data = { ...el.data, revealed: on, source: b };
    });
    tabs.append(b);
  }
  box.append(tabs, el);
  return box;
}

const CARDS: InboxCard[] = [
  { id: 'fable', title: 'Port the wave to the board', status: 'running', model: 'claude-fable-5-2', wave: 'loud' },
  { id: 'opus', title: 'Review the release notes', status: 'running', model: 'claude-opus-5-5', wave: 'quiet' },
];
const NEXT: Record<InboxStatus, InboxStatus> = {
  running: 'waiting',
  waiting: 'done',
  done: 'failed',
  failed: 'running',
  idle: 'running',
};

/** Two cards on one board: the Fable card waves loudly, the other quietly, each time its status changes. */
function board(): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:10px';
  const inbox = document.createElement('ui-agent-inbox');
  inbox.setAttribute('view', 'list');
  const paint = (cards: InboxCard[]) => {
    const data: AgentInboxData = { columns: [{ id: 'all', label: 'Tasks', cards }] };
    inbox.data = data;
  };
  let cards = CARDS.map((c) => ({ ...c }));
  paint(cards);
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
  for (const id of ['fable', 'opus']) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ui-btn';
    b.textContent = id === 'fable' ? 'Next status — Fable (loud)' : 'Next status — Opus (quiet)';
    b.addEventListener('click', () => {
      cards = cards.map((c) => (c.id === id ? { ...c, status: NEXT[c.status] } : c));
      paint(cards);
    });
    bar.append(b);
  }
  box.append(bar, inbox);
  return box;
}

/** Center: a ring out from the avatar; the avatar stays sharp at its centre. */
function avatar(): HTMLElement {
  const el = wave(
    { type: 'center', palette: 'green' },
    'width:min(100%, 360px);margin:0 auto;border-radius:20px;overflow:hidden;border:1px solid var(--ui-border)',
  );
  const face =
    '<div style="width:56px;height:56px;border-radius:50%;display:grid;place-items:center;font-weight:700;background:var(--ui-text);color:var(--ui-surface)">Z</div>';
  el.append(
    view(
      `${face}<b>Zhuge wants to run a migration</b><span style="color:var(--ui-text-secondary)">db/migrations/0042_add_index.sql</span>`,
      `${PANEL.replace('84px', '22px')};align-items:center;text-align:center`,
    ),
    view(
      `${face}<b>Approved</b><span style="color:var(--ui-text-secondary)">The migration runs now.</span>`,
      `${PANEL.replace('84px', '22px')};align-items:center;text-align:center`,
      'revealed',
    ),
  );
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const src = t.closest?.('div[style*="border-radius:50%"]');
    if (!src) return;
    el.data = { ...el.data, revealed: !el.data?.revealed, source: src };
  });
  return el;
}

export const doc: ComponentDoc = {
  slug: 'distortion-wave',
  name: 'Distortion Wave',
  tag: 'ui-distortion-wave',
  summary:
    'What just changed, and from where — a colourful wave leaves the control you pressed and carries one view into the next.',
  description:
    'A port of Libraries.dev’s Distortion waves: one clear WebGL 2 canvas over the element bends a picture of the views with a soft swell, progressive blur and chromatic aberration, leaves colour on the edges and a hairline on the glass, and throws a few dots. The first view is the default slot, the view the wave leaves behind is `slot="revealed"` (without one the wave passes over the first view and leaves it as it was), and `slot="overlay"` stays live and unbent above both — the button that starts it. Three shapes: `vertical` (up from a button at the bottom), `horizontal` (across from a tall source at the left) and `center` (a ring out from an avatar or a status mark, which stays sharp at its centre). Setting `revealed` runs it forwards, clearing it collapses the wave back into its source. The wave bends a picture taken just before the run, so what animates inside a view stands still while it passes; give both views an opaque background. Without WebGL 2, and under reduced motion, it is a crossfade. `playStatusWave()` is the same wave run once over any card whose status changed — `<ui-agent-inbox>` plays it for a card that carries `wave: "loud" | "quiet"`. The status wave is two weights of one family (the same ring out of the status mark, in the new status’s colour): loud is an event — a gather onto the mark, the card bent through a lens, dots, the edges lit while the card glides, 1.2–2.5 s, the full spectrum laced into needs-you, done and running and a failure kept in its red; quiet is the colour alone, 1.1–1.4 s, faintest for the most frequent change (→ running) and none for a card put to sleep. The weights follow how often a change is seen and what it asks of the reader (frequency rule, calm technology, peripheral-motion and habituation studies, WCAG 2.2.2): `STATUS_WAVES` is the matrix, `statusWaveOptions()` the options for one change (theme, mono and a folded card adjust it), and the page caps them (4 at once, 2 loud).',
  usedIn:
    'soma-work dashboard: the board’s task cards — a change of status waves over the card, loudly for a Fable session and quietly for the rest (`<ui-agent-inbox>` card `wave`).',
  reference: { name: 'Libraries.dev — Distortion waves (MIT)', url: 'https://libraries.dev/waves' },
  group: 'Effects',
  props: [
    {
      name: 'revealed',
      type: 'attribute / data.revealed: boolean',
      description:
        'Which view shows. Changing it runs the wave: forwards to reveal, backwards (faster, eased) to return. Leave it out to drive the wave with play().',
    },
    {
      name: 'type',
      type: 'attribute / data.type: "vertical" | "horizontal" | "center"',
      default: '"vertical"',
      description: 'The shape of the front; each has its own tuned defaults.',
    },
    {
      name: 'palette',
      type: 'attribute / data.palette: "colorful" | "green" | "ocean" | "sunset" | "mono" | "#RRGGBB" | Palette',
      default: 'the type’s own',
      description: 'The colours on the front and the edges.',
    },
    {
      name: 'data.source',
      type: 'Element | { x, y, w, h } | string (selector among the children)',
      default: 'the control last pressed',
      description: 'Where the wave starts (read when it leaves from rest).',
    },
    {
      name: 'data.focus',
      type: '{ x, y } | null',
      default: 'the last press',
      description: 'The point the front leans toward, in the element’s CSS pixels.',
    },
    {
      name: 'data.waveStyle',
      type: 'Partial<WaveStyle>',
      default: 'the type’s own',
      description:
        'Any of the wave’s numbers (seconds and points): anticipation, travel, linger, rimFade, returnSpeed, pull, inhale, amplitude, lensWidth, aberration, swell, blur, blurAhead, blurBehind, lead, tail, strength, rimWidth, rimStrength, rimPulse, hairline…, orientation, particleCount, particleSize, particleLife …',
    },
    {
      name: 'data.scrub',
      type: 'number | null',
      description: 'Holds the wave at this point of its run, 0 … 1, instead of playing.',
    },
    {
      name: 'data.capture',
      type: 'boolean | CaptureFunction',
      default: 'true',
      description:
        'How the views are pictured for the lens. false draws the colour alone (the second view fades in under it).',
    },
    {
      name: 'data.live',
      type: 'boolean | "animations"',
      default: 'true',
      description: 'Whether the picture follows the views while the wave is out.',
    },
    { name: 'data.scale', type: 'number | "auto"', default: '"auto"', description: 'CSS pixels per point.' },
    {
      name: 'data.cornerRadius',
      type: 'number',
      default: 'the element’s border radius',
      description: 'The radius the edge colour follows.',
    },
    {
      name: 'data.resolution',
      type: 'number',
      default: 'devicePixelRatio',
      description: 'Canvas pixels per CSS pixel.',
    },
    {
      name: 'data.prewarm',
      type: 'boolean',
      default: 'false',
      description:
        'Make the WebGL context and take the first picture when the browser is idle after connecting, so the first wave has its lens from the start. Off by default: the context is made when the first wave asks (browsers allow ~16 per page).',
    },
    {
      name: 'motion',
      type: 'attribute: "system" | "reduce" | "full"',
      default: '"system"',
      description: 'system follows prefers-reduced-motion (a crossfade); reduce always crossfades; full always waves.',
    },
    {
      name: 'playStatusWave({ card, source, emphasis, from, to, folded?, tone?, options? })',
      type: 'function → StatusWaveRun | null',
      description:
        'One status wave over a positioned card (its canvas and context released when it ends). null when it would be noise or cannot run: no preset (a quiet card put to sleep), reduced motion, a hidden tab, a card less than half on screen, or the page at its limit (4, 2 loud; a loud one displaces a quiet one). options merges over the preset (a host’s own tuning).',
    },
    {
      name: 'play(options?) · reverse() · reset() · prepare()',
      type: 'methods',
      description:
        'play runs the wave from the start ({ source, focus }); reverse runs it back; reset goes straight back with no wave; prepare pictures the views now.',
    },
  ],
  events: [
    {
      name: 'ui-finished',
      detail: '{ revealed: boolean }',
      description: 'A wave ended (not sent for one turned around before it got there).',
    },
  ],
  keyboard: [],
  a11y: [
    'The canvas is aria-hidden: the wave is a flourish over a change the views themselves state.',
    'The view not showing is inert and aria-hidden, so focus and the accessibility tree follow the visible view.',
    'Reduced motion (or motion="reduce") turns the wave into a 300 ms crossfade; without WebGL 2 likewise.',
    'The overlay stays live above the wave, so the control that started it keeps focus and clicks.',
  ],
  usage: `<ui-distortion-wave id="w" type="vertical" style="border-radius:24px;overflow:hidden">
  <div>…review…</div>
  <div slot="revealed">…receipt…</div>
  <button slot="overlay" id="confirm">Confirm</button>
</ui-distortion-wave>
<script type="module">
  import '@2lab.ai/ui/distortion-wave';
  const w = document.getElementById('w');
  confirm.onclick = () => { w.data = { revealed: true, source: confirm }; };
  w.addEventListener('ui-finished', (e) => console.log('showing', e.detail.revealed ? 'receipt' : 'review'));

  // The same wave once over any card whose status changed:
  import { playStatusWave } from '@2lab.ai/ui/distortion-wave';
  playStatusWave({ card, source: card.querySelector('.status-icon'), emphasis: 'loud', from: 'running', to: 'done' });
</script>`,
  demos: [
    {
      id: 'transfer',
      title: 'Review → receipt (vertical)',
      description: 'The wave rises from Confirm and leaves the receipt; Back collapses it into the button.',
      height: 420,
      create: transfer,
    },
    {
      id: 'board',
      title: 'Task cards — loud and quiet status waves',
      description:
        'Each press moves a card to its next status. The Fable card (wave: "loud") waves with the lens, dots and lingering colour; the other (wave: "quiet") gets the same ring in the new status’s colour alone.',
      height: 320,
      create: board,
    },
    {
      id: 'side-tab',
      title: 'Side tab (horizontal)',
      description: 'The front sweeps across from the tab you pressed.',
      height: 300,
      create: sideTab,
    },
    {
      id: 'avatar',
      title: 'Avatar (center)',
      description: 'Press the avatar: a ring out from it, the avatar sharp at its centre.',
      height: 300,
      create: avatar,
    },
  ],
};
