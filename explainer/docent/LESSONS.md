# Lessons — defects found in real docent videos and what closed them

Newest first. One line per defect: video · what the viewer saw · root cause · the fix and where it lives. A defect
that comes back means the fix was not structural: replace it with a check.

## 2026-11-13 · 'Stoics on time' (Seneca, Marcus, Epictetus; 20:40, five authors, first book on the ink-mode kit)
Gate C (a fresh reviewer on every sentence's stills) found what the lint passed:
- Three seated figures with no legs · the chair seat ran as deep as the thighs, so the thighs lay on its top edge and
  the shins hung right beside its front leg (a third chair leg) · TEMPLATES T15 "Seated figure": the seat stops at
  x + 34 s, the knees bend at x + 64 s.
- A vase for a body, a clock for a belly, a purse for a paunch, a pouch that read as a cat · a round prop the size of
  the torso drawn over it becomes the body · lint `prop-over-body` (P2: a prop centred on a torso drawn before it,
  covering more than half of it; flat sheets skip it; `bodyOk: true` when hugging is the point); REFERENCE §4.
  Run after the Gate C fixes, it still found 9 frames (one a Gate C frame whose fix had not gone far enough), all
  fixed: held at the hand, beside the body, or small at the chest.
- The lived weeks shaded grey vanished · ink mode paints a light fill as the page, so a grey that carries meaning
  disappears · draw meaning with ink (hatching, a line), or `colour: true` on that one call.
- Narration in the sandboxed session ran at ~55 s a sentence (4-5 hours for 308) · http mode sent one job per
  sentence, so the voice model reloaded every time, and the ear check (Metal unavailable: whisper on the CPU) ran twice
  per sentence after it · one multi-turn job per scene cut at the merge's digital silence (~14-16 s a sentence), both
  cut-off pieces heard in one pass, and the next scene synthesising while this one is checked (narrate_soma.py).

## 2026-11-13 · owner: "the reference is minimal; you show too much, like AI slop — you emphasise everything"
Compared side by side: Productive Peter frames hold 1 to 3 things, 0 or 1 written word, black ink with purple on the
word and one red mark; Elon Musk v2 and ten-books v2 frames held 5 to 12 things, 3 to 4 labels, coloured clothes and
props, up to 9 red X's, a subtitle sentence and a chapter chip in every frame. The rules themselves pushed the clutter:
- Shots filled to the edges · `bottom-heavy` (P2) told every author to draw something in the top 42 % · removed;
  REFERENCE §6 now says the empty page is the default.
- Everything emphasised, so nothing stood out · no rule said what may be emphasised · REFERENCE §0 "Emphasis budget":
  only the named idea, the one number, the one verdict, a colour that is the meaning; lint `busy` (5+ things P1, 4 P2),
  `words` (3+ P1, 2 P2), `marks` (2+ P1), `colour` (P2), `mark-budget` (red in more than ~1 shot per 45 s).
- Coloured shirts, stalls, cakes, charts · cast looks carried an accent colour and outfit fills, props had built-in
  fills · ink mode (project.json `"colour": false`, set for new docent projects; older projects keep their colours):
  figure / person / animal / prop paint every colour as ink and every light fill as page; `colour: true` keeps one.
- A full sentence under every drawing · subtitles burned in by default · new sketch projects get `"subtitles": "off"`
  and `"chip": false`; `export.py srt` writes the caption track for YouTube.
- Every device in every chapter (sign, situation, bubble, board, equation, X and ring) · the skill listed them as a
  chapter's order · the skill now picks one device per sentence; the board and the red mark once per chapter.
- Recipes that broke the budget themselves · T3 (three people, two bubbles), T8 (six labels), T9 (X and ring), T13
  (purple line + label), T14 (cloud, X and bubble in one shot) · rewritten; docent-lab lints clean under the new checks.
- Tooling found in this run (sandboxed session): Chromium and Firefox cannot start (macOS Mach `bootstrap_check_in`
  denied) · `noderender/` runs the same engine on Node + Skia behind a playwright stand-in; the voice takes were
  copied over ssh · `SOMA_VOICE_FETCH=http` takes them from the job's result URL.

## 2026-11-10 · music of the two v2 videos — owner: "음악 너무 개쓰레기같음" (the music is garbage)
- The music sounded like a toy under a documentary voice · `score.py` cues are General MIDI instruments (marimba,
  xylophone, kalimba arpeggios) changing every ~35 s · recorded CC BY narration beds (`library_score.py`,
  `music/library.json`), one track per chapter; MIDI stays as the offline fallback.
- Busy tracks would fight the voice · nothing measured a track before use · every library track measured (percussive
  share, attacks/s, 1–4 kHz energy, dynamics); only `bed: true` tracks are placed; test_library_score checks the limits.
- 12–23 s near-silences mid-chapter in the first library mix · tracks' quiet outros played out under the voice ·
  only the audible body (`body_start`…`body_end`) is placed, a track changes at a sentence gap ≥ 25 s before the
  chapter ends; test: no dip > 0.5 s inside the bed.
- Title cards at −33.5 dBFS with a library bed (recorded music is denser, so the voice ducks it lower) · the +6 dB
  open-stretch lift was tuned for MIDI · +10.5 dB for `kind: library` scores; `mix_check` −29 dBFS.
- CC BY needs attribution · `out/music_credits.txt`, pasted into the YouTube description.
- The music stopped dead for 1.5–2.5 s mid-sentence (Musk v2b 22:08–22:40, 12:02–12:40; 10 books 3:37–4:20) · five
  sparse tracks rest inside (−30…−59 dB) and passed every bed check (perc, attacks, speech band) · `holes()`
  (overlapping windows, found at any offset): `--measure` writes `holes` per track, catalogue() skips any with holes
  (test); scanned the delivered beds, re-mixed both videos.
- PR #59 re-review: `urlopen` accepts a body shorter than its Content-Length, so a dropped download would sit in the
  cache and leave a silent stretch in every bed using it · `download()` checks the length; `assemble()` fails on a
  file shorter than its section (tests with a local server).
- PR #59 review: a section plus its cross-fades could need 2.5 s more than its track's body, so the fade-out ended
  early and 21 of ~800 simulated cross-fades dipped 6–11 dB; `--plan` overwrote the credits of the rendered score ·
  the planner budgets `use − XF − H`, a test checks every section + cross-fades fits on 150 random timelines; `--plan`
  writes only `out/cue_plan.md`, the credits are written after the render.

## 2026-11-10 · v2 redraw of 'Elon Musk' (29:43) and '생각을 바꾸는 책 10권' (44:41) — same voice, new pictures
Nine authors (parts/ + a private preview each), nine fresh Gate C reviewers, 24 scenes, ~1,330 shots. Lint said 0 on
every scene; the reviewers still found 0–2 P1 and 1–14 P2 per scene. What they saw and what closed it:
- Speech tails ending in the hair, at the temple or on a cap brim (14 tails in 9 reviews, lint silent) · `say()` aimed
  the tail along the mouth→bubble ray, which leaves an upper bubble's head at the temple; the lint excused any tip
  within 70 px of the mouth · a side bubble's tail now ends beside the face at mouth height; `tail-high` excuses only
  tips within 0.9 r of the mouth.
- Name tags unreadable in grey (엔지니어, 도이치) · tags take the accent colour as is · `docentTagInk()` darkens a tag
  until it reads at 4.5:1 on a light page.
- See-through animals (cat, dog, turkey tail) · animal fills were translucent `mix()` · opaque fills.
- The trophy read as a table lamp (two reviews), the bulb's glass floated above its base (three) · kit props · a cup
  with handles; one closed glass on the base.
- Isaacson's "notebook" was a music note (six authors drew their own) · `note` is a quaver · `PROPS.notebook`.
- Three authors drew the same arms-up pose (a barbell overhead) · no pose · `POSES.lift`, `POSES.stop`.
- Every red X off its target in one scene · `cross()` takes the top-left corner, `ring()` the centre · `crossAt()`.
- `cool` used for calm and confident faces read as a censor bar (three reviews) · the name · README: cool = sunglasses.
- Easel/board legs ending in mid-air, buildings and props floating above the ground line (most reviews) · authors
  placed boards by eye · still open: needs a "stands on" check (open gap below).
- Same person, two looks (Einstein in two chapters); a guest cast sharing a top hat in three chapters · each author
  cast their own extras · shared people go in common.js; the whole-project lint (`cast-similar`) runs before Gate C.
- The hair × hat pairs ran out at ~15 people per video (Einstein got a cap) · 8 hairs × 7 hats, half of them odd on a
  scientist · open gap: more hair styles.
- The whole-project lint crashed writing one 140,000 px sheet (JPEG max 65,535) and exited 1 with no P1 · one sheet
  · `lint_sheet.jpg`, `lint_sheet_02.jpg`, … 60 frames each (look at every page).
- Two videos scored at the same time opened on the same cue chain (curious-02 → playful-03) · history saved after a
  minutes-long render · saved right after planning.
- The first armour, sized from a guessed head radius, covered a tall man's arms · scale from anchors (TEMPLATES L).
- Two contact-sheet stills per sentence missed the middle shots of long sentences (every reviewer rendered extras)
  · open gap: a still at every shot's rest time in the sheets.
- Open gaps: things standing on what holds them (lint cannot see support), a sitting figure that cannot lean onto a
  desk, more hair styles, sheets with every shot.

## 2026-11-10 · research-skill run 1, round 2 (blind review of the 5 re-runs + the owner's v2 samples)
- A name tag on the next person's chest (Elon · PayPal: Thiel's tag on an executive) · tags were placed before later
  figures existed · `docentTags()` places every tag when the shot is complete; lint `name tag over another figure`.
- Speech tail aimed at the top of a helmet (GEB anteater, a hand-placed `bubble()` tail) · no check for a tail above
  the eyes · lint `tail-high` (P1); `say()` avoids the spot right above the head and, if it must, runs the tail down to the mouth.
- Music near-silent on title cards (−33 dBFS) and gone 4 s before the end (5/5 reviewers) · flat gain + a 4 s fade ·
  +6 dB in open stretches, 1.5 s fade; `mix_check` fails `music_open_dbfs` < −30.
- Shots opened on a blank page while the voice named the subject (2/5) · cut at the word · `shots()` `lead` 0.3 s.
- The stick body showed through vests and togas (3/5) · body drawn over a translucent fill · body first, opaque clothes.
- Heads read as unfilled holes (2/5) · filled with the page colour · a lighter paper tone.
- Tags floated 80–100 px from their figure (3/5) · offset 112 px · 92 px.
- The laurel ringed the whole face · leaves spread over 240° · on the crown only.
- PR #56 review: the head-fill variable was named `face` and shadowed the expression (every face neutral) · caught by
  all three reviewers before merge · renamed `headFill`; full-size still of a happy/worried pair is part of the check.
- A tail tip on the curls at temple height (lab frame) · the hair band only covered the scalp · the band reaches the
  mouth line; offset bubbles end beside the face at mouth height, a bubble right above still leaves by the top.
- The top 40 % of the frame empty (4/5) · no rule · REFERENCE §6 + lint `bottom-heavy` (P2).
- The verb not drawn: Jones never driven out, nobody boards, Demian just points (3/5) · skill text asked for a
  picture, not the action · REFERENCE §1 "draw the verb"; Gate C asks it per sentence.

## 2026-11-10 · research-skill run 1, verification round (5 re-runs on the merged kit)
- A bubble landed on a board · placement only avoided figures, heads, tags, bubbles · props and boards reserve their box.
- Name tags on a wolf's legs; a tag between Jones and the hen · tag side used only figures drawn earlier · `tagSide`;
  TEMPLATES placement notes (people left to right, bubbles last).
- `lint_sheet.jpg` thumbnails (320 px) too small to see a defect · 640 px, 3 across.
- mix_check printed no swell and no verdict (22.3 dB passed a 20–22 target) · `swell_db`, `verdict`, exit 1 outside
  18–26 dB or swell > 6 dB.
- `q.w('모두')` hit "모두의" 1.3 s early · TEMPLATES: `q.wx` for the exact word.
- `sheets.py` with no arguments and `audio_check.py` before the voice crashed · defaults and a clear message.
- A frozen kit copy wrote an empty `ui_commit` · new_video reads `KIT_COMMIT`.

## 2026-11-10 · research-skill run 1 (10 random books × ~15 s probes, blind review)
- Every cut double-exposed: the next picture drew through the fading one · `shots()` 0.22 s cross-fade · hard cuts by
  default; an optional fade shows the old picture first, then the new one.
- Three of ten books got the same cue (`mystery-01`, seed 0) · the planner was deterministic per mood across videos ·
  per-project rotation + `history.json` of the last 10 videos; per-project render seed.
- Music swelled 8–15 dB between sentences, and sat only 16–18 dB under the voice · ratio 6 / release 0.6 s · volume
  0.20, ratio 2.5, release 1.2 s for score.py scores: 20–22 dB under, ~4 dB swell (measured on 3 probes).
- Name tags 22–30 px, low contrast, a bare "나" · tag drawn small above/next to the chest · 42 px+, paper outline,
  beside the waist; REFERENCE: the tag is the name the narration uses.
- audio_check marked correctly read numbers as errors (match 0.75, 1/3 aligned on Madame Curie) · whisper writes
  digits · both sides through ko_say; names hinted from project.json `names`; `--sentences` gives a verdict per
  sentence (Madame Curie: 0.97, 3/3, all ok).
- Missing assets: whale, turkey, swan, mammoth, pig, horse, hen, ship, trolley, lever, frame, moon, barn and more ·
  no documented extension route · TEMPLATES "Adding an asset" (contract), and the 23 assets the probes drew are now
  in docent.js.
- A rock drawn over a face, a tiny subject (29 % of the height), two tags overlapping passed the lint · new checks
  `prop-over-face` (P2, a box test), `small-subject`, `name tag over name tag`; `out/lint_sheet.jpg` shows every rest frame early.
- The poet and the visitor were the same figure in two colours · lint `cast-similar` (hair and hat must differ).
- Props were see-through (a table through a tent) · props are outlines · `solid: true` fills a prop with the page
  colour (opt-in: a default fill hid the liquid in the flask and the test tubes — PR #55 review).
- Gallery sheets overlapped wide props · 8 per page, s 0.75.
- The kit changed under running probes; `ui_commit` named a commit the copied engine did not match · `+dirty` when the
  engine has uncommitted edits; the skill pins the kit for the whole run.

## 2026-11-10 · Elon Musk biography (sketch, 12 chapters) — owner: "too much AI slop, broken in places"
- Every person looked the same (same stick figure, no names) · no character system · `cast()`/`person()` + lint `twins`.
- Speech bubbles floated far from the speaker, tails pointed at nothing, some bubbles were empty · hand-placed
  `bubble()` with a tail only from the bottom edge · `say()`/`think()` auto-placement, tail from the nearest edge,
  lint `tail-far` `empty-bubble` `bubble-over-face`.
- Faded "ghost" copies of earlier drawings stayed on screen · scenes faded layers to ~30 % instead of removing them ·
  lint `ghost`, REFERENCE §1.
- Labels still half-written when the picture changed · draw-on longer than the shot · lint `half-drawn` at every
  shot's rest frame.
- Broken props (parts misaligned) · props drawn ad hoc in scenes.js, never reviewed · gallery gate (§8.1).
- The same music loop for the whole video · `music.py` had one D-major loop · cue library + `score.py`.
- Assets were made and used without anyone looking at them · no gate between drawing and using · gallery + lint gates
  are now required steps in the skill.

## 2026-11-09 · Gödel, Escher, Bach (30:31)
- The anteater was a stick figure with a long nose · no animal library; `figure({snout})` · `animal('anteater')`, lint
  `animal-on-rig`.
- Achilles and the Tortoise were told apart only by helmet and shell; the Crab and others were fine · OK for two, not
  for more · cast system.
- One music loop for 30 minutes · as above.
- Keywords drifted into the subtitle box in the classroom shot · `teach()` default y · fixed in PR #51 (y 720), lint
  `subtitle-zone`.
