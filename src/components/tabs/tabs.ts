import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { attrs, esc } from '../../core/html';
import { morphInto } from '../../core/morph';
import { lastEnabled, rovingIndex } from '../../core/roving';
import { type IconName, icon } from '../../icons/icons';
import { styles } from './styles';

export type TabTone = 'run' | 'wait' | 'done' | 'fail' | 'rest';

/** One tab. Its panel is the light-DOM child with `slot="<id>"`. */
export interface TabItem {
  /** Unique key: what `ui-change` carries back, and the slot name of its panel. */
  id: string;
  label: string;
  /** A glyph from `@2lab.ai/ui/icons` before the label. */
  icon?: IconName;
  /** A small status dot before the label (an agent's state). `run` pulses. */
  tone?: TabTone;
  /** A count after the label. */
  badge?: string | number;
  disabled?: boolean;
  title?: string;
}

export interface TabsData {
  tabs: TabItem[];
  /** The selected tab's id. Defaults to the first enabled tab. */
  value?: string;
  /** Accessible name of the tab list. */
  label?: string;
}

/** `ui-change` detail. */
export interface TabsChange {
  value: string;
  previous: string | undefined;
}

const TONES = new Set(['run', 'wait', 'done', 'fail', 'rest']);
const PANEL_IN_MS = 180;

/** The tabs worth drawing: string id, first of each id. */
export function tabItems(d: TabsData | undefined): TabItem[] {
  const seen = new Set<string>();
  const out: TabItem[] = [];
  for (const t of Array.isArray(d?.tabs) ? d.tabs : []) {
    if (!t || typeof t.id !== 'string' || !t.id || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}

/** Index of the selected tab: `value` when it names an enabled tab, else the first enabled one (-1: none). */
export function selectedIndex(tabs: TabItem[], value: string | undefined): number {
  const i = tabs.findIndex((t) => t.id === value);
  if (i >= 0 && !tabs[i].disabled) return i;
  return rovingIndex(
    tabs.map((t) => !!t.disabled),
    0,
    0,
  );
}

/**
 * `<ui-tabs>` — a tab list over panels the host slots in (`<section slot="chat">`), with an ink underline that
 * glides to the selected tab. Arrows move along the list (roving tabindex) and, in the default automatic mode,
 * select as they go; selecting sends a cancelable `ui-change` and shows the new panel unless a listener cancels.
 */
export class UiTabs extends UiElement<TabsData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['activation'];
  }

  #ind: { x: number; w: number } | null = null;
  #shown: string | undefined;
  #ro: ResizeObserver | null = null;
  #raf = 0;

  constructor() {
    super();
    this.root.addEventListener('click', (e) => this.#onClick(e));
    this.root.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
  }

  /** The selected tab's id. */
  get value(): string | undefined {
    const tabs = tabItems(this.data);
    return tabs[selectedIndex(tabs, this.data?.value)]?.id;
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof ResizeObserver === 'function' && !this.#ro) {
      this.#ro = new ResizeObserver(() => this.#measure(false));
    }
  }

  override disconnectedCallback(): void {
    this.#ro?.disconnect();
    this.#ro = null;
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#raf = 0;
  }

  get #manual(): boolean {
    return this.getAttribute('activation') === 'manual';
  }

  protected override update(): void {
    morphInto(this.content, this.render());
    this.updated();
  }

  protected render(): string {
    const d = this.data;
    const tabs = tabItems(d);
    if (!tabs.length) return '';
    const sel = selectedIndex(tabs, d?.value);
    const buttons = tabs
      .map((t, i) => {
        const tone = t.tone && TONES.has(t.tone) ? `<span class="tb-dot" data-tone="${t.tone}"></span>` : '';
        const badge =
          t.badge === undefined || t.badge === null || t.badge === ''
            ? ''
            : `<span class="tb-badge">${esc(t.badge)}</span>`;
        return `<button${attrs({
          type: 'button',
          class: 'tb-tab',
          role: 'tab',
          id: `tb-t-${i}`,
          'aria-selected': String(i === sel),
          'aria-controls': `tb-p-${i}`,
          'aria-disabled': t.disabled ? 'true' : undefined,
          tabindex: i === sel ? '0' : '-1',
          title: t.title,
          part: i === sel ? 'tab selected' : 'tab',
          'data-mk': t.id,
          'data-key': t.id,
          'data-i': i,
        })}>${tone}${t.icon ? icon(t.icon) : ''}<span class="tb-label">${esc(t.label)}</span>${badge}</button>`;
      })
      .join('');
    const ind = this.#ind;
    const indStyle = ind ? `width: ${ind.w}px; transform: translateX(${ind.x}px)` : undefined;
    const panels = tabs
      .map(
        (t, i) =>
          `<div${attrs({
            class: 'tb-panel',
            role: 'tabpanel',
            id: `tb-p-${i}`,
            'aria-labelledby': `tb-t-${i}`,
            tabindex: '0',
            part: 'panel',
            hidden: i !== sel,
            'data-mk': t.id,
          })}><slot${attrs({ name: t.id })}></slot></div>`,
      )
      .join('');
    return `<div class="tb"><div class="tb-scroll" part="list"><div${attrs({
      class: 'tb-list',
      role: 'tablist',
      'aria-label': d?.label,
      'data-measured': !!ind && ind.w > 0,
    })}>${buttons}<span${attrs({ class: 'tb-ind', 'aria-hidden': 'true', part: 'indicator', style: indStyle })}></span></div></div>${panels}</div>`;
  }

  protected override updated(): void {
    const list = this.$('.tb-list');
    if (list && this.#ro) {
      this.#ro.disconnect();
      this.#ro.observe(list);
    }
    this.#measure(true);
    const value = this.value;
    if (value !== this.#shown) {
      const first = this.#shown === undefined;
      this.#shown = value;
      this.#reveal();
      if (!first) this.#fadePanel();
    }
  }

  /** Place the underline under the selected tab. `glide`: a selection change (animated); else a resize (snaps). */
  #measure(glide: boolean): void {
    const list = this.$('.tb-list');
    const ind = this.$('.tb-ind');
    const tab = this.$('.tb-tab[aria-selected="true"]');
    if (!list || !ind) return;
    const x = tab ? tab.offsetLeft : 0;
    const w = tab ? tab.offsetWidth : 0;
    if (this.#ind && this.#ind.x === x && this.#ind.w === w) return;
    // The first placement and resizes snap; only a change of tab glides.
    const snap = !this.#ind || !this.#ind.w || !glide;
    this.#ind = { x, w };
    if (snap) ind.setAttribute('data-still', '');
    ind.style.width = `${w}px`;
    ind.style.transform = `translateX(${x}px)`;
    list.toggleAttribute('data-measured', w > 0);
    if (snap) {
      if (this.#raf) cancelAnimationFrame(this.#raf);
      this.#raf = requestAnimationFrame(() => {
        this.#raf = 0;
        this.$('.tb-ind')?.removeAttribute('data-still');
      });
    }
  }

  /** Keep the selected tab inside the scrolling list. */
  #reveal(): void {
    const scroller = this.$('.tb-scroll');
    const tab = this.$('.tb-tab[aria-selected="true"]');
    if (!scroller || !tab || !scroller.clientWidth) return;
    const left = tab.offsetLeft - 16;
    const right = tab.offsetLeft + tab.offsetWidth + 16 - scroller.clientWidth;
    const to = scroller.scrollLeft > left ? left : scroller.scrollLeft < right ? right : null;
    if (to === null) return;
    const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
    if (typeof scroller.scrollTo === 'function') scroller.scrollTo({ left: Math.max(0, to), behavior });
    else scroller.scrollLeft = Math.max(0, to);
  }

  /** The new panel fades in (WAAPI, so a quick second switch simply starts over from the drawn opacity). */
  #fadePanel(): void {
    if (prefersReducedMotion()) return;
    const panel = this.$('.tb-panel:not([hidden])');
    if (typeof panel?.animate !== 'function') return;
    panel.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: PANEL_IN_MS,
      easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
    });
  }

  #tabs(): HTMLElement[] {
    return this.$$<HTMLElement>('.tb-tab');
  }

  #select(i: number): void {
    const d = this.data;
    const tabs = tabItems(d);
    const t = tabs[i];
    if (!d || !t || t.disabled) return;
    const previous = this.value;
    if (t.id === previous) return;
    const detail: TabsChange = { value: t.id, previous };
    if (this.emit('ui-change', detail) && this.data && this.data.value === d.value)
      this.data = { ...this.data, value: t.id };
  }

  #onClick(e: Event): void {
    const b = (e.target as Element | null)?.closest?.<HTMLElement>('.tb-tab');
    if (b) this.#select(Number(b.dataset.i));
  }

  #onKey(e: KeyboardEvent): void {
    const b = (e.target as Element | null)?.closest?.<HTMLElement>('.tb-tab');
    if (!b) return;
    const tabs = tabItems(this.data);
    const disabled = tabs.map((t) => !!t.disabled);
    const at = Number(b.dataset.i);
    const rtl = getComputedStyle(this).direction === 'rtl';
    let next = -1;
    if (e.key === 'ArrowRight') next = rovingIndex(disabled, at, rtl ? -1 : 1);
    else if (e.key === 'ArrowLeft') next = rovingIndex(disabled, at, rtl ? 1 : -1);
    else if (e.key === 'Home') next = rovingIndex(disabled, 0, 0);
    else if (e.key === 'End') next = lastEnabled(disabled);
    else return;
    e.preventDefault();
    if (next < 0) return;
    const target = this.#tabs()[next];
    for (const x of this.#tabs()) x.setAttribute('tabindex', x === target ? '0' : '-1');
    target?.focus();
    if (!this.#manual) this.#select(next);
  }
}

define('ui-tabs', UiTabs);

declare global {
  interface HTMLElementTagNameMap {
    'ui-tabs': UiTabs;
  }
}
