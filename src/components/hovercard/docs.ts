import type { ComponentDoc } from '../../docs/types';
import { type IconName, icon } from '../../icons/icons';
import './hovercard';
import type { HovercardDetail, UiHovercard } from './hovercard';

interface Artifact {
  name: string;
  kind: 'html' | 'image' | 'markdown';
  meta: string;
}

const ARTIFACTS: Artifact[] = [
  { name: 'report.html', kind: 'html', meta: 'HTML · 18 KB · 2 min ago' },
  { name: 'retries.png', kind: 'image', meta: 'PNG · 1280×720 · 2 min ago' },
  { name: 'notes.md', kind: 'markdown', meta: 'Markdown · 2 KB · 1 min ago' },
  { name: 'flake-trace.html', kind: 'html', meta: 'HTML · 64 KB · just now' },
];

const KIND_ICON: Record<Artifact['kind'], IconName> = { html: 'file', image: 'image', markdown: 'list' };

function stage(): { box: HTMLElement; line: HTMLElement } {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:12px;align-items:flex-start';
  const line = document.createElement('p');
  line.style.cssText = 'margin:0;font-size:12.5px;color:var(--ui-ib-muted);min-height:18px';
  line.setAttribute('aria-live', 'polite');
  return { box, line };
}

function strip(items: Artifact[], cls = 'art-tile'): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
  items.forEach((a, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `ui-chip ${cls}`;
    b.dataset.i = String(i);
    b.innerHTML = `${icon(KIND_ICON[a.kind])}<span></span>`;
    b.querySelector('span')!.textContent = a.name;
    row.append(b);
  });
  return row;
}

function card(attrs: Record<string, string>): UiHovercard {
  const el = document.createElement('ui-hovercard');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/** The preview body for one artifact: a mock page, a chart, or the first lines of a note — drawn, never fetched. */
function preview(a: Artifact): HTMLElement {
  const media = document.createElement('div');
  media.style.cssText =
    'display:flex;align-items:flex-end;gap:10px;height:180px;padding:14px;box-sizing:border-box;background:var(--ui-ib-pill);overflow:hidden';
  if (a.kind === 'image') {
    for (const n of [1, 2, 4, 8, 16]) {
      const bar = document.createElement('span');
      bar.style.cssText = `flex:1;height:${n * 9 + 8}px;border-radius:6px 6px 2px 2px;background:color-mix(in srgb, var(--ui-accent) 70%, var(--ui-ib-card))`;
      media.append(bar);
    }
  } else if (a.kind === 'html') {
    media.style.alignItems = 'stretch';
    media.style.flexDirection = 'column';
    const page = document.createElement('div');
    page.style.cssText =
      'flex:1;border-radius:8px;background:var(--ui-ib-card);box-shadow:0 0 0 1px var(--ui-ib-card-border);padding:12px;display:flex;flex-direction:column;gap:6px';
    for (const w of [62, 92, 84, 40]) {
      const l = document.createElement('span');
      l.style.cssText = `display:block;height:7px;width:${w}%;border-radius:4px;background:var(--ui-ib-pill)`;
      page.append(l);
    }
    media.append(page);
  } else {
    media.style.alignItems = 'flex-start';
    media.style.flexDirection = 'column';
    media.style.gap = '4px';
    media.style.background = 'var(--ui-ib-card)';
    const h = document.createElement('b');
    h.style.cssText = 'font-size:13px;color:var(--ui-ib-text)';
    h.textContent = 'Next';
    media.append(h);
    for (const t of [
      'Cap the retry delay at 4 s.',
      'Run the spec 50× throttled.',
      'Two full CI runs before merging.',
    ]) {
      const p = document.createElement('span');
      p.textContent = `• ${t}`;
      media.append(p);
    }
  }
  const foot = document.createElement('div');
  foot.style.cssText = 'display:flex;flex-direction:column;gap:2px;padding:10px 12px';
  const name = document.createElement('b');
  name.style.cssText = 'font-size:12.5px;font-weight:600;color:var(--ui-ib-text)';
  name.textContent = a.name;
  const meta = document.createElement('span');
  meta.style.cssText = 'font-size:11.5px;color:var(--ui-ib-muted)';
  meta.textContent = a.meta;
  foot.append(name, meta);
  const box = document.createElement('div');
  box.append(media, foot);
  return box;
}

/** Fill the card for whichever tile asked (the trigger's data-i), and log the events. */
function wire(el: UiHovercard, items: Artifact[], line: HTMLElement, words = { open: 'ui-open', closed: 'ui-closed' }) {
  el.addEventListener('ui-open', (e) => {
    const t = (e as CustomEvent<HovercardDetail>).detail.trigger as HTMLElement;
    const a = items[Number(t.dataset.i)];
    if (!a) {
      e.preventDefault();
      return;
    }
    el.replaceChildren(preview(a));
    line.textContent = `${words.open} → ${a.name}`;
  });
  el.addEventListener('ui-closed', (e) => {
    const t = (e as CustomEvent<HovercardDetail>).detail.trigger as HTMLElement;
    el.replaceChildren(); // drop the preview (a playing video, an iframe) once it is gone
    line.textContent = `${words.closed} → ${items[Number(t.dataset.i)]?.name ?? ''}`;
  });
}

export const doc: ComponentDoc = {
  slug: 'hovercard',
  name: 'Hovercard',
  tag: 'ui-hovercard',
  group: 'Primitives',
  summary: 'One preview card for many triggers — a peek at a file, a person or an agent without opening it.',
  description:
    'Point it at its triggers with for="selector" (matched through open shadow roots, so tiles drawn later or inside other components count) or open it from code with anchor(el). After a 350ms hover intent — at once on keyboard focus — it sends a cancelable ui-open with the trigger: fill the card’s content then (lazily: an image, a scaled page, the first lines of a note), or preventDefault() to skip. It pops beside the trigger (bottom-start, flipping when there is no room), stays while the pointer is on it, moves to the next trigger in 90ms while open, and hides after a 200ms grace, on Esc, on a press, when focus goes or the trigger scrolls away; ui-closed follows the exit so you can drop heavy content. Unlike <ui-tooltip> it is a preview, not a description: no aria-describedby, any size you set.',
  usedIn:
    'soma-work dashboard › the artifact peek (#art-peek): one card for every artifact tile — board chips, card tiles, panel tiles, turn tiles — with an image, an HTML page at 0.28 scale, audio, video or markdown.',
  reference: {
    name: 'WCAG 2.2 · 1.4.13 Content on Hover or Focus',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html',
  },
  props: [
    {
      name: 'for',
      type: 'string (CSS selector)',
      description:
        'Attribute. The triggers: any element matching it under the pointer or keyboard focus, on the page or inside open shadow roots.',
    },
    {
      name: 'placement',
      type: "'bottom' | 'top' + '-start' | '-center' | '-end'",
      default: "'bottom-start'",
      description: 'Attribute. Preferred side and alignment; flips to the other side when it has more room.',
    },
    { name: 'delay', type: 'number', default: '350', description: 'Attribute. Hover intent in ms.' },
    {
      name: 'width',
      type: 'number',
      default: '360',
      description: 'Attribute. Card width in px (never wider than the viewport less 16px).',
    },
    {
      name: 'height',
      type: 'number',
      description: 'Attribute. Card height in px; without it the content sets the height (scrolling past the room).',
    },
    { name: 'disabled', type: 'boolean', description: 'Attribute. Never opens; hides if open.' },
    { name: 'open', type: 'boolean', description: 'Read-only property: the card is showing.' },
    { name: 'trigger', type: 'Element | null', description: 'Read-only property: the element it is showing for.' },
    {
      name: 'anchor(el)',
      type: '(el: Element | null) => void',
      description:
        'Open now for el (ui-open first); null hides. For triggers no selector reaches, or a keyboard command.',
    },
    { name: 'hide()', type: '() => void', description: 'Hide now (the exit runs, then ui-closed).' },
    {
      name: 'slot (default)',
      type: 'content',
      description: 'The card’s content — yours, in the light DOM. Fill it in ui-open; an empty card does not open.',
    },
    {
      name: '--ui-hovercard-z',
      type: 'CSS integer',
      default: '170',
      description: 'z-index of the card (fixed). Inside a modal dialog, put the element in the dialog.',
    },
    { name: '::part(card)', type: 'CSS part', description: 'The card: padding, radius, a fixed size.' },
  ],
  events: [
    {
      name: 'ui-open',
      detail: '{ trigger: Element }',
      description:
        'Before it shows (or moves to another trigger). Fill the content for detail.trigger now. Cancelable: preventDefault() keeps it closed.',
    },
    {
      name: 'ui-closed',
      detail: '{ trigger: Element }',
      description: 'After the exit has finished (not when it moves to another trigger). Not cancelable.',
    },
  ],
  keyboard: [
    ['Tab onto a trigger', 'Opens it at once (keyboard focus only)'],
    ['Esc', 'Closes it (the key is marked used, so a dialog under it stays open)'],
    ['Tab away', 'Closes it after the grace, unless focus went into the card'],
  ],
  a11y: [
    'A preview for pointer and keyboard users, not a description: the trigger gets no aria-describedby and the card no role. What it shows must be reachable another way (the tile opens the full viewer).',
    'Dismissible (Esc, without moving the pointer or focus), hoverable (the pointer may move onto it: 200ms grace) and persistent (it stays until the pointer or focus leaves) — WCAG 1.4.13.',
    'Touch has no hover: a tap is the trigger’s own (open the file). Opening needs a mouse, a pen, or keyboard focus.',
    'Reduced motion: no scale or slide, a 120ms fade.',
  ],
  usage: `<div class="strip">
  <button class="ui-chip art" data-id="a1">report.html</button>
  <button class="ui-chip art" data-id="a2">retries.png</button>
</div>
<ui-hovercard id="peek" for=".art" width="360"></ui-hovercard>
<script type="module">
  import '@2lab.ai/ui/hovercard';
  const peek = document.getElementById('peek');
  peek.addEventListener('ui-open', (e) => {
    const a = artifacts.get(e.detail.trigger.dataset.id);
    if (!a) return e.preventDefault();
    peek.replaceChildren(renderPreview(a)); // lazily: an <img>, a scaled <iframe>, a note
  });
  peek.addEventListener('ui-closed', () => peek.replaceChildren()); // stop a video, drop the iframe
</script>`,
  demos: [
    {
      id: 'artifacts',
      title: 'Artifact peek',
      description:
        'One card for four tiles, filled on ui-open and emptied on ui-closed. Sweep across quickly: nothing opens; rest 350ms: it does; while it is open the next tile takes it over.',
      height: 300,
      create: () => {
        const { box, line } = stage();
        const el = card({ for: '.art-tile', width: '320' });
        wire(el, ARTIFACTS, line);
        box.append(strip(ARTIFACTS), line, el);
        return box;
      },
    },
    {
      id: 'agents',
      title: 'Agent card',
      description:
        'placement="top-start" over a list of agents: status, model and the last step. The card is hoverable — move onto it to read.',
      height: 300,
      create: () => {
        const { box, line } = stage();
        box.style.paddingTop = '160px';
        const agents = [
          { name: 'A1 Explore', tone: 'run', status: 'Running', model: 'fable-5', step: 'Reading upload.test.ts' },
          {
            name: 'A2 Tests',
            tone: 'wait',
            status: 'Waiting for approval',
            model: 'opus-5-5',
            step: 'npm test -- upload',
          },
          { name: 'A3 Docs', tone: 'done', status: 'Done', model: 'sonnet-5', step: 'Updated docs/retries.md' },
        ];
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
        agents.forEach((a, i) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'ui-chip agent-chip';
          b.dataset.i = String(i);
          b.innerHTML = `<span class="ui-status" data-tone="${a.tone}"></span>`;
          b.querySelector('.ui-status')!.textContent = a.name;
          row.append(b);
        });
        const el = card({ for: '.agent-chip', placement: 'top-start', width: '280' });
        el.addEventListener('ui-open', (e) => {
          const a = agents[Number(((e as CustomEvent<HovercardDetail>).detail.trigger as HTMLElement).dataset.i)];
          const body = document.createElement('div');
          body.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:12px 14px';
          const head = document.createElement('b');
          head.style.cssText = 'font-size:13px;font-weight:600;color:var(--ui-ib-text)';
          head.textContent = a.name;
          const dl = document.createElement('dl');
          dl.className = 'ui-dl';
          for (const [k, v] of [
            ['Status', a.status],
            ['Model', a.model],
            ['Last step', a.step],
          ]) {
            const pair = document.createElement('div');
            const dt = document.createElement('dt');
            const dd = document.createElement('dd');
            dt.textContent = k;
            dd.textContent = v;
            pair.append(dt, dd);
            dl.append(pair);
          }
          body.append(head, dl);
          el.replaceChildren(body);
          line.textContent = `ui-open → ${a.name}`;
        });
        box.append(row, line, el);
        return box;
      },
    },
    {
      id: 'anchor',
      title: 'From code: anchor()',
      description:
        'Peek next walks the tiles with anchor(el) — for a keyboard command or triggers no selector reaches. Esc or Hide closes it.',
      height: 300,
      create: () => {
        const { box, line } = stage();
        const tiles = strip(ARTIFACTS.slice(0, 3), 'code-tile');
        const el = card({ width: '300' });
        wire(el, ARTIFACTS, line);
        let at = -1;
        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'ui-btn';
        next.textContent = 'Peek next';
        next.addEventListener('click', () => {
          const all = tiles.querySelectorAll('button');
          at = (at + 1) % all.length;
          el.anchor(all[at]);
        });
        const hide = document.createElement('button');
        hide.type = 'button';
        hide.className = 'ui-btn';
        hide.textContent = 'Hide';
        hide.addEventListener('click', () => el.hide());
        const controls = document.createElement('div');
        controls.style.cssText = 'display:flex;gap:8px';
        controls.append(next, hide);
        box.append(controls, tiles, line, el);
        return box;
      },
    },
    {
      id: 'ko',
      title: '한국어',
      description: '산출물 미리보기 — 타일 위에 잠시 머물면 열리고, 카드 위로 옮겨도 유지됩니다. Esc로 닫습니다.',
      height: 300,
      create: () => {
        const { box, line } = stage();
        const items: Artifact[] = [
          { name: '보고서.html', kind: 'html', meta: 'HTML · 18 KB · 2분 전' },
          { name: '재시도.png', kind: 'image', meta: 'PNG · 1280×720 · 2분 전' },
          { name: '메모.md', kind: 'markdown', meta: 'Markdown · 2 KB · 1분 전' },
        ];
        const el = card({ for: '.ko-tile', width: '320', lang: 'ko' });
        wire(el, items, line, { open: '열림', closed: '닫힘' });
        box.append(strip(items, 'ko-tile'), line, el);
        return box;
      },
    },
  ],
};
