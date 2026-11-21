import { define } from '../../core/element';
import type { MaskFn } from '../metal/engine/renderer/core';
import { type MetalCommonData, MetalElement, type MetalSettings } from '../metal/metal-element';
import { metalCssValue, metalNumber, metalOptionalNumber } from '../metal/options';
import { styles } from './styles';

export type MetalBadgeLang = 'en' | 'ko';

/** The badge's word when the host gives none. */
export const METAL_BADGE_STRINGS = {
  en: { badge: 'New' },
  ko: { badge: '신규' },
} as const;

/** The clean white core under the label: solid radius (% of the ellipse), ramp width (%), opacity, ellipse size (%). */
export interface MetalBadgeCore {
  r: number;
  blur: number;
  a: number;
  size: number;
}

/** Figma pill radius; the badge is 45 × 25 at scale 1 (wider for a longer word). */
const RADIUS = 55.556;

/** metal-fx's MetalBadge defaults, tuned on its "Live mode · New" card. */
export const METAL_BADGE_DEFAULTS = Object.freeze({
  metalOpacity: 0.8,
  shaderScale: 1.6,
  core: Object.freeze({ r: 46, blur: 100, a: 0.94, size: 49 }) as Readonly<MetalBadgeCore>,
  gradient: 0,
  glow: 0.41,
});

/** `<ui-metal-badge>` data: metal-fx's `MetalBadge` props (children → the slotted word). */
export interface MetalBadgeData extends MetalCommonData {
  /** The word when nothing is slotted (default “New” / “신규”). */
  label?: string;
  /** Size multiplier on the Figma metrics (45 × 25, 12.222px), 0.5 … 4 (default 1). */
  scale?: number;
  /** How much metal shows over the white fill, 0 … 1 (default 0.8), multiplied with `strength`. */
  metalOpacity?: number;
  /** Zoom of the metal, 0.1 … 10 (default 1.6). */
  shaderScale?: number;
  /** The white core under the label (rim-only metal). */
  core?: Partial<MetalBadgeCore>;
  /** Top-to-bottom white wash, 0 … 1 (default 0). */
  gradient?: number;
  /** The two soft inner white glows, 0 … 1 (default 0.41); the hairline rims stay as designed. */
  glow?: number;
  /** The label's colour (default #323232, on the white fill). */
  textColor?: string;
}

/** The core, merged over the defaults and clamped. */
export function metalBadgeCore(value: unknown): MetalBadgeCore {
  const d = METAL_BADGE_DEFAULTS.core;
  const o = (value && typeof value === 'object' ? value : {}) as Partial<MetalBadgeCore>;
  return {
    r: metalNumber(o.r, 0, 100, d.r),
    blur: metalNumber(o.blur, 0, 200, d.blur),
    a: metalNumber(o.a, 0, 1, d.a),
    size: metalNumber(o.size, 1, 200, d.size),
  };
}

/** A label colour the host may set (a CSS colour), else the design's ink. */
export function metalBadgeColor(value: unknown, fallback = '#323232'): string {
  return metalCssValue('color', value) || fallback;
}

/**
 * `<ui-metal-badge>` — the “New” pill: a white fill with liquid metal over it, a clean white core under the label so
 * the metal creeps in at the rim, and the inset rims of the Figma design. The word is the host's own text (the slot;
 * “New” / “신규” when empty), dark ink on white in both themes.
 *
 * Shares `<ui-metal>`'s engine and contract: one WebGL context for the page, no frames off screen / hidden / paused /
 * under reduced motion; without WebGL2 the metal is a CSS gradient under the same core.
 *
 * Ported from metal-fx 2.0.11's `MetalBadge` (MIT, © Jakub Antalik — https://libraries.dev/metal).
 */
export class UiMetalBadge extends MetalElement<MetalBadgeData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return ['preset', 'theme', 'strength', 'paused', 'motion', 'reflect', 'scale', 'cursor-light', 'lang'];
  }

  /** Full-fill mask: the pill itself. */
  #mask: MaskFn = (ctx, w, h, dpr) => {
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, RADIUS * dpr);
    ctx.fill();
  };

  get #lang(): MetalBadgeLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  #scale(): number {
    const d = this.data ?? {};
    return metalNumber(d.scale ?? this.getAttribute('scale'), 0.5, 4, 1);
  }

  protected settings(): MetalSettings {
    const d = this.data ?? {};
    const c = this.common();
    const metalOpacity = metalNumber(d.metalOpacity, 0, 1, METAL_BADGE_DEFAULTS.metalOpacity);
    const k = this.#scale();
    return {
      kind: 'pill',
      variant: 'button',
      preset: c.preset,
      theme: c.theme,
      pinned: c.pinned,
      strength: c.strength * metalOpacity,
      glowGain: 1,
      paused: c.paused,
      reduced: c.reduced,
      borderRadius: RADIUS * k,
      normalize: false,
      glow: true,
      rim: null,
      shaderScale: metalOptionalNumber(d.shaderScale, 0.1, 10) ?? METAL_BADGE_DEFAULTS.shaderScale,
      ringCssPx: 1,
      scale: 1,
      mask: this.#mask,
      glowMode: 'ring',
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
      '<div class="mb-body">' +
      '<div class="mb-core" aria-hidden="true"></div>' +
      '<div class="mb-wash" aria-hidden="true"></div>' +
      '<span class="mb-label" part="label"><slot></slot></span>' +
      '</div>'
    );
  }

  protected override afterSync(): void {
    const d = this.data ?? {};
    const root = this.content;
    const core = metalBadgeCore(d.core);
    const set = (name: string, value: string) => {
      if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value);
    };
    set('--mb-k', String(this.#scale()));
    set('--mb-core-size', `${core.size}%`);
    set('--mb-core-r', `${core.r}%`);
    set('--mb-core-end', `${Math.min(100, core.r + core.blur)}%`);
    set('--mb-core-a', String(core.a));
    set('--mb-gradient', String(metalNumber(d.gradient, 0, 1, METAL_BADGE_DEFAULTS.gradient)));
    set('--mb-glow', String(metalNumber(d.glow, 0, 1, METAL_BADGE_DEFAULTS.glow)));
    set('--mb-text', metalBadgeColor(d.textColor));
    // The slot's fallback is the word when the host gave none — text, never markup.
    const slot = this.content.querySelector('slot');
    const word = typeof d.label === 'string' && d.label.trim() ? d.label.trim() : METAL_BADGE_STRINGS[this.#lang].badge;
    if (slot && slot.textContent !== word) slot.textContent = word;
  }
}

define('ui-metal-badge', UiMetalBadge);

declare global {
  interface HTMLElementTagNameMap {
    'ui-metal-badge': UiMetalBadge;
  }
}
