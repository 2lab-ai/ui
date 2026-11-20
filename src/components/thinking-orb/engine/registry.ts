// Ported from thinking-orbs 0.3.2 (MIT, © 2026 Jakub Antalik) — packages/thinking-orbs/src/engine/registry.ts of
// https://github.com/Jakubantalik/Libraries.dev. Kept as upstream wrote it; typed strictly and formatted for biome.

// Mode key → geometry builder. Kept separate from the presets so tree
// shaking can in principle drop unused modes in custom builds.

import { frameBraid } from './braid';
import { paintFrame } from './core';
import { frameGlobe, frameRubik, frameWave } from './lattice';
import { frameMorph } from './morph';
import { frameOrbits } from './orbits';
import type { ModeKey } from './presets';
import { frameRibbon } from './ribbon';
import type { ModeDraw, ModeFrame } from './types';
import { frameWeb } from './web';

/**
 * The portable surface: pure geometry, no canvas. The React Native port
 * imports exactly these functions, so its output is identical to the web's
 * by construction rather than by re-implementation.
 */
export const MODE_FRAMES: Record<ModeKey, ModeFrame> = {
  orbits: frameOrbits,
  globe: frameGlobe,
  rubik: frameRubik,
  wave: frameWave,
  web: frameWeb,
  braid: frameBraid,
  ribbon: frameRibbon,
  // ring shares ribbon's geometry — the `faceOn` profile flag switches it
  ring: frameRibbon,
  morph: frameMorph,
};

/** Canvas painters, derived from the geometry. The 2D-canvas binding. */
export const MODE_DRAWS: Record<ModeKey, ModeDraw> = Object.fromEntries(
  Object.entries(MODE_FRAMES).map(([key, frame]) => [
    key,
    ((ctx, size, t, dark, opts) => paintFrame(ctx, frame(size, t, opts), dark)) as ModeDraw,
  ]),
) as Record<ModeKey, ModeDraw>;
