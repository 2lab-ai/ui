import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { attrs, esc } from '../../core/html';
import { type OrbTint, paintFrame } from './engine/core';
import { resolvePreset } from './engine/presets';
import { type ModeOpts, scaleCounts, scaleRadii } from './engine/profiles';
import { MODE_FRAMES } from './engine/registry';
import type { ModeFrame, OrbSize, OrbState } from './engine/types';
import { styles } from './styles';
import { composedContains, resolveSubstrate, type Substrate } from './theme';

export type { ModeOpts } from './engine/profiles';
export type { ModeFrame, OrbSize, OrbState } from './engine/types';

/** One of the nine states (the orb's own name for `OrbState`). */
export type ThinkingOrbState = OrbState;
export type ThinkingOrbTheme = 'auto' | 'dark' | 'light';
/** `system` follows prefers-reduced-motion · `reduce` always the still frame · `full` always moves. */
export type ThinkingOrbMotion = 'system' | 'reduce' | 'full';
export type ThinkingOrbLang = 'en' | 'ko';

/** The React props of `<ThinkingOrb>`, one to one (aria-label → label), plus `decorative` and `motion`. */
export interface ThinkingOrbData {
  /** Which animation (default 'working'). */
  state?: OrbState;
  /** The tuned preset: 64 (default) · 32 · 20 CSS px. Any other number snaps to the nearest. */
  size?: OrbSize;
  /** 'auto' (default) follows the page; 'dark' draws light ink, 'light' dark ink. */
  theme?: ThinkingOrbTheme;
  /** Multiplier on the preset's baked speed, 0 … 10 (default 1). */
  speed?: number;
  /** Freeze on the current frame. */
  paused?: boolean;
  /** Ink tint: #rgb, #rrggbb or rgb(); the depth ramp is kept on it. Unset: grayscale. */
  color?: string;
  /** Density multiplier for the mode's counts, 0.1 … 4 (default 1). */
  dots?: number;
  /** Radius multiplier for every dot, 0.1 … 4 (default 1). */
  dotSize?: number;
  /** Advanced: the engine's raw draw options, merged last over the preset (numbers only). */
  opts?: ModeOpts;
  /** Escape hatch: replace the state's geometry with your own `(size, t, opts) => frame`. */
  frame?: ModeFrame;
  /** The accessible label, instead of the per-state one. */
  label?: string;
  /** Hide it from assistive tech (something else on the page already says what is happening). */
  decorative?: boolean;
  /** 'system' (default) · 'reduce' · 'full'. */
  motion?: ThinkingOrbMotion;
}

/** What the element draws with now: `data` first, then the attributes, each clamped. */
export interface ThinkingOrbOptions {
  state: OrbState;
  size: OrbSize;
  theme: ThinkingOrbTheme;
  motion: ThinkingOrbMotion;
  speed: number;
  paused: boolean;
  color: string;
  dots: number;
  dotSize: number;
}

export const ORB_STATES: readonly OrbState[] = Object.freeze([
  'working',
  'searching',
  'solving',
  'listening',
  'connecting',
  'weaving',
  'composing',
  'breathing',
  'shaping',
]);
export const ORB_SIZES: readonly OrbSize[] = Object.freeze([64, 32, 20]);

/** The per-state label: upstream's English, and Korean. */
export const STRINGS: Readonly<Record<ThinkingOrbLang, Readonly<Record<OrbState, string>>>> = Object.freeze({
  en: Object.freeze({
    working: 'Working…',
    searching: 'Searching…',
    solving: 'Solving…',
    listening: 'Listening…',
    connecting: 'Connecting…',
    weaving: 'Weaving…',
    composing: 'Composing…',
    breathing: 'Thinking…',
    shaping: 'Shaping…',
  }),
  ko: Object.freeze({
    working: '작업 중…',
    searching: '검색 중…',
    solving: '해결 중…',
    listening: '듣는 중…',
    connecting: '연결 중…',
    weaving: '엮는 중…',
    composing: '작성 중…',
    breathing: '생각 중…',
    shaping: '다듬는 중…',
  }),
});

/** The instant a still orb shows (upstream's reduced-motion frame). */
export const STILL_T = 0.6;

/**
 * The neutral state when nothing more is known about what the agent is doing: breathing — a ring slowly morphing,
 * labelled “Thinking…” (upstream's own word for it). The element's own default stays upstream's `working`.
 */
export const ORB_THINKING_STATE: OrbState = 'breathing';

/** A state name (any case, trimmed), or `fallback` (the thinking state) for anything else. */
export function orbStateOf(v: unknown, fallback: OrbState = ORB_THINKING_STATE): OrbState {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return (ORB_STATES as readonly string[]).includes(s) ? (s as OrbState) : fallback;
}

/**
 * An agent's tool → the orb state that pictures it. Reading and looking things up search; editing composes; a shell
 * works; handing work to another agent weaves; planning the todo list shapes. `mcp__*` tools connect (see
 * `orbStateForTool`); anything else is the thinking state.
 */
export const ORB_TOOL_STATES: Readonly<Record<string, OrbState>> = Object.freeze({
  Read: 'searching',
  Grep: 'searching',
  Glob: 'searching',
  LS: 'searching',
  NotebookRead: 'searching',
  WebSearch: 'searching',
  WebFetch: 'searching',
  Edit: 'composing',
  Write: 'composing',
  MultiEdit: 'composing',
  NotebookEdit: 'composing',
  Bash: 'working',
  BashOutput: 'working',
  KillShell: 'working',
  Task: 'weaving',
  Agent: 'weaving',
  TodoWrite: 'shaping',
});

const TOOL_STATES_LOWER: ReadonlyMap<string, OrbState> = new Map(
  Object.entries(ORB_TOOL_STATES).map(([k, v]) => [k.toLowerCase(), v]),
);

/**
 * The orb state for an agent's last tool: the `ORB_TOOL_STATES` table (any case, trimmed), `connecting` for an MCP
 * tool (`mcp__server__tool`), else `ORB_THINKING_STATE` — also for an empty or missing name.
 */
export function orbStateForTool(toolName: string): OrbState {
  const name = String(toolName ?? '')
    .trim()
    .toLowerCase();
  if (!name) return ORB_THINKING_STATE;
  if (name.startsWith('mcp__')) return 'connecting';
  return TOOL_STATES_LOWER.get(name) ?? ORB_THINKING_STATE;
}

/**
 * Whether an orb can draw here: the element is defined and a 2D canvas context is available. Hosts that show the
 * orb (`<ui-ai-answer>`'s writing row) keep their plain mark when it cannot. Never throws.
 */
export function orbCanDraw(): boolean {
  try {
    if (typeof customElements === 'undefined' || !customElements.get('ui-thinking-orb')) return false;
    return !!document.createElement('canvas').getContext('2d');
  } catch {
    return false;
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function num(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? clamp(n, lo, hi) : dflt;
}

function pick<T extends string>(v: unknown, all: readonly T[], dflt: T): T {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return (all as readonly string[]).includes(s) ? (s as T) : dflt;
}

/** A tuned size: 64, 32 or 20 — any other number snaps to the nearest of them; anything else is 64. */
export function orbSizeOf(v: unknown): OrbSize {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : Number.NaN;
  if (!Number.isFinite(n)) return 64;
  return ORB_SIZES.reduce((best, s) => (Math.abs(s - n) < Math.abs(best - n) ? s : best), 64 as OrbSize);
}

/** Resolve `data` over the attributes (`state`, `size`, `theme`, `speed`, `paused`, `color`, `dots`, `dot-size`, `motion`). */
export function orbOptions(data: ThinkingOrbData, attr: (name: string) => string | null): ThinkingOrbOptions {
  const d = data ?? {};
  const paused = d.paused ?? attr('paused');
  return {
    state: pick(d.state ?? attr('state'), ORB_STATES, 'working'),
    size: orbSizeOf(d.size ?? attr('size')),
    theme: pick(d.theme ?? attr('theme'), ['auto', 'dark', 'light'] as const, 'auto'),
    motion: pick(d.motion ?? attr('motion'), ['system', 'reduce', 'full'] as const, 'system'),
    speed: num(d.speed ?? attr('speed'), 0, 10, 1),
    paused: typeof paused === 'boolean' ? paused : paused !== null && !/^(false|0|off|no)$/i.test(paused.trim()),
    color: String(d.color ?? attr('color') ?? '').trim(),
    dots: num(d.dots ?? attr('dots'), 0.1, 4, 1),
    dotSize: num(d.dotSize ?? attr('dot-size'), 0.1, 4, 1),
  };
}

/** Upstream's tint parser: #rgb, #rrggbb and rgb()/rgba() → an RGB triple (0 … 255); anything else → no tint. */
export function parseTint(color: string | undefined): OrbTint | undefined {
  if (!color) return undefined;
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.replace(/./g, (c) => c + c);
    const n = Number.parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const fn = color.trim().match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (fn) {
    const c = (s: string) => clamp(Math.round(Number(s)), 0, 255);
    return { r: c(fn[1]), g: c(fn[2]), b: c(fn[3]) };
  }
  return undefined;
}

/** Only finite numbers from a host's raw `opts` (the engine reads numbers; anything else could poison a frame). */
function numericOpts(raw: unknown): ModeOpts | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: ModeOpts = {};
  let any = false;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[k] = v;
      any = true;
    }
  }
  return any ? out : undefined;
}

/** The draw plan for a state × size: `<ThinkingOrb>`'s own resolution — preset, then dots, dotSize, raw opts. */
export interface OrbPlan {
  frame: ModeFrame;
  opts: ModeOpts;
  /** Preset speed × the speed multiplier: seconds of the shared clock → `t`. */
  speed: number;
}

export function orbPlan(o: ThinkingOrbOptions, raw?: ModeOpts, custom?: ModeFrame): OrbPlan {
  const { mode, speed: baseSpeed, opts: presetOpts } = resolvePreset(o.state, o.size);
  // resolvePreset caches — never mutate its result.
  let opts = o.dots !== 1 ? scaleCounts(presetOpts, Math.max(0.1, o.dots)) : presetOpts;
  if (o.dotSize !== 1) opts = scaleRadii(opts, Math.max(0.1, o.dotSize));
  const extra = numericOpts(raw);
  if (extra) opts = { ...opts, ...extra };
  return { frame: typeof custom === 'function' ? custom : MODE_FRAMES[mode], opts, speed: baseSpeed * o.speed };
}

/** Where the orb sits in a w × h box: its scale from the tuned `size`, and the offset that centres it. */
export function orbFit(w: number, h: number, size: number): { scale: number; x: number; y: number } {
  const box = Math.min(w, h);
  if (!(box > 0) || !(size > 0) || !Number.isFinite(box)) return { scale: 1, x: 0, y: 0 };
  const scale = box / size;
  return { scale, x: (w - box) / 2, y: (h - box) / 2 };
}

function context2d(c: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  try {
    return c?.getContext?.('2d') ?? null;
  } catch {
    return null;
  }
}

/**
 * `<ui-thinking-orb>` — orbs that think while you wait: a small dotted sphere drawn in depth-shaded ink, in one of
 * nine states (working, searching, solving, listening, connecting, weaving, composing, breathing, shaping), each at
 * three tuned sizes (64, 32, 20). A loader: role="status" with the state's label (English or Korean) unless
 * `decorative`.
 *
 * One 2D canvas — no WebGL, no filters — sized to the box × devicePixelRatio (2 at most) and drawn at the tuned
 * size's geometry, scaled to fit. Every orb reads one shared clock, so orbs stay in phase. The frame loop runs only
 * while it is onscreen, the tab is shown and it is not paused; under reduced motion it is one still frame. Light ink
 * on a dark page, dark on a light one — following the page's theme live.
 *
 * Ported from thinking-orbs 0.3.2 (MIT, © 2026 Jakub Antalik — https://libraries.dev/orbs).
 */
export class UiThinkingOrb extends UiElement<ThinkingOrbData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return [
      'state',
      'size',
      'theme',
      'speed',
      'paused',
      'color',
      'dots',
      'dot-size',
      'motion',
      'label',
      'decorative',
      'lang',
      'style',
      'class',
    ];
  }

  #box: HTMLElement | null = null;
  #canvas: HTMLCanvasElement | null = null;
  #ctx: CanvasRenderingContext2D | null = null;
  #said: HTMLElement | null = null;
  #sizeSheet: HTMLStyleElement | null = null;
  /** The options of the last render — what the frame loop reads, so a frame parses no attributes. */
  #opts: ThinkingOrbOptions = orbOptions({}, () => null);
  #plan: OrbPlan | null = null;
  #planKey = '';
  #custom: ModeFrame | undefined;
  /** The instant a paused orb holds (null while it runs). */
  #held: number | null = null;
  #tint: OrbTint | undefined;
  #dark = true;
  #substrate: Substrate | null = null;
  #w = 0;
  #h = 0;
  #ratio = 1;
  #raf = 0;
  #visible = true;
  #reduced = false;
  #ro: ResizeObserver | null = null;
  #io: IntersectionObserver | null = null;
  #mo: MutationObserver | null = null;
  #scheme: MediaQueryList | null = null;
  #motion: MediaQueryList | null = null;

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if (old === value) return;
    if (name === 'theme' || name === 'style' || name === 'class') this.#substrate = null;
    this.requestRender();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#reduced = prefersReducedMotion();
    this.#visible = true;
    this.#substrate = null;
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
        if (this.#visible) this.#start();
        else this.#stop();
      });
      this.#io.observe(this);
    }
    if (typeof MutationObserver === 'function') {
      this.#mo = new MutationObserver(this.#onTree);
      const watch = {
        attributes: true,
        subtree: true,
        attributeFilter: ['data-theme', 'data-palette', 'data-design', 'class'],
      };
      this.#mo.observe(document.documentElement, watch);
      const root = this.getRootNode();
      if (root !== document && root instanceof ShadowRoot) this.#mo.observe(root, watch);
    }
    if (typeof matchMedia === 'function') {
      this.#scheme = matchMedia('(prefers-color-scheme: dark)');
      this.#scheme.addEventListener?.('change', this.#onScheme);
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
    this.#scheme?.removeEventListener?.('change', this.#onScheme);
    this.#motion?.removeEventListener?.('change', this.#onMotion);
    this.#ro = null;
    this.#io = null;
    this.#mo = null;
    this.#scheme = null;
    this.#motion = null;
    document.removeEventListener('visibilitychange', this.#onVisibility);
    super.disconnectedCallback();
  }

  /** What it draws with, from `data` first, then the attributes — each clamped. */
  get options(): ThinkingOrbOptions {
    return orbOptions(this.data ?? {}, (n) => this.getAttribute(n));
  }

  /** The substrate the ink is drawn for now: the pinned theme, else the page's. */
  get resolvedTheme(): Substrate {
    this.#substrate ??= resolveSubstrate(this, this.options.theme);
    return this.#substrate;
  }

  /** The label it announces (empty when decorative). */
  get label(): string {
    const d = this.data ?? {};
    if (d.decorative ?? this.hasAttribute('decorative')) return '';
    const own = String(d.label ?? this.getAttribute('label') ?? '').trim();
    return own || STRINGS[this.#lang][this.options.state];
  }

  /** True while the frame loop is scheduled. */
  get running(): boolean {
    return this.#raf !== 0;
  }

  get #lang(): ThinkingOrbLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  #a11y(): Record<string, string | null> {
    const label = this.label;
    if (!label) return { role: null, 'aria-label': null, 'aria-hidden': 'true' };
    return { role: 'status', 'aria-label': label, 'aria-hidden': null };
  }

  protected render(): string {
    const label = this.label;
    return `<style></style><div class="orb" part="orb"${attrs(this.#a11y())}><canvas class="orb-canvas" part="canvas" aria-hidden="true"></canvas><span class="sr-only">${esc(label)}</span></div>`;
  }

  /** The canvas is drawn once and kept: later renders patch the label and the plan, never the node. */
  protected override update(): void {
    if (!this.#box) {
      this.content.innerHTML = this.render();
      this.#sizeSheet = this.content.querySelector('style');
      this.#box = this.content.querySelector<HTMLElement>('.orb');
      this.#canvas = this.content.querySelector('canvas');
      this.#said = this.content.querySelector<HTMLElement>('.sr-only');
      this.#ctx = context2d(this.#canvas);
    } else {
      for (const [k, v] of Object.entries(this.#a11y())) {
        if (v === null) this.#box.removeAttribute(k);
        else if (this.#box.getAttribute(k) !== v) this.#box.setAttribute(k, v);
      }
      const label = this.label;
      if (this.#said && this.#said.textContent !== label) this.#said.textContent = label;
    }
    const o = this.options;
    this.#opts = o;
    const d = this.data ?? {};
    // The host's default box is the tuned size; the page's own width / height on the element win.
    const sizeCss = `:host { width: ${o.size}px; height: ${o.size}px; }`;
    if (this.#sizeSheet && this.#sizeSheet.textContent !== sizeCss) this.#sizeSheet.textContent = sizeCss;
    const custom = typeof d.frame === 'function' ? d.frame : undefined;
    const key = JSON.stringify([o.state, o.size, o.speed, o.dots, o.dotSize, numericOpts(d.opts) ?? null]);
    if (key !== this.#planKey || custom !== this.#custom || !this.#plan) {
      this.#planKey = key;
      this.#custom = custom;
      this.#plan = orbPlan(o, d.opts, custom);
    }
    // Paused: hold the instant it stopped on (a theme switch redraws the same frame); running: the shared clock.
    if (!o.paused) this.#held = null;
    else this.#held ??= this.#clock();
    this.#tint = parseTint(o.color);
    this.#dark = this.resolvedTheme === 'dark';
    if (!this.#ro) this.#resize(o.size, o.size);
    if (this.#isStill() || o.paused) this.#stop();
    else this.#start();
    this.#draw();
    this.updated();
  }

  #isStill(): boolean {
    const m = this.#opts.motion;
    return m === 'reduce' || (m === 'system' && this.#reduced);
  }

  #resize(w: number, h: number): void {
    w = Number.isFinite(w) && w > 0 ? w : 0;
    h = Number.isFinite(h) && h > 0 ? h : 0;
    if (w === this.#w && h === this.#h) return;
    this.#w = w;
    this.#h = h;
    const dpr = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;
    this.#ratio = Math.min(2, dpr);
    const c = this.#canvas;
    if (c) {
      const pw = Math.round(w * this.#ratio);
      const ph = Math.round(h * this.#ratio);
      if (c.width !== pw) c.width = pw;
      if (c.height !== ph) c.height = ph;
    }
    // Resizing cleared the canvas: draw now, not on the next frame.
    this.#draw();
  }

  /** The shared clock: every orb on the page reads the same seconds, so they stay in phase. */
  #clock(): number {
    return (performance.now() / 1000) * (this.#plan?.speed ?? 1);
  }

  #t(): number {
    if (this.#isStill()) return STILL_T;
    return this.#held ?? this.#clock();
  }

  #draw(): void {
    const ctx = this.#ctx;
    const plan = this.#plan;
    const c = this.#canvas;
    if (!ctx || !plan || !c) return;
    const size = this.#opts.size;
    const fit = orbFit(this.#w, this.#h, size);
    const r = this.#ratio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    if (!this.#w || !this.#h) return;
    ctx.setTransform(r * fit.scale, 0, 0, r * fit.scale, r * fit.x, r * fit.y);
    try {
      paintFrame(ctx, plan.frame(size, this.#t(), plan.opts), this.#dark, this.#tint);
    } catch {
      // A host's own `frame` threw: the orb draws nothing this frame rather than taking the page down.
    }
  }

  #canRun(): boolean {
    return (
      this.isConnected &&
      this.#visible &&
      !this.#isStill() &&
      !this.#opts.paused &&
      !(typeof document !== 'undefined' && document.hidden) &&
      typeof requestAnimationFrame === 'function'
    );
  }

  #start(): void {
    if (this.#raf || !this.#canRun()) return;
    this.#raf = requestAnimationFrame(this.#frame);
  }

  #stop(): void {
    if (this.#raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.#raf);
    this.#raf = 0;
  }

  #frame = (): void => {
    this.#raf = 0;
    this.#draw();
    if (this.#canRun()) this.#raf = requestAnimationFrame(this.#frame);
  };

  // ── Page signals ───────────────────────────────────────────────────────────

  #onTree = (records: MutationRecord[]): void => {
    if (!records.some((r) => composedContains(r.target, this))) return;
    this.#substrate = null;
    this.requestRender();
  };

  #onScheme = (): void => {
    this.#substrate = null;
    this.requestRender();
  };

  #onMotion = (): void => {
    this.#reduced = prefersReducedMotion();
    this.requestRender();
  };

  #onVisibility = (): void => {
    if (document.hidden) this.#stop();
    else {
      this.#draw();
      this.#start();
    }
  };
}

define('ui-thinking-orb', UiThinkingOrb);

declare global {
  interface HTMLElementTagNameMap {
    'ui-thinking-orb': UiThinkingOrb;
  }
}
