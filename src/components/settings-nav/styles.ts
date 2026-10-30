/**
 * Two shapes. Top (narrow viewports, or layout="top"): the filter row over a recessed track of section chips that
 * scrolls sideways; the current chip is the raised neutral chip (the segmented control's language). Side (from an
 * 840px viewport with layout="auto", or layout="side"): a column — search, “Modified only”, then the links; the
 * current link sits on the --ib-pill chip. The host places it (a sticky side column, or above the content).
 */
const side = (h: string): string => `
${h} .sn { gap: 12px; --sn-h: 32px; --sn-mod-h: 24px; }
${h} .sn-filter { flex-direction: column; align-items: stretch; gap: 8px; }
${h} .sn-mod { align-self: flex-start; padding: 0 2px; border: 0; border-radius: 6px; background: none; box-shadow: none; }
${h} .sn-mod:has(input:checked) { background: none; box-shadow: none; }
${h} .sn-list { flex-direction: column; gap: 2px; padding: 0; overflow: visible; border-radius: 0; background: none; box-shadow: none; }
${h} .sn-link {
  width: 100%; padding: 6px 10px; border: 0; border-radius: 8px; font-size: 13px; text-align: left;
}
${h} .sn-link[aria-current="true"] { background: var(--ib-pill); box-shadow: none; }
${h} .sn-count { margin-left: auto; }
${h} .sn-empty { padding: 0 10px; }
`;

export const styles = `
:host { display: block; min-width: 0; }
.sn { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.sn-notice[hidden] { display: none; }
::slotted([slot="notice"]) { margin: 0; }

.sn-filter { display: flex; align-items: center; gap: 8px; min-width: 0; }
.sn-search { position: relative; flex: 1 1 auto; min-width: 0; }
.sn-sicon { position: absolute; left: 10px; top: 50%; translate: 0 -50%; color: var(--ib-muted); pointer-events: none; }
.sn-q {
  box-sizing: border-box; width: 100%; min-height: 34px; margin: 0; padding: 6px 32px 6px 31px;
  border: 1px solid var(--ib-card-border); border-radius: 8px; background: var(--surface-raised); color: var(--ib-text);
  font: inherit; font-size: 13px; line-height: 1.35; -webkit-appearance: none; appearance: none;
  transition: border-color var(--dur-press) ease;
}
.sn-q::placeholder { color: var(--text-tertiary); opacity: 1; }
.sn-q::-webkit-search-cancel-button, .sn-q::-webkit-search-decoration { -webkit-appearance: none; appearance: none; }
.sn-qclear {
  position: absolute; right: 4px; top: 50%; translate: 0 -50%; display: grid; place-items: center; width: 26px; height: 26px;
  padding: 0; border: 0; border-radius: 6px; background: none; color: var(--ib-muted);
  transition: background-color var(--dur-press) ease, color var(--dur-press) ease;
}
.sn-qclear[hidden] { display: none; }
.sn-mod {
  display: inline-flex; flex: none; align-items: center; gap: 6px; min-height: var(--sn-mod-h, 34px); padding: 0 11px;
  border: 1px solid var(--ib-card-border); border-radius: 8px; background: var(--ib-card); color: var(--ib-text-2);
  font-size: 12.5px; font-weight: 500; line-height: 1.2; white-space: nowrap; cursor: pointer; user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: background-color var(--dur-press) ease, border-color var(--dur-press) ease, color var(--dur-press) ease, box-shadow var(--dur-press) ease;
}
.sn-mod:has(input:checked) { background: var(--ib-seg-on); color: var(--ib-text); box-shadow: var(--ib-shadow); }
.sn-mod input { flex: none; width: 14px; height: 14px; margin: 0; accent-color: var(--ib-text); cursor: pointer; }

.sn-nav { min-width: 0; }
.sn-list {
  position: relative; display: flex; gap: 2px; margin: 0; padding: 3px; list-style: none; overflow-x: auto;
  overscroll-behavior-x: contain; scrollbar-width: none; border-radius: 10px; background: var(--ib-seg);
  box-shadow: inset 0 0 0 1px var(--ib-card-border);
}
.sn-list::-webkit-scrollbar { display: none; }
.sn-list > li { flex: none; min-width: 0; }
.sn-link {
  display: inline-flex; align-items: center; gap: 6px; min-height: var(--sn-h, 30px); padding: 0 12px; border: 0; border-radius: 8px;
  background: none; color: var(--ib-text-2); font: inherit; font-size: 12.5px; font-weight: 500; line-height: 1.25;
  white-space: nowrap; cursor: pointer; -webkit-tap-highlight-color: transparent;
  transition: background-color var(--dur-press) ease, color var(--dur-press) ease, box-shadow var(--dur-press) ease,
    transform var(--dur-press) var(--ease-out);
}
.sn-link[aria-current="true"] {
  background: var(--ib-seg-on); color: var(--ib-text); font-weight: 600;
  box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow);
}
.sn-link[data-zero]:not([aria-current="true"]) { color: var(--ib-muted); }
.sn-link:focus-visible { outline: 2px solid var(--border-focus); outline-offset: -2px; }
.sn-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.sn-dot { flex: none; width: 5px; height: 5px; border-radius: 50%; background: var(--ib-text); }
.sn-count { flex: none; font-size: 11.5px; font-weight: 500; color: var(--ib-muted); font-variant-numeric: tabular-nums; }

.sn-empty { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; min-width: 0; font-size: 12.5px; line-height: 1.45; color: var(--ib-muted); }
/* Empty, the live region leaves the flow (no stray gap) but stays in the accessibility tree for the next message. */
.sn-empty:empty { position: absolute; }
.sn-clear {
  padding: 0; border: 0; border-radius: 4px; background: none; color: var(--accent); font: inherit; font-weight: 500; cursor: pointer;
}

${side(':host([layout="side"])')}
@media (min-width: 840px) {
${side(':host(:not([layout="top"]))')}
}

.sn-link:active:not(:focus-visible), .sn-mod:active, .sn-qclear:active:not(:focus-visible) { transform: scale(0.97); }
@media (hover: hover) and (pointer: fine) {
  .sn-link:not([aria-current="true"]):hover { color: var(--ib-text); background: color-mix(in srgb, var(--ib-pill) 70%, transparent); }
  .sn-q:hover:not(:focus) { border-color: var(--ib-muted); }
  .sn-mod:hover { border-color: var(--ib-muted); color: var(--ib-text); }
  .sn-qclear:hover { background: var(--ib-pill); color: var(--ib-text); }
  .sn-clear:hover { text-decoration: underline; text-underline-offset: 2px; }
}
@media (pointer: coarse), (max-width: 639px) {
  .sn-q { min-height: 44px; }
  .sn-mod { min-height: 44px; }
  .sn-link { min-height: 44px; }
  .sn-qclear { width: 36px; height: 36px; }
}
@media (pointer: coarse) {
  .sn-q { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .sn-link, .sn-mod, .sn-qclear { transition-duration: 0.01ms; }
  .sn-link:active, .sn-mod:active, .sn-qclear:active { transform: none; }
}
`;
