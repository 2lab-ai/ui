// The package root re-exports every component: every name here carries the element's prefix, so none collides with
// another effect's engine (presets, palettes, colours, easings).
export type { SampledPalette as ImageRevealSampledPalette } from './engine/palette';
export { samplePaletteFromCanvas as imageRevealSamplePalette } from './engine/palette';
export type { Preset as ImageRevealPresetConfig, PresetMode as ImageRevealPresetMode } from './engine/presets';
export {
  accentRamp as imageRevealAccentRamp,
  NAMED_PALETTES as IMAGE_REVEAL_NAMED_PALETTES,
  PALETTE_NAMES as IMAGE_REVEAL_PALETTE_NAMES,
  PRESET_NAMES as IMAGE_REVEAL_PRESET_NAMES,
  PRESETS as IMAGE_REVEAL_PRESETS,
  rankPalette as imageRevealRankPalette,
} from './engine/presets';
export { effectiveCellSize as imageRevealCellSize, mosaicGrid as imageRevealMosaicGrid } from './engine/renderer';
export { computeCoverSourceRect as imageRevealCoverRect, revealTiming as imageRevealTiming } from './engine/reveal';
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
  RevealTarget as ImageRevealTarget,
} from './image-reveal';
export {
  IMAGE_REVEAL_FADE_MS,
  IMAGE_REVEAL_HIDE_MS,
  IMAGE_REVEAL_IDLE_MS,
  IMAGE_REVEAL_STRINGS,
  isCssColor as imageRevealIsColor,
  revealAspect as imageRevealAspect,
  revealPaletteColors as imageRevealPaletteColors,
  revealStatusText as imageRevealStatusText,
  revealTarget as imageRevealTarget,
  UiImageReveal,
} from './image-reveal';
