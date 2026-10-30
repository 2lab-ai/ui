import { beforeEach, describe, expect, it } from 'vitest';
import type { UiChoiceForm } from './choice-form';
import './choice-form';
import {
  type ChoiceFormChangeDetail,
  type ChoiceFormData,
  type ChoiceFormQuestion,
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
import { choiceFormStrings } from './strings';

const XSS = '<img src=x onerror=alert(1)>';

const QS: ChoiceFormQuestion[] = [
  {
    id: 'store',
    title: 'Where should the index live?',
    context: 'Today: `data/uploads.json` — see [the docs](https://example.com/pg).',
    choices: [
      { id: 'sqlite', label: 'SQLite', description: 'One file' },
      { id: 'pg', label: 'Postgres', recommended: true },
      { id: 'json', label: 'Keep JSON' },
    ],
  },
  {
    id: 'backfill',
    title: 'How should old uploads move?',
    choices: [
      { id: 'bg', label: 'Background', recommended: true },
      { id: 'deploy', label: 'During deploy' },
    ],
    allowCustom: true,
  },
  {
    id: 'table',
    title: 'Table name?',
    choices: [
      { id: 'uploads', label: 'uploads' },
      { id: 'upload_index', label: 'upload_index' },
    ],
    allowCustom: true,
  },
];

const form = (over: Partial<ChoiceFormData> = {}): ChoiceFormData => ({
  id: 'f1',
  title: 'Before I migrate',
  questions: QS,
  ...over,
});
const single = (over: Partial<ChoiceFormData> = {}): ChoiceFormData => ({
  id: 's1',
  questions: [
    {
      id: 'tests',
      title: 'Run the suite?',
      choices: [
        { id: 'full', label: 'Full suite', recommended: true },
        { id: 'skip', label: 'Skip' },
      ],
    },
  ],
  ...over,
});

function mount(data: ChoiceFormData, attrs: Record<string, string> = {}): UiChoiceForm {
  const el = document.createElement('ui-choice-form');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = <T extends Element = HTMLElement>(el: UiChoiceForm, sel: string) =>
  el.shadowRoot?.querySelector<T>(sel) ?? null;
const qa = <T extends Element = HTMLElement>(el: UiChoiceForm, sel: string) => [
  ...(el.shadowRoot?.querySelectorAll<T>(sel) ?? []),
];
const card = (el: UiChoiceForm, qid: string) => qa(el, '.cf-q').find((c) => c.dataset.q === qid)!;
const choice = (el: UiChoiceForm, qid: string, cid: string) =>
  qa(el, '.cf-choice').find((b) => b.dataset.q === qid && b.dataset.choice === cid)!;
const input = (el: UiChoiceForm, qid: string) =>
  qa<HTMLInputElement>(el, '.cf-input').find((i) => i.dataset.q === qid)!;
const active = (el: UiChoiceForm) => el.shadowRoot?.activeElement as HTMLElement | null;
const live = (el: UiChoiceForm) => q(el, '[role="status"]')?.textContent ?? '';
function events<T>(el: UiChoiceForm, name: string): T[] {
  const out: T[] = [];
  el.addEventListener(name, (e) => out.push((e as CustomEvent<T>).detail));
  return out;
}
function key(target: Element, k: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
}
function type(i: HTMLInputElement, value: string): void {
  i.value = value;
  i.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

// ── Pure helpers ────────────────────────────────────────────────────────────

describe('helpers', () => {
  it('normalizes questions: ids required, first duplicate wins, labels default to the id', () => {
    const qs = choiceFormQuestions([
      null,
      { title: 'no id', choices: [] },
      { id: 'a', title: 'A', choices: [{ id: 'x' }, { id: 'x', label: 'dup' }, null, { id: '' }] },
      { id: 'a', title: 'again', choices: [] },
      { id: 'b', title: 'B' },
    ]);
    expect(qs.map((x) => x.id)).toEqual(['a', 'b']);
    expect(qs[0].choices).toEqual([{ id: 'x', label: 'x' }]);
    expect(qs[1].choices).toEqual([]);
    expect(choiceFormQuestions(undefined)).toEqual([]);
  });

  it('puts the recommended choice first and finds it', () => {
    expect(choiceFormOrder(QS[0].choices).map((c) => c.id)).toEqual(['pg', 'sqlite', 'json']);
    expect(choiceFormOrder(QS[2].choices).map((c) => c.id)).toEqual(['uploads', 'upload_index']);
    expect(choiceFormRecommended(QS[0])?.id).toBe('pg');
    expect(choiceFormRecommended(QS[2])).toBeUndefined();
  });

  it('validates an answer against its question', () => {
    expect(choiceFormValid(QS[0], { choiceId: 'pg' })).toBe(true);
    expect(choiceFormValid(QS[0], { choiceId: 'nope' })).toBe(false);
    expect(choiceFormValid(QS[0], { custom: 'mine' })).toBe(false);
    expect(choiceFormValid(QS[1], { custom: 'mine' })).toBe(true);
    expect(choiceFormValid(QS[1], { custom: '   ' })).toBe(false);
    expect(choiceFormValid(QS[1], undefined)).toBe(false);
  });

  it('normalizes answers: unknown questions, removed choices, empty or disallowed text dropped; text trimmed', () => {
    expect(
      choiceFormNormalize(QS, {
        store: { choiceId: 'pg' },
        backfill: { custom: '  later  ' },
        table: { choiceId: 'gone' },
        ghost: { choiceId: 'pg' },
      }),
    ).toEqual({ store: { choiceId: 'pg' }, backfill: { custom: 'later' } });
    expect(choiceFormNormalize(QS, { store: { custom: 'x' } })).toEqual({});
    expect(choiceFormNormalize(QS, null)).toEqual({});
  });

  it('reduces picks, own answers, clears and resets — the same object when nothing changed', () => {
    const a0 = {};
    const a1 = choiceFormReduce(a0, { type: 'pick', questionId: 'store', choiceId: 'pg' }, QS);
    expect(a1).toEqual({ store: { choiceId: 'pg' } });
    expect(a0).toEqual({});
    expect(choiceFormReduce(a1, { type: 'pick', questionId: 'store', choiceId: 'pg' }, QS)).toBe(a1);
    expect(choiceFormReduce(a1, { type: 'pick', questionId: 'store', choiceId: 'nope' }, QS)).toBe(a1);
    expect(choiceFormReduce(a1, { type: 'pick', questionId: 'ghost', choiceId: 'pg' }, QS)).toBe(a1);
    const a2 = choiceFormReduce(a1, { type: 'custom', questionId: 'backfill', text: '  nightly  ' }, QS);
    expect(a2.backfill).toEqual({ custom: 'nightly' });
    expect(choiceFormReduce(a2, { type: 'custom', questionId: 'backfill', text: '   ' }, QS)).toBe(a2);
    expect(choiceFormReduce(a2, { type: 'custom', questionId: 'store', text: 'x' }, QS)).toBe(a2);
    const a3 = choiceFormReduce(a2, { type: 'pick', questionId: 'backfill', choiceId: 'bg' }, QS);
    expect(a3.backfill).toEqual({ choiceId: 'bg' });
    expect(choiceFormReduce(a3, { type: 'clear', questionId: 'store' }, QS)).toEqual({ backfill: { choiceId: 'bg' } });
    expect(choiceFormReduce(a3, { type: 'reset' }, QS)).toEqual({});
    expect(choiceFormReduce(a0, { type: 'reset' }, QS)).toBe(a0);
  });

  it('measures progress and finds the next open question (wrapping)', () => {
    const answers = { backfill: { choiceId: 'bg' } };
    expect(choiceFormProgress(QS, answers)).toEqual({
      answered: 1,
      total: 3,
      complete: false,
      states: ['open', 'answered', 'open'],
    });
    expect(choiceFormNext(QS, answers, 0)).toBe(2);
    expect(choiceFormNext(QS, answers, 2)).toBe(0);
    expect(choiceFormNext(QS, answers, -1)).toBe(0);
    const all = { store: { choiceId: 'pg' }, backfill: { choiceId: 'bg' }, table: { custom: 't' } };
    expect(choiceFormNext(QS, all, 0)).toBe(-1);
    expect(choiceFormProgress(QS, all).complete).toBe(true);
    expect(choiceFormProgress([], {}).complete).toBe(false);
  });

  it('allows Submit when complete, or with allowPartial once one is answered', () => {
    expect(choiceFormCanSubmit(QS, {})).toBe(false);
    expect(choiceFormCanSubmit(QS, { store: { choiceId: 'pg' } })).toBe(false);
    expect(choiceFormCanSubmit(QS, { store: { choiceId: 'pg' } }, true)).toBe(true);
    expect(choiceFormCanSubmit(QS, {}, true)).toBe(false);
  });

  it('builds the recommended answers: the person’s answers stay, open questions take the recommendation', () => {
    const r = choiceFormRecommendedAnswers(QS, { store: { choiceId: 'sqlite' } });
    expect(r.answers).toEqual({ store: { choiceId: 'sqlite' }, backfill: { choiceId: 'bg' } });
    expect(r.filled).toEqual(['backfill']);
    expect(r.missing).toEqual(['table']);
  });

  it('decides the hero: shown with any recommendation, pressable when every open question has one', () => {
    expect(choiceFormHero(QS, {})).toEqual({ show: true, enabled: false, fill: 2, missing: 1 });
    expect(choiceFormHero(QS, { table: { choiceId: 'uploads' } })).toEqual({
      show: true,
      enabled: true,
      fill: 2,
      missing: 0,
    });
    const all = { store: { choiceId: 'pg' }, backfill: { choiceId: 'bg' }, table: { custom: 't' } };
    expect(choiceFormHero(QS, all)).toEqual({ show: true, enabled: false, fill: 0, missing: 0 });
    expect(choiceFormHero([QS[2]], {}).show).toBe(false);
  });

  it('lists answers in question order with labels, own text and the recommended flag', () => {
    expect(
      choiceFormAnswerList(QS, {
        table: { custom: ' my_table ' },
        store: { choiceId: 'pg' },
        backfill: { choiceId: 'deploy' },
      }),
    ).toEqual([
      { questionId: 'store', choiceId: 'pg', label: 'Postgres', recommended: true },
      { questionId: 'backfill', choiceId: 'deploy', label: 'During deploy' },
      { questionId: 'table', label: 'my_table', custom: 'my_table' },
    ]);
  });

  it('keys a form by id and question ids', () => {
    const k = choiceFormKey(form());
    expect(choiceFormKey(form({ submitting: true, title: 'Other' }))).toBe(k);
    expect(choiceFormKey(form({ id: 'f2' }))).not.toBe(k);
    expect(choiceFormKey(form({ questions: QS.slice(0, 2) }))).not.toBe(k);
    expect(choiceFormKey(undefined)).toBe('');
  });

  it('has Korean strings', () => {
    expect(choiceFormStrings('ko').progress(1, 3)).toBe('3개 중 1개 답함');
    expect(choiceFormStrings('en').heroMissing(2)).toBe('2 questions have no recommendation');
    expect(choiceFormStrings('en').heroFill(1)).toBe('Fills 1 unanswered question');
  });
});

// ── Element ─────────────────────────────────────────────────────────────────

describe('<ui-choice-form> rendering', () => {
  it('renders nothing without questions', () => {
    const el = mount({ questions: [] });
    expect(q(el, '.cf')).toBeNull();
  });

  it('draws the title, numbered cards, progress dots and text, the hero and the actions', () => {
    const el = mount(form());
    expect(q(el, '.cf-title')?.textContent).toBe('Before I migrate');
    expect(qa(el, '.cf-q')).toHaveLength(3);
    expect(qa(el, '.cf-num').map((n) => n.textContent)).toEqual(['1', '2', '3']);
    expect(q(el, '#cf-q1-t')?.textContent).toBe('Question 2 of 3: How should old uploads move?');
    expect(qa(el, '.cf-dot').map((d) => d.dataset.state)).toEqual(['current', 'pending', 'pending']);
    expect(q(el, '.cf-progress-text')?.textContent).toBe('0 of 3 answered');
    expect(card(el, 'store').dataset.state).toBe('current');
    expect(q(el, '.cf-hero-label')?.textContent).toBe('Submit all recommended');
    expect(q(el, '.cf-reset')?.textContent).toBe('Reset');
    expect(q(el, '.cf-submit')?.textContent).toContain('Submit');
    expect(q(el, '.cf-submit')?.getAttribute('aria-disabled')).toBe('true');
    expect(q(el, '.cf-hint')?.textContent).toBe('Answer 3 more to submit');
    expect(q(el, '.cf-submit')?.getAttribute('aria-describedby')).toBe('cf-hint');
  });

  it('marks the recommended choice first with a word and an accent edge — no star, no green', () => {
    const el = mount(form());
    const first = card(el, 'store').querySelector<HTMLElement>('.cf-choice')!;
    expect(first.dataset.choice).toBe('pg');
    expect(first.hasAttribute('data-rec')).toBe(true);
    expect(first.querySelector('.cf-rec')?.textContent).toBe('Recommended');
    expect(qa(el, '.cf-choice[data-rec]')).toHaveLength(2);
    expect(q(el, '[data-icon="star"]')).toBeNull();
    expect(q(el, '.ui-root')!.innerHTML).not.toMatch(/⭐|★|green|st-done/);
    expect(first.querySelector('.cf-key')?.textContent).toBe('1');
    expect(first.getAttribute('aria-keyshortcuts')).toBe('1');
  });

  it('renders markdown context with a code span and a safe link', () => {
    const el = mount(form());
    const ctx = q(el, '#cf-q0-c')!;
    expect(ctx.querySelector('code')?.textContent).toBe('data/uploads.json');
    const a = ctx.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('https://example.com/pg');
    expect(a.getAttribute('rel')).toContain('noopener');
    expect(card(el, 'store').getAttribute('aria-describedby')).toBe('cf-q0-c');
  });

  it('escapes every string: titles, markdown, labels, descriptions, placeholders, ids and the error', () => {
    const evil: ChoiceFormData = {
      id: XSS,
      title: XSS,
      description: `${XSS} <script>alert(1)</script>`,
      error: XSS,
      questions: [
        {
          id: `q"${XSS}`,
          title: XSS,
          context: `${XSS} [x](javascript:alert(1)) <a href="javascript:alert(1)">y</a>`,
          choices: [
            { id: `c"'${XSS}`, label: XSS, description: XSS, recommended: true },
            { id: 'b', label: 'Fine' },
          ],
          allowCustom: true,
          customPlaceholder: `"><img src=x onerror=alert(2)>`,
        },
        { id: 'q2', title: 'Two', choices: [{ id: 'z', label: 'Z' }] },
      ],
    };
    const el = mount(evil);
    const root = el.shadowRoot!;
    expect(root.querySelector('img, script')).toBeNull();
    expect(root.querySelector('a[href^="javascript"]')).toBeNull();
    expect(q(el, '.cf-title')?.textContent).toBe(XSS);
    expect(q(el, '.cf-desc')?.textContent).toContain(XSS);
    expect(q(el, '#cf-q0-t')?.textContent).toContain(XSS);
    expect(q(el, '#cf-q0-c')?.textContent).toContain(XSS);
    expect(q(el, '.cf-choice-label')?.textContent).toContain(XSS);
    expect(q(el, '.cf-choice-desc')?.textContent).toBe(XSS);
    expect(q(el, '.cf-input')?.getAttribute('placeholder')).toBe(`"><img src=x onerror=alert(2)>`);
    expect(q(el, '.cf-error')?.textContent).toBe(XSS);
    const btn = q(el, '.cf-choice')!;
    expect(btn.dataset.choice).toBe(`c"'${XSS}`);
    expect(btn.dataset.q).toBe(`q"${XSS}`);
    const changes = events<ChoiceFormChangeDetail>(el, 'ui-change');
    btn.click();
    expect(changes[0].answers[0]).toEqual({
      questionId: `q"${XSS}`,
      choiceId: `c"'${XSS}`,
      label: XSS,
      recommended: true,
    });
    expect(q(el, '.cf-chip-label')?.textContent).toContain(XSS);
    expect(root.querySelector('img, script')).toBeNull();
  });

  it('escapes typed own answers in the chip, the events and the summary', () => {
    const el = mount(form());
    const changes = events<ChoiceFormChangeDetail>(el, 'ui-change');
    const box = input(el, 'table');
    type(box, `"><img src=x onerror=alert(1)>`);
    key(box, 'Enter');
    expect(changes.at(-1)?.answers.find((a) => a.questionId === 'table')?.custom).toBe(
      `"><img src=x onerror=alert(1)>`,
    );
    expect(card(el, 'table').querySelector('.cf-chip-label')?.textContent).toContain(`"><img src=x onerror=alert(1)>`);
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    el.data = { ...el.data!, submitted: true };
    el.renderNow();
    expect(q(el, '.cf-sum')?.textContent).toContain(`"><img src=x onerror=alert(1)>`);
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
  });
});

describe('<ui-choice-form> answering', () => {
  it('a pick folds the card into the answer, notifies, announces and moves focus to the next open question', () => {
    const el = mount(form());
    const changes = events<ChoiceFormChangeDetail>(el, 'ui-change');
    choice(el, 'store', 'pg').click();
    const c = card(el, 'store');
    expect(c.dataset.state).toBe('answered');
    expect(c.querySelector('.cf-num [data-icon="check"]')).not.toBeNull();
    expect(c.querySelector('.cf-chip-label')?.textContent).toBe('Your answer: Postgres');
    expect(c.querySelector('.cf-chip .cf-tag-rec')?.textContent).toBe('Recommended');
    expect(c.querySelector('.cf-x[data-x="p:store"]')?.hasAttribute('data-open')).toBe(true);
    expect(c.querySelector('.cf-x[data-x="c:store"]')?.hasAttribute('inert')).toBe(true);
    expect(changes).toEqual([
      {
        answers: [{ questionId: 'store', choiceId: 'pg', label: 'Postgres', recommended: true }],
        answered: 1,
        total: 3,
        reason: 'pick',
        questionId: 'store',
      },
    ]);
    expect(active(el)?.dataset.key).toBe('pick:backfill:bg');
    expect(qa(el, '.cf-dot').map((d) => d.dataset.state)).toEqual(['answered', 'current', 'pending']);
    expect(q(el, '.cf-progress-text')?.textContent).toBe('1 of 3 answered');
    expect(live(el)).toBe('1 of 3 answered');
  });

  it('after the last open question, focus goes to Submit', () => {
    const el = mount(form({ answers: { store: { choiceId: 'pg' }, backfill: { choiceId: 'bg' } } }));
    choice(el, 'table', 'uploads').click();
    expect(active(el)?.dataset.key).toBe('submit');
    expect(q(el, '.cf-submit')?.getAttribute('aria-disabled')).toBeNull();
    expect(q(el, '.cf-hint')).toBeNull();
  });

  it('Change reopens the choices with the answer pressed; another pick replaces it; Esc folds back', () => {
    const el = mount(form({ answers: { store: { choiceId: 'pg' } } }));
    const changes = events<ChoiceFormChangeDetail>(el, 'ui-change');
    (card(el, 'store').querySelector('.cf-change') as HTMLElement).click();
    let c = card(el, 'store');
    expect(c.hasAttribute('data-editing')).toBe(true);
    expect(c.querySelector('.cf-x[data-x="c:store"]')?.hasAttribute('data-open')).toBe(true);
    expect(choice(el, 'store', 'pg').getAttribute('aria-pressed')).toBe('true');
    expect(choice(el, 'store', 'pg').tabIndex).toBe(0);
    expect(active(el)?.dataset.key).toBe('pick:store:pg');
    expect(changes).toHaveLength(0);
    choice(el, 'store', 'sqlite').click();
    expect(changes.at(-1)?.answers[0]).toEqual({ questionId: 'store', choiceId: 'sqlite', label: 'SQLite' });
    c = card(el, 'store');
    expect(c.hasAttribute('data-editing')).toBe(false);
    expect(c.querySelector('.cf-chip-label')?.textContent).toContain('SQLite');

    (card(el, 'store').querySelector('.cf-change') as HTMLElement).click();
    key(active(el)!, 'Escape');
    expect(card(el, 'store').hasAttribute('data-editing')).toBe(false);
    expect(active(el)?.dataset.key).toBe('change:store');
    expect(el.answers[0].choiceId).toBe('sqlite');
  });

  it('own answer: empty is refused with a reason; Enter or Confirm records the trimmed text', () => {
    const el = mount(form());
    const changes = events<ChoiceFormChangeDetail>(el, 'ui-change');
    const confirm = qa(el, '.cf-confirm').find((b) => b.dataset.q === 'backfill')!;
    expect(confirm.getAttribute('aria-disabled')).toBe('true');
    key(input(el, 'backfill'), 'Enter');
    expect(input(el, 'backfill').getAttribute('aria-invalid')).toBe('true');
    expect(card(el, 'backfill').querySelector('.cf-invalid')?.textContent).toBe('Write an answer first.');
    expect(changes).toHaveLength(0);
    type(input(el, 'backfill'), '  nightly copy  ');
    expect(confirm.getAttribute('aria-disabled')).toBe('false');
    el.renderNow();
    expect(input(el, 'backfill').hasAttribute('aria-invalid')).toBe(false);
    key(input(el, 'backfill'), 'Enter');
    expect(changes.at(-1)).toMatchObject({ reason: 'custom', questionId: 'backfill' });
    expect(el.answers).toEqual([{ questionId: 'backfill', label: 'nightly copy', custom: 'nightly copy' }]);
    const c = card(el, 'backfill');
    expect(c.querySelector('.cf-chip-label')?.textContent).toContain('nightly copy');
    expect(c.querySelector('.cf-chip .cf-tag')?.textContent).toBe('Custom');

    type(input(el, 'table'), 'my_uploads');
    (qa(el, '.cf-confirm').find((b) => b.dataset.q === 'table') as HTMLElement).click();
    expect(el.answers.at(-1)).toEqual({ questionId: 'table', label: 'my_uploads', custom: 'my_uploads' });
  });

  it('Enter during IME composition does not confirm', () => {
    const el = mount(form());
    type(input(el, 'table'), '업로드');
    key(input(el, 'table'), 'Enter', { isComposing: true });
    expect(el.answers).toEqual([]);
  });

  it('Change on an own answer refills the box', () => {
    const el = mount(form({ answers: { table: { custom: 'my_table' } } }));
    (card(el, 'table').querySelector('.cf-change') as HTMLElement).click();
    expect(input(el, 'table').value).toBe('my_table');
    expect(active(el)).toBe(input(el, 'table'));
  });

  it('Reset clears answers and drafts, notifies and announces', () => {
    const el = mount(form({ answers: { store: { choiceId: 'pg' }, backfill: { choiceId: 'bg' } } }));
    const changes = events<ChoiceFormChangeDetail>(el, 'ui-change');
    type(input(el, 'table'), 'draft');
    expect(q(el, '.cf-reset')?.getAttribute('aria-disabled')).toBeNull();
    (q(el, '.cf-reset') as HTMLElement).click();
    expect(changes).toEqual([{ answers: [], answered: 0, total: 3, reason: 'reset' }]);
    expect(el.answers).toEqual([]);
    expect(input(el, 'table').value).toBe('');
    expect(qa(el, '.cf-q').map((c) => c.dataset.state)).toEqual(['current', 'pending', 'pending']);
    expect(q(el, '.cf-reset')?.getAttribute('aria-disabled')).toBe('true');
    expect(live(el)).toBe('Answers cleared');
    expect(active(el)?.dataset.key).toBe('pick:store:pg');
  });
});

describe('<ui-choice-form> submitting', () => {
  const ALL = { store: { choiceId: 'pg' }, backfill: { choiceId: 'deploy' }, table: { custom: 'uploads_v2' } };

  it('Submit is locked until every question is answered', () => {
    const el = mount(form());
    const subs = events<ChoiceFormSubmitDetail>(el, 'ui-submit');
    (q(el, '.cf-submit') as HTMLElement).click();
    expect(subs).toHaveLength(0);
    el.data = form({ id: 'f2', answers: ALL });
    el.renderNow();
    (q(el, '.cf-submit') as HTMLElement).click();
    expect(subs).toEqual([
      {
        source: 'submit',
        answers: [
          { questionId: 'store', choiceId: 'pg', label: 'Postgres', recommended: true },
          { questionId: 'backfill', choiceId: 'deploy', label: 'During deploy' },
          { questionId: 'table', label: 'uploads_v2', custom: 'uploads_v2' },
        ],
      },
    ]);
  });

  it('allowPartial enables Submit after one answer', () => {
    const el = mount(form({ allowPartial: true }));
    expect(q(el, '.cf-hint')?.textContent).toBe('Answer 1 more to submit');
    choice(el, 'store', 'json').click();
    expect(q(el, '.cf-submit')?.getAttribute('aria-disabled')).toBeNull();
    const subs = events<ChoiceFormSubmitDetail>(el, 'ui-submit');
    (q(el, '.cf-submit') as HTMLElement).click();
    expect(subs[0].answers).toEqual([{ questionId: 'store', choiceId: 'json', label: 'Keep JSON' }]);
  });

  it('a sent form is busy until the host assigns data again', () => {
    const el = mount(form({ answers: ALL }));
    const changes = events<ChoiceFormChangeDetail>(el, 'ui-change');
    (q(el, '.cf-submit') as HTMLElement).click();
    expect(q(el, '.cf')?.getAttribute('aria-busy')).toBe('true');
    const submit = q(el, '.cf-submit')!;
    expect(submit.getAttribute('aria-busy')).toBe('true');
    expect(submit.textContent).toContain('Submitting…');
    expect(submit.querySelector('.cf-spin')).not.toBeNull();
    expect(qa(el, '.cf-change').every((b) => b.getAttribute('aria-disabled') === 'true')).toBe(true);
    expect(q(el, '.cf-reset')?.getAttribute('aria-disabled')).toBe('true');
    (card(el, 'store').querySelector('.cf-change') as HTMLElement).click();
    expect(card(el, 'store').hasAttribute('data-editing')).toBe(false);
    expect(changes).toHaveLength(0);
    el.data = { ...el.data!, error: 'Network down' };
    el.renderNow();
    expect(q(el, '.cf')?.hasAttribute('aria-busy')).toBe(false);
    expect(q(el, '.cf-error')?.textContent).toBe('Network down');
  });

  it('preventDefault on ui-submit keeps the form as it was', () => {
    const el = mount(form({ answers: ALL }));
    el.addEventListener('ui-submit', (e) => e.preventDefault());
    (q(el, '.cf-submit') as HTMLElement).click();
    expect(q(el, '.cf')?.hasAttribute('aria-busy')).toBe(false);
    expect(q(el, '.cf-submit')?.getAttribute('aria-disabled')).toBeNull();
    expect(q(el, '.cf-submit')?.textContent).toContain('Submit');
    (card(el, 'store').querySelector('.cf-change') as HTMLElement).click();
    expect(card(el, 'store').hasAttribute('data-editing')).toBe(true);
  });

  it('⌘/Ctrl+Enter submits', () => {
    const el = mount(form({ answers: ALL }));
    const subs = events<ChoiceFormSubmitDetail>(el, 'ui-submit');
    key(q(el, '.cf-change')!, 'Enter', { metaKey: true });
    expect(subs).toHaveLength(1);
  });

  it('Submit all recommended: blocked while a question has no recommendation', () => {
    const el = mount(form());
    const hero = q(el, '.cf-hero')!;
    expect(hero.getAttribute('aria-disabled')).toBe('true');
    expect(q(el, '.cf-hero-meta')?.textContent).toBe('1 question has no recommendation');
    const subs = events<ChoiceFormSubmitDetail>(el, 'ui-submit');
    hero.click();
    expect(subs).toHaveLength(0);
  });

  it('Submit all recommended fills the open questions, keeps the person’s answers and sends source "recommended"', () => {
    const el = mount(form({ answers: { store: { choiceId: 'sqlite' } } }));
    choice(el, 'table', 'upload_index').click();
    const hero = q(el, '.cf-hero')!;
    expect(hero.getAttribute('aria-disabled')).toBeNull();
    expect(q(el, '.cf-hero-meta')?.textContent).toBe('Fills 1 unanswered question');
    const subs = events<ChoiceFormSubmitDetail>(el, 'ui-submit');
    hero.click();
    expect(subs).toEqual([
      {
        source: 'recommended',
        answers: [
          { questionId: 'store', choiceId: 'sqlite', label: 'SQLite' },
          { questionId: 'backfill', choiceId: 'bg', label: 'Background', recommended: true },
          { questionId: 'table', choiceId: 'upload_index', label: 'upload_index' },
        ],
      },
    ]);
    expect(q(el, '.cf-hero')?.getAttribute('aria-busy')).toBe('true');
    expect(q(el, '.cf-hero .cf-spin')).not.toBeNull();
    expect(card(el, 'backfill').dataset.state).toBe('answered');
  });

  it('a cancelled recommended submit does not fill anything in', () => {
    const el = mount(form({ answers: { table: { choiceId: 'uploads' } } }));
    el.addEventListener('ui-submit', (e) => e.preventDefault());
    (q(el, '.cf-hero') as HTMLElement).click();
    expect(el.answers).toEqual([{ questionId: 'table', choiceId: 'uploads', label: 'uploads' }]);
    expect(card(el, 'store').dataset.state).toBe('current');
  });

  it('the hero is hidden without recommendations and says when everything is answered', () => {
    expect(q(mount(form({ questions: [QS[2], { ...QS[2], id: 't2' }] })), '.cf-hero')).toBeNull();
    const el = mount(form({ answers: ALL }));
    expect(q(el, '.cf-hero')?.getAttribute('aria-disabled')).toBe('true');
    expect(q(el, '.cf-hero-meta')?.textContent).toBe('Every question is answered');
  });

  it('host submitting locks the form with a spinner on Submit', () => {
    const el = mount(form({ answers: ALL, submitting: true }));
    expect(q(el, '.cf')?.getAttribute('aria-busy')).toBe('true');
    expect(q(el, '.cf-submit .cf-spin')).not.toBeNull();
    expect(qa(el, '.cf-input').every((i) => i.hasAttribute('readonly'))).toBe(true);
  });

  it('submitted: a read-only summary of the host answers (or the sent ones), with own text and no-answer rows', () => {
    const el = mount(form({ answers: ALL }));
    el.focus();
    (q(el, '.cf-submit') as HTMLElement).focus();
    (q(el, '.cf-submit') as HTMLElement).click();
    el.data = { ...el.data!, submitting: false, submitted: true, answers: { store: { choiceId: 'pg' } } };
    el.renderNow();
    expect(q(el, '.cf-q')).toBeNull();
    expect(q(el, '.cf-done-word')?.textContent).toBe('Submitted');
    expect(q(el, '.cf-done-title')?.textContent).toBe('Before I migrate');
    const rows = qa(el, '.cf-sum-row');
    expect(rows).toHaveLength(3);
    expect(rows[0].querySelector('dd')?.textContent).toContain('Postgres');
    expect(rows[0].querySelector('.cf-tag-rec')).not.toBeNull();
    expect(rows[1].querySelector('.cf-none')?.textContent).toBe('No answer');
    expect(q(el, '.cf-done')?.classList.contains('is-enter')).toBe(true);
    expect(active(el)?.classList.contains('cf-done')).toBe(true);
    expect(live(el)).toBe('Answers submitted');

    const fresh = mount(form({ id: 'x', answers: ALL, submitted: true }));
    expect(qa(fresh, '.cf-sum-row')[2].querySelector('dd')?.textContent).toContain('uploads_v2');
    expect(qa(fresh, '.cf-sum-row')[2].querySelector('.cf-tag')?.textContent).toBe('Custom');
    expect(q(fresh, '.cf-done')?.classList.contains('is-enter')).toBe(false);
  });

  it('error: an alert line, and the form stays usable', () => {
    const el = mount(form({ error: 'The session ended (HTTP 410).' }));
    const err = q(el, '.cf-error')!;
    expect(err.getAttribute('role')).toBe('alert');
    expect(err.textContent).toBe('The session ended (HTTP 410).');
    choice(el, 'store', 'pg').click();
    expect(el.answers).toHaveLength(1);
  });
});

describe('<ui-choice-form> keyboard', () => {
  it('digits pick the n-th displayed choice of the focused question', () => {
    const el = mount(form());
    const b = choice(el, 'backfill', 'bg');
    b.focus();
    key(b, '2');
    expect(el.answers).toEqual([{ questionId: 'backfill', choiceId: 'deploy', label: 'During deploy' }]);
  });

  it('digits outside a question card pick in the current question', () => {
    const el = mount(form());
    const submit = q(el, '.cf-submit')!;
    submit.focus();
    const e = key(submit, '2');
    expect(e.defaultPrevented).toBe(true);
    expect(el.answers).toEqual([{ questionId: 'store', choiceId: 'sqlite', label: 'SQLite' }]);
    key(submit, '1');
    expect(el.answers.map((a) => a.choiceId)).toEqual(['sqlite', 'bg']);
  });

  it('digits are ignored in the own-answer box, past the last choice, on a folded card and with modifiers', () => {
    const el = mount(form({ answers: { store: { choiceId: 'pg' } } }));
    key(input(el, 'backfill'), '1');
    key(choice(el, 'backfill', 'bg'), '9');
    key(choice(el, 'backfill', 'bg'), '1', { shiftKey: true });
    key(card(el, 'store').querySelector('.cf-change')!, '2');
    expect(el.answers).toEqual([{ questionId: 'store', choiceId: 'pg', label: 'Postgres', recommended: true }]);
  });

  it('arrows, Home and End walk the choices with one tab stop', () => {
    const el = mount(form());
    const [a, b, c] = qa(el, '.cf-choice').filter((x) => x.dataset.q === 'store');
    expect([a.tabIndex, b.tabIndex, c.tabIndex]).toEqual([0, -1, -1]);
    a.focus();
    key(a, 'ArrowDown');
    expect(active(el)).toBe(b);
    expect([a.tabIndex, b.tabIndex]).toEqual([-1, 0]);
    key(b, 'End');
    expect(active(el)).toBe(c);
    key(c, 'ArrowDown');
    expect(active(el)).toBe(a);
    key(a, 'ArrowUp');
    expect(active(el)).toBe(c);
    key(c, 'Home');
    expect(active(el)).toBe(a);
  });

  it('focus() lands on the current question', () => {
    const el = mount(form({ answers: { store: { choiceId: 'pg' } } }));
    el.focus();
    expect(active(el)?.dataset.key).toBe('pick:backfill:bg');
  });
});

describe('<ui-choice-form> one question', () => {
  it('has no hero, dots, numbers or Reset — and a pick submits at once', () => {
    const el = mount(single());
    expect(q(el, '.cf')?.dataset.mode).toBe('single');
    expect(q(el, '.cf-hero, .cf-dot, .cf-num, .cf-reset, .cf-submit')).toBeNull();
    expect(q(el, '#cf-q0-t')?.textContent).toBe('Run the suite?');
    const subs = events<ChoiceFormSubmitDetail>(el, 'ui-submit');
    choice(el, 'tests', 'skip').click();
    expect(subs).toEqual([{ source: 'submit', answers: [{ questionId: 'tests', choiceId: 'skip', label: 'Skip' }] }]);
    const b = choice(el, 'tests', 'skip');
    expect(b.getAttribute('aria-busy')).toBe('true');
    expect(b.querySelector('.cf-spin')).not.toBeNull();
    expect(choice(el, 'tests', 'full').getAttribute('aria-disabled')).toBe('true');
  });

  it('a cancelled pick changes nothing', () => {
    const el = mount(single());
    el.addEventListener('ui-submit', (e) => e.preventDefault());
    choice(el, 'tests', 'full').click();
    expect(el.answers).toEqual([]);
    expect(qa(el, '.cf-choice').every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true);
    expect(q(el, '.cf')?.hasAttribute('aria-busy')).toBe(false);
  });

  it('digits submit too, and a confirmed own answer submits', () => {
    const el = mount(
      single({ questions: [{ ...single().questions[0], allowCustom: true, customPlaceholder: 'Something else…' }] }),
    );
    const subs = events<ChoiceFormSubmitDetail>(el, 'ui-submit');
    el.addEventListener('ui-submit', (e) => e.preventDefault());
    key(choice(el, 'tests', 'full'), '1');
    expect(subs.at(-1)?.answers[0].choiceId).toBe('full');
    expect(input(el, 'tests').placeholder).toBe('Something else…');
    type(input(el, 'tests'), 'Only the upload tests');
    key(input(el, 'tests'), 'Enter');
    expect(subs.at(-1)?.answers[0]).toEqual({
      questionId: 'tests',
      label: 'Only the upload tests',
      custom: 'Only the upload tests',
    });
  });

  it('submitOnPick: false keeps the pick selected and adds Submit', () => {
    const el = mount(single({ submitOnPick: false }));
    const subs = events<ChoiceFormSubmitDetail>(el, 'ui-submit');
    const changes = events<ChoiceFormChangeDetail>(el, 'ui-change');
    expect(q(el, '.cf-reset')).toBeNull();
    expect(q(el, '.cf-submit')?.getAttribute('aria-disabled')).toBe('true');
    choice(el, 'tests', 'skip').click();
    expect(subs).toHaveLength(0);
    expect(changes).toHaveLength(1);
    expect(choice(el, 'tests', 'skip').getAttribute('aria-pressed')).toBe('true');
    expect(choice(el, 'tests', 'skip').querySelector('[data-icon="check"]')).not.toBeNull();
    expect(active(el)?.dataset.key).toBe('submit');
    (q(el, '.cf-submit') as HTMLElement).click();
    expect(subs[0]).toEqual({ source: 'submit', answers: [{ questionId: 'tests', choiceId: 'skip', label: 'Skip' }] });
  });

  it('host submitting spins the answer of a pick-to-submit question', () => {
    const el = mount(single({ answers: { tests: { choiceId: 'full' } }, submitting: true }));
    expect(choice(el, 'tests', 'full').querySelector('.cf-spin')).not.toBeNull();
  });
});

describe('<ui-choice-form> host state', () => {
  it('seeds from answers, keeps working answers across updates, resets on a new identity', () => {
    const el = mount(form({ answers: { store: { choiceId: 'pg' } } }));
    expect(card(el, 'store').dataset.state).toBe('answered');
    choice(el, 'backfill', 'deploy').click();
    el.data = { ...el.data!, answers: { table: { choiceId: 'uploads' } }, title: 'Renamed' };
    el.renderNow();
    expect(el.answers.map((a) => a.questionId)).toEqual(['store', 'backfill']);
    expect(q(el, '.cf-title')?.textContent).toBe('Renamed');
    el.data = form({ id: 'f2', answers: { table: { choiceId: 'uploads' } } });
    el.renderNow();
    expect(el.answers.map((a) => a.questionId)).toEqual(['table']);
    expect(card(el, 'store').dataset.state).toBe('current');
  });

  it('drops a working answer whose choice the host removed', () => {
    const el = mount(form({ answers: { store: { choiceId: 'json' } } }));
    const qs = QS.map((x) => (x.id === 'store' ? { ...x, choices: x.choices.filter((c) => c.id !== 'json') } : x));
    el.data = { ...el.data!, questions: qs };
    el.renderNow();
    expect(el.answers).toEqual([]);
  });
});

describe('lang="ko"', () => {
  it('speaks Korean', () => {
    const el = mount(form(), { lang: 'ko' });
    expect(q(el, '.cf-progress-text')?.textContent).toBe('3개 중 0개 답함');
    expect(q(el, '.cf-hero-label')?.textContent).toBe('추천대로 모두 제출');
    expect(q(el, '.cf-hero-meta')?.textContent).toBe('추천이 없는 질문 1개');
    expect(q(el, '.cf-rec')?.textContent).toBe('추천');
    expect(q(el, '.cf-reset')?.textContent).toBe('초기화');
    expect(q(el, '.cf-submit')?.textContent).toContain('제출');
    expect(q(el, '.cf-hint')?.textContent).toBe('3개 더 답하면 제출할 수 있음');
    expect(q(el, '#cf-q0-t')?.textContent).toContain('질문 1/3');
    expect(input(el, 'backfill').placeholder).toBe('또는 직접 입력…');
    choice(el, 'store', 'pg').click();
    expect(card(el, 'store').querySelector('.cf-change')?.textContent).toBe('변경');
    expect(live(el)).toBe('3개 중 1개 답함');
    el.data = { ...el.data!, submitted: true };
    el.renderNow();
    expect(q(el, '.cf-done-word')?.textContent).toBe('제출됨');
    expect(q(el, '.cf-none')?.textContent).toBe('답 없음');
  });

  it('switches when the attribute changes', async () => {
    const el = mount(form());
    el.setAttribute('lang', 'ko');
    await Promise.resolve();
    expect(q(el, '.cf-reset')?.textContent).toBe('초기화');
  });
});
