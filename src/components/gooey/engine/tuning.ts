/** The public knobs of a liquid item and how they map onto the raw engine options.
 *
 *  Ported verbatim from liquid-gooey 0.2.2 (`src/LiquidItem.tsx` and the option types of `src/GooeyItem.tsx`, MIT,
 *  © 2026 Jakub Antalik — https://libraries.dev/gooey). */

import type { CornerRadii } from './geometry';
import { EVOLVE_DEFAULTS, type EvolveOptions, MOVE_DEFAULTS, type MoveOptions } from './observer';
import type { Transition } from './spring';

/** The liquid behaviours:
 *  - 'morph' (default): pieces merge gooily, change shape like jelly, and can dissolve into each other on contact —
 *    menus, avatar groups, morphing panels.
 *  - 'move': the surface trails a moving element as liquid rubber with a droplet tail — sliders, tab indicators,
 *    dragged things.
 *  - 'bend': the surface stays glued to the content and the BODY bows with velocity.
 *  - 'melt': two images running molten into each other (pairwise). */
export type LiquidEffect = 'morph' | 'move' | 'melt' | 'bend';

/** Full tuning surface of the contact melt ("dissolve"). All values optional — the defaults are the library's tuned
 *  look. */
export interface DissolveOptions {
  /** Melt blur in px. Default 8. */
  blur?: number;
  /** Displacement strength of the liquid warp. Default 26. */
  warp?: number;
  /** Magnetic drift toward the contact, px. Default 4. */
  pull?: number;
  /** Distance where melting starts (defaults from the group's goo blur). */
  range?: number;
  /** Size of the melt zone around the contact, px. */
  zone?: number;
  /** 0..1 — two-liquid mixing: erodes the melted copy into tendrils. Default 0.7 when dissolving. */
  mix?: number;
  /** Px the melt is drawn toward the neighbour's centre (flow gravity). */
  gravity?: number;
  /** 0..1 — how pointy that flow tapers toward the neighbour. */
  taper?: number;
  /** Noise frequency multiplier: <1 broad swirls, >1 fine veins. */
  warpFreq?: number;
  /** Px/s the noise field drifts so the liquid churns. 0 = static. */
  flowSpeed?: number;
  /** 'fractalNoise' (soft billows) or 'turbulence' (veinier). */
  warpStyle?: 'fractalNoise' | 'turbulence';
  /** Noise octaves; higher = finer swirls. */
  detail?: number;
  /** While false the melt fades out over `releaseMs`, regardless of proximity. */
  active?: boolean;
  /** Structural release time when `active` goes false, ms. */
  releaseMs?: number;
  /** Ms the melt takes to evaporate (opacity -> 0), independent of `releaseMs`. Defaults to `releaseMs`. */
  fadeMs?: number;
  /** 0..1 — overall dissolve intensity, independent of proximity. Default 1. */
  strength?: number;
  /** How deep this piece may sink into its neighbour before the melt is fully gone, as a fraction of the smaller
   *  body (1 = completely engulfed). Default 0.8. */
  sink?: number;
  /** What the liquid is made of: 'liquid' (default, the group fill) or 'image' (the item's own imagery). */
  surface?: 'liquid' | 'image';
  /** Blur (px) of the seam-blend layer. Defaults to 1.6x `blur`; 0 disables. */
  seamBlur?: number;
}

/** Tuning for effect="bend". */
export interface BendTuning {
  /** Vertical bow strength, 0..1. Default 0.6. */
  vertical?: number;
  /** Horizontal cap deformation, 0..1. Default 0.35. */
  horizontal?: number;
  /** Raw MoveOptions escape hatch, merged last. */
  advanced?: MoveOptions;
}

/** Simple tuning for effect="morph". All knobs are normalized; defaults are the library's tuned look. */
export interface MorphTuning {
  /** Liquid shape-change physics: the surface springs behind size changes, travels as a droplet and settles like
   *  jelly. Off by default — plain merge needs no engine. */
  shape?: boolean;
  /** Speed multiplier for the shape physics. 1 = default, 2 = twice as fast. */
  speed?: number;
  /** 0..1 — how much the shape physics overshoot and wobble. Default 0.5. */
  bounce?: number;
  /** Max px the CONTENT cross-blurs by while the liquid is in motion. Applies with `shape`. Default 7, 0 disables. */
  contentBlur?: number;
  /** Full escape hatch: raw engine options, merged over the mapped values. */
  advanced?: {
    evolve?: EvolveOptions;
    /** Shrink the blob by px per side so opaque content fully covers its own liquid (e.g. round photos). */
    blobInset?: number;
    /** Px the blob swells back out near a neighbour — a visible liquid coat that necks into the other surface. */
    bridgeGrow?: number;
  };
}

/** Simple tuning for effect="move". All knobs are 0..1; defaults are the library's tuned look. */
export interface MoveTuning {
  /** How tightly the liquid chases the element. 0 = heavy syrup lag, 1 = near-instant. Default 0.5. */
  springiness?: number;
  /** How much the surface overshoots and wobbles on arrival. Default 0.5. */
  wobble?: number;
  /** Velocity stretch of the drop. 0 = rigid. Default 0.36. */
  stretch?: number;
  /** Trailing droplet size. 0 disables the tail. Default 0.575. */
  trail?: number;
  /** Full escape hatch: raw spring values, merged over the mapped values. */
  advanced?: MoveOptions;
}

export type { CornerRadii, Transition };

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Damping ratio from a 0..1 bounciness knob. 0.5 lands exactly on the tuned defaults' ratio (≈0.45); 0 is
 *  critically damped; 1 is very springy. */
export function zeta(bounce: number): number {
  return Math.max(0.12, 1 - 1.1 * Math.min(1, Math.max(0, bounce)));
}

/** effect="morph" with `shape`: the springs. (speed 1, bounce 0.5) reproduces EVOLVE_DEFAULTS exactly; stiffness ×
 *  s² + damping × s keeps the ratio, so `speed` changes tempo without changing character. */
export function mapMorphSprings(t: MorphTuning | undefined): EvolveOptions {
  const s = Math.max(0.25, t?.speed ?? 1);
  const k = zeta(t?.bounce ?? 0.5) / zeta(0.5);
  return {
    massStiffness: EVOLVE_DEFAULTS.massStiffness * s * s,
    massDamping: EVOLVE_DEFAULTS.massDamping * s * k,
    sizeStiffness: EVOLVE_DEFAULTS.sizeStiffness * s * s,
    sizeDamping: EVOLVE_DEFAULTS.sizeDamping * s * k,
    // The radius spring stays critically damped at every bounce setting — the
    // roundness envelope supplies the liquid look; a bouncing radius reads as
    // flicker, not jelly.
    radiusStiffness: EVOLVE_DEFAULTS.radiusStiffness * s * s,
    radiusDamping: EVOLVE_DEFAULTS.radiusDamping * s,
    cornerDuration: EVOLVE_DEFAULTS.cornerDuration / s,
    contentBlur: t?.contentBlur ?? EVOLVE_DEFAULTS.contentBlur,
  };
}

/** `dissolve: true | 0..1`: the tuned look, `strength` scaled. Geometry (zone/range) and motion character
 *  (taper/churn) stay at the tuned values regardless of strength. */
export function mapDissolve(d: boolean | number): DissolveOptions {
  const k = typeof d === 'number' ? clamp01(d) : 1;
  return {
    warp: 26,
    blur: 8,
    mix: 0.7,
    gravity: 60,
    taper: 1,
    warpFreq: 1.7,
    flowSpeed: 22,
    detail: 2,
    zone: 18,
    range: 49,
    releaseMs: 110,
    strength: k,
  };
}

/** effect="move": an exponential feel curve centred on the default (0 → ~120, 0.5 → 380, 1 → ~1200). Damping
 *  rescales with √stiffness and ζ(wobble) so the default knob positions reproduce MOVE_DEFAULTS exactly. */
export function mapMove(t: MoveTuning | undefined): MoveOptions {
  const p = clamp01(t?.springiness ?? 0.5);
  const stiffness = MOVE_DEFAULTS.stiffness * 10 ** (p - 0.5);
  const damping =
    MOVE_DEFAULTS.damping * Math.sqrt(stiffness / MOVE_DEFAULTS.stiffness) * (zeta(t?.wobble ?? 0.5) / zeta(0.5));
  return {
    stiffness,
    damping,
    stretch: 0.5 * clamp01(t?.stretch ?? 0.36),
    tail: 0.8 * clamp01(t?.trail ?? 0.575),
    ...t?.advanced,
  };
}

/** effect="bend": springiness 1 on the public curve — the surface tracks the content 1:1, so all liquid character
 *  comes from the bends. */
export function mapBend(t: BendTuning | undefined): MoveOptions {
  return {
    ...mapMove({ springiness: 1, stretch: 0, trail: 0 }),
    bend: clamp01(t?.vertical ?? 0.6),
    bendX: clamp01(t?.horizontal ?? 0.35),
    ...t?.advanced,
  };
}
