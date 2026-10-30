import { define, UiElement } from '../../core/element';
import { attrs, esc, escAttr } from '../../core/html';
import { morphInto } from '../../core/morph';
import { icon } from '../../icons/icons';
import { styles } from './styles';

/** One quiet hint under the description: plain text, or a label with a command in mono (`Command: /model`). */
export type SettingHint = string | { label?: string; code: string };

/** The save state the host reports for the row. */
export interface SettingRowStatus {
  /** saved: check + “Saved” (role=status) · pending: “Saving…” (role=status) · error: alert + text (role=alert). */
  state: 'saved' | 'error' | 'pending';
  /** Replaces the default word (“Saved”, “Saving…”, “Couldn’t save”). */
  text?: string;
}

/** The row cannot be changed here: the control is hidden, the value shows read-only with the reason. */
export interface SettingRowLock {
  /** Why (“Set by your workspace admin”). */
  reason: string;
  /** The current value as text, shown read-only. */
  value?: string;
}

export interface SettingRowData {
  /** Stable id of the setting, sent back in `ui-reset` and matched by the filter. */
  key?: string;
  label: string;
  description?: string;
  hints?: SettingHint[];
  /** The default value as text — drawn as “Default: {defaultText}”. */
  defaultText?: string;
  /** The value differs from the default: an ink dot before the label (plus “Modified” for screen readers). */
  modified?: boolean;
  /** Offer a quiet “Reset to default” while `modified` (sends `ui-reset`). */
  canReset?: boolean;
  /** A small neutral tag after the label (“Admin”). */
  badge?: string;
  status?: SettingRowStatus | null;
  locked?: SettingRowLock | null;
}

/** `ui-reset` detail. */
export interface SettingResetDetail {
  key: string;
}

const STRINGS = {
  en: {
    modified: 'Modified',
    def: (v: string) => `Default: ${v}`,
    reset: 'Reset to default',
    resetName: (l: string) => `Reset ${l} to default`,
    saved: 'Saved',
    saving: 'Saving…',
    failed: 'Couldn’t save',
    locked: 'Locked',
  },
  ko: {
    modified: '변경됨',
    def: (v: string) => `기본값: ${v}`,
    reset: '기본값으로',
    resetName: (l: string) => `${l} 기본값으로 되돌리기`,
    saved: '저장했습니다',
    saving: '저장 중…',
    failed: '저장하지 못했습니다',
    locked: '잠김',
  },
};
type Strings = (typeof STRINGS)['en'];

/** What a row's control is: the first of these in the slotted content takes the row's name. */
export const LABELABLE =
  'input:not([type="hidden"]), select, textarea, button, [role="switch"], [role="checkbox"], [role="combobox"], [role="slider"], [role="spinbutton"], [role="textbox"], [role="radiogroup"], [role="listbox"]';

/** The first labelable control among `nodes` (each node itself, then its descendants). */
export function firstControl(nodes: readonly Element[]): HTMLElement | null {
  for (const n of nodes) {
    if (n.matches(LABELABLE)) return n as HTMLElement;
    const inner = n.querySelector<HTMLElement>(LABELABLE);
    if (inner) return inner;
  }
  return null;
}

const FIELD = /^(input|select|textarea)$/;

/** Text a screen reader would read from `node`: skips aria-hidden parts and nested form fields. */
function spokenText(node: Node): string {
  if (node.nodeType === 3) return node.nodeValue ?? '';
  if (node.nodeType !== 1) return '';
  const el = node as Element;
  if (el.getAttribute('aria-hidden') === 'true' || FIELD.test(el.localName)) return '';
  let s = '';
  for (const c of Array.from(el.childNodes)) s += spokenText(c);
  return s;
}

/** The `<label>`s of a control: a wrapping label and `label[for=id]` in the same root. */
function labelsOf(el: HTMLElement): Element[] {
  const out: Element[] = [];
  const wrap = el.parentElement?.closest('label');
  if (wrap) out.push(wrap);
  if (el.id) {
    const root = el.getRootNode() as Document | ShadowRoot;
    for (const l of Array.from(root.querySelectorAll?.('label[for]') ?? [])) {
      if ((l as HTMLLabelElement).htmlFor === el.id && !out.includes(l)) out.push(l);
    }
  }
  return out;
}

/**
 * True when the control already has a name a screen reader would read: aria-label / aria-labelledby, a `<label>`
 * with words in it (aria-hidden words do not count), a title, or a button's own text. A placeholder is not a name.
 */
export function hasAccessibleName(el: HTMLElement): boolean {
  const has = (v: string | null | undefined) => !!(v ?? '').trim();
  if (has(el.getAttribute('aria-label')) || has(el.getAttribute('aria-labelledby'))) return true;
  if (labelsOf(el).some((l) => has(spokenText(l)))) return true;
  if (has(el.getAttribute('title'))) return true;
  if (el.localName === 'button' || el.getAttribute('role') === 'button') return has(spokenText(el));
  if (el.localName === 'input' && /^(submit|reset|button)$/i.test(el.getAttribute('type') ?? ''))
    return has((el as HTMLInputElement).value);
  return false;
}

/** The attributes this row put on a slotted control (null: it did not set that one). */
interface Wired {
  el: HTMLElement;
  label: string | null;
  desc: string | null;
}

/**
 * `<ui-setting-row>` — one preference: label, description, quiet hints (default value, a command), the control the
 * host slots in, and what happened when it was saved (saved · saving · error). A locked row hides the control and
 * shows the value read-only with the reason. The first slotted control without a name of its own is named after
 * the row (aria-label, aria-description), and what the row added is taken off again when it changes or leaves.
 */
export class UiSettingRow extends UiElement<SettingRowData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang'];
  }

  #painted = false;
  #wired: Wired | null = null;

  constructor() {
    super();
    this.root.addEventListener('click', (e) => this.#onClick(e));
    this.root.addEventListener('slotchange', () => this.#wire());
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unwire();
  }

  get #t(): Strings {
    return (this.getAttribute('lang') ?? '').toLowerCase().startsWith('ko') ? STRINGS.ko : STRINGS.en;
  }

  /** The control the row names (or would name): the first labelable element in the default slot. */
  get control(): HTMLElement | null {
    return firstControl(Array.from(this.children).filter((c) => !c.hasAttribute('slot')));
  }

  protected override update(): void {
    const hadReset = this.#resetFocused();
    morphInto(this.content, this.render());
    this.updated();
    // The reset link goes once the host clears `modified`: focus moves on to the control, not to the page.
    if (hadReset && !this.$('.sr-reset')) this.control?.focus({ preventScroll: true });
  }

  #resetFocused(): boolean {
    try {
      return this.root.activeElement?.classList.contains('sr-reset') ?? false;
    } catch {
      return false;
    }
  }

  protected render(): string {
    const d = this.data;
    if (!d) return '';
    const t = this.#t;
    const locked = d.locked && typeof d.locked === 'object' ? d.locked : null;
    const hints: string[] = [];
    for (const h of Array.isArray(d.hints) ? d.hints : []) {
      if (typeof h === 'string') {
        if (h.trim()) hints.push(`<span class="sr-hint">${esc(h)}</span>`);
      } else if (h && typeof h === 'object' && String(h.code ?? '')) {
        const lead = h.label ? `${esc(h.label)} ` : '';
        hints.push(`<span class="sr-hint">${lead}<code>${esc(h.code)}</code></span>`);
      }
    }
    if (d.defaultText != null && String(d.defaultText) !== '')
      hints.push(`<span class="sr-hint sr-default">${esc(t.def(String(d.defaultText)))}</span>`);
    if (d.canReset && d.modified && !locked)
      hints.push(
        `<button${attrs({ type: 'button', class: 'sr-reset', 'aria-label': t.resetName(d.label ?? '') })}>${esc(t.reset)}</button>`,
      );
    const head = `<div class="sr-head" id="sr-label" part="label">${
      d.modified ? `<span class="sr-dot" aria-hidden="true" title="${escAttr(t.modified)}"></span>` : ''
    }<span class="sr-name">${esc(d.label)}</span>${d.badge ? `<span class="sr-badge">${esc(d.badge)}</span>` : ''}${
      d.modified ? `<span class="sr-only">(${esc(t.modified)})</span>` : ''
    }</div>`;
    const meta = `<div class="sr-meta" part="meta">${head}${
      d.description ? `<p class="sr-desc" part="description">${esc(d.description)}</p>` : ''
    }${hints.length ? `<div class="sr-hints" part="hints">${hints.join('')}</div>` : ''}</div>`;
    const control = locked
      ? `<div class="sr-locked" part="locked"><div class="sr-lockline">${icon('lock', { size: 14, class: 'sr-lock' })}<span class="sr-only">${esc(
          t.locked,
        )}: </span>${locked.value != null && String(locked.value) !== '' ? `<span class="sr-value">${esc(locked.value)}</span>` : ''}</div>${
          locked.reason ? `<p class="sr-reason">${esc(locked.reason)}</p>` : ''
        }</div>`
      : '<div class="sr-slot" part="slot"><slot></slot></div>';
    const st = d.status && typeof d.status === 'object' ? d.status : null;
    const polite = st && (st.state === 'saved' || st.state === 'pending') ? this.#msg(st, t) : '';
    const alert = st?.state === 'error' ? this.#msg(st, t) : '';
    return `<div${attrs({
      class: 'sr',
      part: 'row',
      'data-modified': !!d.modified,
      'data-locked': !!locked,
      'data-anim': this.#painted,
    })}>${meta}<div class="sr-control" part="control">${control}<div class="sr-live" role="status" aria-live="polite" part="status">${polite}</div><div class="sr-live" role="alert" part="error">${alert}</div></div></div>`;
  }

  /** A status message. A new state or text is a new node (data-mk), so it rises in once; the same one stays put. */
  #msg(st: SettingRowStatus, t: Strings): string {
    const text = st.text ?? (st.state === 'saved' ? t.saved : st.state === 'pending' ? t.saving : t.failed);
    const glyph =
      st.state === 'saved'
        ? icon('check', { size: 12 })
        : st.state === 'error'
          ? icon('alert', { size: 12 })
          : '<span class="sr-spin" aria-hidden="true"></span>';
    return `<span class="sr-msg" data-state="${escAttr(st.state)}" data-mk="${escAttr(`${st.state}|${text}`)}">${glyph}<span>${esc(text)}</span></span>`;
  }

  protected override updated(): void {
    this.#painted = true;
    this.#wire();
  }

  #onClick(e: Event): void {
    if (!(e.target as Element | null)?.closest?.('.sr-reset')) return;
    const detail: SettingResetDetail = { key: this.data?.key ?? '' };
    if (this.emit('ui-reset', detail)) this.sound('tap', { emphasis: 'subtle' }, e);
  }

  /** Name the first slotted control after the row when it has no name of its own. */
  #wire(): void {
    // Our own attributes are not the control's name: take them off before asking whether it has one.
    this.#unwire();
    const d = this.data;
    if (!this.isConnected || !d || d.locked || !String(d.label ?? '').trim()) return;
    const el = this.control;
    if (!el || hasAccessibleName(el)) return;
    const w: Wired = { el, label: String(d.label), desc: null };
    el.setAttribute('aria-label', w.label as string);
    const desc = String(d.description ?? '').trim();
    if (desc && !el.hasAttribute('aria-description') && !el.hasAttribute('aria-describedby')) {
      w.desc = desc;
      el.setAttribute('aria-description', desc);
    }
    this.#wired = w;
  }

  /** Take off what this row added — only while it is still what the row set (the host may have replaced it). */
  #unwire(): void {
    const w = this.#wired;
    this.#wired = null;
    if (!w) return;
    if (w.label !== null && w.el.getAttribute('aria-label') === w.label) w.el.removeAttribute('aria-label');
    if (w.desc !== null && w.el.getAttribute('aria-description') === w.desc) w.el.removeAttribute('aria-description');
  }
}

define('ui-setting-row', UiSettingRow);

declare global {
  interface HTMLElementTagNameMap {
    'ui-setting-row': UiSettingRow;
  }
}
