import { icon } from '../icons/icons';
import { fmtTokens } from './format';
import { attrs, esc } from './html';

/**
 * Shared pieces of an agent's activity, used by the work log and the conversation: the system-turn badge
 * (compacted, restarted, retried, goal, scheduled, background), skill chips with their text, and the raw output
 * viewer. Pure HTML builders — every string escaped — plus `activityCss` for the owner's shadow root. The owner keeps
 * the state (which skill is open, whether Copy just copied) and wires the buttons.
 */

export type ActivityLang = 'en' | 'ko';
export type SysKind = 'compact' | 'restart' | 'retry' | 'goal' | 'cron' | 'background';

const SYS_WORDS: Record<ActivityLang, Record<SysKind, string>> = {
  en: {
    compact: 'Compacted',
    restart: 'Restarted',
    retry: 'Retried',
    goal: 'Goal',
    cron: 'Scheduled',
    background: 'Background',
  },
  ko: { compact: '압축', restart: '재시작', retry: '재시도', goal: '목표', cron: '예약', background: '백그라운드' },
};

const SYS_ICONS: Record<SysKind, string> = {
  compact: 'minus',
  restart: 'refresh',
  retry: 'refresh',
  goal: 'target',
  cron: 'clock',
  background: 'list',
};

const STRINGS = {
  en: {
    skills: (n: number) => `Skills used: ${n}`,
    tokens: (t: string) => `~${t} tokens`,
    estimate: 'Estimated: about 4 characters of English, or 1 character of other text, per token',
    estimated: '(estimate)',
    copy: 'Copy',
    copied: 'Copied',
    retry: 'Retry',
    loading: 'Loading output…',
    missing: 'This output was not saved',
    denied: 'Only the owner can see this output',
    error: 'Couldn’t load the output',
    truncated: (size: string) =>
      size ? `Showing the start only — the full output is ${size}` : 'Showing the start only',
    size: 'Size',
    output: 'Output',
  },
  ko: {
    skills: (n: number) => `사용한 스킬 ${n}개`,
    tokens: (t: string) => `~${t} 토큰`,
    estimate: '추정치 — 영문 4자 또는 그 밖의 글자 1자를 1토큰으로 셈',
    estimated: '(추정)',
    copy: '복사',
    copied: '복사됨',
    retry: '다시 시도',
    loading: '원본 출력 불러오는 중…',
    missing: '원본 출력이 저장되어 있지 않습니다',
    denied: '소유자만 볼 수 있는 출력이에요',
    error: '원본 출력을 불러오지 못했어요',
    truncated: (size: string) => (size ? `앞부분만 표시 — 원본 ${size}` : '앞부분만 표시'),
    size: '크기',
    output: '출력',
  },
};

const langOf = (lang?: ActivityLang): ActivityLang => (lang === 'ko' ? 'ko' : 'en');

const isSysKind = (kind: string): kind is SysKind => Object.hasOwn(SYS_ICONS, kind);

/**
 * Short word for a system kind: Compacted / Restarted / Retried / Goal / Scheduled / Background
 * (ko: 압축 / 재시작 / 재시도 / 목표 / 예약 / 백그라운드). Unknown kinds: the kind itself, escaped by the caller.
 */
export function sysKindLabel(kind: string, lang?: ActivityLang): string {
  const k = String(kind ?? '');
  return isSysKind(k) ? SYS_WORDS[langOf(lang)][k] : k;
}

/** `<span class="sys-badge" data-kind="…">` icon + word (or `label`). Escaped. */
export function sysBadgeHtml(kind: string, lang?: ActivityLang, label?: string): string {
  const k = String(kind ?? '');
  const glyph = icon(isSysKind(k) ? SYS_ICONS[k] : 'gear', { size: 12, class: 'sys-badge-icon' });
  const word = label === undefined || label === null || label === '' ? sysKindLabel(k, lang) : String(label);
  return `<span${attrs({ class: 'sys-badge', 'data-kind': k })}>${glyph}<span class="sys-badge-word">${esc(word)}</span></span>`;
}

export interface SkillBadge {
  name: string;
  /** Token count. Default: `estimateTokens(text)` when text is given. */
  tokens?: number;
  /** The skill's text, shown in its pane. */
  text?: string;
}

/**
 * Rough token estimate the way the dashboard does it: about 4 ASCII characters per token, every other character
 * (Hangul, CJK, emoji) one token; rounded up.
 */
export function estimateTokens(text: string): number {
  const s = String(text ?? '');
  let ascii = 0;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) < 128) ascii++;
  return Math.ceil(ascii / 4 + (s.length - ascii));
}

/** An id fragment from a host key: letters, digits, `_` and `-` only (never empty). */
export function activityId(keyPrefix: string): string {
  const s = String(keyPrefix ?? '').replace(/[^A-Za-z0-9_-]/g, '_');
  return s || 'act';
}

function skillTokens(s: SkillBadge): number | undefined {
  const t = Number(s.tokens);
  if (s.tokens !== undefined && s.tokens !== null && Number.isFinite(t) && t >= 0) return t;
  return s.text ? estimateTokens(s.text) : undefined;
}

/**
 * A row of skill chips `<button class="skill-badge" data-skill="i" aria-expanded aria-controls>` name · ~1.2K tokens,
 * plus the open skill's pane `<div class="skill-pane" id=…>` with its text in a `<pre>`. `keyPrefix` makes ids and
 * `data-key` unique per owner; `idPrefix` (optional) sets the id stem instead — use it when two key prefixes could
 * clean up to the same id (`a:b` and `a_b`). The owner handles the click (toggle the open index).
 */
export function skillBadgesHtml(
  skills: SkillBadge[],
  opts: { lang?: ActivityLang; open?: number | null; keyPrefix: string; idPrefix?: string },
): string {
  const list = Array.isArray(skills) ? skills.filter((s) => s && typeof s === 'object') : [];
  if (!list.length) return '';
  const t = STRINGS[langOf(opts.lang)];
  const base = activityId(opts.idPrefix || opts.keyPrefix);
  const open = typeof opts.open === 'number' && opts.open >= 0 && opts.open < list.length ? opts.open : -1;
  let chips = '';
  list.forEach((s, i) => {
    const tok = skillTokens(s);
    chips += `<button${attrs({
      type: 'button',
      class: 'skill-badge',
      'data-skill': String(i),
      'data-key': `${opts.keyPrefix}:skill:${i}`,
      'aria-expanded': String(i === open),
      'aria-controls': `${base}-skill-${i}`,
      title: tok === undefined ? undefined : t.estimate,
    })}><span class="skill-name">${esc(s.name)}</span>${
      tok === undefined ? '' : `<span class="skill-tok">${esc(t.tokens(fmtTokens(tok)))}</span>`
    }</button>`;
  });
  let pane = '';
  if (open >= 0) {
    const s = list[open];
    const tok = skillTokens(s);
    pane = `<div${attrs({ class: 'skill-pane', id: `${base}-skill-${open}`, role: 'region', 'aria-label': s.name })}><div class="skill-pane-head"><span class="skill-name">${esc(
      s.name,
    )}</span>${tok === undefined ? '' : `<span class="skill-tok">${esc(`${t.tokens(fmtTokens(tok))} ${t.estimated}`)}</span>`}</div>${
      s.text ? `<pre class="skill-text">${esc(s.text)}</pre>` : ''
    }</div>`;
  }
  return `<div${attrs({ class: 'skill-badges', role: 'group', 'aria-label': t.skills(list.length) })}>${chips}</div>${pane}`;
}

export interface RawView {
  state: 'loading' | 'ready' | 'missing' | 'denied' | 'error';
  /** The output (state ready). */
  text?: string;
  /** Size of the full output in bytes. Default: the UTF-8 size of `text`. */
  bytes?: number;
  /** Only the start of the output is held (`bytes` is the full size). */
  truncated?: boolean;
  /** One quiet line: under the output when ready, instead of the default line otherwise. */
  note?: string;
  /** Offer Retry. Default: true for state error. */
  canRetry?: boolean;
}

/** 0 B · 812 B · 12.3 KiB · 1.2 MiB · 3.0 GiB. */
export function formatBytes(n: number): string {
  const v = Math.max(0, Number(n) || 0);
  if (v < 1024) return `${Math.round(v)} B`;
  if (v < 1024 ** 2) return `${(v / 1024).toFixed(1)} KiB`;
  if (v < 1024 ** 3) return `${(v / 1024 ** 2).toFixed(1)} MiB`;
  return `${(v / 1024 ** 3).toFixed(1)} GiB`;
}

/** UTF-8 size of a string (no TextEncoder needed). */
export function utf8Bytes(text: string): number {
  const s = String(text ?? '');
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

/**
 * The raw output viewer: a bar (size, Copy `.raw-copy`, Retry `.raw-retry` when it can), the `<pre class="raw-text">`,
 * the note / truncation line, and calm state lines for loading / missing / denied / error. Owners wire the buttons
 * (Copy → clipboard + “Copied” for 1.5 s + notify ui-copy; Retry → emit ui-retry).
 */
export function rawViewHtml(view: RawView, opts: { lang?: ActivityLang; keyPrefix: string; copied?: boolean }): string {
  const t = STRINGS[langOf(opts.lang)];
  const v = view ?? { state: 'missing' };
  const state = (['loading', 'ready', 'missing', 'denied', 'error'] as const).includes(v.state) ? v.state : 'missing';
  const retry = v.canRetry ?? state === 'error';
  const retryBtn = retry
    ? `<button${attrs({ type: 'button', class: 'raw-btn raw-retry', 'data-key': `${opts.keyPrefix}:retry` })}>${icon(
        'refresh',
        { size: 12 },
      )}<span>${esc(t.retry)}</span></button>`
    : '';
  const note = v.note === undefined || v.note === null || v.note === '' ? '' : String(v.note);
  if (state !== 'ready') {
    const line =
      state === 'loading'
        ? `<span class="raw-spin" aria-hidden="true"></span><span>${esc(note || t.loading)}</span>`
        : `${icon(state === 'error' ? 'alert' : 'info', { size: 14, class: 'raw-line-icon' })}<span>${esc(
            note || t[state],
          )}</span>`;
    return `<div${attrs({
      class: 'raw',
      'data-state': state,
      'aria-busy': state === 'loading' ? 'true' : undefined,
    })}><p class="raw-line">${line}${retryBtn}</p></div>`;
  }
  const text = String(v.text ?? '');
  const bytes = Number.isFinite(Number(v.bytes)) && v.bytes !== undefined ? Number(v.bytes) : utf8Bytes(text);
  const copied = !!opts.copied;
  const copy = `<button${attrs({
    type: 'button',
    class: 'raw-btn raw-copy',
    'data-key': `${opts.keyPrefix}:copy`,
    'data-copied': copied,
  })}>${icon(copied ? 'check' : 'copy', { size: 12 })}<span>${esc(copied ? t.copied : t.copy)}</span></button>`;
  const lines: string[] = [];
  if (v.truncated) lines.push(t.truncated(v.bytes === undefined ? '' : formatBytes(bytes)));
  if (note) lines.push(note);
  return `<div class="raw" data-state="ready"><div class="raw-bar"><span${attrs({ class: 'raw-size', title: t.size })}>${esc(
    formatBytes(bytes),
  )}</span><span class="raw-actions">${copy}${retryBtn}</span></div><pre${attrs({
    class: 'raw-text',
    tabindex: '0',
    'aria-label': t.output,
  })}>${esc(text)}</pre>${lines.map((l) => `<p class="raw-note">${esc(l)}</p>`).join('')}</div>`;
}

/** CSS for `.sys-badge`, `.skill-badge(s)`, `.skill-pane` and `.raw-*` — tokens and color-mix only. */
export const activityCss = `
.sys-badge {
  flex: none; display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 7px; border-radius: 6px;
  background: var(--ib-pill); color: var(--ib-text-2); font-size: 11.5px; font-weight: 600; line-height: 1; white-space: nowrap;
}
.sys-badge-icon { flex: none; width: 12px; height: 12px; color: var(--ib-muted); }
.sys-badge[data-kind="restart"], .sys-badge[data-kind="retry"] {
  background: color-mix(in srgb, var(--st-wait) calc(14% * var(--chroma)), color-mix(in srgb, var(--ib-card) calc(100% * var(--chroma)), var(--ib-pill))); color: color-mix(in srgb, var(--st-wait) calc(70% * var(--chroma)), color-mix(in srgb, var(--ib-text) calc(100% * var(--chroma)), var(--ib-text-2)));
}
.sys-badge[data-kind="restart"] .sys-badge-icon, .sys-badge[data-kind="retry"] .sys-badge-icon { color: color-mix(in srgb, currentColor calc(100% * var(--chroma)), var(--st-wait)); }
.skill-badges { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
.skill-badge {
  display: inline-flex; align-items: center; gap: 6px; max-width: 100%; min-width: 0; height: 24px; padding: 0 9px;
  border: 1px solid var(--ib-card-border); border-radius: 999px; background: var(--ib-pill); color: var(--ib-text);
  font: inherit; font-size: 12px; font-weight: 500; line-height: 1; white-space: nowrap; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background-color var(--dur-press) ease, border-color var(--dur-press) ease, box-shadow var(--dur-press) ease, transform var(--dur-press) var(--ease-out);
}
.skill-badge[aria-expanded="true"] { background: var(--ib-seg-on); box-shadow: var(--ib-shadow); }
.skill-badge:active:not(:disabled):not(:focus-visible) { transform: scale(0.97); }
.skill-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.skill-tok { flex: none; color: var(--ib-muted); font-size: 11.5px; font-variant-numeric: tabular-nums; }
.skill-pane { margin-top: 8px; min-width: 0; }
.skill-pane-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; font-size: 12px; font-weight: 600; color: var(--ib-text); }
.skill-text, .raw-text {
  margin: 0; max-height: 320px; overflow: auto; padding: 10px 12px; border-radius: 8px;
  background: color-mix(in srgb, var(--ib-pill) 60%, var(--ib-card)); color: var(--ib-text);
  font-family: var(--mono); font-size: 12px; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; tab-size: 2;
}
.raw { min-width: 0; }
.raw-bar { display: flex; align-items: center; gap: 8px; min-height: 28px; margin-bottom: 6px; }
.raw-size { color: var(--ib-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.raw-actions { display: inline-flex; gap: 4px; margin-left: auto; }
.raw-btn {
  display: inline-flex; align-items: center; gap: 5px; min-height: 26px; padding: 3px 9px; border: 1px solid transparent;
  border-radius: 8px; background: transparent; color: var(--ib-text-2); font: inherit; font-size: 12px; font-weight: 500; line-height: 1.2;
  -webkit-tap-highlight-color: transparent;
  transition: background-color var(--dur-press) ease, color var(--dur-press) ease, transform var(--dur-press) var(--ease-out);
}
.raw-btn svg { flex: none; width: 12px; height: 12px; }
.raw-btn[data-copied] { color: var(--ib-text); }
.raw-btn:active:not(:disabled):not(:focus-visible) { transform: scale(0.97); }
.raw-note { margin: 6px 0 0; color: var(--ib-muted); font-size: 12px; line-height: 1.45; }
.raw-line { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 0; min-height: 28px; color: var(--ib-muted); font-size: 12.5px; line-height: 1.45; }
.raw-line-icon { flex: none; width: 14px; height: 14px; }
.raw[data-state="error"] .raw-line-icon { color: color-mix(in srgb, var(--st-fail) calc(70% + 30% * (1 - var(--chroma))), var(--ib-text)); }
.raw-line .raw-retry { border-color: var(--ib-card-border); background: var(--ib-card); }
.raw-spin {
  flex: none; width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid color-mix(in srgb, var(--ib-muted) 35%, transparent);
  border-top-color: var(--ib-muted); animation: act-spin 0.9s linear infinite;
}
@keyframes act-spin { to { transform: rotate(360deg); } }
@media (hover: hover) and (pointer: fine) {
  .skill-badge:hover { border-color: var(--ib-muted); }
  .raw-btn:hover { background: var(--ib-pill); color: var(--ib-text); }
}
@media (pointer: coarse), (max-width: 639px) {
  .raw-btn { min-height: 44px; }
  .skill-badge { position: relative; }
  .skill-badge::after { content: ''; position: absolute; inset: -10px 0; }
}
@media (prefers-reduced-motion: reduce) {
  .skill-badge:active, .raw-btn:active { transform: none; }
  .raw-spin { animation-duration: 0.9s !important; animation-iteration-count: infinite !important; }
}
`;
