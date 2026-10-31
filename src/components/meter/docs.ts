import type { ComponentDoc } from '../../docs/types';
import './meter';
import type { MeterData, UiMeter } from './meter';

function meter(data: MeterData, attrs: Record<string, string> = {}): UiMeter {
  const el = document.createElement('ui-meter');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

/** A light-DOM line with a quiet word before the meter: they take its font and colour. */
function line(word: string, ...els: Array<HTMLElement | string>): HTMLElement {
  const p = document.createElement('p');
  p.style.cssText =
    'display:flex;align-items:center;gap:10px;margin:0;font-size:13px;line-height:1.5;color:var(--ui-ib-text-2)';
  const w = document.createElement('span');
  w.style.cssText = 'min-width:150px;color:var(--ui-ib-muted)';
  w.textContent = word;
  p.append(w);
  for (const x of els) p.append(typeof x === 'string' ? document.createTextNode(x) : x);
  return p;
}

function col(...kids: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:12px;padding:18px 20px';
  box.append(...kids);
  return box;
}

/** The dashboard's thresholds for what is left: good from a half, fair from a fifth, bad below. */
const LEFT = { low: 0.2, high: 0.5 };

export const doc: ComponentDoc = {
  slug: 'meter',
  name: 'Meter',
  tag: 'ui-meter',
  summary:
    'How much is left — or used — of a bounded thing, at a glance: a bar or a battery, the percent, and the tone.',
  description:
    'A small reading for a bounded quantity: the remaining usage of a model, the share of a quota spent, the accounts still free. A short bar (or a battery glyph) with its fill, a percent or your own words beside it, in a tone the thresholds decide — the native <meter>’s words: below low is the low region, from high up the high region, and optimum says which end is good (max by default: more is better; min: less is better). The region the reading shares with optimum is good, a neighbouring one fair, the far one bad. A new value slides the fill on --dur-move and changes the words in place — nothing re-enters — and an unknown reading is a “?” with no fill. role="meter" carries the percent and the words; under reduced motion the fill jumps.',
  usedIn: 'soma-work dashboard New task dialog: the remaining-usage battery beside the model chip (H-03).',
  reference: { name: 'HTML <meter>', url: 'https://developer.mozilla.org/docs/Web/HTML/Element/meter' },
  group: 'Primitives',
  props: [
    {
      name: 'value',
      type: 'attribute / data.value: number | null',
      description: 'The reading. Missing, null or not a number: unknown (“?”, no fill).',
    },
    { name: 'min / max', type: 'number', default: '0 / 1', description: 'The range (max: 100 for percentages).' },
    {
      name: 'low / high',
      type: 'number',
      description: 'Under low is the low region, at or over high the high region. Without one there is no such region.',
    },
    {
      name: 'optimum',
      type: 'number',
      default: 'max',
      description: 'Which end is good: max — more is better (what is left); min — less is better (what is used).',
    },
    {
      name: 'label',
      type: 'string',
      description:
        'The accessible name (“Remaining usage”). Give one: without it the meter is named by its words alone.',
    },
    {
      name: 'text',
      type: 'string',
      description: 'Your own words beside the glyph and read out, instead of the percent (“3 of 5 accounts”).',
    },
    { name: 'shape', type: '"bar" | "battery"', default: '"bar"', description: 'A short track, or the battery glyph.' },
    { name: 'bare', type: 'boolean attribute / data.bare', description: 'The glyph alone, no words beside it.' },
    { name: 'lang', type: '"en" | "ko"', default: '"en"', description: 'Unknown / 미확인.' },
    { name: '--meter-w', type: 'CSS property on the element', default: '48px', description: 'The bar’s width.' },
    {
      name: 'tone',
      type: 'MeterTone (read-only)',
      description: 'done · wait · fail · idle — what the reading reads in now.',
    },
    {
      name: 'meterTone(value, range) / meterPercent / meterText',
      type: 'helpers',
      description: 'Pure: the tone, the percent and the words for a reading (a server render can use them too).',
    },
  ],
  events: [],
  keyboard: [],
  a11y: [
    'role="meter" with aria-valuemin 0, aria-valuemax 100, aria-valuenow the percent and aria-valuetext the words shown (or yours); give it a label.',
    'The zones are the native <meter>’s: under low is the low region, at or over high the high region, between them the middle. Give it a label — without one the meter is named by its words alone (“72%”, or your text), which says the amount but not what of.',
    'An unknown reading is role="img" named “<label>: Unknown” — a meter with no value would be a lie.',
    'The tone is never the only signal: the percent (or your words) is always there for the eye and the reader.',
    'The fill moves on --dur-move; under reduced motion it jumps. No loops, no blinking at low.',
  ],
  usage: `<ui-meter label="Remaining usage" value="0.72" low="0.2" high="0.5" shape="battery"></ui-meter>
<ui-meter label="Context used" value="82" max="100" low="50" high="80" optimum="0" style="--meter-w: 120px"></ui-meter>
<script type="module">
  import '@2lab.ai/ui/meter';
  const m = document.querySelector('ui-meter');
  m.data = { value: 0.48, low: 0.2, high: 0.5, label: 'Remaining usage' };   // the fill slides, the tone turns
</script>`,
  demos: [
    {
      id: 'levels',
      title: 'What is left',
      description:
        'Remaining usage at four levels with low 0.2 and high 0.5: good from a half, fair from a fifth, bad below — and unknown. Bars, then batteries; your own words on the last.',
      height: 300,
      create: () =>
        col(
          line('Plenty', meter({ value: 0.92, ...LEFT, label: 'Remaining usage' })),
          line('Half', meter({ value: 0.48, ...LEFT, label: 'Remaining usage' })),
          line('Low', meter({ value: 0.12, ...LEFT, label: 'Remaining usage' })),
          line('Unknown', meter({ value: null, ...LEFT, label: 'Remaining usage' })),
          line(
            'As a battery',
            meter({ value: 0.92, ...LEFT, label: 'Remaining usage', shape: 'battery' }),
            meter({ value: 0.48, ...LEFT, label: 'Remaining usage', shape: 'battery' }),
            meter({ value: 0.12, ...LEFT, label: 'Remaining usage', shape: 'battery' }),
            meter({ value: null, ...LEFT, label: 'Remaining usage', shape: 'battery' }),
          ),
          line(
            'Your own words',
            meter({ value: 3, max: 5, low: 1, high: 3, label: 'Accounts free', text: '3 of 5 accounts' }),
          ),
        ),
    },
    {
      id: 'live',
      title: 'A reading that changes',
      description:
        'Drag the slider: the fill slides on --dur-move, the tone turns at the thresholds, the words change in place.',
      height: 220,
      create: () => {
        const bar = meter({ value: 0.72, ...LEFT, label: 'Remaining usage' });
        bar.style.setProperty('--meter-w', '120px');
        const batt = meter({ value: 0.72, ...LEFT, label: 'Remaining usage', shape: 'battery' });
        const range = document.createElement('input');
        range.type = 'range';
        range.min = '0';
        range.max = '100';
        range.value = '72';
        range.setAttribute('aria-label', 'Remaining usage, percent');
        range.style.width = '220px';
        const said = document.createElement('p');
        said.className = 'ui-status-line';
        said.textContent = 'tone: done';
        range.addEventListener('input', () => {
          const v = Number(range.value) / 100;
          bar.data = { ...bar.data, value: v };
          batt.data = { ...batt.data, value: v };
          said.textContent = `tone: ${bar.tone}`;
        });
        return col(line('Bar', bar), line('Battery', batt), line('Set it', range), said);
      },
    },
    {
      id: 'used',
      title: 'What is used',
      description:
        'optimum = min: less is better. Context used with low 0.5 and high 0.8 — good until half, fair until four fifths, bad from there. One threshold alone makes two neighbouring regions, so its far side is fair at most.',
      height: 220,
      create: () => {
        const USED = { low: 0.5, high: 0.8, optimum: 0, label: 'Context used' };
        const wide = { style: '--meter-w: 120px' };
        return col(
          line('Fresh', meter({ value: 0.1, ...USED }, wide)),
          line('Half way', meter({ value: 0.52, ...USED }, wide)),
          line('Near the cap', meter({ value: 0.82, ...USED }, wide)),
          line('Only high set', meter({ value: 0.82, high: 0.8, optimum: 0, label: 'Context used' }, wide)),
        );
      },
    },
    {
      id: 'ko',
      title: 'Korean',
      description: 'lang="ko" — the words are yours or the percent; unknown says 미확인.',
      height: 200,
      create: () =>
        col(
          line('잔여량', meter({ value: 0.72, ...LEFT, label: '모델 잔여량' }, { lang: 'ko', shape: 'battery' })),
          line('부족', meter({ value: 0.08, ...LEFT, label: '모델 잔여량' }, { lang: 'ko', shape: 'battery' })),
          line('미확인', meter({ value: null, ...LEFT, label: '모델 잔여량' }, { lang: 'ko', shape: 'battery' })),
          line(
            '가용 계정',
            meter({ value: 2, max: 5, low: 1, high: 3, label: '가용 계정', text: '5개 중 2개' }, { lang: 'ko' }),
          ),
        ),
    },
  ],
};
