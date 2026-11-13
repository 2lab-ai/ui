// docent lab: every TEMPLATES.md recipe, drawn within the emphasis budget (REFERENCE.md §0): one subject per shot and
// at most two things around it, at most one written word, at most one red mark, ink only (cast looks are silhouettes).
TITLE_CARD = signCard;
cast('musk',   { name: '머스크', hair: 'short', tie: true, h: 1.08 });
cast('eng',    { name: '엔지니어', hair: 'curly', glasses: 'round' });
cast('cfo',    { name: '재무 담당', hair: 'ponytail', h: 0.95 });
cast('gent',   { name: '신사', hat: 'top', mustache: true, h: 1.1 });
cast('marcus', { name: '아우렐리우스', hat: 'laurel', hair: 'short', beard: true, h: 1.05 });
cast('viewer', { name: '나', hair: 'side' });   // the running figure: no tag, ever

// T2 dialogue · T3 two more people · T7 animal · T4 inner voice
SCENES.talk = (t, q) => shots(t, [
  [q.s(0), (t, lt) => {
    const a = person('musk', 700, 870, { pose: 'point', face: 'happy', p: dp(lt, 0, 0.8) });   // a bubble is the shot's word: no tag here
    say(a, '다시 쓰자!', { p: dp(lt, 0.9, 0.4) });
  }],
  [q.s(1), (t, lt) => {   // the verb: two engineers shake their heads; one bubble speaks for both
    const a = person('eng', 760, 860, { pose: 'shrug', face: 'worried', p: dp(lt, 0, 0.8) });
    person('cfo', 1180, 860, { pose: 'facepalm', face: 'sad', flip: true, p: dp(lt, 0.2, 0.8) });
    say(a, '불가능해요', { p: dp(lt, 0.9, 0.4) });
  }],
  [q.s(2), (t, lt) => {   // it passes by: walking, no speech, no label
    animal('anteater', 820 + 60 * lt, 820, { s: 1.3, p: dp(lt, 0, 1.0) });
    for (let i = 0; i < 5; i++) ant(1380 + i * 90, 820, { t, dir: -1 });
  }],
  [q.s(2) + 1.8, (t, lt) => {
    const v = person('viewer', 760, 880, { pose: 'think', face: 'think', p: dp(lt, 0, 0.6) });
    think(v, '그건 말장난이잖아', { p: dp(lt, 0.4, 0.4) });
  }],
]);

// T5 named idea, T6 picture equation, T8 timeline, T9 wrong vs right, T10 list, T11 crowd
SCENES.devices = (t, q) => shots(t, [
  [q.s(0), (t, lt) => teach('형식 체계', { p: dp(lt, 0, 1.2), t })],
  [q.s(1), (t, lt) => {
    prop('gear', 480, 720, 2.0, { p: dp(lt, 0, 0.6) }); plusSign(780, 560, { s: 1.5, p: dp(lt, 0.5, 0.3) });
    prop('loop', 1080, 720, 2.0, { p: dp(lt, 0.7, 0.6) }); eqSign(1380, 560, { s: 1.5, p: dp(lt, 1.2, 0.3) });
    hand('나', 1620, 560, { size: 170, p: dp(lt, 1.4, 0.5) });
  }],
  [q.s(2), (t, lt) => {   // moments as pictures on the line, not labels: the years are spoken, not written
    inkArrow(160, 640, 1760, 640, { p: dp(lt, 0, 0.6) });
    [['house', 0.9], ['garage', 1.0], ['rocket', 0.9]].forEach(([name, s], i) => {
      const x = 420 + i * 540, p = dp(t, q.w(['천구백칠십일', '천구백구십오', '이천이'][i], 2), 0.4);
      inkDot(x, 640, 10, { p }); prop(name, x, 560, s, { p });
    });
  }],
  [q.s(3), (t, lt) => {   // one verdict: the X on the wrong one; the right one needs no ring
    prop('ladder', 560, 760, 1.6, { p: dp(lt, 0, 0.6) }); crossAt(560, 580, 300, 380, { p: dp(lt, 0.8, 0.5) });
    prop('loop', 1320, 760, 1.6, { p: dp(t, q.w('고리', 3), 0.6) });
  }],
  [q.s(4), (t, lt) => scrollList(660, 150, 600, '네 가지 규칙', ['하나', '둘', '셋', '넷'], { p: dp(lt, 0, 1.4) })],
  [q.s(5), (t, lt) => {
    for (let i = 0; i < 6; i++) figure(300 + i * 260, 860, { s: 0.7, crowd: true, face: 'neutral', p: dp(lt, i * 0.08, 0.6) });
    hand('아무도 안 믿음', 960, 320, { size: 72, p: dp(lt, 0.8, 0.6) });
  }],
]);

// edge cases: a top hat speaking sideways, a hat thinking, animals talking (one bubble per shot)
SCENES.hats = (t, q) => shots(t, [
  [q.s(0), (t, lt) => {
    const g = person('gent', 700, 870, { pose: 'present', face: 'smile', p: dp(lt, 0, 0.6) });
    say(g, '안녕하세요', { side: 'right', p: dp(lt, 0.7, 0.3) });
  }],
  [q.s(1), (t, lt) => {
    const g = person('gent', 960, 870, { pose: 'think', face: 'think', p: dp(lt, 0, 0.6) });
    think(g, '비가 오려나', { p: dp(lt, 0.7, 0.3) });
  }],
  [q.s(2), (t, lt) => {
    const c = animal('cat', 620, 860, { s: 1.2, p: dp(lt, 0, 0.6) });
    animal('rabbit', 1300, 860, { s: 1.2, dir: -1, p: dp(lt, 0.1, 0.6) });
    say(c, '야옹', { p: dp(lt, 0.6, 0.3) });
  }],
  [q.s(2) + 1.5, (t, lt) => {
    animal('cat', 620, 860, { s: 1.2 });
    const r = animal('rabbit', 1300, 860, { s: 1.2, dir: -1 });
    say(r, '나도!', { p: dp(lt, 0.2, 0.3) });
  }],
]);

// T12 and T13
SCENES.poem = (t, q) => shots(t, [
  [q.s(0), (t, lt) => {
    prop('frame', 960, 640, 2.2, { p: dp(lt, 0, 0.6), inside: (x, y, w, h, p) => {
      prop('moon', x + w * 0.7, y + h * 0.45, 0.8, { p }); prop('star', x + w * 0.3, y + h * 0.4, 0.5, { p }); } });
    hand('서시', 960, 760, { size: 60, color: INK(), p: dp(lt, 0.7, 0.4) });
  }],
  [q.w('부끄럼', 1), (t, lt) => {
    quote(960, 440, 1300, '한 점 부끄럼이 없기를', { who: '윤동주', size: 96, p: dp(lt, 0, 0.9) });
    ring(1235, 440, 165, 80, { p: dp(lt, 1.0, 0.4) });
  }],
]);
SCENES.chart = (t, q) => shots(t, [
  [q.s(0), (t, lt) => { animal('turkey', 960, 820, { s: 1.4, p: dp(lt, 0, 0.8) }); prop('bowl', 1300, 820, 1.2, { p: dp(lt, 0.5, 0.5) }); }],
  [q.s(1), (t, lt) => {   // the line in ink, the break in red, one number to remember
    inkArrow(260, 820, 260, 220, { p: dp(lt, 0, 0.4) }); inkArrow(260, 820, 1660, 820, { p: dp(lt, 0, 0.4) });
    const pts = []; for (let i = 0; i <= 40; i++) pts.push([280 + i * 32, 800 - Math.pow(i / 40, 1.4) * 480]);
    inkPath(pts, { p: dp(lt, 0.4, 1.4), w: 6 });
    inkPath([[1560, 320], [1600, 780]], { p: dp(t, q.w('천한', 1), 0.3), w: 7, color: MARK() });
    hand('1,000일', 1560, 868, { size: 52, p: dp(lt, 1.2, 0.4) });
  }],
]);

// T14: the thing outside is crossed out (shot 1), the named idea is the only word (shot 2)
SCENES.idea = (t, q) => shots(t, [
  [q.s(0), (t, lt) => {
    prop('crate', 1240, 860, 1.6, { p: dp(lt, 0, 0.5) });
    person('marcus', 700, 880, { pose: 'point', face: 'worried', tag: true, tagSide: 'left', p: dp(lt, 0, 0.5) });
    crossAt(1240, 720, 300, 280, { p: dp(t, q.w('아니에요', 0), 0.4) });
  }],
  [q.s(1), (t, lt) => {
    const v = person('marcus', 760, 880, { pose: 'think', face: 'think', p: dp(lt, 0, 0.5) });
    think(v, null, { w: 420, h: 260, p: dp(lt, 0.5, 0.4), body: (x, y) => hand('내 판단', x + 210, y + 130, { size: 64 }) });
  }],
]);
