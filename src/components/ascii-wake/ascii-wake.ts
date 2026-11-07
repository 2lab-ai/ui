import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { attrs } from '../../core/html';
import { SHARED } from '../../core/tokens';
import { styles } from './styles';

/** The characters a warm cell climbs through, from cold to hot. */
export type AsciiGlyphs = 'classic' | 'blocks' | 'dots' | 'binary';
/** `cube` — the ink cube, centred and scaled to the box · `field` — the whole box, fading out at its edges (a backdrop). */
export type AsciiShape = 'cube' | 'field';
export type AsciiWakeLang = 'en' | 'ko';

export interface AsciiWakeData {
  shape?: AsciiShape;
  glyphs?: AsciiGlyphs;
  /** How long a wake takes to cool back to dots, in seconds: 0.2 … 4 (default 1.2). */
  trail?: number;
  /** How wide the hand is: 0 … 100 (default 50) — a radius of 12 … 70 px. */
  reach?: number;
  /** How far glyphs lean toward the hand: 0 … 100 (default 40). */
  pull?: number;
  /** Glyph size in px: 8 … 20 (default 10). The grid's cells follow it. */
  size?: number;
  /** The agent's own activity, 0 … 1 (default 0): slow virtual hands stir the field without a pointer. 0 is still. */
  activity?: number;
  /** The accessible name, instead of the built-in one. */
  label?: string;
  /** Hide it from assistive tech (it carries no information). */
  decorative?: boolean;
}

/** What the element draws with now: `data` first, then the attributes, each clamped to its range. */
export interface AsciiWakeOptions {
  shape: AsciiShape;
  glyphs: AsciiGlyphs;
  trail: number;
  reach: number;
  pull: number;
  size: number;
  activity: number;
}

/** A grid of `cols` × `rows` cells of `cw` × `ch` px, centred in its box at (`ox`, `oy`). Odd rows sit half a cell right. */
export interface AsciiGrid {
  cols: number;
  rows: number;
  cw: number;
  ch: number;
  ox: number;
  oy: number;
}

const STRINGS = {
  en: { label: 'A field of dots stirred by the pointer' },
  ko: { label: '포인터에 반응하는 점 무늬' },
};

const RAMPS: Readonly<Record<AsciiGlyphs, readonly string[]>> = Object.freeze({
  classic: Object.freeze([' ', '.', ':', '-', '=', '+', '*', '#', '%', '@']),
  blocks: Object.freeze([' ', '·', '░', '▒', '▓', '█']),
  dots: Object.freeze([' ', '·', '•', '●']),
  binary: Object.freeze([' ', '.', ':', '0', '1']),
});

/** bencho's frame: the cube is drawn for 360 × 240 and scaled from there. */
const FRAME_W = 360;
const FRAME_H = 240;
/** The cube's edge, and half its width (an isometric hexagon 2·cos 30°·edge wide, 2·edge tall). */
const EDGE = 112;
const HALF_W = Math.cos(Math.PI / 6) * EDGE;
/** A cell this warm or less draws as a dot; heat under COLD is zero. */
const WARM = 0.04;
const COLD = 0.003;
/** `near` this close to where the hand is counts as settled. */
const SETTLE = 0.004;
const RING_LIFE = 2.2;
const RING_BAND = 24;
const MAX_RINGS = 8;
/** Heat a virtual hand lays per second at full activity (a still hand would settle at 1.5 × activity × trail). */
const HAND_RATE = 4.5;
const HANDS = 3;
/** The virtual hands' Lissajous paths: x and y frequency (rad/s), x and y phase — one row per hand. */
const PATHS = [0.31, 0.47, 0, 1.1, 0.23, 0.37, 2.1, 4, 0.41, 0.19, 4.2, 0.4];
/** A touch that moves farther than this before it lifts was a drag, not a press. */
const TAP_SLOP = 12;
const TAU = Math.PI * 2;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** A positive finite number, else 0 (NaN included). */
const pos = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);

function num(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? clamp(n, lo, hi) : dflt;
}

function glyphsOf(v: unknown): AsciiGlyphs {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return Object.hasOwn(RAMPS, s) ? (s as AsciiGlyphs) : 'classic';
}

/** The ramp for a name (classic · blocks · dots · binary, any case); anything else is classic. Index 0 is blank. */
export function asciiRamp(name: unknown): readonly string[] {
  return RAMPS[glyphsOf(name)];
}

// Scratch for the face test: written by `face`, read right after (layout time only).
let fu = 0;
let fv = 0;
/** (x, y) in the basis a, b from origin o: true when it falls on that parallelogram. */
function face(x: number, y: number, ox: number, oy: number, ax: number, ay: number, bx: number, by: number): boolean {
  const det = ax * by - ay * bx;
  const qx = x - ox;
  const qy = y - oy;
  fu = (qx * by - qy * bx) / det;
  fv = (ax * qy - ay * qx) / det;
  return fu >= 0 && fu <= 1 && fv >= 0 && fv <= 1;
}

/**
 * The cube's ink at (x, y) from its centre, in bencho's units (edge 112): 0 outside, 1 on its edges, and between
 * 0.35 and 1 on the three faces, each shaded its own way. `light` says the ink is light (a dark page): the top face
 * then reads brightest; on dark ink it reads faintest, so the lit face looks lit on either theme.
 */
export function asciiCubeMask(x: number, y: number, light: boolean): number {
  const shade = (v: number) => 0.35 + 0.65 * clamp(light ? v : 1.09 - v, 0, 1);
  const edge = (v: number) => v < 0.045;
  // Top: from the top corner along the two upper edges, meeting at the centre.
  if (face(x, y, 0, -EDGE, HALF_W, EDGE / 2, -HALF_W, EDGE / 2)) {
    return edge(1 - fu) || edge(1 - fv) ? 1 : shade(0.96 - (0.1 * (fu + fv)) / 2);
  }
  // Left: from the upper-left corner toward the centre and down.
  if (face(x, y, -HALF_W, -EDGE / 2, HALF_W, EDGE / 2, 0, EDGE)) return edge(fu) ? 1 : shade(0.56 - 0.12 * fv);
  // Right: from the centre toward the upper-right corner and down.
  if (face(x, y, 0, 0, HALF_W, -EDGE / 2, 0, EDGE)) return edge(fu) || edge(fv) ? 1 : shade(0.13 - 0.05 * fu);
  return 0;
}

/** The field's ink at (x, y) of a w × h box: 1 inside, easing to 0 over the last stretch to each edge; 0 outside. */
export function asciiFieldMask(x: number, y: number, w: number, h: number): number {
  if (!(w > 0 && h > 0) || !(x >= 0 && x <= w && y >= 0 && y <= h)) return 0;
  const fade = Math.max(1, Math.min(48, Math.min(w, h) * 0.25));
  const ease = (d: number) => {
    const t = Math.min(1, d / fade);
    return t * t * (3 - 2 * t);
  };
  return ease(Math.min(x, w - x)) * ease(Math.min(y, h - y));
}

/**
 * The cells for a w × h box at a glyph size: each 0.62 × 0.82 of the size, as many as fit with the odd rows' half-cell
 * shift — the staggered block (cols + ½ cells wide) centred in the box, so both row kinds sit inside it.
 */
export function asciiGrid(w: number, h: number, size: number): AsciiGrid {
  const cw = size * 0.62;
  const ch = size * 0.82;
  const ok = w > 0 && h > 0 && size > 0 && Number.isFinite(w + h + size);
  const cols = ok ? Math.max(0, Math.floor(w / cw - 0.5)) : 0;
  const rows = ok ? Math.max(0, Math.floor(h / ch)) : 0;
  return { cols, rows, cw, ch, ox: cols ? (w - (cols + 0.5) * cw) / 2 : 0, oy: rows ? (h - rows * ch) / 2 : 0 };
}

/** A cell's heat after `dt` seconds: it cools by e^(−3·dt/trail); under 0.003 it is cold (0). */
export function asciiCool(heat: number, dt: number, trail: number): number {
  const n = heat * Math.exp((-Math.max(0, dt) * 3) / Math.max(0.1, trail));
  return n < COLD ? 0 : n;
}

const ringRadius = (t: number) => 8 + (1 - (1 - t) ** 3) * 260;
const ringAmp = (t: number) => 0.6 * (1 - t) ** 2 * Math.min(1, t * 6);

/** A press's ring at `t` (0 … 1 of its 2.2 s): the radius it has reached (8 → 268 px) and how much heat it carries. */
export function asciiRing(t: number): { R: number; amp: number } {
  const p = clamp(Number.isFinite(t) ? t : 1, 0, 1);
  return { R: ringRadius(p), amp: ringAmp(p) };
}

/** A hash of a cell and the current deal, in [0, 1): the dither that jitters a warm cell's glyph. */
export function asciiHash(i: number, deal: number): number {
  let n = (i * 374761393 + deal * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/**
 * The glyph a cell draws: its heat up the ramp (index 1 … length − 1), jittered by `dither` (0 … 1) once it is warm.
 * Index 1 — and any cell at 0.04 or less — draws as a dot.
 */
export function asciiGlyphIndex(heat: number, rampLength: number, dither: number): number {
  const top = Math.max(1, Math.floor(rampLength) - 1);
  const h = Number.isNaN(heat) ? 0 : Math.max(0, heat);
  let x = Math.min(1, h) * top + 0.5;
  if (h > WARM && Number.isFinite(dither)) x += (dither - 0.5) * 1.6 * Math.min(1, h * 2);
  return clamp(Math.floor(x), 1, top);
}

/** The red, green and blue (0 … 255) of a computed colour: hex, rgb(), color(srgb …); lab-like ones by lightness. */
function channels(color: string): [number, number, number] | null {
  const s = color.trim().toLowerCase();
  const hex = /^#([\da-f]{3,8})$/.exec(s)?.[1];
  if (hex) {
    if (hex.length === 5 || hex.length === 7) return null;
    const short = hex.length < 6;
    const at = (i: number) => Number.parseInt(short ? hex[i] + hex[i] : hex.slice(i * 2, i * 2 + 2), 16);
    return [at(0), at(1), at(2)];
  }
  const fn = /^([a-z-]+)\((.*)\)$/.exec(s);
  if (!fn) return null;
  // color(display-p3 …): the space's name may hold digits — the channels come after it.
  const args = fn[1] === 'color' ? fn[2].trim().replace(/^[\w-]+\s+/, '') : fn[2];
  const nums = args.match(/-?\d*\.?\d+(?:e-?\d+)?%?/g);
  if (!nums || nums.length < 3) return null;
  const v = (i: number, full: number) => {
    const t = nums[i];
    return t.endsWith('%') ? (Number.parseFloat(t) / 100) * full : Number.parseFloat(t);
  };
  if (fn[1] === 'rgb' || fn[1] === 'rgba') return [v(0, 255), v(1, 255), v(2, 255)];
  if (fn[1] === 'color') return [v(0, 1) * 255, v(1, 1) * 255, v(2, 1) * 255];
  // oklch / oklab (L 0 … 1) and lab / lch (L 0 … 100): a grey of that lightness is close enough for light-or-dark.
  const grey = (g: number): [number, number, number] => [g, g, g];
  if (fn[1] === 'oklch' || fn[1] === 'oklab') return grey(clamp(v(0, 1), 0, 1) * 255);
  if (fn[1] === 'lch' || fn[1] === 'lab') return grey(clamp(v(0, 100) / 100, 0, 1) * 255);
  return null;
}

/** True when a computed colour is light ink (r·.299 + g·.587 + b·.114 > 128) — the page behind it is dark. */
export function asciiLightInk(color: string): boolean {
  const c = channels(String(color ?? ''));
  return !!c && c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114 > 128;
}

function context2d(c: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  try {
    return c?.getContext?.('2d') ?? null;
  } catch {
    return null;
  }
}

/**
 * `<ui-ascii-wake>` — a quiet field of ink dots, a cube by default or the whole box as a backdrop. The pointer drags
 * a wake through it: cells under the hand warm into characters (`glyphs`), thicken toward its centre, lean toward it
 * (`pull`) and cool back to dots behind it (`trail`); a press sends a ring out. `activity` (0 … 1) lets the agent's
 * own work stir it with slow virtual hands — bind it to the live run's token rate. Attributes or `data`.
 *
 * One canvas in the shadow root, sized to the content box × devicePixelRatio (2 at most). The frame loop runs only
 * while something is warm, a ring is out, the hand is settling or activity is above 0 — never while offscreen or the
 * tab is hidden — and allocates nothing. The ink is the host's `color`, read once and again only when the theme may
 * have changed. Under reduced motion it is one still frame. role="img" with a name, or hidden with `decorative`.
 *
 * Ported from bencho.dev's “ASCII wake” (MIT, © 2026 Lorenzo Cabra — https://bencho.dev/blocks/ascii-wake).
 */
export class UiAsciiWake extends UiElement<AsciiWakeData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return [
      'shape',
      'glyphs',
      'trail',
      'reach',
      'pull',
      'size',
      'activity',
      'label',
      'decorative',
      'lang',
      'theme',
      'style',
      'class',
    ];
  }

  #field: HTMLElement | null = null;
  #canvas: HTMLCanvasElement | null = null;
  #ctx: CanvasRenderingContext2D | null = null;
  #opts: AsciiWakeOptions = {
    shape: 'cube',
    glyphs: 'classic',
    trail: 1.2,
    reach: 50,
    pull: 40,
    size: 10,
    activity: 0,
  };
  // The box (CSS px), the backing scale and the grid.
  #w = 0;
  #h = 0;
  #ratio = 1;
  #cols = 0;
  #rows = 0;
  #cw = 0;
  #ch = 0;
  #ox = 0;
  #oy = 0;
  #heat = new Float32Array(0);
  #mask = new Float32Array(0);
  #stale = true;
  // The ink, read from the computed style only when the theme may have changed.
  #ink = 'currentColor';
  #mono = '';
  #font = '';
  #light = false;
  #inkStale = true;
  // The hand.
  #hx = -999;
  #hy = -999;
  #lx = Number.NaN;
  #ly = Number.NaN;
  #px = 0;
  #py = 0;
  #near = 0;
  #inside = false;
  #tap = -1;
  #tapX = 0;
  #tapY = 0;
  // Rings: position, age (s), and this frame's radius and heat.
  #ringX = new Float32Array(MAX_RINGS);
  #ringY = new Float32Array(MAX_RINGS);
  #ringAge = new Float32Array(MAX_RINGS);
  #ringR = new Float32Array(MAX_RINGS);
  #ringA = new Float32Array(MAX_RINGS);
  #rings = 0;
  // Virtual hands: where each was last frame (NaN: not out), and their own clock.
  #handX = new Float32Array(HANDS).fill(Number.NaN);
  #handY = new Float32Array(HANDS).fill(Number.NaN);
  #clock = 0;
  // The loop.
  #raf = 0;
  #t = 0;
  #hot = 0;
  #deal = 0;
  #tick = 0;
  #visible = true;
  #reduced = false;
  #ro: ResizeObserver | null = null;
  #io: IntersectionObserver | null = null;
  #mo: MutationObserver | null = null;
  #scheme: MediaQueryList | null = null;
  #motion: MediaQueryList | null = null;

  constructor() {
    super();
    this.addEventListener('pointerenter', this.#onEnter);
    this.addEventListener('pointermove', this.#onMove);
    this.addEventListener('pointerleave', this.#onLeave);
    this.addEventListener('pointercancel', this.#onCancel);
    this.addEventListener('pointerdown', this.#onDown);
    this.addEventListener('pointerup', this.#onUp);
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if (old === value) return;
    if (name === 'theme' || name === 'style' || name === 'class') this.#inkStale = true;
    this.requestRender();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#reduced = prefersReducedMotion();
    this.#visible = true;
    this.#inkStale = true;
    if (typeof ResizeObserver === 'function') {
      this.#ro = new ResizeObserver((entries) => {
        const box = entries[entries.length - 1]?.contentRect;
        if (box) this.#resize(box.width, box.height);
      });
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
      this.#mo = new MutationObserver(this.#onTheme);
      const watch = { attributes: true, attributeFilter: ['data-theme', 'data-palette', 'data-design'] };
      this.#mo.observe(document.documentElement, watch);
      const near = this.parentElement?.closest('[data-theme], [data-design]');
      if (near && near !== document.documentElement) this.#mo.observe(near, watch);
    }
    if (typeof matchMedia === 'function') {
      this.#scheme = matchMedia('(prefers-color-scheme: dark)');
      this.#scheme.addEventListener?.('change', this.#onTheme);
      this.#motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.#motion.addEventListener?.('change', this.#onMotion);
    }
    document.addEventListener('visibilitychange', this.#onVisibility);
  }

  override disconnectedCallback(): void {
    this.#stop();
    this.#ro?.disconnect();
    this.#io?.disconnect();
    this.#mo?.disconnect();
    this.#scheme?.removeEventListener?.('change', this.#onTheme);
    this.#motion?.removeEventListener?.('change', this.#onMotion);
    this.#ro = null;
    this.#io = null;
    this.#mo = null;
    this.#scheme = null;
    this.#motion = null;
    document.removeEventListener('visibilitychange', this.#onVisibility);
    this.#inside = false;
    this.#near = 0;
    this.#lx = Number.NaN;
    this.#tap = -1;
    super.disconnectedCallback();
  }

  /** What it draws with, from `data` first, then the attributes — each clamped to its range. */
  get options(): AsciiWakeOptions {
    const d = this.data ?? {};
    const a = (n: string) => this.getAttribute(n);
    const shape = String(d.shape ?? a('shape') ?? '')
      .trim()
      .toLowerCase();
    return {
      shape: shape === 'field' ? 'field' : 'cube',
      glyphs: glyphsOf(d.glyphs ?? a('glyphs')),
      trail: num(d.trail ?? a('trail'), 0.2, 4, 1.2),
      reach: num(d.reach ?? a('reach'), 0, 100, 50),
      pull: num(d.pull ?? a('pull'), 0, 100, 40),
      size: num(d.size ?? a('size'), 8, 20, 10),
      activity: num(d.activity ?? a('activity'), 0, 1, 0),
    };
  }

  /** True while the frame loop is scheduled. */
  get running(): boolean {
    return this.#raf !== 0;
  }

  get #lang(): AsciiWakeLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  #a11y(): Record<string, string | null> {
    const d = this.data ?? {};
    if (d.decorative ?? this.hasAttribute('decorative'))
      return { role: null, 'aria-label': null, 'aria-hidden': 'true' };
    const own = String(d.label ?? this.getAttribute('label') ?? '').trim();
    return { role: 'img', 'aria-label': own || STRINGS[this.#lang].label, 'aria-hidden': null };
  }

  protected render(): string {
    return `<div class="aw" part="field"${attrs(this.#a11y())}><canvas class="aw-canvas" part="canvas" aria-hidden="true"></canvas></div>`;
  }

  /** The canvas is drawn once and kept: later renders patch the name and the options, never the node. */
  protected override update(): void {
    if (!this.#field) {
      this.content.innerHTML = this.render();
      this.#field = this.content.querySelector<HTMLElement>('.aw');
      this.#canvas = this.content.querySelector('canvas');
      this.#ctx = context2d(this.#canvas);
      this.#stale = true;
    } else {
      for (const [k, v] of Object.entries(this.#a11y())) {
        if (v === null) this.#field.removeAttribute(k);
        else if (this.#field.getAttribute(k) !== v) this.#field.setAttribute(k, v);
      }
    }
    const prev = this.#opts;
    const next = this.options;
    this.#opts = next;
    if (next.size !== prev.size || next.shape !== prev.shape) this.#stale = true;
    if (this.#inkStale) this.#readInk();
    if (!this.#ro) this.#resize(this.clientWidth, this.clientHeight);
    const relaid = this.#stale;
    if (relaid) this.#layout();
    if (this.#reduced) this.#still();
    else if (next.activity > 0) this.#start();
    if (relaid || !this.#raf) this.#draw();
    this.updated();
  }

  // ── Ink and layout ─────────────────────────────────────────────────────────

  #readInk(): void {
    this.#inkStale = false;
    let color = '';
    let mono = '';
    try {
      const cs = getComputedStyle(this);
      color = cs.color;
      mono = cs.getPropertyValue('--mono').trim();
    } catch {
      // Not styled yet: keep currentColor and the token stack.
    }
    this.#ink = color || 'currentColor';
    mono ||= SHARED.mono;
    const light = asciiLightInk(color);
    if (light !== this.#light || mono !== this.#mono) {
      this.#light = light;
      this.#mono = mono;
      this.#stale = true;
    }
  }

  #resize(w: number, h: number): void {
    w = pos(w);
    h = pos(h);
    if (w === this.#w && h === this.#h) return;
    this.#w = w;
    this.#h = h;
    this.#handX.fill(Number.NaN);
    this.#layout();
    // Resizing cleared the canvas: draw now, not on the next frame (a running loop would show one blank frame).
    this.#draw();
  }

  /** The backing store, the grid and each cell's mask. Heat survives unless the grid changed. */
  #layout(): void {
    this.#stale = false;
    const { size, shape } = this.#opts;
    const w = this.#w;
    const h = this.#h;
    const dpr = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;
    this.#ratio = Math.min(2, dpr);
    const c = this.#canvas;
    if (c) {
      const pw = Math.round(w * this.#ratio);
      const ph = Math.round(h * this.#ratio);
      if (c.width !== pw) c.width = pw;
      if (c.height !== ph) c.height = ph;
    }
    const g = asciiGrid(w, h, size);
    const regrid = g.cols !== this.#cols || g.rows !== this.#rows || g.cw !== this.#cw;
    this.#cols = g.cols;
    this.#rows = g.rows;
    this.#cw = g.cw;
    this.#ch = g.ch;
    this.#ox = g.ox;
    this.#oy = g.oy;
    const n = g.cols * g.rows;
    if (this.#heat.length !== n) {
      this.#heat = new Float32Array(n);
      this.#mask = new Float32Array(n);
      this.#hot = 0;
    } else if (regrid) {
      this.#heat.fill(0);
      this.#hot = 0;
    }
    this.#font = `500 ${size}px ${this.#mono || SHARED.mono}`;
    const s = Math.min(w / FRAME_W, h / FRAME_H);
    for (let r = 0; r < g.rows; r++) {
      const y = g.oy + (r + 0.5) * g.ch;
      for (let col = 0; col < g.cols; col++) {
        const x = g.ox + (col + 0.5 + (r & 1) * 0.5) * g.cw;
        this.#mask[r * g.cols + col] =
          shape === 'field'
            ? asciiFieldMask(x, y, w, h)
            : s > 0
              ? asciiCubeMask((x - w / 2) / s, (y - h / 2) / s, this.#light)
              : 0;
      }
    }
  }

  // ── Heat ───────────────────────────────────────────────────────────────────

  #radius(): number {
    return 12 + (this.#opts.reach / 100) * 58;
  }

  /** Warm the cells within R of (x, y) by amount · (1 − d²)², capped at 1. */
  #stamp(x: number, y: number, R: number, amount: number): void {
    const cols = this.#cols;
    const rows = this.#rows;
    if (!cols || !rows || !(R > 0)) return;
    const cw = this.#cw;
    const ch = this.#ch;
    const heat = this.#heat;
    const lx = x - this.#ox;
    const ly = y - this.#oy;
    const r0 = Math.max(0, Math.floor((ly - R) / ch));
    const r1 = Math.min(rows - 1, Math.ceil((ly + R) / ch));
    const c0 = Math.max(0, Math.floor((lx - R) / cw) - 1);
    const c1 = Math.min(cols - 1, Math.ceil((lx + R) / cw));
    const R2 = R * R;
    for (let r = r0; r <= r1; r++) {
      const dy = (r + 0.5) * ch - ly;
      const shift = (r & 1) * 0.5;
      for (let c = c0; c <= c1; c++) {
        const dx = (c + 0.5 + shift) * cw - lx;
        const d = (dx * dx + dy * dy) / R2;
        if (d >= 1) continue;
        const f = 1 - d;
        const i = r * cols + c;
        heat[i] = Math.min(1, heat[i] + amount * f * f);
      }
    }
  }

  /** Stamp along a path in steps of R/3; `spread` shares `amount` across the steps (a hand laying heat per second). */
  #sweep(x0: number, y0: number, x1: number, y1: number, R: number, amount: number, spread: boolean): void {
    if (Number.isNaN(x0) || Number.isNaN(y0)) {
      x0 = x1;
      y0 = y1;
    }
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (R / 3)));
    const each = spread ? amount / steps : amount;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      this.#stamp(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, R, each);
    }
  }

  /** The agent's hands: two (three past half activity) on slow Lissajous paths, laying heat in proportion to it. */
  #stir(dt: number, activity: number): void {
    if (!this.#cols) return;
    this.#clock += dt * (0.5 + activity);
    const T = this.#clock;
    const w = this.#w;
    const h = this.#h;
    let ax = w * 0.4;
    let ay = h * 0.34;
    if (this.#opts.shape === 'cube') {
      const s = Math.min(w / FRAME_W, h / FRAME_H);
      ax = HALF_W * s * 0.72;
      ay = EDGE * s * 0.72;
    }
    const R = this.#radius();
    const count = activity > 0.5 ? 3 : 2;
    const amount = HAND_RATE * activity * dt;
    for (let k = 0; k < HANDS; k++) {
      if (k >= count) {
        this.#handX[k] = Number.NaN;
        continue;
      }
      const p = k * 4;
      const x = w / 2 + ax * Math.sin(PATHS[p] * T + PATHS[p + 2]);
      const y = h / 2 + ay * Math.sin(PATHS[p + 1] * T + PATHS[p + 3]);
      this.#sweep(this.#handX[k], this.#handY[k], x, y, R, amount, true);
      this.#handX[k] = x;
      this.#handY[k] = y;
    }
  }

  // ── The loop ───────────────────────────────────────────────────────────────

  #canRun(): boolean {
    return (
      this.isConnected &&
      this.#visible &&
      !this.#reduced &&
      !(typeof document !== 'undefined' && document.hidden) &&
      typeof requestAnimationFrame === 'function'
    );
  }

  /** Something still moves: a warm cell, a ring, a hand settling, or the agent at work. */
  #busy(): boolean {
    return (
      this.#hot > 0 ||
      this.#rings > 0 ||
      Math.abs(Number(this.#inside) - this.#near) >= SETTLE ||
      this.#opts.activity > 0
    );
  }

  #start(): void {
    if (this.#raf || !this.#canRun()) return;
    this.#t = performance.now();
    this.#raf = requestAnimationFrame(this.#frame);
  }

  #stop(): void {
    if (this.#raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.#raf);
    this.#raf = 0;
  }

  /** Back on screen or in a shown tab: pick up where it was, if anything still moves. */
  #wake(): void {
    if (this.#busy()) this.#start();
  }

  #frame = (now: number): void => {
    this.#raf = 0;
    const dt = Math.min(0.05, Math.max(0, (now - this.#t) / 1000));
    this.#t = now;
    const o = this.#opts;
    if (o.activity > 0) this.#stir(dt, o.activity);
    // asciiCool, with the factor taken once for the frame.
    const k = Math.exp((-dt * 3) / Math.max(0.1, o.trail));
    const heat = this.#heat;
    let hot = 0;
    for (let i = 0; i < heat.length; i++) {
      const n = heat[i] * k;
      const v = n < COLD ? 0 : n;
      heat[i] = v;
      if (v > hot) hot = v;
    }
    this.#hot = hot;
    for (let i = 0; i < this.#rings; ) {
      const age = this.#ringAge[i] + dt;
      if (age < RING_LIFE) {
        this.#ringAge[i++] = age;
        continue;
      }
      const last = --this.#rings;
      this.#ringX[i] = this.#ringX[last];
      this.#ringY[i] = this.#ringY[last];
      this.#ringAge[i] = this.#ringAge[last];
    }
    this.#near += (Number(this.#inside) - this.#near) * (1 - 0.004 ** dt);
    this.#tick += dt;
    if (this.#tick > 0.07) {
      this.#tick = 0;
      this.#deal++;
    }
    this.#draw();
    if (this.#busy() && this.#canRun()) this.#raf = requestAnimationFrame(this.#frame);
  };

  /** Motion reduced: no wake, no ring, no stirring — the cold mask, still. */
  #still(): void {
    this.#stop();
    this.#heat.fill(0);
    this.#hot = 0;
    this.#rings = 0;
    this.#near = 0;
    this.#inside = false;
    this.#lx = Number.NaN;
    this.#tap = -1;
    this.#handX.fill(Number.NaN);
  }

  #draw(): void {
    const ctx = this.#ctx;
    if (!ctx) return;
    ctx.setTransform(this.#ratio, 0, 0, this.#ratio, 0, 0);
    ctx.clearRect(0, 0, this.#w, this.#h);
    const cols = this.#cols;
    const rows = this.#rows;
    if (!cols || !rows) return;
    const o = this.#opts;
    const ramp = RAMPS[o.glyphs];
    const len = ramp.length;
    const cw = this.#cw;
    const ch = this.#ch;
    const ox = this.#ox;
    const oy = this.#oy;
    const heat = this.#heat;
    const mask = this.#mask;
    const near = this.#near;
    const hx = this.#hx;
    const hy = this.#hy;
    const deal = this.#deal;
    const pull = (o.pull / 100) * near;
    const R = this.#radius();
    const R2 = R * R;
    const P2 = 4 * R2;
    const dot = Math.min(cw, ch) * 0.44;
    const rings = this.#rings;
    for (let k = 0; k < rings; k++) {
      const t = Math.min(1, this.#ringAge[k] / RING_LIFE);
      this.#ringR[k] = ringRadius(t);
      this.#ringA[k] = ringAmp(t);
    }
    ctx.fillStyle = this.#ink;
    ctx.font = this.#font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 1;
    // Every dot goes in one path, filled once at the end; glyphs are drawn as they come.
    ctx.beginPath();
    for (let r = 0; r < rows; r++) {
      const y = oy + (r + 0.5) * ch;
      const shift = (r & 1) * 0.5;
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const m = mask[i];
        if (m <= 0) continue;
        const x = ox + (c + 0.5 + shift) * cw;
        let e = heat[i];
        if (near > 0.002) {
          const dx = x - hx;
          const dy = y - hy;
          const t = (dx * dx + dy * dy) / R2;
          if (t < 1) e = Math.max(e, 0.95 * near * (1 - t) * (1 - t));
        }
        for (let k = 0; k < rings; k++) {
          const dx = x - this.#ringX[k];
          const dy = y - this.#ringY[k];
          const b = (Math.sqrt(dx * dx + dy * dy) - this.#ringR[k]) / RING_BAND;
          if (b > -2.5 && b < 2.5) e += this.#ringA[k] * Math.exp(-b * b);
        }
        e *= 0.55 + 0.45 * m;
        const g = asciiGlyphIndex(e, len, e > WARM ? asciiHash(i, deal) : 0.5);
        let px = x;
        let py = y;
        if (pull > 0.002) {
          const dx = hx - px;
          const dy = hy - py;
          const d2 = dx * dx + dy * dy;
          if (d2 < P2) {
            const f = 1 - d2 / P2;
            const d = Math.sqrt(d2) || 1;
            const a = Math.min(d * 0.6, 14 * pull * f * f);
            px += (dx / d) * a;
            py += (dy / d) * a;
          }
        }
        if (e <= WARM || g === 1) {
          const rad = Math.max(0.45, dot * Math.sqrt(m));
          ctx.moveTo(px + rad, py);
          ctx.arc(px, py, rad, 0, TAU);
          continue;
        }
        ctx.fillText(ramp[g], px, py);
      }
    }
    ctx.fill();
  }

  // ── The pointer ────────────────────────────────────────────────────────────

  /** The event's point in the box's CSS px, into #px / #py. */
  #point(e: PointerEvent): boolean {
    const box = (this.#canvas ?? this).getBoundingClientRect();
    const x = e.clientX - box.left;
    const y = e.clientY - box.top;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    this.#px = x;
    this.#py = y;
    return true;
  }

  #onEnter = (e: PointerEvent): void => {
    this.#lx = Number.NaN;
    this.#onMove(e);
  };

  #onMove = (e: PointerEvent): void => {
    if (this.#reduced || !this.#point(e)) return;
    const x = this.#px;
    const y = this.#py;
    this.#sweep(this.#lx, this.#ly, x, y, this.#radius(), 0.5, false);
    this.#lx = x;
    this.#ly = y;
    this.#hx = x;
    this.#hy = y;
    this.#inside = true;
    this.#start();
  };

  #onLeave = (): void => {
    this.#inside = false;
    this.#lx = Number.NaN;
    if (!this.#reduced) this.#start();
  };

  /** The browser took a touch for a scroll: the hand has left, and it was no press. */
  #onCancel = (): void => {
    this.#tap = -1;
    this.#onLeave();
  };

  /** A mouse or pen press sends a ring at once; a touch waits to lift, so a scroll that starts here sends none. */
  #onDown = (e: PointerEvent): void => {
    if (this.#reduced || !this.#point(e)) return;
    if (e.pointerType === 'touch') {
      this.#tap = e.pointerId;
      this.#tapX = this.#px;
      this.#tapY = this.#py;
      return;
    }
    this.#ring(e);
  };

  #onUp = (e: PointerEvent): void => {
    if (this.#tap === -1 || e.pointerId !== this.#tap) return;
    this.#tap = -1;
    if (this.#reduced || !this.#point(e) || Math.hypot(this.#px - this.#tapX, this.#py - this.#tapY) > TAP_SLOP) return;
    this.#ring(e);
  };

  #ring(e: PointerEvent): void {
    let i = this.#rings;
    if (i === MAX_RINGS) {
      // Full: the oldest ring gives way.
      i = 0;
      for (let k = 1; k < MAX_RINGS; k++) if (this.#ringAge[k] > this.#ringAge[i]) i = k;
    } else this.#rings++;
    this.#ringX[i] = this.#px;
    this.#ringY[i] = this.#py;
    this.#ringAge[i] = 0;
    this.#start();
    this.sound('tap', { emphasis: 'subtle' }, e);
  }

  // ── Page signals ───────────────────────────────────────────────────────────

  #onTheme = (): void => {
    this.#inkStale = true;
    this.requestRender();
  };

  #onMotion = (): void => {
    this.#reduced = prefersReducedMotion();
    if (this.#reduced) this.#still();
    this.requestRender();
  };

  #onVisibility = (): void => {
    if (document.hidden) this.#stop();
    else this.#wake();
  };
}

define('ui-ascii-wake', UiAsciiWake);

declare global {
  interface HTMLElementTagNameMap {
    'ui-ascii-wake': UiAsciiWake;
  }
}
