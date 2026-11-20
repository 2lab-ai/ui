import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { type BridgeSocket, type BridgeState, MagnetBridge } from './engine/bridge';
import { type CalibrationState, calibrate } from './engine/calibration';
import { type Box, MagneticField } from './engine/field';
import type { CalibrationFit } from './engine/fit';
import type { MagnetFrame, MagnetGesture, Pt } from './engine/types';
import { styles } from './styles';

export type MagneticLang = 'en' | 'ko';
/** How much motion: `system` follows prefers-reduced-motion, `reduce` / `full` force it. */
export type MagneticMotion = 'system' | 'reduce' | 'full';

export interface MagneticData {
  /** Which elements inside move. Default `[data-magnetic]`. */
  selector?: string;
  /** false: nothing moves (the bridge still connects and reports). Default true. */
  enabled?: boolean;
  /** The pointer plays the magnet: press and hold beside (or on) the element to bring it in, release to take it away.
   *  Default true. A connected Magnet Bridge takes over while it is open. */
  pointer?: boolean;
  /** Spring stiffness of each element's string to its place (10 … 1000). Default 150. */
  stiffness?: number;
  /** Spring damping (1 … 200). Default 21. */
  damping?: number;
  /** Pull force (0 … 200000). Default 30000. */
  force?: number;
  /** Pull reach in px (10 … 1000). Default 150. */
  reach?: number;
}

/** What the element pulls with now: `data` first, then the attributes, each clamped. */
export interface MagneticOptions {
  selector: string;
  enabled: boolean;
  pointer: boolean;
  stiffness: number;
  damping: number;
  force: number;
  reach: number;
  motion: MagneticMotion;
}

/** `ui-bridge-change` detail. */
export interface MagnetBridgeChange {
  state: BridgeState;
  /** "Manufacturer Model" of the phone once the app said hello. */
  device: string;
  /** The app's protocol version (older than 5: ask for a reinstall). */
  version: number;
  /** True once the app knows the magnet (calibrated). */
  calibrated: boolean;
}

/** `ui-magnet-gesture` detail: the app's gesture, and for a tap its spot in client px. */
export type MagnetGestureDetail = MagnetGesture & { client?: Pt | null };

const STRINGS = {
  en: {
    connecting: 'Connecting to Magnet Bridge…',
    open: 'Connected to Magnet Bridge. Hold the magnet beside the phone, by an edge.',
    calibrate: 'Connected to Magnet Bridge. Calibrate once so the page knows your magnet.',
    old: 'Connected, but this Magnet Bridge is an older version. Install the app again, then tap Start bridge.',
    still: 'Connected to Magnet Bridge. Reduced motion is on, so nothing moves.',
    closed: 'Magnet Bridge disconnected.',
    error: 'Couldn’t reach Magnet Bridge. Open the app on the phone, tap Start bridge, then try again.',
    zeroing: 'Calibrating: keep the magnet away for a moment…',
    spot: (i: number, n: number) => `Ring ${i} of ${n}: hold the magnet 1–2 cm above it and keep it still.`,
    done: 'Calibrated.',
    loose: 'Calibrated, but loosely. For a better fit, run it again holding the magnet 1–2 cm above each ring.',
    failed: 'Calibration didn’t fit. Try again, holding the magnet still over each ring.',
    cancelled: 'Calibration cancelled.',
  },
  ko: {
    connecting: 'Magnet Bridge에 연결하는 중…',
    open: 'Magnet Bridge에 연결됨. 자석을 휴대폰 옆, 가장자리 쪽에 대 보세요.',
    calibrate: 'Magnet Bridge에 연결됨. 자석을 한 번 보정해 주세요.',
    old: '연결됐지만 오래된 Magnet Bridge 버전이에요. 앱을 다시 설치한 뒤 Start bridge를 누르세요.',
    still: 'Magnet Bridge에 연결됨. 동작 줄이기가 켜져 있어 움직이지 않아요.',
    closed: 'Magnet Bridge 연결이 끊겼어요.',
    error: 'Magnet Bridge에 연결할 수 없어요. 휴대폰에서 앱을 열고 Start bridge를 누른 뒤 다시 시도하세요.',
    zeroing: '보정 중: 잠시 자석을 멀리 두세요…',
    spot: (i: number, n: number) => `${n}개 중 ${i}번째 원: 자석을 1–2cm 위에 대고 움직이지 마세요.`,
    done: '보정을 마쳤어요.',
    loose: '보정했지만 정확도가 낮아요. 각 원 위 1–2cm에서 자석을 멈춘 채 다시 해 보세요.',
    failed: '보정이 맞지 않았어요. 각 원 위에서 자석을 멈춘 채 다시 해 보세요.',
    cancelled: '보정을 취소했어요.',
  },
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Seconds the magnet must be gone before the bodies return on their strings alone. */
const RELAX_AFTER = 0.3;

function num(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? clamp(n, lo, hi) : dflt;
}

function motionOf(v: unknown): MagneticMotion {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return s === 'reduce' || s === 'full' ? s : 'system';
}

/** A selector that works, else the default: a broken one must not throw from a render. */
function selectorOf(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return '[data-magnetic]';
  try {
    document.createDocumentFragment().querySelector(s);
    return s;
  } catch {
    return '[data-magnetic]';
  }
}

/** The options for a data object and an attribute reader (pure: the element and the tests share it). */
export function magneticOptions(
  d: MagneticData = {},
  attr: (name: string) => string | null = () => null,
): MagneticOptions {
  const flag = (v: boolean | undefined, off: boolean) => (typeof v === 'boolean' ? v : !off);
  return {
    selector: selectorOf(d.selector ?? attr('selector')),
    enabled: flag(d.enabled, attr('disabled') !== null),
    pointer: flag(d.pointer, /^(off|false|none)$/i.test(attr('pointer') ?? '')),
    stiffness: num(d.stiffness ?? attr('stiffness'), 10, 1000, 150),
    damping: num(d.damping ?? attr('damping'), 1, 200, 21),
    force: num(d.force ?? attr('force'), 0, 200000, 30000),
    reach: num(d.reach ?? attr('reach'), 10, 1000, 150),
    motion: motionOf(attr('motion')),
  };
}

/** The frame the pointer plays (magnetkit's simulateMagnetWithPointer, verbatim): held, a magnet at the pointer with
 *  the field along the screen; released, nothing. */
export function pointerFrame(t: number, held: boolean, at: Pt): MagnetFrame {
  return {
    t,
    pos: held ? { x: at.x, y: at.y } : null,
    spread: 20,
    height: null,
    presence: 1,
    pull: held ? 0.8 : 0,
    strength: held ? 80 : 0,
    delta: held ? [0, 0, -40] : [0, 0, 0],
    tooClose: false,
    calibrating: false,
  };
}

/** How far a point lies outside a box (0 inside). */
export function outsideDistance(p: Pt, b: Box): number {
  const dx = Math.max(b.left - p.x, p.x - b.right, 0);
  const dy = Math.max(b.top - p.y, p.y - b.bottom, 0);
  return Math.hypot(dx, dy);
}

/** The status line for a bridge state (null: say nothing). */
export function bridgeMessage(
  s: Pick<MagnetBridgeChange, 'state' | 'version' | 'calibrated'>,
  lang: MagneticLang,
  still: boolean,
): string | null {
  const t = STRINGS[lang];
  switch (s.state) {
    case 'connecting':
      return t.connecting;
    case 'open':
      if (s.version > 0 && s.version < 5) return t.old;
      if (still) return t.still;
      return s.calibrated ? t.open : t.calibrate;
    case 'closed':
      return t.closed;
    case 'error':
      return t.error;
    default:
      return null;
  }
}

/** The status line for a calibration step (null: say nothing new — progress updates stay silent). */
export function calibrationMessage(s: CalibrationState, lang: MagneticLang): string | null {
  const t = STRINGS[lang];
  if (s.phase === 'zeroing') return t.zeroing;
  if (s.phase === 'spot') return t.spot(s.index + 1, s.total);
  if (s.phase === 'done') return s.fit && s.fit.error >= 0.25 ? t.loose : t.done;
  if (s.phase === 'failed') return t.failed;
  return t.cancelled;
}

interface Body {
  id: string;
  el: HTMLElement;
  /** The element's box relative to the host's, at rest. */
  local: Box;
  corner: number;
  /** It was `display: inline` (made inline-block so it can turn): restored on teardown. */
  wasInline: boolean;
}

/**
 * `<ui-magnetic>` — Magnetic UI: everything marked `data-magnetic` inside it is a small rigid body on a stiff damped
 * string to its place, pulled toward a magnet by its nearest point (1/d³, capped, so it also tilts); bodies knock and
 * rest against the edge, and spring back when the magnet leaves.
 *
 * The magnet is the pointer by default — press and hold beside the element (like a magnet beside a phone) or on it,
 * release to take it away — or a real magnet beside an Android phone, through the Magnet Bridge app, after the host
 * calls `connect()` from a click (never automatically). The model runs inside the app: nothing here ships or loads
 * it. Bridge state and gestures leave as events; a visually hidden status line says what the bridge is doing.
 *
 * No frames while nothing pulls: the loop runs while the pointer is held or a body is still moving, and stops off
 * screen and in a hidden tab. Reduced motion: no pull at all.
 *
 * Ported from magnetkit 0.1.0 (MIT, © 2026 Jakub Antalik — https://libraries.dev/magnetic): the MagneticField physics,
 * the bridge client and the calibration are under `./engine/`, nearly verbatim.
 */
export class UiMagnetic extends UiElement<MagneticData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return ['selector', 'disabled', 'pointer', 'stiffness', 'damping', 'force', 'reach', 'motion', 'lang'];
  }

  /** The socket the bridge opens — override for tests or a proxy. */
  static createSocket: ((url: string) => BridgeSocket) | null = null;

  readonly field = new MagneticField();
  #bridge: MagnetBridge | null = null;
  #status: HTMLElement | null = null;
  #opts: MagneticOptions = magneticOptions();
  #bodies: Body[] = [];
  #stale = true;
  #raf = 0;
  #held = false;
  #at: Pt = { x: 0, y: 0 };
  /** When the magnet was last seen leaving (s, rAF clock); -1 while it is here. */
  #gone = -1;
  #visible = true;
  #reduced = false;
  #calibrating: { cancel: () => void } | null = null;
  #ro: ResizeObserver | null = null;
  #io: IntersectionObserver | null = null;
  #mo: MutationObserver | null = null;
  #motion: MediaQueryList | null = null;

  constructor() {
    super();
    this.field.screenCorner = 24;
  }

  attributeChangedCallback(_name: string, old: string | null, value: string | null): void {
    if (old !== value) this.requestRender();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#reduced = this.#computeReduced();
    this.#stale = true;
    if (typeof ResizeObserver === 'function') {
      this.#ro = new ResizeObserver(this.#markStale);
      this.#ro.observe(this);
    }
    if (typeof IntersectionObserver === 'function') {
      this.#io = new IntersectionObserver((entries) => {
        const e = entries[entries.length - 1];
        if (!e) return;
        this.#visible = e.isIntersecting;
        if (this.#visible) this.#wake();
        else this.#stop();
      });
      this.#io.observe(this);
    }
    if (typeof MutationObserver === 'function') {
      // Bodies added or removed (a nav item, a chip): measure again at rest.
      this.#mo = new MutationObserver(this.#markStale);
      this.#mo.observe(this, { childList: true, subtree: true });
    }
    if (typeof matchMedia === 'function') {
      this.#motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.#motion.addEventListener?.('change', this.#onMotion);
    }
    addEventListener('pointerdown', this.#onDown, { capture: true, passive: true });
    addEventListener('resize', this.#markStale);
    document.addEventListener('visibilitychange', this.#onVisibility);
  }

  override disconnectedCallback(): void {
    this.#stop();
    this.#release();
    this.#calibrating?.cancel();
    this.#ro?.disconnect();
    this.#io?.disconnect();
    this.#mo?.disconnect();
    this.#motion?.removeEventListener?.('change', this.#onMotion);
    this.#ro = null;
    this.#io = null;
    this.#mo = null;
    this.#motion = null;
    removeEventListener('pointerdown', this.#onDown, { capture: true });
    removeEventListener('resize', this.#markStale);
    document.removeEventListener('visibilitychange', this.#onVisibility);
    this.#reset();
    // A move in the DOM reconnects at once: only a real removal ends the bridge session.
    queueMicrotask(() => {
      if (!this.isConnected) this.#bridge?.close();
    });
    super.disconnectedCallback();
  }

  /** What it pulls with now (clamped). */
  get options(): MagneticOptions {
    return magneticOptions(this.data ?? {}, (n) => this.getAttribute(n));
  }

  /** True while the physics loop is scheduled. */
  get running(): boolean {
    return this.#raf !== 0;
  }

  /** True while motion is reduced (nothing is pulled). */
  get reducedMotion(): boolean {
    return this.#reduced;
  }

  /** The element's Magnet Bridge client (created on first use) — for its frame and gesture listeners. */
  get bridge(): MagnetBridge {
    if (!this.#bridge) {
      const make = UiMagnetic.createSocket;
      const b = make ? new MagnetBridge(make) : new MagnetBridge();
      this.#bridge = b;
      b.addStateListener(this.#onBridgeState);
      b.addGestureListener(this.#onGesture);
      b.addFrameListener(this.#onFrame);
    }
    return this.#bridge;
  }

  /** The bridge's state: idle · connecting · open · closed · error. */
  get bridgeState(): BridgeState {
    return this.#bridge?.state ?? 'idle';
  }

  /** Connect to the Magnet Bridge app on this phone. Call it from a user action (a click) — it never runs on its own;
   *  Chrome asks once about local network access. Resolves true once open. */
  connect(): Promise<boolean> {
    return this.bridge.connect();
  }

  /** End the bridge session; the pointer plays the magnet again. */
  disconnect(): void {
    this.#calibrating?.cancel();
    this.#bridge?.close();
  }

  /** Take a new zero on the phone (keep magnets away for a second). */
  zero(): void {
    this.#bridge?.zero();
  }

  /**
   * Calibrate the magnet through the bridge, headless: hold it still over five spots (fractions of the viewport). Each
   * step leaves as `ui-calibration` (draw the ring at `detail.spot`, client px); resolves with the fit (already handed
   * to the phone), or null. Needs an open bridge. The pull pauses while it runs.
   */
  calibrate(spots?: Array<[number, number]>): { promise: Promise<CalibrationFit | null>; cancel: () => void } {
    const b = this.#bridge;
    if (!b || b.state !== 'open') return { promise: Promise.resolve(null), cancel: () => {} };
    this.#calibrating?.cancel();
    let last = '';
    const run = calibrate(b, {
      spots,
      onUpdate: (s) => {
        this.notify('ui-calibration', s);
        const msg = calibrationMessage(s, this.#lang);
        if (msg && msg !== last) {
          last = msg;
          this.#say(msg);
        }
      },
    });
    const handle = { cancel: run.cancel };
    this.#calibrating = handle;
    run.promise.then(() => {
      if (this.#calibrating === handle) this.#calibrating = null;
    });
    return run;
  }

  get #lang(): MagneticLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  protected render(): string {
    return '<slot></slot><span class="sr-only" role="status" aria-live="polite" part="status"></span>';
  }

  /** Rendered once: the slot and the status line stay, later renders apply the options. */
  protected override update(): void {
    if (!this.#status) {
      this.content.innerHTML = this.render();
      this.#status = this.content.querySelector<HTMLElement>('[role="status"]');
      this.content.querySelector('slot')?.addEventListener('slotchange', this.#markStale);
    }
    const prev = this.#opts;
    const o = this.options;
    this.#opts = o;
    const f = this.field;
    f.stiffness = o.stiffness;
    f.damping = o.damping;
    f.force = o.force;
    f.reach = o.reach;
    if (o.selector !== prev.selector) this.#stale = true;
    const reduced = this.#computeReduced();
    const off = reduced || !o.enabled;
    this.#reduced = reduced;
    if (off) {
      this.#stop();
      this.#release();
      this.#reset();
    }
    if (this.#bridge && this.#bridge.state !== 'idle') this.#say(this.#bridgeLine());
    this.updated();
  }

  // ── Bodies ─────────────────────────────────────────────────────────────────────────────────────────────────────

  #markStale = (): void => {
    this.#stale = true;
  };

  /** Read every body's place at rest, relative to the host (transforms cleared first, as magnetkit does). */
  #measure(): void {
    this.#stale = false;
    for (const b of this.#bodies) b.el.style.transform = '';
    const host = this.getBoundingClientRect();
    const els = Array.from(this.querySelectorAll<HTMLElement>(this.#opts.selector)).filter(
      (el) => el.getBoundingClientRect().width > 0,
    );
    const prev = new Map(this.#bodies.map((b) => [b.el, b]));
    for (const b of this.#bodies) if (!els.includes(b.el) && b.wasInline) b.el.style.removeProperty('display');
    this.#bodies = els.map((el, i) => {
      const known = prev.get(el);
      let wasInline = known?.wasInline ?? false;
      if (!known && getComputedStyle(el).display === 'inline') {
        el.style.display = 'inline-block';
        wasInline = true;
      }
      const r = el.getBoundingClientRect();
      return {
        id: String(i),
        el,
        local: {
          left: r.left - host.left,
          top: r.top - host.top,
          right: r.right - host.left,
          bottom: r.bottom - host.top,
        },
        corner: Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) || 6,
        wasInline,
      };
    });
    this.field.parts.clear();
  }

  /** Every body back in place, nothing written. */
  #reset(): void {
    for (const b of this.#bodies) {
      b.el.style.transform = '';
      if (b.wasInline) b.el.style.removeProperty('display');
    }
    this.#bodies = [];
    this.field.parts.clear();
    this.#stale = true;
  }

  // ── The loop ───────────────────────────────────────────────────────────────────────────────────────────────────

  get #pulls(): boolean {
    return !this.#reduced && this.#opts.enabled && this.isConnected;
  }

  get #bridgeLive(): boolean {
    return this.#bridge?.state === 'open';
  }

  #wake(): void {
    if (this.#raf || !this.#pulls || !this.#visible || document.hidden) return;
    this.#raf = requestAnimationFrame(this.#tick);
  }

  #stop(): void {
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#raf = 0;
  }

  #tick = (ms: number): void => {
    this.#raf = 0;
    if (!this.#pulls) return;
    const now = ms / 1000;
    const f = this.field;
    const bridgeNow = this.#bridgeLive ? this.#bridge : null;
    const magnet = bridgeNow ? !!bridgeNow.frame && bridgeNow.frame.strength > 4 : this.#held && this.#opts.pointer;
    if (magnet) this.#gone = -1;
    else if (this.#gone < 0) this.#gone = now;
    if (this.#stale && this.#settled()) this.#measure();
    const host = this.getBoundingClientRect();
    const bridge = this.#bridgeLive ? this.#bridge : null;
    // The bridge's readings are screen dp, its screen the viewport; the pointer's are client px, its screen the host.
    const o = bridge ? bridge.offset() : { x: 0, y: 0 };
    for (const b of this.#bodies) {
      f.setHome(
        b.id,
        {
          left: b.local.left + host.left + o.x,
          top: b.local.top + host.top + o.y,
          right: b.local.right + host.left + o.x,
          bottom: b.local.bottom + host.top + o.y,
        },
        b.corner,
      );
    }
    const screenBox: Box = bridge
      ? { left: o.x, top: o.y, right: o.x + innerWidth, bottom: o.y + innerHeight }
      : { left: host.left, top: host.top, right: host.right, bottom: host.bottom };
    const frame = bridge
      ? (bridge.frame ?? pointerFrame(ms, false, this.#at))
      : pointerFrame(ms, this.#held && this.#opts.pointer, this.#at);
    // Once the magnet has been gone a moment (its gate has faded), the bodies go home on their strings alone
    // (MagneticField.relax, as magnetkit does without readings): with collisions still on, a body knocked past a
    // neighbour could stay wedged behind it for good.
    const away = !magnet && now - this.#gone > RELAX_AFTER;
    if (this.#calibrating || away) f.relax(now);
    else f.step(frame, now, screenBox, bridge?.hello?.face ?? 1);
    for (const b of this.#bodies) {
      const p = f.parts.get(b.id);
      if (!p) continue;
      b.el.style.transform = p.resting
        ? ''
        : `translate(${p.ox.toFixed(2)}px, ${p.oy.toFixed(2)}px) rotate(${p.angle.toFixed(4)}rad)`;
    }
    if (magnet || !this.#settled() || (!away && f.active)) this.#raf = requestAnimationFrame(this.#tick);
  };

  /** Every body at rest in its place. */
  #settled(): boolean {
    for (const p of this.field.parts.values()) if (!p.resting) return false;
    return true;
  }

  // ── The pointer plays the magnet ───────────────────────────────────────────────────────────────────────────────

  #onDown = (e: PointerEvent): void => {
    if (!this.#pulls || !this.#opts.pointer || this.#bridgeLive || !this.#visible) return;
    const at = { x: e.clientX, y: e.clientY };
    // Out of reach (past the far band around the host): a press elsewhere on the page runs nothing.
    const r = this.getBoundingClientRect();
    const box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    if (outsideDistance(at, box) > this.field.farBand) return;
    this.#held = true;
    this.#at = at;
    // Holding the magnet is not selecting text.
    document.addEventListener('selectstart', this.#noSelect);
    addEventListener('pointermove', this.#onMove, { passive: true });
    addEventListener('pointerup', this.#onUp);
    addEventListener('pointercancel', this.#onUp);
    this.#wake();
  };

  #noSelect = (e: Event): void => {
    e.preventDefault();
  };

  #onMove = (e: PointerEvent): void => {
    this.#at = { x: e.clientX, y: e.clientY };
  };

  #onUp = (): void => {
    this.#release();
  };

  /** The magnet leaves: the loop runs on until every body is back. */
  #release(): void {
    this.#held = false;
    document.removeEventListener('selectstart', this.#noSelect);
    removeEventListener('pointermove', this.#onMove);
    removeEventListener('pointerup', this.#onUp);
    removeEventListener('pointercancel', this.#onUp);
  }

  // ── The bridge ─────────────────────────────────────────────────────────────────────────────────────────────────

  #bridgeLine(): string | null {
    const b = this.#bridge;
    if (!b) return null;
    return bridgeMessage(
      { state: b.state, version: b.version, calibrated: b.calibrated },
      this.#lang,
      this.#reduced || !this.#opts.enabled,
    );
  }

  #onBridgeState = (): void => {
    const b = this.#bridge;
    if (!b) return;
    const detail: MagnetBridgeChange = {
      state: b.state,
      device: b.device,
      version: b.version,
      calibrated: b.calibrated,
    };
    this.notify('ui-bridge-change', detail);
    this.#say(this.#bridgeLine());
    if (b.state === 'open') this.#release();
    // Leaving the bridge: the bodies settle back from wherever it left them.
    this.#wake();
  };

  #onFrame = (f: MagnetFrame): void => {
    if (f.strength > 4 || !this.#settled()) this.#wake();
  };

  #onGesture = (g: MagnetGesture): void => {
    const b = this.#bridge;
    const detail: MagnetGestureDetail =
      g.g === 'tap' ? { ...g, client: g.at && b ? b.toClient(g.at) : null } : { ...g };
    this.notify('ui-magnet-gesture', detail);
  };

  #say(text: string | null): void {
    if (!this.#status || text === null) return;
    if (this.#status.textContent !== text) this.#status.textContent = text;
  }

  // ── Motion and visibility ──────────────────────────────────────────────────────────────────────────────────────

  #computeReduced(): boolean {
    const m = motionOf(this.getAttribute('motion'));
    return m === 'reduce' || (m === 'system' && prefersReducedMotion());
  }

  #onMotion = (): void => {
    this.requestRender();
  };

  #onVisibility = (): void => {
    if (document.hidden) {
      this.#stop();
      this.#release();
    } else this.#wake();
  };
}

define('ui-magnetic', UiMagnetic);

declare global {
  interface HTMLElementTagNameMap {
    'ui-magnetic': UiMagnetic;
  }
}
