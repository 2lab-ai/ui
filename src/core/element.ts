import { baseCss } from './tokens';

/**
 * Base class for every @2lab-ai/ui component.
 *
 * - Open shadow root with `baseCss` + the subclass's `static styles`.
 * - Data in, events out: set `el.data = {...}` (or the component's own properties) → one batched render;
 *   user intent leaves as a bubbling, composed `CustomEvent` (`ui-*`) that the host app handles.
 * - `render()` returns an HTML string; every dynamic value must go through `esc` / `escAttr` / `safeHref`.
 * - Focus survives a re-render when the focused element carries `data-key` (restored to the same key).
 * - Subclasses that tick (timers) should update text nodes in place instead of re-rendering.
 */
export abstract class UiElement<D = unknown> extends HTMLElement {
  static styles: string[] = [];

  protected readonly root: ShadowRoot;
  protected readonly content: HTMLElement;
  #data: D | undefined;
  #queued = false;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    const ctor = this.constructor as typeof UiElement;
    const style = document.createElement('style');
    style.textContent = [baseCss, ...ctor.styles].join('\n');
    this.content = document.createElement('div');
    this.content.setAttribute('part', 'root');
    this.content.className = 'ui-root';
    this.root.append(style, this.content);
  }

  get data(): D | undefined {
    return this.#data;
  }

  set data(value: D | undefined) {
    this.#data = value;
    this.requestRender();
  }

  connectedCallback(): void {
    this.requestRender();
  }

  disconnectedCallback(): void {}

  /** Batch renders into one microtask. */
  requestRender(): void {
    if (this.#queued) return;
    this.#queued = true;
    queueMicrotask(() => {
      this.#queued = false;
      if (this.isConnected) this.update();
    });
  }

  /** Render synchronously (tests, or right before measuring). */
  renderNow(): void {
    this.#queued = false;
    this.update();
  }

  protected update(): void {
    const active = this.root.activeElement as HTMLElement | null;
    const key = active?.dataset?.key;
    this.content.innerHTML = this.render();
    if (key) {
      const next = this.content.querySelector<HTMLElement>(`[data-key="${cssEscape(key)}"]`);
      next?.focus({ preventScroll: true });
    }
    this.updated();
  }

  /** The component's markup. */
  protected abstract render(): string;

  /** Hook after each render (wire listeners on fresh nodes, start timers). */
  protected updated(): void {}

  /** Dispatch a bubbling, composed, cancelable event. Returns false when a listener called preventDefault(). */
  protected emit<T>(name: string, detail: T): boolean {
    return this.dispatchEvent(new CustomEvent<T>(name, { detail, bubbles: true, composed: true, cancelable: true }));
  }

  /** Query inside the shadow root. */
  protected $<E extends Element = HTMLElement>(selector: string): E | null {
    return this.root.querySelector<E>(selector);
  }

  protected $$<E extends Element = HTMLElement>(selector: string): E[] {
    return Array.from(this.root.querySelectorAll<E>(selector));
  }
}

function cssEscape(s: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&');
}

/** Register a custom element once (safe to import twice). */
export function define(tag: string, ctor: CustomElementConstructor): void {
  if (typeof customElements !== 'undefined' && !customElements.get(tag)) customElements.define(tag, ctor);
}

/** True when the user asked for less motion. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
