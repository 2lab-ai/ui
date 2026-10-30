import { beforeEach, describe, expect, it } from 'vitest';
import type { UiFileCard } from './file-card';
import {
  FILE_TINTS,
  type FileItem,
  fileAgo,
  fileCardHtml,
  fileCardLabel,
  fileCardVariant,
  fileDisplayName,
  fileItemKind,
  fileKindLabel,
  fileMeta,
  fileThumbSrc,
} from './render';
import { fileCardStyles, styles } from './styles';
import './file-card';

const NOW = Date.UTC(2026, 9, 30, 12, 0, 0);
const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const XSS = '<img src=x onerror=alert(1)>';

function mount(data: FileItem, attrs: Record<string, string> = {}): UiFileCard {
  const el = document.createElement('ui-file-card');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiFileCard, s: string) => el.shadowRoot!.querySelector<E>(s);
const qa = (el: UiFileCard, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('helpers', () => {
  it('fileItemKind: kind wins, then mime, then extension', () => {
    expect(fileItemKind({ name: 'a.png', kind: 'pdf' })).toBe('pdf');
    expect(fileItemKind({ name: 'a.bin', mime: 'text/markdown' })).toBe('markdown');
    expect(fileItemKind({ name: 'run.log' })).toBe('text');
    expect(fileItemKind({ name: 'main.ts' })).toBe('code');
    expect(fileItemKind({ name: 'blob' })).toBe('file');
    expect(fileItemKind(null)).toBe('file');
  });

  it('every kind has a token tint and a kind word in both languages', () => {
    expect(FILE_TINTS.image).toBe('var(--st-run)');
    expect(FILE_TINTS.audio).toBe('var(--purple)');
    expect(FILE_TINTS.video).toBe('var(--orange)');
    expect(FILE_TINTS.markdown).toBe('var(--st-done)');
    expect(FILE_TINTS.html).toBe('var(--st-wait)');
    expect(FILE_TINTS.pdf).toBe('var(--st-fail)');
    expect(FILE_TINTS.code).toBe('var(--ib-spark)');
    expect(FILE_TINTS.text).toBe('var(--ib-muted)');
    expect(FILE_TINTS.file).toBe('var(--ib-muted)');
    expect(fileKindLabel('video')).toBe('Video');
    expect(fileKindLabel('video', 'ko')).toBe('동영상');
    expect(fileKindLabel('markdown', 'ko')).toBe('마크다운');
  });

  it('fileMeta joins size and relative time, leaving out what is missing', () => {
    expect(fileMeta({ size: 12_700, time: NOW - 5 * 60_000 }, NOW)).toBe('12.4 KB · 5m ago');
    expect(fileMeta({ size: 12_700, time: NOW - 5 * 60_000 }, NOW, 'ko')).toBe('12.4 KB · 5분 전');
    expect(fileMeta({ size: 820 }, NOW)).toBe('820 B');
    expect(fileMeta({ time: NOW - 3 * 3_600_000 }, NOW, 'ko')).toBe('3시간 전');
    expect(fileMeta({}, NOW)).toBe('');
  });

  it('fileAgo speaks Korean and ignores junk', () => {
    expect(fileAgo(NOW - 10_000, NOW, 'ko')).toBe('방금');
    expect(fileAgo(NOW - 3 * 86_400_000, NOW, 'ko')).toBe('3일 전');
    expect(fileAgo(NOW - 10_000, NOW)).toBe('just now');
    expect(fileAgo(undefined, NOW)).toBe('');
    expect(fileAgo('x', NOW)).toBe('');
  });

  it('fileThumbSrc takes a safe thumb or url for images only', () => {
    expect(fileThumbSrc({ name: 'a.png', thumb: PNG, url: '/a.png' })).toBe(PNG);
    expect(fileThumbSrc({ name: 'a.png', thumb: 'javascript:alert(1)', url: '/files/a.png' })).toBe('/files/a.png');
    expect(fileThumbSrc({ name: 'a.png', url: 'blob:https://app.example/1234' })).toBe('blob:https://app.example/1234');
    expect(fileThumbSrc({ name: 'a.png', url: 'javascript:alert(1)' })).toBe('');
    expect(fileThumbSrc({ name: 'a.txt', url: '/a.txt' })).toBe('');
  });

  it('labels, names and variants', () => {
    expect(fileCardLabel({ name: 'r.png', size: 2048, time: NOW - 120_000, meta: 'from Build' }, 'en', NOW)).toBe(
      'r.png, Image, 2 KB · 2m ago, from Build',
    );
    expect(fileDisplayName({ name: '  ', mime: 'application/pdf' })).toBe('PDF');
    expect(fileCardVariant('row')).toBe('row');
    expect(fileCardVariant('huge')).toBe('tile');
  });

  it('fileCardHtml escapes and carries extra attributes', () => {
    const html = fileCardHtml({ id: '1', name: XSS, meta: '"><b>x</b>' }, 'row', 'en', {
      now: NOW,
      attrs: { 'data-i': 3 },
    });
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
    expect(html).toContain('data-i="3"');
  });

  it('styles use tokens only: no colour literals, no hover movement', () => {
    for (const css of [styles, fileCardStyles]) {
      expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
      const hover = css.match(/@media \(hover: hover\) and \(pointer: fine\) \{[\s\S]*?\n\}/)?.[0] ?? '';
      expect(hover).toContain('border-color: var(--ib-muted)');
      expect(hover).not.toMatch(/transform|translate|scale/);
    }
  });
});

describe('<ui-file-card>', () => {
  it('renders a tile with the glyph, extension, name and meta', () => {
    const el = mount({ id: 'a', name: 'notes.md', size: 4200, time: Date.now() - 5 * 60_000 });
    const b = q(el, 'button.fc')!;
    expect(b.classList.contains('fc-tile')).toBe(true);
    expect(b.dataset.kind).toBe('markdown');
    expect(q(el, '.fc-thumb svg')).not.toBeNull();
    expect(q(el, '.fc-ext')?.textContent).toBe('MD');
    expect(q(el, '.fc-name')?.textContent).toBe('notes.md');
    expect(q(el, '.fc-meta')?.textContent).toBe('4.1 KB · 5m ago');
    expect(b.getAttribute('aria-label')).toBe('notes.md, Markdown, 4.1 KB · 5m ago');
  });

  it('an image tile draws a lazy, decorative thumbnail through safeSrc', () => {
    const el = mount({ id: 'a', name: 'shot.png', thumb: PNG });
    const img = q<HTMLImageElement>(el, '.fc-thumb img')!;
    expect(img.getAttribute('src')).toBe(PNG);
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
    expect(img.getAttribute('alt')).toBe('');
    expect(q(el, '.fc-thumb')?.classList.contains('has-img')).toBe(true);
  });

  it('rejects a javascript: image source and draws the glyph', () => {
    const el = mount({ id: 'a', name: 'shot.png', thumb: 'javascript:alert(1)', url: 'javascript:alert(2)' });
    expect(q(el, 'img')).toBeNull();
    expect(q(el, '.fc-thumb svg')).not.toBeNull();
  });

  it('rejects data:text/html and protocol-relative image sources', () => {
    for (const bad of ['data:text/html,<script>alert(1)</script>', '//evil.example/x.png', 'vbscript:x']) {
      const el = mount({ id: 'a', name: 'shot.png', thumb: bad, url: bad });
      expect(q(el, 'img')).toBeNull();
      expect(el.shadowRoot!.innerHTML).not.toContain('evil.example');
      expect(el.shadowRoot!.innerHTML).not.toContain('<script');
    }
  });

  it('the variant property normalises and reflects to the attribute', () => {
    const el = mount({ id: 'a', name: 'notes.md' });
    expect(el.variant).toBe('tile');
    el.variant = 'row';
    expect(el.getAttribute('variant')).toBe('row');
    el.renderNow();
    expect(q(el, '.fc-row')).not.toBeNull();
    el.variant = 'poster' as never;
    expect(el.getAttribute('variant')).toBe('tile');
    el.setAttribute('variant', 'banner');
    el.renderNow();
    expect(el.variant).toBe('tile');
    expect(q(el, '.fc-tile')).not.toBeNull();
  });

  it('a broken thumbnail falls back to the glyph', async () => {
    const el = mount({ id: 'a', name: 'shot.png', url: '/missing.png' });
    q(el, 'img')!.dispatchEvent(new Event('error'));
    await Promise.resolve();
    el.renderNow();
    expect(q(el, 'img')).toBeNull();
    expect(q(el, '.fc-thumb svg')).not.toBeNull();
  });

  it('row and chip variants', () => {
    const el = mount({ id: 'a', name: 'build.log', size: 900, meta: 'from Build agent' }, { variant: 'row' });
    expect(q(el, '.fc-row .fc-box svg')).not.toBeNull();
    expect(q(el, '.fc-meta')?.textContent).toBe('900 B · from Build agent');
    el.setAttribute('variant', 'chip');
    el.renderNow();
    expect(q(el, '.fc-chip .fc-glyph svg')).not.toBeNull();
    expect(q(el, '.fc-chip .fc-name')?.textContent).toBe('build.log');
    expect(q(el, '.fc-meta')).toBeNull();
  });

  it('escapes the name and meta line', () => {
    const el = mount({ id: 'a', name: XSS, meta: '"><b>bold</b>', mime: 'text/plain' });
    expect(q(el, 'img')).toBeNull();
    expect(q(el, 'b')).toBeNull();
    expect(q(el, '.fc-name')?.textContent).toBe(XSS);
    expect(q(el, '.fc-sub')?.textContent).toBe('"><b>bold</b>');
  });

  it('click sends a cancelable ui-open with the id', () => {
    const el = mount({ id: 'f-9', name: 'a.pdf' });
    const seen: Array<{ id: string; cancelable: boolean }> = [];
    el.addEventListener('ui-open', (e) => {
      const ev = e as CustomEvent<{ id: string }>;
      seen.push({ id: ev.detail.id, cancelable: ev.cancelable });
      ev.preventDefault();
    });
    q(el, 'button')!.click();
    expect(seen).toEqual([{ id: 'f-9', cancelable: true }]);
  });

  it('keeps the same button node (and focus) across data updates', () => {
    const el = mount({ id: 'a', name: 'a.txt' });
    const b = q(el, 'button')!;
    b.focus();
    el.data = { id: 'a', name: 'b.txt' };
    el.renderNow();
    expect(q(el, 'button')).toBe(b);
    expect(q(el, '.fc-name')?.textContent).toBe('b.txt');
    expect(el.shadowRoot!.activeElement).toBe(b);
  });

  it('speaks Korean with lang="ko"', () => {
    const el = mount({ id: 'a', name: 'clip.mp4', size: 3_200_000, time: Date.now() - 2 * 3_600_000 }, { lang: 'ko' });
    expect(q(el, '.fc-meta')?.textContent).toBe('3.1 MB · 2시간 전');
    expect(q(el, 'button')?.getAttribute('aria-label')).toBe('clip.mp4, 동영상, 3.1 MB · 2시간 전');
  });

  it('renders nothing without data', () => {
    const el = document.createElement('ui-file-card');
    document.body.append(el);
    el.renderNow();
    expect(qa(el, 'button')).toHaveLength(0);
  });
});
