/**
 * UI copy. English by default, Korean with `lang="ko"`. The Korean comes from soma-work: the dashboard composer
 * (이 세션에 지시, 이 세션은 종료되었습니다) and the Slack follow-up queue (전달됨 · 모델이 다음 툴 호출에서 읽음, 편집됨).
 * Slack keeps its buttons in English (Send now / Cancel); the dashboard's Korean UI words them 지금 보내기 / 취소.
 */
const en = {
  /** The queue's heading: while the agent works, notes wait for its next step. */
  queueRunning: 'Queued for the next step',
  queueIdle: 'Queued',
  count: (n: number) => `${n} ${n === 1 ? 'note' : 'notes'}`,
  fieldRunning: 'Steer the agent',
  fieldIdle: 'Message the session',
  placeholderRunning: 'Steer the agent…',
  placeholderIdle: 'Send a message…',
  readOnly: 'Read-only — not your session',
  ended: 'This session has ended',
  sendRunning: 'Queue for the next step',
  sendIdle: 'Send',
  hintNext: 'next step',
  hintSteer: 'steer now',
  hintSend: 'send',
  hintNewline: 'new line',
  sendNow: 'Send now',
  sendNowRunning: 'Hand it to the running turn now',
  sendNowIdle: 'Run it now',
  edit: 'Edit',
  cancel: 'Cancel',
  retry: 'Retry',
  save: 'Save',
  stopEditing: 'Cancel',
  editLabel: 'Edit the note',
  editHint: '↵ save · Esc cancel',
  aria: {
    promote: (t: string) => `Send now: “${t}”`,
    edit: (t: string) => `Edit “${t}”`,
    cancel: (t: string) => `Cancel “${t}”`,
    retry: (t: string) => `Retry “${t}”`,
  },
  state: {
    sending: 'Sending…',
    queuing: 'Queuing…',
    saving: 'Saving…',
    steered: 'Delivered · the agent reads it at its next tool call',
    failed: 'Couldn’t send',
  },
  filesOnly: '(files only)',
  files: (n: number) => `${n} ${n === 1 ? 'file' : 'files'}`,
  say: {
    queued: (t: string) => `Queued for the next step: ${t}`,
    steer: (t: string) => `Steering now: ${t}`,
    sent: (t: string) => `Sent: ${t}`,
    promoted: (t: string) => `Sending now: ${t}`,
    saved: (t: string) => `Saved: ${t}`,
    cancelled: (t: string) => `Cancelled: ${t}`,
    delivered: (t: string) => `Delivered: ${t}`,
    failed: (t: string, why: string) => `Couldn’t send: ${t}${why ? ` — ${why}` : ''}`,
  },
};

export type SteeringStrings = typeof en;

const ko: SteeringStrings = {
  queueRunning: '다음 단계에 전달 대기',
  queueIdle: '대기 중인 메시지',
  count: (n: number) => `${n}개`,
  fieldRunning: '작업 중인 에이전트에 지시',
  fieldIdle: '이 세션에 지시',
  placeholderRunning: '작업 중인 에이전트에 지시…',
  placeholderIdle: '이 세션에 지시…',
  readOnly: '읽기 전용 — 내 세션이 아닙니다',
  ended: '이 세션은 종료되었습니다',
  sendRunning: '다음 단계에 전달',
  sendIdle: '보내기',
  hintNext: '다음 단계',
  hintSteer: '지금 반영',
  hintSend: '보내기',
  hintNewline: '줄바꿈',
  sendNow: '지금 보내기',
  sendNowRunning: '실행 중인 턴에 바로 전달',
  sendNowIdle: '지금 실행',
  edit: '수정',
  cancel: '취소',
  retry: '다시 시도',
  save: '저장',
  stopEditing: '그만두기',
  editLabel: '메시지 수정',
  editHint: '↵ 저장 · Esc 그만두기',
  aria: {
    promote: (t: string) => `지금 보내기: “${t}”`,
    edit: (t: string) => `수정: “${t}”`,
    cancel: (t: string) => `취소: “${t}”`,
    retry: (t: string) => `다시 시도: “${t}”`,
  },
  state: {
    sending: '보내는 중…',
    queuing: '대기열에 넣는 중…',
    saving: '저장 중…',
    steered: '전달됨 · 모델이 다음 툴 호출에서 읽음',
    failed: '보내지 못했습니다',
  },
  filesOnly: '(파일만)',
  files: (n: number) => `파일 ${n}개`,
  say: {
    queued: (t: string) => `다음 단계에 전달 대기: ${t}`,
    steer: (t: string) => `지금 반영: ${t}`,
    sent: (t: string) => `보냄: ${t}`,
    promoted: (t: string) => `지금 보냄: ${t}`,
    saved: (t: string) => `수정함: ${t}`,
    cancelled: (t: string) => `취소함: ${t}`,
    delivered: (t: string) => `전달됨: ${t}`,
    failed: (t: string, why: string) => `보내지 못했습니다: ${t}${why ? ` — ${why}` : ''}`,
  },
};

export const STRINGS = { en, ko };

export type SteeringLang = keyof typeof STRINGS;

export function steeringStrings(lang: string | null | undefined): SteeringStrings {
  return lang === 'ko' ? STRINGS.ko : STRINGS.en;
}
