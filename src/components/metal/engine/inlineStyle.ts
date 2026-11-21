/**
 * Inline styles the engine puts on the host's own elements (a reflection target's `position` / `isolation`, the
 * cursor while the pointer sprite is up) are saved first — value and `!important` — and put back exactly as they
 * were when the engine lets go. Added in the port.
 */
export interface SavedInline {
  prop: string;
  value: string;
  priority: string;
}

/** Set `prop` inline on `el`, returning what was there before. */
export function setInline(el: HTMLElement, prop: string, value: string): SavedInline {
  const saved = { prop, value: el.style.getPropertyValue(prop), priority: el.style.getPropertyPriority(prop) };
  el.style.setProperty(prop, value);
  return saved;
}

/** Put back what `setInline` replaced (removing the property when there was none). */
export function restoreInline(el: HTMLElement, saved: SavedInline | null): void {
  if (!saved) return;
  if (saved.value) el.style.setProperty(saved.prop, saved.value, saved.priority);
  else el.style.removeProperty(saved.prop);
}
