import { define, UiElement } from '../../core/element';
import { esc, escAttr } from '../../core/html';
import { formatToolMs, groupStats, type ToolCallData, type ToolCallGroupData } from './logic';
import { type ToolCallStrings, toolCallStrings } from './strings';
import { styles } from './styles';
import { CHEV_SVG, callIconSvg, type ToolCallToggleDetail, type UiToolCallCard } from './tool-call-card';

const TICK_MS = 100;
const STACK = 3;

/** Stable keys for a group's calls: `id:<id>` when the call has an id, else `i:<index>` (duplicates get a suffix). */
export function callKeys(calls: ToolCallData[]): string[] {
  const seen = new Set<string>();
  return calls.map((c, i) => {
    const id = c && c.id !== undefined && c.id !== null && c.id !== '' ? `id:${c.id}` : `i:${i}`;
    const key = seen.has(id) ? `${id}#${i}` : id;
    seen.add(key);
    return key;
  });
}

function sameCall(a: ToolCallData, b: ToolCallData): boolean {
  if (a === b) return true;
  const ka = Object.keys(a) as Array<keyof ToolCallData>;
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (!Object.is(a[k], b[k])) return false;
  return true;
}

const finite = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

interface Entry {
  el: UiToolCallCard;
  data: ToolCallData | undefined;
}

/**
 * `<ui-tool-call-group>` — several tool calls folded into one quiet line: the last three tools' icons stacked,
 * “Used 3 tools · 1 failed · 2.4s” (or “Using tools…” with a light sweep while any call runs). Open it for one
 * `<ui-tool-call-card>` per call. The cards live in a list outside the re-rendered line and are reconciled by key,
 * so a group update never re-creates them (open state, timers and copy checks survive).
 */
export class UiToolCallGroup extends UiElement<ToolCallGroupData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang', 'theme'];
  }

  #open = false;
  #shownOpen = false;
  #rendered = false;
  #running: boolean | undefined;
  #titleIn = false;
  #acc = 0;
  #since: number | null = null;
  #lastEnd = 0;
  #tick = 0;
  #keys: string[] = [];
  #stack = new Set<string>();
  #cards = new Map<string, Entry>();
  #saidRunning: boolean | undefined;
  readonly #body: HTMLElement;
  readonly #list: HTMLElement;
  readonly #live: HTMLElement;

  constructor() {
    super();
    this.#body = document.createElement('div');
    this.#body.className = 'tc-body tcg-body';
    this.#body.id = 'tcg-body';
    this.#body.hidden = true;
    this.#body.setAttribute('inert', '');
    const clip = document.createElement('div');
    clip.className = 'tc-clip';
    this.#list = document.createElement('div');
    this.#list.className = 'tcg-list';
    this.#list.setAttribute('role', 'list');
    clip.append(this.#list);
    this.#body.append(clip);
    this.#live = document.createElement('span');
    this.#live.className = 'sr-only';
    this.#live.setAttribute('role', 'status');
    this.#live.setAttribute('aria-live', 'polite');
    this.root.append(this.#body, this.#live);
    this.root.addEventListener('click', (e) => {
      if ((e.target as Element | null)?.closest?.('.tcg-head')) this.#toggle(e);
    });
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override disconnectedCallback(): void {
    this.#stopTick();
  }

  /** Focus the group's header button. */
  override focus(options?: FocusOptions): void {
    if (!this.$('.tcg-head') && this.data && this.isConnected) this.renderNow();
    const head = this.$<HTMLButtonElement>('.tcg-head');
    if (head) head.focus(options);
    else super.focus(options);
  }

  /** Whether the list is open now (controlled `data.open`, else the element's own state). */
  get isOpen(): boolean {
    return this.data ? this.#isOpen(this.data) : false;
  }

  /** The card elements, in call order. */
  get cards(): UiToolCallCard[] {
    return Array.from(this.#cards.values(), (e) => e.el);
  }

  get #t(): ToolCallStrings {
    return toolCallStrings(this.getAttribute('lang'));
  }

  #isOpen(d: ToolCallGroupData): boolean {
    return d.open ?? this.#open;
  }

  /** Time with tools running, added up over running stretches (e.g. a pause before a retry). */
  #syncRun(running: boolean, calls: ToolCallData[]): void {
    const prev = this.#running;
    this.#titleIn = prev !== undefined && prev !== running;
    const now = Date.now();
    if (running && this.#since === null) {
      const starts = calls
        .filter((c) => c.status === 'running')
        .map((c) => finite(c.startedAt))
        .filter((v): v is number => v !== undefined);
      const first = starts.length ? Math.min(...starts) : now;
      this.#since = Math.min(now, Math.max(this.#lastEnd, first));
    } else if (!running && this.#since !== null) {
      this.#lastEnd = now;
      this.#acc += now - this.#since;
      this.#since = null;
    }
    if (prev !== running && !running) this.#stopTick();
    this.#running = running;
  }

  #liveMs(): number {
    return this.#acc + (this.#since === null ? 0 : Math.max(0, Date.now() - this.#since));
  }

  protected render(): string {
    const d = this.data;
    if (!d) return '';
    const calls = Array.isArray(d.calls) ? d.calls : [];
    const t = this.#t;
    const { running, failed, sum } = groupStats(calls);
    this.#syncRun(running, calls);
    if (!this.#rendered) this.#open = !!d.defaultOpen;
    const open = this.#isOpen(d);
    const first = !this.#rendered;
    if (first) {
      this.#rendered = true;
      this.#shownOpen = open;
    }
    const shown = this.#shownOpen;
    const keys = callKeys(calls);
    this.#keys = keys;

    // The last three tools; a tile that just joined the stack pops in, the others stay still.
    const from = Math.max(0, calls.length - STACK);
    const stackKeys = new Set<string>();
    let stack = '';
    for (let i = from; i < calls.length; i++) {
      stackKeys.add(keys[i]);
      const enter = !first && !this.#stack.has(keys[i]);
      stack += `<span class="tc-icon${enter ? ' is-in' : ''}">${callIconSvg(calls[i] ?? { name: '' })}</span>`;
    }
    this.#stack = stackKeys;

    const title = running ? d.runningLabel || t.using : d.label || t.used(calls.length);
    const ms = running ? this.#liveMs() : (finite(d.duration) ?? sum ?? (this.#acc > 0 ? this.#acc : undefined));
    return `<div class="tcg"${running ? ' data-running' : ''}${shown ? ' data-open' : ''}><button type="button" class="tcg-head" data-key="head" aria-expanded="${shown}" aria-controls="tcg-body"${
      d.focusable === false ? ' tabindex="-1"' : ''
    }><span class="tcg-stack" aria-hidden="true">${stack}</span><span class="tcg-title${this.#titleIn ? ' is-in' : ''}"><span class="tcg-label${
      running ? ' tc-shine' : ''
    }" data-text="${escAttr(title)}">${esc(title)}</span>${
      !running && failed ? `<span class="tcg-failed">· ${esc(t.nFailed(failed))}</span>` : ''
    }${ms !== undefined ? `<span class="tcg-time">· ${esc(formatToolMs(ms, running))}</span>` : ''}</span>${CHEV_SVG}</button></div>`;
  }

  protected override updated(): void {
    const d = this.data;
    this.#body.hidden = !d;
    if (d) {
      this.#reconcile(d);
      const open = this.#isOpen(d);
      if (open !== this.#shownOpen) {
        this.$('.tcg')?.getBoundingClientRect(); // commit the current state so the change transitions
        this.#shownOpen = open;
      }
      this.#applyOpen(this.#shownOpen);
    }
    this.#syncTick();
    this.#announce();
  }

  /** One card per call, keyed by id (else index): create / remove only what changed, keep the rest in place. */
  #reconcile(d: ToolCallGroupData): void {
    const calls = Array.isArray(d.calls) ? d.calls : [];
    const keys = this.#keys.length === calls.length ? this.#keys : callKeys(calls);
    const lang = this.getAttribute('lang');
    const theme = this.getAttribute('theme');
    const next = new Map<string, Entry>();
    calls.forEach((call, i) => {
      if (!call) return;
      let entry = this.#cards.get(keys[i]);
      if (!entry) {
        const el = document.createElement('ui-tool-call-card');
        el.setAttribute('role', 'listitem');
        entry = { el, data: undefined };
      }
      syncAttr(entry.el, 'lang', lang);
      syncAttr(entry.el, 'theme', theme);
      const data = d.focusable === false && call.focusable === undefined ? { ...call, focusable: false } : call;
      if (!entry.data || !sameCall(entry.data, data)) {
        entry.data = data;
        entry.el.data = data;
      }
      next.set(keys[i], entry);
    });
    for (const [key, entry] of this.#cards) if (!next.has(key)) entry.el.remove();
    let at = this.#list.firstElementChild;
    for (const { el } of next.values()) {
      if (el === at) at = at.nextElementSibling;
      else this.#list.insertBefore(el, at);
    }
    this.#cards = next;
  }

  #applyOpen(open: boolean): void {
    this.$('.tcg')?.toggleAttribute('data-open', open);
    this.$('.tcg-head')?.setAttribute('aria-expanded', String(open));
    this.#body.toggleAttribute('data-open', open);
    this.#body.toggleAttribute('inert', !open);
  }

  #toggle(e: Event): void {
    const d = this.data;
    if (!d) return;
    const next = !this.#isOpen(d);
    if (!this.emit<ToolCallToggleDetail>('ui-toggle', { open: next })) return;
    this.sound(next ? 'open' : 'close', { emphasis: 'subtle' }, e);
    if (d.open !== undefined) return; // controlled: the host answers with data.open
    this.#open = next;
    this.#shownOpen = next;
    this.#applyOpen(next);
  }

  /** Running ↔ done is announced once each way; a group that first appears done stays quiet. */
  #announce(): void {
    const d = this.data;
    if (!d) return;
    const running = !!this.#running;
    if (running === this.#saidRunning) return;
    const first = this.#saidRunning === undefined;
    this.#saidRunning = running;
    if (first && !running) return;
    const t = this.#t;
    const calls = Array.isArray(d.calls) ? d.calls : [];
    const text = running
      ? d.runningLabel || t.using
      : t.groupSay(d.label || t.used(calls.length), groupStats(calls).failed);
    if (this.#live.textContent !== text) this.#live.textContent = text;
  }

  #syncTick(): void {
    const run = !!this.data && !!this.#running && this.isConnected;
    if (run && !this.#tick) this.#tick = window.setInterval(() => this.#paintTime(), TICK_MS);
    else if (!run) this.#stopTick();
  }

  #stopTick(): void {
    if (!this.#tick) return;
    clearInterval(this.#tick);
    this.#tick = 0;
  }

  #paintTime(): void {
    if (!this.#running || !this.isConnected) {
      this.#stopTick();
      return;
    }
    const node = this.$('.tcg-time')?.firstChild;
    const text = `· ${formatToolMs(this.#liveMs(), true)}`;
    if (node && node.nodeType === Node.TEXT_NODE && (node as Text).data !== text) (node as Text).data = text;
  }
}

function syncAttr(el: Element, name: string, value: string | null): void {
  if (el.getAttribute(name) === value) return;
  if (value === null) el.removeAttribute(name);
  else el.setAttribute(name, value);
}

define('ui-tool-call-group', UiToolCallGroup);

declare global {
  interface HTMLElementTagNameMap {
    'ui-tool-call-group': UiToolCallGroup;
  }
}
