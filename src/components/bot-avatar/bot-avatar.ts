import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { attrs, escAttr } from '../../core/html';
import { designById } from '../../core/tokens';
import { autoInk, parseColor, richer, shade } from './engine/color';
import { type DrawConfig, draw, LIGHT_DEFAULTS, OVERSCAN, RISE } from './engine/draw';
import { type JumpConfig, type Pose, restPose, Sim } from './engine/engine';
import { bakesPending, type FurStyle, hurry, onLanded, stockLights, takeMissed, warmPlastic } from './engine/plastic';
import { botAvatarPalette, botAvatarPresets, botAvatarTypes } from './engine/presets';
import { SHAPE_PARTS, SHAPE_PATHS } from './engine/shapes';
import { pointer, subscribe } from './engine/ticker';
import type {
  BotAvatarFace,
  BotAvatarGlasses,
  BotAvatarHat,
  BotAvatarShading,
  BotAvatarSquashEase,
  BotAvatarState,
  BotAvatarType,
} from './engine/types';
import { styles } from './styles';

export type BotAvatarLang = 'en' | 'ko';
export type BotAvatarMotion = 'system' | 'reduce' | 'full';
export type BotAvatarTheme = 'auto' | 'dark' | 'light';

/**
 * What the element draws: `el.data = {...}`, the names and defaults of bot-avatars' `<BotAvatar>` props (so the
 * Libraries.dev docs apply), with `shape` for the React `type`. Out-of-range numbers are clamped; an unknown name falls
 * back to the default.
 */
export interface BotAvatarData {
  /** The body: one of the eighteen shapes. Default `clover`. */
  shape?: BotAvatarType;
  /** The React prop's name for `shape` (used when `shape` is not given). */
  type?: BotAvatarType;
  /** A custom outline: SVG path data in the 100×100 body box centred on (50, 50), in place of the shape's own. */
  path?: string;
  /** `eyes` (default: the shape's own) or `mouth`, which adds a mouth that changes with the state. */
  face?: BotAvatarFace;
  /** `default` (idle — `idle` is taken too), `working` (hopping, spinning) or `sleeping`. Default `default`. */
  state?: BotAvatarState | 'idle';
  /** The box in px, 12 … 512 (default 64). The canvas overscans it so a hop is never clipped; layout stays square. */
  size?: number;
  /** Body colour: #rgb, #rrggbb, rgb() or hsl(), or a shape's name for its palette colour. Default the shape's own. */
  color?: string;
  /** Face ink. Default dark, or light on a dark body. */
  ink?: string;
  /** Lightness of the body colour, 0 … 2 (1 as the palette has it). Default 1, or the shape's own. */
  brightness?: number;
  /** Saturation of the body colour, 0 … 2.5. Default 1.5, or the shape's own. */
  saturation?: number;
  /** A multiplier on every animation, 0 … 5 (0 holds it still). Default 1. */
  speed?: number;
  /** Freeze on the current frame. */
  paused?: boolean;
  /** 0 … 1: offsets the blink and glance loops. Default per instance, so a row never blinks in unison. */
  seed?: number;
  /** `fabric` (plush fur, default), `plastic` (glossy), `crisp`, `smooth` or `flat`; true / false mean crisp / flat. */
  shading?: BotAvatarShading | boolean;
  hat?: BotAvatarHat;
  glasses?: BotAvatarGlasses;
  headphones?: boolean;
  bowTie?: boolean;
  /** The hat's, the headphones' and the bow tie's colour. Default a soft black. */
  accessoryColor?: string;
  shadow?: number;
  highlight?: number;
  depth?: number;
  roundness?: number;
  light?: number;
  rim?: number;
  spread?: number;
  backLight?: number;
  lightFront?: number;
  shine?: number;
  sheen?: number;
  backSoftness?: number;
  furLength?: number;
  furDensity?: number;
  furFuzz?: number;
  furClumps?: number;
  furCurl?: number;
  furGravity?: number;
  /** Hold the body at this orientation (radians), over the animation and pointer play. */
  pose?: { yaw?: number; pitch?: number; roll?: number };
  /** Eyes and head follow a pointer that comes near; a click hops and turns. Default true. */
  interactive?: boolean;
  /** The surface it sits on, for the whirl's colour. Default `auto` (an ancestor's data-theme, then the system). */
  theme?: BotAvatarTheme;
  /** How far the head turns side to side while idle, 0 … 2. Default 1. */
  turn?: number;
  whirl?: number;
  whirlSize?: number;
  whirlWidth?: number;
  whirlLength?: number;
  whirlTilt?: number;
  jumpHeight?: number;
  jumpTime?: number;
  jumpStretch?: number;
  jumpSquash?: number;
  jumpSquashTime?: number;
  jumpSquashEase?: BotAvatarSquashEase;
  jumpGroundTime?: number;
  jumpGroundEase?: BotAvatarSquashEase;
  jumpRiseTime?: number;
  jumpRiseEase?: BotAvatarSquashEase;
  jumpClickSquashTime?: number;
  jumpSpin?: number;
  jumpLean?: number;
  jumpEvery?: number;
  jumpLand?: number;
  /** The accessible name — the agent's name; the state is said after it. Default “AI agent avatar”. */
  label?: string;
  /** Hidden from assistive tech: the name and status are already written beside it. */
  decorative?: boolean;
  /** `system` (default) follows prefers-reduced-motion; `reduce` draws the state's still pose; `full` always moves. */
  motion?: BotAvatarMotion;
}

/** What the element draws with now: `data` first, then the attributes, each clamped. */
export interface BotAvatarOptions {
  shape: BotAvatarType;
  /** The custom outline, or null for the shape's own. */
  path: string | null;
  /** The material caches' key for the outline: the shape's name, or one made from the custom path. */
  outlineKey: string;
  face: BotAvatarFace;
  state: BotAvatarState;
  size: number;
  /** The colour picked (before brightness and saturation), and the body colour drawn. */
  color: string;
  body: string;
  ink: string;
  brightness: number;
  saturation: number;
  speed: number;
  paused: boolean;
  /** paused, or a speed of 0: no animation loop. */
  frozen: boolean;
  seed: number;
  shading: BotAvatarShading;
  hat: BotAvatarHat;
  glasses: BotAvatarGlasses;
  headphones: boolean;
  bowTie: boolean;
  accessoryColor: string;
  shadow: number;
  highlight: number;
  depth: number;
  roundness: number;
  light: number;
  rim: number;
  spread: number;
  backLight: number | undefined;
  lightFront: number | undefined;
  shine: number | undefined;
  sheen: number | undefined;
  backSoftness: number | undefined;
  fur: FurStyle;
  vivid: number;
  pose: { yaw?: number; pitch?: number; roll?: number } | null;
  interactive: boolean;
  theme: BotAvatarTheme;
  turn: number;
  whirl: { strength: number; size: number; width: number; length: number; tilt: number };
  jump: JumpConfig;
  motion: BotAvatarMotion;
}

/** A stable face for an agent: the shape, the colour and the blink seed a name gives. */
export interface BotAvatarPick {
  shape: BotAvatarType;
  color: string;
  seed: number;
}

const STRINGS = {
  en: {
    name: 'AI agent avatar',
    states: { default: 'idle', working: 'working', sleeping: 'sleeping' } as Record<BotAvatarState, string>,
    join: ', ',
  },
  ko: {
    name: 'AI 에이전트 아바타',
    states: { default: '대기 중', working: '작업 중', sleeping: '자는 중' } as Record<BotAvatarState, string>,
    join: ', ',
  },
};

const STATES: readonly BotAvatarState[] = ['default', 'working', 'sleeping'];
const SHADINGS: readonly BotAvatarShading[] = ['fabric', 'plastic', 'crisp', 'smooth', 'flat'];
const HATS: readonly BotAvatarHat[] = ['none', 'beret', 'beanie', 'party', 'crown'];
const GLASSES: readonly BotAvatarGlasses[] = ['none', 'round', 'square', 'shades'];
const EASES: readonly BotAvatarSquashEase[] = ['sharp', 'pulse', 'soft', 'bouncy'];
/** The palette's own colours, each once, in shape order: what `botAvatarFor` deals from. */
const COLORS: readonly string[] = botAvatarTypes
  .map((t) => botAvatarPalette[t])
  .filter((c, i, all) => all.indexOf(c) === i);

/* the longest an avatar waits for its material before it is shown anyway */
const SHOW_WITHIN = 4000;
/* how far the pointer's pull reaches, in head widths */
const REACH = 3;
/* SVG path data and nothing else: commands, numbers, separators */
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz\d\s.,eE+-]+$/;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A number from data or an attribute, clamped; anything not a finite number is the default. */
function num(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? clamp(n, lo, hi) : dflt;
}

/** The same, but left out (undefined) when not given, so the engine's own default applies. */
function opt(v: unknown, lo: number, hi: number): number | undefined {
  const n = num(v, lo, hi, Number.NaN);
  return Number.isNaN(n) ? undefined : n;
}

function pick<T extends string>(v: unknown, all: readonly T[], dflt: T): T {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return (all as readonly string[]).includes(s) ? (s as T) : dflt;
}

/** A boolean from data (a boolean) or an attribute (present, unless "false"). */
function flag(v: unknown, attr: string | null, dflt: boolean): boolean {
  if (typeof v === 'boolean') return v;
  if (attr === null) return dflt;
  return attr.trim().toLowerCase() !== 'false';
}

/** A shape's name (any case); anything else is null. */
function shapeName(v: unknown): BotAvatarType | null {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return Object.hasOwn(botAvatarPresets, s) ? (s as BotAvatarType) : null;
}

/** A colour the engine can shade — #rgb, #rrggbb, rgb(), hsl() — or a shape's name for its palette colour; else null. */
export function botAvatarColor(v: unknown): string | null {
  const named = shapeName(v);
  if (named) return botAvatarPalette[named];
  const s = typeof v === 'string' ? v.trim() : '';
  return s && parseColor(s) ? s : null;
}

/* FNV-1a, to a 0–1 seed (the original's, from the React id) */
function hashSeed(id: string): number {
  return (fnv(id) % 1000) / 1000;
}

function fnv(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/* murmur3's finaliser: spreads a hash so its low bits pick independently */
function mix(h: number): number {
  let m = h >>> 0;
  m ^= m >>> 16;
  m = Math.imul(m, 0x85ebca6b);
  m ^= m >>> 13;
  m = Math.imul(m, 0xc2b2ae35);
  m ^= m >>> 16;
  return m >>> 0;
}

/**
 * A stable face for a name — an agent's, a model's: the shape (one of the eighteen), a colour from the palette (dealt
 * on its own, so two agents of one shape usually differ) and the blink seed. Pure and deterministic: the same name
 * (trimmed, any case) gives the same face on every page and every load. `el.data = { ...botAvatarFor(name), state }`.
 */
export function botAvatarFor(name: unknown): BotAvatarPick {
  const s = String(name ?? '')
    .trim()
    .toLowerCase();
  const h = fnv(s);
  return {
    shape: botAvatarTypes[mix(h) % botAvatarTypes.length],
    color: COLORS[mix(h ^ 0x9e3779b9) % COLORS.length],
    seed: hashSeed(s),
  };
}

/**
 * The material caches' key for a custom outline (the engine keys its baked form, pile and draw state by it): the
 * path's full 32-bit FNV-1a hash and its length, so two different paths share a bake only on a true 32-bit collision.
 */
export function botAvatarOutlineKey(path: string): string {
  return `path:${fnv(path).toString(36)}:${path.length}`;
}

/** The element above `node`: its parent, or the host of the shadow root it sits in. */
function above(node: Element): Element | null {
  if (node.parentElement) return node.parentElement;
  const root = node.getRootNode?.();
  return root && 'host' in root ? ((root as ShadowRoot).host ?? null) : null;
}

/** Whether a CSS colour is light ink (r·.299 + g·.587 + b·.114 > 128) — hex or rgb(); null when it cannot tell. */
function lightInk(color: string): boolean | null {
  const c = parseColor(color);
  return c ? c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114 > 128 : null;
}

/**
 * The surface an element sits on, the way the library resolves it (as border-beam and thinking-orb do): `pinned`
 * 'dark' / 'light' first; then the nearest ancestor — the element itself included, across shadow roots — that says
 * so (`data-design` → its scheme, `data-theme="dark|light"`, a `ui-*` element's own `theme`, the `dark` / `light`
 * class); then the element's `--text` token (light ink → a dark page); last `prefers-color-scheme`.
 */
export function botAvatarSurface(el: Element, pinned?: unknown): 'dark' | 'light' {
  if (pinned === 'dark' || pinned === 'light') return pinned;
  for (let node: Element | null = el; node; node = above(node)) {
    const design = node.getAttribute('data-design');
    const d = design ? designById(design) : undefined;
    if (d) return d.scheme;
    const theme = node.getAttribute('data-theme');
    if (theme === 'dark' || theme === 'light') return theme;
    const pin = node.localName.startsWith('ui-') ? node.getAttribute('theme') : null;
    if (pin === 'dark' || pin === 'light') return pin;
    if (node.classList?.contains('dark')) return 'dark';
    if (node.classList?.contains('light')) return 'light';
  }
  try {
    const light = lightInk(getComputedStyle(el).getPropertyValue('--text').trim());
    if (light !== null) return light ? 'dark' : 'light';
  } catch {
    // Not styled (detached, or no CSSOM): the system decides.
  }
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** The body colour drawn: the picked colour through brightness and saturation (the React component's sum). */
export function botAvatarBody(color: string, brightness: number, saturation: number): string {
  /* past 1.5 the colour itself is as saturated as it goes for most of the palette: the rest deepens it and makes
     the light keep more of it */
  const vivid = clamp(saturation, 1.5, 2.5) - 1.5;
  return richer(
    brightness === 1 && saturation === 1
      ? color
      : shade(color, (clamp(brightness, 0, 2) - 1) * 0.35, (clamp(saturation, 0, 1.5) - 1) * 0.5),
    vivid,
  );
}

const fx = (v: number) => Number(v.toFixed(2));

/**
 * The avatar as a still SVG — the body's outline (and antennae) in its colour, lit from the upper left, with the
 * state's resting face: open eyes, or a sleeping lid; with `face: 'mouth'` a smile, an open mouth or an “o”. What the
 * element shows where it cannot draw (no 2D canvas); a host may use it for a server-drawn or static avatar. Every value
 * is escaped; a custom `path` that is not path data falls back to the shape's own outline.
 */
export function botAvatarSvg(
  o: Partial<Pick<BotAvatarOptions, 'shape' | 'path' | 'face' | 'state' | 'body' | 'ink'>> = {},
): string {
  const shape = shapeName(o.shape) ?? 'clover';
  const preset = botAvatarPresets[shape];
  const custom = typeof o.path === 'string' && PATH_DATA.test(o.path.trim()) ? o.path.trim() : null;
  const outline = custom ?? SHAPE_PATHS[shape];
  const parts = custom ? undefined : SHAPE_PARTS[shape];
  const fill = botAvatarColor(o.body) ?? preset.color;
  const ink = botAvatarColor(o.ink) ?? autoInk(fill);
  const face = o.face === 'mouth' || o.face === 'eyes' ? o.face : preset.face;
  const state = pick(o.state, STATES, 'default');
  const ey = face === 'mouth' ? -3.5 : 1;
  const eye = (side: -1 | 1) => {
    const x = side * 12.5;
    if (state === 'sleeping')
      return `<path d="M${fx(x - 6)} ${fx(ey - 0.9)}Q${fx(x)} ${fx(ey + 6.4)} ${fx(x + 6)} ${fx(ey - 0.9)}" stroke-width="4"/>`;
    return `<path d="M${fx(x)} ${fx(ey + 1.1)}L${fx(x)} ${fx(ey - 1.1)}" stroke-width="12.6"/>`;
  };
  const mouth =
    face !== 'mouth'
      ? ''
      : state === 'sleeping'
        ? '<circle cx="0" cy="15.5" r="2.7" stroke-width="1.6"/>'
        : state === 'working'
          ? `<path d="M-9.5 11.6Q0 24 9.5 11.6Z" fill="${escAttr(ink)}" stroke-width="1.2"/>`
          : '<path d="M-6.5 12.5Q0 18 6.5 12.5" stroke-width="3.8"/>';
  const g = `translate(${fx(preset.faceX)} ${fx(preset.faceY)}) scale(${fx(preset.faceScale)})`;
  return (
    `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">` +
    `<defs><radialGradient id="ba-lit" cx="0.36" cy="0.3" r="0.75">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="0.38"/><stop offset="0.55" stop-color="#fff" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#000" stop-opacity="0.22"/></radialGradient></defs>` +
    (parts ? `<path d="${escAttr(parts)}" fill="${escAttr(fill)}"/>` : '') +
    `<path d="${escAttr(outline)}" fill="${escAttr(fill)}"/>` +
    `<path d="${escAttr(outline)}" fill="url(#ba-lit)"/>` +
    `<g transform="${g}" fill="none" stroke="${escAttr(ink)}" stroke-linecap="round" stroke-linejoin="round">` +
    `${eye(-1)}${eye(1)}${mouth}</g></svg>`
  );
}

/* ── the show-when-baked roll call (module-level, as the React component's) ────────────────────────────────────── */

/* the avatars waiting to be shown, each with whether it is ready: they are shown together, once all are and no
   bake is under way */
const waiters = new Map<object, { ready: () => boolean; show: () => void }>();
function showReady(): void {
  if (bakesPending()) return;
  for (const w of waiters.values()) if (!w.ready()) return;
  const all = [...waiters.values()];
  waiters.clear();
  for (const w of all) w.show();
}

/* the outlines made, by their path data — custom paths too, so it is bounded as the engine's forms are */
const pathCache = new Map<string, Path2D>();
const PATH_CACHE_MAX = 48;
function bodyPath(d: string): Path2D {
  let p = pathCache.get(d);
  if (!p) {
    if (pathCache.size >= PATH_CACHE_MAX) pathCache.clear();
    p = new Path2D(d);
    pathCache.set(d, p);
  }
  return p;
}

/* the thin parts one piece per subpath, so each rounds on its own */
const partsCache = new Map<string, Path2D[]>();
function partPaths(d: string): Path2D[] {
  let p = partsCache.get(d);
  if (!p) {
    p = d
      .split(/(?=M)/)
      .filter((s) => s.trim())
      .map((s) => new Path2D(s));
    partsCache.set(d, p);
  }
  return p;
}

type Idle = (fn: () => void) => number;
const requestIdle: Idle = (fn) =>
  typeof requestIdleCallback === 'function' ? requestIdleCallback(fn) : (setTimeout(fn, 1) as unknown as number);
const cancelIdle = (id: number) => {
  if (typeof cancelIdleCallback === 'function') cancelIdleCallback(id);
  else clearTimeout(id);
};

function context2d(c: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  try {
    return c?.getContext?.('2d') ?? null;
  } catch {
    return null;
  }
}

let instances = 0;

/**
 * `<ui-bot-avatar>` — an animated avatar for an AI agent: one of eighteen soft 3D shapes with a living face, in one
 * of three states — `default` (idle: looks around, blinks, jumps and turns now and then), `working` (hops, spins,
 * smiles) and `sleeping` (head down, slow breaths). A state change is a timed cross-animation. Plush fur by default,
 * glossy plastic with `shading="plastic"`; hats, glasses, headphones and a bow tie to wear.
 *
 * Canvas 2D (no WebGL), drawn by the bot-avatars engine. Every avatar on the page shares one animation-frame loop; an
 * avatar joins it only while it animates (not paused, motion not reduced) and is on screen, and the loop stops while
 * none does or the tab is hidden. In `fabric` and `plastic` the material is baked once per shape on idle time and
 * shared; an avatar waits invisible until its material is made (4 s at most), then fades in with the others. Reduced
 * motion: the state's still pose. Without a 2D canvas, a still SVG of the shape. role="img" named by `label` and the
 * state, or hidden with `decorative`.
 *
 * Ported from bot-avatars 0.2.2 by Jakub Antalik (MIT, https://libraries.dev/bots) — the engine under ./engine is
 * the library's, the React component became this element.
 */
export class UiBotAvatar extends UiElement<BotAvatarData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return [
      'shape',
      'type',
      'state',
      'color',
      'size',
      'face',
      'shading',
      'seed',
      'paused',
      'interactive',
      'label',
      'decorative',
      'lang',
      'motion',
      'theme',
    ];
  }

  #box: HTMLElement | null = null;
  #canvas: HTMLCanvasElement | null = null;
  #still: HTMLElement | null = null;
  #ctx: CanvasRenderingContext2D | null = null;
  #fallback = false;
  #svg = '';
  #o: BotAvatarOptions;
  #cfg: DrawConfig | null = null;
  #sim: Sim | null = null;
  #cssSize = 0;
  #autoSeed = hashSeed(`ui-bot-avatar:${++instances}`);
  #sysReduced = false;
  #mq: MediaQueryList | null = null;
  // Shown once its material is made (null until the first render decides).
  #shown: boolean | null = null;
  #ready = false;
  #waitingShow = false;
  #showTimer: ReturnType<typeof setTimeout> | null = null;
  #showPaint: (() => void) | null = null;
  #watch: (() => void) | null = null;
  #stillPaint: (() => void) | null = null;
  #waiting: (() => void) | null = null;
  #holding: (() => void) | null = null;
  #lastLook: string | null = null;
  // The bakes queued on idle time, by what they depend on.
  #warmKey = '';
  #warmId: number | null = null;
  // The shared loop.
  #loopOn = false;
  #unsub: (() => void) | null = null;
  #io: IntersectionObserver | null = null;

  constructor() {
    super();
    this.#o = this.options;
    this.addEventListener('click', this.#onClick);
  }

  attributeChangedCallback(_name: string, old: string | null, value: string | null): void {
    if (old !== value) this.requestRender();
  }

  override connectedCallback(): void {
    if (typeof matchMedia === 'function') {
      this.#mq = matchMedia('(prefers-reduced-motion: reduce)');
      this.#mq.addEventListener?.('change', this.#onMotion);
    }
    this.#sysReduced = prefersReducedMotion();
    super.connectedCallback();
  }

  override disconnectedCallback(): void {
    this.#syncLoop();
    this.#endWait();
    this.#stopWatch();
    this.#stopWaiting();
    this.#holding?.();
    this.#cancelWarm();
    this.#warmKey = '';
    this.#mq?.removeEventListener?.('change', this.#onMotion);
    this.#mq = null;
    // Let the backing store go; a reconnect sizes it again on its first paint.
    if (this.#canvas) {
      this.#canvas.width = 0;
      this.#canvas.height = 0;
    }
    super.disconnectedCallback();
  }

  /** What it draws with now, from `data` first, then the attributes — each clamped to its range. */
  get options(): BotAvatarOptions {
    const d = this.data ?? {};
    const a = (n: string) => this.getAttribute(n);
    const shape = shapeName(d.shape ?? d.type ?? a('shape') ?? a('type')) ?? 'clover';
    const preset = botAvatarPresets[shape];
    const rawPath = typeof d.path === 'string' ? d.path.trim() : '';
    const path = rawPath || null;
    const stateIn = String(d.state ?? a('state') ?? '')
      .trim()
      .toLowerCase();
    const state = stateIn === 'idle' ? 'default' : pick(stateIn, STATES, 'default');
    const shadingIn = d.shading ?? a('shading');
    const shading = shadingIn === true ? 'crisp' : shadingIn === false ? 'flat' : pick(shadingIn, SHADINGS, 'fabric');
    const color = botAvatarColor(d.color ?? a('color')) ?? preset.color;
    /* the shape's own brightness and saturation where the data leaves them out */
    const brightness = num(d.brightness, 0, 2, preset.brightness ?? 1);
    const saturation = num(d.saturation, 0, 2.5, preset.saturation ?? 1.5);
    const body = botAvatarBody(color, brightness, saturation);
    const speed = num(d.speed, 0, 5, 1);
    const paused = flag(d.paused, a('paused'), false);
    const lit = LIGHT_DEFAULTS[shading === 'fabric' ? 'fabric' : 'other'];
    /* the pile's style, rounded so a slider does not bake a pile per pixel */
    const q = (v: unknown, lo: number, hi: number, dflt: number) => Math.round(num(v, lo, hi, dflt) * 20) / 20;
    /* a held pose: finite radians only (one left out keeps the rest pose's) */
    const fin = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    const pose =
      d.pose && typeof d.pose === 'object'
        ? { yaw: fin(d.pose.yaw), pitch: fin(d.pose.pitch), roll: fin(d.pose.roll) }
        : null;
    const motion = pick(d.motion ?? a('motion'), ['system', 'reduce', 'full'] as const, 'system');
    return {
      shape,
      path,
      outlineKey: path ? botAvatarOutlineKey(path) : shape,
      face: pick(d.face ?? a('face'), ['eyes', 'mouth'] as const, preset.face),
      state,
      size: num(d.size ?? a('size'), 12, 512, 64),
      color,
      body,
      ink: botAvatarColor(d.ink) ?? autoInk(body),
      brightness,
      saturation,
      speed,
      paused,
      frozen: paused || !(speed > 0),
      seed: num(d.seed ?? a('seed'), 0, 1, this.#autoSeed),
      shading,
      hat: pick(d.hat, HATS, 'none'),
      glasses: pick(d.glasses, GLASSES, 'none'),
      headphones: d.headphones === true,
      bowTie: d.bowTie === true,
      accessoryColor: botAvatarColor(d.accessoryColor) ?? '#27272b',
      shadow: num(d.shadow, 0, 2, lit.shadow),
      highlight: num(d.highlight, 0, 2, lit.highlight),
      depth: num(d.depth, 0.2, 2, 0.65),
      roundness: num(d.roundness, 0, 1, 1),
      light: num(d.light, -720, 720, lit.light),
      rim: num(d.rim, 0, 2, lit.rim),
      spread: num(d.spread, 0.4, 2.5, lit.spread),
      backLight: opt(d.backLight, -720, 720),
      lightFront: opt(d.lightFront, 0, 85),
      shine: opt(d.shine, 0, 2),
      sheen: opt(d.sheen, 0, 2),
      backSoftness: opt(d.backSoftness, 0, 1),
      fur: {
        length: q(d.furLength, 0.3, 2.5, 1),
        density: q(d.furDensity, 0.3, 2, 1.6),
        fuzz: q(d.furFuzz, 0, 1, 0.9),
        clumps: q(d.furClumps, 0, 1, 0.4),
        curl: q(d.furCurl, 0, 1, 0.7),
        gravity: q(d.furGravity, 0, 1, 0.9),
      },
      vivid: clamp(saturation, 1.5, 2.5) - 1.5,
      pose,
      interactive: flag(d.interactive, a('interactive'), true),
      theme: pick(d.theme ?? a('theme'), ['auto', 'dark', 'light'] as const, 'auto'),
      turn: num(d.turn, 0, 2, 1),
      whirl: {
        strength: num(d.whirl, 0, 2, 0),
        size: num(d.whirlSize, 0.6, 1.6, 1),
        width: num(d.whirlWidth, 0.4, 2, 1),
        length: num(d.whirlLength, 0.4, 1.6, 1),
        tilt: num(d.whirlTilt, 0.5, 1.8, 1),
      },
      jump: {
        height: num(d.jumpHeight, 0, 80, 26),
        time: num(d.jumpTime, 0.2, 3, 0.68),
        stretch: num(d.jumpStretch, 0, 2, 1),
        spin: Math.round(num(d.jumpSpin, 0, 2, 1)),
        lean: num(d.jumpLean, -45, 45, 6),
        every: num(d.jumpEvery, 0, 600, 8),
        land: num(d.jumpLand, -0.5, 0.5, 0),
        squash: num(d.jumpSquash, 0, 2, 1.15),
        squashTime: num(d.jumpSquashTime, 0.05, 3, 0.37),
        squashEase: pick(d.jumpSquashEase, EASES, 'pulse'),
        groundTime: num(d.jumpGroundTime, 0, 3, 0.11),
        groundEase: pick(d.jumpGroundEase, EASES, 'pulse'),
        riseTime: num(d.jumpRiseTime, 0.05, 3, 0.33),
        riseEase: pick(d.jumpRiseEase, EASES, 'pulse'),
        clickSquashTime: num(d.jumpClickSquashTime, 0.05, 3, 0.24),
      },
      motion,
    };
  }

  /** True while this avatar is subscribed to the shared frame loop. */
  get running(): boolean {
    return this.#unsub !== null;
  }

  /** True once the avatar is on screen (its material made, or the wait over); false while it waits invisible. */
  get shown(): boolean {
    return this.#shown === true;
  }

  /** True when there is no 2D canvas here: the still SVG stands in. */
  get fallback(): boolean {
    return this.#fallback;
  }

  /** A hop and a full turn, now, in any state (what a click does). Nothing while frozen, held or still. */
  poke(): void {
    const o = this.#o;
    if (o.frozen || o.pose || this.#reduced || this.#fallback || !this.#sim) return;
    this.#sim.poke();
  }

  get #lang(): BotAvatarLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  get #reduced(): boolean {
    const m = this.#o.motion;
    return m === 'reduce' || (m === 'system' && this.#sysReduced);
  }

  #a11y(): Record<string, string | null> {
    const d = this.data ?? {};
    if (d.decorative ?? this.hasAttribute('decorative'))
      return { role: null, 'aria-label': null, 'aria-hidden': 'true' };
    const t = STRINGS[this.#lang];
    const own = String(d.label ?? this.getAttribute('label') ?? '').trim();
    return { role: 'img', 'aria-label': `${own || t.name}${t.join}${t.states[this.#o.state]}`, 'aria-hidden': null };
  }

  #marks(): Record<string, string | null> {
    const o = this.#o;
    return {
      'data-shape': o.shape,
      'data-state': o.state,
      'data-face': o.face,
      'data-shown': this.#shown ? '' : null,
      'data-fallback': this.#fallback ? '' : null,
    };
  }

  protected render(): string {
    return (
      `<div class="ba" part="avatar"${attrs({ ...this.#a11y(), ...this.#marks() })}>` +
      `<canvas class="ba-canvas" part="canvas" aria-hidden="true"></canvas>` +
      `<div class="ba-still" part="still" aria-hidden="true"></div></div>`
    );
  }

  /** The canvas is made once and kept: later renders patch the name, the marks and the size, never the node. */
  protected override update(): void {
    this.#o = this.options;
    if (!this.#box) {
      this.content.innerHTML = this.render();
      this.#box = this.content.querySelector<HTMLElement>('.ba');
      this.#canvas = this.content.querySelector('canvas');
      this.#still = this.content.querySelector<HTMLElement>('.ba-still');
      this.#ctx = context2d(this.#canvas);
      this.#fallback = !this.#ctx || typeof Path2D !== 'function';
    }
    this.#effect();
    this.#patch();
    this.updated();
  }

  #patch(): void {
    const box = this.#box;
    if (!box) return;
    for (const [k, v] of Object.entries({ ...this.#a11y(), ...this.#marks() })) {
      if (v === null) box.removeAttribute(k);
      else if (box.getAttribute(k) !== v) box.setAttribute(k, v);
    }
    box.style.setProperty('--ba-size', `${this.#o.size}px`);
    if (this.#fallback && this.#still) {
      const o = this.#o;
      const svg = botAvatarSvg({
        shape: o.shape,
        path: o.path,
        face: o.face,
        state: o.state,
        body: o.body,
        ink: o.ink,
      });
      if (svg !== this.#svg) {
        this.#svg = svg;
        this.#still.innerHTML = svg;
      }
    }
  }

  /** The draw config — the React component's, prop for prop. */
  #config(o: BotAvatarOptions): DrawConfig {
    const preset = botAvatarPresets[o.shape];
    return {
      path: bodyPath(o.path ?? SHAPE_PATHS[o.shape]),
      face: o.face,
      faceX: preset.faceX,
      faceY: preset.faceY,
      faceScale: preset.faceScale,
      color: o.body,
      ink: o.ink,
      shading: o.shading,
      shadow: o.shadow,
      highlight: o.highlight,
      depth: o.depth,
      roundness: o.roundness,
      fur: o.fur,
      vivid: o.vivid,
      backLight: o.backLight,
      lightFront: o.lightFront,
      shine: o.shine,
      sheen: o.sheen,
      backSoftness: o.backSoftness,
      light: o.light,
      rim: o.rim,
      spread: o.spread,
      typeKey: o.outlineKey,
      still: o.frozen || this.#reduced,
      furOnIdle: true,
      whirl: o.whirl,
      parts: !o.path && SHAPE_PARTS[o.shape] ? partPaths(SHAPE_PARTS[o.shape] as string) : undefined,
      wear: {
        hat: o.hat,
        glasses: o.glasses,
        headphones: o.headphones,
        bowTie: o.bowTie,
        color: o.accessoryColor,
        fabric: o.shading === 'fabric',
      },
      theme: this.#cfg?.theme,
    };
  }

  #material(): boolean {
    return this.#o.shading === 'plastic' || this.#o.shading === 'fabric';
  }

  /** What the React component did on each render (its layout effect), then its effects. */
  #effect(): void {
    if (!this.isConnected || this.#fallback) {
      if (this.#fallback) this.#shown = true;
      this.#syncLoop();
      return;
    }
    const o = this.#o;
    this.#cfg = this.#config(o);
    if (this.#shown === null) this.#shown = !this.#material();
    this.#layout();
    if (!this.#shown) this.#beginWait();
    this.#scheduleWarm();
    this.#syncLoop();
  }

  #layout(): void {
    const o = this.#o;
    if (!this.#sim) this.#sim = new Sim(o.seed, o.state);
    else this.#sim.setState(o.state);
    this.#sim.setTurn(o.turn);
    const lookKey = `${o.shading}|${o.outlineKey}|${o.size}`;
    if (this.#shown && this.#material() && this.#lastLook !== null && this.#lastLook !== lookKey && !this.#holding)
      this.#hold();
    this.#lastLook = lookKey;
    this.#sim.setJump(o.jump);
    if (this.#holding) return;
    if (this.#reduced) {
      /* the still pose of the state, no loop */
      this.#stillPaint = this.#stillDraw;
      if (this.#shown) this.#settle(this.#stillDraw);
      else this.#showWhenBaked(this.#stillDraw);
      return;
    }
    /* the surface's theme, read once per render rather than per frame */
    if (this.#cfg) this.#cfg.theme = this.#theme();
    if (!this.#shown) {
      this.#stillPaint = o.frozen ? this.#paint : null;
      this.#showWhenBaked(this.#paint);
    } else if (o.frozen) {
      this.#stillPaint = this.#paint;
      this.#settle(this.#paint);
    } else {
      this.#stillPaint = null;
      this.#stopWaiting();
      this.#paint();
    }
  }

  // ── Painting ───────────────────────────────────────────────────────────────

  #dpr(): number {
    return Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
  }

  /* paint the current pose, sizing the backing store to the element */
  #paint = (): void => {
    const canvas = this.#canvas;
    const c = this.#cfg;
    const ctx = this.#ctx;
    if (!canvas || !c || !c.path || !ctx) return;
    /* a hidden ancestor measures 0: keep the last size rather than wiping the backing store */
    const px = canvas.clientWidth / OVERSCAN || this.#cssSize || this.#o.size;
    if (!px) return;
    const dpr = this.#dpr();
    const want = Math.round(px * OVERSCAN * dpr);
    if (canvas.width !== want || canvas.height !== want) {
      canvas.width = want;
      canvas.height = want;
    }
    this.#cssSize = px;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.dpr = dpr;
    /* a held pose: the state's rest with the head turned as given — the body seen from any side, with nothing of a
       hop or a glance in it */
    const held = this.#o.pose;
    const rest0 = restPose(this.#o.state);
    const pose: Pose = held
      ? { ...rest0, yaw: held.yaw ?? 0, pitch: held.pitch ?? rest0.pitch, roll: held.roll ?? rest0.roll }
      : this.#sim
        ? this.#sim.pose
        : rest0;
    this.#draw(ctx, px, pose, c);
  };

  /* reduced motion: the state's rest pose */
  #stillDraw = (): void => {
    const canvas = this.#canvas;
    const c = this.#cfg;
    const ctx = this.#ctx;
    if (!canvas || !c || !c.path || !ctx) return;
    const px = canvas.clientWidth / OVERSCAN || this.#cssSize || this.#o.size;
    if (!px) return;
    this.#cssSize = px;
    const dpr = this.#dpr();
    canvas.width = canvas.height = Math.round(px * OVERSCAN * dpr);
    c.theme = this.#theme();
    c.dpr = dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.#draw(ctx, px, restPose(this.#o.state), c);
  };

  /** The engine's draw; should it ever throw, the still SVG takes over — the element never does. */
  #draw(ctx: CanvasRenderingContext2D, px: number, pose: Pose, c: DrawConfig): void {
    try {
      draw(ctx, px, pose, c);
    } catch {
      this.#fallback = true;
      this.#shown = true;
      this.#syncLoop();
      this.#endWait();
      this.requestRender();
    }
  }

  /* A still avatar's pile bakes on idle time like any other (made at once it would hold the page): while it draws a
     stand-in it is drawn again each time a bake lands, until a draw needs none — no animation frame will come to
     show it. */
  #settle(paintNow: () => void): void {
    takeMissed();
    paintNow();
    if (!takeMissed()) this.#stopWaiting();
    else if (!this.#waiting)
      this.#waiting = onLanded(() => {
        const p = this.#stillPaint;
        if (this.#canvas && p && this.isConnected) this.#settle(p);
        else this.#stopWaiting();
      });
  }

  #stopWaiting(): void {
    this.#waiting?.();
    this.#waiting = null;
  }

  /* An avatar in a baked material is not shown until it can be drawn in it: no flat stand-in first and the fur a few
     seconds later. It waits with its bakes hurried (see plastic.ts), drawn again as each lands, and comes in once it
     needs no stand-in and no bake is still under way — so a page of them comes in at once — or after SHOW_WITHIN. */
  #showWhenBaked(paintNow: () => void): void {
    this.#showPaint = paintNow;
    takeMissed();
    paintNow();
    this.#ready = !takeMissed();
    if (this.#ready && !bakesPending()) {
      showReady();
      return;
    }
    if (!this.#watch)
      this.#watch = onLanded(() => {
        const p = this.#showPaint;
        if (this.#canvas && p && !this.#shown && this.isConnected) this.#showWhenBaked(p);
        else this.#stopWatch();
        showReady();
      });
  }

  #stopWatch(): void {
    this.#watch?.();
    this.#watch = null;
  }

  #beginWait(): void {
    if (this.#waitingShow) return;
    this.#waitingShow = true;
    waiters.set(this, { ready: () => this.#ready, show: this.#show });
    hurry(true);
    this.#showTimer = setTimeout(this.#show, SHOW_WITHIN);
    showReady();
  }

  #endWait(): void {
    if (!this.#waitingShow) return;
    this.#waitingShow = false;
    hurry(false);
    if (this.#showTimer !== null) clearTimeout(this.#showTimer);
    this.#showTimer = null;
    this.#stopWatch();
    waiters.delete(this);
    showReady();
  }

  #show = (): void => {
    if (this.#shown) return;
    this.#shown = true;
    this.#endWait();
    this.requestRender();
  };

  /* Shown, a new shape, material or size keeps the picture it has until the new one is made (its bakes hurried),
     rather than standing in with the flat look meanwhile. The pile's style and light are not held: a slider dragged
     through them draws as it goes. */
  #hold(): void {
    this.#warm();
    if (!bakesPending()) return;
    hurry(true);
    const release = () => {
      if (!this.#holding) return;
      this.#holding();
      this.requestRender();
    };
    const off = onLanded(() => {
      if (!bakesPending()) release();
    });
    const t = setTimeout(release, SHOW_WITHIN);
    this.#holding = () => {
      off();
      clearTimeout(t);
      hurry(false);
      this.#holding = null;
    };
  }

  /* the material's bakes, queued now */
  #warm = (): void => {
    this.#warmId = null;
    const o = this.#o;
    const c = this.#cfg;
    if (!this.#material() || !c?.path) return;
    const dev = o.size * this.#dpr();
    const lightAt = c.light ?? 295;
    const a = (lightAt * Math.PI) / 180;
    const b = ((o.backLight ?? 0) * Math.PI) / 180;
    const lights = stockLights(Math.sin(a), -Math.cos(a));
    if (o.backLight !== undefined) [lights.bx, lights.by] = [Math.sin(b), -Math.cos(b)];
    if (o.lightFront !== undefined) lights.front = (o.lightFront * Math.PI) / 180;
    warmPlastic(o.outlineKey, c.path, dev, o.depth, o.shading === 'fabric', o.fur, lightAt, lights);
  };

  /* plastic and fabric bake their form per shape: start that on idle time, so the first frames do not wait long */
  #scheduleWarm(): void {
    const o = this.#o;
    const f = o.fur;
    const key = this.#material()
      ? [o.shading, o.outlineKey, o.size, o.depth, f.length, f.density, f.fuzz, f.clumps, f.curl, f.gravity]
          .concat([o.light, o.backLight ?? '', o.lightFront ?? ''])
          .join('|')
      : '';
    if (key === this.#warmKey) return;
    this.#cancelWarm();
    this.#warmKey = key;
    if (key) this.#warmId = requestIdle(this.#warm);
  }

  #cancelWarm(): void {
    if (this.#warmId !== null) cancelIdle(this.#warmId);
    this.#warmId = null;
  }

  /* the surface: the theme set, else an ancestor's say (through shadow roots), else the system's */
  #theme(): 'dark' | 'light' {
    return botAvatarSurface(this, this.#o.theme);
  }

  // ── The loop: only while connected, animated, not reduced, on screen ──────────────────────────────────────────

  #syncLoop(): void {
    const want = this.isConnected && !this.#fallback && !this.#o.frozen && !this.#reduced;
    if (want === this.#loopOn) return;
    this.#loopOn = want;
    if (!want) {
      this.#stopTick();
      this.#io?.disconnect();
      this.#io = null;
      return;
    }
    if (typeof IntersectionObserver === 'function') {
      this.#io = new IntersectionObserver((entries) => {
        const on = entries[entries.length - 1]?.isIntersecting ?? true;
        if (on) this.#run();
        else this.#stopTick();
      });
      this.#io.observe(this.#canvas ?? this);
    } else this.#run();
  }

  #run(): void {
    if (!this.#unsub && this.#loopOn) this.#unsub = subscribe(this.#tick);
  }

  #stopTick(): void {
    this.#unsub?.();
    this.#unsub = null;
  }

  #tick = (dt: number): void => {
    const s = this.#sim;
    const canvas = this.#canvas;
    if (!s || !canvas) return;
    const o = this.#o;
    if (o.interactive && !o.pose && !Number.isNaN(pointer.x)) {
      const r = canvas.getBoundingClientRect();
      const box = r.width / OVERSCAN || 1;
      const dx = (pointer.x - (r.left + r.width / 2)) / box;
      const dy = (pointer.y - (r.top + r.height / 2 + RISE * box)) / box;
      const d = Math.hypot(dx, dy);
      /* full pull up close, gone by REACH */
      const strength = d < 1 ? 1 : d > REACH ? 0 : 1 - (d - 1) / (REACH - 1);
      s.setPointer(dx / Math.max(1, d), dy / Math.max(1, d), strength);
    } else s.setPointer(0, 0, 0);
    s.update(dt * o.speed);
    /* not drawn while it waits to be shown: the frames go to its bakes */
    if (this.#shown && !this.#holding) this.#paint();
  };

  // ── Input and page signals ─────────────────────────────────────────────────

  /* A click on an interactive avatar that can hop asks first (`ui-poke`, cancelable): prevented, nothing happens;
     else it hops, and — unless it is decorative — plays a subtle tap. */
  #onClick = (e: MouseEvent): void => {
    const o = this.#o;
    if (!o.interactive || !this.#sim || o.frozen || o.pose || this.#reduced || this.#fallback) return;
    if (!this.emit('ui-poke', {})) return;
    this.#sim.poke();
    if (!(this.data?.decorative ?? this.hasAttribute('decorative'))) this.sound('tap', { emphasis: 'subtle' }, e);
  };

  #onMotion = (): void => {
    this.#sysReduced = prefersReducedMotion();
    this.requestRender();
  };
}

define('ui-bot-avatar', UiBotAvatar);

declare global {
  interface HTMLElementTagNameMap {
    'ui-bot-avatar': UiBotAvatar;
  }
}
