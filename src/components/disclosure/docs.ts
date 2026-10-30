import type { ComponentDoc } from '../../docs/types';
import './disclosure';
import type { DisclosureData, UiDisclosure } from './disclosure';

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

let demoSeq = 0;

/** G4-1: the stats strip — the trigger sits at the end of the figures row, the region opens under the whole row. */
function statsStrip(): HTMLElement {
  const id = `stats-more-${++demoSeq}`;
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:8px;width:100%';
  const row = document.createElement('div');
  row.style.cssText =
    'display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;font-size:13px;color:var(--ui-ib-text-2)';
  for (const t of ['Last 7 days', '12 sessions', '1.2M tokens', '$18.40']) {
    const span = document.createElement('span');
    span.textContent = t;
    row.append(span);
  }
  const more = document.createElement('button');
  more.type = 'button';
  more.id = id;
  more.className = 'ui-btn is-sm is-quiet';
  more.textContent = 'More';
  more.style.marginInlineStart = 'auto';
  row.append(more);
  const el = make(
    {},
    facts([
      ['dev', '412K tokens · $6.10'],
      ['prod', '788K tokens · $12.30'],
      ['Busiest day', 'Thu · 4 sessions'],
    ]),
    { trigger: 'external', for: id },
  );
  box.append(row, el);
  return box;
}

/** G4-2: a region painted only while open — built on ui-toggle, dropped on ui-toggled (closed). */
function lazyTasks(): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:8px;width:100%';
  const el = document.createElement('ui-disclosure') as UiDisclosure;
  el.setAttribute('variant', 'card');
  el.data = { summary: 'Tasks', meta: '5' };
  const body = document.createElement('ol');
  body.style.cssText = 'margin:0;padding-left:18px;line-height:1.7';
  el.append(body);
  const line = document.createElement('p');
  line.className = 'ui-status-line';
  line.setAttribute('role', 'status');
  const say = () => {
    line.textContent = `${body.childElementCount} task rows in the DOM`;
  };
  el.addEventListener('ui-toggle', (e) => {
    if (!(e as CustomEvent<{ open: boolean }>).detail.open) return;
    body.replaceChildren(
      ...[
        'Read the failing test',
        'Reproduce the flake',
        'Patch the retry delay',
        'Run the suite ×20',
        'Open the PR',
      ].map((t) => Object.assign(document.createElement('li'), { textContent: t })),
    );
    say();
  });
  el.addEventListener('ui-toggled', (e) => {
    if ((e as CustomEvent<{ open: boolean }>).detail.open) return;
    body.replaceChildren();
    say();
  });
  say();
  box.append(el, line);
  return box;
}

/** G4-3: rows of a roved list — the list owns one tab stop and the arrows; each row's head is tabindex -1. */
function rovedRows(): HTMLElement {
  const list = document.createElement('div');
  list.setAttribute('role', 'group');
  list.setAttribute('aria-label', 'Work log (↑ ↓ move, Enter opens)');
  list.style.cssText = 'display:flex;flex-direction:column;gap:2px;width:100%';
  const rows = [
    ['Read the failing test', '4 calls', 'Read upload.test.ts · Read upload-retry.ts · Grep “retryAfter”'],
    ['Reproduce the flake', '7 calls', 'Bash npm test -- upload ×5 · 2 failures on the 3rd retry'],
    ['Patch the retry delay', '3 calls', 'Edit upload-retry.ts · Bash npm test -- upload ×20'],
  ].map(([summary, meta, t], i) => make({ summary, meta }, text(t), { 'head-tabindex': i === 0 ? '0' : '-1' }));
  list.append(...rows);
  list.addEventListener('keydown', (e) => {
    const at = rows.findIndex((r) => r.contains(document.activeElement) || r === document.activeElement);
    const to = e.key === 'ArrowDown' ? at + 1 : e.key === 'ArrowUp' ? at - 1 : -2;
    if (to === -2 || at < 0) return;
    e.preventDefault();
    const next = rows[Math.max(0, Math.min(rows.length - 1, to))];
    for (const r of rows) r.setAttribute('head-tabindex', r === next ? '0' : '-1');
    next.focus();
  });
  return list;
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
    'A summary row (chevron, text, optional quiet meta such as a count) over a region the host slots in. Opening turns the chevron on the press duration and grows the region from 0fr to 1fr with a fade on the expand duration — the same recipe as the board’s cards — so everything below rides along instead of jumping. While closed the region is inert: nothing inside takes focus or clicks. Toggling sends a cancelable ui-toggle; setting open from the host changes state without an event. It is also the recipe for an info summary — no separate element: the one-line summary (owner · workflow · tokens · cost · last activity) as `summary`, a quiet `meta`, and a kit `.ui-dl` fact grid as the region (see the Info summary demo).',
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
      name: 'show() · hide()',
      type: 'method',
      description: 'Open / close as if the person asked (a cancelable ui-toggle first); nothing when already there.',
    },
    {
      name: 'trigger',
      type: "'external'",
      description:
        'Attribute. No summary row: the region opens from the host’s own control elsewhere in the page (at the end of a figures row, in a goal head). Use for= to wire it, or call show() / hide() / toggle().',
    },
    {
      name: 'for',
      type: 'string (id)',
      description:
        'Attribute, with trigger="external". The id of the host’s button: its clicks toggle the region and it gets aria-expanded and aria-controls (this element; one id is given when missing). Looked up on each use, so a repainted button keeps working. Do not also call toggle() from that button.',
    },
    {
      name: 'head-tabindex',
      type: 'number',
      description:
        'Attribute. The row button’s tabindex — "-1" for rows in a list that owns the tab stop and the arrow keys. el.focus() then focuses the row (unless the element has its own tabindex).',
    },
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
    {
      name: 'ui-toggled',
      detail: '{ open: boolean }',
      description:
        'Notification (not cancelable) once the region has settled after any change — its grow or shrink ended (at once under reduced motion). A host can paint a region on ui-toggle (open) and drop its nodes on ui-toggled (closed). Not sent for the state the element starts in.',
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
    'trigger="external" with for=: the host’s button carries aria-expanded and aria-controls → this element; focus stays on it when the region opens.',
    'head-tabindex="-1": the row leaves the tab order for a roved list; Enter / Space on the focused row still toggle, and a click on slotted summary content toggles like a click on the row.',
    'Sound (opt-in, @2lab.ai/ui/sound): the row or the external trigger plays a subtle open / close unless ui-toggle is cancelled; toggle() / show() / hide() do the same only inside a click or key press; the open property and attribute are silent. Silent until the page turns sound on.',
  ],
  usage: `<ui-disclosure summary="Session info" meta="6">
  <dl class="ui-dl">…</dl>
</ui-disclosure>

<!-- The info summary recipe: one summary line, a quiet meta, a .ui-dl fact grid. -->
<ui-disclosure variant="card" summary="Dana Kim · code-review · 12.3K tokens · $0.42 · 3m ago" meta="ctx 27%">
  <dl class="ui-dl"><dt>Model</dt><dd>claude-opus-5-5[1m]</dd><dt>Cost</dt><dd>$0.42</dd>…</dl>
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
      id: 'info',
      title: 'Info summary',
      description:
        'The recipe for an info summary: the whole record in one summary line, a quiet meta, and a two-column .ui-dl fact grid when opened.',
      height: 380,
      create: () =>
        make(
          { summary: 'Dana Kim · code-review · 12.3K tokens · $0.42 · 3m ago', meta: 'ctx 27%' },
          facts([
            ['Agent', 'claude-opus-5-5[1m]'],
            ['Started by', 'Dana Kim'],
            ['Workflow', 'code-review'],
            ['Tool calls', '48'],
            ['Input', '9.8K'],
            ['Output', '2.5K'],
            ['Cache read', '272.3K'],
            ['Cost', '$0.42'],
            ['Last activity', '3m ago'],
          ]),
          { variant: 'card', level: '3' },
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
      id: 'external',
      title: 'External trigger',
      description:
        'trigger="external" for="…": More sits at the end of the figures row and opens the detail under the whole row.',
      height: 260,
      create: statsStrip,
    },
    {
      id: 'lazy',
      title: 'Lazy region',
      description:
        'The task rows are built on ui-toggle (open) and dropped on ui-toggled (closed), after the region has folded.',
      height: 320,
      create: lazyTasks,
    },
    {
      id: 'roved',
      title: 'Roved rows',
      description: 'head-tabindex="-1" on all rows but one: ↑ / ↓ move between rows with el.focus(), Enter opens.',
      height: 300,
      create: rovedRows,
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
