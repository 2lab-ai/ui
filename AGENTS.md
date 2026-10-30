# AGENTS.md — how to work in 2lab-ai/ui

`@2lab.ai/ui` ships the agent UI of the soma-work dashboard as Web Components. One folder per component, a demo site
(`site/`) that renders each component's `docs.ts`, published to npm as `@2lab.ai/ui`, demo at https://ui.2lab.ai.

## Gates (run before every commit)
```
npm run check       # biome
npm run typecheck   # tsc --noEmit
npm test            # vitest (happy-dom)
npm run build:site  # lib build + d.ts + site build + site-dist/lib
```

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
- Reduced motion is handled globally in `baseCss`; keep animations CSS-only where possible.
- Primitives (`group: 'Primitives'` in docs: segmented, tabs, menu, tooltip, hovercard, dialog, drawer, disclosure, log-scroller) are the building
  blocks the components and the dashboard share. Reuse `src/core/popover.ts` (anchored overlays), `src/core/roving.ts`
  (roving tabindex) and glyphs from `src/icons/icons.ts` (`icon(name)`) instead of drawing new ones. Light-DOM styling
  for hosts lives in `src/kit/kit.ts` (`ui-kit.css`): tokens and `color-mix()` only, no hex / rgba literals.
- Exemplar: `src/components/context-window/` (math helpers exported and unit-tested, two-press action, hover state kept
  outside markup, rolling number, en/ko).

## Commits
Conventional commits (`feat(context-window): …`). End with the co-author lines used in this repo.
