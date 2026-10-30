import type { ComponentDoc } from '../../docs/types';
import { icon } from '../../icons/icons';
import './elapsed';

const S = 1000;
const M = 60 * S;

function el(attrs: Record<string, string>): HTMLElement {
  const e = document.createElement('ui-elapsed');
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

/** A light-DOM sentence that holds one or more elapsed elements: they take its font and colour. */
function line(parts: Array<string | HTMLElement>, cls = ''): HTMLElement {
  const p = document.createElement('p');
  p.style.cssText = 'margin:0;font-size:13.5px;line-height:1.5;color:var(--ui-ib-text-2)';
  if (cls) p.className = cls;
  for (const x of parts) p.append(typeof x === 'string' ? document.createTextNode(x) : x);
  return p;
}

function col(...kids: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:10px;padding:18px 20px';
  box.append(...kids);
  return box;
}

export const doc: ComponentDoc = {
  slug: 'elapsed',
  name: 'Elapsed',
  tag: 'ui-elapsed',
  summary:
    'How long has it run, how long ago, how long is left? — one live time that ticks in place and stops by itself.',
  description:
    'An inline element for every live time on a page: a running task’s elapsed time (9m 22s), a stopwatch (2:15:07), a relative time (5m ago) or a countdown (3m 12s left until the next run). All of them tick on one shared timer, on whole seconds, so a page of twenty timers turns together; the text node changes in place (no re-render, no layout shift — tabular figures), and an element leaves the timer by itself once its time is final (a finished run, a countdown at zero). It takes the font and colour around it, carries a <time datetime> with the full date in its title, and says “ui-end” once when a countdown reaches zero.',
  usedIn: 'soma-work dashboard live timers: card timers, relative times and task elapsed times (K-03).',
  reference: { name: 'Relative time', url: 'https://www.affectui.com' },
  group: 'Primitives',
  props: [
    {
      name: 'since',
      type: 'attribute / data.since: epoch ms | ISO string | Date',
      description: 'The start (duration, clock, ago).',
    },
    {
      name: 'until',
      type: 'attribute / data.until: epoch ms | ISO string | Date',
      description: 'The end: duration and clock stop here; countdown counts down to it.',
    },
    {
      name: 'format',
      type: '"duration" | "clock" | "ago" | "countdown"',
      default: '"duration"',
      description: '42s · 9m 22s · 2h 15m — 0:42 · 2:15:07 — just now · 5m ago — time left until `until`.',
    },
    { name: 'lang', type: '"en" | "ko"', default: '"en"', description: '9m 22s / 9분 22초, 5m ago / 5분 전.' },
    {
      name: 'data',
      type: 'ElapsedData',
      description: '`{ since?, until?, format? }` — the same as the attributes (data wins).',
    },
    {
      name: 'elapsedText(data, now, lang)',
      type: 'string',
      description: 'The words for a moment (pure; the dashboard’s server render can use it too).',
    },
  ],
  events: [
    { name: 'ui-end', detail: '{ until: number }', description: 'A countdown reached zero (notification, once).' },
  ],
  keyboard: [],
  a11y: [
    'A <time datetime> carries the machine-readable moment; the full local date is its title.',
    'The ticking text is not a live region — nothing is announced every second.',
    'Tabular figures: the width does not jump as digits change.',
  ],
  usage: `<p>Running for <ui-elapsed since="2026-10-30T05:00:00Z"></ui-elapsed></p>
<p>Updated <ui-elapsed since="1793336400000" format="ago"></ui-elapsed></p>
<p>Next run in <ui-elapsed until="1793340000000" format="countdown"></ui-elapsed></p>
<script type="module">
  import '@2lab.ai/ui/elapsed';
  document.querySelector('ui-elapsed[format="countdown"]').addEventListener('ui-end', () => refresh());
</script>`,
  demos: [
    {
      id: 'formats',
      title: 'Four formats',
      description: 'Running time, a stopwatch, a relative time and a countdown — all on one shared tick.',
      height: 220,
      create: () => {
        const now = Date.now();
        return col(
          line(['Running for ', el({ since: String(now - 9 * M - 22 * S) })]),
          line(['Stopwatch ', el({ since: String(now - 2 * 60 * M - 15 * M - 7 * S), format: 'clock' })]),
          line(['Updated ', el({ since: String(now - 5 * M), format: 'ago' })]),
          line(['Next run in ', el({ until: String(now + 3 * M + 12 * S), format: 'countdown' })]),
        );
      },
    },
    {
      id: 'rows',
      title: 'In run rows',
      description:
        'With the kit’s .ui-row: a running job ticks; a finished one shows its final time and leaves the timer.',
      height: 260,
      create: () => {
        const now = Date.now();
        const list = document.createElement('ul');
        list.style.cssText = 'margin:0;padding:8px 6px;list-style:none';
        const row = (tone: string, glyph: string, title: string, meta: Array<string | HTMLElement>) => {
          const li = document.createElement('li');
          li.className = 'ui-row';
          li.dataset.tone = tone;
          li.innerHTML = `${icon(glyph)}<div><strong></strong><small></small></div>`;
          (li.querySelector('strong') as HTMLElement).textContent = title;
          const small = li.querySelector('small') as HTMLElement;
          for (const m of meta) small.append(typeof m === 'string' ? document.createTextNode(m) : m);
          return li;
        };
        list.append(
          row('run', 'clock', 'Nightly backup', ['Running · ', el({ since: String(now - 2 * M - 41 * S) })]),
          row('done', 'check', 'Weekly report', [
            'Done ',
            el({ since: String(now - 3 * 60 * M), format: 'ago' }),
            ' · took ',
            el({ since: String(now - 3 * 60 * M - 42 * S), until: String(now - 3 * 60 * M) }),
          ]),
          row('wait', 'clock', 'Daily digest', [
            'Next run in ',
            el({ until: String(now + 47 * S), format: 'countdown' }),
          ]),
        );
        return list;
      },
    },
    {
      id: 'ko',
      title: 'Korean',
      description: 'lang="ko" — 9분 22초, 5분 전.',
      height: 200,
      create: () => {
        const now = Date.now();
        return col(
          line(['실행 중 · ', el({ since: String(now - 9 * M - 22 * S), lang: 'ko' })]),
          line(['수정 ', el({ since: String(now - 5 * M), format: 'ago', lang: 'ko' })]),
          line(['다음 실행까지 ', el({ until: String(now + 90 * S), format: 'countdown', lang: 'ko' })]),
        );
      },
    },
    {
      id: 'countdown-end',
      title: 'Countdown that ends',
      description: 'A 5-second countdown: at zero it stops and sends ui-end once; the page answers with a line.',
      height: 160,
      create: () => {
        const c = el({ until: String(Date.now() + 5 * S), format: 'countdown' });
        const said = line(['Waiting…']);
        said.className = 'ui-status-line';
        c.addEventListener('ui-end', () => {
          said.textContent = 'Started — the countdown said ui-end once.';
          said.dataset.tone = 'done';
        });
        return col(line(['Starts in ', c]), said);
      },
    },
  ],
};
