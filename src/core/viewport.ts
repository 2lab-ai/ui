/**
 * The visual viewport — the part of the page actually on screen. On iOS the soft keyboard does not shrink the
 * layout viewport (`100dvh`, `position: fixed; inset: 0`); it shrinks the visual one and may scroll it down. A
 * sheet that sizes itself to the visual viewport keeps its bottom (the submit button, a composer) above the
 * keyboard. Ported from the soma-work dashboard's `ntSyncViewport` / `syncPanelViewport`.
 */

/** Height of the visible area and how far it sits below the layout viewport's top (whole px). */
export interface ViewportBox {
  height: number;
  top: number;
}

/** The box of a visual viewport (rounded; the top never negative), or null when there is none to follow. */
export function readVisualViewport(
  vv: Pick<VisualViewport, 'height' | 'offsetTop'> | null | undefined = typeof window === 'undefined'
    ? null
    : window.visualViewport,
): ViewportBox | null {
  if (!vv) return null;
  const height = Math.round(vv.height);
  const top = Math.round(vv.offsetTop);
  if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(top)) return null;
  return { height, top: Math.max(0, top) };
}

/**
 * The custom properties a box sets: `--ui-vv-h` and `--ui-vv-top` (empty for no box). Styles read them with the
 * layout viewport as the fallback — `var(--ui-vv-h, 100dvh)`, `var(--ui-vv-top, 0px)` — so a host that opts out
 * may also set them itself.
 */
export function viewportVars(box: ViewportBox | null): string {
  return box ? `--ui-vv-h: ${box.height}px; --ui-vv-top: ${box.top}px` : '';
}

/** Write (or, for no box, remove) the two properties on an element's inline style. */
export function applyViewportVars(el: HTMLElement | null | undefined, box: ViewportBox | null): void {
  if (!el) return;
  if (box) {
    el.style.setProperty('--ui-vv-h', `${box.height}px`);
    el.style.setProperty('--ui-vv-top', `${box.top}px`);
  } else {
    el.style.removeProperty('--ui-vv-h');
    el.style.removeProperty('--ui-vv-top');
  }
  // An emptied style attribute goes, so a re-render's markup (no style) matches the live node.
  if (!el.getAttribute('style')) el.removeAttribute('style');
}

/** Two boxes that would set the same values. */
export function sameViewportBox(a: ViewportBox | null, b: ViewportBox | null): boolean {
  return a === b || (!!a && !!b && a.height === b.height && a.top === b.top);
}

/**
 * Follow the visual viewport: `fn` runs now and again whenever it resizes or scrolls to a different box (the
 * keyboard opening or closing, iOS scrolling the page under a focused field). Synchronous, so the sheet moves in
 * the same frame as the viewport. Returns the stop function; without the API `fn` gets null once and that is all.
 */
export function watchVisualViewport(fn: (box: ViewportBox | null) => void): () => void {
  const vv = typeof window === 'undefined' ? null : window.visualViewport;
  let last = readVisualViewport(vv);
  fn(last);
  if (!vv) return () => {};
  const on = () => {
    const box = readVisualViewport(vv);
    if (sameViewportBox(box, last)) return;
    last = box;
    fn(box);
  };
  vv.addEventListener('resize', on);
  vv.addEventListener('scroll', on);
  return () => {
    vv.removeEventListener('resize', on);
    vv.removeEventListener('scroll', on);
  };
}
