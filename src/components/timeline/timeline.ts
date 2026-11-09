import { define, UiElement } from '../../core/element';
import { attrs, esc } from '../../core/html';
import { icon } from '../../icons/icons';
import {
  type TimelineActionDetail,
  type TimelineCheck,
  type TimelineData,
  type TimelineItemModel,
  type TimelineStrings,
  timelineDone,
  timelineItems,
  timelineMarker,
  timelineProgress,
  timelineStatus,
  timelineStrings,
} from './logic';
import { styles } from './styles';

export type {
  TimelineAction,
  TimelineActionDetail,
  TimelineCheck,
  TimelineData,
  TimelineItem,
  TimelineItemModel,
  TimelineLang,
  TimelineProgress,
  TimelineStatus,
  TimelineStrings,
  TimelineTone,
} from './logic';

/** Focus keys: one per checkbox and per action, unique whatever the ids hold. */
const checkKey = (id: string): string => JSON.stringify(['check', id]);
const actionKey = (id: string, action: string): string => JSON.stringify(['action', id, action]);

/**
 * `<ui-timeline>` — today's schedule as a checklist: a time column, a rail with a round marker per item (filled when
 * done, a ring while to do, coloured by the item), and a row card with the title, one detail line, a status pill,
 * quiet action buttons and a checkbox. The rail is ink from the first marker down to the last done one. An overdue
 * row is outlined in the fail colour and its time turns with it; the "now" row is softly highlighted. Ticking sends a
 * cancelable `ui-check` and, unless prevented, shows the new state at once (until the next `data`); an action sends a
 * cancelable `ui-action`. `compact` drops the cards for hairline-separated rows.
 */
export class UiTimeline extends UiElement<TimelineData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return ['lang', 'compact'];
  }

  /** The boxes ticked here since the last `data`: the next assignment is the truth again. */
  readonly #local = new Map<string, boolean>();
  #items: TimelineItemModel[] = [];

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override get data(): TimelineData | undefined {
    return super.data;
  }

  override set data(value: TimelineData | undefined) {
    this.#local.clear();
    super.data = value;
  }

  constructor() {
    super();
    this.root.addEventListener('click', (e) => {
      const t = e.target as Element | null;
      const box = t?.closest?.<HTMLElement>('.tl-check');
      if (box && this.root.contains(box)) {
        this.#toggle(box.dataset.id ?? '', e);
        return;
      }
      const act = t?.closest?.<HTMLElement>('.tl-act');
      if (act && this.root.contains(act)) this.#act(act.dataset.id ?? '', act.dataset.action ?? '', e);
    });
  }

  /** How many items are done now (local ticks included), of how many, and where the rail's ink ends. */
  get progress(): { done: number; total: number; split: number } {
    return timelineProgress(this.#view(timelineItems(this.data)));
  }

  get #s(): TimelineStrings {
    return timelineStrings(this.getAttribute('lang'));
  }

  /** Patched in place: a tick fills its marker and inks the rail with a transition; focus stays on its key. */
  protected override patchesInPlace(): boolean {
    return true;
  }

  /** The items with the local ticks applied. */
  #view(items: TimelineItemModel[]): TimelineItemModel[] {
    return items.map((it) =>
      it.checkable && this.#local.has(it.id) ? { ...it, checked: this.#local.get(it.id) === true } : it,
    );
  }

  protected render(): string {
    const d = this.data;
    const s = this.#s;
    const base = timelineItems(d);
    this.#items = base;
    const compact = this.hasAttribute('compact');
    if (!base.length) {
      const empty = (typeof d?.empty === 'string' && d.empty.trim()) || s.empty;
      return `<div class="tl" data-state="empty"${compact ? ' data-compact' : ''}><p class="tl-empty">${esc(empty)}</p></div>`;
    }
    const items = this.#view(base);
    const { split } = timelineProgress(items);
    const timed = items.some((it) => it.time);
    const name = (typeof d?.label === 'string' && d.label.trim()) || s.name;
    const rows = items.map((it, i) => this.#row(it, base[i], i, split, timed, s)).join('');
    return `<div${attrs({ class: 'tl', 'data-compact': compact, 'data-notime': !timed })}><ol${attrs({
      class: 'tl-list',
      'aria-label': name,
    })}>${rows}</ol></div>`;
  }

  #row(
    it: TimelineItemModel,
    from: TimelineItemModel,
    i: number,
    split: number,
    timed: boolean,
    s: TimelineStrings,
  ): string {
    const done = timelineDone(it);
    const late = it.overdue && !done;
    const status = timelineStatus(from, it.checked, s);
    const time = timed
      ? `<span class="tl-time">${esc(it.time)}${late && status?.text !== s.overdue ? `<span class="sr-only">, ${esc(s.overdue)}</span>` : ''}</span>`
      : '';
    const pill = status ? `<span class="tl-status" data-tone="${status.tone}">${esc(status.text)}</span>` : '';
    const acts = it.actions
      .map(
        (a) =>
          `<button${attrs({
            type: 'button',
            class: 'tl-act',
            'data-key': actionKey(it.id, a.id),
            'data-id': it.id,
            'data-action': a.id,
          })}>${esc(a.label)}</button>`,
      )
      .join('');
    const meta = pill || acts ? `<div class="tl-meta">${pill}${acts}</div>` : '';
    const box = it.checkable
      ? `<button${attrs({
          type: 'button',
          class: 'tl-check',
          role: 'checkbox',
          'aria-checked': String(it.checked),
          'aria-label': s.check(it.title),
          'data-key': checkKey(it.id),
          'data-id': it.id,
        })}><span class="tl-box">${icon('check', { size: 14, stroke: 2 })}</span></button>`
      : '';
    return `<li${attrs({
      class: 'tl-item',
      'data-mk': it.id,
      'data-tone': timelineMarker(it, done),
      'data-done': done,
      'data-overdue': late,
      'data-up': i > 0 && i <= split,
      'data-down': i < split,
      'aria-current': it.current ? 'time' : undefined,
    })}>${time}<span class="tl-rail" aria-hidden="true"><i class="tl-dot"></i></span><div class="tl-card"><div class="tl-main"><span class="tl-title">${esc(
      it.title,
    )}</span>${it.detail ? `<span class="tl-detail">${esc(it.detail)}</span>` : ''}</div>${meta}${box}</div></li>`;
  }

  /** Tick or untick item `id`: send `ui-check`; unless a listener prevents it (or sets data of its own), show it. */
  #toggle(id: string, e: Event): void {
    const base = this.#items.find((it) => it.id === id);
    if (!base?.checkable) return;
    const now = this.#local.has(id) ? this.#local.get(id) === true : base.checked;
    const detail: TimelineCheck = { id, checked: !now };
    const before = this.data;
    if (!this.emit('ui-check', detail)) return;
    // A listener that assigned data during the event spoke for itself: its data is the truth, not our guess.
    if (this.data === before) {
      this.#local.set(id, !now);
      this.renderNow();
    }
    this.sound('toggle', { direction: !now ? 'forward' : 'back' }, e);
  }

  #act(id: string, action: string, e: Event): void {
    const it = this.#items.find((x) => x.id === id);
    if (!it?.actions.some((a) => a.id === action)) return;
    const detail: TimelineActionDetail = { id, action };
    if (this.emit('ui-action', detail)) this.sound('tap', undefined, e);
  }
}

define('ui-timeline', UiTimeline);

declare global {
  interface HTMLElementTagNameMap {
    'ui-timeline': UiTimeline;
  }
}
