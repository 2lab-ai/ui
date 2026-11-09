import type { ComponentDoc } from '../../docs/types';
import './week-calendar';
import {
  addDays,
  dayLabel,
  type WeekCalendarData,
  type WeekEvent,
  type WeekKind,
  type WeekLegendItem,
  type WeekMoveDetail,
} from './logic';
import type { UiWeekCalendar } from './week-calendar';

/** Demos sit on a fixed week (Mon 9 – Sun 15 Nov 2026) and a fixed now (Wed 11 Nov, 10:25) so they render the same. */
const WEEK = '2026-11-09';
const NOW = '2026-11-11T10:25:00';

/** One job of the week: weekday offset (0 = Mon), times, kind, en / ko words. */
type Job = [
  day: number,
  start: string,
  end: string,
  kind: WeekKind,
  title: [string, string],
  detail: [string, string],
  locked?: boolean,
];

const JOBS: Job[] = [
  [
    0,
    '07:00',
    '07:30',
    'solid',
    ['Morning digest', '아침 요약'],
    ['cron 0 7 * * 1-5 · #ops', 'cron 0 7 * * 1-5 · #ops'],
  ],
  [0, '09:00', '09:30', 'hatch', ['Token spend check', '토큰 사용량 점검'], ['budget $40 / day', '하루 예산 $40']],
  [
    1,
    '07:30',
    '08:15',
    'fail',
    ['Backfill sessions', '세션 백필'],
    ['failed 07:52 · retry queued', '07:52 실패 · 재시도 대기'],
  ],
  [
    1,
    '14:00',
    '15:00',
    'accent',
    ['Deploy window · soma-work 1.4.2', '배포 창 · soma-work 1.4.2'],
    ['prod · needs approval', '프로덕션 · 승인 필요'],
  ],
  [2, '09:00', '09:15', 'hatch', ['llmux 429 check', 'llmux 429 점검'], ['burst at 09:00 KST', '09:00 KST 몰림']],
  [
    2,
    '10:00',
    '11:30',
    'run',
    ['Eval suite · opus', '평가 스위트 · opus'],
    ['running · 412 / 600 cases', '실행 중 · 600건 중 412건'],
  ],
  [
    2,
    '10:30',
    '11:30',
    'outline',
    ['Review slot · approval-card', '리뷰 슬롯 · approval-card'],
    ['round 2 with Zhuge', '2차 리뷰 · Zhuge'],
  ],
  [
    2,
    '15:30',
    '16:30',
    'outline',
    ['Review round · PR #1100', '리뷰 라운드 · PR #1100'],
    ['dashboard responsive board', '대시보드 반응형 보드'],
  ],
  [3, '08:00', '08:30', 'hatch', ['Backup restore drill', '백업 복구 훈련'], ['staging snapshot', '스테이징 스냅샷']],
  [3, '11:00', '12:00', 'accent', ['Deploy window · ui 0.41', '배포 창 · ui 0.41'], ['npm + site', 'npm + 사이트']],
  [3, '13:00', '13:30', 'outline', ['Rotate Slack bot token', 'Slack 봇 토큰 교체'], ['expires Fri', '금요일 만료']],
  [
    4,
    '08:30',
    '09:00',
    'hatch',
    ['Cert expiry check', '인증서 만료 점검'],
    ['2lab.ai · 21 days left', '2lab.ai · 21일 남음'],
  ],
  [
    4,
    '16:00',
    '17:30',
    'accent',
    ['Release train', '릴리스 트레인'],
    ['prod freeze after 17:30', '17:30 이후 프로덕션 동결'],
    true,
  ],
  [
    6,
    '10:00',
    '11:00',
    'solid',
    ['Weekly memory merge', '주간 메모리 병합'],
    ['cron 0 10 * * 0 · memory pages', 'cron 0 10 * * 0 · 메모리 페이지'],
    true,
  ],
];

/** The nightly usage report runs every weekday at 21:00. */
const NIGHTLY: Job[] = [0, 1, 2, 3, 4].map((d) => [
  d,
  '21:00',
  '21:30',
  'solid',
  ['Nightly usage report', '야간 사용량 리포트'],
  ['cron 0 21 * * 1-5 · #ops', 'cron 0 21 * * 1-5 · #ops'],
]);

/** The week starting `start`: the same jobs on the same weekdays (the cron schedule repeats). */
function schedule(start: string, lang: 0 | 1 = 0): WeekEvent[] {
  return [...JOBS, ...NIGHTLY].map(([d, s, e, kind, title, detail, locked]) => {
    const day = addDays(start, d);
    return {
      id: `${day}:${s}:${title[0]}`,
      day,
      start: s,
      end: e,
      kind,
      title: title[lang],
      detail: detail[lang],
      locked,
    };
  });
}

function legend(events: WeekEvent[], lang: 0 | 1 = 0): WeekLegendItem[] {
  const words: Array<[WeekKind, string, string]> = [
    ['solid', 'Cron jobs', '크론 작업'],
    ['accent', 'Deploy windows', '배포 창'],
    ['hatch', 'Checks', '점검'],
    ['outline', 'Reminders', '리마인더'],
    ['run', 'Running', '실행 중'],
    ['fail', 'Failed', '실패'],
  ];
  return words.map(([kind, en, ko]) => ({
    kind,
    label: lang ? ko : en,
    count: events.filter((e) => e.kind === kind).length,
  }));
}

function make(data: WeekCalendarData, attrs: Record<string, string> = {}): UiWeekCalendar {
  const el = document.createElement('ui-week-calendar');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

/**
 * A host that owns the schedule: ‹ › page the weeks, a move goes into its own events (so the next data keeps it),
 * and a line under the calendar says what happened.
 */
function hosted(
  data: WeekCalendarData,
  source: (start: string) => WeekEvent[],
  attrs: Record<string, string> = {},
  lang: 0 | 1 = 0,
): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:10px;min-width:0';
  const el = make(data, attrs);
  const said = document.createElement('p');
  said.className = 'ui-status-line';
  said.textContent = lang
    ? '블록을 끌거나 Alt+방향키로 옮겨 보세요.'
    : 'Drag a block, or focus one and press Alt+arrows.';
  let events = data.events;
  el.addEventListener('ui-move', (e) => {
    const m = (e as CustomEvent<WeekMoveDetail>).detail;
    const ev = events.find((x) => x.id === m.id);
    events = events.map((x) => (x.id === m.id ? { ...x, day: m.day, start: m.start, end: m.end } : x));
    said.textContent = lang
      ? `“${ev?.title}” → ${dayLabel(m.day, 'ko')} ${m.start}–${m.end}`
      : `Moved “${ev?.title}” to ${dayLabel(m.day)} ${m.start}–${m.end}.`;
    // Save it, then hand the element the new truth (here at once; a real host after its PATCH returns).
    queueMicrotask(() => {
      el.data = { ...el.data!, events };
    });
  });
  el.addEventListener('ui-open', (e) => {
    const id = (e as CustomEvent<{ id: string }>).detail.id;
    said.textContent = `${lang ? '열기' : 'Open'}: ${events.find((x) => x.id === id)?.title ?? id}`;
  });
  el.addEventListener('ui-range', (e) => {
    const dir = (e as CustomEvent<{ dir: -1 | 1 }>).detail.dir;
    const n = el.data?.days ?? 7;
    const start = addDays(el.data!.start, dir * n);
    events = source(start);
    el.data = { ...el.data!, start, events, legend: data.legend ? legend(events, lang) : undefined };
  });
  box.append(el, said);
  return box;
}

const weekData = (lang: 0 | 1 = 0): WeekCalendarData => {
  const events = schedule(WEEK, lang);
  return { start: WEEK, now: NOW, events, legend: legend(events, lang) };
};

/** The next three days of review slots: approvals, review rounds, a deploy check. */
const REVIEWS: WeekEvent[] = [
  {
    id: 'r1',
    day: '2026-11-11',
    start: '09:00',
    end: '09:45',
    kind: 'outline',
    title: 'Review · PR #1100',
    detail: 'dashboard board on phones',
  },
  {
    id: 'r2',
    day: '2026-11-11',
    start: '11:00',
    end: '12:30',
    kind: 'run',
    title: 'Review bot round 3',
    detail: '6 of 9 files',
  },
  {
    id: 'r3',
    day: '2026-11-11',
    start: '14:00',
    end: '14:30',
    kind: 'accent',
    title: 'Approve deploy',
    detail: 'prod 1.4.2',
    locked: true,
  },
  {
    id: 'r4',
    day: '2026-11-12',
    start: '10:00',
    end: '11:00',
    kind: 'outline',
    title: 'Review · ui week-calendar',
    detail: 'drag + list view',
  },
  {
    id: 'r5',
    day: '2026-11-12',
    start: '10:30',
    end: '11:15',
    kind: 'hatch',
    title: 'Smoke check',
    detail: 'consumer-check',
  },
  {
    id: 'r6',
    day: '2026-11-13',
    start: '15:00',
    end: '16:00',
    kind: 'solid',
    title: 'Retro · review rounds',
    detail: 'what slowed approvals',
  },
];

export const doc: ComponentDoc = {
  slug: 'week-calendar',
  name: 'Week Calendar',
  tag: 'ui-week-calendar',
  group: 'Components',
  summary: 'What runs when this week — and move a block to another slot by dragging it or with the keyboard.',
  description:
    'A week (or 1–6 days) of scheduled work — cron jobs, deploy windows, checks, reminders, review slots — as blocks on an hour grid, one column per day. A block is drawn by its kind: solid ink, accent-filled, a hatched outline (a check), a plain outline (a reminder), or a running / failed tint; a lock marks a fixed time. Overlapping blocks split their column into lanes. Today’s column is softly hatched with its date in a filled circle, and a red line with a dot marks now (the host passes now and ticks it; the element never reads the clock). Drag a block — a long press first on touch, so the grid still scrolls — and a ghost follows, snapped to the step and the day; the drop sends a cancelable ui-move and the block stays there until the next data. From the keyboard every block is a button in time order: Enter opens it, Alt+arrows move it by the step or a day, and a polite live region says where it went. On a phone (view auto, under 640px) the same data is a list grouped by day; the header’s Week | List switch pins either, and ‹ › ask the host for the previous or next range. Seven columns narrower than 88px scroll sideways inside the card with the hours pinned on the left — the page itself never overflows.',
  usedIn:
    'Fits the soma-work dashboard’s schedule surfaces: the cron jobs of a channel or agent (next runs, a failed run’s tint), planned deploy windows and review slots — not wired yet.',
  reference: {
    name: 'Halvi (Code and Chill) — pattern studied, no code used',
    url: 'https://demo.codeandchill.store/halvi/',
  },
  props: [
    { name: 'data.start', type: 'string (YYYY-MM-DD)', required: true, description: 'The first day shown.' },
    { name: 'data.days', type: 'number', default: '7', description: 'Days shown, clamped 1 … 7.' },
    {
      name: 'data.hours',
      type: '[number, number]',
      default: '[7, 22]',
      description:
        'The hours shown, from … to (whole hours, clamped 0 … 24). Blocks outside them show in the list only.',
    },
    {
      name: 'data.now',
      type: 'string (ISO)',
      description:
        'The time now: the red line in its day’s column when it falls inside the range and hours. With an offset it is read in the viewer’s time zone, without one as written. The host ticks it (data.now, or the now property, which keeps local moves).',
    },
    {
      name: 'data.today',
      type: 'string (YYYY-MM-DD)',
      default: 'the day of now',
      description: 'The day marked as today (hatched column, filled date; the accent number in the list).',
    },
    {
      name: 'data.rangeLabel',
      type: 'string',
      default: '“9 Nov – 15 Nov 2026” / “2026년 11월 9일 – 15일”',
      description: 'The header’s range words.',
    },
    {
      name: 'data.events',
      type: 'WeekEvent[]',
      required: true,
      description:
        '{ id, day, start: "HH:MM", end?: "HH:MM" (default start + 30 min), title, detail?, kind?, locked? }. Events outside the shown days are left out.',
    },
    {
      name: 'data.events[].kind',
      type: '"solid" | "accent" | "hatch" | "outline" | "run" | "fail"',
      default: '"solid"',
      description:
        'Ink · accent fill · hatched outline (a check) · plain outline (a reminder) · a running / failed tint with a coloured edge.',
    },
    {
      name: 'data.events[].locked',
      type: 'boolean',
      description: 'A fixed time: a lock glyph, “Fixed time” in its name, no drag and no Alt+arrow move.',
    },
    {
      name: 'data.view',
      type: '"week" | "list" | "auto"',
      default: '"auto"',
      description:
        'auto: the list under 640px (matchMedia, watched only while connected and in auto), the week otherwise. The switch pins a view until the host sends a different view.',
    },
    { name: 'data.step', type: 'number', default: '15', description: 'Minutes a drag and Alt+↑/↓ snap to.' },
    {
      name: 'data.legend',
      type: 'Array<{ kind, label, count? }>',
      description: 'A row of swatches above the grid; the drag hint sits at its end in the week view.',
    },
    { name: 'data.empty', type: 'string', default: '“Nothing scheduled this week”', description: 'The empty state.' },
    {
      name: 'lang',
      type: '"en" | "ko"',
      default: '"en"',
      description: 'UI words and dates (주 / 목록, 11월 12일 (목)).',
    },
    { name: 'flat', type: 'boolean attribute', description: 'No card of its own (inside a host frame).' },
    {
      name: '--wk-hour-h · --wk-col-min · --wk-gutter · --wk-max-h',
      type: 'CSS properties on the element',
      default: '48px · 88px · 52px · 560px',
      description:
        'An hour’s height, the narrowest a day column gets before the grid scrolls sideways, the hour gutter, the grid’s height before it scrolls.',
    },
    { name: 'view', type: '"week" | "list" (read-only)', description: 'The view drawn now.' },
    {
      name: 'now',
      type: 'string (property)',
      description: 'Set the time now without a new data — the now line moves, local moves stay.',
    },
    {
      name: 'parseHm · fmtHm · addDays · weekDays · eventLanes · snapMinutes · moveEvent · listGroups · weekRangeLabel',
      type: 'helpers',
      description:
        'Pure: "09:30" ↔ 570, day arithmetic, the overlap lanes ({ lane, lanes } per id), snapping, a move that keeps the length inside the hours, the list’s day groups, the header words.',
    },
  ],
  events: [
    {
      name: 'ui-move',
      detail: '{ id: string; day: string; start: string; end: string }',
      description:
        'A block was dropped on a new slot, or moved with Alt+arrows. Cancel to put it back; otherwise it stays there until the next data (persist it and send the new events).',
    },
    {
      name: 'ui-open',
      detail: '{ id: string }',
      description: 'A block or list row was clicked, or Enter / Space on it.',
    },
    {
      name: 'ui-range',
      detail: '{ dir: -1 | 1 }',
      description: '‹ or › — the host sets the data for the previous or next range.',
    },
    {
      name: 'ui-view',
      detail: "{ view: 'week' | 'list' }",
      description: 'The Week | List switch. Cancel to keep the view; otherwise it is pinned.',
    },
  ],
  keyboard: [
    ['Tab', 'Through ‹ ›, the switch, then every block (or row) in time order.'],
    ['Enter / Space', 'Open the focused block (ui-open).'],
    ['Alt + ↑ / ↓', 'Move the focused block earlier / later by the step (ui-move).'],
    ['Alt + ← / →', 'Move it to the day before / after (ui-move).'],
    ['← → ↑ ↓ · Home / End', 'In the Week | List switch: choose.'],
    ['Escape', 'While dragging: put the block back.'],
  ],
  a11y: [
    'A section named “Week schedule, <range>”; each day column is a group named by its day (“Wed 11 Nov, today”).',
    'Every block is a button named “title, day, start – end, detail, Fixed time” and described by the keys that move it; the hour gutter, day row, now line and ghost are hidden from the reader.',
    'A move — by drag or keys — is announced in a polite live region (“Moved to Thu 12 Nov 09:30” / “11월 12일 (목) 09:30 시작으로 옮겼습니다”); a fixed block says it cannot be moved.',
    'The range words are a polite live region, so ‹ › read the new range.',
    'The Week | List switch is a radiogroup with a roving tab stop; arrows choose.',
    'Kind is never colour alone: hatch, outline and fill differ in shape, and the list repeats the swatch beside the time.',
    'Touch: a block lifts only after a 350ms still press, so a swipe across blocks scrolls the grid; reduced motion drops the glides.',
  ],
  usage: `<ui-week-calendar></ui-week-calendar>
<script type="module">
  import '@2lab.ai/ui/week-calendar';
  const cal = document.querySelector('ui-week-calendar');
  cal.data = {
    start: '2026-11-09',
    now: new Date().toISOString(),          // the host ticks it: cal.now = new Date().toISOString()
    events: [
      { id: 'nightly-mon', day: '2026-11-09', start: '21:00', end: '21:30', title: 'Nightly usage report', detail: 'cron 0 21 * * 1-5' },
      { id: 'deploy', day: '2026-11-10', start: '14:00', end: '15:00', kind: 'accent', title: 'Deploy window · 1.4.2' },
      { id: 'merge', day: '2026-11-15', start: '10:00', end: '11:00', title: 'Weekly memory merge', locked: true },
    ],
  };
  cal.addEventListener('ui-move', async (e) => {
    const { id, day, start, end } = e.detail;   // e.preventDefault() puts it back
    await api.reschedule(id, { day, start, end });
    cal.data = { ...cal.data, events: await api.events() };
  });
  cal.addEventListener('ui-range', (e) => loadWeek(e.detail.dir));
</script>`,
  demos: [
    {
      id: 'jobs',
      title: 'Scheduled jobs this week',
      description:
        'Cron jobs in ink (the weekly memory merge is fixed), deploy windows in accent, checks hatched, reminders outlined, a running eval and a failed backfill; Wednesday is today with the now line at 10:25. Drag a block or use Alt+arrows; ‹ › page the weeks.',
      height: 720,
      frame: false,
      create: () => hosted(weekData(), (start) => schedule(start)),
    },
    {
      id: 'list',
      title: 'The same week as a list',
      description:
        'view="list" — what a phone shows in auto: only days with something on them, each row a kind swatch, the time, the title with its length and detail, and a chevron. Today’s date is in the accent.',
      height: 720,
      frame: false,
      create: () => hosted({ ...weekData(), view: 'list' }, (start) => schedule(start)),
    },
    {
      id: 'three-days',
      title: 'Three days, narrow',
      description:
        'days: 3, hours 8–20, in a 360px column: review slots, an approval that cannot move and two overlapping blocks sharing their column.',
      height: 640,
      frame: false,
      create: () => {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'max-width:360px;margin:0 auto';
        wrap.append(
          hosted(
            {
              start: '2026-11-11',
              days: 3,
              hours: [8, 20],
              now: NOW,
              view: 'week',
              step: 30,
              events: REVIEWS,
            },
            () => REVIEWS,
          ),
        );
        return wrap;
      },
    },
    {
      id: 'empty',
      title: 'An empty week',
      description:
        'Nothing scheduled: the grid stays so the week still reads as a week, with the empty words over it (the list says the same).',
      height: 420,
      frame: false,
      create: () => hosted({ start: '2026-11-16', now: NOW, events: [], hours: [9, 18] }, () => []),
    },
    {
      id: 'ko',
      title: 'Korean',
      description:
        'lang="ko" — 주 / 목록, 이전 주 / 다음 주, dates as 11월 12일 (목), the moved announcement in Korean.',
      height: 720,
      frame: false,
      create: () => hosted(weekData(1), (start) => schedule(start, 1), { lang: 'ko' }, 1),
    },
  ],
};
