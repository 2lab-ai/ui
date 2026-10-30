/**
 * One calm line: the period segments, label · figure pairs on a shared baseline (no card around each), and a quiet
 * More toggle at the end. Below 480px of its own width the period takes the first line and the figures the second,
 * with More at its end — next to what it opens, whatever the period labels' width. The region below uses the disclosure recipe (grid rows 0fr → 1fr on --dur-expand with an
 * opacity fade, inert while closed). Figures roll in place (JS); the skeleton is the kit's 1.6s opacity pulse.
 */
export const styles = `
:host { display: block; min-width: 0; }
.ss { container: ss / inline-size; min-width: 0; }
.ss-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; min-height: 32px; }
.ss-period { flex: none; }
.ss-nums { display: flex; flex: 1 1 auto; flex-wrap: wrap; align-items: baseline; gap: 4px 20px; min-width: 0; margin: 0; padding: 0; }
.ss-m { display: inline-flex; align-items: baseline; gap: 6px; min-width: 0; white-space: nowrap; }
.ss-label { margin: 0; font-size: 12px; font-weight: 500; line-height: 22px; color: var(--text-tertiary); }
.ss-val {
  display: inline-flex; align-items: baseline; min-height: 22px; margin: 0;
  font-size: 16px; font-weight: 600; line-height: 22px; letter-spacing: -0.01em; color: var(--text); font-variant-numeric: tabular-nums;
}
.ss-fig { font-variant-numeric: tabular-nums; }
.ss-fig.is-none { font-weight: 500; color: var(--text-tertiary); }
.ss-sk {
  display: inline-block; align-self: center; width: 3.2em; height: 14px; border-radius: 4px; background: var(--ib-pill);
  animation: ss-pulse 1.6s ease-in-out infinite; animation-delay: calc(var(--i, 0) * 120ms);
}
@keyframes ss-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }

/* A free-form figure (slot): the host's markup in the figure's place. */
.ss-free { display: inline-flex; min-width: 0; white-space: normal; }
/* The slotted element lays its parts out with room between them (page CSS overrides it). */
.ss-free ::slotted(*) { display: inline-flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; min-width: 0; }

/* ── layout: 'cards' — a grid of tiles, label above a large figure (no line, no separators) ── */
.ss[data-layout="cards"] .ss-nums {
  display: grid; flex: 1 1 100%; grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr)); gap: 8px;
  align-items: stretch;
}
.ss[data-layout="cards"] .ss-m {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 12px 16px; white-space: normal;
  border: 1px solid var(--border); border-radius: 12px; background: var(--surface); box-shadow: var(--ib-shadow);
  transition: border-color 150ms ease;
}
.ss[data-layout="cards"] .ss-m[data-wide] { grid-column: span 2; }
.ss[data-layout="cards"] .ss-label { line-height: 16px; }
.ss[data-layout="cards"] :is(.ss-val, .ss-tip, .ss-fig-btn) {
  min-height: 28px; font-size: 22px; line-height: 28px; letter-spacing: -0.02em;
}
.ss[data-layout="cards"] .ss-free { font-size: 15px; line-height: 22px; letter-spacing: -0.01em; }
.ss[data-layout="cards"] .ss-sk { width: 64px; height: 22px; border-radius: 6px; }

/* The figure as the trigger of its breakdown: same type as a plain figure, a dotted underline says there is more. */
.ss-tip { font-size: 16px; font-weight: 600; line-height: 22px; letter-spacing: -0.01em; color: var(--text); vertical-align: baseline; }
.ss-fig-btn {
  position: relative; display: inline-flex; align-items: baseline; margin: 0 -4px; padding: 0 4px; border: 0; border-radius: 6px;
  background: none; color: var(--text); font: inherit; font-size: 16px; font-weight: 600; line-height: 22px; letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums; cursor: pointer; -webkit-tap-highlight-color: transparent;
  text-decoration: underline dotted; text-decoration-thickness: 1px; text-underline-offset: 4px;
  text-decoration-color: color-mix(in srgb, var(--ib-muted) 60%, transparent);
  transition: background-color 150ms ease, text-decoration-color 150ms ease, transform var(--dur-press) var(--ease-out);
}
.ss-fig-btn:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
.ss-fig-btn:active:not(:focus-visible) { transform: scale(0.97); }

/* Breakdown card content (slotted into the tooltip's card bubble). */
.ss-bd { display: block; min-width: 168px; }
.ss-bd-title { margin: 0 0 6px; font-size: 12px; font-weight: 600; line-height: 1.4; color: var(--ib-text); }
.ss-bd-rows { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 18px; margin: 0; font-size: 12.5px; line-height: 1.45; }
.ss-bd-rows > div { display: contents; }
.ss-bd-rows dt { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--ib-text-2); }
.ss-bd-rows dd { margin: 0; text-align: right; font-weight: 600; color: var(--ib-text); font-variant-numeric: tabular-nums; }
.ss-hint { display: block; }

/* More: a quiet button, the chevron turns over on open. */
.ss-more {
  display: inline-flex; flex: none; align-items: center; gap: 4px; margin-left: auto; min-height: 28px; padding: 0 6px 0 8px;
  border: 0; border-radius: 8px; background: none; color: var(--ib-text-2); font: inherit; font-size: 12.5px; font-weight: 500;
  line-height: 1; white-space: nowrap; cursor: pointer; -webkit-tap-highlight-color: transparent;
  transition: background-color 150ms ease, color 150ms ease, transform var(--dur-press) var(--ease-out);
}
.ss-more[aria-expanded="true"] { color: var(--ib-text); }
.ss-more:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
.ss-more:active:not(:focus-visible) { transform: scale(0.97); }
.ss-chev { flex: none; width: 12px; height: 12px; color: var(--ib-muted); transition: transform var(--dur-press) var(--ease-out); }
.ss-more[aria-expanded="true"] .ss-chev { transform: rotate(180deg); }

.ss-region { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--dur-expand) var(--ease-out); }
.ss[data-open] .ss-region { grid-template-rows: 1fr; }
.ss-inner {
  min-height: 0; overflow: hidden; opacity: 0; visibility: hidden;
  transition: opacity var(--dur-expand) var(--ease-out), visibility 0s linear var(--dur-expand);
}
.ss[data-open] .ss-inner { opacity: 1; visibility: visible; transition: opacity var(--dur-expand) var(--ease-out), visibility 0s; }
.ss[data-open][data-settled] .ss-inner { overflow: visible; }
.ss-body { padding-top: 12px; }

@media (hover: hover) and (pointer: fine) {
  .ss-fig-btn:hover { background: var(--ib-pill); text-decoration-color: transparent; }
  .ss-more:hover { background: var(--ib-pill); color: var(--ib-text); }
}
@container ss (max-width: 479px) {
  .ss-row[data-period] .ss-period { flex-basis: 100%; }
  .ss-row[data-period] .ss-nums { flex: 1 1 0; }
  .ss[data-layout="cards"] .ss-nums { gap: 6px; }
  .ss[data-layout="cards"] .ss-m { padding: 8px 12px; }
  .ss[data-layout="cards"] :is(.ss-val, .ss-tip, .ss-fig-btn) { font-size: 18px; line-height: 24px; min-height: 24px; }
  .ss[data-layout="cards"] .ss-label { font-size: 11.5px; }
}
/* One column left (two need 2 × 140 + 8): a wide card is one column too. */
@container ss (max-width: 287px) {
  .ss[data-layout="cards"] .ss-m[data-wide] { grid-column: auto; }
}
/* A 44px More on touch and on phone-width windows. */
@media (max-width: 639px) {
  .ss-more { min-height: 44px; }
}
@media (pointer: coarse) {
  .ss-more { min-height: 44px; }
  /* A 44px tall hit area without making the line taller. */
  .ss-fig-btn::after { content: ''; position: absolute; inset: -11px -2px; }
}
@media (prefers-reduced-motion: reduce) {
  .ss-region, .ss-chev { transition: none !important; }
  .ss-inner { transition: opacity 120ms ease, visibility 0s linear 120ms !important; }
  .ss[data-open] .ss-inner { transition: opacity 120ms ease, visibility 0s !important; }
}
`;
