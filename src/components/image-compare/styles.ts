export const styles = `
:host { display: block; min-width: 0; }
.cmp {
  position: relative; isolation: isolate; width: 100%; overflow: hidden; border-radius: 12px; background: var(--ib-col);
  cursor: ew-resize; touch-action: pan-y; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
}
/* The card's hairline drawn over the pictures, so it costs the box no width (the line maps 1:1 to the pointer). */
.cmp::after {
  content: ""; position: absolute; inset: 0; z-index: 5; border: 1px solid var(--ib-card-border); border-radius: inherit;
  pointer-events: none;
}
.cmp-before, .cmp-after { position: absolute; inset: 0; background: var(--ib-col); }
.cmp-after { z-index: 0; }
.cmp-before { z-index: 1; clip-path: inset(0 calc(100% - var(--pos)) 0 0); }
.cmp-img { display: block; width: 100%; height: 100%; object-fit: cover; -webkit-user-drag: none; }
.cmp[data-fit="contain"] .cmp-img { object-fit: contain; }
/* Whole pictures sit on a quiet wash, so their edges show against the box. */
.cmp[data-fit="contain"] .cmp-before, .cmp[data-fit="contain"] .cmp-after { background: color-mix(in srgb, var(--ib-text) 6%, var(--ib-col)); }
/* "No preview" sits in the middle of the part of the box its side shows. */
.cmp-none {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; overflow: hidden;
  color: var(--ib-muted); font-size: 12px; line-height: 1.3;
}
.cmp-before .cmp-none { padding-right: calc(100% - var(--pos)); }
.cmp-after .cmp-none { padding-left: var(--pos); }
.cmp-none-in {
  display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; padding: 8px; text-align: center;
  overflow-wrap: anywhere;
}
.cmp-none svg { width: 20px; height: 20px; }
.cmp-tag {
  position: absolute; top: 12px; left: 12px; z-index: 2; max-width: calc(50% - 24px); padding: 3px 10px;
  overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--ib-card) 90%, transparent);
  box-shadow: var(--ib-shadow); color: var(--ib-text); font-size: 12px; font-weight: 600; line-height: 18px;
  font-variant-numeric: tabular-nums; white-space: nowrap; text-overflow: ellipsis; pointer-events: none;
  transition: opacity var(--dur-fade) var(--ease-out);
}
.cmp-tag.is-after { left: auto; right: 12px; }
.cmp-tag[data-near] { opacity: 0; }
/* The line and the knob are the card's colour with a hairline of ink: they read over a light or a dark picture. */
.cmp-line {
  position: absolute; top: 0; bottom: 0; left: var(--pos); z-index: 3; width: 2px; margin-left: -1px;
  background: var(--ib-card); box-shadow: 0 0 0 1px color-mix(in srgb, var(--ib-text) 24%, transparent);
  pointer-events: none;
}
.cmp-knob {
  position: absolute; top: 50%; left: var(--pos); z-index: 4; display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; translate: -50% -50%; border: 1px solid var(--ib-card-border); border-radius: 50%;
  background: var(--ib-card); color: var(--ib-text); box-shadow: 0 2px 10px var(--scrim);
  transition: scale var(--dur-press) var(--ease-out), border-color var(--dur-press) ease;
}
.cmp-knob svg { flex: none; width: 14px; height: 14px; }
.cmp-knob svg + svg { margin-left: -3px; }
.cmp-knob:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
.cmp[data-held] .cmp-knob { scale: 0.94; }
@media (hover: hover) and (pointer: fine) {
  .cmp:hover .cmp-knob { border-color: var(--ib-muted); }
}
@media (pointer: coarse) {
  .cmp-knob { width: 44px; height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .cmp-tag, .cmp-knob { transition: none; }
  .cmp[data-held] .cmp-knob { scale: none; }
}
`;
