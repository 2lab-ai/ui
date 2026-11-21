// The package-root names: every one carries Voice / voice / VOICE_, so `export *` from the root never meets another
// effect's names.
export {
  createVoiceStereoSide,
  estimateVoiceSide,
  type VoiceSide,
  type VoiceSideEstimate,
  type VoiceSideOptions,
  type VoiceStereoSideOptions,
  type VoiceStereoSideReader,
} from './engine/stereo';
export {
  leanFor as voiceLeanForSide,
  readVoicePosition,
  UiVoicePosition,
  type VoiceDistance,
  type VoicePositionData,
  type VoicePositionLang,
  type VoicePositionReading,
  voiceDistance,
  voiceSide,
} from './voice-position';
