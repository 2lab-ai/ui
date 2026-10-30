import { define, UiElement } from '../../core/element';
import { fmtDuration } from '../../core/format';
import { attrs, cls, esc, escAttr, safeHref } from '../../core/html';
import { morphInto } from '../../core/morph';
import { icon } from '../../icons/icons';
import { styles } from './styles';

/** The status words of `<ui-agent-run>`'s head chip. `running` and `waiting` are live: the elapsed clock ticks. */
export type StatusBarStatus = 'running' | 'waiting' | 'idle' | 'done' | 'failed' | 'stopped';

export interface StatusBarAction {
  id: string;
  label: string;
  /** A glyph from the icon set (`stop`, `trash`, `refresh` …). Unknown names draw nothing. */
  icon?: string;
  /** `danger`: destructive — it takes two presses within 4 s (the first arms it: “Press again”). */
  tone?: 'danger';
  /** The surface’s one ink primary (danger + primary = the red fill). */
  primary?: boolean;
  /** `true` disables the action; a string disables it and says why (tooltip). */
  disabled?: boolean | string;
  /** A request for this action is in flight: spinner, aria-busy, not pressable. */
  busy?: boolean;
}

/** A link at the end of the row (a thread, a log): opens in a new tab. */
export interface StatusBarLink {
  href: string;
  label: string;
  /** The `ui-action` id. Default `link`. */
  id?: string;
}

export interface StatusBarData {
  status: StatusBarStatus;
  /** Replace status words, e.g. `{ waiting: 'Waiting for review' }`. */
  words?: Partial<Record<StatusBarStatus, string>>;
  /** Epoch ms the run (or turn) started: `Started 14:05 · 3m 12s`, ticking while running / waiting. */
  startedAt?: number;
  /** Epoch ms it ended: a finished run shows its run time instead of a clock. */
  endedAt?: number;
  /** Accumulated active time, shown as `Active 6m 00s` when the run is not live. */
  activeMs?: number;
  actions?: StatusBarAction[];
  link?: StatusBarLink;
}

/** `ui-action` detail. `href` is set for the link. */
export interface StatusBarActionDetail {
  id: string;
  href?: string;
}

/** Which time the row shows, from the data alone. */
export type StatusBarTime =
  | { kind: 'live'; since: number }
  | { kind: 'ran'; since: number; ms: number }
  | { kind: 'active'; ms: number }
  | { kind: 'started'; since: number }
  | { kind: 'none' };

/** The first press of a danger action arms it for this long. */
export const ARM_MS = 4000;

const STRINGS = {
  en: {
    status: {
      running: 'Running',
      waiting: 'Needs input',
      idle: 'Idle',
      done: 'Done',
      failed: 'Failed',
      stopped: 'Stopped',
    } as Record<StatusBarStatus, string>,
    statusSay: (w: string) => `Status: ${w}`,
    started: (t: string) => `Started ${t}`,
    liveTitle: 'Started · elapsed',
    ranTitle: 'Started · run time',
    startTitle: 'Started',
    active: 'Active',
    activeTitle: 'Active time',
    armed: 'Press again',
    armedLabel: (l: string) => `Press again to confirm: ${l}`,
    newTab: (l: string) => `${l} (opens in a new tab)`,
    group: 'Status',
  },
  ko: {
    status: {
      running: '실행 중',
      waiting: '입력 대기',
      idle: '대기',
      done: '완료',
      failed: '실패',
      stopped: '중단',
    } as Record<StatusBarStatus, string>,
    statusSay: (w: string) => `상태: ${w}`,
    started: (t: string) => `시작 ${t}`,
    liveTitle: '시작 · 경과',
    ranTitle: '시작 · 실행 시간',
    startTitle: '시작',
    active: '활성',
    activeTitle: '활성 시간',
    armed: '한 번 더 눌러 확인',
    armedLabel: (l: string) => `한 번 더 눌러 확인: ${l}`,
    newTab: (l: string) => `${l} (새 탭에서 열림)`,
    group: '상태',
  },
};
type Strings = (typeof STRINGS)['en'];

const SPIN = '<span class="sb-spin" aria-hidden="true"></span>';
const DOT =
  '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><circle cx="8" cy="8" r="3"/></svg>';
const STATUS_ICON: Record<StatusBarStatus, string> = {
  running: SPIN,
  waiting: icon('clock', { size: 12, stroke: 1.75 }),
  idle: DOT,
  done: icon('check', { size: 12, stroke: 2 }),
  failed: icon('cross', { size: 12, stroke: 2 }),
  stopped: icon('stop', { size: 12, stroke: 1.75 }),
};
const LIVE: ReadonlySet<string> = new Set(['running', 'waiting']);

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// ── Pure helpers ────────────────────────────────────────────────────────────

/** A known status, else `idle`. */
export function statusBarStatus(s: unknown): StatusBarStatus {
  return typeof s === 'string' && Object.hasOwn(STATUS_ICON, s) ? (s as StatusBarStatus) : 'idle';
}

/** Running and waiting are live: their elapsed time ticks. */
export function statusBarIsLive(s: unknown): boolean {
  return LIVE.has(statusBarStatus(s));
}

/**
 * The time to show: live elapsed while running / waiting with a start; a finished run’s run time; else the
 * accumulated active time; else just the start time; else nothing.
 */
export function statusBarTime(d: Pick<StatusBarData, 'status' | 'startedAt' | 'endedAt' | 'activeMs'>): StatusBarTime {
  const start = num(d.startedAt);
  const end = num(d.endedAt);
  if (start && statusBarIsLive(d.status)) return { kind: 'live', since: start };
  if (start && end > start) return { kind: 'ran', since: start, ms: end - start };
  if (num(d.activeMs)) return { kind: 'active', ms: num(d.activeMs) };
  if (start) return { kind: 'started', since: start };
  return { kind: 'none' };
}

/** Time of day on a 24-hour clock in local time: `14:05`. */
export function statusTimeOfDay(ts: number): string {
  if (!num(ts)) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Fill an element’s text without replacing its text node (screen readers and selections keep their place). */
function setText(el: Element, txt: string): void {
  const n = el.firstChild;
  if (n && n.nodeType === 3 && !n.nextSibling) {
    if (n.nodeValue !== txt) n.nodeValue = txt;
  } else if (el.textContent !== txt) el.textContent = txt;
}

/**
 * `<ui-status-bar>` — a session’s status row: the status (icon + word in the st-* tones), when it started with a
 * live elapsed clock, the host’s actions (a danger action takes two presses), an optional link that opens in a new
 * tab, and a default slot for anything else. Wraps cleanly in a narrow container.
 */
export class UiStatusBar extends UiElement<StatusBarData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang'];
  }

  readonly #live: HTMLElement;
  #timer: ReturnType<typeof setInterval> | 0 = 0;
  /** The danger action armed by a first press ('' = none). */
  #armed = '';
  #armTimer: ReturnType<typeof setTimeout> | 0 = 0;
  /** Danger actions confirmed and not cancelled: busy until the host sends new data. */
  #pending = new Set<string>();
  #seen: StatusBarData | undefined;
  #prevStatus = '';

  constructor() {
    super();
    this.#live = document.createElement('div');
    this.#live.className = 'sr-only';
    this.#live.setAttribute('role', 'status');
    this.#live.setAttribute('aria-live', 'polite');
    this.root.append(this.#live);
    this.root.addEventListener('click', (e) => this.#onClick(e));
    this.root.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Escape' && this.#armed) {
        e.stopPropagation();
        this.#disarm();
      }
    });
    // Focus leaving the armed button disarms it: a later Enter must not confirm.
    this.root.addEventListener('focusout', (e) => {
      if (!this.#armed) return;
      const from = (e.target as Element | null)?.closest?.('.sb-btn') as HTMLElement | null;
      if (!from || from.dataset.id !== this.#armed) return;
      const to = ((e as FocusEvent).relatedTarget as Element | null)?.closest?.('.sb-btn') as HTMLElement | null;
      if (to && to.dataset.id === this.#armed) return;
      this.#disarm();
    });
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override disconnectedCallback(): void {
    this.#stopTimer();
    this.#disarm(false);
  }

  get #t(): Strings {
    return this.getAttribute('lang') === 'ko' ? STRINGS.ko : STRINGS.en;
  }

  // ── Intent ────────────────────────────────────────────────────────────────

  #onClick(e: Event): void {
    const target = e.target as Element | null;
    const link = target?.closest?.('.sb-link');
    if (link) {
      const l = this.data?.link;
      if (l && !this.emit<StatusBarActionDetail>('ui-action', { id: l.id ?? 'link', href: l.href })) e.preventDefault();
      return;
    }
    const btn = target?.closest?.('.sb-btn') as HTMLButtonElement | null;
    if (btn && !btn.disabled && btn.dataset.id !== undefined) this.#press(btn.dataset.id);
  }

  #press(id: string): void {
    const a = this.data?.actions?.find((x) => x.id === id);
    if (!a || a.disabled || a.busy || this.#pending.has(id)) return;
    if (a.tone !== 'danger') {
      this.emit<StatusBarActionDetail>('ui-action', { id });
      return;
    }
    if (this.#armed !== id) {
      this.#armed = id;
      clearTimeout(this.#armTimer);
      this.#armTimer = setTimeout(() => this.#disarm(), ARM_MS);
      this.#say(this.#t.armedLabel(a.label));
      this.requestRender();
      return;
    }
    this.#disarm(false);
    if (this.emit<StatusBarActionDetail>('ui-action', { id })) this.#pending.add(id);
    this.requestRender();
  }

  #disarm(render = true): void {
    if (this.#armTimer) clearTimeout(this.#armTimer);
    this.#armTimer = 0;
    if (!this.#armed) return;
    this.#armed = '';
    if (render) this.requestRender();
  }

  #say(msg: string): void {
    this.#live.textContent = msg;
  }

  // ── Render cycle ──────────────────────────────────────────────────────────

  /** Patch the live tree: the chip keeps its node (its tone fades), the clock keeps its text node, focus stays. */
  protected override update(): void {
    const d = this.data;
    if (d !== this.#seen) this.#observe(d);
    morphInto(this.content, this.render());
    this.updated();
  }

  #observe(d: StatusBarData | undefined): void {
    this.#seen = d;
    this.#pending.clear();
    const st = d ? statusBarStatus(d.status) : '';
    if (st && this.#prevStatus && st !== this.#prevStatus) this.#say(this.#t.statusSay(this.#word(d, st)));
    this.#prevStatus = st;
    // An armed action that is gone, disabled or busy now cannot be confirmed.
    const a = this.#armed ? d?.actions?.find((x) => x.id === this.#armed) : undefined;
    if (this.#armed && (!a || a.disabled || a.busy || a.tone !== 'danger')) this.#disarm(false);
  }

  #word(d: StatusBarData | undefined, st: StatusBarStatus): string {
    const custom = d?.words?.[st];
    return typeof custom === 'string' && custom ? custom : this.#t.status[st];
  }

  protected render(): string {
    const d = this.data;
    if (!d) return '';
    const t = this.#t;
    const st = statusBarStatus(d.status);
    const chip = `<span class="sb-chip is-${st}" part="status"><span class="sb-icon" aria-hidden="true">${STATUS_ICON[st]}</span><span class="sb-word">${esc(this.#word(d, st))}</span></span>`;
    const actions = this.#actions(d, t);
    return `<div class="sb" role="group" aria-label="${escAttr(t.group)}" data-status="${st}">${chip}${this.#time(d, t)}<slot></slot>${
      actions ? `<span class="sb-actions" part="actions">${actions}</span>` : ''
    }</div>`;
  }

  #time(d: StatusBarData, t: Strings): string {
    const tm = statusBarTime(d);
    if (tm.kind === 'none') return '';
    if (tm.kind === 'active')
      return `<span class="sb-time" title="${escAttr(t.activeTitle)}">${esc(t.active)} <span class="sb-dur">${esc(fmtDuration(tm.ms))}</span></span>`;
    const clock = `<span class="sb-clock" aria-hidden="true">${icon('clock', { size: 13 })}</span>`;
    const start = `<span class="sb-start">${esc(t.started(statusTimeOfDay(tm.since)))}</span>`;
    // Spaces between the parts keep the text readable as text (a flex row drops them visually).
    const dot = ' <span class="sb-dot" aria-hidden="true">·</span> ';
    if (tm.kind === 'started') return `<span class="sb-time" title="${escAttr(t.startTitle)}">${clock}${start}</span>`;
    if (tm.kind === 'ran')
      return `<span class="sb-time" title="${escAttr(t.ranTitle)}">${clock}${start}${dot}<span class="sb-dur">${esc(fmtDuration(tm.ms))}</span></span>`;
    return `<span class="sb-time" title="${escAttr(t.liveTitle)}">${clock}${start}${dot}<span class="sb-tick" data-since="${tm.since}">${esc(
      fmtDuration(Date.now() - tm.since),
    )}</span></span>`;
  }

  #actions(d: StatusBarData, t: Strings): string {
    let out = '';
    const l = d.link;
    const href = l && typeof l.href === 'string' ? safeHref(l.href) : '#';
    if (l && href !== '#')
      out += `<a class="sb-link" href="${href}" target="_blank" rel="noopener noreferrer" data-key="sb-link" data-mk="sb-link" aria-label="${escAttr(
        t.newTab(String(l.label ?? '')),
      )}">${esc(l.label)}${icon('external', { size: 12 })}</a>`;
    for (const a of d.actions ?? []) {
      if (!a || typeof a.id !== 'string') continue;
      const busy = !!a.busy || this.#pending.has(a.id);
      const why = typeof a.disabled === 'string' ? a.disabled : '';
      const armed = this.#armed === a.id;
      const state = busy ? 'busy' : armed ? 'armed' : 'idle';
      const label = armed ? t.armed : String(a.label ?? '');
      const glyph = busy ? SPIN : armed ? icon('alert', { size: 14 }) : a.icon ? icon(a.icon, { size: 14 }) : '';
      out += `<button${attrs({
        type: 'button',
        class: cls('sb-btn', a.primary && 'is-primary', a.tone === 'danger' && 'is-danger'),
        'data-id': a.id,
        'data-key': `sb-act:${a.id}`,
        'data-mk': `sb-act:${a.id}`,
        'data-armed': armed,
        disabled: busy || !!a.disabled,
        'aria-busy': busy ? 'true' : undefined,
        'aria-label': armed ? t.armedLabel(String(a.label ?? '')) : undefined,
        title: why || undefined,
      })}>${glyph ? `<span class="sb-bi" data-mk="i-${state}">${glyph}</span>` : ''}<span class="sb-bt" data-mk="t-${state}">${esc(label)}</span></button>`;
    }
    return out;
  }

  protected override updated(): void {
    this.#tick();
    const live = !!this.$('[data-since]');
    if (live && !this.#timer && this.isConnected) this.#timer = setInterval(() => this.#tick(), 1000);
    else if (!live) this.#stopTimer();
  }

  #stopTimer(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = 0;
  }

  /** 1 Hz: the elapsed clock is one text node, updated in place — never a re-render. */
  #tick(): void {
    const now = Date.now();
    for (const el of this.$$('[data-since]')) setText(el, fmtDuration(now - (Number(el.dataset.since) || now)));
  }
}

define('ui-status-bar', UiStatusBar);

declare global {
  interface HTMLElementTagNameMap {
    'ui-status-bar': UiStatusBar;
  }
}
