/** One answer option of a question. */
export interface ChoiceFormChoice {
  id: string;
  label: string;
  /** A quieter second line under the label. */
  description?: string;
  /** The agent's suggestion: listed first, marked “Recommended”, used by “Submit all recommended”. First one wins. */
  recommended?: boolean;
}

export interface ChoiceFormQuestion {
  id: string;
  title: string;
  /** Markdown shown under the title (code spans, links, lists; escaped, http(s) links only). */
  context?: string;
  choices: ChoiceFormChoice[];
  /** Offer a free-text answer under the choices. */
  allowCustom?: boolean;
  customPlaceholder?: string;
}

/** A question's answer: a choice id, or the person's own text. */
export interface ChoiceFormAnswer {
  choiceId?: string;
  custom?: string;
}

/** Answers by question id. */
export type ChoiceFormAnswers = Record<string, ChoiceFormAnswer>;

export interface ChoiceFormData {
  /**
   * Identity of this form. A new `id` — or a different set of question ids — starts clean: the working answers are
   * re-seeded from `answers`. The same identity keeps the person's working answers across data updates.
   */
  id?: string;
  title?: string;
  /** Markdown under the title. */
  description?: string;
  questions: ChoiceFormQuestion[];
  /** Seed answers (read when the form's identity changes; the element keeps its own working answers after that). */
  answers?: ChoiceFormAnswers;
  /** The host is sending the answers: busy, every control locked. */
  submitting?: boolean;
  /** Sent: a read-only summary (of `answers` when given, else of the answers this element sent). */
  submitted?: boolean;
  /** Why the last submit failed: an alert line; the form stays usable. */
  error?: string;
  /** Submit is enabled once at least one question is answered (default: every question). */
  allowPartial?: boolean;
  /** One question only: a pick sends `ui-submit` at once. Default true with one question; ignored with more. */
  submitOnPick?: boolean;
  /**
   * Whether this person may answer. `false` locks the form (every control stays visible, none pressable) with a
   * generic line; a string locks it and says why (“Only the session owner can answer”, “Answered in another tab”).
   * Default: answerable.
   */
  canAnswer?: boolean | string;
}

/** One answer as it leaves the element (`ui-submit`, `ui-change`, the `answers` getter). */
export interface ChoiceFormAnswerOut {
  questionId: string;
  choiceId?: string;
  /** The choice's label, or the custom text. */
  label: string;
  custom?: string;
  /** Present (true) when the picked choice is the recommended one. */
  recommended?: boolean;
}

export type ChoiceFormSource = 'submit' | 'recommended';

/** `ui-submit` (cancelable): the answers to send and which button sent them. */
export interface ChoiceFormSubmitDetail {
  answers: ChoiceFormAnswerOut[];
  source: ChoiceFormSource;
}

/** `ui-change` (notify): the working answers after a pick, a custom answer or Reset. */
export interface ChoiceFormChangeDetail {
  answers: ChoiceFormAnswerOut[];
  answered: number;
  total: number;
  reason: 'pick' | 'custom' | 'reset';
  /** The question that changed (not on reset). */
  questionId?: string;
}

export type ChoiceFormAction =
  | { type: 'pick'; questionId: string; choiceId: string }
  | { type: 'custom'; questionId: string; text: string }
  | { type: 'clear'; questionId: string }
  | { type: 'reset' };

export interface ChoiceFormProgress {
  answered: number;
  total: number;
  /** Every question has an answer. */
  complete: boolean;
  /** Per question, in order. */
  states: Array<'answered' | 'open'>;
}

/** “Submit all recommended”: shown, pressable, how many questions it fills, how many block it. */
export interface ChoiceFormHero {
  show: boolean;
  enabled: boolean;
  fill: number;
  missing: number;
}

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

/** Questions the element can draw: objects with an id (first of a duplicate id wins), choices with ids. */
export function choiceFormQuestions(list: unknown): ChoiceFormQuestion[] {
  const out: ChoiceFormQuestion[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(list) ? list : []) {
    if (!raw || typeof raw !== 'object') continue;
    const q = raw as ChoiceFormQuestion;
    const id = str(q.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const ids = new Set<string>();
    const choices: ChoiceFormChoice[] = [];
    for (const c of Array.isArray(q.choices) ? q.choices : []) {
      if (!c || typeof c !== 'object') continue;
      const cid = str(c.id);
      if (!cid || ids.has(cid)) continue;
      ids.add(cid);
      choices.push({ ...c, id: cid, label: str(c.label) || cid });
    }
    out.push({ ...q, id, title: str(q.title), choices });
  }
  return out;
}

/** The recommended choice (the first one flagged), if any. */
export function choiceFormRecommended(q: Pick<ChoiceFormQuestion, 'choices'>): ChoiceFormChoice | undefined {
  return (q.choices ?? []).find((c) => c?.recommended);
}

/** Display order: the recommended choice first, the rest as given. Digit keys follow this order. */
export function choiceFormOrder(choices: ChoiceFormChoice[]): ChoiceFormChoice[] {
  const rec = choices.find((c) => c.recommended);
  return rec ? [rec, ...choices.filter((c) => c !== rec)] : choices.slice();
}

/** True when `a` is a usable answer to `q` (a choice it has, or non-empty custom text it allows). */
export function choiceFormValid(q: ChoiceFormQuestion, a: ChoiceFormAnswer | undefined): boolean {
  if (!a || typeof a !== 'object') return false;
  if (a.choiceId !== undefined && a.choiceId !== null) return q.choices.some((c) => c.id === str(a.choiceId));
  return !!q.allowCustom && str(a.custom).trim() !== '';
}

/** Keep only answers that still fit the questions (unknown question, removed choice or empty text dropped). */
export function choiceFormNormalize(questions: ChoiceFormQuestion[], answers: unknown): ChoiceFormAnswers {
  const out: ChoiceFormAnswers = {};
  if (!answers || typeof answers !== 'object') return out;
  const map = answers as ChoiceFormAnswers;
  for (const q of questions) {
    if (!Object.hasOwn(map, q.id)) continue;
    const a = map[q.id];
    if (!choiceFormValid(q, a)) continue;
    out[q.id] =
      a.choiceId !== undefined && a.choiceId !== null
        ? { choiceId: str(a.choiceId) }
        : { custom: str(a.custom).trim() };
  }
  return out;
}

/**
 * The answers reducer: pick a choice, set custom text (trimmed; empty or not allowed → unchanged), clear one, reset.
 * Returns the same object when nothing changed.
 */
export function choiceFormReduce(
  answers: ChoiceFormAnswers,
  action: ChoiceFormAction,
  questions: ChoiceFormQuestion[],
): ChoiceFormAnswers {
  if (action.type === 'reset') return Object.keys(answers).length ? {} : answers;
  const q = questions.find((x) => x.id === action.questionId);
  if (!q) return answers;
  const cur = answers[q.id];
  if (action.type === 'clear') {
    if (!cur) return answers;
    const next = { ...answers };
    delete next[q.id];
    return next;
  }
  if (action.type === 'pick') {
    if (!q.choices.some((c) => c.id === action.choiceId)) return answers;
    if (cur?.choiceId === action.choiceId) return answers;
    return { ...answers, [q.id]: { choiceId: action.choiceId } };
  }
  const text = str(action.text).trim();
  if (!q.allowCustom || !text) return answers;
  if (cur && cur.choiceId === undefined && cur.custom === text) return answers;
  return { ...answers, [q.id]: { custom: text } };
}

/** How far along the form is. */
export function choiceFormProgress(questions: ChoiceFormQuestion[], answers: ChoiceFormAnswers): ChoiceFormProgress {
  const states = questions.map((q): 'answered' | 'open' => (choiceFormValid(q, answers[q.id]) ? 'answered' : 'open'));
  const answered = states.filter((s) => s === 'answered').length;
  return { answered, total: questions.length, complete: questions.length > 0 && answered === questions.length, states };
}

/** The next unanswered question after index `from` (wrapping, `from` itself last), or -1 when all are answered. */
export function choiceFormNext(questions: ChoiceFormQuestion[], answers: ChoiceFormAnswers, from: number): number {
  const n = questions.length;
  for (let k = 1; k <= n; k++) {
    const i = (((from + k) % n) + n) % n;
    if (!choiceFormValid(questions[i], answers[questions[i].id])) return i;
  }
  return -1;
}

/** Submit is allowed: every question answered — or, with `allowPartial`, at least one. */
export function choiceFormCanSubmit(
  questions: ChoiceFormQuestion[],
  answers: ChoiceFormAnswers,
  allowPartial = false,
): boolean {
  const p = choiceFormProgress(questions, answers);
  return allowPartial ? p.answered > 0 : p.complete;
}

/**
 * What “Submit all recommended” would send: the person's answers stay; every unanswered question takes its
 * recommended choice. `filled` = question ids it fills, `missing` = unanswered questions without a recommendation.
 */
export function choiceFormRecommendedAnswers(
  questions: ChoiceFormQuestion[],
  answers: ChoiceFormAnswers,
): { answers: ChoiceFormAnswers; filled: string[]; missing: string[] } {
  const out: ChoiceFormAnswers = {};
  const filled: string[] = [];
  const missing: string[] = [];
  for (const q of questions) {
    const a = answers[q.id];
    if (choiceFormValid(q, a)) {
      out[q.id] = a;
      continue;
    }
    const rec = choiceFormRecommended(q);
    if (rec) {
      out[q.id] = { choiceId: rec.id };
      filled.push(q.id);
    } else missing.push(q.id);
  }
  return { answers: out, filled, missing };
}

/**
 * The hero rule: shown when at least one question has a recommended choice; pressable when every unanswered question
 * has one (so the result is a complete set) and there is at least one left to fill.
 */
export function choiceFormHero(questions: ChoiceFormQuestion[], answers: ChoiceFormAnswers): ChoiceFormHero {
  const show = questions.some((q) => !!choiceFormRecommended(q));
  const r = choiceFormRecommendedAnswers(questions, answers);
  return {
    show,
    enabled: show && r.missing.length === 0 && r.filled.length > 0,
    fill: r.filled.length,
    missing: r.missing.length,
  };
}

/** The answers as they leave the element, in question order (unanswered questions left out). */
export function choiceFormAnswerList(
  questions: ChoiceFormQuestion[],
  answers: ChoiceFormAnswers,
): ChoiceFormAnswerOut[] {
  const out: ChoiceFormAnswerOut[] = [];
  for (const q of questions) {
    const a = answers[q.id];
    if (!choiceFormValid(q, a)) continue;
    if (a.choiceId !== undefined && a.choiceId !== null) {
      const c = q.choices.find((x) => x.id === str(a.choiceId))!;
      const item: ChoiceFormAnswerOut = { questionId: q.id, choiceId: c.id, label: str(c.label) };
      if (choiceFormRecommended(q)?.id === c.id) item.recommended = true;
      out.push(item);
    } else {
      const text = str(a.custom).trim();
      out.push({ questionId: q.id, label: text, custom: text });
    }
  }
  return out;
}

/** The form's identity: `id` (when given) plus the question ids in order. */
export function choiceFormKey(d: Pick<ChoiceFormData, 'id' | 'questions'> | undefined): string {
  if (!d) return '';
  const qs = choiceFormQuestions(d.questions).map((q) => q.id);
  return JSON.stringify([str(d.id), qs]);
}

/** The form is locked: `canAnswer` is `false` or a reason string. */
export function choiceFormLocked(canAnswer: unknown): boolean {
  return canAnswer === false || typeof canAnswer === 'string';
}

/** Why the form is locked ('' when it just is, or is not). */
export function choiceFormLockReason(canAnswer: unknown): string {
  return typeof canAnswer === 'string' ? canAnswer.trim() : '';
}
