"""Independent review of one rendered short by three engines (llmux, like edit/review_edit.py): a 12-frame strip, the first
second big, the end big, the transcript with times, measured facts; a 100-point rubric from shorts/RESEARCH.md.
usage: python review_shorts.py <short dir> [label]      env: REVIEW_MODELS, REVIEW_TAG, REVIEW_DRYRUN=1
   -> <short dir>/review/review<TAG>.json, one txt per engine"""
import base64, json, os, subprocess, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw

D = os.path.abspath(sys.argv[1]); VER = sys.argv[2] if len(sys.argv) > 2 else 's'
OUT = os.path.join(D, 'review'); os.makedirs(OUT, exist_ok=True)
M = json.load(open(os.path.join(D, 'meta.json'))); VID = os.path.join(D, 'short.mp4'); T = M['length']
ssot_p = os.path.join(D, 'ssot.txt'); SSOT = open(ssot_p).read() if os.path.exists(ssot_p) else ''

RUBRIC = [('첫 1~2초 훅: 스와이프를 멈출 이유(질문·주장·이상한 그림)가 소리와 화면 모두에 있음, 인사·로고·맥락 설명으로 시작하지 않음', 20),
          ('한 가지 생각만: 훅이 던진 질문에 짧은 셋업 → 전개 → 보상이 1분 안에 이어짐, 군더더기 컷 없음, 컷 리듬', 20),
          ('끝까지 보게 만드는 구조와 끝맺음: 마지막 줄이 다음 질문을 열고, 원본 라이브로 가고 싶게 만듦(끝 카드·관련 동영상), 늘어지는 아웃트로 없음', 20),
          ('세로 화면 가독성: 큰 자막(한 번에 짧게), 쇼츠 UI에 가리지 않는 안전 영역, 위 훅 제목·가운데 그림·아래 얼굴의 구도', 15),
          ('혼자 봐도 이해됨: 라이브를 안 본 사람도 맥락을 따라감, 실제 사진이 말하는 대상을 보여 줌', 10),
          ('완성도: 깨진 프레임·잘린 글자·싱크 문제 없음, 제목·설명(라이브 링크 포함)이 영상과 맞음', 5),
          ('실제 클립 쇼츠처럼 보임(AI가 찍어낸 템플릿 티가 없음): 검정 바탕에 굵은 흰 글씨의 짧은 제목, 강조는 단색 한 단어; 그라데이션 글자·네온·과한 외곽선·이모지 라벨·알약 배지·시리즈 배지·"왜 ~할까?" 같은 정형 문구가 없음', 10)]
assert sum(w for _, w in RUBRIC) == 100


for f in os.listdir(OUT):
    if f.startswith('f_') and f.endswith('.jpg'): os.remove(os.path.join(OUT, f))


def frame(t, w):
    """a still at t (or a little earlier: a seek past the last frame writes nothing)"""
    for back in (0.0, 0.1, 0.25, 0.5):
        p = os.path.join(OUT, f'f_{max(0.0, t - back):.2f}_{w}.jpg')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{max(0.0, t - back):.2f}', '-i', VID, '-frames:v', '1', '-vf', f'scale={w}:-1', p], check=True)
        if os.path.exists(p): return p
    raise SystemExit(f'no frame near {t:.2f}s')


ts = [T * f for f in (0.0, 0.06, 0.14, 0.23, 0.32, 0.41, 0.5, 0.6, 0.7, 0.8, 0.9, 0.995)]
fs = [frame(min(t, T - 0.05) if t else 0.05, 270) for t in ts]
w, h = Image.open(fs[0]).size; strip = Image.new('RGB', (w * 6, h * 2), 'white'); d = ImageDraw.Draw(strip)
for i, f in enumerate(fs):
    strip.paste(Image.open(f), ((i % 6) * w, (i // 6) * h)); d.text(((i % 6) * w + 6, (i // 6) * h + 4), f'{ts[i]:.1f}s', fill='red')
sp = os.path.join(OUT, 'strip.jpg'); strip.save(sp, quality=85)
imgs = [('12장 타임라인(왼쪽 위부터 시간순, 빨간 숫자 = 초)', sp), ('첫 프레임(0.05초), 원본 크기의 절반', frame(0.05, 540)),
        ('끝 프레임', frame(T - 0.05, 540))]
loud = subprocess.run(['ffmpeg', '-hide_banner', '-i', VID, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
I = [l for l in loud.splitlines() if 'I:' in l][-1].strip()
L = {x['id']: x for x in json.load(open(M['lines_json']))} if M.get('lines_json') else {}
rows = '\n'.join(f'[{o0:5.1f}–{o1:5.1f}s] {L.get(lid, {}).get("text", lid)}' for o0, o1, lid in M['subs'])
facts = f"""측정치와 사실(리뷰어는 소리를 못 들음):
- 길이 {T:.1f}초, 1080x1920, 30fps, 라우드니스 {I} (목표 -14 LUFS). 컷(샷) {len(M['shots'])}개.
- 위 고정 훅 제목: {M.get('hook', '').replace(chr(10), ' / ')}
- 마지막 대사가 끝나면 자막 자리에 자막 자리에 끝 줄 "{M.get('end', '')}"이 {M.get('end_hold', 1.3)}초 뜨고 영상이 끝남(마지막 프레임 정지).
- 업로드 제목: {M['title']}
- 설명 첫 줄들: {M['desc'][:220].replace(chr(10), ' / ')}
- 쇼츠 화면의 관련 동영상 링크는 이 채널에서 아직 쓸 수 없음(YouTube 고급 기능 인증 잠김) → 원본 라이브 {M.get('related')} 는 설명란 첫 줄(쇼츠에선 안 눌림)과 마지막 줄 '채널 홈' 안내로만 연결.
- 실제 사진 {len(M.get('photos', []))}장(말하는 대상의 실물 사진, 그림판 자리)."""
PROMPT = f"""당신은 유튜브 쇼츠 편집 전문가다. 아래는 버튜버 '책듣는밤' 라이브 방송(책 한 권을 그림판에 그리며 설명)에서 1분 이내로 잘라 만든 쇼츠 한 편이다.
{('SSOT(오너 요구): ' + SSOT) if SSOT else ''}
대사(출력 시간 기준):
{rows}

{facts}

채점 기준(합 100):
""" + '\n'.join(f'{k + 1}. {c} ({wt})' for k, (c, wt) in enumerate(RUBRIC)) + """

JSON 하나만 출력: {"scores": {"1": n, ...}, "total": n, "verdict": "한 줄", "defects": [{"impact": "high|mid|low", "what": "...", "where": "초", "fix": "..."}]}"""
open(os.path.join(OUT, 'prompt.txt'), 'w').write(PROMPT)
if os.environ.get('REVIEW_DRYRUN'): print('dry run ->', OUT); sys.exit(0)

C = []
for cap, p in imgs:
    C.append({'type': 'text', 'text': f'[이미지] {cap}'})
    C.append({'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/jpeg', 'data': base64.b64encode(open(p, 'rb').read()).decode()}})
C.append({'type': 'text', 'text': PROMPT})


def call(model):
    body = {'model': model, 'max_tokens': 3000, 'messages': [{'role': 'user', 'content': C}]}
    for att in range(3):
        try:
            req = urllib.request.Request(os.environ['ANTHROPIC_BASE_URL'] + '/v1/messages', data=json.dumps(body).encode(),
                                         headers={'content-type': 'application/json', 'x-api-key': os.environ['ANTHROPIC_API_KEY'], 'anthropic-version': '2023-06-01'})
            r = json.load(urllib.request.urlopen(req, timeout=600)); txt = ''.join(x.get('text', '') for x in r.get('content', []))
            return model, json.loads(txt[txt.find('{'): txt.rfind('}') + 1]), txt
        except Exception as e:
            print(model, 'attempt', att, (e.read()[:300].decode() if hasattr(e, 'read') else str(e)), flush=True)
    return model, None, ''


MODELS = os.environ.get('REVIEW_MODELS', 'gpt-6-astra,grok-4.7,gemini-3.8-flash-high').split(','); TAG = os.environ.get('REVIEW_TAG', '')
res = {}
with ThreadPoolExecutor(len(MODELS)) as ex:
    for m, j, txt in ex.map(call, MODELS):
        res[m] = j; open(os.path.join(OUT, f'{m}{TAG}.txt'), 'w').write(txt)
tot = [j['total'] for j in res.values() if j]
summary = {'short': M['id'], 'label': VER, 'scores': {m: (j['total'] if j else None) for m, j in res.items()}, 'mean': round(sum(tot) / len(tot), 1) if tot else None}
json.dump({'summary': summary, 'reviews': res}, open(os.path.join(OUT, f'review{TAG}.json'), 'w'), ensure_ascii=False, indent=1)
print(json.dumps(summary, ensure_ascii=False))
for m, j in res.items():
    if not j: continue
    print(f'\n== {m}: {j["total"]} — {j.get("verdict")}')
    for x in j.get('defects', [])[:6]: print(f"  [{x.get('impact')}] {x.get('what')} @ {x.get('where')} → {x.get('fix')}")
