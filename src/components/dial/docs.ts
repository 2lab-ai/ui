import type { ComponentDoc } from '../../docs/types';
import './dial';
import type { DialData, UiDial } from './dial';

function dial(data: DialData, attrs: Record<string, string> = {}): UiDial {
  const el = document.createElement('ui-dial');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

/** A light-DOM heading for a demo card: a title and a quiet line under it. */
function head(title: string, sub: string): HTMLElement {
  const h = document.createElement('header');
  h.style.cssText = 'display:flex;flex-direction:column;gap:2px;min-width:0';
  const t = document.createElement('strong');
  t.style.cssText = 'font-size:14px;font-weight:600;line-height:1.35;color:var(--ui-ib-text)';
  t.textContent = title;
  const s = document.createElement('span');
  s.style.cssText = 'font-size:12.5px;line-height:1.45;color:var(--ui-ib-muted)';
  s.textContent = sub;
  h.append(t, s);
  return h;
}

function box(css: string, ...kids: Array<HTMLElement | string>): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = css;
  for (const k of kids) el.append(typeof k === 'string' ? document.createTextNode(k) : k);
  return el;
}

function para(text: string): HTMLElement {
  const p = document.createElement('p');
  p.style.cssText = 'flex:1 1 180px;min-width:0;margin:0;font-size:13px;line-height:1.55;color:var(--ui-ib-text-2)';
  p.textContent = text;
  return p;
}

/** A small dial with its name under it (for a row of them). */
function tile(name: string, el: UiDial): HTMLElement {
  const n = document.createElement('span');
  n.style.cssText = 'font-size:12px;line-height:1.35;color:var(--ui-ib-muted);text-align:center';
  n.textContent = name;
  return box('display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;flex:1 1 0', el, n);
}

const PAD = 'display:flex;flex-direction:column;gap:16px;padding:18px 20px;min-width:0';

/** Context used: less is better — good under half, fair until four fifths, bad from there. */
const USED = { max: 100, low: 50, high: 80, optimum: 0, unit: '%', caption: 'used' } as const;

export const doc: ComponentDoc = {
  slug: 'dial',
  name: 'Dial',
  tag: 'ui-dial',
  summary: 'One bounded score at a glance: a gauge of ticks or a ring, the number in the middle, and how it moved.',
  description:
    'A large reading for the one number a card is about — a review score, the context used, a cron success rate, a quota spent. Two shapes: short radial ticks along a 270° arc (the opening faces down), filled up to the value with the rest muted; or a thick ring whose value arc runs clockwise from the top. The number sits in the middle with a small caption under it (“out of 100” by default, or your words: “used”, “succeeded”), and an optional chip below says how it moved (“+4 since last week”) — good when it moved toward optimum, bad when away. The tone is ui-meter’s: low / high / optimum split the scale into regions, the region the reading shares with optimum is good, a neighbour fair, the far one bad; tone="accent" draws it in the accent ink instead. A new value patches in place — the ring’s arc slides on --dur-move, the ticks turn one after another (the sweep capped at 240ms) — and an unknown reading is a “?” with nothing filled. It is --dial-size wide (180px) and shrinks with a narrow card; the words scale with it.',
  usedIn:
    'Fits the soma-work dashboard’s summary cards: the review score of a PR’s rounds, the context window used, a cron job’s 7-day success rate, the token quota spent (not wired yet).',
  reference: {
    name: 'Halvi (Code and Chill) — pattern studied, no code used',
    url: 'https://demo.codeandchill.store/halvi/',
  },
  group: 'Primitives',
  props: [
    {
      name: 'value',
      type: 'attribute / data.value: number | null',
      description: 'The reading. Missing, null or not a number: unknown (“?”, nothing filled).',
    },
    { name: 'min / max', type: 'number', default: '0 / 100', description: 'The scale.' },
    {
      name: 'low / high',
      type: 'number',
      description: 'Under low is the low region, at or over high the high region (ui-meter’s rule).',
    },
    {
      name: 'optimum',
      type: 'number',
      default: 'max',
      description:
        'Which end is good: max — more is better (a score); min — less is better (context used). Also decides the delta chip’s tone.',
    },
    {
      name: 'label',
      type: 'string',
      description: 'The accessible name (“Review score”). Give one: without it the dial is named by its words alone.',
    },
    {
      name: 'text',
      type: 'string',
      description:
        'Words in the middle instead of the number (“12 / 14”); longer than five characters they set smaller.',
    },
    {
      name: 'caption',
      type: 'string',
      default: '"out of {max}" · ko "{max}점 만점"',
      description:
        'The small line under the number. The default shows only with the bare number (no unit, no text); "" hides it.',
    },
    { name: 'unit', type: 'string', description: 'After the number, smaller (“%”); also on the delta.' },
    {
      name: 'data.delta',
      type: '{ value: number; text?: string }',
      description:
        'A chip under the dial: the signed change (“+4”, “−2”) and your words. Good (done) toward optimum, bad (fail) away, neutral at 0.',
    },
    {
      name: 'shape',
      type: '"ticks" | "ring"',
      default: '"ticks"',
      description: 'Radial ticks along the arc, or a thick ring with its value arc.',
    },
    { name: 'ticks', type: 'number', default: '40', description: 'How many ticks (12 … 80).' },
    {
      name: 'arc',
      type: 'number (degrees)',
      default: '270 ticks · 360 ring',
      description:
        '180 … 360. An open arc is centred on the top, so its opening faces down; a full ring starts at the top.',
    },
    {
      name: 'tone',
      type: '"auto" | "accent"',
      default: '"auto"',
      description:
        'auto — the meter’s tone colours from the thresholds; accent — the accent ink (a count with no good or bad).',
    },
    {
      name: 'size / --dial-size',
      type: 'attribute (px) / CSS property',
      default: '180px',
      description:
        'The dial’s width; it never grows past its box (max-width 100%, square) and the words scale with it.',
    },
    { name: 'lang', type: '"en" | "ko"', default: '"en"', description: 'out of 100 / 100점 만점 · Unknown / 미확인.' },
    {
      name: 'tone (read-only property)',
      type: 'MeterTone',
      description: 'done · wait · fail · idle — what the thresholds make of the reading now (under tone="accent" too).',
    },
    {
      name: 'dialFraction / dialTickCount / dialFilled / dialTickGeometry / dialArcPath / dialDeltaTone',
      type: 'helpers',
      description:
        'Pure: the share of the scale, the tick count, the ticks filled, their geometry, the ring path and the delta’s tone.',
    },
  ],
  events: [],
  keyboard: [],
  a11y: [
    'The face is role="meter" with aria-valuemin / aria-valuemax the scale, aria-valuenow the reading (kept inside the scale) and aria-valuetext the words shown (“90 out of 100”, “72% used”); aria-label is the label.',
    'An unknown reading is role="img" named “<label>: Unknown” (미확인) — a meter at nothing would be a lie.',
    'The drawing (ticks, ring) is aria-hidden; the delta chip is plain text after the meter (“+4 since last week”), so the sign says the direction, not the colour.',
    'The tone is never the only signal: the number (or your words) and the caption are always there.',
    'The ring’s arc slides on --dur-move and the ticks turn in a short stagger; under reduced motion both jump. No loops.',
  ],
  usage: `<ui-dial label="Review score" value="90" low="60" high="80"></ui-dial>
<ui-dial label="Context used" shape="ring" value="72" low="50" high="80" optimum="0" unit="%" caption="used" size="140"></ui-dial>
<script type="module">
  import '@2lab.ai/ui/dial';
  const d = document.querySelector('ui-dial');
  d.data = { value: 90, low: 60, high: 80, label: 'Review score', delta: { value: 4, text: 'since last week' } };
  d.data = { ...d.data, value: 94 };   // the ticks turn up to 94 in place
</script>`,
  demos: [
    {
      id: 'review-score',
      title: 'Review score',
      description:
        'Ticks on a 270° arc, 90 out of 100 with low 60 and high 80 (good), and how it moved since last week. Press “Next round” to move it — the ticks turn one after another.',
      height: 400,
      create: () => {
        const scores = [90, 94, 71, 52, 90];
        const deltas = [4, 4, -23, -19, 38];
        let i = 0;
        const el = dial({
          value: 90,
          low: 60,
          high: 80,
          label: 'Review score',
          delta: { value: 4, text: 'since last week — fewer review rounds did most of it' },
        });
        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'ui-btn';
        next.textContent = 'Next round';
        next.addEventListener('click', () => {
          i = (i + 1) % scores.length;
          el.data = {
            ...el.data,
            value: scores[i],
            delta: { value: deltas[i], text: 'since the last round' },
          };
        });
        return box(
          PAD,
          head('Review score', 'Last 12 PRs · tests, lint, review rounds, reverts'),
          box('display:flex;justify-content:center;min-width:0', el),
          box('display:flex;justify-content:center', next),
        );
      },
    },
    {
      id: 'context-used',
      title: 'Context used',
      description:
        'optimum = min: less is better. 72% used with low 50 and high 80 is fair (wait); the delta −6 is good because it went down. Drag to move it: the ring’s arc slides, the ticks sweep, the tone turns at the thresholds.',
      height: 420,
      create: () => {
        const ring = dial({
          value: 72,
          ...USED,
          shape: 'ring',
          label: 'Context used',
          delta: { value: -6, text: 'since the last compaction' },
        });
        const ticks = dial({ value: 72, ...USED, label: 'Context used' });
        const range = document.createElement('input');
        range.type = 'range';
        range.min = '0';
        range.max = '100';
        range.value = '72';
        range.setAttribute('aria-label', 'Context used, percent');
        range.style.cssText = 'width:min(260px,100%)';
        const said = document.createElement('p');
        said.className = 'ui-status-line';
        said.textContent = 'tone: wait';
        range.addEventListener('input', () => {
          const v = Number(range.value);
          ring.data = { ...ring.data, value: v };
          ticks.data = { ...ticks.data, value: v };
          said.textContent = `tone: ${ring.tone}`;
        });
        return box(
          PAD,
          head('Context used', 'claude-opus · session 7f3a · 144k of 200k tokens'),
          box('display:flex;flex-wrap:wrap;justify-content:center;gap:24px;min-width:0', ring, ticks),
          box('display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px', range, said),
        );
      },
    },
    {
      id: 'cron-success',
      title: 'Cron success rate (7 days)',
      description:
        'A ring at 96% (low 80, high 95: good) beside the sentence it stands for; the −2 chip is bad because it moved away from optimum (max).',
      height: 280,
      create: () =>
        box(
          PAD,
          head('Cron success rate', 'Last 7 days · 148 scheduled runs'),
          box(
            'display:flex;flex-wrap:wrap;align-items:center;gap:20px;min-width:0',
            dial(
              {
                value: 96,
                low: 80,
                high: 95,
                unit: '%',
                caption: 'succeeded',
                shape: 'ring',
                label: 'Cron success rate, last 7 days',
                delta: { value: -2, text: 'vs previous 7 days' },
              },
              { size: '132' },
            ),
            para(
              '142 of 148 runs went through. nightly-backup failed four times on a full disk; sync-issues twice on a rate limit.',
            ),
          ),
        ),
    },
    {
      id: 'trio',
      title: 'Small, in a row',
      description:
        'Three dials at size 96 sharing a card: tokens spent of the budget (ring, less is better), deploys that went green (ticks, out of 14 by default) and agent turns used (tone="accent": a count with no good or bad).',
      height: 240,
      create: () =>
        box(
          PAD,
          head('This sprint', 'soma-work · week 45'),
          box(
            'display:flex;justify-content:space-between;gap:12px;min-width:0',
            tile(
              'Token budget',
              dial(
                {
                  value: 41,
                  max: 100,
                  low: 60,
                  high: 85,
                  optimum: 0,
                  unit: '%',
                  caption: 'spent',
                  shape: 'ring',
                  label: 'Token budget spent',
                },
                { size: '96' },
              ),
            ),
            tile(
              'Deploys green',
              dial({ value: 12, max: 14, low: 10, high: 12, label: 'Deploys green', ticks: 28 }, { size: '96' }),
            ),
            tile(
              'Agent turns',
              dial({ value: 18, max: 40, label: 'Agent turns used', tone: 'accent', shape: 'ring' }, { size: '96' }),
            ),
          ),
        ),
    },
    {
      id: 'ko',
      title: 'Korean',
      description:
        'lang="ko" — the default caption is “100점 만점”; unknown says 미확인 to a screen reader and shows a “?”.',
      height: 280,
      create: () =>
        box(
          PAD,
          box(
            'display:flex;flex-wrap:wrap;justify-content:space-around;gap:16px;min-width:0',
            dial(
              { value: 90, low: 60, high: 80, label: '리뷰 점수', delta: { value: 4, text: '지난주보다' } },
              { lang: 'ko', size: '140' },
            ),
            dial(
              { value: 72, ...USED, caption: '사용', shape: 'ring', label: '컨텍스트 사용량' },
              { lang: 'ko', size: '140' },
            ),
            dial({ value: null, label: '크론 성공률' }, { lang: 'ko', size: '140' }),
          ),
        ),
    },
  ],
};
