import type { ComponentDoc } from '../../docs/types';
import { formatHint, lostSettings, payLive, payReplay } from './demo';

export const doc: ComponentDoc = {
  slug: 'mood',
  name: 'Mood',
  tag: 'ui-mood',
  summary:
    'Is the person stuck? — reads frustration, confusion or being lost from how the pointer moves, presses, scrolling and typing behave, so the screen can bring forward what helps.',
  description:
    'Mood recognition, after Libraries.dev’s (beta). Wrap the part of a screen that can block someone — a Pay locked behind a checkbox, a strict form, a long settings page — in `<ui-mood>`. It reads the input inside it four times a second and says how the person seems: `frustrated` (pressing a disabled control, quick presses on one spot, the pointer shaken, a form sent again after it failed), `confused` (circling one spot, hovering round a control without pressing it, slowing down and turning back, typing and deleting), `lost` (returning to the same places without pressing, opening section after section, scrolling back and forth, a long time since any progress) or `away` (the tab hidden, the pointer out of the window, no input for a minute). It sets `mood="…"` on itself and `--mood`, a reaction from 0 to 1, for the CSS inside, and fires `ui-mood-change`. **Not the Libraries.dev model:** the model (`MoodRecognition.json`), the React kit and the loader on that page are under the Libraries.dev Model License, which forbids them in a public repository, so none of them is shipped, copied or downloaded. The API, the moods, the fast signals and the reaction curve follow the page’s description; the slow reading is this library’s own heuristic, one formula per mood, not trained and not measured against people — tune the screen with `<ui-mood-hud>`. It reads positions, timings and element facts (a button, disabled, invalid), never text, field values or the screen, and nothing leaves the page.',
  usedIn:
    'Not yet in the dashboard. Planned homes: the approval card’s locked Approve (bring forward what unlocks it), the composer’s disabled Send, and long settings pages (lift the search when someone is lost).',
  reference: { name: 'Libraries.dev — Mood recognition (beta)', url: 'https://libraries.dev/mood-recognition' },
  group: 'Effects',
  props: [
    {
      name: 'mood (read-only property, reflected attribute)',
      type: '"frustrated" | "confused" | "lost" | "away" | null',
      description:
        'The mood now: the strongest of frustrated, confused and lost once its score reaches 0.30 (the one shown keeps its place until another is 0.10 stronger), held 1 s after it falls back; away overrides them. Reflected as `mood="…"` on the element (removed while calm) for CSS such as `ui-mood[mood="frustrated"] .terms`.',
    },
    {
      name: '--mood (CSS custom property)',
      type: '0 … 1',
      description:
        'The reaction, set on the element for everything inside: 0 up to a score of 0.30, full at the 0.65 alert line. It rises within about 0.1 s; once calm it holds 1 s, then eases back over a few seconds — about half a minute while the pointer rests (someone stuck may be reading). Away never raises it. Blend with it: `.hint { opacity: var(--mood, 0) }`.',
    },
    {
      name: 'reading (read-only property)',
      type: 'MoodReading',
      description:
        '`{ mood, reaction, score, scores: { frustrated, confused, lost }, fast, fastKind, alert, away, target, at }` — score is the strongest mood’s strength; fast and fastKind (`shake`, `orbit`, `rage`, `disabled`, named from 0.30) are the signals seen within a few hundred ms; target names the control being fought with by tag, id, role and state (never its text). Libraries.dev’s `probabilities` and `isModelLoaded` have no counterpart: there is no model.',
    },
    {
      name: 'react-to (attribute) · data.reactTo',
      type: 'space-separated list · MoodSignal[]',
      default: 'frustrated confused lost',
      description: 'The moods the reaction (`--mood`) rises for. The `mood` itself is reported either way.',
    },
    {
      name: 'scope (attribute) · data.scope',
      type: '"self" | "page"',
      default: '"self"',
      description:
        '`self` reads only input inside the element (its slotted markup); `page` reads the whole document, as the Libraries.dev kit does — then use one per page.',
    },
    {
      name: 'baseline-key (attribute) · data.baselineKey',
      type: 'string | null',
      default: '"mood-baseline"',
      description:
        'Where the person’s own pace (typical pointer speed and time between presses, learned while calm) is kept in localStorage. An empty attribute or `null` keeps it in memory only.',
    },
    {
      name: 'paused (attribute / property) · data.paused',
      type: 'boolean',
      description: 'Stop reading: listeners off, the reading back to calm (`--mood: 0`, no `mood`).',
    },
    {
      name: 'reset()',
      type: '() => void',
      description: 'Forget what was seen — call it when the flow moves on to a new step. The person’s pace is kept.',
    },
    {
      name: 'data-mood-ignore (on any element inside)',
      type: 'attribute',
      description:
        'Input on that element and inside it is not read: your own help panel, a stepper whose quick presses are normal, a game.',
    },
    {
      name: 'createMoodReader({ scope, onReading, reactTo, baselineKey })',
      type: '() => { start, stop, reset, setReactTo, reading, running, core }',
      description:
        'The reader without the element, as the Libraries.dev kit names it (there is no `model` option). `core` is the engine without a DOM: `pointer`, `press`, `scroll`, `key`, `change`, `sent`, `step(t)` — for replays and tests.',
    },
  ],
  events: [
    {
      name: 'ui-mood-change',
      detail: 'MoodReading',
      description:
        'The mood changed (to a mood, to another, or back to null). Bubbles and is composed; not cancelable.',
    },
    {
      name: 'ui-mood-reading',
      detail: 'MoodReading',
      description:
        'Every reading, every 66 ms while there is something to read (once the score has drained to calm and nothing has come in for 3 s, it stops until the next input). Fired on the element only: it does not bubble.',
    },
  ],
  keyboard: [
    [
      '—',
      'Nothing to focus: the element only reads. Keys in a field count as typed or deleted; which key is never kept.',
    ],
  ],
  a11y: [
    'Adds nothing to the accessibility tree and announces nothing: telling someone they look frustrated helps no one. What the screen brings forward must be reachable without it — the Pay’s terms are a real checkbox with a label, the hint is in the DOM all along.',
    'Keep every reaction small and reversible: dim what is locked, lift what unlocks it, show a hint or a way out. Never block, punish or move things from under the pointer, and do not react to away.',
    'Reads positions, timings and element facts only — never text, field values or the screen; nothing is sent anywhere. The person’s pace is two numbers in localStorage (`baseline-key=""` keeps it in memory).',
    'No timers while calm and still: the reader steps every 66 ms only while there is input or a score or reaction to ease back, wakes once a minute after the last input to say away, and gives one away reading in a hidden tab.',
    'Keyboard and touch users produce no pointer path: only presses, scrolling, typing and sent forms count for them, so the pointer-path moods (confused from circling, lost from revisits) do not rise.',
  ],
  usage: `<ui-mood>
  <form>
    <button disabled>Pay $97.54</button>
    <label class="terms"><input type="checkbox"> I agree to the terms of sale and the return policy</label>
    <p class="hint">Tick the terms to unlock Pay.</p>
  </form>
</ui-mood>

<style>
  /* confused or lost: the locked Pay steps back; frustrated: the terms come forward too */
  ui-mood:is([mood="confused"], [mood="lost"], [mood="frustrated"]) button:disabled { opacity: 0.2; }
  ui-mood[mood="frustrated"] .terms { font-weight: 600; }
  /* or blend by the reaction, 0 … 1 */
  .hint { opacity: var(--mood, 0); }
</style>

<script type="module">
  import '@2lab.ai/ui/mood';
  document.querySelector('ui-mood').addEventListener('ui-mood-change', (e) => {
    console.log(e.detail.mood, e.detail.score);
  });

  // Without the element:
  import { createMoodReader } from '@2lab.ai/ui/mood';
  const reader = createMoodReader({ scope: document, onReading: (r) => render(r) });
  reader.start();
</script>`,
  demos: [
    {
      id: 'replay',
      title: 'Locked Pay, replayed',
      description:
        'Libraries.dev’s showcase route fed to the real reader as pointer events: circling the locked Pay reads confused (state 2, Pay steps back), pressing it again and again and shaking reads frustrated (state 3, the terms come forward), ticking the terms brings state 1 back at once and the reading eases to calm. The HUD shows what the reader reads.',
      height: 540,
      create: () => payReplay(),
    },
    {
      id: 'live',
      title: 'Your pointer',
      description:
        'The same screen on your own pointer, with the reading under it. Circle the Pay button, press it while it is locked, shake the pointer.',
      height: 660,
      create: payLive,
    },
    {
      id: 'hint',
      title: 'A hint that blends with --mood',
      description:
        'A strict date field: send it in the wrong format twice, or keep typing and deleting, and the format hint comes up with the reaction.',
      height: 260,
      create: () => formatHint(),
    },
    {
      id: 'lost',
      title: 'Lost in settings',
      description:
        'Open section after section without changing anything, scroll back and forth: after a few seconds the search lifts.',
      height: 460,
      create: lostSettings,
    },
    {
      id: 'ko',
      title: '한국어',
      description: 'The replay with lang="ko" on the HUD.',
      height: 540,
      create: () => payReplay('ko'),
    },
  ],
};
