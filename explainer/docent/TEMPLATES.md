# Docent shot templates

Copy-and-adapt recipes for the beats every book video needs. Each one passes the gates in
[REFERENCE.md](REFERENCE.md) §8 as written (they are linted in `docent-lab`). `lt` = seconds since the shot started.
When a template produces a defect, fix the template here in the same PR as the scene fix, and log it in LESSONS.md.
Timing rule for every recipe: everything in a shot finishes drawing by 60 % of the shot's length (a 2 s shot: by
1.2 s), or the lint reports it half-drawn at rest.

Map: S script.json · T1 cast block · T2 dialogue · T3 three people · T4 inner voice · T5 named idea · T6 picture
equation · T7 animal · T8 timeline · T9 wrong vs right · T10 list · T11 crowd · T12 a poem on the wall · T13 a chart
with a break · A adding an asset · C one-scene clip

## S. script.json fields that drive pictures and music
```json
{"id": "rocket", "chip": "4 · 로켓", "title": "세 번의 폭발", "subtitle": "4장", "mood": "tension",
 "sentences": [
   {"text": "첫 발사는 33초 만에 끝났어요."},
   {"text": "그리고 네 번째, 마침내 궤도에 올랐습니다.", "music": "triumph"}]}
```
`mood` = the chapter's music family (REFERENCE §7); `music` on a sentence = change cue exactly there.
Cue keys use the spoken form: a sentence "1911년엔…" is `q.w('천구백십일', k)`, not `q.w('1911', k)`
(`timeline_draft.py` already writes the spoken form, so a wrong key shows up as a missing cue before the voice).
Put the names the voice must say in `project.json` `"names": ["이스마엘", "퀴퀘그"]`: audio_check hints whisper with them.

## T1. Cast block (top of scenes.js, once per book)
```js
TITLE_CARD = signCard;
cast('musk',  { name: '머스크', hair: 'short', outfit: 'suit', accent: 'red', h: 1.08 });
cast('mom',   { name: '메이', hair: 'bun', outfit: 'dress', accent: 'magenta', h: 0.95 });
cast('eng',   { name: '엔지니어', hair: 'curly', glasses: 'round', outfit: 'tshirt', accent: 'teal' });
cast('viewer',{ name: '나', hair: 'side', accent: 'purple' });   // the running figure
```
Then `python tools/gallery.py cast` and look at the sheet before writing any scene.

## T2. Dialogue (two people facing each other)
```js
[q.s(3), (t, lt) => {
  const a = person('musk', 620, 870, { pose: 'point', face: 'happy', tag: true, p: dp(lt, 0, 0.8) });
  const b = person('eng', 1300, 870, { pose: 'shrug', face: 'worried', flip: true, p: dp(lt, 0.15, 0.8) });
  say(a, '다시 쓰자!', { p: dp(lt, 0.9, 0.4) });
  say(b, '불가능해요', { p: dp(lt, 2.0, 0.4) });   // second speaker answers later in the shot
}],
```

## T3. Three people (argument, meeting)
Spread x 520 / 1180 / 1480, all on one ground line; figures first, bubbles last; at most two bubbles per shot.
```js
const m = person('musk', 520, 860, { pose: 'point', face: 'happy', p: dp(lt, 0, 0.8) });
const a = person('eng', 1180, 860, { pose: 'akimbo', face: 'angry', flip: true, p: dp(lt, 0.2, 0.8) });
const b = person('cfo', 1480, 860, { pose: 'facepalm', face: 'sad', flip: true, p: dp(lt, 0.3, 0.8) });
say(a, '불가능해요', { p: dp(lt, 0.9, 0.4) });
think(b, '또 시작이네…', { p: dp(lt, 1.6, 0.4) });
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
```js
[q.s(0), (t, lt) => {
  inkArrow(160, 560, 1760, 560, { p: dp(lt, 0, 0.8) });
  [['1971', '태어남'], ['1995', '창업'], ['2002', '로켓']].forEach(([y, w], i) => {
    const x = 400 + i * 520, p = dp(lt, 0.6 + i * 0.5, 0.4);
    inkDot(x, 560, 10, { p }); hand(y, x, 500, { size: 56, p }); hand(w, x, 630, { size: 48, color: INK(), p });
  });
}],
```

## T9. Wrong idea vs right idea
```js
[q.s(4), (t, lt) => {
  prop('ladder', 560, 760, 1.6, { p: dp(lt, 0, 0.6) }); cross(420, 380, 280, 400, { p: dp(lt, 0.8, 0.5) });
  prop('loop', 1320, 760, 1.6, { p: dp(lt, 1.4, 0.6) }); ring(1320, 600, 220, 200, { p: dp(lt, 2.0, 0.5) });
}],
```

## T10. List
```js
[q.s(2), (t, lt) => scrollList(660, 150, 600, '네 가지 규칙', ['하나', '둘', '셋', '넷'], { p: dp(lt, 0, 1.4), mark: [2] })],
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
  inkPath(pts, { p: dp(lt, 0.4, 1.4), w: 6, color: KEY() });
  inkPath([[1560, 320], [1600, 780]], { p: dp(t, q.w('천한', 1), 0.3), w: 7, color: MARK() });   // the break
  hand('1,000일', 1560, 868, { size: 44, color: C.dim, p: dp(lt, 1.2, 0.4) });
}],
```
Axes first, then the line that "feels safe", then the break on the word that names it. Numbers stay 1 to 3 labels.

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
history: scene → consequence; philosophy: question → answer). Two or three sentences, 70 to 80 characters of text;
one mood and no `"music"` change; the scene's `title` is the book's title (it is the title card); 2 to 4 shots.
