import { type MeterRange, type MeterTone, meterRange, meterValue } from '../meter/meter';

/** `ticks` — short radial ticks along an arc, filled up to the value · `ring` — a thick track with a value arc. */
export type DialShape = 'ticks' | 'ring';
/** `auto` — the meter's tone colours (the thresholds decide) · `accent` — the accent ink, whatever the reading. */
export type DialTone = 'auto' | 'accent';
/** What the delta chip reads in: good (done) · bad (fail) · neither (idle: zero, unknown, or no better direction). */
export type DialDeltaTone = 'done' | 'fail' | 'idle';
export type DialLang = 'en' | 'ko';

/** A change since last time, shown as a chip under the dial ("+4 since last week"). */
export interface DialDelta {
  /** The change, in the reading's own unit (+4, −2.5). */
  value: number;
  /** The words after the number ("since last week"). */
  text?: string;
}

export interface DialData extends MeterRange {
  /** The reading. Missing, null or not a number: unknown (a "?" and nothing filled). */
  value?: number | null;
  /** The accessible name ("Review score"). */
  label?: string;
  /** Words in the middle instead of the number ("12 / 14"). */
  text?: string;
  /** The small line under the number. Default "out of {max}" when the middle shows the bare number; '' hides it. */
  caption?: string;
  /** A unit after the number ("%", "ms"). */
  unit?: string;
  /** A change since last time: a chip under the dial. */
  delta?: DialDelta | null;
  shape?: DialShape;
  /** How many ticks (default 40, 12 … 80). */
  ticks?: number;
  /** The arc in degrees (default 270 for ticks, 360 for a ring; 180 … 360). The opening faces down. */
  arc?: number;
  tone?: DialTone;
  /** The dial's width in px (or a CSS length). Default: --dial-size, else 180px. */
  size?: number | string;
}

/** One tick: a short radial line in the 100 × 100 viewBox. */
export interface DialTick {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const SHAPES: readonly DialShape[] = ['ticks', 'ring'];

/** The viewBox is 100 × 100 around (50, 50). */
export const DIAL_CENTER = 50;
/** Ticks run from this radius … */
export const DIAL_TICK_INNER = 35;
/** … out to this one (their round caps stay inside the box). */
export const DIAL_TICK_OUTER = 46;
/** The ring's stroke width and radius (its outer edge stays inside the box). */
export const DIAL_RING_WIDTH = 8.5;
export const DIAL_RING_RADIUS = 45.5;
/** The longest a tick sweep staggers, start to last tick (ms). */
export const DIAL_STAGGER_MS = 240;
/** The longest wait between two neighbouring ticks of a sweep (ms). */
const STAGGER_STEP_MS = 12;

const round = (n: number) => Math.round(n * 100) / 100 || 0;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function dialShape(v: unknown): DialShape {
  return SHAPES.includes(v as DialShape) ? (v as DialShape) : 'ticks';
}

export function dialTone(v: unknown): DialTone {
  return v === 'accent' ? 'accent' : 'auto';
}

/** The meter's range with the dial's default scale: min 0, max 100 (never below min), optimum max. */
export function dialRange(r: Record<string, unknown> | MeterRange | null | undefined): ReturnType<typeof meterRange> {
  const d = (r ?? {}) as Record<string, unknown>;
  const min = meterValue(d.min);
  const max = meterValue(d.max);
  return meterRange({ ...d, max: Number.isNaN(max) ? Math.max(100, Number.isNaN(min) ? 0 : min) : max });
}

/** The reading as a share of the range, 0 … 1 (clamped); NaN when unknown or the range is empty. Default range 0 … 100. */
export function dialFraction(value: unknown, range?: MeterRange | null): number {
  const v = meterValue(value);
  const { min, max } = dialRange(range);
  if (Number.isNaN(v) || max === min) return Number.NaN;
  return clamp((v - min) / (max - min), 0, 1);
}

/** How many ticks: a whole number from 12 to 80, 40 when not given. */
export function dialTickCount(n: unknown): number {
  const v = meterValue(n);
  return Number.isNaN(v) ? 40 : clamp(Math.round(v), 12, 80);
}

/** The arc in degrees: 180 … 360; 270 for ticks and 360 for a ring when not given. */
export function dialArc(v: unknown, shape: DialShape = 'ticks'): number {
  const a = meterValue(v);
  if (Number.isNaN(a)) return shape === 'ring' ? 360 : 270;
  return clamp(a, 180, 360);
}

/**
 * How many of `n` ticks a share fills: none at 0 (or unknown), all at 1, and in between at least one and never all —
 * a sliver still shows, and a full dial means full.
 */
export function dialFilled(fraction: number, n: number): number {
  if (!(fraction > 0)) return 0;
  if (fraction >= 1) return n;
  return clamp(Math.round(fraction * n), 1, n - 1);
}

/** Where the arc starts, in degrees clockwise from 12 o'clock: centred on the top (the opening faces down); a full ring starts at the top. */
export function dialStartAngle(arc: number): number {
  return arc >= 360 ? 0 : -arc / 2;
}

/** A point on the circle at `deg` degrees clockwise from 12 o'clock. */
export function dialPoint(r: number, deg: number, cx = DIAL_CENTER, cy = DIAL_CENTER): [number, number] {
  const t = (deg * Math.PI) / 180;
  return [round(cx + r * Math.sin(t)), round(cy - r * Math.cos(t))];
}

/** The SVG path of the arc (clockwise, opening down): one elliptical arc, or two halves for a full ring. */
export function dialArcPath(arc: number, r: number, cx = DIAL_CENTER, cy = DIAL_CENTER): string {
  const a = clamp(arc, 1, 360);
  const start = dialStartAngle(a);
  const p = (deg: number) => dialPoint(r, deg, cx, cy).join(' ');
  if (a >= 360) return `M ${p(0)} A ${r} ${r} 0 0 1 ${p(180)} A ${r} ${r} 0 0 1 ${p(360)}`;
  return `M ${p(start)} A ${r} ${r} 0 ${a > 180 ? 1 : 0} 1 ${p(start + a)}`;
}

/** The arc's length in viewBox units (what its stroke-dasharray measures). */
export function dialArcLength(arc: number, r: number): number {
  return round((r * clamp(arc, 1, 360) * Math.PI) / 180);
}

/**
 * The ticks along the arc, first at its start: both ends get one on an open arc; a full ring spaces `n` evenly from
 * the top. `width` is the stroke width that leaves about as much gap as tick at the middle radius.
 */
export function dialTickGeometry(n: number, arc: number): { width: number; ticks: DialTick[] } {
  const count = dialTickCount(n);
  const a = clamp(arc, 180, 360);
  const full = a >= 360;
  const step = full ? 360 / count : a / (count - 1);
  const mid = (DIAL_TICK_INNER + DIAL_TICK_OUTER) / 2;
  const spacing = (2 * Math.PI * mid * step) / 360;
  const width = round(clamp(spacing * 0.5, 1.2, 3.2));
  const start = dialStartAngle(a);
  const ticks: DialTick[] = [];
  for (let i = 0; i < count; i++) {
    const deg = start + i * step;
    const [x1, y1] = dialPoint(DIAL_TICK_INNER, deg);
    const [x2, y2] = dialPoint(DIAL_TICK_OUTER, deg);
    ticks.push({ x1, y1, x2, y2 });
  }
  return { width, ticks };
}

/**
 * The transition delay (ms) of tick `i` when the filled count goes `from` → `to`: the ticks that change wait in the
 * order of the sweep (up the arc when it grows, down when it shrinks), the whole sweep at most `total` ms; every
 * other tick 0.
 */
export function dialStagger(i: number, from: number, to: number, total = DIAL_STAGGER_MS): number {
  if (from === to) return 0;
  const step = Math.min(STAGGER_STEP_MS, total / Math.abs(to - from));
  if (to > from) return i >= from && i < to ? Math.round((i - from) * step) : 0;
  return i >= to && i < from ? Math.round((from - 1 - i) * step) : 0;
}

/**
 * The tone of a change: good when it moves toward `optimum` (up when optimum is nearer max, down when nearer min),
 * bad when away; idle for no change, an unknown change, or an optimum right in the middle.
 */
export function dialDeltaTone(delta: unknown, optimum?: number | null, range?: MeterRange | null): DialDeltaTone {
  const d = meterValue(delta);
  if (Number.isNaN(d) || d === 0) return 'idle';
  const r = dialRange({ ...(range ?? {}), ...(optimum !== undefined && optimum !== null ? { optimum } : {}) });
  const mid = (r.min + r.max) / 2;
  if (r.optimum === mid) return 'idle';
  const up = r.optimum > mid;
  return d > 0 === up ? 'done' : 'fail';
}

/** A number for the middle: whole numbers as they are, otherwise up to two decimals under 10 and one from 10. */
export function dialNumber(v: number, lang: DialLang = 'en'): string {
  if (!Number.isFinite(v)) return '?';
  const digits = Number.isInteger(v) ? 0 : Math.abs(v) < 10 ? 2 : 1;
  return new Intl.NumberFormat(lang === 'ko' ? 'ko-KR' : 'en-US', { maximumFractionDigits: digits }).format(v);
}

/** A signed change: "+4", "−2.5" (a true minus sign), "0". */
export function dialDeltaText(v: number, lang: DialLang = 'en'): string {
  if (!Number.isFinite(v)) return '?';
  if (v > 0) return `+${dialNumber(v, lang)}`;
  if (v < 0) return `−${dialNumber(-v, lang)}`;
  return '0';
}

/** The dial's width as a CSS length: a number is px (48 … 640); a px / rem / em length passes; anything else ''. */
export function dialSize(v: unknown): string {
  const n = meterValue(v);
  if (!Number.isNaN(n)) return n > 0 ? `${clamp(n, 48, 640)}px` : '';
  const s = String(v ?? '').trim();
  return /^\d+(\.\d+)?(px|rem|em)$/.test(s) ? s : '';
}

export type { MeterRange, MeterTone };
