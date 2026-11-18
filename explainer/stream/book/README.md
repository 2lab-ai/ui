# The streaming book (스트리밍 북) — the whole book, alone, dense

In short: the fourth video of every book, made a day after the edit. The streamer records alone, with no audience, and walks through the whole book over prepared Paint pages, marking them by hand as she talks. The live stream carries about 30% of the book lightly; this one aims at 80%, for a reader who wants the knowledge and wants to think. Why it looks like this: `RESEARCH.md` (the owner's brief and a measured 슈카월드 main video).

- How it differs from the live stream: below, §1
- What to make, in order: §2
- Files: §3
- Example: book-night episode 1, `themes/content/book-night/episodes/01-purple-cow/book/`

## 1. Live vs book

| | live (`make-streaming-video`) | streaming book |
|---|---|---|
| audience | chat, donations, viewer count | none (`--streaming studio`: the build refuses chat, donation and BRB) |
| book carried | ~30%, light | **80%, dense**: every part and every case in the book |
| right column | chat box | contents panel: the book's parts, the current one lit (`TOC`, `B.chapter(i)`) |
| canvas | typed and drawn live, some prepared pages | **prepared pages** (7 kinds), only marks live (`engine/marks.py`) |
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
7. **Voice, build, render, mix** — as the live (`make-streaming-video` §4-5) with `--streaming studio --streamer kate --content book-night`. Build once with fake audio first (syllables ÷ 4 + 0.35 s) to check the length and the page stills.
8. **QA**: a still of every page with its marks; no text off a page; the contents panel lit on the right part; -16 LUFS. Review: `build/ssot.txt` (the owner's words) + `build/review_note.txt` (what THIS render does, plus the book's section list so the panel can judge coverage), then `python engine/review.py build book/lines.json b1` twice; mean over 80.
9. **Upload** (the YouTube Studio scripts the edit and the Shorts use, the episode's `upload/` scripts): private, then scheduled 18:00 KST the day after the edit; title `[책듣는밤 N화] <책> 한 권 다 읽어드림 (스트리밍 북) | <저자>`; description = the parts as chapters (00:00 …), the live, edit and Shorts links, credits per photo and article; captions ko (+ en); thumbnail = the book's symbol + streamer + "스트리밍 북" badge + length.
10. **Ledger**: the episode's `book` entry in `episodes.json` {url, publish, length, title, coverage, pages, review, lore_used}.

## 3. Files

```
book/
├── README.md        this file
├── RESEARCH.md      the owner's brief, the reference measured, what the kit does with it
└── coverage.py      the 80% check (sections of the book → lines and pages)
engine/
├── pages.mjs        page kinds: photo, article, quote, list, versus, big, blank
└── marks.py         Marker: hand marks on a page (underline, circle, box, arrow, cross, strike, tick, bracket, note, curve)
themes/streaming/studio/   no audience: contents panel, solo rubric lines, review goal
themes/content/book-night/episodes/NN-<slug>/book/   lines.json, beats.py, coverage.json, research_*.md, pages/, props/
```
