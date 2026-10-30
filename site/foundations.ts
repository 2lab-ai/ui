// Foundations pages: the icon set and the light-DOM CSS kit (not custom elements, so not in the component registry).
import { ICON_ALIASES, ICON_NAMES, icon } from '@2lab.ai/ui/icons/icons';
import { KIT_CLASSES } from '@2lab.ai/ui/kit/kit';

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

type CodeBlock = (code: string, id: string) => string;

export function iconsPage(codeBlock: CodeBlock): string {
  const tiles = ICON_NAMES.map(
    (n) =>
      `<button class="ic-tile" data-copy-text="${esc(`icon('${n}')`)}" title="Copy icon('${esc(n)}')">${icon(n, { size: 20 })}<span>${esc(n)}</span></button>`,
  ).join('');
  const sizes = [12, 14, 16, 20, 24]
    .map((s) => `<span class="ic-size">${icon('gear', { size: s })}<small>${s}</small></span>`)
    .join('');
  const aliases = Object.entries(ICON_ALIASES)
    .map(([a, n]) => `<tr><td><code>${esc(a)}</code></td><td><code>${esc(n)}</code></td></tr>`)
    .join('');
  return `<div class="crumb">Foundations</div><h1>Icons <span class="chip">${ICON_NAMES.length}</span></h1>
  <p class="lede">One hand for every glyph: a 16-unit grid, 1.5px strokes with round caps and joins, drawn in <code>currentColor</code> — the same set the components draw with. <code>icon(name)</code> returns an SVG string; it is decorative unless you give it a label.</p>
  <div class="ic-grid" role="list">${tiles}</div>
  <p class="desc" style="margin-top:10px">Click a glyph to copy its call.</p>
  <h2>Usage</h2>
  ${codeBlock(`import { icon } from '@2lab.ai/ui/icons';\n\nbutton.innerHTML = icon('close');                  // decorative, 16px\nbutton.setAttribute('aria-label', 'Close');\nstatus.innerHTML = icon('alert', { label: 'Warning' });  // role="img" + <title>\nchip.innerHTML = icon('file-code', { size: 12, class: 'glyph' });`, 'icon-use')}
  <h2>Sizes</h2>
  <p class="desc">Drawn for 16px; reads from 12px (chips, inline marks) to 24px (empty states). The stroke stays 1.5 grid units, so it thins as the glyph shrinks.</p>
  <div class="ic-sizes">${sizes}</div>
  <h2>Options</h2>
  <div class="tbl"><table><thead><tr><th>Option</th><th>Type</th><th>Default</th><th>What</th></tr></thead><tbody>
    <tr><td><code>size</code></td><td><code class="type">number</code></td><td><code>16</code></td><td>Width and height in px.</td></tr>
    <tr><td><code>label</code></td><td><code class="type">string</code></td><td>—</td><td>Accessible name: role="img", aria-label and a &lt;title&gt;. Without it the SVG is aria-hidden.</td></tr>
    <tr><td><code>class</code></td><td><code class="type">string</code></td><td>—</td><td>Class names on the &lt;svg&gt;.</td></tr>
    <tr><td><code>stroke</code></td><td><code class="type">number</code></td><td><code>1.5</code></td><td>Stroke width in grid units.</td></tr>
  </tbody></table></div>
  <h2>Aliases</h2>
  <p class="desc">The names hosts reach for resolve to the same glyphs. Unknown names return an empty string, so a render never throws.</p>
  <div class="tbl"><table><thead><tr><th>Alias</th><th>Glyph</th></tr></thead><tbody>${aliases}</tbody></table></div>`;
}

interface KitSpecimen {
  title: string;
  cls: string;
  desc: string;
  html: string;
}

const I = (n: string, size?: number) => icon(n, size ? { size } : {});

const SPECIMENS: KitSpecimen[] = [
  {
    title: 'Button',
    cls: 'ui-btn',
    desc: 'Neutral by default; one ink primary per surface; quiet for low-emphasis; danger for destructive. Hover changes only the border or fill (fine pointers), press scales to .97, touch gets 44px.',
    html: `<div class="kit-row"><button class="ui-btn">Cancel</button><button class="ui-btn is-primary">Start task</button><button class="ui-btn is-quiet">${I('refresh')}Retry</button><button class="ui-btn is-danger">Stop</button><button class="ui-btn is-danger is-primary">Delete</button><button class="ui-btn" disabled>Disabled</button></div>
<div class="kit-row"><button class="ui-btn is-sm">Small</button><button class="ui-btn">Default</button><button class="ui-btn is-lg is-primary">${I('plus')}New task</button></div>`,
  },
  {
    title: 'Icon button',
    cls: 'ui-icon-btn',
    desc: 'Close buttons and tools: quiet by default, bordered for app-bar controls; aria-pressed / aria-expanded draw the pill.',
    html: `<div class="kit-row"><button class="ui-icon-btn" aria-label="Close">${I('close')}</button><button class="ui-icon-btn" aria-label="Attach">${I('attach')}</button><button class="ui-icon-btn" aria-label="Voice" aria-pressed="true">${I('mic')}</button><button class="ui-icon-btn is-sm" aria-label="More">${I('more')}</button><button class="ui-icon-btn is-bordered" aria-label="Theme">${I('moon')}</button><button class="ui-icon-btn is-bordered" aria-label="Settings">${I('gear')}</button></div>`,
  },
  {
    title: 'Floating action button',
    cls: 'ui-fab',
    desc: 'Ink, 56px, raised; enters from opacity 0 and scale(.95) in 240ms — no rings, no loops. Fixed to the corner (safe-area aware); .is-inline places it in flow.',
    html: `<div class="kit-row"><button class="ui-fab is-inline" aria-label="New task">${I('plus')}</button></div>`,
  },
  {
    title: 'Chip',
    cls: 'ui-chip',
    desc: 'A pill label, or a toggle when it is a button: “on” is the raised neutral chip, never an accent fill.',
    html: `<div class="kit-row"><span class="ui-chip">${I('file-code', 12)}report.html</span><span class="ui-chip">${I('file-image', 12)}chart.png</span><button class="ui-chip" aria-pressed="true">Mine</button><button class="ui-chip" aria-pressed="false">All</button><span class="ui-chip is-quiet">+3</span></div>`,
  },
  {
    title: 'Status',
    cls: 'ui-status',
    desc: 'A tone dot and a word in the st-* tones; text is mixed toward ink (≥ 4.5:1 in both themes). .is-pill adds the 16% tint; data-live pulses the dot.',
    html: `<div class="kit-row"><span class="ui-status" data-tone="run" data-live>Running</span><span class="ui-status" data-tone="wait">Needs you</span><span class="ui-status" data-tone="done">Done</span><span class="ui-status" data-tone="fail">Failed</span><span class="ui-status" data-tone="rest">Idle</span></div>
<div class="kit-row"><span class="ui-status is-pill" data-tone="run" data-live>Live</span><span class="ui-status is-pill" data-tone="wait">Reconnecting</span><span class="ui-status is-pill" data-tone="done">Connected</span><span class="ui-status is-pill" data-tone="fail">Offline</span><span class="ui-status is-pill is-hollow" data-tone="rest">Sleeping</span></div>`,
  },
  {
    title: 'Keyboard key',
    cls: 'ui-kbd',
    desc: 'Shortcut hints next to an action.',
    html: `<div class="kit-row"><span class="kit-say">New task <kbd class="ui-kbd">N</kbd></span><span class="kit-say">Send <kbd class="ui-kbd">⌘</kbd><kbd class="ui-kbd">↵</kbd></span><span class="kit-say">Close <kbd class="ui-kbd">Esc</kbd></span></div>`,
  },
  {
    title: 'Definition list',
    cls: 'ui-dl',
    desc: 'Label / value pairs (session facts, run metadata). Values are tabular; .is-stacked puts labels above values.',
    html: `<dl class="ui-dl"><dt>Model</dt><dd>claude-opus-5-5[1m]</dd><dt>Started</dt><dd>10:42 · 18m ago</dd><dt>Tokens</dt><dd>272.8K</dd><dt>Cost</dt><dd>$4.12</dd></dl>`,
  },
  {
    title: 'Skeleton',
    cls: 'ui-skeleton',
    desc: 'An opacity pulse where content will be — never a false “0”. Stagger with style="--i: n" (120ms steps).',
    html: `<div class="kit-col" aria-hidden="true"><span class="ui-skeleton is-title"></span><span class="ui-skeleton is-line" style="--i:1;width:42%"></span><span class="ui-skeleton is-pill" style="--i:2"></span></div>`,
  },
  {
    title: 'Empty state',
    cls: 'ui-empty',
    desc: 'Quiet, centred, with one strong line.',
    html: `<div class="ui-empty">${I('list', 20)}<strong>No runs in this period</strong>Runs appear here as soon as a job starts.</div>`,
  },
  {
    title: 'Status line',
    cls: 'ui-status-line',
    desc: 'The quiet line under a control (role="status"): saved, failed, waiting. Hidden while empty.',
    html: `<div class="kit-col"><p class="ui-status-line" data-tone="done" role="status">${I('check', 12)}Saved — applies to new sessions</p><p class="ui-status-line" data-tone="fail" role="status">${I('alert', 12)}Couldn’t save: HTTP 502</p><p class="ui-status-line" data-tone="wait" role="status">Saving…</p></div>`,
  },
  {
    title: 'Avatar',
    cls: 'ui-avatar',
    desc: 'A glyph tile with a hairline — a letter, an icon or an image. No emoji.',
    html: `<div class="kit-row"><span class="ui-avatar is-sm">${I('user')}</span><span class="ui-avatar">${I('bot')}</span><span class="ui-avatar">Z</span><span class="ui-avatar is-lg">${I('brand')}</span><span class="ui-avatar is-lg is-round">${I('user')}</span></div>`,
  },
  {
    title: 'Expand',
    cls: 'ui-expand',
    desc: 'grid-template-rows 0fr → 1fr with an opacity fade on --dur-expand; closed content is hidden from focus (add inert too). Pair with a .ui-chev that turns while [aria-expanded="true"].',
    html: `<div class="kit-col"><button class="ui-btn is-quiet" aria-expanded="false" data-kit-expand>${icon('chevron-right', { size: 12, class: 'ui-chev' })}Details</button><div class="ui-expand"><div><p style="margin:6px 0 0">Expanded content rides the animated row; nothing below jumps.</p></div></div></div>`,
  },
];

/** In the code sample an inline SVG reads as the call that makes it: \${icon('name')}. */
const iconCall = (svg: string): string => `\${icon('${/data-icon="([^"]+)"/.exec(svg)?.[1] ?? ''}')}`;

export function kitPage(codeBlock: CodeBlock): string {
  const blocks = SPECIMENS.map(
    (s, i) => `<h2 id="${esc(s.cls)}">${esc(s.title)} <span class="chip"><code>.${esc(s.cls)}</code></span></h2>
  <p class="desc">${esc(s.desc)}</p>
  <div class="kit-pair"><div class="kit-stage" data-theme="light">${s.html}</div><div class="kit-stage" data-theme="dark">${s.html}</div></div>
  ${codeBlock(s.html.replace(/<svg[\s\S]*?<\/svg>/g, iconCall), `kit-${i}`)}`,
  ).join('');
  return `<div class="crumb">Foundations</div><h1>UI kit <span class="chip">ui-kit.css</span></h1>
  <p class="lede">Light-DOM classes for the parts of a host page that are not components: buttons, chips, status words, keys, facts, skeletons, empty states, avatars. Same tokens, same motion, same calm — every value is a <code>--ui-*</code> token or a <code>color-mix()</code> of them.</p>
  ${codeBlock(`import '@2lab.ai/ui/tokens.css';   // the --ui-* tokens (or map your own onto them)\nimport '@2lab.ai/ui/ui-kit.css';\n\n// or as a string, e.g. for a shadow root or a server-rendered <style>\nimport { kitCss } from '@2lab.ai/ui/kit';`, 'kit-import')}
  <p class="desc">Classes: ${KIT_CLASSES.map((c) => `<code>.${esc(c)}</code>`).join(' · ')}. Modifiers are <code>is-*</code>; tones are <code>data-tone="run | wait | done | fail | rest"</code>.</p>
  ${blocks}`;
}

/** Wire the kit page's live bits (the expand demo). */
export function wireKit(root: ParentNode): void {
  for (const b of Array.from(root.querySelectorAll<HTMLElement>('[data-kit-expand]'))) {
    b.addEventListener('click', () => {
      const open = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', String(open));
      const region = b.nextElementSibling as HTMLElement | null;
      region?.classList.toggle('is-open', open);
      region?.toggleAttribute('inert', !open);
    });
    const region = b.nextElementSibling as HTMLElement | null;
    region?.setAttribute('inert', '');
  }
}
