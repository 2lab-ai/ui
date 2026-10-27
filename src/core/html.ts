/** HTML-escape text for element content. Every model-, user- or tool-written string goes through this. */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escape for a double-quoted attribute value. */
export function escAttr(value: unknown): string {
  return esc(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const SAFE_SCHEMES = /^(https?:|mailto:)/i;

/** A link target that cannot run script: http(s)/mailto only, otherwise `#`. */
export function safeHref(url: unknown): string {
  const s = String(url ?? '').trim();
  return SAFE_SCHEMES.test(s) ? escAttr(s) : '#';
}

/** Join class names, skipping falsy entries. */
export function cls(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ');
}

/** `key="value"` pairs for truthy values, escaped. `true` renders a bare boolean attribute. */
export function attrs(map: Record<string, string | number | boolean | null | undefined>): string {
  let out = '';
  for (const [k, v] of Object.entries(map)) {
    if (v === false || v === null || v === undefined) continue;
    out += v === true ? ` ${k}` : ` ${k}="${escAttr(v)}"`;
  }
  return out;
}
