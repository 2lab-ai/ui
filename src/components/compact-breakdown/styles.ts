/**
 * Compact Breakdown. Sizes and timings follow the affectUI Compact Breakdown pattern; every colour is a dashboard
 * token or a color-mix() of tokens, so light and dark both read.
 */
export const styles = `
:host { --cb-card: var(--surface); --cb-ink: var(--text); --cb-text: var(--text-secondary); --cb-muted: var(--text-tertiary);
  --cb-line: var(--border); --cb-wash: color-mix(in srgb, var(--text) 4.5%, transparent);
  --cb-fill: color-mix(in srgb, var(--text) 7.5%, transparent);
  --cb-c1: color-mix(in srgb, var(--accent) 84%, var(--cb-card)); --cb-c2: color-mix(in srgb, var(--accent) 56%, var(--cb-card));
  --cb-c3: color-mix(in srgb, var(--accent) 36%, var(--cb-card)); --cb-c4: color-mix(in srgb, var(--accent) 21%, var(--cb-card));
  --cb-c5: color-mix(in srgb, var(--text) 19%, var(--cb-card)); --cb-other: color-mix(in srgb, var(--text) 11%, var(--cb-card));
  --cb-fail: var(--st-fail-text);
  --cb-ease: cubic-bezier(0.22, 1, 0.36, 1); --cb-snap: cubic-bezier(0.25, 0.9, 0.3, 1);
  max-width: 360px; min-width: 0; }
:host([flat]) { --cb-card: transparent; }
button { appearance: none; margin: 0; padding: 0; border: 0; background: none; text-align: left; letter-spacing: inherit; }
ul, p { margin: 0; padding: 0; }
ul { list-style: none; }

.cb { container: cb / inline-size; display: grid; grid-template-columns: minmax(0, 1fr); width: 100%; overflow: hidden;
  border-radius: 10px; background: var(--cb-card); box-shadow: 0 0 0 1px var(--cb-line), var(--ib-shadow);
  font-size: 13px; line-height: 20px; color: var(--cb-ink); }
:host([flat]) .cb { border-radius: 0; box-shadow: none; overflow: visible; }
.cb-body { padding: 16px 16px 10px; }
:host([flat]) .cb-body { padding: 0; }

/* Header: title + the host's switch (a radiogroup with a sliding fill) */
.cb-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 12px; min-height: 28px; }
.cb-title { flex: 1 1 auto; min-width: 0; overflow: hidden; font-size: 15px; font-weight: 500; line-height: 24px;
  color: var(--cb-ink); white-space: nowrap; text-overflow: ellipsis; }
.cb-switch { position: relative; display: grid; grid-auto-columns: minmax(0, auto); grid-auto-flow: column; gap: 4px; flex: 0 1 auto; min-width: 0; }
.cb-pill { position: absolute; top: 0; left: 0; width: 0; height: 0; border-radius: 6px; background: var(--cb-fill); opacity: 0;
  pointer-events: none; transition: transform 200ms var(--cb-snap), width 200ms var(--cb-snap); }
.cb-opt { position: relative; z-index: 1; min-width: 0; height: 28px; padding: 4px 10px; overflow: hidden; border-radius: 6px;
  box-shadow: inset 0 0 0 1px var(--cb-fill); font-size: 13px; font-weight: 500; line-height: 20px; color: var(--cb-text);
  text-align: center; white-space: nowrap; text-overflow: ellipsis; transition: color 90ms ease, background-color 90ms ease; }
.cb-opt[aria-checked="true"] { color: var(--cb-ink); }
@media (hover: hover) { .cb-opt[aria-checked="false"]:hover { background: var(--cb-wash); color: var(--cb-ink); } }
.cb-opt:focus-visible, .cb-item:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 1px; }

/* The big number and its caption */
.cb-figure { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
.cb-big { font-size: 24px; font-weight: 500; line-height: 32px; letter-spacing: -0.02em; color: var(--cb-ink);
  font-variant-numeric: tabular-nums; white-space: nowrap; }
.cb-caption { height: 16px; overflow: hidden; font-size: 12px; line-height: 16px; color: var(--cb-muted); font-variant-numeric: tabular-nums; }
.cb-cap { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; }
.cb-cap.is-in { animation: cb-in 260ms var(--cb-ease) both; }
.cb-cap-label { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.cb-cap-share { flex: none; }
.cb-cap.is-error { color: var(--cb-fail); }

/* Segmented bar: each part keeps its place and colour, widths glide */
.cb-bar { display: flex; gap: 2px; height: 6px; margin-top: 16px; border-radius: 3px; }
.cb-bar.is-empty { background: var(--cb-fill); }
.cb-seg { flex: 0 1 0; height: 100%; min-width: 2px; border-radius: 1.5px; background: var(--c, var(--cb-c5));
  transition: opacity 160ms ease, transform 200ms var(--cb-ease); }
.cb-seg:first-child { border-top-left-radius: 3px; border-bottom-left-radius: 3px; }
.cb-seg:last-child { border-top-right-radius: 3px; border-bottom-right-radius: 3px; }
.cb-bar[data-active] .cb-seg:not([data-active]) { opacity: 0.3; }
.cb-seg[data-active] { transform: scaleY(1.5); }

/* Ranked rows (FLIP moves are added in script) */
.cb-list { position: relative; display: grid; margin-top: 10px; }
.cb-row { display: grid; grid-template-rows: 1fr; }
.cb-row[data-leaving] { pointer-events: none; animation: cb-fold 320ms var(--cb-ease) both; }
.cb-item { display: flex; align-items: center; gap: 10px; min-height: 0; height: 32px; margin: 0 -8px; padding: 0 8px;
  overflow: hidden; border-radius: 6px; cursor: default; transition: background-color 90ms ease-out, opacity 160ms ease; }
.cb-item[data-active] { background: var(--cb-wash); }
.cb-list[data-active] .cb-item:not([data-active]) { opacity: 0.45; }
.cb-sw { flex: none; width: 8px; height: 8px; border-radius: 2px; background: var(--c, var(--cb-c5)); }
.cb-label { flex: 1; min-width: 0; overflow: hidden; color: var(--cb-ink); white-space: nowrap; text-overflow: ellipsis; }
.cb-row[data-other] .cb-label { color: var(--cb-text); }
.cb-val { flex: none; color: var(--cb-ink); font-weight: 500; white-space: nowrap; font-variant-numeric: tabular-nums; }
.cb-share { flex: none; width: 36px; font-size: 12px; line-height: 16px; text-align: right; color: var(--cb-muted);
  white-space: nowrap; font-variant-numeric: tabular-nums; }
.cb-empty { padding: 6px 0 8px; font-size: 12.5px; line-height: 18px; color: var(--cb-muted); }

/* Loading: stale numbers dim; before any data a skeleton */
.cb[aria-busy="true"] :is(.cb-figure, .cb-caption, .cb-bar, .cb-list) { opacity: 0.5; transition: opacity 200ms ease; }
.cb-sk { display: block; border-radius: 4px; background: var(--cb-fill); }
.cb-sk.is-big { width: 8.5em; height: 22px; margin: 5px 0; font-size: 13px; }
.cb-sk.is-row { width: 100%; height: 10px; }
.cb-skrow { display: flex; align-items: center; gap: 10px; height: 32px; }
.cb-skrow .cb-sk.is-row:last-child { flex: none; width: 48px; }
.cb[aria-busy="true"] .cb-sk { opacity: 1; }
@media (prefers-reduced-motion: no-preference) { .cb-sk { animation: cb-pulse 1.6s ease-in-out infinite; } }

/* Footer: “Largest: …” under a hairline */
.cb-foot { display: flex; align-items: center; min-height: 40px; padding: 0 16px; overflow: hidden;
  border-top: 1px solid color-mix(in srgb, var(--cb-line) 80%, transparent); font-size: 12px; line-height: 16px;
  color: var(--cb-muted); white-space: nowrap; }
:host([flat]) .cb-foot { margin-top: 6px; padding: 0; }
.cb-foot-in { overflow: hidden; text-overflow: ellipsis; }
.cb-foot-in.is-in { animation: cb-in 320ms var(--cb-ease) both; }
.cb-foot b { font-weight: 500; color: var(--cb-ink); }

@keyframes cb-in { from { opacity: 0; transform: translateY(4px); filter: blur(2px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes cb-fold { from { grid-template-rows: 1fr; opacity: 1; } to { grid-template-rows: 0fr; opacity: 0; } }
@keyframes cb-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }

@container cb (max-width: 320px) {
  .cb-body { padding: 14px 14px 8px; }
  .cb-foot { padding: 0 14px; }
  .cb-switch { gap: 2px; }
  .cb-opt { padding: 4px 8px; }
}
/* Narrow: the switch takes its own line, options share it evenly; below 250px the share column goes. */
@container cb (max-width: 300px) {
  .cb-switch { flex: 1 1 100%; grid-auto-columns: minmax(0, 1fr); }
}
@container cb (max-width: 250px) {
  .cb-share { display: none; }
  .cb-opt { padding: 4px 6px; }
}
:host([flat]) .cb-body, :host([flat]) .cb-foot { padding-left: 0; padding-right: 0; }
@media (pointer: coarse) {
  .cb-opt { height: 44px; padding-top: 12px; padding-bottom: 12px; }
  .cb-item, .cb-skrow { height: 44px; }
  .cb-foot { min-height: 44px; }
}
`;
