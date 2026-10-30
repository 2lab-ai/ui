import { define, UiElement } from '../../core/element';
import { type FileKind, fileExt, fileKind, fileKindIcon, fmtBytes } from '../../core/files';
import { fmtClock, fmtInt } from '../../core/format';
import { esc, escAttr, safeSrc } from '../../core/html';
import { morphInto } from '../../core/morph';
import { icon } from '../../icons/icons';
import {
  type ComposerData,
  type ComposerFilesDetail,
  type ComposerInputDetail,
  type ComposerOverCapDetail,
  type ComposerRecordDetail,
  type ComposerRejectDetail,
  type ComposerRejectReason,
  type ComposerSettings,
  type ComposerSubmitDetail,
  type ComposerTool,
  type ComposerToolDetail,
  composerCanSend,
  composerCheckFile,
  composerCounterTone,
  composerEnterAction,
  composerEnterMode,
  composerLevel,
  composerPastedName,
  composerRecorderMime,
  composerSettings,
  composerTools,
  composerVoiceName,
} from './logic';
import { type ComposerStrings, composerStrings } from './strings';
import { styles } from './styles';

/** One attached file. `url` is its object URL (images: thumbnail, audio: playback), made lazily, revoked on leave. */
interface Entry {
  id: number;
  file: File;
  kind: FileKind;
  url: string;
  /** A voice note recorded here: its length. */
  voiceMs: number;
  /** Present on first paint: no enter animation. */
  still: boolean;
}

/** A recording in progress. */
interface Rec {
  gen: number;
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  mime: string;
  started: number;
  stoppedAt: number;
  keep: boolean;
  finished: boolean;
  ctx: AudioContext | null;
  analyser: AnalyserNode | null;
  buf: Uint8Array<ArrayBuffer> | null;
  raf: number;
  timer: number;
}

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v));
const isTouch = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
/** ⌘ on Apple keyboards, Ctrl elsewhere (the newline mode's hint). */
const modKey = (): string =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '')
    ? '⌘'
    : 'Ctrl';
/** Recording needs both getUserMedia and MediaRecorder. */
export const composerCanRecord = (): boolean =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getUserMedia === 'function' &&
  typeof (globalThis as { MediaRecorder?: unknown }).MediaRecorder === 'function';
const stopTracks = (stream: MediaStream | null | undefined): void => {
  for (const t of stream?.getTracks?.() ?? []) {
    try {
      t.stop();
    } catch {
      // Already stopped.
    }
  }
};
/** Whole seconds, so the m:ss clock counts up instead of rounding ahead. */
const floorSec = (ms: number): number => Math.floor(Math.max(0, ms) / 1000) * 1000;

/**
 * `<ui-composer>` — write a message, drop or paste files, record a voice note, and send. The field grows with its
 * text (2–10 rows), Enter sends (Shift+Enter is a new line, never on an IME composition Enter, touch Enter is a new
 * line), attachments show as chips (image thumbnails, a play button for audio), limits reject with an inline error,
 * and the voice recorder takes the toolbar's row with a live level meter. No network: `ui-submit` hands the host the
 * text and the File objects; unless cancelled the composer clears itself.
 *
 * The tree is patched in place (`morphInto`), and nothing re-renders while typing, so focus, selection and an IME
 * composition survive host updates.
 */
export class UiComposer extends UiElement<ComposerData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang', 'enter', 'fill'];
  }

  readonly #live: HTMLElement;
  #ta: HTMLTextAreaElement | null = null;
  /** Text set before the field exists. */
  #draft = '';
  /** The last `data.value` applied to the field. */
  #applied: string | undefined;
  #entries: Entry[] = [];
  #seq = 0;
  #painted = false;
  #error = '';
  #height = 0;
  #scrollEnd = false;
  #wantFocus: string | null = null;
  #drag = 0;
  #dragOn = false;
  /** Local toggle state of host tools until `data.tools` changes. */
  #pressed = new Map<string, boolean>();
  #toolsRef: unknown;
  #rec: Rec | null = null;
  #recGen = 0;
  #recPending = false;
  #level = 0;
  #barEnter = false;
  #sendAfterRec = false;
  #audio: HTMLAudioElement | null = null;
  #playing = -1;
  #ro: ResizeObserver | null = null;
  #roWidth = -1;
  #roRaf = 0;

  constructor() {
    super();
    // Outside the patched markup: no update ever re-creates the live region.
    this.#live = document.createElement('span');
    this.#live.className = 'sr-only';
    this.#live.setAttribute('role', 'status');
    this.#live.setAttribute('aria-live', 'polite');
    this.root.append(this.#live);
    this.root.addEventListener('click', (e) => this.#onClick(e));
    this.root.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    this.root.addEventListener('input', (e) => this.#onInput(e));
    this.root.addEventListener('change', (e) => this.#onChange(e));
    this.root.addEventListener('paste', (e) => this.#onPaste(e as ClipboardEvent));
    // On the host: drag events from inside the shadow tree are composed and reach it; so do ones dispatched on it.
    this.addEventListener('dragenter', (e) => this.#onDragEnter(e as DragEvent));
    this.addEventListener('dragover', (e) => this.#onDragOver(e as DragEvent));
    this.addEventListener('dragleave', () => this.#onDragLeave());
    this.addEventListener('drop', (e) => this.#onDrop(e as DragEvent));
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override get data(): ComposerData | undefined {
    return super.data;
  }

  override set data(v: ComposerData | undefined) {
    super.data = v;
    const value = v?.value;
    if (value !== undefined && value !== null && String(value) !== this.#applied) {
      this.#applied = String(value);
      this.#setText(this.#applied);
    }
    // Read-only now: a recording in progress (or a microphone prompt still pending) is discarded, a preview stops.
    if (composerSettings(v).disabled) {
      if (this.#rec || this.#recPending) this.#stopRecording(false);
      this.pause();
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.#ta) this.#observe();
  }

  override disconnectedCallback(): void {
    // A microphone permission still pending belongs to no one now: its stream is released when it arrives.
    this.#recGen++;
    this.#recPending = false;
    this.#sendAfterRec = false;
    if (this.#rec) this.#stopRecording(false);
    this.#audio?.pause();
    this.#playing = -1;
    // Revoked, not dropped: a re-attached composer makes fresh URLs on its next render.
    for (const e of this.#entries) this.#revoke(e);
    this.#drag = 0;
    this.#dragOn = false;
    this.#ro?.disconnect();
    this.#ro = null;
    if (this.#roRaf) cancelAnimationFrame(this.#roRaf);
    this.#roRaf = 0;
  }

  // ── Public API ──

  /** The field's text. Setting it does not send `ui-input`. */
  get value(): string {
    return this.#ta ? this.#ta.value : this.#draft;
  }

  set value(v: string) {
    this.#setText(str(v));
  }

  /** The attached files, in order (a copy). */
  get files(): File[] {
    return this.#entries.map((e) => e.file);
  }

  /** Attach files (checked against maxFiles / maxFileSize / maxTotalBytes / accept). Returns the ones taken. */
  addFiles(list: FileList | Iterable<File> | ArrayLike<File> | null | undefined): File[] {
    if (!list) return this.#add([]);
    return this.#add(Array.from(list as ArrayLike<File>));
  }

  /** Remove the file at `index` (its object URL is revoked). */
  removeFile(index: number): void {
    const i = Math.floor(Number(index));
    if (i >= 0 && i < this.#entries.length) this.#removeAt(i);
  }

  /** Empty the composer: text, files (URLs revoked), the error line, and any recording (discarded). */
  clear(): void {
    if (this.#rec || this.#recPending) this.#stopRecording(false);
    this.#sendAfterRec = false;
    const hadText = this.value !== '';
    const hadFiles = this.#entries.length > 0;
    for (const e of this.#entries) this.#release(e);
    this.#entries = [];
    this.#error = '';
    this.#setText('');
    if (hadText) this.notify<ComposerInputDetail>('ui-input', { value: '' });
    if (hadFiles) this.notify<ComposerFilesDetail>('ui-files', { files: [] });
  }

  /** What a plain Enter does: the `enter` attribute, else `data.enter` (`send` by default). */
  get enter(): 'send' | 'newline' {
    return composerEnterMode(this.getAttribute('enter') ?? this.data?.enter);
  }

  /**
   * Pause a chip's audio preview (no event). Done for you when the composer is disabled or hidden (a closed sheet,
   * `display: none`), and when it leaves the page.
   */
  pause(): void {
    if (this.#playing < 0) return;
    this.#playing = -1;
    try {
      this.#audio?.pause();
    } catch {
      // Nothing playing.
    }
    this.#paint();
  }

  /** Discard a recording in progress, or a microphone prompt still pending (`ui-record` cancel); the rest stays. */
  cancelRecording(): void {
    if (this.#rec || this.#recPending) this.#stopRecording(false);
  }

  /** Focus the field. */
  override focus(options?: FocusOptions): void {
    if (!this.#ta && this.isConnected) this.renderNow();
    if (this.#ta) this.#ta.focus(options);
    else super.focus(options);
  }

  // ── State helpers ──

  get #t(): ComposerStrings {
    return composerStrings[this.getAttribute('lang') === 'ko' ? 'ko' : 'en'];
  }

  get #s(): ComposerSettings {
    return composerSettings(this.data);
  }

  #paint(): void {
    if (this.isConnected) this.renderNow();
  }

  #say(text: string): void {
    this.#live.textContent = text;
  }

  #setText(text: string): void {
    if (this.#ta) {
      this.#ta.value = text;
      this.#autosize();
    } else this.#draft = text;
    this.#paint();
  }

  #sendable(s: ComposerSettings): boolean {
    const v = this.value;
    if (s.disabled || s.busy) return false;
    if (s.maxLength && v.length > s.maxLength) return false;
    return composerCanSend(v, this.#entries.length);
  }

  #activeInside(): HTMLElement | null {
    try {
      const a = this.root.activeElement as HTMLElement | null;
      return a && this.content.contains(a) ? a : null;
    } catch {
      return null;
    }
  }

  #focusKey(key: string): void {
    const el = this.$$<HTMLElement>('[data-key]').find((n) => n.dataset.key === key);
    const target = el && !(el as HTMLButtonElement).disabled ? el : this.#ta;
    target?.focus({ preventScroll: true });
  }

  // ── Files ──

  #add(items: unknown[], voiceMs = 0): File[] {
    const s = this.#s;
    const t = this.#t;
    const accepted: File[] = [];
    const rejected: Array<{ file: File; reason: ComposerRejectReason }> = [];
    let total = this.#entries.reduce((n, e) => n + (Number(e.file.size) || 0), 0);
    for (const item of items) {
      if (!item || typeof item !== 'object' || typeof (item as Blob).size !== 'number') continue;
      const file = item as File;
      const reason = composerCheckFile(file, {
        count: this.#entries.length,
        maxFiles: s.maxFiles,
        maxFileSize: s.maxFileSize,
        accept: s.accept,
        total,
        maxTotalBytes: s.maxTotalBytes,
      });
      // Over the total: the host may take it anyway (it compresses, or uploads it apart).
      const refuse =
        reason === 'total' &&
        this.emit<ComposerOverCapDetail>('ui-over-cap', {
          name: str(file.name),
          file,
          size: file.size,
          total,
          max: s.maxTotalBytes,
        });
      if (reason && (reason !== 'total' || refuse)) {
        rejected.push({ file, reason });
        continue;
      }
      total += Number(file.size) || 0;
      this.#entries.push({ id: ++this.#seq, file, kind: fileKind(file), url: '', voiceMs, still: !this.#painted });
      accepted.push(file);
    }
    this.#error = rejected.length ? this.#rejectText(rejected, s, t) : '';
    for (const r of rejected)
      this.notify<ComposerRejectDetail>('ui-reject', { name: str(r.file.name), reason: r.reason, file: r.file });
    if (accepted.length) {
      // Files added later scroll into view; files there on first paint (a restored draft) start at the first chip.
      this.#scrollEnd = this.#painted;
      this.#say(accepted.length === 1 ? t.attached(accepted[0].name || t.untitled) : t.attachedMany(accepted.length));
      this.notify<ComposerFilesDetail>('ui-files', { files: this.files });
    }
    this.#paint();
    return accepted;
  }

  #rejectText(list: Array<{ file: File; reason: ComposerRejectReason }>, s: ComposerSettings, t: ComposerStrings) {
    const other = list.filter((r) => r.reason !== 'count');
    if (!other.length) return t.tooMany(s.maxFiles);
    const first = other[0];
    const why =
      first.reason === 'size'
        ? t.tooLarge(fmtBytes(s.maxFileSize))
        : first.reason === 'total'
          ? t.tooLargeTotal(fmtBytes(s.maxTotalBytes))
          : first.reason === 'type'
            ? t.badType
            : t.empty;
    const msg = `${first.file.name || t.untitled} — ${why}`;
    return list.length > 1 ? msg + t.more(list.length - 1) : msg;
  }

  #removeAt(i: number): void {
    const [e] = this.#entries.splice(i, 1);
    if (!e) return;
    this.#release(e);
    this.#error = '';
    this.#say(this.#t.removed(e.file.name || this.#t.untitled));
    this.notify<ComposerFilesDetail>('ui-files', { files: this.files });
    this.#paint();
  }

  /** The user's remove: focus goes to the next chip's remove button, else the previous one, else the field. */
  #removeById(id: number): void {
    if (this.#s.disabled) return;
    const i = this.#entries.findIndex((e) => e.id === id);
    if (i < 0) return;
    if (this.#activeInside()) {
      const next = this.#entries[i + 1] ?? this.#entries[i - 1];
      this.#wantFocus = next ? `rm-${next.id}` : 'field';
    }
    this.#removeAt(i);
  }

  #release(e: Entry): void {
    if (this.#playing === e.id) {
      this.#playing = -1;
      this.#audio?.pause();
    }
    this.#revoke(e);
  }

  #revoke(e: Entry): void {
    if (!e.url) return;
    try {
      URL.revokeObjectURL(e.url);
    } catch {
      // Nothing to release.
    }
    e.url = '';
  }

  #urlOf(e: Entry): string {
    if (!e.url && (e.kind === 'image' || e.kind === 'audio') && typeof URL?.createObjectURL === 'function') {
      try {
        e.url = URL.createObjectURL(e.file);
      } catch {
        e.url = '';
      }
    }
    return e.url;
  }

  /** User paths (picker, paste, drop) are off while the composer is disabled. */
  #userAdd(files: File[]): void {
    if (this.#s.disabled || !files.length) return;
    this.#add(files);
  }

  #pick(which: 'file' | 'image' | 'camera'): void {
    if (this.#s.disabled) return;
    this.$<HTMLInputElement>(`.cp-in-${which}`)?.click();
  }

  #play(id: number): void {
    const e = this.#entries.find((x) => x.id === id);
    if (!e) return;
    if (!this.#audio && typeof Audio === 'function') {
      const a = new Audio();
      const done = () => {
        // A late pause from swapping `src` to another note while it plays is not the end of the new one.
        if (this.#playing < 0 || !a.paused) return;
        this.#playing = -1;
        this.#paint();
      };
      a.addEventListener('ended', done);
      a.addEventListener('pause', done);
      this.#audio = a;
    }
    const a = this.#audio;
    if (!a) return;
    if (this.#playing === id) {
      a.pause();
      return;
    }
    const url = this.#urlOf(e);
    if (!url) return;
    a.src = url;
    this.#playing = id;
    try {
      const p = a.play() as Promise<void> | undefined;
      p?.catch?.(() => {
        if (this.#playing !== id) return;
        this.#playing = -1;
        this.#paint();
      });
    } catch {
      this.#playing = -1;
    }
    this.#paint();
  }

  // ── Events ──

  #onClick(e: Event): void {
    const target = e.target as HTMLElement | null;
    const btn = target?.closest?.<HTMLElement>('[data-act]');
    if (!btn) {
      // A click on the card's empty space puts the caret in the field.
      if (target?.matches?.('.cp-card, .cp-bar, .cp-end')) this.#ta?.focus();
      return;
    }
    const id = btn.dataset.id ?? '';
    switch (btn.dataset.act) {
      case 'attach':
        this.#pick('file');
        break;
      case 'image':
        this.#pick('image');
        break;
      case 'camera':
        this.#pick('camera');
        break;
      case 'voice':
        void this.#startRecording();
        break;
      case 'tool':
        this.#tool(id);
        break;
      case 'send':
        this.#submit();
        break;
      case 'remove':
        this.#removeById(Number(id));
        break;
      case 'play':
        this.#play(Number(id));
        break;
      case 'rec-cancel':
        this.#stopRecording(false);
        break;
      case 'rec-done':
        this.#stopRecording(true);
        break;
    }
  }

  #onKey(e: KeyboardEvent): void {
    if (e.defaultPrevented) return;
    if (e.key === 'Escape' && (this.#rec || this.#recPending)) {
      e.preventDefault();
      e.stopPropagation();
      this.#stopRecording(false);
      return;
    }
    if (!this.#ta || e.target !== this.#ta) return;
    if (composerEnterAction(e, { touch: isTouch(), enter: this.enter }) !== 'send') return;
    // Enter never inserts a new line here, even when there is nothing to send (or sending is off).
    e.preventDefault();
    this.#submit();
  }

  /** Typing: no re-render — the height, counter and send state update in place (IME-safe). */
  #onInput(e: Event): void {
    if (!this.#ta || e.target !== this.#ta) return;
    this.#autosize();
    if (this.#error) {
      this.#error = '';
      this.#paint();
    } else this.#syncInPlace();
    this.notify<ComposerInputDetail>('ui-input', { value: this.#ta.value });
  }

  #syncInPlace(): void {
    const s = this.#s;
    this.$('.cp-send')?.setAttribute('aria-disabled', String(!this.#sendable(s)));
    const count = this.$('.cp-count');
    if (count && s.maxLength) {
      const text = this.#countText(s);
      if (count.textContent !== text) count.textContent = text;
      count.setAttribute('data-tone', composerCounterTone(this.value.length, s.maxLength));
    }
  }

  #countText(s: ComposerSettings): string {
    return `${fmtInt(this.value.length)} / ${fmtInt(s.maxLength)}`;
  }

  #onChange(e: Event): void {
    const input = e.target as HTMLInputElement | null;
    if (!input?.matches?.('.cp-in')) return;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.#userAdd(files);
  }

  /** Files in the clipboard are attached; a plain text paste is left alone. */
  #onPaste(e: ClipboardEvent): void {
    if (this.#s.disabled) return;
    const cd = e.clipboardData;
    const files = cd?.files ? Array.from(cd.files) : [];
    if (!files.length) return;
    // Copied text that came with an image (an office app) still pastes as text.
    if (!cd?.getData('text/plain')) e.preventDefault();
    const now = new Date();
    this.#userAdd(
      files.map((f) => {
        const name = composerPastedName(f, now);
        return name === f.name ? f : new File([f], name, { type: f.type, lastModified: f.lastModified });
      }),
    );
  }

  #dropOk(e: DragEvent): boolean {
    if (this.#s.disabled) return false;
    const types = e.dataTransfer?.types;
    return !!types && Array.from(types as ArrayLike<string>).includes('Files');
  }

  #setDrag(on: boolean): void {
    if (this.#dragOn === on) return;
    this.#dragOn = on;
    this.$('.cp-card')?.toggleAttribute('data-drag', on);
  }

  #onDragEnter(e: DragEvent): void {
    if (!this.#dropOk(e)) return;
    e.preventDefault();
    this.#drag++;
    this.#setDrag(true);
  }

  #onDragOver(e: DragEvent): void {
    if (!this.#dropOk(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    this.#drag = Math.max(1, this.#drag);
    this.#setDrag(true);
  }

  /** A counter, not the target: entering a child fires leave on the parent first, so the overlay never flickers. */
  #onDragLeave(): void {
    if (!this.#drag) return;
    this.#drag--;
    if (!this.#drag) this.#setDrag(false);
  }

  #onDrop(e: DragEvent): void {
    this.#drag = 0;
    this.#setDrag(false);
    if (!this.#dropOk(e)) return;
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (!files.length) return;
    e.preventDefault();
    this.#userAdd(files);
  }

  #tool(id: string): void {
    const tool = composerTools(this.data?.tools).find((x) => x.id === id);
    if (!tool || tool.disabled || this.#s.disabled) return;
    const toggle = typeof tool.pressed === 'boolean';
    const cur = this.#isPressed(tool);
    const detail: ComposerToolDetail = toggle ? { id, pressed: !cur } : { id };
    if (!this.emit<ComposerToolDetail>('ui-tool', detail)) return;
    if (!toggle) return;
    this.#pressed.set(id, !cur);
    this.#paint();
  }

  #isPressed(tool: ComposerTool): boolean {
    return this.#pressed.get(tool.id) ?? !!tool.pressed;
  }

  #submit(): void {
    const s = this.#s;
    if (s.disabled || s.busy || this.#recPending) return;
    if (this.#rec) {
      // Send what was said too: the recording is filed first, then the message goes.
      this.#sendAfterRec = true;
      this.#stopRecording(true);
      return;
    }
    if (!this.#sendable(s)) return;
    const detail: ComposerSubmitDetail = { text: this.value.trim(), files: this.files };
    if (!this.emit<ComposerSubmitDetail>('ui-submit', detail)) return;
    this.clear();
    this.#ta?.focus({ preventScroll: true });
  }

  // ── Autosize ──

  #autosize(): void {
    const ta = this.#ta;
    if (!ta) return;
    ta.style.height = 'auto';
    const h = Math.ceil(ta.scrollHeight || 0);
    this.#height = Math.max(h, 0);
    // The same string render() writes, so a later patch leaves the attribute alone. CSS clamps to min/max rows.
    if (this.#height) ta.setAttribute('style', `height:${this.#height}px`);
    else ta.removeAttribute('style');
  }

  #observe(): void {
    this.#ro?.disconnect();
    this.#ro = null;
    if (!this.#ta || typeof ResizeObserver !== 'function') return;
    this.#ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      const w = Math.round(box?.width ?? 0);
      // Hidden (a closed sheet, display: none): a preview stops with it.
      if (box && !box.width && !box.height) this.pause();
      if (w === this.#roWidth) return;
      this.#roWidth = w;
      // Next frame: resizing the observed node inside its own callback would loop.
      if (this.#roRaf) cancelAnimationFrame(this.#roRaf);
      this.#roRaf = requestAnimationFrame(() => {
        this.#roRaf = 0;
        this.#autosize();
      });
    });
    this.#ro.observe(this.#ta);
  }

  // ── Voice recorder ──

  async #startRecording(): Promise<void> {
    if (this.#s.disabled || this.#rec || this.#recPending || !composerCanRecord()) return;
    this.#error = '';
    this.#audio?.pause();
    const gen = ++this.#recGen;
    this.#recPending = true;
    this.#paint();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (gen !== this.#recGen) return;
      this.#recPending = false;
      this.#recFail(err);
      return;
    }
    if (gen !== this.#recGen || !this.isConnected || this.#s.disabled) {
      stopTracks(stream);
      if (gen === this.#recGen) {
        this.#recPending = false;
        this.#paint();
      }
      return;
    }
    this.#recPending = false;
    const MR = (globalThis as unknown as { MediaRecorder: typeof MediaRecorder }).MediaRecorder;
    const mime = composerRecorderMime((type) => !!MR.isTypeSupported?.(type));
    let recorder: MediaRecorder;
    try {
      try {
        recorder = mime ? new MR(stream, { mimeType: mime }) : new MR(stream);
      } catch {
        recorder = new MR(stream);
      }
    } catch (err) {
      stopTracks(stream);
      this.#recFail(err);
      return;
    }
    const rec: Rec = {
      gen,
      recorder,
      stream,
      chunks: [],
      mime: recorder.mimeType || mime || 'audio/webm',
      started: Date.now(),
      stoppedAt: 0,
      keep: false,
      finished: false,
      ctx: null,
      analyser: null,
      buf: null,
      raf: 0,
      timer: 0,
    };
    recorder.ondataavailable = (ev: BlobEvent) => {
      if (ev.data?.size) rec.chunks.push(ev.data);
    };
    recorder.onstop = () => this.#finishRecording(rec);
    try {
      recorder.start(1000);
    } catch (err) {
      stopTracks(stream);
      this.#recFail(err);
      return;
    }
    try {
      const AC =
        (globalThis as { AudioContext?: typeof AudioContext }).AudioContext ??
        (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        rec.ctx = new AC();
        rec.analyser = rec.ctx.createAnalyser();
        rec.analyser.fftSize = 512;
        rec.ctx.createMediaStreamSource(stream).connect(rec.analyser);
        rec.buf = new Uint8Array(rec.analyser.fftSize);
      }
    } catch {
      // No level meter; the recording itself works.
      rec.analyser = null;
    }
    this.#rec = rec;
    this.#level = 0;
    const a = this.#activeInside();
    if (!a || a.dataset.act === 'voice') this.#wantFocus = 'rec-done';
    rec.timer = window.setInterval(() => this.#tick(rec), 250);
    this.#paint();
    this.#meter(rec);
    this.notify<ComposerRecordDetail>('ui-record', { state: 'start' });
  }

  #recFail(err: unknown): void {
    const e = err as { name?: unknown; message?: unknown } | null;
    const error = str(e?.name) || str(e?.message) || str(err) || 'Error';
    this.#error = this.#t.mic;
    this.#paint();
    this.notify<ComposerRecordDetail>('ui-record', { state: 'error', error });
  }

  #tick(rec: Rec): void {
    if (this.#rec !== rec) return;
    const ms = Date.now() - rec.started;
    const el = this.$('.cp-rec-time');
    const text = fmtClock(floorSec(ms));
    if (el && el.textContent !== text) el.textContent = text;
    if (ms >= this.#s.maxRecordMs) this.#stopRecording(true);
  }

  #levelStyle(): string {
    return `transform:scaleX(${this.#level.toFixed(3)})`;
  }

  /** The level bar follows the microphone every frame, in place. */
  #meter(rec: Rec): void {
    if (!rec.analyser || !rec.buf || typeof requestAnimationFrame !== 'function') return;
    const step = () => {
      if (this.#rec !== rec || !rec.analyser || !rec.buf) return;
      rec.analyser.getByteTimeDomainData(rec.buf);
      this.#level = composerLevel(rec.buf);
      this.$('.cp-level')?.setAttribute('style', this.#levelStyle());
      rec.raf = requestAnimationFrame(step);
    };
    rec.raf = requestAnimationFrame(step);
  }

  /** Done (`keep`) files the recording as a voice note; Cancel discards it. Tracks stop and the analyser closes. */
  #stopRecording(keep: boolean): void {
    const rec = this.#rec;
    if (!rec) {
      if (this.#recPending) {
        this.#recGen++;
        this.#recPending = false;
        this.#sendAfterRec = false;
        this.#paint();
      }
      return;
    }
    const inBar = !!this.#activeInside()?.closest('.cp-rec');
    this.#rec = null;
    rec.keep = keep;
    rec.stoppedAt = Date.now();
    clearInterval(rec.timer);
    if (rec.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rec.raf);
    try {
      if (rec.recorder.state !== 'inactive') rec.recorder.stop();
      else this.#finishRecording(rec);
    } catch {
      this.#finishRecording(rec);
    }
    stopTracks(rec.stream);
    try {
      const closing = rec.ctx?.close() as Promise<void> | undefined;
      closing?.catch?.(() => {});
    } catch {
      // Already closed.
    }
    this.#level = 0;
    this.#barEnter = true;
    if (inBar) this.#wantFocus = 'field';
    if (!keep) {
      this.#sendAfterRec = false;
      this.notify<ComposerRecordDetail>('ui-record', { state: 'cancel' });
    }
    this.#paint();
  }

  #finishRecording(rec: Rec): void {
    if (rec.finished) return;
    rec.finished = true;
    if (!rec.keep || rec.gen !== this.#recGen) return;
    const durationMs = Math.max(0, (rec.stoppedAt || Date.now()) - rec.started);
    let file: File | undefined;
    if (rec.chunks.length) {
      const type = rec.mime.split(';')[0].trim() || 'audio/webm';
      const made = new File(rec.chunks, composerVoiceName(new Date(), type), { type });
      // At least 1 ms: a voice note is told apart by its length, even one stopped within the same millisecond.
      file = this.#add([made], Math.max(1, durationMs))[0];
    }
    this.notify<ComposerRecordDetail>('ui-record', { state: 'stop', file, durationMs });
    if (this.#sendAfterRec) {
      this.#sendAfterRec = false;
      this.#submit();
    }
  }

  // ── Render ──

  /** Patch the live tree: the field, chips (keyed) and buttons keep their nodes, so focus and IME survive. */
  protected override update(): void {
    const active = this.#activeInside();
    const key = active?.dataset.key;
    morphInto(this.content, this.render());
    this.updated();
    if (this.#wantFocus) {
      const k = this.#wantFocus;
      this.#wantFocus = null;
      this.#focusKey(k);
    } else if (active && !active.isConnected && !this.#activeInside()) this.#focusKey(key ?? 'field');
  }

  protected override updated(): void {
    const ta = this.$<HTMLTextAreaElement>('.cp-field');
    if (ta && ta !== this.#ta) {
      this.#ta = ta;
      ta.value = this.#draft;
      this.#draft = '';
      this.#observe();
      this.#autosize();
    }
    if (this.#scrollEnd) {
      this.#scrollEnd = false;
      const list = this.$('.cp-files');
      if (list) list.scrollLeft = list.scrollWidth;
    }
    if (this.isConnected) this.#painted = true;
  }

  protected render(): string {
    const d = this.data ?? {};
    const t = this.#t;
    const s = this.#s;
    if (d.tools !== this.#toolsRef) {
      // The host answered (or replaced) its tools: its pressed states are the truth again.
      this.#toolsRef = d.tools;
      this.#pressed.clear();
    }
    const touch = isTouch();
    const showHint = !!d.hint && !this.#rec;
    const describedBy = [
      s.maxLength && !this.#rec ? 'cp-count' : '',
      showHint && !touch ? 'cp-hint' : '',
      s.reason ? 'cp-reason' : '',
      this.#error ? 'cp-error' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const label = str(d.label) || t.label;
    const placeholder = d.placeholder === undefined ? t.placeholder : str(d.placeholder);
    const field = `<textarea class="cp-field" id="cp-field" data-mk="field" data-key="field" rows="${s.minRows}" dir="auto" autocomplete="off" aria-label="${escAttr(
      label,
    )}"${placeholder ? ` placeholder="${escAttr(placeholder)}"` : ''}${describedBy ? ` aria-describedby="${describedBy}"` : ''}${
      s.disabled ? ' readonly' : ''
    }${this.#height ? ` style="height:${this.#height}px"` : ''}></textarea>`;
    const files = this.#entries.length
      ? `<ul class="cp-files" data-mk="files" aria-label="${escAttr(t.attachments)}">${this.#entries
          .map((e) => this.#chip(e, s, t))
          .join('')}</ul>`
      : '';
    const error = `<p class="cp-error" id="cp-error" data-mk="error" role="alert"${this.#error ? '' : ' hidden'}>${
      this.#error ? `${icon('alert', { size: 14 })}<span>${esc(this.#error)}</span>` : ''
    }</p>`;
    const row = this.#rec ? this.#recorderBar(this.#rec, t) : this.#toolbar(d, s, t, showHint);
    const accept = s.accept ? ` accept="${escAttr(s.accept)}"` : '';
    const camera = s.camera
      ? `<input type="file" class="cp-in cp-in-camera" data-mk="in-camera" hidden tabindex="-1" accept="image/*" capture="${s.camera}">`
      : '';
    const inputs = `<input type="file" class="cp-in cp-in-file" data-mk="in-file" multiple hidden tabindex="-1"${accept}><input type="file" class="cp-in cp-in-image" data-mk="in-image" multiple hidden tabindex="-1" accept="image/*">${camera}`;
    const progress =
      s.progress === null
        ? ''
        : `<div class="cp-progress" data-mk="progress" role="progressbar" aria-label="${escAttr(t.uploading)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(
            s.progress * 100,
          )}"><span class="cp-progress-bar" style="transform:scaleX(${s.progress.toFixed(3)})"></span></div>`;
    const drop = `<div class="cp-drop" aria-hidden="true">${icon('attach', { size: 16 })}<span>${esc(t.drop)}</span></div>`;
    const reason = s.reason
      ? `<p class="cp-reason" id="cp-reason">${icon('info', { size: 14 })}<span>${esc(s.reason)}</span></p>`
      : '';
    return `<div class="cp" data-mk="cp"${s.disabled ? ' data-disabled' : ''}${s.busy ? ' data-busy' : ''}><div class="cp-card" data-mk="card" style="--cp-min:${s.minRows};--cp-max:${s.maxRows}"${
      this.#dragOn ? ' data-drag' : ''
    }>${field}${files}${error}${progress}${row}${inputs}${drop}</div>${reason}</div>`;
  }

  #chip(e: Entry, s: ComposerSettings, t: ComposerStrings): string {
    const name = e.file.name || t.untitled;
    let tile = `<span class="cp-tile" aria-hidden="true">${icon(fileKindIcon(e.kind), { size: 16 })}</span>`;
    if (e.kind === 'image') {
      const src = safeSrc(this.#urlOf(e));
      if (src) tile = `<img class="cp-thumb" src="${src}" alt="" draggable="false">`;
    } else if (e.kind === 'audio' && typeof Audio === 'function') {
      const on = this.#playing === e.id;
      tile = `<button type="button" class="cp-tile cp-play" data-act="play" data-id="${e.id}" data-key="play-${e.id}" aria-label="${escAttr(
        on ? t.stop(name) : t.play(name),
      )}">${icon(on ? 'stop' : 'play', { size: 14 })}</button>`;
    }
    const meta = e.voiceMs
      ? `${t.voiceNote} · ${fmtClock(Math.max(1000, Math.round(e.voiceMs / 1000) * 1000))}`
      : [fileExt(name).toUpperCase(), fmtBytes(e.file.size)].filter(Boolean).join(' · ');
    return `<li class="cp-chip" data-mk="f-${e.id}"${e.still ? ' data-still' : ''}>${tile}<span class="cp-chip-text"><span class="cp-name" title="${escAttr(
      name,
    )}">${esc(name)}</span><span class="cp-meta">${esc(meta)}</span></span><button type="button" class="cp-remove" data-act="remove" data-id="${e.id}" data-key="rm-${e.id}" aria-label="${escAttr(
      t.remove(name),
    )}"${s.disabled ? ' disabled' : ''}>${icon('close', { size: 12 })}</button></li>`;
  }

  #toolbar(d: ComposerData, s: ComposerSettings, t: ComposerStrings, showHint: boolean): string {
    const off = s.disabled;
    const builtIn = (act: string, glyph: string, label: string, extra = '') =>
      `<button type="button" class="cp-tool is-icon" data-mk="${act}" data-act="${act}" data-key="${act}" aria-label="${escAttr(
        label,
      )}" title="${escAttr(label)}"${off ? ' disabled' : ''}${extra}>${icon(glyph, { size: 16 })}</button>`;
    let tools = '';
    if (s.attach) tools += builtIn('attach', 'attach', t.attach);
    if (s.image) tools += builtIn('image', 'image', t.image);
    if (s.camera && isTouch()) tools += builtIn('camera', 'camera', t.camera);
    if (s.voice && composerCanRecord())
      tools += this.#recPending
        ? builtIn('voice', 'mic', t.waiting, ' aria-busy="true"')
        : builtIn('voice', 'mic', t.voice);
    for (const tool of composerTools(d.tools)) {
      const glyph = tool.icon ? icon(tool.icon, { size: 16 }) : '';
      const text = !glyph || !!tool.showLabel;
      const pressed = typeof tool.pressed === 'boolean' ? ` aria-pressed="${this.#isPressed(tool)}"` : '';
      const named = text ? '' : ` aria-label="${escAttr(tool.label)}" title="${escAttr(tool.label)}"`;
      tools += `<button type="button" class="cp-tool${text ? '' : ' is-icon'}" data-mk="tool:${escAttr(tool.id)}" data-act="tool" data-id="${escAttr(
        tool.id,
      )}" data-key="tool:${escAttr(tool.id)}"${named}${pressed}${off || tool.disabled ? ' disabled' : ''}>${glyph}${
        text ? `<span>${esc(tool.label)}</span>` : ''
      }</button>`;
    }
    const hintText = this.enter === 'newline' ? t.hintNewline(modKey()) : t.hint;
    const hint = showHint ? `<span class="cp-hint" id="cp-hint">${esc(hintText)}</span>` : '';
    const count = s.maxLength
      ? `<span class="cp-count" id="cp-count" data-tone="${composerCounterTone(this.value.length, s.maxLength)}">${this.#countText(s)}</span>`
      : '';
    const sendLabel = str(d.submitLabel).trim();
    const name = sendLabel || t.send;
    const inner = sendLabel
      ? `<span class="cp-send-text">${esc(sendLabel)}</span>${s.busy ? '<span class="cp-spin" aria-hidden="true"></span>' : icon('arrow-right', { size: 14 })}`
      : s.busy
        ? '<span class="cp-spin" aria-hidden="true"></span>'
        : icon('arrow-up', { size: 16 });
    const send = `<button type="button" class="cp-send${sendLabel ? ' has-label' : ''}" data-mk="send" data-act="send" data-key="send"${
      sendLabel ? '' : ` aria-label="${escAttr(name)}" title="${escAttr(name)}"`
    } aria-disabled="${!this.#sendable(s)}"${s.busy ? ' aria-busy="true"' : ''}>${inner}</button>`;
    return `<div class="cp-bar"${this.#barEnter ? ' data-enter' : ''}><div class="cp-tools">${tools}</div><div class="cp-end">${hint}${count}${send}</div></div>`;
  }

  #recorderBar(rec: Rec, t: ComposerStrings): string {
    return `<div class="cp-rec" role="group" aria-label="${escAttr(t.recording)}"><span class="cp-rec-dot" aria-hidden="true"></span><span class="cp-rec-time" role="timer">${fmtClock(
      floorSec(Date.now() - rec.started),
    )}</span><span class="cp-meter" aria-hidden="true"><span class="cp-level" style="${this.#levelStyle()}"></span></span><button type="button" class="cp-rec-btn" data-act="rec-cancel" data-key="rec-cancel">${esc(
      t.cancel,
    )}</button><button type="button" class="cp-rec-btn is-done" data-act="rec-done" data-key="rec-done">${esc(t.done)}</button></div>`;
  }
}

define('ui-composer', UiComposer);

declare global {
  interface HTMLElementTagNameMap {
    'ui-composer': UiComposer;
  }
}
