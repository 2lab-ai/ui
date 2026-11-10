# Research log — make-docent-book

`research-skill make-docent-book` appends one entry per run: seed, the 10 probes, scorecard before → after, the
changes (skill / reference / templates / code) and what is still weak. Run folders live in
`~/2lab.ai/ARTIFACTS/research/make-docent-book/<date>/`.

## 2026-11-10 · baseline research (before the first probe run)
- Visual: comics balloon rules (tail aims at the mouth, ends short of it; reading order; never cover a face), the
  silhouette test for telling characters apart, animals from ovals plus 3 to 4 naming features, a 12-criterion rubric
  for a 10 s clip (picture matches sentence, identity, bubbles, animals/props, composition, legibility, ghosts, rhythm,
  originality, music level, overall slop) with 11 automatic checks.
- Music: change at structural breaks; beds 20 to 25 dB under the voice; cues to exact length with a cadence; procedural
  MIDI + MIT SoundFont as the default backend (MusicGen weights are non-commercial; free libraries have no bulk API
  and Content ID risk).
- Result: kit changes in docent.js (cast, say/think, animals, per-frame lint registry), tools gallery.py,
  lint_scenes.py, timeline_draft.py, music_lib.py, score.py.
