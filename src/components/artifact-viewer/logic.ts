import { fileKindIcon } from '../../core/files';
import { attrs, cls, esc, escAttr, safeLink, safeSrc } from '../../core/html';
import { markdownHtml } from '../../core/markdown';
import { icon } from '../../icons/icons';
import {
  type FileAction,
  type FileItem,
  fileDisplayName,
  fileItemKind,
  fileItemKindLabel,
  fileMeta,
  fileThumbSrc,
} from '../file-card/render';

/**
 * `strip` — one scrolling row · `grid` — auto-fill tiles ≥ 132px · `chips` — wrapping name pills · `list` — rows ·
 * `none` — no tiles at all: the viewer only, opened over the host's own tiles (`open(items, index, opener)`).
 */
export type ArtifactLayout = 'strip' | 'grid' | 'chips' | 'list' | 'none';

const LAYOUTS: readonly ArtifactLayout[] = ['strip', 'grid', 'chips', 'list', 'none'];

/** A layout value as a layout (unknown or missing → `strip`). */
export function artifactLayout(value: unknown): ArtifactLayout {
  return LAYOUTS.includes(value as ArtifactLayout) ? (value as ArtifactLayout) : 'strip';
}

export const STRINGS = {
  en: {
    files: 'Files',
    empty: 'No files yet',
    prev: 'Previous',
    next: 'Next',
    openTab: 'Open in new tab',
    download: 'Download',
    zoom: 'Zoom',
    scriptsOff: 'Scripts are off',
    noPreview: 'No preview',
    pos: (i: number, n: number) => `File ${i} of ${n}`,
  },
  ko: {
    files: '파일',
    empty: '아직 파일이 없어요',
    prev: '이전',
    next: '다음',
    openTab: '새 탭에서 열기',
    download: '다운로드',
    zoom: '확대',
    scriptsOff: '스크립트 꺼짐',
    noPreview: '미리보기 없음',
    pos: (i: number, n: number) => `${n}개 중 ${i}번째`,
  },
};
export type ViewerStrings = (typeof STRINGS)['en'];

/** The strings for a `lang` value (English unless `ko`). */
export function viewerStrings(lang: string | null | undefined): ViewerStrings {
  return lang === 'ko' ? STRINGS.ko : STRINGS.en;
}

/** Hover intent before the peek opens, and the grace that lets the pointer travel onto it (WCAG 1.4.13). */
export const PEEK_DELAY_MS = 350;
export const PEEK_GRACE_MS = 200;
/** Moving between tiles while a peek is open swaps it quickly. */
export const PEEK_WARM_MS = 90;
/** The peek draws a document’s head only. */
const PEEK_CHARS = 4000;
/** Plain text stops here (escaping is linear, but a viewer is not a pager). */
const VIEW_CHARS = 1_000_000;
/** A markdown document longer than this is shown as plain text (escaping is linear; marking up is not free). */
export const MARKDOWN_VIEW_CHARS = 256_000;

/** The last markdown body built, so re-syncing the open viewer with the same document never re-renders it. */
let mdMemo: { text: string; html: string } | undefined;
function markdownBody(text: string): string {
  if (mdMemo?.text !== text) mdMemo = { text, html: markdownHtml(text) };
  return mdMemo.html;
}

/** The first `lines` lines of a text (the peek's code / text preview). */
export function textHead(text: unknown, lines = 24): string {
  return String(text ?? '')
    .slice(0, PEEK_CHARS)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .slice(0, lines)
    .join('\n');
}

/** The next index after a step, held at the ends (no wrap): -1 when there is nothing to show. */
export function stepIndex(index: number, delta: number, count: number): number {
  if (count <= 0) return -1;
  return Math.max(0, Math.min(count - 1, index + delta));
}

/** Items with an id (strings or numbers) — anything else is dropped. */
export function artifactItems(items: unknown): FileItem[] {
  if (!Array.isArray(items)) return [];
  return items.filter(
    (it): it is FileItem => !!it && typeof it === 'object' && (typeof it.id === 'string' || typeof it.id === 'number'),
  );
}

/** The raw full-size media source (url, else thumb for images) that passes `safeSrc`. */
export function mediaSrc(item: FileItem): string {
  const kind = fileItemKind(item);
  const list = kind === 'image' ? [item.url, item.thumb] : [item.url];
  for (const s of list) {
    const v = String(s ?? '').trim();
    if (v && safeSrc(v)) return v;
  }
  return '';
}

/** The url for Open / Download when it is a safe app link ('' otherwise). */
export function actionUrl(item: FileItem): string {
  const v = String(item.url ?? '').trim();
  return v && safeLink(v) !== '#' ? v : '';
}

/** Which of Open in new tab / Download the item gets. */
export function viewerActions(
  item: FileItem,
  flags: { download?: boolean; openInTab?: boolean } = {},
): Array<'open' | 'download'> {
  if (!actionUrl(item)) return [];
  const out: Array<'open' | 'download'> = [];
  if (flags.openInTab !== false) out.push('open');
  if (flags.download !== false) out.push('download');
  return out;
}

/** Open / Download anchors (`data-act`); the primary one draws in ink (the fallback card's Download). */
export function actionsHtml(
  item: FileItem,
  acts: Array<'open' | 'download'>,
  t: ViewerStrings,
  primary: 'download' | '' = '',
): string {
  const url = actionUrl(item);
  if (!url) return '';
  return acts
    .map((a) => {
      const label = a === 'open' ? t.openTab : t.download;
      const extra =
        a === 'open'
          ? { target: '_blank', rel: 'noopener noreferrer' }
          : { download: String(item.downloadName ?? '').trim() || fileDisplayName(item) };
      return `<a${attrs({
        class: cls('av-act', primary === a && 'is-primary'),
        'data-act': a,
        title: label,
        'aria-label': label,
        ...extra,
      })} href="${safeLink(url)}">${icon(a === 'open' ? 'external' : 'download')}<span class="av-act-t">${esc(label)}</span></a>`;
    })
    .join('');
}

/** At most this many extra actions per file (a footer, not a menu). */
export const MAX_EXTRA_ACTIONS = 4;

/**
 * The item's extra actions that can be drawn: an id and a label, not a built-in id (`open` / `download`), the
 * first of each id, at most `MAX_EXTRA_ACTIONS`. `href` is kept only when it is a safe link (else it is a button).
 */
export function extraActions(item: Partial<FileItem> | null | undefined): FileAction[] {
  const list = Array.isArray(item?.actions) ? item.actions : [];
  const seen = new Set<string>(['open', 'download']);
  const out: FileAction[] = [];
  for (const a of list) {
    if (!a || typeof a !== 'object') continue;
    const id = String(a.id ?? '').trim();
    const label = String(a.label ?? '').trim();
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    const href = String(a.href ?? '').trim();
    out.push({
      id,
      label,
      ...(a.icon ? { icon: a.icon } : {}),
      ...(href && safeLink(href) !== '#' ? { href } : {}),
    });
    if (out.length >= MAX_EXTRA_ACTIONS) break;
  }
  return out;
}

/**
 * The extra actions as anchors (with a safe `href`, new tab) or buttons, `data-x` carrying the id. Without an icon
 * the action keeps its text where the built-ins shrink to icons (`is-text`). `primary` draws the first in ink.
 */
export function extraActionsHtml(item: FileItem, primary = false): string {
  return extraActions(item)
    .map((a, i) => {
      const glyph = a.icon ? icon(a.icon) : '';
      const base = {
        class: cls('av-act', !glyph && 'is-text', primary && i === 0 && 'is-primary'),
        'data-x': a.id,
        'data-key': `x:${a.id}`,
        title: a.label,
        'aria-label': a.label,
      };
      const inner = `${glyph}<span class="av-act-t">${esc(a.label)}</span>`;
      return a.href
        ? `<a${attrs({ ...base, target: '_blank', rel: 'noopener noreferrer' })} href="${safeLink(a.href)}">${inner}</a>`
        : `<button${attrs({ type: 'button', ...base })}>${inner}</button>`;
    })
    .join('');
}

const frameAttrs = (item: FileItem): string => {
  const text = item.text;
  if (typeof text === 'string' && text) return ` srcdoc="${escAttr(text)}"`;
  const src = safeSrc(item.url);
  return src ? ` src="${src}"` : '';
};

const hasText = (item: FileItem): boolean => typeof item.text === 'string' && item.text.length > 0;

/** The peek card's inside: a larger preview, then "name · kind · meta". */
export function peekHtml(item: FileItem, lang: string, now: number, broken: ReadonlySet<string>): string {
  const kind = fileItemKind(item);
  const name = fileDisplayName(item, lang);
  const meta = [fileItemKindLabel(item, lang), fileMeta(item, now, lang)].filter(Boolean).join(' · ');
  let media = '';
  let doc = false;
  if (kind === 'image') {
    const src = mediaSrc(item) || fileThumbSrc(item);
    if (src && !broken.has(src)) media = `<img class="av-pk-img" src="${safeSrc(src)}" alt="" decoding="async">`;
  } else if (kind === 'markdown' && hasText(item)) {
    doc = true;
    media = `<div class="av-pk-doc md-doc">${markdownHtml(String(item.text).slice(0, PEEK_CHARS))}</div>`;
  } else if ((kind === 'text' || kind === 'code' || kind === 'file') && hasText(item)) {
    doc = true;
    media = `<pre class="av-pk-pre">${esc(textHead(item.text))}</pre>`;
  } else if (kind === 'html') {
    const src = frameAttrs(item);
    if (src)
      media = `<div class="av-pk-frame"><iframe sandbox="" tabindex="-1" loading="lazy" referrerpolicy="no-referrer" title=""${src}></iframe></div>`;
  }
  if (!media) {
    media = `<span class="av-pk-glyph"><span class="av-big">${icon(fileKindIcon(kind), { size: 28 })}</span></span>`;
  }
  return `<div${attrs({ class: 'av-pk-media', 'data-doc': doc })}>${media}</div><div class="av-pk-foot"><span class="av-pk-name">${esc(
    name,
  )}</span>${meta ? `<span class="av-pk-meta">${esc(meta)}</span>` : ''}</div>`;
}

export interface ViewerBodyOptions {
  lang: string;
  now: number;
  broken: ReadonlySet<string>;
  zoomed: boolean;
  acts: Array<'open' | 'download'>;
}

/** What the body shows for an item: a preview kind, or `fallback` (the calm card with the actions). */
export type ViewerBodyKind = 'image' | 'markdown' | 'text' | 'html' | 'audio' | 'video' | 'fallback';

/** The body an item gets, from its kind and the content it carries. */
export function viewerBodyKind(item: FileItem, broken: ReadonlySet<string> = new Set()): ViewerBodyKind {
  const kind = fileItemKind(item);
  const src = mediaSrc(item);
  if (kind === 'image') return src && !broken.has(src) ? 'image' : 'fallback';
  if (kind === 'markdown')
    return hasText(item) ? (String(item.text).length > MARKDOWN_VIEW_CHARS ? 'text' : 'markdown') : 'fallback';
  if (kind === 'html') return frameAttrs(item) ? 'html' : 'fallback';
  if (kind === 'audio') return src ? 'audio' : 'fallback';
  if (kind === 'video') return src ? 'video' : 'fallback';
  if (kind === 'text' || kind === 'code' || kind === 'file') return hasText(item) ? 'text' : 'fallback';
  return 'fallback';
}

/** The viewer's built-in body for an item (the fallback content of the `preview` slot). */
export function viewerBodyHtml(item: FileItem, o: ViewerBodyOptions): string {
  const t = viewerStrings(o.lang);
  const kind = fileItemKind(item);
  const name = fileDisplayName(item, o.lang);
  const body = viewerBodyKind(item, o.broken);
  const src = mediaSrc(item);
  switch (body) {
    case 'image':
      return `<div class="${cls('av-body av-img', o.zoomed && 'is-zoomed')}"><div class="av-imgbox"><img class="av-pic" src="${safeSrc(
        src,
      )}" alt="${escAttr(name)}" decoding="async" draggable="false"></div></div>`;
    case 'markdown':
      return `<div class="av-body av-doc"><div class="md-doc">${markdownBody(String(item.text))}</div></div>`;
    case 'text':
      return `<div class="av-body av-text"><pre class="av-pre"><code>${esc(String(item.text).slice(0, VIEW_CHARS))}</code></pre></div>`;
    case 'html':
      return `<div class="av-body av-html"><p class="av-note">${icon('info', { size: 14 })}<span>${esc(
        t.scriptsOff,
      )}</span></p><iframe class="av-frame" sandbox="" referrerpolicy="no-referrer" title="${escAttr(name)}"${frameAttrs(item)}></iframe></div>`;
    case 'audio':
      return `<div class="av-body av-media av-audio"><span class="av-big">${icon(fileKindIcon(kind), {
        size: 32,
      })}</span><span class="av-fname">${esc(name)}</span><audio controls preload="metadata" src="${safeSrc(src)}"></audio></div>`;
    case 'video':
      return `<div class="av-body av-media av-vid"><div class="av-vbox"><video class="av-video" controls playsinline preload="metadata" src="${safeSrc(
        src,
      )}"></video></div></div>`;
    default: {
      const meta = fileMeta(item, o.now, o.lang);
      const extra = String(item.meta ?? '').trim();
      // A file with no Download of its own (only Slack has it) leads with its first extra action.
      const acts = actionsHtml(item, o.acts, t, 'download') + extraActionsHtml(item, !o.acts.includes('download'));
      return `<div class="av-body av-fallback"><div class="av-card"><span class="av-big">${icon(fileKindIcon(kind), {
        size: 32,
      })}</span><span class="av-fname">${esc(name)}</span>${meta ? `<span class="av-fmeta">${esc(meta)}</span>` : ''}${
        extra ? `<span class="av-fmeta">${esc(extra)}</span>` : ''
      }<span class="av-fnote">${esc(t.noPreview)}</span>${acts ? `<span class="av-facts">${acts}</span>` : ''}</div></div>`;
    }
  }
}
