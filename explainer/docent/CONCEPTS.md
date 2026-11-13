# Docent concepts

In short: a concept decides who tells the book, to whom, and in what voice. **Concept 2, the letter (조곤조곤 이야기),
is the default since 2026-11-14.** Concept 1, the lecture, is the general style used until then. Pick one with the
skill input `concept=letter|lecture`. Both use the same drawing kit and delivery, but **not the same pictures**: the
letter has its own visual grammar (below). Reusing the lecture's picture rules for a letter made the first letter video
27 minutes of flashcards (owner, 2026-11-14: "영상 개 좇같이 만들었는데").

## Concept 2 — letter (default)

A narrator who has just finished the book tells one close listener about it, quietly, as if writing a letter at night
and reading it beside them. The owner's source prompt is [concepts/letter.prompt](concepts/letter.prompt) (copied verbatim; the
narrator's name in it is an example the owner does not want used). The owner said its details are examples, not a fixed recipe: "여기 나온건 예시지 맨날 이렇게 해달라고 한건 아님"
(2026-11-14). So this section splits it into what must hold every time and what may change.

**Must hold, every video**
- **Voice: cwon only.** No other voice and no edge-tts fallback. If the cwon server is down, stop the narration and say
  so; script, scenes and draft timeline go on without it.
- One narrator speaks to one listener, in 존댓말 with warmth (~요, ~거든요, ~잖아요). Speak gently (조곤조곤): short
  sentences, no shouting words, no hype.
- It is a reading experience, told in first person: what the narrator noticed, where they changed their mind
  ("나도 처음엔…"), and how it connects to the listener ("~도 이런 적 있잖아요").
- The book's content is in the narrator's own words. Quote at most 1–2 short lines per chapter, named, and each quote
  is followed at once by the narrator's own reading of it. Never invent a quote or a fact. Unsure means paraphrase.
- Emotional arc: a light start, deeper in the middle, reflection late, a warm close. The opening's promise or question
  is paid off in the last chapter.
- Open with the book (title, author, why this author can write it, whether a Korean edition exists). Before the close,
  give one fair criticism and 3–5 things to try.

**Examples from the source prompt — use when they fit, change when the book needs it**
- The listener "오빠"; the hook "오빠가 맨날 이 책 읽으라고 했잖아요" and its payoff "이제 왜 읽으라고
  했는지 알 것 같아요"; "오빠, 안녕" … "다음 편지까지, 잘 있어요 오빠."
- The length formula (size × tone) and the part table. **The owner's requested length always overrides it** (≈ 410
  characters of `text` per minute, as in the skill).
- The 7-step structure, the 애교 level by tone (casual more, serious less), and the flow patterns A/B/C.
- The narrator is **never named** (owner, 2026-11-14: "채원이라는 이름 쓰지마"): "오빠, 안녕. 나예요.".

**Several books on one question** (e.g. "ADHD를 위한 시간관리법" from 2–3 books): the listener's problem is the hook
("요즘 시간이 자꾸 새어 나간다고 했잖아요. 그래서 책 세 권을 읽었어요"). Each book is a voice answering one part of
the question (why → how → what to try). Introduce each book where it first answers, not all at the start.

**Public video rules on top of the source prompt**
- No personal information about the listener (no company, real name, health or money details). General traits only.
- Health, law and money topics: the narrator is a reader of the book, never an expert. No diagnosis, dosage or
  treatment advice. Say once, plainly, that diagnosis and treatment belong to a doctor. Never contradict the medical
  consensus (for example, never call medication useless or dangerous as a rule).

**Voice: emotion directions on every sentence (Drama 3).** The voice server's default model is Fish Audio Drama 3
(2026-11-14), which follows performance directions. In `script.json` each sentence gets `"dir"`: a short English
direction for the whole sentence ("softly, a little shy", "quietly moved", "teasing, playful"), varied along the
emotional arc (no two in a row the same). A third or more of the sentences also get `"tts"`: the same text with inline
tags — `[sighs]`, `[laughs softly]`, `[pause]`, `[breath]`, or a paired `<soft>`, `<emphasis>`, `<slow>`, `<whisper>`
around the one word that matters. The words of `tts` equal `text`; the directions go to the voice only (never into
the subtitles, the timeline or the hearing check). Directions are English, never Korean inside brackets. A sound tag
(a laugh, a breath) goes inside the sentence, never last: a closing laugh runs into the cut and fails it.

**Pictures: the letter's visual grammar** (2026-11-14, after v1 was 27 minutes of flashcards)
1. One place per chapter: the narrator's night desk, 오빠's room, or the real place the chapter needs (a subway, a
   clinic, a bedroom), drawn life-size on the ground line with a window that shows the time of day. It stays for the
   chapter.
2. Two kinds of shots only. Room shots: the narrator and/or 오빠 big (s 1.9–2.4) in the place, acting the line's
   feeling. Letter-page shots: a sheet of letter paper fills the frame and the explanation (a study, a number, the
   book's idea) is sketched inside it — the ideas live on the letter, never float on an empty page.
3. Hold a shot 6–15 s (2–3 sentences) and change one thing per sentence inside it (a gesture, a face, a line on the
   page); about 8 shots per chapter, not 20.
4. Fill the frame; never a small lone figure on a blank page. The emphasis budget (REFERENCE §0) still holds.
5. One look for the whole video: the places are shared helpers (`parts/common.js`) drawn before the scenes; every
   author uses the same desk, room and letter page.
The lecture's "a new picture every 2.5–5 s, draw each sentence's verb" does not apply to the letter.

**How it maps to the kit**
- A part is a scene in `script.json`. A part's text is split into sentences of up to ~120 characters for cwon.
- Cast: the narrator is the running figure (one fixed look, never tagged, e.g. `hair: 'long'`). The listener gets a
  plain look of their own and appears when the narrator addresses him ("오빠도 이런 적 있잖아요" → draw him doing it).
  Authors and people in the books follow REFERENCE §2.
- Health topics: the listener is never drawn as the person who has the condition, nor labelled with a symptom. "ADHD가
  있는 어른은 …" is a plain crowd figure (`figure(…, { crowd: true })`), not the listener: the narrator says "오빠가
  ADHD라는 얘기는 아니에요", and a picture must not say otherwise (Gate C, 2026-11-14: P0).
- Chapter cards: `TITLE_CARD = signCard` with the narrator holding the sign. The settings come from shared helpers
  in the project's common part (a night desk with window, lamp, mug and letter paper; the letter page; 오빠's room) so
  every author draws the same places.
- Music moods lean `warm`, `reflective`, `nostalgic`, with `curious` for the explanations (REFERENCE §7).

## Concept 1 — lecture (general)

The style of the first docent videos (괴델·에셔·바흐, 일론 머스크, 생각을 바꾸는 책 10권, 스토아). A guide explains the
book to a smart adult viewer.
- 해요체, second person, short sentences whose verb can be drawn (SKILL §2).
- Format by book type: the matrix below (numbered lessons, story then lecture, turning points, reading guide,
  Socratic Q&A, lecture with one running example, gallery tour, tour with dialogues).
- Opening: a felt number, the common confusion, the one question, a promise, the running figure. Each chapter: one
  question answered, one named idea, one everyday metaphor, one inner-voice objection answered, a hand-over line.
  Ending: callback, one-sentence chain, one thing to try.
- The running figure is the viewer's stand-in (`viewer`), never tagged.
- Voice: cwon by default.

## Formats by book type (both concepts)

The chapter shape follows the book. In the letter concept the narrator walks through the same shape in her own
voice; in the lecture concept the guide does.

| Type | Audiobook mode | Chapter shape | Visual |
|---|---|---|---|
| Self-help, business | numbered lessons | idea → claim → metaphor → evidence → action | figure, props, keyword |
| History, narrative | story then lecture | scene → context → consequence → now | timeline, map |
| Biography, memoir | turning points | turning point → decision → cost → lesson | cast, timeline |
| Fiction | reading guide (never a retelling) | premise → character → theme → question | storyboard, quotes |
| Philosophy, classics | Socratic Q&A | question → answer → objection → everyday test | figure, one quote |
| Popular science, math | lecture, one running example | question → model → evidence → limits | `mono-black` 3b1b |
| Poetry, essays | gallery tour | piece → close reading → life | minimal, quotes |
| Idea books (GEB) | tour with dialogues | exhibit → 3 fields → callback | sketch + formulas |

Chapters per 10/20/30 min: about 5/9/12 (fiction and science 4/7/10).

## Choosing

- No `concept` given → letter, for every kind of book. A math or science book keeps the letter: its chapters follow
  the lecture-style shape in the matrix above, told by the narrator.
- Lecture only when the owner asks for it ("강의형", "concept=lecture", "예전 스타일").
- Never mix the two in one video. The narrator either writes to someone or lectures to everyone.
