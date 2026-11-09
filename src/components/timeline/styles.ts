/**
 * Timeline. Three columns — the time (tabular), the rail (a 2px line through round markers), the row card — so the
 * markers line up and the rail runs unbroken from the first item to the last. Row cards are a quiet wash of ink on
 * the card surface with a hairline edge; an overdue row trades the edge for the fail colour, the "now" row gets a
 * faint run wash. Status pills: a neutral pill tinted by the tone (scaled by --chroma) with a dot that keeps its
 * colour in mono. Under 480px of its own width the pill and actions drop under the title and the time column
 * narrows; on a coarse pointer the checkbox and the actions are 44px targets.
 */
export const styles = `
:host { min-width: 0; --tl-bg: var(--timeline-bg, var(--ib-card)); }
.ui-root { container: tl / inline-size; }
.tl { --tl-time-w: 52px; --tl-rail-w: 22px; --tl-line: color-mix(in srgb, var(--ib-text) 14%, transparent);
  --tl-ink: var(--ib-text); --tl-card: color-mix(in srgb, var(--ib-text) 2.5%, var(--ib-card));
  --tl-pill: color-mix(in srgb, var(--ib-text) 7%, var(--ib-card));
  color: var(--ib-text); font-size: 13px; line-height: 1.4; }
.tl-list { margin: 0; padding: 0; list-style: none; }

.tl-item { --tl-c: color-mix(in srgb, var(--ib-text) 34%, transparent); position: relative; display: grid;
  grid-template-columns: var(--tl-time-w) var(--tl-rail-w) minmax(0, 1fr); column-gap: 10px; align-items: center; }
.tl[data-notime] .tl-item { grid-template-columns: var(--tl-rail-w) minmax(0, 1fr); }
.tl-item[data-done] { --tl-c: var(--tl-ink); }
.tl-item[data-tone="done"] { --tl-c: var(--st-done); }
.tl-item[data-tone="run"] { --tl-c: var(--st-run); }
.tl-item[data-tone="wait"] { --tl-c: var(--st-wait); }
.tl-item[data-tone="fail"] { --tl-c: var(--st-fail); }

.tl-time { min-width: 0; font-size: 12.5px; font-weight: 500; color: var(--ib-text-2); white-space: nowrap;
  font-variant-numeric: tabular-nums; transition: color 200ms ease; }
.tl-item[aria-current] .tl-time { color: var(--ib-text); font-weight: 650; }
.tl-item[data-overdue] .tl-time { color: var(--st-fail-text); font-weight: 650; }

/* The rail: each row draws its half above and below its marker, so the line crosses the gaps between cards. */
.tl-rail { position: relative; align-self: stretch; min-height: 28px; }
.tl-rail::before, .tl-rail::after { content: ""; position: absolute; left: 50%; width: 2px; margin-left: -1px;
  border-radius: 1px; background: var(--tl-line); transition: background-color 300ms ease; }
.tl-rail::before { top: 0; bottom: 50%; }
.tl-rail::after { top: 50%; bottom: 0; }
.tl-item:first-child .tl-rail::before, .tl-item:last-child .tl-rail::after { display: none; }
.tl-item[data-up] .tl-rail::before, .tl-item[data-down] .tl-rail::after { background: var(--tl-ink); }
.tl-dot { position: absolute; z-index: 1; left: 50%; top: 50%; width: 14px; height: 14px; margin: -7px 0 0 -7px;
  border: 2px solid var(--tl-c); border-radius: 50%; background: var(--tl-bg); box-shadow: 0 0 0 3px var(--tl-bg);
  transition: background-color 200ms ease, border-color 200ms ease, box-shadow 200ms ease; }
.tl-item[data-done] .tl-dot { background: var(--tl-c); }
.tl-item[aria-current] .tl-dot { box-shadow: 0 0 0 3px var(--tl-bg), 0 0 0 6px color-mix(in srgb, var(--tl-c) 22%, transparent); }
/* Running and not done: a soft ring breathes out of the marker. Still under reduced motion. */
.tl-item[data-tone="run"]:not([data-done]) .tl-dot::after { content: ""; position: absolute; inset: -6px;
  border: 2px solid var(--tl-c); border-radius: 50%; opacity: 0; animation: tl-ping 2.2s var(--ease-out) infinite; }
@keyframes tl-ping { 0% { opacity: 0.55; transform: scale(0.55); } 80%, 100% { opacity: 0; transform: scale(1.25); } }
@media (prefers-reduced-motion: reduce) { .tl-item .tl-dot::after { animation: none; } }

/* The row card. */
.tl-card { display: flex; align-items: center; gap: 12px; min-width: 0; margin: 5px 0; padding: 10px 12px 10px 14px;
  border: 1px solid var(--ib-card-border); border-radius: 12px; background: var(--tl-card);
  transition: border-color 200ms ease, background-color 200ms ease; }
.tl-item[aria-current] .tl-card { border-color: color-mix(in srgb, var(--ib-text) 22%, var(--ib-card-border));
  background: color-mix(in srgb, var(--st-run) calc(6% * var(--chroma)), var(--tl-card)); }
.tl-item[data-overdue] .tl-card { border-color: var(--st-fail); }
.tl-main { flex: 1 1 0; min-width: 0; }
.tl-title { display: block; font-size: 13.5px; font-weight: 600; line-height: 1.35; color: var(--ib-text);
  overflow-wrap: anywhere; }
.tl-detail { display: block; margin-top: 2px; overflow: hidden; font-size: 12px; line-height: 1.35; color: var(--ib-muted);
  white-space: nowrap; text-overflow: ellipsis; }
.tl-meta { display: flex; flex: none; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 4px 6px;
  min-width: 0; }

.tl-status { --tl-s: var(--ib-muted); display: inline-flex; align-items: center; gap: 6px; max-width: 100%; height: 22px;
  padding: 0 9px; overflow: hidden; border-radius: 999px; background: var(--tl-pill); color: var(--ib-text-2);
  font-size: 11.5px; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.tl-status:not([data-tone="idle"])::before { content: ""; flex: none; width: 6px; height: 6px; border-radius: 50%;
  background: var(--tl-s); }
.tl-status[data-tone="done"] { --tl-s: var(--st-done);
  background: color-mix(in srgb, var(--st-done) calc(14% * var(--chroma)), var(--tl-pill));
  color: color-mix(in srgb, var(--st-done) calc(70% * var(--chroma)), var(--ib-text)); }
.tl-status[data-tone="run"] { --tl-s: var(--st-run);
  background: color-mix(in srgb, var(--st-run) calc(14% * var(--chroma)), var(--tl-pill));
  color: color-mix(in srgb, var(--st-run) calc(70% * var(--chroma)), var(--ib-text)); }
.tl-status[data-tone="wait"] { --tl-s: var(--st-wait);
  background: color-mix(in srgb, var(--st-wait) calc(16% * var(--chroma)), var(--tl-pill));
  color: color-mix(in srgb, var(--st-wait) calc(70% * var(--chroma)), var(--ib-text)); }
.tl-status[data-tone="fail"] { --tl-s: var(--st-fail);
  background: color-mix(in srgb, var(--st-fail) calc(14% * var(--chroma)), var(--tl-pill));
  color: color-mix(in srgb, var(--st-fail-text) calc(80% * var(--chroma)), var(--ib-text)); }

/* Quiet text buttons and the checkbox. */
.tl-act { appearance: none; flex: none; min-height: 28px; margin: 0; padding: 0 8px; border: 0; border-radius: 8px;
  background: transparent; color: var(--ib-text); font-size: 12.5px; font-weight: 600; line-height: 1;
  -webkit-tap-highlight-color: transparent; transition: background-color var(--dur-press) ease; }
.tl-act:hover { background: color-mix(in srgb, var(--ib-text) 7%, transparent); }
.tl-act:active { background: color-mix(in srgb, var(--ib-text) 11%, transparent); }
.tl-check { appearance: none; display: grid; flex: none; place-items: center; width: 32px; height: 32px; margin: -6px -6px -6px 0;
  padding: 0; border: 0; border-radius: 8px; background: transparent; color: inherit;
  -webkit-tap-highlight-color: transparent; }
.tl-check:focus-visible { outline: none; }
.tl-box { display: grid; place-items: center; width: 20px; height: 20px; border: 1.5px solid
  color-mix(in srgb, var(--ib-text) 32%, transparent); border-radius: 6px; background: var(--ib-card);
  color: var(--ib-card); transition: background-color 160ms var(--ease-out), border-color 160ms var(--ease-out); }
.tl-box svg { opacity: 0; transform: scale(0.6); transition: opacity 140ms var(--ease-out), transform 200ms var(--ease-out); }
.tl-check:hover .tl-box { border-color: color-mix(in srgb, var(--ib-text) 55%, transparent); }
.tl-check:focus-visible .tl-box { outline: 2px solid var(--border-focus); outline-offset: 2px; }
.tl-check[aria-checked="true"] .tl-box { border-color: var(--ib-text); background: var(--ib-text); }
.tl-check[aria-checked="true"] .tl-box svg { opacity: 1; transform: none; }
.tl-check:active .tl-box { transform: scale(0.94); }

/* Compact: no cards — hairline-separated rows, small markers, plain tinted status words. */
.tl[data-compact] { --tl-rail-w: 10px; }
.tl[data-compact] .tl-item + .tl-item { border-top: 1px solid var(--ib-card-border); }
.tl[data-compact] .tl-card, .tl[data-compact] .tl-item[aria-current] .tl-card,
.tl[data-compact] .tl-item[data-overdue] .tl-card { margin: 0; padding: 10px 0; border: 0; border-radius: 0;
  background: transparent; }
.tl[data-compact] .tl-rail { min-height: 0; }
.tl[data-compact] .tl-rail::before, .tl[data-compact] .tl-rail::after { display: none; }
.tl[data-compact] .tl-dot { width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px; border-width: 1.5px; box-shadow: none; }
.tl[data-compact] .tl-item[aria-current] .tl-dot { box-shadow: 0 0 0 3px color-mix(in srgb, var(--tl-c) 22%, transparent); }
.tl[data-compact] .tl-status { height: auto; padding: 0; background: none; }
.tl[data-compact] .tl-status::before { display: none; }

.tl-empty { margin: 0; padding: 10px 0; font-size: 12.5px; color: var(--text-tertiary); }

/* Narrow: the pill and actions drop under the title; the time column narrows. Nothing overflows at 390px. */
@container tl (max-width: 479px) {
  .tl { --tl-time-w: 40px; --tl-rail-w: 18px; }
  .tl[data-compact] { --tl-rail-w: 10px; }
  .tl-item { column-gap: 8px; }
  .tl-time { font-size: 12px; }
  .tl-card { flex-wrap: wrap; row-gap: 8px; padding: 10px 10px 10px 12px; }
  .tl-check { order: 2; align-self: flex-start; margin-top: -4px; }
  .tl-meta { order: 3; flex-basis: 100%; justify-content: flex-start; }
  .tl[data-compact] .tl-card { row-gap: 4px; }
}
@media (pointer: coarse) {
  .tl-check { width: 44px; height: 44px; margin: -12px -8px -12px -4px; }
  .tl-act { min-width: 44px; min-height: 44px; margin-block: -8px; }
}
/* The hit area may reach into a card's padding, never past the element's edge (compact rows have no padding). */
.tl[data-compact] .tl-check { margin-right: 0; }
@media (forced-colors: active) {
  .tl-dot, .tl-box { forced-color-adjust: none; }
  .tl-status { border: 1px solid CanvasText; }
}
`;
