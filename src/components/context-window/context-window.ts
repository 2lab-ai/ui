import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { fmtTokens } from '../../core/format';
import { esc, escAttr } from '../../core/html';
import { styles } from './styles';

/** What fills a model's context window, in prompt order. Tokens of the last request. */
export interface ContextParts {
  /** Cached prefix read back (cache read). */
  cacheRead?: number;
  /** Newly cached this request (cache write). */
  cacheWrite?: number;
  /** Uncached input tail. */
  input?: number;
  /** The last response. */
  output?: number;
}

/** Host-owned state of a compaction request. The component adds the two-press confirm itself. */
export type CompactState = 'idle' | 'sending' | 'sent' | 'queued' | 'observed' | 'failed';

export interface ContextWindowData {
  /** Model id shown as a chip (e.g. `opus-4-5[1m]`). */
  model?: string;
  /** Window size in tokens. Nothing renders without it. */
  window: number;
  parts?: ContextParts;
  /** The usage is one total that cannot be split into cache categories. */
  unsplit?: { tokens: number; kind: 'compact' | 'unknown' };
  /** Auto-compaction threshold in tokens (drawn on the field, drives the warning level). */
  autoCompactAt?: number;
  /** The next input will auto-compact. */
  compactPending?: boolean;
  /** Last compaction's before/after, shown once a compaction is observed. */
  lastCompact?: { preTokens: number; postTokens: number };
  /** `true` shows the compact action; a string shows it disabled with that reason. Default: hidden. */
  canCompact?: boolean | string;
  compactState?: CompactState;
}

export type ContextLevel = 'ok' | 'warn' | 'full';

export const CELLS = 216;
const ARM_MS = 4000;
const ROLL_MS = 640;

const STRINGS = {
  en: {
    title: 'Context',
    of: (w: string) => `/ ${w} tokens`,
    share: (label: string, pct: string) => `${label} · ${pct}% of window`,
    parts: {
      read: 'Cached context (read)',
      write: 'Newly cached (write)',
      input: 'Uncached input',
      output: 'Last output',
    },
    unsplit: { compact: 'Context after compaction', unknown: 'Context (unsplit)' },
    mark: 'Auto-compact point',
    sr: (u: string, w: string, p: string, a: string) =>
      `Context ${u} of ${w} tokens used, ${p}${a ? `, auto-compacts at ${a}` : ''}`,
    left: (n: string) => `${n} until auto-compact`,
    soon: (n: string) => `Auto-compact soon · ${n} left`,
    over: 'Past the auto-compact point',
    free: (n: string) => `${n} left in window`,
    pending: 'Compacts on the next input',
    sending: 'Sending compact request…',
    sent: 'Compact requested — waiting',
    queued: 'Compact requested — runs after this turn',
    observed: 'Compaction observed',
    saved: (n: string, a: string, b: string) => `Compaction observed · saved <b>${n}</b> (${a} → ${b})`,
    failed: 'Compact request failed',
    armed: 'Earlier turns become a summary',
    armedSr: 'Press again to compact — earlier turns become a summary',
    act: { idle: 'Compact now', armed: 'Press again', sending: 'Sending', sent: 'Requested', done: 'Compacted' },
    actLabel: (l: string) => `${l} — compact context`,
  },
  ko: {
    title: '컨텍스트',
    of: (w: string) => `/ ${w} 토큰`,
    share: (label: string, pct: string) => `${label} · 창의 ${pct}%`,
    parts: {
      read: '이전 맥락 (캐시 읽기)',
      write: '새로 캐시 (캐시 쓰기)',
      input: '캐시 안 된 입력',
      output: '마지막 출력',
    },
    unsplit: { compact: '압축 후 맥락', unknown: '맥락 (분류 없음)' },
    mark: '자동 압축 지점',
    sr: (u: string, w: string, p: string, a: string) =>
      `컨텍스트 ${u} / ${w} 토큰 사용, ${p}${a ? `, 자동 압축 ${a}` : ''}`,
    left: (n: string) => `자동 압축까지 ${n}`,
    soon: (n: string) => `자동 압축 임박 · ${n} 남음`,
    over: '자동 압축 지점을 넘음',
    free: (n: string) => `창에 ${n} 남음`,
    pending: '다음 입력 때 자동 압축',
    sending: '압축 요청 보내는 중…',
    sent: '압축 요청 보냄 — 압축을 기다리는 중',
    queued: '압축 요청 보냄 — 지금 턴이 끝나면 압축',
    observed: '새 압축 관측됨',
    saved: (n: string, a: string, b: string) => `새 압축 관측됨 · <b>${n}</b> 줄임 (${a} → ${b})`,
    failed: '압축 요청 실패',
    armed: '지난 대화가 요약으로 줄어듭니다',
    armedSr: '한 번 더 누르면 압축 — 지난 대화가 요약으로 줄어듭니다',
    act: {
      idle: '지금 압축',
      armed: '한 번 더 눌러 압축',
      sending: '보내는 중',
      sent: '요청 보냄',
      done: '압축 관측됨',
    },
    actLabel: (l: string) => `${l} — 컨텍스트 압축`,
  },
};
type Strings = (typeof STRINGS)['en'];

const PART_ORDER: Array<[key: 'read' | 'write' | 'input' | 'output', field: keyof ContextParts, color: string]> = [
  ['read', 'cacheRead', 'var(--cw-c1)'],
  ['write', 'cacheWrite', 'var(--cw-c2)'],
  ['input', 'input', 'var(--cw-c3)'],
  ['output', 'output', 'var(--cw-c4)'],
];

const COMPACT_SVG =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 3l4 3.5L12 3M4 13l4-3.5 4 3.5"/></svg>';
const CHECK_SVG =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>';

interface Part {
  key: string;
  label: string;
  tokens: number;
  color: string;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const short = (n: number) => fmtTokens(n);

/** Parts in prompt order; zero parts are left out; an unsplit total is one row. */
export function contextParts(d: ContextWindowData, t: Strings = STRINGS.en): Part[] {
  if (d.unsplit) {
    const total = num(d.unsplit.tokens);
    return total > 0
      ? [{ key: 'total', label: t.unsplit[d.unsplit.kind] ?? t.unsplit.unknown, tokens: total, color: 'var(--cw-c1)' }]
      : [];
  }
  const out: Part[] = [];
  for (const [key, field, color] of PART_ORDER) {
    const tokens = num(d.parts?.[field]);
    if (tokens > 0) out.push({ key, label: t.parts[key], tokens, color });
  }
  return out;
}

/** Cell → part index (-1 free): cumulative rounding in part order, every non-empty part ≥ 1 cell. */
export function cellMap(parts: Array<{ tokens: number }>, limit: number, cells = CELLS): number[] {
  const out: number[] = [];
  const per = limit > 0 ? limit / cells : 0;
  let start = 0;
  let cum = 0;
  for (let i = 0; i < parts.length && per > 0; i++) {
    cum += parts[i].tokens;
    const end = Math.min(cells, Math.max(parts[i].tokens > 0 ? start + 1 : start, Math.round(cum / per)));
    for (let j = start; j < end; j++) out[j] = i;
    start = Math.max(start, end);
  }
  for (let k = start; k < cells; k++) out[k] = -1;
  return out;
}

/** First cell past the auto-compact point, -1 when none inside the window. */
export function markIndex(auto: number, limit: number, cells = CELLS): number {
  if (auto <= 0 || limit <= 0 || auto >= limit) return -1;
  return Math.max(0, Math.min(cells, Math.round(auto / (limit / cells))));
}

/** Warning level against the auto-compact point (≥80% warn, ≥95% full), else against the window (>60 / >80%). */
export function contextLevel(used: number, window: number, auto?: number, pending?: boolean): ContextLevel {
  if (pending) return 'full';
  const a = num(auto);
  if (used > 0 && a > 0) return used / a >= 0.95 ? 'full' : used / a >= 0.8 ? 'warn' : 'ok';
  const pct = window > 0 ? (used / window) * 100 : 0;
  return pct > 80 ? 'full' : pct > 60 ? 'warn' : 'ok';
}

/**
 * `<ui-context-window>` — what fills the model's context: 216 cells (one per window/216 tokens) coloured by
 * cache category in prompt order, the auto-compact point on the field, a level against that point, and an
 * optional two-press "Compact now" action (`ui-compact`).
 */
export class UiContextWindow extends UiElement<ContextWindowData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang'];
  }

  #armedAt = 0;
  #armTimer = 0;
  #hot = '';
  #shown = -1;
  #raf = 0;

  attributeChangedCallback(): void {
    this.requestRender();
  }

  get #t(): Strings {
    return this.getAttribute('lang') === 'ko' ? STRINGS.ko : STRINGS.en;
  }

  constructor() {
    super();
    this.root.addEventListener('pointerover', (e) => {
      const pe = e as PointerEvent;
      if (pe.pointerType && pe.pointerType !== 'mouse') return;
      const el = (e.target as Element | null)?.closest?.('.cw-part[data-part], .cw-cell[data-part]');
      const key = el?.getAttribute('data-part') ?? '';
      if (key !== this.#hot) {
        this.#hot = key;
        this.#applyHot();
      }
    });
    this.root.addEventListener('pointerleave', () => {
      if (!this.#hot) return;
      this.#hot = '';
      this.#applyHot();
    });
    this.root.addEventListener('click', (e) => {
      if ((e.target as Element | null)?.closest?.('.cw-compact')) this.#press();
    });
    this.root.addEventListener('keydown', (e) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Escape' && this.#armedAt) {
        ke.stopPropagation();
        this.#disarm();
      }
    });
  }

  override disconnectedCallback(): void {
    clearTimeout(this.#armTimer);
    cancelAnimationFrame(this.#raf);
  }

  #press(): void {
    const d = this.data;
    if (!d || d.canCompact !== true) return;
    const st = d.compactState ?? 'idle';
    if (st === 'sending' || st === 'sent' || st === 'queued') return;
    if (this.#armedAt && Date.now() - this.#armedAt < ARM_MS) {
      this.#disarm(false);
      this.emit('ui-compact', {});
      this.requestRender();
      return;
    }
    this.#armedAt = Date.now();
    clearTimeout(this.#armTimer);
    this.#armTimer = window.setTimeout(() => this.#disarm(), ARM_MS);
    this.requestRender();
  }

  #disarm(render = true): void {
    this.#armedAt = 0;
    clearTimeout(this.#armTimer);
    if (render) this.requestRender();
  }

  protected render(): string {
    const d = this.data;
    const t = this.#t;
    const win = num(d?.window);
    if (!d || !(win > 0)) return '';
    const parts = contextParts(d, t);
    const used = parts.reduce((s, p) => s + p.tokens, 0);
    const auto = num(d.autoCompactAt);
    const level = contextLevel(used, win, auto, d.compactPending);
    const state = d.compactState ?? 'idle';
    const busy = state === 'sending' || state === 'sent' || state === 'queued';
    const map = cellMap(parts, win);
    const mark = markIndex(auto, win);
    let cells = '';
    for (let n = 0; n < CELLS; n++) {
      const p = map[n] >= 0 ? parts[map[n]] : null;
      cells += `<i class="cw-cell" style="--i:${n}${p ? `;--c:${p.color}` : ''}"${p ? ` data-part="${p.key}"` : ''}${
        mark >= 0 && n >= mark ? ' data-past' : ''
      }${p && busy ? ' data-busy' : ''}></i>`;
    }
    let rows = '';
    for (const p of parts) {
      const share = (p.tokens / win) * 100;
      rows += `<li class="cw-part" data-part="${p.key}" data-tok="${p.tokens}" data-of="${escAttr(
        t.share(p.label, share.toFixed(share < 10 ? 1 : 0)),
      )}"><i class="cw-sw" style="background:${p.color}"></i><span class="cw-label">${esc(p.label)}</span><span class="cw-val">${fmtTokens(p.tokens)}</span></li>`;
    }
    if (mark >= 0)
      rows += `<li class="cw-mark"><i class="cw-sw is-mark"></i><span class="cw-label">${esc(t.mark)}</span><span class="cw-val">${short(auto)}</span></li>`;
    const pct = `${Math.round(Math.min((used / win) * 100, 100))}%`;
    const ofTotal = t.of(short(win));
    const say = this.#say(d, used, auto, win, level, state, t);
    return `<section class="cw" role="group" aria-labelledby="cw-title" data-level="${level}">
<div class="cw-head"><span class="cw-title" id="cw-title">${esc(t.title)}</span>${d.model ? `<span class="cw-model">${esc(d.model)}</span>` : ''}</div>
<div class="cw-figure"><span class="cw-big" aria-hidden="true" data-to="${used}">${fmtTokens(this.#shown >= 0 ? this.#shown : used)}</span><span class="cw-of" aria-hidden="true" data-total="${escAttr(ofTotal)}">${esc(ofTotal)}</span><span class="cw-pill" aria-hidden="true">${pct}</span><span class="sr-only">${esc(t.sr(fmtTokens(used), short(win), pct, auto > 0 ? short(auto) : ''))}</span></div>
<div class="cw-field" aria-hidden="true">${cells}</div>
<ul class="cw-parts">${rows}</ul>
<div class="cw-foot"><span class="cw-say"><span class="cw-say-t${say.tone ? ` is-${say.tone}` : ''}">${say.html}</span></span><span class="sr-only" aria-live="polite">${say.announce ? (say.sr ?? say.html) : ''}</span>${this.#action(d, state, used, t)}</div>
</section>`;
  }

  #say(
    d: ContextWindowData,
    used: number,
    auto: number,
    win: number,
    level: ContextLevel,
    state: CompactState,
    t: Strings,
  ): { tone: string; html: string; sr?: string; announce?: boolean } {
    if (state === 'sending') return { tone: '', html: esc(t.sending), announce: true };
    if (state === 'sent') return { tone: '', html: esc(t.sent), announce: true };
    if (state === 'queued') return { tone: '', html: esc(t.queued), announce: true };
    if (this.#armedAt) return { tone: 'warn', html: esc(t.armed), sr: esc(t.armedSr), announce: true };
    if (state === 'failed') return { tone: 'fail', html: esc(t.failed), announce: true };
    const lc = d.lastCompact;
    if (state === 'observed') {
      if (lc && num(lc.preTokens) > num(lc.postTokens))
        return {
          tone: 'ok',
          html: t.saved(
            short(num(lc.preTokens) - num(lc.postTokens)),
            short(num(lc.preTokens)),
            short(num(lc.postTokens)),
          ),
          announce: true,
        };
      return { tone: 'ok', html: esc(t.observed), announce: true };
    }
    if (d.compactPending) return { tone: 'full', html: esc(t.pending), announce: true };
    const tone = level === 'full' ? 'full' : level === 'warn' ? 'warn' : '';
    if (auto > 0) {
      if (used >= auto) return { tone: 'full', html: esc(t.over) };
      if (level === 'full') return { tone: 'full', html: esc(t.soon(short(auto - used))) };
      return { tone, html: esc(t.left(short(auto - used))) };
    }
    return { tone, html: esc(t.free(short(Math.max(0, win - used)))) };
  }

  #action(d: ContextWindowData, state: CompactState, used: number, t: Strings): string {
    if (d.canCompact === undefined || d.canCompact === false || !(used > 0)) return '';
    const armed = !!this.#armedAt;
    const st =
      state === 'sending' || state === 'sent' || state === 'queued'
        ? 'busy'
        : state === 'observed'
          ? 'done'
          : armed
            ? 'armed'
            : 'idle';
    const label =
      state === 'sending'
        ? t.act.sending
        : state === 'sent' || state === 'queued'
          ? t.act.sent
          : st === 'done'
            ? t.act.done
            : st === 'armed'
              ? t.act.armed
              : t.act.idle;
    const icon =
      st === 'busy' ? '<span class="cw-spin" aria-hidden="true"></span>' : st === 'done' ? CHECK_SVG : COMPACT_SVG;
    const why = typeof d.canCompact === 'string' ? d.canCompact : '';
    const off = st === 'busy' || st === 'done' || !!why;
    return `<button type="button" class="cw-compact" data-key="cw-compact" data-state="${st}"${off ? ' disabled' : ''}${
      st === 'busy' ? ' aria-busy="true"' : ''
    }${why ? ` title="${escAttr(why)}"` : ''} aria-label="${escAttr(t.actLabel(label))}"><span class="cw-ci">${icon}</span><span class="cw-ct">${esc(label)}</span></button>`;
  }

  protected override updated(): void {
    this.#applyHot();
  }

  /** Hover lives outside the markup: the hot part's cells lift, its row lights, the figure rolls to the part. */
  #applyHot(): void {
    const cw = this.$('.cw');
    if (!cw) return;
    let key = this.#hot;
    const row = key ? cw.querySelector(`.cw-part[data-part="${key}"]`) : null;
    if (!row) key = '';
    cw.querySelector('.cw-field')?.toggleAttribute('data-hot', !!key);
    for (const c of Array.from(cw.querySelectorAll('.cw-cell[data-part]')))
      c.toggleAttribute('data-on', !!key && c.getAttribute('data-part') === key);
    for (const r of Array.from(cw.querySelectorAll('.cw-part, .cw-mark'))) {
      const mine = !!key && r.getAttribute('data-part') === key;
      r.toggleAttribute('data-hot', mine);
      r.toggleAttribute('data-dim', !!key && !mine);
    }
    const of = cw.querySelector('.cw-of');
    if (of) of.textContent = key ? (row?.getAttribute('data-of') ?? '') : (of.getAttribute('data-total') ?? '');
    const big = cw.querySelector<HTMLElement>('.cw-big');
    if (big) this.#roll(big, num(key ? row?.getAttribute('data-tok') : big.getAttribute('data-to')));
  }

  /** The big number rolls to its target (640ms, ease-out quart); first paint and reduced motion jump. */
  #roll(el: HTMLElement, to: number): void {
    cancelAnimationFrame(this.#raf);
    const from = this.#shown >= 0 ? this.#shown : to;
    if (from === to || prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      this.#shown = to;
      el.textContent = fmtTokens(to);
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ROLL_MS);
      this.#shown = from + (to - from) * (1 - (1 - p) ** 4);
      el.textContent = fmtTokens(this.#shown);
      this.#raf = p < 1 ? requestAnimationFrame(step) : 0;
    };
    this.#raf = requestAnimationFrame(step);
  }
}

define('ui-context-window', UiContextWindow);

declare global {
  interface HTMLElementTagNameMap {
    'ui-context-window': UiContextWindow;
  }
}
