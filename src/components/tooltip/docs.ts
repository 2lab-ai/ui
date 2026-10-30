import type { ComponentDoc } from '../../docs/types';
import { type IconName, icon } from '../../icons/icons';
import './tooltip';
import type { UiTooltip } from './tooltip';

function tip(trigger: HTMLElement, attrs: Record<string, string>, content?: HTMLElement): UiTooltip {
  const el = document.createElement('ui-tooltip');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(trigger);
  if (content) el.append(content);
  return el;
}

function iconButton(name: IconName, label: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ui-icon-btn is-bordered';
  b.setAttribute('aria-label', label);
  b.innerHTML = icon(name);
  return b;
}

function textButton(label: string, cls = 'ui-btn'): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = label;
  return b;
}

function row(...els: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:8px';
  box.append(...els);
  return box;
}

/** The dashboard's token breakdown: a quiet caption over a definition list (kit `ui-dl`). */
function breakdown(caption: string, rows: Array<[string, string]>): HTMLElement {
  const box = document.createElement('div');
  box.slot = 'content';
  const cap = document.createElement('p');
  cap.style.cssText = 'margin:0 0 6px;font-size:11.5px;line-height:16px';
  cap.textContent = caption;
  const dl = document.createElement('dl');
  dl.className = 'ui-dl';
  for (const [k, v] of rows) {
    const pair = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = k;
    dd.textContent = v;
    pair.append(dt, dd);
    dl.append(pair);
  }
  box.append(cap, dl);
  return box;
}

function chip(text: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ui-chip';
  b.innerHTML = `${icon('info')}<span></span>`;
  b.querySelector('span')!.textContent = text;
  return b;
}

export const doc: ComponentDoc = {
  slug: 'tooltip',
  name: 'Tooltip',
  tag: 'ui-tooltip',
  group: 'Primitives',
  summary: 'A short description of a control, on hover or keyboard focus — dismissible, hoverable, persistent.',
  description:
    'Wrap a control and give it text (or rich content in the content slot). The bubble shows after a short hover delay and at once on keyboard focus, never on touch; moving along a toolbar shows the next one immediately. It stays while the pointer is on it, hides on Esc or when the pointer leaves or focus goes, and pops from the side it sits on (WCAG 1.4.13). The text lives in the light DOM and the control points at it with aria-describedby, so screen readers read it as the control’s description.',
  usedIn:
    'soma-work dashboard › the token-breakdown tooltip on usage numbers (per-environment totals), chart bar tooltips, and icon buttons in card and app-bar toolbars.',
  reference: { name: 'WAI-ARIA APG Tooltip', url: 'https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/' },
  props: [
    {
      name: 'text',
      type: 'string',
      description: 'Attribute and property. The tooltip’s text — plain text, never parsed as HTML.',
    },
    { name: 'data.text', type: 'string', description: 'The same text through data; wins over the attribute.' },
    {
      name: 'slot="content"',
      type: 'HTMLElement',
      description:
        'Rich content instead of (or with) the text — e.g. a definition list in the card variant. Its id (one is given when missing) describes the trigger. Keep it non-interactive.',
    },
    {
      name: 'placement',
      type: "'top' | 'bottom' | 'top-start' | 'top-center' | 'top-end' | 'bottom-start' | 'bottom-center' | 'bottom-end'",
      default: "'top'",
      description:
        'Attribute. Side and alignment against the trigger (centred by default); flips when that side has no room.',
    },
    {
      name: 'delay',
      type: 'number',
      default: '500',
      description: 'Attribute. Hover delay in ms (keyboard focus is immediate).',
    },
    {
      name: 'variant',
      type: "'ink' | 'card'",
      default: "'ink'",
      description: 'Attribute. ink: a small inverted label. card: the raised card, for rich content.',
    },
    { name: 'disabled', type: 'boolean', description: 'Attribute. Never shows (hides at once if showing).' },
    { name: 'open', type: 'boolean', description: 'Read-only property: whether the bubble is showing.' },
    {
      name: 'show() · hide()',
      type: '() => void',
      description: 'Show at once (when not disabled and not empty) / hide.',
    },
    {
      name: 'theme',
      type: "'light' | 'dark'",
      description: 'Pins the theme (attribute). Default follows prefers-color-scheme or page tokens.',
    },
  ],
  events: [],
  keyboard: [
    ['Tab (onto the trigger)', 'Show at once on keyboard focus'],
    ['Esc', 'Hide; focus stays on the trigger and the key still reaches the page'],
    ['Tab (away)', 'Hide'],
  ],
  a11y: [
    'The trigger (the first element in the default slot) gets aria-describedby → the light-DOM text span or slotted content — an id inside a shadow root could not be referenced from it. Ids already there are kept; only ours is removed when the trigger changes or the tooltip leaves the page.',
    'The bubble is role="tooltip"; it never takes focus and should hold no interactive content (use a menu or a dialog for that).',
    'WCAG 1.4.13: dismissible (Esc, without moving focus), hoverable (100ms to cross onto the bubble, which then stays), persistent (stays until the pointer leaves, focus goes or Esc).',
    'Touch never shows it — put anything essential in the control’s label. A press on the trigger hides it.',
    'Reduced motion: no slide or scale, a 120ms fade.',
  ],
  usage: `<ui-tooltip text="Copy link to this run">
  <button class="ui-icon-btn" aria-label="Copy link">…</button>
</ui-tooltip>

<ui-tooltip variant="card" placement="bottom-start">
  <button class="ui-chip">4.6M tokens</button>
  <div slot="content">
    <dl class="ui-dl"><dt>dev</dt><dd>1.2M</dd><dt>prod</dt><dd>3.4M</dd></dl>
  </div>
</ui-tooltip>
<script type="module">
  import '@2lab.ai/ui/tooltip';
</script>`,
  demos: [
    {
      id: 'toolbar',
      title: 'Toolbar',
      description:
        'Hover one, then slide to the next: the first waits 500ms, the rest show at once. Tab through for the keyboard path.',
      height: 200,
      create: () =>
        row(
          tip(iconButton('copy', 'Copy link'), { text: 'Copy link to this run' }),
          tip(iconButton('refresh', 'Refresh'), { text: 'Refresh — updated 2 min ago' }),
          tip(iconButton('external', 'Open in new tab'), { text: 'Open in a new tab' }),
          tip(iconButton('more', 'More actions'), { text: 'More actions' }),
        ),
    },
    {
      id: 'placement',
      title: 'Placement',
      description: 'top (the default), bottom, and start / end alignment.',
      height: 220,
      create: () =>
        row(
          tip(textButton('top'), { text: 'Above, centred', placement: 'top' }),
          tip(textButton('bottom'), { text: 'Below, centred', placement: 'bottom' }),
          tip(textButton('top-start'), { text: 'Above, from the start edge', placement: 'top-start' }),
          tip(textButton('bottom-end'), { text: 'Below, to the end edge', placement: 'bottom-end' }),
        ),
    },
    {
      id: 'card',
      title: 'Card · token breakdown',
      description: 'variant="card" with rich content in the content slot: per-environment token totals.',
      height: 280,
      create: () =>
        tip(
          chip('4.6M tokens'),
          { variant: 'card', placement: 'bottom-start' },
          breakdown('Tokens by environment · last 7 days', [
            ['dev', '1.2M'],
            ['prod', '3.4M'],
            ['Total', '4.6M'],
          ]),
        ),
    },
    {
      id: 'ko',
      title: '한국어',
      description: '한국어 텍스트와 카드 — 툴팁에는 자체 문구가 없어 호스트의 문구를 그대로 보여 줍니다.',
      height: 280,
      create: () =>
        row(
          tip(iconButton('copy', '링크 복사'), { text: '이 실행의 링크 복사', lang: 'ko' }),
          tip(iconButton('refresh', '새로 고침'), { text: '새로 고침 — 2분 전에 갱신됨', lang: 'ko' }),
          tip(
            chip('토큰 4.6M'),
            { variant: 'card', placement: 'bottom-start', lang: 'ko' },
            breakdown('환경별 토큰 · 최근 7일', [
              ['dev', '1.2M'],
              ['prod', '3.4M'],
              ['합계', '4.6M'],
            ]),
          ),
        ),
    },
  ],
};
