import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { doc } from './docs';
import { cssColor, gooFilterMarkup, gooIntercept, sanitizeFilterMarkup, splitShadows } from './engine/filter';
import { measureRadius, normalizeRadius, offsetTo, roundedRectPath } from './engine/geometry';
import {
  createImageMeltRegistry,
  easeToward,
  geomKey,
  IMAGE_MELT_DEFAULTS,
  meltPairMarkup,
  meltProximity,
} from './engine/image-melt';
import { EVOLVE_DEFAULTS, MOVE_DEFAULTS } from './engine/observer';
import { parseShadow } from './engine/shadow';
import { easingFunction, presets, resolveTransition } from './engine/spring';
import { mapBend, mapDissolve, mapMorphSprings, mapMove, zeta } from './engine/tuning';
import { GOOEY_SHADOW, type GooeyData, gooeyOptions, motionOf, type UiGooey } from './gooey';
import { effectOf, type GooeyItemData, gooeyItemPlan, transitionOf, type UiGooeyItem } from './item';

const XSS = '<img src=x onerror=alert(1)>';

// ── Fakes: a rAF clock the test drives, observers it fires, media queries it flips ────────────────────────────────

let frames: Map<number, FrameRequestCallback>;
let frameId = 0;
let clock = 0;
let cancelled: number[] = [];
let reduce = false;
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
  fire() {
    this.cb([], this as unknown as ResizeObserver);
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
  FakeRO.all = [];
  FakeIO.all = [];
  FakeMO.all = [];
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
});

afterEach(() => {
  document.body.innerHTML = '';
  Reflect.deleteProperty(document, 'hidden');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Run the frames that are due, `ms` later. */
function step(ms = 16): number {
  const due = Array.from(frames.values());
  frames.clear();
  clock += ms;
  for (const cb of due) cb(clock);
  return due.length;
}
function settle(max = 400): number {
  let n = 0;
  while (frames.size && n < max) {
    step();
    n++;
  }
  return n;
}
const flush = () => new Promise<void>((r) => queueMicrotask(r));

/** A group with items; each item wraps one child element. Renders synchronously. */
function mount(
  data: GooeyData = {},
  items: Array<{ data?: GooeyItemData; attrs?: Record<string, string>; child?: HTMLElement }> = [],
  attrs: Record<string, string> = {},
): { g: UiGooey; items: UiGooeyItem[] } {
  const g = document.createElement('ui-gooey');
  for (const [k, v] of Object.entries(attrs)) g.setAttribute(k, v);
  g.data = data;
  const made = items.map((spec) => {
    const it = document.createElement('ui-gooey-item');
    for (const [k, v] of Object.entries(spec.attrs ?? {})) it.setAttribute(k, v);
    if (spec.data) it.data = spec.data;
    it.append(spec.child ?? document.createElement('button'));
    g.append(it);
    return it;
  });
  document.body.append(g);
  g.renderNow();
  for (const it of made) it.renderNow();
  return { g, items: made };
}
const portal = (g: UiGooey) => g.shadowRoot!.querySelector('.gy-portal')!;

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────

describe('shadow parser (box-shadow syntax)', () => {
  it('parses layers, inset, defaults and colours with commas inside parentheses', () => {
    expect(parseShadow(undefined)).toEqual([]);
    expect(parseShadow('none')).toEqual([]);
    expect(parseShadow('  ')).toEqual([]);
    const s = parseShadow(
      '0 2px 6px rgba(0, 0, 0, 0.05), inset 0 1px 0 0 color-mix(in srgb, var(--text) 5%, transparent)',
    );
    expect(s).toEqual([
      { x: 0, y: 2, blur: 6, spread: 0, color: 'rgba(0, 0, 0, 0.05)', inset: false },
      { x: 0, y: 1, blur: 0, spread: 0, color: 'color-mix(in srgb, var(--text) 5%, transparent)', inset: true },
    ]);
    expect(parseShadow('0 0 0 1px')[0]).toMatchObject({ spread: 1, color: 'rgba(0, 0, 0, 0.35)' });
  });

  it('the token shadow parses into four layers, one of them inset', () => {
    const s = parseShadow(GOOEY_SHADOW);
    expect(s).toHaveLength(4);
    expect(s.filter((l) => l.inset)).toHaveLength(1);
    expect(s.every((l) => !/#[0-9a-f]{3,8}\b/i.test(l.color))).toBe(true);
  });
});

describe('filter markup', () => {
  it('the goo chain: blur → alpha contrast with the tracking intercept → atop', () => {
    expect(gooIntercept(18)).toBe(-7);
    expect(gooIntercept(40)).toBe(-16.17);
    const m = gooFilterMarkup({ blur: 6, contrast: 18, shadows: [] });
    expect(m).toContain('<feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur"/>');
    expect(m).toContain('values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"');
    expect(m).toContain('operator="atop" result="shape"');
    expect(m).not.toContain('feTurbulence');
    expect(m).not.toContain('feMerge');
    expect(m).not.toContain('result="bin"');
  });

  it('waviness displaces the shape; spread and inset passes share one binarized silhouette', () => {
    const shadows = parseShadow('0 0 0 1px red, inset 0 1px 0 0 blue, 0 4px 10px green');
    const m = gooFilterMarkup({ blur: 6, contrast: 18, shadows, waviness: 3, wavinessFreq: 0.02 });
    expect(m).toContain('result="shape-raw"');
    expect(m).toContain('baseFrequency="0.02"');
    expect(m).toContain('scale="6"');
    expect(m.match(/result="bin"/g)).toHaveLength(1);
    expect(m).toContain('operator="dilate" radius="1"');
    expect(m).toContain('style="flood-color: blue"');
    // Merge: outer layers reversed below the shape, insets above it.
    const merge = m.slice(m.indexOf('<feMerge>'));
    expect(merge).toBe(
      '<feMerge><feMergeNode in="s2"/><feMergeNode in="s0"/><feMergeNode in="shape"/><feMergeNode in="s1"/></feMerge>',
    );
  });

  it('colours cannot leave their declaration or attribute', () => {
    expect(cssColor('red; filter: url(#x)"><script>')).toBe('red filter: url(#x)script');
    const m = gooFilterMarkup({ blur: 1, contrast: 18, shadows: parseShadow(`0 0 0 1px ${XSS}`) });
    expect(m).not.toContain('<img');
    expect(m).not.toContain('onerror=alert(1)>');
  });

  it('splits blurred outer layers to CSS drop-shadow and keeps spread / inset in the svg; pads the region', () => {
    const s = parseShadow('0 0 0 1px red, inset 0 1px 0 0 blue, 0 4px 42px rgba(0,0,0,0.2)');
    const { svg, css, pad } = splitShadows(s, 6, 24);
    expect(svg).toHaveLength(2);
    expect(css).toBe('drop-shadow(0px 4px 42px rgba(0,0,0,0.2))');
    // blur*3 + max extent (inset: 1 + 0 + 0; spread: 0 + 0 + 1) + padding
    expect(pad).toBe(Math.ceil(18 + 1 + 24));
    expect(splitShadows([], 6, 24)).toEqual({ svg: [], css: '', pad: 42 });
  });

  it('the custom filter keeps only the attributes primitives take, and none that reaches out with url()', () => {
    const out = sanitizeFilterMarkup(
      '<feFlood flood-color="url(#paint)" flood-opacity="0.5" fill="url(https://x.test/p.svg)" mask="url(#m)" data-x="1" result="f"/>' +
        '<feComponentTransfer><feFuncA type="table" tableValues="0 1" clip-path="url(#c)"/></feComponentTransfer>',
    );
    expect(out).toContain('flood-opacity="0.5"');
    expect(out).toContain('result="f"');
    expect(out).toContain('tableValues="0 1"');
    expect(out).not.toMatch(/url\(|fill=|mask=|data-x|clip-path/);
  });

  it('the custom filter keeps primitives only: no script, handlers, style or outside href', () => {
    const out = sanitizeFilterMarkup(
      `<feGaussianBlur stdDeviation="4" onload="alert(1)" style="x"/><feImage href="https://x.test/a.png"/><feImage href="#local"/><a href="javascript:alert(1)">x</a>${XSS}<script>alert(1)</script>`,
    );
    expect(out).toContain('feGaussianBlur');
    expect(out).toContain('stdDeviation="4"');
    expect(out).not.toMatch(/onload|onerror|<script|<a |<img|style=|https:/);
    expect(out).toContain('href="#local"');
  });
});

describe('springs and easing', () => {
  it('presets compile to linear() when supported, cubic-bezier otherwise; reduced motion is instant', () => {
    expect(presets.bouncy).toEqual({ stiffness: 320, damping: 17, mass: 1 });
    expect(resolveTransition('bouncy', true)).toEqual({ duration: 0, easing: 'linear' });
    const r = resolveTransition('smooth');
    expect(r.duration).toBeGreaterThan(200);
    expect(r.duration).toBeLessThan(1500);
    expect(r.easing).toMatch(/^(linear\(|cubic-bezier\()/);
    expect(resolveTransition({ duration: 250, ease: 'ease-out' })).toEqual({ duration: 250, easing: 'ease-out' });
    expect(resolveTransition({ duration: 250 }).easing).toBe('cubic-bezier(0.22, 1, 0.36, 1)');
  });

  it('evaluates linear() lists, cubic-bezier and the keywords', () => {
    const lin = easingFunction('linear(0, 0.5, 1)');
    expect(lin(-1)).toBe(0);
    expect(lin(0.25)).toBeCloseTo(0.25, 6);
    expect(lin(2)).toBe(1);
    const ease = easingFunction('ease');
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeGreaterThan(0.5);
    expect(easingFunction('cubic-bezier(0.34, 1.56, 0.64, 1)')(0.6)).toBeGreaterThan(1);
    expect(easingFunction('nonsense')(0.3)).toBe(0.3);
  });
});

describe('geometry', () => {
  it('rounded-rect path clamps overlapping radii like CSS', () => {
    expect(roundedRectPath(0, 0, 10, 10, [0, 0, 0, 0])).toBe(
      'M 0 0 H 10 A 0 0 0 0 1 10 0 V 10 A 0 0 0 0 1 10 10 H 0 A 0 0 0 0 1 0 10 V 0 A 0 0 0 0 1 0 0 Z',
    );
    // 20 + 20 on a 20-wide edge scales every corner by 0.5.
    expect(roundedRectPath(0, 0, 20, 40, [20, 20, 20, 20])).toContain('A 10 10');
    expect(normalizeRadius(4)).toEqual([4, 4, 4, 4]);
  });

  it('measures px and % radii, and offsets through the offsetParent chain', () => {
    const el = document.createElement('div');
    el.style.borderRadius = '50%';
    document.body.append(el);
    expect(measureRadius(el, 40, 20)[0]).toBe(10);
    el.style.borderRadius = '6px';
    expect(measureRadius(el, 40, 20)).toEqual([6, 6, 6, 6]);
    expect(offsetTo(el, document.body)).toEqual({ x: el.offsetLeft, y: el.offsetTop });
  });
});

describe('knob mappings (LiquidItem)', () => {
  it('the default knobs reproduce the engine defaults exactly', () => {
    expect(zeta(0)).toBe(1);
    expect(zeta(1)).toBe(0.12);
    expect(zeta(Number.NaN)).toBe(Number.NaN);
    const m = mapMove(undefined);
    expect(m.stiffness).toBeCloseTo(MOVE_DEFAULTS.stiffness, 9);
    expect(m.damping).toBeCloseTo(MOVE_DEFAULTS.damping, 9);
    expect(m.stretch).toBeCloseTo(0.18, 9);
    expect(m.tail).toBeCloseTo(0.46, 9);
    const e = mapMorphSprings(undefined);
    expect(e.massStiffness).toBe(EVOLVE_DEFAULTS.massStiffness);
    expect(e.massDamping).toBeCloseTo(EVOLVE_DEFAULTS.massDamping, 9);
    expect(e.cornerDuration).toBe(EVOLVE_DEFAULTS.cornerDuration);
    // speed 2 → stiffness × 4, damping × 2, corners twice as fast.
    const fast = mapMorphSprings({ speed: 2 });
    expect(fast.massStiffness).toBe(EVOLVE_DEFAULTS.massStiffness * 4);
    expect(fast.cornerDuration).toBe(EVOLVE_DEFAULTS.cornerDuration / 2);
  });

  it('springiness spans ~120 … ~1200; bend pins the trail off and clamps its bows; dissolve scales strength', () => {
    expect(mapMove({ springiness: 0 }).stiffness).toBeCloseTo(380 / Math.sqrt(10), 6);
    expect(mapMove({ springiness: 1 }).stiffness).toBeCloseTo(380 * Math.sqrt(10), 6);
    expect(mapMove({ trail: 4 }).tail).toBe(0.8);
    const b = mapBend({ vertical: 3, horizontal: -1 });
    expect(b).toMatchObject({ bend: 1, bendX: 0, tail: 0, stretch: 0 });
    expect(mapDissolve(0.5).strength).toBe(0.5);
    expect(mapDissolve(true)).toMatchObject({ warp: 26, mix: 0.7, strength: 1, releaseMs: 110 });
    expect(mapDissolve(7).strength).toBe(1);
  });
});

describe('item plan', () => {
  it('picks the mode as liquid-gooey does', () => {
    expect(gooeyItemPlan({}).kind).toBe('mirror');
    expect(gooeyItemPlan({ x: 10 }).kind).toBe('mirror');
    expect(gooeyItemPlan({ observe: true }).kind).toBe('observe');
    expect(gooeyItemPlan({ morph: { shape: true } }).kind).toBe('observe');
    expect(gooeyItemPlan({ dissolve: true }).kind).toBe('observe');
    expect(gooeyItemPlan({ effect: 'move' }).kind).toBe('observe');
    expect(gooeyItemPlan({ effect: 'bend' }).kind).toBe('observe');
    expect(gooeyItemPlan({ effect: 'melt' }).kind).toBe('melt');
    expect(gooeyItemPlan({}, { effect: 'MOVE' }).kind).toBe('observe');
    expect(gooeyItemPlan({}, { dissolve: '' }).kind).toBe('observe');
    expect(gooeyItemPlan({}, { observe: true }).kind).toBe('observe');
  });

  it('clamps numbers and falls back on nonsense', () => {
    const p = gooeyItemPlan({ x: Number.NaN, y: 1e9, scale: -3, delay: -5 }, { x: '12' });
    expect(p).toMatchObject({ kind: 'mirror', x: 0, y: 1e5, scale: 0, delay: 0 });
    const a = gooeyItemPlan({}, { x: '12', y: 'nope', transition: 'bouncy', delay: '40', radius: '8' });
    expect(a).toMatchObject({ kind: 'mirror', x: 12, y: 0, delay: 40, radius: [8, 8, 8, 8] });
    expect(effectOf('constructor')).toBe('morph');
    expect(transitionOf('BOUNCY')).toBe('bouncy');
    expect(transitionOf('wobbly')).toBe('smooth');
    expect(transitionOf({ duration: -4, ease: '  ' })).toEqual({ duration: 0 });
    expect(transitionOf({ stiffness: Number.NaN, damping: 900 })).toEqual({ damping: 500 });
    const move = gooeyItemPlan({ effect: 'move', move: { springiness: Number.NaN, trail: 0.2 } });
    expect(move.kind === 'observe' && move.dynamics?.moveOpts?.stiffness).toBeCloseTo(380, 6);
  });

  it('move ignores dissolve; morph dissolve resolves the tuned look; live fields stay out of the key', () => {
    const mv = gooeyItemPlan({ effect: 'move', dissolve: true });
    expect(mv.kind === 'observe' && mv.hasBlend).toBe(false);
    const d1 = gooeyItemPlan({ dissolve: { active: true, mix: 0.4 } });
    const d2 = gooeyItemPlan({ dissolve: { active: false, mix: 0.4 } });
    if (d1.kind !== 'observe' || d2.kind !== 'observe') throw new Error('observe');
    expect(d1.blend).toMatchObject({ warp: 26, mix: 0.4, gravity: 60, pull: 4, flowSpeed: 22 });
    expect(d1.key).toBe(d2.key);
    expect(d2.blend.active).toBe(false);
  });

  it('reduced motion: moves snap, observed items keep no dynamics and the dissolve stops churning', () => {
    const m = gooeyItemPlan({ x: 40, transition: 'bouncy', delay: 80 }, {}, true);
    expect(m).toMatchObject({ kind: 'mirror', duration: 0, delay: 0 });
    const mv = gooeyItemPlan({ effect: 'move' }, {}, true);
    expect(mv.kind === 'observe' && mv.dynamics).toBe(null);
    const sh = gooeyItemPlan({ morph: { shape: true }, dissolve: true }, {}, true);
    expect(sh.kind === 'observe' && sh.dynamics).toBe(null);
    expect(sh.kind === 'observe' && sh.blend.flowSpeed).toBe(0);
    const full = gooeyItemPlan({ effect: 'move' });
    expect(full.kind === 'observe' && full.dynamics?.move).toBe(true);
  });

  it('melt: defaults, the source, finite tuning only', () => {
    const p = gooeyItemPlan({ effect: 'melt', melt: { src: ' a.png ', blur: Number.NaN, mix: 0.5 } });
    expect(p).toEqual({ kind: 'melt', src: 'a.png', opts: { ...IMAGE_MELT_DEFAULTS, mix: 0.5 } });
  });
});

describe('image melt helpers', () => {
  const a = { x: 0, y: 0, w: 84, h: 84, r: 16 };
  const b = { x: 104, y: 0, w: 84, h: 84, r: 16 };

  it('proximity rises as the gap closes; the eased value chases it and snaps', () => {
    expect(meltProximity(a, { ...b, x: 300 }, 7)).toBe(0);
    expect(meltProximity(a, { ...b, x: 84 }, 7)).toBe(1);
    const mid = meltProximity(a, { ...b, x: 84 + 9 }, 7);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(easeToward(0, 1, 1 / 60)).toBeCloseTo(1 - Math.exp(-14 / 60), 6);
    expect(easeToward(0, 1, 5)).toBeCloseTo(1 - Math.exp(-14 * 0.05), 6);
    expect(easeToward(0.998, 1, 1 / 60)).toBe(1);
    expect(geomKey(a)).toBe('0,0,84,84,16');
  });

  it('the pair svg: both pictures, the goo, crisp faces; marbling only in contact; unsafe sources draw nothing', () => {
    const base = {
      a,
      b,
      srcA: 'a.png',
      srcB: 'javascript:alert(1)',
      opts: IMAGE_MELT_DEFAULTS,
      width: 420,
      height: 200,
    };
    const apart = meltPairMarkup({ ...base, prox: 0, uid: 'u1' });
    expect(apart).toContain('href="a.png"');
    expect(apart).toContain('href=""');
    expect(apart).not.toContain('javascript');
    expect(apart).toContain('id="u1-goo"');
    expect(apart).not.toContain('u1-marble');
    const touching = meltPairMarkup({ ...base, prox: 1, uid: 'u1' });
    expect(touching).toContain('id="u1-marble"');
    expect(touching).toContain('mask="url(#u1-marblemask)"');
    const evil = meltPairMarkup({ ...base, srcA: `"><script>alert(1)</script>`, prox: 1, uid: '"><b>' });
    expect(evil).not.toContain('<script');
    expect(evil).not.toContain('<b>');
  });

  it('the registry notifies on register and unregister', () => {
    const reg = createImageMeltRegistry();
    const fn = vi.fn();
    const off = reg.subscribe(fn);
    const un = reg.register({ el: document.createElement('div'), src: 'a', opts: IMAGE_MELT_DEFAULTS });
    expect(reg.entries()).toHaveLength(1);
    un();
    expect(reg.entries()).toHaveLength(0);
    expect(fn).toHaveBeenCalledTimes(2);
    off();
  });
});

describe('group options', () => {
  it('data first, then attributes, clamped; defaults on nonsense', () => {
    expect(gooeyOptions()).toEqual({
      blur: 6,
      contrast: 18,
      fill: 'var(--surface)',
      shadow: '',
      filterPadding: 24,
      waviness: 0,
      wavinessFreq: 0.018,
      filter: '',
      motion: 'system',
    });
    const attrs: Record<string, string> = { blur: '99', contrast: '0', 'filter-padding': 'x', motion: 'REDUCE' };
    const o = gooeyOptions({ waviness: -2, fill: '  ' }, (n) => attrs[n] ?? null);
    expect(o).toMatchObject({ blur: 40, contrast: 1, filterPadding: 24, waviness: 0, motion: 'reduce' });
    expect(o.fill).toBe('var(--surface)');
    expect(gooeyOptions({ blur: 12 }, () => '3').blur).toBe(12);
    expect(motionOf('full')).toBe('full');
    expect(motionOf('sideways')).toBe('system');
  });
});

// ── The element ──────────────────────────────────────────────────────────────────────────────────────────────────

describe('<ui-gooey>', () => {
  it('draws the silhouette and the overlay as decorative svg, the filter referenced inside the same shadow root', () => {
    const { g } = mount();
    const root = g.shadowRoot!;
    const sil = root.querySelector('svg.gy-sil')!;
    const overlay = root.querySelector('svg.gy-overlay')!;
    for (const s of [sil, overlay]) {
      expect(s.getAttribute('aria-hidden')).toBe('true');
      expect(s.getAttribute('focusable')).toBe('false');
    }
    const filter = root.querySelector('filter')!;
    expect(filter.id).toBe(g.filterId);
    expect(portal(g).getAttribute('filter')).toBe(`url(#${g.filterId})`);
    expect(root.querySelector('use')!.getAttribute('href')).toBe(`#${g.filterId}-sil`);
    expect(root.querySelector('slot')).not.toBeNull();
    expect(filter.querySelector('feGaussianBlur')!.getAttribute('stdDeviation')).toBe('6');
    expect((portal(g) as SVGElement).style.fill).toBe('var(--surface)');
    // No words of its own.
    expect(root.textContent?.replace(/\s/g, '')).toBe(
      Array.from(root.querySelectorAll('style'))
        .map((s) => s.textContent)
        .join('')
        .replace(/\s/g, ''),
    );
  });

  it('patches the layers on change: blur, fill, the shadow split, the region', () => {
    const { g } = mount({ shadow: '0 0 0 1px red, 0 4px 10px blue' });
    const root = g.shadowRoot!;
    const sil = root.querySelector<SVGSVGElement>('svg.gy-sil')!;
    expect(sil.style.filter).toContain('drop-shadow(0px 4px 10px blue)');
    expect(root.querySelector('feMorphology')).not.toBeNull();
    const filter = root.querySelector('filter')!;
    const svgEl = sil;
    g.data = { blur: 10, fill: 'var(--text)' };
    g.renderNow();
    expect(root.querySelector('svg.gy-sil')).toBe(svgEl);
    expect(filter.querySelector('feGaussianBlur')!.getAttribute('stdDeviation')).toBe('10');
    expect((portal(g) as SVGElement).style.fill).toBe('var(--text)');
    expect(sil.style.filter).toBe('');
    // Region: the pad around a 0 × 0 box (blur 10 × 3 + padding 24).
    expect(filter.getAttribute('x')).toBe('-54');
    expect(filter.getAttribute('width')).toBe('108');
    expect(g.engine!.gooBlur).toBe(10);
  });

  it('the custom filter is sanitized into the filter element', () => {
    const { g } = mount({ filter: `<feGaussianBlur stdDeviation="3" onload="alert(1)"/>${XSS}` });
    const filter = g.shadowRoot!.querySelector('filter')!;
    expect(filter.innerHTML).toContain('stdDeviation="3"');
    expect(filter.innerHTML).not.toMatch(/onload|<img|onerror/);
  });

  it('escapes the host strings: a fill or shadow cannot add markup', () => {
    const { g } = mount({ fill: XSS, shadow: `0 0 0 1px ${XSS}, 0 2px 4px ${XSS}` });
    const root = g.shadowRoot!;
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelectorAll('[onerror]')).toHaveLength(0);
    expect((portal(g) as SVGElement).style.fill).not.toMatch(/[<>]/);
    expect(root.querySelector('feFlood')!.getAttribute('style')).not.toMatch(/[<>"]/);
    expect(root.querySelector<SVGSVGElement>('svg.gy-sil')!.style.filter).not.toMatch(/[<>]/);
  });

  it('motion: system follows the setting, reduce / full force it; the change re-plans the items', () => {
    reduce = true;
    const { g, items } = mount({}, [{ data: { x: 20, transition: 'bouncy' } }]);
    expect(g.reducedMotion).toBe(true);
    expect(items[0].plan).toMatchObject({ kind: 'mirror', duration: 0 });
    g.setAttribute('motion', 'full');
    g.renderNow();
    expect(g.reducedMotion).toBe(false);
    items[0].renderNow();
    expect(items[0].plan).toMatchObject({ kind: 'mirror' });
    expect((items[0].plan as { duration: number }).duration).toBeGreaterThan(0);
    reduce = false;
    g.setAttribute('motion', 'reduce');
    g.renderNow();
    expect(g.reducedMotion).toBe(true);
  });

  it('lang="ko" changes nothing: the group has no words, the content is the host’s', () => {
    const { g } = mount({}, [], { lang: 'ko' });
    expect(g.shadowRoot!.querySelector('[aria-label]')).toBeNull();
    expect(g.shadowRoot!.querySelector('svg.gy-sil')).not.toBeNull();
  });
});

describe('<ui-gooey-item>', () => {
  it('component-driven: a blob in the silhouette, moved with the item on one clock', () => {
    const { g, items } = mount({}, [{ data: { x: 0, y: 0 } }]);
    const it0 = items[0];
    const blob = portal(g).querySelector('rect')!;
    expect(blob).not.toBeNull();
    expect(it0.blob).toBe(blob);
    expect(it0.style.transform).toBe('translate(0px, 0px)');
    expect(it0.shadowRoot!.querySelector('style:last-of-type')!.textContent).toContain('inline-block');
    it0.data = { x: -54, y: -34, transition: { duration: 200, ease: 'linear' } };
    it0.renderNow();
    expect(it0.animating).toBe(true);
    step(100);
    const mid = it0.style.transform;
    expect(mid).not.toBe('translate(0px, 0px)');
    expect(blob.style.transform).toBe(mid);
    settle();
    expect(it0.style.transform).toBe('translate(-54px, -34px)');
    expect(blob.style.transform).toBe('translate(-54px, -34px)');
    expect(it0.animating).toBe(false);
    // A render that keeps the goal does not restart the move.
    it0.renderNow();
    expect(frames.size).toBe(0);
  });

  it('a non-uniform radius draws a path; scale joins the transform', () => {
    const { g, items } = mount({}, [{ data: { radius: [4, 4, 12, 12], scale: 1.5 } }]);
    expect(portal(g).querySelector('path')).not.toBeNull();
    expect(items[0].style.transform).toBe('translate(0px, 0px) scale(1.5)');
  });

  it('observed: display contents, registered with the engine, which wakes and sleeps', () => {
    const thumb = document.createElement('div');
    const { g, items } = mount({}, [{ data: { effect: 'move' }, child: thumb }]);
    expect(items[0].shadowRoot!.querySelector('style:last-of-type')!.textContent).toContain('contents');
    expect(g.engine!.size).toBe(1);
    // Move items add a tail (three circles) and a bend path beside the blob.
    expect(portal(g).querySelectorAll('circle')).toHaveLength(3);
    expect(portal(g).querySelector('path')).not.toBeNull();
    expect(g.running).toBe(true);
    settle();
    expect(g.running).toBe(false);
    g.wake();
    expect(g.running).toBe(true);
  });

  it('switching mode tears the old one down; disconnect unregisters and removes the blob', () => {
    const { g, items } = mount({}, [{ data: { x: 5 } }]);
    const it0 = items[0];
    it0.data = { effect: 'bend' };
    it0.renderNow();
    expect(it0.style.transform).toBe('');
    expect(g.engine!.size).toBe(1);
    expect(portal(g).querySelectorAll('rect')).toHaveLength(1);
    it0.remove();
    expect(g.engine!.size).toBe(0);
    expect(portal(g).querySelector('rect')).toBeNull();
    expect(portal(g).querySelector('circle')).toBeNull();
  });

  it('dissolve: a melt host in the overlay; live fields update without re-registering', () => {
    const { g, items } = mount({}, [{ data: { dissolve: { active: true } } }]);
    const overlay = g.shadowRoot!.querySelector('.gy-melt-portal')!;
    expect(overlay.children).toHaveLength(1);
    const add = vi.spyOn(g.engine!, 'add');
    items[0].data = { dissolve: { active: false } };
    items[0].renderNow();
    expect(add).not.toHaveBeenCalled();
    items[0].data = { dissolve: { warp: 10 } };
    items[0].renderNow();
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('melt: the child is painted by the group (transparent, restored after); a pair draws the melt svg', () => {
    const card = (src: string) => {
      const d = document.createElement('div');
      d.style.opacity = '0.9';
      const img = document.createElement('img');
      img.src = src;
      d.append(img);
      return d;
    };
    const a = card('https://example.test/a.png');
    const b = card('https://example.test/b.png');
    const { g, items } = mount({}, [
      { data: { effect: 'melt' }, child: a },
      { data: { effect: 'melt' }, child: b },
    ]);
    expect(a.style.opacity).toBe('0');
    expect(g.running).toBe(true);
    step();
    const svg = g.shadowRoot!.querySelector('.gy-melt svg')!;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.querySelectorAll('image')).toHaveLength(2);
    items[1].remove();
    expect(b.style.opacity).toBe('0.9');
    expect(g.shadowRoot!.querySelector('.gy-melt svg')).toBeNull();
  });

  it('melt: only the painted pair is transparent — a lone, a third or an unsafe one keeps its own pixels', () => {
    const card = (src: string) => {
      const d = document.createElement('div');
      const img = document.createElement('img');
      img.src = src;
      d.append(img);
      return d;
    };
    const a = card('https://example.test/a.png');
    const { g, items } = mount({}, [{ data: { effect: 'melt' }, child: a }]);
    // Alone: nothing paints it, so it stays.
    expect(a.style.opacity).toBe('');
    const add = (child: HTMLElement, data: GooeyItemData = { effect: 'melt' }) => {
      const it = document.createElement('ui-gooey-item');
      it.data = data;
      it.append(child);
      g.append(it);
      it.renderNow();
      return it;
    };
    const b = card('https://example.test/b.png');
    add(b);
    expect(a.style.opacity).toBe('0');
    expect(b.style.opacity).toBe('0');
    const c = card('https://example.test/c.png');
    const third = add(c);
    expect(c.style.opacity).toBe('');
    // The first leaves: it is restored, and the third joins the pair.
    items[0].remove();
    expect(a.style.opacity).toBe('');
    expect(c.style.opacity).toBe('0');
    third.remove();
    expect(c.style.opacity).toBe('');
    expect(b.style.opacity).toBe('');
    // A source the melt cannot draw never joins (and never vanishes).
    const bad = document.createElement('div');
    add(bad, { effect: 'melt', melt: { src: 'javascript:alert(1)' } });
    add(card('https://example.test/d.png'));
    expect(bad.style.opacity).toBe('');
  });

  it('an item outside a group does nothing and throws nothing', () => {
    const it0 = document.createElement('ui-gooey-item');
    it0.append(document.createElement('span'));
    document.body.append(it0);
    expect(() => it0.renderNow()).not.toThrow();
    expect(it0.plan).toBeNull();
  });

  it('escapes the host strings: a hostile melt source never reaches markup', () => {
    const d = document.createElement('div');
    const { g } = mount({}, [
      { data: { effect: 'melt', melt: { src: `"><script>alert(1)</script>` } }, child: d },
      { data: { effect: 'melt', melt: { src: 'javascript:alert(1)' } }, child: document.createElement('div') },
      { data: { effect: 'melt', melt: { src: 'https://example.test/n.png' } }, child: document.createElement('div') },
    ]);
    step();
    const root = g.shadowRoot!;
    expect(root.querySelector('script')).toBeNull();
    // The script-looking one is an (escaped) relative URL; the javascript: one never joined the pair.
    const hrefs = Array.from(root.querySelectorAll('image')).map((i) => i.getAttribute('href'));
    expect(hrefs).toEqual(['"><script>alert(1)</script>', 'https://example.test/n.png']);
    expect(root.innerHTML).not.toContain('javascript:');
  });
});

describe('lifecycle', () => {
  it('the 300ms safety check parks after ~10s of stillness; any wake brings it back', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { g } = mount({}, [{ data: { effect: 'move' }, child: document.createElement('div') }]);
    settle();
    const engine = g.engine!;
    expect(engine.ticking).toBe(true);
    const measure = vi.spyOn(engine as unknown as { measureAll: () => boolean }, 'measureAll');
    vi.advanceTimersByTime(300 * 40);
    expect(engine.ticking).toBe(false);
    const calls = measure.mock.calls.length;
    vi.advanceTimersByTime(30000);
    expect(measure.mock.calls.length).toBe(calls);
    g.wake();
    expect(engine.ticking).toBe(true);
  });

  it('off screen and in a hidden tab the loops park; back on screen they resume', () => {
    const { g } = mount({}, [{ data: { effect: 'move' }, child: document.createElement('div') }]);
    expect(g.running).toBe(true);
    FakeIO.all[0].fire(false);
    expect(g.running).toBe(false);
    expect(frames.size).toBe(0);
    g.wake();
    expect(g.running).toBe(false);
    FakeIO.all[0].fire(true);
    expect(g.running).toBe(true);
    settle();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    g.wake();
    expect(g.running).toBe(false);
  });

  it('disconnect stops every loop, the safety tick and the observers, and releases the engine', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { g } = mount({}, [{ data: { effect: 'move' }, child: document.createElement('div') }]);
    const engine = g.engine!;
    const measure = vi.spyOn(engine as unknown as { measureAll: () => boolean }, 'measureAll');
    g.remove();
    expect(g.engine).toBeNull();
    expect(engine.running).toBe(false);
    expect(frames.size).toBe(0);
    expect(FakeIO.all[0].disconnected).toBe(true);
    expect(FakeRO.all.every((r) => r.disconnected)).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(measure).not.toHaveBeenCalled();
  });

  it('reconnecting builds a fresh engine and the items register again', async () => {
    const { g } = mount({}, [{ data: { effect: 'move' }, child: document.createElement('div') }]);
    const first = g.engine;
    g.remove();
    document.body.append(g);
    await flush();
    await flush();
    expect(g.engine).not.toBe(first);
    expect(g.engine!.size).toBe(1);
  });

  it('a group defined late still finds its blobs layer for items rendered early', () => {
    const { g } = mount({}, [{ data: {} }, { data: {} }]);
    expect(portal(g).querySelectorAll('rect')).toHaveLength(2);
  });
});

describe('package surface', () => {
  it('exports only prefixed names (the root re-exports every component)', async () => {
    const api = await import('./index');
    const generic = [
      'presets',
      'Transition',
      'parseShadow',
      'easingFunction',
      'resolveTransition',
      'zeta',
      'ObserveEngine',
    ];
    for (const n of generic) expect(Object.hasOwn(api, n)).toBe(false);
    for (const n of Object.keys(api)) expect(n).toMatch(/goo|Goo|GOO/);
  });
});

describe('docs', () => {
  it('names the source, sits in Effects and ships at least three demos that build without the network', () => {
    expect(doc.group).toBe('Effects');
    expect(doc.reference.url).toBe('https://libraries.dev/gooey');
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const d of doc.demos) {
      const el = d.create();
      document.body.append(el);
      expect(el.querySelector('ui-gooey')).not.toBeNull();
      expect(el.querySelectorAll('ui-gooey-item').length).toBeGreaterThan(0);
      el.remove();
    }
  });
});
