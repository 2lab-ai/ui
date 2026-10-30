/**
 * Choice Form. The board's tray (`--ib-col`) holding white question cards (`--ib-card`, 12px, hairline + `--ib-shadow`)
 * — the agent-run question card in a stack. Recommended = an accent-tinted hairline plus a small accent dot and word
 * (never a star, never green); selected = the raised neutral chip (`--ib-seg-on` + `--ib-shadow`) with a check; one
 * ink Submit. Cards fold with the expand recipe (grid rows 0fr → 1fr + opacity on --dur-expand, inert while closed).
 * Every colour is a token or a color-mix() of tokens, so light and dark both read.
 */
export const styles = `
:host { display: block; min-width: 0; font-size: 13px; line-height: 1.45; letter-spacing: -0.006em; }
button { appearance: none; margin: 0; border: 0; background: none; text-align: left; letter-spacing: inherit;
  -webkit-tap-highlight-color: transparent; }
input { letter-spacing: inherit; }

.cf { container: cf / inline-size; position: relative; min-width: 0; padding: 12px; border: 1px solid var(--ib-card-border);
  border-radius: 16px; background: var(--ib-col); color: var(--ib-text); }
.cf[data-mode="single"] { padding: 4px; border-radius: 14px; }

/* ── Head: title + markdown description · progress dots + “2 of 4 answered” ── */
.cf-head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 6px 16px;
  padding: 2px 2px 12px; }
.cf-titles { flex: 1 1 240px; min-width: 0; }
.cf-titles:empty { display: none; }
.cf-title { color: var(--ib-text); font-size: 15px; font-weight: 650; line-height: 22px; letter-spacing: -0.01em;
  overflow-wrap: anywhere; }
.cf-desc { margin-top: 2px; color: var(--ib-text-2); font-size: 13px; line-height: 1.5; }
.cf[data-mode="single"] .cf-head { padding: 4px 8px 6px; }
.cf[data-mode="single"] .cf-title { color: var(--ib-muted); font-size: 12px; font-weight: 500; line-height: 16px; letter-spacing: 0; }
.cf-progress { display: inline-flex; flex: none; align-items: center; gap: 10px; min-height: 22px; }
.cf-dots { display: inline-flex; align-items: center; gap: 4px; }
.cf-dot { display: block; width: 6px; height: 6px; border-radius: 999px; background: var(--ib-pill);
  transition: width var(--dur-move) var(--ease-out), background-color var(--dur-fade) ease, box-shadow var(--dur-fade) ease; }
.cf-dot[data-state="answered"] { background: var(--accent); }
.cf-dot[data-state="current"] { width: 16px; background: color-mix(in srgb, var(--accent) 16%, var(--ib-card));
  box-shadow: inset 0 0 0 1.5px var(--accent); }
.cf-progress-text { color: var(--ib-muted); font-size: 12px; font-weight: 500; white-space: nowrap; font-variant-numeric: tabular-nums; }

/* ── Hero: Submit all recommended (a quiet bordered row — Submit stays the one ink button) ── */
.cf-hero { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 40px; margin: 0 0 10px; padding: 9px 12px 9px 14px;
  border: 1px solid var(--ib-card-border); border-radius: 12px; background: var(--ib-card); box-shadow: var(--ib-shadow);
  color: var(--ib-text); font-size: 13.5px; font-weight: 600; line-height: 18px;
  transition: border-color var(--dur-press) ease, background-color var(--dur-press) ease, color var(--dur-press) ease,
    transform var(--dur-press) var(--ease-out); }
.cf-hero-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent); }
.cf-hero-label { flex: 0 1 auto; min-width: 0; overflow-wrap: anywhere; }
.cf-hero-meta { flex: 1 1 auto; min-width: 0; color: var(--ib-muted); font-size: 12px; font-weight: 500; text-align: right;
  font-variant-numeric: tabular-nums; }
.cf-hero-arrow { flex: none; color: var(--ib-muted); }
.cf-hero > .cf-spin { margin-left: 2px; }
.cf-hero[aria-disabled="true"] { background: transparent; box-shadow: none; color: var(--ib-text-2); cursor: not-allowed; }
.cf-hero[aria-disabled="true"] .cf-hero-dot { background: transparent; box-shadow: inset 0 0 0 1.5px var(--ib-muted); }
.cf-hero[aria-disabled="true"] .cf-hero-arrow { opacity: 0.4; }
.cf-hero[aria-busy="true"] { cursor: progress; }

/* ── Question cards ── */
.cf-list { display: flex; flex-direction: column; gap: 8px; }
.cf-q { position: relative; min-width: 0; padding: 12px 14px; border: 1px solid var(--ib-card-border); border-radius: 12px;
  background: var(--ib-card); box-shadow: var(--ib-shadow); transition: border-color var(--dur-fade) ease; }
.cf-q[data-state="current"] { border-color: color-mix(in srgb, var(--ib-text) 24%, var(--ib-card-border)); }
.cf[data-mode="single"] .cf-q { padding: 14px; border: 0; border-radius: 11px; box-shadow: 0 0 0 1px var(--ib-card-border); }
.cf-q-head { display: flex; align-items: flex-start; gap: 10px; }
.cf-num { display: inline-grid; flex: none; place-items: center; width: 22px; height: 22px; margin-top: -1px; border-radius: 50%;
  background: var(--ib-pill); color: var(--ib-text-2); font-size: 12px; font-weight: 600; line-height: 1;
  font-variant-numeric: tabular-nums; transition: background-color var(--dur-fade) ease, color var(--dur-fade) ease, box-shadow var(--dur-fade) ease; }
.cf-num svg { width: 12px; height: 12px; }
.cf-q[data-state="current"] .cf-num { background: color-mix(in srgb, var(--accent) 12%, var(--ib-card));
  box-shadow: inset 0 0 0 1.5px var(--accent); color: color-mix(in srgb, var(--accent) 70%, var(--ib-text)); }
.cf-q[data-state="answered"] .cf-num { background: var(--ib-seg-on); box-shadow: var(--ib-shadow), inset 0 0 0 1px var(--ib-card-border);
  color: var(--ib-text); }
.cf-q-title { flex: 1 1 auto; min-width: 0; padding-top: 1px; color: var(--ib-text); font-size: 13.5px; font-weight: 600;
  line-height: 20px; white-space: pre-line; overflow-wrap: anywhere; }
.cf-ctx { margin: 6px 0 0 32px; color: var(--ib-text-2); font-size: 12.5px; line-height: 1.55; }
.cf[data-mode="single"] .cf-ctx { margin-left: 0; }

/* ── Markdown context (answerMarkdown) — a small prose sheet ── */
.cf-md { min-width: 0; overflow-wrap: anywhere; }
.cf-md > :first-child { margin-top: 0; }
.cf-md > :last-child { margin-bottom: 0; }
.cf-md p, .cf-md ul, .cf-md ol, .cf-md pre, .cf-md blockquote, .cf-md .md-table { margin: 0 0 0.6em; }
.cf-md h1, .cf-md h2, .cf-md h3, .cf-md h4, .cf-md h5, .cf-md h6 { margin: 0.8em 0 0.3em; color: var(--ib-text); font-size: 1em;
  font-weight: 600; line-height: 1.35; }
.cf-md ul, .cf-md ol { padding-left: 1.3em; }
.cf-md li + li { margin-top: 0.15em; }
.cf-md li > ul, .cf-md li > ol { margin: 0.15em 0 0; }
.cf-md strong { color: var(--ib-text); font-weight: 600; }
.cf-md code { padding: 0.1em 0.35em; border-radius: 5px; background: var(--ib-pill); color: var(--ib-text); font-family: var(--mono);
  font-size: 0.92em; letter-spacing: 0; }
.cf-md pre { max-height: 240px; overflow: auto; padding: 8px 10px; border-radius: 8px; background: var(--ib-col);
  box-shadow: inset 0 0 0 1px var(--ib-card-border); }
.cf-md pre code { padding: 0; background: none; font-size: 12px; line-height: 1.55; white-space: pre; }
.cf-md a { color: var(--accent); text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--accent) 40%, transparent);
  text-underline-offset: 2px; }
.cf-md blockquote { padding-left: 10px; border-left: 2px solid var(--ib-card-border); }
.cf-md hr { margin: 0.8em 0; border: 0; border-top: 1px solid var(--ib-card-border); }
.cf-md .md-table { overflow-x: auto; }
.cf-md table { border-collapse: collapse; font-size: 0.95em; }
.cf-md th, .cf-md td { padding: 4px 8px; border: 1px solid var(--ib-card-border); text-align: left; vertical-align: top; }
.cf-md th { background: var(--ib-col); font-weight: 600; }

/* ── Expand regions: the answer row and the choices trade places (0fr → 1fr + fade, inert while closed) ── */
.cf-x { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: 0fr; transition: grid-template-rows var(--dur-expand) var(--ease-out); }
.cf-x[data-open] { grid-template-rows: 1fr; }
.cf-x-in { min-width: 0; min-height: 0; overflow: hidden; opacity: 0; visibility: hidden;
  transition: opacity var(--dur-expand) var(--ease-out), visibility 0s linear var(--dur-expand); }
.cf-x[data-open] > .cf-x-in { opacity: 1; visibility: visible; transition: opacity var(--dur-expand) var(--ease-out), visibility 0s; }
.cf-x[data-open][data-settled] > .cf-x-in { overflow: visible; }

/* ── Answered: the raised neutral chip with a check · Change ── */
.cf-picked { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; padding: 10px 0 0 32px; }
.cf-chip { display: inline-flex; align-items: center; gap: 7px; min-width: 0; max-width: 100%; min-height: 30px; padding: 5px 10px 5px 8px;
  border-radius: 8px; background: var(--ib-seg-on); box-shadow: var(--ib-shadow), inset 0 0 0 1px var(--ib-card-border);
  color: var(--ib-text); font-size: 13px; font-weight: 500; line-height: 18px; }
.cf-chip-check { flex: none; }
.cf-chip-label { min-width: 0; overflow-wrap: anywhere; }
.cf-tag { display: inline-flex; flex: none; align-items: center; gap: 5px; height: 18px; padding: 0 6px; border-radius: 6px;
  background: var(--ib-pill); color: var(--ib-text-2); font-size: 11px; font-weight: 500; line-height: 1; white-space: nowrap;
  letter-spacing: 0; }
.cf-tag-rec, .cf-rec { background: color-mix(in srgb, var(--accent) 10%, var(--ib-card)); color: color-mix(in srgb, var(--accent) 70%, var(--ib-text)); }
.cf-rec-dot { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
.cf-change { display: inline-flex; flex: none; align-items: center; gap: 5px; min-height: 30px; padding: 0 9px; border-radius: 8px;
  color: var(--ib-text-2); font-size: 12.5px; font-weight: 500; line-height: 1;
  transition: background-color var(--dur-press) ease, color var(--dur-press) ease, transform var(--dur-press) var(--ease-out); }
.cf-change[aria-disabled="true"] { cursor: not-allowed; opacity: 0.5; }

/* ── Choices: key tile · label (+ Recommended) · description ── */
.cf-body { padding-top: 10px; }
.cf-choices { display: flex; flex-direction: column; gap: 6px; }
.cf-choice { position: relative; display: grid; grid-template-columns: 20px minmax(0, 1fr); align-items: start; column-gap: 10px;
  width: 100%; min-height: 40px; padding: 9px 12px 9px 10px; border-radius: 10px; background: var(--ib-card);
  box-shadow: inset 0 0 0 1px var(--ib-card-border); color: var(--ib-text); font-size: 13px; line-height: 18px;
  transition: background-color var(--dur-press) ease, box-shadow var(--dur-press) ease, opacity var(--dur-press) ease,
    transform var(--dur-press) var(--ease-out); }
.cf-choice[data-rec] { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 50%, var(--ib-card-border)); }
.cf-choice[aria-pressed="true"] { background: var(--ib-seg-on); box-shadow: var(--ib-shadow), inset 0 0 0 1.5px var(--ib-text); }
.cf-key { display: inline-grid; place-items: center; width: 20px; height: 20px; margin-top: -1px; border-radius: 6px;
  background: var(--ib-col); box-shadow: inset 0 0 0 1px var(--ib-card-border); color: var(--ib-muted); font-size: 11px;
  font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums;
  transition: background-color var(--dur-press) ease, color var(--dur-press) ease; }
.cf-key svg { width: 12px; height: 12px; }
.cf-choice[aria-pressed="true"] .cf-key { background: var(--ib-text); box-shadow: none; color: var(--ib-card); }
.cf-choice[aria-busy="true"] .cf-key { background: transparent; box-shadow: none; color: var(--ib-text); }
.cf-choice-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.cf-choice-label { font-weight: 500; overflow-wrap: anywhere; }
.cf-rec { display: inline-flex; align-items: center; gap: 5px; margin-left: 8px; padding: 1px 6px 1px 5px; border-radius: 6px;
  font-size: 11px; font-weight: 500; line-height: 16px; letter-spacing: 0; white-space: nowrap; vertical-align: 1px; }
.cf-choice-desc { color: var(--ib-text-2); font-size: 12px; line-height: 17px; overflow-wrap: anywhere; }
.cf-choice[aria-disabled="true"] { cursor: not-allowed; opacity: 0.55; }
.cf-choice[aria-busy="true"] { cursor: progress; opacity: 1; }

/* ── Own answer: input + Confirm (Enter confirms; empty says why) ── */
.cf-custom { display: flex; gap: 6px; margin-top: 8px; }
.cf-choices + .cf-custom { margin-top: 8px; }
.cf-body > .cf-custom:first-child { margin-top: 0; }
.cf-input { flex: 1 1 auto; min-width: 0; height: 34px; padding: 0 11px; border: 0; border-radius: 8px; background: var(--ib-card);
  box-shadow: inset 0 0 0 1px var(--ib-card-border); color: var(--ib-text); font-size: 13px;
  transition: box-shadow var(--dur-press) ease; }
.cf-input::placeholder { color: var(--ib-muted); }
.cf-input[aria-invalid="true"] { box-shadow: inset 0 0 0 1px var(--st-fail); }
.cf-input[readonly] { cursor: not-allowed; opacity: 0.55; }
.cf-invalid { display: flex; align-items: center; gap: 5px; margin: 6px 0 0; color: var(--st-fail-text); font-size: 12px; line-height: 16px; }
.cf-invalid svg { flex: none; }

/* ── Buttons: quiet Reset · bordered Confirm · the one ink Submit ── */
.cf-btn { position: relative; display: inline-flex; flex: none; align-items: center; justify-content: center; gap: 8px; min-height: 34px;
  padding: 0 12px; border-radius: 8px; font-size: 13px; font-weight: 500; line-height: 1; white-space: nowrap;
  transition: background-color var(--dur-press) ease, box-shadow var(--dur-press) ease, color var(--dur-press) ease,
    opacity var(--dur-press) ease, transform var(--dur-press) var(--ease-out); }
.cf-confirm { background: var(--ib-card); box-shadow: inset 0 0 0 1px var(--ib-card-border); color: var(--ib-text); }
.cf-reset { color: var(--ib-text-2); }
.cf-submit { padding-right: 8px; background: var(--ib-text); box-shadow: var(--ib-shadow); color: var(--ib-card); }
.cf-submit[aria-busy="true"] { padding-right: 12px; }
.cf-kbd { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 6px;
  background: color-mix(in srgb, var(--ib-card) 16%, transparent); color: color-mix(in srgb, var(--ib-card) 72%, transparent);
  font: inherit; font-size: 11px; font-weight: 500; line-height: 1; }
.cf-btn[aria-disabled="true"] { cursor: not-allowed; opacity: 0.5; }
.cf-btn[aria-busy="true"] { cursor: progress; opacity: 1; }

/* ── Foot: the error line · “Answer 2 more to submit” · Reset · Submit ── */
.cf-foot { margin-top: 12px; padding: 12px 2px 0; border-top: 1px solid var(--ib-card-border); }
.cf[data-mode="single"] .cf-foot { margin: 0; padding: 8px 8px 6px; border-top: 0; }
.cf-foot-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.cf-hint { flex: 1 1 auto; min-width: 0; color: var(--ib-muted); font-size: 12.5px; font-variant-numeric: tabular-nums; }
.cf-actions { display: flex; gap: 6px; margin-left: auto; }
.cf-error { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 10px; padding: 8px 10px; border-radius: 8px;
  background: color-mix(in srgb, var(--st-fail) 14%, var(--ib-card)); color: color-mix(in srgb, var(--st-fail-text) 70%, var(--ib-text));
  font-size: 12.5px; line-height: 18px; overflow-wrap: anywhere; }
.cf-error:last-child { margin-bottom: 0; }
.cf-error-icon { flex: none; margin-top: 2px; }

/* ── Submitted: a read-only summary ── */
.cf-done { padding: 12px 12px 12px; }
.cf-done.is-enter { animation: cf-in var(--dur-move) var(--ease-out) both; }
.cf-done-head { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; padding: 0 2px; font-size: 13.5px; font-weight: 600;
  line-height: 20px; }
.cf-done-mark { display: inline-grid; flex: none; place-items: center; width: 20px; height: 20px; border-radius: 50%;
  background: color-mix(in srgb, var(--st-done) 16%, var(--ib-card)); color: color-mix(in srgb, var(--st-done) 70%, var(--ib-text)); }
.cf-done-word { color: color-mix(in srgb, var(--st-done) 70%, var(--ib-text)); }
.cf-done-title { min-width: 0; color: var(--ib-text); overflow-wrap: anywhere; }
.cf-done-title::before { content: "·"; margin-right: 8px; color: var(--ib-muted); font-weight: 400; }
.cf-sum { display: grid; gap: 6px; margin: 10px 0 0; }
.cf-sum-row { display: grid; gap: 3px; min-width: 0; padding: 9px 12px; border-radius: 10px; background: var(--ib-card);
  box-shadow: 0 0 0 1px var(--ib-card-border); }
.cf-sum dt { display: flex; gap: 8px; min-width: 0; color: var(--ib-text-2); font-size: 12.5px; line-height: 18px; }
.cf-sum-num { flex: none; min-width: 14px; color: var(--ib-muted); font-variant-numeric: tabular-nums; }
.cf-sum-q { min-width: 0; white-space: pre-line; overflow-wrap: anywhere; }
.cf-sum dd { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; min-width: 0; margin: 0; color: var(--ib-text);
  font-size: 13px; font-weight: 500; line-height: 18px; overflow-wrap: anywhere; }
.cf-sum[data-numbered] dd { margin-left: 22px; }
.cf-none { color: var(--ib-muted); font-weight: 400; }

/* ── Spinner (one phase speed with the library: 0.9s) ── */
.cf-spin { display: inline-block; flex: none; width: 12px; height: 12px; border: 1.5px solid color-mix(in srgb, currentColor 25%, transparent);
  border-top-color: currentColor; border-right-color: currentColor; border-radius: 50%; animation: cf-spin 0.9s linear infinite; }

@keyframes cf-spin { to { transform: rotate(360deg); } }
@keyframes cf-in { from { opacity: 0; transform: translateY(4px); } }
@keyframes cf-fade { from { opacity: 0; } }

/* Press: scale .97 (not while a key drives it); hover: colour and border only, fine pointers only */
:is(.cf-choice, .cf-btn, .cf-hero, .cf-change):active:not([aria-disabled="true"]):not(:focus-visible) { transform: scale(0.97); }
@media (hover: hover) and (pointer: fine) {
  .cf-choice:not([aria-disabled="true"]):not([aria-pressed="true"]):hover { background: color-mix(in srgb, var(--ib-pill) 55%, var(--ib-card)); }
  .cf-hero:not([aria-disabled="true"]):hover { border-color: var(--ib-muted); }
  .cf-change:not([aria-disabled="true"]):hover, .cf-reset:not([aria-disabled="true"]):hover { background: var(--ib-pill); color: var(--ib-text); }
  .cf-confirm:not([aria-disabled="true"]):hover { box-shadow: inset 0 0 0 1px var(--ib-muted); }
  .cf-submit:not([aria-disabled="true"]):hover { opacity: 0.88; }
}
@media (hover: none) {
  .cf-kbd { display: none; }
  .cf-submit { padding-right: 12px; }
}

/* Narrow: the actions share a full-width row, the key hint goes, nothing is indented */
@container cf (max-width: 420px) {
  .cf-actions { flex: 1 1 100%; margin-left: 0; }
  .cf-actions .cf-btn { flex: 1 1 0; min-width: 0; }
  .cf-kbd { display: none; }
  .cf-submit { padding-right: 12px; }
  .cf-ctx { margin-left: 0; }
  .cf-picked { padding-left: 0; }
  .cf-hero { flex-wrap: wrap; row-gap: 2px; }
  .cf-hero-meta { order: 3; flex-basis: 100%; padding-left: 18px; text-align: left; }
  .cf-hero-arrow, .cf-hero > .cf-spin { margin-left: auto; }
  .cf-q { padding: 12px; }
}

/* Touch and small screens: every control gets a 44px target */
@media (pointer: coarse), (max-width: 639px) {
  .cf-choice, .cf-hero, .cf-btn, .cf-change { min-height: 44px; }
  .cf-input { height: 44px; font-size: 16px; }
}

@media (prefers-reduced-motion: reduce) {
  .cf-x { transition: none !important; }
  .cf-x-in { transition: opacity 120ms ease, visibility 0s linear 120ms !important; }
  .cf-x[data-open] > .cf-x-in { transition: opacity 120ms ease, visibility 0s !important; }
  .cf-done.is-enter { animation: cf-fade 160ms ease both !important; }
  :is(.cf-choice, .cf-btn, .cf-hero, .cf-change):active { transform: none !important; }
  .cf-spin { animation-duration: 1.6s !important; animation-iteration-count: infinite !important; }
}
`;
