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

const SCHEME = /^[a-z][a-z\d+.-]*:/i;

/**
 * A navigation target that cannot run script: http(s) / mailto, or a same-site relative URL (`/path`, `./x`,
 * `../x`, `x/y`, `?q`, `#id`). Anything with another scheme (`javascript:`, `data:` …) or a protocol-relative
 * `//host` becomes `#`. Use it for app links (nav, account); `safeHref` stays the rule for model-written links.
 */
export function safeLink(url: unknown): string {
  const s = String(url ?? '').trim();
  if (!s) return '#';
  if (SAFE_SCHEMES.test(s)) return escAttr(s);
  // `//host` (or `/\host`) leaves the site; a control character can hide a scheme from this check.
  if (/^[\\/]{2}/.test(s) || Array.from(s).some((c) => c.charCodeAt(0) < 32)) return '#';
  // Any other scheme goes; a colon after the first / ? # is part of a path (`docs/a:b`), not a scheme.
  return SCHEME.test(s) ? '#' : escAttr(s);
}

const SAFE_DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|avif|bmp);base64,[a-z\d+/=\s]+$/i;

/**
 * A media source (`<img src>`, `<audio src>`, `<video src>`): http(s), a relative URL, `blob:` (object URLs of
 * local files) or a base64 raster `data:image/…`. Anything else is the empty string (draw no media).
 */
export function safeSrc(url: unknown): string {
  const s = String(url ?? '').trim();
  if (!s) return '';
  if (/^https?:/i.test(s) || /^blob:/i.test(s) || SAFE_DATA_IMAGE.test(s)) return escAttr(s);
  const link = safeLink(s);
  return link === '#' || /^mailto:/i.test(s) ? '' : link;
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
