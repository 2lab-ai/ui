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
  clockLabel,
  countedAccounts,
  D7,
  DAY,
  type DayRuns,
  dayRuns,
  emptyReturnAt,
  exclusions,
  type ForecastStep,
  firstReturn,
  fmt1,
  fmtCount,
  fmtPct,
  forecastMarks,
  forecastSteps,
  gainWithin,
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
const COUNTDOWN = new Set<TimeKind>(['left', 'in', 'back', 'runs', 'about', 'aboutBack']);

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
  /** Capacity just unfolded: the next render's details enter once (a later data render does not replay it). */
  #capEnter = false;
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
    const wasFolded = this.#fold.capacity;
    for (const s of SECTIONS) if (typeof d.collapsed?.[s] === 'boolean') this.#fold[s] = d.collapsed[s] as boolean;
    if (this.#m && wasFolded && !this.#fold.capacity) this.#capEnter = true;
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

  /** The section's fold toggle (with `collapsible`): a quiet chevron; its word (hidden on a phone) says what a press does. */
  #foldBtn(section: AqSection, name: string, t: Strings): string {
    if (!this.data?.collapsible) return '';
    const folded = this.#fold[section];
    const word = folded ? t.fold.expand : t.fold.collapse;
    return `<button type="button" class="aq-fold" data-fold="${section}" data-key="fold-${section}" aria-expanded="${
      folded ? 'false' : 'true'
    }" aria-label="${escAttr(t.fold.aria(word, name))}"><span class="aq-fold-text">${esc(word)}</span>${CHEVRON_SVG}</button>`;
  }

  /**
   * Capacity is one calm table: a line per provider — name, meter, left / total, %, what comes back next, a note —
   * the same lines folded and unfolded. Unfolding opens each provider's detail under its own line (the line never
   * moves), so the folded view is the unfolded view's first read.
   */
  #capacity(m: AgentQueueData, now: number, t: Strings): string {
    const folded = this.#fold.capacity;
    const foldable = !!this.data?.collapsible;
    const sub = folded
      ? ''
      : [m.capacityNote ? esc(m.capacityNote) : '', this.#time('fetched', m.fetchedAt, now, t, 'aq-ago')]
          .filter(Boolean)
          .join(' · ');
    const head = `<div class="cap-head"><h2 class="cap-title">${esc(t.capTitle)}</h2>${
      sub ? `<span class="cap-sub">${sub}</span>` : ''
    }${this.#foldBtn('capacity', t.capTitle, t)}</div>`;
    const open = `<section class="capacity${folded ? ' is-collapsed' : ''}${foldable ? ' is-foldable' : ''}" aria-label="${escAttr(
      t.capTitle,
    )}">${head}`;
    if (m.capacityError !== undefined)
      return `${open}<p class="cap-off is-error" title="${escAttr(m.capacityError)}">${esc(
        t.capError(m.capacityError || '—'),
      )}</p></section>`;
    const ps = m.providers ?? [];
    if (!ps.length) return `${open}<p class="cap-off">${esc(t.capNone)}</p></section>`;
    // The section's inner width sizes the forecast (SVG in px, labels unscaled) and fits the workers strip.
    const width = this.#width > 0 ? this.#width : this.clientWidth > 0 ? this.clientWidth : 900;
    const W = Math.max(220, Math.round(width) - 32 - 28);
    return `${open}<div class="cap-table" role="group" aria-label="${escAttr(t.line.aria)}">${ps
      .map((p, i) => this.#provider(advanceProvider(p, now), i, now, t, W, folded))
      .join('')}</div></section>`;
  }

  #provider(p: AqProvider, idx: number, now: number, t: Strings, W: number, folded: boolean): string {
    const state = poolState(p);
    const line = this.#line(p, state, now, t);
    const detail = folded ? '' : this.#detail(p, idx, state, now, t, W);
    return `<section class="cap-prov is-${state}" aria-label="${escAttr(t.capAria(p.name))}">${line}${detail}</section>`;
  }

  /**
   * One provider on one line: name · meter · left / total · % · next gain and when · up to two notes. The columns are
   * aria-hidden; one sentence says the line to a screen reader, its countdown a live <time> the 1 Hz tick rewrites.
   */
  #line(p: AqProvider, state: AqPoolState, now: number, t: Strings): string {
    const key = primaryKey(p);
    const total = Number(p.total) || 0;
    const known = total > 0 && state !== 'unknown';
    const v = Number(p[key]) || 0;
    const frac = known ? Math.max(0, Math.min(1, v / total)) : 0;
    const vs = known ? fmtCount(v, total) : '—';
    const ts = fmt1(total);
    const pct = known ? fmtPct(v, total) : '';
    const next = known ? this.#lineNext(p, key, state, now, t) : { html: '', said: '', saidHtml: '' };
    const notes = this.#notes(p, state, now, t);
    const head = known ? (key === 'fiveHour' ? t.line.saidNow : t.line.said)(p.name, vs, ts, pct) : p.name;
    const said = [head, next.said, ...notes.map((n) => n.text)].filter(Boolean).join(' · ');
    const saidHtml = [esc(head), next.saidHtml, ...notes.map((n) => esc(n.text))].filter(Boolean).join(' · ');
    const note = notes.map((n) => `<span class="cap-n${n.tone ? ` is-${n.tone}` : ''}">${esc(n.text)}</span>`).join('');
    return `<div class="cap-line" title="${escAttr(said)}"><span class="cap-l-name" aria-hidden="true">${esc(
      p.name,
    )}</span><span class="cap-l-meter" aria-hidden="true"><i style="width:${(frac * 100).toFixed(
      1,
    )}%"></i></span><span class="cap-l-val" aria-hidden="true"><b>${vs}</b>${
      known ? `<i>${esc(t.line.of(ts))}</i>` : ''
    }</span><span class="cap-l-pct" aria-hidden="true">${pct}</span><span class="cap-l-next" aria-hidden="true">${
      next.html
    }</span><span class="cap-l-note" aria-hidden="true">${note}</span><span class="sr-only">${saidHtml}</span></div>`;
  }

  /**
   * What comes back next, at a glance: “+1.0 in 8h”; an empty pool says when it is usable again. `said` is the
   * tooltip's part (clock times only — an attribute does not tick), `saidHtml` the screen-reader sentence's (a live
   * countdown and the clock time).
   */
  #lineNext(
    p: AqProvider,
    key: MeasureKey,
    state: AqPoolState,
    now: number,
    t: Strings,
  ): { html: string; said: string; saidHtml: string } {
    // The clock time and the gain are formatted numbers; the countdown takes the placeholder's place.
    const live = (sentence: string, at: number) => esc(sentence).replace('\u0000', this.#time('in', at, now, t));
    if (state === 'empty') {
      const at = emptyReturnAt(p, now);
      if (at === null) {
        const txt = esc(t.line.noBack);
        return { html: `<span class="cap-dim">${txt}</span>`, said: t.line.noBack, saidHtml: txt };
      }
      return {
        html: this.#time('aboutBack', at, now, t),
        said: t.line.titleBack(clockLabel(at, now)),
        saidHtml: live(t.line.saidBack('\u0000', clockLabel(at, now)), at),
      };
    }
    const e = nextRefill(p, key, now);
    if (!e) {
      const small = gainWithin(p, key, now);
      const txt = small > 0.0005 ? t.bar.backWithin(t.gain(small, fmt1)) : t.line.none;
      return { html: `<span class="cap-dim">${esc(txt)}</span>`, said: txt, saidHtml: esc(txt) };
    }
    const g = fmt1(Number(e[key]) || 0);
    return {
      html: `<b>${esc(t.line.gain(g))}</b> ${this.#time('about', e.at, now, t)}`,
      said: t.line.titleNext(g, clockLabel(e.at, now)),
      saidHtml: live(t.line.saidNext(g, '\u0000', clockLabel(e.at, now)), e.at),
    };
  }

  /**
   * What the line must also say, most important first, two at most (the detail has the rest): the pool's state word,
   * a reading over a day old, a fifth or more left out, limited accounts, an assumed tier. Words, not glyphs.
   */
  #notes(
    p: AqProvider,
    state: AqPoolState,
    now: number,
    t: Strings,
  ): Array<{ text: string; tone?: 'warn' | 'fail' | 'state' }> {
    const out: Array<{ text: string; tone?: 'warn' | 'fail' | 'state' }> = [];
    const lim = limitedAccounts(p).length;
    if (state === 'empty') out.push({ text: lim ? t.line.state.allLimited : t.line.state.empty, tone: 'fail' });
    else if (state === 'low') out.push({ text: t.line.state.low, tone: 'warn' });
    else if (state === 'unknown') out.push({ text: t.line.state.unknown, tone: 'state' });
    const age = p.measuredAt !== undefined ? (now - p.measuredAt) / 1000 : 0;
    if (age > 86400) out.push({ text: t.line.stale(t.age(age)), tone: 'warn' });
    const acc = p.accounts ?? [];
    const all = p.accountCount ?? acc.length;
    const counted = countedAccounts(p);
    if (all > 0 && counted < all * 0.8) out.push({ text: t.line.partial(counted, all) });
    if (lim && state !== 'empty') out.push({ text: t.line.limited(lim) });
    const assumed = acc.find((a) => a.tierAssumed && a.tier && a.state !== 'paused' && a.state !== 'excluded');
    if (assumed) out.push({ text: t.line.assumed(String(assumed.tier)) });
    return out.slice(0, 2);
  }

  /** The unfolded detail under a provider's line: the plain-words disclosure, accounts, the 7-day forecast. */
  #detail(p: AqProvider, idx: number, state: AqPoolState, now: number, t: Strings, W: number): string {
    const disc = this.#disclosure(p, now, t);
    let h = `<div class="cap-detail${this.#capEnter ? ' is-entering' : ''}${W < 600 ? ' is-narrow' : ''}">`;
    if (disc) h += `<p class="cap-disc">${disc}</p>`;
    const known = Number(p.total) > 0 && state !== 'unknown';
    // A provider with a 5-hour window keeps both measures here; its line shows the 5-hour one.
    if (known && has5h(p)) {
      h += this.#bar(p, 'fiveHour', now, t);
      if (p.weekly !== undefined && p.weekly !== null) h += this.#bar(p, 'weekly', now, t);
    }
    h += this.#workers(p, now, t, W);
    if (known) h += this.#forecast(p, idx, state, W, now, t);
    else h += `<p class="cap-off">${esc(t.bar.unknown)}</p>`;
    return `${h}</div>`;
  }

  /** One muted line in plain words, only what is non-zero: source, counted, limited and the first return, left out, estimates, the reading's age. */
  #disclosure(p: AqProvider, now: number, t: Strings): string {
    const acc = p.accounts ?? [];
    const all = p.accountCount ?? acc.length;
    const parts: string[] = [];
    if (p.source) parts.push(esc(p.source));
    if (all > 0) {
      const c = countedAccounts(p);
      parts.push(esc(c < all ? t.disc.reflected(c, all) : t.disc.accounts(all)));
    }
    const lim = limitedAccounts(p).length;
    if (lim) {
      const back = firstReturn(p);
      parts.push(
        esc(t.disc.limited(lim)) +
          (back !== null ? ` — ${esc(t.disc.firstBack)} ${this.#time('about', back, now, t, 'aq-left')}` : ''),
      );
    }
    const ex = exclusions(p);
    if (ex.held) parts.push(esc(t.disc.excluded(ex.held, t.disc.held)));
    if (ex.unknownTier) parts.push(esc(t.disc.excluded(ex.unknownTier, t.disc.unknownTier)));
    if (ex.noMeasure) parts.push(esc(t.disc.excluded(ex.noMeasure, t.disc.noMeasure)));
    const assumed = acc.filter((a) => a.tierAssumed && a.tier && a.state !== 'paused' && a.state !== 'excluded');
    if (assumed.length) parts.push(esc(t.disc.assumed(assumed.length, String(assumed[0].tier))));
    const est = p.estimated ?? acc.filter((a) => a.estimated).length;
    if (est) parts.push(esc(t.disc.estimated(est)));
    const un = p.unmeasured5h ?? acc.filter((a) => a.state === 'unmeasured').length;
    if (un) parts.push(esc(t.disc.unmeasured(un)));
    if (p.measuredAt !== undefined) {
      const age = (now - p.measuredAt) / 1000;
      // Over a day old, the reading the numbers rest on is flagged (a word in the warning ink, no glyph).
      if (age > 86400) parts.push(`<b class="cap-stale">${esc(t.disc.measured(t.age(age)))}</b>`);
      else if (age > 3600) parts.push(esc(t.disc.measured(t.age(age))));
    }
    return parts.join('<i class="cap-sep" aria-hidden="true"> · </i>');
  }

  /** A provider with a 5-hour window: one thin row per measure — label | meter | “x / total %” — and its next line. */
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
    return `<div class="cap-bar-row is-${five ? 'h5' : 'wk'}"><div class="cap-bar-lbl">${esc(label)}<i>${esc(
      sub,
    )}</i></div><div class="cap-bar" role="img" aria-label="${escAttr(t.bar.said(label, vs, ts, pct))}"><span style="width:${(
      frac * 100
    ).toFixed(
      1,
    )}%"></span></div><div class="cap-bar-val"><b>${vs}</b> ${esc(t.bar.of(ts))} <em>${pct}</em></div><div class="cap-bar-next">${this.#nextLine(
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
    // The 5-hour measure rising at a weekly reset is held down by the weekly limit: say so.
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

  /** One account: a usable one is its name; the first of a stack carries the stack's icon. */
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
    const label = said.filter(Boolean);
    return `<button type="button" class="aq-mark is-${a.state}" data-key="${escAttr(key)}" data-pid="${escAttr(
      p.id,
    )}" data-aid="${escAttr(a.id)}" data-rove-item tabindex="${stop ? 0 : -1}" aria-haspopup="dialog" aria-expanded="${open}" aria-label="${escAttr(
      label.join(', '),
    )}" title="${escAttr(label.join(' · '))}">${icon}<b>${esc(a.name)}</b></button>`;
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

  /**
   * The 7-day forecast on a linear week: the measure now, one step up per refill (labels merge when they would touch),
   * the days of the week under it and a dashed line at the pool's size (its title says it). An empty pool shades now →
   * its first return.
   */
  #forecast(p: AqProvider, idx: number, state: AqPoolState, W: number, now: number, t: Strings): string {
    const key = primaryKey(p);
    const total = Number(p.total) || 0;
    const v0 = Math.max(0, Math.min(total, Number(p[key]) || 0));
    // Each step rises by what the pool still has room for (a reset of an account that is already full shows nothing),
    // so the labels, the sentence and the line all say the same capped amounts.
    const steps: ForecastStep[] = [];
    let room = v0;
    for (const st of forecastSteps(p, key, now)) {
      const next = Math.min(total, room + st.gain);
      if (next - room > 1e-9) steps.push({ ...st, gain: next - room });
      room = next;
    }
    const gain = room - v0;
    const end = room;
    const empty = state === 'empty';
    // Under +0.05 the steps would read “+0.0”: the sentence says “< +0.1” as the line does, and no chart is drawn.
    const visible = gain >= 0.05;
    const sum = visible
      ? t.fc.sum(fmt1(gain), fmt1(end))
      : gain > 0.0005
        ? t.bar.backWithin(t.gain(gain, fmt1))
        : t.fc.none;
    const head = `<div class="cap-fc-h"><span class="cap-fc-t">${esc(t.fc.title)}</span><span class="cap-fc-s">${esc(
      sum,
    )}</span></div>`;
    // Nothing (visible) comes back and nothing is held back: the line would be flat — the sentence says it.
    if (!visible && !empty) return `<div class="cap-fc">${head}</div>`;
    const H = W < 420 ? 84 : 100;
    const top = 20;
    const base = H - 20;
    const x = (at: number) => Math.max(0, Math.min(W, ((at - now) / D7) * W));
    const y = (v: number) => top + (1 - Math.max(0, Math.min(1, v / total))) * (base - top);
    const n = (v: number) => v.toFixed(1);
    const aria = visible ? t.fc.aria(fmt1(v0), fmt1(gain), fmt1(end)) : `${t.fc.title}: ${sum}`;
    let s = `<svg class="cap-fc-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escAttr(
      aria,
    )}">`;
    // The days: a faint rule at each local midnight, the weekday centred in its span (today's reads “today”).
    const days: number[] = [now];
    const mid = new Date(now);
    mid.setHours(24, 0, 0, 0);
    for (let at = mid.getTime(); at < now + D7; ) {
      days.push(at);
      const d = new Date(at);
      d.setDate(d.getDate() + 1);
      at = d.getTime();
    }
    days.push(now + D7);
    const wd = new Intl.DateTimeFormat(this.#lang === 'ko' ? 'ko-KR' : 'en-US', { weekday: 'short' });
    for (let i = 0; i < days.length - 1; i++) {
      const x0 = x(days[i]);
      const x1 = x(days[i + 1]);
      if (i > 0) s += `<line class="cap-fc-grid" x1="${n(x0)}" x2="${n(x0)}" y1="${top}" y2="${base}"/>`;
      if (x1 - x0 >= 18)
        s += `<text class="cap-fc-ax" x="${n((x0 + x1) / 2)}" y="${H - 4}" text-anchor="middle">${esc(
          i === 0 ? t.fc.today : wd.format(new Date(days[i])),
        )}</text>`;
    }
    if (empty) {
      // Usable again when the line says so (emptyReturnAt): one rule for both.
      const lift = emptyReturnAt(p, now);
      const x1 = lift === null ? W : x(lift);
      const hid = `aqh-${idx}`;
      const title = lift === null ? t.fc.limNone : t.fc.lim(clockLabel(lift, now));
      s += `<defs><pattern id="${hid}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="cap-fc-hatch" x1="0" y1="0" x2="0" y2="6"/></pattern></defs>`;
      s += `<rect class="cap-fc-lim" x="0" y="${top}" width="${n(x1)}" height="${base - top}"><title>${esc(title)}</title></rect>`;
      s += `<rect x="0" y="${top}" width="${n(x1)}" height="${base - top}" fill="url(#${hid})" aria-hidden="true"/>`;
    }
    s += `<line class="cap-fc-max" x1="0" x2="${W}" y1="${top}" y2="${top}"><title>${esc(t.fc.max(fmt1(total)))}</title></line>`;
    s += `<line class="cap-fc-base" x1="0" x2="${W}" y1="${base}" y2="${base}"/>`;
    // The step line and the area under it.
    let d = `M0 ${n(y(v0))}`;
    let v = v0;
    const after = new Map<number, number>();
    for (const st of steps) {
      v = Math.min(total, v + st.gain);
      d += ` H${n(x(st.at))} V${n(y(v))}`;
      after.set(st.at, v);
    }
    d += ` H${W}`;
    s += `<path class="cap-fc-area" d="${d} V${base} H0 Z"/>`;
    s += `<path class="cap-fc-line" d="${d}"/>`;
    s += `<circle class="cap-fc-dot" cx="0" cy="${n(y(v0))}" r="3"/>`;
    // One label per run of close steps (measured where the labels sit, clamped inside the chart), at the run's first
    // step, lifted above the run's highest point; a run says its span and how many returns in its tooltip.
    const lx = (at: number) => Math.max(14, Math.min(W - 14, x(at)));
    for (const mk of forecastMarks(steps, lx, 36)) {
      const y0 = y(after.get(mk.at) ?? v);
      const y1 = y(after.get(mk.end) ?? v);
      const gs = fmt1(mk.gain);
      const tip =
        mk.n > 1
          ? t.fc.run(gs, clockLabel(mk.at, now), clockLabel(mk.end, now), mk.n, mk.names.join(', '))
          : t.fc.mark(gs, timeText('in', mk.at, now, t), clockLabel(mk.at, now), mk.names.join(', '));
      const label =
        mk.gain >= 0.05
          ? `<text class="cap-fc-gain" x="${n(mk.x)}" y="${n(Math.max(11, Math.min(y0, y1) - 8))}" text-anchor="middle">+${gs}</text>`
          : '';
      s += `<g class="cap-fc-mk"><circle class="cap-fc-dot" cx="${n(x(mk.at))}" cy="${n(y0)}" r="3"/>${label}<title>${esc(
        tip,
      )}</title></g>`;
    }
    s += '</svg>';
    return `<div class="cap-fc">${head}${s}</div>`;
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
    this.#capEnter = false;
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

  #toggle(pid: string, aid: string | null, grp: string | null, e: Event): void {
    const next: OpenCard = { pid, aid, grp: aid === null ? (grp ?? OK_STACK) : null };
    const key = openKey(next);
    const o = this.#open;
    if (o && o.pid === pid && o.aid === next.aid && o.grp === next.grp) {
      this.#open = null;
      this.renderNow();
      this.#focusKey(key);
      this.sound('close', undefined, e);
      return;
    }
    if (aid !== null && !this.emit<AqAccountOpenDetail>('ui-account-open', { providerId: pid, accountId: aid })) return;
    this.#open = next;
    this.#stops.set(keyOf('cap', pid), key);
    this.renderNow();
    this.#focusKey(key);
    this.sound('open', undefined, e);
  }

  /** Close the account card; false when none was open. */
  #close(refocus: boolean): boolean {
    const o = this.#open;
    if (!o) return false;
    this.#open = null;
    this.renderNow();
    if (refocus) this.#focusKey(openKey(o));
    return true;
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

  #toggleFold(section: AqSection, e: Event): void {
    const collapsed = !this.#fold[section];
    if (!this.emit<AqCollapseDetail>('ui-collapse', { section, collapsed })) return;
    this.#fold[section] = collapsed;
    if (section === 'capacity' && !collapsed) this.#capEnter = true;
    this.renderNow();
    this.sound(collapsed ? 'close' : 'open', { emphasis: 'subtle' }, e);
  }

  #onClick(e: Event): void {
    const el = e.target as Element | null;
    if (!el?.closest) return;
    if (!this.#own(el)) return;
    const fold = el.closest<HTMLElement>('.aq-fold[data-fold]');
    if (fold) {
      if (fold.dataset.fold === 'capacity' || fold.dataset.fold === 'lane') this.#toggleFold(fold.dataset.fold, e);
      return;
    }
    // Capacity folds from its whole head row, and a folded section opens from anywhere on it (the button is the
    // keyboard's way in; these are the pointer's bigger targets).
    const cap = el.closest<HTMLElement>('.capacity.is-foldable');
    // A drag that selected text is a selection, not a press.
    // ShadowRoot.getSelection is Chromium's; elsewhere the document's selection stands in for it.
    const sel =
      (this.root as ShadowRoot & { getSelection?: () => Selection | null }).getSelection?.() ??
      (typeof document.getSelection === 'function' ? document.getSelection() : null);
    const selecting = !!sel && !sel.isCollapsed && sel.toString().trim() !== '';
    if (
      cap &&
      !selecting &&
      !el.closest('button, a, .aq-pop') &&
      (cap.classList.contains('is-collapsed') || el.closest('.cap-head'))
    ) {
      this.#toggleFold('capacity', e);
      return;
    }
    if (el.closest('.aq-pop-close')) {
      if (this.#close(true)) this.sound('close', undefined, e);
      return;
    }
    const mark = el.closest<HTMLElement>('.aq-mark[data-pid]');
    if (mark) {
      this.#toggle(mark.dataset.pid ?? '', mark.dataset.aid ?? null, mark.dataset.grp ?? null, e);
      return;
    }
    const job = el.closest<HTMLElement>('[data-job]');
    if (job && this.emit<AqJobOpenDetail>('ui-job-open', { jobId: job.dataset.job ?? '' }))
      this.sound('navigate', undefined, e);
    // Closed by a press elsewhere: silent, the press may sound for itself.
    if (this.#open && !el.closest('.aq-pop')) this.#close(false);
  }

  #onKey(e: KeyboardEvent): void {
    if (!this.#own(e.target as Element | null)) return;
    if (e.key === 'Escape' && this.#open) {
      e.preventDefault();
      e.stopPropagation();
      this.#close(true);
      this.sound('close', undefined, e);
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
