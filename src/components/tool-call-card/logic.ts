import { esc } from '../../core/html';

/**
 * `running` — the call is in flight. `success` / `error` — it returned. `interrupted` — the run ended (stopped turn,
 * crashed process) before this call returned a result: neither running nor failed.
 */
export type ToolCallStatus = 'running' | 'success' | 'error' | 'interrupted';

export type ToolIcon = 'wrench' | 'search' | 'file' | 'edit' | 'terminal' | 'globe' | 'agent' | 'list' | 'plug';

export interface ToolCallData {
  /** Tool name as the agent calls it, shown in mono — `Read`, `mcp__github__get_issue`. */
  name: string;
  /** One human line — `src/app.ts (lines 1-80)`. */
  summary?: string;
  /** Icon in the tile. Default `toolIcon(name)`. */
  icon?: ToolIcon;
  status: ToolCallStatus;
  /** Object → pretty JSON; a JSON string is parsed; other text is shown as is. */
  args?: unknown;
  result?: unknown;
  /** Shown when status is `error`. */
  error?: string;
  /** Epoch ms the call started — the live timer counts from here while running. */
  startedAt?: number;
  /** Final duration in ms. */
  duration?: number;
  /** Epoch ms clock time the call started, shown muted in the body as HH:MM:SS. */
  at?: number;
  /** Set → controlled; unset → the element keeps its own open state. */
  open?: boolean;
  /** Initial open state while uncontrolled (read on the first render only). */
  defaultOpen?: boolean;
  /** Default true: opens when the call turns to error, closes again on the next run unless toggled by hand. */
  openOnError?: boolean;
  /** Shows Retry next to the error → `ui-retry`. */
  canRetry?: boolean;
  /** Default 220 — taller blocks get a fade and Show all / Show less. */
  maxCodeHeight?: number;
  /** The host is fetching args/result: the body shows a quiet Loading… line. */
  loading?: boolean;
  /** The host's fetch failed: this message plus Try again → `ui-reload`. */
  detailError?: string;
  /** One muted line in the body (e.g. “Showing the first 256 KiB of 1.2 MB”). */
  note?: string;
  /** Default true; false → the header button is out of the tab order (the host runs a roving focus). */
  focusable?: boolean;
  /** Host key for the call, echoed as `detail.id` in every event (and used by the group to keep cards). */
  id?: string;
}

export interface ToolCallGroupData {
  calls: ToolCallData[];
  /** Label once every call is done. Default “Used N tools”. */
  label?: string;
  /** Label while any call runs. Default “Using tools…”. */
  runningLabel?: string;
  /** Total ms. Default: the sum of the calls' durations, or the time measured while running. */
  duration?: number;
  /** Set → controlled; unset → the element keeps its own open state. */
  open?: boolean;
  /** Initial open state while uncontrolled (read on the first render only). */
  defaultOpen?: boolean;
  /** Default true; false → the group's and the cards' header buttons are out of the tab order. */
  focusable?: boolean;
}

/** 0.4s · 12.3s · 2m 05s · 1h 02m. Live timers always show tenths below a minute; a final value under 1s reads 350ms. */
export function formatToolMs(ms: number, live = false): string {
  const v = Math.max(0, Number(ms) || 0);
  if (!live && v < 1000) return `${Math.max(1, Math.round(v))}ms`;
  if (v < 60_000) return `${(Math.floor(v / 100) / 10).toFixed(1)}s`;
  const s = Math.floor(v / 1000);
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/** Clock time HH:MM:SS (24h) in the card's language; empty for a missing or invalid time. */
export function formatToolClock(at: number | undefined, lang: 'en' | 'ko' = 'en'): string {
  const v = Number(at);
  if (at === undefined || at === null || !Number.isFinite(v)) return '';
  try {
    return new Date(v).toLocaleTimeString(lang === 'ko' ? 'ko-KR' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    return '';
  }
}

/**
 * What a code block shows: objects pretty-printed, a string that holds JSON parsed and pretty-printed, any other
 * text as is. `json` says whether the text may be highlighted.
 */
export function toCodeText(value: unknown): { text: string; json: boolean } {
  if (typeof value === 'string') {
    const head = value.trimStart().charAt(0);
    if (head === '{' || head === '[') {
      try {
        return { text: JSON.stringify(JSON.parse(value), null, 2), json: true };
      } catch {
        /* not JSON: shown as written */
      }
    }
    return { text: value, json: false };
  }
  if (value === undefined) return { text: '', json: false };
  try {
    const s = JSON.stringify(value, null, 2);
    return s === undefined ? { text: String(value), json: false } : { text: s, json: true };
  } catch {
    return { text: String(value), json: false };
  }
}

// One pass over already-escaped JSON. Escaping adds no quote, backslash or digit, so strings, numbers and literals
// are found exactly as in the raw text. Groups: 1 = a string, 2 = the colon that makes it a key.
const JSON_TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

/** JSON text → escaped HTML with `tc-k` (key), `tc-s` (string), `tc-n` (number), `tc-l` (literal) spans. */
export function highlightJson(text: string): string {
  return esc(text).replace(JSON_TOKEN, (m: string, str?: string, colon?: string) => {
    if (str) return colon ? `<span class="tc-k">${str}</span>${colon}` : `<span class="tc-s">${str}</span>`;
    return `<span class="tc-${m.charCodeAt(0) >= 97 ? 'l' : 'n'}">${m}</span>`;
  });
}

const ICON_BY_NAME: Record<string, ToolIcon> = {
  Read: 'file',
  Write: 'file',
  Edit: 'edit',
  MultiEdit: 'edit',
  NotebookEdit: 'edit',
  Bash: 'terminal',
  BashOutput: 'terminal',
  Grep: 'search',
  Glob: 'search',
  WebSearch: 'search',
  WebFetch: 'globe',
  Agent: 'agent',
  Task: 'agent',
  TodoWrite: 'list',
};

/** The tile icon for a tool name: Read/Write → file, Edit → edit, Bash → terminal, Grep/Glob/WebSearch → search,
 * WebFetch → globe, Agent/Task → agent, TodoWrite → list, mcp__* → plug, anything else → wrench. */
export function toolIcon(name: string): ToolIcon {
  const n = String(name ?? '');
  if (Object.hasOwn(ICON_BY_NAME, n)) return ICON_BY_NAME[n];
  return n.startsWith('mcp__') ? 'plug' : 'wrench';
}

/** Line count of a block (for the cap estimate when the layout cannot be measured). */
export function lineCount(text: string): number {
  let n = 1;
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) n++;
  return n;
}

/** What the group line says about its calls. `interrupted` counts as neither running nor failed. */
export function groupStats(calls: ToolCallData[]): { running: boolean; failed: number; sum: number | undefined } {
  let running = false;
  let failed = 0;
  let sum = 0;
  let all = calls.length > 0;
  for (const c of calls) {
    if (c.status === 'running') running = true;
    else if (c.status === 'error') failed++;
    const d = Number(c.duration);
    if (c.duration === undefined || c.duration === null || !Number.isFinite(d)) all = false;
    else sum += Math.max(0, d);
  }
  return { running, failed, sum: all ? sum : undefined };
}

// 16×16 stroke glyphs drawn for this library (currentColor).
const G = (d: string) => `<svg viewBox="0 0 16 16" aria-hidden="true">${d}</svg>`;
export const TOOL_ICONS: Record<ToolIcon, string> = {
  wrench: G(
    '<path d="M13.4 4.6 11.6 6.4 9.9 6.1 9.6 4.4l1.8-1.8a3.2 3.2 0 0 0-4.3 4L2.9 10.8a1.6 1.6 0 0 0 2.3 2.3L9.4 8.9a3.2 3.2 0 0 0 4-4.3Z"/>',
  ),
  search: G('<circle cx="7" cy="7" r="4.25"/><path d="m10.2 10.2 3.3 3.3"/>'),
  file: G(
    '<path d="M9 1.9H4.6a1 1 0 0 0-1 1v10.2a1 1 0 0 0 1 1h6.8a1 1 0 0 0 1-1V5.3Z"/><path d="M9 1.9v3.4h3.4M5.9 8.6h4.2M5.9 11h2.8"/>',
  ),
  edit: G(
    '<path d="M10.3 2.9a1.5 1.5 0 0 1 2.1 0l.7.7a1.5 1.5 0 0 1 0 2.1L6.4 12.4l-3.3.8.8-3.3Z"/><path d="m9.2 4 2.8 2.8"/>',
  ),
  terminal: G('<rect x="1.9" y="2.9" width="12.2" height="10.2" rx="2"/><path d="m4.6 6.3 2 1.8-2 1.8M8.4 10.1h3"/>'),
  globe: G(
    '<circle cx="8" cy="8" r="6.1"/><path d="M1.9 8h12.2M8 1.9c-1.7 1.7-2.5 3.7-2.5 6.1s.8 4.4 2.5 6.1c1.7-1.7 2.5-3.7 2.5-6.1S9.7 3.6 8 1.9Z"/>',
  ),
  agent: G(
    '<rect x="2.9" y="5.1" width="10.2" height="8" rx="2.4"/><path d="M8 2.4v2.7M6.1 8.6v1M9.9 8.6v1M1.4 9.1v1.4M14.6 9.1v1.4"/>',
  ),
  list: G('<path d="m2.4 4.1.9.9 1.6-1.9M2.4 8.6l.9.9 1.6-1.9M2.6 12.6h1.9M7.2 4.2h6.4M7.2 8.2h6.4M7.2 12.6h6.4"/>'),
  plug: G('<path d="M5.9 1.9v2.9M10.1 1.9v2.9M4.1 4.8h7.8v2.3a3.9 3.9 0 0 1-7.8 0ZM8 11v3.1"/>'),
};
