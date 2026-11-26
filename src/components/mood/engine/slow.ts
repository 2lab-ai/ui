/**
 * The slow reading: what takes seconds to show, measured over the last 8 s with some measures looking back 15 or
 * 30 s. In Libraries.dev's kit this is a trained model; here it is a heuristic, one formula per mood, built from the
 * page's description of each mood:
 *
 * - confused — slowing down and turning back, hovering round a control without pressing it, typing and deleting;
 * - lost — returning to the same few places without pressing, opening section after section, scrolling back and
 *   forth, all weighed by how long it has been since any progress;
 * - frustrated — a form sent again after it failed, a blocked step pressed again and again, shakes and quick presses
 *   that keep coming back.
 *
 * Every measure is a position, a timing or an element fact; nothing typed is read. Pure functions over the history the
 * reader keeps, so they test without a DOM.
 */
import { since } from './signals';
import { clamp01, type MoodBaseline, type MoodTarget, noisyOr, type PointerSample, type PressSample } from './types';

/** The slow window and the look-backs (ms). */
export const SLOW_MS = 8000;
export const LOOK_15_MS = 15_000;
export const LOOK_30_MS = 30_000;
/** The grid the revisits are counted on (px), and how long the pointer must be gone for a return to count (ms). */
export const CELL_PX = 96;
export const REVISIT_GAP_MS = 1000;

export interface MoodHover {
  /** The control under the pointer, or null. */
  control: string | null;
  target: MoodTarget | null;
  /** How long the pointer has moved over it without pressing it (ms). */
  ms: number;
  /** When the pointer was last over it. */
  last: number;
}

/** What the slow reading looks at; the reader appends to it and trims it. */
export interface MoodHistory {
  samples: PointerSample[];
  presses: PressSample[];
  /** The pointer entering a grid cell after being away from it for a second or more. */
  visits: Array<{ cell: string; t: number }>;
  /** When the scroll turned back after a run of 120 px or more. */
  scrollTurns: number[];
  /** Presses on controls that open a section. */
  sections: Array<{ control: string; t: number }>;
  /** A form sent while it was invalid (once per burst). */
  failedSends: number[];
  /** Keys pressed in a field: only whether each one deleted. */
  keys: Array<{ t: number; del: boolean }>;
  /** When a fast frustration (a shake, quick presses) crossed 0.5. */
  episodes: number[];
  hover: MoodHover;
  /** The last progress: a press on a control that does something, a field changed, a form sent. */
  lastProgress: number;
  /** The last form sent that did not fail. */
  lastSent: number;
}

/** How many times in a time-ordered list fall in [from, to]. */
export function countSince(times: readonly number[], from: number, to: number): number {
  let n = 0;
  for (let i = times.length - 1; i >= 0 && times[i] >= from; i--) if (times[i] <= to) n++;
  return n;
}

export function emptyHistory(now = 0): MoodHistory {
  return {
    samples: [],
    presses: [],
    visits: [],
    scrollTurns: [],
    sections: [],
    failedSends: [],
    keys: [],
    episodes: [],
    hover: { control: null, target: null, ms: 0, last: Number.NEGATIVE_INFINITY },
    lastProgress: now,
    lastSent: now,
  };
}

/** The grid cell a point is in. */
export function cellOf(x: number, y: number): string {
  return `${Math.floor(x / CELL_PX)}:${Math.floor(y / CELL_PX)}`;
}

/** Points along the path at least `step` px apart. */
export function thin(samples: readonly PointerSample[], step: number): PointerSample[] {
  const out: PointerSample[] = [];
  for (const p of samples) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p.x - q.x, p.y - q.y) >= step) out.push(p);
  }
  return out;
}

const angleBetween = (a: number, b: number) => {
  let d = Math.abs(a - b) % (2 * Math.PI);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d;
};

/**
 * Turn-backs in the last 8 s: the pointer slowing to under 0.4 of the person's own speed and heading back the way it
 * came (a turn of 135° or more), with 30 px or more of travel each side. Turns closer than 0.6 s count once.
 */
export function turnbacksOf(samples: readonly PointerSample[], now: number, base: MoodBaseline): number {
  const pts = thin(since(samples, now - SLOW_MS, now), 10);
  let count = 0;
  let lastTurn = Number.NEGATIVE_INFINITY;
  const slow = 0.4 * base.speed;
  for (let i = 3; i < pts.length - 3; i++) {
    const a = pts[i - 3];
    const m = pts[i];
    const b = pts[i + 3];
    if (Math.hypot(m.x - a.x, m.y - a.y) < 30 || Math.hypot(b.x - m.x, b.y - m.y) < 30) continue;
    const turn = angleBetween(Math.atan2(m.y - a.y, m.x - a.x), Math.atan2(b.y - m.y, b.x - m.x));
    if (turn < (135 * Math.PI) / 180) continue;
    const p = pts[i - 1];
    const v = (Math.hypot(m.x - p.x, m.y - p.y) / Math.max(1, m.t - p.t)) * 1000;
    if (v >= slow || m.t - lastTurn < 600) continue;
    count++;
    lastTurn = m.t;
  }
  return count;
}

/** Hovering over one control without pressing it: nothing under 2 s, full at 5 s. */
export function hoverScore(h: MoodHover, now: number): number {
  if (!h.control || now - h.last > 1500) return 0;
  return clamp01((h.ms - 2000) / 3000);
}

/** Typing and deleting in the last 15 s: with eight keys or more, a share of deletes over 0.35 rises to full at 0.7. */
export function deleteScore(keys: readonly { t: number; del: boolean }[], now: number): number {
  const win = since(keys, now - LOOK_15_MS, now);
  if (win.length < 8) return 0;
  const share = win.filter((k) => k.del).length / win.length;
  return clamp01((share - 0.35) / 0.35);
}

/** Confused, 0 … 1, from the pointer's path and dwell and from typing that keeps being deleted. */
export function confusedOf(h: MoodHistory, now: number, base: MoodBaseline): number {
  const turns = turnbacksOf(h.samples, now, base);
  return noisyOr(0.85 * clamp01((turns - 1) / 3), 0.75 * hoverScore(h.hover, now), 0.5 * deleteScore(h.keys, now));
}

/** Grid cells the pointer came back to three times or more in the last 30 s without pressing anything there. */
export function revisitedCells(h: MoodHistory, now: number): number {
  const counts = new Map<string, number>();
  for (const v of since(h.visits, now - LOOK_30_MS, now)) counts.set(v.cell, (counts.get(v.cell) ?? 0) + 1);
  const pressed = new Set(since(h.presses, now - LOOK_30_MS, now).map((p) => cellOf(p.x, p.y)));
  let n = 0;
  for (const [cell, c] of counts) if (c >= 3 && !pressed.has(cell)) n++;
  return n;
}

/** Distinct sections opened since the last progress, within the last 30 s. */
export function sectionsOpened(h: MoodHistory, now: number): number {
  const from = Math.max(now - LOOK_30_MS, h.lastProgress);
  return new Set(since(h.sections, from, now).map((s) => s.control)).size;
}

/** How long since progress, as a weight: nothing for the first 4 s, full after 20 s. */
export function stallOf(h: MoodHistory, now: number): number {
  return clamp01((now - h.lastProgress - 4000) / 16_000);
}

/** Lost, 0 … 1: searching — revisits without a press, section after section, scrolling back and forth. */
export function lostOf(h: MoodHistory, now: number): number {
  const revisit = clamp01((revisitedCells(h, now) - 1) / 3);
  const sections = clamp01((sectionsOpened(h, now) - 2) / 3);
  const scroll = clamp01((countSince(h.scrollTurns, now - LOOK_15_MS, now) - 1) / 3);
  const search = noisyOr(0.75 * revisit, 0.8 * sections, 0.75 * scroll);
  return search * (0.3 + 0.7 * stallOf(h, now));
}

/**
 * Frustrated, 0 … 1, the slow part: sending again after a failure (counted since the last send that went through —
 * typing between two sends is expected), a blocked step and fast frustrations that recur (both counted since the last
 * progress: once something works, the step is no longer blocked).
 */
export function frustratedOf(h: MoodHistory, now: number): number {
  const fails = countSince(h.failedSends, Math.max(now - LOOK_30_MS, h.lastSent + 1), now);
  const failed = fails >= 3 ? 0.9 : fails === 2 ? 0.7 : fails === 1 ? 0.35 : 0;
  const from = Math.max(now - LOOK_30_MS, h.lastProgress + 1);
  const blockedN = since(h.presses, from, now).filter((p) => p.facts.disabled).length;
  const blocked = blockedN >= 3 ? 0.8 : blockedN === 2 ? 0.5 : 0;
  const episodes = countSince(h.episodes, from, now);
  const recur = episodes >= 2 ? clamp01(0.3 * episodes) : 0;
  return noisyOr(failed, blocked, 0.7 * recur);
}
