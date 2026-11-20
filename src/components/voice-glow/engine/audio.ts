/**
 * The microphone and level plumbing shared by `<ui-voice-glow>`, `<ui-voice-ring>` and `<ui-voice-position>` — one
 * place, imported by all three.
 *
 * Ported from Libraries.dev `voice-glow` 0.5.0 and `voice-ring` 0.2.0, `src/audio.ts` (identical in both; MIT,
 * © 2026 Jakub Antalik — https://libraries.dev/voice). One AudioContext for the page, one
 * MediaStreamAudioSourceNode per stream (reference-counted, so several elements can listen to the same microphone)
 * and one AnalyserNode per lease. Nothing is connected to the destination: the audio is analysed, never played.
 *
 * Changed in the port:
 * - The context is reference-counted too: created with the first lease and closed when the last one is released, so
 *   an element that is disconnected leaves no AudioContext running behind it.
 * - Nothing here asks for the microphone. The host calls `getUserMedia` in its own click handler and hands the
 *   stream over; the tracks stay the host's — nothing here ever stops them.
 * - The level shaping both libraries carried (gain, noise gate, soft saturation, a one-pole attack / release
 *   follower) lives here as pure functions.
 */

type AudioContextCtor = typeof AudioContext;

let context: AudioContext | null = null;
let holds = 0;

interface SharedSource {
  node: MediaStreamAudioSourceNode;
  refs: number;
}

let sources = new WeakMap<MediaStream, SharedSource>();

function audioCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function quietly(run: () => unknown): void {
  try {
    const out = run();
    if (out && typeof (out as Promise<unknown>).catch === 'function') (out as Promise<unknown>).catch(() => {});
  } catch {
    /* already gone, or refused outside a gesture: the next lease retries */
  }
}

/** True when this browser can analyse audio at all. */
export function isAudioSupported(): boolean {
  return audioCtor() != null;
}

/**
 * Hold the page's shared AudioContext, created on first need (and resumed: a context the browser suspended picks up
 * again). Every call must be paired with `releaseAudioContext()`; the last release closes it. Null without Web Audio.
 */
export function retainAudioContext(): AudioContext | null {
  const Ctor = audioCtor();
  if (!Ctor) return null;
  if (!context || context.state === 'closed') {
    try {
      context = new Ctor();
    } catch {
      return null;
    }
    sources = new WeakMap();
  }
  holds += 1;
  if (context.state === 'suspended') quietly(() => context?.resume());
  return context;
}

/** Let go of one hold on the shared context; the last one closes it. */
export function releaseAudioContext(): void {
  if (holds <= 0) return;
  holds -= 1;
  if (holds > 0 || !context) return;
  const closing = context;
  context = null;
  sources = new WeakMap();
  quietly(() => closing.close());
}

/** How many leases hold the shared context open now (0: none — no context is running). */
export function audioHolds(): number {
  return holds;
}

function hasAudio(stream: MediaStream | null | undefined): stream is MediaStream {
  if (!stream || typeof stream.getAudioTracks !== 'function') return false;
  try {
    return stream.getAudioTracks().length > 0;
  } catch {
    return false;
  }
}

export interface SourceLease {
  /** The stream's source node in the shared context (shared with every other lease on the same stream). */
  node: MediaStreamAudioSourceNode;
  context: AudioContext;
  /** Disconnects this lease; the last lease on the stream disconnects its node, the last overall closes the context. */
  release(): void;
}

/**
 * The shared source node for `stream`, and the function that lets it go. Null when the browser has no Web Audio or
 * the stream carries no audio track. The stream's tracks are never stopped: they belong to whoever opened them.
 */
export function acquireSource(stream: MediaStream | null | undefined): SourceLease | null {
  if (!hasAudio(stream)) return null;
  const ctx = retainAudioContext();
  if (!ctx) return null;
  let shared = sources.get(stream);
  if (!shared) {
    try {
      shared = { node: ctx.createMediaStreamSource(stream), refs: 0 };
    } catch {
      releaseAudioContext();
      return null;
    }
    sources.set(stream, shared);
  }
  shared.refs += 1;
  const own = shared;
  let released = false;
  return {
    node: own.node,
    context: ctx,
    release: () => {
      if (released) return;
      released = true;
      own.refs -= 1;
      if (own.refs <= 0) {
        quietly(() => own.node.disconnect());
        if (sources.get(stream) === own) sources.delete(stream);
      }
      releaseAudioContext();
    },
  };
}

export interface AnalyserLease {
  analyser: AnalyserNode;
  release(): void;
}

/**
 * An AnalyserNode fed by `stream`, plus the function that tears it down. 1024 bins at 48 kHz is ~47 Hz per bin:
 * fine enough to split the voice bands, cheap enough to read every frame; the elements run their own attack /
 * release, so the analyser's smoothing stays light. Null without Web Audio or without an audio track.
 */
export function acquireAnalyser(
  stream: MediaStream | null | undefined,
  fftSize = 1024,
  smoothing = 0.5,
): AnalyserLease | null {
  const source = acquireSource(stream);
  if (!source) return null;
  let analyser: AnalyserNode;
  try {
    analyser = source.context.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = smoothing;
    source.node.connect(analyser);
  } catch {
    source.release();
    return null;
  }
  let released = false;
  return {
    analyser,
    release: () => {
      if (released) return;
      released = true;
      quietly(() => source.node.disconnect(analyser));
      source.release();
    },
  };
}

// ── Level shaping (both libraries' `shape` and `follow`) ───────────────────────────────────────────────────────────

/** A level source: a plain number, or a getter sampled once per frame (so a host never re-renders per frame). */
export type VoiceLevelSource = number | (() => number);

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : Number.isNaN(v) ? 0 : v;
}

/** A level read from a number, a numeric string or a getter, clamped to 0 … 1; anything else (or a throw) is 0. */
export function readLevel(source: unknown): number {
  let v: unknown = source;
  if (typeof v === 'function') {
    try {
      v = (v as () => unknown)();
    } catch {
      return 0;
    }
  }
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? clamp01(n) : 0;
}

/** Noise gate then soft saturation, so a shout rounds off instead of clipping: 0 at or below `threshold`, 1 at full. */
export function shapeLevel(raw: number, threshold: number): number {
  if (!(raw > threshold)) return 0;
  const t = (raw - threshold) / Math.max(0.001, 1 - threshold);
  return clamp01((1 - Math.exp(-3 * t)) / (1 - Math.exp(-3)));
}

/** One-pole follower: fast up (`attack` s), slow down (`release` s). */
export function followLevel(prev: number, target: number, dt: number, attack: number, release: number): number {
  const tau = target > prev ? attack : release;
  return prev + (target - prev) * (1 - Math.exp(-Math.max(0, dt) / Math.max(0.001, tau)));
}

/** Root mean square of a block of samples (0 for an empty one). */
export function rms(samples: ArrayLike<number>): number {
  const n = samples.length;
  if (!n) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / n);
}

/** The mean of byte frequency bins between `lo` and `hi` Hz, 0 … 1 (`binHz` = sampleRate / fftSize). */
export function bandAverage(freq: ArrayLike<number>, binHz: number, lo: number, hi: number): number {
  if (!freq.length || !(binHz > 0)) return 0;
  const from = Math.max(0, Math.min(freq.length - 1, Math.floor(lo / binHz)));
  const to = Math.max(from, Math.min(freq.length - 1, Math.ceil(hi / binHz)));
  let acc = 0;
  for (let i = from; i <= to; i++) acc += freq[i];
  return acc / (to - from + 1) / 255;
}

/**
 * A synthetic voice for previews and tests, as the Libraries.dev pages drive their demos: syllables (~3 Hz) under
 * words (~0.55 Hz), a little roughness on top, and a pause at the end of each 9 s phrase. A pure function of time
 * (seconds), so every element driven by it agrees.
 */
export function demoVoiceLevel(t: number): number {
  const phrase = ((t % 9) + 9) % 9;
  if (phrase > 6.6) return 0;
  const syllable = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 3.1);
  const word = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 0.55 + 1);
  const rough = 0.86 + 0.14 * Math.sin(t * 23.7);
  const v = syllable ** 1.6 * (0.5 + 0.5 * word) * rough;
  return Math.min(1, v * 1.05);
}
