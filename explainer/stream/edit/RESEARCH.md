# Research — how streamers' YouTube edits are cut (basis for `edit/`)

One line: the owner's spec (10 s highlight → 5 s title + ~5 s signature music → the stream, ≤ 15 min) matches what the
sources below recommend; each rule in `README.md` §2 comes from one of these findings, and episode 1's edit was measured
against them.

- **Findings** — six, each with its sources (§1)
- **What the edit does with each** — where in `cut.py` / the plan (§2)
- **Measured in episode 1's uploaded edit** — from the file itself, not the plan (§3)

## 1. Findings

1. **The first seconds decide retention.** The steepest drop on most retention graphs is in the first 30 s; skip channel
   intros and greetings, show the best moment first. A highlight teaser under 10 s, cut tight, is the format for stream
   content. ([air.io](https://air.io/en/youtube-hacks/advanced-retention-editing-cutting-patterns-that-keep-viewers-past-minute-8),
   [lenspov](https://lenspov.com/articles/audience-retention-strategies), [youseo](https://youseo.app/blogs/how-to-stop-viewers-clicking-away-in-the-first-30-seconds),
   [HitPaw: VTuber 切り抜き](https://edimakor.hitpaw.jp/ai-video-tools/how-to-make-vtuber-clipping-videos.html) — "put the biggest moment in the first 10 seconds")
2. **A cold open is a teaser before the title.** TV jumps into the story before the title sequence to hold the audience;
   in sketch and sitcom formats it is a self-contained beat that ends on a hook.
   ([Wikipedia: Cold open](https://en.wikipedia.org/wiki/Cold_open), [TV Tropes: The Teaser](https://tvtropes.org/pmwiki/pmwiki.php/Main/TheTeaser))
3. **A sonic logo is 2–5 s and the same every time.** Repetition makes it recognisable; a video intro sting is 5–10 s at most.
   ([MassiveMusic](https://massivemusic.com/services/sonic-branding-design), [Music Radio Creative](https://producer.musicradiocreative.com/sonic-branding-explained-2/),
   [StudioZK](https://studiozk.nl/sonic-branding), [Lovart](https://www.lovart.ai/blog/ai-audio-branding-sonic-identity-guide-2026))
4. **Jump cuts remove dead air; keep context.** Cut pauses, fillers, repeats; never cut mid-word; keep a little context
   around each scene; what you remove matters more than what you keep. Re-hook every 60–90 s; chapters help.
   ([air.io](https://air.io/en/youtube-hacks/advanced-retention-editing-cutting-patterns-that-keep-viewers-past-minute-8),
   [pixflow](https://pixflow.net/blog/youtube-video-retention-editing/), [Zuppin note](https://note.com/zuppin/n/n9ed56f2b3f39),
   [kirari.io](https://www.kirari.io/blog/vtuber-clip-guide), [ClipSpray](https://clipspray.ai/) — 다시보기 → 16:9 컷편집본, 늘어지는 구간 점프컷)
5. **Captions and effects, sparingly.** Emphasis captions on the funny or key lines, a sound with an explanatory caption,
   a whoosh on a screen change, a "pop/ding" on a caption — but leave some beats bare so the jokes land; captions go in
   after the cut is final.
   ([みどりざか note](https://note.com/fuji_midoryzaka/n/n5a3716fb7347), [kosmos13: 컷 편집 순서](https://naw.kosmos13.com/%EC%98%81%EC%83%81-%ED%9D%90%EB%A6%84-%EC%82%B4%EB%A6%AC%EB%8A%94-%EC%BB%B7-%ED%8E%B8%EC%A7%91-%EC%88%9C%EC%84%9C-%EC%B4%88%EB%B3%B4%EB%8F%84-%ED%94%84%EB%A1%9C%EC%B2%98%EB%9F%BC-%ED%8E%B8%EC%A7%91/),
   [digitaldiy](https://digitaldiy.jp/article/creator/10309/), [HitPaw](https://edimakor.hitpaw.jp/ai-video-tools/how-to-make-vtuber-clipping-videos.html))
6. **Change the picture often in dense explanation.** B-roll, graphics or a closer frame every few seconds where attention
   dips; slower educational parts suit cutaways more than raw jump cuts.
   ([pixflow](https://pixflow.net/blog/youtube-video-retention-editing/), [lenspov](https://lenspov.com/articles/audience-retention-strategies))

## 2. What the edit does with each

| Finding | In the edit |
|---|---|
| 1, 2 | `COLD_OPEN` (3–4 shots, a freeze on the contradiction, record scratch) before anything else; `COLD_LEN = 10.0` |
| 3 | `sound.py jingle()` — one fixed 5.0 s tune per channel (F major, music box lead), under the 5.0 s title card |
| 4 | kept lines stay whole (+0.06 / +0.14 s air), gaps cut unless a donation / walk-off / the extra is in them; `DROP` removes greetings, sound check, second examples, the recap; chapters from `CHAPTERS` |
| 5 | `EMPH` (about 20 in 13 min, no caption that only repeats the line), one effect per beat (no whoosh on a zoom that already has a caption), `CHAT` bubbles for lines that answer chat |
| 6 | `ZOOM` canvas boxes on the diagram being explained, `INSERTS` (the book's symbol photo full screen + callbacks), drawing sped up 2–8× |

## 3. Measured in episode 1's uploaded edit

`final_edit.mp4` (sha256 `1a21f13d…`, the file uploaded as https://youtu.be/d4hvdDCq6_0; YouTube reports `lengthSeconds` 804):

- Length 803.9 s (13:24), from a 29:43 stream (YouTube `lengthSeconds` 1783).
- Picture cuts (frame difference): cold-open shots at 1.867 / 3.767 / 7.033 s, title in at 9.967 s, title out at 14.967 s → cold open 9.97 s, title 5.00 s.
- The jingle, found in the edit's audio by cross-correlation with `jingle.wav`: starts at 9.967 s, 5.0 s long (ends 14.967 s).
- Independent review (`review_edit.py`, gpt-6-astra / grok-4.7 / gemini-3.8-flash-high): 84.0 and 81.7 on this render.
