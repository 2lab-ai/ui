/**
 * `@2lab.ai/ui/ui-kit.css` — light-DOM classes for host pages, drawn in the components' own language: neutral
 * hovers, one ink primary, the raised neutral chip for "on", tone dots in the st-* colours, press scale .97, 44px
 * targets on touch, colour-only hovers gated to fine pointers. Every value comes from the `--ui-*` tokens (load
 * `@2lab.ai/ui/tokens.css`, or map your own names onto them); tints are `color-mix()`es of those tokens, never a
 * hard-coded hex or rgba, so one rule holds in light and dark.
 */

import { effortTextCss } from '../core/effort';
import { ownerBadgeCss } from '../core/owner-badge';

/** Every class the kit defines (base classes; modifiers are `is-*`). */
export const KIT_CLASSES = [
  'ui-btn',
  'ui-icon-btn',
  'ui-fab',
  'ui-chip',
  'ui-select-chip',
  'ui-spinner',
  'ui-status',
  'ui-kbd',
  'ui-dl',
  'ui-skeleton',
  'ui-empty',
  'ui-status-line',
  'ui-avatar',
  'ui-owner-badge',
  'ui-sr-only',
  'ui-expand',
  'ui-chev',
  'ui-section-head',
  'ui-count',
  'ui-input',
  'ui-switch',
  'ui-card',
  'ui-notice',
  'ui-row',
  'ui-effort',
] as const;

const T = (name: string): string => `var(--ui-${name})`;
/**
 * The mono palette's knob (0.25.0): 1 in the colour themes, 0 under data-palette="mono" — a status colour mixed into
 * a fill or a text is scaled by it, so mono keeps a state's colour on its mark (dot, ring, border) alone.
 */
const CHROMA = 'var(--ui-chroma, 1)';
/** `colour` in the colour themes, `mono` under the mono palette (exactly `colour` while --ui-chroma is 1). */
const pick = (colour: string, mono: string): string => `color-mix(in srgb, ${colour} calc(100% * ${CHROMA}), ${mono})`;
/** Text in a status colour, pulled toward ink so it reads ≥ 4.5:1 on the card and on its own tint (both themes); the secondary ink in mono. */
const toneText = (tone: string): string =>
  `color-mix(in srgb, ${tone} calc(70% * ${CHROMA}), ${pick(T('ib-text'), T('ib-text-2'))})`;
/** The status tint behind a pill: 16% of the status colour into the card (the board's tag recipe); the neutral pill in mono. */
const toneTint = (tone: string): string =>
  `color-mix(in srgb, ${tone} calc(16% * ${CHROMA}), ${pick(T('ib-card'), T('ib-pill'))})`;
/** A banner's tint: as toneTint in colour, but the card itself in mono — a banner keeps only its status border. */
const bannerTint = (tone: string): string => `color-mix(in srgb, ${tone} calc(16% * ${CHROMA}), ${T('ib-card')})`;
const COLOR_T = `var(--ui-dur-press) ease`;
const PRESS_T = `transform ${T('dur-press')} ${T('ease-out')}`;
const BTN_T = `background-color ${COLOR_T}, border-color ${COLOR_T}, color ${COLOR_T}, opacity ${COLOR_T}, ${PRESS_T}`;
const TONES: Array<[string, string, string]> = [
  // [data-tone, dot / tint colour, text base]
  ['run', T('st-run'), T('st-run')],
  ['wait', T('st-wait'), T('st-wait')],
  ['done', T('st-done'), T('st-done')],
  ['fail', T('st-fail'), T('st-fail-text')],
];

/**
 * Page parts (0.9.0): form fields, the switch, the card a settings group sits in, the notice banner and the list
 * row (a run, a job, an entry). Kept as one block with its own hover / touch / reduced-motion rules.
 */
const pageKitCss = `
/* ── Input: text / number / search fields, selects and textareas — put .ui-input on each ── */
.ui-input {
  box-sizing: border-box; min-width: 0; max-width: 100%; min-height: 34px; margin: 0; padding: 6px 10px;
  border: 1px solid ${T('ib-card-border')}; border-radius: 8px; background: ${T('surface-raised')}; color: ${T('ib-text')};
  font: inherit; font-size: 13px; line-height: 1.35; font-variant-numeric: tabular-nums;
  transition: border-color ${COLOR_T}, background-color ${COLOR_T}, opacity ${COLOR_T};
}
.ui-input::placeholder { color: ${T('text-tertiary')}; opacity: 1; }
textarea.ui-input { display: block; width: 100%; min-height: 72px; padding: 8px 10px; line-height: 1.45; resize: vertical; }
select.ui-input {
  appearance: none; -webkit-appearance: none; padding-right: 30px; cursor: pointer;
  background-image: linear-gradient(45deg, transparent 50%, ${T('ib-muted')} 50%), linear-gradient(135deg, ${T('ib-muted')} 50%, transparent 50%);
  background-position: calc(100% - 16px) 52%, calc(100% - 12px) 52%; background-size: 4px 4px; background-repeat: no-repeat;
}
.ui-input.is-sm { min-height: 28px; padding: 3px 8px; border-radius: 7px; font-size: 12.5px; }
select.ui-input.is-sm { padding-right: 26px; }
.ui-input.is-block { display: block; width: 100%; }
.ui-input:focus-visible { outline: 2px solid ${T('border-focus')}; outline-offset: 2px; }
.ui-input[aria-invalid="true"] { border-color: ${T('st-fail')}; }
.ui-input:disabled { opacity: 0.55; cursor: not-allowed; }
.ui-input[readonly] { background: transparent; }

/* ── Switch: <label class="ui-switch"><input type="checkbox" role="switch"><span>On</span></label> — on is ink ── */
.ui-switch {
  display: inline-flex; align-items: center; gap: 8px; min-height: 28px; font-size: 13px; line-height: 1.3;
  color: ${T('ib-text-2')}; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent;
}
.ui-switch > input {
  appearance: none; -webkit-appearance: none; position: relative; flex: none; width: 32px; height: 18px; margin: 0;
  border: 0; border-radius: 999px; background: color-mix(in srgb, ${T('ib-muted')} 30%, ${T('ib-pill')});
  box-shadow: inset 0 0 0 1px ${T('ib-card-border')};
  cursor: pointer; transition: background-color ${COLOR_T}, box-shadow ${COLOR_T};
}
.ui-switch > input::before {
  content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%;
  background: ${T('ib-card')}; box-shadow: ${T('ib-shadow')}, 0 0 0 0.5px ${T('ib-card-border')};
  transition: transform ${T('dur-press')} ${T('ease-out')};
}
.ui-switch > input:checked { background: ${T('ib-text')}; box-shadow: inset 0 0 0 1px ${T('ib-text')}; }
.ui-switch > input:checked::before { transform: translateX(14px); }
.ui-switch > input:checked + span { color: ${T('ib-text')}; }
.ui-switch > input:focus-visible { outline: 2px solid ${T('border-focus')}; outline-offset: 2px; }
.ui-switch:has(> input:disabled) { opacity: 0.5; cursor: not-allowed; }
.ui-switch > input:disabled { cursor: not-allowed; }

/* ── Card: a 12px surface with the whisper shadow; <header> takes an h2/h3 and a quiet <p>; .is-body pads content ── */
.ui-card {
  box-sizing: border-box; min-width: 0; margin: 0; border: 1px solid ${T('ib-card-border')}; border-radius: 12px;
  background: ${T('ib-card')}; box-shadow: ${T('ib-shadow')}; color: ${T('ib-text')};
}
.ui-card > header { padding: 14px 16px 12px; border-bottom: 1px solid ${T('ib-card-border')}; }
.ui-card > header > :is(h1, h2, h3, h4) { margin: 0; font-size: 15px; font-weight: 650; line-height: 1.3; letter-spacing: -0.01em; color: ${T('ib-text')}; }
.ui-card > header > p { margin: 3px 0 0; font-size: 12.5px; line-height: 1.45; color: ${T('ib-muted')}; }
.ui-card > .is-body { padding: 14px 16px; }
.ui-card.is-danger { border-color: color-mix(in srgb, ${T('st-fail')} 35%, ${T('ib-card-border')}); }
.ui-card.is-danger > header { border-bottom-color: color-mix(in srgb, ${T('st-fail')} 25%, ${T('ib-card-border')}); }
.ui-card.is-danger > header > :is(h1, h2, h3, h4) { color: ${toneText(T('st-fail-text'))}; }

/* ── Notice: a banner above a page or a form — neutral, or a tone; a leading <svg> takes the tone ── */
.ui-notice {
  --ui-tone: ${T('ib-muted')};
  display: flex; align-items: flex-start; gap: 8px; box-sizing: border-box; min-width: 0; margin: 0; padding: 10px 12px;
  border: 1px solid ${T('ib-card-border')}; border-radius: 10px; background: ${T('ib-card')}; color: ${T('ib-text-2')};
  font-size: 13px; line-height: 1.45; overflow-wrap: anywhere;
}
.ui-notice > svg { flex: none; width: 14px; height: 14px; margin-top: 2px; color: var(--ui-tone); }
.ui-notice strong { font-weight: 600; color: ${T('ib-text')}; }
.ui-notice a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
${TONES.map(
  ([k, dot, text]) =>
    `.ui-notice[data-tone="${k}"] { --ui-tone: ${dot}; border-color: color-mix(in srgb, ${dot} 35%, ${T('ib-card-border')}); background: ${bannerTint(dot)}; color: ${toneText(text)}; }\n.ui-notice[data-tone="${k}"] strong { color: inherit; }`,
).join('\n')}

/* ── Row: a list row — leading glyph in the tone, a <div> with <strong> title and <small> meta, trailing .is-end ── */
.ui-row {
  --ui-tone: ${T('ib-muted')};
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start; gap: 2px 10px; box-sizing: border-box;
  min-width: 0; margin: 0; padding: 10px 12px; list-style: none; font-size: 13px; line-height: 1.4; color: ${T('ib-text')};
  text-decoration: none;
}
.ui-row + .ui-row { border-top: 1px solid ${T('ib-card-border')}; }
.ui-row > svg, .ui-row > .ui-avatar { grid-column: 1; margin-top: 1px; }
.ui-row > svg { width: 16px; height: 16px; color: var(--ui-tone); }
.ui-row > div { grid-column: 2; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ui-row > div:first-child { grid-column: 1 / 3; }
.ui-row strong { min-width: 0; font-weight: 600; overflow-wrap: anywhere; }
.ui-row small { font-size: 12px; color: ${T('ib-muted')}; font-variant-numeric: tabular-nums; }
.ui-row .ui-status-line { font-size: 12px; }
.ui-row > .is-end { grid-column: 3; display: inline-flex; align-items: center; gap: 4px; align-self: center; }
${TONES.map(([k, dot]) => `.ui-row[data-tone="${k}"] { --ui-tone: ${dot}; }`).join('\n')}
:is(a, button).ui-row { width: 100%; border: 0; border-radius: 8px; background: transparent; font: inherit; text-align: left; cursor: pointer; transition: background-color ${COLOR_T}, ${PRESS_T}; }
:is(a, button).ui-row:focus-visible { outline: 2px solid ${T('border-focus')}; outline-offset: -2px; }
:is(a, button).ui-row:active:not(:focus-visible) { transform: scale(0.99); }
/* The row that is the page (aria-current="page" / "true"): the hover fill, kept. */
.ui-row[aria-current]:not([aria-current="false"]) { background: ${T('ib-pill')}; }

@media (hover: hover) and (pointer: fine) {
  .ui-input:hover:not(:disabled):not(:focus) { border-color: ${T('ib-muted')}; }
  .ui-switch:hover > input:not(:disabled):not(:checked) { box-shadow: inset 0 0 0 1px ${T('ib-muted')}; }
  :is(a, button).ui-row:hover { background: ${T('ib-pill')}; }
}
@media (pointer: coarse), (max-width: 639px) {
  .ui-input, .ui-input.is-sm { min-height: 44px; }
  .ui-switch { min-height: 44px; }
}
@media (pointer: coarse) {
  .ui-input, .ui-input.is-sm { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .ui-input, .ui-switch > input { transition-duration: 0.01ms; }
  .ui-switch > input::before, :is(a, button).ui-row { transition: none; }
}
`;

export const kitCss = `/* @2lab.ai/ui kit — light-DOM classes. Reads the --ui-* tokens (@2lab.ai/ui/tokens.css). */

/* ── Button: default · ink primary · quiet · danger; sizes sm / lg ── */
.ui-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box;
  min-height: 32px; padding: 5px 12px; border: 1px solid ${T('ib-card-border')}; border-radius: 8px;
  background: ${T('ib-card')}; color: ${T('ib-text')}; font: inherit; font-size: 13px; font-weight: 500; line-height: 1.2;
  white-space: nowrap; text-decoration: none; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent;
  transition: ${BTN_T};
}
.ui-btn > svg { flex: none; width: 14px; height: 14px; }
.ui-btn.is-primary { background: ${T('ib-text')}; border-color: ${T('ib-text')}; color: ${T('ib-card')}; }
.ui-btn.is-quiet { background: transparent; border-color: transparent; color: ${T('ib-text-2')}; }
.ui-btn.is-danger { color: ${T('st-fail-text')}; border-color: color-mix(in srgb, ${T('st-fail')} 40%, ${T('ib-card-border')}); }
.ui-btn.is-danger.is-primary { background: ${pick(T('st-fail'), T('ib-text'))}; border-color: ${pick(T('st-fail'), T('ib-text'))}; color: ${T('ib-card')}; }
.ui-btn.is-sm { min-height: 28px; padding: 3px 10px; border-radius: 7px; font-size: 12.5px; }
.ui-btn.is-lg { min-height: 40px; padding: 8px 16px; border-radius: 10px; font-size: 14px; }
.ui-btn.is-block { display: flex; width: 100%; }
.ui-btn:disabled, .ui-btn[aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; }
.ui-btn[aria-busy="true"] { cursor: progress; }

/* ── Icon button (close, tools) — quiet by default, bordered for app-bar controls ── */
.ui-icon-btn {
  display: inline-grid; flex: none; place-items: center; box-sizing: border-box; width: 32px; height: 32px; padding: 0;
  border: 1px solid transparent; border-radius: 8px; background: transparent; color: ${T('ib-text-2')};
  font: inherit; text-decoration: none; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: ${BTN_T};
}
.ui-icon-btn > svg { width: 16px; height: 16px; }
.ui-icon-btn.is-bordered { width: 34px; height: 34px; border-color: ${T('ib-card-border')}; border-radius: 10px; background: ${T('ib-card')}; }
.ui-icon-btn.is-sm { width: 28px; height: 28px; border-radius: 7px; }
.ui-icon-btn.is-sm > svg { width: 14px; height: 14px; }
.ui-icon-btn[aria-pressed="true"], .ui-icon-btn[aria-expanded="true"] { background: ${T('ib-pill')}; color: ${T('ib-text')}; }
.ui-icon-btn:disabled, .ui-icon-btn[aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; }

/* ── Floating action button — ink, 56px, enters from opacity 0 + scale(.95) ── */
.ui-fab {
  position: fixed; z-index: 40; right: max(20px, env(safe-area-inset-right)); bottom: max(20px, env(safe-area-inset-bottom));
  display: inline-grid; place-items: center; box-sizing: border-box; width: 56px; height: 56px; padding: 0; border: 0;
  border-radius: 50%; background: ${T('ib-text')}; color: ${T('ib-card')}; box-shadow: ${T('ib-shadow-raised')};
  font: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent;
  animation: ui-fab-in ${T('dur-expand')} ${T('ease-out')} both; transition: opacity ${COLOR_T}, ${PRESS_T};
}
.ui-fab > svg { width: 22px; height: 22px; }
.ui-fab.is-inline { position: static; }
/* Extended: the glyph with a word beside it (<button class="ui-fab is-extended"><svg/><span>New task</span></button>), a
   56px pill in the thumb zone. .is-folded folds the word away on --dur-expand and it is the round button again — toggle it
   from a passive scroll listener while the page scrolls down; the name stays (aria-label, or the folded word). */
.ui-fab.is-extended {
  display: inline-flex; align-items: center; gap: 8px; width: auto; min-width: 56px; padding: 0 20px 0 17px; border-radius: 999px;
  font-size: 15px; font-weight: 600; line-height: 1; white-space: nowrap;
  transition: padding ${T('dur-expand')} ${T('ease-out')}, gap ${T('dur-expand')} ${T('ease-out')}, opacity ${COLOR_T}, ${PRESS_T};
}
.ui-fab.is-extended > svg { flex: none; }
.ui-fab.is-extended > span { display: inline-block; max-width: 10em; overflow: hidden; opacity: 1; transition: max-width ${T('dur-expand')} ${T('ease-out')}, opacity ${T('dur-fade')} ${T('ease-out')}; }
.ui-fab.is-extended.is-folded { gap: 0; padding: 0 17px; }
.ui-fab.is-extended.is-folded > span { max-width: 0; opacity: 0; }

/* ── Chip — a pill label or a toggle; "on" is the raised neutral chip with an ink border (≥ 3:1 against its fill in
   both themes — the fills alone differ by one step in dark) ── */
.ui-chip {
  display: inline-flex; align-items: center; gap: 5px; box-sizing: border-box; max-width: 100%; min-width: 0; height: 24px;
  padding: 0 9px; border: 1px solid ${T('ib-card-border')}; border-radius: 999px; background: ${T('ib-pill')};
  color: ${T('ib-text')}; font: inherit; font-size: 12px; font-weight: 500; line-height: 1; white-space: nowrap;
  text-decoration: none; font-variant-numeric: tabular-nums;
}
.ui-chip > svg { flex: none; width: 12px; height: 12px; color: ${T('ib-muted')}; }
button.ui-chip, a.ui-chip { cursor: pointer; -webkit-tap-highlight-color: transparent; transition: ${BTN_T}, box-shadow ${COLOR_T}; }
.ui-chip[aria-pressed="true"], .ui-chip[aria-selected="true"], .ui-chip[aria-checked="true"], .ui-chip.is-on {
  background: ${T('ib-seg-on')}; border-color: color-mix(in srgb, ${T('ib-text')} 40%, ${T('ib-card-border')}); box-shadow: ${T('ib-shadow')};
}
/* A pressed star is filled — the one glyph whose pressed state is its shape (a toggle's ★ / ☆), so a host never needs
   the text glyphs beside the set's icons. */
:is(.ui-btn, .ui-chip)[aria-pressed="true"] > svg[data-icon="star"] { fill: currentColor; }
.ui-chip.is-quiet { background: transparent; }
/* A toned chip: a tag in a colour the host picks per thing (an environment, a team) — not a status. Set --ui-tone
   inline (a palette token); the fill is its 14% tint, the word 70% toward the ink (≥ 4.5:1 in both themes). */
.ui-chip.is-toned {
  border-color: color-mix(in srgb, var(--ui-tone, ${T('ib-muted')}) 28%, ${T('ib-card-border')});
  background: color-mix(in srgb, var(--ui-tone, ${T('ib-muted')}) 14%, ${T('ib-card')});
  color: color-mix(in srgb, var(--ui-tone, ${T('ib-muted')}) 70%, ${T('ib-text')});
}
.ui-chip.is-sm { gap: 4px; height: 20px; padding: 0 7px; font-size: 11px; }
.ui-chip:disabled, .ui-chip[aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; }

/* ── Select chip: a native <select> read as a label (the model picker's trigger shape) — as wide as its selected
   option (field-sizing: content; older engines take the widest option, capped by --ui-select-max), an ellipsis past
   the cap, the chevron from tokens. On the <select> itself, or on a <label> with a leading word: <label class=
   "ui-select-chip"><span>Model</span><select>…</select></label>. Mark it data-ui-sound="select" for the cue. ── */
.ui-select-chip {
  display: inline-flex; align-items: center; gap: 6px; box-sizing: border-box; max-width: 100%; min-width: 0; min-height: 30px;
  margin: 0; padding: 0 9px 0 10px; border: 1px solid ${T('ib-card-border')}; border-radius: 8px; background-color: ${T('ib-seg')};
  color: ${T('ib-text')}; font: inherit; font-size: 13px; font-weight: 500; line-height: 1.2; white-space: nowrap; cursor: pointer;
  -webkit-tap-highlight-color: transparent; transition: background-color ${COLOR_T}, border-color ${COLOR_T}, opacity ${COLOR_T};
}
.ui-select-chip > span { flex: none; font-size: 11.5px; font-weight: 600; color: ${T('ib-muted')}; }
select.ui-select-chip, .ui-select-chip > select {
  appearance: none; -webkit-appearance: none; min-width: 0; max-width: var(--ui-select-max, 220px); field-sizing: content;
  overflow: hidden; text-overflow: ellipsis; color: inherit; font: inherit; font-weight: 500; cursor: pointer;
  background-image: linear-gradient(45deg, transparent 50%, ${T('ib-muted')} 50%), linear-gradient(135deg, ${T('ib-muted')} 50%, transparent 50%);
  background-size: 4px 4px; background-repeat: no-repeat;
}
select.ui-select-chip { display: inline-block; padding-right: 26px; background-position: calc(100% - 14px) 52%, calc(100% - 10px) 52%; }
.ui-select-chip > select {
  flex: 0 1 auto; min-height: 0; height: 100%; margin: 0; padding: 0 18px 0 0; border: 0; border-radius: 0; background-color: transparent;
  background-position: calc(100% - 6px) 52%, calc(100% - 2px) 52%;
}
/* The ring moves to the chip only where :has can draw it there; elsewhere the select keeps its own. */
@supports selector(:has(a)) { .ui-select-chip > select:focus-visible { outline: none; } }
.ui-select-chip:has(> select:focus-visible), select.ui-select-chip:focus-visible { outline: 2px solid ${T('border-focus')}; outline-offset: 2px; }
select.ui-select-chip:disabled, .ui-select-chip:has(> select:disabled) { opacity: 0.5; cursor: not-allowed; }
.ui-select-chip > select:disabled { cursor: not-allowed; }
/* The list itself (the dropdown) on the page's surface, so it reads in the dark theme too. */
:is(select.ui-select-chip, .ui-select-chip > select) > option { background: ${T('surface')}; color: ${T('text')}; }

/* ── Spinner: the working ring — 0.9s linear, the arc in the run tone over a quiet track (data-tone recolours it,
   .is-current takes the text colour, .is-sm / .is-lg). Decorative (aria-hidden) beside the word that says what runs;
   in a .ui-status it replaces the dot. Rings on one page share a phase when the page sets
   style="animation-delay: -<now % 900>ms" as it inserts one. ── */
.ui-spinner {
  --ui-tone: ${T('st-run')};
  position: relative; display: inline-block; flex: none; box-sizing: border-box; width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--ui-tone) 25%, transparent); border-top-color: var(--ui-tone); border-right-color: var(--ui-tone);
  vertical-align: -2px; animation: ui-spin 0.9s linear infinite;
}
.ui-spinner.is-sm { width: 11px; height: 11px; border-width: 1.8px; vertical-align: -1px; }
.ui-spinner.is-lg { width: 20px; height: 20px; border-width: 2.5px; vertical-align: -4px; }
.ui-spinner.is-current { --ui-tone: currentColor; }
${TONES.map(([k, dot]) => `.ui-spinner[data-tone="${k}"] { --ui-tone: ${dot}; }`).join('\n')}
.ui-status > .ui-spinner { --ui-tone: inherit; }
.ui-status:has(> .ui-spinner)::before { content: none; }

/* ── Status: tone dot + word (st-* tones, idle = hollow); a leading <svg> replaces the dot; .is-pill adds the tint; [data-live] pulses ── */
.ui-status {
  --ui-tone: ${T('ib-muted')};
  display: inline-flex; align-items: center; gap: 6px; min-width: 0; font-size: 12.5px; font-weight: 500; line-height: 1.3;
  white-space: nowrap; color: ${T('ib-text-2')}; font-variant-numeric: tabular-nums;
  transition: color 300ms ease, background-color 300ms ease;
}
.ui-status::before {
  content: ''; flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--ui-tone);
  transition: background-color 300ms ease, box-shadow 300ms ease;
}
${TONES.map(([k, dot, text]) => `.ui-status[data-tone="${k}"] { --ui-tone: ${dot}; color: ${toneText(text)}; }`).join('\n')}
.ui-status.is-hollow::before { background: transparent; box-shadow: inset 0 0 0 1.5px var(--ui-tone); }
.ui-status.is-pill { height: 24px; padding: 0 10px 0 8px; border-radius: 999px; background: ${T('ib-pill')}; }
${TONES.map(([k, dot]) => `.ui-status.is-pill[data-tone="${k}"] { background: ${toneTint(dot)}; }`).join('\n')}
.ui-status[data-live]::before { animation: ui-pulse 1.6s ease-in-out infinite; }
/* idle: stopped / sleeping / unknown — the muted hollow dot, the word in text-2 */
.ui-status[data-tone="idle"]::before { background: transparent; box-shadow: inset 0 0 0 1.5px var(--ui-tone); }
/* A leading <svg> in place of the dot (icon('moon') before "Sleeping"), drawn in the tone colour */
.ui-status > svg { flex: none; width: 12px; height: 12px; color: var(--ui-tone); transition: color 300ms ease; }
.ui-status:has(> svg)::before { content: none; }
.ui-status[data-live] > svg { animation: ui-pulse 1.6s ease-in-out infinite; }

/* ── Keyboard key ── */
.ui-kbd {
  display: inline-grid; place-items: center; box-sizing: border-box; min-width: 18px; height: 18px; padding: 0 4px;
  border-radius: 5px; background: ${T('ib-card')}; box-shadow: 0 0 0 1px ${T('ib-card-border')}; font-family: inherit;
  font-size: 10.5px; font-weight: 500; line-height: 1; color: ${T('ib-muted')}; vertical-align: middle; white-space: nowrap;
}

/* ── Definition list: label / value pairs (wrap pairs in <div> if you like) ── */
.ui-dl { display: grid; grid-template-columns: minmax(0, max-content) minmax(0, 1fr); gap: 6px 14px; margin: 0; font-size: 13px; line-height: 1.45; }
.ui-dl > div { display: contents; }
.ui-dl dt { min-width: 0; color: ${T('ib-muted')}; }
.ui-dl dd { min-width: 0; margin: 0; color: ${T('ib-text')}; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.ui-dl.is-stacked { grid-template-columns: minmax(0, 1fr); gap: 2px; }
.ui-dl.is-stacked dd + dt { margin-top: 8px; }

/* ── Skeleton: an opacity pulse where content will be; stagger with style="--i: 1" ── */
.ui-skeleton {
  display: block; height: 12px; border-radius: 6px; background: ${T('ib-pill')};
  animation: ui-sk-pulse 1.6s ease-in-out infinite; animation-delay: calc(var(--i, 0) * 120ms);
}
.ui-skeleton.is-title { width: 68%; height: 14px; }
.ui-skeleton.is-line { height: 10px; }
.ui-skeleton.is-pill { width: 34%; height: 20px; border-radius: 999px; }
.ui-skeleton.is-circle { width: 24px; height: 24px; border-radius: 50%; }
.ui-skeleton.is-block { height: 64px; border-radius: 12px; }

/* ── Empty state ── */
.ui-empty {
  display: flex; flex-direction: column; align-items: center; gap: 6px; margin: 0; padding: 18px 12px 20px;
  text-align: center; font-size: 13px; line-height: 1.45; color: ${T('ib-muted')};
}
.ui-empty > svg { width: 20px; height: 20px; }
.ui-empty strong { font-size: 13.5px; font-weight: 600; color: ${T('ib-text-2')}; }

/* ── Status line: the quiet "Saved" / error line under a control (role="status") ── */
.ui-status-line { margin: 0; min-height: 18px; font-size: 12.5px; line-height: 18px; color: ${T('ib-text-2')}; overflow-wrap: anywhere; transition: color 300ms ease; }
.ui-status-line:empty { display: none; }
.ui-status-line > svg { width: 12px; height: 12px; margin-right: 4px; vertical-align: -1px; }
${TONES.map(([k, , text]) => `.ui-status-line[data-tone="${k}"] { color: ${toneText(text)}; }`).join('\n')}
${TONES.map(([k, dot]) => `.ui-status-line[data-tone="${k}"] > svg { color: ${pick('currentColor', dot)}; }`).join('\n')}

/* ── Avatar: a glyph tile with a hairline (letter, svg or img) ── */
.ui-avatar {
  display: inline-grid; flex: none; place-items: center; box-sizing: border-box; width: 24px; height: 24px; overflow: hidden;
  border-radius: 6px; background: ${T('ib-card')}; box-shadow: inset 0 0 0 1px ${T('ib-card-border')}; color: ${T('ib-text')};
  font-size: 10.5px; font-weight: 600; line-height: 1; user-select: none;
}
.ui-avatar > svg { width: 14px; height: 14px; }
.ui-avatar > img { width: 100%; height: 100%; object-fit: cover; }
.ui-avatar.is-sm { width: 18px; height: 18px; border-radius: 5px; font-size: 9.5px; }
.ui-avatar.is-sm > svg { width: 12px; height: 12px; }
.ui-avatar.is-lg { width: 32px; height: 32px; border-radius: 8px; font-size: 12px; }
.ui-avatar.is-lg > svg { width: 16px; height: 16px; }
.ui-avatar.is-round { border-radius: 50%; }

/* ── Visually hidden ── */
.ui-sr-only { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

/* ── Expand: grid rows 0fr → 1fr with opacity; closed content takes no focus (add inert too) ── */
.ui-expand { display: grid; grid-template-rows: 0fr; transition: grid-template-rows ${T('dur-expand')} ${T('ease-out')}; }
.ui-expand > * { min-height: 0; overflow: hidden; opacity: 0; visibility: hidden; transition: opacity ${T('dur-expand')} ${T('ease-out')}, visibility 0s linear ${T('dur-expand')}; }
.ui-expand.is-open, .ui-expand[data-open] { grid-template-rows: 1fr; }
.ui-expand.is-open > *, .ui-expand[data-open] > * { opacity: 1; visibility: visible; transition: opacity ${T('dur-expand')} ${T('ease-out')}, visibility 0s; }
/* A chevron (chevron-right) that turns down while its control is expanded. */
.ui-chev { flex: none; transition: transform ${T('dur-press')} ${T('ease-out')}; }
[aria-expanded="true"] > .ui-chev, [aria-expanded="true"] .ui-chev { transform: rotate(90deg); }

/* ── Section head: a 13px / 650 heading row, sentence case; trailing actions in .is-end, quiet meta in <small> ── */
.ui-section-head {
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; box-sizing: border-box; min-width: 0; min-height: 28px;
  margin: 0; font-size: 13px; font-weight: 650; line-height: 1.35; letter-spacing: -0.006em; text-transform: none; color: ${T('ib-text')};
}
.ui-section-head > :is(h1, h2, h3, h4, h5, h6, p) { min-width: 0; margin: 0; font: inherit; letter-spacing: inherit; color: inherit; overflow-wrap: anywhere; }
.ui-section-head > small { font-size: 12px; font-weight: 500; letter-spacing: 0; color: ${T('ib-muted')}; font-variant-numeric: tabular-nums; }
.ui-section-head > .is-end { display: inline-flex; flex: none; align-items: center; gap: 4px; margin-left: auto; font-weight: 500; letter-spacing: 0; }

/* ── Count badge: a small pill number (tabular); data-tone tints it; [data-pop] plays the arrival pop once ── */
.ui-count {
  display: inline-grid; flex: none; place-items: center; box-sizing: border-box; min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: 999px; background: ${T('ib-pill')}; color: ${T('ib-text-2')}; font-size: 11px; font-weight: 700; line-height: 1;
  letter-spacing: 0; white-space: nowrap; font-variant-numeric: tabular-nums;
  transition: background-color 300ms ease, color 300ms ease;
}
${TONES.map(([k, dot, text]) => `.ui-count[data-tone="${k}"] { background: ${toneTint(dot)}; color: ${toneText(text)}; }`).join('\n')}
.ui-count[data-pop] { animation: ui-count-pop ${T('dur-move')} ${T('ease-out')} both; }

/* ── Korean: prose breaks between words, never inside them (the page's or the element's lang="ko") ── */
:is(.ui-notice, .ui-card, .ui-row, .ui-dl, .ui-empty, .ui-status-line, .ui-section-head, .ui-input, .ui-btn, .ui-chip, .ui-select-chip, .ui-status):lang(ko) { word-break: keep-all; }

/* ── Focus, press ── */
:is(.ui-btn, .ui-icon-btn, .ui-fab, .ui-chip):focus-visible { outline: 2px solid ${T('border-focus')}; outline-offset: 2px; }
.ui-section-head:focus-visible { outline: 2px solid ${T('border-focus')}; outline-offset: 2px; border-radius: 6px; }
:is(.ui-btn, .ui-icon-btn, button.ui-chip, a.ui-chip):active:not(:disabled):not([aria-disabled="true"]):not(:focus-visible) { transform: scale(0.97); }
.ui-fab:active:not(:disabled):not(:focus-visible) { transform: scale(0.95); }

/* ── Hover: colour and border only, fine pointers only ── */
@media (hover: hover) and (pointer: fine) {
  .ui-btn:hover:not(:disabled):not([aria-disabled="true"]) { border-color: ${T('ib-muted')}; }
  .ui-btn.is-primary:hover:not(:disabled):not([aria-disabled="true"]) { border-color: ${T('ib-text')}; opacity: 0.88; }
  .ui-btn.is-quiet:hover:not(:disabled):not([aria-disabled="true"]) { border-color: transparent; background: ${T('ib-pill')}; color: ${T('ib-text')}; }
  .ui-btn.is-danger:hover:not(:disabled):not([aria-disabled="true"]) { border-color: ${T('st-fail')}; background: ${toneTint(T('st-fail'))}; }
  .ui-btn.is-danger.is-primary:hover:not(:disabled):not([aria-disabled="true"]) { background: ${pick(T('st-fail'), T('ib-text'))}; opacity: 0.88; }
  .ui-icon-btn:hover:not(:disabled):not([aria-disabled="true"]) { background: ${T('ib-pill')}; color: ${T('ib-text')}; }
  .ui-icon-btn.is-bordered:hover:not(:disabled):not([aria-disabled="true"]) { border-color: ${T('ib-muted')}; }
  .ui-fab:hover { opacity: 0.9; }
  :is(button.ui-chip, a.ui-chip):hover:not(:disabled):not([aria-disabled="true"]) { border-color: ${T('ib-muted')}; }
  select.ui-select-chip:hover:not(:disabled), .ui-select-chip:hover:has(> select:not(:disabled)) { background-color: color-mix(in srgb, ${T('ib-text')} 6%, ${T('ib-card')}); }
}
/* ── 44px targets on touch and narrow screens ── */
@media (pointer: coarse), (max-width: 639px) {
  .ui-btn, .ui-btn.is-sm { min-height: 44px; padding-inline: 14px; }
  .ui-icon-btn, .ui-icon-btn.is-sm, .ui-icon-btn.is-bordered { width: 44px; height: 44px; }
  :is(button.ui-chip, a.ui-chip) { position: relative; }
  :is(button.ui-chip, a.ui-chip)::after { content: ''; position: absolute; inset: -10px 0; }
  :is(button.ui-chip, a.ui-chip).is-sm::after { inset: -12px 0; }
  .ui-select-chip { min-height: 44px; }
}
@media (pointer: coarse) {
  select.ui-select-chip, .ui-select-chip > select { font-size: 16px; }
}
/* ── Reduced motion: nothing moves; overlays of meaning (opacity) stay short ── */
@media (prefers-reduced-motion: reduce) {
  .ui-btn, .ui-icon-btn, .ui-chip, .ui-select-chip, .ui-fab { transition-duration: 0.01ms; }
  .ui-fab { animation: ui-fade-in 120ms ease both; }
  .ui-fab.is-extended, .ui-fab.is-extended > span { transition: none; }
  /* The ring stands still as a track with a dot in the middle: still "working", nothing turns. */
  .ui-spinner { animation: none; border-color: color-mix(in srgb, var(--ui-tone) 25%, transparent); }
  .ui-spinner::after { content: ''; position: absolute; inset: 0; width: 4px; height: 4px; margin: auto; border-radius: 50%; background: var(--ui-tone); }
  .ui-skeleton, .ui-status[data-live]::before { animation: none; }
  .ui-status[data-live] > svg { animation: none; }
  .ui-expand { transition: none; }
  .ui-expand > *, .ui-expand.is-open > *, .ui-expand[data-open] > * { transition-duration: 120ms, 0s; }
  .ui-chev { transition: none; }
  .ui-count[data-pop] { animation: ui-fade-in 120ms ease both; }
}
@keyframes ui-fab-in { from { opacity: 0; transform: scale(0.95); } }
@keyframes ui-spin { to { transform: rotate(360deg); } }
@keyframes ui-fade-in { from { opacity: 0; } }
@keyframes ui-count-pop { from { opacity: 0; transform: scale(0.9); } }
@keyframes ui-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@keyframes ui-sk-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
/* ── Effort word: <span class="ui-effort" data-effort="max">Max</span> — xhigh a red gradient, max a gold foil, ultra a
   holographic foil (the same words and effects as <ui-model-picker>, core/effort.ts); other levels stay plain ── */
.ui-effort { font-weight: 500; }
${effortTextCss((level) => `.ui-effort[data-effort="${level}"]`, T, 'ui-effort')}
/* ── Owner badge (0.27.0): <ui-agent-inbox>'s name pill on a host page — data-hue 0–7 picks one of the eight tints;
   .is-self is the viewer's own (a ring with an orbiting arc; the ring alone under reduced motion). Same look as the
   board (core/owner-badge.ts); say "(you)" in its text or label yourself — the kit draws, it does not word. To orbit in
   step with the board's pills (and carry on when you draw it again), set --ui-owner-badge-phase: ownerBadgePhase()
   inline as you draw it ── */
.ui-owner-badge { display: inline-block; max-inline-size: 168px; vertical-align: middle; }
${ownerBadgeCss('.ui-owner-badge', T, 'ui-owner-badge')}

${pageKitCss}`;
