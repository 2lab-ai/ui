import { define, UiElement } from '../../core/element';
import { fmtDuration, fmtTokens } from '../../core/format';
import { esc, escAttr } from '../../core/html';
import {
  type AgentTreeData,
  type AgentTreeDensity,
  type AgentTreeModel,
  type AgentTreeStatus,
  agentInitials,
  buildTree,
  durationOf,
  fmtCost,
  idPart,
  nearestVisible,
  type SpanAxis,
  spanAxis,
  spanOf,
  type TreeItem,
  ticks,
  treeKeyAction,
  typeaheadIndex,
  visibleItems,
} from './logic';
import { morphChildren } from './morph';
import { type AgentTreeLang, type AgentTreeStrings, agentTreeStrings } from './strings';
import { styles } from './styles';

export interface AgentTreeSelectDetail {
  /** The agent the person picked (click, Enter / Space, or a “needs you” / “failed” jump in the bar). */
  id: string;
}

export interface AgentTreeToggleDetail {
  id: string;
  /** The state the person asked for: true = open the branch. */
  expanded: boolean;
}

/** Running times tick once a second. */
export const AGENT_TREE_TICK_MS = 1000;
/** Type-ahead keys within this gap build one query. */
export const AGENT_TREE_TYPEAHEAD_MS = 500;
/** A node that just appeared (new data, or an opened branch) rises in for this long. */
const NEW_MS = 420;

const svg = (inner: string, cls = '') =>
  `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 16 16" aria-hidden="true">${inner}</svg>`;
const ICON: Record<AgentTreeStatus, string> = {
  running: svg('<circle cx="8" cy="8" r="5.5" opacity="0.25"/><path d="M8 2.5a5.5 5.5 0 0 1 5.5 5.5"/>', 'at-spin'),
  waiting: svg('<circle cx="8" cy="8" r="5.5"/><path d="M6.6 6v4M9.4 6v4"/>'),
  needs_you: svg('<circle cx="8" cy="8" r="5.5"/><path d="M8 5.2V8l1.9 1.3"/>'),
  done: svg('<path d="m4.4 8.4 2.5 2.5 4.7-5.4"/>'),
  failed: svg(
    '<path d="M7.1 3.1a1 1 0 0 1 1.8 0l4.6 8.4a1 1 0 0 1-.9 1.5H3.4a1 1 0 0 1-.9-1.5z"/><path d="M8 6.6v2.6M8 11.1v.1"/>',
  ),
  cancelled: svg('<rect x="4.6" y="4.6" width="6.8" height="6.8" rx="1.4"/>'),
  unknown: svg('<circle cx="8" cy="8" r="5" stroke-dasharray="2.2 2"/>'),
};
const CHEV = svg('<path d="M6 4l4 4-4 4"/>');
const SPARK = svg(
  '<path d="M8 1.6c.5 3.3 2.1 4.9 5.4 5.4-3.3.5-4.9 2.1-5.4 5.4C7.5 9.1 5.9 7.5 2.6 7 5.9 6.5 7.5 4.9 8 1.6Z" fill="currentColor" stroke="none"/>',
);
/** Statuses the bar lets you jump to. */
const JUMP: AgentTreeStatus[] = ['needs_you', 'failed'];
/** A worst status below a folded branch worth a tint and a word. */
const LOUD: ReadonlySet<AgentTreeStatus> = new Set(['needs_you', 'failed', 'running']);
/** Statuses whose compact row adds its summary line (who is doing what now). */
const LINE: ReadonlySet<AgentTreeStatus> = new Set(['running', 'waiting', 'needs_you', 'failed']);

// One shared 1 s clock for every tree on the page; it runs only while some tree has a running time to show.
const clock: { subs: Set<() => void>; id: ReturnType<typeof setInterval> | undefined } = {
  subs: new Set(),
  id: undefined,
};
function onTick(fn: () => void): void {
  clock.subs.add(fn);
  clock.id ??= setInterval(() => {
    for (const f of [...clock.subs]) f();
  }, AGENT_TREE_TICK_MS);
}
function offTick(fn: () => void): void {
  clock.subs.delete(fn);
  if (!clock.subs.size && clock.id !== undefined) {
    clearInterval(clock.id);
    clock.id = undefined;
  }
}

const textOf = (el: Element | null | undefined): Text | undefined => {
  const n = el?.firstChild;
  return n && n.nodeType === Node.TEXT_NODE ? (n as Text) : undefined;
};

interface Ctx {
  t: AgentTreeStrings;
  density: AgentTreeDensity;
  now: number;
  axis: SpanAxis | null;
  selected: string | null;
  stop: string;
  open: (id: string) => boolean;
  fresh: ReadonlySet<string>;
}

/**
 * `<ui-agent-tree>` — who spawned whom, what each agent is doing, and which branch costs what. A WAI-ARIA tree built
 * from a flat list (`parentId`): status, time, spend and the reason an agent needs you or failed on every node; a
 * branch rolls its sub-agents' tokens, cost and tool calls up, and a folded branch shows how many it hides and the
 * most urgent status among them. `compact` is one row per agent; `rich` is a card per agent with a waterfall bar on
 * one time axis shared by the whole tree.
 */
export class UiAgentTree extends UiElement<AgentTreeData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang'];
  }

  #model: AgentTreeModel = buildTree([]);
  /** Uncontrolled state: closed branches (every branch starts open) and the selection. */
  #closed = new Set<string>();
  #selected: string | null = null;
  #expRef: unknown;
  #expSet = new Set<string>();
  /** The item that holds the tree's one tab stop. */
  #active = '';
  #pendingFocus = '';
  /** Items on screen at the last render, and when each newly shown one appeared. */
  #shown = new Set<string>();
  #born = new Map<string, number>();
  #rendered = false;
  #els = new Map<string, HTMLElement>();
  #ticks: Array<{ text: Text; item: TreeItem }> = [];
  #spans: Array<{ el: HTMLElement; item: TreeItem }> = [];
  #axisEnd: Text | undefined;
  #ta = { q: '', at: 0 };
  #said = '';
  readonly #tickFn = () => this.#tick();
  readonly #live: HTMLElement;

  constructor() {
    super();
    // Outside the re-rendered markup, so a render never re-creates (or re-reads) the live region.
    this.#live = document.createElement('span');
    this.#live.className = 'sr-only';
    this.#live.setAttribute('role', 'status');
    this.#live.setAttribute('aria-live', 'polite');
    this.root.append(this.#live);
    this.root.addEventListener('click', (e) => this.#onClick(e as MouseEvent));
    this.root.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    this.root.addEventListener('focusin', (e) => {
      const item = (e.target as Element | null)?.closest?.<HTMLElement>('.at-item[data-id]');
      if (item && e.target === item) this.#setStop(item.dataset.id ?? '');
    });
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override disconnectedCallback(): void {
    offTick(this.#tickFn);
  }

  /** Focus the tree's tab stop: the item last focused, else the selected one, else the first. */
  override focus(options?: FocusOptions): void {
    if (!this.$('.at-tree') && this.data && this.isConnected) this.renderNow();
    const el = this.#els.get(this.#active) ?? this.$<HTMLElement>('.at-item[tabindex="0"]');
    if (el) el.focus(options);
    else super.focus(options);
  }

  /** The selected agent: controlled `data.selectedId`, else the tree's own (null = none). */
  get selectedId(): string | null {
    const d = this.data;
    if (d && d.selectedId !== undefined) return d.selectedId === null ? null : String(d.selectedId);
    return this.#selected;
  }

  /** Ids of the branches open now (agents with sub-agents only). */
  get expanded(): string[] {
    return this.#model.all.filter((it) => it.children.length && this.#isOpen(it.id)).map((it) => it.id);
  }

  /**
   * Show an agent: open every folded branch above it (each as a cancelable ui-toggle; uncontrolled, the tree opens
   * them itself) and move focus to it once it is on screen.
   */
  reveal(id: string): void {
    const it = this.#model.byId.get(id);
    if (!it) return;
    const chain: TreeItem[] = [];
    for (let up = it.parent; up; up = up.parent) chain.unshift(up);
    for (const anc of chain) if (!this.#isOpen(anc.id)) this.#toggle(anc.id, true, false);
    this.#active = id;
    this.#pendingFocus = id;
    this.renderNow();
  }

  get #lang(): AgentTreeLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  get #t(): AgentTreeStrings {
    return agentTreeStrings(this.#lang);
  }

  get #controlledOpen(): boolean {
    return Array.isArray(this.data?.expanded);
  }

  #isOpen(id: string): boolean {
    const d = this.data;
    if (d && Array.isArray(d.expanded)) {
      if (d.expanded !== this.#expRef) {
        this.#expRef = d.expanded;
        this.#expSet = new Set(d.expanded.map(String));
      }
      return this.#expSet.has(id);
    }
    return !this.#closed.has(id);
  }

  #now(): number {
    const n = this.data?.now;
    return typeof n === 'number' && Number.isFinite(n) ? n : Date.now();
  }

  #visible(): TreeItem[] {
    return visibleItems(this.#model, (it) => this.#isOpen(it.id));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  protected render(): string {
    const d = this.data;
    if (!d) return '';
    const t = this.#t;
    // Where the tab stop was, nearest first: if that agent is gone, its closest ancestor still here takes the stop.
    const was: string[] = [];
    for (let it = this.#model.byId.get(this.#active); it; it = it.parent ?? undefined) was.push(it.id);
    const model = buildTree(d.nodes);
    this.#model = model;
    const density: AgentTreeDensity = d.density === 'compact' ? 'compact' : 'rich';
    const now = this.#now();
    const visible = this.#visible();
    const ids = new Set(visible.map((it) => it.id));
    const selected = this.selectedId;
    // The one tab stop: where the reader was (or its nearest ancestor still on screen), else the selection, else the first.
    const stop =
      nearestVisible(model.byId.get(was.find((id) => model.byId.has(id)) ?? this.#active), ids)?.id ??
      nearestVisible(selected === null ? undefined : model.byId.get(selected), ids)?.id ??
      visible[0]?.id ??
      '';
    this.#active = stop;
    const at = typeof performance !== 'undefined' ? performance.now() : Date.now();
    for (const [id, when] of this.#born) if (at - when > NEW_MS) this.#born.delete(id);
    if (this.#rendered) for (const id of ids) if (!this.#shown.has(id)) this.#born.set(id, at);
    this.#shown = ids;
    this.#rendered = true;

    const title = d.title === null ? null : d.title === undefined || d.title === '' ? t.title : String(d.title);
    const ctx: Ctx = {
      t,
      density,
      now,
      axis:
        density === 'rich'
          ? spanAxis(
              model.all.map((it) => it.node),
              now,
            )
          : null,
      selected,
      stop,
      open: (id) => this.#isOpen(id),
      fresh: new Set(this.#born.keys()),
    };
    const bar = title === null ? '' : this.#bar(title, t);
    if (!model.all.length)
      return `<div class="at" data-density="${density}">${bar}<p class="at-empty">${esc(t.empty)}</p></div>`;
    let items = '';
    for (const r of model.roots) items += this.#item(r, model.roots.length, ctx);
    const axis = ctx.axis
      ? `<div class="at-axis" aria-hidden="true"><span>0s</span><span class="at-axis-end">${esc(fmtDuration(ctx.axis.t1 - ctx.axis.t0))}</span></div>`
      : '';
    return `<div class="at" data-density="${density}">${bar}<div class="at-wrap" style="--D:${model.depth}">${axis}<ul class="at-tree" role="tree" aria-label="${escAttr(
      title ?? t.title,
    )}">${items}</ul></div></div>`;
  }

  #bar(title: string, t: AgentTreeStrings): string {
    const m = this.#model;
    const c = m.counts;
    let sum = `<span>${esc(t.agents(m.all.length))}</span>`;
    if (c.running) sum += `<span class="at-sum-run">${esc(t.running(c.running))}</span>`;
    for (const s of JUMP) {
      if (!c[s]) continue;
      const label = s === 'needs_you' ? t.needsYou(c[s]) : t.failed(c[s]);
      sum += `<button type="button" class="at-sum-btn" data-jump="${s}" data-key="jump:${s}" title="${escAttr(t.jump(label))}" aria-label="${escAttr(
        t.jump(label),
      )}">${ICON[s]}<span>${esc(label)}</span></button>`;
    }
    const total =
      m.total.costUsd !== undefined
        ? fmtCost(m.total.costUsd)
        : m.total.tokens !== undefined
          ? t.tok(fmtTokens(m.total.tokens))
          : '';
    if (total)
      sum += `<span class="at-sum-cost"><span class="at-amount"${m.total.live ? ' data-live' : ''}>${esc(total)}</span></span>`;
    return `<header class="at-bar"><span class="at-spark">${SPARK}</span><h3 class="at-title" title="${escAttr(title)}">${esc(
      title,
    )}</h3><div class="at-sum">${sum}</div></header>`;
  }

  #item(it: TreeItem, size: number, ctx: Ctx): string {
    const n = it.node;
    const t = ctx.t;
    const kids = it.children.length > 0;
    const open = kids && ctx.open(it.id);
    const dur = durationOf(n, ctx.now);
    const timeId = `at-t-${idPart(it.id)}`;
    const reason = (n.status === 'needs_you' || n.status === 'failed') && n.reason ? n.reason : '';
    const line = ctx.density === 'rich' || LINE.has(n.status) ? n.summary : '';
    const cost = kids ? it.branch.costUsd : n.costUsd;
    const tokens = kids ? it.branch.tokens : n.tokens;
    const tools = kids ? it.branch.toolCalls : n.toolCalls;

    const say = [n.name];
    if (n.role) say.push(n.role);
    say.push(t.status[n.status]);
    if (reason) say.push(reason);
    else if (line) say.push(line);
    if (cost !== undefined) say.push(kids ? t.branchCost(fmtCost(cost), fmtCost(n.costUsd ?? 0)) : fmtCost(cost));
    if (ctx.density === 'rich') {
      if (tokens !== undefined) say.push(t.tok(fmtTokens(tokens)));
      if (tools !== undefined) say.push(t.tools(tools));
    }
    const worst = it.branch.worst;
    if (kids && !open) {
      say.push(t.folded(it.branch.below));
      if (worst && LOUD.has(worst)) say.push(t.worstBelow(t.status[worst]));
    }

    const row =
      ctx.density === 'rich'
        ? this.#card(it, ctx, { open, dur, timeId, reason, cost, tokens, tools })
        : this.#row(it, ctx, { open, dur, timeId, reason, line, cost });
    let kidsHtml = '';
    if (open) {
      kidsHtml = '<ul class="at-kids" role="group">';
      for (const c of it.children) kidsHtml += this.#item(c, it.children.length, ctx);
      kidsHtml += '</ul>';
    }
    const id = escAttr(it.id);
    return `<li class="at-item is-${n.status}${ctx.fresh.has(it.id) ? ' is-new' : ''}" role="treeitem" data-key="n:${id}" data-id="${id}" aria-level="${
      it.depth + 1
    }" aria-setsize="${size}" aria-posinset="${it.index + 1}"${kids ? ` aria-expanded="${open}"` : ''} aria-selected="${
      ctx.selected === it.id
    }" tabindex="${ctx.stop === it.id ? 0 : -1}" aria-label="${escAttr(say.join(', '))}"${
      dur !== undefined ? ` aria-describedby="${timeId}"` : ''
    } style="--d:${it.depth}">${row}${kidsHtml}</li>`;
  }

  #time(it: TreeItem, dur: number | undefined, timeId: string): string {
    if (dur === undefined) return '';
    const tick = ticks(it.node) ? ` data-tick="${escAttr(it.id)}"` : '';
    return `<span class="at-time" id="${timeId}"${tick}>${esc(fmtDuration(dur))}</span>`;
  }

  #costHtml(it: TreeItem, cost: number | undefined, t: AgentTreeStrings): string {
    if (cost === undefined) return '';
    const kids = it.children.length > 0;
    const tip = kids
      ? ` title="${escAttr(`${t.branchTip(it.branch.below)} — ${t.own(fmtCost(it.node.costUsd ?? 0))}`)}"`
      : '';
    return `<span class="at-cost"${tip}><span class="at-amount"${it.branch.live ? ' data-live' : ''}>${esc(fmtCost(cost))}</span></span>`;
  }

  /** The folded branch's badge: how many it hides, tinted (and iconed) by the most urgent status below. */
  #more(it: TreeItem, t: AgentTreeStrings, cls: string, open: boolean): string {
    const worst = it.branch.worst;
    const loud = worst && LOUD.has(worst) ? worst : '';
    if (open)
      return `<span class="${cls}" data-toggle aria-hidden="true" title="${escAttr(t.below(it.children.length))}">${esc(
        String(it.children.length),
      )}${CHEV}</span>`;
    return `<span class="${cls} is-folded"${loud ? ` data-worst="${loud}"` : ''} data-toggle aria-hidden="true" title="${escAttr(
      t.folded(it.branch.below) + (loud ? ` — ${t.worstBelow(t.status[loud as AgentTreeStatus])}` : ''),
    )}">${loud ? ICON[loud as AgentTreeStatus] : ''}+${esc(String(it.branch.below))}${CHEV}</span>`;
  }

  #row(
    it: TreeItem,
    ctx: Ctx,
    o: { open: boolean; dur?: number; timeId: string; reason: string; line: string; cost?: number },
  ): string {
    const n = it.node;
    const t = ctx.t;
    const kids = it.children.length > 0;
    const chev = kids
      ? `<span class="at-chev is-toggle" data-toggle aria-hidden="true">${CHEV}</span>`
      : '<span class="at-chev"></span>';
    let meta = `<span class="at-st">${esc(t.status[n.status])}</span>${this.#time(it, o.dur, o.timeId)}${this.#costHtml(it, o.cost, t)}`;
    if (kids && !o.open) meta += this.#more(it, t, 'at-more', false);
    const sub = o.reason
      ? `<span class="at-line is-reason" title="${escAttr(o.reason)}">${esc(o.reason)}</span>`
      : o.line
        ? `<span class="at-line" title="${escAttr(o.line)}">${esc(o.line)}</span>`
        : '';
    return `<div class="at-row">${chev}<span class="at-icon" aria-hidden="true">${ICON[n.status]}</span><span class="at-body"><span class="at-head"><span class="at-who"><span class="at-name" title="${escAttr(
      n.name,
    )}">${esc(n.name)}</span>${n.role ? `<span class="at-role" title="${escAttr(n.role)}">${esc(n.role)}</span>` : ''}</span><span class="at-meta">${meta}</span></span>${sub}</span></div>`;
  }

  #card(
    it: TreeItem,
    ctx: Ctx,
    o: {
      open: boolean;
      dur?: number;
      timeId: string;
      reason: string;
      cost?: number;
      tokens?: number;
      tools?: number;
    },
  ): string {
    const n = it.node;
    const t = ctx.t;
    let meta = this.#costHtml(it, o.cost, t) + this.#time(it, o.dur, o.timeId);
    if (o.tokens !== undefined) meta += `<span class="at-tok">${esc(t.tok(fmtTokens(o.tokens)))}</span>`;
    if (o.tools !== undefined) meta += `<span class="at-tools">${esc(t.tools(o.tools))}</span>`;
    const fold = it.children.length ? this.#more(it, t, 'at-fold', o.open) : '';
    const span = ctx.axis ? spanOf(n, ctx.axis, ctx.now) : null;
    const bar = span
      ? `<span class="at-span" aria-hidden="true"><i data-span="${escAttr(it.id)}"${span.open ? ' data-open' : ''} style="left:${
          span.left
        }%;width:${span.width}%"></i></span>`
      : '';
    return `<div class="at-row at-card"><div class="at-top"><span class="at-avatar" aria-hidden="true">${esc(
      agentInitials(n.name),
    )}</span><span class="at-who"><span class="at-name" title="${escAttr(n.name)}">${esc(n.name)}</span>${
      n.role ? `<span class="at-role" title="${escAttr(n.role)}">${esc(n.role)}</span>` : ''
    }</span><span class="at-pill">${ICON[n.status]}<span>${esc(t.status[n.status])}</span></span></div>${
      n.summary ? `<p class="at-task" title="${escAttr(n.summary)}">${esc(n.summary)}</p>` : ''
    }${o.reason ? `<p class="at-reason">${esc(o.reason)}</p>` : ''}${
      meta || fold ? `<div class="at-meta">${meta}${fold}</div>` : ''
    }${bar}</div>`;
  }

  // ── Morph + after-render ──────────────────────────────────────────────────

  /** Morph instead of replacing: the focused item, spinners and transitions survive a live update. */
  protected override update(): void {
    let had: HTMLElement | null = null;
    try {
      const a = this.root.activeElement as HTMLElement | null;
      had = a && this.content.contains(a) ? a : null;
    } catch {
      had = null;
    }
    const key = had?.dataset?.key;
    const tpl = document.createElement('template');
    tpl.innerHTML = this.render();
    morphChildren(this.content, tpl.content);
    this.updated();
    if (this.#pendingFocus) {
      const el = this.#els.get(this.#pendingFocus);
      if (el) {
        this.#pendingFocus = '';
        el.focus({ preventScroll: false });
        return;
      }
    }
    if (!had || this.root.activeElement === had) return;
    const next =
      had.isConnected && this.content.contains(had)
        ? had
        : key === undefined
          ? undefined
          : Array.from(this.content.querySelectorAll<HTMLElement>('[data-key]')).find((el) => el.dataset.key === key);
    (next ?? this.focusFallback())?.focus({ preventScroll: true });
  }

  /** The focused agent left (or a branch above it was folded by the host): its nearest ancestor on screen takes focus. */
  protected override focusFallback(): HTMLElement | null {
    return this.#els.get(this.#active) ?? null;
  }

  protected override updated(): void {
    this.#els.clear();
    for (const li of this.$$<HTMLElement>('.at-item[data-id]')) this.#els.set(li.dataset.id ?? '', li);
    const byId = this.#model.byId;
    this.#ticks = [];
    for (const el of this.$$<HTMLElement>('.at-time[data-tick]')) {
      const item = byId.get(el.dataset.tick ?? '');
      const text = textOf(el);
      if (item && text) this.#ticks.push({ text, item });
    }
    this.#spans = [];
    for (const el of this.$$<HTMLElement>('.at-span > i[data-span]')) {
      const item = byId.get(el.dataset.span ?? '');
      if (item) this.#spans.push({ el, item });
    }
    this.#axisEnd = textOf(this.$('.at-axis-end'));
    const d = this.data;
    const live = this.isConnected && !!d && d.now === undefined && this.#model.all.some((it) => ticks(it.node));
    if (live) onTick(this.#tickFn);
    else offTick(this.#tickFn);
    this.#announce();
  }

  /** One tick: running times and the waterfall move in place (text nodes and two style values — no render). */
  #tick(): void {
    if (!this.isConnected) {
      offTick(this.#tickFn);
      return;
    }
    const now = Date.now();
    for (const { text, item } of this.#ticks) {
      const ms = durationOf(item.node, now);
      const s = ms === undefined ? '' : fmtDuration(ms);
      if (text.data !== s) text.data = s;
    }
    if (!this.#spans.length && !this.#axisEnd) return;
    const axis = spanAxis(
      this.#model.all.map((it) => it.node),
      now,
    );
    if (!axis) return;
    if (this.#axisEnd) {
      const s = fmtDuration(axis.t1 - axis.t0);
      if (this.#axisEnd.data !== s) this.#axisEnd.data = s;
    }
    for (const { el, item } of this.#spans) {
      const sp = spanOf(item.node, axis, now);
      if (!sp) continue;
      el.style.left = `${sp.left}%`;
      el.style.width = `${sp.width}%`;
    }
  }

  /** The bar's counts are said politely when they change (not the first time, and not for every cent). */
  #announce(): void {
    const c = this.#model.counts;
    const t = this.#t;
    const parts = [t.agents(this.#model.all.length)];
    if (c.running) parts.push(t.running(c.running));
    if (c.needs_you) parts.push(t.needsYou(c.needs_you));
    if (c.failed) parts.push(t.failed(c.failed));
    const text = parts.join(', ');
    if (text === this.#said) return;
    const first = this.#said === '';
    this.#said = text;
    if (!first && this.#live.textContent !== text) this.#live.textContent = text;
  }

  // ── Interaction ───────────────────────────────────────────────────────────

  #setStop(id: string): void {
    if (!id || id === this.#active) {
      this.#active = id || this.#active;
      return;
    }
    this.#els.get(this.#active)?.setAttribute('tabindex', '-1');
    this.#active = id;
    this.#els.get(id)?.setAttribute('tabindex', '0');
  }

  #moveTo(id: string | undefined): void {
    if (!id) return;
    const el = this.#els.get(id);
    if (!el) return;
    this.#setStop(id);
    el.focus();
  }

  #onClick(e: MouseEvent): void {
    const t = e.target as Element | null;
    const jump = t?.closest?.<HTMLElement>('[data-jump]');
    if (jump) {
      this.#jump(jump.dataset.jump as AgentTreeStatus);
      return;
    }
    const item = t?.closest?.<HTMLElement>('.at-item[data-id]');
    const row = t?.closest?.('.at-row');
    // Only a click on the item's own row: the area of its children belongs to them.
    if (!item || !row || row.parentElement !== item) return;
    const id = item.dataset.id ?? '';
    const it = this.#model.byId.get(id);
    if (!it) return;
    this.#setStop(id);
    if (t?.closest?.('[data-toggle]') && it.children.length) {
      this.#toggle(id, !this.#isOpen(id), true);
      return;
    }
    this.#select(id);
  }

  #onKey(e: KeyboardEvent): void {
    const item = (e.target as Element | null)?.closest?.<HTMLElement>('.at-item[data-id]');
    if (!item || e.target !== item || e.altKey || e.ctrlKey || e.metaKey) return;
    const id = item.dataset.id ?? '';
    const it = this.#model.byId.get(id);
    if (!it) return;
    const kids = it.children.length > 0;
    const open = kids && this.#isOpen(id);
    const act = treeKeyAction(e.key, { hasKids: kids, open, hasParent: !!it.parent });
    if (!act) {
      if (e.key.length === 1 && e.key.trim()) {
        e.preventDefault();
        this.#typeahead(e.key, id);
      }
      return;
    }
    e.preventDefault();
    const vis = this.#visible();
    const at = vis.findIndex((v) => v.id === id);
    switch (act) {
      case 'next':
        this.#moveTo(vis[Math.min(vis.length - 1, at + 1)]?.id);
        return;
      case 'prev':
        this.#moveTo(vis[Math.max(0, at - 1)]?.id);
        return;
      case 'first':
        this.#moveTo(vis[0]?.id);
        return;
      case 'last':
        this.#moveTo(vis[vis.length - 1]?.id);
        return;
      case 'child':
        this.#moveTo(it.children[0]?.id);
        return;
      case 'parent':
        this.#moveTo(it.parent?.id);
        return;
      case 'expand':
      case 'collapse':
        this.#toggle(id, act === 'expand', true);
        return;
      case 'siblings': {
        const sibs = it.parent ? it.parent.children : this.#model.roots;
        let any = false;
        for (const s of sibs)
          if (s.children.length && !this.#isOpen(s.id)) any = this.#toggle(s.id, true, false) || any;
        if (any) this.renderNow();
        return;
      }
      case 'select':
        this.#select(id);
        return;
    }
  }

  /** Type-ahead: letters typed in quick succession find the next agent whose name starts with them. */
  #typeahead(key: string, from: string): void {
    const at = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const q = at - this.#ta.at > AGENT_TREE_TYPEAHEAD_MS ? key : this.#ta.q + key;
    this.#ta = { q, at };
    // The same letter again cycles through the names that start with it.
    const query = [...q].every((c) => c.toLocaleLowerCase() === key.toLocaleLowerCase()) ? key : q;
    const vis = this.#visible();
    const i = typeaheadIndex(
      vis.map((v) => v.node.name),
      vis.findIndex((v) => v.id === from),
      query,
    );
    if (i >= 0) this.#moveTo(vis[i].id);
  }

  /** A pick leaves as ui-select (cancelable); uncontrolled, the tree moves its own selection. */
  #select(id: string): void {
    if (!this.emit<AgentTreeSelectDetail>('ui-select', { id })) return;
    if (this.data?.selectedId === undefined && this.#selected !== id) {
      this.#selected = id;
      this.renderNow();
    }
  }

  /** A fold leaves as ui-toggle (cancelable); uncontrolled, the tree folds itself. Returns whether it went ahead. */
  #toggle(id: string, open: boolean, render: boolean): boolean {
    this.#active = id;
    if (!this.emit<AgentTreeToggleDetail>('ui-toggle', { id, expanded: open })) return false;
    if (this.#controlledOpen) return true;
    if (open) this.#closed.delete(id);
    else this.#closed.add(id);
    if (render) this.renderNow();
    return true;
  }

  /** The bar's “needs you” / “failed”: the next such agent after the selected one — shown, selected and focused. */
  #jump(status: AgentTreeStatus): void {
    const all = this.#model.all;
    const list = all.filter((it) => it.node.status === status);
    if (!list.length) return;
    const from = all.findIndex((it) => it.id === this.selectedId);
    const next = list.find((it) => all.indexOf(it) > from) ?? list[0];
    this.reveal(next.id);
    this.#select(next.id);
  }
}

define('ui-agent-tree', UiAgentTree);

declare global {
  interface HTMLElementTagNameMap {
    'ui-agent-tree': UiAgentTree;
  }
}
