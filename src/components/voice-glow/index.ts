// The package-root names: every one carries Voice / voice / VOICE_, so `export *` from the root never meets another
// effect's names. The engine's own (verbatim) names stay inside engine/.
export {
  audioHolds as voiceAudioHolds,
  audioResumePending as voiceAudioResumePending,
  demoVoiceLevel,
  followLevel as followVoiceLevel,
  isAudioSupported as isVoiceAudioSupported,
  readLevel as readVoiceLevel,
  shapeLevel as shapeVoiceLevel,
  type VoiceLevelSource,
} from './engine/audio';
export type { VoiceGlowConfig, VoiceGlowGather } from './engine/driver';
export type { VoiceMotion } from './engine/env';
export {
  resolveVoiceDefaults,
  type VoiceGeometry,
  type VoiceGlowLook,
  type VoiceGlowType,
  voiceDefaults as VOICE_GLOW_DEFAULTS,
  voiceTypePresets as VOICE_GLOW_TYPE_PRESETS,
} from './engine/presets';
export {
  generateVoiceGlowCss,
  VOICE_GLOW_PALETTES,
  type VoiceGlowPalette,
  voicePalettes as VOICE_GLOW_PALETTE_COLORS,
} from './engine/styles';
export {
  resolveVoiceGlow,
  UiVoiceGlow,
  type VoiceGlowBandColors,
  type VoiceGlowData,
  type VoiceGlowGatherSource,
  type VoiceGlowLang,
  type VoiceGlowResolved,
  voiceGlowPalette,
  voiceGlowType,
} from './voice-glow';
