import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import {
  type AsciiWakeData,
  asciiCool,
  asciiCubeMask,
  asciiFieldMask,
  asciiGlyphIndex,
  asciiGrid,
  asciiHash,
  asciiLightInk,
  asciiRamp,
  asciiRing,
  type UiAsciiWake,
} from './ascii-wake';
import { doc } from './docs';
import { styles } from './styles';

const XSS = '<img src=x onerror=alert(1)>';
const HALF_W = Math.cos(Math.PI / 6) * 112;

// ── Fakes: a rAF clock the test drives, observers it fires, media queries it flips ────────────────────────────────

let frames: Map<number, FrameRequestCallback>;
let frameId = 0;
let rafCalls = 0;
let clock = 0;
let cancelled: number[] = [];
let reduce = false;
let dark = false;
let media: Map<string, Set<() => void>>;

class FakeRO {
  static all: FakeRO[] = [];
  targets: Element[] = [];
  disconnected = false;
  constructor(readonly cb: ResizeObserverCallback) {
    FakeRO.all.push(this);
  }
  observe(t: Element) {
    this.targets.push(t);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  fire(width: number, height: number) {
    this.cb([{ contentRect: { width, height } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

class FakeIO {
  static all: FakeIO[] = [];
  disconnected = false;
  constructor(readonly cb: IntersectionObserverCallback) {
    FakeIO.all.push(this);
  }
  observe() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
  disconnect() {
    this.disconnected = true;
  }
  fire(isIntersecting: boolean) {
    this.cb([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

class FakeMO {
  static all: FakeMO[] = [];
  targets: Array<[Node, MutationObserverInit | undefined]> = [];
  disconnected = false;
  constructor(readonly cb: MutationCallback) {
    FakeMO.all.push(this);
  }
  observe(t: Node, o?: MutationObserverInit) {
    this.targets.push([t, o]);
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    this.disconnected = true;
  }
}

function listeners(q: string): Set<() => void> {
  let s = media.get(q);
  if (!s) {
    s = new Set();
    media.set(q, s);
  }
  return s;
}
function flip(q: string): void {
  for (const fn of Array.from(listeners(q))) fn();
}

/** A 2D context that records what was drawn: dots (arcs, with their radii) and glyphs. */
function paint() {
  const drawn = { arcs: [] as number[], glyphs: [] as string[], fills: 0, clears: 0 };
  const ctx = {
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
    setTransform() {},
    clearRect() {
      drawn.clears++;
      drawn.arcs.length = 0;
      drawn.glyphs.length = 0;
    },
    beginPath() {},
    moveTo() {},
    arc(_x: number, _y: number, r: number) {
      drawn.arcs.push(r);
    },
    fill() {
      drawn.fills++;
    },
    fillText(t: string) {
      drawn.glyphs.push(t);
    },
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => ctx as unknown as CanvasRenderingContext2D,
  );
  return { ctx, drawn };
}

beforeEach(() => {
  document.body.innerHTML = '';
  frames = new Map();
  frameId = 0;
  rafCalls = 0;
  clock = 1000;
  cancelled = [];
  reduce = false;
  dark = false;
  media = new Map();
  FakeRO.all = [];
  FakeIO.all = [];
  FakeMO.all = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCalls++;
    frames.set(++frameId, cb);
    return frameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    cancelled.push(id);
    frames.delete(id);
  });
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      if (query.includes('prefers-reduced-motion')) return reduce;
      if (query.includes('prefers-color-scheme')) return dark;
      return false;
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => listeners(query).add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners(query).delete(fn),
  }));
  vi.stubGlobal('ResizeObserver', FakeRO);
  vi.stubGlobal('IntersectionObserver', FakeIO);
  vi.stubGlobal('MutationObserver', FakeMO);
});

afterEach(() => {
  document.body.innerHTML = '';
  Reflect.deleteProperty(document, 'hidden');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mount(attrs: Record<string, string> = {}, data?: AsciiWakeData): UiAsciiWake {
  const el = document.createElement('ui-ascii-wake');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (data) el.data = data;
  document.body.append(el);
  el.renderNow();
  return el;
}
const ro = (el: Element) => FakeRO.all.find((r) => r.targets.includes(el))!;
/** Mount and give it a box (the ResizeObserver's first report). */
function sized(attrs: Record<string, string> = {}, data?: AsciiWakeData, w = 360, h = 240): UiAsciiWake {
  const el = mount(attrs, data);
  ro(el).fire(w, h);
  return el;
}
const field = (el: UiAsciiWake) => el.shadowRoot!.querySelector<HTMLElement>('.aw')!;
const ptr = (el: Element, type: string, x: number, y: number, init: PointerEventInit = {}) =>
  el.dispatchEvent(
    new PointerEvent(type, {
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: 'mouse',
      bubbles: true,
      composed: true,
      ...init,
    }),
  );
/** Run the frames that are due, `ms` later. True when one ran. */
function step(ms = 16): boolean {
  const due = Array.from(frames.values());
  frames.clear();
  clock += ms;
  for (const cb of due) cb(clock);
  return due.length > 0;
}
/** Run frames until none is scheduled; how many ran. */
function settle(max = 2000): number {
  let n = 0;
  while (frames.size && n < max) {
    step();
    n++;
  }
  return n;
}

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────

describe('helpers', () => {
  it('ramps: classic, blocks, dots, binary — any case; anything else is classic; index 0 is blank', () => {
    expect(asciiRamp('classic').join('')).toBe(' .:-=+*#%@');
    expect(asciiRamp('Blocks').join('')).toBe(' ·░▒▓█');
    expect(asciiRamp('DOTS').join('')).toBe(' ·•●');
    expect(asciiRamp(' binary ').join('')).toBe(' .:01');
    expect(asciiRamp('nope')).toBe(asciiRamp('classic'));
    expect(asciiRamp(undefined)).toBe(asciiRamp('classic'));
    expect(asciiRamp('constructor')).toBe(asciiRamp('classic'));
    expect(Object.isFrozen(asciiRamp('classic'))).toBe(true);
  });

  it('cube mask: three faces shaded their own way, flipped for light ink; 0 outside; 1 on an edge', () => {
    const top = [0, -56] as const;
    const left = [-HALF_W / 2, 28] as const;
    const right = [HALF_W / 2, 28] as const;
    // Light ink (a dark page): the top face reads brightest.
    expect(asciiCubeMask(...top, true)).toBeCloseTo(0.35 + 0.65 * 0.91, 6);
    expect(asciiCubeMask(...left, true)).toBeCloseTo(0.35 + 0.65 * 0.5, 6);
    expect(asciiCubeMask(...right, true)).toBeCloseTo(0.35 + 0.65 * 0.105, 6);
    // Dark ink (a light page): the same faces, inverted — the top now the faintest.
    expect(asciiCubeMask(...top, false)).toBeCloseTo(0.35 + 0.65 * 0.18, 6);
    expect(asciiCubeMask(...left, false)).toBeCloseTo(0.35 + 0.65 * 0.59, 6);
    expect(asciiCubeMask(...right, false)).toBeCloseTo(0.35 + 0.65 * 0.985, 6);
    expect(asciiCubeMask(...top, true)).toBeGreaterThan(asciiCubeMask(...right, true));
    expect(asciiCubeMask(...top, false)).toBeLessThan(asciiCubeMask(...right, false));
    // Outside the hexagon.
    for (const [x, y] of [
      [0, -120],
      [120, 0],
      [-120, 0],
      [0, 120],
      [170, 110],
      [Number.NaN, 0],
    ])
      expect(asciiCubeMask(x, y, true)).toBe(0);
    // On an edge: the middle vertical, the left silhouette, the top face's inner edge — full ink either way.
    for (const light of [true, false]) {
      expect(asciiCubeMask(0.5, 60, light)).toBe(1);
      expect(asciiCubeMask(-HALF_W + 1, 0, light)).toBe(1);
      expect(asciiCubeMask(0, -1, light)).toBe(1);
    }
    // Every face value sits between 0.35 and 1.
    for (let y = -110; y <= 110; y += 7)
      for (let x = -95; x <= 95; x += 7) {
        const m = asciiCubeMask(x, y, x > 0);
        expect(m === 0 || (m >= 0.35 && m <= 1)).toBe(true);
      }
  });

  it('field mask: 1 inside, easing to 0 at each edge, 0 outside or for an empty box', () => {
    expect(asciiFieldMask(180, 120, 360, 240)).toBe(1);
    expect(asciiFieldMask(48, 120, 360, 240)).toBe(1);
    expect(asciiFieldMask(0, 120, 360, 240)).toBe(0);
    expect(asciiFieldMask(360, 120, 360, 240)).toBe(0);
    expect(asciiFieldMask(24, 120, 360, 240)).toBeCloseTo(0.5, 6);
    expect(asciiFieldMask(12, 120, 360, 240)).toBeCloseTo(0.15625, 6);
    expect(asciiFieldMask(24, 24, 360, 240)).toBeCloseTo(0.25, 6);
    let last = -1;
    for (let x = 0; x <= 60; x += 4) {
      const m = asciiFieldMask(x, 120, 360, 240);
      expect(m).toBeGreaterThanOrEqual(last);
      last = m;
    }
    expect(asciiFieldMask(-1, 10, 360, 240)).toBe(0);
    expect(asciiFieldMask(10, 241, 360, 240)).toBe(0);
    expect(asciiFieldMask(5, 5, 0, 240)).toBe(0);
    // A small box fades over a quarter of its short side.
    expect(asciiFieldMask(10, 20, 80, 40)).toBe(1);
  });

  it('grid: cells of 0.62 × 0.82 of the size, as many as fit with the odd-row shift, centred', () => {
    const g = asciiGrid(360, 240, 10);
    expect(g.cols).toBe(57);
    expect(g.rows).toBe(29);
    expect(g.cw).toBeCloseTo(6.2, 6);
    expect(g.ch).toBeCloseTo(8.2, 6);
    expect(g.ox).toBeCloseTo(1.75, 6);
    expect(g.oy).toBeCloseTo(1.1, 6);
    for (const [w, h, size] of [
      [360, 240, 10],
      [604, 260, 8],
      [180, 150, 20],
      [97, 33, 13],
    ]) {
      const { cols, rows, cw, ch, ox, oy } = asciiGrid(w, h, size);
      expect(cols).toBeGreaterThan(0);
      expect(rows).toBeGreaterThan(0);
      // Every cell's box — even rows, and odd rows half a cell right — sits inside, the block centred.
      expect(ox).toBeGreaterThanOrEqual(0);
      expect(ox + (cols + 0.5) * cw).toBeLessThanOrEqual(w + 1e-9);
      expect(ox).toBeCloseTo(w - (ox + (cols + 0.5) * cw), 9);
      expect(oy).toBeGreaterThanOrEqual(0);
      expect(oy + rows * ch).toBeLessThanOrEqual(h + 1e-9);
      expect(oy).toBeCloseTo((h - rows * ch) / 2, 9);
      // No room was left for another column or row.
      expect(ox * 2).toBeLessThan(cw);
      expect(oy * 2).toBeLessThan(ch);
    }
    expect(asciiGrid(0, 240, 10)).toMatchObject({ cols: 0, rows: 0 });
    expect(asciiGrid(360, -5, 10)).toMatchObject({ cols: 0, rows: 0 });
    expect(asciiGrid(Number.NaN, 240, 10)).toMatchObject({ cols: 0, rows: 0 });
  });

  it('cooling: e^(−3·dt/trail), and under 0.003 it is cold', () => {
    expect(asciiCool(1, 0.05, 1.2)).toBeCloseTo(Math.exp(-0.125), 9);
    expect(asciiCool(0.5, 1, 1.2)).toBeCloseTo(0.5 * Math.exp(-2.5), 9);
    expect(asciiCool(0.5, 0, 1.2)).toBe(0.5);
    expect(asciiCool(0.00305, 0.05, 1.2)).toBe(0);
    expect(asciiCool(0.0031, 0.01, 1.2)).toBeCloseTo(0.0031 * Math.exp(-0.025), 9);
    expect(asciiCool(0, 0.016, 1.2)).toBe(0);
    // A longer trail cools slower.
    expect(asciiCool(1, 0.05, 4)).toBeGreaterThan(asciiCool(1, 0.05, 0.2));
    // From full heat, 1.2 s of trail is cold by about 2.3 s.
    let h = 1;
    let t = 0;
    while (h > 0) {
      h = asciiCool(h, 0.016, 1.2);
      t += 0.016;
    }
    expect(t).toBeGreaterThan(2.2);
    expect(t).toBeLessThan(2.5);
  });

  it('ring: the radius eases out from 8 to 268, the heat rises fast and fades to nothing', () => {
    expect(asciiRing(0)).toEqual({ R: 8, amp: 0 });
    expect(asciiRing(1)).toEqual({ R: 268, amp: 0 });
    expect(asciiRing(0.5).R).toBeCloseTo(8 + 0.875 * 260, 9);
    expect(asciiRing(0.5).amp).toBeCloseTo(0.15, 9);
    expect(asciiRing(1 / 6).amp).toBeCloseTo(0.6 * (5 / 6) ** 2, 9);
    let r = 0;
    let peak = 0;
    for (let t = 0; t <= 1; t += 0.01) {
      const { R, amp } = asciiRing(t);
      expect(R).toBeGreaterThanOrEqual(r);
      r = R;
      peak = Math.max(peak, amp);
      expect(amp).toBeGreaterThanOrEqual(0);
      expect(amp).toBeLessThanOrEqual(0.6);
    }
    expect(peak).toBeCloseTo(0.6 * (5 / 6) ** 2, 2);
    expect(asciiRing(-1)).toEqual(asciiRing(0));
    expect(asciiRing(3)).toEqual(asciiRing(1));
  });

  it('glyph index: heat up the ramp, jittered once warm, always 1 … length − 1', () => {
    expect(asciiGlyphIndex(0, 10, 0.5)).toBe(1);
    expect(asciiGlyphIndex(0.03, 10, 0)).toBe(1);
    expect(asciiGlyphIndex(0.5, 10, 0.5)).toBe(5);
    expect(asciiGlyphIndex(1, 10, 0.5)).toBe(9);
    expect(asciiGlyphIndex(5, 10, 0)).toBe(8);
    expect(asciiGlyphIndex(1, 4, 0.5)).toBe(3);
    expect(asciiGlyphIndex(0.3, 4, 0.5)).toBe(1);
    // The dither moves a warm cell's pick, never a cold one's.
    expect(asciiGlyphIndex(0.5, 10, 0)).toBeLessThan(asciiGlyphIndex(0.5, 10, 0.99));
    expect(asciiGlyphIndex(0.04, 10, 0)).toBe(asciiGlyphIndex(0.04, 10, 0.99));
    for (const len of [4, 5, 6, 10])
      for (let h = 0; h <= 2; h += 0.05)
        for (let d = 0; d < 1; d += 0.1) {
          const g = asciiGlyphIndex(h, len, d);
          expect(g).toBeGreaterThanOrEqual(1);
          expect(g).toBeLessThanOrEqual(len - 1);
        }
    expect(asciiGlyphIndex(Number.NaN, 10, Number.NaN)).toBe(1);
  });

  it('hash: in [0, 1), the same for the same cell and deal, re-dealt by the deal', () => {
    let sum = 0;
    for (let i = 0; i < 2000; i++)
      for (let deal = 0; deal < 5; deal++) {
        const v = asciiHash(i, deal);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
        sum += v;
      }
    expect(sum / 10_000).toBeGreaterThan(0.45);
    expect(sum / 10_000).toBeLessThan(0.55);
    expect(asciiHash(42, 7)).toBe(asciiHash(42, 7));
    expect(asciiHash(42, 7)).not.toBe(asciiHash(42, 8));
    expect(asciiHash(1e6, 1e6)).toBeLessThan(1);
  });

  it('light ink: the luminance of a computed colour over 128', () => {
    expect(asciiLightInk('rgb(255, 255, 255)')).toBe(true);
    expect(asciiLightInk('rgb(147, 147, 155)')).toBe(true); // --text-tertiary, dark
    expect(asciiLightInk('rgb(104, 104, 111)')).toBe(false); // --text-tertiary, light
    expect(asciiLightInk('rgba(0, 0, 0, 0.5)')).toBe(false);
    expect(asciiLightInk('rgb(100% 100% 100%)')).toBe(true);
    expect(asciiLightInk('#fff')).toBe(true);
    expect(asciiLightInk('#000000')).toBe(false);
    expect(asciiLightInk('color(srgb 0.9 0.9 0.9 / 0.55)')).toBe(true);
    expect(asciiLightInk('color(display-p3 0.1 0.1 0.1)')).toBe(false);
    expect(asciiLightInk('oklch(0.82 0.02 260)')).toBe(true);
    expect(asciiLightInk('lab(20 0 0)')).toBe(false);
    expect(asciiLightInk('')).toBe(false);
    expect(asciiLightInk('currentcolor')).toBe(false);
  });
});

// ── The element ──────────────────────────────────────────────────────────────────────────────────────────────────

describe('<ui-ascii-wake>', () => {
  it('renders one canvas inside an image named for what it is; the canvas is hidden; it is never focusable', () => {
    const el = sized();
    const f = field(el);
    const canvas = el.shadowRoot!.querySelector('canvas')!;
    expect(f.getAttribute('role')).toBe('img');
    expect(f.getAttribute('aria-label')).toBe('A field of dots stirred by the pointer');
    expect(f.hasAttribute('aria-hidden')).toBe(false);
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    expect(el.shadowRoot!.querySelectorAll('canvas').length).toBe(1);
    expect(el.hasAttribute('tabindex')).toBe(false);
    expect(el.shadowRoot!.querySelector('[tabindex], button, a, input')).toBeNull();
    // Later renders patch the name, never the canvas.
    el.setAttribute('glyphs', 'dots');
    el.setAttribute('label', 'Empty board');
    el.renderNow();
    expect(el.shadowRoot!.querySelector('canvas')).toBe(canvas);
    expect(field(el)).toBe(f);
    expect(f.getAttribute('aria-label')).toBe('Empty board');
  });

  it('names itself in Korean, takes the host’s label (escaped), and hides itself when decorative', () => {
    const ko = mount({ lang: 'ko' });
    expect(field(ko).getAttribute('aria-label')).toBe('포인터에 반응하는 점 무늬');
    const own = mount({ label: XSS });
    expect(field(own).getAttribute('aria-label')).toBe(XSS);
    expect(own.shadowRoot!.querySelector('img')).toBeNull();
    const data = mount({ label: 'attr' }, { label: `  ${XSS} sign-in  ` });
    expect(field(data).getAttribute('aria-label')).toBe(`${XSS} sign-in`);
    const blank = mount({ label: '   ' });
    expect(field(blank).getAttribute('aria-label')).toBe('A field of dots stirred by the pointer');
    const deco = mount({ decorative: '', label: 'ignored' });
    expect(field(deco).getAttribute('aria-hidden')).toBe('true');
    expect(field(deco).hasAttribute('role')).toBe(false);
    expect(field(deco).hasAttribute('aria-label')).toBe(false);
    deco.removeAttribute('decorative');
    deco.renderNow();
    expect(field(deco).getAttribute('role')).toBe('img');
    expect(field(deco).getAttribute('aria-label')).toBe('ignored');
    expect(field(deco).hasAttribute('aria-hidden')).toBe(false);
    deco.data = { decorative: true };
    deco.renderNow();
    expect(field(deco).getAttribute('aria-hidden')).toBe('true');
  });

  it('reads options from data, then attributes, each clamped to its range', () => {
    expect(mount().options).toEqual({
      shape: 'cube',
      glyphs: 'classic',
      trail: 1.2,
      reach: 50,
      pull: 40,
      size: 10,
      activity: 0,
    });
    const el = mount({
      shape: 'FIELD',
      glyphs: 'Binary',
      trail: '9',
      reach: '-5',
      pull: '150',
      size: '30',
      activity: '2',
    });
    expect(el.options).toEqual({
      shape: 'field',
      glyphs: 'binary',
      trail: 4,
      reach: 0,
      pull: 100,
      size: 20,
      activity: 1,
    });
    el.setAttribute('trail', '0');
    el.setAttribute('size', '2');
    el.setAttribute('activity', 'soon');
    el.setAttribute('glyphs', 'emoji');
    el.setAttribute('shape', 'sphere');
    el.setAttribute('reach', '');
    expect(el.options).toMatchObject({
      trail: 0.2,
      size: 8,
      activity: 0,
      glyphs: 'classic',
      shape: 'cube',
      reach: 50,
    });
    el.data = { trail: 2, size: 14, activity: 0.25, glyphs: 'dots', pull: Number.NaN };
    expect(el.options).toMatchObject({ trail: 2, size: 14, activity: 0.25, glyphs: 'dots', pull: 40 });
  });

  it('sizes the canvas to the content box × devicePixelRatio, at most 2', () => {
    vi.stubGlobal('devicePixelRatio', 1.5);
    const el = sized({}, undefined, 300, 200);
    const canvas = el.shadowRoot!.querySelector('canvas')!;
    expect([canvas.width, canvas.height]).toEqual([450, 300]);
    vi.stubGlobal('devicePixelRatio', 3);
    ro(el).fire(360, 240);
    expect([canvas.width, canvas.height]).toEqual([720, 480]);
  });

  it('draws the cold mask once and schedules nothing while idle', () => {
    const { ctx, drawn } = paint();
    const el = sized();
    FakeIO.all[0].fire(true);
    expect(rafCalls).toBe(0);
    expect(el.running).toBe(false);
    expect(drawn.glyphs).toEqual([]);
    const cube = drawn.arcs.length;
    expect(cube).toBeGreaterThan(200);
    expect(ctx.font).toMatch(/^500 10px /);
    // Option and theme changes repaint in place, still without a frame loop.
    el.setAttribute('glyphs', 'blocks');
    el.setAttribute('shape', 'field');
    el.setAttribute('theme', 'dark');
    el.renderNow();
    expect(rafCalls).toBe(0);
    // The field: every cell of the 57 × 29 grid is ink (the edges only fade).
    expect(drawn.arcs.length).toBe(57 * 29);
    expect(drawn.arcs.length).toBeGreaterThan(cube);
  });

  it('under reduced motion: one still frame — no wake, no ring, no stirring, no sound', async () => {
    const spy: SoundSpy = soundSpy();
    try {
      reduce = true;
      const { drawn } = paint();
      const el = sized({ activity: '1' });
      ptr(el, 'pointerenter', 180, 120, { bubbles: false });
      ptr(el, 'pointermove', 200, 130);
      ptr(el, 'pointerdown', 200, 130);
      ptr(el, 'pointerleave', 400, 130, { bubbles: false });
      el.data = { activity: 0.9 };
      el.renderNow();
      expect(rafCalls).toBe(0);
      expect(el.running).toBe(false);
      expect(drawn.glyphs).toEqual([]);
      expect(drawn.arcs.length).toBeGreaterThan(200);
      await spy.settle();
      expect(spy.calls).toEqual([]);
    } finally {
      spy.restore();
    }
  });

  it('a pointer starts the loop; it stops once every cell is cold and the hand has settled', () => {
    const { drawn } = paint();
    const el = sized();
    ptr(el, 'pointerenter', 180, 120, { bubbles: false });
    ptr(el, 'pointermove', 200, 120);
    ptr(el, 'pointermove', 220, 130);
    expect(el.running).toBe(true);
    expect(frames.size).toBe(1);
    // More moves never stack frames.
    ptr(el, 'pointermove', 222, 131);
    expect(frames.size).toBe(1);
    step();
    // Under the hand the dots have warmed into glyphs from the ramp.
    expect(drawn.glyphs.length).toBeGreaterThan(0);
    for (const g of drawn.glyphs) expect(asciiRamp('classic').slice(2)).toContain(g);
    const n = settle();
    expect(n).toBeGreaterThan(120); // the wake takes ~2.3 s to cool at trail 1.2
    expect(n).toBeLessThan(200);
    expect(el.running).toBe(false);
    // The hand rests inside: its own glow stays drawn, still.
    expect(drawn.glyphs.length).toBeGreaterThan(0);
    // It leaves: the glow eases out, and the loop stops again with only dots.
    ptr(el, 'pointerleave', 400, 130, { bubbles: false });
    expect(el.running).toBe(true);
    const out = settle();
    expect(out).toBeGreaterThan(30);
    expect(out).toBeLessThan(120);
    expect(el.running).toBe(false);
    expect(drawn.glyphs).toEqual([]);
  });

  it('a longer trail keeps the wake warm longer', () => {
    const a = sized({ trail: '0.4' });
    ptr(a, 'pointermove', 180, 120);
    ptr(a, 'pointerleave', 400, 120, { bubbles: false });
    const short = settle();
    document.body.innerHTML = '';
    const b = sized({ trail: '3' });
    ptr(b, 'pointermove', 180, 120);
    ptr(b, 'pointerleave', 400, 120, { bubbles: false });
    expect(settle()).toBeGreaterThan(short * 2);
  });

  it('activity above 0 keeps the loop running and stirs glyphs with no pointer; back at 0 it cools and stops', () => {
    const { drawn } = paint();
    const el = sized({ shape: 'field' }, undefined, 600, 260);
    el.setAttribute('activity', '0.8');
    el.renderNow();
    expect(el.running).toBe(true);
    let most = 0;
    for (let i = 0; i < 300; i++) {
      expect(step()).toBe(true);
      most = Math.max(most, drawn.glyphs.length);
    }
    expect(el.running).toBe(true);
    expect(most).toBeGreaterThan(0);
    // A data update (the token rate) does not stack frames.
    el.data = { activity: 0.6 };
    el.renderNow();
    expect(frames.size).toBe(1);
    el.data = { activity: 0 };
    el.renderNow();
    expect(el.running).toBe(true); // still warm
    const n = settle();
    expect(n).toBeLessThan(200);
    expect(el.running).toBe(false);
    expect(drawn.glyphs).toEqual([]);
  });

  it('a press sends a ring that lives 2.2 s and plays a subtle tap', async () => {
    const spy = soundSpy();
    try {
      const { drawn } = paint();
      const el = sized();
      ptr(el, 'pointerdown', 180, 120);
      expect(el.running).toBe(true);
      let glyphs = 0;
      for (let i = 0; i < 20; i++) {
        step();
        glyphs = Math.max(glyphs, drawn.glyphs.length);
      }
      expect(glyphs).toBeGreaterThan(0);
      const n = settle() + 20;
      expect(n * 0.016).toBeGreaterThan(2.1);
      expect(n * 0.016).toBeLessThan(2.35);
      await spy.settle();
      expect(spy.calls).toEqual([['tap', { emphasis: 'subtle', input: 'mouse' }]]);
      // Moving through it is silent.
      ptr(el, 'pointermove', 100, 100);
      ptr(el, 'pointermove', 140, 110);
      await spy.settle();
      expect(spy.calls.length).toBe(1);
    } finally {
      spy.restore();
    }
  });

  it('a touch sends its ring when it lifts where it landed — never for a scroll or a drag', async () => {
    const spy = soundSpy();
    try {
      const el = sized();
      const touch = { pointerType: 'touch', pointerId: 7 };
      ptr(el, 'pointerdown', 100, 100, touch);
      expect(el.running).toBe(false);
      ptr(el, 'pointerup', 104, 102, touch);
      expect(el.running).toBe(true);
      settle();
      await spy.settle();
      expect(spy.calls).toEqual([['tap', { emphasis: 'subtle', input: 'touch' }]]);
      // A drag: it lifts far from where it landed.
      ptr(el, 'pointerdown', 100, 100, touch);
      ptr(el, 'pointerup', 160, 100, touch);
      // A scroll: the browser takes the touch (pointercancel), then the finger lifts.
      ptr(el, 'pointerdown', 100, 100, touch);
      ptr(el, 'pointercancel', 100, 100, touch);
      settle();
      ptr(el, 'pointerup', 100, 100, touch);
      expect(el.running).toBe(false);
      await spy.settle();
      expect(spy.calls.length).toBe(1);
    } finally {
      spy.restore();
    }
  });

  it('pauses offscreen and in a hidden tab, and picks up again when shown', () => {
    const el = sized({ activity: '0.5' });
    expect(el.running).toBe(true);
    const io = FakeIO.all[0];
    io.fire(false);
    expect(el.running).toBe(false);
    expect(cancelled.length).toBe(1);
    expect(step()).toBe(false);
    // Nothing restarts it while offscreen — not even a new activity.
    el.data = { activity: 0.9 };
    el.renderNow();
    expect(el.running).toBe(false);
    io.fire(true);
    expect(el.running).toBe(true);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(el.running).toBe(false);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(el.running).toBe(true);
    // Shown again with nothing moving: nothing starts.
    const idle = sized();
    expect(idle.running).toBe(false);
    FakeIO.all[1].fire(false);
    FakeIO.all[1].fire(true);
    expect(idle.running).toBe(false);
  });

  it('turning reduced motion on mid-wake stops the loop and draws the still frame', () => {
    const { drawn } = paint();
    const el = sized({ activity: '1' });
    for (let i = 0; i < 60; i++) step();
    expect(el.running).toBe(true);
    reduce = true;
    flip('(prefers-reduced-motion: reduce)');
    el.renderNow();
    expect(el.running).toBe(false);
    expect(drawn.glyphs).toEqual([]);
    expect(frames.size).toBe(0);
  });

  it('disconnecting cancels the frame and every observer and listener', () => {
    const removed = vi.spyOn(document, 'removeEventListener');
    const el = sized({ activity: '0.7' });
    expect(el.running).toBe(true);
    const id = frameId;
    el.remove();
    expect(cancelled).toContain(id);
    expect(frames.size).toBe(0);
    expect(el.running).toBe(false);
    expect(ro(el).disconnected).toBe(true);
    expect(FakeIO.all[0].disconnected).toBe(true);
    expect(FakeMO.all[0].disconnected).toBe(true);
    for (const set of Array.from(media.values())) expect(set.size).toBe(0);
    expect(removed.mock.calls.some(([type]) => type === 'visibilitychange')).toBe(true);
    // Back in the page: it watches again and resumes the activity.
    document.body.append(el);
    el.renderNow();
    expect(el.running).toBe(true);
    expect(FakeRO.all.length).toBe(2);
  });

  it('does not throw without a 2D context (null or throwing) — the loop still runs and stops', () => {
    const plain = sized();
    ptr(plain, 'pointerenter', 180, 120, { bubbles: false });
    ptr(plain, 'pointermove', 220, 120);
    ptr(plain, 'pointerdown', 220, 120);
    expect(() => settle()).not.toThrow();
    expect(plain.running).toBe(false);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('no canvas here');
    });
    expect(() => {
      const el = sized({ activity: '0.4' });
      for (let i = 0; i < 10; i++) step();
      el.data = { activity: 0 };
      el.renderNow();
      settle();
    }).not.toThrow();
  });

  it('reads its ink once — again only when the theme may have changed, never per frame', () => {
    let ink = 'rgb(104, 104, 111)';
    const gcs = vi.spyOn(window, 'getComputedStyle').mockImplementation(
      () =>
        ({
          color: ink,
          getPropertyValue: (n: string) => (n === '--mono' ? "'Test Mono', monospace" : ''),
        }) as unknown as CSSStyleDeclaration,
    );
    const { ctx, drawn } = paint();
    const el = sized({ activity: '0.5' });
    expect(gcs).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 40; i++) step();
    expect(ctx.fillStyle).toBe('rgb(104, 104, 111)');
    expect(ctx.font).toBe("500 10px 'Test Mono', monospace");
    el.data = { activity: 0.6 };
    el.renderNow();
    expect(gcs).toHaveBeenCalledTimes(1);
    // The host's theme attribute: dark ink turns light, and the cube's faces shade the other way.
    el.data = { activity: 0 };
    el.renderNow();
    settle();
    const before = drawn.arcs.reduce((a, b) => a + b, 0);
    ink = 'rgb(147, 147, 155)';
    el.setAttribute('theme', 'dark');
    el.renderNow();
    expect(gcs).toHaveBeenCalledTimes(2);
    expect(ctx.fillStyle).toBe('rgb(147, 147, 155)');
    expect(drawn.arcs.reduce((a, b) => a + b, 0)).not.toBeCloseTo(before, 3);
    // data-theme on the page (and on the nearest themed ancestor).
    const mo = FakeMO.all[0];
    const [target, init] = mo.targets[0];
    expect(target).toBe(document.documentElement);
    expect(init?.attributeFilter).toContain('data-theme');
    mo.cb([], mo as unknown as MutationObserver);
    el.renderNow();
    expect(gcs).toHaveBeenCalledTimes(3);
    // The colour scheme.
    flip('(prefers-color-scheme: dark)');
    el.renderNow();
    expect(gcs).toHaveBeenCalledTimes(4);
    // A new size changes the font, not the ink.
    el.setAttribute('size', '14');
    el.renderNow();
    expect(gcs).toHaveBeenCalledTimes(4);
    expect(ctx.font).toBe("500 14px 'Test Mono', monospace");
  });

  it('watches the nearest themed ancestor too (a preview stage switches its own data-theme)', () => {
    const stage = document.createElement('div');
    stage.setAttribute('data-theme', 'light');
    document.body.append(stage);
    const el = document.createElement('ui-ascii-wake');
    stage.append(el);
    el.renderNow();
    const targets = FakeMO.all[0].targets.map(([t]) => t);
    expect(targets).toEqual([document.documentElement, stage]);
  });

  it('styles: fills its box in the quiet ink, lets touch pan the page, a crosshair for fine pointers only', () => {
    expect(styles).toContain('height: 240px');
    expect(styles).toContain('color: var(--text-tertiary)');
    expect(styles).toContain('touch-action: pan-y');
    expect(styles).toMatch(/@media \(hover: hover\) and \(pointer: fine\)[^{]*\{ \.aw \{ cursor: crosshair; \} \}/);
    expect(styles).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(/i);
  });
});

describe('doc', () => {
  it('ships ≥ 3 demos that build without the network; the backdrop’s slider drives activity', () => {
    const fetchSpy = vi.fn(() => {
      throw new Error('no network in demos');
    });
    vi.stubGlobal('fetch', fetchSpy);
    expect(doc.slug).toBe('ascii-wake');
    expect(doc.tag).toBe('ui-ascii-wake');
    expect(doc.group).toBe('Primitives');
    expect(doc.reference.url).toBe('https://bencho.dev/blocks/ascii-wake');
    expect(doc.a11y.some((l) => l.startsWith('Sound (opt-in'))).toBe(true);
    expect(doc.a11y.join(' ')).toMatch(/not focusable/i);
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const d of doc.demos) {
      const el = d.create();
      document.body.append(el);
      const wakes = el.matches('ui-ascii-wake') ? [el] : Array.from(el.querySelectorAll('ui-ascii-wake'));
      expect(wakes.length).toBeGreaterThan(0);
      for (const w of wakes) (w as UiAsciiWake).renderNow();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    const box = doc.demos.find((d) => d.id === 'backdrop')!.create();
    document.body.append(box);
    const bg = box.querySelector('ui-ascii-wake')!;
    const range = box.querySelector<HTMLInputElement>('input[type="range"]')!;
    expect(range.closest('label')!.textContent).toBe('Agent activity');
    expect(bg.options).toMatchObject({ shape: 'field', activity: 0.35 });
    range.value = '80';
    range.dispatchEvent(new Event('input'));
    expect(bg.options.activity).toBe(0.8);
    range.value = '0';
    range.dispatchEvent(new Event('input'));
    expect(bg.options.activity).toBe(0);
    const ko = doc.demos.find((d) => d.id === 'ko')!.create();
    document.body.append(ko);
    const [named, labelled, deco] = Array.from(ko.querySelectorAll('ui-ascii-wake'));
    for (const w of [named, labelled, deco]) w.renderNow();
    expect(field(named).getAttribute('aria-label')).toBe('포인터에 반응하는 점 무늬');
    expect(field(labelled).getAttribute('aria-label')).toBe('첫 토큰을 기다리는 중');
    expect(field(deco).getAttribute('aria-hidden')).toBe('true');
  });
});
