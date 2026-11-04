/**
 * Composer. One calm field card (radius 12, hairline border, focus = border to `--ib-muted`, no glow): the text, the
 * attachment chips, an error line and the toolbar inside it. Ported from the dashboard's new-task and panel composer
 * (`.nt-compose`, `.nt-att`, `.nt-recorder`, `.nt-toolbar`) in the library language: ink send button instead of the
 * gradient, press 0.97, tints by color-mix() of status tokens instead of rgba literals, spinner 0.9s.
 *
 * Mode switch (0.26.0): a day / night track beside the send button. Off is day — the thumb holds a sun on a warm track;
 * on is night — the thumb slides over with a little overshoot, the sun turns away as the moon turns in, two stars come
 * out, and the send button goes with it: a night-sky layer fades in under its label, the new label rises into place,
 * a light band sweeps across once and a soft ring spreads. Night is --st-run and --purple over the ink, each share
 * scaled by --chroma, so the mono palette keeps it ink.
 */
export const styles = `
:host { --cp-fail-bg: color-mix(in srgb, var(--st-fail) calc(14% * var(--chroma)), var(--ib-card));
  --cp-fail-text: color-mix(in srgb, var(--st-fail) calc(70% * var(--chroma)), var(--ib-text));
  --cp-warn-text: color-mix(in srgb, var(--st-wait) calc(70% * var(--chroma)), var(--ib-text));
  --cp-hover: var(--ib-pill);
  --cp-night-a: color-mix(in srgb, var(--st-run) calc(70% * var(--chroma)),
    color-mix(in srgb, var(--purple) calc(30% * var(--chroma)), var(--ib-text)));
  --cp-night-b: color-mix(in srgb, var(--purple) calc(70% * var(--chroma)),
    color-mix(in srgb, var(--st-run) calc(30% * var(--chroma)), var(--ib-text)));
  --cp-day: color-mix(in srgb, var(--st-wait) calc(20% * var(--chroma)), var(--ib-pill));
  --cp-sun: color-mix(in srgb, var(--st-wait) calc(100% * var(--chroma)), var(--ib-text));
  --cp-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  min-width: 0; }
[hidden] { display: none !important; }
button { appearance: none; margin: 0; padding: 0; border: 0; background: none; font: inherit; color: inherit;
  -webkit-tap-highlight-color: transparent; }
svg { display: block; flex: none; }
.cp { container: cp / inline-size; min-width: 0; }

/* fill: the card takes the host's height (a phone sheet) — the field grows, the toolbar sits at the bottom. */
:host([fill]) { display: flex; flex-direction: column; }
:host([fill]) .ui-root, :host([fill]) .cp { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; }
:host([fill]) .cp-card { flex: 1 1 auto; min-height: 0; }
:host([fill]) .cp-field { flex: 1 1 auto; max-height: none; }

/* Upload progress: a thin ink line above the toolbar. */
.cp-progress { flex: none; height: 3px; margin: 0 12px 4px; border-radius: 999px; overflow: hidden;
  background: color-mix(in srgb, var(--ib-text) 12%, transparent); }
.cp-progress-bar { display: block; height: 100%; background: var(--ib-text); transform-origin: 0 50%;
  transition: transform var(--dur-move) var(--ease-out); }

/* The card: everything sits inside one surface. */
.cp-card { position: relative; display: flex; flex-direction: column; min-width: 0; border: 1px solid var(--ib-card-border);
  border-radius: 12px; background: var(--ib-card); box-shadow: var(--ib-shadow); cursor: text;
  transition: border-color 150ms ease, background-color 150ms ease; }
.cp-card:focus-within { border-color: var(--ib-muted); }
.cp[data-disabled] .cp-card { background: var(--ib-card-dim); cursor: default; }

.cp-field { display: block; width: 100%; min-height: calc(var(--cp-min, 2) * 1.5em + 20px);
  max-height: calc(var(--cp-max, 10) * 1.5em + 20px); margin: 0; padding: 10px 12px; border: 0; outline: none;
  background: transparent; color: var(--ib-text); font: inherit; font-size: 14px; line-height: 1.5; resize: none;
  overflow-y: auto; overflow-wrap: anywhere; scrollbar-width: thin; }
.cp-field::placeholder { color: var(--text-tertiary); opacity: 1; }
.cp-field:focus-visible { outline: none; }
.cp-field[readonly] { color: var(--text-secondary); cursor: default; }

/* Attachment chips: one scrolling row under the text. Chips added later scale in; those on first paint do not. */
.cp-files { display: flex; gap: 6px; margin: 0; padding: 2px 8px 8px; list-style: none; overflow-x: auto;
  scroll-snap-type: x proximity; scroll-padding-inline: 8px; scrollbar-width: thin; cursor: default; }
.cp-chip { display: flex; flex: none; align-items: center; gap: 8px; max-width: 232px; height: 44px; padding: 0 4px 0 5px;
  border: 1px solid var(--ib-card-border); border-radius: 10px; background: var(--ib-card-dim); scroll-snap-align: start;
  animation: cp-in var(--dur-expand) var(--ease-out) both; }
.cp-chip[data-still] { animation: none; }
.cp-thumb, .cp-tile { display: grid; flex: none; place-items: center; width: 32px; height: 32px; border-radius: 6px;
  background: var(--ib-pill); color: var(--text-secondary); object-fit: cover; overflow: hidden; }
img.cp-thumb { display: block; }
.cp-play { color: var(--ib-text); transition: background-color 150ms ease, transform var(--dur-press) var(--ease-out); }
.cp-chip-text { display: flex; flex: 1; flex-direction: column; min-width: 0; line-height: 1.3; }
.cp-name { overflow: hidden; color: var(--ib-text); font-size: 12.5px; font-weight: 500; white-space: nowrap;
  text-overflow: ellipsis; }
.cp-meta { overflow: hidden; color: var(--text-tertiary); font-size: 11.5px; white-space: nowrap; text-overflow: ellipsis;
  font-variant-numeric: tabular-nums; }
.cp-remove { display: grid; flex: none; place-items: center; width: 24px; height: 24px; border-radius: 6px;
  color: var(--text-tertiary); transition: background-color 150ms ease, color 150ms ease, transform var(--dur-press) var(--ease-out); }
.cp-remove:disabled { opacity: 0.4; cursor: default; }

/* Error line: status tint, clears on the next action. */
.cp-error { display: flex; align-items: flex-start; gap: 6px; margin: 0 8px 6px; padding: 6px 10px; border-radius: 8px;
  background: var(--cp-fail-bg); color: var(--cp-fail-text); font-size: 12.5px; line-height: 1.45; overflow-wrap: anywhere;
  cursor: default; animation: cp-fade var(--dur-fade) var(--ease-out) both; }
.cp-error svg { margin-top: 2px; }

/* Toolbar: quiet icon tools on the left; hint, counter and the one ink send button on the right. */
.cp-bar { display: flex; align-items: center; gap: 2px; min-height: 40px; padding: 2px 6px 6px; cursor: default; }
.cp-bar[data-enter] { animation: cp-fade var(--dur-fade) var(--ease-out) both; }
.cp-tools { display: flex; flex: 0 1 auto; align-items: center; gap: 2px; min-width: 0; overflow: hidden; }
.cp-tool { display: inline-flex; flex: none; align-items: center; justify-content: center; gap: 6px; min-width: 32px;
  height: 32px; padding: 0 9px; border-radius: 8px; color: var(--text-secondary); font-size: 12.5px; font-weight: 500;
  white-space: nowrap; transition: background-color 150ms ease, color 150ms ease, box-shadow 150ms ease,
  transform var(--dur-press) var(--ease-out); }
.cp-tool.is-icon { width: 32px; padding: 0; }
.cp-tool[aria-pressed="true"] { background: var(--ib-seg-on); color: var(--ib-text);
  box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow); }
.cp-tool[aria-busy="true"] { color: var(--ib-text); cursor: progress; }
.cp-tool:disabled { opacity: 0.4; cursor: default; }
.cp-end { display: flex; flex: 1; align-items: center; justify-content: flex-end; gap: 10px; min-width: 0; margin-left: 6px; }
.cp-hint { min-width: 0; overflow: hidden; color: var(--text-tertiary); font-size: 12px; white-space: nowrap;
  text-overflow: ellipsis; }
.cp-count { flex: none; color: var(--text-tertiary); font-size: 12px; font-variant-numeric: tabular-nums;
  transition: color 150ms ease; }
.cp-count[data-tone="warn"] { color: var(--cp-warn-text); }
.cp-count[data-tone="over"] { color: var(--cp-fail-text); font-weight: 600; }
.cp-send { position: relative; isolation: isolate; display: inline-flex; flex: none; align-items: center; justify-content: center;
  gap: 6px; width: 32px; height: 32px; border-radius: 8px; background: var(--ib-text); color: var(--ib-card); font-size: 13px;
  font-weight: 600; white-space: nowrap; overflow: hidden;
  transition: background-color 150ms ease, opacity 150ms ease, transform var(--dur-press) var(--ease-out); }
/* Night: the sky layer under the label fades in with the switch; the stars in it are two dots of the card colour. */
.cp-send::before { content: ''; position: absolute; inset: 0; z-index: -1; border-radius: inherit; opacity: 0; pointer-events: none;
  background: radial-gradient(circle at 6px 9px, color-mix(in srgb, var(--ib-card) 60%, transparent) 0.6px, transparent 1.4px),
    radial-gradient(circle at calc(100% - 7px) calc(100% - 8px), color-mix(in srgb, var(--ib-card) 45%, transparent) 0.5px, transparent 1.2px),
    linear-gradient(120deg, var(--cp-night-a), var(--cp-night-b));
  transition: opacity 420ms var(--ease-out); }
.cp-send[data-mode="on"]::before { opacity: 1; }
.cp-send::after { content: ''; position: absolute; inset: 0; z-index: -1; opacity: 0; pointer-events: none;
  background: linear-gradient(100deg, transparent 25%, color-mix(in srgb, var(--ib-card) 55%, transparent) 50%, transparent 75%);
  transform: translateX(-110%); }
.cp-send[data-flip][data-mode="on"] { animation: cp-ring 900ms var(--ease-out) 1; }
.cp-send[data-flip][data-mode="on"]::after { animation: cp-sweep 760ms var(--ease-out) 120ms 1 both; }
.cp-send[data-flip] .cp-send-text { animation: cp-rise 380ms var(--ease-out) both; }
.cp-send.has-label { width: auto; padding: 0 12px 0 14px; }
.cp-send[aria-disabled="true"] { opacity: 0.3; cursor: default; }
.cp-send[aria-busy="true"] { opacity: 1; cursor: progress; }

/* The mode switch: day (off, the sun) / night (on, the moon). The button is the hit area; the track is drawn. */
.cp-mode { display: inline-flex; flex: none; align-items: center; gap: 7px; height: 32px; padding: 0 2px; border-radius: 999px;
  color: var(--text-secondary); font-size: 12.5px; font-weight: 600; white-space: nowrap;
  transition: color 240ms ease, transform var(--dur-press) var(--ease-out); }
.cp-mode[aria-checked="true"] { color: var(--ib-text); }
.cp-mode:disabled { opacity: 0.4; cursor: default; }
.cp-mode-track { position: relative; display: block; flex: none; width: 46px; height: 26px; border-radius: 999px; overflow: hidden;
  background: var(--cp-day); box-shadow: inset 0 0 0 1px var(--ib-card-border);
  transition: background-color 420ms var(--ease-out), box-shadow 420ms var(--ease-out); }
.cp-mode-track::before { content: ''; position: absolute; inset: 0; border-radius: inherit; opacity: 0;
  background: linear-gradient(120deg, var(--cp-night-a), var(--cp-night-b)); transition: opacity 420ms var(--ease-out); }
.cp-mode[aria-checked="true"] .cp-mode-track { box-shadow: inset 0 0 0 1px transparent; }
.cp-mode[aria-checked="true"] .cp-mode-track::before { opacity: 1; }
.cp-mode-stars { position: absolute; inset: 0; opacity: 0; transform: translateY(3px) scale(0.6);
  background: radial-gradient(circle at 26% 34%, var(--ib-card) 0.8px, transparent 1.6px),
    radial-gradient(circle at 44% 70%, color-mix(in srgb, var(--ib-card) 70%, transparent) 0.6px, transparent 1.3px),
    radial-gradient(circle at 15% 66%, color-mix(in srgb, var(--ib-card) 50%, transparent) 0.5px, transparent 1.1px);
  transition: opacity 300ms ease, transform 420ms var(--ease-out); }
.cp-mode[aria-checked="true"] .cp-mode-stars { opacity: 1; transform: none; transition-delay: 140ms; }
.cp-mode-thumb { position: absolute; top: 3px; left: 3px; display: grid; place-items: center; width: 20px; height: 20px;
  border-radius: 50%; background: var(--ib-card); box-shadow: var(--ib-shadow), 0 0 0 1px var(--ib-card-border);
  transition: transform 460ms var(--cp-spring), background-color 420ms var(--ease-out), box-shadow 420ms var(--ease-out); }
.cp-mode[aria-checked="true"] .cp-mode-thumb { transform: translateX(20px);
  background: color-mix(in srgb, var(--ib-card) 92%, var(--cp-night-a)); box-shadow: var(--ib-shadow); }
.cp-mode-sun, .cp-mode-moon { position: absolute; display: grid; place-items: center;
  transition: transform 460ms var(--ease-out), opacity 260ms ease; }
.cp-mode-sun { color: var(--cp-sun); }
.cp-mode-moon { color: var(--cp-night-a); opacity: 0; transform: rotate(-120deg) scale(0.4); }
.cp-mode[aria-checked="true"] .cp-mode-sun { opacity: 0; transform: rotate(120deg) scale(0.4); }
.cp-mode[aria-checked="true"] .cp-mode-moon { opacity: 1; transform: none; }
.cp-mode-text { min-width: 0; }

.cp-spin { display: block; flex: none; width: 14px; height: 14px; border: 1.5px solid color-mix(in srgb, currentColor 30%, transparent);
  border-top-color: currentColor; border-radius: 50%; animation: cp-spin 0.9s linear infinite; }

/* Recorder bar: takes the toolbar's row while recording. */
.cp-rec { display: flex; align-items: center; gap: 10px; height: 32px; margin: 2px 6px 6px; padding: 0 2px 0 10px;
  border-radius: 8px; background: var(--cp-fail-bg); color: var(--ib-text); cursor: default;
  animation: cp-fade var(--dur-fade) var(--ease-out) both; }
.cp-rec-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--st-fail);
  animation: cp-rec 1.2s ease-in-out infinite; }
.cp-rec-time { flex: none; min-width: 34px; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
.cp-meter { flex: 1; min-width: 24px; height: 4px; border-radius: 999px; overflow: hidden;
  background: color-mix(in srgb, var(--st-fail) calc(24% * var(--chroma)), var(--ib-card)); }
.cp-level { display: block; width: 100%; height: 100%; border-radius: inherit; background: var(--cp-fail-text);
  transform: scaleX(0); transform-origin: left center; transition: transform 80ms linear; }
.cp-rec-btn { flex: none; height: 28px; padding: 0 10px; border-radius: 6px; color: var(--text-secondary); font-size: 12.5px;
  font-weight: 600; transition: background-color 150ms ease, color 150ms ease, transform var(--dur-press) var(--ease-out); }
.cp-rec-btn.is-done { background: var(--ib-text); color: var(--ib-card); }

/* Drop zone: a calm wash over the card while files are dragged over it. */
.cp-drop { position: absolute; inset: -1px; z-index: 2; display: flex; align-items: center; justify-content: center; gap: 8px;
  border: 1.5px dashed var(--ib-muted); border-radius: 12px; background: color-mix(in srgb, var(--ib-pill) 88%, transparent);
  color: var(--ib-text); font-size: 13px; font-weight: 600; opacity: 0; visibility: hidden; pointer-events: none;
  transition: opacity var(--dur-fade) ease, visibility 0s linear var(--dur-fade); }
.cp-card[data-drag] .cp-drop { opacity: 1; visibility: visible; transition-delay: 0s; }

.cp-reason { display: flex; align-items: flex-start; gap: 6px; margin: 8px 2px 0; color: var(--text-tertiary);
  font-size: 12.5px; line-height: 1.45; }
.cp-reason svg { margin-top: 2px; }

@media (hover: hover) and (pointer: fine) {
  .cp-tool:not(:disabled):hover { background: var(--cp-hover); color: var(--ib-text); }
  .cp-tool[aria-pressed="true"]:not(:disabled):hover { background: var(--ib-seg-on); }
  .cp-remove:not(:disabled):hover { background: var(--cp-hover); color: var(--ib-text); }
  .cp-play:hover { background: color-mix(in srgb, var(--ib-text) 10%, var(--ib-pill)); }
  .cp-send:not([aria-disabled="true"]):hover { background: color-mix(in srgb, var(--ib-text) 86%, var(--ib-card)); }
  .cp-send[data-mode="on"]:not([aria-disabled="true"]):hover::before { filter: brightness(1.12); }
  .cp-mode:not(:disabled):hover { color: var(--ib-text); }
  .cp-mode:not(:disabled):hover .cp-mode-track { box-shadow: inset 0 0 0 1px var(--ib-muted); }
  .cp-rec-btn:not(.is-done):hover { background: color-mix(in srgb, var(--st-fail) calc(22% * var(--chroma)), var(--ib-card)); color: var(--ib-text); }
  .cp-rec-btn.is-done:hover { background: color-mix(in srgb, var(--ib-text) 86%, var(--ib-card)); }
}
.cp-tool:active:not(:disabled):not(:focus-visible),
.cp-remove:active:not(:disabled):not(:focus-visible),
.cp-play:active:not(:focus-visible),
.cp-rec-btn:active:not(:focus-visible),
.cp-mode:active:not(:disabled):not(:focus-visible),
.cp-send:active:not([aria-disabled="true"]):not(:focus-visible) { transform: scale(0.97); }

/* Trigger menu (/ commands, $ skills): the menu's popover language — a card on the raised shadow, fixed (no ancestor's
   clip cuts it), as wide as the composer card, over it (under it when there is no room). A row: the name in mono ink,
   what it does in secondary text, a typical use in grey mono under it; the active row sits on the well. */
.cp-sg-probe { position: fixed; left: 0; top: 0; width: 100px; height: 0; visibility: hidden; pointer-events: none; }
.cp-sg { --cp-sg-well: color-mix(in srgb, var(--ib-text) 6%, var(--ib-card));
  position: fixed; z-index: 150; left: 0; top: 0; box-sizing: border-box; display: block;
  min-width: 240px; max-width: calc(100vw - 16px); max-height: min(360px, calc(100vh - 16px));
  overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scroll-padding-bottom: 34px;
  border-radius: 12px; background: var(--ib-card); color: var(--ib-text); text-align: left;
  box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow-raised); font-size: 13px; line-height: 18px;
  transform-origin: bottom left; animation: cp-sg-in 160ms var(--ease-out) both; }
.cp-sg[data-side="bottom"] { transform-origin: top left; animation-name: cp-sg-in-down; }
/* The box scrolls (its scrollHeight is the rows' full height — the placement measures it); the key hint stays at its
   foot. */
.cp-sg-list { padding: 4px; }
.cp-sg-group + .cp-sg-group { margin-top: 2px; padding-top: 2px; border-top: 1px solid var(--ib-card-border); }
.cp-sg-head { padding: 6px 10px 3px; color: var(--ib-muted); font-size: 11.5px; font-weight: 500; line-height: 16px;
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.cp-sg-row { display: flex; align-items: baseline; gap: 14px; min-height: 32px; padding: 6px 10px; border-radius: 8px;
  cursor: pointer; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
  transition: background-color var(--dur-press) ease; }
.cp-sg-row[aria-selected="true"] { background: var(--cp-sg-well); }
.cp-sg-name { flex: none; min-width: 8.5em; max-width: 42%; overflow: hidden; color: var(--ib-text); font-family: var(--mono);
  font-size: 12.5px; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; }
.cp-sg-text { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }
.cp-sg-desc { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
  color: var(--text-secondary); overflow-wrap: anywhere; }
.cp-sg-ex { overflow: hidden; color: var(--text-tertiary); font-family: var(--mono); font-size: 11.5px; line-height: 16px;
  white-space: nowrap; text-overflow: ellipsis; }
.cp-sg-foot { position: sticky; bottom: 0; padding: 6px 12px; border-top: 1px solid var(--ib-card-border);
  background: var(--ib-card); color: var(--text-tertiary);
  font-size: 11.5px; line-height: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 479px) {
  .cp-sg-row { flex-direction: column; align-items: stretch; gap: 2px; }
  .cp-sg-name { max-width: none; }
}

@keyframes cp-in { from { opacity: 0; transform: scale(0.95); } }
@keyframes cp-sg-in { from { opacity: 0; transform: translateY(4px) scale(0.98); } }
@keyframes cp-sg-in-down { from { opacity: 0; transform: translateY(-4px) scale(0.98); } }
@keyframes cp-fade { from { opacity: 0; } }
@keyframes cp-spin { to { transform: rotate(360deg); } }
@keyframes cp-rec { 50% { opacity: 0.3; } }
@keyframes cp-rise { from { opacity: 0; transform: translateY(70%); filter: blur(2px); } }
@keyframes cp-sweep { 0% { opacity: 1; transform: translateX(-110%); } 100% { opacity: 1; transform: translateX(110%); } }
@keyframes cp-ring { from { box-shadow: 0 0 0 0 color-mix(in srgb, var(--cp-night-a) 45%, transparent); }
  to { box-shadow: 0 0 0 10px color-mix(in srgb, var(--cp-night-a) 0%, transparent); } }

@container cp (max-width: 440px) { .cp-hint { display: none; } }
@container cp (max-width: 400px) { .cp-mode-text { display: none; } }
@media (pointer: coarse) {
  .cp-field { font-size: 16px; }
  .cp-bar { min-height: 52px; }
  .cp-tool { min-width: 44px; height: 44px; }
  .cp-tool.is-icon { width: 44px; }
  .cp-send { width: 44px; height: 44px; }
  .cp-send.has-label { width: auto; padding: 0 16px 0 18px; }
  .cp-mode { height: 44px; padding: 0 1px; }
  .cp-end { gap: 6px; }
  .cp-mode + .cp-send.has-label { padding: 0 12px 0 14px; }
  .cp-chip { height: 52px; }
  .cp-remove, .cp-play { width: 44px; height: 44px; }
  .cp-rec { height: 48px; }
  .cp-rec-btn { min-width: 44px; height: 44px; padding: 0 14px; }
  .cp-hint { display: none; }
  .cp-sg-row { min-height: 44px; }
  .cp-sg-foot { display: none; }
}
/* Reduced motion: everything switches at once (base styles), but the send spinner keeps turning. */
@media (prefers-reduced-motion: reduce) {
  .cp-spin { animation-duration: 0.9s !important; animation-iteration-count: infinite !important; }
  .cp-drop { transition: opacity 120ms ease, visibility 0s linear 120ms !important; }
  .cp-card[data-drag] .cp-drop { transition: opacity 120ms ease !important; }
}
`;
