const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const en = {
  heroLabel: 'Submit all recommended',
  heroFill: (n: number) => `Fills ${n} unanswered ${plural(n, 'question', 'questions')}`,
  heroMissing: (n: number) => `${n} ${plural(n, 'question has', 'questions have')} no recommendation`,
  heroDone: 'Every question is answered',
  progress: (a: number, n: number) => `${a} of ${n} answered`,
  question: (i: number, n: number) => `Question ${i} of ${n}`,
  recommended: 'Recommended',
  picked: 'Your answer',
  change: 'Change',
  changeLabel: (title: string) => `Change answer — ${title}`,
  choices: (title: string) => `Choices — ${title}`,
  custom: 'Custom',
  customPlaceholder: 'Or write your own answer…',
  customLabel: (title: string) => `Your own answer — ${title}`,
  confirm: 'Confirm',
  customEmpty: 'Write an answer first.',
  reset: 'Reset',
  submit: 'Submit',
  submitting: 'Submitting…',
  needMore: (n: number) => `Answer ${n} more to submit`,
  submitted: 'Submitted',
  submittedSay: 'Answers submitted',
  noAnswer: 'No answer',
  failed: 'Could not send the answers.',
  cleared: 'Answers cleared',
  locked: 'You cannot answer this one.',
};

export type ChoiceFormStrings = typeof en;
export type ChoiceFormLang = 'en' | 'ko';

const ko: ChoiceFormStrings = {
  heroLabel: '추천대로 모두 제출',
  heroFill: (n) => `답하지 않은 질문 ${n}개를 추천으로 채움`,
  heroMissing: (n) => `추천이 없는 질문 ${n}개`,
  heroDone: '모든 질문에 답함',
  progress: (a, n) => `${n}개 중 ${a}개 답함`,
  question: (i, n) => `질문 ${i}/${n}`,
  recommended: '추천',
  picked: '내 답',
  change: '변경',
  changeLabel: (title) => `답 변경 — ${title}`,
  choices: (title) => `선택지 — ${title}`,
  custom: '직접 입력',
  customPlaceholder: '또는 직접 입력…',
  customLabel: (title) => `직접 입력 — ${title}`,
  confirm: '확인',
  customEmpty: '답을 먼저 입력하세요.',
  reset: '초기화',
  submit: '제출',
  submitting: '제출 중…',
  needMore: (n) => `${n}개 더 답하면 제출할 수 있음`,
  submitted: '제출됨',
  submittedSay: '답을 제출함',
  noAnswer: '답 없음',
  failed: '답을 보내지 못했습니다.',
  cleared: '답을 모두 지움',
  locked: '이 질문에는 답할 수 없습니다.',
};

export const CHOICE_FORM_STRINGS: Record<ChoiceFormLang, ChoiceFormStrings> = { en, ko };

export function choiceFormStrings(lang: string | null | undefined): ChoiceFormStrings {
  return lang === 'ko' ? ko : en;
}
