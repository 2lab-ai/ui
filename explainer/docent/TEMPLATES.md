# Docent shot templates

Copy-and-adapt recipes for the beats every book video needs. Each one passes the gates in
[REFERENCE.md](REFERENCE.md) §8 as written (they are linted in `docent-lab`). `lt` = seconds since the shot started.
When a template produces a defect, fix the template here in the same PR as the scene fix, and log it in LESSONS.md.
Timing rule for every recipe: everything in a shot finishes drawing by 60 % of the shot's length (a 2 s shot: by
1.2 s), or the lint reports it half-drawn at rest.
Every recipe stays inside the emphasis budget (REFERENCE §0): one subject plus at most two things around it, at most
one written word, at most one red mark, ink only. When a sentence seems to need more, it needs two shots.

Map: S script.json · T1 cast block · T2 dialogue · T3 three people · T4 inner voice · T5 named idea · T6 picture
equation · T7 animal · T8 timeline · T9 wrong vs right · T10 list · T11 many people · T12 a poem on the wall · T13 a
chart with a break · A adding an asset · B the book shot · C one-scene clip · P letter places · Cover the YouTube
thumbnail

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
Letter (the default): `me` and `oppa` are cast in every letter video, drawn or not, so their looks stay reserved
(p08: Schrödinger with side hair + round glasses read as 오빠, and with no `oppa` cast no lint could see it; lint
`letter-cast`). `new_video.py` writes the `TITLE_CARD` line and these two casts into a new docent project's scenes.js
(only when it has none) and `"concept": "letter"` into its project.json; for the lint, an ink-mode project
(`"colour": false`) with no `concept` counts as letter. The book's people go below them, each look taken from a photo
(REFERENCE §2).
```js
TITLE_CARD = signCard;
cast('me',       { name: '나', hair: 'long', h: 0.94 });                        // the narrator: never tagged
cast('oppa',     { name: '오빠', hair: 'short', glasses: 'square', h: 1.08 });   // the listener
cast('socrates', { name: '소크라테스', hair: 'bald', beard: true, h: 1.0 });     // busts: bald, a full beard (REFERENCE §2)
```
Lecture:
```js
TITLE_CARD = signCard;
cast('musk',  { name: '머스크', hair: 'short', tie: true, h: 1.08 });          // silhouettes: height, hair/hat, one prop
cast('mom',   { name: '메이', hair: 'bun', h: 0.95 });
cast('eng',   { name: '엔지니어', hair: 'curly', glasses: 'round' });
cast('viewer',{ name: '나', hair: 'spiky' });   // the running figure: never tagged (side hair reads as short)
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

## T11. Many people ("여덟 명", "낯선 사람들", a crowd)
Never a row of 5+ small figures: that is the "rows of figures" the owner rejected, and run 4 still lined up the
trolley's five + one, five strangers and the eight in hiding (lint `crowd-row`, P1: 5+ people in one rest frame, each
under 35 % of the height). At most three big figures in front, the number written once when it is the one to
remember; or, when the point is how many, heads behind one line.
```js
[q.s(1), (t, lt) => {   // "여덟 명이 한집에 살았어요": three of the eight, big; the narration carries the rest
  [[620, 1.0], [960, 0.86], [1300, 1.08]].forEach(([x, h], i) =>
    figure(x, 870, { s: 1.15, h, crowd: true, face: 'worried', p: dp(lt, i * 0.1, 0.5) }));
  hand('8명', 1640, 420, { size: 110, p: dp(lt, 0.6, 0.4) });                    // the one number
}],
[q.s(2), (t, lt) => {   // "낯선 사람 수천 명이 같은 이야기를 믿었어요": one big teller, the many as heads behind a hill
  figure(560, 870, { s: 1.4, pose: 'present', face: 'happy', crowd: true, p: dp(lt, 0, 0.5) });
  inkLine(860, 700, 1760, 700, { w: 5, p: dp(lt, 0.2, 0.3) });                   // the one line: bodies behind it
  for (let i = 0; i < 9; i++) {
    const r = i % 2 ? 26 : 32; inkCircle(910 + i * 100, 700 - r, r, { p: dp(lt, 0.3 + i * 0.03, 0.3) });
  }
}],
```
`crowd: true` on every extra (lint `twins`), and a head no cast look has (lint `cast-lookalike`).

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
// animal: T(px, py) maps local units (x forward, y up negative, s = 1 ≈ 300 px long) to the screen; o = every option
// of the animal() call (s, dir, p, a, w, color, fill and your own, e.g. run: 1, mood: 'sad'); q(k) is the staged
// draw-on, k = 0..4 (all 1 at p = 1). Scale radii by o.s yourself. Return the anchors; add half: <half-length in
// local units> when the animal is longer than ±270 (a whale).
ANIMALS.deer = (T, o, q) => {
  inkPath([T(-90, -60), T(-60, -120), T(60, -120), T(90, -60), T(60, -40), T(-60, -40)], { ...o, closed: true, round: 2, p: q(1), fill: o.fill || mix(C.grey, 0.5) });
  // … legs q(0), head q(2), antlers q(3), eye q(4)
  return { head: T(110, -140), r: 28 * o.s, mouth: T(140, -120), top: T(110, -190) };
};
// prop: (x, y) = bottom centre, s = 1 ≈ 160 px tall; o = { p, a, w, color, fill, t, paperFill }.
// Colour your own parts with `(o.paperFill ? null : o.fill) || myColour`; prop() fills with the page colour by default.
PROPS.anvil = (x, y, s, o) => { inkPath([[x - 80 * s, y - 60 * s], [x + 80 * s, y - 60 * s], [x + 40 * s, y], [x - 40 * s, y]], { ...o, closed: true, fill: (o.paperFill ? null : o.fill) || mix(C.grey, 0.6) }); };
// pose: [elbow, hand] for the left and right arm, relative to the shoulder (y down)
POSES.pray = { la: [[-30, 46], [-6, 10]], ra: [[30, 46], [6, 10]] };
```
Look at the gallery first: run 4 moved ANIMALS `fox` `lion` `wolf` `monkey`, PROPS `plane` `dna` `diary` and POSES
`reachDown` `linked` `showBook` into docent.js. Two people hand in hand: draw both figures, then
`holdHands(a, b, { p })` draws their inner arms to one grip point between them and returns that point. Use it instead
of `POSES.linked` when their heights differ (r09: `linked` hands at h 1.04 and 0.92 missed by 26 px).
Hats: `hat: 'top' | 'cap' | 'beanie' | 'bowler' | 'crown' | 'laurel' | 'morion'`. A new kind of look (a toga, armour)
is a helper drawn after `person()` at its anchors, shown once on a still at Gate A.

**A hat of your own** (the morion pattern, 총균쇠: the conquistador helmet began as a project helper and is now
`hat: 'morion'`). When no kit hat fits the culture (a Ming official's winged cap, an Inca mascaypacha), draw it at the
head anchors in head radii, raise the figure's box to its top, and wrap `person()` so every cast look that names it
gets it:
```js
function wusha(fig, { p = 1, a = 1 } = {}) {          // a Ming official's cap: a low black crown, a wing to each side
  if (!fig || !(fig.r > 0)) return fig;
  const [hx, hy] = fig.head, R = fig.r, P = (dx, dy) => [hx + dx * R, hy + dy * R];
  if (fig.box) { fig.box[1] = Math.min(fig.box[1], hy - 1.6 * R); fig.top = [hx, fig.box[1]]; }   // before p: bubbles keep clear
  if (p <= 0 || a <= 0) return fig;
  const o = { p, a, w: 4.2 * Math.max(0.7, Math.sqrt(R / 44)), jit: 0.5 };   // the figure's line width at this size
  inkPath([P(-0.9, -0.5), P(-0.85, -1.1), P(0.85, -1.1), P(0.9, -0.5)], { ...o, closed: true, fill: INK() });   // the band
  inkArc(...P(0, -1.1), 0.6 * R, 0.48 * R, Math.PI, Math.PI * 2, { ...o, closed: true, fill: INK() });          // the raised back
  for (const d of [-1, 1]) inkEllipse(...P(d * 1.45, -1.12), 0.62 * R, 0.16 * R, { ...o, fill: INK() });      // the wings
  return fig;
}
const personBeforeWusha = person;                     // a name of its own: a second hat wraps again under another
person = function (id, x, y, o = {}) {                 // cast('official', { name: '관리', hat: 'wusha', beard: true })
  const look = CAST[id], mine = !!look && look.hat === 'wusha';
  const f = personBeforeWusha(id, x, y, mine ? { ...o, hair: 'short' } : o);   // under the hat the hair is a short cap
  if (mine) wusha(f, o);
  return f;
};
```
The look keeps `hat: 'wusha'`, so the lint compares heads correctly (`cast-similar`, `cast-lookalike`); figure()
draws nothing for a hat it does not know. Check it on the cast sheet at Gate A beside the cast's other hats; the retro
moves it into `figure()`, and a project that refreshes its engine drops its own wrapper then (총균쇠's `person()`
wrapper would draw a second morion over the kit's).

## B. The book shot (letter: the real covers on a plain page, REFERENCE §4)
Draw the sentence's verb with the book: 다 읽었어요 → she holds it up while 오빠 looks; 읽어 봐요 → she hands it to
him; 빌려준 → he hands it to her. Never the `present` pose pointing at a pair in the air (all 10 run-4 probes opened
that way). One cover in a hand is `holdCover(fig, name)`: at the front hand, upright beside the body, clear of the
face; it returns the cover's box.
- **The original is shown at least once in the video**: the pair on a desk line, in the shot whose line names the
  book or the next one. The Korean edition in a hand alone is not enough. A Korean original (윤동주) is the exception:
  its Korean edition alone.
- **오빠 is in the shot when the line is about him** (오빠가 맨날 읽으라던, 오빠 책장의, 오빠가 빌려준). "오빠," used only
  to call him (오빠, 드디어 다 읽었어요) does not need him drawn.
- **A line about him that also brings in both editions: two shots.** Her, him, a desk and the pair are four things
  (lint `busy`): all four verification authors hit this and broke one rule or the other. First the hand-over of the
  Korean edition between her and him, then her with the pair on a desk line. Draw that desk in plain `inkLine`s: lines
  are support, not a thing, so the shot is her + the pair. Each shot holds 3 s or more: split one sentence (at the
  book's name, `q.w`) only when it runs about 6 s; otherwise the hand-over takes this sentence and the pair the next.
```js
[q.s(0), (t, lt) => {   // "오빠가 권한 책, 드디어 다 읽었어요": she holds the Korean edition up, he looks
  const me = person('me', 700, 870, { s: 1.3, pose: 'showBook', face: 'happy', p: dp(lt, 0, 0.5) });
  holdCover(me, 'cover_lab_ko', { p: dp(lt, 0.15, 0.5) });
  person('oppa', 1300, 870, { s: 1.3, flip: true, face: 'surprised', p: dp(lt, 0.1, 0.5) });
}],
[q.s(2), (t, lt) => {   // "오빠도 꼭 읽어 봐요": she hands it over; his hand meets the cover's far edge
  const me = person('me', 720, 870, { s: 1.3, pose: 'reach', face: 'smile', p: dp(lt, 0, 0.5) });
  const b = holdCover(me, 'cover_lab_ko', { p: dp(lt, 0.15, 0.5) });
  const x = b.x + b.w + 118 * 1.3 * CAST.oppa.h;                                 // his reach hand lands at b.x + b.w
  person('oppa', x, 870, { s: 1.3, pose: 'reach', flip: true, face: 'happy', p: dp(lt, 0.1, 0.5) });
}],
```
A line about him, then both editions (two shots): he hands her the Korean edition; she rests a hand on the pair.
```js
[q.s(0), (t, lt) => {   // "오빠가 맨날 읽으라던 그 책, 드디어 다 읽었어요": he hands it to her
  const o = person('oppa', 720, 870, { s: 1.3, pose: 'reach', face: 'happy', p: dp(lt, 0, 0.5) });
  const b = holdCover(o, 'cover_lab_ko', { p: dp(lt, 0.15, 0.5) });
  const x = b.x + b.w + 118 * 1.3 * CAST.me.h;                                    // her reach hand lands at b.x + b.w
  person('me', x, 870, { s: 1.3, pose: 'reach', flip: true, face: 'smile', p: dp(lt, 0.1, 0.5) });
}],
[q.s(1), (t, lt) => {   // "원서는 영어로 나왔고, 한국어판도 있어요": her and the pair on a desk drawn in lines
  const top = 870 - 190;                                                           // lines are support, not a thing
  inkLine(880, top, 1400, top, { w: 6, p: dp(lt, 0, 0.3) });
  for (const x of [920, 1360]) inkLine(x, top, x, 870, { w: 4.4, p: dp(lt, 0.05, 0.3) });
  const pr = realCoverPair('cover_lab_en', 'cover_lab_ko', 1140, top, 360, { p: dp(lt, 0.1, 0.6) });
  person('me', pr.x - 118 * 1.4 * CAST.me.h, 870, { s: 1.4, pose: 'reach', face: 'happy', p: dp(lt, 0, 0.5) });   // her hand at the near cover
}],
```
She may sit at that desk instead (T15) when the line is 읽었어요 or 덮고도 앉아 있었어요.
The original first (left), the Korean edition second. Every cover is fully in by the shot's start + 0.8 s (lint
`cover-late`): start it by `lt` 0.2 and give it ≤ 0.6 s. A cover or a pair is one thing and no word; with two people
it is the shot's third thing, so nothing else goes in.

## C. A one-scene clip (a 10 to 20 s probe, a trailer, a short)
Keep the chapter shape's first, middle and last beat and drop the rest (biography: turning point → decision → cost;
history: scene → consequence; philosophy: question → answer; fiction: premise → the character's want → the question,
never the ending — no picture that gives the ending away). Two or three sentences; one mood and no `"music"` change;
the scene's `title` is the book's title (it is the title card); 2 to 4 shots. The length counts the 2.6 s title card:
≈ 85 characters of text make ≈ 17 s (run 4: 75–95 characters ran 17–19 s against a 12 s brief). A letter clip keeps
one line of her own reaction ("나도 처음엔…") or of 오빠, not only the book reported in ~대요, and varies its opening
line and its `dir`: all ten run-4 clips opened "오빠, [author]의 [book]을 (다) 읽었어요", seven "a little proud".

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

## T15. Seated figure (chair, stump, step, a desk in front)
`figure({ sit: true })` puts the hip at y − 100 k (k = `s` × the cast's `h`), lays the thighs flat to the knees at
x + 64 and x + 74 k and drops the shins straight down there; it draws no feet. The old recipe put the seat on the
thigh line with its front leg at x + 34 k: the seat hid the thighs, and the leg and the two shins made three
verticals, so the sitter read as standing behind a box (verification v2, r10). Any seat follows three numbers: its
top just under the thigh (y − 96 k), its front edge by x + 20 k (the knee sticks out), and nothing upright between
x + 24 k and x + 140 k but the shins. Checked at phone size (360 px) on stills.
```js
POSES.lap = { la: [[8, 58], [40, 112]], ra: [[20, 56], [58, 110]] };                 // both hands resting on the thighs
// A side chair under a sitter at (x, y): k = s × the cast's h, d = 1 faces right, −1 faces left. Draw it first.
const sideChair = (x, y, k, d = 1, o = {}) => {
  const X = (u) => x + d * u * k, Y = (v) => y - v * k, w = 4.4;
  inkLine(X(-40), Y(88), X(-56), Y(214), { w, ...o });                                   // the back, leaning away
  inkRect(Math.min(X(-44), X(20)), Y(96), 64 * k, 10 * k, { w, fill: PAPER(), ...o });   // the seat, under the thigh
  inkLine(X(-38), Y(86), X(-50), Y(0), { w, ...o });                                      // the back leg
  inkLine(X(14), Y(86), X(24), Y(0), { w, ...o });                                        // the front leg, clear of the shins
  inkLine(X(62), Y(2), X(96), Y(2), { w, ...o });                                         // the sitter's feet (the kit draws none)
};
[q.s(0), (t, lt) => {   // "덮고도 한참 앉아 있었어요": she sits at her desk, chin in her hand
  const s = 1.5, x = 640, y = 870, k = s * CAST.me.h, T = y - 155 * k;
  sideChair(x, y, k, 1, { p: dp(lt, 0, 0.4) });
  person('me', x, y, { s, sit: true, pose: 'deskChin', face: 'sad', p: dp(lt, 0.1, 0.5) });
  inkLine(x + 50 * k, T, x + 470 * k, T, { w: 6, p: dp(lt, 0, 0.4) });                    // the desk top at her elbow
  for (const u of [150, 450]) inkLine(x + u * k, T, x + u * k, y, { w: 4.4, p: dp(lt, 0.1, 0.3) });   // legs past her feet
}],
```
- The desk is drawn as lines: the kit `desk` overhangs its legs by only 20 s, so with its top at her elbow its near leg
  stands on her shins. Its top is at y − 155 k (the elbow in `deskChin`, `deskWrite`), the near leg at x + 150 k or
  further.
- Pose: `lap`, `deskRead`, `deskChin`, `deskWrite` or `deskType`; not `hold` (the arms spread like a shrug).
- A stump or a doorstep is a seat with the same numbers: its top at y − 96 k, its front by x + 20 k, no upright line
  near the shins.
- Facing left: `d = −1` and `flip: true`. A thing on the lap goes at (x + 70 k, y − 118 k).
- `letterNight` still draws the old chair (seat on the thigh line, front leg at x + 34 k): a place shot shows this
  defect until the kit takes these numbers.

## Placement notes
- Draw people in any order, bubbles last: name tags are placed when the shot is complete (`docentTags()`), clear of
  every figure, animal, prop, board and bubble in it. Force a side with `tag: true, tagSide: 'left' | 'right'`.
- Speech goes through `say()`, never a hand-placed `bubble(…, { tail })` next to a person: a tail you aim yourself
  ends at the scalp more often than not (lint `tail-high`). Keep `bubble()` for things that are not a mouth (an
  anthill, a radio) with `tailOk: true`.
- Each shot cuts in 0.3 s before its word (`shots(t, list, { lead })`, default 0.3): put the subject first in the shot
  (`p: dp(lt, 0, 0.5)`), labels and details after. Word-timed parts (`o('word', k, q.s(k))`) move with it.
- Bubbles keep clear of props and boards (they reserve their box), so draw the props of a shot before its bubbles.

## P. Letter places (concept letter: her night desk, his room, the letter page, the real covers)
Optional (owner 2026-11-14): a whole video in these places read as slop; the letter's default is the Stoic level
(CONCEPTS "Pictures"). Use a place for one shot or an opening at most. The real covers (`realCover`, `realCoverPair`,
`holdCover`) are the part every docent book uses; on a plain page they are shot B.
A letter video has two kinds of shots (CONCEPTS letter, "Pictures"): room shots, with the narrator or the listener big
in one place that stays for the chapter, and letter-page shots, with the idea sketched on a sheet of letter paper. The
kit draws the places, so every chapter starts in the same rich room instead of a bare desk:
- `letterNight(o)`: her night desk. A bookcase, the night window, lamp light on the letter, tea steaming, and her at
  s 2.15 facing right. Returns `{ me, top, hand }`.
- `letterRoom(o)`: his room. A window, a desk with his laptop, a wall clock (`time: [h, m]`) and a door, with him at
  s 2.05 facing left. Returns him.
- `letterSheet(o)`: a cream letter page filling the frame. Returns the box `{ x, y, w, h }` for the idea.
- `letterCard`: the chapter card, a fresh letter sheet with the chapter's title written on it in 0.6 s.
- `realCoverPair(original, ko, x, y, h, o)`, `realCover(name, x, y, h, o)` and `holdCover(fig, name, o)`: the book's
  real covers, from images.

The cast keys default to `'me'` and `'oppa'`; pass `who:` for others. The pieces are kit functions too: `nightWindow`,
`deskLamp` with `lampGlow`, and `bookcase`. The seated poses are `deskWrite`, `deskChin`, `deskRead`, `deskShow`,
`deskPalms`, `deskFinger` and `deskType`.
```js
TITLE_CARD = letterCard;                                                   // chapter cards are letter sheets
cast('me',   { name: '나', hair: 'long', h: 0.94 });                       // the narrator: never tagged
cast('oppa', { name: '오빠', hair: 'short', glasses: 'square', h: 1.08 });   // the listener
SCENES.letter = (t, q) => shots(t, [
  [q.s(0), (t, lt) => letterNight({ t, pen: 1, write: lt })],              // shot 0, wide: she writes, the line on the letter grows
  [q.s(1), (t, lt) => {   // shot 1, medium on him: his day turns into evening in the window, the clock runs on, he notices late
    const e = dp(t, q.w('정신을', 1), 1.4), late = e > 0.6;
    letterRoom({ t, night: e, sunY: e * 1.3, time: [9 + Math.round(10 * e), 0], pose: late ? 'facepalm' : 'deskType', face: late ? 'surprised' : 'smile' });
  }],
  [q.s(2), (t, lt) => {   // a letter-page shot: the idea sketched inside the box, then its name
    const b = letterSheet({ lines: 1, seed: 2 });
    onSheet(() => prop('clock', b.x + 300, b.y + b.h - 10, 2.2, { p: dp(lt, 0.2, 0.6), fill: PAPER() }));   // PAPER() is the letter's cream here
    hand('새는 시간', b.x + b.w - 260, b.y + 170, { size: 104, p: dp(t, q.w('새어', 2), 0.8) });
  }],
  [q.s(3), (t, lt) => {   // the book: the real covers, the original and the Korean edition
    const b = letterSheet({ lines: 2, seed: 5 });
    realCoverPair('cover_lab_en', 'cover_lab_ko', b.x + b.w / 2, b.y + b.h - 16, 460, { p: dp(lt, 0.2, 0.8) });
  }],
]);
```
- A place is there at once on a cut: the room, its person and the sheet ignore `p`. Only what the scene adds draws on.
- The camera frames each shot from the first place drawn in it. Room shots alternate wide (even shot index) and medium
  (odd: 1.4x on the person, the place cut by the frame) with a 3 % push-in. Page shots look 1.4x closer and keep the
  box's bottom above the subtitle line, so sketches stay big and inside. Override one shot by its `'scene:index'` key
  at the top of the scene: `LETTER_CAM.wide['letter:1'] = true` (a bubble would leave the medium frame),
  `LETTER_CAM.medium[…]` (a face that matters), `LETTER_CAM.flat[…]` (no camera). The lint still checks what the scene
  draws after the place, framed as it is shown.
- Hold a shot for 6 to 15 s and change one thing per sentence inside it: the pose (`deskWrite` → `deskChin`), the face,
  `look: 1` (her eyes go to the window), `night` and `sunY` (the day passing), `pile` (books on her desk), or `write`.
- `letterNight`'s `me` takes a bubble (`think(me, null, { side: 'right', body })`) or a prop at `me.hands`. `hand` is
  her pencil hand.
- On the sheet, stand things on `b.y + b.h`, and draw them inside `onSheet(() => …)`. Without it, figures and props
  fill with the blue page, so heads and clock faces on the cream letter come out blue.
- A docent book always shows its real covers, the original and the Korean edition (owner, 2026-11-14). Put the cover
  images in `img/<name>.jpg`, list the names in project.json `"images"`, and show the pair on the letter or one cover
  in a hand (`holdCover(fig, name)`; on a plain page: B). A missing image is a lint P0. The drawn `bookCover()`
  is for a book without a cover image.
- For the budget, a room counts as two things, the setting and its person, however many pieces it draws. Add one
  more at most (a prop in a hand or a bubble): a fourth thing is lint `busy`. The letter page counts nothing; what is
  sketched on it counts as usual. A cover or a cover pair is one thing and no word.
- A place the chapter needs that the kit lacks (a clinic, a subway car): build it from the same pieces, on the same
  ground line (`DOCENT_LETTER.ground`, 870) and with a `nightWindow`, so it looks like the rest of the video.

## Cover. The YouTube thumbnail (REFERENCE §10)
One frame composed for 168 px **in the video's own look**: the page colour, the line, the cast and a place from the
video, re-arranged so the subject is big and the text has room. Draw it at the end of `scenes.js` with the video's
own place helpers; `export.py cover` renders it to `out/cover.jpg` (1280×720) and `out/cover_check.jpg`, and prints a
`WARNING cover:` line for each limit it breaks.
```js
POSES.coverHead = { la: [[40, 54], [96, 74]], ra: [[62, -8], [20, -64]] };   // one hand on the keyboard, the other on his head
COVER = () => {
  coverPage();                                                              // the video's page colour
  const s = 2.75, k = s * CAST.oppa.h, x = 360, y = 1050, T = y - 155 * k;   // one subject, bigger than in the video; head ≥ 30 px below the top
  inkLine(40, y, 1520, y, { w: 3, color: C.dim });                          // the floor stops before the running-time corner
  nightWindow(640, 60, 420, 330, { night: 1 });                             // the video's night window: its dark pane carries at 168 px
  inkRect(x + 60 * k, T, 1340 - (x + 60 * k), 18, { w: 4.4, fill: PAPER() });   // his desk, as in the video
  inkLine(x + 110 * k, T + 18, x + 110 * k, y, { w: 4 }); inkLine(1300, T + 18, 1300, y, { w: 4 });
  // … the laptop from the video (base + lid) …
  prop('clock', 1225, T, 1.3, { time: [11, 50], fill: PAPER() });           // the one object with the tension: it is late
  person('oppa', x, y, { s, sit: true, pose: 'coverHead', face: 'worried' });   // a hand on his head
  coverText('벌써', 1585, 320, { size: 300, rot: -0.03 });                  // ≤ 8 characters that add to the title
  coverText('밤?', 1585, 670, { size: 370, rot: -0.03 });
};
// keep x > 1600, y > 950 empty: YouTube draws the running time there
```
Two lines of text are fine (`coverText` twice, 250–370 px each) when the words are short. A second and third cover for
Test & Compare: `COVER_B = () => { … }`, `COVER_C`. Then `python $K/tools/export.py cover` → open every
`out/cover*_check.jpg` next to a still of the video; fix each `WARNING` line. At s ≥ 2.5 a pose reads differently
(facepalm reads as a hand on the chin): judge it on the check image. Bare page: the room (window, desk, chair) and big
text bring a stick-figure cover under 75 %, without colours the video does not use. Used for '게을러서가 아니라 시간이
안 보여서예요' (2026-11-14, remade): 오빠 at his desk at night + the clock at 11:50 + "벌써 / 밤?". The first cover
(a deeper page, 2.4x lines, a red-sand hourglass) was rejected by the owner: it did not look like the video.
