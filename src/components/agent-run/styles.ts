/**
 * Ported from the soma-work dashboard session panel (.prd/affectui/re-agent-run.md): SESSION CHIP (D18), PLAN (D1–D7),
 * 입력 필요 approval cards (D8–D17) and 세부 (D19). Every colour is a token or a color-mix of tokens, so light and dark
 * follow the host tokens; the screen is one container (two columns from 760px), each approval card is its own.
 */
export const styles = `
:host { --ar-wait-text: color-mix(in srgb, var(--st-wait) 74%, var(--text)); }
.ar { --ar-pad: 16px; container: ar / inline-size; position: relative; overflow: hidden; overflow: clip; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); color: var(--text); font-size: 13px; line-height: 1.45; }

/* ── Head: title · subtitle · status pill · started + live elapsed · Stop ── */
.ar-head { padding: 14px var(--ar-pad) 12px; }
.ar-title { margin: 0; font-size: 15px; font-weight: 650; line-height: 22px; letter-spacing: -0.005em; color: var(--text); overflow-wrap: anywhere; }
.ar-title:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; border-radius: 4px; }
.ar-sub { margin: 2px 0 0; font-size: 12px; line-height: 17px; color: var(--text-secondary); overflow-wrap: anywhere; }
.ps-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; min-width: 0; margin-top: 10px; font-size: 12.5px; color: var(--text-secondary); }
.ps-chip { --ag-c: var(--text-tertiary); --ag-t: var(--ag-c); display: inline-flex; align-items: center; gap: 5px; min-width: 0; height: 24px; padding: 0 10px 0 8px; border-radius: 99px; background: color-mix(in srgb, var(--ag-c) 13%, transparent); white-space: nowrap; }
.ps-chip.is-running { --ag-c: var(--st-run); }
.ps-chip.is-waiting { --ag-c: var(--st-wait); --ag-t: var(--ar-wait-text); }
.ps-chip.is-done { --ag-c: var(--st-done); }
.ps-chip.is-failed { --ag-c: var(--st-fail); --ag-t: var(--st-fail-text); }
.ps-label { font-size: 11px; font-weight: 700; letter-spacing: 0.02em; color: var(--text-tertiary); }
.ps-icon { display: inline-grid; place-items: center; width: 14px; height: 14px; color: var(--ag-c); }
.ps-icon svg { width: 12px; height: 12px; }
.ps-icon .ar-spin { width: 10px; height: 10px; }
.ps-word { font-weight: 650; color: var(--ag-t); }
.ps-time { display: inline-flex; align-items: center; gap: 5px; min-width: 0; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ps-clock { display: inline-grid; flex: none; color: var(--text-tertiary); }
.ps-clock svg { width: 13px; height: 13px; }
.ps-dot { color: var(--text-tertiary); }
.ps-actions { display: inline-flex; flex: none; align-items: center; gap: 6px; margin-left: auto; }
.ar-stop { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 30px; padding: 3px 12px; border: 1px solid var(--ib-card-border); border-radius: 8px; background: var(--ib-card); color: var(--st-fail-text); font-size: 12.5px; font-weight: 500; white-space: nowrap; transition: border-color 150ms ease, transform var(--dur-press) var(--ease-out); }
.ar-stop:disabled { cursor: not-allowed; opacity: 0.5; }
.ar-stop:active:not(:disabled) { transform: scale(0.97); }

/* ── Bands: one column (plan → needs input → details); from 760px two — plan + details | side ── */
.ar-body { display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; border-top: 1px solid var(--border); }
.ar-band { min-width: 0; padding: 10px var(--ar-pad) 12px; }
.ar-band + .ar-band { border-top: 1px solid var(--border); }
.ar-sec-h { margin: 0 0 6px; font-size: 12px; font-weight: 700; line-height: 18px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-secondary); }
@container ar (min-width: 760px) {
  .ar-head, .ar-body { --ar-pad: 20px; }
  .ar-head { padding-top: 16px; padding-bottom: 14px; }
  .ar-band { padding-top: 14px; padding-bottom: 14px; }
  .ar-body[data-side] { grid-template-columns: minmax(0, 1fr) minmax(340px, 440px); grid-template-rows: auto 1fr; }
  .ar-body[data-side] > .ar-band { border-top: 0; }
  .ar-body[data-side] > .ar-plan { grid-area: 1 / 1; }
  .ar-body[data-side="needs"] > .ar-needs { grid-area: 1 / 2 / 3 / 3; align-self: stretch; border-left: 1px solid var(--border); }
  .ar-body[data-side="needs"] > .ar-details { grid-area: 2 / 1; }
  .ar-body[data-side="needs"] > .ar-plan ~ .ar-details { border-top: 1px solid var(--border); }
  .ar-body[data-side="details"] > .ar-details { grid-area: 1 / 2 / 3 / 3; align-self: stretch; border-left: 1px solid var(--border); }
}

/* ── PLAN: a marker per step (check · spinner · ring · ✕ · dash) on one rail, time on the right, phase foot ── */
.pl-list { position: relative; margin: 0; padding: 0; list-style: none; }
.pl-empty { margin: 0; padding: 2px 0 4px; font-size: 12px; color: var(--text-tertiary); }
.pl-step { position: relative; display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; column-gap: 10px; align-items: start; padding: 5px 0; font-size: 12.5px; line-height: 18px; }
.pl-marker { position: relative; z-index: 1; display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--surface); box-shadow: inset 0 0 0 1px var(--ib-card-border); color: var(--text-secondary); }
.pl-step[data-step="done"] .pl-marker { background: var(--ib-pill); box-shadow: none; color: var(--text); }
.pl-step[data-step="running"] .pl-marker { box-shadow: none; color: var(--st-run); }
.pl-step[data-step="failed"] .pl-marker { background: color-mix(in srgb, var(--st-fail) 16%, var(--surface)); box-shadow: none; color: var(--st-fail-text); }
.pl-step[data-step="skipped"] .pl-marker { box-shadow: none; border: 1px dashed var(--text-tertiary); color: var(--text-tertiary); }
.pl-marker svg { width: 10px; height: 10px; }
.pl-marker .ar-spin { width: 11px; height: 11px; }
.pl-step.pl-pop .pl-marker > * { animation: pl-pop var(--dur-move) var(--ease-out) both; }
@keyframes pl-pop { from { opacity: 0; transform: scale(0.6); } }
.pl-list > .pl-step:not(:last-child)::before { content: ""; position: absolute; left: 8.5px; top: 25px; bottom: -3px; width: 1px; background: var(--ib-card-border); }
.pl-list > .pl-step[data-step="done"]:not(:last-child)::after { content: ""; position: absolute; left: 8.5px; top: 25px; bottom: -3px; width: 1px; background: var(--text-tertiary); transform-origin: top; }
.pl-list > .pl-step.pl-pop[data-step="done"]:not(:last-child)::after { animation: pl-rail 560ms var(--ease-out) both; }
@keyframes pl-rail { from { transform: scaleY(0); } }
.pl-main { min-width: 0; }
.pl-line { display: block; overflow-wrap: anywhere; }
.pl-ref { margin-right: 6px; font-size: 11px; color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
.pl-text { color: var(--text-secondary); }
.pl-step[data-step="running"] .pl-text { font-weight: 600; color: var(--text); }
.pl-step[data-step="failed"] .pl-text { color: var(--text); }
.pl-step[data-step="skipped"] .pl-text { color: var(--text-tertiary); }
.pl-chip { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 6px; background: var(--ib-pill); color: var(--text-secondary); font-size: 11px; font-weight: 400; line-height: 16px; white-space: nowrap; font-variant-numeric: tabular-nums; vertical-align: 1px; }
.pl-sub { display: block; margin-top: 1px; overflow: hidden; font-size: 12px; color: var(--text-tertiary); text-overflow: ellipsis; white-space: nowrap; }
.pl-step[data-step="failed"] .pl-sub { color: var(--st-fail-text); white-space: normal; overflow-wrap: anywhere; }
.pl-aside { min-height: 18px; font-size: 12px; color: var(--text-tertiary); font-variant-numeric: tabular-nums; white-space: nowrap; }
.pl-step[data-step="running"] .pl-aside { color: var(--text); }
.pl-fold { padding: 0 0 0 28px; }
.pl-fold-btn { min-height: 28px; padding: 4px 0; border: 0; background: none; color: var(--accent); font-size: 11.5px; font-weight: 600; }
.pl-fold-btn:hover { text-decoration: underline; }
.pl-foot { position: sticky; bottom: 0; z-index: 2; display: flex; align-items: center; gap: 8px; margin: 6px calc(-1 * var(--ar-pad)) -12px; padding: 8px var(--ar-pad) 10px; border-top: 1px solid var(--border); background: var(--surface); font-size: 12.5px; color: var(--text-secondary); }
.pl-foot-st { display: inline-flex; align-items: center; gap: 7px; min-width: 0; color: var(--text); font-variant-numeric: tabular-nums; }
.pl-foot-icon { display: inline-grid; place-items: center; width: 14px; height: 14px; color: var(--text-tertiary); }
.pl-foot[data-phase="running"] .pl-foot-icon { color: var(--st-run); }
.pl-foot[data-phase="done"] .pl-foot-icon { color: var(--st-done); }
.pl-foot[data-phase="failed"] .pl-foot-icon { color: var(--st-fail-text); }
.pl-foot-icon svg { width: 12px; height: 12px; }
.pl-foot-icon .ar-spin { width: 11px; height: 11px; }
.pl-foot-time { margin-left: auto; font-variant-numeric: tabular-nums; white-space: nowrap; }
@container ar (min-width: 760px) { .pl-foot { margin-bottom: -14px; } }

/* ── 입력 필요 / Needs input: a head with the count, then cards in a tray ── */
.ar-needs { padding-top: 4px; }
.ar-needs-head { display: flex; align-items: center; gap: 8px; margin: 0; padding: 8px 0; font-size: 13px; font-weight: 650; line-height: 18px; color: var(--text); }
.ar-needs-head:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; border-radius: 6px; }
.pn-count { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: color-mix(in srgb, var(--st-wait) 24%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--st-wait) 55%, transparent); color: var(--text); font-size: 11px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.pn-count.is-pop { animation: pn-pop var(--dur-move) var(--ease-out) both; }
@keyframes pn-pop { from { opacity: 0; transform: scale(0.6); } }
.ap-list { display: flex; flex-direction: column; gap: 10px; }
.ap-card { container: ap / inline-size; position: relative; padding: 4px; border: 1px solid var(--ib-card-border); border-radius: 14px; background: var(--ib-col); color: var(--ib-text); }
.ap-card:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
.ap-label { padding: 4px 8px 6px; overflow: hidden; font-size: 12px; line-height: 16px; color: var(--ib-muted); white-space: nowrap; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.ap-body { padding: 14px; border-radius: 11px; background: var(--ib-card); box-shadow: 0 0 0 1px var(--ib-card-border); }
.ap-head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start; gap: 10px; }
.ap-icon { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; background: var(--ib-pill); color: var(--ib-text); }
.ap-icon svg { width: 16px; height: 16px; }
.ap-titles { min-width: 0; padding-top: 1px; }
.ap-title { overflow: hidden; font-size: 14px; font-weight: 600; line-height: 20px; color: var(--ib-text); white-space: nowrap; text-overflow: ellipsis; }
.ap-question .ap-title { overflow: visible; white-space: pre-line; overflow-wrap: anywhere; }
.ap-desc { margin-top: 1px; overflow: hidden; font-size: 13px; line-height: 18px; color: var(--ib-text-2); white-space: nowrap; text-overflow: ellipsis; }
.ap-qbody { margin-top: 4px; font-size: 13px; line-height: 18px; color: var(--ib-text-2); white-space: pre-line; overflow-wrap: anywhere; }
.ap-pill { display: inline-flex; align-items: center; gap: 6px; height: 22px; margin-top: 1px; padding: 0 9px 0 8px; border-radius: 999px; background: var(--ib-pill); color: var(--ib-text-2); font-size: 12px; font-weight: 500; line-height: 1; white-space: nowrap; }
.ap-pill::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: 0.8; }
.ap-pill[data-kind="rule"] { background: color-mix(in srgb, var(--st-fail) 14%, transparent); color: var(--st-fail-text); }
.ap-pill[data-kind="question"] { background: color-mix(in srgb, var(--st-wait) 16%, transparent); color: var(--ar-wait-text); }
.ap-details { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 6px 16px; max-height: 320px; overflow: auto; margin: 12px 0 0; padding: 10px 12px; border-radius: 9px; background: var(--ib-col); box-shadow: inset 0 0 0 1px var(--ib-card-border); font-size: 12.5px; line-height: 18px; }
.ap-detail { display: contents; }
.ap-detail dt { color: var(--ib-muted); }
.ap-detail dd { min-width: 0; margin: 0; color: var(--ib-text); font-family: var(--mono); font-size: 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
.ap-raw { max-height: 320px; overflow: auto; margin: 12px 0 0; padding: 10px 12px; border-radius: 9px; background: var(--ib-col); box-shadow: inset 0 0 0 1px var(--ib-card-border); color: var(--ib-text); font-family: var(--mono); font-size: 12px; line-height: 18px; white-space: pre-wrap; overflow-wrap: anywhere; }
.ap-truncated { margin: 4px 0 0; font-size: 11.5px; color: var(--ib-muted); }
.ap-rules { display: flex; flex-direction: column; gap: 3px; margin: 10px 0 0; font-size: 12px; line-height: 17px; color: var(--ib-text); overflow-wrap: anywhere; }
.ap-rules-label { font-weight: 600; color: var(--ib-text-2); }
.ap-rule code { padding: 1px 5px; border-radius: 4px; background: color-mix(in srgb, var(--orange) 14%, transparent); color: var(--orange); font-family: var(--mono); font-size: 0.95em; }
.ap-alts { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; }
.ap-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; margin-top: 8px; }
.ap-expires { font-size: 12.5px; color: var(--ib-muted); font-variant-numeric: tabular-nums; white-space: nowrap; transition: color var(--dur-fade) linear; }
.ap-expires.is-low { color: var(--ar-wait-text); }
.ap-actions { display: flex; flex: 0 0 auto; gap: 4px; margin-left: auto; }
.ap-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 34px; padding: 0 12px; border: 0; border-radius: 10px; font-size: 13px; font-weight: 500; line-height: 1; white-space: nowrap; transition: background-color 150ms ease, opacity 150ms ease, transform var(--dur-press) var(--ease-out); }
.ap-ghost { min-height: 28px; padding: 0 10px; border-radius: 8px; background: transparent; color: var(--ib-text-2); font-size: 12.5px; box-shadow: inset 0 0 0 1px var(--ib-card-border); }
.ap-quiet { background: transparent; color: var(--ib-text); box-shadow: inset 0 0 0 1px var(--ib-card-border); }
.ap-primary { background: var(--ib-text); color: var(--ib-card); }
.ap-btn:disabled, .ap-choice:disabled { cursor: not-allowed; opacity: 0.5; }
.ap-btn.is-busy, .ap-choice.is-busy { opacity: 1; cursor: progress; }
.ap-btn:active:not(:disabled), .ap-choice:active:not(:disabled) { transform: scale(0.97); }
.ap-kbd { display: inline-grid; place-items: center; min-width: 20px; height: 20px; margin-right: -4px; padding: 0 5px; border-radius: 6px; background: color-mix(in srgb, currentColor 12%, transparent); font-size: 11px; font-weight: 500; opacity: 0.8; }
.ap-btn:disabled .ap-kbd, .ap-choice:disabled .ap-kbd { display: none; }
.ap-choices { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
.ap-choice { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%; min-height: 36px; padding: 8px 12px; border: 0; border-radius: 10px; background: transparent; color: var(--ib-text); box-shadow: inset 0 0 0 1px var(--ib-card-border); font-size: 13px; line-height: 18px; text-align: left; transition: background-color 150ms ease, opacity 150ms ease, transform var(--dur-press) var(--ease-out); }
.ap-rec { padding-right: 52px; background: var(--ib-text); color: var(--ib-card); box-shadow: none; font-weight: 500; }
.ap-rec .ap-kbd { position: absolute; top: 8px; right: 8px; margin: 0; background: color-mix(in srgb, currentColor 14%, transparent); }
.ap-choice-label { overflow-wrap: anywhere; }
.ap-choice-label .ar-spin { margin-right: 6px; }
.ap-choice-tag { margin-left: 8px; padding: 1px 6px; border-radius: 6px; background: color-mix(in srgb, currentColor 14%, transparent); font-size: 11px; font-weight: 500; white-space: nowrap; }
.ap-choice-desc { font-size: 12px; font-weight: 400; opacity: 0.75; overflow-wrap: anywhere; }
.ap-lock { margin: 8px 0 0; font-size: 12px; color: var(--ib-muted); overflow-wrap: anywhere; }
.ap-note { margin: 8px 0 0; font-size: 12px; color: var(--st-fail-text); overflow-wrap: anywhere; }
.ap-resolved { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 10px 12px; border-radius: 11px; background: var(--ib-card); box-shadow: 0 0 0 1px var(--ib-card-border); }
.ap-resolved.is-enter { animation: ap-in var(--dur-move) var(--ease-out) both; }
@keyframes ap-in { from { opacity: 0; transform: translateY(4px); } }
.ap-mark { display: grid; flex: none; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: color-mix(in srgb, var(--st-done) 16%, transparent); color: var(--st-done); font-size: 12px; font-weight: 700; }
.ap-mark svg { width: 12px; height: 12px; }
.ap-resolved[data-decision="deny"] .ap-mark, .ap-resolved[data-decision="explain"] .ap-mark { background: var(--ib-pill); color: var(--ib-text-2); }
.ap-row-title { flex: 1 1 auto; min-width: 0; overflow: hidden; font-size: 13.5px; font-weight: 500; color: var(--ib-text); white-space: nowrap; text-overflow: ellipsis; }
.ap-row-status { flex: 0 1 auto; min-width: 0; overflow: hidden; font-size: 12.5px; color: var(--ib-muted); white-space: nowrap; text-overflow: ellipsis; }
/* An answered question keeps its whole answer readable: the answer goes on a second line under the question. */
.ap-resolved[data-decision="answer"] { display: grid; grid-template-columns: 22px minmax(0, 1fr); column-gap: 10px; row-gap: 1px; }
.ap-resolved[data-decision="answer"] .ap-row-status { grid-column: 2; white-space: normal; overflow-wrap: anywhere; }
@container ap (max-width: 379px) {
  .ap-actions { flex: 1 1 100%; margin-left: 0; }
  .ap-actions .ap-btn { flex: 1 1 0; min-width: 0; }
  .ap-kbd { display: none; }
  .ap-rec { padding-right: 12px; }
}
@container ap (max-width: 319px) {
  .ap-body { padding: 12px; }
  .ap-pill-word { display: none; }
}

/* ── 세부 / Details: label left, value right ── */
.pi-details { display: grid; gap: 7px; margin: 0; }
.pi-details > div { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; min-width: 0; }
.pi-details dt { flex: 0 1 auto; min-width: 0; font-size: 12px; color: var(--text-tertiary); }
.pi-details dd { min-width: 0; margin: 0; font-size: 12.5px; font-weight: 600; color: var(--text); text-align: right; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }

/* ── Spinner ── */
.ar-spin { display: inline-block; flex: none; width: 12px; height: 12px; border: 2px solid var(--ib-pill); border-top-color: var(--st-run); border-right-color: var(--st-run); border-radius: 50%; vertical-align: -1px; animation: ar-spin 0.9s linear infinite; }
.ap-btn .ar-spin, .ap-choice .ar-spin, .ar-stop .ar-spin { width: 11px; height: 11px; border-width: 1.5px; border-color: color-mix(in srgb, currentColor 25%, transparent); border-top-color: currentColor; border-right-color: currentColor; }
@keyframes ar-spin { to { transform: rotate(360deg); } }

/* Key hints only with a hover pointer; quiet hovers; 44px answers on touch. */
@media (hover: none) {
  .ap-kbd { display: none; }
  .ap-rec { padding-right: 12px; }
}
@media (hover: hover) and (pointer: fine) {
  .ap-ghost:not(:disabled):hover, .ap-quiet:not(:disabled):hover, .ap-choice:not(.ap-rec):not(:disabled):hover { background: var(--ib-pill); }
  .ap-primary:not(:disabled):hover, .ap-rec:not(:disabled):hover { opacity: 0.88; }
  .ar-stop:not(:disabled):hover { border-color: var(--st-fail); }
}
@media (pointer: coarse) {
  .ap-btn, .ap-choice, .ar-stop, .pl-fold-btn { min-height: 44px; }
}
`;
