import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { doc } from './docs';
import { BRIDGE_URL, type BridgeSocket, MagnetBridge, parseFrame, parseGesture } from './engine/bridge';
import { type CalibrationIO, type CalibrationState, DEFAULT_SPOTS, runCalibration } from './engine/calibration';
import { MagneticField, Particle } from './engine/field';
import { type CalibrationSpot, fitCalibration } from './engine/fit';
import type { MagnetFrame, Pt } from './engine/types';
import {
  bridgeMessage,
  calibrationMessage,
  type MagnetBridgeChange,
  type MagneticData,
  magneticOptions,
  outsideDistance,
  pointerFrame,
  UiMagnetic,
} from './magnetic';

const XSS = '<img src=x onerror=alert(1)>';

// ── Fakes ────────────────────────────────────────────────────────────────────────────────────────────────────────

let frames: Map<number, FrameRequestCallback>;
let frameId = 0;
let clock = 0;
let reduce = false;
let media: Map<string, Set<() => void>>;

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
class FakeMO {
  disconnected = false;
  observe() {}
  takeRecords() {
    return [];
  }
  disconnect() {
    this.disconnected = true;
  }
}

/** A socket the test opens, feeds and closes. */
class FakeSocket implements BridgeSocket {
  static all: FakeSocket[] = [];
  readyState = 0;
  sent: unknown[] = [];
  closed = false;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.closed = true;
  }
  open() {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }
  drop() {
    this.readyState = 3;
    this.onclose?.(new Event('close') as CloseEvent);
  }
  message(obj: unknown) {
    this.onmessage?.({ data: typeof obj === 'string' ? obj : JSON.stringify(obj) } as MessageEvent);
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
  reduce = false;
  media = new Map();
  FakeIO.all = [];
  FakeRO.all = [];
  FakeSocket.all = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++frameId, cb);
    return frameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.includes('prefers-reduced-motion') ? reduce : false;
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => listeners(query).add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners(query).delete(fn),
  }));
  vi.stubGlobal('IntersectionObserver', FakeIO);
  vi.stubGlobal('ResizeObserver', FakeRO);
  vi.stubGlobal('MutationObserver', FakeMO);
  UiMagnetic.createSocket = (url) => new FakeSocket(url);
});

afterEach(() => {
  document.body.innerHTML = '';
  Reflect.deleteProperty(document, 'hidden');
  UiMagnetic.createSocket = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function step(ms = 16): number {
  const due = Array.from(frames.values());
  frames.clear();
  clock += ms;
  for (const cb of due) cb(clock);
  return due.length;
}
function settle(max = 2000): number {
  let n = 0;
  while (frames.size && n < max) {
    step();
    n++;
  }
  return n;
}
const flush = () => new Promise<void>((r) => queueMicrotask(r));

function rect(el: Element, x: number, y: number, w: number, h: number): void {
  (el as HTMLElement).getBoundingClientRect = () =>
    ({ left: x, top: y, right: x + w, bottom: y + h, width: w, height: h, x, y, toJSON() {} }) as DOMRect;
}

/** A 400 × 100 host at (0, 0) with two chips marked data-magnetic. */
function mount(
  data: MagneticData = {},
  attrs: Record<string, string> = {},
): { m: UiMagnetic; a: HTMLElement; b: HTMLElement } {
  const m = document.createElement('ui-magnetic');
  for (const [k, v] of Object.entries(attrs)) m.setAttribute(k, v);
  m.data = data;
  const a = document.createElement('span');
  a.dataset.magnetic = '';
  a.textContent = 'Board';
  const b = document.createElement('button');
  b.dataset.magnetic = '';
  b.textContent = 'Runs';
  m.append(a, b);
  rect(m, 0, 0, 400, 100);
  rect(a, 20, 20, 80, 30);
  rect(b, 300, 20, 80, 30);
  document.body.append(m);
  m.renderNow();
  return { m, a, b };
}
const press = (type: string, x: number, y: number) =>
  window.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true }));
const tx = (el: HTMLElement) => {
  const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(el.style.transform);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 0, y: 0 };
};

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────

describe('options and helpers', () => {
  it('data first, then attributes, clamped; a broken selector falls back', () => {
    expect(magneticOptions()).toEqual({
      selector: '[data-magnetic]',
      enabled: true,
      pointer: true,
      stiffness: 150,
      damping: 21,
      force: 30000,
      reach: 150,
      motion: 'system',
    });
    const attrs: Record<string, string> = {
      selector: '[[nope',
      disabled: '',
      pointer: 'off',
      stiffness: '9999',
      reach: 'x',
      motion: 'full',
    };
    expect(magneticOptions({ damping: -1 }, (n) => attrs[n] ?? null)).toMatchObject({
      selector: '[data-magnetic]',
      enabled: false,
      pointer: false,
      stiffness: 1000,
      damping: 1,
      reach: 150,
      motion: 'full',
    });
    expect(magneticOptions({ selector: '.chip', enabled: true, pointer: true }, (n) => attrs[n] ?? null)).toMatchObject(
      { selector: '.chip', enabled: true, pointer: true },
    );
  });

  it('the pointer frame (simulateMagnetWithPointer) and the distance outside a box', () => {
    expect(pointerFrame(5, true, { x: 1, y: 2 })).toMatchObject({
      t: 5,
      pos: { x: 1, y: 2 },
      strength: 80,
      pull: 0.8,
      delta: [0, 0, -40],
    });
    expect(pointerFrame(5, false, { x: 1, y: 2 })).toMatchObject({ pos: null, strength: 0, delta: [0, 0, 0] });
    const box = { left: 0, top: 0, right: 100, bottom: 50 };
    expect(outsideDistance({ x: 50, y: 20 }, box)).toBe(0);
    expect(outsideDistance({ x: 130, y: 20 }, box)).toBe(30);
    expect(outsideDistance({ x: 103, y: 54 }, box)).toBe(5);
  });

  it('bridge and calibration lines, en and ko', () => {
    const s = (state: MagnetBridgeChange['state'], version = 5, calibrated = true) => ({ state, version, calibrated });
    expect(bridgeMessage(s('idle'), 'en', false)).toBeNull();
    expect(bridgeMessage(s('connecting'), 'en', false)).toBe('Connecting to Magnet Bridge…');
    expect(bridgeMessage(s('open'), 'en', false)).toContain('Hold the magnet beside the phone');
    expect(bridgeMessage(s('open', 5, false), 'en', false)).toContain('Calibrate once');
    expect(bridgeMessage(s('open', 3), 'en', false)).toContain('older version');
    expect(bridgeMessage(s('open'), 'en', true)).toContain('Reduced motion');
    expect(bridgeMessage(s('error'), 'en', false)).toContain('Couldn’t reach');
    expect(bridgeMessage(s('closed'), 'ko', false)).toBe('Magnet Bridge 연결이 끊겼어요.');
    const c = (phase: CalibrationState['phase'], error = 0.1): CalibrationState => ({
      phase,
      index: 1,
      total: 5,
      spot: null,
      progress: 0,
      field: null,
      zeroing: false,
      fit: { face: 1, strength: 1, sensor: { x: 0, y: 0 }, height: 1, error },
    });
    expect(calibrationMessage(c('spot'), 'en')).toBe('Ring 2 of 5: hold the magnet 1–2 cm above it and keep it still.');
    expect(calibrationMessage(c('spot'), 'ko')).toBe('5개 중 2번째 원: 자석을 1–2cm 위에 대고 움직이지 마세요.');
    expect(calibrationMessage(c('done'), 'en')).toBe('Calibrated.');
    expect(calibrationMessage(c('done', 0.4), 'en')).toContain('loosely');
    expect(calibrationMessage(c('failed'), 'en')).toContain('didn’t fit');
    expect(calibrationMessage(c('zeroing'), 'en')).toContain('keep the magnet away');
    expect(calibrationMessage(c('cancelled'), 'en')).toBe('Calibration cancelled.');
  });

  it('parses the app’s messages; junk becomes defaults or nothing', () => {
    expect(
      parseFrame({ t: 1, pos: [10, 20], sp: 3, h: 1.2, p: 0.9, pull: 0.5, s: 60, d: [1, 2, 3], tc: 1, cal: 0 }),
    ).toEqual({
      t: 1,
      pos: { x: 10, y: 20 },
      spread: 3,
      height: 1.2,
      presence: 0.9,
      pull: 0.5,
      strength: 60,
      delta: [1, 2, 3],
      tooClose: true,
      calibrating: false,
    });
    expect(parseFrame({ pos: ['a', 2], s: 'x', d: [1], h: Number.NaN })).toMatchObject({
      pos: null,
      strength: 0,
      delta: [0, 0, 0],
      height: null,
      presence: 1,
    });
    expect(parseGesture({ g: 'tap', at: [3, 4] })).toEqual({ g: 'tap', at: { x: 3, y: 4 } });
    expect(parseGesture({ g: 'push', speed: 2 })).toEqual({ g: 'push', speed: 2 });
    expect(parseGesture({ g: 'pullAway' })).toEqual({ g: 'pullAway', speed: 0 });
    expect(parseGesture({ g: 'swipe', dir: [1, 0], speed: 9 })).toEqual({ g: 'swipe', dir: { x: 1, y: 0 }, speed: 9 });
    expect(parseGesture({ g: XSS })).toBeNull();
  });
});

describe('MagneticField (the physics, verbatim)', () => {
  const screen = { left: 0, top: 0, right: 400, bottom: 800 };
  const frame = (pos: Pt | null, strength = 80, delta: [number, number, number] = [0, 0, -40]): MagnetFrame => ({
    t: 0,
    pos,
    spread: 20,
    height: null,
    presence: 1,
    pull: 0.8,
    strength,
    delta,
    tooClose: false,
    calibrating: false,
  });

  it('a body is at rest at home; mass and inertia follow its box', () => {
    const p = new Particle();
    p.home = { left: 0, top: 0, right: 100, bottom: 20 };
    expect(p.resting).toBe(true);
    expect(p.mass).toBe(2);
    expect(p.inertia).toBeCloseTo((2 * (100 ** 2 + 20 ** 2)) / 12, 6);
    expect(p.center).toEqual({ x: 50, y: 10 });
  });

  it('a magnet beside the screen pulls a body toward it; gone, the string brings it home', () => {
    const f = new MagneticField();
    f.setHome('a', { left: 300, top: 100, right: 380, bottom: 130 }, 8);
    let t = 1;
    for (let i = 0; i < 30; i++) {
      t += 1 / 60;
      f.step(frame({ x: 430, y: 115 }), t, screen, 1);
    }
    const p = f.parts.get('a')!;
    expect(p.ox).toBeGreaterThan(1);
    expect(f.active).toBe(true);
    // Contained by the screen's edge: it never leaves the 400-wide screen.
    expect(p.home.right + p.ox).toBeLessThanOrEqual(400.5);
    for (let i = 0; i < 400; i++) {
      t += 1 / 60;
      f.step(frame(null, 0, [0, 0, 0]), t, screen, 1);
    }
    expect(p.resting).toBe(true);
    expect(f.active).toBe(false);
  });

  it('the magnet over the glass (the field along the face) pulls nothing', () => {
    const f = new MagneticField();
    f.setHome('a', { left: 300, top: 100, right: 380, bottom: 130 }, 8);
    let t = 1;
    for (let i = 0; i < 30; i++) {
      t += 1 / 60;
      f.step(frame({ x: 430, y: 115 }, 80, [0, 0, 40]), t, screen, 1);
    }
    expect(f.overGlass).toBe(true);
    expect(Math.abs(f.parts.get('a')!.ox)).toBeLessThan(0.01);
  });

  it('bodies collide and push apart; overlapping homes never do', () => {
    const f = new MagneticField();
    f.setHome('a', { left: 100, top: 100, right: 160, bottom: 130 }, 6);
    f.setHome('b', { left: 170, top: 100, right: 230, bottom: 130 }, 6);
    const a = f.parts.get('a')!;
    a.ox = 40;
    f.relax(1);
    f.step(frame(null, 0, [0, 0, 0]), 1 + 1 / 60, screen, 1);
    expect(f.parts.get('b')!.ox).toBeGreaterThan(0);
    const g = new MagneticField();
    g.setHome('a', { left: 100, top: 100, right: 160, bottom: 130 }, 6);
    g.setHome('b', { left: 120, top: 110, right: 180, bottom: 140 }, 6);
    g.step(frame(null, 0, [0, 0, 0]), 1, screen, 1);
    expect(g.parts.get('b')!.ox).toBe(0);
  });
});

describe('calibration (headless)', () => {
  const PPCM = 160 / 2.54;
  /** The same dipole model the fit uses, to make readings for known spots. */
  function field(s: Pt, sensor: Pt, h: number, face: number, k: number): [number, number, number] {
    const offX = (s.x - sensor.x) / PPCM;
    const offY = -(s.y - sensor.y) / PPCM;
    const r = Math.hypot(offX, offY, h);
    const rx = -offX / r;
    const ry = -offY / r;
    const rz = -h / r;
    const mDotR = face * rz;
    const c = k / (r * r * r);
    return [c * 3 * mDotR * rx, c * 3 * mDotR * ry, c * (3 * mDotR * rz - face)];
  }

  it('fits the face, strength and sensor spot from five held spots', () => {
    // On the fit's grid: x every 8 from 0, y every 8 from −30.
    const sensor = { x: 200, y: 34 };
    const spots: CalibrationSpot[] = DEFAULT_SPOTS.map(([fx, fy]) => {
      const s = { x: fx * 400, y: fy * 800 };
      return { screen: s, delta: field(s, sensor, 1.6, -1, 900) };
    });
    const fit = fitCalibration(spots, { x: 400, y: 800 })!;
    expect(fit.face).toBe(-1);
    expect(fit.sensor).toEqual(sensor);
    expect(fit.height).toBeCloseTo(1.6, 5);
    expect(fit.strength).toBeCloseTo(900, 3);
    expect(fit.error).toBeLessThan(1e-9);
    expect(fitCalibration(spots.slice(0, 2), { x: 400, y: 800 })).toBeNull();
  });

  it('runs zeroing → five held spots → the fit handed to the phone; cancel ends it', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    let listener = null as ((f: MagnetFrame) => void) | null;
    const io: CalibrationIO = {
      zero: vi.fn(),
      addFrameListener: (l) => {
        listener = l;
        return () => {
          listener = null;
        };
      },
      setMagnet: vi.fn(),
      viewport: () => ({ x: 400, y: 800 }),
      toScreen: (p) => p,
      screenSize: () => ({ x: 400, y: 800 }),
      pointsPerCm: PPCM,
    };
    const states: CalibrationState[] = [];
    const run = runCalibration(io, { onUpdate: (s) => states.push(s) });
    expect(io.zero).toHaveBeenCalled();
    expect(states[0].phase).toBe('zeroing');
    const sensor = { x: 200, y: 34 };
    clock += 1600;
    for (const [fx, fy] of DEFAULT_SPOTS) {
      const s = { x: fx * 400, y: fy * 800 };
      // Strong enough to count as held (≥ 15 µT) at every spot.
      const delta = field(s, sensor, 1.6, 1, 60000);
      const strength = Math.hypot(...delta);
      for (let t = 0; t <= 1100; t += 50) {
        clock += 50;
        listener?.({ ...pointerFrame(clock, true, s), delta, strength, t: clock });
      }
    }
    const fit = await run.promise;
    expect(fit).not.toBeNull();
    expect(fit!.face).toBe(1);
    expect(io.setMagnet).toHaveBeenCalledWith(fit);
    expect(states.at(-1)!.phase).toBe('done');
    expect(states.some((s) => s.phase === 'spot' && s.spot !== null)).toBe(true);
    expect(listener).toBeNull();
    const again = runCalibration(io);
    again.cancel();
    expect(await again.promise).toBeNull();
  });
});

describe('MagnetBridge', () => {
  it('connects on request only: connecting → open, asks for hello, reads frames, gestures and hellos', async () => {
    const b = new MagnetBridge((url) => new FakeSocket(url));
    expect(FakeSocket.all).toHaveLength(0);
    const seen: string[] = [];
    b.addStateListener(() => seen.push(b.state));
    const p = b.connect();
    expect(b.state).toBe('connecting');
    const ws = FakeSocket.all[0];
    expect(ws.url).toBe(BRIDGE_URL);
    ws.open();
    expect(await p).toBe(true);
    expect(ws.sent).toEqual([{ type: 'hello' }]);
    const frames: MagnetFrame[] = [];
    b.addFrameListener((f) => frames.push(f));
    ws.message({ type: 'm', t: 3, pos: [5, 6], s: 50, d: [1, 2, 3] });
    ws.message('not json');
    ws.message('null');
    expect(frames).toHaveLength(1);
    expect(b.frame?.pos).toEqual({ x: 5, y: 6 });
    const gestures: unknown[] = [];
    b.addGestureListener((g) => gestures.push(g));
    ws.message({ type: 'gesture', g: 'tap', at: [1, 2] });
    ws.message({ type: 'gesture', g: 'nope' });
    expect(gestures).toEqual([{ g: 'tap', at: { x: 1, y: 2 } }]);
    ws.message({ type: 'hello', manufacturer: 'Acme', model: 'P1', version: 5 });
    expect(b.device).toBe('Acme P1');
    expect(b.version).toBe(5);
    expect(b.calibrated).toBe(false);
    ws.message({
      type: 'model-hello',
      screenDp: [400, 800],
      grabStage: 2,
      face: 1,
      strength: 9,
      sensorDp: [1, 2],
      model: true,
    });
    expect(b.calibrated).toBe(true);
    b.zero();
    b.setMagnet({ face: -1, strength: 3, sensor: { x: 4, y: 5 } });
    expect(ws.sent.slice(1)).toEqual([
      { type: 'calibrate' },
      { type: 'set-magnet', face: -1, strength: 3, sensor: [4, 5] },
    ]);
    ws.drop();
    expect(b.state).toBe('closed');
    expect(b.frame).toBeNull();
    expect(seen.slice(0, 2)).toEqual(['connecting', 'open']);
  });

  it('a socket that never opens is an error; one that cannot be made is too; close() ends a session', async () => {
    const b = new MagnetBridge((url) => new FakeSocket(url));
    const p = b.connect();
    FakeSocket.all[0].drop();
    expect(await p).toBe(false);
    expect(b.state).toBe('error');
    const c = new MagnetBridge(() => {
      throw new Error('blocked');
    });
    expect(await c.connect()).toBe(false);
    expect(c.state).toBe('error');
    const d = new MagnetBridge((url) => new FakeSocket(url));
    const q = d.connect();
    const ws = FakeSocket.all.at(-1)!;
    ws.open();
    await q;
    d.close();
    expect(d.state).toBe('closed');
    expect(ws.closed).toBe(true);
    // A late close from the old socket changes nothing.
    ws.drop();
    expect(d.state).toBe('closed');
  });

  it('the touch listener (the page’s screen offset) lives only while connected', async () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const b = new MagnetBridge((url) => new FakeSocket(url));
    expect(add.mock.calls.some(([t]) => t === 'touchstart')).toBe(false);
    const p = b.connect();
    FakeSocket.all[0].open();
    await p;
    expect(add.mock.calls.some(([t]) => t === 'touchstart')).toBe(true);
    b.close();
    expect(remove.mock.calls.some(([t]) => t === 'touchstart')).toBe(true);
  });
});

// ── The element ──────────────────────────────────────────────────────────────────────────────────────────────────

describe('<ui-magnetic>', () => {
  it('renders the host’s markup through a slot and a silent status line; connects to nothing on its own', () => {
    const { m } = mount();
    const root = m.shadowRoot!;
    expect(root.querySelector('slot')).not.toBeNull();
    const status = root.querySelector('[role="status"]')!;
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('');
    expect(FakeSocket.all).toHaveLength(0);
    expect(m.bridgeState).toBe('idle');
    expect(m.running).toBe(false);
  });

  it('the pointer plays the magnet: press beside it pulls the bodies, release brings them home and the loop stops', () => {
    const { m, a, b } = mount();
    press('pointerdown', 430, 50);
    expect(m.running).toBe(true);
    for (let i = 0; i < 40; i++) step();
    expect(tx(b).x).toBeGreaterThan(1);
    expect(b.style.transform).toContain('rotate(');
    expect(m.running).toBe(true);
    press('pointermove', 200, -40);
    for (let i = 0; i < 20; i++) step();
    press('pointerup', 200, -40);
    settle();
    expect(m.running).toBe(false);
    expect(a.style.transform).toBe('');
    expect(b.style.transform).toBe('');
  });

  it('a press far away runs nothing; pointer="off" ignores the pointer', () => {
    const { m } = mount();
    press('pointerdown', 2000, 2000);
    expect(m.running).toBe(false);
    press('pointerup', 2000, 2000);
    m.setAttribute('pointer', 'off');
    m.renderNow();
    press('pointerdown', 430, 50);
    expect(m.running).toBe(false);
  });

  it('holding the magnet does not select text; letting go restores selecting', () => {
    mount();
    press('pointerdown', 430, 50);
    const sel = new Event('selectstart', { cancelable: true });
    document.dispatchEvent(sel);
    expect(sel.defaultPrevented).toBe(true);
    press('pointerup', 430, 50);
    const after = new Event('selectstart', { cancelable: true });
    document.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it('reduced motion (system or motion="reduce") and disabled: no pull at all; motion="full" overrides', () => {
    reduce = true;
    const { m, b } = mount();
    expect(m.reducedMotion).toBe(true);
    press('pointerdown', 430, 50);
    expect(m.running).toBe(false);
    step();
    expect(b.style.transform).toBe('');
    press('pointerup', 430, 50);
    m.setAttribute('motion', 'full');
    m.renderNow();
    press('pointerdown', 430, 50);
    expect(m.running).toBe(true);
    press('pointerup', 430, 50);
    settle();
    reduce = false;
    const other = mount({ enabled: false }).m;
    press('pointerdown', 430, 50);
    expect(other.running).toBe(false);
    press('pointerup', 430, 50);
    const third = mount({}, { motion: 'reduce' }).m;
    press('pointerdown', 430, 50);
    expect(third.running).toBe(false);
  });

  it('turning reduced motion on mid-pull stops and puts everything back', () => {
    const { m, b } = mount();
    press('pointerdown', 430, 50);
    for (let i = 0; i < 20; i++) step();
    expect(b.style.transform).not.toBe('');
    m.setAttribute('motion', 'reduce');
    m.renderNow();
    expect(m.running).toBe(false);
    expect(b.style.transform).toBe('');
  });

  it('an inline body turns inline-block while it can move, and back after', () => {
    // happy-dom computes no display: say the span is inline, as a browser would.
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
      const cs = real(el);
      return el.localName === 'span' && !(el as HTMLElement).style.display
        ? ({ ...cs, display: 'inline', borderTopLeftRadius: '' } as CSSStyleDeclaration)
        : cs;
    });
    const { m, a } = mount();
    press('pointerdown', 430, 50);
    step();
    expect(a.style.display).toBe('inline-block');
    press('pointerup', 430, 50);
    settle();
    m.remove();
    expect(a.style.display).toBe('');
  });

  it('off screen and in a hidden tab the loop stops; back, it resumes', () => {
    const { m } = mount();
    press('pointerdown', 430, 50);
    expect(m.running).toBe(true);
    FakeIO.all[0].fire(false);
    expect(m.running).toBe(false);
    FakeIO.all[0].fire(true);
    expect(m.running).toBe(true);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(m.running).toBe(false);
  });

  it('connect() from a click: events for every state, the status line, gestures with client positions', async () => {
    const { m } = mount();
    const states: MagnetBridgeChange[] = [];
    m.addEventListener('ui-bridge-change', (e) => states.push((e as CustomEvent<MagnetBridgeChange>).detail));
    const gestures: unknown[] = [];
    m.addEventListener('ui-magnet-gesture', (e) => gestures.push((e as CustomEvent).detail));
    const p = m.connect();
    const status = m.shadowRoot!.querySelector('[role="status"]')!;
    expect(status.textContent).toBe('Connecting to Magnet Bridge…');
    const ws = FakeSocket.all[0];
    ws.open();
    expect(await p).toBe(true);
    ws.message({ type: 'hello', manufacturer: XSS, model: 'P1', version: 5 });
    expect(states.map((s) => s.state)).toEqual(['connecting', 'open', 'open']);
    expect(states[2].device).toBe(`${XSS} P1`);
    expect(m.shadowRoot!.querySelector('img')).toBeNull();
    expect(status.textContent).toContain('Calibrate once');
    vi.stubGlobal('screen', { width: 400, height: 900 });
    vi.stubGlobal('innerHeight', 800);
    ws.message({ type: 'gesture', g: 'tap', at: [50, 300] });
    expect(gestures).toEqual([{ g: 'tap', at: { x: 50, y: 300 }, client: { x: 50, y: 200 } }]);
    // While the bridge is open the pointer does not play the magnet.
    settle();
    press('pointerdown', 430, 50);
    expect(m.running).toBe(false);
    press('pointerup', 430, 50);
    m.disconnect();
    expect(m.bridgeState).toBe('closed');
    expect(status.textContent).toBe('Magnet Bridge disconnected.');
  });

  it('bridge readings drive the pull: a magnet beside the phone wakes the loop', async () => {
    vi.stubGlobal('screen', { width: 400, height: 800 });
    vi.stubGlobal('innerWidth', 400);
    vi.stubGlobal('innerHeight', 800);
    const { m, b } = mount();
    const p = m.connect();
    const ws = FakeSocket.all[0];
    ws.open();
    await p;
    ws.message({ type: 'm', t: 1, pos: [430, 35], s: 80, p: 1, d: [0, 0, -40] });
    expect(m.running).toBe(true);
    for (let i = 0; i < 30; i++) {
      ws.message({ type: 'm', t: 1 + i, pos: [430, 35], s: 80, p: 1, d: [0, 0, -40] });
      step();
    }
    expect(tx(b).x).toBeGreaterThan(1);
    ws.message({ type: 'm', t: 99, pos: null, s: 0, d: [0, 0, 0] });
    settle();
    expect(m.running).toBe(false);
    expect(b.style.transform).toBe('');
  });

  it('an unreachable bridge is an error, said in Korean with lang="ko"', async () => {
    const { m } = mount({}, { lang: 'ko' });
    const p = m.connect();
    FakeSocket.all[0].drop();
    expect(await p).toBe(false);
    expect(m.bridgeState).toBe('error');
    expect(m.shadowRoot!.querySelector('[role="status"]')!.textContent).toBe(
      'Magnet Bridge에 연결할 수 없어요. 휴대폰에서 앱을 열고 Start bridge를 누른 뒤 다시 시도하세요.',
    );
  });

  it('calibrate() needs an open bridge; open, it zeroes the phone and reports each step', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { m } = mount();
    expect(await m.calibrate().promise).toBeNull();
    const p = m.connect();
    const ws = FakeSocket.all[0];
    ws.open();
    await p;
    const steps: CalibrationState[] = [];
    m.addEventListener('ui-calibration', (e) => steps.push((e as CustomEvent<CalibrationState>).detail));
    const run = m.calibrate();
    expect(ws.sent).toContainEqual({ type: 'calibrate' });
    expect(steps[0].phase).toBe('zeroing');
    expect(m.shadowRoot!.querySelector('[role="status"]')!.textContent).toContain('keep the magnet away');
    run.cancel();
    expect(await run.promise).toBeNull();
    expect(steps.at(-1)!.phase).toBe('cancelled');
  });

  it('disconnecting from the page stops the loop, drops the listeners and ends the bridge session', async () => {
    const { m, b } = mount();
    const p = m.connect();
    FakeSocket.all[0].open();
    await p;
    m.disconnect();
    press('pointerdown', 430, 50);
    step();
    m.remove();
    await flush();
    expect(m.running).toBe(false);
    expect(frames.size).toBe(0);
    expect(b.style.transform).toBe('');
    expect(FakeIO.all[0].disconnected).toBe(true);
    expect(FakeRO.all[0].disconnected).toBe(true);
    press('pointerup', 430, 50);
    press('pointerdown', 430, 50);
    expect(m.running).toBe(false);
    // A move in the DOM keeps an open session.
    const again = mount().m;
    const q = again.connect();
    const ws = FakeSocket.all.at(-1)!;
    ws.open();
    await q;
    document.body.append(again);
    await flush();
    expect(again.bridgeState).toBe('open');
    again.remove();
    await flush();
    expect(again.bridgeState).toBe('closed');
    expect(ws.closed).toBe(true);
  });
});

describe('docs', () => {
  it('names the source, sits in Effects and ships at least three demos that build without the network', () => {
    expect(doc.group).toBe('Effects');
    expect(doc.reference.url).toBe('https://libraries.dev/magnetic');
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const d of doc.demos) {
      const el = d.create();
      document.body.append(el);
      expect(el.querySelector('ui-magnetic')).not.toBeNull();
      expect(el.querySelectorAll('[data-magnetic]').length).toBeGreaterThan(0);
      el.remove();
    }
    expect(FakeSocket.all).toHaveLength(0);
  });
});
