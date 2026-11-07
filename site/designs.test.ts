import { describe, expect, it } from 'vitest';
import { DESIGNS } from '../src/core/tokens';
import { DX_CSS, designsPage, MODEL_ROWS, mountDesignExample, signedPoints } from './designs';

// 0.38.0 — the Designs page's example is the reference an agent copies: page markup drawn from tokens alone.

describe('the example dashboard', () => {
  it('draws its own markup from --ui-* tokens only: no hex, rgb or hsl literal', () => {
    expect(DX_CSS).toContain('var(--ui-');
    expect(DX_CSS).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(DX_CSS).not.toMatch(/\b(?:rgba?|hsla?)\(/i);
  });

  it('signs a change the way the spec does: +, the true minus, <0.1 for a tiny one, a neutral 0.0 only for 0, a dash for no data', () => {
    expect(signedPoints(1.24)).toEqual({ text: '+1.2 pts', trend: 'up' });
    expect(signedPoints(-0.8)).toEqual({ text: '−0.8 pts', trend: 'down' });
    expect(signedPoints(0)).toEqual({ text: '0.0 pts', trend: 'flat' });
    // Smaller than the shown precision: keeps its direction and says how small (DESIGN.md §8) — never a neutral 0.
    expect(signedPoints(-0.04)).toEqual({ text: '\u2212<0.1 pts', trend: 'down' });
    expect(signedPoints(0.04)).toEqual({ text: '+<0.1 pts', trend: 'up' });
    expect(signedPoints(null)).toEqual({ text: '—', trend: 'unknown' });
  });

  it('shows every figure state at once (up, down, flat, not reported) and a pinned and an unpinned row', () => {
    const trends = new Set(MODEL_ROWS.map((r) => signedPoints(r.change).trend));
    expect([...trends].sort()).toEqual(['down', 'flat', 'unknown', 'up']);
    expect(new Set(MODEL_ROWS.map((r) => r.pinned))).toEqual(new Set([true, false]));
  });

  it('mounts library elements and the page parts, and the star toggles its own pressed state', () => {
    const frame = document.createElement('div');
    document.body.append(frame);
    mountDesignExample(frame);
    for (const tag of ['ui-app-bar', 'ui-stat-strip', 'ui-bar-chart', 'ui-tabs', 'ui-task-runs'])
      expect([tag, frame.querySelector(tag) !== null]).toEqual([tag, true]);
    expect(frame.querySelectorAll('.dx-row')).toHaveLength(6);
    expect(frame.querySelector('.dx-dock a[aria-current="page"]')).not.toBeNull();
    const star = frame.querySelector<HTMLButtonElement>('.dx-star[aria-pressed="false"]')!;
    expect(star.getAttribute('aria-label')).toMatch(/^Pin /);
    star.click();
    expect(star.getAttribute('aria-pressed')).toBe('true');
    expect(document.getElementById('dx-css')?.textContent).toBe(DX_CSS);
    frame.remove();
  });

  it('lists every design on the page and puts the first on the example stage', () => {
    const html = designsPage((code) => `<pre>${code}</pre>`);
    for (const d of DESIGNS) expect(html).toContain(`data-design="${d.id}"`);
    expect(html).toContain(`id="stage" data-design="${DESIGNS[0].id}"`);
  });
});
