/**
 * Demo builders for the docs of `<ui-mood>` and `<ui-mood-hud>` (site only; not part of the package entries): the
 * locked-Pay screen of Libraries.dev's showcase — replayed on the real reader, or live on your own pointer — a format
 * hint that blends with `--mood`, and a settings page to get lost in.
 */
import '../mood-hud/mood-hud';
import type { UiMoodHud } from '../mood-hud/mood-hud';
import type { MoodReading } from './engine/types';
import {
  inBox,
  PAY_AGREE_AT,
  PAY_AT,
  PAY_LOOP_MS,
  PAY_STAGE,
  type PayLayout,
  payLayout,
  payPointerAt,
  payPointerGone,
  payPresses,
  payRoute,
} from './fixtures';
import './mood';
import type { UiMood } from './mood';

type State = 1 | 2 | 3;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, style = '', text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (style) el.style.cssText = style;
  if (text) el.textContent = text;
  return el;
}

/** 1 neutral, 2 confused or lost, 3 frustrated; once agreed, nothing is locked. As the Libraries.dev usage reads. */
export function payState(mood: MoodReading['mood'], agreed: boolean): State {
  if (agreed) return 1;
  if (mood === 'frustrated') return 3;
  return mood === 'confused' || mood === 'lost' ? 2 : 1;
}

interface PayScreen {
  mood: UiMood;
  hud: UiMoodHud;
  stage: HTMLElement;
  pay: HTMLButtonElement;
  check: HTMLInputElement;
  states: HTMLElement[];
  layout: PayLayout;
  setState(): void;
}

const STATE_NAMES = {
  en: ['Neutral', 'Confused', 'Frustrated'],
  ko: ['평온', '헷갈림', '답답함'],
};

/** The Pay screen: a locked Pay behind a terms checkbox, inside `<ui-mood>` and `<ui-mood-hud>`, laid out on the stage. */
function payScreen(lang: 'en' | 'ko', baselineKey: string | null): PayScreen {
  const l = payLayout();
  const mood = document.createElement('ui-mood');
  mood.data = { baselineKey };
  const hud = document.createElement('ui-mood-hud');
  if (lang === 'ko') hud.setAttribute('lang', 'ko');
  const stage = h('div', `position:relative;width:${PAY_STAGE.w}px;height:${PAY_STAGE.h}px;`);
  const screen = h(
    'div',
    `position:absolute;left:${l.screen.x}px;top:${l.screen.y}px;width:${l.screen.w}px;height:${l.screen.h}px;border-radius:16px;background:var(--ui-surface-raised, #f1f1f1);border:1px solid var(--ui-border, #e4e4e4);`,
  );
  const form = h('form', 'margin:0');
  form.setAttribute('novalidate', '');
  form.addEventListener('submit', (e) => e.preventDefault());
  const pay = h(
    'button',
    `position:absolute;left:${l.pay.x - l.screen.x}px;top:${l.pay.y - l.screen.y}px;width:${l.pay.w}px;height:${l.pay.h}px;border:0;border-radius:12px;background:var(--ui-text, #18181a);color:var(--ui-surface, #fff);font-weight:600;font-size:15px;line-height:1;font-family:inherit;transition:opacity .3s var(--ui-ease-out, ease);cursor:pointer`,
    lang === 'ko' ? '97,540원 결제' : 'Pay $97.54',
  );
  pay.id = 'pay';
  pay.type = 'submit';
  pay.disabled = true;
  const label = h(
    'label',
    `position:absolute;left:${l.check.x - l.screen.x}px;top:${l.check.y - l.screen.y}px;display:flex;align-items:center;gap:10px;font-size:13px;color:var(--ui-text-secondary, #57575d);transition:color .3s;cursor:pointer;white-space:nowrap`,
  );
  const check = h('input', `width:${l.check.w}px;height:${l.check.h}px;margin:0;accent-color:var(--ui-text, #18181a)`);
  check.type = 'checkbox';
  check.id = 'terms';
  label.append(
    check,
    h(
      'span',
      '',
      lang === 'ko' ? '판매 약관과 환불 정책에 동의합니다' : 'I agree to the terms of sale and the return policy',
    ),
  );
  form.append(pay, label);
  screen.append(form);
  const legend = h(
    'div',
    `position:absolute;left:${l.screen.x}px;top:${l.screen.y + l.screen.h + 18}px;width:${l.screen.w}px;display:flex;gap:14px;align-items:center;font:500 11px/1 var(--ui-mono, monospace);letter-spacing:.06em;text-transform:uppercase;color:var(--ui-text-tertiary, #68686f)`,
  );
  legend.setAttribute('aria-hidden', 'true');
  legend.append(h('span', '', lang === 'ko' ? 'UI 상태' : 'UI state'));
  const states = STATE_NAMES[lang].map((name, i) => {
    const chip = h('span', 'display:inline-flex;gap:6px;align-items:center;transition:color .2s', '');
    chip.append(
      h(
        'i',
        'font-style:normal;display:inline-grid;place-items:center;width:16px;height:16px;border-radius:4px;border:1px solid currentColor',
        String(i + 1),
      ),
      document.createTextNode(name),
    );
    return chip;
  });
  legend.append(...states);
  stage.append(screen, legend);
  hud.append(stage);
  mood.append(hud);

  const setState = () => {
    const s = payState(mood.mood, check.checked);
    form.dataset.state = String(s);
    pay.disabled = !check.checked;
    pay.style.opacity = check.checked ? '1' : s >= 2 ? '0.2' : '0.45';
    label.style.color = s === 3 ? 'var(--ui-text, #18181a)' : 'var(--ui-text-secondary, #57575d)';
    label.style.fontWeight = s === 3 ? '600' : '400';
    states.forEach((chip, i) => {
      chip.style.color = i + 1 === s ? 'var(--ui-text, #18181a)' : '';
    });
  };
  mood.addEventListener('ui-mood-change', setState);
  check.addEventListener('change', setState);
  setState();
  return { mood, hud, stage, pay, check, states, layout: l, setState };
}

/** Scale a fixed-size stage down to the preview's width. */
function scaleToFit(inner: HTMLElement): HTMLElement {
  const box = h('div', `width:100%;max-width:${PAY_STAGE.w}px;margin:0 auto;overflow:hidden;position:relative`);
  box.append(inner);
  inner.style.transformOrigin = '0 0';
  const apply = (w: number) => {
    const k = Math.min(1, w / PAY_STAGE.w);
    inner.style.transform = k < 1 ? `scale(${k})` : '';
    box.style.height = `${PAY_STAGE.h * k}px`;
  };
  if (typeof ResizeObserver === 'function') new ResizeObserver(([e]) => apply(e.contentRect.width)).observe(box);
  return box;
}

function playButton(): HTMLButtonElement {
  const b = h(
    'button',
    'position:absolute;right:12px;bottom:12px;height:30px;padding:0 12px;border-radius:999px;border:1px solid var(--ui-border, #e4e4e4);background:var(--ui-surface, #fff);color:var(--ui-text-secondary, #57575d);font:inherit;font-size:12.5px;cursor:pointer',
  );
  b.type = 'button';
  return b;
}

/**
 * The showcase, replayed on the real reader: a scripted pointer circles the locked Pay, presses it again and again and
 * shakes, ticks the terms and pays. Every move and press is a synthetic pointer event sent into the screen, so the
 * reader, the HUD and the screen's state react exactly as they would to a person. The real pointer passes through
 * (the screen takes no pointer input while it replays). Pauses off screen; with reduced motion it waits for Play.
 */
export function payReplay(lang: 'en' | 'ko' = 'en'): HTMLElement {
  const s = payScreen(lang, null);
  s.mood.style.pointerEvents = 'none';
  const route = payRoute(s.layout);
  const presses = payPresses();
  const wrap = h('div', 'position:relative;width:100%');
  const button = playButton();
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let playing = !reduced;
  let visible = true;
  let clock = 0;
  let last = 0;
  let raf = 0;
  let pressed = 0;
  let round = 0;
  let wasGone = true;
  let attached = false;
  const label = () => {
    button.textContent = playing ? (lang === 'ko' ? '일시정지' : 'Pause') : lang === 'ko' ? '재생' : 'Play';
    button.setAttribute('aria-pressed', String(!playing));
  };
  label();
  button.addEventListener('click', () => {
    playing = !playing;
    label();
    kick();
  });

  const send = (type: string, at: { x: number; y: number }, target: Element) => {
    const r = s.stage.getBoundingClientRect();
    const k = r.width / PAY_STAGE.w || 1;
    const init = {
      bubbles: type !== 'pointerleave',
      composed: true,
      clientX: r.left + at.x * k,
      clientY: r.top + at.y * k,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
    };
    const Ctor = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
    target.dispatchEvent(new Ctor(type, init));
  };
  const targetAt = (p: { x: number; y: number }): Element =>
    inBox(p, s.layout.pay) ? s.pay : inBox(p, s.layout.check, 4) ? s.check : s.stage;

  const step = (now: number) => {
    raf = 0;
    if (!wrap.isConnected) {
      // not on the page yet: wait for it; taken off the page: stop for good
      if (!attached) kick();
      return;
    }
    attached = true;
    if (playing && visible) clock += Math.min(64, now - last);
    last = now;
    const t = clock % PAY_LOOP_MS;
    if (Math.floor(clock / PAY_LOOP_MS) !== round) {
      // a new round: everything back as it was, and the reader forgets the last one
      round = Math.floor(clock / PAY_LOOP_MS);
      pressed = 0;
      s.check.checked = false;
      s.pay.textContent = lang === 'ko' ? '97,540원 결제' : 'Pay $97.54';
      s.mood.reset();
      s.setState();
    }
    const p = payPointerAt(route, t);
    const gone = payPointerGone(t);
    if (playing && visible) {
      if (!gone) send('pointermove', p, targetAt(p));
      else if (!wasGone) {
        send('pointerleave', p, s.hud);
        send('pointerleave', p, s.mood);
      }
      wasGone = gone;
      while (pressed < presses.length && presses[pressed].at <= t) {
        const q = payPointerAt(route, presses[pressed].at);
        const target = presses[pressed].on === 'check' ? s.check : s.pay;
        send('pointerdown', q, target);
        send('pointerup', q, target);
        if (presses[pressed].at === PAY_AGREE_AT) s.check.click();
        if (presses[pressed].at === PAY_AT && !s.pay.disabled)
          s.pay.textContent = lang === 'ko' ? '결제됨 ✓' : 'Paid ✓';
        pressed++;
      }
    }
    // no frames while paused or off screen: Play and the observer start them again
    if (playing && visible) kick();
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(step);
  };

  if (typeof IntersectionObserver === 'function') {
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) kick();
    }).observe(wrap);
  }
  wrap.append(scaleToFit(s.mood), button);
  last = performance.now();
  queueMicrotask(kick);
  return wrap;
}

/** The same screen on your own pointer, with the reading beside it. */
export function payLive(): HTMLElement {
  const s = payScreen('en', null);
  s.check.addEventListener('change', () => {
    if (!s.check.checked) s.pay.textContent = 'Pay $97.54';
  });
  s.pay.addEventListener('click', () => {
    s.pay.textContent = 'Paid ✓';
  });
  const wrap = h('div', 'display:grid;gap:12px;width:100%');
  const out = h(
    'pre',
    'margin:0;padding:10px 12px;border-radius:10px;background:var(--ui-surface-raised, #f1f1f1);font:12px/1.5 var(--ui-mono, monospace);color:var(--ui-text-secondary, #57575d);white-space:pre-wrap',
  );
  out.setAttribute('aria-live', 'off');
  const show = (r: MoodReading) => {
    out.textContent = [
      `mood      ${r.mood ?? 'null'}`,
      `reaction  ${r.reaction.toFixed(2)}   (--mood)`,
      `score     ${r.score.toFixed(2)}   frustrated ${r.scores.frustrated.toFixed(2)} · confused ${r.scores.confused.toFixed(2)} · lost ${r.scores.lost.toFixed(2)}`,
      `fast      ${r.fast.toFixed(2)}   ${r.fastKind ?? '—'}`,
    ].join('\n');
  };
  show(s.mood.reading);
  s.mood.addEventListener('ui-mood-reading', (e) => show((e as CustomEvent<MoodReading>).detail));
  wrap.append(scaleToFit(s.mood), out);
  return wrap;
}

/** A strict date field whose format hint blends in with `--mood`. */
export function formatHint(lang: 'en' | 'ko' = 'en'): HTMLElement {
  const ko = lang === 'ko';
  const mood = document.createElement('ui-mood');
  mood.data = { baselineKey: null };
  const form = h('form', 'display:grid;gap:8px;max-width:360px;margin:0 auto;padding:20px 0');
  const label = h('label', 'display:grid;gap:6px;font-size:13px;color:var(--ui-text-secondary, #57575d)');
  label.append(document.createTextNode(ko ? '생년월일' : 'Date of birth'));
  const input = h(
    'input',
    'height:38px;padding:0 12px;border-radius:10px;border:1px solid var(--ui-border, #e4e4e4);background:var(--ui-surface, #fff);color:var(--ui-text, #18181a);font:inherit;font-size:14px',
  );
  input.name = 'dob';
  input.required = true;
  input.pattern = '\\d{2}\\.\\d{2}\\.\\d{4}';
  input.placeholder = ko ? '예: 1991년 3월 7일' : 'e.g. 7 March 1991';
  label.append(input);
  const hint = h(
    'p',
    'margin:0;font-size:12.5px;color:var(--ui-text, #18181a);opacity:calc(0.25 + 0.75 * var(--mood, 0));transform:translateY(calc((1 - var(--mood, 0)) * 2px));transition:opacity .25s, transform .25s',
    ko ? '일.월.연도를 점으로 적어 주세요 — 07.03.1991' : 'Day, month and year with dots — 07.03.1991',
  );
  const go = h(
    'button',
    'justify-self:start;height:34px;padding:0 14px;border-radius:999px;border:0;background:var(--ui-text, #18181a);color:var(--ui-surface, #fff);font:inherit;font-size:13px;cursor:pointer',
    ko ? '계속' : 'Continue',
  );
  go.type = 'submit';
  const done = h('p', 'margin:0;font-size:12.5px;color:var(--ui-text-secondary, #57575d)');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    done.textContent = ko ? '저장했습니다.' : 'Saved.';
  });
  form.append(label, hint, go, done);
  mood.append(form);
  return mood;
}

const SECTIONS = [
  ['Account', 'Name', 'Email', 'Password'],
  ['Notifications', 'Email digests', 'Mentions', 'Sounds'],
  ['Privacy', 'Profile visibility', 'Activity status'],
  ['Billing', 'Plan', 'Invoices', 'Payment method'],
  ['Language & region', 'Language', 'Time zone', 'Date format'],
  ['Accessibility', 'Reduce motion', 'Larger text'],
  ['Integrations', 'GitHub', 'Slack', 'Calendar'],
  ['Advanced', 'Export data', 'Delete workspace'],
];

/** A long settings page: open section after section without changing anything and the search lifts. */
export function lostSettings(): HTMLElement {
  const mood = document.createElement('ui-mood');
  mood.data = { baselineKey: null };
  const hud = document.createElement('ui-mood-hud');
  const page = h('div', 'display:grid;gap:10px;max-width:420px;margin:0 auto;padding:12px 0');
  const search = h(
    'input',
    'height:36px;padding:0 12px;border-radius:10px;border:1px solid var(--ui-border, #e4e4e4);background:var(--ui-surface, #fff);color:var(--ui-text, #18181a);font:inherit;font-size:13.5px;box-shadow:0 0 0 calc(var(--mood, 0) * 3px) color-mix(in srgb, var(--ui-accent, #1f6dc2) 45%, transparent);transition:box-shadow .25s',
  );
  search.type = 'search';
  search.placeholder = 'Search settings';
  search.setAttribute('aria-label', 'Search settings');
  const tip = h(
    'p',
    'margin:0;font-size:12.5px;color:var(--ui-text-secondary, #57575d);opacity:var(--mood, 0);transition:opacity .25s',
    'Looking for something? Type it here.',
  );
  const list = h('div', 'display:grid;gap:6px;max-height:280px;overflow:auto;padding-right:4px');
  for (const [title, ...rows] of SECTIONS) {
    const d = h(
      'details',
      'border:1px solid var(--ui-border, #e4e4e4);border-radius:10px;padding:8px 12px;background:var(--ui-surface, #fff)',
    );
    const sum = h('summary', 'cursor:pointer;font-size:13.5px;color:var(--ui-text, #18181a)', title);
    d.append(sum);
    for (const r of rows) {
      const row = h(
        'label',
        'display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:13px;color:var(--ui-text-secondary, #57575d)',
        r,
      );
      const sw = h('input');
      sw.type = 'checkbox';
      row.append(sw);
      d.append(row);
    }
    list.append(d);
  }
  page.append(search, tip, list);
  hud.append(page);
  mood.append(hud);
  return mood;
}
