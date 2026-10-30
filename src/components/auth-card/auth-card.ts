import { define, UiElement } from '../../core/element';
import { esc, escAttr, safeLink, safeSrc } from '../../core/html';
import { baseCss } from '../../core/tokens';
import { type IconName, icon } from '../../icons/icons';
import { styles } from './styles';

export type AuthLang = 'en' | 'ko';

/** One way to sign in: a full-width button that is a real link (it works before, and without, the script). */
export interface AuthProvider {
  /** Stable id; `ui-provider` carries it back, and slot `logo-<id>` takes the host's own logo. */
  id: string;
  /** The button's words ("Continue with Google"). */
  label: string;
  /** Where the sign-in starts: http(s) or a same-site URL. Anything else draws `#`. */
  href: string;
  /** A glyph from `@2lab.ai/ui/icons`. */
  icon?: IconName;
  /** A logo image (http(s), same-site or a raster data URL). For a multi-colour SVG use slot `logo-<id>`. */
  logo?: string;
}

/** Someone's session: who, and a quiet line under the name (email, provider). */
export interface AuthAccount {
  name: string;
  meta?: string;
  /** Avatar letters. Default: from the name (`authInitials`). */
  initials?: string;
}

/** A link action in the card (continue, sign out, cancel). */
export interface AuthLink {
  href?: string;
  label?: string;
}

/** Signed in already: the account, then "Continue" (the ink primary) and "Sign out". */
export interface AuthSignedIn extends AuthAccount {
  continue?: AuthLink;
  signOut?: AuthLink;
}

/** Replace one session with another: the session you leave, the one you get, then Cancel · Continue as …. */
export interface AuthConfirm {
  /** The session that ends. */
  from?: AuthAccount;
  /** The session that starts. */
  to: AuthAccount;
  /** The form posts here (a real `<form>`, so it works without the script). */
  action: string;
  method?: 'post' | 'get';
  /** Hidden fields the form sends (a one-time token …). */
  fields?: Record<string, string>;
  /** Default "Continue as <name>". */
  confirmLabel?: string;
  /** Default "Cancel". */
  cancelLabel?: string;
  /** Where Cancel goes. Without it Cancel is a button (`ui-navigate` with `href: null`). */
  cancelHref?: string;
}

export interface AuthCardData {
  /** The product above the card: a word, optionally a glyph tile (`true` = the library's mark) and a link. */
  brand?: { label: string; mark?: boolean | IconName; href?: string };
  /** The card's heading ("Sign in", "Switch accounts?"). */
  title?: string;
  /** One short paragraph under the heading. `code` in backticks is set in mono. */
  text?: string;
  /** Why the last attempt failed — an alert line at the top of the card. */
  error?: string;
  /** Signed in already: the account block comes first and the providers follow under `switchLabel`. */
  account?: AuthSignedIn;
  /** The sign-in buttons, in order. */
  providers?: AuthProvider[];
  /** The divider above the providers when `account` is set. Default "Use a different account". */
  switchLabel?: string;
  /** A line after the providers, under an "or" divider (another way in). `code` in backticks is set in mono. */
  hint?: string;
  /** The session-switch variant (replaces account / providers / hint). */
  confirm?: AuthConfirm;
  /** Small print under the card (terms, a help link's words). Slot `fine-print` takes rich content. */
  finePrint?: string;
}

/** `ui-provider` detail (cancelable: prevent it to start the sign-in yourself, e.g. in a popup). */
export interface AuthProviderDetail {
  id: string;
  href: string;
}

/** `ui-navigate` detail (cancelable): one of the card's own links. `href` is null for a Cancel without a link. */
export interface AuthNavigateDetail {
  id: 'brand' | 'continue' | 'sign-out' | 'cancel';
  href: string | null;
}

/** `ui-confirm` detail (cancelable: prevent it to post yourself; otherwise the form submits). */
export interface AuthConfirmDetail {
  action: string;
  fields: Record<string, string>;
}

const STRINGS = {
  en: {
    signedInAs: 'Signed in as',
    continue: 'Continue',
    signOut: 'Sign out',
    or: 'or',
    useDifferent: 'Use a different account',
    redirecting: 'Redirecting…',
    leaving: 'Signed in now',
    next: 'New session',
    cancel: 'Cancel',
    continueAs: (name: string) => `Continue as ${name}`,
    switching: 'Switching…',
  },
  ko: {
    signedInAs: '로그인한 계정',
    continue: '계속',
    signOut: '로그아웃',
    or: '또는',
    useDifferent: '다른 계정 사용',
    redirecting: '이동 중…',
    leaving: '지금 로그인한 계정',
    next: '새 세션',
    cancel: '취소',
    continueAs: (name: string) => `${name}(으)로 계속`,
    switching: '전환 중…',
  },
};

export type AuthStrings = (typeof STRINGS)['en'];

export function authStrings(lang: unknown): AuthStrings {
  return lang === 'ko' ? STRINGS.ko : STRINGS.en;
}

/** Avatar letters: the first letter of up to two words of the name (an email's part before @). "?" for none. */
export function authInitials(name: unknown): string {
  let s = String(name ?? '').trim();
  const at = s.indexOf('@');
  if (at > 0) s = s.slice(0, at);
  const words = s.split(/[\s._+-]+/).filter(Boolean);
  const letters = words.slice(0, 2).map((w) => Array.from(w)[0] ?? '');
  return letters.join('').toUpperCase() || '?';
}

/** Plain text with `code` spans: everything escaped, backtick pairs become <code>. */
export function authInline(text: unknown): string {
  return String(text ?? '')
    .split(/(`[^`\n]+`)/)
    .map((part) => (/^`[^`\n]+`$/.test(part) ? `<code>${esc(part.slice(1, -1))}</code>` : esc(part)))
    .join('');
}

function avatar(a: AuthAccount, small = false): string {
  const letters = String(a.initials ?? '').trim() || authInitials(a.name);
  return `<span class="ac-av${small ? ' is-sm' : ''}" aria-hidden="true">${esc(letters)}</span>`;
}

function who(a: AuthAccount): string {
  return `<div class="ac-who-text"><p class="ac-name">${esc(a.name)}</p>${a.meta ? `<p class="ac-meta">${esc(a.meta)}</p>` : ''}</div>`;
}

function spinner(t: string): string {
  return `<span class="ac-spin" aria-hidden="true"></span><span class="ac-wait">${esc(t)}</span>`;
}

function providerIcon(p: AuthProvider): string {
  const id = String(p.id ?? '');
  const src = p.logo ? safeSrc(p.logo) : '';
  const own = src ? `<img src="${src}" alt="" width="18" height="18" />` : p.icon ? icon(p.icon, { size: 18 }) : '';
  // The host may slot its own logo (a multi-colour SVG) as `slot="logo-<id>"`; the built-in one is the fallback.
  return `<span class="ac-ico"><slot name="logo-${escAttr(id)}">${own}</slot></span>`;
}

function providersHtml(list: AuthProvider[], t: AuthStrings): string {
  return list
    .map(
      (p) =>
        `<a class="ac-btn ac-provider" href="${safeLink(p.href)}" data-act="provider" data-id="${escAttr(p.id)}" data-key="p:${escAttr(p.id)}">${providerIcon(p)}<span class="ac-label">${esc(p.label)}</span>${spinner(t.redirecting)}</a>`,
    )
    .join('');
}

function confirmHtml(c: AuthConfirm, t: AuthStrings): string {
  const fields = Object.entries(c.fields ?? {})
    .map(([k, v]) => `<input type="hidden" name="${escAttr(k)}" value="${escAttr(v)}" />`)
    .join('');
  const method = c.method === 'get' ? 'get' : 'post';
  const sessions = `<ul class="ac-sessions">${
    c.from
      ? `<li class="ac-session">${avatar(c.from, true)}<div class="ac-who-text"><p class="ac-label-sm">${esc(t.leaving)}</p><p class="ac-name">${esc(c.from.name)}</p>${c.from.meta ? `<p class="ac-meta">${esc(c.from.meta)}</p>` : ''}</div></li>`
      : ''
  }<li class="ac-session is-next">${avatar(c.to, true)}<div class="ac-who-text"><p class="ac-label-sm">${esc(t.next)}</p><p class="ac-name">${esc(c.to.name)}</p>${c.to.meta ? `<p class="ac-meta">${esc(c.to.meta)}</p>` : ''}</div>${icon('arrow-right', { size: 14, class: 'ac-arrow' })}</li></ul>`;
  const cancelLabel = c.cancelLabel || t.cancel;
  const cancel = c.cancelHref
    ? `<a class="ac-btn" href="${safeLink(c.cancelHref)}" data-act="cancel" data-key="cancel">${esc(cancelLabel)}</a>`
    : `<button type="button" class="ac-btn" data-act="cancel" data-key="cancel">${esc(cancelLabel)}</button>`;
  const label = c.confirmLabel || t.continueAs(c.to.name);
  return `${sessions}<form class="ac-form" method="${method}" action="${safeLink(c.action)}">${fields}<div class="ac-actions">${cancel}<button type="submit" class="ac-btn is-primary" data-key="confirm"><span class="ac-label">${esc(label)}</span>${spinner(t.switching)}</button></div></form>`;
}

/** The card's markup (shared by the element and the server-side `authCardHtml`). */
export function authCardMarkup(data: AuthCardData | undefined, lang: unknown = 'en'): string {
  const d = data ?? {};
  const t = authStrings(lang);
  const brand = d.brand?.label
    ? (() => {
        const mark = d.brand.mark
          ? `<span class="ac-mark" aria-hidden="true">${icon(d.brand.mark === true ? 'brand' : d.brand.mark, { size: 16 })}</span>`
          : '';
        const inner = `${mark}<span>${esc(d.brand.label)}</span>`;
        return d.brand.href
          ? `<a class="ac-brand" href="${safeLink(d.brand.href)}" data-act="brand" data-key="brand">${inner}</a>`
          : `<span class="ac-brand">${inner}</span>`;
      })()
    : '<slot name="brand"></slot>';
  const head =
    d.title || d.text
      ? `<header class="ac-head">${d.title ? `<h1 class="ac-title">${esc(d.title)}</h1>` : ''}${d.text ? `<p class="ac-text">${authInline(d.text)}</p>` : ''}<slot name="body"></slot></header>`
      : '<slot name="body"></slot>';
  const error = d.error
    ? `<div class="ac-error" role="alert">${icon('alert', { size: 14 })}<span>${esc(d.error)}</span></div>`
    : '';
  let body: string;
  if (d.confirm) {
    body = confirmHtml(d.confirm, t);
  } else {
    const providers = Array.isArray(d.providers) ? d.providers.filter((p) => p && p.id) : [];
    const hint = d.hint ? `<p class="ac-hint">${authInline(d.hint)}</p>` : '';
    const signIn = providers.length
      ? `${providersHtml(providers, t)}${hint ? `<div class="ac-divider"><span>${esc(t.or)}</span></div>${hint}` : ''}`
      : hint;
    if (d.account) {
      const a = d.account;
      const cont = `<a class="ac-btn is-primary" href="${safeLink(a.continue?.href ?? '/')}" data-act="continue" data-key="continue">${esc(a.continue?.label || t.continue)}</a>`;
      const out = a.signOut
        ? `<a class="ac-btn is-quiet" href="${safeLink(a.signOut.href ?? '#')}" data-act="sign-out" data-key="sign-out">${esc(a.signOut.label || t.signOut)}</a>`
        : '';
      body = `<section class="ac-account" aria-label="${escAttr(t.signedInAs)}"><p class="ac-label-sm">${esc(t.signedInAs)}</p><div class="ac-who">${avatar(a)}${who(a)}</div>${cont}${out}</section>${
        signIn ? `<div class="ac-divider"><span>${esc(d.switchLabel || t.useDifferent)}</span></div>${signIn}` : ''
      }`;
    } else body = signIn;
  }
  const fine = d.finePrint ? `<p class="ac-fine">${authInline(d.finePrint)}</p>` : '';
  return `<div class="ac">${brand}<div class="ac-card">${head}${error}${body}<slot></slot></div>${fine}<slot name="fine-print"></slot></div>`;
}

/** JSON for a `<script type="application/json">` body: `<` is escaped so `</script>` and `<!--` cannot occur. */
export function authStateJson(data: AuthCardData): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/**
 * Server-side markup for a page that works before (and without) the script: the element with a declarative
 * shadow root (`<template shadowrootmode="open">`) holding the styles and the card, plus the data as JSON so the
 * element takes over in place once `@2lab.ai/ui/auth-card` loads. Provider buttons are real links and the confirm
 * variant a real `<form>`, so both work with JavaScript off.
 */
export function authCardHtml(
  data: AuthCardData,
  opts: { lang?: AuthLang; page?: boolean; theme?: 'light' | 'dark' } = {},
): string {
  const lang = opts.lang === 'ko' ? 'ko' : 'en';
  // Only the two known themes reach the markup: this string is written into a server-rendered page.
  const theme = opts.theme === 'dark' || opts.theme === 'light' ? opts.theme : '';
  const hostAttrs = `lang="${lang}"${opts.page ? ' page' : ''}${theme ? ` theme="${theme}"` : ''}`;
  return `<ui-auth-card ${hostAttrs}><template shadowrootmode="open"><style>${baseCss}\n${styles}</style><div part="root" class="ui-root">${authCardMarkup(data, lang)}</div></template><script type="application/json" data-auth-state>${authStateJson(data)}</script></ui-auth-card>`;
}

/**
 * `<ui-auth-card>` — a centred card for the pages around an app: sign in with providers, the signed-in account
 * with continue / sign out, or confirm switching to another session. Attributes: `lang` (en | ko), `page` (fill the
 * viewport and centre on the page colour), `theme`. Slots: `brand`, `body`, default (under the card's content),
 * `fine-print`, `logo-<provider id>`.
 */
export class UiAuthCard extends UiElement<AuthCardData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return ['lang'];
  }

  #busy = false;
  #onShow = (e: PageTransitionEvent) => {
    // Back from the provider through the back/forward cache: the buttons must not stay "Redirecting…".
    if (e.persisted) this.#reset();
  };

  constructor() {
    super();
    this.root.addEventListener('click', (e) => this.#onClick(e as MouseEvent));
    this.root.addEventListener('submit', (e) => this.#onSubmit(e as SubmitEvent));
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override connectedCallback(): void {
    // Server-rendered (`authCardHtml`): take the data from the JSON the page carries.
    if (this.data === undefined && !Object.hasOwn(this, 'data')) {
      const script = Array.from(this.children).find(
        (c) => c.localName === 'script' && c.getAttribute('type') === 'application/json',
      );
      if (script) {
        try {
          this.data = JSON.parse(script.textContent || 'null') ?? undefined;
        } catch {
          // A broken state script draws the empty card rather than throwing from a page's upgrade.
        }
      }
    }
    if (typeof window !== 'undefined') window.addEventListener('pageshow', this.#onShow);
    super.connectedCallback();
  }

  override disconnectedCallback(): void {
    if (typeof window !== 'undefined') window.removeEventListener('pageshow', this.#onShow);
    super.disconnectedCallback();
  }

  /** A sign-in or a switch is on its way (the button shows "Redirecting…" / "Switching…"). */
  get busy(): boolean {
    return this.#busy;
  }

  protected render(): string {
    this.#busy = false;
    return authCardMarkup(this.data, this.getAttribute('lang'));
  }

  /** Mark one control busy and the rest unavailable — in place, so a link's navigation is never disturbed. */
  #hold(target: HTMLElement): void {
    this.#busy = true;
    for (const el of this.$$<HTMLElement>('.ac-btn')) {
      if (el === target) el.setAttribute('aria-busy', 'true');
      else el.setAttribute('aria-disabled', 'true');
    }
  }

  #reset(): void {
    this.#busy = false;
    for (const el of this.$$<HTMLElement>('.ac-btn')) {
      el.removeAttribute('aria-busy');
      el.removeAttribute('aria-disabled');
    }
  }

  #onClick(e: MouseEvent): void {
    const el = (e.target as Element | null)?.closest?.<HTMLElement>('[data-act]');
    if (!el) return;
    if (this.#busy) {
      e.preventDefault();
      return;
    }
    // A new tab / window is not this page leaving: let the browser do it, and do not hold the card.
    const newTab = e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1;
    const act = el.dataset.act;
    const href = el.getAttribute('href');
    if (act === 'provider') {
      const id = el.dataset.id ?? '';
      if (!this.emit<AuthProviderDetail>('ui-provider', { id, href: href ?? '#' })) {
        e.preventDefault();
        return;
      }
      if (!newTab) this.#hold(el);
      return;
    }
    if (act === 'brand' || act === 'continue' || act === 'sign-out' || act === 'cancel') {
      if (!this.emit<AuthNavigateDetail>('ui-navigate', { id: act, href })) e.preventDefault();
    }
  }

  #onSubmit(e: SubmitEvent): void {
    const form = e.target as HTMLFormElement | null;
    if (!form || this.#busy) {
      e.preventDefault();
      return;
    }
    const c = this.data?.confirm;
    const detail: AuthConfirmDetail = { action: form.getAttribute('action') ?? '', fields: { ...(c?.fields ?? {}) } };
    if (!this.emit<AuthConfirmDetail>('ui-confirm', detail)) {
      e.preventDefault();
      return;
    }
    const submit = this.$<HTMLElement>('button[type="submit"]');
    if (submit) this.#hold(submit);
  }
}

define('ui-auth-card', UiAuthCard);

declare global {
  interface HTMLElementTagNameMap {
    'ui-auth-card': UiAuthCard;
  }
}
