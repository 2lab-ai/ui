import { spanShort } from './logic';

/** Live time phrases. `at` is the epoch the phrase counts to (or from, for `since` / `fetched`). */
export type TimeKind = 'left' | 'in' | 'back' | 'runs' | 'since' | 'fetched';

const en = {
  /** Time left, floored: 1d 5h · 1h 20m · 24m · 42s. */
  dur: (s: number) => {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    if (h) return `${h}h ${m % 60}m`;
    return `${m}m`;
  },
  /** How long ago, minutes floored: <1m · 11m · 3h 5m · 1d 6h (the `since` phrase). */
  span: (secs: number) => spanShort(secs),
  soon: 'soon',
  in: (x: string) => `in ${x}`,
  back: (x: string) => `back in ${x}`,
  backSoon: 'back soon',
  runs: (x: string) => `runs in ${x}`,
  runsSoon: 'runs soon',
  since: (x: string) => `${x} ago`,
  fetched: (s: number) => (s < 60 ? `updated ${s}s ago` : `updated ${Math.floor(s / 60)}m ago`),
  /** Age of a measurement, first unit only: 12m · 4h · 6d. */
  age: (s: number) => {
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return h >= 24 ? `${Math.floor(h / 24)}d` : h ? `${h}h` : `${Math.max(1, m)}m`;
  },

  // Capacity
  capTitle: 'LLM capacity',
  capError: (r: string) => `Couldn’t load capacity — ${r}`,
  capNone: 'No accounts in the pool',
  capAria: (n: string) => `${n} capacity`,
  source: (src: string, n: number) => `${src ? `${src} · ` : ''}${n} ${n === 1 ? 'account' : 'accounts'}`,
  pill: {
    unknown: '◌ Can’t compute',
    allLimited: '✗ All limited',
    empty: '✗ Used up',
    limited: (n: number) => `⏸ Limited ${n}`,
    low: '▲ Low',
    ok: '● Available',
  },
  disc: {
    reflected: (c: number, n: number) => `${c}/${n} reflected`,
    blocked: (b: number) => ` (${b} limited incl.)`,
    excluded: (n: number, why: string) => `excluded ${n} (${why})`,
    held: 'held',
    unknownTier: 'no tier',
    noMeasure: 'no measure',
    assumed: (n: number, tier: string) => `no tier ${n} (${tier} assumed)`,
    estimated: (n: number) => `estimated ${n}`,
    unmeasured: (n: number) => `5h unmeasured ${n}`,
    measured: (a: string) => `measured ${a} ago`,
  },
  bar: {
    fiveHour: '5-hour',
    fiveHourSub: 'available now',
    weekly: 'Weekly',
    weeklySub: 'left this week',
    of: (total: string) => `/ ${total} accounts`,
    said: (label: string, v: string, total: string, pct: string) => `${label} ${v} of ${total} accounts, ${pct}`,
    low: (p: number) => `Below ${p}% the pool reads low`,
    next: (gain: string) => `next +${gain} · `,
    heldByWeekly: 'held by the weekly limit · ',
    backWithin: (g: string) => `${g} back within 7 days`,
    nothing: 'nothing returns within 7 days',
    unknown: 'Can’t compute — no countable accounts',
  },
  gain: (x: number, f: (n: number) => string) => (x <= 1e-7 ? '+0' : x < 0.05 ? '< +0.1' : `+${f(x)}`),
  cause: { '5h': '5-hour reset', '7d': 'weekly reset', release: 'block lifted' } as Record<string, string>,
  workers: 'Accounts',
  workersAria: (name: string, r: number, n: number) => `${name} accounts: ${r} of ${n} available`,
  reason: {
    weekly: 'weekly limit',
    '5h': '5-hour limit',
    model: 'model limit',
    cooldown: 'cooldown',
    paused: 'paused',
    auth: 'auth failed',
    held: 'held',
    noMeasure: 'no measure',
    unknownTier: 'no tier',
  } as Record<string, string>,
  stateWord: {
    available: 'available',
    limited: 'limited',
    paused: 'paused',
    spent: 'used up',
    unmeasured: '5h unmeasured',
    excluded: 'excluded',
  } as Record<string, string>,
  noReturn: 'no return time',
  okFoldAria: (n: number) => `${n} available accounts — show list`,
  foldAria: (word: string, n: number) => `${word}: ${n} ${n === 1 ? 'account' : 'accounts'} — show list`,
  tierAssumed: (t: string) => `${t} assumed`,
  noTier: 'no tier',
  card: {
    aria: (n: string) => `${n} details`,
    close: 'Close',
    now: 'Available now',
    week: 'Left this week',
    binds: 'Binds first',
    h5: '5-hour',
    wk: 'Weekly',
    state: 'State',
    returns: 'Returns',
    estimated: 'Estimated',
    estimatedSay: 'last reset counted as full',
    okTitle: 'Available',
    okAria: 'Available accounts',
    stackAria: (word: string) => `${word} accounts`,
    okKind: (p: string, n: number) => `${p} · ${n} ${n === 1 ? 'account' : 'accounts'}`,
    okRow: (now: string, wk: string) => `now ${now} · week ${wk}`,
  },
  tl: {
    h5: '5-hour reset',
    wk: 'Weekly reset',
    note: 'Returning over the next 7 days (accounts)',
    none5: ' — nothing within 7 days',
    small5: (g: string) => ` — ${g} within 7 days`,
    aria: 'Accounts returning over the next 7 days',
    axis: ['now', '1h', '6h', '24h', '3d', '5d', '7d'],
    mark: (w: string, gain: string, when: string, names: string) =>
      `${w} +${gain} accounts · ${when}${names ? ` · ${names}` : ''}`,
    lim: (until: string) => `All limited — until ${until}`,
    limNone: 'All limited — no return within 7 days',
  },
  fold: {
    expand: 'Expand',
    collapse: 'Collapse',
    aria: (word: string, section: string) => `${word} ${section}`,
  },
  /** Collapsed capacity: one chip per provider. */
  chip: {
    now: 'now',
    week: 'week',
    error: (r: string) => `Capacity unknown · ${r}`,
    none: 'No accounts',
    aria: 'Capacity by provider',
    said5: (v: string, total: string, pct: string) => `5-hour (now) ${v}/${total} accounts (${pct})`,
    saidWk: (v: string, total: string, pct: string) => `weekly ${v}/${total} accounts (${pct})`,
    word: { low: ' · low', empty: ' · used up', unknown: ' · can’t compute' } as Record<string, string>,
    limSaid: (n: number, back: string) => ` · limited ${n}${back ? ` — ${back}` : ''}`,
    firstBack: (d: string) => `first back in ${d}`,
    stale: (age: string) => `${age} ago`,
    assumed: (tier: string, n: number) => `${tier} assumed ${n}`,
  },
  news: {
    allLimited: (n: string, back: string) => `${n}: all accounts limited${back ? ` — ${back}` : ''}`,
    empty: (n: string, back: string) => `${n}: nothing usable${back ? ` — ${back}` : ''}`,
    again: (n: string, r: number, total: number) => `${n} available again — ${r}/${total} accounts`,
    low: (n: string, wk: boolean, p: number, v: string, t: string) =>
      `${n} below ${p}% ${wk ? 'this week' : 'now'} — ${v}/${t} accounts`,
    fail: (n: string, err: string) => `Cron ${n} failed${err ? `: ${err}` : ''}`,
    wait: (n: string) => `Cron ${n} needs a reply`,
  },

  // Lane
  laneAria: (t: string) => `${t} lane`,
  running: (n: number) => `● Running ${n}`,
  waiting: (n: number) => `▲ Needs reply ${n}`,
  stat: {
    next: 'Next run',
    running: 'Running',
    runs: 'Runs in 24h',
    fails: 'Failures · 24h',
    nextTitle: (name: string, at: string) => `Soonest next run — ${name} at ${at}`,
    none: 'Nothing scheduled',
    runningTitle: (r: number, n: number) => `${r} of ${n} jobs have a running session now`,
    unknown: (u: number) => `+${u} unknown`,
    runsTitle: (n: number, ok: number, f: number, run: number) =>
      `${n} run records in the last 24 h: ${ok} ok · ${f} failed · ${run} in progress`,
    unknownTitle: (u: number) => ` · ${u} with an unknown result not counted`,
    failsTitle: 'Failed run records in the last 24 h',
    cut: (name: string, cap: number, from: string) => `${name} keeps ${cap} runs, so its history starts at ${from}`,
  },
  queue: {
    head: 'Up next',
    headTitle: 'Jobs with a next run, soonest first',
    aria: 'Next runs in order',
    empty: 'Nothing scheduled',
    said: (name: string, when: string, i: number, n: number) => `${name}, ${when}, ${i} of ${n} — show past runs`,
  },
  job: {
    past: (n: number) => `Past runs ${n}`,
    next: (clock: string) => `next ${clock} (`,
    exprTitle: (e: string) => `${e} — cron expression (UTC)`,
    strip: (name: string, k: number, sum: string) =>
      `${name}: last ${k} runs${sum ? ` (${sum})` : ''} — show past runs`,
    noRuns: 'No runs yet',
    noRecords: 'No run records',
    running: '● Running',
    waiting: '▲ Needs reply',
  },
  run: {
    ok: 'OK',
    running: 'Running',
    waiting: 'Needs reply',
    failed: 'Failed',
    unknown: 'Result unknown',
  } as Record<string, string>,
  runCount: { ok: 'ok', run: 'in progress', fail: 'failed', unknown: 'unknown' } as Record<string, string>,
  runSum: (n: number, word: string) => `${n} ${word}`,
  chart: {
    title: 'Runs · 24 hours',
    ok: 'OK',
    run: 'In progress',
    fail: 'Failed',
    okTitle: 'Success record, session idle',
    runTitle: 'Recorded run whose session is running or waiting now',
    failTitle: 'Failed record',
    axis: ['24h ago', '12h ago', 'now'],
    col: (at: string, ok: number, f: number, r: number) => `1 h from ${at} · ok ${ok} · failed ${f} · in progress ${r}`,
    said: (n: number, ok: number, f: number, r: number) =>
      `${n} cron run records in the last 24 hours: ${ok} ok, ${f} failed, ${r} in progress`,
    peak: (at: string, n: number) => `, busiest hour from ${at} with ${n}`,
    cut: (at: string) => ` Before ${at} some job histories are truncated.`,
    unknown: (u: number) => ` ${u} runs with an unknown result are not counted.`,
    hatch: (names: string) => `${names} history is truncated here — counts may be low`,
  },
};

export type Strings = typeof en;

const ko: Strings = {
  dur: (s: number) => {
    if (s < 60) return `${s}초`;
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h >= 24) return `${Math.floor(h / 24)}일 ${h % 24}시간`;
    if (h) return `${h}시간 ${m % 60}분`;
    return `${m}분`;
  },
  span: (secs: number) => {
    const sec = Math.max(0, Math.floor(Number(secs) || 0));
    if (sec < 60) return '방금';
    const m = Math.floor(sec / 60);
    if (m < 60) return `${m}분`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 ${m % 60}분`;
    return `${Math.floor(h / 24)}일 ${h % 24}시간`;
  },
  soon: '곧',
  in: (x) => `${x} 후`,
  back: (x) => `${x} 후 복귀`,
  backSoon: '곧 복귀',
  runs: (x) => `${x} 후 실행`,
  runsSoon: '곧 실행',
  since: (x) => `${x} 전`,
  fetched: (s) => (s < 60 ? `${s}초 전 갱신` : `${Math.floor(s / 60)}분 전 갱신`),
  age: (s) => {
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return h >= 24 ? `${Math.floor(h / 24)}일` : h ? `${h}시간` : `${Math.max(1, m)}분`;
  },

  capTitle: 'LLM 가용량',
  capError: (r) => `가용량을 불러오지 못했습니다 — ${r}`,
  capNone: '풀에 계정이 없습니다',
  capAria: (n) => `${n} 가용량`,
  source: (src, n) => `${src ? `${src} · ` : ''}계정 ${n}`,
  pill: {
    unknown: '◌ 계산 불가',
    allLimited: '✗ 모두 막힘',
    empty: '✗ 소진',
    limited: (n) => `⏸ 제한 ${n}`,
    low: '▲ 부족',
    ok: '● 사용 가능',
  },
  disc: {
    reflected: (c, n) => `${c}/${n} 반영`,
    blocked: (b) => `(차단 ${b} 포함)`,
    excluded: (n, why) => `제외 ${n}(${why})`,
    held: '보류',
    unknownTier: '티어 미지정',
    noMeasure: '측정 없음',
    assumed: (n, tier) => `티어 미지정 ${n}(${tier} 가정)`,
    estimated: (n) => `추정 ${n}`,
    unmeasured: (n) => `5시간 측정 없음 ${n}`,
    measured: (a) => `측정 ${a} 전`,
  },
  bar: {
    fiveHour: '5시간',
    fiveHourSub: '지금 쓸 수 있음',
    weekly: '일주일',
    weeklySub: '이번 주 남음',
    of: (total) => `/ ${total} 계정`,
    said: (label, v, total, pct) => `${label} ${v} / ${total} 계정, ${pct}`,
    low: (p) => `${p}% 아래면 부족`,
    next: (gain) => `다음 +${gain}계정 · `,
    heldByWeekly: '일주일 한도에 묶임 · ',
    backWithin: (g) => `7일 안 ${g} 회복`,
    nothing: '7일 안에 늘어날 양 없음',
    unknown: '계산 불가 — 셀 수 있는 계정이 없음',
  },
  gain: (x, f) => (x <= 1e-7 ? '+0' : x < 0.05 ? '+0.1계정 미만' : `+${f(x)}계정`),
  cause: { '5h': '5시간 리셋', '7d': '일주일 리셋', release: '차단 해제' },
  workers: '계정',
  workersAria: (name, r, n) => `${name} 계정 ${r}/${n} 사용 가능`,
  reason: {
    weekly: '주간 한도',
    '5h': '5시간 한도',
    model: '모델 한도',
    cooldown: '쿨다운',
    paused: '일시정지',
    auth: '인증 실패',
    held: '보류',
    noMeasure: '측정 없음',
    unknownTier: '티어 미지정',
  },
  stateWord: {
    available: '사용 가능',
    limited: '차단',
    paused: '보류',
    spent: '소진',
    unmeasured: '5시간 미측정',
    excluded: '제외',
  },
  noReturn: '복귀 약속 없음',
  okFoldAria: (n) => `사용 가능 계정 ${n}개 — 목록 보기`,
  foldAria: (word, n) => `${word} 계정 ${n}개 — 목록 보기`,
  tierAssumed: (t) => `${t} 가정`,
  noTier: '티어 미지정',
  card: {
    aria: (n) => `${n} 세부`,
    close: '닫기',
    now: '지금 쓸 수 있음',
    week: '이번 주 남음',
    binds: '먼저 닿는 창',
    h5: '5시간',
    wk: '일주일',
    state: '상태',
    returns: '복귀',
    estimated: '추정',
    estimatedSay: '지난 리셋을 가득으로 침',
    okTitle: '사용 가능',
    okAria: '사용 가능 계정 세부',
    stackAria: (word) => `${word} 계정 세부`,
    okKind: (p, n) => `${p} · 계정 ${n}`,
    okRow: (now, wk) => `지금 ${now} · 이번 주 ${wk}`,
  },
  tl: {
    h5: '5시간 리셋',
    wk: '일주일 리셋',
    note: '앞으로 7일 동안 돌아오는 양(계정)',
    none5: ' — 7일 안에 늘어날 양 없음',
    small5: (g) => ` — 7일 안 ${g}`,
    aria: '앞으로 7일 동안 돌아오는 계정',
    axis: ['지금', '1h', '6h', '24h', '3d', '5d', '7d'],
    mark: (w, gain, when, names) => `${w} +${gain}계정 · ${when}부터${names ? ` · ${names}` : ''}`,
    lim: (until) => `모두 막힘 — ${until}까지`,
    limNone: '모두 막힘 — 7일 안에 복귀 없음',
  },
  fold: {
    expand: '펼치기',
    collapse: '접기',
    aria: (word, section) => `${section} ${word}`,
  },
  chip: {
    now: '지금',
    week: '주',
    error: (r) => `가용량 미확인 · ${r}`,
    none: '계정 없음',
    aria: '공급자별 가용량',
    said5: (v, total, pct) => `5시간(지금) ${v}/${total} 계정 (${pct})`,
    saidWk: (v, total, pct) => `일주일 ${v}/${total} 계정 (${pct})`,
    word: { low: ' · 부족', empty: ' · 소진', unknown: ' · 계산 불가' },
    limSaid: (n, back) => ` · 제한 ${n}${back ? ` — ${back}` : ''}`,
    firstBack: (d) => `${d} 후 첫 복귀`,
    stale: (age) => `${age} 전`,
    assumed: (tier, n) => `${tier} 가정 ${n}`,
  },
  news: {
    allLimited: (n, back) => `${n} 계정이 모두 막힘${back ? ` — ${back}` : ''}`,
    empty: (n, back) => `${n} 쓸 수 있는 양 없음${back ? ` — ${back}` : ''}`,
    again: (n, r, total) => `${n} 다시 사용 가능 — 계정 ${r}/${total}`,
    low: (n, wk, p, v, t) => `${n} ${wk ? '이번 주' : '지금'} ${p}% 아래 — ${v}/${t} 계정`,
    fail: (n, err) => `크론 ${n} 실패${err ? `: ${err}` : ''}`,
    wait: (n) => `크론 ${n} 응답 필요`,
  },

  laneAria: (t) => `${t} 레인`,
  running: (n) => `● 실행 중 ${n}`,
  waiting: (n) => `▲ 응답 필요 ${n}`,
  stat: {
    next: '다음 실행',
    running: '실행 중',
    runs: '24시간 실행 기록',
    fails: '실패 · 24시간',
    nextTitle: (name, at) => `가장 이른 다음 실행 — ${name} ${at}`,
    none: '예정 없음',
    runningTitle: (r, n) => `잡 ${n}개 중 지금 세션이 실행 중인 잡 ${r}개`,
    unknown: (u) => `+미확인 ${u}`,
    runsTitle: (n, ok, f, run) =>
      `지난 24시간 실행 기록 ${n}건: 성공(세션 쉼) ${ok} · 실패 ${f} · 진행 중(세션이 지금 실행 중·응답 대기) ${run}`,
    unknownTitle: (u) => ` · 결과 미확인 ${u}건은 세지 않음`,
    failsTitle: '지난 24시간 실패 기록',
    cut: (name, cap, from) => `${name} 기록은 보관 한도 ${cap}회라 ${from}부터`,
  },
  queue: {
    head: '다음 실행',
    headTitle: '다음 실행이 있는 잡, 이른 순',
    aria: '다음 실행 순서',
    empty: '예정 없음',
    said: (name, when, i, n) => `${name}, ${when}, ${i}/${n} — 지난 실행 보기`,
  },
  job: {
    past: (n) => `지난 실행 ${n}`,
    next: (clock) => `다음 ${clock} (`,
    exprTitle: (e) => `${e} — cron 식은 UTC 기준`,
    strip: (name, k, sum) => `${name} 최근 실행 ${k}회${sum ? `(${sum})` : ''} — 지난 실행 보기`,
    noRuns: '아직 실행 없음',
    noRecords: '실행 기록 없음',
    running: '● 실행 중',
    waiting: '▲ 응답 필요',
  },
  run: { ok: '성공', running: '실행 중', waiting: '응답 필요', failed: '실패', unknown: '결과 미확인' },
  runCount: { ok: '성공', run: '진행 중', fail: '실패', unknown: '미확인' },
  runSum: (n, word) => `${word} ${n}`,
  chart: {
    title: '실행 기록 · 24시간',
    ok: '성공',
    run: '진행 중',
    fail: '실패',
    okTitle: '성공 기록, 세션 쉼',
    runTitle: '실행 기록, 세션이 지금 실행 중·응답 대기',
    failTitle: '실패 기록',
    axis: ['24시간 전', '12시간 전', '지금'],
    col: (at, ok, f, r) => `${at}부터 1시간 · 성공 ${ok} · 실패 ${f} · 진행 중 ${r}`,
    said: (n, ok, f, r) => `지난 24시간 크론 실행 기록 ${n}건: 성공 ${ok}건, 실패 ${f}건, 진행 중 ${r}건`,
    peak: (at, n) => `, 가장 많은 1시간 ${at}부터 ${n}건`,
    cut: (at) => ` ${at} 이전은 일부 잡 기록이 잘림.`,
    unknown: (u) => ` 결과 미확인 ${u}건은 세지 않음.`,
    hatch: (names) => `이 구간은 ${names} 기록이 보관 한도로 잘려 실제보다 적을 수 있음`,
  },
};

export const STRINGS = { en, ko };

/**
 * The text of a live time element. Future kinds count down (floored; `soon` at zero — never “in soon”);
 * `since` / `fetched` count up from a past epoch.
 */
export function timeText(kind: TimeKind, atMs: number, nowMs: number, t: Strings): string {
  if (kind === 'since') return t.since(t.span((nowMs - atMs) / 1000));
  if (kind === 'fetched') return t.fetched(Math.max(0, Math.round((nowMs - atMs) / 1000)));
  const s = Math.floor((atMs - nowMs) / 1000);
  if (!(s > 0)) return kind === 'back' ? t.backSoon : kind === 'runs' ? t.runsSoon : t.soon;
  const d = t.dur(s);
  return kind === 'in' ? t.in(d) : kind === 'back' ? t.back(d) : kind === 'runs' ? t.runs(d) : d;
}
