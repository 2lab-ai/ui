/**
 * The work log: task groups as the board's disclosure (grid rows 0fr → 1fr on --dur-expand with an opacity fade,
 * chevron on --dur-press), entry rows with a kind icon + label (status never by colour alone), tints from status
 * tokens with color-mix, a plain tool line behind each tool slot, and the child-agent card row. Hover changes colour
 * and borders only, on fine pointers; full-width rows answer a press with a background, never a scale.
 */
export const styles = `
:host { display: flex; flex-direction: column; min-height: 0; min-width: 0; }
.ui-root { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; min-width: 0; }
.wl-log { flex: 1 1 auto; min-height: 0; }
.wl-legacy {
  display: flex; align-items: flex-start; gap: 8px; margin: 0 0 6px; padding: 7px 10px; border-radius: 8px;
  background: var(--ib-pill); color: var(--ib-text-2); font-size: 12px; line-height: 1.45;
}
.wl-legacy[hidden] { display: none; }
.wl-legacy svg { flex: none; width: 14px; height: 14px; margin-top: 1px; color: var(--ib-muted); }
.wl-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--ib-muted); font-size: 13px; line-height: 1.45; text-align: center; }
.wl-empty svg { width: 20px; height: 20px; }
.wl-empty[data-state="denied"] .wl-empty-text { color: var(--ib-text-2); }

/* Group */
.wl-group { display: flex; flex-direction: column; min-width: 0; padding: 2px 12px; color: var(--ib-text); font-size: 12.5px; line-height: 1.45; }
.wl-group:first-child { padding-top: 8px; }
.wl-group:last-child { padding-bottom: 10px; }
.wl-gh-h { margin: 0; font: inherit; }
.wl-gh {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: 32px; padding: 5px 8px; border: 0; border-radius: 8px;
  background: var(--surface-raised); color: var(--ib-text); font: inherit; font-size: 12.5px; font-weight: 600; line-height: 1.35;
  text-align: left; -webkit-tap-highlight-color: transparent; transition: background-color var(--dur-press) ease;
}
.wl-gh:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 1px; }
.wl-gh:active:not(:focus-visible) { background: var(--ib-pill); }
.wl-g-chev { flex: none; width: 12px; height: 12px; color: var(--ib-muted); transition: transform var(--dur-press) var(--ease-out); }
.wl-group[data-open] .wl-g-chev { transform: rotate(90deg); }
.wl-g-ref { flex: none; color: var(--ib-muted); font-weight: 500; font-variant-numeric: tabular-nums; }
.wl-g-title { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wl-g-title[data-empty] { color: var(--ib-muted); font-weight: 500; }
.wl-g-count {
  flex: none; min-width: 20px; padding: 1px 6px; border-radius: 6px; background: var(--ib-card); color: var(--ib-text-2);
  font-size: 11px; font-weight: 600; text-align: center; font-variant-numeric: tabular-nums;
}
.wl-g-time { flex: none; color: var(--ib-muted); font-size: 11.5px; font-weight: 500; font-variant-numeric: tabular-nums; }
/* The task's ledger: a quiet second line under the title, indented past the chevron */
.wl-gh { flex-wrap: wrap; }
.wl-g-meta {
  flex: 1 0 100%; display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 6px; min-width: 0; margin-top: -2px; padding-left: 20px;
  color: var(--ib-muted); font-size: 11.5px; font-weight: 500; line-height: 1.4; font-variant-numeric: tabular-nums;
}
.wl-g-kv { min-width: 0; overflow-wrap: anywhere; }
.wl-g-k { color: var(--ib-muted); }
.wl-g-v { color: var(--ib-text-2); }
.wl-g-dot { color: var(--ib-muted); }
/* A headless group: entries in line between the tasks — no head, no rail, always open */
.wl-group[data-headless] .wl-g-body { margin: 2px 0; padding-left: 0; border-left: 0; }
.wl-g-region { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: 0fr; transition: grid-template-rows var(--dur-expand) var(--ease-out); }
.wl-group[data-open] .wl-g-region { grid-template-rows: 1fr; }
.wl-g-inner {
  min-height: 0; overflow: hidden; opacity: 0; visibility: hidden;
  transition: opacity var(--dur-expand) var(--ease-out), visibility 0s linear var(--dur-expand);
}
.wl-group[data-open] .wl-g-inner { opacity: 1; visibility: visible; transition: opacity var(--dur-expand) var(--ease-out), visibility 0s; }
.wl-group[data-open][data-settled] .wl-g-inner { overflow: visible; }
.wl-g-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; margin: 4px 0 6px 13px; padding-left: 10px; border-left: 2px solid var(--ib-card-border); }

/* Entry */
.wl-entry { min-width: 0; }
.wl-entry[data-enter] { animation: wl-rise var(--dur-move) var(--ease-out) both; }
@keyframes wl-rise { from { opacity: 0; transform: translateY(3px); } }
.wl-row { min-width: 0; padding: 4px 8px; border-left: 2px solid transparent; border-radius: 8px; }
.wl-row[role="button"] { cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background-color var(--dur-press) ease; }
.wl-row[role="button"]:active:not(:focus-visible) { background: var(--ib-pill); }
.wl-row[aria-expanded="true"] { background: var(--surface-raised); }
.wl-row:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 1px; }
.wl-head { display: flex; align-items: center; gap: 6px; min-width: 0; color: var(--ib-muted); font-size: 11px; line-height: 1.4; }
.wl-k-icon { flex: none; width: 12px; height: 12px; }
/* Mono (0.25.0): a final / error entry's kind icon keeps its state; the head's words go ink. */
.wl-entry[data-kind="final"] .wl-k-icon { color: color-mix(in srgb, currentColor calc(100% * var(--chroma)), var(--st-done)); }
.wl-entry[data-kind="error"] .wl-k-icon { color: color-mix(in srgb, currentColor calc(100% * var(--chroma)), var(--st-fail)); }
.wl-label { font-weight: 650; letter-spacing: 0.02em; }
.wl-time { flex: none; margin-left: auto; color: var(--ib-muted); font-size: 11px; font-weight: 500; font-variant-numeric: tabular-nums; }
.wl-row-chev { flex: none; width: 12px; height: 12px; color: var(--ib-muted); transition: transform var(--dur-press) var(--ease-out); }
.wl-row[aria-expanded="true"] .wl-row-chev { transform: rotate(90deg); }
.wl-text { margin-top: 2px; color: var(--ib-text); white-space: pre-wrap; overflow-wrap: anywhere; }
.wl-entry[data-kind="narration"] .wl-text { color: var(--ib-text-2); }
.wl-entry[data-kind="instruction"] .wl-row { border-left-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }
.wl-entry[data-kind="instruction"] .wl-row[aria-expanded="true"] { background: color-mix(in srgb, var(--accent) 14%, transparent); }
.wl-entry[data-kind="instruction"] .wl-head { color: color-mix(in srgb, var(--accent) 70%, var(--ib-text)); }
.wl-entry[data-kind="final"] .wl-row { border-left-color: var(--st-done); }
.wl-entry[data-kind="final"] .wl-head { color: color-mix(in srgb, var(--st-done) calc(70% * var(--chroma)), var(--ib-text)); }
.wl-entry[data-kind="notice"] .wl-text { color: var(--ib-muted); }
.wl-entry[data-kind="error"] .wl-row { border-left-color: var(--st-fail); background: color-mix(in srgb, var(--st-fail) calc(8% * var(--chroma)), transparent); }
.wl-entry[data-kind="error"] .wl-head, .wl-entry[data-kind="error"] .wl-text { color: var(--st-fail-text); }
.wl-entry[data-kind="system"] .wl-row { padding: 3px 8px; border-left-color: var(--ib-card-border); }
.wl-entry[data-kind="system"] .wl-head { gap: 8px; color: var(--ib-text-2); font-size: 12px; }
.wl-sys-line { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wl-entry > .skill-badges { margin: 4px 0 2px 10px; }
.wl-entry > .skill-pane { margin: 6px 0 4px 10px; }
.wl-detail { min-width: 0; margin: 4px 0 6px 10px; }
.wl-detail[hidden] { display: none; }
.wl-detail[data-enter] { animation: wl-fade var(--dur-fade) var(--ease-out) both; }
@keyframes wl-fade { from { opacity: 0; } }

/* Tool line (behind the tool slot) */
::slotted(*) { display: block; margin: 2px 0; }
.wl-tool {
  display: flex; align-items: center; gap: 6px; min-width: 0; min-height: 28px; padding: 3px 8px; border-radius: 8px;
  color: var(--ib-text-2); font-size: 12px;
}
.wl-mark { flex: none; display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; }
.wl-mark svg { width: 12px; height: 12px; }
.wl-tool[data-status="running"] .wl-mark { color: color-mix(in srgb, var(--st-run) calc(70% + 30% * (1 - var(--chroma))), var(--ib-text)); }
.wl-tool[data-status="success"] .wl-mark { color: color-mix(in srgb, var(--st-done) calc(70% + 30% * (1 - var(--chroma))), var(--ib-text)); }
.wl-tool[data-status="error"] .wl-tool-name { color: var(--st-fail-text); }
.wl-tool[data-status="error"] .wl-mark { color: color-mix(in srgb, var(--st-fail-text) calc(100% * var(--chroma)), var(--st-fail)); }
.wl-tool[data-status="interrupted"] .wl-mark { color: var(--ib-muted); }
.wl-tool-name { flex: none; color: var(--ib-text); font-family: var(--mono); font-size: 11.5px; font-weight: 600; }
.wl-tool-sum { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wl-spin {
  flex: none; display: inline-block; width: 12px; height: 12px; border-radius: 50%;
  border: 1.5px solid color-mix(in srgb, currentColor 30%, transparent); border-top-color: currentColor;
  animation: wl-spin 0.9s linear infinite;
}
@keyframes wl-spin { to { transform: rotate(360deg); } }

/* Child agent */
.wl-agent {
  --ag-c: var(--ib-muted);
  display: grid; grid-template-columns: 16px minmax(0, 1fr) auto; column-gap: 8px; row-gap: 2px; align-items: center;
  width: 100%; margin: 2px 0; padding: 7px 10px; border: 1px solid var(--ib-card-border); border-radius: 12px;
  background: var(--ib-card); color: var(--ib-text); font: inherit; font-size: 12.5px; line-height: 1.4; text-align: left;
  -webkit-tap-highlight-color: transparent;
  transition: background-color var(--dur-press) ease, border-color var(--dur-press) ease;
}
.wl-agent[data-status="running"] { --ag-c: var(--st-run); border-color: color-mix(in srgb, var(--st-run) 35%, var(--ib-card-border)); }
.wl-agent[data-status="waiting"] { --ag-c: var(--st-wait); }
.wl-agent[data-status="done"] { --ag-c: var(--st-done); }
.wl-agent[data-status="failed"] { --ag-c: var(--st-fail); border-color: color-mix(in srgb, var(--st-fail) 35%, var(--ib-card-border)); }
.wl-agent:active:not(:focus-visible) { background: var(--ib-pill); }
.wl-agent:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 1px; }
.wl-ag-icon { grid-column: 1; grid-row: 1; display: inline-flex; align-items: center; justify-content: center; color: var(--ag-c); }
.wl-ag-icon svg { width: 14px; height: 14px; }
.wl-ag-name { grid-column: 2; grid-row: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.wl-ag-meta {
  grid-column: 3; grid-row: 1; display: inline-flex; align-items: baseline; gap: 8px; color: var(--ib-text-2); font-size: 12px;
  white-space: nowrap; font-variant-numeric: tabular-nums;
}
.wl-ag-st { color: color-mix(in srgb, var(--ag-c) calc(70% * var(--chroma)), var(--ib-text)); font-weight: 600; }
.wl-ag-act { grid-column: 2 / 4; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ib-muted); font-size: 12px; }
.wl-ag-open { grid-column: 2 / 4; display: inline-flex; align-items: center; gap: 4px; color: var(--accent); font-size: 12px; font-weight: 500; }
.wl-ag-open svg { width: 12px; height: 12px; }

@media (hover: hover) and (pointer: fine) {
  .wl-gh:hover { background: var(--ib-pill); }
  .wl-row[role="button"]:hover { background: color-mix(in srgb, var(--ib-pill) 60%, transparent); }
  .wl-agent:hover { border-color: var(--ib-muted); }
}
@media (pointer: coarse), (max-width: 639px) {
  .wl-gh { min-height: 44px; }
  .wl-agent { min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .wl-g-region, .wl-g-chev, .wl-row-chev { transition: none !important; }
  .wl-g-inner { transition: opacity 120ms ease, visibility 0s linear 120ms !important; }
  .wl-group[data-open] .wl-g-inner { transition: opacity 120ms ease, visibility 0s !important; }
  .wl-entry[data-enter] { animation: wl-fade var(--dur-fade) ease both; }
  .wl-spin { animation: none !important; border-top-color: color-mix(in srgb, currentColor 30%, transparent); border-right-color: currentColor; }
}
`;
