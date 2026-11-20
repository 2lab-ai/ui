import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DESIGNS } from '../../core/tokens';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import {
  type BotAvatarData,
  botAvatarBody,
  botAvatarColor,
  botAvatarFor,
  botAvatarOutlineKey,
  botAvatarSurface,
  botAvatarSvg,
  type UiBotAvatar,
} from './bot-avatar';
import { doc } from './docs';
import { OVERSCAN, RISE } from './engine/draw';
import { botAvatarPalette, botAvatarPresets, botAvatarTypes } from './engine/presets';
import { SHAPE_PARTS, SHAPE_PATHS } from './engine/shapes';
import * as index from './index';
import { styles } from './styles';

const XSS = '<img src=x onerror=alert(1)>';

// ── Fakes: a rAF clock the test drives, observers it fires, media queries it flips, a canvas that records ────────

let frames: Map<number, FrameRequestCallback>;
let frameId = 0;
let rafCalls = 0;
let clock = 0;
let reduce = false;
let media: Map<string, Set<() => void>>;

class FakeIO {
  static all: FakeIO[] = [];
  targets: Element[] = [];
  disconnected = false;
  constructor(readonly cb: IntersectionObserverCallback) {
    FakeIO.all.push(this);
  }
  observe(t: Element) {
    this.targets.push(t);
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

/** A no-op Path2D (happy-dom has none). */
class FakePath2D {
  constructor(readonly d?: string) {}
  addPath() {}
  moveTo() {}
  lineTo() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
  arc() {}
  arcTo() {}
  ellipse() {}
  rect() {}
  roundRect() {}
  closePath() {}
}

/** Anything: every property is itself, every call returns itself (gradients, patterns …). */
function anything(): unknown {
  const fn = () => proxy;
  const proxy: unknown = new Proxy(fn, {
    get: (_t, k) => (k === Symbol.toPrimitive ? () => 0 : proxy),
    apply: () => proxy,
  });
  return proxy;
}

/** A 2D context that takes every call and counts the frames drawn (each draw starts with clearRect). */
function paint(opts: { throwOn?: string } = {}) {
  const drawn = { frames: 0, calls: 0 };
  const any = anything();
  const make = (canvas: HTMLCanvasElement) => {
    const state: Record<string | symbol, unknown> = { canvas, globalAlpha: 1 };
    return new Proxy(state, {
      get(t, k) {
        if (k in t) return t[k];
        if (k === 'getImageData')
          return (_x: number, _y: number, w: number, h: number) => ({
            data: new Uint8ClampedArray(Math.max(1, w * h * 4)),
            width: w,
            height: h,
          });
        if (k === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
        if (k === 'isPointInPath' || k === 'isPointInStroke') return () => false;
        if (k === 'measureText') return () => ({ width: 0 });
        return (..._args: unknown[]) => {
          drawn.calls++;
          if (k === opts.throwOn) throw new Error('boom');
          if (k === 'clearRect') drawn.frames++;
          return any;
        };
      },
      set(t, k, v) {
        t[k] = v;
        return true;
      },
    });
  };
  const ctxs = new WeakMap<HTMLCanvasElement, unknown>();
  vi.stubGlobal('Path2D', FakePath2D);
  // The element's own canvas draws; the engine's scratch canvases (bakes) get no context, so a bake never lands.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    if (!this.classList.contains('ba-canvas')) return null;
    let c = ctxs.get(this);
    if (!c) {
      c = make(this);
      ctxs.set(this, c);
    }
    return c as CanvasRenderingContext2D;
  } as unknown as HTMLCanvasElement['getContext']);
  return drawn;
}

beforeEach(() => {
  document.body.innerHTML = '';
  frames = new Map();
  frameId = 0;
  rafCalls = 0;
  clock = 1000;
  reduce = false;
  media = new Map();
  FakeIO.all = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCalls++;
    frames.set(++frameId, cb);
    return frameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    frames.delete(id);
  });
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      if (query.includes('prefers-reduced-motion')) return reduce;
      return false;
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => listeners(query).add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners(query).delete(fn),
  }));
  vi.stubGlobal('IntersectionObserver', FakeIO);
});

afterEach(() => {
  document.body.innerHTML = '';
  Reflect.deleteProperty(document, 'hidden');
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mount(attrs: Record<string, string> = {}, data?: BotAvatarData): UiBotAvatar {
  const el = document.createElement('ui-bot-avatar');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (data) el.data = data;
  document.body.append(el);
  el.renderNow();
  return el;
}
const box = (el: UiBotAvatar) => el.shadowRoot!.querySelector<HTMLElement>('.ba')!;
const canvasOf = (el: UiBotAvatar) => el.shadowRoot!.querySelector<HTMLCanvasElement>('canvas')!;
const ioOf = (el: UiBotAvatar) => FakeIO.all.find((o) => o.targets.includes(canvasOf(el)) && !o.disconnected);
/** Run the frames that are due, `ms` later. True when one ran. */
function step(ms = 16): boolean {
  const due = Array.from(frames.values());
  frames.clear();
  clock += ms;
  for (const cb of due) cb(clock);
  return due.length > 0;
}

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────

describe('botAvatarFor', () => {
  it('is deterministic: the same name (trimmed, any case) gives the same shape, colour and seed', () => {
    const a = botAvatarFor('Release captain');
    expect(botAvatarFor('Release captain')).toEqual(a);
    expect(botAvatarFor('  release CAPTAIN ')).toEqual(a);
    expect(botAvatarTypes).toContain(a.shape);
    expect(Object.values(botAvatarPalette)).toContain(a.color);
    expect(a.seed).toBeGreaterThanOrEqual(0);
    expect(a.seed).toBeLessThan(1);
  });

  it('pins a few faces, so a change to the dealing is a visible decision', () => {
    expect(botAvatarFor('claude-opus')).toEqual(botAvatarFor('claude-opus'));
    const faces = ['Release captain', 'Code reviewer', 'Inbox triage', 'Night shift'].map((n) => {
      const f = botAvatarFor(n);
      return `${f.shape}:${f.color}`;
    });
    expect(faces).toMatchInlineSnapshot(`
      [
        "blob:#EB7575",
        "ghost:#ABC793",
        "mech:#9A62FF",
        "puddle:#95A6C4",
      ]
    `);
  });

  it('spreads names over the shapes and the colours, and copes with anything', () => {
    const shapes = new Set<string>();
    const colors = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const f = botAvatarFor(`agent-${i}`);
      shapes.add(f.shape);
      colors.add(f.color);
    }
    expect(shapes.size).toBe(18);
    expect(colors.size).toBeGreaterThanOrEqual(15);
    for (const v of [undefined, null, '', 42, {}, XSS]) expect(botAvatarTypes).toContain(botAvatarFor(v).shape);
    expect(botAvatarFor(undefined)).toEqual(botAvatarFor(''));
  });
});

describe('botAvatarColor and botAvatarBody', () => {
  it('takes #rgb, #rrggbb, rgb(), hsl() and a shape name; anything else is null', () => {
    expect(botAvatarColor('#f0a')).toBe('#f0a');
    expect(botAvatarColor(' #FF5C8A ')).toBe('#FF5C8A');
    expect(botAvatarColor('rgb(10, 20, 30)')).toBe('rgb(10, 20, 30)');
    expect(botAvatarColor('hsl(200 80% 60%)')).toBe('hsl(200 80% 60%)');
    expect(botAvatarColor('Puddle')).toBe(botAvatarPresets.puddle.color);
    for (const v of ['red', 'var(--accent)', '#12', '', XSS, '"><script>', null, 7])
      expect(botAvatarColor(v)).toBeNull();
  });

  it('leaves a colour as it is at brightness 1 and saturation 1; brighter, duller and more vivid change it', () => {
    expect(botAvatarBody('#41C4FF', 1, 1)).toBe('#41C4FF');
    const lighter = botAvatarBody('#41C4FF', 1.5, 1);
    expect(lighter).toMatch(/^hsl\(/);
    expect(lighter).not.toBe(botAvatarBody('#41C4FF', 0.5, 1));
    expect(botAvatarBody('#41C4FF', 1, 2.2)).toMatch(/^rgb\(/);
  });
});

describe('botAvatarSvg', () => {
  it('draws the outline in the colour, the antennae, and two open eyes on the face', () => {
    const svg = botAvatarSvg({ shape: 'droid', body: '#D5DBEA' });
    expect(svg).toContain(`d="${SHAPE_PATHS.droid}"`);
    expect(svg).toContain(`d="${SHAPE_PARTS.droid}"`);
    expect(svg).toContain('fill="#D5DBEA"');
    expect(svg.match(/stroke-width="12.6"/g)).toHaveLength(2);
    const p = botAvatarPresets.droid;
    expect(svg).toContain(`translate(${p.faceX} ${p.faceY}) scale(${p.faceScale})`);
  });

  it('a sleeping face has lids; the mouth face a smile, an open mouth or an “o”', () => {
    expect(botAvatarSvg({ state: 'sleeping' }).match(/stroke-width="4"/g)).toHaveLength(2);
    expect(botAvatarSvg({ face: 'mouth' })).toContain('stroke-width="3.8"');
    expect(botAvatarSvg({ face: 'mouth', state: 'working' })).toContain('Z" fill=');
    expect(botAvatarSvg({ face: 'mouth', state: 'sleeping' })).toContain('<circle');
    expect(botAvatarSvg({ face: 'eyes', state: 'sleeping' })).not.toContain('<circle');
  });

  it('defaults to clover; light ink on a dark body; escapes and refuses anything that is not a colour or path data', () => {
    expect(botAvatarSvg()).toContain(`d="${SHAPE_PATHS.clover}"`);
    expect(botAvatarSvg({ body: '#111111' })).toContain('stroke="#F7F5F2"');
    const svg = botAvatarSvg({
      shape: 'nope' as never,
      path: `M0 0"/><script>alert(1)</script>`,
      body: `#fff" onload="alert(1)`,
      ink: XSS,
    });
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('onload');
    expect(svg).not.toContain('<img');
    expect(svg).toContain(`d="${SHAPE_PATHS.clover}"`);
    // Real path data is used as given.
    const heart = 'M50 88C50 88 12 64 12 38C12 24 23 14 35 14Z';
    expect(botAvatarSvg({ path: heart })).toContain(`d="${heart}"`);
  });
});

describe('module', () => {
  it('index re-exports the element and the helpers', () => {
    expect(index.UiBotAvatar).toBe(customElements.get('ui-bot-avatar'));
    expect(index.botAvatarFor).toBe(botAvatarFor);
    expect(index.botAvatarTypes).toHaveLength(18);
    expect(typeof index.BotAvatarSim).toBe('function');
    expect(index.botAvatarShapes.clover).toBe(SHAPE_PATHS.clover);
  });

  it('the CSS overscan matches the engine’s (1.5 × the box, the body 0.1 below the middle)', () => {
    const side = (OVERSCAN - 1) / 2;
    expect(styles).toContain(`* -${side})`);
    expect(styles).toContain(`* -${side + RISE})`);
    expect(styles).toContain(`* ${OVERSCAN})`);
  });

  it('docs: Effects, the Libraries.dev reference and at least three demos that build', () => {
    expect(doc.group).toBe('Effects');
    expect(doc.reference.url).toBe('https://libraries.dev/bots');
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const d of doc.demos) expect(d.create()).toBeInstanceOf(HTMLElement);
  });
});

// ── The element without a canvas (happy-dom): the still SVG ────────────────────────────────────────────────────

describe('fallback (no 2D canvas)', () => {
  it('shows the still SVG, named role="img" with the state, and runs no loop', () => {
    const el = mount({ shape: 'ghost', state: 'working' });
    expect(el.fallback).toBe(true);
    expect(el.shown).toBe(true);
    expect(el.running).toBe(false);
    const b = box(el);
    expect(b.hasAttribute('data-fallback')).toBe(true);
    expect(b.getAttribute('role')).toBe('img');
    expect(b.getAttribute('aria-label')).toBe('AI agent avatar, working');
    expect(b.dataset.shape).toBe('ghost');
    expect(b.dataset.state).toBe('working');
    const still = el.shadowRoot!.querySelector('.ba-still')!;
    expect(still.getAttribute('aria-hidden')).toBe('true');
    expect(still.innerHTML).toContain(SHAPE_PATHS.ghost);
    expect(canvasOf(el).getAttribute('aria-hidden')).toBe('true');
    expect(rafCalls).toBe(0);
    expect(FakeIO.all).toHaveLength(0);
  });

  it('follows the data: a new shape, state and colour redraw the still', async () => {
    const el = mount();
    el.data = { shape: 'cat', state: 'sleeping', color: '#ff5c8a', brightness: 1, saturation: 1 };
    await Promise.resolve();
    const still = el.shadowRoot!.querySelector('.ba-still')!.innerHTML;
    expect(still).toContain(SHAPE_PATHS.cat);
    expect(still).toContain('fill="#ff5c8a"');
    expect(still.match(/stroke-width="4"/g)).toHaveLength(2);
    expect(box(el).getAttribute('aria-label')).toBe('AI agent avatar, sleeping');
  });

  it('sizes the box from size (12 … 512)', () => {
    expect(box(mount({ size: '36' })).style.getPropertyValue('--ba-size')).toBe('36px');
    expect(box(mount({ size: '9999' })).style.getPropertyValue('--ba-size')).toBe('512px');
    expect(box(mount({ size: 'big' })).style.getPropertyValue('--ba-size')).toBe('64px');
  });
});

describe('a11y and strings', () => {
  it('label names it and the state follows; decorative hides it', async () => {
    const el = mount({ label: 'Release captain', state: 'idle' });
    expect(box(el).getAttribute('aria-label')).toBe('Release captain, idle');
    el.setAttribute('state', 'sleeping');
    await Promise.resolve();
    expect(box(el).getAttribute('aria-label')).toBe('Release captain, sleeping');
    el.setAttribute('decorative', '');
    await Promise.resolve();
    expect(box(el).getAttribute('aria-hidden')).toBe('true');
    expect(box(el).hasAttribute('role')).toBe(false);
    expect(box(el).hasAttribute('aria-label')).toBe(false);
    const d = mount({}, { decorative: true });
    expect(box(d).getAttribute('aria-hidden')).toBe('true');
  });

  it('lang="ko": the name and the states in Korean', () => {
    expect(box(mount({ lang: 'ko' })).getAttribute('aria-label')).toBe('AI 에이전트 아바타, 대기 중');
    expect(box(mount({ lang: 'ko', state: 'working' })).getAttribute('aria-label')).toBe('AI 에이전트 아바타, 작업 중');
    expect(box(mount({ lang: 'ko', state: 'sleeping', label: '야간 근무' })).getAttribute('aria-label')).toBe(
      '야간 근무, 자는 중',
    );
  });

  it('escapes a host-written label (attribute and data) and never parses it', () => {
    const el = mount({ label: XSS });
    expect(box(el).getAttribute('aria-label')).toBe(`${XSS}, idle`);
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    const d = mount({}, { label: `"><img src=x onerror=alert(1)>` });
    expect(d.shadowRoot!.querySelector('img')).toBeNull();
    expect(box(d).getAttribute('aria-label')).toBe(`"><img src=x onerror=alert(1)>, idle`);
    const p = mount({}, { path: XSS, color: XSS, ink: XSS });
    expect(p.shadowRoot!.querySelector('img')).toBeNull();
  });
});

describe('options', () => {
  it('defaults: clover, idle, 64 px, fabric, the shape’s own colour and face', () => {
    const o = mount().options;
    expect(o.shape).toBe('clover');
    expect(o.state).toBe('default');
    expect(o.size).toBe(64);
    expect(o.shading).toBe('fabric');
    expect(o.color).toBe(botAvatarPresets.clover.color);
    expect(o.face).toBe('eyes');
    expect(o.interactive).toBe(true);
    expect(o.motion).toBe('system');
    expect(o.brightness).toBe(1.2);
    expect(o.saturation).toBe(1.59);
    expect(o.jump.every).toBe(8);
    expect(o.fur).toEqual({ length: 1, density: 1.6, fuzz: 0.9, clumps: 0.4, curl: 0.7, gravity: 0.9 });
  });

  it('names in any case; unknown ones fall back; idle is default; data.type is read; true / false shading', () => {
    expect(mount({ shape: 'MECH' }).options.shape).toBe('mech');
    expect(mount({ shape: 'dragon' }).options.shape).toBe('clover');
    expect(mount({}, { type: 'star' }).options.shape).toBe('star');
    expect(mount({ state: 'Working' }).options.state).toBe('working');
    expect(mount({ state: 'idle' }).options.state).toBe('default');
    expect(mount({ state: 'thinking' }).options.state).toBe('default');
    expect(mount({}, { shading: true }).options.shading).toBe('crisp');
    expect(mount({}, { shading: false }).options.shading).toBe('flat');
    expect(mount({ shading: 'PLASTIC' }).options.shading).toBe('plastic');
    expect(mount({ face: 'mouth' }).options.face).toBe('mouth');
  });

  it('data wins over attributes', () => {
    const o = mount(
      { shape: 'ghost', state: 'sleeping', size: '20' },
      { shape: 'cat', state: 'working', size: 40 },
    ).options;
    expect([o.shape, o.state, o.size]).toEqual(['cat', 'working', 40]);
  });

  it('colours: any parseable colour or a shape’s name; else the shape’s own; the ink follows the body', () => {
    expect(mount({ color: 'puddle' }).options.color).toBe(botAvatarPresets.puddle.color);
    expect(mount({ shape: 'flower', color: 'chartreuse' }).options.color).toBe(botAvatarPresets.flower.color);
    const dark = mount({}, { color: '#111111', brightness: 1, saturation: 1 }).options;
    expect(dark.body).toBe('#111111');
    expect(dark.ink).toBe('#F7F5F2');
    expect(mount({}, { ink: '#4D7CFF' }).options.ink).toBe('#4D7CFF');
    expect(mount({}, { accessoryColor: 'nope' }).options.accessoryColor).toBe('#27272b');
  });

  it('clamps every number and keeps non-numbers at their defaults', () => {
    const o = mount(
      {},
      {
        size: 2,
        speed: 99,
        seed: 7,
        depth: 9,
        turn: -3,
        brightness: Number.NaN,
        saturation: 9,
        whirl: 5,
        jumpHeight: 900,
        jumpSpin: 1.6,
        jumpTime: 0,
        lightFront: 200,
        shine: -1,
        furLength: 0,
        furDensity: 1.234,
        jumpSquashEase: 'wobbly' as never,
        hat: 'top hat' as never,
        glasses: 'shades',
      },
    ).options;
    expect(o.size).toBe(12);
    expect(o.speed).toBe(5);
    expect(o.seed).toBe(1);
    expect(o.depth).toBe(2);
    expect(o.turn).toBe(0);
    expect(o.brightness).toBe(1.2);
    expect(o.saturation).toBe(2.5);
    expect(o.whirl.strength).toBe(2);
    expect(o.jump.height).toBe(80);
    expect(o.jump.spin).toBe(2);
    expect(o.jump.time).toBe(0.2);
    expect(o.lightFront).toBe(85);
    expect(o.shine).toBe(0);
    expect(o.backLight).toBeUndefined();
    expect(o.fur.length).toBe(0.3);
    expect(o.fur.density).toBe(1.25);
    expect(o.jump.squashEase).toBe('pulse');
    expect(o.hat).toBe('none');
    expect(o.glasses).toBe('shades');
  });

  it('paused or speed 0 freeze it; interactive="false" turns pointer play off; seeds differ per instance', () => {
    expect(mount({ paused: '' }).options.frozen).toBe(true);
    expect(mount({ paused: 'false' }).options.frozen).toBe(false);
    expect(mount({}, { speed: 0 }).options.frozen).toBe(true);
    expect(mount({ interactive: 'false' }).options.interactive).toBe(false);
    expect(mount({}, { interactive: false }).options.interactive).toBe(false);
    expect(mount().options.seed).not.toBe(mount().options.seed);
    expect(mount({ seed: '0.25' }).options.seed).toBe(0.25);
  });

  it('a held pose takes finite radians only', () => {
    const o = mount({}, { pose: { yaw: 'left' as never, pitch: Number.POSITIVE_INFINITY, roll: 0.2 } }).options;
    expect(o.pose).toEqual({ yaw: undefined, pitch: undefined, roll: 0.2 });
    expect(mount().options.pose).toBeNull();
  });

  it('a custom path keys the caches by itself', () => {
    const heart = 'M50 88C50 88 12 64 12 38Z';
    const o = mount({}, { path: heart }).options;
    expect(o.path).toBe(heart);
    expect(o.outlineKey).toBe(botAvatarOutlineKey(heart));
    expect(mount().options.outlineKey).toBe('clover');
  });
});

describe('botAvatarOutlineKey', () => {
  it('keys a path by its full 32-bit hash and length: same path, same key; 2000 same-length paths, 2000 keys', () => {
    const heart = 'M50 88C50 88 12 64 12 38Z';
    expect(botAvatarOutlineKey(heart)).toBe(botAvatarOutlineKey(`${heart}`));
    expect(botAvatarOutlineKey(heart)).toMatch(/^path:[0-9a-z]+:25$/);
    // A 0–999 seed (the old key) must collide here — 2000 paths in 1000 buckets — the full hash does not.
    const paths = Array.from({ length: 2000 }, (_, i) => `M${String(i).padStart(4, '0')} 0L50 50Z`);
    expect(new Set(paths.map((d) => d.length)).size).toBe(1);
    expect(new Set(paths.map(botAvatarOutlineKey)).size).toBe(2000);
    const a = mount({}, { path: paths[0] }).options.outlineKey;
    const b = mount({}, { path: paths[1] }).options.outlineKey;
    expect(a).not.toBe(b);
  });
});

describe('botAvatarSurface', () => {
  function tree(outer: Record<string, string>, inner: Record<string, string> = {}, cls = ''): HTMLElement {
    const top = document.createElement('div');
    for (const [k, v] of Object.entries(outer)) top.setAttribute(k, v);
    const mid = document.createElement('div');
    for (const [k, v] of Object.entries(inner)) mid.setAttribute(k, v);
    if (cls) mid.className = cls;
    const host = document.createElement('div');
    const leaf = document.createElement('span');
    host.attachShadow({ mode: 'open' }).append(leaf);
    mid.append(host);
    top.append(mid);
    document.body.append(top);
    return leaf;
  }

  it('a pinned theme wins', () => {
    expect(botAvatarSurface(tree({ 'data-theme': 'dark' }), 'light')).toBe('light');
    expect(botAvatarSurface(tree({ 'data-theme': 'light' }), 'dark')).toBe('dark');
  });

  it('walks up through shadow roots: data-design (its scheme), data-theme dark|light, a ui-* theme, the classes', () => {
    const design = DESIGNS[0];
    expect(botAvatarSurface(tree({ 'data-design': design.id, 'data-theme': 'light' }))).toBe(design.scheme);
    expect(botAvatarSurface(tree({ 'data-theme': 'dark' }))).toBe('dark');
    // A data-theme that is neither (or an unknown design) does not stop the walk.
    expect(botAvatarSurface(tree({ 'data-theme': 'light' }, { 'data-theme': 'sepia', 'data-design': 'nope' }))).toBe(
      'light',
    );
    expect(botAvatarSurface(tree({ 'data-theme': 'light' }, {}, 'dark'))).toBe('dark');
    expect(botAvatarSurface(tree({}, {}, 'light'))).toBe('light');
    const pinnedUi = document.createElement('ui-bot-avatar');
    pinnedUi.setAttribute('theme', 'dark');
    document.body.append(pinnedUi);
    expect(botAvatarSurface(pinnedUi)).toBe('dark');
  });

  it('with nothing above, the --text token, then the system', () => {
    let dark = true;
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('prefers-color-scheme: dark') ? dark : false,
      media: q,
      addEventListener() {},
      removeEventListener() {},
    }));
    const leaf = tree({});
    expect(botAvatarSurface(leaf)).toBe('dark');
    dark = false;
    expect(botAvatarSurface(leaf)).toBe('light');
    (leaf as HTMLElement).style.setProperty('--text', '#f4f4f5');
    expect(botAvatarSurface(leaf)).toBe('dark');
    (leaf as HTMLElement).style.setProperty('--text', 'rgb(20, 20, 24)');
    dark = true;
    expect(botAvatarSurface(leaf)).toBe('light');
  });
});

describe('path cache', () => {
  it('reuses an outline, and stays bounded: old custom paths are dropped, recent ones kept', () => {
    paint();
    const made = new Map<string, number>();
    class Counting extends FakePath2D {
      constructor(d?: string) {
        super(d);
        if (d) made.set(d, (made.get(d) ?? 0) + 1);
      }
    }
    vi.stubGlobal('Path2D', Counting);
    const path = (i: number) => `M${i} 0L50 50L0 50Z`;
    mount({ shading: 'crisp' }, { path: path(0) });
    mount({ shading: 'crisp' }, { path: path(0) });
    expect(made.get(path(0))).toBe(1);
    for (let i = 1; i <= 60; i++) mount({ shading: 'crisp' }, { path: path(i) });
    document.body.innerHTML = '';
    mount({ shading: 'crisp' }, { path: path(60) });
    expect(made.get(path(60))).toBe(1);
    mount({ shading: 'crisp' }, { path: path(0) });
    expect(made.get(path(0))).toBe(2);
  });
});

// ── The element with a canvas (a recording context): the loop, the lifecycle, motion ─────────────────────────────

describe('canvas', () => {
  it('draws at once in a vector shading, sized 1.5 × the box × devicePixelRatio, and is shown', () => {
    const drawn = paint();
    vi.stubGlobal('devicePixelRatio', 2);
    const el = mount({ shading: 'crisp', size: '40' });
    expect(el.fallback).toBe(false);
    expect(el.shown).toBe(true);
    expect(box(el).hasAttribute('data-shown')).toBe(true);
    expect(box(el).hasAttribute('data-fallback')).toBe(false);
    expect(drawn.frames).toBeGreaterThan(0);
    expect(canvasOf(el).width).toBe(120);
  });

  it('joins the shared loop only on screen; every avatar shares one frame; off screen it leaves', () => {
    const drawn = paint();
    const a = mount({ shading: 'crisp' });
    const b = mount({ shading: 'flat' });
    const c = mount({ shading: 'smooth' });
    expect(rafCalls).toBe(0);
    for (const el of [a, b, c]) ioOf(el)!.fire(true);
    expect([a.running, b.running, c.running]).toEqual([true, true, true]);
    expect(rafCalls).toBe(1);
    const before = drawn.frames;
    step();
    expect(drawn.frames - before).toBe(3);
    expect(rafCalls).toBe(2);
    ioOf(a)!.fire(false);
    ioOf(b)!.fire(false);
    ioOf(c)!.fire(false);
    expect([a.running, b.running, c.running]).toEqual([false, false, false]);
    expect(frames.size).toBe(0);
  });

  it('no frames while every avatar is paused; a paused one is drawn once, still', async () => {
    const drawn = paint();
    const el = mount({ shading: 'crisp', paused: '' });
    expect(FakeIO.all).toHaveLength(0);
    expect(el.running).toBe(false);
    expect(drawn.frames).toBeGreaterThan(0);
    expect(rafCalls).toBe(0);
    el.removeAttribute('paused');
    await Promise.resolve();
    ioOf(el)!.fire(true);
    expect(el.running).toBe(true);
    el.data = { paused: true };
    await Promise.resolve();
    expect(el.running).toBe(false);
    expect(frames.size).toBe(0);
  });

  it('a hidden tab takes no frames, and picks up when shown', () => {
    paint();
    const el = mount({ shading: 'crisp' });
    ioOf(el)!.fire(true);
    expect(frames.size).toBe(1);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(frames.size).toBe(0);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(frames.size).toBe(1);
  });

  it('disconnect leaves the loop, drops its observer and lets the backing store go; reconnect draws again', () => {
    const drawn = paint();
    const el = mount({ shading: 'crisp' });
    const io = ioOf(el)!;
    io.fire(true);
    expect(el.running).toBe(true);
    el.remove();
    expect(el.running).toBe(false);
    expect(io.disconnected).toBe(true);
    expect(frames.size).toBe(0);
    expect(canvasOf(el).width).toBe(0);
    expect(listeners('(prefers-reduced-motion: reduce)').size).toBe(0);
    const before = drawn.frames;
    document.body.append(el);
    el.renderNow();
    expect(drawn.frames).toBeGreaterThan(before);
    expect(canvasOf(el).width).toBeGreaterThan(0);
  });

  it('reduced motion: the still pose, no loop; motion="full" moves anyway; motion="reduce" stills it', async () => {
    paint();
    reduce = true;
    const el = mount({ shading: 'crisp' });
    expect(FakeIO.all).toHaveLength(0);
    expect(el.running).toBe(false);
    const full = mount({ shading: 'crisp', motion: 'full' });
    ioOf(full)!.fire(true);
    expect(full.running).toBe(true);
    // The system setting changes back: the system one starts moving.
    reduce = false;
    flip('(prefers-reduced-motion: reduce)');
    await Promise.resolve();
    ioOf(el)!.fire(true);
    expect(el.running).toBe(true);
    el.setAttribute('motion', 'reduce');
    await Promise.resolve();
    expect(el.running).toBe(false);
  });

  it('a click asks with a cancelable ui-poke, then hops with a subtle tap', async () => {
    paint();
    const hop = vi.spyOn(index.BotAvatarSim.prototype, 'poke');
    const spy: SoundSpy = soundSpy();
    try {
      const el = mount({ shading: 'crisp' });
      const seen: CustomEvent[] = [];
      document.addEventListener('ui-poke', (e) => seen.push(e as CustomEvent), { once: true });
      el.click();
      await spy.settle();
      expect(seen).toHaveLength(1);
      expect(seen[0].detail).toEqual({});
      expect([seen[0].bubbles, seen[0].composed, seen[0].cancelable]).toEqual([true, true, true]);
      expect(hop).toHaveBeenCalledTimes(1);
      expect(spy.cues()).toEqual(['tap']);
    } finally {
      spy.restore();
    }
  });

  it('prevented, a poke neither hops nor sounds', async () => {
    paint();
    const hop = vi.spyOn(index.BotAvatarSim.prototype, 'poke');
    const spy: SoundSpy = soundSpy();
    try {
      const el = mount({ shading: 'crisp' });
      el.addEventListener('ui-poke', (e) => e.preventDefault());
      el.click();
      await spy.settle();
      expect(hop).not.toHaveBeenCalled();
      expect(spy.calls).toEqual([]);
    } finally {
      spy.restore();
    }
  });

  it('decorative: it hops but plays nothing; not interactive, paused or still: no event, no hop, no sound', async () => {
    paint();
    const hop = vi.spyOn(index.BotAvatarSim.prototype, 'poke');
    const spy: SoundSpy = soundSpy();
    let pokes = 0;
    const count = () => pokes++;
    document.addEventListener('ui-poke', count);
    try {
      mount({ shading: 'crisp', decorative: '' }).click();
      await spy.settle();
      expect([pokes, hop.mock.calls.length, spy.calls.length]).toEqual([1, 1, 0]);
      const others: Array<Record<string, string>> = [{ interactive: 'false' }, { paused: '' }, { motion: 'reduce' }];
      for (const attrs of others) mount({ shading: 'crisp', ...attrs }).click();
      await spy.settle();
      expect([pokes, hop.mock.calls.length, spy.calls.length]).toEqual([1, 1, 0]);
      // poke() from code hops without asking and without a sound.
      mount({ shading: 'crisp' }).poke();
      await spy.settle();
      expect([pokes, hop.mock.calls.length, spy.calls.length]).toEqual([1, 2, 0]);
    } finally {
      document.removeEventListener('ui-poke', count);
      spy.restore();
    }
  });

  it('a state change is a cross-animation: the new pose eases in over frames, then holds', async () => {
    const drawn = paint();
    const el = mount({ shading: 'crisp' });
    ioOf(el)!.fire(true);
    step();
    el.setAttribute('state', 'working');
    await Promise.resolve();
    expect(box(el).dataset.state).toBe('working');
    const before = drawn.frames;
    for (let i = 0; i < 5; i++) step(16);
    expect(drawn.frames - before).toBe(5);
    // The engine's blend: part-way after a tenth of a second, all the way after the switch's 0.7 s.
    const sim = new index.BotAvatarSim(0.3, 'default');
    sim.setState('working');
    sim.update(0.1);
    expect(sim.pose.w[1]).toBeGreaterThan(0);
    expect(sim.pose.w[1]).toBeLessThan(1);
    for (let i = 0; i < 60; i++) sim.update(1 / 60);
    expect(sim.pose.w[1]).toBeCloseTo(1, 5);
    expect(index.botAvatarRestPose('sleeping').w).toEqual([0, 0, 1]);
  });

  it('should the engine ever throw, the still SVG takes over and nothing escapes', async () => {
    paint({ throwOn: 'clearRect' });
    const el = mount({ shading: 'crisp' });
    await Promise.resolve();
    expect(el.fallback).toBe(true);
    expect(el.running).toBe(false);
    expect(el.shadowRoot!.querySelector('.ba-still')!.innerHTML).toContain('<svg');
  });
});

describe('materials (fabric, plastic)', () => {
  it('waits invisible while its material bakes, then is shown after 4 s at most', () => {
    vi.useFakeTimers();
    paint();
    const el = mount({ shading: 'fabric' });
    expect(el.shown).toBe(false);
    expect(box(el).hasAttribute('data-shown')).toBe(false);
    vi.advanceTimersByTime(4100);
    el.renderNow();
    expect(el.shown).toBe(true);
    expect(box(el).hasAttribute('data-shown')).toBe(true);
  });

  it('a disconnected waiter stops waiting (no timer left to show it)', () => {
    vi.useFakeTimers();
    paint();
    const el = mount({ shading: 'plastic' });
    expect(el.shown).toBe(false);
    el.remove();
    vi.advanceTimersByTime(5000);
    expect(el.shown).toBe(false);
  });
});
