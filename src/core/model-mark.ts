/**
 * 0.23.0 — a model as its maker's mark (2lab-ai/soma-work#813). One place says which maker runs a model, draws the
 * maker's mark and gives the maker's colour, so the board's model chip, the model picker's tile and an agent tree's
 * row draw a model the same way — as affectUI's agent rows do: every Claude model is Claude's clay starburst, every
 * OpenAI model OpenAI's knot, every Gemini model Gemini's blue sparkle.
 *
 * The marks are drawn for 12–16px (a 16-unit box, currentColor), not traced from the makers' logos. Their paint is an
 * inline style, so a component's own `svg { fill: none; stroke-width: … }` rule cannot redraw them.
 */

/** The makers the library has a mark for; `model` is any other (a generic chip). */
export type ModelVendor = 'claude' | 'openai' | 'grok' | 'gemini' | 'model';

export const MODEL_VENDORS: readonly ModelVendor[] = ['claude', 'openai', 'grok', 'gemini', 'model'];

/**
 * The maker's colour: Claude's clay, Gemini's blue. OpenAI's and xAI's marks are black — they take the ink
 * (`''`: the text colour, so dark mode turns them white) — and an unknown maker the ink too.
 */
export const MODEL_MAKER_COLOR: Readonly<Record<ModelVendor, string>> = {
  claude: '#d97757',
  gemini: '#4285f4',
  openai: '',
  grok: '',
  model: '',
};

/** Which maker runs a model, from its id or name (`claude-opus-5-5[1m]`, `Opus 5.5`, `gpt-5.5`, `o3`, …). */
export function modelVendor(model: unknown): ModelVendor {
  const m = typeof model === 'string' ? model.toLowerCase() : '';
  if (/claude|opus|sonnet|haiku|fable/.test(m)) return 'claude';
  if (/^gpt|^o[0-9]|codex|openai|chatgpt/.test(m)) return 'openai';
  if (/grok|xai/.test(m)) return 'grok';
  if (/gemini/.test(m)) return 'gemini';
  return 'model';
}

/** A vendor name as given, when it is one; else undefined. */
export function asModelVendor(v: unknown): ModelVendor | undefined {
  return MODEL_VENDORS.includes(v as ModelVendor) ? (v as ModelVendor) : undefined;
}

const MARK: Record<ModelVendor, string> = {
  // Claude: the starburst — twelve rays from the centre, long and short in turn.
  claude:
    '<svg viewBox="0 0 16 16" style="fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round" aria-hidden="true"><path d="M8.58 8.16L14.38 9.71M8.42 8.42L11.54 11.54M8.16 8.58L9.71 14.38M7.84 8.58L6.71 12.83M7.58 8.42L3.33 12.67M7.42 8.16L3.17 9.29M7.42 7.84L1.62 6.29M7.58 7.58L4.46 4.46M7.84 7.42L6.29 1.62M8.16 7.42L9.29 3.17M8.42 7.58L12.67 3.33M8.58 7.84L12.83 6.71"/></svg>',
  // OpenAI: the knot — six rounded links turned a sixth of a turn each around the centre.
  openai:
    '<svg viewBox="0 0 16 16" style="fill:none;stroke:currentColor;stroke-width:1.2" aria-hidden="true"><g><rect x="6.1" y="1.4" width="3.8" height="7.6" rx="1.9"/><rect x="6.1" y="1.4" width="3.8" height="7.6" rx="1.9" transform="rotate(60 8 8)"/><rect x="6.1" y="1.4" width="3.8" height="7.6" rx="1.9" transform="rotate(120 8 8)"/><rect x="6.1" y="1.4" width="3.8" height="7.6" rx="1.9" transform="rotate(180 8 8)"/><rect x="6.1" y="1.4" width="3.8" height="7.6" rx="1.9" transform="rotate(240 8 8)"/><rect x="6.1" y="1.4" width="3.8" height="7.6" rx="1.9" transform="rotate(300 8 8)"/></g></svg>',
  // Grok (xAI): the slash through the broken ring.
  grok: '<svg viewBox="0 0 16 16" style="fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round" aria-hidden="true"><path d="M3 13 13 3M5.2 3.6A5.2 5.2 0 0 1 12.4 10.8M10.8 12.4A5.2 5.2 0 0 1 3.6 5.2"/></svg>',
  // Gemini: the four-pointed sparkle.
  gemini:
    '<svg viewBox="0 0 16 16" style="fill:currentColor;stroke:none" aria-hidden="true"><path d="M8 1c.6 3.6 2.4 5.4 6 6-3.6.6-5.4 2.4-6 6-.6-3.6-2.4-5.4-6-6 3.6-.6 5.4-2.4 6-6z"/></svg>',
  // Any other model: a chip.
  model:
    '<svg viewBox="0 0 16 16" style="fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round" aria-hidden="true"><rect x="4" y="4" width="8" height="8" rx="1.5"/><path d="M6.5 1.8V4M9.5 1.8V4M6.5 12v2.2M9.5 12v2.2M1.8 6.5H4M1.8 9.5H4M12 6.5h2.2M12 9.5h2.2"/></svg>',
};

/** The maker's mark as SVG markup (currentColor, aria-hidden). Our own markup — never host text. */
export function modelMarkSvg(vendor: ModelVendor): string {
  return MARK[vendor] ?? MARK.model;
}

/**
 * The mark in the maker's colour, ready to drop in: `<span class="{cls}" data-vendor="claude"
 * style="--model-hue:#d97757">svg</span>`. An ink maker has no `--model-hue` (the CSS uses the text colour).
 */
export function modelMarkHtml(vendor: ModelVendor, cls: string): string {
  const hue = MODEL_MAKER_COLOR[vendor];
  return `<span class="${cls}" data-vendor="${vendor}"${hue ? ` style="--model-hue:${hue}"` : ''} aria-hidden="true">${modelMarkSvg(vendor)}</span>`;
}
