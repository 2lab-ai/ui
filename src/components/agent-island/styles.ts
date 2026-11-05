/**
 * bencho.dev's Dynamic island, in the library's tokens. The box is one object: width, height and corners ride one
 * spring (stiffness 380, damping 28 — sampled below as a `linear()` curve, ~4% overshoot), anchored at the top edge.
 * The content does not morph with it: the compact row and the open card crossfade (opacity 0 · scale .92 · blur 6px →
 * 1 · 1 · 0, 220ms), the entering one a beat (60ms) after the leaving one. Ink inverts with the theme; status marks on
 * ink are mixed 30% toward the pill's own foreground so they hold contrast on either background.
 */

/** The spring, sampled every 15ms over 420ms. */
export const ISLAND_SPRING =
  'linear(0, 0.037, 0.128, 0.249, 0.38, 0.509, 0.628, 0.732, 0.819, 0.888, 0.942, 0.981, 1.008, 1.025, 1.035, 1.039, 1.039, 1.036, 1.032, 1.027, 1.021, 1.017, 1.012, 1.008, 1.005, 1.003, 1.001, 1, 1)';

const MORPH = (ease: string) =>
  `width 420ms ${ease}, height 420ms ${ease}, border-radius 420ms ${ease}, scale var(--dur-press) var(--ease-out)`;
const FADE = 'opacity 220ms ease, scale 220ms var(--ease-out), filter 220ms ease';

export const styles = `
:host { display: block; min-width: 0; }
.ui-root { display: flex; justify-content: var(--island-align, center); align-items: flex-start; min-width: 0; }

/* ── The box: one shape ── */
.ai {
  --ai-bg: var(--ib-text); --ai-fg: var(--ib-card);
  --ai-fg-2: color-mix(in srgb, var(--ai-fg) 68%, var(--ai-bg));
  --ai-line: color-mix(in srgb, var(--ai-fg) 16%, transparent);
  --ai-line-2: color-mix(in srgb, var(--ai-fg) 26%, transparent);
  --ai-ring: color-mix(in srgb, var(--border-focus) 75%, var(--ai-fg));
  --ai-st: var(--st-run);
  --ai-mark: color-mix(in srgb, var(--ai-st) 70%, var(--ai-fg));
  --ai-pill-h: 36px;
  position: relative; flex: none; max-width: 100%; overflow: hidden;
  border-radius: calc(var(--ai-pill-h) / 2); background: var(--ai-bg); color: var(--ai-fg);
  -webkit-tap-highlight-color: transparent;
  /* Without linear() the first list stands. */
  transition: ${MORPH('var(--ease-out)')};
  transition: ${MORPH(ISLAND_SPRING)};
}
.ai[data-open] { border-radius: 32px; }
.ai[data-measure] { transition: none; }
.ai[data-status="waiting"] { --ai-st: var(--st-wait); }
.ai[data-status="done"] { --ai-st: var(--st-done); }
.ai[data-status="failed"] { --ai-st: var(--st-fail); }
.ai[data-tone="surface"] {
  --ai-bg: var(--ib-card); --ai-fg: var(--ib-text); --ai-fg-2: var(--ib-text-2);
  --ai-ring: var(--border-focus); --ai-mark: var(--ai-st);
  border: 1px solid var(--ib-card-border); box-shadow: var(--ib-shadow-raised);
}
/* Press: the whole shape gives a little. */
.ai:has(.ai-toggle:active:not(:focus-visible)) { scale: 0.97; }
/* The pill's ring goes round the box (the box clips what is inside it). */
.ai:has(.ai-pill:focus-visible) { outline: 2px solid var(--border-focus); outline-offset: 2px; }

/* ── Two faces, crossfading; the one on screen is in flow and sizes the box when it is not measured ── */
.ai-in { position: relative; display: flex; justify-content: center; align-items: flex-start; }
.ai-face { flex: none; transition: ${FADE}; }
.ai-face[data-on] { position: relative; transition-delay: 60ms; }
.ai-face:not([data-on]) {
  position: absolute; top: 0; left: 50%; translate: -50% 0;
  opacity: 0; scale: 0.92; filter: blur(6px); pointer-events: none;
}
.ai-face:not([data-on]) .ai-spin, .ai-face:not([data-on]) .ai-dot::after { animation-play-state: paused; }

/* ── Compact: mark · title · +N · clock ── */
.ai-compact { width: max-content; min-width: 150px; max-width: var(--ai-card-w, none); }
.ai-pill {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: var(--ai-pill-h); padding: 0 14px 0 11px;
  border: 0; background: none; color: inherit; font-size: 13px; font-weight: 500; line-height: 1.2; text-align: left;
  white-space: nowrap;
}
.ai-pill:focus-visible { outline: none; }
.ai-title { flex: 0 1 auto; min-width: 0; max-width: 14ch; overflow: hidden; text-overflow: ellipsis; }
.ai-end { display: inline-flex; flex: none; align-items: center; gap: 6px; margin-left: auto; padding-left: 4px; }
.ai-clock { font-variant-numeric: tabular-nums; letter-spacing: 0; }
.ai-more {
  display: inline-flex; align-items: center; height: 18px; padding: 0 6px; border-radius: 999px;
  background: var(--ai-line); font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums;
}

/* ── Status marks: a spinning ring (the kit's .ui-spinner), a pulsing dot, a check, a cross ── */
.ai-mark { display: inline-grid; flex: none; place-items: center; width: 16px; height: 16px; color: var(--ai-mark); }
.ai-mark svg { width: 14px; height: 14px; }
.ai-spin {
  position: relative; display: block; box-sizing: border-box; width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--ai-mark) 25%, transparent); border-top-color: var(--ai-mark);
  border-right-color: var(--ai-mark); animation: ai-spin 0.9s linear infinite;
}
.ai-dot { position: relative; display: block; width: 8px; height: 8px; border-radius: 50%; background: var(--ai-mark); }
.ai-dot::after {
  content: ''; position: absolute; inset: 0; border-radius: inherit; background: var(--ai-mark);
  animation: ai-pulse 1.6s var(--ease-out) infinite;
}
@keyframes ai-spin { to { transform: rotate(360deg); } }
@keyframes ai-pulse { from { opacity: 0.5; scale: 1; } to { opacity: 0; scale: 2.6; } }

/* ── Open: status + big clock · title · step · progress · actions ── */
.ai-card {
  display: flex; flex-direction: column; gap: 10px; width: var(--ai-card-w, min(340px, calc(100vw - 32px)));
  padding: 14px 18px 16px;
}
.ai-top { position: relative; display: flex; align-items: center; gap: 10px; min-height: 36px; }
.ai-head {
  display: inline-flex; align-items: center; gap: 8px; min-width: 0; padding: 0; border: 0; background: none;
  color: inherit; font-size: 13px; font-weight: 600; line-height: 1.2; text-align: left;
}
/* The head row is the toggle: its hit area and its ring cover the row, the clock included. */
.ai-head::after { content: ''; position: absolute; inset: -6px -8px; border-radius: 16px; }
.ai-head:focus-visible { outline: none; }
.ai-head:focus-visible::after { outline: 2px solid var(--ai-ring); outline-offset: -2px; }
.ai-word { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ai-big {
  margin-left: auto; font-size: 28px; font-weight: 500; line-height: 1; letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.ai-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.ai-name {
  margin: 0; font-size: 15px; font-weight: 650; line-height: 1.3; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden;
}
.ai-step {
  margin: 0; font-size: 13px; line-height: 1.4; color: var(--ai-fg-2); overflow-wrap: anywhere;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden;
}
.ai-prog {
  display: flex; align-items: center; gap: 10px; margin-top: 6px; font-size: 12px; color: var(--ai-fg-2);
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.ai-rail { flex: 1; height: 4px; border-radius: 2px; background: var(--ai-line); overflow: hidden; }
.ai-fill {
  display: block; height: 100%; border-radius: inherit; background: var(--ai-mark);
  transition: width var(--dur-move) var(--ease-out);
}

/* ── Actions: siblings of the toggle, never inside it ── */
.ai-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; }
.ai-act {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 36px; padding: 0 14px;
  border: 0; border-radius: 999px; background: var(--ai-line); color: var(--ai-fg); font-size: 13px; font-weight: 600;
  line-height: 1.2; white-space: nowrap;
  transition: background-color var(--dur-press) ease, opacity var(--dur-press) ease, scale var(--dur-press) var(--ease-out);
}
.ai-act svg { flex: none; }
.ai-act.is-round { width: 44px; height: 44px; padding: 0; border-radius: 50%; }
/* Danger: the red fill (ink in mono, where only marks keep their colour). */
.ai-act.is-danger {
  background: color-mix(in srgb, var(--st-fail) calc(100% * var(--chroma)), var(--ai-fg));
  color: color-mix(in srgb, var(--ib-card) calc(100% * var(--chroma)), var(--ai-bg));
}
.ai-act.is-round svg[data-icon="stop"] rect { fill: currentColor; }
.ai-act:focus-visible { outline: 2px solid var(--ai-ring); outline-offset: 2px; }
.ai-act:active:not(:focus-visible) { scale: 0.96; }

/* Hover: colour only, fine pointers only. */
@media (hover: hover) and (pointer: fine) {
  .ai:not([data-open]):hover { background: color-mix(in srgb, var(--ai-bg) 92%, var(--ai-fg)); }
  .ai-act:hover { background: var(--ai-line-2); }
  .ai-act.is-danger:hover { opacity: 0.88; }
}
/* 44px targets on touch and narrow screens. */
@media (pointer: coarse), (max-width: 639px) {
  .ai { --ai-pill-h: 44px; }
  .ai-act { min-height: 44px; }
}
/* Reduced motion: no spring, scale or blur — the size changes at once, the faces at most fade. */
@media (prefers-reduced-motion: reduce) {
  .ai, .ai[data-measure] { transition: none; }
  .ai:has(.ai-toggle:active:not(:focus-visible)), .ai-act:active:not(:focus-visible) { scale: none; }
  .ai-face, .ai-face:not([data-on]) { scale: none; filter: none; transition: opacity 120ms ease; }
  .ai-spin { animation: none; }
  .ai-spin::after {
    content: ''; position: absolute; inset: 0; width: 4px; height: 4px; margin: auto; border-radius: 50%;
    background: var(--ai-mark);
  }
  .ai-dot::after { animation: none; display: none; }
  .ai-fill { transition: none; }
}
`;
