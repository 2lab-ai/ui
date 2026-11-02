import { describe, expect, it } from 'vitest';
import { asModelVendor, MODEL_MAKER_COLOR, modelMarkHtml, modelMarkSvg, modelVendor } from './model-mark';

// 0.23.0 — a model as its maker's mark (2lab-ai/soma-work#813).
describe('model marks', () => {
  it('names the maker from an id or a name', () => {
    const cases: Array<[unknown, string]> = [
      ['claude-opus-5-5[1m]', 'claude'],
      ['Sonnet 4.6 (1M)', 'claude'],
      ['haiku', 'claude'],
      ['fable[1m]', 'claude'],
      ['gpt-5.5-codex', 'openai'],
      ['GPT-5.6 Sol', 'openai'],
      ['o3-pro', 'openai'],
      ['grok-4.6', 'grok'],
      ['gemini-3-pro', 'gemini'],
      ['llama-4', 'model'],
      ['', 'model'],
      [undefined, 'model'],
      [42, 'model'],
    ];
    for (const [m, v] of cases) expect([m, modelVendor(m)]).toEqual([m, v]);
    expect(asModelVendor('gemini')).toBe('gemini');
    expect(asModelVendor('<svg>')).toBeUndefined();
  });

  it("gives each maker its colour: Claude's clay, Gemini's blue; OpenAI, xAI and others the ink", () => {
    expect(MODEL_MAKER_COLOR).toEqual({ claude: '#d97757', gemini: '#4285f4', openai: '', grok: '', model: '' });
  });

  it('draws the mark as our own SVG, coloured by the maker (none for the ink)', () => {
    for (const v of ['claude', 'openai', 'grok', 'gemini', 'model'] as const) {
      expect(modelMarkSvg(v)).toMatch(/^<svg viewBox="0 0 16 16" style="[^"]+" aria-hidden="true">/);
    }
    expect(modelMarkSvg('x' as never)).toBe(modelMarkSvg('model'));
    const c = document.createElement('div');
    c.innerHTML = modelMarkHtml('claude', 'mk');
    const span = c.firstElementChild as HTMLElement;
    expect(span.className).toBe('mk');
    expect(span.dataset.vendor).toBe('claude');
    expect(span.style.getPropertyValue('--model-hue')).toBe('#d97757');
    expect(span.querySelector('svg')).not.toBeNull();
    c.innerHTML = modelMarkHtml('openai', 'mk');
    expect((c.firstElementChild as HTMLElement).getAttribute('style')).toBeNull();
  });
});
