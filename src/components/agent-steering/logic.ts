/**
 * Agent Steering — pure helpers (no DOM). The element keeps three things apart:
 *   - the host's list (`data.items`, the truth — e.g. a FollowupQueue `list()` mapped to {@link SteeringItem});
 *   - overlays: what this element did to a host note and the host has not answered yet (Send now → sending,
 *     Cancel → hidden, Edit → the new text), each pinned to the note's state + text at that moment;
 *   - local rows: notes submitted while the agent runs that the host's list does not show yet.
 * Everything here is exported and unit-tested.
 */

/** A note's state. `cancelled` notes are not shown. */
export type SteeringItemState = 'queued' | 'sending' | 'steered' | 'cancelled' | 'failed';
export const STEERING_STATES: readonly SteeringItemState[] = ['queued', 'sending', 'steered', 'cancelled', 'failed'];

/** `queue`: wait for the agent's next step (the normal path; when idle that is now). `steer`: into the running turn now. */
export type SteerMode = 'queue' | 'steer';

/**
 * One note in the follow-up queue, host-neutral. Shaped on soma-work's `FollowupItem`: `id`, `message.text`,
 * `enqueuedAt`, the state folded to five (queued / paused → queued, reserved / claimed / dispatched → sending,
 * steered, failed / uncertain → failed, cancelled), `stateReason`, `message.files`.
 */
export interface SteeringItem {
  /** Stable id, echoed as `detail.id` in ui-promote / ui-edit / ui-cancel. */
  id: string;
  /** The note as written. */
  text: string;
  /** When it was queued (epoch ms). Shown as “2m ago” on queued and failed notes. */
  at?: number;
  state: SteeringItemState;
  /** Who wrote it (another person, or a Slack message), shown before the state. */
  author?: string;
  /** Why it sits in this state (“edited”, a refused dispatch, a failure), shown after the state. */
  reason?: string;
  /** Names of files attached to it. */
  files?: string[];
  /** `false` hides Edit. Default: editable while queued. */
  canEdit?: boolean;
}

export interface AgentSteeringData {
  /** The agent is working now: ↵ queues for its next step, ⌘↵ steers into the running turn, notes sent show as rows. */
  running?: boolean;
  /** The follow-up queue in order (FollowupQueue `list()` is arrival order). */
  items?: SteeringItem[];
  /** `false` (not the owner — like Stop): the list is read-only and the field is off. Default `true`. */
  canAct?: boolean;
  /** Field placeholder while the field is open (default: “Steer the agent…” running, “Send a message…” idle). */
  placeholder?: string;
  /** The field and every note action are off (the session ended). */
  disabled?: boolean;
  /** Files the host holds for the next message (its chips go in `slot="attachments"`): > 0 lets an empty note send. */
  attachments?: number;
  /**
   * Where the notes the host's list holds wait. `'dock'` (default): behind a round button at the top right of the
   * element that shows how many there are and opens the queue on hover or press (a bottom sheet under 640px) — only
   * a note on its way in (not in the list yet, or refused before it got there) shows above the field. `'inline'`:
   * every note above the field, as before 0.33.
   */
  queue?: SteeringQueueLayout;
}

/** See {@link AgentSteeringData.queue}. */
export type SteeringQueueLayout = 'dock' | 'inline';

export interface SteeringSubmitDetail {
  text: string;
  mode: SteerMode;
  /** The row this note shows as until the host's list has it — pass it to `setItemState(ref, 'failed', why)`. */
  ref: string;
  /**
   * With a `<ui-composer slot="composer">`: the files attached to this note (the composer's File objects). A Retry
   * sends the same `ref` without them — keep them by ref until the note is in your list.
   */
  files?: File[];
}
export interface SteeringItemDetail {
  id: string;
}
export interface SteeringEditDetail {
  id: string;
  text: string;
}

/** What this element did to a host note, until the host's note changes (state or text) or leaves the list. */
export interface SteeringOverlay {
  state: SteeringItemState;
  /** Edited text, shown until the host's note carries it. */
  text?: string;
  /** Shown on the row (a refusal or failure the host reported through setItemState). */
  message?: string;
  /** An edit in flight: the note's actions stay but are locked. */
  saving?: boolean;
  /** `steeringItemKey()` of the host note when the overlay was made. */
  base: string;
}

/** A note submitted while the agent runs, shown until a new note appears in the host's list. */
export interface SteeringLocal {
  ref: string;
  text: string;
  mode: SteerMode;
  at: number;
  state: SteeringItemState;
  message?: string;
  /** How many host-held files went with it. */
  attachments?: number;
}

/** One row as drawn. */
export interface SteeringRow {
  /** `h:<id>` for a host note, `l:<ref>` for a local one — never collide. */
  key: string;
  /** Host id, or the local ref. */
  id: string;
  local: boolean;
  text: string;
  at?: number;
  state: SteeringItemState;
  mode?: SteerMode;
  author?: string;
  reason?: string;
  /** File names (host notes); local rows only know how many. */
  files: string[];
  fileCount: number;
  message?: string;
  canEdit: boolean;
  saving: boolean;
}

export type SteeringAction = 'promote' | 'retry' | 'edit' | 'cancel';
export type SteeringEnterAction = 'none' | 'newline' | 'queue' | 'steer';

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v));
const finite = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : undefined;
};

/** The host's list made safe: notes need an id (first one wins), an unknown state reads as queued. */
export function normSteeringItems(raw: unknown): SteeringItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SteeringItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const id = str(o.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const state = STEERING_STATES.includes(o.state as SteeringItemState) ? (o.state as SteeringItemState) : 'queued';
    const item: SteeringItem = { id, text: str(o.text), state };
    const at = finite(o.at);
    if (at !== undefined) item.at = at;
    if (o.author !== undefined && o.author !== null && str(o.author)) item.author = str(o.author);
    if (o.reason !== undefined && o.reason !== null && str(o.reason)) item.reason = str(o.reason);
    if (Array.isArray(o.files)) item.files = o.files.map(str).filter(Boolean);
    if (o.canEdit === false) item.canEdit = false;
    out.push(item);
  }
  return out;
}

/** What an overlay is pinned to: the host note's state and text. */
export function steeringItemKey(item: Pick<SteeringItem, 'state' | 'text'>): string {
  return `${item.state}\u0000${item.text}`;
}

/** Overlays the host has answered — its note changed or left the list — are dropped; the rest stay. */
export function settleOverlays(
  overlays: ReadonlyMap<string, SteeringOverlay>,
  items: readonly SteeringItem[],
): Map<string, SteeringOverlay> {
  const byId = new Map(items.map((i) => [i.id, i]));
  const out = new Map<string, SteeringOverlay>();
  for (const [id, o] of overlays) {
    const item = byId.get(id);
    if (item && steeringItemKey(item) === o.base) out.set(id, o);
  }
  return out;
}

/**
 * A note the host's list shows for the first time stands for the oldest local row still sending (FIFO) — that row
 * goes. `known` is the previous list's ids; the returned set is this list's ids.
 */
export function claimLocals(
  locals: readonly SteeringLocal[],
  items: readonly SteeringItem[],
  known: ReadonlySet<string>,
): { locals: SteeringLocal[]; known: Set<string> } {
  const fresh = items.filter((i) => !known.has(i.id)).length;
  const out: SteeringLocal[] = [];
  let left = fresh;
  for (const l of locals) {
    if (left > 0 && l.state !== 'failed') {
      left--;
      continue;
    }
    out.push(l);
  }
  return { locals: out, known: new Set(items.map((i) => i.id)) };
}

/** The rows to draw: host notes with this element's overlays, then local rows. Cancelled notes are left out. */
export function steeringRows(
  items: readonly SteeringItem[],
  overlays: ReadonlyMap<string, SteeringOverlay>,
  locals: readonly SteeringLocal[],
): SteeringRow[] {
  const rows: SteeringRow[] = [];
  for (const i of items) {
    const o = overlays.get(i.id);
    const state = o ? o.state : i.state;
    if (state === 'cancelled') continue;
    rows.push({
      key: `h:${i.id}`,
      id: i.id,
      local: false,
      text: o?.text ?? i.text,
      at: i.at,
      state,
      author: i.author,
      reason: o?.text !== undefined || o?.message ? undefined : i.reason,
      files: i.files ?? [],
      fileCount: i.files?.length ?? 0,
      message: o?.message,
      canEdit: i.canEdit !== false,
      saving: !!o?.saving,
    });
  }
  for (const l of locals) {
    if (l.state === 'cancelled') continue;
    rows.push({
      key: `l:${l.ref}`,
      id: l.ref,
      local: true,
      text: l.text,
      at: l.at,
      state: l.state,
      mode: l.mode,
      files: [],
      fileCount: Math.max(0, Math.floor(l.attachments ?? 0)),
      message: l.message,
      canEdit: false,
      saving: false,
    });
  }
  return rows;
}

/**
 * The buttons a row offers. Queued: Send now, Edit (unless canEdit is false), Cancel. Steered (delivered, not read
 * yet): Send now (stop the current step and run it now) and Cancel (the host withdraws it before the agent reads it,
 * or rolls it back with why) — never Edit, the agent holds those words. Failed: Retry, Cancel. Sending: none.
 * Read-only or ended: none. A local row only offers Retry / Cancel once the host reported it failed.
 */
export function steeringActions(row: SteeringRow, opts: { canAct: boolean; disabled: boolean }): SteeringAction[] {
  if (!opts.canAct || opts.disabled) return [];
  if (row.state === 'failed') return ['retry', 'cancel'];
  if (row.local) return [];
  if (row.state === 'steered') return ['promote', 'cancel'];
  if (row.state !== 'queued') return [];
  return row.canEdit ? ['promote', 'edit', 'cancel'] : ['promote', 'cancel'];
}

/**
 * What Enter does in a field. Never during IME composition (isComposing, or keyCode 229 — Safari's composition
 * Enter). Shift+Enter: new line; on touch screens plain Enter is a new line too (the send button sends). ⌘/Ctrl+Enter:
 * steer while running, else the same as Enter.
 */
export function steerEnterAction(
  e: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'altKey'> & {
    isComposing?: boolean;
    keyCode?: number;
  },
  opts: { touch?: boolean; running?: boolean } = {},
): SteeringEnterAction {
  if (!e || e.key !== 'Enter') return 'none';
  if (e.isComposing || e.keyCode === 229) return 'none';
  if (e.metaKey || e.ctrlKey) return opts.running ? 'steer' : 'queue';
  if (e.shiftKey || e.altKey || opts.touch) return 'newline';
  return 'queue';
}

/** The layout asked for: `'inline'` only when asked, else the dock. */
export function steeringQueueLayout(v: unknown): SteeringQueueLayout {
  return v === 'inline' ? 'inline' : 'dock';
}

/**
 * Which rows wait behind the dock and which show above the field. Docked: every note the host's list has. Inline: a
 * note on its way in (a local row — sending, or refused before the list had it). The `'inline'` layout docks none.
 */
export function splitSteeringRows(
  rows: readonly SteeringRow[],
  layout: SteeringQueueLayout,
): { inline: SteeringRow[]; docked: SteeringRow[] } {
  if (layout === 'inline') return { inline: [...rows], docked: [] };
  return { inline: rows.filter((r) => r.local), docked: rows.filter((r) => !r.local) };
}

/** The dock's tone: `fail` when a note failed, `run` while one is on its way (Send now, a save), else `idle`. */
export type SteeringDockTone = 'idle' | 'run' | 'fail';
export function steeringDockTone(rows: readonly SteeringRow[]): SteeringDockTone {
  if (rows.some((r) => r.state === 'failed')) return 'fail';
  if (rows.some((r) => r.state === 'sending' || r.saving)) return 'run';
  return 'idle';
}

/** The number on the dock: up to 99, then “99+”. */
export function steeringDockBadge(n: number): string {
  const c = Math.max(0, Math.floor(Number(n) || 0));
  return c > 99 ? '99+' : String(c);
}

/**
 * Whether a sheet dragged down by `dy` px (of its `height`) at `velocity` px/ms on release goes away: past a quarter
 * of it (at most 120px), or flicked (≥ 0.5 px/ms) more than 16px.
 */
export function sheetDismisses(dy: number, velocity: number, height: number): boolean {
  if (!(dy > 0)) return false;
  const far = Math.min(120, Math.max(48, height * 0.25));
  return dy >= far || (velocity >= 0.5 && dy > 16);
}

/** Where focus goes when the row at `index` lost its control: the row now at that place, else the one before, else -1. */
export function steeringFocusIndex(count: number, index: number): number {
  if (count <= 0) return -1;
  return Math.min(Math.max(0, index), count - 1);
}

/** A note shortened for a button's accessible name. */
export function clipNote(text: string, max = 60): string {
  const t = str(text).replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** “just now”, “2m ago”, “3h ago”, “2d ago” — or 방금, 2분 전, 3시간 전, 2일 전. */
export function noteAge(at: number, now: number, lang: 'en' | 'ko' = 'en'): string {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  const ko = lang === 'ko';
  if (s < 45) return ko ? '방금' : 'just now';
  const m = Math.max(1, Math.floor(s / 60));
  if (m < 60) return ko ? `${m}분 전` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return ko ? `${h}시간 전` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return ko ? `${d}일 전` : `${d}d ago`;
}
