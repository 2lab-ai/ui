// The package-root names: every one carries MoodHud / moodHud / Hud.
export {
  brackets as moodHudBrackets,
  clearance as moodHudClearance,
  createHud as createMoodHud,
  type HudFrame as MoodHudFrame,
  type HudPress as MoodHudPress,
  type HudReading as MoodHudReading,
  OneEuro as MoodHudOneEuro,
  onSquare as moodHudOnSquare,
} from './engine/hud';
export {
  hudReadingOf as moodHudReadingOf,
  hudTargetText as moodHudTargetText,
  type MoodHudLang,
  type MoodHudMotion,
  UiMoodHud,
} from './mood-hud';
