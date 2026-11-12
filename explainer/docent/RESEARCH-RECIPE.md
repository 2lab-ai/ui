# Research recipe — make-docent-book, make-3b1b

`zworkflow:research-skill <skill>` owns the method (seeded probes, blind review, root causes, paired re-runs, review
before anything lands). This file owns the domain of the two explainer skills that run on this kit. The skills point
here from their `## Research recipe` line.

## Run folder and freeze
- `run=~/2lab.ai/ARTIFACTS/research/<skill>/<YYYY-MM-DD-HHMM>/` (never /tmp: session folders are wiped).
- Freeze the kit for the whole run: `git -C ~/2lab.ai/ui archive <commit> explainer | tar -x -C RUN/kit`, and note the
  commit. In run 1 the kit changed three times under running probes and the authors had to re-lint and re-render.

## Probes
- **make-docent-book**: 10 random books from a written pool (≥ 30), at least 7 of the 8 types in the skill's format
  matrix, at least 2 with ≥ 3 people, 1 with an animal, 1 with numbers or dates, 1 fiction (premise only). Each probe:
  2–3 sentences (≈ 10 s), cwon narration, 2–4 shots, its own music cue, the full gates (asset gallery, scene lint), a
  1080p MP4 clip.
- **make-3b1b**: 10 topics from a written pool (geometry, probability, the history of a formula, …), each a 10 s clip
  with one formula: script → cwon voice → animation → score → mix → 1080p render.

## Shared resource
The cwon GPU voice (one host, one queue). Authors write all scripts first; the voice jobs then run one after another.
Budget 5–13 min of narration per probe when 5 share the queue.

## Review evidence (a reviewer cannot listen)
- Stills at every sentence start + 0.8 s and end − 0.3 s, a contact sheet (`sheets.py`), frames from the MP4 itself.
- Audio as facts: the per-sentence transcript (`audio_check.py --sentences`) and the mix numbers (`mix_check.py`: dB
  under the voice, swell in the gaps, title-card level, cue id).
- The same cue, pose or layout in two different inputs is a defect of the skill, not of the probe.

## Automatic checks
`lint_scenes.py` (0 P0/P1), `audio_check.py --sentences`, `mix_check.py`, and the kit gates (`node --check` on the
engine files; `test_padcut`, `test_ko_say`, `test_cwon_say`, `test_audiobook`, `test_music`, `test_library_score`).

## Where improvements land
- `explainer/docent/` (REFERENCE · TEMPLATES · LESSONS) and the kit code, one PR to this repo, with a test or a demo
  still for every primitive touched.
- Never skip the review for drawing changes: in run 1 round 2 a renamed variable silently made every face neutral; all
  three reviewers caught it before merge.
- After a default changes (shot lead, timing, layout): re-lint `examples/docent-lab` and every sample the owner will
  see, and look at full-size frames yourself — lint passed a name tag on another person's chest and a tail aimed at a
  helmet in run 1.

## Scoring note
Read the paired re-runs first. Run 1: paired +0.10 / +0.11 / +0.26 while the all-probe mean went 4.05 → 3.97 — the
reviewers had moved on to defects the old checks could not see.

## Log and deliverable
- Log: `RESEARCH-LOG.md` in this folder, one dated entry per run (for make-3b1b, title the entry `make-3b1b`).
- Deliverable: a contact sheet or reel of the 10 probes before and of the re-runs after, plus the scorecard.
