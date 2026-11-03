/**
 * The site's `.top` bar for any page: sticky, 56px (52 on small screens), the page colour at 86% under a light
 * blur with a hairline below — opaque when the person asks for less transparency or the blur is unsupported.
 * Links are neutral chips (pill on hover and on the current page), icon buttons are bordered 34px squares,
 * the status is a tone dot plus a word, the account a neutral pill. Colour only where it carries status.
 * The toolbar slot rides in the row while it fits and takes a wrapping row of its own under the bar (toolbar-row)
 * when it does not — on the same translucent surface, one hairline between the two.
 */
export const styles = `
:host {
  position: sticky; top: 0; z-index: var(--ui-app-bar-z, 30); isolation: isolate; height: 56px;
  border-bottom: 1px solid var(--border); color: var(--ib-text);
}
/* The translucent layer is a pseudo-element, not the host: backdrop-filter on the host would make it the
   containing block of its position: fixed descendants, and the folded menu would be clipped by any scrolling
   ancestor of the bar. It reaches under the hairline so the border sits on the blur. */
:host::before {
  content: ""; position: absolute; inset: 0 0 -1px; z-index: -1; pointer-events: none;
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  -webkit-backdrop-filter: saturate(1.4) blur(10px); backdrop-filter: saturate(1.4) blur(10px);
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  :host::before { background: var(--bg); }
}
@media (prefers-reduced-transparency: reduce) {
  :host::before { background: var(--bg); -webkit-backdrop-filter: none; backdrop-filter: none; }
}
.ui-root { height: 100%; }
.ab-bar { display: flex; align-items: center; gap: 10px; height: 100%; min-width: 0; padding: 0 20px; }
.ab-parts { display: contents; }
/* The spacer takes the free room but not two gaps of its own: a crowded bar folds later. */
.ab-grow { flex: 1 1 0; min-width: 0; margin: 0 -5px; }

/* ── Brand: mark + label, 15 / 650 ── */
.ab-brand {
  display: inline-flex; align-items: center; gap: 9px; flex: none; min-width: 0; border-radius: 8px;
  color: var(--ib-text); font-size: 15px; font-weight: 650; letter-spacing: -0.01em; line-height: 20px;
  text-decoration: none; white-space: nowrap; -webkit-tap-highlight-color: transparent;
}
a.ab-brand { transition: transform var(--dur-press) var(--ease-out); }
.ab-mark { display: inline-grid; flex: none; place-items: center; width: 20px; height: 20px; }
.ab-mark > svg { width: 20px; height: 20px; }
.ab-brand-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
::slotted([slot="brand"]) { flex: none; min-width: 0; }
/* brand.heading: the page's h1, drawn exactly as the brand. */
.ab-heading { display: flex; flex: none; min-width: 0; margin: 0; font: inherit; letter-spacing: inherit; }

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
.ab-status[data-tone="run"] { --ab-tone: var(--st-run); color: color-mix(in srgb, var(--st-run) calc(70% * var(--chroma)), var(--ib-text)); }
.ab-status[data-tone="wait"] { --ab-tone: var(--st-wait); color: color-mix(in srgb, var(--st-wait) calc(70% * var(--chroma)), var(--ib-text)); }
.ab-status[data-tone="done"] { --ab-tone: var(--st-done); color: color-mix(in srgb, var(--st-done) calc(70% * var(--chroma)), var(--ib-text)); }
.ab-status[data-tone="fail"] { --ab-tone: var(--st-fail); color: color-mix(in srgb, var(--st-fail-text) calc(70% * var(--chroma)), var(--ib-text)); }
.ab-status[data-tone="idle"] .ab-dot { background: transparent; box-shadow: inset 0 0 0 1.5px var(--ab-tone); }
.ab-status[data-live] .ab-dot { animation: ab-pulse 1.6s ease-in-out infinite; }

/* ── Account: avatar + name + role tag, a neutral pill ── */
.ab-account {
  display: inline-flex; align-items: center; gap: 8px; flex: none; min-width: 0; height: 34px; margin: 0;
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

/* ── Toolbar: inline while it fits, else the row under the bar (wrapping) ── */
::slotted([slot="toolbar"]) { flex: none; min-width: 0; }
/* Unfolded, the host's actions keep their width: squeezed, a chip shrank under its neighbour instead of the bar
   overflowing and folding its links into the menu (0.21.0). Folded, they may give way like the brand and account. */
:host(:not([collapsed])) ::slotted([slot="actions"]) { flex: none; }
.ab-row { display: none; min-width: 0; padding: 8px 20px; border-top: 1px solid var(--border); }
:host([toolbar-row]) { height: auto; }
:host([toolbar-row]) .ab-bar { height: 56px; }
:host([toolbar-row]) .ab-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.ab-row ::slotted([slot="toolbar"]) { flex: 0 1 auto; max-width: 100%; }

/* ── Fold: below collapseAt the links leave for the menu ── */
/* Unfolded, brand and account keep their full width, so a crowded bar overflows and folds instead of clipping
   them; folded, they may give way (ellipsis) on the narrowest bars. */
:host([collapsed]) :is(.ab-brand, .ab-heading, .ab-account), :host([collapsed]) ::slotted([slot="brand"]) {
  flex: 0 1 auto;
}
.ab-fold { display: none; flex: none; }
:host([collapsed]) .ab-fold:not([hidden]) { display: flex; }
:host([collapsed]) .ab-nav { display: none; }
/* Narrow: the status keeps its dot (the word stays for screen readers), the account its avatar — and, folded
   with the name still too long, the brand its mark (mark-only; the name stays the link's accessible name). */
.ab-vh, :host([narrow]) .ab-status-label, :host([mark-only]) .ab-brand-label {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
:host([narrow]) .ab-account { flex: none; justify-content: center; width: 34px; padding: 0; }
:host([narrow]) .ab-name, :host([narrow]) .ab-role { display: none; }
:host([mark-only]) .ab-brand { min-width: 34px; }
@media (max-width: 639px) {
  :host { height: 52px; }
  .ab-bar { gap: 8px; padding: 0 12px; }
  :host([toolbar-row]) .ab-bar { height: 52px; }
  .ab-row { padding: 8px 12px; }
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
  :host([mark-only]) .ab-brand { min-width: 44px; }
}

@keyframes ab-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@keyframes ab-glyph-in { from { opacity: 0; transform: scale(0.9); } }
`;
