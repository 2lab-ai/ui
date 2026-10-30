/**
 * Bar chart. A 12px card on the resting shadow (or `flat` inside a host frame); recessive axes — dashed hairline
 * gridlines on --border, 11px tabular ticks on --text-tertiary — so only the bars carry colour. Bars: ≤ 24px wide
 * with the slot's leftover as air, 4px round top (stacked: the top segment only), a 2px clear gap between stacked
 * segments carved from the upper one, 2px minimum for a non-zero value. Every colour is a token.
 */
export const styles = `
:host { --bc-gap: 3px; --bc-bar: min(24px, max(calc(100% - var(--bc-gap)), 60%));
  position: relative; min-width: 0; }
.bc { position: relative; padding: 12px 14px; border: 1px solid var(--ib-card-border); border-radius: 12px;
  background: var(--ib-card); box-shadow: var(--ib-shadow); color: var(--ib-text); font-size: 12px; line-height: 1.45; }
:host([flat]) .bc { padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.bc-title { font-size: 13px; font-weight: 650; line-height: 18px; color: var(--ib-text); overflow-wrap: anywhere; }
.bc-legend { display: flex; flex-wrap: wrap; gap: 2px 12px; margin: 4px 0 0; padding: 0; list-style: none;
  font-size: 12px; line-height: 16px; color: var(--ib-text-2); }
.bc-legend li { display: inline-flex; align-items: center; gap: 6px; min-width: 0; overflow-wrap: anywhere; }
.bc-sw { flex: none; display: block; width: 8px; height: 8px; border-radius: 2px; background: var(--c); }

.bc-chart { display: grid; grid-template-columns: calc(var(--bc-yw, 0) * 0.62em) minmax(0, 1fr); column-gap: 8px;
  margin-top: 14px; font-size: 11px; line-height: 14px; font-variant-numeric: tabular-nums; }
.bc-chart:first-child { margin-top: 8px; }
.bc[data-state="empty"] .bc-chart { column-gap: 0; }
.bc-y { position: relative; height: var(--bc-h); color: var(--text-tertiary); }
.bc-yl { position: absolute; right: 0; transform: translateY(50%); white-space: nowrap; }
.bc-plot { position: relative; height: var(--bc-h); }
.bc-grid { position: absolute; inset: 0; pointer-events: none; }
.bc-gl { position: absolute; left: 0; right: 0; bottom: 0; height: 0; border-top: 1px dashed var(--border); }
.bc-gl.is-base { border-top-style: solid; }

/* Bars: each slot is the whole column (the hit target is bigger than the mark), the painted bar sits centred in it. */
.bc-bars { position: absolute; inset: 0; display: flex; margin: 0; padding: 0; transition: opacity var(--dur-fade) ease; }
.bc[aria-busy="true"] .bc-bars { opacity: 0.5; }
.bc-slot { display: flex; flex: 1 1 0; min-width: 0; }
.bc-bar { appearance: none; display: flex; flex: 1; justify-content: center; min-width: 0; margin: 0; padding: 0; border: 0;
  border-radius: 6px; background: transparent; color: inherit; cursor: default; -webkit-tap-highlight-color: transparent; }
.bc[data-select] .bc-bar { cursor: pointer; }
.bc-bar:focus-visible { outline: 2px solid var(--border-focus); outline-offset: -2px; }
.bc-col { position: relative; display: flex; flex-direction: column-reverse; width: var(--bc-bar); height: 100%;
  transition: opacity 150ms ease; }
.bc-bars[data-hot] .bc-bar:not([data-on]) .bc-col { opacity: 0.55; }
.bc-seg { display: block; flex: none; width: 100%; background: var(--c); }
.bc-seg[data-nz] { min-height: 2px; }
.bc-seg[data-gap] { min-height: 4px; border-bottom: 2px solid transparent; background-clip: padding-box; }
.bc-seg[data-top] { border-radius: 4px 4px 0 0; }
.bc[data-anim] .bc-seg { transition: height var(--dur-move) var(--ease-out), min-height var(--dur-move) var(--ease-out); }
/* The selected bar: an ink tick under the baseline and its label in ink (colour never changes). */
.bc-bar[aria-current="true"] .bc-col::after { content: ""; position: absolute; left: 0; right: 0; bottom: -5px; height: 2px;
  border-radius: 1px; background: var(--ib-text); }

.bc-x { display: flex; grid-column: 2; margin-top: 7px; color: var(--text-tertiary); }
.bc-xl { display: flex; flex: 1 1 0; justify-content: center; min-width: 0; }
.bc-xl[data-off] { visibility: hidden; }
.bc-xl[data-sel] { color: var(--ib-text); font-weight: 600; }
.bc-xt { white-space: nowrap; }

.bc-empty { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; padding: 0 12px;
  font-size: 12.5px; color: var(--text-tertiary); text-align: center; }
.bc-skel { position: absolute; inset: 0; display: flex; }
.bc-sk { display: flex; flex: 1 1 0; align-items: flex-end; justify-content: center; min-width: 0; }
.bc-sk > i { display: block; width: var(--bc-bar); border-radius: 4px 4px 0 0; background: var(--ib-pill);
  animation: bc-pulse 1.6s ease-in-out infinite; }
@keyframes bc-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }

/* Tooltip: the menu's raised card, origin-aware pop toward the bar; glides between bars while open. */
.bc-tip { position: absolute; z-index: 5; left: 0; top: 0; box-sizing: border-box; width: max-content; min-width: 112px;
  max-width: min(240px, calc(100% - 8px)); padding: 7px 10px 8px; border-radius: 10px; background: var(--ib-card);
  color: var(--ib-text); box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow-raised); font-size: 12px;
  line-height: 16px; text-align: left; pointer-events: none; opacity: 0; visibility: hidden;
  transform: translateY(4px) scale(0.96); transform-origin: 50% 100%;
  transition: opacity 180ms var(--ease-out), transform 180ms var(--ease-out), visibility 0s linear 180ms; }
.bc-tip[data-side="right"] { transform: translateX(-4px) scale(0.96); }
.bc-tip[data-side="left"] { transform: translateX(4px) scale(0.96); }
.bc-tip.is-open { opacity: 1; visibility: visible; transform: none;
  transition: opacity 160ms var(--ease-out), transform 220ms var(--ease-out), left 160ms var(--ease-out),
    top 160ms var(--ease-out), visibility 0s; }
.bc-tip-h { margin-bottom: 4px; font-weight: 600; color: var(--ib-text); overflow-wrap: anywhere; }
.bc-tip-row { display: flex; align-items: center; gap: 6px; min-height: 18px; }
.bc-tip-l { flex: 1; min-width: 0; overflow: hidden; color: var(--ib-text-2); white-space: nowrap; text-overflow: ellipsis; }
.bc-tip-v { flex: none; margin-left: 10px; font-weight: 600; color: var(--ib-text); font-variant-numeric: tabular-nums; }
.bc-tip-row.is-total { margin-top: 4px; padding-top: 4px; border-top: 1px solid var(--ib-card-border); }
.bc-tip-none { color: var(--ib-muted); }
/* Gentler, not zero: no scale, slide or glide — a short fade. */
@media (prefers-reduced-motion: reduce) {
  .bc-tip, .bc-tip[data-side] { transform: none; transition: opacity 120ms ease, visibility 0s linear 120ms !important; }
  .bc-tip.is-open { transition: opacity 120ms ease, visibility 0s !important; }
}
@media (forced-colors: active) {
  .bc-seg, .bc-sw { forced-color-adjust: none; }
  .bc-tip { border: 1px solid CanvasText; }
}
`;
