# Designs

A design is a whole look for a site built with `@2lab.ai/ui`. It has two halves:

- tokens: one value for every colour token, so every element and every kit class takes the look at once
- a tone and manner spec: what the elements do not decide, such as layout, type scale, how parts are put together and what to check before shipping

Read this page first when someone asks for a site or dashboard "with 2lab-ai/ui", with or without naming a design.

## Catalog

| id | Name | Scheme | One line | Folder |
|---|---|---|---|---|
| `modern-mono` | Modern Mono | dark | Near-black canvas, white type, aligned figures; colour only for meaning (green up, red down, yellow favourite, lavender focus) | [modern-mono](modern-mono/README.md) |

The docs site's Designs page (https://2lab.ai/ui/docs/designs, in builds from 0.38.0) shows every design and an example dashboard in Modern Mono, and every component page there has a preview button per design. `site/designs.ts` is the same example as source.

## Build a site with a design

1. Pick the design. Use the id the person named (for example "modern-mono" or "Modern Mono black"). If they named none, build with the default light and dark themes, and say which designs exist in your report.
2. Read `designs/<id>/README.md`. It maps the spec onto this library: which element or kit class covers each part, the token map, and what the library does not draw.
3. Read `designs/<id>/DESIGN.md`. It is the tone and manner itself. Its acceptance list is your checklist.
4. Set the page up:

   ```html
   <html lang="en" data-design="modern-mono">
     <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@2lab.ai/ui@0.38/dist/tokens.css">
     <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@2lab.ai/ui@0.38/dist/ui-kit.css">
     <script type="module" src="https://cdn.jsdelivr.net/npm/@2lab.ai/ui@0.38/dist/index.js"></script>
   ```

   Designs ship in `@2lab.ai/ui` 0.38.0 and later. The snippet loads the npm release through jsDelivr (`@0.38` is the newest 0.38.x; pin the version you build against). Do not load a design from the docs site's own `lib/` folder: it serves whatever build the site last deployed, which may predate designs.

   With npm: `npm i @2lab.ai/ui@^0.38`, then `import '@2lab.ai/ui'`, `import '@2lab.ai/ui/tokens.css'`, `import '@2lab.ai/ui/ui-kit.css'`, and set `data-design="modern-mono"` on `<html>`.

5. Compose from the library's elements first (`<ui-app-bar>`, `<ui-stat-strip>`, `<ui-tabs>` and so on — see the root README for all of them). Draw the rest as page markup with `--ui-*` tokens and `color-mix()` only, never a hex value. `site/designs.ts` is a worked example: a dashboard with library elements plus a list and a phone dock drawn from tokens.
6. Check the result against the design's acceptance list at phone width (390px) and on a desktop, with a keyboard and at 200% text size.

## How a design applies

- `data-design="<id>"` on `<html>` (or any ancestor) applies the design when `tokens.css` is loaded.
- A design replaces `data-theme` and `data-palette` on that element: if they are there too, the design's values win for every token. It is drawn for one color scheme and keeps it whatever the OS prefers.
- An element inside that sets its own `data-theme` keeps that theme (the nearest declaration wins).
- Each element's host takes its `color-scheme` from `--ui-color-scheme`, which the design (and each theme block) sets, so scrollbars and form controls inside follow the design.
- To change one token, set it on `<body>` or a wrapper, not on the element that carries `data-design`: the design block outranks any single-attribute rule there.

## Let people switch

To let the people using the site switch between the themes and the designs, give `<ui-app-bar>` the designs: its theme button then opens one menu with every theme and design (0.39.0). Map the list from the server entry, `DESIGNS` in `@2lab.ai/ui/server`, and apply what it sends:

```js
import { DESIGNS } from '@2lab.ai/ui/server'; // or pass the list from your server
bar.data = { ...bar.data, theme: 'dark', palette: 'color', designs: DESIGNS.map((d) => ({ id: d.id, label: d.name, scheme: d.scheme })) };
bar.addEventListener('ui-theme-change', (e) => {
  const { theme, palette, design } = e.detail; // design: an id, or null for a plain theme
  const root = document.documentElement;
  root.dataset.theme = theme;
  if (palette === 'mono') root.dataset.palette = 'mono'; else delete root.dataset.palette;
  if (design) root.dataset.design = design; else delete root.dataset.design;
});
```

## Add a design

1. Make `designs/<id>/` with `DESIGN.md` (the spec), `README.md` (the map onto the library, naming every token as `` `--ui-<name>` ``) and optional `ui-references/` images. Remove personal data from images first.
2. Add `designs.<id>` to `src/core/tokens.json` with a value for every name in `light` / `dark`.
3. Add the design to `DESIGNS` in `src/core/tokens.ts` (id, name, scheme, summary).
4. Add a row to the catalog above.
5. Run `npm test`. `src/core/designs.test.ts` checks the catalog, the files, the token set and the contrast.

The site picks up a new design by itself: a card on the Designs page and a preview button on every component page.
