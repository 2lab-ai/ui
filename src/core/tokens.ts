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
/**
 * The mono palette (0.25.0): overrides of LIGHT / DARK, applied with `data-palette="mono"` beside `data-theme`.
 * Colour is kept for the four task states only, and only as a mark. The decorative hues (accent, green, yellow,
 * red, purple, orange, the spark) and the focus ring turn neutral; error text is ink; and `chroma` drops to 0.
 *
 * `--chroma` (1 in the colour themes, 0 in mono) scales every status colour a component mixes into a fill or a
 * text tint: `color-mix(in srgb, var(--st-run) calc(16% * var(--chroma)), var(--ib-card))` is today's 16% wash
 * in light and dark and the plain card in mono. A status colour on an icon, a dot, a bar or a border is not
 * scaled — in mono that mark is the one place a state shows its colour.
 */
export const MONO_LIGHT: TokenSet = tokens['mono-light'];
export const MONO_DARK: TokenSet = tokens['mono-dark'];

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

/**
 * Optional page-level tokens (`@2lab.ai/ui/tokens.css`): `data-theme="dark|light"` on any ancestor switches, and
 * `data-palette="mono"` on the same element turns that theme into its mono pair (light·mono / dark·mono). The mono
 * blocks only override; they follow the colour blocks so they win at their higher specificity.
 */
export const tokensCss = `/* @2lab.ai/ui design tokens — data-theme="dark|light" on any ancestor switches; data-palette="mono" beside it turns the theme mono */
:root, [data-theme="light"] { ${pageVars(SHARED)} ${pageVars(LIGHT)} color-scheme: light; }
[data-theme="dark"] { ${pageVars(DARK)} color-scheme: dark; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${pageVars(DARK)} color-scheme: dark; } }
[data-palette="mono"]:not([data-theme="dark"]) { ${pageVars(MONO_LIGHT)} }
[data-palette="mono"][data-theme="dark"] { ${pageVars(MONO_DARK)} }
@media (prefers-color-scheme: dark) { :root[data-palette="mono"]:not([data-theme="light"]) { ${pageVars(MONO_DARK)} } }
`;
