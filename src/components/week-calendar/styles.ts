/**
 * Week calendar. A 14px card on the resting shadow (or `flat` inside a host frame). The grid is quiet — hairline hour
 * rules on --ib-card-border, 11px tabular hours on --text-tertiary — so the blocks carry the weight: ink, accent,
 * a hatched outline, a plain outline, or a run / fail tint. Today's column is softly hatched; the now line is the one
 * red mark. Every colour is a token; status tints scale with --chroma (ink in mono), marks keep their colour.
 */
export const styles = `
:host { display: block; min-width: 0; max-width: 100%; container-type: inline-size; }
.wk {
  --hh: var(--wk-hour-h, 48px); --gut: var(--wk-gutter, 52px); --colmin: var(--wk-col-min, 88px);
  --line: var(--ib-card-border);
  --ink-accent: color-mix(in srgb, var(--accent) calc(100% * var(--chroma)), var(--ib-text));
  position: relative; display: flex; flex-direction: column; gap: 12px; min-width: 0;
  padding: 14px 16px 16px; border: 1px solid var(--ib-card-border); border-radius: 14px; background: var(--ib-card);
  box-shadow: var(--ib-shadow); color: var(--ib-text); font-size: 13px; line-height: 1.45;
}
:host([flat]) .wk { padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }

/* Header: ‹ › and the range on the left, the Week | List switch on the right (wraps under on a phone). */
.wk-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 12px; min-width: 0; }
.wk-nav { display: flex; align-items: center; gap: 6px; min-width: 0; }
.wk-nav-b {
  position: relative; display: inline-grid; place-items: center; flex: none; width: 32px; height: 32px; padding: 0;
  border: 1px solid var(--ib-card-border); border-radius: 50%; background: var(--ib-card); color: var(--ib-text);
  -webkit-tap-highlight-color: transparent;
  transition: background-color var(--dur-press) ease, transform var(--dur-press) var(--ease-out);
}
.wk-nav-b::after { content: ''; position: absolute; inset: -6px; }
.wk-nav-b:active { transform: scale(0.94); }
.wk-nav-b:focus-visible { outline-offset: 1px; }
.wk-range {
  margin: 0 0 0 6px; min-width: 0; font-size: 15px; font-weight: 650; line-height: 20px; letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums; overflow-wrap: anywhere;
}

/* The Week | List switch: a 3px well with one raised chip that slides (the library's segmented look, drawn here). */
.wk-seg {
  --pad: 3px; --gap: 2px;
  position: relative; display: inline-grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: var(--gap);
  flex: none; padding: var(--pad); border-radius: 10px; background: var(--ib-seg); box-shadow: inset 0 0 0 1px var(--ib-card-border);
}
.wk-seg-thumb {
  position: absolute; top: var(--pad); bottom: var(--pad); left: var(--pad); border-radius: 8px;
  width: calc((100% - 2 * var(--pad) - var(--gap)) / 2); background: var(--ib-seg-on);
  box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow); pointer-events: none;
  transform: translateX(calc(var(--i) * (100% + var(--gap)))); transition: transform var(--dur-move) var(--ease-out);
}
.wk-seg-b {
  position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 0;
  min-height: 28px; padding: 0 11px; border: 0; border-radius: 8px; background: none; color: var(--ib-muted);
  font-size: 12.5px; font-weight: 500; line-height: 1; white-space: nowrap; -webkit-tap-highlight-color: transparent;
  transition: color var(--dur-press) ease, transform var(--dur-press) var(--ease-out);
}
.wk-seg-b > svg { flex: none; width: 14px; height: 14px; }
.wk-seg-b[aria-checked="true"] { color: var(--ib-text); }
.wk-seg-b:focus-visible { outline-offset: -2px; }
.wk-seg-b:active:not(:focus-visible) { transform: scale(0.97); }

/* Legend: swatch, words, count — and the drag hint at the end of the row. */
.wk-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; min-width: 0; }
.wk-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; margin: 0; padding: 0; list-style: none;
  font-size: 12.5px; line-height: 18px; color: var(--ib-text-2); }
.wk-legend li { display: inline-flex; align-items: center; gap: 7px; min-width: 0; overflow-wrap: anywhere; }
.wk-legend b { font-weight: 600; color: var(--ib-text); font-variant-numeric: tabular-nums; }
.wk-hint { margin: 0 0 0 auto; font-size: 12px; line-height: 18px; color: var(--ib-muted); }

/* What each kind looks like — the blocks, the list swatches and the legend share it. */
[data-kind] { --ev-bg: var(--ib-text); --ev-ink: var(--ib-card); --ev-line: var(--ib-text); --ev-sub: color-mix(in srgb, var(--ib-card) 72%, transparent); }
[data-kind="accent"] { --ev-bg: color-mix(in srgb, var(--accent) calc(100% * var(--chroma)), var(--ib-muted)); --ev-line: transparent; }
[data-kind="hatch"] {
  --ev-bg: repeating-linear-gradient(-45deg, transparent 0 4px, color-mix(in srgb, var(--ib-text) 18%, transparent) 4px 5px), var(--ib-card);
  --ev-ink: var(--ib-text); --ev-line: color-mix(in srgb, var(--ib-text) 42%, transparent); --ev-sub: var(--ib-text-2);
}
[data-kind="outline"] { --ev-bg: var(--ib-card); --ev-ink: var(--ib-text); --ev-line: var(--ib-text); --ev-sub: var(--ib-text-2); }
[data-kind="run"] {
  --ev-bg: color-mix(in srgb, var(--st-run) calc(14% * var(--chroma)), var(--ib-card)); --ev-ink: var(--ib-text);
  --ev-line: color-mix(in srgb, var(--st-run) 55%, var(--ib-card)); --ev-mark: var(--st-run); --ev-sub: var(--ib-text-2);
}
[data-kind="fail"] {
  --ev-bg: color-mix(in srgb, var(--st-fail) calc(12% * var(--chroma)), var(--ib-card));
  --ev-ink: color-mix(in srgb, var(--st-fail-text) calc(85% * var(--chroma)), var(--ib-text));
  --ev-line: color-mix(in srgb, var(--st-fail) 55%, var(--ib-card)); --ev-mark: var(--st-fail); --ev-sub: var(--ib-text-2);
}
.wk-sw { flex: none; display: block; width: 10px; height: 10px; border: 1.5px solid var(--ev-line); border-radius: 3px; background: var(--ev-bg); }
.wk-sw[data-kind="run"], .wk-sw[data-kind="fail"] { border-left: 3.5px solid var(--ev-mark); }

/* The grid: one scroller, the day row sticky on top, the hour gutter sticky on the left. */
.wk-scroll {
  position: relative; min-width: 0; max-height: var(--wk-max-h, 560px); overflow: auto; overscroll-behavior: contain;
  border-top: 1px solid var(--line); scrollbar-width: thin;
}
.wk-grid {
  position: relative; display: grid; min-width: calc(var(--gut) + var(--days) * var(--colmin));
  grid-template-columns: var(--gut) repeat(var(--days), minmax(var(--colmin), 1fr));
}
.wk-corner, .wk-dh { position: sticky; top: 0; z-index: 4; background: var(--ib-card); border-bottom: 1px solid var(--line); }
.wk-corner { left: 0; z-index: 6; grid-row: 1; grid-column: 1; }
.wk-dh { grid-row: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 0; padding: 7px 2px 8px; }
.wk-dw { font-size: 11.5px; line-height: 14px; color: var(--ib-muted); }
.wk-dn {
  display: inline-grid; place-items: center; min-width: 30px; height: 30px; padding: 0 6px; border-radius: 15px;
  font-size: 16px; font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums;
}
.wk-dh[data-today] .wk-dw { color: var(--ink-accent); font-weight: 600; }
.wk-dh[data-today] .wk-dn { background: var(--accent); color: var(--ib-card); }
.wk-gutter {
  position: sticky; left: 0; z-index: 5; grid-row: 2; grid-column: 1; height: calc(var(--rows) * var(--hh));
  background: var(--ib-card);
}
.wk-hl {
  position: absolute; right: 8px; top: calc(var(--i) * var(--hh) + 3px); font-size: 11px; line-height: 14px;
  color: var(--text-tertiary); font-variant-numeric: tabular-nums; white-space: nowrap;
}
.wk-cols {
  position: relative; grid-row: 2; grid-column: 2 / -1; display: grid;
  grid-template-columns: repeat(var(--days), minmax(0, 1fr)); height: calc(var(--rows) * var(--hh));
}
.wk-col {
  position: relative; min-width: 0; border-left: 1px solid var(--line);
  background-image: linear-gradient(var(--line) 1px, transparent 1px); background-size: 100% var(--hh);
}
.wk-col[data-today] {
  background-color: color-mix(in srgb, var(--accent) calc(3% * var(--chroma)), transparent);
  background-image: linear-gradient(var(--line) 1px, transparent 1px),
    repeating-linear-gradient(-45deg, transparent 0 7px, color-mix(in srgb, var(--ib-text) 6%, transparent) 7px 8px);
  background-size: 100% var(--hh), auto;
}

/* A block: placed by its start (--t hours from the top) and length (--d hours), its lane (--l of --n) splits the width. */
.wk-ev {
  position: absolute; z-index: 1; display: flex; flex-direction: column; align-items: stretch; gap: 1px; min-width: 0;
  top: calc(var(--t) * var(--hh) + 1px); height: max(14px, calc(var(--d) * var(--hh) - 2px));
  left: calc(3px + var(--l) * (100% - 6px) / var(--n)); width: calc((100% - 6px) / var(--n) - 2px);
  margin: 0; padding: 4px 7px; overflow: hidden; border: 1px solid var(--ev-line); border-radius: 8px;
  background: var(--ev-bg); color: var(--ev-ink); font-size: 12px; line-height: 15px; text-align: left;
  cursor: grab; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: top var(--dur-move) var(--ease-out), height var(--dur-move) var(--ease-out), left var(--dur-move) var(--ease-out),
    width var(--dur-move) var(--ease-out), opacity var(--dur-fade) ease, box-shadow var(--dur-press) ease;
}
.wk-ev[data-kind="outline"] { border-width: 1.5px; }
.wk-ev[data-kind="run"], .wk-ev[data-kind="fail"] { border-left: 3px solid var(--ev-mark); }
.wk-ev:hover { z-index: 2; box-shadow: var(--ib-shadow); }
.wk-ev:focus-visible { z-index: 3; outline-offset: 1px; }
.wk-ev[data-locked] { cursor: not-allowed; }
.wk-ev[data-locked] .wk-ev-title { padding-right: 13px; }
.wk-ev[data-dragging] { opacity: 0.35; }
.wk[data-drag] { user-select: none; -webkit-user-select: none; }
.wk[data-drag], .wk[data-drag] .wk-ev { cursor: grabbing; }
.wk-ev-title, .wk-ev-time, .wk-ev-detail { display: block; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.wk-ev-title { font-weight: 600; }
.wk-ev-time, .wk-ev-detail { font-size: 11px; line-height: 14px; color: var(--ev-sub); font-variant-numeric: tabular-nums; }
.wk-ev[data-size="xs"] { justify-content: center; padding-top: 0; padding-bottom: 0; font-size: 11px; line-height: 13px; }
.wk-ev[data-size="s"] { flex-direction: row; align-items: center; gap: 6px; padding-top: 0; padding-bottom: 0; }
.wk-ev[data-size="s"] .wk-ev-title { flex: 0 1 auto; }
.wk-ev[data-size="s"] .wk-ev-time { flex: 1 1 0; }
.wk-lock { position: absolute; top: 4px; right: 5px; width: 11px; height: 11px; opacity: 0.85; }
.wk-ev[data-size="xs"] .wk-lock, .wk-ev[data-size="s"] .wk-lock { top: 50%; transform: translateY(-50%); }

/* The drop target while dragging: a dashed block snapped to the step and the day, with its new times. */
.wk-ghost {
  position: absolute; z-index: 7; display: flex; flex-direction: column; gap: 1px; min-width: 0; pointer-events: none;
  left: calc(var(--gi) * 100% / var(--days) + 3px); width: calc(100% / var(--days) - 6px);
  top: calc(var(--t) * var(--hh) + 1px); height: max(14px, calc(var(--d) * var(--hh) - 2px));
  padding: 3px 7px; overflow: hidden; border: 1.5px dashed var(--ib-text); border-radius: 8px;
  background: color-mix(in srgb, var(--ib-card) 82%, transparent); box-shadow: var(--ib-shadow-raised);
  color: var(--ib-text); font-size: 11.5px; line-height: 14px; font-variant-numeric: tabular-nums;
  transition: top 90ms var(--ease-out), left 90ms var(--ease-out), height 90ms var(--ease-out);
}
.wk-ghost[hidden] { display: none; }
.wk-ghost b, .wk-ghost span { display: block; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.wk-ghost[data-short] { flex-direction: row-reverse; justify-content: flex-end; align-items: center; gap: 6px; padding-top: 0; padding-bottom: 0; }
.wk-ghost[data-short] span { flex: none; }

/* Now: a 2px red rule across today's column with a dot at its start. */
.wk-now {
  position: absolute; z-index: 4; left: -1px; right: 0; top: calc(var(--t) * var(--hh) - 1px); height: 0;
  border-top: 2px solid var(--st-fail); pointer-events: none; transition: top var(--dur-move) var(--ease-out);
}
.wk-now::before { content: ''; position: absolute; left: -5px; top: -6px; width: 10px; height: 10px; border-radius: 50%; background: var(--st-fail); }

.wk-note {
  position: absolute; z-index: 3; top: calc(var(--hh) * 0.75); left: 50%; transform: translateX(-50%);
  max-width: calc(100% - 24px); margin: 0; padding: 7px 14px; border-radius: 999px; background: var(--ib-card);
  box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow); color: var(--ib-muted); font-size: 12.5px; text-align: center;
  pointer-events: none;
}

/* List: a day per group (big date number, weekday), then its rows. */
.wk-list { display: flex; flex-direction: column; min-width: 0; border-top: 1px solid var(--line); }
.wk-day { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 0 6px; padding: 8px 0; border-bottom: 1px solid var(--line); }
.wk-day:last-child { border-bottom: 0; }
.wk-day-h { display: flex; flex-direction: column; align-items: center; margin: 0; padding-top: 9px; font: inherit; }
.wk-day-n { font-size: 20px; font-weight: 650; line-height: 24px; font-variant-numeric: tabular-nums; }
.wk-day-w { font-size: 12px; line-height: 16px; color: var(--ib-muted); }
.wk-day-h[data-today] .wk-day-n, .wk-day-h[data-today] .wk-day-w { color: var(--ink-accent); }
.wk-day-h[data-today] .wk-day-w { font-weight: 600; }
.wk-rows { display: flex; flex-direction: column; min-width: 0; margin: 0; padding: 0; list-style: none; }
.wk-row {
  display: grid; grid-template-columns: 10px 42px minmax(0, 1fr) auto; align-items: center; gap: 10px; width: 100%;
  min-height: 52px; margin: 0; padding: 7px 6px 7px 8px; border: 0; border-radius: 10px; background: none; color: inherit;
  text-align: left; -webkit-tap-highlight-color: transparent; transition: background-color var(--dur-press) ease;
}
.wk-row:focus-visible { outline-offset: -2px; }
.wk-row-time { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
.wk-row-main { display: flex; flex-direction: column; min-width: 0; }
.wk-row-title, .wk-row-detail { display: block; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.wk-row-title { font-size: 14px; font-weight: 600; line-height: 19px; }
.wk-row-detail { font-size: 12px; line-height: 16px; color: var(--ib-muted); }
.wk-row-end { display: inline-flex; align-items: center; gap: 6px; color: var(--ib-muted); }
.wk-row-end > svg { flex: none; }
.wk-empty { margin: 0; padding: 28px 12px; border-top: 1px solid var(--line); color: var(--ib-muted); font-size: 13px; text-align: center; }

@media (hover: hover) and (pointer: fine) {
  .wk-nav-b:hover { background: color-mix(in srgb, var(--ib-text) 6%, var(--ib-card)); }
  .wk-seg-b:hover { color: var(--ib-text); }
  .wk-row:hover { background: color-mix(in srgb, var(--ib-text) 4%, transparent); }
}
@media (pointer: coarse) {
  .wk-seg-b { min-height: 44px; }
  .wk-nav-b { width: 36px; height: 36px; }
}
@container (max-width: 520px) {
  .wk { padding: 12px 12px 14px; }
  :host([flat]) .wk { padding: 0; }
  .wk-range { font-size: 14px; }
  .wk-hint { margin-left: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .wk-seg-thumb, .wk-ev, .wk-ghost, .wk-now { transition: none !important; }
}
@media (forced-colors: active) {
  .wk-ev, .wk-sw, .wk-ghost { forced-color-adjust: none; }
  .wk-ev { border: 1px solid CanvasText; }
}
`;
