import type { ComponentDoc } from '../../docs/types';
import { lostSettings, payLive, payReplay } from '../mood/demo';

export const doc: ComponentDoc = {
  slug: 'mood-hud',
  name: 'Mood HUD',
  tag: 'ui-mood-hud',
  summary: 'What does the mood reader see? — a cursor HUD that shows the reading on the pointer, for tuning a screen.',
  description:
    'The cursor HUD from Libraries.dev’s Mood recognition page, as an element. Put it inside a `<ui-mood>` around the markup it should draw over (or point `for` at one): corner brackets on the pointer tighten as the score rises, two scan boxes glide round them, faster and closer as it rises, a dust of small boxes trails the moves, each press leaves a square (dotted when it hit a disabled control) and sends a wave out. A readout on a short leader gives the mood and its score, the pointer’s position, L C A F (lost, confused, away, frustrated) and I (the fast signals); over the 0.65 alert line it glitches once and names the control being fought with by tag, id and state (`BUTTON#PAY · DISABLED`), never its text. Colours come from the theme tokens, so it reads on light and dark.',
  usedIn: 'Not in the dashboard: a tool for tuning screens that use `<ui-mood>`, and for demos.',
  reference: {
    name: 'Libraries.dev — Mood recognition (the page’s HUD)',
    url: 'https://libraries.dev/mood-recognition',
  },
  group: 'Effects',
  props: [
    {
      name: 'for (attribute)',
      type: 'string (id)',
      description: 'The `<ui-mood>` to show. Without it, the nearest `<ui-mood>` around the HUD (across shadow roots).',
    },
    {
      name: 'motion (attribute)',
      type: '"system" | "reduce" | "full"',
      default: '"system"',
      description:
        'Reduced motion (or `prefers-reduced-motion`): the brackets, readout and press squares only — no scan boxes, dust, waves or glitch, and the pointer is followed without easing.',
    },
    { name: 'lang (attribute)', type: '"en" | "ko"', description: 'The mood names and states in the readout.' },
    {
      name: 'mood · running (read-only)',
      type: 'UiMood | null · boolean',
      description: 'The `<ui-mood>` it shows, and whether it is drawing frames now.',
    },
  ],
  events: [],
  keyboard: [['—', 'Nothing to focus: the HUD is decorative and takes no input (pointer-events: none).']],
  a11y: [
    'Decorative: the drawing is aria-hidden and the readout is not announced. The wrapped markup keeps its own semantics; the HUD layer takes no pointer input.',
    'Frames only while there is something to draw: the pointer moving over it, a reading that is not calm, or dust and waves dying out after it left (0.9 s). Resting calm for 4 s, off screen or in a hidden tab, it stops; the next move starts it again.',
    'Reduced motion (prefers-reduced-motion or motion="reduce"): no scan boxes, dust, waves or glitch.',
  ],
  usage: `<ui-mood>
  <ui-mood-hud>
    <form>…</form>
  </ui-mood-hud>
</ui-mood>

<!-- or beside it -->
<ui-mood id="checkout">…</ui-mood>
<ui-mood-hud for="checkout">…</ui-mood-hud>

<script type="module">
  import '@2lab.ai/ui/mood';
  import '@2lab.ai/ui/mood-hud';
</script>`,
  demos: [
    {
      id: 'replay',
      title: 'Locked Pay, replayed',
      description: 'Libraries.dev’s showcase route on the real reader, with the HUD on the scripted pointer.',
      height: 540,
      create: () => payReplay(),
    },
    {
      id: 'live',
      title: 'On your pointer',
      description: 'Move over the screen, circle the Pay, press it while it is locked, shake.',
      height: 660,
      create: payLive,
    },
    { id: 'lost', title: 'Settings', description: 'Open section after section.', height: 460, create: lostSettings },
    { id: 'ko', title: '한국어', description: 'lang="ko".', height: 540, create: () => payReplay('ko') },
  ],
};
