/**
 * Ported from the soma-work dashboard: "CRON badge · lane" and "Agent Queue grammar" (.prd/affectui/re-agent-queue.md
 * D2·D5–D7·D9–D11·D16–D19). Capacity was redrawn on 2026-11-11 to the dashboard's calm language: a line per provider
 * on the section's plane, ink meters, colour only for a state (low amber, empty red), words instead of glyphs. Warning
 * text is --st-wait pulled toward --text so it holds 4.5:1 in light (light --st-wait alone is 3.5:1 on white).
 */
export const styles = `
:host {
  --aq-warn: var(--st-wait);
  --aq-warn-text: color-mix(in srgb, var(--st-wait) calc(75% * var(--chroma)), var(--text));
}
.aq { display: grid; gap: 12px; min-width: 0; }

/* ── Shared grammar: pill, countdown, column head ── */
.aq-head { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 10px; min-width: 0; }
.aq-name { font-size: 12px; color: var(--ib-muted); white-space: nowrap; }
.aq-pill { display: inline-flex; align-items: center; gap: 4px; min-height: 22px; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; line-height: 1.3; white-space: nowrap; font-variant-numeric: tabular-nums; color: color-mix(in srgb, var(--aq-pc, var(--ib-text-2)) calc(100% * var(--chroma)), var(--ib-text-2)); background: color-mix(in srgb, var(--aq-pc, var(--ib-muted)) calc(14% * var(--chroma)), transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--aq-pc, var(--ib-muted)) 45%, transparent); }
.aq-pill.is-ok { --aq-pc: var(--st-done); }
.aq-pill.is-run { --aq-pc: var(--st-run); }
.aq-pill.is-paused, .aq-pill.is-low, .aq-pill.is-wait { --aq-pc: var(--aq-warn); color: var(--aq-warn-text); }
.aq-pill.is-empty { --aq-pc: var(--st-fail); color: var(--st-fail-text); }
.aq-pill.is-unknown { --aq-pc: var(--ib-muted); }
/* Mono (0.25.0): the pill's word is the secondary ink; its icon keeps the state colour. */
.aq-pill .aq-si { color: color-mix(in srgb, currentColor calc(100% * var(--chroma)), var(--aq-pc, currentColor)); }
.aq-left, .aq-ago { font-variant-numeric: tabular-nums; }
.aq-col-head { display: flex; align-items: baseline; gap: 6px; font-size: 12px; color: var(--ib-muted); }
.aq-col-head b { color: var(--ib-text); font-weight: 600; font-variant-numeric: tabular-nums; }

/* ── Fold toggle (collapsible): a quiet chevron in each section's head row; its word says what a press does ── */
.aq-fold { position: relative; flex-shrink: 0; align-self: center; display: inline-flex; align-items: center; gap: 4px; min-height: 32px; margin-left: auto; padding: 0 8px; border: 0; border-radius: 8px; background: transparent; color: var(--ib-muted); font: inherit; font-size: 12px; font-weight: 500; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background-color 150ms ease, color 150ms ease; }
.aq-fold svg { width: 14px; height: 14px; transition: transform var(--dur-press) var(--ease-out); }
.aq-fold[aria-expanded="true"] svg { transform: rotate(180deg); }
.aq-fold:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
@media (hover: hover) and (pointer: fine) { .aq-fold:hover { background: var(--ib-pill); color: var(--ib-text); } }

/* ── LLM capacity — one calm table on the section's plane: a line per provider (name · meter · left / total · % ·
   next · note), the same lines folded and unfolded; unfolding opens each provider's detail card under its line.
   Ink only; colour is the state (low amber, empty red), never the window. ── */
.capacity { container: aqcap / inline-size; background: var(--ib-col); border-radius: 14px; padding: 2px 16px 8px; color: var(--ib-text); min-width: 0; transition: background-color 150ms ease; }
.capacity.is-foldable .cap-head, .capacity.is-foldable.is-collapsed { cursor: pointer; }
@media (hover: hover) and (pointer: fine) {
  .capacity.is-foldable.is-collapsed:hover { background: color-mix(in srgb, var(--ib-pill) 45%, var(--ib-col)); }
  .capacity.is-foldable.is-collapsed:hover .aq-fold { color: var(--ib-text); }
}
.cap-head { display: flex; align-items: center; gap: 4px 12px; min-height: 36px; min-width: 0; }
.cap-title { flex: none; margin: 0; font-size: 12px; font-weight: 500; letter-spacing: 0.02em; color: var(--ib-muted); white-space: nowrap; }
.cap-sub { min-width: 0; font-size: 12px; color: var(--ib-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cap-off { margin: 0; padding: 4px 0 6px; font-size: 13px; color: var(--ib-text-2); }
.cap-off.is-error { color: var(--st-fail-text); }
.cap-dim { color: var(--ib-muted); }

/* The table: the columns line up across providers (subgrid), figures on tabular numerals. */
/* Wide: the note column is auto, so free space is shared with the meter (≤ 320px) rather than left to it — a
   state word never collapses to 0px. Below 760px the narrow layout takes over. */
.cap-table { display: grid; grid-template-columns: [name] minmax(52px, max-content) [meter] minmax(64px, 320px) [val] max-content [pct] minmax(3.2em, max-content) [next] max-content [note] auto; column-gap: 20px; min-width: 0; }
.cap-prov { display: grid; grid-column: 1 / -1; grid-template-columns: subgrid; min-width: 0; }
.cap-line { position: relative; display: grid; grid-column: 1 / -1; grid-template-columns: subgrid; align-items: center; min-height: 30px; font-variant-numeric: tabular-nums; }
.cap-l-name { min-width: 0; font-size: 13px; font-weight: 600; color: var(--ib-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cap-l-meter { height: 4px; border-radius: 999px; background: var(--ib-pill); overflow: hidden; }
.cap-l-meter > i { display: block; height: 100%; border-radius: inherit; background: var(--ib-text); transition: width var(--dur-move) var(--ease-out); }
/* The left figure right-aligned in a fixed slot, so the figures and their slashes line up down the column. */
.cap-l-val { font-size: 12px; color: var(--ib-muted); white-space: nowrap; }
.cap-l-val b { display: inline-block; min-width: 4ch; margin-right: 4px; font-size: 14px; font-weight: 600; text-align: right; color: var(--ib-text); }
.cap-l-val i { font-style: normal; }
.cap-l-pct { justify-self: end; font-size: 12px; color: var(--ib-text-2); }
.cap-l-next { min-width: 0; overflow: hidden; text-overflow: ellipsis; font-size: 12px; color: var(--ib-text-2); white-space: nowrap; }
.cap-l-next b { margin-right: 2px; font-weight: 600; color: var(--ib-text); }
.cap-l-note { display: flex; gap: 12px; min-width: 0; overflow: hidden; font-size: 12px; color: var(--ib-muted); white-space: nowrap; }
.cap-n { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.cap-n.is-warn { color: var(--aq-warn-text); font-weight: 500; }
.cap-n.is-fail { color: var(--st-fail-text); font-weight: 600; }
.cap-n.is-state { color: var(--ib-text-2); font-weight: 500; }
.cap-prov.is-low .cap-l-meter > i { background: var(--st-wait); }
.cap-prov.is-low .cap-l-pct { color: var(--aq-warn-text); }
.cap-prov.is-empty :is(.cap-l-val b, .cap-l-pct, .cap-l-next) { color: var(--st-fail-text); }
.cap-prov.is-unknown .cap-l-meter { background: repeating-linear-gradient(90deg, var(--ib-pill) 0 4px, transparent 4px 7px); }
@container aqcap (max-width: 639.98px) {
  .capacity .aq-fold { min-width: 44px; justify-content: center; padding: 0 8px; }
  .capacity .aq-fold-text { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
}
/* Narrow (a phone, a tablet, a docked panel): name · meter · left / total · next on one line — the name and the
   next text give way (ellipsis) before the row can overflow; % goes, and a state or warning note takes a second line
   under the meter — a plain note waits in the detail. */
@container aqcap (max-width: 759.98px) {
  .cap-table { grid-template-columns: [name] minmax(0, max-content) [meter] minmax(24px, 1fr) [val] max-content [next] minmax(0, max-content); column-gap: 12px; }
  .cap-l-pct { display: none; }
  .cap-l-note { grid-column: 2 / -1; margin: -6px 0 6px; }
  .cap-l-note:not(:has(.is-warn, .is-fail, .is-state)), .cap-n:not(.is-warn):not(.is-fail):not(.is-state) { display: none; }
}
@container aqcap (max-width: 559.98px) {
  .cap-sub { display: none; }
}

/* Unfolded: each provider's detail is a card under its own line. */
.cap-detail { grid-column: 1 / -1; min-width: 0; margin: 2px 0 10px; padding: 12px 14px; border-radius: 12px; background: var(--ib-card); box-shadow: inset 0 0 0 1px var(--ib-card-border); }
.cap-detail.is-entering { animation: cap-in var(--dur-expand) var(--ease-out); }
@keyframes cap-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
.cap-disc { margin: 0 0 10px; font-size: 12px; line-height: 1.6; color: var(--ib-muted); }
.cap-disc .cap-stale { color: var(--aq-warn-text); font-weight: 500; }
.cap-sep { font-style: normal; }
/* A provider with a 5-hour window: one thin row per measure. */
.cap-bar-row { display: grid; grid-template-columns: 76px minmax(0, 1fr) max-content; align-items: center; gap: 2px 14px; margin: 0 0 10px; font-variant-numeric: tabular-nums; }
.cap-bar-lbl { font-size: 12px; font-weight: 600; line-height: 1.3; color: var(--ib-text); }
.cap-bar-lbl i { display: block; font-style: normal; font-weight: 400; font-size: 11px; color: var(--ib-muted); }
.cap-bar { position: relative; height: 4px; border-radius: 999px; background: var(--ib-pill); overflow: hidden; }
.cap-bar > span { display: block; height: 100%; border-radius: inherit; background: var(--ib-text); transition: width var(--dur-move) var(--ease-out); }
.cap-bar-val { font-size: 12px; color: var(--ib-muted); white-space: nowrap; }
.cap-bar-val b { font-size: 13px; font-weight: 600; color: var(--ib-text); }
.cap-bar-val em { margin-left: 6px; font-style: normal; color: var(--ib-text-2); }
.cap-bar-next { grid-column: 2 / -1; font-size: 12px; color: var(--ib-text-2); }
.cap-prov.is-empty .cap-bar-row.is-h5 .cap-bar-next { color: var(--st-fail-text); font-weight: 600; }
/* The 7-day forecast: an ink step line over a faint area, the week's days under it, a dashed line at the pool's size. */
.cap-fc { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--ib-card-border); }
.cap-fc-h { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 2px 12px; margin-bottom: 4px; font-size: 12px; }
.cap-fc-t { font-weight: 500; color: var(--ib-text); }
.cap-fc-s { color: var(--ib-muted); font-variant-numeric: tabular-nums; }
.cap-fc-svg { display: block; max-width: 100%; height: auto; overflow: visible; }
.cap-fc-svg text { font-family: inherit; font-variant-numeric: tabular-nums; }
.cap-fc-grid { stroke: var(--ib-card-border); }
.cap-fc-base { stroke: var(--ib-card-border); }
.cap-fc-max { stroke: var(--ib-muted); stroke-opacity: 0.5; stroke-dasharray: 2 4; }
.cap-fc-area { fill: color-mix(in srgb, var(--ib-text) 7%, transparent); }
.cap-fc-line { fill: none; stroke: var(--ib-text); stroke-width: 1.5; stroke-linejoin: round; }
.cap-fc-dot { fill: var(--ib-text); stroke: var(--ib-card); stroke-width: 2; }
.cap-fc-gain { fill: var(--ib-text); font-size: 11px; font-weight: 600; }
.cap-fc-ax { fill: var(--ib-muted); font-size: 11px; }
.cap-fc-lim { fill: var(--st-fail); fill-opacity: 0.08; }
.cap-fc-hatch { stroke: var(--st-fail); stroke-opacity: 0.35; stroke-width: 1; }

/* ── Accounts as workers: names as quiet text buttons; a blocked run shows its reason once, as an icon ── */
.aq-workers { position: relative; }
/* One wrapping row: the head, usable names one by one, every other state one run behind its icon. Mark geometry
   (padding, icon, the 2px between a run's names) is what logic.ts STRIP assumes when it folds runs to two lines. */
.aq-marks { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; }
.aq-marks > .aq-col-head { white-space: nowrap; margin-right: 4px; }
.aq-mark { display: inline-flex; align-items: center; gap: 5px; min-height: 26px; max-width: 100%; padding: 0 7px; border: 0; border-radius: 6px; background: transparent; color: var(--ib-text); font: inherit; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background-color 150ms ease, color 150ms ease; }
.aq-mark b { font-weight: 500; font-variant-numeric: tabular-nums; }
.aq-si { flex: none; width: 12px; height: 12px; }
/* No position here: the account card measures marks against .aq-workers (see updated()). */
.aq-stack { --aq-sc: var(--ib-muted); --aq-st: var(--ib-text-2); display: inline-flex; align-items: center; gap: 2px; max-width: 100%; }
.aq-stack.is-warn { --aq-sc: var(--aq-warn); }
.aq-stack.is-fail { --aq-sc: var(--st-fail); --aq-st: var(--st-fail-text); }
.aq-stack.is-out { --aq-st: var(--ib-muted); }
.aq-stack .aq-mark { color: var(--aq-st); }
/* A run's icon keeps its state colour (mono: ink) — the one place the strip uses colour. */
.aq-stack .aq-mark .aq-si { color: color-mix(in srgb, var(--aq-sc) calc(100% * var(--chroma)), var(--ib-muted)); }
.aq-mark[aria-expanded="true"] { background: var(--ib-pill); color: var(--ib-text); }
.aq-mark:focus-visible, .aq-q:focus-visible, .aq-pop-close:focus-visible, .cron-history-btn:focus-visible, .cron-strip:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
.aq-mark:focus-visible { position: relative; z-index: 1; }
@media (hover: hover) and (pointer: fine) { .aq-mark:hover { background: var(--ib-pill); } .aq-q:hover { border-color: var(--ib-muted); } }
.aq-wdot { flex: none; width: 7px; height: 7px; border-radius: 50%; }
.aq-wdot.is-ok { background: var(--st-done); }
.aq-pop { position: absolute; z-index: 6; top: 100%; left: 8px; width: min(280px, calc(100% - 16px)); display: grid; gap: 10px; padding: 12px; border-radius: 12px; background: var(--ib-card); color: var(--ib-text); box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow-raised); animation: aq-open var(--dur-fade) var(--ease-out); }
.cap-detail.is-narrow .aq-pop { width: calc(100% - 16px); }
@keyframes aq-open { from { opacity: 0; transform: translateY(-4px) scale(0.97); } to { opacity: 1; transform: none; } }
.aq-pop-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.aq-pop-name { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aq-pop-kind { flex: 1 1 auto; min-width: 0; font-size: 12px; color: var(--ib-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aq-pop-close { flex: none; width: 28px; height: 28px; border-radius: 8px; border: 0; background: none; color: var(--ib-text-2); font: inherit; font-size: 16px; line-height: 1; cursor: pointer; transition: background-color 150ms ease; }
@media (hover: hover) and (pointer: fine) { .aq-pop-close:hover { background: var(--ib-pill); } }
.aq-pop-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 12px; margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--ib-col); }
.aq-pop-stats dt { font-size: 11px; color: var(--ib-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aq-pop-stats dd { margin: 0; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; }
.aq-pop-stats .is-wide { grid-column: 1 / -1; }

/* ── CRON lane = the queue ── */
.aq-lane { container: aqlane / inline-size; background: var(--ib-col); border-radius: 14px; padding: 2px 4px 10px; color: var(--ib-text); min-width: 0; }
.aq-lane.is-collapsed { padding-bottom: 4px; }
.aq-lane.is-collapsed .aq-lane-body { display: block; padding-bottom: 6px; }
.aq-lane-head { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; padding: 10px 8px 8px 10px; min-height: 40px; }
.aq-lane-ic { display: inline-flex; color: var(--ib-muted); }
.aq-lane-ic svg { width: 14px; height: 14px; }
.aq-lane-title { margin: 0; font-size: 12px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ib-muted); }
.aq-count { background: var(--ib-pill); color: var(--ib-text-2); border-radius: 6px; padding: 1px 7px; font-size: 12px; font-weight: 500; min-width: 22px; text-align: center; font-variant-numeric: tabular-nums; }
.aq-lane-top { padding: 0 4px 10px; }
.aq-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; padding: 12px 0; border-radius: 12px; background: var(--ib-card); box-shadow: inset 0 0 0 1px var(--ib-card-border); }
.aq-stat { display: grid; gap: 2px; min-width: 0; padding: 0 16px; }
.aq-stat + .aq-stat { border-left: 1px solid var(--ib-card-border); }
.aq-stat dt { font-size: 12px; color: var(--ib-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.aq-stat dd { margin: 0; font-size: 16px; font-weight: 600; color: var(--ib-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.aq-stat[data-kind="failed"] dd { color: var(--st-fail-text); }
.aq-of { margin-left: 4px; font-size: 13px; font-weight: 500; color: var(--ib-muted); }
.aq-of.is-n { margin-left: 1px; }
.aq-lane-body { display: grid; grid-template-columns: clamp(188px, 26%, 236px) minmax(0, 1fr); gap: 10px; align-items: start; padding: 0 4px; }
.aq-queue { display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 10px; border-radius: 12px; border: 1px solid var(--ib-card-border); background: color-mix(in srgb, var(--ib-card) 45%, transparent); }
.aq-q { display: flex; align-items: center; gap: 6px; min-height: 28px; padding: 0 8px; border-radius: 8px; border: 1px solid var(--ib-card-border); background: var(--ib-card); color: var(--ib-text); font: inherit; font-size: 12.5px; text-align: left; cursor: pointer; }
.aq-q.is-new { animation: aq-in var(--dur-fade) var(--ease-out); }
.aq-q svg { flex: none; width: 12px; height: 12px; color: var(--ib-muted); }
.aq-q-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aq-q .aq-left { flex: none; font-size: 11.5px; color: var(--ib-muted); }
.aq-more { align-self: flex-start; padding: 1px 8px; border-radius: 6px; background: var(--ib-pill); color: var(--ib-text-2); font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums; }
.aq-empty { padding: 4px 2px; font-size: 12px; color: var(--ib-muted); }
@keyframes aq-in { from { opacity: 0; } to { opacity: 1; } }

/* Job cards (CRON tiles) */
.cron-groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 10px; align-items: start; min-width: 0; }
.cron-group { position: relative; display: flex; flex-direction: column; gap: 8px; min-width: 0; padding: 10px; border-radius: 12px; border: 1px dashed var(--ib-card-border); background: color-mix(in srgb, var(--ib-card) 45%, transparent); transition: border-color 150ms ease; }
.cron-group.is-running { border-style: solid; border-color: color-mix(in srgb, var(--st-run) 55%, transparent); }
.cron-group.is-waiting { border-style: solid; border-color: var(--st-wait); }
.cron-tile { display: flex; flex-direction: column; gap: 6px; min-width: 0; --st-color: var(--ib-text-2); }
.cron-group.is-running .cron-tile { --st-color: var(--st-run); }
.cron-group.is-waiting .cron-tile { --st-color: var(--aq-warn-text); }
.cron-tile-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.cron-badge { flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; padding: 1px 7px 1px 5px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; line-height: 1.5; color: color-mix(in srgb, var(--st-color, var(--ib-text-2)) calc(100% * var(--chroma)), var(--ib-text-2)); background: color-mix(in srgb, var(--st-color, var(--ib-muted)) calc(14% * var(--chroma)), transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--st-color, var(--ib-muted)) 45%, transparent); }
.cron-badge svg { width: 12px; height: 12px; color: var(--st-color, var(--ib-text-2)); }
.cron-group.is-waiting .cron-badge svg { color: color-mix(in srgb, var(--st-color) calc(100% * var(--chroma)), var(--st-wait)); }
.cron-name { flex: 1 1 auto; min-width: 0; font-size: 14px; font-weight: 600; color: var(--ib-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cron-note { flex-shrink: 0; padding: 0 6px; border-radius: 999px; border: 1px solid var(--ib-card-border); font-size: 11px; color: var(--ib-muted); white-space: nowrap; }
/* The host's live card for the job (slot="job:<id>") sits under its tile. */
.cron-group ::slotted(*) { min-width: 0; }
.cron-history-btn { flex-shrink: 0; margin-left: auto; min-height: 28px; padding: 2px 10px; border-radius: 8px; border: 1px solid var(--ib-card-border); background: var(--ib-card); color: var(--ib-text-2); font: inherit; font-size: 12px; cursor: pointer; transition: transform var(--dur-press) var(--ease-out), border-color 150ms ease; }
.cron-history-btn:active:not(:focus-visible) { transform: scale(0.97); }
@media (hover: hover) and (pointer: fine) { .cron-history-btn:hover { border-color: var(--ib-muted); color: var(--ib-text); } }
.cron-sched { display: flex; flex-wrap: wrap; gap: 2px 10px; font-size: 12px; color: var(--ib-text-2); font-variant-numeric: tabular-nums; }
.cron-expr { color: var(--ib-text); }
.cron-strip { display: flex; align-items: flex-end; gap: 3px; height: 22px; padding: 2px 0; border: 0; border-radius: 4px; background: none; cursor: pointer; width: max-content; max-width: 100%; }
.cron-strip.is-empty { cursor: default; font-size: 12px; color: var(--ib-muted); height: auto; }
.cr-tick { display: block; flex: none; width: 8px; height: 16px; border-radius: 2px; background: var(--st-done); }
.cr-tick.is-fail { background: var(--st-fail); height: 18px; }
.cr-tick.is-none { background: transparent; box-shadow: inset 0 0 0 1.5px var(--ib-muted); }
.cr-tick.is-run { background: var(--st-run); }
.cr-tick.is-wait { background: var(--st-wait); }
@keyframes cr-pulse { 50% { opacity: 0.45; } }
@media (prefers-reduced-motion: no-preference) { .cr-tick.is-run { animation: cr-pulse 1.6s ease-in-out infinite; } }
.cron-status { font-size: 12px; color: var(--ib-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cron-status.is-run { color: color-mix(in srgb, var(--st-run) calc(100% * var(--chroma)), var(--ib-text-2)); font-weight: 600; }
.cron-status.is-wait { color: var(--aq-warn-text); font-weight: 600; }
.cron-status.is-fail { color: var(--st-fail-text); }

/* 24 hours of runs */
.aq-chart { margin: 10px 4px 0; padding: 12px 14px 10px; border-radius: 12px; background: var(--ib-card); box-shadow: inset 0 0 0 1px var(--ib-card-border); }
.aq-chart-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 8px; margin-bottom: 10px; font-size: 12px; }
.aq-chart-title { font-weight: 500; color: var(--ib-text); }
.aq-chart-title + .aq-ch-key { margin-left: auto; }
.aq-ch-key { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--ib-text-2); }
.aq-ch-key i { width: 8px; height: 8px; border-radius: 2px; }
.aq-ch-key i.is-ok { background: var(--st-done); }
.aq-ch-key i.is-run { background: var(--st-run); }
.aq-ch-key i.is-fail { background: var(--st-fail); }
.aq-plot { position: relative; height: 112px; margin-left: 26px; display: flex; align-items: stretch; gap: 2px; border-bottom: 1px solid var(--ib-card-border); }
.aq-ch-grid { position: absolute; left: -26px; right: 0; top: 0; height: 0; border-top: 1px dashed var(--ib-pill); pointer-events: none; }
.aq-ch-grid.is-zero { top: 100%; border-top: 0; }
.aq-ch-grid span { position: absolute; left: 0; top: -7px; width: 20px; text-align: right; font-size: 11px; line-height: 14px; color: var(--ib-muted); font-variant-numeric: tabular-nums; }
.aq-ch-cut { position: absolute; top: 0; bottom: 0; background: repeating-linear-gradient(-45deg, transparent 0 5px, color-mix(in srgb, var(--ib-muted) 22%, transparent) 5px 6px); }
.aq-ch-col { position: relative; z-index: 1; flex: 1 1 0; min-width: 0; display: flex; flex-direction: column-reverse; }
.aq-ch-ok, .aq-ch-run, .aq-ch-fail { display: block; transition: height var(--dur-expand) var(--ease-out); }
.aq-ch-ok { background: var(--st-done); }
.aq-ch-run { background: var(--st-run); }
.aq-ch-fail { background: var(--st-fail); border-radius: 2px 2px 0 0; }
.aq-ch-axis { display: flex; justify-content: space-between; margin: 6px 0 0 26px; font-size: 11px; color: var(--ib-muted); }

@container aqlane (max-width: 599.98px) {
  .aq-lane-body { grid-template-columns: minmax(0, 1fr); }
  .aq-plot { height: 88px; }
}
@container aqlane (max-width: 639.98px) {
  .aq-lane .aq-fold { padding: 2px 8px; min-width: 44px; justify-content: center; }
  .aq-lane .aq-fold-text { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
}
@container aqlane (max-width: 560px) {
  .aq-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 12px; }
  .aq-stat { padding: 0 12px; }
  .aq-stat:nth-child(odd) { border-left: 0; }
  .aq-stat dd { font-size: 15px; }
}
@media (pointer: coarse) {
  .aq-mark, .aq-q, .cron-history-btn, .cron-strip, .aq-fold { min-height: 44px; }
  .aq-pop-close { width: 44px; height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .aq-mark, .aq-q, .aq-pop, .cap-bar > span, .cap-l-meter > i, .cap-detail, .capacity, .aq-ch-ok, .aq-ch-run, .aq-ch-fail, .cr-tick, .aq-fold, .aq-fold svg { animation: none; transition: none; }
}
`;
