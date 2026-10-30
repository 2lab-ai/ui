/**
 * A native `<dialog>` stretched over the viewport as a transparent box (its own `::backdrop` unused), holding our
 * scrim (fades) and panel (moves) — so both have real exits. `data-state` on the dialog drives the motion:
 * closed → open transitions in, open → closing transitions out, and the element closes the dialog when the exit
 * is over. Phones get a bottom sheet unless `sheet="never"`.
 */
export const styles = `
:host { display: contents; }
.dg {
  position: fixed; inset: 0; display: grid; place-items: center;
  width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; padding: 0; border: 0;
  background: transparent; overflow: hidden; color: inherit; overscroll-behavior: contain;
}
.dg:not([open]) { display: none; }
.dg::backdrop { background: transparent; }
.dg-scrim {
  position: absolute; inset: 0; background: var(--scrim); opacity: 0;
  transition: opacity var(--dur-fade) var(--ease-out);
  -webkit-tap-highlight-color: transparent;
}
.dg[data-state="open"] .dg-scrim { opacity: 1; }
.dg-panel {
  --dg-w: 560px;
  position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0;
  width: min(var(--dg-w), calc(100% - 32px)); max-height: calc(100dvh - 48px);
  border-radius: 16px; background: var(--ib-card); color: var(--ib-text-2);
  box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow-raised);
  opacity: 0; transform: translateY(8px) scale(0.97);
  transition: opacity var(--dur-fade) var(--ease-out), transform var(--dur-fade) var(--ease-out);
}
.dg[data-state="open"] .dg-panel {
  opacity: 1; transform: none;
  transition: opacity var(--dur-expand) var(--ease-out), transform var(--dur-expand) var(--ease-out);
}
.dg-panel:focus, .dg-panel:focus-visible { outline: none; }
.dg[data-size="sm"] .dg-panel { --dg-w: 400px; }
.dg[data-size="lg"] .dg-panel { --dg-w: 720px; }
.dg[data-size="xl"] .dg-panel { --dg-w: 960px; }
.dg[data-size="full"] .dg-panel { width: calc(100% - 32px); height: calc(100dvh - 32px); max-height: none; }
.dg-grab { display: none; flex: none; width: 36px; height: 4px; margin: 8px auto 0; border-radius: 2px; background: var(--ib-pill); }
.dg-head { display: flex; flex: none; align-items: flex-start; gap: 12px; padding: 16px 14px 8px 20px; }
.dg-head[hidden], .dg-title[hidden], .dg-foot[hidden] { display: none; }
.dg-title {
  flex: 1 1 auto; min-width: 0; margin: 0; padding: 5px 0 0; font-size: 15px; font-weight: 600; line-height: 1.4;
  color: var(--ib-text); overflow-wrap: anywhere;
}
.dg-close {
  display: inline-grid; flex: none; place-items: center; width: 32px; height: 32px; margin-left: auto; padding: 0;
  border: 0; border-radius: 8px; background: transparent; color: var(--ib-text-2);
  -webkit-tap-highlight-color: transparent;
  transition: background-color var(--dur-press) ease, color var(--dur-press) ease, transform var(--dur-press) var(--ease-out);
}
.dg-close > svg { width: 16px; height: 16px; }
.dg-close:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
.dg-close:active:not(:focus-visible) { transform: scale(0.97); }
.dg-body {
  flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 4px 20px 20px;
  font-size: 13.5px; line-height: 1.55; color: var(--ib-text-2); overflow-wrap: anywhere;
}
.dg-head[hidden] + .dg-body { padding-top: 20px; }
.dg-body ::slotted(:first-child) { margin-top: 0; }
.dg-body ::slotted(:last-child) { margin-bottom: 0; }
.dg-foot {
  display: flex; flex: none; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px;
  padding: 12px 16px; border-top: 1px solid var(--ib-card-border);
}
@media (hover: hover) and (pointer: fine) {
  .dg-close:hover { background: var(--ib-pill); color: var(--ib-text); }
}
@media (pointer: coarse), (max-width: 639px) {
  .dg-close { width: 44px; height: 44px; margin: -6px -8px -6px auto; }
}
@media (max-width: 639px) {
  .dg[data-sheet="auto"] { place-items: end stretch; }
  .dg[data-sheet="auto"] .dg-panel {
    width: 100%; height: auto; max-height: calc(100dvh - 24px); border-radius: 16px 16px 0 0;
    padding-bottom: env(safe-area-inset-bottom); opacity: 1; transform: translateY(100%);
    transition: transform var(--dur-fade) var(--ease-drawer);
  }
  .dg[data-sheet="auto"][data-state="open"] .dg-panel { transform: none; transition: transform var(--dur-move) var(--ease-drawer); }
  .dg[data-sheet="auto"][data-size="full"] .dg-panel { height: calc(100dvh - 24px); }
  .dg[data-sheet="auto"] .dg-grab { display: block; }
  .dg[data-sheet="auto"] .dg-head { padding-top: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .dg-panel, .dg[data-sheet="auto"] .dg-panel { transform: none !important; }
  .dg:not([data-state="open"]) .dg-panel { opacity: 0 !important; }
  .dg-scrim, .dg-panel { transition: opacity 120ms ease !important; }
}
`;
