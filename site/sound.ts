// Foundations: interface sounds — the site's speaker toggle, and the Sound page (cue board, settings, policy).
import { icon } from '@2lab.ai/ui/icons/icons';
import { bindSound, SOUND_CUES, type SoundCue, setSound, soundSettings } from '@2lab.ai/ui/sound/sound';

type CodeBlock = (code: string, id: string) => string;
type Cuelume = typeof import('@2lab.ai/ui/sound/cuelume');

const KEY = '2lab-ui-sound';
const THEMES = ['default', 'mech', 'bubble', 'press'] as const;
type Theme = (typeof THEMES)[number];

function stored(name: string): string | null {
  try {
    return localStorage.getItem(`${KEY}${name}`);
  } catch {
    return null;
  }
}
function store(name: string, value: string): void {
  try {
    localStorage.setItem(`${KEY}${name}`, value);
  } catch {}
}

let cuelume: Promise<Cuelume> | null = null;
/** Cuelume loads on first use only: a visitor who never turns sound on downloads none of it. */
function loadCuelume(): Promise<Cuelume> {
  cuelume ??= import('@2lab.ai/ui/sound/cuelume').then((m) => {
    m.setSoundTheme(themeNow());
    return m;
  });
  return cuelume;
}

export function soundNow(): boolean {
  return soundSettings().enabled;
}
function themeNow(): Theme {
  const t = stored('-theme');
  return (THEMES as readonly string[]).includes(t ?? '') ? (t as Theme) : 'default';
}

/** The speaker in the header: the glyph for the current state, pressed when sound is on. */
export function soundButton(): string {
  const on = soundNow();
  return `<button class="icon-btn" id="sound" aria-pressed="${on}" aria-label="Interface sound" title="Interface sound: ${on ? 'on' : 'off'}">${icon(on ? 'sound' : 'sound-off')}</button>`;
}

/** Turn sound on or off from a click (unlocks audio inside the gesture) and keep the choice. */
export async function setSiteSound(on: boolean): Promise<void> {
  store('', on ? 'on' : 'off');
  if (!on) {
    setSound({ enabled: false });
    return;
  }
  const m = await loadCuelume();
  setSound({ player: m.cuelumeSound, enabled: true, typing: stored('-typing') === 'on' });
  void m.unlockSound();
}

/** On load: the saved choice, without a gesture (Cuelume waits for the first one). Light-DOM controls sound too. */
export function startSiteSound(): void {
  bindSound(document);
  if (stored('') === 'on') void setSiteSound(true);
}

const CUE_JOB: Record<SoundCue, string> = {
  tap: 'Buttons, direct activation',
  type: 'A key that edits text (opt-in)',
  select: 'Options, tabs, segmented, menu items',
  toggle: 'Switches, checkboxes, star',
  open: 'Dialogs, drawers, disclosures',
  close: 'Closing, dismissing, cancelling',
  navigate: 'Opening a card, links, pages',
  success: 'Confirmed completion, copied',
  warning: 'Done, but needs a look',
  error: 'A failure or a refusal',
  loading: 'Slow work started',
  ready: 'A result is there',
  attention: 'Blocked until you answer',
  count: 'A number rolling to a new value',
};

/** Which element plays what, as wired in the components (source: each component's sound tests). */
const BY_ELEMENT: Array<[string, string]> = [
  ['Segmented, Tabs, Stat Strip period', 'select — rises moving right, falls moving left; Tabs subtle'],
  ['Menu, Model Picker', 'select on open and on a pick, toggle for a checkbox item, a quiet close'],
  ['Dialog, Drawer', 'open and close — a host opening it sounds only while the browser reports a recent click or key'],
  ['Disclosure, Tool Call Card, Work Log, Task Plan, Task Runs, inbox groups', 'subtle open and close'],
  ['Toaster', 'success, error, warning, loading or a subtle ready, once per toast; nothing on close'],
  ['Composer, Agent Steering, Approval Card, Choice Form submit', 'tap; Deny and cancel close'],
  ['AI Answer, Conversation, Tool Call Card copy', 'subtle success'],
  ['Agent Inbox card, App Bar link, Auth Card provider, Settings Nav', 'navigate'],
  ['Deck Nav, Artifact Viewer previous / next, Log Scroller latest', 'subtle navigate, back when going back'],
  ['Two-press deletes (Goal Card, Knowledge Pages, Episode Log)', 'subtle tap to arm, strong close to confirm'],
  ['Agent Run stop', 'close'],
  ['Text fields inside elements', 'type, only while typing sounds are on'],
];

export function soundPage(codeBlock: CodeBlock): string {
  const on = soundNow();
  const theme = themeNow();
  const board = SOUND_CUES.map(
    (c) => `<button class="ui-btn snd-cue" data-ui-sound="${c}"><b>${c}</b><small>${CUE_JOB[c]}</small></button>`,
  ).join('');
  const themes = THEMES.map(
    (t) => `<button data-snd-theme="${t}" aria-pressed="${t === theme}">${t[0].toUpperCase()}${t.slice(1)}</button>`,
  ).join('');
  const rows = BY_ELEMENT.map(([e, c]) => `<tr><td>${e}</td><td>${c}</td></tr>`).join('');
  return `<div class="crumb">Foundations</div><h1>Sound <span class="chip">opt-in</span></h1>
  <p class="lede">Every element can play a short cue for what the person just did — a detent when a tab changes, air when a dialog opens, a soft chord when a run is done. Sound is off until the person turns it on. The cues are synthesized live with Web Audio by Cuelume: there are no audio files.</p>
  <div class="snd-controls">
    <label class="ui-switch"><input type="checkbox" role="switch" id="snd-on"${on ? ' checked' : ''}><span>Sound</span></label>
    <label class="ui-switch"><input type="checkbox" role="switch" id="snd-typing"${stored('-typing') === 'on' ? ' checked' : ''}><span>Typing sounds</span></label>
    <div class="seg" aria-label="Material">${themes}</div>
  </div>
  <p class="desc" id="snd-hint"${on ? ' hidden' : ''}>Turn sound on to hear the cues below and in every component preview.</p>
  <div class="snd-board">${board}</div>
  <h2>Turn it on</h2>
  <p class="desc">Keep the person's choice next to the theme switch. Load the Cuelume player only once they turn sound on, and unlock audio inside that same click — some browsers start audio only in a gesture, and a cue played later from code (a toast for a finished run) would stay silent.</p>
  ${codeBlock(`import { setSound } from '@2lab.ai/ui/sound';\n\nasync function setSoundChoice(on) {           // from the switch's click\n  localStorage.setItem('sound', on ? 'on' : 'off');\n  if (!on) return setSound({ enabled: false });\n  const { cuelumeSound, unlockSound } = await import('@2lab.ai/ui/sound-cuelume');\n  setSound({ player: cuelumeSound, enabled: true });\n  unlockSound();\n}\n\n// on load, from the saved choice\nif (localStorage.getItem('sound') === 'on') {\n  const { cuelumeSound } = await import('@2lab.ai/ui/sound-cuelume');\n  setSound({ player: cuelumeSound, enabled: true });\n}`, 'snd-on-code')}
  <h2>What plays where</h2>
  <p class="desc">When one interaction raises several cues, only the most specific one plays: a tap that opens a menu or a dialog yields to the open, an item that is picked also closes its menu and plays select, an outcome beats everything. The same cue again within 50 ms is dropped, so a quick run of steps ticks instead of buzzing.</p>
  <div class="tbl"><table><thead><tr><th>Element</th><th>Cue</th></tr></thead><tbody>${rows}</tbody></table></div>
  <h2>Your own controls</h2>
  <p class="desc">Buttons, chips, switches and links in your page sound through the same setting: call <code>bindSound()</code> once and mark them with <code>data-ui-sound</code>. An empty value plays tap; a switch or checkbox plays toggle by its new state; <code>data-ui-sound-emphasis</code> on the control or an ancestor sets how much it matters.</p>
  ${codeBlock(`import { bindSound } from '@2lab.ai/ui/sound';\nbindSound();\n\n<button class="ui-btn is-primary" data-ui-sound>Start task</button>\n<label class="ui-switch"><input type="checkbox" role="switch" data-ui-sound="toggle"><span>Auto-resume</span></label>\n<a href="/runs/42" data-ui-sound="navigate">Open run</a>\n<nav data-ui-sound-emphasis="subtle">…</nav>`, 'snd-bind')}
  <h2>Quiet regions and typing</h2>
  <p class="desc"><code>data-ui-sound="off"</code> on any ancestor silences everything inside it, across shadow roots — a long table of checkboxes, say. Keystroke sounds in text fields are off unless you ask for them: <code>setSound({ typing: true })</code>. Passwords never sound.</p>
  <h2>Material and volume</h2>
  ${codeBlock(`import { setSoundTheme, setSoundVolume, setSoundButtonTheme } from '@2lab.ai/ui/sound-cuelume';\n\nsetSoundTheme('mech');        // 'default' | 'mech' | 'bubble' | 'press'\nsetSoundVolume(0.6);          // 0 to 1\nsetSoundButtonTheme('bubble'); // buttons get a material of their own; undefined = the tabs' woody detent`, 'snd-theme')}
  <h2>Your own player</h2>
  <p class="desc">Any function <code>(cue, options) =&gt; void</code> is a player. <code>options</code> carries <code>emphasis</code> (subtle, normal, strong), <code>direction</code> (forward, back), <code>input</code> (mouse, touch, pen, keyboard), <code>key</code> for typing, <code>duration</code> for count.</p>
  ${codeBlock(`setSound({ player: (cue, options) => myAudio.play(cue, options), enabled: true });`, 'snd-own')}
  <h2>Accessibility</h2>
  <ul class="plain">
    <li>Sound is off until the person turns it on, and stays their choice.</li>
    <li>Every cue goes with visible feedback, so muting loses nothing.</li>
    <li>Nothing plays on hover, on focus, for streamed text or tool calls, or for data the app sets — only toasts, which report outcomes, sound from code.</li>
    <li>Screen reader users often keep sound off; place the setting where they expect it, beside the theme switch.</li>
  </ul>
  <h2>Credits</h2>
  <p class="desc">Cues by <a href="https://github.com/danielwh2/cuelume" target="_blank" rel="noopener">Cuelume</a> (MIT, Daniel Belyi), bundled into <code>@2lab.ai/ui/sound-cuelume</code>. Policy ported from <a href="https://morphin.dev/docs/sound" target="_blank" rel="noopener">Morphin UI's sound</a> (MIT, Ivan Oliinyk). Notices ship in <code>dist/THIRD_PARTY_NOTICES.md</code>.</p>`;
}

/** Wire the Sound page's switches and material buttons. `rerender` redraws the header speaker. */
export function wireSoundPage(root: ParentNode, rerender: () => void): void {
  root.querySelector<HTMLInputElement>('#snd-on')?.addEventListener('change', (e) => {
    const on = (e.target as HTMLInputElement).checked;
    void setSiteSound(on).then(rerender);
  });
  root.querySelector<HTMLInputElement>('#snd-typing')?.addEventListener('change', (e) => {
    const on = (e.target as HTMLInputElement).checked;
    store('-typing', on ? 'on' : 'off');
    setSound({ typing: on });
  });
  for (const b of Array.from(root.querySelectorAll<HTMLElement>('[data-snd-theme]'))) {
    b.addEventListener('click', () => {
      const t = b.dataset.sndTheme as Theme;
      store('-theme', t);
      for (const x of Array.from(root.querySelectorAll('[data-snd-theme]')))
        x.setAttribute('aria-pressed', String(x === b));
      void loadCuelume().then((m) => m.setSoundTheme(t));
    });
  }
}
