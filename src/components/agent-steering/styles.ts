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

/* Dock (data.queue 'dock'): notes the host's list holds wait behind a round button above the element's top right —
   it takes no height. It pops in with the first note, bumps on each new one, spins a ring while a note is on its way,
   turns the fail colour when one failed. --ui-steering-dock-gap / -right move it (the host knows what sits there). */
.as-dock { position: absolute; z-index: 3; right: var(--ui-steering-dock-right, 0px);
  bottom: calc(100% + var(--ui-steering-dock-gap, 8px)); display: grid; place-items: center; width: 32px; height: 32px;
  border-radius: 999px; background: var(--as-card); color: var(--as-ink);
  box-shadow: 0 0 0 1px var(--as-line), var(--ib-shadow, 0 2px 8px color-mix(in srgb, var(--text) 10%, transparent));
  font-size: 13px; font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: 0; cursor: pointer;
  opacity: 0; visibility: hidden; transform: scale(0.6);
  transition: opacity 160ms ease, transform 240ms var(--as-ease), visibility 0s linear 240ms, background-color 160ms ease,
    color 160ms ease, box-shadow 160ms ease; }
.as-dock[data-shown] { opacity: 1; visibility: visible; transform: none;
  transition: opacity 160ms ease, transform 360ms cubic-bezier(0.34, 1.4, 0.64, 1), visibility 0s, background-color 160ms ease,
    color 160ms ease, box-shadow 160ms ease; }
/* The dock's box without its transforms: the open queue is placed against it. */
.as-anchor { position: absolute; right: var(--ui-steering-dock-right, 0px); bottom: calc(100% + var(--ui-steering-dock-gap, 8px));
  width: 32px; height: 32px; visibility: hidden; pointer-events: none; }
.as-dock-n { position: relative; min-width: 1ch; text-align: center; }
.as-dock-ring { position: absolute; inset: -3px; border-radius: inherit; pointer-events: none; opacity: 0;
  background: conic-gradient(from 0deg, transparent 0 62%, var(--as-accent) 100%);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px)); transition: opacity 160ms ease; }
.as-dock[data-tone="run"] .as-dock-ring { opacity: 1; animation: as-spin 900ms linear infinite; }
.as-dock[aria-expanded="true"] { background: var(--as-solid); color: var(--as-on-solid); box-shadow: 0 0 0 1px var(--as-solid); }
.as-dock[data-tone="fail"] { background: var(--as-fail); color: var(--as-on-solid); box-shadow: 0 0 0 1px var(--as-fail); }
.as-dock.is-bump { animation: as-bump 420ms cubic-bezier(0.34, 1.56, 0.64, 1); }
.as-dock:focus-visible { outline: 2px solid var(--as-accent); outline-offset: 2px; }
@media (hover: hover) {
  .as-dock[data-tone="idle"][aria-expanded="false"]:hover { background: color-mix(in srgb, var(--text) 6%, var(--as-card)); }
}
.as-dock:active { transform: scale(0.94); }

/* The open queue: a raised card above the dock, its right edge on the dock's (fixed: no ancestor clips it). */
.as-probe { position: fixed; left: 0; top: 0; width: 100px; height: 0; visibility: hidden; pointer-events: none; }
.as-pop { position: fixed; z-index: var(--ui-steering-pop-z, 160); left: 0; top: 0; box-sizing: border-box;
  display: flex; flex-direction: column; width: min(380px, calc(100vw - 16px)); max-width: calc(100vw - 16px);
  border-radius: 12px; background: var(--as-card); color: var(--as-text); outline: none;
  box-shadow: 0 0 0 1px var(--as-line), var(--ib-shadow-raised, 0 14px 30px color-mix(in srgb, var(--text) 14%, transparent));
  transform-origin: bottom right; opacity: 0; visibility: hidden; pointer-events: none; transform: translateY(4px) scale(0.97);
  transition: opacity 140ms ease, transform 180ms var(--as-ease), visibility 0s linear 180ms; }
.as-pop[data-side="bottom"] { transform-origin: top right; transform: translateY(-4px) scale(0.97); }
.as-pop[data-open] { opacity: 1; visibility: visible; pointer-events: auto; transform: none;
  transition: opacity 160ms ease, transform 240ms var(--as-ease), visibility 0s; }
.as-pop-head { position: relative; display: flex; flex: none; align-items: center; gap: 6px; padding: 8px 6px 6px 14px;
  color: var(--as-muted); font-size: 10px; font-weight: 500; line-height: 16px; letter-spacing: 0.5px; text-transform: uppercase; }
.as-pop-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.as-pop-close { margin-left: auto; text-transform: none; }
.as-pop-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 2px 10px 10px; }
.as-grab { display: none; }
.as-scrim { position: fixed; z-index: calc(var(--ui-steering-pop-z, 160) - 1); left: 0; top: 0; width: 0; height: 0;
  background: var(--scrim, color-mix(in srgb, var(--text) 32%, transparent)); opacity: 0; visibility: hidden;
  pointer-events: none; touch-action: none; cursor: pointer; -webkit-tap-highlight-color: transparent;
  transition: opacity 200ms ease, visibility 0s linear 200ms; }
.as-scrim[data-open] { opacity: 1; visibility: visible; pointer-events: auto; transition: opacity 240ms ease, visibility 0s; }

/* Under 640px: a bottom sheet over the scrim, the visual viewport's width, above the keyboard and the home bar. Its
   head drags it down; the grabber says so. iOS's sheet curve in, a quicker one out. */
.as-pop[data-sheet] { max-width: none; border-radius: 16px 16px 0 0; opacity: 1; transform: translateY(100%);
  transform-origin: bottom center; padding-bottom: max(8px, env(safe-area-inset-bottom, 0px));
  box-shadow: 0 0 0 1px var(--as-line), 0 -8px 28px color-mix(in srgb, var(--text) 12%, transparent);
  transition: transform 260ms cubic-bezier(0.32, 0.72, 0, 1), visibility 0s linear 260ms; }
.as-pop[data-sheet][data-open] { transform: none; transition: transform 420ms cubic-bezier(0.32, 0.72, 0, 1), visibility 0s; }
.as-pop[data-sheet][data-kb] { padding-bottom: 8px; }
.as-pop[data-drag] { transition: none !important; }
.as-pop[data-sheet] .as-pop-head { padding: 22px 8px 8px 18px; font-size: 11px; touch-action: none; cursor: grab; }
.as-pop[data-sheet] .as-grab { display: block; position: absolute; top: 8px; left: 50%; width: 36px; height: 5px;
  margin-left: -18px; border-radius: 3px; background: var(--as-faint); }
.as-pop[data-sheet] .as-pop-body { padding: 2px 12px 8px; }

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
@keyframes as-bump { 30% { transform: scale(1.16); } }

@container as (max-width: 380px) {
  .as-row { grid-template-columns: minmax(0, 1fr); }
  .as-acts { justify-content: flex-end; margin-right: -2px; }
}
/* The open queue measures itself (a 380px card, a phone-wide sheet): its notes take the full width, buttons under. */
.as-pop { container: as-pop / inline-size; }
@container as-pop (max-width: 520px) {
  .as-pop .as-row { grid-template-columns: minmax(0, 1fr); }
  .as-pop .as-acts { justify-content: flex-end; margin-right: -2px; }
}
@media (pointer: coarse) {
  .as-btn { height: 44px; padding: 0 12px 0 10px; }
  .as-btn.is-icon { width: 44px; padding: 0; }
  .as-btn.is-primary { padding: 0 14px; }
  .as-send { width: 44px; height: 44px; }
  .as-dock { width: 44px; height: 44px; font-size: 15px; }
  .as-anchor { width: 44px; height: 44px; }
  .as-field { min-height: 52px; }
  .as-input, .as-edit { font-size: 16px; }
  .as-input { margin: 12px 0; }
  .as-hint { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .as-row[data-state="sending"]::before, .as-spin, .as-dock.is-bump { animation: none; }
  .as-dock[data-tone="run"] .as-dock-ring { animation: none; background: var(--as-accent); }
  /* Nothing moves: the dock, the queue and the sheet fade. */
  .as-dock, .as-dock[data-shown], .as-pop, .as-pop[data-side="bottom"], .as-pop[data-sheet] { transform: none; }
  .as-pop[data-sheet] { opacity: 0; transition: opacity 160ms ease, visibility 0s linear 160ms; }
  .as-pop[data-sheet][data-open] { opacity: 1; transition: opacity 160ms ease, visibility 0s; }
}
`;
