// The engine's names are prefixed (Wave… / wave…) where they would be generic at the package root, which re-exports
// every component (another effect has its own `Particle`, `smooth` …).
export type {
  DistortionWaveData,
  WaveFinishedDetail,
  WaveMotion,
  WavePlayOptions,
  WaveSource,
} from './distortion-wave';
export { reducedMotionOf, UiDistortionWave, waveTypeOf } from './distortion-wave';
export type {
  CaptureFunction as WaveCaptureFunction,
  CaptureRequest as WaveCaptureRequest,
  Snapshot as WaveSnapshot,
  SnapshotOptions as WaveSnapshotOptions,
} from './engine/capture';
export { backgroundOf as waveBackgroundOf, snapshot as waveSnapshot } from './engine/capture';
export type { PaletteLike, PlayOptions, SourceLike, WaveOptions, WaveStyleInput } from './engine/controller';
export { WaveController } from './engine/controller';
export type {
  Front as WaveFront,
  Palette as WavePalette,
  PaletteName as WavePaletteName,
  Particle as WaveParticle,
  Point as WavePoint,
  Rect as WaveRect,
  RGB as WaveRGB,
  Spot as WaveSpot,
  WaveStyle,
  WaveType,
} from './engine/model';
export {
  bezierEase as waveBezierEase,
  COVER_ZONE as WAVE_COVER_ZONE,
  defaultStyle as waveDefaultStyle,
  duration as waveDuration,
  hexToRgb as waveHexToRgb,
  LUMPS as WAVE_LUMPS,
  makeParticles as waveMakeParticles,
  newFront as waveNewFront,
  PALETTES as WAVE_PALETTES,
  particleAt as waveParticleAt,
  rgbToHex as waveRgbToHex,
  rimLumps as waveRimLumps,
  singlePalette as waveSinglePalette,
  smooth as waveSmooth,
  waveFront,
} from './engine/model';
export type {
  DotBuffer as WaveDotBuffer,
  FrameOptions as WaveFrameOptions,
  RendererOptions as WaveRendererOptions,
  ScreenSlot as WaveScreenSlot,
} from './engine/renderer';
export { WaveRenderer } from './engine/renderer';
export type {
  StatusWaveEnv,
  StatusWavePreset,
  StatusWaveRequest,
  StatusWaveRun,
  StatusWaveStatus,
  WaveEmphasis,
} from './status-wave';
export {
  cssColorHex as waveCssColorHex,
  mostlyOnScreen as waveMostlyOnScreen,
  playStatusWave,
  STATUS_WAVE_LOUD_MAX,
  STATUS_WAVE_MAX,
  STATUS_WAVES,
  spectrumPalette as waveSpectrumPalette,
  statusWaveOptions,
  statusWavesRunning,
  statusWaveTone,
  transitionWeight as statusWaveWeight,
} from './status-wave';
