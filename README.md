# @2lab.ai/ui

Agent UI components from the 2lab soma-work dashboard, as **Web Components** with zero runtime dependencies.

**Demo & docs: https://ui.2lab.ai**

| Component | Tag | What it tells you |
|---|---|---|
| Agent Run (screen) | `<ui-agent-run>` | What the agent is doing now, its plan, and what it needs from you |
| Agent Inbox | `<ui-agent-inbox>` | Which runs need you, which are running, which are done |
| Agent Tree | `<ui-agent-tree>` | Who started whom, what each agent is doing, and which branch costs what |
| AI Answer | `<ui-ai-answer>` | The answer, the links in it, copy, response time |
| Tool Call Card | `<ui-tool-call-card>`, `<ui-tool-call-group>` | What the agent called, with what, what came back, and how long it took |
| Conversation | `<ui-conversation>` | Who said what and when — instructions, answers with their response time, system events and the files they carried; older turns load as you scroll up; Retry on a summary, answers loaded on demand, select turns, or lay it out as the page |
| Work Log | `<ui-work-log>` | What the agent did, task by task — instructions, narration, tool calls, raw output, child agents; a meta line per task, entries between tasks, slotted tool cards on the same keyboard path |
| Choice Form | `<ui-choice-form>` | What the agent needs you to decide — numbered questions, the recommended choice, your own answer, submit all at once; or locked with the reason you cannot answer |
| Goal Card | `<ui-goal-card>` | What the agent is working toward, how far it is, and what is queued — only the actions the host answers, meta and a note on the current and past goals; complete, pause, delete with a second press |
| Task Plan | `<ui-task-plan>` | The plan step by step — done, running, dropped or moved — and the plans before it; `setOpen()` / `isOpen()` for the folds |
| Task Runs | `<ui-task-runs>` | Each run of a task — status, time, tokens, tools and revisions, approximate runs with a note, a totals row the host can give (“n of m shown”) |
| Agent Queue | `<ui-agent-queue>` | Provider capacity, rate limits, and the scheduled-job lane |
| Context Window | `<ui-context-window>` | How full the context is and how far auto-compaction is |
| Approval Card | `<ui-approval-card>` | What the agent wants to do and how risky it is — Approve / Deny, or answer its question, before it expires |
| Agent Steering | `<ui-agent-steering>` | What you told the agent mid-run, whether it has it yet — queue a note for its next step, Send now, Edit, Cancel |
| Toaster | `<ui-toaster>` + `toast()` | Whether what you just did worked — results, failures with Retry, promise spinners, Undo |
| Compact Breakdown | `<ui-compact-breakdown>` | One number and what it is made of — spend and tokens by model or by user |
| Memory Panel | `<ui-memory-panel>` | What the agent remembers about you — search, edit, delete with undo |
| Model Picker | `<ui-model-picker>` | Which model and effort to run, with window, compaction and price |
| Status Bar | `<ui-status-bar>` | Whether the session is live — status word, start time and running clock, and its actions (named, toggled, quiet) |
| Deck Nav | `<ui-deck-nav>` | Which card of a one-at-a-time deck you are on — ‹ n / m ›, with peeking edges (or the edges alone) |

Surfaces — the page-level pieces around the agent (0.6.0):

| Surface | Tag | What it tells you |
|---|---|---|
| App Bar | `<ui-app-bar>` | Where you are, whether it is live, who is signed in — chip nav that folds into a menu, status dot, account, theme toggle |
| Stat Strip | `<ui-stat-strip>` | How the period went — a period segmented control, rolling figures, per-metric breakdown tooltips, a More disclosure |
| Bar Chart | `<ui-bar-chart>` | How it moved over time — small single or stacked bars, axis ticks, keyboard and tooltip per bar, legend, empty state |
| File Card | `<ui-file-card>` | What a file is — kind glyph or thumbnail, name, size and age as a tile, row or chip |
| Artifact Viewer | `<ui-artifact-viewer>` | What the agent made — a strip or grid of files, a hover peek, and a lightbox with previous / next, preview and Download; a trusted page runs its scripts, a PDF opens in the browser’s viewer, `ui-before-view` / `ui-closed` for a host’s own body |
| Composer | `<ui-composer>` | What you send next — a growing field, drop / paste attachments, a voice note, tools, Enter to send |

Page parts — the pages around the app: settings, memory, sign-in (0.9.0):

| Page part | Tag | What it tells you |
|---|---|---|
| Settings Nav | `<ui-settings-nav>` | Where you are in a long settings page — section links that follow your scroll, search and Modified only, a notice slot; a chip row on phones |
| Setting Row | `<ui-setting-row>` | One preference — label, description, default, your own control, Saving… / Saved / an error, locked with the reason, modified |
| Knowledge Pages | `<ui-knowledge-pages>` | What the agent knows by topic — a searchable page list and an editor (title, aliases, markdown with preview or as raw source, history), save, delete twice, no lost drafts; or laid out as the page |
| Episode Log | `<ui-episode-log>` | What the agent noticed and when — entries by day, edit in place, delete twice, add a note to today |
| Auth Card | `<ui-auth-card>` | Who you are signing in as — providers, the account you have, or the session you are switching to; `authCardHtml()` renders it on the server (also from `@2lab.ai/ui/server`, ESM or CommonJS, no DOM), working without JavaScript, and the element hydrates that markup in place |

Primitives — the building blocks the dashboard shares, in the same tone and motion:

| Primitive | Tag | What it does |
|---|---|---|
| Segmented | `<ui-segmented>` | One choice among a few (period, view) on a raised chip that slides — radiogroup, roving arrows |
| Tabs | `<ui-tabs>` | Tab list over host-slotted panels; an ink underline glides to the selected tab |
| Menu | `<ui-menu>` | Menu anchored to a trigger: items, radios, checkboxes, typeahead, origin-aware pop in and out |
| Tooltip | `<ui-tooltip>` | Hover / focus label or rich card with a delay, hoverable, Esc to dismiss, `aria-describedby` |
| Hovercard | `<ui-hovercard>` | One preview card for many triggers (`for` selector or `anchor(el)`): hover intent, `ui-open` to fill it, hoverable, Esc; no `aria-describedby` |
| Dialog | `<ui-dialog>` | Native `<dialog>` with a fading scrim, enter / exit motion, focus trap and return, a bottom sheet on phones (`size-phone` picks its size there); `ui-closed` once the exit is over |
| Drawer | `<ui-drawer>` | Side sheet that docks beside the page on wide screens; resizable edge, scrim, interruptible slide |
| Disclosure | `<ui-disclosure>` | Summary row over a region that grows 0fr → 1fr and is inert while closed; a links row that stays in view while closed |
| Log Scroller | `<ui-log-scroller>` | Newest-at-bottom scroll box: follows the latest, pages older items in without moving your place (`[data-anchor]` rows inside an item count too), “jump to latest” with an unread count; or as tall as its items while the page scrolls |
| Elapsed | `<ui-elapsed>` | A live time — running for, stopwatch, how long ago, countdown — on one shared whole-second tick, text changed in place |

Foundations: `@2lab.ai/ui/icons` (a 16-grid, 1.5-stroke `currentColor` SVG set — `icon('gear')` returns an SVG string) and
`@2lab.ai/ui/ui-kit.css` (light-DOM classes on the same tokens: `.ui-btn` with one ink primary, `.ui-icon-btn`, `.ui-fab`, `.ui-chip`,
`.ui-status`, `.ui-kbd`, `.ui-dl`, `.ui-skeleton`, `.ui-empty`, `.ui-status-line`, `.ui-avatar`, `.ui-sr-only`, `.ui-expand`,
`.ui-section-head` with a `.ui-count` badge, and for page parts `.ui-input`, `.ui-switch`, `.ui-card`, `.ui-notice`, `.ui-row` — the row
that is the page, `aria-current="page"`, keeps the hover fill). Korean prose (`lang="ko"`) breaks between words, never inside them, in every
element and every kit class (`word-break: keep-all`).

Server — `@2lab.ai/ui/server`, the one entry with no element in it: `authCardHtml(data)` renders the auth card as a declarative shadow
root the element later hydrates in place, `authCardCss` is its sheet as data, with `tokensCss`, `kitCss`, `icon()` and the escapers. Nothing
in it touches the DOM at load, so it runs on Node as ESM (`import`) or CommonJS (`require`, the `.cjs` build); its types resolve under
NodeNext and node10 (`typesVersions`).

```js
// a route handler, ESM or CommonJS — the page works before (and without) the script
const { authCardHtml, tokensCss } = require('@2lab.ai/ui/server');
res.send(`<style>${tokensCss}</style>${authCardHtml(data, { page: true })}<script type="module" src="/lib/auth-card.js"></script>`);
```

Sound — opt-in interface cues (0.11.0): every element plays a short cue for what the person just did (a detent when a tab
changes, air when a dialog opens, a soft chord when a run is done). Off until the person turns it on. `@2lab.ai/ui/sound` is
the policy (`setSound`, `bindSound`, quiet regions, opt-in typing) and loads no audio; `@2lab.ai/ui/sound-cuelume` is the
player — [Cuelume](https://github.com/danielwh2/cuelume)'s fourteen cues synthesized live with Web Audio, no audio files,
bundled so the package keeps zero runtime dependencies. See https://ui.2lab.ai/docs/sound.

```js
import { bindSound, setSound } from '@2lab.ai/ui/sound';
bindSound();                                   // your own <button data-ui-sound> … sound too
// in the click that turns sound on (keep the choice beside the theme switch):
const { cuelumeSound, unlockSound } = await import('@2lab.ai/ui/sound-cuelume');
setSound({ player: cuelumeSound, enabled: true });
unlockSound();
```

## Install

```
npm i @2lab.ai/ui
```
```js
import '@2lab.ai/ui';                 // registers every element
import '@2lab.ai/ui/context-window';  // or just one
import '@2lab.ai/ui/tokens.css';      // optional page tokens (data-theme="dark" switches)
import '@2lab.ai/ui/ui-kit.css';      // optional light-DOM classes (buttons, chips, status …)
import { icon } from '@2lab.ai/ui/icons';
import { authCardHtml } from '@2lab.ai/ui/server';  // on a server: no DOM, no element; require() works too
```
No build step: `<script type="module" src="https://ui.2lab.ai/lib/index.js"></script>`.

## Use
```html
<ui-context-window lang="en"></ui-context-window>
<script type="module">
  const el = document.querySelector('ui-context-window');
  el.data = { window: 1_000_000, autoCompactAt: 750_000, parts: { cacheRead: 272300, output: 10 }, canCompact: true };
  el.addEventListener('ui-compact', async () => {
    el.data = { ...el.data, compactState: 'sending' };   // assign a new object — in-place mutation does not re-render
    await fetch('/compact', { method: 'POST' });
    el.data = { ...el.data, compactState: 'sent' };
  });
</script>
```
Data in (`el.data = {...}` — always assign a new object), events out (`ui-*`, bubbling + composed). Elements never fetch. English by default, Korean with
`lang="ko"`. Light/dark follow the OS, `theme="light|dark"` pins one, `--ui-*` custom properties theme a page.

## Develop
```
npm i
npm run dev          # demo site with live reload
npm run verify       # biome · tsc · vitest · lib + site build · packed-tarball consumer check (NodeNext + node10 types, every element registers, require('@2lab.ai/ui/server'))
```
See `AGENTS.md` for the component contract.

## Credits
Interaction patterns were studied from [affectUI](https://www.affectui.com) and re-implemented for the soma-work dashboard's
own data. No affectUI code or assets are included.

Interface sounds: [Cuelume](https://github.com/danielwh2/cuelume) (MIT, Daniel Belyi) is bundled into
`dist/sound-cuelume.js`; the sound policy is ported from [Morphin UI](https://morphin.dev/docs/sound) (MIT, Ivan Oliinyk).
Their notices ship in `dist/THIRD_PARTY_NOTICES.md`.
