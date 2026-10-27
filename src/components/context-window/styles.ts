/** Ported from the soma-work dashboard (.prd/affectui/re-context-window.md D5–D19). */
export const styles = `
:host { --cw-c1: var(--accent); --cw-c2: color-mix(in srgb, var(--accent) 42%, var(--ib-pill)); --cw-c3: var(--purple); --cw-c4: var(--green);
  --cw-free: var(--ib-pill); --cw-warn: var(--st-wait); --cw-warn-bg: color-mix(in srgb, var(--st-wait) 14%, transparent);
  --cw-full-bg: color-mix(in srgb, var(--st-fail) 12%, transparent); --cw-ok: var(--green); }
.cw { container: cw / inline-size; max-width: 640px; position: relative; padding-bottom: 2px; font-size: 12.5px; color: var(--text-secondary); }
.cw-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 22px; }
.cw-title { font-size: 13px; font-weight: 600; color: var(--text); }
.cw-model { flex: none; max-width: 62%; height: 20px; padding: 0 7px; border-radius: 5px; background: var(--ib-pill); font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px; line-height: 20px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cw-figure { display: flex; align-items: baseline; gap: 7px; margin-top: 6px; }
.cw-big { font-size: 24px; font-weight: 600; line-height: 30px; letter-spacing: -0.02em; color: var(--text); font-variant-numeric: tabular-nums; }
.cw-of { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--text-tertiary); }
.cw-pill { flex: none; padding: 0 6px; border-radius: 5px; line-height: 20px; font-variant-numeric: tabular-nums; color: var(--text-secondary); transition: color 300ms ease, background-color 300ms ease; }
.cw[data-level="warn"] .cw-pill { color: var(--cw-warn); background: var(--cw-warn-bg); }
.cw[data-level="full"] .cw-pill { color: var(--st-fail-text); background: var(--cw-full-bg); font-weight: 600; }
.cw-field { display: grid; grid-template-columns: repeat(36, minmax(0, 1fr)); gap: 2px; margin-top: 10px; }
.cw-cell { display: block; aspect-ratio: 1; border-radius: 2px; background: var(--c, var(--cw-free)); transition: background-color 380ms var(--ease-out), opacity 220ms ease, transform var(--dur-move) var(--ease-out), box-shadow 380ms var(--ease-out); transition-delay: calc(var(--i) * 2ms), 0s, 0s, 0s; }
/* Past the auto-compact point an empty cell is a hollow square: the session compacts before it fills. */
.cw-cell[data-past]:not([data-part]) { background: transparent; box-shadow: inset 0 0 0 1px var(--border); }
.cw-field[data-hot] .cw-cell[data-part]:not([data-on]) { opacity: 0.22; }
.cw-cell[data-on] { transform: scale(1.12); }
.cw-cell[data-busy] { opacity: 0.5; }
@keyframes cw-wave { 0%, 100% { opacity: 1; transform: none; } 50% { opacity: 0.28; transform: scale(0.72); } }
@keyframes cw-swap-in { from { opacity: 0; filter: blur(2px); } }
@keyframes cw-leave { to { opacity: 0; filter: blur(3px); transform: scale(0.92); } }
@keyframes cw-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: no-preference) {
  .cw-cell[data-busy] { animation: cw-wave 900ms ease-in-out infinite; animation-delay: calc(var(--i) * 15ms); }
  .cw-spin { animation: cw-spin 700ms linear infinite; }
}
.cw-parts { list-style: none; margin: 8px 0 0; padding: 0; }
.cw-part, .cw-mark { display: flex; align-items: center; gap: 9px; min-height: 30px; margin: 0 -8px; padding: 0 8px; border-radius: 8px; transition: background-color var(--dur-press) ease, opacity 220ms ease; }
.cw-part[data-hot] { background: var(--ib-pill); }
.cw-part[data-dim], .cw-mark[data-dim] { opacity: 0.55; }
.cw-sw { flex: none; width: 7px; height: 7px; border-radius: 2px; }
.cw-sw.is-mark { background: transparent; box-shadow: inset 0 0 0 1px var(--text-tertiary); }
.cw-label { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 13px; color: var(--text); }
.cw-mark .cw-label { color: var(--text-secondary); }
.cw-val { flex: none; min-width: 52px; text-align: right; font-size: 13px; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
.cw-foot { display: flex; align-items: center; gap: 8px; min-height: 38px; margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border); }
.cw-say { flex: 1; min-width: 0; display: grid; }
.cw-say-t { grid-area: 1 / 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--text-secondary); font-variant-numeric: tabular-nums; animation: cw-swap-in 320ms ease both; }
.cw-say-t b { font-weight: 600; color: var(--text); }
.cw-say-t.is-warn { color: var(--cw-warn); }
.cw-say-t.is-full, .cw-say-t.is-fail { color: var(--st-fail-text); }
.cw-say-t.is-ok, .cw-say-t.is-ok b { color: var(--cw-ok); }
.cw-compact { display: inline-flex; flex: none; align-items: center; gap: 5px; min-height: 28px; padding: 0 9px 0 7px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); font: inherit; font-size: 12.5px; font-weight: 600; color: var(--text); white-space: nowrap; cursor: pointer; transition: background-color var(--dur-press) ease, color var(--dur-press) ease, border-color var(--dur-press) ease; }
.cw-compact:hover:not(:disabled) { background: var(--surface-raised); }
.cw-compact:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.cw-compact:disabled { cursor: default; opacity: 0.5; }
.cw-compact[data-state="armed"] { border-color: var(--cw-warn); color: var(--cw-warn); }
.cw-compact[data-state="busy"], .cw-compact[data-state="done"] { opacity: 1; }
.cw-compact[data-state="done"] { border-color: transparent; background: transparent; color: var(--cw-ok); }
.cw-compact[data-leaving] { animation: cw-leave 400ms var(--ease-out) both; }
.cw-ci, .cw-ct { display: inline-flex; align-items: center; animation: cw-swap-in 300ms ease both; }
.cw-ci svg { width: 12px; height: 12px; }
.cw-spin { display: block; width: 12px; height: 12px; border: 1.5px solid var(--border); border-top-color: var(--text); border-radius: 50%; }
@container cw (max-width: 309px) {
  .cw-field { grid-template-columns: repeat(24, minmax(0, 1fr)); }
  .cw-model { max-width: 42%; }
  .cw-compact { padding: 0 8px; }
  .cw-ct { display: none; }
}
@container cw (min-width: 520px) { .cw-field { grid-template-columns: repeat(54, minmax(0, 1fr)); } }
@media (pointer: coarse), (max-width: 639px) { .cw-compact { min-height: 44px; } .cw-part, .cw-mark { min-height: 36px; } }
`;
