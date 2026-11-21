import { define, UiElement } from '../../core/element';
import { type AnalyserLease, acquireAnalyser, readLevel, type VoiceLevelSource } from '../voice-glow/engine/audio';
import { parseRgb } from '../voice-glow/engine/color';
import {
  EnvWatch,
  hostIsDark,
  motionOf,
  motionReduced,
  pageHidden,
  runFrame,
  type VoiceMotion,
} from '../voice-glow/engine/env';
import { bendFrame, bendRadius, bendReach } from './engine/bend';
import type { OrbColors } from './engine/colors';
import {
  ACCENT_COLORS,
  EMOTION_COLORS,
  GlowFollower,
  type VoiceOrbAccent,
  type VoiceOrbEmotion,
} from './engine/emotion';
import { EdgeBounce, LEAN_DEFAULTS, type LeanAmounts, leanFrame, leanReach } from './engine/lean';
import { type OrbGlow, type OrbTint, paintFrame } from './engine/paint';
import { PRESETS, type Resolved, resolvePreset } from './engine/presets';
import { EdgeLens } from './engine/refract';
import type { VoiceOrbType } from './engine/registry';
import type { TypeFrame, TypeOpts, VoiceInput } from './engine/types';
import { VoiceFollower } from './engine/voice';
import { styles } from './styles';

/**
 * How the ring is drawn. `ring` (the library's VoiceRing default, the `aura` orb) — a glassy ribbon of light with a
 * spectrum running round it; `mono` (`aura-mono`) — two loops of grey tube a voice opens into a turning globe; and the
 * VoiceOrb types: `orbit`, `sash`, `signal`, `swell`, `pixel`.
 */
export type VoiceRingType = 'ring' | 'mono' | 'orbit' | 'sash' | 'signal' | 'swell' | 'pixel';

/**
 * The conversation state:
 * - `idle` — waiting for someone to talk: sources ignored, a calm, very slow drift
 * - `listening` — the user's turn: follows the source (usually the microphone)
 * - `speaking` — the assistant's turn: follows the source (usually its playback)
 * - `processing` — working on what was heard (`thinking` is accepted as its alias): each type's working motion
 */
export type VoiceRingState = 'idle' | 'listening' | 'speaking' | 'processing';
export type VoiceRingLang = 'en' | 'ko';
export type VoiceDirectionSource = number | (() => number);

export const VOICE_RING_TYPES: readonly VoiceRingType[] = ['ring', 'mono', 'orbit', 'sash', 'signal', 'swell', 'pixel'];
const ORB_TYPE: Record<VoiceRingType, VoiceOrbType> = {
  ring: 'aura',
  mono: 'aura-mono',
  orbit: 'orbit',
  sash: 'sash',
  signal: 'signal',
  swell: 'swell',
  pixel: 'pixel',
};
const STATES: readonly VoiceRingState[] = ['idle', 'listening', 'speaking', 'processing'];
const EMOTIONS: readonly VoiceOrbEmotion[] = ['positive', 'negative', 'calm'];
const ACCENTS: readonly VoiceOrbAccent[] = ['green', 'red', 'blue'];

/** Everything the library's `<VoiceRing>` / `<VoiceOrb>` took as props, as data. Every field is optional. */
export interface VoiceRingData {
  type?: VoiceRingType;
  state?: VoiceRingState | 'thinking';
  /** Rendered size in CSS px; designed at 200. @default 160 */
  size?: number;
  /** The level, 0–1 — a number, or a getter read every frame (the same as the `level` property). */
  level?: VoiceLevelSource;
  /** A MediaStream the host opened; wins over `analyser` and `level`. Never stopped by the element. */
  stream?: MediaStream | null;
  /** Any AnalyserNode the host already has (its own playback, say); wins over `level`. */
  analyser?: AnalyserNode | null;
  sensitivity?: number;
  threshold?: number;
  attack?: number;
  release?: number;
  idle?: number;
  calm?: number;
  voiceSpeed?: number;
  /** An emotion detected in the voice: its colour washes through the ring. Detection is the host's. */
  emotion?: VoiceOrbEmotion | null;
  /** Override any emotion's colour (hex or rgb). */
  emotionColors?: Partial<Record<VoiceOrbEmotion, string>>;
  /** Colourful mode (the ink types): 0 never … 1 the colour … 2 purer. @default 2 */
  saturation?: number;
  accent?: VoiceOrbAccent | null;
  gradientAngle?: number;
  gradientSpin?: number;
  neutral?: number;
  colorBrightness?: number;
  colorHue?: number;
  gradientStart?: number;
  gradientWidth?: number;
  /** Where the voice comes from, −1 left … 1 right — a number or a getter read every frame. */
  direction?: VoiceDirectionSource;
  directionMove?: number;
  directionPull?: number;
  directionDeform?: number;
  directionSquash?: number;
  directionLens?: number;
  directionStretch?: number;
  directionSplit?: number;
  directionBlur?: number;
  directionBounce?: number;
  /** CSS px the lean stops short of the edge. @default 32 */
  directionMargin?: number;
  /** An element whose left and right edges the ring leans up to instead of the screen's. */
  directionBounds?: Element | null;
  /** Lean toward `direction` even in silence (a port addition; `<ui-voice-position>` sets it). @default false */
  holdDirection?: boolean;
  /** Bend toward the pointer while idle or processing: true (0.55) or a strength 0–1. Desktop only. */
  hoverBend?: boolean | number;
  speed?: number;
  paused?: boolean;
  /** An ink tint (hex or rgb); depth shading is kept on it. */
  color?: string;
  dots?: number;
  dotSize?: number;
  /** Advanced: raw type knobs merged over the resolved preset. */
  opts?: TypeOpts;
  /** Escape hatch: replace the type's geometry (the library's `frame`). */
  frame?: TypeFrame;
  /** The accessible name instead of the state's own word. */
  label?: string;
  /** Hide it from assistive tech (a ring inside a readout that says the state itself). */
  decorative?: boolean;
  /** Called every frame with the shaped level, 0–1. */
  onLevel?: (level: number) => void;
}

/** What one frame is drawn with, resolved from data and attributes, each clamped. */
export interface VoiceRingResolved {
  type: VoiceRingType;
  orbType: VoiceOrbType;
  state: VoiceRingState;
  size: number;
  sensitivity: number;
  threshold: number;
  attack: number;
  release: number;
  idle: number;
  calm: number;
  voiceSpeed: number;
  speed: number;
  dots: number;
  dotSize: number;
  emotion: VoiceOrbEmotion | null;
  emotionTint: OrbTint | null;
  colors: Omit<OrbColors, 'accent'> & { accent: OrbTint | null; spin: number };
  lean: LeanAmounts;
  margin: number;
  bend: number;
  tint: OrbTint | undefined;
  hold: boolean;
}

const STRINGS = {
  en: { idle: 'Waiting', listening: 'Listening', speaking: 'Speaking', processing: 'Thinking' },
  ko: { idle: '대기 중', listening: '듣는 중', speaking: '말하는 중', processing: '생각하는 중' },
};

// The hover bend's strength when it is simply on.
const HOVER_BEND = 0.55;
// 120 Hz displays would double the paint work for no visible gain.
const FRAME_MS = 1000 / 62;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
function num(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? clamp(n, lo, hi) : dflt;
}
function oneOf<T extends string>(v: unknown, list: readonly T[]): T | null {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return (list as readonly string[]).includes(s) ? (s as T) : null;
}

/** The type for a value (`aura` and `aura-mono`, the orb names, are accepted); anything else is 'ring'. */
export function voiceRingType(v: unknown): VoiceRingType {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  if (s === 'aura') return 'ring';
  if (s === 'aura-mono') return 'mono';
  return oneOf(s, VOICE_RING_TYPES) ?? 'ring';
}

/** The state for a value: `thinking` is `processing`; anything else is 'listening'. */
export function voiceRingState(v: unknown): VoiceRingState {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  if (s === 'thinking') return 'processing';
  return oneOf(s, STATES) ?? 'listening';
}

function tintOf(c: unknown): OrbTint | undefined {
  const t = parseRgb(c);
  return t ? { r: t[0], g: t[1], b: t[2] } : undefined;
}

/** Resolve data and attributes into what the ring draws with — VoiceOrb.tsx's prop resolution. */
export function resolveVoiceRing(
  d: VoiceRingData,
  attrs: { type?: unknown; state?: unknown; size?: unknown; emotion?: unknown; accent?: unknown } = {},
): VoiceRingResolved {
  const type = voiceRingType(d.type ?? attrs.type);
  const orbType = ORB_TYPE[type];
  const preset = PRESETS[orbType];
  const size = Math.round(num(d.size ?? attrs.size, 16, 1024, 160));
  const emotion = d.emotion === null ? null : oneOf(d.emotion ?? attrs.emotion, EMOTIONS);
  const accent = d.accent === null ? null : oneOf(d.accent ?? attrs.accent, ACCENTS);
  const saturation = num(d.saturation, 0, 2, 2);
  const custom = emotion ? tintOf(d.emotionColors?.[emotion]) : undefined;
  const typeLean = preset.lean ?? {};
  const hb = d.hoverBend;
  return {
    type,
    orbType,
    state: voiceRingState(d.state ?? attrs.state),
    size,
    sensitivity: num(d.sensitivity, 0, 100, 0.85),
    threshold: num(d.threshold, 0, 0.95, 0.04),
    attack: num(d.attack, 0, 30, preset.attack ?? 0.06),
    release: num(d.release, 0, 30, 0.32),
    idle: num(d.idle, 0, 1, 0.1),
    calm: num(d.calm, 0, 1, 0.4),
    voiceSpeed: num(d.voiceSpeed, 0, 20, preset.voiceSpeed ?? 1),
    speed: num(d.speed, 0, 20, 1),
    dots: num(d.dots, 0.1, 10, 1),
    dotSize: num(d.dotSize, 0.1, 10, preset.dotSize ?? 1),
    emotion,
    emotionTint: emotion ? (custom ?? EMOTION_COLORS[emotion]) : null,
    colors: {
      // saturation past 1 is vividness: the colour itself purer and deeper
      saturation: Math.min(1, saturation),
      vivid: Math.max(0, Math.min(1, saturation - 1)),
      brightness: num(d.colorBrightness, 0, 5, 1.02),
      hue: num(d.colorHue, -360, 360, 0),
      start: num(d.gradientStart, 0, 1, 0.1),
      width: num(d.gradientWidth, 0, 1, 0.6),
      accent: accent ? ACCENT_COLORS[accent] : null,
      angle: num(d.gradientAngle, -3600, 3600, 99),
      spin: num(d.gradientSpin, -3600, 3600, 12),
      neutral: num(d.neutral, 0, 1, 1),
      size,
    },
    // each amount: the field, else the type's own, else the shared default
    lean: {
      move: num(d.directionMove, -10, 10, typeLean.move ?? LEAN_DEFAULTS.move),
      pull: num(d.directionPull, -10, 10, typeLean.pull ?? LEAN_DEFAULTS.pull),
      deform: num(d.directionDeform, -10, 10, typeLean.deform ?? LEAN_DEFAULTS.deform),
      squash: num(d.directionSquash, 0, 1, typeLean.squash ?? LEAN_DEFAULTS.squash ?? 0),
      lens: num(d.directionLens, 0, 2, typeLean.lens ?? LEAN_DEFAULTS.lens ?? 0),
      stretch: num(d.directionStretch, 0, 2, typeLean.stretch ?? LEAN_DEFAULTS.stretch ?? 1),
      split: num(d.directionSplit, 0, 2, typeLean.split ?? LEAN_DEFAULTS.split ?? 1),
      blur: num(d.directionBlur, 0, 2, typeLean.blur ?? LEAN_DEFAULTS.blur ?? 1),
      bounce: num(d.directionBounce, 0, 2, typeLean.bounce ?? LEAN_DEFAULTS.bounce ?? 1),
    },
    margin: num(d.directionMargin, 0, 1000, preset.margin ?? 32),
    bend: hb === true ? HOVER_BEND : typeof hb === 'number' ? num(hb, 0, 1, 0) : 0,
    tint: tintOf(d.color),
    hold: d.holdDirection === true,
  };
}

/** A direction read from a number or a getter, clamped to −1 … 1; anything else (or a throw) is 0. */
export function readDirection(source: unknown): number {
  let v: unknown = source;
  if (typeof v === 'function') {
    try {
      v = (v as () => unknown)();
    } catch {
      return 0;
    }
  }
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? clamp(n, -1, 1) : 0;
}

/**
 * `<ui-voice-ring>` — light that bends with a voice. A few rings lean off the view axis and bundle into a glassy
 * ribbon with a spectrum running round it; the voice bends them together like a skin, brightens them and sways the
 * colours; processing spins the spectrum round like a loader. `type="mono"` draws two loops of grey tube a voice
 * opens into a turning globe, and the VoiceOrb types (`orbit`, `sash`, `signal`, `swell`, `pixel`) are here too. It
 * takes the colour of an emotion the host detects, and leans toward where the voice comes from (`direction`).
 *
 * Level in: `level` (a number or a getter), `stream` (a MediaStream the host opened — never asked for, never
 * stopped), or `analyser`. One 2D canvas; a small WebGL 2 pass refracts the ring into the edge it leans against,
 * created on first need and released when the loop stops or the element leaves (without WebGL 2 the ring is drawn
 * as it is). No frames while paused, off screen or in a hidden tab; reduced motion holds the clocks — a still frame
 * that still answers the voice.
 *
 * Ported from Libraries.dev's Voice ring (`voice-ring` 0.2.0, MIT, © 2026 Jakub Antalik —
 * https://libraries.dev/voice-ring): VoiceRing, VoiceOrb and their engine.
 */
export class UiVoiceRing extends UiElement<VoiceRingData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return [
      'type',
      'state',
      'size',
      'level',
      'emotion',
      'accent',
      'paused',
      'theme',
      'motion',
      'lang',
      'label',
      'decorative',
    ];
  }

  #box: HTMLElement | null = null;
  #canvas: HTMLCanvasElement | null = null;
  #ctx: CanvasRenderingContext2D | null = null;
  #said: HTMLElement | null = null;
  #r: VoiceRingResolved = resolveVoiceRing({});
  #level: VoiceLevelSource | null = null;
  #stream: MediaStream | null = null;
  #analyser: AnalyserNode | null = null;
  #lease: AnalyserLease | null = null;
  #direction: VoiceDirectionSource | null = null;
  #seenData: VoiceRingData | undefined;
  readonly #follower = new VoiceFollower();
  readonly #glower = new GlowFollower();
  readonly #lens = new EdgeLens();
  #bounce = new EdgeBounce();
  #press = 0;
  #bend = 0;
  #bx = 0;
  #by = 0;
  #pointer = { x: 0, y: 0, over: false };
  #pointerOn = false;
  #raf = 0;
  #running = false;
  #lastStep = 0;
  #lastPaint = 0;
  #lastMeasure = Number.NEGATIVE_INFINITY;
  #room: [number, number] = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  #pad: [number, number] = [0, 0];
  #dpr = 1;
  #shapeKey = '';
  #preset: Resolved | null = null;
  #presetKey = '';
  #visible = true;
  #dark = true;
  #themeStale = true;
  #reduced = false;
  #shown = 0;
  #io: IntersectionObserver | null = null;
  #env: EnvWatch;

  constructor() {
    super();
    this.#env = new EnvWatch(this, (what) => {
      if (what === 'theme') this.#themeStale = true;
      if (what === 'visibility') {
        if (pageHidden()) this.#stop();
        else this.#start();
        return;
      }
      this.requestRender();
    });
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if (old === value) return;
    if (name === 'theme') this.#themeStale = true;
    if (name === 'level' && !(typeof this.#level === 'function')) this.#level = value == null ? null : readLevel(value);
    this.requestRender();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#visible = true;
    this.#themeStale = true;
    this.#env.connect();
    if (typeof IntersectionObserver === 'function') {
      this.#io = new IntersectionObserver((entries) => {
        const e = entries[entries.length - 1];
        if (!e) return;
        this.#visible = e.isIntersecting;
        if (this.#visible) this.#start();
        else this.#stop();
      });
      this.#io.observe(this);
    }
    // back on the page after a first render: listen again if the state does (the first render syncs it otherwise)
    if (this.#box) this.#syncAudio();
  }

  override disconnectedCallback(): void {
    this.#stop();
    this.#env.disconnect();
    this.#io?.disconnect();
    this.#io = null;
    this.#listenPointer(false);
    // The analyser (and, with the last one, the shared AudioContext) closes; the host's tracks are left running.
    this.#closeAudio();
    this.#lens.release();
    super.disconnectedCallback();
  }

  // ── Properties ───────────────────────────────────────────────────────────────────────────────────────────────

  /** The level, 0–1: a number, or a getter read every frame. Setting it never re-renders. */
  get level(): VoiceLevelSource | null {
    return this.#level;
  }
  set level(value: VoiceLevelSource | null) {
    const had = this.#level != null;
    this.#level = value == null ? null : typeof value === 'function' ? value : readLevel(value);
    if (had !== (this.#level != null)) this.requestRender();
  }

  /** A MediaStream the host opened; the element opens its own analyser on it and never stops its tracks. */
  get stream(): MediaStream | null {
    return this.#stream;
  }
  set stream(value: MediaStream | null) {
    if ((value ?? null) === this.#stream) return;
    this.#closeAudio();
    this.#stream = value ?? null;
    // the next render opens an analyser on it — if the state listens
    this.requestRender();
  }

  /** Any AnalyserNode the host already has (closed by the host, not here). */
  get analyser(): AnalyserNode | null {
    return this.#analyser;
  }
  set analyser(value: AnalyserNode | null) {
    this.#analyser = value ?? null;
    this.requestRender();
  }

  /** Where the voice comes from, −1 left … 1 right: a number or a getter read every frame. */
  get direction(): VoiceDirectionSource | null {
    return this.#direction;
  }
  set direction(value: VoiceDirectionSource | null) {
    const had = this.#direction != null;
    this.#direction = value == null ? null : typeof value === 'function' ? value : readDirection(value);
    if (had !== (this.#direction != null)) this.requestRender();
  }

  get state(): VoiceRingState {
    return this.#r.state;
  }
  set state(value: VoiceRingState | 'thinking') {
    this.setAttribute('state', voiceRingState(value));
  }

  get paused(): boolean {
    return this.hasAttribute('paused');
  }
  set paused(on: boolean) {
    this.toggleAttribute('paused', !!on);
  }

  /** The shaped level the ring shows now, 0–1 (the library's `onLevel` value). */
  get shownLevel(): number {
    return this.#shown;
  }

  /** True while the frame loop is scheduled. */
  get running(): boolean {
    return this.#running;
  }

  /** What it draws with now. */
  get resolved(): VoiceRingResolved {
    return this.#r;
  }

  /** Whether the edge lens holds a WebGL context now. */
  get lensActive(): boolean {
    return this.#lens.active;
  }

  get #lang(): VoiceRingLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  /**
   * The analyser exists only while the ring listens: connected, with a stream, in `listening` or `speaking`. Idle and
   * processing ignore the source, so their analyser (and with the last one the shared AudioContext) is let go.
   */
  #syncAudio(): void {
    const hears = this.#r.state === 'listening' || this.#r.state === 'speaking';
    if (this.isConnected && this.#stream && hears) this.#openAudio();
    else this.#closeAudio();
  }

  #openAudio(): void {
    if (this.#lease || !this.#stream || !this.isConnected) return;
    this.#lease = acquireAnalyser(this.#stream);
  }

  #closeAudio(): void {
    this.#lease?.release();
    this.#lease = null;
  }

  // ── Render ───────────────────────────────────────────────────────────────────────────────────────────────────

  #syncData(): void {
    const d = this.data;
    if (d === this.#seenData) return;
    this.#seenData = d;
    if (!d) return;
    if ('level' in d) this.level = d.level ?? null;
    if ('stream' in d) this.stream = d.stream ?? null;
    if ('analyser' in d) this.#analyser = d.analyser ?? null;
    if ('direction' in d) this.direction = d.direction ?? null;
    if (typeof d.paused === 'boolean' && d.paused !== this.paused) this.paused = d.paused;
  }

  #decorative(): boolean {
    return (this.data?.decorative ?? this.hasAttribute('decorative')) === true;
  }

  #label(): string {
    const own = String(this.data?.label ?? this.getAttribute('label') ?? '').trim();
    return own || STRINGS[this.#lang][this.#r.state];
  }

  protected render(): string {
    return '<div class="vr" part="ring"><canvas part="canvas" aria-hidden="true"></canvas><span class="sr-only"></span></div>';
  }

  protected override update(): void {
    this.#syncData();
    if (this.#themeStale) {
      this.#themeStale = false;
      this.#dark = hostIsDark(this);
    }
    const motion: VoiceMotion = motionOf(this.getAttribute('motion'));
    this.#reduced = motionReduced(motion);
    this.#r = resolveVoiceRing(this.data ?? {}, {
      type: this.getAttribute('type'),
      state: this.getAttribute('state'),
      size: this.getAttribute('size'),
      emotion: this.getAttribute('emotion'),
      accent: this.getAttribute('accent'),
    });
    if (!this.#box) {
      this.content.innerHTML = this.render();
      this.#box = this.content.querySelector<HTMLElement>('.vr');
      this.#canvas = this.content.querySelector('canvas');
      this.#said = this.content.querySelector<HTMLElement>('.sr-only');
      try {
        this.#ctx = this.#canvas?.getContext('2d') ?? null;
      } catch {
        this.#ctx = null;
      }
    }
    const box = this.#box as HTMLElement;
    const decorative = this.#decorative();
    const a11y: Record<string, string | null> = decorative
      ? { role: null, 'aria-live': null, 'aria-hidden': 'true' }
      : { role: 'status', 'aria-live': 'polite', 'aria-hidden': null };
    for (const [k, v] of Object.entries(a11y)) {
      if (v === null) box.removeAttribute(k);
      else if (box.getAttribute(k) !== v) box.setAttribute(k, v);
    }
    const label = this.#label();
    if (this.#said && this.#said.textContent !== label) this.#said.textContent = label;
    box.dataset.type = this.#r.type;
    box.dataset.state = this.#r.state;
    box.style.setProperty('--vr-size', `${this.#r.size}px`);
    this.#layout();
    this.#listenPointer(this.#r.bend > 0 && !this.#reduced);
    this.#syncAudio();
    if (!this.#wantsLoop()) this.#stop();
    this.#start();
    // one frame now, so a change shows at once — and a paused or reduced-motion ring is this still frame
    const now = performance.now();
    runFrame(this, 'ui-voice-ring', () => this.#step(now));
    // a still frame may have pressed on an edge: no loop holds the lens's context afterwards
    if (!this.#running) this.#lens.release();
    this.updated();
  }

  /** The canvas reaches past the box by as far as the lean can carry the ring, no further than the room to the edge. */
  #layout(): void {
    const canvas = this.#canvas;
    if (!canvas) return;
    const r = this.#r;
    const reach = this.#direction == null ? 0 : leanReach(r.lean, r.size);
    const left = Math.min(reach, this.#room[0]);
    const right = Math.min(reach, this.#room[1]);
    const padL = reach ? left + r.margin : 0;
    const padR = reach ? right + r.margin : 0;
    const dpr = Math.min(2, (typeof devicePixelRatio !== 'undefined' && devicePixelRatio) || 1);
    const key = `${r.size}|${padL}|${padR}|${dpr}|${r.orbType}|${r.dots}|${r.dotSize}`;
    this.#pad = [padL, padR];
    this.#dpr = dpr;
    if (key === this.#shapeKey) return;
    this.#shapeKey = key;
    canvas.width = Math.round((r.size + padL + padR) * dpr);
    canvas.height = Math.round(r.size * dpr);
    canvas.style.width = `${r.size + padL + padR}px`;
    canvas.style.height = `${r.size}px`;
    canvas.style.marginLeft = `${-padL}px`;
    canvas.style.marginRight = `${-padR}px`;
    // a new shape starts its own bounce and bend
    this.#bounce = new EdgeBounce();
    this.#press = 0;
    this.#bend = 0;
    this.#bx = r.size / 2;
    this.#by = r.size / 2;
  }

  /** Whether the loop should run: something to animate, on screen, the tab shown, not paused. */
  #wantsLoop(): boolean {
    if (!this.isConnected || !this.#visible || pageHidden() || this.paused || !this.#ctx) return false;
    const hasSource = Boolean(this.#stream || this.#analyser || this.#level != null || this.#r.state === 'processing');
    return !(this.#reduced && !hasSource);
  }

  #start(): void {
    if (this.#running || !this.#wantsLoop()) return;
    this.#running = true;
    // the gap while stopped is not time the ring lived through
    this.#lastStep = 0;
    this.#raf = requestAnimationFrame(this.#loop);
  }

  #stop(): void {
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#raf = 0;
    if (this.#running) {
      this.#running = false;
      // long idle: the lens lets its WebGL context go until the next press
      this.#lens.release();
    }
  }

  readonly #loop = (now: number) => {
    if (!this.#running) return;
    this.#raf = requestAnimationFrame(this.#loop);
    if (now - this.#lastPaint < FRAME_MS) return;
    this.#lastPaint = now;
    // a throwing frame (a host's frame function, a canvas that cannot draw) is logged once; the loop goes on
    runFrame(this, 'ui-voice-ring', () => this.#step(now));
  };

  /** The room from the ring's box to the edges of the viewport (or the bounds element), every half second. */
  #measure(now: number): void {
    const r = this.#r;
    if (this.#direction == null || now - this.#lastMeasure < 500) return;
    this.#lastMeasure = now;
    const canvas = this.#canvas;
    if (!canvas) return;
    const box = canvas.getBoundingClientRect().left + this.#pad[0];
    const within = this.data?.directionBounds?.getBoundingClientRect?.();
    const lo = within ? within.left : 0;
    const hi = within ? within.right : document.documentElement.clientWidth;
    const next: [number, number] = [
      Math.max(0, Math.floor(box - lo - r.margin)),
      Math.max(0, Math.floor(hi - box - r.size - r.margin)),
    ];
    const was = this.#room;
    if (Math.abs(was[0] - next[0]) > 1 || Math.abs(was[1] - next[1]) > 1) {
      this.#room = next;
      this.#layout();
    }
  }

  #step(now: number): void {
    const ctx = this.#ctx;
    if (!ctx) return;
    this.#measure(now);
    const r = this.#r;
    const dt = this.#lastStep ? Math.min(0.05, (now - this.#lastStep) / 1000) : 1 / 60;
    this.#lastStep = now;
    // the type's tuning at this size, resolved once per type, size and density — not every frame
    const presetKey = `${r.orbType}|${r.size}|${r.dots}|${r.dotSize}`;
    if (presetKey !== this.#presetKey || !this.#preset) {
      this.#presetKey = presetKey;
      this.#preset = resolvePreset(r.orbType, r.size, r.dots, r.dotSize);
    }
    const preset = this.#preset;
    const follower = this.#follower;
    // waiting and processing do not listen, whatever is attached
    const hears = r.state === 'listening' || r.state === 'speaking';
    const node = this.#lease?.analyser ?? this.#analyser;
    try {
      if (!hears) follower.readSilence();
      else if (node) follower.readAnalyser(node, r.sensitivity * preset.gain, dt);
      else if (this.#level != null) follower.readLevel(readLevel(this.#level), r.sensitivity * preset.gain);
      else follower.readSilence();
    } catch {
      follower.readSilence();
    }
    const still = this.paused || this.#reduced;
    const voice = follower.step(
      dt,
      {
        sensitivity: r.sensitivity,
        threshold: r.threshold,
        attack: r.attack,
        release: r.release,
        idle: r.idle,
        driveGain: preset.driveGain * r.voiceSpeed,
        calm: r.calm,
        rate: preset.speed * r.speed,
        processing: r.state === 'processing',
        direction: this.#direction == null ? 0 : readDirection(this.#direction),
        holdDirection: r.hold,
      },
      this.#reduced,
    );
    this.#shown = voice.level;
    try {
      this.data?.onLevel?.(voice.level);
    } catch {
      /* the host's callback threw: the ring goes on */
    }
    // a still ring (paused, or reduced motion) shows the emotion at once
    const glow = this.#glower.step(dt, r.emotionTint, follower.clock, r.size, still);
    this.#draw(ctx, voice, glow, dt, preset.frame, preset.opts, still);
  }

  #draw(
    ctx: CanvasRenderingContext2D,
    voice: VoiceInput,
    glow: OrbGlow,
    dt: number,
    presetFrame: TypeFrame,
    presetOpts: TypeOpts,
    still: boolean,
  ): void {
    const r = this.#r;
    const size = r.size;
    const [padL, padR] = this.#pad;
    const dpr = this.#dpr;
    const d = this.data ?? {};
    const opts = d.opts && typeof d.opts === 'object' ? { ...presetOpts, ...d.opts } : presetOpts;
    const frameFn = typeof d.frame === 'function' ? d.frame : presetFrame;
    const reach = this.#direction == null ? 0 : leanReach(r.lean, size);
    const left = Math.min(reach, this.#room[0]);
    const right = Math.min(reach, this.#room[1]);
    ctx.setTransform(dpr, 0, 0, dpr, padL * dpr, 0);
    ctx.clearRect(-padL, 0, size + padL + padR, size);
    // lean toward where the voice comes from, after the geometry
    const hit = still ? 0 : this.#bounce.step(this.#press, dt);
    let frame = leanFrame(frameFn(size, this.#follower.t, voice, opts), voice.pan, size, r.lean, [left, right], hit);
    this.#press = frame.contact?.press ?? 0;
    // then bend toward the pointer on hover, while no voice moves the ring: waiting or processing
    if (r.bend > 0) {
      const p = this.#pointer;
      const R = bendRadius(frame, size);
      const quiet = r.state === 'idle' || r.state === 'processing';
      const near = p.over && quiet && !still ? bendReach(Math.hypot(p.x - size / 2, p.y - size / 2) - R, R) : 0;
      this.#bend += (near - this.#bend) * (1 - Math.exp(-dt / 0.14));
      // a fresh approach starts where the pointer is, not from the middle
      const follow = this.#bend < 0.01 ? 1 : 1 - Math.exp(-dt / 0.05);
      this.#bx += (p.x - this.#bx) * follow;
      this.#by += (p.y - this.#by) * follow;
      if (this.#bend > 0.002) frame = bendFrame(frame, size, { x: this.#bx, y: this.#by, amount: this.#bend * r.bend });
    }
    // On the ink types the emotion *is* the colour: the gradient runs from the neutral ink into the emotion's hue,
    // fading in and crossfading as the glow follower eases. A fixed accent holds the colour without one.
    const c = r.colors;
    const e = glow.amount;
    const base = c.accent;
    const hue = base
      ? { r: base.r + (glow.r - base.r) * e, g: base.g + (glow.g - base.g) * e, b: base.b + (glow.b - base.b) * e }
      : { r: glow.r, g: glow.g, b: glow.b };
    const colors: OrbColors = {
      ...c,
      accent: hue,
      saturation: c.saturation * (base ? 1 : e),
      angle: c.angle + c.spin * this.#follower.clock,
    };
    try {
      // luminous frames keep the emotion as a shift of their own spectrum, tubes as a wash over their greys
      paintFrame(ctx, frame, this.#dark, r.tint, frame.light || frame.tube ? glow : undefined, colors, this.#lens);
    } catch {
      /* a context that cannot draw (lost, or a test double) leaves the frame blank — never an exception */
    }
  }

  // ── Hover bend ───────────────────────────────────────────────────────────────────────────────────────────────

  #listenPointer(on: boolean): void {
    const fine = on && typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (fine === this.#pointerOn) return;
    this.#pointerOn = fine;
    if (fine) {
      window.addEventListener('pointermove', this.#onMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', this.#onLeave);
    } else {
      window.removeEventListener('pointermove', this.#onMove);
      document.documentElement.removeEventListener('pointerleave', this.#onLeave);
      this.#pointer.over = false;
    }
  }

  readonly #onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch' || !this.#canvas) return;
    const rect = this.#canvas.getBoundingClientRect();
    const [padL, padR] = this.#pad;
    // the canvas may be scaled by an ancestor's transform
    const k = (this.#r.size + padL + padR) / (rect.width || 1);
    this.#pointer = { x: (e.clientX - rect.left) * k - padL, y: (e.clientY - rect.top) * k, over: true };
  };

  readonly #onLeave = () => {
    this.#pointer.over = false;
  };
}

define('ui-voice-ring', UiVoiceRing);

declare global {
  interface HTMLElementTagNameMap {
    'ui-voice-ring': UiVoiceRing;
  }
}
