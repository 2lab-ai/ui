/** UI copy. English by default, Korean with `lang="ko"` (the soma-work dashboard wording). */
const en = {
  label: 'Notifications',
  close: 'Close',
  /** Spoken before an error / warning title, so the tone is never colour alone. */
  error: 'Error',
  warning: 'Warning',
  more: (n: number) => `+${n}`,
  moreSay: (n: number) => `${n} more ${n === 1 ? 'notification' : 'notifications'} waiting`,
  /** Built-in action labels, by action id. */
  actions: { retry: 'Retry', undo: 'Undo', open: 'Open' } as Record<string, string>,
  /** promise() defaults when a message is left out. */
  working: 'Working…',
  done: 'Done',
  failed: 'Something went wrong',
};

export type ToasterStrings = typeof en;

const ko: ToasterStrings = {
  label: '알림',
  close: '닫기',
  error: '오류',
  warning: '주의',
  more: (n: number) => `+${n}`,
  moreSay: (n: number) => `알림 ${n}개 대기 중`,
  actions: { retry: '다시 시도', undo: '실행 취소', open: '열기' },
  working: '처리 중…',
  done: '완료했어요',
  failed: '실패했어요',
};

export const STRINGS = { en, ko };

export type ToasterLang = keyof typeof STRINGS;

export function toasterStrings(lang: string | null | undefined): ToasterStrings {
  return lang === 'ko' ? STRINGS.ko : STRINGS.en;
}
