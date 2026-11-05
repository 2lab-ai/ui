/**
 * The slide-to-confirm track (bencho.dev's numbers): 56px tall, a 4px pad, a 48px grip; a pill outside, the inner
 * radius 4px less. `--sc-p` is the share of the travel the grip has crossed, `--sc-q` how far the grip has opened out
 * to fill the track. Everything that moves is a function of the two, in CSS, so the grip is placed with no measuring
 * and follows any resize. A drag sets them with no transition; every other move is a transition on the curve of the
 * spring it stands for (`data-motion`), sampled from the same physics into `linear()`.
 */

/** The box (px). */
export const SLIDE_BOX = { height: 56, pad: 4, grip: 48 } as const;

/** A spring in motion's units: stiffness, damping, mass. */
export interface SlideSpring {
  stiffness: number;
  damping: number;
  mass: number;
}

/** bencho's speed 50: 260 + 50 / 100 × 640. */
const STIFFNESS = 580;
const MASS = 0.9;
const CRITICAL = 2 * Math.sqrt(STIFFNESS * MASS);

export const SLIDE_SPRINGS = {
  /** Critically damped: the take-over to the end and the morph. No overshoot. */
  take: { stiffness: STIFFNESS, damping: CRITICAL, mass: MASS },
  /** 0.62 of critical: home, with an 8% overshoot — which the grip spends as a squash against the end, not as travel. */
  home: { stiffness: STIFFNESS, damping: CRITICAL * 0.62, mass: MASS },
  /** The filled grip closing back home. */
  close: { stiffness: 380, damping: 34, mass: MASS },
} as const satisfies Record<string, SlideSpring>;

/**
 * How far a spring released from rest has come at `t` seconds: 0 at the start, 1 at its target. An underdamped
 * spring passes 1 and comes back.
 */
export function slideSpring(s: SlideSpring, t: number): number {
  const w = Math.sqrt(s.stiffness / s.mass);
  const z = s.damping / (2 * Math.sqrt(s.stiffness * s.mass));
  let left: number;
  if (Math.abs(z - 1) < 1e-6) left = Math.exp(-w * t) * (1 + w * t);
  else if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    left = Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
  } else {
    const r = Math.sqrt(z * z - 1);
    const a = -w * (z - r);
    const b = -w * (z + r);
    left = (b * Math.exp(a * t) - a * Math.exp(b * t)) / (b - a);
  }
  return 1 - left;
}

/**
 * A spring as a CSS transition: its duration (ms, until it stays within 0.2% of the target) and its curve as
 * `linear()`. `pin`: end the moment it first reaches the target — the overshoot is played some other way.
 */
export function slideEasing(s: SlideSpring, pin = false): { ms: number; easing: string } {
  let ms = 1;
  if (pin) while (ms < 3000 && slideSpring(s, ms / 1000) < 1) ms++;
  else {
    ms = 3000;
    while (ms > 1 && Math.abs(1 - slideSpring(s, (ms - 1) / 1000)) < 0.002) ms--;
  }
  const n = 16;
  const pts: string[] = [];
  for (let i = 0; i <= n; i++)
    pts.push(i === n ? '1' : String(Math.round(slideSpring(s, (ms * i) / n / 1000) * 1000) / 1000));
  return { ms, easing: `linear(${pts.join(', ')})` };
}

/** take: release past the mark → the end. home: back to the start. morph: the grip opens out. close: it closes again. */
export const SLIDE_MOTION = {
  take: slideEasing(SLIDE_SPRINGS.take),
  home: slideEasing(SLIDE_SPRINGS.home, true),
  morph: slideEasing(SLIDE_SPRINGS.take),
  close: slideEasing(SLIDE_SPRINGS.close),
};

const { height: H, pad: P, grip: G } = SLIDE_BOX;
const R = H / 2;
const r = Math.max(0, R - P);
/** The travel: the track less both pads and the grip. */
const TRAVEL = `(100% - ${2 * P + G}px)`;
const EASE = 'cubic-bezier(0.33, 0.55, 0.2, 1)';

const motions = (Object.keys(SLIDE_MOTION) as Array<keyof typeof SLIDE_MOTION>)
  .map((k) => `.sc[data-motion="${k}"] { --sc-dur: ${SLIDE_MOTION[k].ms}ms; --sc-ease: ${SLIDE_MOTION[k].easing}; }`)
  .join('\n');

export const styles = `
:host { display: block; min-width: 220px; max-width: var(--slide-w, 320px); }
.ui-root { display: block; }
.sc {
  --sc-track: var(--ib-seg); --sc-edge: var(--ib-card-border); --sc-ink: var(--ib-text); --sc-on: var(--ib-card);
  --sc-p: 0; --sc-q: 0; --sc-dur: 0ms; --sc-ease: linear;
  position: relative; display: block; width: 100%; height: ${H}px; border-radius: ${R}px;
  background: var(--sc-track); box-shadow: inset 0 0 0 1px var(--sc-edge); cursor: grab;
  touch-action: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;
  transition: background-color 600ms ease, box-shadow 600ms ease;
}
.sc[data-tone="danger"], .sc[data-tint] { --sc-ink: color-mix(in srgb, var(--st-fail) calc(82% * var(--chroma)), var(--ib-text)); }
.sc[data-tint] {
  background: color-mix(in srgb, var(--st-fail) calc(14% * var(--chroma)), var(--sc-track));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--st-fail) 60%, var(--sc-edge));
  transition-duration: 160ms;
}
.sc[data-held] { cursor: grabbing; }
.sc[data-filled] { cursor: default; }
.sc[data-disabled] { cursor: not-allowed; }
${motions}
.sc-say {
  position: absolute; inset: 0 16px 0 ${P + G + P}px; display: flex; align-items: center; justify-content: center;
  color: var(--ib-muted); font-size: 14px; font-weight: 500; letter-spacing: -0.01em; line-height: 1.2;
  white-space: nowrap; pointer-events: none;
  opacity: clamp(0, 1 - var(--sc-p) / 0.55, 1);
  transition: opacity var(--sc-dur) var(--sc-ease), color 300ms ease;
}
.sc-say > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.sc[data-note] .sc-say { color: var(--st-fail-text); }
.sc[data-filled] .sc-say { opacity: 0; }
.sc-wash {
  position: absolute; top: ${P}px; bottom: ${P}px; left: ${P}px; z-index: 1; border-radius: ${r}px;
  width: calc(${G}px + var(--sc-p) * ${TRAVEL}); background: var(--sc-ink); pointer-events: none;
  transition: width var(--sc-dur) var(--sc-ease), background-color 300ms ease;
}
.sc-grip {
  position: absolute; top: ${P}px; left: calc(${P}px + var(--sc-p) * ${TRAVEL}); z-index: 2; overflow: hidden;
  width: calc(${G}px + var(--sc-q) * ${TRAVEL}); height: ${G}px; border-radius: ${r}px;
  background: var(--sc-ink); color: var(--sc-on); transform-origin: 0% 50%;
  transition: left var(--sc-dur) var(--sc-ease), width var(--sc-dur) var(--sc-ease), scale var(--dur-press) var(--ease-out),
    background-color 300ms ease, color 300ms ease;
}
.sc-grip:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  .sc:not([data-held]):not([data-filled]):not([data-disabled]) .sc-grip:hover { scale: 1.03; }
}
.sc-arrow {
  position: absolute; top: 0; right: 0; width: ${G}px; height: ${G}px; display: grid; place-items: center;
  pointer-events: none; opacity: clamp(0, 1 - (var(--sc-p) - 0.55) / 0.4, 1);
  transition: opacity var(--sc-dur) var(--sc-ease);
}
.sc-arrow > svg { width: 20px; height: 20px; }
.sc[data-filled] .sc-arrow { opacity: 0; transition: opacity 160ms ease; }
.sc[data-motion="close"] .sc-arrow { transition: opacity 220ms ease 120ms; }
.sc[data-disabled] .sc-grip, .sc[data-disabled] .sc-wash {
  background: color-mix(in srgb, var(--ib-text) 10%, var(--sc-track)); color: var(--ib-muted);
}
.sc-end {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 0 16px;
  font-size: 14px; font-weight: 500; letter-spacing: -0.01em; line-height: 1.2; white-space: nowrap; pointer-events: none;
  opacity: 0; scale: 0.7; transition: opacity 160ms ${EASE}, scale 160ms ${EASE};
}
.sc-end > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.sc-end > svg { flex: none; width: 18px; height: 18px; }
.sc[data-show="done"] .sc-done, .sc[data-show="busy"] .sc-busy, .sc[data-show="fail"] .sc-fail { opacity: 1; scale: 1; }
.sc-spin {
  flex: none; width: 16px; height: 16px; border-radius: 50%;
  border: 1.5px solid color-mix(in srgb, currentColor 30%, transparent); border-top-color: currentColor;
}
.sc[data-show="busy"] .sc-spin { animation: sc-spin 0.9s linear infinite; }
@keyframes sc-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .sc-end { scale: none; }
  .sc[data-show="busy"] .sc-spin { animation-duration: 1.6s !important; animation-iteration-count: infinite !important; }
}
`;
