import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import {
  type AgentIslandData,
  ISLAND_MIN_W,
  ISLAND_OPEN_W,
  type IslandActionDetail,
  type IslandToggleDetail,
  islandClock,
  islandElapsed,
  islandFit,
  islandMore,
  islandProgress,
  islandStatus,
  islandTicks,
  type UiAgentIsland,
} from './agent-island';
import { doc } from './docs';
import { ISLAND_SPRING, styles } from './styles';

const NOW = Date.UTC(2026, 10, 5, 5, 0, 0);
const XSS = '<img src=x onerror=alert(1)>';

const RUN: AgentIslandData = {
  title: 'Fix flaky checkout test',
  status: 'running',
  startedAt: NOW - 252_000, // 4:12
  step: 'Running npm test — 1,942 tests',
  progress: { done: 3, total: 7 },
  actions: [
    { id: 'stop', label: 'Stop', icon: 'stop', tone: 'danger' },
    { id: 'open', label: 'Open', icon: 'external' },
  ],
};

function mount(data: AgentIslandData | undefined, attrs: Record<string, string> = {}): UiAgentIsland {
  const el = document.createElement('ui-agent-island') as UiAgentIsland;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiAgentIsland, s: string) => el.shadowRoot!.querySelector<E>(s);
const qa = <E extends Element = HTMLElement>(el: UiAgentIsland, s: string) =>
  Array.from(el.shadowRoot!.querySelectorAll<E>(s));
const pill = (el: UiAgentIsland) => q<HTMLButtonElement>(el, '.ai-pill')!;
const head = (el: UiAgentIsland) => q<HTMLButtonElement>(el, '.ai-head')!;
const act = (el: UiAgentIsland, id: string) =>
  qa<HTMLButtonElement>(el, '.ai-act').find((b) => b.dataset.id === id) as HTMLButtonElement;
const live = (el: UiAgentIsland) => el.shadowRoot!.querySelector('[role="status"]')?.textContent ?? '';
const click = (t: EventTarget, detail = 1) =>
  t.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail }));
const key = (t: EventTarget, k: string) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true });
  t.dispatchEvent(e);
  return e;
};
function events<T>(el: UiAgentIsland, name: string): T[] {
  const seen: T[] = [];
  el.addEventListener(name, (e) => seen.push((e as CustomEvent<T>).detail));
  return seen;
}
/** Re-render after a press (the state change renders on a microtask). */
function press(el: UiAgentIsland, t: EventTarget): void {
  click(t);
  el.renderNow();
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('pure helpers', () => {
  it('islandClock: m:ss under an hour, h:mm:ss from one; negative / NaN read 0:00', () => {
    expect(islandClock(42_000)).toBe('0:42');
    expect(islandClock(12 * 60_000 + 5_000)).toBe('12:05');
    expect(islandClock(3_600_000 + 2 * 60_000 + 9_000)).toBe('1:02:09');
    expect(islandClock(59_999)).toBe('0:59');
    expect(islandClock(0)).toBe('0:00');
    expect(islandClock(-5_000)).toBe('0:00');
    expect(islandClock(Number.NaN)).toBe('0:00');
    expect(islandClock(Number.POSITIVE_INFINITY)).toBe('0:00');
  });

  it('knows the statuses, the elapsed time and when it ticks', () => {
    expect(islandStatus('failed')).toBe('failed');
    expect(islandStatus('stopped')).toBe('running');
    expect(islandStatus(undefined)).toBe('running');
    expect(islandElapsed({ startedAt: NOW - 42_000 }, NOW)).toBe(42_000);
    expect(islandElapsed({ startedAt: NOW - 42_000, endedAt: NOW - 2_000 }, NOW)).toBe(40_000);
    expect(islandElapsed({ startedAt: NOW, endedAt: NOW - 5 }, NOW)).toBe(0);
    expect(islandElapsed({}, NOW)).toBeNaN();
    expect(islandElapsed({ startedAt: Number.NaN }, NOW)).toBeNaN();
    expect(islandElapsed(undefined, NOW)).toBeNaN();
    expect(islandTicks({ status: 'running', startedAt: NOW })).toBe(true);
    expect(islandTicks({ status: 'waiting', startedAt: NOW })).toBe(true);
    expect(islandTicks({ status: 'running', startedAt: NOW, endedAt: NOW + 1 })).toBe(false);
    expect(islandTicks({ status: 'done', startedAt: NOW })).toBe(false);
    expect(islandTicks({ status: 'failed', startedAt: NOW })).toBe(false);
    expect(islandTicks({ status: 'running' })).toBe(false);
    expect(islandTicks(undefined)).toBe(false);
  });

  it('keeps progress and +N to whole, sensible numbers', () => {
    expect(islandProgress({ done: 3, total: 7 })).toEqual({ done: 3, total: 7 });
    expect(islandProgress({ done: 9, total: 7 })).toEqual({ done: 7, total: 7 });
    expect(islandProgress({ done: -1, total: 2.6 })).toEqual({ done: 0, total: 2 });
    expect(islandProgress({ done: 1, total: 0 })).toBeNull();
    expect(islandProgress({ done: 'x', total: 3 })).toBeNull();
    expect(islandProgress(null)).toBeNull();
    expect(islandMore(2)).toBe(2);
    expect(islandMore(2.9)).toBe(2);
    expect(islandMore(0)).toBe(0);
    expect(islandMore(-3)).toBe(0);
    expect(islandMore('many')).toBe(0);
  });

  it('islandFit: the pill fits its face (≥150, ≤ the room); the card is the room by its height', () => {
    const m = { room: ISLAND_OPEN_W, faceW: 182, faceH: 36, cardH: 172 };
    expect(islandFit({ ...m, open: false })).toEqual({ w: 182, h: 36 });
    expect(islandFit({ ...m, open: false, faceW: 90 })).toEqual({ w: ISLAND_MIN_W, h: 36 });
    expect(islandFit({ ...m, open: false, faceW: 400 })).toEqual({ w: ISLAND_OPEN_W, h: 36 });
    expect(islandFit({ ...m, open: true })).toEqual({ w: ISLAND_OPEN_W, h: 172 });
    expect(islandFit({ ...m, open: true, room: 300 })).toEqual({ w: 300, h: 172 });
    // The border adds to both sides.
    expect(islandFit({ ...m, open: false, edge: 2 })).toEqual({ w: 184, h: 38 });
    expect(islandFit({ ...m, open: true, edge: 2, cardH: 171.4 })).toEqual({ w: ISLAND_OPEN_W, h: 174 });
    // Nothing laid out.
    expect(islandFit({ ...m, open: false, room: 0 })).toBeNull();
    expect(islandFit({ ...m, open: true, cardH: 0 })).toBeNull();
  });
});

describe('<ui-agent-island> rendering', () => {
  it('renders nothing without data', () => {
    const el = mount(undefined);
    expect(q(el, '.ai')).toBeNull();
  });

  it('compact: one toggle — mark, title, clock (aria-hidden) — named “status, title”; the card is inert', () => {
    const el = mount(RUN);
    const box = q(el, '.ai')!;
    expect(box.dataset.status).toBe('running');
    expect(box.dataset.tone).toBe('ink');
    expect(box.hasAttribute('data-open')).toBe(false);
    const b = pill(el);
    expect(b.localName).toBe('button');
    expect(b.getAttribute('aria-expanded')).toBe('false');
    expect(b.getAttribute('aria-controls')).toBe('ai-card');
    expect(q(el, '#ai-card')).not.toBeNull();
    expect(b.getAttribute('aria-label')).toBe('Running, Fix flaky checkout test');
    expect(b.title).toBe('Open');
    expect(b.querySelector('.ai-mark .ai-spin')).not.toBeNull();
    expect(b.querySelector('.ai-title')?.textContent).toBe('Fix flaky checkout test');
    const clock = b.querySelector('.ai-clock')!;
    expect(clock.textContent).toBe('4:12');
    expect(clock.getAttribute('aria-hidden')).toBe('true');
    expect(b.querySelector('.ai-more')).toBeNull();
    expect(q(el, '.ai-compact')!.hasAttribute('data-on')).toBe(true);
    expect(q(el, '.ai-card')!.hasAttribute('inert')).toBe(true);
    expect(q(el, '.ai-compact')!.hasAttribute('inert')).toBe(false);
    // Never a button inside a button.
    expect(qa(el, 'button button')).toHaveLength(0);
  });

  it('open: status word + <time>, title, step, “3 of 7” on a rail, actions as siblings of the toggle', () => {
    const el = mount({ ...RUN, open: true });
    expect(el.open).toBe(true);
    expect(el.hasAttribute('open')).toBe(true);
    expect(q(el, '.ai')!.hasAttribute('data-open')).toBe(true);
    expect(q(el, '.ai-compact')!.hasAttribute('inert')).toBe(true);
    expect(q(el, '.ai-card')!.hasAttribute('data-on')).toBe(true);
    const h = head(el);
    expect(h.getAttribute('aria-expanded')).toBe('true');
    expect(h.getAttribute('aria-controls')).toBe('ai-card');
    expect(h.getAttribute('aria-label')).toBe('Running, Fix flaky checkout test');
    expect(h.title).toBe('Close');
    expect(h.querySelector('.ai-word')?.textContent).toBe('Running');
    const time = q(el, 'time.ai-big')!;
    expect(time.textContent).toBe('4:12');
    expect(time.getAttribute('datetime')).toBe('PT4M12S');
    expect(h.contains(time)).toBe(false);
    expect(q(el, '.ai-name')?.textContent).toBe('Fix flaky checkout test');
    expect(q(el, '.ai-step')?.textContent).toBe('Running npm test — 1,942 tests');
    expect(q(el, '.ai-count')?.textContent).toBe('3 of 7');
    expect(q(el, '.ai-rail')?.getAttribute('aria-hidden')).toBe('true');
    expect(q(el, '.ai-fill')!.style.width).toBe('42.86%');
    const stop = act(el, 'stop');
    expect(stop.className).toBe('ai-act is-danger is-round');
    expect(stop.getAttribute('aria-label')).toBe('Stop');
    expect(stop.title).toBe('Stop');
    expect(stop.querySelector('svg[data-icon="stop"]')).not.toBeNull();
    const open = act(el, 'open');
    expect(open.className).toBe('ai-act');
    expect(open.textContent).toBe('Open');
    expect(open.querySelector('svg[data-icon="external"]')).not.toBeNull();
    expect(open.hasAttribute('aria-label')).toBe(false);
    expect(q(el, '.ai-actions')!.contains(h)).toBe(false);
    expect(qa(el, 'button button')).toHaveLength(0);
  });

  it('every status has its mark and word; +N shows as a chip and in the name', () => {
    const marks = {
      running: '.ai-spin',
      waiting: '.ai-dot',
      done: 'svg[data-icon="check"]',
      failed: 'svg[data-icon="cross"]',
    };
    const words = { running: 'Running', waiting: 'Needs you', done: 'Done', failed: 'Failed' };
    for (const status of ['running', 'waiting', 'done', 'failed'] as const) {
      const el = mount({ title: 'T', status, startedAt: NOW - 1000, endedAt: status === 'done' ? NOW : undefined });
      expect(q(el, `.ai-pill .ai-mark ${marks[status]}`)).not.toBeNull();
      expect(q(el, '.ai-word')?.textContent).toBe(words[status]);
      expect(q(el, '.ai')?.dataset.status).toBe(status);
    }
    const el = mount({ ...RUN, status: 'waiting', more: 2 });
    expect(q(el, '.ai-pill .ai-more')?.textContent).toBe('+2');
    expect(q(el, '.ai-head .ai-more')?.textContent).toBe('+2');
    expect(pill(el).getAttribute('aria-label')).toBe('Needs you, Fix flaky checkout test, 2 more');
    expect(head(el).getAttribute('aria-label')).toBe('Needs you, Fix flaky checkout test, 2 more');
  });

  it('no start, no clock; no step, progress or actions, nothing drawn for them', () => {
    const el = mount({ title: 'Plan the week', status: 'running' }, { open: '' });
    expect(q(el, '.ai-clock')).toBeNull();
    expect(q(el, 'time')).toBeNull();
    expect(q(el, '.ai-step')).toBeNull();
    expect(q(el, '.ai-prog')).toBeNull();
    expect(q(el, '.ai-actions')).toBeNull();
    // A danger action without a glyph is a pill with its words.
    el.data = { title: 'x', status: 'running', actions: [{ id: 'stop', label: 'Stop', tone: 'danger' }] };
    el.renderNow();
    expect(act(el, 'stop').className).toBe('ai-act is-danger');
    expect(act(el, 'stop').textContent).toBe('Stop');
  });

  it('tone="surface" is the raised card', () => {
    const el = mount(RUN, { tone: 'surface' });
    expect(q(el, '.ai')?.dataset.tone).toBe('surface');
    el.setAttribute('tone', 'nope');
    el.renderNow();
    expect(q(el, '.ai')?.dataset.tone).toBe('ink');
  });

  it('escapes the title, the step, action labels and ids', () => {
    const el = mount({
      ...RUN,
      title: `Fix ${XSS}`,
      step: `Step ${XSS}`,
      actions: [
        { id: `a"><b>`, label: `Go ${XSS}` },
        { id: 'stop', label: `Stop ${XSS}`, icon: 'stop', tone: 'danger' },
      ],
      open: true,
    });
    const root = el.shadowRoot!;
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('b')).toBeNull();
    expect(q(el, '.ai-title')?.textContent).toBe(`Fix ${XSS}`);
    expect(q(el, '.ai-name')?.textContent).toBe(`Fix ${XSS}`);
    expect(q(el, '.ai-step')?.textContent).toBe(`Step ${XSS}`);
    expect(pill(el).getAttribute('aria-label')).toBe(`Running, Fix ${XSS}`);
    const [go, stop] = qa<HTMLButtonElement>(el, '.ai-act');
    expect(go.dataset.id).toBe(`a"><b>`);
    expect(go.textContent).toBe(`Go ${XSS}`);
    expect(stop.getAttribute('aria-label')).toBe(`Stop ${XSS}`);
    expect(stop.title).toBe(`Stop ${XSS}`);
    const got = events<IslandActionDetail>(el, 'ui-action');
    press(el, go);
    expect(got).toEqual([{ id: `a"><b>` }]);
  });

  it('lang="ko": every built-in word', () => {
    const el = mount({ ...RUN, status: 'waiting', more: 2, open: true }, { lang: 'ko' });
    expect(q(el, '.ai-word')?.textContent).toBe('확인 필요');
    expect(head(el).getAttribute('aria-label')).toBe('확인 필요, Fix flaky checkout test, 2개 더');
    expect(head(el).title).toBe('닫기');
    expect(pill(el).title).toBe('열기');
    expect(q(el, '.ai-count')?.textContent).toBe('7개 중 3');
    const words = { running: '실행 중', done: '완료', failed: '실패' } as const;
    for (const [status, w] of Object.entries(words)) {
      el.data = { ...RUN, status: status as AgentIslandData['status'] };
      el.renderNow();
      expect(q(el, '.ai-word')?.textContent).toBe(w);
    }
    expect(live(el)).toBe('실패: Fix flaky checkout test');
  });
});

describe('toggle, Esc, actions', () => {
  it('pressing the pill asks to open (ui-toggle), the head asks to close; open reflects', () => {
    const el = mount(RUN);
    const got = events<IslandToggleDetail>(el, 'ui-toggle');
    press(el, pill(el));
    expect(got).toEqual([{ open: true }]);
    expect(el.open).toBe(true);
    expect(el.hasAttribute('open')).toBe(true);
    expect(q(el, '.ai')!.hasAttribute('data-open')).toBe(true);
    press(el, head(el));
    expect(got).toEqual([{ open: true }, { open: false }]);
    expect(el.open).toBe(false);
    expect(el.hasAttribute('open')).toBe(false);
  });

  it('a prevented ui-toggle keeps it as it was', () => {
    const el = mount(RUN);
    el.addEventListener('ui-toggle', (e) => e.preventDefault());
    press(el, pill(el));
    expect(el.open).toBe(false);
    expect(el.hasAttribute('open')).toBe(false);
    el.open = true;
    el.renderNow();
    press(el, head(el));
    expect(el.open).toBe(true);
  });

  it('the hidden face does nothing (it is inert)', () => {
    const el = mount(RUN);
    const got = events<IslandToggleDetail>(el, 'ui-toggle');
    press(el, head(el));
    click(act(el, 'stop'));
    expect(got).toEqual([]);
    expect(el.open).toBe(false);
  });

  it('focus moves with the island: to the head on open, back to the pill on Esc', () => {
    const el = mount(RUN);
    pill(el).focus();
    press(el, pill(el));
    expect(el.shadowRoot!.activeElement).toBe(head(el));
    const got = events<IslandToggleDetail>(el, 'ui-toggle');
    act(el, 'open').focus();
    const esc = key(act(el, 'open'), 'Escape');
    el.renderNow();
    expect(esc.defaultPrevented).toBe(true);
    expect(got).toEqual([{ open: false }]);
    expect(el.open).toBe(false);
    expect(el.shadowRoot!.activeElement).toBe(pill(el));
  });

  it('Esc does nothing while closed, and a prevented Esc keeps the card open', () => {
    const el = mount(RUN);
    const got = events<IslandToggleDetail>(el, 'ui-toggle');
    expect(key(pill(el), 'Escape').defaultPrevented).toBe(false);
    expect(got).toEqual([]);
    el.show();
    el.renderNow();
    el.addEventListener('ui-toggle', (e) => e.preventDefault());
    key(head(el), 'Escape');
    el.renderNow();
    expect(got).toEqual([{ open: false }]);
    expect(el.open).toBe(true);
  });

  it('actions say their id (cancelable) and leave the state alone', () => {
    const el = mount({ ...RUN, open: true });
    const got = events<IslandActionDetail>(el, 'ui-action');
    press(el, act(el, 'stop'));
    press(el, act(el, 'open'));
    expect(got).toEqual([{ id: 'stop' }, { id: 'open' }]);
    expect(el.open).toBe(true);
    const seen: Event[] = [];
    el.addEventListener('ui-action', (e) => {
      e.preventDefault();
      seen.push(e);
    });
    press(el, act(el, 'stop'));
    expect(seen[0].cancelable).toBe(true);
    expect(seen[0].defaultPrevented).toBe(true);
    expect(seen[0].bubbles && seen[0].composed).toBe(true);
    expect(el.open).toBe(true);
  });

  it('the open attribute, the property and show() / hide() / toggle() change state without an event', () => {
    const el = mount(RUN);
    const got = events<IslandToggleDetail>(el, 'ui-toggle');
    el.setAttribute('open', '');
    el.renderNow();
    expect(el.open).toBe(true);
    expect(q(el, '.ai-card')!.hasAttribute('data-on')).toBe(true);
    el.open = false;
    expect(el.hasAttribute('open')).toBe(false);
    el.show();
    expect(el.hasAttribute('open')).toBe(true);
    el.hide();
    expect(el.open).toBe(false);
    el.toggle();
    expect(el.open).toBe(true);
    el.removeAttribute('open');
    expect(el.open).toBe(false);
    expect(got).toEqual([]);
  });

  it('data.open applies when it changes; the same value again keeps a person’s own toggle', () => {
    const el = mount({ ...RUN, open: true });
    expect(el.open).toBe(true);
    press(el, head(el));
    expect(el.open).toBe(false);
    el.data = { ...el.data!, step: 'Running npm run lint' };
    el.renderNow();
    expect(el.open).toBe(false);
    el.data = { ...el.data!, open: false };
    el.renderNow();
    el.data = { ...el.data!, open: true };
    el.renderNow();
    expect(el.open).toBe(true);
    expect(el.hasAttribute('open')).toBe(true);
  });

  it('starts open from markup', () => {
    const el = mount(RUN, { open: '' });
    expect(el.open).toBe(true);
    expect(q(el, '.ai-card')!.hasAttribute('inert')).toBe(false);
  });
});

describe('the clock', () => {
  it('ticks once a second in place — the same text nodes, no re-render', () => {
    const el = mount({ ...RUN, open: true });
    const box = q(el, '.ai');
    const clock = q(el, '.ai-clock')!;
    const time = q(el, 'time')!;
    const node = clock.firstChild;
    const big = time.firstChild;
    const render = vi.spyOn(el as unknown as { render(): string }, 'render');
    vi.advanceTimersByTime(1000);
    expect(clock.textContent).toBe('4:13');
    expect(time.textContent).toBe('4:13');
    expect(time.getAttribute('datetime')).toBe('PT4M13S');
    expect(clock.firstChild).toBe(node);
    expect(time.firstChild).toBe(big);
    expect(q(el, '.ai')).toBe(box);
    vi.advanceTimersByTime(47_000);
    expect(clock.textContent).toBe('5:00');
    expect(render).not.toHaveBeenCalled();
  });

  it('one interval only while connected and live: none for done, failed, an ended run; it stops on disconnect', () => {
    const el = mount(RUN);
    expect(vi.getTimerCount()).toBe(1);
    el.data = { ...RUN, title: 'Again' };
    el.renderNow();
    expect(vi.getTimerCount()).toBe(1);
    el.data = { ...RUN, status: 'done', endedAt: NOW };
    el.renderNow();
    expect(vi.getTimerCount()).toBe(0);
    const text = q(el, '.ai-clock')!.textContent;
    vi.advanceTimersByTime(5000);
    expect(q(el, '.ai-clock')!.textContent).toBe(text);
    el.data = { ...RUN, status: 'failed' };
    el.renderNow();
    expect(vi.getTimerCount()).toBe(0);
    el.data = { ...RUN, status: 'waiting', endedAt: NOW };
    el.renderNow();
    expect(vi.getTimerCount()).toBe(0);
    el.data = { ...RUN, status: 'waiting' };
    el.renderNow();
    expect(vi.getTimerCount()).toBe(1);
    el.remove();
    expect(vi.getTimerCount()).toBe(0);
    document.body.append(el);
    el.renderNow();
    expect(vi.getTimerCount()).toBe(1);
  });

  it('a done run shows its time and stands still', () => {
    const el = mount({ ...RUN, status: 'done', endedAt: NOW - 100_000 });
    expect(q(el, '.ai-clock')?.textContent).toBe('2:32');
  });
});

describe('status changes', () => {
  it('the live region says a status change only — not the first render, not ticks, not other data', () => {
    const el = mount(RUN);
    expect(live(el)).toBe('');
    vi.advanceTimersByTime(3000);
    el.data = { ...RUN, step: 'Running npm run build' };
    el.renderNow();
    expect(live(el)).toBe('');
    el.data = { ...RUN, status: 'done', endedAt: NOW };
    el.renderNow();
    expect(live(el)).toBe('Done: Fix flaky checkout test');
    el.data = { ...RUN, status: 'done', endedAt: NOW, step: 'x' };
    el.renderNow();
    expect(live(el)).toBe('Done: Fix flaky checkout test');
    expect(el.shadowRoot!.querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
    expect(el.shadowRoot!.querySelector('[role="status"]')?.className).toBe('sr-only');
  });

  it('the content pops when the run changes — not under reduced motion', () => {
    const anim = vi.spyOn(Element.prototype, 'animate').mockImplementation(() => ({}) as Animation);
    const el = mount(RUN);
    expect(anim).not.toHaveBeenCalled();
    el.data = { ...RUN, status: 'waiting' };
    el.renderNow();
    expect(anim).toHaveBeenCalledTimes(1);
    expect(anim.mock.contexts[0]).toBe(q(el, '.ai-in'));
    expect(anim.mock.calls[0][0]).toEqual([{ scale: '1.08' }, { scale: '1' }]);
    el.data = { ...RUN, status: 'waiting', step: 'only the step' };
    el.renderNow();
    expect(anim).toHaveBeenCalledTimes(1);
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query }));
    el.data = { ...RUN, status: 'done' };
    el.renderNow();
    expect(anim).toHaveBeenCalledTimes(1);
  });
});

describe('the box is sized by measure', () => {
  /** A layout: the room is `room` px, the pill's face 182 × 36, the card 172 tall. */
  function fakeLayout(room: number) {
    const size = (el: HTMLElement, axis: 'w' | 'h'): number => {
      const c = el.classList;
      if (c.contains('ai')) {
        const v = Number.parseFloat(axis === 'w' ? el.style.width : el.style.height) || 0;
        return axis === 'w' ? Math.min(v, room) : v;
      }
      if (c.contains('ai-compact')) return axis === 'w' ? 182 : 36;
      if (c.contains('ai-card')) return axis === 'w' ? room : 172;
      return 0;
    };
    const proto = HTMLElement.prototype;
    vi.spyOn(proto, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return size(this, 'w');
    });
    vi.spyOn(proto, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return size(this, 'h');
    });
    vi.spyOn(proto, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return size(this, 'w');
    });
  }

  it('compact: the face’s natural width; open: the room (≤ 340) by the card’s height — kept across renders', () => {
    fakeLayout(320);
    const el = mount(RUN);
    const box = q(el, '.ai')!;
    expect(box.style.width).toBe('182px');
    expect(box.style.height).toBe('36px');
    expect(box.style.getPropertyValue('--ai-card-w')).toBe('320px');
    expect(box.hasAttribute('data-measure')).toBe(false);
    press(el, pill(el));
    expect(q(el, '.ai')).toBe(box);
    expect(box.style.width).toBe('320px');
    expect(box.style.height).toBe('172px');
    el.data = { ...RUN, step: 'Next step' };
    el.renderNow();
    expect(box.style.width).toBe('320px');
    expect(box.style.height).toBe('172px');
    press(el, head(el));
    expect(box.style.width).toBe('182px');
  });

  it('a wide room caps the card at 340; reduced motion lands on the same sizes', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query }));
    fakeLayout(900);
    const el = mount({ ...RUN, open: true });
    const box = q(el, '.ai')!;
    expect(box.style.width).toBe(`${ISLAND_OPEN_W}px`);
    expect(box.style.height).toBe('172px');
    press(el, head(el));
    expect(box.style.width).toBe('182px');
    expect(box.style.height).toBe('36px');
  });

  /** The widths the box's style went through while `run` ran (repeats of the one before dropped). */
  function widths(box: HTMLElement, run: () => void): string[] {
    const start = box.style.width;
    const mo = new MutationObserver(() => {});
    mo.observe(box, { attributes: true, attributeFilter: ['style'], attributeOldValue: true });
    run();
    const recs = mo.takeRecords();
    mo.disconnect();
    if (!recs.length) return [];
    const values = [...recs.slice(1).map((r) => r.oldValue ?? ''), box.getAttribute('style') ?? ''];
    const out: string[] = [];
    let last = start;
    for (const v of values) {
      const w = /(?:^|;)\s*width:\s*([^;]+)/.exec(v)?.[1]?.trim() ?? '';
      if (w && w !== last) out.push(w);
      last = w || last;
    }
    return out;
  }

  it('springs from the size it has now: measure at 340, back to the start, then the target', () => {
    fakeLayout(320);
    const el = mount(RUN);
    const box = q(el, '.ai')!;
    // The measure takes it to 340, back to where it is now, then to the target.
    expect(widths(box, () => press(el, pill(el)))).toEqual(['340px', '182px', '320px']);
    expect(widths(box, () => press(el, head(el)))).toEqual(['340px', '320px', '182px']);
  });

  it('reduced motion: no spring from the old size — the new size at once', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query }));
    fakeLayout(320);
    const el = mount(RUN);
    const box = q(el, '.ai')!;
    expect(widths(box, () => press(el, pill(el)))).toEqual(['340px', '320px']);
  });

  it('a tick that makes the clock longer (9:59 → 10:00) refits the pill; other ticks touch no style', () => {
    fakeLayout(320);
    const el = mount({ ...RUN, startedAt: NOW - 599_000 });
    const box = q(el, '.ai')!;
    expect(q(el, '.ai-clock')?.textContent).toBe('9:59');
    expect(widths(box, () => vi.advanceTimersByTime(1000))).toEqual(['340px', '182px']);
    expect(q(el, '.ai-clock')?.textContent).toBe('10:00');
    expect(widths(box, () => vi.advanceTimersByTime(1000))).toEqual([]);
  });

  it('without a layout the box takes its face’s natural size (no explicit size)', () => {
    const el = mount(RUN);
    expect(q(el, '.ai')!.getAttribute('style')).toBeNull();
  });
});

describe('styles', () => {
  it('one spring for width, height and corners (with a fallback), the crossfade, reduced motion, tokens only', () => {
    expect(ISLAND_SPRING.startsWith('linear(0, ')).toBe(true);
    expect(ISLAND_SPRING.endsWith(', 1)')).toBe(true);
    expect(styles).toContain(
      `width 420ms ${ISLAND_SPRING}, height 420ms ${ISLAND_SPRING}, border-radius 420ms ${ISLAND_SPRING}`,
    );
    expect(styles).toContain('width 420ms var(--ease-out), height 420ms var(--ease-out)');
    expect(styles.indexOf('420ms var(--ease-out)')).toBeLessThan(styles.indexOf(`420ms ${ISLAND_SPRING}`));
    expect(styles).toMatch(/\.ai-face:not\(\[data-on\]\) \{[^}]*opacity: 0; scale: 0\.92; filter: blur\(6px\)/);
    expect(styles).toContain('.ai-face[data-on] { position: relative; transition-delay: 60ms; }');
    expect(styles).toContain('scale: 0.97');
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*scale: none; filter: none;/);
    expect(styles).toContain('@media (pointer: coarse), (max-width: 639px)');
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    vi.useRealTimers();
    spy = soundSpy();
  });
  afterEach(() => {
    spy.restore();
    Reflect.deleteProperty(navigator, 'userActivation');
  });
  const activation = (isActive: boolean) =>
    Object.defineProperty(navigator, 'userActivation', { configurable: true, get: () => ({ isActive }) });

  it('the person’s pill, head and Esc play open / close; an action plays tap', async () => {
    const el = mount(RUN);
    press(el, pill(el));
    await spy.settle();
    press(el, act(el, 'stop'));
    await spy.settle();
    press(el, head(el));
    await spy.settle();
    press(el, pill(el));
    await spy.settle();
    key(head(el), 'Escape');
    el.renderNow();
    await spy.settle();
    expect(spy.cues()).toEqual(['open', 'tap', 'close', 'open', 'close']);
    expect(spy.calls[4][1]?.input).toBe('keyboard');
  });

  it('silent for prevented events, data (status, open), the attribute and methods outside a gesture', async () => {
    const el = mount(RUN);
    const stopToggle = (e: Event) => e.preventDefault();
    el.addEventListener('ui-toggle', stopToggle);
    press(el, pill(el));
    el.removeEventListener('ui-toggle', stopToggle);
    el.data = { ...RUN, open: true };
    el.renderNow();
    el.addEventListener('ui-action', (e) => e.preventDefault());
    click(act(el, 'stop'));
    el.data = { ...RUN, open: true, status: 'done', endedAt: Date.now() };
    el.renderNow();
    el.removeAttribute('open');
    el.setAttribute('open', '');
    el.open = false;
    activation(false);
    el.show();
    el.hide();
    el.toggle();
    await spy.settle();
    expect(spy.calls).toEqual([]);
    // The host's own control, inside a click: it sounds.
    activation(true);
    el.hide();
    await spy.settle();
    expect(spy.cues()).toEqual(['close']);
  });
});

describe('doc', () => {
  it('names the source, has ≥3 demos that build islands, a Sound line and a Korean demo', () => {
    expect(doc.slug).toBe('agent-island');
    expect(doc.tag).toBe('ui-agent-island');
    expect(doc.group).toBe('Components');
    expect(doc.reference.url).toBe('https://bencho.dev/blocks/dynamic-island');
    expect(doc.reference.name).toContain('(MIT)');
    expect(doc.a11y.some((l) => l.startsWith('Sound (opt-in'))).toBe(true);
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    let total = 0;
    for (const d of doc.demos) {
      const node = d.create();
      document.body.append(node);
      const islands = Array.from(node.querySelectorAll<UiAgentIsland>('ui-agent-island'));
      for (const i of islands) i.renderNow();
      expect(islands.length).toBeGreaterThan(0);
      total += islands.length;
      for (const i of islands) expect(i.shadowRoot!.querySelector('.ai')).not.toBeNull();
    }
    expect(total).toBeGreaterThanOrEqual(7);
    const statuses = doc.demos.find((d) => d.id === 'statuses')!.create();
    document.body.append(statuses);
    const four = Array.from(statuses.querySelectorAll<UiAgentIsland>('ui-agent-island'));
    expect(four.map((i) => i.data?.status)).toEqual(['running', 'waiting', 'done', 'failed']);
    expect(four[2].data?.endedAt).toBeGreaterThan(0);
    const ko = doc.demos
      .find((d) => d.id === 'ko')!
      .create()
      .querySelector('ui-agent-island')!;
    expect(ko.getAttribute('lang')).toBe('ko');
    expect(ko.getAttribute('tone')).toBe('surface');
  });

  it('the running demo starts open; its Stop ends the run a moment later', () => {
    const node = doc.demos.find((d) => d.id === 'running')!.create();
    document.body.append(node);
    const el = node.querySelector('ui-agent-island') as UiAgentIsland;
    el.renderNow();
    expect(el.open).toBe(true);
    expect(q(el, '.ai-step')?.textContent).toBe('Running npm test — 1,942 tests');
    press(el, act(el, 'stop'));
    vi.advanceTimersByTime(800);
    el.renderNow();
    expect(el.data?.status).toBe('done');
    expect(q(el, '.ai-word')?.textContent).toBe('Done');
    expect(live(el)).toBe('Done: Fix flaky checkout test');
  });
});
