/**
 * Agent Steering. Sizes and timings follow the affectUI Agent Steering queue and composer (clean style): a 10px
 * uppercase queue label with a count chip, 8px note rows with a 2px state bar, 24px row buttons, a 36px field with a
 * 28px send button and key hints, 360ms enter / 240ms leave. Flat on purpose — it sits at the bottom of a panel, so
 * the host draws the card. Every colour is a dashboard token or a color-mix() of tokens, so light and dark both read.
 */
export const styles = `
:host { --as-ink: var(--text); --as-text: var(--text-secondary); --as-muted: var(--text-tertiary);
  --as-faint: color-mix(in srgb, var(--text) 30%, transparent);
  --as-line: var(--border);
  --as-card: var(--surface);
  --as-wash: color-mix(in srgb, var(--text) 3.5%, var(--surface));
  --as-fill: color-mix(in srgb, var(--text) 8%, transparent);
  --as-hover: color-mix(in srgb, var(--text) 6%, transparent);
  --as-solid: var(--text); --as-on-solid: var(--surface);
  --as-accent: var(--accent);
  --as-accent-bg: color-mix(in srgb, var(--accent) 11%, transparent);
  --as-ring: color-mix(in srgb, var(--accent) 16%, transparent);
  --as-done: var(--st-done); --as-fail: var(--st-fail); --as-fail-text: var(--st-fail-text);
  --as-wait: color-mix(in srgb, var(--st-wait) calc(78% * var(--chroma)), var(--text));
  --as-shadow: 0 0 0 1px var(--as-line), 0 1px 2px color-mix(in srgb, var(--text) 5%, transparent);
  --as-ease: cubic-bezier(0.32, 0.72, 0.24, 1);
  min-width: 0; font-size: 13px; line-height: 20px; }
[hidden] { display: none !important; }
button { appearance: none; margin: 0; padding: 0; border: 0; background: none; text-align: left; letter-spacing: inherit; }
textarea { margin: 0; letter-spacing: inherit; }
svg { display: block; flex: none; }
.as { position: relative; container: as / inline-size; min-width: 0; color: var(--as-text); }

/* Queue: label + count, then the notes. Opens and closes by height (grid rows), never jumps. */
.as-queue { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 360ms var(--as-ease); }
.as-queue[data-open] { grid-template-rows: 1fr; }
.as-queue-in { min-height: 0; margin: 0 -4px; overflow: hidden; }
.as-queue-pad { padding: 3px 4px 10px; }
.as-label { display: flex; align-items: center; gap: 6px; margin: 0 0 6px 2px; color: var(--as-muted); font-size: 10px;
  font-weight: 500; line-height: 16px; letter-spacing: 0.5px; text-transform: uppercase; }
.as-count { display: grid; place-items: center; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 4px;
  background: var(--as-fill); color: var(--as-text); letter-spacing: 0; font-variant-numeric: tabular-nums; }
.as-list { display: grid; grid-template-columns: minmax(0, 1fr); margin: 0; padding: 0; list-style: none; }

/* A note: text + one meta line, its buttons on the right. Leaves by collapsing its height. */
.as-item { display: grid; grid-template-rows: 1fr;
  transition: grid-template-rows 240ms var(--as-ease), margin-top 240ms var(--as-ease), opacity 200ms ease; }
.as-item + .as-item { margin-top: 6px; }
.as-clip { min-width: 0; min-height: 0; }
.as-item[data-leaving] { grid-template-rows: 0fr; margin-top: 0; opacity: 0; pointer-events: none; }
.as-item[data-leaving] > .as-clip { overflow: hidden; }
.as-item.is-enter .as-row { animation: as-in 360ms var(--as-ease) both; }
.as-row { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 4px 8px;
  overflow: hidden; min-height: 36px; padding: 6px 4px 6px 12px; border-radius: 8px; background: var(--as-card);
  box-shadow: var(--as-shadow); color: var(--as-ink); }
.as-row::before { content: ""; position: absolute; top: 8px; bottom: 8px; left: 0; width: 2px; border-radius: 0 2px 2px 0;
  background: var(--as-accent); }
.as-row[data-state="steered"]::before { background: var(--as-done); }
.as-row[data-state="failed"]::before { background: var(--as-fail); }
.as-row[data-state="sending"]::before { animation: as-breathe 1400ms ease-in-out infinite; }
.as-body { min-width: 0; }
.as-text { margin: 0; color: var(--as-ink); font-size: 12.5px; line-height: 18px; white-space: pre-line;
  overflow-wrap: anywhere; text-align: start; }
.as-text.is-empty { color: var(--as-muted); }
.as-row[data-state="steered"] .as-text { color: var(--as-text); }
.as-meta { margin-top: 1px; overflow: hidden; color: var(--as-muted); font-size: 12px; line-height: 16px;
  font-variant-numeric: tabular-nums; }
/* Every part starts with its “·”; the line's first one sits in the clipped 13px, so a wrapped line never opens with a dot. */
.as-meta-in { display: flex; flex-wrap: wrap; align-items: center; margin-left: -13px; }
.as-meta-in > * { display: inline-flex; align-items: center; gap: 4px; min-width: 0; }
.as-meta-in > *::before { content: "·"; flex: none; width: 13px; margin-right: -4px; text-align: center; color: var(--as-faint); }
.as-meta svg { width: 12px; height: 12px; }
.as-state[data-tone="run"] { color: var(--as-accent); }
.as-state[data-tone="run"] svg { color: color-mix(in srgb, currentColor calc(100% * var(--chroma)), var(--st-run)); }
.as-state[data-tone="done"] { color: color-mix(in srgb, var(--as-done) calc(100% * var(--chroma)), var(--text-secondary)); }
.as-state[data-tone="done"] svg { color: color-mix(in srgb, currentColor calc(100% * var(--chroma)), var(--as-done)); }
.as-state[data-tone="fail"] svg { color: color-mix(in srgb, currentColor calc(100% * var(--chroma)), var(--as-fail)); }
.as-state[data-tone="fail"] { color: var(--as-fail-text); font-weight: 500; }
.as-msg { color: var(--as-wait); overflow-wrap: anywhere; }
.as-row[data-state="failed"] .as-msg { color: var(--as-fail-text); }
.as-spin { animation: as-spin 900ms linear infinite; }

.as-acts { display: flex; align-items: center; gap: 2px; }
.as-btn { display: inline-flex; flex: none; align-items: center; justify-content: center; gap: 4px; height: 24px;
  padding: 0 8px 0 6px; border-radius: 6px; color: var(--as-text); font-size: 12px; font-weight: 500; line-height: 1;
  white-space: nowrap; transition: background-color 160ms ease, color 160ms ease; }
.as-btn svg { width: 12px; height: 12px; }
.as-btn.is-icon { width: 24px; padding: 0; color: var(--as-faint); }
.as-btn.is-icon svg { width: 13px; height: 13px; }
.as-btn.is-primary { padding: 0 10px; background: var(--as-solid); color: var(--as-on-solid); }
.as-btn[aria-disabled="true"] { opacity: 0.45; cursor: default; }
@media (hover: hover) {
  .as-btn:hover { background: var(--as-hover); color: var(--as-ink); }
  .as-btn.is-go:hover { background: var(--as-accent-bg); color: var(--as-accent); }
  .as-btn.is-primary:hover { background: color-mix(in srgb, var(--as-solid) 86%, var(--as-card)); color: var(--as-on-solid); }
  .as-btn[aria-disabled="true"]:hover { background: none; color: var(--as-text); }
}
.as-btn:active:not([aria-disabled="true"]) { transform: scale(0.96); }

/* Inline edit */
.as-row.is-editing { grid-template-columns: minmax(0, 1fr); padding: 6px 6px 6px 12px; }
.as-edit { display: block; width: 100%; min-height: 20px; max-height: 160px; padding: 2px 0; border: 0; outline: none;
  background: none; color: var(--as-ink); font: inherit; font-size: 12.5px; line-height: 18px; resize: none; overflow-y: auto; }
.as-edit-foot { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
.as-edit-hint { margin-right: auto; color: var(--as-muted); font-size: 11.5px; }
.as-row.is-editing { box-shadow: 0 0 0 1px color-mix(in srgb, var(--as-accent) 55%, var(--as-line)), 0 0 0 3px var(--as-ring); }

/* Composer */
.as-field { display: flex; align-items: flex-end; gap: 6px; min-height: 36px; padding: 4px 4px 4px 10px; border-radius: 8px;
  background: var(--as-wash); box-shadow: inset 0 0 0 1px var(--as-line); cursor: text;
  transition: box-shadow 160ms ease, background-color 160ms ease; }
.as-field:focus-within { background: var(--as-card);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--as-accent) 55%, var(--as-line)), 0 0 0 3px var(--as-ring); }
.as[data-closed] .as-field { opacity: 0.6; cursor: not-allowed; }
/* A slotted <ui-composer> is the field: the built-in one and the attachments / tools slots step aside. */
.as[data-composer] .as-field, .as[data-composer] slot[name="attachments"] { display: none; }
::slotted([slot="composer"]) { display: block; }
::slotted([slot="tools"]) { display: flex; flex: none; align-items: center; align-self: center; margin-left: -6px; }
.as-input { flex: 1; min-width: 0; height: 20px; max-height: 200px; margin: 4px 0; padding: 0; border: 0; outline: none;
  background: none; color: var(--as-ink); font: inherit; line-height: 20px; resize: none; overflow-y: auto; }
.as-input::placeholder { color: var(--as-muted); }
.as-input:focus-visible { outline: none; }
.as-input:disabled { cursor: not-allowed; }
.as-send { display: grid; flex: none; place-items: center; width: 28px; height: 28px; border-radius: 6px;
  background: var(--as-solid); color: var(--as-on-solid); transition: opacity 160ms ease, transform 160ms ease; }
.as-send svg { width: 16px; height: 16px; }
.as-send:disabled { opacity: 0.18; cursor: default; }
.as-send:not(:disabled):active { transform: scale(0.94); }
.as-hint { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; margin: 8px 0 0 2px; color: var(--as-muted);
  font-size: 12px; line-height: 16px; }
.as-hint > span { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
kbd { display: inline-grid; place-items: center; min-width: 16px; height: 16px; padding: 0 3px; border-radius: 4px;
  background: var(--as-card); box-shadow: var(--as-shadow); color: var(--as-text); font: inherit; font-size: 10px; line-height: 1; }

svg.as-i { fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }

@keyframes as-in { from { opacity: 0; transform: translateY(6px); } }
@keyframes as-spin { to { transform: rotate(360deg); } }
@keyframes as-breathe { 50% { opacity: 0.35; } }

@container as (max-width: 380px) {
  .as-row { grid-template-columns: minmax(0, 1fr); }
  .as-acts { justify-content: flex-end; margin-right: -2px; }
}
@media (pointer: coarse) {
  .as-btn { height: 44px; padding: 0 12px 0 10px; }
  .as-btn.is-icon { width: 44px; padding: 0; }
  .as-btn.is-primary { padding: 0 14px; }
  .as-send { width: 44px; height: 44px; }
  .as-field { min-height: 52px; }
  .as-input, .as-edit { font-size: 16px; }
  .as-input { margin: 12px 0; }
  .as-hint { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .as-row[data-state="sending"]::before, .as-spin { animation: none; }
}
`;
