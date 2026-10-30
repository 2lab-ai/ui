import type { ComponentDoc } from '../../docs/types';
import { demoFiles, demoPhoto } from './demo';
import './file-card';
import type { FileOpenDetail, FilePlayDetail, UiFileCard } from './file-card';
import type { FileCardVariant, FileItem } from './render';

function card(item: FileItem, variant: FileCardVariant, lang = 'en'): UiFileCard {
  const el = document.createElement('ui-file-card');
  el.setAttribute('variant', variant);
  if (lang !== 'en') el.setAttribute('lang', lang);
  el.data = item;
  return el;
}

/**
 * Tiles in a grid that sizes them (`--fc-tile-w: 100%`, two columns on a phone), chips in a wrapping row, rows in a
 * column — plus a quiet line echoing ui-open; nothing opens anywhere.
 */
function gallery(items: FileItem[], variant: FileCardVariant, lang = 'en'): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:grid;gap:12px;width:100%';
  const list = document.createElement('div');
  list.style.cssText =
    variant === 'row'
      ? 'display:grid;gap:6px;width:100%;max-width:440px;margin:0 auto'
      : variant === 'tile'
        ? '--fc-tile-w:100%;display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px;width:100%'
        : 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center';
  for (const it of items) list.append(card(it, variant, lang));
  const line = document.createElement('p');
  line.className = 'ui-status-line';
  line.setAttribute('role', 'status');
  line.style.textAlign = 'center';
  box.addEventListener('ui-open', (e) => {
    const { id } = (e as CustomEvent<FileOpenDetail>).detail;
    const name = items.find((x) => x.id === id)?.name ?? id;
    line.textContent = `ui-open → ${id} (${name})`;
  });
  box.append(list, line);
  return box;
}

/**
 * The same voice note as a tile, a row and a chip, each `playable`: press play on one and the one before stops.
 * The line echoes ui-play and ui-open.
 */
function playInPlace(lang = 'en'): HTMLElement {
  const memo = demoFiles(lang === 'ko' ? 'ko' : 'en').find((f) => f.id === 'memo') as FileItem;
  const box = document.createElement('div');
  box.style.cssText = 'display:grid;gap:14px;width:100%;max-width:440px;margin:0 auto';
  const top = document.createElement('div');
  top.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:12px';
  const tile = card({ ...memo, id: 'memo-tile' }, 'tile', lang);
  const chip = card({ ...memo, id: 'memo-chip' }, 'chip', lang);
  const row = card({ ...memo, id: 'memo-row', meta: lang === 'ko' ? '음성 메모' : 'Voice note' }, 'row', lang);
  for (const el of [tile, chip, row]) el.setAttribute('playable', '');
  top.append(tile, chip);
  const line = document.createElement('p');
  line.className = 'ui-status-line';
  line.setAttribute('role', 'status');
  box.addEventListener('ui-play', (e) => {
    const d = (e as CustomEvent<FilePlayDetail>).detail;
    line.textContent = `ui-play → ${d.id} ${d.playing ? 'play' : 'pause'}`;
  });
  box.addEventListener('ui-open', (e) => {
    line.textContent = `ui-open → ${(e as CustomEvent<FileOpenDetail>).detail.id}`;
  });
  box.append(top, row, line);
  return box;
}

/**
 * The same tiles in a tall and a short panel, one host rule: `@container` on the panel's height hides the thumbnail
 * and the meta line through `::part`, so a short panel shows name cards (drag a panel's corner to change it).
 */
function containerHook(): HTMLElement {
  const box = document.createElement('div');
  box.className = 'fc-cq-demo';
  box.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;width:100%';
  const style = document.createElement('style');
  style.textContent = `.fc-cq-demo .fc-cq { container: fcq / size; resize: vertical; overflow: auto; min-height: 120px;
  padding: 12px; border-radius: 12px; background: var(--ui-surface); box-shadow: 0 0 0 1px var(--ui-ib-card-border); }
.fc-cq-demo .fc-cq-list { display: flex; flex-wrap: wrap; gap: 8px; }
@container fcq (max-height: 220px) {
  .fc-cq-demo ui-file-card::part(thumb), .fc-cq-demo ui-file-card::part(meta) { display: none; }
}`;
  box.append(style);
  for (const h of [300, 170]) {
    const panel = document.createElement('div');
    panel.className = 'fc-cq';
    panel.style.height = `${h}px`;
    const list = document.createElement('div');
    list.className = 'fc-cq-list';
    for (const it of demoFiles().slice(0, 3)) list.append(card(it, 'tile'));
    panel.append(list);
    box.append(panel);
  }
  return box;
}

/**
 * The final answer says “Answer” instead of Markdown (kindLabel); a file only Slack keeps is dimmed by one page
 * rule on its thumbnail part, and says so on its meta line.
 */
function ownWords(): HTMLElement {
  const now = Date.now();
  const box = gallery(
    [
      { id: 'answer', name: 'final-answer.md', kindLabel: 'Answer', size: 4_120, time: now - 60_000, text: '# Done' },
      { id: 'slack', name: 'customer-call.m4a', size: 2_480_000, time: now - 41 * 60_000, meta: 'Only in Slack' },
      { id: 'plan', name: 'plan.md', size: 1_900, time: now - 9 * 60_000, text: '# Plan' },
    ],
    'tile',
  );
  const style = document.createElement('style');
  style.textContent = 'ui-file-card.is-remote::part(thumb) { opacity: 0.5; filter: grayscale(1); }';
  box.prepend(style);
  box.querySelectorAll('ui-file-card')[1]?.classList.add('is-remote');
  return box;
}

/** A PNG header with no image data: the browser fails to decode it, so the card falls back to its glyph. */
const BROKEN_PNG = 'data:image/png;base64,iVBORw0KGgo=';

export const doc: ComponentDoc = {
  slug: 'file-card',
  name: 'File Card',
  tag: 'ui-file-card',
  group: 'Components',
  summary: 'What is this file? — its kind, name, size and age at a glance, one press from opening it.',
  description:
    'One file as a thumbnail tile, a list row or a small chip. Images show their thumbnail; every other kind shows its glyph on a soft wash of the kind’s tint with the extension in the corner, so a page of mixed files stays calm and scannable. The meta line folds size and age together (“12.4 KB · 5m ago”). The whole card is one button: activating it sends ui-open and the host decides what opening means — a viewer, a new tab, a download. A thumbnail that fails to load falls back to the glyph. The same markup (fileCardHtml + fileCardStyles) draws the tiles inside Artifact Viewer.',
  usedIn:
    'soma-work dashboard › artifact strip tiles and attachment chips (I-01…I-03): thumbnails, kind glyphs, size and time',
  reference: { name: 'WAI-ARIA APG Button', url: 'https://www.w3.org/WAI/ARIA/apg/patterns/button/' },
  props: [
    {
      name: 'data',
      type: 'FileItem',
      required: true,
      description:
        'The file: { id, name, kind?, kindLabel?, mime?, size?, time?, url?, thumb?, text?, meta?, downloadName?, actions? }. Only id and name are needed. Nothing renders without data.',
    },
    { name: 'data.id', type: 'string', required: true, description: 'Echoed as detail.id in ui-open.' },
    {
      name: 'data.name',
      type: 'string',
      required: true,
      description: 'File name (wraps to two lines on a tile, ellipsis on rows and chips). Empty → the kind word.',
    },
    {
      name: 'data.kind',
      type: "'image' | 'audio' | 'video' | 'markdown' | 'html' | 'pdf' | 'code' | 'text' | 'file'",
      description: 'Wins over mime and the extension. Without it the kind comes from mime, else the extension.',
    },
    {
      name: 'data.kindLabel',
      type: 'string',
      description:
        'The kind word to say instead of the kind’s own — “Answer” for the final markdown answer. Used in the card’s name, for a nameless file, and by Artifact Viewer’s badge and peek. The glyph and tint stay the kind’s.',
    },
    { name: 'data.mime', type: 'string', description: 'MIME type, used for the kind when kind is missing.' },
    { name: 'data.size', type: 'number', description: 'Bytes, drawn as 12.4 KB / 3.1 MB (tabular).' },
    {
      name: 'data.time',
      type: 'number',
      description: 'When it was made, ms epoch — drawn as “5m ago” / “5분 전”.',
    },
    {
      name: 'data.thumb',
      type: 'string',
      description:
        'Image thumbnail source (else url for images). http(s), relative, blob: and base64 raster data:image/… only; anything else draws the glyph.',
    },
    {
      name: 'data.url',
      type: 'string',
      description:
        'The file itself (Artifact Viewer opens / downloads it; the card only uses it as an image fallback).',
    },
    { name: 'data.meta', type: 'string', description: 'One extra quiet line on tiles and rows (“from Build agent”).' },
    {
      name: 'variant',
      type: "'tile' | 'row' | 'chip'",
      default: "'tile'",
      description: 'Attribute (and property). tile — thumbnail card · row — one line in a list · chip — a pill.',
    },
    {
      name: '::part(card | thumb | glyph | text | name | meta | sub | ext)',
      type: 'CSS parts',
      description:
        'The card’s pieces, for your own rules: card (the button), thumb (a tile’s thumbnail, a row’s box), glyph (a chip’s), text, name, meta, sub (the extra line), ext (the extension tag). Hide thumbnails in a short panel with a container query, dim a file you only link to. A playable card adds play, progress and video.',
    },
    {
      name: '--fc-tile-w',
      type: 'CSS custom property',
      default: '148px',
      description: 'A tile’s width. Set 100% to let a grid size it.',
    },
    {
      name: 'playable',
      type: 'boolean attribute',
      description:
        'An audio file (any variant) or a video tile with a playable url gets a play / pause toggle beside the card — over a tile’s thumbnail (bottom right, a progress line along its foot, the video itself in place), at a row’s end, after a chip — and plays in place. One card plays at a time on the page; nothing loads before the first press.',
    },
    {
      name: 'focus()',
      type: 'method',
      description:
        'Focuses the card’s button — so viewer.open(items, i, card) returns focus to the card and a page can focus it without reaching into the shadow root.',
    },
    {
      name: 'play() · pause() · playing',
      type: 'methods · boolean (read-only)',
      description:
        'Play or pause in place without ui-play (a playable card only); playing is true while it plays. Pause the card when your viewer opens the same file.',
    },
    { name: 'lang', type: "'en' | 'ko'", default: "'en'", description: 'Kind words and relative time (attribute).' },
    {
      name: 'theme',
      type: "'light' | 'dark'",
      description: 'Pins the palette (attribute). Default follows prefers-color-scheme or page tokens.',
    },
  ],
  events: [
    {
      name: 'ui-open',
      detail: '{ id: string }',
      description:
        'The card was activated (click, Enter, Space). The card has no default action of its own: open a viewer, a tab or a download.',
    },
    {
      name: 'ui-play',
      detail: '{ id: string; playing: boolean; url: string }',
      description:
        'The play toggle was pressed; playing is the state it asks for. Cancelable: preventDefault() keeps the card as it is (play it in your own player).',
    },
  ],
  keyboard: [
    ['Tab', 'Focus the card, then its play toggle (playable)'],
    ['Enter / Space', 'Open it (ui-open); on the toggle, play / pause (ui-play)'],
  ],
  a11y: [
    'The whole card is one native <button>, named “report.png, Image, 12.4 KB · 5m ago, from Build agent” — name, kind word, meta and the extra line.',
    'Thumbnails are decorative (alt="") because the button’s name already says what the file is; the glyph is hidden from screen readers too.',
    'Kind is never colour alone: the glyph and the extension tag carry it, the wash only tints.',
    'Every string is escaped; image sources pass safeSrc (no javascript:, no data:text/html).',
    'Focus ring 2px; chips grow to 44px on coarse pointers; press scales to .97; hover changes the border only, on fine pointers.',
    'The play toggle is its own button next to the card (never inside it), named “Play standup.wav” / “Pause standup.wav” (ko: “… 재생” / “… 일시정지”); 32px drawn, 44px to the touch; ink while it plays. The progress line is decorative.',
    'Sound (opt-in, @2lab.ai/ui/sound): a tap when the person opens the file (unless ui-open is cancelled); the play toggle plays toggle (forward to play, back to pause). Silent until the page turns sound on.',
  ],
  usage: `<ui-file-card id="f"></ui-file-card>
<ui-file-card variant="row" id="g"></ui-file-card>
<script type="module">
  import '@2lab.ai/ui/file-card';
  const card = document.getElementById('f');
  card.data = {
    id: 'shot',
    name: 'checkout-flow.png',
    size: 184320,
    time: Date.now() - 120000,
    thumb: '/files/checkout-flow.thumb.png',
    url: '/files/checkout-flow.png',
  };
  card.addEventListener('ui-open', (e) => viewer.open(e.detail.id));

  // Or draw many from one renderer inside your own element:
  // import { fileCardHtml, fileCardStyles } from '@2lab.ai/ui/file-card';
</script>`,
  demos: [
    {
      id: 'tiles',
      title: 'Tiles',
      description:
        'Eight files a run left behind: images show their thumbnail, every other kind its glyph on a soft wash with the extension. Press one — the line echoes ui-open.',
      height: 460,
      create: () => gallery([...demoFiles(), demoPhoto()], 'tile'),
    },
    {
      id: 'rows',
      title: 'Rows',
      description: 'variant="row": a glyph tile (or the image), the name and “size · age · meta” on one line each.',
      height: 460,
      create: () => gallery(demoFiles().slice(0, 6), 'row'),
    },
    {
      id: 'chips',
      title: 'Chips',
      description: 'variant="chip": a pill with the glyph and the name — for attachments inside a message.',
      height: 220,
      create: () => gallery(demoFiles(), 'chip'),
    },
    {
      id: 'fallback',
      title: 'Thumbnail fallback',
      description:
        'The first thumbnail cannot be decoded, so the card draws the image glyph instead; the second has no name and shows the kind word.',
      height: 300,
      create: () => {
        const now = Date.now();
        return gallery(
          [
            { id: 'broken', name: 'scan-0042.png', size: 412_000, time: now - 40 * 60_000, thumb: BROKEN_PNG },
            { id: 'nameless', name: '', kind: 'pdf', size: 88_000, time: now - 3 * 3_600_000 },
            { id: 'plain', name: 'requirements.txt', size: 640, time: now - 26 * 3_600_000 },
          ],
          'tile',
        );
      },
    },
    {
      id: 'own-words',
      title: 'Kind word and dimming',
      description:
        'kindLabel: the final answer says Answer, not Markdown (its name reads “final-answer.md, Answer, …”). A file only Slack keeps is dimmed by one page rule — ui-file-card.is-remote::part(thumb) { opacity: .5 } — and says so on its meta line.',
      height: 300,
      create: () => ownWords(),
    },
    {
      id: 'container',
      title: 'Container hook',
      description:
        'The same three tiles in a tall and a short panel. One page rule — @container (max-height: 220px) { ui-file-card::part(thumb), ::part(meta) { display: none } } — turns the short panel’s tiles into name cards. Drag a panel’s corner.',
      height: 340,
      create: () => containerHook(),
    },
    {
      id: 'play',
      title: 'Play in place',
      description:
        'playable: the voice note as a tile, a chip and a row. Press play on one — the one playing before stops. The card itself still opens (ui-open).',
      height: 330,
      create: () => playInPlace(),
    },
    {
      id: 'ko',
      title: '한국어 (lang="ko")',
      description: '종류 이름과 상대 시간이 한국어로 바뀌어요.',
      height: 460,
      create: () => gallery(demoFiles('ko').slice(0, 6), 'tile', 'ko'),
    },
  ],
};
