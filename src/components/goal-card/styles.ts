/**
 * Goal card, drawn in the library language: a quiet section (or a 12px card with `variant="card"`), status as a
 * tinted pill with icon + word, accent only on the progress fill, one ink primary (Add), neutral bordered actions,
 * the two-press arm in its tone tint, the history region on the 0fr → 1fr recipe. Tints are color-mix() of tokens.
 */
const tint = (tone: string) => `color-mix(in srgb, var(--st-${tone}) 14%, var(--ib-card))`;
const ink = (tone: string) => `color-mix(in srgb, var(${tone}) 70%, var(--ib-text))`;
const TONES: Array<[name: string, base: string, text: string]> = [
  ['run', 'run', '--st-run'],
  ['wait', 'wait', '--st-wait'],
  ['done', 'done', '--st-done'],
  ['fail', 'fail', '--st-fail-text'],
];

export const styles = `
[hidden] { display: none !important; }
button { appearance: none; margin: 0; border: 0; background: none; letter-spacing: inherit; -webkit-tap-highlight-color: transparent; }
textarea { margin: 0; letter-spacing: inherit; }

.gc { container: gc / inline-size; min-width: 0; border-radius: 8px; font-size: 13px; line-height: 1.45; letter-spacing: -0.006em; color: var(--ib-text); }
/* Korean breaks between words, not inside them (long unbroken strings still wrap: overflow-wrap anywhere). */
:host([lang="ko"]) .gc { word-break: keep-all; }
:host([variant="card"]) .gc { padding: 12px 14px 14px; border: 1px solid var(--ib-card-border); border-radius: 12px; background: var(--ib-card); box-shadow: var(--ib-shadow); }

/* Head: target · Goal · status pill */
.gc-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; min-height: 24px; }
.gc-title { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 650; color: var(--ib-text); }
.gc-title-i { flex: none; color: var(--ib-muted); }
.gc-chip { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px 0 6px; border-radius: 999px;
  background: var(--ib-pill); color: var(--ib-text-2); font-size: 12px; font-weight: 500; line-height: 1; white-space: nowrap;
  transition: color 300ms ease, background-color 300ms ease; }
.gc-chip > svg { flex: none; }
.gc-chip.is-quiet { height: auto; padding: 0; background: none; }
${TONES.map(([k, base, text]) => `.gc-chip[data-tone="${k}"] { background: ${tint(base)}; color: ${ink(text)}; }`).join('\n')}
${TONES.map(([k, , text]) => `.gc-chip.is-quiet[data-tone="${k}"] { background: none; color: ${ink(text)}; }`).join('\n')}

/* Error: the fail tint, above everything it is about */
.gc-error { display: flex; align-items: flex-start; gap: 8px; margin-top: 10px; padding: 8px 10px; border-radius: 8px;
  background: ${tint('fail')}; color: ${ink('--st-fail-text')}; font-size: 12.5px; line-height: 18px; }
.gc-error > svg { flex: none; margin-top: 2px; }
.gc-error-t { min-width: 0; overflow-wrap: anywhere; white-space: pre-wrap; }

/* Current goal: the objective folds to 3 lines; the text stays selectable */
.gc-cur { min-width: 0; }
.gc-obj { margin: 8px 0 0; font-size: 13.5px; line-height: 20px; color: var(--ib-text); white-space: pre-wrap; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden; user-select: text; cursor: text; }
.gc-obj[data-open] { display: block; -webkit-line-clamp: unset; line-clamp: none; overflow: visible; }
.gc-more { display: inline-flex; align-items: center; gap: 3px; min-height: 24px; margin: 2px 0 0 -6px; padding: 0 6px; border-radius: 6px;
  color: var(--ib-text-2); font-size: 12px; font-weight: 500; cursor: pointer;
  transition: color var(--dur-press) ease, background-color var(--dur-press) ease; }
.gc-more-i { flex: none; color: var(--ib-muted); transition: transform var(--dur-press) var(--ease-out); }
.gc-more[aria-expanded="true"] .gc-more-i { transform: rotate(180deg); }
.gc-empty { margin: 8px 0 0; font-size: 13px; line-height: 20px; color: var(--ib-muted); }

/* Progress: accent fill on a pill track; paused reads muted, ended reads in its tone */
.gc-prog { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
.gc-bar { position: relative; flex: 1; min-width: 40px; height: 4px; overflow: hidden; border-radius: 999px; background: var(--ib-pill); }
.gc-fill { position: absolute; inset: 0 auto 0 0; width: calc(var(--p, 0) * 100%); border-radius: inherit; background: var(--accent);
  transition: width var(--dur-move) var(--ease-out), background-color 300ms ease; }
.gc-prog[data-tone="wait"] .gc-fill, .gc-prog[data-tone="idle"] .gc-fill { background: var(--ib-muted); }
.gc-prog[data-tone="done"] .gc-fill { background: var(--st-done); }
.gc-prog[data-tone="fail"] .gc-fill { background: var(--st-fail); }
.gc-prog-t { flex: none; font-size: 12px; color: var(--ib-text-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
.gc-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0 6px; margin-top: 6px; font-size: 12px; color: var(--ib-muted); }
.gc-when { font-variant-numeric: tabular-nums; white-space: nowrap; }
.gc-dot { color: var(--ib-muted); }
/* Budget meta (continues 3/10, cost): quiet label, the value in tabular figures a shade darker */
.gc-kv { white-space: nowrap; }
.gc-kv .gc-v { color: var(--ib-text-2); font-variant-numeric: tabular-nums; }
/* A note under the goal (what the evaluator says is left): quiet prose behind a hairline */
.gc-note { margin: 8px 0 0; padding: 0 0 0 10px; border-left: 2px solid var(--ib-card-border); color: var(--ib-text-2);
  font-size: 12.5px; line-height: 18px; white-space: pre-wrap; overflow-wrap: anywhere; }

/* Actions: neutral bordered buttons; Delete in the fail text; the armed press in its tone tint */
.gc-acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.gc-btn, .gc-rm, .gc-add-btn { display: inline-flex; flex: none; align-items: center; justify-content: center; gap: 5px; box-sizing: border-box;
  min-height: 28px; border: 1px solid var(--ib-card-border); border-radius: 8px; background: var(--ib-card); color: var(--ib-text);
  font-size: 12.5px; font-weight: 500; line-height: 1.2; white-space: nowrap; cursor: pointer; user-select: none;
  transition: background-color var(--dur-press) ease, border-color var(--dur-press) ease, color var(--dur-press) ease, opacity var(--dur-press) ease, transform var(--dur-press) var(--ease-out); }
.gc-btn { padding: 0 10px 0 8px; }
.gc-btn > svg, .gc-rm > svg, .gc-add-btn > svg { flex: none; }
.gc-btn > svg { color: var(--ib-muted); }
.gc-btn.is-danger, .gc-btn.is-danger > svg { color: ${ink('--st-fail-text')}; }
.gc-btn[data-armed][data-act="complete"] { border-color: color-mix(in srgb, var(--st-done) 45%, var(--ib-card-border)); background: ${tint('done')}; color: ${ink('--st-done')}; }
.gc-btn[data-armed][data-act="complete"] > svg { color: inherit; }
.gc-btn[data-armed][data-act="delete"], .gc-rm[data-armed] { border-color: color-mix(in srgb, var(--st-fail) 45%, var(--ib-card-border)); background: ${tint('fail')}; color: ${ink('--st-fail-text')}; }
.gc-btn[data-armed] .gc-btn-t, .gc-rm[data-armed] .gc-btn-t { font-weight: 600; }
:is(.gc-btn, .gc-rm, .gc-add-btn)[aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; }
:is(.gc-btn, .gc-rm, .gc-add-btn)[aria-busy="true"] { opacity: 1; cursor: progress; }
.gc-spin { display: block; flex: none; width: 12px; height: 12px; margin: 1px; border: 1.5px solid var(--ib-card-border); border-top-color: currentColor; border-radius: 50%; }
@keyframes gc-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: no-preference) { .gc-spin { animation: gc-spin 900ms linear infinite; } }

/* Queue: numbered, each with a quiet remove */
.gc-q { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border); }
.gc-sub { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: var(--ib-muted); }
.gc-n { font-variant-numeric: tabular-nums; color: var(--ib-muted); font-weight: 500; }
.gc-q-list { display: flex; flex-direction: column; gap: 2px; margin: 6px 0 0; padding: 0; list-style: none; }
.gc-q-row { display: flex; align-items: flex-start; gap: 8px; min-height: 30px; padding: 4px 0; }
.gc-q-n { flex: none; width: 18px; height: 18px; margin-top: 1px; border-radius: 6px; background: var(--ib-pill); color: var(--ib-text-2);
  font-size: 11px; font-weight: 600; line-height: 18px; text-align: center; font-variant-numeric: tabular-nums; }
.gc-q-main { display: flex; flex: 1; flex-direction: column; gap: 1px; min-width: 0; }
.gc-q-text { font-size: 13px; line-height: 20px; color: var(--ib-text); white-space: pre-wrap; overflow-wrap: anywhere; }
.gc-q-main .gc-when { font-size: 12px; color: var(--ib-muted); }
/* Centred on the first line of its objective (row padding 4 + half a 20px line = half of 28px). */
.gc-rm { min-width: 28px; margin-top: -4px; padding: 0 7px; border-color: transparent; background: transparent; color: var(--ib-muted); }
.gc-rm[data-armed] { padding: 0 9px 0 7px; }

/* Add: a growing box and the one ink button */
.gc-add { margin-top: 12px; }
.gc-field { display: flex; align-items: flex-end; gap: 8px; }
.gc-input { display: block; flex: 1; box-sizing: border-box; min-width: 0; min-height: 32px; max-height: 140px; padding: 6px 10px;
  border: 1px solid var(--ib-card-border); border-radius: 8px; background: var(--ib-card); color: var(--ib-text);
  font-size: 13px; line-height: 18px; resize: none; overflow-y: auto; transition: border-color var(--dur-press) ease; }
.gc-input::placeholder { color: var(--ib-muted); opacity: 1; }
.gc-add-btn { min-height: 32px; padding: 0 12px 0 10px; border-color: var(--ib-text); background: var(--ib-text); color: var(--ib-card); }
.gc-hint { display: flex; justify-content: space-between; gap: 8px; margin-top: 5px; font-size: 11.5px; line-height: 16px; color: var(--ib-muted); }
.gc-count { margin-left: auto; font-variant-numeric: tabular-nums; }

/* History: the 0fr → 1fr disclosure, inert while closed */
.gc-hist { margin-top: 12px; padding-top: 4px; border-top: 1px solid var(--border); }
.gc-hist-head { display: flex; align-items: center; gap: 8px; width: calc(100% + 16px); min-height: 32px; margin: 0 -8px; padding: 6px 8px;
  border-radius: 8px; color: var(--ib-text); font-size: 13px; font-weight: 600; line-height: 1.35; text-align: left; cursor: pointer;
  transition: background-color var(--dur-press) ease; }
.gc-hist-head .gc-n { margin-left: auto; font-size: 12px; }
.gc-chev { flex: none; color: var(--ib-muted); transition: transform var(--dur-press) var(--ease-out); }
.gc-hist[data-open] .gc-chev { transform: rotate(90deg); }
.gc-hist-region { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--dur-expand) var(--ease-out); }
.gc-hist[data-open] .gc-hist-region { grid-template-rows: 1fr; }
.gc-hist-inner { min-height: 0; overflow: hidden; opacity: 0; visibility: hidden;
  transition: opacity var(--dur-expand) var(--ease-out), visibility 0s linear var(--dur-expand); }
.gc-hist[data-open] .gc-hist-inner { opacity: 1; visibility: visible; transition: opacity var(--dur-expand) var(--ease-out), visibility 0s; }
.gc-h-list { display: flex; flex-direction: column; gap: 10px; margin: 4px 0 6px; padding: 0 0 0 20px; list-style: none; }
.gc-h-top { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; }
.gc-h-top .gc-when { font-size: 12px; color: var(--ib-muted); }
.gc-h-obj { margin: 2px 0 0; font-size: 13px; line-height: 19px; color: var(--ib-text-2); white-space: pre-wrap; overflow-wrap: anywhere; }
.gc-h-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0 6px; margin-top: 3px; font-size: 12px; line-height: 17px; color: var(--ib-muted); }
.gc-h-note { margin: 4px 0 0; padding: 0 0 0 10px; border-left: 2px solid var(--ib-card-border); color: var(--ib-muted);
  font-size: 12px; line-height: 17px; white-space: pre-wrap; overflow-wrap: anywhere; }

/* Press: scale .97 (never with a keyboard ring); hover: colour and border only, fine pointers only */
:is(.gc-btn, .gc-rm, .gc-add-btn, .gc-more):active:not([aria-disabled="true"]):not(:focus-visible) { transform: scale(0.97); }
@media (hover: hover) and (pointer: fine) {
  .gc-btn:hover:not([aria-disabled="true"]) { border-color: var(--ib-muted); }
  .gc-btn.is-danger:hover:not([aria-disabled="true"]):not([data-armed]) { border-color: var(--st-fail); background: ${tint('fail')}; }
  .gc-rm:hover:not([aria-disabled="true"]):not([data-armed]) { background: var(--ib-pill); color: ${ink('--st-fail-text')}; }
  .gc-add-btn:hover:not([aria-disabled="true"]) { opacity: 0.88; }
  .gc-more:hover { background: var(--ib-pill); color: var(--ib-text); }
  .gc-hist-head:hover { background: var(--ib-pill); }
  .gc-input:hover:not(:focus) { border-color: var(--ib-muted); }
}
/* 44px targets on touch and narrow screens; 16px text in the box so iOS does not zoom */
@media (pointer: coarse), (max-width: 639px) {
  .gc-btn, .gc-add-btn, .gc-more, .gc-hist-head { min-height: 44px; }
  .gc-rm { min-width: 44px; min-height: 44px; margin-top: -8px; }
  .gc-input { min-height: 44px; padding: 11px 12px; font-size: 16px; line-height: 20px; }
  .gc-hint-t { display: none; }
}
@container gc (max-width: 300px) {
  .gc-add-btn .gc-btn-t { display: none; }
  .gc-add-btn { padding: 0 9px; }
}
/* Reduced motion: nothing turns or scales; the region fades only */
@media (prefers-reduced-motion: reduce) {
  .gc-more-i, .gc-chev, .gc-hist-region, .gc-fill { transition: none !important; }
  :is(.gc-btn, .gc-rm, .gc-add-btn, .gc-more):active:not([aria-disabled="true"]):not(:focus-visible) { transform: none; }
  .gc-hist-inner { transition: opacity 120ms ease, visibility 0s linear 120ms !important; }
  .gc-hist[data-open] .gc-hist-inner { transition: opacity 120ms ease, visibility 0s !important; }
}
`;
