import { FILE_KINDS } from '../../core/files';
import { FILE_TINTS } from './render';

/**
 * Kind tints for any element carrying `data-kind` (cards, the viewer's badge, the peek): `--fc-tint` is the token,
 * `--fc-wash` the soft 14% background, `--fc-ink` the glyph colour (70% toward ink, readable in both themes).
 */
export const fileKindCss = `${FILE_KINDS.map((k) => `[data-kind="${k}"] { --fc-tint: ${FILE_TINTS[k]}; }`).join('\n')}
[data-kind] {
  --fc-wash: color-mix(in srgb, var(--fc-tint) 14%, var(--ib-card));
  --fc-ink: color-mix(in srgb, var(--fc-tint) 70%, var(--ib-text));
}
`;

/**
 * The file card (`fileCardHtml` markup): tile, row and chip. Calm surfaces — the only colour is the kind's wash
 * behind its glyph. Hover changes the border only (fine pointers), a press settles to .97, nothing lifts.
 * `--fc-tile-w` sets a tile's width (default 148px; a grid sets 100%).
 */
export const fileCardStyles = `${fileKindCss}
.fc {
  position: relative; display: flex; box-sizing: border-box; min-width: 0; max-width: 100%; margin: 0; padding: 0;
  border: 1px solid var(--ib-card-border); background: var(--ib-card); color: var(--ib-text);
  font: inherit; text-align: left; cursor: pointer; -webkit-tap-highlight-color: transparent;
  transition: border-color 150ms ease, background-color 150ms ease, transform var(--dur-press) var(--ease-out);
}
.fc:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
.fc:active:not(:focus-visible) { transform: scale(0.97); }
.fc svg { display: block; flex: none; }
.fc-name { min-width: 0; overflow-wrap: anywhere; }
.fc-meta, .fc-sub {
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--ib-muted);
  font-variant-numeric: tabular-nums;
}
.fc-glyph, .fc-box, .fc-thumb { color: var(--fc-ink); }

/* Tile: an inset thumbnail (image, or the glyph on its wash with the extension), then name and meta. */
.fc-tile {
  flex-direction: column; align-items: stretch; width: var(--fc-tile-w, 148px); padding: 4px;
  border-radius: 12px; box-shadow: var(--ib-shadow);
}
.fc-thumb {
  position: relative; display: grid; place-items: center; aspect-ratio: 16 / 10; overflow: hidden;
  border-radius: 8px; background: var(--fc-wash);
}
.fc-thumb.has-img { background: var(--ib-col); }
.fc-thumb img { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: cover; }
.fc-thumb svg { width: 26px; height: 26px; }
.fc-ext {
  position: absolute; left: 6px; bottom: 6px; padding: 0 5px; border-radius: 4px; background: var(--ib-card);
  color: var(--ib-text-2); font-size: 11px; line-height: 16px; font-weight: 600; letter-spacing: 0.06em;
}
.fc-tile .fc-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; padding: 7px 6px 4px; }
.fc-tile .fc-name {
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
  font-size: 12.5px; line-height: 1.35; font-weight: 500;
}
.fc-tile .fc-meta, .fc-tile .fc-sub { font-size: 11.5px; line-height: 1.4; }

/* Row: a glyph tile (or the image itself), name and meta on one line each. */
.fc-row { align-items: center; gap: 10px; width: 100%; min-height: 52px; padding: 7px 12px 7px 7px; border-radius: 10px; }
.fc-box {
  display: grid; flex: none; place-items: center; width: 36px; height: 36px; overflow: hidden;
  border-radius: 8px; background: var(--fc-wash);
}
.fc-box.has-img { background: var(--ib-col); }
.fc-box img { display: block; width: 100%; height: 100%; object-fit: cover; }
.fc-box svg { width: 18px; height: 18px; }
.fc-row .fc-text { display: flex; flex: 1 1 auto; flex-direction: column; min-width: 0; }
.fc-row .fc-name {
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 13px; line-height: 1.4; font-weight: 500;
}
.fc-row .fc-meta { font-size: 12px; line-height: 1.4; }

/* Chip: a pill with the glyph and the name. */
.fc-chip {
  align-items: center; gap: 6px; height: 28px; max-width: 220px; padding: 0 11px 0 9px; border-radius: 999px;
  font-size: 12.5px; line-height: 1; font-weight: 500;
}
.fc-chip .fc-glyph svg { width: 14px; height: 14px; }
.fc-chip .fc-name { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }

@media (hover: hover) and (pointer: fine) {
  .fc:hover { border-color: var(--ib-muted); }
}
@media (pointer: coarse) {
  .fc-chip { height: 44px; padding: 0 14px 0 12px; }
  .fc-row { min-height: 56px; }
}
`;

/**
 * `<ui-file-card>`'s own sheet: the host box, the card, and the in-place play toggle (`playable`): over a tile's
 * thumbnail (bottom right, with a progress line along its foot and the video itself), at a row's end, after a chip.
 * The toggle is 32px drawn, 44px to the touch; playing it turns ink.
 */
export const styles = `
:host { display: inline-block; max-width: 100%; vertical-align: top; }
:host([variant="row"]) { display: block; }
.ui-root { position: relative; display: flex; align-items: center; gap: 6px; min-width: 0; }
${fileCardStyles}
audio.fc-media { display: none; }
.fc-play {
  position: relative; display: inline-grid; flex: none; place-items: center; box-sizing: border-box;
  width: 32px; height: 32px; margin: 0; padding: 0; border: 1px solid var(--ib-card-border); border-radius: 999px;
  background: var(--ib-card); color: var(--ib-text); box-shadow: var(--ib-shadow); font: inherit; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, transform var(--dur-press) var(--ease-out);
}
.fc-play::before { content: ""; position: absolute; inset: -6px; border-radius: inherit; }
.fc-play svg { display: block; width: 14px; height: 14px; }
.fc-play[data-on] { border-color: transparent; background: var(--ib-text); color: var(--ib-card); }
.fc-play:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
.fc-play:active:not(:focus-visible) { transform: scale(0.97); }
@media (hover: hover) and (pointer: fine) {
  .fc-play:not([data-on]):hover { border-color: var(--ib-muted); }
}

/* Tile: the thumbnail's box (inside the card's 1px border and 4px padding); only the toggle takes the pointer. */
.fc-over {
  position: absolute; top: 5px; left: 5px; width: calc(100% - 10px); aspect-ratio: 16 / 10; overflow: hidden;
  border-radius: 8px; pointer-events: none;
}
.fc-over .fc-play { position: absolute; right: 6px; bottom: 7px; pointer-events: auto; }
.fc-over video.fc-media {
  position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: cover;
  background: var(--ib-col); opacity: 0; transition: opacity 150ms ease;
}
.fc-over.has-video video.fc-media { opacity: 1; }
.fc-prog {
  position: absolute; right: 0; bottom: 0; left: 0; height: 3px; opacity: 0;
  background: color-mix(in srgb, var(--ib-text) 14%, transparent); transition: opacity 150ms ease;
}
.fc-over.is-live .fc-prog { opacity: 1; }
.fc-bar { display: block; height: 100%; background: var(--ib-text); transform-origin: 0 50%; transition: transform 250ms linear; }

/* Row: at the end, the name keeps clear of it. */
.fc-row.has-play { padding-right: 52px; }
:host([variant="row"]) .fc-play { position: absolute; top: 50%; right: 10px; margin-top: -16px; }
`;
