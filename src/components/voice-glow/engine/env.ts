/**
 * What the voice elements read from the page around them — light or dark, reduced motion, a hidden tab — and one
 * watcher that tells an element when any of it may have changed (a `class` flip is read on the next re-read, not
 * watched: a dashboard toggles classes all the time). Shared by `<ui-voice-glow>`, `<ui-voice-ring>` and
 * `<ui-voice-position>`.
 *
 * Theme, as voice-ring's `theme.ts` resolves it (MIT, © 2026 Jakub Antalik) with the ui library's own steps first:
 * the host's `theme` attribute → an ancestor's `data-theme` (or `.dark` / `.light`), across shadow roots → the
 * luminance of the host's computed text colour (so page tokens and `data-design` count) → `prefers-color-scheme`.
 */

export type VoiceMotion = 'system' | 'reduce' | 'full';

/** The `motion` attribute: 'reduce' and 'full' pin it, anything else follows the system. */
export function motionOf(value: unknown): VoiceMotion {
  const s = String(value ?? '')
    .trim()
    .toLowerCase();
  return s === 'reduce' || s === 'full' ? s : 'system';
}

/** Whether motion is reduced for a `motion` setting: 'reduce' yes, 'full' no, 'system' as the OS says. */
export function motionReduced(motion: VoiceMotion): boolean {
  if (motion === 'reduce') return true;
  if (motion === 'full') return false;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The red, green and blue (0 … 255) of a computed colour (hex or rgb()/rgba()), or null. */
export function colorChannels(color: string): [number, number, number] | null {
  const c = String(color ?? '').trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (ch) => ch + ch) : hex[1];
    return [Number.parseInt(h.slice(0, 2), 16), Number.parseInt(h.slice(2, 4), 16), Number.parseInt(h.slice(4, 6), 16)];
  }
  const fn = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(c);
  if (fn) return [Math.round(Number(fn[1])), Math.round(Number(fn[2])), Math.round(Number(fn[3]))];
  return null;
}

/** True when a colour is light (r·.299 + g·.587 + b·.114 > 128): light text means a dark page behind it. */
export function isLightColor(color: string): boolean {
  const c = colorChannels(color);
  return !!c && c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114 > 128;
}

function ancestorTheme(el: Element): boolean | null {
  let node: Element | null = el.parentElement ?? hostOf(el);
  while (node) {
    const attr =
      node.getAttribute('data-theme') ?? (node.localName.startsWith('ui-') ? node.getAttribute('theme') : null);
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    if (node.classList.contains('dark')) return true;
    if (node.classList.contains('light')) return false;
    node = node.parentElement ?? hostOf(node);
  }
  return null;
}

function hostOf(el: Element): Element | null {
  const root = el.getRootNode?.();
  return root && root !== el && 'host' in root ? ((root as ShadowRoot).host ?? null) : null;
}

/** Whether `el` sits on a dark surface (see the file header for the order it asks in). */
export function hostIsDark(el: Element): boolean {
  const own = el.getAttribute('theme');
  if (own === 'dark') return true;
  if (own === 'light') return false;
  const tree = ancestorTheme(el);
  if (tree != null) return tree;
  try {
    const color = getComputedStyle(el).color;
    if (colorChannels(color)) return isLightColor(color);
  } catch {
    /* not styled yet */
  }
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Watches what may change how an element draws: a theme / palette / design switch anywhere above it, the OS colour
 * scheme, the reduced-motion setting, and the tab being hidden. `onChange` is called with what moved.
 */
export class EnvWatch {
  #mo: MutationObserver | null = null;
  #scheme: MediaQueryList | null = null;
  #motion: MediaQueryList | null = null;
  readonly #onTheme = () => this.onChange('theme');
  readonly #onMotion = () => this.onChange('motion');
  readonly #onVisibility = () => this.onChange('visibility');

  constructor(
    readonly el: Element,
    readonly onChange: (what: 'theme' | 'motion' | 'visibility') => void,
  ) {}

  connect(): void {
    this.disconnect();
    if (typeof MutationObserver === 'function') {
      this.#mo = new MutationObserver(this.#onTheme);
      const watch = { attributes: true, subtree: true, attributeFilter: ['data-theme', 'data-palette', 'data-design'] };
      this.#mo.observe(document.documentElement, watch);
      const root = this.el.getRootNode();
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

  disconnect(): void {
    this.#mo?.disconnect();
    this.#scheme?.removeEventListener?.('change', this.#onTheme);
    this.#motion?.removeEventListener?.('change', this.#onMotion);
    this.#mo = null;
    this.#scheme = null;
    this.#motion = null;
    document.removeEventListener('visibilitychange', this.#onVisibility);
  }
}

/** True while the document is hidden (a background tab). */
export function pageHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}
