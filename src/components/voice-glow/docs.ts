import type { ComponentDoc } from '../../docs/types';
import { icon } from '../../icons/icons';
import './voice-glow';
import { demoVoiceLevel } from './engine/audio';
import { VOICE_GLOW_PALETTES } from './engine/styles';
import type { UiVoiceGlow, VoiceGlowData } from './voice-glow';

/** The demo voice, read every frame — a pure function of time, so every demo on the page agrees. */
const demoVoice =
  (offset = 0) =>
  () =>
    demoVoiceLevel(performance.now() / 1000 + offset);

function glow(data: VoiceGlowData, attrs: Record<string, string> = {}): UiVoiceGlow {
  const el = document.createElement('ui-voice-glow');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

function button(label: string, html: string, css = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.innerHTML = html;
  b.style.cssText = `display:inline-grid;place-items:center;min-width:32px;height:32px;padding:0 8px;border-radius:999px;border:1px solid var(--ui-border);background:var(--ui-surface);color:var(--ui-text-secondary);font:inherit;font-size:12.5px;cursor:pointer;${css}`;
  return b;
}

/** A chat input — a real field and real buttons, so it can be typed into while the glow runs; nothing is sent. */
function chatInput(placeholder = 'Listening…'): HTMLFormElement {
  const form = document.createElement('form');
  form.setAttribute('aria-label', 'Chat input');
  form.addEventListener('submit', (e) => e.preventDefault());
  form.style.cssText =
    'display:flex;flex-direction:column;gap:12px;padding:14px 14px 12px;border-radius:20px;background:var(--ui-surface-raised);border:1px solid var(--ui-border);box-sizing:border-box;width:100%';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
  input.setAttribute('aria-label', 'Message');
  input.autocomplete = 'off';
  input.style.cssText =
    'border:0;outline:0;background:transparent;color:var(--ui-text);font:inherit;font-size:14.5px;padding:4px 4px 0';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px';
  const right = document.createElement('div');
  right.style.cssText = 'display:flex;gap:6px';
  right.append(
    button('Agent', `Agent ${icon('chevron-down', { size: 12 })}`, 'gap:4px;grid-auto-flow:column'),
    button('Voice', icon('mic', { size: 15 })),
  );
  row.append(button('Add', icon('plus', { size: 15 })), right);
  form.append(input, row);
  return form;
}

/** A source switch under a demo: the demo voice, or the microphone — opened by this click, as a host would. */
function sourceBar(target: UiVoiceGlow): HTMLElement {
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:14px;font-size:12.5px';
  const voice = demoVoice();
  let stream: MediaStream | null = null;
  const note = document.createElement('span');
  note.setAttribute('role', 'status');
  note.style.cssText = 'color:var(--ui-text-tertiary)';
  const listen = button('Listening', 'Listening', 'padding:0 12px');
  listen.setAttribute('aria-pressed', 'true');
  listen.addEventListener('click', () => {
    target.listening = !target.listening;
    listen.setAttribute('aria-pressed', String(target.listening));
  });
  const mic = button(
    'Use the microphone',
    `${icon('mic', { size: 14 })} Microphone`,
    'gap:6px;grid-auto-flow:column;padding:0 12px',
  );
  mic.setAttribute('aria-pressed', 'false');
  mic.addEventListener('click', async () => {
    if (stream) {
      // The host opened the microphone, so the host closes it: the element never stops a track.
      for (const t of stream.getTracks()) t.stop();
      stream = null;
      target.stream = null;
      target.level = voice;
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
      target.stream = stream;
      target.listening = true;
      listen.setAttribute('aria-pressed', 'true');
      mic.setAttribute('aria-pressed', 'true');
      note.textContent = 'Listening to the microphone.';
    } catch {
      note.textContent = 'Microphone blocked — allow it in the browser’s site settings.';
    }
  });
  target.level = voice;
  note.textContent = 'Demo voice';
  bar.append(listen, mic, note);
  return bar;
}

function stage(width: number, ...kids: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = `width:100%;max-width:${width}px;margin:0 auto`;
  box.append(...kids);
  return box;
}

const TRANSCRIPT = 'Set a timer for ten minutes and remind me to water the plants'.split(' ');

/** The bottom of a voice screen: the prompt, the transcript arriving word by word as the demo voice speaks. */
function phone(): HTMLElement {
  const el = glow(
    { type: 'mobile', scale: 1.25 * 0.68, borderRadius: Math.round(66 * 0.68), level: demoVoice(4.5) },
    { listening: '' },
  );
  const screen = document.createElement('div');
  screen.style.cssText =
    'position:relative;width:273px;height:357px;border-radius:45px;background:var(--ui-surface-raised);border:1px solid var(--ui-border);box-sizing:border-box;overflow:hidden;font-size:15px';
  const text = document.createElement('p');
  text.style.cssText =
    'position:absolute;left:24px;right:24px;top:118px;margin:0;text-align:center;font-size:19px;line-height:1.35;color:var(--ui-text);transition:opacity .3s';
  text.textContent = 'How can I help you?';
  const row = document.createElement('div');
  row.style.cssText =
    'position:absolute;left:18px;right:18px;bottom:22px;display:flex;align-items:center;justify-content:space-between;color:var(--ui-text-secondary);font-size:12.5px';
  const agent = document.createElement('span');
  agent.textContent = 'Agent (auto)';
  const acts = document.createElement('div');
  acts.style.cssText = 'display:flex;gap:8px';
  acts.append(
    button('Voice', icon('mic', { size: 15 }), 'height:36px;min-width:36px'),
    button('Close', icon('close', { size: 15 }), 'height:36px;min-width:36px'),
  );
  row.append(agent, acts);
  screen.append(text, row);
  el.append(screen);
  // The transcript is paced by the level the glow shows, as the library's demo paces it.
  let words = 0;
  let lastWord = 0;
  let silentSince = performance.now();
  el.data = {
    ...el.data,
    onLevel: (level) => {
      const now = performance.now();
      if (level < 0.05) {
        if (now - silentSince > 2500 && words) {
          words = 0;
          text.textContent = 'How can I help you?';
        }
      } else silentSince = now;
      if (level > 0.22 && now - lastWord > 320 && words < TRANSCRIPT.length) {
        words += 1;
        lastWord = now;
        text.textContent = TRANSCRIPT.slice(0, words).join(' ');
      }
    },
  };
  const box = document.createElement('div');
  box.style.cssText = 'display:grid;place-items:center';
  el.style.width = '273px';
  box.append(el);
  return box;
}

/** A recording pill: mic, a live mm:ss counter, the stop button. */
function pill(): HTMLElement {
  const el = glow({ type: 'pill', borderRadius: 22, level: demoVoice(2), palette: 'ocean' }, { listening: '' });
  const p = document.createElement('div');
  p.style.cssText =
    'display:flex;align-items:center;gap:10px;width:150px;height:44px;padding:0 6px 0 14px;box-sizing:border-box;border-radius:22px;background:var(--ui-surface-raised);border:1px solid var(--ui-border);color:var(--ui-text);font-variant-numeric:tabular-nums;font-size:13px';
  const time = document.createElement('span');
  time.style.flex = '1';
  const start = performance.now();
  const tick = () => {
    const s = Math.floor((performance.now() - start) / 1000);
    time.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
  tick();
  const timer = setInterval(() => (el.isConnected ? tick() : clearInterval(timer)), 500);
  const mic = document.createElement('span');
  mic.innerHTML = icon('mic', { size: 15 });
  mic.style.cssText = 'display:inline-grid;color:var(--ui-text-secondary)';
  p.append(mic, time, button('Stop', icon('stop', { size: 13 }), 'height:32px;min-width:32px'));
  el.append(p);
  el.style.width = '150px';
  const box = document.createElement('div');
  box.style.cssText = 'display:grid;place-items:center;gap:14px';
  box.append(el);
  return box;
}

/** One glow, every palette and both looks, switched in place. */
function palettes(): HTMLElement {
  const el = glow({ level: demoVoice(1.5) }, { listening: '' });
  el.append(chatInput('Ask me anything…'));
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:14px';
  const pick = (group: string, values: readonly string[], apply: (v: string) => void) => {
    const wrap = document.createElement('div');
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', group);
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-right:10px';
    for (const [i, v] of values.entries()) {
      const b = button(v, v, 'padding:0 10px;text-transform:capitalize');
      b.setAttribute('aria-pressed', String(i === 0));
      b.addEventListener('click', () => {
        for (const x of Array.from(wrap.children)) x.setAttribute('aria-pressed', String(x === b));
        apply(v);
      });
      wrap.append(b);
    }
    bar.append(wrap);
  };
  pick('Palette', VOICE_GLOW_PALETTES, (v) => el.setAttribute('palette', v));
  pick('Look', ['glow', 'dither'], (v) => el.setAttribute('look', v));
  return stage(420, el, bar);
}

export const doc: ComponentDoc = {
  slug: 'voice-glow',
  name: 'Voice Glow',
  tag: 'ui-voice-glow',
  summary:
    'Is it hearing me? — a glow rises from the bottom of the chat input (or the phone screen) as the person speaks, and settles when they stop.',
  description:
    'Wraps the host’s own input, pill or screen and lights its bottom edge with seven soft lobes of colour — painted into the 1px edge, as light inside and as a blurred bloom. As the voice rises they grow, spread and drift sideways so every colour takes a turn at the centre, the glow’s ceiling bends upward under a band of light with red and blue fringes, and the glow beneath it shimmers. Level in, two ways: `level` (0–1, a number or a getter read every frame — a playback meter, a speech API’s volume) or `stream`, a MediaStream the host opened in its own click handler; the element never asks for the microphone and never stops the host’s tracks. `listening` fades it in and out. Three host presets (`type`: chat input, recording pill, phone screen), eight palettes, custom colours, and two looks: the glow, or the same glow dithered into small square pixels that a pointer can pull. Ported from Libraries.dev’s Voice (voice-glow 0.5.0).',
  usedIn:
    'soma-work dashboard’s composer: wrap the message box while voice input is on, with `stream` from the composer’s own microphone button — the person sees they are being heard before any transcript arrives.',
  reference: { name: 'Libraries.dev — Voice', url: 'https://libraries.dev/voice' },
  group: 'Effects',
  props: [
    {
      name: 'listening',
      type: 'boolean attribute / property / data.listening',
      default: 'false',
      description:
        'Whether the glow is on (the library’s `active`): on, it fades in (0.6 s) and follows the level; off, it fades out (0.5 s), the analyser closes and the frame loop stops.',
    },
    {
      name: 'level',
      type: 'property / attribute / data.level: number | () => number',
      default: '0',
      description:
        'The level, 0–1, when no stream is attached. A getter is read once per frame, so a host can hand over its own meter without setting anything per frame. Clamped to 0–1; anything else is 0.',
    },
    {
      name: 'stream',
      type: 'property / data.stream: MediaStream | null',
      description:
        'Audio to analyse (level plus low / mid / high bands); wins over `level`. Open it yourself (getUserMedia in a click handler, or a WebRTC peer’s track). The element never stops its tracks; its analyser (and the shared AudioContext, with the last one) closes on disconnect or when listening ends.',
    },
    {
      name: 'type',
      type: 'attribute / data.type: "default" | "pill" | "mobile"',
      default: '"default"',
      description:
        'Host preset: a ~350px chat input, a ~150×44 recording pill (glow pulled in, shallow bend), or the bottom of a phone screen (wider range, taller rise). Sets the geometry defaults; every field still wins.',
    },
    {
      name: 'look',
      type: 'attribute / data.look: "glow" | "dither"',
      default: '"glow"',
      description:
        'glow — coloured light: gradients, the band, the bloom. dither — the same glow sampled onto small square pixels by a 4×4 ordered dither, colours cut to a few levels; the pixels nearest the pointer fly to it and spring back (`pixelMagnet`).',
    },
    {
      name: 'palette',
      type: 'attribute / data.palette (or data.colorVariant)',
      default: '"colorful"',
      description:
        'colorful · mono · ocean · sunset · forest · candy · ice · gold — each with a dark and a light set. All but mono drift slowly through a hue cycle (`hueRange`, `hueDuration`; `staticColors` holds them).',
    },
    {
      name: 'data.colors / data.bandColors',
      type: 'string[] / { core?, above?, mid?, below? }',
      description:
        'Your own lobe colours (up to seven, centre first then the pairs outward) and the band’s ridge and fringes — hex or rgb(). A value that does not parse keeps its slot’s colour; nothing unparsed reaches the stylesheet.',
    },
    {
      name: 'theme',
      type: 'attribute: "dark" | "light"',
      description:
        'Pins the dark or light palette set. Without it: an ancestor’s data-theme, else the page tokens (the host’s text colour), else prefers-color-scheme.',
    },
    {
      name: 'motion',
      type: 'attribute: "system" | "reduce" | "full"',
      default: '"system"',
      description:
        'Reduced motion stops the breathing, the flow, the hue drift, the distortion and the magnet; the glow still answers the level (it is a meter), and it still fades in and out.',
    },
    {
      name: 'paused',
      type: 'boolean attribute / property / data.paused',
      description: 'Freezes the frame where it is without fading out; the loop stops once the held frame is painted.',
    },
    {
      name: 'data.sensitivity · threshold · attack · release · idle · breatheDuration',
      type: 'number',
      default: '3.1 · 0.015 · 0.325 s · 0.86 s · 0.18 · 5.2 s',
      description:
        'The response: input gain on the analysed audio, the noise gate, seconds to rise and to settle, the resting presence while silent (0 hides it between sounds) and its breathing period.',
    },
    {
      name: 'data.reach · spread · flow · bands · scale',
      type: 'number / boolean',
      default: '1.2 · 1.05 · 48 px/s · true · 1',
      description:
        'How tall and how wide it grows at full level, how fast the spectrum travels sideways (negative reverses, 0 holds), whether the low / mid / high bands move the lobes independently, and the size of the whole effect.',
    },
    {
      name: 'data.bend · band* · distortion · distortionDetail',
      type: 'number',
      default: '60 px · (see the library) · 0.62 · 2.3',
      description:
        'The ceiling’s hump at full level, the band of light along it (bandStrength, bandWidth, bandPosition, bandCurve, bandSpread, bandSkew, bandOffset, bandTail, bandTailPosition, bandTailCurve, bandTailOverflow, bandAberration), and the sideways warp of the glow under the band (an SVG displacement; off on WebKit for hosts over ~60,000 px²).',
    },
    {
      name: 'data.glowWidth · glowHeight · lobeSpacing · rangeWidth · rangeHeight · softness · coreSize · coreLight …',
      type: 'number',
      description:
        'The library’s shape multipliers, each defaulting to the tuned geometry of the type: lobe size and spacing, the visible ellipse, edge softness, the hot spot, the epicentre wash, and the per-layer sizes and opacities (strokeScale, innerScale, innerHeight, bloomScale, bloomHeight, strokeOpacity, innerOpacity, bloomOpacity, glowSize, brightness, saturation, strength).',
    },
    {
      name: 'data.pixelSize · pixelGlow · pixelDome · pixelMagnet · pixelDust · pixelExitTarget',
      type: 'number / HTMLElement',
      default: '1 · 0.6 · 0 · 0.7 · 1.1 s',
      description:
        'The dither: cell size, its own halo, how much lower the field stands toward the sides, how strongly the pixels nearest the pointer fly to it, how long a gathered beam’s trail lingers, and a button the pixels fly into as listening ends (and out of as it starts).',
    },
    {
      name: 'data.gather',
      type: '{ gather, offset?, stretch?, heldLevel?, cornerFollow? } | () => …',
      description:
        'The library’s `motion` prop (renamed: `motion` is the reduced-motion attribute here): the lobes gathered into one beam (0–1), where it sits, how much wider it runs while moving, the level it is held at, how much it rides the corner arcs. A getter is read every frame.',
    },
    {
      name: 'data.label',
      type: 'string',
      description: 'What the live region says while listening, instead of “Listening” / “듣는 중”.',
    },
    {
      name: 'data.onLevel / shownLevel',
      type: '(level: number) => void / read-only number',
      description: 'The smoothed level the glow shows, every frame — for a meter or for pacing a transcript.',
    },
    {
      name: 'CSS',
      type: '--voice-stroke-opacity · --voice-inner-opacity · --voice-bloom-opacity · --voice-band-opacity · --voice-hue-base · ::part(frame)',
      description:
        'Per-layer opacity hooks and a fixed hue shift, as the library had; the frame wrapping the slot is a part.',
    },
  ],
  events: [
    {
      name: 'ui-voice-activate',
      detail: '{ listening: true }',
      description: 'The fade-in finished (the library’s onActivate). Not cancelable.',
    },
    {
      name: 'ui-voice-deactivate',
      detail: '{ listening: false }',
      description: 'The fade-out finished and the loop stopped (the library’s onDeactivate). Not cancelable.',
    },
  ],
  keyboard: [['—', 'The glow takes no focus and no pointer; the wrapped input keeps its own keyboard.']],
  a11y: [
    'Every layer is decorative: aria-hidden canvases and empty boxes with pointer-events: none — the wrapped content keeps its semantics, focus and clicks.',
    'The meaningful state has a text equivalent: a polite role="status" says “Listening” (data.label to change it; “듣는 중” with lang="ko") while the glow is on, and nothing when it is off.',
    'Reduced motion (prefers-reduced-motion, or motion="reduce"): no breathing, flow, hue drift, distortion or magnet; the fade and the level response stay.',
    'No frames while off, paused and painted, off screen (IntersectionObserver) or in a hidden tab.',
    'It never requests the microphone: the host calls getUserMedia from its own click and owns the tracks.',
  ],
  usage: `<ui-voice-glow listening type="default">
  <form class="composer">…</form>
</ui-voice-glow>

<script type="module">
  import '@2lab.ai/ui';
  const glow = document.querySelector('ui-voice-glow');

  // Drive it yourself: a getter read every frame
  glow.level = () => player.level;

  // …or hand it a stream you opened from a click
  micButton.addEventListener('click', async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    glow.stream = stream;      // the element never stops these tracks
    glow.listening = true;
  });
  stopButton.addEventListener('click', () => {
    glow.listening = false;
    glow.stream?.getTracks().forEach((t) => t.stop());   // yours to stop
  });
</script>`,
  demos: [
    {
      id: 'chat',
      title: 'Chat input',
      description:
        'The chat input while voice input is on, spoken to by a synthetic voice. Microphone opens yours from this click (the host’s getUserMedia) and hands the stream over; Listening fades the glow in and out.',
      height: 300,
      create: () => {
        const el = glow({ type: 'default' }, { listening: '' });
        el.append(chatInput());
        return stage(400, el, sourceBar(el));
      },
    },
    {
      id: 'phone',
      title: 'Phone screen',
      description:
        'type="mobile" on the bottom of a voice screen: a wider range and a taller rise; the transcript is paced by the level the glow shows (data.onLevel).',
      height: 420,
      create: phone,
    },
    {
      id: 'dither',
      title: 'Dither',
      description:
        'look="dither": the same glow as small square pixels, on or off by an ordered dither of its brightness. Move the pointer over it — the nearest pixels fly to it and spring back.',
      height: 280,
      create: () => {
        const el = glow({ type: 'default', look: 'dither', level: demoVoice(3) }, { listening: '' });
        el.append(chatInput());
        return stage(400, el);
      },
    },
    {
      id: 'pill',
      title: 'Recording pill',
      description: 'type="pill" on a 150×44 recording pill, in the ocean palette.',
      height: 200,
      create: pill,
    },
    {
      id: 'palettes',
      title: 'Palettes and looks',
      description: 'The eight palettes and the two looks, switched in place on one running glow.',
      height: 320,
      create: palettes,
    },
    {
      id: 'ko',
      title: '한국어 · light',
      description:
        'lang="ko" (the live region says “듣는 중”) on a light surface: the light palette set and the epicentre wash.',
      height: 260,
      create: () => {
        const el = glow({ level: demoVoice(6) }, { listening: '', lang: 'ko', theme: 'light' });
        const form = chatInput('듣는 중…');
        form.style.background = '#ffffff';
        form.style.borderColor = 'rgba(0,0,0,0.08)';
        form.style.color = '#111';
        const input = form.querySelector('input');
        if (input) input.style.color = '#111';
        el.append(form);
        const box = document.createElement('div');
        box.setAttribute('data-theme', 'light');
        box.style.cssText = 'padding:24px;border-radius:16px;background:#f4f4f5';
        box.append(stage(400, el));
        return box;
      },
    },
  ],
};
