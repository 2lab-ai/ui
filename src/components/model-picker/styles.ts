/**
 * Ported from the soma-work dashboard ("MODEL · EFFORT MENU", .prd/affectui/re-model-picker.md D1, D2, D13–D15).
 * The dashboard's own --mp-well / --mp-bar / --mp-bar-off pairs (dark #2e2e33 · #5a5a62 · #35353b, light #f1f1f3 ·
 * #c9c9d0 · #e6e6ea) are derived from the card and text tokens, so both themes follow any page palette.
 */
export const styles = `
:host { --mp-well: color-mix(in srgb, var(--ib-text) 6%, var(--ib-card)); --mp-bar: color-mix(in srgb, var(--ib-text) 24%, var(--ib-card));
  --mp-bar-off: color-mix(in srgb, var(--ib-text) 9%, var(--ib-card));
  display: inline-block; max-width: 100%; vertical-align: middle; }
.mp { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; max-width: 100%; }
.mp-trigger { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; min-width: 0; min-height: 30px; padding: 0 9px 0 5px; font: inherit; font-size: 13px; font-weight: 500; color: var(--ib-text); background: var(--ib-seg); border: 1px solid var(--ib-card-border); border-radius: 8px; cursor: pointer; white-space: nowrap; transition: background-color var(--dur-press) var(--ease-out); }
.mp-trigger:not([aria-disabled="true"]):hover, .mp-trigger[aria-expanded="true"] { background: var(--mp-well); }
.mp-trigger:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
.mp-trigger[aria-busy="true"] { cursor: progress; }
.mp-trigger[aria-disabled="true"] { cursor: default; background: transparent; border-color: transparent; }
.mp-trigger[aria-disabled="true"] .mp-chev { display: none; }
.mp-trigger .mp-glyph { width: 18px; height: 18px; border-radius: 5px; font-size: 10px; }
.mp-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.mp-level { flex: none; font-weight: 400; color: var(--ib-text-2); }
.mp-chev { flex: none; width: 6px; height: 6px; margin: 0 1px 0 2px; border-right: 1.5px solid var(--ib-muted); border-bottom: 1.5px solid var(--ib-muted); transform: translateY(-2px) rotate(45deg); transition: transform 300ms var(--ease-out); }
.mp-trigger[aria-expanded="true"] .mp-chev { transform: translateY(1px) rotate(225deg); }
.mp-glyph { display: inline-grid; flex: none; place-items: center; width: 22px; height: 22px; border-radius: 6px; background: var(--ib-card); box-shadow: inset 0 0 0 1px var(--ib-card-border); font-size: 10.5px; font-weight: 600; line-height: 1; color: var(--ib-text); }
.mp-note { max-width: 100%; font-size: 12px; line-height: 17px; color: var(--ib-text-2); overflow-wrap: anywhere; }
.mp-note.is-error { color: var(--st-fail-text); }
.mp-note:empty { display: none; }
/* A fixed 100px box at 0,0: tells the menu its containing block's origin and scale (transformed ancestors). */
.mp-probe { position: fixed; left: 0; top: 0; width: 100px; height: 0; visibility: hidden; pointer-events: none; }
/* The menu: position fixed (an ancestor's overflow clip never cuts it), placed from the trigger in script. */
.mp-pop { position: fixed; z-index: 150; left: 0; top: 0; box-sizing: border-box; width: min(336px, calc(100vw - 32px)); max-height: calc(100vh - 24px); overflow-y: auto; overscroll-behavior: contain; container: mp / inline-size; padding: 4px; border-radius: 16px; background: var(--ib-col); box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow-raised); color: var(--ib-text-2); font-size: 13px; line-height: 20px; text-align: left; white-space: normal; transform-origin: top left; opacity: 0; visibility: hidden; pointer-events: none; transform: translateY(-4px) scale(0.96); transition: opacity 160ms ease, transform 220ms var(--ease-out), visibility 0s linear 220ms; }
.mp-pop[data-side="top"] { transform-origin: bottom left; transform: translateY(4px) scale(0.96); }
.mp-pop.is-open { opacity: 1; visibility: visible; transform: none; pointer-events: auto; transition: opacity 200ms ease, transform var(--dur-move) var(--ease-out), visibility 0s; }
.mp-card { padding: 6px; border-radius: 12px; background: var(--ib-card); box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow); }
.mp-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; height: 24px; padding: 0 10px; font-size: 11px; line-height: 16px; color: var(--ib-muted); }
.mp-head-t { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.mp-cols, .mp-bars { display: grid; flex: none; grid-template-columns: repeat(3, 36px); gap: 8px; }
.mp-cols { font-size: 10px; letter-spacing: -0.01em; }
.mp-cols > span { display: flex; justify-content: center; white-space: nowrap; }
.mp-wait { margin: 0 10px 4px; font-size: 12px; line-height: 17px; color: var(--st-wait); overflow-wrap: anywhere; }
.mp-list { display: grid; gap: 1px; border-radius: 10px; outline: none; }
.mp-opt { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; grid-template-areas: "g t b" "g d d"; align-items: center; column-gap: 10px; min-height: 48px; padding: 6px 10px; border-radius: 10px; cursor: pointer; transition: background-color var(--dur-press) ease, opacity 220ms ease; }
.mp-opt > .mp-glyph { grid-area: g; }
.mp-opt > .mp-bars { grid-area: b; }
.mp-opt[aria-disabled="true"] { cursor: default; }
.mp-list[aria-disabled="true"] .mp-opt:not([aria-selected="true"]) .mp-title { color: var(--ib-text-2); }
.mp-list[data-pointing] .mp-opt[data-active] { background: var(--mp-well); }
.mp-list[data-pointing] .mp-opt:not([data-active]) { opacity: 0.5; }
.mp-list:focus-visible .mp-opt[data-active] { background: var(--mp-well); box-shadow: inset 0 0 0 1.5px var(--border-focus); }
.mp-title { grid-area: t; display: flex; align-items: center; gap: 4px; min-width: 0; font-weight: 500; color: var(--ib-text); }
.mp-title-name { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.mp-check { flex: none; font-size: 12px; line-height: 1; color: var(--accent); animation: mp-pop 320ms var(--ease-out) both; }
.mp-desc { grid-area: d; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; font-size: 12px; line-height: 17px; color: var(--ib-muted); overflow-wrap: anywhere; }
.mp-meter { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2px; height: 5px; }
.mp-meter.is-none { display: block; height: auto; font-size: 11px; line-height: 1; text-align: center; color: var(--ib-muted); }
.mp-seg { border-radius: 1.5px; background: var(--mp-bar-off); transition: background-color 180ms ease; }
.mp-seg[data-on] { background: var(--mp-bar); }
.mp-opt[data-lit] .mp-seg[data-on] { background: var(--accent); transition-delay: calc(var(--c) * 70ms + var(--s) * 45ms); animation: mp-fill 360ms var(--ease-out) both; animation-delay: calc(var(--c) * 70ms + var(--s) * 45ms); }
.mp-settings { margin-top: 6px; padding: 6px 10px 4px; border-top: 1px solid var(--ib-card-border); }
.mp-effort-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; min-height: 22px; }
.mp-effort-label { flex: none; font-size: 12.5px; color: var(--ib-text-2); }
.mp-effort-cap { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--st-wait); }
.mp-seg-ctl { position: relative; display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); margin-top: 4px; padding: 2px; border-radius: 9px; background: var(--ib-seg); box-shadow: inset 0 0 0 1px var(--ib-card-border); }
.mp-thumb { position: absolute; top: 2px; bottom: 2px; left: 2px; width: calc((100% - 4px) / var(--n)); border-radius: 7px; background: var(--ib-seg-on); box-shadow: 0 0 0 1px var(--ib-card-border), 0 1px 2px color-mix(in srgb, #000 12%, transparent); transform: translateX(calc(var(--i) * 100%)); transition: transform var(--dur-move) var(--ease-out); }
.mp-seg-btn { position: relative; min-width: 0; min-height: 26px; padding: 0 2px; font: inherit; font-size: 12px; font-weight: 500; color: var(--ib-muted); background: none; border: 0; border-radius: 7px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color 200ms ease; }
.mp-seg-btn[aria-checked="true"], .mp-seg-btn:hover { color: var(--ib-text); }
.mp-seg-btn:focus-visible { outline: 2px solid var(--border-focus); outline-offset: -2px; }
.mp-seg-ctl[aria-disabled="true"] .mp-seg-btn { cursor: progress; }
.mp-err { margin: 6px 10px 2px; font-size: 12px; line-height: 17px; color: var(--st-fail-text); overflow-wrap: anywhere; }
.mp-err:empty { display: none; }
.mp-foot { display: flex; align-items: center; gap: 6px; min-height: 38px; padding: 4px 6px 0 10px; }
.mp-caption { flex: 1; min-width: 0; overflow: hidden; font-size: 12px; color: var(--ib-muted); white-space: nowrap; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.mp-caption b { font-weight: 500; color: var(--ib-text); }
.mp-keys { display: flex; flex: none; gap: 2px; }
.mp-keys kbd { display: grid; place-items: center; min-width: 18px; height: 18px; padding: 0 3px; border-radius: 5px; background: var(--ib-card); box-shadow: 0 0 0 1px var(--ib-card-border); font-family: inherit; font-size: 10.5px; line-height: 1; color: var(--ib-muted); }
@keyframes mp-pop { from { opacity: 0; transform: scale(0.6); } }
@keyframes mp-fill { 0% { transform: scaleY(1); } 45% { transform: scaleY(1.6); } 100% { transform: scaleY(1); } }
@container mp (max-width: 300px) {
  .mp-opt .mp-glyph, .mp-keys { display: none; }
  .mp-opt { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "t b" "d d"; }
}
/* Touch / narrow: the dashboard's own block — trigger and levels ≥44px, rows ≥54px, no key hints. */
@media (pointer: coarse), (max-width: 639px) {
  .mp-trigger, .mp-seg-btn { min-height: 44px; }
  .mp-opt { min-height: 54px; }
  .mp-keys { display: none; }
}
/* The global rule shortens durations; scale, the staggered fill and the check pop stop here too. */
@media (prefers-reduced-motion: reduce) {
  .mp-pop, .mp-pop[data-side="top"] { transform: none; }
  .mp-opt[data-lit] .mp-seg[data-on] { animation: none; transition-delay: 0s; }
  .mp-check { animation: none; }
}
`;
