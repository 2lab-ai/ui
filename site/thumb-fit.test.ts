import { describe, expect, it } from 'vitest';
import { looksCollapsed, THUMB_MIN, THUMB_PAD, thumbFit } from './thumb-fit';

const TILE = { w: 330, h: 230 };

describe('thumbFit — a gallery tile frames its demo', () => {
  it('a small part fits whole at 1:1, centred — real type size, no strip at the top of an empty tile', () => {
    const f = thumbFit(TILE, { w: 220, h: 36 });
    expect(f.scale).toBe(1);
    expect(f.cropped).toBe(false);
    expect(f.x).toBeCloseTo((330 - 220) / 2);
    expect(f.y).toBeCloseTo((230 - 36) / 2);
  });

  it('a part a bit wider than the tile scales down to fit whole, still centred', () => {
    const f = thumbFit(TILE, { w: 400, h: 120 });
    expect(f.scale).toBeCloseTo((330 - THUMB_PAD * 2) / 400);
    expect(f.scale).toBeGreaterThanOrEqual(THUMB_MIN);
    expect(f.cropped).toBe(false);
    expect(f.x + 400 * f.scale).toBeCloseTo(330 - f.x); // symmetric
  });

  it('a tall screen keeps its top and runs off the bottom at a readable scale — never the old 0.56', () => {
    const f = thumbFit(TILE, { w: 560, h: 900 });
    expect(f.scale).toBe(THUMB_MIN);
    expect(f.scale).toBeGreaterThan(0.56);
    expect(f.y).toBe(THUMB_PAD);
    expect(f.x).toBe(THUMB_PAD); // wider than the tile at that scale: left edge kept, right edge cropped
    expect(f.cropped).toBe(true);
  });

  it('a tall but narrow demo is centred horizontally and cropped at the bottom only', () => {
    const f = thumbFit(TILE, { w: 240, h: 700 });
    expect(f.scale).toBe(1);
    expect(f.x).toBeCloseTo((330 - 240) / 2);
    expect(f.y).toBe(THUMB_PAD);
    expect(f.cropped).toBe(true);
  });

  it('a wide, short demo (a bar) runs off the right edge only and sits centred in the height', () => {
    const f = thumbFit(TILE, { w: 560, h: 88 });
    expect(f.scale).toBe(THUMB_MIN);
    expect(f.x).toBe(THUMB_PAD);
    expect(f.y).toBeCloseTo((230 - 88 * THUMB_MIN) / 2);
    expect(f.cropped).toBe(true);
  });

  it('never scales above 1:1', () => {
    expect(thumbFit({ w: 1200, h: 900 }, { w: 100, h: 40 }).scale).toBe(1);
  });

  it('degenerate tile or content sizes do not throw or produce NaN', () => {
    for (const [t, c] of [
      [
        { w: 0, h: 0 },
        { w: 100, h: 100 },
      ],
      [TILE, { w: 0, h: 0 }],
      [TILE, { w: Number.NaN, h: 10 }],
    ] as const) {
      const f = thumbFit(t, c);
      expect(Number.isFinite(f.scale)).toBe(true);
      expect(Number.isFinite(f.x)).toBe(true);
      expect(Number.isFinite(f.y)).toBe(true);
    }
  });

  it('looksCollapsed: a narrow, tall box is a collapsed container part; a small, wide trigger is just small', () => {
    expect(looksCollapsed({ w: 22, h: 900 })).toBe(true); // approval card at no width: a word per line
    expect(looksCollapsed({ w: 82, h: 30 })).toBe(false); // a drawer's trigger button
    expect(looksCollapsed({ w: 180, h: 600 })).toBe(false); // wide enough to be itself
    expect(looksCollapsed({ w: 0, h: 0 })).toBe(false);
    expect(looksCollapsed({ w: Number.NaN, h: 10 })).toBe(true);
  });
});
