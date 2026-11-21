import { metalBaseCss } from '../metal/styles';

/**
 * Bare metal text: none of the button dressing (fill, rims, hairline) — only the glyphs. The metal canvas sits above
 * the live text (z 6), the glow above it (z 7) and the glyph rim above that (z 8); the text below keeps the layout,
 * selection and the accessible name. metal-fx's MetalText `data-mfx-bare` rules, in the shadow root.
 */
export const styles = `${metalBaseCss}
:host { vertical-align: baseline; }
.ui-root, .ui-root[data-pin] { background: transparent; color: inherit; border-radius: 4px; }
.ui-root::before, .ui-root::after { box-shadow: none !important; }
.mfx-inner { display: none !important; }
.metal-fx-canvas { z-index: 6; }
.mfx-glow { z-index: 7; }
.mt-rim { position: absolute; left: 0; top: 0; pointer-events: none; z-index: 8; }
.ui-root:not([data-ready]) .mt-rim, .ui-root[data-fallback] .mt-rim { display: none; }
.mt-text { position: relative; z-index: 5; display: inline-block; white-space: nowrap; letter-spacing: 0;
  font: inherit; color: inherit; }
/* Fallback: the words in a metallic gradient (no ring). */
.ui-root[data-fallback] .mfx-fallback { display: none; }
.ui-root[data-fallback] .mt-text { background: var(--mfx-gradient); -webkit-background-clip: text; background-clip: text;
  color: transparent; }
@media (forced-colors: active) { .ui-root[data-fallback] .mt-text { color: CanvasText; background: none; } }
`;
