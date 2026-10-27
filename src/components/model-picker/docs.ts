import type { ComponentDoc } from '../../docs/types';
import './model-picker';
import type { ModelPickerData, PickerModel } from './model-picker';

const ALL = ['low', 'medium', 'high', 'xhigh', 'max'];

/**
 * The dashboard's representative models. Prices are the soma-work model registry's rows (`findModelPricing`):
 * Grok has no row there, so its price is unknown (`null`) — the menu says so instead of quoting a fallback rate.
 */
const MODELS: PickerModel[] = [
  {
    id: 'claude-opus-5-5[1m]',
    label: 'Opus 5.5 (1M)',
    short: 'opus[1m]',
    window: 1_000_000,
    autoCompactAt: 750_000,
    price: { input: 5, output: 25 },
    effortLevels: ALL,
  },
  {
    id: 'claude-fable-5-1[1m]',
    label: 'Fable 5.1 (1M)',
    short: 'fable[1m]',
    window: 1_000_000,
    autoCompactAt: 750_000,
    price: { input: 10, output: 50 },
    effortLevels: ALL,
  },
  {
    id: 'claude-sonnet-4-6[1m]',
    label: 'Sonnet 4.6 (1M)',
    short: 'sonnet[1m]',
    window: 1_000_000,
    autoCompactAt: 750_000,
    price: { input: 3, output: 15 },
    effortLevels: ['low', 'medium', 'high'],
  },
  {
    id: 'gpt-5.6-sol',
    label: 'GPT-5.6 Sol (1M)',
    short: 'sol[1m]',
    window: 1_000_000,
    autoCompactAt: 600_000,
    price: { input: 5, output: 30 },
    effortLevels: ['low', 'medium', 'high', 'xhigh'],
  },
  {
    id: 'gpt-6-astra',
    label: 'GPT-6 Astra (1M)',
    short: 'astra[1m]',
    window: 1_000_000,
    autoCompactAt: 600_000,
    price: { input: 10, output: 50 },
    effortLevels: ['low', 'medium', 'high', 'xhigh'],
  },
  {
    id: 'grok-4.6',
    label: 'Grok 4.6 (500K)',
    short: 'grok[1m]',
    window: 500_000,
    autoCompactAt: 450_000,
    price: null,
    effortLevels: ['low', 'high'],
  },
];

const BASE: ModelPickerData = { models: MODELS, value: { model: 'claude-opus-5-5[1m]', effort: 'xhigh' } };

function make(data: ModelPickerData, opts: { open?: boolean; attrs?: Record<string, string> } = {}): HTMLElement {
  const el = document.createElement('ui-model-picker');
  for (const [k, v] of Object.entries(opts.attrs ?? {})) el.setAttribute(k, v);
  el.data = data;
  if (opts.open) el.open = true;
  return el;
}

const H = 600;

export const doc: ComponentDoc = {
  slug: 'model-picker',
  name: 'Model Picker',
  tag: 'ui-model-picker',
  group: 'Components',
  summary:
    'Which model and how much effort this session runs next — with the window, compaction point and price in view.',
  description:
    'One trigger (avatar letter, model, “· effort”, chevron) opens the session’s model menu. Every model shows three 5-segment meters — context window, auto-compact point and output cost, each against the largest in the list — the current model carries a ✓, the effort control offers only the levels that model runs, and the tray states the price and window of the row in view. Only numbers the data carries are drawn: an unknown price is “—”, never a fallback rate. The menu is fixed-positioned from the trigger (an ancestor’s overflow clip never cuts it), stays inside the viewport, flips when there is no room, and closes when its trigger moves in the layout.',
  usedIn: 'soma-work dashboard › open card control row and the panel composer — 모델 · effort 메뉴',
  reference: { name: 'affectUI Model Picker', url: 'https://www.affectui.com/components/model-picker' },
  props: [
    {
      name: 'data.models',
      type: 'PickerModel[]',
      required: true,
      description: 'The models the session can switch to, in display order. Rows are named by `id`, never by position.',
    },
    {
      name: 'data.models[].id',
      type: 'string',
      required: true,
      description: 'What `ui-change` carries back (your switch key or the full model id).',
    },
    { name: 'data.models[].label', type: 'string', required: true, description: 'Display name, e.g. “Opus 5.5 (1M)”.' },
    {
      name: 'data.models[].short',
      type: 'string',
      description: 'Compact name for the description line and the avatar letter (default: id / label).',
    },
    {
      name: 'data.models[].window',
      type: 'number',
      description: 'Context window in tokens — the window meter and the tray.',
    },
    {
      name: 'data.models[].autoCompactAt',
      type: 'number',
      description: 'The model’s auto-compact threshold — the compaction meter and “autocompact N” in the description.',
    },
    {
      name: 'data.models[].price',
      type: '{ input: number; output: number } | null',
      description: 'USD per million tokens. Missing or null = unknown: the cost meter and the tray show “—”.',
    },
    {
      name: 'data.models[].effortLevels',
      type: 'string[]',
      default: "['low','medium','high','xhigh','max']",
      description: 'Levels this model runs, in order. The effort control offers only these; `[]` hides it.',
    },
    {
      name: 'data.models[].bars',
      type: '{ window?, compaction?, cost? } (0–5)',
      description:
        'Override the computed meters (0 draws “—”). Default: value ÷ the largest in the list, 1–5 segments.',
    },
    {
      name: 'data.value',
      type: '{ model: string; effort?: string; effectiveEffort?: string }',
      required: true,
      description:
        'The session’s model and effort. A model outside the list is shown as a first, unselectable row. `effectiveEffort` is the level that actually runs when the model caps the set one.',
    },
    {
      name: 'data.contextTokens',
      type: 'number',
      description:
        'Tokens in context now: a row whose auto-compact point is below it says “switches after compaction”.',
    },
    {
      name: 'data.busy',
      type: '{ model?: boolean | string; effort?: boolean }',
      description:
        'A write in flight. `model` locks the rows (a string replaces the “Switching model…” line and shows under the trigger); `effort` locks the levels.',
    },
    {
      name: 'data.disabled',
      type: 'boolean | string',
      default: 'false',
      description: 'Read-only. A string is the reason (tooltip + accessible description).',
    },
    {
      name: 'data.error',
      type: 'string',
      description: 'The last write failed — role="alert" inside the open menu, or under the trigger when closed.',
    },
    {
      name: 'open',
      type: 'boolean',
      default: 'false',
      description:
        'Property / attribute. Opens the menu without moving focus and without `ui-open-change` (e.g. a demo or a restored state).',
    },
    {
      name: 'side',
      type: "'bottom' | 'top'",
      default: "'bottom'",
      description: 'Attribute. Preferred side of the trigger (a composer row uses `top`); flips when it has no room.',
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
      name: 'ui-change',
      detail: "{ model: string; effort?: string; changed: 'model' | 'effort' }",
      description:
        'A model was picked (the menu closes, focus returns to the trigger) or an effort level (the menu stays open). Cancelable: unless you call preventDefault() the picker shows the new value at once; prevent it to keep data.value until your server agrees.',
    },
    {
      name: 'ui-open-change',
      detail: '{ open: boolean }',
      description:
        'The menu opened or closed through the person (trigger, Esc, a pick, a press outside) or by itself (its trigger moved in the layout or left the viewport). Setting `open` does not emit.',
    },
  ],
  keyboard: [
    ['Enter / Space / ↓ / ↑ (trigger)', 'Open the menu with focus on the model list, active = the current model'],
    ['↑ / ↓ · Home / End', 'Move through the models (wraps); the meters fill and the tray follows'],
    [
      'Enter / Space (list)',
      'Pick the active model → ui-change, the menu closes, focus back on the trigger (the current model just closes)',
    ],
    ['Tab / Shift+Tab', 'Move between the model list and the checked effort level — focus stays inside the menu'],
    ['← → ↑ ↓ · Home / End (effort)', 'Move and select a level at once (radio pattern); the menu stays open'],
    ['Esc', 'Close and return focus to the trigger'],
  ],
  a11y: [
    'Trigger: aria-haspopup="dialog", aria-expanded, aria-controls; its label reads “Model <name>, effort <level> — change”; aria-busy while a write runs. Read-only uses aria-disabled and keeps focus, so the reason is read as its description.',
    'The menu is role="dialog"; closed it is inert and hidden. The list is a listbox with aria-activedescendant (focus stays on the list); the current model is aria-selected; locked rows and a model outside the list are aria-disabled.',
    'Each option’s aria-label states name, description, window and price — the column head, meters and tray caption are aria-hidden.',
    'Effort is a radiogroup with one tab stop (roving tabindex); aria-disabled + aria-busy while an effort write runs.',
    'One polite live region reads the tray sentence once when the row in view changes. Errors use role="alert" (in the open menu, else under the trigger); a waiting switch uses role="status" under the trigger.',
    'Keys inside the menu do not propagate, so page shortcuts and outer Esc handlers stay quiet while it is open.',
    'Reduced motion: the menu fades without scaling, meters fill without the stagger, prices jump instead of rolling. Coarse pointers / narrow viewports: trigger and levels ≥44px, rows ≥54px.',
  ],
  usage: `<ui-model-picker></ui-model-picker>
<script type="module">
  import '@2lab.ai/ui/model-picker';
  const picker = document.querySelector('ui-model-picker');
  picker.data = {
    models: [
      { id: 'opus[1m]', label: 'Opus 5.5 (1M)', window: 1_000_000, autoCompactAt: 750_000,
        price: { input: 5, output: 25 }, effortLevels: ['low', 'medium', 'high', 'xhigh', 'max'] },
      { id: 'grok[1m]', label: 'Grok 4.6 (500K)', window: 500_000, autoCompactAt: 450_000,
        price: null, effortLevels: ['low', 'high'] },
    ],
    value: { model: 'opus[1m]', effort: 'xhigh' },
  };
  picker.addEventListener('ui-change', async (e) => {
    e.preventDefault(); // keep showing the current value until the server agrees
    const { model, effort, changed } = e.detail;
    picker.data = { ...picker.data, busy: { [changed]: true }, error: undefined };
    const res = await fetch('/session/model', { method: 'POST', body: JSON.stringify({ model, effort }) });
    picker.data = res.ok
      ? { ...picker.data, busy: undefined, value: { model, effort } }
      : { ...picker.data, busy: undefined, error: 'Switch refused — try again' };
  });
</script>`,
  demos: [
    {
      id: 'open',
      title: 'Open menu',
      description:
        'Opened on load with `open`. Point at a row: its meters fill and the tray rolls to its price. Grok has no registry price, so its cost meter and price are “—”.',
      height: H,
      create: () => make(BASE, { open: true }),
    },
    {
      id: 'pending',
      title: 'Switch waiting',
      description:
        'busy.model locks the rows behind a status line; with 520K in context, Grok (auto-compact 450K) would switch only after a compaction.',
      height: H,
      create: () =>
        make(
          {
            ...BASE,
            value: { model: 'claude-opus-5-5[1m]', effort: 'high' },
            contextTokens: 520_000,
            busy: { model: 'Switching to grok[1m] after compaction' },
          },
          { open: true },
        ),
    },
    {
      id: 'capped',
      title: 'Capped effort',
      description:
        'Sonnet runs up to High: only its three levels are offered, and a Max setting says what actually runs.',
      height: H,
      create: () =>
        make(
          { ...BASE, value: { model: 'claude-sonnet-4-6[1m]', effort: 'max', effectiveEffort: 'high' } },
          { open: true },
        ),
    },
    {
      id: 'outside',
      title: 'Model outside the list',
      description:
        'The session runs a model the switch list does not offer: it is the first row — current, not selectable, price unknown.',
      height: H,
      create: () => make({ ...BASE, value: { model: 'claude-haiku-4-5-20251001', effort: 'low' } }, { open: true }),
    },
    {
      id: 'error',
      title: 'Write failed',
      description:
        'A refused switch: the trigger keeps the session’s model and the reason is announced (role="alert").',
      height: H,
      create: () =>
        make({
          ...BASE,
          error: 'Model switch refused — the session is running a turn (HTTP 409). Try again after it ends.',
        }),
    },
    {
      id: 'readonly',
      title: 'Read-only',
      description: 'Someone else’s session: the trigger shows the model and effort but does not open.',
      height: 240,
      create: () => make({ ...BASE, disabled: 'Read-only — not your session' }),
    },
    {
      id: 'ko',
      title: '한국어 (lang="ko")',
      height: H,
      create: () => make(BASE, { open: true, attrs: { lang: 'ko' } }),
    },
  ],
};
