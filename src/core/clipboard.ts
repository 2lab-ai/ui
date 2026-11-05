import { deepActive } from './popover';

/**
 * Copy to the clipboard; without the Clipboard API (plain http) through a hidden textarea in `root`. Focus goes back
 * to where it was — wherever it was on the page, not only inside `root`.
 */
export async function copyText(text: string, root: ShadowRoot): Promise<boolean> {
  try {
    const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    if (clip && typeof clip.writeText === 'function') {
      await clip.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea
  }
  if (typeof document.execCommand !== 'function') return false;
  // The deepest focused element: `root.activeElement` is null when focus is outside this root.
  const prev = deepActive() as HTMLElement | null;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  root.append(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  prev?.focus({ preventScroll: true });
  return ok;
}
