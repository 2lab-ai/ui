/** UI copy. English by default, Korean with `lang="ko"` (the soma-work 작업 로그 wording). */
const en = {
  running: 'Running',
  done: 'Finished',
  failed: 'Failed',
  noResult: 'No result',
  args: 'Arguments',
  result: 'Result',
  waiting: 'Waiting for result…',
  nothing: 'No arguments or result.',
  failedDefault: 'The tool call failed.',
  interrupted: 'The run ended before this call returned.',
  showAll: 'Show all',
  showLess: 'Show less',
  retry: 'Retry',
  reload: 'Try again',
  loading: 'Loading…',
  copy: (part: string) => `Copy ${part.toLowerCase()}`,
  copied: 'Copied',
  selected: 'Selected — press ⌘C / Ctrl+C to copy',
  startedAt: (clock: string) => `Started at ${clock}`,
  sayRunning: (name: string) => `${name} running`,
  sayDone: (name: string) => `${name} finished`,
  sayFailed: (name: string, error: string) => `${name} failed${error ? `: ${error}` : ''}`,
  sayInterrupted: (name: string) => `${name} ended without a result`,
  used: (n: number) => `Used ${n} ${n === 1 ? 'tool' : 'tools'}`,
  using: 'Using tools…',
  nFailed: (n: number) => `${n} failed`,
  groupSay: (label: string, failed: number) => `${label}${failed ? `, ${failed} failed` : ''}`,
};

export type ToolCallStrings = typeof en;

const ko: ToolCallStrings = {
  running: '실행 중',
  done: '완료',
  failed: '실패',
  noResult: '결과 없음',
  args: '입력',
  result: '결과',
  waiting: '결과 기다리는 중…',
  nothing: '입력과 결과 없음',
  failedDefault: '툴 호출이 실패했어요',
  interrupted: '이 호출이 끝나기 전에 실행이 멈췄어요',
  showAll: '모두 보기',
  showLess: '접기',
  retry: '다시 시도',
  reload: '다시 시도',
  loading: '불러오는 중…',
  copy: (part: string) => `${part} 복사`,
  copied: '복사됨',
  selected: '선택했습니다 — ⌘C / Ctrl+C로 복사',
  startedAt: (clock: string) => `${clock} 시작`,
  sayRunning: (name: string) => `${name} 실행 중`,
  sayDone: (name: string) => `${name} 완료`,
  sayFailed: (name: string, error: string) => `${name} 실패${error ? `: ${error}` : ''}`,
  sayInterrupted: (name: string) => `${name} 결과 없이 끝남`,
  used: (n: number) => `툴 ${n}개 사용`,
  using: '툴 사용 중…',
  nFailed: (n: number) => `${n}개 실패`,
  groupSay: (label: string, failed: number) => `${label}${failed ? `, ${failed}개 실패` : ''}`,
};

export const STRINGS = { en, ko };

export type ToolCallLang = keyof typeof STRINGS;

export function toolCallStrings(lang: string | null | undefined): ToolCallStrings {
  return lang === 'ko' ? STRINGS.ko : STRINGS.en;
}
