/** The element's own rules; the glow's layers come from the per-element stylesheet in `engine/styles.ts`. */
export const styles = `
:host { display: block; position: relative; }
/* Auto height around the slotted content; a host given a height (an overlay laid over a card) is filled. */
.ui-root { height: 100%; }
.vg { display: block; height: 100%; isolation: isolate; }
.vg > svg { position: absolute; width: 0; height: 0; overflow: hidden; pointer-events: none; }
.vg [data-bloom], .vg [data-warp], .vg [data-core], .vg canvas { pointer-events: none; }
`;
