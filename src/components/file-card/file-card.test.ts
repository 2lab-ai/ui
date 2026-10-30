import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FilePlayDetail, UiFileCard } from './file-card';
import {
  FILE_TINTS,
  type FileItem,
  fileAgo,
  fileCardHtml,
  fileCardLabel,
  fileCardVariant,
  fileDisplayName,
  fileItemKind,
  fileItemKindLabel,
  fileKindLabel,
  fileMeta,
  filePlaySrc,
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

describe('play in place (D2 G4-3)', () => {
  const WAV = 'blob:https://app.example/memo';
  const memo = (over: Partial<FileItem> = {}): FileItem => ({ id: 'memo', name: 'standup.wav', url: WAV, ...over });

  /** happy-dom does not play: play() / pause() flip `paused` and send their events, like a browser. */
  function stubMedia(): HTMLMediaElement[] {
    const played: HTMLMediaElement[] = [];
    const set = (m: HTMLMediaElement, paused: boolean) =>
      Object.defineProperty(m, 'paused', { configurable: true, get: () => paused });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
      played.push(this);
      set(this, false);
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    });
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
      if (this.paused) return;
      set(this, true);
      this.dispatchEvent(new Event('pause'));
    });
    return played;
  }
  const toggle = (el: UiFileCard) => q<HTMLButtonElement>(el, '.fc-play')!;
  const press = (el: UiFileCard) => {
    toggle(el).click();
    el.renderNow();
  };

  afterEach(() => vi.restoreAllMocks());

  it('filePlaySrc: audio in every variant, video on tiles, safe sources only', () => {
    expect(filePlaySrc(memo())).toBe(WAV);
    expect(filePlaySrc(memo(), 'chip')).toBe(WAV);
    expect(filePlaySrc({ id: 'v', name: 'clip.mp4', url: '/f/clip.mp4' })).toBe('/f/clip.mp4');
    expect(filePlaySrc({ id: 'v', name: 'clip.mp4', url: '/f/clip.mp4' }, 'row')).toBe('');
    expect(filePlaySrc(memo({ url: 'javascript:alert(1)' }))).toBe('');
    expect(filePlaySrc(memo({ url: '' }))).toBe('');
    expect(filePlaySrc({ id: 'p', name: 'a.pdf', url: '/a.pdf' })).toBe('');
    expect(filePlaySrc(null)).toBe('');
  });

  it('only a playable audio / video card gets the toggle, beside the card button (never inside it)', () => {
    expect(q(mount(memo()), '.fc-play')).toBeNull();
    expect(q(mount({ id: 'p', name: 'a.pdf', url: '/a.pdf' }, { playable: '' }), '.fc-play')).toBeNull();
    expect(
      q(mount({ id: 'v', name: 'clip.mp4', url: '/c.mp4' }, { playable: '', variant: 'row' }), '.fc-play'),
    ).toBeNull();
    for (const variant of ['tile', 'row', 'chip']) {
      const el = mount(memo(), { playable: '', variant });
      const btn = toggle(el);
      expect(btn.closest('.fc')).toBeNull();
      expect(btn.getAttribute('type')).toBe('button');
      expect(btn.getAttribute('aria-label')).toBe('Play standup.wav');
      expect(q(el, '.fc')!.classList.contains('has-play')).toBe(true);
      // Nothing loads before someone asks.
      expect(q(el, 'audio.fc-media')!.hasAttribute('src')).toBe(false);
    }
    expect(q(mount(memo(), { playable: '' }), '.fc-over .fc-play')).not.toBeNull();
  });

  it('a press sends a cancelable ui-play; unless prevented the card plays, then pauses on the next press', () => {
    const played = stubMedia();
    const el = mount(memo(), { playable: '' });
    const seen: Array<FilePlayDetail & { cancelable: boolean }> = [];
    const opens: unknown[] = [];
    el.addEventListener('ui-open', (e) => opens.push(e));
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener('ui-play', (e) =>
      seen.push({ ...(e as CustomEvent<FilePlayDetail>).detail, cancelable: e.cancelable }),
    );
    el.addEventListener('ui-play', stop);
    press(el);
    expect(played).toHaveLength(0);
    expect(el.playing).toBe(false);
    el.removeEventListener('ui-play', stop);
    press(el);
    expect(played).toHaveLength(1);
    expect(el.playing).toBe(true);
    expect(q(el, 'audio.fc-media')!.getAttribute('src')).toBe(WAV);
    expect(toggle(el).getAttribute('aria-label')).toBe('Pause standup.wav');
    expect(toggle(el).hasAttribute('data-on')).toBe(true);
    expect(q(el, '.fc-over')!.classList.contains('is-live')).toBe(true);
    press(el);
    expect(el.playing).toBe(false);
    expect(toggle(el).getAttribute('aria-label')).toBe('Play standup.wav');
    expect(seen).toEqual([
      { id: 'memo', playing: true, url: WAV, cancelable: true },
      { id: 'memo', playing: true, url: WAV, cancelable: true },
      { id: 'memo', playing: false, url: WAV, cancelable: true },
    ]);
    expect(opens).toEqual([]);
  });

  it('one card plays at a time', () => {
    stubMedia();
    const a = mount(memo({ id: 'a' }), { playable: '' });
    const b = mount(memo({ id: 'b', name: 'b.wav' }), { playable: '', variant: 'chip' });
    a.play();
    expect(a.playing).toBe(true);
    b.play();
    expect(b.playing).toBe(true);
    expect(a.playing).toBe(false);
    expect(q<HTMLAudioElement>(a, 'audio')!.paused).toBe(true);
  });

  it('the progress line follows the time; the end puts it back and stops', () => {
    stubMedia();
    const el = mount(memo(), { playable: '' });
    el.play();
    const m = q<HTMLAudioElement>(el, 'audio')!;
    Object.defineProperty(m, 'duration', { configurable: true, get: () => 8 });
    Object.defineProperty(m, 'currentTime', { configurable: true, get: () => 2 });
    m.dispatchEvent(new Event('timeupdate'));
    expect(q(el, '.fc-bar')!.getAttribute('style')).toBe('transform:scaleX(0.250)');
    el.renderNow();
    expect(q(el, '.fc-bar')!.getAttribute('style')).toBe('transform:scaleX(0.250)');
    Object.defineProperty(m, 'paused', { configurable: true, get: () => true });
    m.dispatchEvent(new Event('ended'));
    el.renderNow();
    expect(el.playing).toBe(false);
    expect(q(el, '.fc-bar')!.getAttribute('style')).toBe('transform:scaleX(0.000)');
  });

  it('another file, playable off, or leaving the page stops it', () => {
    stubMedia();
    const el = mount(memo(), { playable: '' });
    el.play();
    el.data = memo({ url: 'blob:https://app.example/other' });
    el.renderNow();
    expect(el.playing).toBe(false);
    expect(q(el, 'audio')!.hasAttribute('src')).toBe(false);
    el.play();
    el.removeAttribute('playable');
    el.renderNow();
    expect(el.playing).toBe(false);
    expect(q(el, '.fc-play')).toBeNull();
    el.setAttribute('playable', '');
    el.renderNow();
    el.play();
    const m = q<HTMLAudioElement>(el, 'audio')!;
    el.remove();
    expect(m.paused).toBe(true);
    expect(el.playing).toBe(false);
  });

  it('a video tile plays over its thumbnail', () => {
    stubMedia();
    const el = mount({ id: 'v', name: 'clip.mp4', url: '/f/clip.mp4' }, { playable: '' });
    const v = q<HTMLVideoElement>(el, '.fc-over video.fc-media')!;
    expect(v.hasAttribute('playsinline')).toBe(true);
    expect(q(el, '.fc-over')!.classList.contains('has-video')).toBe(false);
    el.play();
    el.renderNow();
    expect(q(el, '.fc-over video')).toBe(v);
    expect(v.getAttribute('src')).toBe('/f/clip.mp4');
    expect(q(el, '.fc-over')!.classList.contains('has-video')).toBe(true);
  });

  it('names are escaped and Korean with lang="ko"', () => {
    const el = mount(memo({ name: XSS, kind: 'audio' }), { playable: '', lang: 'ko' });
    expect(toggle(el).getAttribute('aria-label')).toBe(`${XSS} 재생`);
    expect(qa(el, 'img')).toHaveLength(0);
  });

  it('styles: the toggle is 32px drawn with a 44px target, ink while playing; rows keep the name clear', () => {
    expect(styles).toMatch(/\.fc-play::before \{ content: ""; position: absolute; inset: -6px;/);
    expect(styles).toMatch(/\.fc-play\[data-on\] \{ border-color: transparent; background: var\(--ib-text\)/);
    expect(styles).toMatch(/\.fc-row\.has-play \{ padding-right: 52px; \}/);
    expect(styles).not.toMatch(/#[0-9a-f]{3,6}\b|rgba?\(/i);
  });
});

describe('part names for container hooks (D2 G4-4)', () => {
  const parts = (el: UiFileCard) =>
    qa(el, '[part]')
      .map((n) => n.getAttribute('part'))
      .join(' ');

  it('a tile exposes card, thumb, ext, text, name, meta and sub', () => {
    const el = mount({ id: 'a', name: 'notes.md', size: 2_048, time: Date.now() - 60_000, meta: 'from Build agent' });
    expect(parts(el)).toBe('root card thumb ext text name meta sub');
    expect(q(el, '.fc-thumb')!.getAttribute('part')).toBe('thumb');
  });

  it('a row exposes its box as thumb; a chip its glyph and name', () => {
    expect(parts(mount({ id: 'a', name: 'a.txt', size: 10 }, { variant: 'row' }))).toBe(
      'root card thumb text name meta',
    );
    expect(parts(mount({ id: 'a', name: 'a.txt' }, { variant: 'chip' }))).toBe('root card glyph name');
  });

  it('a playable tile adds play and progress (and video for a video)', () => {
    const el = mount({ id: 'v', name: 'clip.mp4', url: '/c.mp4' }, { playable: '' });
    expect(parts(el)).toBe('root card thumb ext text name video progress play');
  });

  it('fileCardHtml carries the names too (the viewer’s tiles), and attrs can still override part', () => {
    expect(fileCardHtml({ id: '1', name: 'a.png' }, 'tile')).toContain('part="card"');
    expect(fileCardHtml({ id: '1', name: 'a.png' }, 'tile', 'en', { attrs: { part: 'tile' } })).toContain(
      'part="tile"',
    );
  });
});

describe('focus and the kind word (D2 G4-5)', () => {
  it('focus() focuses the card button; before the first render it renders first', () => {
    const el = document.createElement('ui-file-card');
    el.data = { id: 'a', name: 'a.txt' };
    document.body.append(el);
    el.focus();
    expect(el.shadowRoot!.activeElement).toBe(q(el, 'button.fc'));
    expect(document.activeElement).toBe(el);
    const empty = document.createElement('ui-file-card');
    document.body.append(empty);
    expect(() => empty.focus()).not.toThrow();
  });

  it('kindLabel replaces the kind word in the name, and stands in for a missing name (escaped)', () => {
    expect(fileItemKindLabel({ name: 'answer.md', kindLabel: ' Answer ' })).toBe('Answer');
    expect(fileItemKindLabel({ name: 'answer.md', kindLabel: '  ' }, 'ko')).toBe('마크다운');
    const el = mount({ id: 'a', name: 'final.md', kindLabel: '답변', size: 2_048 }, { lang: 'ko' });
    expect(q(el, 'button')!.getAttribute('aria-label')).toBe('final.md, 답변, 2 KB');
    const nameless = mount({ id: 'b', name: '', kind: 'markdown', kindLabel: XSS });
    expect(q(nameless, '.fc-name')!.textContent).toBe(XSS);
    expect(qa(nameless, 'img')).toHaveLength(0);
  });
});
