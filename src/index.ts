/**
 * @2lab.ai/ui — agent UI Web Components. Importing this module registers every element.
 * Import a single component with `@2lab.ai/ui/<slug>` to register only that one; the icon set is
 * `@2lab.ai/ui/icons`, the light-DOM CSS kit `@2lab.ai/ui/ui-kit.css` (or `kitCss` from `@2lab.ai/ui/kit`).
 */
export * from './components/agent-inbox';
export * from './components/agent-queue';
export * from './components/agent-run';
export * from './components/agent-steering';
export * from './components/agent-tree';
export * from './components/ai-answer';
export * from './components/app-bar';
export * from './components/approval-card';
export * from './components/artifact-viewer';
export * from './components/auth-card';
export * from './components/bar-chart';
export * from './components/choice-form';
export * from './components/compact-breakdown';
export * from './components/composer';
export * from './components/context-window';
export * from './components/conversation';
export * from './components/deck-nav';
export * from './components/dialog';
export * from './components/disclosure';
export * from './components/drawer';
export * from './components/elapsed';
export * from './components/episode-log';
export * from './components/file-card';
export * from './components/goal-card';
export * from './components/hovercard';
export * from './components/knowledge-pages';
export * from './components/log-scroller';
export * from './components/memory-panel';
export * from './components/menu';
export * from './components/model-picker';
export * from './components/segmented';
export * from './components/setting-row';
export * from './components/settings-nav';
export * from './components/stat-strip';
export * from './components/status-bar';
export * from './components/tabs';
export * from './components/task-plan';
export * from './components/task-runs';
export * from './components/toaster';
export * from './components/tool-call-card';
export * from './components/tooltip';
export * from './components/work-log';
export { define, prefersReducedMotion, UiElement } from './core/element';
export type { FileKind } from './core/files';
export { FILE_KINDS, fileExt, fileKind, fileKindIcon, fmtBytes } from './core/files';
export { clamp, fmtAgo, fmtClock, fmtDuration, fmtInt, fmtTokens, fmtUsd } from './core/format';
export { attrs, cls, esc, escAttr, safeHref, safeLink, safeSrc } from './core/html';
export type { LinkRenderer } from './core/markdown';
export { markdownHtml, mdDocCss } from './core/markdown';
export type { PopAlign, PopPlace, PopRect, PopSide } from './core/popover';
export { parsePlacement, placePopover } from './core/popover';
export { baseCss, DARK, LIGHT, SHARED, tokensCss } from './core/tokens';
export * from './icons';
export * from './kit';
