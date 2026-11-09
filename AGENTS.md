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

## Explainer videos
Asked for an explainer video ("3b1b", "설명 영상", the `make-3b1b` skill)? Use `explainer/` — read `explainer/README.md`. It is
plain JS + Python outside the TS build and the npm package; theme `mono-black` reads `designs.modern-mono` from
`src/core/tokens.json` when a project is made, so keep those token names stable.

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
- Sound (`src/sound/`): a user action that went through plays one cue with `this.sound(cue, options, event)` — after the
  `emit` was not prevented and only when state changed; never from render, hover, timers, streams or data the app set
  (toasts are the one code-driven exception). Pick the cue by the job (see https://2lab.ai/ui/docs/sound), test it with
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
