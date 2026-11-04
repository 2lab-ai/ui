import { describe, expect, it } from 'vitest';
import { OWNER_BADGE_HUES, OWNER_BADGE_ORBIT_MS, ownerBadgeCss, ownerBadgePhase } from './owner-badge';

describe('owner badge', () => {
  it('ownerBadgePhase: a negative delay within one orbit, the same for the same instant', () => {
    expect(ownerBadgePhase(0)).toBe('-0ms');
    expect(ownerBadgePhase(OWNER_BADGE_ORBIT_MS + 100)).toBe('-100ms');
    expect(ownerBadgePhase(5 * OWNER_BADGE_ORBIT_MS - 1)).toBe(`-${OWNER_BADGE_ORBIT_MS - 1}ms`);
    expect(ownerBadgePhase(-100)).toBe(`-${OWNER_BADGE_ORBIT_MS - 100}ms`);
    expect(ownerBadgePhase(1234.6)).toBe('-1235ms');
    expect(ownerBadgePhase()).toMatch(/^-\d+ms$/);
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
    expect(css).toContain('var(--pf-phase, 0ms)');
    // The arc sits under the tint and the text: both pseudo-elements below the pill's content.
    expect(css).toMatch(/\.x\.is-self::after \{[^}]*z-index: -1;/);
    expect(css).toMatch(/\.x\.is-self::before \{[^}]*z-index: -1;/);
  });
});

describe('owner badge — public API (0.27.0)', () => {
  it('the package entry exports the phase, the orbit and the css, so a host can put its own pill on the board’s orbit', async () => {
    const root = await import('../index');
    expect(root.ownerBadgePhase).toBe(ownerBadgePhase);
    expect(root.OWNER_BADGE_ORBIT_MS).toBe(OWNER_BADGE_ORBIT_MS);
    expect(root.OWNER_BADGE_HUES).toBe(OWNER_BADGE_HUES);
    expect(root.ownerBadgeCss).toBe(ownerBadgeCss);
  });
});
