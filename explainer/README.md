# Explainer kit

This kit makes a 3Blue1Brown-style explainer video from a script. It produces a 1080p30 MP4 with a dark canvas, formulas that write themselves on in colour, a calm narrator, a soft synthesised score and subtitles.

The `make-3b1b` skill drives it. You can also run every step by hand. The method comes from Lurrobert's "3Blue1Brown-style explainer videos" spec (a gist). The term budget it sets is what makes the videos watchable. See [How to explain](#how-to-explain).

The kit is not part of the npm package. It lives in this repo for 2 reasons:

- its look comes from the library's design tokens (theme `mono-black` is the Modern Mono design)
- one versioned copy of the code outlives any working folder

## What is here

```
explainer/
├── engine/
│   ├── engine.js        canvas helpers + the clock: renderAt(t) draws any frame from the time alone
│   └── video.html       preview player (play, scrub, chapters) and export page (?export=1)
├── tools/
│   ├── new_video.py     scaffold or refresh a project: engine, theme.json, fonts, public-domain images
│   ├── narrate_soma.py  narration with the soma-voice API on blade-4090 (voice cwon), filler padding, timing
│   ├── padcut.py        cuts the filler ("아아. [pause] … [pause] 아아.") off each take
│   ├── narrate_edge.py  fallback narration with edge-tts when the GPU host is down
│   ├── render_formulas.py  formulas.py -> formulas.json (Computer Modern glyph outlines)
│   ├── music.py         original D-major piano + pad score, peak 0.8
│   ├── export.py        mix (voice ducks the music) · stills · MP4 (Playwright frames -> ffmpeg, parallel slices)
│   ├── audio_check.py   QA: transcribes each scene (mlx-whisper) and diffs it against the script
│   ├── sheets.py        contact sheets of stills for review
│   ├── upload_slack.py  upload files to a Slack thread
│   └── blade/           ssh helpers for blade-4090 (WSL runs behind the Windows host)
└── examples/
    └── euler-identity/  "오일러 항등식의 역사" — script.json, scenes.js, formulas.py, project.json
```

## A project folder

Every tool runs inside a project folder:

| File | Written by | What it is |
|---|---|---|
| `script.json` | you | `{title, subtitle, scenes: [{id, chip, title, subtitle, sentences: [{text, say?}]}]}`. `say` is the spoken form when it differs from the subtitle (numbers read out in Hangul, `i` → 아이) |
| `scenes.js` | you | one draw function per scene id: `SCENES.<id> = (t, q) => {…}`. It is keyed to the timeline: `q.s(k)` is sentence k's start, `q.w('단어', k)` is the first spoken word containing a string at or after sentence k, and `q.wx(token, k, n)` is an exact token |
| `formulas.py` | you | `F = {id: (mathtext, colours)}`, where colours are theme names (`yellow`, `blue`, …) |
| `project.json` | you + `new_video.py` | slug, title, `commons` (image name → Wikimedia Commons title), `youtube` title and description, `theme`, `ui_commit` |
| `theme.json` | `new_video.py` | palette and fonts |
| `engine.js`, `video.html`, `fonts/`, `img/` | `new_video.py` | copied from this repo, or fetched |
| `timeline.json`, `narration.wav` | `narrate_*.py` | each sentence's start, end and duration, and estimated word times |
| `formulas.json` | `render_formulas.py` | glyph outlines per formula |
| `score.wav`, `mix.wav`, `out/` | `music.py`, `export.py` | the score, the mix, the stills and the MP4 |

## Run it

```bash
K=~/2lab.ai/ui/explainer                       # this folder
python $K/tools/new_video.py ~/videos/euler --theme mono-black --from $K/examples/euler-identity
cd ~/videos/euler
ssh -f -N -L 19999:127.0.0.1:9999 blade-4090-ps   # soma-voice is reachable only through the Windows host
python $K/tools/narrate_soma.py                # one async job per scene; ~4 min per scene with padding
python $K/tools/render_formulas.py
python $K/tools/music.py && python $K/tools/export.py mix
python $K/tools/export.py stills 30 90 150     # look before rendering everything
python -m http.server                          # open video.html: play, scrub, jump to chapters
python $K/tools/export.py video --slices 12    # out/<slug>.mp4, about 3 minutes on an M-series Mac
```

Python needs `numpy matplotlib playwright pillow`. Add `edge-tts` for the fallback voice and `mlx-whisper` for QA. Install Chromium with `playwright install chromium`, and install `ffmpeg`.

## Themes

| id | Look | Source |
|---|---|---|
| `mono-black` (default) | near-black canvas `#050505`, white type in Pretendard, colour only on the marks that mean something | the Modern Mono design: `src/core/tokens.json` `designs.modern-mono`, read when the project is made |
| `3b1b` | the classic manim palette on `#101114`, Latin Modern / Noto Serif KR | built in |

Scenes name colours by role, not by value: `C.yellow`, `C.blue`, `C.green`, `C.track`, `C.grid`, `C.panel`, and `mix(C.green, 0.3)` for a tint.

In `mono-black`:

- yellow, green and red keep the design's semantic hues
- blue becomes the design's lavender accent
- teal and purple go white, as the mono palette does

So one colour per concept still holds where a concept appears as a mark.

## Narration

`narrate_soma.py` speaks with the soma-voice API (Fish Speech S2 Pro) on blade-4090. The default voice is `cwon`.

- One async job per scene. The model loads once, then takes about 6 seconds per sentence.
- One turn per sentence, so subtitles and cues land on exact sentence starts.
- Filler padding. A bare sentence can start or stop with a clipped plosive, because the model begins and ends right at its edge. So each turn is sent as `아아. [pause] <sentence> [pause] 아아.`. `padcut.py` then cuts inside the two silences that `[pause]` leaves, with an 8 ms fade.
- Strict structure. A take is cut only when it has filler, gap, speech, gap, filler. A missing, merged or swallowed filler means re-synthesis, never a guess.
- Ear check. Structure alone cannot tell a missing filler from a short first or last word. So everything cut off (the whole prefix and the whole suffix) is transcribed with mlx-whisper, offline when the model is cached. It must be positively heard as filler (`아`, `아아`, …): empty output is a rejection. A failing take is re-synthesised with the next take seed, up to 3 rounds.
- Take records. Each cached take has `cache_voice/<key>.json`: text, take seed, the seed the server used, the raw take it was cut from, the cutter version and whether the ear check ran. A take is used only when its record matches the current cutter and check. Otherwise it is re-cut from its raw take, or re-synthesised.
- `--recut` re-cuts and re-checks every take from its recorded raw take, without the GPU. A take without a record (from an older version) is adopted only from a raw take of exactly the same text that passes both checks. Anything else is dropped and re-synthesised on the next run.
- Tests: `python -m unittest explainer/tools/test_padcut.py` (synthetic takes, no audio files).
- Takes are cached by voice, take seed and text. `--redo scene:k` re-rolls one sentence. The API has no per-turn seed (turn i of a job gets seed s+i), so the seed the server actually used is recorded next to each take in `cache_voice/<key>.json`.
- The level is matched across sentences, and the whole track is set to −18.5 LUFS. The mix in `export.py` is tuned for that level.

blade-4090 runs WSL with mirrored networking. Port 9999 answers only on the Windows loopback, so open the SSH tunnel above, or set `SOMA_VOICE_URL`.

## How to explain

These rules come from the spec's study of 3Blue1Brown lessons. Check them before you narrate:

1. Budget at least 150 spoken words per new term. A 6 to 8 minute video gets about 6 new terms.
2. Use at most 3 proper nouns.
3. Use one running example in every chapter. In the example, that is a dot walking a circle.
4. Show the picture before you say the name.
5. Ask the viewer one question per chapter, then answer it.
6. Build intuition first, then the formula in words, then at most one formula per idea.
7. Run a term audit in a fresh context before narration. List every word you would not use at dinner, then count words per term and proper nouns. Rewrite until it passes.
8. Fact-check historical claims against sources before narration.

## QA before anyone watches

- Run `audio_check.py`. It reports the transcript match per scene (number formatting is the usual difference), the sentence timing offsets and the diffs.
- Run `export.py stills` at every sentence, then `sheets.py`. Look for overlaps, missing cues (the page reports `missingCues()`) and text over subtitles.
- Measure loudness: the mix should sit near −15.5 LUFS with no clipping.
