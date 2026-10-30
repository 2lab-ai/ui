/**
 * A native `<dialog>` stretched over the viewport as a transparent box holding our scrim and the panel. Sheet
 * mode is modal (`showModal()`, scrim); dock mode is `show()` with no scrim, and the box lets the pointer through
 * to the page — only the panel takes it. `data-state` drives the slide (the same path and curve both ways),
 * `data-resizing` turns transitions off while the edge is dragged, `data-instant` while the mode switches over.
 */
export const styles = `
:host { display: contents; }
.dr {
  position: fixed; inset: 0; width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; padding: 0;
  border: 0; background: transparent; overflow: hidden; color: inherit; overscroll-behavior: contain;
}
.dr:not([open]) { display: none; }
.dr::backdrop { background: transparent; }
.dr[data-mode="dock"] { z-index: var(--ui-drawer-z, 30); pointer-events: none; }
.dr-scrim {
  position: absolute; inset: 0; background: var(--scrim); opacity: 0;
  transition: opacity var(--dur-fade) var(--ease-out);
  -webkit-tap-highlight-color: transparent;
}
.dr[data-state="open"] .dr-scrim { opacity: 1; }
.dr[data-mode="dock"] .dr-scrim { display: none; }
.dr-panel {
  --dr-w: 480px;
  position: absolute; top: 0; bottom: 0; right: 0; display: flex; flex-direction: column; min-height: 0;
  width: min(var(--dr-w), 100%); padding-bottom: env(safe-area-inset-bottom);
  background: var(--ib-card); color: var(--ib-text-2); box-shadow: var(--ib-shadow-raised);
  transform: translateX(100%);
  transition: transform var(--dur-move) var(--ease-drawer);
  pointer-events: auto;
}
.dr[data-side="left"] .dr-panel { right: auto; left: 0; transform: translateX(-100%); }
.dr[data-state="open"] .dr-panel { transform: none; }
.dr-panel:focus, .dr-panel:focus-visible { outline: none; }
.dr[data-mode="dock"] .dr-panel {
  top: var(--ui-drawer-top, 0px); width: min(var(--dr-w), calc(100% - 48px));
  border-left: 1px solid var(--ib-card-border); box-shadow: var(--ib-shadow);
}
.dr[data-mode="dock"][data-side="left"] .dr-panel { border-left: 0; border-right: 1px solid var(--ib-card-border); }
.dr[data-resizing] { cursor: col-resize; user-select: none; -webkit-user-select: none; }
.dr[data-resizing] .dr-panel { transition: none; }
.dr[data-instant] .dr-panel, .dr[data-instant] .dr-scrim { transition: none !important; }
.dr-head {
  display: flex; flex: none; align-items: flex-start; gap: 12px; padding: 14px 12px 12px 20px;
  border-bottom: 1px solid var(--ib-card-border);
}
.dr-head[hidden], .dr-title[hidden], .dr-foot[hidden] { display: none; }
.dr-title {
  flex: 1 1 auto; min-width: 0; margin: 0; padding: 5px 0 0; font-size: 15px; font-weight: 600; line-height: 1.4;
  color: var(--ib-text); overflow-wrap: anywhere;
}
.dr-close {
  display: inline-grid; flex: none; place-items: center; width: 32px; height: 32px; margin-left: auto; padding: 0;
  border: 0; border-radius: 8px; background: transparent; color: var(--ib-text-2);
  -webkit-tap-highlight-color: transparent;
  transition: background-color var(--dur-press) ease, color var(--dur-press) ease, transform var(--dur-press) var(--ease-out);
}
.dr-close > svg { width: 16px; height: 16px; }
.dr-close:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
.dr-close:active:not(:focus-visible) { transform: scale(0.97); }
.dr-body {
  flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 16px 20px 20px;
  font-size: 13.5px; line-height: 1.55; color: var(--ib-text-2); overflow-wrap: anywhere;
}
.dr-body ::slotted(:first-child) { margin-top: 0; }
.dr-body ::slotted(:last-child) { margin-bottom: 0; }
.dr-foot {
  display: flex; flex: none; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px;
  padding: 12px 16px; border-top: 1px solid var(--ib-card-border);
}
.dr-handle { position: absolute; top: 0; bottom: 0; left: -3px; z-index: 1; width: 6px; cursor: col-resize; touch-action: none; }
.dr[data-side="left"] .dr-handle { left: auto; right: -3px; }
.dr-handle::after {
  content: ''; position: absolute; top: 0; bottom: 0; left: 2px; width: 2px; background: transparent;
  transition: background-color var(--dur-press) ease;
}
.dr-handle:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
.dr-handle:focus-visible::after, .dr[data-resizing] .dr-handle::after { background: var(--ib-muted); }
@media (hover: hover) and (pointer: fine) {
  .dr-close:hover { background: var(--ib-pill); color: var(--ib-text); }
  .dr-handle:hover::after { background: var(--ib-muted); }
}
@media (pointer: coarse), (max-width: 639px) {
  .dr-close { width: 44px; height: 44px; margin: -6px -8px -6px auto; }
  .dr-handle { left: -12px; width: 24px; }
  .dr[data-side="left"] .dr-handle { right: -12px; }
  .dr-handle::after { left: 11px; }
}
@media (max-width: 639px) {
  .dr-handle { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .dr-panel, .dr[data-side="left"] .dr-panel { transform: none !important; }
  .dr:not([data-state="open"]) .dr-panel { opacity: 0; }
  .dr-scrim, .dr-panel { transition: opacity 120ms ease !important; }
}
`;
