/** UI copy. English by default, Korean with `lang="ko"` (the dashboard stats wording: 합계 · 데이터 없음). */
const en = {
  name: 'Bar chart',
  empty: 'No data for this period',
  loading: 'Loading…',
  total: 'Total',
  noData: 'No data',
  /** A value with its unit: “12 sessions”. */
  withUnit: (v: string, unit: string) => (unit ? `${v} ${unit}` : v),
  /** One series in a stacked bar's label: “7 done”. */
  part: (v: string, label: string) => (label ? `${v} ${label}` : v),
  partTotal: (v: string) => `${v} total`,
  /** A bar's accessible label: “Mon 3 Nov: 12 sessions”. */
  bar: (head: string, body: string) => (head ? `${head}: ${body}` : body),
  summary: (n: number, head: string, top: string, total: string) =>
    `${n} ${n === 1 ? 'bar' : 'bars'} · highest ${head}, ${top} · total ${total}`,
};

export type BarChartStrings = typeof en;

const ko: BarChartStrings = {
  name: '막대 차트',
  empty: '이 기간에 데이터가 없습니다',
  loading: '불러오는 중…',
  total: '합계',
  noData: '데이터 없음',
  withUnit: (v: string, unit: string) => (unit ? `${unit} ${v}` : v),
  part: (v: string, label: string) => (label ? `${label} ${v}` : v),
  partTotal: (v: string) => `합계 ${v}`,
  bar: (head: string, body: string) => (head ? `${head}: ${body}` : body),
  summary: (n: number, head: string, top: string, total: string) =>
    `막대 ${n}개 · 가장 높은 막대 ${head}, ${top} · 합계 ${total}`,
};

export const STRINGS = { en, ko };

export function barChartStrings(lang: string | null | undefined): BarChartStrings {
  return lang === 'ko' ? STRINGS.ko : STRINGS.en;
}
