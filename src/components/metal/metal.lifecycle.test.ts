/**
 * The WebGL path, against a fake WebGL2 context (happy-dom has none): the element ↔ engine wiring, the shared loop's
 * lifecycle (it stops itself when nothing needs a frame, the context is released on disconnect and after a long
 * idle), per-preset frames, a lost context, reflections, the cursor light and the bend.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cursorLightRunning } from './engine/cursor/light';
import { reflectionTargetCount } from './engine/reflection/paint';
import { INSTANCES, resetMetalFxSupport, SHARED } from './engine/renderer/core';
import { sharedLoopRunning } from './engine/renderer/loop';
import type { MetalData, UiMetal } from './metal';
import './metal';
import { IDLE_RELEASE_MS } from './engine/perfConfig';

// ── Fakes ─────────────────────────────────────────────────────────────────────────────────────────────────────────

let frames: Map<number, FrameRequestCallback>;
let frameId = 0;
let clock = 0;
let reduce = false;
let dark = false;
let compileOk = true;
let media: Map<string, Set<() => void>>;
const calls = { drawArrays: 0, loseContext: 0, readPixels: 0, uploads: 0 };

function listeners(q: string): Set<() => void> {
  let s = media.get(q);
  if (!s) {
    s = new Set();
    media.set(q, s);
  }
  return s;
}

/** A WebGL2 context that answers every call: constants are numbers, objects are `{}`. */
function fakeGl(): WebGL2RenderingContext {
  const fixed: Record<string, unknown> = {
    getShaderParameter: () => compileOk,
    getProgramParameter: () => true,
    getAttribLocation: () => 0,
    getUniformLocation: () => ({}),
    createShader: () => ({}),
    createProgram: () => ({}),
    createBuffer: () => ({}),
    createTexture: () => ({}),
    getShaderInfoLog: () => 'fake',
    getProgramInfoLog: () => 'fake',
    drawArrays: () => {
      calls.drawArrays++;
    },
    readPixels: () => {
      calls.readPixels++;
    },
    uniform4fv: () => {
      calls.uploads++;
    },
    getExtension: (name: string) =>
      name === 'WEBGL_lose_context'
        ? {
            loseContext: () => {
              calls.loseContext++;
            },
          }
        : null,
  };
  let n = 0;
  const consts = new Map<string, number>();
  return new Proxy({} as WebGL2RenderingContext, {
    get(_t, k: string) {
      if (k in fixed) return fixed[k];
      if (/^[A-Z_0-9]+$/.test(k)) {
        if (!consts.has(k)) consts.set(k, ++n);
        return consts.get(k);
      }
      return () => undefined;
    },
  });
}

/** A 2D context that accepts every call; image data is sized from the arguments. */
function fake2d(): CanvasRenderingContext2D {
  const store: Record<string, unknown> = {};
  const image = (w: number, h: number) => ({
    width: w,
    height: h,
    data: new Uint8ClampedArray(Math.max(1, w * h) * 4),
  });
  const fixed: Record<string, unknown> = {
    getImageData: (_x: number, _y: number, w: number, h: number) => image(w, h),
    createImageData: (w: number, h: number) => image(w, h),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: () => ({ width: 10, fontBoundingBoxAscent: 10, fontBoundingBoxDescent: 3 }),
  };
  return new Proxy({} as CanvasRenderingContext2D, {
    get(_t, k: string) {
      if (k in fixed) return fixed[k];
      if (k in store) return store[k];
      return () => undefined;
    },
    set(_t, k: string, v) {
      store[k] = v;
      return true;
    },
  });
}

class FakeOffscreen {
  static all: FakeOffscreen[] = [];
  listeners: Record<string, Array<(e: Event) => void>> = {};
  constructor(
    public width: number,
    public height: number,
  ) {
    FakeOffscreen.all.push(this);
  }
  getContext(type: string) {
    return type === 'webgl2' ? fakeGl() : null;
  }
  addEventListener(type: string, fn: (e: Event) => void) {
    this.listeners[type] ??= [];
    this.listeners[type].push(fn);
  }
  transferToImageBitmap() {
    return { width: this.width, height: this.height, close() {} };
  }
  fire(type: string) {
    for (const fn of this.listeners[type] ?? []) fn(new Event(type, { cancelable: true }));
  }
}

class FakePath2D {
  moveTo() {}
  lineTo() {}
  closePath() {}
  rect() {}
  addPath() {}
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

class FakeRO {
  observe() {}
  unobserve() {}
  disconnect() {}
}

/** Run the queued animation frames `n` times, 100ms apart (every run draws a shader frame). */
function step(n = 1): void {
  for (let i = 0; i < n; i++) {
    clock += 100;
    const due = Array.from(frames.entries());
    frames.clear();
    for (const [, cb] of due) cb(clock);
  }
}

beforeEach(() => {
  document.body.innerHTML = '';
  frames = new Map();
  frameId = 0;
  clock = 1000;
  reduce = false;
  dark = false;
  compileOk = true;
  media = new Map();
  calls.drawArrays = 0;
  calls.loseContext = 0;
  calls.readPixels = 0;
  calls.uploads = 0;
  FakeOffscreen.all = [];
  FakeIO.all = [];
  resetMetalFxSupport();
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
      if (query.includes('pointer: fine') || query.includes('hover: hover')) return true;
      return false;
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => listeners(query).add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners(query).delete(fn),
  }));
  vi.stubGlobal('OffscreenCanvas', FakeOffscreen);
  vi.stubGlobal('Path2D', FakePath2D);
  vi.stubGlobal('IntersectionObserver', FakeIO);
  vi.stubGlobal('ResizeObserver', FakeRO);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
    type: string,
  ) {
    return (type === 'webgl2' ? fakeGl() : fake2d()) as never;
  } as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: 40,
    bottom: 40,
    width: 40,
    height: 40,
    x: 0,
    y: 0,
    toJSON() {},
  } as DOMRect);
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function mount(data: MetalData = {}, attrs: Record<string, string> = {}): Promise<UiMetal> {
  const el = document.createElement('ui-metal');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  el.innerHTML = '<button aria-label="Send">↑</button>';
  document.body.append(el);
  await Promise.resolve();
  el.renderNow();
  return el;
}

const root = (el: UiMetal) => el.shadowRoot!.querySelector<HTMLElement>('.ui-root')!;

describe('<ui-metal> with WebGL2 (a fake context)', () => {
  it('draws: one context, a frame, the metal fades in, the child is normalised', async () => {
    const el = await mount();
    expect(el.rendering).toBe('webgl');
    expect(FakeOffscreen.all).toHaveLength(1);
    expect(sharedLoopRunning()).toBe(true);
    step(2);
    expect(calls.drawArrays).toBeGreaterThan(0);
    expect(calls.readPixels).toBeGreaterThan(0);
    expect(root(el).hasAttribute('data-ready')).toBe(true);
    expect(root(el).dataset.normalize).toBe('true');
    expect(root(el).hasAttribute('data-fallback')).toBe(false);
  });

  it('shares one context between elements and draws one frame per preset in use', async () => {
    await mount();
    await mount({ preset: 'gold' });
    await mount({ preset: 'gold' });
    expect(FakeOffscreen.all).toHaveLength(1);
    expect(INSTANCES.size).toBe(3);
    step(1);
    const before = calls.drawArrays;
    step(1);
    expect(calls.drawArrays - before).toBe(2);
    expect(Array.from(SHARED!.frames.keys()).sort()).toEqual(['chromatic/light', 'gold/light']);
  });

  it('stops its loop off screen and releases the context after a long idle; comes back on screen', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const el = await mount();
    // The support probe's throwaway context was released too.
    const probed = calls.loseContext;
    step(1);
    FakeIO.all[0].fire(false);
    step(1);
    expect(frames.size).toBe(0);
    expect(sharedLoopRunning()).toBe(false);
    vi.advanceTimersByTime(IDLE_RELEASE_MS);
    expect(SHARED).toBeNull();
    expect(calls.loseContext).toBe(probed + 1);
    expect(el.rendering).toBe('webgl');
    FakeIO.all[0].fire(true);
    expect(FakeOffscreen.all).toHaveLength(2);
    expect(sharedLoopRunning()).toBe(true);
  });

  it('paints one frame when paused, then idles; play() moves it again', async () => {
    const el = await mount({}, { paused: '' });
    step(1);
    expect(root(el).hasAttribute('data-ready')).toBe(true);
    step(1);
    expect(frames.size).toBe(0);
    el.play();
    el.renderNow();
    expect(sharedLoopRunning()).toBe(true);
  });

  it('is a still frame under reduced motion', async () => {
    reduce = true;
    const el = await mount();
    expect(el.paused).toBe(true);
    step(2);
    expect(frames.size).toBe(0);
  });

  it('releases everything on disconnect: loop, context, observers', async () => {
    const el = await mount();
    const probed = calls.loseContext;
    step(1);
    el.remove();
    expect(INSTANCES.size).toBe(0);
    expect(SHARED).toBeNull();
    expect(calls.loseContext).toBe(probed + 1);
    expect(frames.size).toBe(0);
    expect(FakeIO.all[0].disconnected).toBe(true);
  });

  it('falls back to the CSS ring on a lost context and comes back on restore', async () => {
    const el = await mount();
    step(1);
    FakeOffscreen.all[0].fire('webglcontextlost');
    await Promise.resolve();
    el.renderNow();
    expect(el.rendering).toBe('fallback');
    expect(root(el).hasAttribute('data-fallback')).toBe(true);
    step(1);
    expect(frames.size).toBe(0);
    FakeOffscreen.all[0].fire('webglcontextrestored');
    await Promise.resolve();
    el.renderNow();
    expect(el.rendering).toBe('webgl');
    expect(sharedLoopRunning()).toBe(true);
  });

  it('never throws when the shader does not compile: the CSS fallback', async () => {
    compileOk = false;
    const el = await mount();
    expect(el.rendering).toBe('fallback');
    expect(root(el).hasAttribute('data-fallback')).toBe(true);
  });

  it('puts a reflection into a neighbour in the dark theme only, and takes it back out', async () => {
    const chip = document.createElement('div');
    chip.textContent = 'Auto';
    document.body.append(chip);
    const el = await mount({ theme: 'dark', reflectionTargets: [chip] });
    const wrap = chip.querySelector<HTMLElement>('[data-metal-fx-reflection]');
    expect(wrap).not.toBeNull();
    expect(wrap!.getAttribute('aria-hidden')).toBe('true');
    expect(wrap!.style.pointerEvents).toBe('none');
    expect(chip.hasAttribute('data-metal-fx-reflect-host')).toBe(true);
    expect(reflectionTargetCount()).toBe(1);
    el.data = { theme: 'light', reflectionTargets: [chip] };
    el.renderNow();
    expect(chip.querySelector('[data-metal-fx-reflection]')).toBeNull();
    expect(chip.hasAttribute('data-metal-fx-reflect-host')).toBe(false);
    el.data = { theme: 'dark', reflectionTargets: [{ el: chip, glyphs: true, strength: 5 }] };
    el.renderNow();
    expect(chip.hasAttribute('data-metal-fx-text')).toBe(true);
    el.remove();
    expect(reflectionTargetCount()).toBe(0);
    expect(chip.hasAttribute('data-metal-fx-text')).toBe(false);
    expect(chip.querySelector('[data-metal-fx-reflection]')).toBeNull();
  });

  it('resolves `reflect` ids in its own tree', async () => {
    const chip = document.createElement('div');
    chip.id = 'model-chip';
    document.body.append(chip);
    await mount({}, { theme: 'dark', reflect: 'model-chip missing' });
    expect(chip.querySelector('[data-metal-fx-reflection]')).not.toBeNull();
  });

  it('lights the pointer only while it is over the element, and stops once it rests', async () => {
    const el = await mount();
    step(1);
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 20, clientY: 1, bubbles: true }));
    expect(cursorLightRunning()).toBe(false);
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 20, clientY: 1, pointerType: 'mouse', bubbles: true }));
    expect(cursorLightRunning()).toBe(true);
    step(40);
    expect(cursorLightRunning()).toBe(false);
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 22, clientY: 2, pointerType: 'mouse', bubbles: true }));
    expect(cursorLightRunning()).toBe(true);
    el.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false }));
    step(40);
    expect(cursorLightRunning()).toBe(false);
  });

  it('has no pointer light with cursor-light="false" or reduced motion', async () => {
    const el = await mount({}, { 'cursor-light': 'false' });
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 20, clientY: 1, pointerType: 'mouse', bubbles: true }));
    expect(cursorLightRunning()).toBe(false);
    el.remove();
    reduce = true;
    const still = await mount();
    still.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 20, clientY: 1, pointerType: 'mouse', bubbles: true }),
    );
    expect(cursorLightRunning()).toBe(false);
  });

  it('bends under the pointer and settles back', async () => {
    const el = await mount({ variant: 'circle', bend: true, cursorLight: false });
    step(1);
    const before = frames.size;
    el.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 38, clientY: 20, pointerType: 'mouse', bubbles: true }),
    );
    expect(frames.size).toBeGreaterThan(before);
    step(3);
    expect(root(el).hasAttribute('data-mfx-bend')).toBe(true);
    el.dispatchEvent(new PointerEvent('pointerleave'));
    // The shared loop keeps running for the flow; the bend's own loop stops once the spring has settled.
    step(200);
    expect(root(el).hasAttribute('data-mfx-bend')).toBe(false);
  });
});
