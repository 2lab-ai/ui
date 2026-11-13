# Research log — make-docent-book

`zworkflow:research-skill make-docent-book` appends one entry per run: seed, the 10 probes, scorecard before → after,
the changes (skill / reference / templates / code) and what is still weak. Run folders live in
`~/2lab.ai/ARTIFACTS/research/make-docent-book/<date>/`. What a run probes and checks: `RESEARCH-RECIPE.md`.

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

## 2026-11-10 · run 1 (`~/2lab.ai/ARTIFACTS/research/make-docent-book/2026-11-10-1120/`)
- Seed 20261110; 10 random books from a 34-book pool, one ~15 s clip each, made by fresh authors from the skill
  alone, judged blind on a 13-criterion rubric (weights 1–2; pass = weighted mean ≥ 4, nothing ≤ 2).
- Probes: 모비 딕, 마담 퀴리, 하늘과 바람과 별과 시, 정의란 무엇인가, 명상록, 블랙 스완, 스티브 잡스, 사피엔스,
  동물농장, 페르마의 마지막 정리. Baseline 4.05 mean, 8/10 pass; weakest: ghosts 3.3, composition 3.6, music 3.7.
- Diagnosis: 12 root causes (double-exposed cuts, deterministic cue choice across videos, pumping mix, small tags,
  digits failing the transcript check, missing assets, no tail/tag/prop-over-face checks, see-through props, kit
  changing under running probes). Fixes merged in PR #55 (hard cuts, cue rotation + history, gentle ducking, 23 assets,
  new lint checks, `mix_check`, `audio_check --sentences`).
- Verification: 5 clips on the frozen kit (seed 20261111; 3 re-runs + 2 new books). Same books re-run scored higher
  (명상록 3.74 → 3.84, 동물농장 3.89 → 4.00, 모비 딕 4.00 → 4.26); ghosts 3.3 → 5.0, bubbles 4.1 → 4.5; all-probe
  mean 3.97 (3/5 pass). New weakest: picture-matches-sentence 3.8 (the verb not drawn), slop 3.2, music 3.6
  (near-silent title cards, early fade), nothing-broken 3.6 (bodies through clothes). Lint 0, every sentence ok and
  music 21–22 dB under the voice on all five — so what is left is what the checks cannot see.
- Round 2 (this PR): tags placed when the shot is complete, `tail-high`, `bottom-heavy`, music lift on title cards
  (`music_open_dbfs`), shot `lead`, opaque clothes, filled heads, "draw the verb" + Gate C questions.
- Still weak: drawing the action (needs per-sentence review, not a lint), things floating over their support, the
  hand-to-chin pose, reviewers cannot listen (music judged by numbers). Next run: re-probe the five verification
  books on the round-2 kit and score against `scorecard.md`.

## 2026-11-13 · run 2 — minimalism (owner: "the original is minimal; you show too much, like AI slop; you emphasise everything")
- Reference re-checked: Productive Peter frames hold 1–3 things, 0–1 written word, ink + one purple word + one red
  mark, no subtitles or chip; ours (Elon v2, ten-books v2) held 5–12 things, 3–4 labels, coloured clothes and props, up
  to 9 red X's, a subtitle sentence and a chip in every frame. The old rules pushed the clutter (`bottom-heavy`, cast
  accents, "every device every chapter", subtitles on by default).
- Seed 20261113, 10 books from the 34-book pool (p01 마담 퀴리 … p10 어린 왕자), one ~12 s scene each by fresh authors
  from the frozen skill (87df657), blind-reviewed on a 10-criterion minimalism rubric (focal point, emphasis budget,
  words, colour, overall ×2). No audio this run: the voice server was unreachable, probes used draft timelines.
- Baseline: weighted mean 2.63, 0/10 pass; weakest colour 1.60, words 1.80, emphasis 2.20, overall 2.20; picture-
  matches-sentence 4.30 and rhythm 4.20 — the drawing was not the problem, showing and emphasising everything was.
- Changes (PR docent-minimal): REFERENCE §0 emphasis budget (what may be emphasised, what never is, per-shot budget,
  the reference's shot types); ink mode for new docent projects (project.json "colour": false: figures, animals,
  props in ink, light fills as the page; open heads, plain tags); lint `busy` `words` `list` `marks` `colour`
  `mark-budget`, counted on the real engine at any depth; `bottom-heavy` removed; subtitles off + `export.py srt`, no
  chip; TEMPLATES T1–T3, T8, T9, T13, T14 and docent-lab rewritten inside the budget; noderender/ (Node + Skia page)
  and `SOMA_VOICE_FETCH=http` for sandboxed hosts.
- Verification (blind, same rubric): paired re-runs 체르노빌 2.13 → 4.13, 소크라테스 2.27 → 4.07, 퀴리 2.40 → 3.67
  (mean 2.27 → 3.96); new books 사피엔스 3.93, 안네의 일기 3.60; all five 3.88 (+1.25), 2/5 pass. Words +2.40, colour
  +2.00, emphasis +1.60, overall +1.60; picture-matches-sentence and things-read flat (−0.1/−0.2).
- Review: trinity (grok / astra / fable), 3 rounds: opt-in ink mode so older projects keep colours, words and marks
  counted wherever drawn, SRT millisecond carry, budget scoped to ink-mode projects.
- Still weak: lone figures drawn small (33 % of the height vs the reference's 40–70 %) — guidance only; one shot packing
  a whole sentence (cause, link, effect); reviewers still cannot hear the voice or music. Scorecard and reviews:
  the run folder `scorecard.md`, `review-*.md`.
