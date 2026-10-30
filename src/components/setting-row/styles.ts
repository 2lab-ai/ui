/**
 * One preference row inside a host card: a top hairline between rows (none on the first), 14px 16px padding, the
 * meta (label, description, hints) beside the control from 560px of row width and above it below that (container
 * query, so the row follows the box it is given). Modified = an ink dot hung in the left padding, not a coloured
 * rail. Status words rise in once (opacity + 2px, fade duration) when they change; nothing moves on first paint.
 */
const done = 'color-mix(in srgb, var(--st-done) 70%, var(--ib-text))';
const fail = 'color-mix(in srgb, var(--st-fail-text) 70%, var(--ib-text))';

export const styles = `
:host { display: block; min-width: 0; }
.ui-root { container: srow / inline-size; }
.sr {
  position: relative; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px 24px; padding: 14px 16px;
  border-top: 1px solid var(--ib-card-border);
}
:host(:first-of-type) .sr, :host([data-first]) .sr { border-top: 0; }
@container srow (min-width: 560px) {
  .sr { grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); align-items: start; }
}
.sr-meta { min-width: 0; }
.sr-head {
  position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 2px 8px; margin: 0;
  font-size: 13.5px; font-weight: 600; line-height: 1.35; letter-spacing: -0.006em; color: var(--ib-text);
}
.sr-name { min-width: 0; overflow-wrap: anywhere; }
.sr-dot {
  position: absolute; left: -11px; top: calc(0.675em - 3px); width: 6px; height: 6px; border-radius: 50%;
  background: var(--ib-text);
}
.sr-badge {
  display: inline-flex; flex: none; align-items: center; height: 18px; padding: 0 6px; border-radius: 6px;
  background: var(--ib-pill); color: var(--ib-text-2); font-size: 11px; font-weight: 600; line-height: 1; letter-spacing: 0;
}
.sr-desc { margin: 3px 0 0; font-size: 12.5px; line-height: 1.45; color: var(--ib-text-2); overflow-wrap: anywhere; }
.sr-hints {
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; margin-top: 7px; font-size: 11.5px; line-height: 1.45;
  color: var(--ib-muted); font-variant-numeric: tabular-nums;
}
.sr-hint { min-width: 0; overflow-wrap: anywhere; }
.sr-hints code {
  padding: 1px 5px; border-radius: 5px; background: var(--ib-pill); color: var(--ib-text-2); font-family: var(--mono);
  font-size: 11px;
}
.sr-reset {
  position: relative; padding: 0; border: 0; border-radius: 4px; background: none; color: var(--accent); font: inherit;
  font-weight: 500; cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.sr-control { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; }
.sr-slot { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; align-self: stretch; min-width: 0; }
::slotted(*) { max-width: 100%; }
.sr-locked { min-width: 0; }
.sr-lockline { display: flex; align-items: center; gap: 6px; min-height: 22px; font-size: 13px; color: var(--ib-text-2); }
.sr-lock { flex: none; color: var(--ib-muted); }
.sr-value { min-width: 0; overflow-wrap: anywhere; color: var(--ib-text); font-weight: 500; }
.sr-reason { margin: 2px 0 0; font-size: 12px; line-height: 1.45; color: var(--ib-muted); overflow-wrap: anywhere; }
.sr-live { min-width: 0; font-size: 12.5px; line-height: 18px; color: var(--ib-text-2); }
.sr-control > .sr-live:not(:empty) { margin-top: 6px; }
.sr-msg { display: inline-flex; align-items: flex-start; gap: 5px; min-width: 0; overflow-wrap: anywhere; }
.sr-msg > svg, .sr-spin { flex: none; margin-top: 3px; }
.sr-msg[data-state="saved"] { color: ${done}; }
.sr-msg[data-state="error"] { color: ${fail}; }
.sr-spin {
  width: 11px; height: 11px; border: 1.5px solid currentColor; border-right-color: transparent; border-radius: 50%;
  opacity: 0.7; animation: sr-spin 0.9s linear infinite;
}
.sr[data-anim] .sr-msg { transition: opacity var(--dur-fade) var(--ease-out), transform var(--dur-fade) var(--ease-out); }
@starting-style {
  .sr[data-anim] .sr-msg { opacity: 0; transform: translateY(2px); }
}
@media (hover: hover) and (pointer: fine) {
  .sr-reset:hover { text-decoration: underline; text-underline-offset: 2px; }
}
.sr-reset:active:not(:focus-visible) { transform: scale(0.97); }
@media (pointer: coarse), (max-width: 639px) {
  .sr-reset::after { content: ''; position: absolute; inset: -12px -6px; }
}
@media (prefers-reduced-motion: reduce) {
  .sr[data-anim] .sr-msg { transition: none; }
  .sr-reset:active { transform: none; }
  .sr-spin { animation: none; }
}
@keyframes sr-spin { to { transform: rotate(360deg); } }
`;
