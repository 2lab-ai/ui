import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyViewportVars, readVisualViewport, sameViewportBox, viewportVars, watchVisualViewport } from './viewport';

/** A visual viewport the test moves (the soft keyboard opening, iOS scrolling under it). */
function fakeViewport(height: number, offsetTop = 0) {
  const vv = Object.assign(new EventTarget(), { height, offsetTop });
  vi.stubGlobal('visualViewport', vv);
  return {
    vv,
    move(h: number, top: number, type: 'resize' | 'scroll' = 'resize') {
      vv.height = h;
      vv.offsetTop = top;
      vv.dispatchEvent(new Event(type));
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readVisualViewport', () => {
  it('rounds the height and top and never goes above the layout top', () => {
    expect(readVisualViewport({ height: 512.4, offsetTop: 120.6 })).toEqual({ height: 512, top: 121 });
    expect(readVisualViewport({ height: 600, offsetTop: -3 })).toEqual({ height: 600, top: 0 });
  });
  it('is null without a viewport or with a nonsense one', () => {
    expect(readVisualViewport(null)).toBeNull();
    expect(readVisualViewport({ height: 0, offsetTop: 0 })).toBeNull();
    expect(readVisualViewport({ height: Number.NaN, offsetTop: 0 })).toBeNull();
    expect(readVisualViewport({ height: 500, offsetTop: Number.NaN })).toBeNull();
  });
  it('reads window.visualViewport by default', () => {
    fakeViewport(480, 64);
    expect(readVisualViewport()).toEqual({ height: 480, top: 64 });
  });
});

describe('viewportVars / applyViewportVars', () => {
  it('writes and removes --ui-vv-h and --ui-vv-top', () => {
    expect(viewportVars({ height: 480, top: 64 })).toBe('--ui-vv-h: 480px; --ui-vv-top: 64px');
    expect(viewportVars(null)).toBe('');
    const el = document.createElement('div');
    applyViewportVars(el, { height: 480, top: 64 });
    expect(el.style.getPropertyValue('--ui-vv-h')).toBe('480px');
    expect(el.style.getPropertyValue('--ui-vv-top')).toBe('64px');
    applyViewportVars(el, null);
    expect(el.style.getPropertyValue('--ui-vv-h')).toBe('');
    expect(el.hasAttribute('style')).toBe(false);
    // Other inline styles stay.
    el.style.color = 'red';
    applyViewportVars(el, { height: 1, top: 0 });
    applyViewportVars(el, null);
    expect(el.style.color).toBe('red');
    expect(() => applyViewportVars(null, null)).not.toThrow();
  });
  it('sameViewportBox compares values', () => {
    expect(sameViewportBox(null, null)).toBe(true);
    expect(sameViewportBox({ height: 1, top: 2 }, { height: 1, top: 2 })).toBe(true);
    expect(sameViewportBox({ height: 1, top: 2 }, { height: 1, top: 3 })).toBe(false);
    expect(sameViewportBox({ height: 1, top: 2 }, null)).toBe(false);
  });
});

describe('watchVisualViewport', () => {
  it('calls back now, on every change of box (resize or scroll), and stops', () => {
    const f = fakeViewport(800, 0);
    const seen: unknown[] = [];
    const stop = watchVisualViewport((b) => seen.push(b));
    expect(seen).toEqual([{ height: 800, top: 0 }]);
    f.move(420, 0); // the keyboard opens
    f.move(420, 180, 'scroll'); // iOS scrolls the page under it
    f.move(420, 180); // same box: no call
    expect(seen).toEqual([
      { height: 800, top: 0 },
      { height: 420, top: 0 },
      { height: 420, top: 180 },
    ]);
    stop();
    f.move(800, 0);
    expect(seen).toHaveLength(3);
  });
  it('without the API: one null, a no-op stop', () => {
    vi.stubGlobal('visualViewport', undefined);
    const seen: unknown[] = [];
    const stop = watchVisualViewport((b) => seen.push(b));
    expect(seen).toEqual([null]);
    expect(() => stop()).not.toThrow();
  });
});
