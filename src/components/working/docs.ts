import type { ComponentDoc } from '../../docs/types';
import './working';
import type { UiWorking, WorkingData } from './working';

const S = 1000;
const M = 60 * S;

function working(data: WorkingData, attrs: Record<string, string> = {}): UiWorking {
  const el = document.createElement('ui-working');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

function col(...kids: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:12px;padding:20px';
  box.append(...kids);
  return box;
}

const tokens = (n: number) => `${(n / 1000).toFixed(1)}k tokens`;

/** The tool steps of one turn, the way the session reports them. */
const STEPS = [
  'Reading src/conversation/dashboard.ts',
  'Running npm test — 1,942 tests',
  'Writing src/components/working/working.ts',
  'Opening PR #27',
];

/**
 * A live turn: the next step every 3 s with the tokens growing, then done for a moment, then the next turn. The
 * interval stops once the element has left the page.
 */
function running(): HTMLElement {
  let step = 0;
  let used = 12_400;
  let rest = 0;
  const start = () => Date.now() - 4 * M;
  const el = working({ state: 'working', label: STEPS[0], since: start(), detail: tokens(used) });
  let seen = false;
  const timer = window.setInterval(() => {
    if (!el.isConnected) {
      if (seen) window.clearInterval(timer);
      return;
    }
    seen = true;
    const d = el.data as WorkingData;
    if (d.state === 'done') {
      if (++rest < 2) return;
      rest = 0;
      step = 0;
      used = 1_900;
      el.data = { state: 'working', label: STEPS[0], since: Date.now() - 2 * S, detail: tokens(used) };
      return;
    }
    used += 1_700 + step * 600;
    if (step < STEPS.length - 1) {
      step++;
      el.data = { ...d, label: STEPS[step], detail: tokens(used) };
    } else el.data = { ...d, state: 'done', label: 'Opened PR #27', until: Date.now(), detail: tokens(used) };
  }, 3000);
  return col(el);
}

/** A list row: the session's title, its line under it. */
function row(title: string, data: WorkingData, lang?: string): HTMLElement {
  const li = document.createElement('li');
  li.className = 'ui-row';
  const box = document.createElement('div');
  const t = document.createElement('strong');
  t.textContent = title;
  box.append(t, working(data, lang ? { size: 'sm', lang } : { size: 'sm' }));
  li.append(box);
  return li;
}

function list(...rows: HTMLElement[]): HTMLElement {
  const card = document.createElement('div');
  card.className = 'ui-card';
  card.style.cssText = 'width:min(440px,100%)';
  const ul = document.createElement('ul');
  ul.style.cssText = 'margin:0;padding:2px 4px';
  ul.append(...rows);
  card.append(ul);
  const box = col(card);
  box.style.alignItems = 'center';
  return box;
}

/** A board card (light DOM): title and ref, the session's line, and its child agents beside their names. */
function card(title: string, ref: string, data: WorkingData, kids: Array<[string, WorkingData]> = []): HTMLElement {
  const c = document.createElement('article');
  c.className = 'ui-card';
  c.style.cssText = 'display:grid;gap:6px;min-width:0;padding:10px 12px';
  const top = document.createElement('div');
  top.style.cssText = 'display:flex;align-items:baseline;gap:8px;min-width:0';
  const t = document.createElement('strong');
  t.textContent = title;
  t.style.cssText =
    'flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600';
  const r = document.createElement('span');
  r.textContent = ref;
  r.style.cssText = 'flex:none;font-size:11.5px;color:var(--ui-ib-muted);font-variant-numeric:tabular-nums';
  top.append(t, r);
  c.append(top, working(data, { size: 'sm' }));
  for (const [name, d] of kids) {
    const kid = document.createElement('div');
    kid.style.cssText =
      'display:flex;align-items:center;gap:6px;min-width:0;padding-left:10px;border-left:1px solid var(--ui-ib-card-border)';
    const n = document.createElement('span');
    n.textContent = name;
    n.style.cssText = 'flex:none;font-size:12px;color:var(--ui-ib-text-2)';
    const w = working(d, { size: 'sm' });
    w.style.cssText = 'flex:1 1 auto;min-width:0';
    kid.append(n, w);
    c.append(kid);
  }
  return c;
}

export const doc: ComponentDoc = {
  slug: 'working',
  name: 'Working',
  tag: 'ui-working',
  group: 'Components',
  summary: 'What the agent is doing right now, and for how long — at a glance, in one line.',
  description:
    'One line for a session’s activity: a mark for its state, what it is doing now, how long the turn has run and a quiet detail — “Reading dashboard.ts · 42s · 12.4k tokens”. The marks are the kit’s: the working ring (the same as .ui-spinner), a pulsing amber dot when it needs you, a check when done, a cross when it failed, a hollow dot when idle. While it works the label carries a slow highlight sweep across its letters; when the agent moves to its next step the new label swaps in place — the old one leaves upward and fades, the new one rises from below — and the line keeps its height. The time ticks in place once a second while the turn is live and stops by itself; a finished turn says “Done in 4m 12s” or “Failed after 1m 03s”. A long label gives way first: it ellipsizes, and the time and the detail keep their words. Two sizes — sm (12px) for a card row, md (13px). Display only: it takes data and sends no events.',
  usedIn:
    'soma-work dashboard: the running card on the board and the conversation’s tail, where a bare .ui-spinner.is-sm sits beside the status word today (agentIconHtml in src/conversation/dashboard.ts); child agents in the agent tree. Fed from the session’s activity state, its current step or tool, and the turn’s start time.',
  reference: { name: 'soma-work dashboard — running card', url: 'https://github.com/2lab-ai/soma-work' },
  props: [
    {
      name: 'state',
      type: "attribute / data.state: 'working' | 'waiting' | 'done' | 'failed' | 'idle'",
      required: true,
      description:
        'Working (the ring, the sweep), Needs you (a pulsing dot), Done (a check), Failed (a cross), Idle (a hollow dot). Unknown values read idle — the line never claims work it was not told about.',
    },
    {
      name: 'label',
      type: 'attribute / data.label: string',
      description:
        'What it is doing now (“Running npm test — 1,942 tests”). A new one swaps in. Without one the line shows the state word.',
    },
    {
      name: 'since',
      type: 'attribute / data.since: epoch ms | ISO string',
      description: 'When the turn started. Working and waiting: 42s · 4m 12s · 1h 02m, ticking. Without it, no time.',
    },
    {
      name: 'until',
      type: 'attribute / data.until: epoch ms | ISO string',
      description:
        'When it ended. Done: “Done in 4m 12s”; failed: “Failed after 1m 03s” — both need it. Working or waiting with an end: the time stands still. Idle shows no time.',
    },
    {
      name: 'detail',
      type: 'attribute / data.detail: string',
      description: 'A quiet note after a dot (“12.4k tokens”, “tool call 9 of ~20”).',
    },
    {
      name: 'size',
      type: "'sm' | 'md'",
      default: "'md'",
      description: 'sm: 12px on an 18px line, for a card row. md: 13px on a 20px line.',
    },
    {
      name: 'lang',
      type: "'en' | 'ko'",
      default: "'en'",
      description: 'Working / 작업 중, Needs you / 확인 필요, Done in 4m 12s / 4분 12초 만에 완료.',
    },
    {
      name: 'data',
      type: 'WorkingData',
      description: '`{ state, label?, since?, until?, detail? }` — the same as the attributes (data wins).',
    },
    { name: 'state (property)', type: 'WorkingState, read-only', description: 'The state drawn now.' },
    {
      name: 'workingState(v) / workingWords(state, label, lang) / workingTime(state, since, until, now, lang) / workingTicks(state, since, until)',
      type: 'helpers',
      description:
        'Pure: a known state, the words said (“Working: Reading dashboard.ts”), the time words at a moment, and whether the time moves.',
    },
  ],
  events: [],
  keyboard: [],
  a11y: [
    'The element is role="status" (unless the page gives it another role). Its text is “<state>: <label>” — “Working: Reading src/conversation/dashboard.ts” — and, when the turn has ended, its time: “Done: Opened PR #27, Done in 4m 12s”.',
    'Polite, and only for a change of state or label: the ticking time and the detail are aria-hidden, so nothing is said every second or as the tokens grow.',
    'Each state has its own shape — ring, filled dot, check, cross, hollow dot — never colour alone. Marks keep their colour under the mono palette.',
    'Reduced motion: no sweep (the label is plain), no slide (the new label replaces the old at once), no pulse; the ring stands still with a dot in it, as the kit’s spinner does.',
    'Not focusable and nothing to press: it is a status, not a control.',
    'Sound (opt-in, @2lab.ai/ui/sound): none — the line shows status the app set, which never plays a cue.',
  ],
  usage: `<ui-working size="sm" state="working" label="Reading src/conversation/dashboard.ts"
  since="2026-11-05T05:00:00Z" detail="12.4k tokens"></ui-working>
<script type="module">
  import '@2lab.ai/ui/working';
  const line = document.querySelector('ui-working');
  // From the session's activity: its state, its current step or tool, the turn's start.
  session.on('activity', (a) => {
    line.data = { state: a.state, label: a.step, since: a.turnStartedAt, until: a.turnEndedAt, detail: a.tokens };
  });
</script>`,
  demos: [
    {
      id: 'running',
      title: 'A running turn',
      description:
        'The agent moves to its next step every 3 seconds — the label swaps in place, the tokens grow, the time ticks — then the turn is done for a moment and the next one starts.',
      height: 140,
      create: running,
    },
    {
      id: 'states',
      title: 'Every state · sm',
      description:
        'Working and Needs you tick; Done and Failed say the turn’s time and stand still; Idle has no label, so it says its state.',
      height: 340,
      create: () => {
        const now = Date.now();
        return list(
          row('Fix flaky checkout test', {
            state: 'working',
            label: 'Running npm test — 1,942 tests',
            since: now - 42 * S,
            detail: 'tool call 9 of ~20',
          }),
          row('Release 0.29.0', { state: 'waiting', label: 'Approve the deploy to prod', since: now - 9 * M - 22 * S }),
          row('Write release notes', {
            state: 'done',
            label: 'Posted to #releases',
            since: now - 30 * M,
            until: now - 30 * M + 4 * M + 12 * S,
            detail: '31.2k tokens',
          }),
          row('Migrate billing tables', {
            state: 'failed',
            label: 'psql: relation "invoices_v2" already exists',
            since: now - 2 * 60 * M,
            until: now - 2 * 60 * M + M + 3 * S,
          }),
          row('Nightly backup', { state: 'idle' }),
        );
      },
    },
    {
      id: 'ko',
      title: '한국어',
      description: 'lang="ko" — 작업 중, 확인 필요, 4분 12초 만에 완료, 1분 03초 후 실패, 대기.',
      height: 340,
      create: () => {
        const now = Date.now();
        return list(
          row(
            '체크아웃 테스트 수정',
            {
              state: 'working',
              label: 'src/conversation/dashboard.ts 읽는 중',
              since: now - 4 * M - 12 * S,
              detail: '토큰 12.4k',
            },
            'ko',
          ),
          row('릴리스 0.29.0', { state: 'waiting', label: 'prod 배포 승인 요청', since: now - 9 * M - 22 * S }, 'ko'),
          row(
            '주간 리포트 초안 작성',
            { state: 'done', label: '#releases에 게시함', since: now - 30 * M, until: now - 30 * M + 4 * M + 12 * S },
            'ko',
          ),
          row(
            '결제 테이블 마이그레이션',
            { state: 'failed', label: 'npm run migrate', since: now - 2 * 60 * M, until: now - 2 * 60 * M + M + 3 * S },
            'ko',
          ),
          row('야간 백업', { state: 'idle' }, 'ko'),
        );
      },
    },
    {
      id: 'board',
      title: 'On a board card',
      description:
        'sm on the board’s cards (light DOM), where a bare spinner sat beside the status word: the session’s line under its title, and its child agents beside their names. In a narrow column the label gives way first — the time and the detail keep their words.',
      height: 400,
      create: () => {
        const now = Date.now();
        const column = document.createElement('div');
        column.style.cssText =
          'display:grid;gap:8px;width:min(310px,100%);padding:10px;border-radius:12px;background:var(--ui-ib-col)';
        column.append(
          card(
            'Fix flaky checkout test',
            '#142',
            {
              state: 'working',
              label: 'Running npm test — 1,942 tests',
              since: now - 4 * M - 12 * S,
              detail: 'tool call 9 of ~20',
            },
            [
              ['explore', { state: 'working', label: 'Reading src/checkout/cart.ts', since: now - 38 * S }],
              ['review', { state: 'done', label: 'No blocking issues', since: now - 3 * M, until: now - M - 52 * S }],
            ],
          ),
          card('Release 0.29.0', '#27', {
            state: 'waiting',
            label: 'Approve the deploy to prod',
            since: now - 9 * M - 22 * S,
          }),
          card('Pick a DB for the queue', '#139', {
            state: 'done',
            label: 'Wrote the decision record',
            since: now - 52 * M,
            until: now - 52 * M + 4 * M + 12 * S,
            detail: '48.9k tokens',
          }),
        );
        const box = col(column);
        box.style.alignItems = 'center';
        return box;
      },
    },
  ],
};
