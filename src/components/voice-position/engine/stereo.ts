/**
 * A side estimate from a stereo microphone — for hosts that have one and no detector of their own.
 *
 * This is an ESTIMATE, not the Voice position model. Libraries.dev's model (`VoicePosition.mfxl`, iOS, under the
 * Libraries.dev Model License) reads per-band level and phase differences between the iPhone's two built-in mics and
 * is not shipped or downloaded here. What this does is the simplest of the cues that model was trained on, the
 * broad one its calibration reads (`DirectionCues.level` in VoiceRingKit's `Stereo.swift`, MIT): the level difference
 * between the channels over 1–4 kHz, where a head or a phone's body shadows the far microphone. It works with a real
 * stereo pair (a USB or headset array, two spaced mics), and only roughly: rooms reflect, many laptop "stereo" mics
 * are one capsule duplicated (it then reads front), and it says nothing about distance. Feed its result to
 * `<ui-voice-position>` as `side` / `sideConfidence`, or bring your own detector.
 *
 * Open the stream yourself, asking for two channels:
 * `getUserMedia({ audio: { channelCount: 2, echoCancellation: false, noiseSuppression: false, autoGainControl: false } })`.
 */
import { acquireSource, clamp01 } from '../../voice-glow/engine/audio';

export type VoiceSide = 'left' | 'front' | 'right';

export interface SideEstimate {
  /** The side the levels point to: 'front' inside the dead band. */
  side: VoiceSide;
  /** −1 left … 1 right: tanh of the level difference over `full` dB. */
  pan: number;
  /** How sure the estimate is, 0.5 … 1 — how far past (or how deep inside) the dead band the difference is. */
  confidence: number;
  /** The level difference, right over left, dB (positive: the right is louder). */
  ild: number;
}

export interface SideOptions {
  /** Inside ± this many dB the voice reads as front. @default 1.5 */
  deadband?: number;
  /** The difference, dB, that reads as fully to one side. @default 8 */
  full?: number;
  /** Below this level on both channels there is no voice to place: null. @default 0.002 */
  floor?: number;
}

const EPS = 1e-9;

/**
 * Estimate the side from the two channels' levels (linear amplitudes — RMS, or the square root of band power). Pure.
 * Null when both are under `floor` (silence has no side) or either is not a finite, non-negative number.
 */
export function estimateSide(left: number, right: number, options: SideOptions = {}): SideEstimate | null {
  if (!(Number.isFinite(left) && Number.isFinite(right)) || left < 0 || right < 0) return null;
  const deadband = Math.max(0, options.deadband ?? 1.5);
  const full = Math.max(deadband + 0.5, options.full ?? 8);
  const floor = Math.max(0, options.floor ?? 0.002);
  if (Math.max(left, right) < floor) return null;
  const ild = 20 * Math.log10((right + EPS) / (left + EPS));
  const pan = Math.tanh(ild / full);
  const off = Math.abs(ild);
  if (off < deadband) {
    return { side: 'front', pan, confidence: 0.5 + 0.5 * (deadband ? 1 - off / deadband : 1), ild };
  }
  return {
    side: ild > 0 ? 'right' : 'left',
    pan,
    confidence: 0.5 + 0.5 * clamp01((off - deadband) / (full - deadband)),
    ild,
  };
}

/**
 * Mean linear power of float frequency bins (dBFS, as `getFloatFrequencyData` gives them) between `lo` and `hi` Hz.
 * Pure; 0 for nothing to read.
 */
export function bandPower(db: ArrayLike<number>, binHz: number, lo: number, hi: number): number {
  if (!db.length || !(binHz > 0)) return 0;
  const from = Math.max(0, Math.min(db.length - 1, Math.floor(lo / binHz)));
  const to = Math.max(from, Math.min(db.length - 1, Math.ceil(hi / binHz)));
  let acc = 0;
  for (let i = from; i <= to; i++) {
    const v = db[i];
    if (Number.isFinite(v)) acc += 10 ** (v / 10);
  }
  return acc / (to - from + 1);
}

export interface StereoSideReader {
  /** The estimate now (the level difference eased over ~0.3 s), or null in silence or on a mono input. */
  read(): SideEstimate | null;
  /** Disconnect the splitter and analysers; the shared context closes with the last lease. Never stops tracks. */
  release(): void;
}

export interface StereoSideOptions extends SideOptions {
  /** The band the level difference is measured over, Hz. @default [1000, 4000] */
  band?: [number, number];
  /** Seconds the level difference is eased over. @default 0.3 */
  smoothing?: number;
}

/**
 * Open a side reader on a stereo stream the host opened: its shared source → a ChannelSplitter → one analyser per
 * channel. Null without Web Audio or without an audio track. Call `read()` from your own frame loop.
 */
export function createStereoSide(
  stream: MediaStream | null | undefined,
  options: StereoSideOptions = {},
): StereoSideReader | null {
  const source = acquireSource(stream);
  if (!source) return null;
  const ctx = source.context;
  let splitter: ChannelSplitterNode;
  let left: AnalyserNode;
  let right: AnalyserNode;
  try {
    splitter = ctx.createChannelSplitter(2);
    left = ctx.createAnalyser();
    right = ctx.createAnalyser();
    for (const a of [left, right]) {
      a.fftSize = 2048;
      a.smoothingTimeConstant = 0.6;
    }
    source.node.connect(splitter);
    splitter.connect(left, 0);
    splitter.connect(right, 1);
  } catch {
    source.release();
    return null;
  }
  const [lo, hi] = options.band ?? [1000, 4000];
  const tau = Math.max(0.01, options.smoothing ?? 0.3);
  const bufL = new Float32Array(left.frequencyBinCount);
  const bufR = new Float32Array(right.frequencyBinCount);
  let eased: number | null = null;
  let last = 0;
  let released = false;
  return {
    read() {
      if (released) return null;
      left.getFloatFrequencyData(bufL);
      right.getFloatFrequencyData(bufR);
      const binHz = ctx.sampleRate / left.fftSize;
      const pl = bandPower(bufL, binHz, lo, hi);
      const pr = bandPower(bufR, binHz, lo, hi);
      // A mono input splits into one live channel and one silent one: no side to read.
      if ((pl > 0 && pr <= 1e-12) || (pr > 0 && pl <= 1e-12)) return null;
      const raw = estimateSide(Math.sqrt(pl), Math.sqrt(pr), options);
      if (!raw) {
        eased = null;
        return null;
      }
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const dt = last ? Math.min(0.5, (now - last) / 1000) : 0;
      last = now;
      eased = eased == null ? raw.ild : eased + (raw.ild - eased) * (1 - Math.exp(-dt / tau));
      // Re-read the eased difference through the same rule, as levels with that ratio.
      return estimateSide(1, 10 ** (eased / 20), { ...options, floor: 0 });
    },
    release() {
      if (released) return;
      released = true;
      try {
        source.node.disconnect(splitter);
      } catch {
        /* already gone */
      }
      for (const n of [left, right, splitter]) {
        try {
          n.disconnect();
        } catch {
          /* already gone */
        }
      }
      source.release();
    },
  };
}
