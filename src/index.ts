/**
 * @2lab-ai/ui — agent UI Web Components. Importing this module registers every element.
 * Import a single component with `@2lab-ai/ui/<slug>` to register only that one.
 */
export * from './components/agent-inbox';
export * from './components/agent-queue';
export * from './components/agent-run';
export * from './components/ai-answer';
export * from './components/context-window';
export * from './components/memory-panel';
export * from './components/model-picker';
export { define, prefersReducedMotion, UiElement } from './core/element';
export { clamp, fmtAgo, fmtClock, fmtDuration, fmtInt, fmtTokens, fmtUsd } from './core/format';
export { attrs, cls, esc, escAttr, safeHref } from './core/html';
export { baseCss, DARK, LIGHT, SHARED, tokensCss } from './core/tokens';
