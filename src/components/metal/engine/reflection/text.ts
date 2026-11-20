/* Ported from metal-fx 2.0.11 `src/useMetalTextReflection.ts` (MIT, © Jakub Antalik — https://libraries.dev/metal).
   Changed in the port: a plain function that returns its cleanup instead of a React hook. */
import { textMaskDataUrl } from '../textMask';

/**
 * Confine a proximity reflection to an element's glyphs.
 *
 * The engine paints reflections into a wrapper it inserts inside the target (`[data-metal-fx-reflection]`, canvases
 * inset:0). For a text node that would light the whole line box and stroke its rectangle. This masks the wrapper with
 * the text rendered white-on-transparent, so only the letterforms catch the light. Re-rendered on resize and once fonts
 * load. Returns the cleanup.
 */
export function metalTextReflection(el: HTMLElement): () => void {
  // Tells the engine to light this as letterforms, not as a chip: mirrored metal only, no rim stroke / border highlight.
  el.setAttribute('data-metal-fx-text', '');
  let raf = 0;
  let disposed = false;
  let tries = 0;

  const apply = () => {
    raf = 0;
    if (disposed) return;
    const wrap = el.querySelector<HTMLElement>(':scope > [data-metal-fx-reflection]');
    // The engine attaches the wrapper after mount (and only in a dark theme) — wait a few seconds for it, then give
    // up quietly.
    if (!wrap) {
      if (tries++ < 300 && typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(apply);
      return;
    }
    tries = 0;
    const url = textMaskDataUrl(el, el);
    if (!url) return;
    const v = `url("${url}")`;
    const st = wrap.style as CSSStyleDeclaration & {
      webkitMaskImage?: string;
      webkitMaskRepeat?: string;
      webkitMaskSize?: string;
    };
    st.maskImage = v;
    st.webkitMaskImage = v;
    st.maskRepeat = 'no-repeat';
    st.webkitMaskRepeat = 'no-repeat';
    st.maskSize = '100% 100%';
    st.webkitMaskSize = '100% 100%';
    // A mirror *replaces* what's under it. Additive blending on light-grey text pushed everything to white and erased
    // the metal's stripes and dispersion fringes; normal compositing keeps them.
    st.mixBlendMode = 'normal';
  };

  apply();
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => apply()) : null;
  ro?.observe(el);
  document.fonts?.ready.then(() => apply()).catch(() => {});
  // The engine tears down and re-inserts the wrapper whenever the owning element's reflection re-runs — every new
  // wrapper needs the mask.
  const mo =
    typeof MutationObserver === 'function'
      ? new MutationObserver((recs) => {
          for (const r of recs) {
            for (const n of Array.from(r.addedNodes)) {
              if (n instanceof HTMLElement && n.hasAttribute('data-metal-fx-reflection')) {
                apply();
                return;
              }
            }
          }
        })
      : null;
  mo?.observe(el, { childList: true });

  return () => {
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    ro?.disconnect();
    mo?.disconnect();
    el.removeAttribute('data-metal-fx-text');
  };
}
