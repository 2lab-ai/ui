import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { doc } from './docs';
import { hexToRgb, hexToRgba, hsvToRgb, rgbToHsv } from './engine/color';
import { gaussBlur } from './engine/glow/bake';
import { GLOW, GLOW_DEFAULTS, GLOW_MARKUP_KEYS, resetGlowConfig, setGlowConfig } from './engine/glow/config';
import { arcAtPoint, rrPerim, sampleAtArc, shapePerim, smoothstep } from './engine/glow/geometry';
import { PRESETS } from './engine/presets';
import { commonAncestor } from './engine/reflection/paint';
import { isMetalFxSupported, presetKey, presetModeFor } from './engine/renderer/core';
import { outlinePathD, roundRectOutline } from './engine/renderer/outline';
import { LIQUID_METAL_FRAGMENT_SHADER, VERT_SHADER_SRC } from './engine/shaders';
import { textRun } from './engine/textMask';
import { ease, tween, tweenStart, tweenTick } from './engine/tween';
import { type MetalData, UiMetal } from './metal';
import {
  metalCssValue,
  metalFlag,
  metalGlowMode,
  metalHexColor,
  metalIdList,
  metalInnerShadow,
  metalMaskPoints,
  metalMotion,
  metalNumber,
  metalOptionalNumber,
  metalPreset,
  metalRadius,
  metalReduced,
  metalResolvedTheme,
  metalTheme,
  metalVariant,
} from './options';
import { METAL_FALLBACK_GRADIENTS, styles } from './styles';

const XSS = '<img src=x onerror=alert(1)>';
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

let reduce = false;
let dark = false;
let media: Map<string, Set<() => void>>;

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
  reduce = false;
  dark = false;
  media = new Map();
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
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function mount(data: MetalData = {}, attrs: Record<string, string> = {}, child = '<button>Upgrade</button>') {
  const el = document.createElement('ui-metal');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  el.innerHTML = child;
  document.body.append(el);
  await Promise.resolve();
  el.renderNow();
  return el;
}

const root = (el: UiMetal) => el.shadowRoot!.querySelector<HTMLElement>('.ui-root')!;

describe('the shaders (Paper Shaders 0.0.80, inlined unmodified)', () => {
  it('are byte-identical to the package exports (SHA-256 pinned)', () => {
    expect(sha(LIQUID_METAL_FRAGMENT_SHADER)).toBe('bfefe9d474e890f75302bddaacc00d7d04b98cb7147d059a365f97c9665f5463');
    expect(sha(VERT_SHADER_SRC)).toBe('d5452769f5dc08d3a378e77611f42343d78c7962fc7983d9508126dc1b8c65d2');
    expect(LIQUID_METAL_FRAGMENT_SHADER).toHaveLength(11450);
    expect(VERT_SHADER_SRC).toHaveLength(5034);
  });

  it('start with #version 300 es and declare what the renderer binds', () => {
    expect(LIQUID_METAL_FRAGMENT_SHADER.startsWith('#version 300 es')).toBe(true);
    expect(VERT_SHADER_SRC.startsWith('#version 300 es')).toBe(true);
    for (const u of ['u_colorTint', 'u_repetition', 'u_shiftRed', 'u_shape', 'u_image']) {
      expect(LIQUID_METAL_FRAGMENT_SHADER).toContain(`uniform`);
      expect(LIQUID_METAL_FRAGMENT_SHADER).toContain(u);
    }
    expect(VERT_SHADER_SRC).toContain('in vec4 a_position');
  });
});

describe('presets (metal-fx, unchanged)', () => {
  it('keeps the tuned values per preset and theme', () => {
    expect(PRESETS.chromatic.modes.dark).toMatchObject({ colorTint: '#88ccff2e', shiftRed: 0.75, repetition: 2 });
    expect(PRESETS.chromatic.modes.light).toMatchObject({ colorTint: '#66b0ff99', shiftRed: 0.6 });
    expect(PRESETS.silver.modes.dark.shaderOpacity).toBe(0.88);
    expect(PRESETS.gold.modes.dark).toMatchObject({ colorTint: '#ffcc55cc', speed: 0.85 });
    for (const p of Object.values(PRESETS))
      for (const m of Object.values(p.modes)) expect(m.colorBack).toBe('#00000000');
  });

  it('names a frame per preset and theme; unknown keys fall back to chromatic/dark', () => {
    expect(presetKey('gold', 'light')).toBe('gold/light');
    expect(presetModeFor('gold/light')).toBe(PRESETS.gold.modes.light);
    expect(presetModeFor('nope/x')).toBe(PRESETS.chromatic.modes.dark);
  });
});

describe('engine maths', () => {
  it('converts colours', () => {
    expect(hexToRgb('#ff8000')).toEqual([1, 128 / 255, 0]);
    expect(hexToRgb('#fff')).toEqual([1, 1, 1]);
    expect(hexToRgba('#88ccff2e')[3]).toBeCloseTo(0x2e / 255);
    expect(hexToRgba('#abc')[3]).toBe(1);
    expect(hexToRgba('#abcd')[3]).toBeCloseTo(0xdd / 255);
    const [h, s, v] = rgbToHsv(200, 100, 50);
    expect(hsvToRgb(h, s, v)).toEqual([200, 100, 50]);
  });

  it('samples a rounded rect outline clockwise, closed, every ~1.5px', () => {
    const buf = roundRectOutline(0, 0, 140, 40, 20, null);
    expect(buf.n).toBeGreaterThan(4 * 15);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < buf.n; i++) {
      xs.push(buf.xy[i * 2]);
      ys.push(buf.xy[i * 2 + 1]);
    }
    expect(Math.min(...xs)).toBeCloseTo(0);
    expect(Math.max(...xs)).toBeCloseTo(140);
    expect(Math.min(...ys)).toBeCloseTo(0);
    expect(Math.max(...ys)).toBeCloseTo(40);
    expect(outlinePathD(buf).startsWith('M20.00 0.00')).toBe(true);
    expect(outlinePathD(buf).endsWith('Z')).toBe(true);
    // A deform displaces every point.
    const moved = roundRectOutline(0, 0, 140, 40, 20, (x, y, o) => {
      o.x = x + 1;
      o.y = y;
    });
    expect(moved.xy[0]).toBeCloseTo(21);
  });

  it('walks the perimeter and finds the arc back from a point', () => {
    expect(rrPerim(140, 40, 20)).toBeCloseTo(2 * 100 + 2 * Math.PI * 20);
    expect(shapePerim(40, 40, 20, 'circle')).toBeCloseTo(2 * Math.PI * 20);
    for (const s of [5, 60, 140, 200]) {
      const p = sampleAtArc(s, 140, 40, 20, 0, 0, 'pill');
      expect(arcAtPoint(p.x, p.y, 140, 40, 20, 'pill')).toBeCloseTo(s, 1);
    }
    const c = sampleAtArc(0, 40, 40, 20, 0, 0, 'circle');
    expect(c.x).toBeCloseTo(20);
    expect(c.y).toBeCloseTo(0);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(1, 1, 0.5)).toBe(0);
  });

  it('tweens and blurs', () => {
    const tw = tween(0, 1, 100, ease.smoothstep);
    tweenStart(tw, 0);
    expect(tweenTick(tw, 50)).toBeCloseTo(0.5);
    expect(tweenTick(tw, 150)).toBe(1);
    expect(tw.done).toBe(true);
    const a = new Float32Array(9 * 9);
    a[40] = 1;
    const b = gaussBlur(Float32Array.from(a), 9, 9, 1);
    expect(b[40]).toBeLessThan(1);
    expect(b[41]).toBeGreaterThan(0);
    expect(gaussBlur(a, 9, 9, 0)).toBe(a);
  });

  it('flags glow markup keys and restores the defaults', () => {
    setGlowConfig({ peakOp: 0.5 });
    expect(GLOW.peakOp).toBe(0.5);
    expect(GLOW_MARKUP_KEYS.has('haloStrokeXl')).toBe(true);
    expect(GLOW_MARKUP_KEYS.has('peakOp')).toBe(false);
    resetGlowConfig();
    expect(GLOW.peakOp).toBe(GLOW_DEFAULTS.peakOp);
  });

  it('collapses a text run the way the DOM lays it out', () => {
    const p = document.createElement('span');
    p.textContent = '\n   Plan \n  Pro  ';
    expect(textRun(p)).toBe('Plan Pro');
  });

  it('finds the common ancestor of a shadow node and a light node', () => {
    const host = document.createElement('div');
    const sib = document.createElement('span');
    const wrap = document.createElement('section');
    wrap.append(host, sib);
    document.body.append(wrap);
    const sr = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('i');
    sr.append(inner);
    expect(commonAncestor(inner, sib)).toBe(wrap);
    expect(commonAncestor(sib, sib)).toBe(sib);
  });
});

describe('option helpers', () => {
  it('clamps numbers and reads attribute strings', () => {
    expect(metalNumber('0.5', 0, 1, 1)).toBe(0.5);
    expect(metalNumber(7, 0, 1, 1)).toBe(1);
    expect(metalNumber('-3', 0, 1, 1)).toBe(0);
    expect(metalNumber('abc', 0, 1, 0.3)).toBe(0.3);
    expect(metalNumber(Number.NaN, 0, 1, 0.3)).toBe(0.3);
    expect(metalNumber('', 0, 1, 0.3)).toBe(0.3);
    expect(metalNumber(null, 0, 1, 0.3)).toBe(0.3);
    expect(metalOptionalNumber(undefined, 0, 1)).toBeUndefined();
    expect(metalOptionalNumber('12', 0, 10)).toBe(10);
  });

  it('reads flags, enums and the theme', () => {
    expect(metalFlag('', false)).toBe(true);
    expect(metalFlag('false', true)).toBe(false);
    expect(metalFlag('off', true)).toBe(false);
    expect(metalFlag(undefined, true)).toBe(true);
    expect(metalFlag('maybe', false)).toBe(false);
    expect(metalPreset(' GOLD ')).toBe('gold');
    expect(metalPreset('platinum')).toBe('chromatic');
    expect(metalVariant('circle')).toBe('circle');
    expect(metalVariant('square')).toBe('button');
    expect(metalTheme('Dark')).toBe('dark');
    expect(metalTheme('sepia')).toBe('auto');
    expect(metalMotion('reduce')).toBe('reduce');
    expect(metalMotion('fast')).toBe('system');
    expect(metalGlowMode('ring', 'mask')).toBe('ring');
    expect(metalGlowMode('x', 'mask')).toBe('mask');
  });

  it('reduces motion as asked', () => {
    expect(metalReduced('system', true)).toBe(true);
    expect(metalReduced('system', false)).toBe(false);
    expect(metalReduced('reduce', false)).toBe(true);
    expect(metalReduced('full', true)).toBe(false);
  });

  it('resolves the theme from a pin, then the color scheme, then the OS', () => {
    expect(metalResolvedTheme('light', 'dark', true)).toBe('light');
    expect(metalResolvedTheme('auto', 'dark', false)).toBe('dark');
    expect(metalResolvedTheme('auto', 'light', true)).toBe('light');
    expect(metalResolvedTheme('auto', 'light dark', true)).toBe('dark');
    expect(metalResolvedTheme('auto', '', false)).toBe('light');
  });

  it('keeps a rim colour to #rrggbb and clamps the rim', () => {
    expect(metalHexColor('#ABC')).toBe('#aabbcc');
    expect(metalHexColor('#11223344')).toBe('#112233');
    expect(metalHexColor('red')).toBe('#ffffff');
    expect(metalHexColor(XSS)).toBe('#ffffff');
    expect(metalInnerShadow(undefined)).toBeNull();
    expect(metalInnerShadow(false)).toBeNull();
    expect(metalInnerShadow('false')).toBeNull();
    expect(metalInnerShadow(true)).toEqual({ offsetY: 1, blur: 0.5, alpha: 0.9, color: '#ffffff' });
    expect(metalInnerShadow('')).toEqual({ offsetY: 1, blur: 0.5, alpha: 0.9, color: '#ffffff' });
    expect(metalInnerShadow({ offsetY: 9, blur: -1, alpha: 2, color: 'javascript:x' })).toEqual({
      offsetY: 4,
      blur: 0,
      alpha: 1,
      color: '#ffffff',
    });
  });

  it('resolves the radius: a circle is a circle, else explicit, child, root — never past half the short side', () => {
    expect(metalRadius('circle', 36, 40, 4, 2, 0)).toBe(18);
    expect(metalRadius('pill', 140, 40, 8, 99, 0)).toBe(8);
    expect(metalRadius('pill', 140, 40, undefined, 999, 0)).toBe(20);
    expect(metalRadius('pill', 140, 40, undefined, 0, 6)).toBe(6);
    expect(metalRadius('pill', 140, 40, undefined, Number.NaN, Number.NaN)).toBe(0);
  });

  it('samples mask points on a ~2px grid where the mask is opaque', () => {
    const w = 8;
    const h = 4;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < 4; x++) data[(y * w + x) * 4 + 3] = 255;
    const pts = metalMaskPoints(data, w, h, 1);
    expect(pts.length).toBeGreaterThan(0);
    expect(pts.every((p) => p.x < 4)).toBe(true);
  });

  it('keeps host CSS values to what the property accepts', () => {
    expect(metalCssValue('font', '500 24px/1.2 "Inter", sans-serif')).toBe('500 24px/1.2 "Inter", sans-serif');
    expect(metalCssValue('color', 'red; background: url(x)')).toBe('');
    expect(metalCssValue('color', XSS)).toBe('');
    expect(metalCssValue('color', 42)).toBe('');
    expect(metalCssValue('color', 'x'.repeat(300))).toBe('');
  });

  it('splits id lists', () => {
    expect(metalIdList('  a b  a c ')).toEqual(['a', 'b', 'c']);
    expect(metalIdList(null)).toEqual([]);
  });
});

describe('<ui-metal> without WebGL (happy-dom)', () => {
  it('reports no WebGL2 and falls back to the CSS ring', async () => {
    expect(isMetalFxSupported()).toBe(false);
    expect(UiMetal.supported).toBe(false);
    const el = await mount();
    expect(el.rendering).toBe('fallback');
    expect(root(el).hasAttribute('data-fallback')).toBe(true);
    // The child shows as it is: no normalisation in the fallback.
    expect(root(el).hasAttribute('data-normalize')).toBe(false);
    expect(el.shadowRoot!.querySelector('.mfx-fallback')).not.toBeNull();
  });

  it('keeps the host’s markup in the light DOM, slotted, with every added layer hidden', async () => {
    const el = await mount({}, {}, '<button aria-label="Send">↑</button>');
    expect(el.querySelector('button')?.getAttribute('aria-label')).toBe('Send');
    const sr = el.shadowRoot!;
    expect(sr.querySelector('slot')).not.toBeNull();
    for (const sel of ['canvas', '.mfx-inner', '.mfx-glow', '.mfx-rim', '.mfx-fallback'])
      expect(sr.querySelector(sel)?.getAttribute('aria-hidden')).toBe('true');
    expect(sr.querySelector('[role]')).toBeNull();
  });

  it('reflects variant, preset, theme and strength on the root, clamped', async () => {
    const el = await mount({}, { variant: 'circle', preset: 'gold', theme: 'dark', strength: '7' });
    const r = root(el);
    expect(r.dataset.variant).toBe('circle');
    expect(r.dataset.shape).toBe('circle');
    expect(r.dataset.preset).toBe('gold');
    expect(r.dataset.theme).toBe('dark');
    expect(r.dataset.pin).toBe('dark');
    expect(r.style.getPropertyValue('--mfx-strength')).toBe('1');
    expect(r.style.getPropertyValue('--mfx-ring')).toBe('2px');
    el.setAttribute('strength', '-2');
    el.setAttribute('preset', 'unobtainium');
    el.setAttribute('variant', 'hexagon');
    el.renderNow();
    expect(r.style.getPropertyValue('--mfx-strength')).toBe('0');
    expect(r.dataset.preset).toBe('chromatic');
    expect(r.dataset.variant).toBe('button');
    expect(r.style.getPropertyValue('--mfx-ring')).toBe('1px');
  });

  it('data wins over attributes; ringCssPx and scale are clamped', async () => {
    const el = await mount({ preset: 'silver', ringCssPx: 99, scale: 2 }, { preset: 'gold' });
    expect(root(el).dataset.preset).toBe('silver');
    expect(root(el).style.getPropertyValue('--mfx-ring')).toBe('20px');
    el.data = { scale: 2 };
    el.renderNow();
    expect(root(el).style.getPropertyValue('--mfx-ring')).toBe('2px');
  });

  it('follows the page’s color scheme when nothing pins it, and switches live', async () => {
    // happy-dom does not evaluate the host's prefers-color-scheme rule: stand in for the computed color-scheme.
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) => {
      const cs = real(el, pseudo);
      if (!(el instanceof UiMetal)) return cs;
      return new Proxy(cs, {
        get: (t, k) => (k === 'colorScheme' ? (dark ? 'dark' : 'light') : Reflect.get(t, k)),
      });
    });
    dark = true;
    const el = await mount();
    expect(root(el).dataset.theme).toBe('dark');
    expect(root(el).hasAttribute('data-pin')).toBe(false);
    dark = false;
    for (const fn of Array.from(listeners('(prefers-color-scheme: dark)'))) fn();
    await Promise.resolve();
    expect(root(el).dataset.theme).toBe('light');
  });

  it('is a still frame under reduced motion, unless motion="full"', async () => {
    reduce = true;
    const el = await mount();
    expect(el.paused).toBe(true);
    el.setAttribute('motion', 'full');
    el.renderNow();
    expect(el.paused).toBe(false);
    el.setAttribute('motion', 'reduce');
    reduce = false;
    el.renderNow();
    expect(el.paused).toBe(true);
  });

  it('pauses and plays through methods and the attribute', async () => {
    const el = await mount({}, { paused: '' });
    expect(el.paused).toBe(true);
    el.play();
    el.renderNow();
    expect(el.paused).toBe(false);
    expect(root(el).hasAttribute('data-paused')).toBe(false);
    el.pause();
    el.renderNow();
    expect(el.paused).toBe(true);
    expect(root(el).dataset.paused).toBe('true');
  });

  it('never puts a host string into its markup', async () => {
    const el = await mount(
      { innerShadow: { color: XSS }, borderRadius: XSS as unknown as number, preset: XSS as never },
      { reflect: XSS, theme: XSS, motion: XSS, variant: XSS },
      `<span>${'&lt;b&gt;'}</span>`,
    );
    expect(el.shadowRoot!.innerHTML).not.toContain('onerror');
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    expect(root(el).dataset.preset).toBe('chromatic');
  });

  it('lang="ko" changes no semantics (the metal has no words of its own)', async () => {
    const el = await mount({}, { lang: 'ko' }, '<button>프로로 업그레이드</button>');
    expect(el.shadowRoot!.querySelector('.ui-root')?.textContent).toBe('');
    expect(el.querySelector('button')?.textContent).toBe('프로로 업그레이드');
  });

  it('cleans up on disconnect: media listeners and observers go', async () => {
    const el = await mount();
    expect(listeners('(prefers-color-scheme: dark)').size).toBe(1);
    expect(listeners('(prefers-reduced-motion: reduce)').size).toBe(1);
    el.remove();
    expect(listeners('(prefers-color-scheme: dark)').size).toBe(0);
    expect(listeners('(prefers-reduced-motion: reduce)').size).toBe(0);
  });
});

describe('styles and docs', () => {
  it('ships a fallback gradient per preset and no light-only chrome', () => {
    expect(Object.keys(METAL_FALLBACK_GRADIENTS)).toEqual(['chromatic', 'silver', 'gold']);
    expect(styles).toContain('var(--metal-fill, var(--surface))');
    expect(styles).toContain('[data-fallback]');
    expect(styles).toContain('::slotted(:focus-visible)');
    expect(styles).toContain('forced-colors');
  });

  it('documents the element as an Effect with ≥ 3 demos that build', async () => {
    expect(doc.group).toBe('Effects');
    expect(doc.tag).toBe('ui-metal');
    expect(doc.reference.url).toBe('https://libraries.dev/metal');
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const d of doc.demos) {
      const el = d.create();
      document.body.append(el);
      expect(el.querySelector('ui-metal') ?? (el.localName === 'ui-metal' ? el : null)).not.toBeNull();
      el.remove();
    }
  });
});
