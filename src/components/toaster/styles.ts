/**
 * Toaster. Sizes and timings follow the affectUI Toaster pattern (356px stack, 10px peek, 5% shrink, 440ms lift,
 * 760ms spinner, 340ms drawn marks); every colour is a dashboard token or a color-mix() of tokens, so light and
 * dark both read.
 */
export const styles = `
:host { --ts-card: var(--surface); --ts-strong: var(--text); --ts-text: var(--text-secondary); --ts-icon: var(--text-tertiary);
  --ts-ring: color-mix(in srgb, var(--text) 11%, transparent);
  --ts-ring-hover: color-mix(in srgb, var(--text) 20%, transparent);
  --ts-hair: color-mix(in srgb, var(--text) 13%, transparent);
  --ts-soft: color-mix(in srgb, var(--text) 4%, var(--surface));
  --ts-shadow: 0 0 0 0.5px var(--ts-ring), var(--ib-shadow);
  --ts-shadow-hover: 0 0 0 0.5px var(--ts-ring-hover), var(--ib-shadow);
  --ts-float: 0 0 0 0.5px var(--ts-ring), var(--ib-shadow), 0 10px 24px -10px color-mix(in srgb, #000 18%, transparent);
  --ts-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --ts-spring: cubic-bezier(0.34, 1.3, 0.64, 1);
  --ts-offset: 24px;
  position: fixed; inset: 0; z-index: 9999; pointer-events: none; font-size: 13px; line-height: 20px; color: var(--ts-text); }
:host([inline]) { position: absolute; z-index: 20; --ts-offset: 20px; }
:host([hidden]) { display: none; }
button { appearance: none; margin: 0; padding: 0; border: 0; background: none; text-align: inherit; -webkit-tap-highlight-color: transparent; }
svg { display: block; flex: none; }

/* The stack: one corner (or edge) of the viewport — or of the positioned ancestor with inline */
.ts { position: absolute; display: flex; flex-direction: column; width: 356px; max-width: calc(100% - 2 * var(--ts-offset));
  margin: 0; pointer-events: auto; outline: none; }
.ts[data-empty] { pointer-events: none; }
.ts[data-y="top"] { top: var(--ts-offset); }
.ts[data-y="bottom"] { bottom: var(--ts-offset); flex-direction: column-reverse; }
:host(:not([inline])) .ts[data-y="top"] { top: max(var(--ts-offset), env(safe-area-inset-top)); }
:host(:not([inline])) .ts[data-y="bottom"] { bottom: max(var(--ts-offset), env(safe-area-inset-bottom)); }
.ts[data-x="right"] { right: var(--ts-offset); }
.ts[data-x="left"] { left: var(--ts-offset); }
.ts[data-x="center"] { left: 50%; transform: translateX(-50%); }
/* Under 600px: the width of the screen with 12px gutters */
.ts[data-narrow] { --ts-offset: 12px; left: 12px; right: 12px; width: auto; max-width: none; transform: none; }

.ts-list { position: relative; align-self: stretch; margin: 0; padding: 0; list-style: none;
  transition: height 380ms var(--ts-ease); }
.ts-toast { position: absolute; left: 0; right: 0; outline: none; touch-action: none; -webkit-user-select: none; user-select: none;
  transition: transform 440ms var(--ts-ease), opacity 320ms ease, height 380ms var(--ts-ease); }
.ts[data-y="bottom"] .ts-toast { bottom: 0; transform-origin: 50% 0; }
.ts[data-y="top"] .ts-toast { top: 0; transform-origin: 50% 100%; }
.ts-toast[data-removing] { pointer-events: none;
  transition: transform 380ms var(--ts-ease), opacity 260ms ease, height 380ms var(--ts-ease); }
.ts-toast[data-swiping] { cursor: grabbing; }
.ts-toast:focus-visible { outline: none; }
.ts-swipe { position: relative; height: 100%; transition: transform 460ms var(--ts-spring), opacity 260ms ease; }
.ts-card { position: relative; height: 100%; overflow: hidden; border-radius: 10px; background: var(--ts-card); box-shadow: var(--ts-float); }
.ts-toast:focus-visible .ts-card { outline: 2px solid var(--border-focus); outline-offset: 2px; }

/* One toast: status icon, title + description, link / action */
.ts-content { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px; padding: 12px 14px 12px 12px;
  transition: opacity 260ms ease; }
.ts-content[data-controls] { padding-right: 12px; }
.ts-toast[data-behind] .ts-content, .ts-toast[data-behind] .ts-timer { opacity: 0; }
.ts-text { position: relative; flex: 1 1 150px; min-width: 0; }
.ts-title { color: var(--ts-strong); font-weight: 500; overflow-wrap: anywhere; }
.ts-desc { color: var(--ts-text); overflow-wrap: anywhere; }
.ts-copy[data-changed] { animation: ts-text-in 300ms var(--ts-ease) both; }
.ts-ghost { position: absolute; top: 0; left: 0; right: 0; pointer-events: none; animation: ts-text-out 220ms ease both; }

/* Status: a spinning arc that closes into a ring while a check, a cross or a “!” draws in */
.ts-icon { display: grid; place-items: center; flex: none; width: 16px; height: 20px; color: var(--ts-icon); transition: color 300ms ease; }
.ts-icon[data-tone="success"] { color: var(--st-done); }
.ts-icon[data-tone="error"] { color: var(--st-fail); }
.ts-icon[data-tone="warning"] { color: var(--st-wait); }
.ts-status { width: 16px; height: 16px; overflow: visible; fill: none; stroke: currentColor; stroke-width: 1.8;
  stroke-linecap: round; stroke-linejoin: round; }
.ts-icon:is([data-tone="success"], [data-tone="error"], [data-tone="warning"]) .ts-status {
  animation: ts-pop 460ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.ts-spin { transform-box: fill-box; transform-origin: center; animation: ts-spin 760ms linear infinite; animation-play-state: paused; }
.ts-icon[data-tone="loading"] .ts-spin { animation-play-state: running; }
.ts-ring { stroke-dasharray: 1 0; stroke-opacity: 0.24; transition: stroke-dasharray 560ms var(--ts-ease), stroke-opacity 360ms ease; }
.ts-icon[data-tone="loading"] .ts-ring { stroke-dasharray: 0.28 0.72; stroke-opacity: 1; }
.ts-mark { stroke-dasharray: 1; stroke-dashoffset: 1; opacity: 0; }
.ts-dot { opacity: 0; transition: opacity 200ms ease; }
.ts-icon[data-tone="success"] .ts-check, .ts-icon[data-tone="error"] .ts-x1, .ts-icon[data-tone="error"] .ts-x2,
.ts-icon[data-tone="warning"] .ts-bang { opacity: 1; stroke-dashoffset: 0; animation: ts-draw 340ms var(--ts-ease) 160ms both; }
.ts-icon[data-tone="error"] .ts-x2 { animation-delay: 260ms; }
.ts-icon[data-tone="warning"] .ts-dot { opacity: 1; transition-delay: 320ms; }
/* Toasts already on screen when the element re-renders (language, settings) do not replay their entrance */
.ts-icon[data-still] .ts-status, .ts-icon[data-still] .ts-mark { animation: none; }
.ts-icon[data-still] .ts-dot { transition: none; }

/* Link and action */
.ts-controls { display: flex; align-items: center; gap: 6px; flex: 0 1 auto; min-width: 0; max-width: 100%; margin-left: auto;
  align-self: center; }
.ts-label { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ts-action { position: relative; flex: 0 1 auto; min-width: 0; height: 28px; margin: -4px 0; padding: 0 10px; border-radius: 6px;
  background: var(--ts-card); box-shadow: var(--ts-shadow); color: var(--ts-strong); font-size: 13px; font-weight: 500;
  line-height: 20px; white-space: nowrap;
  transition: background-color 140ms ease, box-shadow 140ms ease, transform 160ms var(--ts-ease); }
.ts-action:active { transform: scale(0.97); }
.ts-link { position: relative; flex: 0 1 auto; min-width: 0; padding: 0 2px; border-radius: 4px; color: var(--ts-text);
  font-weight: 500; text-decoration: none; text-underline-offset: 2px; transition: color 140ms ease; }

/* Close: a small round button on the card's corner, shown on hover and focus */
.ts-close { position: absolute; top: -7px; left: -7px; z-index: 1; display: grid; place-items: center; width: 20px; height: 20px;
  border-radius: 50%; background: var(--ts-soft); box-shadow: var(--ts-shadow); color: var(--ts-icon); opacity: 0;
  transform: scale(0.8);
  transition: opacity 160ms ease, transform 200ms var(--ts-ease), color 160ms ease, box-shadow 160ms ease; }
.ts-close::before { content: ""; position: absolute; inset: -6px; }
.ts-close > svg { width: 10px; height: 10px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; }
.ts-toast:not([data-behind]):hover .ts-close, .ts-toast:not([data-behind]):focus-within .ts-close { opacity: 1; transform: none; }
@media (hover: hover) {
  .ts-action:hover { background: var(--ts-soft); box-shadow: var(--ts-shadow-hover); }
  .ts-link:hover { color: var(--ts-strong); text-decoration: underline; }
  .ts-close:hover { color: var(--ts-strong); box-shadow: var(--ts-shadow-hover); }
}

/* The timer: a hairline that runs down and stops while the stack is paused */
.ts-timer { position: absolute; left: 12px; right: 12px; bottom: 0; height: 1px; background: var(--ts-hair); transform-origin: left;
  animation: ts-timer var(--ts-dur, 4000ms) linear both; transition: opacity 260ms ease; }

/* +N: toasts waiting behind the visible ones */
.ts-more { flex: none; align-self: flex-end; height: 20px; margin: 0 0 8px; padding: 0 8px; border-radius: 999px;
  background: var(--ts-card); box-shadow: var(--ts-shadow); color: var(--ts-text); font-size: 11.5px; font-weight: 600;
  line-height: 20px; font-variant-numeric: tabular-nums; animation: ts-fade 200ms ease both; }
.ts[data-y="top"] .ts-more { margin: 8px 0 0; }
.ts[data-x="left"] .ts-more { align-self: flex-start; }
.ts[data-x="center"] .ts-more { align-self: center; }
.ts-more[hidden] { display: none; }

@keyframes ts-spin { to { transform: rotate(360deg); } }
@keyframes ts-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes ts-pop { 0% { transform: scale(0.82); } 55% { transform: scale(1.08); } 100% { transform: none; } }
@keyframes ts-timer { from { transform: scaleX(1); } to { transform: scaleX(0); } }
@keyframes ts-text-in { from { opacity: 0; transform: translateY(4px); filter: blur(3px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes ts-text-out { from { opacity: 1; } to { opacity: 0; transform: translateY(-4px); filter: blur(3px); } }
@keyframes ts-fade { from { opacity: 0; } }

/* Touch: the close button always shows, and every control gets a 44px target */
@media (pointer: coarse) {
  .ts-toast:not([data-behind]) .ts-close { opacity: 1; transform: none; }
  .ts-close { top: -8px; left: -8px; width: 24px; height: 24px; }
  .ts-close::before { inset: -10px; }
  .ts-action { height: 36px; margin: -8px -2px -8px 0; padding: 0 14px; }
  .ts-action::before { content: ""; position: absolute; inset: -4px -2px; }
  .ts-link::before { content: ""; position: absolute; inset: -12px -4px; }
}
/* Reduced motion: everything switches at once (base styles), but the spinner keeps turning and the timer keeps time */
@media (prefers-reduced-motion: reduce) {
  .ts-spin { animation-duration: 760ms !important; animation-iteration-count: infinite !important; }
  .ts-timer { animation-duration: var(--ts-dur, 4000ms) !important; }
}
`;
