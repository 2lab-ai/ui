/**
 * The host lays out exactly `size` square (an inline block, centred on the line); the canvas overscans it — 1.5× the
 * box, the body's centre 0.1 of the box below the canvas's — so a hop or a flip is never clipped, and it takes no
 * pointer (the host takes the click), so the overscan never covers a neighbour. It fades in once its material is made.
 * Without a 2D canvas the still SVG fills the box instead.
 */
export const styles = `
:host { display: inline-block; vertical-align: middle; flex: none; line-height: 0;
  -webkit-tap-highlight-color: transparent; }
:host([hidden]) { display: none; }
.ba { position: relative; width: var(--ba-size, 64px); height: var(--ba-size, 64px); }
.ba-canvas { position: absolute; display: block; pointer-events: none;
  left: calc(var(--ba-size, 64px) * -0.25); top: calc(var(--ba-size, 64px) * -0.35);
  width: calc(var(--ba-size, 64px) * 1.5); height: calc(var(--ba-size, 64px) * 1.5);
  opacity: 0; transition: opacity 0.3s var(--ease-out, ease-out); }
.ba[data-shown] .ba-canvas { opacity: 1; }
.ba-still { display: none; position: absolute; inset: 0; }
.ba-still svg { display: block; width: 100%; height: 100%; overflow: visible; }
.ba[data-fallback] .ba-canvas { display: none; }
.ba[data-fallback] .ba-still { display: block; }
`;
