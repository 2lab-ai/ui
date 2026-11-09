import { DIAL_RING_WIDTH } from './logic';

/**
 * The dial: a square face (`--dial-size`, never wider than its box) with the SVG behind and the words over its middle,
 * sized from the face's own width (container units) so a small dial keeps its proportions. The fill is the state colour
 * (the meter's tones) toward the ink by --chroma — in mono it is the ink. Ticks change colour one after another
 * (an inline transition-delay per tick, the sweep capped at 240ms); the ring's arc slides its dash offset on --dur-move.
 */
export const styles = `
:host { display: inline-block; vertical-align: middle; min-width: 0; max-width: 100%; line-height: 1.2; }
.ui-root { display: block; min-width: 0; }
.d {
  --d-mark: var(--ib-muted);
  --d-fill: color-mix(in srgb, var(--d-mark) calc(100% * var(--chroma)), var(--ib-text));
  --d-track: color-mix(in srgb, var(--ib-text) 11%, transparent);
  display: flex; flex-direction: column; align-items: center; gap: 10px; min-width: 0;
}
.d[data-tone="done"] { --d-mark: var(--st-done); }
.d[data-tone="wait"] { --d-mark: var(--st-wait); }
.d[data-tone="fail"] { --d-mark: var(--st-fail); }
.d[data-tone="accent"] { --d-mark: var(--accent); }

.d-face {
  position: relative; flex: none; width: var(--dial-size, 180px); max-width: 100%; aspect-ratio: 1;
  container-type: inline-size;
}
.d-svg { position: absolute; inset: 0; display: block; width: 100%; height: 100%; overflow: visible; }

.d-tick { fill: none; stroke: var(--d-track); stroke-linecap: round; transition: stroke var(--dur-fade) var(--ease-out); }
.d-tick.is-on { stroke: var(--d-fill); }
/* baseCss zeroes durations under reduced motion; the sweep's delays go too, so every tick jumps at once. */
@media (prefers-reduced-motion: reduce) { .d-tick { transition-delay: 0s !important; } }

.d-track, .d-arc { fill: none; stroke-width: ${DIAL_RING_WIDTH}; stroke-linecap: round; }
.d-track { stroke: var(--d-track); }
.d-arc {
  stroke: var(--d-fill);
  transition: stroke-dashoffset var(--dur-move) var(--ease-out), stroke 300ms ease, opacity var(--dur-fade) ease;
}
.d-arc.is-zero { opacity: 0; }

.d-center {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 0 20%; text-align: center; pointer-events: none;
}
.d-ring .d-center { padding: 0 16%; }
.d-num {
  display: inline-flex; align-items: baseline; justify-content: center; max-width: 100%;
  font-size: 44px; font-size: 25cqi; font-weight: 650; line-height: 1; letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums; color: var(--ib-text); white-space: nowrap;
}
.d-num.is-words { display: block; overflow: hidden; text-overflow: ellipsis; }
.d-num[data-long] { font-size: 28px; font-size: 15cqi; letter-spacing: -0.02em; }
.d[data-tone="idle"] .d-num { color: var(--ib-muted); }
.d-unit { margin-left: 0.04em; font-size: 0.5em; font-weight: 600; letter-spacing: 0; color: var(--ib-text-2); }
.d-cap {
  max-width: 100%; margin-top: 6px; margin-top: 3.5cqi;
  font-size: 12.5px; font-size: max(10.5px, 7cqi); font-weight: 500; line-height: 1.2; color: var(--ib-muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.d-delta {
  --d-delta-mark: var(--ib-muted);
  --d-delta-ink: var(--ib-text-2);
  display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px 6px; max-width: 100%;
  margin: 0; font-size: 12.5px; line-height: 1.4; color: var(--ib-text-2); text-align: center; overflow-wrap: anywhere;
}
.d-delta[data-tone="done"] {
  --d-delta-mark: var(--st-done);
  --d-delta-ink: color-mix(in srgb, var(--st-done) calc(70% * var(--chroma)), var(--ib-text));
}
.d-delta[data-tone="fail"] {
  --d-delta-mark: var(--st-fail);
  --d-delta-ink: color-mix(in srgb, var(--st-fail-text) calc(70% * var(--chroma)), var(--ib-text));
}
.d-delta-n {
  flex: none; padding: 2px 7px; border-radius: 999px;
  background: color-mix(in srgb, var(--d-delta-mark) calc(14% * var(--chroma)), var(--ib-pill));
  color: var(--d-delta-ink); font-size: 11.5px; font-weight: 650; line-height: 1.3; font-variant-numeric: tabular-nums;
  transition: color 300ms ease, background-color 300ms ease;
}
.d-delta-t { min-width: 0; }
`;
