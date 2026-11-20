/**
 * Bundled presets of the img-fx effect, ported from Libraries.dev's `img-fx` 0.5.2 (`src/presets/*.ts`, MIT, © 2026
 * Jakub Antalik — https://libraries.dev/image). The values are the library's verbatim; only the dot-mode blocks
 * (`dotConfig`, `dotDuration`, `dotEasing` — unreachable, no bundled preset draws dots) are left out.
 *
 *   • pixels-organic  — Chromium Flow (effect 22) as a pixel mosaic
 *   • pixels-mechanic — Nebula (effect 11) as a pixel mosaic
 *   • sweep-gradient  — Gradient Sweep (effect 25): a diagonal band with per-cell flicker
 *
 * Each preset ships a `dark` and a `light` block; the element picks one from the luminance of the surface it sits on.
 */

export type PresetName = 'pixels-organic' | 'pixels-mechanic' | 'sweep-gradient';
export type PresetTheme = 'dark' | 'light';

/** Per-cell mosaic configuration for pixel-mode rendering. */
export interface MosaicConfig {
  /** Cell-size 0..1; converted in shader to `floor(6 + cellSize*74)` cells. */
  cellSize: number;
  /** Inter-cell spacing 0..1. */
  gap: number;
  /** Highlight scale boost 0..1. */
  hlScale: number;
  /** Background fill opacity (the gaps' share of a cell). */
  fillOpacity: number;
  /** Opacity of a drawn cell. */
  dotOpacity: number;
  /** Edge fade band in CSS px. */
  edgeFade: number;
  /** Edge fade strength 0..1. */
  fadeStr: number;
}

export type EasingKey =
  | 'linear'
  | 'smoothstep'
  | 'easeOutCubic'
  | 'easeOutQuint'
  | 'easeInOutCubic'
  | 'easeOutExpo'
  | 'easeOutBack';

export type MaskShape =
  | 'shader'
  | 'shaderHighlight'
  | 'shaderColor1'
  | 'shaderColor2'
  | 'shaderColor3'
  | 'shaderColor4'
  | 'shaderColor5'
  | 'radialCenter'
  | 'radialCorner'
  | 'linearTop'
  | 'linearBottom'
  | 'linearLeft'
  | 'linearRight'
  | 'diagonalTL'
  | 'diagonalBR'
  | 'diamond'
  | 'blindsH'
  | 'blindsV'
  | 'gradientSweep';

/** Reveal animation tunings (per-mode). */
export interface RevealConfig {
  /** Duration of the shader-based reveal mask animation (sec). */
  duration: number;
  /** Easing key applied during the reveal animation. */
  easing: EasingKey;
  /** Mask-shape type (geometric or shader-driven). */
  maskShape: MaskShape;
  /** Mask edge softness 0..1. */
  softness: number;
  /** Max CSS-px blur applied to the mask canvas during reveal. */
  blur: number;
  /** Pixel-cell dissolve duration (sec). */
  pixDuration: number;
  /** Easing for the pixel-cell dissolve. */
  pixEasing: EasingKey;
}

export type Palette7 = [string, string, string, string, string, string, string];

/** A single theme-mode block of a preset. */
export interface PresetMode {
  theme: PresetTheme;
  effectIndex: number;
  colors: Palette7;
  alphas: [number, number, number, number, number, number, number];
  cardBg: string;
  /** 0 = off (raw shader), 1 = pixels. */
  dotMode: 0 | 1;
  pixelConfig: MosaicConfig;
  /** Drift angle (degrees). */
  direction: number;
  speed: number;
  intensity: number;
  scale: number;
  softness: number;
  distortion: number;
  /** Gradient sweep cell flicker amplitude 0..1. */
  flicker?: number;
  complexity: number;
  shape: number;
  blur: number;
  highlight: number;
  vignette: number;
  vigOpacity: number;
  shaderOpacity: number;
  /** Gradient sweep movement easing type (0..4). */
  sweepEase?: number;
  revealConfig: RevealConfig;
  /** Human-readable effect name. */
  effect: string;
}

export interface Preset {
  name: PresetName;
  modes: Record<PresetTheme, PresetMode>;
}

const PIXEL_DARK: MosaicConfig = {
  cellSize: 0.22,
  gap: 0.14,
  hlScale: 0.8,
  fillOpacity: 0.44,
  dotOpacity: 0.68,
  edgeFade: 24,
  fadeStr: 1,
};
const PIXEL_LIGHT: MosaicConfig = {
  cellSize: 0.22,
  gap: 0.14,
  hlScale: 0.8,
  fillOpacity: 0.18,
  dotOpacity: 0.68,
  edgeFade: 20,
  fadeStr: 1,
};
const ALPHAS: PresetMode['alphas'] = [1, 1, 1, 1, 1, 1, 1];
const SHARED_FIELDS = { softness: 0.76, distortion: 0.3, complexity: 0.2, shape: 0.52, blur: 1, shaderOpacity: 1 };

/** `presets/preset-pixels-style-3.json` — pixel renderer + Chromium Flow (organic chrome ridges). */
export const PIXELS_ORGANIC: Preset = {
  name: 'pixels-organic',
  modes: {
    dark: {
      theme: 'dark',
      effectIndex: 22,
      colors: ['#0f0f0f', '#4a4949', '#b9b9b9', '#0f0f0f', '#d8d8d8', '#0f0f0f', '#2f2f2f'],
      alphas: ALPHAS,
      cardBg: '#0f0f0f',
      dotMode: 1,
      pixelConfig: PIXEL_DARK,
      direction: 0,
      speed: 0.3,
      intensity: 1,
      scale: 1,
      ...SHARED_FIELDS,
      highlight: 0.2,
      vignette: 0.26,
      vigOpacity: 1,
      revealConfig: {
        duration: 3,
        easing: 'easeOutCubic',
        maskShape: 'shaderColor4',
        softness: 0.5,
        blur: 0,
        pixDuration: 2.65,
        pixEasing: 'easeOutCubic',
      },
      effect: 'Chromium Flow',
    },
    light: {
      theme: 'light',
      effectIndex: 22,
      colors: ['#e3e3e3', '#ffffff', '#f5f5f5', '#f5f5f5', '#080808', '#f5f5f5', '#f5f5f5'],
      alphas: ALPHAS,
      cardBg: '#f5f5f5',
      dotMode: 1,
      pixelConfig: PIXEL_LIGHT,
      direction: 25,
      speed: 0.3,
      intensity: 0.85,
      scale: 1,
      ...SHARED_FIELDS,
      highlight: 0.7,
      vignette: 0,
      vigOpacity: 0,
      revealConfig: {
        duration: 3,
        easing: 'easeOutCubic',
        maskShape: 'shaderColor4',
        softness: 0.5,
        blur: 0,
        pixDuration: 2.55,
        pixEasing: 'easeOutCubic',
      },
      effect: 'Chromium Flow',
    },
  },
};

/** `presets/preset-pixels-style-4.json` — pixel renderer + Nebula (a mechanical, structured pixel mosaic). */
export const PIXELS_MECHANIC: Preset = {
  name: 'pixels-mechanic',
  modes: {
    dark: {
      theme: 'dark',
      effectIndex: 11,
      colors: ['#949494', '#2d2d2d', '#333333', '#3a3a3a', '#0b0b0b', '#060606', '#2f2f2f'],
      alphas: ALPHAS,
      cardBg: '#0f0f0f',
      dotMode: 1,
      pixelConfig: PIXEL_DARK,
      direction: 0,
      speed: 0.7,
      intensity: 1,
      scale: 1.4,
      ...SHARED_FIELDS,
      flicker: 0.5,
      highlight: 0.32,
      vignette: 0.26,
      vigOpacity: 1,
      revealConfig: {
        duration: 3,
        easing: 'easeOutCubic',
        maskShape: 'shaderColor4',
        softness: 0.5,
        blur: 0,
        pixDuration: 2.65,
        pixEasing: 'easeOutCubic',
      },
      effect: 'Nebula',
    },
    light: {
      theme: 'light',
      effectIndex: 11,
      colors: ['#e0e0e0', '#fdfdfd', '#f2f2f2', '#0a0a0a', '#dcdcdc', '#f5f5f5', '#f5f5f5'],
      alphas: ALPHAS,
      cardBg: '#f5f5f5',
      dotMode: 1,
      pixelConfig: PIXEL_LIGHT,
      direction: 25,
      speed: 0.55,
      intensity: 0.85,
      scale: 0.9,
      ...SHARED_FIELDS,
      flicker: 0.5,
      highlight: 0.92,
      vignette: 0,
      vigOpacity: 0,
      revealConfig: {
        duration: 3,
        easing: 'easeOutCubic',
        maskShape: 'shaderColor3',
        softness: 0.5,
        blur: 0,
        pixDuration: 2.6,
        pixEasing: 'easeOutCubic',
      },
      effect: 'Nebula',
    },
  },
};

/** Gradient Sweep — a fast top-left → bottom-right band with per-cell flicker that reads as "generating". */
export const SWEEP_GRADIENT: Preset = {
  name: 'sweep-gradient',
  modes: {
    dark: {
      theme: 'dark',
      effectIndex: 25,
      colors: ['#0f0f0f', '#0f0f0f', '#282828', '#3a3a3a', '#525252', '#0f0f0f', '#0f0f0f'],
      alphas: ALPHAS,
      cardBg: '#0f0f0f',
      dotMode: 1,
      pixelConfig: PIXEL_DARK,
      direction: 0,
      speed: 2.65,
      intensity: 1,
      scale: 1,
      ...SHARED_FIELDS,
      flicker: 0.5,
      highlight: 0.32,
      vignette: 0.26,
      vigOpacity: 1,
      sweepEase: 1,
      revealConfig: {
        duration: 3,
        easing: 'easeOutCubic',
        maskShape: 'gradientSweep',
        softness: 0.5,
        blur: 0,
        pixDuration: 2.65,
        pixEasing: 'easeOutCubic',
      },
      effect: 'Gradient Sweep',
    },
    light: {
      theme: 'light',
      effectIndex: 25,
      colors: ['#f5f5f5', '#f5f5f5', '#ededed', '#eaeaea', '#d2d2d2', '#f5f5f5', '#f5f5f5'],
      alphas: ALPHAS,
      cardBg: '#f5f5f5',
      dotMode: 1,
      pixelConfig: PIXEL_LIGHT,
      direction: 0,
      speed: 2.65,
      intensity: 0.85,
      scale: 1,
      ...SHARED_FIELDS,
      flicker: 0.5,
      highlight: 0.92,
      vignette: 0,
      vigOpacity: 0,
      sweepEase: 1,
      revealConfig: {
        duration: 3,
        easing: 'easeOutCubic',
        maskShape: 'gradientSweep',
        softness: 0.5,
        blur: 0,
        pixDuration: 2.6,
        pixEasing: 'easeOutCubic',
      },
      effect: 'Gradient Sweep',
    },
  },
};

export const PRESETS: Readonly<Record<PresetName, Preset>> = Object.freeze({
  'pixels-organic': PIXELS_ORGANIC,
  'pixels-mechanic': PIXELS_MECHANIC,
  'sweep-gradient': SWEEP_GRADIENT,
});

export const PRESET_NAMES = Object.keys(PRESETS) as PresetName[];

/** The regenerate churn always runs on one of these pixel-mosaic presets. */
export const PIXEL_CHURN_PRESETS: readonly PresetName[] = ['pixels-mechanic', 'pixels-organic'];

const clamp01 = (n: number): number => Math.max(0, Math.min(255, n)) / 255;

/** A channel list (`0 0 0`, `0, 0, 0`, `0 0 0 / 1`) as three numbers, or null. */
function triple(args: string, scale: number): [number, number, number] | null {
  const nums = args.match(/-?\d*\.?\d+(?:e-?\d+)?%?/gi);
  if (!nums || nums.length < 3) return null;
  const v = (t: string) => (t.endsWith('%') ? (Number.parseFloat(t) / 100) * scale : Number.parseFloat(t));
  const out: [number, number, number] = [v(nums[0]), v(nums[1]), v(nums[2])];
  return out.every(Number.isFinite) ? out : null;
}

/**
 * Cached 2D context for colours the fast paths do not read (named colours, `hsl()` …): the browser's own parser,
 * through `fillStyle`. Allocated once per page.
 */
let colorCtx: CanvasRenderingContext2D | null | undefined;
function getColorCtx(): CanvasRenderingContext2D | null {
  if (colorCtx !== undefined) return colorCtx;
  colorCtx = null;
  try {
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = 1;
      c.height = 1;
      colorCtx = c.getContext('2d');
    }
  } catch {
    colorCtx = null;
  }
  return colorCtx;
}

/**
 * Parse a CSS colour to normalised `[r, g, b]` in 0..1 (alpha dropped: the shader's `u_cardBg` is opaque RGB).
 * Fast paths, no DOM: hex (`#rgb`, `#rrggbb`, `#rrggbbaa`), `rgb()` / `rgba()`, `color(srgb …)` — what
 * `getComputedStyle` hands back. Anything else goes through the browser's canvas parser (two sentinels, so a
 * rejected value is told apart from one that canonicalises to a sentinel). Unparseable → black.
 */
export function parseCssColor(input: string): [number, number, number] {
  if (typeof input !== 'string') return [0, 0, 0];
  const s = input.trim().toLowerCase();
  if (s.length === 0) return [0, 0, 0];
  if (s[0] === '#') {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if ((h.length === 6 || h.length === 8) && /^[0-9a-f]+$/.test(h)) {
      return [
        Number.parseInt(h.slice(0, 2), 16) / 255,
        Number.parseInt(h.slice(2, 4), 16) / 255,
        Number.parseInt(h.slice(4, 6), 16) / 255,
      ];
    }
    return [0, 0, 0];
  }
  const fn = /^(rgba?|color)\((.*)\)$/.exec(s);
  if (fn) {
    if (fn[1] === 'color') {
      const m = /^(srgb|srgb-linear|display-p3)\s+(.*)$/.exec(fn[2].trim());
      const t = m ? triple(m[2], 1) : null;
      if (t) return [Math.max(0, Math.min(1, t[0])), Math.max(0, Math.min(1, t[1])), Math.max(0, Math.min(1, t[2]))];
    } else {
      const t = triple(fn[2], 255);
      if (t) return [clamp01(t[0]), clamp01(t[1]), clamp01(t[2])];
    }
  }
  const ctx = getColorCtx();
  if (!ctx) return [0, 0, 0];
  ctx.fillStyle = '#000000';
  ctx.fillStyle = input;
  const after1 = String(ctx.fillStyle);
  ctx.fillStyle = '#ffffff';
  ctx.fillStyle = input;
  const after2 = String(ctx.fillStyle);
  if (after1 !== after2) return [0, 0, 0];
  if (after1[0] === '#' || /^(rgba?|color)\(/.test(after1)) return parseCssColor(after1);
  return [0, 0, 0];
}

const lum = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b;

/** Relative luminance (Rec. 601 weights, as the shader's) of a CSS colour, 0..1. */
export function colorLuminance(color: string): number {
  const [r, g, b] = parseCssColor(color);
  return lum(r, g, b);
}

/** `[r, g, b]` in 0..1 → `#rrggbb`. */
export function toHex(rgb: readonly [number, number, number]): string {
  return `#${rgb
    .map((v) =>
      Math.round(Math.max(0, Math.min(1, v)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** Mix two `[r, g, b]` colours: `t` = 0 is `a`, 1 is `b`. */
export function mixRgb(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Named palettes the effect can wear instead of its greys. Picture data, not UI chrome. */
export type PaletteName = 'preset' | 'accent' | 'ocean' | 'ember';
export const PALETTE_NAMES: readonly PaletteName[] = ['preset', 'accent', 'ocean', 'ember'];

/** The Libraries.dev playground's "Ocean" and "Ember" palettes, dark to light. */
export const NAMED_PALETTES: Readonly<Record<'ocean' | 'ember', readonly string[]>> = Object.freeze({
  ocean: Object.freeze(['#06141f', '#0b3954', '#1b6f8a', '#2f9fbf', '#76c6dc', '#bfe6ef', '#e6f7fa']),
  ember: Object.freeze(['#1c0904', '#5c1a0b', '#9c3410', '#d9601a', '#f28f2c', '#ffc27a', '#ffe7c7']),
});

/** An accent ramp: the accent, darkened toward black and lifted toward white, dark to light. */
export function accentRamp(accent: string): string[] {
  const a = parseCssColor(accent);
  const black: [number, number, number] = [0, 0, 0];
  const white: [number, number, number] = [1, 1, 1];
  return [
    toHex(mixRgb(a, black, 0.8)),
    toHex(mixRgb(a, black, 0.55)),
    toHex(mixRgb(a, black, 0.25)),
    toHex(a),
    toHex(mixRgb(a, white, 0.35)),
    toHex(mixRgb(a, white, 0.65)),
    toHex(mixRgb(a, white, 0.85)),
  ];
}

/**
 * Map a palette onto a preset mode's seven slots by luminance RANK (the same mapping img-fx's regenerate tint uses
 * for colours sampled from an image): the darkest slot gets the palette's darkest colour (5th percentile), the
 * lightest its lightest (95th), so the effect keeps its authored contrast structure. Slots authored equal to the
 * preset's card colour stay `null` — they are "card variables" that follow the surface, and the mosaic's gaps.
 */
export function rankPalette(
  mode: Pick<PresetMode, 'colors' | 'cardBg'>,
  palette: readonly string[],
): (string | null)[] {
  const pool = palette
    .map((c) => {
      const rgb = parseCssColor(c);
      return { hex: toHex(rgb), lum: lum(rgb[0], rgb[1], rgb[2]) };
    })
    .sort((a, b) => a.lum - b.lum);
  const out: (string | null)[] = mode.colors.map(() => null);
  if (pool.length === 0) return out;
  const bg = toHex(parseCssColor(mode.cardBg));
  const ranked = mode.colors
    .map((color, slot) => {
      const rgb = parseCssColor(color);
      return { slot, hex: toHex(rgb), lum: lum(rgb[0], rgb[1], rgb[2]) };
    })
    .filter((s) => s.hex !== bg)
    .sort((a, b) => a.lum - b.lum);
  for (let rank = 0; rank < ranked.length; rank++) {
    const q = 0.05 + (0.9 * rank) / Math.max(1, ranked.length - 1);
    const p = pool[Math.min(pool.length - 1, Math.round(q * (pool.length - 1)))];
    out[ranked[rank].slot] = p.hex;
  }
  return out;
}
