/**
 * The dock. Bar: the phone's bottom tab bar — the page colour at 92% under a light blur with a hairline above, equal
 * columns, a 20px glyph on a 52 × 30 capsule over an 11px word; the current tab's capsule is the pill fill and its
 * word the ink. A count sits on the glyph's corner in ink. The action is a 52px ink circle raised half out of the bar.
 * Rail: a 60px column of 44px round glyph buttons on the inverse ink, the current one on a lighter disc, names as hover
 * labels to the right; the action is the first, in the card colour. Colour only for the current place.
 */
export const styles = `
:host { display: block; color: var(--ib-text); -webkit-tap-highlight-color: transparent; }
:host([hidden]) { display: none; }
.ui-root { display: contents; }
.dk { box-sizing: border-box; }
ul { margin: 0; padding: 0; list-style: none; }
button { font: inherit; }

/* ── Bar ─────────────────────────────────────────────────────────────── */
:host([data-bar]) .dk {
  position: relative; isolation: isolate;
  padding: 0 max(6px, env(safe-area-inset-right)) env(safe-area-inset-bottom, 0px) max(6px, env(safe-area-inset-left));
  border-top: 1px solid var(--border);
}
:host([data-bar]) .dk > * { min-height: var(--ui-dock-h, 60px); }
:host([data-bar]) .dk::before {
  content: ""; position: absolute; inset: -1px 0 0; z-index: -1; pointer-events: none;
  background: color-mix(in srgb, var(--bg) 92%, transparent);
  -webkit-backdrop-filter: saturate(1.4) blur(12px); backdrop-filter: saturate(1.4) blur(12px);
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  :host([data-bar]) .dk::before { background: var(--bg); }
}
@media (prefers-reduced-transparency: reduce) {
  :host([data-bar]) .dk::before { background: var(--bg); -webkit-backdrop-filter: none; backdrop-filter: none; }
}
:host([fixed][data-bar]) { position: fixed; z-index: var(--ui-dock-z, 40); inset: auto 0 0 0; }
:host([data-bar]) .dk { display: grid; grid-template-columns: repeat(var(--dk-cols, 4), minmax(0, 1fr)); align-items: stretch; height: calc(var(--ui-dock-h, 60px) + env(safe-area-inset-bottom, 0px)); }
.dk-body, .dk-tabs { display: contents; }
.dk-cell, .dk-more { display: flex; min-width: 0; }
.dk-more[hidden] { display: none; }
.dk-more ui-menu { display: block; flex: 1; min-width: 0; }
.dk-more-btn { width: 100%; min-height: var(--ui-dock-h, 60px); }

.dk-item {
  position: relative; display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  min-width: 0; margin: 0; padding: 4px 2px; border: 0; border-radius: 12px; background: none;
  color: var(--ib-muted); text-decoration: none; cursor: pointer;
  transition: color 160ms ease, transform var(--dur-press) var(--ease-out);
}
.dk-cap {
  position: relative; display: inline-grid; place-items: center; width: 52px; max-width: 100%; height: 30px; border-radius: 999px;
  transition: background-color var(--dur-move) var(--ease-out), color 160ms ease;
}
.dk-cap > svg { flex: none; }
.dk-word {
  max-width: 100%; overflow: hidden; font-size: 11px; font-weight: 550; line-height: 14px; letter-spacing: 0.01em;
  text-overflow: ellipsis; white-space: nowrap;
}
.dk-item.is-current { color: var(--ib-text); }
.dk-item.is-current .dk-cap { background: var(--ib-pill); }
.dk-item.is-current .dk-word { font-weight: 650; }
.dk-badge {
  position: absolute; top: -2px; left: calc(50% + 4px); box-sizing: border-box; min-width: 17px; height: 17px; padding: 0 5px;
  border: 2px solid var(--bg); border-radius: 999px; background: var(--ib-text); color: var(--ib-card);
  font-size: 10px; font-weight: 700; line-height: 13px; text-align: center; font-variant-numeric: tabular-nums;
}
.dk-badge.is-dot { min-width: 11px; width: 11px; height: 11px; padding: 0; top: 0; left: calc(50% + 6px); }

.dk-cell-act { justify-content: center; align-items: flex-start; }
.dk-act {
  position: relative; display: inline-grid; place-items: center; flex: none; width: 52px; height: 52px; margin: -14px 0 0;
  padding: 0; border: 0; border-radius: 50%; background: var(--ib-text); color: var(--ib-card); cursor: pointer;
  box-shadow: var(--ib-shadow-raised), 0 0 0 4px var(--bg);
  transition: transform var(--dur-press) var(--ease-out), opacity 150ms ease;
}
.dk-act-face { display: inline-grid; place-items: center; }

/* ── Rail ────────────────────────────────────────────────────────────── */
.dk[data-layout="rail"] {
  display: flex; flex-direction: column; align-items: center; gap: 6px; width: 60px; padding: 8px;
  border-radius: 30px; background: var(--ib-text); color: color-mix(in srgb, var(--ib-card) 72%, transparent);
  box-shadow: var(--ib-shadow-raised);
}
:host([fixed]:not([data-bar])) { position: fixed; z-index: var(--ui-dock-z, 40); left: max(16px, env(safe-area-inset-left)); top: 50%; transform: translateY(-50%); }
.dk[data-layout="rail"] .dk-list { display: flex; flex-direction: column; gap: 4px; }
.dk[data-layout="rail"] .dk-item { width: 44px; height: 44px; padding: 0; border-radius: 50%; color: inherit; }
.dk[data-layout="rail"] .dk-cap { width: 44px; height: 44px; }
.dk[data-layout="rail"] .dk-item.is-current { color: var(--ib-card); }
.dk[data-layout="rail"] .dk-item.is-current .dk-cap { background: color-mix(in srgb, var(--ib-card) 18%, transparent); }
.dk[data-layout="rail"] .dk-badge { top: 4px; left: auto; right: 2px; border-color: var(--ib-text); background: var(--ib-card); color: var(--ib-text); }
.dk[data-layout="rail"] .dk-act { width: 44px; height: 44px; margin: 0 0 4px; background: var(--ib-card); color: var(--ib-text); box-shadow: none; }
.dk-sep { display: block; width: 24px; height: 1px; margin: 4px 0; background: color-mix(in srgb, var(--ib-card) 22%, transparent); }
.dk-tip {
  position: absolute; left: calc(100% + 12px); top: 50%; z-index: 1; padding: 5px 9px; border-radius: 8px;
  background: var(--ib-text); color: var(--ib-card); box-shadow: var(--ib-shadow-raised);
  font-size: 12px; font-weight: 550; line-height: 16px; white-space: nowrap; pointer-events: none;
  opacity: 0; transform: translate(-4px, -50%); transition: opacity var(--dur-fade) var(--ease-out), transform var(--dur-fade) var(--ease-out);
}
.dk-item:focus-visible .dk-tip, .dk-act:focus-visible .dk-tip { opacity: 1; transform: translate(0, -50%); }

/* ── States ──────────────────────────────────────────────────────────── */
.dk-item:focus-visible, .dk-act:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
.dk[data-layout="rail"] .dk-item:focus-visible { outline-color: var(--ib-card); }
.dk-item:active, .dk-act:active { transform: scale(0.95); }
@media (hover: hover) and (pointer: fine) {
  :host([data-bar]) .dk-item:hover { color: var(--ib-text); }
  .dk[data-layout="rail"] .dk-item:hover .dk-cap { background: color-mix(in srgb, var(--ib-card) 10%, transparent); }
  .dk[data-layout="rail"] .dk-item:hover .dk-tip, .dk[data-layout="rail"] .dk-act:hover .dk-tip { opacity: 1; transform: translate(0, -50%); }
  .dk-act:hover { opacity: 0.9; }
}
`;
