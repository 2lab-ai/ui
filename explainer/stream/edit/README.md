# edit — the fast edit (편집본) of a stream VOD

One line: a 30-minute live VOD from this kit becomes a ~14-minute YouTube edit the way streamers' editors cut theirs —
a 10-second cold open, a 5-second title card on the channel's jingle, the stream jump-cut to its lines, an end card.

- **Order of the video** — cold open (10 s) → title card + jingle (5 s) → the stream → end card (8 s)
- **Files** — `cut.py` (the cut, audio, captions, chapters), `cards.mjs` (HTML → PNG/MP4), `sound.py` (jingle + effects), `review_edit.py` (panel)
- **Per episode** — `edit_plan.py` in the episode folder decides what is kept, zoomed and captioned

Read §1 to make one, §2 for the editing rules, §3 for review.

## 1. Run

```
# the live build must have mix_dry.wav (engine/mix.py writes it next to mix.wav)
python edit/cut.py <episode dir> <live build> <out> --plan-only          # lengths only: cold open, main, cuts, timelapse seconds
python edit/cut.py <episode dir> <live build> <out> --portrait <bust.png> --portrait-end <bust2.png>
#   -> <out>/final_edit.mp4, subs_ko.srt, subs_en.srt, chapters_ko.txt, chapters_en.txt, edl.json
python edit/review_edit.py <out> <episode dir> e1                         # write <out>/ssot.txt and review_note.txt first
```

About 6 minutes on an M-series Mac for a 14-minute edit (189 parts encoded 8 at a time). Portraits come from
`engine/portrait.mjs` (the channel art busts).

## 2. Editing rules (what real stream edits do, and what this one does)

| Rule | How `cut.py` does it |
|---|---|
| Hook in the first seconds, cut off at the funniest point | `COLD_OPEN`: 3–4 shots, a freeze on the punchline with a caption and a record scratch, then a whip into the title |
| A title card and the channel's signature tune, ~5 s | `html_title` (photo of the episode's symbol, channel, series, episode, book title, the symbol circled) + `sound.py` jingle, 5.0 s, the same tune every episode |
| No dead air | every kept line stays whole (+0.06 s before, +0.14 s after); the silence between kept lines is cut unless something happens in it |
| Keep what happens in the gaps | donation alerts, walk-off and walk-in, the extra coming and going, the doorbell stay at 1×; drawing and typing play 2–8× with a ▶▶ badge |
| Cut to length | `DROP` lists the lines left out (greetings, second examples, side notes, the recap). Target ≤ 15 min; ep. 1 = 179 of 270 lines, 14.0 min |
| Punch-ins | `ZOOM[line] = box` cuts to a closer frame for that line (face for reactions, a canvas box for drawings) with a whoosh |
| Burned-in captions | every line, bottom centre; the main voice white on purple, the extra pink |
| The editor's jokes | `EMPH[line] = (text, gag|key|tag, sfx)`: a tilted yellow aside, a purple key-point box, or a pink label; a few per minute, never on lore lines |
| Context lost by a cut | `CHAT[line] = '…'`: the chat message a line answers, as a bubble |
| The book's symbol as a real image | `INSERTS`: the photo the streamer pasted fills the screen for ~3 s with a slow push-in |
| Music | the live mix without its music (`mix_dry.wav`) is cut, and the stream's BGM runs under the whole edit unbroken, ~19 dB under speech |
| Chapters | `CHAPTERS` line ids → `chapters_ko.txt` / `chapters_en.txt` with edit timecodes (first line 00:00) |
| End card | next episode, the episode's photo in a box and a circle where YouTube's end-screen video and subscribe elements go |

Do not caption the streamer theme's lore (Kate's old-knowledge slips stay as said, unmarked). The owner wants it implied.

## 3. Review

`review_edit.py` sends three engines (llmux, `REVIEW_MODELS`) the cold-open and title strips, a 24-frame sheet of the main
part, the key moments (insert, captions, chat bubbles, timelapse, zooms, donation, the extra, end card), a timeline/shot-length
chart, a loudness curve, the edit's transcript with the editor's marks, and these criteria:

| Criterion | Points |
|---|---|
| Cold open: funniest/most absurd moment, cut sharply | 15 |
| Title 5 s + signature music ~5 s, branding readable | 10 |
| Tempo: ≤15 min, no dead air, jump-cut rhythm, sped-up drawing | 20 |
| Editing: captions, emphasis, SFX, zooms, chat bubbles — timing and amount | 20 |
| Content still clear after the cuts | 15 |
| The book's symbol on screen as a real image | 10 |
| Upload-ready: end card, chapters, VOD feel, no broken frames or sync | 10 |

Score on the mean of the three engines, and on more than one run when a result is near the bar. Never tune the prompt.
