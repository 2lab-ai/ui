import type { ComponentDoc } from '../../docs/types';
import './deck-nav';
import type { DeckNavData, DeckNavPage, UiDeckNav } from './deck-nav';

const CARDS = [
  { title: 'Fix the flaky upload retry', meta: 'Running · 4m 12s' },
  { title: 'Draft the Q3 board memo', meta: 'Needs input · 11m' },
  { title: 'Migrate the users table', meta: 'Running · 22m 40s' },
  { title: 'Triage overnight alerts', meta: 'Done · 6m 03s' },
  { title: 'Review pull request #482', meta: 'Idle · 1h ago' },
];
const TITLES = CARDS.map((c) => c.title);

function nav(data: DeckNavData, attrs: Record<string, string> = {}): UiDeckNav {
  const el = document.createElement('ui-deck-nav') as UiDeckNav;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

/** The front card the deck pages through (kit .ui-section-head for its title). */
function card(): { box: HTMLElement; show: (i: number) => void } {
  const box = document.createElement('div');
  box.style.cssText =
    'box-sizing:border-box;width:100%;padding:12px 14px 14px;border:1px solid var(--ui-ib-card-border);border-radius:12px;background:var(--ui-ib-card);box-shadow:var(--ui-ib-shadow)';
  const head = document.createElement('div');
  head.className = 'ui-section-head';
  const h = document.createElement('h3');
  const meta = document.createElement('p');
  meta.style.cssText = 'margin:6px 0 0;font-size:12.5px;color:var(--ui-ib-muted);font-variant-numeric:tabular-nums';
  head.append(h);
  box.append(head, meta);
  return {
    box,
    show: (i) => {
      h.textContent = CARDS[i]?.title ?? '';
      meta.textContent = CARDS[i]?.meta ?? '';
    },
  };
}

/** The host owns the index: on ui-page it shows that card and hands the index back. */
function deck(count: number, attrs: Record<string, string> = {}, start = 0): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;width:100%;max-width:420px';
  const el = nav({ index: start, count, titles: TITLES.slice(0, count) }, attrs);
  const c = card();
  c.show(start);
  el.addEventListener('ui-page', (e) => {
    const { index } = (e as CustomEvent<DeckNavPage>).detail;
    c.show(index);
    el.data = { ...el.data!, index };
  });
  wrap.append(el, c.box);
  return wrap;
}

/** Controls in a panel header row, next to the title. `guard` returns why paging is not allowed now ('' = go). */
function header(
  opts: { attrs?: Record<string, string>; label?: string; titles?: string[]; guard?: () => string } = {},
): HTMLElement {
  const titles = opts.titles ?? TITLES;
  const box = document.createElement('div');
  box.style.cssText =
    'box-sizing:border-box;display:flex;align-items:center;gap:12px;width:100%;max-width:520px;padding:10px 12px 10px 16px;border:1px solid var(--ui-ib-card-border);border-radius:12px;background:var(--ui-ib-card)';
  const h = document.createElement('h3');
  h.className = 'ui-section-head';
  h.style.cssText = 'flex:1 1 auto';
  h.textContent = titles[1];
  const el = nav({ index: 1, count: titles.length, titles, label: opts.label }, opts.attrs);
  el.addEventListener('ui-page', (e) => {
    if (opts.guard?.()) {
      e.preventDefault();
      return;
    }
    const { index } = (e as CustomEvent<DeckNavPage>).detail;
    h.textContent = titles[index];
    el.data = { ...el.data!, index };
  });
  box.append(h, el);
  return box;
}

export const doc: ComponentDoc = {
  slug: 'deck-nav',
  name: 'Deck Nav',
  tag: 'ui-deck-nav',
  group: 'Components',
  summary: 'Which of the open cards you are looking at — and one step to the next.',
  description:
    '‹ n / m › for a deck of cards the host shows one at a time (open detail cards, results, drafts): previous and next icon buttons around a tabular position. A press sends a cancelable ui-page with the index it asks for; the host owns the index and sets it back through data — without preventDefault the element moves on its own at once. ←/→ page while a button is focused; the ends stop unless `wrap` is set. With `peek` it draws up to two thin card tops under the controls (the far one narrower and fainter), so the card below reads as the front of a stack. With one card or none the element hides itself.',
  usedIn: 'soma-work dashboard › detail panel › deck (‹ n / m › top right, the edges of the cards waiting behind)',
  reference: {
    name: 'WAI-ARIA APG Carousel (previous / next controls)',
    url: 'https://www.w3.org/WAI/ARIA/apg/patterns/carousel/',
  },
  props: [
    {
      name: 'data.index',
      type: 'number',
      required: true,
      description:
        '0-based index of the card in front. Clamped into the deck. New data always wins over the element’s own step.',
    },
    { name: 'data.count', type: 'number', required: true, description: 'Cards in the deck. ≤ 1 hides the element.' },
    {
      name: 'data.titles',
      type: 'string[]',
      description: 'A name per card: the buttons’ tooltips say where they go (“Previous: Draft the Q3 board memo”).',
    },
    { name: 'data.label', type: 'string', default: "'Cards'", description: 'Accessible name of the control group.' },
    { name: 'wrap', type: 'boolean', description: 'Attribute. Past the last card comes the first (and back).' },
    {
      name: 'peek',
      type: 'boolean',
      description:
        'Attribute. Draws up to two card tops under the controls (count − 1, at most 2), decorative. Put the element right above the front card so the tops meet it.',
    },
    { name: 'index', type: 'number (read-only)', description: 'The index shown now.' },
    {
      name: 'prev() / next()',
      type: 'method',
      description: 'Page as if the person pressed ‹ / › (sends ui-page). Returns whether it moved.',
    },
    { name: 'lang', type: "'en' | 'ko'", default: "'en'", description: 'UI language (attribute).' },
    {
      name: 'theme',
      type: "'light' | 'dark'",
      description: 'Pins the theme (attribute). Default follows prefers-color-scheme or page tokens.',
    },
  ],
  events: [
    {
      name: 'ui-page',
      detail: '{ index: number; from: number }',
      description:
        'The person asked for another card (`index`, 0-based) from `from`. Cancelable: preventDefault() keeps the current index; otherwise the element shows `index` at once. Show that card and set data.index — setting data sends no event.',
    },
  ],
  keyboard: [
    ['Tab', 'Focus previous, then next'],
    ['Enter / Space', 'Page'],
    ['← / →', 'Previous / next card while either button is focused'],
  ],
  a11y: [
    'A role="group" named “Cards” (or data.label) holds two buttons named Previous / Next; their tooltips name the card they go to.',
    'The ends use aria-disabled, not disabled: focus stays on the button when the deck reaches its end.',
    'The visual “2 / 5” is hidden; a status region says “2 of 5” once per change.',
    'The peek edges are decorative (aria-hidden). New edges grow and fade in; reduced motion: an opacity fade only, no press scale.',
    'Buttons are 44px on coarse pointers and narrow screens.',
    'Sound (opt-in, @2lab.ai/ui/sound): a page change by press or arrow plays a subtle navigate, back for ‹ and forward for ›, unless ui-page is cancelled; prev() / next() do the same only inside a click or key press. Silent until the page turns sound on.',
  ],
  usage: `<ui-deck-nav peek></ui-deck-nav>
<article class="card">…</article>
<script type="module">
  import '@2lab.ai/ui/deck-nav';
  const nav = document.querySelector('ui-deck-nav');
  nav.data = { index: 0, count: openCards.length, titles: openCards.map((c) => c.title) };
  nav.addEventListener('ui-page', (e) => {
    showCard(e.detail.index);
    nav.data = { ...nav.data, index: e.detail.index };
  });
</script>`,
  demos: [
    {
      id: 'header',
      title: 'In a panel header',
      description: 'Next to the title. Hover a button for the card it goes to; ←/→ page while one is focused.',
      height: 200,
      create: () => header(),
    },
    {
      id: 'peek',
      title: 'Peek · cards behind',
      description:
        'peek draws the tops of the cards waiting behind (two at most). Page through: the host swaps the front card.',
      height: 280,
      create: () => deck(CARDS.length, { peek: '' }, 0),
    },
    {
      id: 'two',
      title: 'Two cards · wrap',
      description: 'One card behind draws one edge. wrap: › on the last card goes back to the first.',
      height: 260,
      create: () => deck(2, { peek: '', wrap: '' }, 1),
    },
    {
      id: 'single',
      title: 'Hidden at one card',
      description: 'count ≤ 1 hides the element; open a second card and it appears.',
      height: 260,
      create: () => {
        const box = document.createElement('div');
        box.style.cssText = 'display:flex;flex-direction:column;gap:10px;width:100%;max-width:420px';
        const el = nav({ index: 0, count: 1, titles: TITLES }, { peek: '' });
        const c = card();
        c.show(0);
        const add = document.createElement('button');
        add.className = 'ui-btn is-sm';
        add.style.alignSelf = 'flex-start';
        add.textContent = 'Open another card';
        add.addEventListener('click', () => {
          const d = el.data!;
          if (d.count >= CARDS.length) return;
          el.data = { ...d, count: d.count + 1, index: d.count };
          c.show(d.count);
        });
        el.addEventListener('ui-page', (e) => {
          const { index } = (e as CustomEvent<DeckNavPage>).detail;
          c.show(index);
          el.data = { ...el.data!, index };
        });
        const stackBox = document.createElement('div');
        stackBox.style.cssText = 'display:flex;flex-direction:column';
        stackBox.append(el, c.box);
        box.append(add, stackBox);
        return box;
      },
    },
    {
      id: 'guarded',
      title: 'Cancelable',
      description: 'The host cancels ui-page while the front card has an unsent draft; the status line says why.',
      height: 240,
      create: () => {
        const box = document.createElement('div');
        box.style.cssText = 'display:flex;flex-direction:column;gap:8px;width:100%;max-width:520px';
        const line = document.createElement('p');
        line.className = 'ui-status-line';
        line.setAttribute('role', 'status');
        line.dataset.tone = 'wait';
        const why = 'Send or discard your reply first — it would be lost.';
        box.append(
          header({
            guard: () => {
              line.textContent = why;
              return why;
            },
          }),
          line,
        );
        return box;
      },
    },
    {
      id: 'ko',
      title: '한국어 (lang="ko")',
      height: 200,
      create: () =>
        header({
          attrs: { lang: 'ko' },
          label: '열린 카드',
          titles: ['업로드 재시도 오류 고치기', '3분기 이사회 메모 초안', '사용자 테이블 이전', '밤새 쌓인 알림 분류'],
        }),
    },
  ],
};
