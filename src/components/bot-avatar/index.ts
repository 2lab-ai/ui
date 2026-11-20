export type {
  BotAvatarData,
  BotAvatarLang,
  BotAvatarMotion,
  BotAvatarOptions,
  BotAvatarPick,
  BotAvatarTheme,
} from './bot-avatar';
export { botAvatarBody, botAvatarColor, botAvatarFor, botAvatarSvg, UiBotAvatar } from './bot-avatar';
export { autoInk as botAvatarInk } from './engine/color';
export { draw as drawBotAvatarFrame, OVERSCAN as BOT_AVATAR_OVERSCAN, RISE as BOT_AVATAR_RISE } from './engine/draw';
export type { Pose as BotAvatarPose } from './engine/engine';
export { restPose as botAvatarRestPose, Sim as BotAvatarSim } from './engine/engine';
export {
  botAvatarFaces,
  botAvatarPalette,
  botAvatarPresets,
  botAvatarStates,
  botAvatarTypes,
} from './engine/presets';
export { SHAPE_PATHS as botAvatarShapes } from './engine/shapes';
export type {
  BotAvatarFace,
  BotAvatarGlasses,
  BotAvatarHat,
  BotAvatarPreset,
  BotAvatarShading,
  BotAvatarSquashEase,
  BotAvatarState,
  BotAvatarType,
} from './engine/types';
