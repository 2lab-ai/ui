/**
 * The host is an inline box of the tuned size (64, 32 or 20 px — written per element into the first style element);
 * the page's own width / height on the element win, and the orb scales to fit, centred. The canvas fills the box and
 * takes no pointer; the label is visually hidden text inside the status.
 */
export const styles = `
:host { display: inline-block; vertical-align: middle; line-height: 0; flex: none; }
.ui-root, .orb { width: 100%; height: 100%; }
.orb { position: relative; }
.orb-canvas { display: block; width: 100%; height: 100%; pointer-events: none; }
`;
