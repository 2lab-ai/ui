import { define, UiElement } from '../../core/element';
import type { CaptureFunction } from './engine/capture';
import {
  type PaletteLike,
  type PlayOptions,
  type SourceLike,
  WaveController,
  type WaveOptions,
  type WaveStyleInput,
} from './engine/controller';
import type { Point, WaveType } from './engine/model';
import { styles } from './styles';

/**
 * `<ui-distortion-wave>` — a colourful wave that carries one view into the next (Libraries.dev Distortion waves,
 * ported to a Web Component). The first view is the default slot, the view the wave leaves behind is
 * `slot="revealed"`, and `slot="overlay"` stays live and unbent above both (the button that starts it).
 *
 * The wave is one clear WebGL 2 canvas over the element; it bends a picture of the views taken just before the run.
 * Without WebGL 2, and under reduced motion, it is a crossfade.
 */

/** `system` follows the reader's reduced-motion setting, `reduce` always crossfades, `full` always waves. */
export type WaveMotion = 'system' | 'reduce' | 'full';

/** A source given as a CSS selector is looked up among the element's own children (light DOM). */
export type WaveSource = SourceLike | string;

export interface DistortionWaveData {
  /** Which view shows. Changing it runs the wave: forwards to reveal, backwards (eased) to return. */
  revealed?: boolean;
  /** The shape of the front. Default `vertical`. */
  type?: WaveType;
  /** Where the wave starts: an element, `{ x, y, w, h }` in the element's CSS pixels, or a selector. Default: the
   *  control last pressed inside the element. */
  source?: WaveSource;
  /** The point the front leans toward, in the element's CSS pixels. Default: the last press. */
  focus?: Point | null;
  /** `colorful` · `green` · `ocean` · `sunset` · `mono`, one `#RRGGBB`, or a palette object. */
  palette?: PaletteLike;
  /** Any of the wave's numbers over the type's tuned defaults (travel, amplitude, blur, rimWidth, particleCount …). */
  waveStyle?: WaveStyleInput;
  /** CSS pixels per point; `auto` sizes the wave to the element. */
  scale?: number | 'auto';
  /** The radius the edge colour follows. Default: the element's own border radius. */
  cornerRadius?: number;
  /** Holds the wave at this point of its run, 0 … 1. */
  scrub?: number | null;
  /** How the views are pictured for the lens: `false` draws the colour alone, a function replaces the capture. */
  capture?: boolean | CaptureFunction;
  /** Whether the picture follows the views while the wave is out (`true`), also during CSS animations, or never. */
  live?: boolean | 'animations';
  /** Make the context and take the first picture when the browser is idle after connecting, so the first wave starts
   *  with its lens. Default false: the context is made when the first wave asks. */
  prewarm?: boolean;
  /** Canvas pixels per CSS pixel. Default: the display's. */
  resolution?: number;
}

export interface WaveFinishedDetail {
  /** The view now showing: true for the revealed one. */
  revealed: boolean;
}

export interface WavePlayOptions {
  source?: WaveSource;
  focus?: Point | null;
}

const TYPES: readonly WaveType[] = ['vertical', 'horizontal', 'center'];
const MOTIONS: readonly WaveMotion[] = ['system', 'reduce', 'full'];

/** The engine's `reducedMotion` for a `motion` value. */
export function reducedMotionOf(motion: string | null | undefined): 'system' | 'always' | 'never' {
  return motion === 'reduce' ? 'always' : motion === 'full' ? 'never' : 'system';
}

/** A `type` value, or the default. */
export function waveTypeOf(v: unknown): WaveType {
  return TYPES.includes(v as WaveType) ? (v as WaveType) : 'vertical';
}

export class UiDistortionWave extends UiElement<DistortionWaveData> {
  static override styles = [styles];

  static get observedAttributes(): string[] {
    return ['type', 'palette', 'revealed', 'motion'];
  }

  #ctl: WaveController | null = null;
  #built = false;
  #a: HTMLElement | null = null;
  #b: HTMLElement | null = null;
  #stage: HTMLElement | null = null;
  #revealedSlot: HTMLSlotElement | null = null;
  #watch: MutationObserver | null = null;
  #stamp = 0;
  /** The `revealed` attribute has been used: its absence then means the first view. */
  #revealedAttr = false;

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if (name === 'revealed') this.#revealedAttr = true;
    if (old !== value) this.requestRender();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.renderNow();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#watch?.disconnect();
    this.#watch = null;
    this.#safe(() => this.#ctl?.destroy());
    this.#ctl = null;
  }

  /** The engine never throws at the host: no context, a shader the driver refuses — no wave. */
  #safe<T>(fn: () => T): T | undefined {
    try {
      return fn();
    } catch {
      return undefined;
    }
  }

  /**
   * The views are the host's light DOM, which the engine's own observer (on the stage inside the shadow root) never
   * sees: a change there marks the layer it is slotted into, so the next wave takes a fresh picture of it.
   */
  #observeViews(): void {
    if (this.#watch || typeof MutationObserver !== 'function') return;
    this.#watch = new MutationObserver((records) => {
      let a = false;
      let b = false;
      for (const r of records) {
        let top: Node | null = r.target;
        while (top && top.parentNode !== this) top = top.parentNode;
        const slot = top && top.nodeType === 1 ? (top as Element).getAttribute('slot') : null;
        if (slot === 'overlay') continue;
        if (slot === 'revealed') b = true;
        else a = true;
      }
      if (a) this.#touch(this.#a);
      if (b) this.#touch(this.#b);
    });
    this.#watch.observe(this, { subtree: true, childList: true, attributes: true, characterData: true });
  }

  #touch(layer: HTMLElement | null): void {
    if (!layer) return;
    this.#stamp = (this.#stamp + 1) % 1e9;
    layer.setAttribute('data-dw-changed', String(this.#stamp));
  }

  /** The engine behind the element (for benches), or null while disconnected. */
  get controller(): WaveController | null {
    return this.#ctl;
  }

  /** Runs the wave from the start, whatever was showing. */
  play(options?: WavePlayOptions): void {
    const ctl = this.#ensure();
    if (!ctl) return;
    const opts: PlayOptions = {};
    if (options && 'source' in options) opts.source = this.#source(options.source);
    if (options && 'focus' in options) opts.focus = options.focus ?? null;
    this.#safe(() => ctl.play(opts));
  }

  /** Runs it back to the first view. */
  reverse(): void {
    this.#safe(() => this.#ensure()?.reverse());
  }

  /** Straight back to the first view, with no wave. */
  reset(): void {
    this.#safe(() => this.#ensure()?.reset());
  }

  /** Pictures the views now, so the next wave starts with its lens. */
  async prepare(): Promise<void> {
    try {
      await this.#ensure()?.prepare();
    } catch {
      // No picture: the wave runs without its lens.
    }
  }

  protected render(): string {
    return `<div class="dw" part="wave"><div class="dw-layer" data-dw-layer="content"><slot></slot></div><div class="dw-layer" data-dw-layer="revealed"><slot name="revealed"></slot></div><div class="dw-overlay" data-dw-layer="overlay" data-dw-skip><slot name="overlay"></slot></div></div>`;
  }

  protected override update(): void {
    if (!this.#built) {
      this.content.innerHTML = this.render();
      this.#built = true;
      this.#stage = this.$<HTMLElement>('.dw');
      this.#a = this.$<HTMLElement>('[data-dw-layer="content"]');
      this.#b = this.$<HTMLElement>('[data-dw-layer="revealed"]');
      this.#revealedSlot = this.$<HTMLSlotElement>('slot[name="revealed"]');
      this.#revealedSlot?.addEventListener('slotchange', () => this.#syncLayers());
    }
    this.#syncLayers();
    this.#observeViews();
    const ctl = this.#ensure();
    if (ctl) this.#safe(() => ctl.update(this.#options()));
  }

  /** Whether the host gave a second view. */
  #two(): boolean {
    const slot = this.#revealedSlot;
    if (slot && typeof slot.assignedNodes === 'function' && slot.assignedNodes({ flatten: true }).length > 0)
      return true;
    // Before the slot is assigned (or where slots are not computed): any light-DOM child marked for it.
    return !!this.querySelector(':scope > [slot="revealed"]');
  }

  #syncLayers(): void {
    const b = this.#b;
    if (!b) return;
    const two = this.#two();
    b.hidden = !two;
    this.#ctl?.setRevealedLayer(two ? b : null);
  }

  #ensure(): WaveController | null {
    if (this.#ctl) return this.#ctl;
    if (!this.isConnected || !this.#built || !this.#stage || !this.#a) return null;
    if (typeof ResizeObserver !== 'function' || typeof MutationObserver !== 'function') return null;
    try {
      this.#ctl = new WaveController(this.#stage, this.#a, this.#two() ? this.#b : null);
    } catch {
      this.#ctl = null;
    }
    return this.#ctl;
  }

  #source(s: WaveSource | undefined): SourceLike {
    if (typeof s !== 'string') return s;
    try {
      return this.querySelector(s);
    } catch {
      return null;
    }
  }

  #options(): WaveOptions {
    const d = this.data ?? {};
    const revealed = d.revealed ?? (this.#revealedAttr ? this.hasAttribute('revealed') : undefined);
    const motionAttr = this.getAttribute('motion');
    const motion = MOTIONS.includes(motionAttr as WaveMotion) ? (motionAttr as WaveMotion) : 'system';
    const palette = d.palette ?? this.getAttribute('palette') ?? undefined;
    const o: WaveOptions = {
      type: waveTypeOf(d.type ?? this.getAttribute('type')),
      reducedMotion: reducedMotionOf(motion),
      onFinish: (shown) => this.notify<WaveFinishedDetail>('ui-finished', { revealed: shown }),
    };
    if (revealed !== undefined) o.revealed = revealed;
    if (palette) o.palette = palette;
    if (d.source !== undefined) o.source = this.#source(d.source);
    if (d.focus !== undefined) o.focus = d.focus;
    if (d.waveStyle) o.waveStyle = d.waveStyle;
    if (d.scale !== undefined) o.scale = d.scale;
    if (d.cornerRadius !== undefined) o.cornerRadius = d.cornerRadius;
    if (d.scrub !== undefined) o.scrub = d.scrub;
    if (d.capture !== undefined) o.capture = d.capture;
    if (d.live !== undefined) o.live = d.live;
    // A context on first need (the effects contract): the first picture is taken when a wave asks, unless the host
    // asks for it at idle.
    o.prewarm = d.prewarm === true;
    if (d.resolution !== undefined) o.resolution = d.resolution;
    return o;
  }
}

define('ui-distortion-wave', UiDistortionWave);

declare global {
  interface HTMLElementTagNameMap {
    'ui-distortion-wave': UiDistortionWave;
  }
}
