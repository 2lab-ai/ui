/**
 * Ported from the soma-work dashboard board (`.kanban` / `.card` / BOARD RESPONSIVE, .prd/10 §3–§5 and
 * .prd/affectui/re-agent-inbox.md D1–D10). The status-tag tints are derived from the status tokens with
 * color-mix, so one rule holds in light and dark (text on its tint ≥ 4.5:1 in both).
 */
export const styles = `
:host {
  --ib-run-bg: color-mix(in srgb, var(--st-run) 16%, var(--ib-card));
  --ib-run-fg: color-mix(in srgb, var(--st-run) 70%, var(--ib-text));
  --ib-wait-bg: color-mix(in srgb, var(--st-wait) 16%, var(--ib-card));
  --ib-wait-fg: color-mix(in srgb, var(--st-wait) 70%, var(--ib-text));
  --ib-done-bg: color-mix(in srgb, var(--st-done) 16%, var(--ib-card));
  --ib-done-fg: color-mix(in srgb, var(--st-done) 70%, var(--ib-text));
  --ib-fail-bg: color-mix(in srgb, var(--st-fail) 16%, var(--ib-card));
  --ib-fail-fg: color-mix(in srgb, var(--st-fail-text) 70%, var(--ib-text));
  --ib-rest-bg: var(--ib-pill);
  --ib-rest-fg: var(--ib-text-2);
}
.ib { container: ib / inline-size; position: relative; }

/* Board = equal columns. No overflow clip on columns: a card flying between columns stays visible. */
.ib-board { display: grid; grid-template-columns: repeat(var(--ib-cols, 3), minmax(0, 1fr)); gap: 12px; align-items: start; }
.ib-col { position: relative; background: var(--ib-col); border-radius: 14px; padding: 2px 4px 4px; min-width: 0; display: flex; flex-direction: column; }
/* The head: the name on the cards' reading edge, the count at the end. No mark before the name — a sparkle
   there meant nothing (0.21.0). */
.ib-col-head { display: flex; align-items: center; gap: 8px; padding: 10px 8px 8px 15px; min-height: 40px; }
.ib-spark svg { width: 14px; height: 14px; }
.ib-col-name { flex: 1; min-width: 0; margin: 0; text-align: left; font-size: 12px; font-weight: 500; line-height: 1.4; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ib-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
:host([lang="ko"]) .ib-col-name { letter-spacing: 0.04em; }
.ib-count { flex-shrink: 0; background: var(--ib-pill); color: var(--ib-text-2); border-radius: 6px; padding: 1px 7px; font-size: 12px; font-weight: 500; min-width: 22px; text-align: center; font-variant-numeric: tabular-nums; }
.ib-cards { position: relative; display: flex; flex-direction: column; gap: 8px; list-style: none; margin: 0; padding: 0; }
.ib-empty { margin: 0; text-align: center; color: var(--ib-muted); font-size: 13px; padding: 14px 8px 18px; }
.ib-empty[hidden] { display: none; }

/* List = the same columns stacked full width (same DOM). Forced with view="list"; automatic below 640px.
   The rules follow .ib[data-view] (it mirrors the attribute) so a switch can be measured before it lands. */
.ib[data-view="list"] .ib-board { grid-template-columns: minmax(0, 1fr); }
.ib[data-view="list"] .ib-col-name { flex: 0 1 auto; text-align: left; }
.ib[data-view="list"] .ib-summary { -webkit-line-clamp: 1; }
.ib[data-view="list"] .ib-empty { padding: 10px 8px 16px; }
/* Narrow board: the columns scroll sideways inside the board (the page never scrolls sideways). */
@container ib (max-width: 839px) {
  .ib:not([data-view="list"]) .ib-board {
    grid-template-columns: repeat(var(--ib-cols, 3), minmax(min(300px, 84cqi), 1fr));
    overflow-x: auto; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; padding-bottom: 8px;
  }
  .ib:not([data-view="list"]) .ib-col { scroll-snap-align: start; }
}
@container ib (max-width: 639px) {
  .ib:not([data-view="board"]) .ib-board { grid-template-columns: minmax(0, 1fr); overflow-x: visible; scroll-snap-type: none; padding-bottom: 0; }
  .ib:not([data-view="board"]) .ib-col-name { flex: 0 1 auto; text-align: left; }
  .ib:not([data-view="board"]) .ib-summary { -webkit-line-clamp: 1; }
  .ib:not([data-view="board"]) .ib-empty { padding: 10px 8px 16px; }
}
/* A bare column is just its list (a CRON job's runs under the host's own head). */
.ib-col.is-bare { background: none; padding: 0; border-radius: 0; }

/* Groups inside a column (DONE by finish day): a disclosure head, then its cards; a closed group draws none. */
.ib-groups { display: flex; flex-direction: column; gap: 8px; }
.ib-groups:empty { display: none; }
.ib-cards:not(:empty) + .ib-groups { margin-top: 8px; }
.ib-group { display: flex; flex-direction: column; gap: 8px; }
.ib-group.is-stale { position: absolute; z-index: 1; pointer-events: none; }
.ib-group-head {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: 32px; padding: 6px 8px; border: 0; border-radius: 8px;
  background: none; color: var(--ib-text-2); font: inherit; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-align: left; cursor: pointer;
  transition: background-color 150ms ease;
}
.ib-group-head:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 1px; }
.ib-group-head .ib-chev { width: 12px; height: 12px; flex-shrink: 0; color: var(--ib-muted); transition: transform var(--dur-press) var(--ease-out); }
.ib-group-head[aria-expanded="true"] .ib-chev { transform: rotate(90deg); }
.ib-group-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ib-group-cards[hidden] { display: none; }

/* Loading: skeleton cards where cards will be, never a false "0 · Nothing here". Opacity pulse only, staggered. */
.ib-skel { display: flex; flex-direction: column; gap: 8px; }
.ib-skel:empty { display: none; }
.ib-skel-card { background: var(--ib-card); border: 1px solid var(--ib-card-border); border-radius: 12px; box-shadow: var(--ib-shadow); padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.ib-sk { background: var(--ib-pill); border-radius: 6px; animation: ib-sk-pulse 1.6s ease-in-out infinite; }
.ib-sk-title { height: 14px; width: 68%; }
.ib-sk-meta { height: 10px; width: 42%; }
.ib-sk-pill { height: 20px; width: 34%; border-radius: 999px; }
.ib-skel-card:nth-child(2) .ib-sk { animation-delay: 120ms; }
.ib-skel-card:nth-child(3) .ib-sk { animation-delay: 240ms; }
/* Counts are claims about the whole board: none until it is certified (a pulse while it loads). */
.ib-count:empty { min-height: 18px; }
.ib-board[aria-busy="true"] .ib-count:empty { animation: ib-sk-pulse 1.6s ease-in-out infinite; }
.ib-board:not([aria-busy="true"]) .ib-count:empty { visibility: hidden; }

/* ── CARD — collapsed face + in-place expansion ── */
.ib-card {
  position: relative; background: var(--ib-card); border: 1px solid var(--ib-card-border); border-radius: 12px;
  box-shadow: var(--ib-shadow); color: var(--ib-text); transition: border-color 150ms ease, box-shadow 150ms ease;
  --st-color: var(--ib-muted);
}
.ib-card[data-status="waiting"] { --st-color: var(--st-wait); }
.ib-card[data-status="running"] { --st-color: var(--st-run); }
.ib-card[data-status="done"] { --st-color: var(--st-done); }
.ib-card[data-status="failed"] { --st-color: var(--st-fail); }
/* Parked cards are dimmed with colour, not opacity (opacity would fight the enter / exit fades). */
.ib-card[data-status="idle"] { background: var(--ib-card-dim); box-shadow: none; }
.ib-card[data-status="idle"] .ib-title { color: var(--ib-text-2); font-weight: 500; }
.ib-card[data-status="idle"] .ib-summary { color: var(--ib-muted); }
.ib-card.is-flying { z-index: 5; box-shadow: var(--ib-shadow-raised); }
.ib-card.is-exiting { position: absolute; z-index: 1; pointer-events: none; }
.ib-face { display: block; padding: 12px 14px; border-radius: 11px; container: ibface / inline-size; }
.ib-face[role="button"] { cursor: pointer; }
.ib-face:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
.ib-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ib-spark { flex-shrink: 0; display: inline-flex; color: var(--st-color); }
/* The host's lead (a CRON badge): the status colour, text mixed toward ink so it reads ≥ 4.5:1 on its tint. */
.ib-lead {
  flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; padding: 1px 7px 1px 5px; border-radius: 999px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.06em; line-height: 1.5;
  color: color-mix(in srgb, var(--st-color) 70%, var(--ib-text));
  background: color-mix(in srgb, var(--st-color) 14%, var(--ib-card));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--st-color) 45%, transparent);
}
.ib-lead svg { width: 12px; height: 12px; }
/* A glyph-only lead (0.16.0 — an epic's or a plain task's mark): the glyph in the status colour, no pill. */
.ib-lead.is-icon { padding: 0; background: none; box-shadow: none; color: var(--st-color); }
.ib-lead.is-icon svg { width: 14px; height: 14px; }
/* The face's star toggle (0.16.0): a 24px target at the head's right end; on = the filled amber star. */
.ib-star {
  flex: none; display: inline-grid; place-items: center; inline-size: 24px; block-size: 24px; margin: -4px -6px -4px 0;
  padding: 0; border: 0; border-radius: 6px; background: none; color: var(--ib-muted); cursor: pointer;
}
.ib-badge + .ib-star { margin-left: 0; }
.ib-title + .ib-star { margin-left: auto; }
.ib-star svg { inline-size: 16px; block-size: 16px; fill: none; }
.ib-star.is-on { color: var(--yellow); }
.ib-star.is-on svg { fill: currentColor; }
.ib-star[aria-disabled="true"] { cursor: default; opacity: 0.6; }
.ib-star:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 1px; }
@media (hover: hover) and (pointer: fine) { .ib-star:not([aria-disabled="true"]):hover { color: var(--yellow); background: color-mix(in srgb, var(--yellow) 12%, transparent); } }
/* Owner badge: right end of the head, keeps its width up to its cap so the title truncates first. Eight hues,
   each a tint of the card with text mixed toward ink (≥ 4.5:1 in both themes). */
.ib-badge {
  flex: 0 0 auto; margin-left: auto; max-inline-size: min(45%, 168px); padding: 2px 8px; border-radius: 999px;
  font-size: 12px; font-weight: 600; line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  --hue: var(--accent);
  background: color-mix(in srgb, var(--hue) 18%, var(--ib-card));
  color: color-mix(in srgb, var(--hue) 55%, var(--ib-text));
}
.ib-badge[data-hue="1"] { --hue: var(--yellow); }
.ib-badge[data-hue="2"] { --hue: var(--green); }
.ib-badge[data-hue="3"] { --hue: var(--red); }
.ib-badge[data-hue="4"] { --hue: color-mix(in srgb, var(--accent) 50%, var(--green)); }
.ib-badge[data-hue="5"] { --hue: var(--orange); }
.ib-badge[data-hue="6"] { --hue: var(--purple); }
.ib-badge[data-hue="7"] { --hue: color-mix(in srgb, var(--yellow) 55%, var(--green)); }
.ib-title { flex: 1 1 auto; font-size: 15px; font-weight: 600; line-height: 1.3; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ib-summary {
  margin-top: 6px; font-size: 13.5px; line-height: 1.45; color: var(--ib-text-2);
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere;
}
/* The TL;DR box (0.20.0): the run's short report on a quiet tint of the status colour; × at its top right. */
.ib-tldr {
  margin-top: 8px; padding: 7px 8px 8px 10px; border-radius: 8px;
  background: color-mix(in srgb, var(--st-color) 7%, var(--ib-card));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--st-color) 22%, transparent);
}
.ib-tldr-head { display: flex; align-items: center; gap: 6px; min-height: 20px; }
.ib-tldr-label {
  font-size: 11.5px; font-weight: 700; letter-spacing: 0.04em; line-height: 1.3;
  color: color-mix(in srgb, var(--st-color) 55%, var(--ib-text));
}
.ib-tldr-x {
  flex: none; display: inline-grid; place-items: center; inline-size: 22px; block-size: 22px; margin: -2px -3px -2px auto;
  padding: 0; border: 0; border-radius: 6px; background: none; color: var(--ib-muted); cursor: pointer;
  transition: background-color var(--dur-press) ease, color var(--dur-press) ease;
}
.ib-tldr-x svg { inline-size: 14px; block-size: 14px; }
.ib-tldr-x:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 1px; }
@media (hover: hover) and (pointer: fine) { .ib-tldr-x:hover { color: var(--ib-text); background: var(--ib-pill); } }
.ib-tldr-lines { margin: 4px 0 0; padding: 0 0 0 16px; font-size: 13px; line-height: 1.45; color: var(--ib-text); }
.ib-tldr-lines li { overflow-wrap: anywhere; }
.ib-tldr-lines li + li { margin-top: 2px; }
.ib-card[data-status="idle"] .ib-tldr-lines { color: var(--ib-text-2); }
/* The task in progress. */
.ib-task { margin-top: 8px; display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 13px; color: var(--ib-text); background: var(--ib-pill); border-radius: 8px; padding: 5px 9px; }
.ib-task-id { flex-shrink: 0; color: var(--ib-muted); font-variant-numeric: tabular-nums; font-size: 12px; }
.ib-task-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ib-task-time { flex-shrink: 0; color: var(--ib-text-2); font-variant-numeric: tabular-nums; }
/* Sub-agents: status dots + counts. */
.ib-agents { margin-top: 8px; display: flex; align-items: center; gap: 7px; min-width: 0; font-size: 12.5px; color: var(--ib-text-2); }
.ib-agents > svg { width: 14px; height: 14px; flex-shrink: 0; color: var(--ib-muted); }
.ib-dots { display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0; }
.ib-adot { width: 7px; height: 7px; border-radius: 50%; background: var(--ib-muted); display: inline-block; }
.ib-adot.is-running { background: var(--st-run); animation: ib-pulse 1.6s ease-in-out infinite; }
.ib-adot.is-done { background: var(--st-done); }
.ib-adot.is-failed { background: var(--st-fail); }
.ib-adot.is-unknown { background: transparent; box-shadow: inset 0 0 0 1.5px var(--ib-muted); }
.ib-adot.is-stopped { background: var(--ib-muted); border-radius: 2px; }
.ib-dots-more { font-size: 11px; color: var(--ib-muted); margin-left: 2px; font-variant-numeric: tabular-nums; }
.ib-agents-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-variant-numeric: tabular-nums; }
.ib-agents-text b { color: var(--ib-text); font-weight: 600; }
.ib-agents-text .ib-fail { color: var(--st-fail-text); font-weight: 600; }
/* Tokens · cost. */
.ib-usage { margin-top: 8px; display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; font-size: 13px; color: var(--ib-text-2); font-variant-numeric: tabular-nums; }
.ib-cnt { color: var(--ib-text); font-weight: 600; }
.ib-unit { margin-left: 3px; color: var(--ib-muted); }
.ib-sep { color: var(--ib-muted); }
/* Files the run made: count, newest chips, +N. */
.ib-arts { display: flex; align-items: center; gap: 5px; margin-top: 8px; min-width: 0; overflow: hidden; }
.ib-arts-n { display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0; font-size: 11px; font-weight: 600; color: var(--ib-text-2); font-variant-numeric: tabular-nums; }
.ib-glyph { width: 14px; height: 14px; flex-shrink: 0; }
.ib-chip {
  display: inline-flex; align-items: center; gap: 5px; flex: 1 1 0; min-width: 0; max-width: 160px; height: 24px; padding: 0 8px;
  border: 1px solid var(--ib-card-border); border-radius: 999px; background: var(--ib-pill); color: var(--ib-text); font-size: 11.5px; line-height: 1;
  --tint: var(--text-secondary);
}
.ib-chip .ib-glyph { color: var(--tint); }
.ib-chip.is-image { --tint: var(--green); }
.ib-chip.is-html { --tint: var(--orange); }
.ib-chip.is-audio { --tint: var(--purple); }
.ib-chip.is-video, .ib-chip.is-pdf { --tint: var(--red); }
.ib-chip.is-markdown { --tint: var(--accent); }
.ib-chip-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* A chip with an id is a button that opens the file (ui-artifact), never the card. */
button.ib-chip { font: inherit; font-size: 11.5px; cursor: zoom-in; transition: border-color 150ms ease, background-color 150ms ease, transform var(--dur-press) var(--ease-out); }
button.ib-chip:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 1px; }
button.ib-chip:active:not(:focus-visible) { transform: scale(0.97); }
.ib-arts-more { flex-shrink: 0; font-size: 11px; color: var(--ib-muted); }
/* Linked issues, PRs and wikis (0.19.0): chips that open the page in a new tab, never the card. */
.ib-links { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-top: 8px; min-width: 0; }
.ib-link {
  display: inline-flex; align-items: center; gap: 5px; min-width: 0; max-width: 220px; height: 24px; padding: 0 8px;
  border: 1px solid var(--ib-card-border); border-radius: 999px; background: var(--ib-pill); color: var(--ib-text);
  font-size: 11.5px; line-height: 1; text-decoration: none; --tint: var(--text-secondary);
  transition: border-color 150ms ease, background-color 150ms ease, transform var(--dur-press) var(--ease-out);
}
.ib-link svg { width: 13px; height: 13px; flex-shrink: 0; color: var(--tint); }
.ib-link.is-issue { --tint: var(--green); }
.ib-link.is-pr { --tint: var(--purple); }
.ib-link.is-wiki { --tint: var(--accent); }
.ib-link-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.ib-link-st { flex-shrink: 0; white-space: nowrap; color: var(--ib-text-2); }
.ib-link-st[data-tone="run"] { color: var(--ib-run-fg); }
.ib-link-st[data-tone="done"] { color: var(--ib-done-fg); }
.ib-link-st[data-tone="fail"] { color: var(--ib-fail-fg); }
.ib-link-st[data-tone="wait"] { color: var(--ib-wait-fg); }
.ib-link-st[data-tone="danger"] { color: var(--st-fail-text); font-weight: 600; }
.ib-link:hover { border-color: var(--border-strong, var(--ib-card-border)); }
.ib-link:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 1px; }
.ib-link:active:not(:focus-visible) { transform: scale(0.97); }
.ib-links-more { flex-shrink: 0; font-size: 11px; color: var(--ib-muted); }
/* Foot: the status tag, then the metrics on the right (a narrow foot wraps them below). */
.ib-foot { margin-top: 10px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; font-size: 13px; color: var(--ib-text-2); min-width: 0; }
.ib-tag {
  display: inline-flex; align-items: center; gap: 6px; min-width: 0; max-width: 100%; flex: 0 1 auto; height: 24px; padding: 0 10px 0 8px;
  border-radius: 999px; font-size: 12.5px; font-weight: 500; white-space: nowrap; overflow: hidden; font-variant-numeric: tabular-nums;
}
.ib-tag[data-tone="run"] { background: var(--ib-run-bg); color: var(--ib-run-fg); }
.ib-tag[data-tone="wait"] { background: var(--ib-wait-bg); color: var(--ib-wait-fg); }
.ib-tag[data-tone="done"] { background: var(--ib-done-bg); color: var(--ib-done-fg); }
.ib-tag[data-tone="fail"] { background: var(--ib-fail-bg); color: var(--ib-fail-fg); }
.ib-tag[data-tone="rest"] { background: var(--ib-rest-bg); color: var(--ib-rest-fg); }
.ib-tag-text { overflow: hidden; text-overflow: ellipsis; }
.ib-tag-icon { flex-shrink: 0; display: inline-flex; align-items: center; color: currentColor; }
.ib-tag-icon svg { width: 12px; height: 12px; }
.ib-ago { color: inherit; }
.ib-ago::before { content: "·"; margin: 0 6px; }
/* The state word ("Running · ", "Done in ") goes only when the face has 300px of content or less. */
@container ibface (max-width: 300px) { .ib-tag .ib-pre { display: none; } }
.ib-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; display: inline-block; }
.ib-dot.is-hollow { background: transparent; box-shadow: inset 0 0 0 1.5px currentColor; }
/* The running ring: its track follows the tag colour, so it reads on the tint. */
.ib-spin {
  width: 12px; height: 12px; border-radius: 50%; display: inline-block;
  border: 2px solid color-mix(in srgb, currentColor 25%, transparent); border-top-color: currentColor; border-right-color: currentColor;
  animation: ib-spin 0.9s linear infinite;
}
.ib-metrics { display: inline-flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; row-gap: 4px; max-width: 100%; color: var(--ib-muted); flex-shrink: 0; margin-left: auto; font-variant-numeric: tabular-nums; }
.ib-metric { display: inline-flex; align-items: center; gap: 5px; padding: 0 9px; }
.ib-metric + .ib-metric { border-left: 1px solid var(--ib-card-border); }
.ib-metric:last-child { padding-right: 0; }
.ib-metric svg { width: 13px; height: 13px; }
.ib-metric.is-warn svg { color: var(--st-wait); }
.ib-metric.is-danger { color: var(--st-fail-text); font-weight: 600; }
/* Host metrics (PR, media…): a tone colours text and glyph, mixed toward ink for contrast on the card. */
.ib-metric.is-host { white-space: nowrap; }
.ib-metric.is-host[data-tone="run"] { color: var(--ib-run-fg); }
.ib-metric.is-host[data-tone="done"] { color: var(--ib-done-fg); }
.ib-metric.is-host[data-tone="fail"] { color: var(--ib-fail-fg); }
.ib-metric.is-host[data-tone="wait"] { color: var(--ib-wait-fg); }
/* 0.22.0 — the model as icons: the maker's mark in the model's colour, then the effort gauge (rising bars). */
.ib-metric.is-model { gap: 3px; }
.ib-metric.is-model > svg:first-child:not(.ib-eff) { color: var(--ib-model-hue, currentColor); }
/* 0.23.0 — OpenAI's and xAI's marks are black: the ink, not the muted metric colour (white in dark mode). */
.ib-metric.is-model.is-ink > svg:first-child:not(.ib-eff) { color: var(--ib-text); }
.ib-metric .ib-eff { width: 13px; height: 13px; }
.ib-eff .ib-eff-bar { fill: color-mix(in srgb, currentColor 22%, transparent); }
.ib-eff .ib-eff-bar.is-on { fill: currentColor; }
.ib-eff[data-effort="xhigh"] .ib-eff-bar.is-on { fill: var(--red); }
.ib-eff[data-effort="max"] .ib-eff-bar.is-on { fill: url(#ib-eff-gold); }
.ib-eff[data-effort="ultra"] .ib-eff-bar.is-on { fill: url(#ib-eff-holo); }
@media (forced-colors: active) { .ib-eff .ib-eff-bar.is-on { fill: CanvasText; } }
.ib-metric.is-host[data-tone="warn"] svg { color: var(--st-wait); }
.ib-metric.is-host[data-tone="danger"] { color: var(--st-fail-text); font-weight: 600; }

/* Expansion — grid row 0fr → 1fr; cards below ride the animated row. */
.ib-expand { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--dur-expand) var(--ease-out); }
.ib-card.is-open .ib-expand { grid-template-rows: 1fr; }
.ib-expand-inner { min-height: 0; overflow: hidden; opacity: 0; transition: opacity var(--dur-expand) var(--ease-out); }
.ib-card.is-open .ib-expand-inner { opacity: 1; }
/* An open card says its summary once and in full (a waiting card's question): the host's body need not repeat
   the sentence the clamp cut short (0.21.0). */
.ib .ib-card.is-open .ib-summary { display: block; -webkit-line-clamp: unset; }
.ib-card.no-motion .ib-expand, .ib-card.no-motion .ib-expand-inner { transition: none; }
.ib-body { margin: 0 14px; padding: 12px 0 14px; border-top: 1px solid var(--ib-card-border); font-size: 13px; color: var(--ib-text-2); }
/* Steps: dot + connector, the current step's dot in ink. */
.ib-more { font-size: 12px; color: var(--ib-muted); padding: 0 0 6px 16px; }
.ib-steps { list-style: none; margin: 0; padding: 0; }
.ib-step { position: relative; display: flex; gap: 10px; padding: 0 0 8px 16px; line-height: 1.4; color: var(--ib-text-2); }
.ib-step::before { content: ''; position: absolute; left: 2px; top: 6px; width: 6px; height: 6px; border-radius: 50%; background: var(--ib-muted); opacity: 0.55; }
.ib-step::after { content: ''; position: absolute; left: 4.5px; top: 15px; bottom: 1px; width: 1px; background: var(--ib-card-border); }
.ib-step:last-child { padding-bottom: 0; }
.ib-step:last-child::after { display: none; }
.ib-step.is-current { color: var(--ib-text); }
.ib-step.is-current::before { background: var(--ib-text); opacity: 1; }
.ib-step.is-pending { color: var(--ib-muted); }
.ib-step-text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.ib-step-meta { flex-shrink: 0; color: var(--ib-muted); font-size: 12.5px; font-variant-numeric: tabular-nums; }
/* Button row: model on the left, secondary outline buttons, one ink primary last. */
.ib-bar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--ib-card-border); }
.ib-bar:first-child { margin-top: 0; padding-top: 0; border-top: 0; }
.ib-model { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ib-muted); font-size: 13px; }
.ib-actions { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; margin-left: auto; }
.ib-btn {
  display: inline-flex; align-items: center; justify-content: center; background: var(--ib-card); border: 1px solid var(--ib-card-border);
  border-radius: 8px; color: var(--ib-text); font: inherit; font-size: 13px; font-weight: 500; padding: 5px 12px; min-height: 32px;
  white-space: nowrap; cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, opacity 150ms ease, transform var(--dur-press) var(--ease-out);
}
.ib-btn.is-primary { background: var(--ib-text); border-color: var(--ib-text); color: var(--ib-card); }
.ib-btn[aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; }
.ib-btn:active:not([aria-disabled="true"]):not(:focus-visible) { transform: scale(0.97); }

@keyframes ib-spin { to { transform: rotate(360deg); } }
@keyframes ib-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@keyframes ib-sk-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }

/* Hover — pointer devices only; colour / border, never movement. */
@media (hover: hover) and (pointer: fine) {
  .ib-card:hover { border-color: var(--ib-muted); }
  .ib-card[data-status="idle"]:hover { border-color: var(--ib-card-border); }
  .ib-btn:hover:not([aria-disabled="true"]) { border-color: var(--ib-muted); }
  .ib-btn.is-primary:hover:not([aria-disabled="true"]) { border-color: var(--ib-text); opacity: 0.88; }
  button.ib-chip:hover { border-color: var(--tint); background: var(--ib-card); }
  .ib-group-head:hover { background: var(--ib-pill); }
}
/* 44px targets on touch and narrow screens. */
@media (pointer: coarse), (max-width: 639px) {
  .ib-btn { min-height: 44px; padding: 8px 14px; }
  .ib-group-head { min-height: 44px; }
  /* The face's small controls keep their look and get a 44px vertical reach (an invisible hit area, as the kit's
     chip). */
  .ib-star, .ib-tldr-x, .ib-link { position: relative; }
  /* Vertical reach only (as the kit's chip): a wider box would take presses meant for the title or summary. */
  .ib-star::after, .ib-link::after { content: ''; position: absolute; inset: -10px 0; }
  /* Wrapped link rows sit 20px apart, so one chip's reach (10px down) never covers the next row's (10px up). */
  .ib-links { row-gap: 20px; }
  .ib-tldr-x::after { content: ''; position: absolute; inset: -11px 0; }
}
/* Reduced motion: the global rule only shortens durations, so infinite loops stop here; the ring stays whole. */
@media (prefers-reduced-motion: reduce) {
  .ib-spin { animation: none; border-color: currentColor; }
  .ib-adot.is-running { animation: none; }
  .ib-sk, .ib-board[aria-busy="true"] .ib-count:empty { animation: none; }
  .ib-group-head .ib-chev { transition: none; }
}
`;
