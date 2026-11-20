/**
 * Colour parsing for the palette and band fields — verbatim from Libraries.dev `voice-glow` 0.5.0 `src/color.ts`
 * (MIT, © 2026 Jakub Antalik): `#rgb`, `#rrggbb`, `rgb(r, g, b)` and `rgba(r, g, b, a)` resolve to an [r, g, b]
 * triple. Anything else returns null and the caller keeps its default — so a host string never reaches the
 * stylesheet unparsed.
 */
export function parseRgb(color: unknown): [number, number, number] | null {
  if (typeof color !== 'string') return null;
  const c = color.trim();
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h =
      hex[1].length === 3
        ? hex[1]
            .split('')
            .map((ch) => ch + ch)
            .join('')
        : hex[1];
    return [Number.parseInt(h.slice(0, 2), 16), Number.parseInt(h.slice(2, 4), 16), Number.parseInt(h.slice(4, 6), 16)];
  }
  const fn = c.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (fn) {
    const ch = (v: string) => Math.max(0, Math.min(255, Math.round(+v)));
    return [ch(fn[1]), ch(fn[2]), ch(fn[3])];
  }
  return null;
}

/** `rgb(r, g, b)` for the stylesheet, or null if unparseable. */
export function toRgb(color: unknown): string | null {
  const t = parseRgb(color);
  return t ? `rgb(${t[0]}, ${t[1]}, ${t[2]})` : null;
}

/** `r, g, b` for the canvas (dropped into rgba()), or null. */
export function toTriple(color: unknown): string | null {
  const t = parseRgb(color);
  return t ? `${t[0]}, ${t[1]}, ${t[2]}` : null;
}
