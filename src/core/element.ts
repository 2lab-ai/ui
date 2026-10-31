import { playSound, type SoundCue, type SoundOptions, soundInput } from '../sound/sound';
import { morphInto } from './morph';
import { baseCss } from './tokens';

/**
 * Base class for every @2lab.ai/ui component.
 *
 * - Open shadow root with `baseCss` + the subclass's `static styles`. A declarative shadow root the parser already
 *   attached (server-rendered markup such as `authCardHtml`) is adopted as it is — its `<style>` and `.ui-root` stay —
 *   and the first render patches it in place instead of replacing it, so nothing enters twice.
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
  /** The shadow root came from the parser (a declarative shadow root): the element hydrates what is already drawn. */
  protected readonly declarative: boolean;
  #data: D | undefined;
  #queued = false;
  #gen = 0;
  #hydrate = false;

  constructor() {
    super();
    const ctor = this.constructor as typeof UiElement;
    const css = [baseCss, ...ctor.styles].join('\n');
    // `attachShadow` on a declarative root would empty it: read the root the parser made first and keep its nodes.
    const declared = this.shadowRoot;
    this.declarative = !!declared;
    this.root = declared ?? this.attachShadow({ mode: 'open' });
    const kids = Array.from(this.root.children);
    let style = kids.find((c): c is HTMLStyleElement => c.localName === 'style');
    if (!style) {
      style = document.createElement('style');
      this.root.prepend(style);
    }
    if (style.textContent !== css) style.textContent = css;
    let content = kids.find(
      (c): c is HTMLElement => c.classList.contains('ui-root') || c.getAttribute('part') === 'root',
    );
    if (!content) {
      content = document.createElement('div');
      this.root.append(content);
    }
    content.setAttribute('part', 'root');
    content.className = 'ui-root';
    this.content = content;
    // Server-drawn content is hydrated by the first render: its nodes stay where the fresh markup matches.
    this.#hydrate = !!declared && content.childNodes.length > 0;
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
    const focus = this.#focusState();
    if (this.#hydrate) {
      // The first render over server-drawn nodes: patch, so a card that is already on screen does not enter again.
      this.#hydrate = false;
      morphInto(this.content, this.render());
    } else this.content.innerHTML = this.render();
    // After updated(): a subclass may unhide or move what was focused there (a display:none element takes no focus).
    this.updated();
    if (!focus) return;
    // Compare dataset values instead of building a selector: keys may hold any characters.
    const next =
      focus.key === undefined
        ? undefined
        : Array.from(this.content.querySelectorAll<HTMLElement>('[data-key]')).find(
            (el) => el.dataset.key === focus.key,
          );
    (next ?? this.focusFallback())?.focus({ preventScroll: true });
  }

  /** Where focus goes when the focused element is gone after a render (its key no longer rendered). Default: nowhere. */
  protected focusFallback(): HTMLElement | null {
    return null;
  }

  #focusState(): { key: string | undefined } | undefined {
    try {
      const active = this.root.activeElement as HTMLElement | null;
      return active && this.content.contains(active) ? { key: active.dataset?.key } : undefined;
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

  /** Dispatch a bubbling, composed notification that cannot be prevented (it reports what already happened). */
  protected notify<T>(name: string, detail: T): void {
    this.dispatchEvent(new CustomEvent<T>(name, { detail, bubbles: true, composed: true, cancelable: false }));
  }

  /**
   * Play an interface cue for what the user just did (`@2lab.ai/ui/sound`): silent unless the page turned sound on,
   * and inside a `data-ui-sound="off"` region. `event` supplies what did the activating. Call it from a user's
   * handler after the action went through (its event not prevented) — never from a render or for data the app set.
   */
  protected sound(cue: SoundCue, options?: SoundOptions, event?: Event): void {
    const input = options?.input ?? soundInput(event);
    playSound(cue, input ? { ...options, input } : options, this);
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
