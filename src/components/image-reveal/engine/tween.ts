/**
 * Easing table of img-fx 0.5.2 (`src/engine/tween.ts`, MIT, © 2026 Jakub Antalik) — verbatim. Keys match
 * `EasingKey` in `presets.ts`.
 */
import type { EasingKey } from './presets';

export type EaseFn = (t: number) => number;

export const EASING_FNS: Readonly<Record<EasingKey, EaseFn>> = Object.freeze({
  linear: (t: number) => t,
  smoothstep: (t: number) => t * t * (3 - 2 * t),
  easeOutCubic: (t: number) => 1 - (1 - t) ** 3,
  easeOutQuint: (t: number) => 1 - (1 - t) ** 5,
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  easeOutExpo: (t: number) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  easeOutBack: (t: number) => {
    const c = 1.70158;
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
  },
});

/** `key`'s easing at `t`, clamped to 0..1 first; an unknown key eases with smoothstep. NaN reads as 0. */
export function ease(key: EasingKey, t: number): number {
  const fn = Object.hasOwn(EASING_FNS, key) ? EASING_FNS[key] : EASING_FNS.smoothstep;
  return fn(Math.max(0, Math.min(1, Number.isNaN(t) ? 0 : t)));
}
