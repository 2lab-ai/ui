/**
 * The board's expansion recipe (grid rows 0fr → 1fr on --dur-expand with an opacity fade, `.ib-expand`) as one
 * disclosure: a full-width summary row with a chevron that turns on --dur-press, and a region that is inert while
 * closed. Once the region has finished opening it stops clipping, so focus rings inside are not cut off.
 */
export const styles = `
:host { display: block; min-width: 0; }
.dc { min-width: 0; }
:host([variant="card"]) .dc { border: 1px solid var(--ib-card-border); border-radius: 12px; background: var(--ib-card); box-shadow: var(--ib-shadow); }
.dc-heading { margin: 0; font: inherit; }
.dc-head {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: 32px; padding: 6px 8px; border: 0; border-radius: 8px;
  background: none; color: var(--ib-text); font: inherit; font-size: 13px; font-weight: 600; line-height: 1.35; text-align: left;
  cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background-color var(--dur-press) ease, color var(--dur-press) ease;
}
:host([variant="card"]) .dc-head { min-height: 44px; padding: 10px 12px; border-radius: 11px; }
.dc-head:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
:host([variant="card"]) .dc-head:focus-visible { outline-offset: -2px; }
.dc-head[aria-disabled="true"] { cursor: default; color: var(--ib-text-2); }
.dc-head:active:not([aria-disabled="true"]) { background: var(--ib-pill); }
.dc-chev { flex: none; width: 12px; height: 12px; color: var(--ib-muted); transition: transform var(--dur-press) var(--ease-out); }
.dc[data-open] .dc-chev { transform: rotate(90deg); }
.dc-summary { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
.dc-meta { flex: none; margin-left: auto; color: var(--ib-muted); font-size: 12px; font-weight: 500; font-variant-numeric: tabular-nums; }
.dc-meta:empty { display: none; }
.dc-region { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--dur-expand) var(--ease-out); }
.dc[data-open] .dc-region { grid-template-rows: 1fr; }
.dc-inner { min-height: 0; overflow: hidden; opacity: 0; visibility: hidden; transition: opacity var(--dur-expand) var(--ease-out), visibility 0s linear var(--dur-expand); }
.dc[data-open] .dc-inner { opacity: 1; visibility: visible; transition: opacity var(--dur-expand) var(--ease-out), visibility 0s; }
.dc[data-open][data-settled] .dc-inner { overflow: visible; }
.dc-body { padding: 2px 8px 10px 28px; font-size: 13px; line-height: 1.5; color: var(--ib-text-2); }
:host([variant="card"]) .dc-body { padding: 0 14px 14px 32px; }
:host([flush]) .dc-body { padding: 0; }
@media (hover: hover) and (pointer: fine) {
  .dc-head:not([aria-disabled="true"]):hover { background: var(--ib-pill); }
  :host([variant="card"]) .dc-head:not([aria-disabled="true"]):hover { background: color-mix(in srgb, var(--ib-pill) 55%, transparent); }
}
@media (pointer: coarse), (max-width: 639px) {
  .dc-head { min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .dc-region, .dc-chev { transition: none !important; }
  .dc-inner { transition: opacity 120ms ease, visibility 0s linear 120ms !important; }
  .dc[data-open] .dc-inner { transition: opacity 120ms ease, visibility 0s !important; }
}
`;
