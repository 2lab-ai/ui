/**
 * The session chip row of the soma-work dashboard’s panel head (`.panel-status / .ps-*`), redrawn in the library’s
 * language: a status pill tinted 14% in its st-* tone with the word pulled toward ink, a tabular clock, neutral
 * buttons with one ink primary, a danger tone, and 44px targets on touch. The row wraps; actions keep to the end.
 */
const tint = (tone: string) => `color-mix(in srgb, ${tone} 14%, var(--ib-card))`;
const toneText = (tone: string) => `color-mix(in srgb, ${tone} 70%, var(--ib-text))`;
const COLOR_T = 'var(--dur-press) ease';

export const styles = `
:host { display: block; min-width: 0; }
.sb { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; min-width: 0; font-size: 12.5px; line-height: 1.35; color: var(--ib-text-2); }

/* ── Status: icon + word, never colour alone ── */
.sb-chip {
  --sb-c: var(--ib-muted); --sb-t: var(--ib-text-2); --sb-bg: var(--ib-pill);
  display: inline-flex; flex: none; align-items: center; gap: 5px; height: 24px; padding: 0 10px 0 8px; border-radius: 999px;
  background: var(--sb-bg); color: var(--sb-t); white-space: nowrap; transition: background-color 300ms ease, color 300ms ease;
}
.sb-chip.is-running { --sb-c: var(--st-run); --sb-t: ${toneText('var(--st-run)')}; --sb-bg: ${tint('var(--st-run)')}; }
.sb-chip.is-waiting { --sb-c: var(--st-wait); --sb-t: ${toneText('var(--st-wait)')}; --sb-bg: ${tint('var(--st-wait)')}; }
.sb-chip.is-done { --sb-c: var(--st-done); --sb-t: ${toneText('var(--st-done)')}; --sb-bg: ${tint('var(--st-done)')}; }
.sb-chip.is-failed { --sb-c: var(--st-fail); --sb-t: ${toneText('var(--st-fail-text)')}; --sb-bg: ${tint('var(--st-fail)')}; }
.sb-icon { display: inline-grid; flex: none; place-items: center; width: 14px; height: 14px; color: var(--sb-c); transition: color 300ms ease; }
.sb-icon svg { width: 12px; height: 12px; }
.sb-word { font-weight: 600; }

/* ── Time: Started 14:05 · 3m 12s — the parts wrap as units ── */
.sb-time { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 0 5px; min-width: 0; font-variant-numeric: tabular-nums; }
.sb-time > * { white-space: nowrap; }
.sb-clock { display: inline-grid; flex: none; color: var(--ib-muted); }
.sb-clock svg { width: 13px; height: 13px; }
.sb-dot { color: var(--ib-muted); }
.sb-tick, .sb-dur { color: var(--ib-text); }

/* ── Actions at the end of the row (they wrap to the end of a new line in a narrow container) ── */
.sb-actions { display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 6px; min-width: 0; margin-left: auto; }
.sb-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 30px; padding: 3px 12px;
  border: 1px solid var(--ib-card-border); border-radius: 8px; background: var(--ib-card); color: var(--ib-text);
  font-size: 12.5px; font-weight: 500; line-height: 1.2; white-space: nowrap; -webkit-tap-highlight-color: transparent;
  transition: background-color ${COLOR_T}, border-color ${COLOR_T}, color ${COLOR_T}, opacity ${COLOR_T}, transform var(--dur-press) var(--ease-out);
}
.sb-bi { display: inline-grid; flex: none; place-items: center; }
.sb-bi svg { width: 14px; height: 14px; }
.sb-btn.is-primary { background: var(--ib-text); border-color: var(--ib-text); color: var(--ib-card); }
.sb-btn.is-danger { color: var(--st-fail-text); border-color: color-mix(in srgb, var(--st-fail) 40%, var(--ib-card-border)); }
.sb-btn.is-danger.is-primary { background: color-mix(in srgb, var(--st-fail) calc(100% * var(--chroma)), var(--ib-text)); border-color: color-mix(in srgb, var(--st-fail) calc(100% * var(--chroma)), var(--ib-text)); color: var(--ib-card); }
.sb-btn.is-danger:not(.is-primary)[data-armed] { background: ${tint('var(--st-fail)')}; border-color: var(--st-fail); color: ${toneText('var(--st-fail-text)')}; }
/* Quiet: borderless and muted, for a lesser action beside the others; the danger word keeps its colour */
.sb-btn.is-quiet { border-color: transparent; background: transparent; color: var(--ib-text-2); }
.sb-btn.is-quiet.is-danger { color: var(--st-fail-text); }
/* Pressed (a toggle that is on — Starred): the raised neutral chip, never a colour alone */
.sb-btn[aria-pressed="true"]:not(.is-primary) { background: var(--ib-seg-on); border-color: var(--ib-card-border); color: var(--ib-text); box-shadow: var(--ib-shadow); }
.sb-btn[aria-pressed="true"] svg[data-icon="star"] { fill: currentColor; }
.sb-btn[aria-pressed="true"] .sb-bi { color: var(--st-wait); }
.sb-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sb-btn[aria-busy="true"] { cursor: progress; }
.sb-btn:active:not(:disabled):not(:focus-visible) { transform: scale(0.97); }
.sb-link {
  display: inline-flex; align-items: center; gap: 4px; min-height: 30px; padding: 0 6px; border-radius: 8px;
  color: var(--accent); font-weight: 500; text-decoration: none; white-space: nowrap;
}
.sb-link svg { flex: none; width: 12px; height: 12px; }

/* ── Spinner (running, busy) ── */
.sb-spin { display: inline-block; flex: none; width: 10px; height: 10px; border: 2px solid var(--ib-pill); border-top-color: var(--st-run); border-right-color: var(--st-run); border-radius: 50%; animation: sb-spin 0.9s linear infinite; }
.sb-btn .sb-spin { width: 12px; height: 12px; border-width: 1.5px; border-color: color-mix(in srgb, currentColor 25%, transparent); border-top-color: currentColor; border-right-color: currentColor; }
@keyframes sb-spin { to { transform: rotate(360deg); } }

/* Hover: colour and border only, fine pointers only. */
@media (hover: hover) and (pointer: fine) {
  .sb-btn:hover:not(:disabled) { border-color: var(--ib-muted); }
  .sb-btn.is-primary:hover:not(:disabled) { border-color: var(--ib-text); opacity: 0.88; }
  .sb-btn.is-danger:hover:not(:disabled) { border-color: var(--st-fail); background: ${tint('var(--st-fail)')}; }
  .sb-btn.is-quiet:hover:not(:disabled) { border-color: transparent; background: var(--ib-pill); color: var(--ib-text); }
  .sb-btn.is-quiet.is-danger:hover:not(:disabled) { background: ${tint('var(--st-fail)')}; color: var(--st-fail-text); }
  .sb-btn.is-danger.is-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--st-fail) calc(100% * var(--chroma)), var(--ib-text)); opacity: 0.88; }
  .sb-link:hover { text-decoration: underline; }
}
/* 44px targets on touch and narrow screens. */
@media (pointer: coarse), (max-width: 639px) {
  .sb-btn { min-height: 44px; padding-inline: 14px; }
  .sb-link { min-height: 44px; padding-inline: 8px; }
}
/* Reduced motion: nothing moves (colour changes stay short). */
@media (prefers-reduced-motion: reduce) {
  .sb-btn:active:not(:disabled) { transform: none; }
  .sb-spin { animation: none; }
}
`;
