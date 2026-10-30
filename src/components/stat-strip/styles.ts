/**
 * One calm line: the period segments, label · figure pairs on a shared baseline (no card around each), and a quiet
 * More toggle at the end. Below 480px of its own width the period and More share the first line and the figures
 * take the second. The region below uses the disclosure recipe (grid rows 0fr → 1fr on --dur-expand with an
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
  .ss-row[data-period] .ss-nums { order: 3; flex-basis: 100%; }
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
