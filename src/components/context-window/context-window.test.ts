import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import tokens from '../../core/tokens.json';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import { CELLS, cellMap, contextLevel, LEAVE_MS, markIndex, type UiContextWindow } from './context-window';
import { styles } from './styles';

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

  it('says “timeout” in the fail tone, announces it, and lets the action be pressed again', () => {
    const el = mount({ ...BASE, canCompact: true, compactState: 'timeout' });
    const say = q(el, '.cw-say-t');
    expect(say?.textContent).toBe('No compaction result yet');
    expect(say?.classList.contains('is-fail')).toBe(true);
    expect(q(el, '.cw-live')?.textContent).toBe('No compaction result yet');
    const b = q(el, '.cw-compact') as HTMLButtonElement;
    expect(b.getAttribute('data-state')).toBe('idle');
    expect(b.disabled).toBe(false);
    const ko = mount({ ...BASE, compactState: 'timeout' }, { lang: 'ko' });
    expect(q(ko, '.cw-say-t')?.textContent).toBe('압축 결과를 아직 받지 못함');
  });
});

describe('<ui-context-window> host gaps', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears the hover when the pointer leaves the element (pointerleave does not bubble to the shadow root)', () => {
    const el = mount(BASE);
    const cell = q(el, '.cw-cell[data-part="read"]')!;
    cell.dispatchEvent(new PointerEvent('pointerover', { pointerType: 'mouse', bubbles: true, composed: true }));
    expect(q(el, '.cw-field')?.hasAttribute('data-hot')).toBe(true);
    expect(q(el, '.cw-part[data-part="read"]')?.hasAttribute('data-hot')).toBe(true);
    el.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    expect(q(el, '.cw-field')?.hasAttribute('data-hot')).toBe(false);
    expect(q(el, '.cw-part[data-hot]')).toBeNull();
    expect(q(el, '.cw-of')?.textContent).toBe('/ 1M tokens');
  });

  it('disarms when focus leaves the armed button, so a later press only arms again', () => {
    const el = mount({ ...BASE, canCompact: true });
    const fired = vi.fn();
    el.addEventListener('ui-compact', fired);
    const b = q(el, '.cw-compact') as HTMLButtonElement;
    b.focus();
    b.click();
    el.renderNow();
    expect(q(el, '.cw-compact')?.getAttribute('data-state')).toBe('armed');
    q(el, '.cw-compact')!.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, composed: true, relatedTarget: document.body }),
    );
    el.renderNow();
    expect(q(el, '.cw-compact')?.getAttribute('data-state')).toBe('idle');
    (q(el, '.cw-compact') as HTMLButtonElement).click();
    expect(fired).not.toHaveBeenCalled();
  });

  it('keeps the armed state when focus moves within the button itself', () => {
    const el = mount({ ...BASE, canCompact: true });
    const b = q(el, '.cw-compact') as HTMLButtonElement;
    b.click();
    el.renderNow();
    b.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true, relatedTarget: b }));
    el.renderNow();
    expect(q(el, '.cw-compact')?.getAttribute('data-state')).toBe('armed');
  });

  it('lets the done button leave for 400 ms (data-leaving) before it disappears', () => {
    vi.useFakeTimers();
    const el = mount({ ...BASE, canCompact: true, compactState: 'observed' });
    const done = q(el, '.cw-compact')!;
    expect(done.getAttribute('data-state')).toBe('done');
    el.data = { ...BASE, canCompact: false, compactState: 'idle' };
    el.renderNow();
    const leaving = q(el, '.cw-compact')!;
    expect(leaving).toBe(done);
    expect(leaving.hasAttribute('data-leaving')).toBe(true);
    expect((leaving as HTMLButtonElement).disabled).toBe(true);
    vi.advanceTimersByTime(LEAVE_MS);
    el.renderNow();
    expect(q(el, '.cw-compact')).toBeNull();
  });

  it('does not replay the exit when a done element is detached and re-attached with idle data (R-041 P3)', () => {
    vi.useFakeTimers();
    const el = mount({ ...BASE, canCompact: true, compactState: 'observed' });
    expect(q(el, '.cw-compact')?.getAttribute('data-state')).toBe('done');
    el.remove();
    el.data = { ...BASE, canCompact: true, compactState: 'idle' };
    document.body.append(el);
    el.renderNow();
    const b = q(el, '.cw-compact')!;
    expect(b.hasAttribute('data-leaving')).toBe(false);
    expect(b.getAttribute('data-state')).toBe('idle');
  });

  it('leaves, then shows the idle action when it may compact again', () => {
    vi.useFakeTimers();
    const el = mount({ ...BASE, canCompact: true, compactState: 'observed' });
    el.data = { ...BASE, canCompact: true, compactState: 'idle' };
    el.renderNow();
    expect(q(el, '.cw-compact')?.hasAttribute('data-leaving')).toBe(true);
    // A same-state update during the exit does not restart it.
    el.data = { ...BASE, canCompact: true, compactState: 'idle', model: 'x' };
    el.renderNow();
    vi.advanceTimersByTime(LEAVE_MS);
    el.renderNow();
    const b = q(el, '.cw-compact')!;
    expect(b.hasAttribute('data-leaving')).toBe(false);
    expect(b.getAttribute('data-state')).toBe('idle');
  });

  it('renders in place: a same-state usage update keeps the tray line, the live node and the cells', () => {
    const el = mount({ ...BASE, canCompact: true });
    const say = q(el, '.cw-say-t');
    const live = q(el, '.cw-live');
    const cell = q(el, '.cw-cell');
    const btn = q(el, '.cw-compact');
    const label = q(el, '.cw-ct');
    el.data = { ...BASE, canCompact: true, parts: { ...BASE.parts, cacheRead: 300_000 } };
    el.renderNow();
    expect(q(el, '.cw-say-t')).toBe(say);
    expect(say?.textContent).toContain('until auto-compact');
    expect(q(el, '.cw-live')).toBe(live);
    expect(q(el, '.cw-cell')).toBe(cell);
    expect(q(el, '.cw-compact')).toBe(btn);
    expect(q(el, '.cw-ct')).toBe(label);
    expect(q(el, '.cw-big')?.getAttribute('data-to')).toBe('300482');
  });

  it('swaps the tray line and the button label in only when their state changes; the live node stays', () => {
    const el = mount({ ...BASE, canCompact: true });
    const say = q(el, '.cw-say-t');
    const live = q(el, '.cw-live');
    const btn = q(el, '.cw-compact') as HTMLButtonElement;
    const label = q(el, '.cw-ct');
    btn.click();
    el.renderNow();
    expect(q(el, '.cw-say-t')).not.toBe(say);
    expect(q(el, '.cw-say-t')?.getAttribute('data-mk')).toBe('say-armed');
    expect(q(el, '.cw-ct')).not.toBe(label);
    expect(q(el, '.cw-compact')).toBe(btn);
    expect(q(el, '.cw-live')).toBe(live);
    expect(live?.textContent).toContain('Press again to compact');
  });

  it('keeps warn text at ≥4.5:1 in light, on the surface and on the warn tint', () => {
    const m = /--cw-warn: color-mix\(in srgb, var\(--st-wait\) (\d+)%, var\(--text\)\)/.exec(styles);
    expect(m).not.toBeNull();
    const pct = Number(m![1]) / 100;
    const rgb = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
    const mix = (a: number[], b: number[], p: number) => a.map((v, i) => v * p + b[i] * (1 - p));
    const lum = (c: number[]) => {
      const [r, g, b] = c.map((v) => {
        const s = v / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: number[], b: number[]) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q2) => q2 - p);
      return (x + 0.05) / (y + 0.05);
    };
    const L = tokens.light;
    const warn = mix(rgb(L['st-wait']), rgb(L.text), pct);
    const surface = rgb(L.surface);
    const tint = mix(rgb(L['st-wait']), surface, 0.14);
    expect(ratio(warn, surface)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(warn, tint)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(warn, rgb(L['surface-raised']))).toBeGreaterThanOrEqual(4.5);
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

  it('compact: the arming press taps subtly, the confirming press taps', async () => {
    const el = mount({ ...BASE, canCompact: true });
    click(q(el, '.cw-compact'));
    await spy.settle();
    el.renderNow();
    click(q(el, '.cw-compact'));
    await spy.settle();
    expect(spy.calls).toEqual([
      ['tap', { emphasis: 'subtle', input: 'mouse' }],
      ['tap', { input: 'mouse' }],
    ]);
  });

  it('a prevented ui-compact plays only the arming tap; a locked action is silent', async () => {
    const el = mount({ ...BASE, canCompact: true });
    el.addEventListener('ui-compact', (e) => e.preventDefault());
    click(q(el, '.cw-compact'));
    await spy.settle();
    click(q(el, '.cw-compact'));
    await spy.settle();
    expect(spy.calls).toEqual([['tap', { emphasis: 'subtle', input: 'mouse' }]]);
    const off = mount({ ...BASE, canCompact: 'Only the owner can compact' });
    click(q(off, '.cw-compact'));
    await spy.settle();
    expect(spy.calls).toHaveLength(1);
  });

  it('el.data from code is silent, and so is a meter inside data-ui-sound="off"', async () => {
    const el = mount({ ...BASE, canCompact: true });
    el.data = { ...BASE, canCompact: true, compactState: 'observed', unsplit: { tokens: 41_200, kind: 'compact' } };
    el.renderNow();
    await spy.settle();
    expect(spy.calls).toEqual([]);
    const quiet = document.createElement('div');
    quiet.setAttribute('data-ui-sound', 'off');
    document.body.append(quiet);
    const muted = document.createElement('ui-context-window') as UiContextWindow;
    quiet.append(muted);
    muted.data = { ...BASE, canCompact: true };
    muted.renderNow();
    click(q(muted, '.cw-compact'));
    click(q(muted, '.cw-compact'));
    await spy.settle();
    expect(spy.calls).toEqual([]);
  });
});
