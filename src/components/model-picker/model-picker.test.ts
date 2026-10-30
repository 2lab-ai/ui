import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import {
  anchorMoved,
  fmtModelPrice,
  fmtModelTokens,
  type ModelPickerData,
  meterSegments,
  modelEffortLevels,
  modelGlyph,
  modelMeters,
  type PickerModel,
  placeModelMenu,
  type UiModelPicker,
} from './model-picker';

const ALL = ['low', 'medium', 'high', 'xhigh', 'max'];
const MODELS: PickerModel[] = [
  {
    id: 'opus',
    label: 'Opus 5.5 (1M)',
    short: 'opus[1m]',
    window: 1_000_000,
    autoCompactAt: 750_000,
    price: { input: 5, output: 25 },
    effortLevels: ALL,
  },
  {
    id: 'fable',
    label: 'Fable 5.1 (1M)',
    short: 'fable[1m]',
    window: 1_000_000,
    autoCompactAt: 750_000,
    price: { input: 10, output: 50 },
    effortLevels: ALL,
  },
  {
    id: 'sonnet',
    label: 'Sonnet 4.6 (1M)',
    short: 'sonnet[1m]',
    window: 1_000_000,
    autoCompactAt: 750_000,
    price: { input: 3, output: 15 },
    effortLevels: ['low', 'medium', 'high'],
  },
  {
    id: 'grok',
    label: 'Grok 4.6 (500K)',
    short: 'grok[1m]',
    window: 500_000,
    autoCompactAt: 450_000,
    price: null,
    effortLevels: ['low', 'high'],
  },
];
const BASE: ModelPickerData = { models: MODELS, value: { model: 'opus', effort: 'xhigh' } };
const XSS = '<img src=x onerror=alert(1)>';

function mount(data: ModelPickerData, attrs: Record<string, string> = {}): UiModelPicker {
  const el = document.createElement('ui-model-picker') as UiModelPicker;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiModelPicker, s: string) => el.shadowRoot!.querySelector<E>(s);
const qa = (el: UiModelPicker, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const key = (target: Element, k: string, init: KeyboardEventInit = {}) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...init }),
  );
const active = (el: UiModelPicker) => el.shadowRoot!.activeElement as HTMLElement | null;
const activeRow = (el: UiModelPicker) => {
  const id = q(el, '.mp-list')!.getAttribute('aria-activedescendant')!;
  return q(el, `#${id}`)!;
};

function openByKey(el: UiModelPicker): HTMLElement {
  const trig = q(el, '.mp-trigger')!;
  trig.focus();
  key(trig, 'ArrowDown');
  return q(el, '.mp-list')!;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('helpers', () => {
  it('fills 1–5 segments against the largest value, 0 when unknown', () => {
    expect(meterSegments(1_000_000, 1_000_000)).toBe(5);
    expect(meterSegments(500_000, 1_000_000)).toBe(3);
    expect(meterSegments(1, 1_000_000)).toBe(1);
    expect(meterSegments(0, 1_000_000)).toBe(0);
    expect(meterSegments(undefined, 1_000_000)).toBe(0);
    expect(meterSegments(5, 0)).toBe(0);
  });
  it('measures window · compaction · cost per model; host bars win; an unknown price draws no cost meter', () => {
    const m = modelMeters(MODELS);
    expect(m).toEqual([
      [5, 5, 3],
      [5, 5, 5],
      [5, 5, 2],
      [3, 3, 0],
    ]);
    expect(modelMeters([{ ...MODELS[0], bars: { cost: 1, window: 0 } }])[0]).toEqual([0, 5, 1]);
  });
  it('formats tokens and dollars the way the dashboard menu does', () => {
    expect(fmtModelTokens(1_000_000)).toBe('1.0M');
    expect(fmtModelTokens(450_000)).toBe('450.0K');
    expect(fmtModelTokens(950)).toBe('950');
    expect(fmtModelPrice(5)).toBe('$5');
    expect(fmtModelPrice(2.5)).toBe('$2.50');
    expect(fmtModelPrice(12.34, 25)).toBe('$12'); // a rolling value keeps its target's form
  });
  it('offers the model’s own levels, the standard five without a list, none for []', () => {
    expect(modelEffortLevels(MODELS[2])).toEqual(['low', 'medium', 'high']);
    expect(modelEffortLevels({ id: 'x', label: 'X' })).toEqual(ALL);
    expect(modelEffortLevels({ id: 'x', label: 'X', effortLevels: [] })).toEqual([]);
    expect(modelGlyph({ short: 'sol[1m]', label: 'GPT-5.6 Sol' })).toBe('S');
  });
  it('places the menu under the trigger, flips when there is no room, keeps 12px inside', () => {
    const r = { top: 100, bottom: 130, left: 40 };
    expect(placeModelMenu(r, 320, 400, 1200, 800)).toEqual({ left: 40, top: 136, side: 'bottom', maxHeight: 776 });
    expect(placeModelMenu({ top: 700, bottom: 730, left: 40 }, 320, 400, 1200, 800)).toEqual({
      left: 40,
      top: 294,
      side: 'top',
      maxHeight: 776,
    });
    expect(placeModelMenu({ top: 700, bottom: 730, left: 1100 }, 320, 400, 1200, 800).left).toBe(868);
    expect(placeModelMenu({ top: 700, bottom: 730, left: 40 }, 320, 400, 1200, 800, 'top').side).toBe('top');
    expect(placeModelMenu({ top: 60, bottom: 90, left: 40 }, 320, 400, 1200, 800, 'top').side).toBe('bottom');
  });
  it('gives the menu the larger side’s height (it scrolls) rather than covering the trigger', () => {
    expect(placeModelMenu({ top: 300, bottom: 330, left: 40 }, 320, 500, 1200, 600)).toEqual({
      left: 40,
      top: 12,
      side: 'top',
      maxHeight: 282,
    });
    // Under 180px of room on either side: it slides over the trigger, viewport-high at most.
    expect(placeModelMenu({ top: 120, bottom: 150, left: 40 }, 320, 500, 1200, 300)).toEqual({
      left: 40,
      top: 12,
      side: 'bottom',
      maxHeight: 276,
    });
  });
  it('counts only a layout move above 2px as moved', () => {
    expect(anchorMoved({ left: 10, top: 10 }, { left: 12, top: 11 })).toBe(false);
    expect(anchorMoved({ left: 10, top: 10 }, { left: 10, top: 14 })).toBe(true);
    expect(anchorMoved(null, { left: 0, top: 0 })).toBe(false);
  });
});

describe('<ui-model-picker>', () => {
  it('renders nothing without data', () => {
    const el = document.createElement('ui-model-picker') as UiModelPicker;
    document.body.append(el);
    el.renderNow();
    expect(q(el, '.mp-trigger')).toBeNull();
  });

  it('draws one trigger: avatar letter, model, “· effort”, chevron — closed and inert menu', () => {
    const el = mount(BASE);
    const trig = q(el, '.mp-trigger')!;
    expect(q(el, '.mp-trigger .mp-glyph')!.textContent).toBe('O');
    expect(q(el, '.mp-name')!.textContent).toBe('Opus 5.5 (1M)');
    expect(q(el, '.mp-level')!.textContent).toBe('· Extra high');
    expect(trig.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trig.getAttribute('aria-expanded')).toBe('false');
    expect(trig.getAttribute('aria-controls')).toBe('mp-menu');
    expect(trig.getAttribute('aria-label')).toBe('Model Opus 5.5 (1M), effort Extra high — change');
    expect(q(el, '#mp-menu')!.hasAttribute('inert')).toBe(true);
    expect(el.open).toBe(false);
  });

  it('lists every model with meters, ✓ on the current one, and a tray for it', () => {
    const el = mount(BASE);
    el.open = true;
    const rows = qa(el, '.mp-opt');
    expect(rows.map((r) => r.getAttribute('data-k'))).toEqual(['opus', 'fable', 'sonnet', 'grok']);
    expect(rows[0].getAttribute('aria-selected')).toBe('true');
    expect(rows[0].querySelector('.mp-check')).not.toBeNull();
    expect(rows[1].querySelector('.mp-check')).toBeNull();
    expect(rows[0].querySelector('.mp-desc')!.textContent).toBe('opus[1m] · autocompact 750.0K');
    expect(rows.map((r) => r.querySelectorAll('.mp-meter')[2].querySelectorAll('[data-on]').length)).toEqual([
      3, 5, 2, 0,
    ]);
    expect(rows[3].querySelectorAll('.mp-meter.is-none')).toHaveLength(1);
    expect(rows[0].getAttribute('aria-label')).toBe(
      'Opus 5.5 (1M), opus[1m] · autocompact 750.0K. window 1.0M, input $5 · output $25 per million tokens',
    );
    expect(q(el, '.mp-caption')!.textContent).toBe('Input $5 · Output $25 / M · window 1.0M');
    expect(qa(el, '.mp-keys kbd').map((k) => k.textContent)).toEqual(['↑↓', '↵']);
    expect(qa(el, '[aria-live]')).toHaveLength(1);
    expect(q(el, '.mp-head')!.getAttribute('aria-hidden')).toBe('true');
    expect(q(el, '.mp-pop')!.getAttribute('style') ?? '').not.toContain('NaN');
  });

  it('says “—” for an unknown price and never guesses one', () => {
    const el = mount({ ...BASE, value: { model: 'grok', effort: 'high' } });
    el.open = true;
    expect(q(el, '.mp-caption')!.textContent).toBe('Price — · window 500.0K');
    expect(q(el, '.mp-caption')!.textContent).not.toContain('$');
    expect(q(el, '.mp-sr')!.textContent).toBe('Grok 4.6 (500K): price unknown, window 500.0K');
  });

  it('escapes every model, user and host string', () => {
    const el = mount({
      models: [
        {
          id: XSS,
          label: XSS,
          short: XSS,
          window: 1000,
          price: { input: 1, output: 2 },
          effortLevels: [XSS, 'high'],
        },
      ],
      value: { model: `${XSS}-outside`, effort: XSS, effectiveEffort: 'high' },
      busy: { model: XSS },
      error: XSS,
      disabled: false,
    });
    el.open = true;
    el.data = { ...el.data!, value: { model: XSS, effort: XSS, effectiveEffort: XSS } };
    el.renderNow();
    expect(q(el, 'img')).toBeNull();
    expect(q(el, '.mp-name')!.textContent).toBe(XSS);
    expect(q(el, '.mp-title-name')!.textContent).toBe(XSS);
    expect(q(el, '.mp-desc')!.textContent).toContain(XSS);
    expect(q(el, '.mp-wait')!.textContent).toBe(XSS);
    expect(q(el, '.mp-err')!.textContent).toBe(XSS);
    expect(q(el, '.mp-seg-btn')!.textContent).toBe(XSS);
    expect(q(el, '.mp-opt')!.getAttribute('data-k')).toBe(XSS);
    const off = mount({ ...BASE, value: { model: XSS }, disabled: XSS, error: XSS });
    expect(off.shadowRoot!.querySelector('img')).toBeNull();
    expect(q(off, '#mp-why')!.textContent).toBe(XSS);
    expect(q(off, '.mp-trigger')!.getAttribute('title')).toBe(XSS);
    expect(q(off, '.mp-note.is-error')!.textContent).toBe(XSS);
  });

  it('opens from the trigger click and from ↓, focusing the list on the current model', () => {
    const el = mount(BASE);
    const changes = vi.fn();
    el.addEventListener('ui-open-change', (e) => changes((e as CustomEvent).detail));
    q(el, '.mp-trigger')!.click();
    expect(el.open).toBe(true);
    expect(el.hasAttribute('open')).toBe(true);
    expect(q(el, '.mp-trigger')!.getAttribute('aria-expanded')).toBe('true');
    expect(q(el, '#mp-menu')!.hasAttribute('inert')).toBe(false);
    expect(q(el, '#mp-menu')!.classList.contains('is-open')).toBe(true);
    expect(active(el)?.classList.contains('mp-list')).toBe(true);
    expect(activeRow(el).getAttribute('data-k')).toBe('opus');
    q(el, '.mp-trigger')!.click();
    expect(el.open).toBe(false);
    expect(changes.mock.calls.map((c) => c[0])).toEqual([{ open: true }, { open: false }]);

    const list = openByKey(el);
    expect(el.open).toBe(true);
    expect(active(el)).toBe(list);
  });

  it('moves with ↑ ↓ (wrapping) · Home · End and lights the active row', () => {
    const el = mount(BASE);
    const list = openByKey(el);
    key(list, 'ArrowDown');
    expect(activeRow(el).getAttribute('data-k')).toBe('fable');
    expect(q(el, '.mp-list')!.hasAttribute('data-pointing')).toBe(true);
    expect(activeRow(el).hasAttribute('data-lit')).toBe(true);
    expect(q(el, '.mp-caption')!.textContent).toContain('window 1.0M');
    key(list, 'ArrowUp');
    key(list, 'ArrowUp');
    expect(activeRow(el).getAttribute('data-k')).toBe('grok');
    key(list, 'Home');
    expect(activeRow(el).getAttribute('data-k')).toBe('opus');
    key(list, 'End');
    expect(activeRow(el).getAttribute('data-k')).toBe('grok');
    expect(q(el, '.mp-sr')!.textContent).toBe('Grok 4.6 (500K): price unknown, window 500.0K');
  });

  it('Enter picks the active model by id → ui-change, closes, focus back on the trigger', () => {
    const el = mount(BASE);
    const picked = vi.fn();
    el.addEventListener('ui-change', (e) => picked((e as CustomEvent).detail));
    const list = openByKey(el);
    key(list, 'ArrowDown');
    key(list, 'Enter');
    expect(picked).toHaveBeenCalledWith({ model: 'fable', effort: 'xhigh', changed: 'model' });
    expect(el.open).toBe(false);
    expect(active(el)?.classList.contains('mp-trigger')).toBe(true);
    // Not prevented: the picker shows the new model at once.
    expect(el.data!.value).toEqual({ model: 'fable', effort: 'xhigh' });
    el.renderNow();
    expect(q(el, '.mp-name')!.textContent).toBe('Fable 5.1 (1M)');
  });

  it('keeps busy/error the host set synchronously inside ui-change (review P2)', () => {
    const el = mount(BASE);
    el.addEventListener('ui-change', () => {
      el.data = { ...el.data!, busy: { model: 'Switching…' }, error: 'new host state' };
    });
    const list = openByKey(el);
    key(list, 'ArrowDown');
    key(list, 'Enter');
    expect(el.data!.value.model).toBe('fable');
    expect(el.data!.busy).toEqual({ model: 'Switching…' });
    expect(el.data!.error).toBe('new host state');
  });

  it('a value the host set inside ui-change wins over the optimistic one', () => {
    const el = mount(BASE);
    el.addEventListener('ui-change', () => {
      el.data = { ...el.data!, value: { model: 'opus', effort: 'max', effectiveEffort: 'high' } };
    });
    const list = openByKey(el);
    key(list, 'ArrowDown');
    key(list, 'Enter');
    expect(el.data!.value).toEqual({ model: 'opus', effort: 'max', effectiveEffort: 'high' });
  });

  it('keeps data.value when the host prevents ui-change', () => {
    const el = mount(BASE);
    el.addEventListener('ui-change', (e) => e.preventDefault());
    const list = openByKey(el);
    key(list, 'ArrowDown');
    key(list, 'Enter');
    expect(el.data!.value.model).toBe('opus');
  });

  it('remembers the pointed row by model, not by position', () => {
    const el = mount({ ...BASE, value: { model: 'haiku', effort: 'low' } });
    const picked = vi.fn();
    el.addEventListener('ui-change', (e) => picked((e as CustomEvent).detail));
    const list = openByKey(el);
    expect(qa(el, '.mp-opt')[0].getAttribute('aria-disabled')).toBe('true');
    expect(qa(el, '.mp-opt')[0].querySelector('.mp-desc')!.textContent).toBe('Current · not in the switch list');
    key(list, 'ArrowDown'); // opus (index 1)
    key(list, 'ArrowDown'); // fable (index 2)
    // The session moves to opus: the outside row leaves, every row shifts up by one.
    el.data = { ...el.data!, value: { model: 'opus', effort: 'low' } };
    el.renderNow();
    expect(activeRow(el).getAttribute('data-k')).toBe('fable');
    key(list, 'Enter');
    expect(picked).toHaveBeenCalledWith({ model: 'fable', effort: 'low', changed: 'model' });
  });

  it('closes on the current row without a change; a click picks by data-k', () => {
    const el = mount(BASE);
    const picked = vi.fn();
    el.addEventListener('ui-change', picked);
    let list = openByKey(el);
    key(list, ' ');
    expect(el.open).toBe(false);
    expect(picked).not.toHaveBeenCalled();
    list = openByKey(el);
    (q(el, '.mp-opt[data-k="sonnet"]') as HTMLElement).click();
    expect(picked).toHaveBeenCalledTimes(1);
    expect((picked.mock.calls[0][0] as CustomEvent).detail.model).toBe('sonnet');
  });

  it('Esc closes, returns focus to the trigger and stops there', () => {
    const el = mount(BASE);
    const outer = vi.fn();
    document.addEventListener('keydown', outer);
    const list = openByKey(el);
    outer.mockClear();
    key(list, 'Escape');
    expect(el.open).toBe(false);
    expect(active(el)?.classList.contains('mp-trigger')).toBe(true);
    expect(outer).not.toHaveBeenCalled();
    openByKey(el);
    outer.mockClear();
    key(list, 'n'); // a page shortcut never sees keys typed in the open menu
    expect(outer).not.toHaveBeenCalled();
    // Esc on the trigger of an open menu closes it and stops there too.
    q(el, '.mp-trigger')!.focus();
    key(q(el, '.mp-trigger')!, 'Escape');
    expect(el.open).toBe(false);
    expect(outer).not.toHaveBeenCalled();
    document.removeEventListener('keydown', outer);
  });

  it('Tab: list → checked level, Shift+Tab back; past either end the menu closes onto the trigger (D9)', () => {
    const el = mount(BASE);
    const changes = vi.fn();
    el.addEventListener('ui-open-change', (e) => changes((e as CustomEvent).detail.open));
    let list = openByKey(el);
    key(list, 'Tab');
    expect(active(el)?.getAttribute('data-effort')).toBe('xhigh');
    key(active(el)!, 'Tab', { shiftKey: true });
    expect(active(el)).toBe(list);
    expect(el.open).toBe(true);
    // Tab past the level: home.
    key(list, 'Tab');
    key(active(el)!, 'Tab');
    expect(el.open).toBe(false);
    expect(active(el)?.classList.contains('mp-trigger')).toBe(true);
    // Shift+Tab past the list: home.
    list = openByKey(el);
    key(list, 'Tab', { shiftKey: true });
    expect(el.open).toBe(false);
    expect(active(el)?.classList.contains('mp-trigger')).toBe(true);
    expect(changes.mock.calls.map((c) => c[0])).toEqual([true, false, true, false]);
    // A later Esc on the trigger stops there (nothing open to close, no outer handler confused).
    const outer = vi.fn();
    document.addEventListener('keydown', outer);
    key(q(el, '.mp-trigger')!, 'Escape');
    document.removeEventListener('keydown', outer);
    expect(outer).toHaveBeenCalledTimes(1);
  });

  it('Tab from the list goes home when the model has no effort levels', () => {
    const el = mount({ ...BASE, value: { model: 'opus', effort: 'high', effortLevels: [] } });
    const list = openByKey(el);
    expect(q(el, '.mp-seg-ctl')).toBeNull();
    key(list, 'Tab');
    expect(el.open).toBe(false);
    expect(active(el)?.classList.contains('mp-trigger')).toBe(true);
  });

  it('value.effortLevels: the session model’s own levels win over the row’s, also outside the list', () => {
    // Opus lists all five, but the session's catalog entry says it runs three.
    const el = mount({ ...BASE, value: { model: 'opus', effort: 'high', effortLevels: ['low', 'medium', 'high'] } });
    el.open = true;
    const levels = () => qa(el, '.mp-seg-btn').map((b) => b.getAttribute('data-effort'));
    expect(levels()).toEqual(['low', 'medium', 'high']);
    // Outside the list: without effortLevels the standard five, with them only those (deduped).
    el.data = { ...BASE, value: { model: 'claude-haiku-4-5', effort: 'low' } };
    el.renderNow();
    expect(levels()).toEqual(ALL);
    el.data = { ...BASE, value: { model: 'claude-haiku-4-5', effort: 'low', effortLevels: ['low', 'high', 'low'] } };
    el.renderNow();
    expect(levels()).toEqual(['low', 'high']);
    // An optimistic effort pick keeps them; a model switch drops them (the new model brings its own).
    const btn = q(el, '.mp-seg-btn[data-effort="high"]')!;
    btn.click();
    el.renderNow();
    expect(el.data!.value).toEqual({ model: 'claude-haiku-4-5', effort: 'high', effortLevels: ['low', 'high', 'low'] });
    expect(levels()).toEqual(['low', 'high']);
    el.data = { ...BASE, value: { model: 'opus', effort: 'high', effortLevels: ['low', 'high'] } };
    el.renderNow();
    (q(el, '.mp-opt[data-k="sonnet"]') as HTMLElement).click();
    expect(el.data!.value).toEqual({ model: 'sonnet', effort: 'high' });
    el.open = true;
    expect(levels()).toEqual(['low', 'medium', 'high']);
  });

  it('offers only the levels the model runs; arrows select at once and keep the menu open', () => {
    const el = mount({ ...BASE, value: { model: 'sonnet', effort: 'max', effectiveEffort: 'high' } });
    const picked = vi.fn();
    el.addEventListener('ui-change', (e) => picked((e as CustomEvent).detail));
    el.open = true;
    const btns = qa(el, '.mp-seg-btn');
    expect(btns.map((b) => b.getAttribute('data-effort'))).toEqual(['low', 'medium', 'high']);
    expect(btns.map((b) => b.getAttribute('tabindex'))).toEqual(['-1', '-1', '0']);
    expect(btns[2].getAttribute('aria-checked')).toBe('true');
    expect(q(el, '.mp-effort-cap')!.textContent).toBe('Set Max → this model runs High');
    expect(q(el, '.mp-level')!.textContent).toBe('· High');
    btns[2].focus();
    key(btns[2], 'ArrowLeft');
    expect(picked).toHaveBeenCalledWith({ model: 'sonnet', effort: 'medium', changed: 'effort' });
    expect(el.open).toBe(true);
    el.renderNow();
    expect(q(el, '.mp-seg-btn[data-effort="medium"]')!.getAttribute('aria-checked')).toBe('true');
    expect(q(el, '.mp-effort-cap')).toBeNull();
    expect(active(el)?.getAttribute('data-effort')).toBe('medium');
    key(active(el)!, 'End');
    expect(picked).toHaveBeenLastCalledWith({ model: 'sonnet', effort: 'high', changed: 'effort' });
  });

  it('locks rows while a model write runs and levels while an effort write runs', () => {
    const el = mount({ ...BASE, busy: { model: true, effort: true } });
    const picked = vi.fn();
    el.addEventListener('ui-change', picked);
    const list = openByKey(el);
    expect(q(el, '.mp-wait')!.textContent).toBe('Switching model…');
    expect(list.getAttribute('aria-disabled')).toBe('true');
    expect(q(el, '.mp-trigger')!.getAttribute('aria-busy')).toBe('true');
    key(list, 'ArrowDown');
    key(list, 'Enter');
    expect(el.open).toBe(true);
    const radios = q(el, '.mp-seg-ctl')!;
    expect(radios.getAttribute('aria-disabled')).toBe('true');
    key(q(el, '.mp-seg-btn')!, 'ArrowRight');
    (q(el, '.mp-seg-btn[data-effort="low"]') as HTMLElement).click();
    expect(picked).not.toHaveBeenCalled();
  });

  it('marks a row whose auto-compact point is below the context as switching after compaction', () => {
    const el = mount({ ...BASE, contextTokens: 520_000 });
    expect(q(el, '.mp-opt[data-k="grok"] .mp-desc')!.textContent).toBe(
      'grok[1m] · autocompact 450.0K · switches after compaction',
    );
    expect(q(el, '.mp-opt[data-k="fable"] .mp-desc')!.textContent).not.toContain('after compaction');
  });

  it('announces an error: in the open menu, else under the trigger', () => {
    const el = mount({ ...BASE, error: 'Switch refused (HTTP 409)' });
    expect(q(el, '.mp-note.is-error')!.getAttribute('role')).toBe('alert');
    expect(q(el, '.mp-note.is-error')!.textContent).toBe('Switch refused (HTTP 409)');
    el.open = true;
    expect(q(el, '.mp-err')!.getAttribute('role')).toBe('alert');
    expect(q(el, '.mp-err')!.textContent).toBe('Switch refused (HTTP 409)');
    expect(q(el, '.mp-note.is-error')!.textContent).toBe('');
  });

  it('read-only: the trigger stays focusable with its reason and never opens', () => {
    const el = mount({ ...BASE, disabled: 'Read-only — not your session' });
    const trig = q(el, '.mp-trigger')!;
    expect(trig.getAttribute('aria-disabled')).toBe('true');
    expect(trig.getAttribute('aria-describedby')).toBe('mp-why');
    trig.click();
    key(trig, 'ArrowDown');
    el.open = true;
    el.setAttribute('open', '');
    expect(el.open).toBe(false);
    expect(el.hasAttribute('open')).toBe(false);
  });

  it('a press outside closes it; a press inside does not', () => {
    const el = mount(BASE);
    openByKey(el);
    q(el, '.mp-opt')!.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    expect(el.open).toBe(true);
    const out = document.createElement('button');
    document.body.append(out);
    out.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    expect(el.open).toBe(false);
  });

  it('the open attribute and property stay in step; programmatic open does not move focus or emit', () => {
    const el = mount(BASE);
    const changes = vi.fn();
    el.addEventListener('ui-open-change', changes);
    el.setAttribute('open', '');
    expect(el.open).toBe(true);
    expect(active(el)).toBeNull();
    el.open = false;
    expect(el.hasAttribute('open')).toBe(false);
    expect(changes).not.toHaveBeenCalled();
  });

  it('leaves no timer or listener running after disconnect', () => {
    const clear = vi.spyOn(globalThis, 'clearInterval');
    const remove = vi.spyOn(document, 'removeEventListener');
    const el = mount(BASE);
    el.open = true;
    el.remove();
    expect(clear).toHaveBeenCalled();
    expect(remove.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining(['pointerdown', 'focusin', 'scroll']));
    clear.mockRestore();
    remove.mockRestore();
  });

  it('speaks Korean with lang="ko"', () => {
    const el = mount(BASE, { lang: 'ko' });
    el.open = true;
    expect(q(el, '.mp-head-t')!.textContent).toBe('이 세션 모델');
    expect(qa(el, '.mp-cols span').map((s) => s.textContent)).toEqual(['창', '압축', '비용']);
    expect(q(el, '.mp-caption')!.textContent).toBe('입력 $5 · 출력 $25 / M · 창 1.0M');
    expect(q(el, '.mp-trigger')!.getAttribute('aria-label')).toBe('모델 Opus 5.5 (1M), effort Extra high — 바꾸기');
    expect(q(el, '#mp-menu')!.getAttribute('aria-label')).toBe('이 세션의 모델 · effort');
    el.data = { ...BASE, value: { model: 'grok', effort: 'high' }, contextTokens: 800_000 };
    el.renderNow();
    expect(q(el, '.mp-caption')!.textContent).toBe('가격 정보 없음 · 창 500.0K');
    expect(q(el, '.mp-opt[data-k="opus"] .mp-desc')!.textContent).toContain('compact 후 전환');
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    spy = soundSpy();
  });
  afterEach(() => spy.restore());
  const click = (b: Element | null | undefined) =>
    b?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail: 1 }));

  it('the user opening plays select, closing a subtle close — by click, arrow, Esc or a press outside', async () => {
    const el = mount(BASE);
    click(q(el, '.mp-trigger'));
    await spy.settle();
    click(q(el, '.mp-trigger'));
    await spy.settle();
    const list = openByKey(el);
    await spy.settle();
    key(list, 'Escape');
    await spy.settle();
    openByKey(el);
    await spy.settle();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    await spy.settle();
    expect(el.open).toBe(false);
    expect(spy.calls).toEqual([
      ['select', { input: 'mouse' }],
      ['close', { emphasis: 'subtle', input: 'mouse' }],
      ['select', { input: 'keyboard' }],
      ['close', { emphasis: 'subtle', input: 'keyboard' }],
      ['select', { input: 'keyboard' }],
      ['close', { emphasis: 'subtle', input: 'mouse' }],
    ]);
  });

  it('a model change plays select (back when it moves up the list); the current row only closes', async () => {
    const el = mount(BASE);
    openByKey(el);
    await spy.settle();
    click(q(el, '.mp-opt[data-k="sonnet"]'));
    await spy.settle();
    openByKey(el);
    await spy.settle();
    click(q(el, '.mp-opt[data-k="opus"]'));
    await spy.settle();
    const list = openByKey(el);
    await spy.settle();
    key(list, ' ');
    await spy.settle();
    const open = ['select', { input: 'keyboard' }];
    expect(spy.calls).toEqual([
      open,
      ['select', { direction: 'forward', input: 'mouse' }],
      open,
      ['select', { direction: 'back', input: 'mouse' }],
      open,
      ['close', { emphasis: 'subtle', input: 'keyboard' }],
    ]);
  });

  it('an effort change plays select by its direction; a prevented ui-change is silent', async () => {
    const el = mount({ ...BASE, value: { model: 'sonnet', effort: 'high' } });
    el.open = true;
    const high = q(el, '.mp-seg-btn[data-effort="high"]')!;
    high.focus();
    key(high, 'ArrowLeft');
    await spy.settle();
    key(active(el)!, 'End');
    await spy.settle();
    expect(spy.calls).toEqual([
      ['select', { direction: 'back', input: 'keyboard' }],
      ['select', { direction: 'forward', input: 'keyboard' }],
    ]);
    el.addEventListener('ui-change', (e) => e.preventDefault());
    click(q(el, '.mp-seg-btn[data-effort="low"]'));
    click(q(el, '.mp-opt[data-k="grok"]'));
    await spy.settle();
    expect(spy.calls).toHaveLength(2);
  });

  it('data and a programmatic open are silent, and so is a picker inside data-ui-sound="off"', async () => {
    const el = mount(BASE);
    el.data = { ...BASE, value: { model: 'fable', effort: 'high' } };
    el.open = true;
    el.setAttribute('open', '');
    el.open = false;
    await spy.settle();
    expect(spy.calls).toEqual([]);
    const quiet = document.createElement('div');
    quiet.setAttribute('data-ui-sound', 'off');
    document.body.append(quiet);
    quiet.append(el);
    click(q(el, '.mp-trigger'));
    click(q(el, '.mp-opt[data-k="sonnet"]'));
    await spy.settle();
    expect(spy.calls).toEqual([]);
  });
});
