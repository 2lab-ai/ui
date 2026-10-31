import { mdDocCss } from '../../core/markdown';
import { fileCardStyles } from '../file-card/styles';

/**
 * The strip / grid / chips of file cards, the hover peek (the `.mp-pop` recipe: origin-aware, raised shadow) and
 * the viewer's slotted header, body and footer inside `<ui-dialog size="xl">` (its panel parts are reached with
 * `::part`). Colour comes only from the kind's wash; everything else is ink on the card.
 */
export const styles = `
:host { display: block; min-width: 0; }
${fileCardStyles}
${mdDocCss}

/* ── list ─────────────────────────────────────────────────────────────── */
.av-head {
  display: flex; align-items: center; gap: 6px; margin: 0 0 8px; font-size: 12.5px; line-height: 18px;
  font-weight: 600; color: var(--ib-text);
}
.av-count {
  display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 6px; border-radius: 999px;
  background: var(--ib-pill); color: var(--ib-text-2); font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums;
}
.av-empty { margin: 0; font-size: 12.5px; color: var(--ib-muted); }
.av-list { display: flex; gap: 10px; margin: 0; padding: 0; list-style: none; }
.av-list > li { display: flex; min-width: 0; }
.av-list > li > .fc { flex: 1 1 auto; }
.av-list[data-layout="strip"] {
  --av-fs: 0px; --av-fe: 0px;
  margin: -4px; padding: 4px; overflow-x: auto; overflow-y: hidden; overscroll-behavior-x: contain;
  scroll-snap-type: x proximity; scroll-padding-inline: 4px; scrollbar-width: thin;
  scrollbar-color: var(--ib-pill) transparent;
}
.av-list[data-layout="strip"] > li { flex: none; scroll-snap-align: start; }
.av-list[data-fade-start] { --av-fs: 28px; }
.av-list[data-fade-end] { --av-fe: 28px; }
.av-list[data-fade-start], .av-list[data-fade-end] {
  -webkit-mask-image: linear-gradient(90deg, transparent, black var(--av-fs), black calc(100% - var(--av-fe)), transparent);
  mask-image: linear-gradient(90deg, transparent, black var(--av-fs), black calc(100% - var(--av-fe)), transparent);
}
.av-list[data-layout="grid"] { --fc-tile-w: 100%; display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); }
.av-list[data-layout="chips"] { flex-wrap: wrap; gap: 6px; }
.av-list[data-layout="list"] { flex-direction: column; gap: 6px; }

/* ── peek ─────────────────────────────────────────────────────────────── */
/* A fixed 100px box at 0,0: the containing block's origin and scale for the fixed peek. */
.av-probe { position: fixed; left: 0; top: 0; width: 100px; height: 0; visibility: hidden; pointer-events: none; }
.av-peek {
  position: fixed; z-index: 150; left: 0; top: 0; box-sizing: border-box; width: 320px; max-width: calc(100vw - 16px);
  overflow: hidden; border-radius: 12px; background: var(--ib-card); color: var(--ib-text);
  box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow-raised); cursor: zoom-in;
  transform-origin: top left; opacity: 0; visibility: hidden; pointer-events: none;
  transform: translateY(-4px) scale(0.96);
  transition: opacity 180ms var(--ease-out), transform 180ms var(--ease-out), visibility 0s linear 180ms;
}
.av-peek[data-side="top"] { transform-origin: bottom left; transform: translateY(4px) scale(0.96); }
.av-peek.is-open {
  opacity: 1; visibility: visible; pointer-events: auto; transform: none;
  transition: opacity 160ms var(--ease-out), transform 220ms var(--ease-out), visibility 0s;
}
.av-pk-media { position: relative; display: grid; place-items: center; height: 192px; overflow: hidden; background: var(--ib-col); }
.av-pk-media[data-doc] { place-items: stretch; background: var(--ib-card); }
.av-pk-img { display: block; width: 100%; height: 100%; object-fit: contain; }
.av-pk-doc, .av-pk-pre {
  margin: 0; padding: 12px 14px; overflow: hidden;
  -webkit-mask-image: linear-gradient(black 62%, transparent); mask-image: linear-gradient(black 62%, transparent);
}
.av-pk-doc { font-size: 11.5px; line-height: 1.5; }
.av-pk-doc.md-doc h1, .av-pk-doc.md-doc h2, .av-pk-doc.md-doc h3 { margin: 0 0 4px; font-size: 13px; }
.av-pk-doc.md-doc pre { padding: 6px 8px; }
.av-pk-pre { font: 11px/1.5 var(--mono); color: var(--ib-text); white-space: pre; tab-size: 2; }
.av-pk-frame { position: absolute; inset: 0; overflow: hidden; background: var(--ib-card); }
.av-pk-frame iframe {
  display: block; width: 1067px; height: 640px; border: 0; transform: scale(0.3); transform-origin: 0 0; pointer-events: none;
}
.av-pk-glyph { display: grid; place-items: center; }
.av-pk-foot {
  display: flex; align-items: baseline; gap: 8px; min-width: 0; padding: 9px 12px 10px;
  border-top: 1px solid var(--ib-card-border);
}
.av-pk-name {
  flex: 1 1 auto; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  font-size: 12.5px; font-weight: 600;
}
.av-pk-meta { flex: none; font-size: 11.5px; color: var(--ib-muted); font-variant-numeric: tabular-nums; }

/* ── viewer (slotted into <ui-dialog>) ───────────────────────────────── */
ui-dialog::part(panel) { height: min(860px, calc(100dvh - 48px)); }
ui-dialog::part(header) { align-items: center; padding-bottom: 12px; border-bottom: 1px solid var(--ib-card-border); }
ui-dialog::part(title) { padding-top: 0; }
ui-dialog::part(body) { display: flex; flex-direction: column; padding: 0; overflow: hidden; }
ui-dialog::part(footer) { justify-content: flex-start; padding: 10px 12px; }
.av-vh { display: flex; align-items: center; gap: 10px; min-width: 0; }
.av-badge {
  display: inline-flex; flex: none; align-items: center; gap: 5px; height: 24px; padding: 0 9px 0 7px;
  border-radius: 999px; background: var(--fc-wash); color: var(--fc-ink); font-size: 11.5px; line-height: 1; font-weight: 600;
}
.av-badge svg { display: block; flex: none; }
.av-vt { display: flex; flex-direction: column; min-width: 0; }
.av-vname {
  display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  font-size: 14.5px; line-height: 1.35; font-weight: 600; color: var(--ib-text);
}
.av-vmeta {
  display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  font-size: 12px; line-height: 1.4; font-weight: 400; color: var(--ib-muted); font-variant-numeric: tabular-nums;
}
.av-live { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.av-stage { position: relative; display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; overflow: hidden; }
.av-stage > slot { display: contents; }
.av-stage ::slotted(*) { flex: 1 1 auto; min-height: 0; overflow: auto; }
.av-body { flex: 1 1 auto; min-height: 0; }
/* image: fit to the panel; a click (or Zoom) shows it 1:1 with scroll */
.av-img { position: relative; overflow: hidden; background: var(--ib-col); }
.av-imgbox { position: absolute; inset: 16px; display: flex; align-items: center; justify-content: center; }
.av-pic {
  display: block; max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 6px;
  box-shadow: var(--ib-shadow); cursor: zoom-in;
}
.av-img.is-zoomed { overflow: auto; overscroll-behavior: contain; }
.av-img.is-zoomed .av-imgbox {
  position: static; display: grid; place-items: center; width: max-content; min-width: 100%; min-height: 100%; padding: 16px;
}
.av-img.is-zoomed .av-pic { max-width: none; max-height: none; cursor: zoom-out; }
/* documents */
.av-doc, .av-text { overflow: auto; overscroll-behavior: contain; }
.av-doc { padding: 24px 32px 40px; }
.av-doc .md-doc { max-width: 760px; margin: 0 auto; font-size: 14px; line-height: 1.6; }
.av-pre {
  margin: 0; padding: 18px 22px 28px; color: var(--ib-text); font: 12.5px/1.6 var(--mono); tab-size: 2;
  white-space: pre-wrap; overflow-wrap: anywhere;
}
/* html: sandboxed (scripts off unless the file vouches), pdf: the browser's viewer; both sit on the column tint */
.av-html, .av-pdf { display: flex; flex-direction: column; background: var(--ib-col); }
.av-pdf .av-frame { margin-top: 16px; }
.av-note {
  display: flex; flex: none; align-items: center; gap: 6px; margin: 0; padding: 8px 16px;
  font-size: 12px; line-height: 16px; color: var(--ib-muted);
}
.av-note svg { display: block; flex: none; }
.av-frame {
  flex: 1 1 auto; min-height: 0; width: calc(100% - 32px); margin: 0 16px 16px; border: 0; border-radius: 8px;
  background: var(--ib-card); box-shadow: 0 0 0 1px var(--ib-card-border);
}
/* media */
.av-media { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 24px; background: var(--ib-col); }
.av-media audio { width: min(480px, 100%); }
.av-vbox { position: absolute; inset: 16px; display: flex; align-items: center; justify-content: center; }
.av-video { display: block; max-width: 100%; max-height: 100%; border-radius: 8px; }
.av-big {
  display: grid; flex: none; place-items: center; width: 64px; height: 64px; border-radius: 16px;
  background: var(--fc-wash); color: var(--fc-ink);
}
.av-big svg { display: block; }
.av-pk-glyph .av-big { width: 56px; height: 56px; border-radius: 14px; }
.av-fname { max-width: 100%; font-size: 15px; line-height: 1.4; font-weight: 600; color: var(--ib-text); overflow-wrap: anywhere; text-align: center; }
/* fallback: a calm card with the actions */
.av-fallback { display: flex; overflow: auto; background: var(--ib-col); }
.av-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px; width: min(420px, calc(100% - 32px));
  margin: auto; padding: 28px 24px 24px; border-radius: 12px; background: var(--ib-card); text-align: center;
  box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow);
}
.av-card .av-big { margin-bottom: 6px; }
.av-fmeta { font-size: 12.5px; line-height: 1.45; color: var(--ib-muted); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.av-fnote { margin-top: 2px; font-size: 12.5px; color: var(--ib-text-2); }
.av-facts { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 14px; }
/* footer: ‹ 3 / 7 ›, then Zoom / Open in new tab / Download */
.av-vf { display: flex; flex: 1 1 auto; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; }
.av-nav { display: flex; align-items: center; gap: 2px; margin-right: auto; }
.av-pos { min-width: 48px; font-size: 12.5px; color: var(--ib-text-2); text-align: center; font-variant-numeric: tabular-nums; }
.av-acts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-left: auto; }
.av-nb, .av-act, .av-tg {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box; height: 32px;
  margin: 0; border-radius: 8px; font: inherit; font-size: 13px; line-height: 1; font-weight: 500;
  text-decoration: none; cursor: pointer; -webkit-tap-highlight-color: transparent;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease,
    transform var(--dur-press) var(--ease-out);
}
.av-nb { width: 32px; padding: 0; border: 0; background: transparent; color: var(--ib-text-2); }
.av-nb:disabled { opacity: 0.4; cursor: default; }
.av-act, .av-tg { padding: 0 12px 0 10px; border: 1px solid var(--ib-card-border); background: var(--ib-card); color: var(--ib-text); }
.av-tg[aria-pressed="true"] {
  border-color: transparent; background: var(--ib-seg-on); box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow);
}
.av-act.is-primary { border-color: transparent; background: var(--ib-text); color: var(--ib-card); }
.av-nb svg, .av-act svg, .av-tg svg { display: block; flex: none; }
.av-nb:focus-visible, .av-act:focus-visible, .av-tg:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
.av-nb:active:not(:focus-visible):not(:disabled), .av-act:active:not(:focus-visible), .av-tg:active:not(:focus-visible) {
  transform: scale(0.97);
}
@media (hover: hover) and (pointer: fine) {
  .av-nb:not(:disabled):hover { background: var(--ib-pill); color: var(--ib-text); }
  .av-act:not(.is-primary):hover, .av-tg:hover { border-color: var(--ib-muted); }
}
@media (pointer: coarse) {
  .av-nb { width: 44px; height: 44px; }
  .av-act, .av-tg { height: 44px; }
}
@media (max-width: 639px) {
  .av-vf .av-act, .av-tg { width: 44px; height: 44px; padding: 0; }
  .av-vf .av-act-t, .av-tg .av-act-t { display: none; }
  /* An extra action without a glyph keeps its words. */
  .av-vf .av-act.is-text { width: auto; padding: 0 12px; }
  .av-vf .av-act.is-text .av-act-t { display: inline; }
  .av-doc { padding: 18px 18px 32px; }
}
@media (prefers-reduced-motion: reduce) {
  .av-peek, .av-peek[data-side="top"] { transform: none !important; }
  .av-peek { transition: opacity 120ms ease, visibility 0s linear 120ms !important; }
  .av-peek.is-open { transition: opacity 120ms ease !important; }
}
`;
