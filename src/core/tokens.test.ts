import { describe, expect, it } from 'vitest';
import { kitCss } from '../kit/kit';
import { DARK, LIGHT, MONO_DARK, MONO_LIGHT, tokensCss } from './tokens';

// 0.25.0 — the mono palette: light·mono and dark·mono beside the colour themes (2lab-ai/soma-work de-aislop).
const STATUS = ['st-wait', 'st-run', 'st-done', 'st-fail'] as const;
const HUES = ['accent', 'green', 'yellow', 'red', 'purple', 'orange', 'ib-spark', 'border-focus'] as const;

const rgb = (h: string): number[] => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
const lum = (h: string): number => {
  const [r, g, b] = rgb(h).map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string): number => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** Spread of the channels: 0 for a pure grey. */
const spread = (h: string): number => Math.max(...rgb(h)) - Math.min(...rgb(h));

describe('mono palette tokens', () => {
  it('only overrides tokens the colour themes define', () => {
    for (const k of Object.keys(MONO_LIGHT)) expect(LIGHT, k).toHaveProperty(k);
    for (const k of Object.keys(MONO_DARK)) expect(DARK, k).toHaveProperty(k);
  });

  it('drops --chroma from 1 (colour) to 0 (mono)', () => {
    expect([LIGHT.chroma, DARK.chroma]).toEqual(['1', '1']);
    expect([MONO_LIGHT.chroma, MONO_DARK.chroma]).toEqual(['0', '0']);
  });

  it('turns every decorative hue and the focus ring neutral, and error text to ink', () => {
    for (const [set, base] of [
      [MONO_LIGHT, LIGHT],
      [MONO_DARK, DARK],
    ] as const) {
      for (const h of HUES) expect([h, spread(set[h]) <= 8]).toEqual([h, true]);
      expect(set['st-fail-text']).toBe(base.text);
    }
  });

  it('keeps the four state colours (dark verbatim; light deepens only the amber)', () => {
    for (const s of STATUS) expect(MONO_DARK[s], s).toBeUndefined();
    for (const s of STATUS.filter((x) => x !== 'st-wait')) expect(MONO_LIGHT[s], s).toBeUndefined();
    // The wait amber stays an amber: red well above blue.
    const [r, , b] = rgb(MONO_LIGHT['st-wait']);
    expect(r - b).toBeGreaterThan(120);
  });

  it('draws each state icon at ≥ 3:1 on the neutral pill and the card in mono (WCAG 1.4.11)', () => {
    for (const [mono, base] of [
      [MONO_LIGHT, LIGHT],
      [MONO_DARK, DARK],
    ] as const) {
      for (const s of STATUS) {
        const c = mono[s] ?? base[s];
        expect([s, ratio(c, base['ib-pill']) >= 3, ratio(c, base['ib-card']) >= 3]).toEqual([s, true, true]);
      }
      // The secondary ink on the pill (the tag's word) and the focus ring on the card stay readable.
      expect(ratio(base['ib-text-2'], base['ib-pill'])).toBeGreaterThanOrEqual(4.5);
      expect(ratio(mono['border-focus'], base['ib-card'])).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('tokensCss — the page tokens', () => {
  it('keeps the colour blocks and adds the mono overrides after them', () => {
    const lines = tokensCss.trim().split('\n');
    expect(lines[1]).toMatch(/^:root, \[data-theme="light"\] \{ .*--ui-chroma: 1;.* color-scheme: light; \}$/);
    expect(lines[2]).toMatch(/^\[data-theme="dark"\] \{ .*--ui-chroma: 1;.* color-scheme: dark; \}$/);
    expect(lines[4]).toMatch(/^\[data-palette="mono"\]:not\(\[data-theme="dark"\]\) \{ .*--ui-chroma: 0;.* \}$/);
    expect(lines[5]).toMatch(/^\[data-palette="mono"\]\[data-theme="dark"\] \{ .*--ui-chroma: 0;.* \}$/);
    expect(lines[6]).toContain(':root[data-palette="mono"]:not([data-theme="light"])');
    // The colour themes keep their status and hue values verbatim.
    for (const s of [...STATUS, 'accent', 'green']) expect(lines[1]).toContain(`--ui-${s}: ${LIGHT[s]};`);
  });

  it('is what the build writes to dist/tokens.css (one generator)', () => {
    const script = Object.values(
      import.meta.glob('../../scripts/copy-assets.mjs', { query: '?raw', import: 'default', eager: true }),
    )[0] as string;
    expect(script).toContain("import(new URL('../dist/server.js', import.meta.url).href)");
    expect(script).not.toContain('tokens.json');
  });
});

/**
 * The library-wide rule (the mono checklist as a test): a state colour mixed into a FILL or a TEXT is scaled by
 * --chroma, so mono leaves it on marks only. Mixes into a border / ring / outline are marks and stay; so do the
 * listed glyphs (an icon is a mark).
 */
describe('mono palette — every status fill and text tint follows --chroma', () => {
  const STATE_MIX =
    /color-mix\(in srgb, (?:\$\{T\(')?(?:var\(--(?:ui-)?)?(?:st-(?:wait|run|done|fail|fail-text)|st-color|ag-c|ag-t|tb-tone|sb-c|ab-tone|wc|c-ink|aq-pc|aq-st|aq-sc|aq-warn|tc-red|cb-fail|as-fail|as-fail-text|as-done)(?:'\)\})?(?:, var\(--[a-z0-9-]+\))?\)? \d+(?:\.\d+)?%/;
  const LINE = /^(border|border-[a-z-]+|box-shadow|outline|outline-color|stroke|--[a-z0-9-]*(line|ring|border|edge))$/;
  const GLYPHS = [
    '.cv-errbar > svg',
    '.wl-tool[data-status="running"] .wl-mark',
    '.wl-tool[data-status="success"] .wl-mark',
  ];

  const files = import.meta.glob('../components/*/styles.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;
  const sheets: Array<[string, string]> = [...Object.entries(files), ['ui-kit.css', kitCss]];

  it('reads every component sheet and catches an unscaled mix', () => {
    expect(Object.keys(files).length).toBeGreaterThan(30);
    expect(STATE_MIX.test('color: color-mix(in srgb, var(--st-run) 70%, var(--ib-text))')).toBe(true);
    // The kit's source form, a template hole (built by concatenation so it is not one here).
    expect(STATE_MIX.test('background: color-mix(in srgb, $' + "{T('st-fail')} 16%, x)")).toBe(true);
    expect(STATE_MIX.test('color: color-mix(in srgb, var(--ui-st-run) 70%, var(--ui-ib-text))')).toBe(true);
    expect(STATE_MIX.test('color: color-mix(in srgb, var(--st-run) calc(70% * var(--chroma)), var(--ib-text))')).toBe(
      false,
    );
  });

  it('has no unscaled status mix outside borders and the listed glyphs', () => {
    const bad: string[] = [];
    for (const [file, css] of sheets) {
      for (const rule of css.split('}')) {
        const [selector = '', body = ''] = rule.split('{');
        if (GLYPHS.some((g) => selector.includes(g))) continue;
        for (const decl of body.split(';')) {
          const at = decl.indexOf(':');
          if (at < 0) continue;
          const prop = decl.slice(0, at).trim();
          if (LINE.test(prop)) continue;
          if (STATE_MIX.test(decl))
            bad.push(
              `${file}: ${prop}: ${decl
                .slice(at + 1)
                .trim()
                .slice(0, 90)}`,
            );
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
