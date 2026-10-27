import { baseCss } from './tokens';

/**
 * Base class for every @2lab.ai/ui component.
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
  #gen = 0;

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
    // `data` set before this element was defined (its module loaded after the host's script ran) is an own
    // property that shadows the accessor: move it through the setter. Here, not in the constructor — a subclass
    // setter may use private fields that only exist once construction is done.
    if (Object.hasOwn(this, 'data')) {
      const early = (this as { data?: D }).data;
      delete (this as { data?: D }).data;
      this.data = early;
    }
    this.requestRender();
  }

  disconnectedCallback(): void {}

  /** Batch renders into one microtask. */
  requestRender(): void {
    if (this.#queued) return;
    this.#queued = true;
    const gen = this.#gen;
    queueMicrotask(() => {
      if (!this.#queued || gen !== this.#gen) return;
      this.#queued = false;
      if (this.isConnected) this.update();
    });
  }

  /** Render synchronously (tests, or right before measuring). Cancels a queued render. */
  renderNow(): void {
    this.#queued = false;
    this.#gen++;
    this.update();
  }

  protected update(): void {
    const key = this.#focusedKey();
    this.content.innerHTML = this.render();
    if (key) {
      // Compare dataset values instead of building a selector: keys may hold any characters.
      const next = Array.from(this.content.querySelectorAll<HTMLElement>('[data-key]')).find(
        (el) => el.dataset.key === key,
      );
      next?.focus({ preventScroll: true });
    }
    this.updated();
  }

  #focusedKey(): string | undefined {
    try {
      const active = this.root.activeElement as HTMLElement | null;
      return active && this.content.contains(active) ? active.dataset?.key : undefined;
    } catch {
      return undefined;
    }
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

/** Register a custom element once (safe to import twice). */
export function define(tag: string, ctor: CustomElementConstructor): void {
  if (typeof customElements !== 'undefined' && !customElements.get(tag)) customElements.define(tag, ctor);
}

/** True when the user asked for less motion. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
