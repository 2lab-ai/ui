import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import { resetSoundQueue } from '../../sound/sound';
import {
  type ActionNodeData,
  NODE_ARM_GUARD_MS,
  NODE_ARM_MS,
  NODE_CORNER,
  NODE_LEAVE_MS,
  NODE_SPACING,
  NODE_STAGGER_MS,
  nodeFanPoints,
  nodeInitials,
  nodeStagger,
  type UiActionNode,
} from './action-node';
import { doc } from './docs';
import { styles } from './styles';

const XSS = '<img src=x onerror=alert(1)>';
const NOW = Date.UTC(2026, 10, 5, 9, 0, 0);

const BASE: ActionNodeData = {
  name: 'Daily standup digest',
  description: 'Reads yesterday’s threads and posts a digest to #ops.',
  status: 'active',
  meta: ['Weekdays 09:00 KST', 'Next in 2h 14m', 'sonnet'],
  chips: [{ label: '#ops' }, { label: '#dev-soma' }, { label: '#release' }],
  more: 3,
  actions: [
    { id: 'run', label: 'Run now', icon: 'play' },
    { id: 'pause', label: 'Pause', icon: 'pause' },
    { id: 'edit', label: 'Edit', icon: 'edit' },
    { id: 'delete', label: 'Delete', icon: 'trash', tone: 'danger' },
  ],
};

function mount(data: ActionNodeData | undefined = BASE, attrs: Record<string, string> = {}): UiActionNode {
  const el = document.createElement('ui-action-node');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiActionNode, s: string) => el.shadowRoot!.querySelector<E>(s);
const qa = (el: UiActionNode, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const trigger = (el: UiActionNode) => q<HTMLButtonElement>(el, '.an-trigger')!;
const fan = (el: UiActionNode) => q(el, '.an-fan')!;
const acts = (el: UiActionNode) => qa(el, '.an-act');
const act = (el: UiActionNode, id: string) => acts(el).find((b) => b.dataset.id === id)!;
const focused = (el: UiActionNode) => el.shadowRoot!.activeElement as HTMLElement | null;
const isOpen = (el: UiActionNode) => trigger(el).getAttribute('aria-expanded') === 'true';

/** A mouse click (detail 1) or a keyboard one (detail 0: Enter / Space on a button). */
function click(t: Element, how: 'mouse' | 'keyboard' = 'mouse'): MouseEvent {
  const e = new MouseEvent('click', {
    bubbles: true,
    composed: true,
    cancelable: true,
    detail: how === 'mouse' ? 1 : 0,
  });
  t.dispatchEvent(e);
  return e;
}
function press(el: UiActionNode, t: Element, how: 'mouse' | 'keyboard' = 'mouse'): void {
  click(t, how);
  el.renderNow();
}
function key(t: Element, k: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...init });
  t.dispatchEvent(e);
  return e;
}
const pointer = (t: EventTarget, type: string, pointerType = 'mouse') =>
  t.dispatchEvent(new PointerEvent(type, { pointerType, bubbles: type === 'pointerdown', composed: true }));
function events<T>(el: UiActionNode, name: string): T[] {
  const seen: T[] = [];
  el.addEventListener(name, (e) => seen.push((e as CustomEvent<T>).detail));
  return seen;
}
/** A device that hovers with a fine pointer (a mouse), or one that does not (touch); reduced motion off. */
function media({ fine = true, reduce = false } = {}) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('hover: hover') ? fine : query.includes('reduce') ? reduce : false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ── helpers ────────────────────────────────────────────────────────────────

describe('nodeFanPoints', () => {
  const centre = { x: -NODE_CORNER, y: NODE_CORNER };
  const dist = (p: { x: number; y: number }) => Math.hypot(p.x - centre.x, p.y - centre.y);
  // Default reach 25 → 6 + 25% of 24 = 12px off the corner, plus half a button: the arc's radius is 20 + 30 = 50.
  const R = 50;

  it('one button sits on the corner’s 45° point, R from the corner’s arc centre', () => {
    const [p] = nodeFanPoints(1);
    expect(p.x).toBeCloseTo(-20 + R * Math.SQRT1_2, 1);
    expect(p.y).toBeCloseTo(20 - R * Math.SQRT1_2, 1);
    expect(dist(p)).toBeCloseTo(R, 1);
  });

  it('two buttons ride the arc, 48px apart along it, either side of the 45° point', () => {
    const pts = nodeFanPoints(2);
    expect(pts).toHaveLength(2);
    for (const p of pts) expect(dist(p)).toBeCloseTo(R, 1);
    const angle = (p: { x: number; y: number }) => Math.atan2(centre.y - p.y, p.x - centre.x);
    expect((angle(pts[0]) - angle(pts[1])) * R).toBeCloseTo(NODE_SPACING, 0);
    expect(angle(pts[0]) + angle(pts[1])).toBeCloseTo(Math.PI / 2, 2);
  });

  it('three: the middle one on the 45° point, the outer two just past the quarter circle, on the straight edges', () => {
    const pts = nodeFanPoints(3);
    expect(pts[1]).toEqual(nodeFanPoints(1)[0]);
    // The quarter circle is 50·π/2 ≈ 78.5px long, the fan 96px: 8.7px of it runs on along each edge.
    expect(pts[0].y).toBe(-30);
    expect(pts[0].x).toBeCloseTo(-20 - (NODE_SPACING - (R * Math.PI) / 4), 1);
    expect(pts[2].x).toBe(30);
    expect(pts[2].y).toBeCloseTo(-pts[0].x, 1);
  });

  it('four buttons run past the quarter circle onto the straight edges: along the top, down the right side', () => {
    const pts = nodeFanPoints(4);
    expect(pts).toHaveLength(4);
    expect(pts[0].y).toBe(-30);
    expect(pts[0].x).toBeCloseTo(-52.73, 1);
    expect(pts[3].x).toBe(30);
    expect(pts[3].y).toBeCloseTo(52.73, 1);
    expect(dist(pts[1])).toBeCloseTo(R, 1);
    expect(dist(pts[2])).toBeCloseTo(R, 1);
  });

  it('is symmetric about the corner’s diagonal, and every button stays outside the card', () => {
    for (const n of [1, 2, 3, 4]) {
      const pts = nodeFanPoints(n);
      pts.forEach((p, i) => {
        const m = pts[n - 1 - i];
        expect(p.x).toBeCloseTo(-m.y, 1);
        // Outside the card: above its top edge, right of its right edge, or clear of the rounded corner.
        const clear = p.y + 18 <= 0.01 || p.x - 18 >= -0.01 || dist(p) >= NODE_CORNER + 18;
        expect(clear).toBe(true);
      });
    }
  });

  it('reach pushes the arc out; the corner radius moves its centre; junk counts clamp to 0 … 4', () => {
    // reach 100 → 6 + 24 + 18 = 48 off the corner.
    const [far] = nodeFanPoints(1, 20, 100);
    expect(dist(far)).toBeCloseTo(68, 1);
    const [square] = nodeFanPoints(1, 0, 25);
    expect(Math.hypot(square.x, square.y)).toBeCloseTo(30, 1);
    expect(nodeFanPoints(0)).toEqual([]);
    expect(nodeFanPoints(-2)).toEqual([]);
    expect(nodeFanPoints(Number.NaN)).toEqual([]);
    expect(nodeFanPoints(9)).toHaveLength(4);
    expect(nodeFanPoints(2.7)).toHaveLength(2);
    // Two decimals at most, never -0.
    for (const p of nodeFanPoints(4)) {
      expect(Math.round(p.x * 100) / 100).toBe(p.x);
      expect(Object.is(p.x, -0) || Object.is(p.y, -0)).toBe(false);
    }
  });
});

describe('nodeInitials / nodeStagger', () => {
  it('initials: the first letter of the first two words, upper-cased', () => {
    expect(nodeInitials('#dev-soma')).toBe('DS');
    expect(nodeInitials('#ops')).toBe('O');
    expect(nodeInitials('Mara Quinn')).toBe('MQ');
    expect(nodeInitials('claude sonnet four')).toBe('CS');
    expect(nodeInitials('주간 리포트')).toBe('주리');
    expect(nodeInitials('gpt-5')).toBe('G5');
    expect(nodeInitials('  ')).toBe('');
    expect(nodeInitials(null)).toBe('');
    expect(nodeInitials('🚀')).toBe('🚀');
  });

  it('stagger: opening runs in order, closing in reverse, ms apart', () => {
    expect([0, 1, 2, 3].map((i) => nodeStagger(i, 4, true, 55))).toEqual([0, 55, 110, 165]);
    expect([0, 1, 2, 3].map((i) => nodeStagger(i, 4, false, 55))).toEqual([165, 110, 55, 0]);
    expect(nodeStagger(1, 2, true)).toBe(NODE_STAGGER_MS);
    expect(nodeStagger(2, 4, true, 0)).toBe(0);
    expect(nodeStagger(0, 0, true, 55)).toBe(0);
    expect(nodeStagger(9, 3, true, 10)).toBe(20);
    expect(nodeStagger(-1, 3, false, 10)).toBe(20);
    expect(nodeStagger(1, 3, true, -5)).toBe(0);
  });
});

// ── render ─────────────────────────────────────────────────────────────────

describe('<ui-action-node> render', () => {
  it('draws the mark, the name as a button, the description, the facts, the status and the chain', () => {
    const el = mount();
    expect(q(el, '.an-mark svg')!.getAttribute('data-icon')).toBe('clock');
    const name = q(el, '.an-name')!;
    expect(name.tagName).toBe('BUTTON');
    expect(name.textContent).toBe('Daily standup digest');
    expect(q(el, '.an-card')!.getAttribute('aria-labelledby')).toBe(name.id);
    expect(q(el, '.an-say')!.textContent).toBe(BASE.description);
    expect(qa(el, '.an-m').map((m) => m.textContent)).toEqual(BASE.meta);
    expect(qa(el, '.an-sep')).toHaveLength(2);
    expect(q(el, '.an-st')!.dataset.tone).toBe('done');
    expect(q(el, '.an-st')!.textContent).toBe('Active');
    expect(q(el, '.an-st .an-dot')).not.toBeNull();
    const chips = qa(el, '.an-chip');
    expect(chips.map((c) => c.textContent)).toEqual(['O', 'DS', 'R', '+3']);
    expect(chips.map((c) => c.title)).toEqual(['#ops', '#dev-soma', '#release', '3 more']);
    expect(q(el, '.an-chain')!.getAttribute('aria-hidden')).toBe('true');
    expect(q(el, '.an-chain-sr')!.textContent).toBe('#ops, #dev-soma, #release, 3 more');
    // The card is not one big button: only the name, the trigger and the fan's buttons are.
    expect(qa(el, 'button').map((b) => b.className.split(' ')[0])).toEqual([
      'an-name',
      'an-trigger',
      'an-act',
      'an-act',
      'an-act',
      'an-act',
    ]);
  });

  it('each status: a done dot, a hollow idle dot, the working ring, the fail dot — always with its word', () => {
    const cases: Array<[ActionNodeData['status'], string, string]> = [
      ['active', 'done', 'Active'],
      ['paused', 'idle', 'Paused'],
      ['running', 'run', 'Running'],
      ['failed', 'fail', 'Last run failed'],
    ];
    for (const [status, tone, word] of cases) {
      const el = mount({ ...BASE, status });
      expect(q(el, '.an-st')!.dataset.tone).toBe(tone);
      expect(q(el, '.an-st-t')!.textContent).toBe(word);
      expect(!!q(el, '.an-st .an-spin')).toBe(status === 'running');
      expect(q(el, '.an')!.dataset.status).toBe(status);
    }
    expect(q(mount({ ...BASE, status: 'weird' as never }), '.an-st')).toBeNull();
    expect(q(mount({ ...BASE, status: undefined }), '.an-st')).toBeNull();
  });

  it('a chip shows its own mark (two characters at most); the icon is yours; junk is skipped', () => {
    const el = mount({
      ...BASE,
      icon: 'shield',
      chips: [{ label: 'haiku', mark: 'H' }, { label: 'opus', mark: 'OPUS' }, { label: '' }, null as never],
      more: 0,
      meta: ['', 'Every 6h', 7 as never],
      description: '   ',
    });
    expect(q(el, '.an-mark svg')!.getAttribute('data-icon')).toBe('shield');
    expect(qa(el, '.an-chip').map((c) => c.textContent)).toEqual(['H', 'OP']);
    expect(q(el, '.an-chip.is-more')).toBeNull();
    expect(q(el, '.an-chain-sr')!.textContent).toBe('haiku, opus');
    expect(qa(el, '.an-m').map((m) => m.textContent)).toEqual(['Every 6h']);
    expect(q(el, '.an-say')).toBeNull();
    const bare = mount({ name: 'Bare', icon: 'nope' as never });
    expect(q(bare, '.an-mark svg')!.getAttribute('data-icon')).toBe('clock');
    expect(q(bare, '.an-chain')).toBeNull();
    expect(q(bare, '.an-meta')).toBeNull();
    // No actions: nothing to fold, so no trigger and no fan.
    expect(q(bare, '.an-trigger')).toBeNull();
    expect(q(bare, '.an-fan')).toBeNull();
    const empty = document.createElement('ui-action-node');
    document.body.append(empty);
    empty.renderNow();
    expect(empty.shadowRoot!.querySelector('.ui-root')!.innerHTML).toBe('');
  });

  it('shows four actions at most, a repeated id once; places them along the corner with their stagger', () => {
    media();
    const many = mount({
      ...BASE,
      actions: [
        ...BASE.actions!,
        { id: 'run', label: 'Again', icon: 'play' },
        { id: 'extra', label: 'Extra', icon: 'plus' },
      ],
    });
    expect(acts(many).map((b) => b.dataset.id)).toEqual(['run', 'pause', 'edit', 'delete']);
    const pts = nodeFanPoints(4);
    acts(many).forEach((b, i) => {
      expect(b.style.getPropertyValue('--an-x')).toBe(`${pts[i].x}px`);
      expect(b.style.getPropertyValue('--an-y')).toBe(`${pts[i].y}px`);
    });
    // Closed: the reverse order is the one that just ran (or would run).
    expect(acts(many).map((b) => b.style.getPropertyValue('--an-d'))).toEqual(['165ms', '110ms', '55ms', '0ms']);
    press(many, trigger(many));
    expect(acts(many).map((b) => b.style.getPropertyValue('--an-d'))).toEqual(['0ms', '55ms', '110ms', '165ms']);
    expect(q(many, '.an-reach')!.getAttribute('style')).toContain('clip-path:polygon(');
  });
});

// ── the fan ────────────────────────────────────────────────────────────────

describe('the trigger and the fan', () => {
  it('closed: the trigger says so, the fan is inert and out of the tab order', () => {
    const el = mount();
    const t = trigger(el);
    expect(t.getAttribute('aria-expanded')).toBe('false');
    expect(t.getAttribute('aria-controls')).toBe('an-fan');
    expect(fan(el).id).toBe('an-fan');
    expect(t.getAttribute('aria-label')).toBe('Actions for Daily standup digest');
    expect(fan(el).getAttribute('role')).toBe('toolbar');
    expect(fan(el).getAttribute('aria-label')).toBe('Actions for Daily standup digest');
    expect(fan(el).hasAttribute('inert')).toBe(true);
    expect(acts(el).every((b) => b.getAttribute('tabindex') === '-1')).toBe(true);
    expect(el.hasAttribute('open')).toBe(false);
    expect(el.open).toBe(false);
  });

  it('a click toggles it: aria-expanded, inert, one tab stop, the open attribute — on the same nodes', () => {
    const el = mount();
    const nodes = acts(el);
    press(el, trigger(el));
    expect(isOpen(el)).toBe(true);
    expect(fan(el).hasAttribute('inert')).toBe(false);
    expect(q(el, '.an')!.hasAttribute('data-open')).toBe(true);
    expect(acts(el).map((b) => b.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1']);
    expect(el.hasAttribute('open')).toBe(true);
    expect(el.open).toBe(true);
    // A mouse click leaves focus where it was.
    expect(acts(el)).not.toContain(focused(el));
    // Patched in place: the transitions run on the nodes that were there.
    expect(acts(el)).toEqual(nodes);
    press(el, trigger(el));
    expect(isOpen(el)).toBe(false);
    expect(fan(el).hasAttribute('inert')).toBe(true);
    expect(acts(el).every((b) => b.getAttribute('tabindex') === '-1')).toBe(true);
    expect(el.hasAttribute('open')).toBe(false);
  });

  it('keyboard: Enter on the trigger opens on the first action; the arrows rove (wrapping); Esc closes onto the trigger', () => {
    const el = mount();
    trigger(el).focus();
    press(el, trigger(el), 'keyboard');
    expect(isOpen(el)).toBe(true);
    expect(focused(el)).toBe(act(el, 'run'));
    key(act(el, 'run'), 'ArrowRight');
    expect(focused(el)).toBe(act(el, 'pause'));
    key(act(el, 'pause'), 'ArrowDown');
    expect(focused(el)).toBe(act(el, 'edit'));
    expect(acts(el).map((b) => b.getAttribute('tabindex'))).toEqual(['-1', '-1', '0', '-1']);
    key(act(el, 'edit'), 'ArrowUp');
    expect(focused(el)).toBe(act(el, 'pause'));
    key(act(el, 'pause'), 'ArrowLeft');
    key(act(el, 'run'), 'ArrowLeft');
    expect(focused(el)).toBe(act(el, 'delete'));
    key(act(el, 'delete'), 'ArrowRight');
    expect(focused(el)).toBe(act(el, 'run'));
    key(act(el, 'run'), 'End');
    expect(focused(el)).toBe(act(el, 'delete'));
    key(act(el, 'delete'), 'Home');
    expect(focused(el)).toBe(act(el, 'run'));
    const esc = key(act(el, 'run'), 'Escape');
    el.renderNow();
    expect(esc.defaultPrevented).toBe(true);
    expect(isOpen(el)).toBe(false);
    expect(focused(el)).toBe(trigger(el));
    // Closed, Esc is not ours: it goes on to the page.
    expect(key(trigger(el), 'Escape').defaultPrevented).toBe(false);
  });

  it('a press outside closes a fan the person opened; focus tabbing out of the node closes it quietly', () => {
    const el = mount();
    const out = document.createElement('button');
    document.body.append(out);
    press(el, trigger(el));
    pointer(el.shadowRoot!.querySelector('.an-say')!, 'pointerdown');
    expect(isOpen(el)).toBe(true);
    pointer(out, 'pointerdown');
    expect(isOpen(el)).toBe(false);
    press(el, trigger(el), 'keyboard');
    act(el, 'run').dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true, relatedTarget: out }));
    expect(isOpen(el)).toBe(false);
  });

  it('a focused action whose data left gives focus to the trigger', () => {
    const el = mount();
    press(el, trigger(el), 'keyboard');
    key(act(el, 'run'), 'End');
    expect(focused(el)).toBe(act(el, 'delete'));
    el.data = { ...BASE, actions: BASE.actions!.slice(0, 2) };
    el.renderNow();
    expect(acts(el)).toHaveLength(2);
    expect(focused(el)).toBe(trigger(el));
  });
});

describe('hover', () => {
  beforeEach(() => vi.useFakeTimers({ now: NOW }));

  it('a mouse on a hovering device opens it; leaving folds it after 120 ms; coming back cancels', () => {
    media({ fine: true });
    const el = mount();
    pointer(el, 'pointerenter');
    expect(isOpen(el)).toBe(true);
    pointer(el, 'pointerleave');
    vi.advanceTimersByTime(NODE_LEAVE_MS - 1);
    expect(isOpen(el)).toBe(true);
    pointer(el, 'pointerenter');
    vi.advanceTimersByTime(NODE_LEAVE_MS * 3);
    expect(isOpen(el)).toBe(true);
    pointer(el, 'pointerleave');
    vi.advanceTimersByTime(NODE_LEAVE_MS);
    expect(isOpen(el)).toBe(false);
    expect(el.hasAttribute('open')).toBe(false);
  });

  it('never on a device that does not hover, nor for a finger or a pen on one that does', () => {
    media({ fine: false });
    const el = mount();
    pointer(el, 'pointerenter');
    expect(isOpen(el)).toBe(false);
    media({ fine: true });
    pointer(el, 'pointerenter', 'touch');
    pointer(el, 'pointerenter', 'pen');
    expect(isOpen(el)).toBe(false);
  });

  it('a tap on the trigger stays open when the finger lifts; a keyboard-opened fan ignores the mouse leaving', () => {
    media({ fine: false });
    const el = mount();
    trigger(el).dispatchEvent(
      new PointerEvent('click', { bubbles: true, composed: true, cancelable: true, pointerType: 'touch' }),
    );
    el.renderNow();
    pointer(el, 'pointerleave', 'touch');
    vi.advanceTimersByTime(NODE_LEAVE_MS * 2);
    expect(isOpen(el)).toBe(true);
    press(el, trigger(el));
    media({ fine: true });
    press(el, trigger(el), 'keyboard');
    pointer(el, 'pointerenter');
    pointer(el, 'pointerleave');
    vi.advanceTimersByTime(NODE_LEAVE_MS * 2);
    expect(isOpen(el)).toBe(true);
    expect(focused(el)).toBe(act(el, 'run'));
  });

  it('closing on leave with focus in the fan hands focus to the trigger (the fan turns inert)', () => {
    media({ fine: true });
    const el = mount();
    pointer(el, 'pointerenter');
    act(el, 'run').focus();
    pointer(el, 'pointerleave');
    vi.advanceTimersByTime(NODE_LEAVE_MS);
    expect(isOpen(el)).toBe(false);
    expect(focused(el)).toBe(trigger(el));
  });
});

describe('the open attribute', () => {
  beforeEach(() => vi.useFakeTimers({ now: NOW }));

  it('pins the fan out: a pointer leaving or a press outside leaves it; the trigger closes it and drops the attribute', () => {
    media({ fine: true });
    const el = mount(BASE, { open: '' });
    expect(isOpen(el)).toBe(true);
    expect(fan(el).hasAttribute('inert')).toBe(false);
    pointer(el, 'pointerenter');
    pointer(el, 'pointerleave');
    vi.advanceTimersByTime(NODE_LEAVE_MS * 2);
    pointer(document.body, 'pointerdown');
    expect(isOpen(el)).toBe(true);
    press(el, trigger(el));
    expect(isOpen(el)).toBe(false);
    expect(el.hasAttribute('open')).toBe(false);
    el.setAttribute('open', '');
    el.renderNow();
    expect(isOpen(el)).toBe(true);
    el.removeAttribute('open');
    el.renderNow();
    expect(isOpen(el)).toBe(false);
    el.open = true;
    expect(el.hasAttribute('open')).toBe(true);
    expect(isOpen(el)).toBe(true);
    el.open = false;
    expect(el.hasAttribute('open')).toBe(false);
    expect(isOpen(el)).toBe(false);
  });

  it('leaving the page folds a fan the person opened, not a pinned one; no timer or listener is left behind', () => {
    media({ fine: true });
    const el = mount();
    pointer(el, 'pointerenter');
    pointer(el, 'pointerleave');
    el.remove();
    expect(el.open).toBe(false);
    expect(el.hasAttribute('open')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    document.body.append(el);
    el.renderNow();
    expect(isOpen(el)).toBe(false);
    const pinned = mount(BASE, { open: '' });
    pinned.remove();
    document.body.append(pinned);
    pinned.renderNow();
    expect(isOpen(pinned)).toBe(true);
  });

  it('set before the data arrives, the fan is out once there are actions', () => {
    const el = document.createElement('ui-action-node');
    el.setAttribute('open', '');
    document.body.append(el);
    el.renderNow();
    expect(el.open).toBe(true);
    expect(q(el, '.an-trigger')).toBeNull();
    el.data = BASE;
    el.renderNow();
    expect(isOpen(el)).toBe(true);
  });
});

// ── events ─────────────────────────────────────────────────────────────────

describe('events', () => {
  it('ui-action carries the id; a closed fan sends nothing', () => {
    const el = mount();
    const seen = events<{ id: string }>(el, 'ui-action');
    click(act(el, 'run'));
    expect(seen).toEqual([]);
    press(el, trigger(el));
    click(act(el, 'run'));
    click(act(el, 'edit'));
    expect(seen).toEqual([{ id: 'run' }, { id: 'edit' }]);
    // The fan stays out: the host answers with new data.
    expect(isOpen(el)).toBe(true);
  });

  it('ui-open when the name is pressed; both events are cancelable', () => {
    const el = mount();
    const opened = events<object>(el, 'ui-open');
    el.addEventListener('ui-open', (e) => e.preventDefault());
    const e = click(q(el, '.an-name')!);
    expect(opened).toEqual([{}]);
    expect(e.defaultPrevented).toBe(false);
    let cancelable = false;
    el.addEventListener('ui-action', (ev) => {
      cancelable = ev.cancelable;
    });
    press(el, trigger(el));
    click(act(el, 'run'));
    expect(cancelable).toBe(true);
  });
});

describe('danger: two presses', () => {
  beforeEach(() => vi.useFakeTimers({ now: NOW }));

  it('the first press arms (no event), a second within the window sends ui-action, then it is disarmed', () => {
    const el = mount();
    const seen = events<{ id: string }>(el, 'ui-action');
    press(el, trigger(el));
    press(el, act(el, 'delete'));
    expect(seen).toEqual([]);
    const b = act(el, 'delete');
    expect(b.hasAttribute('data-armed')).toBe(true);
    expect(b.getAttribute('aria-label')).toBe('Press again to delete');
    expect(b.title).toBe('Press again to delete');
    expect(q(el, '.an-hint')!.hidden).toBe(false);
    expect(q(el, '.an-hint')!.textContent).toBe('Press again to delete');
    expect(q(el, '.an-st')!.hidden).toBe(true);
    expect(q(el, '.an-live')!.textContent).toBe('Press again to delete');
    // A double click is one press.
    vi.advanceTimersByTime(NODE_ARM_GUARD_MS - 50);
    press(el, act(el, 'delete'));
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(50);
    press(el, act(el, 'delete'));
    expect(seen).toEqual([{ id: 'delete' }]);
    expect(act(el, 'delete').hasAttribute('data-armed')).toBe(false);
    expect(act(el, 'delete').getAttribute('aria-label')).toBe('Delete');
    expect(q(el, '.an-hint')!.hidden).toBe(true);
    expect(q(el, '.an-st')!.hidden).toBe(false);
    expect(q(el, '.an-live')!.textContent).toBe('');
  });

  it('the arm lapses after the window: the next press arms again', () => {
    const el = mount();
    const seen = events<{ id: string }>(el, 'ui-action');
    press(el, trigger(el));
    press(el, act(el, 'delete'));
    vi.advanceTimersByTime(NODE_ARM_MS);
    el.renderNow();
    expect(act(el, 'delete').hasAttribute('data-armed')).toBe(false);
    expect(act(el, 'delete').getAttribute('aria-label')).toBe('Delete');
    press(el, act(el, 'delete'));
    expect(seen).toEqual([]);
    expect(act(el, 'delete').hasAttribute('data-armed')).toBe(true);
  });

  it('another action, Esc (closing the fan), focus leaving it or its action leaving the data disarm it', () => {
    const el = mount();
    const seen = events<{ id: string }>(el, 'ui-action');
    press(el, trigger(el));
    press(el, act(el, 'delete'));
    press(el, act(el, 'edit'));
    expect(seen).toEqual([{ id: 'edit' }]);
    expect(act(el, 'delete').hasAttribute('data-armed')).toBe(false);
    press(el, act(el, 'delete'));
    key(act(el, 'delete'), 'Escape');
    el.renderNow();
    expect(isOpen(el)).toBe(false);
    expect(act(el, 'delete').hasAttribute('data-armed')).toBe(false);
    press(el, trigger(el));
    press(el, act(el, 'delete'));
    act(el, 'delete').dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, composed: true, relatedTarget: act(el, 'edit') }),
    );
    el.renderNow();
    expect(act(el, 'delete').hasAttribute('data-armed')).toBe(false);
    press(el, act(el, 'delete'));
    el.data = { ...BASE, actions: BASE.actions!.slice(0, 3) };
    el.renderNow();
    el.data = BASE;
    el.renderNow();
    expect(act(el, 'delete').hasAttribute('data-armed')).toBe(false);
    // A held Enter repeats the click: swallowed on the fan's buttons.
    expect(key(act(el, 'delete'), 'Enter', { repeat: true }).defaultPrevented).toBe(true);
    expect(seen).toEqual([{ id: 'edit' }]);
  });
});

// ── strings ────────────────────────────────────────────────────────────────

describe('escaping and language', () => {
  it('escapes every string: name, description, meta, chip labels and marks, action labels', () => {
    vi.useFakeTimers({ now: NOW });
    const el = mount({
      name: XSS,
      description: XSS,
      meta: [XSS],
      chips: [{ label: XSS }, { label: `"${XSS}`, mark: '<b' }],
      more: 2,
      actions: [
        { id: XSS, label: XSS, icon: 'play' },
        { id: `"x'`, label: 'Delete', icon: 'trash', tone: 'danger' },
      ],
      status: 'failed',
    });
    const root = el.shadowRoot!;
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('b')).toBeNull();
    expect(q(el, '.an-name')!.textContent).toBe(XSS);
    expect(q(el, '.an-say')!.textContent).toBe(XSS);
    expect(q(el, '.an-m')!.textContent).toBe(XSS);
    expect(qa(el, '.an-chip')[0].title).toBe(XSS);
    expect(qa(el, '.an-chip')[1].title).toBe(`"${XSS}`);
    expect(qa(el, '.an-chip')[1].textContent).toBe('<b');
    expect(q(el, '.an-chain-sr')!.textContent).toBe(`${XSS}, "${XSS}, 2 more`);
    expect(trigger(el).getAttribute('aria-label')).toBe(`Actions for ${XSS}`);
    expect(fan(el).getAttribute('aria-label')).toBe(`Actions for ${XSS}`);
    expect(acts(el)[0].getAttribute('aria-label')).toBe(XSS);
    expect(acts(el)[0].title).toBe(XSS);
    expect(acts(el)[0].dataset.id).toBe(XSS);
    const seen = events<{ id: string }>(el, 'ui-action');
    press(el, trigger(el));
    press(el, acts(el)[0]);
    press(el, acts(el)[1]);
    vi.advanceTimersByTime(NODE_ARM_GUARD_MS);
    press(el, acts(el)[1]);
    expect(seen).toEqual([{ id: XSS }, { id: `"x'` }]);
    expect(root.querySelector('img')).toBeNull();
  });

  it('lang="ko": the status words, the trigger, the armed prompt and "+N" in Korean', () => {
    vi.useFakeTimers({ now: NOW });
    const el = mount(
      {
        ...BASE,
        name: '주간 비용 리포트',
        status: 'paused',
        actions: [{ id: 'delete', label: '삭제', icon: 'trash', tone: 'danger' }],
      },
      { lang: 'ko' },
    );
    expect(q(el, '.an-st-t')!.textContent).toBe('일시 정지');
    expect(trigger(el).getAttribute('aria-label')).toBe('주간 비용 리포트 동작');
    expect(qa(el, '.an-chip').at(-1)!.title).toBe('3개 더');
    expect(q(el, '.an-chain-sr')!.textContent).toBe('#ops, #dev-soma, #release, 3개 더');
    press(el, trigger(el));
    press(el, act(el, 'delete'));
    expect(act(el, 'delete').getAttribute('aria-label')).toBe('한 번 더 누르면 삭제');
    expect(q(el, '.an-hint')!.textContent).toBe('한 번 더 누르면 삭제');
    const words: Record<string, string> = { active: '활성', running: '실행 중', failed: '마지막 실행 실패' };
    for (const [status, word] of Object.entries(words)) {
      el.data = { ...BASE, status: status as ActionNodeData['status'] };
      el.renderNow();
      expect(q(el, '.an-st-t')!.textContent).toBe(word);
    }
    el.setAttribute('lang', 'en');
    el.renderNow();
    expect(q(el, '.an-st-t')!.textContent).toBe('Last run failed');
  });
});

describe('reduced motion', () => {
  it('no stagger: every button opens and closes at once', () => {
    media({ fine: true, reduce: true });
    const el = mount();
    expect(acts(el).map((b) => b.style.getPropertyValue('--an-d'))).toEqual(['0ms', '0ms', '0ms', '0ms']);
    press(el, trigger(el));
    expect(acts(el).map((b) => b.style.getPropertyValue('--an-d'))).toEqual(['0ms', '0ms', '0ms', '0ms']);
  });

  it('styles: the fan only fades — no slide, overshoot, scale or stagger', () => {
    const reduce = styles.slice(styles.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduce).toContain(
      '.an-act, .an[data-open] .an-act { translate: var(--an-x) var(--an-y); scale: 1; transition: opacity 140ms ease !important; }',
    );
    expect(reduce).toContain('.an-spin { animation: none; }');
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
    spy = soundSpy();
  });
  afterEach(() => spy.restore());
  /** Fake timers: play what the queue holds, then start a fresh gesture. */
  const settle = () => {
    vi.advanceTimersByTime(40);
    resetSoundQueue();
  };
  const tap = (el: UiActionNode, t: Element, how: 'mouse' | 'keyboard' = 'mouse') => {
    press(el, t, how);
    settle();
  };

  it('the trigger opens (subtle open) and closes (subtle close); Esc closes subtly too', () => {
    const el = mount();
    tap(el, trigger(el));
    tap(el, trigger(el));
    tap(el, trigger(el), 'keyboard');
    key(act(el, 'run'), 'Escape');
    settle();
    expect(spy.calls).toEqual([
      ['open', { emphasis: 'subtle', input: 'mouse' }],
      ['close', { emphasis: 'subtle', input: 'mouse' }],
      ['open', { emphasis: 'subtle', input: 'keyboard' }],
      ['close', { emphasis: 'subtle', input: 'keyboard' }],
    ]);
  });

  it('hover, the open attribute and data never sound', () => {
    media({ fine: true });
    const el = mount();
    pointer(el, 'pointerenter');
    pointer(el, 'pointerleave');
    vi.advanceTimersByTime(NODE_LEAVE_MS);
    el.setAttribute('open', '');
    el.removeAttribute('open');
    el.data = { ...BASE, status: 'running' };
    el.renderNow();
    settle();
    expect(spy.calls).toEqual([]);
  });

  it('an action taps; a prevented one is silent; arming taps a subtle warning, confirming taps; the name navigates', () => {
    const el = mount();
    tap(el, trigger(el));
    spy.calls.length = 0;
    tap(el, act(el, 'run'));
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener('ui-action', stop);
    tap(el, act(el, 'edit'));
    el.removeEventListener('ui-action', stop);
    tap(el, act(el, 'delete'));
    vi.advanceTimersByTime(NODE_ARM_GUARD_MS);
    tap(el, act(el, 'delete'));
    tap(el, q(el, '.an-name')!);
    expect(spy.calls).toEqual([
      ['tap', { input: 'mouse' }],
      ['warning', { emphasis: 'subtle', input: 'mouse' }],
      ['tap', { input: 'mouse' }],
      ['navigate', { input: 'mouse' }],
    ]);
  });
});

// ── styles and docs ────────────────────────────────────────────────────────

describe('styles and docs', () => {
  it('uses tokens only; the corner in CSS is the corner the fan is measured from', () => {
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(styles).not.toMatch(/rgba?\(/i);
    expect(styles).toContain(`--an-r: ${NODE_CORNER}px;`);
    expect(styles).toContain('@media (hover: hover) and (pointer: fine)');
    expect(styles).toContain('@media (pointer: coarse)');
    expect(styles).toContain(".an-trigger::before { content: ''; position: absolute; inset: -6px;");
    expect(styles).toContain(
      ':is(.an-name, .an-trigger, .an-act):focus-visible { outline: 2px solid var(--border-focus);',
    );
  });

  it('ships ≥ 3 demos that build without the network', () => {
    const fetchSpy = vi.fn(() => {
      throw new Error('no network in demos');
    });
    vi.stubGlobal('fetch', fetchSpy);
    expect(doc.slug).toBe('action-node');
    expect(doc.tag).toBe('ui-action-node');
    expect(doc.group).toBe('Components');
    expect(doc.reference.url).toBe('https://bencho.dev/blocks/action-node');
    expect(doc.a11y.some((l) => l.startsWith('Sound (opt-in'))).toBe(true);
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const d of doc.demos) {
      const box = d.create();
      document.body.append(box);
      const nodes = box.matches('ui-action-node') ? [box] : Array.from(box.querySelectorAll('ui-action-node'));
      expect(nodes.length).toBeGreaterThan(0);
      for (const n of nodes) (n as UiActionNode).renderNow();
      expect(box).toBeInstanceOf(HTMLElement);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    const pinned = doc.demos
      .find((d) => d.id === 'pinned')!
      .create()
      .querySelector('ui-action-node')!;
    document.body.append(pinned);
    pinned.renderNow();
    expect(pinned.open).toBe(true);
  });

  it('the standup demo logs each ui-action and its host answers Pause with new data', () => {
    const box = doc.demos.find((d) => d.id === 'standup')!.create();
    document.body.append(box);
    const el = box.querySelector('ui-action-node')!;
    el.renderNow();
    press(el, trigger(el));
    press(el, act(el, 'pause'));
    expect(box.querySelector('.ui-status-line')!.textContent).toBe('ui-action · pause');
    expect(el.data?.status).toBe('paused');
    expect(acts(el).map((b) => b.dataset.id)).toContain('resume');
  });
});
