/**
 * The host is the field: a block 240px tall in the quiet ink (the host sets its own height and colour). Touch pans
 * the page vertically through it; a crosshair shows only to a fine pointer, and not when motion is reduced (the
 * field then does not answer the pointer).
 */
export const styles = `
:host { display: block; position: relative; height: 240px; color: var(--text-tertiary); touch-action: pan-y;
  -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
.ui-root, .aw { width: 100%; height: 100%; }
.aw { position: relative; overflow: hidden; touch-action: pan-y; }
.aw-canvas { display: block; width: 100%; height: 100%; }
@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) { .aw { cursor: crosshair; } }
`;
