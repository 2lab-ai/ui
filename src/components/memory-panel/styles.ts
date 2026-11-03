/** Ported from the soma-work dashboard settings › 기억 › 개인 메모리 (.prd/affectui/re-memory-panel.md D1–D17, `.mm-*`). */
export const styles = `
:host { --mm-fold: 320ms; --mm-warn: var(--yellow); --mm-danger-bg: color-mix(in srgb, var(--red) 11%, transparent);
  --mm-mark: color-mix(in srgb, var(--st-wait) calc(32% * var(--chroma)), transparent); --mm-well: var(--surface-raised); }
.mm { container: mm / inline-size; position: relative; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text-secondary); font-size: 13px; }
.mm h3, .mm p { margin: 0; }
.mm ol { margin: 0; padding: 0; }
.mm :is(button, input, textarea):focus-visible { outline: 2px solid var(--border-focus); outline-offset: 1px; }
.mm-head { display: flex; align-items: center; gap: 8px; padding: 14px 16px 2px; }
.mm-title { font-size: 13.5px; font-weight: 600; color: var(--text); }
.mm-count { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 5px; background: var(--mm-well); font-size: 12px; font-weight: 500; line-height: 20px; text-align: center; color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
.mm-count:empty { display: none; }

/* filters: store chips (radiogroup) · search covering the chips */
.mm-filters { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 4px; padding: 10px 10px 10px 14px; border-bottom: 1px solid var(--border); }
.mm-chips, .mm-search { grid-area: 1 / 1; transition: opacity 220ms ease, filter 220ms ease; }
.mm-chips { display: flex; gap: 4px; min-width: 0; margin: -3px -4px; padding: 3px 4px; overflow-x: auto; scrollbar-width: none; -webkit-mask-image: linear-gradient(90deg, black calc(100% - 14px), transparent); mask-image: linear-gradient(90deg, black calc(100% - 14px), transparent); }
.mm-chips::-webkit-scrollbar { display: none; }
.mm-chip { display: inline-flex; flex: none; align-items: center; gap: 5px; height: 28px; padding: 0 9px; font-size: 12.5px; color: var(--text-secondary); background: none; border: 0; border-radius: 8px; white-space: nowrap; transition: background-color var(--dur-press) ease, color var(--dur-press) ease, box-shadow var(--dur-press) ease; }
.mm-chip[aria-checked="true"] { background: var(--mm-well); color: var(--text); font-weight: 600; box-shadow: inset 0 0 0 1px var(--border); }
.mm-chip-n { font-size: 11.5px; font-weight: 400; color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
.mm-search { display: flex; align-items: center; gap: 6px; min-width: 0; height: 30px; padding: 0 2px 0 9px; border-radius: 8px; background: var(--mm-well); color: var(--text-tertiary); opacity: 0; visibility: hidden; }
.mm-search svg { flex: none; }
.mm-search input { flex: 1; min-width: 0; height: 28px; padding: 0; font-size: 13px; color: var(--text); background: none; border: 0; outline: none; -webkit-appearance: none; appearance: none; }
.mm-search input::placeholder { color: var(--text-tertiary); }
.mm-search input::-webkit-search-cancel-button { display: none; }
.mm .mm-search input:focus-visible { outline: none; }
.mm-search:focus-within { box-shadow: inset 0 0 0 1px var(--border-focus); }
.mm-filters[data-searching] .mm-chips { opacity: 0; filter: blur(2px); }
.mm-filters[data-searching] .mm-search { grid-area: 1 / 1 / 2 / 3; opacity: 1; visibility: visible; }
.mm-filters[data-searching] .mm-search-open { opacity: 0; visibility: hidden; }
.mm-icon { display: grid; flex: none; place-items: center; width: 28px; height: 28px; padding: 0; font-size: 16px; line-height: 1; color: var(--text-tertiary); background: none; border: 0; border-radius: 8px; transition: background-color var(--dur-press) ease, color var(--dur-press) ease, opacity 200ms ease; }
.mm-search-open { grid-area: 1 / 2; }
.mm-note { padding: 9px 16px; border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--text) 3%, transparent); font-size: 12.5px; color: var(--text-secondary); }

/* groups — one per store; folds are grid rows 0fr ↔ 1fr */
.mm-list { padding: 2px 8px 6px; }
.mm-fold { display: grid; grid-template-rows: 0fr; opacity: 0; transition: grid-template-rows var(--mm-fold) var(--ease-out), opacity var(--dur-fade) ease; }
.mm-fold[data-open] { grid-template-rows: 1fr; opacity: 1; transition: grid-template-rows var(--mm-fold) var(--ease-out), opacity 240ms ease 60ms; }
.mm-fold[data-leaving] { transition: grid-template-rows var(--mm-fold) var(--ease-out), opacity 200ms ease, filter 200ms ease; filter: blur(2px); }
.mm-clip { min-height: 0; overflow: hidden; }
.mm-ghead { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 16px; padding: 12px 8px 4px; }
.mm-ghead h3 { min-width: 0; font-size: 13px; font-weight: 600; color: var(--text); overflow-wrap: anywhere; }
.mm-file { margin-left: 4px; font-size: 12px; font-weight: 400; color: var(--text-tertiary); }
.mm-usage { display: flex; flex: 0 1 280px; align-items: center; gap: 8px; min-width: 0; font-size: 12px; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.mm-bar { position: relative; flex: 1; min-width: 48px; height: 6px; border-radius: 3px; background: var(--ib-pill); overflow: hidden; }
.mm-bar > i { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: var(--st-done); }
.mm-usage[data-level="warn"] .mm-bar > i { background: var(--st-wait); }
.mm-usage[data-level="high"] .mm-bar > i, .mm-usage[data-level="full"] .mm-bar > i { background: var(--st-fail); }
.mm-usage[data-level="warn"], .mm-usage[data-level="high"], .mm-over { color: var(--mm-warn); }
.mm-usage[data-level="full"] { color: var(--red); }
.mm-uval { flex: none; white-space: nowrap; }
.mm-items { list-style: none; }
.mm-row { padding: 6px 8px 5px; border-radius: 8px; transition: background-color var(--dur-press) ease; }
.mm-row:hover, .mm-row:focus-within, .mm-row[data-editing] { background: var(--mm-well); }
.mm-text { font-size: 13px; line-height: 20px; color: var(--text); white-space: pre-wrap; overflow-wrap: anywhere; }
.mm-text mark { border-radius: 3px; background: var(--mm-mark); box-shadow: 0 0 0 1px var(--mm-mark); color: inherit; }
.mm-meta { display: flex; align-items: center; gap: 6px; min-height: 26px; font-size: 12px; color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
.mm-src { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.mm-acts { display: inline-flex; flex: none; align-items: center; gap: 2px; margin: -1px -4px -1px auto; opacity: 0; transition: opacity 180ms ease; }
.mm-row:hover .mm-acts, .mm-row:focus-within .mm-acts, .mm-acts.is-on { opacity: 1; }
.mm-act { height: 26px; padding: 0 9px; font-size: 12.5px; font-weight: 500; color: var(--text-secondary); background: none; border: 0; border-radius: 8px; white-space: nowrap; transition: background-color var(--dur-press) ease, color var(--dur-press) ease, opacity var(--dur-press) ease; }
.mm-act-main { background: var(--text); color: var(--surface); }
.mm-act:disabled { opacity: 0.4; cursor: default; }
.mm textarea.mm-edit { display: block; width: 100%; min-height: 20px; margin: 0; padding: 0; font-size: 13px; line-height: 20px; color: var(--text); background: none; border: 0; border-radius: 0; resize: none; overflow: hidden; }
.mm textarea.mm-edit:focus-visible { outline: none; }
.mm-row[data-editing]:focus-within, .mm-new:focus-within { box-shadow: inset 0 0 0 1px var(--border-focus); }
.mm-counter { font-size: 11.5px; color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
.mm-counter.is-over { color: var(--red); }
.mm-empty { padding: 4px 8px 8px; font-size: 12.5px; color: var(--text-tertiary); }
.mm-nomatch { padding: 18px 8px 12px; text-align: center; overflow-wrap: anywhere; }
/* 3px of room so a focus ring is not clipped by the folding parent */
.mm-addline { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 3px 3px 8px; }
.mm-add { display: flex; align-items: center; gap: 6px; min-width: 0; height: 32px; padding: 0 8px; font-size: 13px; color: var(--text-tertiary); background: none; border: 0; border-radius: 8px; text-align: left; transition: background-color var(--dur-press) ease, color var(--dur-press) ease; }
.mm-clear { flex: none; height: 28px; padding: 0 8px; font-size: 12px; color: var(--text-tertiary); background: none; border: 0; border-radius: 8px; white-space: nowrap; transition: background-color var(--dur-press) ease, color var(--dur-press) ease, box-shadow var(--dur-press) ease; }
.mm-clear[data-armed] { background: var(--mm-danger-bg); color: var(--red); font-weight: 600; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--red) 40%, transparent); }
.mm-new { margin: 3px 3px 8px; padding: 8px 8px 6px; border-radius: 8px; background: var(--mm-well); }
.mm-label { display: block; margin-bottom: 4px; font-size: 12px; color: var(--text-tertiary); }
.mm-line { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px; margin-top: 6px; }

/* tray: caption (cross-fades) · polite status · Undo */
.mm-foot { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 4px 8px 4px 16px; border-top: 1px solid var(--border); border-radius: 0 0 calc(var(--radius) - 1px) calc(var(--radius) - 1px); background: var(--bg); }
.mm-caption { display: grid; flex: 1; min-width: 0; font-size: 12.5px; color: var(--text-tertiary); white-space: nowrap; font-variant-numeric: tabular-nums; }
.mm-caption b { font-weight: 600; color: var(--text); }
.mm-swap { grid-area: 1 / 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; animation: mm-swap-in 320ms ease both; }
.mm-swap[data-out] { animation: mm-swap-out 220ms ease both; }
.mm-swap.is-warn { color: var(--mm-warn); }
.mm-swap.is-fail { color: var(--red); }
.mm-forgot { display: flex; min-width: 0; }
.mm-flat { flex: none; white-space: pre; }
.mm-quote { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.mm-undo { display: inline-flex; flex: none; align-items: center; height: 28px; padding: 0 10px; font-size: 12.5px; font-weight: 600; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: 8px; animation: mm-swap-in 300ms ease both; transition: border-color var(--dur-press) ease; }
.mm-undo[hidden] { display: none; }
@keyframes mm-swap-in { from { opacity: 0; filter: blur(2px); } }
@keyframes mm-swap-out { to { opacity: 0; filter: blur(2px); } }
@media (hover: hover) and (pointer: fine) {
  .mm-chip:hover, .mm-icon:hover, .mm-add:hover { background: var(--mm-well); color: var(--text); }
  .mm-act:hover { background: var(--surface); color: var(--text); }
  .mm-act-main:hover { background: var(--text); color: var(--surface); opacity: 0.86; }
  .mm-act-del:hover, .mm-clear:hover { background: var(--mm-danger-bg); color: var(--red); }
  .mm-undo:hover { border-color: var(--accent); }
}
@container mm (max-width: 480px) { .mm-cap { display: none; } .mm-usage { flex-basis: 100%; } }
@container mm (max-width: 340px) { .mm-chip-n { display: none; } .mm-chip { padding: 0 7px; } }
@media (pointer: coarse) {
  .mm-acts { opacity: 1; }
  .mm-act, .mm-chip, .mm-clear, .mm-add, .mm-undo { min-height: 44px; }
  .mm-icon { width: 44px; height: 44px; }
  .mm-search { height: 44px; }
  .mm-search input { height: 42px; font-size: 16px; }
  .mm textarea.mm-edit { font-size: 16px; line-height: 22px; }
  .mm-meta { min-height: 44px; }
}
`;
