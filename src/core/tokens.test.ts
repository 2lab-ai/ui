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
  it('only overrides tokens the colour themes define, the same names in light and dark', () => {
    for (const k of Object.keys(MONO_LIGHT)) expect(LIGHT, k).toHaveProperty(k);
    for (const k of Object.keys(MONO_DARK)) expect(DARK, k).toHaveProperty(k);
    // An OS-dark page with no data-theme matches both mono blocks: a name only one of them set would leak across.
    expect(Object.keys(MONO_DARK).sort()).toEqual(Object.keys(MONO_LIGHT).sort());
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
    for (const s of STATUS) expect([s, MONO_DARK[s] ?? DARK[s]]).toEqual([s, DARK[s]]);
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
 * The library-wide rule (the mono checklist as a test), read from what ships: every element's own `static styles`
 * (helpers resolved, the shared plan / activity sheets included) and the kit. In mono a state shows its colour on a
 * mark only — so a state colour mixed into a FILL or a TEXT at a fixed percentage is a bug (it must follow --chroma),
 * and so is a state colour used as plain TEXT. Mixes into a border / ring / outline are marks and stay; an icon keeps
 * its colour through a calc() form (its mix in colour, the raw state in mono).
 */
describe('mono palette — every status fill and text tint follows --chroma (shipped CSS)', () => {
  const STATE =
    '(?:st-(?:wait|run|done|fail|fail-text)|st-color|ag-c|ag-t|tb-tone|sb-c|ab-tone|wc|c-ink|aq-pc|aq-st|aq-sc|aq-warn|tc-red|cb-fail|as-fail|as-fail-text|as-done)';
  const STATE_MIX = new RegExp(
    `color-mix\\(in srgb, var\\(--(?:ui-)?${STATE}(?:, var\\(--[a-z0-9-]+\\))?\\) \\d+(?:\\.\\d+)?%`,
  );
  // Plain text in a non-fail state colour (fail text is the mono ink token itself).
  const STATE_TEXT = /^var\(--(?:ui-)?(?:st-(?:wait|run|done)|ag-t|aq-pc|as-done)(?:, var\(--[a-z0-9-]+\))?\)$/;
  const LINE = /^(border|border-[a-z-]+|box-shadow|outline|outline-color|stroke|--[a-z0-9-]*(line|ring|border|edge))$/;
  // Selectors that draw a mark (icon, dot, spinner, tick…): their raw state colour is the point.
  const MARK = /svg|icon|mark|spark|spin|glyph|dot|tick|\.sb-bi\b|\.ps-icon|\.tc-copy|\.ap-mark|\.at-icon|\.wl-ag-icon/;

  const mods = import.meta.glob(['../components/*/*.ts', '!../components/*/*.test.ts', '!../components/*/docs.ts'], {
    eager: true,
  }) as Record<string, Record<string, unknown>>;
  const sheets: Array<[string, string]> = [['ui-kit.css', kitCss]];
  for (const [file, mod] of Object.entries(mods))
    for (const v of Object.values(mod)) {
      const css = (v as { styles?: unknown } | null)?.styles;
      if (typeof v === 'function' && Array.isArray(css)) sheets.push([`${file} ${v.name}`, css.join('\n')]);
    }

  function offences(css: string): string[] {
    const bad: string[] = [];
    for (const rule of css.split('}')) {
      const [selector = '', body = ''] = rule.split('{');
      for (const decl of body.split(';')) {
        const at = decl.indexOf(':');
        if (at < 0) continue;
        const prop = decl.slice(0, at).trim();
        const value = decl.slice(at + 1).trim();
        if (LINE.test(prop)) continue;
        if (STATE_MIX.test(decl)) bad.push(`${selector.trim()} { ${prop}: ${value.slice(0, 80)} }`);
        else if (prop === 'color' && STATE_TEXT.test(value) && !MARK.test(selector))
          bad.push(`${selector.trim()} { color: ${value} } — text in a state colour`);
      }
    }
    return bad;
  }

  it('reads every element sheet (the shared plan / activity / meter ones too) and catches what it should', () => {
    expect(sheets.length).toBeGreaterThan(40);
    const all = sheets.map(([, css]) => css).join('\n');
    expect(all).toContain('.pl-state[data-st="running"]');
    expect(all).toContain('.sys-badge[data-kind="restart"]');
    expect(all).toContain('.m[data-tone="done"]');
    // Positive controls: an unscaled fill, an unscaled tint, plain state text; a border mix and an icon pass.
    expect(offences('.x { background: color-mix(in srgb, var(--st-run) 14%, var(--ib-card)); }')).toHaveLength(1);
    expect(offences('.x { color: color-mix(in srgb, var(--ui-st-done) 70%, var(--ui-ib-text)); }')).toHaveLength(1);
    expect(offences('.x-word { color: var(--st-run); }')).toHaveLength(1);
    expect(offences('.x { border-color: color-mix(in srgb, var(--st-run) 45%, var(--ib-card)); }')).toEqual([]);
    expect(offences('.x-icon { color: var(--st-run); }')).toEqual([]);
    expect(
      offences('.x { background: color-mix(in srgb, var(--st-run) calc(14% * var(--chroma)), var(--ib-card)); }'),
    ).toEqual([]);
  });

  it('has no unscaled status fill or tint, and no plain status text, in any shipped sheet', () => {
    const bad = sheets.flatMap(([name, css]) => offences(css).map((o) => `${name}: ${o}`));
    expect(bad).toEqual([]);
  });
});
