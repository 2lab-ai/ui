import type { ComponentDoc } from '../../docs/types';
import './disclosure';
import type { DisclosureData } from './disclosure';

function make(data: DisclosureData, body: (box: HTMLElement) => void, attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('ui-disclosure');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  const inner = document.createElement('div');
  body(inner);
  el.append(inner);
  el.data = data;
  return el;
}

function facts(rows: Array<[string, string]>): (box: HTMLElement) => void {
  return (box) => {
    const dl = document.createElement('dl');
    dl.className = 'ui-dl';
    for (const [k, v] of rows) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      dl.append(dt, dd);
    }
    box.append(dl);
  };
}

function text(t: string): (box: HTMLElement) => void {
  return (box) => {
    box.textContent = t;
  };
}

function stack(...els: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:4px;width:100%';
  box.append(...els);
  return box;
}

export const doc: ComponentDoc = {
  slug: 'disclosure',
  name: 'Disclosure',
  tag: 'ui-disclosure',
  group: 'Primitives',
  summary: 'Detail you open when you want it — the region grows in place and is out of the way while closed.',
  description:
    'A summary row (chevron, text, optional quiet meta such as a count) over a region the host slots in. Opening turns the chevron on the press duration and grows the region from 0fr to 1fr with a fade on the expand duration — the same recipe as the board’s cards — so everything below rides along instead of jumping. While closed the region is inert: nothing inside takes focus or clicks. Toggling sends a cancelable ui-toggle; setting open from the host changes state without an event.',
  usedIn:
    'soma-work dashboard › 11 hand-rolled disclosures (K-06): stats 자세히, 세션 정보, panel sections, work-log groups, raw turn <details>, goal history, task plan toggles.',
  reference: { name: 'WAI-ARIA APG Disclosure', url: 'https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/' },
  props: [
    {
      name: 'open',
      type: 'boolean',
      default: 'false',
      description: 'Attribute / property. Set by the host: no event.',
    },
    {
      name: 'summary',
      type: 'string',
      description: 'Attribute (or data.summary): the row text. Slot `summary` for markup.',
    },
    {
      name: 'meta',
      type: 'string',
      description: 'Attribute (or data.meta): quiet text at the row end (a count, a time). Slot `meta`.',
    },
    { name: 'data.disabled', type: 'boolean', description: 'The row does not toggle (aria-disabled).' },
    {
      name: 'level',
      type: '1–6',
      description: 'Attribute. Wraps the row in role="heading" aria-level for section heads.',
    },
    {
      name: 'variant',
      type: "'plain' | 'card'",
      default: "'plain'",
      description: 'Attribute. card: a 12px card with a hairline.',
    },
    { name: 'flush', type: 'boolean', description: 'Attribute. No padding around the region’s content.' },
    { name: 'toggle()', type: 'method', description: 'Toggle as if the person pressed the row (sends ui-toggle).' },
    {
      name: 'theme',
      type: "'light' | 'dark'",
      description: 'Pins the theme (attribute). Default follows prefers-color-scheme or page tokens.',
    },
  ],
  events: [
    {
      name: 'ui-toggle',
      detail: '{ open: boolean }',
      description:
        'The person pressed the row; `open` is the requested state. Cancelable: preventDefault() keeps the current state.',
    },
  ],
  keyboard: [
    ['Tab', 'Focus the summary row'],
    ['Enter / Space', 'Open or close'],
  ],
  a11y: [
    'The row is a button with aria-expanded and aria-controls pointing at the region.',
    'Closed, the region is inert and hidden once its fade ends, so its contents leave the tab order and the accessibility tree.',
    'level="n" makes the row a heading of that level for page structure.',
    'Reduced motion: the region opens at once with a short fade; the chevron does not turn.',
  ],
  usage: `<ui-disclosure summary="Session info" meta="6">
  <dl class="ui-dl">…</dl>
</ui-disclosure>
<script type="module">
  import '@2lab.ai/ui/disclosure';
  const d = document.querySelector('ui-disclosure');
  d.addEventListener('ui-toggle', (e) => localStorage.setItem('info-open', e.detail.open));
</script>`,
  demos: [
    {
      id: 'groups',
      title: 'Work-log groups',
      description: 'Step groups with a count: the region grows in place, rows below ride along.',
      height: 340,
      create: () =>
        stack(
          make(
            { summary: 'Read the failing test', meta: '4 calls' },
            text('Read upload.test.ts · Read upload-retry.ts · Grep “retryAfter” · Read jest.config.ts'),
            {
              open: '',
            },
          ),
          make(
            { summary: 'Reproduce the flake', meta: '7 calls' },
            text('Bash npm test -- upload ×5 · 2 failures, both on the 3rd retry.'),
          ),
          make(
            { summary: 'Patch the retry delay', meta: '3 calls' },
            text('Edit upload-retry.ts · Bash npm test -- upload ×20 · all green.'),
          ),
        ),
    },
    {
      id: 'card',
      title: 'Card · session info',
      description: 'variant="card" with a definition list (kit .ui-dl) and a heading level for structure.',
      height: 320,
      create: () =>
        make(
          { summary: 'Session info', meta: '5' },
          facts([
            ['Model', 'claude-opus-5-5[1m]'],
            ['Started', '10:42 · 18m ago'],
            ['Tokens', '272.8K'],
            ['Cost', '$4.12'],
            ['Workspace', 'soma-work · feat/upload-retry'],
          ]),
          { variant: 'card', level: '3', open: '' },
        ),
    },
    {
      id: 'guarded',
      title: 'Cancelable',
      description: 'The host cancels ui-toggle while the section is locked; the status line says why.',
      height: 260,
      create: () => {
        const box = document.createElement('div');
        box.style.cssText = 'display:flex;flex-direction:column;gap:8px;width:100%';
        const el = make({ summary: 'Raw request (admin only)' }, text('{"model":"opus","max_tokens":32000}'));
        const line = document.createElement('p');
        line.className = 'ui-status-line';
        line.setAttribute('role', 'status');
        el.addEventListener('ui-toggle', (e) => {
          e.preventDefault();
          line.dataset.tone = 'wait';
          line.textContent = 'Locked — ask an admin to open raw requests.';
        });
        box.append(el, line);
        return box;
      },
    },
    {
      id: 'ko',
      title: '한국어',
      height: 300,
      create: () =>
        stack(
          make(
            { summary: '자세히', meta: '3' },
            facts([
              ['세션', '12'],
              ['토큰', '1.2M'],
              ['비용', '$18.40'],
            ]),
            { lang: 'ko', open: '' },
          ),
          make({ summary: '목표 변경 기록', meta: '2' }, text('10:12 목표 설정 · 10:40 목표 수정'), { lang: 'ko' }),
        ),
    },
  ],
};
