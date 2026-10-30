/**
 * The preview card: the menu's raised card (hairline + --ib-shadow-raised, 12px), sized by the host (`width`,
 * `height`, or ::part(card)), fixed beside its trigger. Same pop as the menu and tooltip, origin-aware by side and
 * alignment; hoverable while open, no hits while hidden. Reduced motion: a 120ms fade, nothing moves.
 */
export const styles = `
:host { display: contents; }
.ui-root { display: contents; }
/* A fixed 100px box at 0,0: tells the card its containing block's origin and scale (transformed ancestors). */
.hc-probe { position: fixed; left: 0; top: 0; width: 100px; height: 0; visibility: hidden; pointer-events: none; }
.hc-card {
  --hc-w: 360px;
  position: fixed; z-index: var(--ui-hovercard-z, 170); left: 0; top: 0; box-sizing: border-box;
  width: min(var(--hc-w), calc(100vw - 16px)); max-width: calc(100vw - 16px); overflow: auto; overscroll-behavior: contain;
  border-radius: 12px; background: var(--ib-card); color: var(--ib-text-2);
  box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow-raised);
  font-size: 12.5px; line-height: 1.45; overflow-wrap: anywhere;
  transform-origin: top left; opacity: 0; visibility: hidden; pointer-events: none;
  transform: translateY(-4px) scale(0.96);
  transition: opacity 180ms var(--ease-out), transform 180ms var(--ease-out), visibility 0s linear 180ms;
}
.hc-card[data-sized] { height: var(--hc-h); }
.hc-card[data-align="center"] { transform-origin: top center; }
.hc-card[data-align="end"] { transform-origin: top right; }
.hc-card[data-side="top"] { transform-origin: bottom left; transform: translateY(4px) scale(0.96); }
.hc-card[data-side="top"][data-align="center"] { transform-origin: bottom center; }
.hc-card[data-side="top"][data-align="end"] { transform-origin: bottom right; }
.hc-card.is-open {
  opacity: 1; visibility: visible; pointer-events: auto; transform: none;
  transition: opacity 160ms var(--ease-out), transform 220ms var(--ease-out), visibility 0s;
}
/* Gentler, not zero: no scale or slide, a short fade (visibility still waits for it on the way out). */
@media (prefers-reduced-motion: reduce) {
  .hc-card, .hc-card[data-side="top"] { transform: none; transition: opacity 120ms ease, visibility 0s linear 120ms !important; }
  .hc-card.is-open { transition: opacity 120ms ease, visibility 0s !important; }
}
`;
