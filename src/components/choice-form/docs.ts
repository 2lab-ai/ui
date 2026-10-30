import type { ComponentDoc } from '../../docs/types';
import './choice-form';
import type { ChoiceFormData, ChoiceFormSubmitDetail } from './logic';

type El = HTMLElementTagNameMap['ui-choice-form'];

function make(data: ChoiceFormData, attrs: Record<string, string> = {}): El {
  const el = document.createElement('ui-choice-form');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

function stage(...els: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:grid;gap:16px;width:100%;max-width:620px;margin:0 auto';
  box.append(...els);
  return box;
}

/** Plays the host: a submit is "sending" for 1.1 s, then the form becomes its summary. */
function host(el: El): El {
  el.addEventListener('ui-submit', (e) => {
    const { answers } = (e as CustomEvent<ChoiceFormSubmitDetail>).detail;
    el.data = { ...el.data!, submitting: true, error: undefined };
    window.setTimeout(() => {
      if (!el.isConnected || !el.data) return;
      const map = Object.fromEntries(
        answers.map((a) => [a.questionId, a.custom !== undefined ? { custom: a.custom } : { choiceId: a.choiceId }]),
      );
      el.data = { ...el.data, submitting: false, submitted: true, answers: map };
    }, 1100);
  });
  return el;
}

const MIGRATION: ChoiceFormData = {
  id: 'upload-index',
  title: 'Before I migrate the upload index',
  description: 'Four decisions. Pick one per question, or press **Submit all recommended**.',
  questions: [
    {
      id: 'store',
      title: 'Where should the upload index live?',
      context:
        'Today it is one JSON file, `data/uploads.json` (41 MB), rewritten on every upload. The session store already runs on Postgres — see [JSONB types](https://www.postgresql.org/docs/current/datatype-json.html).',
      choices: [
        { id: 'sqlite', label: 'SQLite', description: 'One file, no server; a single writer at a time' },
        {
          id: 'pg',
          label: 'Postgres',
          description: 'Already running for sessions; JSONB keeps the current shape',
          recommended: true,
        },
        { id: 'json', label: 'Keep the JSON file', description: 'No migration; writes slow down past ~50 MB' },
      ],
    },
    {
      id: 'backfill',
      title: 'How should the 18,402 existing uploads move over?',
      choices: [
        {
          id: 'background',
          label: 'Backfill in the background',
          description: 'Reads stay on the JSON file until the copy finishes',
          recommended: true,
        },
        { id: 'deploy', label: 'Copy during the deploy', description: 'About 4 minutes of read-only uploads' },
        { id: 'new-only', label: 'Only new uploads', description: 'Old ones stay in the JSON file' },
      ],
      allowCustom: true,
    },
    {
      id: 'retry',
      title: 'Retry policy for failed chunks?',
      context: '- 3 retries today, fixed 1 s delay\n- 2.1% of chunks fail on mobile networks, mostly on the 3rd retry',
      choices: [
        {
          id: 'backoff',
          label: 'Exponential backoff',
          description: '1 s, 2 s, 4 s, 8 s — capped at 30 s',
          recommended: true,
        },
        { id: 'fixed', label: 'Keep the fixed delay' },
        { id: 'none', label: 'No retries', description: 'Fail fast and let the client restart' },
      ],
    },
    {
      id: 'table',
      title: 'Name for the new table?',
      context: 'No preference from me — the schema uses plural nouns (`sessions`, `turns`).',
      choices: [
        { id: 'uploads', label: 'uploads' },
        { id: 'upload_index', label: 'upload_index' },
      ],
      allowCustom: true,
      customPlaceholder: 'Another name…',
    },
  ],
};

const SINGLE: ChoiceFormData = {
  id: 'run-tests',
  title: 'Agent question · 10:42',
  questions: [
    {
      id: 'tests',
      title: 'The full test suite takes about 9 minutes. Run it before opening the PR?',
      choices: [
        { id: 'full', label: 'Run the full suite', description: 'Catches the flaky upload test', recommended: true },
        { id: 'changed', label: 'Only the changed packages', description: 'About 2 minutes' },
        { id: 'skip', label: 'Skip — open the PR now' },
      ],
    },
  ],
};

const SINGLE_CONFIRM: ChoiceFormData = {
  id: 'branch',
  submitOnPick: false,
  questions: [
    {
      id: 'branch',
      title: 'Which branch should the fix go to?',
      context: '`main` is frozen for the 0.7.0 release until Friday.',
      choices: [
        { id: 'release', label: 'release/0.7', description: 'Ships with the release', recommended: true },
        { id: 'main', label: 'main', description: 'Lands after the freeze' },
      ],
      allowCustom: true,
      customPlaceholder: 'Another branch…',
    },
  ],
};

const DONE: ChoiceFormData = {
  title: 'Deploy settings',
  submitted: true,
  questions: [
    {
      id: 'when',
      title: 'When should it deploy?',
      choices: [
        { id: 'now', label: 'Now', recommended: true },
        { id: 'night', label: 'Tonight at 22:00' },
      ],
    },
    {
      id: 'notify',
      title: 'Who should hear about it?',
      choices: [{ id: 'team', label: 'The team channel' }],
      allowCustom: true,
    },
    { id: 'rollback', title: 'Keep the previous build warm?', choices: [{ id: 'yes', label: 'Yes, for 1 hour' }] },
  ],
  answers: { when: { choiceId: 'now' }, notify: { custom: '#release-notes and the on-call engineer' } },
  allowPartial: true,
};

const FAILED: ChoiceFormData = {
  id: 'cleanup',
  title: 'Clean up old branches?',
  questions: [
    {
      id: 'merged',
      title: 'Delete the 14 merged branches?',
      choices: [
        { id: 'yes', label: 'Delete them', recommended: true },
        { id: 'no', label: 'Keep them' },
      ],
    },
    {
      id: 'stale',
      title: 'And the 3 branches with no commits for 90 days?',
      choices: [
        { id: 'archive', label: 'Tag and delete', description: 'An archive/ tag keeps each tip', recommended: true },
        { id: 'keep', label: 'Keep them' },
      ],
    },
  ],
  answers: { merged: { choiceId: 'yes' }, stale: { choiceId: 'archive' } },
  error: 'The agent session ended before the answers arrived (HTTP 410).',
};

const SENDING: ChoiceFormData = {
  title: 'Agent question · 10:44',
  questions: SINGLE.questions,
  answers: { tests: { choiceId: 'changed' } },
  submitting: true,
};

const KO: ChoiceFormData = {
  id: 'release-ko',
  title: '배포 전에 확인할 것',
  description: '세 가지를 정해 주세요. 모두 추천이 있어서 **추천대로 모두 제출**로 한 번에 보낼 수 있습니다.',
  questions: [
    {
      id: 'when',
      title: '언제 배포할까요?',
      context: '오늘 18시 이후에는 트래픽이 30% 줄어듭니다.',
      choices: [
        { id: 'now', label: '지금 바로', description: '리뷰 2건 승인 완료' },
        { id: 'evening', label: '오늘 18시 이후', description: '트래픽이 적은 시간', recommended: true },
        { id: 'tomorrow', label: '내일 오전' },
      ],
    },
    {
      id: 'migrate',
      title: 'DB 마이그레이션은 어떻게 할까요?',
      context: '`20261030_add_upload_index.sql` — 인덱스 추가만 있고 테이블 잠금은 없습니다.',
      choices: [
        { id: 'with', label: '배포와 함께 실행', recommended: true },
        { id: 'separate', label: '따로 먼저 실행', description: '10분 먼저 적용하고 확인' },
      ],
    },
    {
      id: 'notify',
      title: '누구에게 알릴까요?',
      choices: [
        { id: 'channel', label: '팀 채널', recommended: true },
        { id: 'oncall', label: '당번 엔지니어만' },
      ],
      allowCustom: true,
    },
  ],
};

export const doc: ComponentDoc = {
  slug: 'choice-form',
  name: 'Choice Form',
  tag: 'ui-choice-form',
  group: 'Components',
  summary: 'What the agent needs decided — every question at once, the recommended answers one press away.',
  description:
    'Numbered question cards, each with its title, optional markdown context and choice buttons: the recommended choice first, marked with a quiet accent hairline and a small “Recommended” word, and an optional own answer. A pick folds the card into the answer — a raised chip with a check and a Change action — and moves focus to the next open question; digits 1–9 pick. Progress dots and “2 of 4 answered” show how far along the form is. “Submit all recommended” fills every open question with its recommendation in one press; Reset clears; Submit is the one ink button. With a single question it is a plain choice card that can submit on pick. Answers leave as a cancelable ui-submit; submitting, submitted (a read-only summary) and error come back from the host.',
  usedIn:
    'soma-work dashboard › session panel › 질문 — the multi-question form (E-15) and the choice buttons of a single question (E-16)',
  reference: { name: 'WAI-ARIA APG Button (toggle)', url: 'https://www.w3.org/WAI/ARIA/apg/patterns/button/' },
  props: [
    {
      name: 'data.questions',
      type: 'Array<{ id, title, context?, choices: Array<{ id, label, description?, recommended? }>, allowCustom?, customPlaceholder? }>',
      required: true,
      description:
        'The questions in order. `context` is markdown (code spans, links, lists — escaped, http(s) links only). The first choice with `recommended` is listed first and marked. `allowCustom` adds an own-answer box (Enter or Confirm; empty is refused). Nothing renders without questions.',
    },
    { name: 'data.title', type: 'string', description: 'Heading over the form (a quiet label with one question).' },
    { name: 'data.description', type: 'string', description: 'Markdown under the title.' },
    {
      name: 'data.answers',
      type: 'Record<questionId, { choiceId?: string; custom?: string }>',
      description:
        'Seed answers, read when the form’s identity changes. After that the element keeps its own working answers across data updates (e.g. `{ ...data, submitting: true }`). With `submitted`, the summary shows these when given.',
    },
    {
      name: 'data.id',
      type: 'string',
      description:
        'Identity. A new id — or a different set of question ids — resets the working answers (re-seeded from `answers`). Assign a new id to ask the same questions again from scratch.',
    },
    {
      name: 'data.submitting',
      type: 'boolean',
      default: 'false',
      description:
        'The host is sending: aria-busy, every control locked, a spinner on the button that sent. After an un-cancelled ui-submit the element is busy on its own until the host assigns data again.',
    },
    {
      name: 'data.submitted',
      type: 'boolean',
      default: 'false',
      description: 'A read-only summary: Submitted, then each question with its answer (or “No answer”).',
    },
    {
      name: 'data.error',
      type: 'string',
      description:
        'Why the last submit failed: an alert line above the actions; the form stays usable for another try.',
    },
    {
      name: 'data.allowPartial',
      type: 'boolean',
      default: 'false',
      description: 'Submit is enabled once one question is answered (default: every question).',
    },
    {
      name: 'data.submitOnPick',
      type: 'boolean',
      default: 'true with one question',
      description:
        'One question only: a pick (or a confirmed own answer) sends ui-submit at once — no Submit button. `false` keeps the pick selected and adds Submit. Ignored with two or more questions.',
    },
    {
      name: 'answers',
      type: 'ChoiceFormAnswerOut[] (getter)',
      description: 'The working answers in question order — what Submit would send now.',
    },
    {
      name: 'focus()',
      type: 'method',
      description: 'Lands on the open question’s tab stop (or Submit, or the summary).',
    },
    { name: 'lang', type: "'en' | 'ko'", default: "'en'", description: 'UI language (attribute).' },
    {
      name: 'theme',
      type: "'light' | 'dark'",
      description: 'Pins the theme (attribute). Default follows prefers-color-scheme or page tokens.',
    },
  ],
  events: [
    {
      name: 'ui-submit',
      detail:
        "{ answers: Array<{ questionId: string; choiceId?: string; label: string; custom?: string; recommended?: boolean }>; source: 'submit' | 'recommended' }",
      description:
        'Submit, “Submit all recommended” or (one question) a pick. Answers are in question order; `label` is the choice label or the own text; `recommended: true` marks a recommended pick. Cancelable: preventDefault() keeps the form as it was (no busy state, the recommended picks are not filled in).',
    },
    {
      name: 'ui-change',
      detail:
        "{ answers: ChoiceFormAnswerOut[]; answered: number; total: number; reason: 'pick' | 'custom' | 'reset'; questionId?: string }",
      description:
        'After the working answers changed: a pick, a confirmed own answer, or Reset. A notification (not cancelable) — save a draft with it.',
    },
  ],
  keyboard: [
    ['1 – 9', 'Pick that choice in the focused question (or the current one when focus is on the hero or the buttons)'],
    ['↑ ↓ ← → / Home / End', 'Move between the choices of a question'],
    ['Enter / Space', 'Pick the focused choice; Enter in the own-answer box confirms it'],
    ['Esc', 'Fold a reopened question back to its answer'],
    ['⌘ / Ctrl + Enter', 'Submit'],
    ['Tab', 'Question → own answer → next question → Reset → Submit'],
  ],
  a11y: [
    'Each question is a group labelled “Question 2 of 4: …” and described by its context; each choice is a toggle button (aria-pressed on the current answer) with its digit in aria-keyshortcuts and its description as aria-describedby.',
    'After a pick focus moves to the next open question (else Submit); the fold is inert while closed, so hidden choices never take focus. Under reduced motion the scroll is instant and the fold is a short fade.',
    'Progress is text (“2 of 4 answered”), the dots are decorative; a polite live region says the new count after each pick, “Answers cleared” after Reset and “Answers submitted” once sent.',
    'Recommended is a word as well as a tint; the answered state is a check, the word in the chip and the number turning into a check — never colour alone.',
    'Busy controls stay focusable (aria-disabled), so focus is not lost while sending; an error is a role="alert" line.',
    'Disabled Submit is described by “Answer 2 more to submit”.',
  ],
  usage: `<ui-choice-form></ui-choice-form>
<script type="module">
  import '@2lab.ai/ui/choice-form';
  const form = document.querySelector('ui-choice-form');
  form.data = {
    id: 'q-1842',
    title: 'Before I migrate the upload index',
    questions: [
      { id: 'store', title: 'Where should the index live?', context: 'Today: \`data/uploads.json\`',
        choices: [{ id: 'pg', label: 'Postgres', recommended: true }, { id: 'sqlite', label: 'SQLite' }] },
      { id: 'name', title: 'Table name?', choices: [{ id: 'uploads', label: 'uploads' }], allowCustom: true },
    ],
  };
  form.addEventListener('ui-submit', async (e) => {
    form.data = { ...form.data, submitting: true };
    const res = await fetch('/api/answers', { method: 'POST', body: JSON.stringify(e.detail.answers) });
    form.data = res.ok
      ? { ...form.data, submitting: false, submitted: true }
      : { ...form.data, submitting: false, error: 'Could not send — try again.' };
  });
</script>`,
  demos: [
    {
      id: 'multi',
      title: 'Four questions · recommendations',
      description:
        'Markdown context with a code span and a link. The last question has no recommendation, so “Submit all recommended” waits until you answer it; digits 1–9 pick.',
      height: 820,
      create: () => stage(host(make(MIGRATION))),
    },
    {
      id: 'single',
      title: 'One question · submits on pick',
      description: 'No numbering, dots or hero; a pick sends ui-submit at once and spins until the host answers.',
      height: 340,
      create: () => stage(host(make(SINGLE))),
    },
    {
      id: 'single-confirm',
      title: 'One question · pick, then Submit',
      description: 'submitOnPick: false keeps the pick selected; an own answer confirms with Enter.',
      height: 380,
      create: () => stage(host(make(SINGLE_CONFIRM))),
    },
    {
      id: 'states',
      title: 'Submitting · error · submitted',
      description:
        'A host-held busy state, a failed send (the form stays usable — Submit again) and the read-only summary with an own answer and an unanswered question.',
      height: 900,
      create: () => stage(make(SENDING), host(make(FAILED)), make(DONE)),
    },
    {
      id: 'ko',
      title: '한국어',
      description: 'Every question has a recommendation, so the hero submits the whole form in one press.',
      height: 700,
      create: () => stage(host(make(KO, { lang: 'ko' }))),
    },
  ],
};
