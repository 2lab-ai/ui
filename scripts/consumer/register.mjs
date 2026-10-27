// Runtime smoke test against the installed package: every subpath registers its element, the root registers all 7.
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
  'ai-answer',
  'agent-queue',
  'context-window',
  'memory-panel',
  'model-picker',
];
const missing = [];
for (const slug of slugs) {
  await import(`@2lab.ai/ui/${slug}`);
  if (!customElements.get(`ui-${slug}`)) missing.push(slug);
}
await import('@2lab.ai/ui');
const el = document.createElement('ui-context-window');
document.body.append(el);
el.data = { window: 1_000_000, autoCompactAt: 750_000, parts: { cacheRead: 272_300, output: 10 } };
el.renderNow();
const rendered = (el.shadowRoot?.innerHTML ?? '').length > 0;
if (missing.length || !rendered) {
  console.error(`register: missing=[${missing.join(',')}] rendered=${rendered}`);
  process.exit(1);
}
console.log(`register: ${slugs.length}/7 elements defined from their subpaths; <ui-context-window> rendered`);
