import { define } from '../../core/element';
import type { MaskFn } from './engine/renderer/core';
import { type MetalCommonData, MetalElement, type MetalSettings } from './metal-element';
import {
  type MetalGlowMode,
  type MetalInnerShadow,
  type MetalVariant,
  metalFlag,
  metalGlowMode,
  metalInnerShadow,
  metalNumber,
  metalOptionalNumber,
  metalVariant,
} from './options';
import { styles } from './styles';

export type MetalLang = 'en' | 'ko';

/** `<ui-metal>` data: metal-fx's `MetalFx` props, one-to-one (children → the default slot). */
export interface MetalData extends MetalCommonData {
  /** `button` (default): a pill, 1px ring, shader scale 1.6 · `circle`: a circle, 2px ring, scale 1.3. */
  variant?: MetalVariant;
  /** Multiplier on the glow only (halo + catch-light), on top of `strength`; 0 … 10 (default 1). */
  glowGain?: number;
  /** Explicit corner radius (CSS px). Default: the wrapped element's own `border-radius`. */
  borderRadius?: number;
  /** Strip the wrapped element's own border / outline / shadow / background so they don't fight the ring (default
   *  true). A focus ring is kept for the keyboard. */
  normalizeHostStyles?: boolean;
  /** No wandering halo; the ring still draws. */
  disableGlow?: boolean;
  /** A light rim along the ring's top inside edge: `true` for the design defaults, or an object to tune. */
  innerShadow?: boolean | MetalInnerShadow;
  /** Shader sampling scale (bigger = bigger pattern features), 0.1 … 10. Default: the variant's × `scale`. */
  shaderScale?: number;
  /** Ring thickness in CSS px, 0 … 20. Default: the variant's (1 / 2) × `scale`. */
  ringCssPx?: number;
  /** Master scale for every absolute-pixel constant (a CSS-zoomed or doubled layout), 0.25 … 8 (default 1). */
  scale?: number;
  /** Custom alpha mask painter (device px, origin at the box's top-left) — metal inside a shape instead of a ring. */
  mask?: MaskFn;
  /** With `mask`: `mask` (default) samples the glow inside the mask; `ring` keeps it on the box's edge. */
  glowMode?: MetalGlowMode;
  /** The cursor-driven liquid dent of the ring (metal-fx's `useMetalBend`). Default off. */
  bend?: boolean;
}

/**
 * `<ui-metal>` — liquid metal around the host's own button, chip or icon (the default slot): an animated metal ring
 * drawn from Paper Shaders' liquidMetal, a halo that finds the brightest point on it, an optional light rim
 * (`inner-shadow`), a liquid dent under the pointer (`bend`), and a soft reflection on neighbours (`reflect`, dark
 * theme). The wrapped element keeps its semantics, focus and events; every layer this adds is `aria-hidden` and
 * `pointer-events: none`.
 *
 * One WebGL2 context for every metal element on the page, made when the first one needs it and released with the
 * last (or after 10 s with nothing to draw); frames stop off screen, in a hidden tab, while paused and under reduced
 * motion (a still frame). Without WebGL2 the wrapped element shows as it is, with a CSS metallic ring.
 *
 * Ported from metal-fx 2.0.11 (MIT, © Jakub Antalik — https://libraries.dev/metal); the shaders are Paper Shaders
 * 0.0.80 (Apache-2.0), unmodified.
 */
export class UiMetal extends MetalElement<MetalData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return [
      'variant',
      'preset',
      'theme',
      'strength',
      'paused',
      'motion',
      'reflect',
      'inner-shadow',
      'bend',
      'cursor-light',
      'lang',
    ];
  }

  protected settings(): MetalSettings {
    const d = this.data ?? {};
    const a = (n: string) => this.getAttribute(n);
    const has = (n: string) => (this.hasAttribute(n) ? a(n) : undefined);
    const c = this.common();
    const variant = metalVariant(d.variant ?? a('variant'));
    const kind = variant === 'circle' ? 'circle' : 'pill';
    const scale = metalNumber(d.scale, 0.25, 8, 1);
    const def = MetalElement.shaderDefaults(kind, scale);
    return {
      kind,
      variant,
      preset: c.preset,
      theme: c.theme,
      pinned: c.pinned,
      strength: c.strength,
      glowGain: metalNumber(d.glowGain, 0, 10, 1),
      paused: c.paused,
      reduced: c.reduced,
      borderRadius: metalOptionalNumber(d.borderRadius, 0, 10000),
      normalize: metalFlag(d.normalizeHostStyles, true),
      glow: !metalFlag(d.disableGlow, false),
      rim: metalInnerShadow(d.innerShadow ?? has('inner-shadow')),
      shaderScale: metalOptionalNumber(d.shaderScale, 0.1, 10) ?? def.shaderScale,
      ringCssPx: metalOptionalNumber(d.ringCssPx, 0, 20) ?? def.ringCssPx,
      scale,
      mask: typeof d.mask === 'function' ? d.mask : null,
      glowMode: metalGlowMode(d.glowMode, 'mask'),
      cursorLight: c.cursorLight,
      bend: metalFlag(d.bend ?? has('bend'), false),
      reflect: c.reflect,
    };
  }

  protected render(): string {
    return (
      '<canvas class="metal-fx-canvas" part="canvas" aria-hidden="true"></canvas>' +
      '<div class="mfx-inner" aria-hidden="true"></div>' +
      '<div class="mfx-glow" part="glow" aria-hidden="true"></div>' +
      '<div class="mfx-rim" aria-hidden="true"></div>' +
      '<div class="mfx-fallback" part="fallback" aria-hidden="true"></div>' +
      '<div class="mfx-content"><slot></slot></div>'
    );
  }
}

define('ui-metal', UiMetal);

declare global {
  interface HTMLElementTagNameMap {
    'ui-metal': UiMetal;
  }
}
