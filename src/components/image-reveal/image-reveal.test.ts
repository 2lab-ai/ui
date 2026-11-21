import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { doc } from './docs';
import { samplePaletteFromCanvas } from './engine/palette';
import {
  accentRamp,
  colorLuminance,
  mixRgb,
  NAMED_PALETTES,
  PRESET_NAMES,
  PRESETS,
  parseCssColor,
  rankPalette,
  toHex,
} from './engine/presets';
import {
  createUniforms,
  effectiveCardBg,
  effectiveCellSize,
  effectivePaletteColor,
  type Instance,
  mosaicGrid,
  writeInstanceUniforms,
} from './engine/renderer';
import { computeCoverSourceRect, flickerHash, getMaskValue, revealGrid, revealTiming } from './engine/reveal';
import { FRAG_BODY, fragmentSource, specializeEffect } from './engine/shaders';
import { EASING_FNS, ease } from './engine/tween';
import {
  IMAGE_REVEAL_FADE_MS,
  IMAGE_REVEAL_IDLE_MS,
  type ImageRevealData,
  type ImageRevealPhase,
  isCssColor,
  revealAspect,
  revealPaletteColors,
  revealStatusText,
  revealTarget,
  type UiImageReveal,
} from './image-reveal';
import { styles } from './styles';

const XSS = '<img src=x onerror=alert(1)>';

// ── Fakes: a rAF clock the test drives, observers it fires, media queries, images and canvases ───────────────────

let frames: Map<number, FrameRequestCallback>;
let frameId = 0;
let clock = 0;
let cancelled: number[] = [];
let reduce = false;
let media: Map<string, Set<() => void>>;
let glMode: 'none' | 'ok' | 'broken' = 'none';
let glContexts: FakeGl[] = [];
let srcN = 0;

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
  /** Like the real one, the observer reports at once — on screen, unless a test says the page starts scrolled away. */
  static startVisible = true;
  disconnected = false;
  constructor(readonly cb: IntersectionObserverCallback) {
    FakeIO.all.push(this);
  }
  observe() {
    this.fire(FakeIO.startVisible);
  }
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
  disconnected = false;
  constructor(readonly cb: MutationCallback) {
    FakeMO.all.push(this);
  }
  observe() {}
  takeRecords() {
    return [];
  }
  disconnect() {
    this.disconnected = true;
  }
}

/** `new Image()` for loadImage: the test decides when (and whether) a picture loads. */
class FakeImage {
  static all = new Map<string, FakeImage>();
  onload: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  width = 640;
  height = 480;
  naturalWidth = 640;
  naturalHeight = 480;
  complete = false;
  #src = '';
  #res: (() => void) | null = null;
  #rej: ((e: unknown) => void) | null = null;
  set src(v: string) {
    this.#src = v;
    FakeImage.all.set(v, this);
  }
  get src() {
    return this.#src;
  }
  decode() {
    return new Promise<void>((res, rej) => {
      this.#res = res;
      this.#rej = rej;
    });
  }
  ok() {
    this.complete = true;
    this.#res?.();
  }
  fail() {
    this.onerror?.(new Event('error'));
    this.#rej?.(new Error('broken'));
  }
}

/** A WebGL 2 context that records what matters: draws, and whether it was released. */
class FakeGl {
  draws = 0;
  lost = 0;
  compiles = 0;
  readonly canvas: HTMLCanvasElement;
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }
  get proxy(): WebGL2RenderingContext {
    const self = this;
    const consts: Record<string, number> = {
      FRAMEBUFFER: 1,
      FRAMEBUFFER_COMPLETE: 2,
      COMPILE_STATUS: 3,
      LINK_STATUS: 4,
      TEXTURE_2D: 5,
    };
    return new Proxy({} as WebGL2RenderingContext, {
      get(_t, k: string) {
        if (k in consts) return consts[k];
        if (k === 'canvas') return self.canvas;
        if (k === 'drawArrays') return () => self.draws++;
        if (k === 'compileShader') return () => self.compiles++;
        if (k === 'getShaderParameter') return () => glMode !== 'broken';
        if (k === 'getProgramParameter') return () => true;
        if (k === 'isContextLost') return () => false;
        if (k === 'checkFramebufferStatus') return () => 2;
        if (k === 'getShaderInfoLog' || k === 'getProgramInfoLog') return () => 'fake';
        if (k === 'getExtension')
          return (name: string) => (name === 'WEBGL_lose_context' ? { loseContext: () => self.lost++ } : {});
        if (/^(create|getUniformLocation)/.test(k)) return () => ({});
        return () => undefined;
      },
    });
  }
}

const ctx2dCache = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();
/** A 2D context of no-ops, with image data the right size (the reveal reads and writes pixels). */
function fake2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  let c = ctx2dCache.get(canvas);
  if (c) return c;
  const data = (w: number, h: number) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
  const props: Record<string | symbol, unknown> = { canvas };
  c = new Proxy(props as unknown as CanvasRenderingContext2D, {
    get(t, k) {
      if (k in t) return (t as unknown as Record<string | symbol, unknown>)[k];
      if (k === 'getImageData') return (_x: number, _y: number, w: number, h: number) => data(w, h);
      if (k === 'createImageData') return (w: number, h: number) => data(w, h);
      return () => undefined;
    },
    set(t, k, v) {
      (t as unknown as Record<string | symbol, unknown>)[k] = v;
      return true;
    },
  });
  ctx2dCache.set(canvas, c);
  return c;
}

function listeners(q: string): Set<() => void> {
  let s = media.get(q);
  if (!s) {
    s = new Set();
    media.set(q, s);
  }
  return s;
}

beforeEach(() => {
  document.body.innerHTML = '';
  frames = new Map();
  frameId = 0;
  clock = 1000;
  cancelled = [];
  reduce = false;
  media = new Map();
  glMode = 'none';
  glContexts = [];
  FakeRO.all = [];
  FakeIO.all = [];
  FakeIO.startVisible = true;
  FakeMO.all = [];
  FakeImage.all = new Map();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
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
      return query.includes('prefers-reduced-motion') ? reduce : false;
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => listeners(query).add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners(query).delete(fn),
  }));
  vi.stubGlobal('ResizeObserver', FakeRO);
  vi.stubGlobal('IntersectionObserver', FakeIO);
  vi.stubGlobal('MutationObserver', FakeMO);
  vi.stubGlobal('Image', FakeImage);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
    type: string,
  ) {
    if (type === '2d') return fake2d(this);
    if (type === 'webgl2' && glMode !== 'none') {
      const g = new FakeGl(this);
      glContexts.push(g);
      return g.proxy;
    }
    return null;
  } as unknown as HTMLCanvasElement['getContext']);
  if (typeof HTMLImageElement.prototype.decode !== 'function') {
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: () => Promise.resolve(),
    });
  }
});

afterEach(() => {
  document.body.innerHTML = '';
  Reflect.deleteProperty(document, 'hidden');
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** A fresh, safe picture URL (base64 raster data:, so nothing touches the network). */
const pic = () => `data:image/png;base64,${btoa(`picture-${++srcN}`)}`;
const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

function mount(attrs: Record<string, string> = {}, data?: ImageRevealData): UiImageReveal {
  const el = document.createElement('ui-image-reveal');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (data) el.data = data;
  document.body.append(el);
  el.renderNow();
  return el;
}
const frameOf = (el: UiImageReveal) => el.shadowRoot!.querySelector<HTMLElement>('.ir')!;
const statusOf = (el: UiImageReveal) => el.shadowRoot!.querySelector('[role="status"]')!.textContent;
const imgOf = (el: UiImageReveal) => el.shadowRoot!.querySelector<HTMLImageElement>('img');
const canvasesOf = (el: UiImageReveal) => el.shadowRoot!.querySelectorAll('canvas').length;
const ro = (el: UiImageReveal) => FakeRO.all.find((r) => r.targets.includes(frameOf(el)))!;
const io = () => FakeIO.all[FakeIO.all.length - 1];
function sized(attrs: Record<string, string> = {}, data?: ImageRevealData, w = 300, h = 300): UiImageReveal {
  const el = mount(attrs, data);
  ro(el).fire(w, h);
  return el;
}
/** Advance the clock by `ms` in rAF steps of `step`, running the frames that were scheduled. */
function advance(ms: number, step = 110): void {
  for (let t = 0; t < ms; t += step) {
    clock += step;
    const due = Array.from(frames.entries());
    frames.clear();
    for (const [, cb] of due) cb(clock);
  }
}
function phases(el: UiImageReveal): ImageRevealPhase[] {
  const seen: ImageRevealPhase[] = [];
  el.addEventListener('ui-phase-change', (e) =>
    seen.push((e as CustomEvent<{ phase: ImageRevealPhase }>).detail.phase),
  );
  return seen;
}

// ── Engine helpers ────────────────────────────────────────────────────────────────────────────────────────────────

describe('tween', () => {
  it('every easing runs 0 → 1, clamps its input, and an unknown key eases with smoothstep', () => {
    for (const k of Object.keys(EASING_FNS) as Array<keyof typeof EASING_FNS>) {
      expect(ease(k, 0)).toBeCloseTo(0, 6);
      expect(ease(k, 1)).toBeCloseTo(1, 6);
      expect(ease(k, -3)).toBeCloseTo(0, 6);
      expect(ease(k, 9)).toBeCloseTo(1, 6);
    }
    expect(ease('easeOutCubic', 0.5)).toBeCloseTo(0.875, 6);
    expect(ease('linear', Number.NaN)).toBe(0);
    expect(ease('nope' as never, 0.5)).toBeCloseTo(0.5, 6);
    expect(ease('easeOutBack', 0.7)).toBeGreaterThan(1);
  });
});

describe('presets and colours', () => {
  it('ships the three library presets, each with a dark and a light block of seven colours', () => {
    expect(PRESET_NAMES).toEqual(['pixels-organic', 'pixels-mechanic', 'sweep-gradient']);
    const effects = PRESET_NAMES.map((n) => PRESETS[n].modes.dark.effectIndex);
    expect(effects).toEqual([22, 11, 25]);
    for (const n of PRESET_NAMES) {
      for (const m of ['dark', 'light'] as const) {
        const mode = PRESETS[n].modes[m];
        expect(mode.theme).toBe(m);
        expect(mode.colors).toHaveLength(7);
        expect(mode.alphas).toHaveLength(7);
        expect(mode.dotMode).toBe(1);
        expect(mode.pixelConfig.cellSize).toBe(0.22);
      }
    }
    expect(PRESETS['sweep-gradient'].modes.dark.revealConfig.maskShape).toBe('gradientSweep');
    expect(PRESETS['pixels-mechanic'].modes.light.revealConfig.maskShape).toBe('shaderColor3');
  });

  it('parses hex, rgb(), rgba(), color(srgb) and drops alpha; anything unreadable is black', () => {
    expect(parseCssColor('#fff')).toEqual([1, 1, 1]);
    expect(parseCssColor('#ff000080')).toEqual([1, 0, 0]);
    expect(parseCssColor('#0F0F0F')[0]).toBeCloseTo(15 / 255, 6);
    expect(parseCssColor('rgb(255, 128, 0)')).toEqual([1, 128 / 255, 0]);
    expect(parseCssColor('rgba(0 0 255 / 0.5)')).toEqual([0, 0, 1]);
    expect(parseCssColor('rgb(300, -5, 0)')).toEqual([1, 0, 0]);
    expect(parseCssColor('color(srgb 1 0.5 0)')).toEqual([1, 0.5, 0]);
    expect(parseCssColor('rgb(50%, 0%, 100%)')).toEqual([0.5, 0, 1]);
    expect(parseCssColor('')).toEqual([0, 0, 0]);
    expect(parseCssColor('#12')).toEqual([0, 0, 0]);
    expect(parseCssColor('not a colour')).toEqual([0, 0, 0]);
    expect(parseCssColor(42 as unknown as string)).toEqual([0, 0, 0]);
  });

  it('toHex, mixRgb and colorLuminance', () => {
    expect(toHex([1, 0.5, 0])).toBe('#ff8000');
    expect(toHex([2, -1, 0.2])).toBe('#ff0033');
    expect(mixRgb([0, 0, 0], [1, 1, 1], 0.25)).toEqual([0.25, 0.25, 0.25]);
    expect(colorLuminance('#ffffff')).toBeCloseTo(1, 6);
    expect(colorLuminance('#000')).toBe(0);
  });

  it('rankPalette maps a palette onto the slots by brightness and leaves the card-colour slots to the surface', () => {
    const mode = PRESETS['pixels-organic'].modes.dark;
    const out = rankPalette(mode, NAMED_PALETTES.ocean);
    // #0f0f0f (the card colour) sits at slots 0, 3 and 5: they stay null.
    expect([out[0], out[3], out[5]]).toEqual([null, null, null]);
    for (const i of [1, 2, 4, 6]) expect(out[i]).toMatch(/^#[0-9a-f]{6}$/);
    // Preset brightness order: #2f2f2f (6) < #4a4949 (1) < #b9b9b9 (2) < #d8d8d8 (4) — the palette keeps it.
    const lum = (i: number) => colorLuminance(out[i] as string);
    expect(lum(6)).toBeLessThan(lum(1));
    expect(lum(1)).toBeLessThan(lum(2));
    expect(lum(2)).toBeLessThan(lum(4));
    expect(rankPalette(mode, [])).toEqual([null, null, null, null, null, null, null]);
  });

  it('accentRamp runs dark → light through the accent; revealPaletteColors picks a palette by name', () => {
    const ramp = accentRamp('#336699');
    expect(ramp).toHaveLength(7);
    expect(ramp[3]).toBe('#336699');
    for (let i = 1; i < ramp.length; i++) expect(colorLuminance(ramp[i])).toBeGreaterThan(colorLuminance(ramp[i - 1]));
    const mode = PRESETS['pixels-mechanic'].modes.light;
    expect(revealPaletteColors(mode, 'preset', '#336699')).toBeNull();
    expect(revealPaletteColors(mode, 'ember', '')).toEqual(rankPalette(mode, NAMED_PALETTES.ember));
    expect(revealPaletteColors(mode, 'accent', '#336699')).toEqual(rankPalette(mode, ramp));
    // No accent read yet: a default blue, never a throw.
    expect(revealPaletteColors(mode, 'accent', '')?.some((c) => c)).toBe(true);
  });

  it('a tainted read drops the scratch canvas: the next picture samples on a fresh one', () => {
    const made: HTMLCanvasElement[] = [];
    let taint = true;
    const pixels = new Uint8ClampedArray(24 * 24 * 4).fill(200);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      made.push(this);
      const c = fake2d(this);
      (c as unknown as { getImageData: () => { data: Uint8ClampedArray } }).getImageData = () => {
        if (taint) throw new DOMException('tainted', 'SecurityError');
        return { data: pixels };
      };
      return c;
    } as unknown as HTMLCanvasElement['getContext']);
    const src = document.createElement('canvas');
    src.width = 8;
    src.height = 8;
    expect(samplePaletteFromCanvas(src, ['#000', '#fff'])).toBeNull();
    const before = made.length;
    taint = false;
    expect(samplePaletteFromCanvas(src, ['#000', '#fff'])).not.toBeNull();
    expect(made.length).toBe(before + 1);
    // Leave the module's scratch canvas dropped again, for the tests after this one.
    taint = true;
    expect(samplePaletteFromCanvas(src, ['#000', '#fff'])).toBeNull();
  });

  it('samples a picture palette by luminance rank (and gives up on a tainted or empty source)', () => {
    const presetColors = ['#000000', '#ffffff', '#808080'];
    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    const scratch = fake2d(document.createElement('canvas'));
    // The scratch canvas is created inside palette.ts: answer its getImageData with a dark → bright strip.
    const realGet = HTMLCanvasElement.prototype.getContext;
    const pixels = new Uint8ClampedArray(24 * 24 * 4);
    for (let i = 0; i < 24 * 24; i++) {
      const v = Math.round((i / (24 * 24 - 1)) * 255);
      pixels.set([v, v, v, 255], i * 4);
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      const c = fake2d(this);
      (c as unknown as { getImageData: () => { data: Uint8ClampedArray } }).getImageData = () => ({ data: pixels });
      return c;
    } as unknown as typeof realGet);
    const s = samplePaletteFromCanvas(canvas, presetColors);
    expect(s).not.toBeNull();
    expect(s!.colors).toHaveLength(3);
    expect(colorLuminance(s!.colors[0])).toBeLessThan(colorLuminance(s!.colors[2]));
    expect(colorLuminance(s!.colors[2])).toBeLessThan(colorLuminance(s!.colors[1]));
    expect(s!.cardBg).toMatch(/^#[0-9a-f]{6}$/);
    const empty = document.createElement('canvas');
    empty.width = 0;
    expect(samplePaletteFromCanvas(empty, presetColors)).toBeNull();
    expect(scratch).toBeTruthy();
  });
});

describe('renderer maths', () => {
  it('effectiveCellSize scales the cell count by 1 / pixelScale and ignores nonsense', () => {
    const base = (c: number) => 6 + c * 74;
    expect(effectiveCellSize(0.22, 1)).toBe(0.22);
    expect(base(effectiveCellSize(0.22, 2))).toBeCloseTo(base(0.22) / 2, 6);
    expect(base(effectiveCellSize(0.22, 0.5))).toBeCloseTo(base(0.22) * 2, 6);
    expect(effectiveCellSize(0.22, 0)).toBe(0.22);
    expect(effectiveCellSize(0.22, Number.NaN)).toBe(0.22);
  });

  it('mosaicGrid keeps cells square in CSS px, floors at 2, and agrees with the reveal grid', () => {
    expect(mosaicGrid(320, 320, 1, 0.22)).toEqual({ gx: 22, gy: 22 });
    expect(mosaicGrid(400, 400, 1.25, 0.22)).toEqual({ gx: 22, gy: 22 });
    expect(mosaicGrid(640, 320, 1, 0.22)).toEqual({ gx: 44, gy: 22 });
    expect(mosaicGrid(10, 10, 1, 0.22)).toEqual({ gx: 2, gy: 2 });
    expect(mosaicGrid(320, 320, 1, 0.22, 2, 0.5).gx).toBe(13);
    const r = revealGrid(0.22, 640, 320);
    expect([r.gridX, r.gridY]).toEqual([44, 22]);
    expect(revealGrid(0.22, 0, 0)).toEqual({ gridX: 2, gridY: 2 });
  });

  it('writeInstanceUniforms: the preset, a strength boost above 1, the card-linked remap and the overrides', () => {
    const mode = PRESETS['pixels-organic'].modes.dark;
    const inst = {
      preset: mode,
      cardBgOverride: '#202020',
      colorsOverride: [null, '#ff0000'],
      strength: 2,
      pixelScale: 2,
      uniformsDirty: true,
    } as unknown as Instance;
    const u = createUniforms();
    writeInstanceUniforms(u, inst);
    expect(u.u_effect).toBe(22);
    expect(u.u_intensity).toBeCloseTo(mode.intensity * 3.2, 6);
    expect(u.u_highlight).toBeCloseTo(mode.highlight * 3.2, 6);
    expect(u.u_cellSize).toBeCloseTo(effectiveCellSize(0.22, 2), 6);
    expect(u.u_dotOpacity).toBe(0.68);
    // Slot 0 was the card colour #0f0f0f: it follows the override. Slot 1 is overridden outright.
    expect(u.u_color1[0]).toBeCloseTo(0x20 / 255, 6);
    expect(u.u_color2).toEqual([1, 0, 0]);
    expect(u.u_cardBg[0]).toBeCloseTo(0x20 / 255, 6);
    expect(inst.uniformsDirty).toBe(false);
    expect(effectiveCardBg(inst)).toBe('#202020');
    expect(effectivePaletteColor({ preset: mode, cardBgOverride: null }, 0)[0]).toBeCloseTo(15 / 255, 6);
  });

  it('the cover crop keeps the picture’s ratio and centres the overflowing axis', () => {
    expect(computeCoverSourceRect({ width: 200, height: 100 }, 100, 100)).toEqual({ sx: 50, sy: 0, sw: 100, sh: 100 });
    expect(computeCoverSourceRect({ width: 100, height: 200 }, 100, 100)).toEqual({ sx: 0, sy: 50, sw: 100, sh: 100 });
    expect(computeCoverSourceRect({ width: 160, height: 90 }, 320, 180)).toEqual({ sx: 0, sy: 0, sw: 160, sh: 90 });
  });

  it('revealTiming: the preset’s 3 s, or a shorter reveal with the pixel dissolve scaled in step', () => {
    const mode = PRESETS['pixels-organic'].modes.dark;
    expect(revealTiming(mode)).toEqual({ duration: 3, easingKey: 'easeOutCubic', pixDuration: 2.65 });
    const quick = revealTiming(mode, 0.3);
    expect(quick.duration).toBe(0.3);
    expect(quick.pixDuration).toBeCloseTo(0.265, 6);
    expect(revealTiming(mode, 0).duration).toBe(3);
    expect(revealTiming(mode, 0.001).duration).toBe(0.05);
  });

  it('the geometric masks, and −1 for the shader-driven ones; the flicker hash is a stable [0, 1)', () => {
    expect(getMaskValue('radialCenter', 32, 32, 65)).toBeCloseTo(1, 6);
    expect(getMaskValue('linearTop', 0, 5, 64)).toBe(1);
    expect(getMaskValue('linearTop', 63, 5, 64)).toBe(0);
    expect(getMaskValue('diagonalBR', 63, 63, 64)).toBe(1);
    expect(getMaskValue('shaderColor4', 1, 1, 64)).toBe(-1);
    expect(getMaskValue('gradientSweep', 1, 1, 64)).toBe(-1);
    for (let i = 0; i < 50; i++) {
      const h = flickerHash(i, i * 3);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
      expect(flickerHash(i, i * 3)).toBe(h);
    }
  });
});

describe('shaders', () => {
  it('cut to one effect per program, in GLSL ES 3.00, with the pass as a define', () => {
    const src = fragmentSource(22, 1);
    expect(src.startsWith('#version 300 es\n')).toBe(true);
    expect(src).toContain('#define IMGFX_PASS 1');
    expect(src).toContain('const int u_effect = 22;');
    expect(src).toContain('ridge1');
    expect(src).not.toMatch(/u_effect\s*==\s*(11|25)/);
    expect(src).not.toMatch(/gl_FragColor|texture2D|gl_FragData/);
    expect(fragmentSource(25, 0)).toContain('sweepEase(fract(cyc))');
    expect(fragmentSource(11, 2)).toContain('texture(u_field');
    // A branch that does not exist leaves an empty block; a source without the uniform comes back unchanged.
    expect(specializeEffect(FRAG_BODY, 3)).not.toMatch(/u_effect\s*==/);
    expect(specializeEffect('void main() {}', 3)).toBe('void main() {}');
  });
});

// ── Element helpers ───────────────────────────────────────────────────────────────────────────────────────────────

describe('element helpers', () => {
  it('revealAspect reads ratios, clamps them to 1:5 … 5:1, and "fill" is the host’s box', () => {
    expect(revealAspect('16 / 9')).toEqual([16, 9]);
    expect(revealAspect('4:3')).toEqual([4, 3]);
    expect(revealAspect('1.5')).toEqual([1.5, 1]);
    expect(revealAspect(0.5)).toEqual([0.5, 1]);
    expect(revealAspect('fill')).toBeNull();
    expect(revealAspect('AUTO')).toBeNull();
    expect(revealAspect('100/1')).toEqual([5, 1]);
    expect(revealAspect('1/100')).toEqual([1, 5]);
    expect(revealAspect(99)).toEqual([5, 1]);
    for (const bad of ['', 'abc', '0/1', '-1', undefined, null, 0, Number.NaN, '1/0']) {
      expect(revealAspect(bad)).toEqual([1, 1]);
    }
  });

  it('isCssColor accepts colours and refuses url(), var() and non-strings', () => {
    expect(isCssColor('#abc')).toBe(true);
    expect(isCssColor('#aabbccdd')).toBe(true);
    expect(isCssColor('rgb(1, 2, 3)')).toBe(true);
    for (const bad of [
      '',
      '#ab',
      '#ggg',
      'url(https://x.test/a.png)',
      'var(--x)',
      'red; background: url(x)',
      'rgb(1, 2, 3) }',
      'linear-gradient(red, blue)',
      7,
      null,
    ]) {
      expect(isCssColor(bad)).toBe(false);
    }
  });

  it('revealStatusText: the label with the progress, ready once, No preview — in English and Korean', () => {
    expect(revealStatusText('en', 'loading', null, '', false)).toBe('Generating image');
    expect(revealStatusText('en', 'revealing', 0.4, '', false)).toBe('Generating image, 40%');
    expect(revealStatusText('en', 'loading', 1, 'Drawing the chart', false)).toBe('Drawing the chart, 100%');
    expect(revealStatusText('en', 'done', null, '', true)).toBe('Image ready');
    expect(revealStatusText('en', 'done', null, '', false)).toBe('');
    expect(revealStatusText('en', 'error', 0.5, 'x', true)).toBe('No preview');
    expect(revealStatusText('ko', 'loading', 0.25, '', false)).toBe('이미지를 만드는 중, 25%');
    expect(revealStatusText('ko', 'done', null, '', true)).toBe('이미지 준비 완료');
    expect(revealStatusText('ko', 'error', null, '', false)).toBe('미리보기 없음');
  });

  it('revealTarget: the state machine’s decision', () => {
    const t = (o: Partial<Parameters<typeof revealTarget>[0]>) =>
      revealTarget({ state: 'auto', src: 'a.png', load: 'ok', regenerating: false, phase: 'loading', ...o });
    expect(t({})).toBe('picture');
    expect(t({ load: 'pending' })).toBe('loading');
    expect(t({ load: 'fail' })).toBe('error');
    expect(t({ state: 'error' })).toBe('error');
    expect(t({ src: '' })).toBe('loading');
    expect(t({ src: '', state: 'done' })).toBe('error');
    expect(t({ state: 'loading' })).toBe('loading');
    expect(t({ src: '', invalid: true })).toBe('error');
    expect(t({ regenerating: true, state: 'done' })).toBe('picture');
    expect(t({ regenerating: true })).toBe('loading');
    // done with nothing on screen waits for its picture without a loader; with the loader up, it keeps it.
    expect(t({ state: 'done', load: 'pending', phase: null })).toBe('picture');
    expect(t({ state: 'done', load: 'pending', phase: 'done' })).toBe('picture');
    expect(t({ state: 'done', load: 'pending', phase: 'loading' })).toBe('loading');
  });
});

// ── The element ───────────────────────────────────────────────────────────────────────────────────────────────────

describe('<ui-image-reveal> without WebGL (happy-dom)', () => {
  it('the status is not inside the aria-busy frame (a busy subtree holds its announcements back)', () => {
    const el = mount({}, { progress: 0.4 });
    const status = el.shadowRoot!.querySelector('[role="status"]')!;
    expect(status.closest('[aria-busy]')).toBeNull();
    expect(frameOf(el).getAttribute('aria-busy')).toBe('true');
    expect(status.textContent).toBe('Generating image, 40%');
  });

  it('renders the loader: a status that is busy, the CSS mosaic, no canvas', () => {
    const el = mount();
    const f = frameOf(el);
    expect(el.phase).toBe('loading');
    expect(el.rendering).toBe('css');
    expect(f.dataset.render).toBe('css');
    expect(f.getAttribute('aria-busy')).toBe('true');
    expect(f.getAttribute('part')).toBe('frame');
    expect(statusOf(el)).toBe('Generating image');
    expect(canvasesOf(el)).toBe(0);
    expect(el.shadowRoot!.querySelector('.ir-fallback')!.getAttribute('aria-hidden')).toBe('true');
    expect(el.shadowRoot!.querySelector('slot')).not.toBeNull();
    expect(f.style.aspectRatio).toBe('1 / 1');
  });

  it('speaks Korean, a label and the progress', async () => {
    const el = mount({ lang: 'ko' }, { progress: 0.4 });
    expect(statusOf(el)).toBe('이미지를 만드는 중, 40%');
    expect(el.shadowRoot!.querySelector('.ir-empty-text')!.textContent).toBe('미리보기 없음');
    el.data = { label: '썸네일을 만드는 중', progress: 0.75 };
    el.renderNow();
    expect(statusOf(el)).toBe('썸네일을 만드는 중, 75%');
    el.setAttribute('lang', 'en');
    el.data = {};
    el.renderNow();
    expect(statusOf(el)).toBe('Generating image');
  });

  it('a picture that loads fades in over the loader, then the <img> with its alt stays; the events follow', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const src = pic();
    const el = document.createElement('ui-image-reveal');
    const seen = phases(el);
    el.data = { src, alt: 'A lighthouse at dusk' };
    document.body.append(el);
    el.renderNow();
    expect(el.phase).toBe('loading');
    FakeImage.all.get(src)!.ok();
    await flush();
    expect(el.phase).toBe('revealing');
    const img = imgOf(el)!;
    expect(img.alt).toBe('A lighthouse at dusk');
    expect(img.getAttribute('src')).toBe(src);
    expect(img.hasAttribute('data-show')).toBe(true);
    vi.advanceTimersByTime(IMAGE_REVEAL_FADE_MS + 10);
    await flush();
    expect(el.phase).toBe('done');
    expect(el.rendering).toBe('none');
    expect(frameOf(el).getAttribute('aria-busy')).toBe('false');
    expect(statusOf(el)).toBe('Image ready');
    expect(seen).toEqual(['loading', 'revealing', 'done']);
  });

  it('a picture that fails is "No preview", not an endless loader', async () => {
    const src = pic();
    const el = mount({}, { src, alt: 'x' });
    FakeImage.all.get(src)!.fail();
    await flush();
    expect(el.phase).toBe('error');
    expect(frameOf(el).dataset.phase).toBe('error');
    expect(frameOf(el).getAttribute('aria-busy')).toBe('false');
    expect(statusOf(el)).toBe('No preview');
    expect(el.rendering).toBe('none');
    expect(imgOf(el)).toBeNull();
    // A new src brings the loader back.
    el.data = { src: pic(), alt: 'y' };
    el.renderNow();
    expect(el.phase).toBe('loading');
    expect(el.rendering).toBe('css');
  });

  it('state="error", or state="done" with no usable src, is "No preview"; an unsafe src is no picture', () => {
    expect(mount({ state: 'error' }, { src: pic() }).phase).toBe('error');
    expect(mount({ state: 'done' }).phase).toBe('error');
    const bad = mount({ src: 'javascript:alert(1)' });
    expect(bad.options.src).toBe('');
    expect(bad.options.srcInvalid).toBe(true);
    // A src that is not a picture URL is "No preview", not an endless loader.
    expect(bad.phase).toBe('error');
    expect(statusOf(bad)).toBe('No preview');
    expect(mount({ src: '  ' }).phase).toBe('loading');
    expect(mount({ state: 'done', src: 'data:text/html,<b>x</b>' }).phase).toBe('error');
    expect(FakeImage.all.size).toBe(1);
  });

  it('state="done" from the start shows the picture with no loader and no WebGL', async () => {
    glMode = 'ok';
    const src = pic();
    const el = mount({ state: 'done' }, { src, alt: 'A past result' });
    expect(el.phase).toBe('done');
    expect(el.rendering).toBe('none');
    expect(glContexts).toHaveLength(0);
    expect(statusOf(el)).toBe('');
    const img = imgOf(el)!;
    expect(img.alt).toBe('A past result');
    expect(img.hasAttribute('data-show')).toBe(false);
    FakeImage.all.get(src)!.ok();
    await flush();
    expect(img.hasAttribute('data-show')).toBe(true);
  });

  it('state="loading" keeps the loader over a loaded picture; dropping it reveals', async () => {
    const src = pic();
    const el = mount({ state: 'loading' }, { src, alt: 'x' });
    FakeImage.all.get(src)!.ok();
    await flush();
    expect(el.phase).toBe('loading');
    el.setAttribute('state', 'auto');
    el.data = { ...el.data, state: undefined };
    el.renderNow();
    expect(el.phase).toBe('revealing');
  });

  it('escapes every host string: alt, label and src never become markup', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const src = pic();
    const el = mount({}, { src, alt: XSS, label: XSS });
    expect(statusOf(el)).toBe(XSS);
    FakeImage.all.get(src)!.ok();
    await flush();
    vi.advanceTimersByTime(IMAGE_REVEAL_FADE_MS + 10);
    await flush();
    const root = el.shadowRoot!;
    expect(root.querySelectorAll('img')).toHaveLength(1);
    expect(imgOf(el)!.alt).toBe(XSS);
    expect(root.querySelector('img[src="x"]')).toBeNull();
    // A quoted string is a (strange) relative URL: it is set as a property, never written into markup.
    const odd = `x.png" onerror="alert(1)`;
    const evil = mount({ state: 'done' }, { src: odd, alt: XSS });
    expect(evil.options.src).toBe(odd);
    expect(imgOf(evil)!.getAttribute('src')).toBe(odd);
    expect(evil.shadowRoot!.querySelector('[onerror]')).toBeNull();
    expect(evil.shadowRoot!.querySelectorAll('img')).toHaveLength(1);
  });

  it('clamps and validates every option, from data and attributes', () => {
    const el = mount({
      preset: 'nope',
      palette: 'OCEAN',
      'pixel-scale': '9',
      speed: '-1',
      strength: 'x',
      progress: '1.7',
      aspect: '21:9',
      'card-bg': 'url(https://x.test/a.png)',
      motion: 'sideways',
      paused: '',
    });
    expect(el.options).toMatchObject({
      preset: 'pixels-organic',
      palette: 'ocean',
      pixelScale: 4,
      speed: 0.1,
      strength: 1,
      progress: 1,
      aspect: [21, 9],
      cardBg: null,
      motion: 'system',
      paused: true,
      state: 'auto',
    });
    el.setAttribute('paused', 'false');
    el.setAttribute('progress', '');
    el.data = { colors: ['#ff0000', 'url(x)', null, 'rgb(0, 0, 255)'], cardBg: '#123456', preset: 'sweep-gradient' };
    expect(el.options.paused).toBe(false);
    expect(el.options.progress).toBeNull();
    expect(el.options.colors).toEqual(['#ff0000', null, null, 'rgb(0, 0, 255)']);
    expect(el.options.cardBg).toBe('#123456');
    expect(el.options.preset).toBe('sweep-gradient');
    el.data = { colors: ['#zz', 'url(x)'], aspect: 'fill' };
    el.renderNow();
    expect(el.options.colors).toBeNull();
    expect(frameOf(el).hasAttribute('data-fill')).toBe(true);
    el.data = { cardBg: '#123456' };
    el.renderNow();
    expect(frameOf(el).style.getPropertyValue('--ir-bg')).toBe('#123456');
  });

  it('reveal-ms shortens the cross-fade (clamped 120 … 10000; unset is the preset’s)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    expect(mount().options.revealMs).toBeNull();
    expect(mount({ 'reveal-ms': '5' }).options.revealMs).toBe(120);
    expect(mount({ 'reveal-ms': 'soon' }).options.revealMs).toBeNull();
    const src = pic();
    const el = mount({ 'reveal-ms': '250' }, { src, alt: 'x' });
    expect(frameOf(el).style.getPropertyValue('--ir-fade')).toBe('250ms');
    FakeImage.all.get(src)!.ok();
    await flush();
    expect(el.phase).toBe('revealing');
    vi.advanceTimersByTime(260);
    await flush();
    expect(el.phase).toBe('done');
  });

  it('regenerate() is false with no picture on screen', () => {
    expect(mount().regenerate()).toBe(false);
  });
});

describe('<ui-image-reveal> with WebGL 2 (a fake context)', () => {
  beforeEach(() => {
    glMode = 'ok';
    vi.stubGlobal('WebGL2RenderingContext', class {});
  });

  it('creates one context when the loader is first drawn and runs its frame loop', () => {
    const el = sized();
    expect(el.rendering).toBe('webgl');
    expect(glContexts).toHaveLength(1);
    expect(canvasesOf(el)).toBe(2);
    for (const c of Array.from(el.shadowRoot!.querySelectorAll('canvas'))) {
      expect(c.getAttribute('aria-hidden')).toBe('true');
    }
    expect(el.running).toBe(true);
    const before = glContexts[0].draws;
    expect(before).toBeGreaterThan(0); // the resize painted at once
    advance(550);
    expect(glContexts[0].draws).toBeGreaterThan(before);
    expect(glContexts).toHaveLength(1);
  });

  it('caps the frame rate at 10 fps', () => {
    const el = sized();
    const g = glContexts[0];
    const before = g.draws;
    // 16 ms steps for 500 ms: about five frames drawn (two passes each), not thirty.
    advance(500, 16);
    const frames10 = (g.draws - before) / 2;
    expect(frames10).toBeGreaterThanOrEqual(4);
    expect(frames10).toBeLessThanOrEqual(6);
    expect(el.running).toBe(true);
  });

  it('disconnecting stops the loop and releases the context', () => {
    const el = sized();
    const g = glContexts[0];
    el.remove();
    expect(el.running).toBe(false);
    expect(cancelled.length).toBeGreaterThan(0);
    expect(g.lost).toBe(1);
    expect(canvasesOf(el)).toBe(0);
    expect(FakeRO.all.every((r) => r.disconnected)).toBe(true);
    expect(FakeIO.all.every((r) => r.disconnected)).toBe(true);
    expect(FakeMO.all.every((r) => r.disconnected)).toBe(true);
    const draws = g.draws;
    advance(500);
    expect(g.draws).toBe(draws);
  });

  it('moved in the page (disconnected, then connected again), it draws again with a fresh context', () => {
    const el = sized();
    const parent = el.parentElement!;
    el.remove();
    expect(glContexts[0].lost).toBe(1);
    parent.append(el);
    el.renderNow();
    ro(el).fire(320, 320);
    expect(el.phase).toBe('loading');
    expect(el.rendering).toBe('webgl');
    expect(glContexts).toHaveLength(2);
    expect(canvasesOf(el)).toBe(2);
    expect(el.running).toBe(true);
  });

  it('no frames off screen, in a hidden tab or while paused; a long idle releases the context', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const el = sized();
    const g = glContexts[0];
    io().fire(false);
    expect(el.running).toBe(false);
    const draws = g.draws;
    advance(400);
    expect(g.draws).toBe(draws);
    vi.advanceTimersByTime(IMAGE_REVEAL_IDLE_MS + 1);
    expect(g.lost).toBe(1);
    // Back on screen: a fresh context on the next frame, the canvases never left.
    io().fire(true);
    expect(el.running).toBe(true);
    advance(220);
    expect(glContexts).toHaveLength(2);
    expect(canvasesOf(el)).toBe(2);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(el.running).toBe(false);
    Reflect.deleteProperty(document, 'hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(el.running).toBe(true);
    el.setAttribute('paused', '');
    el.renderNow();
    expect(el.running).toBe(false);
    expect(frameOf(el).hasAttribute('data-paused')).toBe(true);
    el.removeAttribute('paused');
    el.renderNow();
    expect(el.running).toBe(true);
  });

  it('no context for a loader that has not run: twenty below the fold make none, the one scrolled to makes one', () => {
    FakeIO.startVisible = false;
    const els = Array.from({ length: 20 }, () => sized());
    advance(500);
    expect(glContexts).toHaveLength(0);
    expect(els.every((e) => e.rendering === 'webgl' && !e.running)).toBe(true);
    expect(canvasesOf(els[0])).toBe(2);
    FakeIO.all[3].fire(true);
    expect(els[3].running).toBe(true);
    advance(220);
    expect(glContexts).toHaveLength(1);
    expect(glContexts[0].draws).toBeGreaterThan(0);
  });

  it('updates while off screen keep the idle release armed', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const el = sized();
    advance(220);
    const g = glContexts[0];
    io().fire(false);
    for (let i = 1; i <= 5; i++) {
      el.data = { progress: i / 10 };
      el.renderNow();
      vi.advanceTimersByTime(IMAGE_REVEAL_IDLE_MS / 4);
    }
    expect(g.lost).toBe(1);
    expect(glContexts).toHaveLength(1);
    expect(el.running).toBe(false);
  });

  it('an evicted context falls back to CSS only until the element runs again; a broken one stays CSS', () => {
    const el = sized();
    advance(220);
    glContexts[0].canvas.dispatchEvent(new Event('webglcontextlost'));
    expect(el.rendering).toBe('css');
    // A progress tick does not grab a new context straight back (that would evict another loader's).
    el.data = { progress: 0.5 };
    el.renderNow();
    expect(el.rendering).toBe('css');
    io().fire(false);
    io().fire(true);
    expect(el.rendering).toBe('webgl');
    advance(220);
    expect(glContexts).toHaveLength(2);
    expect(el.running).toBe(true);
    glMode = 'broken';
    glContexts[1].canvas.dispatchEvent(new Event('webglcontextlost'));
    io().fire(false);
    io().fire(true);
    advance(220);
    expect(el.rendering).toBe('css');
  });

  it('reduced motion: a progress tick does not build a context; a change to the picture repaints once', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    reduce = true;
    const el = sized();
    const made = glContexts.length;
    expect(made).toBe(1);
    for (let i = 1; i <= 10; i++) {
      el.data = { progress: i / 10 };
      el.renderNow();
      vi.advanceTimersByTime(100);
    }
    vi.advanceTimersByTime(500);
    expect(glContexts).toHaveLength(made);
    el.data = { progress: 1, palette: 'ember' };
    el.renderNow();
    vi.advanceTimersByTime(200);
    expect(glContexts).toHaveLength(made + 1);
    expect(glContexts.every((g) => g.lost === 1)).toBe(true);
  });

  it('reduced motion: one still frame through a context released at once, no loop', () => {
    reduce = true;
    const el = sized();
    expect(el.rendering).toBe('still');
    expect(el.running).toBe(false);
    expect(frameOf(el).hasAttribute('data-reduced')).toBe(true);
    const painted = glContexts.filter((g) => g.draws > 0);
    expect(painted.length).toBeGreaterThan(0);
    expect(glContexts.every((g) => g.lost === 1)).toBe(true);
    expect(canvasesOf(el)).toBe(2);
    // motion="full" overrides the system setting; motion="reduce" forces the still frame.
    el.setAttribute('motion', 'full');
    el.renderNow();
    expect(el.rendering).toBe('webgl');
    expect(el.running).toBe(true);
    reduce = false;
    el.setAttribute('motion', 'reduce');
    el.renderNow();
    expect(el.rendering).toBe('still');
    expect(el.running).toBe(false);
  });

  it('a reduced-motion picture cross-fades in over the still frame', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    reduce = true;
    const src = pic();
    const el = sized({}, { src, alt: 'x' });
    FakeImage.all.get(src)!.ok();
    await flush();
    expect(el.phase).toBe('revealing');
    expect(imgOf(el)!.hasAttribute('data-show')).toBe(true);
    vi.advanceTimersByTime(IMAGE_REVEAL_FADE_MS + 10);
    await flush();
    expect(el.phase).toBe('done');
    expect(canvasesOf(el)).toBe(0);
  });

  it('the picture dissolves in through the mosaic, then the canvas goes and the context is released', async () => {
    const src = pic();
    const el = sized({}, { src, alt: 'A ceramic mug' });
    const g = glContexts[0];
    FakeImage.all.get(src)!.ok();
    await flush();
    expect(el.phase).toBe('revealing');
    expect(el.rendering).toBe('webgl');
    expect(imgOf(el)).toBeNull();
    advance(1500);
    expect(el.phase).toBe('revealing');
    advance(1800);
    await flush();
    expect(el.phase).toBe('done');
    const img = imgOf(el)!;
    expect(img.alt).toBe('A ceramic mug');
    expect(img.hasAttribute('data-show')).toBe(true);
    expect(img.hasAttribute('data-instant')).toBe(true);
    expect(canvasesOf(el)).toBe(0);
    expect(g.lost).toBe(1);
    expect(el.running).toBe(false);
    expect(statusOf(el)).toBe('Image ready');
  });

  it('after regenerate(), state "done" with the same src brings that picture back', async () => {
    const src = pic();
    const el = sized({}, { src, alt: 'one' });
    FakeImage.all.get(src)!.ok();
    await flush();
    advance(3400);
    await flush();
    expect(el.regenerate()).toBe(true);
    el.renderNow();
    expect(el.phase).toBe('loading');
    el.data = { ...el.data, state: 'done' };
    el.renderNow();
    expect(el.phase).toBe('revealing');
    advance(2600);
    await flush();
    expect(el.phase).toBe('done');
    expect(imgOf(el)!.getAttribute('src')).toBe(src);
  });

  it('pausing, or leaving the screen, mid-reveal finishes the reveal: the picture never waits behind a frozen loader', async () => {
    for (const how of ['pause', 'scroll'] as const) {
      const src = pic();
      const el = sized({}, { src, alt: how });
      FakeImage.all.get(src)!.ok();
      await flush();
      advance(330);
      expect(el.phase).toBe('revealing');
      if (how === 'pause') {
        el.setAttribute('paused', '');
        el.renderNow();
      } else io().fire(false);
      await flush();
      expect(el.phase).toBe('done');
      expect(frameOf(el).getAttribute('aria-busy')).toBe('false');
      expect(imgOf(el)!.hasAttribute('data-show')).toBe(true);
      expect(canvasesOf(el)).toBe(0);
      el.remove();
    }
  });

  it('regenerate() churns the picture until a new src dissolves in over it', async () => {
    const first = pic();
    const el = sized({}, { src: first, alt: 'one' });
    FakeImage.all.get(first)!.ok();
    await flush();
    advance(3400);
    await flush();
    expect(el.phase).toBe('done');
    const seen = phases(el);
    expect(el.regenerate()).toBe(true);
    expect(el.phase).toBe('loading');
    expect(el.rendering).toBe('webgl');
    expect(canvasesOf(el)).toBe(2);
    expect(imgOf(el)!.hasAttribute('data-show')).toBe(false);
    // The same src stays the loader: the churn waits for a new picture.
    advance(800);
    el.data = { ...el.data, progress: 0.5 };
    el.renderNow();
    expect(el.phase).toBe('loading');
    const next = pic();
    el.data = { src: next, alt: 'two' };
    el.renderNow();
    FakeImage.all.get(next)!.ok();
    await flush();
    expect(el.phase).toBe('revealing');
    advance(2600);
    await flush();
    expect(el.phase).toBe('done');
    expect(imgOf(el)!.alt).toBe('two');
    expect(imgOf(el)!.getAttribute('src')).toBe(next);
    expect(seen).toEqual(['loading', 'revealing', 'done']);
  });

  it('a short reveal-ms dissolves in that time, drawing faster than 10 fps', async () => {
    const src = pic();
    const el = sized({ 'reveal-ms': '300' }, { src, alt: 'quick' });
    const g = glContexts[0];
    FakeImage.all.get(src)!.ok();
    await flush();
    expect(el.phase).toBe('revealing');
    const before = g.draws;
    advance(150, 16);
    // ~25 ms frames: several frames in 150 ms (the 10 fps cap would allow one).
    expect(g.draws - before).toBeGreaterThanOrEqual(8);
    advance(250, 16);
    await flush();
    expect(el.phase).toBe('done');
    expect(g.lost).toBe(1);
  });

  it('a lost context falls back to the CSS mosaic, never an exception', () => {
    const el = sized();
    const g = glContexts[0];
    g.canvas.dispatchEvent(new Event('webglcontextlost'));
    expect(el.rendering).toBe('css');
    expect(el.running).toBe(false);
    expect(canvasesOf(el)).toBe(0);
    expect(el.phase).toBe('loading');
  });

  it('a shader that does not compile falls back to the CSS mosaic', () => {
    glMode = 'broken';
    const el = sized();
    expect(el.rendering).toBe('css');
    expect(canvasesOf(el)).toBe(0);
    expect(glContexts.every((g) => g.lost === 1)).toBe(true);
  });

  it('options reach the running effect: palette, preset, strength (as the canvas layer’s opacity)', () => {
    const el = sized({ palette: 'ember', strength: '0.4', preset: 'sweep-gradient' });
    const f = frameOf(el);
    expect(f.style.getPropertyValue('--ir-strength')).toBe('0.4');
    expect(f.style.getPropertyValue('--ir-tint')).toMatch(/^#[0-9a-f]{6}$/);
    expect(el.options.preset).toBe('sweep-gradient');
    advance(300);
    expect(el.running).toBe(true);
  });
});

describe('styles and docs', () => {
  it('chrome uses tokens only (picture data lives in docs.ts); motion and fallback hooks exist', () => {
    expect(styles).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(/i);
    expect(styles).toContain('var(--bg)');
    expect(styles).toContain('.ir[data-render="css"] .ir-fallback');
    expect(styles).toContain('.ir[data-reduced] .ir-fallback::before');
    expect(styles).toContain('object-fit: cover');
  });

  it('ships ≥ 3 demos that build without the network', async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error('no network in demos');
    });
    vi.stubGlobal('fetch', fetchSpy);
    expect(doc.slug).toBe('image-reveal');
    expect(doc.tag).toBe('ui-image-reveal');
    expect(doc.group).toBe('Effects');
    expect(doc.reference).toEqual({
      name: 'Libraries.dev — img-fx (Image generation)',
      url: 'https://libraries.dev/image',
    });
    expect(doc.events.map((e) => e.name)).toEqual(['ui-phase-change']);
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const d of doc.demos) {
      const box = d.create();
      document.body.append(box);
      const els = box.matches('ui-image-reveal') ? [box] : Array.from(box.querySelectorAll('ui-image-reveal'));
      expect(els.length).toBeGreaterThan(0);
      for (const e of els) (e as UiImageReveal).renderNow();
    }
    await flush();
    expect(fetchSpy).not.toHaveBeenCalled();
    const states = doc.demos.find((d) => d.id === 'states')!.create();
    document.body.append(states);
    const [, still, ko] = Array.from(states.querySelectorAll('ui-image-reveal'));
    still.renderNow();
    ko.renderNow();
    expect(still.getAttribute('motion')).toBe('reduce');
    expect(statusOf(ko)).toBe('썸네일을 만드는 중, 40%');
  });
});
