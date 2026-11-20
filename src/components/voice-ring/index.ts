export { bendFrame, bendRadius, bendReach } from './engine/bend';
export { adjustAccent, colorRamp, type OrbColors } from './engine/colors';
export {
  type Dot,
  type FrameLight,
  type FrameTube,
  fibDir,
  finalizeFrame,
  hashD,
  makeProj,
  type OrbFrame,
  radiusScale,
  type Stroke,
  skinField,
  vnoise3,
} from './engine/core';
export {
  ACCENT_COLORS,
  EMOTION_COLORS,
  GlowFollower,
  type VoiceOrbAccent,
  type VoiceOrbEmotion,
} from './engine/emotion';
export { EdgeBounce, LEAN_DEFAULTS, type LeanAmounts, leanFrame, leanReach } from './engine/lean';
export { type OrbGlow, type OrbTint, paintDots, paintFrame, paintStrokes } from './engine/paint';
export { PRESETS, resolvePreset } from './engine/presets';
export { EdgeLens } from './engine/refract';
export { TYPE_FRAMES, VOICE_ORB_TYPES, type VoiceOrbType } from './engine/registry';
export { SILENCE, type TypeFrame, type TypeOpts, type VoiceInput } from './engine/types';
export { type FollowerConfig, SPECTRUM_N, VoiceFollower } from './engine/voice';
export {
  readDirection,
  resolveVoiceRing,
  UiVoiceRing,
  VOICE_RING_TYPES,
  type VoiceDirectionSource,
  type VoiceRingData,
  type VoiceRingLang,
  type VoiceRingResolved,
  type VoiceRingState,
  type VoiceRingType,
  voiceRingState,
  voiceRingType,
} from './voice-ring';
