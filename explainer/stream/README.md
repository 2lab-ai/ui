# Stream kit — videos that look like a VTuber live-stream VOD

The kit draws a 1080p30 MP4 that should make a viewer wonder whether it is a real stream recording. It has:

- a Live2D streamer in the corner, with lip sync from word timings, a gaze where the eyes lead and the head follows, blinks, expressions, thinking, a head scratch, and walking off and back
- an extra character who peeks in while the streamer is away
- a real-looking room behind them
- a platform overlay: chat, title and clock, a donation alert, a BRB banner
- Win11 Paint on the left, with mouse-drawn wobbly stick figures and typed Hangul (two-set IME composition, keystroke sounds on the same frames)
- a mic-chain mix: noise gate, room tone, keyboard, chair and door, a machine voice reading donations, and lo-fi BGM

The `make-streaming-video` skill drives it. It is plain Python and JS outside the npm package, like `explainer/`.

## Three themes, one engine

```
explainer/stream/
├── engine/                       character-agnostic
│   ├── build.py                  beats + themes -> timeline.json (per frame) + events.json (audio, mix, review)
│   ├── common.py, lipsync.py     clock, springs, noise; mouth from voice loudness x word-timed syllables
│   ├── rigs/mao.py, hiyori.py    rig adapters: cues -> each model's own parameters
│   ├── hangul.py                 two-set (두벌식) IME automaton: the composition states the text box shows
│   ├── stage.html, stage.js      the page: Paint, overlay slots, two Live2D models (pixi-live2d-display)
│   ├── render.mjs                serves the kit, drives headless Chromium, frames -> ffmpeg (parallel slices)
│   ├── mix.py, mux.sh            the audio mix; mux + loudness (-16 LUFS)
│   ├── tts.py, align.py          soma-voice (blade-4090) per line with padcut; mlx-whisper word timings
│   ├── review.py, rescore.py     the external review panel (llmux), and re-scoring a packet
│   └── setup_assets.py           downloads everything into ~/.cache/2lab-stream (nothing binary is committed)
└── themes/
    ├── streaming/<id>/           the platform look     — default: CHZZK (THEME.md)
    ├── streamer/<id>/            who is on screen      — kate: Kate (Mao, cwon) + her sister (Hiyori, egirl) (kate.md, sister.md)
    └── content/<id>/             what the stream does  — reading-book: a book stream in Paint (RECIPE.md, example/)
```

What each theme decides:

| Theme | Decides |
|---|---|
| streaming | overlay CSS, strings (chat title, donation word, BRB text), donation TTS voice, chat and label positions, its rubric lines |
| streamer | cast: per role a model, rig, voice, hidden parts, room-light tint, motion knobs (`talk_sway`, `nod`, `idle_sway`) and whisper gain; the room (background, BGM, room sounds, their download sources); where the cast stands; character bibles; rubric lines |
| content | the activity layout (the Paint window), the recipe, the example beats, rubric lines |

Every theme adds its own lines to the review rubric (`review`), and they sum to 100.

## Run

```
python engine/setup_assets.py                       # once per machine; --check to verify
python engine/tts.py <lines.json> <audio> --streamer kate      # each line's "who" -> the cast's voice
python engine/align.py <audio> <ids...>             # word timings for lip sync
python engine/build.py --beats <beats.py> --audio <audio> --out <build> \
       --streaming default --streamer kate --content reading-book
node engine/render.mjs <build> 8                    # -> <build>/video.mp4
python engine/mix.py <build> && sh engine/mux.sh <build>      # -> <build>/final.mp4
python engine/review.py <build> <lines.json> v1     # optional: 3-engine panel; write <build>/review_note.txt first
```

Python: `~/.cache/2lab-explainer-venv` (numpy, scipy, PIL, matplotlib, mlx-whisper). Node: the cache's own `node_modules`.

## Licences (read before publishing)

- **Live2D sample models (Mao, Hiyori):** Free Material License. Commercial use only if the publisher's last-year revenue is under JPY 10M. Hiyori's design must not be changed. The files are downloaded, never committed.
- **Cubism Core:** proprietary. Downloaded from Live2D's CDN for local rendering only. Never put it in a repo or on a server.
- **Room photo:** Unsplash licence. **SFX:** Freesound CC0. **BGM:** HoliznaCC0 (CC0). Sources are listed in each streamer theme's `sources`.

## Review panel notes (2026-11-17)

- `gemini-3.8-flash-high` scores are bimodal (about 70 or about 95). The mode follows trivial prompt text (timings, counts), not the frames. Proved by swapping images between packets.
- GPT and Grok move ±3–4 points on the same packet.
- Score a target on a multi-run mean, never on one run, and never by tuning the prompt wording.
- Stale captions or notes from an older render get quoted back as defects. Keep `review_note.txt` and the beats' `REVIEW` labels true to the render.
