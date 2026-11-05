/**
 * One line, one height: [mark] [label] [· time] [· detail]. The marks are the kit's own: the working ring is
 * `.ui-spinner` (0.9s turn, a 25% track, the head in the tone), the waiting dot pulses like the island's, done and
 * failed are the check and the cross, idle is the kit's hollow dot. While working the label carries a slow sweep —
 * the text painted with a gradient (`background-clip: text`) of muted ink and full ink, 2.2s linear. A new label
 * swaps in place: the old one leaves upward and fades, the new one rises from below (220ms `--ease-out`), both
 * clipped by the label's own box so the line never changes height. The label gives way first: its shrink weight is a
 * hundred times the detail's, so the time and the detail keep their words until the label is down to its ellipsis.
 */
export const styles = `
:host { display: block; min-width: 0; }
.wk {
  --wk-h: 20px; --wk-gap: 6px; --wk-mark: 16px; --wk-ring: 14px; --wk-ring-w: 2px; --wk-dot: 8px; --wk-icon: 14px;
  --wk-tone: var(--ib-muted);
  display: flex; align-items: center; gap: var(--wk-gap); min-width: 0; height: var(--wk-h); overflow: hidden;
  color: var(--ib-text); font-size: 13px; line-height: var(--wk-h); white-space: nowrap;
}
:host([size="sm"]) .wk {
  --wk-h: 18px; --wk-gap: 5px; --wk-mark: 14px; --wk-ring: 11px; --wk-ring-w: 1.8px; --wk-dot: 7px; --wk-icon: 12px;
  font-size: 12px;
}
.wk[data-state="working"] { --wk-tone: var(--st-run); }
.wk[data-state="waiting"] { --wk-tone: var(--st-wait); }
.wk[data-state="done"] { --wk-tone: var(--st-done); }
.wk[data-state="failed"] { --wk-tone: var(--st-fail); }

/* ── The mark: the tone colour on the mark only (in mono too) ── */
.wk-mark {
  display: inline-grid; flex: none; place-items: center; width: var(--wk-mark); height: var(--wk-mark);
  color: var(--wk-tone);
}
.wk-mark svg { width: var(--wk-icon); height: var(--wk-icon); }
.wk-ring {
  position: relative; display: block; box-sizing: border-box; width: var(--wk-ring); height: var(--wk-ring);
  border-radius: 50%; border: var(--wk-ring-w) solid color-mix(in srgb, var(--wk-tone) 25%, transparent);
  border-top-color: var(--wk-tone); border-right-color: var(--wk-tone); animation: wk-spin 0.9s linear infinite;
}
.wk-dot { position: relative; display: block; width: var(--wk-dot); height: var(--wk-dot); border-radius: 50%; background: var(--wk-tone); }
.wk[data-state="waiting"] .wk-dot::after {
  content: ''; position: absolute; inset: 0; border-radius: inherit; background: var(--wk-tone);
  animation: wk-pulse 1.6s var(--ease-out) infinite;
}
.wk[data-state="idle"] .wk-dot { background: transparent; box-shadow: inset 0 0 0 1.5px var(--wk-tone); }

/* ── The label: gives way first, ellipsizes, swaps inside its own box ── */
.wk-label {
  position: relative; flex: 0 100 auto; min-width: 0; height: var(--wk-h); overflow: hidden; font-weight: 500;
}
.wk[data-state="idle"] .wk-label { color: var(--ib-text-2); }
.wk-text { display: block; overflow: hidden; text-overflow: ellipsis; }
.wk-was { position: absolute; inset: 0; }
.wk-label.is-swap > .wk-now { animation: wk-rise 220ms var(--ease-out) both; }
.wk-label.is-swap > .wk-was { animation: wk-leave 220ms var(--ease-out) both; }
.wk-now.is-sweep {
  --wk-dim: color-mix(in srgb, var(--ib-muted) 70%, var(--ib-text));
  color: transparent; -webkit-background-clip: text; background-clip: text;
  background-image: linear-gradient(90deg, var(--wk-dim) 0% 38%, var(--ib-text) 50%, var(--wk-dim) 62% 100%);
  background-size: 250% 100%; background-repeat: no-repeat;
  animation: wk-sweep 2.2s linear infinite;
}
.wk-label.is-swap > .wk-now.is-sweep { animation: wk-rise 220ms var(--ease-out) both, wk-sweep 2.2s linear infinite; }

/* ── Time and detail: muted, tabular, after a dot ── */
.wk-time, .wk-detail { color: var(--ib-muted); font-variant-numeric: tabular-nums; }
.wk-time { flex: none; }
.wk-detail { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.wk[data-state="failed"] .wk-time {
  color: color-mix(in srgb, var(--st-fail-text) calc(80% * var(--chroma)), var(--ib-text));
}
/* The dot is not read: generated content with empty alt text (the first value where alt text is unknown). */
[data-sep]::before { content: '·'; content: '·' / ''; margin-inline-end: var(--wk-gap); color: var(--ib-muted); }

@keyframes wk-spin { to { transform: rotate(360deg); } }
@keyframes wk-pulse { from { opacity: 0.45; scale: 1; } to { opacity: 0; scale: 2.4; } }
@keyframes wk-sweep { from { background-position: 100% 0; } to { background-position: 0% 0; } }
@keyframes wk-rise { from { opacity: 0; transform: translateY(65%); } }
@keyframes wk-leave { to { opacity: 0; transform: translateY(-65%); } }

@media (forced-colors: active) {
  .wk-now.is-sweep { color: inherit; background: none; }
}
/* Reduced motion: the ring stands still with a dot in it (the kit's spinner), no pulse, no sweep, no slide. */
@media (prefers-reduced-motion: reduce) {
  .wk-ring { animation: none; border-color: color-mix(in srgb, var(--wk-tone) 25%, transparent); }
  .wk-ring::after {
    content: ''; position: absolute; inset: 0; width: 4px; height: 4px; margin: auto; border-radius: 50%;
    background: var(--wk-tone);
  }
  .wk[data-state="waiting"] .wk-dot::after { animation: none; display: none; }
  .wk-now.is-sweep { animation: none; color: inherit; background: none; }
  .wk-label.is-swap > * { animation: none; }
  .wk-was { display: none; }
}
`;
