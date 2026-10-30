import { define, UiElement } from '../../core/element';
import { attrs, cls, esc } from '../../core/html';
import { morphInto } from '../../core/morph';
import { type PopPlace, parsePlacement, positionFixed, watchViewport } from '../../core/popover';
import { lastEnabled, rovingIndex } from '../../core/roving';
import { type IconName, icon } from '../../icons/icons';
import { styles } from './styles';

export type MenuItemKind = 'item' | 'radio' | 'checkbox' | 'separator' | 'heading';

/** One row of the menu. */
export interface MenuItem {
  /** `item` (an action, the default) · `radio` (one of a group) · `checkbox` (on / off) · `separator` · `heading`. */
  kind?: MenuItemKind;
  /** What `ui-select` carries back. Required for item / radio / checkbox. */
  value?: string;
  /** Visible label (falls back to the value). A heading's text. */
  label?: string;
  /** A second, muted line under the label (two lines at most). */
  description?: string;
  /** A glyph from `@2lab.ai/ui/icons` drawn before the label. */
  icon?: IconName;
  /** radio / checkbox: on. */
  checked?: boolean;
  /** Shown, skipped by the arrows, never activated. */
  disabled?: boolean;
  /** A destructive action, drawn in the failure colour. */
  danger?: boolean;
  /** A key hint drawn on the right ("⌘C"). The host binds the key itself. */
  shortcut?: string;
  /** radio: the group it belongs to. Default: the run of rows between separators / headings. */
  group?: string;
}

export interface MenuData {
  items: MenuItem[];
  /** Accessible name of the menu ("Default model"). Default "Menu" / "메뉴". */
  label?: string;
}

/** `ui-select` detail. */
export interface MenuSelect {
  value: string;
  kind: 'item' | 'radio' | 'checkbox';
  /** The state the row asks for: true for a radio, the toggled state for a checkbox, false for an item. */
  checked: boolean;
}

/** `ui-open-change` detail. */
export interface MenuOpenChange {
  open: boolean;
}

const STRINGS = {
  en: { menu: 'Menu' },
  ko: { menu: '메뉴' },
};

const KINDS: ReadonlySet<string> = new Set(['item', 'radio', 'checkbox', 'separator', 'heading']);
const TYPEAHEAD_MS = 500;
const MIN_WIDTH = 180;
const GAP = 6;

type Actionable = 'item' | 'radio' | 'checkbox';
type FocusTo = 'checked' | 'first' | 'last';

/** How a row is drawn; null for junk (not an object, an unknown kind, an action without a string value). */
export function menuItemKind(it: unknown): MenuItemKind | null {
  if (!it || typeof it !== 'object') return null;
  const m = it as MenuItem;
  const kind = m.kind === undefined ? 'item' : KINDS.has(m.kind) ? m.kind : null;
  if (kind === null || kind === 'separator') return kind;
  if (kind === 'heading') return typeof m.label === 'string' && m.label ? kind : null;
  return typeof m.value === 'string' ? kind : null;
}

/**
 * The radio group of every row ('' for anything but a radio): `group` when set, else the run of rows between
 * separators / headings it sits in.
 */
export function menuRadioGroups(items: MenuItem[]): string[] {
  let run = 0;
  return items.map((it) => {
    const k = menuItemKind(it);
    if (k === 'separator' || k === 'heading') {
      run++;
      return '';
    }
    if (k !== 'radio') return '';
    return typeof it.group === 'string' && it.group ? `g:${it.group}` : `r:${run}`;
  });
}

/** The items after row `index` was chosen: a radio checks and its group unchecks; a checkbox toggles. */
export function applyMenuSelect(items: MenuItem[], index: number): MenuItem[] {
  const k = menuItemKind(items[index]);
  if (k === 'checkbox') return items.map((x, j) => (j === index ? { ...x, checked: !x.checked } : x));
  if (k !== 'radio') return items;
  const groups = menuRadioGroups(items);
  const g = groups[index];
  return items.map((x, j) => (groups[j] === g ? { ...x, checked: j === index } : x));
}

/**
 * Typeahead: the next enabled row whose label starts with `query` (case-insensitive), wrapping. One letter —
 * also the same letter typed again and again — searches from the row after `current`, so it cycles; a longer
 * query searches from `current` itself, so "so" stays on "Sonnet". -1 when nothing matches.
 */
export function menuTypeahead(labels: string[], disabled: boolean[], current: number, query: string): number {
  const n = labels.length;
  const q = query.toLowerCase();
  if (!n || !q) return -1;
  const same = Array.from(q).every((c) => c === q[0]);
  const needle = same ? q[0] : q;
  const start = same ? current + 1 : Math.max(current, 0);
  for (let k = 0; k < n; k++) {
    const j = (((start + k) % n) + n) % n;
    if (
      !disabled[j] &&
      String(labels[j] ?? '')
        .trim()
        .toLowerCase()
        .startsWith(needle)
    )
      return j;
  }
  return -1;
}

interface Section {
  head?: string;
  headId?: string;
  rows: string[];
}

/**
 * `<ui-menu>` — an action / choice menu that hangs from a trigger: plain actions, radio groups, checkboxes,
 * separators and headings, with real focus on the rows, arrows, Home / End and typeahead. It pops from the
 * trigger's corner and fades back. Choosing sends a cancelable `ui-select`; unless a listener cancels it, a radio
 * or checkbox shows its new state at once.
 */
export class UiMenu extends UiElement<MenuData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['open', 'placement', 'lang'];
  }

  #open = false;
  #reflecting = false;
  /** The external anchor (`anchor` property / `show(anchor)`). */
  #anchor: Element | null = null;
  /** What the open menu hangs from and gives focus back to. */
  #opener: Element | null = null;
  /** The slotted trigger we wired. */
  #trigger: Element | null = null;
  /** Elements that had no aria-haspopup before we set it (we remove only what we added). */
  #added = new WeakSet<Element>();
  #placed = false;
  #pos: (PopPlace & { minWidth: number }) | null = null;
  #attached = false;
  #unwatch: (() => void) | null = null;
  #typed = '';
  #typedTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.root.addEventListener('click', (e) => this.#onClick(e));
    this.root.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    this.root.addEventListener('pointermove', (e) => this.#onPointerMove(e as PointerEvent));
    this.root.addEventListener('slotchange', () => this.#syncTrigger());
    // The trigger is light DOM: its clicks and keys reach the host itself.
    this.addEventListener('click', (e) => this.#onTriggerClick(e));
    this.addEventListener('keydown', (e) => this.#onTriggerKey(e as KeyboardEvent));
  }

  /** Whether the menu is open. Setting it opens / closes without moving focus and without `ui-open-change`. */
  get open(): boolean {
    return this.#open;
  }

  set open(v: boolean) {
    this.#setOpen(!!v, { user: false });
  }

  /** An element outside the menu it hangs from instead of the slotted trigger (null = the trigger). */
  get anchor(): Element | null {
    return this.#anchor;
  }

  set anchor(el: Element | null) {
    const next = el instanceof Element ? el : null;
    const prev = this.#anchor;
    if (next === prev) return;
    this.#anchor = next;
    if (prev && prev !== this.#trigger) this.#unwire(prev);
    if (this.#open && this.#opener === prev) {
      this.#opener = next ?? this.#triggerEl();
      this.#placed = false;
    }
    if (next) this.#wire(next);
    this.#syncExpanded();
    if (this.#open) this.#place();
  }

  /** Open from `anchor` (which becomes the `anchor`), else from the current anchor / trigger; focus moves in. */
  show(anchor?: Element): void {
    if (anchor) this.anchor = anchor;
    this.#setOpen(true, { user: false, focus: 'checked', opener: this.#anchor ?? this.#triggerEl() });
  }

  /** Close; focus goes back to the anchor when it was inside the menu. */
  hide(): void {
    this.#setOpen(false, { user: false, returnFocus: this.#focusInside() });
  }

  /** Close when open from this anchor, else open from it. */
  toggle(anchor?: Element): void {
    const a = anchor ?? this.#anchor ?? this.#triggerEl();
    if (this.#open && this.#opener === a) this.hide();
    else this.show(anchor);
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === 'open') {
      if (!this.#reflecting) this.#setOpen(value !== null, { user: false });
      return;
    }
    this.requestRender();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#syncTrigger();
    if (this.#open) this.#attach();
  }

  override disconnectedCallback(): void {
    this.#detach();
    this.#resetTypeahead();
  }

  get #t(): (typeof STRINGS)['en'] {
    return this.getAttribute('lang') === 'ko' ? STRINGS.ko : STRINGS.en;
  }

  get #placement() {
    return parsePlacement(this.getAttribute('placement'), { side: 'bottom', align: 'start' });
  }

  #triggerEl(): Element | null {
    return Array.from(this.children).find((c) => c.getAttribute('slot') === 'trigger') ?? null;
  }

  // ── anchors ───────────────────────────────────────────────────────────────

  #wire(el: Element): void {
    if (!el.hasAttribute('aria-haspopup')) this.#added.add(el);
    el.setAttribute('aria-haspopup', 'menu');
    el.setAttribute('aria-expanded', String(this.#open && this.#opener === el));
  }

  #unwire(el: Element): void {
    if (this.#added.has(el)) {
      el.removeAttribute('aria-haspopup');
      this.#added.delete(el);
    }
    el.removeAttribute('aria-expanded');
  }

  #syncTrigger(): void {
    const t = this.#triggerEl();
    if (t === this.#trigger) return;
    const old = this.#trigger;
    if (old && old !== this.#anchor) this.#unwire(old);
    this.#trigger = t;
    if (t) this.#wire(t);
  }

  #syncExpanded(): void {
    for (const el of new Set([this.#triggerEl(), this.#anchor])) {
      if (el) el.setAttribute('aria-expanded', String(this.#open && this.#opener === el));
    }
  }

  /** A trigger that says it is off does not open the menu. */
  #off(el: Element): boolean {
    return el.getAttribute('aria-disabled') === 'true' || (el as HTMLButtonElement).disabled === true;
  }

  // ── open / close ──────────────────────────────────────────────────────────

  #setOpen(v: boolean, o: { user: boolean; focus?: FocusTo; returnFocus?: boolean; opener?: Element | null }): void {
    if (v && this.#open) {
      // Already open: another anchor takes the menu over; focus moves in when asked.
      const next = o.opener ?? this.#opener;
      if (next !== this.#opener) {
        this.#opener = next;
        this.#placed = false;
        this.#syncExpanded();
        this.#place();
      }
      if (o.focus) this.#focusInitial(o.focus);
      return;
    }
    if (v === this.#open) return;
    if (v) {
      this.#open = true;
      this.#placed = false;
      this.#opener = o.opener ?? this.#anchor ?? this.#triggerEl();
      this.#reflect(true);
      this.#syncExpanded();
      if (this.isConnected) {
        this.renderNow();
        if (!this.#open) return;
        this.#attach();
        if (o.focus) this.#focusInitial(o.focus);
      }
    } else {
      // Focus goes home first, while the menu is still open (nothing is lost when it turns inert under it).
      if (o.returnFocus) (this.#opener as HTMLElement | null)?.focus?.();
      this.#open = false;
      this.#resetTypeahead();
      this.#reflect(false);
      this.#syncExpanded();
      this.#detach();
      if (this.isConnected) this.renderNow();
    }
    if (o.user) this.emit<MenuOpenChange>('ui-open-change', { open: v });
  }

  #reflect(v: boolean): void {
    if (this.hasAttribute('open') === v) return;
    this.#reflecting = true;
    this.toggleAttribute('open', v);
    this.#reflecting = false;
  }

  /** The focused element inside the shadow root (null when none, or when the DOM cannot tell). */
  #active(): HTMLElement | null {
    try {
      return this.root.activeElement as HTMLElement | null;
    } catch {
      return null;
    }
  }

  #focusInside(): boolean {
    const a = this.#active();
    return !!a && !!this.$('.mn-pop')?.contains(a);
  }

  readonly #onOutside = (e: Event): void => {
    if (!this.#open) return;
    const path = e.composedPath();
    if (path.includes(this) || (this.#opener && path.includes(this.#opener))) return;
    this.#setOpen(false, { user: true });
  };

  #attach(): void {
    if (this.#attached || !this.#open || !this.isConnected) return;
    this.#attached = true;
    document.addEventListener('pointerdown', this.#onOutside, true);
    document.addEventListener('focusin', this.#onOutside);
    this.#unwatch = watchViewport(() => this.#place());
  }

  #detach(): void {
    if (!this.#attached) return;
    this.#attached = false;
    document.removeEventListener('pointerdown', this.#onOutside, true);
    document.removeEventListener('focusin', this.#onOutside);
    this.#unwatch?.();
    this.#unwatch = null;
  }

  /**
   * Fixed placement from the anchor's rect (`positionFixed`), at least as wide as the anchor. An anchor that
   * leaves the screen or the layout after the menu was placed closes it instead of pointing at nothing.
   */
  #place(): void {
    if (!this.#open || !this.isConnected) return;
    const a = this.#opener;
    const pop = this.$('.mn-pop');
    const probe = this.$('.mn-probe');
    if (!a || !pop) return;
    const o = probe?.getBoundingClientRect();
    const k = o && o.width > 0 ? o.width / 100 : 1;
    const minWidth = Math.max(MIN_WIDTH, Math.round(a.getBoundingClientRect().width / k));
    pop.style.minWidth = `${minWidth}px`;
    const { side, align } = this.#placement;
    const p = positionFixed(a, pop, probe, side, align, GAP);
    if (!p) {
      if (this.#placed) this.#setOpen(false, { user: true });
      return; // not laid out yet — the viewport watch tries again
    }
    this.#placed = true;
    this.#pos = { ...p, minWidth };
  }

  // ── focus ─────────────────────────────────────────────────────────────────

  #items(): HTMLElement[] {
    return this.$$<HTMLElement>('.mn-item');
  }

  #focusInitial(to: FocusTo): void {
    const items = this.#items();
    const disabled = items.map(isOff);
    let i = to === 'last' ? lastEnabled(disabled) : rovingIndex(disabled, 0, 0);
    if (to === 'checked') {
      const c = items.findIndex(
        (x, j) =>
          !disabled[j] && x.getAttribute('role') === 'menuitemradio' && x.getAttribute('aria-checked') === 'true',
      );
      if (c >= 0) i = c;
    }
    if (i >= 0) this.#focusItem(items[i]);
    else this.$('.mn-pop')?.focus({ preventScroll: true });
  }

  /** Focus a row and scroll only the menu (never the page) to show it. */
  #focusItem(el: HTMLElement): void {
    el.focus({ preventScroll: true });
    const pop = this.$('.mn-pop');
    if (!pop || pop.scrollHeight <= pop.clientHeight) return;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (top < pop.scrollTop) pop.scrollTop = Math.max(0, top - 4);
    else if (bottom > pop.scrollTop + pop.clientHeight) pop.scrollTop = bottom - pop.clientHeight + 4;
  }

  #resetTypeahead(): void {
    clearTimeout(this.#typedTimer);
    this.#typedTimer = undefined;
    this.#typed = '';
  }

  // ── input ─────────────────────────────────────────────────────────────────

  /** Click toggles; opening focuses the checked radio, else the first row. */
  #onTriggerClick(e: Event): void {
    const t = this.#triggerEl();
    if (!t || !t.contains(e.target as Node) || this.#off(t)) return;
    if (this.#open && this.#opener === t) this.#setOpen(false, { user: true, returnFocus: true });
    else this.#setOpen(true, { user: true, focus: 'checked', opener: t });
  }

  /** ↓ opens on the checked radio (else the first row), ↑ on the last row; Enter / Space are the button's click. */
  #onTriggerKey(e: KeyboardEvent): void {
    const t = this.#triggerEl();
    if (!t || !t.contains(e.target as Node)) return;
    if (e.key === 'Escape' && this.#open) {
      e.preventDefault();
      e.stopPropagation();
      this.#setOpen(false, { user: true, returnFocus: true });
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    if (this.#off(t)) return;
    this.#setOpen(true, { user: true, focus: e.key === 'ArrowDown' ? 'checked' : 'last', opener: t });
  }

  #onClick(e: Event): void {
    if (!this.#open) return;
    const item = (e.target as Element | null)?.closest?.<HTMLElement>('.mn-item');
    if (item && this.root.contains(item)) this.#activate(item);
  }

  #onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    const pop = this.$('.mn-pop');
    if (!this.#open || !t || !pop?.contains(t)) return;
    // Every key inside the open menu stays in it: no page shortcut, no outer Escape.
    e.stopPropagation();
    const items = this.#items();
    const disabled = items.map(isOff);
    const at = items.indexOf(t);
    const k = e.key;
    let next: number | null = null;
    if (k === 'ArrowDown') next = at < 0 ? rovingIndex(disabled, 0, 0) : rovingIndex(disabled, at, 1);
    else if (k === 'ArrowUp') next = at < 0 ? lastEnabled(disabled) : rovingIndex(disabled, at, -1);
    else if (k === 'Home') next = rovingIndex(disabled, 0, 0);
    else if (k === 'End') next = lastEnabled(disabled);
    if (next !== null) {
      e.preventDefault();
      if (next >= 0) this.#focusItem(items[next]);
      return;
    }
    if (k === 'Escape' || k === 'Tab') {
      // A non-modal menu never keeps focus: Tab closes it onto the anchor too.
      e.preventDefault();
      this.#setOpen(false, { user: true, returnFocus: true });
      return;
    }
    if (k === 'Enter' || (k === ' ' && !this.#typed)) {
      e.preventDefault();
      if (at >= 0) this.#activate(items[at]);
      return;
    }
    if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      this.#typeahead(k, items, disabled, at);
    }
  }

  #typeahead(ch: string, items: HTMLElement[], disabled: boolean[], at: number): void {
    this.#typed += ch;
    clearTimeout(this.#typedTimer);
    this.#typedTimer = setTimeout(() => {
      this.#typed = '';
      this.#typedTimer = undefined;
    }, TYPEAHEAD_MS);
    const labels = items.map((x) => x.querySelector('.mn-label')?.textContent ?? '');
    const i = menuTypeahead(labels, disabled, at, this.#typed);
    if (i >= 0) this.#focusItem(items[i]);
  }

  /** The pointer moving over a row focuses it — one highlight for mouse and keyboard. */
  #onPointerMove(e: PointerEvent): void {
    if (!this.#open || e.pointerType === 'touch') return;
    const item = (e.target as Element | null)?.closest?.<HTMLElement>('.mn-item');
    if (!item || isOff(item) || this.#active() === item) return;
    item.focus({ preventScroll: true });
  }

  /** A row was chosen: item → close; radio → check (its group unchecks) and close; checkbox → toggle, stay open. */
  #activate(el: HTMLElement): void {
    if (isOff(el)) return;
    const d = this.data;
    const items = Array.isArray(d?.items) ? d.items : [];
    const i = Number(el.dataset.i);
    const it = items[i];
    const kind = menuItemKind(it);
    if (!d || !it || kind === null || kind === 'separator' || kind === 'heading') return;
    if (kind === 'radio' && it.checked) {
      this.#setOpen(false, { user: true, returnFocus: true });
      return;
    }
    const detail: MenuSelect = {
      value: String(it.value),
      kind,
      checked: kind === 'radio' ? true : kind === 'checkbox' ? !it.checked : false,
    };
    if (!this.emit<MenuSelect>('ui-select', detail)) return;
    // Optimistic on top of the LATEST data: a listener that replaced the items wins.
    if (kind !== 'item' && this.data && this.data.items === items)
      this.data = { ...this.data, items: applyMenuSelect(items, i) };
    if (kind !== 'checkbox') this.#setOpen(false, { user: true, returnFocus: true });
  }

  // ── render ────────────────────────────────────────────────────────────────

  /** Patch the live tree instead of replacing it: the open / close transition and focus survive. */
  protected override update(): void {
    const a = this.#active();
    const key = a ? (a.dataset?.mk ?? '') : null;
    morphInto(this.content, this.render());
    this.updated();
    // A row whose node was replaced (its section moved) loses focus: give it back to the same row, else the menu.
    if (key !== null && this.#open && !this.#active()) {
      const same = key ? this.$$<HTMLElement>('[data-mk]').find((x) => x.dataset.mk === key) : undefined;
      (same ?? this.$<HTMLElement>('.mn-pop'))?.focus({ preventScroll: true });
    }
  }

  protected override updated(): void {
    this.#syncTrigger();
    if (this.#open) this.#place();
  }

  protected render(): string {
    const d = this.data;
    const raw = Array.isArray(d?.items) ? d.items : [];
    const kinds = raw.map(menuItemKind);
    const checks = kinds.some((k) => k === 'radio' || k === 'checkbox');
    const parts: Array<Section | null> = []; // null = a separator
    const seen = new Map<string, number>();
    let sec: Section | null = null;
    for (let i = 0; i < raw.length; i++) {
      const k = kinds[i];
      if (k === null) continue;
      if (k === 'separator') {
        sec = null;
        parts.push(null);
      } else if (k === 'heading') {
        sec = { head: raw[i].label, headId: `mn-h-${i}`, rows: [] };
        parts.push(sec);
      } else {
        if (!sec) {
          sec = { rows: [] };
          parts.push(sec);
        }
        sec.rows.push(this.#row(raw[i], i, k, checks, seen));
      }
    }
    const sections = parts.filter((p): p is Section => p !== null);
    // One plain run needs no group; several runs (or a heading) are groups, named by their heading.
    const grouped = sections.length > 1 || sections.some((s) => s.head);
    let body = '';
    parts.forEach((p, n) => {
      if (!p) {
        body += `<div class="mn-sep" role="separator" data-mk="sep:${n}"></div>`;
        return;
      }
      if (p.head)
        body += `<div class="mn-head" id="${p.headId}" aria-hidden="true" data-mk="head:${n}">${esc(p.head)}</div>`;
      if (p.rows.length)
        body += `<div${attrs({
          class: 'mn-group',
          role: grouped ? 'group' : 'none',
          'aria-labelledby': p.headId,
          'data-mk': `group:${n}`,
        })}>${p.rows.join('')}</div>`;
    });
    const open = this.#open;
    const { side, align } = this.#placement;
    const pos = this.#pos;
    return `<slot name="trigger"></slot><i class="mn-probe" aria-hidden="true"></i><div${attrs({
      class: cls('mn-pop', open && 'is-open'),
      part: 'menu',
      role: 'menu',
      'aria-label': (typeof d?.label === 'string' && d.label) || this.#t.menu,
      tabindex: '-1',
      inert: !open,
      'data-side': pos?.side ?? side,
      'data-align': align,
      // The last placement stays while closed, so the exit runs in place.
      style: pos
        ? `left:${pos.left}px;top:${pos.top}px;max-height:${pos.maxHeight}px;min-width:${pos.minWidth}px`
        : undefined,
    })}>${body}</div>`;
  }

  /** [check column (when the menu has checkable rows)] [icon] [label + description] [shortcut]. */
  #row(it: MenuItem, i: number, kind: Actionable, checks: boolean, seen: Map<string, number>): string {
    const label = it.label || it.value || '';
    const on = kind !== 'item' && !!it.checked;
    const role = kind === 'radio' ? 'menuitemradio' : kind === 'checkbox' ? 'menuitemcheckbox' : 'menuitem';
    // morph key: one row per kind + value (a repeat gets a counter), so a row never turns into another.
    const base = `${kind}:${it.value}`;
    const dup = seen.get(base) ?? 0;
    seen.set(base, dup + 1);
    const desc = typeof it.description === 'string' ? it.description : '';
    const kbd = typeof it.shortcut === 'string' ? it.shortcut : '';
    const described = [desc && `mn-d-${i}`, kbd && `mn-k-${i}`].filter(Boolean).join(' ');
    const mark = on ? icon('check') : kind === 'checkbox' ? '<span class="mn-box"></span>' : '';
    const glyph = it.icon ? icon(it.icon) : '';
    return `<div${attrs({
      class: cls('mn-item', it.danger && 'is-danger', desc && 'has-desc'),
      role,
      tabindex: '-1',
      'aria-checked': kind === 'item' ? undefined : String(on),
      'aria-disabled': it.disabled ? 'true' : undefined,
      'aria-labelledby': `mn-l-${i}`,
      'aria-describedby': described || undefined,
      'data-i': i,
      'data-mk': dup ? `${base}#${dup}` : base,
    })}>${checks ? `<span class="mn-check" aria-hidden="true">${mark}</span>` : ''}${
      glyph ? `<span class="mn-icon" aria-hidden="true">${glyph}</span>` : ''
    }<span class="mn-text"><span class="mn-label" id="mn-l-${i}">${esc(label)}</span>${
      desc ? `<span class="mn-desc" id="mn-d-${i}">${esc(desc)}</span>` : ''
    }</span>${kbd ? `<kbd class="mn-kbd" id="mn-k-${i}">${esc(kbd)}</kbd>` : ''}</div>`;
  }
}

function isOff(el: Element): boolean {
  return el.getAttribute('aria-disabled') === 'true';
}

define('ui-menu', UiMenu);

declare global {
  interface HTMLElementTagNameMap {
    'ui-menu': UiMenu;
  }
}
