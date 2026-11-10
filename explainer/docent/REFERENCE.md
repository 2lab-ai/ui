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
- Draw the sentence's verb, not a label of it: "they drive him out" is a chase to the gate, "he boards" is a foot on
  the gangway, "Demian appears" is a figure stepping in. A word on a board or in a bubble never stands in for the
  action (2026-11-10 verification: 3 of 5 clips drew who but not what happened).
- Shots cut in 0.3 s before their listed time (`shots()` `lead`), so the subject is already drawing when the voice
  names it. Draw the subject first (`dp(lt, 0, 0.5)`), its details and labels after.
- No faded "ghost" layers left behind (alpha < 0.55 is a ghost; lint: `ghost`). If something should recede, remove it
  or move it, do not fade it to 30 % and leave it.
- Cuts are hard (`shots()` default): the old picture is gone when the new one starts drawing. A cross-fade
  (`fade: 0.3`) shows the old picture fading first, then the new one — never both drawing at once (research 2026-11-10:
  the 0.22 s overlap read as a double exposure in every probe).

## 2. People
- Every person in a book gets one fixed look, set once with `cast(id, look)` and drawn with `person(id, x, y, o)`. Two
  different people in one frame must never share a look (lint: `twins`; the same person twice, e.g. before/after, is
  fine); every crowd member that is not a person sets `crowd: true`. Two cast looks may not share hair and hat
  (lint: `cast-similar`) — a different colour alone is not a different person.
- Silhouette test: fill each figure black; you must still tell who is who. Vary in this order: height (`h` 0.85 to
  1.15), hair or hat (`short spiky curly long bun ponytail side bald`, `top cap beanie bowler crown laurel`), outfit
  (`suit coat dress tshirt`), one accent colour (`red teal orange green magenta yellow purple`), then one prop
  (glasses, beard). `hair: 'long'` reads as a woman on the sheet; for a long-haired man add a beard.
- Name tag (`tag: true`) the first time a person appears in a chapter; then the look carries the identity. The tag is
  the name the narration uses (never a bare "나"), sits beside the waist on the side the figure turns away from, at
  42 px or more with a paper outline, dark enough to read (a light accent such as grey is darkened to 4.5:1). Tags are placed when the shot is complete (`docentTags()`): free side, other
  side, then above the head, whichever covers nobody — so people, animals, props and bubbles drawn later count (lint:
  `name tag over name tag`, `name tag over another figure or animal`). Clothes are opaque; the body line is under them.
- A quote is acted by the person who said it, in their look; the running figure only asks and reacts.
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
- A speech tail ends beside the mouth: a bubble to the side ends at mouth height, never at the temple, the hair or a
  cap brim (`say()` does this; lint `tail-high` flags a tip above the nose that is not next to the mouth). Put the
  bubble on the side the speaker faces unless a brim or a raised arm is there.
- Reading order: the first speaker's bubble is left/higher. In a dialogue, alternate shots or put speakers left and
  right facing each other (`flip: true` for the right one).

## 4. Animals and props
- Animals come from `animal(kind, …)`: anteater cat dog bird fish mouse rabbit elephant whale turkey mammoth pig horse
  hen swan blackswan octopus bat bee turtle tick. Never build an animal on the stick-figure rig (`figure({snout})` is flagged: lint
  `animal-on-rig`).
- Each animal shows the 3 or 4 features people name it by (anteater: long tube snout, tiny head and eye, bushy tail
  as big as the body, thick clawed front legs, dark shoulder stripe). A new kind is added to `ANIMALS` in docent.js
  and passes the gallery gate (a stranger names it in 2 s) before any scene uses it.
- Props: `prop(name, …)`. A prop that stands in front of another gets `solid: true` (its shape is painted in the page
  colour first, so the one behind does not show through; its own parts and colours stay). Lint `prop-over-face` (P2)
  flags a prop whose box covers a face drawn before it: open the frame; `faceOk: true` when hiding a face is the joke. A missing animal, prop or pose is registered from scenes.js
  (`ANIMALS.x = …`, `PROPS.x = …`, `POSES.x = …`, contract in TEMPLATES "Adding an asset") so it shows on the gallery
  sheet; the retro moves generic ones into docent.js.

## 5. Text
- 1 to 5 handwritten words, never a sentence. Keywords 56 to 90 px. Subject 40 to 60 % of frame height.
- Nothing under y = 905 (subtitle box) (lint: `subtitle-zone`), nothing off the frame (lint: `off-frame`).
- On `sketch`, `C.blue` is the purple keyword colour: use `C.teal` for water, rain and sky details.
- Math and science books on `mono-black`: lead with the 3b1b devices (formula write-on, one running example, as in
  `examples/euler-identity`); docent figures there lose their colours (hair and accents turn white), so give people
  a hat or beard, not a colour, and keep handwriting for 1–2 labels. Formulas are not linted: check them on the sheet.

## 6. Composition
- One idea per shot, one focal point. Main subject ≥ 30 % of frame height (lint: `small-subject` when everything drawn
  fits in less than 30 % of the height and half the width).
- Two or three people: spread over the width (x ≈ 520 / 1180 / 1480), feet on one ground line (y 860 to 880).
- Use the height: something drawn above y ≈ 450 in every shot with people — the named idea, a thought, a sky, a
  building, or a bigger subject (lint: `bottom-heavy`, P2; four of five verification clips left the top 40 % empty).
- Things stand on what holds them: a whale in the water, a town on its hill, feet on the ground line, a board's legs
  on the floor, a phone in a hand or on a table, a building on the line the people stand on. The lint cannot see
  support: Gate C asks it for every shot (the most common P2 of the 2026-11-10 v2 reviews).
- A thing in front of lines is opaque: animals are; a prop needs `solid: true` (money bags, bowls, phones).
- Do not repeat the same shot template three shots in a row.

## 7. Music
Built by `tools/score.py` from the cue library `music/cues.json` (120 original cues, 12 moods, `tools/music_lib.py`).
- Change music at structural breaks, not every cut: every chapter gets a new key and instrument, and inside a chapter
  the cue changes about every 35 s at a sentence start, staying in the same mood family (cross-fade 2.5 s).
- No cue twice in one video (when a mood family runs out, a cue comes back with another seed). A sentence that turns
  the story carries `"music": "<mood>"` in script.json: the cue changes exactly there and that mood holds to the end
  of the chapter. Automatic cuts never leave a section under 10 s.
- Under narration the bed sits about 20 dB under the voice, swells in pauses and on title cards. Cues keep out of the
  voice's core: pads voiced close at or below C5, bass at or below E3, every sustained texture note at or above C5.
  They end on their home chord before the last 1.5 s, and are normalised to -20 LUFS.
- Moods: wonder curious tension triumph melancholy playful reflective urgent warm mystery epic-calm nostalgic. Give each
  chapter a `mood` in script.json; unset, score.py guesses from the words. Pick by what the chapter does, not by the
  book's genre: a sea hunt is `tension`/`epic-calm`, a moral dilemma `tension`/`reflective`, a discovery `wonder`,
  a childhood memory `nostalgic`. `mystery` is for real unknowns, not a default.
- Across videos: each project rotates the catalogue by its own name, and `~/.cache/2lab-explainer-music/history.json`
  makes cues used by the last 10 videos cost more, so two books with the same mood do not open on the same cue.
- Mix (`export.py mix` with a score.py score): the bed sits 20–22 dB under the voice while it speaks and swells only
  ~4 dB in short gaps (volume 0.20, sidechain ratio 2.5, release 1.2 s). In every open stretch — title cards, chapter
  breaks, the end (no voice for ≥ 1.2 s) — it rises +6 dB to about −27 dBFS so the new chapter's cue is heard, and the
  end fades over 1.5 s, after the last word. Check: `mix_check.py` (`music_open_dbfs` −30…−22; before 2026-11-10 it
  sat near −33, which every reviewer called near-silent).
- In a clip under ~20 s, do not force a `"music"` change: one cue is enough.

## 8. Gates (in order, each one blocks the next)
1. **Asset gallery** — `tools/gallery.py cast animals [props]`; look at every sheet. Fix looks before writing scenes.
   The gallery tests identity ("a wolf"); whether a drawing reads as the action ("nursing", "lifting") is checked at
   gate 3 by a fresh reviewer.
2. **Scene lint** — `tools/lint_scenes.py` must exit 0 (no P0/P1) on the draft timeline and again on the real one, and
   someone looks at every `out/lint_sheet*.jpg` page (every rest frame): lint cannot see a wrong metaphor, a roof that does not
   meet its wall, or an arm through a prop.
3. **Contact sheets** — stills at every sentence start + 0.8 s and end − 0.3 s; a fresh reviewer looks at every sheet
   and answers per sentence: is its verb drawn? does every tail end at a mouth? is any tag on someone else? is the top
   of the frame used? does anything float (a whale over the water, a hill over its line)?
   Voice: `audio_check.py --sentences` (numbers normalised, names from project.json `names`): every sentence `ok`.
4. **Music** — `out/cue_sheet.md`: distinct cues = sections; `mix_check.py` exits 0 (20–22 dB under the voice, swell ≤ 6 dB,
   title cards −30…−22 dBFS); the mix stays near -15.5 LUFS.
5. **Retro** — after delivery, append what went wrong to LESSONS.md and fix the rule/template/code (PR).

## 9. Sources
- Comics lettering and balloon placement: Blambot (blambot.com/pages/comic-book-grammar-tradition), Todd Klein's
  balloon placement notes, Clip Studio balloon tutorials.
- Character readability, silhouette test: Walt Disney Family Museum on character design; Big Red Illustration.
- Animal drawing by key features: Envato Tuts+ animal drawing guides; How2DrawAnimals.
- Music under voice: MusicVivo "music under voiceover" (−20 to −25 dB), umbrellacreators measurements (beds 24 to 31 dB
  under voice), kenjosephmusic on cue thinning, audiodrome on transitions at structural breaks.
- Full notes of the 2026-11-10 research: `RESEARCH-LOG.md`.
