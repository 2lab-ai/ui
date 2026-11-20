import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { doc } from './docs';
import {
  METAL_TEXT_DEFAULTS,
  type MetalTextData,
  metalGlyphRim,
  metalTextInnerShadow,
  type UiMetalText,
} from './metal-text';
import { styles } from './styles';

const XSS = '<img src=x onerror=alert(1)>';
let reduce = false;

beforeEach(() => {
  document.body.innerHTML = '';
  reduce = false;
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.includes('prefers-reduced-motion') ? reduce : false;
    },
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

async function mount(text: string, data: MetalTextData = {}, attrs: Record<string, string> = {}) {
  const el = document.createElement('ui-metal-text');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  el.textContent = text;
  document.body.append(el);
  await Promise.resolve();
  el.renderNow();
  return el as UiMetalText;
}

const root = (el: UiMetalText) => el.shadowRoot!.querySelector<HTMLElement>('.ui-root')!;

describe('helpers', () => {
  it('merges and clamps the glyph rim', () => {
    expect(metalTextInnerShadow(undefined)).toEqual(METAL_TEXT_DEFAULTS.innerShadow);
    expect(metalTextInnerShadow(null)).toBeNull();
    expect(metalTextInnerShadow(false)).toBeNull();
    expect(metalTextInnerShadow({ offsetY: 10, blur: -2, alpha: 3 })).toEqual({ offsetY: 4, blur: 0, alpha: 1 });
  });

  it('lights only the top inside edge of a glyph', () => {
    // A 4×4 block in a 6×6 field.
    const w = 6;
    const h = 6;
    const a = new Float32Array(w * h);
    for (let y = 1; y < 5; y++) for (let x = 1; x < 5; x++) a[y * w + x] = 1;
    const rim = metalGlyphRim(a, w, h, 1, 0, 1);
    expect(rim[1 * w + 2]).toBe(255); // top row of the glyph
    expect(rim[3 * w + 2]).toBe(0); // inside
    expect(rim[0 * w + 2]).toBe(0); // outside, above
  });
});

describe('<ui-metal-text> without WebGL (happy-dom)', () => {
  it('keeps the words as the host’s slotted text, with the metal layers hidden', async () => {
    const el = await mount('Pro');
    expect(el.rendering).toBe('fallback');
    expect(el.textContent).toBe('Pro');
    const sr = el.shadowRoot!;
    expect(sr.querySelector('.mt-text slot')).not.toBeNull();
    for (const sel of ['canvas.metal-fx-canvas', 'canvas.mt-rim', '.mfx-glow'])
      expect(sr.querySelector(sel)?.getAttribute('aria-hidden')).toBe('true');
    expect(root(el).hasAttribute('data-fallback')).toBe(true);
  });

  it('applies font and colour through CSSOM — never into the markup', async () => {
    const el = await mount('Pro', { font: '500 24px/1.2 Inter, sans-serif', color: '#e2e2e2' });
    const t = el.shadowRoot!.querySelector<HTMLElement>('.mt-text')!;
    expect(t.style.font).toContain('24px');
    expect(t.style.color).not.toBe('');
    el.data = { font: XSS, color: `red;"><script>${XSS}` };
    el.renderNow();
    expect(el.shadowRoot!.innerHTML).not.toContain('onerror');
    expect(el.shadowRoot!.querySelector('img, script')).toBeNull();
  });

  it('reflects preset and theme; data wins over attributes; is still under reduced motion', async () => {
    reduce = true;
    const el = await mount('Max', { preset: 'gold' }, { preset: 'silver', theme: 'dark' });
    expect(root(el).dataset.preset).toBe('gold');
    expect(root(el).dataset.theme).toBe('dark');
    expect(el.paused).toBe(true);
  });

  it('reads Korean text as text (lang="ko")', async () => {
    const el = await mount('프로 요금제', {}, { lang: 'ko' });
    expect(el.textContent).toBe('프로 요금제');
    expect(el.shadowRoot!.querySelector('.mt-text')?.textContent).toBe('');
  });

  it('is bare: no fill, no rims, no hairline; the fallback is a gradient on the words', () => {
    expect(styles).toContain('background-clip: text');
    expect(styles).toContain('.mfx-inner { display: none !important; }');
  });

  it('documents ≥ 3 demos that build', () => {
    expect(doc.group).toBe('Effects');
    expect(doc.tag).toBe('ui-metal-text');
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const d of doc.demos) expect(d.create().querySelector('ui-metal-text')).not.toBeNull();
  });
});
