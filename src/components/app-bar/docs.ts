import type { ComponentDoc } from '../../docs/types';
import { icon } from '../../icons/icons';
import './app-bar';
import type { AppBarData, AppBarNavigate, AppBarStatus, AppBarThemeChange, UiAppBar } from './app-bar';

function make(data: AppBarData, attrs: Record<string, string> = {}): UiAppBar {
  const el = document.createElement('ui-app-bar');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

/** An ink "New task" button for the actions slot; its word steps aside while the bar is narrow. */
function newTask(label: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.slot = 'actions';
  b.className = 'ui-btn is-primary is-sm';
  b.setAttribute('aria-label', label);
  b.innerHTML = `${icon('plus', { size: 14 })}<span class="ab-demo-word">${label}</span>`;
  return b;
}

const ROWS_EN: Array<[string, string]> = [
  ['Quarterly report draft', 'Edited 4 min ago'],
  ['Fix the flaky sign-in test', 'Running · 12 steps'],
  ['Invoice export to CSV', 'Waiting for review'],
  ['Onboarding checklist', 'Done yesterday'],
  ['Release notes for 2.4', 'Edited 2 h ago'],
  ['Search index rebuild', 'Done 3 days ago'],
];
const ROWS_KO: Array<[string, string]> = [
  ['분기 보고서 초안', '4분 전 수정'],
  ['로그인 테스트 간헐 실패 수정', '실행 중 · 12단계'],
  ['청구서 CSV 내보내기', '검토 대기'],
  ['온보딩 체크리스트', '어제 완료'],
  ['2.4 릴리스 노트', '2시간 전 수정'],
];

/**
 * A small page: the bar sticky over scrolling content (so the translucency shows), a quiet echo line of what
 * the bar sent, and the page theme applied when the bar asks for it — the host's job, done by the demo.
 */
function page(
  bar: UiAppBar,
  o: { height: number; maxWidth?: string; rows?: Array<[string, string]>; say?: (name: string, d: unknown) => string },
): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = `display:flex;flex-direction:column;gap:10px;width:100%;max-width:${o.maxWidth ?? '100%'};margin:0 auto`;
  const win = document.createElement('div');
  win.style.cssText =
    'border:1px solid var(--ui-border);border-radius:12px;overflow:hidden;background:var(--ui-bg);color:var(--ui-text)';
  const scroll = document.createElement('div');
  scroll.style.cssText = `height:${o.height}px;overflow:auto;overscroll-behavior:contain`;
  const style = document.createElement('style');
  style.textContent = 'ui-app-bar[narrow] .ab-demo-word { display: none; }';
  const list = document.createElement('div');
  list.style.cssText = 'display:grid;gap:8px;padding:14px 20px 20px';
  for (const [title, meta] of o.rows ?? ROWS_EN) {
    const row = document.createElement('div');
    row.style.cssText =
      'display:flex;justify-content:space-between;gap:12px;padding:12px 14px;border-radius:12px;background:var(--ui-surface);box-shadow:0 0 0 1px var(--ui-ib-card-border);font-size:13.5px';
    const a = document.createElement('span');
    a.textContent = title;
    const b = document.createElement('span');
    b.textContent = meta;
    b.style.cssText = 'color:var(--ui-text-secondary);font-size:12.5px;white-space:nowrap';
    row.append(a, b);
    list.append(row);
  }
  scroll.append(style, bar, list);
  win.append(scroll);
  const line = document.createElement('p');
  line.className = 'ui-status-line';
  line.setAttribute('role', 'status');
  const say =
    o.say ??
    ((name: string, d: unknown) =>
      name === 'ui-navigate'
        ? `ui-navigate → ${(d as AppBarNavigate).id} (${(d as AppBarNavigate).href || 'no href'})`
        : name === 'ui-theme-change'
          ? `ui-theme-change → ${(d as AppBarThemeChange).theme}`
          : name);
  // A client-side router would take every link over: the demo marks the page current instead of leaving.
  bar.addEventListener('ui-navigate', (e) => {
    const d = (e as CustomEvent<AppBarNavigate>).detail;
    e.preventDefault();
    const nav = bar.data?.nav;
    if (nav && d.id !== 'brand') bar.data = { ...bar.data, nav: nav.map((l) => ({ ...l, current: l.id === d.id })) };
    line.textContent = say('ui-navigate', d);
  });
  bar.addEventListener('ui-account', (e) => {
    e.preventDefault();
    line.textContent = say('ui-account', {});
  });
  bar.addEventListener('ui-theme-change', (e) => {
    const d = (e as CustomEvent<AppBarThemeChange>).detail;
    win.dataset.theme = d.theme;
    line.textContent = say('ui-theme-change', d);
  });
  // The demo's speaker only reports: the site's own speaker (top right) turns sound on for the whole page.
  bar.addEventListener('ui-sound-change', (e) => {
    line.textContent = `ui-sound-change → ${(e as CustomEvent<{ sound: boolean }>).detail.sound ? 'on' : 'off'}`;
  });
  // Start from the theme the page around the demo shows.
  requestAnimationFrame(() => {
    if (!bar.data?.theme) return;
    const t = box.parentElement?.closest('[data-theme]')?.getAttribute('data-theme');
    const dark = t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    bar.data = { ...bar.data, theme: dark ? 'dark' : 'light' };
  });
  box.append(win, line);
  return box;
}

const WORKBENCH: AppBarData = {
  brand: { label: 'Workbench', href: '/', mark: true },
  nav: [
    { id: 'conversations', label: 'Conversations', href: '/conversations', icon: 'chat', current: true, badge: 3 },
    { id: 'settings', label: 'Settings', href: '/settings', icon: 'gear' },
    { id: 'memory', label: 'Memory', href: '/memory', icon: 'brain' },
  ],
  status: { tone: 'done', label: 'Live', live: true },
  account: { name: 'Mina Park', role: 'Admin', href: '/account' },
  theme: 'light',
  sound: false,
};

const STATES: Array<[string, AppBarStatus]> = [
  ['Connecting', { tone: 'run', label: 'Connecting…', live: true }],
  ['Live', { tone: 'done', label: 'Live', live: true }],
  ['Reconnecting', { tone: 'wait', label: 'Reconnecting…', live: true }],
  ['Offline', { tone: 'fail', label: 'Offline' }],
  ['Paused', { tone: 'idle', label: 'Paused' }],
];

export const doc: ComponentDoc = {
  slug: 'app-bar',
  name: 'App Bar',
  tag: 'ui-app-bar',
  group: 'Components',
  summary: 'Where am I, is it live, and who am I signed in as? — one calm bar over every page.',
  description:
    'The page’s top bar: brand, page links as quiet chips (the current page on a neutral pill), a live status as a tone dot and a word, the signed-in account as a neutral pill and a sun / moon theme toggle. It stays at the top, translucent over the page (opaque when the person asks for less transparency). Below its own collapseAt width the links fold into a Menu button, the status keeps its dot and the account its initials. Links send a cancelable ui-navigate — cancel it to route on the client; the toggle sends ui-theme-change and the host applies the theme.',
  usedIn: 'soma-work dashboard › top bar — brand, WebSocket badge, nav links, user pill and theme toggle',
  reference: { name: 'WAI-ARIA APG Menu Button', url: 'https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/' },
  props: [
    {
      name: 'data.brand',
      type: '{ label: string; href?: string; mark?: boolean | IconName }',
      description:
        'Label with an optional glyph before it (mark: an icon name, or true for the library mark; default none). A link when href is set (safe app links only, else #); its click sends ui-navigate with id "brand". The brand slot replaces it.',
    },
    {
      name: 'data.nav',
      type: 'Array<{ id: string; label: string; href?: string; icon?: IconName; current?: boolean; badge?: number | string }>',
      description:
        'Page links. current draws the neutral pill and aria-current="page" (the first current link wins); badge is a small tabular count; icon is a 14px glyph. A repeated id keeps the first. Without href the link goes nowhere by itself — handle ui-navigate.',
    },
    {
      name: 'data.navLabel',
      type: 'string',
      default: '"Main" / "주 메뉴"',
      description: 'Accessible name of the navigation landmark (and of the folded menu).',
    },
    {
      name: 'data.status',
      type: "{ tone: 'run' | 'wait' | 'done' | 'fail' | 'idle'; label: string; live?: boolean }",
      description:
        'Tone dot plus a short word, announced politely on change. idle is a hollow ring; live pulses the dot (1.6 s). Narrow, only the dot shows (the word stays for screen readers).',
    },
    {
      name: 'data.account',
      type: '{ name: string; href?: string; role?: string; initials?: string }',
      description:
        'The signed-in account: a 24px initials avatar (derived with appBarInitials when initials is missing), the name (ellipsis past 160px) and an optional neutral role tag. A link when href is set, else a button; its click sends ui-account. Narrow, only the avatar shows.',
    },
    {
      name: 'data.theme',
      type: "'light' | 'dark'",
      description:
        'The page’s current theme. When set, the toggle shows: a sun while dark, a moon while light. Clicking sends ui-theme-change and, unless cancelled, the toggle shows the new theme at once.',
    },
    {
      name: 'data.sound',
      type: 'boolean',
      description:
        'The page’s interface-sound choice (@2lab.ai/ui/sound). When set, a speaker shows right before the theme toggle — pressed while on. Clicking sends ui-sound-change and, unless cancelled, the speaker shows the new choice at once.',
    },
    {
      name: 'data.collapseAt',
      type: 'number',
      default: '720',
      description:
        'The bar’s own width (px) below which the links fold into the Menu button. In auto mode the bar also folds when its content would overflow.',
    },
    {
      name: 'collapse',
      type: "'auto' | 'always' | 'never'",
      default: "'auto'",
      description: 'Attribute. always keeps the links folded; never keeps them out (they may overflow).',
    },
    {
      name: 'collapsed',
      type: 'boolean (reflected)',
      description: 'Set by the bar while the links are folded. Read-only — style slotted actions with it.',
    },
    {
      name: 'narrow',
      type: 'boolean (reflected)',
      description:
        'Set by the bar below 560px of its own width (status dot only, avatar only). Read-only — e.g. ui-app-bar[narrow] .label { display: none }.',
    },
    {
      name: 'mark-only',
      type: 'boolean (reflected)',
      description:
        'Set by the bar while it is folded and narrow and the brand’s name would still be cut: the mark shows alone and the name stays the link’s accessible name. Cleared once the bar has the room it measured. Read-only.',
    },
    { name: 'slot="brand"', type: 'slot', description: 'Your own brand (logo, link); replaces data.brand.' },
    {
      name: 'slot="actions"',
      type: 'slot',
      description: 'Host controls before the status — a “New task” ink button, filter chips.',
    },
    { name: '--ui-app-bar-z', type: 'CSS custom property', default: '30', description: 'z-index of the sticky bar.' },
    { name: 'lang', type: "'en' | 'ko'", default: "'en'", description: 'UI language (attribute).' },
    {
      name: 'theme',
      type: "'light' | 'dark'",
      description: 'Pins the bar’s own palette (attribute). Default follows prefers-color-scheme or page tokens.',
    },
  ],
  events: [
    {
      name: 'ui-navigate',
      detail: '{ id: string; href: string }',
      description:
        'A link (or a row of the folded menu, or the brand: id "brand") was chosen. href is the link’s target when safe, else "". preventDefault() keeps the browser where it is — route on the client instead. Not cancelled, a menu row with an href is followed with location.assign. Modified clicks (⌘ / Ctrl / Shift / Alt) on a real link are left to the browser and send nothing.',
    },
    {
      name: 'ui-account',
      detail: '{}',
      description: 'The account pill (or its folded menu row) was chosen. preventDefault() cancels the link.',
    },
    {
      name: 'ui-theme-change',
      detail: "{ theme: 'light' | 'dark' }",
      description:
        'The toggle asks for the other theme. Apply it to the page; preventDefault() keeps the toggle as it was.',
    },
    {
      name: 'ui-sound-change',
      detail: '{ sound: boolean }',
      description:
        'The speaker asks to turn interface sound on or off. Keep the choice and call setSound (load @2lab.ai/ui/sound-cuelume and call unlockSound() when it turns on); preventDefault() keeps the speaker as it was.',
    },
  ],
  keyboard: [
    ['Tab', 'Brand, links, actions, account, theme toggle, Menu (when folded)'],
    ['Enter', 'Follow the focused link (sends ui-navigate first)'],
    ['Enter / Space / ↓ on Menu', 'Open the folded menu on the current page'],
    ['↑ on Menu', 'Open it on the last row'],
    ['↑ / ↓ · Home / End · letters', 'Move inside the menu'],
    ['Enter / Space in the menu', 'Choose a row (ui-navigate / ui-account); the menu closes'],
    ['Esc / Tab in the menu', 'Close it; focus returns to Menu'],
  ],
  a11y: [
    'Links are real <a href> in a <nav> named by navLabel ("Main"); the current page carries aria-current="page". Put the bar in your page’s <header> for the banner landmark.',
    'Folded, the same named <nav> holds one Menu button (aria-haspopup="menu", aria-expanded) — the shared <ui-menu>: links as menuitemradio (checked = current page) and the account after a separator. Only one of the two navs is in the accessibility tree at a time.',
    'The status is role="status" aria-live="polite" and is patched in place, so each change is announced once; narrow, the word is visually hidden but still read.',
    'Folded on a narrow bar, a brand name that would be cut shows as the mark alone (mark-only); the name stays the brand link’s accessible name.',
    'The account pill is named “Account: Mina Park, Admin” (the visible name included); the initials avatar is hidden from screen readers.',
    'The theme toggle names the action (“Switch to dark theme”), not the state.',
    'Focus ring 2px; 44px targets on coarse pointers; press scales to .97; hover changes colour only, on fine pointers.',
    'Reduced motion stills the live pulse; reduced transparency (or no backdrop-filter support) makes the bar opaque.',
    'Sound (opt-in, @2lab.ai/ui/sound): a link, the brand, the account or a folded-menu row plays navigate — also when the host cancels ui-navigate to route on the client; the theme toggle plays toggle (forward to dark, back to light); the speaker (data.sound) is where the person turns sound on and off, beside the theme switch. Silent until the page turns sound on.',
  ],
  usage: `<header>
  <ui-app-bar lang="en">
    <button slot="actions" class="ui-btn is-primary is-sm">New task</button>
  </ui-app-bar>
</header>
<script type="module">
  import '@2lab.ai/ui/app-bar';
  import { setSound } from '@2lab.ai/ui/sound';
  const bar = document.querySelector('ui-app-bar');
  bar.data = {
    brand: { label: 'Workbench', href: '/', mark: true },
    nav: [
      { id: 'conversations', label: 'Conversations', href: '/conversations', icon: 'chat', current: true },
      { id: 'settings', label: 'Settings', href: '/settings', icon: 'gear' },
    ],
    status: { tone: 'run', label: 'Connecting…', live: true },
    account: { name: 'Mina Park', role: 'Admin', href: '/account' },
    theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
    sound: localStorage.getItem('sound') === 'on',
  };
  // Client-side routing: take the link over.
  bar.addEventListener('ui-navigate', (e) => {
    e.preventDefault();
    router.go(e.detail.href);
  });
  // The host owns the page theme.
  bar.addEventListener('ui-theme-change', (e) => {
    document.documentElement.dataset.theme = e.detail.theme;
  });
  // …and the interface-sound choice (off until the person turns it on).
  bar.addEventListener('ui-sound-change', async (e) => {
    localStorage.setItem('sound', e.detail.sound ? 'on' : 'off');
    if (!e.detail.sound) return setSound({ enabled: false });
    const { cuelumeSound, unlockSound } = await import('@2lab.ai/ui/sound-cuelume');
    setSound({ player: cuelumeSound, enabled: true });
    unlockSound();
  });
  socket.addEventListener('open', () => {
    bar.data = { ...bar.data, status: { tone: 'done', label: 'Live', live: true } };
  });
</script>`,
  demos: [
    {
      id: 'workbench',
      title: 'Workbench',
      description:
        'Brand, three links, a live status, the account with its role, the theme toggle and an ink “New task” in the actions slot. Scroll the page under the bar. Below 720px of its own width — or whenever its content would overflow — the links fold into Menu.',
      height: 300,
      frame: false,
      create: () => {
        const bar = make(WORKBENCH);
        bar.append(newTask('New task'));
        return page(bar, { height: 240 });
      },
    },
    {
      id: 'tones',
      title: 'Status tones',
      description:
        'The host sets status as its connection moves: connecting → live → reconnecting → offline (and paused, the hollow idle ring). The colour eases over 300 ms; live pulses.',
      height: 260,
      frame: false,
      create: () => {
        const bar = make({
          brand: { label: 'Acme Ops' },
          status: STATES[0][1],
          account: { name: 'Sam Rivera', href: '/account' },
        });
        const box = page(bar, { height: 150 });
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
        const buttons = STATES.map(([label, status], i) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'ui-chip';
          b.textContent = label;
          b.setAttribute('aria-pressed', String(i === 0));
          b.addEventListener('click', () => {
            bar.data = { ...bar.data, status };
            for (const x of buttons) x.setAttribute('aria-pressed', String(x === b));
          });
          return b;
        });
        row.append(...buttons);
        box.prepend(row);
        return box;
      },
    },
    {
      id: 'collapsed',
      title: 'Collapsed',
      description:
        'In a 380px column the links fold into Menu (the current page is checked), the status keeps its dot and the account its initials. The menu lists the account after a separator.',
      height: 340,
      frame: false,
      create: () =>
        page(
          make({
            brand: { label: 'Workbench', href: '/', mark: true },
            nav: [
              { id: 'conversations', label: 'Conversations', href: '/conversations', icon: 'chat', current: true },
              { id: 'schedules', label: 'Schedules', href: '/schedules', icon: 'clock', badge: 2 },
              { id: 'settings', label: 'Settings', href: '/settings', icon: 'gear' },
              { id: 'memory', label: 'Memory', href: '/memory', icon: 'brain' },
            ],
            status: { tone: 'done', label: 'Live', live: true },
            account: { name: 'Jordan Lee', role: 'Owner', href: '/account' },
            theme: 'light',
          }),
          { height: 280, maxWidth: '380px' },
        ),
    },
    {
      id: 'ko',
      title: '한국어',
      description: 'lang="ko" — 메뉴, 계정, 테마 전환 문구가 한국어로 바뀝니다.',
      height: 300,
      frame: false,
      create: () => {
        const bar = make(
          {
            brand: { label: 'Acme Ops', href: '/' },
            nav: [
              { id: 'conversations', label: '대화', href: '/conversations', icon: 'chat', current: true },
              { id: 'settings', label: '설정', href: '/settings', icon: 'gear' },
              { id: 'memory', label: '기억', href: '/memory', icon: 'brain' },
            ],
            status: { tone: 'done', label: '실시간 연결됨', live: true },
            account: { name: '김민아', role: '관리자', href: '/account' },
            theme: 'light',
          },
          { lang: 'ko' },
        );
        bar.append(newTask('새 작업'));
        return page(bar, {
          height: 240,
          rows: ROWS_KO,
          say: (name, d) =>
            name === 'ui-navigate'
              ? `이동: ${(d as AppBarNavigate).id}`
              : name === 'ui-theme-change'
                ? `테마: ${(d as AppBarThemeChange).theme === 'dark' ? '다크' : '라이트'}`
                : '계정 페이지 열기',
        });
      },
    },
  ],
};
