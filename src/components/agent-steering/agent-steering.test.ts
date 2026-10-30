import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import type { UiAgentSteering } from './agent-steering';
import './agent-steering';
import type { AgentSteeringData, SteeringItem, SteeringLocal, SteeringOverlay, SteeringRow } from './logic';
import {
  claimLocals,
  clipNote,
  normSteeringItems,
  noteAge,
  settleOverlays,
  steerEnterAction,
  steeringActions,
  steeringFocusIndex,
  steeringItemKey,
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
    expect(q(el, '.as-queue')?.hasAttribute('data-open')).toBe(true);
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
    const got = events(el, 'ui-edit');
    act(el, 0, 'edit')?.click();
    const outside: string[] = [];
    document.body.addEventListener('keydown', (e) => outside.push(e.key));
    key(q(el, '.as-edit') as HTMLElement, 'Escape');
    expect(q(el, '.as-edit')).toBeNull();
    expect(outside).toEqual([]);
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
    (act(el, 1, 'promote') as HTMLElement).focus();
    set(el, { items: [item('z'), ...two()] });
    expect(el.shadowRoot?.activeElement).toBe(act(el, 2, 'promote'));
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
