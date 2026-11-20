/**
 * Pure helpers the metal elements resolve their options with — every attribute and `data` field goes through one of
 * these, clamped to its range, before it reaches the engine. Exported and unit-tested.
 */
import type { PresetName, PresetTheme } from './engine/presets';
import { RIM_DEFAULTS, type RimOptions } from './engine/rim';

export type MetalVariant = 'button' | 'circle';
export type MetalPreset = PresetName;
/** `auto` follows the page (its `data-theme` / tokens, else `prefers-color-scheme`); `dark` / `light` pin it. */
export type MetalTheme = 'auto' | PresetTheme;
/** `system` follows `prefers-reduced-motion`; `reduce` is always a still frame; `full` always moves. */
export type MetalMotion = 'system' | 'reduce' | 'full';
export type MetalGlowMode = 'mask' | 'ring';

/** The light rim along the ring's top inside edge (`innerShadow`): CSS px, 0 … 1 alpha, `#rrggbb`. */
export interface MetalInnerShadow {
  offsetY?: number;
  blur?: number;
  alpha?: number;
  color?: string;
}

/** A neighbour that catches the metal's reflection (dark theme only). `glyphs` lights its letterforms only. */
export interface MetalReflectionTarget {
  el: HTMLElement;
  /** Alpha multiplier, 0 … 2 (default 1) — keep a container the element sits in faint (0.3 or so). */
  strength?: number;
  /** Light the target's glyphs, not its box (a word next to metal text). */
  glyphs?: boolean;
}

export const METAL_PRESETS: readonly MetalPreset[] = ['chromatic', 'silver', 'gold'];

/** A finite number from a data field or an attribute string, clamped to [min, max]; `fallback` otherwise. */
export function metalNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** An optional number: undefined when absent or not a number, else clamped. */
export function metalOptionalNumber(value: unknown, min: number, max: number): number | undefined {
  const n = metalNumber(value, min, max, Number.NaN);
  return Number.isNaN(n) ? undefined : n;
}

/** A boolean data field or a boolean attribute: true / '' / 'true' / present → true; false / 'false' → false. */
export function metalFlag(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  if (s === '' || s === 'true' || s === 'on' || s === '1') return true;
  if (s === 'false' || s === 'off' || s === '0') return false;
  return fallback;
}

const lower = (v: unknown): string =>
  String(v ?? '')
    .trim()
    .toLowerCase();

export function metalPreset(value: unknown): MetalPreset {
  const s = lower(value);
  return (METAL_PRESETS as readonly string[]).includes(s) ? (s as MetalPreset) : 'chromatic';
}

export function metalVariant(value: unknown): MetalVariant {
  return lower(value) === 'circle' ? 'circle' : 'button';
}

export function metalTheme(value: unknown): MetalTheme {
  const s = lower(value);
  return s === 'dark' || s === 'light' ? s : 'auto';
}

export function metalMotion(value: unknown): MetalMotion {
  const s = lower(value);
  return s === 'reduce' || s === 'full' ? s : 'system';
}

export function metalGlowMode(value: unknown, fallback: MetalGlowMode): MetalGlowMode {
  const s = lower(value);
  return s === 'mask' || s === 'ring' ? s : fallback;
}

/** Whether motion is reduced: `reduce` always, `full` never, `system` as the person asked. */
export function metalReduced(motion: MetalMotion, prefersReduced: boolean): boolean {
  return motion === 'reduce' || (motion === 'system' && prefersReduced);
}

/** The theme the preset is drawn for: a pinned one, else the page's color scheme (`dark` when it says dark). */
export function metalResolvedTheme(theme: MetalTheme, colorScheme: string, prefersDark: boolean): PresetTheme {
  if (theme !== 'auto') return theme;
  const s = lower(colorScheme);
  if (/\bdark\b/.test(s) && !/\blight\b/.test(s)) return 'dark';
  if (/\blight\b/.test(s) && !/\bdark\b/.test(s)) return 'light';
  return prefersDark ? 'dark' : 'light';
}

/** A `#rrggbb` colour (the rim tints pixel data with it), from `#rgb` / `#rrggbb` / `#rrggbbaa`; `fallback` else. */
export function metalHexColor(value: unknown, fallback = '#ffffff'): string {
  const s = lower(value);
  const m = /^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/.exec(s);
  if (!m) return fallback;
  const h = m[1];
  if (h.length === 3) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  return `#${h.slice(0, 6)}`;
}

/**
 * The ring's inner-shadow rim: off (null) for false / absent, the design defaults for true / '' (a bare attribute),
 * an object merged over the defaults and clamped (offsetY −4 … 4 px, blur 0 … 4 px, alpha 0 … 1, colour `#rrggbb`).
 */
export function metalInnerShadow(value: unknown): RimOptions | null {
  if (value === undefined || value === null || value === false) return null;
  if (value === true) return { ...RIM_DEFAULTS };
  if (typeof value === 'string') return metalFlag(value, false) ? { ...RIM_DEFAULTS } : null;
  if (typeof value !== 'object') return null;
  const o = value as MetalInnerShadow;
  return {
    offsetY: metalNumber(o.offsetY, -4, 4, RIM_DEFAULTS.offsetY),
    blur: metalNumber(o.blur, 0, 4, RIM_DEFAULTS.blur),
    alpha: metalNumber(o.alpha, 0, 1, RIM_DEFAULTS.alpha),
    color: metalHexColor(o.color, RIM_DEFAULTS.color),
  };
}

/**
 * The corner radius the ring is drawn with (CSS px). `circle` is a promise of a circle: min(w, h) / 2 whatever the
 * child's CSS says (under CSS zoom the computed radius and the measured box disagree). Otherwise the explicit
 * `borderRadius`, else the child's own radius, else the root's; never more than half the short side.
 */
export function metalRadius(
  kind: 'pill' | 'circle',
  w: number,
  h: number,
  explicit: number | undefined,
  childRadius: number,
  rootRadius: number,
): number {
  const half = Math.max(0, Math.min(w, h) / 2);
  if (kind === 'circle') return half;
  const raw =
    typeof explicit === 'number' && Number.isFinite(explicit)
      ? explicit
      : Number.isFinite(childRadius) && childRadius > 0
        ? childRadius
        : Number.isFinite(rootRadius)
          ? rootRadius
          : 0;
  return Math.max(0, Math.min(raw, half));
}

/**
 * Glyph sample points for the glow in mask mode: every ~2 CSS px grid cell whose mask alpha is over half, in box-local
 * CSS px. `alpha` is the mask's RGBA data at `w` × `h` device px.
 */
export function metalMaskPoints(
  alpha: ArrayLike<number>,
  w: number,
  h: number,
  dpr: number,
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  const step = Math.max(1, Math.round(2 * dpr));
  for (let y = step >> 1; y < h; y += step) {
    for (let x = step >> 1; x < w; x += step) {
      if (alpha[(y * w + x) * 4 + 3] > 128) pts.push({ x: x / dpr, y: y / dpr });
    }
  }
  return pts;
}

/** Space-separated ids (the `reflect` attribute), de-duplicated, empty ones dropped. */
export function metalIdList(value: unknown): string[] {
  const out: string[] = [];
  for (const id of String(value ?? '').split(/\s+/)) if (id && !out.includes(id)) out.push(id);
  return out;
}

/**
 * A CSS value the host passes for `prop` (a font shorthand, a colour), or '' when it is not one: no angle brackets,
 * braces, semicolons, escapes or `url()`, at most 200 characters, and — where the browser can say — a value `prop`
 * accepts. The elements set it through CSSOM, never into markup; this keeps junk out of the style too.
 */
export function metalCssValue(prop: string, value: unknown): string {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s || s.length > 200 || /[<>{};\\]|url\(|expression\(/i.test(s)) return '';
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') return CSS.supports(prop, s) ? s : '';
  return s;
}
