/**
 * The host is a block that wraps the host page's own element, like the React wrapper `<div>`: in a flex or grid cell
 * it hugs its child; elsewhere `width: fit-content` (or `display: inline-block`) makes it hug a button or a card.
 * The slotted element keeps the page's type and colour — the base sheet's text styles are handed back to the page —
 * and every beam layer is the engine's (`[data-beam]`, its ::before / ::after and `[data-beam-bloom]`), written per
 * element into the second style element. Nothing here takes the pointer.
 */
export const styles = `
:host { color: inherit; font: inherit; line-height: inherit; letter-spacing: inherit; -webkit-font-smoothing: inherit;
  color-scheme: inherit; }
.ui-root { display: contents; }
[data-beam] { display: block; }
[data-beam-bloom] { pointer-events: none; }
`;
