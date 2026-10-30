import type { ComponentDoc } from '../../docs/types';
import { icon } from '../../icons/icons';
import './menu';
import type { MenuData, MenuSelect, UiMenu } from './menu';

function button(html: string, cls = 'ui-btn', label?: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.innerHTML = html;
  if (label) b.setAttribute('aria-label', label);
  return b;
}

/** A menu with a light-DOM kit button in its trigger slot. */
function make(data: MenuData, trigger: HTMLButtonElement, attrs: Record<string, string> = {}): UiMenu {
  const el = document.createElement('ui-menu');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  trigger.slot = 'trigger';
  el.append(trigger);
  el.data = data;
  return el;
}

/** The menu plus the quiet status line a host would show under it. */
function withEcho(el: HTMLElement, say: (d: MenuSelect) => string, before?: HTMLElement): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:10px';
  const line = document.createElement('p');
  line.className = 'ui-status-line';
  line.setAttribute('role', 'status');
  el.addEventListener('ui-select', (e) => {
    line.textContent = say((e as CustomEvent<MenuSelect>).detail);
  });
  if (before) box.append(before);
  else box.append(el);
  box.append(line);
  return box;
}

const DEFAULTS: MenuData = {
  label: 'Defaults for new sessions',
  items: [
    { kind: 'heading', label: 'Default model' },
    {
      kind: 'radio',
      value: 'opus',
      label: 'Opus 5.5',
      description: 'Most capable — long, hard agent runs',
      checked: true,
    },
    { kind: 'radio', value: 'sonnet', label: 'Sonnet 5', description: 'Fast and balanced for everyday work' },
    { kind: 'radio', value: 'haiku', label: 'Haiku 5', description: 'Quickest and cheapest for small tasks' },
    { kind: 'separator' },
    { kind: 'checkbox', value: 'apply-open', label: 'Apply to open sessions' },
  ],
};

const ACTIONS: MenuData = {
  label: 'Session actions',
  items: [
    { value: 'copy', label: 'Copy link', icon: 'copy', shortcut: '⌘C' },
    { value: 'open', label: 'Open in new tab', icon: 'external', shortcut: '⌘↵' },
    { value: 'rename', label: 'Rename', icon: 'edit', shortcut: 'R' },
    {
      value: 'download',
      label: 'Download transcript',
      icon: 'download',
      description: 'Available when the run finishes',
      disabled: true,
    },
    { kind: 'separator' },
    { value: 'delete', label: 'Delete session', icon: 'trash', danger: true, shortcut: '⌫' },
  ],
};

const PLACE: MenuData = {
  label: 'Sort',
  items: [
    { kind: 'heading', label: 'Sort by' },
    { kind: 'radio', value: 'recent', label: 'Most recent', checked: true },
    { kind: 'radio', value: 'tokens', label: 'Most tokens' },
    { kind: 'radio', value: 'name', label: 'Name' },
  ],
};

const KO: MenuData = {
  label: '새 세션 기본값',
  items: [
    { kind: 'heading', label: '기본 모델' },
    { kind: 'radio', value: 'opus', label: 'Opus 5.5', description: '가장 뛰어남 — 길고 어려운 에이전트 작업' },
    { kind: 'radio', value: 'sonnet', label: 'Sonnet 5', description: '빠르고 균형 잡힌 일상 작업용', checked: true },
    { kind: 'radio', value: 'haiku', label: 'Haiku 5', description: '작은 작업에 가장 빠르고 저렴' },
    { kind: 'separator' },
    { kind: 'checkbox', value: 'apply-open', label: '열린 세션에도 적용' },
  ],
};

const CHEV = icon('chevron-down', { size: 14 });

export const doc: ComponentDoc = {
  slug: 'menu',
  name: 'Menu',
  tag: 'ui-menu',
  group: 'Primitives',
  summary:
    'Actions and settings behind one button — plain actions, radio groups, checkboxes — that pop from the button.',
  description:
    'A menu button’s menu. Put your own button in the trigger slot (or hang it from any element with show(anchor)); the menu pops from that corner — a 4px slide and a 0.96 scale, never from nothing — and fades back. Rows take real focus: the arrows wrap and skip disabled rows, Home / End jump, typing a letter finds a row. Choosing sends a cancelable ui-select: an action closes the menu, a radio checks and closes, a checkbox toggles and stays, and unless a listener cancels it the menu shows the new state at once.',
  usedIn:
    'soma-work dashboard › the defaults menu (기본 모델 radios + “열린 세션에도 적용”, one menu for two triggers) and the card / session action menus.',
  reference: { name: 'WAI-ARIA APG Menu Button', url: 'https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/' },
  props: [
    {
      name: 'data.items',
      type: "Array<{ kind?: 'item' | 'radio' | 'checkbox' | 'separator' | 'heading'; value?: string; label?: string; description?: string; icon?: IconName; checked?: boolean; disabled?: boolean; danger?: boolean; shortcut?: string; group?: string }>",
      required: true,
      description:
        'The rows, in order. item / radio / checkbox need a string `value`; a heading needs a label. Radios form a group per run between separators / headings, or by `group`. `shortcut` is a hint only — bind the key yourself.',
    },
    {
      name: 'data.label',
      type: 'string',
      description: 'Accessible name of the menu. Default “Menu” / “메뉴”.',
    },
    {
      name: 'open',
      type: 'boolean',
      description:
        'Attribute and property, reflected. Setting it opens / closes without ui-open-change and without moving focus.',
    },
    {
      name: 'placement',
      type: "'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'",
      default: "'bottom-start'",
      description: 'Attribute. Side and alignment against the anchor; flips when that side has no room.',
    },
    {
      name: 'anchor',
      type: 'Element | null',
      description:
        'Property. An element outside the menu it hangs from instead of the slotted trigger; it gets aria-haspopup / aria-expanded while it is the anchor.',
    },
    {
      name: 'show(anchor?) · hide() · toggle(anchor?)',
      type: '(anchor?: Element) => void',
      description:
        'Open (from `anchor`, which becomes the anchor; focus moves to the checked radio or first row), close (focus back to the anchor when it was inside), or either. No ui-open-change — they are your own calls.',
    },
    {
      name: 'lang',
      type: "'en' | 'ko'",
      default: "'en'",
      description: 'Attribute. Language of the default menu name.',
    },
    {
      name: 'theme',
      type: "'light' | 'dark'",
      description: 'Pins the theme (attribute). Default follows prefers-color-scheme or page tokens.',
    },
  ],
  events: [
    {
      name: 'ui-select',
      detail: "{ value: string; kind: 'item' | 'radio' | 'checkbox'; checked: boolean }",
      description:
        'A row was chosen (click, Enter, Space). `checked` is the state asked for (true for a radio, the toggled state for a checkbox, false for an item). Cancelable: preventDefault() keeps the state and the menu open. Choosing the checked radio only closes.',
    },
    {
      name: 'ui-open-change',
      detail: '{ open: boolean }',
      description:
        'The person opened or closed it (trigger, Esc, Tab, a choice, a press outside). Not sent for the open property / attribute or show / hide / toggle.',
    },
  ],
  keyboard: [
    ['Enter / Space (trigger)', 'Open on the checked radio, else the first row'],
    ['↓ / ↑ (trigger)', 'Open on the checked radio (else the first row) / on the last row'],
    ['↓ / ↑', 'Next / previous row (wraps; skips disabled rows, separators and headings)'],
    ['Home / End', 'First / last row'],
    ['A–Z', 'Typeahead: the next row starting with what you typed (resets after 0.5s)'],
    ['Enter / Space', 'Choose the focused row'],
    ['Esc', 'Close; focus back on the trigger'],
    ['Tab', 'Close; focus back on the trigger (the menu never keeps focus)'],
  ],
  a11y: [
    'Trigger: aria-haspopup="menu" and aria-expanded kept in step; an external anchor gets the same while it is the anchor. Focus goes back to whichever anchor opened it.',
    'role="menu" named by data.label; rows are menuitem / menuitemradio / menuitemcheckbox with aria-checked, all tabindex="-1" with real focus moving between them.',
    'Runs between separators are role="group", named by their heading (aria-labelledby); separators are role="separator". A description and a shortcut are the row’s description (aria-describedby), not part of its name.',
    'Disabled rows stay visible with aria-disabled, are skipped by the arrows and never activate. Keys inside the open menu never reach page shortcuts.',
    'Closed, the menu is inert and visibility: hidden, and it stops taking hits the moment it starts closing. Reduced motion: no slide or scale, a 120ms fade.',
    'Sound (opt-in, @2lab.ai/ui/sound): opening from the trigger plays select; Esc, Tab, the trigger or a press outside plays a subtle close; choosing an action or radio plays select, a checkbox plays toggle (forward when it turns on). The open property and show / hide / toggle are silent. Silent until the page turns sound on.',
  ],
  usage: `<ui-menu id="defaults">
  <button class="ui-btn" slot="trigger">Defaults</button>
</ui-menu>
<script type="module">
  import '@2lab.ai/ui/menu';
  const menu = document.getElementById('defaults');
  menu.data = {
    label: 'Defaults for new sessions',
    items: [
      { kind: 'heading', label: 'Default model' },
      { kind: 'radio', value: 'opus', label: 'Opus 5.5', checked: true },
      { kind: 'radio', value: 'sonnet', label: 'Sonnet 5' },
      { kind: 'separator' },
      { kind: 'checkbox', value: 'apply-open', label: 'Apply to open sessions' },
    ],
  };
  menu.addEventListener('ui-select', (e) => saveDefault(e.detail)); // { value, kind, checked }
  // A second trigger elsewhere: gear.addEventListener('click', () => menu.toggle(gear));
</script>`,
  demos: [
    {
      id: 'defaults',
      title: 'Defaults',
      description:
        'Model radios and a checkbox that keeps the menu open. The gear opens the same menu from a second trigger (show / toggle with an anchor).',
      height: 380,
      create: () => {
        const el = make(DEFAULTS, button(`Defaults ${CHEV}`));
        const gear = button(icon('gear'), 'ui-icon-btn is-bordered', 'Defaults');
        gear.addEventListener('click', () => el.toggle(gear));
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:10px';
        row.append(el, gear);
        return withEcho(el, (d) => `ui-select → ${d.value} (${d.kind}, checked: ${d.checked})`, row);
      },
    },
    {
      id: 'actions',
      title: 'Actions',
      description:
        'An icon button with icons, shortcut hints, a disabled row and a danger row — placement="bottom-end".',
      height: 340,
      create: () => {
        const el = make(ACTIONS, button(icon('more'), 'ui-icon-btn is-bordered', 'Session actions'), {
          placement: 'bottom-end',
        });
        const box = withEcho(el, (d) => `ui-select → ${d.value}`);
        box.style.alignItems = 'flex-end';
        box.style.width = '100%';
        return box;
      },
    },
    {
      id: 'placement',
      title: 'Placement',
      description:
        'top-start and top-end: the menu rises from the trigger’s top corner (and flips when there is no room).',
      height: 300,
      create: () => {
        const box = document.createElement('div');
        box.style.cssText =
          'display:flex;align-items:flex-end;justify-content:space-between;gap:16px;width:100%;min-height:220px';
        box.append(
          make(PLACE, button(`top-start ${icon('chevron-up', { size: 14 })}`), { placement: 'top-start' }),
          make(PLACE, button(`top-end ${icon('chevron-up', { size: 14 })}`), { placement: 'top-end' }),
        );
        return box;
      },
    },
    {
      id: 'ko',
      title: '한국어',
      description: 'lang="ko": 기본 모델 라디오와 “열린 세션에도 적용” 체크박스.',
      height: 380,
      create: () =>
        withEcho(make(KO, button(`기본값 ${CHEV}`), { lang: 'ko' }), (d) =>
          d.kind === 'checkbox' ? `열린 세션에도 적용: ${d.checked ? '켬' : '끔'}` : `기본 모델: ${d.value}`,
        ),
    },
  ],
};
