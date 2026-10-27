/**
 * Tool Call Card + Group. Sizes and timings follow the affectUI Tool Call Card pattern; every colour is a dashboard
 * token or a color-mix() of tokens, so light and dark both read.
 */
export const styles = `
:host { --tc-ink: var(--text); --tc-text: var(--text-secondary); --tc-muted: var(--text-tertiary);
  --tc-bg: var(--surface); --tc-line: var(--border); --tc-tile: var(--surface-raised);
  --tc-hover: color-mix(in srgb, var(--text) 3.5%, var(--surface));
  --tc-code: color-mix(in srgb, var(--surface-raised) 60%, var(--surface));
  --tc-ring: var(--surface);
  --tc-red: var(--st-fail-text); --tc-red-bg: color-mix(in srgb, var(--st-fail) 7%, var(--surface));
  --tc-red-line: color-mix(in srgb, var(--st-fail) 24%, transparent);
  --tc-key: var(--text); --tc-str: color-mix(in srgb, var(--green) 62%, var(--accent)); --tc-num: var(--orange);
  --tc-lit: var(--purple); --tc-shine: var(--text);
  --tc-lift: 0 1px 2px color-mix(in srgb, var(--text) 6%, transparent);
  --tc-ease: var(--ease-out);
  min-width: 0; font-size: 13.5px; line-height: 1.4; letter-spacing: -0.006em; }
[hidden] { display: none !important; }
button { appearance: none; margin: 0; border: 0; background: none; text-align: left; letter-spacing: inherit; }

/* Card */
.tc { position: relative; border: 1px solid var(--tc-line); border-radius: 12px; background: var(--tc-bg); box-shadow: var(--tc-lift); }
.tc-head { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 44px; padding: 8px 10px 8px 9px;
  border-radius: 11px; color: var(--tc-text); transition: background-color 160ms ease; }
.tc[data-open] > .tc-head { border-radius: 11px 11px 0 0; }
.tc-icon { display: grid; place-items: center; flex: none; width: 26px; height: 26px; border-radius: 7px;
  background: var(--tc-tile); box-shadow: inset 0 0 0 1px var(--tc-line); color: var(--tc-ink); }
.tc-icon > svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
.tc-main { display: flex; align-items: baseline; gap: 8px; flex: 1; min-width: 0; }
.tc-name { flex: 0 1 auto; max-width: 55%; overflow: hidden; color: var(--tc-ink); font-family: var(--mono); font-size: 12.5px;
  font-weight: 500; letter-spacing: 0; text-overflow: ellipsis; white-space: nowrap; }
.tc-summary { flex: 1 1 0; min-width: 0; overflow: hidden; color: var(--tc-text); text-overflow: ellipsis; white-space: nowrap; }
.tc-status { display: inline-flex; align-items: center; gap: 6px; flex: none; color: var(--tc-muted); font-size: 12.5px;
  font-variant-numeric: tabular-nums; white-space: nowrap; }
.tc-status.is-in { animation: tc-in 360ms var(--tc-ease) both; }
.tc[data-status="error"] .tc-status { color: var(--tc-red); }
.tc-status > svg { width: 14px; height: 14px; flex: none; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.tc-spin { animation: tc-spin 800ms linear infinite; }
.tc-spin circle { stroke: currentColor; stroke-width: 1.6; opacity: 0.25; }
.tc-spin path { stroke: var(--st-run); stroke-width: 1.6; }
.tc-ok { stroke: var(--st-done); stroke-width: 1.8; }
.is-in .tc-ok path { stroke-dasharray: 1; stroke-dashoffset: 1; animation: tc-draw 360ms var(--tc-ease) 80ms forwards; }
.tc-err { stroke: var(--st-fail); stroke-width: 1.5; }
.tc-stop { stroke: currentColor; stroke-width: 1.5; }
.tc-chev { flex: none; width: 14px; height: 14px; fill: none; stroke: var(--tc-muted); stroke-width: 1.5; stroke-linecap: round;
  stroke-linejoin: round; transition: transform 360ms var(--tc-ease); }
.tc[data-open] > .tc-head .tc-chev, .tcg[data-open] > .tcg-head .tc-chev { transform: rotate(180deg); }
@media (hover: hover) {
  .tc-head:hover { background: var(--tc-hover); }
  .tc-head:hover .tc-chev { stroke: var(--tc-ink); }
  .tcg-head:hover { background: var(--tc-hover); color: var(--tc-ink); }
  .tc-copy:hover { background: var(--tc-hover); color: var(--tc-ink); }
  .tc-more:hover { color: var(--tc-ink); }
  .tc-btn:hover { background: var(--tc-hover); }
}

/* Body: 0fr → 1fr, so the height animates without measuring */
.tc-body { display: grid; grid-template-rows: 0fr; opacity: 0;
  transition: grid-template-rows 380ms var(--tc-ease), opacity 240ms ease; }
.tc-body[data-open] { grid-template-rows: 1fr; opacity: 1; }
.tc-clip { min-height: 0; overflow: hidden; }
.tc-sections { display: grid; gap: 12px; padding: 12px; border-top: 1px solid var(--tc-line); }
.tc-top { display: flex; justify-content: flex-end; margin: -2px 0 -6px; }
.tc-line { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.tc-line > p { min-width: 0; }
.tc-head-end { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
.tc-at { flex: none; color: var(--tc-muted); font-size: 11.5px; line-height: 16px; font-variant-numeric: tabular-nums; }
.tc-section { display: grid; gap: 6px; min-width: 0; }
.tc-section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 24px; }
.tc-label { color: var(--tc-muted); font-size: 12px; font-weight: 500; }
.tc-pending, .tc-note { margin: 0; color: var(--tc-muted); font-size: 12.5px; }
.tc-note { font-size: 12px; }

.tc-copy { position: relative; display: grid; place-items: center; flex: none; width: 24px; height: 24px; padding: 0;
  border-radius: 6px; color: var(--tc-muted); transition: background-color 160ms ease, color 160ms ease; }
.tc-copy svg { position: absolute; width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.4;
  stroke-linecap: round; stroke-linejoin: round;
  transition: opacity 200ms ease, transform 320ms var(--tc-ease), filter 200ms ease; }
.tc-copy-done { opacity: 0; transform: scale(0.6); filter: blur(2px); stroke-width: 1.7; }
.tc-copy[data-copied] { color: var(--st-done); }
.tc-copy[data-copied] .tc-copy-icon { opacity: 0; transform: scale(0.6); filter: blur(2px); }
.tc-copy[data-copied] .tc-copy-done { opacity: 1; transform: none; filter: none; }

/* Code wraps instead of scrolling sideways; a capped block fades out at the bottom */
.tc-code { position: relative; margin: 0; padding: 10px 12px; overflow: hidden; border-radius: 8px; background: var(--tc-code);
  box-shadow: inset 0 0 0 1px var(--tc-line); color: var(--tc-text); font-family: var(--mono); font-size: 12px;
  line-height: 1.6; letter-spacing: 0; white-space: pre-wrap; overflow-wrap: anywhere; tab-size: 2;
  transition: max-height 420ms var(--tc-ease); }
.tc-code[data-json] { color: var(--tc-muted); }
.tc-code code { display: block; font: inherit; }
.tc-code::after { content: ""; position: absolute; left: 1px; right: 1px; bottom: 1px; height: 56px; border-radius: 0 0 7px 7px;
  background: linear-gradient(to bottom, color-mix(in srgb, var(--tc-code) 0%, transparent), var(--tc-code));
  opacity: 0; transition: opacity 240ms ease; pointer-events: none; }
.tc-code[data-capped]::after { opacity: 1; }
.tc-k { color: var(--tc-key); }
.tc-s { color: var(--tc-str); }
.tc-n { color: var(--tc-num); }
.tc-l { color: var(--tc-lit); }
.tc-more { position: relative; justify-self: start; padding: 2px 4px; margin-left: -4px; border-radius: 5px; color: var(--tc-text);
  font-size: 12.5px; font-weight: 500; transition: color 160ms ease; }

/* Error: the message and an optional Retry; a failed host fetch: the message and Try again */
.tc-error { display: flex; align-items: flex-start; gap: 8px; padding: 9px 10px 9px 11px; border-radius: 8px;
  background: var(--tc-red-bg); box-shadow: inset 0 0 0 1px var(--tc-red-line); }
.tc-error > svg { flex: none; width: 14px; height: 14px; margin-top: 2px; fill: none; stroke-linecap: round; }
.tc-error-text { flex: 1; min-width: 0; margin: 0; color: var(--tc-red); font-size: 13px; line-height: 1.45;
  white-space: pre-wrap; overflow-wrap: anywhere; }
.tc-reload-row { display: flex; align-items: center; gap: 8px; }
.tc-reload-row > .tc-pending { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.tc-btn { position: relative; display: inline-flex; align-items: center; gap: 5px; flex: none; height: 26px; margin: -3px 0;
  padding: 0 10px 0 8px; border-radius: 7px; background: var(--tc-bg); box-shadow: inset 0 0 0 1px var(--tc-line), var(--tc-lift);
  color: var(--tc-ink); font-size: 12.5px; font-weight: 500; white-space: nowrap; transition: background-color 160ms ease; }
.tc-btn svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round;
  stroke-linejoin: round; transition: transform 200ms var(--tc-ease); }
.tc-btn:active svg { transform: rotate(-60deg); }

/* Group: one quiet line with the tools' icons stacked, the cards below */
.tcg { display: grid; }
.tcg-head { display: flex; align-items: center; gap: 9px; justify-self: start; max-width: 100%; min-height: 36px;
  padding: 4px 10px 4px 5px; border-radius: 10px; color: var(--tc-text);
  transition: background-color 160ms ease, color 160ms ease; }
.tcg-stack { display: flex; flex: none; }
.tcg-stack .tc-icon { width: 24px; height: 24px; box-shadow: inset 0 0 0 1px var(--tc-line), 0 0 0 2px var(--tc-ring); }
.tcg-stack .tc-icon.is-in { animation: tc-pop 420ms var(--tc-ease) both; }
.tcg-stack .tc-icon + .tc-icon { margin-left: -5px; }
.tcg-stack .tc-icon > svg { width: 13px; height: 13px; }
.tcg-title { display: flex; align-items: baseline; gap: 5px; min-width: 0; white-space: nowrap; }
.tcg-title.is-in { animation: tc-in 360ms var(--tc-ease) both; }
.tcg-label { position: relative; min-width: 0; overflow: hidden; text-overflow: ellipsis; color: inherit; font-weight: 500; }
.tcg-failed { flex: none; color: var(--tc-red); }
.tcg-time { flex: none; color: var(--tc-muted); font-variant-numeric: tabular-nums; }
.tcg-list { display: grid; gap: 8px; padding-top: 8px; }

/* A band of the text colour sweeping over “Using tools…” */
.tc-shine::after { content: attr(data-text); content: attr(data-text) / ""; position: absolute; inset: 0; white-space: nowrap;
  color: transparent; background: linear-gradient(90deg, transparent 38%, var(--tc-shine) 50%, transparent 62%) 100% 0 / 300% 100% no-repeat;
  -webkit-background-clip: text; background-clip: text; animation: tc-sweep 1.8s linear infinite; pointer-events: none; }

@keyframes tc-in { from { opacity: 0; transform: translateY(3px); filter: blur(2px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes tc-pop { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: none; } }
@keyframes tc-spin { to { transform: rotate(360deg); } }
@keyframes tc-draw { to { stroke-dashoffset: 0; } }
@keyframes tc-sweep { from { background-position: 100% 0; } to { background-position: 0% 0; } }

/* Touch: every control gets a 44px target without changing the layout */
@media (pointer: coarse) {
  .tcg-head { min-height: 44px; }
  .tc-copy::before, .tc-more::before, .tc-btn::before { content: ""; position: absolute; inset: -10px; }
  .tc-more::before { inset: -12px -8px; }
  .tc-btn::before { inset: -9px -4px; }
}
@media (prefers-reduced-motion: reduce) {
  .tc-shine::after { display: none; }
  .tc-spin { animation: none; }
  .is-in .tc-ok path { animation: none; stroke-dashoffset: 0; }
}
`;
