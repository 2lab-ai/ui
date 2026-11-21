import type { ComponentDoc } from '../../docs/types';
import { icon } from '../../icons/icons';
import { demoVoiceLevel } from '../voice-glow/engine/audio';
import './voice-ring';
import type { UiVoiceRing, VoiceRingData, VoiceRingState, VoiceRingType } from './voice-ring';

/** The demo voice, read every frame — a pure function of time, so every demo on the page agrees. */
const demoVoice =
  (offset = 0) =>
  () =>
    demoVoiceLevel(performance.now() / 1000 + offset);

function ring(data: VoiceRingData, attrs: Record<string, string> = {}): UiVoiceRing {
  const el = document.createElement('ui-voice-ring');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

function figure(el: HTMLElement, text: string): HTMLElement {
  const f = document.createElement('figure');
  f.style.cssText = 'margin:0;display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0';
  const cap = document.createElement('figcaption');
  cap.style.cssText = 'font-size:12px;color:var(--ui-text-tertiary);text-align:center';
  cap.textContent = text;
  f.append(el, cap);
  return f;
}

function grid(...kids: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText =
    'display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:18px;align-items:start;justify-items:center;padding:12px 0';
  box.append(...kids);
  return box;
}

function button(label: string, html: string, pressed = false): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = html;
  b.setAttribute('aria-label', label);
  b.setAttribute('aria-pressed', String(pressed));
  b.style.cssText =
    'display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:999px;border:1px solid var(--ui-border);background:var(--ui-surface);color:var(--ui-text-secondary);font:inherit;font-size:12.5px;cursor:pointer';
  return b;
}

/** A row of toggles where one is on. */
function choice<T extends string>(
  label: string,
  values: Array<[T, string]>,
  start: T,
  apply: (v: T) => void,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', label);
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
  for (const [v, text] of values) {
    const b = button(text, text, v === start);
    b.addEventListener('click', () => {
      for (const x of Array.from(wrap.children)) x.setAttribute('aria-pressed', String(x === b));
      apply(v);
    });
    wrap.append(b);
  }
  return wrap;
}

function column(...kids: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;padding:8px 0';
  box.append(...kids);
  return box;
}

/** The playground: type, state and source, as the library's page has them. */
function playground(): HTMLElement {
  const voice = demoVoice();
  const el = ring({ size: 240, level: voice });
  let stream: MediaStream | null = null;
  const note = document.createElement('span');
  note.setAttribute('role', 'status');
  note.style.cssText = 'font-size:12.5px;color:var(--ui-text-tertiary)';
  note.textContent = 'Demo voice';
  const mic = button('Use the microphone', `${icon('mic', { size: 14 })} Microphone`);
  mic.addEventListener('click', async () => {
    if (stream) {
      // The host opened the microphone, so the host stops it: the element never stops a track.
      for (const t of stream.getTracks()) t.stop();
      stream = null;
      el.stream = null;
      el.level = voice;
      mic.setAttribute('aria-pressed', 'false');
      note.textContent = 'Demo voice';
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      note.textContent = 'This browser can’t capture audio.';
      return;
    }
    note.textContent = 'Waiting for permission…';
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      el.stream = stream;
      mic.setAttribute('aria-pressed', 'true');
      note.textContent = 'Listening to the microphone.';
    } catch {
      note.textContent = 'Microphone blocked — allow it in the browser’s site settings.';
    }
  });
  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px';
  controls.append(
    choice<VoiceRingType>(
      'Type',
      [
        ['ring', 'Ring'],
        ['mono', 'Mono'],
      ],
      'ring',
      (v) => el.setAttribute('type', v),
    ),
    choice<VoiceRingState>(
      'State',
      [
        ['idle', 'Idle'],
        ['listening', 'Listening'],
        ['speaking', 'Speaking'],
        ['processing', 'Processing'],
      ],
      'listening',
      (v) => {
        el.state = v;
      },
    ),
  );
  const src = document.createElement('div');
  src.style.cssText = 'display:flex;align-items:center;gap:10px';
  src.append(mic, note);
  controls.append(src);
  return column(el, controls);
}

/** Emotion: the host's detector says how the voice sounds; the spectrum swings toward its colour. */
function emotion(): HTMLElement {
  const a = ring({ size: 170, level: demoVoice(1), emotion: 'positive' });
  const b = ring({ size: 170, level: demoVoice(1), emotion: 'positive', type: 'mono' });
  const pick = choice(
    'Emotion',
    [
      ['positive', 'Positive'],
      ['calm', 'Calm'],
      ['negative', 'Negative'],
      ['none', 'None'],
    ],
    'positive',
    (v) => {
      for (const el of [a, b]) el.data = { ...el.data, emotion: v === 'none' ? null : (v as 'positive') };
    },
  );
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;gap:28px;justify-content:center';
  row.append(figure(a, 'Ring'), figure(b, 'Mono'));
  return column(row, pick);
}

/** Lean: the ring leans toward where the voice comes from, up to the card's edge, and refracts into it. */
function lean(): HTMLElement {
  const card = document.createElement('div');
  card.style.cssText =
    'position:relative;width:min(100%,380px);height:250px;margin:0 auto;border-radius:18px;overflow:hidden;display:grid;place-items:center;background:var(--ui-surface-raised);border:1px solid var(--ui-border)';
  let dir = 0.8;
  const el = ring({ size: 170, level: demoVoice(2), directionBounds: card, directionMargin: 18, directionMove: 2.4 });
  el.direction = () => dir;
  card.append(el);
  const label = document.createElement('label');
  label.style.cssText = 'display:flex;align-items:center;gap:10px;font-size:12.5px;color:var(--ui-text-secondary)';
  const range = document.createElement('input');
  range.type = 'range';
  range.min = '-100';
  range.max = '100';
  range.value = '80';
  range.style.width = '200px';
  const said = document.createElement('span');
  said.setAttribute('aria-hidden', 'true');
  said.style.cssText = 'min-width:5ch;font-variant-numeric:tabular-nums';
  said.textContent = '+0.80';
  range.addEventListener('input', () => {
    dir = Number(range.value) / 100;
    said.textContent = `${dir >= 0 ? '+' : '−'}${Math.abs(dir).toFixed(2)}`;
  });
  label.append('Direction (left … right)', range, said);
  return column(card, label);
}

export const doc: ComponentDoc = {
  slug: 'voice-ring',
  name: 'Voice Ring',
  tag: 'ui-voice-ring',
  summary:
    'Whose turn is it, and is the assistant hearing me? — a ring of light that bends with the voice, spins while it thinks, takes the colour of the mood and leans toward the speaker.',
  description:
    'A few rings lean off the view axis and bundle into a glassy ribbon with a spectrum running round it; the voice bends every ring together like a skin, swells and brightens them, and sways the colours; `processing` spins the spectrum round like a loader and sweeps the highlight. `type="mono"` draws two loops of grey tube that a voice opens into a turning globe; the VoiceOrb types are here too (`orbit` particles, `sash` dotted lanes, `signal` wireframe, `swell` halftone clouds, `pixel` squares). An emotion the host detects washes through it (green, red, blue), and `direction` (−1 … 1) leans it toward the speaker, up to the edge of the screen or a bounding card, where a small WebGL 2 pass refracts it into the edge. Level in: `level` (a number or a getter), `stream` (a MediaStream the host opened — never requested, never stopped) or `analyser`. Ported from Libraries.dev’s Voice ring (voice-ring 0.2.0).',
  usedIn:
    'soma-work dashboard’s voice mode: the orb at the centre of a voice session — `state` follows the turn (listening while the person talks, speaking while the agent’s reply plays, processing while it thinks), fed by the composer’s microphone stream and the reply’s playback analyser.',
  reference: { name: 'Libraries.dev — Voice ring', url: 'https://libraries.dev/voice-ring' },
  group: 'Effects',
  props: [
    {
      name: 'type',
      type: 'attribute / data.type: "ring" | "mono" | "orbit" | "sash" | "signal" | "swell" | "pixel"',
      default: '"ring"',
      description:
        'ring — the glassy ribbon of light (the library’s VoiceRing default, the `aura` orb); mono — two loops of lit grey tube (`aura-mono`); and the five VoiceOrb types. `aura` / `aura-mono` are accepted too.',
    },
    {
      name: 'state',
      type: 'attribute / property / data.state: "idle" | "listening" | "speaking" | "processing"',
      default: '"listening"',
      description:
        'idle — sources ignored, a calm, very slow drift; listening and speaking — follow the source (they draw alike; the source is what differs); processing (`thinking` is accepted) — sources ignored, the type’s working motion. Changes ease, never cut.',
    },
    {
      name: 'size',
      type: 'attribute / data.size: number (px)',
      default: '160',
      description: 'Rendered size, 16 … 1024; designed at 200. Count knobs scale with it.',
    },
    {
      name: 'level',
      type: 'property / attribute / data.level: number | () => number',
      description: 'The level, 0–1, when no stream or analyser is attached; a getter is read every frame. Clamped.',
    },
    {
      name: 'stream',
      type: 'property / data.stream: MediaStream | null',
      description:
        'A stream the host opened (its own getUserMedia from a click). The element opens an analyser on it (shared with any other voice element on the same stream) only while it listens — `listening` or `speaking`; idle, processing and disconnect let it go — and never stops the tracks.',
    },
    {
      name: 'analyser',
      type: 'property / data.analyser: AnalyserNode | null',
      description: 'Any analyser the host already has — the reply’s playback, a WebRTC track. Wins over `level`.',
    },
    {
      name: 'emotion',
      type: 'attribute / data.emotion: "positive" | "negative" | "calm" | null',
      description:
        'A mood the host detected: its colour eases in, crossfades between moods and fades out on null. Override with data.emotionColors (hex or rgb).',
    },
    {
      name: 'direction',
      type: 'property / data.direction: number | () => number',
      description:
        'Where the voice comes from, −1 left … 1 right. While a voice is heard the ring leans that way — drifts, its near side drawn out and bulging — and settles back in silence (data.holdDirection keeps it leaning). data.directionMove · Pull · Deform · Squash · Lens · Stretch · Split · Blur · Bounce tune the gesture; data.directionMargin (32px) and data.directionBounds (an element) set where it stops.',
    },
    {
      name: 'data.sensitivity · threshold · attack · release · idle · calm · voiceSpeed · speed',
      type: 'number',
      default: '0.85 · 0.04 · 0.06 s · 0.32 s · 0.1 · 0.4 · 1 · 1',
      description:
        'Input gain, noise gate, rise and settle, breathing under the voice, the waiting pace, how much a voice speeds it up, and the clocks.',
    },
    {
      name: 'data.saturation · accent · gradientAngle · gradientSpin · neutral · colorBrightness · colorHue · gradientStart · gradientWidth',
      type: 'number / "green" | "red" | "blue"',
      default: '2 · null · 99 · 12 · 1 · 1.02 · 0 · 0.1 · 0.6',
      description:
        'Colourful mode for the ink types: a gradient from the neutral ink into the emotion’s (or the accent’s) colour.',
    },
    {
      name: 'data.color · dots · dotSize · opts · frame',
      type: 'string · number · number · object · function',
      description: 'An ink tint (hex or rgb), mark density and size, raw type knobs, and the geometry escape hatch.',
    },
    {
      name: 'data.hoverBend',
      type: 'boolean | number',
      default: 'false',
      description:
        'While idle or processing, the ring bends toward a nearby pointer like a membrane (true = 0.55). Desktop only; off with reduced motion.',
    },
    {
      name: 'paused',
      type: 'boolean attribute / property',
      description: 'Freezes on the current frame; no frames are drawn until it is lifted.',
    },
    {
      name: 'theme',
      type: 'attribute: "dark" | "light"',
      description:
        'Light ink on dark, dark ink on light. Without it: an ancestor’s data-theme, the page tokens, the OS.',
    },
    {
      name: 'motion',
      type: 'attribute: "system" | "reduce" | "full"',
      default: '"system"',
      description:
        'Reduced motion holds every clock: a still frame that still answers the voice; with nothing to listen to, one frame and no loop.',
    },
    {
      name: 'label · decorative',
      type: 'attribute / data',
      description:
        'The accessible name instead of the state’s word; or hide it from assistive tech when a readout beside it says the state.',
    },
    {
      name: 'data.onLevel / shownLevel',
      type: '(level) => void / number',
      description: 'The shaped level, every frame.',
    },
  ],
  events: [],
  keyboard: [['—', 'Not focusable: it is a picture of the conversation’s state, with a text equivalent.']],
  a11y: [
    'role="status" (polite) whose text is the state — Waiting · Listening · Speaking · Thinking (대기 중 · 듣는 중 · 말하는 중 · 생각하는 중 with lang="ko") — so a turn change is announced; the canvas is aria-hidden. `label` replaces the word; `decorative` hides it.',
    'Reduced motion (prefers-reduced-motion or motion="reduce"): no spin, sway, drift, bounce or hover bend — one still frame, redrawn only by the voice.',
    'No frames while paused, off screen (IntersectionObserver) or in a hidden tab; the WebGL 2 edge lens exists only while the ring presses on an edge and is released when the loop stops or the element leaves.',
    'It never requests the microphone: the host calls getUserMedia from its own click and owns the tracks.',
  ],
  usage: `<ui-voice-ring type="ring" state="listening" size="240"></ui-voice-ring>

<script type="module">
  import '@2lab.ai/ui';
  const ring = document.querySelector('ui-voice-ring');

  ring.level = () => meter.level;          // read every frame
  micButton.onclick = async () => {
    ring.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  };
  agent.on('thinking', () => (ring.state = 'processing'));
  agent.on('reply', (audio) => { ring.state = 'speaking'; ring.analyser = audio.analyser; });
  ring.data = { emotion: 'positive', direction: () => speakerSide };
</script>`,
  demos: [
    {
      id: 'states',
      title: 'Ring and mono',
      description:
        'Each type with a voice in it (listening and speaking look alike — the source differs) and at work (processing).',
      height: 300,
      create: () =>
        grid(
          figure(ring({ size: 150, level: demoVoice() }), 'Listening / Speaking'),
          figure(ring({ size: 150, state: 'processing' }), 'Processing'),
          figure(ring({ size: 150, type: 'mono', level: demoVoice(0.6) }), 'Mono: Listening / Speaking'),
          figure(ring({ size: 150, type: 'mono', state: 'processing' }), 'Mono: Processing'),
        ),
    },
    {
      id: 'playground',
      title: 'Playground',
      description:
        'Type, state and source. Microphone opens yours from this click (the host’s getUserMedia) and hands the stream over.',
      height: 420,
      create: playground,
    },
    {
      id: 'emotion',
      title: 'Emotion',
      description: 'The host’s mood detector says positive, calm or negative; the ring takes the colour.',
      height: 320,
      create: emotion,
    },
    {
      id: 'lean',
      title: 'Direction',
      description:
        'direction leans the ring toward the speaker, up to the card’s edge (directionBounds), where it refracts into it.',
      height: 340,
      create: lean,
    },
    {
      id: 'orbs',
      title: 'Orb types',
      description: 'The VoiceOrb types on the same engine: orbit, sash, signal, swell and pixel.',
      height: 280,
      create: () =>
        grid(
          ...(['orbit', 'sash', 'signal', 'swell', 'pixel'] as const).map((t, i) =>
            figure(ring({ size: 130, type: t, level: demoVoice(i * 0.7) }), t),
          ),
        ),
    },
    {
      id: 'ko',
      title: '한국어',
      description: 'lang="ko": the live region says 듣는 중 · 생각하는 중.',
      height: 260,
      create: () =>
        grid(
          figure(ring({ size: 150, level: demoVoice(3) }, { lang: 'ko' }), '듣는 중'),
          figure(ring({ size: 150, state: 'processing' }, { lang: 'ko' }), '생각하는 중'),
        ),
    },
  ],
};
