import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { doc } from './docs';
import {
  METAL_BADGE_DEFAULTS,
  METAL_BADGE_STRINGS,
  type MetalBadgeData,
  metalBadgeColor,
  metalBadgeCore,
  type UiMetalBadge,
} from './metal-badge';

const XSS = '<img src=x onerror=alert(1)>';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

async function mount(word: string, data: MetalBadgeData = {}, attrs: Record<string, string> = {}) {
  const el = document.createElement('ui-metal-badge');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  if (word) el.textContent = word;
  document.body.append(el);
  await Promise.resolve();
  el.renderNow();
  return el as UiMetalBadge;
}

const root = (el: UiMetalBadge) => el.shadowRoot!.querySelector<HTMLElement>('.ui-root')!;

describe('helpers', () => {
  it('merges and clamps the core', () => {
    expect(metalBadgeCore(undefined)).toEqual(METAL_BADGE_DEFAULTS.core);
    expect(metalBadgeCore({ r: 500, blur: -1, a: 2, size: 0 })).toEqual({ r: 100, blur: 0, a: 1, size: 1 });
  });

  it('accepts colours and refuses anything else', () => {
    expect(metalBadgeColor('#123')).toBe('#123');
    expect(metalBadgeColor('rgb(10, 20, 30)')).toBe('rgb(10, 20, 30)');
    expect(metalBadgeColor(XSS)).toBe('#323232');
    expect(metalBadgeColor('red; background: url(x)')).toBe('#323232');
    expect(metalBadgeColor('')).toBe('#323232');
  });
});

describe('<ui-metal-badge> without WebGL (happy-dom)', () => {
  it('shows the host’s word, in the light DOM', async () => {
    const el = await mount('Beta');
    expect(el.rendering).toBe('fallback');
    expect(el.textContent).toBe('Beta');
    expect(el.shadowRoot!.querySelector('.mb-label slot')).not.toBeNull();
    for (const sel of ['canvas', '.mb-core', '.mb-wash', '.mfx-glow'])
      expect(el.shadowRoot!.querySelector(sel)?.getAttribute('aria-hidden')).toBe('true');
  });

  it('says “New”, or “신규” with lang="ko", when nothing is slotted', async () => {
    const el = await mount('');
    expect(el.shadowRoot!.querySelector('slot')?.textContent).toBe(METAL_BADGE_STRINGS.en.badge);
    el.setAttribute('lang', 'ko');
    el.renderNow();
    expect(el.shadowRoot!.querySelector('slot')?.textContent).toBe('신규');
  });

  it('puts data.label in as text, never markup', async () => {
    const el = await mount('', { label: XSS });
    expect(el.shadowRoot!.querySelector('slot')?.textContent).toBe(XSS);
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
  });

  it('clamps scale and the design knobs into CSS variables', async () => {
    const el = await mount('New', { gradient: 4, glow: -1, core: { r: 30 }, textColor: XSS }, { scale: '9' });
    const r = root(el);
    expect(r.style.getPropertyValue('--mb-k')).toBe('4');
    expect(r.style.getPropertyValue('--mb-gradient')).toBe('1');
    expect(r.style.getPropertyValue('--mb-glow')).toBe('0');
    expect(r.style.getPropertyValue('--mb-core-r')).toBe('30%');
    expect(r.style.getPropertyValue('--mb-core-end')).toBe('100%');
    expect(r.style.getPropertyValue('--mb-text')).toBe('#323232');
    el.setAttribute('scale', '0.1');
    el.renderNow();
    expect(r.style.getPropertyValue('--mb-k')).toBe('0.5');
  });

  it('documents ≥ 3 demos that build', () => {
    expect(doc.group).toBe('Effects');
    expect(doc.tag).toBe('ui-metal-badge');
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const d of doc.demos) expect(d.create().querySelector('ui-metal-badge')).not.toBeNull();
  });
});
