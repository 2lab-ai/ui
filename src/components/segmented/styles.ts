/**
 * The site's and the board's `.seg` (3px well, radius 10 / 8, raised neutral chip for "on"), with one thumb that
 * slides to the checked option. Options share one width (an equal grid), so the thumb is placed by CSS alone —
 * no measuring, right on first paint, and it follows any resize.
 */
export const styles = `
:host { display: inline-block; max-width: 100%; vertical-align: middle; }
:host([full]) { display: block; }
.sg {
  --sg-pad: 3px; --sg-gap: 2px; --sg-h: 28px;
  position: relative; display: inline-grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: var(--sg-gap);
  max-width: 100%; padding: var(--sg-pad); border-radius: 10px; background: var(--ib-seg);
  box-shadow: inset 0 0 0 1px var(--ib-card-border); vertical-align: middle;
}
:host([full]) .sg { display: grid; width: 100%; }
:host([size="sm"]) .sg { --sg-pad: 2px; --sg-h: 24px; border-radius: 9px; }
.sg-thumb {
  position: absolute; top: var(--sg-pad); bottom: var(--sg-pad); left: var(--sg-pad); border-radius: 8px;
  width: calc((100% - 2 * var(--sg-pad) - (var(--n) - 1) * var(--sg-gap)) / var(--n));
  background: var(--ib-seg-on); box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow);
  transform: translateX(calc(var(--i) * (100% + var(--sg-gap))));
  transition: transform var(--dur-move) var(--ease-out), opacity var(--dur-fade) ease;
  pointer-events: none;
}
:host([size="sm"]) .sg-thumb { border-radius: 7px; }
.sg[data-none] .sg-thumb { opacity: 0; transition: none; }
.sg-opt {
  position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 0;
  min-height: var(--sg-h); padding: 0 11px; border: 0; border-radius: 8px; background: none; color: var(--ib-muted);
  font: inherit; font-size: 12.5px; font-weight: 500; line-height: 1; white-space: nowrap; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: color var(--dur-press) ease, transform var(--dur-press) var(--ease-out);
}
:host([size="sm"]) .sg-opt { padding: 0 9px; font-size: 12px; border-radius: 7px; }
.sg-opt > svg { flex: none; width: 14px; height: 14px; }
.sg-opt.is-icon { padding: 0 8px; }
.sg-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.sg-opt[aria-checked="true"] { color: var(--ib-text); }
.sg-opt[aria-disabled="true"] { opacity: 0.45; cursor: not-allowed; }
.sg[aria-disabled="true"] .sg-opt { cursor: not-allowed; }
.sg[aria-disabled="true"] { opacity: 0.6; }
.sg-opt:focus-visible { outline: 2px solid var(--border-focus); outline-offset: -2px; }
.sg-opt:active:not([aria-disabled="true"]):not(:focus-visible) { transform: scale(0.97); }
@media (hover: hover) and (pointer: fine) {
  .sg:not([aria-disabled="true"]) .sg-opt:not([aria-disabled="true"]):hover { color: var(--ib-text); }
}
@media (pointer: coarse), (max-width: 639px) {
  .sg { --sg-h: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .sg-thumb { transition: opacity 120ms ease !important; }
}
`;
