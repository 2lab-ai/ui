import type { ComponentDoc } from '../../docs/types';
import { demoFiles, demoPhoto } from '../file-card/demo';
import '../file-card/file-card';
import type { FileOpenDetail, UiFileCard } from '../file-card/file-card';
import type { FileItem } from '../file-card/render';
import './artifact-viewer';
import type {
  ArtifactActionDetail,
  ArtifactCloseDetail,
  ArtifactOpenDetail,
  ArtifactViewDetail,
  ArtifactViewerData,
  UiArtifactViewer,
} from './artifact-viewer';

/**
 * One viewer over the page's own cards: two groups of <ui-file-card> (an answer's chips, the attachments' tiles)
 * and a <ui-artifact-viewer tiles="none"> that pages through all of them, whichever card opened it.
 */
function overHost(): HTMLElement {
  const all = demoFiles();
  const viewer = make({ items: [] }, { tiles: 'none' });
  const group = (title: string, items: FileItem[], variant: 'chip' | 'tile') => {
    const box = document.createElement('section');
    box.style.cssText = 'display:flex;flex-direction:column;gap:8px;min-width:0';
    const h = document.createElement('h4');
    h.textContent = title;
    h.style.cssText = 'margin:0;font-size:12px;font-weight:500;color:var(--ui-text-tertiary)';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
    for (const it of items) {
      const card = document.createElement('ui-file-card') as UiFileCard;
      card.setAttribute('variant', variant);
      card.data = it;
      row.append(card);
    }
    box.append(h, row);
    return box;
  };
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:16px;width:100%;min-width:0';
  wrap.append(group('In this answer', all.slice(0, 3), 'chip'), group('Attachments', all.slice(3), 'tile'));
  wrap.addEventListener('ui-open', (e) => {
    const card = e.target as UiFileCard;
    if (card.tagName !== 'UI-FILE-CARD') return;
    const { id } = (e as CustomEvent<FileOpenDetail>).detail;
    viewer.open(
      all,
      all.findIndex((f) => String(f.id) === id),
      card,
    );
  });
  const { box } = stage(viewer);
  box.prepend(wrap);
  return box;
}

function make(data: ArtifactViewerData, attrs: Record<string, string> = {}): UiArtifactViewer {
  const el = document.createElement('ui-artifact-viewer');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

type Say = (name: string, detail: unknown, items: FileItem[]) => string;

const nameOf = (items: FileItem[], id: string) => items.find((f) => String(f.id) === id)?.name || id;

const SAY_EN: Say = (name, d, items) => {
  if (name === 'ui-open') return `ui-open → ${(d as ArtifactOpenDetail).id}`;
  if (name === 'ui-view') {
    const v = d as ArtifactViewDetail;
    return `ui-view → ${nameOf(items, v.id)} (${v.index + 1} / ${items.length})`;
  }
  if (name === 'ui-close') return `ui-close → ${(d as ArtifactCloseDetail).reason}`;
  const a = d as ArtifactActionDetail;
  if (a.extra)
    return `ui-action → ${a.action} on ${nameOf(items, a.id)}${a.url ? ` (${a.url})` : ''} — the host's own action`;
  return `ui-action → ${a.action} ${a.url} — prevented: the demo files live nowhere`;
};

const SAY_KO: Say = (name, d, items) => {
  if (name === 'ui-open') return `열기: ${nameOf(items, (d as ArtifactOpenDetail).id)}`;
  if (name === 'ui-view') {
    const v = d as ArtifactViewDetail;
    return `보는 중: ${nameOf(items, v.id)} (${v.index + 1} / ${items.length})`;
  }
  if (name === 'ui-close') return '뷰어를 닫았어요';
  const a = d as ArtifactActionDetail;
  if (a.extra) return `${a.action}: ${nameOf(items, a.id)} — 호스트가 처리해요`;
  return `${a.action === 'download' ? '다운로드' : '새 탭에서 열기'}: ${a.url} — 데모라서 막았어요`;
};

/**
 * The viewer plus a quiet line echoing what it sent. Open in new tab / Download are always taken over: the demo
 * files have no server behind them, so nothing here ever leaves the page.
 */
function stage(el: UiArtifactViewer, say: Say = SAY_EN): { box: HTMLElement; line: HTMLElement } {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:10px;width:100%;min-width:0';
  const line = document.createElement('p');
  line.className = 'ui-status-line';
  line.setAttribute('role', 'status');
  for (const name of ['ui-open', 'ui-view', 'ui-close', 'ui-action']) {
    el.addEventListener(name, (e) => {
      if (name === 'ui-action') e.preventDefault();
      line.textContent = say(name, (e as CustomEvent).detail, el.data?.items ?? []);
    });
  }
  box.append(el, line);
  return { box, line };
}

const MIN = 60_000;

/**
 * The run's files with the page's own actions: every file opens in Slack (its permalink), the log can be copied,
 * and one file lives only in Slack (no url: no Open / Download, so its Slack link leads in ink).
 */
function withActions(): FileItem[] {
  const slack = (id: string) => ({
    id: 'slack',
    label: 'Slack',
    icon: 'chat' as const,
    href: `https://example.slack.com/files/U0/${id}`,
  });
  const files = demoFiles().map((f) => ({
    ...f,
    actions: f.id === 'log' ? [slack(f.id), { id: 'copy', label: 'Copy', icon: 'copy' as const }] : [slack(f.id)],
  }));
  files.push({
    id: 'slack-only',
    name: 'customer-call.m4a',
    size: 2_480_000,
    time: Date.now() - 41 * MIN,
    meta: 'Only in Slack',
    actions: [{ id: 'slack', label: 'Open in Slack', icon: 'chat', href: 'https://example.slack.com/files/U0/call' }],
  });
  return files;
}

/** A page that draws its chart by script: nothing shows without one, so the viewer must run it. */
const CHART_PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:28px 32px;font:15px/1.5 system-ui,sans-serif;color:#18181b;background:#fff}
h1{margin:0 0 4px;font-size:20px}p{margin:0 0 20px;color:#555}
.bars{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;align-items:end;height:200px}
.bar{display:flex;flex-direction:column;justify-content:flex-end;height:100%;gap:6px;font-size:12px;color:#555;text-align:center}
.bar i{display:block;border-radius:8px 8px 0 0;background:#2f63e0;transition:height .5s ease}
</style></head><body><h1>Weekly signups</h1><p id="note">This page draws its chart by script.</p><div class="bars" id="bars"></div>
<script>
const data=[["9/28",1204],["10/5",1318],["10/12",1290],["10/19",1452],["10/26",1511]];
const max=Math.max(...data.map(d=>d[1]));const bars=document.getElementById('bars');
for(const [w,n] of data){const b=document.createElement('div');b.className='bar';const i=document.createElement('i');i.style.height='0';b.append(i,n.toLocaleString(),w);bars.append(b);requestAnimationFrame(()=>{i.style.height=(n/max*160)+'px'});}
document.getElementById('note').textContent='Drawn by the page’s own script — '+data.length+' weeks, '+data.reduce((a,d)=>a+d[1],0).toLocaleString()+' signups.';
</script></body></html>`;

const SIGNUPS = `week,signups,activated,rate
2026-09-28,1204,688,57%
2026-10-05,1318,779,59%
2026-10-12,1290,801,62%
2026-10-19,1452,930,64%
2026-10-26,1511,998,66%`;

const ERRORS = `endpoint,p95 ms,errors,share
/api/export,1840,312,41%
/api/search,620,188,25%
/api/upload,1130,141,19%
/api/auth,240,64,8%
/api/billing,410,52,7%`;

/** Two CSV exports the host renders itself (a table in slot="preview"). */
function csvFiles(): FileItem[] {
  const now = Date.now();
  return [
    { id: 'signups', name: 'weekly-signups.csv', mime: 'text/csv', size: 1_320, time: now - 3 * MIN, text: SIGNUPS },
    {
      id: 'errors',
      name: 'errors-by-endpoint.csv',
      mime: 'text/csv',
      size: 2_048,
      time: now - 8 * MIN,
      text: ERRORS,
      meta: 'from Monitoring agent',
    },
  ];
}

/** The host's own body: a CSV as a table, built with textContent (no markup from the file ever reaches the DOM). */
function csvTable(text: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'padding:24px 28px;overflow:auto';
  const table = document.createElement('table');
  table.style.cssText =
    'border-collapse:collapse;margin:0 auto;font-size:13.5px;font-variant-numeric:tabular-nums;color:var(--ui-text)';
  const rows = text.trim().split('\n');
  rows.forEach((row, r) => {
    const tr = document.createElement('tr');
    for (const cell of row.split(',')) {
      const td = document.createElement(r === 0 ? 'th' : 'td');
      td.textContent = cell;
      td.style.cssText = `padding:8px 14px;border-bottom:1px solid var(--ui-border);text-align:${
        /^[\d.,%]+$/.test(cell) ? 'right' : 'left'
      };${r === 0 ? 'font-weight:600;color:var(--ui-text-secondary)' : ''}`;
      tr.append(td);
    }
    table.append(tr);
  });
  wrap.append(table);
  return wrap;
}

export const doc: ComponentDoc = {
  slug: 'artifact-viewer',
  name: 'Artifact Viewer',
  tag: 'ui-artifact-viewer',
  group: 'Components',
  summary:
    'What did the agent make? — every file a run left behind as a tile, a peek on hover, and the whole file one click away.',
  description:
    'The files an agent made — screenshots, reports, pages, code, logs, recordings — as a scrolling strip of tiles, or a grid, chips or a list. Rest the pointer on a tile and a larger peek shows the picture, the head of the document or a small copy of the page. Click, Enter or Space opens the file in a large dialog: an image fits the panel and zooms to 1:1, markdown reads as a document, text and code keep their lines, an HTML page renders in a sandboxed frame with scripts off (on, for a page the host vouches for), a PDF opens in the browser’s own viewer, audio and video play with native controls, and anything else gets a calm card with Download. ← / → step through the files without closing, Home / End jump, Esc closes and focus goes back to the tile. Open in new tab and Download are real links the host can take over. The component never fetches: text arrives inline, media by URL.',
  usedIn: 'soma-work dashboard › artifact strip, hover peek and viewer (I-01…I-08)',
  reference: { name: 'WAI-ARIA APG Dialog (Modal)', url: 'https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/' },
  props: [
    {
      name: 'data.items',
      type: 'FileItem[]',
      required: true,
      description:
        'The files, in the order to show them (newest first is usual). Each needs id and name; items without an id are dropped. The kind (kind, else mime, else the extension) and the content it carries pick the viewer body.',
    },
    {
      name: 'data.items[].id',
      type: 'string',
      required: true,
      description:
        'Echoed in every event. Keeps the tile’s node across updates, and keeps the viewer on the same file when new files arrive before it.',
    },
    {
      name: 'data.items[].name',
      type: 'string',
      required: true,
      description: 'File name: the tile label, the viewer title and the Download name. Empty → the kind word.',
    },
    {
      name: 'data.items[].kind',
      type: "'image' | 'audio' | 'video' | 'markdown' | 'html' | 'pdf' | 'code' | 'text' | 'file'",
      description: 'Wins over mime and the extension.',
    },
    {
      name: 'data.items[].kindLabel',
      type: 'string',
      description:
        'The kind word for the badge, the peek and the tile’s name instead of the kind’s own (“Answer” for the final answer). Glyph and tint stay the kind’s.',
    },
    { name: 'data.items[].mime', type: 'string', description: 'MIME type, used for the kind when kind is missing.' },
    { name: 'data.items[].size', type: 'number', description: 'Bytes, drawn as 12.4 KB (tabular).' },
    {
      name: 'data.items[].time',
      type: 'number',
      description: 'When it was made, ms epoch — drawn as “5m ago” / “5분 전”.',
    },
    {
      name: 'data.items[].url',
      type: 'string',
      description:
        'The file: the image, audio or video source, and the target of Open in new tab and Download. Media takes http(s), relative, blob: or base64 raster data:image/…; links take http(s) or a same-site path. Anything else is dropped — no javascript:, no data:text/html.',
    },
    {
      name: 'data.items[].thumb',
      type: 'string',
      description: 'Image thumbnail for the tile (else url). The viewer and the peek use url first.',
    },
    {
      name: 'data.items[].text',
      type: 'string',
      description:
        'Inline content: markdown (escaped, then marked up), text or code (as is, up to 1M characters), or an HTML page — the srcdoc of a sandbox="" frame, never put in the DOM.',
    },
    {
      name: 'data.items[].scripts',
      type: 'boolean',
      default: 'false',
      description:
        'html: the page runs its own scripts — the viewer’s and the peek’s frames get sandbox="allow-scripts" (never same-origin: no cookies, no storage, no reach into your page); the note reads “Runs its own scripts”. Only for a page you trust — the chart or small app the model wrote.',
    },
    {
      name: 'kind: "pdf"',
      type: 'body',
      description:
        'A PDF with a url opens in the browser’s own viewer (the url framed as is — a sandbox would turn the viewer off); without a url, the calm card.',
    },
    { name: 'data.items[].meta', type: 'string', description: 'One extra quiet line (“from Build agent”).' },
    { name: 'data.items[].downloadName', type: 'string', description: 'File name for Download. Default: name.' },
    {
      name: 'data.items[].actions',
      type: 'Array<{ id: string; label: string; icon?: IconName; href?: string }>',
      description:
        'Extra actions after Open in new tab / Download — the file’s Slack permalink, Copy link, Retry. With a safe href (http(s), mailto, relative) a link to a new tab, else a button; both send ui-action with action = id and extra: true. Ids open / download are skipped, the first of each id counts, at most 4. Without an icon the action keeps its words on phones. A file with no url of its own shows them on its card, the first one in ink.',
    },
    {
      name: 'data.layout',
      type: "'strip' | 'grid' | 'chips' | 'list' | 'none'",
      default: "'strip'",
      description:
        'strip — one scrolling row with snap and edge fades · grid — tiles of at least 132px · chips — wrapping name pills · list — rows with size and age · none — no tiles, no title: only the viewer, opened over your own cards with open(items, index, opener).',
    },
    {
      name: 'tiles',
      type: "'none'",
      description:
        'Attribute: tiles="none" is layout none — the element draws nothing in the page; its viewer opens over the host’s cards.',
    },
    {
      name: 'data.title',
      type: 'string',
      description:
        'Label above the files with a count; it names the list (else “Files”). With no items the title stays and says “No files yet”; with neither, nothing renders.',
    },
    {
      name: 'data.index',
      type: 'number',
      description:
        'Host-controlled open, applied once per assignment: a valid index opens (or moves) the viewer there, -1 closes it, undefined leaves it as the person left it. Clear it on ui-close.',
    },
    { name: 'data.peek', type: 'boolean', default: 'true', description: 'Hover peek on mouse and pen.' },
    {
      name: 'data.download',
      type: 'boolean',
      default: 'true',
      description: 'Show Download when the file has a safe url.',
    },
    {
      name: 'data.openInTab',
      type: 'boolean',
      default: 'true',
      description: 'Show Open in new tab when the file has a safe url.',
    },
    {
      name: 'slot="preview"',
      type: 'slot',
      description:
        'Your own body for the shown file (a CSV table, a PDF viewer). While it is there it replaces the built-in body; swap its content on ui-view.',
    },
    { name: 'index', type: 'number (read-only)', description: 'The file the viewer shows, -1 while it is closed.' },
    {
      name: 'open(index) · next() · prev() · close()',
      type: 'methods',
      description:
        'Open at a file, step (held at the ends), close with the exit motion. They send ui-view for the shown file, never ui-open or ui-close.',
    },
    {
      name: 'open(items, index?, opener?)',
      type: 'method',
      description:
        'Open over a list of your own — every file of a conversation, an instruction’s attachments — at index (default 0). The list becomes data.items (the rest of the data stays; an old data.index never reopens); Previous / Next, the kind badge and Open / Download page through it. opener (your card or button) takes focus back on close. Called while open, it swaps the list and shows index.',
    },
    { name: 'lang', type: "'en' | 'ko'", default: "'en'", description: 'UI language (attribute).' },
    {
      name: 'theme',
      type: "'light' | 'dark'",
      description:
        'Pins the palette (attribute), the viewer included. Default follows prefers-color-scheme or page tokens.',
    },
  ],
  events: [
    {
      name: 'ui-open',
      detail: '{ id: string; index: number }',
      description:
        'A tile (or the peek) was activated by click, Enter or Space. Cancelable: preventDefault() keeps the viewer closed — open your own view instead.',
    },
    {
      name: 'ui-view',
      detail: '{ id: string; index: number }',
      description:
        'Notification: the viewer now shows this file — on open, on a step (buttons, arrows, Home / End, next() / prev()), or when new data moved the shown file. Swap a slotted preview here.',
    },
    {
      name: 'ui-close',
      detail: "{ reason: 'escape' | 'scrim' | 'close-button' }",
      description:
        'The person asked to close the viewer. Cancelable: preventDefault() keeps it open (unsaved notes, say). close() sends nothing.',
    },
    {
      name: 'ui-action',
      detail: "{ action: 'open' | 'download' | string; id: string; url: string; extra?: true }",
      description:
        'Open in new tab or Download was pressed — or one of the file’s own actions (action = its id, extra: true; url is its link, or empty for a button); id is the file’s. url is the safe link it follows. Cancelable: preventDefault() stops the link — fetch with the session token, log it, or route it yourself.',
    },
  ],
  keyboard: [
    [
      'Tab',
      'Move along the tiles; in the viewer: close, Previous, Next, Zoom, Open in new tab, Download, the file’s own actions',
    ],
    ['Enter / Space on a tile', 'Open the viewer at that file (ui-open)'],
    [
      '← / →',
      'Previous / next file, held at the first and last. A zoomed image keeps the arrows for scrolling; fields, media and frames keep theirs',
    ],
    ['Home / End', 'First / last file'],
    ['Esc', 'Close the viewer (ui-close); focus goes back to the tile. With the peek open, put the peek away'],
  ],
  a11y: [
    'The files are a role="list" named by the title (or “Files”). Each tile is one native button named “checkout-flow.png, Image, 180 KB · 2m ago, from Build agent”, with aria-haspopup="dialog".',
    'The viewer is the shared <ui-dialog>: a native <dialog> opened with showModal() (focus trap, inert page, top layer), named by its header — kind, file name and meta. Focus goes back to the tile that opened it.',
    'Previous / Next are labelled buttons, disabled at the ends (no wrap). The position reads “File 3 of 8” while the visual “3 / 8” is hidden from screen readers. A polite live region says each step (“retry.ts — 5 / 8”), not the open — the dialog’s name says that.',
    'Zoom is a toggle (aria-pressed); the full image carries the file name as alt. Tile thumbnails are decorative — the button already names the file.',
    'The peek is pointer-only and aria-hidden (mouse and pen): the same content is one press away for everyone else. It waits 350ms, survives the trip onto it (200ms grace) and Esc dismisses it (WCAG 1.4.13).',
    'An HTML page renders from srcdoc in a sandbox="" frame (no scripts, no forms, its own origin, no referrer). Markdown is escaped before it is marked up; every name, meta line and title is escaped; media and links pass safeSrc / safeLink.',
    'Kind is never colour alone: the badge carries a glyph and the kind word. Focus ring 2px; 44px targets on coarse pointers; press scales to .97; hover changes colour only.',
    'Reduced motion: the peek fades without scale or slide; the dialog keeps a 120ms fade.',
    'Sound (opt-in, @2lab.ai/ui/sound): open when the person opens a file, a soft navigate (forward / back) for Previous / Next and the arrow keys, close when they close the viewer, a tap for Download and a navigate for Open in new tab; the hover peek and the host’s open() / next() / prev() / close() stay quiet. Silent until the page turns sound on.',
  ],
  usage: `<ui-artifact-viewer id="files" lang="en"></ui-artifact-viewer>
<script type="module">
  import '@2lab.ai/ui/artifact-viewer';
  const files = document.getElementById('files');
  files.data = {
    title: 'Files',
    items: [
      { id: 'shot', name: 'checkout-flow.png', size: 184320, time: Date.now() - 120000,
        thumb: '/files/checkout-flow.thumb.png', url: '/files/checkout-flow.png' },
      { id: 'notes', name: 'release-notes.md', text: notesMarkdown, url: '/files/release-notes.md' },
      { id: 'page', name: 'landing-preview.html', text: pageHtml },
    ],
  };
  // Downloads need the session token: take the link over.
  files.addEventListener('ui-action', (e) => {
    e.preventDefault();
    downloadWithAuth(e.detail.url, e.detail.action);
  });
  // Deep link: ?file=notes opens the viewer there; the address follows the viewer.
  const at = files.data.items.findIndex((f) => f.id === params.get('file'));
  files.data = { ...files.data, index: at };
  files.addEventListener('ui-view', (e) => history.replaceState(null, '', '?file=' + e.detail.id));
  files.addEventListener('ui-close', () => {
    files.data = { ...files.data, index: -1 };
    history.replaceState(null, '', location.pathname);
  });
</script>`,
  demos: [
    {
      id: 'strip',
      title: 'Strip',
      description:
        'Eight files a run left behind, in one scrolling row. Rest the pointer on a tile for the peek; click one for the viewer, then ← / → through the rest — the picture zooms, the notes read as a document, the page renders with scripts off, the chime plays, the invoice opens in the browser’s PDF viewer.',
      height: 290,
      create: () => stage(make({ title: 'Files', items: demoFiles() })).box,
    },
    {
      id: 'grid',
      title: 'Grid',
      description: 'layout: grid — tiles of at least 132px fill the width; images show their thumbnails.',
      height: 440,
      create: () => stage(make({ title: 'Run artifacts', layout: 'grid', items: [demoPhoto(), ...demoFiles()] })).box,
    },
    {
      id: 'list-chips',
      title: 'List and chips',
      description:
        'layout: list — rows with size, age and the extra line, for a side panel. layout: chips — name pills for attachments inside a message. Both open the same viewer.',
      height: 460,
      create: () => {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:grid;gap:22px;width:100%;max-width:520px;margin:0 auto';
        wrap.append(
          stage(make({ title: 'Attachments', layout: 'list', items: demoFiles().slice(0, 4) })).box,
          stage(make({ title: 'In this message', layout: 'chips', items: demoFiles().slice(2) })).box,
        );
        return wrap;
      },
    },
    {
      id: 'actions',
      title: 'Events and host control',
      description:
        'Every event lands on the line below. Open in new tab and Download are prevented (ui-action) and echoed instead — nothing leaves the page. Each file also carries the page’s own actions (items[].actions): Slack on every file, Copy on the log, and customer-call.m4a lives only in Slack, so its card leads with Open in Slack. The button opens the viewer through data.index; ui-close clears it.',
      height: 330,
      create: () => {
        const el = make({ title: 'Files', items: withActions() });
        const { box } = stage(el);
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'ui-btn is-sm';
        open.textContent = 'Open release-notes.md';
        open.style.alignSelf = 'flex-start';
        open.addEventListener('click', () => {
          const items = el.data?.items ?? [];
          el.data = { ...el.data, items, index: items.findIndex((f) => f.id === 'notes') };
        });
        el.addEventListener('ui-close', () => {
          el.data = { ...el.data, items: el.data?.items ?? [], index: -1 };
        });
        box.prepend(open);
        return box;
      },
    },
    {
      id: 'scripts-pdf',
      title: 'A page with its scripts, and a PDF',
      description:
        'items[].scripts: the model’s chart page runs its own script (sandbox="allow-scripts", never same-origin) in the viewer and the peek — the note says so. The PDF is the browser’s own viewer; no slot, no body of the page’s own.',
      height: 290,
      create: () =>
        stage(
          make({
            title: 'Final answer',
            items: [
              {
                id: 'chart-page',
                name: 'signups-chart.html',
                size: 2_300,
                time: Date.now() - 2 * MIN,
                text: CHART_PAGE,
                scripts: true,
                meta: 'the model’s page',
              },
              demoFiles().find((f) => f.id === 'invoice') as FileItem,
            ],
          }),
        ).box,
    },
    {
      id: 'over-host',
      title: 'Over your own cards',
      description:
        'tiles="none": the element draws no tiles. The page’s own cards — an answer’s chips, the attachments’ tiles — open one viewer with open(items, index, opener), which pages through every file on the page; Esc returns focus to the card that opened it.',
      height: 360,
      create: () => overHost(),
    },
    {
      id: 'host-preview',
      title: 'Your own preview',
      description:
        'slot="preview" replaces the built-in body: this host draws each CSV as a table, swapping it on ui-view. The tiles, peek, steps and actions stay the viewer’s.',
      height: 290,
      create: () => {
        const items = csvFiles();
        const el = make({ title: 'Exports', items });
        const preview = document.createElement('div');
        preview.slot = 'preview';
        el.append(preview);
        el.addEventListener('ui-view', (e) => {
          const { id } = (e as CustomEvent<ArtifactViewDetail>).detail;
          preview.replaceChildren(csvTable(items.find((f) => f.id === id)?.text ?? ''));
        });
        return stage(el).box;
      },
    },
    {
      id: 'ko',
      title: '한국어 (lang="ko")',
      description:
        '빈 상태, 이전·다음, 위치(“8개 중 3번째”), 새 탭에서 열기·다운로드, 종류 이름과 상대 시간이 한국어로 바뀌어요.',
      height: 290,
      create: () => stage(make({ title: '파일', items: demoFiles('ko') }, { lang: 'ko' }), SAY_KO).box,
    },
  ],
};
