// Every name carries `beam` / `Beam`: the package root re-exports every component with `export *`, so an engine's
// generic names (sizePresets, pingPong …) would collide with another port's.
export type {
  BorderBeamColorVariant,
  BorderBeamData,
  BorderBeamMotion,
  BorderBeamOptions,
  BorderBeamSize,
  BorderBeamTheme,
} from './border-beam';
export {
  BEAM_SIZES,
  BEAM_VARIANTS,
  beamDuration,
  beamOptions,
  beamStyleOptions,
  isPulseSize as beamIsPulse,
  pulseGlowScale as beamPulseGlowScale,
  UiBorderBeam,
} from './border-beam';
export type {
  GenerateStylesOptions as BeamStyleOptions,
  PulseDriverConfig as BeamPulseDriverConfig,
  PulseOscillatorDef as BeamPulseOscillator,
} from './engine/beam-styles';
export {
  colorPalettes as BEAM_COLOR_PALETTES,
  generateBeamCSS,
  getPulseDriverConfig as beamPulseDriverConfig,
  pulseOscillatorDefs as beamPulseOscillators,
  pulseParams as beamPulseParams,
  sizePresets as BEAM_SIZE_PRESETS,
  sizeThemePresets as BEAM_THEME_PRESETS,
} from './engine/beam-styles';
export { pingPong as beamPingPong, registerPulseInstance as registerBeamPulse } from './engine/pulse-driver';
export type { SizeConfig as BeamSizeConfig, ThemeColors as BeamThemeColors } from './engine/types';
export type { BeamProperty, BeamSheet, BeamSheetMode } from './sheet';
export {
  BEAM_ID,
  beamSheet,
  registerBeamProperties,
  STILL_ANGLE as BEAM_STILL_ANGLE,
  splitPropertyRules as beamSplitPropertyRules,
  stillCss as beamStillCss,
} from './sheet';
export {
  ancestorSubstrate as beamAncestorSubstrate,
  colorIsLight as beamColorIsLight,
  resolveSubstrate as beamSubstrate,
  type Substrate as BeamSubstrate,
} from './theme';
