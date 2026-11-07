import { describe, expect, it } from 'vitest';
import { baseCss, DARK, DESIGNS, designById, tokensCss } from './tokens';

// 0.38.0 — designs: a whole look a page picks with data-design="<id>" (tokens), plus its tone & manner in
// designs/<id>/ (DESIGN.md, the spec; README.md, how it maps onto this library). The first one is modern-mono.

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

/** The repo's design folders, read as text (the same files an agent reads to build a site). */
const files = import.meta.glob(['../../designs/README.md', '../../designs/*/README.md', '../../designs/*/DESIGN.md'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const file = (path: string): string | undefined => files[`../../designs/${path}`];
const entry = Object.values(
  import.meta.glob(['../../AGENTS.md', '../../README.md'], { query: '?raw', import: 'default', eager: true }),
) as string[];

describe('DESIGNS — the registry', () => {
  it('lists modern-mono, with unique kebab-case ids and a scheme', () => {
    expect(DESIGNS.map((d) => d.id)).toContain('modern-mono');
    expect(new Set(DESIGNS.map((d) => d.id)).size).toBe(DESIGNS.length);
    for (const d of DESIGNS) {
      expect(d.id).toMatch(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
      expect(['light', 'dark']).toContain(d.scheme);
      expect(d.name.length).toBeGreaterThan(0);
      expect(d.summary.length).toBeGreaterThan(0);
    }
    expect(designById('modern-mono')?.name).toBe('Modern Mono');
    expect(designById('nope')).toBeUndefined();
  });

  it('gives every design a complete colour set: exactly the names the themes define, so it never leans on one', () => {
    for (const d of DESIGNS) expect([d.id, Object.keys(d.tokens).sort()]).toEqual([d.id, Object.keys(DARK).sort()]);
  });
});

describe('modern-mono — the values the spec measured or set', () => {
  const t = designById('modern-mono')!.tokens;

  it('is dark: the near-black canvas, the input surface, white and grey type, the subtle line, the active capsule', () => {
    expect(designById('modern-mono')!.scheme).toBe('dark');
    expect(t.bg).toBe('#050505'); // bg.canvas — the most common pixel of R1–R5
    expect(t['ib-col']).toBe('#050505');
    expect(t['surface-raised']).toBe('#141416'); // bg.surface — search pill, bottom nav, inputs
    expect(t['ib-seg']).toBe('#141416');
    expect(t['ib-seg-on']).toBe('#2a2a2d'); // bg.active — selected toggle, active nav capsule
    expect(t['ib-card']).toBe('#101012'); // bg.surfaceSubtle — panel insides
    expect([t.text, t['ib-text'], t.accent]).toEqual(['#f5f5f7', '#f5f5f7', '#f5f5f7']); // one ink, no hue accent
    expect([t['text-secondary'], t['ib-text-2']]).toEqual(['#9a99a7', '#9a99a7']);
    expect([t['text-tertiary'], t['ib-muted']]).toEqual(['#7f7e8c', '#7f7e8c']);
    expect([t.border, t['ib-card-border']]).toEqual(['#242428', '#242428']); // border.subtle
    expect(t['border-focus']).toBe('#d3c7ff'); // focus
  });

  it('keeps colour for meaning only: green up / done, red down / fail, yellow favourite / waiting', () => {
    expect([t.green, t['st-done']]).toEqual(['#35df97', '#35df97']); // positive.text
    expect([t.red, t['st-fail'], t['st-fail-text']]).toEqual(['#ff3c5a', '#ff3c5a', '#ff3c5a']); // negative
    expect([t.yellow, t['st-wait']]).toEqual(['#f4bb20', '#f4bb20']); // favorite
    expect(t.chroma).toBe('1');
  });

  it('draws no floating shadow on the page; a shadow list stays valid where a component appends to it', () => {
    expect(t['ib-shadow']).toBe('0 0 #0000');
  });

  it('reads at WCAG AA: text ≥ 4.5:1 where it sits, state marks and the focus ring ≥ 3:1', () => {
    const grounds = [t.bg, t['ib-card'], t.surface, t['surface-raised']];
    for (const g of grounds) {
      for (const ink of [t.text, t['text-secondary'], t['text-tertiary'], t['ib-muted'], t['st-fail-text']])
        expect([ink, g, ratio(ink, g) >= 4.5]).toEqual([ink, g, true]);
      for (const mark of [t['st-run'], t['st-wait'], t['st-done'], t['st-fail'], t['border-focus']])
        expect([mark, g, ratio(mark, g) >= 3]).toEqual([mark, g, true]);
    }
    // The secondary ink on a pill and on the selected toggle (a tag's word, a chip that is on).
    expect(ratio(t['ib-text-2'], t['ib-pill'])).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t['ib-text'], t['ib-seg-on'])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('tokensCss — a design block per design, after the themes and the mono pair', () => {
  const lines = tokensCss.trim().split('\n');

  it('applies a design on :root or any ancestor, locks its color scheme, and comes last so it wins ties', () => {
    const at = lines.findIndex((l) => l.startsWith(':root[data-design="modern-mono"], [data-design="modern-mono"] {'));
    expect(at).toBeGreaterThan(lines.findIndex((l) => l.includes('[data-palette="mono"][data-theme="dark"]')));
    expect(at).toBeGreaterThan(lines.findIndex((l) => l.includes(':root[data-palette="mono"]:not')));
    const block = lines[at];
    expect(block).toContain('--ui-color-scheme: dark;');
    expect(block).toMatch(/ color-scheme: dark; \}$/);
    const t = designById('modern-mono')!.tokens;
    for (const [k, v] of Object.entries(t)) expect(block).toContain(`--ui-${k}: ${v};`);
  });

  it('lets a component follow the page design for its native parts (scrollbars, form controls)', () => {
    expect(baseCss).toContain('color-scheme: var(--ui-color-scheme, light);');
    expect(baseCss).toContain('color-scheme: var(--ui-color-scheme, dark);');
  });
});

describe('designs/ — what an agent reads to build a site with a design', () => {
  it('has a catalog that names every design, links its folder and says how to apply it', () => {
    const cat = file('README.md');
    expect(cat, 'designs/README.md').toBeDefined();
    for (const d of DESIGNS) {
      expect(cat).toContain(`(${d.id}/README.md)`);
      expect(cat).toContain(`data-design="${d.id}"`);
    }
    expect(cat).toContain('@2lab.ai/ui/tokens.css');
  });

  it('gives every design its spec (DESIGN.md) and its mapping onto the library (README.md, every token named)', () => {
    for (const d of DESIGNS) {
      expect(file(`${d.id}/DESIGN.md`), `designs/${d.id}/DESIGN.md`).toBeDefined();
      const map = file(`${d.id}/README.md`);
      expect(map, `designs/${d.id}/README.md`).toBeDefined();
      expect(map).toContain(`data-design="${d.id}"`);
      expect(map).toContain('(DESIGN.md)');
      for (const k of Object.keys(d.tokens)) expect([d.id, k, map!.includes(`--ui-${k}\``)]).toEqual([d.id, k, true]);
    }
  });

  it('keeps the modern-mono spec as it was handed over (the tone & manner source of truth)', () => {
    const spec = file('modern-mono/DESIGN.md')!;
    expect(spec.startsWith('# Modern Mono UI 기술 명세')).toBe(true);
    expect(spec).toContain('**한 문장 구현 지침:**');
    expect(spec).toContain('](ui-references/2115.jpg)');
  });

  it('is reachable from the repo entry points (AGENTS.md and README.md link the catalog)', () => {
    expect(entry).toHaveLength(2);
    for (const md of entry) expect(md).toContain('designs/README.md');
  });
});
