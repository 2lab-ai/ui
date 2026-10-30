import { define, UiElement } from '../../core/element';
import { morphInto } from '../../core/morph';
import {
  type AuthCardData,
  type AuthConfirmDetail,
  type AuthNavigateDetail,
  type AuthProviderDetail,
  authCardMarkup,
} from './markup';
import { styles } from './styles';

export type {
  AuthAccount,
  AuthCardData,
  AuthConfirm,
  AuthConfirmDetail,
  AuthLang,
  AuthLink,
  AuthNavigateDetail,
  AuthProvider,
  AuthProviderDetail,
  AuthSignedIn,
  AuthStrings,
} from './markup';
export {
  authCardCss,
  authCardHtml,
  authCardMarkup,
  authInitials,
  authInline,
  authStateJson,
  authStrings,
} from './markup';

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

  /**
   * Patch the live card instead of replacing it: the `.ac-card` node (and its entrance animation) survives a
   * re-render — new data after the upgrade, an error line arriving, a language switch — so the card never fades in
   * twice; a server-drawn card (declarative shadow root) is hydrated the same way.
   */
  protected override update(): void {
    morphInto(this.content, this.render());
    this.updated();
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
    // Both events sound whether or not the host takes them over: cancelling is how it starts a sign-in popup or
    // routes in-app, so the person still went somewhere.
    if (act === 'provider') {
      const id = el.dataset.id ?? '';
      const sent = this.emit<AuthProviderDetail>('ui-provider', { id, href: href ?? '#' });
      // A new tab is the browser's, not this page going somewhere (as on the app bar).
      if (!newTab) this.sound('navigate', undefined, e);
      if (!sent) {
        e.preventDefault();
        return;
      }
      if (!newTab) this.#hold(el);
      return;
    }
    if (act === 'brand' || act === 'continue' || act === 'sign-out' || act === 'cancel') {
      if (!this.emit<AuthNavigateDetail>('ui-navigate', { id: act, href })) e.preventDefault();
      this.sound('navigate', undefined, e);
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
    // No event: a submit tells nothing of what pressed the button.
    this.sound('tap');
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
