import { define, prefersReducedMotion, UiElement } from '../../core/element';
import {
  type GenerateStylesOptions,
  getPulseDriverConfig,
  type PulseDriverConfig,
  sizePresets,
  sizeThemePresets,
} from './engine/beam-styles';
import { registerPulseInstance } from './engine/pulse-driver';
import type { BorderBeamColorVariant, BorderBeamSize, BorderBeamTheme } from './engine/types';
import { BEAM_ID, type BeamSheetMode, beamSheet, registerBeamProperties } from './sheet';
import { styles } from './styles';
import { composedContains, resolveSubstrate, type Substrate } from './theme';

export type { BorderBeamColorVariant, BorderBeamSize, BorderBeamTheme } from './engine/types';

/** `system` follows prefers-reduced-motion · `reduce` always a still frame · `full` always moves. */
export type BorderBeamMotion = 'system' | 'reduce' | 'full';

/** The React props of `<BorderBeam>`, one to one (children → the default slot; callbacks → events). */
export interface BorderBeamData {
  /** Rotate family: 'sm' · 'md' (default) · 'line'. Pulse family: 'pulse-inner' · 'pulse-outside'. */
  size?: BorderBeamSize;
  /** 'colorful' (default) · 'mono' · 'ocean' · 'sunset' · 'forest' · 'candy' · 'ice' · 'gold'. */
  colorVariant?: BorderBeamColorVariant;
  /** 'auto' (default here; React's default is 'dark') follows the page; 'dark' / 'light' pin the beam's palette. */
  theme?: BorderBeamTheme;
  /** No hue drift (mono never drifts). */
  staticColors?: boolean;
  /** One cycle in seconds, 0.2 … 60 (default 1.96 rotate · 3.1 line · 2.3 pulse). */
  duration?: number;
  /** Playing (default true): false fades the beam out, true fades it back in. */
  active?: boolean;
  /** Corner radius in px, 0 … 1000 (default: the slotted element's own, else the preset's 16 / 32). */
  borderRadius?: number;
  /** Glow brightness, 0 … 5 (default: the preset's, 1.3 for most). */
  brightness?: number;
  /** Glow saturation, 0 … 5 (default: the preset's, 1.2 on dark). */
  saturation?: number;
  /** Multiplies every glow blur, 0.1 … 5 (default 1). */
  glowSize?: number;
  /** Hue drift range in degrees, 0 … 360 (default 30; the line caps it at 13). */
  hueRange?: number;
  /** The beam layers' opacity, 0 … 1 (default 1) — never the slotted element. */
  strength?: number;
  /** Extra CSS after the beam's own sheet, inside the shadow root; `{id}` becomes the instance id (`ui`). */
  css?: string;
  /** 'system' (default) · 'reduce' · 'full'. */
  motion?: BorderBeamMotion;
}

/** What the element draws with now: `data` first, then the attributes, each clamped; unset tunings stay undefined. */
export interface BorderBeamOptions {
  size: BorderBeamSize;
  colorVariant: BorderBeamColorVariant;
  theme: BorderBeamTheme;
  motion: BorderBeamMotion;
  active: boolean;
  staticColors: boolean;
  strength: number;
  glowSize: number;
  hueRange: number;
  duration: number | undefined;
  borderRadius: number | undefined;
  brightness: number | undefined;
  saturation: number | undefined;
  css: string;
}

export const BEAM_SIZES: readonly BorderBeamSize[] = Object.freeze([
  'sm',
  'md',
  'line',
  'pulse-inner',
  'pulse-outside',
]);
export const BEAM_VARIANTS: readonly BorderBeamColorVariant[] = Object.freeze([
  'colorful',
  'mono',
  'ocean',
  'sunset',
  'forest',
  'candy',
  'ice',
  'gold',
]);

/** pulse-outside's glow is authored for a ~350 × 140 element; it scales per axis, 0.35 … 4. */
const REF_WIDTH = 350;
const REF_HEIGHT = 140;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function num(v: unknown, lo: number, hi: number): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? clamp(n, lo, hi) : undefined;
}

function pick<T extends string>(v: unknown, all: readonly T[], dflt: T): T {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return (all as readonly string[]).includes(s) ? (s as T) : dflt;
}

/** A boolean from data or an attribute: an attribute is true unless it says false / 0 / off / no. */
function flag(v: unknown, attr: string | null, dflt: boolean): boolean {
  if (typeof v === 'boolean') return v;
  if (attr === null) return dflt;
  return !/^(false|0|off|no)$/i.test(attr.trim());
}

/** Resolve `data` over the attributes (`size`, `color-variant`, `theme`, `motion`, `active`, `static-colors`, …). */
export function beamOptions(data: BorderBeamData, attr: (name: string) => string | null): BorderBeamOptions {
  const d = data ?? {};
  return {
    size: pick(d.size ?? attr('size'), BEAM_SIZES, 'md'),
    colorVariant: pick(d.colorVariant ?? attr('color-variant'), BEAM_VARIANTS, 'colorful'),
    theme: pick(d.theme ?? attr('theme'), ['dark', 'light', 'auto'] as const, 'auto'),
    motion: pick(d.motion ?? attr('motion'), ['system', 'reduce', 'full'] as const, 'system'),
    active: flag(d.active, attr('active'), true),
    staticColors: flag(d.staticColors, attr('static-colors'), false),
    strength: num(d.strength ?? attr('strength'), 0, 1) ?? 1,
    glowSize: num(d.glowSize ?? attr('glow-size'), 0.1, 5) ?? 1,
    hueRange: num(d.hueRange ?? attr('hue-range'), 0, 360) ?? 30,
    duration: num(d.duration ?? attr('duration'), 0.2, 60),
    borderRadius: num(d.borderRadius ?? attr('border-radius'), 0, 1000),
    brightness: num(d.brightness, 0, 5),
    saturation: num(d.saturation, 0, 5),
    css: typeof d.css === 'string' ? d.css : '',
  };
}

export function isPulseSize(size: BorderBeamSize): boolean {
  return size === 'pulse-inner' || size === 'pulse-outside';
}

/** The default cycle of a size, in seconds: 3.1 for the line, 2.3 for the pulses, 1.96 for the rotate beams. */
export function beamDuration(size: BorderBeamSize): number {
  return size === 'line' ? 3.1 : isPulseSize(size) ? 2.3 : 1.96;
}

/**
 * The engine's options for an element — `<BorderBeam>`'s own resolution: the preset for the size and substrate,
 * the radius given (else the slotted element's, else the preset's), mono never drifts, the line caps hue at 13°.
 */
export function beamStyleOptions(
  o: BorderBeamOptions,
  theme: Substrate,
  detectedRadius: number | null = null,
): GenerateStylesOptions {
  const themeConfig = sizeThemePresets[o.size][theme];
  const sizeConfig = sizePresets[o.size];
  return {
    id: BEAM_ID,
    borderRadius: o.borderRadius ?? detectedRadius ?? sizeConfig.borderRadius,
    borderWidth: sizeConfig.borderWidth,
    duration: o.duration ?? beamDuration(o.size),
    strokeOpacity: themeConfig.strokeOpacity,
    innerOpacity: themeConfig.innerOpacity,
    bloomOpacity: themeConfig.bloomOpacity,
    innerShadow: themeConfig.innerShadow,
    size: o.size,
    colorVariant: o.colorVariant,
    staticColors: o.colorVariant === 'mono' ? true : o.staticColors,
    brightness: o.brightness ?? themeConfig.brightness ?? 1.3,
    saturation: o.saturation ?? themeConfig.saturation,
    hueRange: o.size === 'line' ? Math.min(o.hueRange, 13) : o.hueRange,
    theme,
    hairlineOpacity: themeConfig.hairlineOpacity,
    glowSize: o.glowSize,
  };
}

/** pulse-outside's per-axis glow scale for a w × h element (0.35 … 4, three decimals); null for an empty box. */
export function pulseGlowScale(width: number, height: number): { x: number; y: number } | null {
  if (!(width > 0 && height > 0) || !Number.isFinite(width + height)) return null;
  return { x: +clamp(width / REF_WIDTH, 0.35, 4).toFixed(3), y: +clamp(height / REF_HEIGHT, 0.35, 4).toFixed(3) };
}

/**
 * `<ui-border-beam>` — a soft glow that rides the border of the element inside it (a card, a button, an input).
 * The rotate family travels: `md` a full-border beam, `sm` a compact one for buttons, `line` a glow running along
 * the bottom edge. The pulse family breathes: `pulse-inner` inside the border, `pulse-outside` blooming beyond it.
 * Eight colour variants, a dark and a light palette (auto: it follows the page), `strength`, and `active` to fade it
 * in and out (`ui-activate` / `ui-deactivate` when a fade completes).
 *
 * Pure CSS — no canvas, no WebGL: the engine writes one stylesheet per element (conic and radial gradients, masks,
 * filters, registered custom properties animated by keyframes), and the pulse family breathes from one shared,
 * ~30 fps rAF loop. The slotted element keeps its role, focus and events; every beam layer is pointer-transparent
 * and presentational. Paused offscreen; no loop while inactive or in a hidden tab; reduced motion is a still frame
 * with a crossfade.
 *
 * Ported from border-beam 1.4.1 (MIT, © 2026 Jakub Antalik — https://libraries.dev/beam).
 */
export class UiBorderBeam extends UiElement<BorderBeamData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return [
      'size',
      'color-variant',
      'theme',
      'motion',
      'active',
      'static-colors',
      'strength',
      'glow-size',
      'hue-range',
      'duration',
      'border-radius',
      'style',
      'class',
    ];
  }

  #sheet: HTMLStyleElement | null = null;
  #wrap: HTMLElement | null = null;
  #slot: HTMLSlotElement | null = null;
  #child: Element | null = null;
  #key = '';
  // React's isActive / isFading.
  #on = false;
  #fading = false;
  #started = false;
  #visible = true;
  #reduced = false;
  #substrate: Substrate | null = null;
  #radius: number | null = null;
  #glow = { x: 1, y: 1 };
  // The pulse driver: its cleanup, the config it runs and that config's key.
  #undrive: (() => void) | null = null;
  #driven: PulseDriverConfig | null = null;
  #driveKey = '';
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
      this.#ro = new ResizeObserver(() => this.#measure());
      if (this.#child) this.#ro.observe(this.#child);
    }
    if (typeof IntersectionObserver === 'function') {
      // Start a little before it scrolls into view, as upstream does.
      this.#io = new IntersectionObserver(
        (entries) => {
          const e = entries[entries.length - 1];
          if (!e || e.isIntersecting === this.#visible) return;
          this.#visible = e.isIntersecting;
          this.#sync();
        },
        { rootMargin: '256px' },
      );
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
    this.#stopDriver();
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

  /** What it draws with, from `data` first, then the attributes — each clamped to its range. */
  get options(): BorderBeamOptions {
    return beamOptions(this.data ?? {}, (n) => this.getAttribute(n));
  }

  /** The substrate the beam is drawn for now: the pinned theme, else the page's. */
  get resolvedTheme(): Substrate {
    this.#substrate ??= resolveSubstrate(this, this.options.theme);
    return this.#substrate;
  }

  /** True while the beam is on screen (or fading) — wearing a still frame or moving. */
  get active(): boolean {
    return this.#on;
  }

  /** True while a frame loop runs: the shared pulse driver, or the CSS keyframes of an onscreen rotate beam. */
  get running(): boolean {
    if (this.#undrive) return true;
    const o = this.options;
    return (
      !isPulseSize(o.size) &&
      (this.#on || this.#fading) &&
      this.#visible &&
      !this.#isStill(o.motion) &&
      !(typeof document !== 'undefined' && document.hidden)
    );
  }

  protected render(): string {
    return `<style></style><div data-beam="${BEAM_ID}" part="beam"><slot></slot><div data-beam-bloom part="bloom" aria-hidden="true"></div></div>`;
  }

  /** The wrapper and the slot are drawn once and kept: later renders rewrite the sheet and patch attributes. */
  protected override update(): void {
    if (!this.#wrap) {
      this.content.innerHTML = this.render();
      this.#sheet = this.content.querySelector('style');
      this.#wrap = this.content.querySelector<HTMLElement>('[data-beam]');
      this.#slot = this.content.querySelector('slot');
      this.#wrap?.addEventListener('animationend', this.#onAnimationEnd);
      this.#slot?.addEventListener('slotchange', this.#onSlot);
      this.#onSlot();
    }
    this.#sync();
    this.updated();
  }

  #isStill(motion: BorderBeamMotion): boolean {
    return motion === 'reduce' || (motion === 'system' && this.#reduced);
  }

  #sync(): void {
    const wrap = this.#wrap;
    if (!wrap || !this.isConnected) return;
    const o = this.options;
    const still = this.#isStill(o.motion);
    const mode: BeamSheetMode = still ? 'still' : o.motion === 'full' ? 'full' : 'run';
    const cfg = beamStyleOptions(o, this.resolvedTheme, this.#radius);
    const key = JSON.stringify([cfg, mode, o.css]);
    if (key !== this.#key && this.#sheet) {
      const sheet = beamSheet(cfg, mode, o.css);
      registerBeamProperties(sheet.properties);
      this.#sheet.textContent = sheet.css;
      this.#key = key;
    }

    // <BorderBeam>'s play / pause: on → fade in; off → fade out, and off for good when the fade-out ends.
    if (!this.#started) {
      this.#started = true;
      this.#on = o.active;
    } else if (o.active && !this.#on && !this.#fading) this.#on = true;
    else if (!o.active && this.#on && !this.#fading) this.#fading = true;

    toggle(wrap, 'data-active', this.#on && !this.#fading);
    toggle(wrap, 'data-fading', this.#fading);
    toggle(wrap, 'data-paused', this.#on && !this.#fading && !this.#visible);
    toggle(wrap, 'data-still', still);
    wrap.style.setProperty('--beam-strength', String(o.strength));
    if (o.size === 'pulse-outside') {
      wrap.style.setProperty('--pulse-glow-sx', String(this.#glow.x));
      wrap.style.setProperty('--pulse-glow-sy', String(this.#glow.y));
    } else {
      wrap.style.removeProperty('--pulse-glow-sx');
      wrap.style.removeProperty('--pulse-glow-sy');
    }
    this.#drive(cfg, still);
  }

  /** Run the shared pulse loop while a pulse beam is on, onscreen, moving and the tab is shown; else stop it. */
  #drive(cfg: GenerateStylesOptions, still: boolean): void {
    const want =
      isPulseSize(cfg.size) &&
      (this.#on || this.#fading) &&
      this.#visible &&
      !still &&
      !document.hidden &&
      typeof requestAnimationFrame === 'function';
    const config = want
      ? getPulseDriverConfig(cfg.size, cfg.theme, cfg.duration, cfg.hueRange, cfg.staticColors, BEAM_ID)
      : null;
    const key = config ? JSON.stringify(config) : '';
    if (key === this.#driveKey) return;
    this.#stopDriver();
    // A still frame is the rest pose, not wherever the breathing stopped.
    if (still) this.#rest();
    this.#driveKey = key;
    if (config && this.#wrap) {
      this.#driven = config;
      this.#undrive = registerPulseInstance(this.#wrap, config);
    }
  }

  #stopDriver(): void {
    this.#undrive?.();
    this.#undrive = null;
    this.#driveKey = '';
  }

  /** Clear what the driver wrote, so the registered initial values (the rest pose) show. */
  #rest(): void {
    const wrap = this.#wrap;
    const cfg = this.#driven;
    if (!wrap || !cfg) return;
    for (const osc of cfg.oscillators) wrap.style.removeProperty(osc.prop);
    if (cfg.hue) wrap.style.removeProperty(cfg.hue.prop);
    this.#driven = null;
  }

  // ── The slotted element: its radius and, for pulse-outside, its size ──────────────────────────────────────────

  #onSlot = (): void => {
    const slot = this.#slot;
    const kids = slot && typeof slot.assignedElements === 'function' ? slot.assignedElements({ flatten: true }) : [];
    const child = kids[0] ?? null;
    if (child !== this.#child) {
      if (this.#child) this.#ro?.unobserve(this.#child);
      this.#child = child;
      if (child) this.#ro?.observe(child);
    }
    this.#measure();
  };

  #measure(): void {
    const child = this.#child;
    let radius: number | null = null;
    let glow = this.#glow;
    if (child) {
      try {
        const r = Number.parseFloat(getComputedStyle(child).borderTopLeftRadius);
        if (r > 0) radius = r;
      } catch {
        // No computed style: the preset's radius stands.
      }
      const box = child.getBoundingClientRect?.();
      glow = (box && pulseGlowScale(box.width, box.height)) ?? glow;
    }
    if (radius === this.#radius && glow.x === this.#glow.x && glow.y === this.#glow.y) return;
    this.#radius = radius;
    this.#glow = glow;
    this.requestRender();
  }

  // ── Events and page signals ─────────────────────────────────────────────────────────────────────────────────

  #onAnimationEnd = (e: Event): void => {
    // Only the wrapper's own fades — not a pseudo-layer's, nor an animation inside the slotted element.
    const ev = e as AnimationEvent;
    if (ev.target !== this.#wrap || ev.pseudoElement) return;
    if (ev.animationName === `beam-fade-out-${BEAM_ID}`) {
      if (!this.#fading) return;
      this.#on = false;
      this.#fading = false;
      this.notify('ui-deactivate', { active: false });
      this.#sync();
    } else if (ev.animationName === `beam-fade-in-${BEAM_ID}` && this.#on && !this.#fading) {
      this.notify('ui-activate', { active: true });
    }
  };

  #onTree = (records: MutationRecord[]): void => {
    // Only a switch on this element or above it can change its substrate.
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
    this.#sync();
  };
}

function toggle(el: Element, name: string, on: boolean): void {
  if (on) {
    if (!el.hasAttribute(name)) el.setAttribute(name, '');
  } else if (el.hasAttribute(name)) el.removeAttribute(name);
}

define('ui-border-beam', UiBorderBeam);

declare global {
  interface HTMLElementTagNameMap {
    'ui-border-beam': UiBorderBeam;
  }
}
