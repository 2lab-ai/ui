import type { ComponentDoc } from '../../docs/types';
import './episode-log';
import type {
  EpisodeAddDetail,
  EpisodeDateDetail,
  EpisodeDay,
  EpisodeDeleteDetail,
  EpisodeEditDetail,
  EpisodeLogData,
  UiEpisodeLog,
} from './episode-log';
import { episodeDateOf } from './episode-log';

const DAY = 86_400_000;
const today = episodeDateOf();
const ago = (n: number) => episodeDateOf(Date.now() - n * DAY);

const EN: EpisodeDay[] = [
  {
    date: today,
    revision: 1,
    entries: [
      { id: 'e1', time: '08:41', text: 'Asked to keep weekly reports to one page; the summary goes first.' },
      { id: 'e2', time: '10:17', text: 'Staging deploys wait until the database migration finishes (about 14:00).' },
      { id: 'e3', time: '13:02', text: 'The design review moved to Thursday.\nInvite the whole platform team.' },
    ],
  },
  {
    date: ago(1),
    revision: 1,
    entries: [
      { id: 'd1', time: '16:20', text: 'Release notes for 2.4 drafted; waiting for the changelog review.' },
      { id: 'd2', time: '18:05', text: 'Prefers short answers with the command first, then the explanation.' },
    ],
  },
  {
    date: ago(3),
    revision: 1,
    entries: [{ id: 'c1', time: '11:30', text: 'Onboarding checklist finished for the two new engineers.' }],
  },
];

const KO: EpisodeDay[] = [
  {
    date: today,
    revision: 1,
    entries: [
      { id: 'k1', time: '09:05', text: '주간 보고서는 한 장으로, 요약을 맨 앞에 두기로 했습니다.' },
      { id: 'k2', time: '11:40', text: '스테이징 배포는 DB 마이그레이션이 끝난 뒤(14시쯤)에 합니다.' },
    ],
  },
  {
    date: ago(1),
    revision: 1,
    entries: [{ id: 'k3', time: '17:10', text: '2.4 릴리스 노트 초안 작성 — 변경 기록 검토 대기 중.' }],
  },
];

let seq = 100;
const clock = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** A demo host: answers every event against local state after a short "network" delay, as a page would. */
function live(
  initial: EpisodeDay[],
  attrs: Record<string, string> = {},
  extra: Partial<EpisodeLogData> = {},
): UiEpisodeLog {
  const el = document.createElement('ui-episode-log');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  let days = structuredClone(initial);
  let status = '';
  const ko = attrs.lang === 'ko';
  const paint = (more: Partial<EpisodeLogData> = {}) => {
    el.data = { days, today, timeLabel: undefined, status, ...extra, ...more };
  };
  const later = (fn: () => void) => {
    paint({ busy: true });
    setTimeout(fn, 450);
  };
  el.addEventListener('ui-edit', (e) => {
    const d = (e as CustomEvent<EpisodeEditDetail>).detail;
    later(() => {
      days = days.map((day) =>
        day.date === d.date
          ? { ...day, entries: day.entries.map((x) => (x.id === d.id ? { ...x, text: d.text } : x)) }
          : day,
      );
      status = ko ? '저장했습니다' : 'Saved';
      paint();
    });
  });
  el.addEventListener('ui-delete', (e) => {
    const d = (e as CustomEvent<EpisodeDeleteDetail>).detail;
    later(() => {
      days = days.map((day) =>
        day.date === d.date ? { ...day, entries: day.entries.filter((x) => x.id !== d.id) } : day,
      );
      status = ko ? '지웠습니다' : 'Deleted';
      paint();
    });
  });
  el.addEventListener('ui-add', (e) => {
    const d = (e as CustomEvent<EpisodeAddDetail>).detail;
    later(() => {
      const entry = { id: `n${seq++}`, time: clock(), text: d.text };
      const has = days.some((day) => day.date === today);
      days = has
        ? days.map((day) => (day.date === today ? { ...day, entries: [...day.entries, entry] } : day))
        : [{ date: today, entries: [entry] }, ...days];
      status = ko ? '오늘 기록에 추가했습니다' : 'Added to today’s log';
      paint();
    });
  });
  el.addEventListener('ui-date', (e) => {
    const d = (e as CustomEvent<EpisodeDateDetail>).detail;
    status = '';
    // The page loads the day it was asked for; here every day is loaded already, so show it at once.
    paint({ date: d.date });
  });
  paint();
  return el;
}

function pad(el: HTMLElement): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'padding:18px 20px';
  box.append(el);
  return box;
}

export const doc: ComponentDoc = {
  slug: 'episode-log',
  name: 'Episode Log',
  tag: 'ui-episode-log',
  summary: 'What did the agent notice, and when? — a dated log you can read by day, correct in place and add to.',
  description:
    'Observations grouped by day, newest first, under a day filter (Today, Yesterday, then dates). Each entry shows its time in tabular figures and its text with line breaks kept; Edit opens it in place (⌘↵ saves, Esc cancels, an empty entry cannot be saved), Delete asks twice, and a note box at the foot adds to today’s log. Nothing typed is ever lost: when the host updates the log under an open editor, the editor stays on its entry; if that entry changed or went away meanwhile, the draft moves into the note box with a quiet notice. A refused note stays in the box; an added one rises into today’s list and the box empties.',
  usedIn: 'soma-work settings — the 기억 tab’s 관찰 기록 (episodic memory) section (M-06).',
  reference: { name: 'Activity log', url: 'https://www.affectui.com' },
  group: 'Pages',
  props: [
    {
      name: 'data.days',
      type: 'EpisodeDay[]',
      required: true,
      description:
        '`{ date: "YYYY-MM-DD", entries: { id?, time? | at?, text }[], revision? }` — the loaded days, any order.',
    },
    {
      name: 'data.dates',
      type: 'string[]',
      description: 'Every date that has entries — the filter’s choices (default: the loaded days).',
    },
    {
      name: 'data.date',
      type: 'string | null',
      description:
        'The filter: one day, or null for every loaded day. A day the reader picks stays until the host names another.',
    },
    { name: 'data.today', type: 'string', description: 'YYYY-MM-DD called “Today” (default: the local date).' },
    { name: 'data.timeLabel', type: 'string', description: 'A word after each time (“UTC”).' },
    { name: 'data.loading', type: 'boolean', description: 'Skeleton entries while a day loads.' },
    {
      name: 'data.busy',
      type: 'boolean',
      description: 'A write is out: edit, delete and add wait (“Saving…”, “Adding…”).',
    },
    {
      name: 'data.status / data.error',
      type: 'string',
      description: 'A quiet line (“Saved”) / an alert (drafts stay).',
    },
    { name: 'data.readOnly', type: 'boolean', description: 'Entries only — no edit, delete or note box.' },
    {
      name: 'data.canAdd, addLabel, placeholder, emptyText',
      type: 'boolean / string',
      description: 'The note box and the empty state.',
    },
    {
      name: 'note / clearNote() / closeEditor()',
      type: 'string / method',
      description: 'The note box’s text; empty it; close the editor.',
    },
    { name: 'lang', type: '"en" | "ko"', default: '"en"', description: 'Built-in words and day names.' },
  ],
  events: [
    {
      name: 'ui-date',
      detail: '{ date: string | null }',
      description:
        'The filter changed. Cancelable; not prevented, a loaded day shows at once (load it and set `days` otherwise).',
    },
    {
      name: 'ui-edit',
      detail: '{ date, index, id?, original, text, revision? }',
      description:
        'Save an entry’s new text. The editor shows “Saving…” and closes when the entry reads the new text; a refusal (`error`) keeps it open.',
    },
    {
      name: 'ui-delete',
      detail: '{ date, index, id?, text, revision? }',
      description: 'Delete an entry (after the two-press).',
    },
    {
      name: 'ui-add',
      detail: '{ text: string }',
      description: 'Add a note to today. The box empties when the entry arrives in today’s list; a refusal keeps it.',
    },
  ],
  keyboard: [
    ['⌘ / Ctrl + Enter', 'Save the open entry; add the note.'],
    ['Esc', 'Cancel the edit; disarm Delete.'],
    ['Tab', 'Filter, then each entry’s Edit and Delete, then the note box.'],
  ],
  a11y: [
    'Each day is a labelled section with an h3; entries are an ordered list.',
    'The editor is labelled with the entry’s time; an empty entry says why Save is off (role="alert").',
    'Delete asks twice: the armed button reads “Delete?” and disarms after 4 s, on Esc or when focus leaves.',
    'Status lines are role="status"; errors are role="alert" with an icon and words.',
    'Sound (opt-in, @2lab.ai/ui/sound): adding a note and saving an edit play tap once ui-add / ui-edit go through; Delete taps subtly when it arms and plays a strong close when it confirms; picking a day plays a subtle navigate (a later day forward, an earlier one or All days back); keystrokes in the note and the editor play type while the page has typing sounds on. Silent until the page turns sound on.',
  ],
  usage: `<ui-episode-log id="log"></ui-episode-log>
<script type="module">
  import '@2lab.ai/ui/episode-log';
  const log = document.getElementById('log');
  log.data = { days: [await getDay(today)], dates: await getDates() };
  log.addEventListener('ui-date', async (e) => { e.preventDefault(); log.data = { ...log.data, date: e.detail.date, loading: true };
    log.data = { ...log.data, days: [await getDay(e.detail.date)], loading: false }; });
  log.addEventListener('ui-edit', async (e) => { log.data = { ...log.data, busy: true };
    const r = await put(e.detail); log.data = { ...log.data, busy: false, days: r.days, error: r.error }; });
  log.addEventListener('ui-add', async (e) => { /* POST, then set days — the box empties when the note arrives */ });
</script>`,
  demos: [
    {
      id: 'log',
      title: 'A week of observations',
      description:
        'Three days, newest first. Edit an entry (⌘↵ saves), delete one (press twice), add a note — the demo answers after a short delay.',
      height: 640,
      create: () => pad(live(EN, {}, { dates: [today, ago(1), ago(3), ago(6)] })),
    },
    {
      id: 'one-day',
      title: 'One day, with a time zone',
      description: 'Filtered to yesterday; times carry “UTC”.',
      height: 360,
      create: () => pad(live(EN, {}, { date: ago(1), timeLabel: 'UTC' })),
    },
    {
      id: 'korean',
      title: 'Korean',
      description: 'lang="ko" — 오늘 / 어제, 수정 · 삭제, 오늘 기록에 메모 추가.',
      height: 520,
      create: () => pad(live(KO, { lang: 'ko' })),
    },
    {
      id: 'states',
      title: 'Empty, loading, read-only',
      description: 'Nothing yet (the note box still adds); a day loading; a read-only log.',
      height: 640,
      create: () => {
        const col = document.createElement('div');
        col.style.cssText = 'display:flex;flex-direction:column;gap:22px;padding:18px 20px';
        const empty = live([], {}, {});
        const loading = document.createElement('ui-episode-log');
        loading.data = { days: [], dates: [today], loading: true, canAdd: false };
        const ro = document.createElement('ui-episode-log');
        ro.data = { days: [EN[1]], today, readOnly: true };
        col.append(empty, loading, ro);
        return col;
      },
    },
  ],
};
