import { define, UiElement } from '../../core/element';
import { fileKindIcon } from '../../core/files';
import { attrs, esc, escAttr } from '../../core/html';
import { morphInto } from '../../core/morph';
import { positionFixed, watchViewport } from '../../core/popover';
import { icon } from '../../icons/icons';
import '../dialog/dialog';
import { DIALOG_EXIT_MS, type DialogCloseDetail, type DialogCloseReason, type UiDialog } from '../dialog/dialog';
import {
  type FileCardVariant,
  type FileItem,
  fileCardHtml,
  fileDisplayName,
  fileItemKind,
  fileKindLabel,
  fileMeta,
} from '../file-card/render';
import {
  type ArtifactLayout,
  actionsHtml,
  actionUrl,
  artifactItems,
  artifactLayout,
  PEEK_DELAY_MS,
  PEEK_GRACE_MS,
  PEEK_WARM_MS,
  peekHtml,
  stepIndex,
  type ViewerStrings,
  viewerActions,
  viewerBodyHtml,
  viewerBodyKind,
  viewerStrings,
} from './logic';
import { styles } from './styles';

export interface ArtifactViewerData {
  items: FileItem[];
  /**
   * `strip` (default) — one scrolling row with snap · `grid` — tiles ≥ 132px · `chips` — wrapping pills · `list` —
   * rows · `none` — no tiles: only the viewer, over the host's own tiles (`open(items, index, opener)`).
   */
  layout?: ArtifactLayout;
  /** Section label above the files, with a count. */
  title?: string;
  /**
   * Host-controlled open: a valid index opens the viewer at that item when this data is assigned; `-1` closes it;
   * undefined leaves the viewer as the person left it. Clear it (or set -1) on `ui-close`.
   */
  index?: number;
  /** Hover peek on mouse / pen. Default true. */
  peek?: boolean;
  /** Show Download when the item has a url. Default true. */
  download?: boolean;
  /** Show Open in new tab when the item has a url. Default true. */
  openInTab?: boolean;
}

/** `ui-open` (cancelable): a tile was activated; the viewer opens at it unless the host prevents it. */
export interface ArtifactOpenDetail {
  id: string;
  index: number;
}
/** `ui-view` (notification): the viewer now shows this item (open, previous, next). */
export interface ArtifactViewDetail {
  id: string;
  index: number;
}
/** `ui-close` (cancelable): the person asked to close the viewer. */
export interface ArtifactCloseDetail {
  reason: DialogCloseReason;
}
/** `ui-action` (cancelable): Open in new tab / Download; preventDefault() stops the link (the host handles it). */
export interface ArtifactActionDetail {
  action: 'open' | 'download';
  id: string;
  url: string;
}

const VARIANT: Record<ArtifactLayout, FileCardVariant> = {
  strip: 'tile',
  grid: 'tile',
  chips: 'chip',
  list: 'row',
  none: 'tile',
};

/** Where arrow keys belong to the control (caret, seeking, a frame's own page). */
function ownsArrows(t: EventTarget | undefined): boolean {
  const el = t as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  return /^(INPUT|TEXTAREA|SELECT|AUDIO|VIDEO|IFRAME)$/.test(el.tagName) || !!el.isContentEditable;
}

/**
 * `<ui-artifact-viewer>` — what did the agent make? Every file as a tile (strip, grid, chips or list), a larger
 * peek on hover, and the full file one click away in a `<ui-dialog size="xl">`: image (fit, 1:1 zoom), markdown
 * document, text / code, an HTML page in a sandbox with scripts off, audio, video, or a calm card with Download.
 * ← / → page through, Home / End jump, Esc closes and focus goes back to the tile.
 */
export class UiArtifactViewer extends UiElement<ArtifactViewerData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang', 'theme', 'tiles'];
  }

  /** The item the viewer shows (-1 = closed), and its id: new data keeps showing that file wherever it moved. */
  #index = -1;
  #shownId: string | null = null;
  #zoomed = false;
  /** What the live region says after a step ('' on open: the dialog's name speaks then). */
  #live = '';
  #indexPending = false;
  readonly #broken = new Set<string>();
  readonly #dialog: UiDialog;
  readonly #peek: HTMLDivElement;
  readonly #probe: HTMLElement;
  #peekAnchor: HTMLElement | null = null;
  #peekAt = -1;
  #peekShown = false;
  #placed = false;
  #openTimer: ReturnType<typeof setTimeout> | undefined;
  #graceTimer: ReturnType<typeof setTimeout> | undefined;
  #clearTimer: ReturnType<typeof setTimeout> | undefined;
  #emptyTimer: ReturnType<typeof setTimeout> | undefined;
  #unwatch: (() => void) | null = null;
  #ro: ResizeObserver | null = null;

  constructor() {
    super();
    const r = this.root;
    this.#probe = document.createElement('i');
    this.#probe.className = 'av-probe';
    this.#probe.setAttribute('aria-hidden', 'true');
    this.#peek = document.createElement('div');
    this.#peek.className = 'av-peek';
    this.#peek.setAttribute('aria-hidden', 'true');
    this.#dialog = document.createElement('ui-dialog');
    this.#dialog.setAttribute('size', 'xl');
    r.append(this.#probe, this.#peek, this.#dialog);
    r.addEventListener('click', (e) => this.#onClick(e as MouseEvent));
    r.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    r.addEventListener('pointerover', (e) => this.#onOver(e as PointerEvent));
    r.addEventListener('pointerout', (e) => this.#onOut(e as PointerEvent));
    r.addEventListener('ui-close', (e) => this.#onInnerClose(e as CustomEvent<DialogCloseDetail>));
    r.addEventListener('slotchange', (e) => {
      if ((e.target as Element | null)?.getAttribute?.('name') === 'preview' && this.#index >= 0) this.#syncViewer();
    });
    // Neither bubbles: catch them on the way down. A strip that scrolls moves the tile out from under the peek.
    r.addEventListener('error', (e) => this.#onError(e), true);
    r.addEventListener(
      'scroll',
      (e) => {
        if ((e.target as Element | null)?.classList?.contains('av-list')) {
          this.#hidePeek();
          this.#syncFades();
        }
      },
      true,
    );
  }

  // ── data / attributes ─────────────────────────────────────────────────────

  override get data(): ArtifactViewerData | undefined {
    return super.data;
  }

  override set data(value: ArtifactViewerData | undefined) {
    // A host-controlled index applies once per assignment, at the next render.
    this.#indexPending = typeof value?.index === 'number';
    super.data = value;
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  /** The index of the item the viewer shows, -1 when it is closed. */
  get index(): number {
    return this.#index;
  }

  /**
   * Open the viewer at `index` (no `ui-open`; `ui-view` reports the shown item). Given a list, the viewer pages
   * through it instead (it becomes `data.items`, the rest of the data stays) — the host's own tiles, a whole
   * conversation — and `opener` (the host's tile) takes focus back when it closes.
   */
  open(index: number): void;
  open(items: FileItem[], index?: number, opener?: HTMLElement | null): void;
  open(a: number | FileItem[], index = 0, opener?: HTMLElement | null): void {
    if (!Array.isArray(a)) {
      this.#show(Math.trunc(Number(a)));
      return;
    }
    // The list replaces the items; a host-controlled index of the old data must not reopen anything.
    const { index: _drop, ...rest } = this.data ?? { items: [] };
    this.data = { ...rest, items: a };
    this.#show(Math.trunc(Number(index)) || 0, opener ?? null);
  }

  /** Close the viewer with its exit motion (no event). */
  close(): void {
    if (this.#index < 0) return;
    this.#dialog.hide();
    this.#closed();
  }

  /** Show the next item (held at the last). */
  next(): void {
    this.#step(1);
  }

  /** Show the previous item (held at the first). */
  prev(): void {
    this.#step(-1);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof ResizeObserver === 'function' && !this.#ro) {
      this.#ro = new ResizeObserver(() => this.#syncFades());
      this.#ro.observe(this);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#hidePeek();
    clearTimeout(this.#openTimer);
    clearTimeout(this.#graceTimer);
    clearTimeout(this.#clearTimer);
    this.#ro?.disconnect();
    this.#ro = null;
    // The dialog leaves the top layer by itself when it is removed; hide() also drops its wish to be open, or a
    // re-insert (a move in the page) would reopen it on a viewer that has closed.
    this.close();
    clearTimeout(this.#emptyTimer); // close() may have armed it; a removed viewer has nothing to empty
  }

  get #lang(): string {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  get #t(): ViewerStrings {
    return viewerStrings(this.#lang);
  }

  #items(): FileItem[] {
    return artifactItems(this.data?.items);
  }

  /** `tiles="none"` (attribute) wins over `data.layout`. */
  #layout(): ArtifactLayout {
    return this.getAttribute('tiles') === 'none' ? 'none' : artifactLayout(this.data?.layout);
  }

  // ── render ────────────────────────────────────────────────────────────────

  /** Patch the live tree: tiles keep their node (focus, a loaded thumbnail); the dialog lives outside it. */
  protected override update(): void {
    morphInto(this.content, this.render());
    this.updated();
  }

  protected override updated(): void {
    const items = this.#items();
    if (this.#index >= 0) this.#follow(items);
    if (this.#indexPending) {
      this.#indexPending = false;
      const want = Math.trunc(Number(this.data?.index ?? -1));
      if (want >= 0 && want < items.length) this.#show(want);
      else if (want < 0) this.close();
    }
    this.#syncDialogAttrs();
    if (this.#index >= 0) this.#syncViewer();
    this.#syncFades();
    // A re-render can drop the tile under the peek, or move it (its index) when files arrive before it.
    if (this.#peekShown) {
      const at = Number(this.#peekAnchor?.dataset.i);
      if (!this.#peekAnchor?.isConnected || !items[at]) this.#hidePeek();
      else if (at !== this.#peekAt) {
        this.#peekAt = at;
        this.#fillPeek();
      }
    }
  }

  /**
   * New items while the viewer is open: keep showing the same file wherever it moved (files that arrive before it
   * do not swap it out); when it went away hold at the nearest one; close when nothing is left.
   */
  #follow(items: FileItem[]): void {
    const at = this.#shownId === null ? -1 : items.findIndex((it) => String(it.id) === this.#shownId);
    const i = at >= 0 ? at : Math.min(this.#index, items.length - 1);
    if (i < 0) {
      this.close();
      return;
    }
    const id = String(items[i].id);
    if (i === this.#index && id === this.#shownId) return;
    if (id !== this.#shownId) {
      this.#zoomed = false;
      this.#live = '';
      this.#pauseMedia();
    }
    this.#index = i;
    this.#shownId = id;
    this.notify<ArtifactViewDetail>('ui-view', { id, index: i });
  }

  protected render(): string {
    const d = this.data;
    // No tiles: the viewer is the whole element (its dialog lives outside this tree).
    if (this.#layout() === 'none') return '';
    const items = this.#items();
    const title = String(d?.title ?? '').trim();
    if (!items.length) {
      return title
        ? `<div class="av-head"><span class="av-title">${esc(title)}</span></div><p class="av-empty">${esc(this.#t.empty)}</p>`
        : '';
    }
    const layout = this.#layout();
    const variant = VARIANT[layout];
    const lang = this.#lang;
    const now = Date.now();
    const head = title
      ? `<div class="av-head" id="av-title"><span class="av-title">${esc(title)}</span><span class="av-count">${items.length}</span></div>`
      : '';
    const tiles = items
      .map(
        (it, i) =>
          `<li data-mk="${escAttr(`f:${it.id}`)}">${fileCardHtml(it, variant, lang, {
            now,
            broken: this.#broken,
            attrs: { 'data-i': i, 'data-key': `open:${it.id}`, 'aria-haspopup': 'dialog' },
          })}</li>`,
      )
      .join('');
    return `${head}<ul${attrs({
      class: 'av-list',
      role: 'list',
      'data-layout': layout,
      'aria-labelledby': title ? 'av-title' : undefined,
      'aria-label': title ? undefined : this.#t.files,
    })}>${tiles}</ul>`;
  }

  #syncDialogAttrs(): void {
    const dlg = this.#dialog;
    const set = (name: string, v: string | null) => {
      if (v === null) dlg.removeAttribute(name);
      else if (dlg.getAttribute(name) !== v) dlg.setAttribute(name, v);
    };
    set('lang', this.#lang);
    set('theme', this.getAttribute('theme'));
  }

  /** The dialog's slotted header, body and footer for the shown item (patched in place). */
  #syncViewer(): void {
    const items = this.#items();
    const item = items[this.#index];
    if (!item) return;
    const t = this.#t;
    const lang = this.#lang;
    const now = Date.now();
    const kind = fileItemKind(item);
    const name = fileDisplayName(item, lang);
    const meta = [fileMeta(item, now, lang), String(item.meta ?? '').trim()].filter(Boolean).join(' · ');
    const n = items.length;
    const i = this.#index;
    const preview = Array.from(this.children).some((c) => c.getAttribute('slot') === 'preview');
    const body = preview ? 'host' : viewerBodyKind(item, this.#broken);
    const acts = viewerActions(item, this.data ?? {});
    const header = `<span slot="header" class="av-vh" data-kind="${kind}"><span class="av-badge">${icon(
      fileKindIcon(kind),
      {
        size: 14,
      },
    )}<span>${esc(fileKindLabel(kind, lang))}</span></span><span class="av-vt"><span class="av-vname">${esc(name)}</span>${
      meta ? `<span class="av-vmeta">${esc(meta)}</span>` : ''
    }</span></span>`;
    const live = `<span class="av-live" role="status" aria-live="polite">${esc(this.#live)}</span>`;
    const stage = `<div class="av-stage" data-kind="${kind}" data-body="${body}"><slot name="preview">${
      preview ? '' : viewerBodyHtml(item, { lang, now, broken: this.#broken, zoomed: this.#zoomed, acts })
    }</slot></div>`;
    const nav =
      n > 1
        ? `<div class="av-nav"><button${attrs({
            type: 'button',
            class: 'av-nb',
            'data-step': -1,
            'data-key': 'prev',
            'aria-label': t.prev,
            title: t.prev,
            disabled: i <= 0,
          })}>${icon('chevron-left')}</button><span class="av-pos"><span aria-hidden="true">${i + 1} / ${n}</span><span class="sr-only">${esc(
            t.pos(i + 1, n),
          )}</span></span><button${attrs({
            type: 'button',
            class: 'av-nb',
            'data-step': 1,
            'data-key': 'next',
            'aria-label': t.next,
            title: t.next,
            disabled: i >= n - 1,
          })}>${icon('chevron-right')}</button></div>`
        : '';
    const zoom =
      body === 'image'
        ? `<button${attrs({
            type: 'button',
            class: 'av-tg',
            'data-key': 'zoom',
            'aria-pressed': this.#zoomed ? 'true' : 'false',
            title: t.zoom,
          })}>${icon('search')}<span class="av-act-t">${esc(t.zoom)}</span></button>`
        : '';
    // The fallback card carries the actions itself; the footer keeps them for every other body.
    const footActs = body === 'fallback' ? '' : actionsHtml(item, acts, t);
    const right = zoom || footActs ? `<div class="av-acts">${zoom}${footActs}</div>` : '';
    const footer = nav || right ? `<div slot="footer" class="av-vf">${nav}${right}</div>` : '';
    this.#dialog.setAttribute('label', name);
    morphInto(this.#dialog, `${header}${live}${stage}${footer}`);
  }

  /** Strip edges fade only on the side that has more to scroll to. */
  #syncFades(): void {
    const list = this.$('.av-list');
    if (!list) return;
    const strip = list.getAttribute('data-layout') === 'strip';
    const max = list.scrollWidth - list.clientWidth;
    list.toggleAttribute('data-fade-start', strip && list.scrollLeft > 1);
    list.toggleAttribute('data-fade-end', strip && max - list.scrollLeft > 1);
  }

  // ── viewer ────────────────────────────────────────────────────────────────

  /** Open at (or move to) `i`. `opener` is the tile that asked: focus goes back to it on close. */
  #show(i: number, opener?: HTMLElement | null): void {
    const items = this.#items();
    const item = items[i];
    if (!item) return;
    this.#hidePeek();
    // Already open: a move like a step (media paused, the body scrolled to the top, the step announced).
    if (this.#index >= 0 && this.#dialog.open) {
      this.#go(i);
      return;
    }
    clearTimeout(this.#emptyTimer);
    const changed = i !== this.#index;
    if (changed) {
      this.#index = i;
      this.#shownId = String(item.id);
      this.#zoomed = false;
      this.#live = '';
    }
    this.#syncDialogAttrs();
    this.#syncViewer();
    if (!this.#dialog.open) {
      // The dialog returns focus to whatever was focused when it opened: make that the tile.
      opener?.focus({ preventScroll: true });
      this.#dialog.show();
    }
    if (changed) this.notify<ArtifactViewDetail>('ui-view', { id: String(item.id), index: i });
  }

  #step(delta: number): void {
    if (this.#index < 0) return;
    this.#go(stepIndex(this.#index, delta, this.#items().length));
  }

  #go(i: number): void {
    const items = this.#items();
    const item = items[i];
    // The same place may hold another file (a new list from open(items, …)): that is a move too.
    if (this.#index < 0 || !item || (i === this.#index && String(item.id) === this.#shownId)) return;
    this.#index = i;
    this.#shownId = String(item.id);
    this.#zoomed = false;
    this.#live = `${fileDisplayName(item, this.#lang)} — ${i + 1} / ${items.length}`;
    this.#pauseMedia();
    this.#syncViewer();
    const body = this.#dialog.querySelector('.av-body');
    if (body) body.scrollTop = 0;
    // A step button that just became disabled (an end) would drop focus to the body: keep it on the other one.
    const active = this.root.activeElement as HTMLButtonElement | null;
    if (active?.classList.contains('av-nb') && active.disabled)
      this.#dialog.querySelector<HTMLButtonElement>('.av-nb:not(:disabled)')?.focus();
    this.notify<ArtifactViewDetail>('ui-view', { id: String(item.id), index: i });
  }

  /** The viewer is closing: stop media now, drop the content once the exit has played. */
  #closed(): void {
    this.#index = -1;
    this.#shownId = null;
    this.#zoomed = false;
    this.#live = '';
    this.#pauseMedia();
    clearTimeout(this.#emptyTimer);
    this.#emptyTimer = setTimeout(() => {
      if (this.#index < 0) this.#dialog.replaceChildren();
    }, DIALOG_EXIT_MS + 40);
  }

  #pauseMedia(): void {
    for (const m of Array.from(this.#dialog.querySelectorAll<HTMLMediaElement>('audio, video'))) {
      try {
        m.pause();
      } catch {}
    }
  }

  /** Activate tile `i`: ask the host first (`ui-open`), then open. */
  #activate(i: number, tile: HTMLElement | null): void {
    const item = this.#items()[i];
    if (!item) return;
    this.#hidePeek();
    if (!this.emit<ArtifactOpenDetail>('ui-open', { id: String(item.id), index: i })) return;
    this.#show(i, tile);
  }

  // ── events ────────────────────────────────────────────────────────────────

  #onClick(e: MouseEvent): void {
    const t = e.target as Element | null;
    if (!t?.closest) return;
    if (this.#peek.contains(t)) {
      if (this.#peekAt >= 0) this.#activate(this.#peekAt, this.#peekAnchor);
      return;
    }
    const tile = t.closest<HTMLElement>('.av-list .fc[data-i]');
    if (tile) {
      this.#activate(Number(tile.dataset.i), tile);
      return;
    }
    if (this.#index < 0) return;
    const step = t.closest<HTMLButtonElement>('.av-nb');
    if (step) {
      if (!step.disabled) this.#step(Number(step.dataset.step) || 0);
      return;
    }
    if (t.closest('.av-tg') || t.closest('.av-pic')) {
      this.#zoomed = !this.#zoomed;
      this.#syncViewer();
      return;
    }
    const act = t.closest<HTMLAnchorElement>('a.av-act');
    if (act) {
      const item = this.#items()[this.#index];
      const action = act.dataset.act === 'download' ? 'download' : 'open';
      // The url the link follows (trimmed, a safe app link), not whatever the data held.
      if (item && !this.emit<ArtifactActionDetail>('ui-action', { action, id: String(item.id), url: actionUrl(item) }))
        e.preventDefault();
    }
  }

  #onKey(e: KeyboardEvent): void {
    if (this.#index < 0 || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
    if (ownsArrows(e.composedPath()[0])) return;
    const n = this.#items().length;
    let to = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      // A zoomed image keeps its arrow keys for scrolling.
      if (this.#zoomed) return;
      to = stepIndex(this.#index, e.key === 'ArrowRight' ? 1 : -1, n);
    } else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = n - 1;
    else return;
    e.preventDefault();
    this.#go(to);
  }

  /** The inner dialog's close request becomes ours; a host that cancels ours keeps the dialog open. */
  #onInnerClose(e: CustomEvent<DialogCloseDetail>): void {
    if (e.target !== this.#dialog) return;
    e.stopPropagation();
    const reason = e.detail?.reason ?? 'escape';
    if (!this.emit<ArtifactCloseDetail>('ui-close', { reason })) {
      e.preventDefault();
      return;
    }
    this.#closed();
  }

  #onError(e: Event): void {
    const el = e.target as Element | null;
    if (el?.tagName !== 'IMG') return;
    const src = el.getAttribute('src') ?? '';
    if (!src || this.#broken.has(src)) return;
    this.#broken.add(src);
    if (this.#peek.contains(el) && this.#peekAt >= 0) this.#fillPeek();
    this.requestRender();
  }

  // ── peek ──────────────────────────────────────────────────────────────────

  #onOver(e: PointerEvent): void {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    const t = e.target as Element | null;
    if (!t?.closest) return;
    if (this.#peek.contains(t)) {
      clearTimeout(this.#graceTimer);
      return;
    }
    if (this.data?.peek === false || this.#index >= 0) return;
    const tile = t.closest<HTMLElement>('.av-list .fc[data-i]');
    if (!tile) return;
    clearTimeout(this.#graceTimer);
    if (tile === this.#peekAnchor && this.#peekShown) return;
    clearTimeout(this.#openTimer);
    this.#openTimer = setTimeout(() => this.#showPeek(tile), this.#peekShown ? PEEK_WARM_MS : PEEK_DELAY_MS);
  }

  #onOut(e: PointerEvent): void {
    const t = e.target as Element | null;
    if (!t?.closest) return;
    const from = this.#peek.contains(t) ? this.#peek : t.closest<HTMLElement>('.av-list .fc[data-i]');
    if (!from) return;
    const to = e.relatedTarget as Node | null;
    if (to && (this.#peek.contains(to) || from.contains(to))) return;
    clearTimeout(this.#openTimer);
    if (this.#peekShown) {
      clearTimeout(this.#graceTimer);
      this.#graceTimer = setTimeout(() => this.#hidePeek(), PEEK_GRACE_MS);
    }
  }

  #showPeek(tile: HTMLElement): void {
    clearTimeout(this.#openTimer);
    const i = Number(tile.dataset.i);
    if (!tile.isConnected || this.#index >= 0 || this.data?.peek === false || !this.#items()[i]) return;
    clearTimeout(this.#clearTimer);
    this.#peekAnchor = tile;
    this.#peekAt = i;
    this.#fillPeek();
    if (!this.#peekShown) {
      this.#peekShown = true;
      this.#placed = false;
      this.#unwatch = watchViewport(() => this.#placePeek());
      document.addEventListener('keydown', this.#onDocKey, true);
      document.addEventListener('pointerdown', this.#onDocDown, true);
    }
    this.#placePeek();
    this.#peek.classList.add('is-open');
  }

  #fillPeek(): void {
    const item = this.#items()[this.#peekAt];
    if (!item) return;
    this.#peek.setAttribute('data-kind', fileItemKind(item));
    this.#peek.innerHTML = peekHtml(item, this.#lang, Date.now(), this.#broken);
  }

  /** Under the tile (over it when there is no room); a tile that leaves the screen after placing hides it. */
  #placePeek(): void {
    const a = this.#peekAnchor;
    if (!this.#peekShown || !a) return;
    if (!a.isConnected) {
      this.#hidePeek();
      return;
    }
    const p = positionFixed(a, this.#peek, this.#probe, 'bottom', 'start', 8);
    if (!p) {
      if (this.#placed) this.#hidePeek();
      return;
    }
    this.#placed = true;
  }

  #hidePeek(): void {
    clearTimeout(this.#openTimer);
    clearTimeout(this.#graceTimer);
    if (!this.#peekShown) return;
    this.#peekShown = false;
    this.#peekAnchor = null;
    this.#peekAt = -1;
    this.#peek.classList.remove('is-open');
    this.#unwatch?.();
    this.#unwatch = null;
    document.removeEventListener('keydown', this.#onDocKey, true);
    document.removeEventListener('pointerdown', this.#onDocDown, true);
    // Drop the preview (a frame, a large image) once the exit has played.
    clearTimeout(this.#clearTimer);
    this.#clearTimer = setTimeout(() => {
      if (!this.#peekShown) this.#peek.replaceChildren();
    }, 200);
  }

  /** Esc dismisses the peek without moving the pointer — and without taking the key from anyone else. */
  readonly #onDocKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.#hidePeek();
  };

  /** A press anywhere but on the peek itself (a click there opens the file) puts the peek away. */
  readonly #onDocDown = (e: Event): void => {
    if (!e.composedPath().includes(this.#peek)) this.#hidePeek();
  };
}

define('ui-artifact-viewer', UiArtifactViewer);

declare global {
  interface HTMLElementTagNameMap {
    'ui-artifact-viewer': UiArtifactViewer;
  }
}
