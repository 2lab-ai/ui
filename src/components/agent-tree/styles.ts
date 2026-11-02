/**
 * Agent Tree. Sizes and timings follow the affectUI Agent Tree (clean style): 8px cards with a hairline ring, a 22px
 * avatar tile, 18px status pills, 11–12px meta, soft accent connectors with a dot under an open parent, cards that
 * rise in over 360ms and a light shimmer over costs that still climb. The layout is its narrow one (every level
 * indented, connectors down the left) at every width — the dashboard surfaces are columns. Every colour is a
 * dashboard token or a color-mix() of tokens, so light and dark both read.
 */
export const styles = `
:host { --at-ink: var(--text); --at-text: var(--text-secondary); --at-muted: var(--text-tertiary);
  --at-card: var(--surface); --at-line: var(--border);
  --at-fill: color-mix(in srgb, var(--text) 6.5%, transparent);
  --at-hover: color-mix(in srgb, var(--text) 4%, transparent);
  --at-link: color-mix(in srgb, var(--accent) 45%, var(--surface));
  --at-sel: color-mix(in srgb, var(--accent) 9%, transparent);
  --at-ring: color-mix(in srgb, var(--accent) 60%, transparent);
  --at-shine: color-mix(in srgb, var(--surface) 62%, transparent);
  --at-shadow: 0 0 0 1px color-mix(in srgb, var(--border) 85%, transparent), 0 1px 2px color-mix(in srgb, var(--text) 5%, transparent);
  --at-ease: cubic-bezier(0.32, 0.72, 0.24, 1);
  min-width: 0; font-size: 13px; line-height: 20px; }
ul, p, h3 { margin: 0; padding: 0; }
ul { list-style: none; }
button { appearance: none; margin: 0; padding: 0; border: 0; background: none; text-align: left; letter-spacing: inherit; }
svg { display: block; flex: none; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round;
  stroke-linejoin: round; }

.at { min-width: 0; color: var(--at-text); }
.at-empty { padding: 12px 2px; color: var(--at-muted); font-size: 12.5px; }

/* Bar: title, then the totals — agents, running, needs you / failed (jump buttons), cost */
.at-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; min-width: 0; margin-bottom: 12px; }
.at-title { flex: 0 0 auto; max-width: 100%; min-width: 0; overflow: hidden; color: var(--at-ink); font-size: 13px; font-weight: 500;
  line-height: 20px; white-space: nowrap; text-overflow: ellipsis; }
.at-sum { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 4px 10px; margin-left: auto;
  color: var(--at-muted); font-size: 12px; line-height: 16px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.at-sum-run { color: color-mix(in srgb, var(--st-run) 82%, var(--text)); }
.at-sum-btn { position: relative; display: inline-flex; align-items: center; gap: 4px; height: 22px; margin: -3px 0;
  padding: 0 7px 0 5px; border-radius: 5px; font-size: 12px; font-weight: 500;
  transition: background-color 160ms ease, filter 160ms ease; }
.at-sum-btn svg { width: 12px; height: 12px; stroke-width: 1.8; }
.at-sum-btn[data-jump="needs_you"] { background: color-mix(in srgb, var(--st-wait) 15%, transparent);
  color: color-mix(in srgb, var(--st-wait) 70%, var(--text)); }
.at-sum-btn[data-jump="failed"] { background: color-mix(in srgb, var(--st-fail) 12%, transparent); color: var(--st-fail-text); }
@media (hover: hover) { .at-sum-btn:hover { filter: saturate(1.25) brightness(0.97); } }
.at-sum-cost { min-width: 44px; color: var(--at-ink); font-weight: 500; text-align: right; }

/* Tree frame: every level indents by one step; the step shrinks so the deepest level still fits */
.at-wrap { container-type: inline-size; min-width: 0;
  --at-step: min(var(--at-indent), max(10px, (100cqw - 220px) / max(1, var(--D, 0)))); }
.at[data-density="rich"] { --at-indent: 30px; --at-gap: 8px; --at-elbow: 21px; }
.at[data-density="compact"] { --at-indent: 18px; --at-gap: 0px; --at-elbow: 14px; }
.at-tree, .at-kids { display: grid; gap: var(--at-gap); }
.at-kids { position: relative; padding: var(--at-gap) 0 0 var(--at-step); }
.at-item { position: relative; min-width: 0; outline: none;
  --c: var(--text-tertiary); --c-ink: color-mix(in srgb, var(--c) 80%, var(--text)); }
.at-item.is-running { --c: var(--st-run); }
.at-item.is-needs_you { --c: var(--st-wait); --c-ink: color-mix(in srgb, var(--st-wait) 70%, var(--text)); }
.at-item.is-failed { --c: var(--st-fail); --c-ink: var(--st-fail-text); }
.at-item.is-done { --c: var(--st-done); }
.at-item.is-waiting { --c: var(--text-secondary); }

/* Connectors: from the parent's stub down the left, curving into each child */
.at-row { position: relative; }
.at[data-density="rich"] .at-kids > .at-item > .at-row::before { content: ''; position: absolute; pointer-events: none;
  left: calc(var(--at-step) * -1 + var(--at-stub)); top: calc(var(--at-gap) * -1 - 1px);
  width: calc(var(--at-step) - var(--at-stub)); height: calc(var(--at-gap) + var(--at-elbow) + 1px);
  border: 0 solid var(--at-conn); border-left-width: 1.5px; border-bottom-width: 1.5px; border-bottom-left-radius: 6px; }
.at[data-density="rich"] .at-kids > .at-item:not(:last-child)::before { content: ''; position: absolute; pointer-events: none;
  left: calc(var(--at-step) * -1 + var(--at-stub)); top: var(--at-elbow); bottom: 0; width: 1.5px; background: var(--at-conn); }
.at[data-density="rich"] .at-wrap { --at-stub: calc(var(--at-step) * 0.62); --at-conn: var(--at-link); }
/* Compact: an indent guide under each open parent's chevron */
.at[data-density="compact"] .at-kids::before { content: ''; position: absolute; left: 11.5px; top: 0; bottom: 4px; width: 1px;
  background: var(--at-line); pointer-events: none; }
.at-item[aria-expanded="true"] > .at-card::after { content: ''; position: absolute; z-index: 1; left: calc(var(--at-stub) - 3.5px);
  bottom: -4px; width: 7px; height: 7px; border-radius: 50%; background: var(--at-card); box-shadow: inset 0 0 0 1.5px var(--at-link); }

/* Rich: a card per agent */
.at-card { display: grid; gap: 6px; min-width: 0; padding: 10px 10px 8px; border-radius: 8px; background: var(--at-card);
  box-shadow: var(--at-shadow); cursor: pointer; transition: box-shadow 200ms ease, background-color 160ms ease; }
@media (hover: hover) { .at-card:hover { box-shadow: 0 0 0 1px color-mix(in srgb, var(--text) 16%, transparent),
  0 2px 6px -2px color-mix(in srgb, var(--text) 14%, transparent); } }
.at-item[aria-selected="true"] > .at-card { background: color-mix(in srgb, var(--accent) 4%, var(--at-card));
  box-shadow: 0 0 0 1.5px var(--at-ring), 0 1px 2px color-mix(in srgb, var(--text) 5%, transparent); }
.at-item:focus-visible > .at-card { outline: 2px solid var(--border-focus); outline-offset: 2px; }
.at-item.is-cancelled > .at-card, .at-item.is-unknown > .at-card { opacity: 0.66; }
.at-top { display: flex; align-items: center; gap: 8px; min-width: 0; }
.at-avatar { display: grid; flex: none; place-items: center; width: 22px; height: 22px; border-radius: 6px; background: var(--at-card);
  box-shadow: var(--at-shadow); color: var(--at-text); font-size: 10px; font-weight: 600; line-height: 1; letter-spacing: 0; }
.at-who { display: grid; flex: 1 1 auto; min-width: 0; }
.at-name { min-width: 0; overflow: hidden; color: var(--at-ink); font-weight: 500; white-space: nowrap; text-overflow: ellipsis; }
.at-card .at-name { line-height: 16px; }
.at-role { min-width: 0; overflow: hidden; color: var(--at-muted); font-size: 11px; line-height: 14px; white-space: nowrap;
  text-overflow: ellipsis; }
.at-pill { display: inline-flex; flex: none; align-self: start; align-items: center; gap: 4px; height: 18px; padding: 0 6px 0 4px;
  border-radius: 4px; background: color-mix(in srgb, var(--c) 13%, transparent); color: var(--c-ink); font-size: 11px;
  font-weight: 500; line-height: 16px; white-space: nowrap; }
.at-pill svg { width: 12px; height: 12px; stroke-width: 1.9; }
.at-task { display: -webkit-box; overflow: hidden; margin: -2px -2px -3px; padding: 2px 2px 3px; color: var(--at-text);
  font-size: 12px; line-height: 16px; overflow-wrap: anywhere; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.at-reason { display: -webkit-box; overflow: hidden; padding: 5px 8px; border-radius: 6px;
  background: color-mix(in srgb, var(--c) 10%, transparent); color: var(--c-ink); font-size: 12px; line-height: 16px;
  overflow-wrap: anywhere; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.at-card .at-meta { display: flex; align-items: center; gap: 6px; min-width: 0; min-height: 20px; color: var(--at-muted);
  font-size: 11px; line-height: 16px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.at-card .at-meta > :not(.at-fold) + :not(.at-fold)::before { content: '·'; margin-right: 6px; color: var(--at-muted); }
.at-cost { min-width: 0; overflow: hidden; color: var(--at-ink); font-weight: 500; text-overflow: ellipsis; }
.at-card .at-meta > .at-cost, .at-card .at-meta > .at-time { flex: none; }
.at-card .at-meta > .at-tok, .at-card .at-meta > .at-tools { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.at-fold { position: relative; display: inline-flex; flex: none; align-items: center; gap: 2px; height: 20px; margin-left: auto;
  padding: 0 4px 0 6px; border-radius: 5px; color: var(--at-muted); font-size: 11px; font-weight: 500;
  transition: background-color 160ms ease, color 160ms ease; }
.at-fold svg { width: 12px; height: 12px; transform: rotate(90deg); transition: transform 220ms var(--at-ease); }
.at-fold.is-folded svg { transform: none; }
.at-fold.is-folded { background: var(--at-fill); color: var(--at-ink); }
.at-fold > svg:first-child:not(:last-child) { width: 11px; height: 11px; margin-right: 1px; transform: none; }
@media (hover: hover) { .at-fold:hover { background: var(--at-fill); color: var(--at-ink); } }
.at-span { position: relative; display: block; height: 4px; margin: 2px 0 1px calc((var(--D, 0) - var(--d, 0)) * var(--at-step));
  border-radius: 2px; background: var(--at-fill); }
.at-span > i { position: absolute; top: 0; bottom: 0; min-width: 3px; border-radius: 2px; background: var(--c); opacity: 0.8;
  transition: left 900ms linear, width 900ms linear; }
.at-axis { display: flex; justify-content: space-between; margin: 0 10px 6px calc(var(--D, 0) * var(--at-step) + 10px);
  color: var(--at-muted); font-size: 10.5px; line-height: 14px; font-variant-numeric: tabular-nums; }

/* Compact: one row per agent — chevron · status icon · name · status word · time, and one line */
.at[data-density="compact"] .at-row { display: grid; grid-template-columns: 16px 16px minmax(0, 1fr); column-gap: 6px;
  align-items: start; padding: 4px 8px 4px 4px; border-radius: 6px; cursor: pointer; transition: background-color 150ms ease; }
@media (hover: hover) { .at[data-density="compact"] .at-row:hover { background: var(--at-hover); } }
.at[data-density="compact"] .at-item[aria-selected="true"] > .at-row { background: var(--at-sel); }
.at[data-density="compact"] .at-item:focus-visible > .at-row { outline: 2px solid var(--border-focus); outline-offset: -2px; }
.at[data-density="compact"] .at-item.is-cancelled > .at-row, .at[data-density="compact"] .at-item.is-unknown > .at-row { color: var(--at-muted); }
.at-chev { position: relative; display: grid; place-items: center; width: 16px; height: 20px; color: var(--at-muted); }
.at-chev.is-toggle::before { content: ''; position: absolute; inset: -4px -4px; }
.at-chev svg { width: 12px; height: 12px; transition: transform 200ms var(--at-ease); }
.at-item[aria-expanded="true"] > .at-row .at-chev svg { transform: rotate(90deg); }
@media (hover: hover) { .at-chev.is-toggle:hover { color: var(--at-ink); } }
.at-icon { display: grid; place-items: center; height: 20px; color: var(--c); }
.at-icon svg { width: 14px; height: 14px; }
.at-body { display: flex; flex-direction: column; min-width: 0; }
.at-head { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 8px; min-width: 0; }
.at-head .at-who { display: flex; flex: 1 1 7.5em; align-items: baseline; gap: 6px; }
.at-head .at-name { flex: 0 0 auto; max-width: 100%; }
.at-head .at-role { flex: 0 1 auto; font-size: 12px; line-height: 20px; }
.at-head .at-meta { display: inline-flex; flex: 0 1 auto; flex-wrap: wrap; align-items: baseline; gap: 1px 7px; color: var(--at-text);
  font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.at-st { color: var(--c-ink); font-weight: 500; }
.at-head .at-cost { color: var(--at-text); font-weight: 400; }
.at-line { overflow: hidden; color: var(--at-muted); font-size: 12px; line-height: 16px; white-space: nowrap; text-overflow: ellipsis; }
.at-line.is-reason { color: var(--c-ink); }
.at-more { display: inline-flex; align-items: center; gap: 2px; padding: 0 3px 0 6px; border-radius: 99px; background: var(--at-fill);
  color: var(--at-text); font-size: 10.5px; font-weight: 600; line-height: 16px; }
.at-more svg { width: 10px; height: 10px; }
.at-more > svg:first-child:not(:last-child) { width: 10px; height: 10px; margin-right: 1px; }
.at-more[data-worst], .at-fold[data-worst] { background: color-mix(in srgb, var(--wc) 14%, transparent);
  color: color-mix(in srgb, var(--wc) 75%, var(--text)); }
[data-worst="needs_you"] { --wc: var(--st-wait); }
[data-worst="failed"] { --wc: var(--st-fail); }
[data-worst="running"] { --wc: var(--st-run); }

/* Motion: spinner, a light shimmer over costs that still climb, new agents rising in */
.at-spin { animation: at-spin 900ms linear infinite; transform-origin: 50% 50%; }
.at-amount[data-live] { background: linear-gradient(90deg, currentColor 0%, currentColor 38%, var(--at-shine) 50%, currentColor 62%,
  currentColor 100%) 0 0 / 300% 100%; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  animation: at-shine 1100ms linear infinite; }
.at-item.is-new > .at-row { animation: at-rise 360ms var(--at-ease) both; }
.at-item.is-new::before, .at-item.is-new > .at-row::before, .at-item.is-new > .at-kids::before { animation: at-fade 420ms var(--at-ease) both; }
@keyframes at-spin { to { transform: rotate(360deg); } }
@keyframes at-shine { from { background-position: 100% 0; } to { background-position: 0 0; } }
@keyframes at-rise { from { opacity: 0; transform: translateY(6px) scale(0.98); } }
@keyframes at-fade { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .at-amount[data-live] { animation: none; background: none; -webkit-text-fill-color: currentColor; }
  .at-span > i { transition: none; }
}

/* Touch: 44px targets */
@media (pointer: coarse) {
  .at[data-density="compact"] .at-row { min-height: 44px; padding-top: 12px; padding-bottom: 12px; }
  .at-chev.is-toggle::before { inset: -12px -14px; }
  .at-fold { height: 32px; padding: 0 8px 0 10px; }
  .at-fold::before { content: ''; position: absolute; inset: -6px 0; }
  .at-sum-btn { height: 32px; }
  .at-sum-btn::before { content: ''; position: absolute; inset: -6px 0; }
}
`;
