import type { ComponentDoc } from '../../docs/types';
import './log-scroller';
import type { LogScrollerData, UiLogScroller } from './log-scroller';

const LINES = [
  'Read src/router.ts (212 lines)',
  'Searched “createRoute” in src — 9 matches',
  'Edited src/router.ts: guard the empty path',
  'Ran npm test — 128 passed, 2 skipped',
  'Opened a draft pull request',
  'Read docs/routing.md',
  'Fetched https://example.com/spec — 200, 18 KB',
  'Wrote src/router.test.ts (4 new cases)',
  'Ran npm run typecheck — no errors',
  'Formatted 3 files',
  'Asked for approval to push the branch',
  'Pushed feat/empty-path (2 commits)',
];
const LINES_KO = [
  'src/router.ts 읽음 (212줄)',
  'src에서 “createRoute” 검색 — 9건',
  'src/router.ts 수정: 빈 경로 처리',
  'npm test 실행 — 128 통과, 2 건너뜀',
  '초안 풀 리퀘스트 열기',
  'docs/routing.md 읽음',
  'npm run typecheck 실행 — 오류 없음',
  '파일 3개 정리',
];

const BASE = Date.UTC(2026, 9, 30, 5, 0, 0);

function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** One demo row in light DOM (the page's --ui-* tokens and kit). */
function line(n: number, ko = false): HTMLElement {
  const pool = ko ? LINES_KO : LINES;
  const r = document.createElement('div');
  r.dataset.item = `m${n}`;
  r.style.cssText =
    'display:grid;grid-template-columns:42px minmax(0,1fr);gap:10px;padding:8px 16px;font-size:13px;line-height:1.45;border-bottom:1px solid var(--ui-ib-card-border)';
  const t = document.createElement('span');
  t.textContent = hhmm(BASE + n * 47_000);
  t.style.cssText = 'color:var(--ui-ib-muted);font-variant-numeric:tabular-nums;font-size:12px;padding-top:1px';
  const x = document.createElement('span');
  x.textContent = `${pool[((n % pool.length) + pool.length) % pool.length]}`;
  x.style.cssText = 'color:var(--ui-ib-text);overflow-wrap:anywhere';
  r.append(t, x);
  return r;
}

function range(from: number, n: number, ko = false): HTMLElement[] {
  return Array.from({ length: n }, (_, i) => line(from + i, ko));
}

function make(data: LogScrollerData, height = 360, lang?: string): UiLogScroller {
  const el = document.createElement('ui-log-scroller');
  if (lang) el.setAttribute('lang', lang);
  el.style.cssText = `height:${height}px;width:100%;border-radius:12px`;
  el.data = data;
  return el;
}

/** Older pages arrive after a short wait; the oldest page says the history ends. */
function pageOlder(el: UiLogScroller, pages: number, size: number, ko = false): void {
  let left = pages;
  let oldest = 0;
  el.addEventListener('ui-load-older', () => {
    setTimeout(() => {
      left--;
      oldest -= size;
      el.prependItems(range(oldest, size, ko), { hasMore: left > 0 });
    }, 650);
  });
}

/** A new row every few seconds while the demo is on screen. */
function stream(el: UiLogScroller, from: number, every = 2400): void {
  let n = from;
  const tick = () => {
    if (!el.isConnected) return;
    el.appendItems(line(n++));
    setTimeout(tick, every);
  };
  setTimeout(tick, every);
}

export const doc: ComponentDoc = {
  slug: 'log-scroller',
  name: 'Log Scroller',
  tag: 'ui-log-scroller',
  group: 'Components',
  summary: 'Where am I in a growing stream? — it follows the newest line, and never moves what you are reading.',
  description:
    'A scroll box for newest-at-bottom streams: chat turns, activity logs, build output. While you are at the bottom it follows each new item; scroll up and it stops following, keeps the rows you read exactly where they are, and offers a quiet “3 new” pill to jump back. Near the top it asks for older items (ui-load-older) and, when they arrive above you, restores your place to the pixel — then marks the start of history once there is nothing older. Items are its children: appendItems, prependItems, upsertItem and removeItem touch only the nodes they name, so nothing already on screen is re-rendered (no virtual list, and cheap). New items fade up from 3px; history never animates.',
  usedIn:
    'soma-work dashboard › detail panel section scroller (E-25: 대화 / 작업 로그 / 에이전트 트리 boxes — pin, older loader, anchor restore, start marker, new-items pill).',
  reference: { name: 'WAI-ARIA log role', url: 'https://www.w3.org/TR/wai-aria-1.2/#log' },
  props: [
    {
      name: 'data.hasMore',
      type: 'boolean',
      default: 'false',
      description: 'Older items exist: the top row offers them and scrolling near the top asks for them.',
    },
    {
      name: 'data.loading',
      type: 'boolean',
      default: 'false',
      description: 'A page is on its way: skeleton lines with no items yet, else the “Loading older…” row.',
    },
    { name: 'data.label', type: 'string', default: '"Log"', description: 'Accessible name of the box.' },
    { name: 'data.emptyText', type: 'string', description: 'Empty-state text (or put an element in slot="empty").' },
    {
      name: 'data.startText',
      type: 'string',
      default: '"Start of history"',
      description: 'Marker shown at the top once hasMore is false. Empty string hides it.',
    },
    {
      name: 'data.live',
      type: 'boolean',
      default: 'true',
      description: 'role="log" (polite announcements of appended items). False: a plain labelled region.',
    },
    { name: 'lang', type: '"en" | "ko"', default: '"en"', description: 'Attribute. Strings in English or Korean.' },
    {
      name: 'appendItems(nodes, { unread?, animate? })',
      type: 'method',
      description:
        'New items at the bottom. Pinned readers follow; others get an unread count. The first items of an empty box do not animate.',
    },
    {
      name: 'prependItems(nodes, { hasMore? })',
      type: 'method',
      description:
        'An older page above the first item; the reader’s place is restored and held while it settles. Ends the loading row.',
    },
    {
      name: 'upsertItem(key, node)',
      type: 'method',
      description:
        'Replace the item with data-item=key in place (or append it). Rows above the reader may change size without moving the view.',
    },
    {
      name: 'removeItem(key) · clearItems() · itemFor(key) · items',
      type: 'method',
      description: 'Remove one / all items; look one up; the item elements oldest first.',
    },
    {
      name: 'scrollToLatest({ smooth? }) · pinned · unread',
      type: 'method',
      description: 'Jump to the newest item; whether the reader follows the newest; items appended while away.',
    },
    {
      name: 'slot="empty" · slot="loading"',
      type: 'slot',
      description: 'Replace the empty text or the first-load skeleton.',
    },
    {
      name: '[data-anchor]',
      type: 'attribute on item descendants',
      description:
        'Finer place-keeping inside large items (entries inside a group): the reader’s row is found among these first.',
    },
  ],
  events: [
    {
      name: 'ui-load-older',
      detail: '{ oldest: string | null }',
      description:
        'The reader asked for older items (scrolled near the top, or pressed Load older). Cancelable: preventDefault keeps the button as it was; otherwise the row shows Loading… until prependItems() or a new data object.',
    },
  ],
  keyboard: [
    ['Tab', 'The box itself takes focus; arrows, Page Up/Down, Home and End scroll it.'],
    ['Enter / Space on Load older', 'Ask for the older page.'],
    ['Enter / Space on the pill', 'Jump to the newest item; focus stays in the box.'],
  ],
  a11y: [
    'The box is role="log" with an accessible name and tabindex="0" (a scrollable region must be reachable by keyboard).',
    'aria-busy while a page loads; the older row is a real button so keyboard and switch users never depend on scroll-triggered loading.',
    'The pill’s name carries the count (“Jump to latest, 3 new items”); hidden, it is out of the tab order.',
    'Reduced motion: items fade only (no rise, no blur); the jump is instant; the pill does not slide.',
  ],
  usage: `<ui-log-scroller style="height: 420px"></ui-log-scroller>
<script type="module">
  import '@2lab.ai/ui/log-scroller';
  const log = document.querySelector('ui-log-scroller');
  log.data = { hasMore: true, label: 'Activity' };
  log.appendItems(rows(page1));            // first page: no motion
  socket.onmessage = (m) => log.appendItems(row(m)); // follows if the reader is at the bottom
  log.addEventListener('ui-load-older', async (e) => {
    const page = await fetchOlder(e.detail.oldest);
    log.prependItems(rows(page.items), { hasMore: page.hasMore });
  });
</script>`,
  demos: [
    {
      id: 'live',
      title: 'Live stream with older pages',
      description:
        'A row lands every few seconds. Scroll up: following stops and the pill counts what arrives. Scroll to the top: two older pages load above you without moving the rows you see, then the start of history.',
      height: 420,
      create: () => {
        const el = make({ hasMore: true, label: 'Agent activity' });
        el.appendItems(range(0, 14));
        pageOlder(el, 2, 12);
        stream(el, 14);
        return el;
      },
    },
    {
      id: 'reading',
      title: 'Reading higher up',
      description:
        'The reader is in the middle of the history; four new rows arrived. The view stays put and the pill offers the jump.',
      height: 420,
      create: () => {
        const el = make({ hasMore: false, label: 'Build log' });
        el.appendItems(range(0, 30));
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const vp = el.shadowRoot?.querySelector<HTMLElement>('.ls-vp');
            if (vp) {
              vp.scrollTop = Math.round(vp.scrollHeight * 0.35);
              vp.dispatchEvent(new Event('scroll'));
            }
            el.appendItems(range(30, 4));
          }),
        );
        return el;
      },
    },
    {
      id: 'states',
      title: 'First load and empty',
      description:
        'No items yet: skeleton lines while the first page loads; the empty text (or slot="empty") once it came back empty.',
      height: 300,
      create: () => {
        const box = document.createElement('div');
        box.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;width:100%';
        const a = make({ loading: true, label: 'Loading' }, 220);
        const b = make({ label: 'Empty log' }, 220);
        const custom = document.createElement('div');
        custom.slot = 'empty';
        custom.style.cssText = 'display:grid;gap:4px;justify-items:center;color:var(--ui-ib-muted);font-size:13px';
        const strong = document.createElement('strong');
        strong.textContent = 'No activity yet';
        strong.style.cssText = 'color:var(--ui-ib-text-2);font-weight:600';
        const p = document.createElement('span');
        p.textContent = 'Steps the agent takes show up here.';
        custom.append(strong, p);
        b.append(custom);
        for (const el of [a, b]) el.style.border = '1px solid var(--ui-ib-card-border)';
        box.append(a, b);
        return box;
      },
    },
    {
      id: 'ko',
      title: 'Korean',
      description: 'lang="ko": 이전 항목 불러오기 · 새 항목 N개 · 기록의 시작.',
      height: 380,
      create: () => {
        const el = make({ hasMore: true, label: '작업 기록' }, 340, 'ko');
        el.appendItems(range(0, 12, true));
        pageOlder(el, 1, 8, true);
        return el;
      },
    },
  ],
};
