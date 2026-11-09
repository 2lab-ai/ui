import type { ComponentDoc } from '../../docs/types';
import { icon } from '../../icons/icons';
import './sparkline';
import type { SparklineData, SparkTone, UiSparkline } from './sparkline';

function spark(data: SparklineData, attrs: Record<string, string> = {}): UiSparkline {
  const el = document.createElement('ui-sparkline');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

/** Light-DOM styles for the demo rows (the host's own markup): tokens and color-mix() only. */
const ROW_CSS = `
.spx-list { display: flex; flex-direction: column; gap: 2px; width: min(100%, 340px); margin: 0; padding: 6px;
  list-style: none; border: 1px solid var(--ui-ib-card-border); border-radius: 16px; background: var(--ui-ib-card); }
.spx-row { appearance: none; box-sizing: border-box; display: flex; align-items: center; gap: 12px; width: 100%;
  margin: 0; padding: 9px 10px; border: 0; border-radius: 12px; background: transparent; color: var(--ui-ib-text);
  font: inherit; text-align: left; cursor: pointer; transition: background-color 160ms ease, color 160ms ease; }
@media (hover: hover) { .spx-row:not([aria-current="true"]):hover { background: color-mix(in srgb, var(--ui-ib-text) 5%, transparent); } }
.spx-row:focus-visible { outline: 2px solid var(--ui-border-focus); outline-offset: 1px; }
.spx-row[aria-current="true"] { background: var(--ui-ib-text); color: var(--ui-ib-card); }
.spx-ic { flex: none; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%;
  background: color-mix(in srgb, currentColor 9%, transparent); }
.spx-txt { display: flex; flex: 1; flex-direction: column; min-width: 0; }
.spx-name { font-size: 13.5px; font-weight: 600; line-height: 18px; }
.spx-val { font-size: 12px; line-height: 16px; color: color-mix(in srgb, currentColor 64%, transparent);
  font-variant-numeric: tabular-nums; }
.spx-row ui-sparkline { --spark-w: 64px; --spark-h: 22px; color: var(--ui-ib-muted); }
.spx-row[aria-current="true"] ui-sparkline { color: inherit; }
`;

interface Metric {
  icon: string;
  name: string;
  value: string;
  values: Array<number | null>;
}

/** Last 14 days of the agent fleet, oldest first. */
const METRICS: Metric[] = [
  {
    icon: 'brain',
    name: 'Tokens',
    value: '1.2M today',
    values: [0.9, 1.1, 0.6, 0.5, 1.2, 1.4, 1.3, 1.0, 0.7, 0.6, 1.5, 1.7, 1.4, 1.2].map((v) => v * 1_000_000),
  },
  {
    icon: 'chat',
    name: 'Sessions',
    value: '38 today',
    values: [22, 31, 12, 9, 34, 41, 36, 30, 14, 11, 39, 44, 40, 38],
  },
  {
    icon: 'clock',
    name: 'p95 latency',
    value: '184 ms',
    values: [170, 176, 168, 172, 181, 190, 262, 238, 199, 186, 178, 175, 182, 184],
  },
  {
    icon: 'target',
    name: 'Spend',
    value: '$6.10 today',
    values: [4.6, 5.9, 1.6, 0.9, 5.4, 7.2, 6.8, 6.1, 1.4, 0.7, 6.3, 8.1, 7.4, 6.1],
  },
  { icon: 'alert', name: 'Cron failures', value: '2 this week', values: [0, 1, 0, 0, 3, 0, 1, 0, 0, null, 0, 1, 0, 1] },
  {
    icon: 'refresh',
    name: 'Review rounds',
    value: '3.4 per PR',
    values: [2.1, 2.6, 3.0, 2.4, 2.9, 3.8, 3.1, 2.7, 3.3, 3.6, 2.8, 3.2, 3.5, 3.4],
  },
];

function rows(lang: 'en' | 'ko' = 'en'): HTMLElement {
  const box = document.createElement('div');
  const style = document.createElement('style');
  style.textContent = ROW_CSS;
  const list = document.createElement('ul');
  list.className = 'spx-list';
  list.setAttribute('aria-label', lang === 'ko' ? '지표' : 'Metrics');
  const names: Record<string, string> = {
    Tokens: '토큰',
    Sessions: '세션',
    'p95 latency': 'p95 지연',
    Spend: '비용',
    'Cron failures': '크론 실패',
    'Review rounds': '리뷰 라운드',
  };
  const buttons: HTMLButtonElement[] = [];
  METRICS.forEach((m, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'spx-row';
    if (i === 0) b.setAttribute('aria-current', 'true');
    const ic = document.createElement('span');
    ic.className = 'spx-ic';
    ic.innerHTML = icon(m.icon, { size: 15 });
    const txt = document.createElement('span');
    txt.className = 'spx-txt';
    const name = document.createElement('span');
    name.className = 'spx-name';
    name.textContent = lang === 'ko' ? names[m.name] : m.name;
    const val = document.createElement('span');
    val.className = 'spx-val';
    val.textContent = m.value;
    txt.append(name, val);
    b.append(ic, txt, spark({ values: m.values, label: name.textContent }, lang === 'ko' ? { lang: 'ko' } : {}));
    b.addEventListener('click', () => {
      for (const o of buttons) o.toggleAttribute('aria-current', o === b);
      b.setAttribute('aria-current', 'true');
    });
    buttons.push(b);
    li.append(b);
    list.append(li);
  });
  box.append(style, list);
  return box;
}

function grid(...cells: HTMLElement[]): HTMLElement {
  const g = document.createElement('div');
  g.style.cssText =
    'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px 18px;width:100%;font-size:12px;color:var(--ui-ib-text-2)';
  g.append(...cells);
  return g;
}

function cell(word: string, el: HTMLElement): HTMLElement {
  const c = document.createElement('div');
  c.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0';
  const w = document.createElement('span');
  w.textContent = word;
  c.append(w, el);
  return c;
}

const TONES: SparkTone[] = ['accent', 'run', 'done', 'wait', 'fail', 'muted'];
const WAVE = [5, 7, 6, 9, 8, 12, 10, 9, 13, 11, 14, 12];

export const doc: ComponentDoc = {
  slug: 'sparkline',
  name: 'Sparkline',
  tag: 'ui-sparkline',
  group: 'Primitives',
  summary: 'Which way is this metric heading? A tiny smooth line beside the number, the latest value dotted.',
  description:
    'The trend of one metric in a 72 × 24 box (set --spark-w / --spark-h): a smooth monotone line — it never swings past the data — with a small dot on the latest value, and an optional soft area under it. Feed it a values attribute (comma-separated; junk is ignored) or data (where null breaks the line). Without a tone it draws in currentColor, so in a metric list the quiet rows pass their muted ink and the selected, inverted row passes its own. A new reading patches the nodes in place, so the line glides. It is one role="img" named with a summary: points, low, high and last.',
  usedIn:
    'Fits the soma-work dashboard: the metric rows of the stats page (tokens, sessions, latency, spend beside their numbers) and the trend beside each agent in the fleet list — not wired yet.',
  reference: {
    name: 'Halvi (Code and Chill) — pattern studied, no code used',
    url: 'https://demo.codeandchill.store/halvi/',
  },
  props: [
    {
      name: 'values',
      type: 'attribute (comma- or space-separated numbers) / data.values: Array<number | null>',
      description: 'Oldest first. In the attribute anything that is not a number is dropped; in data null is a gap.',
    },
    {
      name: 'tone',
      type: "'accent' | 'run' | 'done' | 'wait' | 'fail' | 'muted'",
      description: 'The line’s token colour. Not set: currentColor — the row’s own ink, so an inverted row reads.',
    },
    { name: 'area', type: 'boolean attribute / data.area', description: 'A soft fill under the line.' },
    {
      name: 'label',
      type: 'string',
      description: 'The accessible name, read before the summary: “Tokens: 12 points, low 3.1K, high 9.8K, last 7.2K”.',
    },
    {
      name: 'data.min / data.max',
      type: 'number',
      description:
        'Fix the scale (0 … 100 for a percentage). Default: the values’ own low and high; outside values clamp.',
    },
    { name: 'lang', type: "'en' | 'ko'", default: "'en'", description: 'The summary’s language.' },
    {
      name: '--spark-w / --spark-h',
      type: 'CSS length',
      default: '72px / 24px',
      description: 'The size. The line stretches to it with a non-scaling stroke; the dot stays round.',
    },
    {
      name: 'sparkValues / sparkSummary / sparkPoints',
      type: 'helpers',
      description: 'Pure: parse the attribute, write the summary (en / ko), place the points.',
    },
  ],
  events: [],
  keyboard: [],
  a11y: [
    'One role="img" named by label plus a summary — “Tokens: 12 points, low 3.1K, high 9.8K, last 7.2K” (ko: “토큰: 12개 지점, 최저 3.1K, 최고 9.8K, 최근 7.2K”); “no data” / “데이터 없음” when empty. The svg and the dot are aria-hidden.',
    'Not focusable and silent: it is a picture beside a number the row already says. Put the number in text next to it.',
    'Colour is optional: without a tone it is currentColor, so it keeps the contrast of the text around it (an inverted, selected row included). In mono the tones fall to ink.',
    'A new reading glides on --dur-move; under reduced motion it jumps.',
  ],
  usage: `<ui-sparkline values="4200, 5100, 3100, 6600, 7400, 9800, 7200" label="Tokens"></ui-sparkline>
<ui-sparkline values="170 176 168 262 238 199 184" tone="run" area label="p95 latency"
  style="--spark-w: 120px; --spark-h: 32px"></ui-sparkline>
<script type="module">
  import '@2lab.ai/ui/sparkline';
  const s = document.querySelector('ui-sparkline');
  s.data = { values: [4, 6, null, 5, 7], label: 'Sessions', tone: 'accent' };   // null breaks the line
</script>`,
  demos: [
    {
      id: 'rows',
      title: 'Metric rows',
      description:
        'A light-DOM list of metrics, each with its sparkline. Quiet rows pass muted ink; the selected row is inverted and the line follows its currentColor. Click a row to move the selection.',
      height: 440,
      create: () => rows(),
    },
    {
      id: 'tones',
      title: 'Tones and area',
      description: 'Each tone, plain and with the soft area. Without a tone the line is the text colour around it.',
      height: 260,
      create: () =>
        grid(
          cell('currentColor', spark({ values: WAVE, label: 'Default' })),
          ...TONES.flatMap((t) => [
            cell(t, spark({ values: WAVE, tone: t, label: t })),
            cell(`${t} · area`, spark({ values: WAVE, tone: t, area: true, label: `${t} area` })),
          ]),
        ),
    },
    {
      id: 'attributes',
      title: 'Attributes and sizes',
      description:
        'Plain HTML: values as an attribute (the junk “x” and the empty slot are dropped), sized with --spark-w / --spark-h.',
      height: 220,
      create: () => {
        const box = document.createElement('div');
        box.style.cssText =
          'display:flex;flex-wrap:wrap;align-items:center;gap:18px 28px;font-size:12px;color:var(--ui-ib-text-2)';
        box.innerHTML = `<span>48 × 16 <ui-sparkline values="3,5,4,8,6,9" label="Deploys" style="--spark-w:48px;--spark-h:16px"></ui-sparkline></span>
<span>72 × 24 <ui-sparkline values="3, 5, x, 4, 8,, 6" tone="accent" label="Review rounds"></ui-sparkline></span>
<span>160 × 40 <ui-sparkline values="170 176 168 172 181 190 262 238 199 186 178 184" tone="run" area label="p95 latency" style="--spark-w:160px;--spark-h:40px"></ui-sparkline></span>`;
        return box;
      },
    },
    {
      id: 'live',
      title: 'A reading that changes',
      description:
        'Each press drops the oldest reading and adds a new one: the nodes stay, the line and the dot glide.',
      height: 200,
      create: () => {
        const box = document.createElement('div');
        box.style.cssText = 'display:flex;align-items:center;gap:16px;font-size:13px;color:var(--ui-ib-text)';
        const values = [12, 14, 11, 16, 15, 19, 17, 21, 18, 22];
        const s = spark({ values: [...values], tone: 'accent', area: true, label: 'Sessions' });
        s.style.cssText = '--spark-w: 140px; --spark-h: 36px';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ui-btn';
        btn.textContent = 'Next reading';
        let seed = 3;
        btn.addEventListener('click', () => {
          seed = (seed * 7 + 5) % 23;
          values.shift();
          values.push(10 + seed);
          s.data = { ...s.data, values: [...values] };
        });
        box.append(s, btn);
        return box;
      },
    },
    {
      id: 'ko',
      title: 'Korean',
      description: 'lang="ko" — the summary reads 최저 · 최고 · 최근.',
      height: 440,
      create: () => rows('ko'),
    },
  ],
};
