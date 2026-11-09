import { fmtTokens } from '../../core/format';
import type { ComponentDoc } from '../../docs/types';
import './line-chart';
import type { LineChartData, UiLineChart } from './line-chart';

const DAY = 86_400_000;
/** Demos end on a fixed day (Mon 9 Nov 2026) so they render the same everywhere. */
const END = Date.UTC(2026, 10, 9);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `n` day labels ending on END: “11 Oct” · ko “10/11”. */
function days(n: number, lang: 'en' | 'ko' = 'en'): string[] {
  return Array.from({ length: n }, (_, i) => {
    const at = new Date(END - (n - 1 - i) * DAY);
    return lang === 'ko' ? `${at.getUTCMonth() + 1}/${at.getUTCDate()}` : `${at.getUTCDate()} ${MON[at.getUTCMonth()]}`;
  });
}

/** A deterministic wobble around `base`: two sines, weekends lower by `weekend` (day of week of the period `ago` days back). */
function wave(n: number, base: number, amp: number, seed: number, weekend = 0, ago = 0): number[] {
  return Array.from({ length: n }, (_, i) => {
    const w = new Date(END - (n - 1 - i + ago) * DAY).getUTCDay();
    const noise = Math.sin(i * 1.7 + seed) * 0.6 + Math.sin(i * 0.37 + seed * 2) * 0.4;
    return base + amp * noise - (w === 0 || w === 6 ? weekend : 0);
  });
}

const finite = (xs: Array<number | null>) => xs.filter((v): v is number => typeof v === 'number');
const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / (xs.length || 1);

function make(data: LineChartData, attrs: Record<string, string> = {}, style = ''): UiLineChart {
  const el = document.createElement('ui-line-chart');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (style) el.style.cssText = style;
  el.data = data;
  return el;
}

/** The host's own card head in light DOM — the element has no title of its own (its label is the accessible name). */
function headed(title: string, sub: string, el: HTMLElement): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:14px;width:100%;min-width:0';
  const head = document.createElement('div');
  const h = document.createElement('h3');
  h.style.cssText = 'margin:0;font-size:15px;font-weight:650;line-height:1.3;color:var(--ui-ib-text)';
  h.textContent = title;
  const p = document.createElement('p');
  p.style.cssText = 'margin:3px 0 0;font-size:12.5px;line-height:1.45;color:var(--ui-ib-muted)';
  p.textContent = sub;
  head.append(h, p);
  box.append(head, el);
  return box;
}

/** Tokens per day, last 30 days and the 30 before: weekdays busy, weekends quiet, a launch week in the middle. */
const TOKENS_NOW = wave(30, 1_180_000, 260_000, 1.2, 420_000).map((v, i) =>
  Math.round(i >= 12 && i <= 16 ? v + 380_000 : v),
);
const TOKENS_BEFORE = wave(30, 940_000, 200_000, 4.1, 360_000, 30).map(Math.round);
const BUDGET = 1_500_000;

function tokens(): LineChartData {
  const over = TOKENS_NOW.filter((v) => v > BUDGET).length;
  return {
    label: 'Tokens per day, last 30 days',
    unit: 'tokens',
    labels: days(30),
    yMin: 0,
    series: [
      { id: 'now', label: 'Tokens', values: TOKENS_NOW },
      { id: 'before', label: '30 days before', values: TOKENS_BEFORE },
    ],
    summary: [
      { label: 'Average', value: fmtTokens(avg(TOKENS_NOW)), unit: 'tokens', tone: 'accent' },
      { label: 'Lowest', value: fmtTokens(Math.min(...TOKENS_NOW)), unit: 'tokens' },
      { label: 'Highest', value: fmtTokens(Math.max(...TOKENS_NOW)), unit: 'tokens' },
      { label: 'Over 1.5M budget', value: String(over), unit: 'of 30 days', tone: over ? 'fail' : 'done' },
    ],
  };
}

/** p95 of the agent API in ms: steady inside its usual band, two slow afternoons after a deploy. */
const P95 = wave(30, 172, 26, 2.3).map((v, i) => Math.round(i === 21 ? 262 : i === 22 ? 238 : v));
const P95_BEFORE = wave(30, 188, 22, 5.7, 0, 30).map(Math.round);
const BAND = { min: 120, max: 220 };

function latency(lang: 'en' | 'ko' = 'en'): LineChartData {
  const inside = P95.filter((v) => v >= BAND.min && v <= BAND.max).length;
  const ko = lang === 'ko';
  return {
    label: ko ? 'p95 응답 시간, 최근 30일' : 'p95 response time, last 30 days',
    unit: 'ms',
    labels: days(30, lang),
    band: { ...BAND, label: ko ? '정상 범위' : 'Usual range' },
    series: [
      { id: 'p95', label: 'p95', values: P95, tone: 'run' },
      { id: 'before', label: ko ? '이전 30일' : '30 days before', values: P95_BEFORE },
    ],
    summary: [
      { label: ko ? '오늘' : 'Today', value: String(P95[29]), unit: 'ms', tone: 'accent' },
      { label: ko ? '최저' : 'Best', value: String(Math.min(...P95)), unit: 'ms' },
      { label: ko ? '최고' : 'Worst', value: String(Math.max(...P95)), unit: 'ms', tone: 'fail' },
      { label: ko ? '범위 안' : 'Days in range', value: String(inside), unit: ko ? '/ 30일' : 'of 30', tone: 'done' },
    ],
  };
}

/** Nightly `memory-compact` cron: minutes per run, three nights missed (the runner was down). */
const CRON = wave(21, 4.4, 0.9, 0.6).map((v, i) => (i === 6 || i === 13 || i === 14 ? null : Math.round(v * 10) / 10));

function cron(): LineChartData {
  const ran = finite(CRON);
  const sorted = [...ran].sort((a, b) => a - b);
  return {
    label: 'memory-compact run duration, last 21 nights',
    unit: 'min',
    decimals: 1,
    yMin: 0,
    labels: days(21),
    series: [{ id: 'run', label: 'Run duration', values: CRON, style: 'line', tone: 'done' }],
    summary: [
      { label: 'Median', value: sorted[Math.floor(sorted.length / 2)].toFixed(1), unit: 'min' },
      { label: 'Slowest', value: Math.max(...ran).toFixed(1), unit: 'min' },
      { label: 'Missed runs', value: String(CRON.length - ran.length), unit: 'of 21', tone: 'fail' },
    ],
    empty: 'No runs yet',
  };
}

/** Spend per day (USD), 14 days. */
const SPEND = [3.1, 4.6, 5.9, 6.4, 5.2, 1.6, 0.9, 5.4, 7.2, 6.8, 6.1, 5.5, 1.4, 0.7];

export const doc: ComponentDoc = {
  slug: 'line-chart',
  name: 'Line Chart',
  tag: 'ui-line-chart',
  group: 'Components',
  summary: 'How did this number move — and is that normal? A time series against a previous period and a usual band.',
  description:
    'One number over N points — tokens per day, p95 latency, a cron job’s run time, spend. The current period is a smooth line with a soft area under it; a previous period is a dashed line; an optional band marks the usual range; a row of figures (average, lowest, highest, days in range) sits on top. The curve is a monotone cubic, so it never swings above a peak or below a valley the data does not have, and a missing value (null) breaks the line instead of inventing one. The SVG stretches to any width with non-scaling strokes; ticks and dates are HTML placed by percent, so text never stretches, and below 480px the dates thin by a container query. Hover, tap or the arrow keys move a crosshair with a dot per series and a tooltip; the keyboard’s point is also read out. A click, Enter or Space sends a cancelable ui-select.',
  usedIn:
    'Fits the soma-work dashboard stats page (자세히): token spend per day against the 30 days before, the agent API’s p95 against its usual range, and a cron job’s run durations in the cron panel — not wired yet.',
  reference: {
    name: 'Halvi (Code and Chill) — pattern studied, no code used',
    url: 'https://demo.codeandchill.store/halvi/',
  },
  props: [
    {
      name: 'data.labels',
      type: 'string[]',
      required: true,
      description: 'X labels, one per point, oldest first (“13 Oct”). About 10 show; under 480px wide, half of those.',
    },
    {
      name: 'data.series',
      type: 'LineSeries[] — { id, label, values, style?, tone? }',
      required: true,
      description:
        'The lines. values: one number per label; null (or anything not a finite number) is a gap. id keeps the nodes across updates, label names it in the legend, tooltip and spoken text.',
    },
    {
      name: 'data.series[].style',
      type: "'area' | 'line' | 'dashed'",
      default: "first 'area', others 'dashed'",
      description: 'A line with a soft fill under it, a plain line, or a dashed line (a previous period).',
    },
    {
      name: 'data.series[].tone',
      type: "'accent' | 'run' | 'done' | 'wait' | 'fail' | 'muted'",
      default: 'accent, then muted, wait, done, run',
      description: 'A token name, never raw CSS. In mono the hues fall to ink; the line styles keep series apart.',
    },
    { name: 'data.label', type: 'string', description: 'The plot’s accessible name (“Tokens per day”).' },
    {
      name: 'data.unit',
      type: 'string',
      description: 'The values’ unit — tooltip, band legend and spoken values (“184 ms”).',
    },
    {
      name: 'data.band',
      type: '{ min, max, label? }',
      description:
        'A soft horizontal band for the normal range; the legend reads “<label> <min>–<max> <unit>” (label default “Usual range” / “정상 범위”).',
    },
    {
      name: 'data.summary',
      type: "Array<{ label, value, unit?, tone?: 'accent' | 'done' | 'fail' }>",
      description: 'The figures row over the chart, values as the host writes them (“1.2M”, “26 of 30”).',
    },
    {
      name: 'data.yMin / data.yMax',
      type: 'number',
      description:
        'The axis reaches at least this far (yMin: 0 starts it at zero). It never cuts data off: the band and every value stay inside.',
    },
    {
      name: 'data.ticks',
      type: 'number',
      default: '4',
      description: 'About how many y steps (1–10): 1 / 2 / 2.5 / 5 × 10ⁿ.',
    },
    {
      name: 'data.decimals',
      type: 'number',
      description: 'Fixed decimals for tooltip and spoken values (0–6). Default: whole numbers as is, others up to 2.',
    },
    { name: 'data.empty', type: 'string', default: '“No data yet”', description: 'Shown when no value is finite.' },
    { name: 'lang', type: "'en' | 'ko'", default: "'en'", description: 'UI language (attribute).' },
    { name: '--line-chart-h', type: 'CSS length', default: '220px', description: 'The plot height.' },
    {
      name: 'activeIndex',
      type: 'number (read-only)',
      description: 'The point under the crosshair (hovered, tapped or reached by keyboard); -1 when none.',
    },
    {
      name: 'monotonePath / monotoneArea / niceTicks / xLabelLevels',
      type: 'helpers',
      description: 'Pure: the smooth path (gaps break it), the area under it, the nice y axis and which x labels show.',
    },
  ],
  events: [
    {
      name: 'ui-select',
      detail: '{ index: number; label: string }',
      description: 'Click, Enter or Space on the active point (bubbling, composed, cancelable).',
    },
  ],
  keyboard: [
    ['Tab', 'Focus the plot (one stop)'],
    ['→ / ←', 'Next / previous point — the first press starts at the first (→) or the latest (←) point'],
    ['Home / End', 'First / latest point'],
    ['Enter / Space', 'Send ui-select for the active point'],
    ['Esc', 'Hide the crosshair and tooltip'],
  ],
  a11y: [
    'The plot is one focusable role="group" named by data.label (else “Line chart” / “꺾은선 차트”) and described by a summary — the point count and date range, each series’ low, high and latest, the band — and a hint for the arrow keys.',
    'Arrow keys, Home and End move the active point; each move is spoken through a polite live region: “13 Oct: Tokens 1,204,000 tokens, 30 days before 980,000 tokens” (a gap says “no data”).',
    'The tooltip, axes, dates and legend are aria-hidden: what they show is in the description and the spoken point, so nothing is read twice. The figures row is plain text in a <dl>.',
    'Series never differ by colour alone: solid vs dashed lines, filled vs hollow dots, legend swatches in the line’s own style. In mono the tones fall to ink and the styles still tell them apart.',
    'Text never wears a series colour: ticks, dates and values use text tokens; a summary figure’s tone is mixed toward ink (70% × chroma) so it keeps contrast.',
    'Esc hides the tooltip (WCAG 1.4.13). Reduced motion: paths jump to new values, the tooltip fades without scale or glide.',
  ],
  usage: `<ui-line-chart lang="en"></ui-line-chart>
<script type="module">
  import '@2lab.ai/ui/line-chart';
  const chart = document.querySelector('ui-line-chart');
  chart.data = {
    label: 'p95 response time, last 30 days',
    unit: 'ms',
    labels: days.map((d) => d.short),
    band: { min: 120, max: 220 },
    series: [
      { id: 'p95', label: 'p95', values: days.map((d) => d.p95), tone: 'run' },
      { id: 'before', label: '30 days before', values: before },   // dashed by default
    ],
    summary: [{ label: 'Today', value: '184', unit: 'ms', tone: 'accent' }],
  };
  chart.addEventListener('ui-select', (e) => openDay(e.detail.index));
</script>`,
  demos: [
    {
      id: 'tokens',
      title: 'Tokens per day — last 30 days vs the 30 before',
      description:
        'The current period as an area, the previous as a dashed line, the axis from zero. Hover, or Tab in and use the arrow keys.',
      height: 480,
      create: () =>
        headed(
          'Token spend',
          'Every model call the agents made, per day. A launch week in the middle pushed three days over budget.',
          make(tokens()),
        ),
    },
    {
      id: 'latency',
      title: 'p95 response time with a normal band',
      description:
        'band marks the usual range (120–220 ms); two slow days after a deploy leave it. The figures row carries tones: accent, done, fail.',
      height: 480,
      create: () => headed('Agent API latency', 'p95 per day across all sessions. Lower is better.', make(latency())),
    },
    {
      id: 'cron',
      title: 'Cron run duration (gaps on missed runs)',
      description:
        'A plain line in the done tone. null values break the line where the runner was down; the tooltip says “no data” there.',
      height: 460,
      create: () =>
        headed(
          'memory-compact · nightly 03:00',
          'Minutes per run. Three nights were missed while the runner was down.',
          make(cron()),
        ),
    },
    {
      id: 'compact',
      title: 'Compact',
      description:
        '--line-chart-h: 96px, two ticks, no figures, in a narrow box: under 480px the dates thin by a container query.',
      height: 260,
      create: () =>
        headed(
          'Spend · last 14 days',
          'USD per day.',
          make(
            {
              label: 'Spend per day, last 14 days',
              unit: 'USD',
              decimals: 2,
              ticks: 2,
              yMin: 0,
              labels: days(14),
              series: [{ id: 'usd', label: 'Spend', values: SPEND, style: 'line' }],
            },
            {},
            '--line-chart-h: 96px; max-width: 360px',
          ),
        ),
    },
    {
      id: 'ko',
      title: 'Korean',
      description: 'lang="ko" — the band’s default name, the spoken points and the empty state are Korean.',
      height: 480,
      create: () =>
        headed(
          '에이전트 API 지연 시간',
          '모든 세션의 일별 p95. 낮을수록 좋습니다.',
          make(latency('ko'), { lang: 'ko' }),
        ),
    },
    {
      id: 'empty',
      title: 'Empty',
      description: 'No finite value yet: the plot says so, with no axis or legend.',
      height: 300,
      create: () => make({ labels: days(7), series: [{ id: 'x', label: 'Tokens', values: [null, null] }] }),
    },
  ],
};
