# Docent shot templates

Copy-and-adapt recipes for the beats every book video needs. Each one passes the gates in
[REFERENCE.md](REFERENCE.md) §8 as written (they are linted in `docent-lab`). `lt` = seconds since the shot started.
When a template produces a defect, fix the template here in the same PR as the scene fix, and log it in LESSONS.md.

Map: S script.json · T1 cast block · T2 dialogue · T3 three people · T4 inner voice · T5 named idea · T6 picture
equation · T7 animal · T8 timeline · T9 wrong vs right · T10 list · T11 crowd

## S. script.json fields that drive pictures and music
```json
{"id": "rocket", "chip": "4 · 로켓", "title": "세 번의 폭발", "subtitle": "4장", "mood": "tension",
 "sentences": [
   {"text": "첫 발사는 33초 만에 끝났어요."},
   {"text": "그리고 네 번째, 마침내 궤도에 올랐습니다.", "music": "triumph"}]}
```
`mood` = the chapter's music family (REFERENCE §7); `music` on a sentence = change cue exactly there.

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
  prop('gear', 520, 640, 1.2, { p: dp(lt, 0, 0.6) }); plusSign(760, 560, { p: dp(lt, 0.5, 0.3) });
  prop('loop', 980, 640, 1.2, { p: dp(lt, 0.7, 0.6) }); eqSign(1220, 560, { p: dp(lt, 1.2, 0.3) });
  hand('나', 1440, 560, { size: 110, p: dp(lt, 1.4, 0.5) });
}],
```

## T7. Animal
```js
[q.w('개미핥기', 4), (t, lt) => {
  const z = animal('anteater', 820, 820, { s: 1.3, p: dp(lt, 0, 1.0), tag: '개미핥기' });
  for (let i = 0; i < 5; i++) ant(1380 + i * 90, 820, { t, dir: -1 });
  say(z, '개미 군락은 대화 상대야', { p: dp(lt, 1.2, 0.4) });   // animals talk like people
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
[q.s(2), (t, lt) => scrollList(660, 150, 600, '네 가지 규칙', ['하나', '둘', '셋', '넷'], { p: dp(lt, 0, 2.0), mark: [2] })],
```

## T11. Crowd (people who are not characters)
```js
for (let i = 0; i < 6; i++) figure(300 + i * 230, 860, { s: 0.7, crowd: true, face: 'neutral', p: dp(lt, i * 0.08, 0.6) });
```
