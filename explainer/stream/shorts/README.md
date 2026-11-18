# shorts — about-a-minute Shorts (쇼츠) from a stream VOD

One line: 2–3 vertical Shorts of 40–58 s per episode, cut from the live build's whole lines, each built to be watched to the end
and to send the viewer to the full live stream.

- **Why it is built this way** — `RESEARCH.md` (how the Shorts feed judges a short, the first seconds, the shape of a minute,
  the ending, the related-video link, the safe zone).
- **Files** — `shorts.py` (the cut, layout, captions, sound, metadata); the graphics and fonts are the edit's (`edit/cut.py`,
  `edit/cards.mjs`).
- **Per episode** — `shorts_plan.py` in the episode folder: one dict per short.

## 1. Make them

```
python shorts/shorts.py <episode dir> <live build> <out> --plan-only      # lengths only (each must stay under 60 s)
python shorts/shorts.py <episode dir> <live build> <out> [--only s1]       # ~10 s a short
```

Out, per short: `short.mp4` (1080x1920, 30 fps, -14 LUFS), `captions_ko.srt`, `meta.json` (title, description, tags, publish
time, related video, shots, captions, photos), `gfx/` (the cards and the base picture). The render fails if any frame of the
base picture lacks the stream (`blank_frames`: a shot that starts before its picture shows as a flash of background).

## 2. The plan

```python
LIVE = 'https://youtu.be/<live VOD>'          # every short's related video and the first link of its description
SHORTS = [{'id': 's1', 'publish': 'now' | 'YYYY-MM-DD HH:MM',
           'title': '<YouTube title: the question or the claim, then | book #series>',
           'hook': '<the title: a few words, a topic with a twist or a scene; no question template>', 'hook_key': '<one word in colour>',
           'lines': ['c10', 'c03', ...],      # whole lines, in the order they play; the first one is the spoken hook
           'hl': {'c07': '그냥 풍경'},         # one phrase per caption in yellow
           'show': {'c04': (image, label, focus)},  # a photo over that whole line (a blank canvas, the ending's picture)
           'zoom': {'r09': (x, y, w)},         # a punch-in on the live frame for that line's shot (canvas text, a doodle)
           'split': ['t15'],                  # start a new shot (a new picture) at these lines even with no time cut
           'no_broll': ['x28'],               # skip the edit's photo on these lines (the short frames them itself)
           'text': {'c09': '...'},            # caption text when it must differ from the line
           'end': '<the last line on screen: where the full stream is>', 'end_key': '<one word in colour>',
           'end_hold': 1.4,                   # the last line on screen after the last words (the stream keeps running if she is silent)
           'photo_labels': False,             # default: no captions on photos (real clips do not label their pictures)
           'desc': '...', 'tags': '...'}]
```

The edit plan's real photos (`BROLL`, `INSERTS`) and canvas punch-ins (`ZOOM`/`Z`) are reused automatically for the lines a
short contains, so a thing she names shows as its real photo on the word, as in the edit.

## 3. Layout (1080x1920)

| Band | y | What |
|---|---|---|
| frame | 0–1920 | black (#000): no gradient, no tint (RESEARCH.md §10) |
| title | 200–500 (x 40–1040) | a few words of Pretendard Black, white, filling the width; one word (`hook_key`) in flat yellow |
| canvas | 520–1160 | the Paint canvas at 1080:640 (or a punch-in on it), or the real photo (plain white label top left) |
| captions | 1040–1280 (x 48–888) | white with a black outline, ≤ 13 characters a line, one phrase yellow; after the last line the end line goes here |
| face | 1160–1767 | her face, big (eyes ≈ 1420) |

Everything that must be read stays inside the Shorts safe zone (`RESEARCH.md` §6); the title band may run wider because the button rail starts far below it.
No emoji, gradients, outlines on the title, pills or series badges anywhere: that was v1, and the owner called it AI slop (§10).

## 4. Upload and schedule

The schedule (owner, 2026-11-18): short 1 at the same time as the live stream (default 18:00), short 2 at 22:00 the same day,
short 3 at 16:00 the next day. Each short goes up **private**, then on its edit page:

1. the related video = the live VOD (`related_set.js`). On ep. 1 the channel could not use it: YouTube's advanced features
   were locked ("2차 영상 인증 실패", retry from 2026-12-18 or appeal). Until then the end card points at the channel home and
   the description carries the live URL as text with the path (channel name → home → the episode).
2. Korean captions from `captions_ko.srt`. YouTube may publish an automatic Korean track within minutes; then there is no
   add button: remove the automatic track (`caps_del_auto.js`, only when the cell says 자동), then add ours (`g_caps_ko.js`),
   then check the cells (`caps_check.js`).
3. public now (`vis_set.js`) or scheduled (`sched_any.js`, `<id>|2026. 11. 18.|오후 10:00`).

Replacing a short: upload the new one first, then set the old one private (`vis_set.js <id> PRIVATE`; a scheduled one has
no PRIVATE radio until its "save or publish" section is opened, so use `unsched.js`). Never delete.

Daily upload limit: without the advanced features the channel gets about a dozen uploads a day (ep. 1 hit it at the 14th on
2026-11-18). The upload dialog then says "일일 업로드 한도 도달" and its one-time verification leads to the same locked
verification. `up_private.js` prints `LIMIT` and stops; `watch.sh` (same folder) retries every 15 minutes and carries
on with captions and the schedule once a slot frees. Count the uploads before a remake: every replaced short costs one.

Scripts: `~/2lab.ai/ARTIFACTS/stream/book-night-01-purple-cow/shorts_upload/` (Aside, run with `run_files.sh`).

## 5. Episode 1 (2026-11-18)

v2 look (black frame, heavy white title, one yellow word). v1 and the interim s1 are private; every id is in the ledger.

| Short | Idea | Length | Published | Review (3 engines) |
|---|---|---|---|---|
| s1 | 소가 풍경이 되는 데 걸리는 시간 (the roadside cows go unseen in 20 minutes → the purple one stops the car → "어떻게 만드냐") | 47.1 s | https://youtube.com/shorts/tcdgyjamzkI, public 2026-11-18 15:35 | **87.0** |
| s2 | 20년 동안 아무도 안 쓴 식빵 기계 (the 1912 bread slicer → Wonder Bread advertised it → "그 시대가 끝났다") | 24.4 s | queued behind the daily upload limit (ledger) | **81.7 / 82.0** |
| s3 | 말 만들려다 낙타 만드는 회의 (horse → camel by committee → "안전한 게 제일 위험하다") | 27.9 s | https://youtube.com/shorts/0gXP9tcyHik, scheduled 2026-11-19 16:00 (interim render) | **83.0** |

What the panel moved (each fix lives in `shorts.py` or the plan): the hook title must not give the answer away; the CTA card
comes after the last line, alone, never over the drawing; one idea per short (s3 lost its second story); a photo per
blank-canvas line and a punch-in on small canvas text; frame 0 carries a caption; captions are drawn over photos. s1's first
round is not listed: its review script missed the last frame.
