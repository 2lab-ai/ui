export type { SampledPalette } from './engine/palette';
export { samplePaletteFromCanvas } from './engine/palette';
export type {
  EasingKey,
  MaskShape,
  MosaicConfig,
  PaletteName,
  Preset,
  PresetMode,
  PresetName,
  PresetTheme,
  RevealConfig,
} from './engine/presets';
export {
  accentRamp,
  colorLuminance,
  mixRgb,
  NAMED_PALETTES,
  PALETTE_NAMES,
  PIXEL_CHURN_PRESETS,
  PIXELS_MECHANIC,
  PIXELS_ORGANIC,
  PRESET_NAMES,
  PRESETS,
  parseCssColor,
  rankPalette,
  SWEEP_GRADIENT,
  toHex,
} from './engine/presets';
export {
  createUniforms,
  effectiveCardBg,
  effectiveCellSize,
  effectivePaletteColor,
  FRAME_INTERVAL_MS,
  instancePixelSize,
  MAX_CANVAS_DPR,
  MAX_GL_DPR,
  mosaicGrid,
  REF_DIM,
} from './engine/renderer';
export { computeCoverSourceRect, flickerHash, getMaskValue, MASK_SIZE, revealGrid } from './engine/reveal';
export { fragmentSource, specializeEffect } from './engine/shaders';
export { EASING_FNS, ease } from './engine/tween';
export type {
  ImageRevealData,
  ImageRevealLang,
  ImageRevealMotion,
  ImageRevealOptions,
  ImageRevealPalette,
  ImageRevealPhase,
  ImageRevealPhaseDetail,
  ImageRevealPreset,
  ImageRevealRender,
  ImageRevealState,
  RevealTarget,
} from './image-reveal';
export {
  IMAGE_REVEAL_FADE_MS,
  IMAGE_REVEAL_HIDE_MS,
  IMAGE_REVEAL_IDLE_MS,
  IMAGE_REVEAL_STRINGS,
  isCssColor,
  revealAspect,
  revealPaletteColors,
  revealStatusText,
  revealTarget,
  UiImageReveal,
} from './image-reveal';
