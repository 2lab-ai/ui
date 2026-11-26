/**
 * The mood reader without a DOM: inputs in (a move, a press, a scroll, a key, a sent form, the window's state), one
 * reading out per step. `createMoodReader()` feeds it from the page's events; tests and replays feed it directly with
 * their own clock. Written for @2lab.ai/ui from the behaviour Libraries.dev's Mood recognition page describes.
 */
import { moodPick, pickMood, reactionFor, reactionState, stepReaction, strongest } from './reaction';
import { fastSignals, since } from './signals';
import {
  cellOf,
  confusedOf,
  emptyHistory,
  frustratedOf,
  LOOK_30_MS,
  lostOf,
  type MoodHistory,
  REVISIT_GAP_MS,
  SLOW_MS,
} from './slow';
import {
  AWAY_IDLE_MS,
  DEFAULT_BASELINE,
  DEFAULT_REACT_TO,
  MOOD_LINE,
  type MoodBaseline,
  type MoodFacts,
  type MoodReading,
  type MoodScores,
  type MoodSignal,
  type MoodTarget,
  NO_FACTS,
  STEP_MS,
} from './types';

export interface MoodCoreOptions {
  /** The moods the reaction rises for. Default frustrated, confused and lost. */
  reactTo?: readonly MoodSignal[];
  /** The person's pace to start from (a stored baseline); default typical values. */
  baseline?: Partial<MoodBaseline> | null;
  /** The clock's start (ms). */
  now?: number;
}

/** The pointer resting this long (in the window, not moving) makes the reaction ease back slowly. */
const RESTING_MS = 1500;
/** A fast frustration (shake, quick presses) crossing this starts an episode. */
const EPISODE_LINE = 0.5;
/** Two failed sends this close together are one. */
const FAIL_BURST_MS = 300;

const ZERO: MoodScores = { frustrated: 0, confused: 0, lost: 0 };

/** A baseline from stored or partial values, each kept in range (speed 200 … 3000 px/s, press gap 250 … 3000 ms). */
export function moodBaseline(v?: Partial<MoodBaseline> | null): MoodBaseline {
  const num = (x: unknown, d: number, lo: number, hi: number) =>
    typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d;
  return {
    speed: num(v?.speed, DEFAULT_BASELINE.speed, 200, 3000),
    pressGap: num(v?.pressGap, DEFAULT_BASELINE.pressGap, 250, 3000),
    n: num(v?.n, 0, 0, Number.MAX_SAFE_INTEGER),
  };
}

/** The `reactTo` list from an array or a space/comma separated string; unknown names dropped. Empty → the default. */
export function moodReactTo(v: unknown): MoodSignal[] {
  const parts = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[\s,]+/) : [];
  const out = parts
    .map((p) => String(p).trim().toLowerCase())
    .filter((p): p is MoodSignal => p === 'frustrated' || p === 'confused' || p === 'lost');
  return out.length ? [...new Set(out)] : [...DEFAULT_REACT_TO];
}

export function emptyReading(at = 0): MoodReading {
  return {
    mood: null,
    reaction: 0,
    score: 0,
    scores: { ...ZERO },
    fast: 0,
    fastKind: null,
    alert: false,
    away: false,
    target: null,
    at,
  };
}

export class MoodCore {
  baseline: MoodBaseline;
  reactTo: Set<MoodSignal>;
  /** The baseline changed since it was last taken (the reader stores it). */
  baselineDirty = false;
  #h: MoodHistory;
  #reaction = reactionState();
  #pick = moodPick();
  #slow: MoodScores = { ...ZERO };
  #slowAt = Number.NEGATIVE_INFINITY;
  #inside = false;
  #outOfWindow = false;
  #hidden = false;
  #lastInput: number;
  #lastMove = Number.NEGATIVE_INFINITY;
  #lastCell: string | null = null;
  #cellSeen = new Map<string, number>();
  #scrollers = new Map<string, { pos: number; dir: number; run: number }>();
  #prevFastFr = 0;
  #reading: MoodReading;

  constructor(o: MoodCoreOptions = {}) {
    const now = o.now ?? 0;
    this.baseline = moodBaseline(o.baseline);
    this.reactTo = new Set(moodReactTo(o.reactTo));
    this.#h = emptyHistory(now);
    this.#reaction = reactionState(now);
    this.#lastInput = now;
    this.#reading = emptyReading(now);
  }

  /** The history the slow reading looks at (read-only use: tests and the HUD). */
  get history(): Readonly<MoodHistory> {
    return this.#h;
  }

  /** The last reading made by {@link step}. */
  get reading(): MoodReading {
    return this.#reading;
  }

  /** Forget what was seen (a new step of the flow); the person's pace is kept. */
  reset(now: number): void {
    this.#h = emptyHistory(now);
    this.#reaction = reactionState(now);
    this.#pick = moodPick();
    this.#slow = { ...ZERO };
    this.#slowAt = Number.NEGATIVE_INFINITY;
    this.#lastCell = null;
    this.#cellSeen.clear();
    this.#scrollers.clear();
    this.#prevFastFr = 0;
    this.#lastInput = now;
    this.#reading = emptyReading(now);
  }

  /** The pointer moved to (x, y) inside the scope at `t`, over an element with these facts. */
  pointer(x: number, y: number, t: number, facts: MoodFacts = NO_FACTS): void {
    const s = this.#h.samples;
    const last = s[s.length - 1];
    this.#input(t);
    this.#outOfWindow = false;
    this.#inside = true;
    if (last && t - last.t < 8 && Math.hypot(x - last.x, y - last.y) < 2) return;
    if (!last || x !== last.x || y !== last.y) this.#lastMove = t;
    s.push({ x, y, t });
    // hovering one control without pressing it
    const h = this.#h.hover;
    if (facts.control && facts.control === h.control && t - h.last <= 300) {
      h.ms += t - h.last;
      h.last = t;
      h.target = facts.target;
    } else if (facts.control) {
      this.#h.hover = { control: facts.control, target: facts.target, ms: 0, last: t };
    }
    // returning to a place after being away from it
    const cell = cellOf(x, y);
    if (cell !== this.#lastCell) {
      const seen = this.#cellSeen.get(cell);
      if (seen === undefined || t - seen >= REVISIT_GAP_MS) this.#h.visits.push({ cell, t });
      this.#lastCell = cell;
    }
    this.#cellSeen.set(cell, t);
  }

  /** The pointer left the scope (not the window): what was seen still counts, nothing new comes in. */
  leave(t: number): void {
    this.#inside = false;
    this.#lastCell = null;
    this.#reading = { ...this.#reading, at: t };
  }

  /** A press at (x, y) at `t` on an element with these facts. */
  press(x: number, y: number, t: number, facts: MoodFacts = NO_FACTS): void {
    const prev = this.#h.presses[this.#h.presses.length - 1];
    this.#input(t);
    this.#h.presses.push({ x, y, t, facts });
    if (facts.control && this.#h.hover.control === facts.control) this.#h.hover.ms = 0;
    if (facts.section && facts.control && !facts.disabled) this.#h.sections.push({ control: facts.control, t });
    else if (facts.control && !facts.disabled) this.#h.lastProgress = t;
    // the person's own press cadence, learned while calm
    if (prev && !this.#pick.mood && this.#reaction.value < 0.05) {
      const gap = t - prev.t;
      if (gap > 0 && gap < 3000) {
        this.baseline.pressGap = Math.min(
          3000,
          Math.max(250, this.baseline.pressGap + (gap - this.baseline.pressGap) * 0.1),
        );
        this.baselineDirty = true;
      }
    }
  }

  /** A scroller (any key: one per scrolling element) is at `pos` px at `t`. */
  scroll(key: string, pos: number, t: number): void {
    this.#input(t);
    const st = this.#scrollers.get(key);
    if (!st) {
      this.#scrollers.set(key, { pos, dir: 0, run: 0 });
      return;
    }
    const d = pos - st.pos;
    st.pos = pos;
    if (Math.abs(d) < 1) return;
    const s = Math.sign(d);
    if (st.dir === 0 || s === st.dir) {
      st.dir = s;
      st.run += Math.abs(d);
      return;
    }
    if (st.run >= 120) this.#h.scrollTurns.push(t);
    st.dir = s;
    st.run = Math.abs(d);
  }

  /** A key pressed in a field: only whether it deleted is kept. */
  key(del: boolean, t: number): void {
    this.#input(t);
    this.#h.keys.push({ t, del });
  }

  /** A field changed: progress. */
  change(t: number): void {
    this.#input(t);
    this.#h.lastProgress = t;
  }

  /** A form was sent: `ok` false when it failed (invalid fields). */
  sent(t: number, ok: boolean): void {
    this.#input(t);
    if (ok) {
      this.#h.lastSent = t;
      this.#h.lastProgress = t;
      return;
    }
    const f = this.#h.failedSends;
    if (!f.length || t - f[f.length - 1] > FAIL_BURST_MS) f.push(t);
  }

  /** The pointer left the window (`out` true) or came back. */
  windowOut(out: boolean, t: number): void {
    this.#outOfWindow = out;
    if (out) {
      this.#inside = false;
      this.#lastCell = null;
    } else this.#input(t);
  }

  /** The tab was hidden (`on` true) or shown again. */
  hidden(on: boolean, t: number): void {
    this.#hidden = on;
    if (!on) this.#input(t);
  }

  /** Whether `t` reads as away: the tab hidden, the pointer out of the window, or no input for a minute. */
  away(t: number): boolean {
    return this.#hidden || this.#outOfWindow || t - this.#lastInput >= AWAY_IDLE_MS;
  }

  /**
   * When the reader may stop stepping: calm (no score left to drain, no reaction, no mood), settled, and no input for
   * 3 s. It wakes again on the next input. A score under the line still drains first, so no reading is left stale.
   */
  idle(t: number): boolean {
    const r = this.#reading;
    return (
      t - this.#lastInput >= 3000 && r.reaction === 0 && r.fast < 0.005 && r.score < 0.005 && this.#pick.mood === null
    );
  }

  /** When nothing came in last (ms on the reader's clock). */
  get lastInput(): number {
    return this.#lastInput;
  }

  /** One reading at `t`: the fast signals every call, the slow reading every 250 ms, the reaction smoothed. */
  step(t: number): MoodReading {
    const h = this.#h;
    this.#trim(t);
    const fast = fastSignals(h.samples, h.presses, t, this.baseline);
    const fastFr = Math.max(fast.shake, fast.rage);
    if (fastFr >= EPISODE_LINE && this.#prevFastFr < EPISODE_LINE) h.episodes.push(t);
    this.#prevFastFr = fastFr;
    const slowStep = t - this.#slowAt >= STEP_MS;
    if (slowStep) {
      this.#slow = { frustrated: frustratedOf(h, t), confused: confusedOf(h, t, this.baseline), lost: lostOf(h, t) };
      this.#slowAt = t;
    }
    const scores: MoodScores = {
      frustrated: Math.max(this.#slow.frustrated, fast.shake, fast.rage, fast.disabled),
      confused: Math.max(this.#slow.confused, fast.orbit),
      lost: this.#slow.lost,
    };
    const away = this.away(t);
    const picked = pickMood(this.#pick, scores, t);
    let react = 0;
    for (const m of this.reactTo) react = Math.max(react, scores[m]);
    const resting = !away && this.#inside && t - this.#lastMove >= RESTING_MS;
    const reaction = stepReaction(this.#reaction, away ? 0 : reactionFor(react), t, resting);
    const score = strongest(scores).score;
    // the person's own pointer speed, learned only while calm (a struggle must not become their normal)
    if (slowStep && !picked && score < MOOD_LINE && reaction < 0.05) this.#learnSpeed(t);
    this.#reading = {
      mood: away ? 'away' : picked,
      reaction,
      score,
      scores,
      fast: fast.fast,
      fastKind: fast.kind,
      alert: score >= 0.65,
      away,
      target: this.#target(t, fast.kind),
      at: t,
    };
    return this.#reading;
  }

  /** Any input inside the scope: the person is here, so the pointer is no longer out of the window. */
  #input(t: number): void {
    this.#lastInput = Math.max(this.#lastInput, t);
    this.#outOfWindow = false;
  }

  /** The control a reading is about: the one pressed in a run of presses, else the one hovered, else the last pressed. */
  #target(t: number, kind: string | null): MoodTarget | null {
    const h = this.#h;
    const press = h.presses[h.presses.length - 1];
    if (kind === 'disabled') {
      for (let i = h.presses.length - 1; i >= 0; i--) if (h.presses[i].facts.disabled) return h.presses[i].facts.target;
    }
    if (kind === 'rage' && press) return press.facts.target;
    if (h.hover.control && t - h.hover.last <= 1500 && h.hover.ms >= 1000) return h.hover.target;
    return press && t - press.t < 3000 ? press.facts.target : null;
  }

  /** The person's own pointer speed: the median moving speed of the last 2 s, learned slowly. */
  #learnSpeed(t: number): void {
    const win = since(this.#h.samples, t - 2000, t);
    const speeds: number[] = [];
    for (let i = 1; i < win.length; i++) {
      const dt = win[i].t - win[i - 1].t;
      if (dt <= 0 || dt > 100) continue;
      const v = (Math.hypot(win[i].x - win[i - 1].x, win[i].y - win[i - 1].y) / dt) * 1000;
      if (v > 40) speeds.push(v);
    }
    if (speeds.length < 10) return;
    speeds.sort((a, b) => a - b);
    const median = speeds[speeds.length >> 1];
    const b = this.baseline;
    b.speed = Math.min(3000, Math.max(200, b.speed + (median - b.speed) * 0.02));
    b.n++;
    this.baselineDirty = true;
  }

  #trim(t: number): void {
    const h = this.#h;
    const cut = <T extends { t: number }>(buf: T[], ms: number) => {
      let i = 0;
      while (i < buf.length && buf[i].t < t - ms) i++;
      if (i) buf.splice(0, i);
    };
    cut(h.samples, SLOW_MS);
    cut(h.presses, LOOK_30_MS);
    cut(h.visits, LOOK_30_MS);
    cut(h.sections, LOOK_30_MS);
    cut(h.keys, LOOK_30_MS);
    for (const list of [h.scrollTurns, h.failedSends, h.episodes]) {
      let i = 0;
      while (i < list.length && list[i] < t - LOOK_30_MS) i++;
      if (i) list.splice(0, i);
    }
    if (this.#cellSeen.size > 256) {
      for (const [cell, seen] of this.#cellSeen) if (t - seen > LOOK_30_MS) this.#cellSeen.delete(cell);
    }
  }
}
