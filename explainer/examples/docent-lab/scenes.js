TITLE_CARD = signCard;
cast('musk',  { name: '머스크', hair: 'short', outfit: 'suit', accent: 'red', h: 1.08 });
cast('eng',   { name: '엔지니어', hair: 'curly', glasses: 'round', outfit: 'tshirt', accent: 'teal' });
cast('cfo',   { name: '재무 담당', hair: 'ponytail', outfit: 'coat', accent: 'orange' });
cast('viewer',{ name: '나', hair: 'side', accent: 'purple' });
SCENES.talk = (t, q) => shots(t, [
  [q.s(0), (t, lt) => {
    const a = person('musk', 620, 870, { pose: 'point', face: 'happy', tag: true, p: dp(lt, 0, 0.8) });
    const b = person('eng', 1300, 870, { pose: 'shrug', face: 'worried', flip: true, tag: true, p: dp(lt, 0.15, 0.8) });
    say(a, '다시 쓰자!', { p: dp(lt, 0.9, 0.4) });
    say(b, '불가능해요', { p: dp(lt, 2.0, 0.4) });
  }],
  [q.s(1), (t, lt) => {
    const m = person('musk', 520, 860, { pose: 'point', face: 'happy', p: dp(lt, 0, 0.8) });
    const a = person('eng', 1180, 860, { pose: 'akimbo', face: 'angry', flip: true, p: dp(lt, 0.2, 0.8) });
    const b = person('cfo', 1480, 860, { pose: 'facepalm', face: 'sad', flip: true, tag: true, p: dp(lt, 0.3, 0.8) });
    say(a, '불가능해요', { p: dp(lt, 0.9, 0.4) });
    think(b, '또 시작이네…', { p: dp(lt, 1.6, 0.4) });
  }],
  [q.s(2), (t, lt) => {
    const z = animal('anteater', 820, 820, { s: 1.3, p: dp(lt, 0, 1.0), tag: '개미핥기' });
    for (let i = 0; i < 5; i++) ant(1380 + i * 90, 820, { t, dir: -1 });
    say(z, '개미 군락은 대화 상대야', { p: dp(lt, 1.2, 0.4) });
  }],
  [q.s(2) + 2.4, (t, lt) => {
    const v = person('viewer', 760, 880, { pose: 'think', face: 'think', p: dp(lt, 0, 0.6) });
    think(v, '그건 말장난이잖아', { p: dp(lt, 0.4, 0.4) });
  }],
]);
