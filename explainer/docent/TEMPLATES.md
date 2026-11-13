# Docent shot templates

Copy-and-adapt recipes for the beats every book video needs. Each one passes the gates in
[REFERENCE.md](REFERENCE.md) §8 as written (they are linted in `docent-lab`). `lt` = seconds since the shot started.
When a template produces a defect, fix the template here in the same PR as the scene fix, and log it in LESSONS.md.
Timing rule for every recipe: everything in a shot finishes drawing by 60 % of the shot's length (a 2 s shot: by
1.2 s), or the lint reports it half-drawn at rest.
Every recipe stays inside the emphasis budget (REFERENCE §0): one subject plus at most two things around it, at most
one written word, at most one red mark, ink only. When a sentence seems to need more, it needs two shots.

Map: S script.json · T1 cast block · T2 dialogue · T3 three people · T4 inner voice · T5 named idea · T6 picture
equation · T7 animal · T8 timeline · T9 wrong vs right · T10 list · T11 crowd · T12 a poem on the wall · T13 a chart
with a break · A adding an asset · C one-scene clip · Cover the YouTube thumbnail

## S. script.json fields that drive pictures and music
```json
{"id": "rocket", "chip": "4 · 로켓", "title": "세 번의 폭발", "subtitle": "4장", "mood": "tension", "idea": "세 번째 기회",
 "sentences": [
   {"text": "첫 발사는 33초 만에 끝났어요."},
   {"text": "그리고 네 번째, 마침내 궤도에 올랐습니다.", "music": "triumph"}]}
```
`mood` = the chapter's music family (REFERENCE §7); `music` on a sentence = change cue exactly there.
`idea` = the chapter's one named idea: the only phrase that gets written in purple in that chapter (REFERENCE §0).
Cue keys use the spoken form: a sentence "1911년엔…" is `q.w('천구백십일', k)`, not `q.w('1911', k)`.
`q.w` matches the start of a word (`q.w('모두')` also hits "모두의" earlier in the sentence); use `q.wx` for the exact
word when the same stem appears twice
(`timeline_draft.py` already writes the spoken form, so a wrong key shows up as a missing cue before the voice).
Put the names the voice must say in `project.json` `"names": ["이스마엘", "퀴퀘그"]`: audio_check hints whisper with them.

## T1. Cast block (top of scenes.js, once per book)
```js
TITLE_CARD = signCard;
cast('musk',  { name: '머스크', hair: 'short', tie: true, h: 1.08 });          // silhouettes: height, hair/hat, one prop
cast('mom',   { name: '메이', hair: 'bun', h: 0.95 });
cast('eng',   { name: '엔지니어', hair: 'curly', glasses: 'round' });
cast('viewer',{ name: '나', hair: 'side' });   // the running figure: never tagged
```
No `accent` and no `outfit` (ink mode paints them as ink anyway): people differ by silhouette, as in the reference.
Then `python tools/gallery.py cast` and look at the sheet before writing any scene.

## T2. Dialogue (two people facing each other)
One bubble per shot: the answer is the next shot. A bubble's words are the shot's one written word, so a name tag goes
in a shot without a bubble (the first time the narration names the person).
```js
[q.s(3), (t, lt) => {
  const a = person('musk', 620, 870, { pose: 'point', face: 'happy', p: dp(lt, 0, 0.8) });
  person('eng', 1300, 870, { pose: 'shrug', face: 'worried', flip: true, p: dp(lt, 0.15, 0.8) });
  say(a, '다시 쓰자!', { p: dp(lt, 0.9, 0.4) });
}],
[q.s(3) + 1.6, (t, lt) => {
  person('musk', 620, 870, { pose: 'point', face: 'happy' });
  const b = person('eng', 1300, 870, { pose: 'shrug', face: 'worried', flip: true });
  say(b, '불가능해요', { p: dp(lt, 0.2, 0.4) });
}],
```

## T3. A group (argument, meeting)
Draw the group's verb, not every member: two people and one bubble say "the engineers refused". Three named people in
one shot is 4 things with a bubble (lint `busy`): show the one who acts and let the narration carry the rest.
```js
const a = person('eng', 760, 860, { pose: 'shrug', face: 'worried', p: dp(lt, 0, 0.8) });
person('cfo', 1180, 860, { pose: 'facepalm', face: 'sad', flip: true, p: dp(lt, 0.2, 0.8) });
say(a, '불가능해요', { p: dp(lt, 0.9, 0.4) });   // one bubble speaks for the group
```

## T4. Inner voice (the viewer's objection)
```js
[q.w('에이', 5), (t, lt) => {
  const v = person('viewer', 760, 880, { pose: 'think', face: 'think', p: dp(lt, 0, 0.6) });
  think(v, '그건 말장난이잖아', { p: dp(lt, 0.4, 0.4) });
}],
```

## T5. Named idea (board)
```js
[q.w('형식 체계', 2), (t, lt) => teach('형식 체계', { p: dp(lt, 0, 1.2) })],
```

## T6. Picture equation
```js
[q.s(6), (t, lt) => {
  prop('gear', 480, 720, 2.0, { p: dp(lt, 0, 0.6) }); plusSign(780, 560, { s: 1.5, p: dp(lt, 0.5, 0.3) });
  prop('loop', 1080, 720, 2.0, { p: dp(lt, 0.7, 0.6) }); eqSign(1380, 560, { s: 1.5, p: dp(lt, 1.2, 0.3) });
  hand('나', 1620, 560, { size: 170, p: dp(lt, 1.4, 0.5) });   // props at s 2: the equation fills the frame
}],
```

## T7. Animal
```js
[q.w('개미핥기', 4), (t, lt) => {
  const z = animal('anteater', 820, 820, { s: 1.3, p: dp(lt, 0, 1.0), tag: '개미핥기' });
  for (let i = 0; i < 5; i++) ant(1380 + i * 90, 820, { t, dir: -1 });
  say(z, '개미 군락은 대화 상대야', { p: dp(lt, 0.8, 0.3) });   // animals talk like people
}],
```

## T8. Timeline (biography, history)
Moments are pictures on the line, each drawn on the word that says it; the years are spoken, not written. Write one
year only when the whole chapter hinges on it (then it is the shot's one word).
```js
[q.s(0), (t, lt) => {
  inkArrow(160, 640, 1760, 640, { p: dp(lt, 0, 0.6) });
  [['house', '천구백칠십일'], ['garage', '천구백구십오'], ['rocket', '이천이']].forEach(([name, cue], i) => {
    const x = 420 + i * 540, p = dp(t, q.w(cue, 0), 0.4);
    inkDot(x, 640, 10, { p }); prop(name, x, 560, 0.9, { p });
  });
}],
```

## T9. Wrong idea vs right idea
One verdict: the X on the wrong one; the right one stands plain beside it (an X and a ring together is two verdicts).
```js
[q.s(4), (t, lt) => {
  prop('ladder', 560, 760, 1.6, { p: dp(lt, 0, 0.6) }); crossAt(560, 580, 300, 380, { p: dp(lt, 0.8, 0.5) });
  prop('loop', 1320, 760, 1.6, { p: dp(t, q.w('고리', 4), 0.6) });
}],
```

## T10. List
```js
[q.s(2), (t, lt) => scrollList(660, 150, 600, '네 가지 규칙', ['하나', '둘', '셋', '넷'], { p: dp(lt, 0, 1.4) })],   // mark: [k] only when that item is the verdict
```

## T11. Crowd (people who are not characters)
```js
for (let i = 0; i < 6; i++) figure(300 + i * 230, 860, { s: 0.7, crowd: true, face: 'neutral', p: dp(lt, i * 0.08, 0.6) });
```

## T12. A poem on the wall (poetry, essays: the docent's gallery tour)
```js
[q.s(0), (t, lt) => {
  prop('frame', 960, 640, 2.2, { p: dp(lt, 0, 0.6), inside: (x, y, w, h, p) => {
    prop('moon', x + w * 0.7, y + h * 0.45, 0.8, { p }); prop('star', x + w * 0.3, y + h * 0.4, 0.5, { p }); } });
  hand('서시', 960, 760, { size: 60, color: INK(), p: dp(lt, 0.7, 0.4) });
}],
[q.w('부끄럼', 1), (t, lt) => {
  quote(960, 440, 1300, '한 점 부끄럼이 없기를', { who: '윤동주', size: 96, p: dp(lt, 0, 0.9) });
  ring(1235, 440, 165, 80, { p: dp(lt, 1.0, 0.4) });   // the word the narration dwells on
}],
```
One short line, named; the frame's `inside(x, y, w, h, p)` draws the picture in the mat.

## T13. A chart with a break (idea and science books: the turkey, a crash, an exponential)
```js
[q.s(1), (t, lt) => {
  inkArrow(260, 820, 260, 220, { p: dp(lt, 0, 0.4) }); inkArrow(260, 820, 1660, 820, { p: dp(lt, 0, 0.4) });
  const pts = []; for (let i = 0; i <= 40; i++) pts.push([280 + i * 32, 800 - Math.pow(i / 40, 1.4) * 480]);
  inkPath(pts, { p: dp(lt, 0.4, 1.4), w: 6 });                                                    // the line in ink
  inkPath([[1560, 320], [1600, 780]], { p: dp(t, q.w('천한', 1), 0.3), w: 7, color: MARK() });   // the break in red
  hand('1,000일', 1560, 868, { size: 52, p: dp(lt, 1.2, 0.4) });                                 // the one number
}],
```
Axes first, then the line that "feels safe", then the break on the word that names it. One number, no axis labels.

## A. Adding an asset (animal, prop, pose, hat) from scenes.js
The kit is read-only during a run; register what is missing at the top of scenes.js, after the cast block. It then
shows on `gallery.py` sheets, `say()` and the lint see it, and the retro moves generic ones into docent.js.
```js
// animal: T(px, py) maps local units (x forward, y up negative, s = 1 ≈ 300 px long) to the screen; o = { s, dir, p,
// a, w, color, fill }; q(k) is the staged draw-on, k = 0..4 (all 1 at p = 1). Scale radii by o.s yourself. Return the
// anchors; add half: <half-length in local units> when the animal is longer than ±270 (a whale).
ANIMALS.goat = (T, o, q) => {
  inkPath([T(-90, -60), T(-60, -120), T(60, -120), T(90, -60), T(60, -40), T(-60, -40)], { ...o, closed: true, round: 2, p: q(1), fill: o.fill || mix(C.grey, 0.5) });
  // … legs q(0), head q(2), horns and beard q(3), eye q(4)
  return { head: T(110, -140), r: 28 * o.s, mouth: T(140, -120), top: T(110, -190) };
};
// prop: (x, y) = bottom centre, s = 1 ≈ 160 px tall; o = { p, a, w, color, fill, t, paperFill }.
// Colour your own parts with `(o.paperFill ? null : o.fill) || myColour`; prop() fills with the page colour by default.
PROPS.anvil = (x, y, s, o) => { inkPath([[x - 80 * s, y - 60 * s], [x + 80 * s, y - 60 * s], [x + 40 * s, y], [x - 40 * s, y]], { ...o, closed: true, fill: (o.paperFill ? null : o.fill) || mix(C.grey, 0.6) }); };
// pose: [elbow, hand] for the left and right arm, relative to the shoulder (y down)
POSES.pray = { la: [[-30, 46], [-6, 10]], ra: [[30, 46], [6, 10]] };
```
Hats: `hat: 'top' | 'cap' | 'beanie' | 'bowler' | 'crown' | 'laurel'`. A new kind of look (a toga, armour) is a helper
drawn after `person()` at its anchors, shown once on a still at Gate A.

## C. A one-scene clip (a 10 to 20 s probe, a trailer, a short)
Keep the chapter shape's first, middle and last beat and drop the rest (biography: turning point → decision → cost;
history: scene → consequence; philosophy: question → answer; fiction: premise → the character's want → the question,
never the ending — no picture that gives the ending away). Two or three sentences, 70 to 80 characters of text;
one mood and no `"music"` change; the scene's `title` is the book's title (it is the title card); 2 to 4 shots.

## T14. An idea inside a head (philosophy, psychology: "the judgment", "the story we tell")
Two shots: the thing outside is crossed out ("it is not the work"), then the thing inside is the answer, the named idea.
```js
[q.s(1), (t, lt) => {
  prop('crate', 1240, 860, 1.6, { p: dp(lt, 0, 0.5) });                                   // the event
  person('marcus', 700, 880, { pose: 'point', face: 'worried', p: dp(lt, 0, 0.5) });
  crossAt(1240, 720, 300, 280, { p: dp(t, q.w('아니에요', 1), 0.4) });
}],
[q.s(2), (t, lt) => {
  const v = person('marcus', 760, 880, { pose: 'think', face: 'think', p: dp(lt, 0, 0.5) });
  think(v, null, { w: 420, h: 260, p: dp(lt, 0.5, 0.4), body: (x, y) => hand('내 판단', x + 210, y + 130, { size: 64 }) });   // the cause
}],
```
`think(who, null, { w, h, body })` draws a picture or the one word in the bubble.

## M. Many authors on one video (parts/ + parts.py)
Long videos are drawn by several authors at once. Each owns `parts/<id>.js`; `parts/common.js` holds the cast block,
registered assets and shared helpers (written and passed through Gate A before any author starts).
```
python $K/tools/parts.py preview e swan influence      # ../<project>-e/: lint on those scenes + Gate C sheets
python $K/tools/parts.py preview e swan --no-sheets     # lint only, while iterating
python $K/tools/parts.py build                          # the project's scenes.js, in script order
```
Authors never share a scenes.js: two authors writing the project's own scenes.js overwrite each other. The brief for
each author = REFERENCE + TEMPLATES + LESSONS + common.js + their scene ids; they finish at `LINT_EXIT=0` with every
sheet opened.

## L. A look helper (armour, a cape, a lab coat) drawn at a person's anchors
```js
function armor(fig, { p = 1, a = 1 } = {}) {          // Elon Musk v2: the '갑옷' running device
  const [hx, hy] = fig.head, k = fig.r / 46;           // head radius is ≈ 46 px at s = 1: scale from it, not from s
  const P = (dx, dy) => [hx + dx * k, hy + fig.r + 14 * k + dy * k];
  inkPath([P(-38, 0), P(38, 0), P(44, 44), P(30, 86), P(0, 98), P(-30, 86), P(-44, 44)], { closed: true, p, a, fill: opaqueMix(C.grey, 0.75) });
}
const m = person('musk', 700, 870, { pose: 'akimbo', p: dp(lt, 0, 0.5) }); armor(m, { p: dp(lt, 0.4, 0.5) });
```
Scale from the anchors, not from a guessed `s` (the first armour, sized for r = 34, covered the arms of a tall figure).
Show it once on a still at Gate A, on a tall adult and on a child.

## T15. Seated figure (chair, armchair, bench)
`figure({ sit: true })` puts the hip at y - 100 s, lays the thighs flat and bends the knees at x + 64 s (feet at
x + 64 to 74 s). A seat as deep as the thighs hides them on its top edge and turns the shins into a third chair leg:
the seat stops at x + 34 s. The kit `chair` at 1.4 s puts its front leg at x + 56 s, so draw this one instead:
```js
const sideChair = (x, y, s, o) => inkPoly([[x - 38 * s, y - 232 * s], [x - 38 * s, y], [x - 38 * s, y - 100 * s],
                                          [x + 34 * s, y - 100 * s], [x + 34 * s, y]], o);   // sitter faces right
sideChair(x, y, s, { p: dp(lt, 0, 0.4) });                          // the chair first, so the thighs lie on top
person('viewer', x, y, { s, sit: true, pose: 'hold', p: dp(lt, 0.1, 0.5) });
```
Facing left: mirror the x offsets. A thing on the lap goes at (x + 70 s, y - 118 s).

## Placement notes
- Draw people in any order, bubbles last: name tags are placed when the shot is complete (`docentTags()`), clear of
  every figure, animal, prop, board and bubble in it. Force a side with `tag: true, tagSide: 'left' | 'right'`.
- Speech goes through `say()`, never a hand-placed `bubble(…, { tail })` next to a person: a tail you aim yourself
  ends at the scalp more often than not (lint `tail-high`). Keep `bubble()` for things that are not a mouth (an
  anthill, a radio) with `tailOk: true`.
- Each shot cuts in 0.3 s before its word (`shots(t, list, { lead })`, default 0.3): put the subject first in the shot
  (`p: dp(lt, 0, 0.5)`), labels and details after. Word-timed parts (`o('word', k, q.s(k))`) move with it.
- Bubbles keep clear of props and boards (they reserve their box), so draw the props of a shot before its bubbles.

## Cover. The YouTube thumbnail (REFERENCE §10)
One frame composed for 168 px, not a still of the video. Draw it at the end of `scenes.js`; `export.py cover` renders
it to `out/cover.jpg` (1280×720) and `out/cover_check.jpg`, and prints a `WARNING cover:` line for each limit it breaks.
```js
COVER = () => {
  coverPage();                                                              // deeper page: stands out from YouTube's white
  person('narrator', 520, 1060, { s: 3.0, pose: 'facepalm', face: 'worried' });   // one subject, ≥ 60 % of the height, cut by the bottom edge
  prop('clock', 980, 330, 1.6, { solid: true });                            // at most one object: the tension, not the answer
  coverText('시간이 샌다', 1400, 520, { size: 250, rot: -0.04 });           // ≤ 8 characters that add to the title
};
// keep x > 1600, y > 950 empty: YouTube draws the running time there
```
Two lines of text are fine (`coverText` twice, 200–240 px each) when the words are short. Then:
`python $K/tools/export.py cover` → open `out/cover_check.jpg`; a second cover for Test & Compare: change COVER,
`export.py cover --out cover_b`.
