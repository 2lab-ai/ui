/**
 * Action node, drawn in the library language: a 20px-corner card on the card surface with a hairline ring, a soft
 * mark, a quiet facts line and a chain of overlapping round chips. The fan's buttons wait under the card's corner
 * (the card sits above them) and slide out along the arc on a small overshoot, one after another; closing runs in
 * reverse without the overshoot. Tints are color-mix() of tokens; mono (--chroma 0) keeps marks, drops washes.
 */
const tint = (tone: string) => `color-mix(in srgb, var(--st-${tone}) calc(14% * var(--chroma)), var(--ib-card))`;
const ink = (v: string) => `color-mix(in srgb, var(${v}) calc(70% * var(--chroma)), var(--ib-text))`;

export const styles = `
:host { display: inline-block; vertical-align: top; width: 296px; max-width: 100%; }
[hidden] { display: none !important; }
button { appearance: none; margin: 0; padding: 0; border: 0; background: none; letter-spacing: inherit; -webkit-tap-highlight-color: transparent; }

.an { --an-r: 20px; --an-spring: cubic-bezier(0.3, 1.35, 0.5, 1); position: relative; isolation: isolate; }
.an-card { position: relative; z-index: 1; min-width: 0; padding: 18px 20px 20px; border-radius: var(--an-r);
  background: var(--ib-card); color: var(--ib-text); box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow);
  font-size: 13px; line-height: 1.45; letter-spacing: -0.006em; transition: translate 220ms var(--an-spring); }
.an[data-open] .an-card { translate: 0 -1px; }

/* Top row: the mark, the name (a button: ui-open), the status under it */
.an-top { display: flex; align-items: center; gap: 10px; min-height: 36px; padding-right: 28px; }
.an-mark { flex: none; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px;
  background: color-mix(in srgb, var(--ib-text) 6%, var(--ib-card)); color: var(--ib-text); }
.an-mark > svg { display: block; }
.an-head { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; min-width: 0; }
.an-name { max-width: 100%; border-radius: 4px; color: var(--ib-text); font-size: 15px; font-weight: 600; line-height: 20px;
  letter-spacing: -0.01em; text-align: start; overflow-wrap: anywhere; cursor: pointer;
  text-decoration: underline; text-decoration-color: transparent; text-underline-offset: 3px;
  transition: text-decoration-color var(--dur-press) ease; }
.an-st, .an-hint { display: inline-flex; align-items: center; gap: 6px; min-height: 16px; font-size: 12px; font-weight: 500; line-height: 16px; color: var(--ib-muted); }
.an-st { --an-c: var(--ib-muted); white-space: nowrap; }
.an-dot { flex: none; width: 7px; height: 7px; border-radius: 50%; background: var(--an-c); }
.an-st[data-tone="idle"] .an-dot { background: none; box-shadow: inset 0 0 0 1.5px var(--ib-muted); }
.an-st[data-tone="done"] { --an-c: var(--st-done); color: ${ink('--st-done')}; }
.an-st[data-tone="run"] { --an-c: var(--st-run); color: ${ink('--st-run')}; }
.an-st[data-tone="fail"] { --an-c: var(--st-fail); color: ${ink('--st-fail-text')}; }
/* The kit's working ring (.ui-spinner), small */
.an-spin { position: relative; flex: none; box-sizing: border-box; width: 11px; height: 11px; border-radius: 50%;
  border: 1.8px solid color-mix(in srgb, var(--an-c) 25%, transparent); border-top-color: var(--an-c); border-right-color: var(--an-c);
  animation: an-spin 0.9s linear infinite; }
@keyframes an-spin { to { transform: rotate(360deg); } }
.an-hint { color: ${ink('--st-fail-text')}; }
.an-hint > svg { flex: none; color: var(--st-fail); }

/* Body: what it does, the facts, the chain */
.an-say { margin: 12px 0 0; color: var(--ib-text-2); font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
.an-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; margin: 8px 0 0; color: var(--ib-muted);
  font-size: 12px; line-height: 18px; font-variant-numeric: tabular-nums; }
.an-m { min-width: 0; overflow-wrap: anywhere; }
.an-chain { display: flex; align-items: center; margin-top: 14px; padding-left: 2px; }
/* Each chip sits over the next (z-index set per chip), so a chip's letters move right, clear of the one before it */
.an-chip { flex: none; display: grid; place-items: center; box-sizing: border-box; width: 24px; height: 24px; overflow: hidden;
  border-radius: 999px; background: color-mix(in srgb, var(--ib-text) 10%, var(--ib-card)); box-shadow: 0 0 0 2px var(--ib-card);
  color: var(--ib-text-2); font-size: 10px; font-weight: 600; line-height: 1; letter-spacing: -0.02em; white-space: nowrap; }
.an-chip + .an-chip { margin-left: -6px; padding-left: 6px; }
.an-chip.is-more { width: auto; min-width: 24px; padding: 0 6px; background: var(--ib-pill); color: var(--ib-muted); letter-spacing: 0; font-variant-numeric: tabular-nums; }
.an-chip + .an-chip.is-more { padding-left: 10px; }

/* The corner trigger: always in the tab order; pressed-looking while the fan is out */
.an-trigger { position: absolute; z-index: 2; top: 12px; right: 12px; display: grid; place-items: center; width: 32px; height: 32px;
  border-radius: 999px; color: var(--ib-muted); cursor: pointer;
  transition: background-color var(--dur-press) ease, color var(--dur-press) ease, transform var(--dur-press) var(--ease-out); }
.an-trigger[aria-expanded="true"] { background: var(--ib-pill); color: var(--ib-text); }
.an-trigger:active:not(:focus-visible) { transform: scale(0.94); }

/* The fan: a zero-size layer at the card's top-right corner, under the card */
.an-fan { position: absolute; z-index: 0; top: 0; right: 0; width: 0; height: 0; }
.an-reach { position: absolute; pointer-events: none; }
.an[data-open] .an-reach { pointer-events: auto; }
.an-act { position: absolute; top: 0; left: 0; display: grid; place-items: center; width: 36px; height: 36px; margin: -18px 0 0 -18px;
  border-radius: 999px; background: var(--ib-card); color: var(--ib-text); box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow);
  cursor: pointer; opacity: 0; pointer-events: none; translate: calc(var(--an-r) * -1) var(--an-r); scale: 0.82;
  transition: translate 200ms cubic-bezier(0.4, 0, 1, 1) var(--an-d, 0ms), scale 200ms ease var(--an-d, 0ms), opacity 160ms ease var(--an-d, 0ms),
    background-color var(--dur-press) ease, color var(--dur-press) ease, box-shadow var(--dur-press) ease; }
.an[data-open] .an-act { opacity: 1; pointer-events: auto; translate: var(--an-x) var(--an-y); scale: 1;
  transition: translate 460ms var(--an-spring) var(--an-d, 0ms), scale 320ms var(--ease-out) var(--an-d, 0ms), opacity 120ms ease var(--an-d, 0ms),
    background-color var(--dur-press) ease, color var(--dur-press) ease, box-shadow var(--dur-press) ease; }
.an-ic { display: grid; place-items: center; transition: transform var(--dur-press) var(--ease-out); }
.an-ic > svg { display: block; }
.an[data-open] .an-act:active:not(:focus-visible) .an-ic { transform: scale(0.88); }
.an-act.is-danger { color: ${ink('--st-fail-text')}; }
.an-act[data-armed] { background: ${tint('fail')}; color: ${ink('--st-fail-text')}; box-shadow: 0 0 0 1.5px var(--st-fail), var(--ib-shadow); }

:is(.an-name, .an-trigger, .an-act):focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }

@media (hover: hover) and (pointer: fine) {
  .an-name:hover { text-decoration-color: color-mix(in srgb, currentColor 45%, transparent); }
  .an-trigger:hover { background: var(--ib-pill); color: var(--ib-text); }
  .an[data-open] .an-act:hover { background: color-mix(in srgb, var(--ib-text) 7%, var(--ib-card)); }
  .an[data-open] .an-act.is-danger:hover:not([data-armed]) { background: ${tint('fail')}; }
}
/* Touch: 44px reach on the trigger and the fan's buttons (an invisible hit area, the look unchanged) */
@media (pointer: coarse) {
  .an-trigger::before { content: ''; position: absolute; inset: -6px; border-radius: 50%; }
  .an-act::before { content: ''; position: absolute; inset: -4px; border-radius: 50%; }
}
/* Reduced motion: no slide, no overshoot, no scale, no stagger — the fan fades in and out where it stands */
@media (prefers-reduced-motion: reduce) {
  .an-card, .an[data-open] .an-card { translate: none; transition: none !important; }
  .an-act, .an[data-open] .an-act { translate: var(--an-x) var(--an-y); scale: 1; transition: opacity 140ms ease !important; }
  .an[data-open] .an-act:active:not(:focus-visible) .an-ic, .an-trigger:active:not(:focus-visible) { transform: none; }
  .an-spin { animation: none; }
  .an-spin::after { content: ''; position: absolute; inset: 0; width: 3px; height: 3px; margin: auto; border-radius: 50%; background: var(--an-c); }
}
`;
