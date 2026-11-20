import { designById } from '../../core/tokens';

/**
 * Light or dark substrate for an element, the way the library resolves it: a pinned theme first; then the nearest
 * ancestor — across shadow boundaries — that says so (`data-design` → its scheme, `data-theme="dark|light"`, or the
 * Tailwind / shadcn `dark` / `light` class); then the element's own `--text` token (light ink → a dark page, which
 * also carries `prefers-color-scheme` and page tokens); last the OS setting.
 */
export type Substrate = 'dark' | 'light';

/** The element above `node`: its parent, or the host of the shadow root it sits in. */
function above(node: Element): Element | null {
  if (node.parentElement) return node.parentElement;
  const root = node.getRootNode?.();
  return root && 'host' in root ? ((root as ShadowRoot).host ?? null) : null;
}

/** The nearest ancestor (or the element itself) that names a substrate, or null. */
export function ancestorSubstrate(el: Element | null): Substrate | null {
  for (let node = el; node; node = above(node)) {
    const design = node.getAttribute('data-design');
    if (design) {
      const d = designById(design);
      if (d) return d.scheme;
    }
    const theme = node.getAttribute('data-theme');
    if (theme === 'dark' || theme === 'light') return theme;
    if (node.classList?.contains('dark')) return 'dark';
    if (node.classList?.contains('light')) return 'light';
  }
  return null;
}

/** True when `ancestor` contains `node`, following shadow roots up to their hosts. */
export function composedContains(ancestor: Node, node: Node | null): boolean {
  for (let n: Node | null = node; n; ) {
    if (n === ancestor) return true;
    const parent: Node | null = n.parentNode;
    n = parent && parent.nodeType === 11 && 'host' in parent ? (parent as ShadowRoot).host : parent;
  }
  return false;
}

/**
 * Whether a CSS colour is light (r·.299 + g·.587 + b·.114 > 128): hex, rgb()/rgba(), color(srgb …), and the
 * lightness of oklch / oklab / lch / lab. Null when it cannot tell.
 */
export function colorIsLight(color: string): boolean | null {
  const s = String(color ?? '')
    .trim()
    .toLowerCase();
  const hex = /^#([\da-f]{3,8})$/.exec(s)?.[1];
  if (hex) {
    if (hex.length === 5 || hex.length === 7) return null;
    const short = hex.length < 6;
    const at = (i: number) => Number.parseInt(short ? hex[i] + hex[i] : hex.slice(i * 2, i * 2 + 2), 16);
    return at(0) * 0.299 + at(1) * 0.587 + at(2) * 0.114 > 128;
  }
  const fn = /^([a-z-]+)\((.*)\)$/.exec(s);
  if (!fn) return null;
  const args = fn[1] === 'color' ? fn[2].trim().replace(/^[\w-]+\s+/, '') : fn[2];
  const nums = args.match(/-?\d*\.?\d+(?:e-?\d+)?%?/g);
  if (!nums || nums.length < 3) return null;
  const v = (i: number, full: number) => {
    const t = nums[i];
    return t.endsWith('%') ? (Number.parseFloat(t) / 100) * full : Number.parseFloat(t);
  };
  if (fn[1] === 'rgb' || fn[1] === 'rgba') return v(0, 255) * 0.299 + v(1, 255) * 0.587 + v(2, 255) * 0.114 > 128;
  if (fn[1] === 'color') return (v(0, 1) * 0.299 + v(1, 1) * 0.587 + v(2, 1) * 0.114) * 255 > 128;
  if (fn[1] === 'oklch' || fn[1] === 'oklab') return v(0, 1) > 0.62;
  if (fn[1] === 'lch' || fn[1] === 'lab') return v(0, 100) > 55;
  return null;
}

function systemDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

/** The substrate an element sits on (see the module note). `pinned` 'dark' / 'light' wins; anything else is auto. */
export function resolveSubstrate(el: HTMLElement, pinned: unknown): Substrate {
  if (pinned === 'dark' || pinned === 'light') return pinned;
  const tree = ancestorSubstrate(el);
  if (tree) return tree;
  try {
    const light = colorIsLight(getComputedStyle(el).getPropertyValue('--text'));
    if (light !== null) return light ? 'dark' : 'light';
  } catch {
    // Not styled (detached, or no CSSOM): the OS decides.
  }
  return systemDark() ? 'dark' : 'light';
}
