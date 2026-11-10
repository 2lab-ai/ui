# Lessons — defects found in real docent videos and what closed them

Newest first. One line per defect: video · what the viewer saw · root cause · the fix and where it lives. A defect
that comes back means the fix was not structural: replace it with a check.

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
