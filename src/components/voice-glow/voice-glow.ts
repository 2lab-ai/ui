import { define, UiElement } from '../../core/element';
import { readLevel, type VoiceLevelSource } from './engine/audio';
import { parseRgb, toTriple } from './engine/color';
import {
  type VoiceGlowConfig,
  VoiceGlowDriver,
  type VoiceGlowGather,
  type VoiceGlowLayers,
  type VoiceGlowTick,
} from './engine/driver';
import { EnvWatch, hostIsDark, motionOf, motionReduced, pageHidden, runFrame, type VoiceMotion } from './engine/env';
import type { PixelPort } from './engine/pixel';
import {
  pixelDomeDefault,
  pixelDustDefault,
  pixelGlowDefault,
  resolveVoiceDefaults,
  resolveVoiceStyle,
  type VoiceGlowLook,
  type VoiceGlowType,
} from './engine/presets';
import {
  BAND_COLORS,
  DISTORT_ID,
  generateVoiceGlowCss,
  lobeColors,
  themePresets,
  VOICE_GLOW_PALETTES,
  type VoiceGlowPalette,
  voicePalettes,
} from './engine/styles';
import { styles } from './styles';

export type VoiceGlowLang = 'en' | 'ko';
export type VoiceGlowBandColors = { core?: string; above?: string; mid?: string; below?: string };
export type VoiceGlowGatherSource = VoiceGlowGather | (() => VoiceGlowGather | null | undefined) | null;

/**
 * Everything the library's `<VoiceBeam>` took as props, as data. Every field is optional; the `type` preset (and the
 * theme, and the look) supplies the defaults, and a field you set wins.
 */
export interface VoiceGlowData {
  /** Host preset: 'default' (a ~350px chat input), 'pill' (a ~150×44 recording pill), 'mobile' (a phone screen). */
  type?: VoiceGlowType;
  /** 'glow' coloured light, or 'dither' the same glow as ordered-dither pixels. */
  look?: VoiceGlowLook;
  /** The palette (the library's `colorVariant`). */
  palette?: VoiceGlowPalette;
  /** Alias of `palette`, the library's name. */
  colorVariant?: VoiceGlowPalette;
  /** Up to seven lobe colours, centre first then the pairs outward (hex or rgb); a bad one keeps its slot's. */
  colors?: string[];
  /** The band's ridge and fringe colours (hex or rgb). */
  bandColors?: VoiceGlowBandColors;
  /** The level, 0–1 — a number, or a getter read every frame (the same as the `level` property). */
  level?: VoiceLevelSource;
  /** Audio to react to; wins over `level` (the same as the `stream` property). Never stopped by the element. */
  stream?: MediaStream | null;
  /** Whether the glow is on (the library's `active`; the same as the `listening` attribute). */
  listening?: boolean;
  /** Freeze the frame without fading out. */
  paused?: boolean;
  /** The glow gathered into one beam and where it sits (the library's `motion` prop), or a getter. */
  gather?: VoiceGlowGatherSource;
  /** What the live region says while listening, instead of “Listening”. */
  label?: string;
  /** Called every frame with the smoothed level the glow shows. */
  onLevel?: (level: number) => void;
  /** The dither's pixels fly into this element as listening ends, and out of it as it starts. */
  pixelExitTarget?: HTMLElement | null;
  scale?: number;
  sensitivity?: number;
  threshold?: number;
  attack?: number;
  release?: number;
  idle?: number;
  breatheDuration?: number;
  reach?: number;
  spread?: number;
  bands?: boolean;
  flow?: number;
  staticColors?: boolean;
  hueRange?: number;
  hueDuration?: number;
  borderRadius?: number;
  brightness?: number;
  saturation?: number;
  glowSize?: number;
  strokeOpacity?: number;
  innerOpacity?: number;
  bloomOpacity?: number;
  bend?: number;
  bandStrength?: number;
  bandWidth?: number;
  bandPosition?: number;
  bandCurve?: number;
  bandSpread?: number;
  bandSkew?: number;
  bandOffset?: number;
  bandTail?: number;
  bandTailPosition?: number;
  bandTailCurve?: number;
  bandTailOverflow?: number;
  bandAberration?: number;
  distortion?: number;
  distortionDetail?: number;
  glowWidth?: number;
  glowHeight?: number;
  lobeSpacing?: number;
  rangeWidth?: number;
  rangeHeight?: number;
  softness?: number;
  coreSize?: number;
  coreLight?: number;
  coreLightWidth?: number;
  coreLightHeight?: number;
  strokeScale?: number;
  innerScale?: number;
  innerHeight?: number;
  bloomScale?: number;
  bloomHeight?: number;
  strength?: number;
  pixelSize?: number;
  pixelGlow?: number;
  pixelDust?: number;
  pixelDome?: number;
  pixelMagnet?: number;
}

/** What the element draws with now: the driver's config, the stylesheet, and the shape of the markup. */
export interface VoiceGlowResolved {
  type: VoiceGlowType;
  look: VoiceGlowLook;
  palette: VoiceGlowPalette;
  theme: 'dark' | 'light';
  motion: VoiceMotion;
  radius: number;
  strength: number;
  distortionDetail: number;
  config: VoiceGlowConfig;
  css: string;
}

const STRINGS = {
  en: { listening: 'Listening' },
  ko: { listening: '듣는 중' },
};

const BORDER_WIDTH = 1;
const DEFAULT_RADIUS = 16;
/* WebKit evaluates SVG filters on HTML content on the CPU every paint, so the displacement warp is off there above
   this host area (a chat input keeps it, a phone screen does not). */
const WEBKIT_WARP_MAX_AREA = 60_000;
const TYPES: readonly VoiceGlowType[] = ['default', 'pill', 'mobile'];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A finite number from a field or attribute, clamped to [lo, hi]; otherwise `dflt`. */
function num(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? clamp(n, lo, hi) : dflt;
}

function oneOf<T extends string>(v: unknown, list: readonly T[], dflt: T): T {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return (list as readonly string[]).includes(s) ? (s as T) : dflt;
}

/** The host preset for a value; anything else is 'default'. */
export function voiceGlowType(v: unknown): VoiceGlowType {
  return oneOf(v, TYPES, 'default');
}

/** The palette for a value; anything else is 'colorful'. */
export function voiceGlowPalette(v: unknown): VoiceGlowPalette {
  return oneOf(v, VOICE_GLOW_PALETTES, 'colorful');
}

function isWebKit(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    /AppleWebKit/.test(navigator.userAgent) &&
    !/Chrome\/|Chromium\/|Edg\/|OPR\//.test(navigator.userAgent)
  );
}

let canvasFilter: boolean | null = null;
/** Whether the 2D canvas can blur its own strokes (not on WebKit): otherwise the band gets a second canvas. */
function hasCanvasFilter(): boolean {
  if (canvasFilter == null) {
    try {
      const ctx = document.createElement('canvas').getContext('2d');
      canvasFilter = !!ctx && typeof (ctx as { filter?: unknown }).filter === 'string';
    } catch {
      canvasFilter = false;
    }
  }
  return canvasFilter;
}

/**
 * Resolve the data, the attributes and the surroundings into what the glow draws with — the library's prop
 * resolution (VoiceBeam.tsx) verbatim: the type preset, then the theme, then the look supply the defaults; a field
 * wins; `scale` multiplies every px dimension.
 */
export function resolveVoiceGlow(
  d: VoiceGlowData,
  env: {
    type?: unknown;
    look?: unknown;
    palette?: unknown;
    dark: boolean;
    motion: VoiceMotion;
    reduced: boolean;
    paused: boolean;
    detectedRadius?: number | null;
    webkitLarge?: boolean;
  },
): VoiceGlowResolved {
  const type = voiceGlowType(d.type ?? env.type);
  const look: VoiceGlowLook = oneOf(d.look ?? env.look, ['glow', 'dither'] as const, 'glow');
  const palette = voiceGlowPalette(d.palette ?? d.colorVariant ?? env.palette);
  const theme = env.dark ? 'dark' : 'light';
  const g = resolveVoiceDefaults(type, theme, look);
  const sc = num(d.scale, 0.05, 20, Math.max(0.05, g.scale));
  const preset = themePresets[theme];
  const typeStyle = resolveVoiceStyle(type, theme);
  const v = (x: unknown, lo: number, hi: number, dflt: number) => num(x, lo, hi, dflt);
  const glowSize = v(d.glowSize, 0, 20, g.glowSize);
  const strokeOpacityMul = v(d.strokeOpacity, 0, 10, g.strokeOpacity);
  const innerOpacityMul = v(d.innerOpacity, 0, 10, g.innerOpacity);
  const bloomOpacityMul = v(d.bloomOpacity, 0, 10, g.bloomOpacity);
  const glowWidth = v(d.glowWidth, 0, 20, g.glowWidth) * sc;
  const glowHeight = v(d.glowHeight, 0, 20, g.glowHeight) * sc;
  const rangeWidth = v(d.rangeWidth, 0, 20, g.rangeWidth) * sc;
  const rangeHeight = v(d.rangeHeight, 0, 20, g.rangeHeight) * sc;
  const softness = v(d.softness, 0, 5, g.softness);
  const coreSize = v(d.coreSize, 0, 20, g.coreSize) * sc;
  const coreLight = v(d.coreLight, 0, 3, g.coreLight);
  const coreLightWidth = v(d.coreLightWidth, 0, 20, g.coreLightWidth);
  const coreLightHeight = v(d.coreLightHeight, 0, 20, g.coreLightHeight);
  const strokeScale = v(d.strokeScale, 0, 20, g.strokeScale);
  const innerScale = v(d.innerScale, 0, 20, g.innerScale);
  const innerHeight = v(d.innerHeight, 0, 20, g.innerHeight);
  const bloomScale = v(d.bloomScale, 0, 20, g.bloomScale);
  const bloomHeight = v(d.bloomHeight, 0, 20, g.bloomHeight);
  const strength = v(d.strength, 0, 1, typeStyle.strength ?? preset.strength ?? 1);
  const brightness = v(d.brightness, 0, 10, typeStyle.brightness ?? preset.brightness);
  const saturation = v(d.saturation, 0, 10, typeStyle.saturation ?? preset.saturation);
  const hueRange = v(d.hueRange, 0, 360, preset.hueRange ?? 24);
  const hueDuration = v(d.hueDuration, 0.5, 600, preset.hueDuration ?? 12);
  const radius = v(d.borderRadius, 0, 10_000, env.detectedRadius ?? DEFAULT_RADIUS);
  const onCanvas = look === 'dither';
  const distortionBase = v(d.distortion, 0, 1, g.distortion);
  const distortion = onCanvas || env.webkitLarge ? 0 : distortionBase;
  const custom = Array.isArray(d.colors) ? d.colors : undefined;
  const colors = lobeColors(palette, theme, custom);
  const bc = d.bandColors && typeof d.bandColors === 'object' ? d.bandColors : {};
  const pixelGlow = v(d.pixelGlow, 0, 1, pixelGlowDefault(type, look));

  const config: VoiceGlowConfig = {
    sensitivity: v(d.sensitivity, 0, 100, 3.1),
    threshold: v(d.threshold, 0, 0.95, 0.015),
    attack: v(d.attack, 0, 30, 0.325),
    release: v(d.release, 0, 30, 0.86),
    idle: v(d.idle, 0, 1, g.idle),
    breatheDuration: v(d.breatheDuration, 0.2, 600, 5.2),
    reach: v(d.reach, 0, 50, g.reach),
    spread: v(d.spread, 0, 50, g.spread),
    bands: d.bands !== false,
    flow: v(d.flow, -10_000, 10_000, g.flow) * sc,
    lobeSpacing: Math.max(0.1, v(d.lobeSpacing, 0, 20, g.lobeSpacing) * sc),
    bend: v(d.bend, 0, 10_000, g.bend) * sc,
    bandStrength: v(d.bandStrength, 0, 20, g.bandStrength),
    bandWidth: v(d.bandWidth, 0, 50, g.bandWidth) * sc,
    bandPosition: v(d.bandPosition, 0, 5, g.bandPosition),
    bandCurve: v(d.bandCurve, 0.3, 20, g.bandCurve),
    bandSpread: v(d.bandSpread, 0.05, 20, g.bandSpread),
    bandSkew: v(d.bandSkew, -0.9, 0.9, g.bandSkew),
    bandOffset: v(d.bandOffset, -10_000, 10_000, g.bandOffset) * sc,
    bandTail: v(d.bandTail, 0, 1.5, g.bandTail),
    bandTailPosition: v(d.bandTailPosition, 0, 0.98, g.bandTailPosition),
    bandTailCurve: v(d.bandTailCurve, 0.5, 20, g.bandTailCurve),
    bandTailOverflow: v(d.bandTailOverflow, 0, 10_000, g.bandTailOverflow) * sc,
    bandAberration: v(d.bandAberration, 0, 1, g.bandAberration),
    rangeWidth,
    rangeHeight,
    theme,
    bandColors: {
      core: toTriple(bc.core) || BAND_COLORS[theme].core,
      above: toTriple(bc.above) || BAND_COLORS[theme].above,
      mid: toTriple(bc.mid) || BAND_COLORS[theme].mid,
      below: toTriple(bc.below) || BAND_COLORS[theme].below,
    },
    distortion,
    coreLight,
    scale: sc,
    radius,
    hueRange,
    hueDuration,
    staticColors: palette === 'mono' ? true : d.staticColors === true,
    reducedMotion: env.reduced,
    paused: env.paused,
    look,
    palette: voicePalettes[palette][theme].map((c, i) => parseRgb(custom?.[i]) || parseRgb(c) || [255, 255, 255]),
    saturation,
    hueBase: preset.hueBase ?? 0,
    pixelSize: v(d.pixelSize, 0.3, 20, g.pixelSize),
    pixelGlow,
    pixelDust: v(d.pixelDust, 0, 60, pixelDustDefault(type)),
    pixelDome: v(d.pixelDome, 0, 10, pixelDomeDefault(type)),
    pixelMagnet: v(d.pixelMagnet, 0, 1, 0.7),
    layers: {
      glowWidth,
      glowHeight,
      innerScale,
      innerHeight,
      bloomScale,
      bloomHeight,
      strokeScale,
      softness,
      coreSize,
      innerOpacity: innerOpacityMul,
      bloomOpacity: bloomOpacityMul,
      strokeOpacity: strokeOpacityMul,
      brightness,
    },
  };

  const css = generateVoiceGlowCss({
    borderRadius: radius,
    borderWidth: BORDER_WIDTH,
    strokeOpacity: preset.strokeOpacity * strokeOpacityMul,
    innerOpacity: preset.innerOpacity * innerOpacityMul,
    bloomOpacity: preset.bloomOpacity * bloomOpacityMul,
    innerShadow: preset.innerShadow,
    colors,
    mono: palette === 'mono',
    brightness,
    saturation,
    theme,
    hueBase: preset.hueBase ?? 0,
    glowSize: glowSize * sc,
    glowWidth,
    glowHeight,
    strokeScale,
    innerScale,
    innerHeight,
    bloomScale,
    bloomHeight,
    coreSize,
    coreLight,
    coreLightWidth,
    coreLightHeight,
    rangeWidth,
    rangeHeight,
    softness,
    distortion: distortion > 0,
    scale: sc,
    look: onCanvas ? 'pixel' : 'glow',
  });

  return {
    type,
    look,
    palette,
    theme,
    motion: env.motion,
    radius,
    strength,
    distortionDetail: v(d.distortionDetail, 0.01, 50, g.distortionDetail) / sc,
    config,
    css,
  };
}

/**
 * `<ui-voice-glow>` — a glow that rises with a voice from the bottom of the element it wraps: a chat input, a search
 * bar, a recording pill, the bottom of a phone screen. Seven soft lobes of colour fan out from the centre of the
 * bottom edge, painted into the edge stroke, as light inside and as a blurred bloom; as the voice rises they grow,
 * spread and slide sideways, and the glow's ceiling bends upward under a band of light with chromatic fringes.
 *
 * Level in: `level` (0–1, a number or a getter read every frame) or `stream` (a MediaStream the host opened — the
 * element never asks for the microphone, never stops the tracks, and closes the analyser it made on disconnect).
 * `listening` turns it on (a fade in) and off (a fade out). No frames while off, paused and painted, off screen or in
 * a hidden tab. Reduced motion stops the breathing, flow, hue drift, distortion and magnet; the glow still answers
 * the level, since it is a meter.
 *
 * Ported from Libraries.dev's Voice (`voice-glow` 0.5.0, MIT, © 2026 Jakub Antalik — https://libraries.dev/voice).
 */
export class UiVoiceGlow extends UiElement<VoiceGlowData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return ['listening', 'paused', 'level', 'type', 'look', 'palette', 'motion', 'theme', 'lang', 'label'];
  }

  #driver: VoiceGlowDriver | null = null;
  #frame: HTMLElement | null = null;
  #sheet: HTMLStyleElement | null = null;
  #status: HTMLElement | null = null;
  #slot: HTMLSlotElement | null = null;
  #shape = '';
  #resolved: VoiceGlowResolved | null = null;
  #level: VoiceLevelSource = 0;
  #levelSet = false;
  #stream: MediaStream | null = null;
  #seenData: VoiceGlowData | undefined;
  #gather: VoiceGlowGatherSource = null;
  #raf = 0;
  #visible = true;
  #dark = true;
  #themeStale = true;
  #radius: number | null = null;
  #area = 0;
  #fadeWas = 0;
  #shown = 0;
  #ro: ResizeObserver | null = null;
  #io: IntersectionObserver | null = null;
  #env: EnvWatch;

  constructor() {
    super();
    this.#env = new EnvWatch(this, (what) => {
      if (what === 'theme') this.#themeStale = true;
      if (what === 'visibility') {
        if (pageHidden()) this.#stop();
        else this.#kick();
        return;
      }
      this.requestRender();
    });
    this.addEventListener('pointermove', this.#onPointer, { passive: true });
    this.addEventListener('pointerdown', this.#onPointer, { passive: true });
    this.addEventListener('pointerleave', this.#onLeave, { passive: true });
    this.addEventListener('pointercancel', this.#onLeave, { passive: true });
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if (old === value) return;
    if (name === 'theme') this.#themeStale = true;
    if (name === 'level' && !this.#levelSet) this.#level = readLevel(value);
    this.requestRender();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#visible = true;
    this.#themeStale = true;
    this.#env.connect();
    if (typeof ResizeObserver === 'function') {
      this.#ro = new ResizeObserver((entries) => {
        const box = entries[entries.length - 1]?.contentRect;
        if (!box) return;
        const area = box.width * box.height;
        const large = (a: number) => a > WEBKIT_WARP_MAX_AREA;
        if (isWebKit() && large(area) !== large(this.#area)) this.requestRender();
        this.#area = area;
      });
      this.#ro.observe(this);
    }
    if (typeof IntersectionObserver === 'function') {
      this.#io = new IntersectionObserver(
        (entries) => {
          const e = entries[entries.length - 1];
          if (!e) return;
          this.#visible = e.isIntersecting;
          if (this.#visible) this.#kick();
          else this.#stop();
        },
        { rootMargin: '256px' },
      );
      this.#io.observe(this);
    }
  }

  override disconnectedCallback(): void {
    this.#stop();
    this.#env.disconnect();
    this.#ro?.disconnect();
    this.#io?.disconnect();
    this.#ro = null;
    this.#io = null;
    // The analyser (and, with the last one, the shared AudioContext) closes; the host's tracks are left running.
    this.#driver?.releaseAudio();
    if (this.#driver) this.#driver.pointer = null;
    super.disconnectedCallback();
  }

  // ── Properties ───────────────────────────────────────────────────────────────────────────────────────────────

  /** The level, 0–1: a number, or a getter read every frame. Setting it never re-renders. */
  get level(): VoiceLevelSource {
    return this.#level;
  }
  set level(value: VoiceLevelSource) {
    this.#levelSet = true;
    this.#level = typeof value === 'function' ? value : readLevel(value);
    this.#kick();
  }

  /** A MediaStream the host opened (e.g. from its own getUserMedia call); wins over `level`. */
  get stream(): MediaStream | null {
    return this.#stream;
  }
  set stream(value: MediaStream | null) {
    this.#stream = value ?? null;
    this.#driver?.setStream(this.#stream);
    this.#frame?.toggleAttribute('data-listening', !!this.#stream);
    this.#kick();
  }

  /** Whether the glow is on: fades in and follows the level; off, it fades out and stops. */
  get listening(): boolean {
    return this.hasAttribute('listening');
  }
  set listening(on: boolean) {
    this.toggleAttribute('listening', !!on);
  }

  /** Hold the frame where it is, without fading out. */
  get paused(): boolean {
    return this.hasAttribute('paused');
  }
  set paused(on: boolean) {
    this.toggleAttribute('paused', !!on);
  }

  /** The smoothed level the glow shows now, 0–1 (the library's `onLevel` value). */
  get shownLevel(): number {
    return this.#shown;
  }

  /** True while the frame loop is scheduled. */
  get running(): boolean {
    return this.#raf !== 0;
  }

  /** What it draws with now (after the last render). */
  get resolved(): VoiceGlowResolved | null {
    return this.#resolved;
  }

  get #lang(): VoiceGlowLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  // ── Render ───────────────────────────────────────────────────────────────────────────────────────────────────

  #syncData(): void {
    const d = this.data;
    if (d === this.#seenData) return;
    this.#seenData = d;
    if (!d) return;
    if ('level' in d) {
      this.#levelSet = true;
      this.#level = typeof d.level === 'function' ? d.level : readLevel(d.level);
    }
    if ('stream' in d) this.stream = d.stream ?? null;
    if (typeof d.listening === 'boolean' && d.listening !== this.listening) this.listening = d.listening;
    if (typeof d.paused === 'boolean' && d.paused !== this.paused) this.paused = d.paused;
    this.#gather = d.gather ?? null;
  }

  #resolve(): VoiceGlowResolved {
    if (this.#themeStale) {
      this.#themeStale = false;
      this.#dark = hostIsDark(this);
    }
    const motion = motionOf(this.getAttribute('motion'));
    return resolveVoiceGlow(this.data ?? {}, {
      type: this.getAttribute('type'),
      look: this.getAttribute('look'),
      palette: this.getAttribute('palette'),
      dark: this.#dark,
      motion,
      reduced: motionReduced(motion),
      paused: this.paused,
      detectedRadius: this.#radius,
      webkitLarge: isWebKit() && this.#area > WEBKIT_WARP_MAX_AREA,
    });
  }

  protected render(): string {
    const r = this.#resolved ?? this.#resolve();
    const dither = r.look === 'dither';
    const warp = r.config.distortion > 0;
    const parts = ['<slot></slot>'];
    if (dither) {
      parts.push(
        '<canvas data-pixel-glow aria-hidden="true"></canvas>',
        '<canvas data-pixel aria-hidden="true"></canvas>',
        '<canvas data-flyers aria-hidden="true"></canvas>',
      );
    } else {
      parts.push('<div data-bloom></div>');
      if (warp) parts.push('<div data-warp="inner"></div>', '<div data-warp="bloom"></div>');
      if (!hasCanvasFilter()) parts.push('<canvas data-band-halo aria-hidden="true"></canvas>');
      parts.push('<canvas data-band aria-hidden="true"></canvas>');
      if (r.config.coreLight > 0) parts.push('<div data-core><div></div></div>');
      if (warp) {
        const f = r.distortionDetail;
        parts.push(
          `<svg aria-hidden="true" focusable="false" width="0" height="0"><filter id="${DISTORT_ID}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${(0.012 * f).toFixed(4)} ${(0.05 * f).toFixed(4)}" numOctaves="2" seed="7" result="noise"></feTurbulence><feOffset in="noise" dx="0" dy="0" result="moved"></feOffset><feColorMatrix in="moved" type="matrix" values="1 0 0 0 0  0 0 0 0 0.5  0 0 0 0 0  0 0 0 0 1" result="map"></feColorMatrix><feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap></filter></svg>`,
        );
      }
    }
    return `<style data-vg></style><div class="vg" part="frame" data-halfres>${parts.join('')}</div><span class="sr-only" role="status" aria-live="polite"></span>`;
  }

  /** The markup is drawn once per shape (look, warp, epicentre) and patched in place otherwise. */
  protected override update(): void {
    this.#syncData();
    const r = this.#resolve();
    this.#resolved = r;
    const shape = `${r.look}|${r.config.distortion > 0}|${r.config.coreLight > 0}|${r.look === 'glow' && r.config.distortion > 0 ? r.distortionDetail.toFixed(4) : ''}`;
    if (shape !== this.#shape || !this.#frame) {
      this.#shape = shape;
      this.content.innerHTML = this.render();
      this.#frame = this.content.querySelector<HTMLElement>('.vg');
      this.#sheet = this.content.querySelector<HTMLStyleElement>('style[data-vg]');
      this.#status = this.content.querySelector<HTMLElement>('[role="status"]');
      this.#slot?.removeEventListener('slotchange', this.#onSlot);
      this.#slot = this.content.querySelector('slot');
      this.#slot?.addEventListener('slotchange', this.#onSlot);
      this.#attach(r);
      this.#detectRadius();
    }
    const frame = this.#frame as HTMLElement;
    if (this.#sheet && this.#sheet.textContent !== r.css) this.#sheet.textContent = r.css;
    frame.dataset.type = r.type;
    frame.dataset.look = r.look;
    frame.dataset.theme = r.theme;
    frame.toggleAttribute('data-listening', !!this.#stream);
    frame.style.setProperty('--voice-strength', String(r.strength));
    const driver = this.#driver as VoiceGlowDriver;
    driver.setConfig(r.config);
    driver.setStream(this.#stream);
    const on = this.listening;
    if (on !== driver.on) this.#turn(on, r);
    frame.toggleAttribute('data-on', driver.visible);
    const label = String(this.data?.label ?? this.getAttribute('label') ?? '').trim();
    const said = on ? label || STRINGS[this.#lang].listening : '';
    if (this.#status && this.#status.textContent !== said) this.#status.textContent = said;
    this.#kick(true);
    this.updated();
  }

  #attach(r: VoiceGlowResolved): void {
    const root = this.#frame as HTMLElement;
    const q = <E extends Element>(s: string) => root.querySelector<E>(s);
    const layers: VoiceGlowLayers = {
      root,
      band: q<HTMLCanvasElement>('[data-band]'),
      bandHalo: q<HTMLCanvasElement>('[data-band-halo]'),
      pixel: q<HTMLCanvasElement>('[data-pixel]'),
      pixelGlow: q<HTMLCanvasElement>('[data-pixel-glow]'),
      flyers: q<HTMLCanvasElement>('[data-flyers]'),
      filter: q<SVGFilterElement>('filter'),
      displace: q<SVGFEDisplacementMapElement>('feDisplacementMap'),
      noiseShift: q<SVGFEOffsetElement>('feOffset'),
    };
    if (!this.#driver) {
      this.#driver = new VoiceGlowDriver(layers, r.config, {
        getLevel: () => readLevel(this.#level),
        getGather: () => {
          const g = this.#gather;
          return typeof g === 'function' ? g() : g;
        },
      });
    } else this.#driver.attach(layers);
  }

  #turn(on: boolean, r: VoiceGlowResolved): void {
    const driver = this.#driver as VoiceGlowDriver;
    const target = this.data?.pixelExitTarget;
    const port = r.look === 'dither' && target instanceof Element ? this.#portOf(target) : null;
    if (!on && port) driver.release(port);
    driver.setOn(on);
    if (on && port) driver.summon(port);
    this.#fadeWas = driver.s.fade;
  }

  #portOf(target: Element): PixelPort | null {
    const frame = this.#frame;
    if (!frame) return null;
    const host = frame.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    return { x: t.left + t.width / 2 - host.left, y: t.top + t.height / 2 - host.top, w: t.width, h: t.height };
  }

  readonly #onSlot = () => {
    this.#detectRadius();
  };

  /** The first slotted element's corner radius, as the library auto-detects it. */
  #detectRadius(): void {
    const child = this.#slot?.assignedElements?.({ flatten: true })[0];
    let next: number | null = null;
    if (child) {
      try {
        const raw = Number.parseFloat(getComputedStyle(child).borderTopLeftRadius);
        if (Number.isFinite(raw) && raw > 0) next = raw;
      } catch {
        next = null;
      }
    }
    if (next !== this.#radius) {
      this.#radius = next;
      this.requestRender();
    }
  }

  // ── The frame loop ───────────────────────────────────────────────────────────────────────────────────────────

  /** Whether frames are needed: visible, on screen, the tab shown, and on or fading — and not a paused still. */
  #needsFrames(): boolean {
    const d = this.#driver;
    if (!d || !this.isConnected || !this.#visible || pageHidden()) return false;
    if (d.settled) return false;
    if (this.paused && d.s.fade >= 1 && d.on) return this.#needsPaint;
    return true;
  }

  #needsPaint = true;

  #kick(changed = false): void {
    if (changed) this.#needsPaint = true;
    if (this.#raf || !this.#needsFrames()) return;
    this.#driver?.resetPacing();
    this.#raf = requestAnimationFrame(this.#loop);
  }

  #stop(): void {
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#raf = 0;
  }

  readonly #loop = (ts: number) => {
    this.#raf = 0;
    const d = this.#driver;
    const frame = this.#frame;
    if (!d || !frame) return;
    // A throwing frame (a host's getter, a canvas that cannot draw) is logged once; the loop, and the fade, go on.
    const out: { t: VoiceGlowTick | null } = { t: null };
    runFrame(this, 'ui-voice-glow', () => {
      out.t = d.tick(ts);
    });
    const t = out.t ?? { painted: true, level: d.s.level, fade: d.s.fade };
    if (t.painted) {
      this.#needsPaint = false;
      this.#shown = t.level;
      try {
        this.data?.onLevel?.(t.level);
      } catch {
        /* the host's callback threw: the glow goes on */
      }
      if (t.fade >= 1 && this.#fadeWas < 1 && d.on) this.notify('ui-voice-activate', { listening: true });
      if (t.fade <= 0 && this.#fadeWas > 0 && !d.on) {
        frame.removeAttribute('data-on');
        this.#shown = 0;
        this.notify('ui-voice-deactivate', { listening: false });
      }
      this.#fadeWas = t.fade;
    }
    if (this.#needsFrames()) this.#raf = requestAnimationFrame(this.#loop);
  };

  // ── The dither's magnet ──────────────────────────────────────────────────────────────────────────────────────

  readonly #onPointer = (e: PointerEvent) => {
    const d = this.#driver;
    const frame = this.#frame;
    if (!d || !frame || this.#resolved?.look !== 'dither' || !(this.#resolved.config.pixelMagnet > 0)) return;
    const r = frame.getBoundingClientRect();
    d.pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  readonly #onLeave = () => {
    if (this.#driver) this.#driver.pointer = null;
  };
}

define('ui-voice-glow', UiVoiceGlow);

declare global {
  interface HTMLElementTagNameMap {
    'ui-voice-glow': UiVoiceGlow;
  }
}
