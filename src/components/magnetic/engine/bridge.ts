/* Magnet Bridge client: the Android app that runs the magnet model on the
   phone and serves its answers on ws://127.0.0.1:47613 (Chrome's own
   Magnetometer API cannot be switched on). Positions arrive in screen dp,
   which on Android Chrome are CSS px; the page's own coordinates are offset
   by the browser's bars above the viewport.

   No model ships here: the model runs inside the Magnet Bridge app (the
   Libraries.dev Model License forbids bundling it); this is only the socket
   client that reads its answers.

   Ported from magnetkit 0.1.0 (`src/bridge.ts`, MIT, © 2026 Jakub Antalik —
   https://libraries.dev/magnetic). Changes in the port: the state names what
   happened (`closed` after a session, `error` when it never opened), `close()`
   ends a session, the touch listener that finds the page's screen offset lives
   only while connected, `hello` is asked for on open (the magnetic page did
   this), and the socket can be injected (tests). */

import type { MagnetFrame, MagnetGesture, ModelHello, Pt } from './types';

export type { MagnetFrame, MagnetGesture, ModelHello, Pt } from './types';

export const BRIDGE_URL = 'ws://127.0.0.1:47613';

/** idle — never asked · connecting · open · closed — a session ended (or `close()`) · error — it never opened. */
export type BridgeState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

/** The part of a WebSocket the bridge uses. */
export interface BridgeSocket {
  readyState: number;
  onopen: ((ev: Event) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  send(data: string): void;
  close(): void;
}

const OPEN = 1;
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const pt = (v: unknown): Pt | null =>
  Array.isArray(v) && v.length >= 2 && Number.isFinite(v[0]) && Number.isFinite(v[1])
    ? { x: Number(v[0]), y: Number(v[1]) }
    : null;

/** A reading from the app (`{ type: 'm', … }`) as a frame; numbers that are not numbers become their defaults. */
export function parseFrame(d: Record<string, unknown>): MagnetFrame {
  const delta = Array.isArray(d.d) && d.d.length >= 3 ? d.d.slice(0, 3).map((v) => num(v)) : [0, 0, 0];
  return {
    t: num(d.t),
    pos: pt(d.pos),
    spread: num(d.sp),
    height: typeof d.h === 'number' && Number.isFinite(d.h) ? d.h : null,
    presence: num(d.p, 1),
    pull: num(d.pull),
    strength: num(d.s),
    delta: delta as [number, number, number],
    tooClose: !!d.tc,
    calibrating: !!d.cal,
  };
}

/** A gesture from the app (`{ type: 'gesture', … }`), or null when it is none of the four. */
export function parseGesture(d: Record<string, unknown>): MagnetGesture | null {
  if (d.g === 'tap') return { g: 'tap', at: pt(d.at) };
  if (d.g === 'push' || d.g === 'pullAway') return { g: d.g, speed: num(d.speed) };
  if (d.g === 'swipe') return { g: 'swipe', dir: pt(d.dir) ?? { x: 0, y: 0 }, speed: num(d.speed) };
  return null;
}

export class MagnetBridge {
  frame: MagnetFrame | null = null;
  hello: ModelHello | null = null;
  device = '';
  /** The app's protocol version (0.5 sends to each page on its own). */
  version = 0;
  state: BridgeState = 'idle';
  onFrame: ((f: MagnetFrame) => void) | null = null;
  onGesture: ((g: MagnetGesture) => void) | null = null;
  onState: (() => void) | null = null;
  private frameListeners = new Set<(f: MagnetFrame) => void>();
  private gestureListeners = new Set<(g: MagnetGesture) => void>();
  private stateListeners = new Set<() => void>();
  private ws: BridgeSocket | null = null;
  private touchOffset: Pt | null = null;
  private opened = false;

  constructor(private readonly createSocket: (url: string) => BridgeSocket = (url) => new WebSocket(url)) {}

  /** Every reading (~50 a second). Returns an unsubscribe function. */
  addFrameListener(l: (f: MagnetFrame) => void) {
    this.frameListeners.add(l);
    return () => {
      this.frameListeners.delete(l);
    };
  }
  /** Air taps, pushes, pull-aways and swipes. Returns an unsubscribe function. */
  addGestureListener(l: (g: MagnetGesture) => void) {
    this.gestureListeners.add(l);
    return () => {
      this.gestureListeners.delete(l);
    };
  }
  /** Connection state, device and calibration changes. Returns an unsubscribe function. */
  addStateListener(l: () => void) {
    this.stateListeners.add(l);
    return () => {
      this.stateListeners.delete(l);
    };
  }

  /** True once the app knows the magnet (a calibration was handed to it). */
  get calibrated(): boolean {
    return this.hello?.grabStage === 2;
  }

  /** Take a new zero on the phone (keep magnets away for a second). */
  zero() {
    this.send({ type: 'calibrate' });
  }
  /** Hand the phone a fitted calibration (see fitCalibration). */
  setMagnet(fit: { face: 1 | -1; strength: number; sensor: Pt }) {
    this.send({ type: 'set-magnet', face: fit.face, strength: fit.strength, sensor: [fit.sensor.x, fit.sensor.y] });
  }

  /** The exact offset of the page on the screen, from any touch (only while connected). */
  private onTouch = (e: TouchEvent) => {
    const t = e.touches[0];
    if (t) this.touchOffset = { x: t.screenX - t.clientX, y: t.screenY - t.clientY };
  };

  /** Open the socket to the app. Call it from a user action (a click): opening a socket to the phone makes Chrome ask
   *  about local network access. Resolves true once open, false when it could not. */
  connect(): Promise<boolean> {
    if (this.state === 'open' || this.state === 'connecting') return Promise.resolve(this.state === 'open');
    this.opened = false;
    this.set('connecting');
    return new Promise((resolve) => {
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      let ws: BridgeSocket;
      try {
        ws = this.createSocket(BRIDGE_URL);
      } catch {
        this.set('error');
        return done(false);
      }
      this.ws = ws;
      ws.onopen = () => {
        if (this.ws !== ws) return;
        this.opened = true;
        if (typeof addEventListener === 'function') addEventListener('touchstart', this.onTouch, { passive: true });
        this.set('open');
        // Device and protocol version (the app answers with `hello`).
        this.send({ type: 'hello' });
        done(true);
      };
      ws.onclose = () => {
        if (this.ws !== ws) return;
        this.drop();
        this.set(this.opened ? 'closed' : 'error');
        done(false);
      };
      ws.onerror = () => {};
      ws.onmessage = (m) => {
        if (this.ws === ws) this.receive(String(m.data));
      };
    });
  }

  /** End the session (the state becomes `closed`). */
  close() {
    const ws = this.ws;
    if (!ws && this.state !== 'connecting') return;
    this.drop();
    try {
      ws?.close();
    } catch {
      // Already closing.
    }
    this.set('closed');
  }

  private drop() {
    this.ws = null;
    this.frame = null;
    if (typeof removeEventListener === 'function') removeEventListener('touchstart', this.onTouch);
  }

  send(obj: unknown) {
    if (this.ws && this.ws.readyState === OPEN) this.ws.send(JSON.stringify(obj));
  }

  /** Screen dp → client px. The viewport runs to the bottom of the screen on
   *  Android Chrome, so the bars above it are what is left of the screen. */
  offset(): Pt {
    return this.touchOffset ?? { x: 0, y: Math.max(0, screen.height - innerHeight) };
  }

  toClient(p: Pt): Pt {
    const o = this.offset();
    return { x: p.x - o.x, y: p.y - o.y };
  }

  toScreen(p: Pt): Pt {
    const o = this.offset();
    return { x: p.x + o.x, y: p.y + o.y };
  }

  private set(s: BridgeState) {
    this.state = s;
    this.emitState();
  }

  private emitState() {
    this.onState?.();
    for (const l of this.stateListeners) l();
  }

  /** One message from the app. Malformed text is ignored. */
  receive(text: string) {
    let d: Record<string, unknown>;
    try {
      const v: unknown = JSON.parse(text);
      if (!v || typeof v !== 'object') return;
      d = v as Record<string, unknown>;
    } catch {
      return;
    }
    if (d.type === 'm') {
      const f = parseFrame(d);
      this.frame = f;
      this.onFrame?.(f);
      for (const l of this.frameListeners) l(f);
    } else if (d.type === 'gesture') {
      const g = parseGesture(d);
      if (!g) return;
      this.onGesture?.(g);
      for (const l of this.gestureListeners) l(g);
    } else if (d.type === 'model-hello') {
      this.hello = d as unknown as ModelHello;
      this.emitState();
    } else if (d.type === 'hello') {
      this.device = `${String(d.manufacturer ?? '')} ${String(d.model ?? '')}`.trim();
      this.version = Number(d.version) || 0;
      this.emitState();
    }
  }
}
