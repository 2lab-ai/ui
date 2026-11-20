import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BEAM_SIZES,
  BEAM_VARIANTS,
  type BorderBeamData,
  beamDuration,
  beamOptions,
  beamStyleOptions,
  isPulseSize,
  pulseGlowScale,
  type UiBorderBeam,
} from './border-beam';
import { doc } from './docs';
import {
  colorPalettes,
  generateBeamCSS,
  getPulseDriverConfig,
  lineBloomColors,
  lineColorPalettes,
  lineInnerGradientData,
  pulseParams,
  smallColorPalettes,
} from './engine/beam-styles';
import { pingPong, pulseDriverState, registerPulseInstance } from './engine/pulse-driver';
import {
  BEAM_ID,
  beamSheet,
  registerBeamProperties,
  registeredBeamProperties,
  STILL_ANGLE,
  splitPropertyRules,
  stillCss,
} from './sheet';
import { styles } from './styles';
import { ancestorSubstrate, colorIsLight, composedContains, resolveSubstrate } from './theme';

const XSS = '<img src=x onerror=alert(1)>';

// ── Fakes: a rAF clock the test drives, observers it fires, media queries it flips ────────────────────────────────

let frames: Map<number, FrameRequestCallback>;
let frameId = 0;
let reduce = false;
let dark = false;
let media: Map<string, Set<() => void>>;
let registered: Array<{ name: string; syntax: string; initialValue: string; inherits: boolean }>;

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
  unobserve(t: Element) {
    this.targets = this.targets.filter((x) => x !== t);
  }
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
  options: IntersectionObserverInit | undefined;
  constructor(
    readonly cb: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.options = options;
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

beforeEach(() => {
  document.body.innerHTML = '';
  frames = new Map();
  frameId = 0;
  reduce = false;
  dark = false;
  media = new Map();
  registered = [];
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
  vi.stubGlobal('CSS', { registerProperty: (d: (typeof registered)[number]) => registered.push(d) });
});

afterEach(() => {
  document.body.innerHTML = '';
  Reflect.deleteProperty(document, 'hidden');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function card(css = 'width:300px;height:120px;border-radius:12px'): HTMLElement {
  const c = document.createElement('div');
  c.className = 'card';
  c.style.cssText = css;
  c.textContent = 'Deploying web-app';
  return c;
}

function mount(data?: BorderBeamData, attrs: Record<string, string> = {}, child: HTMLElement = card()): UiBorderBeam {
  const el = document.createElement('ui-border-beam');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (data) el.data = data;
  el.append(child);
  document.body.append(el);
  el.renderNow();
  return el;
}
const wrap = (el: UiBorderBeam) => el.shadowRoot!.querySelector<HTMLElement>('[data-beam]')!;
const sheet = (el: UiBorderBeam) => el.shadowRoot!.querySelectorAll('style')[1]!.textContent ?? '';
const io = () => FakeIO.all[FakeIO.all.length - 1]!;
function end(el: UiBorderBeam, name: string, init: { target?: Element; pseudoElement?: string } = {}): void {
  const ev = new AnimationEvent('animationend', {
    animationName: name,
    pseudoElement: init.pseudoElement ?? '',
    bubbles: true,
  });
  (init.target ?? wrap(el)).dispatchEvent(ev);
}
function step(ms = 40): void {
  const due = Array.from(frames.values());
  frames.clear();
  for (const cb of due) cb(performance.now() + ms);
}

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────

describe('options', () => {
  const none = () => null;
  it('defaults match <BorderBeam> (theme auto here)', () => {
    expect(beamOptions({}, none)).toEqual({
      size: 'md',
      colorVariant: 'colorful',
      theme: 'auto',
      motion: 'system',
      active: true,
      staticColors: false,
      strength: 1,
      glowSize: 1,
      hueRange: 30,
      duration: undefined,
      borderRadius: undefined,
      brightness: undefined,
      saturation: undefined,
      css: '',
    });
  });

  it('data wins over attributes; unknown names fall back; numbers clamp; NaN is unset', () => {
    const attrs: Record<string, string> = {
      size: 'line',
      'color-variant': 'OCEAN',
      theme: 'light',
      motion: 'full',
      strength: '4',
      duration: '0.01',
      'hue-range': '999',
      'glow-size': '0',
      'border-radius': '-5',
    };
    const o = beamOptions({ size: 'sm' }, (n) => attrs[n] ?? null);
    expect(o.size).toBe('sm');
    expect(o.colorVariant).toBe('ocean');
    expect(o.theme).toBe('light');
    expect(o.motion).toBe('full');
    expect(o.strength).toBe(1);
    expect(o.duration).toBe(0.2);
    expect(o.hueRange).toBe(360);
    expect(o.glowSize).toBe(0.1);
    expect(o.borderRadius).toBe(0);
    const bad = beamOptions(
      {
        size: 'huge' as never,
        colorVariant: 'neon' as never,
        strength: Number.NaN,
        duration: Number.POSITIVE_INFINITY,
      },
      none,
    );
    expect(bad.size).toBe('md');
    expect(bad.colorVariant).toBe('colorful');
    expect(bad.strength).toBe(1);
    expect(bad.duration).toBeUndefined();
    expect(beamOptions({ strength: -1, brightness: 9, saturation: -2 }, none)).toMatchObject({
      strength: 0,
      brightness: 5,
      saturation: 0,
    });
  });

  it('active and static-colors: data booleans, or attributes true unless false / 0 / off / no', () => {
    const attr = (v: string | null) => (n: string) => (n === 'active' || n === 'static-colors' ? v : null);
    expect(beamOptions({}, attr(null)).active).toBe(true);
    expect(beamOptions({}, attr('')).active).toBe(true);
    for (const v of ['false', 'FALSE', '0', 'off', 'no']) expect(beamOptions({}, attr(v)).active).toBe(false);
    expect(beamOptions({}, attr('')).staticColors).toBe(true);
    expect(beamOptions({ active: false }, attr('true')).active).toBe(false);
  });

  it('sizes, variants and durations', () => {
    expect(BEAM_SIZES).toEqual(['sm', 'md', 'line', 'pulse-inner', 'pulse-outside']);
    expect(BEAM_VARIANTS).toHaveLength(8);
    expect(isPulseSize('pulse-inner')).toBe(true);
    expect(isPulseSize('line')).toBe(false);
    expect(beamDuration('md')).toBe(1.96);
    expect(beamDuration('sm')).toBe(1.96);
    expect(beamDuration('line')).toBe(3.1);
    expect(beamDuration('pulse-outside')).toBe(2.3);
  });

  it('beamStyleOptions: presets per size and substrate, radius order, mono never drifts, line caps hue', () => {
    const o = beamOptions({}, () => null);
    const md = beamStyleOptions(o, 'dark');
    expect(md).toMatchObject({
      id: BEAM_ID,
      borderRadius: 16,
      borderWidth: 1,
      duration: 1.96,
      strokeOpacity: 0.26,
      innerOpacity: 0.42,
      bloomOpacity: 0.24,
      brightness: 1.3,
      saturation: 1.2,
      hueRange: 30,
      theme: 'dark',
      staticColors: false,
      glowSize: 1,
    });
    expect(beamStyleOptions(o, 'light').saturation).toBe(1.5);
    expect(beamStyleOptions({ ...o, size: 'sm' }, 'dark').borderRadius).toBe(32);
    expect(beamStyleOptions(o, 'dark', 20).borderRadius).toBe(20);
    expect(beamStyleOptions({ ...o, borderRadius: 8 }, 'dark', 20).borderRadius).toBe(8);
    expect(beamStyleOptions({ ...o, colorVariant: 'mono' }, 'dark').staticColors).toBe(true);
    expect(beamStyleOptions({ ...o, size: 'line', hueRange: 90 }, 'dark').hueRange).toBe(13);
    const po = beamStyleOptions({ ...o, size: 'pulse-outside' }, 'light');
    expect(po).toMatchObject({ brightness: 1.7, saturation: 0.6, hairlineOpacity: 0, duration: 2.3 });
    expect(beamStyleOptions({ ...o, size: 'pulse-inner', brightness: 2 }, 'dark').brightness).toBe(2);
  });

  it('pulseGlowScale: per axis against 350 × 140, clamped 0.35 … 4; null for an empty box', () => {
    expect(pulseGlowScale(350, 140)).toEqual({ x: 1, y: 1 });
    expect(pulseGlowScale(700, 70)).toEqual({ x: 2, y: 0.5 });
    expect(pulseGlowScale(10, 10000)).toEqual({ x: 0.35, y: 4 });
    expect(pulseGlowScale(123, 45)).toEqual({ x: 0.351, y: 0.35 });
    expect(pulseGlowScale(0, 100)).toBeNull();
    expect(pulseGlowScale(Number.NaN, 100)).toBeNull();
  });
});

describe('engine', () => {
  it('every palette colour is a valid rgb() / rgba() (the upstream ",," typos are fixed)', () => {
    const color = /^rgba?\(\d{1,3}, \d{1,3}, \d{1,3}(, (0|1|0?\.\d+))?\)$/;
    const all: string[] = [];
    for (const v of BEAM_VARIANTS) {
      all.push(colorPalettes[v].spike.primary, colorPalettes[v].spike.secondary, colorPalettes[v].spikeLt.primary);
      all.push(...colorPalettes[v].border.map((c) => c.color));
      all.push(...smallColorPalettes[v].border.map((c) => c.color), ...smallColorPalettes[v].inner.map((c) => c.color));
      all.push(...lineColorPalettes[v].dark.map((c) => c.color), ...lineColorPalettes[v].light.map((c) => c.color));
      all.push(...lineInnerGradientData[v].map((c) => c.color));
      for (const t of ['dark', 'light'] as const)
        for (const s of lineBloomColors[v][t].spikes) all.push(s.color1, s.color2);
    }
    expect(all.length).toBeGreaterThan(400);
    expect(all.filter((c) => !color.test(c))).toEqual([]);
  });

  it('generates a complete sheet for every size × variant × substrate', () => {
    const o = beamOptions({}, () => null);
    for (const size of BEAM_SIZES)
      for (const colorVariant of BEAM_VARIANTS)
        for (const theme of ['dark', 'light'] as const) {
          const css = generateBeamCSS(beamStyleOptions({ ...o, size, colorVariant }, theme));
          expect(css).toContain(`[data-beam="${BEAM_ID}"]`);
          expect(css).not.toMatch(/undefined|NaN|,,/);
          expect(css).toContain(`beam-fade-in-${BEAM_ID}`);
          expect(css.split('{').length).toBe(css.split('}').length);
        }
  });

  it('pulse driver config: 17 oscillators, a full hue turn unless static; null for rotate sizes', () => {
    const cfg = getPulseDriverConfig('pulse-inner', 'dark', 2.3, 30, false, 'ui')!;
    expect(cfg.oscillators).toHaveLength(17);
    expect(cfg.oscillators[0]).toMatchObject({ prop: '--bw1-ui', unit: '' });
    expect(cfg.oscillators.find((x) => x.prop === '--bx1-ui')?.unit).toBe('px');
    expect(cfg.hue).toEqual({ prop: '--beam-hue-ui', range: 360, period: 16, continuous: true });
    expect(getPulseDriverConfig('pulse-outside', 'dark', 2.3, 30, true, 'ui')!.hue).toBeNull();
    expect(getPulseDriverConfig('md', 'dark', 2.3, 30, false, 'ui')).toBeNull();
    // Duration scales the breathing periods.
    expect(pulseParams('pulse-outside', 'dark', 4.6).bs).toBeCloseTo(pulseParams('pulse-outside', 'dark', 2.3).bs * 2);
  });

  it('pingPong: a cosine ease 0 → 1 → 0', () => {
    expect(pingPong(0)).toBeCloseTo(0);
    expect(pingPong(0.25)).toBeCloseTo(0.5);
    expect(pingPong(0.5)).toBeCloseTo(1);
    expect(pingPong(1)).toBeCloseTo(0);
  });

  it('the shared driver: one loop for every instance, ~30 fps, stopped when the last leaves', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    const cfg = getPulseDriverConfig('pulse-inner', 'dark', 2.3, 30, false, 'ui')!;
    const offA = registerPulseInstance(a, cfg);
    const offB = registerPulseInstance(b, cfg);
    expect(pulseDriverState()).toEqual({ instances: 2, running: true });
    expect(frames.size).toBe(1);
    const cb = Array.from(frames.values())[0]!;
    frames.clear();
    cb(1000);
    expect(a.style.getPropertyValue('--bw1-ui')).toMatch(/^\d\.\d{4}$/);
    expect(a.style.getPropertyValue('--bx1-ui')).toMatch(/^-?\d+\.\d{2}px$/);
    expect(a.style.getPropertyValue('--beam-hue-ui')).toMatch(/deg$/);
    // Under 1/30 s later: skipped (the next frame is still booked).
    const before = a.style.getPropertyValue('--bw1-ui');
    Array.from(frames.values())[0]!(1010);
    expect(a.style.getPropertyValue('--bw1-ui')).toBe(before);
    offA();
    offB();
    expect(pulseDriverState()).toEqual({ instances: 0, running: false });
  });
});

describe('sheet', () => {
  const opts = (patch = {}) => beamStyleOptions({ ...beamOptions({}, () => null), ...patch }, 'dark');

  it('lifts every @property block out, with its syntax and initial value', () => {
    const { css, properties } = splitPropertyRules(generateBeamCSS(opts({ size: 'line' })));
    expect(css).not.toContain('@property');
    expect(properties.map((p) => p.name)).toEqual([
      '--beam-x-ui',
      '--beam-w-ui',
      '--beam-h-ui',
      '--beam-spike-ui',
      '--beam-spike2-ui',
      '--beam-edge-ui',
      '--beam-opacity-ui',
    ]);
    expect(properties[0]).toEqual({ name: '--beam-x-ui', syntax: '<number>', initialValue: '0', inherits: true });
    const pulse = splitPropertyRules(generateBeamCSS(opts({ size: 'pulse-inner' }))).properties;
    expect(pulse).toHaveLength(19);
    expect(pulse.find((p) => p.name === '--bx1-ui')).toMatchObject({ syntax: '<length>', initialValue: '0px' });
    expect(pulse.find((p) => p.name === '--beam-hue-ui')).toMatchObject({ syntax: '<angle>', initialValue: '0deg' });
    expect(splitPropertyRules(generateBeamCSS(opts())).properties.map((p) => p.name)).toEqual([
      '--beam-angle-ui',
      '--beam-opacity-ui',
    ]);
  });

  it('registers each name once per document; a throwing registration or no API never throws', () => {
    const props = splitPropertyRules(generateBeamCSS(opts())).properties;
    expect(registerBeamProperties(props)).toBe(true);
    const n = registered.length;
    registerBeamProperties(props);
    expect(registered.length).toBe(n);
    vi.stubGlobal('CSS', {
      registerProperty: () => {
        throw new Error('InvalidModificationError');
      },
    });
    expect(() => registerBeamProperties([{ ...props[0]!, name: '--fresh-ui' }])).not.toThrow();
    vi.stubGlobal('CSS', {});
    expect(registerBeamProperties(props)).toBe(false);
  });

  it('run is the engine as written; still adds a pose and a crossfade; full is immune to reduced motion', () => {
    const md = opts();
    expect(beamSheet(md, 'run').css).toBe(splitPropertyRules(generateBeamCSS(md)).css);
    const still = beamSheet(md, 'still').css;
    expect(still).toContain(`--beam-angle-ui: ${STILL_ANGLE}deg`);
    expect(still).toContain('[data-beam="ui"][data-still][data-active] { animation: beam-fade-in-ui 0.6s');
    expect(still).toContain('animation: none !important');
    expect(still).toMatch(/filter: hue-rotate\(var\(--beam-hue-base, 0deg\)\) brightness\(1\.30\) saturate\(1\.20\)/);
    const line = stillCss(opts({ size: 'line' }));
    expect(line).toContain('--beam-x-ui: 0.5');
    expect(line).toContain('--beam-edge-ui: 1');
    expect(line).toMatch(/\[data-beam-bloom\] \{ filter: blur\(8px\)/);
    // Mono never drifts: no filter added to hold.
    expect(stillCss(opts({ colorVariant: 'mono', staticColors: true }))).not.toContain('filter');
    const pulse = beamSheet(opts({ size: 'pulse-inner' }), 'still').css;
    expect(pulse).not.toContain('--beam-angle-ui:');
    expect(pulse).toContain('[data-still][data-active] { animation: beam-fade-in-ui');
    const full = beamSheet(opts({ size: 'pulse-outside' }), 'full').css;
    expect(full).not.toContain('prefers-reduced-motion');
    expect(full).toMatch(/animation: beam-fade-in-ui 0\.6s ease forwards !important;/);
    const fullMd = beamSheet(md, 'full').css;
    expect(fullMd).toMatch(/beam-fade-in-ui 0\.6s ease forwards !important;/);
    expect(fullMd).toMatch(/animation: beam-hue-shift-ui 12s ease-in-out infinite !important;/);
    expect(fullMd).not.toContain('!important !important');
  });

  it('extra css follows the sheet with {id} filled in', () => {
    const { css } = beamSheet(opts(), 'run', '[data-beam="{id}"]::after { opacity: 0.5 }');
    expect(css.trimEnd().endsWith('[data-beam="ui"]::after { opacity: 0.5 }')).toBe(true);
  });
});

describe('substrate', () => {
  it('colorIsLight: hex, rgb, color(srgb), oklch / lab lightness; null when unknown', () => {
    expect(colorIsLight('#ededf0')).toBe(true);
    expect(colorIsLight('#18181a')).toBe(false);
    expect(colorIsLight('#fff')).toBe(true);
    expect(colorIsLight('rgb(10, 10, 10)')).toBe(false);
    expect(colorIsLight('rgba(250, 250, 250, 0.9)')).toBe(true);
    expect(colorIsLight('color(srgb 0.9 0.9 0.9)')).toBe(true);
    expect(colorIsLight('oklch(0.2 0.01 250)')).toBe(false);
    expect(colorIsLight('lab(90% 0 0)')).toBe(true);
    expect(colorIsLight('var(--text)')).toBeNull();
    expect(colorIsLight('#12345')).toBeNull();
    expect(colorIsLight('')).toBeNull();
  });

  it('ancestorSubstrate: data-design, data-theme, the dark / light class — across shadow roots', () => {
    const outer = document.createElement('div');
    outer.setAttribute('data-theme', 'dark');
    const host = document.createElement('div');
    outer.append(host);
    document.body.append(outer);
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('span');
    shadow.append(inner);
    expect(ancestorSubstrate(inner)).toBe('dark');
    host.className = 'light';
    expect(ancestorSubstrate(inner)).toBe('light');
    host.className = '';
    outer.setAttribute('data-design', 'modern-mono');
    outer.setAttribute('data-theme', 'light');
    expect(ancestorSubstrate(inner)).toBe('dark');
    outer.removeAttribute('data-design');
    outer.removeAttribute('data-theme');
    expect(ancestorSubstrate(inner)).toBeNull();
    expect(composedContains(outer, inner)).toBe(true);
    expect(composedContains(inner, outer)).toBe(false);
  });

  it('resolveSubstrate: a pin wins; then the tree; then the OS', () => {
    const el = document.createElement('div');
    document.body.append(el);
    expect(resolveSubstrate(el, 'light')).toBe('light');
    dark = true;
    expect(resolveSubstrate(el, 'auto')).toBe('dark');
    document.body.setAttribute('data-theme', 'light');
    expect(resolveSubstrate(el, 'auto')).toBe('light');
    document.body.removeAttribute('data-theme');
  });
});

// ── The element ──────────────────────────────────────────────────────────────────────────────────────────────────

describe('<ui-border-beam>', () => {
  it('wraps the host’s own element in a slot: it stays in the light DOM, untouched', () => {
    const child = card();
    const el = mount({}, {}, child);
    expect(child.parentElement).toBe(el);
    expect(child.getAttribute('role')).toBeNull();
    const w = wrap(el);
    expect(w.getAttribute('data-beam')).toBe('ui');
    expect(w.getAttribute('part')).toBe('beam');
    expect(w.querySelector('slot')).not.toBeNull();
    const bloom = w.querySelector('[data-beam-bloom]')!;
    expect(bloom.getAttribute('aria-hidden')).toBe('true');
    expect(bloom.getAttribute('part')).toBe('bloom');
    expect(el.shadowRoot!.querySelector('[role]')).toBeNull();
    expect(el.getAttribute('role')).toBeNull();
    expect(styles).toContain('color: inherit');
  });

  it('writes the engine’s sheet without @property and registers those properties instead', () => {
    const el = mount();
    const css = sheet(el);
    expect(css).toContain('[data-beam="ui"][data-active]');
    expect(css).toContain('beam-spin-ui 1.96s linear infinite');
    expect(css).not.toContain('@property');
    // Once per document: whichever test registered them first, they are registered now.
    expect(registeredBeamProperties()).toEqual(expect.arrayContaining(['--beam-angle-ui', '--beam-opacity-ui']));
    expect(wrap(el).hasAttribute('data-active')).toBe(true);
    expect(wrap(el).style.getPropertyValue('--beam-strength')).toBe('1');
    expect(el.active).toBe(true);
    expect(el.running).toBe(true);
  });

  it('attributes and data reshape the sheet; strength is clamped into the wrapper', () => {
    const el = mount({}, { size: 'line', duration: '4', strength: '0.4', 'color-variant': 'sunset' });
    expect(sheet(el)).toContain('beam-travel-ui 4s linear infinite');
    expect(wrap(el).style.getPropertyValue('--beam-strength')).toBe('0.4');
    el.data = { size: 'sm', strength: 7 };
    el.renderNow();
    expect(sheet(el)).toContain('border-radius: 12px');
    expect(sheet(el)).not.toContain('beam-travel-ui');
    expect(wrap(el).style.getPropertyValue('--beam-strength')).toBe('1');
  });

  it('host CSS stays text inside the style element — never markup', () => {
    const el = mount({ css: `</style>${XSS}<style>` });
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    expect(el.shadowRoot!.querySelectorAll('style')).toHaveLength(2);
    expect(sheet(el)).toContain(XSS);
  });

  it('theme: a pin, the page’s data-theme (and its switches), or the OS', () => {
    const el = mount({}, { theme: 'light' });
    expect(el.resolvedTheme).toBe('light');
    expect(sheet(el)).toContain('rgba(0, 0, 0, 0.55)');
    // Unpinned: the page's --ui-text token (light ink → a dark page).
    el.removeAttribute('theme');
    document.body.style.setProperty('--ui-text', '#ededf0');
    el.renderNow();
    expect(el.resolvedTheme).toBe('dark');
    expect(sheet(el)).toContain('rgba(255, 255, 255, 0.75)');
    document.body.setAttribute('data-theme', 'light');
    const mo = FakeMO.all[FakeMO.all.length - 1]!;
    // A switch elsewhere (not above it) is ignored; one above re-resolves.
    const other = document.createElement('div');
    mo.fire(other);
    el.renderNow();
    expect(el.resolvedTheme).toBe('dark');
    mo.fire(document.body);
    el.renderNow();
    expect(el.resolvedTheme).toBe('light');
    document.body.removeAttribute('data-theme');
    document.body.style.removeProperty('--ui-text');
    flip('(prefers-color-scheme: dark)');
    el.renderNow();
    // Back to the host's own token: the light fallback in happy-dom (a browser applies the OS media query here).
    expect(el.resolvedTheme).toBe(colorIsLight(getComputedStyle(el).getPropertyValue('--text')) ? 'dark' : 'light');
  });

  it('active: fades out, then off for good with ui-deactivate; back on with ui-activate', () => {
    const el = mount();
    const seen: string[] = [];
    el.addEventListener('ui-activate', (e) => seen.push(`${e.type}:${JSON.stringify((e as CustomEvent).detail)}`));
    el.addEventListener('ui-deactivate', (e) => seen.push(`${e.type}:${JSON.stringify((e as CustomEvent).detail)}`));
    end(el, 'beam-fade-in-ui');
    expect(seen).toEqual(['ui-activate:{"active":true}']);
    el.setAttribute('active', 'false');
    el.renderNow();
    expect(wrap(el).hasAttribute('data-fading')).toBe(true);
    expect(wrap(el).hasAttribute('data-active')).toBe(false);
    expect(el.active).toBe(true);
    // Not the wrapper's own fade: a pseudo-layer's, or an animation inside the slotted element.
    end(el, 'beam-fade-out-ui', { pseudoElement: '::after' });
    end(el, 'beam-fade-out-ui', { target: el.querySelector('.card')! });
    expect(wrap(el).hasAttribute('data-fading')).toBe(true);
    end(el, 'beam-fade-out-ui');
    expect(wrap(el).hasAttribute('data-fading')).toBe(false);
    expect(wrap(el).hasAttribute('data-active')).toBe(false);
    expect(el.active).toBe(false);
    expect(el.running).toBe(false);
    expect(seen.at(-1)).toBe('ui-deactivate:{"active":false}');
    el.data = { active: true };
    el.renderNow();
    expect(wrap(el).hasAttribute('data-active')).toBe(true);
    end(el, 'beam-fade-in-ui');
    expect(seen).toHaveLength(3);
    expect(seen.at(-1)).toBe('ui-activate:{"active":true}');
  });

  it('turned back on mid-fade: finishes the fade-out, then fades in again', () => {
    const el = mount();
    el.data = { active: false };
    el.renderNow();
    el.data = { active: true };
    el.renderNow();
    expect(wrap(el).hasAttribute('data-fading')).toBe(true);
    end(el, 'beam-fade-out-ui');
    expect(wrap(el).hasAttribute('data-active')).toBe(true);
  });

  it('mounted inactive: nothing on, nothing running', () => {
    const el = mount({ active: false, size: 'pulse-inner' });
    expect(wrap(el).hasAttribute('data-active')).toBe(false);
    expect(wrap(el).hasAttribute('data-fading')).toBe(false);
    expect(el.running).toBe(false);
    expect(frames.size).toBe(0);
  });

  it('offscreen: pauses (256px early) and resumes', () => {
    const el = mount();
    expect(io().options?.rootMargin).toBe('256px');
    io().fire(false);
    expect(wrap(el).hasAttribute('data-paused')).toBe(true);
    expect(el.running).toBe(false);
    io().fire(true);
    expect(wrap(el).hasAttribute('data-paused')).toBe(false);
  });

  it('pulse: the shared loop drives it while on, onscreen and shown — and stops for each of those', () => {
    const el = mount({ size: 'pulse-inner' });
    expect(pulseDriverState().instances).toBe(1);
    expect(el.running).toBe(true);
    step();
    expect(wrap(el).style.getPropertyValue('--bw1-ui')).not.toBe('');
    io().fire(false);
    expect(pulseDriverState()).toEqual({ instances: 0, running: false });
    io().fire(true);
    expect(pulseDriverState().instances).toBe(1);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(pulseDriverState().instances).toBe(0);
    Reflect.deleteProperty(document, 'hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(pulseDriverState().instances).toBe(1);
    el.data = { size: 'pulse-inner', active: false };
    el.renderNow();
    // Still breathing while it fades out; stopped once it is off.
    expect(pulseDriverState().instances).toBe(1);
    end(el, 'beam-fade-out-ui');
    expect(pulseDriverState()).toEqual({ instances: 0, running: false });
  });

  it('disconnect stops the loop and lets go of every observer and listener', () => {
    const el = mount({ size: 'pulse-outside' });
    expect(pulseDriverState().instances).toBe(1);
    el.remove();
    expect(pulseDriverState()).toEqual({ instances: 0, running: false });
    expect(frames.size).toBe(0);
    expect(FakeRO.all.every((r) => r.disconnected)).toBe(true);
    expect(FakeIO.all.every((r) => r.disconnected)).toBe(true);
    expect(FakeMO.all.every((r) => r.disconnected)).toBe(true);
    for (const set of media.values()) expect(set.size).toBe(0);
  });

  it('reduced motion: a still frame — no loop, the pose pinned, the fade kept', () => {
    reduce = true;
    const el = mount({ size: 'pulse-inner' });
    expect(wrap(el).hasAttribute('data-still')).toBe(true);
    expect(pulseDriverState().instances).toBe(0);
    expect(el.running).toBe(false);
    expect(sheet(el)).toContain('[data-still][data-active] { animation: beam-fade-in-ui');
    const md = mount();
    expect(sheet(md)).toContain(`--beam-angle-ui: ${STILL_ANGLE}deg`);
    expect(md.running).toBe(false);
    // The OS setting flips back: moving again.
    reduce = false;
    flip('(prefers-reduced-motion: reduce)');
    el.renderNow();
    expect(wrap(el).hasAttribute('data-still')).toBe(false);
    expect(pulseDriverState().instances).toBe(1);
    // Entering still again clears the breathing back to the rest pose.
    step();
    expect(wrap(el).style.getPropertyValue('--bw1-ui')).not.toBe('');
    el.setAttribute('motion', 'reduce');
    el.renderNow();
    expect(wrap(el).style.getPropertyValue('--bw1-ui')).toBe('');
    expect(pulseDriverState().instances).toBe(0);
  });

  it('motion="full" moves under reduced motion; motion="reduce" stills it without it', () => {
    reduce = true;
    const el = mount({ size: 'pulse-outside' }, { motion: 'full' });
    expect(wrap(el).hasAttribute('data-still')).toBe(false);
    expect(pulseDriverState().instances).toBe(1);
    expect(sheet(el)).not.toContain('prefers-reduced-motion');
    expect(sheet(el)).toContain('!important');
    reduce = false;
    const still = mount({}, { motion: 'reduce' });
    expect(wrap(still).hasAttribute('data-still')).toBe(true);
  });

  it('reads the slotted element’s radius, and sizes pulse-outside’s glow to it', () => {
    const child = card('width:700px;height:70px;border-radius:22px');
    vi.spyOn(child, 'getBoundingClientRect').mockReturnValue({ width: 700, height: 70 } as DOMRect);
    const el = mount({ size: 'pulse-outside' }, {}, child);
    el.renderNow();
    expect(sheet(el)).toContain('border-radius: 22px');
    expect(wrap(el).style.getPropertyValue('--pulse-glow-sx')).toBe('2');
    expect(wrap(el).style.getPropertyValue('--pulse-glow-sy')).toBe('0.5');
    const ro = FakeRO.all[FakeRO.all.length - 1]!;
    expect(ro.targets).toContain(child);
    child.style.borderRadius = '6px';
    ro.fire();
    el.renderNow();
    expect(sheet(el)).toContain('border-radius: 6px');
    // An explicit radius wins.
    el.data = { size: 'pulse-outside', borderRadius: 30 };
    el.renderNow();
    expect(sheet(el)).toContain('border-radius: 30px');
    el.data = { size: 'md' };
    el.renderNow();
    expect(wrap(el).style.getPropertyValue('--pulse-glow-sx')).toBe('');
  });

  it('no CSS.registerProperty (an old engine): still renders, never throws', () => {
    vi.stubGlobal('CSS', undefined);
    const el = mount({ size: 'line' });
    expect(sheet(el)).toContain('beam-travel-ui');
  });

  it('the shadow keeps its nodes across renders (no restart of the running animations)', () => {
    const el = mount();
    const w = wrap(el);
    el.data = { size: 'sm' };
    el.renderNow();
    expect(wrap(el)).toBe(w);
  });
});

describe('docs', () => {
  it('names the source and builds every demo', () => {
    expect(doc.group).toBe('Effects');
    expect(doc.reference.url).toBe('https://libraries.dev/beam');
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const d of doc.demos) {
      const node = d.create();
      document.body.append(node);
      expect(
        node.querySelectorAll('ui-border-beam').length + Number(node.localName === 'ui-border-beam'),
      ).toBeGreaterThan(0);
    }
  });
});
