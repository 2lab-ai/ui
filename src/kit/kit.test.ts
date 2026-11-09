import { describe, expect, it } from 'vitest';
import { syncOwnerBadgeOrbit as rootSync } from '../core/owner-badge';
import tokens from '../core/tokens.json';
import * as kitEntry from './index';
import { KIT_CLASSES, kitCss } from './kit';

// The kit's own knobs beside the tokens: `--ui-tone` (a tone's colour), `--ui-select-max` (a select chip's cap) and the
// owner badge's hue (0.28.0).
const KNOWN = new Set([
  ...Object.keys(tokens.light),
  ...Object.keys(tokens.shared),
  'tone',
  'select-max',
  'owner-badge-hue',
  'bento-gap',
  'bleed',
]);

describe('ui-kit.css', () => {
  it('a pressed toggle chip or button: the raised step with an ink border; a pressed star is filled (0.21.0)', () => {
    expect(kitCss).toMatch(
      /\.ui-chip\[aria-pressed="true"\][^{]*\{[^}]*border-color: color-mix\(in srgb, var\(--ui-ib-text/,
    );
    expect(kitCss).toContain(
      ':is(.ui-btn, .ui-chip)[aria-pressed="true"] > svg[data-icon="star"] { fill: currentColor; }',
    );
  });

  it('defines every class it lists', () => {
    for (const c of KIT_CLASSES) expect(kitCss, c).toContain(`.${c}`);
  });

  it('never hard-codes a colour: every value is a --ui-* token or a color-mix of tokens', () => {
    // Strip comments, then look for hex and rgb()/hsl() literals.
    const css = kitCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(rgba?|hsla?)\(/i);
    for (const m of css.matchAll(/var\(--ui-([a-z0-9-]+)/g)) expect(KNOWN.has(m[1]), m[1]).toBe(true);
  });

  it('.ui-owner-badge (0.28.0): the board’s name pill on a page — eight hues, .is-self orbits, still under reduced motion', () => {
    const css = kitCss.replace(/\s+/g, ' ');
    expect(css).toContain('.ui-owner-badge { display: inline-block; max-inline-size: 168px; vertical-align: middle; }');
    expect(css).toMatch(
      /\.ui-owner-badge \{ padding: 2px 8px; border-radius: 999px;[^}]*--ui-owner-badge-hue: var\(--ui-accent\);/,
    );
    for (let h = 1; h < 8; h++) expect(css).toContain(`.ui-owner-badge[data-hue="${h}"] { --ui-owner-badge-hue:`);
    expect(css).toMatch(
      /\.ui-owner-badge\.is-self::before \{[^}]*animation: ui-owner-badge-orbit 2400ms linear infinite; \}/,
    );
    expect(css).toContain('@keyframes ui-owner-badge-orbit');
    expect(css).toMatch(
      /prefers-reduced-motion: reduce\) \{ \.ui-owner-badge\.is-self \{ background:[^}]+\} \.ui-owner-badge\.is-self::before \{ animation: none; display: none; \}/,
    );
    expect(css).toMatch(/forced-colors: active\) \{ \.ui-owner-badge\.is-self \{ outline: 2px solid Highlight;/);
  });

  it('the kit entry (@2lab.ai/ui/kit) carries the orbit sync, so a kit-only host never loads the elements', () => {
    expect(kitEntry.syncOwnerBadgeOrbit).toBe(rootSync);
    expect(kitEntry.OWNER_BADGE_ORBITS).toEqual(['ib-badge-orbit', 'ui-owner-badge-orbit']);
    expect(kitEntry.kitCss).toBe(kitCss);
  });

  it('.ui-effort: xhigh a red gradient, max and ultra a foil sweep — the picker’s own words and effects', () => {
    expect(kitCss).toMatch(
      /\.ui-effort\[data-effort="xhigh"\] \{ background-image: linear-gradient\(90deg, color-mix\(in srgb, var\(--ui-red\)/,
    );
    expect(kitCss).toMatch(/\.ui-effort\[data-effort="max"\] \{[^}]*animation: ui-effort-foil/);
    expect(kitCss).toMatch(
      /\.ui-effort\[data-effort="ultra"\] \{[^}]*var\(--ui-purple\)[^}]*animation: ui-effort-foil/,
    );
    expect(kitCss).toContain('@keyframes ui-effort-foil');
    expect(kitCss).toMatch(/forced-colors: active\)[\s\S]*\.ui-effort\[data-effort="ultra"\]/);
  });

  it('has the button family, the press scale and 44px coarse targets', () => {
    for (const mod of ['is-primary', 'is-quiet', 'is-danger', 'is-sm', 'is-lg'])
      expect(kitCss).toContain(`.ui-btn.${mod}`);
    expect(kitCss).toMatch(/:active[^{]*\{ transform: scale\(0\.97\); \}/);
    expect(kitCss).toMatch(/@media \(pointer: coarse\)[^{]*\{\s*\.ui-btn, \.ui-btn\.is-sm \{ min-height: 44px;/);
    // The ink primary: text-coloured fill, card-coloured label.
    expect(kitCss).toContain(
      '.ui-btn.is-primary { background: var(--ui-ib-text); border-color: var(--ui-ib-text); color: var(--ui-ib-card); }',
    );
  });

  it('gates hover to fine pointers and never moves on hover', () => {
    const hover = kitCss.slice(kitCss.indexOf('@media (hover: hover)'));
    const block = hover.slice(0, hover.indexOf('\n}\n'));
    expect(block).not.toMatch(/transform|translate|scale\(/);
    expect(kitCss.slice(0, kitCss.indexOf('@media (hover: hover)'))).not.toMatch(/:hover/);
  });

  it("a toned chip takes the host's --ui-tone for its tint and word, and a small size (0.15.0)", () => {
    expect(kitCss).toMatch(
      /\.ui-chip\.is-toned \{[^}]*background: color-mix\(in srgb, var\(--ui-tone, var\(--ui-ib-muted\)\) 14%, var\(--ui-ib-card\)\);/,
    );
    expect(kitCss).toMatch(
      /\.ui-chip\.is-toned \{[^}]*color: color-mix\(in srgb, var\(--ui-tone, var\(--ui-ib-muted\)\) 70%, var\(--ui-ib-text\)\);/,
    );
    expect(kitCss).toContain('.ui-chip.is-sm { gap: 4px; height: 20px; padding: 0 7px; font-size: 11px; }');
    // A small chip as a button still reaches 44px on touch (20 + 2 × 12).
    expect(kitCss).toContain(':is(button.ui-chip, a.ui-chip).is-sm::after { inset: -12px 0; }');
  });

  it('tints status tones with color-mix in both text and pill', () => {
    for (const t of ['run', 'wait', 'done', 'fail']) {
      expect(kitCss).toContain(`.ui-status[data-tone="${t}"]`);
      expect(kitCss).toContain(
        `.ui-status.is-pill[data-tone="${t}"] { background: color-mix(in srgb, var(--ui-st-${t}) calc(16% * var(--ui-chroma, 1)), color-mix(in srgb, var(--ui-ib-card) calc(100% * var(--ui-chroma, 1)), var(--ui-ib-pill))); }`,
      );
      expect(kitCss).toContain(`.ui-status-line[data-tone="${t}"]`);
    }
  });

  it('idle is the muted hollow dot; a leading svg replaces the dot in the tone colour (G1-2)', () => {
    expect(kitCss).toContain(
      '.ui-status[data-tone="idle"]::before { background: transparent; box-shadow: inset 0 0 0 1.5px var(--ui-tone); }',
    );
    // idle keeps the default muted tone and text-2 word (no status colour).
    expect(kitCss).not.toMatch(/\.ui-status\[data-tone="idle"\] \{/);
    expect(kitCss).toMatch(/\.ui-status > svg \{[^}]*color: var\(--ui-tone\)/);
    expect(kitCss).toContain('.ui-status:has(> svg)::before { content: none; }');
    expect(kitCss).toContain('.ui-status[data-live] > svg { animation: ui-pulse');
    const rm = kitCss.slice(kitCss.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(rm).toContain('.ui-status[data-live] > svg { animation: none; }');
  });

  it('expands 0fr → 1fr and hides closed content from focus', () => {
    expect(kitCss).toContain('grid-template-rows: 0fr');
    expect(kitCss).toMatch(/\.ui-expand\.is-open, \.ui-expand\[data-open\] \{ grid-template-rows: 1fr; \}/);
    expect(kitCss).toMatch(/\.ui-expand > \* \{[^}]*visibility: hidden/);
  });

  it('has the section head: a 13px / 650 sentence-case row with trailing actions', () => {
    expect(KIT_CLASSES).toContain('ui-section-head');
    const head = /\.ui-section-head \{([^}]*)\}/.exec(kitCss)?.[1] ?? '';
    expect(head).toContain('font-size: 13px');
    expect(head).toContain('font-weight: 650');
    expect(head).toContain('text-transform: none');
    expect(head).not.toMatch(/uppercase/);
    expect(kitCss).toMatch(/\.ui-section-head > \.is-end \{[^}]*margin-left: auto/);
    expect(kitCss).toMatch(/\.ui-section-head:focus-visible \{ outline: 2px solid var\(--ui-border-focus\)/);
  });

  it('has the count badge: a tabular pill, tone tints, and a pop that is opacity-only under reduced motion', () => {
    expect(KIT_CLASSES).toContain('ui-count');
    const count = /\.ui-count \{([^}]*)\}/.exec(kitCss)?.[1] ?? '';
    expect(count).toContain('border-radius: 999px');
    expect(count).toContain('font-variant-numeric: tabular-nums');
    expect(count).toContain('font-size: 11px');
    for (const t of ['run', 'wait', 'done', 'fail'])
      expect(kitCss).toContain(
        `.ui-count[data-tone="${t}"] { background: color-mix(in srgb, var(--ui-st-${t}) calc(16% * var(--ui-chroma, 1)), color-mix(in srgb, var(--ui-ib-card) calc(100% * var(--ui-chroma, 1)), var(--ui-ib-pill)));`,
      );
    expect(kitCss).toContain(
      '.ui-count[data-pop] { animation: ui-count-pop var(--ui-dur-move) var(--ui-ease-out) both; }',
    );
    expect(kitCss).toContain('@keyframes ui-count-pop { from { opacity: 0; transform: scale(0.9); } }');
    const rm = kitCss.slice(kitCss.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(rm.slice(0, rm.indexOf('\n}\n'))).toContain(
      '.ui-count[data-pop] { animation: ui-fade-in 120ms ease both; }',
    );
    expect(kitCss).toContain('@keyframes ui-fade-in { from { opacity: 0; } }');
  });

  it('stops loops and movement under reduced motion', () => {
    const rm = kitCss.slice(kitCss.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(rm).toContain('.ui-skeleton, .ui-status[data-live]::before { animation: none; }');
    expect(rm).toContain('.ui-expand { transition: none; }');
  });

  it('keeps Korean words whole in the prose classes under lang="ko" (D5 G4-4)', () => {
    expect(kitCss).toMatch(
      /:is\(\.ui-notice, \.ui-card, \.ui-row, \.ui-dl,[^)]*\):lang\(ko\) \{ word-break: keep-all; \}/,
    );
  });

  it('select chip: the trigger shape, sized to its selected option, a token chevron, a word form, a focus ring (A-11, H-02)', () => {
    expect(KIT_CLASSES).toContain('ui-select-chip');
    const chip = /\.ui-select-chip \{([^}]*)\}/.exec(kitCss)?.[1] ?? '';
    // The model picker's trigger: the neutral well, 8px, 30px, 13px / 500.
    expect(chip).toContain('min-height: 30px');
    expect(chip).toContain('border-radius: 8px');
    expect(chip).toContain('background-color: var(--ui-ib-seg)');
    expect(chip).toContain('font-size: 13px; font-weight: 500');
    const select = /select\.ui-select-chip, \.ui-select-chip > select \{([^}]*)\}/.exec(kitCss)?.[1] ?? '';
    expect(select).toContain('appearance: none');
    expect(select).toContain('field-sizing: content');
    expect(select).toContain('max-width: var(--ui-select-max, 220px)');
    expect(select).toContain('text-overflow: ellipsis');
    // The chevron is two token-coloured triangles, never a data URI.
    expect(select).toContain('var(--ui-ib-muted) 50%');
    expect(select).not.toContain('url(');
    // The word form: a quiet leading word, the select inside loses its own box.
    expect(kitCss).toMatch(
      /\.ui-select-chip > span \{[^}]*font-size: 11\.5px; font-weight: 600; color: var\(--ui-ib-muted\)/,
    );
    expect(kitCss).toMatch(/\.ui-select-chip > select \{[^}]*border: 0;[^}]*background-color: transparent/);
    expect(kitCss).toContain(
      '.ui-select-chip:has(> select:focus-visible), select.ui-select-chip:focus-visible { outline: 2px solid var(--ui-border-focus); outline-offset: 2px; }',
    );
    expect(kitCss).toContain('.ui-select-chip > select:focus-visible { outline: none; }');
    expect(kitCss).toMatch(/\.ui-select-chip:has\(> select:disabled\) \{ opacity: 0\.5; cursor: not-allowed; \}/);
    // The dropdown list on the page surface (dark theme too).
    expect(kitCss).toContain(
      ':is(select.ui-select-chip, .ui-select-chip > select) > option { background: var(--ui-surface); color: var(--ui-text); }',
    );
    // Hover: the well, colour only, fine pointers; 44px and 16px type on touch; keep-all in Korean.
    const hover = kitCss.slice(kitCss.indexOf('@media (hover: hover)'));
    expect(hover.slice(0, hover.indexOf('\n}\n'))).toContain(
      'select.ui-select-chip:hover:not(:disabled), .ui-select-chip:hover:has(> select:not(:disabled)) { background-color: color-mix(in srgb, var(--ui-ib-text) 6%, var(--ui-ib-card)); }',
    );
    const coarse = kitCss.slice(kitCss.indexOf('@media (pointer: coarse), (max-width: 639px)'));
    expect(coarse.slice(0, coarse.indexOf('\n}\n'))).toContain('.ui-select-chip { min-height: 44px; }');
    expect(kitCss).toMatch(
      /@media \(pointer: coarse\) \{\s*select\.ui-select-chip, \.ui-select-chip > select \{ font-size: 16px; \}/,
    );
    expect(kitCss).toMatch(/:is\([^)]*\.ui-select-chip[^)]*\):lang\(ko\) \{ word-break: keep-all; \}/);
    const rm = kitCss.slice(kitCss.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(rm.slice(0, rm.indexOf('\n}\n'))).toContain('.ui-select-chip, .ui-fab { transition-duration: 0.01ms; }');
  });

  it('extended FAB: a 56px pill with a word that folds away to the round button, no movement under reduced motion (H-10)', () => {
    const ext = /\.ui-fab\.is-extended \{([^}]*)\}/.exec(kitCss)?.[1] ?? '';
    expect(ext).toContain('display: inline-flex');
    expect(ext).toContain('border-radius: 999px');
    expect(ext).toContain('padding: 0 20px 0 17px');
    expect(ext).toContain('font-size: 15px; font-weight: 600');
    expect(ext).toContain(
      'transition: padding var(--ui-dur-expand) var(--ui-ease-out), gap var(--ui-dur-expand) var(--ui-ease-out)',
    );
    // The word rides max-width + opacity; folded, it is gone and the padding closes to the 56px circle (17 + 22 + 17).
    expect(kitCss).toMatch(
      /\.ui-fab\.is-extended > span \{[^}]*max-width: 10em; overflow: hidden;[^}]*transition: max-width var\(--ui-dur-expand\) var\(--ui-ease-out\), opacity var\(--ui-dur-fade\) var\(--ui-ease-out\)/,
    );
    expect(kitCss).toContain('.ui-fab.is-extended.is-folded { gap: 0; padding: 0 17px; }');
    expect(kitCss).toContain('.ui-fab.is-extended.is-folded > span { max-width: 0; opacity: 0; }');
    // The base FAB keeps its corner, safe areas, press scale and focus ring; the extended one inherits them.
    const fab = /\.ui-fab \{([^}]*)\}/.exec(kitCss)?.[1] ?? '';
    expect(fab).toContain('right: max(20px, env(safe-area-inset-right))');
    expect(fab).toContain('height: 56px');
    expect(kitCss).toContain('.ui-fab:active:not(:disabled):not(:focus-visible) { transform: scale(0.95); }');
    const rm = kitCss.slice(kitCss.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(rm.slice(0, rm.indexOf('\n}\n'))).toContain(
      '.ui-fab.is-extended, .ui-fab.is-extended > span { transition: none; }',
    );
  });

  it('spinner: a 0.9s linear ring in the run tone, sizes and tones, the status dot swapped, a still ring + dot under reduced motion (K-01)', () => {
    expect(KIT_CLASSES).toContain('ui-spinner');
    const spin = /\.ui-spinner \{([^}]*)\}/.exec(kitCss)?.[1] ?? '';
    expect(spin).toContain('--ui-tone: var(--ui-st-run)');
    expect(spin).toContain('width: 14px; height: 14px; border-radius: 50%');
    // The track is the tone at 25%, the arc the tone itself — one rule for both themes.
    expect(spin).toContain('border: 2px solid color-mix(in srgb, var(--ui-tone) 25%, transparent)');
    expect(spin).toContain('border-top-color: var(--ui-tone); border-right-color: var(--ui-tone)');
    expect(spin).toContain('animation: ui-spin 0.9s linear infinite');
    expect(kitCss).toContain('@keyframes ui-spin { to { transform: rotate(360deg); } }');
    expect(kitCss).toMatch(/\.ui-spinner\.is-sm \{ width: 11px; height: 11px; border-width: 1\.8px/);
    expect(kitCss).toMatch(/\.ui-spinner\.is-lg \{ width: 20px; height: 20px; border-width: 2\.5px/);
    expect(kitCss).toContain('.ui-spinner.is-current { --ui-tone: currentColor; }');
    for (const t of ['run', 'wait', 'done', 'fail'])
      expect(kitCss).toContain(`.ui-spinner[data-tone="${t}"] { --ui-tone: var(--ui-st-${t}); }`);
    // Inside a status it takes the status tone and stands where the dot was.
    expect(kitCss).toContain('.ui-status > .ui-spinner { --ui-tone: inherit; }');
    expect(kitCss).toContain('.ui-status:has(> .ui-spinner)::before { content: none; }');
    const rm = kitCss.slice(kitCss.indexOf('@media (prefers-reduced-motion: reduce)'));
    const block = rm.slice(0, rm.indexOf('\n}\n'));
    expect(block).toContain(
      '.ui-spinner { animation: none; border-color: color-mix(in srgb, var(--ui-tone) 25%, transparent); }',
    );
    expect(block).toMatch(
      /\.ui-spinner::after \{ content: '';[^}]*width: 4px; height: 4px; margin: auto; border-radius: 50%; background: var\(--ui-tone\)/,
    );
    // Still rings only there: outside reduced motion no ::after is drawn.
    expect(kitCss.slice(0, kitCss.indexOf('@media (prefers-reduced-motion: reduce)'))).not.toContain(
      '.ui-spinner::after',
    );
  });

  it('dashboard layout (0.41.0): the bento reflows by its own width, the hatch, the inverse card, the KPI, the scroll row, tiles', () => {
    const css = kitCss.replace(/\s+/g, ' ');
    for (const c of ['ui-bento', 'ui-hatch', 'ui-kpi', 'ui-scroll-row', 'ui-date-tile', 'ui-icon-tile'])
      expect(KIT_CLASSES).toContain(c);
    // A container query on the grid, not a viewport one: a bento in a side panel reflows like one on a phone.
    expect(css).toContain('container: ui-bento / inline-size');
    expect(css).toMatch(
      /@container ui-bento \(min-width: 560px\) \{ \.ui-bento > :is\(\.is-span-2, [^)]*\) \{ grid-column: span 6; \}/,
    );
    expect(css).toContain('.ui-bento > .is-span-4 { grid-column: span 4; }');
    expect(css).toContain('.ui-bento > * { grid-column: span 12; min-width: 0; }');
    // The DOM order is the reading order unless the host opts into back-filling.
    expect(css).toMatch(/\.ui-bento \{[^}]*grid-auto-flow: row;/);
    expect(css).toContain('.ui-bento.is-dense { grid-auto-flow: row dense; }');
    expect(css).toContain('.ui-hatch { background-image: repeating-linear-gradient(135deg');
    expect(css).toContain(
      '.ui-card.is-inverse { border-color: var(--ui-ib-text); background: var(--ui-ib-text); color: var(--ui-ib-card);',
    );
    expect(css).toMatch(/\.ui-kpi\[data-tone="fail"\] > \.ui-kpi-mark \{ background: color-mix/);
    // The phone's row scrolls sideways without a scrollbar and never drags the page; it may wrap again on wide screens.
    expect(css).toMatch(
      /\.ui-scroll-row \{[^}]*overflow-x: auto;[^}]*overscroll-behavior-x: contain;[^}]*scrollbar-width: none;/,
    );
    expect(css).toContain(
      '@media (min-width: 640px) { .ui-scroll-row.is-wrap-wide { flex-wrap: wrap; overflow: visible; }',
    );
    expect(css).toMatch(/\.ui-icon-tile\[data-tone="done"\] \{ --ui-tone: color-mix/);
  });

  it('parses as CSS in the DOM', () => {
    const style = document.createElement('style');
    style.textContent = kitCss;
    document.head.append(style);
    expect(style.sheet?.cssRules.length ?? 0).toBeGreaterThan(40);
    style.remove();
  });
});
