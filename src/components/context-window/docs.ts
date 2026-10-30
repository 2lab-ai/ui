import type { ComponentDoc } from '../../docs/types';
import './context-window';
import type { ContextWindowData } from './context-window';

function make(data: ContextWindowData, attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('ui-context-window');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

const BASE: ContextWindowData = {
  model: 'opus-4-5[1m]',
  window: 1_000_000,
  parts: { cacheRead: 272_300, cacheWrite: 470, input: 2, output: 10 },
  autoCompactAt: 750_000,
  canCompact: true,
};

export const doc: ComponentDoc = {
  slug: 'context-window',
  name: 'Context Window',
  tag: 'ui-context-window',
  group: 'Components',
  summary: 'How full the model’s context is, what fills it, and how far the auto-compact point is.',
  description:
    'A 216-cell field (one cell per window ÷ 216 tokens) coloured by cache category in prompt order — cached prefix, newly cached, uncached input, last output. The auto-compact point is drawn on the field and the warning level is measured against it, not against the raw window. An optional two-press “Compact now” action hands the request to the host.',
  usedIn: 'soma-work dashboard › session panel › 세션 정보 › 컨텍스트',
  reference: { name: 'affectUI Context Window', url: 'https://www.affectui.com/components/context-window' },
  props: [
    {
      name: 'data.window',
      type: 'number',
      required: true,
      description: 'Context window size in tokens. Nothing renders without it.',
    },
    {
      name: 'data.parts',
      type: '{ cacheRead?, cacheWrite?, input?, output? }',
      description: 'Tokens of the last request by cache category. Zero parts are left out.',
    },
    {
      name: 'data.unsplit',
      type: "{ tokens: number; kind: 'compact' | 'unknown' }",
      description: 'Usage that cannot be split into categories (e.g. right after a compaction). Drawn as one part.',
    },
    {
      name: 'data.autoCompactAt',
      type: 'number',
      description:
        'Auto-compaction threshold. Drawn as hollow cells past the point; drives warn (≥80%) and full (≥95%).',
    },
    { name: 'data.model', type: 'string', description: 'Model id shown as a chip.' },
    {
      name: 'data.compactPending',
      type: 'boolean',
      default: 'false',
      description: 'The next input will auto-compact (level = full).',
    },
    {
      name: 'data.lastCompact',
      type: '{ preTokens: number; postTokens: number }',
      description: 'Shown as “saved N (a → b)” while compactState is observed.',
    },
    {
      name: 'data.canCompact',
      type: 'boolean | string',
      default: 'undefined',
      description: '`true` shows the action; a string shows it disabled with that reason as the tooltip.',
    },
    {
      name: 'data.compactState',
      type: "'idle' | 'sending' | 'sent' | 'queued' | 'observed' | 'failed' | 'timeout'",
      default: "'idle'",
      description:
        'Host-owned request state. The component adds the two-press confirm itself. `observed` shows ✓ Compacted; when it ends the button leaves (400 ms) instead of vanishing. `timeout` = the request was taken but no compaction showed up in time (the host picks the limit, e.g. 5 min): fail-tone “No compaction result yet”, announced, and the action can be pressed again. Clear `failed` / `timeout` back to `idle` after a few seconds.',
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
      name: 'ui-compact',
      detail: '{}',
      description: 'Second press of “Compact now” within 4 s. Set compactState as the request progresses.',
    },
  ],
  keyboard: [
    ['Tab', 'Focus the compact action'],
    ['Enter / Space', 'First press arms, second press within 4 s sends ui-compact'],
    ['Esc', 'Disarm without sending'],
    ['Tab away (focus leaves the armed button)', 'Disarm without sending'],
  ],
  a11y: [
    'role="group" labelled by the title; the field is decorative (aria-hidden) — every number is in the list.',
    'One screen-reader sentence carries used / window / % / auto-compact point.',
    'Only state transitions (sending, sent, armed, observed, failed, timeout, pending) are announced via aria-live; distances are not, so updates do not chatter. Updates patch the tree in place, so the live node persists and speaks once per transition; the tray line swaps in only when its state changes, and the cells sweep to their new colour.',
    'Warn text (pill, tray, armed button) is st-wait mixed toward the text colour: ≥4.5:1 in light and dark.',
    'Reduced motion: the number jumps instead of rolling, the busy wave and spinner stop.',
    "Sound (opt-in, @2lab.ai/ui/sound): the compact action's arming press plays a subtle tap, the confirming press a tap once ui-compact is not prevented. Silent until the page turns sound on.",
  ],
  usage: `<ui-context-window lang="en"></ui-context-window>
<script type="module">
  import '@2lab.ai/ui/context-window';
  const el = document.querySelector('ui-context-window');
  el.data = {
    model: 'opus-4-5[1m]', window: 1_000_000, autoCompactAt: 750_000,
    parts: { cacheRead: 272300, cacheWrite: 470, input: 2, output: 10 },
    canCompact: true,
  };
  el.addEventListener('ui-compact', async () => {
    el.data = { ...el.data, compactState: 'sending' };
    await fetch('/compact', { method: 'POST' });
    el.data = { ...el.data, compactState: 'sent' };
  });
</script>`,
  demos: [
    {
      id: 'default',
      title: 'Default',
      description: '27% used, auto-compact at 750K.',
      height: 460,
      create: () => make(BASE),
    },
    {
      id: 'warn',
      title: 'Near auto-compact',
      description: '≥80% of the auto-compact point turns the level to warn.',
      height: 460,
      create: () => make({ ...BASE, parts: { cacheRead: 590_000, cacheWrite: 21_000, input: 6_200, output: 3_800 } }),
    },
    {
      id: 'full',
      title: 'Past the point',
      height: 460,
      create: () =>
        make({
          ...BASE,
          parts: { cacheRead: 731_000, cacheWrite: 18_400, input: 9_900, output: 4_100 },
          compactPending: true,
        }),
    },
    {
      id: 'observed',
      title: 'Compaction observed',
      height: 460,
      create: () =>
        make({
          ...BASE,
          unsplit: { tokens: 41_200, kind: 'compact' },
          compactState: 'observed',
          lastCompact: { preTokens: 742_000, postTokens: 41_200 },
        }),
    },
    {
      id: 'timeout',
      title: 'No compaction result yet',
      description:
        'compactState: timeout — the request was taken, no compaction showed up in time. The action is live again.',
      height: 460,
      create: () =>
        make({
          ...BASE,
          parts: { cacheRead: 590_000, cacheWrite: 21_000, input: 6_200, output: 3_800 },
          compactState: 'timeout',
        }),
    },
    { id: 'ko', title: '한국어 (lang="ko")', height: 460, create: () => make(BASE, { lang: 'ko' }) },
  ],
};
