/**
 * Ported from the soma-work dashboard: "CRON badge · lane", "LLM capacity v2" and "Agent Queue grammar"
 * (.prd/affectui/re-agent-queue.md D2·D5–D7·D9–D11·D16–D19). The dashboard's dark-first hexes with a light override
 * are folded into tokens: the 5-hour teal is mixed from --green and --accent, the weekly violet is --purple, and
 * warning text is --st-wait pulled toward --text so it holds 4.5:1 in light (light --st-wait alone is 3.5:1 on white).
 * Override with --ui-aq-now / --ui-aq-wk on the page.
 */
export const styles = `
:host {
  --aq-now: var(--ui-aq-now, color-mix(in oklch, var(--green) 55%, var(--accent)));
  --aq-wk: var(--ui-aq-wk, var(--purple));
  --aq-warn: var(--st-wait);
  --aq-warn-text: color-mix(in srgb, var(--st-wait) 75%, var(--text));
  /* Chip numbers are text: the window colours pulled toward --text so they hold 4.5:1 on the card. */
  --aq-now-text: color-mix(in srgb, var(--aq-now) 70%, var(--text));
  --aq-wk-text: color-mix(in srgb, var(--aq-wk) 80%, var(--text));
}
.aq { display: grid; gap: 12px; min-width: 0; }

/* ── Shared grammar: pill, countdown, column head ── */
.aq-head { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 10px; min-width: 0; }
.aq-name { font-size: 12px; color: var(--ib-muted); white-space: nowrap; }
.aq-pill { display: inline-flex; align-items: center; gap: 4px; min-height: 22px; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; line-height: 1.3; white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--aq-pc, var(--ib-text-2)); background: color-mix(in srgb, var(--aq-pc, var(--ib-muted)) 14%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--aq-pc, var(--ib-muted)) 45%, transparent); }
.aq-pill.is-ok { --aq-pc: var(--st-done); }
.aq-pill.is-run { --aq-pc: var(--st-run); }
.aq-pill.is-paused, .aq-pill.is-low, .aq-pill.is-wait { --aq-pc: var(--aq-warn); color: var(--aq-warn-text); }
.aq-pill.is-empty { --aq-pc: var(--st-fail); color: var(--st-fail-text); }
.aq-pill.is-unknown { --aq-pc: var(--ib-muted); }
.aq-left, .aq-ago { font-variant-numeric: tabular-nums; }
.aq-col-head { display: flex; align-items: baseline; gap: 6px; font-size: 12px; color: var(--ib-muted); }
.aq-col-head b { color: var(--ib-text); font-weight: 600; font-variant-numeric: tabular-nums; }

/* ── Fold toggle (collapsible): in each section's head row; its word says what a press does ── */
.aq-fold { position: relative; flex-shrink: 0; align-self: center; display: inline-flex; align-items: center; gap: 4px; min-height: 32px; margin-left: auto; padding: 2px 10px; border-radius: 8px; border: 1px solid var(--ib-card-border); background: var(--ib-card); color: var(--ib-text-2); font: inherit; font-size: 12px; cursor: pointer; transition: border-color 150ms ease, color 150ms ease; }
.aq-fold svg { width: 12px; height: 12px; transition: transform var(--dur-press) var(--ease-out); }
.aq-fold[aria-expanded="true"] svg { transform: rotate(180deg); }
.aq-fold:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
@media (hover: hover) and (pointer: fine) { .aq-fold:hover { border-color: var(--ib-muted); color: var(--ib-text); } }

/* ── LLM capacity: colour is the window (teal = now · 5h, violet = this week · 7d) ── */
.capacity { container: aqcap / inline-size; background: var(--ib-col); border-radius: 14px; padding: 12px 14px 10px; color: var(--ib-text); min-width: 0; }
.cap-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 12px; margin-bottom: 4px; }
.cap-title { flex: none; margin: 0; font-size: 12px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ib-muted); white-space: nowrap; }
/* Collapsed: the title row keeps one chip per provider (both measures, limited · first return, ⚠ flags). */
.capacity.is-collapsed .cap-head { flex-wrap: nowrap; align-items: center; margin-bottom: 0; min-height: 32px; }
.cap-summary { display: flex; gap: 6px; min-width: 0; margin: 0; padding: 0; list-style: none; overflow-x: auto; scrollbar-width: none; }
.cap-chip { flex: none; display: inline-flex; padding: 2px 9px; border-radius: 999px; font-size: 12px; line-height: 1.5; white-space: nowrap; color: var(--ib-text-2); background: var(--ib-card); box-shadow: inset 0 0 0 1px var(--ib-card-border); }
.cap-chip-v { display: inline-flex; align-items: baseline; gap: 4px; min-width: 0; }
.cap-chip i { font-style: normal; }
.cap-chip b { font-weight: 700; color: var(--ib-text); font-variant-numeric: tabular-nums; }
.cap-chip em { font-style: normal; font-weight: 600; font-variant-numeric: tabular-nums; }
.cap-chip .cap-m.is-now b, .cap-chip .cap-m.is-now em { color: var(--aq-now-text); }
.cap-chip .cap-m.is-wk b, .cap-chip .cap-m.is-wk em { color: var(--aq-wk-text); }
.cap-chip .cap-chip-lim, .cap-chip .cap-chip-flag { color: var(--aq-warn-text); font-weight: 600; white-space: nowrap; }
.cap-chip.is-low { color: var(--aq-warn-text); box-shadow: inset 0 0 0 1px var(--st-wait); }
.cap-chip.is-empty, .cap-chip.is-error { color: var(--st-fail-text); box-shadow: inset 0 0 0 1px var(--st-fail); }
@container aqcap (max-width: 839.98px) {
  /* Every chip keeps labelled counts, totals and % for both windows: the row wraps, a chip breaks between measures. */
  .cap-chip { flex: 0 1 auto; min-width: 0; white-space: normal; }
  .cap-chip-v { flex-wrap: wrap; column-gap: 4px; }
  .cap-chip .cap-m, .cap-chip .cap-chip-flag { white-space: nowrap; }
  .capacity.is-collapsed .cap-summary { flex: 1 1 auto; flex-wrap: wrap; overflow-x: visible; gap: 4px; }
}
@container aqcap (max-width: 639.98px) {
  .cap-chip { padding: 2px 6px; font-size: 11px; }
  .capacity .aq-fold { padding: 2px 8px; min-width: 44px; justify-content: center; }
  .capacity .aq-fold-text { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
}
.cap-sub { font-size: 12px; color: var(--ib-text-2); }
.cap-off { font-size: 13px; color: var(--ib-text-2); padding: 8px 0 10px; }
.cap-prov { container: aqprov / inline-size; position: relative; background: var(--ib-card); border-radius: 12px; padding: 14px 18px 12px; margin-top: 10px; box-shadow: inset 0 0 0 1px var(--ib-card-border); min-width: 0; }
.cap-prov.is-empty { box-shadow: inset 0 0 0 1px var(--st-fail); }
.cap-prov.is-low { box-shadow: inset 0 0 0 1px var(--st-wait); }
.cap-pname { margin: 0; font-size: 16px; font-weight: 700; color: var(--ib-text); }
.cap-disc { font-size: 12px; color: var(--ib-muted); margin: 2px 0 8px; }
.cap-disc .cap-stale { color: var(--aq-warn-text); font-weight: 600; }
/* One bar per window — label | bar | "x / total accounts %" — and a "next …" line. */
.cap-bar-row { display: grid; grid-template-columns: 92px minmax(0, 1fr) 200px; align-items: center; gap: 4px 12px; margin: 8px 0; }
.cap-bar-lbl { font-size: 14px; font-weight: 700; line-height: 1.2; }
.cap-bar-lbl i { display: block; font-style: normal; font-weight: 400; font-size: 11px; color: var(--ib-muted); }
.cap-bar-row.is-h5 .cap-bar-lbl { color: var(--aq-now); }
.cap-bar-row.is-wk .cap-bar-lbl { color: var(--aq-wk); }
.cap-bar { position: relative; height: 26px; border-radius: 7px; background: var(--ib-pill); overflow: hidden; }
.cap-bar > span { display: block; height: 100%; border-radius: 7px; transition: width var(--dur-move) var(--ease-out); }
.cap-bar-row.is-h5 .cap-bar > span { background: var(--aq-now); }
.cap-bar-row.is-wk .cap-bar > span { background: var(--aq-wk); }
/* The dashed line is where the pool turns low (the reference's backpressure line). */
.cap-low { position: absolute; top: 0; bottom: 0; width: 0; border-left: 1px dashed var(--ib-text-2); opacity: 0.7; }
.cap-bar-val { font-size: 14px; color: var(--ib-text-2); white-space: nowrap; font-variant-numeric: tabular-nums; }
.cap-bar-val b { font-size: 19px; color: var(--ib-text); }
.cap-bar-val em { font-style: normal; font-weight: 600; margin-left: 4px; }
.cap-bar-next { grid-column: 2 / 4; font-size: 12px; color: var(--ib-text-2); }
.cap-prov.is-empty .cap-bar-row.is-h5 .cap-bar-next { color: var(--st-fail-text); font-weight: 600; }
.cap-tl-wrap { margin-top: 10px; border-top: 1px solid var(--ib-card-border); padding-top: 8px; }
.cap-tl-h { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--ib-text-2); }
.cap-tl-h i { font-style: normal; }
.cap-tl-h .is-h5 { color: var(--aq-now); }
.cap-tl-h .is-wk { color: var(--aq-wk); }
.cap-tl { display: block; max-width: 100%; height: auto; overflow: visible; }
.cap-tl text { font-family: inherit; }
.cap-tl-axis { stroke: var(--ib-muted); stroke-opacity: 0.5; stroke-width: 2; }
.cap-tl-tick { stroke: var(--ib-card-border); }
.cap-tl-ax { fill: var(--ib-muted); font-size: 11px; }
.cap-tl-mk.is-h5 { fill: var(--aq-now); stroke: var(--aq-now); }
.cap-tl-mk.is-wk { fill: var(--aq-wk); stroke: var(--aq-wk); }
.cap-tl-mk circle, .cap-tl-mk rect { stroke: var(--ib-card); stroke-width: 1.5; }
.cap-tl-span { stroke-width: 5; stroke-linecap: round; }
.cap-tl-mk text { stroke: none; font-size: 12.5px; font-weight: 700; }
.cap-tl-lim { fill: var(--st-fail); fill-opacity: 0.12; }
.cap-tl-hatch { stroke: var(--st-fail); stroke-opacity: 0.4; stroke-width: 1.5; }
/* Narrow card: label and value share the first line, the bar takes the full width, the next line under it. */
@container aqprov (max-width: 599.98px) {
  .cap-bar-row { grid-template-columns: minmax(0, 1fr) auto; gap: 4px 8px; margin: 10px 0; }
  .cap-bar-lbl { grid-row: 1; grid-column: 1; align-self: baseline; }
  .cap-bar-lbl i { display: inline; margin-left: 6px; }
  .cap-bar-val { grid-row: 1; grid-column: 2; align-self: baseline; }
  .cap-bar { grid-row: 2; grid-column: 1 / -1; height: 20px; }
  .cap-bar-next { grid-row: 3; grid-column: 1 / -1; }
  .cap-bar-val b { font-size: 16px; }
  .cap-tl-h-note { display: none; }
}

/* ── Accounts as workers: state marks + the pinned account card ── */
.aq-workers { position: relative; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--ib-card-border); }
/* One wrapping row: the head, usable badges one by one, every other state one overlapped stack. Badge geometry
   (padding, dot, icon, overlap) is what logic.ts STRIP assumes when it folds runs to keep the row to two lines. */
.aq-marks { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.aq-marks > .aq-col-head { white-space: nowrap; }
.aq-mark { display: inline-flex; align-items: center; gap: 5px; min-height: 26px; max-width: 100%; padding: 0 10px; border-radius: 999px; border: 1px solid var(--ib-card-border); background: var(--ib-card); color: var(--ib-text); font: inherit; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; transition: background-color var(--dur-fade) var(--ease-out), color var(--dur-fade) var(--ease-out), border-color var(--dur-fade) var(--ease-out); }
.aq-mark b { font-weight: 600; font-variant-numeric: tabular-nums; }
.aq-si { flex: none; width: 12px; height: 12px; }
.aq-stack { --aq-sc: var(--ib-muted); --aq-st: var(--ib-text-2); display: inline-flex; align-items: center; max-width: 100%; }
.aq-stack.is-warn { --aq-sc: var(--aq-warn); --aq-st: var(--aq-warn-text); }
.aq-stack.is-fail { --aq-sc: var(--st-fail); --aq-st: var(--st-fail-text); }
.aq-stack.is-out { --aq-st: var(--ib-muted); }
/* Opaque fills and a card-coloured ring: each badge reads cut over the one before it. */
.aq-stack .aq-mark { color: var(--aq-st); background: color-mix(in srgb, var(--aq-sc) 16%, var(--ib-card)); border-color: color-mix(in srgb, var(--aq-sc) 55%, var(--ib-card)); box-shadow: 0 0 0 2px var(--ib-card); }
.aq-stack .aq-mark + .aq-mark { margin-left: -8px; }
.aq-stack.is-out .aq-mark { background: var(--ib-card); border-style: dashed; }
.aq-mark[aria-expanded="true"], .aq-stack .aq-mark[aria-expanded="true"] { border-color: var(--ib-text-2); }
.aq-mark:focus-visible, .aq-q:focus-visible, .aq-pop-close:focus-visible, .cron-history-btn:focus-visible, .cron-strip:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
.aq-mark:focus-visible { position: relative; z-index: 1; }
@media (hover: hover) and (pointer: fine) { .aq-mark:hover, .aq-stack .aq-mark:hover, .aq-q:hover { border-color: var(--ib-muted); } }
.aq-wdot { flex: none; width: 7px; height: 7px; border-radius: 50%; }
.aq-wdot.is-h5 { background: var(--aq-now); }
.aq-wdot.is-wk { background: var(--aq-wk); }
.aq-pop { position: absolute; z-index: 6; top: 100%; left: 8px; width: min(280px, calc(100% - 16px)); display: grid; gap: 10px; padding: 12px; border-radius: 12px; background: var(--ib-card); color: var(--ib-text); box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow-raised); animation: aq-open var(--dur-fade) var(--ease-out); }
.cap-prov.is-narrow .aq-pop { width: calc(100% - 24px); }
@keyframes aq-open { from { opacity: 0; transform: translateY(-4px) scale(0.97); } to { opacity: 1; transform: none; } }
.aq-pop-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.aq-pop-name { font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aq-pop-kind { flex: 1 1 auto; min-width: 0; font-size: 12px; color: var(--ib-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aq-pop-close { flex: none; width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--ib-card-border); background: none; color: var(--ib-text-2); font: inherit; font-size: 16px; line-height: 1; cursor: pointer; }
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
.cron-badge { flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; padding: 1px 7px 1px 5px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; line-height: 1.5; color: var(--st-color, var(--ib-text-2)); background: color-mix(in srgb, var(--st-color, var(--ib-muted)) 14%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--st-color, var(--ib-muted)) 45%, transparent); }
.cron-badge svg { width: 12px; height: 12px; }
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
.cron-status.is-run { color: var(--st-run); font-weight: 600; }
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
  .aq-mark, .aq-q, .aq-pop, .cap-bar > span, .aq-ch-ok, .aq-ch-run, .aq-ch-fail, .cr-tick, .aq-fold, .aq-fold svg { animation: none; transition: none; }
}
`;
