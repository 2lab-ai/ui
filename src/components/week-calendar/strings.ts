import type { WeekLang } from './logic';

/** UI copy. English by default, Korean with `lang="ko"`. */
const en = {
  name: 'Week schedule',
  view: 'View',
  week: 'Week',
  list: 'List',
  prev: (days: number) => (days === 7 ? 'Previous week' : `Previous ${days === 1 ? 'day' : `${days} days`}`),
  next: (days: number) => (days === 7 ? 'Next week' : `Next ${days === 1 ? 'day' : `${days} days`}`),
  empty: 'Nothing scheduled this week',
  /** The live announcement after a move: slot = "Thu 12 Nov 09:30". */
  moved: (slot: string) => `Moved to ${slot}`,
  locked: 'Fixed time',
  cannotMove: 'Fixed time — it cannot be moved',
  hint: 'Drag a block to move it',
  /** Read after an event's name: how the keyboard moves it. */
  keys: (step: number) => `Alt and the arrow keys move it by ${step} minutes or a day.`,
  today: 'today',
};

export type WeekStrings = typeof en;

const ko: WeekStrings = {
  name: '주간 일정',
  view: '보기',
  week: '주',
  list: '목록',
  prev: (days) => (days === 7 ? '이전 주' : `이전 ${days}일`),
  next: (days) => (days === 7 ? '다음 주' : `다음 ${days}일`),
  empty: '이번 주 일정이 없습니다',
  moved: (slot) => `${slot} 시작으로 옮겼습니다`,
  locked: '고정된 시간',
  cannotMove: '고정된 시간이라 옮길 수 없습니다',
  hint: '블록을 끌어 옮기세요',
  keys: (step) => `Alt와 방향키로 ${step}분 또는 하루씩 옮깁니다.`,
  today: '오늘',
};

export const STRINGS: Record<WeekLang, WeekStrings> = { en, ko };

export function weekStrings(lang: string | null | undefined): WeekStrings {
  return lang === 'ko' ? ko : en;
}
