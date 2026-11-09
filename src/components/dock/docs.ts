import type { ComponentDoc } from '../../docs/types';
import './dock';
import type { DockData, DockNavigate, UiDock } from './dock';

function make(data: DockData, attrs: Record<string, string> = {}): UiDock {
  const el = document.createElement('ui-dock');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  // The demo routes on the client: the current tab follows the press.
  el.addEventListener('ui-navigate', (e) => {
    e.preventDefault();
    const id = (e as CustomEvent<DockNavigate>).detail.id;
    const d = el.data;
    if (d) el.data = { ...d, items: d.items.map((i) => ({ ...i, current: i.id === id })) };
  });
  return el;
}

/** A phone-sized stage: a page body that scrolls and the bar at its foot. */
function phone(dock: UiDock, note: string): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText =
    'position:relative;display:flex;flex-direction:column;width:min(390px,100%);height:460px;max-height:100%;margin:0 auto;border:1px solid var(--ui-border);border-radius:24px;overflow:hidden;background:var(--ui-bg)';
  const page = document.createElement('div');
  page.style.cssText =
    'flex:1;min-height:0;overflow:auto;padding:18px;color:var(--ui-text-secondary);font-size:13px;line-height:1.6';
  page.textContent = note;
  box.append(page, dock);
  return box;
}

const BOARD: DockData = {
  label: 'Dashboard',
  action: { id: 'new-task', label: 'New task' },
  items: [
    {
      id: 'board',
      label: 'Board',
      icon: 'board',
      href: '#board',
      current: true,
      badge: 3,
      title: 'Runs that need you',
    },
    { id: 'chats', label: 'Chats', icon: 'conversations', href: '#chats' },
    { id: 'memory', label: 'Memory', icon: 'memory', href: '#memory' },
    { id: 'settings', label: 'Settings', icon: 'settings', href: '#settings' },
  ],
};

const MANY: DockData = {
  action: { id: 'new-task', label: 'New task' },
  items: [
    { id: 'board', label: 'Board', icon: 'board', current: true },
    { id: 'chats', label: 'Chats', icon: 'conversations', badge: 2 },
    { id: 'schedule', label: 'Schedule', icon: 'clock' },
    { id: 'memory', label: 'Memory', icon: 'memory', badge: 1, title: 'Pages to review' },
    { id: 'artifacts', label: 'Files', icon: 'file', badge: 4 },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ],
};

const RAIL: DockData = {
  action: { id: 'new-task', label: 'New task' },
  items: [
    { id: 'search', label: 'Search', icon: 'search' },
    { id: 'board', label: 'Board', icon: 'board', current: true, badge: 3 },
    { id: 'schedule', label: 'Schedule', icon: 'clock' },
    { id: 'chats', label: 'Chats', icon: 'conversations', badge: 2 },
    { id: 'files', label: 'Files', icon: 'file' },
    { id: 'settings', label: 'Settings', icon: 'settings', end: true },
    { id: 'help', label: 'Help', icon: 'info', end: true },
  ],
};

export const doc: ComponentDoc = {
  slug: 'dock',
  name: 'Dock',
  tag: 'ui-dock',
  summary: 'Where you can go, one press away — and the one thing you start from anywhere.',
  description:
    'The app’s sections as a dock. On a phone it is the bottom tab bar in the thumb zone: equal tabs, each a glyph on a capsule over its word, the current section’s capsule filled; a count sits on a glyph’s corner; the primary action is a round ink button raised half out of the bar, in the middle; past four tabs the rest fold behind More (a menu that lists them with their counts and titles — the current section never folds, and More shows the sum of what it hides). On a wide screen the same data is a rail: a floating column of round glyph buttons on the inverse ink, the action first, settings-like items after a hairline, each name a label that slides in on hover or keyboard focus. layout="auto" switches at 640px; fixed pins the bar to the bottom (with the home-indicator inset) or the rail to the left. Items are links when they have a safe href (a modified click still opens a new tab) and send a cancelable ui-navigate first — cancel it to route on the client; the action sends ui-action. A new badge or current tab patches in place: the capsule glides, nothing re-enters, an open More menu stays open.',
  usedIn:
    'soma-work dashboard on phones: the bottom tab bar (보드 · 대화 · 새 작업 · 기억 · 설정) that replaces the folded menu and the floating New task button under 640px.',
  reference: {
    name: 'Halvi (Code and Chill) — pattern studied, no code used',
    url: 'https://demo.codeandchill.store/halvi/',
  },
  group: 'Components',
  props: [
    {
      name: 'data.items',
      type: 'Array<{ id, label, href?, icon?, current?, badge?, title?, end? }>',
      required: true,
      description:
        'The sections. href: http(s), mailto or a same-site relative URL (anything else: a button). icon: a name from @2lab.ai/ui/icons (default a dot). current: aria-current="page" (the first wins). badge: a count on the glyph (0 / empty: none; over 99: 99+). title: hover title, and the More row’s second line. end: in the rail, after a hairline.',
    },
    {
      name: 'data.action',
      type: '{ id: string, label: string, icon?: IconName }',
      description: 'The one primary action: raised in the middle of the bar, first in the rail. Default glyph plus.',
    },
    {
      name: 'data.label',
      type: 'string',
      default: '"Sections" / "구역"',
      description: 'The navigation’s accessible name.',
    },
    {
      name: 'data.max',
      type: 'number',
      default: '4',
      description:
        'Bar tabs before the rest fold behind More (2 … 6; the action is not counted). One extra item shows instead of folding.',
    },
    { name: 'data.moreLabel', type: 'string', default: '"More" / "더보기"', description: 'The More tab’s word.' },
    {
      name: 'layout',
      type: '"bar" | "rail" | "auto"',
      default: '"bar"',
      description:
        'The phone’s bottom tab bar, the floating rail, or the bar under 640px and the rail above (watched only while connected).',
    },
    {
      name: 'fixed',
      type: 'boolean attribute',
      description:
        'Pin it to the viewport: the bar along the bottom (pad the page by var(--ui-dock-h, 60px) plus env(safe-area-inset-bottom)), the rail at the left middle.',
    },
    {
      name: 'lang',
      type: '"en" | "ko"',
      default: '"en"',
      description: 'Sections / 구역, More / 더보기, “3 new” / “새 항목 3개”.',
    },
    {
      name: '--ui-dock-h',
      type: 'CSS property',
      default: '60px',
      description: 'The bar’s height above the safe-area inset.',
    },
    { name: '--ui-dock-z', type: 'CSS property', default: '40', description: 'The fixed dock’s z-index.' },
  ],
  events: [
    {
      name: 'ui-navigate',
      detail: '{ id: string, href: string }',
      description:
        'An item (or a row behind More) was chosen. Cancelable: cancel to route on the client — the link then does not navigate. href is "" when the item has no safe target.',
    },
    {
      name: 'ui-action',
      detail: '{ id: string }',
      description: 'The primary action was pressed. Cancelable (no sound when cancelled).',
    },
  ],
  keyboard: [
    ['Tab', 'Move through the tabs, the action and More in order'],
    ['Enter', 'Follow the focused tab or press the action'],
    ['Enter / Space on More', 'Open the menu of the folded sections (arrows, typeahead, Esc — the menu’s own keys)'],
  ],
  a11y: [
    'A <nav> landmark with its own name; tabs are links (or buttons without a target) in a list, the current one aria-current="page".',
    'The glyph and word are hidden from the accessibility tree; each tab is named “Board, 3 new” — the badge is part of the name, not a separate number.',
    'Rail labels are visual only (the name is on the button) and show on keyboard focus as well as hover.',
    'Tabs are at least 44px tall in the bar (60px rows) and 44px round in the rail.',
    'Sound (opt-in, @2lab.ai/ui/sound): navigate when a tab is chosen (also when the host routes it), open when the action goes through.',
  ],
  usage: `<ui-dock id="dock" layout="bar" fixed lang="en"></ui-dock>
<script type="module">
  import '@2lab.ai/ui/dock';
  const dock = document.getElementById('dock');
  dock.data = {
    action: { id: 'new-task', label: 'New task' },
    items: [
      { id: 'board', label: 'Board', icon: 'board', href: '/dashboard', current: true, badge: 3 },
      { id: 'chats', label: 'Chats', icon: 'conversations', href: '/conversations' },
      { id: 'memory', label: 'Memory', icon: 'memory', href: '/memory' },
      { id: 'settings', label: 'Settings', icon: 'settings', href: '/settings' },
    ],
  };
  dock.addEventListener('ui-action', () => openNewTask());
</script>
<style>
  /* Only on phones; the page keeps its last row above the bar. */
  @media (min-width: 640px) { #dock { display: none; } }
  @media (max-width: 639px) { body { padding-bottom: calc(var(--ui-dock-h, 60px) + env(safe-area-inset-bottom)); } }
</style>`,
  demos: [
    {
      id: 'bar',
      title: 'Phone tab bar with the action in the middle',
      description: 'Four sections and New task raised between them; the board carries the runs that need you.',
      height: 520,
      frame: false,
      create: () =>
        phone(
          make(BOARD),
          'The board scrolls here. The bar stays in the thumb zone: Board is current (its capsule filled), 3 runs need you, and New task is one press away from every section.',
        ),
    },
    {
      id: 'more',
      title: 'More for the rest',
      description: 'Six sections: three tabs, More with the sum of what it hides (2 + 1 + 4), and the action.',
      height: 520,
      frame: false,
      create: () =>
        phone(
          make({ ...MANY, max: 4 }),
          'Choose a section behind More: it becomes current and takes the last tab’s place, so the section you are in is always on the bar.',
        ),
    },
    {
      id: 'rail',
      title: 'Rail on a wide screen',
      description:
        'The same data as a floating column: the action first, settings and help after a hairline, names on hover or focus.',
      height: 520,
      create: () => {
        const box = document.createElement('div');
        box.style.cssText = 'display:flex;align-items:center;gap:24px;height:100%;padding:24px';
        const note = document.createElement('p');
        note.style.cssText = 'margin:0;max-width:320px;color:var(--ui-text-secondary);font-size:13px;line-height:1.6';
        note.textContent =
          'Hover or Tab through the rail: each name slides in to the right. The board’s badge reads as part of its name.';
        box.append(make(RAIL, { layout: 'rail' }), note);
        return box;
      },
    },
    {
      id: 'ko',
      title: '한국어 · auto',
      description: 'layout="auto": the bar in a phone-width window, the rail on a desktop.',
      height: 520,
      frame: false,
      create: () =>
        phone(
          make(
            {
              action: { id: 'new-task', label: '새 작업' },
              items: [
                { id: 'board', label: '보드', icon: 'board', current: true, badge: 2 },
                { id: 'chats', label: '대화', icon: 'conversations' },
                { id: 'memory', label: '기억', icon: 'memory' },
                { id: 'settings', label: '설정', icon: 'settings' },
              ],
            },
            { lang: 'ko', layout: 'auto' },
          ),
          '창이 좁으면 아래 탭 바, 넓으면 왼쪽 레일로 그립니다.',
        ),
    },
  ],
};
