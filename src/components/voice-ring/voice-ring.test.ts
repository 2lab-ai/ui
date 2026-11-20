import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audioHolds } from '../voice-glow/engine/audio';
import {
  type Clock,
  FakeAudioContext,
  FakeIO,
  fakeStream,
  stubAudio,
  stubCanvas,
  stubFrames,
  XSS,
} from '../voice-glow/fixtures';
import { doc } from './docs';
import { bendFrame, bendReach } from './engine/bend';
import { adjustAccent, COLOR_STEPS, colorRamp } from './engine/colors';
import { clamp01, fibDir, finalizeFrame, hashD, radiusScale, skinField, smoothstep, vnoise3 } from './engine/core';
import { ACCENT_COLORS, EMOTION_COLORS, GlowFollower } from './engine/emotion';
import { EdgeBounce, LEAN_DEFAULTS, leanFrame, leanReach } from './engine/lean';
import { PRESETS, resolvePreset } from './engine/presets';
import { EdgeLens } from './engine/refract';
import { TYPE_FRAMES, VOICE_ORB_TYPES } from './engine/registry';
import { SILENCE, type VoiceInput } from './engine/types';
import { SPECTRUM_N, VoiceFollower } from './engine/voice';
import {
  readDirection,
  resolveVoiceRing,
  type UiVoiceRing,
  type VoiceRingData,
  voiceRingState,
  voiceRingType,
} from './voice-ring';

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

function mount(attrs: Record<string, string> = {}, data?: VoiceRingData): UiVoiceRing {
  const el = document.createElement('ui-voice-ring');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (data) el.data = data;
  document.body.append(el);
  el.renderNow();
  return el;
}
const box = (el: UiVoiceRing) => el.shadowRoot!.querySelector<HTMLElement>('.vr')!;
const canvas = (el: UiVoiceRing) => el.shadowRoot!.querySelector('canvas')!;
const said = (el: UiVoiceRing) => el.shadowRoot!.querySelector('.sr-only')!.textContent;

function voice(over: Partial<VoiceInput> = {}): VoiceInput {
  return { ...SILENCE, spectrum: new Float32Array(SPECTRUM_N), ...over };
}

// ── Engine ─────────────────────────────────────────────────────────────────────────────────────────────────────

describe('engine: geometry', () => {
  it('core helpers', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 9);
    expect(hashD(1, 2)).toBeGreaterThanOrEqual(0);
    expect(hashD(1, 2)).toBeLessThan(1);
    expect(hashD(1, 2)).toBe(hashD(1, 2));
    const n = vnoise3(0.3, 1.7, 2.2);
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThanOrEqual(1);
    const [x, y, z] = fibDir(3, 10);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 9);
    expect(radiusScale(200)).toBe(1);
    expect(radiusScale(100)).toBeLessThan(1);
  });

  it('the skin field averages to nothing over the sphere: it reshapes, never resizes', () => {
    const field = skinField(0.2, 0.08, 1.3, 1.75);
    let sum = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const [x, y, z] = fibDir(i, n);
      sum += field(x, y, z);
    }
    expect(Math.abs(sum / n)).toBeLessThan(0.003);
  });

  it('finalizeFrame drops invisible dots, floors radii and z-sorts far to near', () => {
    const f = finalizeFrame(
      [
        { x: 0, y: 0, z: 2, r: 0.1, white: 0 },
        { x: 0, y: 0, z: -1, r: 1, white: 0 },
        { x: 0, y: 0, z: 0, r: 1, white: 0, a: 0.01 },
      ],
      [],
      0.3,
    );
    expect(f.dots.map((d) => d.z)).toEqual([-1, 2]);
    expect(f.dots[1].r).toBe(0.3);
  });

  it('every orb type draws a finite frame at silence and in full voice', () => {
    const loud = voice({
      level: 1,
      soft: 1,
      bands: [1, 1, 1],
      softBands: [1, 1, 1],
      spectrum: new Float32Array(SPECTRUM_N).fill(1),
      drive: 3,
      processing: 0.5,
      spin: 1,
    });
    expect(VOICE_ORB_TYPES).toHaveLength(7);
    for (const t of VOICE_ORB_TYPES) {
      const { frame, opts } = resolvePreset(t, 200);
      for (const v of [SILENCE, loud]) {
        const f = frame(200, 1.2, v, opts);
        const xs = [...f.dots.flatMap((d) => [d.x, d.y, d.r]), ...f.strokes.flatMap((s) => s.pts)];
        expect(xs.length).toBeGreaterThan(0);
        expect(xs.every(Number.isFinite)).toBe(true);
      }
    }
    expect(TYPE_FRAMES.aura(200, 0, SILENCE, {}).light).toBeDefined();
    expect(TYPE_FRAMES['aura-mono'](200, 0, SILENCE, {}).tube).toBeDefined();
    expect(TYPE_FRAMES.pixel(200, 0, SILENCE, {}).square).toBe(true);
  });

  it('the aura stays inside its box and swells with the voice', () => {
    const quiet = TYPE_FRAMES.aura(200, 0, SILENCE, { rings: 6, segs: 140 });
    const loud = TYPE_FRAMES.aura(200, 0, voice({ level: 1, soft: 1, softBands: [1, 1, 1], bands: [1, 1, 1] }), {
      rings: 6,
      segs: 140,
    });
    expect(quiet.strokes).toHaveLength(6);
    expect(loud.light!.r).toBeGreaterThan(quiet.light!.r);
    expect(loud.light!.intensity).toBeGreaterThan(quiet.light!.intensity);
    const pts = loud.strokes.flatMap((s) => s.pts);
    expect(Math.min(...pts)).toBeGreaterThan(0);
    expect(Math.max(...pts)).toBeLessThan(200);
  });

  it('presets scale count knobs with size and density', () => {
    const big = resolvePreset('aura', 280);
    const small = resolvePreset('aura', 48);
    expect(small.opts.segs).toBeLessThan(big.opts.segs as number);
    expect(resolvePreset('pixel', 200, 1, 0.5).opts.rMul).toBe(0.5);
    expect(resolvePreset('nope' as 'aura', 200).frame).toBe(TYPE_FRAMES.orbit);
    expect(PRESETS.aura.lean?.move).toBe(0.21);
  });
});

describe('engine: lean and bend', () => {
  const frame = () => TYPE_FRAMES.aura(200, 0, SILENCE, { rings: 2, segs: 48 });
  const meanX = (f: ReturnType<typeof frame>) => {
    const xs = f.strokes.flatMap((s) => s.pts.filter((_, i) => i % 2 === 0));
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  };

  it('leanReach: the room a lean needs, none without a lean', () => {
    expect(leanReach({ move: 0, pull: 0, deform: 0 }, 200)).toBe(0);
    expect(leanReach(LEAN_DEFAULTS, 200)).toBe(Math.ceil(200 * 0.36 * (2 + 0.7 + 0.2)) + 2);
  });

  it('leans toward the pan, and not at all near zero', () => {
    const k = PRESETS.aura.lean as typeof LEAN_DEFAULTS;
    const base = meanX(frame());
    expect(meanX(leanFrame(frame(), 0.001, 200, k))).toBeCloseTo(base, 9);
    expect(meanX(leanFrame(frame(), 1, 200, k))).toBeGreaterThan(base + 5);
    expect(meanX(leanFrame(frame(), -1, 200, k))).toBeLessThan(base - 5);
  });

  it('stops at the bound and presses on it, with a lens', () => {
    const k = { ...LEAN_DEFAULTS, move: 2, lens: 1 };
    const f = leanFrame(frame(), 1, 200, k, [Number.POSITIVE_INFINITY, 10]);
    const maxX = Math.max(...f.strokes.flatMap((s) => s.pts.filter((_, i) => i % 2 === 0)));
    expect(maxX).toBeLessThanOrEqual(210 + 1e-6);
    expect(f.contact?.side).toBe(1);
    expect(f.contact?.press).toBeGreaterThan(0);
    expect(f.contact?.lens).toBeDefined();
  });

  it('EdgeBounce overshoots and settles', () => {
    const b = new EdgeBounce();
    let max = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < 120; i++) max = Math.max(max, b.step(1, 1 / 60));
    expect(max).toBeGreaterThan(0);
    expect(Math.abs(b.step(1, 1 / 60))).toBeLessThan(0.05);
  });

  it('bend draws marks toward the pointer; bendReach is 0 far out, 1 at the rim', () => {
    const f = frame();
    const bent = bendFrame(f, 200, { x: 200, y: 100, amount: 1 });
    expect(meanX(bent)).toBeGreaterThan(meanX(f));
    expect(bent).not.toBe(f);
    expect(bendReach(1000, 50)).toBe(0);
    expect(bendReach(0, 50)).toBe(1);
  });
});

describe('engine: colour and emotion', () => {
  it('the colour ramp runs from the neutral ink into the accent', () => {
    const ramp = colorRamp({ saturation: 1, accent: ACCENT_COLORS.green, angle: 0, neutral: 1, size: 200 });
    expect(ramp.mix).toHaveLength(COLOR_STEPS);
    expect(ramp.mix[0]).toBe(0);
    expect(ramp.mix[COLOR_STEPS - 1]).toBe(1);
    expect(ramp.at(0, 100)).toBe(0);
    expect(ramp.at(200, 100)).toBe(COLOR_STEPS - 1);
    expect(adjustAccent({ r: 255, g: 0, b: 0 })).toEqual([255, 0, 0]);
    expect(adjustAccent({ r: 255, g: 0, b: 0 }, 120)).toEqual([0, 255, 0]);
  });

  it('the glow follower eases in, crossfades and fades out; still jumps', () => {
    const g = new GlowFollower();
    // from nothing the new colour simply appears; the amount eases in
    let s = g.step(0.01, EMOTION_COLORS.positive, 0, 200, false);
    expect(s.amount).toBeGreaterThan(0);
    expect(s.amount).toBeLessThan(0.5);
    expect(s.g).toBe(EMOTION_COLORS.positive.g);
    for (let i = 0; i < 100; i++) s = g.step(0.1, EMOTION_COLORS.negative, 0, 200, false);
    expect(s.r).toBeCloseTo(EMOTION_COLORS.negative.r, 0);
    s = new GlowFollower().step(0.016, EMOTION_COLORS.calm, 0, 200, true);
    expect(s.amount).toBe(1);
    for (let i = 0; i < 200; i++) s = g.step(0.1, null, 0, 200, false);
    expect(s.amount).toBeLessThan(0.01);
  });
});

describe('engine: the follower', () => {
  const cfg = {
    sensitivity: 0.85,
    threshold: 0.04,
    attack: 0.06,
    release: 0.32,
    idle: 0,
    driveGain: 2,
    calm: 0.4,
    rate: 1,
    processing: false,
    direction: 0,
  };

  it('a level rises the envelope and speeds the voice clock', () => {
    const quiet = new VoiceFollower();
    const loud = new VoiceFollower();
    for (let i = 0; i < 60; i++) {
      quiet.readSilence();
      quiet.step(1 / 60, cfg, false);
      loud.readLevel(0.9, 0.85);
      loud.step(1 / 60, cfg, false);
    }
    expect(loud.step(1 / 60, cfg, false).level).toBeGreaterThan(0.5);
    expect(loud.drive).toBeGreaterThan(quiet.drive);
  });

  it('leans only while a voice is heard — unless holdDirection', () => {
    const a = new VoiceFollower();
    const b = new VoiceFollower();
    let pa = 0;
    let pb = 0;
    for (let i = 0; i < 240; i++) {
      a.readSilence();
      b.readSilence();
      pa = a.step(1 / 60, { ...cfg, direction: 1 }, false).pan;
      pb = b.step(1 / 60, { ...cfg, direction: 1, holdDirection: true }, false).pan;
    }
    expect(pa).toBe(0);
    expect(pb).toBeGreaterThan(0.8);
  });

  it('processing eases in, spins, and settles to a whole turn after', () => {
    const f = new VoiceFollower();
    let v = f.step(1 / 60, { ...cfg, processing: true }, false);
    for (let i = 0; i < 240; i++) v = f.step(1 / 60, { ...cfg, processing: true }, false);
    expect(v.processing).toBeGreaterThan(0.9);
    expect(v.spin).toBeGreaterThan(1);
    for (let i = 0; i < 2000; i++) v = f.step(1 / 60, cfg, false);
    const turns = v.spin / (2 * Math.PI);
    expect(Math.abs(turns - Math.round(turns))).toBeLessThan(0.01);
  });

  it('reads an analyser: RMS and the spectrum on an adaptive floor', () => {
    stubAudio();
    const ctx = new FakeAudioContext();
    const a = ctx.createAnalyser();
    a.fftSize = 1024;
    a.sample = 0.1;
    a.bin = 200;
    const f = new VoiceFollower();
    f.readAnalyser(a as unknown as AnalyserNode, 1, 1 / 60);
    const v = f.step(1 / 60, { ...cfg, threshold: 0 }, false);
    expect(v.level).toBeGreaterThan(0);
  });

  it('still holds the clocks', () => {
    const f = new VoiceFollower();
    f.readLevel(1, 1);
    f.step(0.5, cfg, true);
    expect(f.t).toBe(0);
    expect(f.drive).toBe(0);
  });
});

describe('engine: the edge lens', () => {
  it('without WebGL 2 it gives up once, quietly, and holds nothing', () => {
    const lens = new EdgeLens();
    const ctx = {
      getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
      canvas: { width: 200, height: 200 },
    } as unknown as CanvasRenderingContext2D;
    const L = { zone: 50, gap: 4, flare: 0.1, split: 2, blur: 2, cy: 100 };
    expect(lens.draw(ctx, 1, 180, L)).toBe(false);
    expect(lens.unavailable).toBe(true);
    expect(lens.active).toBe(false);
    expect(lens.draw(ctx, 1, 180, L)).toBe(false);
    lens.release();
  });

  it('a held context is released with WEBGL_lose_context', () => {
    const lose = vi.fn();
    const gl = new Proxy(
      {
        getExtension: (n: string) => (n === 'WEBGL_lose_context' ? { loseContext: lose } : null),
        getProgramParameter: () => true,
        isContextLost: () => false,
        createShader: () => ({}),
        createProgram: () => ({}),
        createBuffer: () => ({}),
        createTexture: () => ({}),
        getAttribLocation: () => 0,
        getUniformLocation: () => ({}),
      } as Record<string, unknown>,
      { get: (t, k) => (k in t ? t[k as string] : typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? 1 : () => {}) },
    );
    const real = HTMLCanvasElement.prototype.getContext;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement, kind) {
      if (kind === 'webgl2') return gl as unknown as WebGL2RenderingContext;
      if (kind === '2d') return { clearRect() {}, drawImage() {} } as unknown as CanvasRenderingContext2D;
      return real.call(this, kind as '2d');
    } as HTMLCanvasElement['getContext']);
    const lens = new EdgeLens();
    const ctx = {
      getTransform: () => ({ a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 }),
      canvas: { width: 400, height: 400 },
      save() {},
      restore() {},
      setTransform() {},
      beginPath() {},
      rect() {},
      clip() {},
      drawImage() {},
      globalCompositeOperation: 'source-over',
    } as unknown as CanvasRenderingContext2D;
    expect(lens.draw(ctx, 1, 180, { zone: 50, gap: 4, flare: 0.1, split: 2, blur: 2, cy: 100 })).toBe(true);
    expect(lens.active).toBe(true);
    lens.release();
    expect(lose).toHaveBeenCalledTimes(1);
    expect(lens.active).toBe(false);
  });
});

// ── The element ────────────────────────────────────────────────────────────────────────────────────────────────

describe('resolve', () => {
  it('types, states and their aliases', () => {
    expect(voiceRingType('MONO')).toBe('mono');
    expect(voiceRingType('aura')).toBe('ring');
    expect(voiceRingType('aura-mono')).toBe('mono');
    expect(voiceRingType('swell')).toBe('swell');
    expect(voiceRingType('blob')).toBe('ring');
    expect(voiceRingState('thinking')).toBe('processing');
    expect(voiceRingState('Speaking')).toBe('speaking');
    expect(voiceRingState('loud')).toBe('listening');
  });

  it('defaults from the library, the type’s own lean, and clamping', () => {
    const r = resolveVoiceRing({});
    expect(r.type).toBe('ring');
    expect(r.orbType).toBe('aura');
    expect(r.state).toBe('listening');
    expect(r.size).toBe(160);
    expect(r.sensitivity).toBe(0.85);
    expect(r.lean.move).toBe(0.21);
    expect(r.margin).toBe(32);
    const mono = resolveVoiceRing({ type: 'mono' });
    expect(mono.lean.lens).toBe(0);
    const c = resolveVoiceRing({
      size: 99999,
      threshold: 4,
      saturation: 9,
      directionLens: 9,
      hoverBend: true,
      sensitivity: Number.NaN,
    });
    expect(c.size).toBe(1024);
    expect(c.threshold).toBe(0.95);
    expect(c.colors.saturation).toBe(1);
    expect(c.colors.vivid).toBe(1);
    expect(c.lean.lens).toBe(2);
    expect(c.bend).toBe(0.55);
    expect(c.sensitivity).toBe(0.85);
    expect(resolveVoiceRing({ size: 3 }).size).toBe(16);
    expect(resolveVoiceRing({ attack: undefined, type: 'pixel' }).attack).toBe(0.16);
  });

  it('emotion, accent and colours: known names only, custom colours parsed', () => {
    expect(resolveVoiceRing({ emotion: 'positive' }).emotionTint).toEqual(EMOTION_COLORS.positive);
    expect(resolveVoiceRing({}, { emotion: 'calm' }).emotion).toBe('calm');
    expect(resolveVoiceRing({ emotion: 'angry' as 'calm' }).emotion).toBeNull();
    expect(resolveVoiceRing({ emotion: 'calm', emotionColors: { calm: '#102030' } }).emotionTint).toEqual({
      r: 16,
      g: 32,
      b: 48,
    });
    expect(resolveVoiceRing({ emotion: 'calm', emotionColors: { calm: XSS } }).emotionTint).toEqual(
      EMOTION_COLORS.calm,
    );
    expect(resolveVoiceRing({ accent: 'red' }).colors.accent).toEqual(ACCENT_COLORS.red);
    expect(resolveVoiceRing({ color: XSS }).tint).toBeUndefined();
    expect(resolveVoiceRing({ color: 'rgb(1,2,3)' }).tint).toEqual({ r: 1, g: 2, b: 3 });
  });

  it('readDirection clamps and never throws', () => {
    expect(readDirection(2)).toBe(1);
    expect(readDirection(-0.5)).toBe(-0.5);
    expect(readDirection(() => -3)).toBe(-1);
    expect(readDirection('x')).toBe(0);
    expect(
      readDirection(() => {
        throw new Error('gone');
      }),
    ).toBe(0);
  });
});

describe('<ui-voice-ring>', () => {
  it('renders a canvas sized to the ring and a live region that says the state', () => {
    const el = mount({ size: '120' });
    expect(canvas(el).getAttribute('aria-hidden')).toBe('true');
    expect(box(el).getAttribute('role')).toBe('status');
    expect(box(el).getAttribute('aria-live')).toBe('polite');
    expect(said(el)).toBe('Listening');
    expect(box(el).style.getPropertyValue('--vr-size')).toBe('120px');
    expect(canvas(el).style.width).toBe('120px');
    expect(box(el).dataset.type).toBe('ring');
  });

  it('every state has its word, in English and Korean; a label replaces it, as text', () => {
    const el = mount({ state: 'idle' });
    expect(said(el)).toBe('Waiting');
    el.state = 'thinking';
    el.renderNow();
    expect(said(el)).toBe('Thinking');
    expect(el.getAttribute('state')).toBe('processing');
    el.setAttribute('state', 'speaking');
    el.renderNow();
    expect(said(el)).toBe('Speaking');
    const ko = mount({ lang: 'ko', state: 'processing' });
    expect(said(ko)).toBe('생각하는 중');
    const own = mount({}, { label: XSS });
    expect(said(own)).toBe(XSS);
    expect(own.shadowRoot!.querySelector('img')).toBeNull();
  });

  it('decorative hides it from assistive tech', () => {
    const el = mount({ decorative: '' });
    expect(box(el).getAttribute('aria-hidden')).toBe('true');
    expect(box(el).hasAttribute('role')).toBe(false);
  });

  it('without a 2D context: no loop, no throw (the fallback is nothing drawn)', () => {
    const el = mount({}, { level: 0.5 });
    expect(el.running).toBe(false);
    expect(() => clock.step()).not.toThrow();
  });

  it('draws every frame while running, and the level drives it', () => {
    const { calls } = stubCanvas();
    const levels: number[] = [];
    const el = mount({ size: '160' }, { level: () => 0.8, onLevel: (l) => levels.push(l) });
    expect(el.running).toBe(true);
    for (let i = 0; i < 40; i++) clock.step(17);
    expect(calls.filter((c) => c === 'stroke').length).toBeGreaterThan(40);
    expect(el.shownLevel).toBeGreaterThan(0.4);
    expect(levels.length).toBeGreaterThan(20);
  });

  it('every type paints without throwing', () => {
    stubCanvas();
    for (const t of ['ring', 'mono', 'orbit', 'sash', 'signal', 'swell', 'pixel']) {
      const el = mount({ type: t, emotion: 'positive' }, { level: 0.6 });
      expect(() => {
        for (let i = 0; i < 5; i++) clock.step(17);
      }).not.toThrow();
      el.remove();
    }
  });

  it('paused: one still frame and no loop', () => {
    stubCanvas();
    const el = mount({ paused: '' }, { level: 0.5 });
    expect(el.running).toBe(false);
    expect(clock.frames.size).toBe(0);
    el.paused = false;
    el.renderNow();
    expect(el.running).toBe(true);
  });

  it('reduced motion with nothing to hear: one frame, no loop; with a source, the loop runs on held clocks', () => {
    stubCanvas();
    clock.reduce = true;
    const quiet = mount({ state: 'idle' });
    expect(quiet.running).toBe(false);
    const heard = mount({}, { level: 0.5 });
    expect(heard.running).toBe(true);
    const pinned = mount({ motion: 'reduce' });
    expect(pinned.running).toBe(false);
    clock.reduce = false;
    const full = mount({ motion: 'full', state: 'idle' });
    expect(full.running).toBe(true);
  });

  it('off screen and in a hidden tab: no frames', () => {
    stubCanvas();
    const el = mount({}, { level: 0.5 });
    const io = FakeIO.all.find((o) => o.targets.includes(el))!;
    io.fire(false);
    expect(el.running).toBe(false);
    io.fire(true);
    expect(el.running).toBe(true);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(el.running).toBe(false);
  });

  it('a stream is analysed; disconnect closes the analyser and context, never the tracks', () => {
    stubCanvas();
    stubAudio();
    const s = fakeStream();
    const el = mount({}, { stream: s });
    expect(audioHolds()).toBe(1);
    const ctx = FakeAudioContext.all[0];
    ctx.analysers[0].sample = 0.3;
    for (let i = 0; i < 30; i++) clock.step(17);
    expect(el.shownLevel).toBeGreaterThan(0.3);
    el.remove();
    expect(audioHolds()).toBe(0);
    expect(ctx.closed).toBe(1);
    expect(s.tracks[0].stopped).toBe(0);
    expect(el.running).toBe(false);
  });

  it('idle and processing do not listen, whatever is attached', () => {
    stubCanvas();
    const el = mount({ state: 'idle' }, { level: 1 });
    for (let i = 0; i < 30; i++) clock.step(17);
    expect(el.shownLevel).toBeLessThan(0.2);
  });

  it('a direction widens the canvas for the lean (negative margins keep the layout at size)', () => {
    stubCanvas();
    const el = mount({ size: '100' }, { level: 0.5, direction: 1 });
    const c = canvas(el);
    expect(Number.parseFloat(c.style.width)).toBeGreaterThan(100);
    expect(c.style.marginLeft.startsWith('-')).toBe(true);
    expect(box(el).style.getPropertyValue('--vr-size')).toBe('100px');
  });

  it('a throwing getter or onLevel never stops the ring', () => {
    stubCanvas();
    const el = mount(
      {},
      {
        level: () => {
          throw new Error('meter');
        },
        direction: () => {
          throw new Error('side');
        },
        onLevel: () => {
          throw new Error('host');
        },
      },
    );
    expect(() => {
      for (let i = 0; i < 5; i++) clock.step(17);
    }).not.toThrow();
    expect(el.running).toBe(true);
  });

  it('disconnect stops the loop and the observer', () => {
    stubCanvas();
    const el = mount({}, { level: 0.4 });
    const io = FakeIO.all.find((o) => o.targets.includes(el))!;
    el.remove();
    expect(el.running).toBe(false);
    expect(io.disconnected).toBe(true);
    expect(clock.frames.size).toBe(0);
  });
});

describe('docs', () => {
  it('an Effects entry with a reference and at least three demos that build offline', () => {
    expect(doc.group).toBe('Effects');
    expect(doc.tag).toBe('ui-voice-ring');
    expect(doc.reference.url).toBe('https://libraries.dev/voice-ring');
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const d of doc.demos) {
      const node = d.create();
      document.body.append(node);
      expect(node.querySelector('ui-voice-ring')).not.toBeNull();
      node.remove();
    }
  });
});
