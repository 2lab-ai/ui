import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import {
  MEDIA_GRID_MAX,
  type MediaGridData,
  type MediaItem,
  type MediaOpenDetail,
  mediaLabel,
  mediaShown,
  mediaSrc,
  type UiMediaGrid,
} from './media-grid';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const XSS = '<img src=x onerror=alert(1)>';

function pics(n: number): MediaItem[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `shot-${i + 1}.png`, url: `/media/${i + 1}` }));
}

function mount(data: MediaGridData, attrs: Record<string, string> = {}): UiMediaGrid {
  const el = document.createElement('ui-media-grid');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiMediaGrid, s: string) => el.shadowRoot!.querySelector<E>(s);
const qa = (el: UiMediaGrid, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const click = (t: Element, detail = 1) =>
  t.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail }));

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('helpers', () => {
  it('shows at most max tiles (4 by default, never below 1) and counts the rest', () => {
    expect(MEDIA_GRID_MAX).toBe(4);
    expect(mediaShown(pics(6))).toMatchObject({ more: 2 });
    expect(mediaShown(pics(6)).shown).toHaveLength(4);
    expect(mediaShown(pics(3))).toMatchObject({ more: 0 });
    expect(mediaShown(pics(3), 2).shown.map((p) => p.id)).toEqual(['p1', 'p2']);
    // 0, NaN or nothing is the default; a number below 1 shows one tile.
    expect(mediaShown(pics(3), 0).shown).toHaveLength(3);
    expect(mediaShown(pics(3), Number.NaN).shown).toHaveLength(3);
    expect(mediaShown(pics(3), -2).shown).toHaveLength(1);
  });

  it('a tile loads its thumb, else its url, and nothing a page may not load', () => {
    expect(mediaSrc({ url: '/media/1', thumb: '/thumb/1' })).toBe('/thumb/1');
    expect(mediaSrc({ url: 'https://x.test/a.png' })).toBe('https://x.test/a.png');
    expect(mediaSrc({ url: PNG })).toBe(PNG);
    expect(mediaSrc({ url: 'javascript:alert(1)' })).toBe('');
    expect(mediaSrc({ thumb: 'javascript:alert(1)', url: '/media/1' })).toBe('/media/1');
    expect(mediaSrc(null)).toBe('');
  });

  it('names a tile by its action, position, file, the rest and the alt — in en and ko', () => {
    expect(mediaLabel({ name: 'login.png' }, 2, 5, 0)).toBe('Open image 2 of 5: login.png');
    expect(mediaLabel({ name: 'login.png', alt: 'The login screen' }, 4, 5, 1)).toBe(
      'Open image 4 of 5: login.png, and 1 more — The login screen',
    );
    expect(mediaLabel({}, 1, 1, 0)).toBe('Open image 1 of 1: Image');
    expect(mediaLabel({ name: 'login.png' }, 4, 7, 3, 'ko')).toBe('이미지 열기 4/7: login.png 외 3개');
    expect(mediaLabel({ alt: '오류 화면' }, 1, 1, 0, 'ko')).toBe('이미지 열기 1/1: 이미지 — 오류 화면');
  });
});

describe('<ui-media-grid>', () => {
  it('draws up to four lazy tiles as named buttons, the last veiled with "+N"', () => {
    const el = mount({ items: pics(6) });
    const group = q(el, '.mg')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('6 images');
    const tiles = qa(el, '.mg-tile');
    expect(tiles).toHaveLength(4);
    expect(tiles[0].tagName).toBe('BUTTON');
    expect(tiles[0].getAttribute('type')).toBe('button');
    expect(tiles[0].getAttribute('aria-label')).toBe('Open image 1 of 6: shot-1.png');
    expect(tiles[0].getAttribute('title')).toBe('shot-1.png');
    expect(tiles[0].dataset.key).toBe('p1');
    const img = tiles[0].querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/media/1');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
    expect(tiles[3].getAttribute('aria-label')).toBe('Open image 4 of 6: shot-4.png, and 2 more');
    expect(tiles[3].querySelector('.mg-more')!.textContent).toBe('+2');
    expect(qa(el, '.mg-more')).toHaveLength(1);
    expect(group.classList.contains('is-single')).toBe(false);
  });

  it('one picture sits in the wide box — unless compact or single: false; compact draws 40px tiles', () => {
    const one = mount({ items: pics(1) });
    expect(q(one, '.mg')!.classList.contains('is-single')).toBe(true);
    expect(q(one, '.mg')!.getAttribute('aria-label')).toBe('1 image');
    const plain = mount({ items: pics(1), single: false });
    expect(q(plain, '.mg')!.classList.contains('is-single')).toBe(false);
    const compact = mount({ items: pics(1) }, { size: 'compact' });
    expect(q(compact, '.mg')!.classList.contains('is-compact')).toBe(true);
    expect(q(compact, '.mg')!.classList.contains('is-single')).toBe(false);
    expect(compact.size).toBe('compact');
    compact.size = 'default';
    expect(compact.hasAttribute('size')).toBe(false);
    // The max attribute, and data.max over it.
    const two = mount({ items: pics(5) }, { max: '2' });
    expect(qa(two, '.mg-tile')).toHaveLength(2);
    expect(q(two, '.mg-more')!.textContent).toBe('+3');
    two.data = { items: pics(5), max: 3 };
    two.renderNow();
    expect(qa(two, '.mg-tile')).toHaveLength(3);
    const css = one.shadowRoot!.querySelector('style')!.textContent ?? '';
    expect(css).toContain('.mg.is-compact .mg-tile { width: 40px; height: 40px; border-radius: 6px; }');
    expect(css).toMatch(/@media \(pointer: coarse\) \{\s*\.mg\.is-compact \.mg-tile \{ width: 44px; height: 44px; \}/);
    expect(css).toContain('.mg.is-single .mg-tile { width: 280px; max-width: 100%; height: 200px;');
  });

  it('escapes every string and loads only safe sources; an unloadable one is "No preview" at once', () => {
    const el = mount({
      items: [
        { id: XSS, name: XSS, url: 'javascript:alert(1)', alt: XSS },
        { id: 'ok', name: 'a.png', url: PNG },
      ],
    });
    expect(el.shadowRoot!.querySelector('img[src="x"]')).toBeNull();
    const [bad, ok] = qa(el, '.mg-tile');
    expect(bad.classList.contains('is-broken')).toBe(true);
    expect(bad.querySelector('img')).toBeNull();
    expect(bad.querySelector('.mg-none')!.textContent).toContain('No preview');
    expect(bad.getAttribute('aria-label')).toBe(`Open image 1 of 2: ${XSS} — ${XSS}`);
    expect(bad.getAttribute('title')).toBe(XSS);
    expect(bad.dataset.key).toBe(XSS);
    expect(ok.querySelector('img')!.getAttribute('src')).toBe(PNG);
  });

  it('a picture that fails to load turns into "No preview" (미리보기 불가 in Korean), the button keeping its name', () => {
    const el = mount({ items: pics(2) }, { lang: 'ko' });
    expect(q(el, '.mg')!.getAttribute('aria-label')).toBe('이미지 2개');
    const img = qa(el, '.mg-tile')[1].querySelector('img')!;
    img.dispatchEvent(new Event('error'));
    el.renderNow();
    const tile = qa(el, '.mg-tile')[1];
    expect(tile.classList.contains('is-broken')).toBe(true);
    expect(tile.querySelector('.mg-none')!.textContent).toContain('미리보기 불가');
    expect(tile.getAttribute('aria-label')).toBe('이미지 열기 2/2: shot-2.png');
    expect(qa(el, '.mg-tile')[0].classList.contains('is-broken')).toBe(false);
  });

  it('activating a tile sends ui-open with the item and its index among all pictures; preventable', () => {
    const el = mount({ items: pics(6) });
    const seen: MediaOpenDetail[] = [];
    el.addEventListener('ui-open', (e) => seen.push((e as CustomEvent<MediaOpenDetail>).detail));
    click(qa(el, '.mg-tile')[3].querySelector('.mg-more')!);
    expect(seen).toEqual([{ id: 'p4', index: 3, item: pics(6)[3] }]);
    let prevented = false;
    el.addEventListener('ui-open', (e) => {
      e.preventDefault();
      prevented = true;
    });
    click(qa(el, '.mg-tile')[0]);
    expect(prevented).toBe(true);
    expect(seen).toHaveLength(2);
  });

  it('focus() goes to the tile opened last, else the first; nothing is drawn without items', () => {
    const el = mount({ items: pics(3) });
    el.focus();
    expect(el.shadowRoot!.activeElement).toBe(qa(el, '.mg-tile')[0]);
    click(qa(el, '.mg-tile')[2]);
    (document.body as HTMLElement).focus();
    el.focus();
    expect(el.shadowRoot!.activeElement).toBe(qa(el, '.mg-tile')[2]);
    const empty = mount({ items: [] });
    expect(q(empty, '.mg')).toBeNull();
    const none = document.createElement('ui-media-grid');
    document.body.append(none);
    none.renderNow();
    expect(none.shadowRoot!.querySelector('.mg')).toBeNull();
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    spy = soundSpy();
  });
  afterEach(() => spy.restore());

  it('opening a picture → tap, by the input that did it', async () => {
    const el = mount({ items: pics(2) });
    click(qa(el, '.mg-tile')[0]);
    await spy.settle();
    click(qa(el, '.mg-tile')[1], 0);
    await spy.settle();
    expect(spy.calls).toEqual([
      ['tap', { input: 'mouse' }],
      ['tap', { input: 'keyboard' }],
    ]);
  });

  it('nothing for a prevented ui-open, data the app sets, or a data-ui-sound="off" region', async () => {
    const el = mount({ items: pics(2) });
    el.addEventListener('ui-open', (e) => e.preventDefault());
    click(qa(el, '.mg-tile')[0]);
    el.data = { items: pics(3) };
    el.renderNow();
    await spy.settle();
    expect(spy.calls).toEqual([]);
    const quiet = document.createElement('div');
    quiet.setAttribute('data-ui-sound', 'off');
    document.body.append(quiet);
    const off = mount({ items: pics(1) });
    quiet.append(off);
    click(qa(off, '.mg-tile')[0]);
    await spy.settle();
    expect(spy.calls).toEqual([]);
  });
});
