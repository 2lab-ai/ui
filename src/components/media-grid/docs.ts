import type { ComponentDoc } from '../../docs/types';
import '../artifact-viewer/artifact-viewer';
import { demoImage } from '../file-card/demo';
import type { FileItem } from '../file-card/render';
import './media-grid';
import type { MediaGridData, MediaItem, MediaOpenDetail, UiMediaGrid } from './media-grid';

/** Five pictures drawn on a canvas at runtime (no network): screens, a chart, a photo. */
function pictures(lang: 'en' | 'ko' = 'en'): MediaItem[] {
  const ko = lang === 'ko';
  return [
    {
      id: 'p1',
      name: 'login.png',
      url: demoImage('screen'),
      alt: ko ? '오류가 뜬 로그인 화면' : 'The login screen with the error',
    },
    { id: 'p2', name: 'usage-chart.png', url: demoImage('chart') },
    { id: 'p3', name: 'IMG_4821.jpg', url: demoImage('photo') },
    { id: 'p4', name: 'settings.png', url: demoImage('screen', 640, 480) },
    { id: 'p5', name: 'usage-week.png', url: demoImage('chart', 800, 400) },
  ];
}

function grid(data: MediaGridData, attrs: Record<string, string> = {}): UiMediaGrid {
  const el = document.createElement('ui-media-grid');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

/** A grid with a quiet line under it that echoes ui-open; nothing opens anywhere. */
function echoed(el: UiMediaGrid, lang: 'en' | 'ko' = 'en'): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:grid;gap:10px;padding:18px 20px';
  const line = document.createElement('p');
  line.className = 'ui-status-line';
  line.setAttribute('role', 'status');
  el.addEventListener('ui-open', (e) => {
    const { id, index, item } = (e as CustomEvent<MediaOpenDetail>).detail;
    line.textContent = `ui-open → ${id} (index ${index}, ${item.name})`;
    if (lang === 'ko') line.lang = 'ko';
  });
  box.append(el, line);
  return box;
}

export const doc: ComponentDoc = {
  slug: 'media-grid',
  name: 'Media Grid',
  tag: 'ui-media-grid',
  summary: 'What pictures came with the message — a row of tiles, “+N” for the rest, each one a button that opens it.',
  description:
    'The images a person attached to an instruction (or an agent returned), as a row of 80px tiles — 40px with size="compact", for the open card’s instruction row and the pinned row. Past max (4) the last tile wears a “+N” veil for the pictures not shown; one picture on its own sits in a 280×200 box that shows it whole. Every tile is a button named by what it does (“Open image 2 of 5: login.png, and 3 more — the login screen with the error”); activating one sends a cancelable ui-open with the item and its index among all the pictures, and the host opens its viewer there — an <ui-artifact-viewer> takes the same list and pages through the rest. Images load lazily and decode off the main thread; a thumb that fails to load tries the picture itself (url) once, and one that fails shows “No preview” in its place. Hover is a border, press is the .97 scale, and the veil is the same dark wash on the picture in both themes.',
  usedIn:
    'soma-work dashboard conversation turns: a user’s image attachments (I-09) and the compact row in the open card (I-11).',
  reference: { name: 'Slack message attachments', url: 'https://slack.com' },
  group: 'Components',
  props: [
    {
      name: 'data.items',
      type: 'MediaItem[]',
      required: true,
      description:
        '`{ id, name?, url?, thumb?, alt? }` — the shape of a FileItem, so the same list opens an artifact viewer.',
    },
    {
      name: 'data.max / max',
      type: 'number',
      default: '4',
      description: 'Tiles shown; the last says “+N” for the rest.',
    },
    {
      name: 'data.single',
      type: 'boolean',
      default: 'true',
      description: 'One picture alone sits in a wide box that shows it whole (never when compact).',
    },
    { name: 'size', type: '"compact"', description: '40px tiles (44px on a coarse pointer), 6px corners.' },
    { name: 'lang', type: '"en" | "ko"', default: '"en"', description: 'The tiles’ names and “No preview”.' },
    {
      name: 'focus()',
      type: 'method',
      description: 'Focuses the tile opened last (else the first): where a viewer returns focus.',
    },
    {
      name: 'mediaLabel(item, pos, total, more, lang) / mediaShown / mediaSrc',
      type: 'helpers',
      description: 'Pure: a tile’s name, the tiles to draw and the “+N”, the source a tile may load.',
    },
  ],
  events: [
    {
      name: 'ui-open',
      detail: '{ id: string; index: number; item: MediaItem }',
      description: 'The person activated a tile (cancelable). `index` counts every item, shown or not.',
    },
  ],
  keyboard: [
    ['Tab', 'From tile to tile'],
    ['Enter / Space', 'Open the picture'],
  ],
  a11y: [
    'The tiles are a group named “N images”; each tile is a button named by its action, position and file name — with the picture’s alt text when there is one, and “and N more” on the veiled tile.',
    'The images themselves are decorative (alt=""): the name is on the button, so nothing is read twice.',
    'A thumb that fails to load gives way to the picture itself (url) once; a picture that fails says “No preview” in its tile; the button keeps its name.',
    'Sources go through safeSrc: http(s), relative, blob: and base64 data:image only — anything else draws “No preview”.',
    'Sound (opt-in, @2lab.ai/ui/sound): a tap when a tile opens, once ui-open is not prevented. Silent until the page turns sound on.',
  ],
  usage: `<ui-media-grid></ui-media-grid>
<ui-artifact-viewer tiles="none"></ui-artifact-viewer>
<script type="module">
  import '@2lab.ai/ui/media-grid';
  import '@2lab.ai/ui/artifact-viewer';
  const grid = document.querySelector('ui-media-grid');
  const viewer = document.querySelector('ui-artifact-viewer');
  grid.data = { items: files.filter((f) => f.kind === 'image') };     // { id, name, url, thumb?, alt? }
  grid.addEventListener('ui-open', (e) => viewer.open(grid.data.items, e.detail.index, grid));
</script>`,
  demos: [
    {
      id: 'grid',
      title: 'Five pictures',
      description: 'Four tiles and a “+1” on the last; the line echoes ui-open with the index among all five.',
      height: 220,
      create: () => echoed(grid({ items: pictures() })),
    },
    {
      id: 'single',
      title: 'One picture',
      description: 'A picture on its own sits in a wide box that shows it whole.',
      height: 300,
      create: () => echoed(grid({ items: pictures().slice(2, 3) })),
    },
    {
      id: 'compact',
      title: 'Compact',
      description:
        'size="compact": 40px tiles for the open card’s instruction row; the same “+N”, no wide box for one.',
      height: 200,
      create: () => {
        const box = document.createElement('div');
        box.style.cssText = 'display:grid;gap:14px;padding:18px 20px';
        const row = (label: string, el: UiMediaGrid) => {
          const p = document.createElement('div');
          p.style.cssText = 'display:flex;align-items:center;gap:10px;font-size:13px;color:var(--ui-ib-text-2)';
          const w = document.createElement('span');
          w.style.cssText = 'min-width:120px;color:var(--ui-ib-muted)';
          w.textContent = label;
          p.append(w, el);
          return p;
        };
        box.append(
          row('Five, compact', grid({ items: pictures() }, { size: 'compact' })),
          row('Two, max 1', grid({ items: pictures().slice(0, 2), max: 1 }, { size: 'compact' })),
          row('One, compact', grid({ items: pictures().slice(0, 1) }, { size: 'compact' })),
        );
        return box;
      },
    },
    {
      id: 'viewer',
      title: 'With the artifact viewer',
      description:
        'ui-open → viewer.open(items, index, grid): the lightbox opens at that picture and pages through the rest; focus comes back to the tile.',
      height: 220,
      create: () => {
        const items = pictures();
        const el = grid({ items });
        const viewer = document.createElement('ui-artifact-viewer');
        viewer.setAttribute('tiles', 'none');
        const files: FileItem[] = items.map((i) => ({ id: i.id, name: i.name ?? 'image', kind: 'image', url: i.url }));
        el.addEventListener('ui-open', (e) => {
          const { index } = (e as CustomEvent<MediaOpenDetail>).detail;
          viewer.open(files, index, el);
        });
        const box = echoed(el);
        box.append(viewer);
        return box;
      },
    },
    {
      id: 'ko',
      title: 'Korean, and a picture that failed',
      description: 'lang="ko": 이미지 열기 2/5, 외 1개, 미리보기 불가 — the third picture’s source is not a picture.',
      height: 220,
      create: () => {
        const items = pictures('ko');
        // A source the page may load that is not a picture: the tile shows "No preview" once the image fails.
        items[2] = { ...items[2], url: 'data:image/png;base64,AAAA' };
        return echoed(grid({ items }, { lang: 'ko' }), 'ko');
      },
    },
  ],
};
