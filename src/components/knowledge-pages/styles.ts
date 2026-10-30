import { mdDocCss } from '../../core/markdown';

/**
 * Knowledge pages, drawn in the library language: a 12px card split into a recessed list column (the open page is
 * the raised neutral chip) and the editor. Inputs are the 34px library fields; the one ink primary is Save; Delete
 * arms in the fail tint; alerts are tone tints (icon + words). Below a 640px container width the two columns stack
 * and only one shows (`data-view`), with a back button. Tints are color-mix() of tokens — no literals.
 */
const tint = (tone: string, pct = 14) => `color-mix(in srgb, var(--st-${tone}) ${pct}%, var(--ib-card))`;
const ink = (tone: string) => `color-mix(in srgb, var(${tone}) 70%, var(--ib-text))`;

export const styles = `
${mdDocCss}
[hidden] { display: none !important; }
button { appearance: none; margin: 0; border: 0; background: none; letter-spacing: inherit; -webkit-tap-highlight-color: transparent; }
input, textarea, select { margin: 0; letter-spacing: inherit; }
h2, h3, p, ol, ul { margin: 0; }
:is(.kp-rows, .kp-hist, .kp-aliases, .kp-read-hist) { padding: 0; list-style: none; }
.ui-root { height: 100%; }

.kp { --kp-list: color-mix(in srgb, var(--ib-seg) 55%, var(--ib-card)); container: kp / inline-size; position: relative; height: 100%;
  min-height: 360px; overflow: hidden; border: 1px solid var(--ib-card-border); border-radius: 12px; background: var(--ib-card);
  box-shadow: var(--ib-shadow); color: var(--ib-text); font-size: 13px; line-height: 1.45; letter-spacing: -0.006em; }
:host([lang="ko"]) .kp { word-break: keep-all; }
.kp-grid { display: grid; grid-template-columns: 248px minmax(0, 1fr); height: 100%; min-height: inherit; }

/* ── list column ── */
.kp-list { display: flex; flex-direction: column; min-width: 0; min-height: 0; border-right: 1px solid var(--ib-card-border); background: var(--kp-list); }
.kp-tools { display: flex; flex: none; align-items: center; gap: 6px; padding: 10px 10px 8px; }
.kp-search { position: relative; flex: 1; min-width: 0; }
.kp-search-i { position: absolute; left: 10px; top: 50%; translate: 0 -50%; color: var(--ib-muted); pointer-events: none; }
.kp-q { display: block; width: 100%; min-height: 34px; padding: 6px 10px 6px 30px; border: 1px solid var(--ib-card-border); border-radius: 8px;
  background: var(--surface-raised); color: var(--ib-text); font-size: 13px; line-height: 1.35; -webkit-appearance: none; appearance: none;
  transition: border-color var(--dur-press) ease, background-color var(--dur-press) ease; }
.kp-q::placeholder { color: var(--text-tertiary); opacity: 1; }
.kp-q::-webkit-search-cancel-button, .kp-q::-webkit-search-decoration { -webkit-appearance: none; appearance: none; }
.kp-q:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 0; border-color: transparent; }
.kp-new { display: inline-flex; flex: none; align-items: center; justify-content: center; gap: 4px; min-height: 34px; padding: 0 10px 0 8px;
  border: 1px solid var(--ib-card-border); border-radius: 8px; background: var(--ib-card); color: var(--ib-text); font-size: 12.5px;
  font-weight: 500; white-space: nowrap; cursor: pointer;
  transition: background-color var(--dur-press) ease, border-color var(--dur-press) ease, transform var(--dur-press) var(--ease-out); }
.kp-new > svg { color: var(--ib-muted); }
.kp-new[aria-pressed="true"] { background: var(--ib-seg-on); box-shadow: var(--ib-shadow); }
.kp-scroll { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 0 8px 10px; }
.kp-gb + .kp-gb { margin-top: 6px; }
.kp-gh { display: flex; align-items: center; gap: 6px; padding: 10px 8px 4px; font-size: 11.5px; font-weight: 600; line-height: 16px; color: var(--ib-muted); }
.kp-gl { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kp-gn { flex: none; font-weight: 500; font-variant-numeric: tabular-nums; }
.kp-rows { display: flex; flex-direction: column; gap: 1px; }
.kp-row { display: flex; flex-direction: column; gap: 1px; width: 100%; min-height: 40px; padding: 7px 10px; border-radius: 8px; color: var(--ib-text);
  text-align: left; cursor: pointer;
  transition: background-color var(--dur-press) ease, box-shadow var(--dur-press) ease, transform var(--dur-press) var(--ease-out); }
.kp-row:focus-visible { outline-offset: -2px; }
.kp-row[aria-current="true"] { background: var(--ib-seg-on); box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow); }
.kp-row-top { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.kp-row-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 500; line-height: 19px; }
.kp-row[aria-current="true"] .kp-row-title { font-weight: 600; }
.kp-ago { flex: none; font-size: 11.5px; color: var(--ib-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.kp-row-alias { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; line-height: 17px; color: var(--ib-muted); }
.kp-dot { display: inline-block; flex: none; align-self: center; width: 6px; height: 6px; border-radius: 50%; background: var(--st-wait); }
.kp-nomatch { padding: 18px 8px; font-size: 12.5px; line-height: 18px; color: var(--ib-muted); text-align: center; overflow-wrap: anywhere; }
.kp-nomatch p { margin-bottom: 6px; }
.kp-link { min-height: 28px; padding: 0 8px; border-radius: 6px; color: var(--accent); font-size: 12.5px; font-weight: 500; cursor: pointer;
  transition: background-color var(--dur-press) ease; }

/* ── detail column ── */
.kp-detail { position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.kp-back { display: none; flex: none; align-self: flex-start; align-items: center; gap: 2px; min-height: 32px; margin: 8px 0 0 8px; padding: 0 10px 0 4px;
  border-radius: 8px; color: var(--ib-text-2); font-size: 12.5px; font-weight: 500; cursor: pointer;
  transition: background-color var(--dur-press) ease, color var(--dur-press) ease, transform var(--dur-press) var(--ease-out); }
.kp-pick { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 32px 20px; color: var(--ib-muted); font-size: 13px; text-align: center; }
.kp-pick-i { color: var(--ib-muted); opacity: 0.8; }
.kp-pad { padding: 16px 20px 0; }

.kp-edit, .kp-read { flex: 1; min-height: 0; overflow: auto; padding: 16px 20px 20px; }
.kp-edit { display: flex; flex-direction: column; gap: 14px; }
.kp-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; min-height: 22px; font-size: 12px; color: var(--ib-muted); }
.kp-chip { display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 999px; background: var(--ib-pill); color: var(--ib-text-2);
  font-size: 12px; font-weight: 500; line-height: 1; white-space: nowrap; }
.kp-chip.is-new { background: ${tint('run')}; color: ${ink('--st-run')}; }
.kp-upd { font-variant-numeric: tabular-nums; white-space: nowrap; }
.kp-upd .kp-ago { font-size: inherit; }
.kp-ro { display: inline-flex; align-items: center; gap: 4px; }

.kp-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.kp-label { display: block; font-size: 12px; font-weight: 600; line-height: 16px; color: var(--ib-text-2); }
.kp-sub { font-weight: 400; color: var(--ib-muted); }
label .kp-sub { margin-left: 4px; }
.kp-input { display: block; width: 100%; min-width: 0; min-height: 34px; padding: 7px 10px; border: 1px solid var(--ib-card-border); border-radius: 8px;
  background: var(--surface-raised); color: var(--ib-text); font-size: 13px; line-height: 18px;
  transition: border-color var(--dur-press) ease, background-color var(--dur-press) ease; }
.kp-input::placeholder { color: var(--text-tertiary); opacity: 1; }
.kp-input:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 0; border-color: transparent; background: var(--ib-card); }
.kp-input[readonly] { color: var(--ib-text-2); }
.kp-input[aria-invalid="true"] { border-color: var(--st-fail); }
.kp-title { min-height: 38px; font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
.kp-select { -webkit-appearance: none; appearance: none; padding-right: 28px; cursor: pointer;
  background-image: linear-gradient(45deg, transparent 50%, var(--ib-muted) 50%), linear-gradient(135deg, var(--ib-muted) 50%, transparent 50%);
  background-position: calc(100% - 15px) 50%, calc(100% - 11px) 50%; background-size: 4px 4px; background-repeat: no-repeat; }
.kp-field-group { max-width: 280px; }
.kp-hint { font-size: 12px; line-height: 16px; color: var(--ib-muted); }
.kp-hint.is-bad { color: ${ink('--st-fail-text')}; }

.kp-sec { display: flex; flex-direction: column; gap: 8px; min-width: 0; padding-top: 14px; border-top: 1px solid var(--border); }
.kp-sec-head { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; min-height: 28px; }
.kp-sec-head .kp-sub { font-size: 12px; }
.kp-seg { display: inline-flex; flex: none; gap: 2px; margin-left: auto; padding: 2px; border-radius: 10px; background: var(--ib-seg); }
.kp-seg button { min-height: 24px; padding: 0 10px; border-radius: 8px; color: var(--ib-text-2); font-size: 12px; font-weight: 500; cursor: pointer;
  transition: background-color var(--dur-press) ease, color var(--dur-press) ease, box-shadow var(--dur-press) ease; }
.kp-seg button[aria-pressed="true"] { background: var(--ib-seg-on); color: var(--ib-text); box-shadow: var(--ib-shadow); }
.kp-seg button:focus-visible { outline-offset: 0; }
.kp-h-add { margin-left: auto; }

/* Auto-grow: the textarea and a hidden copy of its text share one grid cell; the copy sets the height. */
.kp-gw { display: grid; min-width: 0; }
.kp-gw::after { content: attr(data-v) " "; visibility: hidden; white-space: pre-wrap; overflow-wrap: anywhere; }
.kp-gw > textarea, .kp-gw::after { grid-area: 1 / 1; min-width: 0; padding: 7px 10px; font: inherit; font-size: 13px; line-height: 20px; }
.kp-gw::after { border: 1px solid transparent; }
.kp-gw > textarea { resize: none; overflow: hidden; }
.kp-cur > textarea, .kp-cur::after { min-height: 168px; max-height: none; padding: 10px 12px; font-family: var(--mono); font-size: 12.5px; line-height: 20px; }
/* Source mode: one mono box over the whole page; the form ↔ source link sits at the end of the meta row */
.kp-src > textarea, .kp-src::after { min-height: 240px; max-height: none; padding: 10px 12px; font-family: var(--mono); font-size: 12.5px; line-height: 20px; tab-size: 2; }
.kp-src-toggle { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; min-height: 24px; padding: 0 6px; }
.kp-src-toggle > svg { color: var(--ib-muted); }
.kp-src-toggle[aria-disabled="true"] { opacity: 0.45; cursor: not-allowed; }
.kp-src-note { margin-top: -8px; }
.kp-preview { min-height: 168px; padding: 10px 12px; border: 1px solid var(--ib-card-border); border-radius: 8px; background: var(--ib-card); }
.kp-preview:focus-visible { outline-offset: 0; }
.kp-doc { font-size: 13.5px; line-height: 1.6; }
.kp-muted { font-size: 12.5px; color: var(--ib-muted); }

.kp-hist { display: flex; flex-direction: column; gap: 6px; }
.kp-h { display: grid; grid-template-columns: 116px minmax(0, 1fr) auto; align-items: start; gap: 6px; }
.kp-h-date { font-variant-numeric: tabular-nums; font-size: 12.5px; }
.kp-h-text::after, .kp-h-text > textarea { min-height: 34px; }
.kp-icon { display: grid; flex: none; place-items: center; width: 34px; height: 34px; border-radius: 8px; color: var(--ib-muted); cursor: pointer;
  transition: background-color var(--dur-press) ease, color var(--dur-press) ease, transform var(--dur-press) var(--ease-out); }
.kp-icon[aria-disabled="true"] { opacity: 0.45; cursor: not-allowed; }
.kp-h[data-fresh] { animation: kp-in 300ms var(--ease-out) both; }
@keyframes kp-in { from { opacity: 0; transform: translateY(3px); filter: blur(2px); } }

/* ── buttons ── */
.kp-btn { display: inline-flex; flex: none; align-items: center; justify-content: center; gap: 5px; min-height: 32px; padding: 0 12px;
  border: 1px solid var(--ib-card-border); border-radius: 8px; background: var(--ib-card); color: var(--ib-text); font-size: 12.5px;
  font-weight: 500; line-height: 1.2; white-space: nowrap; cursor: pointer; user-select: none;
  transition: background-color var(--dur-press) ease, border-color var(--dur-press) ease, color var(--dur-press) ease, opacity var(--dur-press) ease, transform var(--dur-press) var(--ease-out); }
.kp-btn > svg { flex: none; }
.kp-btn.is-sm { min-height: 28px; padding: 0 10px; font-size: 12px; }
.kp-btn.is-quiet { border-color: transparent; background: none; color: var(--ib-text-2); }
.kp-btn.is-primary { border-color: var(--ib-text); background: var(--ib-text); color: var(--ib-card); font-weight: 600; }
.kp-btn.is-danger { color: ${ink('--st-fail-text')}; }
.kp-del { color: ${ink('--st-fail-text')}; }
.kp-del[data-armed] { border-color: color-mix(in srgb, var(--st-fail) 45%, var(--ib-card-border)); background: ${tint('fail')}; font-weight: 600; }
.kp-btn[aria-disabled="true"] { opacity: 0.45; cursor: not-allowed; }
.kp-btn[aria-busy="true"] { opacity: 0.7; cursor: progress; }

.kp-foot { position: sticky; bottom: 0; z-index: 1; display: flex; flex: none; flex-wrap: wrap; align-items: center; gap: 8px; min-height: 52px;
  padding: 9px 20px; border-top: 1px solid var(--ib-card-border); background: var(--ib-card); }
.kp-state { flex: 1; min-width: 0; font-size: 12.5px; color: var(--ib-muted); }
.kp-unsaved, .kp-saved { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.kp-unsaved { color: var(--ib-text-2); }
.kp-saved { color: ${ink('--st-done')}; font-size: 12.5px; }
.kp-acts { display: inline-flex; flex: none; align-items: center; gap: 8px; margin-left: auto; }
.kp-save { min-width: 72px; }

/* ── guard, alerts ── */
.kp-guard { display: flex; flex: none; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin: 12px 20px 0; padding: 8px 8px 8px 12px; border-radius: 10px;
  background: ${tint('wait')}; color: ${ink('--st-wait')}; font-size: 12.5px; line-height: 18px; }
.kp-guard p { flex: 1 1 200px; min-width: 0; color: var(--ib-text); overflow-wrap: anywhere; }
.kp-guard-i { flex: none; }
.kp-guard-acts { display: inline-flex; flex: none; gap: 6px; margin-left: auto; }
.kp-alerts { display: flex; flex: none; flex-direction: column; gap: 8px; padding: 12px 20px 0; }
.kp-alert { display: flex; align-items: flex-start; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 12.5px; line-height: 18px; }
.kp-alert.is-fail { background: ${tint('fail')}; color: ${ink('--st-fail-text')}; }
.kp-alert.is-wait { background: ${tint('wait')}; color: ${ink('--st-wait')}; }
.kp-alert-i { flex: none; margin-top: 2px; }
.kp-alert-b { display: flex; flex: 1; flex-direction: column; gap: 6px; min-width: 0; }
.kp-alert-t { overflow-wrap: anywhere; white-space: pre-wrap; }
.kp-alert-s { color: var(--ib-text-2); }
.kp-alert-acts { display: flex; flex-wrap: wrap; gap: 6px; }

/* ── read-only view ── */
.kp-read { display: flex; flex-direction: column; gap: 14px; }
.kp-read-title { font-size: 18px; font-weight: 650; line-height: 1.3; letter-spacing: -0.015em; overflow-wrap: anywhere; }
.kp-aliases { display: flex; flex-wrap: wrap; gap: 6px; margin-top: -6px; }
.kp-read-hist { display: flex; flex-direction: column; gap: 8px; }
.kp-read-hist li { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 10px; font-size: 13px; line-height: 19px; }
.kp-read-date { color: var(--ib-muted); font-size: 12.5px; font-variant-numeric: tabular-nums; }
.kp-read-hist p { overflow-wrap: anywhere; white-space: pre-wrap; }

/* ── loading, empty ── */
.kp-skel { display: flex; flex-direction: column; gap: 12px; padding: 18px 20px; }
.kp-sk { display: block; height: 12px; border-radius: 6px; background: var(--ib-pill); opacity: 0.7; }
.kp-sk.is-meta { width: 30%; height: 10px; }
.kp-sk.is-title { width: 55%; height: 22px; }
.kp-sk.is-field { height: 34px; border-radius: 8px; }
.kp-sk.is-line { width: 92%; }
.kp-sk.is-short { width: 60%; }
.kp-sk.is-block { height: 120px; border-radius: 8px; }
@keyframes kp-pulse { 50% { opacity: 0.35; } }
@media (prefers-reduced-motion: no-preference) { .kp-sk { animation: kp-pulse 1.4s ease-in-out infinite; animation-delay: calc(var(--i, 0) * 80ms); } }

.kp-none { display: grid; place-items: center; }
.kp-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; max-width: 360px; padding: 40px 24px; text-align: center; }
.kp-empty-i { color: var(--ib-muted); }
.kp-empty-t { font-size: 14px; font-weight: 600; color: var(--ib-text); }
.kp-empty-s { margin-bottom: 6px; font-size: 13px; line-height: 19px; color: var(--ib-muted); }

/* Press: scale .97 (never with a keyboard ring); hover: colour only, fine pointers only */
:is(.kp-btn, .kp-new, .kp-row, .kp-back, .kp-icon, .kp-link, .kp-seg button):active:not([aria-disabled="true"]):not(:focus-visible) { transform: scale(0.97); }
@media (hover: hover) and (pointer: fine) {
  .kp-btn:hover:not([aria-disabled="true"]) { border-color: var(--ib-muted); }
  .kp-btn.is-quiet:hover:not([aria-disabled="true"]) { border-color: transparent; background: var(--ib-pill); color: var(--ib-text); }
  .kp-btn.is-primary:hover:not([aria-disabled="true"]) { border-color: var(--ib-text); opacity: 0.88; }
  .kp-btn.is-danger:hover:not([aria-disabled="true"]), .kp-del:hover:not([aria-disabled="true"]):not([data-armed]) { border-color: var(--st-fail); background: ${tint('fail')}; }
  .kp-new:hover { border-color: var(--ib-muted); }
  .kp-row:hover:not([aria-current="true"]) { background: color-mix(in srgb, var(--ib-pill) 70%, transparent); }
  .kp-back:hover, .kp-link:hover { background: var(--ib-pill); color: var(--ib-text); }
  .kp-icon:hover:not([aria-disabled="true"]) { background: var(--ib-pill); color: ${ink('--st-fail-text')}; }
  .kp-seg button:hover:not([aria-pressed="true"]) { color: var(--ib-text); }
  .kp-input:hover:not(:focus):not([readonly]), .kp-q:hover:not(:focus) { border-color: var(--ib-muted); }
}

/* layout="page": as tall as its content — the page scrolls, the list column sticks to the top (--kp-sticky-top for a
   fixed app bar), the footer to the bottom; the list scrolls inside once it is taller than the viewport */
:host([layout="page"]) .ui-root, :host([layout="page"]) .kp, :host([layout="page"]) .kp-grid { height: auto; min-height: 0; }
:host([layout="page"]) .kp { overflow: visible; }
:host([layout="page"]) .kp-grid { align-items: start; }
:host([layout="page"]) .kp-list { position: sticky; top: var(--kp-sticky-top, 0px); max-height: calc(100dvh - var(--kp-sticky-top, 0px));
  border-radius: 11px 0 0 11px; }
:host([layout="page"]) .kp-detail { min-height: 360px; }
:host([layout="page"]) :is(.kp-edit, .kp-read) { overflow: visible; }
:host([layout="page"]) .kp-foot { border-radius: 0 0 11px; }

/* Narrow: one column at a time, with a way back */
@container kp (max-width: 639px) {
  .kp-grid { grid-template-columns: minmax(0, 1fr); }
  .kp[data-view="list"] .kp-detail, .kp[data-view="detail"] .kp-list { display: none; }
  .kp-list { border-right: 0; }
  :host([layout="page"]) .kp-list { border-radius: 11px 11px 0 0; }
  :host([layout="page"]) .kp-foot { border-radius: 0 0 11px 11px; }
  .kp-back { display: inline-flex; }
  .kp-edit, .kp-read { padding: 10px 14px 16px; }
  .kp-foot { padding: 8px 14px; }
  .kp-guard { margin: 8px 14px 0; }
  .kp-pad, .kp-alerts { padding: 10px 14px 0; }
  .kp-h { grid-template-columns: minmax(0, 1fr) auto; }
  .kp-h-date { grid-column: 1; }
  .kp-h-text { grid-column: 1; }
  .kp-h .kp-icon { grid-column: 2; grid-row: 1; }
  .kp-field-group { max-width: none; }
}
@container kp (max-width: 380px) {
  .kp-sec-head .kp-sub { display: none; }
  .kp-state { flex-basis: 100%; }
}

/* 44px targets on touch and narrow screens; 16px text in fields so iOS does not zoom */
@media (pointer: coarse), (max-width: 639px) {
  .kp-btn, .kp-btn.is-sm, .kp-new, .kp-back, .kp-row, .kp-link, .kp-seg button { min-height: 44px; }
  .kp-icon { width: 44px; height: 44px; }
  .kp-q, .kp-input { min-height: 44px; }
  .kp-q, .kp-input, .kp-gw > textarea, .kp-gw::after, .kp-cur > textarea, .kp-cur::after { font-size: 16px; }
  .kp-h-text::after, .kp-h-text > textarea { min-height: 44px; padding-top: 11px; padding-bottom: 11px; }
}

/* Reduced motion: nothing moves or scales; arrivals fade only */
@media (prefers-reduced-motion: reduce) {
  :is(.kp-btn, .kp-new, .kp-row, .kp-back, .kp-icon, .kp-link, .kp-seg button):active:not([aria-disabled="true"]):not(:focus-visible) { transform: none; }
  .kp-h[data-fresh] { animation: kp-fade 120ms ease both !important; }
}
@keyframes kp-fade { from { opacity: 0; } }
`;
