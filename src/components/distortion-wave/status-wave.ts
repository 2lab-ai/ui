import { prefersReducedMotion } from '../../core/element';
import { WaveController, type WaveOptions, type WaveStyleInput } from './engine/controller';
import { hexToRgb, PALETTES, type Palette, type RGB, singlePalette } from './engine/model';

/**
 * A status wave: one run of the distortion wave over a card whose status just changed, then gone (its canvas and
 * WebGL context released). `<ui-agent-inbox>` plays one for a card that carries `wave`; any host can call
 * `playStatusWave` for its own card.
 *
 * Two weights of one family — the same ring out of the status mark, in the new status's colour, in three beats (the
 * front crosses, colour stays on the edges, the edges clear outward from the mark):
 * - `loud` is an event: the ring gathers onto the mark, bends a picture of the card (the lens), throws dots and leaves
 *   the edges lit while the card glides to its new column. For a card that now needs someone, is done or runs again
 *   the colour is the status's own laced with the full spectrum; a failure stays in its red, serious rather than
 *   festive. 1.2–2.5 s.
 * - `quiet` is a glance: the ring in the status colour alone — no picture, no dots — over 1.1–1.4 s, the faintest for
 *   the most frequent change (→ running), none for a card put to sleep.
 * Lengths are CSS pixels (`scale: 1`). The research behind the numbers (salience by frequency and importance,
 * habituation, peripheral motion, WCAG 2.2.2) is summarised in the docs of `<ui-distortion-wave>`.
 */

export type WaveEmphasis = 'loud' | 'quiet';
export type StatusWaveStatus = 'waiting' | 'running' | 'done' | 'failed' | 'idle';

export interface StatusWaveRequest {
  /** The card: a positioned element the wave's canvas is laid over (and taken off again). */
  card: HTMLElement;
  /** Where the ring opens — the status mark. Default: the card's centre. */
  source?: Element | null;
  emphasis: WaveEmphasis;
  /** The status before, when known. */
  from?: StatusWaveStatus | '';
  to: StatusWaveStatus;
  /** The new status's colour (`#rrggbb`). Default: the card's `--st-color`, read from its computed style. */
  tone?: string;
  /** The card is folded to one line: a thin edge, no picture, no dots. */
  folded?: boolean;
  /** Picture the card for the lens. Default: the preset's. */
  capture?: boolean;
  /** `reduce`: no wave at all (the host shows a still cue). Default `system`. */
  motion?: 'system' | 'reduce' | 'full';
  /** Called once the run is over (finished, cancelled or replaced). */
  onDone?: () => void;
  /** Over the preset: any wave option, its `waveStyle` merged number by number (a host's own tuning). */
  options?: Partial<WaveOptions>;
}

export interface StatusWaveRun {
  readonly card: HTMLElement;
  readonly emphasis: WaveEmphasis;
  /** Ends the run now and removes its canvas. */
  cancel(): void;
}

/** One cell of the matrix: whether the card is pictured, the wave's numbers, and how it is coloured. */
export interface StatusWavePreset {
  capture: boolean;
  style: WaveStyleInput;
  /** `tone`: the status colour alone · `spectrum`: the status colour laced with the full spectrum. */
  colour: 'tone' | 'spectrum';
}

/** At most this many status waves run on a page at once (each holds a WebGL context; browsers allow ~16)… */
export const STATUS_WAVE_MAX = 4;
/** …of which at most this many loud. */
export const STATUS_WAVE_LOUD_MAX = 2;

/** How much a transition is worth, 0 … 1 — the order waves are kept in when there are too many. */
export function transitionWeight(from: StatusWaveStatus | '' | undefined, to: StatusWaveStatus): number {
  if (to === 'waiting') return 1;
  if (to === 'failed') return 0.9;
  if (to === 'done') return from === 'running' || from === 'waiting' ? 0.8 : 0.6;
  if (to === 'running') return from === 'waiting' ? 0.55 : 0.4;
  return 0.25; // idle: parked
}

/** Shared by every cell: the family. Lengths in CSS px. */
const FAMILY: WaveStyleInput = {
  launchGap: 0,
  orientation: 0,
  swell: 6,
  lead: 44,
  tail: 100,
  rimSoftness: 110,
  hairlineWidth: 1,
};
const LOUD: WaveStyleInput = {
  ...FAMILY,
  anticipation: 0.3,
  travel: 1.4,
  pull: 6,
  inhale: 14,
  gatherGlow: 0.35,
  gatherDots: 1,
  amplitude: 12,
  lensWidth: 54,
  aberration: 0.45,
  blur: 4,
  blurAhead: 24,
  blurBehind: 60,
  strength: 0.6,
  rimWidth: 7,
  rimUnevenness: 1,
  rimStrength: 0.8,
  rimPulse: 0.6,
  hairlineOpacity: 0.8,
  hairlineLinger: 0.3,
  hairlineFade: 1.1,
  linger: 0.5,
  rimFade: 1.3,
  particleCount: 36,
  particleSize: 1.6,
  particleReach: 54,
  particleFlight: 11,
  particleGap: 7,
  particleLife: 1.8,
  particleSpread: 0.64,
};
const QUIET: WaveStyleInput = {
  ...FAMILY,
  anticipation: 0,
  travel: 1.2,
  pull: 0,
  inhale: 0,
  gatherGlow: 0,
  gatherDots: 0,
  amplitude: 0,
  aberration: 0,
  blur: 0,
  strength: 0.3,
  rimWidth: 4,
  rimUnevenness: 0.6,
  rimStrength: 0.35,
  rimPulse: 0.3,
  hairlineOpacity: 0.5,
  hairlineLinger: 0.2,
  hairlineFade: 1,
  linger: 0.2,
  rimFade: 1.2,
  particleCount: 0,
  // particleLife counts in duration() even with no dots: a quiet wave would last 3.9 s.
  particleLife: 0,
};
const QUIET_LOW: WaveStyleInput = {
  ...QUIET,
  strength: 0.22,
  rimStrength: 0.25,
  hairlineOpacity: 0.35,
  linger: 0.1,
  rimFade: 1,
  hairlineLinger: 0.1,
  hairlineFade: 0.9,
};

/** The matrix: emphasis × the status the card moved to. null = no wave. */
export const STATUS_WAVES: Readonly<Record<WaveEmphasis, Readonly<Record<StatusWaveStatus, StatusWavePreset | null>>>> =
  {
    loud: {
      // Needs someone: the edge holds longest, so the card lands in NEEDS YOU still lit.
      waiting: { capture: true, colour: 'spectrum', style: { ...LOUD, linger: 0.7 } },
      // Serious, not festive: no colour split, no dots, no sparkle.
      failed: {
        capture: true,
        colour: 'tone',
        style: {
          ...LOUD,
          anticipation: 0.2,
          amplitude: 10,
          aberration: 0,
          gatherDots: 0,
          particleCount: 0,
          particleLife: 0,
        },
      },
      // The celebration: the most dots, the split colour, the longest edge.
      done: {
        capture: true,
        colour: 'spectrum',
        style: {
          ...LOUD,
          aberration: 0.55,
          linger: 0.6,
          rimFade: 1.4,
          hairlineFade: 1.2,
          particleCount: 48,
          particleLife: 2.2,
        },
      },
      // The most frequent change, even for the loud tier: colour and a few dots, no lens, no gather.
      running: {
        capture: false,
        colour: 'spectrum',
        style: {
          ...LOUD,
          anticipation: 0,
          travel: 1.2,
          pull: 0,
          inhale: 0,
          gatherGlow: 0,
          gatherDots: 0,
          strength: 0.45,
          rimWidth: 5,
          rimStrength: 0.5,
          hairlineOpacity: 0.6,
          linger: 0.2,
          rimFade: 1,
          hairlineLinger: 0.1,
          hairlineFade: 0.9,
          particleCount: 16,
          particleLife: 1.1,
        },
      },
      idle: { capture: false, colour: 'tone', style: { ...QUIET_LOW, strength: 0.2 } },
    },
    quiet: {
      waiting: { capture: false, colour: 'tone', style: { ...QUIET, strength: 0.34, rimStrength: 0.4 } },
      failed: { capture: false, colour: 'tone', style: { ...QUIET, strength: 0.34, rimStrength: 0.4 } },
      done: { capture: false, colour: 'tone', style: QUIET_LOW },
      running: {
        capture: false,
        colour: 'tone',
        style: { ...QUIET_LOW, strength: 0.18, rimStrength: 0.2, hairlineOpacity: 0.3 },
      },
      idle: null,
    },
  };

const STATUS_HEX: Record<StatusWaveStatus, string> = {
  waiting: '#f5a524',
  running: '#6b93f2',
  done: '#3fb968',
  failed: '#f26b6b',
  idle: '#93939b',
};

/** `#rrggbb` for a CSS colour string (`#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()` / `rgba()`), or null. */
export function cssColorHex(v: string | null | undefined): string | null {
  const s = (v ?? '').trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) return `#${m[1].replace(/./g, (c) => c + c)}`;
  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(s);
  if (m) return `#${m[1]}`;
  m = /^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)/.exec(s);
  if (m) {
    const hex = (n: string) =>
      Math.max(0, Math.min(255, Math.round(Number(n))))
        .toString(16)
        .padStart(2, '0');
    return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
  }
  return null;
}

/** The new status's colour on this card: its `--st-color` (the board sets it per status), else a fallback. */
export function statusWaveTone(card: Element | null, to: StatusWaveStatus): string {
  const read =
    card && typeof getComputedStyle === 'function' ? getComputedStyle(card).getPropertyValue('--st-color') : '';
  return cssColorHex(read) ?? STATUS_HEX[to];
}

/** The status colour laced with the full spectrum: every other colour on the front is the tone. */
export function spectrumPalette(tone: RGB): Palette {
  const c = PALETTES.colorful.colors;
  return { colors: [tone, c[1], tone, c[3], tone, c[5], tone], ahead: PALETTES.colorful.ahead, behind: tone };
}

const PALETTE_CACHE = new Map<string, Palette>();
function paletteFor(colour: StatusWavePreset['colour'], hex: string): Palette {
  const key = `${colour}:${hex}`;
  let p = PALETTE_CACHE.get(key);
  if (!p) {
    const rgb = hexToRgb(hex);
    p = colour === 'spectrum' ? spectrumPalette(rgb) : singlePalette(rgb);
    PALETTE_CACHE.set(key, p);
  }
  return p;
}

/** Where the card is drawn: a dark theme makes every wave louder, a light one swallows white; mono scales fills. */
export interface StatusWaveEnv {
  dark?: boolean;
  /** The theme's `--chroma` (0 in a mono theme). Default 1. */
  chroma?: number;
  folded?: boolean;
}

/**
 * The wave's options for one status change — pure, so a host can read (or tweak) them before playing; null when the
 * change gets no wave (a quiet card put to sleep).
 */
export function statusWaveOptions(
  emphasis: WaveEmphasis,
  _from: StatusWaveStatus | '' | undefined,
  to: StatusWaveStatus,
  tone: string = STATUS_HEX[to],
  env: StatusWaveEnv = {},
): WaveOptions | null {
  const preset = STATUS_WAVES[emphasis][to];
  if (!preset) return null;
  const s: WaveStyleInput = { ...preset.style };
  const chroma = env.chroma ?? 1;
  s.strength = Math.min((s.strength ?? 0.3) * (env.dark ? 0.85 : 1.15), 0.7) * (chroma > 0 ? 1 : 0.5);
  s.hairlineWhite = env.dark ? 0.9 : 0.15;
  let capture = preset.capture;
  if (env.folded) {
    // A 40 px strip: the default edge would flood it. A clean lit edge, no picture, no dots.
    capture = false;
    s.rimWidth = Math.min(s.rimWidth ?? 4, 2.5);
    s.rimUnevenness = Math.min(s.rimUnevenness ?? 0.6, 0.3);
    s.particleCount = 0;
    s.particleLife = 0;
    s.strength = (s.strength ?? 0.3) * 0.8;
    s.lead = 28;
    s.tail = 64;
  }
  const hex = cssColorHex(tone) ?? STATUS_HEX[to];
  const dpr = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return {
    type: 'center',
    scale: 1,
    focus: null,
    palette: paletteFor(preset.colour, hex),
    waveStyle: s,
    capture,
    live: false,
    prewarm: false,
    resolution: capture ? Math.min(dpr, 2) : 1,
  };
}

const RUNS = new Map<HTMLElement, StatusWaveRun>();

/** The status waves now running on the page. */
export function statusWavesRunning(): number {
  return RUNS.size;
}

/** What a layer switch touches on `el`, read now; the function puts it back. */
function keepLayer(el: HTMLElement): () => void {
  const opacity = el.style.opacity;
  const pointer = el.style.pointerEvents;
  const inert = el.hasAttribute('inert');
  const hidden = el.getAttribute('aria-hidden');
  return () => {
    if (el.style.opacity !== opacity) el.style.opacity = opacity;
    if (el.style.pointerEvents !== pointer) el.style.pointerEvents = pointer;
    if (el.hasAttribute('inert') !== inert) el.toggleAttribute('inert', inert);
    if (el.getAttribute('aria-hidden') !== hidden) {
      if (hidden === null) el.removeAttribute('aria-hidden');
      else el.setAttribute('aria-hidden', hidden);
    }
  };
}

function supported(): boolean {
  return typeof ResizeObserver === 'function' && typeof MutationObserver === 'function';
}

/** At least half the card is in the viewport now. */
export function mostlyOnScreen(card: Element): boolean {
  if (typeof card.getBoundingClientRect !== 'function') return false;
  const r = card.getBoundingClientRect();
  const vw = typeof innerWidth === 'number' ? innerWidth : 0;
  const vh = typeof innerHeight === 'number' ? innerHeight : 0;
  if (!(r.width > 0 && r.height > 0)) return false;
  const w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
  const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
  return w * h >= 0.5 * r.width * r.height;
}

/** Whether the card is drawn on a dark surface (its own background's luminance), and its theme's `--chroma`. */
function envOf(card: HTMLElement, folded: boolean | undefined): StatusWaveEnv {
  let dark = false;
  let chroma = 1;
  if (typeof getComputedStyle === 'function') {
    const cs = getComputedStyle(card);
    const bg = cssColorHex(cs.backgroundColor);
    if (bg) {
      const [r, g, b] = hexToRgb(bg);
      dark = 0.2126 * r + 0.7152 * g + 0.0722 * b < 110;
    }
    const c = Number.parseFloat(cs.getPropertyValue('--chroma'));
    if (Number.isFinite(c)) chroma = c;
  }
  return { dark, chroma, folded };
}

/**
 * Plays one status wave over `card`, or returns null when it would be noise or cannot run: no preset for the change
 * (a quiet card put to sleep), reduced motion, a hidden tab, a card less than half on screen, no observers (no DOM),
 * or the page already at its limit (`STATUS_WAVE_MAX`, `STATUS_WAVE_LOUD_MAX` loud — a loud one displaces the oldest
 * quiet one). A new wave on the same card replaces the one running there.
 */
export function playStatusWave(req: StatusWaveRequest): StatusWaveRun | null {
  const { card, emphasis, to } = req;
  const motion = req.motion ?? 'system';
  if (!card?.isConnected || !supported()) return null;
  if (motion === 'reduce' || (motion === 'system' && prefersReducedMotion())) return null;
  if (typeof document !== 'undefined' && document.hidden) return null;
  if (!mostlyOnScreen(card)) return null;
  const tone = cssColorHex(req.tone) ?? statusWaveTone(card, to);
  const preset = statusWaveOptions(emphasis, req.from, to, tone, envOf(card, req.folded));
  if (!preset) return null;
  RUNS.get(card)?.cancel();
  const runs = Array.from(RUNS.values());
  const louds = runs.filter((r) => r.emphasis === 'loud').length;
  if (emphasis === 'loud' && louds >= STATUS_WAVE_LOUD_MAX) return null;
  if (runs.length >= STATUS_WAVE_MAX) {
    const quiet = emphasis === 'loud' ? runs.find((r) => r.emphasis === 'quiet') : undefined;
    if (!quiet) return null;
    quiet.cancel();
  }
  const opts: WaveOptions = {
    ...preset,
    ...req.options,
    waveStyle: { ...preset.waveStyle, ...req.options?.waveStyle },
  };
  if (req.capture !== undefined) opts.capture = req.capture;
  opts.reducedMotion = motion === 'full' ? 'never' : 'system';
  let ctl: WaveController | null = null;
  let over = false;
  let restore: (() => void) | null = null;
  let backstop: ReturnType<typeof setTimeout> | undefined;
  const end = () => {
    if (over) return;
    over = true;
    clearTimeout(backstop);
    restore?.();
    if (RUNS.get(card) === run) RUNS.delete(card);
    ctl?.destroy();
    ctl = null;
    req.onDone?.();
  };
  const run: StatusWaveRun = { card, emphasis, cancel: end };
  try {
    ctl = new WaveController(card, card, null);
  } catch {
    return null;
  }
  // A one-view wave toggles its view's layer (opacity, pointer events, inert, aria-hidden): here the view is the
  // card itself, so what the host set on it is put back after the engine's first and last touch.
  const kept = keepLayer(card);
  restore = kept;
  RUNS.set(card, run);
  opts.onFinish = () => {
    kept();
    end();
  };
  ctl.update(opts);
  ctl.play({ source: req.source?.isConnected ? req.source : undefined });
  kept();
  // The engine finishes on its own; this is the backstop for a run the browser never draws (a throttled tab).
  backstop = setTimeout(end, 4000);
  return run;
}
