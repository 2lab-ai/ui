/** Ported from the soma-work dashboard (.prd/affectui/re-ai-answer.md D2 · D6–D10 · D15–D18, `.ans-*` + `.md-doc`). */
export const styles = `
.ui-root { container: ans / inline-size; }
.ans-card { position: relative; padding: 12px 14px 10px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--text); box-shadow: var(--ib-shadow); overflow: hidden; }
.ans-card.is-in > * { animation: ans-in var(--dur-fade) var(--ease-out) both; }
.ans-title { margin: 0 0 10px; font-size: 15px; font-weight: 600; line-height: 1.35; letter-spacing: -0.01em; color: var(--text); overflow-wrap: anywhere; }

/* Link cards (D6): a sideways row, scrollbar hidden, both ends fade. */
.ans-srcs { display: flex; gap: 8px; margin: -4px -14px 8px; padding: 4px 14px; list-style: none; overflow-x: auto; scrollbar-width: none;
  -webkit-mask: linear-gradient(90deg, transparent, black 12px, black calc(100% - 12px), transparent);
  mask: linear-gradient(90deg, transparent, black 12px, black calc(100% - 12px), transparent); }
.ans-srcs::-webkit-scrollbar { display: none; }
.ans-srcs > li { flex: none; display: flex; }
.ans-src { display: flex; flex-direction: column; gap: 4px; width: 148px; min-height: 64px; padding: 8px 10px; border-radius: 10px; background: var(--surface-raised); color: inherit; text-decoration: none; transition: background-color var(--dur-press) ease, box-shadow var(--dur-press) ease; }
.ans-card.is-in .ans-src { animation: ans-pop var(--dur-move) var(--ease-out) both; animation-delay: calc(var(--ans-i, 0) * 60ms); }
.ans-src:hover { background: var(--ib-pill); }
.ans-src.is-lit { box-shadow: inset 0 0 0 1.5px var(--text-tertiary); }
.ans-src-site { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 11px; color: var(--text-secondary); }
.ans-src-name { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ans-src-num { flex: none; font-variant-numeric: tabular-nums; color: var(--text-tertiary); }
.ans-src-title { display: -webkit-box; overflow: hidden; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-size: 12px; line-height: 1.4; color: var(--text); word-break: break-word; }

/* Label (D9) and body (D2). */
.ans-label { margin: 0 0 6px; font-size: 12px; font-weight: 600; color: var(--text-secondary); }
.ans-body { font-size: 13.5px; line-height: 1.6; }
.ans-body > :last-child { margin-bottom: 0; }

/* The document (dashboard .md-doc). */
.md-doc { color: var(--text); word-break: break-word; }
.md-doc h1, .md-doc h2, .md-doc h3, .md-doc h4, .md-doc h5, .md-doc h6 { margin: 1.3em 0 0.5em; line-height: 1.3; letter-spacing: -0.01em; }
.md-doc h1, .md-doc h2 { font-size: 1.15em; }
.md-doc h3, .md-doc h4, .md-doc h5, .md-doc h6 { font-size: 1em; }
.md-doc > :first-child { margin-top: 0; }
.md-doc p, .md-doc ul, .md-doc ol, .md-doc blockquote, .md-doc pre, .md-doc .md-table { margin: 0 0 0.9em; }
.md-doc ul, .md-doc ol { padding-left: 1.4em; }
.md-doc li + li { margin-top: 0.2em; }
.md-doc li > ul, .md-doc li > ol { margin: 0.2em 0 0; }
.md-doc code { padding: 0.1em 0.35em; border-radius: 4px; background: var(--ib-pill); font: 0.88em var(--mono); }
.md-doc pre { padding: 12px 14px; overflow: auto; border: 1px solid var(--border); border-radius: 8px; background: var(--ib-col); }
.md-doc pre code { padding: 0; background: none; font-size: 12.5px; line-height: 1.55; }
.md-doc blockquote { padding: 2px 0 2px 12px; border-left: 3px solid var(--border-focus); color: var(--text-secondary); }
.md-doc blockquote > :last-child { margin-bottom: 0; }
.md-doc hr { margin: 1.4em 0; border: 0; border-top: 1px solid var(--border); }
.md-doc a { color: var(--accent); }
.md-doc .md-table { overflow-x: auto; }
.md-doc table { border-collapse: collapse; font-size: 0.93em; }
.md-doc th, .md-doc td { padding: 6px 10px; border: 1px solid var(--border); text-align: left; vertical-align: top; }
.md-doc th { background: var(--ib-col); font-weight: 600; }

/* Link chips (D7) — lit = inverted (D8). */
.ans-body .ans-cite { display: inline-block; max-width: 16ch; height: 18px; margin: 0 1px 0 3px; padding: 0 6px; overflow: hidden; border-radius: 6px; background: var(--surface-raised); font-size: 11px; font-weight: 500; line-height: 18px; color: var(--text-secondary); text-decoration: none; white-space: nowrap; text-overflow: ellipsis; vertical-align: middle; transition: background-color var(--dur-press) ease, color var(--dur-press) ease; }
.ans-body .ans-cite:hover { background: var(--ib-pill); color: var(--text); }
.ans-body .ans-cite.is-lit { background: var(--text); color: var(--surface); }
.ans-nb { white-space: nowrap; }
.ans-cite:focus-visible, .ans-src:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }

/* Footer (D10): Copy · status · response time. */
.ans-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border); }
.ans-btn { display: inline-flex; flex: none; align-items: center; justify-content: center; gap: 5px; min-height: 32px; padding: 5px 12px; border: 1px solid var(--ib-card-border); border-radius: 8px; background: var(--ib-card); font-size: 13px; font-weight: 500; color: var(--ib-text); white-space: nowrap; transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease; }
.ans-btn svg { width: 13px; height: 13px; }
.ans-copy[data-copied] { color: var(--green); }
.ans-status { flex: 1 1 0; min-width: 0; font-size: 12px; color: var(--text-tertiary); }
.ans-end { display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 6px 10px; margin-left: auto; min-width: 0; }
.ans-took { font-size: 11.5px; color: var(--text-tertiary); font-variant-numeric: tabular-nums; white-space: nowrap; }
@media (hover: hover) and (pointer: fine) { .ans-btn:hover { border-color: var(--ib-muted); } }

/* Writing (D12): a sweep over the words + a pulsing run-colour dot. */
.ans-foot.is-writing { min-height: 41px; }
.ans-writing { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.ans-shimmer { color: transparent; background: linear-gradient(90deg, var(--text-tertiary) 38%, var(--text) 50%, var(--text-tertiary) 62%) 100% 0 / 300% 100% no-repeat; -webkit-background-clip: text; background-clip: text; animation: ans-sweep 1.6s linear infinite; }
.ans-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--st-run); animation: ans-pulse 1s ease-in-out infinite; }

/* Loading · empty · failed (D13). */
.ans-state { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; margin: 0; font-size: 12px; color: var(--text-tertiary); }
.ans-error { font-size: 12px; color: var(--st-fail-text); overflow-wrap: anywhere; }

@keyframes ans-in { from { opacity: 0; filter: blur(2px); transform: translateY(3px); } to { opacity: 1; filter: none; transform: none; } }
@keyframes ans-pop { from { opacity: 0; transform: translateY(6px) scale(0.96); } to { opacity: 1; transform: none; } }
@keyframes ans-sweep { from { background-position: 100% 0; } to { background-position: 0 0; } }
@keyframes ans-pulse { 50% { transform: scale(0.6); opacity: 0.45; } }

@container ans (min-width: 520px) {
  .ans-card { padding: 16px 18px 12px; }
  .ans-title { font-size: 16.5px; }
  .ans-srcs { margin: -4px -18px 10px; padding: 4px 18px; }
  .ans-src { width: 172px; }
  .ans-body { font-size: 14px; }
}

/* Touch (D16): the chip's hit area grows, chips are never cut, buttons are 44px. */
@media (pointer: coarse) {
  .ans-body .ans-cite { position: relative; overflow: visible; max-width: none; }
  .ans-cite::after { content: ''; position: absolute; inset: -10px -4px; }
  .ans-btn { min-height: 44px; }
}
/* The global rule only shortens durations, so infinite loops would flicker: stop them. */
@media (prefers-reduced-motion: reduce) {
  .ans-shimmer, .ans-dot, .ans-src, .ans-card.is-in > * { animation: none !important; }
  .ans-shimmer { background: none; color: var(--text-tertiary); }
  .ans-src, .ans-body .ans-cite { transition: none; }
}
`;
