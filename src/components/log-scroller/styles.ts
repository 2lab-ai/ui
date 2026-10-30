/**
 * A scroll box that is the reader's: no native scroll anchoring (the element keeps the place itself), a quiet row at
 * the top for older pages / the start of history, and a raised neutral "latest" pill that fades up from 4px.
 * Live-appended items enter with the tool-call recipe (3px + 2px blur, 360ms ease-out); history never animates.
 */
export const styles = `
:host { position: relative; display: flex; flex-direction: column; min-height: 0; }
.ui-root { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; }
.ls-vp {
  position: relative; flex: 1 1 auto; min-height: 0; overflow-x: hidden; overflow-y: auto; overflow-anchor: none;
  overscroll-behavior: contain; scrollbar-gutter: stable; border-radius: inherit;
}
.ls-vp:focus-visible { outline: 2px solid var(--border-focus); outline-offset: -2px; }
.ls-top { display: grid; place-items: center; min-height: 40px; padding: 4px 12px; }
.ls-top[hidden] { display: none; }
.ls-older {
  display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 4px 12px; border: 1px solid var(--ib-card-border);
  border-radius: 999px; background: var(--ib-card); color: var(--ib-text-2); font-size: 12px; font-weight: 500; line-height: 1.2;
  transition: background-color var(--dur-press) ease, border-color var(--dur-press) ease, color var(--dur-press) ease, transform var(--dur-press) var(--ease-out);
}
.ls-older svg { width: 12px; height: 12px; }
.ls-older[aria-busy="true"] { cursor: progress; border-color: transparent; background: transparent; color: var(--ib-muted); }
.ls-older:active:not([aria-busy="true"]):not(:focus-visible) { transform: scale(0.97); }
.ls-spin { width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid color-mix(in srgb, var(--ib-muted) 35%, transparent); border-top-color: var(--ib-muted); animation: ls-spin 0.9s linear infinite; }
.ls-start { display: flex; align-items: center; gap: 10px; width: 100%; margin: 0; color: var(--ib-muted); font-size: 11.5px; font-weight: 500; white-space: nowrap; }
.ls-start::before, .ls-start::after { content: ""; flex: 1 1 0; height: 1px; background: var(--ib-card-border); }
.ls-list { display: flow-root; min-width: 0; }
.ls-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-height: 120px; padding: 20px 12px; text-align: center; color: var(--ib-muted); font-size: 13px; line-height: 1.45; }
.ls-state[hidden] { display: none; }
.ls-state svg { width: 20px; height: 20px; }
.ls-loading { align-items: stretch; justify-content: flex-start; gap: 10px; }
.ls-sk { display: block; height: 10px; border-radius: 6px; background: var(--ib-pill); animation: ls-sk 1.6s ease-in-out infinite; }
.ls-sk:nth-child(1) { width: 62%; }
.ls-sk:nth-child(2) { width: 84%; animation-delay: 120ms; }
.ls-sk:nth-child(3) { width: 48%; animation-delay: 240ms; }
.ls-jump {
  position: absolute; left: 50%; bottom: 12px; z-index: 2; display: inline-flex; align-items: center; gap: 6px; min-height: 30px;
  padding: 4px 12px 4px 10px; border: 1px solid var(--ib-card-border); border-radius: 999px; background: var(--ib-seg-on);
  color: var(--ib-text); box-shadow: var(--ib-shadow-raised); font-size: 12.5px; font-weight: 500; line-height: 1.2; white-space: nowrap;
  font-variant-numeric: tabular-nums; translate: -50% 0; opacity: 0; visibility: hidden; transform: translateY(4px);
  transition: opacity var(--dur-fade) var(--ease-out), transform var(--dur-move) var(--ease-out), visibility 0s linear var(--dur-fade), border-color var(--dur-press) ease;
}
.ls-jump svg { width: 14px; height: 14px; color: var(--ib-muted); }
.ls-jump[data-show] { opacity: 1; visibility: visible; transform: none; transition: opacity var(--dur-fade) var(--ease-out), transform var(--dur-move) var(--ease-out), visibility 0s, border-color var(--dur-press) ease; }
.ls-jump:active:not(:focus-visible) { transform: scale(0.97); }
.ls-jump-n { color: var(--ib-text); font-weight: 600; }
::slotted([data-ls-enter]) { animation: ls-in 360ms var(--ease-out) both; }
@media (hover: hover) and (pointer: fine) {
  .ls-older:not([aria-busy="true"]):hover { border-color: var(--ib-muted); color: var(--ib-text); }
  .ls-jump:hover { border-color: var(--ib-muted); }
}
@media (pointer: coarse), (max-width: 639px) {
  .ls-older, .ls-jump { min-height: 44px; }
  .ls-top { min-height: 52px; }
}
@media (prefers-reduced-motion: reduce) {
  .ls-jump, .ls-jump[data-show], .ls-jump:active { transform: none; transition: opacity 120ms ease, visibility 0s linear 120ms; }
  .ls-older:active { transform: none; }
  ::slotted([data-ls-enter]) { animation: ls-fade 160ms ease both; }
  .ls-sk { animation: none; }
  .ls-spin { animation-duration: 0.9s !important; animation-iteration-count: infinite !important; }
}
@keyframes ls-in { from { opacity: 0; transform: translateY(3px); filter: blur(2px); } }
@keyframes ls-fade { from { opacity: 0; } }
@keyframes ls-spin { to { transform: rotate(360deg); } }
@keyframes ls-sk { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
`;
