import { type GenerateStylesOptions, generateBeamCSS, scaleBlur } from './engine/beam-styles';

/**
 * The bridge between border-beam's CSS engine (./engine, kept as upstream wrote it) and a shadow root.
 *
 * - Shadow roots ignore `@property` (Chromium registers none from a shadow tree), and without registration the
 *   beam's angle / opacity / travel properties would jump instead of interpolate. The blocks are lifted out of the
 *   generated CSS and registered once per document with `CSS.registerProperty` — registrations are global, so they
 *   reach every shadow tree. Every element shares one instance id (`BEAM_ID`): the shadow root already scopes its
 *   selectors and keyframes, so the per-instance suffix is only a name.
 * - Motion: `still` appends a frozen pose (the fade stays, as a crossfade; no travel, no hue drift), `full` marks every
 *   `animation` declaration `!important` and drops the engine's reduced-motion block, so the beam runs even where the
 *   library's base sheet shortens animations for `prefers-reduced-motion`.
 */

/** The instance id every element passes to the engine: `[data-beam="ui"]`, `--beam-angle-ui`, `beam-spin-ui` … */
export const BEAM_ID = 'ui';

/** One `@property` block, as `CSS.registerProperty` takes it. */
export interface BeamProperty {
  name: string;
  syntax: string;
  initialValue: string;
  inherits: boolean;
}

/** How the sheet moves: `run` as upstream, `still` a frozen pose with a crossfade, `full` immune to reduced motion. */
export type BeamSheetMode = 'run' | 'still' | 'full';

export interface BeamSheet {
  css: string;
  properties: BeamProperty[];
}

const PROPERTY_RULE =
  /@property\s+(--[\w-]+)\s*\{\s*syntax:\s*"([^"]*)";\s*initial-value:\s*([^;]*);\s*inherits:\s*(true|false);\s*\}\s*/g;
const REDUCED_BLOCK = /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\}\s*\}\s*/g;
const ANIMATION_DECL = /(\banimation:\s[^;]*?)(\s*!important)?;/g;

/** Lift every `@property` block out of a sheet: the sheet without them, and the registrations they declared. */
export function splitPropertyRules(css: string): BeamSheet {
  const properties: BeamProperty[] = [];
  const rest = String(css ?? '').replace(PROPERTY_RULE, (_all, name: string, syntax: string, init: string, inh) => {
    properties.push({ name, syntax, initialValue: init.trim(), inherits: inh === 'true' });
    return '';
  });
  return { css: rest, properties };
}

const registered = new Set<string>();

/**
 * Register each property once per document. A name another script registered first (or a browser without
 * `CSS.registerProperty`) is left alone: the beam then steps instead of gliding, it never throws. True when the
 * API exists.
 */
export function registerBeamProperties(properties: readonly BeamProperty[]): boolean {
  const api = typeof CSS !== 'undefined' ? (CSS as { registerProperty?: (d: BeamProperty) => void }) : undefined;
  if (typeof api?.registerProperty !== 'function') return false;
  for (const p of properties) {
    if (registered.has(p.name)) continue;
    registered.add(p.name);
    try {
      api.registerProperty(p);
    } catch {
      // Already registered (by @property in the page, or another copy of this module): the first one stands.
    }
  }
  return true;
}

/** The names registered so far in this document. */
export function registeredBeamProperties(): string[] {
  return Array.from(registered);
}

/** The still pose's beam angle: the brightest point of the rotate mask (66% round) sits on the top-right corner. */
export const STILL_ANGLE = 168;

/** The frozen pose a still beam wears, appended after the engine's sheet (higher specificity, `!important`). */
export function stillCss(o: GenerateStylesOptions): string {
  const id = o.id;
  const at = `[data-beam="${id}"][data-still]`;
  const b = o.brightness.toFixed(2);
  const s = o.saturation.toFixed(2);
  const hue = `hue-rotate(var(--beam-hue-base, 0deg)) brightness(${b}) saturate(${s})`;
  const pulse = o.size === 'pulse-inner' || o.size === 'pulse-outside';
  // The pose: rotate types stop at one angle; the line rests in the middle of its run, full height.
  const pose =
    o.size === 'line'
      ? `--beam-x-${id}: 0.5; --beam-w-${id}: 1.5; --beam-h-${id}: 1; --beam-edge-${id}: 1; --beam-spike-${id}: 1; --beam-spike2-${id}: 1;`
      : pulse
        ? ''
        : `--beam-angle-${id}: ${STILL_ANGLE}deg;`;
  let css = `
/* Still: the fade stays (a crossfade), nothing travels. */
${at}[data-active] { animation: beam-fade-in-${id} 0.6s ease forwards !important; ${pose} }
${at}[data-fading] { animation: beam-fade-out-${id} 0.5s ease forwards !important; ${pose} }
${at}::before, ${at}::after, ${at} [data-beam-bloom] { animation: none !important; }
`;
  // Rotate and line layers carry their brightness / saturation inside the hue keyframes: hold the middle of it.
  if (!pulse && !o.staticColors) {
    css += `${at}[data-active]::before, ${at}[data-active]::after, ${at}[data-fading]::before, ${at}[data-fading]::after { filter: ${hue}; }\n`;
    if (o.size === 'line') {
      css += `${at}[data-active] [data-beam-bloom], ${at}[data-fading] [data-beam-bloom] { filter: blur(${scaleBlur(8, o.glowSize)}px) ${hue}; }\n`;
    }
  }
  return css;
}

/** The finished sheet for one element: the engine's CSS without its `@property` blocks, adjusted for the motion mode. */
export function beamSheet(o: GenerateStylesOptions, mode: BeamSheetMode = 'run', extra = ''): BeamSheet {
  const split = splitPropertyRules(generateBeamCSS(o));
  let css = split.css;
  if (mode === 'full') css = css.replace(REDUCED_BLOCK, '').replace(ANIMATION_DECL, '$1 !important;');
  else if (mode === 'still') css += stillCss(o);
  if (extra) css += `\n${String(extra).split('{id}').join(o.id)}`;
  return { css, properties: split.properties };
}
