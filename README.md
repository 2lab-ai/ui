# @2lab-ai/ui

Agent UI components from the 2lab soma-work dashboard, as **Web Components** with zero runtime dependencies.

**Demo & docs: https://ui.2lab.ai**

| Component | Tag | What it tells you |
|---|---|---|
| Agent Run (screen) | `<ui-agent-run>` | What the agent is doing now, its plan, and what it needs from you |
| Agent Inbox | `<ui-agent-inbox>` | Which runs need you, which are running, which are done |
| AI Answer | `<ui-ai-answer>` | The answer, the links in it, copy, response time |
| Agent Queue | `<ui-agent-queue>` | Provider capacity, rate limits, and the scheduled-job lane |
| Context Window | `<ui-context-window>` | How full the context is and how far auto-compaction is |
| Memory Panel | `<ui-memory-panel>` | What the agent remembers about you — search, edit, delete with undo |
| Model Picker | `<ui-model-picker>` | Which model and effort to run, with window, compaction and price |

## Install (GitHub Packages)

```
# .npmrc
@2lab-ai:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}   # token with read:packages
```
```
npm i @2lab-ai/ui
```
```js
import '@2lab-ai/ui';                 // registers every element
import '@2lab-ai/ui/context-window';  // or just one
import '@2lab-ai/ui/tokens.css';      // optional page tokens (data-theme="dark" switches)
```
No build step: `<script type="module" src="https://ui.2lab.ai/lib/index.js"></script>`.

## Use
```html
<ui-context-window lang="en"></ui-context-window>
<script type="module">
  const el = document.querySelector('ui-context-window');
  el.data = { window: 1_000_000, autoCompactAt: 750_000, parts: { cacheRead: 272300, output: 10 }, canCompact: true };
  el.addEventListener('ui-compact', () => { /* call your API, then set el.data.compactState */ });
</script>
```
Data in (`el.data`), events out (`ui-*`, bubbling + composed). Elements never fetch. English by default, Korean with
`lang="ko"`. Light/dark follow the OS, `theme="light|dark"` pins one, `--ui-*` custom properties theme a page.

## Develop
```
npm i
npm run dev          # demo site with live reload
npm run verify       # biome · tsc · vitest · lib + site build
```
See `AGENTS.md` for the component contract.

## Credits
Interaction patterns were studied from [affectUI](https://www.affectui.com) and re-implemented for the soma-work dashboard's
own data. No affectUI code or assets are included.
