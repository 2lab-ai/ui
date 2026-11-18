# edit — the fast edit (편집본) of a stream VOD

One line: a 30-minute live VOD from this kit becomes a ~14-minute YouTube edit the way streamers' editors cut theirs —
a 10-second cold open, a 5-second title card on the channel's jingle, the stream jump-cut to its lines, an end card.

- **Order of the video** — cold open (10 s) → title card + opening jingle (5 s) → the stream → end card + closing tune (7.5 s)
- **Files** — `cut.py` (the cut, audio, captions, chapters), `cards.mjs` (HTML → PNG/MP4), `sound.py` (jingle + effects), `review_edit.py` (panel)
- **Per episode** — `edit_plan.py` in the episode folder decides what is kept, zoomed and captioned

Read §1 to make one, §2 for the editing rules, §3 for review. The sources behind the rules: `RESEARCH.md` (§4: the three
reference edits the owner picked and the workflow taken from them).

## 1. Run

```
# the live build must have mix_dry.wav (engine/mix.py writes it next to mix.wav)
python edit/cut.py <episode dir> <live build> <out> --plan-only          # lengths only: cold open, main, cuts, timelapse seconds
python edit/cut.py <episode dir> <live build> <out> --portrait <bust.png> --portrait-end <bust2.png>
#   -> <out>/final_edit.mp4, subs_ko.srt, subs_en.srt, chapters_ko.txt, chapters_en.txt, edl.json
python edit/qa_edit.py <out> <out>/qa/edit                                # one still per editor mark, 16 a sheet: look at all of them
python edit/review_edit.py <out> <episode dir> e1                         # write <out>/ssot.txt and review_note.txt first; run it twice
```

About 6 minutes on an M-series Mac for a 14-minute edit (189 parts encoded 8 at a time). Portraits come from
`engine/portrait.mjs` (the channel art busts).

## 2. Editing rules (what real stream edits do, and what this one does)

| Rule | How `cut.py` does it |
|---|---|
| Hook in the first seconds, cut off at the funniest point | `COLD_OPEN`: 4–5 shots, a freeze on the contradiction with a caption and a record scratch, then a whip into the title. A shot is a line (`pre`, `post`, or `cut` = stop that many seconds in, with `text` for its caption) or a time span (`at`, `dur`, `speed`); `sub: False` hides the caption when the picture is the words; `caption` works on any shot. Stop on the contradiction, before the explanation (ep. 1 stops at "네 개였어요", not "하나는 꼬리예요") |
| A title card and the channel's signature tune, ~5 s | `html_title` (photo of the episode's symbol, channel, series, episode, book title, the symbol circled) + `sound.py` jingle, 5.0 s, the same tune every episode |
| No dead air | every kept line stays whole (+0.06 s before, +0.14 s after); the silence between kept lines is cut unless something happens in it |
| Keep what happens in the gaps | donation alerts, walk-off and walk-in, the extra coming and going, the doorbell stay at 1×; drawing and typing longer than `TL_MIN` (3 s) play about `TL_ON` (1.3 s) at a whole-number speed (×2–×16) with a ▶▶ badge; shorter ones are cut out (the result shows anyway) |
| Cut to length | `DROP` lists the lines left out (greetings, second examples, side notes, the recap). Target ≤ 15 min; ep. 1 = 179 of 270 lines, 14.0 min |
| Punch-ins | `ZOOM[line] = box` cuts to a closer frame for that line (face for reactions, a canvas box for the term or diagram being explained), straight, without a sound |
| Burned-in captions | every line, bottom centre; the main voice white on purple, the extra pink |
| The editor's jokes | `EMPH[line] = (text, gag|key|tag, sfx)`: a tilted yellow aside, a purple key-point box, or a pink label; a few per minute, never on lore lines |
| Context lost by a cut | `CHAT[line] = '…'`: the chat message a line answers, as a bubble |
| The book's symbol as a real image | `INSERTS`: the photo the streamer pasted fills the screen for ~3 s with a slow push-in |
| Music | the live mix without its music (`mix_dry.wav`) is cut, and the stream's BGM runs under the whole edit unbroken, ~19 dB under speech |
| Chapters | `CHAPTERS` line ids → `chapters_ko.txt` / `chapters_en.txt` with edit timecodes (first line 00:00) |
| End card | next episode, the episode's photo in a box and a circle where YouTube's end-screen video and subscribe elements go; with `END['clip']` the card is drawn over a muted bonus clip from the stream with a handwritten ask; `END['dur']` (ep. 1: 7.5 s, the closing tune and its ring-out; YouTube's end screen needs 5 s) |

### The editor's voice (from the reference edits, `RESEARCH.md` §4)

| Mark | Plan name | How it looks | Use |
|---|---|---|---|
| Caption voice | `TONE[line] = shout\|mutter` | shout: heavy display face, bigger; mutter: small grey handwriting; the extra: pink, round face | the loud lines and the mutters, a handful per episode |
| Key phrase in a caption | `HL[line] = 'phrase'` | that phrase in yellow inside the normal caption | where the book's term is first said |
| Corner label | `CORNERS[line] = 'text'` | big yellow-orange gradient text above the captions, 2.4 s, a soft whip | the first kept line of each part (≈ the chapters) |
| State label | `STATE = [(from, to, '동공지진')]` | yellow (bracketed) word over her head (`HEAD`), held from one line to another, follows the punch-ins | a reaction that lasts a few lines; 4–6 per episode |
| The editor's aside | `EMPH[line] = (text, 'narr', sfx)` | handwritten yellow-orange, third person, bottom left | a fact the viewer cannot hear ("정확히 2분 지킴"); about one a minute at most |
| Chat punch-in | `CHATZOOM = [line, …]` + `Z['chat']` | the frame cuts into the live chat; her line becomes a chat box | where the real chat erupts (2 per episode) |
| Follow the drawing | `ZOOM[line] = ('box_a', 'box_b')` | an eased pan from one box to the next (same size) | a diagram built line by line: each line shows the piece just drawn |
| Real photo | `BROLL = [{at, image, dur, label}]`, `layout: 'card'` | full screen with a dissolve and a small "📷" label; or a tilted photo card beside the drawing | **every real thing she names**: a person, a product, a company's object, an animal, an artwork, a place, an invention, a book. The actual one, not a stand-in (owner, 2026-11-18). Placed on the word (`at` = the word's start ÷ the line's length, from `audio/<id>.words.json`). Credits in `props/broll/CREDITS.md` |
| Thesis card | `EMPH[line] = ('label\|line', 'thesis', None)` | the frame darkens, the line in a serif, no sound; the card replaces the caption | the book's line to keep (1–2 per episode) |
| Result card | `EMPH[line] = ('top\nbottom', 'result', 'ding')` | a two-line tally above the captions | before the goodbye |
| Live-date label | `LIVE = '2026. 11. 17(화) 생방송 내용입니다'` | yellow text top left, 3.6 s | where the stream part starts |

Punch-ins cut straight without a whoosh (set `ZOOM_SFX = True` to bring it back). One mark per beat still holds: a line
with a state label or a photo gets no aside.

Do not caption the streamer theme's lore (Kate's old-knowledge slips stay as said, unmarked): no aside, state label or joke points
at what she should not know. The thing she talks about still gets its real photo with a plain factual label (the aurochs, the
cave painting, the murex shells): that shows the subject, not her.

**The reference sweep (owner, 2026-11-18: "편집본은 말하고 실제 레퍼런스 찾아서 해당 내용 붙여줘야지").** Before writing `BROLL`, read
every kept line and list each concrete thing named in it. Every item gets its real picture: find it (Wikimedia Commons, Openverse;
PD / CC0 / CC BY only), or write down why there is none. Ep. 1 missed the aurochs, the Lascaux painting, the old metal paint can and
Dutch Boy's plastic jug in v2, and the owner caught it. One mark per line still holds: a photo card replaces a joke caption on the same
line (`(폴더폰 저격)` became the flip-phone card's label).

**The jingle and the closing tune.** `JINGLE = '<name>'` picks one of `edit/jingles.py`'s candidates (real instruments, FluidSynth + MuseScore General)
for the title card; without it the edit uses `sound.py`'s synthesised tune. `OUTRO = '<name>'` puts another candidate on the end card:
it starts with the card's fade-in, the BGM bed fades out in the 0.6 s before it and does not come back (`cut.music_bed`); without it the
bed swells to the last frame. `python edit/jingles.py <dir>` renders all candidates for the owner to choose; ep. 1 uses the owner's picks,
no. 13 `funk_clav` (opening) and no. 14 `piano_sting` (closing).

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
Episode 1: v1 84.0 / 81.7 when uploaded (86.7 / 80.3 re-scored on 2026-11-18); v2 80.3 / 80.3 after nine rounds
(`RESEARCH.md` §4.5); the public edit with the reference sweep and the new jingle 80.3 / 81.0 (§4.6). The rubric does not score the reference grammar of §2; judge that by eye from `qa_edit.py`.
