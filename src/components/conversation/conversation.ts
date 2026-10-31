import { activityCss, rawViewHtml, skillBadgesHtml, sysBadgeHtml } from '../../core/activity';
import { copyText } from '../../core/clipboard';
import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { esc, escAttr } from '../../core/html';
import { icon } from '../../icons/icons';
import { answerTookLabel, type UiAiAnswer } from '../ai-answer/ai-answer';
import '../log-scroller/log-scroller';
import type { LogLoadOlderDetail, LogScrollerData, UiLogScroller } from '../log-scroller/log-scroller';
import {
  type ConversationCopyDetail,
  type ConversationData,
  type ConversationLang,
  type ConversationLoadDetail,
  type ConversationRetryDetail,
  type ConversationStrings,
  type ConversationTurn,
  clampLinesOf,
  clampOverflows,
  clockText,
  conversationStrings,
  hasSummaryView,
  initialOf,
  normalizeTurns,
  planTurns,
  progressState,
  summaryText,
  summaryView,
  type TurnProgress,
  tookText,
  turnAnswerData,
  turnSignature,
  turnSource,
  turnTime,
} from './logic';
import { styles } from './styles';

/** How long a Copy button says "Copied". */
export const CONVERSATION_COPIED_MS = 1500;

type RawFrom = Exclude<ConversationCopyDetail['from'], 'answer'>;
type AnswerView = 'summary' | 'source';

/** What the reader did to one turn — kept across that turn's re-renders. */
interface TurnUi {
  /** Id fragment for ids and `data-key` (turn ids may hold any character). */
  dom: string;
  /** What the turn looked like when its node was built. */
  sig?: string;
  /** Arrived live (after the first page): the answer plays its entry motion. */
  live?: boolean;
  /** user: the instruction shown whole. */
  full?: boolean;
  /** user: the open skill chip. */
  skill?: number | null;
  /** assistant: Raw open, and which view. */
  raw?: boolean;
  view?: AnswerView;
  /** system: open to its facts. */
  open?: boolean;
}

interface Ctx {
  lang: ConversationLang;
  t: ConversationStrings;
  assistant: string;
  clamp: number;
}

const SKELETON = [
  ['34%', '88%', '62%'],
  ['26%', '94%', '78%', '48%'],
  ['30%', '70%'],
]
  .map(
    (lines) =>
      `<div class="cv-sk-turn"><span class="cv-sk-av"></span><span class="cv-sk-lines">${lines
        .map((w) => `<span class="cv-sk-line" style="width:${w}"></span>`)
        .join('')}</span></div>`,
  )
  .join('');

/** The element with this `data-key` under `root` (compared as data, not built into a selector). */
function byKey(root: ParentNode, key: string): HTMLElement | null {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-key]')).find((el) => el.dataset.key === key) ?? null;
}

/** Replace an element's markup; a focused control inside keeps focus by its `data-key`. */
function swap(el: Element, html: string, root: ShadowRoot): void {
  const active = root.activeElement as HTMLElement | null;
  const key = active && el.contains(active) ? active.dataset.key : undefined;
  el.innerHTML = html;
  if (key !== undefined) byKey(el, key)?.focus({ preventScroll: true });
}

/** Set a text node's value in place (the node stays the same object). */
function setText(el: Element | null, value: string): void {
  if (!el) return;
  const n = el.firstChild;
  if (n && n.nodeType === 3 && !n.nextSibling) {
    if (n.nodeValue !== value) n.nodeValue = value;
  } else el.textContent = value;
}

function setAttr(el: Element, name: string, value: string | null): void {
  if (value === null) el.removeAttribute(name);
  else if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

/** The progress row's numbers at `now`. */
function progressNumbers(p: TurnProgress, now: number, t: ConversationStrings) {
  const s = progressState(p, now);
  const elapsed = clockText(s.elapsed);
  const est = s.estimate ? t.of(clockText(s.estimate)) : '';
  const indet = !s.estimate || s.over;
  const pct = s.pct ?? 0;
  const showPct = s.pct !== null && !s.over;
  const text = `${elapsed}${est ? ` ${est}` : ''}${s.over ? ` — ${t.over}` : showPct ? `, ${pct}%` : ''}`;
  return { s, elapsed, est, indet, pct, showPct, text };
}

/** One tick of a progress row: text nodes, the bar's width and the ARIA values change in place. */
function paintProgress(el: HTMLElement, now: number, t: ConversationStrings): void {
  const p: TurnProgress = { startedAt: Number(el.dataset.start), estimateMs: Number(el.dataset.est) || 0 };
  const n = progressNumbers(p, now, t);
  setText(el.querySelector('.cv-elapsed'), n.elapsed);
  const pct = el.querySelector<HTMLElement>('.cv-pct');
  if (pct) {
    setText(pct, `${n.pct}%`);
    if (pct.hidden === n.showPct) pct.hidden = !n.showPct;
  }
  const over = el.querySelector<HTMLElement>('.cv-over');
  if (over && over.hidden === n.s.over) over.hidden = !n.s.over;
  const bar = el.querySelector<HTMLElement>('.cv-bar');
  if (bar && bar.hasAttribute('data-indet') !== n.indet) bar.toggleAttribute('data-indet', n.indet);
  const fill = bar?.firstElementChild as HTMLElement | null;
  const width = `${n.indet ? 100 : n.pct}%`;
  if (fill && fill.style.width !== width) fill.style.width = width;
  setAttr(el, 'aria-valuenow', n.showPct ? String(n.pct) : null);
  setAttr(el, 'aria-valuetext', n.text);
}

/**
 * `<ui-conversation>` — a conversation with an agent: the person's instructions, the assistant's answers and the
 * turns the system put there, newest at the bottom, in a `<ui-log-scroller>` that follows new turns and never moves
 * what the reader is on. Turns are nodes keyed by id: a data change rebuilds only the turns whose data changed;
 * older turns are prepended without a jump; new ones are appended live. Answers render in a nested `<ui-ai-answer>`.
 */
export class UiConversation extends UiElement<ConversationData> {
  static override styles = [activityCss, styles];
  static get observedAttributes() {
    return ['lang'];
  }

  #log: UiLogScroller | null = null;
  #bar: HTMLElement | null = null;
  #state: HTMLElement | null = null;
  #ctx: Ctx = { lang: 'en', t: conversationStrings('en'), assistant: '', clamp: 12 };
  /** The turns of the last data, by id (the writing row included). */
  #turns = new Map<string, ConversationTurn>();
  #ui = new Map<string, TurnUi>();
  #seq = 0;
  /** Key of the writing row shown, if any. */
  #pendingKey: string | null = null;
  #logKey = '';
  #barHtml = '';
  #stateHtml = '';
  /** data.now − Date.now(): the host's clock. */
  #skew = 0;
  #timer: ReturnType<typeof setInterval> | 0 = 0;
  /** `id\nfrom` of the Copy that just copied. */
  #copied = '';
  #copyTimer: ReturnType<typeof setTimeout> | 0 = 0;
  #ro: ResizeObserver | null = null;
  #remeasure = false;

  constructor() {
    super();
    this.root.addEventListener('click', (e) => this.#onClick(e));
    this.root.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    this.root.addEventListener('transitionend', (e) => this.#onTransitionEnd(e as TransitionEvent));
    // A nested answer's Try again / Copy leave with the turn's id.
    this.root.addEventListener('ui-retry', (e) => this.#fromAnswer(e, 'retry'));
    this.root.addEventListener('ui-load', (e) => this.#fromAnswer(e, 'load'));
    this.root.addEventListener('ui-copy', (e) => this.#fromAnswer(e, 'copy'));
    // The scroller's request for older turns leaves from this element (cancelable through).
    this.root.addEventListener('ui-load-older', (e) => this.#fromLog(e));
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override disconnectedCallback(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = 0;
    if (this.#copyTimer) clearTimeout(this.#copyTimer);
    this.#copyTimer = 0;
    this.#copied = '';
    this.#ro?.disconnect();
    this.#ro = null;
    this.#remeasure = true;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** The node of the turn with this id (or the writing row), null when not shown. */
  turnElement(id: string): HTMLElement | null {
    return this.#log?.itemFor(String(id)) ?? null;
  }

  /** Go to the newest turn (smooth unless reduced motion or `smooth: false`). */
  scrollToLatest(opts: { smooth?: boolean } = {}): void {
    this.#log?.scrollToLatest(opts);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  get #lang(): ConversationLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  /** The shell is built once (an error bar and the scroller); turns are nodes the scroller keeps, never a string. */
  protected render(): string {
    return '';
  }

  protected override update(): void {
    if (!this.#log) this.#build();
    this.#sync();
  }

  #build(): void {
    const bar = document.createElement('div');
    bar.className = 'cv-errbar';
    bar.setAttribute('part', 'error');
    bar.setAttribute('role', 'alert');
    bar.hidden = true;
    const log = document.createElement('ui-log-scroller');
    log.className = 'cv-log';
    log.setAttribute('part', 'log');
    const sk = document.createElement('div');
    sk.slot = 'loading';
    sk.className = 'cv-sk';
    sk.setAttribute('aria-hidden', 'true');
    sk.innerHTML = SKELETON;
    const state = document.createElement('div');
    state.slot = 'empty';
    log.append(sk, state);
    this.#bar = bar;
    this.#log = log;
    this.#state = state;
    this.content.replaceChildren(bar, log);
  }

  #sync(): void {
    const log = this.#log;
    if (!log) return;
    const d: ConversationData = this.data ?? { turns: [] };
    const lang = this.#lang;
    const t = conversationStrings(lang);
    const clamp = clampLinesOf(d.clampLines);
    this.#ctx = { lang, t, assistant: String(d.assistantName || t.assistant), clamp };
    const now = Number(d.now);
    this.#skew = Number.isFinite(now) && now > 0 ? now - Date.now() : 0;
    const { regular, pending } = normalizeTurns(d.turns, d.pending);
    this.#turns = new Map(regular.map((x) => [x.id, x]));
    if (pending) this.#turns.set(pending.id, pending);
    this.#syncChrome(d, !regular.length && !pending);

    const ctx = `${lang}\n${this.#ctx.assistant}\n${clamp}\n`;
    const next = regular.map((x) => x.id);
    const wanted = new Set(next);
    // The writing row goes when it is off, keyed anew, or its key now names a turn.
    if (this.#pendingKey && (!pending || pending.id !== this.#pendingKey || wanted.has(this.#pendingKey))) {
      this.#drop(this.#pendingKey);
      this.#pendingKey = null;
    }
    const current = log.items.map((el) => el.dataset.item ?? '').filter((k) => k !== this.#pendingKey);
    const plan = planTurns(current, next);
    const measure: HTMLElement[] = [];
    const make = (id: string, live: boolean) => {
      const turn = this.#turns.get(id) as ConversationTurn;
      const node = this.#make(turn, live, ctx + turnSignature(turn));
      if (turn.role === 'user') measure.push(node);
      return node;
    };

    if (plan.reset) {
      for (const el of log.items) this.#unobserve(el);
      log.clearItems();
      for (const k of current) this.#ui.delete(k);
      if (this.#pendingKey) this.#ui.delete(this.#pendingKey);
      this.#pendingKey = null;
    } else for (const k of plan.remove) this.#drop(k);

    // Turns that stay: only one whose data changed is rebuilt (upserted in place).
    if (!plan.first)
      for (const k of current) {
        const turn = wanted.has(k) ? this.#turns.get(k) : undefined;
        if (!turn) continue;
        const sig = ctx + turnSignature(turn);
        if (sig === this.#ui.get(k)?.sig) continue;
        const node = this.#replace(turn, sig);
        if (turn.role === 'user') measure.push(node);
      }
    // History above (no motion, the reader's place kept), the odd turn between, live turns below.
    if (plan.prepend.length)
      log.prependItems(
        plan.prepend.map((k) => make(k, false)),
        { hasMore: !!d.hasMore },
      );
    for (const [k, before] of plan.insert) {
      const node = make(k, false);
      const ref = log.itemFor(before);
      if (ref) log.insertBefore(node, ref);
      else log.appendItems(node, { animate: false });
    }
    if (plan.append.length)
      log.appendItems(
        plan.append.map((k) => make(k, !plan.first)),
        { animate: !plan.first },
      );

    // The writing row: always last.
    if (pending) {
      const sig = ctx + turnSignature(pending);
      if (!this.#pendingKey || !log.itemFor(this.#pendingKey)) {
        const live = log.items.length > 0;
        log.appendItems(this.#make(pending, live, sig), { unread: 0, animate: live });
        this.#pendingKey = pending.id;
      } else if (sig !== this.#ui.get(pending.id)?.sig) this.#replace(pending, sig);
      const row = log.itemFor(pending.id);
      const items = log.items;
      if (row && items[items.length - 1] !== row) log.append(row);
    }

    if (this.#remeasure) {
      this.#remeasure = false;
      for (const el of log.items) if (el.dataset.role === 'user' && !measure.includes(el)) measure.push(el);
    }
    for (const node of measure) this.#measure(node);
    this.#syncTicker();
  }

  /** The error bar, the state slot (empty text or the error box) and the scroller's own data. */
  #syncChrome(d: ConversationData, empty: boolean): void {
    const log = this.#log as UiLogScroller;
    const { lang, t } = this.#ctx;
    if (lang === 'ko') setAttr(log, 'lang', 'ko');
    else log.removeAttribute('lang');
    const error = d.error ? String(d.error) : '';
    const retry =
      d.canRetry !== false
        ? `<button type="button" class="cv-btn" data-act="retry" data-key="retry">${icon('refresh')}<span>${esc(t.retry)}</span></button>`
        : '';
    const detail = error ? `<span class="cv-err-detail"> (${esc(error)})</span>` : '';
    const barHtml =
      error && !empty ? `${icon('alert')}<span class="cv-err-text">${esc(t.failedSome)}${detail}</span>${retry}` : '';
    if (barHtml !== this.#barHtml && this.#bar) {
      this.#barHtml = barHtml;
      swap(this.#bar, barHtml, this.root);
      this.#bar.hidden = !barHtml;
    }
    const stateHtml =
      error && empty
        ? `<div class="cv-state cv-fail" role="alert">${icon('alert')}<span class="cv-err-text">${esc(t.failed)}${detail}</span>${retry}</div>`
        : `<div class="cv-state">${icon('chat')}<span>${esc(d.emptyText || t.empty)}</span></div>`;
    if (stateHtml !== this.#stateHtml && this.#state) {
      this.#stateHtml = stateHtml;
      swap(this.#state, stateHtml, this.root);
    }
    const ld: LogScrollerData = {
      hasMore: !!d.hasMore,
      loading: !!d.loading && !(error && empty),
      label: String(d.label || t.label),
      startText: d.startText ?? t.start,
      live: d.live,
    };
    // A new scroller data object settles an older page it asked for: only when something it shows changed.
    const key = `${JSON.stringify(ld)}\n${error}`;
    if (key !== this.#logKey) {
      this.#logKey = key;
      log.data = ld;
    }
  }

  #uiOf(id: string): TurnUi {
    let st = this.#ui.get(id);
    if (!st) {
      this.#seq++;
      st = { dom: `t${this.#seq}` };
      this.#ui.set(id, st);
    }
    return st;
  }

  /** Remove a turn's node and forget what the reader did to it. */
  #drop(id: string): void {
    const log = this.#log as UiLogScroller;
    this.#unobserve(log.itemFor(id));
    log.removeItem(id);
    this.#ui.delete(id);
  }

  /** A fresh node for a turn. `withAnswer` false: the caller moves the turn's existing answer in. */
  #make(turn: ConversationTurn, live: boolean, sig: string, withAnswer = true): HTMLElement {
    const st = this.#uiOf(turn.id);
    st.sig = sig;
    if (live) st.live = true;
    const node = document.createElement('article');
    node.className = 'cv-turn';
    node.dataset.item = turn.id;
    node.dataset.role = turn.role;
    const time = turnTime(turn.at, this.#ctx.lang);
    node.setAttribute('aria-labelledby', time ? `${st.dom}-n ${st.dom}-t` : `${st.dom}-n`);
    if (turn.role === 'pending' || turn.streaming || turn.loading) node.setAttribute('aria-busy', 'true');
    node.innerHTML = this.#turnHtml(turn, st);
    if (withAnswer) this.#placeAnswer(node, turn, st, null);
    return node;
  }

  /** Rebuild one turn: upsert its new node (the scroller keeps the reader's place) and carry its answer over. */
  #replace(turn: ConversationTurn, sig: string): HTMLElement {
    const log = this.#log as UiLogScroller;
    const st = this.#uiOf(turn.id);
    const old = log.itemFor(turn.id);
    const node = this.#make(turn, !!st.live, sig, false);
    const answer = old?.querySelector<UiAiAnswer>('.cv-answer > ui-ai-answer') ?? null;
    const focus = this.#focusIn(old);
    this.#unobserve(old);
    log.upsertItem(turn.id, node);
    this.#placeAnswer(node, turn, st, answer);
    if (focus?.key !== undefined) byKey(node, focus.key)?.focus({ preventScroll: true });
    else if (focus?.inner !== undefined) {
      const sr = node.querySelector('ui-ai-answer')?.shadowRoot;
      if (sr) byKey(sr, focus.inner)?.focus({ preventScroll: true });
    }
    return node;
  }

  #focusIn(node: Element | null): { key?: string; inner?: string } | null {
    const active = this.root.activeElement as HTMLElement | null;
    if (!node || !active || !node.contains(active)) return null;
    if (active.tagName === 'UI-AI-ANSWER') {
      const inner = active.shadowRoot?.activeElement as HTMLElement | null | undefined;
      return { inner: inner?.dataset?.key };
    }
    return { key: active.dataset.key };
  }

  /** The nested `<ui-ai-answer flat>` of an assistant turn or the writing row. */
  #placeAnswer(node: HTMLElement, turn: ConversationTurn, st: TurnUi, existing: UiAiAnswer | null): void {
    const box = node.querySelector('.cv-answer');
    if (!box) return;
    const a = existing ?? document.createElement('ui-ai-answer');
    a.setAttribute('flat', '');
    a.setAttribute('lang', this.#ctx.lang);
    a.data =
      turn.role === 'pending' ? { markdown: '', streaming: true, animate: false } : turnAnswerData(turn, !!st.live);
    box.append(a);
  }

  #nameOf(turn: ConversationTurn): string {
    const { t, assistant } = this.#ctx;
    const own = turn.name === undefined || turn.name === null ? '' : String(turn.name).trim();
    if (own) return own;
    if (turn.role === 'user') return t.user;
    if (turn.role === 'system') return t.system;
    return assistant;
  }

  #turnHtml(turn: ConversationTurn, st: TurnUi): string {
    const { lang } = this.#ctx;
    const name = this.#nameOf(turn);
    const time = turnTime(turn.at, lang);
    const nameHtml = `<span class="cv-name" id="${st.dom}-n">${esc(name)}</span>`;
    const timeHtml = time
      ? `<time class="cv-time" id="${st.dom}-t" datetime="${escAttr(time.iso)}" title="${escAttr(time.full)}">${esc(time.short)}</time>`
      : '';
    if (turn.role === 'user') {
      const av = `<div class="cv-av" aria-hidden="true">${esc(initialOf(name))}</div>`;
      return `${av}<div class="cv-main"><div class="cv-head">${nameHtml}${timeHtml}</div>${this.#userBody(turn, st)}</div>`;
    }
    if (turn.role === 'system') {
      const av = `<div class="cv-av" aria-hidden="true">${icon('gear')}</div>`;
      return `${av}<div class="cv-main">${this.#systemBody(turn, st, nameHtml + timeHtml)}</div>`;
    }
    const av = `<div class="cv-av" aria-hidden="true">${icon('bot')}</div>`;
    if (turn.role === 'pending')
      return `${av}<div class="cv-main"><div class="cv-head">${nameHtml}</div><div class="cv-answer"></div></div>`;
    const took = tookText(turn.responseMs, lang);
    const tookHtml = took
      ? `<span class="cv-took">${icon('clock')}<span class="cv-took-n" aria-hidden="true">${esc(took)}</span><span class="sr-only">${esc(
          answerTookLabel(Number(turn.responseMs), lang),
        )}</span></span>`
      : '';
    const files = turn.attachments
      ? `<div class="cv-files" role="group" aria-label="${escAttr(this.#ctx.t.files)}"><slot name="${escAttr(
          `attachments-${turn.id}`,
        )}"></slot></div>`
      : '';
    return `${av}<div class="cv-main"><div class="cv-head">${nameHtml}${timeHtml}${tookHtml}</div><div class="cv-answer"></div>${files}${this.#rawHtml(
      turn,
      st,
    )}</div>`;
  }

  #userBody(turn: ConversationTurn, st: TurnUi): string {
    const { t, lang, clamp } = this.#ctx;
    const media = turn.media
      ? `<div class="cv-media" role="group" aria-label="${escAttr(t.media)}"><slot name="${escAttr(`media-${turn.id}`)}"></slot></div>`
      : '';
    const text = String(turn.text ?? '');
    const full = !!st.full;
    const words = text
      ? `<div class="cv-text${full ? ' is-full' : ''}" id="${st.dom}-x" data-clamp style="--cv-clamp:${clamp}">${esc(
          text,
        )}</div><button type="button" class="cv-more" data-key="${st.dom}:more" aria-expanded="${full}" aria-controls="${st.dom}-x"${
          full ? '' : ' hidden'
        }>${esc(full ? t.less : t.more)}</button>`
      : '';
    const skills =
      Array.isArray(turn.skills) && turn.skills.length
        ? `<div class="cv-skills">${skillBadgesHtml(turn.skills, { lang, open: st.skill ?? null, keyPrefix: st.dom })}</div>`
        : '';
    return `${media}${words}${skills}`;
  }

  /** Raw's views: the summary and the source as written (none while the answer is still coming). */
  #rawViews(turn: ConversationTurn): AnswerView[] {
    if (turn.streaming || turn.loading) return [];
    const views: AnswerView[] = [];
    // The summary, its failure, or a Retry that asks for one (summary.canRetry).
    if (hasSummaryView(turn.summary)) views.push('summary');
    if (turnSource(turn).trim()) views.push('source');
    return views;
  }

  #rawHtml(turn: ConversationTurn, st: TurnUi): string {
    if (!this.#rawViews(turn).length) return '';
    const open = !!st.raw;
    return `<div class="cv-dbox" data-disc="raw"${open ? ' data-open data-settled' : ''}><button type="button" class="cv-disc" data-act="raw" data-key="${
      st.dom
    }:raw" aria-expanded="${open}" aria-controls="${st.dom}-raw">${icon('chevron-right', { class: 'cv-chev', size: 12 })}<span>${esc(
      this.#ctx.t.raw,
    )}</span></button><div class="cv-region" id="${st.dom}-raw"${open ? '' : ' inert'}><div class="cv-region-in">${
      open ? this.#rawBody(turn, st) : ''
    }</div></div></div>`;
  }

  #rawBody(turn: ConversationTurn, st: TurnUi): string {
    const { t } = this.#ctx;
    const views = this.#rawViews(turn);
    if (!views.length) return '';
    const view = st.view && views.includes(st.view) ? st.view : views[views.length - 1];
    const word = (v: AnswerView) => (v === 'summary' ? t.summary : t.source);
    const head =
      views.length > 1
        ? `<div class="cv-tabs" role="group" aria-label="${escAttr(t.raw)}">${views
            .map(
              (v) =>
                `<button type="button" class="cv-tab" data-view="${v}" data-key="${st.dom}:view:${v}" aria-pressed="${v === view}">${esc(
                  word(v),
                )}</button>`,
            )
            .join('')}</div>`
        : `<p class="cv-raw-h">${esc(word(view))}</p>`;
    return `<div class="cv-detail">${head}${this.#rawView(turn, st, view)}</div>`;
  }

  #rawText(turn: ConversationTurn, from: RawFrom): string {
    if (from === 'summary') return summaryText(turn.summary);
    if (from === 'source') return turnSource(turn);
    return String(turn.raw ?? '');
  }

  #rawView(turn: ConversationTurn, st: TurnUi, from: RawFrom): string {
    return `<div class="cv-rawview" data-from="${from}">${this.#rawViewInner(turn, st, from)}</div>`;
  }

  #rawViewInner(turn: ConversationTurn, st: TurnUi, from: RawFrom): string {
    const view =
      from === 'summary'
        ? summaryView(turn.summary, this.#ctx.t.noSummary)
        : { state: 'ready' as const, text: this.#rawText(turn, from) };
    return rawViewHtml(view, {
      lang: this.#ctx.lang,
      keyPrefix: `${st.dom}:${from}`,
      copied: this.#copied === `${turn.id}\n${from}`,
    });
  }

  #systemBody(turn: ConversationTurn, st: TurnUi, who: string): string {
    const { t, lang } = this.#ctx;
    const p = turn.progress;
    const running = !!p && !p.done && Number.isFinite(Number(p.startedAt));
    const kind = turn.kind === undefined || turn.kind === null ? '' : String(turn.kind);
    const label = turn.label === undefined || turn.label === null ? '' : String(turn.label);
    const badge = kind || label ? sysBadgeHtml(kind, lang, label || undefined) : '';
    const line = String(turn.text ?? '') || (p?.done ? t.done : '');
    const lineHtml = line ? `<span class="cv-line">${esc(line)}</span>` : '';
    const canOpen = this.#facts(turn).length > 0 || String(turn.raw ?? '') !== '' || !!turn.media;
    const open = canOpen && !!st.open;
    const row = canOpen
      ? `<button type="button" class="cv-sys" data-act="sys" data-key="${st.dom}:sys" aria-expanded="${open}" aria-controls="${st.dom}-sys">${who}${badge}${lineHtml}${icon(
          'chevron-right',
          { class: 'cv-chev', size: 12 },
        )}</button>`
      : `<div class="cv-sys">${who}${badge}${lineHtml}</div>`;
    const prog = running ? this.#progressHtml(turn, p as TurnProgress) : '';
    const region = canOpen
      ? `<div class="cv-region" id="${st.dom}-sys"${open ? '' : ' inert'}><div class="cv-region-in">${
          open ? this.#systemDetail(turn, st) : ''
        }</div></div>`
      : '';
    return `<div class="cv-dbox" data-disc="sys"${open ? ' data-open data-settled' : ''}>${row}${prog}${region}</div>`;
  }

  #facts(turn: ConversationTurn): Array<[string, string]> {
    return Array.isArray(turn.facts) ? turn.facts.filter((f) => Array.isArray(f) && f.length >= 2) : [];
  }

  #systemDetail(turn: ConversationTurn, st: TurnUi): string {
    const facts = this.#facts(turn);
    // The files the intercepted message carried: the host's media, first in the detail.
    const media = turn.media
      ? `<div class="cv-media" role="group" aria-label="${escAttr(this.#ctx.t.media)}"><slot name="${escAttr(`media-${turn.id}`)}"></slot></div>`
      : '';
    const dl = facts.length
      ? `<dl class="cv-facts">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`
      : '';
    const raw =
      String(turn.raw ?? '') !== ''
        ? `<div class="cv-sysraw"><p class="cv-raw-h">${esc(this.#ctx.t.rawText)}</p>${this.#rawView(turn, st, 'raw')}</div>`
        : '';
    return `<div class="cv-detail">${media}${dl}${raw}</div>`;
  }

  #progressHtml(turn: ConversationTurn, p: TurnProgress): string {
    const { t } = this.#ctx;
    const verb = String(p.verb || (turn.kind === 'compact' ? t.compacting : t.working));
    const n = progressNumbers(p, Date.now() + this.#skew, t);
    return `<div class="cv-prog" data-prog data-start="${Number(p.startedAt)}" data-est="${n.s.estimate}" role="progressbar" aria-label="${escAttr(
      verb,
    )}" aria-valuemin="0" aria-valuemax="100"${n.showPct ? ` aria-valuenow="${n.pct}"` : ''} aria-valuetext="${escAttr(
      n.text,
    )}"><span class="cv-prog-verb">${esc(verb)}</span><span class="cv-bar"${n.indet ? ' data-indet' : ''} aria-hidden="true"><i style="width:${
      n.indet ? 100 : n.pct
    }%"></i></span><span class="cv-prog-time"><span class="cv-elapsed">${esc(n.elapsed)}</span>${
      n.est ? ` <span class="cv-est">${esc(n.est)}</span>` : ''
    }</span><span class="cv-pct"${n.showPct ? '' : ' hidden'}>${n.pct}%</span><span class="cv-over"${n.s.over ? '' : ' hidden'}>${esc(
      t.over,
    )}</span></div>`;
  }

  // ── Clamp measuring ──────────────────────────────────────────────────────

  /** Show more only when the clamped words hide text; re-measured when the turn's width changes. */
  #measure(node: HTMLElement): void {
    const text = this.#fit(node);
    if (!text || typeof ResizeObserver !== 'function') return;
    this.#ro ??= new ResizeObserver((entries) => {
      for (const e of entries) {
        const turn = (e.target as Element).closest<HTMLElement>('.cv-turn');
        if (turn?.isConnected) this.#fit(turn);
      }
    });
    this.#ro.observe(text);
  }

  #fit(node: HTMLElement): HTMLElement | null {
    const text = node.querySelector<HTMLElement>('.cv-text[data-clamp]');
    const btn = node.querySelector<HTMLElement>('.cv-more');
    if (!text || !btn) return null;
    if (!this.#ui.get(node.dataset.item ?? '')?.full) {
      const hide = !clampOverflows(text.scrollHeight, text.clientHeight);
      if (btn.hidden !== hide) btn.hidden = hide;
    }
    return text;
  }

  #unobserve(node: Element | null): void {
    const text = node?.querySelector('.cv-text[data-clamp]');
    if (text) this.#ro?.unobserve(text);
  }

  // ── Progress clock ───────────────────────────────────────────────────────

  #syncTicker(): void {
    const live = !!this.root.querySelector('[data-prog]');
    if (live && this.isConnected && !this.#timer) this.#timer = setInterval(() => this.#tick(), 1000);
    else if (!live && this.#timer) {
      clearInterval(this.#timer);
      this.#timer = 0;
    }
  }

  /** 1 Hz: elapsed, percent and the bar change in place — the turn is not re-rendered. */
  #tick(): void {
    const rows = this.$$('[data-prog]');
    if (!rows.length) {
      this.#syncTicker();
      return;
    }
    const now = Date.now() + this.#skew;
    for (const el of rows) paintProgress(el, now, this.#ctx.t);
  }

  // ── Interaction ──────────────────────────────────────────────────────────

  #onClick(e: Event): void {
    const btn = (e.target as Element | null)?.closest?.<HTMLButtonElement>('button');
    // Only this element's own controls (a host's slotted button is the host's business).
    if (!btn || btn.getRootNode() !== this.root) return;
    if (btn.dataset.act === 'retry') {
      if (this.emit<ConversationRetryDetail>('ui-retry', { id: null })) this.sound('tap', undefined, e);
      return;
    }
    const node = btn.closest<HTMLElement>('.cv-turn');
    const id = node?.dataset.item;
    if (!node || id === undefined) return;
    if (btn.classList.contains('cv-more')) this.#toggleClamp(node, id, btn);
    else if (btn.dataset.act === 'raw' || btn.dataset.act === 'sys') this.#toggleDisc(node, id, btn.dataset.act);
    else if (btn.classList.contains('cv-tab')) this.#setView(node, id, btn.dataset.view as AnswerView);
    else if (btn.classList.contains('raw-copy')) void this.#copy(id, btn, e);
    else if (btn.classList.contains('raw-retry')) this.#retrySummary(id, btn, e);
    else if (btn.classList.contains('skill-badge')) this.#toggleSkill(node, id, Number(btn.dataset.skill));
  }

  /** Retry on Raw's Summary view: the host summarises the turn again (`ui-retry` with what: 'summary'). */
  #retrySummary(id: string, btn: HTMLElement, e: Event): void {
    if (btn.closest<HTMLElement>('.cv-rawview')?.dataset.from !== 'summary') return;
    if (this.emit<ConversationRetryDetail>('ui-retry', { id, what: 'summary' })) this.sound('tap', undefined, e);
  }

  #onKey(e: KeyboardEvent): void {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    const box = (e.target as Element | null)?.closest?.<HTMLElement>('.cv-dbox[data-open]');
    const node = box?.closest<HTMLElement>('.cv-turn');
    const id = node?.dataset.item;
    const which = box?.dataset.disc;
    if (!box || !node || id === undefined || (which !== 'raw' && which !== 'sys')) return;
    e.preventDefault();
    e.stopPropagation();
    this.#toggleDisc(node, id, which, false);
    box.querySelector<HTMLElement>('[data-act]')?.focus({ preventScroll: true });
  }

  #onTransitionEnd(e: TransitionEvent): void {
    if (e.propertyName !== 'grid-template-rows') return;
    const region = e.target as Element | null;
    if (!region?.classList?.contains('cv-region')) return;
    const box = region.parentElement;
    if (box?.hasAttribute('data-open')) box.setAttribute('data-settled', '');
  }

  /** A nested answer's Try again / Load answer (cancelable) and Copy (a notification) leave with the turn's id. */
  #fromAnswer(e: Event, kind: 'retry' | 'load' | 'copy'): void {
    const a = e.target as Element | null;
    if (!a || a.tagName !== 'UI-AI-ANSWER') return;
    const id = a.closest<HTMLElement>('.cv-turn')?.dataset.item;
    if (id === undefined) return;
    e.stopPropagation();
    if (kind === 'retry') {
      if (!this.emit<ConversationRetryDetail>('ui-retry', { id })) e.preventDefault();
      return;
    }
    if (kind === 'load') {
      if (!this.emit<ConversationLoadDetail>('ui-load-answer', { id })) e.preventDefault();
      return;
    }
    const text = String((e as CustomEvent<{ text?: string }>).detail?.text ?? '');
    this.notify<ConversationCopyDetail>('ui-copy', { id, text, from: 'answer' });
  }

  #fromLog(e: Event): void {
    if (e.target !== this.#log) return;
    e.stopPropagation();
    const oldest = (e as CustomEvent<LogLoadOlderDetail>).detail?.oldest ?? null;
    const detail: LogLoadOlderDetail = { oldest: oldest === this.#pendingKey ? null : oldest };
    if (!this.emit<LogLoadOlderDetail>('ui-load-older', detail)) e.preventDefault();
  }

  #toggleClamp(node: HTMLElement, id: string, btn: HTMLElement): void {
    const st = this.#uiOf(id);
    st.full = !st.full;
    node.querySelector('.cv-text')?.classList.toggle('is-full', st.full);
    btn.setAttribute('aria-expanded', String(st.full));
    btn.textContent = st.full ? this.#ctx.t.less : this.#ctx.t.more;
    if (!st.full) this.#fit(node);
  }

  #toggleDisc(node: HTMLElement, id: string, which: 'raw' | 'sys', force?: boolean): void {
    const box = node.querySelector<HTMLElement>(`.cv-dbox[data-disc="${which}"]`);
    const btn = box?.querySelector<HTMLElement>('[data-act]');
    const region = box?.querySelector<HTMLElement>('.cv-region');
    const inner = region?.firstElementChild;
    const turn = this.#turns.get(id);
    if (!box || !btn || !region || !inner || !turn) return;
    const st = this.#uiOf(id);
    const was = which === 'raw' ? !!st.raw : !!st.open;
    const open = force ?? !was;
    if (open === was) return;
    if (which === 'raw') st.raw = open;
    else st.open = open;
    // The body is built on first open (a long source costs nothing until asked for) and kept for the close.
    if (open && !inner.childElementCount)
      inner.innerHTML = which === 'raw' ? this.#rawBody(turn, st) : this.#systemDetail(turn, st);
    box.removeAttribute('data-settled');
    box.toggleAttribute('data-open', open);
    if (open && prefersReducedMotion()) box.setAttribute('data-settled', '');
    btn.setAttribute('aria-expanded', String(open));
    region.toggleAttribute('inert', !open);
  }

  #setView(node: HTMLElement, id: string, view: AnswerView): void {
    const turn = this.#turns.get(id);
    const inner = node.querySelector('.cv-dbox[data-disc="raw"] .cv-region-in');
    if (!turn || !inner || (view !== 'summary' && view !== 'source')) return;
    const st = this.#uiOf(id);
    if (st.view === view && inner.querySelector(`.cv-rawview[data-from="${view}"]`)) return;
    st.view = view;
    swap(inner, this.#rawBody(turn, st), this.root);
  }

  #toggleSkill(node: HTMLElement, id: string, i: number): void {
    const turn = this.#turns.get(id);
    const box = node.querySelector('.cv-skills');
    if (!turn || !box || !Array.isArray(turn.skills) || !Number.isInteger(i)) return;
    const st = this.#uiOf(id);
    st.skill = st.skill === i ? null : i;
    swap(box, skillBadgesHtml(turn.skills, { lang: this.#ctx.lang, open: st.skill, keyPrefix: st.dom }), this.root);
  }

  async #copy(id: string, btn: HTMLElement, e: Event): Promise<void> {
    const from = btn.closest<HTMLElement>('.cv-rawview')?.dataset.from as RawFrom | undefined;
    const turn = this.#turns.get(id);
    if (!turn || (from !== 'summary' && from !== 'source' && from !== 'raw')) return;
    const text = this.#rawText(turn, from);
    if (!(await copyText(text, this.root))) return;
    this.#flash(`${id}\n${from}`);
    this.sound('success', { emphasis: 'subtle' }, e);
    this.notify<ConversationCopyDetail>('ui-copy', { id, text, from });
  }

  /** "Copied" on the button for a moment. */
  #flash(key: string): void {
    if (this.#copyTimer) clearTimeout(this.#copyTimer);
    const prev = this.#copied;
    this.#copied = key;
    if (prev && prev !== key) this.#repaintView(prev);
    this.#repaintView(key);
    this.#copyTimer = setTimeout(() => {
      this.#copyTimer = 0;
      const k = this.#copied;
      this.#copied = '';
      this.#repaintView(k);
    }, CONVERSATION_COPIED_MS);
  }

  #repaintView(key: string): void {
    const cut = key.lastIndexOf('\n');
    if (cut < 0) return;
    const id = key.slice(0, cut);
    const from = key.slice(cut + 1) as RawFrom;
    const node = this.turnElement(id);
    const turn = this.#turns.get(id);
    const view = node
      ? Array.from(node.querySelectorAll<HTMLElement>('.cv-rawview')).find((v) => v.dataset.from === from)
      : undefined;
    if (view && turn) swap(view, this.#rawViewInner(turn, this.#uiOf(id), from), this.root);
  }
}

define('ui-conversation', UiConversation);

declare global {
  interface HTMLElementTagNameMap {
    'ui-conversation': UiConversation;
  }
}
