import type { ComponentDoc } from '../../docs/types';
import './segmented';
import type { SegmentedData } from './segmented';

function make(data: SegmentedData, attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('ui-segmented');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

/** The control plus the quiet status line a host would show under it. */
function withEcho(el: HTMLElement, say: (v: string) => string): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:10px';
  const line = document.createElement('p');
  line.className = 'ui-status-line';
  line.setAttribute('role', 'status');
  el.addEventListener('ui-change', (e) => {
    line.textContent = say((e as CustomEvent<{ value: string }>).detail.value);
  });
  box.append(el, line);
  return box;
}

const PERIOD: SegmentedData = {
  label: 'Period',
  value: '7d',
  options: [
    { value: 'today', label: 'Today' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
  ],
};

const VIEW: SegmentedData = {
  label: 'View',
  value: 'board',
  options: [
    { value: 'board', label: 'Board', icon: 'board' },
    { value: 'list', label: 'List', icon: 'list' },
  ],
};

export const doc: ComponentDoc = {
  slug: 'segmented',
  name: 'Segmented',
  tag: 'ui-segmented',
  group: 'Primitives',
  summary: 'One choice among a few — period, view, mode — with the choice on a raised chip that slides.',
  description:
    'A radio group drawn as the dashboard’s segmented well: the checked option sits on a raised neutral chip (never an accent fill) and the chip slides to the next choice. Options share one width, so the chip is placed by CSS alone — right on first paint, and through any resize. Arrows move and choose (roving tabindex); choosing sends a cancelable ui-change and, unless a listener cancels it, the control shows the new value at once.',
  usedIn:
    'soma-work dashboard › stats period (오늘 · 지난 7일 · 지난 30일, B-02) and board view (Board · List, D-02); the model picker’s effort levels use the same well.',
  reference: { name: 'WAI-ARIA APG Radio Group', url: 'https://www.w3.org/WAI/ARIA/apg/patterns/radio/' },
  props: [
    {
      name: 'data.options',
      type: 'Array<{ value: string; label: string; icon?: IconName; iconOnly?: boolean; disabled?: boolean; title?: string }>',
      required: true,
      description:
        'The choices, in order. Duplicate values are drawn once. `icon` names a glyph from @2lab.ai/ui/icons.',
    },
    { name: 'data.value', type: 'string', description: 'The checked option. None checked (no chip) when missing.' },
    { name: 'data.label', type: 'string', description: 'Accessible name of the group (“Period”, “View”).' },
    {
      name: 'data.disabled',
      type: 'boolean | string',
      description: 'Read-only. A string is the reason, shown as the tooltip on every option.',
    },
    {
      name: 'size',
      type: "'md' | 'sm'",
      default: "'md'",
      description: 'Attribute. 28px or 24px options (44px on touch).',
    },
    { name: 'full', type: 'boolean', description: 'Attribute. Stretch to the container’s width.' },
    { name: 'value', type: 'string | undefined', description: 'Read-only property: the checked value.' },
    {
      name: 'theme',
      type: "'light' | 'dark'",
      description: 'Pins the theme (attribute). Default follows prefers-color-scheme or page tokens.',
    },
  ],
  events: [
    {
      name: 'ui-change',
      detail: '{ value: string; previous: string | undefined }',
      description:
        'A different option was chosen (click, arrows, Home / End). Cancelable: preventDefault() keeps the old value; otherwise the control shows the new one until you set data again.',
    },
  ],
  keyboard: [
    ['Tab', 'Focus the checked option (one tab stop for the group)'],
    ['← / →', 'Move to and choose the previous / next option (wraps; skips disabled)'],
    ['↑ / ↓', 'Same as ← / →'],
    ['Home / End', 'Choose the first / last option'],
    ['Space / Enter', 'Choose the focused option'],
  ],
  a11y: [
    'role="radiogroup" named by data.label; each option is role="radio" with aria-checked, so screen readers announce “2 of 3, checked”.',
    'Roving tabindex: one tab stop; disabled options use aria-disabled and are skipped by the arrows.',
    'Icon-only options carry their label as aria-label and tooltip.',
    'The chip is aria-hidden decoration; state is in aria-checked, colour is never the only signal (the label turns to ink too).',
    'Reduced motion: the chip jumps instead of sliding.',
    'Sound (opt-in, @2lab.ai/ui/sound): a new choice by click or arrow plays select, forward to a later option and back to an earlier one. Silent until the page turns sound on.',
  ],
  usage: `<ui-segmented id="period"></ui-segmented>
<script type="module">
  import '@2lab.ai/ui/segmented';
  const seg = document.getElementById('period');
  seg.data = {
    label: 'Period', value: '7d',
    options: [
      { value: 'today', label: 'Today' },
      { value: '7d', label: 'Last 7 days' },
      { value: '30d', label: 'Last 30 days' },
    ],
  };
  seg.addEventListener('ui-change', (e) => loadStats(e.detail.value));
</script>`,
  demos: [
    {
      id: 'period',
      title: 'Period',
      description: 'Click or use the arrows: the chip slides, ui-change reports the value.',
      height: 220,
      create: () => withEcho(make(PERIOD), (v) => `ui-change → ${v}`),
    },
    {
      id: 'icons',
      title: 'Icons',
      description: 'Board / List with glyphs, and an icon-only theme switch (label as accessible name).',
      height: 220,
      create: () => {
        const box = document.createElement('div');
        box.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:16px';
        box.append(
          make(VIEW),
          make({
            label: 'Theme',
            value: 'system',
            options: [
              { value: 'light', label: 'Light', icon: 'sun', iconOnly: true },
              { value: 'dark', label: 'Dark', icon: 'moon', iconOnly: true },
              { value: 'system', label: 'System', icon: 'gear', iconOnly: true },
            ],
          }),
        );
        return box;
      },
    },
    {
      id: 'states',
      title: 'Sizes & states',
      description: 'size="sm", full width, a disabled option, and a read-only control with its reason.',
      height: 260,
      create: () => {
        const box = document.createElement('div');
        box.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:14px;width:100%';
        box.append(
          make(PERIOD, { size: 'sm' }),
          make({ ...VIEW, value: 'list' }, { full: '' }),
          make({
            label: 'Effort',
            value: 'high',
            options: [
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'max', label: 'Max', disabled: true, title: 'This model runs up to High' },
            ],
          }),
          make({ ...PERIOD, disabled: 'Read-only — not your dashboard' }),
        );
        return box;
      },
    },
    {
      id: 'ko',
      title: '한국어',
      height: 220,
      create: () =>
        withEcho(
          make(
            {
              label: '기간',
              value: 'today',
              options: [
                { value: 'today', label: '오늘' },
                { value: '7d', label: '지난 7일' },
                { value: '30d', label: '지난 30일' },
              ],
            },
            { lang: 'ko' },
          ),
          (v) => `선택: ${v}`,
        ),
    },
  ],
};
