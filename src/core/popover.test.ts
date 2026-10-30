import { describe, expect, it } from 'vitest';
import { parsePlacement, placePopover } from './popover';

const R = { top: 100, bottom: 130, left: 200, right: 300 };

describe('placePopover', () => {
  it('goes under the anchor, start-aligned, 6px away', () => {
    expect(placePopover(R, 220, 200, 1200, 800)).toEqual({ left: 200, top: 136, side: 'bottom', maxHeight: 784 });
  });
  it('aligns to the end and the centre', () => {
    expect(placePopover(R, 220, 200, 1200, 800, 'bottom', 'end').left).toBe(80);
    expect(placePopover(R, 100, 40, 1200, 800, 'top', 'center')).toMatchObject({ left: 200, top: 54, side: 'top' });
  });
  it('flips to the side with more room', () => {
    const low = { top: 700, bottom: 730, left: 10, right: 60 };
    expect(placePopover(low, 200, 300, 1200, 800).side).toBe('top');
    const high = { top: 10, bottom: 40, left: 10, right: 60 };
    expect(placePopover(high, 200, 100, 1200, 800, 'top').side).toBe('bottom');
  });
  it('stays inside the viewport edge', () => {
    const p = placePopover({ top: 100, bottom: 130, left: 1150, right: 1190 }, 220, 100, 1200, 800);
    expect(p.left).toBe(1200 - 8 - 220);
    expect(placePopover({ top: 100, bottom: 130, left: -40, right: 0 }, 220, 100, 1200, 800).left).toBe(8);
  });
  it('caps a tall overlay to its side and lets it scroll', () => {
    const p = placePopover({ top: 300, bottom: 330, left: 0, right: 10 }, 200, 900, 1200, 800);
    expect(p.side).toBe('bottom');
    expect(p.maxHeight).toBe(800 - 330 - 6 - 8);
  });
});

describe('parsePlacement', () => {
  it('reads side-align with fallbacks', () => {
    const f = { side: 'bottom' as const, align: 'start' as const };
    expect(parsePlacement('top-end', f)).toEqual({ side: 'top', align: 'end' });
    expect(parsePlacement('top', f)).toEqual({ side: 'top', align: 'start' });
    expect(parsePlacement(null, f)).toEqual(f);
    expect(parsePlacement('left-x', f)).toEqual(f);
  });
});
