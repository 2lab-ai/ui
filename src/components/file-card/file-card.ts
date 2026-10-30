import { define, UiElement } from '../../core/element';
import { attrs, cls, safeSrc } from '../../core/html';
import { morphInto } from '../../core/morph';
import { icon } from '../../icons/icons';
import {
  FILE_STRINGS,
  type FileCardVariant,
  type FileItem,
  fileCardHtml,
  fileCardVariant,
  fileDisplayName,
  fileItemKind,
  filePlaySrc,
} from './render';
import { styles } from './styles';

/** `ui-open` detail: the person asked to open this file. */
export interface FileOpenDetail {
  id: string;
}

/** `ui-play` (cancelable) detail: the person pressed the play toggle; `playing` is the state the press asks for. */
export interface FilePlayDetail {
  id: string;
  playing: boolean;
  /** The source the card plays. */
  url: string;
}

/** The card playing now: one at a time across every `<ui-file-card>` on the page. */
let current: UiFileCard | null = null;

/**
 * `<ui-file-card>` — one file at a glance: a thumbnail tile (image, or the kind's glyph on a soft wash with the
 * extension), a list row, or a chip. The whole card is one button; activating it sends a cancelable `ui-open`.
 * A thumbnail that fails to load falls back to the glyph. With `playable`, an audio file (or a video tile) gets a
 * play / pause toggle beside the card and plays in place — one card at a time.
 */
export class UiFileCard extends UiElement<FileItem> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['variant', 'lang', 'playable'];
  }

  /** Thumbnail sources that failed: drawn as the glyph from then on. */
  readonly #broken = new Set<string>();
  /** The source the media element holds ('' until the first play: nothing loads before someone asks). */
  #src = '';
  #playing = false;
  /** Played share, 0..1 (the tile's progress line). */
  #progress = 0;

  constructor() {
    super();
    this.root.addEventListener('click', (e) => {
      const t = e.target as Element | null;
      if (t?.closest?.('.fc-play')) {
        this.#toggle();
        return;
      }
      if (!t?.closest?.('.fc')) return;
      const d = this.data;
      if (d) this.emit<FileOpenDetail>('ui-open', { id: String(d.id ?? '') });
    });
    // `error` does not bubble: catch it on the way down.
    this.root.addEventListener(
      'error',
      (e) => {
        const el = e.target as Element | null;
        if (el?.tagName === 'AUDIO' || el?.tagName === 'VIDEO') {
          this.#stopped();
          return;
        }
        if (el?.tagName !== 'IMG') return;
        const src = el.getAttribute('src') ?? '';
        if (!src || this.#broken.has(src)) return;
        this.#broken.add(src);
        this.requestRender();
      },
      true,
    );
    // Media events do not bubble either.
    this.root.addEventListener('play', (e) => this.#onPlay(e), true);
    this.root.addEventListener('pause', (e) => this.#onPause(e), true);
    this.root.addEventListener('ended', (e) => this.#onPause(e), true);
    this.root.addEventListener('timeupdate', (e) => this.#onTime(e), true);
  }

  override get data(): FileItem | undefined {
    return super.data;
  }

  /** Another file (or the same file at another source) stops what was playing. */
  override set data(value: FileItem | undefined) {
    super.data = value;
    if (this.#src && filePlaySrc(value, this.variant) !== this.#src) this.#reset();
  }

  attributeChangedCallback(name: string): void {
    if (this.#src && (name === 'playable' || name === 'variant') && !this.#playSrc()) this.#reset();
    this.requestRender();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.pause();
  }

  /** The `variant` attribute (`tile` by default). */
  get variant(): FileCardVariant {
    return fileCardVariant(this.getAttribute('variant'));
  }

  set variant(v: FileCardVariant) {
    this.setAttribute('variant', fileCardVariant(v));
  }

  /** The `playable` attribute: a play / pause toggle on audio files (any variant) and video tiles. */
  get playable(): boolean {
    return this.hasAttribute('playable');
  }

  set playable(on: boolean) {
    this.toggleAttribute('playable', !!on);
  }

  /** True while the card plays its file in place. */
  get playing(): boolean {
    return this.#playing;
  }

  /** Play the file in place (a playable card only; no `ui-play`). Whatever card played before pauses. */
  play(): void {
    const src = this.#playSrc();
    if (!src || !this.isConnected) return;
    if (this.#src !== src) {
      this.#src = src;
      this.#progress = 0;
    }
    this.renderNow();
    const m = this.#media();
    if (!m) return;
    try {
      const p = m.play() as Promise<void> | undefined;
      p?.catch?.(() => this.#stopped());
    } catch {
      this.#stopped();
    }
  }

  /** Pause in place (no `ui-play`). */
  pause(): void {
    const m = this.#media();
    if (m && !m.paused) {
      try {
        m.pause();
      } catch {}
    }
    if (this.#playing) this.#stopped();
  }

  #playSrc(): string {
    return this.playable ? filePlaySrc(this.data, this.variant) : '';
  }

  #media(): HTMLMediaElement | null {
    return this.$<HTMLMediaElement>('.fc-media');
  }

  #lang(): string {
    return this.getAttribute('lang') ?? 'en';
  }

  #toggle(): void {
    const src = this.#playSrc();
    if (!src) return;
    const want = !this.#playing;
    if (!this.emit<FilePlayDetail>('ui-play', { id: String(this.data?.id ?? ''), playing: want, url: src })) return;
    if (want) this.play();
    else this.pause();
  }

  #onPlay(e: Event): void {
    if (e.target !== this.#media()) return;
    if (current && current !== this) current.pause();
    current = this;
    if (!this.#playing) {
      this.#playing = true;
      this.requestRender();
    }
  }

  #onPause(e: Event): void {
    if (e.target !== this.#media()) return;
    if (e.type === 'ended') this.#progress = 0;
    this.#stopped();
  }

  #onTime(e: Event): void {
    const m = this.#media();
    if (e.target !== m || !m) return;
    const d = m.duration;
    const p = Number.isFinite(d) && d > 0 ? Math.min(1, Math.max(0, m.currentTime / d)) : 0;
    if (Math.abs(p - this.#progress) < 0.002) return;
    this.#progress = p;
    // In place: the bar's style is the same string render() writes.
    this.$('.fc-bar')?.setAttribute('style', this.#barStyle());
  }

  #stopped(): void {
    if (current === this) current = null;
    if (!this.#playing) return;
    this.#playing = false;
    this.requestRender();
  }

  /** Drop the media (another file, no longer playable). */
  #reset(): void {
    this.pause();
    this.#src = '';
    this.#progress = 0;
    this.requestRender();
  }

  #barStyle(): string {
    return `transform:scaleX(${this.#progress.toFixed(3)})`;
  }

  /** Patch in place: the button (and its focus) and a playing media element survive a data update. */
  protected override update(): void {
    morphInto(this.content, this.render());
    this.updated();
  }

  protected render(): string {
    const d = this.data;
    if (!d || typeof d !== 'object') return '';
    const lang = this.#lang();
    const variant = this.variant;
    const src = this.#playSrc();
    const card = fileCardHtml(d, variant, lang, {
      broken: this.#broken,
      attrs: { 'data-key': 'open' },
      className: src ? 'has-play' : undefined,
    });
    if (!src) return card;
    const t = lang === 'ko' ? FILE_STRINGS.ko : FILE_STRINGS.en;
    const name = fileDisplayName(d, lang);
    const label = this.#playing ? t.pause(name) : t.play(name);
    const video = fileItemKind(d) === 'video';
    const loaded = this.#src === src ? ` src="${safeSrc(src)}"` : '';
    const media = video
      ? `<video class="fc-media" data-mk="media" part="video" playsinline preload="metadata"${loaded}></video>`
      : `<audio class="fc-media" data-mk="media" preload="metadata"${loaded}></audio>`;
    const btn = `<button${attrs({
      type: 'button',
      class: 'fc-play',
      part: 'play',
      'data-key': 'play',
      'data-on': this.#playing,
      'aria-label': label,
      title: label,
    })}>${icon(this.#playing ? 'pause' : 'play', { size: 14 })}</button>`;
    if (variant !== 'tile') return `${card}${media}${btn}`;
    // Over the tile's thumbnail: the video, the progress line and the toggle (only the toggle takes the pointer).
    const bar = `<span class="fc-prog" part="progress" aria-hidden="true"><span class="fc-bar" style="${this.#barStyle()}"></span></span>`;
    const over = cls('fc-over', (this.#playing || this.#progress > 0) && 'is-live', video && loaded && 'has-video');
    return `${card}<span class="${over}" data-mk="over">${media}${bar}${btn}</span>`;
  }
}

define('ui-file-card', UiFileCard);

declare global {
  interface HTMLElementTagNameMap {
    'ui-file-card': UiFileCard;
  }
}
