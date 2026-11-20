// Ported from thinking-orbs 0.3.2 (MIT, © 2026 Jakub Antalik) — packages/thinking-orbs/src/engine/types.ts of
// https://github.com/Jakubantalik/Libraries.dev. Kept as upstream wrote it; typed strictly and formatted for biome.

// Engine-level contracts shared by every mode implementation.

import type { ModeOpts } from './profiles';

export type { Dot, Line, OrbFrame } from './core';

import type { OrbFrame } from './core';

/**
 * Geometry for one instant: pure math over (size, t, opts), no rendering
 * surface and no theme — `dark` only affects ink at paint time.
 *
 * Deliberately closure-free and `Math`-only so the same function can run
 * inside a Reanimated worklet on the React Native UI thread, and so its
 * output can be compared numerically against the Swift port.
 */
export type ModeFrame = (size: number, t: number, opts: ModeOpts) => OrbFrame;

/** One frame painter: draws a mode into a 2D context at CSS-px `size`. */
export type ModeDraw = (ctx: CanvasRenderingContext2D, size: number, t: number, dark: boolean, opts: ModeOpts) => void;

/**
 * The nine shipped states (upstream's `OrbState`, from src/types.ts) — each a hand-tuned animation:
 * - `working`    — particles on tilted orbits
 * - `searching`  — a scan meridian sweeps a dotted globe
 * - `solving`    — bands scramble in quarter turns, then click back
 * - `listening`  — a waveform rolls through latitude rings
 * - `connecting` — a constellation wires itself, packets running the edges
 * - `weaving`    — three strands plait around the sphere
 * - `composing`  — an undulating multi-band sash
 * - `breathing`  — a face-on ring slowly morphing
 * - `shaping`    — a dotted outline morphs circle → triangle → square
 */
export type OrbState =
  | 'working'
  | 'searching'
  | 'solving'
  | 'listening'
  | 'connecting'
  | 'weaving'
  | 'composing'
  | 'breathing'
  | 'shaping';

/**
 * Rendered size in CSS pixels (upstream's `OrbSize`). 64 (chat-avatar scale) and 20 (inline-text scale) are
 * hand-tuned designs, not a scale factor — each carries its own dot count, dot size and speed. 32 sits between them,
 * interpolated from the two in log space.
 */
export type OrbSize = 64 | 32 | 20;
