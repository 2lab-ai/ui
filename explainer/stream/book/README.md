# The streaming book (스트리밍 북) — the whole book, alone, dense

In short: the fourth video of every book, made a day after the edit. The streamer records alone, with no audience, and walks through the whole book over prepared Paint pages, marking them by hand as she talks. The live stream carries about 30% of the book lightly; this one aims at 80%, for a reader who wants the knowledge and wants to think. Why it looks like this: `RESEARCH.md` (the owner's brief and a measured 슈카월드 main video).

- Principles (why each choice; the owner's notes are examples of them): §0
- How it differs from the live stream: §1
- What to make, in order: §2
- Files: §3
- Example: book-night episode 1, `themes/content/book-night/episodes/01-purple-cow/book/`

## 0. Principles

Generalised from the owner's notes on v1 (2026-11-19). Each note is one example of a principle, not the whole rule.

1. **Its own identity, chosen by research.** The book shares nothing visible with the live: room, tunes, title and end cards, cover style. Research the cover each time (the genre's leaders, this book's competitors) and pick what is unlike both the live and the competition. Ep. 1: live = warm home room, funk jingle, photo + big avatar thumbnail; book = night office over a real city loop, celesta/Rhodes tunes (`edit/jingles.py` `book_night_open` / `book_night_close`), a single Paint page in a yellow frame for the cover (`book/cover_paint_page.py`).
2. **Only what the app on screen could make, changed by her hand.** A Paint page uses Paint's means only: a font, a size, a colour, bold, a text background, rectangles, pasted square pictures. No badges, rounded corners or shadows. Information in another app is that app's real formatting, edited with her cursor on screen. Ep. 1: numbered red circles became "1." in bold; the contents became a WordPad document she edits (select the finished part → strikethrough; select the next → bold, red, highlight).
3. **Nothing by hand repeats.** Every circle, underline, box and arrow draws its own geometry (start, size, tilt, wobble, overshoot, ending) and follows the glyphs: a wrapped phrase gets one underline per line (`engine/marks.py` uses each phrase's client rects).
4. **Released like an edit.** ~10 s cold open from its own best moments (cut before the answer), a 5 s title card on its own tune, the recording, an end card on its own closing tune (`book/assemble.py`, `ASSEMBLY` in the beats). Chapters and captions shift by the cold open + title (`offset.txt`).
5. **Real moving things.** A real clip (≤ 4 s, licence-clean: Pexels, Pixabay, Mixkit, Commons non-SA) as a full-screen hard cutaway where a real thing is named (`say(..., broll=(clip, secs, at))`, `engine/video_frames.py`); the room is a live-looking loop.
6. **End on a prepared, sourced reveal.** A "one more thing" that recasts the book, researched like news (primary sources, myths flagged, scope stated). Ep. 1: Milka's purple cow (1971, a train window) vs Godin's car window ~30 years later; the 1% study behind the "kids think cows are purple" myth.
7. **Look before rendering it all.** A test slice and stills of every new element first. Check each review-panel claim against a still before acting on it (ep. 1 v2: the panel said the WordPad parts were never struck; the end still showed parts 1-8 struck).

## 1. Live vs book

| | live (`make-streaming-video`) | streaming book |
|---|---|---|
| audience | chat, donations, viewer count | none (`--streaming studio`: the build refuses chat, donation and BRB) |
| book carried | ~30%, light | **80%, dense**: every part and every case in the book |
| right column | chat box | a WordPad document of the book's parts she edits by hand (`TOC`, `B.chapter(i)`), a progress bar along the bottom with part ticks |
| room | warm home room | its own room: ep. 1 a night office over a real city loop (`room_loop`) |
| release | the live VOD | like an edit: cold open, title card, recording, end card, its own tunes |
| canvas | typed and drawn live, some prepared pages | **prepared pages** (7 kinds, Paint means only), only marks live (`engine/marks.py`), real ≤ 4 s clips as cutaways |
| extras | step-away, the sister, typed questions | none; one or two hand drawings where the idea is a shape (a bell curve) |
| voice | chat-facing, chatty | calm, close, explaining (조곤조곤) — 20-30% jokes, exaggerations and asides |
| examples | the book's | the book's **plus** everyday life and recent news (article pages with outlet and date) |
| length | by the book: 30 min / 1 h / 2 h | the same |
| upload | 18:00 on the day it is ready | **18:00 the day after the edit** (the live + 2 days) |

## 2. Make one

1. **Research the whole book** → `book/research_book.md`: the table of contents of the edition used, every section's claim, every case with its numbers, the end-of-book lists, common misreadings. Sources for each fact.
2. **Research the examples** → `book/research_news.md`: everyday-life and recent news cases (Korea first) for each idea, each with outlet, date and URL.
3. **Coverage map** → `book/coverage.json`: every section of the book in order (`part`, `section`), then fill in the lines and pages that carry it. `python book/coverage.py <ep>/book` must pass (≥ 80% of sections, no unknown ids).
4. **Script** → `book/lines.json` (+ the episode's `make_lines.py` if you generate it). Shape:
   - 30-60 s open: what the book is, why it matters now, what you will be able to say after (the parts on screen).
   - Parts in the book's own order, each opening with one plain line of what it claims. Per section: the book's claim → the book's example → one everyday or news example → why it matters → one aside. The book's quotes in the book's words (`quote` pages).
   - A 20-30 s recap after each part; at the end the whole book in one minute, the 3-5 questions to think about, and why to read it (and which chapters to read first).
   - `"j": 1` on joke / exaggeration / aside lines: 20-30%. Examples outside the book are said as outside ("책에는 없는 얘긴데", "요즘 뉴스로 치면").
   - Numbers in `say` (2003년 → "이천삼 년"). No line starts with 아/어. No names of the streamer. The lore stays implied (one hint about every 10 minutes, new ones only: the content theme's ledger).
5. **Pages** → `book/pages/pages.json` → `node engine/pages.mjs book/pages/pages.json book/pages/out`. One claim a page, one every 30-40 s (30 min ≈ 45-55 pages). Real photos (PD / CC0 / CC BY, credits in `book/props/CREDITS.md` and the `foot` line), real article excerpts (outlet, date, headline as published). Reuse a picture across pages with a new headline and a new mark, like the reference reuses its chart.
6. **Beats** → `book/beats.py`: `TOC`, `STREAM_TITLE` (`📖 책듣는밤 N화 · <책> — 스트리밍 북`), `script(B, rng)`: per page `B.clear_canvas()` → `B.paste_image(page, 0, 0, 1100, 700)` → lines with marks on their words (`Marker`: `underline`, `circle`, `arrow`, `cross`, `note`, `curve(bell(...))`), `B.chapter(i)` when a part starts. Gaze `cam` while explaining, `screen` while marking. `REVIEW` keys on a few pages.
7. **Voice, build, render, mix** — as the live (`make-streaming-video` §4-5) with `--streaming studio --streamer kate --content book-night`. Build once with fake audio first (syllables ÷ 4 + 0.35 s) to check the length and the page stills. After TTS, read heard vs said and reword what the voice blurs. Then `python book/assemble.py build <ep>/book <out>` → `upload.mp4`, `offset.txt`.
8. **QA**: a still of every page with its marks; no text off a page; the contents panel lit on the right part; -16 LUFS. Review: `build/ssot.txt` (the owner's words) + `build/review_note.txt` (what THIS render does, plus the book's section list so the panel can judge coverage), then `python engine/review.py build book/lines.json b1` twice; mean over 80.
9. **Upload** (the YouTube Studio scripts the edit and the Shorts use, the episode's `upload/` scripts): private, then scheduled 18:00 KST the day after the edit; title `[책듣는밤 N화] <책> 한 권 다 읽어드림 (스트리밍 북) | <저자>`; description = the parts as chapters (00:00 …), the live, edit and Shorts links, credits per photo and article; captions ko (+ en), shifted by `offset.txt`; the cover chosen by research (§0.1). Replacing an upload: schedule the new one first, then set the old one private (never delete).
10. **Ledger**: the episode's `book` entry in `episodes.json` {url, publish, length, title, coverage, pages, review, lore_used}.

## 3. Files

```
book/
├── README.md        this file
├── RESEARCH.md      the owner's brief, the reference measured, what the kit does with it
├── coverage.py      the 80% check (sections of the book → lines and pages)
├── assemble.py      cold open + title card + recording + end card → upload.mp4, offset.txt
├── cards_book.py    the book's title and end cards (not the edit's)
└── cover_paint_page.py   the cover: one Paint page in a frame (ep. 1)
engine/
├── pages.mjs        page kinds: photo, article, quote, list, versus, big, blank
├── marks.py         Marker: hand marks on a page, each one different, per wrapped line
└── video_frames.py  real clips → frame sequences (room loop, b-roll)
edit/jingles.py      book_night_open / book_night_close: the book's own tunes
themes/streaming/studio/   no audience: WordPad contents, progress bar, night office room, solo rubric lines, review goal
themes/content/book-night/episodes/NN-<slug>/book/   lines.json, beats.py, coverage.json, research_*.md, pages/, props/
```
