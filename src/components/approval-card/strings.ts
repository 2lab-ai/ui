import type { ApprovalOutcome, ApprovalRisk } from './logic';

/**
 * UI copy. English by default, Korean with `lang="ko"` — the soma-work dashboard's 입력 필요 wording (실행 승인,
 * 승인함, 만료됨, 추천, 제출하기 …). The permission buttons stay Approve / Deny / Explain in both, as on the dashboard
 * and in Slack.
 */
const en = {
  title: (tool: string) => `${tool} approval`,
  requested: (time: string) => `requested ${time}`,
  risk: { low: 'Low', medium: 'Medium', high: 'High' } as Record<ApprovalRisk, string>,
  /** Around the level: “High risk” / “위험 높음”. Hidden below 340px. */
  riskPre: '',
  riskPost: ' risk',
  question: 'Question',
  rules: (n: number): string => (n > 1 ? 'Matched dangerous-command rules' : 'Matched dangerous-command rule'),
  truncated: 'Showing the beginning only',
  moreLines: (n: number) => `${n} more ${n === 1 ? 'line' : 'lines'} not shown`,
  loading: 'Loading the input…',
  approve: 'Approve',
  deny: 'Deny',
  explain: 'Explain',
  /** An irreversible action: the slide that approves it, its busy words, and the line that says what is at stake. */
  slideApprove: 'Slide to approve',
  slideBusy: 'Approving…',
  irreversible: (what: string) => `Cannot be undone: ${what}`,
  disableRule: (n: number): string =>
    n > 1 ? 'Disable these rules for this session' : 'Disable this rule for this session',
  submit: 'Submit',
  recommended: 'Recommended',
  other: 'Other',
  otherPlaceholder: 'Type your answer…',
  otherLabel: 'Your answer',
  expiresIn: (clock: string) => `Expires in ${clock}`,
  expiresAt: (time: string) => `Expires at ${time}.`,
  expired: 'Expired',
  retry: 'Retry',
  failed: 'Couldn’t send your answer.',
  outcome: {
    approved: 'Approved',
    denied: 'Denied',
    explained: 'Explanation requested',
    answered: 'Answered',
    expired: 'Expired',
    elsewhere: 'Answered elsewhere',
  } as Record<ApprovalOutcome, string>,
  ruleDisabled: 'rule disabled',
  by: (who: string) => `by ${who}`,
  say: (status: string, title: string) => `${status}: ${title}`,
};

export type ApprovalStrings = typeof en;

const ko: ApprovalStrings = {
  title: (tool: string) => `${tool} 실행 승인`,
  requested: (time: string) => `${time} 요청`,
  risk: { low: '낮음', medium: '보통', high: '높음' },
  riskPre: '위험 ',
  riskPost: '',
  question: '질문',
  rules: () => '걸린 위험 명령 규칙',
  truncated: '앞부분만 표시합니다',
  moreLines: (n: number) => `${n}줄 더 있음`,
  loading: '파라미터 불러오는 중…',
  approve: 'Approve',
  deny: 'Deny',
  explain: 'Explain',
  slideApprove: '밀어서 승인',
  slideBusy: '승인 중…',
  irreversible: (what: string) => `되돌릴 수 없음: ${what}`,
  disableRule: (n: number) => (n > 1 ? '이 세션에서 이 규칙들 끄기' : '이 세션에서 이 규칙 끄기'),
  submit: '제출하기',
  recommended: '추천',
  other: '직접 입력',
  otherPlaceholder: '직접 입력…',
  otherLabel: '직접 입력한 답',
  expiresIn: (clock: string) => `만료까지 ${clock}`,
  expiresAt: (time: string) => `${time}에 만료`,
  expired: '만료됨',
  retry: '다시 시도',
  failed: '응답을 보내지 못했습니다',
  outcome: {
    approved: '승인함',
    denied: '거부함',
    explained: '설명 요청함',
    answered: '답함',
    expired: '만료됨',
    elsewhere: '다른 곳에서 응답함',
  },
  ruleDisabled: '규칙 끔',
  by: (who: string) => who,
  say: (status: string, title: string) => `${status}: ${title}`,
};

export const STRINGS = { en, ko };

export type ApprovalLang = keyof typeof STRINGS;

export function approvalStrings(lang: string | null | undefined): ApprovalStrings {
  return lang === 'ko' ? STRINGS.ko : STRINGS.en;
}
