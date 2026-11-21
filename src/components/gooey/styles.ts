/** `<ui-gooey>`: the group is the positioned, isolated box; the liquid svg sits behind every child (z-index −1 inside
 *  the isolated group: above the group's own background, below its children, positioned or not). */
export const styles = `
:host { position: relative; isolation: isolate; display: block; }
.ui-root { display: contents; }
.gy-sil, .gy-overlay {
  position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none;
}
/* The silhouette: promoted so WebKit does not repaint the goo a frame behind the plain-DOM content. */
.gy-sil { z-index: -1; will-change: filter, transform; }
/* The dissolve overlay paints above the content (the group is an isolated stacking context: it cannot escape). */
.gy-overlay { z-index: 9999; }
/* The image melt paints above its (transparent) cards, in tree order after the slot. */
.gy-melt { position: absolute; inset: 0; pointer-events: none; }
.gy-melt > svg { position: absolute; inset: 0; overflow: visible; pointer-events: none; }
`;

/** `<ui-gooey-item>`: a transparent wrapper. Its mode style (inline-block for a component-driven item, contents for
 *  an observed one) is written by the element into its own shadow root. */
export const itemStyles = `
:host { display: inline-block; }
.ui-root { display: contents; }
`;
