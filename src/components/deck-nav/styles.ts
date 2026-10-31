/**
 * The detail deck’s controls of the soma-work dashboard (`.panel-deck / .pd-btn / .pd-pos` and `.panel-deck-peek`),
 * redrawn in the library’s language: a 10px segment holding two 8px icon buttons and a tabular position, quiet
 * hovers on fine pointers, press .97, 44px on touch; the peek edges are hairline card tops that fade and grow in.
 */
const COLOR_T = 'var(--dur-press) ease';

export const styles = `
:host { display: block; min-width: 0; }
:host([data-single]) { display: none; }
.dn { display: flex; flex-direction: column; align-items: stretch; gap: 6px; min-width: 0; }
.dn-nav {
  display: inline-flex; flex: none; align-self: flex-end; align-items: center; gap: 2px; height: 32px; padding: 0 2px;
  border: 1px solid var(--ib-card-border); border-radius: 10px; background: var(--ib-card); color: var(--ib-text-2);
}
.dn-btn {
  display: inline-grid; flex: none; place-items: center; width: 28px; height: 26px; padding: 0; border: 0; border-radius: 8px;
  background: transparent; color: var(--ib-text-2); -webkit-tap-highlight-color: transparent;
  transition: background-color ${COLOR_T}, color ${COLOR_T}, opacity ${COLOR_T}, transform var(--dur-press) var(--ease-out);
}
.dn-btn svg { width: 14px; height: 14px; }
.dn-btn[aria-disabled="true"] { opacity: 0.4; cursor: default; }
.dn-btn:active:not([aria-disabled="true"]):not(:focus-visible) { transform: scale(0.97); }
.dn-btn:focus-visible { outline-offset: 0; }
.dn-pos { min-width: 40px; padding: 0 2px; text-align: center; font-size: 12px; font-weight: 500; line-height: 1; color: var(--ib-text-2); font-variant-numeric: tabular-nums; white-space: nowrap; user-select: none; }

/* ── Peek: up to two card tops behind the front card (the far one narrower and fainter), meeting what sits below ── */
.dn-peek { display: flex; flex-direction: column; align-items: center; margin-bottom: -1px; }
/* peek="only": no controls — the edges span the host's width (a panel header's top) */
.dn.is-peek-only { gap: 0; }
.dn-edge {
  display: block; box-sizing: border-box; height: 0; opacity: 0; border: 1px solid color-mix(in srgb, var(--text-tertiary) 40%, var(--ib-card-border));
  border-bottom: 0; border-radius: 10px 10px 0 0; background: color-mix(in srgb, var(--ib-pill) 60%, var(--ib-card));
  transition: height var(--dur-move) var(--ease-out), opacity var(--dur-fade) ease;
}
.dn-edge[data-on] { height: 7px; opacity: 1; }
.dn-edge:first-child { width: calc(100% - 48px); }
.dn-edge:first-child[data-on] { opacity: 0.7; }
.dn-edge:last-child { width: calc(100% - 24px); }

@media (hover: hover) and (pointer: fine) {
  .dn-btn:not([aria-disabled="true"]):hover { background: var(--ib-pill); color: var(--ib-text); }
}
@media (pointer: coarse), (max-width: 639px) {
  .dn-nav { height: 46px; }
  .dn-btn { width: 44px; height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .dn-btn:active:not([aria-disabled="true"]) { transform: none; }
  .dn-edge { transition: opacity 120ms ease !important; }
}
`;
