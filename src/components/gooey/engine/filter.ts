/** The goo filter chain and the shadow passes, as SVG markup for the group's `<filter>`.
 *
 *  Ported from liquid-gooey 0.2.2 (`src/filter.tsx` and the shadow split in `src/Gooey.tsx`, MIT, © 2026 Jakub
 *  Antalik — https://libraries.dev/gooey). The primitives and their maths are verbatim; JSX became strings, and a
 *  layer's colour is written as `style="flood-color: …"` instead of the `flood-color` attribute, so `var(--…)` and
 *  `color-mix()` resolve against the theme tokens. */

import { escAttr } from '../../../core/html';
import type { ShadowLayer } from './shadow';

/** Alpha-binarize matrix used before spread dilation: the goo alpha has a soft
 *  fringe past the opaque edge — dilating it directly pushes a spread ring a
 *  pixel out and the fringe reads as a second hairline. */
const BINARIZE = '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 60 -29.5';

/** A number for an SVG attribute: finite, else 0. */
const n = (v: number): string => String(Number.isFinite(v) ? v : 0);

/** A colour for a CSS declaration: no character that could end the declaration or the attribute. */
export function cssColor(color: string): string {
  return String(color ?? '')
    .replace(/[;{}<>"'\\]/g, '')
    .trim();
}

const flood = (i: number, color: string): string =>
  `<feFlood style="flood-color: ${escAttr(cssColor(color))}" result="s${i}-c"/>`;

/** CSS inset emulation on the LIQUID: paint the colour where the silhouette
 *  is NOT covered by a shrunk/offset/blurred copy of itself, clipped back to
 *  the silhouette — an inner ring (spread), inner edge line (offset) or soft
 *  inner shadow (blur) that follows the merged goo through every state. */
function insetPass(i: number, s: ShadowLayer): string {
  let out = '';
  // `bin` is computed once for the whole stack (see gooFilterMarkup) — every
  // full-region pass costs real milliseconds on WebKit's CPU rasterizer.
  let src = 'bin';
  // Erode by the SPREAD only. An offset-only inset (`inset 0 1px 0 0`) must
  // leave a 1px strip along the TOP edge and nothing else.
  if (s.spread !== 0) {
    out += `<feMorphology in="${src}" operator="${s.spread > 0 ? 'erode' : 'dilate'}" radius="${n(Math.abs(s.spread))}" result="s${i}-er"/>`;
    src = `s${i}-er`;
  }
  if (s.x !== 0 || s.y !== 0) {
    out += `<feOffset in="${src}" dx="${n(s.x)}" dy="${n(s.y)}" result="s${i}-o"/>`;
    src = `s${i}-o`;
  }
  if (s.blur > 0) {
    out += `<feGaussianBlur in="${src}" stdDeviation="${n(s.blur / 2)}" result="s${i}-b"/>`;
    src = `s${i}-b`;
  }
  // The band: silhouette minus its shrunk/offset self.
  out += `<feComposite in="bin" in2="${src}" operator="out" result="s${i}-band"/>`;
  out += flood(i, s.color);
  out += `<feComposite in="s${i}-c" in2="s${i}-band" operator="in" result="s${i}"/>`;
  return out;
}

function shadowPass(i: number, s: ShadowLayer): string {
  let out = '';
  let src = 'shape';
  if (s.spread !== 0) {
    out += `<feMorphology in="bin" operator="${s.spread > 0 ? 'dilate' : 'erode'}" radius="${n(Math.abs(s.spread))}" result="s${i}-sp"/>`;
    src = `s${i}-sp`;
  }
  if (s.blur > 0) {
    out += `<feGaussianBlur in="${src}" stdDeviation="${n(s.blur / 2)}" result="s${i}-b"/>`;
    src = `s${i}-b`;
  }
  if (s.x !== 0 || s.y !== 0) {
    out += `<feOffset in="${src}" dx="${n(s.x)}" dy="${n(s.y)}" result="s${i}-o"/>`;
    src = `s${i}-o`;
  }
  out += flood(i, s.color);
  out += `<feComposite in="s${i}-c" in2="${src}" operator="in" result="s${i}"/>`;
  return out;
}

/** The alpha-contrast intercept for a slope: tracks the slope so the threshold stays near the classic 18 / −7 goo. */
export function gooIntercept(contrast: number): number {
  return Math.round((0.5 - contrast * (5 / 12)) * 100) / 100;
}

export interface GooFilterOptions {
  blur: number;
  contrast: number;
  /** The layers the svg paints itself: inset and spread ones (see `splitShadows`). */
  shadows: ShadowLayer[];
  /** Max px the liquid boundary undulates. 0 (default) = calm geometric edge. */
  waviness?: number;
  /** Noise frequency of the undulation — lower = longer, lazier waves. */
  wavinessFreq?: number;
}

/** The primitives inside the group's `<filter>`: blur → alpha contrast → atop (the goo), the optional waviness
 *  displacement, then the shadow passes merged around the shape. */
export function gooFilterMarkup({
  blur,
  contrast,
  shadows,
  waviness = 0,
  wavinessFreq = 0.018,
}: GooFilterOptions): string {
  const wavy = waviness > 0;
  // Intercept tracks the slope so the alpha threshold stays near the same
  // crossing as the classic 18/-7 goo pairing.
  const intercept = gooIntercept(contrast);
  let out =
    `<feGaussianBlur in="SourceGraphic" stdDeviation="${n(blur)}" result="blur"/>` +
    `<feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${n(contrast)} ${n(intercept)}" result="goo"/>` +
    `<feComposite in="SourceGraphic" in2="goo" operator="atop" result="${wavy ? 'shape-raw' : 'shape'}"/>`;
  // The liquid boundary itself undulates: the whole silhouette — edges, neck,
  // shadow source — runs through one gentle displacement field. Shadows
  // consume the displaced 'shape', so they hug the wavy edge exactly.
  if (wavy) {
    out +=
      `<feTurbulence type="fractalNoise" baseFrequency="${n(wavinessFreq)}" numOctaves="2" seed="7" result="wave-noise"/>` +
      `<feDisplacementMap in="shape-raw" in2="wave-noise" scale="${n(waviness * 2)}" xChannelSelector="R" yChannelSelector="G" result="shape"/>`;
  }
  // Binarized silhouette, computed ONCE and shared by every pass that needs it.
  if (shadows.some((s) => s.inset || s.spread !== 0)) {
    out += `<feColorMatrix in="shape" type="matrix" values="${BINARIZE}" result="bin"/>`;
  }
  shadows.forEach((s, i) => {
    out += s.inset ? insetPass(i, s) : shadowPass(i, s);
  });
  if (shadows.length > 0) {
    // CSS paints the first shadow of the list on top: outer passes merge in
    // reverse (among themselves) BELOW the shape; inset passes paint ABOVE it.
    const outer = shadows
      .map((s, i) => (!s.inset ? i : -1))
      .filter((i) => i >= 0)
      .reverse();
    out += '<feMerge>';
    for (const i of outer) out += `<feMergeNode in="s${i}"/>`;
    out += '<feMergeNode in="shape"/>';
    shadows.forEach((s, i) => {
      if (s.inset) out += `<feMergeNode in="s${i}"/>`;
    });
    out += '</feMerge>';
  }
  return out;
}

/**
 * Split a shadow stack between the GPU and the svg (the performance note in liquid-gooey's Gooey.tsx): blurred or
 * offset OUTER layers become CSS `drop-shadow()`s on the svg element — the same maths (blur radius = 2σ), run on the
 * compositor — while spread rings and inset layers stay svg passes. `pad` is the filter region's slack around the
 * group: what the remaining svg layers can reach, plus the goo blur and `filterPadding`.
 */
export function splitShadows(
  shadows: ShadowLayer[],
  blur: number,
  filterPadding: number,
): { svg: ShadowLayer[]; css: string; pad: number } {
  const svg = shadows.filter((s) => s.inset || s.spread !== 0);
  // box-shadow lists paint the FIRST layer on top; drop-shadow chains paint
  // later filters behind earlier output, so document order already matches.
  const css = shadows
    .filter((s) => !s.inset && s.spread === 0)
    .map((s) => `drop-shadow(${n(s.x)}px ${n(s.y)}px ${n(s.blur)}px ${cssColor(s.color)})`)
    .join(' ');
  const extent = svg.reduce(
    (m, s) => Math.max(m, Math.max(Math.abs(s.x), Math.abs(s.y)) + s.blur * 1.5 + Math.max(0, s.spread)),
    0,
  );
  const pad = Math.ceil(blur * 3 + extent + filterPadding);
  return { svg, css, pad: Number.isFinite(pad) ? pad : 0 };
}

const SAFE_REF = /^#[\w-]+$/;

/**
 * The `filter` escape hatch, made safe to put in the shadow root: only filter primitives (`fe*` elements) survive,
 * no event handler attribute (`on*`), no `style`, and an `href` only when it points inside the document (`#id`).
 * Returns the cleaned markup.
 */
export function sanitizeFilterMarkup(markup: string): string {
  if (typeof document === 'undefined') return '';
  const tpl = document.createElement('template');
  tpl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg"><filter>${String(markup ?? '')}</filter></svg>`;
  const filter = tpl.content.querySelector('filter');
  if (!filter) return '';
  for (const el of Array.from(filter.querySelectorAll('*'))) {
    if (!/^fe[a-z]/i.test(el.localName)) {
      el.remove();
      continue;
    }
    for (const at of Array.from(el.attributes)) {
      const name = at.name.toLowerCase();
      const bad =
        name.startsWith('on') ||
        name === 'style' ||
        ((name === 'href' || name.endsWith(':href')) && !SAFE_REF.test(at.value.trim()));
      if (bad) el.removeAttribute(at.name);
    }
  }
  return filter.innerHTML;
}
