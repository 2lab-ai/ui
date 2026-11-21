import { define } from '../../core/element';
import { gaussBlur } from '../metal/engine/glow/bake';
import type { MaskFn } from '../metal/engine/renderer/core';
import { layoutBox, paintTextRun } from '../metal/engine/textMask';
import { type MetalCommonData, MetalElement, type MetalSettings } from '../metal/metal-element';
import { metalCssValue, metalFlag, metalNumber, metalOptionalNumber } from '../metal/options';
import { styles } from './styles';

/**
 * The light rim inside the glyphs (Figma: white 90 %, offset 0/1, blur 0.5) — a hairline of light along the top
 * inside edge of every letter. CSS has no inner shadow for text, so it is computed: glyph alpha minus the same alpha
 * shifted down by the offset leaves exactly that top rim, blurred and drawn white on an overlay above the metal.
 */
export interface TextInnerShadow {
  offsetY: number;
  blur: number;
  alpha: number;
}

const FIGMA_INNER_SHADOW: Readonly<TextInnerShadow> = Object.freeze({ offsetY: 1, blur: 0.5, alpha: 0.9 });

/** metal-fx's MetalText defaults, tuned on its "Plan Pro" card. */
export const METAL_TEXT_DEFAULTS = Object.freeze({
  metalOpacity: 0.62,
  shaderScale: 2.8,
  glowGain: 2.5,
  innerShadow: FIGMA_INNER_SHADOW,
});

/** `<ui-metal-text>` data: metal-fx's `MetalText` props (children → the slotted text). */
export interface MetalTextData extends MetalCommonData {
  /** CSS `font` shorthand for the text (default: inherited), e.g. `500 24px/1.2 Inter, sans-serif`. */
  font?: string;
  /** The text's own colour, which the metal composites over (default: inherited). */
  color?: string;
  /** The rim inside the glyphs; null / false turns it off. Default white 90 %, offset 1px, blur 0.5px. */
  innerShadow?: Partial<TextInnerShadow> | null | false;
  /** A halo on the glyphs (default off — the design has none). */
  glow?: boolean;
  /** Glow multiplier when `glow` is on, 0 … 10 (default 2.5). */
  glowGain?: number;
  /** How much metal shows over the text's colour, 0 … 1 (default 0.62), multiplied with `strength`. */
  metalOpacity?: number;
  /** Zoom of the metal inside the glyphs, 0.1 … 10 (default 2.8). */
  shaderScale?: number;
}

/** The glyph rim options: null for off, else the defaults merged and clamped. */
export function metalTextInnerShadow(value: unknown): TextInnerShadow | null {
  if (value === null || value === false) return null;
  if (value === undefined || value === true) return { ...FIGMA_INNER_SHADOW };
  if (typeof value !== 'object') return { ...FIGMA_INNER_SHADOW };
  const o = value as Partial<TextInnerShadow>;
  return {
    offsetY: metalNumber(o.offsetY, 0, 4, FIGMA_INNER_SHADOW.offsetY),
    blur: metalNumber(o.blur, 0, 4, FIGMA_INNER_SHADOW.blur),
    alpha: metalNumber(o.alpha, 0, 1, FIGMA_INNER_SHADOW.alpha),
  };
}

/**
 * The glyph rim, per pixel: coverage the shifted glyph doesn't cover (a difference, not a product — on anti-aliased
 * side edges both values are partial and a product lit every edge), blurred, then clipped back to the glyph so the
 * blur never leaks outside the letterform. `a` is glyph alpha 0 … 1 at `w` × `h`; returns alpha 0 … 255.
 */
export function metalGlyphRim(
  a: Float32Array,
  w: number,
  h: number,
  shiftPx: number,
  blurPx: number,
  alpha: number,
): Uint8ClampedArray {
  const n = w * h;
  const shift = Math.max(1, Math.round(shiftPx)) * w;
  const rim = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const above = i >= shift ? a[i - shift] : 0;
    rim[i] = Math.max(0, a[i] - above);
  }
  const blurred = gaussBlur(rim, w, h, blurPx);
  const out = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) out[i] = Math.round(Math.min(1, blurred[i] * a[i] * alpha) * 255);
  return out;
}

/**
 * `<ui-metal-text>` — liquid metal inside the glyphs of the host's own words (the slotted text): the metal is masked
 * to the text, painted with the same font and metrics, and composited over the live text, so layout, selection and
 * the accessible name stay the DOM's. A rim of light runs along the top inside edge of each letter; a halo on the
 * glyphs is opt-in (`glow`). Text only, on one line.
 *
 * Shares `<ui-metal>`'s engine and contract: one WebGL context for the page, no frames off screen / hidden / paused /
 * under reduced motion; without WebGL2 the words show in a CSS metallic gradient.
 *
 * Ported from metal-fx 2.0.11's `MetalText` (MIT, © Jakub Antalik — https://libraries.dev/metal).
 */
export class UiMetalText extends MetalElement<MetalTextData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return ['preset', 'theme', 'strength', 'paused', 'motion', 'reflect', 'glow', 'cursor-light', 'lang'];
  }

  #text: HTMLElement | null = null;
  #rim: HTMLCanvasElement | null = null;
  #rimKey = '';
  #fontsHooked = false;

  /** Metal only where the words are: the text run painted with the DOM's own font and position. */
  #mask: MaskFn = (ctx, _w, _h, dpr) => {
    if (this.#text) paintTextRun(ctx, this.content, this, dpr, this.#text);
  };

  protected settings(): MetalSettings {
    const d = this.data ?? {};
    const c = this.common();
    const metalOpacity = metalNumber(d.metalOpacity, 0, 1, METAL_TEXT_DEFAULTS.metalOpacity);
    return {
      kind: 'pill',
      variant: 'button',
      preset: c.preset,
      theme: c.theme,
      pinned: c.pinned,
      strength: c.strength * metalOpacity,
      glowGain: metalNumber(d.glowGain, 0, 10, METAL_TEXT_DEFAULTS.glowGain),
      paused: c.paused,
      reduced: c.reduced,
      borderRadius: 4,
      normalize: false,
      glow: metalFlag(d.glow ?? (this.hasAttribute('glow') ? this.getAttribute('glow') : undefined), false),
      rim: null,
      shaderScale: metalOptionalNumber(d.shaderScale, 0.1, 10) ?? METAL_TEXT_DEFAULTS.shaderScale,
      ringCssPx: 1,
      scale: 1,
      mask: this.#mask,
      glowMode: 'mask',
      cursorLight: c.cursorLight,
      bend: false,
      reflect: c.reflect,
    };
  }

  protected render(): string {
    return (
      '<canvas class="metal-fx-canvas" part="canvas" aria-hidden="true"></canvas>' +
      '<div class="mfx-inner" aria-hidden="true"></div>' +
      '<div class="mfx-glow" part="glow" aria-hidden="true"></div>' +
      '<div class="mfx-rim" aria-hidden="true"></div>' +
      '<div class="mfx-fallback" aria-hidden="true"></div>' +
      '<canvas class="mt-rim" aria-hidden="true"></canvas>' +
      '<span class="mfx-content mt-text" part="text"><slot></slot></span>'
    );
  }

  protected override afterSync(_s: MetalSettings, live: boolean): void {
    this.#text ??= this.content.querySelector<HTMLElement>('.mt-text');
    this.#rim ??= this.content.querySelector<HTMLCanvasElement>('.mt-rim');
    const d = this.data ?? {};
    const t = this.#text;
    if (t) {
      // CSSOM, not markup: a font or colour string can't escape into the shadow tree.
      t.style.font = metalCssValue('font', d.font);
      t.style.color = metalCssValue('color', d.color);
    }
    if (!live) {
      this.#rimKey = '';
      return;
    }
    if (!this.#fontsHooked && typeof document !== 'undefined' && document.fonts?.ready) {
      this.#fontsHooked = true;
      // Fonts landing move the glyphs: re-measure the mask and the rim.
      document.fonts.ready
        .then(() => {
          this.#rimKey = '';
          this.redraw();
          this.requestRender();
        })
        .catch(() => {});
    }
    this.#drawRim(metalTextInnerShadow(d.innerShadow));
  }

  protected override onBoxChange(): void {
    this.#rimKey = '';
    const d = this.data ?? {};
    if (this.rendering === 'webgl') this.#drawRim(metalTextInnerShadow(d.innerShadow));
  }

  /** The glyph rim overlay, redrawn only when the text, its box, the DPR or the options changed. */
  #drawRim(sh: TextInnerShadow | null): void {
    const cv = this.#rim;
    const t = this.#text;
    if (!cv || !t) return;
    if (!sh) {
      cv.width = 0;
      cv.height = 0;
      this.#rimKey = '';
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const rr = layoutBox(this.content);
    const w = Math.max(1, Math.round(rr.width * dpr));
    const h = Math.max(1, Math.round(rr.height * dpr));
    const key = `${w}x${h}@${dpr}|${sh.offsetY},${sh.blur},${sh.alpha}|${this.textContent}|${t.style.font}`;
    if (key === this.#rimKey) return;
    this.#rimKey = key;
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const og = off.getContext('2d', { willReadFrequently: true });
    const g = cv.getContext('2d');
    if (!og || !g) return;
    og.fillStyle = '#fff';
    paintTextRun(og, this.content, this, dpr, t);
    const d = og.getImageData(0, 0, w, h).data;
    const n = w * h;
    const a = new Float32Array(n);
    for (let i = 0, j = 3; i < n; i++, j += 4) a[i] = d[j] / 255;
    const rim = metalGlyphRim(a, w, h, sh.offsetY * dpr, sh.blur * dpr, sh.alpha);
    cv.width = w;
    cv.height = h;
    cv.style.width = `${rr.width}px`;
    cv.style.height = `${rr.height}px`;
    const img = g.createImageData(w, h);
    const o = img.data;
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      o[j] = 255;
      o[j + 1] = 255;
      o[j + 2] = 255;
      o[j + 3] = rim[i];
    }
    g.putImageData(img, 0, 0);
  }
}

define('ui-metal-text', UiMetalText);

declare global {
  interface HTMLElementTagNameMap {
    'ui-metal-text': UiMetalText;
  }
}
