# Docent concepts

In short: a concept decides who tells the book, to whom, and in what voice. **Concept 2, the letter (조곤조곤 이야기),
is the default since 2026-11-14.** Concept 1, the lecture, is the general style used until then. Pick one with the
skill input `concept=letter|lecture`. Both use the same drawing kit, gates and delivery. Only the script and the cast
differ.

## Concept 2 — letter (default)

A narrator who has just finished the book tells one close listener about it, quietly, as if writing a letter at night
and reading it beside them. The owner's source prompt is [concepts/letter.prompt](concepts/letter.prompt) (채원 포맷, copied
verbatim). The owner said its details are examples, not a fixed recipe: "여기 나온건 예시지 맨날 이렇게 해달라고 한건 아님"
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
- The narrator 채원 and the listener "오빠"; the hook "오빠가 맨날 이 책 읽으라고 했잖아요" and its payoff "이제 왜 읽으라고
  했는지 알 것 같아요"; "오빠, 안녕" … "다음 편지까지, 잘 있어요 오빠."
- The length formula (size × tone) and the part table. **The owner's requested length always overrides it** (≈ 410
  characters of `text` per minute, as in the skill).
- The 7-step structure, the 애교 level by tone (casual more, serious less), and the flow patterns A/B/C.
- TTS tone markers (`[warm tone]` …). The kit narrator does not send them: `ko_say` refuses Latin text, and the
  padding already uses `[pause]`. Carry tone in the wording and sentence length; write markers only into a separate
  `script.md` if the owner wants the original format.

**Several books on one question** (e.g. "ADHD를 위한 시간관리법" from 2–3 books): the listener's problem is the hook
("요즘 시간이 자꾸 새어 나간다고 했잖아요. 그래서 책 세 권을 읽었어요"). Each book is a voice answering one part of
the question (why → how → what to try). Introduce each book where it first answers, not all at the start.

**Public video rules on top of the source prompt**
- No personal information about the listener (no company, real name, health or money details). General traits only.
- Health, law and money topics: the narrator is a reader of the book, never an expert. No diagnosis, dosage or
  treatment advice. Say once, plainly, that diagnosis and treatment belong to a doctor. Never contradict the medical
  consensus (for example, never call medication useless or dangerous as a rule).

**How it maps to the kit**
- A part is a scene in `script.json`. A part's text is split into sentences of up to ~120 characters for cwon.
- Cast: the narrator is the running figure (one fixed look, never tagged, e.g. `hair: 'long'`). The listener gets a
  plain look of their own and appears when the narrator addresses him ("오빠도 이런 적 있잖아요" → draw him doing it).
  Authors and people in the books follow REFERENCE §2.
- Chapter cards: `TITLE_CARD = signCard` with the narrator holding the sign. An envelope or letter prop for the
  opening and the close is enough; do not draw a letter in every shot.
- Music moods lean `warm`, `reflective`, `nostalgic`, with `curious` for the explanations (REFERENCE §7).

## Concept 1 — lecture (general)

The style of the first docent videos (괴델·에셔·바흐, 일론 머스크, 생각을 바꾸는 책 10권, 스토아). A guide explains the
book to a smart adult viewer.
- 해요체, second person, short sentences whose verb can be drawn (SKILL §2).
- Format by book type: the matrix in the skill (§1): numbered lessons, story then lecture, turning points, reading
  guide, Socratic Q&A, lecture with one running example, gallery tour, tour with dialogues.
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

- No `concept` given → letter.
- The owner names the lecture style, or the book is a reference work best taught as a lesson (a math or physics
  explainer) → lecture.
- Never mix the two in one video. The narrator either writes to someone or lectures to everyone.
