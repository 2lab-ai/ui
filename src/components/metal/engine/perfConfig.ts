/* Ported from metal-fx 2.0.11 `src/engine/perfConfig.ts` (MIT, © Jakub Antalik — https://libraries.dev/metal). Added: IDLE_RELEASE_MS, CONTEXT_RECOVERY_MS. */
// ─── Frame rates ──────────────────────────────────────────────────────────

// Main render loop: shader + canvas compositing. 66ms ≈ 15fps.
export const FRAME_INTERVAL_MS = 66;

// Reflection repaint throttle. Matches main loop; CSS blur hides stepping.
export const REFLECTION_INTERVAL_MS = 66;

// ─── Glow ─────────────────────────────────────────────────────────────────

// gl.readPixels interval for luminance sampling. GPU→CPU sync is expensive.
export const GLOW_READBACK_INTERVAL_MS = 1500;

// Only run the glow callback every Nth rendered frame. Each update triggers
// Chrome to re-rasterize + re-blur 6 SVG paths through 2 masks.
export const GLOW_SKIP_FRAMES = 1;

// Points sampled around the perimeter to find the brightest hotspot.
export const PERIM_SAMPLES = 16;

// ─── Context lifetime ─────────────────────────────────────────────────────

// With nothing to draw for this long (everything paused, off screen or in a hidden tab), the WebGL context is
// released; the next element that needs a fresh frame creates it again. Added in the port.
export const IDLE_RELEASE_MS = 10_000;

// A lost context the browser has not restored after this long is released and a fresh one made (doubling, up to
// 32×, while that fails). Added in the port.
export const CONTEXT_RECOVERY_MS = 2_000;

// ─── GL canvas ────────────────────────────────────────────────────────────

// Base pixel size of the offscreen GL canvas (before DPR scaling).
// The plasma is inherently blurry — higher values waste fragment work.
export const CANONICAL_GL_SIZE = 96;

// Cap devicePixelRatio for the GL canvas. 3x retina is wasted on soft plasma.
export const GL_DPR_CAP = 2;
