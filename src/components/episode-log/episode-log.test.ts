import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import tokens from '../../core/tokens.json';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import {
  EPISODE_ARM_MS,
  type EpisodeAddDetail,
  type EpisodeDateDetail,
  type EpisodeDeleteDetail,
  type EpisodeEditDetail,
  type EpisodeLogData,
  episodeDates,
  episodeDays,
  episodeKey,
  episodeTime,
  fmtEpisodeDay,
  type UiEpisodeLog,
} from './episode-log';
import { styles } from './styles';

const TODAY = '2026-10-30';
const DATA: EpisodeLogData = {
  today: TODAY,
  timeLabel: 'UTC',
  days: [
    {
      date: '2026-10-29',
      revision: 'r29',
      entries: [{ id: 'b1', time: '17:40', text: 'Release notes drafted; waiting for the changelog review.' }],
    },
    {
      date: TODAY,
      revision: 'r30',
      entries: [
        { id: 'a1', time: '09:12', text: 'Moved the staging deploy to 14:00 after the database migration.' },
        { id: 'a2', time: '11:05', text: 'The weekly report now goes to the whole team.' },
      ],
    },
  ],
};

function mount(data: EpisodeLogData | undefined, attrs: Record<string, string> = {}): UiEpisodeLog {
  const el = document.createElement('ui-episode-log') as UiEpisodeLog;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiEpisodeLog, s: string) => el.shadowRoot!.querySelector<E>(s);
const qa = <E extends Element = HTMLElement>(el: UiEpisodeLog, s: string) =>
  Array.from(el.shadowRoot!.querySelectorAll<E>(s));
function listen<T>(el: Element, name: string, prevent = false): T[] {
  const got: T[] = [];
  el.addEventListener(name, (e) => {
    got.push((e as CustomEvent<T>).detail);
    if (prevent) e.preventDefault();
  });
  return got;
}
const btn = (el: UiEpisodeLog, act: string, i = 0) => qa<HTMLButtonElement>(el, `[data-act="${act}"]`)[i];
function type(ta: HTMLTextAreaElement, value: string): void {
  ta.value = value;
  ta.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
}
function key(target: Element, k: string, init: KeyboardEventInit = {}): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...init }),
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('helpers', () => {
  it('names days: Today, Yesterday, then a short date (a year when it differs)', () => {
    expect(fmtEpisodeDay(TODAY, 'en', TODAY)).toBe('Today');
    expect(fmtEpisodeDay('2026-10-29', 'en', TODAY)).toBe('Yesterday');
    expect(fmtEpisodeDay('2026-10-27', 'en', TODAY)).toMatch(/Oct 27/);
    expect(fmtEpisodeDay('2025-12-31', 'en', TODAY)).toMatch(/2025/);
    expect(fmtEpisodeDay('2026-10-29', 'ko', TODAY)).toBe('어제');
    expect(fmtEpisodeDay('not a date', 'en', TODAY)).toBe('not a date');
  });

  it('shows days newest first, one when filtered, and lists the filter dates without repeats', () => {
    expect(episodeDays(DATA.days).map((d) => d.date)).toEqual([TODAY, '2026-10-29']);
    expect(episodeDays(DATA.days, '2026-10-29').map((d) => d.date)).toEqual(['2026-10-29']);
    expect(episodeDates({ days: DATA.days, dates: ['2026-10-01', TODAY, '2026-10-01'] })).toEqual([
      TODAY,
      '2026-10-01',
    ]);
    expect(episodeDates({ days: DATA.days })).toEqual([TODAY, '2026-10-29']);
  });

  it('keys entries by id, else by day, time and text; times from `at` when `time` is absent', () => {
    expect(episodeKey(TODAY, { id: 'x', text: 'a' })).toBe('id:x');
    expect(episodeKey(TODAY, { time: '09:00', text: 'a' })).toBe(`${TODAY}|09:00|a`);
    expect(episodeTime({ text: '', at: new Date(2026, 9, 30, 8, 5).getTime() })).toBe('08:05');
    expect(episodeTime({ text: '', at: 'nope' })).toBe('');
  });
});

describe('<ui-episode-log>', () => {
  it('groups entries by day, newest first, with times, counts and the time label', () => {
    const el = mount(DATA);
    expect(qa(el, '.el-day > span').map((s) => s.textContent)).toEqual(['Today', 'Yesterday']);
    expect(qa(el, '.el-day small').map((s) => s.textContent)).toEqual(['2 entries', '1 entry']);
    expect(qa(el, '.el-time')[0].textContent).toBe('09:12 UTC');
    expect(qa(el, '.el-text')[1].textContent).toBe('The weekly report now goes to the whole team.');
  });

  it('escapes every string', () => {
    const evil = '<img src=x onerror=alert(1)>';
    const el = mount({
      days: [{ date: evil, entries: [{ id: evil, time: evil, text: evil }] }],
      dates: [evil],
      timeLabel: evil,
      status: evil,
      error: evil,
      addLabel: evil,
      placeholder: evil,
    });
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    expect(el.shadowRoot!.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('filters by day: not prevented, a loaded day shows at once; prevented, the host keeps it', () => {
    const el = mount(DATA);
    const got = listen<EpisodeDateDetail>(el, 'ui-date');
    const sel = q<HTMLSelectElement>(el, 'select')!;
    sel.value = '2026-10-29';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    el.renderNow();
    expect(got).toEqual([{ date: '2026-10-29' }]);
    expect(qa(el, '.el-day > span').map((s) => s.textContent)).toEqual(['Yesterday']);
    // The host updating data without naming another date keeps the reader's pick.
    el.data = { ...DATA, status: 'Saved' };
    el.renderNow();
    expect(qa(el, '.el-day > span').map((s) => s.textContent)).toEqual(['Yesterday']);
    const el2 = mount(DATA);
    listen<EpisodeDateDetail>(el2, 'ui-date', true);
    const sel2 = q<HTMLSelectElement>(el2, 'select')!;
    sel2.value = '2026-10-29';
    sel2.dispatchEvent(new Event('change', { bubbles: true }));
    el2.renderNow();
    expect(qa(el2, '.el-day')).toHaveLength(2);
  });

  it('edits in place: Save is the ink button, ⌘↵ sends ui-edit with the original text and revision', () => {
    const el = mount(DATA);
    const got = listen<EpisodeEditDetail>(el, 'ui-edit');
    btn(el, 'edit').click();
    const ta = q<HTMLTextAreaElement>(el, '.el-edit')!;
    expect(ta.value).toBe('Moved the staging deploy to 14:00 after the database migration.');
    expect(btn(el, 'save').disabled).toBe(true);
    type(ta, 'Moved the staging deploy to 15:00.');
    expect(btn(el, 'save').disabled).toBe(false);
    key(ta, 'Enter', { metaKey: true });
    expect(got).toEqual([
      {
        date: TODAY,
        index: 0,
        id: 'a1',
        original: 'Moved the staging deploy to 14:00 after the database migration.',
        text: 'Moved the staging deploy to 15:00.',
        revision: 'r30',
      },
    ]);
    expect(btn(el, 'save').textContent).toBe('Saving…');
    // The host answers with the saved entry: the editor closes.
    el.data = {
      ...DATA,
      days: [
        DATA.days[0],
        {
          ...DATA.days[1],
          entries: [{ id: 'a1', time: '09:12', text: 'Moved the staging deploy to 15:00.' }, DATA.days[1].entries[1]],
        },
      ],
    };
    el.renderNow();
    expect(q(el, '.el-edit')).toBeNull();
    expect(qa(el, '.el-text')[0].textContent).toBe('Moved the staging deploy to 15:00.');
  });

  it('refuses an empty entry, and Esc cancels back to the Edit button', () => {
    const el = mount(DATA);
    btn(el, 'edit').click();
    const ta = q<HTMLTextAreaElement>(el, '.el-edit')!;
    type(ta, '   ');
    el.renderNow();
    expect(q(el, '.el-hint.is-error')?.textContent).toContain('empty entry');
    expect(btn(el, 'save').disabled).toBe(true);
    key(q(el, '.el-edit')!, 'Escape');
    expect(q(el, '.el-edit')).toBeNull();
  });

  it('keeps the draft when the host updates data, and moves it to the note box when the entry changed meanwhile', () => {
    const el = mount(DATA);
    btn(el, 'edit').click();
    type(q<HTMLTextAreaElement>(el, '.el-edit')!, 'My half-typed edit');
    el.data = { ...DATA, status: 'Synced' };
    el.renderNow();
    expect(q<HTMLTextAreaElement>(el, '.el-edit')?.value).toBe('My half-typed edit');
    // Someone else changed the entry: the draft goes to the note box with a notice.
    el.data = {
      ...DATA,
      days: [
        DATA.days[0],
        { ...DATA.days[1], entries: [{ id: 'a1', time: '09:12', text: 'Changed elsewhere' }, DATA.days[1].entries[1]] },
      ],
    };
    el.renderNow();
    expect(q(el, '.el-edit')).toBeNull();
    expect(q<HTMLTextAreaElement>(el, '.el-note')?.value).toBe('My half-typed edit');
    expect(el.note).toBe('My half-typed edit');
    expect(q(el, '.el-notice')?.textContent).toContain('09:12');
  });

  it('deletes with two presses; the arm times out and Esc disarms', () => {
    const el = mount(DATA);
    const got = listen<EpisodeDeleteDetail>(el, 'ui-delete');
    btn(el, 'delete').click();
    expect(btn(el, 'delete').textContent).toBe('Delete?');
    expect(got).toHaveLength(0);
    vi.advanceTimersByTime(EPISODE_ARM_MS + 10);
    el.renderNow();
    expect(btn(el, 'delete').textContent).toBe('Delete');
    btn(el, 'delete').click();
    key(btn(el, 'delete'), 'Escape');
    el.renderNow();
    expect(btn(el, 'delete').textContent).toBe('Delete');
    btn(el, 'delete').click();
    btn(el, 'delete').click();
    expect(got).toEqual([
      {
        date: TODAY,
        index: 0,
        id: 'a1',
        text: 'Moved the staging deploy to 14:00 after the database migration.',
        revision: 'r30',
      },
    ]);
  });

  it('adds a note: ui-add, then the box empties once the entry lands; prevented, nothing is held', () => {
    const el = mount(DATA);
    const got = listen<EpisodeAddDetail>(el, 'ui-add');
    const box = q<HTMLTextAreaElement>(el, '.el-note')!;
    expect(btn(el, 'add').disabled).toBe(true);
    type(box, 'Remember: Friday is a freeze day.');
    expect(btn(el, 'add').disabled).toBe(false);
    key(box, 'Enter', { ctrlKey: true });
    expect(got).toEqual([{ text: 'Remember: Friday is a freeze day.' }]);
    el.data = { ...DATA, busy: true };
    el.renderNow();
    expect(btn(el, 'add').textContent).toBe('Adding…');
    el.data = {
      ...DATA,
      days: [
        DATA.days[0],
        {
          ...DATA.days[1],
          entries: [...DATA.days[1].entries, { id: 'a3', time: '12:00', text: 'Remember: Friday is a freeze day.' }],
        },
      ],
    };
    el.renderNow();
    expect(q<HTMLTextAreaElement>(el, '.el-note')?.value).toBe('');
    // A new entry after the first paint rises in.
    expect(qa(el, '.el-entry.is-new')).toHaveLength(1);
    const el2 = mount(DATA);
    listen<EpisodeAddDetail>(el2, 'ui-add', true);
    type(q<HTMLTextAreaElement>(el2, '.el-note')!, 'x');
    btn(el2, 'add').click();
    expect(q<HTMLTextAreaElement>(el2, '.el-note')?.disabled).toBe(false);
  });

  it('keeps a refused note in the box', () => {
    const el = mount(DATA);
    type(q<HTMLTextAreaElement>(el, '.el-note')!, 'A note');
    btn(el, 'add').click();
    el.data = { ...DATA, error: 'Couldn’t add the note (HTTP 503).' };
    el.renderNow();
    expect(q<HTMLTextAreaElement>(el, '.el-note')?.value).toBe('A note');
    expect(q(el, '[role="alert"]')?.textContent).toContain('HTTP 503');
  });

  it('has empty states, a skeleton, and a read-only mode', () => {
    expect(q(mount({ days: [] }), '.el-empty')?.textContent).toContain('No entries yet');
    const day = mount({ days: [{ date: TODAY, entries: [] }], date: TODAY, today: TODAY });
    expect(q(day, '.el-empty')?.textContent).toContain('Nothing recorded on this day');
    expect(qa(mount({ days: [], loading: true }), '.el-sk-row')).toHaveLength(3);
    const ro = mount({ ...DATA, readOnly: true });
    expect(q(ro, '[data-act="edit"]')).toBeNull();
    expect(q(ro, '.el-note')).toBeNull();
  });

  it('speaks Korean with lang="ko"', () => {
    const el = mount(DATA, { lang: 'ko' });
    expect(qa(el, '.el-day > span').map((s) => s.textContent)).toEqual(['오늘', '어제']);
    expect(btn(el, 'edit').textContent).toBe('수정');
    expect(q(el, '.el-add-label')?.textContent).toBe('오늘 기록에 메모 추가');
    expect(q(el, 'option')?.textContent).toBe('모든 날짜');
  });
});

describe('<ui-episode-log> sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    spy = soundSpy({ typing: true });
  });
  afterEach(() => spy.restore());
  // Fake timers (performance.now too): advancing them plays the queue and starts a fresh gesture.
  const settle = () => vi.advanceTimersByTime(300);
  const press = (t: Element, detail = 1) =>
    t.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail }));
  const pick = (el: UiEpisodeLog, date: string) => {
    const sel = q<HTMLSelectElement>(el, 'select')!;
    sel.value = date;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    el.renderNow();
  };

  it('adding a note and saving an edit play tap (button or ⌘↵)', () => {
    const el = mount(DATA);
    type(q<HTMLTextAreaElement>(el, '.el-note')!, 'A note');
    press(btn(el, 'add'));
    settle();
    btn(el, 'edit').click();
    settle();
    const ta = q<HTMLTextAreaElement>(el, '.el-edit')!;
    type(ta, 'Moved the staging deploy to 15:00.');
    key(ta, 'Enter', { metaKey: true });
    settle();
    expect(spy.calls).toEqual([
      ['tap', { input: 'mouse' }],
      ['tap', { input: 'keyboard' }],
    ]);
  });

  it('Delete: the arming press is a subtle tap, the confirming press a strong close', () => {
    const el = mount(DATA);
    press(btn(el, 'delete'));
    settle();
    press(btn(el, 'delete'), 0);
    settle();
    expect(spy.calls).toEqual([
      ['tap', { emphasis: 'subtle', input: 'mouse' }],
      ['close', { emphasis: 'strong', input: 'keyboard' }],
    ]);
  });

  it('a day picked plays a subtle navigate: a later day forward, an earlier one or All days back', () => {
    const el = mount(DATA);
    for (const date of ['2026-10-29', TODAY, '2026-10-29', '']) {
      pick(el, date);
      settle();
    }
    const nav = (direction: string) => ['navigate', { emphasis: 'subtle', direction }];
    expect(spy.calls).toEqual([nav('forward'), nav('forward'), nav('back'), nav('back')]);
  });

  it('keystrokes that edit the note or an entry play type; ⌘↵ does not', () => {
    const el = mount(DATA);
    const box = q<HTMLTextAreaElement>(el, '.el-note')!;
    key(box, 'a');
    settle();
    key(box, 'Enter');
    settle();
    key(box, 'Enter', { metaKey: true });
    key(box, 'ArrowUp');
    settle();
    btn(el, 'edit').click();
    key(q(el, '.el-edit')!, ' ');
    settle();
    expect(spy.calls).toEqual([
      ['type', { key: 'printable', input: 'keyboard' }],
      ['type', { key: 'enter', input: 'keyboard' }],
      ['type', { key: 'space', input: 'keyboard' }],
    ]);
  });

  it('cancelled events, a prevented keystroke or data from code play nothing (the arming press still taps)', () => {
    const el = mount(DATA);
    for (const n of ['ui-add', 'ui-edit', 'ui-delete', 'ui-date']) listen(el, n, true);
    el.data = { ...DATA, date: '2026-10-29', status: 'Synced' };
    el.renderNow();
    pick(el, TODAY);
    const box = q<HTMLTextAreaElement>(el, '.el-note')!;
    type(box, 'A note');
    press(btn(el, 'add'));
    box.addEventListener('keydown', (e) => e.preventDefault());
    key(box, 'a');
    btn(el, 'edit').click();
    type(q<HTMLTextAreaElement>(el, '.el-edit')!, 'Changed');
    press(btn(el, 'save'));
    key(q(el, '.el-edit')!, 'Escape');
    settle();
    expect(spy.calls).toEqual([]);
    press(btn(el, 'delete'));
    settle();
    press(btn(el, 'delete'));
    settle();
    expect(spy.calls).toEqual([['tap', { emphasis: 'subtle', input: 'mouse' }]]);
  });

  it('is silent inside data-ui-sound="off"', () => {
    const wrap = document.createElement('div');
    wrap.setAttribute('data-ui-sound', 'off');
    document.body.append(wrap);
    const el = mount(DATA);
    wrap.append(el);
    el.renderNow();
    pick(el, '2026-10-29');
    press(btn(el, 'delete'));
    key(q(el, '.el-note')!, 'a');
    settle();
    expect(spy.calls).toEqual([]);
  });
});

describe('styles', () => {
  it('uses tokens only and never moves on hover', () => {
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(styles).not.toMatch(/\brgba?\(/i);
    const known = new Set([...Object.keys(tokens.light), ...Object.keys(tokens.shared), 'i']);
    for (const m of styles.matchAll(/var\(--([a-z0-9-]+)/g)) expect(known.has(m[1]), m[1]).toBe(true);
    const hover = styles.slice(styles.indexOf('@media (hover: hover)'));
    expect(hover.slice(0, hover.indexOf('\n}\n'))).not.toMatch(/transform|translate|scale\(/);
  });
});
