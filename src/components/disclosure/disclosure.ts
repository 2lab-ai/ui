import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { attrs, esc } from '../../core/html';
import { morphInto } from '../../core/morph';
import { icon } from '../../icons/icons';
import { styles } from './styles';

export interface DisclosureData {
  /** The summary row's text (or slot `summary`). */
  summary?: string;
  /** Quiet text at the end of the row — a count, a time (or slot `meta`). */
  meta?: string;
  /** The row does not toggle (aria-disabled). */
  disabled?: boolean;
}

/** `ui-toggle` detail: the state the person asked for. */
export interface DisclosureToggle {
  open: boolean;
}

/**
 * `<ui-disclosure>` — a summary row that shows or hides a region: the chevron turns, the region grows from 0fr to
 * 1fr with a fade, and while closed it is inert (nothing inside takes focus or clicks). Toggling sends a cancelable
 * `ui-toggle`; the `open` attribute / property set by the host changes state without an event.
 */
export class UiDisclosure extends UiElement<DisclosureData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['open', 'summary', 'meta', 'level'];
  }

  #open = false;
  #reflecting = false;
  /** The region finished opening (stops clipping). */
  #settled = false;
  /** Rendered once: before that a state is drawn as is, without a transition to wait for. */
  #painted = false;

  constructor() {
    super();
    this.root.addEventListener('click', (e) => this.#onClick(e));
    this.root.addEventListener('transitionend', (e) => this.#onTransitionEnd(e as TransitionEvent));
  }

  get open(): boolean {
    return this.#open;
  }

  set open(v: boolean) {
    this.#set(!!v);
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === 'open') {
      if (!this.#reflecting) this.#set(value !== null);
      return;
    }
    this.requestRender();
  }

  /** Open or close without an event. Opened before the first paint or under reduced motion: settled at once. */
  #set(v: boolean): void {
    if (v === this.#open) return;
    this.#open = v;
    this.#settled = v && (!this.#painted || prefersReducedMotion());
    this.#reflecting = true;
    this.toggleAttribute('open', v);
    this.#reflecting = false;
    this.requestRender();
  }

  /** The person asked to toggle: a cancelable `ui-toggle`, then the change unless a listener cancelled it. */
  toggle(): void {
    if (this.data?.disabled) return;
    const next = !this.#open;
    const detail: DisclosureToggle = { open: next };
    if (this.emit('ui-toggle', detail)) this.#set(next);
  }

  protected override update(): void {
    morphInto(this.content, this.render());
    this.updated();
  }

  protected render(): string {
    const d = this.data;
    const summary = d?.summary ?? this.getAttribute('summary') ?? '';
    const meta = d?.meta ?? this.getAttribute('meta') ?? '';
    const level = Number(this.getAttribute('level'));
    const head = `<button${attrs({
      type: 'button',
      class: 'dc-head',
      id: 'dc-head',
      part: 'summary',
      'aria-expanded': String(this.#open),
      'aria-controls': 'dc-region',
      'aria-disabled': d?.disabled ? 'true' : undefined,
    })}>${icon('chevron-right', { class: 'dc-chev', size: 12 })}<span class="dc-summary"><slot name="summary">${esc(
      summary,
    )}</slot></span><span class="dc-meta"><slot name="meta">${esc(meta)}</slot></span></button>`;
    const wrapped =
      level >= 1 && level <= 6 ? `<div class="dc-heading" role="heading" aria-level="${level}">${head}</div>` : head;
    return `<div${attrs({ class: 'dc', 'data-open': this.#open, 'data-settled': this.#open && this.#settled })}>${wrapped}<div${attrs(
      {
        class: 'dc-region',
        id: 'dc-region',
        part: 'region',
        inert: !this.#open,
      },
    )}><div class="dc-inner"><div class="dc-body" part="body"><slot></slot></div></div></div></div>`;
  }

  protected override updated(): void {
    this.#painted = true;
  }

  #onClick(e: Event): void {
    if ((e.target as Element | null)?.closest?.('.dc-head')) this.toggle();
  }

  #onTransitionEnd(e: TransitionEvent): void {
    if (e.propertyName !== 'grid-template-rows' || !this.#open || this.#settled) return;
    this.#settled = true;
    this.$('.dc')?.setAttribute('data-settled', '');
  }
}

define('ui-disclosure', UiDisclosure);

declare global {
  interface HTMLElementTagNameMap {
    'ui-disclosure': UiDisclosure;
  }
}
