import type { ComponentDoc } from '../../docs/types';
import './approval-card';
import type { ApprovalAnswerDetail, ApprovalCardData, ApprovalDecideDetail, ApprovalPermissionData } from './logic';

type El = HTMLElementTagNameMap['ui-approval-card'];

function card(data: ApprovalCardData, attrs: Record<string, string> = {}): El {
  const el = document.createElement('ui-approval-card');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

function stage(...els: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:grid;gap:16px;max-width:560px;margin:0 auto';
  box.append(...els);
  return box;
}

/**
 * Plays the host: an answer is "sent" for 900 ms (the card shows its spinner), then the request is resolved — or, for
 * the flaky demo, fails once so Retry can be tried.
 */
function host(el: El, opts: { failOnce?: boolean; by?: string } = {}): El {
  let failed = false;
  const settle = (patch: Partial<NonNullable<ApprovalCardData['state']>> & Record<string, unknown>) => {
    window.setTimeout(() => {
      if (!el.isConnected || !el.data) return;
      el.data = { ...el.data, state: patch as ApprovalCardData['state'] };
    }, 900);
  };
  el.addEventListener('ui-decide', (e) => {
    const { decision } = (e as CustomEvent<ApprovalDecideDetail>).detail;
    if (opts.failOnce && !failed) {
      failed = true;
      settle({ status: 'error', message: 'The agent did not receive the answer (HTTP 502).' });
      return;
    }
    settle({
      status: 'resolved',
      outcome: decision === 'deny' ? 'denied' : decision === 'explain' ? 'explained' : 'approved',
      ruleDisabled: decision === 'approve_disable_rule' || undefined,
      by: opts.by ?? 'you',
      at: Date.now(),
    });
  });
  el.addEventListener('ui-answer', (e) => {
    const { choiceId, text } = (e as CustomEvent<ApprovalAnswerDetail>).detail;
    settle({ status: 'resolved', outcome: 'answered', choiceId, text, by: opts.by ?? 'you', at: Date.now() });
  });
  return el;
}

const now = () => Date.now();

const bashMigration = (): ApprovalPermissionData => ({
  kind: 'permission',
  id: 'approval_7f3c',
  tool: 'Bash',
  createdAt: now() - 40_000,
  expiresAt: now() + 4 * 60_000 + 20_000,
  rules: [
    {
      id: 'pipe-to-interpreter',
      label: 'Pipe into an interpreter',
      description: 'Runs SQL read from a file against a database.',
    },
  ],
  input: {
    command: 'psql "$PROD_URL" -f migrations/0042_split_users.sql',
    description: 'Run the users split on production',
    timeout: 600000,
  },
  canDisableRule: true,
  canExplain: true,
});

export const doc: ComponentDoc = {
  slug: 'approval-card',
  name: 'Approval Card',
  tag: 'ui-approval-card',
  group: 'Components',
  summary: 'What the agent wants to do and how risky it is — answer it before it expires.',
  description:
    'An agent asks before it acts. A tool permission shows the tool, a risk badge and the rules it matched, a preview ' +
    'of exactly what will run (a shell block, a file diff, or the input as rows), Approve / Deny (and Explain when ' +
    'offered), “Disable this rule for this session” when allowed, and a countdown to expiry that pauses while you ' +
    'read. A question shows its choices with the recommended one first and selected, plus a free-text answer when ' +
    'allowed. Answers lock with a spinner until the host settles them; a failure offers Retry; the end — approved, ' +
    'denied, answered, expired or answered elsewhere — stays as one quiet row. ⌘/Ctrl+Enter approves or submits, Esc ' +
    'from a button denies.',
  usedIn:
    'soma-work dashboard — the NEEDS YOU card (renderPermissionBlock) and the session panel’s 입력 필요 ' +
    '(apPermissionCardHtml / apQuestionCardHtml): one element for both.',
  reference: { name: 'affectUI Approval Card', url: 'https://www.affectui.com/components/approval-card' },
  props: [
    {
      name: 'data.kind',
      type: "'permission' | 'question'",
      required: true,
      description: 'Which request the card shows.',
    },
    {
      name: 'data.id',
      type: 'string',
      required: true,
      description: 'The request id, echoed as detail.id in every event.',
    },
    { name: 'data.tool', type: 'string', description: 'Permission: tool name (Bash, Edit, mcp__…). Picks the icon.' },
    {
      name: 'data.title / description',
      type: 'string',
      description: 'Default “<tool> approval” and the input’s description.',
    },
    { name: 'data.risk', type: "'low' | 'medium' | 'high'", description: 'Badge. Default high when any rule matched.' },
    { name: 'data.rules', type: 'Array<{ id, label, description? }>', description: 'Matched dangerous-command rules.' },
    {
      name: 'data.input',
      type: 'unknown',
      description:
        'Tool input (object or JSON text): command → shell block, old/new_string or edits → diff, else rows.',
    },
    {
      name: 'data.truncated / loading / notice',
      type: 'boolean / boolean / string',
      description: 'Input cut by the host, being fetched, or replaced by a muted line.',
    },
    {
      name: 'data.canDisableRule / canExplain',
      type: 'boolean',
      description: 'Offer “Disable this rule for this session” / Explain.',
    },
    {
      name: 'data.irreversible',
      type: 'string',
      description:
        'What cannot be undone once approved (“prod 배포”, “force push”) — the host’s own classification. Approve becomes a slide (<ui-slide-confirm tone="danger">, “Slide to approve” / “밀어서 승인”) that sends the same ui-decide; ⌘↵ no longer approves; a line under the title says what is at stake; a failed approve is retried by sliding again. Deny, Explain and the rule box stay. It adds no gate: the card only appears where the host already asks.',
    },
    {
      name: 'data.question / choices / recommendedId / allowOther',
      type: 'string / Choice[] / string / boolean',
      description: 'Question: prompt, options (recommended first and preselected), free-text answer.',
    },
    {
      name: 'data.createdAt / expiresAt',
      type: 'number (epoch ms)',
      description: 'Default label time; live countdown (amber in the last 10 s), then ui-expire.',
    },
    {
      name: 'data.canAnswer',
      type: 'boolean | string',
      default: 'true',
      description: 'false locks the answers; a string locks them and says why.',
    },
    {
      name: 'data.state',
      type: 'pending | sending | error {message, retry?} | resolved {outcome, by?, at?, ruleDisabled?, choiceId?, text?}',
      default: 'pending',
      description: 'What the host says about the request.',
    },
    {
      name: 'lang',
      type: "'en' | 'ko'",
      default: 'en',
      description: 'Korean wording matches the dashboard (실행 승인, 승인함, 만료됨, 추천, 제출하기).',
    },
  ],
  events: [
    {
      name: 'ui-decide',
      detail: "{ id, decision: 'approve' | 'deny' | 'approve_disable_rule' | 'explain' }",
      description:
        'Permission answered. Cancelable: not cancelled → answers lock with a spinner until the host changes state.',
    },
    {
      name: 'ui-answer',
      detail: '{ id, choiceId?, text? }',
      description: 'Question answered (a choice or free text). Cancelable, like ui-decide.',
    },
    { name: 'ui-expire', detail: '{ id }', description: 'expiresAt passed with no answer; the card shows Expired.' },
  ],
  keyboard: [
    ['⌘/Ctrl + Enter', 'Approve (permission) or Submit (question), from anywhere in the card'],
    ['Esc', 'Deny — from one of the card’s buttons (on the card itself Esc reaches the page)'],
    ['↑ ↓ ← → / Home / End', 'Move between a question’s options'],
    ['Enter', 'On an option: submit it; in the free-text field: submit the text'],
    ['Tab', 'Buttons, the rule checkbox and the options in reading order'],
  ],
  a11y: [
    'The card is a group labelled by its title; focus() lands on the card, so answering is a deliberate second step.',
    'Options are a radio group (arrows move, the recommended one is preselected and tagged).',
    'A polite live region announces the status changes (sending, failed, approved/denied/answered/expired).',
    'An irreversible action is approved by sliding: the slide is a role="slider" (arrows, End to commit), so the keyboard path stays deliberate; the line saying what cannot be undone is part of the card’s description.',
    'Locked answers stay focusable with aria-disabled and say why (canAnswer string).',
    'The countdown pauses while the card is hovered or focused; reduced motion removes the morph to a row.',
    'Sound (opt-in, @2lab.ai/ui/sound): Approve, Explain and an answered question tap, Deny plays close — once the answer is not prevented; keystrokes in the free-text box play type while typing sounds are on; expiry is silent. Silent until the page turns sound on.',
  ],
  usage: `<ui-approval-card lang="ko"></ui-approval-card>
<script type="module">
  import '@2lab.ai/ui/approval-card';
  const el = document.querySelector('ui-approval-card');
  el.data = { kind: 'permission', id: req.approvalId, tool: 'Bash', rules: req.rules,
              input: req.input, createdAt: req.createdAt, expiresAt: req.expiresAt, canDisableRule: true };
  el.addEventListener('ui-decide', async (e) => {
    const res = await fetch('/permission/' + e.detail.id, { method: 'POST', body: JSON.stringify(e.detail) });
    el.data = { ...el.data, state: res.ok
      ? { status: 'resolved', outcome: e.detail.decision === 'deny' ? 'denied' : 'approved', at: Date.now() }
      : { status: 'error', message: 'Could not send (' + res.status + ')' } };
  });
</script>`,
  demos: [
    {
      id: 'permission',
      title: 'Permission — shell',
      description:
        'A Bash call that matched a dangerous-command rule: risk badge, the command, a countdown that pauses while you read. Approve with the rule ticked to stop being asked this session.',
      height: 520,
      create: () => stage(host(card(bashMigration()))),
    },
    {
      id: 'irreversible',
      title: 'Irreversible — slide to approve',
      description:
        'A deploy to prod the agent was not told to run on its own: the host marks it irreversible, so Approve is a slide and ⌘↵ does nothing. Deny stays one press.',
      height: 520,
      create: () =>
        stage(
          host(
            card(
              {
                ...bashMigration(),
                id: 'approval_9d21',
                irreversible: 'prod 배포',
                rules: [],
                canDisableRule: false,
                input: {
                  command: 'gh pr merge 1287 --merge --repo 2lab-ai/soma-work  # main → deploy/prod',
                  description: 'Merge the release PR into deploy/prod',
                },
              },
              { lang: 'ko' },
            ),
          ),
        ),
    },
    {
      id: 'diff',
      title: 'Permission — file edit',
      description: 'An Edit call: the change as a line diff. Deny is Esc from a button.',
      height: 560,
      create: () =>
        stage(
          host(
            card({
              kind: 'permission',
              id: 'approval_e21a',
              tool: 'Edit',
              createdAt: now() - 12_000,
              expiresAt: now() + 3 * 60_000,
              input: {
                file_path: 'src/conversation/dashboard.ts',
                old_string:
                  "  if (kind === 'tool' || kind === 'tool_result') {\n    var fail = kind === 'tool_result' && e.ok === false;",
                new_string:
                  "  if ((kind === 'tool' || kind === 'tool_result') && !e._role) {\n    return wlCard(e);\n  }\n  if (kind === 'tool' || kind === 'tool_result') {\n    var fail = kind === 'tool_result' && e.ok === false;",
              },
            }),
          ),
        ),
    },
    {
      id: 'question',
      title: 'Question',
      description:
        'A single-choice question: the recommended option first and selected, a free-text answer, ⌘/Ctrl+Enter submits.',
      height: 560,
      create: () =>
        stage(
          host(
            card({
              kind: 'question',
              id: 'question_04',
              question: 'How should the dashboard’s 작업 로그 use the card?',
              description: 'The other components are copied inline today; every fix has to be made twice.',
              recommendedId: 'vendor',
              allowOther: true,
              createdAt: now() - 5_000,
              choices: [
                {
                  id: 'inline',
                  label: 'Port inline, like the other 7',
                  description: 'Matches the existing pattern; the copies can drift.',
                },
                {
                  id: 'vendor',
                  label: 'Use the library element directly',
                  description: 'One codebase, served from the dashboard’s own origin.',
                },
                {
                  id: 'cdn',
                  label: 'Load from 2lab.ai/ui at runtime',
                  description: 'Simplest, but the dashboard then depends on the site.',
                },
              ],
            }),
          ),
        ),
    },
    {
      id: 'states',
      title: 'Sending · failed · resolved',
      description:
        'The same request three ways: an answer in flight, a failure with Retry (this one fails once, then works), and the quiet row it ends as.',
      height: 640,
      create: () => {
        const base = bashMigration();
        return stage(
          card({ ...base, id: 's1', state: { status: 'sending', decision: 'approve' } }),
          host(card({ ...base, id: 's2', canDisableRule: false }), { failOnce: true }),
          card({
            ...base,
            id: 's3',
            state: { status: 'resolved', outcome: 'approved', ruleDisabled: true, by: 'Zhuge', at: now() - 90_000 },
          }),
          card({
            ...base,
            id: 's4',
            state: { status: 'resolved', outcome: 'elsewhere', by: 'Slack', at: now() - 30_000 },
          }),
        );
      },
    },
    {
      id: 'locked',
      title: 'Expiring · locked · loading',
      description:
        'Ten seconds left (amber, then Expired and ui-expire); a viewer who may not answer; the input still being fetched.',
      height: 640,
      create: () =>
        stage(
          host(card({ ...bashMigration(), id: 'l1', expiresAt: now() + 12_000 })),
          card({ ...bashMigration(), id: 'l2', canAnswer: 'Only the session owner can answer.' }),
          card({
            kind: 'permission',
            id: 'l3',
            tool: 'mcp__github__create_issue',
            loading: true,
            createdAt: now() - 2_000,
            expiresAt: now() + 5 * 60_000,
          }),
        ),
    },
    {
      id: 'ko',
      title: '한국어 (lang="ko")',
      description: '대시보드의 입력 필요 문구 그대로 — 실행 승인, 위험 높음, 승인함, 추천, 제출하기.',
      height: 600,
      create: () =>
        stage(
          host(card(bashMigration(), { lang: 'ko' }), { by: '나' }),
          host(
            card(
              {
                kind: 'question',
                id: 'q_ko',
                question: '배포 전에 리뷰를 다시 돌릴까요?',
                recommendedId: 'yes',
                allowOther: true,
                choices: [
                  { id: 'yes', label: '네, 리뷰 후 배포', description: '두 리뷰어가 승인하면 배포합니다.' },
                  { id: 'no', label: '아니요, 바로 배포' },
                ],
              },
              { lang: 'ko' },
            ),
            { by: '나' },
          ),
        ),
    },
  ],
};
