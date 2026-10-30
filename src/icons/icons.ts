/**
 * The 2lab icon set: a 16×16 grid, 1.5px strokes, round caps and joins, drawn in `currentColor` — the same
 * hand as the glyphs inside the components and on ui.2lab.ai. `icon(name)` returns an SVG string (decorative by
 * default; pass `label` for a meaningful image). The brand mark and `dot` are the only filled glyphs.
 */

/** Inner markup per glyph (16-unit viewBox). A dot is a zero-length segment: `M8 8h.01` with a round cap. */
const GLYPHS = {
  brand:
    '<g fill="currentColor" stroke="none"><rect x="2" y="2" width="5" height="5" rx="1.25"/><rect x="9" y="2" width="5" height="5" rx="1.25" opacity=".55"/><rect x="2" y="9" width="5" height="5" rx="1.25" opacity=".55"/><rect x="9" y="9" width="5" height="5" rx="1.25" opacity=".25"/></g>',
  'chevron-down': '<path d="M4 6l4 4 4-4"/>',
  'chevron-up': '<path d="M4 10l4-4 4 4"/>',
  'chevron-left': '<path d="M10 4L6 8l4 4"/>',
  'chevron-right': '<path d="M6 4l4 4-4 4"/>',
  'arrow-up': '<path d="M8 13V3M3.75 7.25L8 3l4.25 4.25"/>',
  'arrow-right': '<path d="M3 8h10M8.75 3.75L13 8l-4.25 4.25"/>',
  close: '<path d="M4 4l8 8M12 4l-8 8"/>',
  plus: '<path d="M8 3v10M3 8h10"/>',
  minus: '<path d="M3 8h10"/>',
  menu: '<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/>',
  more: '<path d="M3.5 8h.01M8 8h.01M12.5 8h.01" stroke-width="2.25"/>',
  search: '<circle cx="7" cy="7" r="4.25"/><path d="M10.25 10.25l3.25 3.25"/>',
  lock: '<rect x="3.25" y="7" width="9.5" height="6.75" rx="1.75"/><path d="M5.5 7V5.25a2.5 2.5 0 0 1 5 0V7"/>',
  sun: '<circle cx="8" cy="8" r="2.75"/><path d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.05 1.05M11.55 11.55l1.05 1.05M3.4 12.6l1.05-1.05M11.55 4.45l1.05-1.05"/>',
  moon: '<path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z"/>',
  gear: '<path d="M12.47 6.93L14.17 7.02L14.17 8.98L12.47 9.07L11.92 10.4L13.06 11.67L11.67 13.06L10.4 11.92L9.07 12.47L8.98 14.17L7.02 14.17L6.93 12.47L5.6 11.92L4.33 13.06L2.94 11.67L4.08 10.4L3.53 9.07L1.83 8.98L1.83 7.02L3.53 6.93L4.08 5.6L2.94 4.33L4.33 2.94L5.6 4.08L6.93 3.53L7.02 1.83L8.98 1.83L9.07 3.53L10.4 4.08L11.67 2.94L13.06 4.33L11.92 5.6Z"/><circle cx="8" cy="8" r="2"/>',
  brain:
    '<path d="M8 3.6v9M8 3.6A2.1 2.1 0 0 0 4.4 4.3 2.2 2.2 0 0 0 3 7.75a2.2 2.2 0 0 0 1.1 3.55A2.1 2.1 0 0 0 8 12.6M8 3.6a2.1 2.1 0 0 1 3.6.7A2.2 2.2 0 0 1 13 7.75a2.2 2.2 0 0 1-1.1 3.55A2.1 2.1 0 0 1 8 12.6M5.25 7.5c.9 0 1.6.45 2 1M10.75 7.5c-.9 0-1.6.45-2 1"/>',
  list: '<path d="M6 4.5h7.5M6 8h7.5M6 11.5h7.5M2.75 4.5h.01M2.75 8h.01M2.75 11.5h.01"/>',
  board:
    '<rect x="2.25" y="2.75" width="4.5" height="10.5" rx="1.25"/><rect x="9.25" y="2.75" width="4.5" height="6.5" rx="1.25"/>',
  chat: '<path d="M3 4.25A1.75 1.75 0 0 1 4.75 2.5h6.5A1.75 1.75 0 0 1 13 4.25v4.5a1.75 1.75 0 0 1-1.75 1.75H7.5L4.5 13v-2.5A1.5 1.5 0 0 1 3 9z"/>',
  user: '<circle cx="8" cy="5.5" r="2.75"/><path d="M2.75 13.75a5.25 5.25 0 0 1 10.5 0"/>',
  bot: '<rect x="2.75" y="5" width="10.5" height="8.25" rx="2.5"/><path d="M8 5V3M8 2.25h.01M6 8.75v1M10 8.75v1"/>',
  target: '<circle cx="8" cy="8" r="5.75"/><circle cx="8" cy="8" r="2.75"/><path d="M8 8h.01"/>',
  star: '<path d="M8 2.3l1.62 3.88 4.18.33-3.18 2.74.97 4.09L8 11.15l-3.59 2.19.97-4.09L2.2 6.51l4.18-.33z"/>',
  clock: '<circle cx="8" cy="8" r="5.75"/><path d="M8 4.75V8l2.25 1.5"/>',
  file: '<path d="M9 2H4.75A1.75 1.75 0 0 0 3 3.75v8.5A1.75 1.75 0 0 0 4.75 14h6.5A1.75 1.75 0 0 0 13 12.25V6z"/><path d="M9 2v4h4"/>',
  'file-text':
    '<path d="M9 2H4.75A1.75 1.75 0 0 0 3 3.75v8.5A1.75 1.75 0 0 0 4.75 14h6.5A1.75 1.75 0 0 0 13 12.25V6z"/><path d="M9 2v4h4M5.75 9h4.5M5.75 11.25h3"/>',
  'file-code':
    '<path d="M9 2H4.75A1.75 1.75 0 0 0 3 3.75v8.5A1.75 1.75 0 0 0 4.75 14h6.5A1.75 1.75 0 0 0 13 12.25V6z"/><path d="M9 2v4h4M6.75 8.5L5.5 9.75 6.75 11M9.25 8.5l1.25 1.25L9.25 11"/>',
  'file-image':
    '<path d="M9 2H4.75A1.75 1.75 0 0 0 3 3.75v8.5A1.75 1.75 0 0 0 4.75 14h6.5A1.75 1.75 0 0 0 13 12.25V6z"/><path d="M9 2v4h4M3.5 12.5l2.75-2.75 2 2 1.25-1.25 2.75 2.5"/>',
  'file-audio':
    '<path d="M9 2H4.75A1.75 1.75 0 0 0 3 3.75v8.5A1.75 1.75 0 0 0 4.75 14h6.5A1.75 1.75 0 0 0 13 12.25V6z"/><path d="M9 2v4h4M5.75 9.5v1.5M8 8.25v4M10.25 9.5v1.5"/>',
  'file-video':
    '<path d="M9 2H4.75A1.75 1.75 0 0 0 3 3.75v8.5A1.75 1.75 0 0 0 4.75 14h6.5A1.75 1.75 0 0 0 13 12.25V6z"/><path d="M9 2v4h4M6.75 8.75v3l2.5-1.5z"/>',
  attach:
    '<path d="M13 7.5l-5.1 5.1a3 3 0 0 1-4.24-4.24l5.3-5.3a2 2 0 0 1 2.83 2.83l-5.3 5.3a1 1 0 0 1-1.42-1.42L10 4.85"/>',
  mic: '<rect x="5.75" y="1.75" width="4.5" height="8" rx="2.25"/><path d="M3.5 7.75a4.5 4.5 0 0 0 9 0M8 12.25v2"/>',
  image:
    '<rect x="2.25" y="2.75" width="11.5" height="10.5" rx="2"/><circle cx="5.75" cy="6.25" r="1.25"/><path d="M13.5 10.25L10.5 7.5 3.5 13"/>',
  send: '<path d="M13.75 2.25L2.25 6.75l5 2 2 5zM13.75 2.25l-6.5 6.5"/>',
  play: '<path d="M5 3.25v9.5L12.5 8z"/>',
  pause:
    '<rect x="4" y="3.25" width="2.75" height="9.5" rx="1"/><rect x="9.25" y="3.25" width="2.75" height="9.5" rx="1"/>',
  stop: '<rect x="4" y="4" width="8" height="8" rx="1.5"/>',
  check: '<path d="M3.5 8.5l3 3 6-6.5"/>',
  cross: '<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>',
  alert:
    '<path d="M7.13 2.98a1 1 0 0 1 1.74 0l5.2 9.02a1 1 0 0 1-.87 1.5H2.8a1 1 0 0 1-.87-1.5zM8 6.5v2.75M8 11.25h.01"/>',
  info: '<circle cx="8" cy="8" r="5.75"/><path d="M8 7.25v3.5M8 5.25h.01"/>',
  external: '<path d="M7 3.5H4.5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V9M9.5 3.5h3v3M12.5 3.5l-5 5"/>',
  copy: '<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5"/>',
  refresh: '<path d="M13.25 8a5.25 5.25 0 0 1-9.4 3.2M2.75 8a5.25 5.25 0 0 1 9.4-3.2M12.5 2v3h-3M3.5 14v-3h3"/>',
  download: '<path d="M8 2.5v8M4.5 7.25L8 10.75l3.5-3.5M3 13.5h10"/>',
  edit: '<path d="M10.5 2.75l2.75 2.75L6 12.75 2.75 13.25l.5-3.25zM9 4.25L11.75 7"/>',
  trash:
    '<path d="M2.75 4.25h10.5M6.25 4.25V2.75h3.5v1.5M4.25 4.25l.6 8.4a1.25 1.25 0 0 0 1.25 1.1h3.8a1.25 1.25 0 0 0 1.25-1.1l.6-8.4"/>',
  archive:
    '<rect x="2" y="2.75" width="12" height="3.5" rx="1"/><path d="M3.25 6.25v6a1.5 1.5 0 0 0 1.5 1.5h6.5a1.5 1.5 0 0 0 1.5-1.5v-6M6.5 9.25h3"/>',
  shield:
    '<path d="M8 1.75l5 1.9v4.1c0 3.1-2.1 5.4-5 6.5-2.9-1.1-5-3.4-5-6.5v-4.1z"/><path d="M5.75 8l1.6 1.6 3.15-3.1"/>',
  camera:
    '<path d="M2.25 5.5a1.25 1.25 0 0 1 1.25-1.25h1.75l1.25-1.75h3l1.25 1.75h1.75a1.25 1.25 0 0 1 1.25 1.25v6.25A1.25 1.25 0 0 1 12.5 13h-9a1.25 1.25 0 0 1-1.25-1.25z"/><circle cx="8" cy="8.5" r="2.25"/>',
  tree: '<circle cx="4" cy="3.5" r="1.5"/><circle cx="11.75" cy="7.25" r="1.5"/><circle cx="11.75" cy="12.5" r="1.5"/><path d="M4 5v5.5a2 2 0 0 0 2 2h4.25M4 5.25a2 2 0 0 0 2 2h4.25"/>',
  ban: '<circle cx="8" cy="8" r="5.75"/><path d="M3.93 3.93l8.14 8.14"/>',
  dot: '<circle cx="8" cy="8" r="2.75" fill="currentColor"/>',
  'circle-dashed':
    '<path d="M9.34 2.41A5.75 5.75 0 0 1 11 3.1M12.9 5a5.75 5.75 0 0 1 .69 1.66M13.59 9.34A5.75 5.75 0 0 1 12.9 11M11 12.9a5.75 5.75 0 0 1-1.66.69M6.66 13.59A5.75 5.75 0 0 1 5 12.9M3.1 11a5.75 5.75 0 0 1-.69-1.66M2.41 6.66A5.75 5.75 0 0 1 3.1 5M5 3.1a5.75 5.75 0 0 1 1.66-.69"/>',
} as const;

export type IconName = keyof typeof GLYPHS;

/** Other names hosts reach for (memory → brain, goal → target, …). */
export const ICON_ALIASES: Readonly<Record<string, IconName>> = {
  memory: 'brain',
  conversations: 'list',
  goal: 'target',
  settings: 'gear',
  'x-mark': 'cross',
  warning: 'alert',
  paperclip: 'attach',
  'file-markdown': 'file-text',
  'file-html': 'file-code',
  avatar: 'user',
  agent: 'bot',
  branch: 'tree',
  'circle-slash': 'ban',
  'shield-check': 'shield',
};

/** Every glyph name, in display order. */
export const ICON_NAMES = Object.keys(GLYPHS) as IconName[];

export interface IconOptions {
  /** Rendered size in px (width and height). Default 16. */
  size?: number;
  /** Accessible name. Without it the SVG is decorative (`aria-hidden`). */
  label?: string;
  /** Extra class names on the `<svg>`. */
  class?: string;
  /** Stroke width in grid units. Default 1.5. */
  stroke?: number;
}

const escText = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** True when `name` (or an alias) is in the set. */
export function hasIcon(name: string): boolean {
  return Object.hasOwn(GLYPHS, name) || Object.hasOwn(ICON_ALIASES, name);
}

/** The canonical glyph name for `name` (aliases resolved), or undefined. */
export function iconName(name: string): IconName | undefined {
  if (Object.hasOwn(GLYPHS, name)) return name as IconName;
  return Object.hasOwn(ICON_ALIASES, name) ? ICON_ALIASES[name] : undefined;
}

/**
 * An icon as an SVG string. Unknown names return an empty string (never throw from a render).
 * `icon('gear')` · `icon('close', { size: 12 })` · `icon('alert', { label: 'Warning' })`.
 */
export function icon(name: IconName | (string & {}), opts: IconOptions = {}): string {
  const key = iconName(name);
  if (!key) return '';
  const size = Number.isFinite(opts.size) && (opts.size as number) > 0 ? Number(opts.size) : 16;
  const stroke = Number.isFinite(opts.stroke) && (opts.stroke as number) > 0 ? Number(opts.stroke) : 1.5;
  const a11y = opts.label ? `role="img" aria-label="${escText(opts.label)}"` : 'aria-hidden="true"';
  const cls = opts.class ? ` class="${escText(opts.class)}"` : '';
  const title = opts.label ? `<title>${escText(opts.label)}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" focusable="false" data-icon="${key}"${cls} ${a11y}>${title}${GLYPHS[key]}</svg>`;
}
