import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import { doc } from './docs';
import { styles } from './styles';
import {
  UiWorking,
  type WorkingData,
  type WorkingState,
  workingState,
  workingTicks,
  workingTime,
  workingWords,
} from './working';

const NOW = Date.UTC(2026, 10, 5, 5, 0, 0);
const XSS = '<img src=x onerror=alert(1)>';

const RUN: WorkingData = {
  state: 'working',
  label: 'Reading src/conversation/dashboard.ts',
  since: NOW - 42_000,
  detail: '12.4k tokens',
};

function mount(data: WorkingData | undefined, attrs: Record<string, string> = {}): UiWorking {
  const el = document.createElement('ui-working') as UiWorking;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiWorking, s: string) => el.shadowRoot!.querySelector<E>(s);
const qa = (el: UiWorking, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const text = (el: UiWorking, s: string) => q(el, s)?.textContent ?? null;
const said = (el: UiWorking) => text(el, '.wk-said');
const set = (el: UiWorking, data: WorkingData) => {
  el.data = data;
  el.renderNow();
};
const reduce = () =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query }));

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('pure helpers', () => {
  it('workingState: the five states; anything else reads idle', () => {
    for (const s of ['working', 'waiting', 'done', 'failed', 'idle']) expect(workingState(s)).toBe(s);
    expect(workingState('stopped')).toBe('idle');
    expect(workingState('')).toBe('idle');
    expect(workingState(undefined)).toBe('idle');
    expect(workingState(3)).toBe('idle');
  });

  it('workingWords: “<state>: <label>”, the word alone without a label, en and ko', () => {
    expect(workingWords('working', 'Reading dashboard.ts')).toBe('Working: Reading dashboard.ts');
    expect(workingWords('waiting', '  ')).toBe('Needs you');
    expect(workingWords('done')).toBe('Done');
    expect(workingWords('failed', 'npm test')).toBe('Failed: npm test');
    expect(workingWords('idle')).toBe('Idle');
    expect(workingWords('nope')).toBe('Idle');
    expect(workingWords('working', 'dashboard.ts 읽는 중', 'ko')).toBe('작업 중: dashboard.ts 읽는 중');
    expect(['waiting', 'done', 'failed', 'idle'].map((s) => workingWords(s, '', 'ko'))).toEqual([
      '확인 필요',
      '완료',
      '실패',
      '대기',
    ]);
  });

  it('workingTime: a live span while working / waiting; “Done in” / “Failed after” once ended; none idle', () => {
    expect(workingTime('working', NOW - 42_000, undefined, NOW)).toBe('42s');
    expect(workingTime('waiting', NOW - 252_000, undefined, NOW)).toBe('4m 12s');
    expect(workingTime('working', NOW - 3_720_000, undefined, NOW)).toBe('1h 02m');
    expect(workingTime('working', NOW - 252_000, undefined, NOW, 'ko')).toBe('4분 12초');
    // An end stops a working span.
    expect(workingTime('working', NOW - 252_000, NOW - 200_000, NOW)).toBe('52s');
    expect(workingTime('done', NOW - 252_000, NOW, NOW + 99_000)).toBe('Done in 4m 12s');
    expect(workingTime('done', NOW - 252_000, NOW, NOW, 'ko')).toBe('4분 12초 만에 완료');
    expect(workingTime('failed', NOW - 63_000, NOW, NOW)).toBe('Failed after 1m 03s');
    expect(workingTime('failed', NOW - 63_000, NOW, NOW, 'ko')).toBe('1분 03초 후 실패');
    // Done and failed need both ends; idle never has a time; nothing without a start.
    expect(workingTime('done', NOW - 252_000, undefined, NOW)).toBe('');
    expect(workingTime('idle', NOW - 252_000, NOW, NOW)).toBe('');
    expect(workingTime('working', undefined, undefined, NOW)).toBe('');
    expect(workingTime('working', 'soon', undefined, NOW)).toBe('');
    // ISO strings and numeric strings.
    expect(workingTime('working', new Date(NOW - 42_000).toISOString(), undefined, NOW)).toBe('42s');
    expect(workingTime('working', String(NOW - 42_000), undefined, NOW)).toBe('42s');
    expect(workingTime('done', new Date(NOW - 252_000).toISOString(), new Date(NOW).toISOString(), NOW)).toBe(
      'Done in 4m 12s',
    );
    // A clock that ran backwards reads 0s.
    expect(workingTime('working', NOW + 5_000, undefined, NOW)).toBe('0s');
  });

  it('workingTicks: working or waiting, a start, no end', () => {
    expect(workingTicks('working', NOW, undefined)).toBe(true);
    expect(workingTicks('waiting', String(NOW), undefined)).toBe(true);
    expect(workingTicks('working', NOW, NOW + 1)).toBe(false);
    expect(workingTicks('working', undefined, undefined)).toBe(false);
    expect(workingTicks('done', NOW, undefined)).toBe(false);
    expect(workingTicks('failed', NOW, undefined)).toBe(false);
    expect(workingTicks('idle', NOW, undefined)).toBe(false);
  });
});

describe('rendering', () => {
  it('one line: mark · label · time · detail; the line is aria-hidden and the host is role="status"', () => {
    const el = mount(RUN);
    expect(el.getAttribute('role')).toBe('status');
    const line = q(el, '.wk')!;
    expect(line.getAttribute('aria-hidden')).toBe('true');
    expect(line.dataset.state).toBe('working');
    expect(Array.from(line.children).map((c) => c.className)).toEqual(['wk-mark', 'wk-label', 'wk-time', 'wk-detail']);
    expect(text(el, '.wk-now')).toBe('Reading src/conversation/dashboard.ts');
    expect(text(el, '.wk-time')).toBe('42s');
    expect(text(el, '.wk-detail')).toBe('12.4k tokens');
    expect(q(el, '.wk-time')!.hasAttribute('data-sep')).toBe(true);
    expect(q(el, '.wk-detail')!.hasAttribute('data-sep')).toBe(true);
    expect(said(el)).toBe('Working: Reading src/conversation/dashboard.ts');
    // The said text is the one thing outside the hidden line.
    expect(q(el, '.wk-said')!.className).toBe('wk-said sr-only');
  });

  it('keeps a role the page gave it', () => {
    const el = mount(RUN, { role: 'none' });
    expect(el.getAttribute('role')).toBe('none');
  });

  it('each state has its mark and its words', () => {
    const cases: Array<[WorkingState, string, string]> = [
      ['working', '.wk-ring', 'Working: Fix login'],
      ['waiting', '.wk-dot', 'Needs you: Fix login'],
      ['done', 'svg[data-icon="check"]', 'Done: Fix login, Done in 4m 12s'],
      ['failed', 'svg[data-icon="cross"]', 'Failed: Fix login, Failed after 4m 12s'],
      ['idle', '.wk-dot', 'Idle: Fix login'],
    ];
    for (const [state, mark, words] of cases) {
      const el = mount({ state, label: 'Fix login', since: NOW - 252_000, until: NOW });
      expect(q(el, '.wk')!.dataset.state).toBe(state);
      expect(q(el, `.wk-mark ${mark}`)).not.toBeNull();
      expect(qa(el, '.wk-mark > *').length).toBe(1);
      expect(said(el)).toBe(words);
      el.remove();
    }
  });

  it('done and failed say their time; without a label the time stands alone (no “Done · Done in”)', () => {
    const el = mount({ state: 'done', label: 'Opened PR #27', since: NOW - 252_000, until: NOW });
    expect(text(el, '.wk-time')).toBe('Done in 4m 12s');
    set(el, { state: 'done', since: NOW - 252_000, until: NOW });
    expect(q(el, '.wk-label')).toBeNull();
    expect(text(el, '.wk-time')).toBe('Done in 4m 12s');
    expect(q(el, '.wk-time')!.hasAttribute('data-sep')).toBe(false);
    expect(said(el)).toBe('Done in 4m 12s');
    set(el, { state: 'failed', since: NOW - 63_000, until: NOW, detail: 'exit 1' });
    expect(text(el, '.wk-time')).toBe('Failed after 1m 03s');
    expect(q(el, '.wk-detail')!.hasAttribute('data-sep')).toBe(true);
    // Done without an end: no time, and the state word as the label.
    set(el, { state: 'done', since: NOW - 252_000 });
    expect(q(el, '.wk-time')).toBeNull();
    expect(text(el, '.wk-now')).toBe('Done');
    expect(said(el)).toBe('Done');
  });

  it('without a label it shows the state word; idle has no time; no detail, no detail node', () => {
    const el = mount({ state: 'working', since: NOW - 5_000 });
    expect(text(el, '.wk-now')).toBe('Working');
    expect(q(el, '.wk-detail')).toBeNull();
    set(el, { state: 'idle', since: NOW - 5_000 });
    expect(text(el, '.wk-now')).toBe('Idle');
    expect(q(el, '.wk-time')).toBeNull();
    expect(said(el)).toBe('Idle');
    expect(el.state).toBe('idle');
  });

  it('the sweep class only while working — and not under reduced motion', () => {
    const el = mount(RUN);
    expect(q(el, '.wk-now')!.classList.contains('is-sweep')).toBe(true);
    for (const state of ['waiting', 'done', 'failed', 'idle'] as WorkingState[]) {
      set(el, { ...RUN, state, until: NOW });
      expect(qa(el, '.is-sweep')).toEqual([]);
    }
    set(el, RUN);
    expect(qa(el, '.is-sweep').length).toBe(1);
    reduce();
    set(el, { ...RUN, detail: '13.0k tokens' });
    expect(qa(el, '.is-sweep')).toEqual([]);
  });

  it('never renders markup from the label or the detail (data or attributes)', () => {
    const el = mount({ state: 'working', label: XSS, since: NOW, detail: XSS });
    expect(q(el, 'img')).toBeNull();
    expect(text(el, '.wk-now')).toBe(XSS);
    expect(text(el, '.wk-detail')).toBe(XSS);
    expect(said(el)).toBe(`Working: ${XSS}`);
    const at = mount(undefined, { state: 'failed', label: XSS, detail: XSS, since: XSS, until: XSS });
    expect(q(at, 'img')).toBeNull();
    expect(text(at, '.wk-now')).toBe(XSS);
    expect(text(at, '.wk-detail')).toBe(XSS);
    expect(q(at, '.wk-time')).toBeNull();
    // A swap carries the old label as text, too.
    set(el, { ...RUN, label: 'Next' });
    expect(text(el, '.wk-was')).toBe(XSS);
    expect(q(el, 'img')).toBeNull();
  });

  it('speaks Korean with lang="ko"', () => {
    const el = mount(
      { state: 'working', label: 'dashboard.ts 읽는 중', since: NOW - 252_000, detail: '토큰 12.4k' },
      { lang: 'ko' },
    );
    expect(text(el, '.wk-time')).toBe('4분 12초');
    expect(said(el)).toBe('작업 중: dashboard.ts 읽는 중');
    set(el, { state: 'done', label: 'PR #27 열기', since: NOW - 252_000, until: NOW });
    expect(text(el, '.wk-time')).toBe('4분 12초 만에 완료');
    expect(said(el)).toBe('완료: PR #27 열기, 4분 12초 만에 완료');
    set(el, { state: 'failed', since: NOW - 63_000, until: NOW });
    expect(text(el, '.wk-time')).toBe('1분 03초 후 실패');
    set(el, { state: 'waiting' });
    expect(text(el, '.wk-now')).toBe('확인 필요');
    set(el, { state: 'idle' });
    expect(text(el, '.wk-now')).toBe('대기');
    el.setAttribute('lang', 'en');
    el.renderNow();
    expect(text(el, '.wk-now')).toBe('Idle');
  });
});

describe('attributes', () => {
  it('reads state, label, since (ISO or ms), until, detail; a changed attribute re-renders', async () => {
    const el = mount(undefined, {
      state: 'working',
      label: 'Running npm test — 1,942 tests',
      since: new Date(NOW - 252_000).toISOString(),
      detail: 'tool call 9 of ~20',
    });
    expect(el.state).toBe('working');
    expect(text(el, '.wk-now')).toBe('Running npm test — 1,942 tests');
    expect(text(el, '.wk-time')).toBe('4m 12s');
    expect(text(el, '.wk-detail')).toBe('tool call 9 of ~20');
    el.setAttribute('state', 'done');
    el.setAttribute('until', String(NOW));
    await Promise.resolve();
    expect(text(el, '.wk-time')).toBe('Done in 4m 12s');
    expect(q(el, 'svg[data-icon="check"]')).not.toBeNull();
    el.setAttribute('since', String(NOW - 63_000));
    el.setAttribute('state', 'failed');
    el.renderNow();
    expect(text(el, '.wk-time')).toBe('Failed after 1m 03s');
  });

  it('data wins over the attributes, field by field', () => {
    const el = mount({ state: 'waiting', label: 'Approve the deploy' }, { state: 'working', label: 'x', detail: 'd' });
    expect(el.state).toBe('waiting');
    expect(text(el, '.wk-now')).toBe('Approve the deploy');
    expect(text(el, '.wk-detail')).toBe('d');
  });

  it('state is a read-only property', () => {
    expect(Object.getOwnPropertyDescriptor(UiWorking.prototype, 'state')?.set).toBeUndefined();
    const el = mount(RUN);
    expect(el.state).toBe('working');
    set(el, { ...RUN, state: 'nope' as WorkingState });
    expect(el.state).toBe('idle');
  });
});

describe('the label swap', () => {
  it('a new label swaps in place: the old one leaves inside the same slot, one line, then it is gone', () => {
    const el = mount(RUN);
    expect(q(el, '.wk-label')!.classList.contains('is-swap')).toBe(false);
    expect(q(el, '.wk-was')).toBeNull();
    set(el, { ...RUN, label: 'Running npm test — 1,942 tests' });
    const slot = q(el, '.wk-label')!;
    expect(qa(el, '.wk-label').length).toBe(1);
    expect(slot.classList.contains('is-swap')).toBe(true);
    expect(Array.from(slot.children).map((c) => c.textContent)).toEqual([
      'Reading src/conversation/dashboard.ts',
      'Running npm test — 1,942 tests',
    ]);
    expect(slot.children[0].classList.contains('wk-was')).toBe(true);
    expect(slot.children[1].classList.contains('wk-now')).toBe(true);
    // Still one line: the line holds one label slot, the old label is laid over it (absolute), the line has a height.
    expect(qa(el, '.wk').length).toBe(1);
    expect(styles).toContain('.wk-was { position: absolute; inset: 0; }');
    expect(styles).toMatch(/\.wk \{[^}]*height: var\(--wk-h\); overflow: hidden;[^}]*white-space: nowrap;/);
    expect(styles).toMatch(/\.wk-label \{[^}]*height: var\(--wk-h\); overflow: hidden;/);
    // Each swap is announced: the said text follows the label.
    expect(said(el)).toBe('Working: Running npm test — 1,942 tests');
    vi.advanceTimersByTime(300);
    expect(q(el, '.wk-label')!.classList.contains('is-swap')).toBe(false);
    expect(q(el, '.wk-was')).toBeNull();
    expect(text(el, '.wk-now')).toBe('Running npm test — 1,942 tests');
  });

  it('no swap on the first render, for the same label, or for a change that is not the label', () => {
    const el = mount(RUN);
    set(el, { ...RUN, detail: '13.1k tokens' });
    set(el, { ...RUN, state: 'waiting' });
    expect(q(el, '.is-swap')).toBeNull();
    expect(vi.getTimerCount()).toBe(1); // the tick only
  });

  it('a swap during a swap starts again from the label on screen (fresh nodes)', () => {
    const el = mount(RUN);
    set(el, { ...RUN, label: 'Step two' });
    const first = q(el, '.wk-now');
    vi.advanceTimersByTime(100);
    set(el, { ...RUN, label: 'Step three' });
    expect(text(el, '.wk-was')).toBe('Step two');
    expect(text(el, '.wk-now')).toBe('Step three');
    expect(q(el, '.wk-now')).not.toBe(first);
    vi.advanceTimersByTime(250);
    expect(q(el, '.wk-label.is-swap')).not.toBeNull();
    vi.advanceTimersByTime(100);
    expect(q(el, '.wk-was')).toBeNull();
  });

  it('reduced motion: the new label at once — no swap class, no old copy', () => {
    reduce();
    const el = mount(RUN);
    set(el, { ...RUN, label: 'Opening PR #27' });
    expect(q(el, '.is-swap')).toBeNull();
    expect(q(el, '.wk-was')).toBeNull();
    expect(text(el, '.wk-now')).toBe('Opening PR #27');
    expect(vi.getTimerCount()).toBe(1); // the tick only
  });

  it('leaving the page ends a swap and its timer', () => {
    const el = mount(RUN);
    set(el, { ...RUN, state: 'done', until: NOW, label: 'Opened PR #27' });
    expect(vi.getTimerCount()).toBe(1); // the swap's
    el.remove();
    expect(vi.getTimerCount()).toBe(0);
    document.body.append(el);
    el.renderNow();
    expect(q(el, '.wk-was')).toBeNull();
  });
});

describe('the time', () => {
  it('ticks once a second in place — the same text node, no re-render', () => {
    const el = mount(RUN);
    const time = q(el, '.wk-time')!;
    const node = time.firstChild;
    const render = vi.spyOn(el as unknown as { render(): string }, 'render');
    vi.advanceTimersByTime(1000);
    expect(time.textContent).toBe('43s');
    expect(time.firstChild).toBe(node);
    expect(q(el, '.wk-time')).toBe(time);
    vi.advanceTimersByTime(17_000);
    expect(time.textContent).toBe('1m 00s');
    expect(time.firstChild).toBe(node);
    expect(render).not.toHaveBeenCalled();
  });

  it('one interval, only while connected and live; it stops on done, failed, idle, an end and disconnect', () => {
    const el = mount(RUN);
    expect(vi.getTimerCount()).toBe(1);
    set(el, { ...RUN, detail: '13.0k tokens' });
    expect(vi.getTimerCount()).toBe(1);
    set(el, { ...RUN, state: 'waiting' });
    expect(vi.getTimerCount()).toBe(1);
    set(el, { ...RUN, state: 'done', until: NOW });
    expect(vi.getTimerCount()).toBe(0);
    const done = text(el, '.wk-time');
    vi.advanceTimersByTime(5000);
    expect(text(el, '.wk-time')).toBe(done);
    set(el, { ...RUN, state: 'failed' });
    expect(vi.getTimerCount()).toBe(0);
    set(el, { ...RUN, state: 'idle' });
    expect(vi.getTimerCount()).toBe(0);
    set(el, { ...RUN, until: NOW });
    expect(vi.getTimerCount()).toBe(0);
    set(el, { ...RUN, since: undefined });
    expect(vi.getTimerCount()).toBe(0);
    set(el, RUN);
    expect(vi.getTimerCount()).toBe(1);
    el.remove();
    expect(vi.getTimerCount()).toBe(0);
    document.body.append(el);
    el.renderNow();
    expect(vi.getTimerCount()).toBe(1);
  });
});

describe('announcements', () => {
  /** Mutations of the said text (the only text outside the aria-hidden line). */
  function watchSaid(el: UiWorking): { count: () => Promise<number> } {
    let n = 0;
    const mo = new MutationObserver((records) => {
      n += records.length;
    });
    mo.observe(q(el, '.wk-said')!, { characterData: true, childList: true, subtree: true });
    return {
      async count() {
        await Promise.resolve();
        await Promise.resolve();
        return n;
      },
    };
  }

  it('the said text changes for a new state or label — never for ticks or the detail', async () => {
    const el = mount(RUN);
    const node = q(el, '.wk-said')!;
    const w = watchSaid(el);
    vi.advanceTimersByTime(3000);
    set(el, { ...RUN, detail: '14.2k tokens' });
    set(el, { ...RUN, detail: '15.0k tokens', since: NOW - 50_000 });
    expect(await w.count()).toBe(0);
    expect(said(el)).toBe('Working: Reading src/conversation/dashboard.ts');
    set(el, { ...RUN, label: 'Running npm test — 1,942 tests' });
    expect(said(el)).toBe('Working: Running npm test — 1,942 tests');
    const afterLabel = await w.count();
    expect(afterLabel).toBeGreaterThan(0);
    set(el, { ...RUN, label: 'Running npm test — 1,942 tests', state: 'waiting' });
    expect(said(el)).toBe('Needs you: Running npm test — 1,942 tests');
    const afterState = await w.count();
    expect(afterState).toBeGreaterThan(afterLabel);
    // The swap ending redraws the line, not the words.
    vi.advanceTimersByTime(400);
    vi.advanceTimersByTime(3000);
    expect(await w.count()).toBe(afterState);
    expect(q(el, '.wk-said')).toBe(node);
    // Everything else is inside the aria-hidden line.
    const outside = Array.from(el.shadowRoot!.querySelector('.ui-root')!.children).filter(
      (c) => c.getAttribute('aria-hidden') !== 'true',
    );
    expect(outside.map((c) => c.className)).toEqual(['wk-said sr-only']);
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    vi.useRealTimers();
    spy = soundSpy();
  });
  afterEach(() => spy.restore());

  it('never plays a cue — every change is data the app set', async () => {
    const el = mount(RUN);
    set(el, { ...RUN, label: 'Next' });
    set(el, { ...RUN, state: 'done', until: Date.now() });
    set(el, { ...RUN, state: 'failed', until: Date.now() });
    await spy.settle();
    expect(spy.calls).toEqual([]);
  });
});

describe('styles', () => {
  it('the kit’s ring, the sweep from tokens, the swap on --ease-out, sizes, reduced motion; tokens only', () => {
    expect(styles).toContain('animation: wk-spin 0.9s linear infinite');
    expect(styles).toContain('border-top-color: var(--wk-tone); border-right-color: var(--wk-tone)');
    expect(styles).toContain('.wk[data-state="working"] { --wk-tone: var(--st-run); }');
    expect(styles).toContain('.wk[data-state="waiting"] { --wk-tone: var(--st-wait); }');
    expect(styles).toContain('.wk[data-state="done"] { --wk-tone: var(--st-done); }');
    expect(styles).toContain('.wk[data-state="failed"] { --wk-tone: var(--st-fail); }');
    expect(styles).toContain('--wk-dim: color-mix(in srgb, var(--ib-muted) 70%, var(--ib-text));');
    expect(styles).toContain('background-clip: text');
    expect(styles).toContain('animation: wk-sweep 2.2s linear infinite');
    expect(styles).toContain('.wk-label.is-swap > .wk-now { animation: wk-rise 220ms var(--ease-out) both; }');
    expect(styles).toContain('.wk-label.is-swap > .wk-was { animation: wk-leave 220ms var(--ease-out) both; }');
    expect(styles).toMatch(/\.wk \{[^}]*font-size: 13px;/);
    expect(styles).toMatch(/:host\(\[size="sm"\]\) \.wk \{[^}]*font-size: 12px;/);
    // The label gives way first: a hundred times the detail's shrink; the time never shrinks.
    expect(styles).toMatch(/\.wk-label \{[^}]*flex: 0 100 auto; min-width: 0;/);
    expect(styles).toContain('.wk-time { flex: none; }');
    expect(styles).toMatch(
      /\.wk-detail \{ flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; \}/,
    );
    const reduced = styles.slice(styles.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toContain('.wk-ring { animation: none;');
    expect(reduced).toContain('.wk-ring::after');
    expect(reduced).toContain('.wk-now.is-sweep { animation: none; color: inherit; background: none; }');
    expect(reduced).toContain('.wk-label.is-swap > * { animation: none; }');
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
});

describe('doc', () => {
  it('is our own design, in Components, with no events, a Sound line and ≥3 demos that build without the network', () => {
    const fetchSpy = vi.fn(() => {
      throw new Error('no network in demos');
    });
    vi.stubGlobal('fetch', fetchSpy);
    expect(doc.slug).toBe('working');
    expect(doc.name).toBe('Working');
    expect(doc.tag).toBe('ui-working');
    expect(doc.group).toBe('Components');
    expect(doc.reference).toEqual({
      name: 'soma-work dashboard — running card',
      url: 'https://github.com/2lab-ai/soma-work',
    });
    expect(doc.events).toEqual([]);
    expect(doc.a11y.some((l) => l.startsWith('Sound (opt-in'))).toBe(true);
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    let total = 0;
    for (const d of doc.demos) {
      const node = d.create();
      document.body.append(node);
      const els = Array.from(node.querySelectorAll<UiWorking>('ui-working'));
      expect(els.length).toBeGreaterThan(0);
      for (const w of els) {
        w.renderNow();
        expect(w.shadowRoot!.querySelector('.wk')).not.toBeNull();
      }
      total += els.length;
    }
    expect(total).toBeGreaterThanOrEqual(12);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('the state list shows every state at sm, with “Done in 4m 12s” and “Failed after 1m 03s”', () => {
    const node = doc.demos.find((d) => d.id === 'states')!.create();
    document.body.append(node);
    const els = Array.from(node.querySelectorAll<UiWorking>('ui-working'));
    for (const w of els) w.renderNow();
    expect(els.map((w) => w.state)).toEqual(['working', 'waiting', 'done', 'failed', 'idle']);
    expect(els.every((w) => w.getAttribute('size') === 'sm')).toBe(true);
    expect(text(els[2], '.wk-time')).toBe('Done in 4m 12s');
    expect(text(els[3], '.wk-time')).toBe('Failed after 1m 03s');
    const ko = doc.demos.find((d) => d.id === 'ko')!.create();
    document.body.append(ko);
    const kos = Array.from(ko.querySelectorAll<UiWorking>('ui-working'));
    for (const w of kos) w.renderNow();
    expect(kos.every((w) => w.getAttribute('lang') === 'ko')).toBe(true);
    expect(text(kos[2], '.wk-time')).toBe('4분 12초 만에 완료');
    const board = doc.demos.find((d) => d.id === 'board')!.create();
    expect(board.querySelector('.ui-card ui-working[size="sm"]')).not.toBeNull();
  });

  it('the running demo steps every 3 s, ends done, starts over — and its interval stops once it is gone', () => {
    const box = doc.demos.find((d) => d.id === 'running')!.create();
    document.body.append(box);
    const el = box.querySelector('ui-working') as UiWorking;
    el.renderNow();
    expect(text(el, '.wk-now')).toBe('Reading src/conversation/dashboard.ts');
    expect(text(el, '.wk-detail')).toBe('12.4k tokens');
    vi.advanceTimersByTime(3000);
    el.renderNow();
    expect(text(el, '.wk-now')).toBe('Running npm test — 1,942 tests');
    expect(text(el, '.wk-detail')).toBe('14.1k tokens');
    vi.advanceTimersByTime(6000);
    el.renderNow();
    expect(el.data?.label).toBe('Opening PR #27');
    vi.advanceTimersByTime(3000);
    el.renderNow();
    expect(el.state).toBe('done');
    expect(text(el, '.wk-time')).toBe('Done in 4m 12s');
    vi.advanceTimersByTime(6000);
    el.renderNow();
    expect(el.state).toBe('working');
    expect(el.data?.label).toBe('Reading src/conversation/dashboard.ts');
    box.remove();
    vi.advanceTimersByTime(3000);
    expect(vi.getTimerCount()).toBe(0);
  });
});
