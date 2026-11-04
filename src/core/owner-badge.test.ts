import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OWNER_BADGE_HUES,
  OWNER_BADGE_ORBIT_MS,
  OWNER_BADGE_ORBITS,
  ownerBadgeCss,
  syncOwnerBadgeOrbit,
} from './owner-badge';

describe('owner badge', () => {
  it('syncOwnerBadgeOrbit: the orbit starts at the timeline origin; other animations and engines without WAAPI untouched', () => {
    const anims = [
      { animationName: 'ib-badge-orbit', startTime: null as number | null },
      { animationName: 'ui-owner-badge-orbit', startTime: 1234 as number | null },
      { animationName: 'ui-fade-in', startTime: 9 as number | null },
      { animationName: 'host-orbit', startTime: 5 as number | null }, // a host's own: not ours
    ];
    let opts: unknown;
    const el = {
      getAnimations: (o: unknown) => {
        opts = o;
        return anims;
      },
    } as unknown as Element;
    syncOwnerBadgeOrbit(el);
    expect(opts).toEqual({ subtree: true }); // the arc is the pill's ::before
    expect(anims.map((a) => a.startTime)).toEqual([0, 0, 9, 5]);
    // A host that drew the badge under its own prefix names its orbit.
    syncOwnerBadgeOrbit(el, ['host-orbit']);
    expect(anims.map((a) => a.startTime)).toEqual([0, 0, 9, 0]);
    expect(() => syncOwnerBadgeOrbit({} as Element)).not.toThrow();
    expect(OWNER_BADGE_ORBIT_MS).toBe(2400);
  });

  it('ownerBadgeCss: one rule per hue, every colour a token mix, names under the prefix', () => {
    const css = ownerBadgeCss('.x', (n) => `var(--${n})`, 'pf');
    expect(OWNER_BADGE_HUES).toBe(8);
    for (let h = 1; h < OWNER_BADGE_HUES; h++) expect(css).toContain(`.x[data-hue="${h}"] { --pf-hue:`);
    expect(css).not.toContain('[data-hue="8"]');
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(bare).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(bare).not.toMatch(/\b(rgba?|hsla?)\(/i);
    expect(css).toContain('@keyframes pf-orbit');
    expect(css).toContain('animation: pf-orbit 2400ms linear infinite;');
    // The arc sits under the tint and the text: both pseudo-elements below the pill's content.
    expect(css).toMatch(/\.x\.is-self::after \{[^}]*z-index: -1;/);
    expect(css).toMatch(/\.x\.is-self::before \{[^}]*z-index: -1;/);
  });
});

describe('ownerBadgeCss — a selector list', () => {
  it('wraps a list in :is() so .is-self and ::before apply to every member, never to the bare first one', () => {
    const css = ownerBadgeCss('.a, .b', (n) => `var(--${n})`, 'pf');
    expect(css).toContain(':is(.a, .b).is-self::before {');
    expect(css).toContain(':is(.a, .b)[data-hue="3"] {');
    expect(css).not.toMatch(/(^|\n)\.a, \.b\.is-self/);
    // A single selector is used as it is (the board's and the kit's).
    expect(ownerBadgeCss('.x', (n) => `var(--${n})`, 'pf')).toContain('\n.x.is-self::before {');
  });
});

describe('owner badge — public API (0.27.0)', () => {
  it('the package entry exports the orbit, its names, the hues and the css, so a host can put its own pill on the board’s orbit', () => {
    // Read, not imported: the root registers every element (heavy under happy-dom); consumer-check loads it for real.
    const src = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8');
    const m = /export \{([^}]*)\} from '\.\/core\/owner-badge';/.exec(src);
    expect(m).not.toBeNull();
    const names = (m?.[1] ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .sort();
    expect(names).toEqual([
      'OWNER_BADGE_HUES',
      'OWNER_BADGE_ORBITS',
      'OWNER_BADGE_ORBIT_MS',
      'ownerBadgeCss',
      'syncOwnerBadgeOrbit',
    ]);
    expect(OWNER_BADGE_ORBITS).toEqual(['ib-badge-orbit', 'ui-owner-badge-orbit']);
  });
});
