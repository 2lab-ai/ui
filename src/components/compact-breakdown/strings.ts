/** UI copy. English by default, Korean with `lang="ko"` (the soma-work stats strip wording: 기간 · 합계 · 기타). */
const en = {
  total: 'Total',
  period: 'Period',
  other: (n: number) => (n > 0 ? `Other (${n})` : 'Other'),
  largest: 'Largest',
  empty: 'Nothing to break down for this period.',
  error: 'Couldn’t load these numbers.',
  loading: 'Loading…',
  sayTotal: (label: string, value: string) => `${label}: ${value}`,
  sayRow: (label: string, value: string, share: string) => `${label}: ${value}, ${share} of the total`,
  sayLargest: (label: string) => `largest ${label}`,
};

export type CompactBreakdownStrings = typeof en;

const ko: CompactBreakdownStrings = {
  total: '합계',
  period: '기간',
  other: (n: number) => (n > 0 ? `기타 ${n}개` : '기타'),
  largest: '가장 큰 항목',
  empty: '이 기간에는 나눌 항목이 없어요',
  error: '숫자를 불러오지 못했어요',
  loading: '불러오는 중…',
  sayTotal: (label: string, value: string) => `${label} ${value}`,
  sayRow: (label: string, value: string, share: string) => `${label} ${value}, 전체의 ${share}`,
  sayLargest: (label: string) => `가장 큰 항목 ${label}`,
};

export const STRINGS = { en, ko };

export type CompactBreakdownLang = keyof typeof STRINGS;

export function compactBreakdownStrings(lang: string | null | undefined): CompactBreakdownStrings {
  return lang === 'ko' ? STRINGS.ko : STRINGS.en;
}
