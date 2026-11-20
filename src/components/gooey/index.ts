// The package root re-exports every component: generic engine names (Transition, presets, parseShadow …) leave here
// prefixed Gooey… / gooey… so they cannot clash with another element's. The engine keeps liquid-gooey's own names.
export {
  gooFilterMarkup,
  gooIntercept,
  sanitizeFilterMarkup as sanitizeGooeyFilter,
  splitShadows as gooeySplitShadows,
} from './engine/filter';
export type { BlobBox as GooeyBlobBox, CornerRadii as GooeyCornerRadii } from './engine/geometry';
export {
  measureRadius as gooeyMeasureRadius,
  normalizeRadius as gooeyNormalizeRadius,
  offsetTo as gooeyOffsetTo,
  roundedRectPath as gooeyRoundedRectPath,
} from './engine/geometry';
export type { CardGeom as GooeyCardGeom, ImageMeltOptions as GooeyImageMeltOptions } from './engine/image-melt';
export {
  easeToward as gooeyEaseToward,
  IMAGE_MELT_DEFAULTS as GOOEY_IMAGE_MELT_DEFAULTS,
  meltPairMarkup as gooeyMeltPairMarkup,
  meltProximity as gooeyMeltProximity,
} from './engine/image-melt';
export type {
  BlendConfig as GooeyBlendConfig,
  EvolveOptions as GooeyEvolveOptions,
  ItemDynamics as GooeyItemDynamics,
  MoveOptions as GooeyMoveOptions,
} from './engine/observer';
export {
  EVOLVE_DEFAULTS as GOOEY_EVOLVE_DEFAULTS,
  MOVE_DEFAULTS as GOOEY_MOVE_DEFAULTS,
  ObserveEngine as GooeyEngine,
} from './engine/observer';
export type { ShadowLayer as GooeyShadowLayer } from './engine/shadow';
export { parseShadow as gooeyParseShadow } from './engine/shadow';
export type {
  ResolvedTransition as GooeyResolvedTransition,
  SpringConfig as GooeySpringConfig,
  Transition as GooeyTransition,
  TransitionPreset as GooeyTransitionPreset,
} from './engine/spring';
export {
  easingFunction as gooeyEasing,
  presets as GOOEY_SPRING_PRESETS,
  resolveTransition as gooeyResolveTransition,
} from './engine/spring';
export type {
  BendTuning as GooeyBendTuning,
  DissolveOptions as GooeyDissolveOptions,
  LiquidEffect as GooeyEffect,
  MorphTuning as GooeyMorphTuning,
  MoveTuning as GooeyMoveTuning,
} from './engine/tuning';
export {
  mapBend as gooeyMapBend,
  mapDissolve as gooeyMapDissolve,
  mapMorphSprings as gooeyMapMorphSprings,
  mapMove as gooeyMapMove,
  zeta as gooeyZeta,
} from './engine/tuning';
export type { GooeyData, GooeyMotion, GooeyOptions } from './gooey';
export { GOOEY_SHADOW, gooeyOptions, UiGooey } from './gooey';
export type {
  GooeyItemAttrs,
  GooeyItemData,
  GooeyItemPlan,
  MeltPlan as GooeyMeltPlan,
  MirrorPlan as GooeyMirrorPlan,
  ObservePlan as GooeyObservePlan,
} from './item';
export {
  effectOf as gooeyEffectOf,
  gooeyItemPlan,
  transitionOf as gooeyTransitionOf,
  UiGooeyItem,
} from './item';
