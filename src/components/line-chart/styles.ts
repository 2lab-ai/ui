/**
 * Line chart. No card chrome — the host frames it (a card with its own heading). A figures row on top, then the plot:
 * recessive axes (dashed hairline gridlines on --border, 11px tabular ticks on --text-tertiary) so only the lines carry
 * colour. The SVG stretches to any box (preserveAspectRatio="none") with non-scaling strokes; every text is HTML placed
 * by percent, so nothing stretches. Every colour is a token; washes are color-mix()es that fall back to ink in mono.
 */
export const styles = `
:host { --lc-h: var(--line-chart-h, 220px); position: relative; min-width: 0; container-type: inline-size; }
.lc { --lc-band-ink: color-mix(in srgb, var(--st-done) calc(100% * var(--chroma)), var(--ib-muted));
  --lc-band: color-mix(in srgb, var(--lc-band-ink) 13%, transparent);
  position: relative; color: var(--ib-text); font-size: 12px; line-height: 1.45; }

/* Figures row: label over a big tabular value with its unit. */
.lc-sum { display: grid; grid-template-columns: repeat(auto-fit, minmax(112px, 1fr)); gap: 10px 18px; margin: 0 0 16px; }
.lc-fig { min-width: 0; margin: 0; }
.lc-fig dt { font-size: 12px; line-height: 16px; color: var(--ib-muted); overflow-wrap: anywhere; }
.lc-fig dd { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 4px; margin: 3px 0 0; min-width: 0; }
.lc-fig-v { font-size: 22px; font-weight: 650; line-height: 28px; letter-spacing: -0.02em; color: var(--ib-text);
  font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.lc-fig-u { font-size: 12.5px; line-height: 16px; color: var(--ib-text-2); overflow-wrap: anywhere; }
.lc-fig[data-tone="accent"] .lc-fig-v { color: var(--accent); }
.lc-fig[data-tone="done"] .lc-fig-v { color: color-mix(in srgb, var(--st-done) calc(70% * var(--chroma)), var(--ib-text)); }
.lc-fig[data-tone="fail"] .lc-fig-v { color: color-mix(in srgb, var(--st-fail-text) calc(70% * var(--chroma)), var(--ib-text)); }

/* Plot grid: y ticks in the left column, the plot, x labels under it. */
.lc-chart { display: grid; grid-template-columns: calc(var(--lc-yw, 0) * 0.62em) minmax(0, 1fr); column-gap: 10px;
  font-size: 11px; line-height: 14px; font-variant-numeric: tabular-nums; }
.lc[data-state="empty"] .lc-chart { column-gap: 0; }
.lc-y { position: relative; height: var(--lc-h); color: var(--text-tertiary); }
.lc-yl { position: absolute; right: 0; transform: translateY(50%); white-space: nowrap; }
.lc-plot { position: relative; height: var(--lc-h); border-radius: 4px; touch-action: pan-y; cursor: default;
  -webkit-tap-highlight-color: transparent; }
.lc-plot:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 6px; }
.lc-grid { position: absolute; inset: 0; pointer-events: none; }
.lc-gl { position: absolute; left: 0; right: 0; height: 0; border-top: 1px dashed var(--border); }
.lc-gl.is-base { border-top-style: solid; }
.lc-band { position: absolute; left: 0; right: 0; background: var(--lc-band); pointer-events: none; }

.lc-svg { position: absolute; inset: 0; display: block; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.lc-grad { --lc-wash: color-mix(in srgb, var(--c) calc(100% * var(--chroma)), var(--ib-muted)); }
.lc-stop-0 { stop-color: color-mix(in srgb, var(--lc-wash) 26%, transparent); }
.lc-stop-1 { stop-color: color-mix(in srgb, var(--lc-wash) 2%, transparent); }
.lc-area { stroke: none; transition: d var(--dur-move) var(--ease-out); }
.lc-line { fill: none; stroke: var(--c); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
  vector-effect: non-scaling-stroke; transition: d var(--dur-move) var(--ease-out); }
.lc-line[data-style="dashed"] { stroke-width: 1.5; stroke-linecap: butt; stroke-dasharray: 4 4; }

/* Crosshair and one dot per series at the active point (placed in percent, so they ride any width). */
.lc-hot { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity var(--dur-fade) ease; }
.lc-hot[data-on] { opacity: 1; }
.lc-cross { position: absolute; top: 0; bottom: 0; left: var(--x, 0); width: 0;
  border-left: 1px solid color-mix(in srgb, var(--ib-text) 32%, transparent); }
.lc-dot { position: absolute; left: var(--x, 0); top: var(--y, 50%); width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px;
  border-radius: 50%; background: var(--c); box-shadow: 0 0 0 2px var(--ib-card); }
.lc-dot[data-style="dashed"] { background: var(--ib-card); box-shadow: inset 0 0 0 2px var(--c), 0 0 0 2px var(--ib-card); }
.lc-dot[hidden] { display: none; }

/* X labels: thinned by count in render (data-x 0 never shows); the narrow container drops every other one. */
.lc-x { position: relative; grid-column: 2; height: 14px; margin-top: 8px; color: var(--text-tertiary); }
.lc-xl { position: absolute; top: 0; transform: translateX(-50%); white-space: nowrap; }
.lc-xl[data-edge="start"] { transform: none; }
.lc-xl[data-edge="end"] { transform: translateX(-100%); }
.lc-xl[data-x="0"] { display: none; }
@container (max-width: 479px) {
  .lc-xl[data-x="1"] { display: none; }
  .lc-sum { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .lc-fig-v { font-size: 20px; line-height: 26px; }
}

.lc-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 16px; margin: 14px 0 0; padding: 0;
  list-style: none; font-size: 12px; line-height: 16px; color: var(--ib-text-2); }
.lc-legend li { display: inline-flex; align-items: center; gap: 6px; min-width: 0; overflow-wrap: anywhere; }
.lc-sw { flex: none; display: block; width: 14px; height: 2px; border-radius: 1px; background: var(--c); }
.lc-sw[data-style="area"] { width: 9px; height: 9px; border-radius: 2px; }
.lc-sw[data-style="dashed"] { width: 16px; border-radius: 0;
  background: repeating-linear-gradient(90deg, var(--c) 0 4px, transparent 4px 7px); }
.lc-sw.is-band { width: 16px; height: 9px; border-radius: 2px;
  background: color-mix(in srgb, var(--lc-band-ink) 26%, transparent); }

.lc-empty { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; padding: 0 12px;
  font-size: 12.5px; color: var(--text-tertiary); text-align: center; }

/* Tooltip: the raised card beside the crosshair; glides between points while open. */
.lc-tip { position: absolute; z-index: 5; left: 0; top: 0; box-sizing: border-box; width: max-content; min-width: 120px;
  max-width: min(260px, calc(100% - 8px)); padding: 7px 10px 8px; border-radius: 10px; background: var(--ib-card);
  color: var(--ib-text); box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow-raised); font-size: 12px;
  line-height: 16px; text-align: left; pointer-events: none; opacity: 0; visibility: hidden; transform: scale(0.96);
  transition: opacity 180ms var(--ease-out), transform 180ms var(--ease-out), visibility 0s linear 180ms; }
.lc-tip.is-open { opacity: 1; visibility: visible; transform: none;
  transition: opacity 160ms var(--ease-out), transform 220ms var(--ease-out), left 140ms var(--ease-out),
    top 140ms var(--ease-out), visibility 0s; }
.lc-tip-h { margin-bottom: 4px; font-weight: 600; color: var(--ib-text); overflow-wrap: anywhere; }
.lc-tip-row { display: flex; align-items: center; gap: 6px; min-height: 18px; }
.lc-tip-l { flex: 1; min-width: 0; overflow: hidden; color: var(--ib-text-2); white-space: nowrap; text-overflow: ellipsis; }
.lc-tip-v { flex: none; margin-left: 10px; font-weight: 600; color: var(--ib-text); font-variant-numeric: tabular-nums; }
.lc-tip-row[data-none] .lc-tip-v { font-weight: 500; color: var(--ib-muted); }
@media (prefers-reduced-motion: reduce) {
  .lc-tip { transform: none; transition: opacity 120ms ease, visibility 0s linear 120ms !important; }
  .lc-tip.is-open { transition: opacity 120ms ease, visibility 0s !important; }
}
@media (forced-colors: active) {
  .lc-sw, .lc-dot, .lc-line, .lc-area { forced-color-adjust: none; }
  .lc-tip { border: 1px solid CanvasText; }
}
`;
