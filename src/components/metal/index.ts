// The engine's public surface keeps metal-fx's names behind a `metal` prefix (metal-fx → here): setGlowConfig →
// setMetalGlowConfig, setCursorSprite → setMetalCursorSprite, PRESETS → METAL_PRESET_MODES … — `@2lab.ai/ui` exports
// every element from one entry, and the bare names would collide with other ports.
export {
  BEND as METAL_BEND,
  BEND_DEFAULTS as METAL_BEND_DEFAULTS,
  type BendConfig as MetalBendConfig,
  resetBendConfig as resetMetalBendConfig,
  setBendConfig as setMetalBendConfig,
} from './engine/bend/config';
export {
  CURSOR_LIGHT as METAL_CURSOR_LIGHT,
  CURSOR_LIGHT_DEFAULTS as METAL_CURSOR_LIGHT_DEFAULTS,
  type CursorLightConfig as MetalCursorLightConfig,
  type CursorSprite as MetalCursorSprite,
  resetCursorLightConfig as resetMetalCursorLightConfig,
  setCursorLightConfig as setMetalCursorLightConfig,
  setCursorSprite as setMetalCursorSprite,
} from './engine/cursor/light';
export {
  GLOW as METAL_GLOW,
  GLOW_DEFAULTS as METAL_GLOW_DEFAULTS,
  GLOW_MARKUP_KEYS as METAL_GLOW_MARKUP_KEYS,
  type GlowConfig as MetalGlowConfig,
  resetGlowConfig as resetMetalGlowConfig,
  setGlowConfig as setMetalGlowConfig,
  subscribeGlowConfig as subscribeMetalGlowConfig,
} from './engine/glow/config';
export {
  FIT_CONTAIN as METAL_FIT_CONTAIN,
  FIT_COVER as METAL_FIT_COVER,
  FIT_NONE as METAL_FIT_NONE,
  PRESETS as METAL_PRESET_MODES,
  type Preset as MetalPresetDef,
  type PresetMode as MetalPresetMode,
  type PresetTheme as MetalPresetTheme,
  SHAPE_CIRCLE as METAL_SHAPE_CIRCLE,
  SHAPE_DAISY as METAL_SHAPE_DAISY,
  SHAPE_DIAMOND as METAL_SHAPE_DIAMOND,
  SHAPE_METABALLS as METAL_SHAPE_METABALLS,
  SHAPE_NONE as METAL_SHAPE_NONE,
} from './engine/presets';
export {
  REFLECTION_OCCLUDER as METAL_REFLECTION_OCCLUDER,
  REFLECTION_OCCLUDER_DEFAULTS as METAL_REFLECTION_OCCLUDER_DEFAULTS,
  type ReflectionOccluderConfig as MetalReflectionOccluderConfig,
  resetReflectionOccluderConfig as resetMetalReflectionOccluderConfig,
  setReflectionOccluderConfig as setMetalReflectionOccluderConfig,
} from './engine/reflection/paint';
export { metalTextReflection } from './engine/reflection/text';
export {
  type DeformFn as MetalDeformFn,
  type DeformLayers as MetalDeformLayers,
  isMetalFxSupported,
  type MaskFn as MetalMaskFn,
} from './engine/renderer/core';
export {
  getSharedPreset as getMetalPresetMode,
  setSharedPresetMode as setMetalPresetMode,
} from './engine/renderer/loop';
export { RIM_DEFAULTS as METAL_RIM_DEFAULTS, type RimOptions as MetalRimOptions } from './engine/rim';
export { LIQUID_METAL_FRAGMENT_SHADER, VERT_SHADER_SRC as METAL_VERTEX_SHADER } from './engine/shaders';
export {
  layoutBox as metalLayoutBox,
  paintTextRun as metalPaintTextRun,
  textMaskDataUrl as metalTextMaskDataUrl,
  textRun as metalTextRun,
} from './engine/textMask';
export { type MetalData, type MetalLang, UiMetal } from './metal';
export { type MetalCommonData, MetalElement, type MetalRendering, type MetalSettings } from './metal-element';
export {
  METAL_PRESETS,
  type MetalGlowMode,
  type MetalInnerShadow,
  type MetalMotion,
  type MetalPreset,
  type MetalReflectionTarget,
  type MetalTheme,
  type MetalVariant,
  metalCssValue,
  metalFlag,
  metalGlowMode,
  metalHexColor,
  metalIdList,
  metalInnerShadow,
  metalMaskPoints,
  metalMotion,
  metalNumber,
  metalOptionalNumber,
  metalPreset,
  metalRadius,
  metalReduced,
  metalResolvedTheme,
  metalTheme,
  metalVariant,
} from './options';
export { METAL_FALLBACK_GRADIENTS } from './styles';
