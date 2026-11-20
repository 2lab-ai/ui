import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { doc } from './docs';
import { type Dot, finalizeFrame, makeProj, paintFrame } from './engine/core';
import { resolvePreset } from './engine/presets';
import { countDots, scaleCounts, scaleRadii } from './engine/profiles';
import { MODE_DRAWS, MODE_FRAMES } from './engine/registry';
import type { OrbState } from './engine/types';
import { GOLDEN, GOLDEN_RESOLVED, GOLDEN_TIMES } from './fixtures';
import { styles } from './styles';
import { ancestorSubstrate } from './theme';
import {
  ORB_SIZES,
  ORB_STATES,
  ORB_THINKING_STATE,
  ORB_TOOL_STATES,
  orbCanDraw,
  orbFit,
  orbOptions,
  orbPlan,
  orbSizeOf,
  orbStateForTool,
  orbStateOf,
  parseTint,
  STILL_T,
  STRINGS,
  type ThinkingOrbData,
  type UiThinkingOrb,
} from './thinking-orb';

const XSS = '<img src=x onerror=alert(1)>';

// ── Fakes: a rAF clock the test drives, observers it fires, media queries it flips, a recording 2D context ─────────

let frames: Map<number, FrameRequestCallback>;
let frameId = 0;
let clock = 0;
let reduce = false;
let dark = false;
let media: Map<string, Set<() => void>>;

class FakeRO {
  static all: FakeRO[] = [];
  disconnected = false;
  constructor(readonly cb: ResizeObserverCallback) {
    FakeRO.all.push(this);
  }
  observe() {}
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
  fire(target: Node) {
    this.cb([{ target } as unknown as MutationRecord], this as unknown as MutationObserver);
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

interface Drawn {
  arcs: Array<{ x: number; y: number; r: number; fill: string }>;
  lines: Array<{ stroke: string; w: number }>;
  clears: number;
  transform: number[];
}

/** A 2D context that records what was drawn. */
function recorder(): { ctx: CanvasRenderingContext2D; drawn: Drawn } {
  const drawn: Drawn = { arcs: [], lines: [], clears: 0, transform: [] };
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    setTransform(...m: number[]) {
      drawn.transform = m;
    },
    clearRect() {
      drawn.clears++;
      drawn.arcs.length = 0;
      drawn.lines.length = 0;
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arc(x: number, y: number, r: number) {
      drawn.arcs.push({ x, y, r, fill: ctx.fillStyle });
    },
    fill() {},
    stroke() {
      drawn.lines.push({ stroke: ctx.strokeStyle, w: ctx.lineWidth });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, drawn };
}

function paintSpy(): Drawn {
  const { ctx, drawn } = recorder();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx as never);
  return drawn;
}

beforeEach(() => {
  document.body.innerHTML = '';
  frames = new Map();
  frameId = 0;
  clock = 1000;
  reduce = false;
  dark = false;
  media = new Map();
  FakeRO.all = [];
  FakeIO.all = [];
  FakeMO.all = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++frameId, cb);
    return frameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
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

function mount(data?: ThinkingOrbData, attrs: Record<string, string> = {}): UiThinkingOrb {
  const el = document.createElement('ui-thinking-orb');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (data) el.data = data;
  document.body.append(el);
  el.renderNow();
  return el;
}
const box = (el: UiThinkingOrb) => el.shadowRoot!.querySelector<HTMLElement>('.orb')!;
const said = (el: UiThinkingOrb) => el.shadowRoot!.querySelector('.sr-only')!.textContent;
const ro = () => FakeRO.all[FakeRO.all.length - 1]!;
const io = () => FakeIO.all[FakeIO.all.length - 1]!;
function step(ms = 16): boolean {
  const due = Array.from(frames.values());
  frames.clear();
  clock += ms;
  for (const cb of due) cb(clock);
  return due.length > 0;
}

// ── The engine, against upstream's golden vectors ──────────────────────────────────────────────────────────────

describe('engine — golden vectors', () => {
  it('resolves every (state, size) preset exactly as upstream', () => {
    for (const [key, want] of Object.entries(GOLDEN_RESOLVED)) {
      const [state, size] = key.split('-') as [OrbState, string];
      const got = resolvePreset(state, Number(size) as 64 | 20);
      expect(got.mode, key).toBe(want.mode);
      expect(got.speed, key).toBe(want.speed);
      expect(Object.keys(got.opts).sort(), key).toEqual(Object.keys(want.opts).sort());
      for (const [k, v] of Object.entries(want.opts)) expect(got.opts[k], `${key}.${k}`).toBeCloseTo(v, 9);
    }
  });

  it(`draws every state × size × t (${GOLDEN.length} cases) to within 1e-4 of upstream`, () => {
    expect(GOLDEN).toHaveLength(9 * 2 * GOLDEN_TIMES.length);
    const close = (got: number[], want: number[], what: string) => {
      expect(got.length, what).toBe(want.length);
      got.forEach((g, i) => {
        expect(Math.abs(g - want[i]!), `${what}[${i}] ${g} vs ${want[i]}`).toBeLessThan(1e-4);
      });
    };
    const dot = (d: Dot) => [d.x, d.y, d.z, d.r, d.white, d.a ?? 1];
    for (const [key, n, m, sums, first, mid, last, line] of GOLDEN) {
      const parts = key.split('-');
      const t = Number(parts.pop());
      const size = Number(parts.pop()) as 64 | 20;
      const { mode, opts } = resolvePreset(parts.join('-') as OrbState, size);
      const f = MODE_FRAMES[mode](size, t, opts);
      expect(f.dots.length, key).toBe(n);
      expect(f.lines.length, key).toBe(m);
      close(dot(f.dots[0]!), first, `${key} first`);
      close(dot(f.dots[Math.floor(n / 2)]!), mid, `${key} mid`);
      close(dot(f.dots[n - 1]!), last, `${key} last`);
      if (m) {
        const l = f.lines[0]!;
        close([l.x1, l.y1, l.x2, l.y2, l.white, l.a ?? 1, l.w], line, `${key} line`);
      }
      const got = [0, 1, 2, 3, 4, 5].map((i) => f.dots.reduce((s, d) => s + dot(d)[i]!, 0));
      got.forEach((g, i) => {
        expect(Math.abs(g - sums[i]!), `${key} sum[${i}]`).toBeLessThan(2e-3);
      });
    }
  });

  it('a frame is finished: z-sorted far → near, radii floored, faint marks culled', () => {
    const f = finalizeFrame(
      [
        { x: 0, y: 0, z: 0.5, r: 0.1, white: 0 },
        { x: 0, y: 0, z: -0.5, r: 2, white: 0 },
        { x: 0, y: 0, z: 0, r: 1, white: 0, a: 0.01 },
      ],
      [{ x1: 0, y1: 0, x2: 1, y2: 1, white: 0, w: 1, a: 0.001 }],
      0.3,
    );
    expect(f.dots.map((d) => d.z)).toEqual([-0.5, 0.5]);
    expect(f.dots[1]!.r).toBe(0.3);
    expect(f.lines).toEqual([]);
    const p = makeProj(0, 0, 10, 10, 2)(1, 1, 0);
    expect(p).toEqual([12, 8, 0]);
  });

  it('scalers: paired counts take √, flat counts scale, 0 stays opted out, radii record their multiplier', () => {
    const o = scaleCounts({ latRings: 16, lonDensity: 40, ghostN: 0, nodeN: 10, iconD: 1 }, 4);
    expect(o).toMatchObject({ latRings: 32, lonDensity: 80, ghostN: 0, nodeN: 40, iconD: 4 });
    expect(scaleCounts({ latRings: 2, lonDensity: 2 }, 0.01)).toMatchObject({ latRings: 2, lonDensity: 2 });
    const r = scaleRadii(scaleRadii({ rBase: 1, rDepth: 2 }, 2), 1.5);
    expect(r).toMatchObject({ rBase: 3, rDepth: 6, rSizeMul: 3 });
    expect(countDots({ latRings: 10, lonDensity: 20, orbitN: 5, ghostN: 0 })).toBe(205);
  });

  it('paints lines first, then dots, mirroring the ink on dark and keeping the depth ramp on a tint', () => {
    const { ctx, drawn } = recorder();
    paintFrame(
      ctx,
      {
        dots: [{ x: 1, y: 2, z: 0, r: 3, white: 0.2, a: 0.5 }],
        lines: [{ x1: 0, y1: 0, x2: 1, y2: 1, white: 0.42, w: 0.8 }],
      },
      true,
    );
    expect(drawn.lines).toEqual([{ stroke: 'rgba(148,148,148,1)', w: 0.8 }]);
    expect(drawn.arcs).toEqual([{ x: 1, y: 2, r: 3, fill: 'rgba(204,204,204,0.5)' }]);
    const light = recorder();
    paintFrame(light.ctx, { dots: [{ x: 0, y: 0, z: 0, r: 1, white: 0.2 }], lines: [] }, false);
    expect(light.drawn.arcs[0]!.fill).toBe('rgba(51,51,51,1)');
    const tinted = recorder();
    paintFrame(tinted.ctx, { dots: [{ x: 0, y: 0, z: 0, r: 1, white: 0.5 }], lines: [] }, true, {
      r: 200,
      g: 100,
      b: 0,
    });
    expect(tinted.drawn.arcs[0]!.fill).toBe('rgba(100,50,0,1)');
    expect(Object.keys(MODE_DRAWS)).toEqual(Object.keys(MODE_FRAMES));
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────

describe('helpers', () => {
  const none = () => null;
  it('options: upstream defaults; data over attributes; clamped; sizes snap', () => {
    expect(orbOptions({}, none)).toEqual({
      state: 'working',
      size: 64,
      theme: 'auto',
      motion: 'system',
      speed: 1,
      paused: false,
      color: '',
      dots: 1,
      dotSize: 1,
    });
    const attrs: Record<string, string> = {
      state: 'Searching',
      size: '20',
      speed: '99',
      paused: '',
      dots: '0',
      'dot-size': '9',
    };
    const o = orbOptions({ state: 'solving' }, (n) => attrs[n] ?? null);
    expect(o).toMatchObject({ state: 'solving', size: 20, speed: 10, paused: true, dots: 0.1, dotSize: 4 });
    expect(orbOptions({}, (n) => (n === 'paused' ? 'false' : null)).paused).toBe(false);
    expect(orbOptions({ state: 'dancing' as never, speed: Number.NaN }, none)).toMatchObject({
      state: 'working',
      speed: 1,
    });
    expect(orbSizeOf(48)).toBe(64);
    expect(orbSizeOf(30)).toBe(32);
    expect(orbSizeOf('24')).toBe(20);
    expect(orbSizeOf(1)).toBe(20);
    expect(orbSizeOf('big')).toBe(64);
    expect(ORB_SIZES).toEqual([64, 32, 20]);
    expect(ORB_STATES).toHaveLength(9);
  });

  it('labels: upstream’s English, and Korean, for every state', () => {
    for (const s of ORB_STATES) {
      expect(STRINGS.en[s]).toMatch(/…$/);
      expect(STRINGS.ko[s]).toMatch(/…$/);
    }
    expect(STRINGS.en.breathing).toBe('Thinking…');
    expect(STRINGS.ko.searching).toBe('검색 중…');
  });

  it('parseTint: #rgb, #rrggbb, rgb() / rgba(); anything else is no tint', () => {
    expect(parseTint('#7cd4ff')).toEqual({ r: 124, g: 212, b: 255 });
    expect(parseTint('#fa0')).toEqual({ r: 255, g: 170, b: 0 });
    expect(parseTint(' rgb(10, 20, 30) ')).toEqual({ r: 10, g: 20, b: 30 });
    expect(parseTint('rgba(300, 2.6, 0, 0.5)')).toEqual({ r: 255, g: 3, b: 0 });
    expect(parseTint('oklch(0.7 0.1 200)')).toBeUndefined();
    expect(parseTint('#12')).toBeUndefined();
    expect(parseTint('')).toBeUndefined();
    expect(parseTint(undefined)).toBeUndefined();
  });

  it('plan: the preset, then dots, dotSize and raw numeric opts; a custom frame replaces the geometry', () => {
    const o = orbOptions({ state: 'searching' }, none);
    const base = orbPlan(o);
    expect(base.frame).toBe(MODE_FRAMES.globe);
    expect(base.speed).toBe(2.015);
    expect(base.opts).toBe(resolvePreset('searching', 64).opts);
    const dense = orbPlan(
      { ...o, dots: 4, dotSize: 2, speed: 0.5 },
      { scanMul: 1, junk: 'x' as never, bad: Number.NaN },
    );
    expect(dense.opts.latRings).toBe(22);
    expect(dense.opts.rBase).toBeCloseTo(0.69 * 2);
    expect(dense.opts.scanMul).toBe(1);
    expect('junk' in dense.opts || 'bad' in dense.opts).toBe(false);
    expect(dense.speed).toBeCloseTo(1.0075);
    // The cached preset was not touched.
    expect(resolvePreset('searching', 64).opts.latRings).toBe(11);
    const mine = () => ({ dots: [], lines: [] });
    expect(orbPlan(o, undefined, mine).frame).toBe(mine);
  });

  it('fit: the tuned size scaled into the box, centred', () => {
    expect(orbFit(64, 64, 64)).toEqual({ scale: 1, x: 0, y: 0 });
    expect(orbFit(56, 56, 64)).toEqual({ scale: 0.875, x: 0, y: 0 });
    expect(orbFit(100, 40, 20)).toEqual({ scale: 2, x: 30, y: 0 });
    expect(orbFit(0, 40, 20)).toEqual({ scale: 1, x: 0, y: 0 });
  });
});

describe('an agent’s tool → a state', () => {
  it('the table: reading searches, editing composes, the shell works, sub-agents weave, todos shape', () => {
    const want: Record<string, string> = {
      Read: 'searching',
      Grep: 'searching',
      Glob: 'searching',
      WebSearch: 'searching',
      WebFetch: 'searching',
      Edit: 'composing',
      Write: 'composing',
      MultiEdit: 'composing',
      NotebookEdit: 'composing',
      Bash: 'working',
      Task: 'weaving',
      Agent: 'weaving',
      TodoWrite: 'shaping',
    };
    for (const [tool, state] of Object.entries(want)) expect(orbStateForTool(tool), tool).toBe(state);
    // Every state the table names is a real one.
    for (const state of Object.values(ORB_TOOL_STATES)) expect(ORB_STATES).toContain(state);
    expect(Object.isFrozen(ORB_TOOL_STATES)).toBe(true);
  });

  it('MCP tools connect; any case and spaces; anything else — or nothing — is the thinking state', () => {
    expect(orbStateForTool('mcp__github__create_pull_request')).toBe('connecting');
    expect(orbStateForTool('MCP__slack__send')).toBe('connecting');
    expect(orbStateForTool(' read ')).toBe('searching');
    expect(orbStateForTool('BASH')).toBe('working');
    expect(ORB_THINKING_STATE).toBe('breathing');
    for (const other of ['', '   ', 'SomethingNew', 'constructor', '__proto__', 'mcp_single', 'toString'])
      expect(orbStateForTool(other), other).toBe('breathing');
    expect(orbStateForTool(undefined as never)).toBe('breathing');
    expect(orbStateForTool(null as never)).toBe('breathing');
    expect(STRINGS.en[orbStateForTool('')]).toBe('Thinking…');
    expect(STRINGS.ko[orbStateForTool('')]).toBe('생각 중…');
  });

  it('orbStateOf: a state name in any case, else the fallback', () => {
    expect(orbStateOf('Searching')).toBe('searching');
    expect(orbStateOf('nope')).toBe('breathing');
    expect(orbStateOf(undefined, 'working')).toBe('working');
    expect(orbStateOf('<b>')).toBe('breathing');
  });

  it('orbCanDraw: the element is defined and a 2D context exists; never throws', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
    expect(orbCanDraw()).toBe(false);
    paintSpy();
    expect(orbCanDraw()).toBe(true);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(orbCanDraw()).toBe(false);
  });

  it('a library element above it pinned with theme="dark|light" sets the substrate (its tokens follow it)', () => {
    const host = document.createElement('ui-ai-answer');
    host.setAttribute('theme', 'dark');
    const inner = document.createElement('span');
    host.append(inner);
    document.body.append(host);
    expect(ancestorSubstrate(inner)).toBe('dark');
    // Only on ui-* elements: a plain element's theme attribute is not the library's.
    const div = document.createElement('div');
    div.setAttribute('theme', 'dark');
    const leaf = document.createElement('span');
    div.append(leaf);
    document.body.append(div);
    expect(ancestorSubstrate(leaf)).toBeNull();
  });
});

// ── The element ──────────────────────────────────────────────────────────────────────────────────────────────────

describe('<ui-thinking-orb>', () => {
  it('a loader: role="status", the state’s label as its name and as hidden text; the canvas aria-hidden', () => {
    paintSpy();
    const el = mount({ state: 'searching' });
    expect(box(el).getAttribute('role')).toBe('status');
    expect(box(el).getAttribute('aria-label')).toBe('Searching…');
    expect(said(el)).toBe('Searching…');
    expect(el.shadowRoot!.querySelector('canvas')!.getAttribute('aria-hidden')).toBe('true');
    el.setAttribute('state', 'breathing');
    el.data = {};
    el.renderNow();
    expect(box(el).getAttribute('aria-label')).toBe('Thinking…');
    expect(said(el)).toBe('Thinking…');
    expect(styles).toContain('display: inline-block');
  });

  it('lang="ko", a custom label (escaped), and decorative', () => {
    paintSpy();
    const el = mount({ state: 'composing' }, { lang: 'ko' });
    expect(box(el).getAttribute('aria-label')).toBe('작성 중…');
    el.data = { state: 'composing', label: XSS };
    el.renderNow();
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    expect(said(el)).toBe(XSS);
    expect(box(el).getAttribute('aria-label')).toBe(XSS);
    const fresh = mount({ label: XSS });
    expect(fresh.shadowRoot!.querySelector('img')).toBeNull();
    expect(fresh.shadowRoot!.innerHTML).toContain('&lt;img');
    el.data = { decorative: true };
    el.renderNow();
    expect(box(el).getAttribute('role')).toBeNull();
    expect(box(el).getAttribute('aria-label')).toBeNull();
    expect(box(el).getAttribute('aria-hidden')).toBe('true');
    expect(said(el)).toBe('');
    expect(el.label).toBe('');
  });

  it('draws the tuned geometry, scaled into its box at the device ratio (2 at most)', () => {
    const drawn = paintSpy();
    vi.stubGlobal('devicePixelRatio', 3);
    const el = mount({ state: 'searching', size: 20 });
    const sheet = el.shadowRoot!.querySelectorAll('style')[1]!.textContent;
    expect(sheet).toBe(':host { width: 20px; height: 20px; }');
    ro().fire(40, 40);
    const c = el.shadowRoot!.querySelector('canvas')!;
    expect([c.width, c.height]).toEqual([80, 80]);
    expect(drawn.transform).toEqual([4, 0, 0, 4, 0, 0]);
    const { opts } = resolvePreset('searching', 20);
    const want = MODE_FRAMES.globe(20, (clock / 1000) * 2.665, opts);
    expect(drawn.arcs).toHaveLength(want.dots.length);
    expect(drawn.arcs[0]!.x).toBeCloseTo(want.dots[0]!.x, 6);
  });

  it('runs on the shared clock: two orbs of a state draw the same instant', () => {
    const drawn = paintSpy();
    const a = mount({ state: 'listening' });
    ro().fire(64, 64);
    const first = drawn.arcs.map((x) => x.x);
    const b = mount({ state: 'listening' });
    FakeRO.all[FakeRO.all.length - 1]!.fire(64, 64);
    expect(drawn.arcs.map((x) => x.x)).toEqual(first);
    expect(a.running && b.running).toBe(true);
  });

  it('the loop: each frame redraws; offscreen, hidden tab and paused stop it; back on screen it resumes', () => {
    const drawn = paintSpy();
    const el = mount({ state: 'working' });
    ro().fire(64, 64);
    expect(el.running).toBe(true);
    const before = drawn.clears;
    expect(step()).toBe(true);
    expect(drawn.clears).toBe(before + 1);
    io().fire(false);
    expect(el.running).toBe(false);
    expect(frames.size).toBe(0);
    io().fire(true);
    expect(el.running).toBe(true);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(el.running).toBe(false);
    Reflect.deleteProperty(document, 'hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(el.running).toBe(true);
    el.setAttribute('paused', '');
    el.renderNow();
    expect(el.running).toBe(false);
    expect(frames.size).toBe(0);
  });

  it('paused holds its instant: a redraw later draws the same frame', () => {
    const drawn = paintSpy();
    const el = mount({ state: 'connecting', paused: true });
    ro().fire(64, 64);
    const held = drawn.arcs.map((a) => a.x);
    clock += 5000;
    el.setAttribute('theme', 'light');
    el.renderNow();
    expect(drawn.arcs.map((a) => a.x)).toEqual(held);
    el.data = { state: 'connecting', paused: false };
    el.renderNow();
    expect(drawn.arcs.map((a) => a.x)).not.toEqual(held);
    expect(el.running).toBe(true);
  });

  it('reduced motion: the still frame at t = 0.6, no loop; motion="full" opts out; the OS flip is live', () => {
    const drawn = paintSpy();
    reduce = true;
    const el = mount({ state: 'shaping' });
    ro().fire(64, 64);
    expect(el.running).toBe(false);
    const { opts } = resolvePreset('shaping', 64);
    const still = MODE_FRAMES.morph(64, STILL_T, opts);
    expect(drawn.arcs.map((a) => a.x)).toEqual(still.dots.map((d) => d.x));
    const full = mount({ state: 'shaping' }, { motion: 'full' });
    expect(full.running).toBe(true);
    reduce = false;
    flip('(prefers-reduced-motion: reduce)');
    el.renderNow();
    expect(el.running).toBe(true);
    el.setAttribute('motion', 'reduce');
    el.renderNow();
    expect(el.running).toBe(false);
  });

  it('theme: dark pins light ink, light pins dark ink; auto follows the page and its switches', () => {
    const drawn = paintSpy();
    const el = mount({ state: 'shaping' }, { theme: 'dark', motion: 'reduce' });
    ro().fire(64, 64);
    // Shaping's ink is 0.1: mirrored on dark (230), as is on light (26).
    expect(drawn.arcs[0]!.fill).toBe('rgba(230,230,230,1)');
    el.setAttribute('theme', 'light');
    el.renderNow();
    expect(drawn.arcs[0]!.fill).toBe('rgba(26,26,26,1)');
    el.removeAttribute('theme');
    document.body.setAttribute('data-theme', 'dark');
    FakeMO.all[FakeMO.all.length - 1]!.fire(document.body);
    el.renderNow();
    expect(el.resolvedTheme).toBe('dark');
    expect(drawn.arcs[0]!.fill).toBe('rgba(230,230,230,1)');
    document.body.className = 'light';
    document.body.removeAttribute('data-theme');
    FakeMO.all[FakeMO.all.length - 1]!.fire(document.body);
    el.renderNow();
    expect(el.resolvedTheme).toBe('light');
    document.body.className = '';
  });

  it('a tint keeps its ramp; raw opts and a custom frame reach the painter; a throwing frame draws nothing', () => {
    const drawn = paintSpy();
    const el = mount({ state: 'shaping', color: '#ff0000', theme: 'dark', motion: 'reduce' });
    ro().fire(64, 64);
    expect(drawn.arcs[0]!.fill).toBe('rgba(230,0,0,1)');
    el.data = { state: 'shaping', opts: { shape: 1 }, motion: 'reduce' };
    el.renderNow();
    const tri = MODE_FRAMES.morph(64, STILL_T, { ...resolvePreset('shaping', 64).opts, shape: 1 });
    expect(drawn.arcs.map((a) => a.y)).toEqual(tri.dots.map((d) => d.y));
    el.data = { frame: () => ({ dots: [{ x: 5, y: 6, z: 0, r: 2, white: 0 }], lines: [] }), motion: 'reduce' };
    el.renderNow();
    expect(drawn.arcs).toEqual([{ x: 5, y: 6, r: 2, fill: expect.any(String) }]);
    el.data = {
      frame: () => {
        throw new Error('boom');
      },
    };
    expect(() => el.renderNow()).not.toThrow();
    expect(drawn.arcs).toEqual([]);
  });

  it('no canvas context (happy-dom, an old engine): the status still says it, nothing throws', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
    const el = mount({ state: 'weaving' });
    expect(() => ro().fire(64, 64)).not.toThrow();
    expect(box(el).getAttribute('role')).toBe('status');
    expect(said(el)).toBe('Weaving…');
  });

  it('disconnect stops the loop and lets go of every observer and listener', () => {
    paintSpy();
    const el = mount();
    expect(el.running).toBe(true);
    el.remove();
    expect(el.running).toBe(false);
    expect(frames.size).toBe(0);
    for (const o of [...FakeRO.all, ...FakeIO.all, ...FakeMO.all]) expect(o.disconnected).toBe(true);
    for (const set of media.values()) expect(set.size).toBe(0);
  });

  it('keeps the canvas node across renders', () => {
    paintSpy();
    const el = mount();
    const c = el.shadowRoot!.querySelector('canvas');
    el.data = { state: 'solving', size: 32 };
    el.renderNow();
    expect(el.shadowRoot!.querySelector('canvas')).toBe(c);
  });
});

describe('docs', () => {
  it('names the source and builds every demo', () => {
    paintSpy();
    expect(doc.group).toBe('Effects');
    expect(doc.reference.url).toBe('https://libraries.dev/orbs');
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const d of doc.demos) {
      const node = d.create();
      document.body.append(node);
      expect(node.querySelectorAll('ui-thinking-orb').length).toBeGreaterThan(0);
    }
  });
});
