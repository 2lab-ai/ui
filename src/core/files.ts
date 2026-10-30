import type { IconName } from '../icons/icons';

/**
 * What a file is, for drawing it: the glyph, the tint, which preview the viewer can give it. Shared by
 * `<ui-file-card>` / `<ui-artifact-viewer>` (artifacts) and `<ui-composer>` (attachments).
 */
export type FileKind = 'image' | 'audio' | 'video' | 'markdown' | 'html' | 'pdf' | 'code' | 'text' | 'file';

export const FILE_KINDS: readonly FileKind[] = [
  'image',
  'audio',
  'video',
  'markdown',
  'html',
  'pdf',
  'code',
  'text',
  'file',
];

const EXT: Record<string, FileKind> = {};
const add = (kind: FileKind, list: string) => {
  for (const e of list.split(' ')) EXT[e] = kind;
};
add('image', 'png jpg jpeg gif webp avif bmp svg ico heic heif tif tiff');
add('audio', 'mp3 wav ogg oga m4a aac flac weba opus');
add('video', 'mp4 webm mov m4v mkv ogv avi');
add('markdown', 'md markdown mdx');
add('html', 'html htm xhtml');
add('pdf', 'pdf');
add(
  'code',
  'js mjs cjs ts tsx jsx json jsonc py rb go rs java kt swift c h cc cpp hpp cs php sh bash zsh fish sql yaml yml toml ini css scss less vue svelte xml graphql lua r pl dart scala ex exs',
);
add('text', 'txt log csv tsv text rtf env');

/** The file name's extension, lower case, without the dot ('' when none). */
export function fileExt(name: unknown): string {
  const base = String(name ?? '')
    .split(/[?#]/)[0]
    .split(/[\\/]/)
    .pop()!;
  const at = base.lastIndexOf('.');
  return at > 0 && at < base.length - 1 ? base.slice(at + 1).toLowerCase() : '';
}

/**
 * The kind of a file from an explicit kind, its MIME type, then its extension. Unknown → `file`.
 * `fileKind({ name: 'shot.png' })` → `image` · `fileKind({ mime: 'text/markdown' })` → `markdown`.
 */
export function fileKind(
  f: { kind?: unknown; mime?: unknown; type?: unknown; name?: unknown } | null | undefined,
): FileKind {
  if (!f) return 'file';
  if (typeof f.kind === 'string' && (FILE_KINDS as readonly string[]).includes(f.kind)) return f.kind as FileKind;
  const mime = String(f.mime ?? f.type ?? '')
    .toLowerCase()
    .split(';')[0]
    .trim();
  if (mime) {
    if (mime === 'text/markdown' || mime === 'text/x-markdown') return 'markdown';
    if (mime === 'text/html' || mime === 'application/xhtml+xml') return 'html';
    if (mime === 'application/pdf') return 'pdf';
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime.startsWith('video/')) return 'video';
    if (/(json|javascript|typescript|x-sh|x-python|yaml|xml|sql)/.test(mime)) return 'code';
  }
  const byExt = EXT[fileExt(f.name)];
  if (byExt) return byExt;
  if (mime.startsWith('text/')) return 'text';
  return 'file';
}

/** The glyph from `@2lab.ai/ui/icons` for a kind. */
export function fileKindIcon(kind: FileKind): IconName {
  switch (kind) {
    case 'image':
      return 'file-image';
    case 'audio':
      return 'file-audio';
    case 'video':
      return 'file-video';
    case 'html':
    case 'code':
      return 'file-code';
    case 'markdown':
    case 'text':
    case 'pdf':
      return 'file-text';
    default:
      return 'file';
  }
}

/** Bytes the way a file list shows them: 820 B, 12.4 KB, 3.1 MB, 1.2 GB ('' for a missing / negative size). */
export function fmtBytes(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return '';
  if (v < 1024) return `${Math.round(v)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let x = v / 1024;
  let u = 0;
  while (x >= 1024 && u < units.length - 1) {
    x /= 1024;
    u++;
  }
  const s = x >= 100 ? String(Math.round(x)) : x.toFixed(1).replace(/\.0$/, '');
  return `${s} ${units[u]}`;
}
