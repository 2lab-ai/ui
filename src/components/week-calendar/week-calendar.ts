import { define, UiElement } from '../../core/element';
import { attrs, esc, escAttr } from '../../core/html';
import { lastEnabled, rovingIndex } from '../../core/roving';
import { icon } from '../../icons/icons';
import {
  dayLabel,
  dayNumber,
  eventLanes,
  eventSpan,
  fmtHm,
  fmtMinutes,
  listGroups,
  localNow,
  moveEvent,
  parseDay,
  snapMinutes,
  type WeekCalendarData,
  type WeekEvent,
  type WeekKind,
  type WeekLane,
  type WeekLang,
  type WeekMoveDetail,
  type WeekOpenDetail,
  type WeekRangeDetail,
  type WeekSlot,
  type WeekView,
  type WeekViewDetail,
  weekDayCount,
  weekDays,
  weekdayName,
  weekHours,
  weekKind,
  weekRangeLabel,
  weekStep,
} from './logic';
import { type WeekStrings, weekStrings } from './strings';
import { styles } from './styles';

/** The phone breakpoint `view: 'auto'` follows. */
const PHONE = '(max-width: 639px)';
/** A finger holds this long on a block before it lifts for a drag (shorter moves scroll the grid). */
export const LONG_PRESS_MS = 350;
/** A finger that moves this far before the long press is scrolling; a mouse or pen this far starts a drag. */
const TOUCH_SLOP = 8;
const POINTER_SLOP = 4;
/** Dragging this close to the scroller's edge scrolls it, this much per move. */
const EDGE = 32;
const EDGE_STEP = 14;
/** The click that ends a drag is not an open. */
const EAT_CLICK_MS = 400;

/** An event placed in the shown range (a local move applied). */
interface Slot extends WeekSlot {
  id: string;
  ev: WeekEvent;
  /** Column index. */
  di: number;
  /** Start / end in minutes. */
  s: number;
  e: number;
  kind: WeekKind;
  locked: boolean;
}

interface Model {
  days: string[];
  h0: number;
  h1: number;
  step: number;
  today: string;
  now: { day: string; min: number } | null;
  slots: Slot[];
  lanes: Map<string, WeekLane>;
}

interface Press {
  id: string;
  pointerId: number;
  touch: boolean;
  x: number;
  y: number;
  el: HTMLElement;
  timer: ReturnType<typeof setTimeout> | undefined;
}

interface Drag {
  id: string;
  pointerId: number;
  el: HTMLElement;
  slot: Slot;
  /** Minutes between the pointer and the block's start when it was picked up. */
  grab: number;
  di: number;
  to: WeekSlot;
}

/** A style number: at most four decimals, no trailing zeros. */
const num = (n: number) => String(Math.round(n * 10_000) / 10_000);

const emptyModel = (): Model => ({
  days: [],
  h0: 7,
  h1: 22,
  step: 15,
  today: '',
  now: null,
  slots: [],
  lanes: new Map(),
});

/**
 * `<ui-week-calendar>` — what runs when this week: day columns on an hour grid with the events as blocks (ink,
 * accent, hatched, outlined, run / fail tints; a lock on fixed ones), today hatched and a red now line; on phones
 * (`view: 'auto'`) the same data as a list grouped by day. ‹ › send `ui-range`, the Week | List switch `ui-view`, a
 * block or row `ui-open`; dragging a block (a long press on touch) or Alt+arrows send `ui-move`, and the move is kept
 * locally until the next `data` unless a listener cancels it. Every event is cancelable.
 */
export class UiWeekCalendar extends UiElement<WeekCalendarData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return ['lang'];
  }

  /** Moves the host let through, kept until the next `data`. */
  readonly #moves = new Map<string, WeekSlot>();
  /** The view the switch pinned (until the host's `view` changes). */
  #pin: WeekView | null = null;
  /** `now` set through the property (wins until a `data` that carries its own `now`). */
  #now: string | undefined;
  #mq: MediaQueryList | null = null;
  readonly #onMq = () => this.requestRender();
  #model: Model = emptyModel();
  #said = '';
  #press: Press | null = null;
  #drag: Drag | null = null;
  #eatUntil = 0;
  #scrolled = false;
  readonly #onDocKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !this.#drag) return;
    e.preventDefault();
    e.stopPropagation();
    this.#abort();
  };

  constructor() {
    super();
    const r = this.root;
    r.addEventListener('click', (e) => this.#onClick(e as MouseEvent));
    r.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    r.addEventListener('pointerdown', (e) => this.#onDown(e as PointerEvent));
    r.addEventListener('pointermove', (e) => this.#onMove(e as PointerEvent));
    r.addEventListener('pointerup', (e) => this.#onUp(e as PointerEvent));
    r.addEventListener('pointercancel', (e) => this.#onCancel(e as PointerEvent));
    // A lifted block holds the finger: the grid must not scroll under it.
    r.addEventListener(
      'touchmove',
      (e) => {
        if (this.#drag && e.cancelable) e.preventDefault();
      },
      { passive: false },
    );
    // A long press is a lift, not the context menu.
    r.addEventListener('contextmenu', (e) => {
      if (this.#press?.touch || this.#drag) e.preventDefault();
    });
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override get data(): WeekCalendarData | undefined {
    return super.data;
  }

  /** The host's data is the truth: local moves go; a new `view` from the host replaces the switch's pin. */
  override set data(value: WeekCalendarData | undefined) {
    const before = super.data;
    this.#moves.clear();
    if (viewMode(before?.view) !== viewMode(value?.view)) this.#pin = null;
    if (value?.now !== undefined) this.#now = undefined;
    super.data = value;
    this.#syncMedia();
  }

  /** The time now (ISO). Setting it moves only the now line (local moves stay); `data.now` works too. */
  get now(): string | undefined {
    return this.#now ?? this.data?.now;
  }

  set now(value: string | undefined) {
    this.#now = value ?? undefined;
    this.requestRender();
  }

  /** The view drawn now: the switch's pin, else the host's `view`, else (auto) the list under 640px. */
  get view(): WeekView {
    if (this.#pin) return this.#pin;
    const v = viewMode(this.data?.view);
    if (v !== 'auto') return v;
    return this.#mq?.matches ? 'list' : 'week';
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#syncMedia();
  }

  override disconnectedCallback(): void {
    this.#syncMedia();
    this.#clearPress();
    if (this.#drag) {
      this.#drag = null;
      document.removeEventListener('keydown', this.#onDocKey, true);
    }
  }

  get #lang(): WeekLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  get #t(): WeekStrings {
    return weekStrings(this.getAttribute('lang'));
  }

  /** Watch the phone breakpoint only while connected and in auto (nothing pinned, no view from the host). */
  #syncMedia(): void {
    const want =
      this.isConnected && !this.#pin && viewMode(this.data?.view) === 'auto' && typeof matchMedia === 'function';
    if (want === !!this.#mq) return;
    if (want) {
      this.#mq = matchMedia(PHONE);
      this.#mq.addEventListener?.('change', this.#onMq);
      return;
    }
    this.#mq?.removeEventListener?.('change', this.#onMq);
    this.#mq = null;
  }

  /** Patched in place (blocks glide to a new slot); focus is put back by data-key when a block changes column. */
  protected override patchesInPlace(): boolean {
    return true;
  }

  protected override updated(): void {
    this.#scrollToNow();
  }

  // ── model ─────────────────────────────────────────────────────────────────

  #modelOf(d: WeekCalendarData | undefined): Model {
    const now = localNow(this.now);
    const days = weekDays(d?.start ?? '', weekDayCount(d?.days));
    const [h0, h1] = weekHours(d?.hours);
    const today = typeof d?.today === 'string' && !Number.isNaN(parseDay(d.today)) ? d.today : (now?.day ?? '');
    const index = new Map(days.map((day, i) => [day, i]));
    const seen = new Set<string>();
    const slots: Slot[] = [];
    for (const ev of Array.isArray(d?.events) ? d.events : []) {
      if (!ev || typeof ev !== 'object' || (typeof ev.id !== 'string' && typeof ev.id !== 'number')) continue;
      const id = String(ev.id);
      if (seen.has(id)) continue;
      seen.add(id);
      const at = this.#moves.get(id) ?? { day: ev.day, start: ev.start, end: ev.end };
      const di = index.get(at.day);
      if (di === undefined) continue;
      const { s, e } = eventSpan(at);
      if (Number.isNaN(s)) continue;
      slots.push({
        id,
        ev,
        day: at.day,
        start: fmtHm(s),
        end: fmtHm(e),
        di,
        s,
        e,
        kind: weekKind(ev.kind),
        locked: !!ev.locked,
      });
    }
    slots.sort((a, b) => a.di - b.di || a.s - b.s || b.e - a.e);
    return { days, h0, h1, step: weekStep(d?.step), today, now, slots, lanes: eventLanes(slots) };
  }

  // ── render ────────────────────────────────────────────────────────────────

  protected render(): string {
    const d = this.data;
    const t = this.#t;
    const lang = this.#lang;
    const m = this.#modelOf(d);
    this.#model = m;
    const view = this.view;
    const n = m.days.length || weekDayCount(d?.days);
    const range =
      typeof d?.rangeLabel === 'string' && d.rangeLabel.trim()
        ? d.rangeLabel
        : weekRangeLabel(m.days[0] ?? '', n, lang);
    const nav = (dir: -1 | 1) => {
      const label = dir < 0 ? t.prev(n) : t.next(n);
      return `<button${attrs({
        type: 'button',
        class: 'wk-nav-b',
        part: dir < 0 ? 'prev' : 'next',
        'data-key': `nav:${dir}`,
        'data-dir': dir,
        'aria-label': label,
        title: label,
      })}>${icon(dir < 0 ? 'chevron-left' : 'chevron-right')}</button>`;
    };
    const head = `<header class="wk-head" part="header"><div class="wk-nav">${nav(-1)}${nav(1)}<p class="wk-range" id="wk-range" part="range" aria-live="polite">${esc(
      range,
    )}</p></div>${this.#switch(view, t)}</header>`;
    const empty = typeof d?.empty === 'string' && d.empty ? d.empty : t.empty;
    let body: string;
    if (!m.days.length) body = `<p class="wk-empty" part="empty">${esc(empty)}</p>`;
    else if (view === 'list') body = this.#list(m, empty, t, lang);
    else body = this.#week(m, empty, t, lang);
    return `<section${attrs({
      class: 'wk',
      part: 'calendar',
      'data-view': view,
      'data-drag': !!this.#drag,
      'aria-label': range ? `${t.name}, ${range}` : t.name,
    })}>${head}${this.#meta(d, m, view, t)}${body}<p class="sr-only" id="wk-keys">${esc(
      t.keys(m.step),
    )}</p><p class="wk-live sr-only" role="status" aria-live="polite">${esc(this.#said)}</p></section>`;
  }

  #switch(view: WeekView, t: WeekStrings): string {
    const opts: Array<[WeekView, string, string]> = [
      ['week', t.week, 'board'],
      ['list', t.list, 'list'],
    ];
    const buttons = opts
      .map(
        ([v, label, glyph]) =>
          `<button${attrs({
            type: 'button',
            class: 'wk-seg-b',
            role: 'radio',
            'aria-checked': String(v === view),
            tabindex: v === view ? '0' : '-1',
            'data-key': `view:${v}`,
            'data-view': v,
          })}>${icon(glyph)}<span>${esc(label)}</span></button>`,
      )
      .join('');
    return `<div class="wk-seg" part="switch" role="radiogroup" aria-label="${escAttr(t.view)}" style="--i:${
      view === 'list' ? 1 : 0
    }"><span class="wk-seg-thumb" aria-hidden="true"></span>${buttons}</div>`;
  }

  /** The legend (swatch, words, count) and, in the week view with something movable, the drag hint. */
  #meta(d: WeekCalendarData | undefined, m: Model, view: WeekView, t: WeekStrings): string {
    const legend = (Array.isArray(d?.legend) ? d.legend : []).filter((x) => x && typeof x.label === 'string');
    const movable = view === 'week' && m.slots.some((s) => !s.locked);
    if (!legend.length && !movable) return '';
    const items = legend
      .map(
        (x) =>
          `<li><i class="wk-sw" data-kind="${weekKind(x.kind)}" aria-hidden="true"></i><span>${esc(x.label)}</span>${
            typeof x.count === 'number' && Number.isFinite(x.count) ? `<b>${esc(x.count)}</b>` : ''
          }</li>`,
      )
      .join('');
    return `<div class="wk-meta" part="legend">${items ? `<ul class="wk-legend">${items}</ul>` : ''}${
      movable ? `<p class="wk-hint">${esc(t.hint)}</p>` : ''
    }</div>`;
  }

  #week(m: Model, empty: string, t: WeekStrings, lang: WeekLang): string {
    const lo = m.h0 * 60;
    const hi = m.h1 * 60;
    let gutter = '';
    for (let h = m.h0; h < m.h1; h++) gutter += `<span class="wk-hl" style="--i:${h - m.h0}">${fmtHm(h * 60)}</span>`;
    const byDay: Slot[][] = m.days.map(() => []);
    for (const s of m.slots) byDay[s.di].push(s);
    let head = '';
    let cols = '';
    m.days.forEach((day, di) => {
      const today = day === m.today;
      head += `<div${attrs({
        class: 'wk-dh',
        'data-mk': `dh:${day}`,
        'data-today': today,
        'aria-hidden': 'true',
        style: `grid-column:${di + 2}`,
      })}><span class="wk-dw">${esc(weekdayName(day, lang))}</span><span class="wk-dn">${esc(dayNumber(day))}</span></div>`;
      const blocks = byDay[di]
        .filter((s) => s.e > lo && s.s < hi)
        .map((s) => this.#block(s, m, t, lang))
        .join('');
      const now =
        m.now && m.now.day === day && m.now.min >= lo && m.now.min <= hi
          ? `<div class="wk-now" part="now" aria-hidden="true" style="--t:${num((m.now.min - lo) / 60)}"></div>`
          : '';
      cols += `<div${attrs({
        class: 'wk-col',
        role: 'group',
        'data-mk': `col:${day}`,
        'data-day': day,
        'data-today': today,
        'aria-label': today ? `${dayLabel(day, lang)}, ${t.today}` : dayLabel(day, lang),
      })}>${blocks}${now}</div>`;
    });
    const note = m.slots.length ? '' : `<p class="wk-note" part="empty">${esc(empty)}</p>`;
    return `<div class="wk-scroll" part="grid"><div class="wk-grid" style="--days:${m.days.length};--rows:${
      m.h1 - m.h0
    }"><div class="wk-corner" aria-hidden="true"></div>${head}<div class="wk-gutter" aria-hidden="true">${gutter}</div><div class="wk-cols">${cols}${this.#ghost()}${note}</div></div></div>`;
  }

  #block(s: Slot, m: Model, t: WeekStrings, lang: WeekLang): string {
    const lo = m.h0 * 60;
    const top = Math.max(s.s, lo);
    const bottom = Math.min(s.e, m.h1 * 60);
    const len = s.e - s.s;
    // Under half an hour: the title alone · under 45 min: title and time on one line · from 75 min: the detail too.
    const size = len < 30 ? 'xs' : len < 45 ? 's' : len < 75 ? 'm' : 'l';
    const lane = m.lanes.get(s.id) ?? { lane: 0, lanes: 1 };
    const detail = typeof s.ev.detail === 'string' ? s.ev.detail : '';
    return `<button${attrs({
      type: 'button',
      class: 'wk-ev',
      part: 'event',
      'data-key': `ev:${s.id}`,
      'data-mk': `ev:${s.id}`,
      'data-id': s.id,
      'data-kind': s.kind,
      'data-size': size,
      'data-locked': s.locked,
      'data-dragging': this.#drag?.id === s.id,
      'aria-label': this.#name(s, t, lang),
      'aria-describedby': s.locked ? undefined : 'wk-keys',
      style: `--t:${num((top - lo) / 60)};--d:${num((bottom - top) / 60)};--l:${lane.lane};--n:${lane.lanes}`,
    })}><span class="wk-ev-title">${esc(s.ev.title)}</span>${
      size === 'xs' ? '' : `<span class="wk-ev-time">${s.start}–${s.end}</span>`
    }${size === 'l' && detail ? `<span class="wk-ev-detail">${esc(detail)}</span>` : ''}${
      s.locked ? icon('lock', { size: 11, class: 'wk-lock' }) : ''
    }</button>`;
  }

  /** "Nightly usage report, Wed 11 Nov, 21:00 – 21:30, cron 0 21 * * *, Fixed time". */
  #name(s: Slot, t: WeekStrings, lang: WeekLang): string {
    const parts = [String(s.ev.title ?? ''), dayLabel(s.day, lang), `${s.start} – ${s.end}`];
    if (typeof s.ev.detail === 'string' && s.ev.detail) parts.push(s.ev.detail);
    if (s.locked) parts.push(t.locked);
    return parts.join(', ');
  }

  #ghostState(): { style: string; title: string; time: string; short: boolean } | null {
    const d = this.#drag;
    if (!d) return null;
    const lo = this.#model.h0 * 60;
    const { s, e } = eventSpan(d.to);
    return {
      style: `--gi:${d.di};--t:${num((s - lo) / 60)};--d:${num((e - s) / 60)}`,
      title: String(d.slot.ev.title ?? ''),
      time: `${d.to.start}–${d.to.end}`,
      // Under 45 minutes there is room for one line: the time first, then as much of the title as fits.
      short: e - s < 45,
    };
  }

  #ghost(): string {
    const g = this.#ghostState();
    return `<div${attrs({
      class: 'wk-ghost',
      part: 'ghost',
      'aria-hidden': 'true',
      hidden: !g,
      'data-short': !!g?.short,
      style: g?.style,
    })}><b>${esc(g?.title)}</b><span>${esc(g?.time)}</span></div>`;
  }

  #list(m: Model, empty: string, t: WeekStrings, lang: WeekLang): string {
    const groups = listGroups(m.slots);
    if (!groups.length) return `<p class="wk-empty" part="empty">${esc(empty)}</p>`;
    const days = groups
      .map((g) => {
        const today = g.day === m.today;
        return `<section class="wk-day" data-mk="day:${escAttr(g.day)}"><h3${attrs({
          class: 'wk-day-h',
          'data-today': today,
          'aria-label': today ? `${dayLabel(g.day, lang)}, ${t.today}` : dayLabel(g.day, lang),
        })}><span class="wk-day-n" aria-hidden="true">${esc(dayNumber(g.day))}</span><span class="wk-day-w" aria-hidden="true">${esc(
          weekdayName(g.day, lang),
        )}</span></h3><ul class="wk-rows">${g.events.map((s) => this.#row(s, t, lang)).join('')}</ul></section>`;
      })
      .join('');
    return `<div class="wk-list" part="list">${days}</div>`;
  }

  #row(s: Slot, t: WeekStrings, lang: WeekLang): string {
    const detail = [fmtMinutes(s.e - s.s, lang), typeof s.ev.detail === 'string' ? s.ev.detail : '']
      .filter(Boolean)
      .join(' · ');
    return `<li data-mk="li:${escAttr(s.id)}"><button${attrs({
      type: 'button',
      class: 'wk-row',
      part: 'row',
      'data-key': `row:${s.id}`,
      'data-id': s.id,
      'data-locked': s.locked,
      'aria-label': this.#name(s, t, lang),
      'aria-describedby': s.locked ? undefined : 'wk-keys',
    })}><i class="wk-sw" data-kind="${s.kind}" aria-hidden="true"></i><span class="wk-row-time">${s.start}</span><span class="wk-row-main"><span class="wk-row-title">${esc(
      s.ev.title,
    )}</span><span class="wk-row-detail">${esc(detail)}</span></span><span class="wk-row-end" aria-hidden="true">${
      s.locked ? icon('lock', { size: 12 }) : ''
    }${icon('chevron-right')}</span></button></li>`;
  }

  /** The first time the now line is on screen, the grid scrolls to show it with some of the hour before. */
  #scrollToNow(): void {
    if (this.#scrolled || this.view !== 'week') return;
    const sc = this.$('.wk-scroll');
    const line = this.$('.wk-now');
    const col = line?.parentElement;
    if (!sc || !line || !col || !(sc.clientHeight > 0)) return;
    this.#scrolled = true;
    const hour = col.offsetHeight / Math.max(1, this.#model.h1 - this.#model.h0);
    sc.scrollTop = Math.max(0, line.offsetTop - hour * 1.5);
  }

  // ── actions ───────────────────────────────────────────────────────────────

  #announce(text: string): void {
    // The same words twice still get read: a no-break space tells them apart.
    this.#said = this.#said === text ? `${text} ` : text;
    const live = this.$('.wk-live');
    if (live) live.textContent = this.#said;
  }

  #open(id: string | undefined): void {
    if (id === undefined || !this.#model.slots.some((s) => s.id === id)) return;
    this.emit<WeekOpenDetail>('ui-open', { id });
  }

  #choose(v: WeekView): void {
    if (v === this.view) return;
    if (!this.emit<WeekViewDetail>('ui-view', { view: v })) return;
    this.#pin = v;
    this.#syncMedia();
    this.renderNow();
  }

  /** Send `ui-move`; unless a listener cancels (or sets data of its own), keep the slot until the next data. */
  #commit(s: Slot, to: WeekSlot): boolean {
    const before = this.data;
    const ok = this.emit<WeekMoveDetail>('ui-move', { id: s.id, day: to.day, start: to.start, end: to.end });
    if (ok) {
      if (this.data === before) this.#moves.set(s.id, { ...to });
      this.#announce(this.#t.moved(`${dayLabel(to.day, this.#lang)} ${to.start}`));
    }
    this.renderNow();
    return ok;
  }

  /** Alt+arrows: by the step (snapped to it) up or down, by a day left or right — inside the shown days and hours. */
  #nudge(id: string, dm: number, dd: number): void {
    const m = this.#model;
    const s = m.slots.find((x) => x.id === id);
    if (!s) return;
    if (s.locked) {
      this.#announce(this.#t.cannotMove);
      return;
    }
    const di = s.di + dd;
    if (di < 0 || di >= m.days.length) return;
    const deltaMin = dm ? snapMinutes(s.s + dm * m.step, m.step) - s.s : 0;
    const to = moveEvent(s, deltaMin, dd, [m.h0, m.h1]);
    if (to.day === s.day && to.start === s.start && to.end === s.end) return;
    this.#commit(s, to);
  }

  #onClick(e: MouseEvent): void {
    const target = e.target as Element | null;
    const item = target?.closest?.<HTMLElement>('.wk-ev, .wk-row');
    if (item?.classList.contains('wk-ev') && performance.now() < this.#eatUntil) {
      this.#eatUntil = 0;
      return;
    }
    const nav = target?.closest?.<HTMLElement>('.wk-nav-b');
    if (nav) {
      this.emit<WeekRangeDetail>('ui-range', { dir: nav.dataset.dir === '-1' ? -1 : 1 });
      return;
    }
    const seg = target?.closest?.<HTMLElement>('.wk-seg-b');
    if (seg) {
      this.#choose(seg.dataset.view === 'list' ? 'list' : 'week');
      return;
    }
    if (item) this.#open(item.dataset.id);
  }

  #onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && (this.#drag || this.#press)) {
      e.preventDefault();
      e.stopPropagation();
      this.#abort();
      return;
    }
    const target = e.target as Element | null;
    const seg = target?.closest?.<HTMLElement>('.wk-seg-b');
    if (seg) {
      this.#onSwitchKey(e, seg);
      return;
    }
    const item = target?.closest?.<HTMLElement>('.wk-ev, .wk-row');
    if (!item) return;
    const id = item.dataset.id ?? '';
    if ((e.key === 'Enter' || e.key === ' ') && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      this.#open(id);
      return;
    }
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    const rtl = getComputedStyle(this).direction === 'rtl';
    let dm = 0;
    let dd = 0;
    switch (e.key) {
      case 'ArrowUp':
        dm = -1;
        break;
      case 'ArrowDown':
        dm = 1;
        break;
      case 'ArrowLeft':
        dd = rtl ? 1 : -1;
        break;
      case 'ArrowRight':
        dd = rtl ? -1 : 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    this.#nudge(id, dm, dd);
  }

  /** The switch is a radio group: arrows (and Home / End) move focus and choose. */
  #onSwitchKey(e: KeyboardEvent, seg: HTMLElement): void {
    const views: WeekView[] = ['week', 'list'];
    const none = [false, false];
    const at = Math.max(0, views.indexOf(seg.dataset.view as WeekView));
    const rtl = getComputedStyle(this).direction === 'rtl';
    let next = -1;
    switch (e.key) {
      case 'ArrowRight':
        next = rovingIndex(none, at, rtl ? -1 : 1);
        break;
      case 'ArrowLeft':
        next = rovingIndex(none, at, rtl ? 1 : -1);
        break;
      case 'ArrowDown':
        next = rovingIndex(none, at, 1);
        break;
      case 'ArrowUp':
        next = rovingIndex(none, at, -1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = lastEnabled(none);
        break;
      default:
        return;
    }
    e.preventDefault();
    const btns = this.$$<HTMLElement>('.wk-seg-b');
    const b = btns[next];
    if (!b) return;
    for (const x of btns) x.setAttribute('tabindex', x === b ? '0' : '-1');
    b.focus();
    this.#choose(views[next]);
  }

  // ── drag ──────────────────────────────────────────────────────────────────

  #onDown(e: PointerEvent): void {
    if (this.#drag || this.#press || e.button !== 0 || this.view !== 'week') return;
    const el = (e.target as Element | null)?.closest?.<HTMLElement>('.wk-ev');
    if (!el || el.getRootNode() !== this.root) return;
    const s = this.#model.slots.find((x) => x.id === el.dataset.id);
    if (!s || s.locked) return;
    const touch = e.pointerType === 'touch';
    const press: Press = { id: s.id, pointerId: e.pointerId, touch, x: e.clientX, y: e.clientY, el, timer: undefined };
    this.#press = press;
    // A finger lifts the block only after a still long press, so a swipe across blocks still scrolls the grid.
    if (touch)
      press.timer = setTimeout(() => this.#press === press && this.#begin(press, press.x, press.y), LONG_PRESS_MS);
  }

  #onMove(e: PointerEvent): void {
    const p = this.#press;
    if (p && e.pointerId === p.pointerId) {
      const far = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      if (p.touch) {
        if (far > TOUCH_SLOP) this.#clearPress();
        return;
      }
      if (far <= POINTER_SLOP) return;
      this.#begin(p, e.clientX, e.clientY);
      return;
    }
    const d = this.#drag;
    if (!d || e.pointerId !== d.pointerId) return;
    e.preventDefault();
    this.#follow(e.clientX, e.clientY);
  }

  #onUp(e: PointerEvent): void {
    const p = this.#press;
    if (p && e.pointerId === p.pointerId) {
      // Never lifted: a plain press — the click that follows opens it.
      this.#clearPress();
      return;
    }
    const d = this.#drag;
    if (!d || e.pointerId !== d.pointerId) return;
    this.#endDrag();
    this.#eatUntil = performance.now() + EAT_CLICK_MS;
    if (d.to.day !== d.slot.day || d.to.start !== d.slot.start || d.to.end !== d.slot.end) this.#commit(d.slot, d.to);
    else this.renderNow();
  }

  #onCancel(e: PointerEvent): void {
    if (this.#press && e.pointerId === this.#press.pointerId) this.#clearPress();
    if (this.#drag && e.pointerId === this.#drag.pointerId) this.#abort();
  }

  #clearPress(): void {
    if (this.#press?.timer !== undefined) clearTimeout(this.#press.timer);
    this.#press = null;
  }

  /** The grid's day area on screen: where the columns are and how tall an hour is. */
  #geo(): { left: number; top: number; colW: number; hourPx: number } | null {
    const r = this.$('.wk-cols')?.getBoundingClientRect();
    const m = this.#model;
    if (!r || !(r.width > 0) || !(r.height > 0) || !m.days.length) return null;
    return { left: r.left, top: r.top, colW: r.width / m.days.length, hourPx: r.height / (m.h1 - m.h0) };
  }

  #minuteAt(y: number, g: { top: number; hourPx: number }): number {
    return this.#model.h0 * 60 + ((y - g.top) / g.hourPx) * 60;
  }

  /** Lift the block: grab it where the press found it, show the ghost there, follow the pointer to (x, y). */
  #begin(p: Press, x: number, y: number): void {
    this.#clearPress();
    const s = this.#model.slots.find((v) => v.id === p.id);
    const g = this.#geo();
    if (!s || !g || !p.el.isConnected) return;
    try {
      p.el.setPointerCapture(p.pointerId);
    } catch {
      // A synthetic or already-gone pointer: the drag still follows while the pointer stays over the grid.
    }
    this.#drag = {
      id: s.id,
      pointerId: p.pointerId,
      el: p.el,
      slot: s,
      grab: this.#minuteAt(p.y, g) - s.s,
      di: s.di,
      to: { day: s.day, start: s.start, end: s.end },
    };
    document.addEventListener('keydown', this.#onDocKey, true);
    p.el.setAttribute('data-dragging', '');
    this.$('.wk')?.setAttribute('data-drag', '');
    this.#follow(x, y);
  }

  /** The ghost follows: snapped to the step vertically, to the day column horizontally, kept inside the hours. */
  #follow(x: number, y: number): void {
    const d = this.#drag;
    if (!d) return;
    this.#edgeScroll(x, y);
    const g = this.#geo();
    if (!g) return;
    const m = this.#model;
    const di = Math.min(m.days.length - 1, Math.max(0, Math.floor((x - g.left) / g.colW)));
    const start = snapMinutes(this.#minuteAt(y, g) - d.grab, m.step);
    d.di = di;
    d.to = moveEvent(d.slot, start - d.slot.s, di - d.slot.di, [m.h0, m.h1]);
    this.#paintGhost();
  }

  #paintGhost(): void {
    const ghost = this.$('.wk-ghost');
    const g = this.#ghostState();
    if (!ghost) return;
    ghost.hidden = !g;
    if (!g) return;
    ghost.setAttribute('style', g.style);
    ghost.toggleAttribute('data-short', g.short);
    const [title, time] = Array.from(ghost.children);
    if (title) title.textContent = g.title;
    if (time) time.textContent = g.time;
  }

  /** Near the scroller's edges (inside the sticky day row and hour gutter) the grid scrolls under the drag. */
  #edgeScroll(x: number, y: number): void {
    const sc = this.$('.wk-scroll');
    const r = sc?.getBoundingClientRect();
    if (!sc || !r || !(r.height > 0)) return;
    const top = r.top + (this.$('.wk-dh')?.offsetHeight ?? 0);
    const left = r.left + (this.$('.wk-gutter')?.offsetWidth ?? 0);
    if (y < top + EDGE) sc.scrollTop -= EDGE_STEP;
    else if (y > r.bottom - EDGE) sc.scrollTop += EDGE_STEP;
    if (x < left + EDGE) sc.scrollLeft -= EDGE_STEP;
    else if (x > r.right - EDGE) sc.scrollLeft += EDGE_STEP;
  }

  #endDrag(): void {
    const d = this.#drag;
    if (!d) return;
    this.#drag = null;
    document.removeEventListener('keydown', this.#onDocKey, true);
    try {
      d.el.releasePointerCapture(d.pointerId);
    } catch {
      // Not captured (synthetic pointer): nothing to release.
    }
  }

  /** Put it back: no move, no event. */
  #abort(): void {
    this.#clearPress();
    if (!this.#drag) return;
    this.#endDrag();
    this.#eatUntil = performance.now() + EAT_CLICK_MS;
    this.renderNow();
  }
}

function viewMode(v: unknown): WeekView | 'auto' {
  return v === 'week' || v === 'list' ? v : 'auto';
}

define('ui-week-calendar', UiWeekCalendar);

declare global {
  interface HTMLElementTagNameMap {
    'ui-week-calendar': UiWeekCalendar;
  }
}
