import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CELLS, cellMap, contextLevel, markIndex, type UiContextWindow } from './context-window';

function mount(data: UiContextWindow['data'], attrs: Record<string, string> = {}): UiContextWindow {
  const el = document.createElement('ui-context-window') as UiContextWindow;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = (el: UiContextWindow, s: string) => el.shadowRoot!.querySelector(s);
const qa = (el: UiContextWindow, s: string) => Array.from(el.shadowRoot!.querySelectorAll(s));

const BASE = {
  window: 1_000_000,
  parts: { cacheRead: 272_300, cacheWrite: 470, input: 2, output: 10 },
  autoCompactAt: 750_000,
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('cell math', () => {
  it('maps parts in prompt order, every non-empty part at least one cell', () => {
    const map = cellMap([{ tokens: 500 }, { tokens: 1 }, { tokens: 1 }], 1000, 10);
    expect(map).toEqual([0, 0, 0, 0, 0, 1, 2, -1, -1, -1]);
  });
  it('fills every cell past the window', () => {
    expect(cellMap([{ tokens: 2000 }], 1000, 10).every((i) => i === 0)).toBe(true);
  });
  it('places the auto-compact mark inside the window only', () => {
    expect(markIndex(750, 1000, 216)).toBe(162);
    expect(markIndex(1000, 1000)).toBe(-1);
    expect(markIndex(0, 1000)).toBe(-1);
  });
  it('measures the level against the auto-compact point', () => {
    expect(contextLevel(500, 1000, 750)).toBe('ok');
    expect(contextLevel(600, 1000, 750)).toBe('warn');
    expect(contextLevel(720, 1000, 750)).toBe('full');
    expect(contextLevel(10, 1000, 750, true)).toBe('full');
    expect(contextLevel(700, 1000)).toBe('warn');
  });
});

describe('<ui-context-window>', () => {
  it('renders nothing without a window', () => {
    const el = mount({ window: 0 });
    expect(q(el, '.cw')).toBeNull();
  });

  it('draws 216 cells, the parts list and the mark row', () => {
    const el = mount(BASE);
    expect(qa(el, '.cw-cell')).toHaveLength(CELLS);
    expect(qa(el, '.cw-part').map((r) => r.getAttribute('data-part'))).toEqual(['read', 'write', 'input', 'output']);
    expect(q(el, '.cw-mark')?.textContent).toContain('750K');
    expect(qa(el, '.cw-cell[data-past]').length).toBe(CELLS - markIndex(750_000, 1_000_000));
    expect(q(el, '.cw')?.getAttribute('data-level')).toBe('ok');
    expect(q(el, '.cw-pill')?.textContent).toBe('27%');
  });

  it('escapes the model id', () => {
    const el = mount({ ...BASE, model: '<img src=x onerror=alert(1)>' });
    expect(q(el, '.cw-model')?.innerHTML).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(q(el, 'img')).toBeNull();
  });

  it('hides the action unless canCompact, and disables it with a reason string', () => {
    expect(q(mount(BASE), '.cw-compact')).toBeNull();
    const off = mount({ ...BASE, canCompact: 'Read-only — not your session' });
    const b = q(off, '.cw-compact') as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.title).toBe('Read-only — not your session');
  });

  it('needs two presses within 4s to emit ui-compact; Esc disarms', () => {
    const el = mount({ ...BASE, canCompact: true });
    const fired = vi.fn();
    el.addEventListener('ui-compact', fired);
    (q(el, '.cw-compact') as HTMLButtonElement).click();
    el.renderNow();
    expect(q(el, '.cw-compact')?.getAttribute('data-state')).toBe('armed');
    expect(fired).not.toHaveBeenCalled();
    q(el, '.cw-compact')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    el.renderNow();
    expect(q(el, '.cw-compact')?.getAttribute('data-state')).toBe('idle');
    (q(el, '.cw-compact') as HTMLButtonElement).click();
    el.renderNow();
    (q(el, '.cw-compact') as HTMLButtonElement).click();
    expect(fired).toHaveBeenCalledTimes(1);
  });

  it('shows the saved amount once a compaction is observed', () => {
    const el = mount({
      ...BASE,
      unsplit: { tokens: 41_200, kind: 'compact' },
      compactState: 'observed',
      lastCompact: { preTokens: 742_000, postTokens: 41_200 },
    });
    expect(q(el, '.cw-say-t')?.textContent).toContain('saved 700.8K');
    expect(qa(el, '.cw-part')).toHaveLength(1);
  });

  it('speaks Korean with lang="ko"', () => {
    const el = mount(BASE, { lang: 'ko' });
    expect(q(el, '.cw-title')?.textContent).toBe('컨텍스트');
    expect(q(el, '.cw-say-t')?.textContent).toContain('자동 압축까지');
  });
});
