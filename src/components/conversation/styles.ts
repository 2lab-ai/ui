/**
 * A conversation in a `<ui-log-scroller>`: flat turns on neutral 24px glyph tiles (no coloured rails), the
 * instruction on a quiet tint, the answer in a flat `<ui-ai-answer>`, system turns as one 24px line that opens with
 * the board's expansion recipe (grid rows 0fr → 1fr + fade on --dur-expand, inert while closed). Hover changes colour
 * only; press scales 0.97; reduced motion keeps fades and drops every transform and loop.
 */
export const styles = `
:host { display: flex; flex-direction: column; min-height: 0; }
.ui-root { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; }
.cv-log { flex: 1 1 auto; min-height: 0; }
/* layout="page": as tall as the turns — the page scrolls (the scroller is told the same). */
:host([layout="page"]), :host([layout="page"]) .ui-root, :host([layout="page"]) .cv-log { display: block; }

/* Error bar above the turns; the error box (no turns) and the empty state sit in the scroller's state slot. */
.cv-errbar {
  flex: none; display: flex; align-items: center; gap: 8px; margin: 0 0 8px; padding: 5px 5px 5px 12px; min-height: 40px;
  border: 1px solid color-mix(in srgb, var(--st-fail) 35%, var(--ib-card-border)); border-radius: 12px;
  background: color-mix(in srgb, var(--st-fail) 7%, var(--ib-card)); color: var(--ib-text); font-size: 12.5px; line-height: 1.4;
}
.cv-errbar[hidden] { display: none; }
.cv-errbar > svg, .cv-fail > svg { flex: none; width: 16px; height: 16px; color: color-mix(in srgb, var(--st-fail) 75%, var(--ib-text)); }
.cv-err-text { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
.cv-err-detail { color: var(--ib-muted); }
.cv-state { display: grid; justify-items: center; gap: 8px; max-width: 340px; color: var(--ib-muted); font-size: 13px; line-height: 1.45; text-align: center; }
.cv-state > svg { width: 20px; height: 20px; }
.cv-fail { color: var(--ib-text-2); }
.cv-fail > svg { width: 20px; height: 20px; }
.cv-btn {
  flex: none; display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 4px 12px; border: 1px solid var(--ib-card-border);
  border-radius: 8px; background: var(--ib-card); color: var(--ib-text); font-size: 12.5px; font-weight: 500; line-height: 1.2;
  -webkit-tap-highlight-color: transparent;
  transition: background-color var(--dur-press) ease, border-color var(--dur-press) ease, transform var(--dur-press) var(--ease-out);
}
.cv-btn svg { flex: none; width: 13px; height: 13px; }

/* Turns. */
.cv-turn {
  container: cvturn / inline-size; display: grid; grid-template-columns: 24px minmax(0, 1fr); align-items: start; column-gap: 10px;
  margin: 2px 8px; padding: 10px 6px; border-radius: 12px;
}
.cv-turn[data-role="user"] { background: color-mix(in srgb, var(--ib-pill) 55%, transparent); padding-inline: 8px; margin-inline: 6px; }
.cv-turn[data-role="system"] { padding-block: 4px; }
.cv-av {
  display: grid; place-items: center; width: 24px; height: 24px; border: 1px solid var(--ib-card-border); border-radius: 6px;
  background: var(--ib-card); color: var(--ib-text-2); font-size: 11.5px; font-weight: 650; line-height: 1; user-select: none;
}
.cv-av svg { width: 14px; height: 14px; }
.cv-turn[data-role="user"] .cv-av {
  border-color: color-mix(in srgb, var(--accent) 24%, var(--ib-card-border)); background: color-mix(in srgb, var(--accent) 12%, var(--ib-card));
  color: color-mix(in srgb, var(--accent) 80%, var(--ib-text));
}
.cv-turn[data-role="system"] .cv-av { width: 20px; height: 20px; margin: 2px; border-color: transparent; background: var(--ib-pill); color: var(--ib-muted); }
.cv-turn[data-role="system"] .cv-av svg { width: 12px; height: 12px; }
.cv-main { min-width: 0; }
.cv-head { display: flex; align-items: center; gap: 8px; min-width: 0; min-height: 24px; color: var(--ib-muted); font-size: 12px; line-height: 1.3; }
.cv-name { min-width: 0; overflow: hidden; color: var(--ib-text); font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.cv-time { flex: none; font-size: 11.5px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.cv-took {
  flex: none; display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 7px; border-radius: 6px; background: var(--ib-pill);
  color: var(--ib-text-2); font-size: 11.5px; font-weight: 500; font-variant-numeric: tabular-nums; white-space: nowrap;
}
.cv-took svg { width: 11px; height: 11px; color: var(--ib-muted); }

/* selectable: a 16px checkbox leads every turn (ink when on, as the kit's switch); the writing row keeps the column. */
:host([selectable]) .cv-turn { grid-template-columns: 18px 24px minmax(0, 1fr); }
.cv-pick { position: relative; display: grid; place-items: center; width: 18px; height: 24px; margin: 0; }
.cv-pick::before { content: ""; position: absolute; inset: -10px -8px -10px -6px; }
.cv-pick-in {
  appearance: none; -webkit-appearance: none; width: 16px; height: 16px; margin: 0; border-radius: 5px; background: var(--ib-card);
  box-shadow: inset 0 0 0 1px var(--ib-card-border); cursor: pointer;
  transition: background-color var(--dur-press) ease, box-shadow var(--dur-press) ease;
}
.cv-pick-in:checked { background: var(--ib-text); box-shadow: inset 0 0 0 1px var(--ib-text); }
.cv-pick-in:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
.cv-pick svg {
  position: absolute; width: 16px; height: 16px; fill: none; stroke: var(--ib-card); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round;
  opacity: 0; transform: scale(0.8); pointer-events: none; transition: opacity var(--dur-press) ease, transform var(--dur-press) var(--ease-out);
}
.cv-pick-in:checked + svg { opacity: 1; transform: none; }
.cv-turn[data-selected] { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ib-text) 22%, transparent); }

/* User turn: media above the words, the words clamped, skill chips. */
.cv-media { min-width: 0; margin: 4px 0 6px; }
.cv-text { margin: 2px 0 0; color: var(--ib-text); font-size: 13.5px; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }
.cv-text[data-clamp]:not(.is-full) {
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: var(--cv-clamp, 12); line-clamp: var(--cv-clamp, 12); overflow: hidden;
}
.cv-more {
  display: inline-flex; align-items: center; gap: 4px; min-height: 28px; margin: 4px 0 0 -8px; padding: 3px 8px; border: 0; border-radius: 8px;
  background: none; color: var(--ib-text-2); font-size: 12px; font-weight: 500; line-height: 1.2; -webkit-tap-highlight-color: transparent;
  transition: background-color var(--dur-press) ease, color var(--dur-press) ease, transform var(--dur-press) var(--ease-out);
}
.cv-more svg { width: 12px; height: 12px; color: var(--ib-muted); }
.cv-more[hidden] { display: none; }
.cv-skills { min-width: 0; margin-top: 8px; }

/* Assistant turn. */
.cv-answer { min-width: 0; }
.cv-files { display: flex; flex-wrap: wrap; gap: 8px; min-width: 0; margin-top: 10px; }

/* Disclosures (Raw, a system turn's details). */
.cv-dbox { min-width: 0; }
.cv-disc {
  display: inline-flex; align-items: center; gap: 6px; min-height: 28px; margin: 6px 0 0 -6px; padding: 3px 9px 3px 6px; border: 0;
  border-radius: 8px; background: none; color: var(--ib-muted); font-size: 12px; font-weight: 500; line-height: 1.2;
  -webkit-tap-highlight-color: transparent;
  transition: background-color var(--dur-press) ease, color var(--dur-press) ease, transform var(--dur-press) var(--ease-out);
}
.cv-chev { flex: none; width: 12px; height: 12px; color: var(--ib-muted); transition: transform var(--dur-press) var(--ease-out); }
.cv-dbox[data-open] > .cv-disc .cv-chev, .cv-dbox[data-open] > .cv-sys .cv-chev { transform: rotate(90deg); }
.cv-region { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: 0fr; transition: grid-template-rows var(--dur-expand) var(--ease-out); }
.cv-dbox[data-open] > .cv-region { grid-template-rows: 1fr; }
.cv-region-in {
  min-height: 0; overflow: hidden; opacity: 0; visibility: hidden;
  transition: opacity var(--dur-expand) var(--ease-out), visibility 0s linear var(--dur-expand);
}
.cv-dbox[data-open] > .cv-region > .cv-region-in { opacity: 1; visibility: visible; transition: opacity var(--dur-expand) var(--ease-out), visibility 0s; }
.cv-dbox[data-open][data-settled] > .cv-region > .cv-region-in { overflow: visible; }
.cv-detail { margin: 6px 0 4px; padding: 10px 12px; border: 1px solid var(--ib-card-border); border-radius: 12px; background: var(--ib-card); }
.cv-tabs { display: inline-flex; gap: 2px; margin-bottom: 8px; padding: 2px; border-radius: 10px; background: var(--ib-seg); }
.cv-tab {
  min-height: 26px; padding: 2px 10px; border: 0; border-radius: 8px; background: none; color: var(--ib-text-2); font-size: 12px; font-weight: 500;
  line-height: 1.2; -webkit-tap-highlight-color: transparent;
  transition: background-color var(--dur-press) ease, color var(--dur-press) ease, transform var(--dur-press) var(--ease-out);
}
.cv-tab[aria-pressed="true"] { background: var(--ib-seg-on); color: var(--ib-text); font-weight: 600; box-shadow: var(--ib-shadow); }
.cv-raw-h { margin: 0 0 6px; color: var(--ib-muted); font-size: 11.5px; font-weight: 500; }

/* System turn: one line — name, time, badge, what happened — that opens to its facts and raw text. */
.cv-sys {
  display: flex; align-items: center; gap: 8px; width: calc(100% + 6px); min-width: 0; min-height: 24px; margin: 0 0 0 -6px; padding: 0 6px;
  border: 0; border-radius: 8px; background: none; color: var(--ib-muted); font-size: 12px; line-height: 1.3; text-align: left;
  -webkit-tap-highlight-color: transparent; transition: background-color var(--dur-press) ease;
}
.cv-sys .cv-name { flex: 0 1 auto; max-width: 8em; color: var(--ib-text-2); font-size: 12px; }
.cv-line { flex: 0 1 auto; min-width: 0; overflow: hidden; color: var(--ib-text-2); text-overflow: ellipsis; white-space: nowrap; }
.cv-sys .cv-chev { margin-left: auto; }
.cv-facts { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 4px 12px; margin: 0; font-size: 12px; line-height: 1.45; }
.cv-facts dt { color: var(--ib-muted); font-weight: 500; }
.cv-facts dd { margin: 0; color: var(--ib-text); font-variant-numeric: tabular-nums; white-space: pre-wrap; overflow-wrap: anywhere; }
.cv-facts + .cv-sysraw { margin-top: 12px; }
/* A system turn's media (the files an intercepted message carried) heads its detail */
.cv-detail .cv-media { margin: 0; }
.cv-detail .cv-media + :is(.cv-facts, .cv-sysraw) { margin-top: 12px; }

/* Progress of a long operation: verb, bar, elapsed / estimate, percent — ticking in place. */
.cv-prog { display: flex; align-items: center; gap: 8px; min-width: 0; min-height: 22px; color: var(--ib-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.cv-prog-verb { flex: 0 1 auto; min-width: 0; overflow: hidden; color: var(--ib-text-2); font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.cv-bar { flex: 0 1000 120px; min-width: 24px; max-width: 120px; height: 4px; border-radius: 2px; background: var(--ib-pill); overflow: hidden; }
.cv-bar > i { display: block; height: 100%; border-radius: inherit; background: var(--accent); transition: width 1s linear; }
.cv-bar[data-indet] > i {
  width: 100% !important; background: linear-gradient(90deg, transparent, var(--accent), transparent) no-repeat; background-size: 40% 100%;
  animation: cv-sweep 1.4s linear infinite;
}
.cv-prog-time, .cv-pct { flex: none; white-space: nowrap; }
.cv-over { flex: 0 1 auto; min-width: 0; overflow: hidden; color: color-mix(in srgb, var(--st-wait) 70%, var(--ib-text)); text-overflow: ellipsis; white-space: nowrap; }
.cv-over[hidden], .cv-pct[hidden] { display: none; }
@container cvturn (max-width: 340px) { .cv-sys .cv-name, .cv-prog-verb { display: none; } }
@container cvturn (max-width: 280px) { .cv-pct, .cv-over { display: none; } }

/* Skeleton: three turn shapes (first page on its way). */
.cv-sk { display: grid; gap: 18px; width: 100%; padding: 2px; }
.cv-sk-turn { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 10px; }
.cv-sk-av { width: 24px; height: 24px; border-radius: 6px; background: var(--ib-pill); animation: cv-sk 1.6s ease-in-out infinite; }
.cv-sk-lines { display: grid; gap: 8px; padding-top: 3px; }
.cv-sk-line { display: block; height: 10px; border-radius: 6px; background: var(--ib-pill); animation: cv-sk 1.6s ease-in-out infinite; }
.cv-sk-turn:nth-child(2) > *, .cv-sk-turn:nth-child(2) .cv-sk-line { animation-delay: 120ms; }
.cv-sk-turn:nth-child(3) > *, .cv-sk-turn:nth-child(3) .cv-sk-line { animation-delay: 240ms; }

.cv-more:active:not(:focus-visible), .cv-disc:active:not(:focus-visible), .cv-tab:active:not(:focus-visible), .cv-btn:active:not(:focus-visible) {
  transform: scale(0.97);
}
button.cv-sys:active { background: var(--ib-pill); }
@media (hover: hover) and (pointer: fine) {
  .cv-pick-in:not(:checked):hover { box-shadow: inset 0 0 0 1px var(--ib-muted); }
  .cv-more:hover, .cv-disc:hover { background: var(--ib-pill); color: var(--ib-text); }
  button.cv-sys:hover { background: color-mix(in srgb, var(--ib-pill) 60%, transparent); }
  button.cv-sys:hover .cv-line { color: var(--ib-text); }
  .cv-tab:not([aria-pressed="true"]):hover { color: var(--ib-text); }
  .cv-btn:hover { border-color: var(--ib-muted); }
}
@media (pointer: coarse), (max-width: 639px) {
  .cv-more, .cv-disc, .cv-btn, .cv-tab { min-height: 44px; }
  button.cv-sys { min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .cv-more:active, .cv-disc:active, .cv-tab:active, .cv-btn:active { transform: none; }
  .cv-region, .cv-chev, .cv-bar > i, .cv-pick-in, .cv-pick svg { transition: none !important; }
  .cv-pick svg { transform: none; }
  .cv-region-in { transition: opacity 120ms ease, visibility 0s linear 120ms !important; }
  .cv-dbox[data-open] > .cv-region > .cv-region-in { transition: opacity 120ms ease, visibility 0s !important; }
  .cv-bar[data-indet] > i { animation: none; background: color-mix(in srgb, var(--accent) 45%, transparent); }
  .cv-sk-av, .cv-sk-line { animation: none; }
}
@keyframes cv-sweep { from { background-position: -40% 0; } to { background-position: 140% 0; } }
@keyframes cv-sk { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
`;
