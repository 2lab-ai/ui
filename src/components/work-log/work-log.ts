import { activityCss } from '../../core/activity';
import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { fmtDuration } from '../../core/format';
import { attrs, esc } from '../../core/html';
import { icon } from '../../icons/icons';
import '../log-scroller/log-scroller';
import type { LogScrollerData, UiLogScroller } from '../log-scroller/log-scroller';
import {
  entryExpandable,
  entryHtml,
  groupHeadHtml,
  normGroups,
  openGroups,
  type WorkCopyDetail,
  type WorkEntry,
  type WorkGroup,
  type WorkLogData,
  type WorkLogLang,
  type WorkOpenDetail,
  type WorkRetryDetail,
  type WorkToggleDetail,
  workLogStrings,
} from './logic';
import { styles } from './styles';

export type {
  WorkAgent,
  WorkAgentStatus,
  WorkCopyDetail,
  WorkEntry,
  WorkEntryKind,
  WorkGroup,
  WorkLogData,
  WorkLogLang,
  WorkOpenDetail,
  WorkRetryDetail,
  WorkSystem,
  WorkToggleDetail,
  WorkTool,
  WorkToolStatus,
} from './logic';

/** How long Copy reads “Copied”. */
export const WORK_LOG_COPIED_MS = 1500;
/** A group stops clipping its body this long after it starts opening (the expand is 240ms). */
const SETTLE_MS = 260;

interface EntryRec {
  id: string;
  group: string;
  uid: string;
  el: HTMLElement;
  sig: string;
  data: WorkEntry;
}

interface GroupRec {
  id: string;
  uid: string;
  el: HTMLElement;
  head: HTMLElement;
  region: HTMLElement;
  body: HTMLElement;
  headHtml: string;
  open: boolean;
  entries: string[];
  data: WorkGroup;
  settle?: ReturnType<typeof setTimeout>;
}

function fromHtml(html: string): HTMLElement {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  return tpl.content.firstElementChild as HTMLElement;
}

function syncAttr(el: Element, name: string, value: string | null): void {
  if (value === null) el.removeAttribute(name);
  else if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

function json(v: unknown): string {
  try {
    return JSON.stringify(v) ?? '';
  } catch {
    return `#${Math.random()}`;
  }
}

/**
 * `<ui-work-log>` — what an agent did, grouped by task: a group head (ref · title · count · time; the newest group
 * open) over entry rows — instructions, progress, responses, notices, errors, system turns, tool calls (a slot for
 * the host's `<ui-tool-call-card>`) and child agents (Open → `ui-open`). Rows with raw output open a viewer with
 * Copy and Retry. Built on `<ui-log-scroller>`: it follows the newest entry, pages older groups (`ui-load-older`)
 * and keeps the reader's place. A new `data` touches only the groups and entries that changed.
 */
export class UiWorkLog extends UiElement<WorkLogData> {
  static override styles = [activityCss, styles];
  static get observedAttributes() {
    return ['lang', 'theme'];
  }

  #scroller: UiLogScroller | null = null;
  #legacy: HTMLElement | null = null;
  #empty: HTMLElement | null = null;
  #emptyHtml = '';
  #legacyHtml = '';
  #groups = new Map<string, GroupRec>();
  #entries = new Map<string, EntryRec>();
  /** Group open state the reader chose. */
  #chosen = new Map<string, boolean>();
  #openRaw = new Set<string>();
  #skill = new Map<string, number>();
  #copied = new Map<string, ReturnType<typeof setTimeout>>();
  /** Entry id → its raw output (JSON) when Retry was pressed: loading until that changes. */
  #retrying = new Map<string, string>();
  #entering = new Set<string>();
  #seq = 0;
  #lang: WorkLogLang | null = null;
  #scrollerSig = '';
  /** `data-key` of the row the reader last focused: the log's one tab stop. */
  #current: string | null = null;
  /** A ui-load-older went out (not prevented) and no page came back yet. */
  #olderPending = false;
  #tick: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
    this.root.addEventListener('click', (e) => this.#onClick(e));
    this.root.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    // A live entry's rise runs once.
    this.root.addEventListener('animationend', (e) => {
      const t = e.target as Element | null;
      if (t?.classList?.contains('wl-entry')) t.removeAttribute('data-enter');
    });
    this.root.addEventListener('focusin', (e) => {
      const t = e.target as HTMLElement | null;
      if (t?.hasAttribute?.('data-nav') && t.dataset.key) {
        this.#current = t.dataset.key;
        this.#syncRoving();
      }
    });
    // The scroller's page request passes through to the host (composed). Note it once nobody prevented it.
    this.root.addEventListener('ui-load-older', (e) => {
      queueMicrotask(() => {
        if (!e.defaultPrevented) this.#olderPending = true;
      });
    });
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override disconnectedCallback(): void {
    if (this.#tick) clearInterval(this.#tick);
    this.#tick = null;
    for (const t of this.#copied.values()) clearTimeout(t);
    this.#copied.clear();
    for (const g of this.#groups.values()) {
      if (g.settle) clearTimeout(g.settle);
      g.settle = undefined;
      if (g.open) g.el.setAttribute('data-settled', '');
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** Go to the newest entry. */
  scrollToLatest(opts: { smooth?: boolean } = {}): void {
    this.#scroller?.scrollToLatest(opts);
  }

  /** The element of the entry with this id (to scroll to or measure). */
  entryFor(id: string): HTMLElement | null {
    return this.#entries.get(String(id))?.el ?? null;
  }

  /** Whether the group with this id is open. */
  isOpen(groupId: string): boolean {
    return this.#groups.get(String(groupId))?.open ?? false;
  }

  // ── Render ───────────────────────────────────────────────────────────────

  get #langAttr(): WorkLogLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  protected render(): string {
    return `<p class="wl-legacy" role="note" hidden></p><ui-log-scroller class="wl-log" part="log" exportparts="viewport,jump"></ui-log-scroller>`;
  }

  protected override update(): void {
    if (!this.#scroller) this.#build();
    const active = this.root.activeElement as HTMLElement | null;
    const focusKey = active && this.content.contains(active) ? (active.dataset.key ?? null) : undefined;
    this.#reconcile();
    this.#syncRoving();
    if (focusKey && !(active?.isConnected && this.root.activeElement === active)) {
      const next = this.$$<HTMLElement>('[data-key]').find((el) => el.dataset.key === focusKey);
      next?.focus({ preventScroll: true });
    }
    this.#syncTicker();
  }

  #build(): void {
    this.content.innerHTML = this.render();
    const sc = this.content.querySelector('ui-log-scroller') as UiLogScroller;
    if (typeof sc.appendItems !== 'function' && typeof customElements !== 'undefined') customElements.upgrade(sc);
    const empty = document.createElement('div');
    empty.slot = 'empty';
    empty.className = 'wl-empty';
    sc.append(empty);
    this.#scroller = sc;
    this.#empty = empty;
    this.#legacy = this.content.querySelector('.wl-legacy');
  }

  #reconcile(): void {
    const sc = this.#scroller as UiLogScroller;
    const d: WorkLogData = this.data && typeof this.data === 'object' ? this.data : {};
    const lang = this.#langAttr;
    const t = workLogStrings(lang);
    syncAttr(sc, 'lang', this.getAttribute('lang'));
    syncAttr(sc, 'theme', this.getAttribute('theme'));
    const denied = !!d.denied;

    // Legacy note (above the log) and the empty / owner-only state (the scroller's empty slot).
    const legacy = denied || !d.legacy ? '' : typeof d.legacy === 'string' && d.legacy.trim() ? d.legacy : t.legacy;
    const legacyHtml = legacy ? `${icon('info', { size: 14 })}<span>${esc(legacy)}</span>` : '';
    if (this.#legacy && legacyHtml !== this.#legacyHtml) {
      this.#legacy.innerHTML = legacyHtml;
      this.#legacy.hidden = !legacyHtml;
      this.#legacyHtml = legacyHtml;
    }
    const emptyText = denied
      ? typeof d.denied === 'string' && d.denied.trim()
        ? d.denied
        : t.denied
      : d.emptyText || t.empty;
    const emptyHtml = `${icon(denied ? 'user' : 'list', { size: 20 })}<span class="wl-empty-text">${esc(emptyText)}</span>`;
    if (this.#empty && emptyHtml !== this.#emptyHtml) {
      this.#empty.innerHTML = emptyHtml;
      this.#empty.dataset.state = denied ? 'denied' : 'empty';
      this.#emptyHtml = emptyHtml;
    }

    const langChanged = this.#lang !== null && this.#lang !== lang;
    this.#lang = lang;
    const groups = denied ? [] : normGroups(d.groups);
    const open = openGroups(groups, this.#chosen);

    // Groups that left.
    const ids = new Set(groups.map((g) => g.id));
    const gone = [...this.#groups.keys()].filter((id) => !ids.has(id));
    if (gone.length && gone.length === this.#groups.size) {
      sc.clearItems();
      for (const id of gone) this.#dropGroup(id);
    } else {
      for (const id of gone) {
        sc.removeItem(id);
        this.#dropGroup(id);
      }
    }

    // The scroller's own data (only when it changed: a new object settles a page it waits for).
    const sdata: LogScrollerData = {
      hasMore: !denied && !!d.hasMore,
      loading: !denied && !!d.loading,
      label: d.label || t.label,
      emptyText,
      startText: d.startText,
      live: d.live,
    };
    const ssig = json(sdata);
    if (ssig !== this.#scrollerSig) {
      this.#scrollerSig = ssig;
      this.#olderPending = false;
      sc.data = sdata;
    }

    const known = new Set(this.#groups.keys());
    const wasEmpty = known.size === 0;
    const prepend: HTMLElement[] = [];
    const append: HTMLElement[] = [];
    let changed = false;
    let seen = false;
    // Entries that arrived inside groups already shown: the reader higher up hears about them on the pill.
    let fresh = 0;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const isOpen = open.get(g.id) ?? false;
      const rec = this.#groups.get(g.id);
      if (rec) {
        seen = true;
        if (langChanged) {
          this.#dropGroup(g.id, true);
          sc.upsertItem(g.id, this.#buildGroup(g, isOpen));
          changed = true;
        } else {
          const had = new Set(rec.entries);
          if (this.#patchGroup(rec, g, isOpen)) changed = true;
          fresh += (g.entries ?? []).filter((e) => !had.has(e.id)).length;
        }
        continue;
      }
      const el = this.#buildGroup(g, isOpen);
      if (!seen && !wasEmpty) {
        prepend.push(el);
        continue;
      }
      changed = true;
      let next: GroupRec | undefined;
      for (let j = i + 1; j < groups.length && !next; j++)
        if (known.has(groups[j].id)) next = this.#groups.get(groups[j].id);
      if (next) next.el.before(el);
      else append.push(el);
    }
    if (prepend.length) {
      this.#olderPending = false;
      sc.prependItems(prepend, { hasMore: sdata.hasMore });
    } else if (this.#olderPending && !changed) {
      // The host answered the page request without a page (it failed, or nothing older came): end the loading row.
      this.#olderPending = false;
      sc.data = { ...sdata };
    }
    if (append.length) sc.appendItems(append, wasEmpty ? { animate: false } : {});
    if (fresh) sc.noteUnread(fresh);
  }

  #buildGroup(g: WorkGroup, open: boolean): HTMLElement {
    const uid = `wl${++this.#seq}`;
    const headHtml = groupHeadHtml(g, this.#langAttr);
    const el = fromHtml(
      `<section${attrs({ class: 'wl-group', 'data-item': g.id })}><h3 class="wl-gh-h"><button${attrs({
        type: 'button',
        class: 'wl-gh',
        id: `${uid}-head`,
        tabindex: '-1',
        'data-nav': true,
        'data-key': `g:${g.id}`,
        'aria-expanded': 'false',
        'aria-controls': `${uid}-body`,
      })}>${headHtml}</button></h3><div${attrs({
        class: 'wl-g-region',
        id: `${uid}-body`,
        inert: true,
      })}><div class="wl-g-inner"><div class="wl-g-body"></div></div></div></section>`,
    );
    const rec: GroupRec = {
      id: g.id,
      uid,
      el,
      head: el.querySelector('.wl-gh') as HTMLElement,
      region: el.querySelector('.wl-g-region') as HTMLElement,
      body: el.querySelector('.wl-g-body') as HTMLElement,
      headHtml,
      open: false,
      entries: [],
      data: g,
    };
    this.#groups.set(g.id, rec);
    this.#setOpen(rec, open, false);
    this.#syncEntries(rec, g.entries ?? [], false);
    return el;
  }

  /** Bring an existing group in line; true when something visible changed. */
  #patchGroup(rec: GroupRec, g: WorkGroup, open: boolean): boolean {
    let changed = false;
    rec.data = g;
    const headHtml = groupHeadHtml(g, this.#langAttr);
    if (headHtml !== rec.headHtml) {
      rec.head.innerHTML = headHtml;
      rec.headHtml = headHtml;
      changed = true;
    }
    let want = open;
    if (!want && rec.open) {
      // Never fold a group under the reader's focus on our own: it stays open as if they had chosen it.
      const active = this.root.activeElement;
      if (typeof g.open !== 'boolean' && active && rec.region.contains(active)) {
        this.#chosen.set(rec.id, true);
        want = true;
      } else if (active && rec.region.contains(active)) rec.head.focus({ preventScroll: true });
    }
    if (want !== rec.open) this.#setOpen(rec, want, true);
    if (this.#syncEntries(rec, g.entries ?? [], true)) changed = true;
    return changed;
  }

  #setOpen(rec: GroupRec, open: boolean, animate: boolean): void {
    rec.open = open;
    rec.el.toggleAttribute('data-open', open);
    rec.head.setAttribute('aria-expanded', String(open));
    rec.region.toggleAttribute('inert', !open);
    if (rec.settle) clearTimeout(rec.settle);
    rec.settle = undefined;
    rec.el.removeAttribute('data-settled');
    if (!open) return;
    // Once open it stops clipping, so focus rings and the skill pane inside are not cut off.
    if (!animate || prefersReducedMotion()) rec.el.setAttribute('data-settled', '');
    else
      rec.settle = setTimeout(() => {
        if (rec.open) rec.el.setAttribute('data-settled', '');
      }, SETTLE_MS);
  }

  /** Entries in order: new ones inserted, changed ones replaced, the rest left as they are. */
  #syncEntries(rec: GroupRec, list: WorkEntry[], live: boolean): boolean {
    let changed = false;
    const want = new Set(list.map((e) => e.id));
    for (const id of rec.entries) {
      const er = this.#entries.get(id);
      if (!want.has(id) && er && er.group === rec.id) {
        er.el.remove();
        this.#dropEntry(id);
        changed = true;
      }
    }
    let prev: HTMLElement | null = null;
    for (const e of list) {
      let er = this.#entries.get(e.id);
      if (er && er.group !== rec.id) {
        er.el.remove();
        this.#entries.delete(e.id);
        er = undefined;
      }
      const sig = this.#entrySig(e);
      if (!er) {
        const uid = `wl${++this.#seq}`;
        er = { id: e.id, group: rec.id, uid, el: this.#entryEl(e, uid), sig, data: e };
        // A step that lands in a group already on screen rises in once (the scroller animates new groups).
        if (live) er.el.setAttribute('data-enter', '');
        this.#entries.set(e.id, er);
        changed = true;
      } else if (er.sig !== sig) {
        const el = this.#entryEl(e, er.uid);
        er.el.replaceWith(el);
        er.el = el;
        er.sig = sig;
        changed = true;
      }
      er.data = e;
      const at: Element | null = prev ? prev.nextElementSibling : rec.body.firstElementChild;
      if (at !== er.el) {
        if (prev) prev.after(er.el);
        else rec.body.prepend(er.el);
      }
      prev = er.el;
    }
    rec.entries = list.map((e) => e.id);
    return changed;
  }

  #entrySig(e: WorkEntry): string {
    const id = e.id;
    if (this.#retrying.has(id) && this.#retrying.get(id) !== json(e.raw ?? null)) this.#retrying.delete(id);
    return `${this.#langAttr}|${this.#openRaw.has(id) ? 1 : 0}|${this.#skill.get(id) ?? ''}|${
      this.#copied.has(id) ? 1 : 0
    }|${this.#retrying.has(id) ? 1 : 0}|${json(e)}`;
  }

  #entryEl(e: WorkEntry, uid: string): HTMLElement {
    const id = e.id;
    const el = fromHtml(
      entryHtml(e, {
        lang: this.#langAttr,
        uid,
        open: this.#openRaw.has(id),
        skill: this.#skill.get(id) ?? null,
        copied: this.#copied.has(id),
        retrying: this.#retrying.has(id),
        entering: this.#entering.has(id),
        now: Date.now(),
      }),
    );
    this.#entering.delete(id);
    return el;
  }

  #dropGroup(id: string, keepState = false): void {
    const rec = this.#groups.get(id);
    if (!rec) return;
    if (rec.settle) clearTimeout(rec.settle);
    for (const eid of rec.entries) {
      const er = this.#entries.get(eid);
      if (er && er.group === id) {
        if (keepState) this.#entries.delete(eid);
        else this.#dropEntry(eid);
      }
    }
    this.#groups.delete(id);
  }

  #dropEntry(id: string): void {
    this.#entries.delete(id);
    this.#openRaw.delete(id);
    this.#skill.delete(id);
    this.#retrying.delete(id);
    this.#entering.delete(id);
    const c = this.#copied.get(id);
    if (c) clearTimeout(c);
    this.#copied.delete(id);
  }

  // ── Keyboard: one tab stop, arrows walk the visible heads and rows ───────

  /** Group heads, openable rows and child agents the reader can reach (not inside a closed group). */
  #navs(): HTMLElement[] {
    return this.$$<HTMLElement>('[data-nav]').filter((el) => {
      const region = el.closest('.wl-g-region');
      return !region || !!region.closest('.wl-group')?.hasAttribute('data-open');
    });
  }

  #syncRoving(): void {
    const navs = this.#navs();
    const cur = navs.find((n) => n.dataset.key === this.#current) ?? navs[navs.length - 1];
    for (const n of this.$$<HTMLElement>('[data-nav]')) syncAttr(n, 'tabindex', n === cur ? '0' : '-1');
  }

  #onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (!t?.hasAttribute?.('data-nav')) return;
    if (t.classList.contains('wl-row') && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      const id = t.closest<HTMLElement>('[data-entry]')?.dataset.entry;
      if (id !== undefined) this.#toggleEntry(id);
      return;
    }
    if (t.classList.contains('wl-gh') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      const gid = t.closest<HTMLElement>('.wl-group')?.dataset.item;
      const rec = gid === undefined ? undefined : this.#groups.get(gid);
      if (rec && rec.open === (e.key === 'ArrowLeft')) {
        e.preventDefault();
        this.#toggleGroup(rec.id);
      }
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const navs = this.#navs();
    const i = navs.indexOf(t);
    if (i < 0 || !navs.length) return;
    e.preventDefault();
    const j =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? navs.length - 1
          : Math.max(0, Math.min(navs.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
    navs[j].focus();
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  #onClick(e: Event): void {
    const t = e.target as Element | null;
    if (!t?.closest) return;
    const head = t.closest<HTMLElement>('.wl-gh');
    if (head) {
      const gid = head.closest<HTMLElement>('.wl-group')?.dataset.item;
      if (gid !== undefined) this.#toggleGroup(gid);
      return;
    }
    const entry = t.closest<HTMLElement>('[data-entry]');
    const id = entry?.dataset.entry;
    if (id === undefined || !this.#entries.has(id)) return;
    const btn = t.closest<HTMLElement>('button');
    if (btn?.classList.contains('raw-copy')) this.#copy(id);
    else if (btn?.classList.contains('raw-retry')) this.#retry(id);
    else if (btn?.classList.contains('skill-badge')) this.#toggleSkill(id, Number(btn.dataset.skill));
    else if (btn?.classList.contains('wl-agent')) {
      this.emit<WorkOpenDetail>('ui-open', { id: btn.dataset.agent ?? '', entry: id });
    } else if (t.closest('.wl-row[role="button"]')) this.#toggleEntry(id);
  }

  #toggleGroup(gid: string): void {
    const rec = this.#groups.get(gid);
    if (!rec) return;
    const open = !rec.open;
    if (!this.emit<WorkToggleDetail>('ui-toggle', { kind: 'group', id: gid, group: gid, open })) return;
    if (typeof rec.data.open === 'boolean') return; // controlled: the host answers with data
    this.#chosen.set(gid, open);
    const active = this.root.activeElement;
    if (!open && active && rec.region.contains(active)) rec.head.focus({ preventScroll: true });
    this.#setOpen(rec, open, true);
    this.#syncRoving();
  }

  #toggleEntry(id: string): void {
    const rec = this.#entries.get(id);
    if (!rec || !entryExpandable(rec.data)) return;
    const open = !this.#openRaw.has(id);
    if (!this.emit<WorkToggleDetail>('ui-toggle', { kind: 'entry', id, group: rec.group, open })) return;
    if (open) {
      this.#openRaw.add(id);
      this.#entering.add(id);
    } else this.#openRaw.delete(id);
    this.renderNow();
  }

  #toggleSkill(id: string, index: number): void {
    if (!Number.isInteger(index)) return;
    if (this.#skill.get(id) === index) this.#skill.delete(id);
    else this.#skill.set(id, index);
    this.renderNow();
  }

  #copy(id: string): void {
    const rec = this.#entries.get(id);
    const raw = rec?.data.raw;
    if (!rec || !raw || raw.state !== 'ready') return;
    const text = String(raw.text ?? '');
    try {
      const done = typeof navigator !== 'undefined' ? navigator.clipboard?.writeText?.(text) : undefined;
      done?.catch?.(() => {});
    } catch {
      // No clipboard (insecure context): the event still tells the host.
    }
    const prev = this.#copied.get(id);
    if (prev) clearTimeout(prev);
    this.#copied.set(
      id,
      setTimeout(() => {
        this.#copied.delete(id);
        if (this.isConnected) this.renderNow();
      }, WORK_LOG_COPIED_MS),
    );
    this.renderNow();
    this.notify<WorkCopyDetail>('ui-copy', { id, group: rec.group, text });
  }

  #retry(id: string): void {
    const rec = this.#entries.get(id);
    if (!rec) return;
    if (!this.emit<WorkRetryDetail>('ui-retry', { id, group: rec.group })) return;
    // Loading until the host sets this entry's raw output again (whatever the outcome).
    this.#retrying.set(id, json(this.#entries.get(id)?.data.raw ?? null));
    this.renderNow();
  }

  // ── Live time of running child agents (text nodes only) ──────────────────

  #syncTicker(): void {
    const any = !!this.root.querySelector('[data-since]');
    if (any && !this.#tick && this.isConnected) this.#tick = setInterval(() => this.#tickNow(), 1000);
    else if (!any && this.#tick) {
      clearInterval(this.#tick);
      this.#tick = null;
    }
  }

  #tickNow(): void {
    const now = Date.now();
    for (const el of this.$$<HTMLElement>('[data-since]')) {
      const s = fmtDuration(now - Number(el.dataset.since));
      if (el.textContent !== s) el.textContent = s;
    }
  }
}

define('ui-work-log', UiWorkLog);

declare global {
  interface HTMLElementTagNameMap {
    'ui-work-log': UiWorkLog;
  }
}
