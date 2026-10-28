/**
 * Approval Card. Sizes and timings follow the affectUI Approval Card (clean style, buttons in the card): 16px card,
 * 32px icon tile, 34px buttons with key hints, a 520ms height glide into the resolved row. Every colour is a
 * dashboard token or a color-mix() of tokens, so light and dark both read.
 */
export const styles = `
:host { --ac-ink: var(--text); --ac-text: var(--text-secondary); --ac-muted: var(--text-tertiary);
  --ac-bg: var(--surface); --ac-line: var(--border);
  --ac-soft: color-mix(in srgb, var(--surface-raised) 55%, var(--surface));
  --ac-hover: color-mix(in srgb, var(--text) 7%, var(--surface));
  --ac-primary: var(--text); --ac-primary-ink: var(--surface);
  --ac-primary-hover: color-mix(in srgb, var(--text) 86%, var(--surface));
  --ac-kbd: color-mix(in srgb, var(--text) 6%, transparent);
  --ac-kbd-on: color-mix(in srgb, var(--surface) 16%, transparent);
  --ac-kbd-on-ink: color-mix(in srgb, var(--surface) 72%, transparent);
  --ac-box: color-mix(in srgb, var(--text) 24%, var(--surface));
  --ac-box-hover: color-mix(in srgb, var(--text) 40%, var(--surface));
  --ac-low: color-mix(in srgb, var(--st-wait) 74%, var(--text));
  --ac-neutral: color-mix(in srgb, var(--text) 7%, transparent);
  --ac-ease: var(--ease-out);
  min-width: 0; font-size: 13px; line-height: 1.45; letter-spacing: -0.006em; }
[hidden] { display: none !important; }
button { appearance: none; margin: 0; border: 0; background: none; text-align: left; letter-spacing: inherit; }
input { letter-spacing: inherit; }

.ac { position: relative; container: ac / inline-size; min-width: 0; transition: height 520ms var(--ac-ease); }
.ac[data-morph] { overflow: hidden; }
.ac-label { overflow: hidden; padding: 0 2px 6px; color: var(--ac-muted); font-size: 12.5px; line-height: 16px;
  white-space: nowrap; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.ac-label code { font-family: var(--mono); font-size: 12px; letter-spacing: 0; }
.ac-card { position: relative; border-radius: 16px; background: var(--ac-bg);
  box-shadow: inset 0 0 0 1px var(--ac-line), 0 1px 2px color-mix(in srgb, var(--text) 4%, transparent); }
.ac-main { padding: 16px; }
.ac-card.is-enter { animation: ac-in 420ms var(--ac-ease) 80ms both; }
.ac-ghost { position: absolute; left: 0; right: 0; pointer-events: none; animation: ac-out 280ms var(--ac-ease) both; }

/* Head: icon tile · title + description · risk badge */
.ac-head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start; gap: 12px; }
.ac-icon { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 9px;
  box-shadow: inset 0 0 0 1px var(--ac-line); color: var(--ac-ink); }
.ac-icon svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round;
  stroke-linejoin: round; }
.ac-titles { min-width: 0; padding-top: 1px; }
.ac-title { margin: 0; overflow: hidden; color: var(--ac-ink); font-size: 14px; font-weight: 550; line-height: 20px;
  letter-spacing: -0.011em; white-space: nowrap; text-overflow: ellipsis; }
.ac-desc { margin: 1px 0 0; overflow: hidden; color: var(--ac-text); font-size: 13px; line-height: 18px; white-space: nowrap;
  text-overflow: ellipsis; }
.ac[data-kind="question"] .ac-title { overflow: visible; white-space: pre-line; overflow-wrap: anywhere; }
.ac[data-kind="question"] .ac-desc { margin-top: 3px; overflow: visible; white-space: pre-line; overflow-wrap: anywhere; }
.ac-risk { display: inline-flex; align-items: center; height: 22px; margin-top: 1px; padding: 0 7px; border-radius: 6px;
  background: var(--ac-neutral); color: var(--ac-text); font-size: 12px; font-weight: 500; line-height: 1; white-space: nowrap; }
.ac-risk-word { white-space: pre; }
.ac-risk[data-risk="medium"] { background: color-mix(in srgb, var(--st-wait) 14%, transparent); color: var(--ac-low); }
.ac-risk[data-risk="high"] { background: color-mix(in srgb, var(--st-fail) 12%, transparent); color: var(--st-fail-text); }

/* Preview: the input as a shell block, a diff, rows, or text — scrolls past 360px */
.ac-preview { display: grid; gap: 12px; max-height: 360px; overflow-y: auto; overscroll-behavior: contain; margin-top: 14px;
  padding-top: 14px; border-top: 1px solid var(--ac-line); }
.ac-code { margin: 0; padding: 9px 11px; border-radius: 8px; background: var(--ac-soft); box-shadow: inset 0 0 0 1px var(--ac-line);
  color: var(--ac-ink); font-family: var(--mono); font-size: 12px; line-height: 1.6; letter-spacing: 0; white-space: pre-wrap;
  overflow-wrap: anywhere; tab-size: 2; }
.ac-prompt { color: var(--ac-muted); user-select: none; }
.ac-file { display: grid; gap: 6px; min-width: 0; }
.ac-path { overflow: hidden; color: var(--ac-text); font-family: var(--mono); font-size: 12px; letter-spacing: 0;
  white-space: nowrap; text-overflow: ellipsis; direction: rtl; text-align: left; }
.ac-path > bdi { direction: ltr; unicode-bidi: isolate; }
.ac-diff { padding: 6px 0; overflow: hidden; }
.ac-dl { display: block; min-height: 1.6em; padding: 0 11px 0 26px; text-indent: -15px; }
.ac-dl::before { content: attr(data-op); display: inline-block; width: 15px; text-indent: 0; color: var(--ac-muted); }
.ac-dl[data-op="+"] { background: color-mix(in srgb, var(--green) 11%, transparent);
  color: color-mix(in srgb, var(--green) 62%, var(--text)); }
.ac-dl[data-op="-"] { background: color-mix(in srgb, var(--red) 10%, transparent);
  color: color-mix(in srgb, var(--red) 62%, var(--text)); }
.ac-dl[data-op="+"]::before, .ac-dl[data-op="-"]::before { color: inherit; }
.ac-details { display: grid; grid-template-columns: fit-content(40%) minmax(0, 1fr); gap: 6px 16px; margin: 0; }
.ac-detail { display: contents; }
.ac-detail dt { min-width: 0; color: var(--ac-muted); overflow-wrap: anywhere; }
.ac-detail dd { min-width: 0; margin: 0; color: var(--ac-ink); font-family: var(--mono); font-size: 12px; line-height: 19px;
  letter-spacing: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.ac-rules { display: grid; gap: 4px; font-size: 12.5px; line-height: 18px; }
.ac-rules-label { color: var(--ac-muted); }
.ac-rule { color: var(--ac-text); overflow-wrap: anywhere; }
.ac-rule code { margin-right: 6px; padding: 1px 5px; border-radius: 5px; background: color-mix(in srgb, var(--st-fail) 10%, transparent);
  color: var(--st-fail-text); font-family: var(--mono); font-size: 11.5px; letter-spacing: 0; }
.ac-rule b { color: var(--ac-ink); font-weight: 500; }
.ac-note { margin: 0; color: var(--ac-muted); font-size: 12.5px; line-height: 18px; overflow-wrap: anywhere; }

/* Question: one option per choice (the recommended first), an optional free-text answer */
.ac-opts { display: grid; gap: 6px; margin-top: 14px; }
.ac-opt { position: relative; display: grid; grid-template-columns: 16px minmax(0, 1fr); align-items: start; column-gap: 10px;
  row-gap: 1px; width: 100%; min-height: 40px; padding: 9px 12px; border-radius: 10px; box-shadow: inset 0 0 0 1px var(--ac-line);
  color: var(--ac-ink); cursor: pointer; transition: background-color 160ms ease, box-shadow 160ms ease, transform 160ms var(--ac-ease); }
.ac-opt[aria-checked="true"] { background: color-mix(in srgb, var(--text) 3%, var(--surface)); box-shadow: inset 0 0 0 1.5px var(--ac-ink); }
.ac-radio { grid-row: 1 / span 2; width: 16px; height: 16px; margin-top: 2px; border-radius: 50%; background: var(--ac-bg);
  box-shadow: inset 0 0 0 1px var(--ac-box); transition: box-shadow 200ms var(--ac-ease); }
.ac-opt[aria-checked="true"] .ac-radio { box-shadow: inset 0 0 0 5px var(--ac-primary); }
.ac-opt-label { min-width: 0; font-size: 13.5px; font-weight: 500; line-height: 20px; overflow-wrap: anywhere; }
.ac-opt-tag { display: inline-block; margin-left: 8px; padding: 2px 6px; border-radius: 6px; background: var(--ac-neutral);
  color: var(--ac-text); font-size: 11px; font-weight: 500; line-height: 14px; vertical-align: 1px; white-space: nowrap; }
.ac-opt-desc { grid-column: 2; min-width: 0; color: var(--ac-text); font-size: 12.5px; line-height: 18px; overflow-wrap: anywhere; }
.ac-other { margin-top: 2px; }
.ac-other input { width: 100%; height: 36px; padding: 0 11px; border: 0; border-radius: 9px; background: var(--ac-bg);
  box-shadow: inset 0 0 0 1px var(--ac-line); color: var(--ac-ink); font-size: 13.5px; }
.ac-other input::placeholder { color: var(--ac-muted); }
.ac-other input:focus-visible { outline: none; box-shadow: inset 0 0 0 1.5px var(--ac-ink); }

/* Foot: the rule checkbox · the countdown · the answers */
.ac-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; margin-top: 16px; padding-top: 14px;
  border-top: 1px solid var(--ac-line); }
.ac-always { display: flex; align-items: flex-start; gap: 8px; min-width: 0; max-width: 100%; color: var(--ac-text);
  cursor: pointer; user-select: none; }
.ac-always-label { min-width: 0; overflow-wrap: anywhere; }
.ac-box { position: relative; display: grid; flex: none; width: 16px; height: 16px; margin-top: 1.5px; }
.ac-box input { appearance: none; -webkit-appearance: none; width: 16px; height: 16px; margin: 0; border-radius: 5px;
  background: var(--ac-bg); box-shadow: inset 0 0 0 1px var(--ac-box); cursor: pointer;
  transition: background-color 160ms ease, box-shadow 160ms ease; }
.ac-box input:checked { background: var(--ac-primary); box-shadow: inset 0 0 0 1px var(--ac-primary); }
.ac-box input:disabled { cursor: not-allowed; }
.ac-box svg { position: absolute; inset: 0; width: 16px; height: 16px; fill: none; stroke: var(--ac-primary-ink); stroke-width: 1.8;
  stroke-linecap: round; stroke-linejoin: round; opacity: 0; transform: scale(0.6); pointer-events: none;
  transition: opacity 160ms ease, transform 260ms var(--ac-ease); }
.ac-box input:checked + svg { opacity: 1; transform: none; }
.ac-expires { display: inline-flex; align-items: center; gap: 6px; min-width: 0; color: var(--ac-muted); font-size: 12.5px;
  font-variant-numeric: tabular-nums; white-space: nowrap; transition: color 300ms ease; }
.ac-expires svg { width: 14px; height: 14px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round;
  stroke-linejoin: round; }
.ac-expires[data-low] { color: var(--ac-low); }
.ac-actions { display: flex; flex: 0 1 auto; flex-wrap: wrap; justify-content: flex-end; gap: 4px; min-width: 0; margin-left: auto; }
.ac-btn { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 34px;
  padding: 0 12px; border-radius: 10px; font-size: 13px; font-weight: 500; line-height: 1; white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 160ms ease, box-shadow 160ms ease, transform 160ms var(--ac-ease), opacity 160ms ease; }
.ac-btn:active:not([aria-disabled="true"]), .ac-opt:active:not([aria-disabled="true"]) { transform: scale(0.97); }
.ac-primary { padding-right: 8px; background: var(--ac-primary); color: var(--ac-primary-ink);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--text) 12%, transparent); }
.ac-quiet { padding-right: 8px; color: var(--ac-ink); }
.ac-ghost { color: var(--ac-text); }
.ac-kbd { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 6px;
  background: var(--ac-kbd); color: var(--ac-muted); font: inherit; font-size: 11px; font-weight: 500; line-height: 1; }
.ac-primary .ac-kbd { background: var(--ac-kbd-on); color: var(--ac-kbd-on-ink); }
.ac-btn[aria-disabled="true"], .ac-opt[aria-disabled="true"] { cursor: not-allowed; opacity: 0.5; }
.ac-btn.is-busy, .ac-opt.is-busy { cursor: progress; opacity: 1; }
.ac[data-status="sending"] .ac-always { opacity: 0.5; }
.ac-spin { width: 20px; height: 14px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round;
  stroke-dasharray: 26 38; transform-origin: 50% 50%; animation: ac-spin 800ms linear infinite; }
.ac-opt .ac-spin { position: absolute; top: 12px; right: 10px; width: 14px; }

/* Under the foot: why the answers are locked, or why the last answer failed (+ Retry) */
.ac-lock { margin: 10px 0 0; color: var(--ac-muted); font-size: 12.5px; line-height: 18px; overflow-wrap: anywhere; }
.ac-error { display: flex; align-items: center; gap: 8px; margin-top: 12px; padding: 7px 7px 7px 11px; border-radius: 9px;
  background: color-mix(in srgb, var(--st-fail) 7%, var(--surface));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--st-fail) 24%, transparent); }
.ac-error-text { flex: 1; min-width: 0; margin: 0; color: var(--st-fail-text); font-size: 12.5px; line-height: 18px;
  overflow-wrap: anywhere; }
.ac-retry { flex: none; height: 28px; gap: 5px; padding: 0 10px 0 8px; border-radius: 8px; background: var(--ac-bg);
  box-shadow: inset 0 0 0 1px var(--ac-line); color: var(--ac-ink); font-size: 12.5px; }
.ac-retry svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round;
  stroke-linejoin: round; }

/* Resolved: one row — the mark draws itself in */
.ac-row { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 12px 14px; }
.ac-row.is-enter { animation: ac-in 420ms var(--ac-ease) 120ms both; }
.ac-mark { display: grid; flex: none; place-items: center; width: 22px; height: 22px; border-radius: 50%;
  background: color-mix(in srgb, var(--st-done) 14%, transparent); color: var(--st-done); }
.ac-row:not([data-outcome="approved"]):not([data-outcome="answered"]) .ac-mark { background: var(--ac-neutral); color: var(--ac-text); }
.ac-mark svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round;
  stroke-linejoin: round; }
.ac-row.is-enter .ac-mark { animation: ac-pop 460ms var(--ac-ease) 140ms both; }
.ac-row.is-enter .ac-mark path { stroke-dasharray: 1; stroke-dashoffset: 1; animation: ac-draw 420ms var(--ac-ease) 300ms forwards; }
.ac-row-title { flex: 1 1 auto; min-width: 0; overflow: hidden; color: var(--ac-ink); font-size: 13.5px; font-weight: 500;
  white-space: nowrap; text-overflow: ellipsis; }
.ac-row-status { flex: 0 1 auto; min-width: 0; overflow: hidden; color: var(--ac-muted); white-space: nowrap; text-overflow: ellipsis; }
/* An answered question keeps its answer readable: on a second line under the question */
.ac-row[data-kind="question"] { display: grid; grid-template-columns: 22px minmax(0, 1fr); column-gap: 10px; row-gap: 1px; }
.ac-row[data-kind="question"] .ac-row-status { grid-column: 2; white-space: normal; overflow-wrap: anywhere; }

@keyframes ac-out { to { opacity: 0; transform: translateY(-6px) scale(0.985); filter: blur(2px); } }
@keyframes ac-in { from { opacity: 0; transform: translateY(4px); filter: blur(2px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes ac-pop { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: none; } }
@keyframes ac-draw { to { stroke-dashoffset: 0; } }
@keyframes ac-spin { to { transform: rotate(360deg); } }

/* Narrow cards: the answers share a full-width row and the key hints go; below 340px the badge drops “risk” */
@container ac (max-width: 400px) {
  .ac-actions { flex: 1 1 100%; margin-left: 0; }
  .ac-actions .ac-btn { flex: 1 1 0; min-width: 0; padding: 0 10px; }
  .ac-kbd { display: none; }
}
@container ac (max-width: 340px) {
  .ac-main { padding: 14px; }
  .ac-head { gap: 10px; }
  .ac-risk-word { display: none; }
  .ac-row-time { display: none; }
  .ac-details { column-gap: 12px; }
}
@media (hover: none) {
  .ac-kbd { display: none; }
  .ac-primary, .ac-quiet { padding-right: 12px; }
}
@media (hover: hover) {
  .ac-primary:not([aria-disabled="true"]):hover { background: var(--ac-primary-hover); }
  .ac-quiet:not([aria-disabled="true"]):hover, .ac-ghost:not([aria-disabled="true"]):hover { background: var(--ac-hover); color: var(--ac-ink); }
  .ac-retry:hover { background: var(--ac-hover); }
  .ac-opt:not([aria-disabled="true"]):not([aria-checked="true"]):hover { background: var(--ac-hover); }
  .ac-box input:not(:checked):not(:disabled):hover { box-shadow: inset 0 0 0 1px var(--ac-box-hover); }
}
/* Touch: every control gets a 44px target */
@media (pointer: coarse) {
  .ac-btn { height: 44px; }
  .ac-retry { height: 36px; }
  .ac-retry::before { content: ""; position: absolute; inset: -4px; }
  .ac-opt { min-height: 44px; }
  .ac-always { align-items: center; min-height: 44px; }
  .ac-box { margin-top: 0; }
  .ac-other input { height: 44px; font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .ac { transition: none; }
  .ac-spin { animation-duration: 1.6s !important; animation-iteration-count: infinite !important; }
  .ac-row.is-enter .ac-mark path { stroke-dashoffset: 0; }
}
`;
