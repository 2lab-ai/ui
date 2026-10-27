import type { ComponentDoc } from '../../docs/types';
import './agent-queue';
import type { AgentQueueData, AqAccount, AqJob, AqProvider, AqRefill, AqRun } from './logic';

const M = 60_000;
const H = 3_600_000;
const D = 86_400_000;

function make(data: AgentQueueData, attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('ui-agent-queue');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

const ok = (id: string, binding: '5h' | '7d', fiveHour: number, weekly: number): AqAccount => ({
  id,
  name: id,
  state: 'available',
  binding,
  tier: 'Max x20',
  fiveHour,
  weekly,
});
const limited = (id: string, reason: string, returnAt: number | undefined, tier = 'Max x20'): AqAccount => ({
  id,
  name: id,
  state: 'limited',
  reason,
  returnAt,
  tier,
  fiveHour: 0,
  weekly: reason === 'weekly' ? 0 : 0.4,
});

/** 17 Claude accounts: 11 usable, 5 at their weekly limit, 1 paused — the dashboard's live shape. */
function claude(now: number): AqProvider {
  const w = (at: number, account: string, weekly: number, fiveHour = 0): AqRefill => ({
    at: now + at,
    cause: '7d',
    weekly,
    fiveHour,
    account,
  });
  return {
    id: 'claude',
    name: 'Claude',
    source: 'llmux',
    total: 16,
    fiveHour: 3.5,
    weekly: 4.1,
    measuredAt: now - 4 * H - 12 * M,
    accounts: [
      ok('ai7', '5h', 0.18, 0.31),
      ok('info', '7d', 0.62, 0.22),
      ok('ai15', '7d', 0.7, 0.18),
      ok('ai40', '7d', 0.55, 0.24),
      ok('ai', '7d', 0.41, 0.2),
      ok('ai41', '7d', 0.66, 0.3),
      ok('ai8', '7d', 0.5, 0.27),
      ok('ai44', '7d', 0.47, 0.19),
      ok('ai3', '5h', 0.12, 0.44),
      ok('ai30', '7d', 0.6, 0.35),
      ok('ai5', '7d', 0.38, 0.21),
      limited('ai43', 'weekly', now + 7 * H + 22 * M + 30_000),
      limited('ai4', 'weekly', now + D + 18 * H + 4 * M),
      limited('dev1', 'weekly', now + 3 * D + 19 * H + 40 * M, 'Max x5'),
      { id: 'icedac', name: 'icedac', state: 'paused', reason: 'paused', tier: 'Max x20' },
      limited('ai6', 'weekly', now + 2 * D + 18 * H + 9 * M),
      limited('ai2', 'weekly', now + 2 * D + 8 * H + 51 * M),
    ],
    refills: [
      { at: now + 22 * M + 30_000, cause: '5h', fiveHour: 0.4, weekly: 0, account: 'ai7' },
      { at: now + 41 * M, cause: '5h', fiveHour: 0.2, weekly: 0, account: 'ai3' },
      w(7 * H + 22 * M + 30_000, 'ai43', 1.0, 1.0),
      w(D + 18 * H + 4 * M, 'ai4', 0.9, 0.9),
      w(2 * D + 8 * H + 51 * M, 'ai2', 1.0, 1.0),
      w(2 * D + 18 * H + 9 * M, 'ai6', 1.0, 1.0),
      w(2 * D + 21 * H, 'ai15', 0.9),
      w(3 * D + 19 * H + 40 * M, 'dev1', 0.5, 0.5),
      w(4 * D + 2 * H, 'ai40', 0.8),
      w(4 * D + 7 * H, 'ai41', 0.7),
      w(5 * D + 3 * H, 'ai', 0.6),
      w(6 * D + 5 * H, 'ai8', 0.5),
      w(6 * D + 9 * H, 'ai44', 0.5),
    ],
  };
}

/** Codex: weekly window only, a reading six days old. */
function codex(now: number): AqProvider {
  return {
    id: 'codex',
    name: 'Codex',
    source: 'llmux',
    total: 3.2,
    weekly: 2.4,
    measuredAt: now - 6 * D - 2 * H,
    accounts: ['ai2', 'icedac', 'ai5', 'ai6', 'ai'].map((n) => ({
      ...ok(n, '7d', 0.8, 0.76),
      tier: 'Pro ($200)',
    })),
    refills: [
      { at: now + 6 * D + 3 * H, cause: '7d', weekly: 0.3, account: 'ai2' },
      { at: now + 6 * D + 5 * H, cause: '7d', weekly: 0.4, account: 'ai5' },
    ],
  };
}

/** Next fire of a fixed-step UTC schedule (`step` ms, `offset` ms past the step) — keeps demos true to their cron. */
const nextAt = (now: number, step: number, offset = 0) => Math.floor((now - offset) / step) * step + step + offset;

/** Run records every `every` ms back from `last`, `n` of them, all `ok` unless `mark` says otherwise. */
function series(
  last: number,
  every: number,
  n: number,
  mark: Record<number, Partial<AqRun>> = {},
  base: Partial<AqRun> = {},
): AqRun[] {
  const out: AqRun[] = [];
  for (let i = 0; i < n; i++) out.push({ at: last - i * every, status: 'ok', ...base, ...mark[i] });
  return out;
}

function jobs(now: number): AqJob[] {
  return [
    {
      id: 'ship-subagent-spend',
      name: 'ship-subagent-spend-472',
      expression: '*/15 * * * *',
      nextRunAt: nextAt(now, 15 * M),
      runs: series(nextAt(now, 15 * M) - 15 * M + 4_000, 15 * M, 19, {}, { label: 'Thread reply (no session)' }),
      historyCap: 20,
    },
    {
      id: 'dependency-audit',
      name: 'dependency-audit',
      expression: '0 */6 * * *',
      nextRunAt: nextAt(now, 6 * H),
      runs: series(nextAt(now, 6 * H) - 6 * H + 9_000, 6 * H, 4, {
        1: { status: 'failed', error: 'npm audit timed out after 120s (registry.npmjs.org)' },
      }),
    },
    {
      id: 'pr-sweeper',
      name: 'pr-sweeper',
      expression: '*/30 * * * *',
      nextRunAt: nextAt(now, 30 * M),
      state: 'running',
      runs: series(nextAt(now, 30 * M) - 30 * M + 3_000, 30 * M, 14, {
        0: { status: 'running' },
        5: { status: 'unknown' },
      }),
    },
    {
      id: 'morning-digest',
      name: 'morning-digest',
      expression: '30 0 * * *',
      nextRunAt: nextAt(now, D, 30 * M),
      state: 'waiting',
      runs: series(nextAt(now, D, 30 * M) - D + 6_000, D, 3, { 0: { status: 'waiting' } }),
    },
    {
      id: 'ssot-media-live-verify',
      name: 'ssot-media-live-verify',
      expression: '0 12-20 25 10 *',
      runs: series(now - 30 * H, H, 9, {}, { label: 'Thread reply (no session)' }),
    },
  ];
}

function overview(now: number): AgentQueueData {
  return {
    providers: [claude(now), codex(now)],
    capacityNote: 'account = one top-plan account’s worth · llmux',
    fetchedAt: now - 12_000,
    lane: { jobs: jobs(now) },
  };
}

/** Every epoch in the data divided by 1000 — the shape a capacity server speaking epoch seconds sends. */
function inSeconds(d: AgentQueueData, now: number): AgentQueueData {
  const s = (v: number | undefined) => (v === undefined ? undefined : Math.floor(v / 1000));
  return {
    ...d,
    timeUnit: 's',
    now: s(now),
    fetchedAt: s(d.fetchedAt),
    providers: d.providers?.map((p) => ({
      ...p,
      measuredAt: s(p.measuredAt),
      refills: p.refills?.map((e) => ({ ...e, at: s(e.at) as number })),
      accounts: p.accounts?.map((a) => ({ ...a, returnAt: s(a.returnAt) })),
    })),
    lane: d.lane && {
      ...d.lane,
      jobs: d.lane.jobs.map((j) => ({
        ...j,
        nextRunAt: s(j.nextRunAt),
        runs: j.runs?.map((r) => ({ ...r, at: s(r.at) as number })),
      })),
    },
  };
}

export const doc: ComponentDoc = {
  slug: 'agent-queue',
  name: 'Agent Queue',
  tag: 'ui-agent-queue',
  group: 'Components',
  summary: 'Which LLM accounts can work right now, which are limited and when they return — and what runs next.',
  description:
    'Two sections in one grammar, each optional. Provider capacity treats every account as a worker: per provider a card with a state pill (available / limited n · back in 7h 22m, ticking in place), the 5-hour and weekly measures as bars with a dashed 20% line and what comes back next, one mark per account (limited accounts in amber with the reason and the time left), and a 7-day reset timeline. The job lane treats scheduled jobs as a queue: four numbers (next run · running · runs in 24 h · failures), the up-next list, job cards with their last runs, and 24 hours of run records. Data honesty: runs with an unknown result are counted apart and never drawn as success, truncated histories turn counts into lower bounds, and epoch seconds are converted once at the boundary.',
  usedIn: 'soma-work dashboard › LLM 가용량 (capacity cards) and the CRON lane above the inbox',
  reference: { name: 'affectUI Agent Queue', url: 'https://www.affectui.com/components/agent-queue' },
  props: [
    {
      name: 'data.providers',
      type: 'AqProvider[]',
      description:
        'One card per provider: `{ id, name, source?, total, fiveHour?, weekly?, state?, measuredAt?, refills?, accounts? }`. `total` / `fiveHour` / `weekly` are in accounts’ worth; omit `fiveHour` for a provider with only a weekly window. `state` is derived (ok / low < 20% / empty / unknown) when omitted. Omit the array to hide the section.',
    },
    {
      name: 'data.providers[].accounts',
      type: 'AqAccount[]',
      description:
        "Workers: `{ id, name, state: 'available' | 'limited' | 'paused' | 'spent' | 'unmeasured' | 'excluded', reason?, returnAt?, binding?: '5h' | '7d', tier?, tierAssumed?, fiveHour?, weekly?, estimated? }`. `reason` keys (weekly, 5h, model, cooldown, paused, auth, held, noMeasure, unknownTier) are translated; any other string is shown as given. The order is kept.",
    },
    {
      name: 'data.providers[].refills',
      type: "Array<{ at, cause: '5h' | '7d' | 'release', fiveHour?, weekly?, account? }>",
      description:
        'Replayed resets in time order. Drive the “next +0.4 · in 22m” lines and the 7-day timeline; a refill whose time has come is folded into the measures.',
    },
    {
      name: 'data.providers[].excluded / estimated / unmeasured5h / countedAccounts / accountCount',
      type: 'number | { held?, unknownTier?, noMeasure? }',
      description: 'Disclosure-line counts. Each is derived from `accounts` when omitted.',
    },
    { name: 'data.capacityNote', type: 'string', description: 'Muted note beside the capacity title.' },
    {
      name: 'data.fetchedAt',
      type: 'number (epoch)',
      description: 'When the capacity was read — “updated 12s ago”, ticking.',
    },
    {
      name: 'data.capacityError',
      type: 'string',
      description: 'The capacity could not be read: shown instead of the cards.',
    },
    {
      name: 'data.lane.jobs',
      type: 'AqJob[]',
      required: true,
      description:
        "Scheduled jobs: `{ id, name, schedule?, expression?, nextRunAt?, runs?, pastRuns?, state?: 'running' | 'waiting' | 'idle', historyCap? }`. `schedule` is derived from a common cron `expression` when omitted. Runs: `{ at, status: 'ok' | 'running' | 'waiting' | 'failed' | 'unknown', label?, error? }`.",
    },
    {
      name: 'data.lane.runs24h',
      type: 'AqRun[]',
      description:
        'Run records for the stats and the chart when they come from a separate log. Default: every job’s `runs`.',
    },
    { name: 'data.lane.title', type: 'string', default: "'CRON'", description: 'Lane title and the job badge.' },
    {
      name: 'data.now',
      type: 'number (epoch)',
      default: 'Date.now()',
      description: 'The clock. Countdowns tick on from it once a second.',
    },
    {
      name: 'data.timeUnit',
      type: "'ms' | 's'",
      default: "'ms'",
      description:
        'Unit of every epoch field. A capacity server speaking epoch seconds passes `s`; the component converts once, at the boundary.',
    },
    { name: 'lang', type: "'en' | 'ko'", default: "'en'", description: 'UI language (attribute).' },
    {
      name: 'theme',
      type: "'light' | 'dark'",
      description: 'Pins the theme (attribute). Default follows prefers-color-scheme or page tokens.',
    },
  ],
  events: [
    {
      name: 'ui-job-open',
      detail: '{ jobId: string }',
      description: 'An up-next chip, a job’s “Past runs” button or its run strip was activated. Open your run history.',
    },
    {
      name: 'ui-account-open',
      detail: '{ providerId: string; accountId: string }',
      description:
        'An account mark was opened. Cancelable: `preventDefault()` keeps the built-in account card closed (use your own).',
    },
  ],
  keyboard: [
    ['Tab', 'One stop per account strip and one for the up-next list, then the job buttons'],
    ['← ↑ / → ↓', 'Previous / next account mark or up-next chip'],
    ['Home / End', 'First / last item of the strip'],
    ['Enter / Space', 'Open or close the account card · open a job (ui-job-open)'],
    ['Esc', 'Close the account card and return focus to its mark'],
  ],
  a11y: [
    'Every state leads with a glyph or a word (● ⏸ ✗ ▲ ◌) — colour is never the only signal.',
    'One polite live region outside the re-rendered markup: a pool turning all-limited, available again or under 20%; a newer failed run; a job starting to wait. The first data is the baseline; countdown ticks are never announced.',
    'Countdowns are <time role="timer"> elements whose text is rewritten in place once a second (no re-render, no announcement).',
    'Account marks and up-next chips are real buttons with roving tabindex; the account card is role="dialog" with a close button, Esc and outside click.',
    'Bars, the timeline and the 24-hour chart are role="img" with a sentence (value / total / %, run totals, busiest hour, truncation, unknown runs not counted).',
    'Touch targets grow to 44 px on coarse pointers; the run pulse stops under reduced motion.',
  ],
  usage: `<ui-agent-queue lang="en"></ui-agent-queue>
<script type="module">
  import '@2lab.ai/ui/agent-queue';
  const el = document.querySelector('ui-agent-queue');
  el.data = {
    timeUnit: 's',                       // llmux speaks epoch seconds — converted once here
    now: Math.floor(Date.now() / 1000),
    providers: [{
      id: 'claude', name: 'Claude', source: 'llmux', total: 16, fiveHour: 3.5, weekly: 4.1,
      accounts: [
        { id: 'ai7', name: 'ai7', state: 'available', binding: '5h' },
        { id: 'ai43', name: 'ai43', state: 'limited', reason: 'weekly', returnAt: 1793090000 },
      ],
      refills: [{ at: 1793010000, cause: '5h', fiveHour: 0.4, account: 'ai7' }],
    }],
    lane: { jobs: [{ id: 'audit', name: 'dependency-audit', expression: '0 */6 * * *',
      nextRunAt: 1793015000, runs: [{ at: 1793000000, status: 'failed', error: 'npm audit timed out' }] }] },
  };
  el.addEventListener('ui-job-open', (e) => openRuns(e.detail.jobId));
  el.addEventListener('ui-account-open', (e) => console.log(e.detail.providerId, e.detail.accountId));
</script>`,
  demos: [
    {
      id: 'default',
      title: 'Capacity + lane',
      description:
        'Claude with 5 accounts at their weekly limit and one paused, Codex on a weekly window only (reading 6 days old), and five scheduled jobs — one running, one waiting for a reply, one failure in 24 h, one run with an unknown result counted apart.',
      height: 1680,
      frame: false,
      create: () => make(overview(Date.now())),
    },
    {
      id: 'limited',
      title: 'All limited',
      description:
        'Every Claude account is limited: the pill counts down to the first return and the timeline shades now → that return. Codex is under 20% (low); Gemini has no countable account.',
      height: 900,
      frame: false,
      create: () => {
        const now = Date.now();
        return make({
          providers: [
            {
              id: 'claude',
              name: 'Claude',
              source: 'llmux',
              total: 4,
              fiveHour: 0,
              weekly: 0.3,
              measuredAt: now - 25 * M,
              accounts: [
                limited('ai1', '5h', now + 22 * M + 15_000),
                limited('ai2', '5h', now + 48 * M + 40_000),
                limited('ai3', 'cooldown', now + 3 * H + 5 * M, 'Max x5'),
                limited('ai4', 'weekly', now + D + 3 * H + 30 * M),
              ],
              refills: [
                { at: now + 22 * M + 15_000, cause: 'release', fiveHour: 0.8, weekly: 0, account: 'ai1' },
                { at: now + 48 * M + 40_000, cause: 'release', fiveHour: 0.7, weekly: 0, account: 'ai2' },
                { at: now + 3 * H + 5 * M, cause: 'release', fiveHour: 0.25, weekly: 0.1, account: 'ai3' },
                { at: now + D + 3 * H + 30 * M, cause: '7d', fiveHour: 1, weekly: 1, account: 'ai4' },
              ],
            },
            {
              id: 'codex',
              name: 'Codex',
              source: 'llmux',
              total: 3.2,
              weekly: 0.5,
              measuredAt: now - 2 * H,
              accounts: [
                ok('cx1', '7d', 0.3, 0.2),
                ok('cx2', '7d', 0.2, 0.1),
                { id: 'cx3', name: 'cx3', state: 'spent', tier: 'Pro ($200)', fiveHour: 0, weekly: 0 },
              ],
              refills: [{ at: now + 4 * D + 6 * H, cause: '7d', weekly: 1.2, account: 'cx3' }],
            },
            {
              id: 'gemini',
              name: 'Gemini',
              source: 'llmux',
              total: 0,
              accounts: [
                { id: 'g1', name: 'g1', state: 'excluded', reason: 'noMeasure' },
                { id: 'g2', name: 'g2', state: 'paused', reason: 'auth' },
              ],
            },
          ],
          fetchedAt: now - 41_000,
        });
      },
    },
    {
      id: 'lane',
      title: 'Lane: failures and truncated history',
      description:
        'A 15-minute job keeps only 20 runs, so the 24-hour counts are lower bounds (≥) and the stretch it cannot speak for is hatched. Runs with an unknown result are counted apart (+2 unknown), never as success.',
      height: 760,
      frame: false,
      create: () => {
        const now = Date.now();
        return make({
          lane: {
            jobs: [
              {
                id: 'poll-ci',
                name: 'poll-ci-status',
                expression: '*/15 * * * *',
                nextRunAt: nextAt(now, 15 * M),
                historyCap: 20,
                runs: series(nextAt(now, 15 * M) - 15 * M + 2_000, 15 * M, 20, {
                  3: { status: 'failed', error: 'GitHub API 502 Bad Gateway' },
                  9: { status: 'failed', error: 'GitHub API 502 Bad Gateway' },
                  12: { status: 'unknown', label: 'DM sent (no session)' },
                }),
              },
              {
                id: 'nightly-eval',
                name: 'nightly-eval-suite',
                expression: '0 17 * * *',
                nextRunAt: nextAt(now, D, 17 * H),
                runs: series(nextAt(now, D, 17 * H) - D + 40_000, D, 2, {
                  0: { status: 'failed', error: 'eval: 3 of 212 cases regressed (tool-call schema)' },
                }),
              },
              {
                id: 'triage',
                name: 'triage-new-issues',
                expression: '0 * * * *',
                nextRunAt: nextAt(now, H),
                runs: series(nextAt(now, H) - H + 5_000, H, 18, { 6: { status: 'unknown' } }),
              },
            ],
          },
        });
      },
    },
    {
      id: 'empty',
      title: 'Error and empty',
      description: 'The capacity could not be read, and the lane has no jobs yet — every number says so instead of 0%.',
      height: 520,
      frame: false,
      create: () =>
        make({
          providers: [],
          capacityError: 'llmux unreachable (ECONNREFUSED 127.0.0.1:8317)',
          lane: { jobs: [] },
        }),
    },
    {
      id: 'ko',
      title: '한국어 · epoch seconds',
      description:
        'lang="ko" with every epoch in seconds (timeUnit: "s") — the same overview, converted once at the boundary.',
      height: 1680,
      frame: false,
      create: () => {
        const now = Date.now();
        const d = overview(now);
        const lane = d.lane && {
          jobs: d.lane.jobs.map((j) => ({
            ...j,
            runs: j.runs?.map((r) => (r.label ? { ...r, label: '스레드 답글 (세션 없음)' } : r)),
          })),
        };
        return make(inSeconds({ ...d, lane, capacityNote: '계정 = 최대 플랜 계정 1개 분량 · llmux' }, now), {
          lang: 'ko',
        });
      },
    },
  ],
};
