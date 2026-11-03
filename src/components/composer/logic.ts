/**
 * Composer — pure helpers (no DOM). Key rules match `steerEnterAction` in agent-steering; file checks, the voice
 * note's name and the recorder's level meter are ported from the dashboard's new-task / panel composer.
 * Everything here is exported and unit-tested.
 */
import { fileExt } from '../../core/files';
import type { IconName } from '../../icons/icons';

/** An extra tool the host puts in the toolbar, after the built-in attach / image / voice buttons. */
export interface ComposerTool {
  /** Echoed as `detail.id` in `ui-tool`. */
  id: string;
  /** Accessible name and tooltip (shown as text with `showLabel`, or when there is no icon). */
  label: string;
  /** A glyph from `@2lab.ai/ui/icons`. Without one the tool is a small text chip. */
  icon?: IconName;
  /** Show the label next to the icon. */
  showLabel?: boolean;
  /** A toggle: `aria-pressed`, drawn as the raised chip when on. Leave undefined for a plain action. */
  pressed?: boolean;
  disabled?: boolean;
}

/** The switch beside the send button (`ComposerData.mode`): off is day (the sun), on is night (the moon). */
export interface ComposerMode {
  /** Echoed as `detail.id` in `ui-mode`. */
  id: string;
  /** The switch's accessible name and tooltip — what “on” does. Start it with `text` when there is one. */
  label: string;
  on: boolean;
  /** A short word beside the track (e.g. “Plan”). Hidden on narrow cards; the label still names the switch. */
  text?: string;
  /** The send button's text while on (e.g. “Start plan”). Unset: `submitLabel`; `''`: the arrow alone. */
  submitLabel?: string;
  disabled?: boolean;
}

export interface ComposerData {
  /**
   * Fills the field (a restored draft, a resend). Applied when it differs from the value applied last — not on every
   * render, so a host update while someone types never resets the field. To set the same text again use `el.value`.
   */
  value?: string;
  placeholder?: string;
  /** The field's accessible name. Default “Message”. */
  label?: string;
  /** Sending: the send button spins (aria-busy) and is off; the text stays editable. */
  busy?: boolean;
  /** Read-only: the field is readonly, tools and send are off. A string is the reason, shown quietly under the card. */
  disabled?: boolean | string;
  /** Character limit: a “120 / 4,000” counter; warn tone from 90 %, over the limit the counter turns red and send is off. */
  maxLength?: number;
  /** File types the composer takes (the `accept` syntax: `.pdf`, `image/*`, `text/plain`). Default: any. */
  accept?: string;
  /** Default 10. */
  maxFiles?: number;
  /** Bytes per file. Default 25 MB. */
  maxFileSize?: number;
  /**
   * Bytes all attachments may take together (the server's request cap). A file that would cross it sends the
   * cancelable `ui-over-cap` first; unless the host prevents it, it is rejected (reason `total`). Default: no cap.
   */
  maxTotalBytes?: number;
  /** Built-in tools. Default `true`; voice is hidden where MediaRecorder / getUserMedia are missing. */
  attach?: boolean;
  image?: boolean;
  voice?: boolean;
  /**
   * A camera tool on touch screens (phones, tablets): takes a photo with the back camera (`true` / `environment`) or
   * the front one (`user`) and attaches it. Hidden on fine pointers, where the image tool covers it. Default off.
   */
  camera?: boolean | 'environment' | 'user';
  /** Upload progress 0–1 while you send: a thin line above the toolbar (role="progressbar"). Leave unset when idle. */
  progress?: number;
  /** A recording stops (and is kept) at this length. Default 10 min. */
  maxRecordMs?: number;
  /** Extra host tools → `ui-tool`. */
  tools?: ComposerTool[];
  /** Text on the send button (e.g. “Start task”). Without it the button is a 32px arrow-up icon named “Send”. */
  submitLabel?: string;
  /**
   * A two-state switch right beside the send button that changes what sending does (e.g. “Plan first”), drawn as a
   * day / night track: off is the sun, on is the moon. While it is on the send button takes the night colour and
   * `mode.submitLabel`. A press flips it at once and sends `ui-mode`; the flip lasts until `data.mode` changes.
   */
  mode?: ComposerMode;
  /** Show the key hint (desktop only): “Enter to send · Shift+Enter for a new line”, or the newline mode's. */
  hint?: boolean;
  /**
   * What a plain Enter does: `send` (default; Shift+Enter is a new line) or `newline` — for long instructions:
   * Enter is a new line and ⌘/Ctrl+Enter sends. The `enter` attribute wins over this.
   */
  enter?: ComposerEnterMode;
  /** Autosize bounds in text rows. Default 2 / 10. */
  minRows?: number;
  maxRows?: number;
}

export type ComposerRejectReason = 'count' | 'size' | 'type' | 'empty' | 'total';
export type ComposerRecordState = 'start' | 'stop' | 'cancel' | 'error';
export type ComposerEnterAction = 'none' | 'newline' | 'send';
/** What a plain Enter does in the field. */
export type ComposerEnterMode = 'send' | 'newline';

/** An `enter` value as a mode (anything but `newline` → `send`). */
export function composerEnterMode(value: unknown): ComposerEnterMode {
  return value === 'newline' ? 'newline' : 'send';
}

export interface ComposerSubmitDetail {
  /** The text with leading / trailing whitespace trimmed (inner whitespace and new lines kept). */
  text: string;
  files: File[];
}
export interface ComposerInputDetail {
  value: string;
}
export interface ComposerFilesDetail {
  files: File[];
}
export interface ComposerRejectDetail {
  name: string;
  reason: ComposerRejectReason;
  file: File;
}
export interface ComposerRecordDetail {
  state: ComposerRecordState;
  /** `error`: the DOMException name (NotAllowedError, NotFoundError …) or the message. */
  error?: string;
  /** `stop`: the voice note that was attached (missing when nothing was recorded or it was rejected). */
  file?: File;
  /** `stop`: length of the recording. */
  durationMs?: number;
}
/** `ui-over-cap` (cancelable): this file would take the attachments past `maxTotalBytes`. */
export interface ComposerOverCapDetail {
  name: string;
  file: File;
  /** The file's bytes. */
  size: number;
  /** Bytes already attached (this batch's earlier files included). */
  total: number;
  /** `maxTotalBytes`. */
  max: number;
}
export interface ComposerToolDetail {
  id: string;
  /** Toggles only: the state the press asks for. */
  pressed?: boolean;
}
export interface ComposerModeDetail {
  id: string;
  /** The state the press asks for. */
  on: boolean;
}

export const COMPOSER_DEFAULTS = {
  maxFiles: 10,
  maxFileSize: 25 * 1024 * 1024,
  maxRecordMs: 10 * 60_000,
  minRows: 2,
  maxRows: 10,
} as const;

const MAX_ROWS_CAP = 40;

/** The data with defaults filled in and junk numbers ignored. */
export interface ComposerSettings {
  maxFiles: number;
  maxFileSize: number;
  /** 0 = no cap. */
  maxTotalBytes: number;
  maxRecordMs: number;
  /** 0 = no limit. */
  maxLength: number;
  accept: string;
  attach: boolean;
  image: boolean;
  voice: boolean;
  /** The camera tool's `capture` ('' = no camera tool). */
  camera: '' | 'environment' | 'user';
  /** 0–1, or null without progress. */
  progress: number | null;
  busy: boolean;
  disabled: boolean;
  reason: string;
  minRows: number;
  maxRows: number;
}

const posNum = (v: unknown, def: number): number => {
  const n = Number(v);
  return v !== null && v !== '' && Number.isFinite(n) && n > 0 ? n : def;
};

export function composerSettings(d: ComposerData | null | undefined): ComposerSettings {
  const o = d ?? {};
  const rows = composerRows(o.minRows, o.maxRows);
  return {
    maxFiles: Math.max(1, Math.floor(posNum(o.maxFiles, COMPOSER_DEFAULTS.maxFiles))),
    maxFileSize: posNum(o.maxFileSize, COMPOSER_DEFAULTS.maxFileSize),
    maxTotalBytes: Math.floor(posNum(o.maxTotalBytes, 0)),
    maxRecordMs: Math.max(1000, posNum(o.maxRecordMs, COMPOSER_DEFAULTS.maxRecordMs)),
    maxLength: Math.floor(posNum(o.maxLength, 0)),
    accept: typeof o.accept === 'string' ? o.accept.trim() : '',
    attach: o.attach !== false,
    image: o.image !== false,
    voice: o.voice !== false,
    camera: o.camera === 'user' ? 'user' : o.camera === true || o.camera === 'environment' ? 'environment' : '',
    progress:
      o.progress === null || o.progress === undefined || !Number.isFinite(Number(o.progress))
        ? null
        : Math.max(0, Math.min(1, Number(o.progress))),
    busy: !!o.busy,
    disabled: !!o.disabled,
    reason: typeof o.disabled === 'string' ? o.disabled.trim() : '',
    minRows: rows.min,
    maxRows: rows.max,
  };
}

/** The host's tools made safe: each needs an id (first one wins); the label is a string. */
export function composerTools(raw: unknown): ComposerTool[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ComposerTool[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const id = o.id === undefined || o.id === null ? '' : String(o.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const tool: ComposerTool = { id, label: o.label === undefined || o.label === null ? id : String(o.label) };
    if (typeof o.icon === 'string' && o.icon) tool.icon = o.icon as IconName;
    if (o.showLabel) tool.showLabel = true;
    if (typeof o.pressed === 'boolean') tool.pressed = o.pressed;
    if (o.disabled) tool.disabled = true;
    out.push(tool);
  }
  return out;
}

/** The host's mode switch made safe: it needs an id; label and text are strings; `on` only when exactly true. */
export function composerMode(raw: unknown): ComposerMode | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = o.id === undefined || o.id === null ? '' : String(o.id);
  if (!id) return null;
  const mode: ComposerMode = {
    id,
    label: o.label === undefined || o.label === null ? id : String(o.label),
    on: o.on === true,
  };
  const text = o.text === undefined || o.text === null ? '' : String(o.text).trim();
  if (text) mode.text = text;
  if (typeof o.submitLabel === 'string') mode.submitLabel = o.submitLabel;
  if (o.disabled) mode.disabled = true;
  return mode;
}

/** Autosize bounds: whole rows, 1 ≤ min ≤ max ≤ 40. */
export function composerRows(minRows?: unknown, maxRows?: unknown): { min: number; max: number } {
  const min = Math.min(MAX_ROWS_CAP, Math.max(1, Math.round(posNum(minRows, COMPOSER_DEFAULTS.minRows))));
  const max = Math.min(
    MAX_ROWS_CAP,
    Math.max(min, Math.round(posNum(maxRows, Math.max(min, COMPOSER_DEFAULTS.maxRows)))),
  );
  return { min, max };
}

/**
 * What Enter does in the field. Never during IME composition (isComposing, or keyCode 229 — Safari's composition
 * Enter). ⌘/Ctrl+Enter sends (touch too). Shift+Enter or Alt+Enter: a new line; on touch screens plain Enter is a new
 * line too (the send button sends), and so it is in `enter: 'newline'` mode. Otherwise Enter sends.
 */
export function composerEnterAction(
  e: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'altKey'> & {
    isComposing?: boolean;
    keyCode?: number;
  },
  opts: { touch?: boolean; enter?: ComposerEnterMode } = {},
): ComposerEnterAction {
  if (!e || e.key !== 'Enter') return 'none';
  if (e.isComposing || e.keyCode === 229) return 'none';
  if (e.metaKey || e.ctrlKey) return 'send';
  if (e.shiftKey || e.altKey || opts.touch || opts.enter === 'newline') return 'newline';
  return 'send';
}

/** Something to send: non-space text, or at least one file. */
export function composerCanSend(text: unknown, fileCount: number): boolean {
  return String(text ?? '').trim().length > 0 || fileCount > 0;
}

/**
 * Does a file match an `accept` list? Tokens are comma-separated: `.ext` (end of the name, any case), `type/*`,
 * `type/subtype`. An empty list takes everything.
 */
export function composerAccepts(file: { name?: unknown; type?: unknown }, accept: unknown): boolean {
  const tokens = String(accept ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!tokens.length) return true;
  const name = String(file?.name ?? '').toLowerCase();
  const type = String(file?.type ?? '')
    .toLowerCase()
    .split(';')[0]
    .trim();
  return tokens.some((t) => {
    if (t.startsWith('.')) return name.length > t.length && name.endsWith(t);
    if (t.endsWith('/*')) return !!type && type.startsWith(t.slice(0, -1));
    return type === t;
  });
}

/**
 * Why a file cannot be attached (count first, then type, empty, size, then the total over `maxTotalBytes` given the
 * `total` bytes already attached), or null when it can.
 */
export function composerCheckFile(
  file: { name?: unknown; type?: unknown; size?: unknown },
  opts: {
    count: number;
    maxFiles: number;
    maxFileSize: number;
    accept?: string;
    total?: number;
    maxTotalBytes?: number;
  },
): ComposerRejectReason | null {
  if (opts.count >= opts.maxFiles) return 'count';
  if (!composerAccepts(file, opts.accept)) return 'type';
  const size = Number(file?.size);
  if (!(size > 0)) return 'empty';
  if (size > opts.maxFileSize) return 'size';
  const cap = Number(opts.maxTotalBytes);
  if (cap > 0 && (Number(opts.total) || 0) + size > cap) return 'total';
  return null;
}

/** Counter tone: '' below 90 %, 'warn' from 90 %, 'over' past the limit ('' without a limit). */
export function composerCounterTone(length: number, max: number): '' | 'warn' | 'over' {
  if (!(max > 0)) return '';
  if (length > max) return 'over';
  return length >= max * 0.9 ? 'warn' : '';
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local time as `YYYYMMDD-HHMMSS` (file names). */
export function composerStamp(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** The file extension for a recorder MIME type: m4a, ogg, webm, mp3, wav (webm when unknown). */
export function composerAudioExt(mime: unknown): string {
  const t = String(mime ?? '').toLowerCase();
  if (t.startsWith('audio/mp4') || t.startsWith('audio/aac') || t.startsWith('audio/x-m4a')) return 'm4a';
  if (t.includes('ogg')) return 'ogg';
  if (t.includes('webm')) return 'webm';
  if (t.includes('mpeg') || t.includes('mp3')) return 'mp3';
  if (t.includes('wav')) return 'wav';
  return 'webm';
}

/** `voice-20261030-142233.m4a` — the name of a recorded voice note. */
export function composerVoiceName(d: Date, mime: unknown): string {
  return `voice-${composerStamp(d)}.${composerAudioExt(mime)}`;
}

/**
 * The recorder format to ask for: MP4/AAC first (Safari, Chrome, Edge), then Ogg/Opus (Firefox), WebM last (servers
 * often read a .webm upload as video). '' = let the browser choose.
 */
export function composerRecorderMime(isSupported: (type: string) => boolean): string {
  for (const t of ['audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm']) {
    try {
      if (isSupported(t)) return t;
    } catch {
      // A browser that throws for a type does not support it.
    }
  }
  return '';
}

/**
 * The name a pasted file is attached under: a clipboard image with no name or the generic `image.png` becomes
 * `screenshot-YYYYMMDD-HHMMSS.png`, so several pastes stay apart. Other names are kept.
 */
export function composerPastedName(file: { name?: unknown; type?: unknown }, d: Date): string {
  const name = String(file?.name ?? '');
  if (name && !/^image\.(png|jpe?g|gif|webp)$/i.test(name)) return name;
  const sub = /^image\/([a-z0-9]+)/i.exec(String(file?.type ?? ''))?.[1]?.toLowerCase();
  const ext = sub === 'jpeg' ? 'jpg' : sub || fileExt(name) || 'png';
  return `screenshot-${composerStamp(d)}.${ext}`;
}

/** Microphone level 0–1 from time-domain samples (0–255, silence = 128): RMS, scaled so speech fills the bar. */
export function composerLevel(samples: ArrayLike<number>): number {
  const n = samples?.length ?? 0;
  if (!n) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = (Number(samples[i]) - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / n);
  return Math.max(0, Math.min(1, rms * 3.5));
}
