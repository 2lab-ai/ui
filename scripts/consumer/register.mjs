// Runtime smoke test against the installed package: each of the 12 subpaths registers its element(s) (13 in all).
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
];
// Subpaths that register more than their own tag.
const extra = { 'tool-call-card': ['ui-tool-call-group'] };
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
const tags = slugs.length + Object.values(extra).flat().length;
console.log(
  `register: ${tags} elements defined from ${slugs.length} subpaths; <ui-context-window> and <ui-compact-breakdown> rendered`,
);
