import { copyText } from '../../core/clipboard';
import { define, UiElement } from '../../core/element';
import { attrs, esc, safeLink } from '../../core/html';
import { morphInto } from '../../core/morph';
import { icon } from '../../icons/icons';
import { styles } from './styles';

/** inline: a pill-height row (label · value · button). block: a box for a command or a snippet, the button in its corner. */
export type CopyFieldView = 'inline' | 'block';
export type CopyFieldLang = 'en' | 'ko';

export interface CopyFieldData {
  /** What gets copied — always the real value, also while a secret is masked. */
  value: string;
  /** What it is ("Permalink", "Signing secret"). Shown before the value (inline) or above it (block). */
  label?: string;
  view?: CopyFieldView;
  /** Mask the value (eight dots, whatever its length) behind a Show toggle. */
  secret?: boolean;
  /** Draw the value as a link (http(s), mailto or a same-site path; anything else draws no link). Not with `secret`. */
  href?: string;
  /** The copy button's name (default “Copy <label>” / “<label> 복사”). */
  copyLabel?: string;
  /** No copying, no Show: the buttons are disabled and the value is muted. */
  disabled?: boolean;
}

/** `ui-copy` detail: the value about to be copied. */
export interface CopyFieldCopyDetail {
  value: string;
}

/** The mask: the same eight dots for any value, so it never tells the length. */
export const COPY_MASK = '••••••••';
/** How long the proof of a copy stays (ms). */
export const COPY_HOLD_MS = 1600;
/** How long a failed copy keeps its words — long enough to read them (ms). */
export const COPY_FAIL_MS = 4000;
/** A URL's last segment longer than this is not kept whole by `copyMiddle`. */
export const COPY_TAIL = 24;

export const COPY_STRINGS = {
  en: {
    value: 'value',
    copy: (what: string) => `Copy ${what}`,
    show: (what: string) => `Show ${what}`,
    copied: 'Copied',
    failed: 'Copy failed — select the text',
    failedShow: 'Copy failed — press Show, then copy',
    failedHost: 'Copy failed',
    hidden: 'Hidden',
    empty: 'No value',
  },
  ko: {
    value: '값',
    copy: (what: string) => `${what} 복사`,
    show: (what: string) => `${what} 보기`,
    copied: '복사됨',
    failed: '복사 실패 — 직접 선택하세요',
    failedShow: '복사 실패 — 보기를 누른 뒤 복사하세요',
    failedHost: '복사 실패',
    hidden: '숨김',
    empty: '값 없음',
  },
};
type Strings = (typeof COPY_STRINGS)['en'];

const URL_START = /^[a-z][a-z\d+.-]*:\/\/[^/?#]*/i;
const words = (v: unknown) => String(v ?? '').trim();

/**
 * The value split for a middle ellipsis: `head` gives way (it ends in “…” when there is no room), `tail` stays
 * whole, and `head + tail` is always the value. A URL keeps its last path segment with the query and hash
 * (`https://ui.2lab.ai/docs/comp…` + `/slide-confirm`); a segment longer than `max` keeps only its last `max / 2`
 * characters. Anything that is not a URL has no tail — it ends in “…”.
 */
export function copyMiddle(text: string, max = COPY_TAIL): { head: string; tail: string } {
  const s = String(text ?? '');
  const origin = URL_START.exec(s)?.[0];
  if (!origin) return { head: s, tail: '' };
  const rest = s.slice(origin.length);
  const q = rest.search(/[?#]/);
  const path = q < 0 ? rest : rest.slice(0, q);
  // `/a/b/` ends in its slash: the segment is `/b/`.
  const cut = path.endsWith('/') ? path.slice(0, -1).lastIndexOf('/') : path.lastIndexOf('/');
  let at = origin.length + Math.max(0, cut);
  const keep = Math.max(1, Math.floor(Number.isFinite(max) ? max : COPY_TAIL));
  if (s.length - at > keep) at = s.length - Math.ceil(keep / 2);
  // Nothing after the host but a slash: nothing worth keeping.
  return s.length - at <= 1 ? { head: s, tail: '' } : { head: s.slice(0, at), tail: s.slice(at) };
}

/** What a secret shows: the mask for any value (never its length), nothing for an empty one. */
export function copyMask(value: unknown): string {
  return words(value) ? COPY_MASK : '';
}

/** The copy button's name: “Copy Permalink” / “퍼머링크 복사”; without a label “Copy value” / “값 복사”. */
export function copyLabel(label: unknown, lang: CopyFieldLang = 'en'): string {
  const s = COPY_STRINGS[lang === 'ko' ? 'ko' : 'en'];
  return s.copy(words(label) || s.value);
}

export function copyView(v: unknown): CopyFieldView {
  return v === 'block' ? 'block' : 'inline';
}

/**
 * `<ui-copy-field>` — a value you will paste somewhere else: shown whole (or masked), copied in one press, with
 * proof that it worked. Inline it is a pill-height row (a URL gives way in the middle, so its last segment stays in
 * view); as a block it is a `<pre>` that scrolls sideways with the button in its corner. The press sends a cancelable
 * `ui-copy { value }`; not prevented, the element copies the value itself (the Clipboard API, then a hidden textarea)
 * and shows the outcome — the icon turns into a check, the edge tints done, the button and a polite live region say
 * Copied, all back to rest after 1.6 s. A copy that fails says so and selects the value for the person — a masked
 * secret stays masked and the words send them to Show (it is never shown for them). A host that
 * copies something else (built on demand) prevents `ui-copy`, writes it itself and calls `confirm(ok)`.
 */
export class UiCopyField extends UiElement<CopyFieldData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return ['value', 'label', 'view', 'secret', 'href', 'copy-label', 'disabled', 'lang'];
  }

  /** The outcome on show: '' at rest. */
  #outcome: '' | 'done' | 'fail' = '';
  /**
   * Why a failed copy failed, for its words: select — the element's own copy, the value is selected for the person;
   * show — the element's own copy of a masked secret (never shown for them: they press Show, then copy);
   * '' — the host's copy (`confirm(false)`).
   */
  #why: '' | 'select' | 'show' = '';
  /** Outcomes said so far: the live text alternates a trailing no-break space, so the same words are said again. */
  #said = 0;
  #timer: ReturnType<typeof setTimeout> | 0 = 0;
  /** A secret the person chose to see (local only; masked again when the value changes). */
  #shown = false;
  /** The value last taken in. */
  #seen: string | undefined;

  constructor() {
    super();
    this.root.addEventListener('click', (e) => {
      const t = e.target as Element | null;
      if (t?.closest?.('.cf-copy')) void this.#run(e);
      else if (t?.closest?.('.cf-eye')) this.#toggle(e);
    });
  }

  override get data(): CopyFieldData | undefined {
    return super.data;
  }

  override set data(value: CopyFieldData | undefined) {
    super.data = value;
    this.#sync();
  }

  attributeChangedCallback(): void {
    this.#sync();
    this.requestRender();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#rest();
    this.#shown = false;
  }

  /** True while the proof of a copy shows. */
  get copied(): boolean {
    return this.#outcome === 'done';
  }

  /** Copy as if the button was pressed (`ui-copy` first). True when the element copied it. No sound: no one pressed. */
  copy(): Promise<boolean> {
    return this.#run();
  }

  /** Show the outcome of a copy the host did itself (it prevented `ui-copy`): `confirm()` / `confirm(false)`. */
  confirm(ok = true): void {
    this.#show(!!ok, false);
  }

  get #lang(): CopyFieldLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  get #value(): string {
    const v = this.data?.value ?? this.getAttribute('value');
    return v === null || v === undefined ? '' : String(v);
  }

  get #label(): string {
    return words(this.data?.label ?? this.getAttribute('label'));
  }

  #flag(v: boolean | undefined, name: string): boolean {
    return v === undefined ? this.hasAttribute(name) : !!v;
  }

  get #disabled(): boolean {
    return this.#flag(this.data?.disabled, 'disabled');
  }

  get #secret(): boolean {
    return this.#flag(this.data?.secret, 'secret');
  }

  /** The value as written — whitespace only is no value. */
  get #has(): boolean {
    return this.#value.trim() !== '';
  }

  /** A new value: masked again, and the proof of the last copy goes (it was another value's). */
  #sync(): void {
    const v = this.#value;
    if (v === this.#seen) return;
    this.#seen = v;
    this.#shown = false;
    this.#rest();
  }

  #rest(): void {
    clearTimeout(this.#timer);
    this.#timer = 0;
    this.#outcome = '';
    this.#why = '';
  }

  async #run(e?: Event): Promise<boolean> {
    const value = this.#value;
    if (!this.#has || this.#disabled) return false;
    if (!this.emit<CopyFieldCopyDetail>('ui-copy', { value })) return false;
    const ok = await copyText(value, this.root);
    // The value changed while it copied: no proof beside a value it is not.
    if (value !== this.#value) return ok;
    this.#show(ok, true);
    if (e) this.sound(ok ? 'success' : 'error', { emphasis: 'subtle' }, e);
    return ok;
  }

  #toggle(e: Event): void {
    if (!this.#secret || !this.#has || this.#disabled) return;
    this.#shown = !this.#shown;
    this.renderNow();
    this.sound('toggle', { direction: this.#shown ? 'forward' : 'back' }, e);
  }

  /**
   * One timer: a new outcome starts it again. `own`: the element's own copy — a failure selects the value, unless
   * it is a masked secret: that is never shown for the person (or put in the selection); the words send them to Show.
   */
  #show(ok: boolean, own: boolean): void {
    if (!this.isConnected) return;
    this.#rest();
    this.#outcome = ok ? 'done' : 'fail';
    this.#why = ok || !own ? '' : this.#secret && !this.#shown ? 'show' : 'select';
    this.#said++;
    this.renderNow();
    if (this.#why === 'select') this.#select();
    this.#timer = setTimeout(
      () => {
        this.#rest();
        this.renderNow();
      },
      ok ? COPY_HOLD_MS : COPY_FAIL_MS,
    );
  }

  /** Select the value, so ⌘C / Ctrl+C copies it. */
  #select(): void {
    const v = this.$('.cf-val');
    try {
      const sel = typeof getSelection === 'function' ? getSelection() : null;
      if (!v || !sel) return;
      const range = document.createRange();
      range.selectNodeContents(v);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch {
      // selection is best effort
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  /** Patched in place: the icons cross-fade on their transitions, focus stays, the live region keeps its node. */
  protected override update(): void {
    morphInto(this.content, this.render());
    this.updated();
  }

  protected render(): string {
    const t = COPY_STRINGS[this.#lang];
    const view = copyView(this.data?.view ?? this.getAttribute('view'));
    const has = this.#has;
    const off = this.#disabled;
    const secret = this.#secret && has;
    const label = this.#label;
    const what = label || t.value;
    const state = this.#outcome;
    const fail = this.#why === 'select' ? t.failed : this.#why === 'show' ? t.failedShow : t.failedHost;
    const said = state === 'done' ? t.copied : state === 'fail' ? fail : '';
    const name = said || words(this.data?.copyLabel ?? this.getAttribute('copy-label')) || t.copy(what);
    const glyph = this.#shown ? 'shield' : 'lock';
    const eye = secret
      ? `<button${attrs({
          type: 'button',
          class: 'cf-eye cf-btn',
          part: 'toggle',
          'data-key': 'reveal',
          'aria-pressed': this.#shown ? 'true' : 'false',
          'aria-label': t.show(what),
          title: t.show(what),
          disabled: off,
        })}><span class="cf-ic" data-mk="${glyph}">${icon(glyph)}</span></button>`
      : '';
    const copy = `<button${attrs({
      type: 'button',
      class: 'cf-copy cf-btn',
      part: 'copy',
      'data-key': 'copy',
      'aria-label': name,
      title: name,
      disabled: off || !has,
    })}><span class="cf-ic is-copy">${icon('copy')}</span><span class="cf-ic is-done">${icon('check', {
      stroke: 1.75,
    })}</span><span class="cf-ic is-fail">${icon('alert')}</span></button>`;
    const tools = `<span class="cf-tools">${eye}${copy}</span>`;
    const head = label ? `<span class="cf-label" part="label">${esc(label)}</span>` : '';
    const value = this.#valueHtml(view, has, secret && !this.#shown, t);
    const box =
      view === 'block'
        ? `${head}<div class="cf-box" part="box"${secret ? ' data-two' : ''}>${value}${tools}</div>`
        : `<div class="cf-box" part="box">${head}${value}${tools}</div>`;
    const field = attrs({
      class: 'cf',
      part: 'field',
      'data-view': view,
      'data-state': state || undefined,
      'data-disabled': off,
      'data-empty': !has,
    });
    const note = state === 'fail' ? `<p class="cf-note" part="note" aria-hidden="true">${esc(fail)}</p>` : '';
    const live = said ? `${said}${this.#said % 2 ? '' : '\u00a0'}` : '';
    return `<div${field}>${box}${note}</div><span class="sr-only" role="status">${esc(live)}</span>`;
  }

  #valueHtml(view: CopyFieldView, has: boolean, masked: boolean, t: Strings): string {
    const tag = view === 'block' ? 'pre' : 'span';
    if (!has || masked) {
      const shown = has ? COPY_MASK : '—';
      return `<${tag} class="cf-val ${has ? 'is-masked' : 'is-empty'}" part="value"><span aria-hidden="true">${shown}</span><span class="sr-only">${esc(
        has ? t.hidden : t.empty,
      )}</span></${tag}>`;
    }
    const value = this.#value;
    const raw = this.#secret ? '' : words(this.data?.href ?? this.getAttribute('href'));
    const link = raw ? safeLink(raw) : '#';
    const linkAttrs = ` href="${link}" target="_blank" rel="noopener noreferrer" data-key="link"`;
    if (view === 'block') {
      const inner = link === '#' ? esc(value) : `<a class="cf-link"${linkAttrs}>${esc(value)}</a>`;
      // A scroller takes focus, so the keyboard can scroll it — unless a link inside already does.
      const focus = link === '#' ? ' tabindex="0" data-key="value"' : '';
      return `<pre class="cf-val" part="value"${focus}>${inner}</pre>`;
    }
    const { head, tail } = copyMiddle(value);
    const inner = `<span class="cf-head">${esc(head)}</span>${tail ? `<span class="cf-tail">${esc(tail)}</span>` : ''}`;
    const title = attrs({ title: value });
    return link === '#'
      ? `<span class="cf-val" part="value"${title}>${inner}</span>`
      : `<a class="cf-val" part="value"${linkAttrs}${title}>${inner}</a>`;
  }
}

define('ui-copy-field', UiCopyField);

declare global {
  interface HTMLElementTagNameMap {
    'ui-copy-field': UiCopyField;
  }
}
