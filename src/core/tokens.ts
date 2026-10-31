import tokens from './tokens.json';

/**
 * Design tokens. Inside every component's shadow root the dashboard names (`--text`, `--surface`, `--st-run` …)
 * are defined on `:host` and read the public `--ui-*` property first, so a page themes every component by
 * setting `--ui-text` etc. (or loading `@2lab.ai/ui/tokens.css`). Without any page tokens a component follows
 * `prefers-color-scheme`, and the `theme="light|dark"` attribute pins it.
 */
export type TokenSet = Record<string, string>;
export const LIGHT: TokenSet = tokens.light;
export const DARK: TokenSet = tokens.dark;
export const SHARED: TokenSet = tokens.shared;

function hostVars(set: TokenSet): string {
  return Object.entries(set)
    .map(([k, v]) => `--${k}: var(--ui-${k}, ${v});`)
    .join(' ');
}

function pageVars(set: TokenSet): string {
  return Object.entries(set)
    .map(([k, v]) => `--ui-${k}: ${v};`)
    .join(' ');
}

/** Shared stylesheet prepended to every component's shadow root. */
export const baseCss = `
:host { ${hostVars(SHARED)} ${hostVars(LIGHT)}
  display: block; box-sizing: border-box; color: var(--text); font-family: var(--font);
  font-size: 14px; line-height: 1.45; -webkit-font-smoothing: antialiased; color-scheme: light; }
:host([theme="dark"]) { ${hostVars(DARK)} color-scheme: dark; }
@media (prefers-color-scheme: dark) { :host(:not([theme="light"])) { ${hostVars(DARK)} color-scheme: dark; } }
:host([hidden]) { display: none; }
/* Korean breaks between words, never inside them; long unbroken strings still wrap where an element says overflow-wrap. */
:host([lang="ko"]), :host(:lang(ko)) { word-break: keep-all; }
*, *::before, *::after { box-sizing: border-box; }
button, input, textarea, select { font: inherit; color: inherit; }
button { cursor: pointer; }
:focus { outline: none; }
:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
.sr-only { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.mono { font-family: var(--mono); }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
}
`;

/** Optional page-level tokens (`@2lab.ai/ui/tokens.css`): `data-theme="dark|light"` on any ancestor switches. */
export const tokensCss = `/* @2lab.ai/ui design tokens */
:root, [data-theme="light"] { ${pageVars(SHARED)} ${pageVars(LIGHT)} color-scheme: light; }
[data-theme="dark"] { ${pageVars(DARK)} color-scheme: dark; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${pageVars(DARK)} color-scheme: dark; } }
`;
