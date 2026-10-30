import { define, UiElement } from '../../core/element';
import { attrs, cls, esc } from '../../core/html';
import { morphInto } from '../../core/morph';
import { type IconName, icon } from '../../icons/icons';
import { styles } from './styles';

/** One choice in the control. */
export interface SegmentedOption {
  /** What `ui-change` carries back. Unique within the control. */
  value: string;
  /** Visible label — and the accessible name when `iconOnly`. */
  label: string;
  /** A glyph from `@2lab.ai/ui/icons` drawn before the label. */
  icon?: IconName;
  /** Draw only the icon; the label becomes the accessible name and tooltip. */
  iconOnly?: boolean;
  disabled?: boolean;
  /** Tooltip (defaults to the label for icon-only options). */
  title?: string;
}

export interface SegmentedData {
  options: SegmentedOption[];
  /** The checked option's value. None checked when missing or unknown. */
  value?: string;
  /** Accessible name of the group ("Period", "View"). */
  label?: string;
  /** `true` = read-only; a string = read-only with that reason as the tooltip. */
  disabled?: boolean | string;
}

/** `ui-change` detail. */
export interface SegmentedChange {
  value: string;
  previous: string | undefined;
}

/** The options worth drawing: a string value, a label, first of each value. */
export function segmentedOptions(d: SegmentedData | undefined): SegmentedOption[] {
  const seen = new Set<string>();
  const out: SegmentedOption[] = [];
  for (const o of Array.isArray(d?.options) ? d.options : []) {
    if (!o || typeof o.value !== 'string' || seen.has(o.value)) continue;
    seen.add(o.value);
    out.push(o);
  }
  return out;
}

/**
 * Next enabled index from `from` in direction `dir` (wrapping); `dir` 0 = first enabled at or after `from`.
 * -1 when nothing is enabled.
 */
export function rovingIndex(disabled: boolean[], from: number, dir: -1 | 0 | 1): number {
  const n = disabled.length;
  if (!n) return -1;
  const step = dir === 0 ? 1 : dir;
  let i = dir === 0 ? from : from + dir;
  for (let k = 0; k < n; k++, i += step) {
    const j = ((i % n) + n) % n;
    if (!disabled[j]) return j;
  }
  return -1;
}

/**
 * `<ui-segmented>` — a single choice among a few (period, view, mode) as a radio group: one raised neutral chip
 * marks the choice and slides to the next one; arrows move and choose (roving tabindex). Choosing sends a
 * cancelable `ui-change`; when no listener cancels it the control shows the new value right away.
 */
export class UiSegmented extends UiElement<SegmentedData> {
  static override styles = [styles];

  /** The checked value. */
  get value(): string | undefined {
    return this.data?.value;
  }

  constructor() {
    super();
    this.root.addEventListener('click', (e) => this.#onClick(e));
    this.root.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
  }

  #off(): boolean {
    return !!this.data?.disabled;
  }

  protected override update(): void {
    morphInto(this.content, this.render());
    this.updated();
  }

  protected render(): string {
    const d = this.data;
    const opts = segmentedOptions(d);
    if (!opts.length) return '';
    const cur = opts.findIndex((o) => o.value === d?.value);
    const off = this.#off();
    const disabled = opts.map((o) => off || !!o.disabled);
    // The tab stop: the checked option, else the first enabled one (a disabled group keeps one stop to explain why).
    const stop = cur >= 0 ? cur : Math.max(0, rovingIndex(disabled, 0, 0));
    const reason = typeof d?.disabled === 'string' ? d.disabled : undefined;
    const buttons = opts
      .map((o, i) => {
        const only = !!o.iconOnly && !!o.icon;
        const glyph = o.icon ? icon(o.icon) : '';
        const title = reason ?? o.title ?? (only ? o.label : undefined);
        return `<button${attrs({
          type: 'button',
          class: cls('sg-opt', only && 'is-icon'),
          role: 'radio',
          'aria-checked': String(i === cur),
          'aria-disabled': disabled[i] ? 'true' : undefined,
          'aria-label': only ? o.label : undefined,
          title,
          tabindex: i === stop ? '0' : '-1',
          'data-key': o.value,
          'data-i': i,
        })}>${glyph}${only ? '' : `<span class="sg-label">${esc(o.label)}</span>`}</button>`;
      })
      .join('');
    return `<div${attrs({
      class: 'sg',
      role: 'radiogroup',
      part: 'group',
      'aria-label': d?.label,
      'aria-disabled': off ? 'true' : undefined,
      'data-none': cur < 0,
      style: `--n: ${opts.length}; --i: ${Math.max(cur, 0)}`,
    })}><span class="sg-thumb" part="thumb" aria-hidden="true"></span>${buttons}</div>`;
  }

  #buttons(): HTMLElement[] {
    return this.$$<HTMLElement>('.sg-opt');
  }

  /** Check option `i` (by index into the drawn options); `focus` moves focus there first (keyboard). */
  #choose(i: number, focus: boolean): void {
    const d = this.data;
    const opts = segmentedOptions(d);
    const o = opts[i];
    if (!d || !o) return;
    if (focus) {
      const b = this.#buttons()[i];
      // Roving: the stop follows focus even when the choice is refused.
      for (const x of this.#buttons()) x.setAttribute('tabindex', x === b ? '0' : '-1');
      b?.focus();
    }
    if (this.#off() || o.disabled || o.value === d.value) return;
    const detail: SegmentedChange = { value: o.value, previous: d.value };
    // Optimistic on top of the LATEST data: a listener that set a value of its own wins.
    if (this.emit('ui-change', detail) && this.data && this.data.value === d.value)
      this.data = { ...this.data, value: o.value };
  }

  #onClick(e: Event): void {
    const b = (e.target as Element | null)?.closest?.<HTMLElement>('.sg-opt');
    if (!b) return;
    this.#choose(Number(b.dataset.i), false);
  }

  #onKey(e: KeyboardEvent): void {
    const b = (e.target as Element | null)?.closest?.<HTMLElement>('.sg-opt');
    if (!b) return;
    const opts = segmentedOptions(this.data);
    const disabled = opts.map((o) => !!o.disabled);
    const at = Number(b.dataset.i);
    const rtl = getComputedStyle(this).direction === 'rtl';
    let next = -1;
    switch (e.key) {
      case 'ArrowRight':
        next = rovingIndex(disabled, at, rtl ? -1 : 1);
        break;
      case 'ArrowDown':
        next = rovingIndex(disabled, at, 1);
        break;
      case 'ArrowLeft':
        next = rovingIndex(disabled, at, rtl ? 1 : -1);
        break;
      case 'ArrowUp':
        next = rovingIndex(disabled, at, -1);
        break;
      case 'Home':
        next = rovingIndex(disabled, 0, 0);
        break;
      case 'End':
        next = rovingIndex(disabled.slice().reverse(), 0, 0);
        if (next >= 0) next = disabled.length - 1 - next;
        break;
      default:
        return;
    }
    e.preventDefault();
    if (next >= 0) this.#choose(next, true);
  }
}

define('ui-segmented', UiSegmented);

declare global {
  interface HTMLElementTagNameMap {
    'ui-segmented': UiSegmented;
  }
}
