/**
 * The lifecycle the three metal elements share (`<ui-metal>`, `<ui-metal-text>`, `<ui-metal-badge>`): the port of
 * metal-fx 2.0.11's `MetalFx` component (MIT, © Jakub Antalik — https://libraries.dev/metal). React refs and state
 * became private fields; `useLayoutEffect` / `useEffect` became `connectedCallback`, the first render and the
 * observers; the module-level page stylesheet became the shadow root's.
 *
 * Without WebGL2 (happy-dom, an old browser), or while the context is lost, the element shows the host's own markup as
 * it is with a CSS metallic gradient (`data-fallback` on the root) — it never throws.
 */
import { prefersReducedMotion, UiElement } from '../../core/element';
import { attachBend, type MetalBend } from './engine/bend/bend';
import { cursorPointerLeave, cursorPointerMove, forgetCursorInstance } from './engine/cursor/light';
import { subscribeGlowConfig } from './engine/glow/config';
import {
  carryGlowState,
  type GlowHandles,
  type GlowOptions,
  injectGlow,
  updateGlow,
  updateGlowMask,
} from './engine/glow/glow';
import type { PresetTheme } from './engine/presets';
import { addReflectionTarget, removeReflectionTarget } from './engine/reflection/paint';
import { scheduleReflectionPaint } from './engine/reflection/reflectionScheduler';
import { metalTextReflection } from './engine/reflection/text';
import {
  CIRCLE_SHADER_SCALE,
  isMetalFxSupported,
  type MaskFn,
  type MetalFxInstance,
  onRendererState,
  PILL_SHADER_SCALE,
  presetKey,
  rendererHealthy,
} from './engine/renderer/core';
import {
  createInstance,
  destroyInstance,
  redrawInstance,
  refreshInstanceDpr,
  registerGlowInstance,
  setGlowCallback,
  setInstancePreset,
  setInstanceVisible,
  unregisterGlowInstance,
  updateInstance,
} from './engine/renderer/loop';
import { injectRim, type RimHandles, type RimOptions, removeRim, updateRim } from './engine/rim';
import {
  type MetalGlowMode,
  type MetalMotion,
  type MetalPreset,
  type MetalReflectionTarget,
  type MetalTheme,
  type MetalVariant,
  metalFlag,
  metalIdList,
  metalMaskPoints,
  metalMotion,
  metalNumber,
  metalPreset,
  metalRadius,
  metalReduced,
  metalResolvedTheme,
  metalTheme,
} from './options';

/** The fields every metal element reads from `data` (each also has an attribute where it is natural). */
export interface MetalCommonData {
  /** Colour preset — each ships a dark and a light tuning. Default `chromatic`. */
  preset?: MetalPreset;
  /** `auto` (default) follows the page's theme; `dark` / `light` pin the tuning. */
  theme?: MetalTheme;
  /** Effect strength 0 … 1 (default 1): the metal's and the glow's opacity, not the material's motion. */
  strength?: number;
  /** Freeze the metal on its current frame (the silhouette stays). */
  paused?: boolean;
  /** `system` (default) follows prefers-reduced-motion; `reduce` is a still frame; `full` always moves. */
  motion?: MetalMotion;
  /** Neighbours that catch a soft reflection of the metal (dark theme only). */
  reflectionTargets?: ReadonlyArray<HTMLElement | MetalReflectionTarget>;
  /** The catch-light faces the pointer while it is over the element (default true; off under reduced motion). */
  cursorLight?: boolean;
}

/** Everything the engine needs, resolved and clamped — the result of `settings()`. */
export interface MetalSettings {
  kind: 'pill' | 'circle';
  variant: MetalVariant;
  preset: MetalPreset;
  /** The tuning drawn now. */
  theme: PresetTheme;
  /** The theme `data` / the attribute pinned, if any. */
  pinned: PresetTheme | null;
  /** Final opacity multiplier 0 … 1. */
  strength: number;
  glowGain: number;
  /** Paused, or motion reduced. */
  paused: boolean;
  reduced: boolean;
  borderRadius: number | undefined;
  normalize: boolean;
  glow: boolean;
  rim: RimOptions | null;
  shaderScale: number;
  ringCssPx: number;
  scale: number;
  mask: MaskFn | null;
  glowMode: MetalGlowMode;
  cursorLight: boolean;
  bend: boolean;
  reflect: MetalReflectionTarget[];
}

/** How the element draws now: the WebGL metal, or the CSS fallback. */
export type MetalRendering = 'webgl' | 'fallback';

// Maps each live instance to its glow handles and a theme getter; the shared loop ticks the glow through this.
const glowHandlesMap = new Map<MetalFxInstance, { handles: GlowHandles; theme: () => PresetTheme }>();
setGlowCallback((inst, nowMs) => {
  const entry = glowHandlesMap.get(inst);
  if (!entry) return false;
  return updateGlow(entry.handles, inst, nowMs, inst.opacityMul * inst.glowGain, entry.theme());
});

interface Box {
  w: number;
  h: number;
  r: number;
}

const OBSERVED_THEME = {
  attributes: true,
  subtree: true,
  attributeFilter: ['data-theme', 'data-palette', 'data-design'],
};

/**
 * Base of the metal elements. A subclass gives `render()` (the shadow markup, drawn once; it must hold
 * `canvas.metal-fx-canvas`, `.mfx-inner`, `.mfx-glow` and `.mfx-rim`) and `settings()`; `afterSync()` runs after
 * every sync for its own layers.
 */
export abstract class MetalElement<D extends MetalCommonData> extends UiElement<D> {
  protected canvas: HTMLCanvasElement | null = null;
  protected inner: HTMLElement | null = null;
  protected glowHost: HTMLElement | null = null;
  protected rimHost: HTMLElement | null = null;
  #inst: MetalFxInstance | null = null;
  #glow: GlowHandles | null = null;
  #glowKey = '';
  #rim: RimHandles | null = null;
  #rimKey = '';
  #settings: MetalSettings | null = null;
  #built: Box = { w: 0, h: 0, r: 0 };
  #rootRadius = 0;
  #lost = false;
  #ro: ResizeObserver | null = null;
  #io: IntersectionObserver | null = null;
  #mo: MutationObserver | null = null;
  #scheme: MediaQueryList | null = null;
  #motion: MediaQueryList | null = null;
  #dprMql: MediaQueryList | null = null;
  #resizeRaf = 0;
  #unsubGlow: (() => void) | null = null;
  #unsubRenderer: (() => void) | null = null;
  #bend: MetalBend | null = null;
  #targets = new Map<HTMLElement, { cleanup: (() => void) | null }>();
  #lateRaf = 0;

  constructor() {
    super();
    this.addEventListener('pointerenter', this.#onPointer);
    this.addEventListener('pointermove', this.#onPointer);
    this.addEventListener('pointerleave', this.#onLeave);
    this.addEventListener('pointerdown', this.#onDown);
    this.addEventListener('pointerup', this.#onUp);
    this.addEventListener('pointercancel', this.#onUp);
  }

  /** The options this element draws with now. */
  protected abstract settings(): MetalSettings;

  /** Runs after every sync — a subclass's own layers (the text's glyph rim, the badge's label). */
  protected afterSync(_s: MetalSettings, _live: boolean): void {}

  /** The root box changed size (also in the fallback). */
  protected onBoxChange(): void {}

  attributeChangedCallback(_name: string, old: string | null, value: string | null): void {
    if (old !== value) this.requestRender();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#lost = false;
    if (typeof ResizeObserver === 'function') {
      this.#ro = new ResizeObserver(() => this.#onResize());
      // Observed once the root exists (first sync).
    }
    if (typeof MutationObserver === 'function') {
      this.#mo = new MutationObserver(() => this.requestRender());
      this.#mo.observe(document.documentElement, OBSERVED_THEME);
      const root = this.getRootNode();
      if (root !== document && root instanceof ShadowRoot) this.#mo.observe(root, OBSERVED_THEME);
    }
    if (typeof matchMedia === 'function') {
      this.#scheme = matchMedia('(prefers-color-scheme: dark)');
      this.#scheme.addEventListener?.('change', this.#onMedia);
      this.#motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.#motion.addEventListener?.('change', this.#onMedia);
    }
    this.#unsubRenderer = onRendererState((ok) => {
      this.#lost = !ok;
      this.requestRender();
    });
    // `reflect` names ids that may come later in the document: look once more after the next frame.
    if (this.hasAttribute('reflect') && typeof requestAnimationFrame === 'function') {
      this.#lateRaf = requestAnimationFrame(() => {
        this.#lateRaf = 0;
        this.requestRender();
      });
    }
  }

  override disconnectedCallback(): void {
    this.#unmount();
    this.#ro?.disconnect();
    this.#ro = null;
    this.#mo?.disconnect();
    this.#mo = null;
    this.#scheme?.removeEventListener?.('change', this.#onMedia);
    this.#motion?.removeEventListener?.('change', this.#onMedia);
    this.#scheme = null;
    this.#motion = null;
    this.#unsubRenderer?.();
    this.#unsubRenderer = null;
    if (this.#lateRaf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.#lateRaf);
    this.#lateRaf = 0;
    super.disconnectedCallback();
  }

  /** How it draws now: `webgl` (the liquid metal) or `fallback` (the CSS gradient). */
  get rendering(): MetalRendering {
    return this.#inst && !this.#lost ? 'webgl' : 'fallback';
  }

  /** Whether this browser can draw the WebGL metal (WebGL2). */
  static get supported(): boolean {
    return isMetalFxSupported();
  }

  /** Composite the current frame again now (a paused element keeps its frozen frame) — after the mask changed. */
  protected redraw(): void {
    if (this.canvas && this.#inst) redrawInstance(this.canvas);
  }

  /** The engine instance (diagnostics and tests). */
  protected get instance(): MetalFxInstance | null {
    return this.#inst;
  }

  /** Freeze on the current frame. */
  pause(): void {
    this.data = { ...(this.data ?? {}), paused: true } as D;
  }

  /** Move again (unless motion is reduced). */
  play(): void {
    this.data = { ...(this.data ?? {}), paused: false } as D;
  }

  /** True while the metal is frozen (paused, or motion reduced). */
  get paused(): boolean {
    return this.#settings?.paused ?? false;
  }

  // ── Shared option parsing ────────────────────────────────────────────────

  /** The common fields, from `data` first and then the attributes. */
  protected common(): {
    preset: MetalPreset;
    theme: PresetTheme;
    pinned: PresetTheme | null;
    strength: number;
    paused: boolean;
    reduced: boolean;
    cursorLight: boolean;
    reflect: MetalReflectionTarget[];
  } {
    const d: MetalCommonData = this.data ?? {};
    const a = (n: string) => this.getAttribute(n);
    const theme = metalTheme(d.theme ?? a('theme'));
    const reduced = metalReduced(metalMotion(d.motion ?? a('motion')), prefersReducedMotion());
    const userPaused = metalFlag(d.paused ?? (this.hasAttribute('paused') ? a('paused') : undefined), false);
    return {
      preset: metalPreset(d.preset ?? a('preset')),
      theme: metalResolvedTheme(theme, this.#colorScheme(), this.#prefersDark()),
      pinned: theme === 'auto' ? null : theme,
      strength: metalNumber(d.strength ?? a('strength'), 0, 1, 1),
      paused: userPaused || reduced,
      reduced,
      cursorLight: metalFlag(d.cursorLight ?? a('cursor-light'), true),
      reflect: this.#reflectTargets(d.reflectionTargets),
    };
  }

  /** Default shader zoom and ring width for a shape at a master scale (the engine's own defaults). */
  protected static shaderDefaults(kind: 'pill' | 'circle', scale: number): { shaderScale: number; ringCssPx: number } {
    return {
      shaderScale: (kind === 'circle' ? CIRCLE_SHADER_SCALE : PILL_SHADER_SCALE) * scale,
      ringCssPx: (kind === 'circle' ? 2 : 1) * scale,
    };
  }

  #colorScheme(): string {
    try {
      return getComputedStyle(this).colorScheme || '';
    } catch {
      return '';
    }
  }

  #prefersDark(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  }

  #reflectTargets(list: MetalCommonData['reflectionTargets']): MetalReflectionTarget[] {
    const out: MetalReflectionTarget[] = [];
    const seen = new Set<HTMLElement>();
    const push = (t: MetalReflectionTarget) => {
      if (!(t.el instanceof HTMLElement) || t.el === this || seen.has(t.el)) return;
      seen.add(t.el);
      out.push({ el: t.el, strength: metalNumber(t.strength, 0, 2, 1), glyphs: !!t.glyphs });
    };
    for (const t of list ?? []) {
      if (t instanceof HTMLElement) push({ el: t });
      else if (t && typeof t === 'object') push(t);
    }
    const ids = metalIdList(this.getAttribute('reflect'));
    if (ids.length) {
      const scope = this.getRootNode() as Document | ShadowRoot;
      for (const id of ids) {
        const el = typeof scope.getElementById === 'function' ? scope.getElementById(id) : null;
        if (el instanceof HTMLElement) push({ el, glyphs: el.hasAttribute('data-metal-fx-text') });
      }
    }
    return out;
  }

  // ── Render & sync ────────────────────────────────────────────────────────

  /** The markup is drawn once; later renders patch attributes and the engine, never the nodes. */
  protected override update(): void {
    if (!this.canvas) {
      this.content.innerHTML = this.render();
      this.canvas = this.content.querySelector<HTMLCanvasElement>('canvas.metal-fx-canvas');
      this.inner = this.content.querySelector<HTMLElement>('.mfx-inner');
      this.glowHost = this.content.querySelector<HTMLElement>('.mfx-glow');
      this.rimHost = this.content.querySelector<HTMLElement>('.mfx-rim');
    }
    if (this.#ro) this.#ro.observe(this.content);
    if (this.isConnected) this.#sync();
    this.updated();
  }

  #sync(): void {
    const s = this.settings();
    const prev = this.#settings;
    this.#settings = s;
    const root = this.content;
    setAttr(root, 'data-variant', s.variant);
    setAttr(root, 'data-shape', s.kind);
    setAttr(root, 'data-theme', s.theme);
    setAttr(root, 'data-pin', s.pinned);
    setAttr(root, 'data-preset', s.preset);
    setAttr(root, 'data-paused', s.paused ? 'true' : null);
    root.style.setProperty('--mfx-strength', String(s.strength));
    root.style.setProperty('--mfx-ring', `${s.ringCssPx}px`);
    if (this.glowHost) this.glowHost.style.display = s.glow ? '' : 'none';

    // A shape change rebuilds everything, like the React effect keyed on the shape.
    if (this.#inst && prev && prev.kind !== s.kind) this.#unmount();
    const canDraw = isMetalFxSupported() && rendererHealthy() && !this.#lost;
    if (canDraw && !this.#inst) this.#mount(s);
    if (this.#inst) this.#apply(s);
    const fallback = !this.#inst || this.#lost;
    setAttr(root, 'data-fallback', fallback ? '' : null);
    setAttr(root, 'data-normalize', s.normalize && !fallback ? 'true' : null);
    if (fallback) this.#measureFallback(s);
    this.afterSync(s, !fallback);
  }

  // ── Measuring ────────────────────────────────────────────────────────────

  /** The first slotted element (the wrapped button / icon), if any. */
  protected slotted(): Element | null {
    const slot = this.content.querySelector('slot');
    const assigned =
      slot && typeof slot.assignedElements === 'function' ? slot.assignedElements({ flatten: true }) : [];
    return assigned[0] ?? this.firstElementChild;
  }

  #childRadius(): number {
    const child = this.slotted();
    if (!child) return 0;
    try {
      return Number.parseFloat(getComputedStyle(child).borderTopLeftRadius) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * The root's layout box — `offsetWidth/Height`, which a transform (a scaled thumbnail, an animation) leaves alone;
   * the bounding rect only where there is no layout size (detached, or a DOM without layout).
   */
  #measure(s: MetalSettings): Box {
    let w = this.content.offsetWidth;
    let h = this.content.offsetHeight;
    if (!(w > 0 && h > 0)) {
      const rect = this.content.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
    }
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    return { w, h, r: metalRadius(s.kind, w, h, s.borderRadius, this.#childRadius(), this.#rootRadius) };
  }

  #setRadius(r: number): void {
    this.content.style.setProperty('--mfx-radius', `${r}px`);
  }

  #measureFallback(s: MetalSettings): void {
    const m = this.#measure(s);
    this.#setRadius(m.r);
  }

  // ── Mount / apply / unmount ──────────────────────────────────────────────

  #mount(s: MetalSettings): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const root = this.content;
    try {
      this.#rootRadius = Number.parseFloat(getComputedStyle(root).borderTopLeftRadius) || 0;
    } catch {
      this.#rootRadius = 0;
    }
    const initial = this.#measure(s);
    let inst: MetalFxInstance;
    try {
      inst = createInstance({
        hostCanvas: canvas,
        cssWidth: initial.w,
        cssHeight: initial.h,
        cornerRadius: initial.r,
        kind: s.kind,
        presetKey: presetKey(s.preset, s.theme),
        paused: s.paused,
        shaderScale: s.shaderScale,
        ringCssPx: s.ringCssPx,
        scale: s.scale,
        mask: s.mask,
        opacityMul: s.strength,
        glowGain: s.glowGain,
        cursorCatch: s.cursorLight && !s.reduced,
        onComposite: () => {
          const i = this.#inst;
          if (!i) return;
          if (this.#glow) updateGlowMask(this.#glow, i.deform);
          if (this.#rim) updateRim(this.#rim, i.deform);
        },
        onFirstCopy: () => this.content.setAttribute('data-ready', ''),
      });
    } catch {
      // No WebGL2, a failed compile, no 2D context: the CSS fallback stays.
      return;
    }
    this.#inst = inst;
    this.#built = initial;
    this.#setRadius(initial.r);
    this.#rebuildGlow(s, initial);
    this.#rebuildRim(s, initial);

    // Browser zoom changes the DPR but not the CSS box, so the ResizeObserver stays quiet; a resolution query fires
    // once per DPR change — re-arm it for the new value each time.
    this.#watchDpr();

    // Glow markup params (stroke widths, blurs …) are baked into the sprites, so a live config change to one of them
    // means a rebuild. Runtime params are read per frame and need nothing here.
    this.#unsubGlow = subscribeGlowConfig((markupChanged) => {
      const st = this.#settings;
      if (markupChanged && this.#inst && st) this.#rebuildGlow(st, this.#measure(st));
    });

    // Off-screen instances cost nothing per frame; 64px starts drawing slightly before the element scrolls in.
    if (typeof IntersectionObserver === 'function') {
      this.#io = new IntersectionObserver(
        (entries) => {
          const i = this.#inst;
          if (!i) return;
          for (const e of entries) setInstanceVisible(i, e.isIntersecting);
        },
        { rootMargin: '64px' },
      );
      this.#io.observe(root);
    }
  }

  #apply(s: MetalSettings): void {
    const inst = this.#inst;
    if (!inst) return;
    setInstancePreset(inst, presetKey(s.preset, s.theme));
    updateInstance(inst, {
      mask: s.mask,
      paused: s.paused,
      opacityMul: s.strength,
      glowGain: s.glowGain,
      shaderScale: s.shaderScale,
      ringCssPx: s.ringCssPx,
      scale: s.scale,
      cursorCatch: s.cursorLight && !s.reduced,
    });

    // Radius: re-resolved on every sync (borderRadius / variant / theme changes) without recreating the instance.
    const r = metalRadius(s.kind, inst.cssWidth, inst.cssHeight, s.borderRadius, this.#childRadius(), this.#rootRadius);
    const box = { w: inst.cssWidth, h: inst.cssHeight, r };
    if (Math.abs(r - inst.cornerRadius) >= 0.5) {
      updateInstance(inst, { cornerRadius: r });
      this.#setRadius(r);
      this.#built = box;
      this.#rebuildGlow(s, box);
      this.#rebuildRim(s, box);
    } else {
      if (this.#glowKeyOf(s) !== this.#glowKey || !!this.#glow !== s.glow) this.#rebuildGlow(s, box);
      if (this.#rimKeyOf(s) !== this.#rimKey) this.#rebuildRim(s, box);
    }

    this.#syncReflections(s);

    // Cursor-driven bend: only while asked for and motion is not reduced.
    const wantBend = s.bend && !s.reduced;
    if (wantBend && !this.#bend) this.#bend = attachBend(this.content, this.canvas, this.inner);
    else if (!wantBend && this.#bend) {
      this.#bend.destroy();
      this.#bend = null;
    }
    if (!s.cursorLight || s.reduced) cursorPointerLeave(inst);
  }

  #unmount(): void {
    const inst = this.#inst;
    if (!inst) return;
    forgetCursorInstance(inst);
    this.#bend?.destroy();
    this.#bend = null;
    for (const [el, t] of this.#targets) {
      t.cleanup?.();
      removeReflectionTarget(el, inst);
    }
    this.#targets.clear();
    inst.onAfterFrame = undefined;
    removeRim(this.#rim);
    this.#rim = null;
    this.#rimKey = '';
    this.#io?.disconnect();
    this.#io = null;
    this.#dprMql?.removeEventListener?.('change', this.#onDpr);
    this.#dprMql = null;
    this.#unsubGlow?.();
    this.#unsubGlow = null;
    if (this.#resizeRaf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.#resizeRaf);
    this.#resizeRaf = 0;
    glowHandlesMap.delete(inst);
    unregisterGlowInstance(inst);
    destroyInstance(inst);
    this.#inst = null;
    this.#glow = null;
    this.#glowKey = '';
    if (this.glowHost) this.glowHost.textContent = '';
    this.content.removeAttribute('data-ready');
    this.canvas?.getContext('2d')?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // ── Glow / rim ───────────────────────────────────────────────────────────

  #glowKeyOf(s: MetalSettings): string {
    return `${!!s.mask}|${s.glowMode}|${s.scale}|${s.kind}`;
  }

  #rimKeyOf(s: MetalSettings): string {
    return s.rim ? `${JSON.stringify(s.rim)}|${s.ringCssPx}` : '';
  }

  /**
   * Custom-mask instances feed the glow a point set inside the glyphs and the mask itself as an image, so the halo
   * sits *on the metal* and is clipped to it — not to a ring band that doesn't exist.
   */
  #glowMaskData(s: MetalSettings, w: number, h: number): Pick<GlowOptions, 'samplePoints' | 'maskDataUrl'> {
    if (!s.mask || s.glowMode === 'ring') return {};
    const dpr = window.devicePixelRatio || 1;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    const g = c.getContext('2d');
    if (!g) return {};
    g.fillStyle = '#fff';
    try {
      s.mask(g, c.width, c.height, dpr);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      return { samplePoints: metalMaskPoints(d, c.width, c.height, dpr), maskDataUrl: c.toDataURL('image/png') };
    } catch {
      // A mask that throws gives the glow nothing to sit on (the composite draws nothing either).
      return { samplePoints: [], maskDataUrl: undefined };
    }
  }

  #rebuildGlow(s: MetalSettings, box: Box): void {
    const inst = this.#inst;
    const host = this.glowHost;
    if (!inst || !host) return;
    const prev = this.#glow;
    this.#glowKey = this.#glowKeyOf(s);
    if (!s.glow) {
      // No glow wanted: nothing injected and nothing ticked (the React library ran a hidden one).
      if (prev) {
        glowHandlesMap.delete(inst);
        unregisterGlowInstance(inst);
        host.textContent = '';
        this.#glow = null;
      }
      return;
    }
    host.textContent = '';
    let next: GlowHandles;
    try {
      next = injectGlow(host, {
        width: box.w,
        height: box.h,
        cornerRadius: box.r,
        kind: s.kind,
        scale: s.scale,
        ...this.#glowMaskData(s, box.w, box.h),
      });
    } catch {
      this.#glow = null;
      glowHandlesMap.delete(inst);
      unregisterGlowInstance(inst);
      return;
    }
    // A rebuild is a fresh, invisible glow. Carry the old one's state over so a resize doesn't read as "the glow
    // vanished, then came back elsewhere".
    if (prev) carryGlowState(prev, next);
    this.#glow = next;
    glowHandlesMap.set(inst, { handles: next, theme: () => this.#settings?.theme ?? 'dark' });
    registerGlowInstance(inst);
  }

  #rebuildRim(s: MetalSettings, box: Box): void {
    const inst = this.#inst;
    removeRim(this.#rim);
    this.#rim = null;
    this.#rimKey = this.#rimKeyOf(s);
    const host = this.rimHost;
    if (!host || !inst || !s.rim) return;
    try {
      this.#rim = injectRim(
        host,
        { width: box.w, height: box.h, cornerRadius: box.r, kind: s.kind, ring: inst.ringCssPx },
        s.rim,
      );
    } catch {
      this.#rim = null;
    }
  }

  // ── Reflections ──────────────────────────────────────────────────────────

  /** Reflections are dark-theme only — no DOM work in light mode. */
  #syncReflections(s: MetalSettings): void {
    const inst = this.#inst;
    if (!inst) return;
    const want = s.theme === 'dark' ? s.reflect : [];
    const keep = new Set(want.map((t) => t.el));
    for (const [el, t] of this.#targets) {
      if (keep.has(el)) continue;
      t.cleanup?.();
      removeReflectionTarget(el, inst);
      this.#targets.delete(el);
    }
    for (const t of want) {
      // Adding an existing target only updates its strength.
      const added = addReflectionTarget(t.el, inst, this.content, t.strength ?? 1);
      if (!added || this.#targets.has(t.el)) continue;
      this.#targets.set(t.el, { cleanup: t.glyphs ? metalTextReflection(t.el) : null });
    }
    inst.onAfterFrame = this.#targets.size > 0 ? scheduleReflectionPaint : undefined;
  }

  // ── Observers ────────────────────────────────────────────────────────────

  #onResize(): void {
    if (this.#resizeRaf || typeof requestAnimationFrame !== 'function') return;
    // RAF-debounce: coalesce multiple resize events within the same frame.
    this.#resizeRaf = requestAnimationFrame(() => {
      this.#resizeRaf = 0;
      const s = this.#settings;
      if (!s || !this.isConnected) return;
      this.onBoxChange();
      const inst = this.#inst;
      if (!inst) {
        this.#measureFallback(s);
        return;
      }
      const next = this.#measure(s);
      const b = this.#built;
      // ResizeObserver fires on any box change — including ones that leave the size identical; rebuilding the glow
      // for those restarts it from invisible, which reads as the halo blinking out.
      if (Math.abs(next.w - b.w) < 0.5 && Math.abs(next.h - b.h) < 0.5 && Math.abs(next.r - b.r) < 0.5) return;
      this.#built = next;
      updateInstance(inst, { cssWidth: next.w, cssHeight: next.h, cornerRadius: next.r });
      this.#setRadius(next.r);
      this.#rebuildGlow(s, next);
      this.#rebuildRim(s, next);
    });
  }

  #watchDpr(): void {
    this.#dprMql?.removeEventListener?.('change', this.#onDpr);
    this.#dprMql =
      typeof matchMedia === 'function' ? matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`) : null;
    this.#dprMql?.addEventListener?.('change', this.#onDpr);
  }

  #onDpr = (): void => {
    const inst = this.#inst;
    const s = this.#settings;
    if (inst && s && refreshInstanceDpr(inst)) {
      const next = this.#measure(s);
      this.#rebuildGlow(s, next);
      this.#rebuildRim(s, next);
    }
    if (this.#inst) this.#watchDpr();
  };

  #onMedia = (): void => {
    this.requestRender();
  };

  // ── Pointer (only while it is over the element) ──────────────────────────

  #onPointer = (e: PointerEvent): void => {
    const s = this.#settings;
    const inst = this.#inst;
    if (!inst || !s || s.reduced || this.#lost) return;
    if (s.cursorLight) cursorPointerMove(e, inst);
    this.#bend?.move(e);
  };

  #onLeave = (): void => {
    const inst = this.#inst;
    if (inst) cursorPointerLeave(inst);
    this.#bend?.leave();
  };

  #onDown = (): void => {
    this.#bend?.down();
  };

  #onUp = (): void => {
    this.#bend?.up();
  };
}

/** Set or remove an attribute only when it changes (no mutation churn). */
export function setAttr(el: Element, name: string, value: string | null): void {
  if (value === null) {
    if (el.hasAttribute(name)) el.removeAttribute(name);
  } else if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}
