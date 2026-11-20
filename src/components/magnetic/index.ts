// The package root re-exports every component: generic engine names (Particle, Box, Pt, calibrate …) leave here
// prefixed Magnet… / magnet… so they cannot clash with another element's. The engine keeps magnetkit's own names.
export type { BridgeSocket as MagnetBridgeSocket, BridgeState as MagnetBridgeState } from './engine/bridge';
export {
  BRIDGE_URL as MAGNET_BRIDGE_URL,
  MagnetBridge,
  parseFrame as parseMagnetFrame,
  parseGesture as parseMagnetGesture,
  parseHello as parseMagnetHello,
} from './engine/bridge';
export type {
  CalibrationIO as MagnetCalibrationIO,
  CalibrationOptions as MagnetCalibrationOptions,
  CalibrationState as MagnetCalibrationState,
} from './engine/calibration';
export {
  calibrate as calibrateMagnet,
  DEFAULT_SPOTS as MAGNET_CALIBRATION_SPOTS,
  runCalibration as runMagnetCalibration,
} from './engine/calibration';
export type { Box as MagnetBox } from './engine/field';
export { MagneticField, Particle as MagnetParticle } from './engine/field';
export type { CalibrationFit as MagnetCalibrationFit, CalibrationSpot as MagnetCalibrationSpot } from './engine/fit';
export { fitCalibration as fitMagnetCalibration } from './engine/fit';
export type { MagnetFrame, MagnetGesture, ModelHello as MagnetModelHello, Pt as MagnetPoint } from './engine/types';
export type {
  MagnetBridgeChange,
  MagnetGestureDetail,
  MagneticData,
  MagneticLang,
  MagneticMotion,
  MagneticOptions,
} from './magnetic';
export {
  bridgeMessage as magnetBridgeMessage,
  calibrationMessage as magnetCalibrationMessage,
  magneticOptions,
  outsideDistance as magnetOutsideDistance,
  pointerFrame as magnetPointerFrame,
  UiMagnetic,
} from './magnetic';
