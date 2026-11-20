import type { ComponentDoc } from '../../docs/types';
import { icon } from '../../icons/icons';
import './magnetic';
import type { CalibrationState } from './engine/calibration';
import type { MagnetBridgeChange, MagnetGestureDetail, MagneticData, UiMagnetic } from './magnetic';

/** Light-DOM styles for the demos: the host's own markup — the element only moves it. */
const DEMO_CSS = `
.mg-wrap { display: grid; gap: 10px; width: 100%; max-width: 640px; margin: 0 auto; padding: 12px; }
.mg-note { margin: 0; font-size: 12px; line-height: 1.45; color: var(--ui-text-tertiary); text-align: center; }
.mg-bar { border-radius: 14px; background: var(--ui-surface-raised); padding: 10px 12px; }
.mg-bar-row { display: flex; align-items: center; gap: 6px; }
.mg-brand { display: inline-flex; align-items: center; gap: 8px; font-weight: 650; font-size: 14px; color: var(--ui-text);
  padding: 6px 8px; border-radius: 10px; }
.mg-pill { border: 0; font: inherit; font-size: 13px; padding: 6px 12px; border-radius: 999px; cursor: pointer;
  color: var(--ui-text-secondary); background: transparent; }
.mg-pill[aria-current="page"] { color: var(--ui-text); background: var(--ui-surface); }
.mg-pill:focus-visible, .mg-btn:focus-visible { outline: 2px solid var(--ui-border-focus); outline-offset: 2px; }
.mg-spacer { flex: 1; }
.mg-btn { border: 0; font: inherit; font-size: 13px; font-weight: 550; padding: 7px 14px; border-radius: 10px;
  cursor: pointer; color: var(--ui-surface); background: var(--ui-text); }
.mg-btn[disabled] { opacity: 0.5; cursor: default; }
.mg-btn.is-quiet { color: var(--ui-text); background: var(--ui-surface); box-shadow: inset 0 0 0 1px var(--ui-border); }
.mg-title { margin: 14px 8px 2px; font-size: 20px; font-weight: 680; letter-spacing: -0.01em; color: var(--ui-text); }
.mg-sub { margin: 0 8px 4px; font-size: 13px; color: var(--ui-text-secondary); }
.mg-chips { display: flex; flex-wrap: wrap; gap: 8px; padding: 18px; border-radius: 14px;
  background: var(--ui-surface-raised); min-height: 180px; align-content: center; justify-content: center; }
.mg-chip { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 999px; font-size: 13px;
  color: var(--ui-text); background: var(--ui-surface); box-shadow: inset 0 0 0 1px var(--ui-border); }
.mg-chip i { width: 8px; height: 8px; border-radius: 50%; background: var(--c, var(--ui-st-run)); }
.mg-panel { display: grid; gap: 10px; padding: 14px; border-radius: 14px; background: var(--ui-surface-raised); }
.mg-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.mg-status { font-size: 12.5px; line-height: 1.45; color: var(--ui-text-secondary); min-height: 1.45em; }
.mg-ring { position: fixed; width: 72px; height: 72px; margin: -36px; border-radius: 50%; z-index: 2147483000;
  box-shadow: inset 0 0 0 3px var(--ui-text); pointer-events: none; }
.mg-ring i { position: absolute; inset: 10px; border-radius: 50%; background: var(--ui-accent); transform: scale(0); }
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

function magnetic(data: MagneticData = {}, attrs: Record<string, string> = {}): UiMagnetic {
  const m = document.createElement('ui-magnetic');
  for (const [k, v] of Object.entries(attrs)) m.setAttribute(k, v);
  m.data = data;
  return m;
}

function stage(note: string, ...kids: HTMLElement[]): HTMLElement {
  const wrap = el('div', 'mg-wrap');
  const style = el('style');
  style.textContent = DEMO_CSS;
  wrap.append(style, ...kids, el('p', 'mg-note', note));
  return wrap;
}

/** The dashboard's app bar and page title, every piece marked data-magnetic. */
function appBar(): HTMLElement {
  const m = magnetic();
  const bar = el('div', 'mg-bar');
  const row = el('nav', 'mg-bar-row');
  row.setAttribute('aria-label', 'Main');
  const brand = el('span', 'mg-brand');
  brand.dataset.magnetic = '';
  brand.innerHTML = `${icon('brand', { size: 18 })}<span>soma-work</span>`;
  row.append(brand);
  for (const [i, label] of ['Board', 'Runs', 'Memory', 'Settings'].entries()) {
    const b = el('button', 'mg-pill', label);
    b.type = 'button';
    b.dataset.magnetic = '';
    if (i === 0) b.setAttribute('aria-current', 'page');
    row.append(b);
  }
  row.append(el('span', 'mg-spacer'));
  const cta = el('button', 'mg-btn', 'New run');
  cta.type = 'button';
  cta.dataset.magnetic = '';
  row.append(cta);
  const title = el('h2', 'mg-title', 'Board');
  title.dataset.magnetic = '';
  const sub = el('p', 'mg-sub', '3 agents working · 12 runs today');
  sub.dataset.magnetic = '';
  bar.append(row, title, sub);
  m.append(bar);
  return stage(
    'Press and hold just beside the bar — like a magnet beside a phone — and move: the pieces lean toward it. Let go and they spring back.',
    m,
  );
}

/** Library chips that knock into one another and rest against the edge. */
function chips(): HTMLElement {
  const m = magnetic();
  const box = el('div', 'mg-chips');
  const tags: Array<[string, string]> = [
    ['claude-opus', 'var(--ui-purple)'],
    ['deploy-agent', 'var(--ui-st-run)'],
    ['retry-policy', 'var(--ui-st-wait)'],
    ['tests passing', 'var(--ui-st-done)'],
    ['memory', 'var(--ui-accent)'],
    ['schedules', 'var(--ui-orange)'],
    ['tool calls', 'var(--ui-st-run)'],
    ['approvals', 'var(--ui-st-fail)'],
  ];
  for (const [label, c] of tags) {
    const chip = el('span', 'mg-chip');
    chip.dataset.magnetic = '';
    chip.style.setProperty('--c', c);
    chip.append(el('i'), label);
    box.append(chip);
  }
  m.append(box);
  return stage('Hold the pointer inside the box near one edge: the chips crowd toward it, collide and tilt.', m);
}

/** A real magnet through the Magnet Bridge app: the host's own Connect and Calibrate buttons, its own status line. */
function bridge(): HTMLElement {
  const m = magnetic();
  const panel = el('div', 'mg-panel');
  const actions = el('div', 'mg-actions');
  const connect = el('button', 'mg-btn', 'Connect magnet');
  connect.type = 'button';
  connect.dataset.magnetic = '';
  const cal = el('button', 'mg-btn is-quiet', 'Calibrate');
  cal.type = 'button';
  cal.disabled = true;
  cal.dataset.magnetic = '';
  const leave = el('button', 'mg-btn is-quiet', 'Disconnect');
  leave.type = 'button';
  leave.disabled = true;
  actions.append(connect, cal, leave);
  const status = el(
    'div',
    'mg-status',
    'Android with the Magnet Bridge app: tap Start bridge on the phone, then Connect.',
  );
  status.setAttribute('aria-hidden', 'true');
  const gestures = el('div', 'mg-status');
  gestures.setAttribute('aria-hidden', 'true');
  panel.append(actions, status, gestures);
  m.append(panel);
  // Connecting is the person's own act: a click, never on load.
  connect.addEventListener('click', () => {
    void m.connect();
  });
  leave.addEventListener('click', () => m.disconnect());
  m.addEventListener('ui-bridge-change', (e) => {
    const d = (e as CustomEvent<MagnetBridgeChange>).detail;
    const open = d.state === 'open';
    connect.disabled = d.state === 'connecting' || open;
    cal.disabled = !open;
    leave.disabled = !open;
    status.textContent =
      d.state === 'connecting'
        ? 'Connecting to Magnet Bridge…'
        : open
          ? `Connected${d.device ? ` to ${d.device}` : ''}. ${d.calibrated ? 'Hold the magnet beside the phone.' : 'Calibrate once.'}`
          : d.state === 'error'
            ? 'Couldn’t reach Magnet Bridge. Open the app on the phone, tap Start bridge, then try again.'
            : 'Disconnected. The pointer plays the magnet again.';
  });
  m.addEventListener('ui-magnet-gesture', (e) => {
    gestures.textContent = `Gesture: ${(e as CustomEvent<MagnetGestureDetail>).detail.g}`;
  });
  let ring: HTMLElement | null = null;
  m.addEventListener('ui-calibration', (e) => {
    const s = (e as CustomEvent<CalibrationState>).detail;
    if (s.phase === 'spot' && s.spot) {
      if (!ring) {
        ring = el('div', 'mg-ring');
        ring.append(el('i'));
        document.body.append(ring);
      }
      ring.style.left = `${s.spot.x}px`;
      ring.style.top = `${s.spot.y}px`;
      (ring.firstElementChild as HTMLElement).style.transform = `scale(${s.progress.toFixed(3)})`;
    } else if (s.phase !== 'zeroing') {
      ring?.remove();
      ring = null;
    }
  });
  cal.addEventListener('click', () => {
    m.calibrate();
  });
  return stage(
    'On a desktop the pointer plays the magnet. With the Magnet Bridge app on an Android phone, Connect reads a real one — the model runs in the app, nothing is downloaded here.',
    m,
  );
}

/** Reduced motion: the pull is off; the markup is untouched. */
function still(): HTMLElement {
  const m = magnetic({}, { motion: 'reduce' });
  const box = el('div', 'mg-chips');
  for (const label of ['Board', 'Runs', 'Memory', 'Settings']) {
    const chip = el('span', 'mg-chip');
    chip.dataset.magnetic = '';
    chip.append(el('i'), label);
    box.append(chip);
  }
  m.append(box);
  return stage('motion="reduce" (or the system setting): nothing is pulled — press and hold all you like.', m);
}

export const doc: ComponentDoc = {
  slug: 'magnetic',
  name: 'Magnetic',
  tag: 'ui-magnetic',
  summary:
    'Is something near? — the interface leans toward a magnet held beside the phone (or the pointer on a desktop) and springs back when it leaves.',
  description:
    'Magnetic UI, from Libraries.dev’s MagnetKit. Mark the pieces of your own markup with `data-magnetic` and wrap them in `<ui-magnetic>`: each becomes a small rigid body on a stiff damped string to its place, pulled by its nearest point toward the magnet (1/d³, capped, so it also tilts), knocking into its neighbours and resting against the edge, then springing home when the magnet leaves. On a desktop the pointer plays the magnet — press and hold beside the element (or on it), move, let go. With the Magnet Bridge app on an Android phone, the host’s own Connect button calls `connect()` and a real magnet takes over; the magnet model runs inside the app (its licence forbids shipping it), so nothing here loads a model. Bridge state, gestures and calibration steps leave as events; calibration is headless — draw the rings yourself from `ui-calibration`.',
  usedIn:
    'Not yet in the dashboard — a playful option for the app bar on a phone, or a demo surface for the Magnet Bridge.',
  reference: { name: 'Libraries.dev — Magnetic UI (magnetkit)', url: 'https://libraries.dev/magnetic' },
  group: 'Effects',
  props: [
    {
      name: 'selector',
      type: 'attribute / data.selector: string',
      default: '"[data-magnetic]"',
      description: 'Which elements inside move. An inline one becomes inline-block (so it can turn), and back after.',
    },
    {
      name: 'pointer',
      type: 'attribute "off" / data.pointer: boolean',
      default: 'true',
      description:
        'The pointer plays the magnet: press and hold within ~320px of the element, move, release. An open bridge takes over.',
    },
    {
      name: 'disabled',
      type: 'boolean attribute / data.enabled: boolean',
      default: 'enabled',
      description: 'Nothing moves; the bridge still connects and reports.',
    },
    {
      name: 'stiffness / damping / force / reach',
      type: 'attribute or data: number',
      default: '150 / 21 / 30000 / 150',
      description:
        'MagneticField’s tuning: the strings’ spring (10 … 1000) and damping (1 … 200), the pull (0 … 200000) and its reach in px (10 … 1000).',
    },
    {
      name: 'motion',
      type: '"system" | "reduce" | "full"',
      default: '"system"',
      description: 'Reduced motion (the attribute, or the system setting under "system"): no pull at all.',
    },
    { name: 'lang', type: '"en" | "ko"', default: '"en"', description: 'The status line in Korean.' },
    {
      name: 'connect() / disconnect()',
      type: '() => Promise<boolean> / () => void',
      description:
        'Open / end the Magnet Bridge session (ws://127.0.0.1:47613 on the phone). Call connect() from a click: it never runs on its own.',
    },
    {
      name: 'calibrate(spots?) / zero()',
      type: '→ { promise: Promise<CalibrationFit | null>, cancel() } / () => void',
      description:
        'Headless calibration through the open bridge: hold the magnet still over five spots (fractions of the viewport); each step leaves as ui-calibration. zero() takes a new zero on the phone.',
    },
    {
      name: 'bridge / bridgeState / field / options / running',
      type: 'MagnetBridge / BridgeState / MagneticField / MagneticOptions / boolean (read-only)',
      description:
        'The bridge client (addFrameListener for every reading), its state, the physics, what it pulls with now, and whether the loop is scheduled.',
    },
    {
      name: 'MagneticField · fitCalibration · runCalibration · pointerFrame · parseFrame · parseGesture · bridgeMessage',
      type: 'helpers',
      description:
        'The physics on its own (for canvas or anything else), the dipole fit, the transport-free calibration, the pointer’s frame and the app’s message parsers.',
    },
  ],
  events: [
    {
      name: 'ui-bridge-change',
      detail:
        "{ state: 'idle' | 'connecting' | 'open' | 'closed' | 'error'; device: string; version: number; calibrated: boolean }",
      description: 'The bridge connected, failed, closed, said hello or learned the magnet. Not cancelable.',
    },
    {
      name: 'ui-magnet-gesture',
      detail:
        "{ g: 'tap'; at: Pt | null; client?: Pt | null } | { g: 'push' | 'pullAway'; speed } | { g: 'swipe'; dir; speed }",
      description:
        'An air tap, push, pull-away or swipe from the app (tap positions: screen dp, and client px in client).',
    },
    {
      name: 'ui-calibration',
      detail:
        "{ phase: 'zeroing' | 'spot' | 'done' | 'failed' | 'cancelled'; index; total; spot: Pt | null; progress; field; zeroing; fit }",
      description: 'Each calibration step: draw the ring at spot (client px), filled by progress.',
    },
  ],
  keyboard: [['Your own keys', 'The moved elements are yours, with their own keyboard; the pull never takes focus.']],
  a11y: [
    'The pull is decorative: the moved elements keep their roles, names and focus — only a transform is written on them while they move, cleared when they rest.',
    'A visually hidden role="status" line says what the bridge is doing (connecting, connected, calibrate once, couldn’t reach it, disconnected) and each calibration step — in Korean with lang="ko".',
    'Reduced motion (prefers-reduced-motion, or motion="reduce"): no pull at all; the bridge still connects and gestures still arrive.',
    'Nothing connects on its own: the host’s button calls connect() (Chrome asks once about local network access). No model is shipped or downloaded — it runs in the Magnet Bridge app.',
    'No idle CPU: the loop runs only while the pointer is held (within reach), a magnet is near or a body is still settling, and stops off screen and in a hidden tab.',
  ],
  usage: `<ui-magnetic>
  <nav>
    <a data-magnetic href="/">Board</a>
    <a data-magnetic href="/runs">Runs</a>
  </nav>
  <button id="connect">Connect magnet</button>
</ui-magnetic>
<script type="module">
  import '@2lab.ai/ui/magnetic';
  const m = document.querySelector('ui-magnetic');
  // A desktop: press and hold beside it. A phone with the Magnet Bridge app: connect from a click.
  connectButton.onclick = () => m.connect();
  m.addEventListener('ui-bridge-change', (e) => console.log(e.detail.state));
  m.addEventListener('ui-magnet-gesture', (e) => { if (e.detail.g === 'tap') openMenu(); });
</script>`,
  demos: [
    { id: 'app-bar', title: 'The app bar leans toward the magnet', height: 300, create: appBar },
    { id: 'chips', title: 'Chips that knock and tilt', height: 320, create: chips },
    { id: 'bridge', title: 'A real magnet through Magnet Bridge', height: 300, create: bridge },
    { id: 'reduced', title: 'Reduced motion: no pull', height: 280, create: still },
  ],
};
