import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { esc, safeSrc } from '../../core/html';
import { icon } from '../../icons/icons';
import { type SampledPalette, samplePaletteFromCanvas } from './engine/palette';
import {
  accentRamp,
  colorLuminance,
  NAMED_PALETTES,
  PALETTE_NAMES,
  type PaletteName,
  PIXEL_CHURN_PRESETS,
  PRESET_NAMES,
  PRESETS,
  type PresetMode,
  type PresetName,
  parseCssColor,
  rankPalette,
  toHex,
} from './engine/presets';
import {
  createInstance,
  createRenderer,
  destroyRenderer,
  FRAME_INTERVAL_MS,
  type Instance,
  paintInstance,
  type SharedRenderer,
  updateInstanceSize,
} from './engine/renderer';
import { createReveal, loadImage, type RevealState } from './engine/reveal';
import { styles } from './styles';

/** What the host says about the picture. `auto`: the loader until `src` loads, then the reveal. */
export type ImageRevealState = 'auto' | 'loading' | 'done' | 'error';
/** Where the element is: the loader, the reveal running, the picture, or "No preview". */
export type ImageRevealPhase = 'loading' | 'revealing' | 'done' | 'error';
export type ImageRevealMotion = 'system' | 'reduce' | 'full';
export type ImageRevealLang = 'en' | 'ko';
/** How the effect is drawn now: WebGL 2, one still WebGL frame (reduced motion), the CSS mosaic, or nothing. */
export type ImageRevealRender = 'webgl' | 'still' | 'css' | 'none';
export type { PaletteName as ImageRevealPalette, PresetName as ImageRevealPreset };

export interface ImageRevealData {
  /** The picture: http(s), a relative URL, blob: or a base64 raster data:image. Anything else is no picture. */
  src?: string;
  /** What the picture shows — the text of the final `<img>`. Pass it: the built-in "Generated image" says little. */
  alt?: string;
  /** `auto` (default) · `loading` (keep the loader, even if src has loaded) · `done` (the picture, no loader) · `error`. */
  state?: ImageRevealState;
  /** How far the generation is, 0 … 1: spoken in the status ("Generating image, 40%"). */
  progress?: number;
  /** `pixels-organic` (default, Chromium Flow) · `pixels-mechanic` (Nebula) · `sweep-gradient`. */
  preset?: PresetName;
  /** The colours the mosaic wears: `preset` (its greys, default) · `accent` (the theme's accent) · `ocean` · `ember`. */
  palette?: PaletteName;
  /** Per-slot override of the seven shader colours (CSS colours; null keeps the slot). Wins over `palette`. */
  colors?: (string | null | undefined)[];
  /** The card colour (opaque CSS colour) behind the effect, instead of the theme's raised surface. */
  cardBg?: string;
  /** Cell size multiplier, 0.25 … 4 (default 1): 0.5 is a finer grid, 2 chunkier. */
  pixelScale?: number;
  /** Animation speed multiplier, 0.1 … 4 (default 1). */
  speed?: number;
  /** Effect strength, 0 … 2 (default 1): below 1 fades the mosaic, above 1 pushes its intensity. */
  strength?: number;
  /** Frame ratio: `"16 / 9"`, `"4:3"`, `1.5` … (default `"1 / 1"`), or `"fill"` to fill the host's own box. */
  aspect?: string | number;
  /** Freeze the mosaic on its current frame. */
  paused?: boolean;
  /** The status text while loading, instead of "Generating image". */
  label?: string;
  /**
   * How long the loader takes to become the picture, in ms (120 … 10000): the dissolve (and the cross-fade where
   * there is no WebGL) instead of the preset's 3 s — e.g. 280 for a picture that was only being downloaded.
   */
  revealMs?: number;
}

/** What the element draws with now: `data` first, then the attributes, each validated and clamped. */
export interface ImageRevealOptions {
  /** The picture's URL, or '' when there is none — or when `src` was not a URL it may load (see srcInvalid). */
  src: string;
  /** A `src` was given that is not a picture URL (javascript:, data:text/html …): "No preview". */
  srcInvalid: boolean;
  alt: string;
  state: ImageRevealState;
  progress: number | null;
  preset: PresetName;
  palette: PaletteName;
  colors: (string | null)[] | null;
  cardBg: string | null;
  pixelScale: number;
  speed: number;
  strength: number;
  /** `[w, h]`, or null to fill the host's box. */
  aspect: [number, number] | null;
  motion: ImageRevealMotion;
  paused: boolean;
  label: string;
  /** null: the preset's reveal (3 s) and a 600 ms cross-fade. */
  revealMs: number | null;
}

export interface ImageRevealPhaseDetail {
  phase: ImageRevealPhase;
  src: string;
}

export const IMAGE_REVEAL_STRINGS = {
  en: {
    loading: 'Generating image',
    ready: 'Image ready',
    error: 'No preview',
    alt: 'Generated image',
  },
  ko: {
    loading: '이미지를 만드는 중',
    ready: '이미지 준비 완료',
    error: '미리보기 없음',
    alt: '생성된 이미지',
  },
} as const;

/** How long the picture fades in where there is no WebGL reveal (CSS, reduced motion, offscreen), in ms. */
export const IMAGE_REVEAL_FADE_MS = 600;
/** How long the picture fades back into the mosaic when the loader returns, in ms (the library's fadeOut). */
export const IMAGE_REVEAL_HIDE_MS = 300;
/** Off screen or in a hidden tab this long, the WebGL context is released (the last frame stays drawn). */
export const IMAGE_REVEAL_IDLE_MS = 15000;
/** The clock a reduced-motion still frame is drawn at. */
const STILL_TIME = 7.5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function num(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? clamp(n, lo, hi) : dflt;
}

function pick<T extends string>(v: unknown, allowed: readonly T[], dflt: T): T {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return (allowed as readonly string[]).includes(s) ? (s as T) : dflt;
}

/**
 * A frame ratio from `"16 / 9"`, `"16/9"`, `"4:3"`, `"1.5"` or a number, as `[w, h]` with w / h clamped to 0.2 … 5;
 * `"fill"` (or `"none"`, `"auto"`) is null — the host's box. Anything unreadable is `[1, 1]`.
 */
export function revealAspect(v: unknown): [number, number] | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? [clamp(v, 0.2, 5), 1] : [1, 1];
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  if (!s) return [1, 1];
  if (s === 'fill' || s === 'none' || s === 'auto') return null;
  const m = /^(\d*\.?\d+)\s*(?:[/:]\s*(\d*\.?\d+))?$/.exec(s);
  if (!m) return [1, 1];
  const w = Number(m[1]);
  const h = m[2] === undefined ? 1 : Number(m[2]);
  if (!(w > 0 && h > 0)) return [1, 1];
  const r = w / h;
  if (r < 0.2) return [1, 5];
  if (r > 5) return [5, 1];
  return [w, h];
}

/**
 * True for a CSS colour: hex, a colour function (rgb, hsl, hwb, color, oklch, oklab, lab, lch) or a keyword — and,
 * where the browser can say, one it accepts. Never `url()`, `var()`, `attr()`, `env()` or a declaration break.
 */
export function isCssColor(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (!s || s.length > 120 || /[;{}<>]|url\(|var\(|attr\(|env\(|expression/i.test(s)) return false;
  if (s[0] === '#') return /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(s);
  const fn = /^(?:rgba?|hsla?|hwb|color|oklch|oklab|lab|lch)\([\w\s.,%/+-]*\)$/i.test(s);
  if (!fn && !/^[a-z]+$/i.test(s)) return false;
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    try {
      return CSS.supports('color', s);
    } catch {
      return fn;
    }
  }
  return fn;
}

/** The words the status speaks for a phase: the label (with the progress as a percentage) while loading. */
export function revealStatusText(
  lang: ImageRevealLang,
  phase: ImageRevealPhase | null,
  progress: number | null,
  label: string,
  announceReady: boolean,
): string {
  const t = IMAGE_REVEAL_STRINGS[lang];
  if (phase === 'error') return t.error;
  if (phase === 'done') return announceReady ? t.ready : '';
  const base = label || t.loading;
  return progress == null ? base : `${base}, ${Math.round(progress * 100)}%`;
}

/** Where the element should go: the loader, the picture, or "No preview". */
export type RevealTarget = 'loading' | 'picture' | 'error';

/**
 * The state machine's decision. `load` is the state of the picture `src` names; `regenerating` is true while `src`
 * is still the one `regenerate()` was asked for; `phase` is where the element is now (null before the first sync).
 *
 * - `state: error`, a src that is not a picture URL, an empty `src` with `state: done`, or a picture that failed
 *   → error.
 * - `state: loading`, a regeneration in flight (unless `state: done`), or a picture not loaded yet → the loader —
 *   except `state: done` with nothing on screen yet, which waits for its picture without a loader (past work).
 * - Otherwise → the picture.
 */
export function revealTarget(input: {
  state: ImageRevealState;
  src: string;
  /** A src was given that is not a picture URL. */
  invalid?: boolean;
  load: 'none' | 'pending' | 'ok' | 'fail';
  regenerating: boolean;
  phase: ImageRevealPhase | null;
}): RevealTarget {
  const { state, src, invalid, load, regenerating, phase } = input;
  if (state === 'error' || invalid) return 'error';
  if (!src) return state === 'done' ? 'error' : 'loading';
  if (load === 'fail') return 'error';
  // A regeneration holds the loader on the old src — unless the host says that picture is final after all.
  if (state === 'loading' || (regenerating && state !== 'done')) return 'loading';
  if (load === 'ok') return 'picture';
  if (state === 'done' && phase !== 'loading' && phase !== 'revealing') return 'picture';
  return 'loading';
}

/** The seven-slot colour override for a palette name, or null for the preset's own greys. */
export function revealPaletteColors(
  mode: Pick<PresetMode, 'colors' | 'cardBg'>,
  palette: PaletteName,
  accent: string,
): (string | null)[] | null {
  if (palette === 'ocean' || palette === 'ember') return rankPalette(mode, NAMED_PALETTES[palette]);
  if (palette === 'accent') return rankPalette(mode, accentRamp(accent || '#4b7bec'));
  return null;
}

function context2d(c: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  try {
    return c?.getContext?.('2d') ?? null;
  } catch {
    return null;
  }
}

/** The browser has WebGL 2 at all (no context is made to find out). */
const hasWebGl2 = (): boolean => typeof WebGL2RenderingContext !== 'undefined';

/** Alpha of a computed colour string (1 when it carries none; 0 for `transparent`). */
function alphaOf(color: string): number {
  const s = color.trim().toLowerCase();
  if (!s || s === 'transparent') return 0;
  const slash = /\/\s*([\d.]+)(%?)\s*\)$/.exec(s);
  if (slash) return Number(slash[1]) / (slash[2] ? 100 : 1);
  const rgba = /^rgba\((?:[^,]+,){3}\s*([\d.]+)\s*\)$/.exec(s);
  return rgba ? Number(rgba[1]) : 1;
}

/**
 * `<ui-image-reveal>` — a loader that becomes the picture. While an image is being made (or loaded) a WebGL pixel
 * mosaic cycles in the frame — Chromium Flow, Nebula or a gradient sweep — and when the picture arrives the mosaic
 * dissolves into it cell by cell. Then the canvas goes away: what is left is a real `<img>` with its alt text, and the
 * WebGL context is released. Attributes or `data`.
 *
 * Loading is `role="status"` with `aria-busy` and a label (en / ko); a picture that fails is "No preview", not an
 * endless loader. Without WebGL 2 (or on a lost context) the loader is a CSS mosaic and the picture fades in; under
 * reduced motion the mosaic is one still frame and the picture cross-fades. No frames off screen, in a hidden tab or
 * while paused; one context per element, made only once its loader runs on screen.
 *
 * Ported from Libraries.dev's `img-fx` 0.5.2 (MIT, © 2026 Jakub Antalik — https://libraries.dev/image); three.js and
 * React are gone: the engine runs on a raw WebGL 2 context.
 */
export class UiImageReveal extends UiElement<ImageRevealData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return [
      'src',
      'alt',
      'state',
      'progress',
      'preset',
      'palette',
      'pixel-scale',
      'speed',
      'strength',
      'aspect',
      'card-bg',
      'motion',
      'paused',
      'label',
      'reveal-ms',
      'lang',
      'theme',
    ];
  }

  // Skeleton nodes, built once.
  #frame: HTMLElement | null = null;
  #fx: HTMLElement | null = null;
  #status: HTMLElement | null = null;
  #emptyText: HTMLElement | null = null;
  #probe: HTMLElement | null = null;
  #img: HTMLImageElement | null = null;
  // The effect.
  #gl: SharedRenderer | null = null;
  #inst: Instance | null = null;
  #reveal: RevealState | null = null;
  #shaderCanvas: HTMLCanvasElement | null = null;
  #overlayCanvas: HTMLCanvasElement | null = null;
  #render: ImageRevealRender = 'none';
  /** No WebGL 2 here (or it failed): the CSS mosaic for good. */
  #glFailed = false;
  /** The browser evicted the context: the CSS mosaic until the element next starts to run. */
  #evicted = false;
  /** What the last still frame showed (#stillKey), so an unchanged one is not drawn again. */
  #stillDrawn = '';
  /** Whether the element could run when last asked (on screen, a shown tab, not paused). */
  #couldRun = false;
  // State.
  #opts: ImageRevealOptions | null = null;
  #phase: ImageRevealPhase | null = null;
  #picture: { src: string; img: HTMLImageElement | null } | null = null;
  #announce = false;
  #regenFrom: string | null = null;
  #regenTint: SampledPalette | null = null;
  #regenPreset: PresetName | null = null;
  // The picture `src` names, loading or loaded.
  #loadSrc = '';
  #loadState: 'none' | 'pending' | 'ok' | 'fail' = 'none';
  #loaded: HTMLImageElement | null = null;
  #loadToken = 0;
  // Surface (theme) read from the computed style.
  #dark = false;
  #surface: string | null = null;
  #accent = '';
  #surfaceStale = true;
  // Size (CSS px).
  #w = 0;
  #h = 0;
  // Loop.
  #raf = 0;
  #lastFrame = 0;
  #lastTick = 0;
  #visible = true;
  #reduced = false;
  #idleTimer: ReturnType<typeof setTimeout> | null = null;
  #fadeTimer: ReturnType<typeof setTimeout> | null = null;
  #stillTimer: ReturnType<typeof setTimeout> | null = null;
  #ro: ResizeObserver | null = null;
  #io: IntersectionObserver | null = null;
  #mo: MutationObserver | null = null;
  #scheme: MediaQueryList | null = null;
  #motion: MediaQueryList | null = null;

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if (old === value) return;
    if (name === 'theme') this.#surfaceStale = true;
    this.requestRender();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Off screen until the IntersectionObserver's first report says otherwise: no context for a loader below the fold.
    this.#visible = typeof IntersectionObserver !== 'function';
    this.#surfaceStale = true;
    if (typeof IntersectionObserver === 'function') {
      this.#io = new IntersectionObserver((entries) => {
        const e = entries[entries.length - 1];
        if (!e) return;
        this.#visible = e.isIntersecting;
        this.#onRunnable();
      });
      this.#io.observe(this);
    }
    if (typeof MutationObserver === 'function') {
      this.#mo = new MutationObserver(this.#onTheme);
      const watch = { attributes: true, subtree: true, attributeFilter: ['data-theme', 'data-palette', 'data-design'] };
      this.#mo.observe(document.documentElement, watch);
      const root = this.getRootNode();
      if (root !== document && root instanceof ShadowRoot) this.#mo.observe(root, watch);
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
    this.#teardownEffect();
    this.#clearTimers();
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
    // Coming back is a fresh start: the loader (or the picture) is drawn again from the current inputs.
    this.#phase = null;
    this.#picture = null;
    this.#glFailed = false;
    this.#evicted = false;
    this.#couldRun = false;
    this.#img?.remove();
    this.#img = null;
    super.disconnectedCallback();
  }

  /** What it draws with, from `data` first, then the attributes — each validated and clamped. */
  get options(): ImageRevealOptions {
    const d = this.data ?? {};
    const a = (n: string) => this.getAttribute(n);
    const rawSrc = String(d.src ?? a('src') ?? '').trim();
    const progressRaw = d.progress ?? a('progress');
    const colors = Array.isArray(d.colors) ? d.colors.slice(0, 7).map((c) => (isCssColor(c) ? c.trim() : null)) : null;
    const cardBg = d.cardBg ?? a('card-bg');
    const pausedAttr = a('paused');
    const revealRaw = d.revealMs ?? a('reveal-ms');
    const revealMs = revealRaw == null || revealRaw === '' ? Number.NaN : num(revealRaw, 120, 10000, Number.NaN);
    const progress =
      progressRaw == null || (typeof progressRaw === 'string' && !progressRaw.trim())
        ? Number.NaN
        : num(progressRaw, 0, 1, Number.NaN);
    return {
      src: safeSrc(rawSrc) ? rawSrc : '',
      srcInvalid: rawSrc !== '' && !safeSrc(rawSrc),
      alt: String(d.alt ?? a('alt') ?? '').trim(),
      state: pick(d.state ?? a('state'), ['auto', 'loading', 'done', 'error'] as const, 'auto'),
      progress: Number.isNaN(progress) ? null : progress,
      preset: pick(d.preset ?? a('preset'), PRESET_NAMES, 'pixels-organic'),
      palette: pick(d.palette ?? a('palette'), PALETTE_NAMES, 'preset'),
      colors: colors?.some((c) => c != null) ? colors : null,
      cardBg: isCssColor(cardBg) ? cardBg.trim() : null,
      pixelScale: num(d.pixelScale ?? a('pixel-scale'), 0.25, 4, 1),
      speed: num(d.speed ?? a('speed'), 0.1, 4, 1),
      strength: num(d.strength ?? a('strength'), 0, 2, 1),
      aspect: revealAspect(d.aspect ?? a('aspect')),
      motion: pick(a('motion'), ['system', 'reduce', 'full'] as const, 'system'),
      paused: d.paused ?? (pausedAttr !== null && pausedAttr !== 'false'),
      label: String(d.label ?? a('label') ?? '').trim(),
      revealMs: Number.isNaN(revealMs) ? null : revealMs,
    };
  }

  /** Where it is: the loader, the reveal, the picture, or "No preview". */
  get phase(): ImageRevealPhase {
    return this.#phase ?? 'loading';
  }

  /** How the effect is drawn now. */
  get rendering(): ImageRevealRender {
    return this.#render;
  }

  /** True while the frame loop is scheduled. */
  get running(): boolean {
    return this.#raf !== 0;
  }

  /**
   * Regenerate: the picture on screen breaks back into the mosaic's cells and churns, tinted with its own colours,
   * until the host gives a new `src` — which then dissolves in over the churn. Without WebGL (or under reduced
   * motion) the picture fades back into the loader. Returns false when there is no picture to regenerate from.
   */
  regenerate(): boolean {
    const o = this.#opts ?? this.options;
    const pic = this.#picture;
    if ((this.#phase !== 'done' && this.#phase !== 'revealing') || !pic?.img) return false;
    this.#regenFrom = o.src;
    if (this.#wantsGl()) {
      const churn = PIXEL_CHURN_PRESETS.includes(o.preset)
        ? null
        : PIXEL_CHURN_PRESETS[Math.floor(Math.random() * PIXEL_CHURN_PRESETS.length)];
      const mode = PRESETS[churn ?? o.preset].modes[this.#dark ? 'dark' : 'light'];
      this.#regenPreset = churn;
      this.#regenTint = samplePaletteFromCanvas(pic.img, mode.colors);
      this.#layout(o);
    }
    this.#sync('boil');
    return true;
  }

  get #lang(): ImageRevealLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  protected render(): string {
    const t = IMAGE_REVEAL_STRINGS[this.#lang];
    return `<div class="ir" part="frame" data-phase="loading" data-render="none" aria-busy="true"><div class="ir-fallback" part="fallback" aria-hidden="true"></div><div class="ir-fx" aria-hidden="true"></div><div class="ir-empty" part="empty" aria-hidden="true">${icon('image', { size: 22 })}<span class="ir-empty-text">${esc(t.error)}</span></div><div class="ir-slot"><slot></slot></div></div><span class="sr-only ir-status" role="status"></span><span class="ir-probe" aria-hidden="true"></span>`;
  }

  /** The skeleton is drawn once and kept: later renders patch it, never replace it (the canvases live in it). */
  protected override update(): void {
    if (!this.#frame) {
      this.content.innerHTML = this.render();
      this.#frame = this.content.querySelector<HTMLElement>('.ir');
      this.#fx = this.content.querySelector<HTMLElement>('.ir-fx');
      this.#status = this.content.querySelector<HTMLElement>('.ir-status');
      this.#emptyText = this.content.querySelector<HTMLElement>('.ir-empty-text');
      this.#probe = this.content.querySelector<HTMLElement>('.ir-probe');
    }
    // First render, or reconnected: watch the frame's size.
    if (!this.#ro && typeof ResizeObserver === 'function' && this.#frame) {
      this.#ro = new ResizeObserver((entries) => {
        const box = entries[entries.length - 1]?.contentRect;
        if (box) this.#resize(box.width, box.height);
      });
      this.#ro.observe(this.#frame);
    }
    const prev = this.#opts;
    const o = this.options;
    this.#opts = o;
    this.#reduced = o.motion === 'reduce' || (o.motion === 'system' && prefersReducedMotion());
    // Light or dark follows the card the effect sits on: a new card colour (or palette) reads the surface again.
    if (prev && (prev.preset !== o.preset || prev.palette !== o.palette || prev.cardBg !== o.cardBg)) {
      this.#surfaceStale = true;
    }
    this.#layout(o);
    if (this.#surfaceStale) this.#readSurface();
    this.#sync();
    this.#syncParams();
    this.#onRunnable();
    this.updated();
  }

  // ── Layout and surface ─────────────────────────────────────────────────────

  #layout(o: ImageRevealOptions): void {
    const f = this.#frame;
    if (!f) return;
    if (o.aspect) {
      f.style.aspectRatio = `${o.aspect[0]} / ${o.aspect[1]}`;
      f.removeAttribute('data-fill');
    } else {
      f.style.aspectRatio = '';
      f.setAttribute('data-fill', '');
    }
    const bg = this.#regenTint?.cardBg ?? o.cardBg;
    if (bg) f.style.setProperty('--ir-bg', toHex(parseCssColor(bg)));
    else f.style.removeProperty('--ir-bg');
    f.style.setProperty('--ir-scale', String(o.pixelScale));
    f.style.setProperty('--ir-strength', String(clamp(o.strength, 0, 1)));
    f.style.setProperty('--ir-speed', String(o.speed));
    f.style.setProperty('--ir-fade', `${this.#fadeMs(o)}ms`);
    f.toggleAttribute('data-paused', o.paused);
    f.toggleAttribute('data-reduced', this.#reduced);
    if (this.#w === 0 && this.#h === 0 && !this.#ro) {
      const r = f.getBoundingClientRect?.();
      if (r) this.#resize(r.width, r.height);
    }
  }

  /** Light or dark, the card colour and the accent, from the computed style (again only when the theme may change). */
  #readSurface(): void {
    this.#surfaceStale = false;
    let bg = '';
    let text = '';
    let accent = '';
    try {
      if (this.#frame) bg = getComputedStyle(this.#frame).backgroundColor || '';
      text = getComputedStyle(this).color || '';
      if (this.#probe) accent = getComputedStyle(this.#probe).color || '';
    } catch {
      // Not styled yet.
    }
    if (bg && alphaOf(bg) >= 0.5 && /^(#|rgb|color\()/i.test(bg.trim())) {
      this.#surface = toHex(parseCssColor(bg));
      this.#dark = colorLuminance(this.#surface) < 0.5;
    } else {
      this.#surface = null;
      if (text && /^(#|rgb|color\()/i.test(text.trim())) this.#dark = colorLuminance(text) > 0.5;
      else {
        const pinned = this.getAttribute('theme');
        this.#dark =
          pinned === 'dark' ||
          (pinned !== 'light' &&
            typeof matchMedia === 'function' &&
            matchMedia('(prefers-color-scheme: dark)').matches);
      }
    }
    this.#accent = accent && /^(#|rgb|color\()/i.test(accent.trim()) ? toHex(parseCssColor(accent)) : '';
  }

  /** The preset mode in effect (a regeneration's churn preset first). */
  #mode(o: ImageRevealOptions): PresetMode {
    return PRESETS[this.#regenPreset ?? o.preset].modes[this.#dark ? 'dark' : 'light'];
  }

  /** Push the options into the running instance (uniforms are re-uploaded on its next frame). */
  #syncParams(): void {
    const o = this.#opts;
    const inst = this.#inst;
    if (!o) return;
    const mode = this.#mode(o);
    const palette = revealPaletteColors(mode, o.palette, this.#accent);
    if (this.#frame) {
      // The CSS mosaic wears the palette too: its brightest colour tints the cells.
      const tint = (this.#regenTint?.colors ?? o.colors ?? palette ?? []).filter((c): c is string => !!c);
      if (tint.length) {
        const brightest = tint.reduce((a, b) => (colorLuminance(b) > colorLuminance(a) ? b : a));
        this.#frame.style.setProperty('--ir-tint', toHex(parseCssColor(brightest)));
      } else this.#frame.style.removeProperty('--ir-tint');
    }
    if (!inst) return;
    inst.preset = mode;
    inst.cardBgOverride = this.#regenTint?.cardBg ?? o.cardBg ?? this.#surface;
    inst.colorsOverride = this.#regenTint?.colors ?? o.colors ?? palette;
    inst.strength = o.strength;
    inst.speedMul = o.speed;
    inst.pixelScale = o.pixelScale;
    inst.revealSeconds = o.revealMs == null ? null : o.revealMs / 1000;
    inst.uniformsDirty = true;
    if (this.#gl) this.#gl.lastInstance = null;
    if (this.#render === 'still') this.#queueStill();
  }

  #resize(w: number, h: number): void {
    const cw = Math.max(0, Math.round(Number.isFinite(w) ? w : 0));
    const ch = Math.max(0, Math.round(Number.isFinite(h) ? h : 0));
    if (cw === this.#w && ch === this.#h) return;
    const first = this.#w === 0 || this.#h === 0;
    this.#w = cw;
    this.#h = ch;
    if (this.#inst) {
      updateInstanceSize(this.#inst, cw, ch);
      // The first size draws the still frame at once; later ones (a window drag) settle first.
      if (this.#render === 'still') {
        if (first) this.#paintStill();
        else this.#queueStill();
      } else if (this.#render === 'webgl') {
        // Resizing cleared the canvas: draw now, not on the next frame.
        this.#paintNow();
        this.#start();
      }
    }
  }

  // ── The state machine ──────────────────────────────────────────────────────

  /** Start (or keep) loading the picture `src` names; a finished load syncs again. */
  #ensureLoad(src: string): void {
    if (src === this.#loadSrc) return;
    this.#loadSrc = src;
    this.#loaded = null;
    const token = ++this.#loadToken;
    if (!src) {
      this.#loadState = 'none';
      return;
    }
    this.#loadState = 'pending';
    let p: Promise<HTMLImageElement>;
    try {
      p = loadImage(src);
    } catch {
      this.#loadState = 'fail';
      return;
    }
    p.then(
      (img) => {
        if (token !== this.#loadToken) return;
        this.#loadState = 'ok';
        this.#loaded = img;
        if (this.isConnected) this.#sync();
      },
      () => {
        if (token !== this.#loadToken) return;
        this.#loadState = 'fail';
        if (this.isConnected) this.#sync();
      },
    );
  }

  #sync(back: 'boil' | 'hide' = 'hide'): void {
    const o = this.#opts;
    if (!o || !this.#frame || !this.isConnected) return;
    this.#ensureLoad(o.src);
    const regenerating = this.#regenFrom !== null && o.src === this.#regenFrom;
    const target = revealTarget({
      state: o.state,
      src: o.src,
      invalid: o.srcInvalid,
      load: this.#loadState,
      regenerating,
      phase: this.#phase,
    });
    if (target === 'error') this.#toError();
    else if (target === 'loading') {
      // A new picture asked for while one is on screen: the old one churns (regenerate) until it arrives.
      const fresh = o.src !== '' && this.#picture != null && o.src !== this.#picture.src;
      this.#toLoading(back === 'boil' || fresh ? 'boil' : 'hide');
    } else this.#toPicture();
    this.#syncA11y();
  }

  #setPhase(next: ImageRevealPhase): void {
    if (this.#phase === next) return;
    this.#phase = next;
    if (this.#frame) {
      this.#frame.dataset.phase = next;
      this.#frame.setAttribute('aria-busy', String(next === 'loading' || next === 'revealing'));
    }
    this.notify<ImageRevealPhaseDetail>('ui-phase-change', { phase: next, src: this.#opts?.src ?? '' });
  }

  #syncA11y(): void {
    const o = this.#opts;
    if (!o) return;
    const text = revealStatusText(this.#lang, this.#phase, o.progress, o.label, this.#announce);
    if (this.#status && this.#status.textContent !== text) this.#status.textContent = text;
    const t = IMAGE_REVEAL_STRINGS[this.#lang];
    if (this.#emptyText && this.#emptyText.textContent !== t.error) this.#emptyText.textContent = t.error;
    if (this.#img) {
      const alt = o.alt || t.alt;
      if (this.#img.alt !== alt) this.#img.alt = alt;
    }
  }

  #toError(): void {
    if (this.#phase === 'error') return;
    this.#regenFrom = null;
    this.#clearRegen();
    this.#teardownEffect();
    this.#clearFade();
    this.#picture = null;
    this.#img?.remove();
    this.#img = null;
    this.#announce = false;
    this.#setPhase('error');
  }

  #toLoading(back: 'boil' | 'hide'): void {
    const prev = this.#phase;
    this.#announce = false;
    if (prev === 'loading') {
      this.#ensureEffect();
      return;
    }
    this.#clearFade();
    const pic = this.#picture;
    this.#evicted = false;
    this.#setPhase('loading');
    if ((prev === 'done' || prev === 'revealing') && pic?.img && this.#wantsGl() && this.#canAnimate()) {
      this.#ensureEffect();
      const reveal = this.#reveal;
      if (this.#render === 'webgl' && reveal) {
        if (reveal.phase() !== 'boil') {
          if (prev === 'done' || reveal.phase() !== 'reveal') reveal.startHold(pic.img);
          if (back === 'boil') reveal.startBoil();
          else reveal.startHide(IMAGE_REVEAL_HIDE_MS);
        }
        this.#syncParams();
        this.#paintNow();
        this.#hideImg(true);
        this.#start();
        if (back === 'hide') this.#picture = null;
        return;
      }
    }
    // No WebGL animation: the picture fades out over the loader.
    this.#picture = back === 'boil' ? pic : null;
    this.#ensureEffect();
    this.#hideImg(false);
  }

  #toPicture(): void {
    const o = this.#opts;
    if (!o) return;
    const img = this.#loadState === 'ok' ? this.#loaded : null;
    const phase = this.#phase;
    if (phase === 'done') {
      const pic = this.#picture;
      if (pic && pic.src === o.src) {
        if (!pic.img && img) {
          pic.img = img;
          this.#showImg(o.src, false);
        }
        return;
      }
      // A new picture while one is shown and the host says done: swap once it has loaded.
      if (!img) return;
      this.#picture = { src: o.src, img };
      this.#showImg(o.src, false);
      return;
    }
    if (phase === 'revealing') {
      if (this.#picture?.src === o.src) return;
      if (!img) return;
      this.#beginReveal(o.src, img);
      return;
    }
    if (phase === 'loading' && img) {
      this.#beginReveal(o.src, img);
      return;
    }
    // Nothing on screen yet (or "No preview"): the picture, no loader.
    this.#teardownEffect();
    this.#picture = { src: o.src, img };
    this.#announce = false;
    this.#setPhase('done');
    this.#showImg(o.src, !img);
  }

  /** The loader on screen becomes the picture: the WebGL dissolve, or a cross-fade. */
  #beginReveal(src: string, img: HTMLImageElement): void {
    this.#clearFade();
    this.#picture = { src, img };
    this.#announce = true;
    this.#setPhase('revealing');
    const reveal = this.#reveal;
    if (this.#render === 'webgl' && reveal && this.#canRun() && this.#w > 0 && this.#h > 0) {
      reveal.startReveal({
        image: img,
        cssWidth: this.#w,
        cssHeight: this.#h,
        onRevealComplete: () => queueMicrotask(() => this.#settle(src)),
      });
      this.#start();
      return;
    }
    // CSS mosaic, a still frame, or no frames running: cross-fade.
    this.#showImg(src, false);
    this.#fadeTimer = setTimeout(() => {
      this.#fadeTimer = null;
      this.#settle(src);
    }, this.#fadeMs());
  }

  /** The reveal finished: the `<img>` takes over (once decoded, so nothing flashes) and the effect is released. */
  #settle(src: string): void {
    if (this.#phase !== 'revealing' || this.#picture?.src !== src) return;
    this.#regenFrom = null;
    this.#clearRegen();
    this.#setPhase('done');
    this.#syncA11y();
    const el = this.#ensureImg(src);
    const finish = () => {
      if (this.#phase !== 'done' || this.#picture?.src !== src) return;
      el.dataset.instant = '';
      el.dataset.show = '';
      this.#teardownEffect();
    };
    if (this.#render === 'webgl' && typeof el.decode === 'function') el.decode().then(finish, finish);
    else finish();
  }

  #clearRegen(): void {
    if (!this.#regenTint && !this.#regenPreset) return;
    this.#regenTint = null;
    this.#regenPreset = null;
    this.#surfaceStale = true;
    if (this.#opts) this.#layout(this.#opts);
    this.#readSurface();
    this.#syncParams();
  }

  // ── The picture ────────────────────────────────────────────────────────────

  #ensureImg(src: string): HTMLImageElement {
    let el = this.#img;
    if (!el) {
      el = document.createElement('img');
      el.className = 'ir-img';
      el.setAttribute('part', 'image');
      el.decoding = 'async';
      el.draggable = false;
      this.#fx?.after(el);
      this.#img = el;
    }
    if (el.getAttribute('src') !== src) el.src = src;
    const o = this.#opts;
    el.alt = o?.alt || IMAGE_REVEAL_STRINGS[this.#lang].alt;
    return el;
  }

  /** Show the picture: a fade, or (`wait`) a fade once it has loaded. */
  #showImg(src: string, wait: boolean): void {
    const el = this.#ensureImg(src);
    delete el.dataset.instant;
    if (!wait) {
      // Let the browser see the hidden state first, so the fade runs.
      void el.offsetWidth;
      el.dataset.show = '';
      return;
    }
    delete el.dataset.show;
    el.addEventListener(
      'load',
      () => {
        if (this.#img === el) el.dataset.show = '';
      },
      { once: true },
    );
  }

  /** Hide the picture: at once (the effect already shows it) or with a fade. */
  #hideImg(instant: boolean): void {
    const el = this.#img;
    if (!el) return;
    if (instant) el.dataset.instant = '';
    else delete el.dataset.instant;
    delete el.dataset.show;
  }

  // ── The effect ─────────────────────────────────────────────────────────────

  #wantsGl(): boolean {
    return !this.#glFailed && !this.#reduced && hasWebGl2();
  }

  /**
   * The loader is drawn: WebGL (a loop, or a still frame under reduced motion), else the CSS mosaic. The canvases
   * go in now; the WebGL context only once the element can run (on screen, a shown tab, not paused) — twenty
   * loaders down a page are twenty canvases, not twenty contexts.
   */
  #ensureEffect(): void {
    // A browser without WebGL 2 at all is known at once; one whose GPU refuses it is found on the first frame.
    if (!hasWebGl2()) this.#glFailed = true;
    const want: ImageRevealRender = this.#glFailed || this.#evicted ? 'css' : this.#reduced ? 'still' : 'webgl';
    if (want === 'css') {
      this.#fallback(!this.#evicted);
      return;
    }
    if (!this.#inst && !this.#createInstance()) {
      this.#fallback();
      return;
    }
    if (want === 'webgl') {
      if (this.#render !== 'webgl') {
        this.#setRender('webgl');
        this.#syncParams();
      }
      this.#paintNow();
      this.#start();
      return;
    }
    // Reduced motion: drawn once; a change that alters the picture repaints it through #queueStill.
    if (this.#render === 'still') return;
    this.#stop();
    if (this.#gl) {
      destroyRenderer(this.#gl);
      this.#gl = null;
    }
    this.#setRender('still');
    this.#syncParams();
    this.#paintStill();
  }

  #createInstance(): boolean {
    const fx = this.#fx;
    if (!fx) return false;
    const shader = document.createElement('canvas');
    shader.className = 'ir-shader';
    shader.setAttribute('aria-hidden', 'true');
    const overlay = document.createElement('canvas');
    overlay.className = 'ir-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    if (!context2d(shader) || !context2d(overlay)) return false;
    const o = this.#opts ?? this.options;
    const inst = createInstance({
      canvas: shader,
      cssWidth: this.#w,
      cssHeight: this.#h,
      preset: this.#mode(o),
      strength: o.strength,
      speed: o.speed,
      cardBg: o.cardBg ?? this.#surface,
      pixelScale: o.pixelScale,
    });
    const reveal = inst
      ? createReveal({ canvas: overlay, cssWidth: this.#w, cssHeight: this.#h, shaderCanvas: shader })
      : null;
    if (!inst || !reveal) return false;
    inst.reveal = reveal;
    fx.append(shader);
    fx.after(overlay);
    this.#shaderCanvas = shader;
    this.#overlayCanvas = overlay;
    this.#inst = inst;
    this.#reveal = reveal;
    return true;
  }

  #setRender(r: ImageRevealRender): void {
    this.#render = r;
    if (this.#frame) this.#frame.dataset.render = r;
  }

  /**
   * The CSS mosaic. `permanent`: no WebGL 2 or a failure in it — for good. Otherwise (the browser evicted the
   * context for a newer one) only until the element next starts to run. A reveal in flight becomes a cross-fade.
   */
  #fallback(permanent = true): void {
    if (permanent) this.#glFailed = true;
    else this.#evicted = true;
    const revealing = this.#phase === 'revealing' && this.#picture?.img;
    this.#teardownEffect();
    if (this.#phase === 'loading' || this.#phase === 'revealing') this.#setRender('css');
    if (revealing && this.#picture?.img && !this.#fadeTimer) {
      const src = this.#picture.src;
      this.#showImg(src, false);
      this.#fadeTimer = setTimeout(() => {
        this.#fadeTimer = null;
        this.#settle(src);
      }, this.#fadeMs());
    }
  }

  #onLost = (): void => {
    // The browser took the context (often for a newer one elsewhere): never throw, draw the CSS mosaic meanwhile.
    this.#gl = null;
    this.#fallback(false);
  };

  /** Stop the loop, release the context and drop the canvases. */
  #teardownEffect(): void {
    this.#stop();
    this.#clearIdle();
    if (this.#stillTimer) {
      clearTimeout(this.#stillTimer);
      this.#stillTimer = null;
    }
    this.#stillDrawn = '';
    if (this.#gl) {
      destroyRenderer(this.#gl);
      this.#gl = null;
    }
    this.#reveal?.dispose();
    this.#reveal = null;
    if (this.#inst) this.#inst.reveal = null;
    this.#inst = null;
    for (const c of [this.#shaderCanvas, this.#overlayCanvas]) {
      if (!c) continue;
      c.width = 0;
      c.height = 0;
      c.remove();
    }
    this.#shaderCanvas = null;
    this.#overlayCanvas = null;
    this.#setRender('none');
  }

  /** The context, made now if there is none (the first frame, or after a release). False: no WebGL 2 here. */
  #context(): SharedRenderer | null {
    if (this.#gl) return this.#gl;
    this.#gl = createRenderer(this.#onLost);
    if (!this.#gl) {
      this.#fallback();
      return null;
    }
    if (this.#inst) this.#inst.uniformsDirty = true;
    return this.#gl;
  }

  /** Draw one frame now (after a resize or a state change), so nothing shows a blank canvas for a tick. */
  #paintNow(): void {
    const inst = this.#inst;
    if (!inst || this.#render !== 'webgl' || inst.cssWidth < 1 || inst.cssHeight < 1 || !this.#canRun()) return;
    const gl = this.#context();
    if (!gl) return;
    try {
      paintInstance(gl, inst, performance.now());
    } catch {
      this.#fallback();
    }
  }

  #queueStill(): void {
    if (this.#stillTimer) return;
    this.#stillTimer = setTimeout(() => {
      this.#stillTimer = null;
      if (this.#render === 'still') this.#paintStill();
    }, 120);
  }

  /** What a still frame depends on: a progress tick or a label change does not repaint it. */
  #stillKey(inst: Instance): string {
    const p = inst.preset;
    return [
      inst.cssWidth,
      inst.cssHeight,
      inst.dpr,
      p.effectIndex,
      p.theme,
      inst.cardBgOverride,
      (inst.colorsOverride ?? []).join(','),
      inst.strength,
      inst.pixelScale,
    ].join('|');
  }

  /**
   * Reduced motion: one frame through a short-lived context, released at once (the 2D canvas keeps it) — and only
   * when what it shows changed.
   */
  #paintStill(): void {
    const inst = this.#inst;
    if (!inst || inst.cssWidth < 1 || inst.cssHeight < 1) return;
    const key = this.#stillKey(inst);
    if (key === this.#stillDrawn) return;
    const gl = createRenderer();
    if (!gl) {
      this.#fallback();
      return;
    }
    try {
      inst.accumulatedTime = STILL_TIME;
      inst.uniformsDirty = true;
      paintInstance(gl, inst, performance.now());
    } catch {
      destroyRenderer(gl);
      this.#fallback();
      return;
    }
    destroyRenderer(gl);
    this.#stillDrawn = key;
  }

  // ── The loop ───────────────────────────────────────────────────────────────

  #canAnimate(): boolean {
    return (
      this.isConnected &&
      this.#visible &&
      !(typeof document !== 'undefined' && document.hidden) &&
      typeof requestAnimationFrame === 'function'
    );
  }

  #canRun(): boolean {
    return this.#render === 'webgl' && !this.#opts?.paused && this.#canAnimate();
  }

  /**
   * Run the loop if it can. If it cannot (off screen, a hidden tab, paused): stop, arm the idle release of the
   * context, and finish a reveal in flight at once — a picture never waits behind a frozen loader.
   */
  #start(): void {
    if (this.#canRun()) {
      this.#clearIdle();
      if (this.#raf) return;
      const now = performance.now();
      this.#lastTick = now;
      this.#lastFrame = now;
      this.#raf = requestAnimationFrame(this.#frameCb);
      return;
    }
    this.#stop();
    this.#armIdle();
    if (this.#phase === 'revealing' && this.#render === 'webgl' && this.#picture) this.#settle(this.#picture.src);
  }

  #stop(): void {
    if (this.#raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.#raf);
    this.#raf = 0;
  }

  /** The context goes after IMAGE_REVEAL_IDLE_MS without a frame (the last frame stays drawn). */
  #armIdle(): void {
    if (!this.#gl || this.#idleTimer) return;
    this.#idleTimer = setTimeout(() => {
      this.#idleTimer = null;
      if (this.#raf || !this.#gl) return;
      destroyRenderer(this.#gl);
      this.#gl = null;
    }, IMAGE_REVEAL_IDLE_MS);
  }

  /** The cross-fade where there is no WebGL dissolve: `revealMs`, else IMAGE_REVEAL_FADE_MS. */
  #fadeMs(o: ImageRevealOptions | null = this.#opts): number {
    return o?.revealMs ?? IMAGE_REVEAL_FADE_MS;
  }

  /**
   * The frame cap: the library's 10 fps, except during a reveal shortened below the preset's — a 280 ms dissolve at
   * 10 fps would be three frames — which draws about a dozen frames (60 fps at most).
   */
  #interval(): number {
    const ms = this.#opts?.revealMs;
    if (ms == null || this.#phase !== 'revealing') return FRAME_INTERVAL_MS;
    return Math.max(1000 / 60, Math.min(FRAME_INTERVAL_MS, ms / 12));
  }

  #frameCb = (now: number): void => {
    this.#raf = 0;
    if (!this.#canRun()) return;
    this.#raf = requestAnimationFrame(this.#frameCb);
    const elapsed = now - this.#lastFrame;
    const interval = this.#interval();
    if (elapsed < interval) return;
    this.#lastFrame = now - (elapsed % interval);
    const delta = Math.min(0.25, Math.max(0, (now - this.#lastTick) / 1000));
    this.#lastTick = now;
    const inst = this.#inst;
    if (!inst) return;
    inst.accumulatedTime += delta * inst.speedMul;
    if (inst.cssWidth < 1 || inst.cssHeight < 1) return;
    // The context is made here, on the first frame that runs (and again after an idle release).
    const gl = this.#context();
    if (!gl) return;
    try {
      paintInstance(gl, inst, now);
    } catch {
      this.#fallback();
    }
  };

  /**
   * Visibility, tab or pause changed. Coming back after an evicted context retries WebGL; then run if it can, else
   * stop (see #start).
   */
  #onRunnable(): void {
    const can = this.#canAnimate() && !this.#opts?.paused;
    const back = can && !this.#couldRun;
    this.#couldRun = can;
    if (back && this.#evicted && (this.#phase === 'loading' || this.#phase === 'revealing')) {
      this.#evicted = false;
      this.#ensureEffect();
      return;
    }
    if (this.#render === 'webgl') this.#start();
  }

  #clearIdle(): void {
    if (this.#idleTimer) clearTimeout(this.#idleTimer);
    this.#idleTimer = null;
  }

  #clearFade(): void {
    if (this.#fadeTimer) clearTimeout(this.#fadeTimer);
    this.#fadeTimer = null;
  }

  #clearTimers(): void {
    this.#clearIdle();
    this.#clearFade();
    if (this.#stillTimer) clearTimeout(this.#stillTimer);
    this.#stillTimer = null;
  }

  // ── Page signals ───────────────────────────────────────────────────────────

  #onTheme = (): void => {
    this.#surfaceStale = true;
    this.requestRender();
  };

  #onMotion = (): void => {
    this.requestRender();
  };

  #onVisibility = (): void => {
    this.#onRunnable();
  };
}

define('ui-image-reveal', UiImageReveal);

declare global {
  interface HTMLElementTagNameMap {
    'ui-image-reveal': UiImageReveal;
  }
}
