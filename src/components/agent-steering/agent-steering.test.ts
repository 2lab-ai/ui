import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import type { UiComposer } from '../composer/composer';
import '../composer/composer';
import { STEERING_GRACE_MS, STEERING_PEEK_MS, type UiAgentSteering } from './agent-steering';
import type {
  AgentSteeringData,
  SteeringItem,
  SteeringLocal,
  SteeringOverlay,
  SteeringRow,
  SteeringSubmitDetail,
} from './logic';
import {
  claimLocals,
  clipNote,
  normSteeringItems,
  noteAge,
  settleOverlays,
  sheetDismisses,
  splitSteeringRows,
  steerEnterAction,
  steeringActions,
  steeringDockBadge,
  steeringDockTone,
  steeringFocusIndex,
  steeringItemKey,
  steeringQueueLayout,
  steeringRows,
} from './logic';
import { steeringStrings } from './strings';

const XSS = '<img src=x onerror=alert(1)>';

function mount(data: AgentSteeringData | undefined, attrs: Record<string, string> = {}): UiAgentSteering {
  const el = document.createElement('ui-agent-steering');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = <T extends Element = HTMLElement>(el: UiAgentSteering, sel: string) =>
  el.shadowRoot?.querySelector<T>(sel) ?? null;
const qa = (el: UiAgentSteering, sel: string) => [...(el.shadowRoot?.querySelectorAll<HTMLElement>(sel) ?? [])];
const rows = (el: UiAgentSteering) => qa(el, '.as-item:not([data-leaving])');
const field = (el: UiAgentSteering) => q<HTMLTextAreaElement>(el, '.as-input') as HTMLTextAreaElement;
const set = (el: UiAgentSteering, patch: Partial<AgentSteeringData>) => {
  el.data = { ...(el.data ?? {}), ...patch };
  el.renderNow();
};
function events<T = unknown>(el: UiAgentSteering, name: string, cancel = false): T[] {
  const out: T[] = [];
  el.addEventListener(name, (e) => {
    out.push((e as CustomEvent<T>).detail);
    if (cancel) e.preventDefault();
  });
  return out;
}
function type(el: UiAgentSteering, text: string): void {
  const f = field(el);
  f.value = text;
  f.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
}
function key(target: HTMLElement, k: string, init: KeyboardEventInit & { keyCode?: number } = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...init });
  if (init.keyCode !== undefined) Object.defineProperty(e, 'keyCode', { value: init.keyCode });
  target.dispatchEvent(e);
  return e;
}
const act = (el: UiAgentSteering, row: number, name: string) =>
  rows(el)[row]?.querySelector<HTMLElement>(`[data-act="${name}"]`) ?? null;
const item = (id: string, over: Partial<SteeringItem> = {}): SteeringItem => ({
  id,
  text: `note ${id}`,
  state: 'queued',
  ...over,
});
const two = (): SteeringItem[] => [item('a', { at: Date.now() - 120_000 }), item('b')];

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('logic', () => {
  it('normSteeringItems keeps notes with an id (first wins), reads an unknown state as queued', () => {
    const out = normSteeringItems([
      { id: 'a', text: 'x', state: 'steered', at: '5', author: 'Z', reason: 'r', files: ['f', 2], canEdit: false },
      { id: 'a', text: 'dup' },
      { text: 'no id' },
      null,
      { id: 'b', state: 'nonsense', at: 'soon' },
    ]);
    expect(out).toEqual([
      { id: 'a', text: 'x', state: 'steered', at: 5, author: 'Z', reason: 'r', files: ['f', '2'], canEdit: false },
      { id: 'b', text: '', state: 'queued' },
    ]);
    expect(normSteeringItems('nope')).toEqual([]);
  });

  it('settleOverlays keeps an overlay only while the host note is unchanged', () => {
    const a = item('a');
    const o = new Map<string, SteeringOverlay>([
      ['a', { state: 'sending', base: steeringItemKey(a) }],
      ['b', { state: 'cancelled', base: steeringItemKey(item('b')) }],
    ]);
    expect([...settleOverlays(o, [a]).keys()]).toEqual(['a']);
    expect(settleOverlays(o, [{ ...a, state: 'steered' }]).size).toBe(0);
    expect(settleOverlays(o, [{ ...a, text: 'edited' }]).size).toBe(0);
  });

  it('claimLocals: each new host note takes the oldest local row still in flight (failed ones stay)', () => {
    const local = (ref: string, state: SteeringLocal['state'] = 'sending'): SteeringLocal => ({
      ref,
      text: ref,
      mode: 'queue',
      at: 1,
      state,
    });
    const known = new Set(['a']);
    const r = claimLocals([local('x', 'failed'), local('y'), local('z')], [item('a'), item('n1')], known);
    expect(r.locals.map((l) => l.ref)).toEqual(['x', 'z']);
    expect([...r.known]).toEqual(['a', 'n1']);
    expect(claimLocals([local('y')], [item('a')], known).locals).toHaveLength(1);
  });

  it('steeringRows: overlays apply, cancelled notes are hidden, local rows come last', () => {
    const items = [item('a', { reason: 'edited' }), item('b'), item('c', { state: 'cancelled' })];
    const o = new Map<string, SteeringOverlay>([
      ['a', { state: 'queued', text: 'new', saving: true, base: steeringItemKey(items[0]) }],
      ['b', { state: 'cancelled', base: steeringItemKey(items[1]) }],
    ]);
    const out = steeringRows(items, o, [
      { ref: 'r1', text: 'mine', mode: 'steer', at: 1, state: 'sending', attachments: 2 },
    ]);
    expect(out.map((r) => r.key)).toEqual(['h:a', 'l:r1']);
    expect(out[0]).toMatchObject({ text: 'new', saving: true, reason: undefined });
    expect(out[1]).toMatchObject({ local: true, mode: 'steer', fileCount: 2 });
  });

  it('steeringActions per state, read-only and ended', () => {
    const row = (over: Partial<SteeringRow>): SteeringRow => ({
      key: 'h:a',
      id: 'a',
      local: false,
      text: 't',
      state: 'queued',
      files: [],
      fileCount: 0,
      canEdit: true,
      saving: false,
      ...over,
    });
    const on = { canAct: true, disabled: false };
    expect(steeringActions(row({}), on)).toEqual(['promote', 'edit', 'cancel']);
    expect(steeringActions(row({ canEdit: false }), on)).toEqual(['promote', 'cancel']);
    expect(steeringActions(row({ state: 'failed' }), on)).toEqual(['retry', 'cancel']);
    expect(steeringActions(row({ state: 'sending' }), on)).toEqual([]);
    expect(steeringActions(row({ state: 'steered' }), on)).toEqual([]);
    expect(steeringActions(row({ local: true }), on)).toEqual([]);
    expect(steeringActions(row({ local: true, state: 'failed' }), on)).toEqual(['retry', 'cancel']);
    expect(steeringActions(row({}), { canAct: false, disabled: false })).toEqual([]);
    expect(steeringActions(row({}), { canAct: true, disabled: true })).toEqual([]);
  });

  it('steerEnterAction: IME-safe, Shift and touch make a new line, ⌘/Ctrl steers only while running', () => {
    const k = (over: Record<string, unknown> = {}) =>
      ({ key: 'Enter', shiftKey: false, metaKey: false, ctrlKey: false, altKey: false, ...over }) as KeyboardEvent;
    expect(steerEnterAction(k())).toBe('queue');
    expect(steerEnterAction(k({ isComposing: true }))).toBe('none');
    expect(steerEnterAction(k({ keyCode: 229 }))).toBe('none');
    expect(steerEnterAction(k({ shiftKey: true }))).toBe('newline');
    expect(steerEnterAction(k(), { touch: true })).toBe('newline');
    expect(steerEnterAction(k({ metaKey: true }), { running: true })).toBe('steer');
    expect(steerEnterAction(k({ ctrlKey: true }), { running: true })).toBe('steer');
    expect(steerEnterAction(k({ metaKey: true }))).toBe('queue');
    expect(steerEnterAction(k({ key: 'a' }))).toBe('none');
  });

  it('steeringFocusIndex, clipNote and noteAge', () => {
    expect(steeringFocusIndex(3, 1)).toBe(1);
    expect(steeringFocusIndex(2, 2)).toBe(1);
    expect(steeringFocusIndex(0, 0)).toBe(-1);
    expect(clipNote('  a\n b  ')).toBe('a b');
    expect(clipNote('x'.repeat(80), 10)).toHaveLength(10);
    const n = 1_800_000_000_000;
    expect(noteAge(n - 10_000, n)).toBe('just now');
    expect(noteAge(n - 120_000, n)).toBe('2m ago');
    expect(noteAge(n - 120_000, n, 'ko')).toBe('2분 전');
    expect(noteAge(n - 3 * 3_600_000, n, 'ko')).toBe('3시간 전');
    expect(noteAge(n - 3 * 86_400_000, n)).toBe('3d ago');
  });
});

describe('<ui-agent-steering> render', () => {
  it('renders the queue with its count, the notes, and the running composer', () => {
    const el = mount({ running: true, items: two() });
    expect(rows(el)).toHaveLength(2);
    // Docked (the default): the notes wait behind the round button, nothing above the field.
    expect(q(el, '.as-queue')?.hasAttribute('data-open')).toBe(false);
    expect(q(el, '.as-dock')?.hasAttribute('data-shown')).toBe(true);
    expect(q(el, '.as-dock-n')?.textContent).toBe('2');
    expect(q(el, '.as-pop-title')?.textContent).toBe('Queued for the next step');
    expect(q(el, '.as-label-text')?.textContent).toBe('Queued for the next step');
    expect(q(el, '.as-count')?.textContent).toBe('2');
    expect(q(el, '.as-list')?.getAttribute('aria-label')).toBe('Queued for the next step · 2 notes');
    expect(rows(el)[0].querySelector('.as-age')?.textContent).toBe('2m ago');
    expect(field(el).placeholder).toBe('Steer the agent…');
    expect(field(el).getAttribute('aria-label')).toBe('Steer the agent');
    expect(q(el, '.as-hint')?.textContent).toContain('steer now');
    expect(q(el, '.as-send')?.getAttribute('aria-label')).toBe('Queue for the next step');
    expect(act(el, 0, 'promote')?.getAttribute('aria-label')).toBe('Send now: “note a”');
  });

  it('idle and empty: no queue, Enter sends', () => {
    const el = mount({ running: false, items: [] });
    expect(q(el, '.as-queue')?.hasAttribute('data-open')).toBe(false);
    expect(field(el).placeholder).toBe('Send a message…');
    expect(q(el, '.as-hint')?.textContent).toContain('send');
    expect(q(el, '.as-hint')?.textContent).not.toContain('steer now');
    expect(q<HTMLButtonElement>(el, '.as-send')?.disabled).toBe(true);
  });

  it('renders with no data at all (open, idle)', () => {
    const el = mount(undefined);
    expect(field(el)).toBeTruthy();
    expect(field(el).disabled).toBe(false);
  });

  it('shows every state with its label', () => {
    const el = mount({
      running: true,
      items: [
        item('a', { state: 'sending' }),
        item('b', { state: 'steered' }),
        item('c', { state: 'failed', reason: 'Interrupted by Stop' }),
        item('d', { files: ['a.sql', 'b.png'], author: 'Slack · Zhuge' }),
        item('e', { state: 'cancelled' }),
      ],
    });
    const r = rows(el);
    expect(r).toHaveLength(4);
    expect(r[0].textContent).toContain('Sending…');
    expect(r[0].querySelector('[data-act]')).toBeNull();
    expect(r[1].textContent).toContain('Delivered · the agent reads it at its next tool call');
    expect(r[2].textContent).toContain('Couldn’t send');
    expect(r[2].textContent).toContain('Interrupted by Stop');
    expect(r[2].querySelector('[data-act="retry"]')).toBeTruthy();
    expect(r[3].querySelector('.as-files')?.getAttribute('title')).toBe('a.sql, b.png');
    expect(r[3].textContent).toContain('2 files');
    expect(r[3].textContent).toContain('Slack · Zhuge');
  });

  it('escapes every host string', () => {
    const el = mount({
      running: true,
      placeholder: XSS,
      items: [item(XSS, { text: XSS, author: XSS, reason: XSS, files: [XSS] })],
    });
    const html = el.shadowRoot?.innerHTML ?? '';
    expect(el.shadowRoot?.querySelector('img')).toBeNull();
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(field(el).placeholder).toBe(XSS);
    el.setItemState(XSS, 'queued', XSS);
    el.renderNow();
    expect(el.shadowRoot?.querySelector('img')).toBeNull();
    expect(rows(el)[0].querySelector('.as-msg')?.textContent).toBe(XSS);
    act(el, 0, 'edit')?.click();
    const box = q<HTMLTextAreaElement>(el, '.as-edit') as HTMLTextAreaElement;
    expect(box.value).toBe(XSS);
    expect(el.shadowRoot?.querySelector('img')).toBeNull();
  });

  it('read-only (canAct: false): the list shows, no buttons, the field is off', () => {
    const el = mount({ running: true, canAct: false, items: two() });
    expect(rows(el)).toHaveLength(2);
    expect(qa(el, '.as-item [data-act]')).toHaveLength(0);
    expect(field(el).disabled).toBe(true);
    expect(field(el).placeholder).toBe('Read-only — not your session');
    expect(q(el, '.as-hint')?.hidden).toBe(true);
    expect(field(el).hasAttribute('aria-describedby')).toBe(false);
  });

  it('disabled: the session ended', () => {
    const el = mount({ running: false, disabled: true, items: two(), placeholder: 'custom' });
    expect(field(el).disabled).toBe(true);
    expect(field(el).placeholder).toBe('This session has ended');
    expect(qa(el, '.as-item [data-act]')).toHaveLength(0);
  });

  it('lang="ko" uses the dashboard / Slack wording', () => {
    const el = mount({ running: true, items: [item('a'), item('b', { state: 'steered' })] }, { lang: 'ko' });
    expect(q(el, '.as-label-text')?.textContent).toBe('다음 단계에 전달 대기');
    expect(field(el).placeholder).toBe('작업 중인 에이전트에 지시…');
    expect(act(el, 0, 'promote')?.textContent).toBe('지금 보내기');
    expect(rows(el)[1].textContent).toContain('전달됨 · 모델이 다음 툴 호출에서 읽음');
    set(el, { canAct: false });
    expect(field(el).placeholder).toBe('읽기 전용 — 내 세션이 아닙니다');
    expect(steeringStrings('ko').ended).toBe('이 세션은 종료되었습니다');
  });

  it('a host update never re-creates the field (IME composition and caret survive)', () => {
    const el = mount({ running: true, items: two() });
    const f = field(el);
    type(el, '안녕');
    f.focus();
    set(el, { items: [...two(), item('c')] });
    set(el, { running: false });
    expect(field(el)).toBe(f);
    expect(f.value).toBe('안녕');
    expect(el.shadowRoot?.activeElement).toBe(f);
  });

  it('an unchanged note keeps its node; a changed one is replaced', () => {
    const list = two();
    const el = mount({ running: true, items: list });
    const [a, b] = rows(el);
    set(el, { items: [list[0], item('b', { text: 'changed' })] });
    expect(rows(el)[0]).toBe(a);
    expect(rows(el)[1]).not.toBe(b);
    expect(rows(el)[1].textContent).toContain('changed');
  });
});

describe('<ui-agent-steering> composer', () => {
  it('Enter queues while running: ui-submit, the field clears, the note shows until the list has it', () => {
    const el = mount({ running: true, items: two() });
    const got = events<{ text: string; mode: string; ref: string }>(el, 'ui-submit');
    type(el, '  Use Postgres 16  ');
    const e = key(field(el), 'Enter');
    expect(e.defaultPrevented).toBe(true);
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ text: 'Use Postgres 16', mode: 'queue' });
    expect(got[0].ref).toMatch(/^as-/);
    expect(field(el).value).toBe('');
    el.renderNow();
    expect(rows(el)).toHaveLength(3);
    expect(rows(el)[2].textContent).toContain('Queuing…');
    expect(q(el, '.sr-only[role="status"]')?.textContent).toBe('Queued for the next step: Use Postgres 16');
    set(el, { items: [...two(), item('n', { text: 'Use Postgres 16' })] });
    expect(rows(el)).toHaveLength(3);
    expect(rows(el)[2].dataset.row).toBe('h:n');
  });

  it('⌘/Ctrl+Enter steers while running; idle it just sends and shows no row', () => {
    const el = mount({ running: true, items: [] });
    const got = events<{ mode: string }>(el, 'ui-submit');
    type(el, 'now');
    key(field(el), 'Enter', { metaKey: true });
    expect(got[0].mode).toBe('steer');
    el.renderNow();
    expect(rows(el)[0].textContent).toContain('Sending…');
    set(el, { running: false });
    expect(rows(el)).toHaveLength(0);
    type(el, 'idle');
    key(field(el), 'Enter', { ctrlKey: true });
    expect(got[1].mode).toBe('queue');
    el.renderNow();
    expect(rows(el)).toHaveLength(0);
  });

  it('Shift+Enter, IME composition and keyCode 229 never send', () => {
    const el = mount({ running: true });
    const got = events(el, 'ui-submit');
    type(el, '한글');
    expect(key(field(el), 'Enter', { shiftKey: true }).defaultPrevented).toBe(false);
    key(field(el), 'Enter', { isComposing: true });
    key(field(el), 'Enter', { keyCode: 229 });
    expect(got).toHaveLength(0);
    expect(field(el).value).toBe('한글');
  });

  it('the send button follows the text; empty never sends unless the host holds files', () => {
    const el = mount({ running: false });
    const got = events<{ text: string }>(el, 'ui-submit');
    const send = q<HTMLButtonElement>(el, '.as-send') as HTMLButtonElement;
    key(field(el), 'Enter');
    expect(got).toHaveLength(0);
    type(el, 'hi');
    expect(send.disabled).toBe(false);
    send.click();
    expect(got[0].text).toBe('hi');
    set(el, { attachments: 2 });
    expect(send.disabled).toBe(false);
    send.click();
    expect(got[1].text).toBe('');
  });

  it('a cancelled ui-submit keeps the text', () => {
    const el = mount({ running: true });
    events(el, 'ui-submit', true);
    type(el, 'keep me');
    key(field(el), 'Enter');
    el.renderNow();
    expect(field(el).value).toBe('keep me');
    expect(rows(el)).toHaveLength(0);
  });

  it('Esc clears a typed note (and stops there); on an empty field it reaches the page', () => {
    const el = mount({ running: true });
    const outside: string[] = [];
    document.body.addEventListener('keydown', (e) => outside.push(e.key));
    type(el, 'oops');
    key(field(el), 'Escape');
    expect(field(el).value).toBe('');
    expect(outside).toEqual([]);
    key(field(el), 'Escape');
    expect(outside).toEqual(['Escape']);
  });

  it('a failed send (setItemState on its ref) offers Retry and Cancel; idle failures too', () => {
    const el = mount({ running: true });
    const subs = events<{ text: string; mode: string; ref: string }>(el, 'ui-submit');
    const cancels = events<{ id: string }>(el, 'ui-cancel');
    type(el, 'first');
    key(field(el), 'Enter', { metaKey: true });
    el.setItemState(subs[0].ref, 'failed', 'HTTP 502');
    el.renderNow();
    expect(rows(el)[0].textContent).toContain('HTTP 502');
    act(el, 0, 'retry')?.click();
    expect(subs[1]).toEqual({ text: 'first', mode: 'steer', ref: subs[0].ref });
    expect(rows(el)[0].textContent).toContain('Sending…');
    el.setItemState(subs[0].ref, 'failed', 'again');
    el.renderNow();
    act(el, 0, 'cancel')?.click();
    expect(cancels).toEqual([{ id: subs[0].ref }]);
    expect(rows(el)).toHaveLength(0);

    set(el, { running: false });
    type(el, 'idle one');
    key(field(el), 'Enter');
    el.renderNow();
    expect(rows(el)).toHaveLength(0);
    el.setItemState(subs[2].ref, 'failed', 'offline');
    el.renderNow();
    expect(rows(el)[0].textContent).toContain('offline');
    act(el, 0, 'retry')?.click();
    expect(subs[3]).toMatchObject({ text: 'idle one', mode: 'queue' });
    expect(rows(el)).toHaveLength(0);
  });

  it('the turn ending drops notes still in flight', () => {
    const el = mount({ running: true });
    type(el, 'x');
    key(field(el), 'Enter');
    el.renderNow();
    expect(rows(el)).toHaveLength(1);
    set(el, { running: false });
    expect(rows(el)).toHaveLength(0);
  });

  it('value prefills the field (also before it is built); focus() lands on it', () => {
    const el = document.createElement('ui-agent-steering');
    el.value = 'resend this';
    document.body.append(el);
    el.data = { running: false };
    el.renderNow();
    expect(field(el).value).toBe('resend this');
    expect(el.value).toBe('resend this');
    el.focus();
    expect(el.shadowRoot?.activeElement).toBe(field(el));
    el.value = '';
    expect(q<HTMLButtonElement>(el, '.as-send')?.disabled).toBe(true);
  });

  it('a [data-act] outside the element is not an action', () => {
    const wrap = document.createElement('div');
    wrap.setAttribute('data-act', 'send');
    document.body.append(wrap);
    const el = document.createElement('ui-agent-steering');
    const tool = document.createElement('button');
    tool.slot = 'tools';
    el.append(tool);
    wrap.append(el);
    el.data = { running: true };
    el.renderNow();
    const got = events(el, 'ui-submit');
    type(el, 'hello');
    tool.click();
    expect(got).toHaveLength(0);
  });
});

describe('<ui-agent-steering> note actions', () => {
  it('Send now: ui-promote {id}, Sending… until the list changes; refused → rolled back with why', () => {
    const el = mount({ running: true, items: two() });
    const got = events<{ id: string }>(el, 'ui-promote');
    act(el, 0, 'promote')?.click();
    expect(got).toEqual([{ id: 'a' }]);
    expect(rows(el)[0].textContent).toContain('Sending…');
    expect(act(el, 0, 'promote')).toBeNull();
    el.setItemState('a', 'queued', 'Another message is being sent');
    el.renderNow();
    expect(rows(el)[0].querySelector('.as-msg')?.textContent).toBe('Another message is being sent');
    expect(act(el, 0, 'promote')).toBeTruthy();
    act(el, 0, 'promote')?.click();
    set(el, { items: [item('a', { state: 'steered' }), item('b')] });
    expect(rows(el)[0].textContent).toContain('Delivered');
    expect(q(el, '.sr-only[role="status"]')?.textContent).toBe('Delivered: note a');
  });

  it('a cancelled ui-promote changes nothing', () => {
    const el = mount({ running: true, items: two() });
    events(el, 'ui-promote', true);
    act(el, 0, 'promote')?.click();
    expect(rows(el)[0].textContent).not.toContain('Sending…');
  });

  it('setItemState with the list’s own state and no message clears the overlay', () => {
    const el = mount({ running: true, items: two() });
    act(el, 0, 'promote')?.click();
    el.setItemState('a', 'queued');
    el.renderNow();
    expect(act(el, 0, 'promote')).toBeTruthy();
    expect(rows(el)[0].querySelector('.as-msg')).toBeNull();
    el.setItemState('nope', 'failed');
    el.setItemState('a', 'bogus' as never);
  });

  it('Edit inline: Enter saves (ui-edit), Saving… with the new text until the list has it', () => {
    const el = mount({ running: true, items: two() });
    el.openQueue();
    const got = events<{ id: string; text: string }>(el, 'ui-edit');
    act(el, 1, 'edit')?.click();
    const box = q<HTMLTextAreaElement>(el, '.as-edit') as HTMLTextAreaElement;
    expect(box.value).toBe('note b');
    expect(el.shadowRoot?.activeElement).toBe(box);
    box.value = 'note b, but better';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    key(box, 'Enter', { isComposing: true });
    expect(got).toHaveLength(0);
    key(box, 'Enter');
    expect(got).toEqual([{ id: 'b', text: 'note b, but better' }]);
    expect(q(el, '.as-edit')).toBeNull();
    expect(rows(el)[1].textContent).toContain('note b, but better');
    expect(rows(el)[1].textContent).toContain('Saving…');
    expect(act(el, 1, 'edit')?.getAttribute('aria-disabled')).toBe('true');
    expect(el.shadowRoot?.activeElement).toBe(act(el, 1, 'edit'));
    set(el, { items: [two()[0], item('b', { text: 'note b, but better', reason: 'edited' })] });
    expect(rows(el)[1].textContent).toContain('edited');
    expect(rows(el)[1].textContent).not.toContain('Saving…');
  });

  it('Edit: Esc keeps the original, an empty or unchanged text sends nothing, a refusal keeps the box', () => {
    const el = mount({ running: true, items: two() });
    el.openQueue();
    const got = events(el, 'ui-edit');
    act(el, 0, 'edit')?.click();
    const outside: string[] = [];
    document.body.addEventListener('keydown', (e) => outside.push(e.key));
    key(q(el, '.as-edit') as HTMLElement, 'Escape');
    expect(q(el, '.as-edit')).toBeNull();
    expect(outside).toEqual([]);
    // The edit box's own Esc: the queue it sits in stays open.
    expect(el.queueOpen).toBe(true);
    expect(el.shadowRoot?.activeElement).toBe(act(el, 0, 'edit'));
    act(el, 0, 'edit')?.click();
    const box = q<HTMLTextAreaElement>(el, '.as-edit') as HTMLTextAreaElement;
    box.value = '   ';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    expect(q(el, '[data-act="save"]')?.getAttribute('aria-disabled')).toBe('true');
    key(box, 'Enter');
    expect(q(el, '.as-edit')).toBeTruthy();
    box.value = 'note a';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    q(el, '[data-act="save"]')?.click();
    expect(q(el, '.as-edit')).toBeNull();
    expect(got).toHaveLength(0);
    el.addEventListener('ui-edit', (e) => e.preventDefault());
    act(el, 0, 'edit')?.click();
    const again = q<HTMLTextAreaElement>(el, '.as-edit') as HTMLTextAreaElement;
    again.value = 'different';
    again.dispatchEvent(new Event('input', { bubbles: true }));
    key(again, 'Enter');
    expect(got).toHaveLength(1);
    expect(q(el, '.as-edit')).toBeTruthy();
  });

  it('the edit box survives host updates and closes when its note is handed over', () => {
    const el = mount({ running: true, items: two() });
    act(el, 0, 'edit')?.click();
    const box = q<HTMLTextAreaElement>(el, '.as-edit') as HTMLTextAreaElement;
    box.value = 'draft in progress';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    set(el, { items: [...two(), item('c')] });
    expect(q(el, '.as-edit')).toBe(box);
    expect(box.value).toBe('draft in progress');
    set(el, { items: [item('a', { state: 'steered' }), item('b')] });
    expect(q(el, '.as-edit')).toBeNull();
  });

  it('canEdit: false hides Edit', () => {
    const el = mount({ running: true, items: [item('a', { canEdit: false })] });
    expect(act(el, 0, 'edit')).toBeNull();
    expect(act(el, 0, 'cancel')).toBeTruthy();
  });

  it('Cancel: ui-cancel {id}, the note leaves, focus goes to the next note, then the one before, then the field', () => {
    const el = mount({ running: true, items: [item('a'), item('b'), item('c')] });
    el.openQueue();
    const got = events<{ id: string }>(el, 'ui-cancel');
    const b = act(el, 1, 'cancel') as HTMLElement;
    b.focus();
    b.click();
    expect(got).toEqual([{ id: 'b' }]);
    expect(rows(el).map((r) => r.dataset.row)).toEqual(['h:a', 'h:c']);
    expect(el.shadowRoot?.activeElement).toBe(act(el, 1, 'promote'));
    (act(el, 1, 'cancel') as HTMLElement).click();
    expect(el.shadowRoot?.activeElement).toBe(act(el, 0, 'promote'));
    (act(el, 0, 'cancel') as HTMLElement).click();
    expect(rows(el)).toHaveLength(0);
    // The last note gone: the queue closes, the button goes, focus is on the field.
    expect(el.queueOpen).toBe(false);
    expect(q(el, '.as-dock')?.hasAttribute('data-shown')).toBe(false);
    expect(el.shadowRoot?.activeElement).toBe(field(el));
    expect(q(el, '.sr-only[role="status"]')?.textContent).toBe('Cancelled: note a');
  });

  it('a refused cancel keeps the note; a host rollback brings it back', () => {
    const el = mount({ running: true, items: two() });
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener('ui-cancel', stop);
    act(el, 0, 'cancel')?.click();
    expect(rows(el)).toHaveLength(2);
    el.removeEventListener('ui-cancel', stop);
    act(el, 0, 'cancel')?.click();
    expect(rows(el)).toHaveLength(1);
    el.setItemState('a', 'queued', 'Already sent');
    el.renderNow();
    expect(rows(el)).toHaveLength(2);
    expect(rows(el)[0].textContent).toContain('Already sent');
  });

  it('focus on a note’s button survives a host update', () => {
    const el = mount({ running: true, items: two() });
    el.openQueue();
    (act(el, 1, 'promote') as HTMLElement).focus();
    set(el, { items: [item('z'), ...two()] });
    expect(el.shadowRoot?.activeElement).toBe(act(el, 2, 'promote'));
  });
});

describe('<ui-agent-steering> with a slotted <ui-composer> (D2 G5-1)', () => {
  /** A steering element hosting a composer: the composer is the field. */
  function hosted(data: AgentSteeringData = {}, attrs: Record<string, string> = {}) {
    const el = document.createElement('ui-agent-steering');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    const c = document.createElement('ui-composer') as UiComposer;
    c.slot = 'composer';
    c.data = { maxFiles: 4 };
    el.append(c);
    document.body.append(el);
    el.data = data;
    el.renderNow();
    c.renderNow();
    return { el, c };
  }
  const cField = (c: UiComposer) => c.shadowRoot!.querySelector<HTMLTextAreaElement>('.cp-field')!;
  const cType = (c: UiComposer, text: string) => {
    const f = cField(c);
    f.value = text;
    f.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  };

  it('the composer is the field: the built-in one, attachments and tools step aside; the hint row stays', () => {
    const { el, c } = hosted({ running: true }, { lang: 'ko' });
    expect(q(el, '.as')!.hasAttribute('data-composer')).toBe(true);
    expect(c.data).toMatchObject({
      maxFiles: 4,
      placeholder: steeringStrings('ko').placeholderRunning,
      label: steeringStrings('ko').fieldRunning,
      disabled: false,
      hint: false,
    });
    expect(q(el, '.as-hint')!.hidden).toBe(false);
    expect(q(el, '.as-hint')!.textContent).toContain(steeringStrings('ko').hintSteer);
    // Without it, the built-in field again.
    c.remove();
    el.renderNow();
    expect(q(el, '.as')!.hasAttribute('data-composer')).toBe(false);
  });

  it('Enter queues, ⌘/Ctrl+Enter steers while running: one ui-submit from the steering, with the files', () => {
    const { el, c } = hosted({ running: true });
    const sent: SteeringSubmitDetail[] = [];
    let raw = 0;
    el.addEventListener('ui-submit', (e) => {
      if (e.target === c) raw++;
      else sent.push((e as CustomEvent<SteeringSubmitDetail>).detail);
    });
    const page: Event[] = [];
    document.addEventListener('ui-submit', (e) => page.push(e));
    const pdf = new File([new Uint8Array(20)], 'brief.pdf', { type: 'application/pdf' });
    c.addFiles([pdf]);
    cType(c, 'check the logs');
    key(cField(c), 'Enter');
    cType(c, 'stop and use staging');
    key(cField(c), 'Enter', { ctrlKey: true });
    expect(raw).toBe(0);
    expect(page.every((e) => e.target === el)).toBe(true);
    expect(sent.map((d) => [d.text, d.mode, d.files?.map((f) => f.name)])).toEqual([
      ['check the logs', 'queue', ['brief.pdf']],
      ['stop and use staging', 'steer', []],
    ]);
    expect(sent[0].ref).toMatch(/^as-/);
    // Sent: the composer cleared itself; both notes show while the agent runs, the first with its file.
    expect(c.value).toBe('');
    expect(c.files).toEqual([]);
    el.renderNow();
    expect(rows(el)).toHaveLength(2);
    expect(rows(el)[0].querySelector('.as-files')?.textContent).toBe(steeringStrings('en').files(1));
  });

  it('a ⌘/Ctrl+Enter that did not send is not remembered for the send button', () => {
    const { el, c } = hosted({ running: true });
    const sent = events<SteeringSubmitDetail>(el, 'ui-submit');
    key(cField(c), 'Enter', { metaKey: true }); // empty: nothing sends
    cType(c, 'later');
    c.shadowRoot!.querySelector<HTMLButtonElement>('.cp-send')!.click();
    expect(sent.map((d) => d.mode)).toEqual(['queue']);
  });

  it('the host cancels: the composer keeps its text and files; no row', () => {
    const { el, c } = hosted({ running: true });
    events(el, 'ui-submit', true);
    c.addFiles([new File([new Uint8Array(5)], 'a.txt', { type: 'text/plain' })]);
    cType(c, 'keep me');
    key(cField(c), 'Enter');
    expect(c.value).toBe('keep me');
    expect(c.files).toHaveLength(1);
    el.renderNow();
    expect(rows(el)).toHaveLength(0);
  });

  it('read-only or ended: the composer is off with the steering’s words; value and focus go to it', () => {
    const { el, c } = hosted({ canAct: false });
    expect(c.data).toMatchObject({ disabled: true, placeholder: steeringStrings('en').readOnly });
    set(el, { canAct: true, disabled: true });
    expect(c.data).toMatchObject({ disabled: true, placeholder: steeringStrings('en').ended });
    set(el, { disabled: false });
    expect(c.data).toMatchObject({ disabled: false, placeholder: steeringStrings('en').placeholderIdle });
    el.value = 'resend this';
    expect(c.value).toBe('resend this');
    expect(el.value).toBe('resend this');
    el.focus();
    expect(document.activeElement).toBe(c);
    expect(c.shadowRoot!.activeElement).toBe(cField(c));
  });

  it('idle: a send is not drawn (it becomes the turn), and a reported failure offers Retry', () => {
    const { el, c } = hosted({});
    const sent = events<SteeringSubmitDetail>(el, 'ui-submit');
    cType(c, 'hello');
    key(cField(c), 'Enter');
    el.renderNow();
    expect(rows(el)).toHaveLength(0);
    el.setItemState(sent[0].ref, 'failed', 'offline');
    el.renderNow();
    expect(rows(el)).toHaveLength(1);
    expect(act(el, 0, 'retry')).not.toBeNull();
  });
});

describe('<ui-agent-steering> timers', () => {
  it('ages tick in place and every timer stops on disconnect', () => {
    vi.useFakeTimers();
    const t0 = Date.now();
    const el = mount({ running: true, items: [item('a', { at: t0 - 30_000 }), item('b')] });
    const age = rows(el)[0].querySelector('.as-age') as HTMLElement;
    expect(age.textContent).toBe('just now');
    vi.advanceTimersByTime(31_000);
    expect(rows(el)[0].querySelector('.as-age')).toBe(age);
    expect(age.textContent).toBe('1m ago');
    act(el, 1, 'cancel')?.click();
    expect(vi.getTimerCount()).toBeGreaterThanOrEqual(2);
    el.remove();
    expect(vi.getTimerCount()).toBe(0);
    expect(el.shadowRoot?.querySelectorAll('.as-item[data-leaving]').length).toBe(0);
  });

  it('a leaving note is removed after its animation and holds no focusable keys', () => {
    vi.useFakeTimers();
    const el = mount({ running: true, items: two() });
    set(el, { items: [two()[0]] });
    const gone = qa(el, '.as-item[data-leaving]');
    expect(gone).toHaveLength(1);
    expect(gone[0].hasAttribute('inert')).toBe(true);
    expect(gone[0].querySelector('[data-key]')).toBeNull();
    vi.advanceTimersByTime(400);
    expect(qa(el, '.as-item')).toHaveLength(1);
  });

  it('no timer runs without ages to tick', () => {
    vi.useFakeTimers();
    const el = mount({ running: true, items: [item('a')] });
    expect(vi.getTimerCount()).toBe(0);
    el.remove();
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    spy = soundSpy();
  });
  afterEach(() => spy.restore());
  const click = (b: Element | null | undefined) =>
    b?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail: 1 }));

  it('sending a note taps — Enter, ⌘/Ctrl+Enter or the send button; a prevented ui-submit is silent', async () => {
    const el = mount({ running: true, items: two() });
    type(el, 'Use Postgres 16');
    key(field(el), 'Enter');
    await spy.settle();
    type(el, 'now');
    key(field(el), 'Enter', { metaKey: true });
    await spy.settle();
    type(el, 'later');
    click(q(el, '.as-send'));
    await spy.settle();
    expect(spy.calls).toEqual([
      ['tap', { input: 'keyboard' }],
      ['tap', { input: 'keyboard' }],
      ['tap', { input: 'mouse' }],
    ]);
    el.addEventListener('ui-submit', (e) => e.preventDefault());
    type(el, 'kept');
    key(field(el), 'Enter');
    await spy.settle();
    expect(spy.calls).toHaveLength(3);
  });

  it('Send now taps, Cancel closes subtly, a saved edit taps subtly; Edit itself is silent', async () => {
    const el = mount({ running: true, items: [item('a'), item('b'), item('c')] });
    click(act(el, 0, 'promote'));
    await spy.settle();
    click(act(el, 2, 'cancel'));
    await spy.settle();
    click(act(el, 1, 'edit'));
    await spy.settle();
    const box = q<HTMLTextAreaElement>(el, '.as-edit') as HTMLTextAreaElement;
    box.value = 'note b, but better';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    key(box, 'Enter');
    await spy.settle();
    expect(spy.calls).toEqual([
      ['tap', { input: 'mouse' }],
      ['close', { emphasis: 'subtle', input: 'mouse' }],
      ['tap', { emphasis: 'subtle', input: 'keyboard' }],
    ]);
  });

  it('prevented note actions are silent; a failed send’s Retry taps', async () => {
    const el = mount({ running: true, items: two() });
    for (const name of ['ui-promote', 'ui-cancel']) el.addEventListener(name, (e) => e.preventDefault());
    click(act(el, 0, 'promote'));
    click(act(el, 1, 'cancel'));
    await spy.settle();
    expect(spy.calls).toEqual([]);
    const refs = events<{ ref: string }>(el, 'ui-submit');
    type(el, 'flaky');
    key(field(el), 'Enter');
    await spy.settle();
    el.setItemState(refs[0].ref, 'failed', 'HTTP 502');
    el.renderNow();
    click(act(el, 2, 'retry'));
    await spy.settle();
    expect(spy.calls).toEqual([
      ['tap', { input: 'keyboard' }],
      ['tap', { input: 'mouse' }],
    ]);
  });

  it('keystrokes in the field and the edit box play type only while typing sounds are on', async () => {
    const el = mount({ running: true, items: two() });
    key(field(el), 'a');
    await spy.settle();
    expect(spy.calls).toEqual([]);
    spy.restore();
    spy = soundSpy({ typing: true });
    key(field(el), 'a');
    await spy.settle();
    key(field(el), 'Enter', { shiftKey: true });
    await spy.settle();
    key(field(el), 'ArrowUp');
    click(act(el, 0, 'edit'));
    await spy.settle();
    key(q<HTMLTextAreaElement>(el, '.as-edit') as HTMLTextAreaElement, ' ');
    await spy.settle();
    expect(spy.calls).toEqual([
      ['type', { key: 'printable', input: 'keyboard' }],
      ['type', { key: 'enter', input: 'keyboard' }],
      ['type', { key: 'space', input: 'keyboard' }],
    ]);
  });

  it('el.data and setItemState from code are silent, and so is an element inside data-ui-sound="off"', async () => {
    const el = mount({ running: true, items: two() });
    set(el, { items: [item('a', { state: 'steered' }), item('b', { state: 'failed', reason: 'x' })] });
    el.setItemState('b', 'queued', 'rolled back');
    el.value = 'prefilled';
    await spy.settle();
    expect(spy.calls).toEqual([]);
    const quiet = document.createElement('div');
    quiet.setAttribute('data-ui-sound', 'off');
    document.body.append(quiet);
    const muted = document.createElement('ui-agent-steering');
    quiet.append(muted);
    muted.data = { running: true, items: two() };
    muted.renderNow();
    click(act(muted, 0, 'promote'));
    muted.value = 'x';
    key(muted.shadowRoot!.querySelector<HTMLTextAreaElement>('.as-input')!, 'Enter');
    await spy.settle();
    expect(spy.calls).toEqual([]);
  });
});

describe('logic — the dock', () => {
  const row = (key: string, over: Partial<SteeringRow> = {}): SteeringRow => ({
    key,
    id: key.slice(2),
    local: key.startsWith('l:'),
    text: key,
    state: 'queued',
    files: [],
    fileCount: 0,
    canEdit: true,
    saving: false,
    ...over,
  });

  it('steeringQueueLayout: inline only when asked', () => {
    expect(steeringQueueLayout('inline')).toBe('inline');
    expect(steeringQueueLayout(undefined)).toBe('dock');
    expect(steeringQueueLayout('nonsense')).toBe('dock');
  });

  it('splitSteeringRows: the list’s notes dock, a note on its way in stays inline; inline docks none', () => {
    const all = [
      row('h:a'),
      row('l:r1', { state: 'sending' }),
      row('h:b', { state: 'steered' }),
      row('l:r2', { state: 'failed' }),
    ];
    const dock = splitSteeringRows(all, 'dock');
    expect(dock.docked.map((r) => r.key)).toEqual(['h:a', 'h:b']);
    expect(dock.inline.map((r) => r.key)).toEqual(['l:r1', 'l:r2']);
    const inline = splitSteeringRows(all, 'inline');
    expect(inline.docked).toEqual([]);
    expect(inline.inline).toHaveLength(4);
  });

  it('steeringDockTone: fail beats run beats idle', () => {
    expect(steeringDockTone([row('h:a')])).toBe('idle');
    expect(steeringDockTone([row('h:a'), row('h:b', { state: 'sending' })])).toBe('run');
    expect(steeringDockTone([row('h:a', { saving: true })])).toBe('run');
    expect(steeringDockTone([row('h:a', { state: 'sending' }), row('h:b', { state: 'failed' })])).toBe('fail');
    expect(steeringDockTone([])).toBe('idle');
  });

  it('steeringDockBadge: the count, 99+ past 99, never negative', () => {
    expect(steeringDockBadge(3)).toBe('3');
    expect(steeringDockBadge(99)).toBe('99');
    expect(steeringDockBadge(100)).toBe('99+');
    expect(steeringDockBadge(-2)).toBe('0');
    expect(steeringDockBadge(Number.NaN)).toBe('0');
  });

  it('sheetDismisses: past a quarter (48–120px) or a flick past 16px', () => {
    expect(sheetDismisses(0, 2, 400)).toBe(false);
    expect(sheetDismisses(-30, 2, 400)).toBe(false);
    expect(sheetDismisses(99, 0, 400)).toBe(false);
    expect(sheetDismisses(100, 0, 400)).toBe(true);
    expect(sheetDismisses(120, 0, 1000)).toBe(true);
    expect(sheetDismisses(48, 0, 100)).toBe(true);
    expect(sheetDismisses(20, 0.6, 400)).toBe(true);
    expect(sheetDismisses(12, 0.9, 400)).toBe(false);
  });
});

describe('<ui-agent-steering> docked queue', () => {
  const pop = (el: UiAgentSteering) => q(el, '.as-pop') as HTMLElement;
  const dock = (el: UiAgentSteering) => q<HTMLButtonElement>(el, '.as-dock') as HTMLButtonElement;
  const inline = (el: UiAgentSteering) => qa(el, '.as-queue .as-item:not([data-leaving])');
  const docked = (el: UiAgentSteering) => qa(el, '.as-list.is-docked .as-item:not([data-leaving])');
  const press = (target: HTMLElement, detail = 1) =>
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail }));
  const pointer = (target: EventTarget, type: string, init: PointerEventInit = {}) =>
    target.dispatchEvent(
      new PointerEvent(type, { bubbles: true, composed: true, cancelable: true, pointerType: 'mouse', ...init }),
    );
  let spy: SoundSpy | null = null;
  afterEach(() => {
    spy?.restore();
    spy = null;
    vi.unstubAllGlobals();
  });

  it('a note on its way in shows above the field; once the list has it, it docks and the count grows', () => {
    const el = mount({ running: true, items: two() });
    expect(dock(el).hasAttribute('data-shown')).toBe(true);
    expect(dock(el).hasAttribute('inert')).toBe(false);
    expect(dock(el).getAttribute('aria-label')).toBe('2 queued notes');
    expect(dock(el).getAttribute('aria-expanded')).toBe('false');
    expect(docked(el)).toHaveLength(2);
    expect(inline(el)).toHaveLength(0);
    type(el, 'Use Postgres 16');
    key(field(el), 'Enter');
    el.renderNow();
    expect(inline(el)).toHaveLength(1);
    expect(inline(el)[0].textContent).toContain('Queuing…');
    expect(q(el, '.as-queue')?.hasAttribute('data-open')).toBe(true);
    expect(q(el, '.as-queue .as-count')?.textContent).toBe('1');
    expect(q(el, '.as-dock-n')?.textContent).toBe('2');
    set(el, { items: [...two(), item('n', { text: 'Use Postgres 16' })] });
    expect(inline(el)).toHaveLength(0);
    expect(q(el, '.as-queue')?.hasAttribute('data-open')).toBe(false);
    expect(docked(el).map((r) => r.dataset.row)).toEqual(['h:a', 'h:b', 'h:n']);
    expect(q(el, '.as-dock-n')?.textContent).toBe('3');
    expect(dock(el).classList.contains('is-bump')).toBe(true);
  });

  it('a note refused before the list had it stays above the field with Retry; the dock does not count it', () => {
    const el = mount({ running: true, items: [] });
    const got = events<SteeringSubmitDetail>(el, 'ui-submit');
    type(el, 'x');
    key(field(el), 'Enter');
    el.setItemState(got[0].ref, 'failed', 'HTTP 502');
    el.renderNow();
    expect(inline(el)).toHaveLength(1);
    expect(inline(el)[0].querySelector('[data-act="retry"]')).toBeTruthy();
    expect(dock(el).hasAttribute('data-shown')).toBe(false);
    expect(dock(el).hasAttribute('inert')).toBe(true);
  });

  it('queue: inline keeps every note above the field and no dock', () => {
    const el = mount({ running: true, items: two(), queue: 'inline' });
    expect(inline(el)).toHaveLength(2);
    expect(docked(el)).toHaveLength(0);
    expect(q(el, '.as-queue')?.hasAttribute('data-open')).toBe(true);
    expect(dock(el).hasAttribute('data-shown')).toBe(false);
    el.openQueue();
    expect(el.queueOpen).toBe(false);
  });

  it('the dock tells a failed note (fail tone, its name) and one on its way (run tone)', () => {
    const el = mount({ running: true, items: [item('a'), item('b', { state: 'failed' })] });
    expect(dock(el).getAttribute('data-tone')).toBe('fail');
    expect(dock(el).getAttribute('aria-label')).toBe('2 queued notes — one couldn’t send');
    set(el, { items: [item('a'), item('b')] });
    expect(dock(el).getAttribute('data-tone')).toBe('idle');
    act(el, 0, 'promote')?.click();
    expect(dock(el).getAttribute('data-tone')).toBe('run');
  });

  it('a press pins the queue open (open cue); a press again closes it (close cue); the count stays on the button', async () => {
    spy = soundSpy();
    const el = mount({ running: true, items: two() });
    press(dock(el));
    expect(el.queueOpen).toBe(true);
    expect(pop(el).hasAttribute('data-open')).toBe(true);
    expect(pop(el).hasAttribute('inert')).toBe(false);
    expect(dock(el).getAttribute('aria-expanded')).toBe('true');
    expect(pop(el).getAttribute('aria-label')).toBe('Queued for the next step · 2 notes');
    // A pointer press does not move focus into the queue.
    expect(pop(el).contains(el.shadowRoot?.activeElement ?? null)).toBe(false);
    await spy.settle();
    press(dock(el));
    expect(el.queueOpen).toBe(false);
    expect(pop(el).hasAttribute('data-open')).toBe(false);
    expect(pop(el).hasAttribute('inert')).toBe(true);
    expect(dock(el).getAttribute('aria-expanded')).toBe('false');
    await spy.settle();
    expect(spy.cues()).toEqual(['open', 'close']);
  });

  it('a keyboard press (Enter/Space) moves focus to the first note’s first button; Esc closes and returns it to the dock', () => {
    const el = mount({ running: true, items: two() });
    const outside: boolean[] = [];
    document.addEventListener('keydown', (e) => outside.push(e.defaultPrevented));
    dock(el).focus();
    press(dock(el), 0);
    expect(el.shadowRoot?.activeElement).toBe(act(el, 0, 'promote'));
    key(act(el, 0, 'promote') as HTMLElement, 'Escape');
    expect(el.queueOpen).toBe(false);
    expect(el.shadowRoot?.activeElement).toBe(dock(el));
    // The page sees the Esc as used, so a drawer under it stays open.
    expect(outside).toEqual([true]);
    key(dock(el), 'Escape');
    expect(outside).toEqual([true, false]);
  });

  it('the ✕ closes; a press outside closes; a press inside does not', () => {
    const el = mount({ running: true, items: two() });
    el.openQueue();
    (q(el, '.as-pop-close') as HTMLElement).click();
    expect(el.queueOpen).toBe(false);
    el.openQueue();
    pointer(act(el, 1, 'edit') as HTMLElement, 'pointerdown');
    expect(el.queueOpen).toBe(true);
    pointer(document.body, 'pointerdown');
    expect(el.queueOpen).toBe(false);
  });

  it('hover peeks after the intent delay, closes after the grace; touch never peeks', () => {
    vi.useFakeTimers();
    const el = mount({ running: true, items: two() });
    pointer(dock(el), 'pointerenter', { bubbles: false });
    expect(el.queueOpen).toBe(false);
    vi.advanceTimersByTime(STEERING_PEEK_MS);
    expect(el.queueOpen).toBe(true);
    pointer(dock(el), 'pointerleave', { bubbles: false });
    vi.advanceTimersByTime(STEERING_GRACE_MS - 10);
    pointer(pop(el), 'pointerenter', { bubbles: false });
    vi.advanceTimersByTime(STEERING_GRACE_MS);
    expect(el.queueOpen).toBe(true);
    pointer(pop(el), 'pointerleave', { bubbles: false });
    vi.advanceTimersByTime(STEERING_GRACE_MS);
    expect(el.queueOpen).toBe(false);
    pointer(dock(el), 'pointerenter', { bubbles: false, pointerType: 'touch' });
    vi.advanceTimersByTime(STEERING_PEEK_MS * 3);
    expect(el.queueOpen).toBe(false);
  });

  it('a peek that is pressed into (or clicked on the dock) stays when the pointer leaves', () => {
    vi.useFakeTimers();
    const el = mount({ running: true, items: two() });
    pointer(dock(el), 'pointerenter', { bubbles: false });
    vi.advanceTimersByTime(STEERING_PEEK_MS);
    press(dock(el));
    expect(el.queueOpen).toBe(true);
    pointer(dock(el), 'pointerleave', { bubbles: false });
    vi.advanceTimersByTime(STEERING_GRACE_MS * 2);
    expect(el.queueOpen).toBe(true);
    el.closeQueue();
    pointer(dock(el), 'pointerenter', { bubbles: false });
    vi.advanceTimersByTime(STEERING_PEEK_MS);
    pointer(act(el, 0, 'edit') as HTMLElement, 'pointerdown');
    pointer(pop(el), 'pointerleave', { bubbles: false });
    vi.advanceTimersByTime(STEERING_GRACE_MS * 2);
    expect(el.queueOpen).toBe(true);
  });

  it('the controls work inside the open queue: Send now, Edit, Cancel', () => {
    const el = mount({ running: true, items: two() });
    const promoted = events<{ id: string }>(el, 'ui-promote');
    const cancelled = events<{ id: string }>(el, 'ui-cancel');
    el.openQueue();
    act(el, 0, 'promote')?.click();
    expect(promoted).toEqual([{ id: 'a' }]);
    expect(rows(el)[0].textContent).toContain('Sending…');
    act(el, 1, 'cancel')?.click();
    expect(cancelled).toEqual([{ id: 'b' }]);
    expect(q(el, '.as-dock-n')?.textContent).toBe('1');
    act(el, 0, 'edit');
    expect(el.queueOpen).toBe(true);
  });

  it('the list emptying closes the queue and hides the dock', () => {
    const el = mount({ running: true, items: two() });
    el.openQueue();
    set(el, { items: [] });
    expect(el.queueOpen).toBe(false);
    expect(dock(el).hasAttribute('data-shown')).toBe(false);
    el.openQueue();
    expect(el.queueOpen).toBe(false);
  });

  it('every note text is escaped in the docked list', () => {
    const el = mount({ running: true, items: [item('x', { text: XSS, author: XSS, reason: XSS })] });
    expect(q(el, '.as-list.is-docked img')).toBeNull();
    expect(docked(el)[0].textContent).toContain(XSS);
  });

  it('Korean: the dock’s name and the queue’s head', () => {
    const el = mount({ running: true, items: [item('a'), item('b', { state: 'failed' })] }, { lang: 'ko' });
    expect(dock(el).getAttribute('aria-label')).toBe('대기 중인 메시지 2개 — 보내지 못한 메시지가 있습니다');
    expect(q(el, '.as-pop-title')?.textContent).toBe('다음 단계에 전달 대기');
    expect(q(el, '.as-pop-close')?.getAttribute('aria-label')).toBe('큐 닫기');
  });

  describe('phone (under 640px): a bottom sheet', () => {
    const phone = (matches: boolean) => {
      const listeners: Array<() => void> = [];
      const mq = {
        matches,
        media: '(max-width: 639px)',
        addEventListener: (_: string, fn: () => void) => listeners.push(fn),
        removeEventListener: () => {},
      };
      vi.stubGlobal('matchMedia', (query: string) =>
        query.includes('max-width') ? mq : { matches: false, media: query },
      );
      return {
        set(v: boolean) {
          mq.matches = v;
          for (const fn of listeners) fn();
        },
      };
    };

    it('a tap opens the sheet over a scrim and takes focus (the keyboard goes down); the scrim closes it', () => {
      phone(true);
      const el = mount({ running: true, items: two() });
      field(el).focus();
      press(dock(el));
      expect(pop(el).hasAttribute('data-sheet')).toBe(true);
      expect(q(el, '.as-scrim')?.hasAttribute('data-open')).toBe(true);
      expect(el.shadowRoot?.activeElement).toBe(pop(el));
      (q(el, '.as-scrim') as HTMLElement).click();
      expect(el.queueOpen).toBe(false);
      expect(q(el, '.as-scrim')?.hasAttribute('data-open')).toBe(false);
      // A press on the scrim is not an outside press: its own click closes, so the tap never lands under it.
      el.openQueue();
      pointer(q(el, '.as-scrim') as HTMLElement, 'pointerdown', { pointerType: 'touch' });
      expect(el.queueOpen).toBe(true);
    });

    it('dragging the head down past the mark closes it; a short drag springs back', () => {
      phone(true);
      const el = mount({ running: true, items: two() });
      el.openQueue();
      const head = q(el, '.as-pop-head') as HTMLElement;
      pointer(head, 'pointerdown', { pointerId: 1, clientY: 300, button: 0, pointerType: 'touch' });
      expect(pop(el).hasAttribute('data-drag')).toBe(true);
      pointer(head, 'pointermove', { pointerId: 1, clientY: 330, pointerType: 'touch' });
      expect(pop(el).style.transform).toBe('translateY(30px)');
      // Held still before the release: no flick.
      pointer(head, 'pointermove', { pointerId: 1, clientY: 330, pointerType: 'touch' });
      pointer(head, 'pointerup', { pointerId: 1, clientY: 330, pointerType: 'touch' });
      expect(el.queueOpen).toBe(true);
      expect(pop(el).style.transform).toBe('');
      expect(pop(el).hasAttribute('data-drag')).toBe(false);
      pointer(head, 'pointerdown', { pointerId: 2, clientY: 300, button: 0, pointerType: 'touch' });
      pointer(head, 'pointermove', { pointerId: 2, clientY: 460, pointerType: 'touch' });
      pointer(head, 'pointerup', { pointerId: 2, clientY: 460, pointerType: 'touch' });
      expect(el.queueOpen).toBe(false);
      // The ✕ is a button, not a handle.
      el.openQueue();
      pointer(q(el, '.as-pop-close') as HTMLElement, 'pointerdown', { pointerId: 3, button: 0, pointerType: 'touch' });
      expect(pop(el).hasAttribute('data-drag')).toBe(false);
    });

    it('a foldable opening while the sheet is up turns it into the popover, in place', () => {
      const mq = phone(true);
      const el = mount({ running: true, items: two() });
      el.openQueue();
      expect(pop(el).hasAttribute('data-sheet')).toBe(true);
      mq.set(false);
      expect(el.queueOpen).toBe(true);
      expect(pop(el).hasAttribute('data-sheet')).toBe(false);
      expect(q(el, '.as-scrim')?.hasAttribute('data-open')).toBe(false);
      mq.set(true);
      expect(pop(el).hasAttribute('data-sheet')).toBe(true);
      expect(q(el, '.as-scrim')?.hasAttribute('data-open')).toBe(true);
    });

    it('the sheet sits on the visual viewport’s bottom — above the soft keyboard — and the scrim covers what shows', () => {
      phone(true);
      const vv = new EventTarget() as EventTarget & { height: number; offsetTop: number; width: number };
      Object.assign(vv, { height: 420, offsetTop: 90, width: 390 });
      vi.stubGlobal('visualViewport', vv);
      const el = mount({ running: true, items: two() });
      el.openQueue();
      expect(pop(el).style.top).toBe('510px');
      expect(pop(el).hasAttribute('data-kb')).toBe(true);
      const scrim = q(el, '.as-scrim') as HTMLElement;
      expect(scrim.style.top).toBe('90px');
      expect(scrim.style.height).toBe('420px');
      // The keyboard goes down: the sheet follows in the same event.
      Object.assign(vv, { height: window.innerHeight, offsetTop: 0 });
      vv.dispatchEvent(new Event('resize'));
      expect(pop(el).style.top).toBe(`${window.innerHeight}px`);
      expect(pop(el).hasAttribute('data-kb')).toBe(false);
    });

    it('a wide screen never gets the sheet or the scrim', () => {
      phone(false);
      const el = mount({ running: true, items: two() });
      el.openQueue();
      expect(pop(el).hasAttribute('data-sheet')).toBe(false);
      expect(q(el, '.as-scrim')?.hasAttribute('data-open')).toBe(false);
    });
  });

  it('removed from the page while open: the document listeners go with it', () => {
    const el = mount({ running: true, items: two() });
    el.openQueue();
    el.remove();
    expect(el.queueOpen).toBe(false);
    const e = key(document.body, 'Escape');
    expect(e.defaultPrevented).toBe(false);
  });
});
