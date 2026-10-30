import { beforeEach, describe, expect, it, vi } from 'vitest';
import './setting-row';
import { firstControl, hasAccessibleName, type SettingRowData, type UiSettingRow } from './setting-row';
import { styles } from './styles';

function mount(data: SettingRowData | undefined, control?: string, attrs: Record<string, string> = {}): UiSettingRow {
  const el = document.createElement('ui-setting-row') as UiSettingRow;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (control) el.innerHTML = control;
  document.body.append(el);
  if (data) el.data = data;
  el.renderNow();
  return el;
}
const q = (el: UiSettingRow, s: string) => el.shadowRoot!.querySelector<HTMLElement>(s);
const qa = (el: UiSettingRow, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));

const BASE: SettingRowData = {
  key: 'model',
  label: 'Default model',
  description: 'The model a new conversation starts with.',
  hints: [{ label: 'Command', code: '/model' }, '24-hour clock'],
  defaultText: 'Sonnet',
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('<ui-setting-row> rendering', () => {
  it('renders nothing without data', () => {
    const el = mount(undefined);
    expect(q(el, '.sr')).toBeNull();
  });

  it('draws label, description, hints (code in mono), the default and the control slot', () => {
    const el = mount(BASE, '<select class="ui-input"><option>Sonnet</option></select>');
    expect(q(el, '.sr-name')?.textContent).toBe('Default model');
    expect(q(el, '.sr-desc')?.textContent).toBe('The model a new conversation starts with.');
    const hints = qa(el, '.sr-hint').map((h) => h.textContent);
    expect(hints).toEqual(['Command /model', '24-hour clock', 'Default: Sonnet']);
    expect(q(el, '.sr-hints code')?.textContent).toBe('/model');
    expect(q(el, '.sr-slot slot')).not.toBeNull();
    expect(q(el, '.sr-dot')).toBeNull();
    expect(q(el, '.sr-reset')).toBeNull();
    expect(q(el, '.sr-badge')).toBeNull();
  });

  it('skips empty hints and an empty default; no hints row when there is nothing to say', () => {
    const el = mount({ label: 'Theme', hints: ['', { code: '' }], defaultText: '' });
    expect(q(el, '.sr-hints')).toBeNull();
    expect(q(el, '.sr-desc')).toBeNull();
  });

  it('modified: an ink dot (aria-hidden) and “Modified” for screen readers — not colour alone', () => {
    const el = mount({ ...BASE, modified: true });
    expect(q(el, '.sr-dot')?.getAttribute('aria-hidden')).toBe('true');
    expect(q(el, '.sr-head .sr-only')?.textContent).toBe('(Modified)');
    expect(q(el, '.sr')?.hasAttribute('data-modified')).toBe(true);
  });

  it('a badge after the label', () => {
    const el = mount({ ...BASE, badge: 'Admin' });
    expect(q(el, '.sr-badge')?.textContent).toBe('Admin');
  });

  it('escapes every string the host passes', () => {
    const x = '<img src=x onerror=alert(1)>';
    const el = mount({
      key: x,
      label: x,
      description: x,
      hints: [x, { label: x, code: x }],
      defaultText: x,
      badge: x,
      modified: true,
      canReset: true,
      status: { state: 'error', text: x },
    });
    expect(q(el, 'img')).toBeNull();
    expect(q(el, '.sr-name')?.textContent).toBe(x);
    expect(q(el, '.sr-desc')?.textContent).toBe(x);
    expect(q(el, '.sr-badge')?.textContent).toBe(x);
    expect(q(el, '.sr-hints code')?.textContent).toBe(x);
    expect(q(el, '.sr-default')?.textContent).toBe(`Default: ${x}`);
    expect(q(el, '.sr-reset')?.getAttribute('aria-label')).toBe(`Reset ${x} to default`);
    expect(q(el, '[role="alert"] .sr-msg')?.textContent).toBe(x);
    const locked = mount({ label: 'L', locked: { reason: x, value: x } });
    expect(q(locked, 'img')).toBeNull();
    expect(q(locked, '.sr-value')?.textContent).toBe(x);
    expect(q(locked, '.sr-reason')?.textContent).toBe(x);
  });

  it('draws the hairline from the stylesheet: none on the first row or with data-first; 560px container query', () => {
    expect(styles).toContain(':host(:first-of-type) .sr, :host([data-first]) .sr { border-top: 0; }');
    expect(styles).toContain('@container srow (min-width: 560px)');
    expect(styles).toContain('padding: 14px 16px');
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
});

describe('<ui-setting-row> status', () => {
  it('saved: check + “Saved” inside role=status', () => {
    const el = mount({ ...BASE, status: { state: 'saved' } });
    const live = q(el, '[role="status"]')!;
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.querySelector('.sr-msg')?.textContent).toBe('Saved');
    expect(live.querySelector('svg[data-icon="check"]')).not.toBeNull();
    expect(q(el, '[role="alert"]')?.textContent).toBe('');
  });

  it('pending: “Saving…” inside role=status', () => {
    const el = mount({ ...BASE, status: { state: 'pending' } });
    expect(q(el, '[role="status"] .sr-msg')?.textContent).toBe('Saving…');
    expect(q(el, '[role="status"] .sr-spin')).not.toBeNull();
  });

  it('error: alert glyph + text inside role=alert; the polite region stays empty', () => {
    const el = mount({ ...BASE, status: { state: 'error', text: 'Couldn’t save — try again' } });
    const alert = q(el, '[role="alert"]')!;
    expect(alert.querySelector('.sr-msg')?.textContent).toBe('Couldn’t save — try again');
    expect(alert.querySelector('svg[data-icon="alert"]')).not.toBeNull();
    expect(q(el, '[role="status"]')?.textContent).toBe('');
  });

  it('the live regions persist across updates; a new message is a new node, the same one stays', () => {
    const el = mount({ ...BASE, status: { state: 'pending' } });
    const live = q(el, '[role="status"]');
    el.data = { ...BASE, status: { state: 'saved', text: 'Saved — Opus' } };
    el.renderNow();
    expect(q(el, '[role="status"]')).toBe(live);
    const msg = q(el, '.sr-msg');
    expect(msg?.textContent).toBe('Saved — Opus');
    el.data = { ...BASE, modified: true, status: { state: 'saved', text: 'Saved — Opus' } };
    el.renderNow();
    expect(q(el, '.sr-msg')).toBe(msg);
    el.data = { ...BASE, status: null };
    el.renderNow();
    expect(q(el, '.sr-msg')).toBeNull();
  });

  it('rises in only after the first paint (data-anim), with a reduced-motion override', () => {
    const el = mount({ ...BASE, status: { state: 'saved' } });
    expect(q(el, '.sr')?.hasAttribute('data-anim')).toBe(false);
    el.data = { ...BASE, status: { state: 'pending' } };
    el.renderNow();
    expect(q(el, '.sr')?.hasAttribute('data-anim')).toBe(true);
    expect(styles).toContain('@starting-style');
    expect(styles).toMatch(/prefers-reduced-motion: reduce\)[^@]*\.sr\[data-anim\] \.sr-msg \{ transition: none; \}/);
  });
});

describe('<ui-setting-row> locked', () => {
  it('hides the control slot and shows the value with a lock and the reason', () => {
    const el = mount(
      { ...BASE, locked: { value: 'Off', reason: 'Set by your workspace admin' } },
      '<label class="ui-switch"><input type="checkbox" role="switch"><span>Off</span></label>',
    );
    expect(q(el, 'slot')).toBeNull();
    expect(q(el, '.sr')?.hasAttribute('data-locked')).toBe(true);
    expect(q(el, '.sr-value')?.textContent).toBe('Off');
    expect(q(el, '.sr-reason')?.textContent).toBe('Set by your workspace admin');
    expect(q(el, '.sr-lockline .sr-only')?.textContent).toBe('Locked: ');
    expect(q(el, '.sr-lockline svg[data-icon="lock"]')).not.toBeNull();
  });

  it('no Reset to default while locked', () => {
    const el = mount({ ...BASE, modified: true, canReset: true, locked: { reason: 'Admin' } });
    expect(q(el, '.sr-reset')).toBeNull();
    expect(q(el, '.sr-value')).toBeNull();
  });

  it('unlocking brings the slot back', () => {
    const el = mount({ ...BASE, locked: { reason: 'Admin' } }, '<input class="ui-input">');
    el.data = { ...BASE, locked: null };
    el.renderNow();
    expect(q(el, '.sr-slot slot')).not.toBeNull();
    expect(q(el, '.sr-locked')).toBeNull();
  });
});

describe('<ui-setting-row> reset', () => {
  it('Reset to default shows only while modified and canReset; sends a cancelable ui-reset { key }', () => {
    const plain = mount({ ...BASE, canReset: true });
    expect(q(plain, '.sr-reset')).toBeNull();
    const el = mount({ ...BASE, modified: true, canReset: true });
    const btn = q(el, '.sr-reset')!;
    expect(btn.textContent).toBe('Reset to default');
    expect(btn.getAttribute('aria-label')).toBe('Reset Default model to default');
    const seen: CustomEvent[] = [];
    el.addEventListener('ui-reset', (e) => seen.push(e as CustomEvent));
    btn.click();
    expect(seen).toHaveLength(1);
    expect(seen[0].detail).toEqual({ key: 'model' });
    expect(seen[0].bubbles && seen[0].composed && seen[0].cancelable).toBe(true);
  });

  it('preventDefault is reported back to the dispatcher (no default action of its own)', () => {
    const el = mount({ ...BASE, modified: true, canReset: true });
    el.addEventListener('ui-reset', (e) => e.preventDefault());
    const spy = vi.fn();
    document.addEventListener('ui-reset', (e) => spy(e.defaultPrevented));
    q(el, '.sr-reset')!.click();
    expect(spy).toHaveBeenCalledWith(true);
    expect(q(el, '.sr-reset')).not.toBeNull();
  });

  it('key defaults to the empty string', () => {
    const el = mount({ label: 'X', modified: true, canReset: true });
    const fired = vi.fn();
    el.addEventListener('ui-reset', (e) => fired((e as CustomEvent).detail));
    q(el, '.sr-reset')!.click();
    expect(fired).toHaveBeenCalledWith({ key: '' });
  });
});

describe('<ui-setting-row> naming the slotted control', () => {
  it('a select without a name gets aria-label and aria-description from the row', () => {
    const el = mount(BASE, '<select class="ui-input"><option>Sonnet</option></select>');
    const sel = el.querySelector('select')!;
    expect(sel.getAttribute('aria-label')).toBe('Default model');
    expect(sel.getAttribute('aria-description')).toBe('The model a new conversation starts with.');
    expect(el.control).toBe(sel);
  });

  it('a switch whose state word is aria-hidden is named after the row; a worded label keeps its own name', () => {
    const named = mount(
      { label: 'Daily digest' },
      '<label class="ui-switch"><input type="checkbox" role="switch"><span aria-hidden="true">On</span></label>',
    );
    expect(named.querySelector('input')?.getAttribute('aria-label')).toBe('Daily digest');
    const own = mount(
      { label: 'Daily digest' },
      '<label class="ui-switch"><input type="checkbox" role="switch"><span>Send it</span></label>',
    );
    expect(own.querySelector('input')?.hasAttribute('aria-label')).toBe(false);
  });

  it('never overrides a name the host set (aria-label, label[for], title) or a description it set', () => {
    const a = mount(BASE, '<input class="ui-input" aria-label="Model id">');
    expect(a.querySelector('input')?.getAttribute('aria-label')).toBe('Model id');
    expect(a.querySelector('input')?.hasAttribute('aria-description')).toBe(false);
    const b = mount(BASE, '<label for="f-x">Model</label><input id="f-x">');
    expect(b.querySelector('input')?.hasAttribute('aria-label')).toBe(false);
    const c = mount(BASE, '<input title="Model">');
    expect(c.querySelector('input')?.hasAttribute('aria-label')).toBe(false);
    const d = mount(BASE, '<input aria-describedby="help">');
    expect(d.querySelector('input')?.getAttribute('aria-label')).toBe('Default model');
    expect(d.querySelector('input')?.hasAttribute('aria-description')).toBe(false);
  });

  it('follows a label change and removes what it added when locked or disconnected', () => {
    const el = mount(BASE, '<input class="ui-input">');
    const input = el.querySelector('input')!;
    el.data = { ...BASE, label: 'Model', description: undefined };
    el.renderNow();
    expect(input.getAttribute('aria-label')).toBe('Model');
    expect(input.hasAttribute('aria-description')).toBe(false);
    el.data = { ...BASE, locked: { reason: 'Admin' } };
    el.renderNow();
    expect(input.hasAttribute('aria-label')).toBe(false);
    el.data = BASE;
    el.renderNow();
    expect(input.getAttribute('aria-label')).toBe('Default model');
    el.remove();
    expect(input.hasAttribute('aria-label')).toBe(false);
    expect(input.hasAttribute('aria-description')).toBe(false);
  });

  it('leaves a name the host put on after the row did', () => {
    const el = mount(BASE, '<input class="ui-input">');
    const input = el.querySelector('input')!;
    input.setAttribute('aria-label', 'Custom');
    el.remove();
    expect(input.getAttribute('aria-label')).toBe('Custom');
  });

  it('a swapped control: the old one loses the name, the new one gets it', () => {
    const el = mount(BASE, '<input class="ui-input" id="a">');
    const a = el.querySelector('input')!;
    a.remove();
    const b = document.createElement('select');
    el.append(b);
    el.renderNow();
    expect(a.hasAttribute('aria-label')).toBe(false);
    expect(b.getAttribute('aria-label')).toBe('Default model');
  });

  it('only the first control: a Save button keeps its own words', () => {
    const el = mount(BASE, '<input class="ui-input"><button type="button" class="ui-btn">Save</button>');
    expect(el.querySelector('input')?.getAttribute('aria-label')).toBe('Default model');
    expect(el.querySelector('button')?.hasAttribute('aria-label')).toBe(false);
  });

  it('helpers: firstControl finds nested controls; hasAccessibleName reads labels, titles and button text', () => {
    const box = document.createElement('div');
    box.innerHTML = '<div><span>x</span></div><label><input type="checkbox"> Send</label><input type="hidden">';
    expect(firstControl(Array.from(box.children))?.getAttribute('type')).toBe('checkbox');
    expect(hasAccessibleName(box.querySelector('input')!)).toBe(true);
    const btn = document.createElement('button');
    expect(hasAccessibleName(btn)).toBe(false);
    btn.textContent = 'Save';
    expect(hasAccessibleName(btn)).toBe(true);
    const ph = document.createElement('input');
    ph.placeholder = 'Search';
    expect(hasAccessibleName(ph)).toBe(false);
    expect(firstControl([document.createElement('p')])).toBeNull();
  });
});

describe('<ui-setting-row> focus and lang', () => {
  it('when Reset to default goes away, focus moves on to the control', () => {
    const el = mount(
      { ...BASE, modified: true, canReset: true },
      '<select class="ui-input"><option>A</option></select>',
    );
    q(el, '.sr-reset')!.focus();
    expect(el.shadowRoot!.activeElement).toBe(q(el, '.sr-reset'));
    el.data = { ...BASE, modified: false, canReset: true };
    el.renderNow();
    expect(document.activeElement).toBe(el.querySelector('select'));
  });

  it('lang="ko" switches the words', () => {
    const el = mount({ ...BASE, modified: true, canReset: true, status: { state: 'saved' } }, undefined, {
      lang: 'ko',
    });
    expect(q(el, '.sr-default')?.textContent).toBe('기본값: Sonnet');
    expect(q(el, '.sr-reset')?.textContent).toBe('기본값으로');
    expect(q(el, '.sr-head .sr-only')?.textContent).toBe('(변경됨)');
    expect(q(el, '[role="status"] .sr-msg')?.textContent).toBe('저장했습니다');
    el.data = { ...BASE, status: { state: 'pending' }, locked: { reason: '관리자' } };
    el.renderNow();
    expect(q(el, '[role="status"] .sr-msg')?.textContent).toBe('저장 중…');
    expect(q(el, '.sr-lockline .sr-only')?.textContent).toBe('잠김: ');
    el.data = { ...BASE, status: { state: 'error' } };
    el.renderNow();
    expect(q(el, '[role="alert"] .sr-msg')?.textContent).toBe('저장하지 못했습니다');
  });

  it('changing lang re-renders', async () => {
    const el = mount({ ...BASE });
    el.setAttribute('lang', 'ko');
    await Promise.resolve();
    expect(q(el, '.sr-default')?.textContent).toBe('기본값: Sonnet');
  });
});
