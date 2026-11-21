import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as positionApi from '../voice-position/index';
import * as ringApi from '../voice-ring/index';
import { doc } from './docs';
import {
  acquireAnalyser,
  acquireSource,
  audioHolds,
  audioResumePending,
  bandAverage,
  demoVoiceLevel,
  followLevel,
  isAudioSupported,
  readLevel,
  rms,
  shapeLevel,
} from './engine/audio';
import { parseRgb, toRgb, toTriple } from './engine/color';
import {
  bandClips,
  bandPoints,
  bell,
  cornerLift,
  edgeEnvelope,
  glowShape,
  hueDrift,
  paintedRadius,
  pingPong,
  tailLift,
  wrapX,
} from './engine/driver';
import { colorChannels, hostIsDark, isLightColor, motionOf, motionReduced } from './engine/env';
import {
  pixelDomeDefault,
  pixelDustDefault,
  pixelGlowDefault,
  resolveVoiceDefaults,
  resolveVoiceStyle,
  voiceDefaults,
} from './engine/presets';
import { generateVoiceGlowCss, LOBE_SPAN, lobeColors, voiceLobes, voicePalettes } from './engine/styles';
import { type Clock, FakeAudioContext, FakeIO, fakeStream, stubAudio, stubCanvas, stubFrames, XSS } from './fixtures';
import * as glowApi from './index';
import { resolveVoiceGlow, type UiVoiceGlow, type VoiceGlowData, voiceGlowPalette, voiceGlowType } from './voice-glow';

let clock: Clock;

beforeEach(() => {
  document.body.innerHTML = '';
  clock = stubFrames();
});

afterEach(() => {
  document.body.innerHTML = '';
  Reflect.deleteProperty(document, 'visibilityState');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mount(attrs: Record<string, string> = {}, data?: VoiceGlowData, child = true): UiVoiceGlow {
  const el = document.createElement('ui-voice-glow');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (data) el.data = data;
  if (child) {
    const box = document.createElement('div');
    box.style.borderRadius = '20px';
    box.textContent = 'Composer';
    el.append(box);
  }
  document.body.append(el);
  el.renderNow();
  return el;
}
const frame = (el: UiVoiceGlow) => el.shadowRoot!.querySelector<HTMLElement>('.vg')!;
const status = (el: UiVoiceGlow) => el.shadowRoot!.querySelector<HTMLElement>('[role="status"]')!;
const sheet = (el: UiVoiceGlow) => el.shadowRoot!.querySelector('style[data-vg]')!.textContent ?? '';
const env = { dark: true, motion: 'system' as const, reduced: false, paused: false };

// ── Audio and level helpers ─────────────────────────────────────────────────────────────────────────────────────

describe('level helpers', () => {
  it('shapeLevel: a noise gate, then a soft saturation that reaches 1 at full', () => {
    expect(shapeLevel(0.01, 0.015)).toBe(0);
    expect(shapeLevel(0.015, 0.015)).toBe(0);
    expect(shapeLevel(1, 0.015)).toBeCloseTo(1, 6);
    expect(shapeLevel(Number.NaN, 0.1)).toBe(0);
    const a = shapeLevel(0.3, 0.015);
    const b = shapeLevel(0.6, 0.015);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    // soft: half the input is well past half the output
    expect(shapeLevel(0.5, 0)).toBeGreaterThan(0.7);
  });

  it('followLevel: rises on the attack, falls on the release, never overshoots', () => {
    const up = followLevel(0, 1, 0.1, 0.1, 1);
    const down = followLevel(1, 0, 0.1, 0.1, 1);
    expect(up).toBeCloseTo(1 - Math.exp(-1), 6);
    expect(1 - down).toBeCloseTo(1 - Math.exp(-0.1), 6);
    expect(followLevel(0.5, 0.5, 1, 0.1, 0.1)).toBe(0.5);
    expect(followLevel(0, 1, 100, 0.1, 1)).toBeLessThanOrEqual(1);
    expect(followLevel(0.3, 1, 0, 0.1, 1)).toBe(0.3);
  });

  it('readLevel: numbers, numeric strings and getters, clamped; anything else (or a throw) is 0', () => {
    expect(readLevel(0.4)).toBe(0.4);
    expect(readLevel('0.25')).toBe(0.25);
    expect(readLevel(3)).toBe(1);
    expect(readLevel(-1)).toBe(0);
    expect(readLevel(() => 0.7)).toBe(0.7);
    expect(readLevel(Number.NaN)).toBe(0);
    expect(readLevel(Number.POSITIVE_INFINITY)).toBe(0);
    expect(readLevel('loud')).toBe(0);
    expect(readLevel(null)).toBe(0);
    expect(
      readLevel(() => {
        throw new Error('meter gone');
      }),
    ).toBe(0);
  });

  it('rms and bandAverage', () => {
    expect(rms([])).toBe(0);
    expect(rms([0.5, -0.5, 0.5, -0.5])).toBeCloseTo(0.5, 6);
    const freq = new Uint8Array(512).fill(0);
    freq.fill(255, 2, 7);
    // 48 kHz / 1024 → 46.875 Hz a bin: 80–300 Hz reads bins 1…7
    expect(bandAverage(freq, 46.875, 80, 300)).toBeCloseTo(5 / 7, 5);
    expect(bandAverage(freq, 0, 80, 300)).toBe(0);
    expect(bandAverage(new Uint8Array(0), 46.875, 80, 300)).toBe(0);
  });

  it('demoVoiceLevel: 0–1, silent in the last 2.4 s of each 9 s phrase', () => {
    for (let t = 0; t < 18; t += 0.13) {
      const v = demoVoiceLevel(t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(demoVoiceLevel(7)).toBe(0);
    expect(demoVoiceLevel(16)).toBe(0);
    expect(Math.max(...Array.from({ length: 60 }, (_, i) => demoVoiceLevel(i * 0.1)))).toBeGreaterThan(0.5);
  });
});

describe('audio leases', () => {
  it('without Web Audio (happy-dom): unsupported, no lease, nothing held', () => {
    expect(isAudioSupported()).toBe(false);
    expect(acquireAnalyser(fakeStream())).toBeNull();
    expect(audioHolds()).toBe(0);
  });

  it('a stream without an audio track gets no lease and opens no context', () => {
    stubAudio();
    expect(acquireAnalyser(fakeStream(0))).toBeNull();
    expect(acquireAnalyser(null)).toBeNull();
    expect(FakeAudioContext.all).toHaveLength(0);
  });

  it('leases share one context and one source per stream; the last release closes it; tracks are never stopped', () => {
    stubAudio();
    const s = fakeStream();
    const a = acquireAnalyser(s)!;
    const b = acquireAnalyser(s)!;
    expect(a).not.toBeNull();
    expect(FakeAudioContext.all).toHaveLength(1);
    const ctx = FakeAudioContext.all[0];
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.analysers).toHaveLength(2);
    expect(a.analyser.fftSize).toBe(1024);
    expect(a.analyser.smoothingTimeConstant).toBe(0.5);
    expect(audioHolds()).toBe(2);
    a.release();
    a.release();
    expect(audioHolds()).toBe(1);
    expect(ctx.closed).toBe(0);
    b.release();
    expect(audioHolds()).toBe(0);
    expect(ctx.closed).toBe(1);
    expect(ctx.sources[0].disconnects).toBeGreaterThan(0);
    expect(s.tracks[0].stopped).toBe(0);
    // a new lease opens a new context
    const c = acquireSource(s)!;
    expect(FakeAudioContext.all).toHaveLength(2);
    c.release();
  });
});

describe('audio: a refused resume', () => {
  class Suspended extends FakeAudioContext {
    refuse = true;
    resumes = 0;
    constructor() {
      super();
      this.state = 'suspended';
    }
    override resume(): Promise<void> {
      this.resumes++;
      if (this.refuse) return Promise.reject(new Error('NotAllowedError'));
      this.state = 'running';
      return Promise.resolve();
    }
  }
  const flush = async () => {
    for (let i = 0; i < 4; i++) await Promise.resolve();
  };

  it('waits for the next user gesture, retries on each, and stops listening for gestures once running', async () => {
    FakeAudioContext.all = [];
    vi.stubGlobal('AudioContext', Suspended);
    const lease = acquireAnalyser(fakeStream())!;
    const ctx = FakeAudioContext.all[0] as Suspended;
    await flush();
    expect(ctx.resumes).toBe(1);
    expect(audioResumePending()).toBe(true);
    document.dispatchEvent(new Event('keydown'));
    await flush();
    expect(ctx.resumes).toBe(2);
    expect(audioResumePending()).toBe(true);
    ctx.refuse = false;
    document.dispatchEvent(new Event('pointerdown'));
    await flush();
    expect(ctx.state).toBe('running');
    expect(audioResumePending()).toBe(false);
    document.dispatchEvent(new Event('pointerdown'));
    expect(ctx.resumes).toBe(3);
    lease.release();
  });

  it('the last release closes the context and stops waiting for a gesture', async () => {
    FakeAudioContext.all = [];
    vi.stubGlobal('AudioContext', Suspended);
    const lease = acquireAnalyser(fakeStream())!;
    await flush();
    expect(audioResumePending()).toBe(true);
    lease.release();
    expect(audioResumePending()).toBe(false);
    expect(FakeAudioContext.all[0].closed).toBe(1);
  });
});

describe('package-root names', () => {
  it('every name the three elements export carries Voice / voice / VOICE_, and none is exported twice', () => {
    const names = [...Object.keys(glowApi), ...Object.keys(ringApi), ...Object.keys(positionApi)];
    expect(names.length).toBeGreaterThan(30);
    for (const n of names) expect([n, /voice/i.test(n)]).toEqual([n, true]);
    expect(new Set(names).size).toBe(names.length);
    for (const generic of [
      'PRESETS',
      'OrbFrame',
      'Dot',
      'makeProj',
      'radiusScale',
      'paintFrame',
      'clamp01',
      'parseRgb',
    ]) {
      expect(names).not.toContain(generic);
    }
    expect(ringApi.VOICE_RING_PRESETS.aura.lean?.move).toBe(0.21);
  });
});

// ── Glow maths ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('glow maths', () => {
  it('wrapX wraps into [-span/2, span/2); edgeEnvelope is 1 at centre, 0 past the wrap', () => {
    expect(wrapX(0, 252)).toBe(0);
    expect(wrapX(130, 252)).toBe(130 - 252);
    expect(wrapX(-127, 252)).toBe(-127 + 252);
    expect(edgeEnvelope(0, 252)).toBe(1);
    expect(edgeEnvelope(130, 252)).toBe(0);
    expect(edgeEnvelope(60, 252)).toBeGreaterThan(edgeEnvelope(100, 252));
  });

  it('bell is 1 at the centre and 0 at the ends; skew widens the right', () => {
    expect(bell(0, 1.75, 0.87, 0.12)).toBeCloseTo(1, 6);
    expect(bell(1, 1.75, 0.87, 0.12)).toBeCloseTo(0, 6);
    expect(bell(-1, 1.75, 0.87, 0.12)).toBeCloseTo(0, 6);
    expect(bell(0.4, 1.75, 0.87, 0.3)).toBeGreaterThan(bell(-0.4, 1.75, 0.87, 0.3));
  });

  it('tailLift: nothing before its start, the full lift at the corner', () => {
    expect(tailLift(10, 100, 0.6, 0.67, 2.4)).toBe(0);
    expect(tailLift(100, 100, 0.6, 0.67, 2.4)).toBeCloseTo(0.6, 6);
    expect(tailLift(100, 100, 0, 0.67, 2.4)).toBe(0);
    expect(tailLift(85, 100, 0.6, 0.67, 2.4)).toBeGreaterThan(0);
  });

  it('paintedRadius clamps to half the box; cornerLift rides the arc', () => {
    expect(paintedRadius(106, 150, 44)).toBe(22);
    expect(cornerLift(75, 150, 22)).toBe(0);
    expect(cornerLift(0, 150, 22)).toBe(22);
    expect(cornerLift(11, 150, 22)).toBeGreaterThan(0);
    expect(cornerLift(11, 150, 0)).toBe(0);
  });

  it('bandPoints: 57 points across the element and past it with a tail; the peak above the base', () => {
    const r = resolveVoiceGlow({}, env);
    const f = { cx: 0, w: 1.5, h: 1.2, mw: 1, lift: 40, strength: 0.7, level: 0.5, corner: 0 };
    const pts = bandPoints(r.config, f, 350, 100);
    expect(pts).toHaveLength(57);
    expect(pts[0][0]).toBeLessThan(0);
    expect(pts[56][0]).toBeGreaterThan(350);
    const mid = pts[28];
    expect(mid[1]).toBeLessThan(100 - r.config.bandOffset);
    // gathered (corner 1) drops the tail: the line spans only the bell
    const g = bandPoints(r.config, { ...f, corner: 1 }, 350, 100);
    expect(g[0][0]).toBeCloseTo(175 - 170 * r.config.rangeWidth * 1.5, 6);
  });

  it('bandClips: polygons above and below the line, at full and half raster', () => {
    const pts: Array<[number, number]> = [
      [0, 80],
      [50, 60],
      [100, 80],
    ];
    const full = bandClips(pts, 100, 100);
    expect(full.below).toBe('polygon(0 100.0px, 0.0px 80.0px, 50.0px 60.0px, 100.0px 80.0px, 100.0px 100.0px)');
    expect(full.above.startsWith('polygon(0 0, 100.0px 0,')).toBe(true);
    expect(bandClips(pts, 100, 100, 0.5).below).toContain('25.0px 30.0px');
  });

  it('pingPong, hueDrift and glowShape', () => {
    expect(pingPong(0)).toBeCloseTo(0, 9);
    expect(pingPong(0.5)).toBeCloseTo(1, 9);
    expect(hueDrift(0, 24, 12, false)).toBeCloseTo(-24, 6);
    expect(hueDrift(6, 24, 12, false)).toBeCloseTo(24, 6);
    expect(hueDrift(6, 24, 12, true)).toBe(0);
    expect(hueDrift(6, 0, 12, false)).toBe(0);
    expect(glowShape(0, 1.2, 1.05)).toEqual({ glow: 0.15, h: 0.5, w: 0.85 });
    const full = glowShape(1, 1.2, 1.05);
    expect(full.glow).toBeCloseTo(1, 9);
    expect(full.h).toBeCloseTo(1.7, 9);
    expect(full.w).toBeCloseTo(1.9, 9);
  });
});

// ── Presets, palettes, the stylesheet ──────────────────────────────────────────────────────────────────────────

describe('presets and palettes', () => {
  it('the types retune the defaults; light lifts reach, narrows spread and turns the epicentre on', () => {
    expect(resolveVoiceDefaults('default', 'dark')).toEqual(voiceDefaults);
    expect(resolveVoiceDefaults('pill', 'dark').scale).toBe(0.45);
    expect(resolveVoiceDefaults('mobile', 'dark').reach).toBe(3);
    const light = resolveVoiceDefaults('default', 'light');
    expect(light.reach).toBe(1.8);
    expect(light.spread).toBe(0.8);
    expect(light.coreLight).toBe(1.8);
    expect(light.bandStrength).toBe(1.7);
    expect(resolveVoiceDefaults('pill', 'light').bandStrength).toBe(2);
  });

  it('the dither takes the phone tuning exactly on the phone, as ratios elsewhere, and its own per type', () => {
    const phone = resolveVoiceDefaults('mobile', 'dark', 'dither');
    expect(phone.bend).toBe(19);
    expect(phone.scale).toBe(1);
    expect(resolveVoiceDefaults('default', 'dark', 'dither').pixelSize).toBe(0.85);
    expect(resolveVoiceDefaults('default', 'dark', 'dither').bandSkew).toBe(0);
    expect(pixelGlowDefault('default', 'dither')).toBe(0.38);
    expect(pixelGlowDefault('mobile', 'dither')).toBe(0.6);
    expect(pixelDustDefault('mobile')).toBe(1.5);
    expect(pixelDustDefault('pill')).toBe(1.1);
    expect(pixelDomeDefault('mobile')).toBe(0.6);
    expect(pixelDomeDefault('default')).toBe(0);
  });

  it('style per type and theme', () => {
    expect(resolveVoiceStyle('default', 'dark').brightness).toBe(1.15);
    expect(resolveVoiceStyle('pill', 'light')).toEqual({});
    expect(resolveVoiceStyle('mobile', 'light').strength).toBe(1);
  });

  it('eight palettes of seven colours per theme; custom colours fill their slots, a bad one keeps its own', () => {
    for (const p of Object.values(voicePalettes)) {
      expect(p.dark).toHaveLength(7);
      expect(p.light).toHaveLength(7);
    }
    const c = lobeColors('ocean', 'dark', ['#ff0000', XSS, 'rgb(0, 0, 255)']);
    expect(c[0]).toBe('rgb(255, 0, 0)');
    expect(c[1]).toBe(voicePalettes.ocean.dark[1]);
    expect(c[2]).toBe('rgb(0, 0, 255)');
    expect(voiceLobes).toHaveLength(7);
    expect(LOBE_SPAN).toBe(252);
  });

  it('colour parsing: hex and rgb only', () => {
    expect(parseRgb('#abc')).toEqual([170, 187, 204]);
    expect(parseRgb('#A0B0C0')).toEqual([160, 176, 192]);
    expect(parseRgb('rgba(1, 2, 3, 0.5)')).toEqual([1, 2, 3]);
    expect(parseRgb('rgb(300, 2, 3)')).toEqual([255, 2, 3]);
    expect(parseRgb('red')).toBeNull();
    expect(parseRgb(XSS)).toBeNull();
    expect(parseRgb(42)).toBeNull();
    expect(toRgb('#000')).toBe('rgb(0, 0, 0)');
    expect(toTriple('#fff')).toBe('255, 255, 255');
    expect(toTriple('url(x)')).toBeNull();
  });

  it('the stylesheet: the three layers, the band, the halved soft layers; the dither keeps only the stroke', () => {
    const r = resolveVoiceGlow({}, env);
    expect(r.css).toContain('.vg[data-on]::after');
    expect(r.css).toContain('.vg[data-on]::before');
    expect(r.css).toContain('[data-bloom]');
    expect(r.css).toContain('[data-band]');
    expect(r.css).toContain('url(#vg-distort)');
    expect(r.css).toContain('--vb-z: 0.5');
    const d = resolveVoiceGlow({ look: 'dither' }, env);
    expect(d.config.distortion).toBe(0);
    expect(d.css).toContain('[data-pixel]');
    expect(d.css).toContain('content: none !important');
    expect(d.css).not.toContain('url(#vg-distort)');
    const noWarp = generateVoiceGlowCss({ ...baseCss(), distortion: false });
    expect(noWarp).not.toContain('[data-warp="inner"]');
  });
});

function baseCss() {
  return {
    borderRadius: 16,
    borderWidth: 1,
    strokeOpacity: 1,
    innerOpacity: 1,
    bloomOpacity: 1,
    innerShadow: 'rgba(255, 255, 255, 0.1)',
    colors: voicePalettes.colorful.dark,
    mono: false,
    brightness: 1,
    saturation: 1,
    theme: 'dark' as const,
  };
}

describe('resolveVoiceGlow', () => {
  it('fields win over the preset; scale multiplies the px geometry', () => {
    const r = resolveVoiceGlow({ reach: 2, bend: 30, scale: 2 }, env);
    expect(r.config.reach).toBe(2);
    expect(r.config.bend).toBe(60);
    expect(r.config.flow).toBe(96);
    expect(r.config.bandWidth).toBeCloseTo(4.3, 9);
  });

  it('clamps every number and ignores what is not one', () => {
    const r = resolveVoiceGlow(
      {
        threshold: 5,
        idle: -1,
        bandSkew: 3,
        bandTail: 9,
        distortion: 2,
        coreLight: 9,
        pixelMagnet: 7,
        strength: 4,
        sensitivity: Number.NaN,
        reach: Number.POSITIVE_INFINITY,
        hueDuration: 0,
        scale: 0,
        bend: 'tall' as unknown as number,
      },
      env,
    );
    expect(r.config.threshold).toBe(0.95);
    expect(r.config.idle).toBe(0);
    expect(r.config.bandSkew).toBe(0.9);
    expect(r.config.bandTail).toBe(1.5);
    expect(r.config.distortion).toBe(1);
    expect(r.config.coreLight).toBe(3);
    expect(r.config.pixelMagnet).toBe(1);
    expect(r.strength).toBe(1);
    expect(r.config.sensitivity).toBe(3.1);
    expect(r.config.reach).toBe(1.2);
    expect(r.config.hueDuration).toBe(0.5);
    expect(r.config.scale).toBe(0.05);
    expect(r.config.bend).toBeCloseTo(60 * 0.05, 9);
  });

  it('types, looks and palettes: unknown values fall back', () => {
    expect(voiceGlowType('PILL')).toBe('pill');
    expect(voiceGlowType('phone')).toBe('default');
    expect(voiceGlowPalette(' Ocean ')).toBe('ocean');
    expect(voiceGlowPalette('constructor')).toBe('colorful');
    expect(resolveVoiceGlow({ look: 'mosaic' as 'glow' }, env).look).toBe('glow');
    expect(resolveVoiceGlow({ colorVariant: 'gold' }, env).palette).toBe('gold');
  });

  it('mono holds the hue still; the light theme picks the light set and band colours', () => {
    expect(resolveVoiceGlow({ palette: 'mono' }, env).config.staticColors).toBe(true);
    const light = resolveVoiceGlow({}, { ...env, dark: false });
    expect(light.theme).toBe('light');
    expect(light.config.bandColors.core).toBe('197, 139, 255');
    expect(light.config.hueRange).toBe(40);
    expect(light.strength).toBe(0.8);
  });

  it('host strings never reach the stylesheet unparsed', () => {
    const r = resolveVoiceGlow(
      { colors: [XSS, '"};body{display:none}'], bandColors: { core: XSS, above: 'expression(alert(1))' } },
      env,
    );
    expect(r.css).not.toContain('<img');
    expect(r.css).not.toContain('display:none');
    expect(r.config.bandColors.core).toBe('255, 255, 255');
    expect(r.config.bandColors.above).toBe('255, 70, 80');
  });

  it('the WebKit gate and reduced motion pass through', () => {
    expect(resolveVoiceGlow({}, { ...env, webkitLarge: true }).config.distortion).toBe(0);
    expect(resolveVoiceGlow({}, { ...env, reduced: true }).config.reducedMotion).toBe(true);
    expect(resolveVoiceGlow({ borderRadius: 30 }, { ...env, detectedRadius: 8 }).radius).toBe(30);
    expect(resolveVoiceGlow({}, { ...env, detectedRadius: 8 }).radius).toBe(8);
    expect(resolveVoiceGlow({}, env).radius).toBe(16);
  });
});

describe('env', () => {
  it('motion: reduce and full pin it, anything else follows the system', () => {
    expect(motionOf('REDUCE')).toBe('reduce');
    expect(motionOf('full')).toBe('full');
    expect(motionOf('fast')).toBe('system');
    clock.reduce = true;
    expect(motionReduced('system')).toBe(true);
    expect(motionReduced('full')).toBe(false);
    clock.reduce = false;
    expect(motionReduced('system')).toBe(false);
    expect(motionReduced('reduce')).toBe(true);
  });

  it('colours and the theme: the attribute, then an ancestor, then the text colour, then the OS', () => {
    expect(colorChannels('#ffffff')).toEqual([255, 255, 255]);
    expect(colorChannels('rgb(10 20 30)')).toEqual([10, 20, 30]);
    expect(colorChannels('oklch(0.5 0 0)')).toBeNull();
    expect(isLightColor('rgb(240, 240, 240)')).toBe(true);
    expect(isLightColor('#111')).toBe(false);
    const wrap = document.createElement('div');
    wrap.setAttribute('data-theme', 'light');
    const el = document.createElement('div');
    wrap.append(el);
    document.body.append(wrap);
    expect(hostIsDark(el)).toBe(false);
    el.setAttribute('theme', 'dark');
    expect(hostIsDark(el)).toBe(true);
    wrap.setAttribute('data-theme', 'dark');
    el.removeAttribute('theme');
    expect(hostIsDark(el)).toBe(true);
    wrap.remove();
  });
});

// ── The element ────────────────────────────────────────────────────────────────────────────────────────────────

describe('<ui-voice-glow>', () => {
  it('renders the frame around a slot with the glow layers, decorative, and a live region', () => {
    const el = mount();
    const f = frame(el);
    expect(f.getAttribute('part')).toBe('frame');
    expect(f.querySelector('slot')).not.toBeNull();
    expect(f.querySelector('[data-bloom]')).not.toBeNull();
    expect(f.querySelector('canvas[data-band]')!.getAttribute('aria-hidden')).toBe('true');
    expect(f.querySelector('filter#vg-distort')).not.toBeNull();
    expect(f.querySelectorAll('[data-warp]')).toHaveLength(2);
    expect(f.dataset.type).toBe('default');
    expect(f.dataset.look).toBe('glow');
    expect(status(el).getAttribute('aria-live')).toBe('polite');
    expect(status(el).textContent).toBe('');
    expect(f.hasAttribute('data-on')).toBe(false);
    expect(el.running).toBe(false);
    expect(sheet(el)).toContain('.vg[data-on]::after');
  });

  it('the dither draws on canvases instead of the soft layers; the light theme adds the epicentre', () => {
    const el = mount({ look: 'dither' });
    expect(frame(el).querySelector('canvas[data-pixel]')).not.toBeNull();
    expect(frame(el).querySelector('canvas[data-pixel-glow]')).not.toBeNull();
    expect(frame(el).querySelector('[data-bloom]')).toBeNull();
    expect(frame(el).querySelector('filter')).toBeNull();
    const light = mount({ theme: 'light' });
    expect(frame(light).querySelector('[data-core]')).not.toBeNull();
    expect(light.resolved?.theme).toBe('light');
  });

  it('listening fades it in with frames, says so, and fades it out — then the loop stops', () => {
    const el = mount({ listening: '' });
    const seen: string[] = [];
    el.addEventListener('ui-voice-activate', () => seen.push('on'));
    el.addEventListener('ui-voice-deactivate', () => seen.push('off'));
    expect(frame(el).hasAttribute('data-on')).toBe(true);
    expect(status(el).textContent).toBe('Listening');
    expect(el.running).toBe(true);
    for (let i = 0; i < 60; i++) clock.step(17);
    expect(seen).toEqual(['on']);
    expect(Number(frame(el).style.getPropertyValue('--vb-opacity'))).toBe(1);
    el.listening = false;
    el.renderNow();
    expect(status(el).textContent).toBe('');
    clock.settle();
    expect(seen).toEqual(['on', 'off']);
    expect(frame(el).hasAttribute('data-on')).toBe(false);
    expect(el.running).toBe(false);
    expect(clock.frames.size).toBe(0);
  });

  it('the level property drives the glow without a re-render; a getter is read every frame', () => {
    const el = mount({ listening: '' });
    const before = el.shadowRoot!.querySelector('.vg');
    let reads = 0;
    el.level = () => {
      reads++;
      return 0.9;
    };
    for (let i = 0; i < 40; i++) clock.step(17);
    expect(reads).toBeGreaterThan(10);
    expect(el.shadowRoot!.querySelector('.vg')).toBe(before);
    expect(el.shownLevel).toBeGreaterThan(0.5);
    expect(Number(frame(el).style.getPropertyValue('--vb-h'))).toBeGreaterThan(1);
    el.level = 0;
    for (let i = 0; i < 200; i++) clock.step(17);
    expect(el.shownLevel).toBeLessThan(0.05);
  });

  it('the level attribute works too, and data.onLevel hears every frame', () => {
    const levels: number[] = [];
    const el = mount({ listening: '', level: '0.8' }, { onLevel: (l) => levels.push(l) });
    for (let i = 0; i < 30; i++) clock.step(17);
    expect(levels.length).toBeGreaterThan(10);
    expect(levels[levels.length - 1]).toBeGreaterThan(levels[0]);
    expect(el.level).toBe(0.8);
  });

  it('a throwing onLevel or level getter never stops the glow', () => {
    const el = mount(
      { listening: '' },
      {
        level: () => {
          throw new Error('x');
        },
        onLevel: () => {
          throw new Error('y');
        },
      },
    );
    expect(() => {
      for (let i = 0; i < 5; i++) clock.step(17);
    }).not.toThrow();
    expect(el.running).toBe(true);
  });

  it('paused holds the frame: once painted, no more frames until something changes', () => {
    const el = mount({ listening: '' });
    for (let i = 0; i < 60; i++) clock.step(17);
    el.paused = true;
    el.renderNow();
    clock.settle(50);
    expect(el.running).toBe(false);
    el.paused = false;
    el.renderNow();
    expect(el.running).toBe(true);
  });

  it('off screen and in a hidden tab: no frames; back on screen they resume', () => {
    const el = mount({ listening: '' });
    const io = FakeIO.all.find((o) => o.targets.includes(el))!;
    io.fire(false);
    expect(el.running).toBe(false);
    io.fire(true);
    expect(el.running).toBe(true);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(el.running).toBe(false);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(el.running).toBe(true);
  });

  it('reduced motion (system or motion="reduce") holds the hue and the flow; motion="full" overrides the system', () => {
    clock.reduce = true;
    const el = mount({ listening: '', level: '0.8' });
    for (let i = 0; i < 40; i++) clock.step(17);
    expect(el.resolved?.config.reducedMotion).toBe(true);
    expect(frame(el).style.getPropertyValue('--vb-hue')).toBe('0.00deg');
    expect(Math.abs(Number.parseFloat(frame(el).style.getPropertyValue('--vb-x1')))).toBeCloseTo(36 * 0.85, 1);
    const full = mount({ listening: '', motion: 'full', level: '0.8' });
    expect(full.resolved?.config.reducedMotion).toBe(false);
    clock.reduce = false;
    const pinned = mount({ motion: 'reduce' });
    expect(pinned.resolved?.config.reducedMotion).toBe(true);
  });

  it('lang="ko" and a label: the live region says them, as text', () => {
    const ko = mount({ listening: '', lang: 'ko' });
    expect(status(ko).textContent).toBe('듣는 중');
    const own = mount({ listening: '' }, { label: XSS });
    expect(status(own).textContent).toBe(XSS);
    expect(own.shadowRoot!.querySelector('img')).toBeNull();
  });

  it('a stream without Web Audio falls back to the level, and never throws', () => {
    const s = fakeStream();
    const el = mount({ listening: '' });
    el.stream = s;
    el.level = 0.6;
    expect(() => {
      for (let i = 0; i < 20; i++) clock.step(17);
    }).not.toThrow();
    expect(frame(el).hasAttribute('data-listening')).toBe(true);
    expect(el.shownLevel).toBeGreaterThan(0);
  });

  it('a stream is analysed while listening; disconnect closes the analyser and context, not the tracks', () => {
    stubAudio();
    const s = fakeStream();
    const el = mount({ listening: '' }, { stream: s });
    expect(FakeAudioContext.all).toHaveLength(1);
    const ctx = FakeAudioContext.all[0];
    ctx.analysers[0].sample = 0.2;
    for (let i = 0; i < 30; i++) clock.step(17);
    expect(el.shownLevel).toBeGreaterThan(0.3);
    expect(audioHolds()).toBe(1);
    el.remove();
    expect(ctx.closed).toBe(1);
    expect(audioHolds()).toBe(0);
    expect(s.tracks[0].stopped).toBe(0);
    expect(el.running).toBe(false);
    expect(clock.frames.size).toBe(0);
  });

  it('listening off releases the analyser at once (it exists only while listening); a new stream swaps the lease', () => {
    stubAudio();
    const a = fakeStream();
    const b = fakeStream();
    const el = mount({ listening: '' });
    el.stream = a;
    el.renderNow();
    expect(audioHolds()).toBe(1);
    el.stream = b;
    expect(audioHolds()).toBe(1);
    expect(FakeAudioContext.all[0].closed).toBe(1);
    el.listening = false;
    el.renderNow();
    // released before the fade-out ends: nothing is analysed while the glow is not listening
    expect(audioHolds()).toBe(0);
    expect(el.running).toBe(true);
    clock.settle();
    expect(audioHolds()).toBe(0);
    // listening again opens a new one
    el.listening = true;
    el.renderNow();
    expect(audioHolds()).toBe(1);
    el.remove();
    expect(audioHolds()).toBe(0);
    expect(a.tracks[0].stopped + b.tracks[0].stopped).toBe(0);
  });

  it('a stream set while not listening opens nothing until listening starts', () => {
    stubAudio();
    const el = mount({}, { stream: fakeStream() });
    expect(audioHolds()).toBe(0);
    expect(FakeAudioContext.all).toHaveLength(0);
    el.listening = true;
    el.renderNow();
    expect(audioHolds()).toBe(1);
  });

  it('a frame that throws is logged once and the loop goes on', () => {
    const { ctx } = stubCanvas();
    ctx.setTransform = () => {
      throw new Error('canvas gone');
    };
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const el = mount({ listening: '', level: '0.7' });
    Object.defineProperty(frame(el), 'clientWidth', { value: 360, configurable: true });
    Object.defineProperty(frame(el), 'clientHeight', { value: 110, configurable: true });
    for (let i = 0; i < 20; i++) clock.step(17);
    expect(el.running).toBe(true);
    expect(clock.frames.size).toBe(1);
    expect(err).toHaveBeenCalledTimes(1);
    // the fade still completes and the loop still ends when listening does
    el.listening = false;
    el.renderNow();
    clock.settle();
    expect(el.running).toBe(false);
  });

  it('draws the band on its canvas where a 2D context exists', () => {
    const { calls } = stubCanvas();
    const el = mount({ listening: '', level: '0.7' });
    Object.defineProperty(frame(el), 'clientWidth', { value: 360, configurable: true });
    Object.defineProperty(frame(el), 'clientHeight', { value: 110, configurable: true });
    for (let i = 0; i < 30; i++) clock.step(17);
    expect(calls.filter((c) => c === 'stroke').length).toBeGreaterThan(10);
    expect(frame(el).style.getPropertyValue('--vb-clip-below')).toContain('polygon(');
  });

  it('the dither paints pixels where a 2D context exists', () => {
    const { calls } = stubCanvas();
    const el = mount({ listening: '', look: 'dither', level: '0.9' });
    Object.defineProperty(frame(el), 'clientWidth', { value: 360, configurable: true });
    Object.defineProperty(frame(el), 'clientHeight', { value: 110, configurable: true });
    for (let i = 0; i < 30; i++) clock.step(17);
    expect(calls.filter((c) => c === 'fill').length).toBeGreaterThan(0);
  });

  it('the first slotted element’s radius is picked up', async () => {
    const el = mount();
    await Promise.resolve();
    el.renderNow();
    expect(el.resolved?.radius).toBe(20);
    expect(sheet(el)).toContain('border-radius: 20px');
  });

  it('data.listening and data.paused reflect to the attributes', () => {
    const el = mount({}, { listening: true, paused: true });
    expect(el.hasAttribute('listening')).toBe(true);
    expect(el.hasAttribute('paused')).toBe(true);
  });

  it('disconnect stops the loop and the observers', () => {
    const el = mount({ listening: '' });
    const io = FakeIO.all.find((o) => o.targets.includes(el))!;
    el.remove();
    expect(io.disconnected).toBe(true);
    expect(el.running).toBe(false);
    expect(clock.cancelled.length).toBeGreaterThan(0);
  });
});

describe('docs', () => {
  it('an Effects entry with a reference, props, a11y and at least three demos that build offline', () => {
    expect(doc.group).toBe('Effects');
    expect(doc.tag).toBe('ui-voice-glow');
    expect(doc.reference.url).toBe('https://libraries.dev/voice');
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const d of doc.demos) {
      const node = d.create();
      expect(node).toBeInstanceOf(HTMLElement);
      document.body.append(node);
      expect(node.querySelector('ui-voice-glow') ?? (node.localName === 'ui-voice-glow' ? node : null)).not.toBeNull();
      node.remove();
    }
  });
});
