// Every name carries `orb` / `Orb`: the package root re-exports every component with `export *`, so the engine's
// generic names (MODE_FRAMES, lerp, hashD …) would collide with another port's.

// The engine — upstream's power-user surface: geometry per instant, the presets, and the parts a custom `frame`
// is built from.
export {
  angleDelta as orbAngleDelta,
  type Dot as OrbDot,
  fibDir as orbFibDir,
  finalizeFrame as orbFinalizeFrame,
  frac as orbFrac,
  hashD as orbHash,
  type Line as OrbLine,
  lerp as orbLerp,
  makeProj as orbMakeProj,
  type OrbFrame,
  type OrbTint,
  paintFrame as orbPaintFrame,
  radiusScale as orbRadiusScale,
  vnoise as orbNoise,
} from './engine/core';
export {
  type ModeKey as OrbModeKey,
  PRESETS as ORB_PRESETS,
  type Resolved as OrbResolved,
  resolvePreset as resolveOrbPreset,
  STATE_TO_MODE as ORB_STATE_TO_MODE,
} from './engine/presets';
export {
  BASE_PROFILES as ORB_BASE_PROFILES,
  countDots as orbCountDots,
  type ModeOpts as OrbModeOpts,
  scaleCounts as orbScaleCounts,
  scaleRadii as orbScaleRadii,
} from './engine/profiles';
export { MODE_DRAWS as ORB_MODE_DRAWS, MODE_FRAMES as ORB_MODE_FRAMES } from './engine/registry';
export type { ModeFrame as OrbModeFrame, OrbSize, OrbState } from './engine/types';
export type {
  ThinkingOrbData,
  ThinkingOrbLang,
  ThinkingOrbMotion,
  ThinkingOrbOptions,
  ThinkingOrbTheme,
} from './thinking-orb';
export {
  ORB_SIZES,
  ORB_STATES,
  type OrbPlan,
  orbFit,
  orbOptions,
  orbPlan,
  orbSizeOf,
  parseTint as orbParseTint,
  STILL_T as ORB_STILL_T,
  STRINGS as THINKING_ORB_STRINGS,
  UiThinkingOrb,
} from './thinking-orb';
