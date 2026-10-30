/**
 * Two bubbles in the components' language: ink (the inverted text / card pair — reads on any page in both themes)
 * for a short label, card (the menu's raised card) for rich content. Same pop as the menu, origin-aware by side:
 * a bubble above grows up from its bottom edge, one below grows down from its top edge.
 */
export const styles = `
:host { display: inline-block; max-width: 100%; vertical-align: middle; }
.ui-root { display: flex; }
/* A fixed 100px box at 0,0: tells the bubble its containing block's origin and scale (transformed ancestors). */
.tt-probe { position: fixed; left: 0; top: 0; width: 100px; height: 0; visibility: hidden; pointer-events: none; }
.tt-pop {
  position: fixed; z-index: 160; left: 0; top: 0; box-sizing: border-box; width: max-content;
  max-width: min(260px, calc(100vw - 16px)); overflow-y: auto;
  padding: 5px 8px; border-radius: 7px; background: var(--ib-text); color: var(--ib-card); box-shadow: var(--ib-shadow);
  font-size: 12px; line-height: 1.4; font-weight: 500; text-align: left; white-space: normal; overflow-wrap: anywhere;
  transform-origin: bottom center; opacity: 0; visibility: hidden; pointer-events: none;
  transform: translateY(4px) scale(0.96);
  transition: opacity 180ms var(--ease-out), transform 180ms var(--ease-out), visibility 0s linear 180ms;
}
.tt-pop[data-align="start"] { transform-origin: bottom left; }
.tt-pop[data-align="end"] { transform-origin: bottom right; }
.tt-pop[data-side="bottom"] { transform-origin: top center; transform: translateY(-4px) scale(0.96); }
.tt-pop[data-side="bottom"][data-align="start"] { transform-origin: top left; }
.tt-pop[data-side="bottom"][data-align="end"] { transform-origin: top right; }
.tt-pop.is-open {
  opacity: 1; visibility: visible; pointer-events: auto; transform: none;
  transition: opacity 160ms var(--ease-out), transform 220ms var(--ease-out), visibility 0s;
}
:host([variant="card"]) .tt-pop {
  max-width: min(320px, calc(100vw - 16px)); padding: 8px 10px; border-radius: 10px;
  background: var(--ib-card); color: var(--ib-text-2); font-size: 12.5px; font-weight: 400; line-height: 1.45;
  box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow-raised);
}
/* Gentler, not zero: no scale or slide, a short fade (visibility still waits for it on the way out). */
@media (prefers-reduced-motion: reduce) {
  .tt-pop, .tt-pop[data-side="bottom"] { transform: none; transition: opacity 120ms ease, visibility 0s linear 120ms !important; }
  .tt-pop.is-open { transition: opacity 120ms ease, visibility 0s !important; }
}
`;
