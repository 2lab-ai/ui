// The package-root names: every one carries Voice / voice / VOICE_, so `export *` from the root never meets another
// effect's names (the thinking orb's Dot, OrbFrame, makeProj, radiusScale, paintFrame …). The engine keeps the
// library's own names inside engine/; these are the aliases a host imports — the library's `voice-orbs/engine` entry.
export type { OrbColors as VoiceOrbColors } from './engine/colors';
export type {
  Dot as VoiceOrbDot,
  FrameLight as VoiceOrbLight,
  OrbFrame as VoiceOrbFrame,
  Stroke as VoiceOrbStroke,
} from './engine/core';
export {
  ACCENT_COLORS as VOICE_ACCENT_COLORS,
  EMOTION_COLORS as VOICE_EMOTION_COLORS,
  type VoiceOrbAccent,
  type VoiceOrbEmotion,
} from './engine/emotion';
export {
  LEAN_DEFAULTS as VOICE_LEAN_DEFAULTS,
  type LeanAmounts as VoiceLeanAmounts,
  leanFrame as voiceLeanFrame,
  leanReach as voiceLeanReach,
} from './engine/lean';
export { type OrbTint as VoiceOrbTint, paintFrame as paintVoiceFrame } from './engine/paint';
export {
  PRESETS as VOICE_RING_PRESETS,
  type Preset as VoiceRingPreset,
  resolvePreset as resolveVoiceRingPreset,
} from './engine/presets';
export { TYPE_FRAMES as VOICE_ORB_FRAMES, VOICE_ORB_TYPES, type VoiceOrbType } from './engine/registry';
export {
  SILENCE as VOICE_SILENCE,
  type TypeFrame as VoiceOrbTypeFrame,
  type TypeOpts as VoiceOrbTypeOpts,
  type VoiceInput,
} from './engine/types';
export {
  type FollowerConfig as VoiceFollowerConfig,
  SPECTRUM_N as VOICE_SPECTRUM_N,
  VoiceFollower,
} from './engine/voice';
export {
  readDirection as readVoiceDirection,
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
