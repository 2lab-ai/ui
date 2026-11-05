/**
 * Every dot is a pill with two edges: a slot of 8px (the current one 36px), 6px apart. A change of step changes two
 * slot widths and every edge eases to its new place on 520ms `--ease-out` — it leaves at speed, no stall after a
 * full bar. The wake is a one-shot scaleY bump per crossed dot (`--i` = order crossed), the landing pill's squash
 * last. Colours are tokens: ink for done, the pill for to do, `--st-fail`, a hollow ring for skipped, `--st-run`.
 */
export const styles = `
:host { display: block; }
.st {
  --st-dot: 8px; --st-wide: 36px; --st-h: 8px;
  display: flex; flex-direction: column; align-items: flex-start; gap: 8px; min-width: 0;
}
:host([size="sm"]) .st { --st-dot: 6px; --st-wide: 28px; --st-h: 6px; gap: 6px; }
.st-list { display: flex; align-items: center; gap: 6px; max-width: 100%; min-height: var(--st-h); margin: 0; padding: 0; list-style: none; }
.st-step { position: relative; display: flex; align-items: center; flex: none; }
.st-dot {
  position: relative; display: block; width: var(--st-dot); height: var(--st-h); border-radius: 999px; overflow: hidden;
  background: color-mix(in srgb, var(--ib-text) 8%, var(--ib-pill)); pointer-events: none;
  transition: width 520ms var(--ease-out), background-color var(--dur-fade) ease;
}
.st-step[data-cur] .st-dot { width: var(--st-wide); }
.st-step[data-st="done"] .st-dot { background: color-mix(in srgb, var(--ib-text) 64%, var(--ib-pill)); }
.st-step[data-st="failed"] .st-dot { background: var(--st-fail); }
.st-step[data-st="skipped"] .st-dot { background: transparent; box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--ib-text) 34%, var(--ib-pill)); }
.st-step[data-st="current"] .st-dot { background: color-mix(in srgb, var(--st-run) calc(22% * var(--chroma)), var(--ib-pill)); }
.st-fill {
  position: absolute; inset: 0 auto 0 0; width: 0; border-radius: inherit; background: var(--st-run);
  transition: width var(--dur-move) var(--ease-out);
}
.st-busy { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; }
.st-band {
  position: absolute; inset: 0 auto 0 0; width: 50%; border-radius: inherit;
  background: linear-gradient(90deg, transparent, var(--st-run), transparent);
  animation: st-sweep 1.6s var(--ease-in-out) infinite;
}
@keyframes st-sweep { from { transform: translateX(-100%); } to { transform: translateX(200%); } }
.st-dot[data-wake] { animation: st-wake 420ms ease-in-out calc(var(--i, 0) * 60ms) both; }
.st-dot[data-wake="land"] { animation-name: st-land; }
@keyframes st-wake { 50% { transform: scaleY(1.34); } }
@keyframes st-land { 50% { transform: scaleY(0.91); } }
.st-hit {
  position: absolute; inset: 0; z-index: 1; display: block; margin: 0; padding: 0; border: 0; border-radius: 0;
  background: none; cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.st-hit::before { content: ''; position: absolute; inset: -8px -3px; }
.st-hit:focus-visible { outline: none; }
@media (hover: hover) and (pointer: fine) {
  .st-hit:hover + .st-dot { outline: 2px solid color-mix(in srgb, var(--ib-text) 18%, transparent); outline-offset: 2px; }
}
.st-hit:focus-visible + .st-dot { outline: 2px solid var(--border-focus); outline-offset: 2px; }
.st-cap {
  margin: 0; color: var(--ib-muted); font-size: 12px; font-weight: 500; line-height: 1.4;
  font-variant-numeric: tabular-nums; overflow-wrap: anywhere;
}
:host([size="sm"]) .st-cap { font-size: 11.5px; }
.st-cap[data-failed] { color: color-mix(in srgb, var(--st-fail-text) calc(80% * var(--chroma)), var(--ib-text)); }
@media (pointer: coarse) {
  :host([interactive]) .st-list { gap: 0; }
  :host([interactive]) .st-step { justify-content: center; min-width: 44px; min-height: 44px; }
  :host([interactive]) .st-hit::before { content: none; }
}
@media (prefers-reduced-motion: reduce) {
  .st-band { animation: none !important; transform: none; background: var(--st-run); }
  .st-dot[data-wake] { animation: none !important; }
}
`;
