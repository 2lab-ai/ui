# Research — how streamers' YouTube edits are cut (basis for `edit/`)

One line: the owner's spec (10 s highlight → 5 s title + ~5 s signature music → the stream, ≤ 15 min) matches what the
sources below recommend; each rule in `README.md` §2 comes from one of these findings, and episode 1's edit was measured
against them.

- **Findings** — six, each with its sources (§1)
- **What the edit does with each** — where in `cut.py` / the plan (§2)
- **Measured in episode 1's uploaded edit** — from the file itself, not the plan (§3)
- **Three reference edits the owner picked (2026-11-18)** — how each one edits and emphasises, the workflow taken from it,
  and what changed in the kit (§4)

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

## 4. Three reference edits (owner's picks, 2026-11-18) — how they edit and emphasise

One line: a streamer's gag edit gives the edit its voice (captions styled by tone, labels for her state and for each part,
the editor's own handwritten asides, a cut to the live chat when it erupts), a calm book channel gives it the real thing
behind every example and a quiet card for the one line to keep, and a live-stream channel gives the stream itself a better
method: prepared pages pasted into Paint, with drawing and typing kept for emphasis.

The owner asked for the editing and emphasis only, not the content. Each video was measured from the file (1 frame per
second contact sheets read by eye, ffmpeg frame difference and `silencedetect`), not from memory.

| Ref | Video | What it is | What we take |
|---|---|---|---|
| A | [우정잉 — 이 악물고 치킨 사수하는 극한의 웃음 참기 3탄](https://www.youtube.com/watch?v=jvQ_u_ChS_8) (9:02) | a Twitch streamer's YouTube edit of a laughing-challenge stream, gag concept | the edit's grammar of emphasis |
| B | [Hawaii's Palace — 서재 15, 대작 ep.01](https://www.youtube.com/watch?v=Sy3VO2PNg1g) (28:17) | a studio book talk, calm and premium, a different concept | real photos for examples, the thesis card |
| C | [슈카월드 — 북극 항로](https://www.youtube.com/watch?v=LFBEEft1uFc) (28:31) | a live stream re-uploaded almost as broadcast | the live-date label; the stream method (prepared pages) |

### 4.1 Reference A — the gag edit (measured)

- **Cold open = a replay of the best bit, 19.7 s.** 0:00–0:19.7 replays the fake-prosecutor-call bit that plays in full
  at 7:12–7:35, under a thin "today · highlight" strip, and ends on two punch-ins on her face (0:14, 0:18) with the caption
  "이것도 참네". Then a hard cut into the stream; this channel has no title card.
- **Every line is captioned, and the caption's look is the voice.** Plain lines in white with a dark outline; loud lines
  bigger and heavier with a thick navy outline; an imagined voice in red quotation marks ("아 우정잉 왜 억지로 웃음?");
  casual or cute lines in a handwriting face; mutters small and grey; laughs written out as ㅋㅋㅋ.
- **The editor speaks in the third person, in yellow-orange handwriting.** "억지사지 공격" (0:42), "1차 위기에 한껏 작아진
  목소리" (1:40), "입꼬리 경련 온 듯" (2:12), "3번의 고비 끝에 무사 통과" (2:56), "다시 자기최면중" (4:16), "독려댓글까지 남기는
  친절함" (7:44), "이 악물고 치킨 지켜낸 도간련" (8:32) — about one a minute, never a copy of what she says.
- **State labels sit over her head while the state lasts.** Yellow bracketed words held for 2–8 s: (움찔) 1:36–1:38,
  (귀여워..) 3:12, (입꼬리단속) 4:38–4:40, (위기) 4:42–4:46, (슬픈생각) 6:44–6:52.
- **Corner labels open each part.** Big orange-gradient text: "또다시 돌아온 웃음 참기 컨텐츠" (0:50), "도전장 접수" (1:02),
  "웃참 시작" (1:16), "공포영화 클리셰" (3:02), "인형뽑기" (3:34).
- **Punch-ins, without a whoosh.** On her face at each reaction (0:14, 0:18, 1:36, 1:48, 2:12, 7:06, 7:34); into the text
  she is reading, following it down the page (1:22–1:34); into the punchline line of a screenshot (7:02–7:06); into the clip
  she reacts to (3:26–3:28).
- **When the chat erupts, the picture cuts to the chat.** At 5:50 and 8:30 the frame punches into the live chat ("개 웃긴데
  ㅋㅋㅋ") and her line appears as a chat box ("아 자존심 상하게 터졌어").
- **A result card closes the bit.** 8:34–8:38: "총 78건의 게시글 중 / 김우정 잉치킨 최종 스택: 2치킨".
- **The end is a playful clip, not a still card.** 8:40–9:02 (22 s): she peeks out from behind her chair, with
  "구독 좋아요 알림설정 부탁드립니다" in handwriting.
- **Long reads stay bare.** 1:52–2:54 she reads a long post: no captions, only a slow scroll down the zoomed post.
- Rhythm: 38 pauses of 0.5 s or more (4.2 a minute, 7.5 % of the runtime) — the editor leaves air before a reaction.

### 4.2 Reference B — the calm book talk (measured)

- **The thesis opens the video as text on an empty set.** 0:00–0:24, one serif sentence every ~3 s on the dark, empty
  studio ("이 이야기는 … 당신을 위한 게 아니다."), then the host dissolves in (0:24–0:30).
- **One caption style for everything:** small white text on a dark band at the bottom. No stickers, no jokes on screen.
- **Every example or analogy becomes real footage.** An alley and a man walking alone for "10명 중 9명의 말은 치워버리세요",
  a doorway of light for "여러분은 10명 중 1명", a nebula for "패러다임", rain on glass, a thermometer and a cockpit for the
  thermostat analogy. Between 3:00 and 15:00, 36 of 60 frames sampled every 12 s are B-roll (60 %); 89 scene changes over
  the video (one every 19 s), joined by dissolves.
- **A plain close:** a black screen, "감사합니다. 지금까지 하와이 대저택이었습니다."

### 4.3 Reference C — the live stream re-upload (measured)

- **The edit is light.** An 8 s logo sting (0:00–0:08), then a yellow label "2026. 9. 6(일) 생방송 내용입니다." for ~5 s; the
  stream runs almost as broadcast — 295 pauses of 0.5 s or more (10.3 a minute, 14.6 % of the runtime), so nearly no
  jump-cutting. Its lesson for the edit is the label; its real lesson is the stream method below.
- **The stream method: prepared pages, live marks.** Each point is a page made before the stream and pasted onto a white
  canvas: a red headline at the top that states the claim, one picture on the left (a map, a photo of the person, a logo,
  a flag, a chart, a news thumbnail), an English source line and two to four Korean lines on the right with the key phrase
  in red or bold. While talking he only marks it: an underline, a circle round a number on a chart, an arrow, an X, a one-
  to three-word handwritten label under the picture ("장난?", "안 써!", "???"). Then the page is deleted (a blank canvas,
  once even the delete dialog) and the next is pasted — a new page every 20–40 s.

### 4.4 The workflow taken from them

1. **Cut first** (unchanged): keep whole lines, drop dead air, timelapse the drawing, ≤ 15 min.
2. **Cold open** (A): the funniest bit, framed so nothing else on screen distracts — only the joke and her face.
3. **Corner labels** (A): one at the first kept line of each part, in the editor's words.
4. **Caption voice** (A): pick the tone of each line — plain, shout, mutter — and colour one key phrase where the book's
   term is said.
5. **State labels** (A): over her head for a reaction that lasts a few lines; they follow the punch-ins and hide when
   she is out of frame.
6. **The editor's asides** (A): a handwritten third-person remark about once a minute, only where it adds a fact the
   viewer cannot hear ("정확히 2분 지킴").
7. **Chat** (A): where the live chat erupts, punch into the real chat and show her line as a chat box; elsewhere keep the
   chat bubble for the message a line answers.
8. **Follow the drawing** (A): when a diagram is built line by line, punch into each new piece as it is said, panning
   from one piece to the next.
9. **The real thing** (B): a licensed photo for each concrete example (a dissolve, 2–3 s, a small "📷" label so viewers
   know it is a real photo), or a tilted photo card beside a drawing when the joke is the comparison.
10. **The line to keep** (B): the book's core line on a dark card in a serif, no sound effect; its caption is the card.
11. **Result card** (A): a two-line tally before the goodbye.
12. **End card over a bonus clip** (A): a playful moment from the stream, muted under the music, with the handwritten ask.
13. **Live-date label** (C): "<date> 생방송 내용입니다" as the stream part starts.
14. **Sound** (A): punch-ins cut straight, without a whoosh; sounds go to the corner labels, the asides and the cold open.

Not taken, on purpose: A's laughs written as ㅋㅋㅋ (our voice is a calm reader), B's caption band and B-roll for every
sentence (it would bury the Paint drawing the stream is built on), C's untouched dead air. The streamer's lore stays
unmarked (no label, aside or photo on those lines), as before.

### 4.5 Measured in episode 1's v2 edit (the demo of §4.4)

`final_edit.mp4` (sha256 `4de99144…`, uploaded unlisted as https://youtu.be/v0kjtcPzBlI; YouTube `lengthSeconds` 704):

- Length 703.3 s (11:43) from the same 29:43 stream; v1 was 803.9 s. 159 of 270 lines kept, 134 main-part cuts,
  19 s of sped-up drawing (×2–×16), -16.0 LUFS.
- Marks: 9 corner labels, 5 state labels, 6 photos (B-roll and cards) plus the purple-cow insert and its callbacks,
  2 chat punch-ins, caption tones (4 shout, 5 mutter, 2 chat), editor asides, 2 thesis cards, a result card, the end card
  over a bonus clip, the live-date label; 41 sound effects (v1: 45), no whoosh on punch-ins.
- Cold open 10.0 s: the note typed at 2x → her face → "네 개였어요." (cut before "하나는 꼬리예요") → her five-legged cow,
  counted → scratch → the title at 10.0 s.
- Independent review, nine rounds, the mean of each run: 79.0 → 78.3 → 78.3 / 79.0 → 79.3 / 79.7 → 79.3 / 79.0 →
  78.7 / 80.0 → 80.7 / 79.0 → 77.3 / 78.7 → **80.3 / 80.3** (this render). GPT and Grok scored 82–86 every round;
  gemini-3.8-flash-high 67–72. The same panel re-scored v1 the same day at 86.7 / 80.3 (gemini 92, then 71).
- What that means: the rubric is the 2026-11-17 spec (cold open, title, tempo, effects, clarity, the symbol, finish); it
  does not score the reference grammar, so it rates v2 level with v1 rather than above it. The panel's recurring asks
  across rounds were: stop the cold open earlier, fewer long explanation shots (12–18 s), less white canvas on screen in
  the explanation parts. The last two are the stream's job (prepared pages, §4.3), not the edit's.
