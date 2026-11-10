# Lessons — defects found in real docent videos and what closed them

Newest first. One line per defect: video · what the viewer saw · root cause · the fix and where it lives. A defect
that comes back means the fix was not structural: replace it with a check.

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
