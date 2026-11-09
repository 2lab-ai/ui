/** UI copy. English by default, Korean with `lang="ko"`. */
const en = {
  name: 'Line chart',
  empty: 'No data yet',
  noData: 'no data',
  range: 'Usual range',
  hint: 'Use the left and right arrow keys to read each point.',
  /** A value with its unit: “184 ms”. */
  withUnit: (v: string, unit: string) => (unit ? `${v} ${unit}` : v),
  /** “30 points, 13 Oct to 11 Nov.” */
  points: (n: number, from: string, to: string) =>
    `${n} ${n === 1 ? 'point' : 'points'}${from && to && n > 1 ? `, ${from} to ${to}` : ''}.`,
  /** “Tokens: low 410K, high 1.8M, latest 1.2M.” */
  series: (label: string, low: string, high: string, last: string) =>
    `${label ? `${label}: ` : ''}low ${low}, high ${high}, latest ${last}.`,
  seriesEmpty: (label: string) => `${label ? `${label}: ` : ''}no data.`,
  /** The live line for a point: “13 Oct: Tokens 1.2M tokens, 30 days before 980K tokens”. */
  at: (head: string, parts: string[]) => `${head ? `${head}: ` : ''}${parts.join(', ')}`,
  part: (label: string, value: string) => (label ? `${label} ${value}` : value),
};

export type LineChartStrings = typeof en;

const ko: LineChartStrings = {
  name: '꺾은선 차트',
  empty: '아직 데이터가 없습니다',
  noData: '데이터 없음',
  range: '정상 범위',
  hint: '왼쪽·오른쪽 화살표 키로 각 지점의 값을 읽을 수 있습니다.',
  withUnit: (v: string, unit: string) => (unit ? `${v} ${unit}` : v),
  points: (n: number, from: string, to: string) =>
    `${n}개 지점${from && to && n > 1 ? `, ${from}부터 ${to}까지` : ''}.`,
  series: (label: string, low: string, high: string, last: string) =>
    `${label ? `${label}: ` : ''}최저 ${low}, 최고 ${high}, 최근 ${last}.`,
  seriesEmpty: (label: string) => `${label ? `${label}: ` : ''}데이터 없음.`,
  at: (head: string, parts: string[]) => `${head ? `${head}: ` : ''}${parts.join(', ')}`,
  part: (label: string, value: string) => (label ? `${label} ${value}` : value),
};

export const STRINGS = { en, ko };

export function lineChartStrings(lang: string | null | undefined): LineChartStrings {
  return lang === 'ko' ? STRINGS.ko : STRINGS.en;
}
