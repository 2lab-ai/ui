/**
 * Element facts: what the reader may know about the element under the pointer or pressed — is it a control, is it
 * disabled, does it open a section, is its form invalid, does it send the form — and nothing else: never its text,
 * its value or what the screen shows. Reads across shadow roots through the event's composed path.
 */
import type { MoodFacts, MoodTarget } from './types';

/** What counts as a control someone presses. */
export const MOOD_CONTROL =
  'button, a[href], input:not([type="hidden"]), select, textarea, summary, label, [contenteditable=""], [contenteditable="true"], ' +
  '[role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], ' +
  '[role="checkbox"], [role="switch"], [role="option"], [role="radio"], [role="treeitem"], [role="combobox"], [role="slider"], ' +
  '[tabindex]:not([tabindex="-1"])';
/** Controls that open a section: what someone searching presses one after another. */
const SECTION = 'summary, [aria-expanded], [role="tab"], [role="treeitem"], a[href^="#"]';
const SUBMIT = 'button:not([type]), button[type="submit"], input[type="submit"], input[type="image"]';
const FIELD = 'input:not([type="hidden"]), select, textarea, [contenteditable=""], [contenteditable="true"]';

let nextKey = 0;
const keys = new WeakMap<Element, string>();

/** One stable key per element, for the life of the page. */
export function moodElementKey(el: Element): string {
  let k = keys.get(el);
  if (!k) {
    k = `c${++nextKey}`;
    keys.set(el, k);
  }
  return k;
}

const matches = (el: Element, sel: string): boolean => {
  try {
    return el.matches(sel);
  } catch {
    return false;
  }
};

/** The elements an event went through, innermost first (the event's composed path, else the parent chain). */
export function moodPath(e: Event | null, fallback?: Element | null): Element[] {
  const path = e?.composedPath?.() ?? [];
  const out = path.filter((n): n is Element => typeof Element !== 'undefined' && n instanceof Element);
  if (out.length) return out;
  const chain: Element[] = [];
  let n: Element | null = fallback ?? ((e?.target as Element | null) || null);
  while (n) {
    chain.push(n);
    n = n.parentElement ?? ((n.getRootNode?.() as ShadowRoot | null)?.host as Element | undefined) ?? null;
  }
  return chain;
}

/** Whether a path goes through an element marked `data-mood-ignore` (the host's own help panel, say). */
export function moodIgnored(path: readonly Element[]): boolean {
  return path.some((el) => el.hasAttribute('data-mood-ignore'));
}

function isDisabled(el: Element, path: readonly Element[], from: number): boolean {
  if (matches(el, ':disabled')) return true;
  for (let i = from; i < path.length; i++) if (path[i].getAttribute('aria-disabled') === 'true') return true;
  return false;
}

function isInvalid(el: Element): boolean {
  if (el.getAttribute('aria-invalid') === 'true') return true;
  if (matches(el, FIELD) && matches(el, ':user-invalid')) return true;
  const form = (el as HTMLButtonElement).form ?? el.closest('form');
  if (!form) return false;
  return !!form.querySelector('[aria-invalid="true"]') || (matches(el, SUBMIT) && hasUserInvalid(form));
}

function hasUserInvalid(form: Element): boolean {
  try {
    return !!form.querySelector(':user-invalid');
  } catch {
    return false;
  }
}

/** The facts of the innermost control on a path (or none, over no control). */
export function moodFactsOf(path: readonly Element[]): MoodFacts {
  const i = path.findIndex((el) => matches(el, MOOD_CONTROL));
  if (i < 0) return { control: null, disabled: false, section: false, invalid: false, submit: false, target: null };
  const el = path[i];
  const disabled = isDisabled(el, path, i);
  const invalid = isInvalid(el);
  const target: MoodTarget = {
    tag: el.localName,
    id: el.id || '',
    role: el.getAttribute('role') ?? '',
    disabled,
    invalid,
  };
  return {
    control: moodElementKey(el),
    disabled,
    section: matches(el, SECTION),
    invalid,
    submit: matches(el, SUBMIT),
    target,
  };
}

/** Whether an element takes typing (keys in it count for typing and deleting). */
export function moodIsField(el: Element | null): boolean {
  return !!el && matches(el, FIELD);
}
