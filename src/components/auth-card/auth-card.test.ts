import { afterEach, describe, expect, it } from 'vitest';
import tokens from '../../core/tokens.json';
import {
  type AuthCardData,
  type AuthConfirmDetail,
  type AuthNavigateDetail,
  type AuthProviderDetail,
  authCardHtml,
  authCardMarkup,
  authInitials,
  authInline,
  authStateJson,
  type UiAuthCard,
} from './auth-card';
import { styles } from './styles';

function mount(data: AuthCardData | undefined, attrs: Record<string, string> = {}): UiAuthCard {
  const el = document.createElement('ui-auth-card') as UiAuthCard;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiAuthCard, s: string) => el.shadowRoot!.querySelector<E>(s);
const qa = <E extends Element = HTMLElement>(el: UiAuthCard, s: string) =>
  Array.from(el.shadowRoot!.querySelectorAll<E>(s));
function listen<T>(el: Element, name: string, prevent = false): T[] {
  const got: T[] = [];
  el.addEventListener(name, (e) => {
    got.push((e as CustomEvent<T>).detail);
    if (prevent) e.preventDefault();
  });
  return got;
}
/** Click and report whether the default action (the link's navigation) survived. */
function click(el: Element, init: MouseEventInit = {}): boolean {
  const ev = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, ...init });
  el.dispatchEvent(ev);
  return !ev.defaultPrevented;
}

const SIGN_IN: AuthCardData = {
  brand: { label: 'Workbench', mark: true, href: '/' },
  title: 'Sign in',
  text: 'Use your work account.',
  providers: [
    { id: 'google', label: 'Continue with Google', href: '/auth/google', logo: '/logos/google.png' },
    { id: 'sso', label: 'Continue with SSO', href: 'https://sso.example.com/start', icon: 'shield' as never },
  ],
  hint: 'Or type `login` in a chat thread to get a one-time link.',
  finePrint: 'By continuing you agree to the terms.',
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('helpers', () => {
  it('derives initials from a name or an email', () => {
    expect(authInitials('Mina Park')).toBe('MP');
    expect(authInitials('ada.lovelace@example.com')).toBe('AL');
    expect(authInitials('김민아')).toBe('김');
    expect(authInitials('')).toBe('?');
  });

  it('escapes inline text and sets backtick spans in code', () => {
    expect(authInline('type `<b>x</b>` then <i>go</i>')).toBe(
      'type <code>&lt;b&gt;x&lt;/b&gt;</code> then &lt;i&gt;go&lt;/i&gt;',
    );
    expect(authInline('no code')).toBe('no code');
  });

  it('serialises state so a </script> inside cannot close the script', () => {
    const json = authStateJson({ title: '</script><script>alert(1)</script>', error: '<!-- x' });
    expect(json).not.toContain('<');
    expect(JSON.parse(json).title).toBe('</script><script>alert(1)</script>');
  });
});

describe('<ui-auth-card> sign in', () => {
  it('renders brand, title, text, provider links, the hint under "or" and the fine print', () => {
    const el = mount(SIGN_IN);
    expect(q(el, '.ac-brand')?.textContent).toContain('Workbench');
    expect(q(el, '.ac-brand')?.getAttribute('href')).toBe('/');
    expect(q(el, '.ac-mark svg')).toBeTruthy();
    expect(q(el, 'h1.ac-title')?.textContent).toBe('Sign in');
    const links = qa<HTMLAnchorElement>(el, 'a.ac-provider');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/auth/google', 'https://sso.example.com/start']);
    expect(links[0].querySelector('img')?.getAttribute('src')).toBe('/logos/google.png');
    expect(links[0].querySelector('slot[name="logo-google"]')).toBeTruthy();
    expect(q(el, '.ac-divider')?.textContent).toBe('or');
    expect(q(el, '.ac-hint code')?.textContent).toBe('login');
    expect(q(el, '.ac-fine')?.textContent).toBe('By continuing you agree to the terms.');
  });

  it('never draws a script URL or an svg data URL', () => {
    const el = mount({
      brand: { label: 'B', href: 'javascript:alert(1)' },
      providers: [
        { id: 'x', label: 'X', href: 'javascript:alert(1)', logo: 'data:image/svg+xml,<svg onload=alert(1)>' },
      ],
    });
    expect(q(el, '.ac-brand')?.getAttribute('href')).toBe('#');
    expect(q(el, 'a.ac-provider')?.getAttribute('href')).toBe('#');
    expect(q(el, 'a.ac-provider img')).toBeNull();
  });

  it('escapes every string', () => {
    const evil = '<img src=x onerror=alert(1)>';
    const el = mount({
      brand: { label: evil },
      title: evil,
      text: evil,
      error: evil,
      providers: [{ id: `"><b>`, label: evil, href: '/a' }],
      hint: evil,
      finePrint: evil,
      account: {
        name: evil,
        meta: evil,
        initials: evil,
        continue: { href: '/', label: evil },
        signOut: { href: '/o', label: evil },
      },
      switchLabel: evil,
    });
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    expect(el.shadowRoot!.querySelector('b')).toBeNull();
    expect(el.shadowRoot!.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('asks before a provider sign-in, then holds the card in place ("Redirecting…")', () => {
    const el = mount(SIGN_IN);
    const got = listen<AuthProviderDetail>(el, 'ui-provider');
    const [google, sso] = qa(el, 'a.ac-provider');
    expect(click(google)).toBe(true);
    expect(got).toEqual([{ id: 'google', href: '/auth/google' }]);
    expect(google.getAttribute('aria-busy')).toBe('true');
    expect(google.querySelector('.ac-wait')?.textContent).toBe('Redirecting…');
    expect(sso.getAttribute('aria-disabled')).toBe('true');
    expect(el.busy).toBe(true);
    // A second press while one is on its way goes nowhere.
    expect(click(sso)).toBe(false);
    expect(got).toHaveLength(1);
    // Back through the back/forward cache: the card is free again.
    const show = new Event('pageshow') as PageTransitionEvent;
    Object.defineProperty(show, 'persisted', { value: true });
    window.dispatchEvent(show);
    expect(google.hasAttribute('aria-busy')).toBe(false);
    expect(el.busy).toBe(false);
  });

  it('lets the host take the sign-in (preventDefault keeps the page and the card free)', () => {
    const el = mount(SIGN_IN);
    listen<AuthProviderDetail>(el, 'ui-provider', true);
    const google = q(el, 'a.ac-provider')!;
    expect(click(google)).toBe(false);
    expect(google.hasAttribute('aria-busy')).toBe(false);
  });

  it('does not hold the card for a new-tab click', () => {
    const el = mount(SIGN_IN);
    const google = q(el, 'a.ac-provider')!;
    expect(click(google, { metaKey: true })).toBe(true);
    expect(google.hasAttribute('aria-busy')).toBe(false);
  });

  it('shows the error as an alert', () => {
    const el = mount({ ...SIGN_IN, error: 'Sign-in was cancelled.' });
    const alert = q(el, '[role="alert"]');
    expect(alert?.textContent).toBe('Sign-in was cancelled.');
    expect(alert?.querySelector('svg')).toBeTruthy();
  });
});

describe('<ui-auth-card> signed in', () => {
  const DATA: AuthCardData = {
    ...SIGN_IN,
    title: undefined,
    text: undefined,
    account: {
      name: 'Mina Park',
      meta: 'mina@example.com · via Google',
      continue: { href: '/app' },
      signOut: { href: '/logout' },
    },
  };

  it('puts the account first with Continue (ink) and Sign out, then the providers under "Use a different account"', () => {
    const el = mount(DATA);
    expect(q(el, '.ac-account .ac-name')?.textContent).toBe('Mina Park');
    expect(q(el, '.ac-av')?.textContent).toBe('MP');
    expect(q(el, 'a.ac-btn.is-primary')?.textContent).toBe('Continue');
    expect(q(el, 'a.ac-btn.is-primary')?.getAttribute('href')).toBe('/app');
    expect(q(el, 'a[data-act="sign-out"]')?.textContent).toBe('Sign out');
    expect(qa(el, '.ac-divider').map((d) => d.textContent)).toEqual(['Use a different account', 'or']);
    expect(qa(el, '.ac-btn.is-primary')).toHaveLength(1);
  });

  it('reports its own links on ui-navigate, cancelable', () => {
    const el = mount(DATA);
    const got = listen<AuthNavigateDetail>(el, 'ui-navigate', true);
    expect(click(q(el, 'a[data-act="sign-out"]')!)).toBe(false);
    expect(click(q(el, 'a[data-act="continue"]')!)).toBe(false);
    expect(got).toEqual([
      { id: 'sign-out', href: '/logout' },
      { id: 'continue', href: '/app' },
    ]);
  });

  it('speaks Korean with lang="ko"', () => {
    const el = mount(DATA, { lang: 'ko' });
    expect(q(el, '.ac-account .ac-label-sm')?.textContent).toBe('로그인한 계정');
    expect(q(el, 'a[data-act="continue"]')?.textContent).toBe('계속');
    expect(qa(el, '.ac-divider').map((d) => d.textContent)).toEqual(['다른 계정 사용', '또는']);
    expect(q(el, 'a.ac-provider .ac-wait')?.textContent).toBe('이동 중…');
  });
});

describe('<ui-auth-card> confirm a session switch', () => {
  const DATA: AuthCardData = {
    title: 'Switch accounts?',
    text: 'This replaces your current session on this browser.',
    confirm: {
      from: { name: 'Mina Park', meta: 'mina@example.com' },
      to: { name: 'Jon Lee', meta: 'jon@example.com' },
      action: '/auth/switch',
      fields: { token: 'abc"123' },
      cancelHref: '/app',
    },
  };

  it('draws both sessions and a real form with the hidden fields', () => {
    const el = mount(DATA);
    expect(qa(el, '.ac-session .ac-name').map((n) => n.textContent)).toEqual(['Mina Park', 'Jon Lee']);
    const form = q<HTMLFormElement>(el, 'form');
    expect(form?.getAttribute('method')).toBe('post');
    expect(form?.getAttribute('action')).toBe('/auth/switch');
    const token = q<HTMLInputElement>(el, 'input[name="token"]');
    expect(token?.type).toBe('hidden');
    expect(token?.value).toBe('abc"123');
    expect(q(el, 'button[type="submit"]')?.textContent).toContain('Continue as Jon Lee');
    expect(q(el, 'a[data-act="cancel"]')?.getAttribute('href')).toBe('/app');
    expect(q(el, '.ac-provider')).toBeNull();
  });

  it('asks before submitting; prevented, nothing posts', () => {
    const el = mount(DATA);
    const got = listen<AuthConfirmDetail>(el, 'ui-confirm', true);
    const form = q<HTMLFormElement>(el, 'form')!;
    const ev = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(got).toEqual([{ action: '/auth/switch', fields: { token: 'abc"123' } }]);
    expect(q(el, 'button[type="submit"]')?.hasAttribute('aria-busy')).toBe(false);
  });

  it('lets the form post and shows "Switching…" when the host does not take it', () => {
    const el = mount(DATA);
    listen<AuthConfirmDetail>(el, 'ui-confirm');
    const form = q<HTMLFormElement>(el, 'form')!;
    const ev = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    const submit = q(el, 'button[type="submit"]')!;
    expect(submit.getAttribute('aria-busy')).toBe('true');
    expect(submit.querySelector('.ac-wait')?.textContent).toBe('Switching…');
    expect(q(el, 'a[data-act="cancel"]')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('makes Cancel a button without a link and reports it', () => {
    const el = mount({ ...DATA, confirm: { ...DATA.confirm!, cancelHref: undefined, method: 'get' } });
    const got = listen<AuthNavigateDetail>(el, 'ui-navigate');
    const cancel = q(el, 'button[data-act="cancel"]')!;
    click(cancel);
    expect(got).toEqual([{ id: 'cancel', href: null }]);
    expect(q(el, 'form')?.getAttribute('method')).toBe('get');
  });
});

describe('server-side markup', () => {
  it('the server markup writes only a known theme', () => {
    expect(authCardHtml(SIGN_IN, { theme: 'dark' })).toContain(' theme="dark"');
    const bad = authCardHtml(SIGN_IN, { theme: '"><script>alert(1)</script>' as unknown as 'dark' });
    expect(bad.slice(0, bad.indexOf('>') + 1)).toBe('<ui-auth-card lang="en">');
    expect(bad).not.toContain('<script>alert');
  });

  it('emits a declarative shadow root with the styles, the card and the state', () => {
    const html = authCardHtml(SIGN_IN, { lang: 'ko', page: true });
    expect(html.startsWith('<ui-auth-card lang="ko" page>')).toBe(true);
    expect(html).toContain('<template shadowrootmode="open"><style>');
    expect(html).toContain(authCardMarkup(SIGN_IN, 'ko'));
    expect(html).toContain('<script type="application/json" data-auth-state>');
    expect(html).toContain('href="/auth/google"');
  });

  it('upgrades in place from the state the page carries', () => {
    const box = document.createElement('div');
    box.innerHTML = `<ui-auth-card><script type="application/json" data-auth-state>${authStateJson(SIGN_IN)}</script></ui-auth-card>`;
    document.body.append(box);
    const el = box.querySelector('ui-auth-card') as UiAuthCard;
    el.renderNow();
    expect(el.data?.title).toBe('Sign in');
    expect(qa(el, 'a.ac-provider')).toHaveLength(2);
  });

  it('survives a broken state script', () => {
    const box = document.createElement('div');
    box.innerHTML = '<ui-auth-card><script type="application/json">{nope</script></ui-auth-card>';
    document.body.append(box);
    const el = box.querySelector('ui-auth-card') as UiAuthCard;
    el.renderNow();
    expect(el.data).toBeUndefined();
    expect(q(el, '.ac-card')).toBeTruthy();
  });
});

describe('styles', () => {
  it('uses tokens only, an ink primary and 44px buttons', () => {
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(styles).not.toMatch(/\brgba?\(/i);
    expect(styles).toContain('.ac-btn.is-primary { background: var(--ib-text);');
    expect(styles).toContain('min-height: 44px');
    const known = new Set([...Object.keys(tokens.light), ...Object.keys(tokens.shared), 'ac-width']);
    for (const m of styles.matchAll(/var\(--([a-z0-9-]+)/g)) expect(known.has(m[1]), m[1]).toBe(true);
  });

  it('never moves on hover', () => {
    const hover = styles.slice(styles.indexOf('@media (hover: hover)'));
    expect(hover.slice(0, hover.indexOf('\n}\n'))).not.toMatch(/transform|translate|scale\(/);
  });
});
