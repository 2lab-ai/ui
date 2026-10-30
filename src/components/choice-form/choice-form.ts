import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { esc, escAttr } from '../../core/html';
import { morphInto } from '../../core/morph';
import { icon } from '../../icons/icons';
import { answerMarkdown } from '../ai-answer/ai-answer';
import {
  type ChoiceFormAction,
  type ChoiceFormAnswerOut,
  type ChoiceFormAnswers,
  type ChoiceFormChangeDetail,
  type ChoiceFormData,
  type ChoiceFormQuestion,
  type ChoiceFormSource,
  type ChoiceFormSubmitDetail,
  choiceFormAnswerList,
  choiceFormCanSubmit,
  choiceFormHero,
  choiceFormKey,
  choiceFormNext,
  choiceFormNormalize,
  choiceFormOrder,
  choiceFormProgress,
  choiceFormQuestions,
  choiceFormRecommended,
  choiceFormRecommendedAnswers,
  choiceFormReduce,
  choiceFormValid,
} from './logic';
import { type ChoiceFormStrings, choiceFormStrings } from './strings';
import { styles } from './styles';

const KBD_ENTER =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(String(navigator.platform || navigator.userAgent))
    ? '⌘↵'
    : 'Ctrl ↵';
const SPIN = '<span class="cf-spin" aria-hidden="true"></span>';
const ARROWS = ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'];

/** An answer this element sent and the host has not answered yet (spinner placement). */
interface Sending {
  source: ChoiceFormSource;
  questionId?: string;
  choiceId?: string;
}

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

/**
 * `<ui-choice-form>` — the agent asks several things at once. Numbered question cards (title, markdown context,
 * choice buttons with the recommended one first and marked, an optional own answer), progress dots, a one-press
 * “Submit all recommended”, Reset and one ink Submit. A pick folds the card into the answer (a raised chip + Change)
 * and moves focus to the next open question; digits 1–9 pick. With one question it is a plain choice card that can
 * submit on pick. Answers leave as a cancelable `ui-submit`; `submitting` / `submitted` / `error` come from the host.
 */
export class UiChoiceForm extends UiElement<ChoiceFormData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang'];
  }

  readonly #live: HTMLElement;
  /** Identity of the form the working state below belongs to. */
  #key: string | undefined;
  #answers: ChoiceFormAnswers = {};
  /** Answered questions whose choices are open again (Change). */
  #editing = new Set<string>();
  /** Own-answer text being typed, by question. */
  #drafts = new Map<string, string>();
  /** Questions whose own answer was confirmed empty. */
  #invalid = new Set<string>();
  /** The question being answered (index), when it is still open. */
  #active = 0;
  #sending: Sending | null = null;
  #lastSent: Sending | null = null;
  /** The data object the answers were sent under — the host assigning a new one settles the local busy state. */
  #sentFor: ChoiceFormData | undefined;
  #layout: 'form' | 'done' | '' = '';
  #enter = false;
  #painted = false;
  /** Expand regions: open state at the last render, and the open ones that finished growing (stop clipping). */
  #prevOpen = new Map<string, boolean>();
  #nowOpen = new Map<string, boolean>();
  #settled = new Set<string>();

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
    this.root.addEventListener('focusin', (e) => this.#onFocusIn(e));
    this.root.addEventListener('transitionend', (e) => this.#onTransitionEnd(e as TransitionEvent));
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  /** The working answers, in question order (what Submit would send now). */
  get answers(): ChoiceFormAnswerOut[] {
    const d = this.data;
    if (!d) return [];
    return choiceFormAnswerList(this.#sync(d), this.#answers);
  }

  /** Keyboard landing: the open question's first choice (or Submit, or the summary once sent). */
  override focus(options?: FocusOptions): void {
    if (this.data && this.isConnected && !this.content.firstElementChild) this.renderNow();
    const el = this.#landing();
    if (el) el.focus(options);
    else super.focus(options);
  }

  get #t(): ChoiceFormStrings {
    return choiceFormStrings(this.getAttribute('lang'));
  }

  // ── State ─────────────────────────────────────────────────────────────────

  /** A new identity starts clean (seeded from `answers`); a new data object settles an answer in flight. */
  #sync(d: ChoiceFormData): ChoiceFormQuestion[] {
    const qs = choiceFormQuestions(d.questions);
    const key = choiceFormKey(d);
    if (key !== this.#key) {
      this.#key = key;
      this.#answers = choiceFormNormalize(qs, d.answers);
      this.#editing.clear();
      this.#drafts.clear();
      this.#invalid.clear();
      this.#sending = null;
      this.#lastSent = null;
      this.#sentFor = undefined;
      this.#active = Math.max(0, choiceFormNext(qs, this.#answers, -1));
    } else {
      this.#answers = choiceFormNormalize(qs, this.#answers);
      for (const id of this.#editing) if (!qs.some((q) => q.id === id)) this.#editing.delete(id);
    }
    if (this.#sending && d !== this.#sentFor) this.#sending = null;
    return qs;
  }

  #busy(d: ChoiceFormData): boolean {
    return !!d.submitting || !!this.#sending;
  }

  /** Which control spins: the one that sent; host-held `submitting` alone → Submit (one question on pick: its answer). */
  #spin(d: ChoiceFormData, qs: ChoiceFormQuestion[]): Sending | null {
    if (this.#sending) return this.#sending;
    if (!d.submitting) return null;
    if (this.#lastSent) return this.#lastSent;
    const q = qs[0];
    const a = q ? this.#answers[q.id] : undefined;
    if (this.#pickSubmits(d, qs) && a) return { source: 'submit', questionId: q.id, choiceId: a.choiceId };
    return { source: 'submit' };
  }

  #single(qs: ChoiceFormQuestion[]): boolean {
    return qs.length === 1;
  }

  #pickSubmits(d: ChoiceFormData, qs: ChoiceFormQuestion[]): boolean {
    return this.#single(qs) && d.submitOnPick !== false;
  }

  #isOpen(q: ChoiceFormQuestion, qs: ChoiceFormQuestion[]): boolean {
    return this.#single(qs) || !choiceFormValid(q, this.#answers[q.id]) || this.#editing.has(q.id);
  }

  /** The question being answered: the active one while it is open, else the first open one (-1: none). */
  #current(qs: ChoiceFormQuestion[]): number {
    const a = qs[this.#active];
    if (a && this.#isOpen(a, qs)) return this.#active;
    const next = choiceFormNext(qs, this.#answers, -1);
    if (next >= 0) return next;
    return qs.findIndex((q) => this.#editing.has(q.id));
  }

  // ── Intent ────────────────────────────────────────────────────────────────

  #onClick(e: Event): void {
    const el = (e.target as Element | null)?.closest?.('[data-act]') as HTMLElement | null;
    const d = this.data;
    if (!el || !d || d.submitted) return;
    this.#sync(d);
    const act = el.dataset.act;
    const qid = str(el.dataset.q);
    // Confirm stays pressable while empty: pressing it says why nothing happened.
    if (act === 'custom') {
      if (!this.#busy(d)) this.#confirmCustom(qid);
      return;
    }
    if (el.getAttribute('aria-disabled') === 'true') return;
    if (act === 'pick') this.#pick(qid, str(el.dataset.choice));
    else if (act === 'change') this.#change(qid);
    else if (act === 'reset') this.#reset();
    else if (act === 'submit') this.#submit('submit');
    else if (act === 'recommended') this.#submit('recommended');
  }

  #pick(qid: string, cid: string): void {
    const d = this.data;
    if (!d) return;
    const qs = this.#sync(d);
    if (this.#busy(d) || d.submitted) return;
    const qi = qs.findIndex((q) => q.id === qid);
    if (qi < 0 || !qs[qi].choices.some((c) => c.id === cid)) return;
    if (this.#pickSubmits(d, qs)) {
      const answers = choiceFormReduce(this.#answers, { type: 'pick', questionId: qid, choiceId: cid }, qs);
      this.#send(answers, 'submit', qs, { source: 'submit', questionId: qid, choiceId: cid });
      return;
    }
    this.#apply({ type: 'pick', questionId: qid, choiceId: cid }, qs, qi, 'pick');
  }

  #confirmCustom(qid: string): void {
    const d = this.data;
    if (!d) return;
    const qs = this.#sync(d);
    const qi = qs.findIndex((q) => q.id === qid);
    if (qi < 0 || !qs[qi].allowCustom || this.#busy(d)) return;
    const input = this.#inputOf(qid);
    if (input) this.#drafts.set(qid, input.value);
    const text = str(this.#drafts.get(qid)).trim();
    if (!text) {
      this.#invalid.add(qid);
      this.renderNow();
      this.#inputOf(qid)?.focus();
      return;
    }
    if (this.#pickSubmits(d, qs)) {
      const answers = choiceFormReduce(this.#answers, { type: 'custom', questionId: qid, text }, qs);
      this.#send(answers, 'submit', qs, { source: 'submit', questionId: qid });
      return;
    }
    this.#apply({ type: 'custom', questionId: qid, text }, qs, qi, 'custom');
  }

  /** Record a pick / own answer, fold the card, notify, and move on to the next open question. */
  #apply(action: ChoiceFormAction, qs: ChoiceFormQuestion[], qi: number, reason: 'pick' | 'custom'): void {
    const qid = qs[qi].id;
    const next = choiceFormReduce(this.#answers, action, qs);
    const changed = next !== this.#answers;
    this.#answers = next;
    this.#editing.delete(qid);
    this.#invalid.delete(qid);
    if (reason === 'custom') this.#drafts.delete(qid);
    const nextQi = choiceFormNext(qs, next, qi);
    if (nextQi >= 0) this.#active = nextQi;
    this.renderNow();
    this.#advance(qs, qi, nextQi);
    if (!changed) return;
    const p = choiceFormProgress(qs, next);
    if (!this.#single(qs)) this.#say(this.#t.progress(p.answered, p.total));
    this.notify<ChoiceFormChangeDetail>('ui-change', {
      answers: choiceFormAnswerList(qs, next),
      answered: p.answered,
      total: p.total,
      reason,
      questionId: qid,
    });
  }

  /** After a pick: the next open question, else Submit, else the answered card's Change. */
  #advance(qs: ChoiceFormQuestion[], qi: number, nextQi: number): void {
    let target: HTMLElement | null = null;
    let card: HTMLElement | null = null;
    if (nextQi >= 0 && nextQi !== qi) {
      card = this.#cardOf(qs[nextQi].id);
      target = this.#stopOf(qs[nextQi].id);
    }
    if (!target) {
      const submit = this.$<HTMLElement>('.cf-submit');
      if (submit && submit.getAttribute('aria-disabled') !== 'true') target = submit;
    }
    if (!target && !this.#single(qs))
      target = this.#cardOf(qs[qi].id)?.querySelector<HTMLElement>('.cf-change') ?? null;
    if (!target) return;
    target.focus({ preventScroll: true });
    (card ?? target).scrollIntoView?.({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  #change(qid: string): void {
    const d = this.data;
    if (!d) return;
    const qs = this.#sync(d);
    const qi = qs.findIndex((q) => q.id === qid);
    if (qi < 0 || this.#busy(d)) return;
    const a = this.#answers[qid];
    if (a && a.choiceId === undefined && a.custom !== undefined && !this.#drafts.get(qid))
      this.#drafts.set(qid, a.custom);
    this.#editing.add(qid);
    this.#active = qi;
    this.renderNow();
    this.#stopOf(qid)?.focus({ preventScroll: true });
  }

  /** Esc in a reopened card: fold it back to its answer. */
  #fold(qid: string): void {
    if (!this.#editing.delete(qid)) return;
    this.#invalid.delete(qid);
    this.renderNow();
    this.#cardOf(qid)?.querySelector<HTMLElement>('.cf-change')?.focus({ preventScroll: true });
  }

  #reset(): void {
    const d = this.data;
    if (!d) return;
    const qs = this.#sync(d);
    if (this.#busy(d)) return;
    const had = Object.keys(this.#answers).length > 0;
    this.#answers = {};
    this.#editing.clear();
    this.#drafts.clear();
    this.#invalid.clear();
    this.#active = 0;
    this.renderNow();
    if (qs[0]) this.#stopOf(qs[0].id)?.focus({ preventScroll: true });
    this.#say(this.#t.cleared);
    if (had)
      this.notify<ChoiceFormChangeDetail>('ui-change', { answers: [], answered: 0, total: qs.length, reason: 'reset' });
  }

  #submit(source: ChoiceFormSource): void {
    const d = this.data;
    if (!d || d.submitted) return;
    const qs = this.#sync(d);
    if (this.#busy(d)) return;
    if (source === 'recommended') {
      if (this.#single(qs) || !choiceFormHero(qs, this.#answers).enabled) return;
      this.#send(choiceFormRecommendedAnswers(qs, this.#answers).answers, source, qs, { source });
      return;
    }
    if (!choiceFormCanSubmit(qs, this.#answers, !!d.allowPartial)) return;
    this.#send(this.#answers, source, qs, { source });
  }

  /** Emit `ui-submit`; not cancelled → the answers are kept and the form locks until the host assigns data again. */
  #send(answers: ChoiceFormAnswers, source: ChoiceFormSource, qs: ChoiceFormQuestion[], sending: Sending): void {
    const ok = this.emit<ChoiceFormSubmitDetail>('ui-submit', { answers: choiceFormAnswerList(qs, answers), source });
    if (!ok) return;
    // A listener may already have replaced the form (another identity): that one starts clean.
    if (this.data && choiceFormKey(this.data) !== this.#key) {
      this.renderNow();
      return;
    }
    this.#answers = answers;
    this.#editing.clear();
    this.#invalid.clear();
    this.#sending = sending;
    this.#lastSent = sending;
    this.#sentFor = this.data;
    this.renderNow();
  }

  /** Digits pick, arrows walk the choices, Enter confirms an own answer, Esc folds a reopened card, ⌘/Ctrl+Enter submits. */
  #onKey(e: KeyboardEvent): void {
    const d = this.data;
    if (!d || e.defaultPrevented || d.submitted) return;
    const target = e.target as HTMLElement | null;
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      const btn = this.$<HTMLElement>('.cf-submit');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      btn.click();
      return;
    }
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    const card = target?.closest?.('.cf-q') as HTMLElement | null;
    const qid = card ? str(card.dataset.q) : '';
    if (e.key === 'Escape' && card && this.#editing.has(qid)) {
      e.preventDefault();
      e.stopPropagation();
      this.#fold(qid);
      return;
    }
    if (target?.matches?.('input, textarea')) {
      if (e.key === 'Enter' && target.matches('.cf-input') && !e.isComposing) {
        e.preventDefault();
        this.#confirmCustom(str(target.dataset.q));
      }
      return;
    }
    if (/^[1-9]$/.test(e.key) && !e.shiftKey) {
      const qs = this.#sync(d);
      const q = card ? qs.find((x) => x.id === qid) : qs[this.#current(qs)];
      if (!q || !this.#isOpen(q, qs)) return;
      const c = choiceFormOrder(q.choices)[Number(e.key) - 1];
      if (!c) return;
      e.preventDefault();
      this.#pick(q.id, c.id);
      return;
    }
    const choice = target?.closest?.('.cf-choice') as HTMLElement | null;
    if (!choice || !ARROWS.includes(e.key)) return;
    const list = Array.from(choice.parentElement?.querySelectorAll<HTMLElement>('.cf-choice') ?? []);
    const i = list.indexOf(choice);
    const n = list.length;
    if (i < 0 || !n) return;
    const to =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? n - 1
          : e.key === 'ArrowDown' || e.key === 'ArrowRight'
            ? (i + 1) % n
            : (i - 1 + n) % n;
    e.preventDefault();
    list.forEach((b, k) => {
      b.tabIndex = k === to ? 0 : -1;
    });
    list[to].focus();
  }

  #onInput(e: Event): void {
    const input = e.target as HTMLInputElement | null;
    if (!input?.matches?.('.cf-input')) return;
    const qid = str(input.dataset.q);
    this.#drafts.set(qid, input.value);
    const confirm = this.$$<HTMLElement>('.cf-confirm').find((b) => b.dataset.q === qid);
    const d = this.data;
    confirm?.setAttribute('aria-disabled', String(!input.value.trim() || (!!d && this.#busy(d))));
    if (this.#invalid.has(qid) && input.value.trim()) {
      this.#invalid.delete(qid);
      this.requestRender();
    }
  }

  #onFocusIn(e: Event): void {
    const d = this.data;
    const card = (e.target as Element | null)?.closest?.('.cf-q') as HTMLElement | null;
    if (!d || !card || d.submitted) return;
    const qs = this.#sync(d);
    const qi = qs.findIndex((q) => q.id === card.dataset.q);
    if (qi < 0 || qi === this.#active || !this.#isOpen(qs[qi], qs)) return;
    this.#active = qi;
    this.requestRender();
  }

  #onTransitionEnd(e: TransitionEvent): void {
    if (e.propertyName !== 'grid-template-rows') return;
    const x = e.target as HTMLElement | null;
    const key = x?.dataset?.x;
    if (!x?.matches?.('.cf-x[data-open]') || !key) return;
    this.#settled.add(key);
    x.setAttribute('data-settled', '');
  }

  #say(text: string): void {
    if (this.#live.textContent === text) this.#live.textContent = '';
    this.#live.textContent = text;
  }

  // ── Lookups ───────────────────────────────────────────────────────────────

  #cardOf(qid: string): HTMLElement | null {
    return this.$$<HTMLElement>('.cf-q').find((c) => c.dataset.q === qid) ?? null;
  }

  #inputOf(qid: string): HTMLInputElement | null {
    return this.$$<HTMLInputElement>('.cf-input').find((c) => c.dataset.q === qid) ?? null;
  }

  /** Where focus lands in a question: its own answer when that is the answer, else the choices' tab stop. */
  #stopOf(qid: string): HTMLElement | null {
    const card = this.#cardOf(qid);
    if (!card) return null;
    const a = this.#answers[qid];
    if (a && a.choiceId === undefined && a.custom !== undefined) {
      const input = this.#inputOf(qid);
      if (input) return input;
    }
    return (
      card.querySelector<HTMLElement>('.cf-choice[tabindex="0"]') ??
      card.querySelector<HTMLElement>('.cf-choice') ??
      this.#inputOf(qid)
    );
  }

  #landing(): HTMLElement | null {
    const done = this.$<HTMLElement>('.cf-done');
    if (done) return done;
    const d = this.data;
    if (!d) return null;
    const qs = this.#sync(d);
    const cur = this.#current(qs);
    if (cur >= 0) {
      const stop = this.#stopOf(qs[cur].id);
      if (stop) return stop;
    }
    return this.$<HTMLElement>('.cf-submit') ?? this.$<HTMLElement>('.cf-change');
  }

  // ── Render cycle ──────────────────────────────────────────────────────────

  /** Morph in place: open regions keep their transition, the focused control stays the same node. */
  protected override update(): void {
    const d = this.data;
    const hadFocus = this.#focusInside();
    if (d) this.#sync(d);
    const next = !d ? '' : d.submitted ? 'done' : 'form';
    const prev = this.#layout;
    this.#enter = !!prev && !!next && prev !== next;
    this.#layout = next;
    morphInto(this.content, this.render());
    this.#enter = false;
    this.#prevOpen = this.#nowOpen;
    this.#nowOpen = new Map();
    this.updated();
    if (prev === 'form' && next === 'done') this.#say(this.#t.submittedSay);
    if (hadFocus && !this.#focusInside()) this.#landing()?.focus({ preventScroll: true });
  }

  #focusInside(): boolean {
    try {
      const a = this.root.activeElement;
      return !!a && this.content.contains(a);
    } catch {
      return false;
    }
  }

  protected override updated(): void {
    this.#painted = true;
    // A typed value is a property, not the attribute: bring every own-answer box in line with its draft.
    for (const input of this.$$<HTMLInputElement>('.cf-input')) {
      const draft = str(this.#drafts.get(str(input.dataset.q)));
      if (input.value !== draft) input.value = draft;
    }
  }

  protected render(): string {
    const d = this.data;
    if (!d) return '';
    const qs = choiceFormQuestions(d.questions);
    if (!qs.length) return '';
    return d.submitted ? this.#summary(d, qs, this.#t) : this.#form(d, qs, this.#t);
  }

  /** An expand region's attributes; tracks which regions are open and which finished opening. */
  #region(key: string, open: boolean): string {
    const was = this.#prevOpen.get(key);
    if (!open) this.#settled.delete(key);
    else if (was === undefined || !this.#painted || prefersReducedMotion()) this.#settled.add(key);
    else if (!was) this.#settled.delete(key);
    this.#nowOpen.set(key, open);
    return ` data-x="${escAttr(key)}"${open ? ' data-open' : ' inert'}${open && this.#settled.has(key) ? ' data-settled' : ''}`;
  }

  #form(d: ChoiceFormData, qs: ChoiceFormQuestion[], t: ChoiceFormStrings): string {
    const single = this.#single(qs);
    const busy = this.#busy(d);
    const spin = this.#spin(d, qs);
    const p = choiceFormProgress(qs, this.#answers);
    const current = this.#current(qs);
    const canSubmit = choiceFormCanSubmit(qs, this.#answers, !!d.allowPartial);
    const pickSubmits = this.#pickSubmits(d, qs);
    const title = str(d.title);
    const desc = str(d.description);

    const progress = single
      ? ''
      : `<div class="cf-progress"><span class="cf-dots" aria-hidden="true">${qs
          .map((q, i) => {
            const state = i === current ? 'current' : p.states[i] === 'answered' ? 'answered' : 'pending';
            return `<span class="cf-dot" data-mk="${escAttr(q.id)}" data-state="${state}"></span>`;
          })
          .join(
            '',
          )}</span><span class="cf-progress-text" id="cf-progress">${esc(t.progress(p.answered, p.total))}</span></div>`;
    const head =
      title || desc || progress
        ? `<div class="cf-head"><div class="cf-titles">${title ? `<div class="cf-title" id="cf-title">${esc(title)}</div>` : ''}${
            desc ? `<div class="cf-desc cf-md">${answerMarkdown(desc)}</div>` : ''
          }</div>${progress}</div>`
        : '';

    let hero = '';
    if (!single) {
      const h = choiceFormHero(qs, this.#answers);
      if (h.show) {
        const meta = h.missing ? t.heroMissing(h.missing) : h.fill ? t.heroFill(h.fill) : t.heroDone;
        const spinning = spin?.source === 'recommended';
        hero = `<button type="button" class="cf-hero" data-act="recommended" data-key="hero" aria-describedby="cf-hero-meta"${
          h.enabled && !busy ? '' : ' aria-disabled="true"'
        }${spinning ? ' aria-busy="true"' : ''}><span class="cf-hero-dot" aria-hidden="true"></span><span class="cf-hero-label">${esc(
          t.heroLabel,
        )}</span><span class="cf-hero-meta" id="cf-hero-meta" aria-hidden="true">${esc(meta)}</span>${
          spinning ? SPIN : icon('arrow-right', { size: 14, class: 'cf-hero-arrow' })
        }</button>`;
      }
    }

    const cards = qs.map((q, i) => this.#card(q, i, qs.length, { single, busy, spin, current }, t)).join('');

    const err = str(d.error);
    const error =
      err && !busy
        ? `<p class="cf-error" role="alert">${icon('alert', { size: 14, class: 'cf-error-icon' })}<span>${esc(err)}</span></p>`
        : '';
    let row = '';
    if (!pickSubmits) {
      const need = single ? 0 : d.allowPartial ? (p.answered ? 0 : 1) : p.total - p.answered;
      const canReset = Object.keys(this.#answers).length > 0 || this.#editing.size > 0 || this.#drafts.size > 0;
      const spinSubmit = spin?.source === 'submit';
      const reset = single
        ? ''
        : `<button type="button" class="cf-btn cf-reset" data-act="reset" data-key="reset"${
            canReset && !busy ? '' : ' aria-disabled="true"'
          }>${esc(t.reset)}</button>`;
      const submit = `<button type="button" class="cf-btn cf-submit" data-act="submit" data-key="submit" aria-keyshortcuts="Meta+Enter Control+Enter"${
        canSubmit && !busy ? '' : ' aria-disabled="true"'
      }${need ? ' aria-describedby="cf-hint"' : ''}${spinSubmit ? ' aria-busy="true"' : ''}>${spinSubmit ? SPIN : ''}${esc(
        spinSubmit ? t.submitting : t.submit,
      )}${spinSubmit ? '' : `<kbd class="cf-kbd" aria-hidden="true">${esc(KBD_ENTER)}</kbd>`}</button>`;
      row = `<div class="cf-foot-row">${need ? `<span class="cf-hint" id="cf-hint">${esc(t.needMore(need))}</span>` : ''}<div class="cf-actions">${reset}${submit}</div></div>`;
    }
    const foot = error || row ? `<div class="cf-foot">${error}${row}</div>` : '';

    return `<div class="cf" data-mk="form" data-mode="${single ? 'single' : 'multi'}" role="group"${
      title ? ' aria-labelledby="cf-title"' : ''
    }${busy ? ' aria-busy="true"' : ''}>${head}${hero}<div class="cf-list">${cards}</div>${foot}</div>`;
  }

  #card(
    q: ChoiceFormQuestion,
    i: number,
    n: number,
    ctx: { single: boolean; busy: boolean; spin: Sending | null; current: number },
    t: ChoiceFormStrings,
  ): string {
    const { single, busy, spin } = ctx;
    const a = this.#answers[q.id];
    const answered = choiceFormValid(q, a);
    const editing = answered && !single && this.#editing.has(q.id);
    const open = single || !answered || editing;
    const state = answered && !editing ? 'answered' : i === ctx.current ? 'current' : 'pending';
    const ids = { t: `cf-q${i}-t`, c: `cf-q${i}-c`, e: `cf-q${i}-e` };
    const rec = choiceFormRecommended(q);
    const order = choiceFormOrder(q.choices);
    const selId = answered && a.choiceId !== undefined ? a.choiceId : undefined;
    const stop = selId !== undefined ? selId : order[0]?.id;
    const off = busy ? ' aria-disabled="true"' : '';
    const title = str(q.title);

    const num = single
      ? ''
      : `<span class="cf-num" aria-hidden="true">${answered && !editing ? icon('check', { size: 12, stroke: 1.8 }) : i + 1}</span>`;
    const head = `<div class="cf-q-head">${num}<div class="cf-q-title" id="${ids.t}">${
      single ? '' : `<span class="sr-only">${esc(t.question(i + 1, n))}: </span>`
    }${esc(title)}</div></div>`;
    const context = q.context ? `<div class="cf-ctx cf-md" id="${ids.c}">${answerMarkdown(str(q.context))}</div>` : '';

    let picked = '';
    if (!single) {
      let chip = '';
      if (answered) {
        const c = a.choiceId !== undefined ? q.choices.find((x) => x.id === a.choiceId) : undefined;
        const label = c ? str(c.label) : str(a.custom);
        chip = `<div class="cf-picked"><span class="cf-chip">${icon('check', { size: 14, stroke: 1.8, class: 'cf-chip-check' })}<span class="cf-chip-label"><span class="sr-only">${esc(
          t.picked,
        )}: </span>${esc(label)}</span>${c ? '' : `<span class="cf-tag">${esc(t.custom)}</span>`}${
          c && rec?.id === c.id
            ? `<span class="cf-tag cf-tag-rec"><span class="cf-rec-dot" aria-hidden="true"></span>${esc(t.recommended)}</span>`
            : ''
        }</span><button type="button" class="cf-change" data-act="change" data-q="${escAttr(q.id)}" data-key="${escAttr(
          `change:${q.id}`,
        )}" aria-label="${escAttr(t.changeLabel(title))}"${off}>${icon('edit', { size: 12 })}<span>${esc(t.change)}</span></button></div>`;
      }
      picked = `<div class="cf-x"${this.#region(`p:${q.id}`, answered && !editing)}><div class="cf-x-in">${chip}</div></div>`;
    }

    const choices = order
      .map((c, k) => {
        const on = selId === c.id;
        const isRec = rec?.id === c.id;
        const spinning = !!spin && spin.questionId === q.id && spin.choiceId === c.id;
        const descId = c.description ? `cf-q${i}-d${k}` : '';
        const key = spinning ? SPIN : on ? icon('check', { size: 12, stroke: 1.8 }) : k < 9 ? String(k + 1) : '';
        return `<button type="button" class="cf-choice" data-act="pick" data-mk="${escAttr(c.id)}" data-q="${escAttr(
          q.id,
        )}" data-choice="${escAttr(c.id)}" data-key="${escAttr(`pick:${q.id}:${c.id}`)}" tabindex="${
          stop === c.id ? 0 : -1
        }" aria-pressed="${on}"${isRec ? ' data-rec' : ''}${k < 9 ? ` aria-keyshortcuts="${k + 1}"` : ''}${
          descId ? ` aria-describedby="${descId}"` : ''
        }${off}${spinning ? ' aria-busy="true"' : ''}><span class="cf-key" aria-hidden="true">${key}</span><span class="cf-choice-main"><span class="cf-choice-label">${esc(
          c.label,
        )}${
          isRec
            ? `<span class="cf-rec"><span class="cf-rec-dot" aria-hidden="true"></span>${esc(t.recommended)}</span>`
            : ''
        }</span>${c.description ? `<span class="cf-choice-desc" id="${descId}" aria-hidden="true">${esc(c.description)}</span>` : ''}</span></button>`;
      })
      .join('');

    let custom = '';
    if (q.allowCustom) {
      const draft = str(this.#drafts.get(q.id));
      const invalid = this.#invalid.has(q.id);
      const spinning = !!spin && spin.questionId === q.id && spin.choiceId === undefined;
      custom = `<div class="cf-custom"><input type="text" class="cf-input" data-q="${escAttr(q.id)}" data-key="${escAttr(
        `custom:${q.id}`,
      )}" aria-label="${escAttr(t.customLabel(title))}" placeholder="${escAttr(
        str(q.customPlaceholder) || t.customPlaceholder,
      )}" value="${escAttr(draft)}" autocomplete="off" enterkeyhint="done"${
        invalid ? ` aria-invalid="true" aria-describedby="${ids.e}"` : ''
      }${busy ? ' readonly aria-disabled="true"' : ''}><button type="button" class="cf-btn cf-confirm" data-act="custom" data-q="${escAttr(
        q.id,
      )}" data-key="${escAttr(`confirm:${q.id}`)}"${draft.trim() && !busy ? '' : ' aria-disabled="true"'}${
        spinning ? ' aria-busy="true"' : ''
      }>${spinning ? SPIN : ''}${esc(t.confirm)}</button></div>${
        invalid
          ? `<p class="cf-invalid" id="${ids.e}">${icon('alert', { size: 12 })}<span>${esc(t.customEmpty)}</span></p>`
          : ''
      }`;
    }

    const body = `<div class="cf-x"${this.#region(`c:${q.id}`, open)}><div class="cf-x-in"><div class="cf-body">${
      choices ? `<div class="cf-choices">${choices}</div>` : ''
    }${custom}</div></div></div>`;

    return `<div class="cf-q" role="group" data-mk="${escAttr(`q:${q.id}`)}" data-q="${escAttr(q.id)}" data-state="${state}"${
      editing ? ' data-editing' : ''
    } aria-labelledby="${ids.t}"${q.context ? ` aria-describedby="${ids.c}"` : ''}>${head}${context}${picked}${body}</div>`;
  }

  #summary(d: ChoiceFormData, qs: ChoiceFormQuestion[], t: ChoiceFormStrings): string {
    const single = this.#single(qs);
    const answers = d.answers ? choiceFormNormalize(qs, d.answers) : this.#answers;
    const list = choiceFormAnswerList(qs, answers);
    const title = str(d.title);
    const rows = qs
      .map((q, i) => {
        const a = list.find((x) => x.questionId === q.id);
        const value = a
          ? `${esc(a.label)}${a.custom !== undefined ? `<span class="cf-tag">${esc(t.custom)}</span>` : ''}${
              a.recommended
                ? `<span class="cf-tag cf-tag-rec"><span class="cf-rec-dot" aria-hidden="true"></span>${esc(t.recommended)}</span>`
                : ''
            }`
          : `<span class="cf-none">${esc(t.noAnswer)}</span>`;
        return `<div class="cf-sum-row"><dt>${single ? '' : `<span class="cf-sum-num" aria-hidden="true">${i + 1}</span>`}<span class="cf-sum-q">${esc(
          q.title,
        )}</span></dt><dd>${value}</dd></div>`;
      })
      .join('');
    return `<div class="cf cf-done${this.#enter ? ' is-enter' : ''}" data-mk="done" role="group" tabindex="-1" data-key="done" aria-labelledby="cf-done-h"><div class="cf-done-head" id="cf-done-h"><span class="cf-done-mark" aria-hidden="true">${icon(
      'check',
      { size: 12, stroke: 1.9 },
    )}</span><span class="cf-done-word">${esc(t.submitted)}</span>${
      title ? `<span class="cf-done-title">${esc(title)}</span>` : ''
    }</div><dl class="cf-sum"${single ? '' : ' data-numbered'}>${rows}</dl></div>`;
  }
}

define('ui-choice-form', UiChoiceForm);

declare global {
  interface HTMLElementTagNameMap {
    'ui-choice-form': UiChoiceForm;
  }
}
