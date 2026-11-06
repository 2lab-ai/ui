import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { fmtAgo, fmtDuration, fmtDurationIn, fmtInt, fmtUsd } from '../../core/format';
import { esc, escAttr } from '../../core/html';
import { asModelVendor, MODEL_MAKER_COLOR, modelMarkSvg } from '../../core/model-mark';
import { OWNER_BADGE_HUES, syncOwnerBadgeOrbit } from '../../core/owner-badge';
import { styles } from './styles';

/** Where a run stands. `waiting` = it needs the person; `idle` = parked (sleeping, archived, never started). */
export type InboxStatus = 'waiting' | 'running' | 'done' | 'failed' | 'idle';

/** A button in an open card. A string `disabled` keeps it visible and says why it cannot be pressed. */
export interface InboxAction {
  id: string;
  label: string;
  disabled?: boolean | string;
}

/** One line of an open card's step list. Plain strings are steps; the last one is drawn as the current step. */
export interface InboxDetail {
  label: string;
  /** Right-aligned meta (time, tool calls…). */
  meta?: string;
  state?: 'done' | 'current' | 'pending';
}

/** One sub-agent dot. `stopped` is drawn as a square (stopped by the person or the parent). */
export type AgentDot = 'running' | 'done' | 'failed' | 'stopped' | 'unknown';

/** Named glyphs a host can put in a face extra (no raw markup). */
export type InboxGlyph =
  | 'clock'
  | 'pr'
  | 'attach'
  | 'file'
  | 'tasks'
  | 'context'
  | 'agents'
  | 'spark'
  // 0.16.0 — what a card is (an epic, a plain task) and whose model runs it.
  | 'epic'
  | 'task'
  | 'claude'
  | 'openai'
  | 'grok'
  | 'gemini'
  | 'model'
  // 0.19.0 — linked pages.
  | 'issue'
  | 'wiki';

/** Colour of a host metric's text. `warn` tints only the glyph (amber text is under 4.5:1 on a light card). */
export type InboxMetricTone = 'run' | 'done' | 'fail' | 'wait' | 'warn' | 'danger';
/** A row of the collapsed face between the head and the foot (`card.rows` orders them). */
export type InboxRow = 'summary' | 'tldr' | 'task' | 'links' | 'agents' | 'usage' | 'artifacts';
/** The face's rows in their default order. */
export const INBOX_ROWS: readonly InboxRow[] = ['summary', 'tldr', 'task', 'links', 'agents', 'usage', 'artifacts'];

/** What a linked page is: an issue (Jira, GitHub…), a pull request, or a wiki / doc page. */
export type InboxLinkKind = 'issue' | 'pr' | 'wiki';
/**
 * A page the work is linked to, drawn on the face as a chip that opens it in a new tab (and sends `ui-link`);
 * a click on it never opens the card. Only http(s) links are drawn.
 */
export interface InboxLink {
  kind: InboxLinkKind;
  /** Absolute http(s) URL. */
  href: string;
  /** Short reference: `PROJ-12`, `#733`, a page title. */
  text: string;
  /** Its state in words (`진행 중`, `머지됨`). */
  status?: string;
  /** Colour of the status. */
  tone?: InboxMetricTone;
  /** Tooltip (the full title). */
  title?: string;
}

/** The most lines a TL;DR draws. */
export const TLDR_MAX_LINES = 5;

/** A short report on the face (0.20.0) — the run's TL;DR, a few plain lines the host wrote. */
export interface InboxTldr {
  /** Plain lines (no markup), drawn as a list; blanks are dropped, at most `TLDR_MAX_LINES`. */
  lines: string[];
  /** The label above the lines. Default `TL;DR`. */
  title?: string;
  /** A × at the box's top right that sends `ui-dismiss` `{ cardId, what: 'tldr' }`. Default true. */
  dismissible?: boolean;
}

/** A host metric in the card foot, after tasks and context (a PR badge, a media count…). Text only. */
export interface InboxMetric {
  /** The words. `''` draws an icon-only metric (0.22.0): its mark and/or effort gauge, named by `label` / `title`. */
  text: string;
  glyph?: InboxGlyph;
  tone?: InboxMetricTone;
  /** Tooltip. */
  title?: string;
  /** Accessible name when the text alone says too little (`2` → `지시 첨부 2개`); an icon-only metric's name. */
  label?: string;
  /**
   * 0.22.0 — an effort level (`low` · `medium` · `high` · `xhigh` · `max` · `ultra`), drawn after the mark as a 5-bar
   * gauge: 1–5 bars, `xhigh` red, `max` a gold foil, `ultra` a holographic foil (the model picker's effort effects).
   * An unknown level draws no gauge.
   */
  effort?: string;
  /** 0.22.0 — the mark's colour, a hex colour (`#rgb` … `#rrggbbaa`): a model's own colour. Anything else is ignored. */
  color?: string;
}

/** A file the run made, drawn as a chip button that sends `ui-artifact` (never a toggle). */
export interface InboxArtifact {
  id: string;
  name: string;
  /** Glyph and tint. Default: from the name's extension. */
  kind?: ArtifactKind;
}

/** The most follow-up lines drawn before `+N more` (which opens the rest in place). */
export const FOLLOWUP_MAX_LINES = 5;
/**
 * 0.34.0 — a follow-up the run left: an issue or PR still open after the work stopped. Drawn as one line in the
 * follow-up bar right under the head, its words in a gradient; a press sends `ui-followup` and never toggles the card.
 */
export interface InboxFollowup {
  /** The host's id for it (a URL) — sent back in `ui-followup`. */
  id: string;
  kind: 'issue' | 'pr';
  /** Short reference: `#918`, `PROJ-12`. */
  text: string;
  /** The page's own title, after the reference. */
  title?: string;
  /** Its state in words (`Open`, `Draft`). */
  status?: string;
  /** The page (absolute http(s) URL) — sent back in `ui-followup`; anything else is sent as `''`. */
  href?: string;
}

/** 0.37.0 — one child of an epic card, listed on the epic's face (`card.children`). */
export interface InboxChild {
  /** The host's id for it (the child's card id when it is on the board) — sent back in `ui-child`. */
  id: string;
  title: string;
  status: InboxStatus;
  /** Replaces the status word (`Sleeping`, `Queued`). */
  statusText?: string;
}

export interface InboxCard {
  id: string;
  title: string;
  /**
   * 0.34.0 — the follow-up bar, right under the head whatever `rows` says: one line per follow-up (at most
   * `FOLLOWUP_MAX_LINES`, then a `+N more` button that shows the rest), each a button that sends `ui-followup`
   * `{ cardId, id, kind, href }` and never toggles the card. The host owns the state: drop a follow-up once it is
   * seen.
   */
  followups?: readonly InboxFollowup[];
  /**
   * 0.37.0 — the id of this card's epic (its parent card). The card carries `data-parent` and `is-child`, its epic
   * `is-parent` while a child is drawn. A child drawn right after its epic, or after a sibling tied to it, in the
   * same list is tied: indented, with a connector from the epic down to it (`is-tied`, the run's last `is-tied-last`).
   * A pointer over, or a keyboard focus in, any card of the family (the epic and every card whose `parent` it is)
   * marks every card of it on the board (`is-kin`).
   */
  parent?: string;
  /**
   * 0.37.0 — the epic's children, drawn right after the follow-up bar whatever `rows` says: one line (a toggle with
   * the count, then a status dot and the title per child, clipped) that opens the full list in place — one line per
   * child (dot, title, status word), each a button that sends `ui-child` `{ cardId, childId }`. Neither the toggle
   * nor a child line ever toggles the card. Entries without an id or a title are skipped, a repeated id is drawn once.
   */
  children?: readonly InboxChild[];
  /** One or two sentences: why the card is here / where it stands (clamped to two lines). */
  summary?: string;
  /**
   * A TL;DR box on the face (after the summary): the host's lines and, unless `dismissible: false`, a × that sends
   * `ui-dismiss` `{ cardId, what: 'tldr' }` and never toggles the card. The host owns the state: drop `tldr` on it.
   */
  tldr?: InboxTldr;
  status: InboxStatus;
  /** Replaces the status word (e.g. `Sleeping`, `Archived`, `Retrying`). */
  statusText?: string;
  /**
   * Epoch ms the current status began. `running`: the live clock runs from here (plus `elapsedMs`);
   * every other status shows it as recency (`· 6m ago`). Without it no clock and no age are shown.
   */
  since?: number;
  /** Active time in ms: `done` shows `Done in …`; `running` adds it to the live clock (time before `since`). */
  elapsedMs?: number;
  /** The task in progress: `#id label · 3m 12s` (live from `startedAt`, else the static `elapsedMs`). */
  task?: { id?: string; label: string; startedAt?: number; elapsedMs?: number };
  /**
   * Sub-agent counts. Dots are drawn from these counts only; the rest of `total` is drawn hollow (unknown).
   * `dots` draws them in the host's order instead (spawn order, with the `stopped` square).
   */
  agents?: { total: number; running?: number; done?: number; failed?: number; dots?: AgentDot[] };
  /** Total tokens (all kinds). Shown only when given. */
  tokens?: number;
  /** API-equivalent cost in USD. Shown only when given. */
  costUsd?: number;
  /**
   * Files the run made (newest first). Up to four chips + `+N`. A name is an inert chip; `{ id, name, kind? }`
   * is a chip button that sends `ui-artifact`.
   */
  artifacts?: Array<string | InboxArtifact>;
  /** How many files the run made in all (the chips are the newest few). Default: `artifacts.length`. */
  artifactsCount?: number;
  /** Tasks / steps done of total, shown in the card foot. */
  steps?: { done: number; total: number };
  /** Context window used, 0–100. Above 60 warns, above 80 is danger — unless `contextLevel` says otherwise. */
  contextPct?: number;
  /** The context metric's level from the host (e.g. against the auto-compact point). `''` = no level. */
  contextLevel?: 'warn' | 'danger' | '';
  /** Tooltips that replace the built-in ones (`총 토큰 (task 합계: …)`, `컨텍스트 72% · 자동 압축 750K까지 120K`). */
  titles?: { tokens?: string; cost?: string; context?: string; steps?: string };
  /**
   * What leads the head instead of the ✦ spark (a CRON badge). With a glyph and no `text` it is the glyph alone
   * (an epic's or a plain task's mark), named by `title`.
   */
  lead?: { text?: string; glyph?: InboxGlyph; title?: string };
  /**
   * A star toggle at the head's right end — a button of its own inside the face: pressing it sends `ui-star`
   * `{ cardId, starred }` (the state asked for) and never toggles the card. `disabled` (a reason string is its
   * tooltip) keeps it visible and inert. The host owns the state: set `on` from its answer.
   */
  star?: { on: boolean; title?: string; disabled?: boolean | string };
  /**
   * A name pill at the right end of the head (the owner in an all-users board). `hue` 0–7 picks its colour. `self`
   * (0.28.0) marks the viewer's own card: a ring with an arc orbiting it (the ring alone under reduced motion), and
   * "(you)" read after the name.
   */
  badge?: { text: string; hue?: number; title?: string; self?: boolean };
  /**
   * 0.32.0 — the card waits on the viewer (their own card in NEEDS YOU). Only `true` counts. While the card is
   * collapsed it carries a mark (a rail on its reading edge, a stronger border, the status tag in ink) and, once
   * every `ATTENTION_BEAT_MS`, a ping — a ring that leaves its edge and fades, every such card on one shared beat.
   * Opening the card stops the cue; a pointer over it, a keyboard focus in it, or a move between columns holds the ping. Reduced motion keeps the mark, drops the ping.
   */
  attention?: boolean;
  /** Host metrics after tasks and context (a PR badge, a media count). */
  metrics?: InboxMetric[];
  /**
   * The face's rows between the head and the foot, in this order — only these (a row the list leaves out is not
   * drawn even with its data). Unknown names and repeats are skipped. Default: every row, in `INBOX_ROWS` order.
   */
  rows?: readonly InboxRow[];
  /** Linked issues, PRs and wikis (the `links` row). */
  links?: readonly InboxLink[];
  /** Model (agent) name, shown at the left of the open card's button row. */
  model?: string;
  /** The one decision this viewer can make here — the card's single ink button. */
  primary?: InboxAction;
  /** Secondary buttons (outline), left of the primary. */
  actions?: InboxAction[];
  /** The open card's step list, oldest first. Over five, the earliest fold into `+N earlier`. */
  details?: Array<string | InboxDetail>;
  /**
   * `slot`: the open card shows `<slot name="body:<id>">` — the host's own light-DOM body (its CSS, its controls,
   * its gates) — instead of the steps and buttons. Default `steps`.
   */
  bodyMode?: 'steps' | 'slot';
}

/** A disclosure group inside a column (DONE by finish day). A closed group draws no cards. */
export interface InboxGroup {
  id: string;
  label: string;
  /** Open until the person toggles this group; afterwards their choice rules. Default true. */
  open?: boolean;
  cards: InboxCard[];
}

export interface InboxColumn {
  id: string;
  label: string;
  /** Shown while the column draws no cards and has no groups. Default `Nothing here`. */
  emptyText?: string;
  /** Cards in display order. A card id listed twice renders once (first wins). */
  cards: InboxCard[];
  /** Disclosure groups after `cards`. The column's count covers every group, open or closed. */
  groups?: InboxGroup[];
  /** Just the list: no head, no tint, no empty hint (a CRON job's card under the host's own head). */
  bare?: boolean;
}

/** `loading`: skeletons, no counts, no empty hints. `failed`: the cards given, no counts or hints. */
export type InboxLoad = 'loading' | 'failed' | 'ready';

/** Every string the element draws; `data.strings` overrides any of them (a value of another type is ignored). */
export type InboxStrings = (typeof STRINGS)['en'];
export type InboxStringOverrides = Partial<Omit<InboxStrings, 'status' | 'columns'>> & {
  status?: Partial<Record<InboxStatus, string>>;
};

export interface AgentInboxData {
  columns: InboxColumn[];
  /** Card ids that start open the first time they appear. Afterwards the person's toggles rule. */
  expanded?: string[];
  /** Label of the open card's Open button (`ui-open`). `false` hides it. Default `Open` / `열기`. */
  openLabel?: string | false;
  /** The board's load state. Default `ready`. Nothing is announced until it is ready. */
  load?: InboxLoad;
  /** What the live region counts: the host's own numbers (a CRON lane included), or `false` for silence. */
  announce?: { needs: number; running: number } | false;
  /** Strings merged over the `lang` table (status words, sub-agents, titles, clock, announcement…). */
  strings?: InboxStringOverrides;
}

/** Where cards and heads are drawn (viewport px), from `measure()`; keys are opaque. */
export interface InboxLayout {
  spots: Record<string, { x: number; y: number }>;
}

export type InboxTone = 'wait' | 'run' | 'done' | 'fail' | 'rest';

/** A card held in the column it is drawn in while its new status shows. */
export interface LaneHold {
  from: string;
  to: string;
  until: number;
}

/** How long a card whose column changed shows its new status in place before it moves. */
export const BOARD_HOLD_MS = 900;
/** A burst of announcements within this window is said once. */
export const ANNOUNCE_MS = 1000;
const MAX_DOTS = 6;
const MAX_CHIPS = 4;
const MAX_DETAILS = 5;
const COUNT_MS = 900;

const STATUSES: readonly InboxStatus[] = ['waiting', 'running', 'done', 'failed', 'idle'];

function agoKo(at: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 45) return '방금';
  const m = Math.floor(s / 60);
  if (m < 60) return `${Math.max(1, m)}분 전`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

const STRINGS = {
  en: {
    status: {
      waiting: 'Waiting for you',
      running: 'Running',
      done: 'Done',
      failed: 'Failed',
      idle: 'Idle',
    } as Record<InboxStatus, string>,
    doneIn: 'Done in ',
    empty: 'Nothing here',
    open: 'Open',
    columns: { needs: 'Needs you', running: 'Running', done: 'Done' },
    agents: 'Sub-agents',
    agentsRunning: (n: number) => `running ${n}`,
    agentsFailed: (n: number) => `failed ${n}`,
    tok: 'tok',
    tokTitle: 'Total tokens',
    costTitle: 'API-equivalent cost',
    steps: 'Tasks done / total',
    ctx: (p: number) => `Context window used — ${p}%`,
    arts: 'Files the run made',
    links: 'Linked issues, PRs and wikis',
    earlier: (n: number) => `+${n} earlier`,
    announce: (w: number, r: number) => `${w} need${w === 1 ? 's' : ''} you, ${r} running`,
    changed: (title: string, word: string) => `${title}: ${word}.`,
    ago: (at: number, now?: number) => fmtAgo(at, now),
    duration: (ms: number) => fmtDuration(ms),
    artOpen: (name: string, _kind: ArtifactKind) => `Open ${name}`,
    starOff: 'Star',
    starOn: 'Unstar',
    tldr: 'TL;DR',
    tldrDismiss: 'Dismiss TL;DR',
    followups: 'Follow-ups',
    followupOpen: (text: string) => `Open follow-up ${text}`,
    followupMore: (n: number) => `+${n} more`,
    children: 'Children',
    childrenShow: 'Show all children',
    childrenHide: 'Hide',
    badgeSelf: '(you)',
  },
  ko: {
    status: {
      waiting: '입력 대기',
      running: '실행 중',
      done: '완료',
      failed: '실패',
      idle: '대기',
    } as Record<InboxStatus, string>,
    doneIn: '완료 · ',
    empty: '비어 있음',
    open: '열기',
    columns: { needs: '응답 필요', running: '실행 중', done: '완료' },
    agents: '서브에이전트',
    agentsRunning: (n: number) => `실행 ${n}`,
    agentsFailed: (n: number) => `실패 ${n}`,
    tok: '토큰',
    tokTitle: '총 토큰',
    costTitle: 'API 환산 비용',
    steps: '완료한 task / 전체',
    ctx: (p: number) => `컨텍스트 ${p}% 사용`,
    arts: '모델이 만든 산출물',
    links: '연결된 이슈 · PR · 위키',
    earlier: (n: number) => `이전 ${n}개 더`,
    announce: (w: number, r: number) => `응답이 필요한 세션 ${w}개, 실행 중 ${r}개`,
    changed: (title: string, word: string) => `${title}: ${word}.`,
    ago: agoKo as (at: number, now?: number) => string,
    // Zero-padded like the panel's clock and <ui-elapsed> (23분 04초): the tag keeps its width as it ticks.
    duration: (ms: number) => fmtDurationIn(ms, 'ko'),
    artOpen: (name: string, _kind: ArtifactKind) => `${name} — 크게 보기`,
    starOff: '즐겨찾기',
    starOn: '즐겨찾기 해제',
    tldr: 'TL;DR',
    tldrDismiss: 'TL;DR 닫기',
    followups: '후속 작업',
    followupOpen: (text: string) => `후속 작업 ${text} 열기`,
    followupMore: (n: number) => `외 ${n}개`,
    children: '자식',
    childrenShow: '자식 모두 보기',
    childrenHide: '접기',
    badgeSelf: '(나)',
  },
};
type Strings = InboxStrings;

/**
 * The `lang` table with the host's overrides on top. A value whose type differs from the table's (a number for a
 * word, a string for a function) is ignored, so a bad override never breaks the board.
 */
function mergeStrings(base: Strings, over: InboxStringOverrides | undefined): Strings {
  if (!over || typeof over !== 'object') return base;
  const out: Record<string, unknown> = { ...base, status: { ...base.status } };
  for (const k of Object.keys(base) as Array<keyof Strings>) {
    if (k === 'status' || k === 'columns') continue;
    const v = (over as Record<string, unknown>)[k];
    if (v !== undefined && typeof v === typeof base[k]) out[k] = v;
  }
  const st = over.status;
  if (st && typeof st === 'object')
    for (const s of STATUSES)
      if (typeof st[s] === 'string') (out.status as Record<string, string>)[s] = st[s] as string;
  return out as Strings;
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object';
const sameRec = (a: Rec, b: Rec): boolean => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => Object.is(a[k], b[k]));
};

/** `data.strings` copied one level deep (`status` two), so a change made in place is seen. */
function copyStrings(over: unknown): Rec | null {
  if (!isRec(over)) return null;
  const out: Rec = { ...over };
  if (isRec(out.status)) out.status = { ...out.status };
  return out;
}

/** `over` still holds what `copy` holds: same keys and values (a function by identity), `status` likewise. */
function sameStrings(copy: Rec | null, over: unknown): boolean {
  if (!copy || !isRec(over)) return !copy && !isRec(over);
  const keys = Object.keys(copy);
  if (keys.length !== Object.keys(over).length) return false;
  for (const k of keys) {
    const a = copy[k];
    const b = over[k];
    if (k === 'status' && isRec(a) && isRec(b) ? !sameRec(a, b) : !Object.is(a, b)) return false;
  }
  return true;
}

const SPARK_SVG =
  '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M7 1.5c.5 3.3 2.2 5 5.5 5.5-3.3.5-5 2.2-5.5 5.5C6.5 9.2 4.8 7.5 1.5 7c3.3-.5 5-2.2 5.5-5.5z"/><circle cx="13" cy="12.6" r="1.3"/></svg>';
const WAIT_SVG = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.8 15 14H1z"/></svg>';
const FAIL_SVG =
  '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zm-.8 3h1.6v4.8H7.2zM8 12.3a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>';
const TASKS_SVG =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4.2l1.4 1.4 2.4-2.6M2.5 10.2l1.4 1.4 2.4-2.6M9 4.5h4.5M9 10.5h4.5"/></svg>';
const CTX_SVG =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="8" cy="8" r="5.6"/><path d="M8 8V2.4A5.6 5.6 0 0 1 13.6 8z" fill="currentColor" stroke="none"/></svg>';
const CLOCK_SVG =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.6V8l2.3 1.5"/></svg>';
const PR_SVG =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="4" cy="3.5" r="1.6"/><circle cx="4" cy="12.5" r="1.6"/><circle cx="12" cy="12.5" r="1.6"/><path d="M4 5.1v5.8M12 10.9V6.5c0-1.1-.9-2-2-2H7.5M9 3L7.5 4.5 9 6"/></svg>';
const ATTACH_SVG =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 7.5l-5.4 5.4a3.2 3.2 0 0 1-4.5-4.5l5.6-5.6a2.1 2.1 0 0 1 3 3L6.6 11.4a1.1 1.1 0 0 1-1.5-1.5L10.2 4.8"/></svg>';
const CHEV_SVG =
  '<svg class="ib-chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4l4 4-4 4"/></svg>';
// 0.16.0 — kind and vendor marks (monochrome, currentColor; drawn at 14px). 0.23.0: the vendor marks are the shared
// maker marks (core/model-mark).
const EPIC_SVG =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 1.8 14.2 5 8 8.2 1.8 5z"/><path d="M1.8 8 8 11.2 14.2 8M1.8 11 8 14.2 14.2 11"/></svg>';
const TASK_SVG =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="2.5"/><path d="M5.4 8.1l1.8 1.8 3.5-3.7"/></svg>';
const CLAUDE_SVG = modelMarkSvg('claude');
const OPENAI_SVG = modelMarkSvg('openai');
const GROK_SVG = modelMarkSvg('grok');
const GEMINI_SVG = modelMarkSvg('gemini');
const MODEL_SVG = modelMarkSvg('model');
// 0.19.0 — linked pages: an issue (a ringed dot) and a wiki (an open book).
const ISSUE_SVG =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="8" cy="8" r="5.8"/><circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none"/></svg>';
const WIKI_SVG =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4.2C6.6 3 4.6 2.6 2 2.8v9.4c2.6-.2 4.6.2 6 1.4 1.4-1.2 3.4-1.6 6-1.4V2.8c-2.6-.2-4.6.2-6 1.4zM8 4.2v9.4"/></svg>';
const STAR_SVG =
  '<svg viewBox="0 0 16 16" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z"/></svg>';
const X_SVG =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>';
const AGENTS_SVG =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="4" cy="3.5" r="1.8"/><circle cx="12" cy="8" r="1.8"/><circle cx="12" cy="13" r="1.8"/><path d="M4 5.3v5.2c0 1.4 1.1 2.5 2.5 2.5h3.7M4 8h6.2"/></svg>';

export type ArtifactKind = 'image' | 'html' | 'markdown' | 'pdf' | 'audio' | 'video' | 'text' | 'file';
const ART_GLYPH: Record<ArtifactKind, string> = {
  image:
    '<rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="6" cy="6.5" r="1.2"/><path d="M14 11l-3.5-3.5L4 13"/>',
  audio: '<path d="M2.5 7.5v1M5 5.5v5M7.5 3v10M10 5v6M12.5 6.5v3"/>',
  video: '<rect x="2" y="4" width="9" height="8" rx="1.5"/><path d="M11 7l3-2v6l-3-2z"/>',
  html: '<path d="M5.5 5L2.5 8l3 3M10.5 5l3 3-3 3M9 3.5l-2 9"/>',
  markdown: '<path d="M4 2h5l3 3v9H4z"/><path d="M6 8h4M6 10.5h4M6 5.5h1.5"/>',
  pdf: '<path d="M4 2h5l3 3v9H4z"/><path d="M9 2v3h3M6 10h4"/>',
  text: '<path d="M3 4h10M3 7h10M3 10h7M3 13h5"/>',
  file: '<path d="M4 2h5l3 3v9H4z"/><path d="M9 2v3h3"/>',
};
const glyph = (k: ArtifactKind) =>
  `<svg class="ib-glyph" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ART_GLYPH[k]}</svg>`;
const ART_KINDS = Object.keys(ART_GLYPH) as ArtifactKind[];

/** A host-named glyph (never host markup). */
function hostGlyph(name: unknown): string {
  switch (name) {
    case 'clock':
      return CLOCK_SVG;
    case 'pr':
      return PR_SVG;
    case 'attach':
      return ATTACH_SVG;
    case 'file':
      return glyph('file');
    case 'tasks':
      return TASKS_SVG;
    case 'context':
      return CTX_SVG;
    case 'agents':
      return AGENTS_SVG;
    case 'spark':
      return SPARK_SVG;
    case 'epic':
      return EPIC_SVG;
    case 'task':
      return TASK_SVG;
    case 'claude':
      return CLAUDE_SVG;
    case 'openai':
      return OPENAI_SVG;
    case 'grok':
      return GROK_SVG;
    case 'gemini':
      return GEMINI_SVG;
    case 'model':
      return MODEL_SVG;
    case 'issue':
      return ISSUE_SVG;
    case 'wiki':
      return WIKI_SVG;
    default:
      return '';
  }
}
const METRIC_TONES: readonly InboxMetricTone[] = ['run', 'done', 'fail', 'wait', 'warn', 'danger'];
const DOTS: readonly AgentDot[] = ['running', 'done', 'failed', 'stopped', 'unknown'];
/** Owner badge colour slots (`badge.hue`). */
export const BADGE_HUES = OWNER_BADGE_HUES;
/** 0.32.0 — the attention cue's beat: every `attention` card pings once per beat, all on the document's clock. */
export const ATTENTION_BEAT_MS = 10_000;
/** The attention cue's animations (the card's ::after), put on the shared beat after a render or a collapse. */
const ATTENTION_ANIMS: readonly string[] = ['ib-attn-ping'];
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// ── Pure helpers ───────────────────────────────────────────────────────────

/** The status a card is drawn with (anything unknown reads as idle). */
export function statusOf(card: Pick<InboxCard, 'status'>): InboxStatus {
  return STATUSES.includes(card?.status) ? card.status : 'idle';
}

/** Status → tag tone: waiting amber, running blue, done green, failed red, idle grey. */
export function statusTone(status: InboxStatus): InboxTone {
  return status === 'waiting'
    ? 'wait'
    : status === 'running'
      ? 'run'
      : status === 'done'
        ? 'done'
        : status === 'failed'
          ? 'fail'
          : 'rest';
}

/** Glyph kind from a file name's extension. */
export function artifactKind(name: string): ArtifactKind {
  const m = /\.([a-z0-9]{1,6})$/i.exec(String(name ?? '').trim());
  const ext = m ? m[1].toLowerCase() : '';
  if (/^(png|jpe?g|gif|webp|svg|avif|bmp)$/.test(ext)) return 'image';
  if (/^html?$/.test(ext)) return 'html';
  if (/^(md|mdx|markdown)$/.test(ext)) return 'markdown';
  if (ext === 'pdf') return 'pdf';
  if (/^(mp3|wav|m4a|ogg|flac|aac)$/.test(ext)) return 'audio';
  if (/^(mp4|mov|webm|mkv)$/.test(ext)) return 'video';
  if (/^(txt|log|csv|json|ya?ml|xml)$/.test(ext)) return 'text';
  return 'file';
}

/**
 * Sub-agent dots from counts: running, failed, done, then unknown (hollow) — at most `max`, the rest as `more`.
 * Only what the counts say is drawn; nothing is invented. `agents.dots` (host order) is drawn as given instead.
 */
export function agentDots(a: InboxCard['agents'], max = MAX_DOTS): { dots: AgentDot[]; more: number } {
  if (Array.isArray(a?.dots)) {
    const list = a.dots.filter((d): d is AgentDot => DOTS.includes(d));
    const total = Math.max(list.length, Math.floor(num(a?.total)));
    return { dots: list.slice(0, max), more: Math.max(0, total - Math.min(max, list.length)) };
  }
  const total = Math.floor(num(a?.total));
  if (!total) return { dots: [], more: 0 };
  const running = Math.min(total, Math.floor(num(a?.running)));
  const failed = Math.min(total - running, Math.floor(num(a?.failed)));
  const done = Math.min(total - running - failed, Math.floor(num(a?.done)));
  const all: AgentDot[] = [
    ...Array<'running'>(running).fill('running'),
    ...Array<'failed'>(failed).fill('failed'),
    ...Array<'done'>(done).fill('done'),
    ...Array<'unknown'>(total - running - failed - done).fill('unknown'),
  ];
  return { dots: all.slice(0, max), more: Math.max(0, total - max) };
}

/**
 * How many cards need the person (waiting + failed) and how many run — what the live region says. Cards in groups
 * count too, open or closed.
 */
export function boardCounts(columns: InboxColumn[]): { needs: number; running: number } {
  const seen = new Set<string>();
  let needs = 0;
  let running = 0;
  const count = (cards: unknown) => {
    for (const c of Array.isArray(cards) ? (cards as InboxCard[]) : []) {
      if (!c || seen.has(String(c.id))) continue;
      seen.add(String(c.id));
      const s = statusOf(c);
      if (s === 'waiting' || s === 'failed') needs++;
      else if (s === 'running') running++;
    }
  };
  for (const col of Array.isArray(columns) ? columns : []) {
    count(col?.cards);
    for (const g of Array.isArray(col?.groups) ? col.groups : []) count(g?.cards);
  }
  return { needs, running };
}

/** The reference board's three columns from a flat list: Needs you (waiting, failed) · Running · Done (done, idle). */
export function columnsByStatus(cards: InboxCard[], lang: 'en' | 'ko' = 'en'): InboxColumn[] {
  const L = STRINGS[lang === 'ko' ? 'ko' : 'en'].columns;
  const list = Array.isArray(cards) ? cards : [];
  const of = (...s: InboxStatus[]) => list.filter((c) => c && s.includes(statusOf(c)));
  return [
    { id: 'needs-you', label: L.needs, cards: of('waiting', 'failed') },
    { id: 'running', label: L.running, cards: of('running') },
    { id: 'done', label: L.done, cards: of('done', 'idle') },
  ];
}

/**
 * The column each card is drawn in this render. `want` = the column its data puts it in; `drawn` = the column
 * it is drawn in now (cards on screen only); `holds` = the running holds. A card whose column changed stays where
 * it is drawn until its deadline (`now + BOARD_HOLD_MS` when the change is first seen). Data that returns to the
 * drawn column drops the hold; a new target keeps the first deadline. `on = false` (reduced motion, first paint,
 * hidden tab) moves every card at once. Returns the columns, the holds still running and the earliest deadline.
 */
export function holdLanes(
  want: Record<string, string>,
  drawn: Record<string, string>,
  holds: Record<string, LaneHold>,
  now: number,
  on: boolean,
): { lanes: Record<string, string>; holds: Record<string, LaneHold>; wakeAt: number } {
  const lanes: Record<string, string> = Object.create(null);
  const next: Record<string, LaneHold> = Object.create(null);
  let wakeAt = 0;
  for (const key of Object.keys(want)) {
    const to = want[key];
    const from = drawn[key];
    lanes[key] = to;
    if (!on || !from || from === to) continue;
    const h = holds[key];
    const until = h && h.from === from ? h.until : now + BOARD_HOLD_MS;
    if (now >= until) continue;
    lanes[key] = from;
    next[key] = { from, to, until };
    if (!wakeAt || until < wakeAt) wakeAt = until;
  }
  return { lanes, holds: next, wakeAt };
}

/**
 * Put held cards back where they are drawn: each leaves its new column and returns to `lanes[id]` at its place
 * in that column's previous order (`drawnOrder`). Held cards are taken out first and put back in ascending
 * place, so cards leaving one column together keep their order there. A hold whose column is gone is dropped.
 */
export function placeHolds(
  slots: Record<string, string[]>,
  lanes: Record<string, string>,
  drawnOrder: Record<string, string[]>,
): { slots: Record<string, string[]>; dropped: string[] } {
  const out: Record<string, string[]> = Object.create(null);
  for (const k of Object.keys(slots)) out[k] = slots[k].slice();
  const moves: Array<{ id: string; home: string; at: number }> = [];
  const dropped: string[] = [];
  for (const col of Object.keys(out)) {
    const list = out[col];
    for (let i = list.length - 1; i >= 0; i--) {
      const id = list[i];
      const lane = lanes[id];
      if (!lane || lane === col) continue;
      if (!out[lane]) {
        dropped.push(id);
        continue;
      }
      list.splice(i, 1);
      moves.push({ id, home: lane, at: Math.max(0, (drawnOrder[lane] ?? []).indexOf(id)) });
    }
  }
  moves.sort((a, b) => a.at - b.at);
  for (const m of moves) {
    const l = out[m.home];
    l.splice(Math.min(m.at, l.length), 0, m.id);
  }
  return { slots: out, dropped };
}

// ── Markup ─────────────────────────────────────────────────────────────────

function fmtCount(kind: string, v: number): string {
  return kind === 'usd' ? fmtUsd(v) : fmtInt(v);
}

function statusWord(c: Pick<InboxCard, 'status' | 'statusText'>, t: Strings): string {
  const own = typeof c.statusText === 'string' ? c.statusText.trim() : '';
  return own || t.status[statusOf(c)];
}

/** The status tag's inside: icon · word · clock / age. Clocks and ages are filled by the 1 Hz tick. */
function renderStatus(c: InboxCard, t: Strings): string {
  const s = statusOf(c);
  const word = statusWord(c, t);
  const since = num(c.since);
  const acc = num(c.elapsedMs);
  const ago = since ? `<span class="ib-ago" data-at="${since}"></span>` : '';
  const icon = (inner: string) => `<span class="ib-tag-icon" aria-hidden="true">${inner}</span>`;
  if (s === 'running') {
    const text =
      since || acc
        ? `<span class="ib-pre">${esc(word)} · </span><span class="ib-clock" data-clock data-from="${since}" data-acc="${acc}"></span>`
        : esc(word);
    return `${icon('<span class="ib-spin"></span>')}<span class="ib-tag-text">${text}</span>`;
  }
  if (s === 'waiting') return `${icon(WAIT_SVG)}<span class="ib-tag-text">${esc(word)}${ago}</span>`;
  if (s === 'failed') return `${icon(FAIL_SVG)}<span class="ib-tag-text">${esc(word)}${ago}</span>`;
  if (s === 'done') {
    const pre = c.statusText?.trim() ? `${esc(word)} · ` : esc(t.doneIn);
    const text = acc ? `<span class="ib-pre">${pre}</span>${esc(t.duration(acc))}` : esc(word);
    return `${icon('<span class="ib-dot"></span>')}<span class="ib-tag-text">${text}${ago}</span>`;
  }
  return `${icon('<span class="ib-dot is-hollow"></span>')}<span class="ib-tag-text">${esc(word)}${ago}</span>`;
}

function renderTask(c: InboxCard, t: Strings): string {
  const task = c.task;
  if (!task || typeof task.label !== 'string' || !task.label) return '';
  const from = num(task.startedAt);
  const fixed = num(task.elapsedMs);
  const time = from
    ? `<span class="ib-task-time" data-clock data-from="${from}" data-acc="0"></span>`
    : fixed
      ? `<span class="ib-task-time">${esc(t.duration(fixed))}</span>`
      : '';
  return `<div class="ib-task" title="${escAttr(task.label)}">${
    task.id ? `<span class="ib-task-id">#${esc(task.id)}</span>` : ''
  }<span class="ib-task-name">${esc(task.label)}</span>${time}</div>`;
}

function renderAgents(c: InboxCard, t: Strings): string {
  const { dots, more } = agentDots(c.agents);
  if (!dots.length) return '';
  const total = dots.length + more;
  const running = Math.min(total, Math.floor(num(c.agents?.running)));
  const failed = Math.floor(num(c.agents?.failed));
  const parts = [`${esc(t.agents)} <b>${total}</b>`];
  if (running) parts.push(esc(t.agentsRunning(running)));
  if (failed) parts.push(`<span class="ib-fail">${esc(t.agentsFailed(failed))}</span>`);
  const words = [`${t.agents} ${total}`, running ? t.agentsRunning(running) : '', failed ? t.agentsFailed(failed) : '']
    .filter(Boolean)
    .join(', ');
  return `<div class="ib-agents" title="${escAttr(words)}">${AGENTS_SVG}<span class="ib-dots" aria-hidden="true">${dots
    .map((d) => `<i class="ib-adot is-${d}"></i>`)
    .join(
      '',
    )}${more ? `<span class="ib-dots-more">+${more}</span>` : ''}</span><span class="ib-agents-text">${parts.join(' · ')}</span></div>`;
}

function renderUsage(c: InboxCard, t: Strings): string {
  const parts: string[] = [];
  const titles = c.titles && typeof c.titles === 'object' ? c.titles : {};
  if (finite(c.tokens) && c.tokens >= 0)
    parts.push(
      `<span class="ib-use" title="${escAttr(str(titles.tokens) || t.tokTitle)}"><span class="ib-cnt" data-cnt="tok" data-to="${c.tokens}">${fmtInt(c.tokens)}</span><span class="ib-unit">${esc(t.tok)}</span></span>`,
    );
  if (finite(c.costUsd) && c.costUsd >= 0)
    parts.push(
      `<span class="ib-use" title="${escAttr(str(titles.cost) || t.costTitle)}"><span class="ib-cnt" data-cnt="usd" data-to="${c.costUsd}">${fmtUsd(c.costUsd)}</span></span>`,
    );
  return parts.length
    ? `<div class="ib-usage">${parts.join('<span class="ib-sep" aria-hidden="true">·</span>')}</div>`
    : '';
}

function renderArtifacts(c: InboxCard, t: Strings): string {
  const list = (Array.isArray(c.artifacts) ? c.artifacts : []).filter(
    (a): a is string | InboxArtifact =>
      (typeof a === 'string' && a !== '') || (!!a && typeof a === 'object' && a.id != null && !!str(a.name)),
  );
  const count = Math.max(list.length, Math.floor(num(c.artifactsCount)));
  if (!count) return '';
  const shown = list.slice(0, MAX_CHIPS);
  const more = count - shown.length;
  return `<div class="ib-arts"><span class="ib-arts-n" title="${escAttr(t.arts)}">${glyph('file')}${count}</span>${shown
    .map((a) => {
      if (typeof a === 'string') {
        const k = artifactKind(a);
        return `<span class="ib-chip is-${k}" title="${escAttr(a)}">${glyph(k)}<span class="ib-chip-name">${esc(a)}</span></span>`;
      }
      const name = str(a.name);
      const k = ART_KINDS.includes(a.kind as ArtifactKind) ? (a.kind as ArtifactKind) : artifactKind(name);
      return `<button type="button" class="ib-chip is-${k}" data-art="${escAttr(str(a.id))}" data-key="${escAttr(
        `art:${c.id}:${a.id}`,
      )}" title="${escAttr(name)}" aria-label="${escAttr(t.artOpen(name, k))}">${glyph(k)}<span class="ib-chip-name">${esc(name)}</span></button>`;
    })
    .join('')}${more > 0 ? `<span class="ib-arts-more">+${more}</span>` : ''}</div>`;
}

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
/** Bars a level fills (0.22.0 — the effort gauge). */
const EFFORT_BARS: Readonly<Record<string, number>> = { low: 1, medium: 2, high: 3, xhigh: 4, max: 5, ultra: 5 };
// The foils of the model picker's max and ultra words (core/effort.ts), as SVG paints; the same ids in every gauge
// draw the same gradient.
const mixStop = (offset: number, color: string): string => `<stop offset="${offset}" style="stop-color:${color}"/>`;
const GOLD_DEFS = `<defs><linearGradient id="ib-eff-gold" x1="0" y1="1" x2="1" y2="0">${[
  [0, 'color-mix(in srgb, var(--orange) 55%, var(--yellow))'],
  [0.45, 'color-mix(in srgb, var(--yellow) 80%, var(--ib-text))'],
  [0.6, 'color-mix(in srgb, var(--yellow) 85%, var(--ib-card))'],
  [1, 'color-mix(in srgb, var(--orange) 55%, var(--yellow))'],
]
  .map(([o, c]) => mixStop(o as number, c as string))
  .join('')}</linearGradient></defs>`;
const HOLO_DEFS = `<defs><linearGradient id="ib-eff-holo" x1="0" y1="1" x2="1" y2="0">${[
  'purple',
  'accent',
  'green',
  'yellow',
  'orange',
  'red',
]
  .map((h, i) => mixStop(i / 5, `color-mix(in srgb, var(--${h}) 78%, var(--ib-text))`))
  .join('')}</linearGradient></defs>`;

/** The effort as a 5-bar gauge (rising bars, the level's count filled), or '' for an unknown level. */
function effortGauge(level: unknown): string {
  const lv = typeof level === 'string' ? level : '';
  const n = Object.hasOwn(EFFORT_BARS, lv) ? EFFORT_BARS[lv] : 0;
  if (!n) return '';
  const bars = [0, 1, 2, 3, 4]
    .map((i) => {
      const h = 4 + i * 2.4;
      return `<rect class="ib-eff-bar${i < n ? ' is-on' : ''}" x="${(1.5 + i * 2.8).toFixed(1)}" y="${(
        14.5 - h
      ).toFixed(1)}" width="2" height="${h.toFixed(1)}" rx="0.8"/>`;
    })
    .join('');
  const defs = lv === 'max' ? GOLD_DEFS : lv === 'ultra' ? HOLO_DEFS : '';
  return `<svg class="ib-eff" data-effort="${lv}" viewBox="0 0 16 16" aria-hidden="true">${defs}${bars}</svg>`;
}

function renderMetrics(c: InboxCard, t: Strings): string {
  const out: string[] = [];
  const titles = c.titles && typeof c.titles === 'object' ? c.titles : {};
  const total = Math.floor(num(c.steps?.total));
  if (total) {
    const done = Math.min(total, Math.floor(num(c.steps?.done)));
    out.push(
      `<span class="ib-metric" title="${escAttr(str(titles.steps) || t.steps)}">${TASKS_SVG}${done}/${total}</span>`,
    );
  }
  const pct = num(c.contextPct);
  if (pct) {
    const p = Math.round(Math.min(pct, 100));
    const level =
      c.contextLevel === 'warn' || c.contextLevel === 'danger' || c.contextLevel === ''
        ? c.contextLevel
        : pct > 80
          ? 'danger'
          : pct > 60
            ? 'warn'
            : '';
    out.push(
      `<span class="ib-metric${level ? ` is-${level}` : ''}" title="${escAttr(str(titles.context) || t.ctx(p))}">${CTX_SVG}${p}%</span>`,
    );
  }
  for (const m of Array.isArray(c.metrics) ? c.metrics : []) {
    if (!m || typeof m !== 'object') continue;
    const text = str(m.text);
    const glyph = hostGlyph(m.glyph);
    const gauge = effortGauge(m.effort);
    // An icon-only metric (0.22.0) needs something to draw.
    if (!text && !glyph && !gauge) continue;
    const tone = METRIC_TONES.includes(m.tone as InboxMetricTone) ? (m.tone as InboxMetricTone) : '';
    const title = str(m.title);
    const label = str(m.label) || (text ? '' : title);
    // 0.23.0 — a maker's mark with no host colour takes the maker's (Claude clay, Gemini blue); OpenAI's and xAI's
    // black marks take the ink.
    const vendor = m.glyph === 'model' ? undefined : asModelVendor(m.glyph);
    const color = HEX_COLOR.test(str(m.color)) ? str(m.color) : vendor ? MODEL_MAKER_COLOR[vendor] : '';
    const ink = !!vendor && !color;
    const model = !text || !!gauge || !!color || !!vendor;
    out.push(
      `<span class="ib-metric is-host${model ? ' is-model' : ''}${ink ? ' is-ink' : ''}"${!text ? ' role="img"' : ''}${
        color ? ` style="--ib-model-hue:${color}"` : ''
      }${tone ? ` data-tone="${tone}"` : ''}${title ? ` title="${escAttr(title)}"` : ''}${
        label ? ` aria-label="${escAttr(label)}"` : ''
      }>${glyph}${gauge}${esc(text)}</span>`,
    );
  }
  return out.length ? `<span class="ib-metrics">${out.join('')}</span>` : '';
}

/** The head's lead: the ✦ spark, the host's badge (a CRON clock), or the host's glyph alone (an epic, a task). */
function renderLead(c: InboxCard): string {
  const lead = c.lead && typeof c.lead === 'object' ? c.lead : null;
  const text = lead ? str(lead.text) : '';
  const mark = lead ? hostGlyph(lead.glyph) : '';
  if (lead && !text && mark) {
    const name = str(lead.title);
    return `<span class="ib-lead is-icon" role="img"${name ? ` aria-label="${escAttr(name)}" title="${escAttr(name)}"` : ''}>${mark}</span>`;
  }
  if (!lead || !text) return `<span class="ib-spark" aria-hidden="true">${SPARK_SVG}</span>`;
  const title = str(lead.title);
  return `<span class="ib-lead"${title ? ` title="${escAttr(title)}"` : ''}>${hostGlyph(lead.glyph)}<span class="ib-lead-text">${esc(
    text,
  )}</span></span>`;
}

/** The face's star toggle (0.16.0): a button inside the face that sends `ui-star`, never a card toggle. */
function renderStar(c: InboxCard, t: Strings): string {
  const st = c.star && typeof c.star === 'object' ? c.star : null;
  if (!st) return '';
  const on = st.on === true;
  const why = typeof st.disabled === 'string' ? st.disabled : '';
  const off = !!st.disabled;
  const title = why || str(st.title) || (on ? t.starOn : t.starOff);
  // A toggle names the thing (fixed) and aria-pressed says the state; a disabled star's reason is read too.
  return `<button type="button" class="ib-star${on ? ' is-on' : ''}" data-star aria-pressed="${on ? 'true' : 'false'}" title="${escAttr(
    title,
  )}" data-key="${escAttr(`s:${c.id}`)}"${off ? ' aria-disabled="true"' : ''}>${STAR_SVG}<span class="sr-only">${esc(t.starOff)}${
    why ? ` — ${esc(why)}` : ''
  }</span></button>`;
}

function renderBadge(c: InboxCard, t: Strings): string {
  const b = c.badge && typeof c.badge === 'object' ? c.badge : null;
  const text = b ? str(b.text) : '';
  if (!b || !text) return '';
  const h = Math.floor(Number(b.hue));
  const hue = Number.isFinite(h) ? ((h % BADGE_HUES) + BADGE_HUES) % BADGE_HUES : 0;
  // The viewer's own (0.28.0): the moving ring is the look; "(you)" after the name is what a screen reader hears.
  const self = b.self === true;
  const title = str(b.title) || (self ? `${text} ${t.badgeSelf}` : text);
  return `<span class="ib-badge${self ? ' is-self' : ''}" data-hue="${hue}" title="${escAttr(title)}">${esc(text)}${
    self ? `<span class="sr-only"> ${esc(t.badgeSelf)}</span>` : ''
  }</span>`;
}

/**
 * The collapsed face: spark (or the host's lead) + title + badge / summary / task / sub-agents / tokens · cost /
 * files (or the card's `rows`, in its order) / status tag · metrics.
 */
/** The face's rows in the card's order (`rows`), else the default order. */
export function faceRows(c: InboxCard): InboxRow[] {
  if (!Array.isArray(c.rows)) return INBOX_ROWS.slice();
  const out: InboxRow[] = [];
  for (const r of c.rows) if (INBOX_ROWS.includes(r) && !out.includes(r)) out.push(r);
  return out;
}

/** The TL;DR's lines as drawn: strings, trimmed, blanks dropped, at most `TLDR_MAX_LINES`. */
export function tldrLines(tldr: InboxTldr | undefined): string[] {
  const lines = tldr && typeof tldr === 'object' && Array.isArray(tldr.lines) ? tldr.lines : [];
  return lines
    .map((l) => (typeof l === 'string' ? l.trim() : ''))
    .filter(Boolean)
    .slice(0, TLDR_MAX_LINES);
}

/** The face's TL;DR box (0.20.0): a label, the lines, and the × that sends `ui-dismiss`. */
function renderTldr(c: InboxCard, t: Strings): string {
  const lines = tldrLines(c.tldr);
  if (!lines.length) return '';
  const label = str(c.tldr?.title).trim() || t.tldr;
  const x =
    c.tldr?.dismissible === false
      ? ''
      : `<button type="button" class="ib-tldr-x" data-dismiss="tldr" aria-label="${escAttr(t.tldrDismiss)}" title="${escAttr(
          t.tldrDismiss,
        )}" data-key="${escAttr(`d:${c.id}`)}">${X_SVG}</button>`;
  return `<div class="ib-tldr"><div class="ib-tldr-head"><span class="ib-tldr-label">${esc(label)}</span>${x}</div><ul class="ib-tldr-lines">${lines
    .map((l) => `<li>${esc(l)}</li>`)
    .join('')}</ul></div>`;
}

const FOLLOWUP_KINDS: readonly InboxFollowup['kind'][] = ['issue', 'pr'];

/** The card's follow-ups that can be drawn: a known kind, an id and a text (0.34.0). */
export function cardFollowups(c: InboxCard): InboxFollowup[] {
  const seen = new Set<string>();
  return (Array.isArray(c.followups) ? c.followups : []).filter((f): f is InboxFollowup => {
    if (!f || typeof f !== 'object' || !FOLLOWUP_KINDS.includes(f.kind) || !str(f.id) || !str(f.text).trim())
      return false;
    if (seen.has(str(f.id))) return false;
    seen.add(str(f.id));
    return true;
  });
}

/** A follow-up line's focus key: the card and the follow-up as one JSON pair, so no two cards' keys meet. */
const followupKey = (cardId: string, id: string): string => `u:${JSON.stringify([cardId, id])}`;

/** The follow-up bar (0.34.0): one gradient line per follow-up, at most `FOLLOWUP_MAX_LINES` unless `all`. */
function renderFollowups(c: InboxCard, t: Strings, all: boolean): string {
  const list = cardFollowups(c);
  if (!list.length) return '';
  const shown = all ? list : list.slice(0, FOLLOWUP_MAX_LINES);
  const more = list.length - shown.length;
  return `<div class="ib-fu" role="group" aria-label="${escAttr(t.followups)}">${shown
    .map((f) => {
      const id = str(f.id);
      const text = str(f.text).trim();
      const title = str(f.title).trim();
      const status = str(f.status).trim();
      const tip = `${t.followupOpen(text)}${title ? ` — ${title}` : ''}${status ? ` · ${status}` : ''}`;
      const href = /^https?:\/\/[^\s]+$/i.test(str(f.href)) ? str(f.href) : '';
      return `<button type="button" class="ib-fu-line is-${f.kind}" data-followup="${escAttr(id)}" data-fu-kind="${f.kind}"${
        href ? ` data-fu-href="${escAttr(href)}"` : ''
      } data-key="${escAttr(followupKey(String(c.id), id))}" title="${escAttr(tip)}">${LINK_GLYPH[f.kind]}<span class="ib-fu-text">${esc(text)}${title ? ` · ${esc(title)}` : ''}</span>${
        status ? `<span class="ib-fu-st">${esc(status)}</span>` : ''
      }</button>`;
    })
    .join('')}${
    more > 0
      ? `<button type="button" class="ib-fu-more" data-fu-more data-key="${escAttr(`v:${c.id}`)}">${esc(t.followupMore(more))}</button>`
      : ''
  }</div>`;
}

/** An epic's children that can be drawn (0.37.0): an id and a title, each id once. */
export function cardChildren(c: Pick<InboxCard, 'children'>): InboxChild[] {
  const seen = new Set<string>();
  return (Array.isArray(c?.children) ? c.children : []).filter((k): k is InboxChild => {
    if (!k || typeof k !== 'object' || !str(k.id) || !str(k.title).trim()) return false;
    if (seen.has(str(k.id))) return false;
    seen.add(str(k.id));
    return true;
  });
}

/** A child's status as a dot (its status word is said beside it in the open list and in its tooltip). */
const kidDot = (k: InboxChild): string =>
  `<i class="ib-kdot" data-tone="${statusTone(statusOf(k))}" aria-hidden="true"></i>`;

/**
 * The children row (0.37.0): a one-line toggle — "Children 4", then a dot and the title per child, clipped — and the
 * list it opens in place (`open`), one button per child. `listId` is the list's id, for the toggle's aria-controls.
 */
function renderChildren(c: InboxCard, t: Strings, open: boolean, listId: string): string {
  const list = cardChildren(c);
  if (!list.length) return '';
  const cardId = String(c.id);
  const action = open ? t.childrenHide : t.childrenShow;
  const peek = open
    ? ''
    : `<span class="ib-kids-peek">${list
        .map((k) => `<span class="ib-kid-peek">${kidDot(k)}${esc(str(k.title).trim())}</span>`)
        .join('')}</span>`;
  const lines = open
    ? list
        .map((k) => {
          const id = str(k.id);
          const title = str(k.title).trim();
          const word = statusWord(k, t);
          return `<li><button type="button" class="ib-kid" data-child="${escAttr(id)}" data-key="${escAttr(
            `kc:${cardId}:${id}`,
          )}" title="${escAttr(`${title} — ${word}`)}">${kidDot(k)}<span class="ib-kid-title">${esc(title)}</span><span class="ib-kid-st" data-tone="${statusTone(
            statusOf(k),
          )}">${esc(word)}</span></button></li>`;
        })
        .join('')
    : '';
  return `<div class="ib-kids"><button type="button" class="ib-kids-line" data-kids data-key="${escAttr(
    `k:${cardId}`,
  )}" aria-expanded="${open}" aria-controls="${escAttr(listId)}" aria-label="${escAttr(
    `${t.children} ${list.length} — ${action}`,
  )}" title="${escAttr(action)}"><span class="ib-kids-label">${esc(t.children)} <b>${list.length}</b></span>${peek}${CHEV_SVG}</button><ul class="ib-kids-list" id="${escAttr(
    listId,
  )}" role="list" aria-label="${escAttr(t.children)}"${open ? '' : ' hidden'}>${lines}</ul></div>`;
}

function renderRow(c: InboxCard, row: InboxRow, t: Strings): string {
  switch (row) {
    case 'summary':
      return c.summary ? `<div class="ib-summary">${esc(c.summary)}</div>` : '';
    case 'tldr':
      return renderTldr(c, t);
    case 'task':
      return renderTask(c, t);
    case 'agents':
      return renderAgents(c, t);
    case 'usage':
      return renderUsage(c, t);
    case 'artifacts':
      return renderArtifacts(c, t);
    case 'links':
      return renderLinks(c, t);
  }
}

const MAX_LINKS = 6;
const LINK_KINDS: readonly InboxLinkKind[] = ['issue', 'pr', 'wiki'];
const LINK_GLYPH: Record<InboxLinkKind, string> = { issue: ISSUE_SVG, pr: PR_SVG, wiki: WIKI_SVG };

/** The card's links that can be drawn: a known kind, a text, an absolute http(s) URL. */
export function cardLinks(c: InboxCard): InboxLink[] {
  return (Array.isArray(c.links) ? c.links : []).filter(
    (l): l is InboxLink =>
      !!l &&
      typeof l === 'object' &&
      LINK_KINDS.includes(l.kind) &&
      !!str(l.text) &&
      /^https?:\/\/[^\s]+$/i.test(str(l.href)),
  );
}

function renderLinks(c: InboxCard, t: Strings): string {
  const list = cardLinks(c);
  if (!list.length) return '';
  const shown = list.slice(0, MAX_LINKS);
  const more = list.length - shown.length;
  return `<div class="ib-links" role="list" aria-label="${escAttr(t.links)}">${shown
    .map((l) => {
      const status = str(l.status);
      const tone = METRIC_TONES.includes(l.tone as InboxMetricTone) ? (l.tone as InboxMetricTone) : '';
      const title = str(l.title) || [str(l.text), status].filter(Boolean).join(' ');
      return `<a role="listitem" class="ib-link is-${l.kind}" href="${escAttr(str(l.href))}" target="_blank" rel="noopener noreferrer" data-link="${escAttr(
        l.kind,
      )}" title="${escAttr(title)}">${LINK_GLYPH[l.kind]}<span class="ib-link-text">${esc(str(l.text))}</span>${
        status ? `<span class="ib-link-st"${tone ? ` data-tone="${tone}"` : ''}>${esc(status)}</span>` : ''
      }</a>`;
    })
    .join('')}${more > 0 ? `<span class="ib-links-more">+${more}</span>` : ''}</div>`;
}

function renderFace(
  c: InboxCard,
  t: Strings = STRINGS.en,
  allFollowups = false,
  kidsOpen = false,
  kidsId = '',
): string {
  return `<div class="ib-head">${renderLead(c)}<span class="ib-title">${esc(c.title)}</span>${renderBadge(c, t)}${renderStar(
    c,
    t,
  )}</div>${renderFollowups(c, t, allFollowups)}${renderChildren(c, t, kidsOpen, kidsId)}${faceRows(c)
    .map((r) => renderRow(c, r, t))
    .join('')}<div class="ib-foot"><span class="ib-tag" data-tone="${statusTone(
    statusOf(c),
  )}">${renderStatus(c, t)}</span>${renderMetrics(c, t)}</div>`;
}

function renderButton(cardId: string, a: InboxAction, primary: boolean): string {
  const why = typeof a.disabled === 'string' ? a.disabled : '';
  const off = !!a.disabled;
  return `<button type="button" class="ib-btn${primary ? ' is-primary' : ''}" data-act="${escAttr(a.id)}" data-key="${escAttr(
    `a:${cardId}:${a.id}`,
  )}"${off ? ' aria-disabled="true"' : ''}${why ? ` title="${escAttr(why)}"` : ''}>${esc(a.label)}${
    why ? `<span class="sr-only"> — ${esc(why)}</span>` : ''
  }</button>`;
}

/** The open card: step list (oldest first, the earliest folded past five) and the button row with one ink button. */
function renderBody(c: InboxCard, t: Strings = STRINGS.en, openLabel: string | false = t.open): string {
  const id = String(c.id);
  const raw = (Array.isArray(c.details) ? c.details : [])
    .map((d) => (typeof d === 'string' ? { label: d } : d))
    .filter((d): d is InboxDetail => !!d && typeof d.label === 'string' && d.label !== '');
  let steps = '';
  if (raw.length) {
    const folded = Math.max(0, raw.length - MAX_DETAILS);
    const shown = raw.slice(folded);
    steps = `<div class="ib-steps-wrap">${folded ? `<div class="ib-more">${esc(t.earlier(folded))}</div>` : ''}<ol class="ib-steps">${shown
      .map((d, i) => {
        const state = d.state ?? (i === shown.length - 1 ? 'current' : 'done');
        return `<li class="ib-step is-${state === 'current' || state === 'pending' ? state : 'done'}"><span class="ib-step-text">${esc(
          d.label,
        )}</span>${d.meta ? `<span class="ib-step-meta">${esc(d.meta)}</span>` : ''}</li>`;
      })
      .join('')}</ol></div>`;
  }
  const primary = c.primary && c.primary.id != null && c.primary.label ? c.primary : null;
  const decides = !!primary && !primary.disabled;
  const btns: string[] = [];
  for (const a of Array.isArray(c.actions) ? c.actions : [])
    if (a && a.id != null && a.label) btns.push(renderButton(id, a, false));
  if (openLabel)
    btns.push(
      `<button type="button" class="ib-btn${decides ? '' : ' is-primary'}" data-open data-key="${escAttr(`o:${id}`)}">${esc(openLabel)}</button>`,
    );
  if (primary) btns.push(renderButton(id, primary, decides));
  const model = c.model ? `<span class="ib-model">${esc(c.model)}</span>` : '';
  const bar =
    btns.length || model ? `<div class="ib-bar">${model}<span class="ib-actions">${btns.join('')}</span></div>` : '';
  return steps || bar ? `<div class="ib-body">${steps}${bar}</div>` : '';
}

// ── Element ────────────────────────────────────────────────────────────────

interface Shell {
  el: HTMLLIElement;
  face: HTMLElement;
  expand: HTMLElement;
  body: HTMLElement;
  faceHtml: string | null;
  bodyHtml: string | null;
  /** The list it is drawn in: a column id, or `gkey(column, group)`. */
  col: string;
  status: InboxStatus | '';
  flip: Animation | null;
  /** Its epic's id (`card.parent`), or `''` (0.37.0). */
  parent: string;
  /** The id of its children list (the children toggle's aria-controls, 0.37.0). */
  kids: string;
}
interface GroupShell {
  el: HTMLElement;
  head: HTMLButtonElement;
  label: HTMLElement;
  count: HTMLElement;
  list: HTMLElement;
}
interface ColShell {
  el: HTMLElement;
  head: HTMLElement;
  name: HTMLElement;
  count: HTMLElement;
  list: HTMLElement;
  groupsEl: HTMLElement;
  groups: Map<string, GroupShell>;
  skel: HTMLElement;
  skelN: number;
  empty: HTMLElement;
  bare: boolean | null;
}
interface PlanGroup {
  gid: string;
  key: string;
  label: string;
  open: boolean;
  /** Cards in a closed group (not drawn, still counted). */
  closed: number;
}
interface PlanCol {
  id: string;
  col: InboxColumn;
  groups: PlanGroup[];
}
type Timer = ReturnType<typeof setTimeout>;
interface Motion {
  move: number;
  fade: number;
  easeOut: string;
  easeInOut: string;
}

/** The list key of a group inside a column. */
const gkey = (col: string, group: string) => `${col}\u0000${group}`;
/** Skeleton cards per column while the board loads (the inline board's 2 · 3 · 2). */
const SKELETONS = [2, 3, 2];
const SKEL_CARD =
  '<div class="ib-skel-card"><div class="ib-sk ib-sk-title"></div><div class="ib-sk ib-sk-meta"></div><div class="ib-sk ib-sk-pill"></div></div>';

/** Set or clear a class only when it changes (no churn for observers). */
function flag(el: Element, name: string, on: boolean): void {
  if (el.classList.contains(name) !== on) el.classList.toggle(name, on);
}

/** A text field, a select or an editable region keeps its own Escape (clear, cancel, IME). */
function ownsEscape(el: HTMLElement): boolean {
  const tag = String(el.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/**
 * `<ui-agent-inbox>` — a calm kanban of agent runs: labelled columns with counts, cards with a tinted status tag
 * (Waiting for you · Running · Done · Failed), the task in progress, sub-agents, tokens · cost, files, and a card
 * that opens in place to its steps and one ink decision. A card whose column changes shows its new status where it
 * is for 900 ms, then glides over (FLIP). Cards keep their DOM node for their whole life.
 */
export class UiAgentInbox extends UiElement<AgentInboxData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang', 'view'];
  }

  #wrap: HTMLElement | null = null;
  #board: HTMLElement | null = null;
  #live: HTMLElement | null = null;
  #cards = new Map<string, Shell>();
  #cols = new Map<string, ColShell>();
  #order: Record<string, string[]> = Object.create(null);
  #open = new Set<string>();
  /** Cards whose follow-up bar shows every line (`+N more` was pressed, 0.34.0). */
  #fuAll = new Set<string>();
  /** The card whose `+N more` was pressed: its first newly shown line takes focus after the render. */
  #fuFocus: string | null = null;
  /** Epics whose children list is open (the children toggle was pressed, 0.37.0). */
  #kidsOpen = new Set<string>();
  /** The epic whose children toggle opened its list: its first child takes focus after the render. */
  #kidsFocus: string | null = null;
  /** The card under the pointer and the card a focus is in (0.37.0): each marks its family (`is-kin`). */
  #kinAt: { pointer: string | null; focus: string | null } = { pointer: null, focus: null };
  /** Groups the person opened or closed (`gkey` → open); their choice rules over `group.open`. */
  #groupOpen = new Map<string, boolean>();
  /** Cards in a closed group this render: id → its column and group (for `reveal`). */
  #closedHome = new Map<string, { col: string; group: string }>();
  #holds: Record<string, LaneHold> = Object.create(null);
  #lastStatus = new Map<string, InboxStatus>();
  #seq = 0;
  #painted = false;
  #holdTimer: Timer | undefined;
  #tickTimer: ReturnType<typeof setInterval> | undefined;
  #announceTimer: Timer | undefined;
  #announcePending = '';
  #lastCounts = '';
  #shown = new Map<string, number>();
  #counting = new Map<string, { el: HTMLElement; kind: string; from: number; to: number; t0: number }>();
  #raf = 0;
  #slides = new WeakMap<Element, Animation>();
  /** A glide in flight: its animation, its target (document px) and its starting offset. */
  #glides = new WeakMap<Element, { anim: Animation; x: number; y: number; dx: number; dy: number }>();
  #tCache: { lang: string; over: Record<string, unknown> | null; t: Strings } | null = null;

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if (name !== 'view') {
      this.requestRender();
      return;
    }
    if (old === value || !this.#wrap) return;
    // The layout follows `.ib[data-view]`, not the attribute: measure the old layout, switch, glide from it.
    const before = this.#painted && this.isConnected ? this.measure() : null;
    this.#syncView();
    if (before) this.flipFrom(before);
  }

  get #lang(): 'en' | 'ko' {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  /**
   * The `lang` table with `data.strings` merged over it, cached while `lang` and the overrides' values stay the
   * same (compared shallowly, `status` one level deeper), so a host may also change `data.strings` in place.
   */
  get #t(): Strings {
    const lang = this.#lang;
    const over = this.data?.strings;
    const c = this.#tCache;
    if (c && c.lang === lang && sameStrings(c.over, over)) return c.t;
    const t = mergeStrings(STRINGS[lang], over);
    this.#tCache = { lang, over: copyStrings(over), t };
    return t;
  }

  constructor() {
    super();
    this.root.addEventListener('click', (e) => this.#onClick(e as MouseEvent));
    this.root.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    // A family (0.37.0) is marked while the pointer is over one of its cards or a focus is in one; the CSS shows the
    // pointer's only on hover devices, the focus's when visible. pointerover / pointerout bubble to the shadow root
    // (pointerenter / pointerleave do not, and Chromium does not deliver them to a capture listener on the root).
    this.root.addEventListener('pointerover', (e) => this.#kinPointer(e as PointerEvent, true));
    this.root.addEventListener('pointerout', (e) => this.#kinPointer(e as PointerEvent, false));
    this.root.addEventListener('focusin', (e) => this.#kin('focus', this.#cardOf(e.target as Element | null)));
    this.root.addEventListener('focusout', (e) =>
      this.#kin('focus', this.#cardOf((e as FocusEvent).relatedTarget as Element | null)),
    );
    // Esc from a host's slotted body (light DOM) reaches the host, not the shadow root's own handler.
    this.addEventListener('keydown', (e) => this.#onHostKey(e));
  }

  override disconnectedCallback(): void {
    clearTimeout(this.#holdTimer);
    clearTimeout(this.#announceTimer);
    clearInterval(this.#tickTimer);
    if (this.#raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.#raf);
    this.#holdTimer = this.#announceTimer = this.#tickTimer = undefined;
    this.#raf = 0;
    for (const [key, c] of this.#counting) {
      c.el.textContent = fmtCount(c.kind, c.to);
      this.#shown.set(key, c.to);
    }
    this.#counting.clear();
    // A hold cannot outlive the element: on reconnect every card is drawn where its data puts it.
    this.#holds = Object.create(null);
  }

  /** The board is reconciled by `update()` (keyed, persistent nodes); there is no single markup string. */
  protected render(): string {
    return '';
  }

  // ── Public API ──

  /**
   * Bring a card into view (a deep link): render pending data, open its closed group (`ui-group-toggle`), open the
   * card (`ui-toggle`, no transition) unless `open: false`, and scroll it to the centre unless `scroll: false`.
   * Returns false (and does not scroll) when the card is not on the board or the host prevented its group or the
   * card from opening.
   */
  reveal(cardId: string, opts: { open?: boolean; scroll?: boolean } = {}): boolean {
    if (!this.isConnected) return false;
    this.renderNow();
    const id = String(cardId);
    if (!this.#cards.has(id)) {
      const home = this.#closedHome.get(id);
      if (!home || !this.#setGroup(home.col, home.group, true)) return false;
    }
    const sh = this.#cards.get(id);
    if (!sh) return false;
    // A card with nothing to open is revealed as it is; one the host keeps closed is not.
    const opens = opts?.open !== false && !this.#open.has(id) && sh.face.hasAttribute('aria-controls');
    if (opens && !this.#toggle(id, true)) return false;
    if (opts?.scroll !== false && typeof sh.el.scrollIntoView === 'function') sh.el.scrollIntoView({ block: 'center' });
    return true;
  }

  /**
   * Where every card (`c:<id>`), column head (`h:<column>`) and group head (`g:<column>\u0000<group>`) is drawn now.
   * Take it before a layout change the element cannot see (a panel docks, a section folds), then `flipFrom` it.
   */
  measure(): InboxLayout {
    const spots: InboxLayout['spots'] = Object.create(null);
    for (const [id, sh] of this.#cards) if (sh.el.isConnected) spots[`c:${id}`] = this.#boxOf(sh.el);
    for (const [k, el] of this.#heads()) spots[k] = this.#boxOf(el);
    return { spots };
  }

  /**
   * Glide every card and head from where `measure()` saw it to where it is now (320 ms, translate only). Nothing
   * moves on the first paint, in a hidden tab or under reduced motion.
   */
  flipFrom(before: InboxLayout | null | undefined): void {
    const spots = before && typeof before === 'object' ? before.spots : null;
    if (!spots || typeof spots !== 'object') return;
    if (!this.#painted || !this.isConnected || (typeof document !== 'undefined' && document.hidden)) return;
    if (typeof HTMLElement.prototype.animate !== 'function' || prefersReducedMotion()) return;
    const m = this.#motion();
    for (const [id, sh] of this.#cards) {
      let a = spots[`c:${id}`];
      if (!a || !sh.el.isConnected) continue;
      const wasFlying = sh.el.classList.contains('is-flying');
      if (sh.flip) {
        // Mid-glide the card is drawn where its glide puts it, not where an older snapshot saw it (a host that
        // re-flips from its last settled layout during a resize burst would otherwise snap it back first).
        a = this.#drawnAt(sh.el, sh.flip) ?? a;
        sh.flip.cancel();
        sh.flip = null;
      }
      if (wasFlying) sh.el.classList.remove('is-flying');
      const b = this.#boxOf(sh.el);
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      this.#flip(sh, dx, dy, wasFlying, m, false);
    }
    for (const [k, el] of this.#heads()) {
      const a = spots[k];
      if (a) this.#slide(el, a, m);
    }
  }

  // ── Events ──

  #cardOf(el: Element | null): string | null {
    const li = el?.closest?.('li.ib-card[data-card]');
    return li ? (li.getAttribute('data-card') ?? null) : null;
  }

  /** A click that ends a text selection (the person selected a title to copy) is not a toggle. */
  #selecting(): boolean {
    const said = (s: Selection | null | undefined) => {
      try {
        return !!s && String(s.toString()) !== '';
      } catch {
        return false;
      }
    };
    const root = this.root as ShadowRoot & { getSelection?: () => Selection | null };
    return (
      said(typeof root.getSelection === 'function' ? root.getSelection() : null) ||
      said(typeof document.getSelection === 'function' ? document.getSelection() : null)
    );
  }

  #onClick(e: MouseEvent): void {
    const target = e.target as Element | null;
    // A host's slotted body is the host's: its buttons are never this element's actions.
    if (!target || target.getRootNode?.() !== this.root) return;
    const link = target.closest?.('a[data-link]');
    if (link) {
      // The page opens in its own tab (the anchor's default); the card stays as it is.
      const id = this.#cardOf(link);
      if (id !== null)
        this.emit('ui-link', {
          cardId: id,
          href: link.getAttribute('href') ?? '',
          kind: link.getAttribute('data-link') ?? '',
        });
      return;
    }
    const art = target.closest?.('[data-art]');
    if (art) {
      const id = this.#cardOf(art);
      if (id !== null && this.emit('ui-artifact', { cardId: id, artifactId: art.getAttribute('data-art') ?? '' }))
        this.sound('navigate', { emphasis: 'subtle' }, e);
      return;
    }
    const fu = target.closest?.('[data-followup]');
    if (fu) {
      const id = this.#cardOf(fu);
      const href = fu.getAttribute('data-fu-href') ?? '';
      if (
        id !== null &&
        this.emit('ui-followup', {
          cardId: id,
          id: fu.getAttribute('data-followup') ?? '',
          kind: fu.getAttribute('data-fu-kind') ?? '',
          href,
        })
      )
        this.sound('navigate', { emphasis: 'subtle' }, e);
      return;
    }
    const fuMore = target.closest?.('[data-fu-more]');
    if (fuMore) {
      const id = this.#cardOf(fuMore);
      if (id === null) return;
      this.#fuAll.add(id);
      // The first line it showed takes focus (the button is gone).
      this.#fuFocus = id;
      this.requestRender();
      return;
    }
    const child = target.closest?.('[data-child]');
    if (child) {
      const id = this.#cardOf(child);
      if (id !== null && this.emit('ui-child', { cardId: id, childId: child.getAttribute('data-child') ?? '' }))
        this.sound('navigate', { emphasis: 'subtle' }, e);
      return;
    }
    const kids = target.closest?.('[data-kids]');
    if (kids) {
      // The children list opens and closes in place (silent, as "+N more" is); the card stays as it is.
      const id = this.#cardOf(kids);
      if (id === null) return;
      if (this.#kidsOpen.delete(id)) this.#kidsFocus = null;
      else {
        this.#kidsOpen.add(id);
        // Its first child takes focus (as "+N more" hands focus to the first line it showed).
        this.#kidsFocus = id;
      }
      this.requestRender();
      return;
    }
    const dismiss = target.closest?.('[data-dismiss]');
    if (dismiss) {
      const id = this.#cardOf(dismiss);
      if (id !== null && this.emit('ui-dismiss', { cardId: id, what: dismiss.getAttribute('data-dismiss') ?? '' }))
        this.sound('close', { emphasis: 'subtle' }, e);
      return;
    }
    const star = target.closest?.('[data-star]');
    if (star) {
      const id = this.#cardOf(star);
      if (id === null || star.getAttribute('aria-disabled') === 'true') return;
      if (this.emit('ui-star', { cardId: id, starred: star.getAttribute('aria-pressed') !== 'true' }))
        this.sound('tap', undefined, e);
      return;
    }
    const act = target.closest?.('[data-act]');
    if (act) {
      const id = this.#cardOf(act);
      if (id === null || act.getAttribute('aria-disabled') === 'true') return;
      if (this.emit('ui-action', { cardId: id, actionId: act.getAttribute('data-act') ?? '' }))
        this.sound('tap', undefined, e);
      return;
    }
    const open = target.closest?.('[data-open]');
    if (open) {
      const id = this.#cardOf(open);
      if (id !== null && this.emit('ui-open', { cardId: id })) this.sound('navigate', undefined, e);
      return;
    }
    const gh = target.closest?.('.ib-group-head');
    if (gh) {
      const col = gh.closest('section.ib-col')?.getAttribute('data-col');
      const group = gh.closest('.ib-group')?.getAttribute('data-group');
      if (col != null && group != null) this.#setGroup(col, group, gh.getAttribute('aria-expanded') !== 'true', e);
      return;
    }
    const face = target.closest?.('.ib-face[role="button"]');
    if (face && !this.#selecting()) {
      const id = this.#cardOf(face);
      if (id !== null) this.#toggle(id, false, e);
    }
  }

  #onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (!target || target.getRootNode?.() !== this.root) return;
    if ((e.key === 'Enter' || e.key === ' ') && target.matches?.('.ib-face[role="button"]')) {
      e.preventDefault();
      if (e.repeat) return;
      const id = this.#cardOf(target);
      if (id !== null) this.#toggle(id, true, e);
      return;
    }
    if (e.key !== 'Escape' || ownsEscape(target)) return;
    const li = target.closest?.('li.ib-card.is-open');
    const id = li ? li.getAttribute('data-card') : null;
    if (id === null || !this.#open.has(id)) return;
    e.stopPropagation();
    if (this.#toggle(id, true, e)) this.#cards.get(id)?.face.focus({ preventScroll: true });
  }

  /**
   * The pointer moved over or out of something in the board (0.37.0): the card it is on marks its family. Moving
   * inside one card changes nothing; leaving it for a gap, another card or outside the board moves (or clears) it —
   * a `relatedTarget` outside the shadow tree is the host (or null), which is in no card.
   */
  #kinPointer(e: PointerEvent, over: boolean): void {
    const here = this.#cardOf(e.target as Element | null);
    if (over) {
      this.#kin('pointer', here);
      return;
    }
    const next = this.#cardOf(e.relatedTarget as Element | null);
    if (next !== here) this.#kin('pointer', next);
  }

  #kin(by: 'pointer' | 'focus', cardId: string | null): void {
    if (this.#kinAt[by] === cardId) return;
    this.#kinAt[by] = cardId;
    this.#paintKin();
  }

  /**
   * Mark the families (0.37.0) of the card under the pointer and of the card a focus is in: the epic and every card
   * whose `parent` it is, those drawn. `data-kin` says by what (`pointer`, `focus` or both). A card of no family — no
   * epic of its own and no child drawn — marks nothing.
   */
  #paintKin(): void {
    const root = (id: string | null): string | null => {
      const sh = id === null ? undefined : this.#cards.get(id);
      return sh ? sh.parent || (id as string) : null;
    };
    const kin = (id: string, sh: Shell, k: string | null) => k !== null && (id === k || sh.parent === k);
    const family = (k: string | null): string | null => {
      let n = 0;
      for (const [id, sh] of this.#cards) if (kin(id, sh, k)) n++;
      return n > 1 ? k : null;
    };
    const pointer = family(root(this.#kinAt.pointer));
    const focus = family(root(this.#kinAt.focus));
    for (const [id, sh] of this.#cards) {
      const by = [kin(id, sh, pointer) ? 'pointer' : '', kin(id, sh, focus) ? 'focus' : ''].filter(Boolean).join(' ');
      flag(sh.el, 'is-kin', !!by);
      if (by) {
        if (sh.el.getAttribute('data-kin') !== by) sh.el.setAttribute('data-kin', by);
      } else if (sh.el.hasAttribute('data-kin')) sh.el.removeAttribute('data-kin');
    }
  }

  /**
   * Families after a render (0.37.0): a card whose `parent` is drawn makes that card `is-parent`; in each list a
   * child right after its epic, or after a sibling tied to it, is `is-tied`, and the last of such a run
   * `is-tied-last`. Set before the FLIP's last boxes are read, so a card that is tied or let go glides there.
   */
  #tie(order: Record<string, string[]>): void {
    const lists = Object.values(order);
    const parents = new Set<string>();
    for (const ids of lists)
      for (const id of ids) {
        const p = this.#cards.get(id)?.parent;
        if (p) parents.add(p);
      }
    for (const ids of lists) {
      const sh = ids.map((id) => this.#cards.get(id)!);
      const tied: boolean[] = [];
      sh.forEach((s, i) => {
        const p = s.parent;
        tied[i] = !!p && i > 0 && (ids[i - 1] === p || (tied[i - 1] && sh[i - 1].parent === p));
      });
      sh.forEach((s, i) => {
        flag(s.el, 'is-parent', parents.has(ids[i]));
        flag(s.el, 'is-tied', tied[i]);
        flag(s.el, 'is-tied-last', tied[i] && !(tied[i + 1] && sh[i + 1].parent === s.parent));
      });
    }
  }

  /** Esc inside a host's slotted body (`slot="body:<id>"`) closes that card like Esc inside a built-in body. */
  #onHostKey(e: KeyboardEvent): void {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    const target = e.target as HTMLElement | null;
    // From the shadow tree the target is retargeted to the host: the root's handler has it.
    if (!target || target === this || !this.contains(target) || ownsEscape(target)) return;
    let top: Element | null = target;
    while (top && top.parentElement !== this) top = top.parentElement;
    const slot = top?.getAttribute('slot') ?? '';
    if (!slot.startsWith('body:')) return;
    const id = slot.slice(5);
    if (!this.#open.has(id)) return;
    e.stopPropagation();
    if (this.#toggle(id, true, e)) this.#cards.get(id)?.face.focus({ preventScroll: true });
  }

  /**
   * Open / close one card in place. Keyboard toggles skip the transition. Returns false when the host prevented it.
   * `e` is the person's event (sounded); `reveal()` passes none.
   */
  #toggle(id: string, instant: boolean, e?: Event): boolean {
    const sh = this.#cards.get(id);
    if (!sh || !sh.face.hasAttribute('aria-controls')) return false;
    const open = !this.#open.has(id);
    if (!this.emit('ui-toggle', { cardId: id, expanded: open })) return false;
    if (e) this.sound(open ? 'open' : 'close', { emphasis: 'subtle' }, e);
    if (open) this.#open.add(id);
    else this.#open.delete(id);
    if (instant) sh.el.classList.add('no-motion');
    this.#applyOpen(sh, open);
    if (instant) {
      void sh.el.offsetHeight;
      sh.el.classList.remove('no-motion');
    }
    // Closed again, an attention card's ping starts anew — put it back on the shared beat (0.32.0).
    if (!open && sh.el.classList.contains('is-attention')) syncOwnerBadgeOrbit(sh.el, ATTENTION_ANIMS);
    return true;
  }

  /** Open / close a group (`ui-group-toggle`, cancelable). The person's choice then rules over `group.open`. */
  #setGroup(col: string, group: string, open: boolean, e?: Event): boolean {
    if (!this.emit('ui-group-toggle', { columnId: col, groupId: group, open })) return false;
    if (e) this.sound(open ? 'open' : 'close', { emphasis: 'subtle' }, e);
    this.#groupOpen.set(gkey(col, group), open);
    this.renderNow();
    return true;
  }

  #applyOpen(sh: Shell, open: boolean): void {
    if (sh.el.classList.contains('is-open') !== open) sh.el.classList.toggle('is-open', open);
    if (sh.face.hasAttribute('aria-controls')) sh.face.setAttribute('aria-expanded', String(open));
    sh.expand.toggleAttribute('inert', !open);
  }

  // ── Reconciler ──

  #skeleton(): void {
    if (this.#wrap) return;
    const wrap = document.createElement('div');
    wrap.className = 'ib';
    const live = document.createElement('p');
    live.className = 'sr-only';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    const board = document.createElement('div');
    board.className = 'ib-board';
    wrap.append(live, board);
    this.content.append(wrap);
    this.#wrap = wrap;
    this.#live = live;
    this.#board = board;
  }

  /** `.ib[data-view]` mirrors the `view` attribute; the CSS follows it (so a switch can be measured first). */
  #syncView(): void {
    const wrap = this.#wrap;
    if (!wrap) return;
    const v = this.getAttribute('view');
    if (v === 'board' || v === 'list') {
      if (wrap.getAttribute('data-view') !== v) wrap.setAttribute('data-view', v);
    } else if (wrap.hasAttribute('data-view')) wrap.removeAttribute('data-view');
  }

  #colShell(id: string): ColShell {
    const n = ++this.#seq;
    const el = document.createElement('section');
    el.className = 'ib-col';
    el.setAttribute('data-col', id);
    const head = document.createElement('div');
    head.className = 'ib-col-head';
    const name = document.createElement('h3');
    name.className = 'ib-col-name';
    name.id = `ib-c${n}-name`;
    const count = document.createElement('span');
    count.className = 'ib-count';
    count.id = `ib-c${n}-count`;
    head.append(name, count);
    const list = document.createElement('ul');
    list.className = 'ib-cards';
    list.setAttribute('role', 'list');
    const groupsEl = document.createElement('div');
    groupsEl.className = 'ib-groups';
    const skel = document.createElement('div');
    skel.className = 'ib-skel';
    skel.setAttribute('aria-hidden', 'true');
    const empty = document.createElement('p');
    empty.className = 'ib-empty';
    el.append(list, groupsEl, skel, empty);
    return { el, head, name, count, list, groupsEl, groups: new Map(), skel, skelN: 0, empty, bare: null };
  }

  #groupShell(gid: string): GroupShell {
    const n = ++this.#seq;
    const el = document.createElement('div');
    el.className = 'ib-group';
    el.setAttribute('data-group', gid);
    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'ib-group-head';
    head.innerHTML = CHEV_SVG;
    const label = document.createElement('span');
    label.className = 'ib-group-label';
    label.id = `ib-g${n}-label`;
    const count = document.createElement('span');
    count.className = 'ib-count';
    head.append(label, count);
    const list = document.createElement('ul');
    list.className = 'ib-cards ib-group-cards';
    list.id = `ib-g${n}-cards`;
    list.setAttribute('role', 'list');
    list.setAttribute('aria-labelledby', label.id);
    head.setAttribute('aria-controls', list.id);
    el.append(head, list);
    return { el, head, label, count, list };
  }

  /**
   * Where focus goes when the focused follow-up line (`attr` `data-followup`; `id` `null` for "+N more") or child line
   * (`data-child`, 0.37.0; `null` for the children toggle) is gone: the first line still drawn after it in the old
   * `order`, else the last one before it, else any line, else the children toggle (for a child line), else the card's
   * face (made focusable when it is not a button).
   */
  #lineHeir(
    cardId: string,
    attr: 'data-followup' | 'data-child',
    id: string | null,
    order: string[],
  ): HTMLElement | undefined {
    const face = this.#cards.get(cardId)?.face;
    if (!face) return undefined;
    const lines = Array.from(face.querySelectorAll<HTMLElement>(`[${attr}]`));
    const byId = new Map(lines.map((b) => [b.getAttribute(attr) ?? '', b]));
    const at = id === null ? order.length : order.indexOf(id);
    const after = order.slice(at + 1).find((x) => byId.has(x));
    const before = order
      .slice(0, Math.max(0, at))
      .reverse()
      .find((x) => byId.has(x));
    const heir =
      (after !== undefined ? byId.get(after) : undefined) ??
      (before !== undefined ? byId.get(before) : undefined) ??
      lines[lines.length - 1] ??
      (attr === 'data-child' ? (face.querySelector<HTMLElement>('[data-kids]') ?? undefined) : undefined);
    if (heir) return heir;
    if (!face.hasAttribute('tabindex')) face.setAttribute('tabindex', '-1');
    return face;
  }

  #shell(id: string): Shell {
    const el = document.createElement('li');
    el.className = 'ib-card';
    el.setAttribute('data-card', id);
    // The connector to its epic (0.37.0), drawn only while the card is tied (`li::before` / `::after` are the
    // attention cue's).
    const tie = document.createElement('span');
    tie.className = 'ib-tie';
    tie.setAttribute('aria-hidden', 'true');
    const face = document.createElement('div');
    face.className = 'ib-face';
    face.setAttribute('data-key', `f:${id}`);
    const expand = document.createElement('div');
    expand.className = 'ib-expand';
    expand.id = `ib-x${++this.#seq}`;
    expand.setAttribute('inert', '');
    const body = document.createElement('div');
    body.className = 'ib-expand-inner';
    expand.append(body);
    el.append(tie, face, expand);
    return {
      el,
      face,
      expand,
      body,
      faceHtml: null,
      bodyHtml: null,
      col: '',
      status: '',
      flip: null,
      parent: '',
      kids: `ib-k${++this.#seq}`,
    };
  }

  /** Column heads (`h:<column>`) and group heads (`g:<gkey>`) on screen. */
  #heads(): Map<string, HTMLElement> {
    const out = new Map<string, HTMLElement>();
    for (const [id, c] of this.#cols) {
      if (c.head.isConnected) out.set(`h:${id}`, c.head);
      for (const [k, g] of c.groups) if (g.el.isConnected) out.set(`g:${k}`, g.head);
    }
    return out;
  }

  #motion(): Motion {
    const cs = typeof getComputedStyle === 'function' ? getComputedStyle(this) : null;
    const ms = (name: string, fallback: number) => {
      const raw = cs?.getPropertyValue(name).trim() ?? '';
      const v = Number.parseFloat(raw);
      if (!Number.isFinite(v)) return fallback;
      return /[^m]s$/.test(raw) ? v * 1000 : v;
    };
    const str = (name: string, fallback: string) => cs?.getPropertyValue(name).trim() || fallback;
    return {
      move: ms('--dur-move', 320),
      fade: ms('--dur-fade', 180),
      easeOut: str('--ease-out', 'cubic-bezier(0.23, 1, 0.32, 1)'),
      easeInOut: str('--ease-in-out', 'cubic-bezier(0.77, 0, 0.175, 1)'),
    };
  }

  /** Top-left of the element's full-size box as drawn (a move in flight included, an entrance scale not). */
  #boxOf(el: HTMLElement): { x: number; y: number } {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - el.offsetWidth / 2, y: r.top + r.height / 2 - el.offsetHeight / 2 };
  }

  /**
   * The page's scroll. A glide's target is remembered in page px, so a page scroll between the glide's start and a
   * re-aim does not move it. Inner scrollers (the board, a host's panel) are not counted: most of their scrolls
   * during a resize burst are layout's own (re-snap, scroll anchoring) and were never painted, so subtracting them
   * would be wrong more often than right — a reader scrolling one within the 320 ms glide sees a start off by that.
   */
  #scroll(): { x: number; y: number } {
    return typeof window === 'undefined' ? { x: 0, y: 0 } : { x: window.scrollX || 0, y: window.scrollY || 0 };
  }

  /** Remember a glide: its target in page px (see `#scroll`) and its starting offset. */
  #noteGlide(el: Element, anim: Animation, to: { x: number; y: number }, dx: number, dy: number): void {
    const s = this.#scroll();
    this.#glides.set(el, { anim, x: to.x + s.x, y: to.y + s.y, dx, dy });
  }

  /**
   * Where the glide `anim` draws `el` now (viewport px): its target plus what is left of its offset, from the
   * animation's eased progress. Null when that is not known — the caller keeps the position it was given.
   */
  #drawnAt(el: Element, anim: Animation): { x: number; y: number } | null {
    const g = this.#glides.get(el);
    if (!g || g.anim !== anim) return null;
    const raw = anim.effect?.getComputedTiming?.().progress;
    const p = raw == null ? Number.NaN : Number(raw);
    if (!Number.isFinite(p)) return null;
    // Not clamped: an overshooting easing token draws past the target (p > 1) and so does this.
    const left = 1 - p;
    const s = this.#scroll();
    return { x: g.x - s.x + g.dx * left, y: g.y - s.y + g.dy * left };
  }

  protected override update(): void {
    this.#skeleton();
    this.#syncView();
    const board = this.#board!;
    const t = this.#t;
    const d = this.data;
    const now = Date.now();
    const active = this.root.activeElement as HTMLElement | null;
    const activeKey = active?.dataset?.key;
    const activeCard = this.#cardOf(active);
    // A follow-up line or "+N more" the host drops (0.34.0) hands focus to the card's next line, else its previous one,
    // else its face — so the order the lines had is kept here. A child line or the children toggle (0.37.0) likewise.
    const lineAttr: 'data-followup' | 'data-child' | null =
      activeKey?.startsWith('u:') || activeKey?.startsWith('v:')
        ? 'data-followup'
        : activeKey?.startsWith('kc:') || activeKey?.startsWith('k:')
          ? 'data-child'
          : null;
    const lineWas =
      lineAttr !== null && activeCard !== null
        ? {
            attr: lineAttr,
            id: active?.getAttribute(lineAttr) ?? null,
            order: Array.from(
              this.#cards.get(activeCard)?.face.querySelectorAll<HTMLElement>(`[${lineAttr}]`) ?? [],
            ).map((b) => b.getAttribute(lineAttr) ?? ''),
          }
        : null;
    const hidden = typeof document !== 'undefined' && document.hidden;
    const reduced = prefersReducedMotion();
    const live = this.#painted && !hidden;
    const canAnimate = live && typeof HTMLElement.prototype.animate === 'function';
    const openLabel = d?.openLabel === false ? false : typeof d?.openLabel === 'string' ? d.openLabel : t.open;
    const startOpen = new Set((Array.isArray(d?.expanded) ? d.expanded : []).map(String));
    const load: InboxLoad = d?.load === 'loading' || d?.load === 'failed' ? d.load : 'ready';
    const ready = load === 'ready';

    // 1. Columns, groups and cards as the data puts them (first column / group / card id wins). Each column's own
    //    cards and each open group are a list; a closed group's cards are counted, not drawn.
    const cols: PlanCol[] = [];
    const all = new Map<string, InboxCard>();
    const slots: Record<string, string[]> = Object.create(null);
    const want: Record<string, string> = Object.create(null);
    const closedHome = new Map<string, { col: string; group: string }>();
    const seenCols = new Set<string>();
    const take = (cards: unknown, list: string | null, home?: { col: string; group: string }): number => {
      let n = 0;
      for (const card of Array.isArray(cards) ? (cards as InboxCard[]) : []) {
        if (!card || card.id == null) continue;
        const id = String(card.id);
        if (all.has(id)) continue;
        all.set(id, card);
        n++;
        if (list !== null) {
          slots[list].push(id);
          want[id] = list;
        } else if (home) closedHome.set(id, home);
      }
      return n;
    };
    for (const col of Array.isArray(d?.columns) ? d.columns : []) {
      if (!col || col.id == null) continue;
      const cid = String(col.id);
      if (seenCols.has(cid)) continue;
      seenCols.add(cid);
      slots[cid] = [];
      const plan: PlanCol = { id: cid, col, groups: [] };
      cols.push(plan);
      take(col.cards, cid);
      const seenGroups = new Set<string>();
      for (const g of Array.isArray(col.groups) ? col.groups : []) {
        if (!g || g.id == null) continue;
        const gid = String(g.id);
        if (seenGroups.has(gid)) continue;
        seenGroups.add(gid);
        const key = gkey(cid, gid);
        const open = this.#groupOpen.get(key) ?? g.open !== false;
        if (open) slots[key] = [];
        const n = take(g.cards, open ? key : null, { col: cid, group: gid });
        plan.groups.push({ gid, key, label: str(g.label), open, closed: open ? 0 : n });
      }
    }
    this.#closedHome = closedHome;

    // 2. Status changes since the last data — said once, before any hold.
    const changes: InboxCard[] = [];
    const nextStatus = new Map<string, InboxStatus>();
    for (const [id, card] of all) {
      const s = statusOf(card);
      const prev = this.#lastStatus.get(id);
      if (prev && prev !== s) changes.push(card);
      nextStatus.set(id, s);
    }
    this.#lastStatus = nextStatus;

    // 3. Status first, move later: a card whose list changed stays where it is drawn for BOARD_HOLD_MS.
    const drawn: Record<string, string> = Object.create(null);
    for (const [id, sh] of this.#cards) if (want[id] && slots[sh.col]) drawn[id] = sh.col;
    const held = holdLanes(want, drawn, this.#holds, now, live && !reduced);
    const placed = placeHolds(slots, held.lanes, this.#order);
    for (const id of placed.dropped) delete held.holds[id];
    this.#holds = held.holds;
    clearTimeout(this.#holdTimer);
    this.#holdTimer = undefined;
    if (held.wakeAt)
      this.#holdTimer = setTimeout(
        () => {
          this.#holdTimer = undefined;
          this.requestRender();
        },
        Math.max(0, held.wakeAt - now) + 20,
      );

    // 4. FLIP — first boxes (cards and heads).
    const first = new Map<string, { x: number; y: number }>();
    const firstCol = new Map<string, string>();
    const firstStatus = new Map<string, string>();
    for (const [id, sh] of this.#cards) {
      firstCol.set(id, sh.col);
      firstStatus.set(id, sh.status);
      if (canAnimate) first.set(id, this.#boxOf(sh.el));
    }
    const firstHeads = new Map<string, { x: number; y: number }>();
    if (canAnimate) for (const [k, el] of this.#heads()) firstHeads.set(k, this.#boxOf(el));
    const motion = canAnimate ? this.#motion() : null;

    // 5. Columns, in order.
    board.style.setProperty('--ib-cols', String(Math.max(1, cols.length)));
    board.setAttribute('aria-busy', String(load === 'loading'));
    cols.forEach(({ id }, i) => {
      let c = this.#cols.get(id);
      if (!c) {
        c = this.#colShell(id);
        this.#cols.set(id, c);
      }
      if (board.children[i] !== c.el) board.insertBefore(c.el, board.children[i] ?? null);
    });

    // 6. Each column: head, its own cards, its groups (head + cards when open), skeletons, the empty hint.
    const fresh = new Set<string>();
    const freshGroups = new Set<string>();
    const staleGroups = new Map<string, { g: GroupShell; section: HTMLElement }>();
    const order: Record<string, string[]> = Object.create(null);
    const place = (list: HTMLElement, key: string) => {
      const ids = placed.slots[key] ?? [];
      order[key] = ids;
      ids.forEach((id, i) => {
        let sh = this.#cards.get(id);
        if (!sh) {
          sh = this.#shell(id);
          this.#cards.set(id, sh);
          fresh.add(id);
          if (startOpen.has(id)) this.#open.add(id);
        }
        this.#patch(sh, id, all.get(id)!, t, openLabel, live && !reduced);
        sh.col = key;
        if (list.children[i] !== sh.el) list.insertBefore(sh.el, list.children[i] ?? null);
      });
      return ids.length;
    };
    cols.forEach(({ id: colId, col, groups }, ci) => {
      const c = this.#cols.get(colId)!;
      const label = String(col.label ?? '');
      const bare = col.bare === true;
      if (c.bare !== bare) {
        c.bare = bare;
        c.el.classList.toggle('is-bare', bare);
        if (bare) {
          c.head.remove();
          c.el.removeAttribute('aria-labelledby');
        } else {
          c.el.prepend(c.head);
          c.el.removeAttribute('aria-label');
          c.el.setAttribute('aria-labelledby', `${c.name.id} ${c.count.id}`);
        }
      }
      if (bare && c.el.getAttribute('aria-label') !== label) c.el.setAttribute('aria-label', label);
      let total = place(c.list, colId);
      let drawnHere = total;
      // Groups, in order; a group that left fades out where it was.
      const keep = new Set(groups.map((g) => g.key));
      for (const [k, g] of c.groups) {
        if (keep.has(k)) continue;
        c.groups.delete(k);
        staleGroups.set(k, { g, section: c.el });
      }
      groups.forEach((pg, gi) => {
        let g = c.groups.get(pg.key);
        if (!g) {
          g = this.#groupShell(pg.gid);
          g.head.setAttribute('data-key', `g:${pg.key}`);
          c.groups.set(pg.key, g);
          freshGroups.add(pg.key);
        }
        if (c.groupsEl.children[gi] !== g.el) c.groupsEl.insertBefore(g.el, c.groupsEl.children[gi] ?? null);
        if (g.label.textContent !== pg.label) g.label.textContent = pg.label;
        const expanded = String(pg.open);
        if (g.head.getAttribute('aria-expanded') !== expanded) g.head.setAttribute('aria-expanded', expanded);
        if (g.list.hidden !== !pg.open) g.list.hidden = !pg.open;
        const n = pg.open ? place(g.list, pg.key) : pg.closed;
        if (pg.open) drawnHere += n;
        total += n;
        const gc = ready ? String(n) : '';
        if (g.count.textContent !== gc) g.count.textContent = gc;
      });
      if (c.name.textContent !== label) c.name.textContent = label;
      const count = ready ? String(total) : '';
      if (c.count.textContent !== count) c.count.textContent = count;
      const empty = typeof col.emptyText === 'string' && col.emptyText ? col.emptyText : t.empty;
      if (c.empty.textContent !== empty) c.empty.textContent = empty;
      const hideEmpty = !ready || bare || drawnHere > 0 || groups.length > 0;
      if (c.empty.hidden !== hideEmpty) c.empty.hidden = hideEmpty;
      // Skeletons hold the place of what is coming while the board loads (only where no card is drawn yet).
      const skelN = load === 'loading' && drawnHere === 0 ? SKELETONS[ci % SKELETONS.length] : 0;
      if (c.skelN !== skelN) {
        c.skelN = skelN;
        c.skel.innerHTML = SKEL_CARD.repeat(skelN);
      }
    });
    this.#order = order;
    // 6½. Families (0.37.0): epics, and the children tied under them.
    this.#tie(order);

    // 7. Cards no longer drawn fade out where they were (inside a group that left, they go with it); then groups
    //    and columns that left go.
    const staleKeys = new Set(staleGroups.keys());
    for (const [id, sh] of this.#cards) {
      if (want[id] !== undefined) continue;
      this.#cards.delete(id);
      if (!all.has(id)) this.#open.delete(id);
      this.#shown.delete(`${id}\u0000tok`);
      this.#shown.delete(`${id}\u0000usd`);
      const from = firstCol.get(id) ?? '';
      if (staleKeys.has(from) && motion) {
        sh.flip?.cancel();
        sh.flip = null;
        sh.el.removeAttribute('data-card');
        continue;
      }
      this.#exit(sh, first.get(id), slots[from] ? motion : null);
    }
    for (const [k, { g, section }] of staleGroups)
      this.#exitGroup(
        g,
        firstHeads.get(`g:${k}`),
        section,
        section.isConnected && slots[k.split('\u0000')[0]] ? motion : null,
      );
    for (const [id, c] of this.#cols) {
      if (slots[id]) continue;
      c.el.remove();
      this.#cols.delete(id);
    }

    // 8. Enter, move (FLIP), and the status icon's pop where the status changed on screen.
    if (motion) {
      for (const [id, sh] of this.#cards) {
        if (fresh.has(id)) {
          sh.el.animate(
            reduced
              ? [{ opacity: 0 }, { opacity: 1 }]
              : [
                  { opacity: 0, transform: 'scale(0.97)' },
                  { opacity: 1, transform: 'scale(1)' },
                ],
            { duration: motion.fade, easing: motion.easeOut },
          );
          continue;
        }
        const prev = firstStatus.get(id);
        if (!reduced && prev && prev !== sh.status)
          sh.face.querySelector('.ib-tag-icon')?.animate(
            [
              { opacity: 0, transform: 'scale(0.6)' },
              { opacity: 1, transform: 'scale(1)' },
            ],
            { duration: motion.move, easing: motion.easeOut },
          );
        const a = first.get(id);
        if (!a) continue;
        const wasFlying = sh.el.classList.contains('is-flying');
        if (sh.flip) {
          sh.flip.cancel();
          sh.flip = null;
        }
        if (wasFlying) sh.el.classList.remove('is-flying');
        const b = this.#boxOf(sh.el);
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
        this.#flip(sh, dx, dy, wasFlying || firstCol.get(id) !== sh.col, motion, reduced);
      }
      // Heads ride along: a group that opens or closes moves the heads under it.
      for (const [k, el] of this.#heads()) {
        const a = firstHeads.get(k);
        if (a) {
          if (!reduced) this.#slide(el, a, motion);
        } else if (k.startsWith('g:') && freshGroups.has(k.slice(2)))
          el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: motion.fade, easing: motion.easeOut });
      }
    }

    // 9. Announce (once the board is certified, unless the host mutes it), keep focus, start the clocks.
    if (d && ready && d.announce !== false) {
      const own = d.announce;
      const counts =
        own && typeof own === 'object'
          ? { needs: Math.floor(num(own.needs)), running: Math.floor(num(own.running)) }
          : boardCounts(cols.map((c) => c.col));
      this.#announce(counts, changes, t);
    }
    if (activeKey && (this.root.activeElement as HTMLElement | null)?.dataset?.key !== activeKey) {
      const keys = this.$$<HTMLElement>('[data-key]');
      // A TL;DR × the host took away with its box (0.20.0): focus goes to that card's face, never to the page.
      const fallback = activeKey.startsWith('d:') ? `f:${activeKey.slice(2)}` : '';
      const next =
        // Two cards' keys can meet (`kc:a:b:c` is card a:b's child c and card a's child b:c): its own card's first.
        (activeCard !== null
          ? keys.find((el) => el.dataset.key === activeKey && this.#cardOf(el) === activeCard)
          : undefined) ??
        keys.find((el) => el.dataset.key === activeKey) ??
        (fallback ? keys.find((el) => el.dataset.key === fallback) : undefined) ??
        (activeCard !== null && lineWas
          ? this.#lineHeir(activeCard, lineWas.attr, lineWas.id, lineWas.order)
          : undefined);
      next?.focus({ preventScroll: true });
    }
    // "Show all" and an open children list are kept only for cards the data still holds (a card in a closed group
    // included).
    if (this.#fuAll.size || this.#kidsOpen.size) {
      const ids = new Set<string>();
      for (const col of Array.isArray(d?.columns) ? d.columns : []) {
        for (const c of Array.isArray(col?.cards) ? col.cards : []) if (c) ids.add(String(c.id));
        for (const g of Array.isArray(col?.groups) ? col.groups : [])
          for (const c of Array.isArray(g?.cards) ? g.cards : []) if (c) ids.add(String(c.id));
      }
      for (const id of Array.from(this.#fuAll)) if (!ids.has(id)) this.#fuAll.delete(id);
      for (const id of Array.from(this.#kidsOpen)) if (!ids.has(id)) this.#kidsOpen.delete(id);
    }
    if (this.#fuFocus !== null) {
      const lines = this.#cards.get(this.#fuFocus)?.face.querySelectorAll<HTMLElement>('[data-followup]');
      this.#fuFocus = null;
      (lines?.[FOLLOWUP_MAX_LINES] ?? lines?.[lines.length - 1])?.focus({ preventScroll: true });
    }
    if (this.#kidsFocus !== null) {
      const first = this.#cards.get(this.#kidsFocus)?.face.querySelector<HTMLElement>('[data-child]');
      this.#kidsFocus = null;
      first?.focus({ preventScroll: true });
    }
    // The families marked (0.37.0) follow the board: a card that left marks nothing, the focus is where it is now.
    if (this.#kinAt.pointer !== null && !this.#cards.has(this.#kinAt.pointer)) this.#kinAt.pointer = null;
    this.#kinAt.focus = this.#cardOf(this.root.activeElement);
    this.#paintKin();
    // 9. The viewer's own badges ride the document's shared orbit. Last, after every DOM move: a CSS animation exists
    //    only on a connected element and restarts when its card is drawn, rewritten or moved (re-inserted — a reorder,
    //    a column change, an exit re-appended to fade out), so every self pill is put back on the orbit here.
    for (const self of Array.from(this.content.querySelectorAll<HTMLElement>('.ib-badge.is-self')))
      syncOwnerBadgeOrbit(self);
    //    The attention pings (0.32.0) ride one shared beat the same way: every card that waits on the viewer pings
    //    at the same moment, and a card drawn, rewritten or moved never pings out of step.
    for (const c of Array.from(this.content.querySelectorAll<HTMLElement>('li.ib-card.is-attention')))
      syncOwnerBadgeOrbit(c, ATTENTION_ANIMS);
    this.#tickIn(this.content);
    this.#syncTick();
    // The first paint with data never animates (a render before any data, or skeletons only, does not count).
    if (d && load !== 'loading') this.#painted = true;
  }

  #patch(sh: Shell, id: string, card: InboxCard, t: Strings, openLabel: string | false, countUp: boolean): void {
    const status = statusOf(card);
    if (sh.status !== status) {
      sh.status = status;
      sh.el.setAttribute('data-status', status);
    }
    const attention = card.attention === true;
    if (sh.el.classList.contains('is-attention') !== attention) sh.el.classList.toggle('is-attention', attention);
    // 0.37.0 — its epic: a card is never its own.
    const parent = str(card.parent) === id ? '' : str(card.parent);
    if (sh.parent !== parent) {
      sh.parent = parent;
      if (parent) sh.el.setAttribute('data-parent', parent);
      else sh.el.removeAttribute('data-parent');
      flag(sh.el, 'is-child', !!parent);
    }
    if (this.#fuAll.has(card.id) && cardFollowups(card).length <= FOLLOWUP_MAX_LINES) this.#fuAll.delete(card.id);
    if (this.#kidsOpen.has(id) && !cardChildren(card).length) this.#kidsOpen.delete(id);
    const face = renderFace(card, t, this.#fuAll.has(card.id), this.#kidsOpen.has(id), sh.kids);
    if (sh.faceHtml !== face) {
      sh.face.innerHTML = face;
      sh.faceHtml = face;
      // Spinners share one phase, so a rewritten face never makes its ring jump.
      const phase = `-${Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) % 900)}ms`;
      for (const s of Array.from(sh.face.querySelectorAll<HTMLElement>('.ib-spin'))) s.style.animationDelay = phase;
      this.#countUp(id, sh.face, countUp);
    }
    // `bodyMode: 'slot'`: the host's light-DOM body is projected here; the slot node itself never changes.
    const body =
      card.bodyMode === 'slot'
        ? `<slot class="ib-slot" name="${escAttr(`body:${id}`)}"></slot>`
        : renderBody(card, t, openLabel);
    if (sh.bodyHtml !== body) {
      sh.body.innerHTML = body;
      sh.bodyHtml = body;
    }
    if (body) {
      if (sh.face.getAttribute('role') !== 'button') {
        sh.face.setAttribute('role', 'button');
        sh.face.setAttribute('tabindex', '0');
        sh.face.setAttribute('aria-controls', sh.expand.id);
      }
    } else if (sh.face.hasAttribute('role')) {
      for (const a of ['role', 'tabindex', 'aria-controls', 'aria-expanded']) sh.face.removeAttribute(a);
      this.#open.delete(id);
    }
    this.#applyOpen(sh, this.#open.has(id));
  }

  /** Move = translate only, raised while it changes column. Reduced motion: no travel, a fade where it landed. */
  #flip(sh: Shell, dx: number, dy: number, raise: boolean, m: Motion, reduced: boolean): void {
    if (reduced) {
      if (raise) sh.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: m.fade, easing: 'linear' });
      return;
    }
    if (raise) sh.el.classList.add('is-flying');
    const to = this.#boxOf(sh.el);
    const anim = sh.el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
      duration: m.move,
      easing: m.easeInOut,
      composite: 'add',
    });
    sh.flip = anim;
    this.#noteGlide(sh.el, anim, to, dx, dy);
    anim.onfinish = () => {
      if (sh.flip !== anim) return;
      sh.flip = null;
      sh.el.classList.remove('is-flying');
    };
  }

  /** A head glides from `from` to where it is now; an interrupted glide restarts from where it was drawn. */
  #slide(el: HTMLElement, from: { x: number; y: number }, m: Motion): void {
    const prev = this.#slides.get(el);
    if (prev) {
      from = this.#drawnAt(el, prev) ?? from;
      prev.cancel();
      this.#slides.delete(el);
    }
    const b = this.#boxOf(el);
    const dx = from.x - b.x;
    const dy = from.y - b.y;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    const anim = el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
      duration: m.move,
      easing: m.easeInOut,
    });
    this.#slides.set(el, anim);
    this.#noteGlide(el, anim, b, dx, dy);
    anim.onfinish = () => {
      if (this.#slides.get(el) === anim) this.#slides.delete(el);
    };
  }

  /** Exit = opacity only, absolutely placed in its column where it was drawn, so the rest FLIP into the gap. */
  #exit(sh: Shell, box: { x: number; y: number } | undefined, m: Motion | null): void {
    if (sh.flip) {
      sh.flip.cancel();
      sh.flip = null;
    }
    const section = sh.el.closest<HTMLElement>('.ib-col');
    if (!box || !section || !m) {
      sh.el.remove();
      return;
    }
    const hr = section.getBoundingClientRect();
    const width = sh.el.offsetWidth;
    sh.el.removeAttribute('data-card');
    sh.el.removeAttribute('data-kin');
    sh.el.classList.remove('is-kin');
    sh.el.setAttribute('aria-hidden', 'true');
    sh.el.setAttribute('inert', '');
    sh.el.classList.add('is-exiting');
    sh.el.style.left = `${box.x - hr.left}px`;
    sh.el.style.top = `${box.y - hr.top}px`;
    sh.el.style.width = `${width}px`;
    section.append(sh.el);
    const anim = sh.el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: m.fade,
      easing: m.easeOut,
      fill: 'forwards',
    });
    anim.onfinish = anim.oncancel = () => sh.el.remove();
  }

  /** A group that left fades out with its cards, absolutely placed where it was, so the rest FLIP into the gap. */
  #exitGroup(g: GroupShell, box: { x: number; y: number } | undefined, section: HTMLElement, m: Motion | null): void {
    if (!box || !m || !g.el.isConnected) {
      g.el.remove();
      return;
    }
    const hr = section.getBoundingClientRect();
    const width = g.el.offsetWidth;
    g.el.classList.add('is-stale');
    g.el.setAttribute('aria-hidden', 'true');
    g.el.setAttribute('inert', '');
    g.el.style.left = `${box.x - hr.left}px`;
    g.el.style.top = `${box.y - hr.top}px`;
    g.el.style.width = `${width}px`;
    section.append(g.el);
    const anim = g.el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: m.fade,
      easing: m.easeOut,
      fill: 'forwards',
    });
    anim.onfinish = anim.oncancel = () => g.el.remove();
  }

  /**
   * The polite region says "N need you, M running" — the first sentence at once, then only real changes; a burst
   * within ANNOUNCE_MS is said once (the last text). One card changing status is named first.
   */
  #announce(c: { needs: number; running: number }, changes: InboxCard[], t: Strings): void {
    const live = this.#live;
    if (!live) return;
    const counts = t.announce(c.needs, c.running);
    if (!changes.length && counts === this.#lastCounts) return;
    this.#lastCounts = counts;
    const lead = changes.length === 1 ? t.changed(String(changes[0].title ?? ''), statusWord(changes[0], t)) : '';
    const text = lead ? `${lead} ${counts}` : counts;
    this.#announcePending = text;
    if (!live.textContent && !this.#announceTimer) {
      live.textContent = text;
      return;
    }
    if (this.#announceTimer || live.textContent === text) return;
    this.#announceTimer = setTimeout(() => {
      this.#announceTimer = undefined;
      if (live.textContent !== this.#announcePending) live.textContent = this.#announcePending;
    }, ANNOUNCE_MS);
  }

  /** Clocks and ages are written in place (never by a re-render), once a second while any is on the board. */
  #tickIn(root: ParentNode): void {
    const now = Date.now();
    const t = this.#t;
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-clock]'))) {
      const from = Number(el.dataset.from) || 0;
      const acc = Number(el.dataset.acc) || 0;
      const text = t.duration(acc + (from ? Math.max(0, now - from) : 0));
      if (el.textContent !== text) el.textContent = text;
    }
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-at]'))) {
      const text = t.ago(Number(el.dataset.at) || 0, now);
      if (el.textContent !== text) el.textContent = text;
    }
  }

  #syncTick(): void {
    const need = !!this.content.querySelector('[data-clock], [data-at]');
    if (need && !this.#tickTimer) this.#tickTimer = setInterval(() => this.#tickIn(this.content), 1000);
    else if (!need && this.#tickTimer) {
      clearInterval(this.#tickTimer);
      this.#tickTimer = undefined;
    }
  }

  /** Tokens and cost count up (900 ms, ease-out cubic) when they grow on a card on screen; else they are set. */
  #countUp(id: string, root: HTMLElement, animate: boolean): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-cnt]'))) {
      const kind = el.dataset.cnt ?? 'tok';
      const key = `${id}\u0000${kind}`;
      const to = Number(el.dataset.to) || 0;
      const shown = this.#shown.get(key);
      if (shown === undefined || !(to > shown) || !animate || typeof requestAnimationFrame !== 'function') {
        this.#shown.set(key, to);
        this.#counting.delete(key);
        continue;
      }
      el.textContent = fmtCount(kind, shown);
      this.#counting.set(key, { el, kind, from: shown, to, t0: now });
    }
    if (this.#counting.size && !this.#raf && typeof requestAnimationFrame === 'function')
      this.#raf = requestAnimationFrame(this.#step);
  }

  #step = (now: number): void => {
    for (const [key, c] of this.#counting) {
      const p = Math.min(1, Math.max(0, (now - c.t0) / COUNT_MS));
      const v = p >= 1 ? c.to : c.from + (c.to - c.from) * (1 - (1 - p) ** 3);
      const text = fmtCount(c.kind, v);
      if (c.el.textContent !== text) c.el.textContent = text;
      this.#shown.set(key, v);
      if (p >= 1) this.#counting.delete(key);
    }
    this.#raf = this.#counting.size ? requestAnimationFrame(this.#step) : 0;
  };
}

define('ui-agent-inbox', UiAgentInbox);

declare global {
  interface HTMLElementTagNameMap {
    'ui-agent-inbox': UiAgentInbox;
  }
}
