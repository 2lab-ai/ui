/**
 * The copy field. Inline: a 32px pill (44px buttons on a coarse pointer) — label, value, buttons; it is as wide as
 * its value, up to its container. Block: a box for a command, a `<pre>` that scrolls sideways, the buttons in its
 * top-right corner. The outcome is `data-state` on `.cf`: the three icons sit in one cell and cross-fade, the one
 * coming in settles from 0.6 to 1; the edge and a faint wash take the done / fail colour. Reduced motion: an instant swap.
 */
export const styles = `
:host { display: block; min-width: 0; max-width: 100%; }
.ui-root { display: block; min-width: 0; }
.cf { min-width: 0; }
.cf-box {
  position: relative; min-width: 0; border: 1px solid var(--ib-card-border);
  background: color-mix(in srgb, var(--ib-text) 3%, var(--ib-card)); color: var(--ib-text);
  transition: border-color 320ms ease, background-color 320ms ease;
}
.cf-label { color: var(--ib-muted); font-size: 12px; font-weight: 500; line-height: 1.3; white-space: nowrap; }
.cf-val { font-family: var(--mono); font-size: 12.5px; -webkit-user-select: all; user-select: all; }
.cf-val.is-masked, .cf-val.is-empty { -webkit-user-select: none; user-select: none; color: var(--ib-muted); }
.cf-val.is-masked { letter-spacing: 0.12em; }
.cf[data-disabled] .cf-val { color: var(--ib-muted); }
a.cf-val, .cf-link {
  color: inherit; text-decoration: underline; text-decoration-color: color-mix(in srgb, currentColor 35%, transparent);
  text-underline-offset: 3px; border-radius: 4px;
}
@media (hover: hover) and (pointer: fine) {
  a.cf-val:hover, .cf-link:hover { text-decoration-color: currentColor; }
}

/* inline */
.cf[data-view="inline"] .cf-box {
  display: flex; align-items: center; gap: 8px; width: fit-content; max-width: 100%; height: 32px;
  padding: 0 1px 0 12px; border-radius: 999px;
}
/* A cap in em, not %: the pill fits its content, so a percentage of it would clip a short label beside an empty value. */
.cf[data-view="inline"] .cf-label { flex: 0 1 auto; max-width: 12em; min-width: 3ch; overflow: hidden; text-overflow: ellipsis; }
.cf[data-view="inline"] .cf-val { display: flex; flex: 0 1 auto; min-width: 0; line-height: 1.4; white-space: nowrap; }
/* The head gives way (its end turns into “…”); the tail — a URL's last segment — stays whole. */
.cf-head { flex: 0 1 auto; min-width: 3ch; overflow: hidden; text-overflow: ellipsis; }
.cf-tail { flex: 0 0 auto; max-width: 75%; overflow: hidden; text-overflow: ellipsis; }

/* block */
.cf[data-view="block"] .cf-label { display: block; margin: 0 0 6px; overflow: hidden; text-overflow: ellipsis; }
.cf[data-view="block"] .cf-box { border-radius: 10px; }
.cf[data-view="block"] .cf-val {
  display: block; margin: 0; padding: 11px 46px 11px 14px; overflow-x: auto; border-radius: 9px;
  line-height: 1.6; white-space: pre; tab-size: 2;
}
.cf[data-view="block"] .cf-box[data-two] .cf-val { padding-right: 76px; }
.cf[data-view="block"] .cf-tools { position: absolute; top: 6px; right: 6px; }

/* the outcome: the edge and a faint wash (the wash scales with --chroma; the edge is a mark and keeps its colour) */
.cf[data-state] .cf-box { transition-duration: 120ms; }
.cf[data-state="done"] .cf-box {
  border-color: color-mix(in srgb, var(--st-done) 70%, var(--ib-card-border));
  background: color-mix(in srgb, var(--st-done) calc(6% * var(--chroma)), var(--ib-card));
}
.cf[data-state="fail"] .cf-box {
  border-color: color-mix(in srgb, var(--st-fail) 70%, var(--ib-card-border));
  background: color-mix(in srgb, var(--st-fail) calc(6% * var(--chroma)), var(--ib-card));
}
.cf-note { margin: 6px 0 0; color: var(--st-fail-text); font-size: 12px; line-height: 1.4; }

/* buttons */
.cf-tools { display: flex; flex: none; align-items: center; gap: 2px; }
.cf-btn {
  position: relative; display: grid; place-items: center; width: 28px; height: 28px; margin: 0; padding: 0;
  border: 0; border-radius: 999px; background: transparent; color: var(--ib-text-2);
  -webkit-tap-highlight-color: transparent;
  transition: background-color 150ms ease, color 150ms ease, transform var(--dur-press) var(--ease-out);
}
.cf[data-view="block"] .cf-btn { border-radius: 7px; }
.cf-btn:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 1px; }
.cf-btn:disabled { color: var(--ib-muted); opacity: 0.45; cursor: default; }
.cf-btn:active:not(:disabled):not(:focus-visible) { transform: scale(0.92); }
@media (hover: hover) and (pointer: fine) {
  .cf-btn:not(:disabled):hover { background: color-mix(in srgb, var(--ib-text) 8%, transparent); color: var(--ib-text); }
}
.cf-eye[aria-pressed="true"] { background: var(--ib-pill); color: var(--ib-text); }
.cf-ic { grid-area: 1 / 1; display: grid; place-items: center; transition: opacity 140ms ease, scale 200ms var(--ease-out); }
.cf-ic > svg { display: block; width: 16px; height: 16px; }
.cf-ic.is-done, .cf-ic.is-fail { opacity: 0; scale: 0.6; }
.cf[data-state] .cf-ic.is-copy { opacity: 0; }
/* The check is a mark: its state colour follows --chroma (the raw tone in colour, ink in the mono palette). */
.cf[data-state="done"] .cf-ic.is-done { opacity: 1; scale: 1; color: color-mix(in srgb, var(--st-done) calc(100% * var(--chroma)), var(--ib-text)); }
.cf[data-state="fail"] .cf-ic.is-fail { opacity: 1; scale: 1; color: var(--st-fail); }

:is(.cf-val, .cf-link):focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }

@media (pointer: coarse) {
  .cf[data-view="inline"] .cf-box { height: auto; min-height: 46px; padding-left: 14px; }
  .cf-btn { width: 44px; height: 44px; }
  .cf[data-view="block"] .cf-tools { top: 0; right: 0; }
  .cf[data-view="block"] .cf-val { min-height: 44px; padding-right: 52px; }
  .cf[data-view="block"] .cf-box[data-two] .cf-val { padding-right: 96px; }
}
@media (prefers-reduced-motion: reduce) {
  .cf-ic, .cf-box { transition: none; }
  .cf-ic.is-done, .cf-ic.is-fail { scale: none; }
  .cf-btn:active:not(:disabled):not(:focus-visible) { transform: none; }
}
`;
