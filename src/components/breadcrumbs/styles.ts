/**
 * The dashboard's two trails (`.crumbs`, the page's; `.pa-path` / `.pa-crumb`, the agent panel's) as one element:
 * quiet crumbs on one line, a chevron between them, the current page in ink, the middle folded behind "…" when the
 * row overflows. Tokens and color-mix() only; no hover movement; 44px on coarse pointers.
 */
const COLOR_T = 'var(--dur-press) ease';

export const styles = `
:host { display: block; min-width: 0; }
.bc { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 15px; line-height: 22px; }
:host([size="sm"]) .bc { font-size: 12px; line-height: 18px; gap: 6px; }
.bc-list { display: flex; flex: 1 1 auto; align-items: center; gap: 0; min-width: 0; margin: 0; padding: 0; list-style: none; overflow: hidden; white-space: nowrap; }
/* Room: the middle crumbs give way first, then the root; the current page reads whole up to 60% of the row. */
.bc-item { display: flex; align-items: center; flex: 0 4 auto; min-width: 0; }
.bc-item:first-child { flex-shrink: 1; max-width: 55%; }
.bc-item:last-child { flex-shrink: 0; max-width: 60%; }
.bc-item:only-child { max-width: 100%; }
.bc-item.bc-fold { flex: none; }
.bc-item.is-in { animation: bc-in var(--dur-fade) var(--ease-out) both; }
@keyframes bc-in { from { opacity: 0; } }
.bc-sep { display: inline-grid; flex: none; place-items: center; width: 16px; color: var(--text-tertiary); }
:host([size="sm"]) .bc-sep { width: 14px; }
.bc-sep svg { width: 12px; height: 12px; }
:host([size="sm"]) .bc-sep svg { width: 10px; height: 10px; }

.bc-link, .bc-btn, .bc-cur, .bc-more {
  display: block; min-width: 0; max-width: 100%; margin: 0; padding: 3px 6px; border: 0; border-radius: 6px; background: none;
  color: var(--text-secondary); font: inherit; text-align: left; text-decoration: none; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; -webkit-tap-highlight-color: transparent;
  transition: background-color ${COLOR_T}, color ${COLOR_T}, transform var(--dur-press) var(--ease-out);
}
:host([size="sm"]) .bc-link, :host([size="sm"]) .bc-btn, :host([size="sm"]) .bc-cur, :host([size="sm"]) .bc-more { padding: 2px 5px; border-radius: 5px; }
.bc-link { cursor: pointer; }
.bc-cur { color: var(--text); font-weight: 600; cursor: default; }
.bc-more { display: inline-grid; flex: none; place-items: center; width: 28px; height: 28px; padding: 0; color: var(--text-secondary); }
:host([size="sm"]) .bc-more { width: 24px; height: 22px; }
.bc-more svg { width: 14px; height: 14px; }
.bc-link:active:not(:focus-visible), .bc-btn:active:not(:focus-visible), .bc-more:active:not(:focus-visible) { transform: scale(0.97); }
/* Inset ring: the list clips its overflow (the fold), so a ring outside the crumb's box would be cut (as tabs do). */
.bc-link:focus-visible, .bc-btn:focus-visible, .bc-more:focus-visible { outline-offset: -2px; }

/* The host's chip after the trail (a .ui-status): it keeps its width, the trail folds first. */
.bc-end { display: inline-flex; flex: none; align-items: center; min-width: 0; margin-left: auto; }
/* No chip slotted: no end box and no gap paid for it. */
.bc-end.is-empty { display: none; }

@media (hover: hover) and (pointer: fine) {
  .bc-link:hover, .bc-btn:hover, .bc-more:hover { background: var(--ib-pill); color: var(--text); }
}
@media (pointer: coarse), (max-width: 639px) {
  .bc-link, .bc-btn, .bc-more { min-height: 44px; padding-top: 11px; padding-bottom: 11px; }
  .bc-more { width: 44px; }
  :host([size="sm"]) .bc-link, :host([size="sm"]) .bc-btn { padding-top: 13px; padding-bottom: 13px; }
  :host([size="sm"]) .bc-more { width: 44px; height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .bc-item.is-in { animation: none; }
  .bc-link, .bc-btn, .bc-more { transition: none !important; }
  .bc-link:active:not(:focus-visible), .bc-btn:active:not(:focus-visible), .bc-more:active:not(:focus-visible) { transform: none; }
}
`;
