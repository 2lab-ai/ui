/**
 * The host is a block; the frame inside takes its width and a ratio (`aspect`, square by default) — or, with
 * aspect="fill", the host's own box. The frame is a well in the page colour (`--bg`: #1c1c1f dark, #f7f7f7 light — the
 * library's own card colours, #1B1B1B and #f5f5f5, within a step) with rounded corners (`--image-reveal-radius`,
 * `--image-reveal-bg` override them). Layers, bottom up: the CSS mosaic (fallback),
 * the WebGL mosaic (its canvas, faded by `strength`), the reveal overlay, the picture, "No preview", the slot.
 *
 * The CSS mosaic is a diagonal band sweeping under a grid of cell gaps drawn in the frame's own colour — the
 * sweep-gradient preset's look, without WebGL, its edges fading like the shader's. Still under reduced motion,
 * frozen while paused.
 */
export const styles = `
:host { display: block; position: relative; }
.ui-root { height: 100%; }
.ir { --ir-surface: var(--ir-bg, var(--image-reveal-bg, var(--bg)));
  --ir-ink: var(--ir-tint, var(--text));
  position: relative; width: 100%; aspect-ratio: 1 / 1; overflow: hidden; isolation: isolate;
  border-radius: var(--image-reveal-radius, calc(var(--radius) + 4px)); background: var(--ir-surface);
  -webkit-user-select: none; user-select: none; }
.ir[data-fill] { height: 100%; aspect-ratio: auto; }
.ir-fallback, .ir-fx, .ir-overlay, .ir-img, .ir-empty, .ir-slot { position: absolute; inset: 0; width: 100%; height: 100%; }
.ir-fallback { z-index: 1; display: none; overflow: hidden; border-radius: inherit;
  --ir-cell: calc(14.4px * var(--ir-scale, 1));
  background: color-mix(in srgb, var(--ir-ink) 7%, var(--ir-surface));
  -webkit-mask-image: linear-gradient(90deg, transparent, black 24px, black calc(100% - 24px), transparent),
    linear-gradient(180deg, transparent, black 24px, black calc(100% - 24px), transparent);
  -webkit-mask-composite: source-in;
  mask-image: linear-gradient(90deg, transparent, black 24px, black calc(100% - 24px), transparent),
    linear-gradient(180deg, transparent, black 24px, black calc(100% - 24px), transparent);
  mask-composite: intersect; }
.ir[data-render="css"] .ir-fallback { display: block; }
.ir-fallback::before { content: ""; position: absolute; inset: -60%;
  background: linear-gradient(135deg, transparent 38%, color-mix(in srgb, var(--ir-ink) 26%, transparent) 50%, transparent 62%);
  transform: translate(-25%, -25%);
  animation: ir-sweep calc(2.6s / var(--ir-speed, 1)) var(--ease-in-out) infinite; }
.ir-fallback::after { content: ""; position: absolute; inset: 0;
  background:
    repeating-linear-gradient(90deg, var(--ir-surface) 0 1.5px, transparent 1.5px var(--ir-cell)),
    repeating-linear-gradient(0deg, var(--ir-surface) 0 1.5px, transparent 1.5px var(--ir-cell)); }
@keyframes ir-sweep { from { transform: translate(-25%, -25%); } to { transform: translate(25%, 25%); } }
.ir[data-reduced] .ir-fallback::before { animation: none; transform: none; }
.ir[data-paused] .ir-fallback::before { animation-play-state: paused; }
.ir-fx { z-index: 1; pointer-events: none; opacity: var(--ir-strength, 1); }
.ir-shader, .ir-overlay { display: block; width: 100%; height: 100%; pointer-events: none; border-radius: inherit; }
.ir-overlay { z-index: 2; }
.ir-img { z-index: 3; display: block; object-fit: cover; opacity: 0; border-radius: inherit;
  transition: opacity var(--ir-fade, 600ms) var(--ease-out); -webkit-user-drag: none; }
.ir-img[data-show] { opacity: 1; }
.ir-img[data-instant] { transition: none; }
.ir[data-phase="done"] .ir-img { -webkit-user-select: auto; user-select: auto; }
.ir-empty { z-index: 3; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  padding: 12px; text-align: center; color: var(--text-tertiary); font-size: 13px; line-height: 1.35;
  background: color-mix(in srgb, var(--text) 3%, var(--ir-surface)); }
.ir-empty svg { opacity: 0.8; }
.ir[data-phase="error"] .ir-empty { display: flex; }
.ir-slot { z-index: 4; pointer-events: none; }
::slotted(*) { pointer-events: auto; }
.ir-probe { position: absolute; width: 0; height: 0; overflow: hidden; color: var(--accent); }
`;
