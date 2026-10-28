import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { esc, escAttr } from '../../core/html';
import {
  APPROVAL_ICONS,
  type ApprovalAnswerDetail,
  type ApprovalCardData,
  type ApprovalCardState,
  type ApprovalDecideDetail,
  type ApprovalDecision,
  type ApprovalExpireDetail,
  type ApprovalPermissionData,
  type ApprovalPreview,
  type ApprovalQuestionData,
  type ApprovalStatus,
  agoText,
  approvalIcon,
  choiceOrder,
  clockText,
  LOW_MS,
  normState,
  num,
  recommendedOf,
  riskOf,
  timeOfDay,
  toPreview,
} from './logic';
import { type ApprovalLang, type ApprovalStrings, approvalStrings } from './strings';
import { styles } from './styles';

const KBD_ENTER =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(String(navigator.platform || navigator.userAgent))
    ? '⌘↵'
    : 'Ctrl ↵';
const MORPH_MS = 560;
/** The free-answer option's selection (it never reaches markup, so no host choice id can collide with it). */
const OTHER = '\u0000other';
const AGO_MS = 30_000;

const SPIN = '<svg class="ac-spin" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/></svg>';
const CLOCK =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 5v3.2l2 1.3"/></svg>';
const TICK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.2 8.3 2.6 2.6 5-5.6"/></svg>';
const RETRY =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.8 8a5.2 5.2 0 1 0 1.5-3.7"/><path d="M2.6 2.4v2.9h2.9"/></svg>';
const mark = (d: string) => `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${d}" pathLength="1"/></svg>`;
const MARK = {
  check: mark('M4.2 8.4 6.9 11l4.9-5.4'),
  cross: mark('M5.2 5.2l5.6 5.6M10.8 5.2l-5.6 5.6'),
  clock: mark('M8 2.8a5.2 5.2 0 1 1 0 10.4A5.2 5.2 0 0 1 8 2.8M8 5.4V8l1.8 1.2'),
  arrow: mark('M3.6 8h8.4M8.8 4.8 12 8l-3.2 3.2'),
  ask: mark('M6 6.2a2 2 0 0 1 3.9.6c0 1.3-1.9 1.6-1.9 2.9M8 11.9v.1'),
};

/** An answer this element sent (Retry repeats the last one). */
interface Intent {
  decision?: ApprovalDecision;
  choiceId?: string;
  text?: string;
}
type Resolved = Extract<ApprovalCardState, { status: 'resolved' }>;
type Eff =
  | { status: 'pending' }
  | { status: 'sending'; busy: Intent }
  | { status: 'error'; message: string; retry: boolean }
  | { status: 'resolved'; resolved: Resolved };

const answerable = (v: boolean | string | undefined) => v === undefined || v === null || v === true;
const lockReason = (v: boolean | string | undefined) => (typeof v === 'string' ? v : '');
const stateKey = (v: unknown) => JSON.stringify(normState(v));
const text = (v: unknown) => (v === undefined || v === null ? '' : String(v));

/**
 * `<ui-approval-card>` — an agent asks before it acts. A tool permission (the tool, its risk and matched rules, a
 * preview of the input as a command, a diff or rows, Approve / Deny with ⌘↵ / Esc, an optional "disable this rule"
 * and Explain) or a single-choice question (options with descriptions, the recommended one first, an optional free
 * answer, Submit). A countdown to `expiresAt` that holds still while the card is hovered or focused; once answered,
 * expired or answered elsewhere the card glides into one resolved row.
 */
export class UiApprovalCard extends UiElement<ApprovalCardData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang'];
  }

  readonly #live: HTMLElement;
  /** The request the local state below belongs to. */
  #id: string | undefined;
  /** An answer emitted and not settled by the host yet, and the host state it was emitted under. */
  #sent: Intent | null = null;
  #sentKey = '';
  #last: Intent | null = null;
  #always = false;
  /** Selected option id, or OTHER. */
  #choice: string | undefined;
  #other = '';
  /** expiresAt the element expired itself for / emitted ui-expire for. */
  #expiredFor = 0;
  #expireFired = 0;
  #hover = false;
  #focus = false;
  #clock = '';
  #clockFor = 0;
  #timer = 0;
  #morphTimer = 0;
  #layout: 'card' | 'row' | '' = '';
  #enter = false;
  #focusOther = false;
  #seenStatus: ApprovalStatus | '' = '';
  #seenError = '';
  #preview: { input: unknown; truncated: boolean; value: ApprovalPreview } | undefined;

  constructor() {
    super();
    // Outside the re-rendered markup, so a render never re-creates (or re-reads) the live region.
    this.#live = document.createElement('span');
    this.#live.className = 'sr-only';
    this.#live.setAttribute('role', 'status');
    this.#live.setAttribute('aria-live', 'polite');
    this.root.append(this.#live);
    this.root.addEventListener('click', (e) => this.#onClick(e));
    this.root.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    this.root.addEventListener('input', (e) => this.#onInput(e));
    this.root.addEventListener('focusin', () => this.#setPause('focus', true));
    this.root.addEventListener('focusout', (e) => {
      const to = (e as FocusEvent).relatedTarget as Node | null;
      this.#setPause('focus', !!to && this.root.contains(to));
    });
    this.addEventListener('pointerenter', () => this.#setPause('hover', true));
    this.addEventListener('pointerleave', () => this.#setPause('hover', false));
  }

  attributeChangedCallback(): void {
    this.#clock = '';
    this.requestRender();
  }

  override disconnectedCallback(): void {
    this.#stopTimer();
    this.#endMorph();
    this.#hover = false;
    this.#focus = false;
  }

  /** The card's state now: the host's `state`, plus what the element did itself (an answer in flight, expiry). */
  get status(): ApprovalStatus {
    const d = this.data;
    if (!d) return 'pending';
    this.#sync(d);
    return this.#eff(d).status;
  }

  /** Keyboard landing: focus the card itself (not a button — ⌘↵ / Esc stay a deliberate second step). */
  override focus(options?: FocusOptions): void {
    if (!this.$('.ac-card') && this.data && this.isConnected) this.renderNow();
    const card = this.$<HTMLElement>('.ac-card');
    if (card) card.focus(options);
    else super.focus(options);
  }

  /** A button that went away (answered, resolved): focus stays on the card — or the row it became. */
  protected override focusFallback(): HTMLElement | null {
    return this.$<HTMLElement>('.ac-card');
  }

  get #lang(): ApprovalLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  get #t(): ApprovalStrings {
    return approvalStrings(this.#lang);
  }

  get #paused(): boolean {
    return this.#hover || this.#focus;
  }

  #kind(d: ApprovalCardData): 'permission' | 'question' {
    return d.kind === 'question' ? 'question' : 'permission';
  }

  // ── State ─────────────────────────────────────────────────────────────────

  /** A new request (another id) starts clean; an answer in flight settles once the host changes `state`. */
  #sync(d: ApprovalCardData): void {
    const id = text(d.id);
    if (id !== this.#id) {
      this.#id = id;
      this.#sent = null;
      this.#last = null;
      this.#always = false;
      this.#choice = undefined;
      this.#other = '';
      this.#expiredFor = 0;
      this.#expireFired = 0;
      this.#clock = '';
      this.#seenStatus = '';
      this.#seenError = '';
    }
    if (this.#sent && stateKey(d.state) !== this.#sentKey) this.#sent = null;
  }

  #eff(d: ApprovalCardData): Eff {
    const st = normState(d.state);
    if (st.status === 'resolved') return { status: 'resolved', resolved: st };
    if (st.status === 'error') return { status: 'error', message: st.message, retry: st.retry !== false };
    const until = num(d.expiresAt);
    if (until && this.#expiredFor === until)
      return { status: 'resolved', resolved: { status: 'resolved', outcome: 'expired', at: until } };
    if (st.status === 'sending') {
      const busy: Intent = { ...(this.#sent ?? {}) };
      if (st.decision) busy.decision = st.decision;
      if (st.choiceId !== undefined) busy.choiceId = st.choiceId;
      return { status: 'sending', busy };
    }
    if (this.#sent) return { status: 'sending', busy: this.#sent };
    return { status: 'pending' };
  }

  /** Answers are live: pending (or a failed answer that may be retried) and the host lets this person answer. */
  #canAct(d: ApprovalCardData, eff: Eff): boolean {
    return (eff.status === 'pending' || (eff.status === 'error' && eff.retry)) && answerable(d.canAnswer);
  }

  #selected(d: ApprovalQuestionData): string | undefined {
    const choices = Array.isArray(d.choices) ? d.choices : [];
    if (d.allowOther && (this.#choice === OTHER || !choices.length)) return OTHER;
    if (this.#choice !== undefined && choices.some((c) => c.id === this.#choice)) return this.#choice;
    return recommendedOf(d);
  }

  #canSubmit(d: ApprovalQuestionData): boolean {
    const sel = this.#selected(d);
    return sel === OTHER ? this.#other.trim() !== '' : sel !== undefined;
  }

  // ── Intent ────────────────────────────────────────────────────────────────

  #onClick(e: Event): void {
    const d = this.data;
    const el = (e.target as Element | null)?.closest?.('[data-act], .ac-always input') as HTMLElement | null;
    if (!d || !el) return;
    const off = el.getAttribute('aria-disabled') === 'true';
    if (el instanceof HTMLInputElement) {
      // The rule checkbox: aria-disabled (it keeps focus) — a click while locked does not toggle it.
      if (off) e.preventDefault();
      else this.#always = el.checked;
      return;
    }
    const act = el.dataset.act;
    if (act === 'opt') {
      if (!off) this.#select(el.hasAttribute('data-other') ? OTHER : text(el.dataset.choice), true);
      return;
    }
    if (off) return;
    if (act === 'approve')
      this.#decide(
        d,
        this.#always && (d as ApprovalPermissionData).canDisableRule ? 'approve_disable_rule' : 'approve',
      );
    else if (act === 'deny' || act === 'explain') this.#decide(d, act);
    else if (act === 'submit') this.#submit(d);
    else if (act === 'retry') this.#retry(d);
  }

  #select(id: string, byPointer: boolean): void {
    const d = this.data;
    if (!d || this.#kind(d) !== 'question' || !this.#canAct(d, this.#eff(d))) return;
    this.#choice = id;
    if (id === OTHER && byPointer) this.#focusOther = true;
    this.renderNow();
  }

  #decide(d: ApprovalCardData, decision: ApprovalDecision): void {
    if (this.#kind(d) !== 'permission' || !this.#canAct(d, this.#eff(d))) return;
    const p = d as ApprovalPermissionData;
    if (decision === 'approve_disable_rule' && !p.canDisableRule) return;
    if (decision === 'explain' && !p.canExplain) return;
    this.#send({ decision });
  }

  #submit(d: ApprovalCardData): void {
    if (this.#kind(d) !== 'question' || !this.#canAct(d, this.#eff(d))) return;
    const q = d as ApprovalQuestionData;
    const sel = this.#selected(q);
    if (sel === OTHER) {
      const answer = this.#other.trim();
      if (answer) this.#send({ text: answer });
    } else if (sel !== undefined) this.#send({ choiceId: sel });
  }

  #retry(d: ApprovalCardData): void {
    const last = this.#last;
    if (last && this.#canAct(d, this.#eff(d))) this.#send(last);
  }

  /** Emit the answer; not cancelled → the answers lock with a spinner until the host changes `state`. */
  #send(intent: Intent): void {
    const id = text(this.data?.id);
    const ok = intent.decision
      ? this.emit<ApprovalDecideDetail>('ui-decide', { id, decision: intent.decision })
      : this.emit<ApprovalAnswerDetail>(
          'ui-answer',
          intent.text !== undefined ? { id, text: intent.text } : { id, choiceId: intent.choiceId },
        );
    if (!ok) return;
    this.#sent = intent;
    this.#last = intent;
    this.#sentKey = stateKey(this.data?.state);
    this.requestRender();
  }

  /**
   * ⌘/Ctrl+Enter anywhere in the card: Approve (or Submit). Esc from one of the card's controls: Deny — on the card
   * itself it still reaches the page (closes a panel). Options: arrows move the choice, Enter submits it.
   */
  #onKey(e: KeyboardEvent): void {
    const d = this.data;
    if (e.defaultPrevented || !d) return;
    const target = e.target as HTMLElement | null;
    const kind = this.#kind(d);
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      const btn = this.$<HTMLElement>(kind === 'question' ? '.ac-submit' : '.ac-approve');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      btn.click();
      return;
    }
    if (e.key === 'Escape') {
      const deny = this.$<HTMLElement>('.ac-deny');
      if (kind !== 'permission' || !deny || deny.getAttribute('aria-disabled') === 'true') return;
      if (!target?.closest?.('button, input')) return;
      e.preventDefault();
      e.stopPropagation();
      deny.click();
      return;
    }
    if (kind !== 'question' || e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key === 'Enter' && target?.matches?.('.ac-other input')) {
      e.preventDefault();
      this.#submit(d);
      return;
    }
    const opt = target?.closest?.('.ac-opt') as HTMLElement | null;
    if (!opt) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (opt.getAttribute('aria-disabled') === 'true') return;
      this.#choice = opt.hasAttribute('data-other') ? OTHER : text(opt.dataset.choice);
      if (this.#choice === OTHER && !this.#other.trim()) {
        this.#focusOther = true;
        this.renderNow();
      } else this.#submit(d);
      return;
    }
    const opts = this.$$<HTMLElement>('.ac-opt');
    const i = opts.indexOf(opt);
    const n = opts.length;
    const to =
      e.key === 'ArrowDown' || e.key === 'ArrowRight'
        ? (i + 1) % n
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
          ? (i - 1 + n) % n
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? n - 1
              : -1;
    if (to < 0 || i < 0) return;
    e.preventDefault();
    const next = opts[to];
    const key = next.dataset.key;
    if (next.getAttribute('aria-disabled') !== 'true')
      this.#select(next.hasAttribute('data-other') ? OTHER : text(next.dataset.choice), false);
    this.$$<HTMLElement>('.ac-opt')
      .find((o) => o.dataset.key === key)
      ?.focus();
  }

  #onInput(e: Event): void {
    const input = e.target as HTMLInputElement | null;
    const d = this.data;
    if (!d || !input?.matches?.('.ac-other input') || this.#kind(d) !== 'question') return;
    this.#other = input.value;
    const can = this.#canAct(d, this.#eff(d)) && this.#canSubmit(d as ApprovalQuestionData);
    this.$('.ac-submit')?.setAttribute('aria-disabled', String(!can));
  }

  // ── Countdown ─────────────────────────────────────────────────────────────

  #setPause(which: 'hover' | 'focus', on: boolean): void {
    if (which === 'hover') {
      if (this.#hover === on) return;
      this.#hover = on;
    } else {
      if (this.#focus === on) return;
      this.#focus = on;
    }
    // Leaving the card: the clock catches up at once (and a request whose time ran out expires now).
    if (this.isConnected && this.data) this.#tick();
  }

  /** The countdown text; while the card is hovered or focused it holds — except in the last 10 s. */
  #clockLabel(until: number, now: number): string {
    const left = until - now;
    if (this.#paused && left > LOW_MS && this.#clock && this.#clockFor === until) return this.#clock;
    this.#clock = left > 0 ? this.#t.expiresIn(clockText(left)) : this.#t.expired;
    this.#clockFor = until;
    return this.#clock;
  }

  #paint(now: number): void {
    const d = this.data;
    if (!d) return;
    const until = num(d.expiresAt);
    const box = this.$('.ac-expires');
    if (box && until) {
      const label = this.#clockLabel(until, now);
      const node = this.$('.ac-clock')?.firstChild;
      if (node && node.nodeType === Node.TEXT_NODE && (node as Text).data !== label) (node as Text).data = label;
      box.toggleAttribute('data-low', until - now <= LOW_MS);
      box.toggleAttribute('data-paused', this.#paused && until - now > LOW_MS);
    }
    const ago = this.$('.ac-ago');
    const at = Number(ago?.dataset.at);
    if (ago && at) {
      const label = agoText(at, now, this.#lang);
      if (ago.textContent !== label) ago.textContent = label;
    }
  }

  #canExpire(d: ApprovalCardData, eff: Eff): boolean {
    const until = num(d.expiresAt);
    return (
      !!until && (eff.status === 'pending' || eff.status === 'error') && !this.#paused && this.#expireFired !== until
    );
  }

  /** One wake-up per second boundary while a countdown shows, every 30 s for a resolved row's “2m ago”. */
  #schedule(): void {
    this.#stopTimer();
    const d = this.data;
    if (!d || !this.isConnected) return;
    const eff = this.#eff(d);
    const now = Date.now();
    const until = num(d.expiresAt);
    let delay = Number.POSITIVE_INFINITY;
    if (eff.status !== 'resolved' && until) {
      const left = until - now;
      if (left > 0) delay = (left % 1000 || 1000) + 4;
      else if (this.#canExpire(d, eff)) delay = 0;
    }
    if (eff.status === 'resolved' && num(eff.resolved.at)) delay = Math.min(delay, AGO_MS);
    if (delay !== Number.POSITIVE_INFINITY) this.#timer = window.setTimeout(() => this.#tick(), delay);
  }

  #tick(): void {
    this.#timer = 0;
    const d = this.data;
    if (!d || !this.isConnected) return;
    const now = Date.now();
    this.#sync(d);
    this.#paint(now);
    const until = num(d.expiresAt);
    if (until && until <= now && this.#canExpire(d, this.#eff(d))) {
      this.#expireFired = until;
      // Not cancelled → the card becomes the Expired row; cancelled → it stays as it is (the host knows better).
      if (this.emit<ApprovalExpireDetail>('ui-expire', { id: text(d.id) })) {
        this.#expiredFor = until;
        this.requestRender();
      }
    }
    this.#schedule();
  }

  #stopTimer(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = 0;
  }

  // ── Render cycle ──────────────────────────────────────────────────────────

  /** Card ↔ row: the old layout fades and blurs out on top while the height glides to the new one. */
  protected override update(): void {
    const d = this.data;
    if (d) this.#sync(d);
    const next = d ? (this.#eff(d).status === 'resolved' ? 'row' : 'card') : '';
    const prev = this.#layout;
    let ghost: HTMLElement | null = null;
    let fromH = 0;
    let top = 0;
    if (prev && next && prev !== next) {
      this.#enter = true;
      this.#endMorph();
      const box = this.$<HTMLElement>('.ac');
      const card = this.$<HTMLElement>('.ac-card');
      if (box && card && !prefersReducedMotion()) {
        fromH = box.getBoundingClientRect().height;
        top = card.offsetTop;
        if (fromH > 0) ghost = card.cloneNode(true) as HTMLElement;
      }
    }
    this.#layout = next;
    super.update();
    this.#enter = false;
    if (ghost) this.#morph(ghost, fromH, top);
    if (this.#focusOther) {
      this.#focusOther = false;
      this.$<HTMLInputElement>('.ac-other input')?.focus();
    }
  }

  #morph(ghost: HTMLElement, fromH: number, top: number): void {
    const box = this.$<HTMLElement>('.ac');
    const toH = box?.getBoundingClientRect().height ?? 0;
    if (!box || !toH) return;
    for (const el of [ghost, ...Array.from(ghost.querySelectorAll('[id], [data-key], [tabindex]'))]) {
      for (const a of ['id', 'data-key', 'tabindex', 'role', 'aria-labelledby', 'aria-describedby'])
        el.removeAttribute(a);
    }
    ghost.classList.remove('is-enter');
    ghost.classList.add('ac-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('inert', '');
    ghost.style.top = `${top}px`;
    box.append(ghost);
    box.setAttribute('data-morph', '');
    box.style.height = `${fromH}px`;
    void box.offsetHeight;
    box.style.height = `${toH}px`;
    this.#morphTimer = window.setTimeout(() => this.#endMorph(), MORPH_MS);
  }

  #endMorph(): void {
    if (this.#morphTimer) clearTimeout(this.#morphTimer);
    this.#morphTimer = 0;
    const box = this.$<HTMLElement>('.ac');
    if (box) {
      box.style.removeProperty('height');
      box.removeAttribute('data-morph');
    }
    for (const g of this.$$('.ac-ghost')) g.remove();
  }

  protected override updated(): void {
    this.#schedule();
  }

  protected render(): string {
    const d = this.data;
    if (!d) return '';
    const t = this.#t;
    const kind = this.#kind(d);
    const eff = this.#eff(d);
    this.#announce(d, kind, eff, t);
    const enter = this.#enter;
    const body =
      eff.status === 'resolved' ? this.#row(d, kind, eff.resolved, t, enter) : this.#card(d, kind, eff, t, enter);
    return `<div class="ac" data-kind="${kind}" data-status="${eff.status}">${this.#label(d, kind, t)}${body}</div>`;
  }

  #title(d: ApprovalCardData, kind: 'permission' | 'question', t: ApprovalStrings): string {
    if (kind === 'question') return text((d as ApprovalQuestionData).question);
    const p = d as ApprovalPermissionData;
    return text(p.title) || t.title(text(p.tool) || 'tool');
  }

  #label(d: ApprovalCardData, kind: 'permission' | 'question', t: ApprovalStrings): string {
    if (d.label !== undefined && d.label !== null) {
      const l = text(d.label);
      return l ? `<div class="ac-label" title="${escAttr(l)}">${esc(l)}</div>` : '';
    }
    if (kind !== 'permission') return '';
    const tool = text((d as ApprovalPermissionData).tool);
    const at = timeOfDay(d.createdAt, this.#lang);
    if (!tool && !at) return '';
    return `<div class="ac-label">${tool ? `<code>${esc(tool)}</code>` : ''}${tool && at ? ' · ' : ''}${
      at ? esc(t.requested(at)) : ''
    }</div>`;
  }

  #previewOf(p: ApprovalPermissionData): ApprovalPreview {
    const truncated = !!p.truncated;
    const hit = this.#preview;
    if (hit && hit.input === p.input && hit.truncated === truncated) return hit.value;
    const value = toPreview(p.input, truncated);
    this.#preview = { input: p.input, truncated, value };
    return value;
  }

  #card(d: ApprovalCardData, kind: 'permission' | 'question', eff: Eff, t: ApprovalStrings, enter: boolean): string {
    const busy = eff.status === 'sending' ? eff.busy : null;
    const can = this.#canAct(d, eff);
    const why = lockReason(d.canAnswer);
    const until = num(d.expiresAt);
    const p = kind === 'permission' ? (d as ApprovalPermissionData) : null;
    const q = kind === 'question' ? (d as ApprovalQuestionData) : null;
    const preview = p && !p.loading && !p.notice ? this.#previewOf(p) : null;
    const desc = text(d.description) || preview?.summary || '';
    const title = this.#title(d, kind, t);

    let badge = '';
    if (p) {
      const risk = riskOf(p);
      if (risk)
        badge = `<span class="ac-risk" data-risk="${risk}">${t.riskPre ? `<span class="ac-risk-word">${esc(t.riskPre)}</span>` : ''}${esc(
          t.risk[risk],
        )}${t.riskPost ? `<span class="ac-risk-word">${esc(t.riskPost)}</span>` : ''}</span>`;
    } else badge = `<span class="ac-risk" data-risk="question">${esc(t.question)}</span>`;
    const icon = APPROVAL_ICONS[p ? approvalIcon(text(p.tool)) : 'question'];
    const head = `<div class="ac-head"><span class="ac-icon" aria-hidden="true">${icon}</span><div class="ac-titles"><div class="ac-title" id="ac-title"${
      p ? ` title="${escAttr(title)}"` : ''
    }>${esc(title)}</div>${
      desc ? `<p class="ac-desc" id="ac-desc"${p ? ` title="${escAttr(desc)}"` : ''}>${esc(desc)}</p>` : ''
    }</div>${badge}</div>`;

    const body = p ? this.#permBody(p, preview, t) : q ? this.#questionBody(q, can, t) : '';

    const btn = (act: string, cls: string, label: string, on: boolean, spin: boolean, kbd = '', keys = '') =>
      `<button type="button" class="ac-btn ${cls}${spin ? ' is-busy' : ''}" data-act="${act}" data-key="${act}"${
        keys ? ` aria-keyshortcuts="${keys}"` : ''
      }${on ? '' : ' aria-disabled="true"'}${why ? ` title="${escAttr(why)}"` : ''}>${esc(label)}${
        spin ? SPIN : kbd ? `<kbd class="ac-kbd" aria-hidden="true">${esc(kbd)}</kbd>` : ''
      }</button>`;
    let left = '';
    let actions = '';
    if (p) {
      const n = Array.isArray(p.rules) ? p.rules.length : 0;
      if (p.canDisableRule)
        left = `<label class="ac-always"><span class="ac-box"><input type="checkbox" data-key="always"${
          this.#always ? ' checked' : ''
        }${can ? '' : ' aria-disabled="true"'}>${TICK}</span><span class="ac-always-label">${esc(t.disableRule(n))}</span></label>`;
      const sd = busy ? (busy.decision ?? 'approve') : '';
      actions =
        (p.canExplain ? btn('explain', 'ac-ghost', t.explain, can, sd === 'explain') : '') +
        btn('deny', 'ac-quiet ac-deny', t.deny, can, sd === 'deny', 'Esc', 'Escape') +
        btn(
          'approve',
          'ac-primary ac-approve',
          t.approve,
          can,
          sd === 'approve' || sd === 'approve_disable_rule',
          KBD_ENTER,
          'Meta+Enter Control+Enter',
        );
    } else if (q) {
      actions = btn(
        'submit',
        'ac-primary ac-submit',
        t.submit,
        can && this.#canSubmit(q),
        !!busy,
        KBD_ENTER,
        'Meta+Enter Control+Enter',
      );
    }
    const now = Date.now();
    const expires = until
      ? `<span class="ac-expires" aria-hidden="true"${until - now <= LOW_MS ? ' data-low' : ''}>${CLOCK}<span class="ac-clock">${esc(
          this.#clockLabel(until, now),
        )}</span></span>`
      : '';
    const foot = `<div class="ac-foot">${left}${expires}<div class="ac-actions">${actions}</div></div>`;
    const lock = why ? `<p class="ac-lock">${esc(why)}</p>` : '';
    const error =
      eff.status === 'error'
        ? `<div class="ac-error"><p class="ac-error-text">${esc(eff.message || t.failed)}</p>${
            eff.retry && this.#last && answerable(d.canAnswer)
              ? `<button type="button" class="ac-btn ac-retry" data-act="retry" data-key="retry">${RETRY}${esc(t.retry)}</button>`
              : ''
          }</div>`
        : '';
    const sr = until
      ? `<span class="sr-only" id="ac-exp">${esc(t.expiresAt(timeOfDay(until, this.#lang)))}</span>`
      : '';
    const described = [desc ? 'ac-desc' : '', until ? 'ac-exp' : ''].filter(Boolean).join(' ');
    return `<div class="ac-card${enter ? ' is-enter' : ''}" role="group" tabindex="-1" data-key="card" aria-labelledby="ac-title"${
      described ? ` aria-describedby="${described}"` : ''
    }${busy ? ' aria-busy="true"' : ''}><div class="ac-main">${head}${body}${foot}${lock}${error}${sr}</div></div>`;
  }

  #permBody(p: ApprovalPermissionData, preview: ApprovalPreview | null, t: ApprovalStrings): string {
    const parts: string[] = [];
    if (p.loading) parts.push(`<p class="ac-note">${esc(t.loading)}</p>`);
    else if (p.notice) parts.push(`<p class="ac-note">${esc(p.notice)}</p>`);
    else if (preview) {
      if (preview.command !== undefined)
        parts.push(
          `<pre class="ac-code ac-cmd"><span class="ac-prompt" aria-hidden="true">$ </span>${esc(preview.command)}</pre>`,
        );
      for (const f of preview.diffs) {
        const lines = f.lines.map((l) => `<span class="ac-dl" data-op="${l.op}">${esc(l.text)}</span>`).join('');
        parts.push(
          `<div class="ac-file">${
            f.path ? `<div class="ac-path" title="${escAttr(f.path)}"><bdi>${esc(f.path)}</bdi></div>` : ''
          }${lines ? `<pre class="ac-code ac-diff">${lines}</pre>` : ''}</div>`,
        );
      }
      if (preview.more) parts.push(`<p class="ac-note">${esc(t.moreLines(preview.more))}</p>`);
      if (preview.fields.length)
        parts.push(
          `<dl class="ac-details">${preview.fields
            .map(([k, v]) => `<div class="ac-detail"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
            .join('')}</dl>`,
        );
      if (preview.raw !== undefined) {
        parts.push(`<pre class="ac-code">${esc(preview.raw)}</pre>`);
        if (p.truncated) parts.push(`<p class="ac-note">${esc(t.truncated)}</p>`);
      }
    }
    const rules = (Array.isArray(p.rules) ? p.rules : []).filter((r) => r && r.id !== undefined);
    if (rules.length)
      parts.push(
        `<div class="ac-rules"><span class="ac-rules-label">${esc(t.rules(rules.length))}</span>${rules
          .map(
            (r) =>
              `<span class="ac-rule"><code>${esc(r.id)}</code><b>${esc(r.label)}</b>${
                r.description ? ` — ${esc(r.description)}` : ''
              }</span>`,
          )
          .join('')}</div>`,
      );
    return parts.length ? `<div class="ac-preview">${parts.join('')}</div>` : '';
  }

  #questionBody(q: ApprovalQuestionData, can: boolean, t: ApprovalStrings): string {
    const rec = recommendedOf(q);
    const order = choiceOrder(Array.isArray(q.choices) ? q.choices : [], rec);
    const sel = this.#selected(q);
    const off = can ? '' : ' aria-disabled="true"';
    // Roving tab stop: the selected option, else the first.
    const stop = sel !== undefined && (sel === OTHER || order.some((c) => c.id === sel)) ? sel : order[0]?.id;
    const opts = order.map((c, i) => {
      const on = sel === c.id;
      return `<button type="button" class="ac-opt" role="radio" aria-checked="${on}" tabindex="${
        stop === c.id ? 0 : -1
      }" data-act="opt" data-choice="${escAttr(c.id)}" data-key="${escAttr(`opt:${c.id}`)}" aria-labelledby="ac-o${i}"${
        c.description ? ` aria-describedby="ac-od${i}"` : ''
      }${off}><span class="ac-radio" aria-hidden="true"></span><span class="ac-opt-label" id="ac-o${i}">${esc(c.label)}${
        rec === c.id ? `<span class="ac-opt-tag">${esc(t.recommended)}</span>` : ''
      }</span>${c.description ? `<span class="ac-opt-desc" id="ac-od${i}">${esc(c.description)}</span>` : ''}</button>`;
    });
    if (q.allowOther && order.length)
      opts.push(
        `<button type="button" class="ac-opt" role="radio" aria-checked="${sel === OTHER}" tabindex="${
          stop === OTHER ? 0 : -1
        }" data-act="opt" data-other data-key="opt-other"${off}><span class="ac-radio" aria-hidden="true"></span><span class="ac-opt-label">${esc(
          t.other,
        )}</span></button>`,
      );
    const other =
      q.allowOther && sel === OTHER
        ? `<div class="ac-other"><input type="text" data-key="other-text" aria-label="${escAttr(t.otherLabel)}" placeholder="${escAttr(
            t.otherPlaceholder,
          )}" value="${escAttr(this.#other)}" autocomplete="off"${can ? '' : ' readonly aria-disabled="true"'}></div>`
        : '';
    const group = opts.length
      ? `<div class="ac-opts" role="radiogroup" aria-labelledby="ac-title"${off}>${opts.join('')}</div>`
      : '';
    return group || other ? `<div class="ac-question">${group}${other}</div>` : '';
  }

  #outcomeText(d: ApprovalCardData, kind: 'permission' | 'question', r: Resolved, t: ApprovalStrings): string {
    const word = t.outcome[r.outcome] ?? r.outcome;
    if (r.outcome === 'approved' && r.ruleDisabled) return `${word} · ${t.ruleDisabled}`;
    if (r.outcome === 'answered' && kind === 'question') {
      const q = d as ApprovalQuestionData;
      const c = r.choiceId === undefined ? undefined : (q.choices ?? []).find((x) => x.id === r.choiceId);
      const answer = c ? text(c.label) : r.text !== undefined ? text(r.text) : text(r.choiceId);
      return answer ? `${word} · ${answer}` : word;
    }
    return word;
  }

  #row(d: ApprovalCardData, kind: 'permission' | 'question', r: Resolved, t: ApprovalStrings, enter: boolean): string {
    const title = this.#title(d, kind, t);
    const status = this.#outcomeText(d, kind, r, t);
    const by = r.by !== undefined && r.by !== null && r.by !== '' ? ` · ${t.by(text(r.by))}` : '';
    const at = num(r.at);
    const time = at
      ? `<span class="ac-row-time"> · <span class="ac-ago" data-at="${at}">${esc(agoText(at, Date.now(), this.#lang))}</span></span>`
      : '';
    const glyph =
      r.outcome === 'approved' || r.outcome === 'answered'
        ? MARK.check
        : r.outcome === 'denied'
          ? MARK.cross
          : r.outcome === 'expired'
            ? MARK.clock
            : r.outcome === 'explained'
              ? MARK.ask
              : MARK.arrow;
    return `<div class="ac-card ac-row${enter ? ' is-enter' : ''}" role="group" tabindex="-1" data-key="card" data-kind="${kind}" data-outcome="${escAttr(
      r.outcome,
    )}" aria-labelledby="ac-row-title ac-row-status"><span class="ac-mark" aria-hidden="true">${glyph}</span><span class="ac-row-title" id="ac-row-title" title="${escAttr(
      title,
    )}">${esc(title)}</span><span class="ac-row-status" id="ac-row-status">${esc(status)}${esc(by)}${time}</span></div>`;
  }

  /** Said once: the request ending (“Approved: Bash approval”), a new failure. A card that first appears stays quiet. */
  #announce(d: ApprovalCardData, kind: 'permission' | 'question', eff: Eff, t: ApprovalStrings): void {
    const first = this.#seenStatus === '';
    const prev = this.#seenStatus;
    this.#seenStatus = eff.status;
    const err = eff.status === 'error' ? eff.message || t.failed : '';
    const prevErr = this.#seenError;
    this.#seenError = err;
    if (first) return;
    let say = '';
    if (eff.status === 'resolved' && prev !== 'resolved')
      say = t.say(this.#outcomeText(d, kind, eff.resolved, t), this.#title(d, kind, t));
    else if (err && err !== prevErr) say = err;
    if (say && this.#live.textContent !== say) this.#live.textContent = say;
  }
}

define('ui-approval-card', UiApprovalCard);

declare global {
  interface HTMLElementTagNameMap {
    'ui-approval-card': UiApprovalCard;
  }
}
