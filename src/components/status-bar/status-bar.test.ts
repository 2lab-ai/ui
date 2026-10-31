import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import tokens from '../../core/tokens.json';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import { resetSoundQueue } from '../../sound/sound';
import {
  STATUS_ARM_MS,
  type StatusBarActionDetail,
  type StatusBarData,
  statusBarIsLive,
  statusBarStatus,
  statusBarTime,
  statusTimeOfDay,
  type UiStatusBar,
} from './status-bar';
import { styles } from './styles';

const NOW = new Date(2026, 9, 30, 14, 30, 0).getTime();
const START = NOW - 300_000; // 14:25

function mount(data: StatusBarData | undefined, attrs: Record<string, string> = {}): UiStatusBar {
  const el = document.createElement('ui-status-bar') as UiStatusBar;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiStatusBar, s: string) => el.shadowRoot!.querySelector<E>(s);
const qa = <E extends Element = HTMLElement>(el: UiStatusBar, s: string) =>
  Array.from(el.shadowRoot!.querySelectorAll<E>(s));
const btn = (el: UiStatusBar, id: string) =>
  qa<HTMLButtonElement>(el, '.sb-btn').find((b) => b.dataset.id === id) as HTMLButtonElement;
const live = (el: UiStatusBar) => el.shadowRoot!.querySelector('[aria-live]')?.textContent ?? '';
const actions = (el: UiStatusBar) => {
  const got: StatusBarActionDetail[] = [];
  el.addEventListener('ui-action', (e) => got.push((e as CustomEvent<StatusBarActionDetail>).detail));
  return got;
};

const BASE: StatusBarData = {
  status: 'running',
  startedAt: START,
  actions: [
    { id: 'log', label: 'Open log', icon: 'file-text' },
    { id: 'stop', label: 'Stop', icon: 'stop', tone: 'danger' },
  ],
  link: { href: 'https://chat.example.com/t/123', label: 'Thread' },
};

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('pure helpers', () => {
  it('knows the statuses and which are live', () => {
    expect(statusBarStatus('failed')).toBe('failed');
    expect(statusBarStatus('nope')).toBe('idle');
    expect(statusBarStatus(undefined)).toBe('idle');
    expect(statusBarStatus('toString')).toBe('idle');
    expect(statusBarIsLive('running')).toBe(true);
    expect(statusBarIsLive('waiting')).toBe(true);
    for (const s of ['idle', 'done', 'failed', 'stopped', 'bogus']) expect(statusBarIsLive(s)).toBe(false);
  });

  it('picks the time: live, run time, active, start only, none', () => {
    expect(statusBarTime({ status: 'running', startedAt: START })).toEqual({ kind: 'live', since: START });
    expect(statusBarTime({ status: 'waiting', startedAt: START, endedAt: NOW })).toEqual({
      kind: 'live',
      since: START,
    });
    expect(statusBarTime({ status: 'done', startedAt: START, endedAt: NOW })).toEqual({
      kind: 'ran',
      since: START,
      ms: 300_000,
    });
    expect(statusBarTime({ status: 'idle', startedAt: START, activeMs: 360_000 })).toEqual({
      kind: 'active',
      ms: 360_000,
    });
    expect(statusBarTime({ status: 'running', activeMs: 360_000 })).toEqual({ kind: 'active', ms: 360_000 });
    expect(statusBarTime({ status: 'stopped', startedAt: START })).toEqual({ kind: 'started', since: START });
    expect(statusBarTime({ status: 'done', startedAt: START, endedAt: START - 5 })).toEqual({
      kind: 'started',
      since: START,
    });
    expect(statusBarTime({ status: 'done' })).toEqual({ kind: 'none' });
    expect(statusBarTime({ status: 'running', startedAt: Number.NaN, activeMs: -1 })).toEqual({ kind: 'none' });
  });

  it('formats a 24-hour time of day', () => {
    expect(statusTimeOfDay(new Date(2026, 0, 2, 14, 5).getTime())).toBe('14:05');
    expect(statusTimeOfDay(new Date(2026, 0, 2, 9, 0).getTime())).toBe('09:00');
    expect(statusTimeOfDay(0)).toBe('');
  });
});

describe('<ui-status-bar> rendering', () => {
  it('renders nothing without data', () => {
    const el = mount(undefined);
    expect(q(el, '.sb')).toBeNull();
  });

  it('draws the status as icon + word in its tone, the start time and the live elapsed clock', () => {
    const el = mount(BASE);
    const chip = q(el, '.sb-chip')!;
    expect(chip.className).toBe('sb-chip is-running');
    expect(q(el, '.sb-word')?.textContent).toBe('Running');
    expect(q(el, '.sb-icon .sb-spin')).not.toBeNull();
    expect(q(el, '.sb-icon')?.getAttribute('aria-hidden')).toBe('true');
    expect(q(el, '.sb-start')?.textContent).toBe('Started 14:25');
    expect(q(el, '.sb-tick')?.textContent).toBe('5m 00s');
    expect(q(el, '.sb-time')?.getAttribute('title')).toBe('Started · elapsed');
    expect(q(el, '.sb-time')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Started 14:25 · 5m 00s');
    expect(q(el, '.sb')?.getAttribute('role')).toBe('group');
    expect(q(el, 'slot')).not.toBeNull();
  });

  it('draws every status with an icon and its word', () => {
    const words = {
      running: 'Running',
      waiting: 'Needs input',
      idle: 'Idle',
      done: 'Done',
      failed: 'Failed',
      stopped: 'Stopped',
    } as const;
    for (const [status, word] of Object.entries(words)) {
      const el = mount({ status: status as StatusBarData['status'] });
      expect(q(el, '.sb-chip')?.classList.contains(`is-${status}`)).toBe(true);
      expect(q(el, '.sb-word')?.textContent).toBe(word);
      expect(q(el, '.sb-icon')?.innerHTML).not.toBe('');
    }
    expect(q(mount({ status: 'weird' as never }), '.sb-word')?.textContent).toBe('Idle');
  });

  it('takes overriding words, escaped', () => {
    const el = mount({ status: 'waiting', words: { waiting: '<b>Waiting</b> for review' } });
    expect(q(el, '.sb-word')?.innerHTML).toBe('&lt;b&gt;Waiting&lt;/b&gt; for review');
    expect(q(el, '.sb-word b')).toBeNull();
    expect(q(mount({ status: 'done', words: { waiting: 'x', done: '' } }), '.sb-word')?.textContent).toBe('Done');
  });

  it('shows a finished run’s run time, active time, or the start alone — no ticking clock', () => {
    const ran = mount({ status: 'done', startedAt: START, endedAt: NOW - 100_000 });
    expect(q(ran, '.sb-time')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Started 14:25 · 3m 20s');
    expect(q(ran, '.sb-time')?.getAttribute('title')).toBe('Started · run time');
    expect(q(ran, '.sb-tick')).toBeNull();
    const active = mount({ status: 'idle', activeMs: 360_000 });
    expect(q(active, '.sb-time')?.textContent).toBe('Active 6m 00s');
    expect(q(active, '.sb-time')?.getAttribute('title')).toBe('Active time');
    const started = mount({ status: 'stopped', startedAt: START });
    expect(q(started, '.sb-time')?.textContent).toBe('Started 14:25');
    expect(q(mount({ status: 'done' }), '.sb-time')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('renders actions: icon, label, primary / danger classes, disabled reason, busy', () => {
    const el = mount({
      status: 'running',
      actions: [
        { id: 'resume', label: 'Resume', icon: 'play', primary: true },
        { id: 'stop', label: 'Stop', tone: 'danger' },
        { id: 'archive', label: 'Archive', disabled: 'Read-only — not your session' },
        { id: 'retry', label: 'Retry', busy: true },
        { id: 'odd', label: 'Odd', icon: 'no-such-glyph' },
      ],
    });
    const b = qa<HTMLButtonElement>(el, '.sb-btn');
    expect(b.map((x) => x.dataset.id)).toEqual(['resume', 'stop', 'archive', 'retry', 'odd']);
    expect(b[0].className).toBe('sb-btn is-primary');
    expect(b[0].querySelector('svg')?.getAttribute('data-icon')).toBe('play');
    expect(b[1].className).toBe('sb-btn is-danger');
    expect(b[2].disabled).toBe(true);
    expect(b[2].title).toBe('Read-only — not your session');
    expect(b[3].disabled).toBe(true);
    expect(b[3].getAttribute('aria-busy')).toBe('true');
    expect(b[3].querySelector('.sb-spin')).not.toBeNull();
    expect(b[4].querySelector('.sb-bi')).toBeNull();
    expect(b.every((x) => x.type === 'button' && x.dataset.key)).toBe(true);
  });

  it('names, tips, presses and quiets an action: ariaLabel, title, pressed, tone quiet (D3 G6-1)', () => {
    const el = mount({
      status: 'running',
      actions: [
        { id: 'close', label: 'Close', ariaLabel: 'Close — end the session', title: 'Ends the session for everyone' },
        { id: 'star', label: '★ Starred', icon: 'star', pressed: true, title: 'Kept at the top of the board' },
        { id: 'unstar', label: '☆ Star', icon: 'star', pressed: false },
        { id: 'trash', label: 'Trash', icon: 'trash', tone: 'quiet' },
        { id: 'ro', label: 'Archive', title: 'Archive it', disabled: 'Read-only' },
        { id: 'stop', label: 'Stop', tone: 'danger', ariaLabel: 'Stop — halt the session' },
        { id: 'blank', label: 'Blank', ariaLabel: '  ', title: ' ' },
      ],
    });
    const b = qa<HTMLButtonElement>(el, '.sb-btn');
    expect(b[0].getAttribute('aria-label')).toBe('Close — end the session');
    expect(b[0].title).toBe('Ends the session for everyone');
    expect(b[0].hasAttribute('aria-pressed')).toBe(false);
    expect(b[1].getAttribute('aria-pressed')).toBe('true');
    expect(b[1].title).toBe('Kept at the top of the board');
    expect(b[2].getAttribute('aria-pressed')).toBe('false');
    expect(b[3].className).toBe('sb-btn is-quiet');
    expect(b[4].title).toBe('Read-only');
    expect(b[5].getAttribute('aria-label')).toBe('Stop — halt the session');
    expect(b[6].hasAttribute('aria-label')).toBe(false);
    expect(b[6].hasAttribute('title')).toBe(false);
    // Armed: the “Press again” name wins over the host's name.
    b[5].click();
    el.renderNow();
    expect(btn(el, 'stop').getAttribute('aria-label')).toBe('Press again to confirm: Stop');
    expect(styles).toContain(
      '.sb-btn.is-quiet { border-color: transparent; background: transparent; color: var(--ib-text-2); }',
    );
    expect(styles).toContain('.sb-btn[aria-pressed="true"]:not(.is-primary) { background: var(--ib-seg-on);');
  });

  it('escapes every action field and the link', () => {
    const evil = '"><img src=x onerror=alert(1)>';
    const el = mount({
      status: 'idle',
      words: { idle: evil },
      actions: [{ id: evil, label: evil, disabled: evil }],
      link: { href: 'https://x.test/?q="><img src=x>', label: evil, id: evil },
    });
    expect(q(el, 'img')).toBeNull();
    const b = qa<HTMLButtonElement>(el, '.sb-btn')[0];
    expect(b.dataset.id).toBe(evil);
    expect(b.title).toBe(evil);
    expect(b.textContent).toBe(evil);
    const a = q<HTMLAnchorElement>(el, '.sb-link')!;
    expect(a.getAttribute('href')).toBe('https://x.test/?q="><img src=x>');
    expect(a.textContent).toBe(evil);
    expect(a.getAttribute('aria-label')).toBe(`${evil} (opens in a new tab)`);
  });

  it('renders the link only for a safe href, in a new tab', () => {
    const el = mount(BASE);
    const a = q<HTMLAnchorElement>(el, '.sb-link')!;
    expect(a.getAttribute('href')).toBe('https://chat.example.com/t/123');
    expect(a.target).toBe('_blank');
    expect(a.rel).toBe('noopener noreferrer');
    expect(a.getAttribute('aria-label')).toBe('Thread (opens in a new tab)');
    expect(a.querySelector('svg')?.getAttribute('data-icon')).toBe('external');
    expect(q(mount({ ...BASE, link: { href: 'javascript:alert(1)', label: 'x' } }), '.sb-link')).toBeNull();
    expect(q(mount({ ...BASE, link: { href: '', label: 'x' } }), '.sb-link')).toBeNull();
    expect(q(mount({ status: 'done' }), '.sb-actions')).toBeNull();
  });

  it('takes slotted content in the row', () => {
    const el = document.createElement('ui-status-bar') as UiStatusBar;
    el.innerHTML = '<span class="extra">Retry 2/3 at 14:40</span>';
    document.body.append(el);
    el.data = BASE;
    el.renderNow();
    const slot = q<HTMLSlotElement>(el, 'slot')!;
    expect(slot.assignedNodes().some((n) => (n as Element).className === 'extra')).toBe(true);
  });
});

describe('<ui-status-bar> events', () => {
  it('sends ui-action for a plain action and does nothing for disabled or busy ones', () => {
    const el = mount({
      ...BASE,
      actions: [
        { id: 'log', label: 'Open log' },
        { id: 'off', label: 'Off', disabled: true },
        { id: 'busy', label: 'Busy', busy: true },
      ],
    });
    const got = actions(el);
    btn(el, 'log').click();
    btn(el, 'off').click();
    btn(el, 'busy').click();
    expect(got).toEqual([{ id: 'log' }]);
    btn(el, 'log').click();
    expect(got).toHaveLength(2);
  });

  it('ui-action bubbles, is composed and cancelable', () => {
    const el = mount(BASE);
    let ev: CustomEvent | undefined;
    const off = new AbortController();
    document.addEventListener(
      'ui-action',
      (e) => {
        ev = e as CustomEvent;
      },
      { signal: off.signal },
    );
    btn(el, 'log').click();
    off.abort();
    expect(ev?.bubbles).toBe(true);
    expect(ev?.composed).toBe(true);
    expect(ev?.cancelable).toBe(true);
  });

  it('a danger action takes two presses within 4 s: the first arms it, the second sends', async () => {
    const el = mount(BASE);
    const got = actions(el);
    btn(el, 'stop').click();
    await Promise.resolve();
    expect(got).toEqual([]);
    const armed = btn(el, 'stop');
    expect(armed.hasAttribute('data-armed')).toBe(true);
    expect(armed.querySelector('.sb-bt')?.textContent).toBe('Press again');
    expect(armed.getAttribute('aria-label')).toBe('Press again to confirm: Stop');
    expect(armed.querySelector('svg')?.getAttribute('data-icon')).toBe('alert');
    expect(live(el)).toBe('Press again to confirm: Stop');
    armed.click();
    await Promise.resolve();
    expect(got).toEqual([{ id: 'stop' }]);
    // Confirmed and not cancelled: busy until the host sends new data.
    expect(btn(el, 'stop').disabled).toBe(true);
    expect(btn(el, 'stop').getAttribute('aria-busy')).toBe('true');
    expect(btn(el, 'stop').hasAttribute('data-armed')).toBe(false);
    btn(el, 'stop').click();
    expect(got).toHaveLength(1);
    el.data = { ...BASE, status: 'stopped' };
    el.renderNow();
    expect(btn(el, 'stop').disabled).toBe(false);
  });

  it('preventDefault on a confirmed danger action keeps it pressable', async () => {
    const el = mount(BASE);
    el.addEventListener('ui-action', (e) => e.preventDefault());
    btn(el, 'stop').click();
    await Promise.resolve();
    btn(el, 'stop').click();
    await Promise.resolve();
    const b = btn(el, 'stop');
    expect(b.disabled).toBe(false);
    expect(b.hasAttribute('aria-busy')).toBe(false);
    expect(b.querySelector('.sb-bt')?.textContent).toBe('Stop');
  });

  it('disarms after 4 s, on Escape, and when focus leaves the armed button', async () => {
    const el = mount(BASE);
    const got = actions(el);
    btn(el, 'stop').click();
    await Promise.resolve();
    vi.advanceTimersByTime(STATUS_ARM_MS + 1);
    await Promise.resolve();
    expect(btn(el, 'stop').hasAttribute('data-armed')).toBe(false);
    btn(el, 'stop').click();
    expect(got).toEqual([]);

    // Escape (stays inside: the page's own Escape handler does not also close something).
    await Promise.resolve();
    expect(btn(el, 'stop').hasAttribute('data-armed')).toBe(true);
    let outer = 0;
    const off = new AbortController();
    document.addEventListener('keydown', () => outer++, { signal: off.signal });
    btn(el, 'stop').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await Promise.resolve();
    expect(btn(el, 'stop').hasAttribute('data-armed')).toBe(false);
    expect(outer).toBe(0);
    btn(el, 'stop').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    expect(outer).toBe(1);
    off.abort();

    // Focus leaves.
    btn(el, 'stop').click();
    await Promise.resolve();
    btn(el, 'stop').dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, composed: true, relatedTarget: btn(el, 'log') }),
    );
    await Promise.resolve();
    expect(btn(el, 'stop').hasAttribute('data-armed')).toBe(false);
    btn(el, 'stop').click();
    expect(got).toEqual([]);
  });

  it('disarms when new data disables or removes the armed action', async () => {
    const el = mount(BASE);
    btn(el, 'stop').click();
    await Promise.resolve();
    el.data = { ...BASE, actions: [{ id: 'stop', label: 'Stop', tone: 'danger', disabled: 'Not yours' }] };
    el.renderNow();
    expect(btn(el, 'stop').hasAttribute('data-armed')).toBe(false);
    el.data = BASE;
    el.renderNow();
    const got = actions(el);
    btn(el, 'stop').click();
    expect(got).toEqual([]);
  });

  it('the link sends ui-action with its href; preventDefault stops the navigation', () => {
    const el = mount({ ...BASE, link: { ...BASE.link!, id: 'thread' } });
    const got = actions(el);
    const seen: boolean[] = [];
    // Last in line: records whether the element cancelled the click, then stops the test page from navigating.
    const guard = (e: Event) => {
      seen.push(e.defaultPrevented);
      e.preventDefault();
    };
    window.addEventListener('click', guard);
    q<HTMLAnchorElement>(el, '.sb-link')!.click();
    expect(got).toEqual([{ id: 'thread', href: 'https://chat.example.com/t/123' }]);
    expect(seen).toEqual([false]);
    el.addEventListener('ui-action', (e) => e.preventDefault());
    q<HTMLAnchorElement>(el, '.sb-link')!.click();
    expect(seen).toEqual([false, true]);
    window.removeEventListener('click', guard);
  });

  it('keeps focus on the same button through a data update', () => {
    const el = mount(BASE);
    const b = btn(el, 'log');
    b.focus();
    el.data = { ...BASE, status: 'waiting' };
    el.renderNow();
    expect(btn(el, 'log')).toBe(b);
    expect(el.shadowRoot!.activeElement).toBe(b);
  });

  it('announces status changes, not the first status', () => {
    const el = mount(BASE);
    expect(live(el)).toBe('');
    el.data = { ...BASE, status: 'done', endedAt: NOW };
    el.renderNow();
    expect(live(el)).toBe('Status: Done');
    el.data = { ...BASE, status: 'done', endedAt: NOW, words: { failed: 'x' } };
    el.renderNow();
    expect(live(el)).toBe('Status: Done');
  });
});

describe('<ui-status-bar> clock', () => {
  it('ticks once a second, updating the same text node in place', () => {
    const el = mount(BASE);
    const tick = q(el, '.sb-tick')!;
    const node = tick.firstChild;
    const chip = q(el, '.sb-chip');
    vi.advanceTimersByTime(3000);
    expect(q(el, '.sb-tick')).toBe(tick);
    expect(tick.firstChild).toBe(node);
    expect(tick.textContent).toBe('5m 03s');
    expect(q(el, '.sb-chip')).toBe(chip);
  });

  it('stops ticking when the run is no longer live, and on disconnect; restarts on reconnect', () => {
    const el = mount(BASE);
    expect(vi.getTimerCount()).toBe(1);
    el.data = { ...BASE, status: 'done', endedAt: NOW + 1000 };
    el.renderNow();
    expect(vi.getTimerCount()).toBe(0);
    expect(q(el, '.sb-tick')).toBeNull();
    el.data = BASE;
    el.renderNow();
    expect(vi.getTimerCount()).toBe(1);
    const tick = q(el, '.sb-tick')!;
    el.remove();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(tick.textContent).toBe('5m 00s');
    document.body.append(el);
    el.renderNow();
    expect(vi.getTimerCount()).toBe(1);
    expect(q(el, '.sb-tick')?.textContent).toBe('5m 05s');
  });

  it('keeps the clock’s node when new data arrives', () => {
    const el = mount(BASE);
    const tick = q(el, '.sb-tick')!;
    vi.advanceTimersByTime(1000);
    el.data = { ...BASE, actions: [] };
    el.renderNow();
    expect(q(el, '.sb-tick')).toBe(tick);
    expect(tick.textContent).toBe('5m 01s');
  });
});

describe('lang="ko"', () => {
  it('speaks Korean', async () => {
    const el = mount({ ...BASE, status: 'waiting' }, { lang: 'ko' });
    expect(q(el, '.sb-word')?.textContent).toBe('입력 대기');
    expect(q(el, '.sb-start')?.textContent).toBe('시작 14:25');
    expect(q(el, '.sb-time')?.getAttribute('title')).toBe('시작 · 경과');
    expect(q(el, '.sb')?.getAttribute('aria-label')).toBe('상태');
    expect(q(el, '.sb-link')?.getAttribute('aria-label')).toBe('Thread (새 탭에서 열림)');
    btn(el, 'stop').click();
    await Promise.resolve();
    expect(btn(el, 'stop').querySelector('.sb-bt')?.textContent).toBe('한 번 더 눌러 확인');
    expect(btn(el, 'stop').getAttribute('aria-label')).toBe('한 번 더 눌러 확인: Stop');
    expect(q(mount({ status: 'idle', activeMs: 60_000 }, { lang: 'ko' }), '.sb-time')?.textContent).toBe(
      '활성 1분 00초',
    );
    // The live clock too (0.15.1): Korean words under lang="ko", never 9m 22s.
    const liveBar = mount({ status: 'running', startedAt: Date.now() - 562_000 }, { lang: 'ko' });
    expect(q(liveBar, '.sb-tick')?.textContent ?? '').toMatch(/^9분 2\d초$/);
    el.data = { ...BASE, status: 'failed' };
    el.renderNow();
    expect(live(el)).toBe('상태: 실패');
  });

  it('switches language when the attribute changes', async () => {
    const el = mount({ status: 'done' });
    el.setAttribute('lang', 'ko');
    await Promise.resolve();
    expect(q(el, '.sb-word')?.textContent).toBe('완료');
    el.removeAttribute('lang');
    await Promise.resolve();
    expect(q(el, '.sb-word')?.textContent).toBe('Done');
  });
});

describe('styles', () => {
  it('use tokens only — no hex or rgb literals — and known token names', () => {
    const css = styles.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(rgba?|hsla?)\(/i);
    const known = new Set([...Object.keys(tokens.light), ...Object.keys(tokens.shared)]);
    for (const m of css.matchAll(/var\(--([a-z0-9-]+)/g))
      if (!m[1].startsWith('sb-')) expect(known.has(m[1]), m[1]).toBe(true);
  });

  it('gate hover to fine pointers without movement, give 44px coarse targets, and stop motion when reduced', () => {
    const hover = styles.slice(styles.indexOf('@media (hover: hover) and (pointer: fine)'));
    expect(hover.slice(0, hover.indexOf('\n}\n'))).not.toMatch(/transform|translate|scale\(/);
    expect(styles.slice(0, styles.indexOf('@media (hover: hover)'))).not.toMatch(/:hover/);
    expect(styles).toMatch(/@media \(pointer: coarse\), \(max-width: 639px\) \{\s*\.sb-btn \{ min-height: 44px;/);
    const rm = styles.slice(styles.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(rm).toContain('transform: none');
    expect(rm).toContain('.sb-spin { animation: none; }');
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    spy = soundSpy();
  });
  afterEach(() => spy.restore());
  /** Fake timers: play what the queue holds, then start a fresh gesture. */
  const settle = () => {
    vi.advanceTimersByTime(40);
    resetSoundQueue();
  };
  const click = (el: UiStatusBar, b: Element | null | undefined) => {
    b?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail: 1 }));
    el.renderNow();
    settle();
  };

  it('a plain action taps; a danger one arms with a subtle tap and taps when confirmed', () => {
    const el = mount(BASE);
    click(el, btn(el, 'log'));
    click(el, btn(el, 'stop'));
    click(el, btn(el, 'stop'));
    click(el, btn(el, 'stop'));
    expect(spy.calls).toEqual([
      ['tap', { input: 'mouse' }],
      ['tap', { emphasis: 'subtle', input: 'mouse' }],
      ['tap', { input: 'mouse' }],
    ]);
  });

  it('the link plays navigate; prevented actions and links are silent', () => {
    const el = mount(BASE);
    const guard = (e: Event) => e.preventDefault();
    window.addEventListener('click', guard);
    click(el, q(el, '.sb-link'));
    expect(spy.calls).toEqual([['navigate', { input: 'mouse' }]]);
    el.addEventListener('ui-action', (e) => e.preventDefault());
    click(el, q(el, '.sb-link'));
    click(el, btn(el, 'log'));
    click(el, btn(el, 'stop'));
    click(el, btn(el, 'stop'));
    window.removeEventListener('click', guard);
    expect(spy.calls).toEqual([
      ['navigate', { input: 'mouse' }],
      ['tap', { emphasis: 'subtle', input: 'mouse' }],
    ]);
  });

  it('el.data from code is silent, and so is a bar inside data-ui-sound="off"', () => {
    const el = mount(BASE);
    el.data = { ...BASE, status: 'stopped' };
    el.renderNow();
    settle();
    expect(spy.calls).toEqual([]);
    const quiet = document.createElement('div');
    quiet.setAttribute('data-ui-sound', 'off');
    document.body.append(quiet);
    const muted = document.createElement('ui-status-bar') as UiStatusBar;
    quiet.append(muted);
    muted.data = BASE;
    muted.renderNow();
    click(muted, btn(muted, 'log'));
    click(muted, btn(muted, 'stop'));
    expect(spy.calls).toEqual([]);
  });
});
