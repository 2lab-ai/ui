/**
 * The site's `.top` bar for any page: sticky, 56px (52 on small screens), the page colour at 86% under a light
 * blur with a hairline below — opaque when the person asks for less transparency or the blur is unsupported.
 * Links are neutral chips (pill on hover and on the current page), icon buttons are bordered 34px squares,
 * the status is a tone dot plus a word, the account a neutral pill. Colour only where it carries status.
 */
export const styles = `
:host {
  position: sticky; top: 0; z-index: var(--ui-app-bar-z, 30); height: 56px;
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  -webkit-backdrop-filter: saturate(1.4) blur(10px); backdrop-filter: saturate(1.4) blur(10px);
  border-bottom: 1px solid var(--border); color: var(--ib-text);
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  :host { background: var(--bg); }
}
@media (prefers-reduced-transparency: reduce) {
  :host { background: var(--bg); -webkit-backdrop-filter: none; backdrop-filter: none; }
}
.ui-root { height: 100%; }
.ab-bar { display: flex; align-items: center; gap: 12px; height: 100%; min-width: 0; padding: 0 20px; }
.ab-parts { display: contents; }
.ab-grow { flex: 1 1 0; min-width: 0; }

/* ── Brand: mark + label, 15 / 650 ── */
.ab-brand {
  display: inline-flex; align-items: center; gap: 9px; flex: 0 1 auto; min-width: 0; border-radius: 8px;
  color: var(--ib-text); font-size: 15px; font-weight: 650; letter-spacing: -0.01em; line-height: 20px;
  text-decoration: none; white-space: nowrap; -webkit-tap-highlight-color: transparent;
}
a.ab-brand { transition: transform var(--dur-press) var(--ease-out); }
.ab-mark { display: inline-grid; flex: none; place-items: center; width: 20px; height: 20px; }
.ab-mark > svg { width: 20px; height: 20px; }
.ab-brand-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
::slotted([slot="brand"]) { flex: 0 1 auto; min-width: 0; }

/* ── Nav: chip links ── */
.ab-nav { flex: none; margin-left: 4px; }
.ab-links { display: flex; align-items: center; gap: 2px; margin: 0; padding: 0; list-style: none; }
.ab-li { display: flex; }
.ab-link {
  display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 6px 10px; border-radius: 8px;
  color: var(--ib-text-2); font-size: 13.5px; font-weight: 500; line-height: 20px; text-decoration: none;
  white-space: nowrap; -webkit-tap-highlight-color: transparent;
  transition: background-color 150ms ease, color 150ms ease, transform var(--dur-press) var(--ease-out);
}
.ab-link > svg { flex: none; width: 14px; height: 14px; }
.ab-link[aria-current="page"] { background: var(--ib-pill); color: var(--ib-text); }
.ab-badge {
  flex: none; min-width: 18px; padding: 1px 6px; border-radius: 999px;
  background: color-mix(in srgb, var(--ib-text) 8%, transparent); color: var(--ib-text-2);
  font-size: 11px; font-weight: 600; line-height: 16px; text-align: center; font-variant-numeric: tabular-nums;
}

/* ── Status: tone dot + word; idle is hollow; live pulses ── */
.ab-status {
  --ab-tone: var(--ib-muted);
  display: inline-flex; align-items: center; gap: 6px; flex: none; min-width: 0; color: var(--ib-text-2);
  font-size: 12.5px; font-weight: 500; line-height: 16px; white-space: nowrap; font-variant-numeric: tabular-nums;
  transition: color 300ms ease;
}
.ab-dot {
  flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--ab-tone);
  transition: background-color 300ms ease, box-shadow 300ms ease;
}
.ab-status[data-tone="run"] { --ab-tone: var(--st-run); color: color-mix(in srgb, var(--st-run) 70%, var(--ib-text)); }
.ab-status[data-tone="wait"] { --ab-tone: var(--st-wait); color: color-mix(in srgb, var(--st-wait) 70%, var(--ib-text)); }
.ab-status[data-tone="done"] { --ab-tone: var(--st-done); color: color-mix(in srgb, var(--st-done) 70%, var(--ib-text)); }
.ab-status[data-tone="fail"] { --ab-tone: var(--st-fail); color: color-mix(in srgb, var(--st-fail-text) 70%, var(--ib-text)); }
.ab-status[data-tone="idle"] .ab-dot { background: transparent; box-shadow: inset 0 0 0 1.5px var(--ab-tone); }
.ab-status[data-live] .ab-dot { animation: ab-pulse 1.6s ease-in-out infinite; }

/* ── Account: avatar + name + role tag, a neutral pill ── */
.ab-account {
  display: inline-flex; align-items: center; gap: 8px; flex: 0 1 auto; min-width: 0; height: 34px; margin: 0;
  padding: 0 10px 0 4px; border: 1px solid var(--ib-card-border); border-radius: 999px; background: transparent;
  color: var(--ib-text); font-size: 13px; font-weight: 500; line-height: 18px; text-decoration: none;
  white-space: nowrap; -webkit-tap-highlight-color: transparent;
  transition: border-color 150ms ease, background-color 150ms ease, transform var(--dur-press) var(--ease-out);
}
.ab-avatar {
  display: inline-grid; flex: none; place-items: center; width: 24px; height: 24px; border-radius: 50%;
  background: var(--ib-pill); color: var(--ib-text); font-size: 10.5px; font-weight: 600; letter-spacing: 0.02em;
  line-height: 1;
}
.ab-avatar > svg { width: 14px; height: 14px; color: var(--ib-muted); }
.ab-name { min-width: 0; max-width: 160px; overflow: hidden; text-overflow: ellipsis; }
.ab-role {
  flex: none; padding: 1px 6px; border-radius: 999px; background: var(--ib-pill); color: var(--ib-text-2);
  font-size: 11px; font-weight: 600; line-height: 16px;
}

/* ── Icon buttons: theme toggle, menu trigger ── */
.ab-icon-btn {
  display: inline-grid; flex: none; place-items: center; width: 34px; height: 34px; margin: 0; padding: 0;
  border: 1px solid var(--ib-card-border); border-radius: 10px; background: transparent; color: var(--ib-text-2);
  -webkit-tap-highlight-color: transparent;
  transition: border-color 150ms ease, color 150ms ease, background-color 150ms ease,
    transform var(--dur-press) var(--ease-out);
}
.ab-icon-btn svg { width: 16px; height: 16px; }
.ab-icon-btn[aria-expanded="true"] { background: var(--ib-pill); color: var(--ib-text); }
.ab-glyph { display: inline-grid; place-items: center; }
.ab-glyph.is-in { animation: ab-glyph-in var(--dur-expand) var(--ease-out); }

/* ── Fold: below collapseAt the links leave for the menu ── */
.ab-fold { display: none; flex: none; }
:host([collapsed]) .ab-fold:not([hidden]) { display: flex; }
:host([collapsed]) .ab-nav { display: none; }
/* Narrow: the status keeps its dot (the word stays for screen readers), the account its avatar. */
:host([narrow]) .ab-status-label {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
:host([narrow]) .ab-account { justify-content: center; width: 34px; padding: 0; }
:host([narrow]) .ab-name, :host([narrow]) .ab-role { display: none; }
@media (max-width: 639px) {
  :host { height: 52px; }
  .ab-bar { gap: 8px; padding: 0 12px; }
}

/* ── Focus, press, hover (colour only, fine pointers) ── */
:is(.ab-brand, .ab-link, .ab-account, .ab-icon-btn):focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
:is(a.ab-brand, .ab-link, .ab-account, .ab-icon-btn):active:not(:focus-visible) { transform: scale(0.97); }
@media (hover: hover) and (pointer: fine) {
  .ab-link:hover { background: var(--ib-pill); color: var(--ib-text); }
  .ab-account:hover { border-color: var(--ib-muted); }
  .ab-icon-btn:hover { border-color: var(--ib-muted); color: var(--ib-text); }
}
/* ── 44px targets on touch ── */
@media (pointer: coarse) {
  a.ab-brand, .ab-link { min-height: 44px; }
  .ab-account { height: 44px; }
  .ab-icon-btn, :host([narrow]) .ab-account { width: 44px; height: 44px; }
}

@keyframes ab-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@keyframes ab-glyph-in { from { opacity: 0; transform: scale(0.9); } }
`;
