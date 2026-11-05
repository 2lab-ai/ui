import type { ComponentDoc } from '../../docs/types';
import './image-compare';
import type { ImageCompareChange, ImageCompareData, UiImageCompare } from './image-compare';

/*
 * Offline "screenshots" for the demos: SVG drawn here, handed to the element as blob: URLs (safeSrc takes http(s),
 * relative, blob: and raster data:image — not SVG data URIs). Neutral greys and one blue: they read on a light or a
 * dark page. The colours below are picture content, not UI.
 */
const C = {
  page: '#ebebee',
  screen: '#f7f7f9',
  card: '#ffffff',
  line: '#dcdce1',
  ink: '#232326',
  mid: '#66666e',
  soft: '#9d9da6',
  pill: '#e4e4e8',
  wash: '#f3f3f5',
  accent: '#2f63e0',
  accentWash: '#e2e9fb',
};
const FONT = "Inter, system-ui, -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', sans-serif";

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rect = (x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${stroke ? ` stroke="${stroke}"` : ''}/>`;
const dot = (cx: number, cy: number, r: number, fill: string) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
function text(x: number, y: number, s: string, size: number, fill: string, weight = 400, anchor = 'start'): string {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${xml(s)}</text>`;
}
const svg = (w: number, h: number, body: string, page = C.page) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">${rect(0, 0, w, h, 0, page)}${body}</svg>`;

const urls = new Map<string, string>();
/** The picture as a blob: URL, made once per key ('' where there is no Blob URL support). */
function picture(key: string, make: () => string): string {
  let url = urls.get(key);
  if (url === undefined) {
    try {
      url = URL.createObjectURL(new Blob([make()], { type: 'image/svg+xml' }));
    } catch {
      url = '';
    }
    urls.set(key, url);
  }
  return url;
}

type Status = 'run' | 'wait' | 'done';
interface Task {
  title: string;
  owner: string;
  pr: number;
  ago: string;
  status: Status;
  steps: number;
}

const TASKS: Task[] = [
  { title: 'Fix login redirect loop', owner: 'zhuge', pr: 412, ago: '12 min ago', status: 'run', steps: 3 },
  { title: 'Add owner filter to the board', owner: 'elon', pr: 415, ago: '3 min ago', status: 'wait', steps: 4 },
];

/** A status chip: the running one in the accent, the rest grey. */
function chip(right: number, y: number, label: string, status: Status, charW = 6.6): string {
  const w = Math.round(label.length * charW + 30);
  const x = right - w;
  const on = status === 'run';
  return `${rect(x, y, w, 24, 12, on ? C.accentWash : C.pill)}${dot(x + 14, y + 12, 4, on ? C.accent : C.soft)}${text(x + 24, y + 16.5, label, 12, on ? C.accent : C.mid, 600)}`;
}

/** The soma-work board with two task cards: `old` = 0.27 (plain text), else 0.28 (owner badge + status chip). */
function boardSvg(old: boolean): string {
  let body = `${rect(0, 0, 640, 48, 0, C.card)}${rect(0, 47, 640, 1, 0, C.line)}${rect(20, 16, 16, 16, 4, C.ink)}${text(44, 29, 'soma-work', 14, C.ink, 600)}`;
  body += `${text(452, 29, 'Board', 12, C.ink, 600)}${text(504, 29, 'Runs', 12, C.mid)}${text(552, 29, 'Memory', 12, C.mid)}`;
  body += text(28, 80, 'In progress · 2', 12, C.mid, 600);
  TASKS.forEach((t, i) => {
    const y = 94 + i * 148;
    const fill = Math.round(((old ? 300 : 552) * t.steps) / 5);
    const bar = t.status === 'run' ? C.accent : C.soft;
    body += rect(24.5, y + 0.5, 591, 132, 10, C.card, C.line);
    if (old) {
      body += text(44, y + 32, t.title, 17, C.ink, 600);
      body += text(44, y + 56, `2lab-ai/soma-work · PR #${t.pr} · ${t.owner} · ${t.ago}`, 12, C.mid);
      body += text(44, y + 90, t.status === 'run' ? 'Status: running' : 'Status: waiting for review', 12, C.mid);
      body += `${rect(44, y + 102, 300, 6, 3, C.pill)}${rect(44, y + 102, fill, 6, 3, bar)}${text(356, y + 108, `${t.steps} / 5`, 11, C.soft)}`;
    } else {
      body += chip(596, y + 16, t.status === 'run' ? 'Running' : 'Waiting', t.status);
      body += text(44, y + 34, t.title, 17, C.ink, 600);
      const w = Math.round(t.owner.length * 7 + 40);
      body += `${rect(44.5, y + 48.5, w, 24, 12, C.wash, C.line)}${dot(57, y + 60.5, 8, C.mid)}${text(57, y + 64.5, t.owner[0].toUpperCase(), 10, C.card, 700, 'middle')}${text(71, y + 65, t.owner, 12, C.ink, 600)}`;
      body += text(44 + w + 12, y + 65, `PR #${t.pr} · ${t.ago}`, 12, C.mid);
      body += text(44, y + 98, `${t.steps} of 5 steps`, 12, C.mid);
      body += `${rect(44, y + 108, 552, 6, 3, C.pill)}${rect(44, y + 108, fill, 6, 3, bar)}`;
    }
  });
  return svg(640, 400, body);
}

const PHONE = {
  en: {
    head: 'Sessions',
    all: 'All',
    mine: 'Mine',
    add: 'New task',
    tabs: ['Board', 'Runs', 'Memory'],
    status: { run: 'Running', wait: 'Waiting', done: 'Done' } as Record<Status, string>,
    rows: [
      ['Fix login redirect loop', 'zhuge', '12m', 'run'],
      ['Add owner filter', 'elon', '3m', 'wait'],
      ['Move cron jobs to queue', 'zhuge', '41m', 'done'],
      ['Nightly QA report', 'fable', '58m', 'done'],
    ] as Array<[string, string, string, Status]>,
  },
  ko: {
    head: '세션',
    all: '전체',
    mine: '내 작업',
    add: '새 작업',
    tabs: ['보드', '실행', '메모리'],
    status: { run: '실행 중', wait: '대기 중', done: '완료' } as Record<Status, string>,
    rows: [
      ['로그인 리다이렉트 수정', 'zhuge', '12분', 'run'],
      ['담당자 필터 추가', 'elon', '3분', 'wait'],
      ['크론 작업을 큐로 이전', 'zhuge', '41분', 'done'],
      ['야간 QA 리포트', 'fable', '58분', 'done'],
    ] as Array<[string, string, string, Status]>,
  },
};

/** The soma-work sessions screen on a phone: `old` = 0.27 (text rows), else 0.28 (avatars, chips, a filter). */
function phoneSvg(old: boolean, lang: 'en' | 'ko'): string {
  const s = PHONE[lang];
  const chipW = lang === 'ko' ? 12 : 6.6;
  let body = `${text(24, 30, '9:41', 13, C.ink, 600)}${rect(310, 20, 24, 11, 3, 'none', C.ink)}${rect(312, 22, 16, 7, 1.5, C.ink)}`;
  body += text(20, 78, s.head, 22, C.ink, 700);
  if (old) {
    s.rows.forEach(([title, owner, ago, st], i) => {
      const y = 100 + i * 84;
      body += rect(12.5, y + 0.5, 335, 72, 10, C.card, C.line);
      body += text(28, y + 30, title, 14, C.ink, 600);
      body += text(28, y + 52, `${owner} · ${s.status[st].toLowerCase()} · ${ago}`, 12, C.mid);
    });
  } else {
    body += `${rect(20, 92, 168, 30, 15, C.pill)}${rect(23, 95, 80, 24, 12, C.card)}${text(63, 111.5, s.all, 12, C.ink, 600, 'middle')}${text(146, 111.5, s.mine, 12, C.mid, 600, 'middle')}`;
    s.rows.forEach(([title, owner, ago, st], i) => {
      const y = 136 + i * 88;
      body += rect(12.5, y + 0.5, 335, 76, 12, C.card, C.line);
      body += `${dot(42, y + 38, 15, C.mid)}${text(42, y + 43, owner[0].toUpperCase(), 13, C.card, 700, 'middle')}`;
      body += text(68, y + 33, title, 14, C.ink, 600);
      body += text(68, y + 55, `${owner} · ${ago}`, 12, C.mid);
      body += chip(334, y + 14, s.status[st], st, chipW);
    });
    body += `${rect(20, 506, 320, 44, 22, C.accent)}${text(180, 533, `+  ${s.add}`, 14, C.card, 600, 'middle')}`;
  }
  body += `${rect(0, 584, 360, 56, 0, C.card)}${rect(0, 584, 360, 1, 0, C.line)}`;
  s.tabs.forEach((t, i) => {
    body += text(60 + i * 120, 616, t, 12, i === 0 ? C.ink : C.soft, 600, 'middle');
  });
  return svg(360, 640, body, C.screen);
}

const board = (old: boolean) => picture(`board-${old}`, () => boardSvg(old));
const phone = (old: boolean, lang: 'en' | 'ko' = 'en') => picture(`phone-${old}-${lang}`, () => phoneSvg(old, lang));

function compare(data: ImageCompareData, attrs: Record<string, string> = {}): UiImageCompare {
  const el = document.createElement('ui-image-compare');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

/** The element in a padded column, with a quiet line under it that echoes ui-change. */
function echoed(el: UiImageCompare, maxWidth: number, lang: 'en' | 'ko' = 'en'): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = `display:grid;gap:10px;padding:18px 20px;max-width:${maxWidth}px`;
  const line = document.createElement('p');
  line.className = 'ui-status-line';
  line.setAttribute('role', 'status');
  if (lang === 'ko') line.lang = 'ko';
  line.textContent = lang === 'ko' ? '선을 끌거나 튕겨 보세요' : 'Drag the line, or flick it';
  el.addEventListener('ui-change', (e) => {
    line.textContent = `ui-change → position ${(e as CustomEvent<ImageCompareChange>).detail.position.toFixed(2)}`;
  });
  box.append(el, line);
  return box;
}

const CARD_BEFORE = {
  alt: 'The board in 0.27: task cards with the owner and the status as plain text',
};
const CARD_AFTER = {
  alt: 'The board in 0.28: each card with an owner badge and a status chip',
};

export const doc: ComponentDoc = {
  slug: 'image-compare',
  name: 'Image Compare',
  tag: 'ui-image-compare',
  group: 'Components',
  summary: 'What a change did to a screen — the before and after in one box, split by a line the person drags.',
  description:
    'Two pictures of the same thing in one box: Before on the left of the line, After on the right. Press anywhere and the line jumps there and follows the pointer; let go with a flick and it glides on toward that edge (ease-out, 420ms) — a quick one reaches it. On touch the box scrolls the page vertically as usual and a sideways drag moves the line. The knob is a slider for the keyboard. The corner tags say Before and After (or the host’s labels: versions, branches, dates) and fade when the line comes near them. Pictures load lazily; a source that is not safe to load, or one that fails, shows “No preview” in its half. ui-change reports where the line settled — once per drag, glide or key press, never on every move.',
  usedIn:
    'soma-work: a UI change’s before and after — the agent’s QA screenshots of a page before the PR and after it, in the conversation’s artifacts and the PR QA report.',
  reference: { name: 'bencho.dev — Image compare (MIT)', url: 'https://bencho.dev/blocks/image-compare' },
  props: [
    {
      name: 'data.before / data.after',
      type: '{ src: string; alt: string; label?: string }',
      required: true,
      description:
        'The two pictures. src goes through safeSrc — http(s), relative, blob: and base64 raster data:image only; anything else draws “No preview”. alt says what the picture shows. label is its corner tag (default Before / After).',
    },
    {
      name: 'data.position / position',
      type: 'number 0 … 1',
      default: '0.5',
      description:
        'Where the line sits: the share of the box that shows Before, from the left. data wins over the attribute. After a person moves it the element keeps the new place in data.position.',
    },
    {
      name: 'data.ratio',
      type: 'string',
      default: '"16 / 10"',
      description: 'The box’s CSS aspect-ratio (“9 / 16”, “4 / 3”, “1.6”). Anything else is the default.',
    },
    {
      name: 'data.fit',
      type: '"cover" | "contain"',
      default: '"cover"',
      description: 'cover fills the box and crops; contain shows each picture whole.',
    },
    {
      name: 'lang',
      type: '"en" | "ko"',
      default: '"en"',
      description: 'Before / 이전, After / 이후, the slider’s name and “No preview”.',
    },
    {
      name: 'position (property)',
      type: 'number (read-only)',
      description: 'Where the line is now, mid-drag and mid-glide too.',
    },
    {
      name: '::part(box | before | after | tag | line | knob | none)',
      type: 'part',
      description: 'The box, the two layers, the corner tags, the line, the knob and the “No preview” placeholder.',
    },
    {
      name: 'comparePosition(clientX, rect) / compareGlide(position, velocity, width) / compareKey(key, position) / compareText(position, labels)',
      type: 'helpers',
      description:
        'Pure: the line under a pointer, where a release sends it (a flick faster than 0.5 px/ms glides as far as its speed carries it in 500ms), a key’s new place (null for other keys), the slider’s words.',
    },
  ],
  events: [
    {
      name: 'ui-change',
      detail: '{ position: number }',
      description:
        'The line came to rest somewhere new: a drag released, a glide ended, a key moved it. Once, never per move; not cancelable — it reports where the line is.',
    },
  ],
  keyboard: [
    ['← / →', 'Move the line 5% (↓ / ↑ too)'],
    ['Page Down / Page Up', 'Move it 20%'],
    ['Home / End', 'All After (0%) / all Before (100%)'],
  ],
  a11y: [
    'The knob is role="slider" named “Compare before and after” (이전과 이후 비교), 0 to 100, with aria-valuetext “Before 40% · After 60%” in the host’s labels. It takes focus when the box is pressed, so the keys carry on from there.',
    'Both pictures keep their alt text and are read in order, each after its tag; a picture that cannot be shown is an image named “<alt> — No preview”.',
    'touch-action: pan-y — on touch a vertical swipe scrolls the page and a sideways drag moves the line; a touch the page takes for a scroll puts the line back.',
    'Reduced motion: no glide — the line stays where it was let go — and the tags appear and fade at once.',
    'The knob is 36px (44px on a coarse pointer); the whole box takes the press.',
    'Sound (opt-in, @2lab.ai/ui/sound): a subtle tap when a click or a tap makes the line jump to it. Nothing while it is dragged or glides, and nothing for keys.',
  ],
  usage: `<ui-image-compare></ui-image-compare>
<script type="module">
  import '@2lab.ai/ui/image-compare';
  const cmp = document.querySelector('ui-image-compare');
  cmp.data = {
    before: { src: qa.before.url, alt: 'The board before the PR' },
    after: { src: qa.after.url, alt: 'The board after the PR' },
    ratio: '16 / 10',
  };
  cmp.addEventListener('ui-change', (e) => console.log(e.detail.position));   // once per drag, glide or key
</script>`,
  demos: [
    {
      id: 'card',
      title: 'A dashboard card, before and after',
      description:
        'The board’s task cards in 0.27 and in 0.28 (owner badge, status chip). Drag the line, press anywhere to jump it, flick it to an edge, or use the keys on the knob; the line echoes ui-change.',
      height: 500,
      create: () =>
        echoed(
          compare({
            before: { src: board(true), ...CARD_BEFORE },
            after: { src: board(false), ...CARD_AFTER },
          }),
          680,
        ),
    },
    {
      id: 'phone',
      title: 'A phone screen, two versions',
      description:
        'ratio 9 / 16 at position 0.3, with the host’s labels “0.27.0” and “0.28.0” on the tags — and in the slider’s words.',
      height: 560,
      create: () =>
        echoed(
          compare({
            before: { src: phone(true), alt: 'The sessions screen in 0.27.0: text rows', label: '0.27.0' },
            after: {
              src: phone(false),
              alt: 'The sessions screen in 0.28.0: avatars, status chips and a filter',
              label: '0.28.0',
            },
            position: 0.3,
            ratio: '9 / 16',
          }),
          300,
        ),
    },
    {
      id: 'ko',
      title: 'Korean, whole pictures',
      description:
        'lang="ko" with fit="contain": two phone screenshots shown whole in a 16 / 10 box; the tags say 이전 / 이후.',
      height: 440,
      create: () =>
        echoed(
          compare(
            {
              before: { src: phone(true, 'ko'), alt: '0.27의 세션 화면: 글자만 있는 목록' },
              after: { src: phone(false, 'ko'), alt: '0.28의 세션 화면: 아바타와 상태 칩, 필터' },
              fit: 'contain',
            },
            { lang: 'ko' },
          ),
          600,
          'ko',
        ),
    },
    {
      id: 'broken',
      title: 'A picture that cannot be shown',
      description:
        'The before source is javascript: — not safe to load — so its half says “No preview”; a picture that fails to load does the same. The other half still compares.',
      height: 440,
      create: () =>
        echoed(
          compare({
            before: { src: 'javascript:alert(1)', alt: 'The board before the PR' },
            after: { src: board(false), ...CARD_AFTER },
            position: 0.55,
          }),
          600,
        ),
    },
  ],
};
