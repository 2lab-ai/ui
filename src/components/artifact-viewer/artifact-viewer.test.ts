import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import { DIALOG_EXIT_MS, type UiDialog } from '../dialog/dialog';
import type { FileItem } from '../file-card/render';
import type {
  ArtifactActionDetail,
  ArtifactCloseDetail,
  ArtifactClosedDetail,
  ArtifactOpenDetail,
  ArtifactViewDetail,
  ArtifactViewerData,
  UiArtifactViewer,
} from './artifact-viewer';
import {
  actionUrl,
  artifactItems,
  artifactLayout,
  extraActions,
  FIT_SIZE,
  MARKDOWN_VIEW_CHARS,
  MAX_EXTRA_ACTIONS,
  mediaSrc,
  PEEK_DELAY_MS,
  PEEK_GRACE_MS,
  PEEK_WARM_MS,
  peekHtml,
  stepIndex,
  textHead,
  viewerActions,
  viewerBodyHtml,
  viewerBodyKind,
  viewerFit,
  viewerStrings,
} from './logic';
import { peekCss, peekPageCss, styles } from './styles';
import './artifact-viewer';
import '../file-card/file-card';

const NOW = Date.UTC(2026, 9, 30, 12, 0, 0);
const MIN = 60_000;
const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const XSS = '<img src=x onerror=alert(1)>';
const BREAK = '"><b>x</b>';
const PAGE_XSS = '<script>alert(1)</script><img src=x onerror=alert(2)><h1>Hi</h1>';

/** Seven files, one of each body: image, markdown, html, code, audio, video, pdf (fallback). */
function files(): FileItem[] {
  return [
    {
      id: 'shot',
      name: 'checkout.png',
      size: 184_320,
      time: NOW - 2 * MIN,
      thumb: PNG,
      url: '/files/checkout.png',
      meta: 'from Build agent',
    },
    { id: 'notes', name: 'notes.md', size: 2_410, time: NOW - 4 * MIN, text: '# Notes\n\n- one\n- **two**' },
    { id: 'page', name: 'landing.html', size: 12_700, time: NOW - 6 * MIN, text: '<h1>Hi</h1>' },
    { id: 'code', name: 'retry.ts', size: 1_180, text: 'export const a = 1;\n', url: '/files/retry.ts' },
    { id: 'memo', name: 'memo.wav', size: 70_600, url: 'blob:https://app.example/1234' },
    { id: 'clip', name: 'demo.mp4', url: '/files/demo.mp4' },
    { id: 'bundle', name: 'bundle.zip', size: 318_464, url: '/files/bundle.zip', downloadName: 'Bundle Oct.zip' },
  ];
}

function mount(data: ArtifactViewerData | undefined, attrs: Record<string, string> = {}): UiArtifactViewer {
  const el = document.createElement('ui-artifact-viewer');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: Element, s: string) => el.shadowRoot!.querySelector<E>(s);
const qa = <E extends Element = HTMLElement>(el: Element, s: string) =>
  Array.from(el.shadowRoot!.querySelectorAll<E>(s));
const tiles = (el: UiArtifactViewer) => qa<HTMLButtonElement>(el, '.av-list .fc');
const dialog = (el: UiArtifactViewer) => q(el, 'ui-dialog') as unknown as UiDialog;
const native = (el: UiArtifactViewer) => dialog(el).shadowRoot!.querySelector<HTMLDialogElement>('dialog')!;
const navBtn = (el: UiArtifactViewer, k: 'prev' | 'next') => q<HTMLButtonElement>(el, `.av-nb[data-key="${k}"]`)!;
const key = (t: EventTarget, k: string, init: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...init });
  t.dispatchEvent(e);
  return e;
};
/** Listeners on document live until the test ends. */
let ac = new AbortController();

/** Click like a person; returns whether the component prevented the default (links never navigate the test page). */
function click(t: EventTarget): boolean {
  let prevented = false;
  const late = (e: Event) => {
    prevented = e.defaultPrevented;
    e.preventDefault();
  };
  document.addEventListener('click', late);
  t.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
  document.removeEventListener('click', late);
  return prevented;
}
const pointer = (t: EventTarget, type: string, pointerType = 'mouse', relatedTarget: EventTarget | null = null) =>
  t.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, pointerType, relatedTarget }));

function record<T>(el: EventTarget, name: string, cancel = false): Array<T & { cancelable: boolean }> {
  const out: Array<T & { cancelable: boolean }> = [];
  el.addEventListener(name, (e) => {
    const ev = e as CustomEvent<T>;
    out.push({ ...ev.detail, cancelable: ev.cancelable });
    if (cancel) ev.preventDefault();
  });
  return out;
}

beforeEach(() => {
  document.body.innerHTML = '';
  ac = new AbortController();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  ac.abort();
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('helpers', () => {
  it('artifactLayout keeps the five layouts and falls back to strip', () => {
    expect(['strip', 'grid', 'chips', 'list', 'none'].map(artifactLayout)).toEqual([
      'strip',
      'grid',
      'chips',
      'list',
      'none',
    ]);
    expect(artifactLayout(undefined)).toBe('strip');
    expect(artifactLayout('carousel')).toBe('strip');
    expect(artifactLayout(3)).toBe('strip');
  });

  it('stepIndex holds at the ends (no wrap) and is -1 for an empty list', () => {
    expect(stepIndex(0, 1, 3)).toBe(1);
    expect(stepIndex(2, 1, 3)).toBe(2);
    expect(stepIndex(0, -1, 3)).toBe(0);
    expect(stepIndex(1, -1, 3)).toBe(0);
    expect(stepIndex(1, 10, 3)).toBe(2);
    expect(stepIndex(0, 1, 0)).toBe(-1);
  });

  it('textHead keeps the first lines and normalises line ends', () => {
    expect(textHead('a\r\nb\rc\nd', 3)).toBe('a\nb\nc');
    expect(textHead(Array.from({ length: 40 }, (_, i) => `l${i}`).join('\n')).split('\n')).toHaveLength(24);
    expect(textHead(null)).toBe('');
    expect(textHead('x'.repeat(10_000)).length).toBe(4000);
  });

  it('artifactItems keeps objects with a string or number id', () => {
    const ok = { id: 'a', name: 'a.txt' };
    const num = { id: 7, name: 'b.txt' };
    expect(artifactItems([ok, null, 'x', { name: 'no-id' }, { id: {}, name: 'c' }, num])).toEqual([ok, num]);
    expect(artifactItems(undefined)).toEqual([]);
    expect(artifactItems({ length: 1 })).toEqual([]);
  });

  it('mediaSrc takes a safe url (else thumb for images) and rejects scripts and html', () => {
    expect(mediaSrc({ id: '1', name: 'a.png', url: '/a.png', thumb: PNG })).toBe('/a.png');
    expect(mediaSrc({ id: '1', name: 'a.png', url: 'javascript:alert(1)', thumb: PNG })).toBe(PNG);
    expect(mediaSrc({ id: '1', name: 'a.png', url: 'data:text/html,<script>alert(1)</script>' })).toBe('');
    expect(mediaSrc({ id: '1', name: 'a.wav', url: '  blob:https://app.example/1  ' })).toBe(
      'blob:https://app.example/1',
    );
    expect(mediaSrc({ id: '1', name: 'a.wav', thumb: PNG })).toBe('');
    expect(mediaSrc({ id: '1', name: 'a.mp4', url: 'javascript:alert(1)' })).toBe('');
  });

  it('actionUrl only passes safe app links', () => {
    expect(actionUrl({ id: '1', name: 'a.pdf', url: ' /files/a.pdf ' })).toBe('/files/a.pdf');
    expect(actionUrl({ id: '1', name: 'a.pdf', url: 'https://cdn.example/a.pdf' })).toBe('https://cdn.example/a.pdf');
    expect(actionUrl({ id: '1', name: 'a.pdf', url: 'javascript:alert(1)' })).toBe('');
    expect(actionUrl({ id: '1', name: 'a.html', url: 'data:text/html,<script>alert(1)</script>' })).toBe('');
    expect(actionUrl({ id: '1', name: 'a.pdf', url: '//evil.example/a.pdf' })).toBe('');
    expect(actionUrl({ id: '1', name: 'a.pdf' })).toBe('');
  });

  it('viewerActions follows the url and the two flags', () => {
    const it = { id: '1', name: 'a.pdf', url: '/a.pdf' };
    expect(viewerActions(it)).toEqual(['open', 'download']);
    expect(viewerActions(it, { download: false })).toEqual(['open']);
    expect(viewerActions(it, { openInTab: false })).toEqual(['download']);
    expect(viewerActions({ id: '1', name: 'a.pdf' })).toEqual([]);
    expect(viewerActions({ id: '1', name: 'a.pdf', url: 'javascript:alert(1)' })).toEqual([]);
  });

  it('a markdown document past MARKDOWN_VIEW_CHARS is shown as plain text, not marked up', () => {
    const big: FileItem = { id: 'big', name: 'big.md', text: `# t\n${'x'.repeat(MARKDOWN_VIEW_CHARS)}` };
    const small: FileItem = { id: 'small', name: 'small.md', text: '# t' };
    expect(viewerBodyKind(big)).toBe('text');
    expect(viewerBodyKind(small)).toBe('markdown');
  });

  it('viewerBodyKind picks the body from the kind and the content it carries', () => {
    const [shot, notes, page, code, memo, clip, bundle] = files();
    expect([shot, notes, page, code, memo, clip, bundle].map((x) => viewerBodyKind(x))).toEqual([
      'image',
      'markdown',
      'html',
      'text',
      'audio',
      'video',
      'fallback',
    ]);
    expect(viewerBodyKind({ id: '1', name: 'a.png' })).toBe('fallback');
    expect(viewerBodyKind(shot, new Set(['/files/checkout.png']))).toBe('fallback');
    expect(viewerBodyKind({ id: '1', name: 'a.md' })).toBe('fallback');
    expect(viewerBodyKind({ id: '1', name: 'a.html', url: '/a.html' })).toBe('html');
    expect(viewerBodyKind({ id: '1', name: 'a.html', url: 'javascript:alert(1)' })).toBe('fallback');
    expect(viewerBodyKind({ id: '1', name: 'a.log', text: 'line' })).toBe('text');
    expect(viewerBodyKind({ id: '1', name: 'a.log' })).toBe('fallback');
    expect(viewerBodyKind({ id: '1', name: 'blob', text: 'raw' })).toBe('text');
    // D4 G5-1: a PDF with a url the host vouches for (frame: true) is the browser's viewer; otherwise the card.
    expect(viewerBodyKind({ id: '1', name: 'invoice.pdf', url: '/files/invoice.pdf', frame: true })).toBe('pdf');
    expect(viewerBodyKind({ id: '1', name: 'invoice.pdf', url: '/files/invoice.pdf' })).toBe('fallback');
    expect(viewerBodyKind({ id: '1', name: 'invoice.pdf', url: 'https://elsewhere.example/x.pdf', frame: false })).toBe(
      'fallback',
    );
    expect(viewerBodyKind({ id: '1', name: 'invoice.pdf' })).toBe('fallback');
    expect(viewerBodyKind({ id: '1', name: 'invoice.pdf', url: 'javascript:alert(1)' })).toBe('fallback');
  });

  it('D4 G5-3: peekHtml reads a fetched head when text is not in hand; peekCss / peekPageCss ship the sheet', () => {
    const md = peekHtml({ id: '1', name: 'notes.md', head: '# Head\n\nfirst lines' }, 'en');
    expect(md).toContain('class="av-pk-doc md-doc"');
    expect(md).toContain('<h1>Head</h1>');
    const txt = peekHtml({ id: '2', name: 'run.log', head: 'line 1\nline 2' }, 'en', NOW);
    expect(txt).toContain('<pre class="av-pk-pre">line 1\nline 2</pre>');
    // text wins over head; neither: the glyph.
    expect(peekHtml({ id: '3', name: 'a.txt', text: 'T', head: 'H' }, 'en')).toContain('>T</pre>');
    expect(peekHtml({ id: '4', name: 'a.txt' }, 'en')).toContain('av-pk-glyph');
    expect(peekHtml({ id: '5', name: XSS, head: XSS }, 'en')).not.toContain('<img');
    expect(peekCss).toContain('[data-kind="markdown"]');
    expect(peekCss).toContain('.av-pk-media');
    expect(peekCss).toContain('var(--ib-card)');
    expect(peekPageCss).toContain('var(--ui-ib-card)');
    expect(peekPageCss).not.toMatch(/var\(--ib-/);
    expect(peekPageCss).toContain('var(--fc-wash)'); // the sheet's own custom properties stay
    expect(peekPageCss).toContain('var(--ui-mono)');
    expect(styles.split('.av-pk-media {').length).toBe(2); // once in the shadow sheet
  });

  it('viewerStrings: English unless ko', () => {
    expect(viewerStrings('en').pos(2, 7)).toBe('File 2 of 7');
    expect(viewerStrings(null).next).toBe('Next');
    expect(viewerStrings('ko').prev).toBe('이전');
    expect(viewerStrings('ko').pos(2, 7)).toBe('7개 중 2번째');
  });

  it('an HTML page lands only in an escaped srcdoc, never as markup', () => {
    const html = viewerBodyHtml(
      { id: '1', name: 'p.html', text: PAGE_XSS },
      { lang: 'en', now: NOW, broken: new Set(), zoomed: false, acts: [] },
    );
    expect(html).toContain('sandbox=""');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<h1');
    const peek = peekHtml({ id: '1', name: XSS, kind: 'html', text: PAGE_XSS }, 'en', NOW, new Set());
    expect(peek).not.toContain('<script');
    expect(peek).not.toContain('<img');
  });
});

describe('rendering', () => {
  it('strip: tiles in one row, a title with the count, the list named by it', () => {
    const el = mount({ items: files(), title: 'Files' });
    const list = q(el, '.av-list')!;
    expect(list.dataset.layout).toBe('strip');
    expect(list.getAttribute('role')).toBe('list');
    expect(list.getAttribute('aria-labelledby')).toBe('av-title');
    expect(list.hasAttribute('aria-label')).toBe(false);
    expect(q(el, '#av-title .av-title')?.textContent).toBe('Files');
    expect(q(el, '.av-count')?.textContent).toBe('7');
    expect(tiles(el)).toHaveLength(7);
    expect(tiles(el).every((b) => b.classList.contains('fc-tile'))).toBe(true);
    const first = tiles(el)[0];
    expect(first.dataset.i).toBe('0');
    expect(first.getAttribute('aria-haspopup')).toBe('dialog');
    expect(first.getAttribute('aria-label')).toBe('checkout.png, Image, 180 KB · 2m ago, from Build agent');
    expect(first.querySelector('img')?.getAttribute('src')).toBe(PNG);
  });

  it('grid → tiles, chips → chips, list → rows; an unknown layout is a strip', () => {
    const cases: Array<[ArtifactViewerData['layout'], string, string]> = [
      ['grid', 'grid', 'fc-tile'],
      ['chips', 'chips', 'fc-chip'],
      ['list', 'list', 'fc-row'],
      ['nope' as never, 'strip', 'fc-tile'],
    ];
    for (const [layout, shown, cls] of cases) {
      const el = mount({ items: files(), layout });
      expect(q(el, '.av-list')?.dataset.layout).toBe(shown);
      expect(tiles(el).every((b) => b.classList.contains(cls))).toBe(true);
      expect(tiles(el)).toHaveLength(7);
    }
  });

  it('without a title the list is named “Files” and no header is drawn', () => {
    const el = mount({ items: files().slice(0, 2) });
    expect(q(el, '.av-head')).toBeNull();
    expect(q(el, '.av-list')?.getAttribute('aria-label')).toBe('Files');
    expect(q(el, '.av-list')?.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('empty with a title says so; without a title (or data) nothing renders', () => {
    const el = mount({ items: [], title: 'Files' });
    expect(q(el, '.av-title')?.textContent).toBe('Files');
    expect(q(el, '.av-empty')?.textContent).toBe('No files yet');
    expect(q(el, '.av-list')).toBeNull();
    const bare = mount({ items: [] });
    expect(q(bare, '.ui-root')?.innerHTML).toBe('');
    const none = mount(undefined);
    expect(q(none, '.ui-root')?.innerHTML).toBe('');
    const junk = mount({ items: [{ name: 'no-id' } as unknown as FileItem], title: '  ' });
    expect(q(junk, '.ui-root')?.innerHTML).toBe('');
  });

  it('keeps tile nodes (and focus) across data updates', () => {
    const el = mount({ items: files() });
    const b = tiles(el)[1];
    b.focus();
    el.data = { items: [{ id: 'new', name: 'new.txt', text: 'x' }, ...files()] };
    el.renderNow();
    expect(tiles(el)[2]).toBe(b);
    expect(b.dataset.i).toBe('2');
    expect(el.shadowRoot!.activeElement).toBe(b);
  });

  it('escapes every user string: name, meta and title', () => {
    const el = mount({ items: [{ id: 'x', name: XSS, meta: BREAK, text: 'x' }], title: XSS });
    expect(qa(el, 'img')).toHaveLength(0);
    expect(q(el, 'b')).toBeNull();
    expect(q(el, '.av-title')?.textContent).toBe(XSS);
    expect(q(el, '.fc-name')?.textContent).toBe(XSS);
    expect(q(el, '.fc-sub')?.textContent).toBe(BREAK);
  });
});

describe('viewer', () => {
  it('a tile click sends a cancelable ui-open, then opens the viewer at it (ui-view)', () => {
    const el = mount({ items: files() });
    const opens = record<ArtifactOpenDetail>(el, 'ui-open');
    const views = record<ArtifactViewDetail>(el, 'ui-view');
    tiles(el)[1].click();
    expect(opens).toEqual([{ id: 'notes', index: 1, cancelable: true }]);
    expect(views).toEqual([{ id: 'notes', index: 1, cancelable: false }]);
    expect(el.index).toBe(1);
    expect(dialog(el).getAttribute('size')).toBe('xl');
    expect(dialog(el).open).toBe(true);
    expect(native(el).open).toBe(true);
    expect(q(el, '.av-vh .av-vname')?.textContent).toBe('notes.md');
    expect(q(el, '.av-vh .av-badge')?.textContent).toBe('Markdown');
    expect(q(el, '.av-vh')?.dataset.kind).toBe('markdown');
    expect(q(el, '.av-vmeta')?.textContent).toBe('2.4 KB · 4m ago');
    expect(q(el, '.av-stage')?.dataset.body).toBe('markdown');
  });

  it('D4 G5-4: ui-closed follows every close after the exit — the person’s reason, host for close() / an emptied list, removed when the element leaves', () => {
    const el = mount({ items: files() });
    const closed = record<ArtifactClosedDetail>(el, 'ui-closed');
    el.open(0);
    el.close();
    vi.advanceTimersByTime(DIALOG_EXIT_MS - 1);
    expect(closed).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(closed.map((c) => c.reason)).toEqual(['host']);
    expect(closed[0].cancelable).toBe(false);
    el.open(1);
    key(native(el), 'Escape');
    vi.advanceTimersByTime(DIALOG_EXIT_MS + 50);
    expect(closed.map((c) => c.reason)).toEqual(['host', 'escape']);
    // The person's close the host refuses: no close, no ui-closed.
    el.open(1);
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener('ui-close', stop);
    key(native(el), 'Escape');
    vi.advanceTimersByTime(DIALOG_EXIT_MS + 50);
    expect(el.index).toBe(1);
    expect(closed).toHaveLength(2);
    el.removeEventListener('ui-close', stop);
    // The list emptied under it.
    el.data = { items: [] };
    el.renderNow();
    vi.advanceTimersByTime(DIALOG_EXIT_MS + 50);
    expect(closed.map((c) => c.reason)).toEqual(['host', 'escape', 'host']);
    // Removed from the page while open: at once, no exit to wait for.
    el.data = { items: files() };
    el.renderNow();
    el.open(2);
    el.remove();
    expect(closed.map((c) => c.reason)).toEqual(['host', 'escape', 'host', 'removed']);
    vi.advanceTimersByTime(DIALOG_EXIT_MS + 50);
    expect(closed).toHaveLength(4);
    // The inner dialog's own ui-closed never leaks out as the viewer's.
    document.body.append(el);
    el.open(0);
    el.close();
    vi.advanceTimersByTime(DIALOG_EXIT_MS + 50);
    expect(closed).toHaveLength(5);
  });

  it('preventDefault() on ui-open keeps the viewer closed', () => {
    const el = mount({ items: files() });
    record(el, 'ui-open', true);
    const views = record(el, 'ui-view');
    tiles(el)[0].click();
    expect(el.index).toBe(-1);
    expect(dialog(el).open).toBe(false);
    expect(views).toEqual([]);
  });

  it('open() / next() / prev() / close() move the viewer and report ui-view (no ui-open, no ui-close)', () => {
    const el = mount({ items: files() });
    const opens = record(el, 'ui-open');
    const closes = record(el, 'ui-close');
    const views = record<ArtifactViewDetail>(el, 'ui-view');
    el.open(2);
    el.next();
    el.prev();
    el.prev();
    expect(views.map((v) => [v.id, v.index])).toEqual([
      ['page', 2],
      ['code', 3],
      ['page', 2],
      ['notes', 1],
    ]);
    expect(el.index).toBe(1);
    el.open(1); // already there: nothing to report
    expect(views).toHaveLength(4);
    el.close();
    expect(el.index).toBe(-1);
    expect(dialog(el).open).toBe(false);
    vi.advanceTimersByTime(DIALOG_EXIT_MS + 50);
    expect(native(el).open).toBe(false);
    expect(dialog(el).children).toHaveLength(0);
    expect(opens).toEqual([]);
    expect(closes).toEqual([]);
    el.open(99);
    el.open(-1);
    expect(el.index).toBe(-1);
  });

  it('holds at the ends (no wrap); the step buttons are disabled there', () => {
    const el = mount({ items: files() });
    const views = record(el, 'ui-view');
    el.open(0);
    expect(navBtn(el, 'prev').disabled).toBe(true);
    expect(navBtn(el, 'next').disabled).toBe(false);
    el.prev();
    expect(el.index).toBe(0);
    el.open(6);
    expect(navBtn(el, 'next').disabled).toBe(true);
    expect(navBtn(el, 'prev').disabled).toBe(false);
    el.next();
    click(navBtn(el, 'next'));
    expect(el.index).toBe(6);
    expect(views).toHaveLength(2);
    click(navBtn(el, 'prev'));
    expect(el.index).toBe(5);
  });

  it('the footer shows the position (visual and spoken) and the live region speaks steps only', () => {
    const el = mount({ items: files() });
    el.open(1);
    expect(q(el, '.av-pos [aria-hidden="true"]')?.textContent).toBe('2 / 7');
    expect(q(el, '.av-pos .sr-only')?.textContent).toBe('File 2 of 7');
    expect(navBtn(el, 'prev').getAttribute('aria-label')).toBe('Previous');
    expect(navBtn(el, 'next').getAttribute('aria-label')).toBe('Next');
    const live = q(el, '.av-live')!;
    expect(live.getAttribute('role')).toBe('status');
    expect(live.textContent).toBe('');
    el.next();
    expect(q(el, '.av-live')?.textContent).toBe('landing.html — 3 / 7');
  });

  it('a single file has no step controls', () => {
    const el = mount({ items: files().slice(0, 1) });
    el.open(0);
    expect(q(el, '.av-nav')).toBeNull();
    expect(q(el, '.av-vf .av-acts')).not.toBeNull(); // Zoom + Open + Download
  });

  it('← / → / Home / End page through inside the viewer', () => {
    const el = mount({ items: files() });
    el.open(2);
    const at = q(el, '.av-stage')!;
    expect(key(at, 'ArrowRight').defaultPrevented).toBe(true);
    expect(el.index).toBe(3);
    key(at, 'ArrowLeft');
    key(at, 'ArrowLeft');
    expect(el.index).toBe(1);
    key(at, 'End');
    expect(el.index).toBe(6);
    key(at, 'ArrowRight');
    expect(el.index).toBe(6);
    key(at, 'Home');
    expect(el.index).toBe(0);
    key(at, 'ArrowLeft');
    expect(el.index).toBe(0);
    // Keys from the dialog's own shadow tree (the panel holds focus on open) arrive retargeted to it.
    key(dialog(el).shadowRoot!.querySelector('.dg-panel')!, 'ArrowRight');
    expect(el.index).toBe(1);
  });

  it('modified keys, used keys and keys while closed are left alone', () => {
    const el = mount({ items: files() });
    expect(key(tiles(el)[0], 'ArrowRight').defaultPrevented).toBe(false);
    el.open(2);
    const at = q(el, '.av-stage')!;
    expect(key(at, 'ArrowRight', { altKey: true }).defaultPrevented).toBe(false);
    expect(key(at, 'End', { metaKey: true }).defaultPrevented).toBe(false);
    at.addEventListener('keydown', (e) => e.preventDefault(), { once: true });
    key(at, 'ArrowRight');
    expect(el.index).toBe(2);
  });

  it('arrow keys in a field of a host preview stay with the field', () => {
    const el = mount({ items: files() });
    const input = document.createElement('input');
    input.slot = 'preview';
    el.append(input);
    el.renderNow();
    el.open(2);
    expect(key(input, 'ArrowRight').defaultPrevented).toBe(false);
    expect(el.index).toBe(2);
  });

  it('the inner dialog’s close request becomes ours (cancelable): prevented keeps it open', () => {
    const el = mount({ items: files() });
    const outer: Array<{ reason: string; target: EventTarget | null }> = [];
    document.addEventListener(
      'ui-close',
      (e) => {
        outer.push({ reason: (e as CustomEvent<ArtifactCloseDetail>).detail.reason, target: e.target });
        e.preventDefault();
      },
      { signal: ac.signal },
    );
    el.open(1);
    dialog(el).shadowRoot!.querySelector<HTMLButtonElement>('.dg-close')!.click();
    expect(outer).toEqual([{ reason: 'close-button', target: el }]);
    expect(el.index).toBe(1);
    expect(dialog(el).open).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(native(el).open).toBe(true);
  });

  it('Esc closes: ui-close { reason: escape }, then focus goes back to the tile', () => {
    const el = mount({ items: files() });
    const closes = record<ArtifactCloseDetail>(el, 'ui-close');
    const tile = tiles(el)[3];
    tile.click();
    expect(el.shadowRoot!.activeElement).not.toBe(tile);
    key(q(el, '.av-stage')!, 'Escape');
    expect(closes).toEqual([{ reason: 'escape', cancelable: true }]);
    expect(el.index).toBe(-1);
    expect(dialog(el).open).toBe(false);
    vi.advanceTimersByTime(DIALOG_EXIT_MS + 50);
    expect(native(el).open).toBe(false);
    expect(el.shadowRoot!.activeElement).toBe(tile);
  });

  it('Open in new tab and Download are real links that send a cancelable ui-action', () => {
    const el = mount({ items: files() });
    el.open(3); // retry.ts: text body, actions in the footer
    const open = q<HTMLAnchorElement>(el, '.av-vf a.av-act[data-act="open"]')!;
    const dl = q<HTMLAnchorElement>(el, '.av-vf a.av-act[data-act="download"]')!;
    expect(open.getAttribute('href')).toBe('/files/retry.ts');
    expect(open.getAttribute('target')).toBe('_blank');
    expect(open.getAttribute('rel')).toBe('noopener noreferrer');
    expect(open.getAttribute('aria-label')).toBe('Open in new tab');
    expect(dl.getAttribute('download')).toBe('retry.ts');
    expect(dl.classList.contains('is-primary')).toBe(false);
    const seen = record<ArtifactActionDetail>(el, 'ui-action');
    expect(click(open)).toBe(false);
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener('ui-action', stop);
    expect(click(dl.querySelector('svg')!)).toBe(true);
    el.removeEventListener('ui-action', stop);
    expect(seen).toEqual([
      { action: 'open', id: 'code', url: '/files/retry.ts', cancelable: true },
      { action: 'download', id: 'code', url: '/files/retry.ts', cancelable: true },
    ]);
  });

  it('the fallback card carries an ink Download (with downloadName); the footer keeps only the steps', () => {
    const el = mount({ items: files() });
    el.open(6);
    expect(q(el, '.av-stage')?.dataset.body).toBe('fallback');
    expect(q(el, '.av-card .av-fname')?.textContent).toBe('bundle.zip');
    expect(q(el, '.av-card .av-fnote')?.textContent).toBe('No preview');
    const dl = q<HTMLAnchorElement>(el, '.av-card a.av-act[data-act="download"]')!;
    expect(dl.classList.contains('is-primary')).toBe(true);
    expect(dl.getAttribute('download')).toBe('Bundle Oct.zip');
    expect(q(el, '.av-vf .av-act')).toBeNull();
  });

  it('download: false and openInTab: false drop the actions; an unsafe url never becomes a link', () => {
    const el = mount({ items: files(), download: false });
    el.open(3);
    expect(qa(el, 'a.av-act').map((a) => a.dataset.act)).toEqual(['open']);
    el.data = { items: files(), openInTab: false, download: false };
    el.renderNow();
    expect(qa(el, 'a.av-act')).toHaveLength(0);
    const bad = mount({ items: [{ id: 'x', name: 'x.pdf', url: 'javascript:alert(1)' }] });
    bad.open(0);
    expect(qa(bad, 'a')).toHaveLength(0);
    expect(q(bad, '.av-fallback')).not.toBeNull();
  });

  it('host-controlled data.index opens, moves and closes the viewer once per assignment', () => {
    const el = mount({ items: files(), index: 3 });
    expect(el.index).toBe(3);
    expect(dialog(el).open).toBe(true);
    const views = record<ArtifactViewDetail>(el, 'ui-view');
    el.next();
    el.data = { items: files(), title: 'Files' }; // no index: left as the person left it
    el.renderNow();
    expect(el.index).toBe(4);
    el.data = { items: files(), index: 1.7 };
    el.renderNow();
    expect(el.index).toBe(1);
    el.data = { items: files(), index: 42 }; // out of range: ignored
    el.renderNow();
    expect(el.index).toBe(1);
    el.data = { items: files(), index: -1 };
    el.renderNow();
    expect(el.index).toBe(-1);
    expect(dialog(el).open).toBe(false);
    expect(views.map((v) => v.index)).toEqual([4, 1]);
  });

  it('when items shrink the shown index clamps; with none left the viewer closes', () => {
    const el = mount({ items: files() });
    el.open(6);
    const views = record<ArtifactViewDetail>(el, 'ui-view');
    el.data = { items: files().slice(0, 3) };
    el.renderNow();
    expect(el.index).toBe(2);
    expect(views).toEqual([{ id: 'page', index: 2, cancelable: false }]);
    expect(q(el, '.av-vname')?.textContent).toBe('landing.html');
    expect(q(el, '.av-pos [aria-hidden="true"]')?.textContent).toBe('3 / 3');
    expect(navBtn(el, 'next').disabled).toBe(true);
    el.data = { items: [] };
    el.renderNow();
    expect(el.index).toBe(-1);
    expect(dialog(el).open).toBe(false);
  });

  it('a file that arrives before the shown one does not swap it out', () => {
    const el = mount({ items: files() });
    el.open(1);
    const views = record<ArtifactViewDetail>(el, 'ui-view');
    el.data = { items: [{ id: 'fresh', name: 'fresh.txt', text: 'new' }, ...files()] };
    el.renderNow();
    expect(el.index).toBe(2);
    expect(q(el, '.av-vname')?.textContent).toBe('notes.md');
    expect(views).toEqual([{ id: 'notes', index: 2, cancelable: false }]);
  });

  it('image body: Zoom (aria-pressed) and a click on the picture toggle 1:1; a step resets it', () => {
    const el = mount({ items: files() });
    el.open(0);
    const img = q<HTMLImageElement>(el, '.av-img .av-pic')!;
    expect(img.getAttribute('src')).toBe('/files/checkout.png');
    expect(img.getAttribute('alt')).toBe('checkout.png');
    const zoom = q<HTMLButtonElement>(el, '.av-tg')!;
    expect(zoom.getAttribute('aria-pressed')).toBe('false');
    zoom.click();
    expect(q(el, '.av-tg')?.getAttribute('aria-pressed')).toBe('true');
    expect(q(el, '.av-img')?.classList.contains('is-zoomed')).toBe(true);
    // Zoomed, the arrows scroll the picture instead of stepping.
    expect(key(q(el, '.av-stage')!, 'ArrowRight').defaultPrevented).toBe(false);
    expect(el.index).toBe(0);
    click(q(el, '.av-pic')!);
    expect(q(el, '.av-tg')?.getAttribute('aria-pressed')).toBe('false');
    q<HTMLButtonElement>(el, '.av-tg')!.click();
    el.next();
    el.prev();
    expect(q(el, '.av-tg')?.getAttribute('aria-pressed')).toBe('false');
    expect(q(el, '.av-img')?.classList.contains('is-zoomed')).toBe(false);
    el.next();
    expect(q(el, '.av-tg')).toBeNull();
  });

  it('draws each body: markdown, text, a sandboxed page, audio, video', () => {
    const el = mount({ items: files() });
    el.open(1);
    expect(q(el, '.av-doc .md-doc h1')?.textContent).toBe('Notes');
    expect(q(el, '.av-doc .md-doc strong')?.textContent).toBe('two');
    el.next();
    const frame = q<HTMLIFrameElement>(el, '.av-html iframe.av-frame')!;
    expect(frame.getAttribute('sandbox')).toBe('');
    expect(frame.getAttribute('srcdoc')).toBe('<h1>Hi</h1>');
    expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(frame.getAttribute('title')).toBe('landing.html');
    expect(q(el, '.av-note')?.textContent).toBe('Scripts are off');
    expect(q(el, 'h1')).toBeNull();
    el.next();
    expect(q(el, '.av-text pre code')?.textContent).toBe('export const a = 1;\n');
    el.next();
    expect(q(el, '.av-audio audio')?.getAttribute('src')).toBe('blob:https://app.example/1234');
    expect(q(el, '.av-audio .av-fname')?.textContent).toBe('memo.wav');
    el.next();
    expect(q(el, '.av-vid video')?.getAttribute('src')).toBe('/files/demo.mp4');
  });

  it('D4 G5-2: ui-before-view comes before the body renders — a slot put in then is the first body; ui-view follows', () => {
    const el = mount({ items: files() });
    const order: string[] = [];
    const preview = document.createElement('div');
    preview.slot = 'preview';
    let framesEverMade = 0;
    const mo = new MutationObserver((muts) => {
      for (const m of muts)
        for (const n of Array.from(m.addedNodes))
          if (n.nodeType === 1 && ((n as Element).matches('iframe') || (n as Element).querySelector('iframe')))
            framesEverMade++;
    });
    mo.observe(el.shadowRoot as ShadowRoot, { childList: true, subtree: true });
    el.addEventListener('ui-before-view', (e) => {
      const { id, index } = (e as CustomEvent<ArtifactViewDetail>).detail;
      order.push(`before:${id}:${index}`);
      preview.textContent = `host body for ${id}`;
      if (!preview.isConnected) el.append(preview);
    });
    el.addEventListener('ui-view', (e) => order.push(`view:${(e as CustomEvent<ArtifactViewDetail>).detail.id}`));
    el.open(1); // notes.md
    expect(order).toEqual(['before:notes:1', 'view:notes']);
    expect(q(el, '.av-stage')?.dataset.body).toBe('host');
    el.next(); // landing.html — would be a sandboxed frame without the hook
    expect(order.slice(2)).toEqual(['before:page:2', 'view:page']);
    expect(q(el, '.av-stage')?.dataset.body).toBe('host');
    expect(preview.textContent).toBe('host body for page');
    // New data moves the shown file: the hook fires again before the body.
    el.data = { items: [{ id: 'new', name: 'first.txt', text: 'x' }, ...files()] };
    el.renderNow();
    expect(order.slice(4)).toEqual(['before:page:3', 'view:page']);
    expect(framesEverMade).toBe(0);
    mo.disconnect();
  });

  it('D4 G5-1: a PDF is framed as is (the browser’s viewer, no sandbox); a page with scripts: true runs them in the viewer and the peek', () => {
    const el = mount({
      items: [
        { id: 'inv', name: 'invoice.pdf', url: '/files/invoice.pdf', downloadName: 'Invoice Oct.pdf', frame: true },
        { id: 'chart', name: 'chart.html', text: '<h1>Hi</h1><script>draw()</script>', scripts: true },
        { id: 'page', name: 'landing.html', text: '<h1>Hi</h1>' },
        { id: 'nourl', name: 'scan.pdf' },
      ],
    });
    el.open(0);
    expect(q(el, '.av-stage')?.dataset.body).toBe('pdf');
    const pdf = q<HTMLIFrameElement>(el, '.av-pdf iframe.av-frame')!;
    expect(pdf.getAttribute('src')).toBe('/files/invoice.pdf');
    expect(pdf.hasAttribute('sandbox')).toBe(false);
    expect(pdf.getAttribute('title')).toBe('invoice.pdf');
    expect(q(el, '.av-note')).toBeNull();
    // The footer keeps Open / Download for it (the body is not the fallback card).
    expect(qa(el, '.av-vf .av-act').map((a) => (a as HTMLElement).dataset.act)).toEqual(['open', 'download']);
    el.next();
    expect(q(el, '.av-stage')?.dataset.body).toBe('html');
    const frame = q<HTMLIFrameElement>(el, '.av-html iframe.av-frame')!;
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame.getAttribute('srcdoc')).toBe('<h1>Hi</h1><script>draw()</script>');
    expect(q(el, '.av-note')?.textContent).toBe('Runs its own scripts');
    expect(qa(el, 'script')).toHaveLength(0);
    el.next();
    expect(q<HTMLIFrameElement>(el, '.av-html iframe.av-frame')?.getAttribute('sandbox')).toBe('');
    expect(q(el, '.av-note')?.textContent).toBe('Scripts are off');
    el.next();
    expect(q(el, '.av-stage')?.dataset.body).toBe('fallback');
    expect(q(el, '.av-card .av-fname')?.textContent).toBe('scan.pdf');
    el.close();
    const ko = mount(
      { items: [{ id: 'chart', name: 'chart.html', text: '<h1>Hi</h1>', scripts: true }] },
      { lang: 'ko' },
    );
    ko.open(0);
    expect(q(ko, '.av-note')?.textContent).toBe('스크립트 켜짐');
  });

  it('escapes names and text in every body; an HTML page is only an attribute', () => {
    const el = mount({
      items: [
        { id: 'a', name: XSS, kind: 'markdown', text: `# ${XSS}\n\n${BREAK}` },
        { id: 'b', name: BREAK, kind: 'text', text: `${XSS}\n<script>alert(1)</script>`, meta: XSS },
        { id: 'c', name: 'page.html', text: PAGE_XSS },
        { id: 'd', name: XSS, kind: 'pdf', meta: BREAK },
      ],
    });
    const noInjection = () => {
      expect(qa(el, 'img[onerror]')).toHaveLength(0);
      expect(qa(el, 'img')).toHaveLength(0);
      expect(qa(el, 'script')).toHaveLength(0);
      expect(qa(el, 'b')).toHaveLength(0);
    };
    el.open(0);
    noInjection();
    expect(q(el, '.av-vname')?.textContent).toBe(XSS);
    expect(q(el, '.md-doc h1')?.textContent).toBe(XSS);
    el.next();
    noInjection();
    expect(q(el, '.av-vname')?.textContent).toBe(BREAK);
    expect(q(el, '.av-vmeta')?.textContent).toBe(XSS);
    expect(q(el, '.av-pre code')?.textContent).toBe(`${XSS}\n<script>alert(1)</script>`);
    el.next();
    noInjection();
    expect(q(el, 'iframe')?.getAttribute('srcdoc')).toBe(PAGE_XSS);
    expect(q(el, 'h1')).toBeNull();
    el.next();
    noInjection();
    expect(q(el, '.av-fname')?.textContent).toBe(XSS);
    expect(qa(el, '.av-fmeta').map((x) => x.textContent)).toContain(BREAK);
  });

  it('a broken image falls back to the calm card', async () => {
    const el = mount({ items: [{ id: 'a', name: 'gone.png', url: '/missing.png' }] });
    el.open(0);
    q(el, '.av-pic')!.dispatchEvent(new Event('error'));
    await Promise.resolve();
    el.renderNow();
    expect(q(el, '.av-stage')?.dataset.body).toBe('fallback');
    expect(q(el, '.av-pic')).toBeNull();
    expect(q(el, '.av-tg')).toBeNull();
  });

  it('a slotted preview replaces the built-in body', () => {
    const el = mount({ items: files() });
    const host = document.createElement('div');
    host.slot = 'preview';
    host.textContent = 'Host preview';
    el.append(host);
    el.open(1);
    expect(q(el, '.av-stage')?.dataset.body).toBe('host');
    expect(q(el, '.av-stage slot[name="preview"]')?.children).toHaveLength(0);
    expect(q(el, '.av-doc')).toBeNull();
    expect(q(el, '.av-vf a.av-act')).toBeNull(); // notes.md has no url
  });

  it('the dialog carries lang and theme; removal closes the viewer for good', () => {
    const el = mount({ items: files() }, { theme: 'dark' });
    expect(dialog(el).getAttribute('theme')).toBe('dark');
    expect(dialog(el).getAttribute('lang')).toBe('en');
    el.open(2);
    el.remove();
    expect(el.index).toBe(-1);
    document.body.append(el);
    el.renderNow();
    expect(el.index).toBe(-1);
    expect(dialog(el).open).toBe(false);
    expect(native(el).open).toBe(false);
  });
});

describe('extra actions (D2 G4-2)', () => {
  const slack = {
    id: 'slack',
    label: 'Slack',
    icon: 'external' as const,
    href: 'https://slack.example.invalid/files/1',
  };

  it('extraActions keeps drawable ones: id + label, no built-in ids, first of each id, safe hrefs only, capped', () => {
    const item: FileItem = {
      id: 'f',
      name: 'f.txt',
      actions: [
        slack,
        { id: 'open', label: 'Mine' },
        { id: 'download', label: 'Mine' },
        { id: 'slack', label: 'Again' },
        { id: '', label: 'No id' },
        { id: 'blank', label: '  ' },
        { id: 'js', label: 'Run', href: 'javascript:alert(1)' },
        null as unknown as { id: string; label: string },
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
    };
    const out = extraActions(item);
    expect(out.map((a) => a.id)).toEqual(['slack', 'js', 'a', 'b']);
    expect(out).toHaveLength(MAX_EXTRA_ACTIONS);
    expect(out[0]).toEqual(slack);
    expect('href' in out[1]).toBe(false);
    expect(extraActions({ id: 'x', name: 'x', actions: 'nope' as unknown as [] })).toEqual([]);
    expect(extraActions(undefined)).toEqual([]);
  });

  it('draws after Open / Download in the footer: a link (new tab) with href, else a button; names escaped', () => {
    const items = files();
    items[3] = { ...items[3], actions: [slack, { id: BREAK, label: XSS }] };
    const el = mount({ items });
    el.open(3);
    const acts = qa<HTMLElement>(el, '.av-vf .av-act');
    expect(acts.map((a) => a.dataset.act ?? a.dataset.x)).toEqual(['open', 'download', 'slack', BREAK]);
    const [, , link, btn] = acts;
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('https://slack.example.invalid/files/1');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('aria-label')).toBe('Slack');
    expect(link.querySelector('svg')).not.toBeNull();
    expect(link.classList.contains('is-text')).toBe(false);
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('type')).toBe('button');
    expect(btn.classList.contains('is-text')).toBe(true);
    expect(btn.querySelector('.av-act-t')!.textContent).toBe(XSS);
    expect(q(el, '.av-vf img')).toBeNull();
    expect(q(el, '.av-vf b')).toBeNull();
  });

  it('a press sends a cancelable ui-action with the action id, the file id, the link and extra: true', () => {
    const items = files();
    items[3] = { ...items[3], actions: [slack, { id: 'copy', label: 'Copy', icon: 'copy' }] };
    const el = mount({ items });
    el.open(3);
    const seen = record<ArtifactActionDetail>(el, 'ui-action');
    const link = q(el, '.av-act[data-x="slack"]')!;
    expect(click(link.querySelector('svg')!)).toBe(false);
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener('ui-action', stop);
    expect(click(link)).toBe(true);
    click(q(el, '.av-act[data-x="copy"]')!);
    el.removeEventListener('ui-action', stop);
    expect(seen).toEqual([
      { action: 'slack', id: 'code', url: 'https://slack.example.invalid/files/1', extra: true, cancelable: true },
      { action: 'slack', id: 'code', url: 'https://slack.example.invalid/files/1', extra: true, cancelable: true },
      { action: 'copy', id: 'code', url: '', extra: true, cancelable: true },
    ]);
    // The viewer stays open on its own actions.
    expect(dialog(el).open).toBe(true);
  });

  it('a file only Slack has (no url): its card leads with the first extra action in ink; the footer has no actions', () => {
    const el = mount({
      items: [{ id: 'call', name: 'call.m4a', mime: 'audio/mp4', actions: [slack, { id: 'copy', label: 'Copy' }] }],
    });
    el.open(0);
    expect(q(el, '.av-stage')?.dataset.body).toBe('fallback');
    const acts = qa<HTMLElement>(el, '.av-card .av-act');
    expect(acts.map((a) => a.dataset.x)).toEqual(['slack', 'copy']);
    expect(acts[0].classList.contains('is-primary')).toBe(true);
    expect(acts[1].classList.contains('is-primary')).toBe(false);
    expect(q(el, '.av-vf .av-act')).toBeNull();
    // With its own Download the card keeps Download in ink and the extra beside it.
    el.open([{ ...files()[6], actions: [slack] }], 0);
    const card = qa<HTMLElement>(el, '.av-card .av-act');
    expect(card.map((a) => a.dataset.act ?? a.dataset.x)).toEqual(['open', 'download', 'slack']);
    expect(card.filter((a) => a.classList.contains('is-primary')).map((a) => a.dataset.act)).toEqual(['download']);
  });

  it('download: false / openInTab: false leave the extra actions in place', () => {
    const items = files();
    items[3] = { ...items[3], actions: [slack] };
    const el = mount({ items, download: false, openInTab: false });
    el.open(3);
    expect(qa<HTMLElement>(el, '.av-vf .av-act').map((a) => a.dataset.x)).toEqual(['slack']);
  });

  it('phones keep the words of an action without a glyph', () => {
    expect(styles).toMatch(/\.av-vf \.av-act\.is-text \{ width: auto;/);
    expect(styles).toMatch(/\.av-vf \.av-act\.is-text \.av-act-t \{ display: inline; \}/);
  });
});

describe('the card’s own words and focus (D2 G4-5)', () => {
  it('kindLabel names the badge, the peek and the tile', () => {
    const items: FileItem[] = [{ id: 'ans', name: 'final.md', kindLabel: '답변', text: '# Done', size: 2_048 }];
    const el = mount({ items }, { lang: 'ko' });
    expect(tiles(el)[0].getAttribute('aria-label')).toBe('final.md, 답변, 2 KB');
    expect(peekHtml(items[0], 'ko', NOW, new Set())).toContain('답변 · 2 KB');
    el.open(0);
    expect(q(el, '.av-badge')!.textContent).toBe('답변');
  });

  it('a <ui-file-card> opener takes focus back to its button', () => {
    const card = document.createElement('ui-file-card');
    card.data = { id: 'a', name: 'a.md', text: '# a' };
    document.body.append(card);
    card.renderNow();
    const el = mount({ items: [] }, { tiles: 'none' });
    el.open([card.data], 0, card);
    expect(dialog(el).open).toBe(true);
    key(q(el, '.av-stage')!, 'Escape');
    vi.advanceTimersByTime(DIALOG_EXIT_MS + 50);
    expect(document.activeElement).toBe(card);
    expect(card.shadowRoot!.activeElement).toBe(card.shadowRoot!.querySelector('button.fc'));
  });
});

describe('dialog only (D2 G4-1)', () => {
  /** The host's own tiles: plain buttons in the page. */
  function hostTiles(n: number): HTMLButtonElement[] {
    return Array.from({ length: n }, (_, i) => {
      const b = document.createElement('button');
      b.textContent = `tile ${i}`;
      document.body.append(b);
      return b;
    });
  }

  it('layout none / tiles="none" draws no tiles, no title and no empty line', () => {
    for (const el of [
      mount({ items: files(), layout: 'none', title: 'Files' }),
      mount({ items: files(), title: 'Files' }, { tiles: 'none' }),
      mount({ items: [], layout: 'none', title: 'Files' }),
    ]) {
      expect(q(el, '.ui-root')!.innerHTML).toBe('');
      expect(q(el, 'ui-dialog')).not.toBeNull();
    }
  });

  it('open(items, index, opener) pages through the host list with steps, badge and actions; focus returns to the opener', () => {
    const el = mount({ items: [], layout: 'none' }, { lang: 'ko' });
    const [a, b] = hostTiles(2);
    b.focus();
    const views = record<ArtifactViewDetail>(el, 'ui-view');
    const opens = record(el, 'ui-open');
    el.open(files(), 3, a);
    // Focus moved into the dialog (the viewer's shadow), not left on the tile pressed last.
    expect(document.activeElement).toBe(el);
    expect(dialog(el).open).toBe(true);
    expect(el.index).toBe(3);
    expect(el.data?.items).toHaveLength(7);
    expect(q(el, '.av-pos [aria-hidden]')!.textContent).toBe('4 / 7');
    expect(q(el, '.av-badge')!.textContent).toBe('코드');
    expect(q(el, '.av-vf a.av-act[data-act="download"]')).not.toBeNull();
    navBtn(el, 'next').click();
    expect(el.index).toBe(4);
    expect(views.map((v) => v.id)).toEqual(['code', 'memo']);
    expect(opens).toEqual([]);
    key(q(el, '.av-stage')!, 'Escape');
    vi.advanceTimersByTime(DIALOG_EXIT_MS + 50);
    expect(dialog(el).open).toBe(false);
    expect(document.activeElement).toBe(a);
    expect(q(el, '.ui-root')!.innerHTML).toBe('');
  });

  it('a new list while open replaces the shown file even at the same index; an old data.index never reopens', () => {
    const el = mount({ items: files(), layout: 'none', index: 0 });
    expect(el.index).toBe(0);
    const views = record<ArtifactViewDetail>(el, 'ui-view');
    const other: FileItem[] = [
      { id: 'x', name: 'x.md', text: '# x' },
      { id: 'y', name: 'y.txt', text: 'y' },
    ];
    el.open(other, 0);
    expect(views.map((v) => v.id)).toEqual(['x']);
    expect(q(el, '.av-vname')!.textContent).toBe('x.md');
    el.renderNow();
    expect(el.index).toBe(0);
    expect(views).toHaveLength(1);
    expect('index' in (el.data ?? {})).toBe(false);
    el.close();
    el.renderNow();
    expect(el.index).toBe(-1);
    // open(index) still opens over the current list.
    el.open(1);
    expect(q(el, '.av-vname')!.textContent).toBe('y.txt');
  });

  it('open(items) on a strip viewer swaps its tiles to the list', () => {
    const el = mount({ items: files().slice(0, 2), title: 'Files' });
    el.open(files(), 6);
    el.renderNow();
    expect(tiles(el)).toHaveLength(7);
    expect(el.index).toBe(6);
  });
});

describe('peek', () => {
  it('opens after PEEK_DELAY_MS of mouse hover, then closes after the grace once the pointer leaves', () => {
    const el = mount({ items: files() });
    const peek = q(el, '.av-peek')!;
    expect(peek.getAttribute('aria-hidden')).toBe('true');
    pointer(tiles(el)[1].querySelector('.fc-name')!, 'pointerover');
    vi.advanceTimersByTime(PEEK_DELAY_MS - 1);
    expect(peek.classList.contains('is-open')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(peek.classList.contains('is-open')).toBe(true);
    expect(peek.dataset.kind).toBe('markdown');
    expect(peek.querySelector('.av-pk-name')?.textContent).toBe('notes.md');
    expect(peek.querySelector('.av-pk-meta')?.textContent).toBe('Markdown · 2.4 KB · 4m ago');
    expect(peek.querySelector('.av-pk-doc h1')?.textContent).toBe('Notes');
    // Moving to another tile swaps it quickly.
    pointer(tiles(el)[3], 'pointerover');
    vi.advanceTimersByTime(PEEK_WARM_MS);
    expect(peek.querySelector('.av-pk-name')?.textContent).toBe('retry.ts');
    expect(peek.querySelector('.av-pk-pre')?.textContent).toBe('export const a = 1;\n');
    pointer(tiles(el)[3], 'pointerout', 'mouse', document.body);
    vi.advanceTimersByTime(PEEK_GRACE_MS - 1);
    expect(peek.classList.contains('is-open')).toBe(true);
    vi.advanceTimersByTime(1);
    expect(peek.classList.contains('is-open')).toBe(false);
  });

  it('touch does nothing; peek: false turns it off; leaving before the delay cancels it', () => {
    const el = mount({ items: files() });
    const peek = q(el, '.av-peek')!;
    pointer(tiles(el)[0], 'pointerover', 'touch');
    vi.advanceTimersByTime(PEEK_DELAY_MS * 2);
    expect(peek.classList.contains('is-open')).toBe(false);
    pointer(tiles(el)[0], 'pointerover');
    pointer(tiles(el)[0], 'pointerout', 'mouse', document.body);
    vi.advanceTimersByTime(PEEK_DELAY_MS * 2);
    expect(peek.classList.contains('is-open')).toBe(false);
    const off = mount({ items: files(), peek: false });
    pointer(tiles(off)[0], 'pointerover');
    vi.advanceTimersByTime(PEEK_DELAY_MS * 2);
    expect(q(off, '.av-peek')?.classList.contains('is-open')).toBe(false);
  });

  it('Esc dismisses it; a click on it opens the viewer at that file (ui-open)', () => {
    const el = mount({ items: files() });
    const peek = q(el, '.av-peek')!;
    pointer(tiles(el)[0], 'pointerover');
    vi.advanceTimersByTime(PEEK_DELAY_MS);
    expect(peek.querySelector('.av-pk-img')?.getAttribute('src')).toBe('/files/checkout.png');
    key(document.body, 'Escape');
    expect(peek.classList.contains('is-open')).toBe(false);
    pointer(tiles(el)[4], 'pointerover');
    vi.advanceTimersByTime(PEEK_DELAY_MS);
    expect(peek.classList.contains('is-open')).toBe(true);
    const opens = record<ArtifactOpenDetail>(el, 'ui-open');
    click(peek.querySelector('.av-pk-foot')!);
    expect(opens).toEqual([{ id: 'memo', index: 4, cancelable: true }]);
    expect(el.index).toBe(4);
    expect(peek.classList.contains('is-open')).toBe(false);
    // No peek while the viewer is open.
    pointer(tiles(el)[2], 'pointerover');
    vi.advanceTimersByTime(PEEK_DELAY_MS * 2);
    expect(peek.classList.contains('is-open')).toBe(false);
  });

  it('escapes the name in the peek', () => {
    const el = mount({ items: [{ id: 'x', name: XSS, kind: 'html', text: PAGE_XSS }] });
    pointer(tiles(el)[0], 'pointerover');
    vi.advanceTimersByTime(PEEK_DELAY_MS);
    const peek = q(el, '.av-peek')!;
    expect(peek.querySelector('.av-pk-name')?.textContent).toBe(XSS);
    expect(peek.querySelector('iframe')?.getAttribute('srcdoc')).toBe(PAGE_XSS);
    expect(peek.querySelector('iframe')?.getAttribute('sandbox')).toBe('');
    expect(qa(el, 'img, script')).toHaveLength(0);
  });

  it('D4 G5-3: the element’s own peek reads a fetched head too', () => {
    const el = mount({ items: [{ id: 'x', name: 'notes.md', head: '# Only the head' }] });
    pointer(tiles(el)[0], 'pointerover');
    vi.advanceTimersByTime(PEEK_DELAY_MS);
    expect(q(el, '.av-peek .av-pk-doc h1')?.textContent).toBe('Only the head');
    expect(q(el, '.av-peek')?.getAttribute('data-kind')).toBe('markdown');
  });

  it('D4 G5-1: a page with scripts: true runs them in the peek too (sandbox="allow-scripts"), never same-origin', () => {
    const el = mount({ items: [{ id: 'x', name: 'chart.html', text: '<h1>Hi</h1>', scripts: true }] });
    pointer(tiles(el)[0], 'pointerover');
    vi.advanceTimersByTime(PEEK_DELAY_MS);
    const frame = q(el, '.av-peek')!.querySelector('iframe')!;
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame.getAttribute('srcdoc')).toBe('<h1>Hi</h1>');
  });
});

describe('lang="ko"', () => {
  it('speaks Korean: empty text, list name, steps, position, actions, kind badge, dialog', () => {
    const empty = mount({ items: [], title: '파일' }, { lang: 'ko' });
    expect(q(empty, '.av-empty')?.textContent).toBe('아직 파일이 없어요');
    const el = mount({ items: files() }, { lang: 'ko' });
    expect(q(el, '.av-list')?.getAttribute('aria-label')).toBe('파일');
    expect(tiles(el)[0].getAttribute('aria-label')).toBe('checkout.png, 이미지, 180 KB · 2분 전, from Build agent');
    el.open(0);
    expect(navBtn(el, 'prev').getAttribute('aria-label')).toBe('이전');
    expect(navBtn(el, 'next').getAttribute('aria-label')).toBe('다음');
    expect(q(el, '.av-pos .sr-only')?.textContent).toBe('7개 중 1번째');
    expect(q(el, '.av-badge')?.textContent).toBe('이미지');
    expect(q(el, '.av-tg')?.textContent).toBe('확대');
    expect(qa(el, '.av-vf a.av-act').map((a) => a.getAttribute('aria-label'))).toEqual(['새 탭에서 열기', '다운로드']);
    expect(dialog(el).getAttribute('lang')).toBe('ko');
    expect(dialog(el).shadowRoot!.querySelector('.dg-close')?.getAttribute('aria-label')).toBe('닫기');
    el.open(2);
    expect(q(el, '.av-note')?.textContent).toBe('스크립트 꺼짐');
    el.open(6);
    expect(q(el, '.av-fnote')?.textContent).toBe('미리보기 없음');
    expect(q(el, '.av-vmeta')?.textContent).toBe('311 KB');
  });

  it('switching lang re-renders in place', () => {
    const el = mount({ items: files() });
    el.open(1);
    el.setAttribute('lang', 'ko');
    el.renderNow();
    expect(q(el, '.av-pos .sr-only')?.textContent).toBe('7개 중 2번째');
    expect(q(el, '.av-badge')?.textContent).toBe('마크다운');
    expect(q(el, '.av-vmeta')?.textContent).toBe('2.4 KB · 4분 전');
  });
});

describe('styles', () => {
  it('tokens only: no colour literals; hover changes colour, never position; ink primary', () => {
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    const hover = styles.match(/@media \(hover: hover\) and \(pointer: fine\) \{[\s\S]*?\n\}/g) ?? [];
    expect(hover.length).toBeGreaterThan(0);
    for (const block of hover) expect(block).not.toMatch(/transform|translate|scale/);
    expect(styles).toMatch(/\.av-act\.is-primary \{[^}]*background: var\(--ib-text\); color: var\(--ib-card\);/);
    expect(styles).toContain('outline: 2px solid var(--border-focus)');
    expect(styles).toMatch(/@media \(pointer: coarse\) \{[\s\S]*?\.av-nb \{ width: 44px; height: 44px; \}/);
    expect(styles).toMatch(
      /prefers-reduced-motion: reduce\) \{[\s\S]*?\.av-peek[^{]*\{ transform: none !important; \}/,
    );
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    vi.useRealTimers(); // settle() waits real time
    spy = soundSpy();
    // Links never navigate the test page.
    document.addEventListener('click', (e) => e.preventDefault(), { signal: ac.signal });
  });
  afterEach(() => {
    spy.restore();
    Reflect.deleteProperty(navigator, 'userActivation');
  });
  const tap = (t: Element, detail = 1) =>
    t.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail }));
  /** Outside a click or key press (a timer, a stream): the inner dialog keeps the host's show() / hide() quiet. */
  const idle = () =>
    Object.defineProperty(navigator, 'userActivation', { configurable: true, get: () => ({ isActive: false }) });
  const nav = (direction: string, input: string) => ['navigate', { emphasis: 'subtle', direction, input }];

  it('a tile opens the viewer once; steps and ← / → / Home navigate with direction; Esc closes', async () => {
    const el = mount({ items: files() });
    tap(tiles(el)[1]);
    await spy.settle();
    tap(navBtn(el, 'next'));
    await spy.settle();
    key(q(el, '.av-stage')!, 'ArrowLeft');
    await spy.settle();
    key(q(el, '.av-stage')!, 'Home');
    await spy.settle();
    key(q(el, '.av-stage')!, 'Home'); // already there: nothing moved
    await spy.settle();
    key(q(el, '.av-stage')!, 'Escape');
    await spy.settle();
    expect(spy.calls).toEqual([
      ['open', { input: 'mouse' }],
      nav('forward', 'mouse'),
      nav('back', 'keyboard'),
      nav('back', 'keyboard'),
      ['close', { input: 'keyboard' }],
    ]);
  });

  it('Download → tap; Open in new tab → navigate', async () => {
    idle();
    const el = mount({ items: files() });
    el.open(3);
    tap(q(el, '.av-vf a.av-act[data-act="download"]')!);
    await spy.settle();
    tap(q(el, '.av-vf a.av-act[data-act="open"]')!, 0);
    await spy.settle();
    expect(spy.calls).toEqual([
      ['tap', { input: 'mouse' }],
      ['navigate', { input: 'keyboard' }],
    ]);
  });

  it('nothing for the host’s calls and data, a hover peek, a prevented event, or a data-ui-sound="off" region', async () => {
    idle();
    const el = mount({ items: files() });
    el.data = { items: files(), index: 1 };
    el.renderNow();
    el.next();
    el.prev();
    el.close();
    vi.useFakeTimers();
    pointer(tiles(el)[0], 'pointerover');
    vi.advanceTimersByTime(PEEK_DELAY_MS);
    expect(q(el, '.av-peek')?.classList.contains('is-open')).toBe(true);
    vi.useRealTimers();
    await spy.settle();
    expect(spy.calls).toEqual([]);
    for (const n of ['ui-open', 'ui-close', 'ui-action']) el.addEventListener(n, (e) => e.preventDefault());
    tap(tiles(el)[0]);
    el.open(3);
    key(q(el, '.av-stage')!, 'Escape');
    tap(q(el, '.av-vf a.av-act[data-act="download"]')!);
    await spy.settle();
    expect(spy.calls).toEqual([]);
    const quiet = document.createElement('div');
    quiet.setAttribute('data-ui-sound', 'off');
    document.body.append(quiet);
    const off = mount({ items: files() });
    quiet.append(off);
    tap(tiles(off)[1]);
    tap(navBtn(off, 'next'));
    await spy.settle();
    expect(spy.calls).toEqual([]);
  });
});

// 0.20.0 — the dialog fits what it shows, and ‹ n / m › opens a list of every file (soma-work 2026-11-02).
describe('fit and jump (0.20.0)', () => {
  const jump = (el: UiArtifactViewer) => q<HTMLSelectElement>(el, 'select.av-jump');
  const change = (s: HTMLSelectElement, i: number) => {
    s.selectedIndex = i;
    s.dispatchEvent(new Event('change', { bubbles: true }));
  };

  it('viewerFit: a page, a picture, a video and a PDF fill the screen; a document is tall; audio and a card are small', () => {
    expect(['html', 'pdf', 'image', 'video'].map((b) => viewerFit(b as never))).toEqual([
      'fill',
      'fill',
      'fill',
      'fill',
    ]);
    expect(['markdown', 'text'].map((b) => viewerFit(b as never))).toEqual(['doc', 'doc']);
    expect(['audio', 'fallback'].map((b) => viewerFit(b as never))).toEqual(['compact', 'compact']);
    expect(FIT_SIZE).toEqual({ fill: 'full', doc: 'xl', compact: 'lg' });
  });

  it('the dialog takes the size of the shown file, and follows a step to another kind', () => {
    const el = mount({ items: files() });
    el.open(2); // landing.html
    expect(dialog(el).getAttribute('size')).toBe('full');
    expect(dialog(el).getAttribute('data-fit')).toBe('fill');
    el.prev(); // notes.md
    expect(dialog(el).getAttribute('size')).toBe('xl');
    expect(dialog(el).getAttribute('data-fit')).toBe('doc');
    el.open(0); // checkout.png
    expect(dialog(el).getAttribute('size')).toBe('full');
    el.open(4); // memo.wav
    expect(dialog(el).getAttribute('size')).toBe('lg');
    expect(dialog(el).getAttribute('data-fit')).toBe('compact');
    el.open(6); // bundle.zip — the calm card
    expect(dialog(el).getAttribute('data-fit')).toBe('compact');
  });

  it('the position is a list of every file: picking one shows it (ui-view), the list follows steps', () => {
    const el = mount({ items: files() });
    const views = record<ArtifactViewDetail>(el, 'ui-view');
    el.open(1);
    const s = jump(el)!;
    expect(s).not.toBeNull();
    expect(s.closest('.av-pos')).not.toBeNull();
    expect(s.getAttribute('aria-label')).toBe('Go to file');
    const opts = Array.from(s.options).map((o) => o.textContent);
    expect(opts).toEqual([
      '1. checkout.png',
      '2. notes.md',
      '3. landing.html',
      '4. retry.ts',
      '5. memo.wav',
      '6. demo.mp4',
      '7. bundle.zip',
    ]);
    expect(s.selectedIndex).toBe(1);
    change(s, 5);
    expect(el.index).toBe(5);
    expect(views.at(-1)).toEqual({ id: 'clip', index: 5, cancelable: false });
    expect(q(el, '.av-pos [aria-hidden="true"]')?.textContent).toBe('6 / 7');
    expect(q(el, '.av-live')?.textContent).toBe('demo.mp4 — 6 / 7');
    el.prev();
    expect(jump(el)!.selectedIndex).toBe(4);
    // Arrow keys on the list are the list's: they never step the viewer.
    expect(key(jump(el)!, 'ArrowRight').defaultPrevented).toBe(false);
    expect(el.index).toBe(4);
  });

  it('names are escaped; a single file has no list; Korean names the list', () => {
    const el = mount({ items: [{ id: 'x', name: XSS, text: 'a' }, ...files().slice(0, 1)] }, { lang: 'ko' });
    el.open(0);
    const s = jump(el)!;
    expect(s.getAttribute('aria-label')).toBe('파일로 이동');
    expect(s.options[0].textContent).toBe(`1. ${XSS}`);
    expect(s.querySelector('img')).toBeNull();
    el.close();
    vi.advanceTimersByTime(DIALOG_EXIT_MS + 50);
    const one = mount({ items: files().slice(0, 1) });
    one.open(0);
    expect(jump(one)).toBeNull();
  });
});
