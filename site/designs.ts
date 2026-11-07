// The Designs page (0.38.0): every design in the registry, how a page applies it, and a live dashboard built only
// from the library's own elements and kit under that design — the reference to copy when asked to build a site with
// @2lab.ai/ui in a named design. The repo keeps each design's tone & manner in designs/<id>/ (DESIGN.md + README.md).
// Relative imports (not the @2lab.ai/ui alias) so site/designs.test.ts can load this file under vitest.
import { DESIGNS, type Design } from '../src/core/tokens';
import type { IconName } from '../src/icons/icons';
import { icon } from '../src/icons/icons';

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

type CodeBlock = (code: string, id: string) => string;

/** The swatches a design card shows, in reading order: grounds, ink, then the colours that carry meaning. */
const SWATCHES = [
  'bg',
  'ib-card',
  'surface-raised',
  'ib-seg-on',
  'text',
  'text-secondary',
  'green',
  'red',
  'yellow',
  'border-focus',
];

function designCard(d: Design): string {
  const sw = SWATCHES.map(
    (k) => `<i style="background:${esc(d.tokens[k])}" title="--ui-${esc(k)} ${esc(d.tokens[k])}"></i>`,
  ).join('');
  return `<article class="dz-card">
    <div class="dz-swatches" aria-hidden="true">${sw}</div>
    <h3>${esc(d.name)} <span class="chip">${esc(d.scheme)}</span></h3>
    <p>${esc(d.summary)}</p>
    <code>data-design="${esc(d.id)}"</code>
  </article>`;
}

export function designsPage(codeBlock: CodeBlock): string {
  const d = DESIGNS[0];
  return `<div class="crumb">Getting started</div><h1>Designs <span class="chip">${DESIGNS.length}</span></h1>
  <p class="lede">A design is a whole look for a site built with these components. Its tokens recolour every element and kit class at once; its tone &amp; manner — layout, type scale, how the parts are put together — is written down beside it, so a page built from the library reads as one product.</p>
  <div class="dz-grid">${DESIGNS.map(designCard).join('')}</div>
  <h2>Apply a design</h2>
  <p class="desc">Load the page tokens and set <code>data-design</code> on <code>&lt;html&gt;</code>. A design replaces <code>data-theme</code> and <code>data-palette</code> there — it is drawn for one color scheme and keeps it whatever the OS says. Override a single token on <code>&lt;body&gt;</code> or a wrapper, not on the element that carries the design.</p>
  ${codeBlock(`<html lang="en" data-design="${d.id}">\n  <link rel="stylesheet" href="https://2lab.ai/ui/lib/tokens.css">\n  <link rel="stylesheet" href="https://2lab.ai/ui/lib/ui-kit.css">\n  <script type="module" src="https://2lab.ai/ui/lib/index.js"></script>\n\n// or with npm\nimport '@2lab.ai/ui';\nimport '@2lab.ai/ui/tokens.css';\nimport '@2lab.ai/ui/ui-kit.css';\ndocument.documentElement.dataset.design = '${d.id}';`, 'dz-apply')}
  <h2>Example — ${esc(d.name)} dashboard</h2>
  <p class="desc">Only library parts: <code>&lt;ui-app-bar&gt;</code>, <code>&lt;ui-stat-strip&gt;</code>, <code>&lt;ui-bar-chart&gt;</code>, <code>&lt;ui-tabs&gt;</code> and <code>&lt;ui-task-runs&gt;</code>. The model list and the phone dock are page markup drawn from <code>--ui-*</code> tokens alone — the row with the name on the left and aligned figures on the right, signed changes in green and red, a yellow star for a pinned row, the dock with its active capsule. Switch to Mobile for the phone layout.</p>
  <section class="preview" aria-label="Live example">
    <div class="pv-bar"><div class="pv-tools">
      <div class="seg" aria-label="Width"><button data-width="desk" aria-pressed="true">Desktop</button><button data-width="mobile" aria-pressed="false">Mobile</button></div>
    </div></div>
    <div class="pv-stage dz-stage" id="stage" data-design="${esc(d.id)}"><div class="pv-frame wide" id="frame"></div></div>
  </section>
  <h2>Build a site with a design</h2>
  <ol class="plain">
    <li>Pick the design by its id. In the repository, <code>designs/README.md</code> lists them.</li>
    <li>Read <code>designs/&lt;id&gt;/README.md</code> — which element or kit class covers each part of the spec, the token map, and what the library does not draw — then <code>designs/&lt;id&gt;/DESIGN.md</code>, the tone &amp; manner itself.</li>
    <li>Set the page up as above. Compose from the library's elements first; draw the rest as page markup with <code>--ui-*</code> tokens only (no hex), as the model list and the dock here do — <code>site/designs.ts</code> is this example's source.</li>
    <li>Check it against the spec's acceptance list at phone width (390px) and on a desktop, with a keyboard.</li>
  </ol>`;
}

/** The example's own CSS: page markup the library does not draw, from `--ui-*` tokens and `color-mix()` only. */
export const DX_CSS = `
.dx { container-type: inline-size; position: relative; display: grid; gap: 16px; padding: 0 0 16px;
  color: var(--ui-text); font-family: var(--ui-font); background: var(--ui-bg); isolation: isolate; }
/* The faint lavender light behind the header only (DESIGN.md 5.3) — never behind figures or the chart. */
.dx::before { content: ''; position: absolute; inset: 0 0 auto; height: 180px; z-index: -1; pointer-events: none;
  background: radial-gradient(70% 100% at 50% -30%, color-mix(in srgb, var(--ui-purple) 22%, transparent), transparent 70%); }
.dx-main { display: grid; gap: 20px; padding: 0 16px; }
.dx-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.dx-head h2 { margin: 0; font-size: 20px; line-height: 28px; font-weight: 600; letter-spacing: -0.01em; }
.dx-head p { margin: 0; color: var(--ui-text-secondary); font-size: 13px; }
.dx-grid { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 20px; align-items: start; }
.dx-panel { min-width: 0; }
.dx-panel > h3 { margin: 0 0 8px; font-size: 16px; line-height: 24px; font-weight: 600; }
.dx-fig { font-variant-numeric: tabular-nums lining-nums; white-space: nowrap; }
/* A row: mark, name over a quiet line, figures right-aligned over their change, then a 44px star. No card, no line. */
.dx-rows { display: grid; margin: 0; padding: 0; list-style: none; }
.dx-row { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto 44px; align-items: center; column-gap: 12px;
  min-height: 60px; padding: 8px 0; }
.dx-mark { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%;
  background: var(--ui-ib-pill); color: var(--ui-text); font-size: 12px; font-weight: 600; }
.dx-name { display: grid; gap: 2px; min-width: 0; }
.dx-name b { font-size: 16px; line-height: 22px; font-weight: 600; overflow-wrap: anywhere; }
.dx-name b small { margin-left: 6px; padding: 1px 6px; border-radius: 6px; background: var(--ui-ib-pill);
  color: var(--ui-text-secondary); font-size: 12px; font-weight: 500; vertical-align: 2px; }
.dx-name span, .dx-chg { font-size: 13px; line-height: 18px; color: var(--ui-text-secondary); }
.dx-val { display: grid; justify-items: end; gap: 2px; }
.dx-val b { font-size: 16px; line-height: 22px; font-weight: 500; }
.dx-chg[data-trend="up"] { color: var(--ui-green); }
.dx-chg[data-trend="down"] { color: var(--ui-red); }
.dx-star { display: grid; place-items: center; width: 44px; height: 44px; margin: 0; padding: 0; border: 0; border-radius: 999px;
  background: none; color: var(--ui-text-secondary); cursor: pointer; }
.dx-star[aria-pressed="true"] { color: var(--ui-yellow); }
.dx-star[aria-pressed="true"] svg { fill: currentColor; }
.dx-star:focus-visible, .dx-dock a:focus-visible { outline: 2px solid var(--ui-border-focus); outline-offset: 2px; }
/* The phone dock (DESIGN.md 5.2): equal columns — the spec's five, four sections here — the active icon on a capsule. Only at phone width. */
.dx-dock { display: none; position: sticky; bottom: 0; grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 6px 4px 8px; background: var(--ui-surface-raised); }
.dx-dock a { display: grid; justify-items: center; align-content: center; gap: 4px; min-width: 0; min-height: 56px;
  color: var(--ui-text-secondary); font-size: 11px; line-height: 16px; font-weight: 500; text-decoration: none; }
.dx-dock a span { display: grid; place-items: center; padding: 4px 16px; border-radius: 999px; }
.dx-dock a[aria-current="page"] { color: var(--ui-text); }
.dx-dock a[aria-current="page"] span { background: var(--ui-ib-seg-on); }
@container (max-width: 560px) {
  .dx-grid { grid-template-columns: minmax(0, 1fr); }
  .dx-dock { display: grid; }
  .dx-head p { display: none; }
}
`;

/**
 * A change in points (DESIGN.md §8): signed with + and the true minus sign; a change smaller than the shown precision
 * keeps its direction as "+<0.1" / "−<0.1" (never a neutral 0); exactly 0 is neutral; null is a dash.
 */
export function signedPoints(v: number | null): { text: string; trend: 'up' | 'down' | 'flat' | 'unknown' } {
  if (v === null || !Number.isFinite(v)) return { text: '—', trend: 'unknown' };
  if (v === 0) return { text: '0.0 pts', trend: 'flat' };
  const shown = Math.abs(v).toFixed(1);
  const abs = Number(shown) === 0 ? '<0.1' : shown;
  return v > 0 ? { text: `+${abs} pts`, trend: 'up' } : { text: `−${abs} pts`, trend: 'down' };
}

interface ModelRow {
  id: string;
  mark: string;
  name: string;
  badge?: string;
  line: string;
  rate: number | null;
  change: number | null;
  pinned: boolean;
}

/** Synthetic rows (no live data): up, down, exactly flat and not reported, so every figure state shows. */
export const MODEL_ROWS: ModelRow[] = [
  { id: 'opus', mark: 'O', name: 'Opus 5.5', badge: '1M', line: '1,284 runs', rate: 97.1, change: 1.2, pinned: true },
  { id: 'sonnet', mark: 'S', name: 'Sonnet 5', line: '2,310 runs', rate: 94.6, change: -0.8, pinned: false },
  { id: 'fable', mark: 'F', name: 'Fable', badge: '1M', line: '412 runs', rate: 98.0, change: 0, pinned: true },
  { id: 'haiku', mark: 'H', name: 'Haiku 5', line: '3,905 runs', rate: null, change: null, pinned: false },
];

const ENV_ROWS: ModelRow[] = [
  { id: 'mac-mini', mark: 'M', name: 'mac-mini-dev', line: '6,120 runs', rate: 96.4, change: 0.4, pinned: false },
  { id: 'oudwood', mark: 'W', name: 'oudwood-dev', line: '1,791 runs', rate: 93.8, change: -2.1, pinned: false },
];

function rowsHtml(rows: ModelRow[]): string {
  return `<ul class="dx-rows">${rows
    .map((r) => {
      const c = signedPoints(r.change);
      const rate = r.rate === null ? '—' : `${r.rate.toFixed(1)}%`;
      return `<li class="dx-row">
        <span class="dx-mark" aria-hidden="true">${esc(r.mark)}</span>
        <span class="dx-name"><b>${esc(r.name)}${r.badge ? `<small>${esc(r.badge)}</small>` : ''}</b><span class="dx-fig">${esc(r.line)}</span></span>
        <span class="dx-val"><b class="dx-fig">${esc(rate)}</b><span class="dx-chg dx-fig" data-trend="${c.trend}">${esc(c.text)}</span></span>
        <button class="dx-star" type="button" aria-pressed="${r.pinned}" aria-label="Pin ${esc(r.name)}">${icon('star', { size: 20 })}</button>
      </li>`;
    })
    .join('')}</ul>`;
}

const DOCK: Array<[string, IconName]> = [
  ['Overview', 'board'],
  ['Runs', 'list'],
  ['Models', 'brain'],
  ['Settings', 'gear'],
];

/** Builds the example dashboard into the preview frame. Every value is synthetic; nothing touches the network. */
export function mountDesignExample(frame: HTMLElement): void {
  if (!document.getElementById('dx-css')) {
    const style = document.createElement('style');
    style.id = 'dx-css';
    style.textContent = DX_CSS;
    document.head.append(style);
  }
  const now = Date.now();
  const min = 60_000;
  const day = 86_400_000;
  frame.innerHTML = `<div class="dx">
    <ui-app-bar lang="en"></ui-app-bar>
    <div class="dx-main">
      <div class="dx-head"><h2>Overview</h2><p>Synthetic data · refreshed just now</p></div>
      <ui-stat-strip lang="en"></ui-stat-strip>
      <div class="dx-grid">
        <section class="dx-panel" aria-label="Runs by day"><ui-bar-chart lang="en"></ui-bar-chart></section>
        <section class="dx-panel" aria-label="Success rate">
          <ui-tabs lang="en">
            <div slot="models">${rowsHtml(MODEL_ROWS)}</div>
            <div slot="envs">${rowsHtml(ENV_ROWS)}</div>
          </ui-tabs>
        </section>
      </div>
      <section class="dx-panel" aria-label="Recent runs"><h3>Recent runs</h3><ui-task-runs lang="en"></ui-task-runs></section>
    </div>
    <nav class="dx-dock" aria-label="Sections">${DOCK.map(
      ([label, ic], i) =>
        `<a href="#" ${i === 0 ? 'aria-current="page"' : ''}><span>${icon(ic, { size: 20 })}</span>${label}</a>`,
    ).join('')}</nav>
  </div>`;

  const bar = frame.querySelector('ui-app-bar')!;
  bar.data = {
    brand: { label: 'Agents', href: '#', mark: true },
    nav: [
      { id: 'overview', label: 'Overview', href: '#', icon: 'board', current: true },
      { id: 'runs', label: 'Runs', href: '#', icon: 'list' },
      { id: 'models', label: 'Models', href: '#', icon: 'brain' },
      { id: 'settings', label: 'Settings', href: '#', icon: 'gear' },
    ],
    status: { tone: 'run', label: 'Live', live: true },
    account: { name: 'Mina Park', role: 'Admin' },
  };
  bar.addEventListener('ui-navigate', (e) => e.preventDefault());

  frame.querySelector('ui-stat-strip')!.data = {
    period: {
      value: '7d',
      options: [
        { value: 'today', label: 'Today' },
        { value: '7d', label: '7 days' },
        { value: '30d', label: '30 days' },
      ],
    },
    metrics: [
      { key: 'runs', label: 'Runs', value: 7911 },
      { key: 'success', label: 'Success', value: 96.2, format: 'percent' },
      { key: 'tokens', label: 'Tokens', value: 48_200_000, format: 'tokens' },
      { key: 'cost', label: 'Cost', value: 1284.6, format: 'usd' },
    ],
  };

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const done = [1020, 1184, 1240, 1102, 1310, 640, 590];
  const failed = [38, 52, 31, 47, 44, 18, 12];
  frame.querySelector('ui-bar-chart')!.data = {
    title: 'Runs · last 7 days',
    series: [
      { key: 'done', label: 'Done', color: 'done' },
      { key: 'failed', label: 'Failed', color: 'fail' },
    ],
    bars: days.map((label, i) => ({
      key: label,
      label,
      title: `${label} — ${done[i]} done, ${failed[i]} failed`,
      values: { done: done[i], failed: failed[i] },
    })),
  };

  frame.querySelector('ui-tabs')!.data = {
    label: 'Success rate by',
    value: 'models',
    tabs: [
      { id: 'models', label: 'Models', badge: MODEL_ROWS.length },
      { id: 'envs', label: 'Environments' },
    ],
  };

  frame.querySelector('ui-task-runs')!.data = {
    runs: [
      {
        id: 'r3',
        ref: '#T3',
        title: 'Ship the Modern Mono design',
        status: 'running',
        startedAt: now - 12 * min,
        tools: [{ name: 'Edit', count: 9 }],
      },
      {
        id: 'r2',
        ref: '#T2',
        title: 'Map the spec onto the tokens',
        status: 'done',
        startedAt: now - 70 * min,
        endedAt: now - 31 * min,
        tokens: { input: 18_400, output: 6_200, cacheRead: 402_000 },
        costUsd: 1.84,
      },
      {
        id: 'r1',
        ref: '#T1',
        title: 'Read the reference screens',
        status: 'failed',
        startedAt: now - day,
        endedAt: now - day + 9 * min,
        costUsd: 0.21,
      },
    ],
  };
  frame.querySelector('ui-task-runs')!.addEventListener('ui-open', (e) => e.preventDefault());

  // The star is the host's toggle (DESIGN.md 6.3): its own button beside the row, never inside a row link.
  frame.addEventListener('click', (e) => {
    const star = (e.target as Element).closest('.dx-star');
    if (star) star.setAttribute('aria-pressed', String(star.getAttribute('aria-pressed') !== 'true'));
    if ((e.target as Element).closest('.dx-dock a')) e.preventDefault();
  });
}
