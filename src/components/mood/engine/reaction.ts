/**
 * The reaction and the mood's hold: what turns a score that moves every 66 ms into a value a screen can follow without
 * flicker. As Libraries.dev's Mood recognition page describes it: one number from 0 to 1 that starts at 0.30 of the
 * reading and is full at the 0.65 alert line, rises within about a tenth of a second, and once calm holds a second,
 * then eases back over a few seconds — or about half a minute while the pointer rests (someone stuck may be reading).
 * A mood holds for a second before it fades. Written for @2lab.ai/ui; no code from the kit.
 */
import { ALERT_LINE, clamp01, MOOD_LINE, type MoodScores, type MoodSignal } from './types';

/** Rising: a 40 ms time constant (about 0.1 s to arrive). Falling: 1.2 s, or 10 s while the pointer rests. */
const RISE_MS = 40;
const FALL_MS = 1200;
const FALL_RESTING_MS = 10_000;
/** How long the reaction and the mood hold once the score falls. */
export const HOLD_MS = 1000;
/** A second mood takes over only when it is this much stronger than the one shown. */
const SWITCH_MARGIN = 0.1;

/** The reaction a score asks for: 0 up to 0.30, full from the 0.65 alert line, linear between. */
export function reactionFor(score: number): number {
  return clamp01((score - MOOD_LINE) / (ALERT_LINE - MOOD_LINE));
}

export interface ReactionState {
  value: number;
  holdUntil: number;
  last: number;
}

export function reactionState(now = 0): ReactionState {
  return { value: 0, holdUntil: Number.NEGATIVE_INFINITY, last: now };
}

/** One step of the reaction toward `target` at `now`; `resting`: the pointer is in the window but has not moved. */
export function stepReaction(s: ReactionState, target: number, now: number, resting: boolean): number {
  const dt = Math.max(0, now - s.last);
  s.last = now;
  const t = clamp01(target);
  if (t >= s.value - 0.005) {
    s.value += (t - s.value) * (1 - Math.exp(-dt / RISE_MS));
    if (t > 0) s.holdUntil = now + HOLD_MS;
  } else if (now >= s.holdUntil) {
    s.value += (t - s.value) * (1 - Math.exp(-dt / (resting ? FALL_RESTING_MS : FALL_MS)));
  }
  if (s.value < 0.001) s.value = 0;
  return s.value;
}

export interface MoodPick {
  mood: MoodSignal | null;
  holdUntil: number;
}

export function moodPick(): MoodPick {
  return { mood: null, holdUntil: Number.NEGATIVE_INFINITY };
}

const SIGNALS: readonly MoodSignal[] = ['frustrated', 'confused', 'lost'];

/** The strongest mood and its score (frustrated first on a tie). */
export function strongest(scores: MoodScores): { mood: MoodSignal; score: number } {
  let mood: MoodSignal = 'frustrated';
  for (const m of SIGNALS) if (scores[m] > scores[mood]) mood = m;
  return { mood, score: scores[mood] };
}

/**
 * The mood to show at `now`: the strongest over the 0.30 line; the one shown keeps its place until another is 0.1
 * stronger, and holds 1 s after its score falls under the line.
 */
export function pickMood(p: MoodPick, scores: MoodScores, now: number): MoodSignal | null {
  const top = strongest(scores);
  if (p.mood && scores[p.mood] >= MOOD_LINE) {
    if (top.mood !== p.mood && top.score >= scores[p.mood] + SWITCH_MARGIN) p.mood = top.mood;
    p.holdUntil = now + HOLD_MS;
  } else if (top.score >= MOOD_LINE) {
    p.mood = top.mood;
    p.holdUntil = now + HOLD_MS;
  } else if (p.mood && now >= p.holdUntil) {
    p.mood = null;
  }
  return p.mood;
}
