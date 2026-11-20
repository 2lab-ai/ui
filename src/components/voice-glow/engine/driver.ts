/**
 * The voice reaction — ported from Libraries.dev `voice-glow` 0.5.0 `src/voiceDriver.ts` (MIT, © 2026 Jakub
 * Antalik — https://libraries.dev/voice), the maths verbatim.
 *
 * Each frame the driver reads the source — an AnalyserNode on the host's MediaStream, or the host's level (a number
 * or a getter) — shapes the raw level (gain, noise gate, soft saturation), follows it with an attack/release
 * envelope, advances the flow (the lobes sliding sideways at a speed set by the level, so the spectrum travels while
 * a voice is heard and rests when it stops), gathers the lobes into a beam where a gather getter asks for it, folds
 * in the idle breathing and the slow hue drift, and writes the result as CSS custom properties on the element. The
 * stylesheet multiplies every lobe size and position by those, so the paint work is the browser's.
 *
 * Changed in the port: one driver per element (the element owns its frame loop and stops it while hidden, off screen
 * or faded out) instead of one shared loop; the fade is the driver's; the Pro surface looks are gone.
 */
import { type AnalyserLease, acquireAnalyser, bandAverage, clamp01, followLevel, rms, shapeLevel } from './audio';
import { arrivePixels, createPixelState, drawPixels, flyPixels, type PixelPort, type PixelState } from './pixel';
import { LOBE_SPAN, voiceLobes } from './styles';

export interface VoiceGlowConfig {
  sensitivity: number;
  threshold: number;
  attack: number;
  release: number;
  idle: number;
  breatheDuration: number;
  reach: number;
  spread: number;
  bands: boolean;
  /** Flow speed in px/s at full level; negative flows right-to-left. */
  flow: number;
  /** Multiplies the resting distance between lobes (and so the flow ring). */
  lobeSpacing: number;
  /** Bend: px of extra height the glow's top gains at the centre at full level. */
  bend: number;
  /** The band: opacity, thickness, height as a fraction of the ceiling, bell exponent, bell width, skew. */
  bandStrength: number;
  bandWidth: number;
  bandPosition: number;
  bandCurve: number;
  bandSpread: number;
  bandSkew: number;
  /** Vertical shift of the whole band line, px (negative lowers it). */
  bandOffset: number;
  /** Rise of the band's ends toward the corners, as a fraction of the peak. */
  bandTail: number;
  /** Where the rise starts, as a share of the centre-to-edge distance. */
  bandTailPosition: number;
  /** Exponent of the rise. */
  bandTailCurve: number;
  /** Px the band runs past each side of the element. */
  bandTailOverflow: number;
  bandAberration: number;
  /** The ceiling's tuned size multipliers, so the band can sit on it. */
  rangeWidth: number;
  rangeHeight: number;
  theme: 'dark' | 'light';
  /** Band colours as `r, g, b` triples: the core and its fringes. */
  bandColors: { core: string; above: string; mid: string; below: string };
  /** Horizontal distortion of the glow under the band, 0–1. */
  distortion: number;
  /** The epicentre wash's opacity; above 0 the band-line clips are written even without distortion. */
  coreLight: number;
  /** The effect's overall scale, for the few px values not carried by the geometry fields. */
  scale: number;
  /** The element's corner radius, px — a gathered beam follows its arc. */
  radius: number;
  hueRange: number;
  hueDuration: number;
  staticColors: boolean;
  reducedMotion: boolean;
  /** Hold the frame: the clock stops and the source is not read, but a changed config still repaints. */
  paused: boolean;
  /** How the voice is drawn: the stylesheet's glow, or the glow dithered into pixels on a canvas. */
  look: 'glow' | 'dither';
  /** The dither: the lobes' colours as [r, g, b] 0–255, the stylesheet's saturation, the theme's hue base, the cell
   *  size multiplier, the halo, the dust's linger, the dome and the magnet. */
  palette: Array<[number, number, number]>;
  saturation: number;
  hueBase: number;
  pixelSize: number;
  pixelGlow: number;
  pixelDust: number;
  pixelDome: number;
  pixelMagnet: number;
  /** The glow's layer shapes and weights, which the dither rebuilds (the stylesheet carries them for the glow). */
  layers: {
    glowWidth: number;
    glowHeight: number;
    innerScale: number;
    innerHeight: number;
    bloomScale: number;
    bloomHeight: number;
    strokeScale: number;
    softness: number;
    coreSize: number;
    innerOpacity: number;
    bloomOpacity: number;
    strokeOpacity: number;
    brightness: number;
  };
}

/**
 * The glow's large-scale motion for one frame (the library's `motion` prop): how far the lobes are gathered into one
 * compact beam (0 the voice glow, 1 fully gathered), where that beam sits (in half-widths of the lobe ring), how much
 * wider it runs while moving, the level it is held at, and how much it rides the corner arcs.
 */
export interface VoiceGlowGather {
  gather: number;
  offset?: number;
  stretch?: number;
  heldLevel?: number;
  cornerFollow?: number;
}

const REST: Required<VoiceGlowGather> = { gather: 0, offset: 0, stretch: 0, heldLevel: 0, cornerFollow: 0 };

export interface VoiceGlowSource {
  /** Manual 0–1 level, sampled every frame (used when no analyser is attached). */
  getLevel(): number;
  /** The glow's gather, sampled every frame; at rest without it. */
  getGather(): VoiceGlowGather | null | undefined;
}

/** The DOM the driver writes to: the root `.vg` and its layers (any may be missing). */
export interface VoiceGlowLayers {
  root: HTMLElement;
  band: HTMLCanvasElement | null;
  bandHalo: HTMLCanvasElement | null;
  pixel: HTMLCanvasElement | null;
  pixelGlow: HTMLCanvasElement | null;
  flyers: HTMLCanvasElement | null;
  filter: SVGFilterElement | null;
  displace: SVGFEDisplacementMapElement | null;
  noiseShift: SVGFEOffsetElement | null;
}

// Gain applied before `sensitivity`: a laptop microphone at conversational distance gives an RMS of roughly
// 0.03–0.2, which this lifts into the 0.15–1 range the shaping curve expects.
const BASE_GAIN = 5;
const BAND_GAIN = 1.7;

// Voice bands in Hz: fundamentals and chest, vowels and presence, sibilance.
const BANDS: ReadonlyArray<readonly [number, number]> = [
  [80, 300],
  [300, 2000],
  [2000, 6000],
];
const TWO_PI = Math.PI * 2;

// ~60 fps. Subtract a small slack so a frame that lands a hair early still runs.
const FRAME_INTERVAL = 1000 / 60 - 2;
// Adaptive pacing. A phone that cannot hold 60 with every layer repainting each frame stutters between 20 and 40;
// the glow's own dynamics (a 325 ms attack, a 5 s breath) are far slower than 30 Hz, so a steady half rate reads
// better than a ragged full one. When the frame gap stays above PACE_SLOW_GAP for PACE_SLOW_FOR, the driver runs
// every other frame; every PACE_PROBE_EVERY it tries full rate again.
const PACE_SLOW_GAP = 22;
const PACE_SLOW_FOR = 500;
const PACE_PROBE_EVERY = 4000;

// A gathered beam drops the distortion. Its share settles out on its own clock — a 60 ms time constant has it gone
// in about a quarter second — and eases back over roughly a second once the beam releases. Below this share (3% of
// the full displacement, about a pixel) the warp layers are taken out of the paint altogether.
const BAND_DPR_MAX = 2;
const WARP_OUT_TAU = 0.06;
const WARP_IN_TAU = 0.35;
const WARP_OFF_BELOW = 0.03;
// The distortion filter only has to cover the glow under the band line: its region is kept to that strip, in steps
// so the attribute rarely changes. WebKit anchors feTurbulence to the filter region rather than user space, so it
// keeps the full region.
const FILTER_REGION_OK = !(
  typeof navigator !== 'undefined' &&
  /AppleWebKit/.test(navigator.userAgent) &&
  !/Chrome\/|Chromium\/|Edg\/|OPR\//.test(navigator.userAgent)
);
const FILTER_TOP_STEP = 0.05;
const FILTER_TOP_MARGIN = 6;
const FILTER_BOTTOM_MARGIN = 12;
const FILTER_BOTTOM_FRACTION = 0.1;
const FILTER_SIDE = 0.1;

// Ceiling geometry the stylesheet uses (px at multiplier 1) — the band is drawn to sit on the same hump the glow is
// masked to.
const CEILING_HALF_WIDTH = 170;
const CEILING_HEIGHT = 64;
const BAND_SAMPLES = 56;

/** The fade: seconds in and out (the library's 0.6 s / 0.5 s keyframes), and the arriving hold-back. */
const FADE_IN = 0.6;
const FADE_OUT = 0.5;
const ARRIVE_DELAY = 0.22;
const ARRIVE_IN = 0.65;
/** When the wave has faded in after an opening flight, ms after it started: the delay plus the fade, with a margin. */
const WAVE_ARRIVE_FULL_MS = 950;

/** Wrap a lobe offset into [-span/2, span/2). */
export function wrapX(x: number, span: number): number {
  const half = span / 2;
  return ((((x + half) % span) + span) % span) - half;
}

/** How much of a lobe shows at offset x: full at centre, gone at the wrap edge so a lobe never pops from one side to
 *  the other. */
export function edgeEnvelope(x: number, span: number): number {
  const t = x / (span / 2 + 4);
  return Math.max(0, 1 - t * t);
}

/**
 * The band's bell, normalised so it is 1 at the centre and exactly 0 at the ends: exp(-(|t| / σ)^p) with the tail
 * value subtracted out. `p` below 2 gives the exponential, cusp-like rise of a bent surface; above 2 a flatter top.
 * `skew` widens one side and narrows the other.
 */
export function bell(t: number, p: number, sigma: number, skew: number): number {
  const side = t < 0 ? 1 - skew : 1 + skew;
  const s = Math.max(0.05, sigma * side);
  const v = Math.exp(-((Math.abs(t) / s) ** p));
  const tail = Math.exp(-((1 / s) ** p));
  return Math.max(0, (v - tail) / (1 - tail));
}

/**
 * The band's tail lift: from `position` of the way from the beam's centre to the element's edge, the line rises
 * again to the full `lift` exactly at the corner, with `curve` as the exponent.
 */
export function tailLift(dist: number, edge: number, lift: number, position: number, curve: number): number {
  if (lift <= 0 || edge <= 0) return 0;
  const start = edge * Math.max(0, Math.min(0.98, position));
  if (dist <= start) return 0;
  const u = Math.min(1, (dist - start) / Math.max(1, edge - start));
  return lift * u ** Math.max(0.5, curve);
}

export interface BandFrame {
  cx: number;
  w: number;
  h: number;
  mw: number;
  lift: number;
  strength: number;
  level: number;
  /** How much the beam follows the corner arcs, 0–1 (the gather). */
  corner: number;
}

/**
 * The corner radius the element actually paints: CSS clamps a radius that would overlap to half the box, so a
 * pill's `border-radius: 106px` on a 150×44 element is really 22px.
 */
export function paintedRadius(radius: number, cw: number, ch: number): number {
  return Math.max(0, Math.min(radius, cw / 2, ch / 2));
}

/**
 * How far above the bottom edge the element's outline sits at `x`: 0 along the straight run, rising along the
 * corner's circle inside the last `radius` px on either side (and the full radius beyond the sides).
 */
export function cornerLift(x: number, cw: number, radius: number, influence = 0): number {
  if (radius <= 0) return 0;
  const d = Math.min(x, cw - x) - influence;
  if (d >= radius) return 0;
  if (d <= 0) return radius;
  const dx = radius - d;
  return radius - Math.sqrt(Math.max(0, radius * radius - dx * dx));
}

/** The band line's points in element px, left to right. */
export function bandPoints(config: VoiceGlowConfig, f: BandFrame, cw: number, ch: number): Array<[number, number]> {
  const centre = cw / 2 + f.cx * f.w;
  const half = CEILING_HALF_WIDTH * config.rangeWidth * f.w * f.mw;
  // Sit on the ceiling, but never leave the element: below scale 1 the clamp shrinks with the scale, so a scaled-down
  // beam keeps the proportions it had at 1.
  const apexCap = ch * 0.82 * Math.min(1, config.scale);
  const apex = Math.min(apexCap, (CEILING_HEIGHT * config.rangeHeight * f.h + f.lift) * config.bandPosition);
  const base = ch - config.bandOffset;
  // The tail hook is the resting look; the travelling beam has none. The blend is finite and eased — gone by the
  // time the gather reaches 25% — so the hooks never flash.
  const tailT = Math.min(1, f.corner * 4);
  const tail = config.bandTail * (1 - tailT * tailT * (3 - 2 * tailT));
  const withTail = tail > 0.001;
  const over = withTail ? config.bandTailOverflow : 0;
  const x0 = withTail ? -over : centre - half;
  const x1 = withTail ? cw + over : centre + half;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= BAND_SAMPLES; i++) {
    const x = x0 + ((x1 - x0) * i) / BAND_SAMPLES;
    const t = Math.max(-1, Math.min(1, (x - centre) / Math.max(1, half)));
    const edge = (x < centre ? centre : cw - centre) + over;
    const y =
      bell(t, config.bandCurve, config.bandSpread, config.bandSkew) +
      tailLift(Math.abs(x - centre), edge, tail, config.bandTailPosition, config.bandTailCurve);
    // While gathered, the line rides the corner arcs instead of running straight into the radius.
    const arc = f.corner > 0 ? cornerLift(x, cw, paintedRadius(config.radius, cw, ch)) * f.corner : 0;
    pts.push([x, base - apex * y - arc]);
  }
  return pts;
}

/** The regions above and below the band line as clip-path polygons, at a raster factor `k` (1 full, 0.5 halved). */
export function bandClips(
  pts: Array<[number, number]>,
  cw: number,
  ch: number,
  k = 1,
): { above: string; below: string } {
  const px = (v: number) => `${(v * k).toFixed(1)}px`;
  const line = pts.map(([x, y]) => `${px(x)} ${px(y)}`);
  return {
    below: `polygon(0 ${px(ch)}, ${line.join(', ')}, ${px(cw)} ${px(ch)})`,
    above: `polygon(0 0, ${px(cw)} 0, ${px(cw)} ${px(ch)}, ${line.slice().reverse().join(', ')}, 0 ${px(ch)})`,
  };
}

/** Cosine ease-in-out in [0, 1]: 0 at phase 0/1, 1 at phase 0.5. */
export function pingPong(phase: number): number {
  return (1 - Math.cos(TWO_PI * phase)) / 2;
}

/** The hue drift in degrees at `t` seconds: ±range over the period, 0 when held still. */
export function hueDrift(t: number, range: number, duration: number, still: boolean): number {
  return still || range === 0 ? 0 : -range + 2 * range * pingPong(t / duration);
}

/** The glow's size for an effective level: presence, height and spread multipliers. */
export function glowShape(
  eff: number,
  reach: number,
  spread: number,
  passWidth = 1,
): { glow: number; h: number; w: number } {
  return { glow: 0.15 + 0.85 * eff, h: 0.5 + reach * eff, w: (0.85 + spread * eff) * passWidth };
}

interface VoiceGlowState {
  level: number;
  bands: [number, number, number];
  /** Flow phase in px, 0 ≤ phase < LOBE_SPAN. */
  phase: number;
  /** The gather last read, held while paused. */
  motion: Required<VoiceGlowGather>;
  /** The element's own clock in seconds — advances only while running, so a pause holds every drift. */
  t: number;
  lastTs: number;
  /** The distortion's share, 0–1: 1 for the voice glow, settling to 0 while gathered. */
  warp: number;
  /** The fade, 0–1, and where it is heading. */
  fade: number;
}

/** What one frame did: the level shown, and the fade. */
export interface VoiceGlowTick {
  painted: boolean;
  level: number;
  fade: number;
}

/**
 * One element's voice: its state, its analyser, its canvases. The element calls `tick()` from its frame loop and
 * stops calling once `settled` says nothing will change.
 */
export class VoiceGlowDriver {
  config: VoiceGlowConfig;
  /** Whether the effect is on (the library's `active`): fading in toward 1, or out toward 0. */
  on = false;
  readonly s: VoiceGlowState = {
    level: 0,
    bands: [0, 0, 0],
    phase: 0,
    motion: { ...REST },
    t: 0,
    lastTs: 0,
    warp: 1,
    fade: 0,
  };
  #layers: VoiceGlowLayers;
  #ctx: CanvasRenderingContext2D | null = null;
  #haloCtx: CanvasRenderingContext2D | null = null;
  #pixel: PixelState | null = null;
  #filterTop = -1;
  #cssBlur: string | null = null;
  #warpOff = false;
  #painted: VoiceGlowConfig | null = null;
  #lease: AnalyserLease | null = null;
  #stream: MediaStream | null = null;
  #time: Float32Array | null = null;
  #freq: Uint8Array | null = null;
  #lastFrame = 0;
  #lastRaf = 0;
  #paceHalf = false;
  #paceSkip = false;
  #slowSince = 0;
  #probeAt = 0;
  #arriving = 0;
  #arrival: { origin: PixelPort; at: number } | null = null;
  #hueBaseOverride: number | null = null;
  #hueBaseReadAt = 0;
  /** The pointer over the host, element px; null when it is away (the dither's magnet). */
  pointer: { x: number; y: number } | null = null;
  readonly #scratch = { level: 0, bands: [0, 0, 0] as [number, number, number] };
  readonly #lobeX = new Float32Array(voiceLobes.length);
  readonly #lobeY = new Float32Array(voiceLobes.length);
  readonly #lobeL = new Float32Array(voiceLobes.length);

  constructor(
    layers: VoiceGlowLayers,
    config: VoiceGlowConfig,
    readonly source: VoiceGlowSource,
  ) {
    this.config = config;
    this.#layers = layers;
    this.attach(layers);
  }

  /** New layers (the element re-rendered its shadow markup): pick up the canvases and the filter again. */
  attach(layers: VoiceGlowLayers): void {
    this.#layers = layers;
    this.#ctx = context2d(layers.band);
    this.#haloCtx = context2d(layers.bandHalo);
    this.#pixel = layers.pixel ? createPixelState(layers.pixel, layers.pixelGlow) : null;
    this.#filterTop = -1;
    this.#cssBlur = null;
    this.#warpOff = layers.root.hasAttribute('data-warp-off');
    this.#painted = null;
    layers.root.style.setProperty('--vb-pixel-glow', this.config.pixelGlow.toFixed(3));
  }

  setConfig(config: VoiceGlowConfig): void {
    this.config = config;
    this.#layers.root.style.setProperty('--vb-pixel-glow', config.pixelGlow.toFixed(3));
  }

  /** The stream to analyse (null: the level getter). The host's tracks are never stopped here. */
  setStream(stream: MediaStream | null): void {
    if (stream === this.#stream && (this.#lease || !stream)) return;
    this.releaseAudio();
    this.#stream = stream;
    if (stream && this.on) this.#openAudio();
  }

  /** Whether an analyser is open on the stream now. */
  get analysing(): boolean {
    return this.#lease != null;
  }

  #openAudio(): void {
    if (this.#lease || !this.#stream) return;
    const lease = acquireAnalyser(this.#stream);
    if (!lease) return;
    this.#lease = lease;
    this.#time = new Float32Array(lease.analyser.fftSize);
    this.#freq = new Uint8Array(lease.analyser.frequencyBinCount);
  }

  /** Close the analyser this driver opened (the shared context closes with the last one). */
  releaseAudio(): void {
    this.#lease?.release();
    this.#lease = null;
    this.#time = null;
    this.#freq = null;
  }

  /** Turn the effect on (fade in, start analysing) or off (fade out; the analyser closes once it has). */
  setOn(on: boolean, still = false): void {
    if (on === this.on) return;
    this.on = on;
    if (on) {
      // Opening again starts from silence, not from the level it held when it last closed.
      this.s.level = 0;
      this.s.bands = [0, 0, 0];
      this.#openAudio();
    }
    if (still) this.s.fade = on ? 1 : 0;
    // A fresh start must not integrate the gap.
    this.s.lastTs = 0;
  }

  /** Nothing left to animate: off and faded out. */
  get settled(): boolean {
    return !this.on && this.s.fade <= 0;
  }

  /** Whether the effect is visible at all (on, or still fading out). */
  get visible(): boolean {
    return this.on || this.s.fade > 0;
  }

  /** Close toward `target` (a point in the element, px): a few of the dither's pixels fly there. */
  release(target: PixelPort): void {
    if (this.#pixel && this.#layers.flyers)
      flyPixels(this.#pixel, this.#layers.flyers, target, this.config.reducedMotion);
  }

  /** Open from `origin` (a point in the element, px): on the first lit frame a few pixels start there and fly out. */
  summon(origin: PixelPort): void {
    if (this.config.reducedMotion) return;
    this.#arrival = { origin, at: performance.now() };
    this.#arriving = ARRIVE_DELAY;
  }

  /** Forget the pacing history (the loop restarted after a stop). */
  resetPacing(): void {
    this.#lastFrame = 0;
    this.#lastRaf = 0;
    this.#slowSince = 0;
    this.#paceHalf = false;
    this.s.lastTs = 0;
  }

  /** One rAF callback. Paces itself (~60 fps, half rate on a device that cannot hold it). */
  tick(ts: number): VoiceGlowTick {
    const gap = this.#lastRaf ? ts - this.#lastRaf : 0;
    this.#lastRaf = ts;
    if (this.#paceHalf) {
      this.#paceSkip = !this.#paceSkip;
      if (this.#paceSkip) return { painted: false, level: this.s.level, fade: this.s.fade };
      if (ts >= this.#probeAt) {
        this.#paceHalf = false;
        this.#slowSince = 0;
      }
    } else if (gap > PACE_SLOW_GAP) {
      if (!this.#slowSince) this.#slowSince = ts;
      else if (ts - this.#slowSince > PACE_SLOW_FOR) {
        this.#paceHalf = true;
        this.#paceSkip = false;
        this.#probeAt = ts + PACE_PROBE_EVERY;
      }
    } else {
      this.#slowSince = 0;
    }
    if (this.#lastFrame && ts - this.#lastFrame < FRAME_INTERVAL) {
      return { painted: false, level: this.s.level, fade: this.s.fade };
    }
    this.#lastFrame = ts;
    this.step(ts);
    return { painted: true, level: this.s.level, fade: this.s.fade };
  }

  #readAnalyser(out: { level: number; bands: [number, number, number] }): void {
    const lease = this.#lease as AnalyserLease;
    const analyser = lease.analyser;
    const time = this.#time as Float32Array<ArrayBuffer>;
    const freq = this.#freq as Uint8Array<ArrayBuffer>;
    analyser.getFloatTimeDomainData(time);
    out.level = rms(time) * BASE_GAIN * this.config.sensitivity;
    analyser.getByteFrequencyData(freq);
    const binHz = analyser.context.sampleRate / analyser.fftSize;
    for (let b = 0; b < 3; b++) {
      out.bands[b] = bandAverage(freq, binHz, BANDS[b][0], BANDS[b][1]) * BAND_GAIN * this.config.sensitivity;
    }
  }

  /** One frame of the glow. */
  step(ts: number): void {
    const { config, s } = this;
    const el = this.#layers.root;
    const rawDt = s.lastTs ? Math.min(0.05, (ts - s.lastTs) / 1000) : 1 / 60;
    s.lastTs = ts;

    // ── The fade (the library's keyframes, here on the clock) ─────────────────────────────────────────────────
    if (this.#arriving > 0 && this.on) this.#arriving = Math.max(0, this.#arriving - rawDt);
    else {
      const towards = this.on ? 1 : 0;
      const span = this.on ? (this.#arrival ? ARRIVE_IN : FADE_IN) : FADE_OUT;
      if (towards > s.fade) s.fade = Math.min(1, s.fade + rawDt / span);
      else if (towards < s.fade) s.fade = Math.max(0, s.fade - rawDt / span);
    }
    // ease, as the stylesheet's `ease` did
    const f = s.fade;
    el.style.setProperty('--vb-opacity', (f * f * (3 - 2 * f)).toFixed(3));
    if (!this.on && s.fade <= 0) {
      this.releaseAudio();
      return;
    }

    // Paused: the frame holds. It is repainted once per config change so the fields still shape the frozen frame.
    const paused = config.paused;
    if (paused && this.#painted === config) return;
    const dt = paused ? 0 : rawDt;
    s.t += dt;
    const tSec = s.t;
    const scratch = this.#scratch;

    // ── Raw level and bands from the source ─────────────────────────────────────────────────────────────────
    if (paused) {
      // Hold the last level; nothing to read.
    } else if (this.#lease) {
      this.#readAnalyser(scratch);
    } else {
      const raw = clamp01(this.source.getLevel());
      scratch.level = raw;
      // No spectrum to read, so give the bands a little independent life — slow, out-of-phase wobbles scaled by the
      // level — so the lobes still ripple rather than pumping in lockstep.
      scratch.bands[0] = raw;
      scratch.bands[1] = raw * (0.72 + 0.28 * Math.sin(tSec * 9.1));
      scratch.bands[2] = raw * (0.6 + 0.4 * Math.sin(tSec * 13.7 + 2));
    }

    // ── Shape and follow ─────────────────────────────────────────────────────────────────────────────────────
    const target = shapeLevel(scratch.level, config.threshold);
    s.level = followLevel(s.level, target, dt, config.attack, config.release);
    for (let b = 0; b < 3; b++) {
      const bt = shapeLevel(scratch.bands[b], config.threshold * 0.6);
      s.bands[b] = followLevel(s.bands[b], bt, dt, config.attack, config.release * 1.15);
    }

    // ── Gather: the lobes gathered into one beam, and where it sits ──────────────────────────────────────────
    const span = LOBE_SPAN * config.lobeSpacing;
    if (!paused) {
      let m: VoiceGlowGather | null | undefined = null;
      try {
        m = this.source.getGather();
      } catch {
        m = null;
      }
      s.motion =
        m && typeof m === 'object'
          ? {
              gather: clamp01(Number(m.gather) || 0),
              offset: Number.isFinite(m.offset) ? (m.offset as number) : 0,
              stretch: clamp01(Number(m.stretch) || 0),
              heldLevel: clamp01(Number(m.heldLevel) || 0),
              cornerFollow: clamp01(Number(m.cornerFollow) || 0),
            }
          : REST;
    }
    const motion = s.motion;
    const morph = motion.gather;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const cx = config.reducedMotion ? 0 : (motion.offset * span) / 2;
    // The cluster: lobes pulled to 40% of their resting spread, the visible range narrowed to match, a little wider
    // while it moves.
    const gather = 1 - morph * 0.6;
    const maskWidth = 1 - morph * 0.45;
    const passWidth = 1 + morph * 0.3 * motion.stretch;

    // ── Idle breathing folded under the voice ────────────────────────────────────────────────────────────────
    const breathe = config.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin((TWO_PI * tSec) / config.breatheDuration);
    const voiced = s.level + (1 - s.level) * config.idle * breathe;
    // The held level waits for the first quarter of the gather — the time the tail hooks take to collapse.
    const heldT = Math.max(0, Math.min(1, (morph - 0.25) / 0.75));
    const held = heldT * heldT * (3 - 2 * heldT);
    const eff = Math.max(voiced, motion.heldLevel * held);

    const { glow, h, w } = glowShape(eff, config.reach, config.spread, passWidth);

    // ── Flow: the spectrum slides sideways as the voice comes in ─────────────────────────────────────────────
    if (config.flow !== 0 && !config.reducedMotion) {
      s.phase = (((s.phase + config.flow * eff * dt) % span) + span) % span;
    }

    el.style.setProperty('--vb-level', s.level.toFixed(3));
    el.style.setProperty('--vb-cx', `${cx.toFixed(1)}px`);
    el.style.setProperty('--vb-mw', maskWidth.toFixed(3));

    // ── Bend: the glow's ceiling humps up at the centre ──────────────────────────────────────────────────────
    const lift = config.bend * eff;
    el.style.setProperty('--vb-bh', `${Math.max(0, lift).toFixed(1)}px`);
    const bendA = config.bend > 0 ? Math.min(1, lift / config.bend) : 0;
    el.style.setProperty('--vb-bendA', bendA.toFixed(3));
    const frame: BandFrame = { cx, w, h, mw: maskWidth, lift, strength: bendA, level: s.level, corner: morph };
    // The beam's centre and every lobe lift along the corner arcs as they pass through them while gathered.
    const beamAbsX = cw / 2 + cx * w;
    const lobeReach = 30 * config.scale * w;
    const arcRadius = paintedRadius(config.radius, cw, ch);
    const cornerBlend = morph * motion.cornerFollow;
    el.style.setProperty(
      '--vb-cy',
      `${(-cornerLift(beamAbsX, cw, arcRadius, lobeReach * 1.4) * cornerBlend).toFixed(1)}px`,
    );

    // ── Distortion: the glow under the band warps sideways ───────────────────────────────────────────────────
    const { displace, noiseShift, filter } = this.#layers;
    s.warp = followLevel(s.warp, morph > 0.02 ? 0 : 1, dt, WARP_IN_TAU, WARP_OUT_TAU);
    const warp = s.warp;
    const warpOff = displace != null && warp < WARP_OFF_BELOW;
    if (warpOff !== this.#warpOff) {
      this.#warpOff = warpOff;
      el.toggleAttribute('data-warp-off', warpOff);
    }
    let pts: Array<[number, number]> | null = null;
    if (cw && ch && (this.#ctx || displace || this.#pixel)) {
      pts = bandPoints(config, frame, cw, ch);
      if ((displace && !warpOff) || config.coreLight > 0) {
        for (const [suffix, k] of [
          ['', 1],
          ['-z', 0.5],
        ] as const) {
          const clips = bandClips(pts, cw, ch, k);
          el.style.setProperty(`--vb-clip-below${suffix}`, clips.below);
          el.style.setProperty(`--vb-clip-above${suffix}`, clips.above);
        }
      }
      if (filter && !warpOff && FILTER_REGION_OK) this.#fitFilterRegion(filter, pts, ch);
      if (this.#ctx) this.#drawBand(frame, pts, cw, ch);
    }
    if (displace && !warpOff) {
      const amount = config.reducedMotion ? 0 : config.distortion * 120 * config.scale * (0.15 + 0.85 * eff) * warp;
      setAnimated(displace.scale, amount);
      if (noiseShift) {
        setAnimated(noiseShift.dx, 8 * config.scale * Math.sin(tSec * 0.9));
        setAnimated(noiseShift.dy, 4 * config.scale * Math.sin(tSec * 0.6 + 1.3));
      }
    }
    el.style.setProperty('--vb-glow', glow.toFixed(3));
    el.style.setProperty('--vb-h', h.toFixed(3));
    el.style.setProperty('--vb-w', w.toFixed(3));

    // Each lobe: its offset along the flow, and its amplitude — the band it follows lifts it between 0.6× and 1.3×
    // of the shared height, and the edge envelope fades it out toward the wrap.
    for (let i = 0; i < voiceLobes.length; i++) {
      const lobe = voiceLobes[i];
      const x = wrapX(lobe.x * config.lobeSpacing + s.phase, span);
      const bandLift = config.bands ? 0.6 + 0.7 * s.bands[lobe.band] : 1;
      const lobeL = bandLift * edgeEnvelope(x, span);
      el.style.setProperty(`--vb-x${i}`, `${(x * gather).toFixed(1)}px`);
      el.style.setProperty(`--vb-l${i}`, lobeL.toFixed(3));
      const lobeAbsX = cw / 2 + (cx + x * gather) * w;
      const lobeY = -cornerLift(lobeAbsX, cw, arcRadius, lobeReach) * cornerBlend;
      el.style.setProperty(`--vb-y${i}`, `${lobeY.toFixed(1)}px`);
      this.#lobeX[i] = lobeAbsX;
      this.#lobeY[i] = lobeY;
      this.#lobeL[i] = lobeL;
    }

    // ── Hue drift ────────────────────────────────────────────────────────────────────────────────────────────
    const hue = hueDrift(tSec, config.hueRange, config.hueDuration, config.staticColors || config.reducedMotion);
    el.style.setProperty('--vb-hue', `${hue.toFixed(2)}deg`);

    // ── The dither: the same glow, sampled onto a canvas ─────────────────────────────────────────────────────
    const px = this.#pixel;
    if (px && cw && ch) {
      // The host can turn the palette with --voice-hue-base, as it does the glow's filter; read it twice a second.
      if (ts - this.#hueBaseReadAt > 500) {
        this.#hueBaseReadAt = ts;
        let raw = '';
        try {
          raw = getComputedStyle(el).getPropertyValue('--voice-hue-base').trim();
        } catch {
          raw = '';
        }
        const deg = raw ? Number.parseFloat(raw) : Number.NaN;
        this.#hueBaseOverride = Number.isFinite(deg) ? deg : null;
      }
      drawPixels(px, config, {
        cw,
        ch,
        lobeX: this.#lobeX,
        lobeY: this.#lobeY,
        lobeL: this.#lobeL,
        w,
        h,
        maskWidth,
        lift,
        cy: -cornerLift(beamAbsX, cw, arcRadius, lobeReach * 1.4) * cornerBlend,
        glow,
        beamX: beamAbsX,
        hue: (this.#hueBaseOverride ?? config.hueBase) + hue,
        // The band, drawn into the cells too, so its height, width, tail and fringes shape the dither as the glow.
        band: config.bandStrength > 0 ? pts : null,
        bandAlpha: bendA,
        bandSplit: (4 + 12 * config.bandAberration * (0.35 + 0.65 * s.level)) * config.scale,
        level: s.level,
        dt,
        pointer: this.pointer,
        gather: morph,
      });
      // Opening from a button: once the first frame has lit pixels, a few of them start out there and fly out.
      const arrival = this.#arrival;
      if (arrival && px.litN > 0) {
        this.#arrival = null;
        if (this.#layers.flyers && performance.now() - arrival.at < 1500) {
          arrivePixels(px, this.#layers.flyers, arrival.origin, config.reducedMotion, arrival.at + WAVE_ARRIVE_FULL_MS);
        }
      }
    }
    this.#painted = config;
  }

  /** Keep the distortion filter's region to the strip under the band line. */
  #fitFilterRegion(f: SVGFilterElement, pts: Array<[number, number]>, ch: number): void {
    let minY = ch;
    for (let i = 0; i < pts.length; i++) if (pts[i][1] < minY) minY = pts[i][1];
    const top = Math.max(
      0,
      Math.min(0.9, Math.floor((minY - FILTER_TOP_MARGIN) / ch / FILTER_TOP_STEP) * FILTER_TOP_STEP),
    );
    if (top === this.#filterTop) return;
    this.#filterTop = top;
    const bottom = 1 + Math.max(FILTER_BOTTOM_FRACTION, FILTER_BOTTOM_MARGIN / ch);
    f.setAttribute('x', `${-FILTER_SIDE * 100}%`);
    f.setAttribute('width', `${(1 + 2 * FILTER_SIDE) * 100}%`);
    f.setAttribute('y', `${(top * 100).toFixed(0)}%`);
    f.setAttribute('height', `${((bottom - top) * 100).toFixed(1)}%`);
  }

  /** Draw the band: an organic bell traced by a core light with a red fringe above and a blue one below, split
   *  further and thickened by the voice. */
  #drawBand(f: BandFrame, pts: Array<[number, number]>, cw: number, ch: number): void {
    const ctx = this.#ctx as CanvasRenderingContext2D;
    const canvas = this.#layers.band as HTMLCanvasElement;
    const { config } = this;
    const el = this.#layers.root;
    // The band is blurred, so its backing store never needs more than 2x.
    const dpr = Math.min(BAND_DPR_MAX, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const pw = Math.round(cw * dpr);
    const ph = Math.round(ch * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    const haloCanvas = this.#layers.bandHalo;
    const haloCtx = this.#haloCtx;
    if (haloCanvas && haloCtx) {
      if (haloCanvas.width !== pw || haloCanvas.height !== ph) {
        haloCanvas.width = pw;
        haloCanvas.height = ph;
      }
      haloCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      haloCtx.clearRect(0, 0, cw, ch);
    }

    const alpha = Math.min(1, 0.6 * config.bandStrength * f.strength);
    if (alpha < 0.005 || config.bandWidth <= 0) return;

    const isDark = config.theme === 'dark';
    const bw = config.bandWidth * (1 + 0.35 * f.level);
    const split = config.bandAberration * (0.35 + 0.65 * f.level);
    const dy = (4 + 12 * split) * config.scale;
    const dx = 4 * split * config.scale;

    const trace = (ox: number, oy: number) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0] + ox, pts[0][1] + oy);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + ox, pts[i][1] + oy);
    };

    // The band as a thin ridge with a linear ramp across its thickness (stacked strokes of shrinking width), the red
    // fringe riding above and the blue below, a faint green between, and a wide soft halo under all of it.
    const colours = {
      r: config.bandColors.above,
      g: config.bandColors.mid,
      c: config.bandColors.core,
      b: config.bandColors.below,
    };
    const base = (isDark ? 0.42 : 0.4) * alpha;
    const thickness = 14 * bw;
    // Soften every pass with a canvas blur where the browser has one; WebKit's 2D context has no filter, so there the
    // strokes are drawn crisp and blurred by CSS instead, at the same two radii.
    const blurCss = (3.5 * config.bandWidth) / 2;
    const blurPx = blurCss * dpr;
    const canBlur: boolean = typeof (ctx as { filter?: unknown }).filter === 'string';
    const cssBlur = canBlur ? '0px' : `${blurCss.toFixed(2)}px`;
    if (this.#cssBlur !== cssBlur) {
      el.style.setProperty('--vb-band-blur', cssBlur);
      el.style.setProperty('--vb-band-halo-blur', canBlur ? '0px' : `${(blurCss * 3).toFixed(2)}px`);
      this.#cssBlur = cssBlur;
    }
    const ramp: ReadonlyArray<readonly [number, number]> = [
      [1, 0.16],
      [0.72, 0.2],
      [0.46, 0.26],
      [0.22, 0.34],
    ];
    const ridges = [
      { rgb: colours.r, a: 1, ox: dx, oy: -dy },
      { rgb: colours.g, a: 0.55, ox: dx * 0.35, oy: -dy * 0.35 },
      { rgb: colours.b, a: 1, ox: -dx, oy: dy },
      { rgb: colours.c, a: 0.9, ox: 0, oy: 0 },
    ];

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'source-over';
    const x0 = pts[0][0];
    const x1 = pts[pts.length - 1][0];
    const endsFaded = (rgb: string, a: number) => {
      // Fade the ends into the edge so the band never terminates in a stub.
      const grad = ctx.createLinearGradient(x0, 0, x1, 0);
      const fade = config.bandTail > 0 ? 0.015 : 0.18;
      grad.addColorStop(0, `rgba(${rgb}, 0)`);
      grad.addColorStop(fade, `rgba(${rgb}, ${a.toFixed(3)})`);
      grad.addColorStop(1 - fade, `rgba(${rgb}, ${a.toFixed(3)})`);
      grad.addColorStop(1, `rgba(${rgb}, 0)`);
      return grad;
    };

    // Halo: wide and hazy, on its own canvas where the context cannot blur.
    const hc = !canBlur && haloCtx ? haloCtx : ctx;
    if (canBlur) ctx.filter = `blur(${(blurPx * 3).toFixed(1)}px)`;
    hc.lineCap = 'round';
    hc.lineJoin = 'round';
    hc.strokeStyle = endsFaded(colours.c, base * 0.3);
    hc.lineWidth = thickness * 2.2;
    hc.beginPath();
    hc.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) hc.lineTo(pts[i][0], pts[i][1]);
    hc.stroke();

    if (canBlur) ctx.filter = `blur(${blurPx.toFixed(1)}px)`;
    for (const ridge of ridges) {
      for (const [widthMul, alphaMul] of ramp) {
        ctx.strokeStyle = endsFaded(ridge.rgb, base * ridge.a * alphaMul);
        ctx.lineWidth = Math.max(0.6, thickness * widthMul);
        trace(ridge.ox, ridge.oy);
        ctx.stroke();
      }
    }
    if (canBlur) ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
  }
}

function context2d(c: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  try {
    return c?.getContext?.('2d') ?? null;
  } catch {
    return null;
  }
}

/** Set an SVG animated number (`scale`, `dx`, `dy`) where the browser has one. */
function setAnimated(n: SVGAnimatedNumber | undefined, v: number): void {
  if (n && 'baseVal' in n) n.baseVal = v;
}
