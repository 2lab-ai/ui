import type { ComponentDoc } from '../../docs/types';
import './stat-strip';
import type { StatMetric, StatPeriodChange, StatStripData, UiStatStrip } from './stat-strip';

function make(data: StatStripData, attrs: Record<string, string> = {}, panel?: HTMLElement): UiStatStrip {
  const el = document.createElement('ui-stat-strip');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (panel) el.append(panel);
  el.data = data;
  return el;
}

/** A kit definition list (`.ui-dl`) for the More region; textContent only. */
function facts(rows: Array<[string, string]>): HTMLElement {
  const dl = document.createElement('dl');
  dl.className = 'ui-dl';
  for (const [k, v] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    dl.append(dt, dd);
  }
  return dl;
}

function stack(...els: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;align-items:stretch;gap:18px;width:100%';
  box.append(...els);
  return box;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ui-btn is-sm';
  b.style.alignSelf = 'flex-start';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

interface Figures {
  sessions: number;
  tokens: number;
  env: [dev: number, staging: number, prod: number];
  cost: number;
  turns: number;
  opened: number;
  merged: number;
  lines: number;
}

const FIGURES: Record<string, Figures> = {
  today: {
    sessions: 14,
    tokens: 612_400,
    env: [148_200, 61_900, 402_300],
    cost: 5.84,
    turns: 236,
    opened: 3,
    merged: 2,
    lines: 418,
  },
  '7d': {
    sessions: 128,
    tokens: 4_630_000,
    env: [1_210_000, 420_000, 3_000_000],
    cost: 38.2,
    turns: 1_942,
    opened: 23,
    merged: 19,
    lines: 8_410,
  },
  '30d': {
    sessions: 517,
    tokens: 19_840_000,
    env: [5_120_000, 1_880_000, 12_840_000],
    cost: 163.75,
    turns: 8_166,
    opened: 96,
    merged: 81,
    lines: 37_905,
  },
};

const EN = {
  options: [
    { value: 'today', label: 'Today' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
  ],
  sessions: 'Sessions',
  tokens: 'Tokens',
  cost: 'Cost',
  byEnv: 'Tokens by environment',
  costHint: 'Estimated from list prices',
  details: (f: Figures): Array<[string, string]> => [
    ['Turns', f.turns.toLocaleString('en-US')],
    ['Pull requests opened', String(f.opened)],
    ['Pull requests merged', String(f.merged)],
    ['Lines merged', f.lines.toLocaleString('en-US')],
  ],
};

const KO: typeof EN = {
  options: [
    { value: 'today', label: '오늘' },
    { value: '7d', label: '지난 7일' },
    { value: '30d', label: '지난 30일' },
  ],
  sessions: '세션',
  tokens: '토큰',
  cost: '비용',
  byEnv: '환경별 토큰',
  costHint: '정가 기준 추정치',
  details: (f: Figures): Array<[string, string]> => [
    ['턴 사용', f.turns.toLocaleString('en-US')],
    ['PR 생성', String(f.opened)],
    ['PR 머지', String(f.merged)],
    ['머지 코드', `${f.lines.toLocaleString('en-US')}줄`],
  ],
};

function metrics(f: Figures, s: typeof EN): StatMetric[] {
  return [
    { key: 'sessions', label: s.sessions, value: f.sessions },
    {
      key: 'tokens',
      label: s.tokens,
      value: f.tokens,
      format: 'tokens',
      breakdown: {
        title: s.byEnv,
        rows: [
          { label: 'dev', value: f.env[0] },
          { label: 'staging', value: f.env[1] },
          { label: 'prod', value: f.env[2] },
        ],
      },
    },
    { key: 'cost', label: s.cost, value: f.cost, format: 'usd', hint: s.costHint },
  ];
}

/** A strip whose period control swaps the figures (they roll) and the More panel's lines. */
function usage(s: typeof EN, attrs: Record<string, string> = {}): HTMLElement {
  const panel = document.createElement('div');
  const fill = (key: string) => panel.replaceChildren(facts(s.details(FIGURES[key])));
  fill('7d');
  const el = make(
    { period: { options: s.options, value: '7d' }, metrics: metrics(FIGURES['7d'], s), more: true },
    attrs,
    panel,
  );
  el.addEventListener('ui-period', (e) => {
    const { value } = (e as CustomEvent<StatPeriodChange>).detail;
    const f = FIGURES[value];
    if (!f || !el.data) return;
    el.data = { ...el.data, period: { ...el.data.period!, value }, metrics: metrics(f, s) };
    fill(value);
  });
  return el;
}

function rolling(): HTMLElement {
  const sets = [
    { sessions: 128, tokens: 4_630_000, cost: 38.2, done: 91.4, median: 562_000 },
    { sessions: 141, tokens: 5_120_000, cost: 42.65, done: 93.8, median: 498_000 },
    { sessions: 96, tokens: 3_270_000, cost: 27.1, done: 88.2, median: 731_000 },
  ];
  let at = 0;
  const data = (i: number): StatStripData => ({
    label: 'Weekly usage',
    metrics: [
      { key: 'sessions', label: 'Sessions', value: sets[i].sessions },
      { key: 'tokens', label: 'Tokens', value: sets[i].tokens, format: 'tokens' },
      { key: 'cost', label: 'Cost', value: sets[i].cost, format: 'usd' },
      { key: 'done', label: 'Finished', value: sets[i].done, format: 'percent' },
      { key: 'median', label: 'Median run', value: sets[i].median, format: 'duration' },
    ],
  });
  const el = make(data(0));
  return stack(
    el,
    button('Next period', () => {
      at = (at + 1) % sets.length;
      el.data = data(at);
    }),
  );
}

/** A period switch that loads: the bar hides each figure, and the answer rolls from what it showed (`from: 'last'`). */
function loadingPeriod(): HTMLElement {
  const figs = (f: Figures): StatMetric[] => metrics(f, EN).map((m) => ({ ...m, from: 'last' as const }));
  const el = make({ period: { options: EN.options, value: '7d' }, metrics: figs(FIGURES['7d']) });
  let timer: ReturnType<typeof setTimeout> | undefined;
  el.addEventListener('ui-period', (e) => {
    const { value } = (e as CustomEvent<StatPeriodChange>).detail;
    const f = FIGURES[value];
    if (!f || !el.data) return;
    clearTimeout(timer);
    // The host's whole job: loading meanwhile, then the answer — no old → new trick.
    el.data = { ...el.data, period: { ...el.data.period!, value }, loading: true };
    timer = setTimeout(() => {
      if (el.data) el.data = { ...el.data, loading: false, metrics: figs(f) };
    }, 700);
  });
  return el;
}

function loading(): HTMLElement {
  const loaded: StatStripData = {
    period: { options: EN.options, value: 'today' },
    metrics: [
      { key: 'sessions', label: 'Sessions', value: 14 },
      { key: 'tokens', label: 'Tokens', value: 612_400, format: 'tokens' },
      { key: 'cost', label: 'Cost', value: 5.84, format: 'usd' },
    ],
  };
  const a = make({ ...loaded, loading: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const b = make({
    metrics: [
      { key: 'sessions', label: 'Sessions', value: 0 },
      { key: 'tokens', label: 'Tokens', loading: true, format: 'tokens' },
      { key: 'cost', label: 'Cost', value: null, format: 'usd', hint: 'Cost is not reported for this source' },
    ],
  });
  return stack(
    a,
    button('Reload', () => {
      clearTimeout(timer);
      a.data = { ...loaded, loading: true };
      timer = setTimeout(() => {
        a.data = loaded;
      }, 900);
    }),
    b,
  );
}

export const doc: ComponentDoc = {
  slug: 'stat-strip',
  name: 'Stat Strip',
  tag: 'ui-stat-strip',
  group: 'Components',
  summary: 'How much happened in this period? — the period, a few rolling figures and their breakdowns on one line.',
  description:
    'A period control (a small `<ui-segmented>`), label · figure pairs on one baseline, and a quiet More toggle at the end. When a figure’s value changes it rolls to the new one in 620 ms (ease-out quart) — first paint, a first value, a change of format and reduced motion jump. A figure with a breakdown (or a hint) is a button with a card tooltip: hover or focus shows it, a press toggles it, so it works on touch too. More opens the host’s own detail (the default slot) below the line. Loading figures pulse as skeleton bars; no data is “—”.',
  usedIn: 'soma-work dashboard › stats strip above the board — 기간 · 세션 · 토큰 (환경별 툴팁) · 비용 · 자세히',
  reference: { name: 'WAI-ARIA APG Disclosure', url: 'https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/' },
  props: [
    {
      name: 'data.metrics',
      type: 'StatMetric[]',
      required: true,
      description: 'The figures, in order. Each needs a unique `key`: a new value under the same key rolls.',
    },
    { name: 'data.metrics[].key', type: 'string', required: true, description: 'Stable id of the figure.' },
    { name: 'data.metrics[].label', type: 'string', required: true, description: 'Short sentence-case label.' },
    {
      name: 'data.metrics[].value',
      type: 'number | null',
      description: 'The figure. `null`, missing or not a finite number = no data (“—”, read as “No data”).',
    },
    {
      name: 'data.metrics[].format',
      type: "'int' | 'compact' | 'tokens' | 'usd' | 'percent' | 'duration'",
      default: "'int'",
      description:
        'int 1,234 · compact 12.3K / 1.2B · tokens 4.6M · usd $1,234.50 · percent (0–100) 42% / 7.5% · duration (ms) 9m 22s / 9분 22초.',
    },
    { name: 'data.metrics[].loading', type: 'boolean', description: 'A skeleton bar for this figure only.' },
    {
      name: 'data.metrics[].from',
      type: "number | 'last'",
      description:
        "Where the figure rolls from when it lands a value with none on screen — first paint, or after loading / no data. 'last': the value it showed before its loading bar (kept under the bar, mid-roll included), so a period switch that loads rolls from the old period. A number: a known start. Without it such a value appears at once. A figure already showing a value always rolls on from it; reduced motion and a change of format jump.",
    },
    {
      name: 'data.metrics[].breakdown',
      type: '{ title?: string; rows: Array<{ label: string; value: number | null; format?: MetricFormat }> }',
      description:
        'Makes the figure a button with a card tooltip: the title and a label · value list. Rows use the metric’s format unless they set their own.',
    },
    {
      name: 'data.metrics[].hint',
      type: 'string',
      description: 'Plain tooltip text for the figure when there is no breakdown.',
    },
    {
      name: 'data.period',
      type: '{ options: Array<{ value: string; label: string; disabled?: boolean }>; value?: string; label?: string }',
      description:
        'The period control at the start of the line. `label` is its accessible name (default “Period” / “기간”). Left out = no control.',
    },
    { name: 'data.loading', type: 'boolean', default: 'false', description: 'Every figure shows a skeleton.' },
    {
      name: 'data.more',
      type: 'boolean | { label?: string; open?: boolean }',
      description:
        'Shows the More toggle (“More” / “자세히”); its region holds the default slot. `open` sets the region without an event when it changes.',
    },
    {
      name: 'data.label',
      type: 'string',
      default: '"Usage"',
      description: 'Accessible name of the strip (“사용량” in Korean).',
    },
    {
      name: 'open',
      type: 'boolean',
      default: 'false',
      description: 'Attribute / property: the More region is open. Setting it sends no event.',
    },
    { name: 'lang', type: "'en' | 'ko'", default: "'en'", description: 'UI language (attribute).' },
    {
      name: 'theme',
      type: "'light' | 'dark'",
      description: 'Pins the theme (attribute); passed on to the inner segmented control and tooltips.',
    },
    {
      name: 'toggle()',
      type: 'method',
      description: 'Same as pressing More: sends `ui-more`, then toggles unless cancelled.',
    },
  ],
  events: [
    {
      name: 'ui-period',
      detail: '{ value: string; previous: string | undefined }',
      description:
        "A period was chosen. Cancelable: preventDefault() keeps the old period; otherwise the control shows the new one right away — load its figures (set `loading` meanwhile; with `from: 'last'` the answer rolls from the old figures). The inner `ui-change` never leaves the element.",
    },
    {
      name: 'ui-more',
      detail: '{ open: boolean }',
      description: 'More was pressed; `open` is the state asked for. Cancelable: preventDefault() keeps it as it is.',
    },
  ],
  keyboard: [
    ['Tab', 'Period control → figures with a breakdown → More'],
    ['← → ↑ ↓ / Home / End', 'Choose a period (inside the period control)'],
    ['Enter / Space on a figure', 'Show or hide its breakdown (keyboard focus shows it already)'],
    ['Esc', 'Hide a breakdown'],
    ['Enter / Space on More', 'Open or close the region'],
  ],
  a11y: [
    'role="group" named by data.label (default “Usage”); the figures are a definition list (label → figure).',
    'A rolling figure is aria-hidden; a screen-reader copy holds the final value, so nobody hears a number mid-roll.',
    'Loading sets aria-busy on the strip and reads “Loading” per figure; no data reads “No data” instead of the dash.',
    'A breakdown is a non-interactive tooltip: the figure button is described by it (aria-describedby). Hover after 500 ms, keyboard focus at once, a press toggles it (touch too); Esc or a press elsewhere hides it.',
    'More is a button with aria-expanded and aria-controls; the closed region is inert, so nothing inside takes focus.',
    'Every control is ≥ 44px tall on coarse pointers (figures through a larger hit area, so the line stays one line); More is 44px on phone-width windows too.',
    'Reduced motion: figures jump instead of rolling, the region and chevron do not animate, skeletons stop pulsing.',
  ],
  usage: `<ui-stat-strip lang="en">
  <!-- optional: shown under the strip when More is open -->
  <dl class="ui-dl"><dt>Turns</dt><dd>1,942</dd><dt>Pull requests merged</dt><dd>19</dd></dl>
</ui-stat-strip>
<script type="module">
  import '@2lab.ai/ui/stat-strip';
  const el = document.querySelector('ui-stat-strip');
  const period = {
    value: '7d',
    options: [
      { value: 'today', label: 'Today' },
      { value: '7d', label: 'Last 7 days' },
      { value: '30d', label: 'Last 30 days' },
    ],
  };
  el.data = { period, loading: true, more: true, metrics: [
    { key: 'sessions', label: 'Sessions' },
    { key: 'tokens', label: 'Tokens', format: 'tokens' },
    { key: 'cost', label: 'Cost', format: 'usd' },
  ] };
  async function load(value) {
    const s = await (await fetch('/usage?period=' + value)).json();
    // from: 'last' — each answer rolls from the figure the loading bar hid.
    el.data = { ...el.data, loading: false, metrics: [
      { key: 'sessions', label: 'Sessions', value: s.sessions, from: 'last' },
      { key: 'tokens', label: 'Tokens', value: s.tokens, format: 'tokens', from: 'last',
        breakdown: { title: 'Tokens by environment', rows: s.byEnv } },
      { key: 'cost', label: 'Cost', value: s.cost, format: 'usd', from: 'last' },
    ] };
  }
  el.addEventListener('ui-period', (e) => {
    el.data = { ...el.data, loading: true, period: { ...period, value: e.detail.value } };
    load(e.detail.value);
  });
  load(period.value);
</script>`,
  demos: [
    {
      id: 'usage',
      title: 'Usage',
      description:
        'Pick a period: the figures roll to it. Hover or tap the tokens for the breakdown by environment; More opens the detail.',
      height: 320,
      create: () => usage(EN),
    },
    {
      id: 'rolling',
      title: 'Rolling figures',
      description:
        'Each figure rolls from what it shows to the new value in 620 ms, ease-out quart — count, tokens, cost, percent and duration.',
      height: 220,
      create: () => rolling(),
    },
    {
      id: 'loading-period',
      title: 'A period that loads',
      description:
        "Pick a period: the host sets loading, then hands over the answer 700 ms later. With from: 'last' the bar keeps each figure's value underneath and the answer rolls from it — the host needs no old → new trick.",
      height: 200,
      create: () => loadingPeriod(),
    },
    {
      id: 'loading',
      title: 'Loading & no data',
      description:
        'loading: true pulses a bar where each figure will be (labels stay); Reload shows the values arriving — they jump, no roll from zero. Below: one figure still loading, one with no data (null → “—”).',
      height: 280,
      create: () => loading(),
    },
    {
      id: 'ko',
      title: '한국어',
      description: '기간 · 세션 · 토큰 (환경별 내역) · 비용 · 자세히 — lang="ko".',
      height: 320,
      create: () => usage(KO, { lang: 'ko' }),
    },
  ],
};
