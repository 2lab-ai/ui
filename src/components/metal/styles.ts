/**
 * The metal elements' shadow styles — metal-fx 2.0.11's page stylesheet (`src/styles.ts`, MIT, © Jakub Antalik),
 * moved into the shadow root. `.ui-root` is the React library's `.metal-fx-root`; the rims and glow keep the library's
 * tuned per-theme values. The fill under the ring is the theme's `--surface` (the library's #272727 / #ffffff), or
 * `--metal-fill` when the host sets it.
 */
import { DARK, LIGHT } from '../../core/tokens';

/** Metallic gradients for the CSS fallback (no WebGL2, a lost context) — the effect's palette, per preset. */
export const METAL_FALLBACK_GRADIENTS = {
  chromatic:
    'linear-gradient(135deg, #f4f8ff 0%, #9cb6e4 18%, #ffffff 36%, #c7a6d9 50%, #7d90b2 64%, #d9f0ff 82%, #8d9ebd 100%)',
  silver: 'linear-gradient(135deg, #f5f6f8 0%, #9ea4ac 20%, #ffffff 42%, #6f757d 60%, #e9ebee 80%, #8e949c 100%)',
  gold: 'linear-gradient(135deg, #fff4d2 0%, #c9a24a 20%, #fff8e3 42%, #9c7a2c 60%, #f3dc9a 80%, #b58b35 100%)',
} as const;

/** Shared by `<ui-metal>`, `<ui-metal-text>` and `<ui-metal-badge>`. */
export const metalBaseCss = `
:host { display: inline-flex; vertical-align: middle; position: relative; line-height: normal; }
:host([hidden]) { display: none; }
.ui-root { position: relative; display: inline-flex; align-items: center; justify-content: center; isolation: isolate;
  overflow: visible; border-radius: var(--mfx-radius, 0px); background: var(--metal-fill, var(--surface)); color: var(--text);
  --mfx-gradient: ${METAL_FALLBACK_GRADIENTS.chromatic}; }
.ui-root[data-pin="dark"] { background: var(--metal-fill, ${DARK.surface}); color: ${DARK.text}; }
.ui-root[data-pin="light"] { background: var(--metal-fill, ${LIGHT.surface}); color: ${LIGHT.text}; }
.ui-root[data-preset="silver"] { --mfx-gradient: ${METAL_FALLBACK_GRADIENTS.silver}; }
.ui-root[data-preset="gold"] { --mfx-gradient: ${METAL_FALLBACK_GRADIENTS.gold}; }

/* A faint inner glow (z 2) and the hairline rim (z 4) — tuned per theme by the library. */
.ui-root::before { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: 2;
  box-shadow: inset 0 0 50px 0 rgba(255, 255, 255, 0.02); }
.ui-root[data-theme="light"]::before { box-shadow: inset 0 0 50px 0 rgba(0, 0, 0, 0.02); }
.ui-root::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: 4;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1); }
.ui-root[data-theme="light"]::after { box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06); }
.ui-root[data-variant="circle"]::after { box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.1); }
.ui-root[data-theme="light"][data-variant="circle"]::after { box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.06); }
/* While the ring bends, the rims are drawn into the canvas so they bend along. */
.ui-root[data-mfx-bend]::before, .ui-root[data-mfx-bend]::after { box-shadow: none !important; }

.metal-fx-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; z-index: 0;
  pointer-events: none; border-radius: inherit; }

/* Where the ring meets the interior (3px for the button, 0 for the circle, with its dark hairline). Transparent, so
   the root's fill shows through the punched centre. */
.mfx-inner { position: absolute; inset: 3px; border-radius: calc(var(--mfx-radius, 20px) - 3px); z-index: 1;
  pointer-events: none; }
.ui-root[data-variant="circle"] .mfx-inner { inset: 0; border-radius: var(--mfx-radius, 16px);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45); }
.ui-root[data-theme="light"][data-variant="circle"] .mfx-inner { box-shadow: 0 0 0 1px rgba(0, 0, 0, 0); }

/* The glow (z 3): 0.7 on dark; multiplied, saturated and fainter on light. */
.mfx-glow { position: absolute; inset: 0; pointer-events: none; z-index: 3; border-radius: inherit; }
.metal-fx-glow-svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; z-index: 3;
  pointer-events: none; opacity: 0.7; }
.ui-root[data-theme="light"] .metal-fx-glow-svg { inset: -1px; width: calc(100% + 2px); height: calc(100% + 2px);
  mix-blend-mode: multiply; opacity: 0.2746; filter: saturate(5.355) brightness(0.78); }
.ui-root[data-variant="circle"][data-theme="light"] .metal-fx-glow-svg { filter: saturate(7.5) brightness(0.6); }
/* The inner-shadow rim sits above the metal and the glow, below the content. */
.mfx-rim { position: absolute; inset: 0; pointer-events: none; z-index: 4; }

/* The wrapped element, above every overlay. Normalised: its own chrome must not fight the ring. */
.mfx-content { position: relative; z-index: 5; display: inline-flex; align-items: center; justify-content: center;
  width: 100%; pointer-events: none; }
::slotted(*) { pointer-events: auto; }
.ui-root[data-normalize] ::slotted(*) { background: transparent !important; border: 0 !important;
  outline: 0 !important; box-shadow: none !important; }
/* The normalisation drops the child's outline; keyboard focus keeps a ring (the React library had none). */
.ui-root[data-normalize] ::slotted(:focus-visible) { outline: 2px solid var(--border-focus) !important;
  outline-offset: 3px !important; }

/* The first frame fades the metal in; until then the fill and the child show. */
.metal-fx-canvas, .mfx-glow, .mfx-rim { transition: opacity 0.15s ease-out; }
.ui-root:not([data-ready]) :is(.metal-fx-canvas, .mfx-glow, .mfx-rim) { opacity: 0; }

/* Fallback (no WebGL2, or a lost context): the child as it is, with a metallic gradient ring over its edge. */
.mfx-fallback { display: none; }
.ui-root[data-fallback] { background: transparent; }
.ui-root[data-fallback]::before, .ui-root[data-fallback]::after { display: none; }
.ui-root[data-fallback] :is(.metal-fx-canvas, .mfx-inner, .mfx-glow, .mfx-rim) { display: none; }
.ui-root[data-fallback] .mfx-fallback { display: block; position: absolute; inset: 0; z-index: 6; pointer-events: none;
  border-radius: var(--mfx-radius, 0px); padding: var(--mfx-ring, 1px); background: var(--mfx-gradient);
  opacity: var(--mfx-strength, 1);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0); }
/* Forced colours: no painted metal; the wrapped control gets a system-coloured edge back. */
@media (forced-colors: active) {
  .mfx-fallback, .metal-fx-canvas, .mfx-glow, .mfx-rim { display: none !important; }
  .ui-root[data-normalize] ::slotted(*) { border: 1px solid ButtonText !important; }
}
`;

/** `<ui-metal>`: the base, nothing more. */
export const styles = metalBaseCss;
