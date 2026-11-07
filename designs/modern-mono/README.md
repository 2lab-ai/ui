# Modern Mono

Black background, white type and aligned figures. Colour appears only where it means something: green for up, red for down, yellow for a favourite, lavender for keyboard focus.

`data-design="modern-mono"` · scheme: dark · spec: [DESIGN.md](DESIGN.md) (Korean) · live: https://2lab.ai/ui/docs/designs

## Files

- [DESIGN.md](DESIGN.md): the tone and manner spec, kept as it was handed over. It is the source of truth for look and behaviour. Section numbers below (§) point into it.
- `ui-references/`: the five reference screens R1 to R5 the spec was written from. In `2115.jpg` (R5) the balance rows are pixelated, so no holdings or amounts are stored here.
- This file: how the spec maps onto `@2lab.ai/ui` — tokens, which part covers which pattern, and what the library does not draw.

## Apply it

```html
<html lang="en" data-design="modern-mono">
  <link rel="stylesheet" href="https://2lab.ai/ui/lib/tokens.css">
  <link rel="stylesheet" href="https://2lab.ai/ui/lib/ui-kit.css">
  <script type="module" src="https://2lab.ai/ui/lib/index.js"></script>
```

No `data-theme` is needed: the design is dark on every OS setting. The library's font stack already starts with Inter and includes Pretendard and the system sans (§4.3). Figures need `font-variant-numeric: tabular-nums lining-nums`.

## Token map

Values marked "spec" are from §4.1. Values marked "derived" are decisions this map made where the spec gives no value; each says why.

| Token | Value | Spec role | Source |
|---|---|---|---|
| `--ui-bg` | `#050505` | bg.canvas: page, chart background | spec |
| `--ui-ib-col` | `#050505` | bg.canvas: a column behind cards | spec |
| `--ui-surface` | `#101012` | bg.surfaceSubtle: panel insides | spec |
| `--ui-ib-card` | `#101012` | bg.surfaceSubtle: card, menu, dialog | spec |
| `--ui-ib-card-dim` | `#0b0b0c` | a dimmed card, between canvas and card | derived |
| `--ui-surface-raised` | `#141416` | bg.surface: search, inputs, bottom nav | spec |
| `--ui-ib-seg` | `#141416` | bg.surface: segmented track | spec |
| `--ui-ib-seg-on` | `#2a2a2d` | bg.active: selected toggle, active nav capsule | spec |
| `--ui-ib-pill` | `#1f1f22` | the small dark badge (leverage badge in R2), chips, hover fill | derived: between surface and active, keeps secondary text at 5.9:1 |
| `--ui-border` | `#242428` | border.subtle: decorative lines, chart grid | spec |
| `--ui-ib-card-border` | `#242428` | border.subtle | spec |
| `--ui-border-focus` | `#d3c7ff` | focus | spec |
| `--ui-text` | `#f5f5f7` | text.primary | spec |
| `--ui-ib-text` | `#f5f5f7` | text.primary | spec |
| `--ui-text-secondary` | `#9a99a7` | text.secondary | spec |
| `--ui-ib-text-2` | `#9a99a7` | text.secondary | spec |
| `--ui-text-tertiary` | `#7f7e8c` | text.tertiary: optional detail only, never a small key label | spec |
| `--ui-ib-muted` | `#7f7e8c` | text.tertiary | spec |
| `--ui-accent` | `#f5f5f7` | general emphasis is achromatic (§3.4): one white ink, no hue accent | derived |
| `--ui-accent-hover` | `#d9d9de` | the ink, slightly dimmed | derived |
| `--ui-green` | `#35df97` | positive.text: rising prices, positive change | spec |
| `--ui-red` | `#ff3c5a` | negative.text and negative.fill | spec |
| `--ui-yellow` | `#f4bb20` | favorite: a selected star in a list | spec |
| `--ui-purple` | `#d3c7ff` | the lavender family (focus, brand.glow): mix it at low strength for the header glow | derived |
| `--ui-orange` | `#f97316` | not in the spec: kept from the library's dark theme for hosts that use it | derived |
| `--ui-ib-spark` | `#9a99a7` | sparklines are neutral tools (§3.4) | derived |
| `--ui-st-done` | `#35df97` | done reads as positive | derived from positive.text |
| `--ui-st-fail` | `#ff3c5a` | failed reads as negative | derived from negative |
| `--ui-st-fail-text` | `#ff3c5a` | failure text, 5.5:1 on a card | derived from negative |
| `--ui-st-wait` | `#f4bb20` | waiting on a person: the attention yellow | derived from favorite |
| `--ui-st-run` | `#d3c7ff` | running: the lavender, so live work is not mistaken for up or down | derived from focus |
| `--ui-ib-shadow` | `0 0 #0000` | no floating shadows on the page (§3.1); a zero shadow keeps shadow lists valid | derived |
| `--ui-ib-shadow-raised` | `0 16px 40px rgba(0,0,0,0.72), 0 2px 8px rgba(0,0,0,0.6)` | menus and dialogs over content | derived |
| `--ui-scrim` | `rgba(0, 0, 0, 0.72)` | behind a dialog or sheet | derived |
| `--ui-chroma` | `1` | status fills keep their colour (this is not the mono palette) | derived |

Values the spec names that have no token of their own — build them from the tokens above:

| Spec value | Use |
|---|---|
| positive.fill `#2BF393` (Buy) | `var(--ui-green)` |
| negative.fill `#FF3C5A` (Sell) | `var(--ui-red)` |
| text.onSemantic `#07120D` | `var(--ui-bg)` on a green or red button: 11.8:1 and 5.9:1 |
| positive.tint `#103D2D` (Long selected) | `color-mix(in srgb, var(--ui-green) 25%, var(--ui-bg))` |
| negative.tint `#321117` (sell depth) | `color-mix(in srgb, var(--ui-red) 18%, var(--ui-bg))` |
| brand.glow `#655484` | `radial-gradient(70% 100% at 50% -30%, color-mix(in srgb, var(--ui-purple) 22%, transparent), transparent 70%)` behind the header only (§5.3) |
| border.control `#64646F` | `color-mix(in srgb, var(--ui-text) 36%, var(--ui-surface-raised))` where a control is known only by its edge (§4.1) |

## Which part covers which pattern

Library elements first: they already meet the spec's behaviour rules (§13 asks to reuse a library's tabs, dialog, button and tooltip behaviour and change only the look).

| Spec pattern | Use | Notes |
|---|---|---|
| App shell, header (§5.1) | `<ui-app-bar>` on wide screens; a page header on phones | Put the header glow behind it only |
| UnderlineTabs (§6.1) | `<ui-tabs>` | Ink underline that glides; roving arrows, Home and End; scrolls when it overflows |
| SegmentedControl (§6.2) | `<ui-segmented>` | Track `--ui-ib-seg`, selected `--ui-ib-seg-on` |
| MetricStrip (§6.6) | `<ui-stat-strip>` | Figures roll in place; breakdown tooltips are keyboard reachable |
| Simple bars over time | `<ui-bar-chart>` | Use `color: 'done'` and `'fail'` for green and red series |
| CandleChart (§6.7) | not in the library | Use the product's chart library on `--ui-bg`; grid `--ui-border`; candles `--ui-green` and `--ui-red` |
| MarketRow, PortfolioRow (§6.3, §6.4) | page markup | Recipe below; `site/designs.ts` has a working one (`.dx-row`) |
| NewsRow (§6.5) | page markup | A link row: title, two-line summary, source left and time right, `--ui-border` line between rows |
| BottomNavigation, SearchDock (§5.2) | page markup | Recipe below; `.dx-dock` in `site/designs.ts` |
| TradeActions (§6.8) | `.ui-btn` plus a pill override | Recipe below. Pressing starts an order flow; it never sends an order |
| QuickAction (§6.9) | `.ui-icon-btn` in a 44px circle, label under it | One highlighted action only: `.ui-btn.is-primary` colours (white circle, dark glyph) |
| Toasts, dialogs, tooltips, menus | `<ui-toaster>`, `<ui-dialog>`, `<ui-tooltip>`, `<ui-menu>` | They take the tokens with no extra work |
| Agent UI (runs, approvals, conversations) | every `<ui-*>` element | They take the tokens with no extra work |

## Recipes

Page CSS for the parts the library does not draw. Tokens only.

```css
/* Figures: aligned, signed, coloured by meaning (§8). 0 is neutral; no data is a dash, not 0. */
.fig { font-variant-numeric: tabular-nums lining-nums; white-space: nowrap; }
.chg[data-trend="up"] { color: var(--ui-green); }
.chg[data-trend="down"] { color: var(--ui-red); }
.chg[data-trend="flat"], .chg[data-trend="unknown"] { color: var(--ui-text-secondary); }

/* Row (§6.3): mark, name over a quiet line, figures right, a 44px star. Spacing separates rows, not cards. */
.row { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto 44px; align-items: center;
  column-gap: 12px; min-height: 60px; padding: 8px 0; }
.star[aria-pressed="true"] { color: var(--ui-yellow); }

/* Pill actions (§6.8): equal halves, 48px, dark text on the colour. */
.trade { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.trade .ui-btn { min-height: 48px; border-radius: 999px; border: 0; color: var(--ui-bg); font-size: 18px; font-weight: 600; }
.trade .buy { background: var(--ui-green); }
.trade .sell { background: var(--ui-red); }

/* Bottom navigation (§5.2): equal columns, icon over label, a capsule behind the active icon. */
.dock { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); padding: 6px 4px 8px;
  padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px)); background: var(--ui-surface-raised); }
.dock a { display: grid; justify-items: center; gap: 4px; min-height: 56px; color: var(--ui-text-secondary); font-size: 11px; }
.dock a[aria-current="page"] { color: var(--ui-text); }
.dock a[aria-current="page"] .icon { padding: 4px 16px; border-radius: 999px; background: var(--ui-ib-seg-on); }

/* Search pill (§5.2). */
.search { min-height: 48px; border-radius: 999px; background: var(--ui-surface-raised); color: var(--ui-text); }
```

## What the library does not do here

- No trading elements: candle chart, order book, order entry and market search are page work (§6.7, §6.10). The spec itself says to reuse the product's chart library rather than build a canvas engine.
- No shape changes to kit classes: buttons and inputs keep the library's dashboard sizes. Where the spec asks for 44px and 48px targets or pills, use the recipes above in page CSS.
- No `color-scheme: light` version: the design is dark only.

## Check before you ship

- The spec's acceptance list: §14.1 (visual) and §14.2 (scenarios V1 to V8).
- Phone width 390px and a desktop; keyboard only; 200% text; a dock never covers the last row.
- In this repository: `npm run verify`.
