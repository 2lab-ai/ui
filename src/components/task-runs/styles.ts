import { planCss } from '../../core/plan';

/**
 * Run rows as disclosure buttons (the board's expansion recipe: chevron on --dur-press, region 0fr → 1fr with a
 * fade, inert while closed), the status chip shared with the plan (`planCss` `.pl-state`), a definition list per run
 * and a totals row. Tokens and color-mix() only.
 */
export const styles = `
${planCss}
:host { display: block; min-width: 0; }
.tr { --pl-bg: var(--ib-card); position: relative; min-width: 0; padding: 12px 10px 10px; border: 1px solid var(--ib-card-border); border-radius: 12px; background: var(--ib-card); box-shadow: var(--ib-shadow); color: var(--ib-text); font-size: 13px; line-height: 1.45; letter-spacing: -0.006em; }
:host([flush]) .tr { --pl-bg: var(--surface); padding: 0; border: 0; border-radius: 0; background: none; box-shadow: none; }
.tr-head { display: flex; align-items: center; gap: 8px; min-width: 0; margin: 0 4px 6px; }
.tr-title { min-width: 0; margin: 0; font-size: 13px; font-weight: 650; line-height: 20px; color: var(--ib-text); overflow-wrap: anywhere; }
.tr-count { flex: none; min-width: 18px; padding: 0 6px; border-radius: 999px; background: var(--ib-pill); color: var(--ib-text-2); font-size: 11px; font-weight: 600; line-height: 18px; text-align: center; font-variant-numeric: tabular-nums; }

/* ── A run: one button row (chevron · ref + title over the meta line · status chip), its detail below ── */
.tr-list { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
.tr-run { min-width: 0; border-radius: 10px; transition: background-color var(--dur-fade) ease; }
.tr-run[data-open] { background: color-mix(in srgb, var(--ib-pill) 45%, transparent); }
.tr-row {
  display: grid; grid-template-columns: 12px minmax(0, 1fr) auto; align-items: start; column-gap: 10px; width: 100%;
  min-height: 44px; padding: 7px 8px 7px 10px; border: 0; border-radius: 10px; background: none; color: var(--ib-text);
  font: inherit; text-align: left; -webkit-tap-highlight-color: transparent;
  transition: background-color var(--dur-press) ease;
}
.tr-row:focus-visible { outline: 2px solid var(--border-focus); outline-offset: -2px; }
.tr-row:active { background: var(--ib-pill); }
.tr-chev { width: 12px; height: 12px; margin-top: 3px; color: var(--ib-muted); transition: transform var(--dur-press) var(--ease-out); }
.tr-run[data-open] .tr-chev { transform: rotate(90deg); }
.tr-main { min-width: 0; }
.tr-line { display: block; font-size: 13px; font-weight: 500; line-height: 18px; overflow-wrap: anywhere; }
.tr-ref { margin-right: 6px; font-size: 11px; font-weight: 500; color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
.tr-name { color: var(--ib-text); }
.tr-run[data-status="dropped"] .tr-name { color: var(--text-tertiary); text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--text-tertiary) 55%, transparent); }
.tr-meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 6px; margin-top: 2px; font-size: 12px; line-height: 17px; color: var(--ib-muted); font-variant-numeric: tabular-nums; }
.tr-m { white-space: nowrap; }
.tr-dot { color: var(--text-tertiary); }
.tr-row > .pl-state { margin: 1px 0 0; }

/* ── The detail: 0fr → 1fr with a fade, inert while closed ── */
.tr-region { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--dur-expand) var(--ease-out); }
.tr-run[data-open] > .tr-region { grid-template-rows: 1fr; }
.tr-in { min-height: 0; overflow: hidden; opacity: 0; visibility: hidden; transition: opacity var(--dur-expand) var(--ease-out), visibility 0s linear var(--dur-expand); }
.tr-run[data-open] > .tr-region > .tr-in { opacity: 1; visibility: visible; transition: opacity var(--dur-expand) var(--ease-out), visibility 0s; }
.tr-detail { padding: 2px 10px 12px 32px; }
.tr-dl { display: grid; grid-template-columns: minmax(0, max-content) minmax(0, 1fr); gap: 5px 14px; margin: 0; font-size: 12.5px; line-height: 18px; }
.tr-dl > div { display: contents; }
.tr-dl dt { min-width: 0; color: var(--ib-muted); }
.tr-dl dd { min-width: 0; margin: 0; color: var(--ib-text); overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.tr-tok-total { font-weight: 600; }
.tr-parts { display: inline-flex; flex-wrap: wrap; gap: 0 6px; margin-left: 8px; color: var(--ib-text-2); }
.tr-part { white-space: nowrap; }
.tr-tools { display: flex; flex-wrap: wrap; gap: 4px; margin: 0; padding: 0; list-style: none; }
.tr-tool { display: inline-flex; align-items: center; gap: 5px; height: 20px; padding: 0 7px; border-radius: 6px; background: var(--ib-pill); font-size: 12px; line-height: 1; white-space: nowrap; }
.tr-tool-name { color: var(--ib-text); font-family: var(--mono); font-size: 11.5px; }
.tr-tool-n { color: var(--ib-muted); font-variant-numeric: tabular-nums; }
.tr-revs { display: flex; flex-direction: column; gap: 3px; margin: 0; padding: 0; list-style: none; }
.tr-revs > li { display: flex; gap: 8px; min-width: 0; }
.tr-rev-at { flex: none; color: var(--ib-muted); font-variant-numeric: tabular-nums; }
.tr-rev-note { min-width: 0; overflow-wrap: anywhere; }
.tr-actions { display: flex; justify-content: flex-end; margin-top: 10px; }
.tr-open {
  display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 0 12px; border: 1px solid var(--ib-card-border);
  border-radius: 8px; background: var(--ib-card); color: var(--ib-text); font: inherit; font-size: 12.5px; font-weight: 500;
  text-decoration: none; white-space: nowrap; -webkit-tap-highlight-color: transparent;
  transition: border-color var(--dur-press) ease, background-color var(--dur-press) ease, transform var(--dur-press) var(--ease-out);
}
.tr-open > svg { width: 12px; height: 12px; color: var(--ib-muted); }
.tr-open:active:not(:focus-visible) { transform: scale(0.97); }

/* ── Totals ── */
.tr-total { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; margin: 8px 4px 0; padding: 9px 6px 2px; border-top: 1px solid var(--border); font-size: 12.5px; line-height: 18px; color: var(--ib-text-2); font-variant-numeric: tabular-nums; }
.tr-total-k { font-weight: 600; color: var(--ib-text); }
.tr-total-v { display: inline-flex; flex-wrap: wrap; gap: 0 6px; min-width: 0; }
.tr-total-note { color: var(--ib-muted); }
/* Extra totals rows (outside tasks, subagents apart): quieter, under the first, no rule of their own */
.tr-total.tr-total-x { margin-top: 0; padding-top: 2px; border-top: 0; color: var(--ib-muted); }
.tr-total-x .tr-total-k { font-weight: 500; color: var(--ib-text-2); }
.tr-note { overflow-wrap: anywhere; }

/* ── Empty ── */
.tr-empty { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px 12px 16px; text-align: center; font-size: 12.5px; line-height: 1.45; color: var(--ib-muted); }
.tr-empty strong { font-size: 13px; font-weight: 600; color: var(--ib-text-2); }
.tr-empty-icon { width: 20px; height: 20px; margin-bottom: 2px; color: var(--ib-muted); }

@media (hover: hover) and (pointer: fine) {
  .tr-row:hover { background: var(--ib-pill); }
  .tr-open:hover { border-color: var(--ib-muted); }
}
@media (pointer: coarse), (max-width: 639px) {
  .tr-open { min-height: 44px; }
}
@media (max-width: 479px) {
  .tr-row { grid-template-columns: 12px minmax(0, 1fr); }
  .tr-row > .pl-state { grid-column: 2; justify-self: start; margin-top: 4px; }
  .tr-detail { padding-left: 30px; }
  .tr-dl { grid-template-columns: minmax(0, 1fr); gap: 1px; }
  .tr-dl dd + dt, .tr-dl > div + div > dt { margin-top: 6px; }
}
@media (prefers-reduced-motion: reduce) {
  .tr-region, .tr-chev, .tr-open, .tr-run { transition: none !important; }
  .tr-open:active:not(:focus-visible) { transform: none; }
  .tr-in { transition: opacity 120ms ease, visibility 0s linear 120ms !important; }
  .tr-run[data-open] > .tr-region > .tr-in { transition: opacity 120ms ease, visibility 0s !important; }
}
`;
