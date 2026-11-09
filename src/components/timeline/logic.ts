/**
 * Pure model for `<ui-timeline>`: the item normaliser, what counts as done, the progress and the rail's split, the
 * status a row shows and the strings. Nothing here touches the DOM.
 */

/** The colour a marker or a status reads in: done · run (running now) · wait · fail · idle (neutral). */
export type TimelineTone = 'done' | 'run' | 'wait' | 'fail' | 'idle';
export type TimelineLang = 'en' | 'ko';

export interface TimelineAction {
  /** What `ui-action` carries back as `action`. Unique within the item. */
  id: string;
  label: string;
}

export interface TimelineStatus {
  text: string;
  tone?: TimelineTone;
}

export interface TimelineItem {
  /** What `ui-check` / `ui-action` carry back. Unique within the timeline. */
  id: string;
  /** The time column ("08:00"). */
  time?: string;
  title: string;
  /** One quiet line under the title. */
  detail?: string;
  /** The marker's colour (and the status pill's, when the status has no tone of its own). */
  tone?: TimelineTone;
  /** The pill at the right ("Ran 07:01", "Missed", "Later"). */
  status?: TimelineStatus;
  /** Draw a checkbox: ticking it sends `ui-check`. */
  checkable?: boolean;
  checked?: boolean;
  /** Late: the row is outlined and its time drawn in the fail colour (until it is done). */
  overdue?: boolean;
  /** Quiet text buttons ("Run now", "Skip"): each sends `ui-action`. */
  actions?: TimelineAction[];
  /** The "now" row: a subtle highlight, aria-current="time". */
  current?: boolean;
}

export interface TimelineData {
  /** The list's accessible name ("Scheduled jobs today"). */
  label?: string;
  items: TimelineItem[];
  /** Words when there are no items. */
  empty?: string;
}

/** `ui-check` detail: the box the person ticked (or unticked) and its new state. */
export interface TimelineCheck {
  id: string;
  checked: boolean;
}

/** `ui-action` detail. */
export interface TimelineActionDetail {
  id: string;
  action: string;
}

/** An item as the element draws it: strings trimmed, junk dropped, flags as booleans. */
export interface TimelineItemModel {
  id: string;
  time: string;
  title: string;
  detail: string;
  tone: TimelineTone | undefined;
  status: { text: string; tone: TimelineTone | undefined } | undefined;
  checkable: boolean;
  checked: boolean;
  overdue: boolean;
  actions: TimelineAction[];
  current: boolean;
}

export interface TimelineProgress {
  /** How many items are done. */
  done: number;
  total: number;
  /** The last done item's index (the rail is ink from the first marker down to it); -1 when none is done. */
  split: number;
}

export const TIMELINE_TONES: readonly TimelineTone[] = ['done', 'run', 'wait', 'fail', 'idle'];

export interface TimelineStrings {
  name: string;
  overdue: string;
  done: string;
  empty: string;
  check: (title: string) => string;
}

export const TIMELINE_STRINGS: Record<TimelineLang, TimelineStrings> = {
  en: {
    name: 'Schedule',
    overdue: 'Overdue',
    done: 'Done',
    empty: 'Nothing scheduled',
    check: (t) => `Mark ${t} done`,
  },
  ko: {
    name: '일정',
    overdue: '지남',
    done: '완료',
    empty: '예정된 일이 없습니다',
    check: (t) => `${t} 완료 표시`,
  },
};

export function timelineStrings(lang: unknown): TimelineStrings {
  return TIMELINE_STRINGS[lang === 'ko' ? 'ko' : 'en'];
}

export function timelineTone(v: unknown): TimelineTone | undefined {
  return TIMELINE_TONES.includes(v as TimelineTone) ? (v as TimelineTone) : undefined;
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

/**
 * The items worth drawing, in their order: objects with an id and a title (first of each id). A status is
 * `{ text, tone? }` (a bare string is taken as its text); actions need an id and a label (first of each id).
 */
export function timelineItems(d: { items?: unknown } | null | undefined): TimelineItemModel[] {
  const out: TimelineItemModel[] = [];
  const seen = new Set<string>();
  for (const raw of d && Array.isArray(d.items) ? d.items : []) {
    if (!raw || typeof raw !== 'object') continue;
    const it = raw as Record<string, unknown>;
    const id = text(it.id);
    const title = text(it.title);
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    const st = it.status;
    const stText =
      typeof st === 'string' ? st.trim() : st && typeof st === 'object' ? text((st as TimelineStatus).text) : '';
    const acts: TimelineAction[] = [];
    const actIds = new Set<string>();
    for (const a of Array.isArray(it.actions) ? it.actions : []) {
      if (!a || typeof a !== 'object') continue;
      const aid = text((a as TimelineAction).id);
      const label = text((a as TimelineAction).label);
      if (!aid || !label || actIds.has(aid)) continue;
      actIds.add(aid);
      acts.push({ id: aid, label });
    }
    out.push({
      id,
      time: text(it.time),
      title,
      detail: text(it.detail),
      tone: timelineTone(it.tone),
      status: stText
        ? { text: stText, tone: st && typeof st === 'object' ? timelineTone((st as TimelineStatus).tone) : undefined }
        : undefined,
      checkable: it.checkable === true,
      checked: it.checked === true,
      overdue: it.overdue === true,
      actions: acts,
      current: it.current === true,
    });
  }
  return out;
}

/** Whether an item is done: a checkable one when it is checked, any other when its tone is done. */
export function timelineDone(item: Pick<TimelineItemModel, 'checkable' | 'checked' | 'tone'>): boolean {
  return item.checkable ? item.checked : item.tone === 'done';
}

/** How many are done, of how many, and where the rail's done part ends (the last done item; -1 for none). */
export function timelineProgress(
  items: ReadonlyArray<Pick<TimelineItemModel, 'checkable' | 'checked' | 'tone'>> | null | undefined,
): TimelineProgress {
  const list = Array.isArray(items) ? items : [];
  let done = 0;
  let split = -1;
  list.forEach((it, i) => {
    if (!timelineDone(it)) return;
    done++;
    split = i;
  });
  return { done, total: list.length, split };
}

/** The marker's tone: the item's own, else fail while overdue and not done, else idle (ink when done). */
export function timelineMarker(item: TimelineItemModel, done: boolean): TimelineTone {
  return item.tone ?? (item.overdue && !done ? 'fail' : 'idle');
}

/**
 * The status a row shows with `checked` as the box's state now. While the box says what the data says: the item's
 * own status, else Done for a ticked box, else Overdue while late. After a local tick the data's words are stale:
 * Done when ticked, Overdue (when late) or nothing when unticked. A status without a tone takes the item's.
 */
export function timelineStatus(
  item: TimelineItemModel,
  checked: boolean,
  s: TimelineStrings,
): { text: string; tone: TimelineTone } | undefined {
  const done = timelineDone({ ...item, checked });
  const overdue = (): { text: string; tone: TimelineTone } | undefined =>
    item.overdue && !done ? { text: s.overdue, tone: 'fail' } : undefined;
  if (item.checkable && checked !== item.checked) return checked ? { text: s.done, tone: 'done' } : overdue();
  if (item.status) return { text: item.status.text, tone: item.status.tone ?? item.tone ?? 'idle' };
  if (item.checkable && checked) return { text: s.done, tone: 'done' };
  return overdue();
}
