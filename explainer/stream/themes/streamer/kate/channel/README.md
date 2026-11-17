# 「지구에서 온 Kate」 channel art and copy

요약: 채널 이미지(배너, 프로필, 워터마크, 회차 썸네일, 시리즈 커버)를 다시 만드는 스크립트와 채널 문구 템플릿. 이미지는 커밋하지 않고 만들 때마다 생성한다.

1. Kate 그림 (투명 PNG, kit `engine/portrait.mjs`):
   ```
   K=explainer/stream; O=$K/themes/streamer/kate/channel/src; mkdir -p $O
   node $K/engine/portrait.mjs kate main $O/icon_face.png --w 1600 --h 1600 --height 4600 --focus 0.205 --expr smile
   node $K/engine/portrait.mjs kate main $O/bust_smile_left.png --w 1400 --h 1600 --height 3200 --focus 0.27 --expr smile --look left
   node $K/engine/portrait.mjs kate main $O/bust_surprise.png --w 1400 --h 1600 --height 3200 --focus 0.27 --expr surprise --mouth 0.4
   node $K/engine/portrait.mjs kate main $O/bust_bigsmile_left.png --w 1400 --h 1600 --height 3200 --focus 0.27 --expr bigsmile --look left --mouth 0.35
   ```
2. 회차 썸네일의 그림판 조각: 최종 렌더의 그림판 페이지 한 장에서 캔버스를 잘라 `src/paint_cows.png`(회차마다 이름을 바꿔 `make_assets.mjs`에서 지정).
3. `node make_assets.mjs` → `out/*.png` (배너 2560×1440 한/영, 프로필 800×800, 워터마크 150×150, 썸네일 1280×720 한/영, 시리즈 커버 1280×1280 한/영).
4. `python gen_package.py <build dir>` → `CHANNEL.md` (챕터·쇼츠 구간·길이를 최종 빌드에서 채움). 새 회차를 올릴 때는 채널 설명의 "지금까지 읽은 책"에 한 줄을 더한다.
