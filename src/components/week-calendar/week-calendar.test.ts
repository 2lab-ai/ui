import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { doc } from './docs';
import {
  addDays,
  dayDiff,
  dayLabel,
  eventLanes,
  eventSpan,
  fmtHm,
  fmtMinutes,
  listGroups,
  localNow,
  moveEvent,
  parseDay,
  parseHm,
  snapMinutes,
  type WeekCalendarData,
  type WeekEvent,
  type WeekMoveDetail,
  weekDayCount,
  weekDays,
  weekHours,
  weekKind,
  weekRangeLabel,
  weekStep,
} from './logic';
import { LONG_PRESS_MS, type UiWeekCalendar } from './week-calendar';

const XSS = '<img src=x onerror=alert(1)>';
const START = '2026-11-09';
/** Wed 11 Nov, 10:25 wall clock (no offset: read as written). */
const NOW = '2026-11-11T10:25:00';

const EVENTS: WeekEvent[] = [
  {
    id: 'digest',
    day: '2026-11-09',
    start: '07:00',
    end: '07:30',
    title: 'Morning digest',
    detail: 'cron 0 7 * * 1-5',
  },
  { id: 'deploy', day: '2026-11-10', start: '14:00', end: '15:00', kind: 'accent', title: 'Deploy window' },
  {
    id: 'eval',
    day: '2026-11-11',
    start: '09:30',
    end: '11:00',
    kind: 'run',
    title: 'Eval suite',
    detail: '412 / 600',
  },
  { id: 'check', day: '2026-11-12', start: '09:00', kind: 'hatch', title: 'Token check' },
  { id: 'remind', day: '2026-11-12', start: '13:00', end: '13:15', kind: 'outline', title: 'Rotate token' },
  { id: 'merge', day: '2026-11-15', start: '10:00', end: '11:00', title: 'Weekly memory merge', locked: true },
];

const base = (over: Partial<WeekCalendarData> = {}): WeekCalendarData => ({
  start: START,
  now: NOW,
  view: 'week',
  events: EVENTS,
  ...over,
});

function mount(data?: WeekCalendarData, attrs: Record<string, string> = {}): UiWeekCalendar {
  const el = document.createElement('ui-week-calendar');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (data) el.data = data;
  document.body.append(el);
  el.renderNow();
  return el;
}

const sr = (el: UiWeekCalendar) => el.shadowRoot!;
const q = <E extends Element = HTMLElement>(el: UiWeekCalendar, s: string) => sr(el).querySelector<E>(s);
const qa = <E extends Element = HTMLElement>(el: UiWeekCalendar, s: string) =>
  Array.from(sr(el).querySelectorAll<E>(s));
const block = (el: UiWeekCalendar, id: string) => qa(el, '.wk-ev').find((b) => b.dataset.id === id)!;
const row = (el: UiWeekCalendar, id: string) => qa(el, '.wk-row').find((b) => b.dataset.id === id)!;
/** A custom property from the inline style attribute (`--t:2.5;--d:1.5`). */
const prop = (node: HTMLElement, name: string) =>
  new RegExp(`(?:^|;)\\s*${name}:\\s*([^;]+)`).exec(node.getAttribute('style') ?? '')?.[1].trim() ?? '';

function listen<T>(el: UiWeekCalendar, name: string, prevent = false): T[] {
  const seen: T[] = [];
  el.addEventListener(name, (e) => {
    seen.push((e as CustomEvent<T>).detail);
    if (prevent) e.preventDefault();
  });
  return seen;
}

const key = (t: EventTarget, k: string, init: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...init });
  t.dispatchEvent(e);
  return e;
};

const ptr = (t: EventTarget, type: string, x: number, y: number, init: PointerEventInit = {}) => {
  const e = new PointerEvent(type, {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    clientX: x,
    clientY: y,
    bubbles: true,
    composed: true,
    cancelable: true,
    ...init,
  });
  t.dispatchEvent(e);
  return e;
};

/** The day area laid out at x 100 … 800 (7 columns of 100px), y 200 … 920 (15 hours of 48px). */
function layout(el: UiWeekCalendar): void {
  const cols = q(el, '.wk-cols')!;
  vi.spyOn(cols, 'getBoundingClientRect').mockReturnValue({
    left: 100,
    top: 200,
    width: 700,
    height: 720,
    right: 800,
    bottom: 920,
    x: 100,
    y: 200,
    toJSON() {},
  } as DOMRect);
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('helpers', () => {
  it('parseHm / fmtHm: "HH:MM" ↔ minutes after midnight', () => {
    expect(parseHm('09:30')).toBe(570);
    expect(parseHm('7:05')).toBe(425);
    expect(parseHm('00:00')).toBe(0);
    expect(parseHm('24:00')).toBe(1440);
    expect(parseHm('24:30')).toBeNaN();
    expect(parseHm('12:60')).toBeNaN();
    expect(parseHm('noon')).toBeNaN();
    expect(parseHm(undefined)).toBeNaN();
    expect(fmtHm(570)).toBe('09:30');
    expect(fmtHm(0)).toBe('00:00');
    expect(fmtHm(1440)).toBe('24:00');
    expect(fmtHm(1500)).toBe('24:00');
    expect(fmtHm(-5)).toBe('00:00');
    expect(fmtHm(Number.NaN)).toBe('');
  });

  it('addDays / dayDiff / parseDay: day arithmetic across months and years; invalid dates are refused', () => {
    expect(addDays('2026-11-09', 3)).toBe('2026-11-12');
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-02-31', 1)).toBe('');
    expect(addDays('soon', 1)).toBe('');
    expect(dayDiff('2026-11-09', '2026-11-12')).toBe(3);
    expect(parseDay('2026-11-09')).toBe(Date.UTC(2026, 10, 9));
    expect(parseDay('2026-13-01')).toBeNaN();
  });

  it('weekDays: n days from the start, clamped 1 … 7; an invalid start is no days', () => {
    expect(weekDays('2026-11-09', 7)).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
    ]);
    expect(weekDays('2026-11-30', 3)).toEqual(['2026-11-30', '2026-12-01', '2026-12-02']);
    expect(weekDays('2026-11-09', 12)).toHaveLength(7);
    expect(weekDays('2026-11-09', 0)).toEqual(['2026-11-09']);
    expect(weekDays('nope', 7)).toEqual([]);
    expect(weekDayCount(undefined)).toBe(7);
    expect(weekDayCount(3.4)).toBe(3);
  });

  it('weekHours / weekStep: clamped, ordered, defaults', () => {
    expect(weekHours(undefined)).toEqual([7, 22]);
    expect(weekHours([9, 18])).toEqual([9, 18]);
    expect(weekHours([18, 9])).toEqual([9, 18]);
    expect(weekHours([-3, 30])).toEqual([0, 24]);
    expect(weekHours([5, 5])).toEqual([5, 6]);
    expect(weekHours(['x', 3] as never)).toEqual([7, 22]);
    expect(weekStep(undefined)).toBe(15);
    expect(weekStep(30)).toBe(30);
    expect(weekStep(0)).toBe(15);
    expect(weekStep(1000)).toBe(240);
  });

  it('snapMinutes: to the nearest step', () => {
    expect(snapMinutes(577, 15)).toBe(570);
    expect(snapMinutes(578, 15)).toBe(585);
    expect(snapMinutes(577, 30)).toBe(570);
    expect(snapMinutes(577, 0)).toBe(577);
    expect(snapMinutes(577)).toBe(570);
  });

  it('eventSpan: the end defaults to start + 30 min, never before the start, never past midnight', () => {
    expect(eventSpan({ start: '09:00' })).toEqual({ s: 540, e: 570 });
    expect(eventSpan({ start: '09:00', end: '08:00' })).toEqual({ s: 540, e: 570 });
    expect(eventSpan({ start: '23:50' })).toEqual({ s: 1430, e: 1440 });
    expect(eventSpan({ start: 'x' }).s).toBeNaN();
  });

  it('moveEvent: keeps the length, moves days, clamps inside the hours', () => {
    const ev = { day: '2026-11-12', start: '09:00', end: '10:30' };
    expect(moveEvent(ev, 30, 0)).toEqual({ day: '2026-11-12', start: '09:30', end: '11:00' });
    expect(moveEvent(ev, 0, 1)).toEqual({ day: '2026-11-13', start: '09:00', end: '10:30' });
    expect(moveEvent(ev, 0, -4)).toEqual({ day: '2026-11-08', start: '09:00', end: '10:30' });
    // Past the end of the hours: pushed back so it ends at 22:00.
    expect(moveEvent(ev, 13 * 60, 0)).toEqual({ day: '2026-11-12', start: '20:30', end: '22:00' });
    // Before the start: pulled to 07:00.
    expect(moveEvent(ev, -5 * 60, 0)).toEqual({ day: '2026-11-12', start: '07:00', end: '08:30' });
    // Own hours; a block longer than them fills them.
    expect(moveEvent(ev, 0, 0, [10, 12])).toEqual({ day: '2026-11-12', start: '10:00', end: '11:30' });
    expect(moveEvent({ day: '2026-11-12', start: '08:00', end: '14:00' }, 0, 0, [9, 12])).toEqual({
      day: '2026-11-12',
      start: '09:00',
      end: '12:00',
    });
    // No end: 30 minutes.
    expect(moveEvent({ day: '2026-11-12', start: '09:00' }, 15, 0)).toEqual({
      day: '2026-11-12',
      start: '09:15',
      end: '09:45',
    });
  });

  it('eventLanes: overlapping events split into lanes; a chain shares one lane count; days are separate', () => {
    const lanes = eventLanes([
      { id: 'a', day: 'd1', start: '10:00', end: '11:00' },
      { id: 'b', day: 'd1', start: '10:30', end: '11:30' },
      { id: 'c', day: 'd1', start: '11:00', end: '12:00' },
      { id: 'd', day: 'd1', start: '13:00', end: '14:00' },
      { id: 'e', day: 'd2', start: '10:00', end: '11:00' },
      { id: 'f', day: 'd1', start: '10:00', end: '10:15' },
      { id: 'x', day: 'd1', start: 'never' },
    ]);
    // a (10–11, the longer of the two at 10:00) lane 0, f (10–10:15) lane 1, b (10:30) reuses lane 1, c (11:00) lane 0.
    expect(lanes.get('a')).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get('f')).toEqual({ lane: 1, lanes: 2 });
    expect(lanes.get('b')).toEqual({ lane: 1, lanes: 2 });
    expect(lanes.get('c')).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get('d')).toEqual({ lane: 0, lanes: 1 });
    expect(lanes.get('e')).toEqual({ lane: 0, lanes: 1 });
    expect(lanes.has('x')).toBe(false);
    const three = eventLanes([
      { id: 'p', day: 'd', start: '09:00', end: '12:00' },
      { id: 'q', day: 'd', start: '09:30', end: '10:30' },
      { id: 'r', day: 'd', start: '10:00', end: '11:00' },
    ]);
    expect([three.get('p'), three.get('q'), three.get('r')]).toEqual([
      { lane: 0, lanes: 3 },
      { lane: 1, lanes: 3 },
      { lane: 2, lanes: 3 },
    ]);
  });

  it('listGroups: only days with events, in order, each by start', () => {
    const groups = listGroups([
      { id: '1', day: '2026-11-12', start: '13:00' },
      { id: '2', day: '2026-11-09', start: '21:00' },
      { id: '3', day: '2026-11-12', start: '09:00' },
      { id: '4', day: '2026-11-09', start: '07:00' },
      { id: '5', day: 'bad', start: '07:00' },
    ]);
    expect(groups.map((g) => g.day)).toEqual(['2026-11-09', '2026-11-12']);
    expect(groups[0].events.map((e) => e.id)).toEqual(['4', '2']);
    expect(groups[1].events.map((e) => e.id)).toEqual(['3', '1']);
    expect(listGroups([])).toEqual([]);
  });

  it('the words: range, day, length in en and ko', () => {
    expect(weekRangeLabel('2026-11-09', 7)).toBe('9 Nov – 15 Nov 2026');
    expect(weekRangeLabel('2026-11-30', 7)).toBe('30 Nov – 6 Dec 2026');
    expect(weekRangeLabel('2026-12-28', 7)).toBe('28 Dec 2026 – 3 Jan 2027');
    expect(weekRangeLabel('2026-11-11', 1)).toBe('Wed 11 Nov 2026');
    expect(weekRangeLabel('2026-11-09', 7, 'ko')).toBe('2026년 11월 9일 – 15일');
    expect(weekRangeLabel('2026-11-30', 7, 'ko')).toBe('2026년 11월 30일 – 12월 6일');
    expect(weekRangeLabel('2026-12-28', 7, 'ko')).toBe('2026년 12월 28일 – 2027년 1월 3일');
    expect(weekRangeLabel('2026-11-11', 1, 'ko')).toBe('2026년 11월 11일 (수)');
    expect(weekRangeLabel('nope')).toBe('');
    expect(dayLabel('2026-11-12')).toBe('Thu 12 Nov');
    expect(dayLabel('2026-11-12', 'ko')).toBe('11월 12일 (목)');
    expect(fmtMinutes(45)).toBe('45 min');
    expect(fmtMinutes(90)).toBe('1 h 30 min');
    expect(fmtMinutes(60, 'ko')).toBe('1시간');
    expect(fmtMinutes(90, 'ko')).toBe('1시간 30분');
    expect(weekKind('hatch')).toBe('hatch');
    expect(weekKind('weird')).toBe('solid');
  });

  it('localNow: an ISO time as a wall-clock day and minute', () => {
    expect(localNow('2026-11-11T10:25:00')).toEqual({ day: '2026-11-11', min: 625 });
    expect(localNow('garbage')).toBeNull();
    expect(localNow(undefined)).toBeNull();
  });
});

describe('<ui-week-calendar> week view', () => {
  it('draws a column per day with weekday and date; today (from now) is marked in the head and the column', () => {
    const el = mount(base());
    expect(q(el, '.wk')!.dataset.view).toBe('week');
    const heads = qa(el, '.wk-dh');
    expect(heads.map((h) => h.querySelector('.wk-dw')!.textContent)).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ]);
    expect(heads.map((h) => h.querySelector('.wk-dn')!.textContent)).toEqual(['9', '10', '11', '12', '13', '14', '15']);
    expect(heads.filter((h) => h.hasAttribute('data-today')).map((h) => h.textContent)).toEqual(['Wed11']);
    const cols = qa(el, '.wk-col');
    expect(cols.map((c) => c.dataset.day)).toEqual(weekDays(START, 7));
    expect(cols.filter((c) => c.hasAttribute('data-today')).map((c) => c.dataset.day)).toEqual(['2026-11-11']);
    expect(cols[2].getAttribute('aria-label')).toBe('Wed 11 Nov, today');
    expect(q(el, '.wk-range')!.textContent).toBe('9 Nov – 15 Nov 2026');
    expect(qa(el, '.wk-hl').map((h) => h.textContent)).toHaveLength(15);
    expect(q(el, '.wk-hl')!.textContent).toBe('07:00');
    expect(q(el, '.wk-grid')!.getAttribute('style')).toContain('--days:7;--rows:15');
    // An explicit today wins over now's day.
    const other = mount(base({ today: '2026-11-13' }));
    expect(qa(other, '.wk-col[data-today]').map((c) => c.dataset.day)).toEqual(['2026-11-13']);
  });

  it('the now line sits in today’s column at its time; none outside the hours or the range', () => {
    const el = mount(base());
    const lines = qa(el, '.wk-now');
    expect(lines).toHaveLength(1);
    expect(lines[0].closest<HTMLElement>('.wk-col')!.dataset.day).toBe('2026-11-11');
    // 10:25 is 3h25 after 07:00.
    expect(prop(lines[0], '--t')).toBe('3.4167');
    expect(qa(mount(base({ now: '2026-11-11T23:10:00' })), '.wk-now')).toHaveLength(0);
    expect(qa(mount(base({ now: '2026-11-20T10:00:00' })), '.wk-now')).toHaveLength(0);
    expect(qa(mount(base({ now: undefined })), '.wk-now')).toHaveLength(0);
    // The now property moves only the line.
    el.now = '2026-11-11T12:00:00';
    el.renderNow();
    expect(prop(q(el, '.wk-now')!, '--t')).toBe('5');
    expect(el.now).toBe('2026-11-11T12:00:00');
  });

  it('places blocks by start and end; clips to the hours; leaves out what is outside the days or the hours', () => {
    const el = mount(
      base({
        events: [
          ...EVENTS,
          { id: 'early', day: '2026-11-13', start: '06:00', end: '08:00', title: 'Early' },
          { id: 'night', day: '2026-11-13', start: '23:00', end: '23:30', title: 'Night' },
          { id: 'next-week', day: '2026-11-16', start: '09:00', title: 'Later' },
        ],
      }),
    );
    const ev = block(el, 'eval');
    expect(ev.closest<HTMLElement>('.wk-col')!.dataset.day).toBe('2026-11-11');
    expect(prop(ev, '--t')).toBe('2.5');
    expect(prop(ev, '--d')).toBe('1.5');
    expect(prop(ev, '--l')).toBe('0');
    expect(prop(ev, '--n')).toBe('1');
    expect(ev.dataset.kind).toBe('run');
    expect(ev.dataset.size).toBe('l');
    expect(ev.querySelector('.wk-ev-time')!.textContent).toBe('09:30–11:00');
    expect(ev.querySelector('.wk-ev-detail')!.textContent).toBe('412 / 600');
    expect(ev.getAttribute('aria-label')).toBe('Eval suite, Wed 11 Nov, 09:30 – 11:00, 412 / 600');
    // No end: 30 minutes.
    expect(prop(block(el, 'check'), '--d')).toBe('0.5');
    // Clipped at the top of the hours.
    expect(prop(block(el, 'early'), '--t')).toBe('0');
    expect(prop(block(el, 'early'), '--d')).toBe('1');
    expect(block(el, 'night')).toBeUndefined();
    expect(block(el, 'next-week')).toBeUndefined();
    // Under half an hour: the title alone.
    const short = block(el, 'remind');
    expect(short.dataset.size).toBe('xs');
    expect(short.querySelector('.wk-ev-time')).toBeNull();
    expect(short.querySelector('.wk-ev-title')!.textContent).toBe('Rotate token');
    expect(block(el, 'check').dataset.size).toBe('s');
    // Hours of its own.
    const narrow = mount(base({ hours: [9, 18] }));
    expect(qa(narrow, '.wk-hl')).toHaveLength(9);
    expect(prop(block(narrow, 'eval'), '--t')).toBe('0.5');
    expect(block(narrow, 'digest')).toBeUndefined();
  });

  it('every block is a button in time order; locked ones carry the lock and “Fixed time”', () => {
    const el = mount(base());
    expect(qa(el, '.wk-ev').map((b) => b.dataset.id)).toEqual(['digest', 'deploy', 'eval', 'check', 'remind', 'merge']);
    for (const b of qa(el, '.wk-ev')) expect(b.localName).toBe('button');
    const merge = block(el, 'merge');
    expect(merge.hasAttribute('data-locked')).toBe(true);
    expect(merge.querySelector('svg[data-icon="lock"]')).not.toBeNull();
    expect(merge.getAttribute('aria-label')).toContain('Fixed time');
    expect(merge.hasAttribute('aria-describedby')).toBe(false);
    expect(block(el, 'eval').getAttribute('aria-describedby')).toBe('wk-keys');
    expect(q(el, '#wk-keys')!.textContent).toContain('15 minutes');
  });

  it('overlapping events split their column into lanes', () => {
    const el = mount(
      base({
        events: [
          { id: 'a', day: '2026-11-12', start: '10:00', end: '11:00', title: 'A' },
          { id: 'b', day: '2026-11-12', start: '10:30', end: '11:15', title: 'B' },
          { id: 'c', day: '2026-11-12', start: '14:00', end: '15:00', title: 'C' },
        ],
      }),
    );
    expect([prop(block(el, 'a'), '--l'), prop(block(el, 'a'), '--n')]).toEqual(['0', '2']);
    expect([prop(block(el, 'b'), '--l'), prop(block(el, 'b'), '--n')]).toEqual(['1', '2']);
    expect([prop(block(el, 'c'), '--l'), prop(block(el, 'c'), '--n')]).toEqual(['0', '1']);
  });

  it('days: 3 draws three columns and says “3 days” on ‹ ›; legend and the drag hint', () => {
    const el = mount(
      base({
        start: '2026-11-11',
        days: 3,
        legend: [
          { kind: 'solid', label: 'Cron jobs', count: 7 },
          { kind: 'hatch', label: 'Checks' },
        ],
      }),
    );
    expect(qa(el, '.wk-col')).toHaveLength(3);
    expect(q(el, '.wk-range')!.textContent).toBe('11 Nov – 13 Nov 2026');
    expect(q(el, '.wk-nav-b[data-dir="-1"]')!.getAttribute('aria-label')).toBe('Previous 3 days');
    expect(q(el, '.wk-nav-b[data-dir="1"]')!.getAttribute('aria-label')).toBe('Next 3 days');
    const items = qa(el, '.wk-legend li');
    expect(items.map((li) => li.textContent)).toEqual(['Cron jobs7', 'Checks']);
    expect(items[1].querySelector<HTMLElement>('.wk-sw')!.dataset.kind).toBe('hatch');
    expect(q(el, '.wk-hint')!.textContent).toBe('Drag a block to move it');
    expect(mount(base({ days: 30 })).shadowRoot!.querySelectorAll('.wk-col')).toHaveLength(7);
  });

  it('an empty week keeps the grid and says so; data.empty overrides; no start is the empty state alone', () => {
    const el = mount(base({ events: [] }));
    expect(qa(el, '.wk-col')).toHaveLength(7);
    expect(q(el, '.wk-note')!.textContent).toBe('Nothing scheduled this week');
    expect(q(el, '.wk-hint')).toBeNull();
    expect(q(mount(base({ events: [], empty: 'No cron jobs' })), '.wk-note')!.textContent).toBe('No cron jobs');
    const none = mount({ start: '', events: [] });
    expect(q(none, '.wk-empty')!.textContent).toBe('Nothing scheduled this week');
    expect(q(none, '.wk-col')).toBeNull();
  });
});

describe('<ui-week-calendar> list view', () => {
  it('groups by day (only days with events), rows in time order with swatch, time, title, length · detail', () => {
    const el = mount(base({ view: 'list' }));
    expect(q(el, '.wk')!.dataset.view).toBe('list');
    expect(q(el, '.wk-col')).toBeNull();
    const days = qa(el, '.wk-day');
    expect(days.map((d) => d.querySelector('.wk-day-n')!.textContent)).toEqual(['9', '10', '11', '12', '15']);
    expect(days.map((d) => d.querySelector('.wk-day-w')!.textContent)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Sun']);
    const today = days.map((d) => d.querySelector('.wk-day-h')!).filter((h) => h.hasAttribute('data-today'));
    expect(today.map((h) => h.getAttribute('aria-label'))).toEqual(['Wed 11 Nov, today']);
    const thu = days[3];
    expect(Array.from(thu.querySelectorAll<HTMLElement>('.wk-row')).map((r) => r.dataset.id)).toEqual([
      'check',
      'remind',
    ]);
    const r = row(el, 'eval');
    expect(r.localName).toBe('button');
    expect(r.querySelector<HTMLElement>('.wk-sw')!.dataset.kind).toBe('run');
    expect(r.querySelector('.wk-row-time')!.textContent).toBe('09:30');
    expect(r.querySelector('.wk-row-title')!.textContent).toBe('Eval suite');
    expect(r.querySelector('.wk-row-detail')!.textContent).toBe('1 h 30 min · 412 / 600');
    expect(r.querySelector('svg[data-icon="chevron-right"]')).not.toBeNull();
    expect(row(el, 'merge').querySelector('svg[data-icon="lock"]')).not.toBeNull();
    // No drag hint in the list.
    expect(q(el, '.wk-hint')).toBeNull();
  });

  it('events outside the hours still show in the list; no events is the empty state', () => {
    const el = mount(base({ view: 'list', events: [{ id: 'n', day: '2026-11-13', start: '23:00', title: 'Night' }] }));
    expect(row(el, 'n')).toBeDefined();
    const empty = mount(base({ view: 'list', events: [] }));
    expect(q(empty, '.wk-list')).toBeNull();
    expect(q(empty, '.wk-empty')!.textContent).toBe('Nothing scheduled this week');
  });

  it('a row opens with a click or Enter', () => {
    const el = mount(base({ view: 'list' }));
    const opened = listen<{ id: string }>(el, 'ui-open');
    row(el, 'deploy').click();
    key(row(el, 'eval'), 'Enter');
    expect(opened).toEqual([{ id: 'deploy' }, { id: 'eval' }]);
  });
});

describe('<ui-week-calendar> view switching', () => {
  it('auto follows (max-width: 639px) live, only while connected and in auto', () => {
    let matches = false;
    const listeners = new Set<() => void>();
    const mql = {
      get matches() {
        return matches;
      },
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    };
    const mm = vi.fn(() => mql as unknown as MediaQueryList);
    vi.stubGlobal('matchMedia', mm);
    const el = mount(base({ view: 'auto' }));
    expect(mm).toHaveBeenCalledWith('(max-width: 639px)');
    expect(listeners.size).toBe(1);
    expect(el.view).toBe('week');
    expect(q(el, '.wk')!.dataset.view).toBe('week');
    matches = true;
    for (const fn of listeners) fn();
    el.renderNow();
    expect(el.view).toBe('list');
    expect(q(el, '.wk')!.dataset.view).toBe('list');
    expect(q(el, '.wk-seg-b[data-view="list"]')!.getAttribute('aria-checked')).toBe('true');
    // Not watched once disconnected, again once back.
    el.remove();
    expect(listeners.size).toBe(0);
    document.body.append(el);
    expect(listeners.size).toBe(1);
    // A fixed view from the host: nothing watched.
    el.data = base({ view: 'week' });
    expect(listeners.size).toBe(0);
    el.renderNow();
    expect(el.view).toBe('week');
    // Default (no view) is auto.
    el.data = { start: START, events: EVENTS };
    expect(listeners.size).toBe(1);
    el.renderNow();
    expect(el.view).toBe('list');
    // Without matchMedia: the week.
    vi.stubGlobal('matchMedia', undefined);
    expect(mount({ start: START, events: EVENTS }).view).toBe('week');
  });

  it('the Week | List switch emits ui-view (cancelable) and pins the view; a new host view replaces the pin', () => {
    let matches = false;
    const listeners = new Set<() => void>();
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return matches;
      },
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    }));
    const el = mount(base({ view: 'auto' }));
    const views = listen<{ view: string }>(el, 'ui-view');
    const seg = q(el, '.wk-seg')!;
    expect(seg.getAttribute('role')).toBe('radiogroup');
    expect(seg.getAttribute('aria-label')).toBe('View');
    q(el, '.wk-seg-b[data-view="list"]')!.click();
    expect(views).toEqual([{ view: 'list' }]);
    expect(el.view).toBe('list');
    expect(q(el, '.wk')!.dataset.view).toBe('list');
    // Pinned: the breakpoint is no longer watched.
    expect(listeners.size).toBe(0);
    matches = false;
    // The same data object again keeps the pin (same view mode).
    el.data = { ...el.data!, events: EVENTS };
    el.renderNow();
    expect(el.view).toBe('list');
    // Choosing the view that is already drawn sends nothing.
    q(el, '.wk-seg-b[data-view="list"]')!.click();
    expect(views).toHaveLength(1);
    // A different host view replaces the pin.
    el.data = base({ view: 'week' });
    el.renderNow();
    expect(el.view).toBe('week');
    // Prevented: the view stays.
    const stay = mount(base());
    stay.addEventListener('ui-view', (e) => e.preventDefault());
    q(stay, '.wk-seg-b[data-view="list"]')!.click();
    expect(stay.view).toBe('week');
    expect(q(stay, '.wk')!.dataset.view).toBe('week');
  });

  it('the switch is a roving radio group: arrows choose and move focus', () => {
    const el = mount(base());
    const views = listen<{ view: string }>(el, 'ui-view');
    const week = q(el, '.wk-seg-b[data-view="week"]')!;
    expect(week.getAttribute('tabindex')).toBe('0');
    expect(q(el, '.wk-seg-b[data-view="list"]')!.getAttribute('tabindex')).toBe('-1');
    week.focus();
    key(week, 'ArrowRight');
    expect(views).toEqual([{ view: 'list' }]);
    const list = q(el, '.wk-seg-b[data-view="list"]')!;
    expect(sr(el).activeElement).toBe(list);
    expect(list.getAttribute('tabindex')).toBe('0');
    key(list, 'Home');
    expect(views).toEqual([{ view: 'list' }, { view: 'week' }]);
  });
});

describe('<ui-week-calendar> header', () => {
  it('‹ › emit ui-range { dir } and change nothing themselves', () => {
    const el = mount(base());
    const ranges = listen<{ dir: number }>(el, 'ui-range');
    const prev = q(el, '.wk-nav-b[data-dir="-1"]')!;
    const next = q(el, '.wk-nav-b[data-dir="1"]')!;
    expect(prev.getAttribute('aria-label')).toBe('Previous week');
    expect(next.getAttribute('aria-label')).toBe('Next week');
    prev.click();
    next.click();
    expect(ranges).toEqual([{ dir: -1 }, { dir: 1 }]);
    expect(q(el, '.wk-range')!.textContent).toBe('9 Nov – 15 Nov 2026');
    let cancelable = false;
    el.addEventListener('ui-range', (e) => {
      cancelable = e.cancelable;
    });
    next.click();
    expect(cancelable).toBe(true);
  });

  it('rangeLabel overrides the formatted range', () => {
    const el = mount(base({ rangeLabel: 'Release week' }));
    expect(q(el, '.wk-range')!.textContent).toBe('Release week');
    expect(q(el, '.wk')!.getAttribute('aria-label')).toBe('Week schedule, Release week');
  });
});

describe('<ui-week-calendar> keyboard', () => {
  it('Enter / Space on a block emit ui-open { id }', () => {
    const el = mount(base());
    const opened = listen<{ id: string }>(el, 'ui-open');
    const e1 = key(block(el, 'eval'), 'Enter');
    key(block(el, 'deploy'), ' ');
    expect(opened).toEqual([{ id: 'eval' }, { id: 'deploy' }]);
    expect(e1.defaultPrevented).toBe(true);
    block(el, 'merge').click();
    expect(opened).toEqual([{ id: 'eval' }, { id: 'deploy' }, { id: 'merge' }]);
  });

  it('Alt+↓ moves by the step: ui-move detail, the block stays there, the live region says where', () => {
    const el = mount(base());
    const moves = listen<WeekMoveDetail>(el, 'ui-move');
    const b = block(el, 'eval');
    b.focus();
    const e = key(b, 'ArrowDown', { altKey: true });
    expect(e.defaultPrevented).toBe(true);
    expect(moves).toEqual([{ id: 'eval', day: '2026-11-11', start: '09:45', end: '11:15' }]);
    expect(prop(block(el, 'eval'), '--t')).toBe('2.75');
    expect(block(el, 'eval').querySelector('.wk-ev-time')!.textContent).toBe('09:45–11:15');
    expect(q(el, '.wk-live')!.textContent).toBe('Moved to Wed 11 Nov 09:45');
    expect(sr(el).activeElement).toBe(block(el, 'eval'));
    // Alt+↑ twice: 09:15.
    key(block(el, 'eval'), 'ArrowUp', { altKey: true });
    key(block(el, 'eval'), 'ArrowUp', { altKey: true });
    expect(moves.at(-1)).toEqual({ id: 'eval', day: '2026-11-11', start: '09:15', end: '10:45' });
    // A plain arrow does nothing.
    key(block(el, 'eval'), 'ArrowDown');
    expect(moves).toHaveLength(3);
  });

  it('Alt+→ / ← move by a day; focus follows the block into its new column (data-key)', () => {
    const el = mount(base());
    const moves = listen<WeekMoveDetail>(el, 'ui-move');
    const b = block(el, 'check');
    b.focus();
    key(b, 'ArrowRight', { altKey: true });
    expect(moves).toEqual([{ id: 'check', day: '2026-11-13', start: '09:00', end: '09:30' }]);
    const moved = block(el, 'check');
    expect(moved.closest<HTMLElement>('.wk-col')!.dataset.day).toBe('2026-11-13');
    expect((sr(el).activeElement as HTMLElement).dataset.key).toBe('ev:check');
    expect(q(el, '.wk-live')!.textContent).toBe('Moved to Fri 13 Nov 09:00');
    key(moved, 'ArrowLeft', { altKey: true });
    key(block(el, 'check'), 'ArrowLeft', { altKey: true });
    expect(moves.at(-1)).toEqual({ id: 'check', day: '2026-11-11', start: '09:00', end: '09:30' });
    // Not past the first or last day shown.
    key(block(el, 'digest'), 'ArrowLeft', { altKey: true });
    expect(moves).toHaveLength(3);
    // Not above the first hour.
    key(block(el, 'digest'), 'ArrowUp', { altKey: true });
    expect(moves).toHaveLength(3);
  });

  it('a prevented ui-move keeps the old place and says nothing', () => {
    const el = mount(base());
    const moves = listen<WeekMoveDetail>(el, 'ui-move', true);
    key(block(el, 'eval'), 'ArrowDown', { altKey: true });
    expect(moves).toHaveLength(1);
    expect(prop(block(el, 'eval'), '--t')).toBe('2.5');
    expect(q(el, '.wk-live')!.textContent).toBe('');
  });

  it('a local move lasts until the next data; a listener that sets data itself wins', () => {
    const el = mount(base());
    key(block(el, 'eval'), 'ArrowDown', { altKey: true });
    expect(prop(block(el, 'eval'), '--t')).toBe('2.75');
    // The now property keeps it.
    el.now = '2026-11-11T11:00:00';
    el.renderNow();
    expect(prop(block(el, 'eval'), '--t')).toBe('2.75');
    // New data is the truth again.
    el.data = base();
    el.renderNow();
    expect(prop(block(el, 'eval'), '--t')).toBe('2.5');
    // A host that answers with its own data at once: no local override on top.
    const host = mount(base());
    host.addEventListener('ui-move', (e) => {
      const m = (e as CustomEvent<WeekMoveDetail>).detail;
      host.data = base({ events: EVENTS.map((x) => (x.id === m.id ? { ...x, start: '12:00', end: '13:30' } : x)) });
    });
    key(block(host, 'eval'), 'ArrowDown', { altKey: true });
    host.renderNow();
    expect(prop(block(host, 'eval'), '--t')).toBe('5');
  });

  it('the step comes from data.step', () => {
    const el = mount(base({ step: 30 }));
    const moves = listen<WeekMoveDetail>(el, 'ui-move');
    key(block(el, 'deploy'), 'ArrowDown', { altKey: true });
    expect(moves).toEqual([{ id: 'deploy', day: '2026-11-10', start: '14:30', end: '15:30' }]);
    expect(q(el, '#wk-keys')!.textContent).toContain('30 minutes');
  });

  it('a locked block does not move: no ui-move, the live region says why', () => {
    const el = mount(base());
    const moves = listen<WeekMoveDetail>(el, 'ui-move');
    key(block(el, 'merge'), 'ArrowDown', { altKey: true });
    key(block(el, 'merge'), 'ArrowLeft', { altKey: true });
    expect(moves).toHaveLength(0);
    expect(q(el, '.wk-live')!.textContent?.trim()).toBe('Fixed time — it cannot be moved');
    expect(prop(block(el, 'merge'), '--t')).toBe('3');
  });

  it('rows in the list move with Alt+arrows too', () => {
    const el = mount(base({ view: 'list' }));
    const moves = listen<WeekMoveDetail>(el, 'ui-move');
    key(row(el, 'deploy'), 'ArrowRight', { altKey: true });
    expect(moves).toEqual([{ id: 'deploy', day: '2026-11-11', start: '14:00', end: '15:00' }]);
    expect(row(el, 'deploy').closest('.wk-day')!.querySelector('.wk-day-n')!.textContent).toBe('11');
  });
});

describe('<ui-week-calendar> pointer drag', () => {
  it('a mouse drag: the ghost follows snapped to the step and the column; the drop sends ui-move', () => {
    const el = mount(base());
    layout(el);
    const moves = listen<WeekMoveDetail>(el, 'ui-move');
    const opened = listen<{ id: string }>(el, 'ui-open');
    const b = block(el, 'remind'); // Thu 13:00–13:15
    // 13:00 is 6h after 07:00 → y 200 + 288; press 5px inside the block, in Thursday's column (x 400 … 500).
    ptr(b, 'pointerdown', 420, 493);
    expect(q(el, '.wk-ghost')!.hidden).toBe(true);
    ptr(b, 'pointermove', 422, 494); // inside the slop: still a press
    expect(q(el, '.wk-ghost')!.hidden).toBe(true);
    ptr(b, 'pointermove', 550, 601); // Friday, two hours and a bit later
    const ghost = q(el, '.wk-ghost')!;
    expect(ghost.hidden).toBe(false);
    expect(ghost.getAttribute('style')).toBe('--gi:4;--t:8.25;--d:0.25');
    expect(ghost.textContent).toBe('Rotate token15:15–15:30');
    expect(ghost.hasAttribute('data-short')).toBe(true);
    expect(b.hasAttribute('data-dragging')).toBe(true);
    expect(q(el, '.wk')!.hasAttribute('data-drag')).toBe(true);
    ptr(b, 'pointerup', 550, 601);
    expect(moves).toEqual([{ id: 'remind', day: '2026-11-13', start: '15:15', end: '15:30' }]);
    expect(block(el, 'remind').closest<HTMLElement>('.wk-col')!.dataset.day).toBe('2026-11-13');
    expect(q(el, '.wk-ghost')!.hidden).toBe(true);
    expect(q(el, '.wk')!.hasAttribute('data-drag')).toBe(false);
    expect(q(el, '.wk-live')!.textContent).toBe('Moved to Fri 13 Nov 15:15');
    // The click that ends the drag is not an open.
    block(el, 'remind').click();
    expect(opened).toHaveLength(0);
    block(el, 'remind').click();
    expect(opened).toEqual([{ id: 'remind' }]);
  });

  it('kept inside the hours and the days; dropping where it was sends nothing; Escape puts it back', () => {
    const el = mount(base());
    layout(el);
    const moves = listen<WeekMoveDetail>(el, 'ui-move');
    const b = block(el, 'eval'); // Wed 09:30–11:00
    ptr(b, 'pointerdown', 320, 320);
    ptr(b, 'pointermove', 2000, 5000);
    expect(q(el, '.wk-ghost')!.getAttribute('style')).toBe('--gi:6;--t:13.5;--d:1.5');
    ptr(b, 'pointermove', 320, 320);
    ptr(b, 'pointerup', 320, 320);
    expect(moves).toHaveLength(0);
    ptr(block(el, 'eval'), 'pointerdown', 320, 320);
    ptr(block(el, 'eval'), 'pointermove', 520, 420);
    expect(q(el, '.wk-ghost')!.hidden).toBe(false);
    key(block(el, 'eval'), 'Escape');
    expect(q(el, '.wk-ghost')!.hidden).toBe(true);
    ptr(block(el, 'eval'), 'pointerup', 520, 420);
    expect(moves).toHaveLength(0);
    expect(prop(block(el, 'eval'), '--t')).toBe('2.5');
  });

  it('a prevented drop goes back', () => {
    const el = mount(base());
    layout(el);
    const moves = listen<WeekMoveDetail>(el, 'ui-move', true);
    const b = block(el, 'eval');
    ptr(b, 'pointerdown', 320, 320);
    ptr(b, 'pointermove', 420, 368);
    ptr(b, 'pointerup', 420, 368);
    expect(moves).toEqual([{ id: 'eval', day: '2026-11-12', start: '10:30', end: '12:00' }]);
    expect(block(el, 'eval').closest<HTMLElement>('.wk-col')!.dataset.day).toBe('2026-11-11');
  });

  it('a locked block does not lift', () => {
    const el = mount(base());
    layout(el);
    const moves = listen<WeekMoveDetail>(el, 'ui-move');
    const b = block(el, 'merge');
    ptr(b, 'pointerdown', 720, 380);
    ptr(b, 'pointermove', 420, 500);
    expect(q(el, '.wk-ghost')!.hidden).toBe(true);
    ptr(b, 'pointerup', 420, 500);
    expect(moves).toHaveLength(0);
  });

  it('touch lifts only after a still long press; a finger that moves first is a scroll', () => {
    vi.useFakeTimers();
    const el = mount(base());
    layout(el);
    const moves = listen<WeekMoveDetail>(el, 'ui-move');
    const touch = { pointerType: 'touch', pointerId: 7 };
    // A swipe: moved before the long press — no drag, ever.
    ptr(block(el, 'eval'), 'pointerdown', 320, 320, touch);
    ptr(block(el, 'eval'), 'pointermove', 320, 340, touch);
    vi.advanceTimersByTime(LONG_PRESS_MS + 50);
    ptr(block(el, 'eval'), 'pointermove', 420, 400, touch);
    expect(q(el, '.wk-ghost')!.hidden).toBe(true);
    ptr(block(el, 'eval'), 'pointerup', 420, 400, touch);
    // A still press: lifts after LONG_PRESS_MS.
    ptr(block(el, 'eval'), 'pointerdown', 320, 320, touch);
    vi.advanceTimersByTime(LONG_PRESS_MS - 50);
    expect(q(el, '.wk-ghost')!.hidden).toBe(true);
    vi.advanceTimersByTime(60);
    expect(q(el, '.wk-ghost')!.hidden).toBe(false);
    ptr(block(el, 'eval'), 'pointermove', 420, 368, touch);
    ptr(block(el, 'eval'), 'pointerup', 420, 368, touch);
    expect(moves).toEqual([{ id: 'eval', day: '2026-11-12', start: '10:30', end: '12:00' }]);
  });

  it('no drag in the list view', () => {
    const el = mount(base({ view: 'list' }));
    const moves = listen<WeekMoveDetail>(el, 'ui-move');
    ptr(row(el, 'eval'), 'pointerdown', 10, 10);
    ptr(row(el, 'eval'), 'pointermove', 200, 200);
    ptr(row(el, 'eval'), 'pointerup', 200, 200);
    expect(moves).toHaveLength(0);
  });
});

describe('<ui-week-calendar> escaping and Korean', () => {
  it('escapes titles, details, ids, the range label, legend labels and the empty words — in both views', () => {
    const evil: WeekCalendarData = base({
      rangeLabel: `Week ${XSS}`,
      legend: [{ kind: 'solid', label: `Jobs ${XSS}`, count: 2 }],
      events: [
        {
          id: `id"${XSS}`,
          day: '2026-11-11',
          start: '09:00',
          end: '11:00',
          title: `T ${XSS}`,
          detail: `D ${XSS}`,
          kind: `x" onclick="1` as never,
        },
      ],
    });
    const el = mount(evil);
    expect(sr(el).querySelector('img')).toBeNull();
    expect(q(el, '.wk-range')!.textContent).toBe(`Week ${XSS}`);
    expect(q(el, '.wk-legend li span')!.textContent).toBe(`Jobs ${XSS}`);
    const b = qa(el, '.wk-ev')[0];
    expect(b.dataset.id).toBe(`id"${XSS}`);
    expect(b.dataset.kind).toBe('solid');
    expect(b.hasAttribute('onclick')).toBe(false);
    expect(b.querySelector('.wk-ev-title')!.textContent).toBe(`T ${XSS}`);
    expect(b.querySelector('.wk-ev-detail')!.textContent).toBe(`D ${XSS}`);
    expect(b.getAttribute('aria-label')).toContain(`T ${XSS}`);
    // Keyed by its own id even with quotes inside.
    const opened = listen<{ id: string }>(el, 'ui-open');
    b.click();
    expect(opened).toEqual([{ id: `id"${XSS}` }]);
    const list = mount({ ...evil, view: 'list' });
    expect(sr(list).querySelector('img')).toBeNull();
    expect(q(list, '.wk-row-title')!.textContent).toBe(`T ${XSS}`);
    expect(q(list, '.wk-row-detail')!.textContent).toBe(`2 h · D ${XSS}`);
    const empty = mount(base({ events: [], empty: `None ${XSS}` }));
    expect(sr(empty).querySelector('img')).toBeNull();
    expect(q(empty, '.wk-note')!.textContent).toBe(`None ${XSS}`);
    const emptyList = mount(base({ events: [], view: 'list', empty: `None ${XSS}` }));
    expect(sr(emptyList).querySelector('img')).toBeNull();
  });

  it('skips events without an id, duplicate ids and unreadable times', () => {
    const el = mount(
      base({
        events: [
          { id: 'a', day: '2026-11-11', start: '09:00', title: 'A' },
          { id: 'a', day: '2026-11-12', start: '09:00', title: 'A again' },
          { day: '2026-11-11', start: '10:00', title: 'No id' } as never,
          { id: 'b', day: '2026-11-11', start: 'later', title: 'B' },
          null as never,
        ],
      }),
    );
    expect(qa(el, '.wk-ev').map((b) => b.dataset.id)).toEqual(['a']);
  });

  it('lang="ko": 주 / 목록, 이전 주 / 다음 주, Korean dates, the empty words, the moved and locked words', () => {
    const el = mount(base(), { lang: 'ko' });
    expect(qa(el, '.wk-seg-b').map((b) => b.textContent)).toEqual(['주', '목록']);
    expect(q(el, '.wk-seg')!.getAttribute('aria-label')).toBe('보기');
    expect(q(el, '.wk-nav-b[data-dir="-1"]')!.getAttribute('aria-label')).toBe('이전 주');
    expect(q(el, '.wk-nav-b[data-dir="1"]')!.getAttribute('aria-label')).toBe('다음 주');
    expect(q(el, '.wk-range')!.textContent).toBe('2026년 11월 9일 – 15일');
    expect(qa(el, '.wk-dw').map((d) => d.textContent)).toEqual(['월', '화', '수', '목', '금', '토', '일']);
    expect(q(el, '.wk-col[data-today]')!.getAttribute('aria-label')).toBe('11월 11일 (수), 오늘');
    expect(block(el, 'merge').getAttribute('aria-label')).toContain('고정된 시간');
    expect(q(el, '.wk')!.getAttribute('aria-label')).toBe('주간 일정, 2026년 11월 9일 – 15일');
    expect(q(el, '#wk-keys')!.textContent).toBe('Alt와 방향키로 15분 또는 하루씩 옮깁니다.');
    key(block(el, 'check'), 'ArrowDown', { altKey: true });
    expect(q(el, '.wk-live')!.textContent).toBe('11월 12일 (목) 09:15 시작으로 옮겼습니다');
    key(block(el, 'merge'), 'ArrowDown', { altKey: true });
    expect(q(el, '.wk-live')!.textContent).toBe('고정된 시간이라 옮길 수 없습니다');
    expect(q(mount(base({ events: [] }), { lang: 'ko' }), '.wk-note')!.textContent).toBe('이번 주 일정이 없습니다');
    const three = mount(base({ days: 3 }), { lang: 'ko' });
    expect(q(three, '.wk-nav-b[data-dir="-1"]')!.getAttribute('aria-label')).toBe('이전 3일');
    const list = mount(base({ view: 'list' }), { lang: 'ko' });
    expect(row(list, 'eval').querySelector('.wk-row-detail')!.textContent).toBe('1시간 30분 · 412 / 600');
    expect(qa(list, '.wk-day-w').map((d) => d.textContent)).toEqual(['월', '화', '수', '목', '일']);
  });
});

describe('styles and docs', () => {
  it('tokens only (no hex / rgba), chroma-scaled tints, the min column width and sticky gutter', () => {
    const css = sr(document.createElement('ui-week-calendar')).querySelector('style')!.textContent ?? '';
    const own = css.slice(css.indexOf('.wk {'));
    expect(own).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    expect(own).toContain('calc(14% * var(--chroma))');
    expect(own).toContain('--colmin: var(--wk-col-min, 88px)');
    expect(own).toContain('--hh: var(--wk-hour-h, 48px)');
    expect(own).toMatch(/\.wk-gutter \{\s*position: sticky; left: 0;/);
    expect(own).toContain('overflow: auto');
    expect(own).not.toMatch(/@keyframes|infinite/);
  });

  it('docs: Components, ≥ 3 demos that build, the clean-room reference', () => {
    expect(doc.group).toBe('Components');
    expect(doc.tag).toBe('ui-week-calendar');
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    expect(doc.reference.name).toContain('no code used');
    for (const d of doc.demos) {
      const node = d.create();
      document.body.append(node);
      expect(node.querySelector('ui-week-calendar')).not.toBeNull();
    }
    expect(doc.events.map((e) => e.name).sort()).toEqual(['ui-move', 'ui-open', 'ui-range', 'ui-view']);
  });
});
