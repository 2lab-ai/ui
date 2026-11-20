/**
 * Test fakes shared by the voice elements' tests (happy-dom has no Web Audio, no 2D canvas and no layout): an
 * AudioContext that records what was made and closed, a MediaStream whose tracks record a stop, a frame clock the
 * test drives, and observers it fires. Not exported from the package.
 */
import { vi } from 'vitest';

export class FakeTrack {
  stopped = 0;
  readonly kind = 'audio';
  stop(): void {
    this.stopped++;
  }
}

/** A MediaStream stand-in: `audio` tracks (0 for a video-only stream). */
export function fakeStream(audio = 1): MediaStream & { tracks: FakeTrack[] } {
  const tracks = Array.from({ length: audio }, () => new FakeTrack());
  return {
    tracks,
    getAudioTracks: () => tracks,
    getTracks: () => tracks,
  } as unknown as MediaStream & { tracks: FakeTrack[] };
}

export class FakeNode {
  connected: unknown[] = [];
  disconnects = 0;
  constructor(readonly context: FakeAudioContext) {}
  connect(to: unknown): unknown {
    this.connected.push(to);
    return to;
  }
  disconnect(): void {
    this.disconnects++;
    this.connected = [];
  }
}

export class FakeAnalyser extends FakeNode {
  fftSize = 2048;
  smoothingTimeConstant = 0.8;
  /** What the time domain reads: a constant sample value. */
  sample = 0;
  /** What every frequency bin reads, 0–255. */
  bin = 0;
  get frequencyBinCount(): number {
    return this.fftSize / 2;
  }
  getFloatTimeDomainData(out: Float32Array): void {
    out.fill(this.sample);
  }
  getByteFrequencyData(out: Uint8Array): void {
    out.fill(this.bin);
  }
}

export class FakeSplitter extends FakeNode {}

export class FakeAudioContext {
  static all: FakeAudioContext[] = [];
  state: 'running' | 'suspended' | 'closed' = 'running';
  sampleRate = 48000;
  closed = 0;
  sources: FakeNode[] = [];
  analysers: FakeAnalyser[] = [];
  splitters: FakeSplitter[] = [];
  constructor() {
    FakeAudioContext.all.push(this);
  }
  createMediaStreamSource(_stream: MediaStream): FakeNode {
    const n = new FakeNode(this);
    this.sources.push(n);
    return n;
  }
  createAnalyser(): FakeAnalyser {
    const a = new FakeAnalyser(this);
    this.analysers.push(a);
    return a;
  }
  createChannelSplitter(): FakeSplitter {
    const s = new FakeSplitter(this);
    this.splitters.push(s);
    return s;
  }
  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.closed++;
    this.state = 'closed';
    return Promise.resolve();
  }
}

/** Install the fake AudioContext on window (undo with vi.unstubAllGlobals). */
export function stubAudio(): void {
  FakeAudioContext.all = [];
  vi.stubGlobal('AudioContext', FakeAudioContext);
}

export class FakeIO {
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

export class FakeRO {
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
}

export interface Clock {
  frames: Map<number, FrameRequestCallback>;
  cancelled: number[];
  now: number;
  /** Run the frames that are due, `ms` later; true when one ran. */
  step(ms?: number): boolean;
  /** Run frames until none is scheduled (or `max`); how many ran. */
  settle(max?: number): number;
  reduce: boolean;
  dark: boolean;
  media: Map<string, Set<() => void>>;
}

/** A rAF clock, performance.now, matchMedia and observers the test drives. Call in beforeEach. */
export function stubFrames(): Clock {
  const clock: Clock = {
    frames: new Map(),
    cancelled: [],
    now: 1000,
    reduce: false,
    dark: true,
    media: new Map(),
    step(ms = 16) {
      const due = Array.from(clock.frames.values());
      clock.frames.clear();
      clock.now += ms;
      for (const cb of due) cb(clock.now);
      return due.length > 0;
    },
    settle(max = 2000) {
      let n = 0;
      while (clock.frames.size && n < max) {
        clock.step();
        n++;
      }
      return n;
    },
  };
  let id = 0;
  FakeIO.all = [];
  FakeRO.all = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    clock.frames.set(++id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (n: number) => {
    clock.cancelled.push(n);
    clock.frames.delete(n);
  });
  vi.spyOn(performance, 'now').mockImplementation(() => clock.now);
  const listeners = (q: string) => {
    let s = clock.media.get(q);
    if (!s) {
      s = new Set();
      clock.media.set(q, s);
    }
    return s;
  };
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      if (query.includes('prefers-reduced-motion')) return clock.reduce;
      if (query.includes('prefers-color-scheme: dark')) return clock.dark;
      return false;
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => listeners(query).add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners(query).delete(fn),
  }));
  vi.stubGlobal('IntersectionObserver', FakeIO);
  vi.stubGlobal('ResizeObserver', FakeRO);
  return clock;
}

/** A 2D context that records calls (strokes, fills, filters), installed on every canvas. */
export function stubCanvas(): { calls: string[]; ctx: Record<string, unknown> } {
  const calls: string[] = [];
  const gradient = { addColorStop: () => {} };
  const ctx: Record<string, unknown> = {
    filter: 'none',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    lineCap: 'butt',
    lineJoin: 'miter',
    lineWidth: 1,
    strokeStyle: '',
    fillStyle: '',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'low',
    canvas: { width: 300, height: 150 },
    setTransform: () => {},
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    clearRect: () => calls.push('clearRect'),
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => calls.push('arc'),
    rect: () => {},
    fill: () => calls.push('fill'),
    fillRect: () => calls.push('fillRect'),
    stroke: () => calls.push('stroke'),
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    clip: () => {},
    drawImage: () => calls.push('drawImage'),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createConicGradient: () => gradient,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    (ctx.canvas as { width: number; height: number }).width = this.width;
    (ctx.canvas as { width: number; height: number }).height = this.height;
    return ctx as unknown as CanvasRenderingContext2D;
  } as unknown as HTMLCanvasElement['getContext']);
  if (typeof (globalThis as { Path2D?: unknown }).Path2D !== 'function') {
    vi.stubGlobal(
      'Path2D',
      class {
        moveTo() {}
        lineTo() {}
        rect() {}
        closePath() {}
      },
    );
  }
  return { calls, ctx };
}

export const XSS = '<img src=x onerror=alert(1)>';
