/**
 * The Voice position tile (Libraries.dev `sites/home/src/voice-position.css`, MIT): the voice screen with the ring,
 * the composer bar that grows for a far voice, the source marker with its signal line, and the readout — in the ui
 * tokens instead of the page's fixed greys.
 */
export const styles = `
:host { display: block; container-type: inline-size; }
.vp {
  --hud: color-mix(in srgb, var(--text) 90%, transparent);
  --hud-2: color-mix(in srgb, var(--text) 50%, transparent);
  --hud-3: color-mix(in srgb, var(--text) 18%, transparent);
  --screen: color-mix(in srgb, var(--surface-raised) 70%, var(--surface));
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 18px 28px;
  font-family: var(--font);
}

/* The stage: the screen in the middle, room for a source on either side and in front. */
.stage { position: relative; width: 340px; height: 368px; flex: none; }
.screen {
  --u: calc(200px / 402);
  position: absolute; left: 70px; top: 0; width: 200px; height: 300px; overflow: hidden;
  border-radius: calc(66 * var(--u)); background: var(--screen);
  box-shadow: inset 0 0 0 1px var(--border), inset 0 0 calc(50 * var(--u)) 0 color-mix(in srgb, var(--text) 3%, transparent);
}
.ring { position: absolute; left: 50%; top: 128px; transform: translate(-50%, -50%); line-height: 0; }
.status {
  position: absolute; left: 50%; top: 214px; margin: 0; transform: translateX(-50%);
  color: var(--hud-2); font-size: 12px; line-height: 1; white-space: nowrap;
}
.composer {
  --grow: 900ms linear(0, 0.077, 0.239, 0.417, 0.577, 0.708, 0.807, 0.879, 0.928, 0.96, 0.98, 0.992, 0.998, 1.002, 1.003, 1.003, 1.003, 1.002, 1);
  --size: calc(52 * var(--u));
  position: absolute; left: 50%; bottom: calc(41 * var(--u)); display: flex; align-items: flex-end;
  gap: calc(12 * var(--u)); transform: translateX(-50%); transition: bottom var(--grow);
}
.composer[data-far] { --size: calc(66 * var(--u)); bottom: calc(44 * var(--u)); }
.ask, .glass, .end { flex: none; height: var(--size); border-radius: 999px; transition: width var(--grow), height var(--grow), padding-left var(--grow); }
.ask, .glass {
  background: color-mix(in srgb, var(--text) 10%, transparent);
  box-shadow: 0 0 0 0.5px color-mix(in srgb, var(--text) 12%, transparent), inset 0 1px 0 color-mix(in srgb, var(--text) 10%, transparent);
}
.ask {
  display: flex; align-items: center; width: calc(225 * var(--u)); padding-left: calc(20 * var(--u));
  color: var(--hud-2); font-size: calc(15 * var(--u)); line-height: 1; white-space: nowrap; overflow: hidden;
}
.ask span { transform-origin: left center; transition: transform var(--grow); }
.composer[data-far] .ask { width: calc(179 * var(--u)); padding-left: calc(25 * var(--u)); }
.composer[data-far] .ask span { transform: scale(1.2); }
.glass, .end { display: grid; place-items: center; width: var(--size); color: var(--hud); }
.end { background: var(--text); color: var(--surface); }
.glass svg, .end svg { width: calc(20 * var(--u)); height: calc(20 * var(--u)); }

/* The source: a box locked round where the voice is, its tag, and the signal line to the screen. */
.src { position: absolute; width: 0; height: 0; color: var(--hud-2); transition: left 520ms var(--ease-out, ease), top 520ms var(--ease-out, ease); }
.src[hidden] { display: none; }
.src[data-side="left"] { left: 22px; top: 128px; }
.src[data-side="right"] { left: 318px; top: 128px; }
.src[data-side="front"] { left: 170px; top: 344px; }
.box { position: absolute; left: -14px; top: -11px; width: 28px; height: 22px; color: var(--hud); }
.box::before { content: ''; position: absolute; inset: 0; border: 1px solid currentColor; }
.box::after {
  content: ''; position: absolute; inset: -1px;
  background:
    linear-gradient(currentColor 0 0) 0 0 / 3px 3px no-repeat,
    linear-gradient(currentColor 0 0) 100% 0 / 3px 3px no-repeat,
    linear-gradient(currentColor 0 0) 0 100% / 3px 3px no-repeat,
    linear-gradient(currentColor 0 0) 100% 100% / 3px 3px no-repeat;
}
.src[data-detecting] .box { left: -22px; top: -17px; width: 44px; height: 34px; color: var(--hud-2); }
.src[data-detecting] .box::before { border-style: dashed; }
.box { transition: left 520ms cubic-bezier(0.34, 1.56, 0.64, 1), top 520ms cubic-bezier(0.34, 1.56, 0.64, 1), width 520ms cubic-bezier(0.34, 1.56, 0.64, 1), height 520ms cubic-bezier(0.34, 1.56, 0.64, 1), color 300ms; }
.tag {
  position: absolute; left: 50%; top: 22px; translate: -50% 0; color: var(--hud-2);
  font: 500 8.5px/1 var(--mono); letter-spacing: 0.14em; white-space: nowrap;
}
.src[data-side="front"] .tag { top: 18px; }
.line {
  position: absolute; height: 2px; top: -1px;
  background: radial-gradient(circle, var(--hud-2) 0.9px, transparent 1.1px) 0 0 / 6px 2px;
  animation: vp-flow 600ms linear infinite;
}
.src[data-side="left"] .line { left: 16px; width: 30px; }
.src[data-side="right"] .line { right: 16px; width: 30px; animation-direction: reverse; }
.src[data-side="front"] .line {
  left: -1px; top: auto; bottom: 13px; width: 2px; height: 28px;
  background: radial-gradient(circle, var(--hud-2) 0.9px, transparent 1.1px) 0 0 / 2px 6px;
  animation-name: vp-flow-up;
}
.src:not([data-detecting]) .line { --hud-2: var(--accent); }
@keyframes vp-flow { to { background-position: 6px 0; } }
@keyframes vp-flow-up { to { background-position: 0 -6px; } }

/* The readout: mono labels, the value, a dotted confidence meter. */
.readout {
  position: relative; width: 196px; padding: 9px 11px 7px; border-radius: 10px; box-sizing: border-box;
  background: radial-gradient(circle, color-mix(in srgb, var(--text) 6%, transparent) 0.6px, transparent 0.9px) 0 0 / 5px 5px, color-mix(in srgb, var(--surface-raised) 88%, transparent);
  box-shadow: inset 0 0 0 1px var(--hud-3); color: var(--hud); font-family: var(--mono);
}
.corner { position: absolute; width: 6px; height: 6px; border: 0 solid var(--hud); opacity: 0.7; }
.corner.tl { left: -3px; top: -3px; border-width: 1.5px 0 0 1.5px; }
.corner.tr { right: -3px; top: -3px; border-width: 1.5px 1.5px 0 0; }
.corner.bl { left: -3px; bottom: -3px; border-width: 0 0 1.5px 1.5px; }
.corner.br { right: -3px; bottom: -3px; border-width: 0 1.5px 1.5px 0; }
.head { display: flex; align-items: center; gap: 6px; margin-bottom: 7px; color: var(--hud-2); font-size: 8px; letter-spacing: 0.14em; }
.live { color: var(--hud); }
.live::before { content: ''; display: inline-block; width: 5px; height: 5px; margin-right: 4px; border-radius: 50%; background: var(--st-run, var(--accent)); vertical-align: 1px; }
.row { display: flex; align-items: baseline; gap: 6px; min-height: 16px; }
.key { width: 58px; flex: none; color: var(--hud-2); font-size: 8px; letter-spacing: 0.14em; }
.value { font-family: var(--font); font-size: 12.5px; font-weight: 550; letter-spacing: -0.01em; white-space: pre; }
.value[data-pending] { color: var(--hud-2); }
.value[data-scrambling] { font-family: var(--mono); font-size: 11px; color: var(--hud-2); }
.read { margin-left: auto; color: var(--hud-2); font-size: 8.5px; font-variant-numeric: tabular-nums; }
.meter { display: flex; align-items: center; gap: 2.6px; height: 9px; margin: 1px 0 6px 64px; }
.meter i { width: 2px; height: 2px; border-radius: 50%; background: var(--hud-3); transition: background-color 240ms, box-shadow 240ms; }
.meter i[data-on] { background: var(--hud); box-shadow: 0 0 4px color-mix(in srgb, var(--text) 40%, transparent); }
.pct { margin-left: auto; color: var(--hud-2); font-size: 8px; font-variant-numeric: tabular-nums; }

/* Off screen, paused or reduced motion: every loop holds. */
.vp[data-still] *, .vp[data-still] *::before, .vp[data-still] *::after { animation-play-state: paused !important; }
@media (prefers-reduced-motion: reduce) { .line { animation: none; } .composer, .ask, .ask span, .glass, .end, .box, .src { transition: none; } }
.vp[data-reduce] .line { animation: none; }
.vp[data-reduce] .composer, .vp[data-reduce] .ask, .vp[data-reduce] .ask span, .vp[data-reduce] .glass, .vp[data-reduce] .end, .vp[data-reduce] .box, .vp[data-reduce] .src { transition: none; }
:host([lang="ko"]) .key, :host([lang="ko"]) .head, :host([lang="ko"]) .tag { letter-spacing: 0.04em; }
@container (max-width: 380px) { .stage { transform: scale(0.85); transform-origin: top center; margin-bottom: -55px; } }
`;
