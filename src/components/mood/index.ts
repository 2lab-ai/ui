// The package-root names: every one carries Mood / mood / MOOD_, so `export *` from the root never meets another
// component's names.
export {
  emptyReading as emptyMoodReading,
  MoodCore,
  type MoodCoreOptions,
  moodBaseline,
  moodReactTo,
} from './engine/core';
export { moodFactsOf, moodIgnored, moodPath } from './engine/facts';
export { reactionFor as moodReactionFor } from './engine/reaction';
export {
  createMoodReader,
  DEFAULT_BASELINE_KEY as MOOD_BASELINE_KEY,
  type MoodReader,
  type MoodReaderOptions,
} from './engine/reader';
export {
  disabledOf as moodDisabledOf,
  type FastReading as MoodFastReading,
  fastSignals as moodFastSignals,
  orbitOf as moodOrbitOf,
  rageOf as moodRageOf,
  shakeOf as moodShakeOf,
} from './engine/signals';
export {
  ALERT_LINE as MOOD_ALERT_LINE,
  AWAY_IDLE_MS as MOOD_AWAY_IDLE_MS,
  MOOD_LINE,
  type Mood,
  type MoodBaseline,
  type MoodFacts,
  type MoodFastKind,
  type MoodReading,
  type MoodScores,
  type MoodSignal,
  type MoodTarget,
} from './engine/types';
export { type MoodChange, type MoodData, type MoodOptions, type MoodScope, moodOptions, UiMood } from './mood';
