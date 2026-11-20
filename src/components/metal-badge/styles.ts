import { metalBaseCss } from '../metal/styles';

/**
 * The "New" pill (metal-fx's MetalBadge, Figma: Portfolio › tab 3): a white fill, the metal over it as a full-pill mask,
 * then — inside the content layer, above the metal and below the label — a clean white core under the label (rim-only
 * metal), a white top-to-bottom wash and the inset rims; the label on top. Sizes are the Figma metrics × `--mb-k`.
 * The fill is white in both themes by design (`--metal-badge-fill` to change it); the label is its own dark ink on it.
 */
export const styles = `${metalBaseCss}
.ui-root, .ui-root[data-pin] { background: var(--metal-badge-fill, #ffffff); color: var(--mb-text, #323232); }
.mfx-inner { display: none !important; }
.mb-body { position: relative; z-index: 5; display: inline-flex; border-radius: inherit; pointer-events: auto; }
.mb-core, .mb-wash { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; }
/* Stops are relative to the ellipse radius, so 100% is its edge. */
.mb-core { background: radial-gradient(ellipse var(--mb-core-size, 49%) var(--mb-core-size, 49%) at 50% 50%,
  rgba(255, 255, 255, 1) var(--mb-core-r, 46%), rgba(255, 255, 255, 0) var(--mb-core-end, 100%));
  opacity: var(--mb-core-a, 0.94); }
.mb-wash { background: linear-gradient(to bottom, rgba(255, 255, 255, var(--mb-gradient, 0)), rgba(255, 255, 255, 0));
  box-shadow: inset 0 0 calc(8.333px * var(--mb-k, 1)) 0 rgba(255, 255, 255, var(--mb-glow, 0.41)),
    inset 0 0 calc(8.333px * var(--mb-k, 1)) 0 rgba(255, 255, 255, var(--mb-glow, 0.41)),
    inset 0 0 0 calc(0.833px * var(--mb-k, 1)) rgba(255, 255, 255, 0.5),
    inset 0 calc(0.833px * var(--mb-k, 1)) 0 0 rgba(255, 255, 255, 0.78); }
.mb-label { position: relative; display: flex; align-items: center; justify-content: center; box-sizing: border-box;
  min-width: calc(45px * var(--mb-k, 1)); height: calc(25px * var(--mb-k, 1));
  padding: 0 calc(9.1665px * var(--mb-k, 1));
  font: 600 calc(12.222px * var(--mb-k, 1)) / 1.4 var(--metal-badge-font, var(--font));
  color: var(--mb-text, #323232); letter-spacing: 0; white-space: nowrap; }
/* Fallback: the metal is a CSS gradient under the same white core. */
.ui-root[data-fallback] { background: var(--mfx-gradient); }
.ui-root[data-fallback] .mfx-fallback { display: none; }
@media (forced-colors: active) {
  .ui-root, .ui-root[data-fallback] { background: Canvas; border: 1px solid CanvasText; }
  .mb-core, .mb-wash { display: none; }
  .mb-label { color: CanvasText; }
}
`;
