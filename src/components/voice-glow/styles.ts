/** The element's own rules; the glow's layers come from the per-element stylesheet in `engine/styles.ts`. */
export const styles = `
:host { display: block; position: relative; }
.vg { display: block; isolation: isolate; }
.vg > svg { position: absolute; width: 0; height: 0; overflow: hidden; pointer-events: none; }
.vg [data-bloom], .vg [data-warp], .vg [data-core], .vg canvas { pointer-events: none; }
`;
