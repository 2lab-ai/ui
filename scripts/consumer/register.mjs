// Runtime smoke test against the installed package: each of the 36 element subpaths registers its element(s) (37 in
// all); the icon set and the kit load and return their strings.
import { Window } from 'happy-dom';

const w = new Window();
// Expose the window's globals (classes as-is, methods bound) the way a browser page sees them.
for (const key of Object.getOwnPropertyNames(w)) {
  if (key in globalThis) continue;
  const value = w[key];
  globalThis[key] = typeof value === 'function' && !/^[A-Z]/.test(key) ? value.bind(w) : value;
}
Object.assign(globalThis, { window: w, document: w.document });

const slugs = [
  'agent-run',
  'agent-inbox',
  'agent-steering',
  'agent-tree',
  'ai-answer',
  'approval-card',
  'agent-queue',
  'context-window',
  'compact-breakdown',
  'memory-panel',
  'model-picker',
  'tool-call-card',
  'toaster',
  'segmented',
  'tabs',
  'menu',
  'tooltip',
  'hovercard',
  'dialog',
  'drawer',
  'disclosure',
  'app-bar',
  'stat-strip',
  'bar-chart',
  'file-card',
  'artifact-viewer',
  'composer',
  'log-scroller',
  'goal-card',
  'choice-form',
  'task-plan',
  'task-runs',
  'status-bar',
  'deck-nav',
  'conversation',
  'work-log',
];
// Subpaths that register more than their own tag.
const extra = {
  'tool-call-card': ['ui-tool-call-group'],
  conversation: ['ui-log-scroller', 'ui-ai-answer'],
  'work-log': ['ui-log-scroller', 'ui-tool-call-card', 'ui-tool-call-group'],
};
const missing = [];
for (const slug of slugs) {
  await import(`@2lab.ai/ui/${slug}`);
  for (const tag of [`ui-${slug}`, ...(extra[slug] ?? [])]) if (!customElements.get(tag)) missing.push(tag);
}
await import('@2lab.ai/ui');
const el = document.createElement('ui-context-window');
document.body.append(el);
el.data = { window: 1_000_000, autoCompactAt: 750_000, parts: { cacheRead: 272_300, output: 10 } };
el.renderNow();
const cb = document.createElement('ui-compact-breakdown');
document.body.append(cb);
cb.data = { title: 'Spend by model', unit: 'usd', parts: [{ key: 'opus', label: 'claude-opus-4-7', value: 12.5 }] };
cb.renderNow();
const rendered =
  (el.shadowRoot?.innerHTML ?? '').length > 0 &&
  (cb.shadowRoot?.querySelector('.cb-item')?.textContent ?? '').includes('$12.50');
if (missing.length || !rendered) {
  console.error(`register: missing=[${missing.join(',')}] rendered=${rendered}`);
  process.exit(1);
}
const at = document.createElement('ui-agent-tree');
document.body.append(at);
at.data = {
  nodes: [
    { id: 'm', name: 'Main', status: 'running' },
    { id: 'a', parentId: 'm', name: 'A1', status: 'done' },
  ],
  now: 1,
};
at.renderNow();
if (at.shadowRoot?.querySelectorAll('[role="treeitem"]').length !== 2) {
  console.error('register: <ui-agent-tree> did not render its two agents');
  process.exit(1);
}
const fc = document.createElement('ui-file-card');
document.body.append(fc);
fc.data = { id: 'f', name: 'report.md', size: 2048 };
fc.renderNow();
if (!(fc.shadowRoot?.querySelector('.fc-name')?.textContent ?? '').includes('report.md')) {
  console.error('register: <ui-file-card> did not render its name');
  process.exit(1);
}
const { icon } = await import('@2lab.ai/ui/icons');
const { kitCss } = await import('@2lab.ai/ui/kit');
if (!icon('gear').startsWith('<svg') || !kitCss.includes('.ui-btn')) {
  console.error('register: @2lab.ai/ui/icons or @2lab.ai/ui/kit did not load');
  process.exit(1);
}
const tags = new Set([...slugs.map((s) => `ui-${s}`), ...Object.values(extra).flat()]).size;
console.log(
  `register: ${tags} elements defined from ${slugs.length} subpaths; <ui-context-window>, <ui-compact-breakdown>, <ui-agent-tree> and <ui-file-card> rendered; icons and kit load`,
);
