/**
 * Week calendar — the data shape and the pure helpers (no DOM): times as minutes, days as `YYYY-MM-DD`, overlap
 * lanes, snapping, moving a block, the list view's day groups and the en / ko date words. A server render or a host
 * can use every one of them.
 */

/**
 * How a block is drawn: `solid` ink · `accent` filled · `hatch` hatched outline (a check) · `outline` plain outline
 * (a reminder) · `run` a running job's tint · `fail` a failed job's tint.
 */
export type WeekKind = 'solid' | 'accent' | 'hatch' | 'outline' | 'run' | 'fail';
/** The view drawn: a time grid of day columns, or a list grouped by day. */
export type WeekView = 'week' | 'list';
/** `auto`: the list on phones (under 640px), the week elsewhere. */
export type WeekViewMode = WeekView | 'auto';
export type WeekLang = 'en' | 'ko';

export interface WeekEvent {
  /** Unique within the data: what every event carries back. */
  id: string;
  /** The day it runs (`YYYY-MM-DD`). */
  day: string;
  /** Start, `HH:MM` (24h). */
  start: string;
  /** End, `HH:MM` (default: start + 30 minutes). */
  end?: string;
  title: string;
  /** One line under the title (`cron 0 21 * * * · #ops`). */
  detail?: string;
  kind?: WeekKind;
  /** A fixed time: it does not drag or move (a lock glyph shows it). */
  locked?: boolean;
}

/** One legend entry: the kind's swatch, its words and (optionally) how many there are. */
export interface WeekLegendItem {
  kind: WeekKind;
  label: string;
  count?: number;
}

export interface WeekCalendarData {
  /** The first day shown (`YYYY-MM-DD`). */
  start: string;
  /** How many days are shown (default 7, clamped 1 … 7). */
  days?: number;
  /** The hours shown, `[from, to)` (default `[7, 22]`; clamped 0 … 24). */
  hours?: [number, number];
  /** The time now (ISO). With an offset it is read in the viewer's time zone; without one, as written. */
  now?: string;
  /** Today (`YYYY-MM-DD`; default: the day of `now`). */
  today?: string;
  /** The range in the header (default: from `start` and `days`, "9 Nov – 15 Nov 2026" / "2026년 11월 9일 – 15일"). */
  rangeLabel?: string;
  events: WeekEvent[];
  /** Default `auto`. */
  view?: WeekViewMode;
  /** Minutes a drag or Alt+↑/↓ snaps to (default 15). */
  step?: number;
  legend?: WeekLegendItem[];
  /** The empty state's words (default "Nothing scheduled this week"). */
  empty?: string;
}

/** Where an event sits: its day and its times. */
export interface WeekSlot {
  day: string;
  start: string;
  end: string;
}

/** An event's lane among the events it overlaps on its day: `lane` 0 … `lanes` − 1. */
export interface WeekLane {
  lane: number;
  lanes: number;
}

/** `ui-move` detail: the event and where it goes. */
export interface WeekMoveDetail extends WeekSlot {
  id: string;
}

/** `ui-open` detail. */
export interface WeekOpenDetail {
  id: string;
}

/** `ui-range` detail: back (-1) or forward (1) by the days shown. */
export interface WeekRangeDetail {
  dir: -1 | 1;
}

/** `ui-view` detail. */
export interface WeekViewDetail {
  view: WeekView;
}

/** One day of the list view: the day and its events in time order. */
export interface WeekGroup<E> {
  day: string;
  events: E[];
}

export const WEEK_KINDS: readonly WeekKind[] = ['solid', 'accent', 'hatch', 'outline', 'run', 'fail'];
export const DEFAULT_HOURS: readonly [number, number] = [7, 22];
export const DEFAULT_STEP = 15;
/** An event without an end lasts this long. */
export const DEFAULT_MINUTES = 30;

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');
const HM = /^(\d{1,2}):(\d{2})$/;
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `'09:30'` → 570 minutes after midnight; `'24:00'` → 1440; anything else → NaN. */
export function parseHm(value: unknown): number {
  if (typeof value !== 'string') return Number.NaN;
  const m = HM.exec(value.trim());
  if (!m) return Number.NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 24 || (h === 24 && min > 0)) return Number.NaN;
  return h * 60 + min;
}

/** 570 → `'09:30'` (rounded, clamped to 00:00 … 24:00); not a number → `''`. */
export function fmtHm(minutes: number): string {
  if (!Number.isFinite(minutes)) return '';
  const m = Math.min(1440, Math.max(0, Math.round(minutes)));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** `'2026-11-09'` → its UTC midnight in ms; not a real date → NaN. */
export function parseDay(value: unknown): number {
  if (typeof value !== 'string') return Number.NaN;
  const m = YMD.exec(value.trim());
  if (!m) return Number.NaN;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // 2026-02-31 rolls into March: not a real date.
  return new Date(t).toISOString().slice(0, 10) === value.trim() ? t : Number.NaN;
}

function fmtDay(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** `addDays('2026-11-09', 3)` → `'2026-11-12'` (months and years roll over); not a date → `''`. */
export function addDays(day: string, n: number): string {
  const t = parseDay(day);
  if (Number.isNaN(t) || !Number.isFinite(n)) return '';
  return fmtDay(t + Math.round(n) * DAY_MS);
}

/** Whole days from `a` to `b` (`dayDiff('2026-11-09', '2026-11-12')` → 3); NaN when either is not a date. */
export function dayDiff(a: string, b: string): number {
  return Math.round((parseDay(b) - parseDay(a)) / DAY_MS);
}

/** The day count shown: a whole number 1 … 7 (default 7). */
export function weekDayCount(n: unknown): number {
  const v = Number(n);
  if (n === undefined || n === null || !Number.isFinite(v)) return 7;
  return Math.min(7, Math.max(1, Math.round(v)));
}

/** `n` days from `start` (clamped 1 … 7): `['2026-11-09', '2026-11-10', …]`; an invalid start → `[]`. */
export function weekDays(start: string, n = 7): string[] {
  if (Number.isNaN(parseDay(start))) return [];
  const out: string[] = [];
  for (let i = 0; i < weekDayCount(n); i++) out.push(addDays(start, i));
  return out;
}

/** The hours shown, whole and in order: `[from, to)` inside 0 … 24, at least one hour (default `[7, 22]`). */
export function weekHours(h: unknown): [number, number] {
  if (!Array.isArray(h) || h.length < 2) return [DEFAULT_HOURS[0], DEFAULT_HOURS[1]];
  const a = Number(h[0]);
  const b = Number(h[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return [DEFAULT_HOURS[0], DEFAULT_HOURS[1]];
  const from = Math.min(23, Math.max(0, Math.floor(Math.min(a, b))));
  const to = Math.min(24, Math.max(from + 1, Math.ceil(Math.max(a, b))));
  return [from, to];
}

/** The snapping step in minutes: a whole number 1 … 240 (default 15). */
export function weekStep(n: unknown): number {
  const v = Number(n);
  if (n === undefined || n === null || !Number.isFinite(v) || v <= 0) return DEFAULT_STEP;
  return Math.min(240, Math.max(1, Math.round(v)));
}

/** `m` minutes to the nearest multiple of `step` (a step ≤ 0 counts as 1). */
export function snapMinutes(m: number, step = DEFAULT_STEP): number {
  const s = Number.isFinite(step) && step > 0 ? step : 1;
  return Math.round(m / s) * s;
}

/**
 * An event's span in minutes: `s` from `start`, `e` from `end` (missing, unreadable or not after the start: start +
 * 30, never past 24:00). NaN `s` when the start is unreadable.
 */
export function eventSpan(ev: { start: string; end?: string }): { s: number; e: number } {
  const s = parseHm(ev.start);
  if (Number.isNaN(s)) return { s, e: Number.NaN };
  let e = ev.end === undefined ? Number.NaN : parseHm(ev.end);
  if (Number.isNaN(e) || e <= s) e = Math.min(1440, s + DEFAULT_MINUTES);
  if (e <= s) e = s + 1;
  return { s, e };
}

/**
 * Move an event by `deltaMin` minutes and `deltaDays` days, keeping its length, kept inside `hours`
 * (`[from, to)`, default `[7, 22]`): a start before `from` is pulled to it, an end after `to` pushes it back. A
 * block longer than the hours starts at `from` and ends at `to`.
 */
export function moveEvent(
  ev: { day: string; start: string; end?: string },
  deltaMin: number,
  deltaDays: number,
  hours: readonly [number, number] = DEFAULT_HOURS,
): WeekSlot {
  const [h0, h1] = weekHours(hours);
  const lo = h0 * 60;
  const hi = h1 * 60;
  const { s, e } = eventSpan(ev);
  const len = Math.max(1, (Number.isNaN(e) ? s + DEFAULT_MINUTES : e) - s);
  let start = (Number.isNaN(s) ? lo : s) + (Number.isFinite(deltaMin) ? Math.round(deltaMin) : 0);
  if (start + len > hi) start = hi - len;
  if (start < lo) start = lo;
  const end = Math.min(hi, start + len);
  return {
    day: addDays(ev.day, Number.isFinite(deltaDays) ? deltaDays : 0) || ev.day,
    start: fmtHm(start),
    end: fmtHm(end),
  };
}

/**
 * Lanes for overlapping events: per day, events that overlap (directly or through a chain) share a cluster; each
 * takes the first lane free at its start, and every event of the cluster reports the cluster's lane count — so
 * the blocks split the column's width evenly. Events whose start cannot be read get no lane.
 */
export function eventLanes(
  events: ReadonlyArray<{ id: string; day: string; start: string; end?: string }>,
): Map<string, WeekLane> {
  const out = new Map<string, WeekLane>();
  const seen = new Set<string>();
  const byDay = new Map<string, Array<{ id: string; s: number; e: number }>>();
  for (const ev of events) {
    if (!ev || seen.has(ev.id)) continue;
    const { s, e } = eventSpan(ev);
    if (Number.isNaN(s)) continue;
    seen.add(ev.id);
    const list = byDay.get(ev.day) ?? [];
    list.push({ id: ev.id, s, e });
    byDay.set(ev.day, list);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.s - b.s || b.e - a.e);
    let cluster: Array<{ id: string; lane: number }> = [];
    let ends: number[] = [];
    let clusterEnd = Number.NEGATIVE_INFINITY;
    const close = () => {
      for (const c of cluster) out.set(c.id, { lane: c.lane, lanes: ends.length });
      cluster = [];
      ends = [];
    };
    for (const ev of list) {
      // Starts after everything so far has ended: a new cluster with its own lanes.
      if (ev.s >= clusterEnd) {
        close();
        clusterEnd = ev.e;
      } else clusterEnd = Math.max(clusterEnd, ev.e);
      let lane = ends.findIndex((end) => end <= ev.s);
      if (lane < 0) {
        lane = ends.length;
        ends.push(ev.e);
      } else ends[lane] = ev.e;
      cluster.push({ id: ev.id, lane });
    }
    close();
  }
  return out;
}

/** The list view's groups: days in order, only days with events, each day's events by start (then longest first). */
export function listGroups<E extends { day: string; start: string; end?: string }>(
  events: readonly E[],
): WeekGroup<E>[] {
  const byDay = new Map<string, E[]>();
  for (const ev of events) {
    if (!ev || Number.isNaN(parseDay(ev.day))) continue;
    const list = byDay.get(ev.day) ?? [];
    list.push(ev);
    byDay.set(ev.day, list);
  }
  return Array.from(byDay.keys())
    .sort()
    .map((day) => ({
      day,
      events: (byDay.get(day) ?? []).slice().sort((a, b) => {
        const x = eventSpan(a);
        const y = eventSpan(b);
        return x.s - y.s || y.e - x.e;
      }),
    }));
}

/**
 * The wall-clock day and minute of an ISO time: with an offset (`Z`, `+09:00`) it is read in the viewer's time zone,
 * without one as written. Unreadable → null.
 */
export function localNow(iso: unknown): { day: string; min: number } | null {
  if (typeof iso !== 'string' || !iso.trim()) return null;
  const d = new Date(iso.trim());
  if (Number.isNaN(d.getTime())) return null;
  return {
    day: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    min: d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60,
  };
}

// ── words ───────────────────────────────────────────────────────────────────

const formats = new Map<string, Intl.DateTimeFormat>();
function dtf(lang: WeekLang, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${lang}|${JSON.stringify(opts)}`;
  let f = formats.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(lang === 'ko' ? 'ko-KR' : 'en-GB', { ...opts, timeZone: 'UTC' });
    formats.set(key, f);
  }
  return f;
}

function parts(day: string): { y: number; m: number; d: number; t: number } | null {
  const t = parseDay(day);
  if (Number.isNaN(t)) return null;
  const at = new Date(t);
  return { y: at.getUTCFullYear(), m: at.getUTCMonth() + 1, d: at.getUTCDate(), t };
}

/** The short weekday: `Mon` / `월`. */
export function weekdayName(day: string, lang: WeekLang = 'en'): string {
  const p = parts(day);
  return p ? dtf(lang, { weekday: 'short' }).format(p.t) : '';
}

/** The short month: `Nov` / `11월`. */
export function monthName(day: string, lang: WeekLang = 'en'): string {
  const p = parts(day);
  if (!p) return '';
  return lang === 'ko' ? `${p.m}월` : dtf('en', { month: 'short' }).format(p.t);
}

/** The day of the month: `9`. */
export function dayNumber(day: string): string {
  const p = parts(day);
  return p ? String(p.d) : '';
}

/** A day in words: `Thu 12 Nov` / `11월 12일 (목)`. */
export function dayLabel(day: string, lang: WeekLang = 'en'): string {
  const p = parts(day);
  if (!p) return '';
  const wd = weekdayName(day, lang);
  return lang === 'ko' ? `${p.m}월 ${p.d}일 (${wd})` : `${wd} ${p.d} ${monthName(day, 'en')}`;
}

/**
 * The header's range: `9 Nov – 15 Nov 2026` · `30 Nov – 6 Dec 2026` · `28 Dec 2026 – 3 Jan 2027` · one day:
 * `Wed 11 Nov 2026`. Korean: `2026년 11월 9일 – 15일` · `2026년 11월 30일 – 12월 6일` · `2026년 11월 11일 (수)`.
 */
export function weekRangeLabel(start: string, days = 7, lang: WeekLang = 'en'): string {
  const a = parts(start);
  if (!a) return '';
  const n = weekDayCount(days);
  const last = addDays(start, n - 1);
  const b = parts(last);
  if (!b) return '';
  if (lang === 'ko') {
    if (n === 1) return `${a.y}년 ${a.m}월 ${a.d}일 (${weekdayName(start, 'ko')})`;
    if (a.y !== b.y) return `${a.y}년 ${a.m}월 ${a.d}일 – ${b.y}년 ${b.m}월 ${b.d}일`;
    if (a.m !== b.m) return `${a.y}년 ${a.m}월 ${a.d}일 – ${b.m}월 ${b.d}일`;
    return `${a.y}년 ${a.m}월 ${a.d}일 – ${b.d}일`;
  }
  if (n === 1) return `${weekdayName(start)} ${a.d} ${monthName(start)} ${a.y}`;
  const from = a.y !== b.y ? `${a.d} ${monthName(start)} ${a.y}` : `${a.d} ${monthName(start)}`;
  return `${from} – ${b.d} ${monthName(last)} ${b.y}`;
}

/** A length in words: `45 min` · `1 h 30 min` / `45분` · `1시간 30분`. */
export function fmtMinutes(min: number, lang: WeekLang = 'en'): string {
  if (!Number.isFinite(min) || min < 0) return '';
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (lang === 'ko') return h ? `${h}시간${r ? ` ${r}분` : ''}` : `${r}분`;
  return h ? `${h} h${r ? ` ${r} min` : ''}` : `${r} min`;
}

/** A kind from anything: one of WEEK_KINDS, else `solid`. */
export function weekKind(v: unknown): WeekKind {
  return WEEK_KINDS.includes(v as WeekKind) ? (v as WeekKind) : 'solid';
}
