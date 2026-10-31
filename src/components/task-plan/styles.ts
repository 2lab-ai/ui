/**
 * The plan's look is the shared `planCss` (the same rail, markers and foot as `<ui-agent-run>`); this file is the
 * card around it, the earlier plans' groups and the empty state. Tokens and color-mix() only.
 */
export const styles = `
:host { display: block; min-width: 0; }
.tp { --pl-bg: var(--ib-card); position: relative; min-width: 0; padding: 12px 14px; border: 1px solid var(--ib-card-border); border-radius: 12px; background: var(--ib-card); box-shadow: var(--ib-shadow); color: var(--ib-text); font-size: 13px; line-height: 1.45; letter-spacing: -0.006em; }
:host([flush]) .tp { --pl-bg: var(--surface); padding: 0; border: 0; border-radius: 0; background: none; box-shadow: none; }
.tp-head { display: flex; align-items: baseline; gap: 8px; min-width: 0; margin: 0 0 6px; }
.tp-title { min-width: 0; margin: 0; font-size: 13px; font-weight: 650; line-height: 20px; color: var(--ib-text); overflow-wrap: anywhere; }

/* Earlier plans: a quiet group per plan — its title, its fate counts, its steps without a rail. */
.tp > .pl-earlier + .pl-earlier, .tp > .pl-earlier + .pl-list, .tp > .pl-earlier + .tp-none { margin-top: 2px; }
.tp-pasts { display: flex; flex-direction: column; gap: 10px; padding: 6px 0 10px 18px; }
.tp-past { min-width: 0; }
.tp-past-h { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; margin: 0 0 2px; font-size: 12px; font-weight: 600; line-height: 18px; color: var(--text-secondary); }
.tp-past-title { min-width: 0; overflow-wrap: anywhere; }
.tp-past-meta { font-weight: 500; color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
.tp-past-list > .pl-step::before, .tp-past-list > .pl-step::after { content: none !important; }
.tp-past-list > .pl-step { padding: 3px 0; }
.tp-past-list > .pl-step[data-step="done"] > .pl-main > .pl-line > .pl-text { color: var(--text-secondary); }

/* The folded leading steps hand the rail on to the list under them. */
.tp-lead > .pl-step:last-child::before { content: ""; position: absolute; left: 8.5px; top: 25px; bottom: 0; width: 1px; background: var(--ib-card-border); }
.tp-lead > .pl-step[data-step="done"]:last-child::after { content: ""; position: absolute; left: 8.5px; top: 25px; bottom: 0; width: 1px; background: var(--text-tertiary); }
.pl-earlier[data-earlier="earlier-steps"] > .pl-earlier-btn { margin-left: 22px; color: var(--text-tertiary); }

/* Window mode (max): a few rows and one quiet "+N" button at the end — the host opens the whole plan on its press. */
.tp-more { padding: 2px 0 0; }
.tp-more-btn { display: inline-flex; align-items: center; max-width: 100%; min-height: 28px; margin: 0 0 0 22px; padding: 4px 8px 4px 6px; border: 0; border-radius: 8px; background: none; color: var(--text-secondary); font-size: 12px; font-weight: 500; line-height: 16px; text-align: left; overflow-wrap: anywhere; -webkit-tap-highlight-color: transparent; transition: background-color var(--dur-press) ease, color var(--dur-press) ease, transform var(--dur-press) var(--ease-out); }
.tp-more-btn:active:not(:focus-visible) { transform: scale(0.97); }
@media (hover: hover) and (pointer: fine) {
  .tp-more-btn:hover { background: var(--ib-pill); color: var(--text); }
}
@media (pointer: coarse), (max-width: 639px) {
  .tp-more-btn { min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .tp-more-btn { transition: none !important; }
  .tp-more-btn:active:not(:focus-visible) { transform: none; }
}

/* Empty: a glyph, what is missing, when it will come. */
.tp-empty { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px 12px 16px; text-align: center; font-size: 12.5px; line-height: 1.45; color: var(--ib-muted); }
.tp-empty strong { font-size: 13px; font-weight: 600; color: var(--ib-text-2); }
.tp-empty-icon { width: 20px; height: 20px; margin-bottom: 2px; color: var(--ib-muted); }
.tp-none { padding: 6px 0 2px; }
`;
