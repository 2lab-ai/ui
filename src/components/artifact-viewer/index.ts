export type { FileAction, FileCardVariant, FileItem } from '../file-card/render';
export type {
  ArtifactActionDetail,
  ArtifactCloseDetail,
  ArtifactClosedDetail,
  ArtifactOpenDetail,
  ArtifactViewDetail,
  ArtifactViewerData,
} from './artifact-viewer';
export { UiArtifactViewer } from './artifact-viewer';
export type { ArtifactLayout, ViewerBodyKind, ViewerFit } from './logic';
export {
  artifactLayout,
  extraActions,
  FIT_SIZE,
  MAX_EXTRA_ACTIONS,
  peekHtml,
  stepIndex,
  textHead,
  viewerActions,
  viewerBodyKind,
  viewerFit,
} from './logic';
export { peekCss, peekPageCss } from './styles';
