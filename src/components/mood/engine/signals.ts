/**
 * The fast signals: the obvious cases, seen within a few hundred milliseconds from the last second or two — the
 * pointer shaken back and forth at speed, the pointer circling one spot, quick presses on one spot or on no control,
 * a press on a disabled control. Pure functions over the reader's sample buffers, so they test without a DOM.
 *
 * Written for @2lab.ai/ui from the behaviour Libraries.dev's Mood recognition page describes; no code from its kit.
 */
import { clamp01, type MoodBaseline, type MoodFastKind, type PointerSample, type PressSample } from './types';

/** The window the shake looks at (ms), the least swing that counts (px). */
export const SHAKE_MS = 900;
const SHAKE_SWING_PX = 8;
/** How far back the orbit may look (ms), and how wide the circled spot may be (px). */
export const ORBIT_MS = 3000;
const ORBIT_BOX_PX = 160;
const ORBIT_MIN_RADIUS_PX = 7;
/** Quick presses: how close together on one spot (px) and how long the run may last (ms). */
const RAGE_SPOT_PX = 30;
const RAGE_MS = 1500;
/** A disabled press holds its strength this long (ms), then fades over as long again. */
export const DISABLED_HOLD_MS = 1500;

/** Samples with `t` in [from, to]. Buffers are in time order, so this walks back from the end. */
export function since<T extends { t: number }>(buf: readonly T[], from: number, to = Number.POSITIVE_INFINITY): T[] {
  let i = buf.length;
  while (i > 0 && buf[i - 1].t >= from) i--;
  const out: T[] = [];
  for (let k = i; k < buf.length; k++) if (buf[k].t <= to) out.push(buf[k]);
  return out;
}

/** The path length of some samples, px. */
export function pathLength(s: readonly PointerSample[]): number {
  let d = 0;
  for (let i = 1; i < s.length; i++) d += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y);
  return d;
}

/** Direction reversals on one axis whose swing before them was at least `swing` px. */
export function reversals(values: readonly number[], swing = SHAKE_SWING_PX): number {
  let dir = 0;
  let start = values[0] ?? 0;
  let count = 0;
  for (let i = 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (Math.abs(d) < 0.5) continue;
    const s = Math.sign(d);
    if (dir === 0) {
      dir = s;
      start = values[i - 1];
    } else if (s !== dir) {
      if (Math.abs(values[i - 1] - start) >= swing) count++;
      dir = s;
      start = values[i - 1];
    }
  }
  return count;
}

/**
 * The shake, 0 … 1: quick swings back and forth on either axis over the last 0.9 s. Four reversals start it, eight
 * make it full, and it only counts at speed — at least 0.6 of the person's own pointer speed (never under 250 px/s).
 */
export function shakeOf(samples: readonly PointerSample[], now: number, base: MoodBaseline): number {
  const win = since(samples, now - SHAKE_MS, now);
  if (win.length < 6) return 0;
  const n = Math.max(reversals(win.map((p) => p.x)), reversals(win.map((p) => p.y)));
  const span = Math.max(1, win[win.length - 1].t - win[0].t);
  const speed = (pathLength(win) / span) * 1000;
  const gate = Math.max(250, 0.6 * base.speed);
  return clamp01((n - 3) / 5) * clamp01(speed / gate);
}

/**
 * The orbit, 0 … 1: the pointer circling one spot. It looks back from now for as long as the pointer stayed inside a
 * 160 px box (up to 3 s) and sums how far the path's heading turned, one way: half a turn reads as nothing, 1.3 turns
 * as full. A straight line turns nothing, a wiggle cancels itself out, and a shake's reversals (a heading flipped
 * end for end) are skipped. Once the path stops bending it fades out between 0.4 and 1.6 s.
 */
export function orbitOf(samples: readonly PointerSample[], now: number): number {
  const o = orbit(samples, now);
  if (o.turns <= 0.5) return 0;
  return clamp01((o.turns - 0.5) / 0.8) * clamp01(1 - (now - o.lastTurn - 400) / 1200);
}

/** How many turns the pointer's heading made inside one small box, looking back from now (see {@link orbitOf}). */
export function orbitTurns(samples: readonly PointerSample[], now: number): number {
  return orbit(samples, now).turns;
}

function orbit(samples: readonly PointerSample[], now: number): { turns: number; lastTurn: number } {
  const none = { turns: 0, lastTurn: Number.NEGATIVE_INFINITY };
  const win = since(samples, now - ORBIT_MS, now);
  if (win.length < 8) return none;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  // the stretch that stayed inside the box, looking back from now
  let first = win.length;
  for (let i = win.length - 1; i >= 0; i--) {
    const p = win[i];
    const x0 = Math.min(minX, p.x);
    const x1 = Math.max(maxX, p.x);
    const y0 = Math.min(minY, p.y);
    const y1 = Math.max(maxY, p.y);
    if (x1 - x0 > ORBIT_BOX_PX || y1 - y0 > ORBIT_BOX_PX) break;
    minX = x0;
    maxX = x1;
    minY = y0;
    maxY = y1;
    first = i;
  }
  // thinned to points 4 px apart, oldest first (each point keeps the time the pointer got there, not a later rest)
  const pts: PointerSample[] = [];
  for (let i = first; i < win.length; i++) {
    const q = pts[pts.length - 1];
    if (!q || Math.hypot(win[i].x - q.x, win[i].y - q.y) >= 4) pts.push(win[i]);
  }
  if (pts.length < 8 || Math.max(maxX - minX, maxY - minY) < 2 * ORBIT_MIN_RADIUS_PX) return none;
  let turned = 0;
  const bends: Array<{ d: number; len: number; t: number }> = [];
  let prev: number | null = null;
  for (let i = 1; i < pts.length; i++) {
    const a = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (prev !== null) {
      let d = a - prev;
      if (d > Math.PI) d -= 2 * Math.PI;
      else if (d < -Math.PI) d += 2 * Math.PI;
      if (Math.abs(d) < 2.5) {
        turned += d;
        bends.push({ d, len, t: pts[i - 1].t });
      }
    }
    prev = a;
  }
  // The last time the path was still circling: over 0.6 s it turned 0.5 rad or more one way, in three or more gentle
  // bends (a sharp kink — where it set off in a new direction — is not circling and is left out).
  let lastTurn = Number.NEGATIVE_INFINITY;
  for (let k = bends.length - 1; k >= 0 && lastTurn === Number.NEGATIVE_INFINITY; k--) {
    let sum = 0;
    const gentle: number[] = [];
    for (let j = k; j >= 0 && bends[j].t >= bends[k].t - 600; j--) {
      if (Math.abs(bends[j].d) > 0.8) continue;
      sum += bends[j].d;
      gentle.push(bends[j].d);
    }
    if (
      Math.abs(sum) >= 0.5 &&
      gentle.filter((d) => Math.sign(d) === Math.sign(sum) && Math.abs(d) >= 0.03).length >= 3
    )
      lastTurn = bends[k].t;
  }
  return { turns: Math.abs(turned) / (2 * Math.PI), lastTurn };
}

/** The longest gap that still makes two presses quick, ms: about half the person's own, between 300 and 650. */
export function quickGap(base: MoodBaseline): number {
  return Math.min(650, Math.max(300, 0.55 * base.pressGap));
}

/**
 * Rage, 0 … 1: quick presses — three or more on one spot, or four or more on no control (three on text is a
 * triple-click that selects a paragraph). Each press within the quick gap of the one before; three read 0.75, four
 * 0.9, five or more 1. It lasts as long as the run is inside the last 1.5 s.
 */
export function rageOf(presses: readonly PressSample[], now: number, base: MoodBaseline): number {
  const win = since(presses, now - RAGE_MS, now).filter((p) => !p.facts.disabled);
  if (win.length < 3) return 0;
  const gap = quickGap(base);
  // the run that ends with the newest press
  let k = win.length - 1;
  while (k > 0 && win[k].t - win[k - 1].t <= gap) k--;
  const run = win.slice(k);
  if (run.length < 3) return 0;
  const last = run[run.length - 1];
  const spot = run.filter((p) => Math.hypot(p.x - last.x, p.y - last.y) <= RAGE_SPOT_PX && p.facts.control !== null);
  const nothing = run.filter((p) => p.facts.control === null);
  const n = Math.max(spot.length >= 3 ? spot.length : 0, nothing.length >= 4 ? nothing.length - 1 : 0);
  if (n < 3) return 0;
  return n >= 5 ? 1 : n === 4 ? 0.9 : 0.75;
}

/**
 * Presses on a disabled control, 0 … 1: one reads 0.6, a second within 1.5 s 0.9, a third 0.95. The strength holds
 * 1.5 s after the last press, then fades over 1.5 s.
 */
export function disabledOf(presses: readonly PressSample[], now: number): number {
  const all = presses.filter((p) => p.facts.disabled && p.t <= now);
  if (!all.length) return 0;
  const last = all[all.length - 1];
  let n = 1;
  for (let i = all.length - 1; i > 0 && all[i].t - all[i - 1].t <= DISABLED_HOLD_MS; i--) n++;
  const level = n >= 3 ? 0.95 : n === 2 ? 0.9 : 0.6;
  const age = now - last.t;
  if (age <= DISABLED_HOLD_MS) return level;
  return level * clamp01(1 - (age - DISABLED_HOLD_MS) / DISABLED_HOLD_MS);
}

export interface FastReading {
  shake: number;
  orbit: number;
  rage: number;
  disabled: number;
  /** The strongest of them. */
  fast: number;
  kind: MoodFastKind | null;
}

/** All four fast signals at `now`, the strongest, and its kind (named from 0.3 up). */
export function fastSignals(
  samples: readonly PointerSample[],
  presses: readonly PressSample[],
  now: number,
  base: MoodBaseline,
): FastReading {
  const r = {
    shake: shakeOf(samples, now, base),
    orbit: orbitOf(samples, now),
    rage: rageOf(presses, now, base),
    disabled: disabledOf(presses, now),
  };
  let kind: MoodFastKind | null = null;
  let fast = 0;
  for (const k of ['disabled', 'rage', 'shake', 'orbit'] as const) {
    if (r[k] > fast) {
      fast = r[k];
      kind = k;
    }
  }
  return { ...r, fast, kind: fast >= 0.3 ? kind : null };
}
