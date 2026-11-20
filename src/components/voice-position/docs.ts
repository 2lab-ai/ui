import type { ComponentDoc } from '../../docs/types';
import { icon } from '../../icons/icons';
import { demoVoiceLevel } from '../voice-glow/engine/audio';
import { createStereoSide, type StereoSideReader } from './engine/stereo';
import './voice-position';
import type { UiVoicePosition, VoiceDistance, VoicePositionData, VoiceSide } from './voice-position';

const demoVoice =
  (offset = 0) =>
  () =>
    demoVoiceLevel(performance.now() / 1000 + offset);

function tile(data: VoicePositionData, attrs: Record<string, string> = {}): UiVoicePosition {
  const el = document.createElement('ui-voice-position');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

function button(label: string, html: string, pressed?: boolean): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = html;
  b.setAttribute('aria-label', label);
  if (pressed !== undefined) b.setAttribute('aria-pressed', String(pressed));
  b.style.cssText =
    'display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:999px;border:1px solid var(--ui-border);background:var(--ui-surface);color:var(--ui-text-secondary);font:inherit;font-size:12.5px;cursor:pointer';
  return b;
}

function column(...kids: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px';
  box.append(...kids);
  return box;
}

// A speaker moves round the phone: close on the left, far off in front, close on the right, far off in front again —
// the page's scripted route. Its side is "detected" 0.7 s after it starts, its distance 1.25 s after.
const ROUTE: Array<{ side: VoiceSide; distance: VoiceDistance }> = [
  { side: 'left', distance: 'near' },
  { side: 'front', distance: 'far' },
  { side: 'right', distance: 'near' },
  { side: 'front', distance: 'far' },
];
const ANGLE: Record<VoiceSide, number> = { left: -62, front: 0, right: 58 };

/** The page's simulation: a voice from each place in turn, its side and then its distance detected a beat later. */
function simulated(lang = ''): HTMLElement {
  const el = tile({ level: demoVoice() }, lang ? { lang } : {});
  let turn = 0;
  const timers: number[] = [];
  const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
  const run = () => {
    if (!el.isConnected && turn > 0) {
      for (const t of timers) clearTimeout(t);
      return;
    }
    const step = ROUTE[turn % ROUTE.length];
    const jitter = (k: number) => 0.84 + ((turn * 37 + k * 13) % 11) / 100;
    el.data = { ...el.data, side: null, distance: null };
    later(700, () => {
      el.data = { ...el.data, side: step.side, sideConfidence: jitter(1), angle: ANGLE[step.side] + (turn % 3) - 1 };
    });
    later(1250, () => {
      el.data = { ...el.data, distance: step.distance, distanceConfidence: jitter(2) };
    });
    turn += 1;
    later(5600, run);
  };
  run();
  return el;
}

/** The host's own detector: whatever it says, the tile shows. */
function manual(): HTMLElement {
  const el = tile({
    level: demoVoice(2),
    side: 'right',
    distance: 'near',
    sideConfidence: 0.91,
    distanceConfidence: 0.78,
  });
  const row = (label: string, values: string[], start: string, apply: (v: string) => void) => {
    const wrap = document.createElement('div');
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', label);
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center';
    for (const v of values) {
      const b = button(v, v, v === start);
      b.addEventListener('click', () => {
        for (const x of Array.from(wrap.children)) x.setAttribute('aria-pressed', String(x === b));
        apply(v);
      });
      wrap.append(b);
    }
    return wrap;
  };
  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;flex-direction:column;gap:8px;align-items:center';
  controls.append(
    row('Side', ['left', 'front', 'right', 'none'], 'right', (v) => {
      el.data = {
        ...el.data,
        side: v === 'none' ? null : (v as VoiceSide),
        sideConfidence: v === 'front' ? 0.72 : 0.91,
      };
    }),
    row('Distance', ['near', 'far', 'none'], 'near', (v) => {
      el.data = { ...el.data, distance: v === 'none' ? null : (v as VoiceDistance), distanceConfidence: 0.78 };
    }),
  );
  return column(el, controls);
}

/** A stereo microphone, read with the plain level-difference estimate (not the model). */
function stereo(): HTMLElement {
  const el = tile({ level: 0 });
  let reader: StereoSideReader | null = null;
  let stream: MediaStream | null = null;
  let raf = 0;
  const note = document.createElement('p');
  note.setAttribute('role', 'status');
  note.style.cssText =
    'margin:0;max-width:420px;font-size:12.5px;line-height:1.45;color:var(--ui-text-tertiary);text-align:center';
  note.textContent =
    'With a stereo microphone (a USB or headset array), the side is estimated from the level difference between the channels over 1–4 kHz. It is an estimate, not the Voice position model.';
  const stop = () => {
    cancelAnimationFrame(raf);
    reader?.release();
    reader = null;
    // The host opened the microphone, so the host stops it.
    for (const t of stream?.getTracks() ?? []) t.stop();
    stream = null;
    el.stream = null;
  };
  const go = button('Use a stereo microphone', `${icon('mic', { size: 14 })} Stereo microphone`, false);
  go.addEventListener('click', async () => {
    if (stream) {
      stop();
      go.setAttribute('aria-pressed', 'false');
      el.data = { ...el.data, side: null };
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      note.textContent = 'This browser can’t capture audio.';
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 2, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch {
      note.textContent = 'Microphone blocked — allow it in the browser’s site settings.';
      return;
    }
    go.setAttribute('aria-pressed', 'true');
    el.stream = stream;
    reader = createStereoSide(stream);
    if (!reader) {
      note.textContent = 'This browser can’t analyse audio.';
      return;
    }
    note.textContent = 'Speak from one side, then the other.';
    const tick = () => {
      if (!el.isConnected) return stop();
      const est = reader?.read() ?? null;
      if (est) el.data = { ...el.data, side: est.side, sideConfidence: est.confidence };
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
  return column(el, go, note);
}

export const doc: ComponentDoc = {
  slug: 'voice-position',
  name: 'Voice Position',
  tag: 'ui-voice-position',
  summary:
    'Where is the voice coming from, and how far? — the voice ring leans toward the speaker (left, front, right), the bar grows when they are far, and a readout says the side and the distance and how sure each is.',
  description:
    'The Libraries.dev Voice position tile as an element: a voice screen with `<ui-voice-ring>` inside (composed, not copied — its lean is voice-ring’s), leaning toward the side the voice comes from and held there until the next reading; the composer bar under it grows for a far voice; a marker locks onto the source beside the screen with a signal line; and a readout gives DIRECTION and DISTANCE, each with a dotted confidence meter and a percentage, decoding into place as they change. It is data-driven: set `{ side, distance, sideConfidence, distanceConfidence }` from any detector. The on-device model behind the original (VoicePosition.mfxl, iOS, Libraries.dev Model License) is not shipped or downloaded; `createStereoSide()` is exported for hosts with a stereo microphone — a plain level-difference estimate, clearly not the model.',
  usedIn:
    'Not yet in the dashboard. Natural home: a voice session with several people in the room (a meeting-room client), beside the voice ring, fed by the client’s speaker detector.',
  reference: { name: 'Libraries.dev — Voice position', url: 'https://libraries.dev/voice-position' },
  group: 'Effects',
  props: [
    {
      name: 'data.side / side',
      type: '"left" | "front" | "right" | null',
      description:
        'Where the voice is (`ahead` / `center` read as front). null while detecting: the ring drifts home and the readout says Detecting.',
    },
    {
      name: 'data.distance / distance',
      type: '"near" | "far" | null',
      description:
        'Near — within reach, under ~70 cm; far — 70 cm or more (`small` / `large`, the model’s names, are accepted). A far voice grows the composer bar.',
    },
    {
      name: 'data.sideConfidence · distanceConfidence',
      type: 'number 0–1',
      default: '1 with a value, 0 without',
      description:
        'How sure each reading is: the meter’s 18 dots and the percentage. The lean is full at 1 and half-way at 0.',
    },
    {
      name: 'data.angle',
      type: 'number (degrees)',
      description: 'An angle to show beside the side, if the detector gives one (±180, shown as +58° / −62°).',
    },
    {
      name: 'level · stream (property or data)',
      type: 'number | () => number · MediaStream | null',
      description:
        'What the ring follows: a level (or a getter read every frame), or a stream the host opened — the ring opens its own analyser and never stops the tracks.',
    },
    {
      name: 'data.state · type · ring',
      type: 'VoiceRingState · "ring" | "mono" · VoiceRingData',
      description:
        'The ring’s state (listening), type (ring) and any other ring field (emotion, sensitivity, lean amounts …).',
    },
    {
      name: 'theme · motion · paused · lang',
      type: 'attributes',
      description:
        'Passed to the ring; motion="reduce" stops the signal line, the transitions and the decoding; paused holds everything.',
    },
    {
      name: 'createStereoSide(stream, options?)',
      type: '(MediaStream) => { read(): SideEstimate | null; release() } | null',
      description:
        'For a stereo microphone the host opened (channelCount: 2): source → ChannelSplitter → two analysers; read() gives { side, pan, confidence, ild } from the level difference over 1–4 kHz, eased over 0.3 s, or null in silence or on a mono input. An estimate, not the model. estimateSide(left, right) is its pure core.',
    },
  ],
  events: [],
  keyboard: [['—', 'Nothing to focus: the tile reports; it takes no input.']],
  a11y: [
    'One polite role="status" sentence is the text equivalent — “Voice from the left (86%); near, < 70 cm (74%).” / “왼쪽에서 들리는 목소리 (86%); 가까움, 70 cm 미만 (74%).” — said when the reading changes. The drawn stage and readout are aria-hidden; the ring inside is decorative.',
    'Reduced motion (prefers-reduced-motion or motion="reduce"): the signal line stands still, the bar and the marker jump instead of easing, values appear without decoding, and the ring holds its clocks.',
    'Off screen or in a hidden tab the ring stops drawing and the CSS loops pause.',
    'It never requests the microphone and never loads a model: the host supplies the readings (and, for the ring, the level or the stream it opened).',
  ],
  usage: `<ui-voice-position></ui-voice-position>

<script type="module">
  import '@2lab.ai/ui';
  import { createStereoSide } from '@2lab.ai/ui/voice-position';
  const tile = document.querySelector('ui-voice-position');

  // From your own detector:
  detector.on('reading', (r) => {
    tile.data = { side: r.side, distance: r.distance, sideConfidence: r.p, distanceConfidence: r.q };
  });

  // …or a plain estimate from a stereo microphone you opened:
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 2 } });
  tile.stream = stream;
  const side = createStereoSide(stream);
  (function loop() {
    const est = side?.read();
    if (est) tile.data = { ...tile.data, side: est.side, sideConfidence: est.confidence };
    requestAnimationFrame(loop);
  })();
</script>`,
  demos: [
    {
      id: 'simulated',
      title: 'Simulated speaker',
      description:
        'The page’s scripted route: a voice close on the left, far off in front, close on the right — its side detected 0.7 s after it starts, its distance 1.25 s after.',
      height: 440,
      create: () => simulated(),
    },
    {
      id: 'detector',
      title: 'Your detector',
      description:
        'Whatever the host’s detector says, the tile shows — the ring holds its side until the next reading.',
      height: 520,
      create: manual,
    },
    {
      id: 'stereo',
      title: 'Stereo estimate',
      description:
        'createStereoSide() on a stereo microphone the page opens from this click — the level difference between the channels, not the model.',
      height: 540,
      create: stereo,
    },
    { id: 'ko', title: '한국어', description: 'lang="ko".', height: 440, create: () => simulated('ko') },
  ],
};
