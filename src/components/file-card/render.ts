import { type FileKind, fileExt, fileKind, fileKindIcon, fmtBytes } from '../../core/files';
import { fmtAgo } from '../../core/format';
import { attrs, cls, esc, safeSrc } from '../../core/html';
import { type IconName, icon } from '../../icons/icons';

/**
 * An extra action on a file, beside the viewer's Open in new tab / Download (open in Slack, copy a link, retry):
 * a link to a new tab when `href` is a safe link, else a button the host answers on `ui-action`.
 */
export interface FileAction {
  /** Echoed as `detail.action` in `ui-action`. `open` and `download` are the built-ins' and are skipped here. */
  id: string;
  /** The button's text (and its name). */
  label: string;
  /** A glyph from `@2lab.ai/ui/icons`. Without one the action keeps its text on phones too. */
  icon?: IconName;
  /** Follow this link in a new tab: http(s), `mailto:` or relative. Any other scheme is dropped (a button then). */
  href?: string;
}

/**
 * One file the agent made (or the person attached): what `<ui-file-card>` draws and `<ui-artifact-viewer>` pages
 * through. Only `id` and `name` are required; the kind comes from `kind`, else the MIME type, else the extension.
 */
export interface FileItem {
  id: string;
  name: string;
  /** Wins over `mime` / the extension. */
  kind?: FileKind;
  mime?: string;
  /** Bytes (drawn as 12.4 KB). */
  size?: number;
  /** When it was made, ms epoch (drawn as "5m ago" / "5분 전"). */
  time?: number;
  /** Open / download / media source. */
  url?: string;
  /** Image thumbnail source (else `url` for images). */
  thumb?: string;
  /** Inline content: markdown, text, code, or an HTML page (shown in a sandboxed frame, never in the DOM). */
  text?: string;
  /** One extra quiet line ("from Build agent"). */
  meta?: string;
  /** File name for Download (default `name`). */
  downloadName?: string;
  /** Extra viewer actions after Open / Download (the file's Slack permalink …) → `ui-action` with their `id`. */
  actions?: FileAction[];
}

/** `tile` — thumbnail card · `row` — one line in a list · `chip` — a pill with the glyph and name. */
export type FileCardVariant = 'tile' | 'row' | 'chip';

const VARIANTS: readonly FileCardVariant[] = ['tile', 'row', 'chip'];

/** The `variant` attribute as a variant (unknown or missing → `tile`). */
export function fileCardVariant(value: string | null | undefined): FileCardVariant {
  return VARIANTS.includes(value as FileCardVariant) ? (value as FileCardVariant) : 'tile';
}

/** Kind words for badges and labels, and the play toggle's names. */
export const FILE_STRINGS = {
  en: {
    play: (name: string) => `Play ${name}`,
    pause: (name: string) => `Pause ${name}`,
    kinds: {
      image: 'Image',
      audio: 'Audio',
      video: 'Video',
      markdown: 'Markdown',
      html: 'HTML',
      pdf: 'PDF',
      code: 'Code',
      text: 'Text',
      file: 'File',
    } as Record<FileKind, string>,
  },
  ko: {
    play: (name: string) => `${name} 재생`,
    pause: (name: string) => `${name} 일시정지`,
    kinds: {
      image: '이미지',
      audio: '오디오',
      video: '동영상',
      markdown: '마크다운',
      html: 'HTML',
      pdf: 'PDF',
      code: '코드',
      text: '텍스트',
      file: '파일',
    } as Record<FileKind, string>,
  },
};

/**
 * Each kind's tint token (the glyph and its soft wash are mixed from it). Status hues carry meaning elsewhere, so
 * they are used here only as quiet washes: 14% into the card, the glyph at 70% toward ink.
 */
export const FILE_TINTS: Readonly<Record<FileKind, string>> = {
  image: 'var(--st-run)',
  audio: 'var(--purple)',
  video: 'var(--orange)',
  markdown: 'var(--st-done)',
  html: 'var(--st-wait)',
  pdf: 'var(--st-fail)',
  code: 'var(--ib-spark)',
  text: 'var(--ib-muted)',
  file: 'var(--ib-muted)',
};

const isKo = (lang: string | null | undefined): boolean => lang === 'ko';

/** The item's kind: `kind` wins, else the MIME type, else the extension (unknown → `file`). */
export function fileItemKind(item: Partial<FileItem> | null | undefined): FileKind {
  if (!item) return 'file';
  return fileKind({ kind: item.kind, mime: item.mime, name: item.name });
}

/** The kind word: Image / 이미지 … */
export function fileKindLabel(kind: FileKind, lang?: string | null): string {
  return (isKo(lang) ? FILE_STRINGS.ko : FILE_STRINGS.en).kinds[kind] ?? FILE_STRINGS.en.kinds.file;
}

/** Relative time in the card's language: "5m ago" / "5분 전" ('' for a missing time). */
export function fileAgo(at: unknown, now: number = Date.now(), lang?: string | null): string {
  const t = Number(at);
  if (!Number.isFinite(t) || t <= 0) return '';
  if (!isKo(lang)) return fmtAgo(t, now);
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 45) return '방금';
  const m = Math.floor(s / 60);
  if (m < 60) return `${Math.max(1, m)}분 전`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

/** The quiet meta line: "12.4 KB · 5m ago" (parts that are missing are left out). */
export function fileMeta(item: Partial<FileItem> | null | undefined, now: number = Date.now(), lang?: string): string {
  if (!item) return '';
  return [fmtBytes(item.size), fileAgo(item.time, now, lang)].filter(Boolean).join(' · ');
}

/** The name to draw: the item's name, or the kind word when it has none. */
export function fileDisplayName(item: Partial<FileItem> | null | undefined, lang?: string): string {
  const n = String(item?.name ?? '').trim();
  return n || fileKindLabel(fileItemKind(item), lang);
}

/** The raw thumbnail source of an image item (thumb, else url) that passes `safeSrc`; '' for other kinds or none. */
export function fileThumbSrc(item: Partial<FileItem> | null | undefined): string {
  if (!item || fileItemKind(item) !== 'image') return '';
  for (const s of [item.thumb, item.url]) {
    const v = String(s ?? '').trim();
    if (v && safeSrc(v)) return v;
  }
  return '';
}

/**
 * The source a card plays in place (`playable`): the url of an audio file (any variant) or a video (tiles only)
 * when it passes `safeSrc`; '' when the card has nothing to play.
 */
export function filePlaySrc(item: Partial<FileItem> | null | undefined, variant: FileCardVariant = 'tile'): string {
  if (!item) return '';
  const kind = fileItemKind(item);
  if (kind !== 'audio' && !(kind === 'video' && variant === 'tile')) return '';
  const v = String(item.url ?? '').trim();
  return v && safeSrc(v) ? v : '';
}

/** The card's accessible name: "report.png, Image, 12.4 KB · 5m ago, from Build agent". */
export function fileCardLabel(item: Partial<FileItem>, lang?: string, now: number = Date.now()): string {
  const meta = fileMeta(item, now, lang);
  const extra = String(item.meta ?? '').trim();
  return [fileDisplayName(item, lang), fileKindLabel(fileItemKind(item), lang), meta, extra].filter(Boolean).join(', ');
}

export interface FileCardOptions {
  /** Clock for the relative time (tests, or one value for a whole list). Default `Date.now()`. */
  now?: number;
  /** Thumbnail sources that failed to load: those cards draw the glyph instead. */
  broken?: ReadonlySet<string>;
  /** Extra attributes on the card button (escaped; `true` = bare attribute). */
  attrs?: Record<string, string | number | boolean | null | undefined>;
  /** Extra class names on the card button. */
  className?: string;
}

const GLYPH_SIZE: Record<FileCardVariant, number> = { tile: 26, row: 18, chip: 14 };

function imgTag(src: string): string {
  return `<img src="${safeSrc(src)}" alt="" loading="lazy" decoding="async" draggable="false">`;
}

/**
 * One file card as markup (a `<button class="fc fc-{variant}">`): the shared renderer of `<ui-file-card>` and
 * `<ui-artifact-viewer>`. Style it with `fileCardStyles`. Every string is escaped; image sources go through
 * `safeSrc` (http(s), relative, `blob:`, base64 raster `data:image/…`).
 */
export function fileCardHtml(
  item: FileItem,
  variant: FileCardVariant = 'tile',
  lang = 'en',
  opts: FileCardOptions = {},
): string {
  const kind = fileItemKind(item);
  const now = opts.now ?? Date.now();
  const name = fileDisplayName(item, lang);
  const meta = fileMeta(item, now, lang);
  const extra = String(item.meta ?? '').trim();
  const src = fileThumbSrc(item);
  const img = src && !opts.broken?.has(src) ? src : '';
  const glyph = icon(fileKindIcon(kind), { size: GLYPH_SIZE[variant] });
  let inner: string;
  if (variant === 'chip') {
    inner = `<span class="fc-glyph">${glyph}</span><span class="fc-name">${esc(name)}</span>`;
  } else if (variant === 'row') {
    const line = [meta, extra].filter(Boolean).join(' · ');
    inner = `<span class="${cls('fc-box', img && 'has-img')}">${img ? imgTag(img) : glyph}</span><span class="fc-text"><span class="fc-name">${esc(
      name,
    )}</span>${line ? `<span class="fc-meta">${esc(line)}</span>` : ''}</span>`;
  } else {
    const ext = fileExt(item.name).toUpperCase().slice(0, 5);
    const thumb = img ? imgTag(img) : `${glyph}${ext ? `<span class="fc-ext">${esc(ext)}</span>` : ''}`;
    inner = `<span class="${cls('fc-thumb', img && 'has-img')}">${thumb}</span><span class="fc-text"><span class="fc-name">${esc(
      name,
    )}</span>${meta ? `<span class="fc-meta">${esc(meta)}</span>` : ''}${extra ? `<span class="fc-sub">${esc(extra)}</span>` : ''}</span>`;
  }
  return `<button${attrs({
    type: 'button',
    class: cls('fc', `fc-${variant}`, opts.className),
    'data-kind': kind,
    'aria-label': fileCardLabel(item, lang, now),
    ...opts.attrs,
  })}>${inner}</button>`;
}
