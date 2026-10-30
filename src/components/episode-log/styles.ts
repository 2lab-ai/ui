/**
 * Episode log — a dated observation log. Day headings are 13 / 650 section heads with a quiet count; entries are
 * hairline-separated rows (time in tabular figures, text with its line breaks); edit happens in place; the note box
 * sits at the foot with the one ink button.
 */
export const styles = `
.el { display: flex; flex-direction: column; gap: 12px; container: el / inline-size; color: var(--ib-text); font-size: 13.5px; }
.el-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; }
.el-filter { display: inline-flex; align-items: center; gap: 8px; min-width: 0; font-size: 12.5px; font-weight: 500; color: var(--ib-muted); }
.el-select { box-sizing: border-box; min-width: 0; max-width: 100%; min-height: 32px; padding: 5px 30px 5px 10px; border: 1px solid var(--ib-card-border);
  border-radius: 8px; color: var(--ib-text); font-size: 13px; cursor: pointer; appearance: none; -webkit-appearance: none;
  background: var(--surface-raised) no-repeat;
  background-image: linear-gradient(45deg, transparent 50%, var(--ib-muted) 50%), linear-gradient(135deg, var(--ib-muted) 50%, transparent 50%);
  background-position: calc(100% - 16px) 52%, calc(100% - 12px) 52%; background-size: 4px 4px;
  transition: border-color 150ms ease; font-variant-numeric: tabular-nums; }
.el-select:disabled { opacity: 0.55; cursor: not-allowed; }
.el-status { display: inline-flex; align-items: center; gap: 4px; margin: 0; min-height: 18px; font-size: 12.5px;
  color: color-mix(in srgb, var(--st-done) 70%, var(--ib-text)); animation: el-rise var(--dur-fade) var(--ease-out) both; }
.el-status:empty { display: none; }
.el-status svg { width: 12px; height: 12px; }
.el-alert, .el-notice { display: flex; align-items: flex-start; gap: 8px; margin: 0; padding: 10px 12px; border-radius: 10px; font-size: 13px;
  line-height: 1.45; overflow-wrap: anywhere; animation: el-rise var(--dur-fade) var(--ease-out) both; }
.el-alert { border: 1px solid color-mix(in srgb, var(--st-fail) 35%, var(--ib-card-border)); background: color-mix(in srgb, var(--st-fail) 14%, var(--ib-card));
  color: color-mix(in srgb, var(--st-fail-text) 70%, var(--ib-text)); }
.el-alert svg { flex: none; margin-top: 2px; color: var(--st-fail); }
.el-notice { border: 1px solid var(--ib-card-border); background: var(--ib-card); color: var(--ib-text-2); }
.el-notice svg { flex: none; margin-top: 2px; color: var(--ib-muted); }

.el-days { display: flex; flex-direction: column; gap: 16px; }
.el-group { margin: 0; }
.el-day { display: flex; align-items: baseline; gap: 8px; margin: 0 0 4px; font-size: 13px; font-weight: 650; letter-spacing: -0.006em;
  line-height: 1.35; color: var(--ib-text); }
.el-day small { font-size: 12px; font-weight: 500; letter-spacing: 0; color: var(--ib-muted); font-variant-numeric: tabular-nums; }
.el-list { margin: 0; padding: 0; list-style: none; }
.el-entry { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 2px 12px; padding: 10px 0; border-top: 1px solid var(--ib-card-border); }
.el-entry:first-child { border-top: 0; }
.el-entry.is-new { animation: el-in 320ms var(--ease-out) both; }
.el-time { padding-top: 1px; font-size: 12px; font-weight: 500; line-height: 1.45; color: var(--ib-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.el-time small { font-size: 10.5px; }
.el-main { display: flex; flex-direction: column; gap: 6px; min-width: 0; grid-column: 2; }
.el-text { margin: 0; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ib-text); }
.el-none { padding: 10px 0; font-size: 13px; color: var(--ib-muted); }

.el-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; }
.el-actions.is-quiet { margin-left: -6px; }
.el-link { display: inline-flex; align-items: center; gap: 4px; min-height: 26px; padding: 2px 6px; border: 0; border-radius: 6px; background: none;
  color: var(--ib-muted); font-size: 12px; font-weight: 500; cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease, transform var(--dur-press) var(--ease-out); }
.el-link svg { width: 12px; height: 12px; }
.el-link.is-armed { background: color-mix(in srgb, var(--st-fail) 14%, var(--ib-card)); color: color-mix(in srgb, var(--st-fail-text) 70%, var(--ib-text)); }
.el-link:disabled { opacity: 0.5; cursor: not-allowed; }

.el-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box; min-height: 32px; padding: 5px 12px;
  border: 1px solid var(--ib-card-border); border-radius: 8px; background: var(--ib-card); color: var(--ib-text); font-size: 13px; font-weight: 500;
  line-height: 1.2; white-space: nowrap; cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, opacity 150ms ease, transform var(--dur-press) var(--ease-out); }
.el-btn.is-primary { background: var(--ib-text); border-color: var(--ib-text); color: var(--ib-card); }
.el-btn:disabled { opacity: 0.5; cursor: not-allowed; }

textarea { display: block; box-sizing: border-box; width: 100%; min-height: 64px; margin: 0; padding: 8px 10px; border: 1px solid var(--ib-card-border);
  border-radius: 8px; background: var(--surface-raised); color: var(--ib-text); font-size: 13px; line-height: 1.5; resize: none; overflow: hidden;
  transition: border-color 150ms ease; }
textarea::placeholder { color: var(--text-tertiary); }
textarea:disabled { opacity: 0.6; }
.el-hint { margin: 0; font-size: 12px; color: var(--ib-muted); }
.el-hint.is-error { color: color-mix(in srgb, var(--st-fail-text) 70%, var(--ib-text)); }

.el-add { display: flex; flex-direction: column; gap: 6px; padding-top: 12px; border-top: 1px solid var(--ib-card-border); }
.el-add-label { font-size: 12.5px; font-weight: 600; color: var(--ib-text-2); }
.el-add-row { display: flex; justify-content: flex-end; }

.el-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 22px 12px; text-align: center; color: var(--ib-muted); }
.el-empty p { margin: 0; max-width: 34ch; font-size: 13px; line-height: 1.45; }
.el-skel { display: flex; flex-direction: column; gap: 14px; padding: 6px 0; }
.el-sk-row { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 12px; }
.el-sk { display: block; height: 12px; border-radius: 6px; background: var(--ib-pill); animation: el-pulse 1.6s ease-in-out infinite;
  animation-delay: calc(var(--i, 0) * 120ms); }
.el-sk.is-time { width: 40px; }

:is(.el-btn, .el-link, .el-select):focus-visible, textarea:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
:is(.el-btn, .el-link):active:not(:disabled):not(:focus-visible) { transform: scale(0.97); }

@media (hover: hover) and (pointer: fine) {
  .el-btn:hover:not(:disabled) { border-color: var(--ib-muted); }
  .el-btn.is-primary:hover:not(:disabled) { border-color: var(--ib-text); opacity: 0.88; }
  .el-link:hover:not(:disabled) { background: var(--ib-pill); color: var(--ib-text); }
  .el-link.is-armed:hover:not(:disabled) { background: color-mix(in srgb, var(--st-fail) 20%, var(--ib-card)); color: color-mix(in srgb, var(--st-fail-text) 70%, var(--ib-text)); }
  .el-select:hover:not(:disabled), textarea:hover:not(:disabled):not(:focus) { border-color: var(--ib-muted); }
}
@container el (max-width: 420px) {
  .el-entry { grid-template-columns: minmax(0, 1fr); }
  .el-main { grid-column: 1; }
  .el-add-row .el-btn { flex: 1; }
}
@media (pointer: coarse), (max-width: 639px) {
  .el-btn, .el-select { min-height: 44px; }
  .el-link { min-height: 36px; padding-inline: 8px; }
}
@media (pointer: coarse) { textarea, .el-select { font-size: 16px; } }
@media (prefers-reduced-motion: reduce) {
  .el-entry.is-new, .el-status, .el-alert, .el-notice { animation: el-fade 120ms ease both; }
  .el-sk { animation: none; }
}
@keyframes el-in { from { opacity: 0; transform: translateY(3px); filter: blur(2px); } }
@keyframes el-rise { from { opacity: 0; transform: translateY(2px); } }
@keyframes el-fade { from { opacity: 0; } }
@keyframes el-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
`;
