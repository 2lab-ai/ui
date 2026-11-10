# Docent video reference

What a good docent-book video looks and sounds like, as rules you can check. `make-docent-book` reads this file before
every run, and `research-skill make-docent-book` adds to it. Every rule here came from a real defect (see
[LESSONS.md](LESSONS.md)) or a cited source (bottom). Shot recipes are in [TEMPLATES.md](TEMPLATES.md).

Map: 1 Picture rhythm · 2 People · 3 Bubbles · 4 Animals and props · 5 Text · 6 Composition · 7 Music · 8 Gates ·
9 Sources

## 1. Picture rhythm
- A new picture every 3 to 5 s (Productive Peter reference: 3.7 s). Never hold one longer than 8 s (lint: `long-hold`).
- Inside a shot things draw on (`p: dp(lt, 0, 0.8)`) and are **finished** before the shot ends: nothing half-drawn at
  rest (lint: `half-drawn`). A label reveal takes at most 0.8 s.
- Picture before name: draw the thing, then write its name.
- No faded "ghost" layers left behind (alpha < 0.55 is a ghost; lint: `ghost`). If something should recede, remove it
  or move it, do not fade it to 30 % and leave it.

## 2. People
- Every person in a book gets one fixed look, set once with `cast(id, look)` and drawn with `person(id, x, y, o)`. Two
  people in one frame must never share a look (lint: `twins`); every crowd member that is not a person sets
  `crowd: true`.
- Silhouette test: fill each figure black; you must still tell who is who. Vary in this order: height (`h` 0.85 to
  1.15), hair or hat (`short spiky curly long bun ponytail side bald`, `top cap beanie bowler`), outfit (`suit coat
  dress tshirt`), one accent colour (`red teal orange green magenta yellow purple`), then one prop (glasses, beard).
- Name tag (`tag: true`) the first time a person appears in a chapter; then the look carries the identity.
- A real person is a stand-in figure with their look, never a photo or caricature of the face.
- One figure is the viewer's stand-in through the whole video ("the running figure"): keep its look.

## 3. Bubbles
- Use `say(who, text)` / `think(who, text)`, not hand-placed `bubble()`. They place the bubble beside the speaker's
  head where it covers no face, no other figure and no earlier bubble, inside the safe frame, and aim the tail at the
  mouth (thought: puffs toward the head).
- Draw every figure of the shot first, then the bubbles (placement avoids what is already registered).
- 1 to 6 words in a bubble (lint: `wordy-bubble` over 8). Never an empty bubble (lint: `empty-bubble`); a bubble with
  a picture inside passes `body`.
- The tail must point at a head (lint: `tail-far`), the bubble must not cover a face (lint: `bubble-over-face`), text
  must fit (lint: `bubble-overflow`).
- Reading order: the first speaker's bubble is left/higher. In a dialogue, alternate shots or put speakers left and
  right facing each other (`flip: true` for the right one).

## 4. Animals and props
- Animals come from `animal(kind, …)`: anteater cat dog bird fish mouse rabbit elephant. Never build an animal on the
  stick-figure rig (`figure({snout})` is flagged: lint `animal-on-rig`).
- Each animal shows the 3 or 4 features people name it by (anteater: long tube snout, tiny head and eye, bushy tail
  as big as the body, thick clawed front legs, dark shoulder stripe). A new kind is added to `ANIMALS` in docent.js
  and passes the gallery gate (a stranger names it in 2 s) before any scene uses it.
- Props: `prop(name, …)`. A prop that a scene needs and the library lacks is drawn in a helper in scenes.js **and** shown
  on the gallery sheet; if it is generic (rocket, car, factory), move it into `PROPS` in a kit PR.

## 5. Text
- 1 to 5 handwritten words, never a sentence. Keywords 56 to 90 px. Subject 40 to 60 % of frame height.
- Nothing under y = 905 (subtitle box) (lint: `subtitle-zone`), nothing off the frame (lint: `off-frame`).

## 6. Composition
- One idea per shot, one focal point. Main subject ≥ 30 % of frame height.
- Two or three people: spread over the width (x ≈ 520 / 1180 / 1480), feet on one ground line (y 860 to 880).
- Do not repeat the same shot template three shots in a row.

## 7. Music
Built by `tools/score.py` from the cue library `music/cues.json` (120 original cues, 12 moods, `tools/music_lib.py`).
- Change music at structural breaks, not every cut: every chapter gets a new key and instrument, and inside a chapter
  the cue changes about every 35 s at a sentence start, staying in the same mood family (cross-fade 2.5 s).
- No cue twice in one video. A sentence that turns the story carries `"music": "<mood>"` in script.json.
- Under narration the bed sits about 20 dB under the voice, swells in pauses and on title cards; cues avoid the voice
  band (no sustained melody between G3 and C6), end on their home chord, and are normalised to -20 LUFS.
- Moods: wonder curious tension triumph melancholy playful reflective urgent warm mystery epic-calm nostalgic. Give each
  chapter a `mood` in script.json; unset, score.py guesses from the words.

## 8. Gates (in order, each one blocks the next)
1. **Asset gallery** — `tools/gallery.py cast animals [props]`; look at every sheet. Fix looks before writing scenes.
2. **Scene lint** — `tools/lint_scenes.py` must exit 0 (no P0/P1) on the draft timeline and again on the real one.
3. **Contact sheets** — stills at every sentence start + 0.8 s and end − 0.3 s; look at every sheet.
4. **Music** — `out/cue_sheet.md`: distinct cues = sections; the mix stays near -15.5 LUFS.
5. **Retro** — after delivery, append what went wrong to LESSONS.md and fix the rule/template/code (PR).

## 9. Sources
- Comics lettering and balloon placement: Blambot (blambot.com/pages/comic-book-grammar-tradition), Todd Klein's
  balloon placement notes, Clip Studio balloon tutorials.
- Character readability, silhouette test: Walt Disney Family Museum on character design; Big Red Illustration.
- Animal drawing by key features: Envato Tuts+ animal drawing guides; How2DrawAnimals.
- Music under voice: MusicVivo "music under voiceover" (−20 to −25 dB), umbrellacreators measurements (beds 24 to 31 dB
  under voice), kenjosephmusic on cue thinning, audiodrome on transitions at structural breaks.
- Full notes of the 2026-11-10 research: `RESEARCH-LOG.md`.
