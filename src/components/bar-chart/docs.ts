import type { ComponentDoc } from '../../docs/types';
import './bar-chart';
import type { BarChartData, BarDatum } from './logic';

const DAY = 86_400_000;
/** Demos end on a fixed day (Fri 30 Oct 2026) so they render the same everywhere. */
const END = Date.UTC(2026, 9, 30);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];

/** One bar per day, oldest first, ending on END: key = ISO date, label “Oct 17” / “10/17 (토)”, title the full day. */
function days(values: Array<number | undefined>, lang: 'en' | 'ko' = 'en'): BarDatum[] {
  return values.map((value, i) => {
    const at = new Date(END - (values.length - 1 - i) * DAY);
    const m = at.getUTCMonth();
    const d = at.getUTCDate();
    const w = at.getUTCDay();
    return {
      key: at.toISOString().slice(0, 10),
      label: lang === 'ko' ? `${m + 1}/${d} (${DOW_KO[w]})` : `${MON[m]} ${d}`,
      title: lang === 'ko' ? `${m + 1}월 ${d}일 (${DOW_KO[w]})` : `${DOW[w]} ${d} ${MON[m]}`,
      value,
    };
  });
}

function make(data: BarChartData, attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('ui-bar-chart');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

/** Sessions started per day, Sat 17 – Fri 30 Oct: quiet weekends, today still filling up. */
const SESSIONS = [4, 3, 15, 21, 17, 14, 19, 6, 2, 16, 22, 18, 12, 9];

/** Lines added / removed per day, Sat 24 – Fri 30 Oct. */
const ADDED = [120, 0, 1840, 2310, 960, 1520, 740];
const REMOVED = [40, 0, 620, 1190, 410, 880, 220];

/** Spend per day over 30 days (USD). */
const COST = [
  3.1, 1.2, 0.8, 4.6, 5.9, 6.4, 5.2, 4.8, 1.6, 0.9, 5.4, 7.2, 6.8, 6.1, 5.5, 1.4, 0.7, 6.3, 8.1, 7.4, 6.9, 5.8, 1.9,
  1.1, 7.6, 9.4, 8.2, 7.1, 6.6, 3.2,
];

function stacked(): BarChartData {
  return {
    title: 'Code changes · last 7 days',
    series: [
      { key: 'added', label: 'Added' },
      { key: 'removed', label: 'Removed' },
    ],
    format: 'compact',
    bars: days(ADDED).map((b, i) => ({ ...b, value: undefined, values: { added: ADDED[i], removed: REMOVED[i] } })),
  };
}

export const doc: ComponentDoc = {
  slug: 'bar-chart',
  name: 'Bar Chart',
  tag: 'ui-bar-chart',
  group: 'Components',
  summary: 'How did it go day by day? — a small time-series bar chart you can read by hover, focus or keyboard.',
  description:
    'One series, or several stacked, over a short run of days. The axis stays quiet — clean 1 / 2 / 2.5 / 5 ticks on dashed hairlines, x labels thinned so they never collide (the first and the latest always show) — and only the bars carry colour, all from tokens. Hover, tap or focus a bar and it stays while the others dim; one tooltip follows it with the day, each series and the total. When the numbers change the bars glide to their new heights; the first paint never animates. Arrow keys walk the bars from a single tab stop; Enter, Space or a click sends a cancelable ui-select. Empty periods say so in the plot; loading shows a pulse of skeleton bars, and a refetch dims the old bars instead of blanking them.',
  usedIn:
    'Dashboard stats › 자세히 › the 세션 and 코드 변경 (머지) charts (B-08), under the stat cards — replaces the div bars, purple hover and English-only empty line.',
  reference: { name: 'W3C WAI — Complex images (charts)', url: 'https://www.w3.org/WAI/tutorials/images/complex/' },
  props: [
    { name: 'data.bars', type: 'BarDatum[]', required: true, description: 'One bar per period, oldest first.' },
    {
      name: 'data.bars[].label',
      type: 'string',
      required: true,
      description: 'Short x label (“Oct 17”, “10/17 (토)”). Thinned to fit; the first and last always show.',
    },
    {
      name: 'data.bars[].title',
      type: 'string',
      description: 'Tooltip heading and the start of the accessible label (“Fri 17 Oct”). Default: label.',
    },
    {
      name: 'data.bars[].key',
      type: 'string',
      description: 'What ui-select carries back; keeps the bar’s node across updates so it glides. Default: label.',
    },
    {
      name: 'data.bars[].value',
      type: 'number | null',
      description:
        'Single series. Missing (undefined / null / NaN) = no data (empty slot, “No data”); negative reads 0.',
    },
    {
      name: 'data.bars[].values',
      type: 'Record<string, number>',
      description: 'Stacked: one value per series key. A missing key reads 0; no finite value at all = no data.',
    },
    {
      name: 'data.series',
      type: 'BarSeries[] — { key, label, color? }',
      description:
        '2+ series stack in this order (first at the baseline) with a legend. One series = a single series with its label (legend and tooltip) and colour. Omitted = one series read from value.',
    },
    {
      name: 'data.series[].color',
      type: "'spark' | 'run' | 'done' | 'wait' | 'fail' | 'purple' | 'orange' | 'muted'",
      description:
        'A token name (never raw CSS). Default palette in order: spark, wait, purple, done, orange, muted — validated as touching pairs in light and dark. Use done / fail for outcome series; label them, red and green alone do not read for everyone.',
    },
    {
      name: 'data.format',
      type: "'int' | 'compact' | 'tokens' | 'usd' | 'duration'",
      default: "'int'",
      description: 'How values read: 1,234 · 12.3K · 12.3K · $4.20 · 9m 22s (duration values in ms). Ticks are short.',
    },
    {
      name: 'data.unit',
      type: 'string',
      description: 'Single-series unit (“sessions”) for the tooltip and each bar’s label: “Fri 17 Oct: 19 sessions”.',
    },
    { name: 'data.title', type: 'string', description: 'Heading; names the chart for screen readers.' },
    {
      name: 'data.empty',
      type: 'string',
      default: '“No data for this period”',
      description: 'Shown in the plot when there are no bars or no bar has a value.',
    },
    {
      name: 'data.loading',
      type: 'boolean',
      default: 'false',
      description: 'Skeleton bars before the first data; with data, the bars dim until the refetch lands. aria-busy.',
    },
    { name: 'data.height', type: 'number', default: '140', description: 'Plot height in px (48–600).' },
    { name: 'data.ticks', type: 'number', default: '3', description: 'Target gridlines above the baseline (1–8).' },
    {
      name: 'data.selected',
      type: 'string | null',
      description:
        'Selection mode. Undefined = read-only (bars still send ui-select). A key marks that bar (an ink tick and its label in ink, aria-current); null = selection on, none marked. In selection mode ui-select moves the mark unless cancelled.',
    },
    {
      name: 'flat',
      type: 'boolean',
      description: 'Attribute: no card chrome, for hosts that already frame the chart.',
    },
    { name: 'lang', type: "'en' | 'ko'", default: "'en'", description: 'UI language (attribute).' },
    {
      name: 'theme',
      type: "'light' | 'dark'",
      description: 'Pins the theme (attribute). Default follows prefers-color-scheme or page tokens.',
    },
  ],
  events: [
    {
      name: 'ui-select',
      detail: '{ key: string; index: number }',
      description:
        'Click, Enter or Space on a bar. key = bar.key ?? bar.label. Cancelable: in selection mode, preventDefault() keeps the old mark.',
    },
  ],
  keyboard: [
    ['Tab', 'Focus the chart — one stop, on the last focused (or selected, or first) bar — and show its tooltip'],
    ['← / →', 'Previous / next bar (mirrored in right-to-left)'],
    ['Home / End', 'First / last bar'],
    ['Enter / Space', 'Send ui-select for the focused bar'],
    ['Esc', 'Hide the tooltip'],
  ],
  a11y: [
    'role="group" named by the title (else “Bar chart” / “막대 차트”) and described by a screen-reader summary: bar count, the highest bar and the total.',
    'Bars are a role="list" of listitems, each holding one button: the list gives “3 of 14”, the button says it can be pressed (ui-select). Each button’s label is the whole reading — “Fri 17 Oct: 19 sessions”, stacked “Tue 27 Oct: 2.3K Added, 1.2K Removed, 3.5K total”, or “No data”.',
    'One tab stop (roving tabindex); arrows, Home and End move it. Keyboard focus shows the same tooltip as hover; a pointer press does not (the pointer already shows one). Esc hides it (WCAG 1.4.13).',
    'The tooltip, axis, x labels and legend are aria-hidden: every value they show is in the bar labels, so nothing is read twice.',
    'Identity is never colour alone: stacked series carry a legend, a 2px gap between segments, and their names in the tooltip and labels. The default palette clears OKLab ΔE 7.5 for every touching pair under protan / deutan simulation in both themes.',
    'Text never wears a series colour — ticks, labels and values use text tokens; selection is an ink tick plus an ink label, not a colour change. Hover changes no colour and moves nothing.',
    'Reduced motion: bars jump to new heights, the skeleton holds still, the tooltip fades without scale or glide.',
  ],
  usage: `<ui-bar-chart lang="en"></ui-bar-chart>
<script type="module">
  import '@2lab.ai/ui/bar-chart';
  const chart = document.querySelector('ui-bar-chart');
  chart.data = {
    title: 'Runs · last 7 days',
    series: [
      { key: 'done', label: 'Done', color: 'done' },
      { key: 'failed', label: 'Failed', color: 'fail' },
    ],
    bars: days.map((d) => ({
      key: d.date, label: d.short, title: d.long,
      values: { done: d.done, failed: d.failed },
    })),
  };
  chart.addEventListener('ui-select', (e) => openDay(e.detail.key));
</script>`,
  demos: [
    {
      id: 'sessions',
      title: 'Sessions',
      description: '14 days, one series. Hover a bar, or Tab in and use the arrow keys.',
      height: 300,
      frame: false,
      create: () => make({ title: 'Sessions · last 14 days', unit: 'sessions', bars: days(SESSIONS) }),
    },
    {
      id: 'stacked',
      title: 'Stacked',
      description:
        'Two series on the default palette, with a legend; the tooltip adds the total. A zero day stays on the baseline.',
      height: 320,
      frame: false,
      create: () => make(stacked()),
    },
    {
      id: 'select',
      title: 'Selection · 30 days',
      description:
        'data.selected turns on selection: a click or Enter moves the ink mark (ui-select is cancelable). Labels thin to fit; the latest day keeps its label.',
      height: 320,
      frame: false,
      create: () =>
        make({
          title: 'Spend · last 30 days',
          format: 'usd',
          ticks: 4,
          bars: days(COST),
          selected: '2026-10-30',
        }),
    },
    {
      id: 'empty-loading',
      title: 'Empty & loading',
      description: 'An empty period says so inside the plot; loading pulses skeleton bars (aria-busy).',
      height: 280,
      frame: false,
      create: () => {
        const wrap = document.createElement('div');
        wrap.style.cssText =
          'display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;width:100%';
        wrap.append(
          make({ title: 'Sessions · today', unit: 'sessions', bars: [] }),
          make({ title: 'Sessions · last 14 days', unit: 'sessions', bars: [], loading: true }),
        );
        return wrap;
      },
    },
    {
      id: 'ko',
      title: '한국어 (lang="ko")',
      description: '세션 · 최근 7일 — 라벨은 “10/30 (금)”, 툴팁 제목은 날짜 전체.',
      height: 300,
      frame: false,
      create: () =>
        make({ title: '세션 · 최근 7일', unit: '세션', bars: days(SESSIONS.slice(-7), 'ko') }, { lang: 'ko' }),
    },
  ],
};
