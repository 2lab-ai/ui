import type { ComponentDoc } from '../../docs/types';
import './breadcrumbs';
import type { BreadcrumbsData, BreadcrumbsSelect, UiBreadcrumbs } from './breadcrumbs';

function make(data: BreadcrumbsData, attrs: Record<string, string> = {}): UiBreadcrumbs {
  const el = document.createElement('ui-breadcrumbs');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

/** A box of a given width around the trail, with a line under it that says what the host heard. */
function boxed(el: UiBreadcrumbs, width: string, note?: string): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = `display:flex;flex-direction:column;gap:8px;width:${width};max-width:100%;padding:12px 14px;border:1px dashed var(--ui-border);border-radius:10px`;
  box.append(el);
  if (note !== undefined) {
    const p = document.createElement('p');
    p.className = 'ui-status-line';
    p.style.cssText = 'margin:0;min-height:18px';
    p.textContent = note;
    el.addEventListener('ui-select', (e) => {
      const d = (e as CustomEvent<BreadcrumbsSelect>).detail;
      p.textContent = `ui-select → ${d.id ?? d.index}: ${d.item.label}`;
      p.dataset.tone = 'done';
    });
    box.append(p);
  }
  return box;
}

function col(...kids: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:14px;padding:18px 20px';
  box.append(...kids);
  return box;
}

const TRAIL: BreadcrumbsData = {
  items: [
    { id: 'home', label: 'soma-work', href: '#/' },
    { id: 'inbox', label: 'Agent inbox', href: '#/inbox' },
    { id: 'session', label: 'Fix the checkout rounding bug', href: '#/inbox/s-4f2a' },
    { id: 'tasks', label: 'Tasks' },
  ],
};

const PATH: BreadcrumbsData = {
  label: 'Agent path',
  items: [
    { id: 'main', label: 'Main' },
    { id: 'a1', label: 'Explore · src/cart' },
    { id: 'a2', label: 'Review · total.ts' },
    { id: 'a3', label: 'Fix · rounding' },
  ],
};

export const doc: ComponentDoc = {
  slug: 'breadcrumbs',
  name: 'Breadcrumbs',
  tag: 'ui-breadcrumbs',
  group: 'Primitives',
  summary: 'Where you are — the trail from the root to this page, folding its middle when the row is narrow.',
  description:
    'A `<nav>` with the trail root first: a link for each crumb that has an `href`, a button that says `ui-select` for one that does not (an agent path, a client-side route), the last crumb the current page in ink. The separators are the element’s (hidden from screen readers). When the row overflows its box the middle crumbs fold into one “…” button that reveals them inline; the first and the last always show, and labels ellipsize before anything wraps. A trailing `slot="end"` takes the host’s status chip. Two sizes: the page trail, and `sm` for a panel’s path.',
  usedIn: 'soma-work dashboard › the page trail over the inbox (A-16) and the agent panel’s path (E-20)',
  reference: { name: 'WAI-ARIA breadcrumb', url: 'https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/' },
  props: [
    {
      name: 'data.items',
      type: 'Array<{ id?: string; label: string; href?: string; title?: string }>',
      required: true,
      description:
        'The trail, root first. With `href` a crumb is a link the browser follows; without one it is a button that says `ui-select`. The last item is the current page (`aria-current="page"`, text). `title` is a tooltip for a crumb that ellipsizes.',
    },
    {
      name: 'data.label',
      type: 'string',
      default: "'Breadcrumbs' / '위치'",
      description: 'The `<nav>`’s accessible name (“Agent path”).',
    },
    {
      name: 'collapse',
      type: "attribute: 'auto' | 'never'",
      default: "'auto'",
      description:
        'auto: when the row overflows (ResizeObserver) the middle crumbs fold behind “…”; pressing it reveals them inline until the trail changes. never: every crumb stays, labels ellipsize.',
    },
    {
      name: 'size',
      type: "attribute: 'sm'",
      description: '12px crumbs for a panel’s path; the default is the page trail.',
    },
    {
      name: 'lang',
      type: "'en' | 'ko'",
      default: "'en'",
      description: 'UI language (attribute): the nav’s name, the “…” button’s name.',
    },
    {
      name: 'slot="end"',
      type: 'slot',
      description: 'The host’s chip after the trail (a `.ui-status`): it keeps its width, the trail folds first.',
    },
    { name: 'folded', type: 'boolean (read-only)', description: 'Whether the middle crumbs are folded now.' },
    {
      name: 'breadcrumbVisible(n, folded)',
      type: 'number[]',
      description: 'Which indexes a trail of n shows (pure): every one, or the first and the last when folded.',
    },
  ],
  events: [
    {
      name: 'ui-select',
      detail: '{ id: string | undefined; index: number; item: BreadcrumbItem }',
      description:
        'A crumb without `href` was chosen (cancelable). The host goes there and sets a new `items`; links never say it — the browser follows them.',
    },
  ],
  keyboard: [
    ['Tab', 'Moves through the crumbs that are links or buttons, the “…” button, then the end slot.'],
    [
      'Enter / Space',
      'Follows the link, or chooses the crumb (ui-select); on “…” reveals the folded crumbs — focus moves to the first of them.',
    ],
  ],
  a11y: [
    'A `<nav aria-label>` (“Breadcrumbs” / “위치”, or the host’s) over an `<ol>`; the current page is `aria-current="page"` and not a control.',
    'Separators are drawn by the element and `aria-hidden`; the “…” button is named (“Show 2 more” / “2개 더 보기”) ; once opened the crumbs are in the list and the button is gone, focus on the first revealed crumb.',
    'Hover tints on fine pointers only (nothing moves); 44px targets on coarse pointers; the reveal fades once, not under reduced motion. Korean breaks between words only (`word-break: keep-all`).',
    'Sound (opt-in, @2lab.ai/ui/sound): a quiet navigate (back) when a crumb is chosen and the host did not prevent it; a quiet open when “…” reveals the trail. Links are silent (the page leaves).',
  ],
  usage: `<ui-breadcrumbs id="trail"></ui-breadcrumbs>
<script type="module">
  import '@2lab.ai/ui/breadcrumbs';
  const trail = document.getElementById('trail');
  trail.data = { items: [
    { label: 'soma-work', href: '/' },
    { label: 'Agent inbox', href: '/inbox' },
    { label: 'Fix the checkout rounding bug' },   // the current page
  ] };
</script>

<!-- an agent path: buttons (no href), the panel's size, the status chip at the end -->
<ui-breadcrumbs id="path" size="sm" lang="ko">
  <span slot="end" class="ui-status" data-tone="run">실행 중</span>
</ui-breadcrumbs>
<script type="module">
  const path = document.getElementById('path');
  path.data = { label: '에이전트 경로', items: [{ id: 'main', label: 'Main' }, { id: 'a7', label: 'Review · total.ts' }] };
  path.addEventListener('ui-select', (e) => focusAgent(e.detail.id));
</script>`,
  demos: [
    {
      id: 'trail',
      title: 'Page trail',
      description: 'Links the browser follows, the current page last. The box is wide: nothing folds.',
      height: 160,
      create: () => col(boxed(make(TRAIL), '100%')),
    },
    {
      id: 'collapse',
      title: 'Collapse at a narrow width',
      description:
        'The same four-crumb trail in a 320px box: the middle folds behind “…” (named “Show 2 more”); press it to reveal them inline. A 560px box below shows the first and the last ellipsizing before anything wraps; collapse="never" keeps every crumb.',
      height: 300,
      create: () =>
        col(
          boxed(make(TRAIL), '320px'),
          boxed(make({ items: TRAIL.items.slice(1) }), '560px'),
          boxed(make(TRAIL, { collapse: 'never' }), '320px'),
        ),
    },
    {
      id: 'path',
      title: 'Agent path with a status chip (size="sm")',
      description:
        'Buttons (no href) say ui-select; the panel’s 12px size; the host’s .ui-status sits in the end slot and keeps its width while the trail folds.',
      height: 220,
      create: () => {
        const el = make(PATH, { size: 'sm' });
        const chip = document.createElement('span');
        chip.slot = 'end';
        chip.className = 'ui-status';
        chip.dataset.tone = 'run';
        chip.textContent = 'Running';
        el.append(chip);
        const narrow = make(PATH, { size: 'sm' });
        const chip2 = chip.cloneNode(true) as HTMLElement;
        narrow.append(chip2);
        return col(boxed(el, '100%', 'Choose a crumb…'), boxed(narrow, '300px', 'Choose a crumb…'));
      },
    },
    {
      id: 'ko',
      title: 'Korean (lang="ko")',
      description: 'The nav is 위치, the “…” button N개 더 보기; labels break between words only.',
      height: 220,
      create: () => {
        const ko: BreadcrumbsData = {
          items: [
            { label: 'soma-work', href: '#/' },
            { label: '에이전트 인박스', href: '#/inbox' },
            { label: '결제 화면 반올림 오류 수정', href: '#/inbox/s-4f2a' },
            { label: '작업' },
          ],
        };
        const path = make(
          {
            label: '에이전트 경로',
            items: [
              { id: 'main', label: 'Main' },
              { id: 'a1', label: '탐색 · src/cart' },
              { id: 'a3', label: '수정 · 반올림' },
            ],
          },
          { lang: 'ko', size: 'sm' },
        );
        const chip = document.createElement('span');
        chip.slot = 'end';
        chip.className = 'ui-status';
        chip.dataset.tone = 'run';
        chip.textContent = '실행 중';
        path.append(chip);
        return col(
          boxed(make(ko, { lang: 'ko' }), '100%'),
          boxed(make(ko, { lang: 'ko' }), '320px'),
          boxed(path, '300px', '크럼을 선택하세요…'),
        );
      },
    },
  ],
};
