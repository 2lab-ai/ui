/**
 * Auth card — a centred sign-in / session-switch card. The page's one decision is the ink button; providers are
 * full-width hairline buttons (44px), the account and the two sessions are glyph tiles with a hairline.
 */
export const styles = `
:host { --ac-width: 380px; }
.ac { display: flex; flex-direction: column; align-items: center; gap: 16px; box-sizing: border-box; width: 100%;
  margin: 0 auto; color: var(--ib-text); }
:host([page]) .ac { min-height: 100dvh; justify-content: center; padding: max(24px, env(safe-area-inset-top)) 16px
  max(24px, env(safe-area-inset-bottom)); background: var(--bg); }
.ac-brand { display: inline-flex; align-items: center; gap: 10px; min-width: 0; color: var(--ib-text); text-decoration: none;
  font-size: 15px; font-weight: 650; letter-spacing: -0.01em; line-height: 1.2; border-radius: 8px; }
.ac-mark { display: inline-grid; flex: none; place-items: center; width: 28px; height: 28px; border-radius: 8px;
  background: var(--ib-card); box-shadow: inset 0 0 0 1px var(--ib-card-border), var(--ib-shadow); color: var(--ib-text); }
.ac-mark svg { width: 16px; height: 16px; }
.ac-card { box-sizing: border-box; width: 100%; max-width: var(--ac-width); padding: 24px; border: 1px solid var(--ib-card-border);
  border-radius: 16px; background: var(--ib-card); box-shadow: var(--ib-shadow-raised);
  animation: ac-in 360ms var(--ease-out) both; }
.ac-head { display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px; }
.ac-title { margin: 0; font-size: 19px; font-weight: 650; letter-spacing: -0.015em; line-height: 1.25; color: var(--ib-text);
  overflow-wrap: anywhere; }
.ac-text { margin: 0; font-size: 13.5px; line-height: 1.55; color: var(--ib-text-2); overflow-wrap: anywhere; }
.ac-text:empty { display: none; }
code { padding: 1px 5px; border-radius: 5px; background: var(--ib-pill); box-shadow: inset 0 0 0 1px var(--ib-card-border);
  font-family: var(--mono); font-size: 12px; color: var(--ib-text); }

/* Error: the fail tint, an alert glyph and the words */
.ac-error { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 16px; padding: 10px 12px; border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--st-fail) 35%, var(--ib-card-border));
  background: color-mix(in srgb, var(--st-fail) 14%, var(--ib-card)); color: color-mix(in srgb, var(--st-fail-text) 70%, var(--ib-text));
  font-size: 13px; line-height: 1.45; overflow-wrap: anywhere; animation: ac-rise var(--dur-fade) var(--ease-out) both; }
.ac-error svg { flex: none; width: 14px; height: 14px; margin-top: 2px; color: var(--st-fail); }

/* Buttons: ink primary, hairline default, quiet; providers are the default shape at 44px */
.ac-btn { display: flex; align-items: center; justify-content: center; gap: 10px; box-sizing: border-box; width: 100%; min-height: 44px;
  margin: 0; padding: 0 16px; border: 1px solid var(--ib-card-border); border-radius: 10px; background: var(--ib-card);
  color: var(--ib-text); font: inherit; font-size: 14px; font-weight: 550; line-height: 1.2; text-align: center;
  text-decoration: none; white-space: nowrap; cursor: pointer; -webkit-tap-highlight-color: transparent;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, opacity 150ms ease,
    transform var(--dur-press) var(--ease-out); }
.ac-btn + .ac-btn { margin-top: 10px; }
.ac-btn.is-primary { background: var(--ib-text); border-color: var(--ib-text); color: var(--ib-card); }
.ac-btn.is-quiet { background: transparent; border-color: transparent; color: var(--ib-text-2); }
.ac-ico ::slotted(*) { flex: none; width: 18px; height: 18px; }
.ac-btn .ac-ico { display: inline-grid; place-items: center; flex: none; width: 18px; height: 18px; }
.ac-btn .ac-ico > svg, .ac-btn .ac-ico > img { width: 18px; height: 18px; object-fit: contain; }
.ac-btn .ac-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.ac-btn .ac-wait, .ac-btn .ac-spin { display: none; }
.ac-btn[aria-busy="true"] .ac-ico, .ac-btn[aria-busy="true"] .ac-label { display: none; }
.ac-btn[aria-busy="true"] .ac-wait { display: inline; }
.ac-btn[aria-busy="true"] .ac-spin { display: inline-block; }
.ac-btn[aria-busy="true"] { cursor: progress; }
.ac-btn[aria-disabled="true"]:not([aria-busy="true"]) { opacity: 0.5; cursor: not-allowed; }
.ac-spin { flex: none; width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid color-mix(in srgb, currentColor 25%, transparent);
  border-top-color: currentColor; animation: ac-spin 0.9s linear infinite; }
.ac-btn:active:not([aria-disabled="true"]):not(:focus-visible) { transform: scale(0.97); }

/* Signed in: who, then continue / sign out */
.ac-account { margin: 0; }
.ac-label-sm { margin: 0 0 10px; font-size: 12px; font-weight: 500; color: var(--ib-muted); }
.ac-who { display: flex; align-items: center; gap: 12px; min-width: 0; margin-bottom: 18px; }
.ac-av { display: inline-grid; flex: none; place-items: center; width: 40px; height: 40px; border-radius: 50%;
  background: var(--ib-pill); box-shadow: inset 0 0 0 1px var(--ib-card-border); color: var(--ib-text);
  font-size: 14px; font-weight: 600; line-height: 1; user-select: none; }
.ac-av.is-sm { width: 32px; height: 32px; font-size: 12px; }
.ac-who-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ac-name { margin: 0; font-size: 15px; font-weight: 600; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ac-meta { margin: 0; font-size: 13px; line-height: 1.35; color: var(--ib-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Divider with a word */
.ac-divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; font-size: 12px; font-weight: 500; color: var(--ib-muted); }
.ac-divider::before, .ac-divider::after { content: ''; flex: 1; border-top: 1px solid var(--ib-card-border); }
.ac-hint { margin: 0; font-size: 13px; line-height: 1.6; text-align: center; color: var(--ib-text-2); overflow-wrap: anywhere; }

/* Session switch: the session you leave, the one you get */
.ac-sessions { display: flex; flex-direction: column; margin: 0 0 20px; padding: 0; list-style: none; border: 1px solid var(--ib-card-border);
  border-radius: 12px; overflow: hidden; }
.ac-session { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 12px 14px; }
.ac-session + .ac-session { border-top: 1px solid var(--ib-card-border); }
.ac-session.is-next { background: color-mix(in srgb, var(--ib-pill) 60%, var(--ib-card)); }
.ac-session .ac-who-text { flex: 1; }
.ac-session .ac-label-sm { margin: 0; }
.ac-session .ac-name { font-size: 14px; }
.ac-session .ac-arrow { flex: none; color: var(--ib-muted); }
/* Cancel · Continue as …: the primary grows and its label wraps; when the pair cannot share the row the primary takes
   a row of its own, above Cancel (wrap-reverse), so a long name never cuts off */
.ac-actions { display: flex; flex-wrap: wrap-reverse; gap: 10px; }
.ac-actions .ac-btn { flex: 1 1 auto; min-width: 0; margin: 0; padding: 10px 16px; }
.ac-actions .ac-btn.is-primary { flex: 2 1 auto; white-space: normal; }
.ac-actions .ac-btn.is-primary .ac-label { overflow: visible; text-overflow: clip; overflow-wrap: anywhere; }
.ac-actions form { display: contents; }

.ac-fine { max-width: var(--ac-width); margin: 0; font-size: 12px; line-height: 1.5; text-align: center; color: var(--ib-muted);
  overflow-wrap: anywhere; }
.ac-fine:empty { display: none; }
.ac-fine a, .ac-hint a, .ac-text a { color: var(--accent); text-decoration: none; }
/* Korean prose breaks between words, never inside them (the base sheet sets it for the whole card; named here too) */
:host([lang="ko"]) :is(.ac-title, .ac-text, .ac-hint, .ac-fine, .ac-error, .ac-label) { word-break: keep-all; }
::slotted([slot="fine-print"]) { margin: 0; }

:is(.ac-btn, .ac-brand, a):focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }

@media (hover: hover) and (pointer: fine) {
  .ac-btn:hover:not([aria-disabled="true"]) { border-color: var(--ib-muted); }
  .ac-btn.is-primary:hover:not([aria-disabled="true"]) { border-color: var(--ib-text); opacity: 0.88; }
  .ac-btn.is-quiet:hover:not([aria-disabled="true"]) { border-color: transparent; background: var(--ib-pill); color: var(--ib-text); }
  .ac-fine a:hover, .ac-hint a:hover, .ac-text a:hover { text-decoration: underline; }
}
@container ac (max-width: 300px) { .ac-actions { flex-direction: column-reverse; } }
.ac-card { container: ac / inline-size; }
@media (max-width: 420px) { .ac-card { padding: 20px 16px; } }
@media (prefers-reduced-motion: reduce) {
  .ac-card, .ac-error { animation: ac-fade 120ms ease both; }
  .ac-btn { transition: none; }
}
@keyframes ac-in { from { opacity: 0; transform: translateY(4px); filter: blur(2px); } }
@keyframes ac-rise { from { opacity: 0; transform: translateY(2px); } }
@keyframes ac-fade { from { opacity: 0; } }
@keyframes ac-spin { to { transform: rotate(360deg); } }
`;
