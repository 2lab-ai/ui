import { define, UiElement } from '../../core/element';
import { morphInto } from '../../core/morph';
import { type FileCardVariant, type FileItem, fileCardHtml, fileCardVariant } from './render';
import { styles } from './styles';

/** `ui-open` detail: the person asked to open this file. */
export interface FileOpenDetail {
  id: string;
}

/**
 * `<ui-file-card>` — one file at a glance: a thumbnail tile (image, or the kind's glyph on a soft wash with the
 * extension), a list row, or a chip. The whole card is one button; activating it sends a cancelable `ui-open`.
 * A thumbnail that fails to load falls back to the glyph.
 */
export class UiFileCard extends UiElement<FileItem> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['variant', 'lang'];
  }

  /** Thumbnail sources that failed: drawn as the glyph from then on. */
  readonly #broken = new Set<string>();

  constructor() {
    super();
    this.root.addEventListener('click', (e) => {
      if (!(e.target as Element | null)?.closest?.('.fc')) return;
      const d = this.data;
      if (d) this.emit<FileOpenDetail>('ui-open', { id: String(d.id ?? '') });
    });
    // `error` does not bubble: catch it on the way down.
    this.root.addEventListener(
      'error',
      (e) => {
        const img = e.target as Element | null;
        if (img?.tagName !== 'IMG') return;
        const src = img.getAttribute('src') ?? '';
        if (!src || this.#broken.has(src)) return;
        this.#broken.add(src);
        this.requestRender();
      },
      true,
    );
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  /** The `variant` attribute (`tile` by default). */
  get variant(): FileCardVariant {
    return fileCardVariant(this.getAttribute('variant'));
  }

  set variant(v: FileCardVariant) {
    this.setAttribute('variant', fileCardVariant(v));
  }

  /** Patch in place: the button (and its focus) survives a data update. */
  protected override update(): void {
    morphInto(this.content, this.render());
    this.updated();
  }

  protected render(): string {
    const d = this.data;
    if (!d || typeof d !== 'object') return '';
    return fileCardHtml(d, this.variant, this.getAttribute('lang') ?? 'en', {
      broken: this.#broken,
      attrs: { 'data-key': 'open' },
    });
  }
}

define('ui-file-card', UiFileCard);

declare global {
  interface HTMLElementTagNameMap {
    'ui-file-card': UiFileCard;
  }
}
