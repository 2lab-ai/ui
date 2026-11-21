# AGENTS.md — how to work in 2lab-ai/ui

`@2lab.ai/ui` ships the agent UI of the soma-work dashboard as Web Components. One folder per component, a demo site
(`site/`) that renders each component's `docs.ts`, published to npm as `@2lab.ai/ui`, docs at https://2lab.ai/ui.
The site is built for the base `/ui/` (into `site-dist/ui/`): the 2lab.ai site proxies `/ui/*` to this Vercel project,
and ui.2lab.ai redirects there. Internal links go through `at()` in `site/main.ts`, never a bare `/path`.

## Building a site or dashboard with the library
Asked to build a site "with 2lab-ai/ui" (or in a named look such as Modern Mono)? Start at `designs/README.md`: it lists
the designs (whole looks: `data-design="<id>"` tokens + a tone & manner spec in `designs/<id>/DESIGN.md`), maps each one
onto the elements and kit, and gives the steps. `site/designs.ts` is a worked dashboard. Designs live in
`src/core/tokens.json` (`designs.<id>`) and `DESIGNS` in `src/core/tokens.ts`; `src/core/designs.test.ts` guards them.

## Not here: videos
This repo is the web UI library only. Video kits (3b1b explainers, docent books, the live-stream videos) live in
2lab-ai/make-video; never add video tooling or upload workflow here. That repo keeps its own copy of the Modern Mono
tokens (`explainer/themes/modern-mono.json`), so a token change here does not reach it until it is copied there.

## Gates (run before every commit)
```
npm run check       # biome
npm run typecheck   # tsc --noEmit
npm test            # vitest (happy-dom)
npm run build:site  # lib build (+ the server entry, ESM + CJS) + d.ts + site build + site-dist/ui/lib
npm run consumer-check  # pack → install → NodeNext and node10 typecheck, every element registers, require('@2lab.ai/ui/server')
```
`npm run verify` runs all five.

## Component contract
- Folder `src/components/<slug>/`:
  - `<slug>.ts` — `class Ui<Name> extends UiElement<Data>` + `define('ui-<slug>', Ui<Name>)` + `HTMLElementTagNameMap` entry.
  - `styles.ts` — `export const styles = \`...\``. Inside the shadow root the dashboard token names exist on `:host`
    (`--text`, `--text-secondary`, `--surface`, `--surface-raised`, `--border`, `--accent`, `--ib-pill`, `--ib-card`,
    `--st-run|wait|done|fail`, `--dur-press|move`, `--ease-out`, `--mono` …, see `src/core/tokens.json`), so dashboard CSS
    ports nearly verbatim. Theme-specific extras: derive with `color-mix()` from those tokens — never hard-code a light-only hex.
  - `index.ts` — re-export the class, data types and pure helpers.
  - `docs.ts` — `export const doc: ComponentDoc` (see `src/docs/types.ts`): props/events/keyboard/a11y/usage + ≥3 demos
    with realistic data (no network). Picked up by `src/docs/registry.ts` automatically.
  - `<slug>.test.ts` — vitest: rendering, escaping of every user/model string, events, keyboard, `lang="ko"`.
- Data in, events out: `el.data = {...}` (plus narrow attributes such as `lang`, `theme`). User intent leaves as
  `this.emit('ui-<verb>', detail)` (bubbling, composed, cancelable). Components never fetch.
- Every dynamic string → `esc` / `escAttr` / `safeHref` (`src/core/html.ts`). No `${userText}` in markup unescaped.
- Strings: English default, Korean with `lang="ko"` (a `STRINGS = { en, ko }` table).
- Focus survives re-render when the focused element has `data-key`. Timers update text nodes in place, not via re-render.
  An element whose value moves (the meter's fill) overrides `update()` with `morphInto(this.content, this.render())`, so a
  new value patches attributes on the nodes that are there and CSS transitions run — nothing re-enters.
- Reduced motion is handled globally in `baseCss`; keep animations CSS-only where possible.
- Page parts (`group: 'Pages'` in docs: settings-nav, setting-row, knowledge-pages, episode-log, auth-card) are the pieces of the pages
  around the app (settings, memory, sign-in); a host's own controls go in their slots, styled with the kit's `.ui-input` / `.ui-switch`.
- Primitives (`group: 'Primitives'` in docs: segmented, tabs, menu, tooltip, hovercard, dialog, drawer, disclosure, log-scroller, elapsed, meter) are the building
  blocks the components and the dashboard share. Reuse `src/core/popover.ts` (anchored overlays), `src/core/roving.ts`
  (roving tabindex) and glyphs from `src/icons/icons.ts` (`icon(name)`) instead of drawing new ones. Light-DOM styling
  for hosts lives in `src/kit/kit.ts` (`ui-kit.css`): tokens and `color-mix()` only, no hex / rgba literals.
- Effects (`group: 'Effects'` in docs) are the light, colour and motion a surface wears: a wave between two states, a
  beam on a border, a glow that follows a voice, metal, a loader that becomes the picture. Most are ports of MIT
  libraries (name the source in `licenses/` and in the file headers). Their contract, on top of the one above:
  - The element wraps or decorates the host's own markup (a slot, or `for` / an anchor element): it never takes over
    the host's semantics. Decorative by default (`aria-hidden` on its canvas); a meaningful state (a voice level, a
    loader) keeps a text equivalent (`role="status"`, `aria-busy`, a label).
  - No frames while idle, off screen (`IntersectionObserver`) or in a hidden tab; the animation loop stops itself.
  - WebGL: one context per element, created on first need, released on disconnect (`WEBGL_lose_context`) and on
    long idle; a lost context or no WebGL 2 falls back to a CSS rendering (or nothing, for a pure flourish) — never an
    exception. happy-dom has no WebGL: tests cover the fallback, the pure helpers (engine maths exported) and the
    element's lifecycle; a real-browser check (Chromium) is the receipt for the picture.
    One exception, by design: the metal elements (`ui-metal`, `ui-metal-text`, `ui-metal-badge`) share one WebGL2
    context for the whole page (one offscreen canvas; each element copies its crop onto its own 2D canvas), so a page
    full of metal costs one context, not one each (browsers cap them near 16). The contract holds per page instead of
    per element: made by the first element that needs a frame, released with the last one (or after 10 s with nothing
    to draw) and re-made on the next need; each element still stops its own frames (off screen, paused, reduced) and
    draws its own preset. A lost context is rebuilt in place when the browser restores it, else released and re-made
    after 2 s; meanwhile every metal element shows its CSS fallback. One element can never stop or re-theme another.
  - Reduced motion (`prefers-reduced-motion`, plus a `motion` attribute `'system' | 'reduce' | 'full'`): a still
    frame or a crossfade, no travel.
  - Engines ported from React keep their maths nearly verbatim under `src/components/<slug>/engine/`; React state and
    refs become the element's fields; hooks become `connectedCallback` / `disconnectedCallback` and observers.
- Sound (`src/sound/`): a user action that went through plays one cue with `this.sound(cue, options, event)` — after the
  `emit` was not prevented and only when state changed; never from render, hover, timers, streams or data the app set
  (toasts are the one code-driven exception). Navigation is the one prevented-emit exception: a host cancels
  `ui-navigate` to route on the client, so the person still went somewhere — the `navigate` cue plays either way
  (app-bar, dock). Pick the cue by the job (see https://2lab.ai/ui/docs/sound), test it with
  `soundSpy()` from `src/sound/fixtures.ts`, and add one `Sound (opt-in …)` line to the docs' `a11y`.
- Server entry (`src/server/index.ts` → `@2lab.ai/ui/server`): the one entry with no element in it. Nothing it reaches may
  touch `HTMLElement`, `customElements`, `document` or `window` at load (its test runs under `// @vitest-environment node`).
  Markup a server renders lives beside its element in `markup.ts` (auth-card) and is exported from both entries.
  `vite.server.config.ts` builds it twice (`dist/server.js`, `dist/server.cjs`); `package.json` `exports["./server"]` carries
  `types` / `import` / `require`, and `typesVersions` names its types for node10 consumers. `scripts/consumer/smoke.cjs`
  requires it from the packed tarball.
- Server-drawn markup (a declarative shadow root from `authCardHtml`) is hydrated in place by `UiElement`'s first render
  (`this.declarative`; the nodes are morphed, never replaced) — a card already on screen enters once, not twice.
- Korean: `word-break: keep-all` is in `baseCss` for `:host([lang="ko"])` / `:lang(ko)` and in the kit for its prose
  classes — no per-component copy.
- A per-width attribute (`size-phone` on the dialog) watches `matchMedia('(max-width: 639px)')` only while set and
  connected, and re-renders on change; follow that shape rather than reading `innerWidth` in render.
- Exemplar: `src/components/context-window/` (math helpers exported and unit-tested, two-press action, hover state kept
  outside markup, rolling number, en/ko).

## Commits
Conventional commits (`feat(context-window): …`). End with the co-author lines used in this repo.
