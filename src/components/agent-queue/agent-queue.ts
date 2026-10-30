import { define, UiElement } from '../../core/element';
import { esc, escAttr } from '../../core/html';
import {
  type AgentQueueData,
  type AqAccount,
  type AqAccountState,
  type AqJob,
  type AqLane,
  type AqPoolState,
  type AqProvider,
  type AqRun,
  type AqRunStatus,
  type AqSection,
  type AqStack,
  accountStacks,
  advanceProvider,
  axisPos,
  clockLabel,
  countedAccounts,
  D7,
  DAY,
  type DayRuns,
  dayRuns,
  emptyReturnAt,
  exclusions,
  firstReturn,
  fmt1,
  fmtCount,
  fmtPct,
  gainWithin,
  HOUR,
  has5h,
  hm,
  jobRuns,
  LOW_PCT,
  limitedAccounts,
  type MeasureKey,
  nextRefill,
  niceMax,
  normalize,
  OK_STACK,
  orderJobs,
  plain,
  poolState,
  primaryKey,
  runBins,
  runKind,
  scheduleLabel,
  stripFolds,
  timelineMarks,
  upNext,
} from './logic';
import { STRINGS, type Strings, type TimeKind, timeText } from './strings';
import { styles } from './styles';

/** `ui-job-open` detail: a queue chip, a job's past-runs button or its run strip was activated. */
export interface AqJobOpenDetail {
  jobId: string;
}

/** `ui-account-open` detail: an account mark was opened. Cancel the event to suppress the built-in card. */
export interface AqAccountOpenDetail {
  providerId: string;
  accountId: string;
}

/** `ui-collapse` detail: a section's fold toggle was pressed. Cancel the event to keep the current state. */
export interface AqCollapseDetail {
  section: AqSection;
  /** The state the press asks for. */
  collapsed: boolean;
}

const CHEVRON_SVG =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>';
const SECTIONS: readonly AqSection[] = ['capacity', 'lane'];
const CHIP_GLYPH: Record<string, string> = { low: '▲ ', empty: '✗ ', unknown: '◌ ' };

const CLOCK_SVG =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.8V8l2.2 1.4"/></svg>';

const RUN_STATUSES: AqRunStatus[] = ['ok', 'running', 'waiting', 'failed', 'unknown'];
const GLYPH: Record<AqRunStatus, string> = { ok: '✓', running: '●', waiting: '▲', failed: '✗', unknown: '◌' };
const TICK: Record<AqRunStatus, string> = {
  ok: 'ok',
  running: 'run',
  waiting: 'wait',
  failed: 'fail',
  unknown: 'none',
};
const COUNTDOWN = new Set<TimeKind>(['left', 'in', 'back', 'runs']);

const statusOf = (r: AqRun): AqRunStatus => (RUN_STATUSES.includes(r.status) ? r.status : 'unknown');
const pill = (tone: string, html: string) => `<span class="aq-pill is-${tone}">${html}</span>`;
/** FNV-1a, base 36: host ids become selector-safe focus keys (`data-key`) that still follow the id. */
function hashId(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}
const keyOf = (kind: string, ...ids: string[]) =>
  `${kind}-${ids.map((x) => `${hashId(x)}${x.length.toString(36)}`).join('-')}`;
/** The open account card: one account (`aid`), or a folded run's list (`grp`, the usable run is `available`). */
interface OpenCard {
  pid: string;
  aid: string | null;
  grp: string | null;
}
const accKey = (pid: string, aid: string) => keyOf('acc', pid, aid);
const foldKey = (pid: string, grp: string) => (grp === OK_STACK ? keyOf('ok', pid) : keyOf('grp', pid, grp));
const openKey = (o: OpenCard) => (o.aid !== null ? accKey(o.pid, o.aid) : foldKey(o.pid, o.grp ?? OK_STACK));

/** One icon per stack (D10): the reason when it has one, else the state. Stroke only, so the badge colour paints it. */
const ICON_PAUSE = '<path d="M6 4v8M10 4v8"/>';
const ICON_OUT = '<circle cx="8" cy="8" r="5.5" stroke-dasharray="2.2 2.2"/>';
const REASON_ICON: Record<string, string> = {
  '5h': '<circle cx="8" cy="8" r="6"/><path d="M8 4.8V8l2.2 1.4"/>',
  weekly: '<rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 7h11M5.5 2v3M10.5 2v3"/>',
  model:
    '<rect x="4.5" y="4.5" width="7" height="7" rx="1.2"/><path d="M6.5 2v2.5M9.5 2v2.5M6.5 11.5V14M9.5 11.5V14M2 6.5h2.5M2 9.5h2.5M11.5 6.5H14M11.5 9.5H14"/>',
  cooldown: '<path d="M8 1.8v12.4M2.6 4.9l10.8 6.2M2.6 11.1l10.8-6.2M6.3 2.9 8 4.4l1.7-1.5M6.3 13.1 8 11.6l1.7 1.5"/>',
  auth: '<rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>',
  paused: ICON_PAUSE,
  held: ICON_PAUSE,
  noMeasure: ICON_OUT,
  unknownTier: ICON_OUT,
};
const STATE_ICON: Record<AqAccountState, string> = {
  available: '',
  limited: '<circle cx="8" cy="8" r="5.8"/><path d="M3.9 12.1l8.2-8.2"/>',
  paused: ICON_PAUSE,
  spent: '<circle cx="8" cy="8" r="5.5"/>',
  unmeasured: '<path d="M6 6.2a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.3v.4M8 12.2v.1"/>',
  excluded: ICON_OUT,
};
const stackIcon = (s: AqStack) =>
  `<svg class="aq-si" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
    (Object.hasOwn(REASON_ICON, s.reason) ? REASON_ICON[s.reason] : '') ||
    (Object.hasOwn(STATE_ICON, s.state) ? STATE_ICON[s.state] : '')
  }</svg>`;
/** The badge colour: limited amber, a failed login red (someone must act), left out dashed, the rest grey. */
const stackTone = (s: AqStack) =>
  s.state === 'limited' ? 'warn' : s.reason === 'auth' ? 'fail' : s.state === 'excluded' ? 'out' : 'mute';

/** One polite sentence per data update for capacity (all limited > available again > under 20%), or ''. */
export function capacityNews(
  prev: AqProvider[] | undefined,
  next: AqProvider[] | undefined,
  nowMs: number,
  t: Strings = STRINGS.en,
): string {
  if (!prev || !next) return '';
  const said: Array<[rank: number, msg: string]> = [];
  for (const g0 of next) {
    const p0 = prev.find((x) => x.id === g0.id);
    if (!p0) continue;
    const g = advanceProvider(g0, nowMs);
    const ns = poolState(g);
    const ps = poolState(advanceProvider(p0, nowMs));
    if (ns === ps) continue;
    const name = plain(g.name, 40);
    if (ns === 'empty') {
      const at = emptyReturnAt(g, nowMs);
      const back = at ? timeText('back', at, nowMs, t) : '';
      said.push([1, limitedAccounts(g).length ? t.news.allLimited(name, back) : t.news.empty(name, back)]);
    } else if (ps === 'empty' && ns !== 'unknown') {
      const acc = g.accounts ?? [];
      said.push([4, t.news.again(name, acc.filter((a) => a.state === 'available').length, acc.length)]);
    } else if (ps === 'ok' && ns === 'low') {
      const k = primaryKey(g);
      const v = Number(g[k]) || 0;
      said.push([5, t.news.low(name, k === 'weekly', LOW_PCT, fmtCount(v, g.total), fmt1(g.total))]);
    }
  }
  said.sort((a, b) => a[0] - b[0]);
  return said[0]?.[1] ?? '';
}

/** One polite sentence per data update for the lane (a newer failed run > a job that starts waiting), or ''. */
export function laneNews(prev: AqLane | undefined, next: AqLane | undefined, t: Strings = STRINGS.en): string {
  if (!prev || !next) return '';
  let fail = '';
  let wait = '';
  for (const j of next.jobs ?? []) {
    const p = (prev.jobs ?? []).find((x) => x.id === j.id);
    if (!p) continue;
    const nr = jobRuns(j)[0];
    const pr = jobRuns(p)[0];
    if (!fail && nr && nr.status === 'failed' && nr.at > (pr?.at ?? 0))
      fail = t.news.fail(plain(j.name, 60), plain(nr.error, 80));
    if (!wait && j.state === 'waiting' && p.state !== 'waiting') wait = t.news.wait(plain(j.name, 60));
  }
  return fail || wait;
}

/**
 * `<ui-agent-queue>` — capacity and the scheduled-job lane, the soma-work dashboard's adaptation of affectUI Agent
 * Queue. Provider capacity reads accounts as workers (who is usable, who is limited and when it returns); the lane
 * reads scheduled jobs as a queue (what runs next, how many run now, 24 hours of run records). Countdowns tick once
 * a second in place; state changes are spoken once in a polite live region.
 */
export class UiAgentQueue extends UiElement<AgentQueueData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang'];
  }

  #dirty = true;
  #m: AgentQueueData | undefined;
  #skew = 0;
  #open: OpenCard | null = null;
  #stops = new Map<string, string>();
  #width = 0;
  #ro: ResizeObserver | null = null;
  #rz = 0;
  #seenQ = new Set<string>();
  #fold: Record<AqSection, boolean> = { capacity: false, lane: false };
  #tick = 0;
  #say = 0;
  readonly #live: HTMLElement;

  constructor() {
    super();
    this.#live = document.createElement('div');
    this.#live.className = 'sr-only';
    this.#live.setAttribute('aria-live', 'polite');
    this.#live.setAttribute('aria-atomic', 'true');
    this.root.append(this.#live);
    this.root.addEventListener('click', (e) => this.#onClick(e));
    this.root.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    this.root.addEventListener('focusin', (e) => this.#onFocus(e));
  }

  override get data(): AgentQueueData | undefined {
    return super.data;
  }

  override set data(value: AgentQueueData | undefined) {
    this.#dirty = true;
    super.data = value;
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    clearInterval(this.#tick);
    this.#tick = window.setInterval(() => this.#tickNow(), 1000);
    if (!this.#ro && typeof ResizeObserver !== 'undefined') {
      // Debounced: a width transition re-renders once it settles, not on every frame.
      this.#ro = new ResizeObserver((entries) => {
        const w = entries[0]?.contentRect.width ?? 0;
        if (Math.abs(w - this.#width) < 4) return;
        clearTimeout(this.#rz);
        this.#rz = window.setTimeout(
          () => {
            this.#width = w;
            this.requestRender();
          },
          this.#width > 0 ? 120 : 0,
        );
      });
    }
    this.#ro?.observe(this);
    document.addEventListener('click', this.#onDocClick, true);
  }

  override disconnectedCallback(): void {
    clearInterval(this.#tick);
    this.#tick = 0;
    clearTimeout(this.#say);
    clearTimeout(this.#rz);
    this.#ro?.disconnect();
    document.removeEventListener('click', this.#onDocClick, true);
  }

  get #lang(): 'en' | 'ko' {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  get #t(): Strings {
    return STRINGS[this.#lang];
  }

  #now(): number {
    return Date.now() + this.#skew;
  }

  // ── Data in ───────────────────────────────────────────────────────────────────────────────

  #ingest(d: AgentQueueData): void {
    // The host's fold state wins on every data set; a section it leaves out keeps the element's own.
    for (const s of SECTIONS) if (typeof d.collapsed?.[s] === 'boolean') this.#fold[s] = d.collapsed[s] as boolean;
    const next = normalize(d);
    this.#skew = next.now !== undefined ? next.now - Date.now() : 0;
    const prev = this.#m;
    this.#m = next;
    // The open card follows its account id; an account that left closes it.
    const o = this.#open;
    if (o) {
      const p = next.providers?.find((x) => x.id === o.pid);
      if (!p || (o.aid !== null && !p.accounts?.some((a) => a.id === o.aid))) this.#open = null;
    }
    // The first data is the baseline: nothing is announced for it.
    if (prev) {
      const now = this.#now();
      const msg = [capacityNews(prev.providers, next.providers, now, this.#t), laneNews(prev.lane, next.lane, this.#t)]
        .filter(Boolean)
        .join(' · ');
      if (msg) this.#announce(msg);
    }
  }

  /** Cleared first, written 60 ms later: the same sentence twice is still spoken. textContent only. */
  #announce(msg: string): void {
    clearTimeout(this.#say);
    this.#live.textContent = '';
    this.#say = window.setTimeout(() => {
      this.#live.textContent = msg;
    }, 60);
  }

  // ── Render ────────────────────────────────────────────────────────────────────────────────

  protected render(): string {
    const d = this.data;
    if (!d) return '';
    if (this.#dirty || !this.#m) {
      this.#dirty = false;
      this.#ingest(d);
    }
    const m = this.#m as AgentQueueData;
    const t = this.#t;
    const now = this.#now();
    let h = '';
    if (m.providers || m.capacityError !== undefined) h += this.#capacity(m, now, t);
    if (m.lane) h += this.#lane(m.lane, now, t);
    return h ? `<div class="aq">${h}</div>` : '';
  }

  /** A live time element; the 1 Hz tick rewrites its text in place. */
  #time(kind: TimeKind, at: number | undefined, now: number, t: Strings, cls = 'aq-left'): string {
    if (at === undefined || !Number.isFinite(at)) return '';
    const cd = COUNTDOWN.has(kind);
    return `<time class="${cls}"${cd ? ' role="timer"' : ''} datetime="${new Date(at).toISOString()}" data-at="${Math.round(at)}" data-fmt="${kind}"${
      cd && at <= now ? ' data-due' : ''
    }>${esc(timeText(kind, at, now, t))}</time>`;
  }

  // ── Capacity ──────────────────────────────────────────────────────────────────────────────

  /** The section's fold toggle (with `collapsible`): its word says what a press does; aria-expanded the state. */
  #foldBtn(section: AqSection, name: string, t: Strings): string {
    if (!this.data?.collapsible) return '';
    const folded = this.#fold[section];
    const word = folded ? t.fold.expand : t.fold.collapse;
    return `<button type="button" class="aq-fold" data-fold="${section}" data-key="fold-${section}" aria-expanded="${
      folded ? 'false' : 'true'
    }" aria-label="${escAttr(t.fold.aria(word, name))}"><span class="aq-fold-text">${esc(word)}</span>${CHEVRON_SVG}</button>`;
  }

  #capacity(m: AgentQueueData, now: number, t: Strings): string {
    const fold = this.#foldBtn('capacity', t.capTitle, t);
    if (this.#fold.capacity)
      return `<section class="capacity is-collapsed" aria-label="${escAttr(t.capTitle)}"><div class="cap-head"><h2 class="cap-title">${esc(
        t.capTitle,
      )}</h2>${this.#summary(m, now, t)}${fold}</div></section>`;
    const sub = [m.capacityNote ? esc(m.capacityNote) : '', this.#time('fetched', m.fetchedAt, now, t, 'aq-ago')]
      .filter(Boolean)
      .join(' · ');
    const head = `<div class="cap-head"><h2 class="cap-title">${esc(t.capTitle)}</h2>${sub ? `<span class="cap-sub">${sub}</span>` : ''}${fold}</div>`;
    const open = `<section class="capacity" aria-label="${escAttr(t.capTitle)}">${head}`;
    if (m.capacityError !== undefined)
      return `${open}<div class="cap-off">${esc(t.capError(m.capacityError || '—'))}</div></section>`;
    const ps = m.providers ?? [];
    if (!ps.length) return `${open}<div class="cap-off">${esc(t.capNone)}</div></section>`;
    // The section's inner width sizes the timeline (SVG in px, labels unscaled) and fits the workers strip.
    const width = this.#width > 0 ? this.#width : this.clientWidth > 0 ? this.clientWidth : 900;
    const W = Math.max(260, Math.round(width) - 28 - 36);
    const narrow = W < 600;
    return `${open}<div class="cap-rows">${ps
      .map((p, i) => this.#provider(advanceProvider(p, now), i, now, t, W, narrow))
      .join('')}</div></section>`;
  }

  /** Collapsed capacity: one chip per provider — state glyph, both measures, ⏸ limited · first return, ⚠ flags. */
  #summary(m: AgentQueueData, now: number, t: Strings): string {
    if (m.capacityError !== undefined)
      return `<div class="cap-summary"><span class="cap-chip is-error" title="${escAttr(m.capacityError)}">${esc(
        t.chip.error(m.capacityError || '—'),
      )}</span></div>`;
    const ps = m.providers ?? [];
    if (!ps.length)
      return `<div class="cap-summary"><span class="cap-chip is-unknown">${esc(t.chip.none)}</span></div>`;
    return `<ul class="cap-summary" aria-label="${escAttr(t.chip.aria)}">${ps
      .map((p) => this.#chip(advanceProvider(p, now), now, t))
      .join('')}</ul>`;
  }

  #chip(p: AqProvider, now: number, t: Strings): string {
    const state = poolState(p);
    const total = Number(p.total) || 0;
    const known = total > 0;
    const ts = fmt1(total);
    const five = has5h(p);
    const wk = p.weekly !== undefined && p.weekly !== null;
    const v5 = Number(p.fiveHour) || 0;
    const vw = Number(p.weekly) || 0;
    // Both measures as count / total and %, labelled — also folded, also on phones.
    const meas = (cls: string, word: string, v: number) =>
      `<span class="cap-m is-${cls}"><i class="cap-chip-k">${esc(word)} </i><b>${fmtCount(v, total)}</b><i class="cap-chip-of">/${ts}</i> <em>${fmtPct(
        v,
        total,
      )}</em></span>`;
    const nums = [five ? meas('now', t.chip.now, v5) : '', wk ? meas('wk', t.chip.week, vw) : ''].filter(Boolean);
    const said = known
      ? [
          five ? t.chip.said5(fmtCount(v5, total), ts, fmtPct(v5, total)) : '',
          wk ? t.chip.saidWk(fmtCount(vw, total), ts, fmtPct(vw, total)) : '',
        ]
          .filter(Boolean)
          .join(', ')
      : t.bar.unknown;
    // What the card's disclosure line flags: a reading over a day old, a fifth or more left out, assumed tiers.
    const acc = p.accounts ?? [];
    const age = p.measuredAt !== undefined ? (now - p.measuredAt) / 1000 : 0;
    const stale = age > 86400 ? t.age(age) : '';
    const all = p.accountCount ?? acc.length;
    const counted = countedAccounts(p);
    const part = all > 0 && counted < all * 0.8 ? t.disc.reflected(counted, all) : '';
    const assumed = acc.filter((a) => a.tierAssumed && a.tier && a.state !== 'paused' && a.state !== 'excluded');
    const tier = assumed.length ? String(assumed[0].tier) : '';
    const flags = [stale ? t.chip.stale(stale) : '', part, tier ? t.chip.assumed(tier, assumed.length) : ''].filter(
      Boolean,
    );
    const flagSaid = [stale ? t.disc.measured(stale) : '', part, tier ? t.disc.assumed(assumed.length, tier) : '']
      .filter(Boolean)
      .map((x) => ` · ${x}`)
      .join('');
    // Limited workers and the first return, between the measures and the ⚠ flag (ticking in place).
    const lim = limitedAccounts(p).length;
    const back = lim ? firstReturn(p) : null;
    const left = back === null ? 0 : Math.floor((back - now) / 1000);
    const limHtml = lim
      ? ` <i class="cap-chip-lim">⏸ ${lim}${back !== null ? ` · ${this.#time('left', back, now, t)}` : ''}</i>`
      : '';
    const limSaid = lim
      ? t.chip.limSaid(lim, back === null ? '' : left > 0 ? t.chip.firstBack(t.dur(left)) : t.backSoon)
      : '';
    const next = known ? this.#nextText(p, primaryKey(p), now, t) : '';
    const lead = `${said}${flagSaid}${t.chip.word[state] ?? ''}${limSaid}${next ? ` — ${next}` : ''}`;
    const flag = flags.length ? ` <i class="cap-chip-flag">${esc(`⚠ ${flags.join(' · ')}`)}</i>` : '';
    return `<li class="cap-chip is-${state}" title="${escAttr(lead)}"><span class="cap-chip-v" aria-hidden="true">${esc(
      (CHIP_GLYPH[state] ?? '') + p.name,
    )} ${nums.length && known ? nums.join(' · ') : '<b>—</b>'}${limHtml}${flag}</span><span class="sr-only">${esc(
      `${p.name} ${lead}`,
    )}</span></li>`;
  }

  /** The next line as plain words (chip tooltip): what comes back next, when, and why. */
  #nextText(p: AqProvider, key: MeasureKey, now: number, t: Strings): string {
    const e = nextRefill(p, key, now);
    if (!e) {
      const small = gainWithin(p, key, now);
      return small > 0.0005 ? t.bar.backWithin(t.gain(small, fmt1)) : t.bar.nothing;
    }
    const why = [t.cause[e.cause] ?? '', e.account ?? ''].filter(Boolean).join(' · ');
    return `${t.bar.next(fmt1(Number(e[key]) || 0))}${timeText('in', e.at, now, t)} (${clockLabel(e.at, now)})${
      why ? ` · ${why}` : ''
    }`;
  }

  #provider(p: AqProvider, idx: number, now: number, t: Strings, W: number, narrow: boolean): string {
    const state = poolState(p);
    const n = p.accountCount ?? p.accounts?.length ?? 0;
    const who = p.source || n ? `<span class="aq-name">${esc(t.source(p.source ?? '', n))}</span>` : '';
    let h = `<section class="cap-prov is-${state}${narrow ? ' is-narrow' : ''}" aria-label="${escAttr(t.capAria(p.name))}">`;
    h += `<div class="aq-head"><h3 class="cap-pname">${esc(p.name)}</h3>${who}${this.#provPill(p, state, now, t)}</div>`;
    const disc = this.#disclosure(p, now, t);
    if (disc) h += `<div class="cap-disc">${disc}</div>`;
    const workers = this.#workers(p, now, t, W);
    if (!(Number(p.total) > 0)) return `${h}<div class="cap-bar-next">${esc(t.bar.unknown)}</div>${workers}</section>`;
    if (has5h(p)) h += this.#bar(p, 'fiveHour', now, t);
    if (p.weekly !== undefined && p.weekly !== null) h += this.#bar(p, 'weekly', now, t);
    h += workers;
    h += this.#timeline(p, idx, state, W, now, t);
    return `${h}</section>`;
  }

  /** The provider pill (D8): can't compute > all limited / used up > limited n > low > available. */
  #provPill(p: AqProvider, state: AqPoolState, now: number, t: Strings): string {
    const lim = limitedAccounts(p).length;
    if (state === 'unknown' || !(Number(p.total) > 0)) return pill('unknown', esc(t.pill.unknown));
    if (state === 'empty') {
      const at = emptyReturnAt(p, now);
      return pill(
        'empty',
        esc(lim ? t.pill.allLimited : t.pill.empty) + (at ? ` · ${this.#time('back', at, now, t)}` : ''),
      );
    }
    if (lim) {
      const back = firstReturn(p);
      return pill('paused', esc(t.pill.limited(lim)) + (back ? ` · ${this.#time('back', back, now, t)}` : ''));
    }
    if (state === 'low') return pill('low', esc(t.pill.low));
    return pill('ok', esc(t.pill.ok));
  }

  /** One muted line, only what is non-zero: reflected / limited, exclusions, estimates, the measurement's age. */
  #disclosure(p: AqProvider, now: number, t: Strings): string {
    const acc = p.accounts ?? [];
    const all = p.accountCount ?? acc.length;
    const lim = limitedAccounts(p).length;
    const parts: string[] = [];
    if (all > 0) parts.push(t.disc.reflected(countedAccounts(p), all) + (lim ? t.disc.blocked(lim) : ''));
    const ex = exclusions(p);
    const why: string[] = [];
    if (ex.held) why.push(t.disc.held);
    if (ex.unknownTier) why.push(t.disc.unknownTier);
    if (ex.noMeasure) why.push(t.disc.noMeasure);
    const exN = ex.held + ex.unknownTier + ex.noMeasure;
    if (exN) parts.push(t.disc.excluded(exN, why.join('·')));
    const assumed = acc.filter((a) => a.tierAssumed && a.tier && a.state !== 'paused' && a.state !== 'excluded');
    if (assumed.length) parts.push(t.disc.assumed(assumed.length, String(assumed[0].tier)));
    const est = p.estimated ?? acc.filter((a) => a.estimated).length;
    if (est) parts.push(t.disc.estimated(est));
    const un = p.unmeasured5h ?? acc.filter((a) => a.state === 'unmeasured').length;
    if (un) parts.push(t.disc.unmeasured(un));
    let html = esc(parts.join(' · '));
    if (p.measuredAt !== undefined) {
      const age = (now - p.measuredAt) / 1000;
      const sep = html ? ' · ' : '';
      // Over a day old, the reading the bars rest on is flagged.
      if (age > 86400) html += `${sep}<b class="cap-stale">${esc(`⚠ ${t.disc.measured(t.age(age))}`)}</b>`;
      else if (age > 3600) html += sep + esc(t.disc.measured(t.age(age)));
    }
    return html;
  }

  #bar(p: AqProvider, key: MeasureKey, now: number, t: Strings): string {
    const v = Number(p[key]) || 0;
    const total = Number(p.total) || 0;
    const frac = total > 0 ? Math.max(0, Math.min(1, v / total)) : 0;
    const five = key === 'fiveHour';
    const label = five ? t.bar.fiveHour : t.bar.weekly;
    const sub = five ? t.bar.fiveHourSub : t.bar.weeklySub;
    const vs = fmtCount(v, total);
    const ts = fmt1(total);
    const pct = fmtPct(v, total);
    const e = nextRefill(p, key, now);
    const who = e ? ` title="${escAttr([t.cause[e.cause] ?? '', e.account ?? ''].filter(Boolean).join(' · '))}"` : '';
    // The dashed line is where the pool turns low (the reference's backpressure line).
    return `<div class="cap-bar-row is-${five ? 'h5' : 'wk'}"><div class="cap-bar-lbl">${esc(label)}<i>${esc(sub)}</i></div><div class="cap-bar" role="img" aria-label="${escAttr(
      t.bar.said(label, vs, ts, pct),
    )}"><span style="width:${(frac * 100).toFixed(1)}%"></span><i class="cap-low" style="left:${LOW_PCT}%" title="${escAttr(
      t.bar.low(LOW_PCT),
    )}"></i></div><div class="cap-bar-val"><b>${vs}</b> ${esc(t.bar.of(ts))} <em>${pct}</em></div><div class="cap-bar-next"${who}>${this.#nextLine(
      p,
      key,
      now,
      t,
    )}</div></div>`;
  }

  /** “next +0.4 · in 22m”; another cause is named; small gains are summed, never dropped. */
  #nextLine(p: AqProvider, key: MeasureKey, now: number, t: Strings): string {
    const e = nextRefill(p, key, now);
    if (!e) {
      const small = gainWithin(p, key, now);
      return esc(small > 0.0005 ? t.bar.backWithin(t.gain(small, fmt1)) : t.bar.nothing);
    }
    const gain = esc(t.bar.next(fmt1(Number(e[key]) || 0))) + this.#time('in', e.at, now, t);
    // The 5-hour bar rising at a weekly reset is held down by the weekly limit: say so.
    if (key === 'fiveHour' && e.cause === '7d') return esc(t.bar.heldByWeekly) + gain;
    const own = key === 'fiveHour' ? e.cause === '5h' : e.cause === '7d';
    return own ? gain : `${gain} · ${esc(t.cause[e.cause] ?? '')}`;
  }

  #reason(a: AqAccount, t: Strings): string {
    // Own keys only: a host reason such as `toString` or `__proto__` is free text, not a lookup.
    if (a.reason) return Object.hasOwn(t.reason, a.reason) ? t.reason[a.reason] : String(a.reason);
    return t.stateWord[a.state] ?? '';
  }

  #tierLabel(a: AqAccount, t: Strings): string {
    if (!a.tier) return t.noTier;
    return a.tierAssumed ? t.tierAssumed(a.tier) : a.tier;
  }

  /**
   * The workers strip (D10): the head and every badge on one wrapping row, one tab stop. Usable accounts are one
   * badge each; the rest stack per state and reason — overlapped, one icon, one colour, the name only (the reason,
   * the return and the tier are in the title, the label and the card). Runs that would push the row past two lines
   * fold to one `icon count` badge whose card lists them.
   */
  #workers(p: AqProvider, now: number, t: Strings, W: number): string {
    const acc = p.accounts ?? [];
    if (!acc.length) return '';
    const okN = acc.filter((a) => a.state === 'available').length;
    const rove = keyOf('cap', p.id);
    const stacks = accountStacks(acc);
    const head = `${t.workers} ${okN}/${acc.length}`;
    const folds = stripFolds(stacks, head, W);
    const runs = stacks.map((s) => {
      const fold = folds.has(s.key);
      return { s, fold, keys: fold ? [foldKey(p.id, s.key)] : s.accounts.map((a) => accKey(p.id, a.id)) };
    });
    const keys = runs.flatMap((r) => r.keys);
    const want = this.#stops.get(rove);
    const stop = want && keys.includes(want) ? want : keys[0];
    const o = this.#open;
    const open = o && o.pid === p.id ? openKey(o) : null;
    const marks = runs
      .map(({ s, fold, keys: ks }) => {
        const ok = s.key === OK_STACK;
        const html = fold
          ? this.#foldMark(p, s, ks[0], t, open === ks[0], stop === ks[0])
          : s.accounts
              .map((a, i) =>
                this.#mark(p, a, ks[i], now, t, open === ks[i], stop === ks[i], !ok && i === 0 ? stackIcon(s) : ''),
              )
              .join('');
        return ok ? html : `<span class="aq-stack is-${stackTone(s)}${fold ? ' is-folded' : ''}">${html}</span>`;
      })
      .join('');
    const grp = o && o.aid === null ? (stacks.find((s) => s.key === o.grp) ?? null) : null;
    const card = open && o && keys.includes(open) ? this.#card(p, o.aid, grp, open, now, t) : '';
    return `<div class="aq-workers" role="group" aria-label="${escAttr(t.workersAria(p.name, okN, acc.length))}" data-rove="${escAttr(
      rove,
    )}"><div class="aq-marks"><span class="aq-col-head"><span>${esc(t.workers)}</span> <b>${okN}/${acc.length}</b></span>${marks}</div>${card}</div>`;
  }

  /** One account: a usable one is its binding dot and name; the first of a stack carries the stack's icon. */
  #mark(
    p: AqProvider,
    a: AqAccount,
    key: string,
    now: number,
    t: Strings,
    open: boolean,
    stop: boolean,
    icon: string,
  ): string {
    const why = this.#reason(a, t);
    const said = [a.name, a.tier ? this.#tierLabel(a, t) : '', why];
    if (a.state === 'limited') said.push(a.returnAt ? timeText('back', a.returnAt, now, t) : t.noReturn);
    const dot =
      a.state === 'available'
        ? `<i class="aq-wdot is-${a.binding === '5h' ? 'h5' : 'wk'}" aria-hidden="true"></i>`
        : '';
    const label = said.filter(Boolean);
    return `<button type="button" class="aq-mark is-${a.state}" data-key="${escAttr(key)}" data-pid="${escAttr(
      p.id,
    )}" data-aid="${escAttr(a.id)}" data-rove-item tabindex="${stop ? 0 : -1}" aria-haspopup="dialog" aria-expanded="${open}" aria-label="${escAttr(
      label.join(', '),
    )}" title="${escAttr(label.join(' · '))}">${dot}${icon}<b>${esc(a.name)}</b></button>`;
  }

  /** A folded run: its icon (the usable run: a dot) and how many; the card lists who. */
  #foldMark(p: AqProvider, s: AqStack, key: string, t: Strings, open: boolean, stop: boolean): string {
    const n = s.accounts.length;
    const ok = s.key === OK_STACK;
    const label = ok ? t.okFoldAria(n) : t.foldAria(this.#reason(s.accounts[0], t), n);
    const icon = ok ? '<i class="aq-wdot is-ok" aria-hidden="true"></i>' : stackIcon(s);
    return `<button type="button" class="aq-mark is-${s.state} is-fold" data-key="${escAttr(key)}" data-pid="${escAttr(
      p.id,
    )}" data-grp="${escAttr(s.key)}" data-rove-item tabindex="${stop ? 0 : -1}" aria-haspopup="dialog" aria-expanded="${open}" aria-label="${escAttr(
      label,
    )}" title="${escAttr(label)}">${icon}<b>${n}</b></button>`;
  }

  /** The account card (D11): every row from the account's own fields; a folded run's card lists its accounts. */
  #card(p: AqProvider, aid: string | null, grp: AqStack | null, key: string, now: number, t: Strings): string {
    const close = `<button type="button" class="aq-pop-close" data-key="aq-pop-close" aria-label="${escAttr(t.card.close)}">×</button>`;
    const row = (dt: string, dd: string, wide = false) =>
      `<div${wide ? ' class="is-wide"' : ''}><dt>${esc(dt)}</dt><dd>${dd}</dd></div>`;
    const pct = (x: number | undefined) =>
      x === undefined || x === null ? '—' : `${Math.round((Number(x) || 0) * 100)}%`;
    if (aid === null) {
      if (!grp) return '';
      const ok = grp.key === OK_STACK;
      const title = ok ? t.card.okTitle : this.#reason(grp.accounts[0], t);
      const rows = grp.accounts.map((a) =>
        row(
          a.name,
          ok
            ? esc(t.card.okRow(pct(a.fiveHour), pct(a.weekly)))
            : a.returnAt
              ? this.#time('left', a.returnAt, now, t)
              : '—',
        ),
      );
      return `<div class="aq-pop" role="dialog" aria-label="${escAttr(ok ? t.card.okAria : t.card.stackAria(title))}" data-for="${escAttr(
        key,
      )}"><div class="aq-pop-head"><span class="aq-pop-name">${esc(title)}</span><span class="aq-pop-kind">${esc(
        t.card.okKind(p.name, grp.accounts.length),
      )}</span>${close}</div><dl class="aq-pop-stats">${rows.join('')}</dl></div>`;
    }
    const a = p.accounts?.find((x) => x.id === aid);
    if (!a) return '';
    const counted = a.state !== 'paused' && a.state !== 'excluded';
    const rows = [row(t.card.now, counted ? pct(a.fiveHour) : '—'), row(t.card.week, counted ? pct(a.weekly) : '—')];
    if (a.binding) rows.push(row(t.card.binds, esc(a.binding === '5h' ? t.card.h5 : t.card.wk)));
    rows.push(row(t.card.state, esc(this.#reason(a, t))));
    if (a.returnAt)
      rows.push(
        row(t.card.returns, `${esc(clockLabel(a.returnAt, now))} · ${this.#time('left', a.returnAt, now, t)}`, true),
      );
    if (a.estimated) rows.push(row(t.card.estimated, esc(t.card.estimatedSay)));
    const tone =
      a.state === 'available'
        ? 'ok'
        : a.state === 'limited'
          ? 'paused'
          : a.state === 'paused' || a.state === 'excluded'
            ? 'unknown'
            : 'low';
    return `<div class="aq-pop" role="dialog" aria-label="${escAttr(t.card.aria(a.name))}" data-for="${escAttr(key)}"><div class="aq-pop-head"><span class="aq-pop-name">${esc(
      a.name,
    )}</span><span class="aq-pop-kind">${esc(this.#tierLabel(a, t))}</span>${pill(tone, esc(this.#reason(a, t)))}${close}</div><dl class="aq-pop-stats">${rows.join(
      '',
    )}</dl></div>`;
  }

  /** The 7-day timeline: ● 5-hour reset (label above), ◆ weekly reset (label below); all limited shades now → lift. */
  #timeline(p: AqProvider, idx: number, state: AqPoolState, W: number, now: number, t: Strings): string {
    const marks = timelineMarks(p, W, now);
    // An all-limited pool with nothing coming back still gets its axis and its shaded stretch — the blank is the point.
    if (!marks.length && state !== 'empty') return '';
    const pad = 16;
    const y0 = marks.some((b) => b.c === 'h5') ? 46 : 20;
    const h = y0 + 54;
    const X = (at: number) => pad + axisPos(at - now) * (W - 2 * pad);
    let s = `<svg class="cap-tl" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" role="img" aria-label="${escAttr(t.tl.aria)}">`;
    if (state === 'empty') {
      const k = primaryKey(p);
      const lift = (p.refills ?? []).find((e) => e.at > now && (Number(e[k]) || 0) > 0)?.at ?? null;
      const x1 = lift === null ? W - pad : X(lift);
      const hid = `aqh-${idx}`;
      const span = Math.max(0, x1 - pad).toFixed(1);
      const title = lift === null ? t.tl.limNone : t.tl.lim(clockLabel(lift, now));
      s += `<defs><pattern id="${hid}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="cap-tl-hatch" x1="0" y1="0" x2="0" y2="6"/></pattern></defs>`;
      s += `<rect class="cap-tl-lim" x="${pad}" y="0" width="${span}" height="${y0 + 14}"><title>${esc(title)}</title></rect>`;
      s += `<rect x="${pad}" y="0" width="${span}" height="${y0 + 14}" fill="url(#${hid})" aria-hidden="true"/>`;
    }
    [0, HOUR, 6 * HOUR, DAY, 3 * DAY, 5 * DAY, D7].forEach((off, i) => {
      const x = (pad + axisPos(off) * (W - 2 * pad)).toFixed(1);
      s += `<line class="cap-tl-tick" x1="${x}" x2="${x}" y1="${y0 - 6}" y2="${y0 + 6}"/>`;
      s += `<text class="cap-tl-ax" x="${x}" y="${h - 4}" text-anchor="middle">${esc(t.tl.axis[i])}</text>`;
    });
    s += `<line class="cap-tl-axis" x1="${pad}" x2="${W - pad}" y1="${y0}" y2="${y0}"/>`;
    for (const b of marks) {
      const x = (b.x0 + b.x1) / 2;
      const xs = x.toFixed(1);
      s += `<g class="cap-tl-mk is-${b.c}">`;
      if (b.x1 - b.x0 > 2)
        s += `<line class="cap-tl-span" x1="${b.x0.toFixed(1)}" x2="${b.x1.toFixed(1)}" y1="${y0}" y2="${y0}"/>`;
      if (b.c === 'h5') s += `<circle cx="${xs}" cy="${y0}" r="6.5"/>`;
      else
        s += `<rect x="${(x - 6).toFixed(1)}" y="${y0 - 6}" width="12" height="12" transform="rotate(45 ${xs} ${y0})"/>`;
      const tx = Math.max(pad + 14, Math.min(W - pad - 14, x)).toFixed(1);
      s += `<text x="${tx}" y="${b.c === 'h5' ? y0 - 14 : y0 + 24}" text-anchor="middle">+${fmt1(b.gain)}</text>`;
      s += `<title>${esc(
        t.tl.mark(
          b.c === 'h5' ? t.bar.fiveHour : t.bar.weekly,
          fmt1(b.gain),
          timeText('in', b.at, now, t),
          b.names.join(', '),
        ),
      )}</title></g>`;
    }
    s += '</svg>';
    // With no 5-hour gain in 7 days the ● would never appear — say so instead of a dead key.
    const soon5 = (p.refills ?? []).filter((e) => e.cause !== '7d' && e.at > now && e.at <= now + D7);
    const any5 = soon5.some((e) => (Number(e.fiveHour) || 0) >= 0.05);
    const sum5 = soon5.reduce((a, e) => a + (Number(e.fiveHour) || 0), 0);
    const note5 = any5 ? '' : sum5 > 0.0005 ? t.tl.small5(t.gain(sum5, fmt1)) : t.tl.none5;
    const key5 = has5h(p) ? `<span><i class="is-h5" aria-hidden="true">●</i> ${esc(t.tl.h5 + note5)}</span>` : '';
    return `<div class="cap-tl-wrap"><div class="cap-tl-h">${key5}<span><i class="is-wk" aria-hidden="true">◆</i> ${esc(
      t.tl.wk,
    )}</span><span class="cap-tl-h-note">${esc(t.tl.note)}</span></div>${s}</div>`;
  }

  // ── Lane ──────────────────────────────────────────────────────────────────────────────────

  #lane(lane: AqLane, now: number, t: Strings): string {
    const jobs = orderJobs(lane.jobs ?? []);
    const title = lane.title || 'CRON';
    const running = jobs.filter((j) => j.state === 'running').length;
    const waiting = jobs.filter((j) => j.state === 'waiting').length;
    const head = `<div class="aq-lane-head"><span class="aq-lane-ic" aria-hidden="true">${CLOCK_SVG}</span><h2 class="aq-lane-title">${esc(
      title,
    )}</h2><span class="aq-count">${jobs.length}</span>${running ? pill('run', esc(t.running(running))) : ''}${
      waiting ? pill('wait', esc(t.waiting(waiting))) : ''
    }${this.#foldBtn('lane', t.laneAria(title), t)}</div>`;
    // Folded: the head and only the jobs whose run waits for a reply (with their slots) — nothing else is written.
    if (this.#fold.lane) {
      const wait = jobs.filter((j) => j.state === 'waiting');
      return `<section class="aq-lane is-collapsed" aria-label="${escAttr(t.laneAria(title))}">${head}${
        wait.length
          ? `<div class="aq-lane-body"><div class="cron-groups">${wait.map((j) => this.#job(j, now, t, title)).join('')}</div></div>`
          : ''
      }</section>`;
    }
    const day = dayRuns({ ...lane, jobs }, now);
    return `<section class="aq-lane" aria-label="${escAttr(t.laneAria(title))}">${head}<div class="aq-lane-top">${this.#stats(
      jobs,
      day,
      now,
      t,
    )}</div><div class="aq-lane-body"><div class="aq-queue" role="group" aria-label="${escAttr(t.queue.aria)}" data-rove="queue">${this.#queue(
      jobs,
      now,
      t,
    )}</div>${jobs.length ? `<div class="cron-groups">${jobs.map((j) => this.#job(j, now, t, title)).join('')}</div>` : ''}</div><div class="aq-chart">${this.#chart(
      day,
      now,
      t,
    )}</div></section>`;
  }

  /** Four numbers, each from a named field (D16): the front of the queue, running r/N, 24 h of runs and failures. */
  #stats(jobs: AqJob[], day: DayRuns, now: number, t: Strings): string {
    const front = upNext(jobs)[0];
    const lb = day.cut.length ? '≥' : '';
    const cutNote = day.cut.map((c) => t.stat.cut(c.name, c.cap, clockLabel(c.from, now))).join(' · ');
    const running = jobs.filter((j) => j.state === 'running').length;
    const stat = (label: string, value: string, title: string, kind = '') =>
      `<div class="aq-stat"${kind ? ` data-kind="${kind}"` : ''}><dt>${esc(label)}</dt><dd title="${escAttr(title)}">${value}</dd></div>`;
    const next = front
      ? stat(
          t.stat.next,
          `${this.#time('in', front.nextRunAt, now, t)}<span class="aq-of">${esc(front.name)}</span>`,
          t.stat.nextTitle(front.name, clockLabel(front.nextRunAt as number, now)),
        )
      : stat(t.stat.next, '—', t.stat.none);
    return `<dl class="aq-stats">${next}${stat(
      t.stat.running,
      `${running}<span class="aq-of is-n">/${jobs.length}</span>`,
      t.stat.runningTitle(running, jobs.length),
    )}${stat(
      t.stat.runs,
      `${lb}${day.n}${day.unknown ? `<span class="aq-of">${esc(t.stat.unknown(day.unknown))}</span>` : ''}`,
      t.stat.runsTitle(day.n, day.ok, day.fail, day.run) +
        (day.unknown ? t.stat.unknownTitle(day.unknown) : '') +
        (cutNote ? ` · ${cutNote}` : ''),
    )}${stat(t.stat.fails, `${lb}${day.fail}`, t.stat.failsTitle + (cutNote ? ` · ${cutNote}` : ''), day.fail > 0 ? 'failed' : '')}</dl>`;
  }

  /** The up-next column (D17): jobs by their next run, soonest first, four chips then +N, one tab stop. */
  #queue(jobs: AqJob[], now: number, t: Strings): string {
    const list = upNext(jobs);
    const n = list.length;
    const head = `<div class="aq-col-head" title="${escAttr(t.queue.headTitle)}"><span>${esc(t.queue.head)}</span> <b>${n}</b></div>`;
    if (!n) return `${head}<div class="aq-empty">${esc(t.queue.empty)}</div>`;
    const shown = list.slice(0, 4);
    const keys = shown.map((j) => keyOf('q', j.id));
    const want = this.#stops.get('queue');
    const stop = want && keys.includes(want) ? want : keys[0];
    // Only a chip that just joined the front of the queue fades in; a repaint does not replay it.
    const seen = this.#seenQ;
    this.#seenQ = new Set(shown.map((j) => j.id));
    return (
      head +
      shown
        .map((j, i) => {
          const at = j.nextRunAt as number;
          return `<button type="button" class="aq-q${seen.has(j.id) ? '' : ' is-new'}" data-job="${escAttr(j.id)}" data-key="${escAttr(keys[i])}" data-rove-item tabindex="${
            keys[i] === stop ? 0 : -1
          }" aria-label="${escAttr(t.queue.said(j.name, timeText('runs', at, now, t), i + 1, n))}">${CLOCK_SVG}<span class="aq-q-name">${esc(
            j.name,
          )}</span>${this.#time('left', at, now, t)}</button>`;
        })
        .join('') +
      (n > 4 ? `<span class="aq-more">+${n - 4}</span>` : '')
    );
  }

  #job(j: AqJob, now: number, t: Strings, badge: string): string {
    const runs = jobRuns(j);
    const sched = j.schedule ?? (j.expression ? scheduleLabel(j.expression, j.nextRunAt, this.#lang) : '');
    const next =
      j.nextRunAt !== undefined
        ? `<span class="cron-next">${esc(t.job.next(clockLabel(j.nextRunAt, now)))}${this.#time('in', j.nextRunAt, now, t)})</span>`
        : '';
    const last = runs[0];
    const ls = last ? statusOf(last) : null;
    const status =
      j.state === 'waiting'
        ? esc(t.job.waiting)
        : j.state === 'running'
          ? esc(t.job.running)
          : last && ls
            ? `${GLYPH[ls]} ${esc(last.label || t.run[ls])} · ${this.#time('since', last.at, now, t)}`
            : esc(t.job.noRuns);
    const tone = j.state === 'waiting' ? 'wait' : j.state === 'running' ? 'run' : ls ? TICK[ls] : 'none';
    const cls = j.state === 'waiting' ? ' is-waiting' : j.state === 'running' ? ' is-running' : '';
    const expr = j.expression ? ` title="${escAttr(t.job.exprTitle(j.expression))}"` : '';
    return `<section class="cron-group${cls}" aria-label="${escAttr(j.name)}"><div class="cron-tile"><div class="cron-tile-head"><span class="cron-badge" aria-hidden="true">${CLOCK_SVG}<span class="cron-badge-text">${esc(
      badge,
    )}</span></span><span class="cron-name" title="${escAttr(j.name)}">${esc(j.name)}</span>${
      j.note?.text
        ? `<span class="cron-note"${j.note.title ? ` title="${escAttr(j.note.title)}"` : ''}>${esc(j.note.text)}</span>`
        : ''
    }<button type="button" class="cron-history-btn" data-job="${escAttr(
      j.id,
    )}" data-key="${keyOf('runs', j.id)}">${esc(t.job.past(j.pastRuns ?? runs.length))}</button></div>${
      sched || next
        ? `<div class="cron-sched">${sched ? `<span class="cron-expr"${expr}>${esc(sched)}</span>` : ''}${next}</div>`
        : ''
    }${this.#strip(j, runs, now, t)}<div class="cron-status is-${tone}">${status}</div></div><slot name="${escAttr(
      `job:${j.id}`,
    )}"></slot></section>`;
  }

  /** The last 12 runs, oldest → newest. Every state has its own mark; the button says the counts. */
  #strip(j: AqJob, runs: AqRun[], now: number, t: Strings): string {
    const last = runs.slice(0, 12).reverse();
    if (!last.length) return `<div class="cron-strip is-empty">${esc(t.job.noRecords)}</div>`;
    const counts: Record<string, number> = {};
    for (const r of last) {
      const k = runKind(r.status);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    const sum = ['ok', 'run', 'fail', 'unknown']
      .filter((k) => counts[k])
      .map((k) => t.runSum(counts[k], t.runCount[k]))
      .join(', ');
    const ticks = last
      .map((r) => {
        const st = statusOf(r);
        const title = `${GLYPH[st]} ${r.label || t.run[st]} · ${clockLabel(r.at, now)} · ${timeText('since', r.at, now, t)}${
          r.error ? ` · ${plain(r.error, 200)}` : ''
        }`;
        return `<i class="cr-tick is-${TICK[st]}" title="${escAttr(title)}"></i>`;
      })
      .join('');
    return `<button type="button" class="cron-strip" data-job="${escAttr(j.id)}" data-key="${keyOf('strip', j.id)}" aria-label="${escAttr(
      t.job.strip(j.name, last.length, sum),
    )}">${ticks}</button>`;
  }

  /** 24 hours of run records (D19): rolling one-hour columns ending now, ok · in progress · failed stacked. */
  #chart(day: DayRuns, now: number, t: Strings): string {
    const bins = runBins(day, now);
    let peak = 0;
    let peakAt = 0;
    for (const b of bins) {
      const s = b.ok + b.fail + b.run;
      if (s > peak) {
        peak = s;
        peakAt = b.at;
      }
    }
    const max = niceMax(peak);
    const pct = (v: number) => `${((v / max) * 100).toFixed(1)}%`;
    const start = now - DAY;
    const cut = day.cutFrom > start;
    const said =
      t.chart.said(day.n, day.ok, day.fail, day.run) +
      (peak ? t.chart.peak(hm(peakAt), peak) : '') +
      '.' +
      (cut ? t.chart.cut(clockLabel(day.cutFrom, now)) : '') +
      (day.unknown ? t.chart.unknown(day.unknown) : '');
    const hatch = cut
      ? `<div class="aq-ch-cut" style="left:0;width:${(((day.cutFrom - start) / DAY) * 100).toFixed(1)}%" title="${escAttr(
          t.chart.hatch(day.cut.map((c) => c.name).join(', ')),
        )}"></div>`
      : '';
    const cols = bins
      .map(
        (b) =>
          `<i class="aq-ch-col" title="${escAttr(t.chart.col(hm(b.at), b.ok, b.fail, b.run))}"><i class="aq-ch-ok" style="height:${pct(
            b.ok,
          )}"></i><i class="aq-ch-run" style="height:${pct(b.run)}"></i><i class="aq-ch-fail" style="height:${pct(b.fail)}"></i></i>`,
      )
      .join('');
    const key = (cls: string, label: string, title: string) =>
      `<span class="aq-ch-key" title="${escAttr(title)}"><i class="is-${cls}" aria-hidden="true"></i>${esc(label)}</span>`;
    return `<div class="aq-chart-head"><span class="aq-chart-title">${esc(t.chart.title)}</span>${key('ok', t.chart.ok, t.chart.okTitle)}${key(
      'run',
      t.chart.run,
      t.chart.runTitle,
    )}${key('fail', t.chart.fail, t.chart.failTitle)}</div><div class="aq-plot" role="img" aria-label="${escAttr(said)}">${hatch}<div class="aq-ch-grid" aria-hidden="true"><span>${max}</span></div><div class="aq-ch-grid is-zero" aria-hidden="true"><span>0</span></div>${cols}</div><div class="aq-ch-axis" aria-hidden="true">${t.chart.axis
      .map((a) => `<span>${esc(a)}</span>`)
      .join('')}</div>`;
  }

  // ── After render ──────────────────────────────────────────────────────────────────────────

  protected override update(): void {
    const active = this.root.activeElement as HTMLElement | null;
    const rove = active?.closest?.<HTMLElement>('[data-rove]')?.dataset.rove ?? null;
    super.update();
    // The focused item is gone (its account left, the strip folded): its strip's tab stop — never another
    // account at the old place.
    if (rove && !this.root.activeElement) {
      const box = this.$$<HTMLElement>('[data-rove]').find((b) => b.dataset.rove === rove);
      box?.querySelector<HTMLElement>('[data-rove-item][tabindex="0"]')?.focus({ preventScroll: true });
    }
  }

  protected override updated(): void {
    // An open key with no card any more is forgotten, so it never reopens on its own.
    if (this.#open && !this.$('.aq-pop')) this.#open = null;
    // The card sits under its mark, its left edge clamped into the strip. offsetLeft/Top resolve against
    // .aq-workers (position: relative) — a mark inside an .aq-stack still does, so .aq-stack must stay unpositioned.
    for (const pop of this.$$<HTMLElement>('.aq-pop[data-for]')) {
      const box = pop.parentElement;
      const mark = box
        ? Array.from(box.querySelectorAll<HTMLElement>('[data-rove-item]')).find(
            (m) => m.dataset.key === pop.dataset.for,
          )
        : undefined;
      if (!box || !mark) continue;
      pop.style.left = `${Math.max(8, Math.min(mark.offsetLeft, box.clientWidth - pop.offsetWidth - 8))}px`;
      pop.style.top = `${mark.offsetTop + mark.offsetHeight + 6}px`;
    }
  }

  /** 1 Hz: rewrite each live time's text only when it changed; a countdown reaching zero repaints once. */
  #tickNow(): void {
    if (typeof document !== 'undefined' && document.hidden) return;
    const now = this.#now();
    const t = this.#t;
    let due = false;
    for (const el of this.$$<HTMLElement>('time[data-at]')) {
      const at = Number(el.dataset.at);
      const kind = (el.dataset.fmt ?? 'left') as TimeKind;
      const txt = timeText(kind, at, now, t);
      if (el.textContent !== txt) el.textContent = txt;
      if (COUNTDOWN.has(kind) && at <= now && !el.hasAttribute('data-due')) due = true;
    }
    if (due) this.requestRender();
  }

  // ── Events ────────────────────────────────────────────────────────────────────────────────

  #focusKey(key: string): void {
    this.$$<HTMLElement>('[data-key]')
      .find((el) => el.dataset.key === key)
      ?.focus({ preventScroll: true });
  }

  #toggle(pid: string, aid: string | null, grp: string | null): void {
    const next: OpenCard = { pid, aid, grp: aid === null ? (grp ?? OK_STACK) : null };
    const key = openKey(next);
    const o = this.#open;
    if (o && o.pid === pid && o.aid === next.aid && o.grp === next.grp) {
      this.#open = null;
      this.renderNow();
      this.#focusKey(key);
      return;
    }
    if (aid !== null && !this.emit<AqAccountOpenDetail>('ui-account-open', { providerId: pid, accountId: aid })) return;
    this.#open = next;
    this.#stops.set(keyOf('cap', pid), key);
    this.renderNow();
    this.#focusKey(key);
  }

  #close(refocus: boolean): void {
    const o = this.#open;
    if (!o) return;
    this.#open = null;
    this.renderNow();
    if (refocus) this.#focusKey(openKey(o));
  }

  /** A press outside the element's own markup closes the card — also one on the host's slotted content. */
  #onDocClick = (e: Event): void => {
    const at = e.composedPath()[0];
    if (this.#open && !(at instanceof Node && this.root.contains(at))) this.#close(false);
  };

  /** An event from the host's own slotted content (a job's live card) is the host's, never the element's. */
  #own(el: Element | null): boolean {
    return !!el && this.root.contains(el);
  }

  #toggleFold(section: AqSection): void {
    const collapsed = !this.#fold[section];
    if (!this.emit<AqCollapseDetail>('ui-collapse', { section, collapsed })) return;
    this.#fold[section] = collapsed;
    this.renderNow();
  }

  #onClick(e: Event): void {
    const el = e.target as Element | null;
    if (!el?.closest) return;
    if (!this.#own(el)) return;
    const fold = el.closest<HTMLElement>('.aq-fold[data-fold]');
    if (fold) {
      if (fold.dataset.fold === 'capacity' || fold.dataset.fold === 'lane') this.#toggleFold(fold.dataset.fold);
      return;
    }
    if (el.closest('.aq-pop-close')) {
      this.#close(true);
      return;
    }
    const mark = el.closest<HTMLElement>('.aq-mark[data-pid]');
    if (mark) {
      this.#toggle(mark.dataset.pid ?? '', mark.dataset.aid ?? null, mark.dataset.grp ?? null);
      return;
    }
    const job = el.closest<HTMLElement>('[data-job]');
    if (job) this.emit<AqJobOpenDetail>('ui-job-open', { jobId: job.dataset.job ?? '' });
    if (this.#open && !el.closest('.aq-pop')) this.#close(false);
  }

  #onKey(e: KeyboardEvent): void {
    if (!this.#own(e.target as Element | null)) return;
    if (e.key === 'Escape' && this.#open) {
      e.preventDefault();
      e.stopPropagation();
      this.#close(true);
      return;
    }
    const el = e.target as Element | null;
    const item = el?.closest?.<HTMLElement>('[data-rove-item]');
    const box = item?.closest<HTMLElement>('[data-rove]');
    if (!item || !box) return;
    const step = ({ ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1, Home: 'first', End: 'last' } as const)[
      e.key as 'Home'
    ] as number | 'first' | 'last' | undefined;
    if (step === undefined) return;
    const items = Array.from(box.querySelectorAll<HTMLElement>('[data-rove-item]'));
    const i = items.indexOf(item);
    if (i < 0) return;
    const j =
      step === 'first' ? 0 : step === 'last' ? items.length - 1 : Math.max(0, Math.min(items.length - 1, i + step));
    e.preventDefault();
    items.forEach((it, n) => {
      it.setAttribute('tabindex', n === j ? '0' : '-1');
    });
    items[j].focus();
    this.#stops.set(box.dataset.rove ?? '', items[j].dataset.key ?? '');
  }

  #onFocus(e: Event): void {
    if (!this.#own(e.target as Element | null)) return;
    const item = (e.target as Element | null)?.closest?.<HTMLElement>('[data-rove-item]');
    const box = item?.closest<HTMLElement>('[data-rove]');
    if (!item || !box) return;
    this.#stops.set(box.dataset.rove ?? '', item.dataset.key ?? '');
    for (const it of Array.from(box.querySelectorAll<HTMLElement>('[data-rove-item]')))
      it.setAttribute('tabindex', it === item ? '0' : '-1');
  }
}

define('ui-agent-queue', UiAgentQueue);

declare global {
  interface HTMLElementTagNameMap {
    'ui-agent-queue': UiAgentQueue;
  }
}
