/**
 * Dot grid. One row per item: its name in a label column that sizes to the longest name (up to --dot-grid-label-w)
 * and truncates, then the cells sharing the row's width (CSS grid, each column minmax(0, 1fr)) up to a cap, so 14 or
 * 28 cells fit at 390px — they shrink, never overflow. Under 480px of its own width (a container query) and in the
 * lg size the name sits above its row. Every colour is a token: done is ink, fail / wait / run the status marks,
 * pending a hatch of ink, empty an ink outline, skip a faint pill. A status mark keeps its colour in mono (the mark is
 * where a state shows); text tints scale with --chroma.
 */
export const styles = `
:host { position: relative; min-width: 0; --dg-ink: var(--ib-text); }
.ui-root { container: dg / inline-size; }
.dg { --dg-h: 14px; --dg-max: 26px; --dg-gap: 3px; --dg-rowgap: 8px; --dg-r: 4px; --dg-label: 12.5px;
  color: var(--ib-text); font-size: 12px; line-height: 1.4; }
.dg[data-size="sm"] { --dg-h: 8px; --dg-max: 14px; --dg-gap: 2px; --dg-rowgap: 6px; --dg-r: 2px; --dg-label: 11.5px; }
.dg[data-size="lg"] { --dg-h: 34px; --dg-max: 64px; --dg-gap: 6px; --dg-rowgap: 14px; --dg-r: 9px; --dg-label: 13px; }

.dg-grid { display: grid; grid-template-columns: fit-content(var(--dot-grid-label-w, 132px)) minmax(0, 1fr);
  column-gap: 12px; row-gap: var(--dg-rowgap); align-items: center; }
.dg-row { display: grid; grid-column: 1 / -1; grid-template-columns: subgrid; align-items: center; min-width: 0; }
.dg-label { min-width: 0; overflow: hidden; font-size: var(--dg-label); font-weight: 550; line-height: 1.3;
  color: var(--ib-text); white-space: nowrap; text-overflow: ellipsis; }
.dg-cells { grid-column: -2 / -1; position: relative; display: grid; grid-template-columns: repeat(var(--dg-cols, 1), minmax(0, 1fr));
  gap: var(--dg-gap); width: 100%; min-width: 0;
  max-width: calc(var(--dg-cols-max, 1) * var(--dg-max) + (var(--dg-cols-max, 1) - 1) * var(--dg-gap)); }
.dg-head .dg-cells { align-items: end; }
.dg-col { min-width: 0; overflow: visible; font-size: 10.5px; line-height: 1.2; color: var(--text-tertiary);
  white-space: nowrap; font-variant-numeric: tabular-nums; }

/* The name above its row: the lg tiles, and any grid narrower than 480px. */
.dg[data-stack] .dg-grid { grid-template-columns: minmax(0, 1fr); }
.dg[data-stack] .dg-row { grid-template-columns: minmax(0, 1fr); row-gap: 6px; }
@container dg (max-width: 479px) {
  .dg-grid { grid-template-columns: minmax(0, 1fr); }
  .dg-row { grid-template-columns: minmax(0, 1fr); row-gap: 4px; }
}

/* A cell: the mark fills it; the hit area reaches into the gaps so hovering a row never flickers. */
.dg-cell { position: relative; display: block; min-width: 0; height: var(--dg-h); border-radius: var(--dg-r);
  cursor: default; -webkit-tap-highlight-color: transparent;
  transition: background-color 300ms ease, box-shadow 300ms ease, outline-color 150ms ease; }
.dg-cell::after { content: ""; position: absolute; inset: calc(var(--dg-rowgap) / -2) calc(var(--dg-gap) / -2); }
.dg-cell:hover:not(:focus-visible) { outline: 1.5px solid color-mix(in srgb, var(--dg-ink) 45%, transparent);
  outline-offset: 1px; }
.dg-cell:focus-visible { z-index: 1; outline-offset: 2px; }

.dg-mark { background: transparent; }
.dg-mark[data-state="done"] { background: var(--dg-ink); }
.dg-mark[data-state="fail"] { background: var(--st-fail); }
.dg-mark[data-state="wait"] { background: var(--st-wait); }
.dg-mark[data-state="run"] { background: var(--st-run); }
.dg-mark[data-state="pending"] {
  background-color: color-mix(in srgb, var(--dg-ink) 5%, transparent);
  background-image: repeating-linear-gradient(-45deg, color-mix(in srgb, var(--dg-ink) 30%, transparent) 0 1.25px,
    transparent 1.25px 4px);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dg-ink) 16%, transparent); }
.dg-mark[data-state="empty"] { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dg-ink) 24%, transparent); }
.dg-mark[data-state="skip"]::before { content: ""; position: absolute; left: 12%; right: 12%; top: 50%;
  height: max(2px, 30%); border-radius: 999px; transform: translateY(-50%);
  background: color-mix(in srgb, var(--dg-ink) 18%, transparent); }
/* Running: a gentle breath. Under reduced motion it is still (the global rule ends it on its resting frame). */
.dg-cell[data-state="run"] { animation: dg-pulse 1.8s ease-in-out infinite; }
@keyframes dg-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.42; } }
@media (prefers-reduced-motion: reduce) { .dg-cell[data-state="run"] { animation: none; } }

.dg-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 16px; margin-top: 12px; }
.dg-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 0; padding: 0; list-style: none;
  font-size: 12px; line-height: 16px; color: var(--ib-text-2); }
.dg-legend li { display: inline-flex; align-items: center; gap: 6px; min-width: 0; overflow-wrap: anywhere; }
.dg-sw { position: relative; flex: none; display: block; width: 10px; height: 10px; border-radius: 3px; }
.dg-sum { margin: 0; font-size: 12px; line-height: 16px; color: var(--ib-muted); font-variant-numeric: tabular-nums; }
.dg-empty { margin: 0; padding: 8px 0; font-size: 12.5px; color: var(--text-tertiary); }

/* Tooltip: a small raised bubble above the cell (below when there is no room), outside the drawn tree. */
.dg-tip { position: absolute; z-index: 5; left: 0; top: 0; box-sizing: border-box; width: max-content;
  max-width: min(260px, calc(100% - 8px)); padding: 6px 9px 7px; border-radius: 9px; background: var(--ib-card);
  color: var(--ib-text); box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow-raised); font-size: 12px;
  line-height: 16px; pointer-events: none; opacity: 0; visibility: hidden; transform: translateY(3px) scale(0.97);
  transition: opacity 160ms var(--ease-out), transform 200ms var(--ease-out), visibility 0s linear 160ms; }
.dg-tip[data-side="below"] { transform: translateY(-3px) scale(0.97); }
.dg-tip.is-open { opacity: 1; visibility: visible; transform: none;
  transition: opacity 140ms var(--ease-out), transform 200ms var(--ease-out), left 140ms var(--ease-out),
    top 140ms var(--ease-out), visibility 0s; }
.dg-tip-h { font-weight: 600; overflow-wrap: anywhere; }
.dg-tip-b { display: flex; align-items: center; gap: 6px; color: var(--ib-text-2); overflow-wrap: anywhere; }
.dg-tip-b .dg-sw { width: 8px; height: 8px; border-radius: 2px; }
@media (prefers-reduced-motion: reduce) {
  .dg-tip, .dg-tip[data-side] { transform: none; transition: opacity 120ms ease, visibility 0s linear 120ms !important; }
  .dg-tip.is-open { transition: opacity 120ms ease, visibility 0s !important; }
}
@media (forced-colors: active) {
  .dg-mark { forced-color-adjust: none; }
  .dg-mark[data-state="empty"], .dg-mark[data-state="pending"] { outline: 1px solid CanvasText; outline-offset: -1px; }
  .dg-tip { border: 1px solid CanvasText; }
}
`;
