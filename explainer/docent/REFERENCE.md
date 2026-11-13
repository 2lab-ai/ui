# Docent video reference

What a good docent-book video looks and sounds like, as rules you can check. `make-docent-book` reads this file before
every run, and `research-skill make-docent-book` adds to it. Every rule here came from a real defect (see
[LESSONS.md](LESSONS.md)) or a cited source (bottom). Shot recipes are in [TEMPLATES.md](TEMPLATES.md).

Map: 0 Emphasis budget · 1 Picture rhythm · 2 People · 3 Bubbles · 4 Animals and props · 5 Text · 6 Composition ·
7 Music · 8 Gates · 9 Sources · 10 Title, cover, description

## 0. Emphasis budget — read this first
In short: the reference shows one thing at a time in plain black ink, and saves purple and red for the one thing that
matters. Ours showed everything and emphasised everything, so nothing stood out — the owner's "AI slop" (2026-11-13).

**Measured on the reference** (Productive Peter, "Life is Short", 202 frames, `~/2lab.ai/ARTIFACTS/docent/reference-peter/`):
about half the frames hold one element (a figure, a prop, or a word alone on the page); almost none hold more than three.
Most frames have no written word; a frame with a word has one. Lines are black; purple is only on the written word;
red is a single X or ring, a few times a chapter; no clothes, fills or backgrounds; no burned-in subtitles; no chapter
label in the corner. Our Elon Musk v2 and ten-books v2 frames held 5 to 12 things, 3 to 4 labels, coloured shirts,
stalls and charts, up to 9 red X's at once, a subtitle sentence in every frame and a chip in the corner.

**What may be emphasised** (written, purple, red, or coloured) — only these:
1. The chapter's named idea (script.json `idea`): written once, after its picture; it may come back later.
2. A number the viewer must remember (the hook number, the one statistic of the chapter).
3. The chapter's one verdict: a red X on the wrong habit, or a red ring on the right choice — not both.
4. A colour that is itself the meaning (a red heart, a magenta brain, a gold coin among grey ones): `colour: true`.

**What is never emphasised** — draw it plain or leave it out: who is speaking (the look carries it), parts of a
drawing (ingredients, axes, units, "price / margin / habit" rows), dates under every dot, a second or third term in a
chapter, examples and sub-points, clothes and decoration (stripes, shading, backgrounds, motion lines that are not the
verb), and the narration itself (no sentence on screen: subtitles go to YouTube as captions, `export.py srt`).

**The budget, per shot** (lint `busy`, `words`, `list`, `marks`, `colour`): one subject plus at most two things around
it; at most one written word — a bubble's words and a name tag count (two only for a deliberate pair or a picture
equation); at most one red mark; ink, plus purple on the written word and red on the mark. **Per chapter:** one named idea, red in about one shot (lint `mark-budget`),
at most one or two bubbles. Before adding anything to a shot, ask: if I take it away, does the sentence still read? If
yes, take it away.

**Shot types the reference uses**, in roughly this order of frequency: a figure doing the sentence's verb, alone · one
object or metaphor alone · a word alone on the page · a figure with one object · a picture equation (A = B) · a figure
with a thought bubble holding one tiny drawing or word. A classroom board or a chapter sign appears once per chapter.

**Defaults that enforce it** (docent.js): figures, cast looks, animals and props draw in ink — every colour inside them
paints as ink or page (`colour: true` on the call keeps it), in every project whose project.json has `"colour": false`
— new docent projects get it, with `"subtitles": "off"` and
`"chip": false`. Name tags are ink.

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
- People are plain stick figures, as in the reference. A look is a silhouette — height, hair, hat, beard, glasses, a
  tie — never a colour or a coloured outfit (ink mode paints `accent` and outfit fills as ink and page anyway).
- Every person in a book gets one fixed look, set once with `cast(id, look)` and drawn with `person(id, x, y, o)`. Two
  different people in one frame must never share a look (lint: `twins`; the same person twice, e.g. before/after, is
  fine); every crowd member that is not a person sets `crowd: true`. Two cast looks may not share hair and hat
  (lint: `cast-similar`). Two people in a shot is common; three is a crowd scene and rare.
- Silhouette test: fill each figure black; you must still tell who is who. Vary in this order: height (`h` 0.85 to
  1.15), hair or hat (`short spiky curly long bun ponytail side bald`, `top cap beanie bowler crown laurel`), then one
  prop (glasses, beard, tie). No outfits or accent colours unless the outfit is the role (a toga, a lab coat) — then in
  ink. `hair: 'long'` reads as a woman on the sheet; for a long-haired man add a beard.
- Name tag (`tag: true`) only the first time the narration names a person in the whole video, and only in a shot with
  no other written word (a tag is a word: lint `words`); then the look carries the identity. The running figure never
  has a tag. The tag is the name the narration uses (never a bare "나"), in ink, beside the waist on the side the figure
  turns away from, at 42 px or more with a paper outline. Tags are placed when the shot is complete (`docentTags()`): free side, other
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
- One bubble per shot; a reply is the next shot. Bubbles are for the inner voice and the "most people say" line, not
  for narrating what the picture already shows.
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
- Draw only the props the sentence needs: one metaphor object, not the room around it. Props are line art; their
  built-in colours paint as ink and page unless the colour is the meaning (`colour: true`).
- Props: `prop(name, …)`. A prop that stands in front of another gets `solid: true` (its shape is painted in the page
  colour first, so the one behind does not show through; its own parts and colours stay). Lint `prop-over-face` (P2)
  flags a prop whose box covers a face drawn before it: open the frame; `faceOk: true` when hiding a face is the joke.
- A held prop sits at the hand, beside the body. A round or bulging one (vase, clock, purse, heart) drawn over the
  torso becomes the body: a vase-man, a clock-belly. Lint `prop-over-body` (P2) flags one covering more than half of
  a torso with its centre on the body, at any size; it skips names ending in a flat sheet (book, letter, paper …) and
  scenery whose centre is off the body (stairs beside the figure). Hugging it is the point? Keep it small at the chest
  and pass `bodyOk: true`.
- In ink mode a light fill paints as the page: a grey that carries meaning (weeks already lived) disappears. Draw
  that meaning in ink (hatching, a line) or give that one call `colour: true`. A missing animal, prop or pose is registered from scenes.js
  (`ANIMALS.x = …`, `PROPS.x = …`, `POSES.x = …`, contract in TEMPLATES "Adding an asset") so it shows on the gallery
  sheet; the retro moves generic ones into docent.js.

## 5. Text
- 0 or 1 written word or short phrase per shot (§0): the named idea, or the one number to remember. Most shots have
  none. No labels on parts of a drawing, no dates under every point, no captions under objects (lint: `words`).
- 1 to 5 handwritten words, never a sentence. Keywords 56 to 90 px. Subject 40 to 60 % of frame height.
- No burned-in subtitles and no chapter chip on docent videos (`project.json` `"subtitles": "off"`, `"chip": false`):
  the narration is the caption track (`export.py srt`), uploaded with the video.
- Nothing under y = 905 (subtitle box) (lint: `subtitle-zone`), nothing off the frame (lint: `off-frame`).
- On `sketch`, `C.blue` is the purple keyword colour: use `C.teal` for water, rain and sky details.
- Math and science books on `mono-black`: lead with the 3b1b devices (formula write-on, one running example, as in
  `examples/euler-identity`); docent figures there lose their colours (hair and accents turn white), so give people
  a hat or beard, not a colour, and keep handwriting for 1–2 labels. Formulas are not linted: check them on the sheet.

## 6. Composition
- Fewer things, bigger: the reference's figures fill 40–70 % of the frame height; ours at `s: 1` fill about 33 %. A lone
  figure goes at `s` 1.3–1.6, two people at 1.1–1.3 (feet still on y 860–880); the empty page around it stays empty.
- One idea per shot, one focal point. Main subject ≥ 30 % of frame height (lint: `small-subject` when everything drawn
  fits in less than 30 % of the height and half the width).
- Two or three people: spread over the width (x ≈ 520 / 1180 / 1480), feet on one ground line (y 860 to 880).
- Empty page is the default, not a defect: the reference leaves most of the frame blank. Do not fill the top of the
  frame to "use the height" (that rule and its `bottom-heavy` check were removed on 2026-11-13: they added things to
  every shot). Make the one subject big enough instead.
- Things stand on what holds them: a whale in the water, a town on its hill, feet on the ground line, a board's legs
  on the floor, a phone in a hand or on a table, a building on the line the people stand on. The lint cannot see
  support: Gate C asks it for every shot (the most common P2 of the 2026-11-10 v2 reviews).
- A thing in front of lines is opaque: animals are; a prop needs `solid: true` (money bags, bowls, phones).
- Do not repeat the same shot template three shots in a row.
- Lines only: no background scenery, no ground textures, no shading; a ground line only when something stands on it.

## 7. Music
Built by `tools/library_score.py` from `music/library.json`: recorded, human-composed CC BY tracks (README "Music").
Generated MIDI cues (`score.py`) are the offline fallback only — under a documentary voice they sound like a toy.
- A narration bed is sparse and textural: no drums, no lead melody, few attacks, steady dynamics, little energy in
  1–4 kHz where consonants live, no internal silence (a sparse piano piece that rests for 2 s goes dead under the
  voice). Only `bed: true` tracks without `holes` qualify; a new track is measured (`library_score.py --measure`) and
  tagged before use.
- One track per chapter, changed at structural breaks only: a chapter break is a 3 s cross-fade centred on the title
  card; a chapter longer than its track chains a second track in the same mood family with a 4 s cross-fade at a
  sentence gap. A sentence that turns the story carries `"music": "<mood>"`: the track changes exactly there.
- Only a track's audible body is placed (no quiet intro, no fade-out tail under the voice), so the bed never goes
  silent mid-chapter. No track twice in one video (23 beds; more than ~20 chapters warns). Tracks are normalised to
  -20 LUFS; the bed dips 3 dB at 2.5 kHz.
- Credits: CC BY needs the title, artist, licence and source of every track — `out/music_credits.txt` goes into the
  YouTube description and the audiobook notes.
- Moods: wonder curious tension triumph melancholy playful reflective urgent warm mystery epic-calm nostalgic. Give each
  chapter a `mood` in script.json; unset, the scorer guesses from the words. Pick by what the chapter does, not by the
  book's genre: a sea hunt is `tension`/`epic-calm`, a moral dilemma `tension`/`reflective`, a discovery `wonder`,
  a childhood memory `nostalgic`. `mystery` is for real unknowns, not a default.
- Across videos: `~/.cache/2lab-explainer-music/history.json` (shared by both scorers) makes tracks used by the last 10
  videos cost more, so two books with the same mood do not open on the same track.
- Mix (`export.py mix` with a library_score.py or score.py score): the bed sits 20–22 dB under the voice while it
  speaks and swells only ~4 dB in short gaps (volume 0.20, sidechain ratio 2.5, release 1.2 s). In every open stretch —
  title cards, chapter breaks, the end (no voice for ≥ 1.2 s) — it rises (+10.5 dB for a library bed, +6 dB for MIDI
  cues) to about −29 dBFS so the new chapter's music is heard, and the end fades over 1.5 s, after the last word. Check: `mix_check.py` (`music_open_dbfs` −30…−22; before 2026-11-10 it
  sat near −33, which every reviewer called near-silent).
- In a clip under ~20 s, do not force a `"music"` change: one track is enough.

## 8. Gates (in order, each one blocks the next)
1. **Asset gallery** — `tools/gallery.py cast animals [props]`; look at every sheet. Fix looks before writing scenes.
   The gallery tests identity ("a wolf"); whether a drawing reads as the action ("nursing", "lifting") is checked at
   gate 3 by a fresh reviewer.
2. **Scene lint** — `tools/lint_scenes.py` must exit 0 (no P0/P1) on the draft timeline and again on the real one, and
   someone looks at every `out/lint_sheet*.jpg` page (every rest frame): lint cannot see a wrong metaphor, a roof that does not
   meet its wall, or an arm through a prop.
3. **Contact sheets** — stills at every sentence start + 0.8 s and end − 0.3 s; a fresh reviewer looks at every sheet
   next to a reference sheet (`reference-peter/sheets/`) and answers per sentence: where does the eye land first, and
   is that the thing the sentence is about? could one thing be removed and the sentence still read? is anything
   emphasised (purple, red, colour, size) that is not the named idea, the number or the verdict? is its verb drawn?
   does every tail end at a mouth? is any tag on someone else? does anything float (a whale over the water)?
   Voice: `audio_check.py --sentences` (numbers normalised, names from project.json `names`): every sentence `ok`.
4. **Music** — `out/cue_sheet.md`: distinct tracks = sections, moods that fit; `out/music_credits.txt` in the
   description; `mix_check.py` exits 0 (20–22 dB under the voice, swell ≤ 6 dB,
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

## 10. Title, cover, description — what makes someone click
In short: people click a question about their own life, not a book's name. The title opens with the viewer's problem,
question or a surprising claim, and the book comes after it. The cover is drawn for the size YouTube shows it — 168 px
wide on a phone — with one big subject and at most 8 big characters that add to the title.

**Why** (research-skill packaging run, 2026-11-14, `RESEARCH-LOG.md`): 10 videos packaged by the old skill scored 2.33 of
5 on a 10-criterion click rubric, 0 of 10 passing. Every title was "책 이름 — 부제 (20분 도슨트북)", copied from the only
example in the kit. Every cover was the 1.5 s title card or a frame YouTube would pick: thin lines on an empty page,
unreadable at 168 px. In search data (126 keywords, 3,780 results) the same genre differed 100x by keyword: 세네카
median 1,682 views vs 쇼펜하우어 198,213; 칸토어 24,702 vs 수학 역설 262,821. Small channels broke through where the title
spoke to a present problem ("모임이 귀찮아지고 혼자가 좋아졌다면 꼭 들어 보세요", a 10k-subscriber channel, 540k views).

**Title**
- Hook first, within about 30 characters: the viewer's situation ("~했다면"), a "왜" question, a surprising claim, or
  a number contrast. The book, author or "책 N권" go after a separator (` — ` or ` | `). Whole title ≤ about 55.
- Never: a running time, "도슨트북", "N분 요약", "~의 역사" as the whole title, the book's name first.
- One searchable keyword people type, measured: `python $K/tools/title_check.py "<title>" --keyword <kw> ...` prints
  the median views of the top 30 results and the small-channel hits. Prefer a keyword with median ≥ 100k or ≥ 8/30
  small-channel hits. Read its top-5 titles: if they are songs or another thing of the same name (블랙 스완 → BTS,
  노인과 바다 → songs), add the author or the topic word, or lead with the problem keyword instead.
- A person's name only when people search for that person (쇼펜하우어 yes; 칸토어 no — say the question instead).
- Write 3 titles; `title_check.py --strict` passes on the one you upload. Keep the other two for Test & Compare.
- Honest: the video delivers exactly what the title promises. No medical, legal or money promises.

**Cover (the YouTube thumbnail)** — drawn in `scenes.js` `COVER`, rendered by `export.py cover` (TEMPLATES "Cover").
- Not a still of the video and not the title card. One subject filling ≥ 50 % of the height (a figure doing the
  hook's verb, or one object that carries the tension), on one side; the text on the other side.
- Cover text: ≤ 8 characters (3–6 is best), 200–280 px at 1080p, ink with the paper halo. It adds to the title — the
  feeling or the stake ("시간이 샌다", "왜 나만?") — and never repeats the title or gives away the answer.
- Show the tension, not the payoff: the empty clock, the stuck figure, the tilted ladder. The answer is the video.
- `coverPage()` paints a deeper page than the video's: the video's pale blue is 1.6:1 against YouTube's white.
- Leave the bottom-right corner (about 300 × 130 px at 1080p) empty: YouTube draws the running time there.
- Lines: `renderCover()` draws every ink line 2.4x as thick; still, prefer big simple shapes.
- Check `out/cover_check.jpg` (1280 / 320 / 168 px): at 168 px you must read the text and name the subject. Fix every
  `WARNING cover:` line from `export.py cover`.
- Make 2–3 covers (`export.py cover --out cover_b` after changing COVER) when the channel can use Test & Compare.

**Description**
- First two lines (shown before 더보기): the hook question again in other words, then what the viewer gets ("책 세
  권이 말하는 방법 다섯 가지"). Not "N분에 걸어 보는 도슨트북".
- Then the chapters from `out/chapters.txt` (YouTube needs ≥ 3 timestamps, starting at 0:00), the books with their
  Korean editions, music credits (`out/music_credits.txt`), and for health, law or money topics one plain line: this
  video is a book review, not advice; see a professional.
