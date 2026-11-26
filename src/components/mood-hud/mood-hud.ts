import { define, UiElement } from '../../core/element';
import { emptyReading } from '../mood/engine/core';
import { moodFactsOf, moodIgnored, moodPath } from '../mood/engine/facts';
import type { MoodReading, MoodTarget } from '../mood/engine/types';
import type { UiMood } from '../mood/mood';
import { motionOf, motionReduced, type VoiceMotion } from '../voice-glow/engine/env';
import { createHud, HUD_SETTLE_MS, type Hud, type HudPress, type HudReading } from './engine/hud';
import { styles } from './styles';

export type MoodHudLang = 'en' | 'ko';
export type MoodHudMotion = VoiceMotion;

const STRINGS = {
  en: {
    names: { neutral: 'neutral', frustrated: 'frustrated', confused: 'confused', lost: 'lost', away: 'away' },
    disabled: 'disabled',
    invalid: 'invalid',
  },
  ko: {
    names: { neutral: '평온', frustrated: '답답함', confused: '헷갈림', lost: '헤맴', away: '자리 비움' },
    disabled: '비활성',
    invalid: '잘못됨',
  },
};

/** Presses the HUD keeps (its trail shows the last 8 s). */
const PRESS_MS = 8000;
/** The pointer resting this long over a calm reading stops the frames. */
const REST_MS = 4000;

/** The HUD's reading from a mood reading: the name in the HUD's language, L C A F and the fast signals. */
export function hudReadingOf(r: MoodReading, lang: MoodHudLang = 'en'): HudReading {
  const s = STRINGS[lang];
  return {
    score: r.score,
    name: s.names[r.mood ?? 'neutral'],
    lead: r.mood,
    probs: [r.scores.lost, r.scores.confused, r.away ? 1 : 0, r.scores.frustrated],
    alert: r.alert,
    instant: r.fast,
  };
}

/** How the readout names a control: `BUTTON#PAY · DISABLED` — its tag, id and role, and its state; never its text. */
export function hudTargetText(t: MoodTarget | null, lang: MoodHudLang = 'en'): string | null {
  if (!t) return null;
  const s = STRINGS[lang];
  const name = `${t.tag}${t.id ? `#${t.id}` : ''}${t.role && t.role !== t.tag ? `[${t.role}]` : ''}`;
  const states = [t.disabled ? s.disabled : '', t.invalid ? s.invalid : ''].filter(Boolean);
  return [name, ...states].join(' · ');
}

/**
 * `<ui-mood-hud>` — see what the mood reader reads. Wrap the markup inside a `<ui-mood>` (or point `for` at one) and a
 * cursor HUD follows the pointer over it: corner brackets that tighten as the score rises, scan boxes, a dust trail,
 * a wave on each press, and a readout with the mood and its score, the pointer's position, L C A F (lost, confused,
 * away, frustrated) and I (the fast signals), naming the control being fought with over the alert line. For tuning a
 * screen and for showing what the reader sees; it is decorative (aria-hidden) and draws nothing while the pointer is
 * elsewhere.
 *
 * The HUD is Libraries.dev's Mood recognition page HUD (MIT, © 2026 Jakub Antalik), see `engine/hud.ts`.
 */
export class UiMoodHud extends UiElement<undefined> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return ['for', 'motion', 'lang'];
  }

  #hud: Hud | null = null;
  #layer: HTMLElement | null = null;
  #mood: UiMood | null = null;
  #reading: MoodReading = emptyReading();
  #presses: HudPress[] = [];
  #x = 0;
  #y = 0;
  #inside = false;
  #lastActivity = Number.NEGATIVE_INFINITY;
  #raf = 0;
  #visible = true;
  #io: IntersectionObserver | null = null;
  #reduce: MediaQueryList | null = null;

  readonly #onReading = (e: Event) => {
    this.#reading = (e as CustomEvent<MoodReading>).detail;
    if (this.#inside) this.#kick();
  };
  readonly #onMove = (e: Event) => {
    const path = moodPath(e);
    if (moodIgnored(path)) return;
    this.#point(e as PointerEvent);
    this.#inside = true;
    this.#kick();
  };
  readonly #onDown = (e: Event) => {
    const p = e as PointerEvent;
    if (p.button > 0) return;
    const path = moodPath(e);
    if (moodIgnored(path)) return;
    this.#point(p);
    this.#inside = true;
    const t = performance.now();
    this.#presses = this.#presses.filter((q) => t - q.t <= PRESS_MS);
    this.#presses.push({ x: this.#x, y: this.#y, t, disabled: moodFactsOf(path).disabled });
    this.#kick();
  };
  readonly #onLeave = (e: Event) => {
    if (e.target !== this) return;
    this.#inside = false;
    this.#kick();
  };
  readonly #onVisibility = () => this.#kick();

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if (old === value) return;
    if (name === 'for') this.#bind();
    this.#kick();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    this.addEventListener('pointermove', this.#onMove, opts);
    this.addEventListener('pointerdown', this.#onDown, opts);
    this.addEventListener('pointerleave', this.#onLeave, opts);
    document.addEventListener('visibilitychange', this.#onVisibility);
    if (typeof IntersectionObserver === 'function') {
      this.#io = new IntersectionObserver((entries) => {
        const e = entries[entries.length - 1];
        if (!e) return;
        this.#visible = e.isIntersecting;
        this.#kick();
      });
      this.#io.observe(this);
    }
    if (typeof matchMedia === 'function') {
      this.#reduce = matchMedia('(prefers-reduced-motion: reduce)');
      this.#reduce.addEventListener?.('change', this.#onVisibility);
    }
    // the mood may be defined or attached after this element: look again once the tree has settled
    this.#bind();
    queueMicrotask(() => this.#bind());
  }

  override disconnectedCallback(): void {
    const opts: AddEventListenerOptions = { capture: true };
    this.removeEventListener('pointermove', this.#onMove, opts);
    this.removeEventListener('pointerdown', this.#onDown, opts);
    this.removeEventListener('pointerleave', this.#onLeave, opts);
    document.removeEventListener('visibilitychange', this.#onVisibility);
    this.#reduce?.removeEventListener?.('change', this.#onVisibility);
    this.#reduce = null;
    this.#io?.disconnect();
    this.#io = null;
    this.#mood?.removeEventListener('ui-mood-reading', this.#onReading);
    this.#mood = null;
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#raf = 0;
    this.#hud?.destroy();
    this.#hud = null;
    super.disconnectedCallback();
  }

  /** The `<ui-mood>` this HUD shows: the one `for` names, else the nearest one around it. */
  get mood(): UiMood | null {
    return this.#mood;
  }

  /** Whether the HUD is drawing frames now. */
  get running(): boolean {
    return this.#raf !== 0;
  }

  get #lang(): MoodHudLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  get #still(): boolean {
    return motionReduced(motionOf(this.getAttribute('motion')));
  }

  protected render(): string {
    return '<slot></slot><div class="hud-layer" aria-hidden="true"></div>';
  }

  protected override updated(): void {
    const layer = this.$<HTMLElement>('.hud-layer');
    if (layer && layer !== this.#layer) {
      this.#hud?.destroy();
      this.#layer = layer;
      this.#hud = createHud(layer, () => ({ w: this.clientWidth, h: this.clientHeight }));
    }
  }

  #findMood(): UiMood | null {
    const id = this.getAttribute('for');
    if (id) {
      const root = this.getRootNode() as Document | ShadowRoot;
      const el = root.getElementById?.(id) ?? document.getElementById(id);
      return el?.localName === 'ui-mood' ? (el as UiMood) : null;
    }
    let n: Element | null =
      this.parentElement ?? ((this.getRootNode() as ShadowRoot).host as Element | undefined) ?? null;
    while (n) {
      if (n.localName === 'ui-mood') return n as UiMood;
      n = n.parentElement ?? ((n.getRootNode() as ShadowRoot).host as Element | undefined) ?? null;
    }
    return null;
  }

  #bind(): void {
    if (!this.isConnected) return;
    const next = this.#findMood();
    if (next === this.#mood) return;
    this.#mood?.removeEventListener('ui-mood-reading', this.#onReading);
    this.#mood = next;
    next?.addEventListener('ui-mood-reading', this.#onReading);
    if (next) this.#reading = next.reading;
  }

  #point(p: PointerEvent): void {
    // in the element's own px, also when a transform scales it (the box on screen ÷ its layout width)
    const r = this.getBoundingClientRect();
    const k = this.offsetWidth ? r.width / this.offsetWidth : 1;
    this.#x = (p.clientX - r.left) / (k || 1);
    this.#y = (p.clientY - r.top) / (k || 1);
    this.#lastActivity = performance.now();
  }

  /**
   * Whether there is anything to draw: the pointer is moving over it (or rested there under 4 s), the reading is not
   * calm, or dust and waves are still dying out after it left. Off screen, in a hidden tab or with nothing to draw,
   * the frames stop; the next move or reading starts them again.
   */
  #wants(t: number): boolean {
    if (!this.isConnected || !this.#visible || document.visibilityState === 'hidden') return false;
    const since = t - this.#lastActivity;
    if (!this.#inside) return since < HUD_SETTLE_MS;
    return since < REST_MS || this.#reading.score > 0.05 || this.#reading.reaction > 0;
  }

  #kick(): void {
    if (this.#raf || !this.#wants(performance.now())) return;
    this.#raf = requestAnimationFrame(this.#frame);
  }

  readonly #frame = () => {
    this.#raf = 0;
    const now = performance.now();
    if (!this.#hud) return;
    const lang = this.#lang;
    const r = this.#reading;
    this.#hud.frame({
      t: now,
      x: this.#x,
      y: this.#y,
      visible: this.#inside,
      reading: hudReadingOf(r, lang),
      presses: this.#presses,
      target: hudTargetText(r.target, lang),
      still: this.#still,
    });
    if (this.#wants(now)) this.#raf = requestAnimationFrame(this.#frame);
  };
}

define('ui-mood-hud', UiMoodHud);

declare global {
  interface HTMLElementTagNameMap {
    'ui-mood-hud': UiMoodHud;
  }
}
