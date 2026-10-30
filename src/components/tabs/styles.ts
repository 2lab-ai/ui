/**
 * Tabs in the components' language: muted labels that turn to ink when selected, one ink underline that glides to
 * the selected tab on the hairline under the list (measured, so tabs keep their own widths), a list that scrolls
 * sideways when it runs out of room (the session panel's agent tabs), colour-only hovers on fine pointers.
 */
export const styles = `
:host { display: block; min-width: 0; }
.tb { display: flex; flex-direction: column; min-width: 0; }
.tb-scroll { position: relative; min-width: 0; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; overscroll-behavior-x: contain; }
.tb-scroll::-webkit-scrollbar { display: none; }
.tb-list { position: relative; display: flex; align-items: stretch; gap: 2px; width: max-content; min-width: 100%; box-shadow: inset 0 -1px 0 var(--ib-card-border); }
.tb-tab {
  position: relative; display: inline-flex; flex: none; align-items: center; gap: 6px; min-height: 36px; padding: 0 12px;
  border: 0; border-radius: 8px 8px 0 0; background: none; color: var(--ib-muted); font: inherit; font-size: 13px;
  font-weight: 500; line-height: 1; white-space: nowrap; cursor: pointer; -webkit-tap-highlight-color: transparent;
  transition: color var(--dur-press) ease, background-color var(--dur-press) ease;
}
.tb-tab > svg { flex: none; width: 14px; height: 14px; }
.tb-tab[aria-selected="true"] { color: var(--ib-text); }
.tb-tab[aria-disabled="true"] { opacity: 0.45; cursor: not-allowed; }
.tb-tab:focus-visible { outline: 2px solid var(--border-focus); outline-offset: -2px; }
.tb-dot { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--tb-tone, var(--ib-muted)); }
.tb-dot[data-tone="run"] { --tb-tone: var(--st-run); animation: tb-pulse 1.6s ease-in-out infinite; }
.tb-dot[data-tone="wait"] { --tb-tone: var(--st-wait); }
.tb-dot[data-tone="done"] { --tb-tone: var(--st-done); }
.tb-dot[data-tone="fail"] { --tb-tone: var(--st-fail); }
.tb-badge {
  flex: none; min-width: 18px; padding: 2px 6px; border-radius: 6px; background: var(--ib-pill); color: var(--ib-text-2);
  font-size: 11px; font-weight: 500; line-height: 14px; text-align: center; font-variant-numeric: tabular-nums;
}
/* The underline: one ink bar placed from the selected tab's box. Before it is measured, the tab draws its own. */
.tb-ind {
  position: absolute; left: 0; bottom: 0; height: 2px; border-radius: 1px; background: var(--ib-text); pointer-events: none;
  transition: transform var(--dur-move) var(--ease-out), width var(--dur-move) var(--ease-out);
}
.tb-list:not([data-measured]) .tb-ind { opacity: 0; }
.tb-list:not([data-measured]) .tb-tab[aria-selected="true"] { box-shadow: inset 0 -2px 0 var(--ib-text); }
.tb-ind[data-still] { transition: none; }
.tb-panel { min-width: 0; }
.tb-panel:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; border-radius: 8px; }
.tb-panel[hidden] { display: none; }
@keyframes tb-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@media (hover: hover) and (pointer: fine) {
  .tb-tab:not([aria-disabled="true"]):not([aria-selected="true"]):hover { color: var(--ib-text); background: color-mix(in srgb, var(--ib-pill) 55%, transparent); }
}
@media (pointer: coarse), (max-width: 639px) {
  .tb-tab { min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .tb-ind { transition: none; }
  .tb-dot[data-tone="run"] { animation: none; }
}
`;
