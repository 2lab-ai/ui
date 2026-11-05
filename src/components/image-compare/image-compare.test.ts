import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import { doc } from './docs';
import {
  COMPARE_FLICK,
  COMPARE_GLIDE_MS,
  type CompareImage,
  compareGlide,
  compareKey,
  comparePosition,
  compareText,
  type ImageCompareChange,
  type ImageCompareData,
  type UiImageCompare,
} from './image-compare';
import { styles } from './styles';

const XSS = '<img src=x onerror=alert(1)>';
const BEFORE: CompareImage = { src: 'https://qa.2lab.ai/runs/412/before.png', alt: 'The board before the PR' };
const AFTER: CompareImage = { src: 'https://qa.2lab.ai/runs/412/after.png', alt: 'The board after the PR' };
const DATA: ImageCompareData = { before: BEFORE, after: AFTER };

function mount(data?: ImageCompareData, attrs: Record<string, string> = {}): UiImageCompare {
  const el = document.createElement('ui-image-compare');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  if (data) el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiImageCompare, s: string) => el.shadowRoot!.querySelector<E>(s);
const qa = <E extends Element = HTMLElement>(el: UiImageCompare, s: string) =>
  Array.from(el.shadowRoot!.querySelectorAll<E>(s));
const box = (el: UiImageCompare) => q(el, '.cmp')!;
const knob = (el: UiImageCompare) => q(el, '.cmp-knob')!;
const pos = (el: UiImageCompare) => box(el).style.getPropertyValue('--pos').trim();
const tag = (el: UiImageCompare, side: 'before' | 'after') => q(el, `.cmp-tag.is-${side}`)!;

const key = (t: EventTarget, k: string, init: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...init });
  t.dispatchEvent(e);
  return e;
};
const ptr = (t: EventTarget, type: string, clientX: number, init: PointerEventInit = {}) => {
  const e = new PointerEvent(type, {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    clientX,
    bubbles: true,
    composed: true,
    cancelable: true,
    ...init,
  });
  t.dispatchEvent(e);
  return e;
};
function changes(el: UiImageCompare): number[] {
  const seen: number[] = [];
  el.addEventListener('ui-change', (e) => seen.push((e as CustomEvent<ImageCompareChange>).detail.position));
  return seen;
}

/** The box laid out at x 100 … 500 (400px wide). */
function layout(el: UiImageCompare): HTMLElement {
  const b = box(el);
  vi.spyOn(b, 'getBoundingClientRect').mockReturnValue({
    left: 100,
    width: 400,
    top: 0,
    height: 250,
    right: 500,
    bottom: 250,
    x: 100,
    y: 0,
    toJSON() {},
  } as DOMRect);
  return b;
}

let now = 0;
let frames: Map<number, FrameRequestCallback>;
let frameId = 0;
let cancelled: number[] = [];
let reduce = false;
/** Run the frames queued so far at time `t`. */
const frame = (t: number) => {
  now = t;
  const run = Array.from(frames.values());
  frames.clear();
  for (const cb of run) cb(t);
};

beforeEach(() => {
  document.body.innerHTML = '';
  now = 0;
  frames = new Map();
  frameId = 0;
  cancelled = [];
  reduce = false;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++frameId, cb);
    return frameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    cancelled.push(id);
    frames.delete(id);
  });
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('helpers', () => {
  it('comparePosition: the share of the box left of the pointer, clamped; the middle for a box with no width', () => {
    const r = { left: 100, width: 400 };
    expect(comparePosition(300, r)).toBe(0.5);
    expect(comparePosition(150, r)).toBe(0.125);
    expect(comparePosition(40, r)).toBe(0);
    expect(comparePosition(900, r)).toBe(1);
    expect(comparePosition(300, { left: 0, width: 0 })).toBe(0.5);
    expect(comparePosition(Number.NaN, r)).toBe(0.5);
  });

  it('compareGlide: a flick glides on toward its edge as far as its speed carries it; slower, the line stays', () => {
    expect(compareGlide(0.5, 0.3, 400)).toBe(0.5);
    expect(compareGlide(0.5, -0.45, 400)).toBe(0.5);
    // 2 px/ms for 500ms is 1000px: past the edge of a 400px box either way.
    expect(compareGlide(0.5, 2, 400)).toBe(1);
    expect(compareGlide(0.5, -2, 400)).toBe(0);
    // 0.8 px/ms on a 1000px box: 400px on.
    expect(compareGlide(0.5, 0.8, 1000)).toBeCloseTo(0.9, 10);
    expect(compareGlide(0.6, -COMPARE_FLICK, 1000)).toBeCloseTo(0.35, 10);
    expect(compareGlide(0.6, -COMPARE_FLICK + 0.01, 1000)).toBe(0.6);
    expect(compareGlide(0.5, 2, 0)).toBe(0.5);
    expect(compareGlide(1.4, 0, 400)).toBe(1);
    expect(compareGlide(0.5, Number.NaN, 400)).toBe(0.5);
  });

  it('compareKey: arrows 5%, Page keys 20%, Home / End, on whole percents and clamped; null for other keys', () => {
    expect(compareKey('ArrowRight', 0.4)).toBe(0.45);
    expect(compareKey('ArrowUp', 0.4)).toBe(0.45);
    expect(compareKey('ArrowLeft', 0.4)).toBe(0.35);
    expect(compareKey('ArrowDown', 0.4)).toBe(0.35);
    expect(compareKey('PageUp', 0.4)).toBe(0.6);
    expect(compareKey('PageDown', 0.4)).toBe(0.2);
    expect(compareKey('Home', 0.4)).toBe(0);
    expect(compareKey('End', 0.4)).toBe(1);
    expect(compareKey('ArrowRight', 0.98)).toBe(1);
    expect(compareKey('PageDown', 0.1)).toBe(0);
    expect(compareKey('ArrowRight', 0.4237)).toBe(0.47);
    expect(compareKey('Enter', 0.4)).toBeNull();
    expect(compareKey('a', 0.4)).toBeNull();
  });

  it('compareText: both shares in whole percents that add up to 100, in the labels given', () => {
    expect(compareText(0.4, { before: 'Before', after: 'After' })).toBe('Before 40% · After 60%');
    expect(compareText(0.333, { before: '0.27.0', after: '0.28.0' })).toBe('0.27.0 33% · 0.28.0 67%');
    expect(compareText(0.505)).toBe('Before 51% · After 49%');
    expect(compareText(1.7, { before: '이전', after: '이후' })).toBe('이전 100% · 이후 0%');
  });
});

describe('<ui-image-compare> render', () => {
  it('draws After under Before, Before clipped at --pos, the line, the knob and the two tags', () => {
    const el = mount(DATA);
    const b = box(el);
    expect(b.dataset.fit).toBe('cover');
    expect(b.style.getPropertyValue('aspect-ratio').trim()).toBe('16 / 10');
    expect(pos(el)).toBe('50%');
    const imgs = qa<HTMLImageElement>(el, 'img');
    expect(imgs).toHaveLength(2);
    const [before, after] = [q<HTMLImageElement>(el, '.cmp-before img')!, q<HTMLImageElement>(el, '.cmp-after img')!];
    expect(before.getAttribute('src')).toBe(BEFORE.src);
    expect(before.getAttribute('alt')).toBe(BEFORE.alt);
    expect(after.getAttribute('src')).toBe(AFTER.src);
    expect(after.getAttribute('alt')).toBe(AFTER.alt);
    for (const img of imgs) {
      expect(img.getAttribute('loading')).toBe('lazy');
      expect(img.getAttribute('decoding')).toBe('async');
      expect(img.getAttribute('draggable')).toBe('false');
    }
    expect(q(el, '.cmp-line')!.getAttribute('aria-hidden')).toBe('true');
    expect(tag(el, 'before').textContent).toBe('Before');
    expect(tag(el, 'after').textContent).toBe('After');
    expect(tag(el, 'before').hasAttribute('data-near')).toBe(false);
    expect(tag(el, 'after').hasAttribute('data-near')).toBe(false);
    expect(knob(el).querySelectorAll('svg[data-icon]')).toHaveLength(2);
  });

  it('the knob is a slider: 0 … 100, the value, the words in both labels, named, focusable', () => {
    const k = knob(mount({ ...DATA, position: 0.4 }));
    expect(k.getAttribute('role')).toBe('slider');
    expect(k.getAttribute('tabindex')).toBe('0');
    expect(k.getAttribute('aria-label')).toBe('Compare before and after');
    expect(k.getAttribute('aria-valuemin')).toBe('0');
    expect(k.getAttribute('aria-valuemax')).toBe('100');
    expect(k.getAttribute('aria-valuenow')).toBe('40');
    expect(k.getAttribute('aria-valuetext')).toBe('Before 40% · After 60%');
  });

  it('styles: the clip at --pos, pan-y on the box, a focus ring, 44px on coarse pointers, no motion left under reduce', () => {
    expect(styles).toContain('clip-path: inset(0 calc(100% - var(--pos)) 0 0)');
    expect(styles).toContain('touch-action: pan-y');
    expect(styles).toContain('left: var(--pos)');
    expect(styles).toContain(
      '.cmp-knob:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }',
    );
    expect(styles).toMatch(/@media \(pointer: coarse\) \{\s*\.cmp-knob \{ width: 44px; height: 44px; \}/);
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.cmp-tag, \.cmp-knob \{ transition: none; \}/,
    );
    expect(styles).toContain('.cmp-tag[data-near] { opacity: 0; }');
    expect(styles).toContain('.cmp[data-fit="contain"] .cmp-img { object-fit: contain; }');
    // Tokens only: no hex or rgba literals.
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    expect(styles).not.toMatch(/@keyframes|infinite/);
  });

  it('position from the attribute, data wins; clamped; ratio and fit from data, a bad ratio is the default', () => {
    const el = mount(DATA, { position: '0.3' });
    expect(pos(el)).toBe('30%');
    expect(el.position).toBe(0.3);
    el.data = { ...DATA, position: 0.7 };
    el.renderNow();
    expect(pos(el)).toBe('70%');
    el.setAttribute('position', '0.1');
    el.renderNow();
    expect(pos(el)).toBe('70%');
    expect(pos(mount({ ...DATA, position: 1.5 }))).toBe('100%');
    expect(pos(mount({ ...DATA, position: Number.NaN }, { position: 'soon' }))).toBe('50%');
    const phone = mount({ ...DATA, ratio: '9/16', fit: 'contain' });
    expect(box(phone).style.getPropertyValue('aspect-ratio').trim()).toBe('9 / 16');
    expect(box(phone).dataset.fit).toBe('contain');
    const bad = mount({ ...DATA, ratio: '1; background: url(//x)', fit: 'fill' as never });
    expect(box(bad).style.getPropertyValue('aspect-ratio').trim()).toBe('16 / 10');
    expect(box(bad).style.getPropertyValue('background')).toBe('');
    expect(box(bad).dataset.fit).toBe('cover');
  });

  it('the host’s labels go on the tags and into the slider’s words', () => {
    const el = mount({
      before: { ...BEFORE, label: '0.27.0' },
      after: { ...AFTER, label: '0.28.0' },
      position: 0.3,
      ratio: '9 / 16',
    });
    expect(tag(el, 'before').textContent).toBe('0.27.0');
    expect(tag(el, 'after').textContent).toBe('0.28.0');
    expect(knob(el).getAttribute('aria-valuetext')).toBe('0.27.0 30% · 0.28.0 70%');
    // A blank label is the default.
    expect(tag(mount({ before: { ...BEFORE, label: '  ' }, after: AFTER }), 'before').textContent).toBe('Before');
  });

  it('a tag fades when the line comes near it — measured against the tag once laid out', () => {
    // Before a layout: the outer fifth.
    expect(tag(mount({ ...DATA, position: 0.1 }), 'before').hasAttribute('data-near')).toBe(true);
    expect(tag(mount({ ...DATA, position: 0.9 }), 'after').hasAttribute('data-near')).toBe(true);
    // Laid out: a 400px box, Before's tag 12 … 132px, After's 330 … 388px.
    const el = mount({ ...DATA, position: 0.3 });
    Object.defineProperty(box(el), 'clientWidth', { configurable: true, value: 400 });
    for (const [side, left, width] of [
      ['before', 12, 120],
      ['after', 330, 58],
    ] as const) {
      Object.defineProperty(tag(el, side), 'offsetLeft', { configurable: true, value: left });
      Object.defineProperty(tag(el, side), 'offsetWidth', { configurable: true, value: width });
    }
    el.renderNow();
    expect(tag(el, 'before').hasAttribute('data-near')).toBe(true); // 120px < 132 + 8
    expect(tag(el, 'after').hasAttribute('data-near')).toBe(false);
    knob(el).focus();
    key(knob(el), 'ArrowRight'); // 35%: 140px — clear
    expect(tag(el, 'before').hasAttribute('data-near')).toBe(false);
    key(knob(el), 'End');
    expect(tag(el, 'after').hasAttribute('data-near')).toBe(true);
  });

  it('a source that is not safe to load draws “No preview” in its half, named by its alt', () => {
    const el = mount({ before: { src: 'javascript:alert(1)', alt: 'The board before' }, after: AFTER });
    expect(q(el, '.cmp-before img')).toBeNull();
    const none = q(el, '.cmp-before .cmp-none')!;
    expect(none.getAttribute('role')).toBe('img');
    expect(none.getAttribute('aria-label')).toBe('The board before — No preview');
    expect(none.textContent).toBe('No preview');
    expect(none.querySelector('svg[data-icon="image"]')).not.toBeNull();
    expect(q<HTMLImageElement>(el, '.cmp-after img')!.getAttribute('src')).toBe(AFTER.src);
    // SVG data URIs, data:text/html and an empty source are not loaded either.
    for (const src of ['data:image/svg+xml,<svg/>', 'data:text/html,<script>alert(1)</script>', '']) {
      const other = mount({ before: BEFORE, after: { src, alt: '' } });
      expect(q(other, '.cmp-after img')).toBeNull();
      expect(q(other, '.cmp-after .cmp-none')!.getAttribute('aria-label')).toBe('No preview');
    }
  });

  it('a picture that fails to load gives way to “No preview” (and stays that way)', () => {
    const el = mount({ before: BEFORE, after: { ...AFTER, src: 'https://qa.2lab.ai/a.png?x=1&y=2' } });
    q(el, '.cmp-after img')!.dispatchEvent(new Event('error'));
    el.renderNow();
    expect(q(el, '.cmp-after img')).toBeNull();
    expect(q(el, '.cmp-after .cmp-none')).not.toBeNull();
    expect(q(el, '.cmp-before img')).not.toBeNull();
    el.data = { ...el.data!, position: 0.6 };
    el.renderNow();
    expect(q(el, '.cmp-after img')).toBeNull();
  });

  it('escapes every host string: alts, labels and sources', () => {
    const el = mount({
      before: { src: 'https://x.test/a.png" onerror="alert(1)', alt: XSS, label: XSS },
      after: { src: 'javascript:alert(1)', alt: XSS, label: `v2 ${XSS}` },
    });
    const imgs = qa<HTMLImageElement>(el, 'img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0].getAttribute('alt')).toBe(XSS);
    expect(imgs[0].getAttribute('src')).toBe('https://x.test/a.png" onerror="alert(1)');
    expect(imgs[0].hasAttribute('onerror')).toBe(false);
    expect(tag(el, 'before').textContent).toBe(XSS);
    expect(tag(el, 'after').textContent).toBe(`v2 ${XSS}`);
    expect(q(el, '.cmp-after .cmp-none')!.getAttribute('aria-label')).toBe(`${XSS} — No preview`);
    expect(knob(el).getAttribute('aria-valuetext')).toBe(`${XSS} 50% · v2 ${XSS} 50%`);
    expect(el.shadowRoot!.querySelector('[onerror]')).toBeNull();
  });

  it('speaks Korean with lang="ko"', () => {
    const el = mount({ before: { src: 'javascript:0', alt: '이전 화면' }, after: AFTER }, { lang: 'ko' });
    expect(tag(el, 'before').textContent).toBe('이전');
    expect(tag(el, 'after').textContent).toBe('이후');
    expect(knob(el).getAttribute('aria-label')).toBe('이전과 이후 비교');
    expect(knob(el).getAttribute('aria-valuetext')).toBe('이전 50% · 이후 50%');
    expect(q(el, '.cmp-none')!.textContent).toBe('미리보기 없음');
    expect(q(el, '.cmp-none')!.getAttribute('aria-label')).toBe('이전 화면 — 미리보기 없음');
  });

  it('draws nothing without data', () => {
    const el = mount();
    expect(el.shadowRoot!.querySelector('.ui-root')!.innerHTML).toBe('');
  });
});

describe('keyboard', () => {
  it('arrows, Page keys, Home / End move the line; one ui-change per change, none when it cannot move', () => {
    const el = mount({ ...DATA, position: 0.4 });
    const seen = changes(el);
    const k = knob(el);
    k.focus();
    expect(key(k, 'ArrowRight').defaultPrevented).toBe(true);
    expect(pos(el)).toBe('45%');
    expect(k.getAttribute('aria-valuenow')).toBe('45');
    expect(k.getAttribute('aria-valuetext')).toBe('Before 45% · After 55%');
    key(k, 'ArrowLeft');
    key(k, 'ArrowLeft');
    key(k, 'PageUp');
    key(k, 'PageDown');
    key(k, 'Home');
    expect(pos(el)).toBe('0%');
    // At the edge: the key is still the slider's, nothing changed, nothing sent.
    expect(key(k, 'ArrowLeft').defaultPrevented).toBe(true);
    key(k, 'End');
    expect(seen).toEqual([0.45, 0.4, 0.35, 0.55, 0.35, 0, 1]);
    expect(el.data!.position).toBe(1);
    expect(el.position).toBe(1);
    // Not the slider's keys: left alone.
    expect(key(k, 'Enter').defaultPrevented).toBe(false);
    expect(key(k, 'ArrowLeft', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(seen).toHaveLength(7);
    // The knob kept focus through the renders.
    el.renderNow();
    expect(el.shadowRoot!.activeElement).toBe(k);
    expect(knob(el)).toBe(k);
  });

  it('ui-change reports what happened: not cancelable', () => {
    const el = mount(DATA);
    const kinds: boolean[] = [];
    el.addEventListener('ui-change', (e) => {
      kinds.push(e.cancelable);
      e.preventDefault();
    });
    key(knob(el), 'ArrowRight');
    expect(kinds).toEqual([false]);
    expect(pos(el)).toBe('55%');
  });

  it('a position the host sets afterwards wins', () => {
    const el = mount(DATA);
    key(knob(el), 'End');
    el.data = { ...DATA, position: 0.2 };
    el.renderNow();
    expect(pos(el)).toBe('20%');
    expect(knob(el).getAttribute('aria-valuenow')).toBe('20');
  });
});

describe('pointer', () => {
  it('a press jumps the line there, it follows the pointer (captured), and ui-change comes once on release', () => {
    const el = mount(DATA);
    const b = layout(el);
    const cap = vi.spyOn(b, 'setPointerCapture');
    const seen = changes(el);
    const down = ptr(b, 'pointerdown', 200);
    expect(down.defaultPrevented).toBe(true);
    expect(cap).toHaveBeenCalledWith(1);
    expect(b.hasAttribute('data-held')).toBe(true);
    expect(pos(el)).toBe('25%');
    expect(el.shadowRoot!.activeElement).toBe(knob(el));
    now = 100;
    ptr(b, 'pointermove', 260);
    expect(pos(el)).toBe('40%');
    expect(knob(el).getAttribute('aria-valuenow')).toBe('40');
    now = 200;
    ptr(b, 'pointermove', 340);
    expect(pos(el)).toBe('60%');
    expect(el.position).toBe(0.6);
    expect(seen).toEqual([]);
    now = 400; // rested before letting go: no flick
    ptr(b, 'pointerup', 340);
    expect(seen).toEqual([0.6]);
    expect(frames.size).toBe(0);
    expect(b.hasAttribute('data-held')).toBe(false);
    expect(el.data!.position).toBe(0.6);
    ptr(b, 'pointermove', 120); // after the drag: nothing
    expect(pos(el)).toBe('60%');
    expect(seen).toEqual([0.6]);
  });

  it('a press on the knob keeps its grip: the line does not jump under it', () => {
    const el = mount(DATA);
    const b = layout(el);
    const seen = changes(el);
    ptr(knob(el), 'pointerdown', 310); // the knob is centred on x 300
    expect(pos(el)).toBe('50%');
    now = 200;
    ptr(b, 'pointermove', 330);
    expect(pos(el)).toBe('55%');
    now = 400;
    ptr(b, 'pointerup', 330);
    expect(seen).toEqual([0.55]);
  });

  it('a press and release where the line already is sends nothing; other buttons are ignored', () => {
    const el = mount(DATA);
    const b = layout(el);
    const seen = changes(el);
    ptr(b, 'pointerdown', 300);
    now = 300;
    ptr(b, 'pointerup', 300);
    ptr(b, 'pointerdown', 120, { button: 2 });
    expect(pos(el)).toBe('50%');
    expect(seen).toEqual([]);
  });

  it('a flick glides on to the edge over 420ms (ease-out, rAF) and reports once, at the end', () => {
    const el = mount(DATA);
    const b = layout(el);
    const seen = changes(el);
    ptr(b, 'pointerdown', 300);
    now = 10;
    ptr(b, 'pointermove', 320);
    now = 30;
    ptr(b, 'pointermove', 360);
    now = 50;
    ptr(b, 'pointermove', 400);
    ptr(b, 'pointerup', 400); // 100px in 50ms: 2 px/ms
    expect(pos(el)).toBe('75%');
    expect(seen).toEqual([]);
    expect(frames.size).toBe(1);
    frame(50 + COMPARE_GLIDE_MS / 2);
    // Half the time, seven eighths of the way (1 − 0.5³).
    expect(el.position).toBeCloseTo(0.75 + 0.25 * 0.875, 10);
    expect(seen).toEqual([]);
    frame(50 + COMPARE_GLIDE_MS);
    expect(pos(el)).toBe('100%');
    expect(knob(el).getAttribute('aria-valuenow')).toBe('100');
    expect(tag(el, 'after').hasAttribute('data-near')).toBe(true);
    expect(seen).toEqual([1]);
    expect(frames.size).toBe(0); // nothing left running
    expect(el.data!.position).toBe(1);
  });

  it('a flick to the left glides to 0', () => {
    const el = mount(DATA);
    const b = layout(el);
    const seen = changes(el);
    ptr(b, 'pointerdown', 300);
    now = 40;
    ptr(b, 'pointermove', 220);
    ptr(b, 'pointerup', 220);
    frame(40 + COMPARE_GLIDE_MS);
    expect(seen).toEqual([0]);
  });

  it('under reduced motion a flick does not glide: the line stays where it was let go', () => {
    reduce = true;
    const el = mount(DATA);
    const b = layout(el);
    const seen = changes(el);
    ptr(b, 'pointerdown', 300);
    now = 50;
    ptr(b, 'pointermove', 400);
    ptr(b, 'pointerup', 400);
    expect(frames.size).toBe(0);
    expect(pos(el)).toBe('75%');
    expect(seen).toEqual([0.75]);
  });

  it('a new press stops a glide where it is; only the new release reports', () => {
    const el = mount(DATA);
    const b = layout(el);
    const seen = changes(el);
    ptr(b, 'pointerdown', 300);
    now = 50;
    ptr(b, 'pointermove', 400);
    ptr(b, 'pointerup', 400);
    const [glide] = Array.from(frames.keys());
    frame(50 + COMPARE_GLIDE_MS / 2);
    const mid = el.position;
    ptr(knob(el), 'pointerdown', 100 + mid * 400);
    expect(cancelled).toContain(glide + 1);
    expect(frames.size).toBe(0);
    expect(el.position).toBe(mid);
    now = 1000;
    ptr(b, 'pointerup', 100 + mid * 400);
    expect(seen).toEqual([mid]);
    frame(2000);
    expect(seen).toEqual([mid]);
  });

  it('disconnect cancels the glide: nothing runs or reports afterwards', () => {
    const el = mount(DATA);
    const b = layout(el);
    const seen = changes(el);
    ptr(b, 'pointerdown', 300);
    now = 50;
    ptr(b, 'pointermove', 400);
    ptr(b, 'pointerup', 400);
    const [id] = Array.from(frames.keys());
    el.remove();
    expect(cancelled).toContain(id);
    expect(frames.size).toBe(0);
    frame(1000);
    expect(seen).toEqual([]);
  });

  it('touch: the line waits for a sideways move (or a tap) — a press the page takes for a scroll puts it back', () => {
    const el = mount(DATA);
    const b = layout(el);
    const seen = changes(el);
    const touch = { pointerType: 'touch' };
    const down = ptr(b, 'pointerdown', 200, touch);
    expect(down.defaultPrevented).toBe(false);
    expect(pos(el)).toBe('50%');
    now = 100;
    ptr(b, 'pointermove', 220, touch);
    expect(pos(el)).toBe('30%');
    ptr(b, 'pointercancel', 220, touch); // the page scrolled
    expect(pos(el)).toBe('50%');
    expect(seen).toEqual([]);
    // A tap jumps the line on release.
    now = 1000;
    ptr(b, 'pointerdown', 400, touch);
    expect(pos(el)).toBe('50%');
    now = 1080;
    ptr(b, 'pointerup', 400, touch);
    expect(pos(el)).toBe('75%');
    expect(frames.size).toBe(0);
    expect(seen).toEqual([0.75]);
  });

  it('a lost capture without a release keeps the line where it is', () => {
    const el = mount(DATA);
    const b = layout(el);
    const seen = changes(el);
    ptr(b, 'pointerdown', 180);
    ptr(b, 'lostpointercapture', 180);
    expect(seen).toEqual([0.2]);
    expect(b.hasAttribute('data-held')).toBe(false);
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    spy = soundSpy();
  });
  afterEach(() => spy.restore());

  it('a subtle tap when a press makes the line jump; nothing for a drag, a glide, a grip on the knob or keys', async () => {
    const el = mount(DATA);
    const b = layout(el);
    ptr(b, 'pointerdown', 200);
    ptr(b, 'pointermove', 260);
    ptr(b, 'pointerup', 260);
    await spy.settle();
    ptr(knob(el), 'pointerdown', 262);
    ptr(b, 'pointermove', 300);
    ptr(b, 'pointerup', 300);
    key(knob(el), 'ArrowRight');
    key(knob(el), 'End');
    await spy.settle();
    ptr(b, 'pointerdown', 400, { pointerType: 'touch' });
    ptr(b, 'pointerup', 400, { pointerType: 'touch' });
    await spy.settle();
    expect(spy.calls).toEqual([
      ['tap', { emphasis: 'subtle', input: 'mouse' }],
      ['tap', { emphasis: 'subtle', input: 'touch' }],
    ]);
  });

  it('silent in a quiet region', async () => {
    const wrap = document.createElement('div');
    wrap.setAttribute('data-ui-sound', 'off');
    document.body.append(wrap);
    const el = document.createElement('ui-image-compare');
    wrap.append(el);
    el.data = DATA;
    el.renderNow();
    ptr(layout(el), 'pointerdown', 150);
    await spy.settle();
    expect(spy.calls).toEqual([]);
  });
});

describe('doc', () => {
  it('names the block, the soma-work spot and the sound, and every demo builds an element that renders', () => {
    expect(doc.slug).toBe('image-compare');
    expect(doc.tag).toBe('ui-image-compare');
    expect(doc.group).toBe('Components');
    expect(doc.reference).toEqual({
      name: 'bencho.dev — Image compare (MIT)',
      url: 'https://bencho.dev/blocks/image-compare',
    });
    expect(doc.usedIn).toMatch(/QA/);
    expect(doc.a11y.some((l) => l.startsWith('Sound (opt-in'))).toBe(true);
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const demo of doc.demos) {
      const node = demo.create();
      document.body.append(node);
      const el = (
        node.localName === 'ui-image-compare' ? node : node.querySelector('ui-image-compare')
      ) as UiImageCompare;
      expect(el, demo.id).not.toBeNull();
      el.renderNow();
      expect(q(el, '.cmp'), demo.id).not.toBeNull();
      expect(qa(el, 'img').length + qa(el, '.cmp-none').length, demo.id).toBe(2);
    }
    const phone = doc.demos
      .find((d) => d.id === 'phone')!
      .create()
      .querySelector('ui-image-compare')!;
    document.body.append(phone);
    phone.renderNow();
    expect(phone.position).toBe(0.3);
    expect(q(phone, '.cmp-tag.is-before')!.textContent).toBe('0.27.0');
    const broken = doc.demos
      .find((d) => d.id === 'broken')!
      .create()
      .querySelector('ui-image-compare')!;
    document.body.append(broken);
    broken.renderNow();
    expect(q(broken, '.cmp-before .cmp-none')).not.toBeNull();
    expect(q(broken, '.cmp-after img')!.getAttribute('src')).toMatch(/^blob:/);
  });
});
