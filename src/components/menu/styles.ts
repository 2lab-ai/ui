/**
 * The model picker's popover language (`.mp-pop`, `.mp-probe`) for a plain menu: a card on the raised shadow,
 * rows on the well when focused, an origin-aware pop from the trigger's corner. The row well is the picker's
 * `--mp-well` (6% ink into the card), so both themes follow any page palette.
 */
export const styles = `
:host { --mn-well: color-mix(in srgb, var(--ib-text) 6%, var(--ib-card));
  display: inline-block; max-width: 100%; vertical-align: middle; }
.ui-root { display: flex; }
/* A fixed 100px box at 0,0: tells the menu its containing block's origin and scale (transformed ancestors). */
.mn-probe { position: fixed; left: 0; top: 0; width: 100px; height: 0; visibility: hidden; pointer-events: none; }
/* The menu: position fixed (an ancestor's overflow clip never cuts it), placed from the anchor in script.
   Closed it takes no hits; the exit keeps it visible for its 180ms, then hides it. */
.mn-pop {
  position: fixed; z-index: 150; left: 0; top: 0; box-sizing: border-box;
  min-width: 180px; max-width: min(320px, calc(100vw - 16px)); max-height: calc(100vh - 16px);
  overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain;
  padding: 4px; border-radius: 12px; background: var(--ib-card); color: var(--ib-text);
  box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow-raised);
  font-size: 13px; line-height: 18px; text-align: left; white-space: normal;
  transform-origin: top left; opacity: 0; visibility: hidden; pointer-events: none;
  transform: translateY(-4px) scale(0.96);
  transition: opacity 180ms var(--ease-out), transform 180ms var(--ease-out), visibility 0s linear 180ms;
}
.mn-pop:focus, .mn-pop:focus-visible { outline: none; }
.mn-pop[data-align="center"] { transform-origin: top center; }
.mn-pop[data-align="end"] { transform-origin: top right; }
.mn-pop[data-side="top"] { transform-origin: bottom left; transform: translateY(4px) scale(0.96); }
.mn-pop[data-side="top"][data-align="center"] { transform-origin: bottom center; }
.mn-pop[data-side="top"][data-align="end"] { transform-origin: bottom right; }
.mn-pop.is-open {
  opacity: 1; visibility: visible; pointer-events: auto; transform: none;
  transition: opacity 160ms var(--ease-out), transform 220ms var(--ease-out), visibility 0s;
}
.mn-group { display: grid; gap: 1px; }
.mn-sep { height: 1px; margin: 4px 0; background: var(--ib-card-border); }
.mn-head { padding: 6px 10px 2px; font-size: 11.5px; line-height: 16px; font-weight: 500; color: var(--ib-muted);
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.mn-item {
  display: flex; align-items: center; gap: 8px; min-height: 32px; padding: 6px 10px; border-radius: 8px;
  color: var(--ib-text); cursor: pointer; outline: none; user-select: none; -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent; transition: background-color var(--dur-press) ease;
}
.mn-item.has-desc { align-items: flex-start; }
.mn-item:focus { background: var(--mn-well); }
.mn-item:focus-visible { outline: 2px solid var(--border-focus); outline-offset: -2px; }
.mn-item[aria-disabled="true"] { opacity: 0.5; cursor: default; }
.mn-item.is-danger, .mn-item.is-danger .mn-icon { color: var(--st-fail-text); }
.mn-item.is-danger:focus { background: color-mix(in srgb, var(--st-fail) 10%, var(--ib-card)); }
.mn-check, .mn-icon { display: inline-grid; flex: none; place-items: center; width: 16px; height: 18px; }
.mn-check { color: var(--accent); }
.mn-icon { color: var(--ib-muted); }
.mn-check > svg, .mn-icon > svg { width: 16px; height: 16px; }
.mn-box { width: 12px; height: 12px; border-radius: 3.5px; box-shadow: inset 0 0 0 1.5px var(--ib-muted); }
.mn-text { display: flex; flex: 1; flex-direction: column; min-width: 0; }
.mn-label { overflow-wrap: anywhere; }
.mn-desc { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; margin-top: 1px;
  font-size: 12px; line-height: 16px; color: var(--ib-muted); overflow-wrap: anywhere; }
.mn-kbd {
  display: inline-grid; flex: none; place-items: center; box-sizing: border-box; min-width: 18px; height: 18px;
  margin-left: 12px; padding: 0 4px; border-radius: 5px; background: var(--ib-card);
  box-shadow: 0 0 0 1px var(--ib-card-border); font-family: inherit; font-size: 10.5px; font-weight: 500; line-height: 1;
  color: var(--ib-muted); white-space: nowrap;
}
@media (pointer: coarse), (max-width: 639px) {
  .mn-item { min-height: 44px; }
}
/* Gentler, not zero: no scale or slide, a short fade (visibility still waits for it on the way out). */
@media (prefers-reduced-motion: reduce) {
  .mn-pop, .mn-pop[data-side="top"] { transform: none; transition: opacity 120ms ease, visibility 0s linear 120ms !important; }
  .mn-pop.is-open { transition: opacity 120ms ease, visibility 0s !important; }
}
`;
