import type { ComponentDoc } from '../../docs/types';
import './dot-grid';
import type { UiDotGrid } from './dot-grid';
import type { DotCell, DotGridData, DotSelect, DotState } from './logic';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Today in the demos: Mon 9 Nov 2026. `ago` days back, as "Mon 9 Nov" and as a short "9 Nov". */
const TODAY = Date.UTC(2026, 10, 9);
const day = (ago: number) => {
  const d = new Date(TODAY - ago * 86_400_000);
  return {
    long: `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`,
    short: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`,
    weekend: d.getUTCDay() === 0 || d.getUTCDay() === 6,
  };
};
const WORD: Record<DotState, string> = {
  done: 'ok',
  fail: 'failed',
  wait: 'waiting',
  run: 'running',
  pending: 'later today',
  empty: 'no run',
  skip: 'skipped',
};

/** One cell per run over the last `days` days at the given times; `odd` overrides a run by "daysAgo@time". */
function runs(days: number, times: string[], odd: Record<string, DotState> = {}, now = '14:20'): DotCell[] {
  const out: DotCell[] = [];
  for (let ago = days - 1; ago >= 0; ago--)
    for (const t of times) {
      const late = ago === 0 && t > now;
      const state: DotState = odd[`${ago}@${t}`] ?? (late ? 'pending' : 'done');
      out.push({ state, label: `${day(ago).long} ${t} — ${WORD[state]}` });
    }
  return out;
}

function grid(data: DotGridData, attrs: Record<string, string> = {}): UiDotGrid {
  const el = document.createElement('ui-dot-grid');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

/** A light-DOM card head and a status line that says what ui-select carried. */
function card(title: string, sub: string, el: UiDotGrid, say = true): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:14px;padding:18px 20px;min-width:0';
  const head = document.createElement('div');
  const h = document.createElement('div');
  h.style.cssText = 'font-size:14px;font-weight:650;color:var(--ui-ib-text)';
  h.textContent = title;
  const s = document.createElement('div');
  s.style.cssText = 'font-size:12.5px;color:var(--ui-ib-muted)';
  s.textContent = sub;
  head.append(h, s);
  box.append(head, el);
  if (say) {
    const line = document.createElement('p');
    line.className = 'ui-status-line';
    line.style.margin = '0';
    line.textContent = 'Click a square, or Tab in and use the arrows.';
    el.addEventListener('ui-select', (e) => {
      const d = (e as CustomEvent<DotSelect>).detail;
      line.textContent = `ui-select → ${d.rowId} · run ${d.index + 1} · ${d.state}`;
    });
    box.append(line);
  }
  return box;
}

const CRON: DotGridData = {
  label: 'Cron runs, last 14 days',
  summary: true,
  rows: [
    { id: 'nightly-backup', label: 'nightly-backup', cells: runs(14, ['02:00'], { '9@02:00': 'fail' }) },
    {
      id: 'reindex-search',
      label: 'reindex-search',
      cells: runs(14, ['06:00', '18:00'], { '11@18:00': 'fail', '5@06:00': 'skip', '3@18:00': 'fail' }),
    },
    { id: 'digest-mail', label: 'digest-mail', cells: runs(14, ['09:00'], { '6@09:00': 'wait' }) },
    {
      id: 'token-spend-report',
      label: 'token-spend-report',
      cells: runs(14, ['23:30'], { '12@23:30': 'empty', '4@23:30': 'fail' }),
    },
  ],
};

const CI_DAYS = 21;
const CI_COLUMNS = Array.from({ length: CI_DAYS }, (_, i) => {
  const ago = CI_DAYS - 1 - i;
  return ago === 0 ? 'Today' : i % 7 === 0 ? day(ago).short : '';
});
function ci(fails: number[], today: DotState): DotCell[] {
  return Array.from({ length: CI_DAYS }, (_, i) => {
    const ago = CI_DAYS - 1 - i;
    const d = day(ago);
    const state: DotState = ago === 0 ? today : d.weekend ? 'skip' : fails.includes(ago) ? 'fail' : 'done';
    return { state, label: `${d.long} — ${state === 'skip' ? 'no builds (weekend)' : WORD[state]}` };
  });
}
const CI: DotGridData = {
  label: 'CI per day, last 3 weeks',
  columns: CI_COLUMNS,
  states: { done: 'Green', fail: 'Red', run: 'Running', wait: 'Queued', skip: 'No builds' },
  rows: [
    { id: 'lint', label: 'lint', cells: ci([], 'done') },
    { id: 'typecheck', label: 'typecheck', cells: ci([15], 'done') },
    { id: 'unit', label: 'unit (vitest)', cells: ci([15, 8, 2], 'done') },
    { id: 'e2e', label: 'e2e (playwright)', cells: ci([16, 9, 8, 1], 'run') },
    { id: 'consumer-check', label: 'consumer-check', cells: ci([10], 'wait') },
  ],
};

const DEPLOY_N = 30;
function deploys(fails: number[], skips: number[] = []): DotState[] {
  return Array.from({ length: DEPLOY_N }, (_, i) => (fails.includes(i) ? 'fail' : skips.includes(i) ? 'skip' : 'done'));
}

export const doc: ComponentDoc = {
  slug: 'dot-grid',
  name: 'Dot Grid',
  tag: 'ui-dot-grid',
  summary:
    'A run history at a glance: which runs went through, which failed and which are still to come — one row of squares per job.',
  description:
    'One row per item — a cron job, a CI workflow, a deploy target — with its name at the left and a rounded square per run: ink went through, red failed, amber is waiting, blue is running (a gentle pulse), hatched is still to come today, an outline is nothing yet, a faint pill was skipped. A legend under it lists only the states that are there, and a summary line (“12 done · 2 failed · 1 to come”) is the grid’s description. The cells share the row’s width (each column minmax(0, 1fr), capped), so 14 or 28 runs fit at 390px — they shrink, never overflow; rows of different lengths line up in time. The names truncate, and under 480px of its own width the name goes above its row. size="lg" draws taller tiles that wrap into lines of `wrap` — a tally (“4 of 10 review rounds”). The grid is one tab stop: the arrows move in 2D, hover or focus shows a cell’s words in a small bubble, and Enter / Space or a click sends a cancelable ui-select. The element never fetches; a state that changes patches its square in place.',
  usedIn:
    'Fits the soma-work dashboard’s cron and run panels: one row per scheduled job with its last two weeks of runs, and CI / deploy history per day (not wired yet).',
  reference: {
    name: 'Halvi (Code and Chill) — pattern studied, no code used',
    url: 'https://demo.codeandchill.store/halvi/',
  },
  group: 'Components',
  props: [
    {
      name: 'data.rows',
      type: 'Array<{ id: string; label: string; cells: Array<DotState | { state: DotState; label?: string }> }>',
      required: true,
      description:
        'One row per item. `id` comes back in ui-select (first of each id wins); `label` is the row’s name. A cell is a state word or `{ state, label }` — the label is the tooltip and what a reader hears (“Mon 3 Nov 09:00 — failed”). An unknown state is drawn as empty.',
    },
    {
      name: 'DotState',
      type: "'done' | 'fail' | 'wait' | 'run' | 'pending' | 'empty' | 'skip'",
      description:
        'done — ink · fail — --st-fail · wait — --st-wait · run — --st-run with a gentle pulse · pending — hatched (still to come) · empty — an outline (nothing yet) · skip — a faint pill.',
    },
    { name: 'data.label', type: 'string', default: '"Run history"', description: 'The grid’s accessible name.' },
    {
      name: 'data.columns',
      type: 'string[]',
      description:
        'Header labels over the cells (dates); may be sparse — an empty string draws nothing there. Also used in a cell’s words when it has no label. Not drawn with `wrap`.',
    },
    {
      name: 'data.legend',
      type: 'boolean',
      default: 'when 2+ states are present',
      description: 'Draw the legend. Only the states present are listed, in a fixed order.',
    },
    {
      name: 'data.states',
      type: 'Partial<Record<DotState, string>>',
      description:
        'Your own words for the states — legend, tooltip, aria and summary: `{ done: "Green", fail: "Red" }`.',
    },
    {
      name: 'data.summary',
      type: 'boolean',
      default: 'false',
      description:
        'Show the summary line (“12 done · 2 failed · 1 to come”) under the grid. It is always the grid’s description for readers.',
    },
    { name: 'data.empty', type: 'string', default: '"No runs yet"', description: 'Words when there are no rows.' },
    {
      name: 'size',
      type: '"sm" | "md" | "lg" (attribute)',
      default: '"md"',
      description:
        'sm — 8px squares for dense history · md — 14px · lg — 34px tiles with a larger radius, the name above (a tally).',
    },
    {
      name: 'wrap',
      type: 'number (attribute)',
      default: 'no wrap',
      description: 'Cells per line: the row wraps into lines of this many (lg tallies). Up / Down step a line first.',
    },
    { name: 'lang', type: '"en" | "ko"', default: '"en"', description: 'State words, summary and the default name.' },
    {
      name: '--dot-grid-label-w',
      type: 'CSS property on the element',
      default: '132px',
      description: 'The widest the name column grows before names truncate.',
    },
    {
      name: 'dotState(v) / dotCounts(rows) / dotSummary(counts, lang, words)',
      type: 'helpers',
      description:
        'Pure: normalise a state (junk → "empty"), per-state totals over every row, and the summary text in en / ko — for a header count or a server render.',
    },
    {
      name: 'dotRows / dotLegend / dotMove',
      type: 'helpers',
      description: 'Pure: the rows drawn, the legend’s states, and where a key moves the focus.',
    },
  ],
  events: [
    {
      name: 'ui-select',
      detail: '{ rowId: string; index: number; state: DotState }',
      description:
        'Enter / Space or a click on a cell. Bubbling, composed, cancelable; the grid holds no selection of its own — open the run’s log, filter a table.',
    },
  ],
  keyboard: [
    ['Tab', 'Enter the grid at its one tab stop (the last cell focused, else the first).'],
    [
      '← → ↑ ↓',
      'Move between cells in 2D; stops at the edges. Rows of different lengths land on the same spot in time.',
    ],
    ['Home / End', 'First / last cell of the row.'],
    ['Ctrl+Home / Ctrl+End', 'First cell of the grid / last cell of the grid.'],
    ['Enter / Space', 'Send ui-select for the cell.'],
    ['Esc', 'Close the bubble.'],
  ],
  a11y: [
    'role="grid" (aria-readonly) with one role="row" per item, its name as role="rowheader", and a role="gridcell" per run — one tab stop with a roving tabindex.',
    'Every cell has an aria-label: the row’s name and the cell’s words (“nightly-backup, Thu 6 Nov 02:00 — failed”); without a label, the column header or its place (“3 of 14”) and the state word. A label that lacks the state word gets it added.',
    'The summary (“12 done · 2 failed · 1 to come”) is the grid’s aria-describedby; the legend and the bubble are aria-hidden (the cells already say it).',
    'Colour is never the only signal: pending is hatched, empty an outline, skip a short pill; every state has its word in the tooltip and the label.',
    'Running squares breathe gently; under reduced motion they are still. In forced colours the marks keep their paint and the outlined states get a CanvasText edge.',
  ],
  usage: `<ui-dot-grid size="md"></ui-dot-grid>
<script type="module">
  import '@2lab.ai/ui/dot-grid';
  const grid = document.querySelector('ui-dot-grid');
  grid.data = {
    label: 'Cron runs, last 14 days',
    summary: true,
    rows: [
      { id: 'backup', label: 'nightly-backup', cells: ['done', 'done', { state: 'fail', label: 'Thu 6 Nov 02:00 — failed' }, 'pending'] },
      { id: 'digest', label: 'digest-mail', cells: ['done', 'skip', 'done', 'run'] },
    ],
  };
  grid.addEventListener('ui-select', (e) => openRun(e.detail.rowId, e.detail.index));
</script>
<!-- a tally: 4 of 10, tiles in lines of 5 -->
<ui-dot-grid size="lg" wrap="5"></ui-dot-grid>`,
  demos: [
    {
      id: 'cron',
      title: 'Cron runs — last 14 days',
      description:
        'Four scheduled jobs; reindex-search runs twice a day, so its 28 squares are half as wide and still line up by day. A few failures, a skipped run, one that waited, one with no run at all — and today’s later runs hatched. Hover or focus a square for its time.',
      height: 300,
      create: () => card('Scheduled jobs', 'Last 14 days · each square is a run', grid({ ...CRON }), true),
    },
    {
      id: 'ci',
      title: 'CI per day',
      description:
        'Five workflows over three weeks with sparse date headers. Your own state words (Green, Red, Queued, No builds); weekends are skipped, today’s e2e is running and consumer-check is queued.',
      height: 320,
      create: () => card('CI on main', 'One square per day · last 3 weeks', grid({ ...CI }), true),
    },
    {
      id: 'tally',
      title: 'A tally in big tiles',
      description:
        'size="lg" wrap="5": one unnamed row of ten tiles — four review rounds used, six left. The summary line counts them in your words.',
      height: 260,
      create: () =>
        card(
          'Review rounds — 4 of 10',
          'PR #412 · feat(dot-grid) · the bot stops at 10',
          grid(
            {
              label: 'Review rounds, 4 of 10',
              legend: false,
              summary: true,
              states: { done: 'Used', pending: 'Left' },
              rows: [
                {
                  id: 'rounds',
                  label: '',
                  cells: Array.from({ length: 10 }, (_, i) =>
                    i < 4
                      ? { state: 'done' as const, label: `Round ${i + 1} — done` }
                      : { state: 'pending' as const, label: `Round ${i + 1} — left` },
                  ),
                },
              ],
            },
            { size: 'lg', wrap: '5' },
          ),
          false,
        ),
    },
    {
      id: 'compact',
      title: 'Compact — deploys per environment',
      description:
        'size="sm": the last 30 deploys to each environment in 8px squares, a dense strip that still fits at 390px. Preview builds are skipped while a branch is draft.',
      height: 220,
      create: () =>
        card(
          'Deploys',
          'Last 30 per environment',
          grid(
            {
              label: 'Deploys, last 30 per environment',
              summary: true,
              rows: [
                { id: 'production', label: 'production', cells: deploys([7, 22]) },
                { id: 'staging', label: 'staging', cells: deploys([3, 4, 18, 26]) },
                { id: 'preview', label: 'preview', cells: deploys([12], [0, 1, 2, 15, 16]) },
              ],
            },
            { size: 'sm' },
          ),
          true,
        ),
    },
    {
      id: 'ko',
      title: 'Korean',
      description: 'lang="ko": the legend, the summary and every cell’s words in Korean.',
      height: 260,
      create: () =>
        card(
          '예약 작업',
          '최근 14일 · 칸 하나가 실행 한 번',
          grid(
            {
              ...CRON,
              label: '예약 작업 실행 기록',
              rows: CRON.rows.map((r) => ({ ...r, cells: r.cells.map((c) => (c as DotCell).state) })),
            },
            { lang: 'ko' },
          ),
          false,
        ),
    },
  ],
};
