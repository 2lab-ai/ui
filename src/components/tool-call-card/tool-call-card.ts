import { define, UiElement } from '../../core/element';
import { esc, escAttr } from '../../core/html';
import {
  formatToolClock,
  formatToolMs,
  highlightJson,
  lineCount,
  TOOL_ICONS,
  type ToolCallData,
  type ToolCallStatus,
  type ToolIcon,
  toCodeText,
  toolIcon,
} from './logic';
import { type ToolCallLang, type ToolCallStrings, toolCallStrings } from './strings';
import { styles } from './styles';

/** Which code block an event is about. */
export type ToolCallPart = 'args' | 'result';
export interface ToolCallToggleDetail {
  open: boolean;
  /** `data.id` when set. */
  id?: string;
}
export interface ToolCallCopyDetail {
  part: ToolCallPart;
  text: string;
  id?: string;
}
export interface ToolCallActionDetail {
  id?: string;
}

const COPIED_MS = 1400;
const TICK_MS = 100;
const DEFAULT_CAP = 220;
/** Cap estimate when the block cannot be measured (no layout yet): 12px × 1.6 per line + 2 × 10px padding. */
const LINE_PX = 19.2;
const CODE_PAD = 20;

export const SPIN_SVG =
  '<svg class="tc-spin" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.8"/><path d="M8 2.2a5.8 5.8 0 0 1 5.8 5.8"/></svg>';
const OK_SVG =
  '<svg class="tc-ok" viewBox="0 0 16 16" aria-hidden="true"><path d="m3.6 8.5 3 2.9 5.8-6.4" pathLength="1"/></svg>';
const ERR_SVG =
  '<svg class="tc-err" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.1"/><path d="M8 4.9v3.6M8 11v.1"/></svg>';
const STOP_SVG =
  '<svg class="tc-stop" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.1"/><path d="M5.4 8h5.2"/></svg>';
export const CHEV_SVG =
  '<svg class="tc-chev" viewBox="0 0 16 16" aria-hidden="true"><path d="m4.4 6.2 3.6 3.6 3.6-3.6"/></svg>';
const COPY_SVG =
  '<svg class="tc-copy-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="5.4" y="5.4" width="8.1" height="8.1" rx="1.9"/><path d="M10.6 5.4V4.3a1.6 1.6 0 0 0-1.6-1.6H4.3a1.6 1.6 0 0 0-1.6 1.6V9a1.6 1.6 0 0 0 1.6 1.6h1.1"/></svg>';
const DONE_SVG =
  '<svg class="tc-copy-done" viewBox="0 0 16 16" aria-hidden="true"><path d="m3.6 8.5 3 2.9 5.8-6.4"/></svg>';
const RETRY_SVG =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.8 8a5.2 5.2 0 1 0 1.5-3.7"/><path d="M2.6 2.4v2.9h2.9"/></svg>';

const STATUSES: ReadonlySet<string> = new Set(['running', 'success', 'error', 'interrupted']);

/** A status the card knows; anything else reads as `interrupted` (neutral, no timer). */
export function normStatus(s: unknown): ToolCallStatus {
  return STATUSES.has(s as string) ? (s as ToolCallStatus) : 'interrupted';
}

/** The tile glyph for a call: its `icon` when it names one, else `toolIcon(name)`. */
export function callIconSvg(d: Pick<ToolCallData, 'name' | 'icon'>): string {
  const key: ToolIcon = d.icon && Object.hasOwn(TOOL_ICONS, d.icon) ? d.icon : toolIcon(d.name);
  return TOOL_ICONS[key];
}

const finite = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

interface Code {
  value: unknown;
  text: string;
  json: boolean;
  lines: number;
  /** The whole block as HTML — built the first time it is shown in full. */
  html?: string;
  /** The first `keep` lines as HTML, for a block that is capped anyway. */
  head?: { keep: number; html: string };
}

/** Index of the n-th line break (the end of line n), or the text length when there are fewer lines. */
function cutAfterLines(text: string, n: number): number {
  let i = -1;
  for (let k = 0; k < n; k++) {
    i = text.indexOf('\n', i + 1);
    if (i === -1) return text.length;
  }
  return i;
}

/**
 * `<ui-tool-call-card>` — one tool call of an agent: icon, name, summary and status (spinner with a live timer, a
 * drawn check with the duration, Failed, or No result) on one line; open it for the arguments and the result as
 * highlighted JSON with copy buttons, long blocks capped with Show all, errors with Retry.
 */
export class UiToolCallCard extends UiElement<ToolCallData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang'];
  }

  #open = false;
  #auto = false;
  #shownOpen = false;
  #rendered = false;
  #status: ToolCallStatus | undefined;
  #statusIn = false;
  #runStart = 0;
  #measured: number | undefined;
  #tick = 0;
  #full = new Set<ToolCallPart>();
  #copied = new Set<ToolCallPart>();
  #copyTimers = new Map<ToolCallPart, number>();
  #code = new Map<ToolCallPart, Code>();
  #ro: ResizeObserver | undefined;
  #saidStatus: ToolCallStatus | undefined;
  readonly #live: HTMLElement;

  constructor() {
    super();
    // Outside the re-rendered markup, so a render never re-creates (or re-reads) the live region.
    this.#live = document.createElement('span');
    this.#live.className = 'sr-only';
    this.#live.setAttribute('role', 'status');
    this.#live.setAttribute('aria-live', 'polite');
    this.root.append(this.#live);
    this.root.addEventListener('click', (e) => this.#click(e));
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override disconnectedCallback(): void {
    this.#stopTick();
    this.#ro?.disconnect();
  }

  /** Focus the header button (the card's one tab stop). */
  override focus(options?: FocusOptions): void {
    if (!this.$('.tc-head') && this.data && this.isConnected) this.renderNow();
    const head = this.$<HTMLButtonElement>('.tc-head');
    if (head) head.focus(options);
    else super.focus(options);
  }

  /** Whether the body is open now (controlled `data.open`, else the element's own state). */
  get isOpen(): boolean {
    return this.data ? this.#isOpen(this.data) : false;
  }

  get #lang(): ToolCallLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  get #t(): ToolCallStrings {
    return toolCallStrings(this.#lang);
  }

  #isOpen(d: ToolCallData): boolean {
    return d.open ?? this.#open;
  }

  #startOf(d: ToolCallData): number {
    return finite(d.startedAt) ?? this.#runStart;
  }

  #liveMs(d: ToolCallData): number {
    return Math.max(0, Date.now() - this.#startOf(d));
  }

  /** Status transitions: first-render defaults, measured time, open-on-error. */
  #sync(d: ToolCallData, st: ToolCallStatus): void {
    const prev = this.#status;
    this.#statusIn = false;
    if (prev === undefined) {
      this.#open = !!d.defaultOpen;
      if (st === 'running') this.#runStart = Date.now();
    } else if (st !== prev) {
      this.#statusIn = true;
      if (prev === 'running') {
        this.#measured = this.#liveMs(d);
        this.#stopTick();
      }
      if (st === 'running') {
        this.#runStart = Date.now();
        this.#measured = undefined;
      }
      if (d.open === undefined && d.openOnError !== false) {
        if (st === 'error' && !this.#open) {
          this.#open = true;
          this.#auto = true;
        } else if (prev === 'error' && this.#auto) {
          this.#open = false;
          this.#auto = false;
        }
      }
    }
    this.#status = st;
  }

  protected render(): string {
    const d = this.data;
    if (!d) return '';
    const st = normStatus(d.status);
    this.#sync(d, st);
    const t = this.#t;
    const open = this.#isOpen(d);
    if (!this.#rendered) {
      this.#rendered = true;
      this.#shownOpen = open;
    }
    // Markup carries the state on screen now; updated() moves it to `open` after a layout, so the change animates.
    const shown = this.#shownOpen;
    const summary = d.summary === undefined || d.summary === null ? '' : String(d.summary);
    const head = `<button type="button" class="tc-head" data-act="toggle" data-key="head" aria-expanded="${shown}" aria-controls="tc-body"${
      d.focusable === false ? ' tabindex="-1"' : ''
    }><span class="tc-icon" aria-hidden="true">${callIconSvg(d)}</span><span class="tc-main"><code class="tc-name">${esc(
      d.name,
    )}</code>${summary ? `<span class="tc-summary" title="${escAttr(summary)}">${esc(summary)}</span>` : ''}</span>${this.#statusHtml(
      d,
      st,
      t,
    )}${CHEV_SVG}</button>`;
    // A closed card keeps no body markup: a 256 KiB result costs nothing until it is opened.
    const sections = open || shown ? `<div class="tc-sections">${this.#bodyHtml(d, st, t)}</div>` : '';
    return `<div class="tc" data-status="${st}"${shown ? ' data-open' : ''}>${head}<div class="tc-body" id="tc-body"${
      shown ? ' data-open' : ' inert'
    }><div class="tc-clip">${sections}</div></div></div>`;
  }

  #statusHtml(d: ToolCallData, st: ToolCallStatus, t: ToolCallStrings): string {
    const cls = `tc-status${this.#statusIn ? ' is-in' : ''}`;
    if (st === 'running')
      return `<span class="${cls}">${SPIN_SVG}<span class="sr-only">${esc(t.running)}, </span><span class="tc-time">${esc(
        formatToolMs(this.#liveMs(d), true),
      )}</span></span>`;
    if (st === 'success') {
      const ms = finite(d.duration) ?? this.#measured;
      return `<span class="${cls}">${OK_SVG}<span class="sr-only">${esc(t.done)}${ms !== undefined ? ', ' : ''}</span>${
        ms !== undefined ? `<span class="tc-time">${esc(formatToolMs(ms))}</span>` : ''
      }</span>`;
    }
    if (st === 'error') return `<span class="${cls}">${ERR_SVG}<span class="tc-time">${esc(t.failed)}</span></span>`;
    const dur = finite(d.duration);
    return `<span class="${cls}">${STOP_SVG}<span class="tc-time">${esc(t.noResult)}${
      dur !== undefined ? ` · ${esc(formatToolMs(dur))}` : ''
    }</span></span>`;
  }

  #bodyHtml(d: ToolCallData, st: ToolCallStatus, t: ToolCallStrings): string {
    const items: string[] = [];
    const at = formatToolClock(d.at, this.#lang);
    let clock = at
      ? `<time class="tc-at" datetime="${escAttr(new Date(Number(d.at)).toISOString())}" title="${escAttr(
          t.startedAt(at),
        )}">${esc(at)}</time>`
      : '';
    // The start clock sits at the right end of the body's first line (a section head or a muted line); before an
    // error box or a reload row it gets a short line of its own.
    const take = (): string => {
      if (items.length) return '';
      const c = clock;
      clock = '';
      return c;
    };
    const line = (cls: string, text: string): string => {
      const c = take();
      const p = `<p class="${cls}">${esc(text)}</p>`;
      return c ? `<div class="tc-line">${p}${c}</div>` : p;
    };
    if (st === 'interrupted') items.push(line('tc-pending', t.interrupted));
    if (st === 'error') {
      const msg = d.error === undefined || d.error === null || d.error === '' ? t.failedDefault : String(d.error);
      items.push(
        `<div class="tc-error">${ERR_SVG}<p class="tc-error-text">${esc(msg)}</p>${
          d.canRetry
            ? `<button type="button" class="tc-btn" data-act="retry" data-key="retry">${RETRY_SVG}${esc(t.retry)}</button>`
            : ''
        }</div>`,
      );
    }
    const hasArgs = d.args !== undefined;
    const hasResult = d.result !== undefined;
    const cap = this.#cap(d);
    if (hasArgs) items.push(this.#section('args', t.args, d.args, cap, t, take()));
    else this.#code.delete('args');
    if (hasResult) items.push(this.#section('result', t.result, d.result, cap, t, take()));
    else {
      this.#code.delete('result');
      if (st === 'running' && !d.loading && !d.detailError)
        items.push(
          `<div class="tc-section"><div class="tc-section-head"><span class="tc-label">${esc(
            t.result,
          )}</span>${take()}</div><p class="tc-pending">${esc(t.waiting)}</p></div>`,
        );
    }
    if (d.loading) items.push(line('tc-pending tc-loading', t.loading));
    else if (d.detailError)
      items.push(
        `<div class="tc-reload-row"><p class="tc-pending">${esc(
          d.detailError,
        )}</p><button type="button" class="tc-btn" data-act="reload" data-key="reload">${RETRY_SVG}${esc(t.reload)}</button></div>`,
      );
    else if (st === 'success' && !hasArgs && !hasResult) items.push(line('tc-pending', t.nothing));
    if (d.note !== undefined && d.note !== null && d.note !== '') items.push(line('tc-note', String(d.note)));
    if (clock) items.unshift(`<div class="tc-top">${clock}</div>`);
    return items.join('');
  }

  #section(part: ToolCallPart, label: string, value: unknown, cap: number, t: ToolCallStrings, clock: string): string {
    const c = this.#codeOf(part, value);
    const full = this.#full.has(part);
    const code = this.#codeHtml(c, full, cap);
    const copied = this.#copied.has(part);
    const copy = copied ? t.copied : t.copy(label);
    return `<div class="tc-section" data-part="${part}"><div class="tc-section-head"><span class="tc-label">${esc(
      label,
    )}</span><span class="tc-head-end">${clock}<button type="button" class="tc-copy" data-act="copy" data-part="${part}" data-key="copy-${part}" aria-label="${escAttr(
      copy,
    )}" title="${escAttr(copy)}"${copied ? ' data-copied' : ''}>${COPY_SVG}${DONE_SVG}</button></span></div><pre class="tc-code" data-part="${part}"${
      c.json ? ' data-json' : ''
    }><code${code.partial ? ' data-partial' : ''}>${code.html}</code></pre><button type="button" class="tc-more" data-act="more" data-part="${part}" data-key="more-${part}" aria-expanded="${full}" hidden>${esc(
      full ? t.showLess : t.showAll,
    )}</button></div>`;
  }

  /** Text + highlighted HTML per block, kept across renders while the value is the same. */
  #codeOf(part: ToolCallPart, value: unknown): Code {
    const hit = this.#code.get(part);
    if (hit && hit.value === value) return hit;
    const { text, json } = toCodeText(value);
    if (hit && hit.text === text) {
      hit.value = value;
      return hit;
    }
    // New content starts capped again.
    if (hit) this.#full.delete(part);
    const c: Code = { value, text, json, lines: lineCount(text) };
    this.#code.set(part, c);
    return c;
  }

  /**
   * A block far taller than the cap renders only its first lines (enough to fill the cap, so it is capped all the
   * same); Show all, a fallback selection, or a block that fits renders the whole. A 256 KiB result costs its first
   * screen until someone asks for the rest.
   */
  #codeHtml(c: Code, full: boolean, cap: number): { html: string; partial: boolean } {
    const keep = Math.ceil((cap + 24) / LINE_PX) + 20;
    if (!full && c.lines > keep) {
      if (c.head?.keep !== keep) {
        const head = c.text.slice(0, cutAfterLines(c.text, keep));
        c.head = { keep, html: c.json ? highlightJson(head) : esc(head) };
      }
      return { html: c.head.html, partial: true };
    }
    c.html ??= c.json ? highlightJson(c.text) : esc(c.text);
    return { html: c.html, partial: false };
  }

  /** Puts the whole block into a partially rendered code element (in place). */
  #fillCode(part: ToolCallPart): void {
    const code = this.$(`pre.tc-code[data-part="${part}"] > code[data-partial]`);
    const c = this.#code.get(part);
    if (!code || !c) return;
    code.innerHTML = this.#codeHtml(c, true, 0).html;
    code.removeAttribute('data-partial');
  }

  protected override updated(): void {
    const d = this.data;
    if (d) {
      const open = this.#isOpen(d);
      if (open !== this.#shownOpen) {
        this.$('.tc-body')?.getBoundingClientRect(); // commit the current state so the change transitions
        this.#shownOpen = open;
        this.#applyOpen(open);
      }
    }
    this.#measure();
    this.#observe();
    this.#syncTick();
    this.#announce();
  }

  #applyOpen(open: boolean): void {
    this.$('.tc')?.toggleAttribute('data-open', open);
    this.$('.tc-head')?.setAttribute('aria-expanded', String(open));
    const body = this.$('.tc-body');
    body?.toggleAttribute('data-open', open);
    body?.toggleAttribute('inert', !open);
  }

  #click(e: Event): void {
    const btn = (e.target as Element | null)?.closest?.('[data-act]');
    const d = this.data;
    if (!btn || !d) return;
    const act = btn.getAttribute('data-act');
    const part = btn.getAttribute('data-part') === 'result' ? 'result' : 'args';
    if (act === 'toggle') this.#toggle(d);
    else if (act === 'copy') this.#copy(part);
    else if (act === 'more') this.#more(part);
    else if (act === 'retry') this.emit<ToolCallActionDetail>('ui-retry', this.#withId({}));
    else if (act === 'reload') this.emit<ToolCallActionDetail>('ui-reload', this.#withId({}));
  }

  #withId<T extends object>(detail: T): T & { id?: string } {
    const id = this.data?.id;
    return id === undefined || id === null ? detail : { ...detail, id: String(id) };
  }

  #toggle(d: ToolCallData): void {
    const next = !this.#isOpen(d);
    if (!this.emit<ToolCallToggleDetail>('ui-toggle', this.#withId({ open: next }))) return;
    this.#auto = false;
    if (d.open !== undefined) return; // controlled: the host answers with data.open
    this.#open = next;
    this.renderNow();
  }

  /** Show all / Show less changes the block in place, so its height animates and a re-render keeps it. */
  #more(part: ToolCallPart): void {
    if (this.#full.has(part)) this.#full.delete(part);
    else {
      this.#full.add(part);
      this.#fillCode(part);
    }
    this.#measure();
  }

  #cap(d: ToolCallData): number {
    return Math.max(40, finite(d.maxCodeHeight) ?? DEFAULT_CAP);
  }

  /** Caps blocks taller than maxCodeHeight (+24px slack) with a fade; Show all opens to the natural height. */
  #measure(): void {
    const d = this.data;
    if (!d) return;
    const t = this.#t;
    const cap = this.#cap(d);
    for (const pre of this.$$<HTMLElement>('pre.tc-code')) {
      const part = pre.dataset.part === 'result' ? 'result' : 'args';
      const c = this.#code.get(part);
      let h = pre.scrollHeight;
      if (!h && c) h = c.lines * LINE_PX + CODE_PAD;
      const capped = h > cap + 24;
      const full = capped && this.#full.has(part);
      pre.toggleAttribute('data-capped', capped && !full);
      pre.style.maxHeight = capped ? `${full ? Math.ceil(h) : cap}px` : '';
      const more = pre.parentElement?.querySelector<HTMLElement>('.tc-more');
      if (!more) continue;
      more.hidden = !capped;
      more.setAttribute('aria-expanded', String(full));
      const label = full ? t.showLess : t.showAll;
      if (more.textContent !== label) more.textContent = label;
    }
  }

  /** Re-measure when a block's wrapped height changes (width change, panel shown after display:none). */
  #observe(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.#ro ??= new ResizeObserver(() => this.#measure());
    this.#ro.disconnect();
    for (const code of this.$$('pre.tc-code > code')) this.#ro.observe(code);
  }

  #copy(part: ToolCallPart): void {
    const c = this.#code.get(part);
    if (!c) return;
    if (!this.emit<ToolCallCopyDetail>('ui-copy', this.#withId({ part, text: c.text }))) return;
    const done = () => this.#flashCopied(part);
    const fallback = () => this.#select(part);
    try {
      const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
      if (clip && typeof clip.writeText === 'function') clip.writeText(c.text).then(done, fallback);
      else fallback();
    } catch {
      fallback();
    }
  }

  /** The copy icon morphs into a check for 1.4 s — in place, and a re-render in between keeps it. */
  #flashCopied(part: ToolCallPart): void {
    this.#copied.add(part);
    this.#paintCopy(part);
    this.#speak(this.#t.copied);
    clearTimeout(this.#copyTimers.get(part));
    this.#copyTimers.set(
      part,
      window.setTimeout(() => {
        this.#copied.delete(part);
        this.#copyTimers.delete(part);
        this.#paintCopy(part);
      }, COPIED_MS),
    );
  }

  #paintCopy(part: ToolCallPart): void {
    const b = this.$(`.tc-copy[data-part="${part}"]`);
    if (!b) return;
    const t = this.#t;
    const on = this.#copied.has(part);
    const label = on ? t.copied : t.copy(part === 'args' ? t.args : t.result);
    b.toggleAttribute('data-copied', on);
    b.setAttribute('aria-label', label);
    b.setAttribute('title', label);
  }

  /** Without clipboard access (plain http, a denied permission) the block's text is selected for ⌘C / Ctrl+C. */
  #select(part: ToolCallPart): void {
    this.#fillCode(part);
    const code = this.$(`pre.tc-code[data-part="${part}"] > code`);
    try {
      const sel = typeof getSelection === 'function' ? getSelection() : null;
      if (code && sel) {
        const range = document.createRange();
        range.selectNodeContents(code);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } catch {
      /* selection is best effort */
    }
    this.#speak(this.#t.selected);
  }

  #speak(text: string): void {
    if (this.#live.textContent !== text) this.#live.textContent = text;
  }

  /** Status changes are announced once; a card that first appears finished or failed stays quiet. */
  #announce(): void {
    const d = this.data;
    if (!d) return;
    const st = normStatus(d.status);
    if (st === this.#saidStatus) return;
    const first = this.#saidStatus === undefined;
    this.#saidStatus = st;
    if (first && st !== 'running') return;
    const t = this.#t;
    const name = String(d.name ?? '');
    this.#speak(
      st === 'running'
        ? t.sayRunning(name)
        : st === 'success'
          ? t.sayDone(name)
          : st === 'error'
            ? t.sayFailed(name, d.error ? String(d.error) : '')
            : t.sayInterrupted(name),
    );
  }

  /** The live timer ticks a text node in place every 100 ms — only while running and connected. */
  #syncTick(): void {
    const run = !!this.data && normStatus(this.data.status) === 'running' && this.isConnected;
    if (run && !this.#tick) this.#tick = window.setInterval(() => this.#paintTime(), TICK_MS);
    else if (!run) this.#stopTick();
  }

  #stopTick(): void {
    if (!this.#tick) return;
    clearInterval(this.#tick);
    this.#tick = 0;
  }

  #paintTime(): void {
    const d = this.data;
    if (!d || normStatus(d.status) !== 'running' || !this.isConnected) {
      this.#stopTick();
      return;
    }
    const node = this.$('.tc-status .tc-time')?.firstChild;
    const text = formatToolMs(this.#liveMs(d), true);
    if (node && node.nodeType === Node.TEXT_NODE && (node as Text).data !== text) (node as Text).data = text;
  }
}

define('ui-tool-call-card', UiToolCallCard);

declare global {
  interface HTMLElementTagNameMap {
    'ui-tool-call-card': UiToolCallCard;
  }
}
