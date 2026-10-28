import type { ComponentDoc } from '../../docs/types';
import './compact-breakdown';
import type { CompactBreakdownChangeDetail } from './compact-breakdown';
import type { BreakdownPart, CompactBreakdownData } from './logic';

type El = HTMLElementTagNameMap['ui-compact-breakdown'];

function breakdown(data: CompactBreakdownData, attrs: Record<string, string> = {}): El {
  const el = document.createElement('ui-compact-breakdown');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

function onChange(el: El, fn: (value: string) => void): void {
  el.addEventListener('ui-change', (e) => fn((e as CustomEvent<CompactBreakdownChangeDetail>).detail.value));
}

/** Centres one card (360px wide at most) or lays several out side by side. */
function stage(...els: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText =
    els.length > 1
      ? 'display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));align-items:start'
      : 'display:grid;justify-items:center';
  for (const el of els) el.style.width = '100%';
  box.append(...els);
  return box;
}

/** The demo moves on by itself (like a live dashboard switching period) until someone touches it. */
function autoCycle(el: El, ids: string[], every: number, apply: (id: string) => void): void {
  let touched = false;
  const stop = () => (touched = true);
  for (const ev of ['pointerenter', 'pointerdown', 'keydown', 'focusin'])
    el.addEventListener(ev, stop, { capture: true });
  const timer = window.setInterval(() => {
    if (!el.isConnected) return window.clearInterval(timer);
    if (touched) return;
    const i = ids.indexOf(el.value ?? ids[0]);
    apply(ids[(i + 1) % ids.length]);
  }, every);
}

// soma-work model ids, cost (USD) and tokens (input + output) per period, as /api/dashboard/usage reports them in
// UsageReport.totals.byModel.
const SPEND: Record<'day' | 'week' | 'month', BreakdownPart[]> = {
  day: [
    { key: 'claude-opus-5-5[1m]', label: 'claude-opus-5-5[1m]', value: 38.42 },
    { key: 'claude-fable-5[1m]', label: 'claude-fable-5[1m]', value: 21.17 },
    { key: 'claude-sonnet-4-6', label: 'claude-sonnet-4-6', value: 6.83 },
    { key: 'claude-opus-4-7', label: 'claude-opus-4-7', value: 3.12 },
    { key: 'claude-haiku-4-20250414', label: 'claude-haiku-4-20250414', value: 0.41 },
  ],
  week: [
    { key: 'claude-opus-5-5[1m]', label: 'claude-opus-5-5[1m]', value: 214.6 },
    { key: 'claude-opus-4-7', label: 'claude-opus-4-7', value: 96.35 },
    { key: 'claude-fable-5[1m]', label: 'claude-fable-5[1m]', value: 88.12 },
    { key: 'claude-sonnet-4-6', label: 'claude-sonnet-4-6', value: 31.7 },
    { key: 'claude-haiku-4-20250414', label: 'claude-haiku-4-20250414', value: 2.94 },
  ],
  month: [
    { key: 'claude-opus-4-7', label: 'claude-opus-4-7', value: 611.8 },
    { key: 'claude-opus-5-5[1m]', label: 'claude-opus-5-5[1m]', value: 548.25 },
    { key: 'claude-fable-5[1m]', label: 'claude-fable-5[1m]', value: 302.44 },
    { key: 'claude-sonnet-4-6', label: 'claude-sonnet-4-6', value: 140.08 },
    { key: 'claude-opus-4-8[1m]', label: 'claude-opus-4-8[1m]', value: 77.9 },
    { key: 'claude-opus-4-6', label: 'claude-opus-4-6', value: 41.36 },
    { key: 'claude-haiku-4-20250414', label: 'claude-haiku-4-20250414', value: 9.12 },
  ],
};

const TOKENS_MONTH: BreakdownPart[] = [
  { key: 'claude-opus-4-7', label: 'claude-opus-4-7', value: 21_480_310 },
  { key: 'claude-opus-5-5[1m]', label: 'claude-opus-5-5[1m]', value: 17_902_544 },
  { key: 'claude-fable-5[1m]', label: 'claude-fable-5[1m]', value: 12_310_877 },
  { key: 'claude-sonnet-4-6', label: 'claude-sonnet-4-6', value: 30_118_402 },
  { key: 'claude-opus-4-8[1m]', label: 'claude-opus-4-8[1m]', value: 2_604_115 },
  { key: 'claude-opus-4-6', label: 'claude-opus-4-6', value: 1_377_090 },
  { key: 'claude-haiku-4-20250414', label: 'claude-haiku-4-20250414', value: 4_920_366 },
];

const PERIODS = [
  { id: 'day', label: 'Today' },
  { id: 'week', label: 'Last 7 days' },
  { id: 'month', label: 'Last 30 days' },
];
const PERIODS_KO = [
  { id: 'day', label: '오늘' },
  { id: 'week', label: '지난 7일' },
  { id: 'month', label: '지난 30일' },
];
const SPENT: Record<string, string> = {
  day: 'Spent today',
  week: 'Spent in the last 7 days',
  month: 'Spent in the last 30 days',
};
const SPENT_KO: Record<string, string> = { day: '오늘 비용', week: '지난 7일 비용', month: '지난 30일 비용' };

function spendByModel(): HTMLElement {
  const el = breakdown({
    title: 'Spend by model',
    unit: 'usd',
    parts: SPEND.week,
    options: PERIODS,
    value: 'week',
    totalLabel: SPENT.week,
  });
  const show = (id: string) => {
    const p = id as keyof typeof SPEND;
    el.data = { ...el.data!, value: p, parts: SPEND[p], totalLabel: SPENT[p] };
  };
  onChange(el, show);
  autoCycle(el, ['day', 'week', 'month'], 2800, show);
  return stage(el);
}

function metricSwitch(): HTMLElement {
  const metric = {
    cost: { unit: 'usd' as const, parts: SPEND.month, totalLabel: 'Spend' },
    tokens: { unit: 'tokens' as const, parts: TOKENS_MONTH, totalLabel: 'Tokens (input + output)' },
  };
  const el = breakdown({
    title: 'Last 30 days by model',
    ...metric.cost,
    options: [
      { id: 'cost', label: 'Cost' },
      { id: 'tokens', label: 'Tokens' },
    ],
    optionsLabel: 'Measure',
    value: 'cost',
  });
  onChange(el, (value) => {
    const m = value === 'tokens' ? metric.tokens : metric.cost;
    el.data = { ...el.data!, ...m, value };
  });
  return stage(el);
}

// UsageReport.byUser (admin view): seven people, the smallest three fold into Other.
const USERS: BreakdownPart[] = [
  { key: 'U094E5L4A15', label: 'Zhuge', value: 182.4 },
  { key: 'U07QX2B9KLM', label: 'Icedac', value: 96.15 },
  { key: 'U08AA3MZT2P', label: 'Sora Lee', value: 61.03 },
  { key: 'U08FH7RNE1C', label: 'Minho Park', value: 44.8 },
  { key: 'U090K2DD4WQ', label: 'Jiyoung Choi', value: 23.6 },
  { key: 'U091LQ0PZ8E', label: 'Hyunwoo Jang', value: 9.92 },
  { key: 'U092MM8YX0B', label: 'Dongjin Kim', value: 4.37 },
];

function byUser(): HTMLElement {
  return stage(
    breakdown({
      title: 'Spend by user',
      unit: 'usd',
      parts: USERS,
      maxRows: 5,
      totalLabel: 'All users · last 7 days',
    }),
  );
}

// /api/dashboard/stats totals.workflowCounts — counts, with the host's own colours (dashboard tokens).
function workflows(): HTMLElement {
  return stage(
    breakdown({
      title: 'Sessions by workflow',
      unit: 'count',
      parts: [
        { key: 'default', label: 'default', value: 48, color: 'var(--st-run)' },
        { key: 'pr-review', label: 'pr-review', value: 21, color: 'var(--purple)' },
        { key: 'jira-create-pr', label: 'jira-create-pr', value: 12, color: 'var(--st-done)' },
        { key: 'deploy', label: 'deploy', value: 7, color: 'var(--st-wait)' },
        { key: 'onboarding', label: 'onboarding', value: 3, color: 'var(--text-tertiary)' },
      ],
      totalLabel: 'Sessions today',
      footer: '91 sessions across 5 workflows',
    }),
  );
}

function states(): HTMLElement {
  const loading = breakdown({ title: 'Spend by model', unit: 'usd', parts: [], loading: true, totalLabel: SPENT.day });
  window.setTimeout(() => {
    if (loading.isConnected) loading.data = { ...loading.data!, loading: false, parts: SPEND.day };
  }, 1400);
  const empty = breakdown({ title: 'Tokens by model', unit: 'tokens', parts: [], totalLabel: 'Tokens today' });
  const failed = breakdown({
    title: 'Spend by model',
    unit: 'usd',
    parts: [],
    error: 'Couldn’t load usage (HTTP 502).',
    options: PERIODS,
    value: 'month',
  });
  return stage(loading, empty, failed);
}

function flat(): HTMLElement {
  return breakdown(
    {
      title: 'Tokens by model',
      unit: 'tokens',
      parts: TOKENS_MONTH,
      maxRows: 4,
      totalLabel: 'Last 30 days · input + output',
    },
    { flat: '' },
  );
}

function korean(): HTMLElement {
  const el = breakdown(
    {
      title: '모델별 비용',
      unit: 'usd',
      parts: SPEND.week,
      options: PERIODS_KO,
      value: 'week',
      totalLabel: SPENT_KO.week,
    },
    { lang: 'ko' },
  );
  onChange(el, (value) => {
    const p = value as keyof typeof SPEND;
    el.data = { ...el.data!, value: p, parts: SPEND[p], totalLabel: SPENT_KO[p] };
  });
  return stage(el);
}

export const doc: ComponentDoc = {
  slug: 'compact-breakdown',
  name: 'Compact Breakdown',
  tag: 'ui-compact-breakdown',
  group: 'Components',
  summary: 'One number and what it is made of — where the money and the tokens go.',
  description:
    'A total split into its parts in one small card: the total as a big rolling number, a segmented bar and ranked rows with value and share. When the numbers change every value rolls in one shared tween, the bar’s segments keep their place and colour and glide to the new widths, and rows slide to their new rank; a part that is gone folds away. Hover or focus a row and its segment lifts while the others dim and the big number rolls to that part — hover a segment and its row lights. The smallest parts fold into Other past maxRows. A period or metric switch in the header belongs to the host: options + value in, ui-change out.',
  usedIn:
    'soma-work dashboard — the stats strip (#stat-tokens / #stat-cost, paintUsage): spend and tokens by model from UsageReport.totals.byModel, and by user (byUser) for admins, next to the strip’s period switch',
  reference: { name: 'affectUI Compact Breakdown', url: 'https://www.affectui.com/components/compact-breakdown' },
  props: [
    {
      name: 'data.title',
      type: 'string',
      required: true,
      description: 'Card heading; it names the group for screen readers.',
    },
    {
      name: 'data.parts',
      type: 'Array<{ key: string; label: string; value: number; color?: string }>',
      required: true,
      description:
        'The parts of the shown total, raw numbers. Ranked by value (ties keep your order); value 0 leaves a part out. Keep the same key across updates — that is what lets a row and its segment move instead of being replaced.',
    },
    {
      name: 'data.unit',
      type: "'usd' | 'tokens' | 'count'",
      default: "'count'",
      description:
        'How every number is written: $412.30 (fmtUsd) · 12.3M (fmtTokens) · 1,234 (fmtInt). A new unit jumps instead of rolling.',
    },
    {
      name: 'data.total',
      type: 'number',
      default: 'sum of parts',
      description:
        'The big number when the parts do not add up to it (usage not attributed to any part): the remainder joins Other. Below the parts’ sum it is ignored.',
    },
    {
      name: 'data.maxRows',
      type: 'number',
      default: '5',
      description:
        'Rows at most, Other included (min 2). Past it the smallest parts fold into “Other (n)”, whose tooltip lists them.',
    },
    {
      name: 'data.options',
      type: 'Array<{ id: string; label: string }>',
      description: 'A segmented switch in the header (period or measure) — shown with two or more options.',
    },
    {
      name: 'data.value',
      type: 'string',
      description:
        'Selected option. Set → controlled: the card only emits ui-change and you answer with value (and the new parts). Unset → the card moves its own selection (first option by default).',
    },
    {
      name: 'data.optionsLabel',
      type: 'string',
      default: '“Period” / “기간”',
      description: 'Accessible name of the switch, e.g. “Measure” for a cost / tokens switch.',
    },
    {
      name: 'data.totalLabel',
      type: 'string',
      default: '“Total” / “합계”',
      description: 'The line under the big number while nothing is hovered, e.g. “Spent in the last 7 days”.',
    },
    {
      name: 'data.footer',
      type: 'string | null',
      default: '“Largest: <part>”',
      description: 'The card’s last line under a hairline; null hides it.',
    },
    {
      name: 'data.loading',
      type: 'boolean',
      default: 'false',
      description: 'You are fetching: the numbers dim (aria-busy); without any parts yet a skeleton shows.',
    },
    {
      name: 'data.error',
      type: 'string',
      description: 'Your fetch failed: a dash for the total and this message. The switch stays usable.',
    },
    {
      name: 'data.emptyText',
      type: 'string',
      default: '“Nothing to break down for this period.”',
      description: 'Shown instead of the rows when no part has a value.',
    },
    {
      name: 'el.value · el.focus()',
      type: 'string | undefined (read-only) · method',
      description: 'The selected option id now; focus() moves focus to the checked option (else the first row).',
    },
    {
      name: 'flat',
      type: 'boolean attribute',
      description: 'No card of its own (no surface, ring or padding) — for a card you already have.',
    },
    { name: 'lang', type: "'en' | 'ko'", default: "'en'", description: 'UI language (attribute).' },
    { name: 'theme', type: "'light' | 'dark'", description: 'Pins the theme (attribute).' },
  ],
  events: [
    {
      name: 'ui-change',
      detail: '{ value: string }',
      description:
        'An option was picked (click, arrows, Home / End). Cancelable: preventDefault() keeps the current one. Controlled: set data.value — at once, with loading: true, so the fill moves while you fetch — and then the new parts.',
    },
  ],
  keyboard: [
    ['Tab', 'The switch (one tab stop: the checked option), then each row — a focused row lights like a hovered one'],
    ['← / → / ↑ / ↓', 'In the switch: previous or next option (wraps around)'],
    ['Home / End', 'In the switch: first or last option'],
  ],
  a11y: [
    'A group named by the title; the switch is a radiogroup (aria-checked, roving tabindex) named by optionsLabel.',
    'Rolling numbers are aria-hidden: screen readers get the final total in one sentence and every row as “label: value, share of the total”.',
    'Rows are focusable, so the highlight and the part’s value are reachable without a mouse. The bar is decorative: everything it shows is in the list.',
    'After a pick, a polite live region outside the re-rendered markup says the new total and the largest part once its data is in (or the error).',
    'Touch: options and rows are 44px tall on coarse pointers. Reduced motion: numbers, bar, rows and the switch fill change at once.',
  ],
  usage: `<ui-compact-breakdown></ui-compact-breakdown>
<script type="module">
  import '@2lab.ai/ui/compact-breakdown';
  const card = document.querySelector('ui-compact-breakdown');
  const PERIODS = [{ id: 'day', label: 'Today' }, { id: 'week', label: 'Last 7 days' }, { id: 'month', label: 'Last 30 days' }];

  // UsageReport (GET /api/dashboard/usage) → cost by model
  function paint(report, period) {
    const byModel = report.totals.byModel;
    card.data = {
      title: 'Spend by model', unit: 'usd', options: PERIODS, value: period,
      total: report.totals.totalCostUsd,
      parts: Object.keys(byModel).map((m) => ({ key: m, label: m, value: byModel[m].costUsd })),
    };
  }

  card.addEventListener('ui-change', async (e) => {
    const period = e.detail.value;
    card.data = { ...card.data, value: period, loading: true };   // the fill moves now, numbers dim
    try {
      paint(await fetch('/api/dashboard/usage?period=' + period).then((r) => r.json()), period);
    } catch {
      card.data = { ...card.data, loading: false, error: 'Couldn’t load usage' };
    }
  });
</script>`,
  demos: [
    {
      id: 'spend',
      title: 'Spend by model',
      description:
        'The period moves on by itself until you touch the card: numbers roll, the bar glides, rows trade places. Hover a row or a segment.',
      height: 400,
      frame: false,
      create: spendByModel,
    },
    {
      id: 'metric',
      title: 'Cost / tokens',
      description:
        'The switch can be a measure as well: the unit changes, so the numbers jump; rows still slide to their rank.',
      height: 400,
      frame: false,
      create: metricSwitch,
    },
    {
      id: 'users',
      title: 'By user + Other',
      description: 'Admin view, seven people: maxRows 5 folds the smallest three into Other (its tooltip lists them).',
      height: 400,
      frame: false,
      create: byUser,
    },
    {
      id: 'workflows',
      title: 'Counts, own colours',
      description: 'Sessions by workflow with the host’s colours (dashboard tokens) and its own last line.',
      height: 400,
      frame: false,
      create: workflows,
    },
    {
      id: 'states',
      title: 'Loading · empty · error',
      description:
        'A skeleton until the first data (it arrives after 1.4 s), a period with nothing in it, and a failed load.',
      height: 420,
      frame: false,
      create: states,
    },
    {
      id: 'flat',
      title: 'Flat (in a card)',
      description: 'flat drops the card’s own surface for a card the host already has.',
      height: 360,
      frame: true,
      create: flat,
    },
    {
      id: 'ko',
      title: '한국어 (lang="ko")',
      height: 400,
      frame: false,
      create: korean,
    },
  ],
};
