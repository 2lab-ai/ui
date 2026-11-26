/**
 * The shapes the mood reader works with. The readings follow the fields of Libraries.dev's Mood recognition React kit
 * as its public page documents them (https://libraries.dev/mood-recognition): `mood`, `reaction`, `score`, `fast`,
 * `fastKind`. No kit or model code is used: the kit, the model (`MoodRecognition.json`) and the loader on that page are
 * under the Libraries.dev Model License, which forbids them in a public repository. This reader is a heuristic of its
 * own, built from the page's description of what each mood looks like.
 */

/** What the reader says about the person: three moods the screen may react to, and away (not looking). */
export type Mood = 'frustrated' | 'confused' | 'lost' | 'away';

/** The moods a reaction can rise for. Away never raises it. */
export type MoodSignal = 'frustrated' | 'confused' | 'lost';

/** The fast signals: seen within a few hundred milliseconds. */
export type MoodFastKind = 'shake' | 'orbit' | 'rage' | 'disabled';

/** The control a reading is about, as facts only: never its text or its value. */
export interface MoodTarget {
  /** Lower-case tag name (`button`, `a`, `input` …). */
  tag: string;
  /** The element's `id`, or ''. */
  id: string;
  /** Its `role` attribute, or ''. */
  role: string;
  disabled: boolean;
  invalid: boolean;
}

/** Each mood's strength, 0 … 1: the higher of the slow heuristic and the fast signals that point to it. */
export interface MoodScores {
  frustrated: number;
  confused: number;
  lost: number;
}

/** One reading, given every 66 ms while the reader is active. */
export interface MoodReading {
  /** The mood, or null while calm or without input. A mood holds 1 s after its score falls under the line. */
  mood: Mood | null;
  /** How strongly the UI should react, 0 … 1: from 0.30 of the score, full at the 0.65 alert line. Also `--mood`. */
  reaction: number;
  /** The strength behind the strongest mood, 0 … 1. */
  score: number;
  scores: MoodScores;
  /** The fast signals' strength, 0 … 1, and which one it is (null under 0.3). */
  fast: number;
  fastKind: MoodFastKind | null;
  /** The score is at or over the 0.65 alert line. */
  alert: boolean;
  /** Not looking: the tab hidden, the pointer out of the window, or no input for a minute. */
  away: boolean;
  /** The control being fought with or hovered round, when there is one. */
  target: MoodTarget | null;
  /** The reader's clock (ms) when this reading was made. */
  at: number;
}

/** The person's own pace, learned while calm and kept between visits (localStorage) unless the key is null. */
export interface MoodBaseline {
  /** Typical pointer speed while moving, px/s. */
  speed: number;
  /** Typical time between two presses, ms. */
  pressGap: number;
  /** How many calm stretches went into it. */
  n: number;
}

/** What the reader knows about the element under the pointer or pressed: element facts, nothing typed or shown. */
export interface MoodFacts {
  /** A stable key for the interactive element (one per element), or null over no control. */
  control: string | null;
  /** The control is disabled (`disabled`, `aria-disabled="true"`, a disabled fieldset). */
  disabled: boolean;
  /** The control opens a section (summary, `aria-expanded`, a tab, an in-page link): what someone searching presses. */
  section: boolean;
  /** The control is a field or sits in a form with an invalid field. */
  invalid: boolean;
  /** The control sends a form (a submit button). */
  submit: boolean;
  target: MoodTarget | null;
}

export const NO_FACTS: MoodFacts = {
  control: null,
  disabled: false,
  section: false,
  invalid: false,
  submit: false,
  target: null,
};

export interface PointerSample {
  x: number;
  y: number;
  t: number;
}

export interface PressSample extends PointerSample {
  facts: MoodFacts;
}

/** The lines every reading is measured against. */
export const MOOD_LINE = 0.3;
export const ALERT_LINE = 0.65;
/** How often the fast signals and the reaction step (ms), and how often the slow heuristic answers. */
export const REACTION_MS = 66;
export const STEP_MS = 250;
/** No input for this long reads as away. */
export const AWAY_IDLE_MS = 60_000;
export const DEFAULT_BASELINE: MoodBaseline = { speed: 700, pressGap: 900, n: 0 };
export const DEFAULT_REACT_TO: readonly MoodSignal[] = ['frustrated', 'confused', 'lost'];

export const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** Several independent hints at one mood: 1 − Π(1 − wᵢ·sᵢ). */
export function noisyOr(...parts: number[]): number {
  let keep = 1;
  for (const p of parts) keep *= 1 - clamp01(p);
  return clamp01(1 - keep);
}
