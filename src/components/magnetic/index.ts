export type { BridgeSocket, BridgeState } from './engine/bridge';
export { BRIDGE_URL, MagnetBridge, parseFrame, parseGesture } from './engine/bridge';
export type { CalibrationIO, CalibrationOptions, CalibrationState } from './engine/calibration';
export { calibrate, DEFAULT_SPOTS, runCalibration } from './engine/calibration';
export type { Box } from './engine/field';
export { MagneticField, Particle } from './engine/field';
export type { CalibrationFit, CalibrationSpot } from './engine/fit';
export { fitCalibration } from './engine/fit';
export type { MagnetFrame, MagnetGesture, ModelHello, Pt } from './engine/types';
export type {
  MagnetBridgeChange,
  MagnetGestureDetail,
  MagneticData,
  MagneticLang,
  MagneticMotion,
  MagneticOptions,
} from './magnetic';
export {
  bridgeMessage,
  calibrationMessage,
  magneticOptions,
  outsideDistance,
  pointerFrame,
  UiMagnetic,
} from './magnetic';
