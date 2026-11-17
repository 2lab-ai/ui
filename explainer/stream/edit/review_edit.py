"""External review of an edit (편집본): frames, strips and charts of final_edit.mp4 + the edit list + the transcript -> three
engines via llmux -> scores against the edit rubric below.
usage: python review_edit.py <edit dir> <episode dir> <label>
<edit dir>/ssot.txt (the request, verbatim) and review_note.txt (what this edit does) are added when present.
Env: REVIEW_MODELS (comma list), REVIEW_TAG (file suffix), REVIEW_DRYRUN=1 (build the packet, call nobody)."""
import base64, io, json, os, subprocess, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image, ImageDraw, ImageFont

D, EP, VER = sys.argv[1], sys.argv[2], sys.argv[3]
VID = os.path.join(D, 'final_edit.mp4')
E = json.load(open(os.path.join(D, 'edl.json')))
L = {l['id']: l for l in json.load(open(os.path.join(EP, 'lines.json')))}
OUT = os.path.join(D, 'review'); os.makedirs(OUT, exist_ok=True)
T = E['total']
try: KF = ImageFont.truetype('/System/Library/Fonts/AppleSDGothicNeo.ttc', 20)
except OSError: KF = ImageFont.load_default()

RUBRIC = [('오프닝 훅: 첫 10초가 이 방송에서 가장 웃기거나 황당한 순간이고, 맥락 없이도 웃기며, 가장 궁금한 지점에서 날카롭게 끊고 타이틀로 넘어가는가', 15),
          ('타이틀 5초 + 시그니처 음악 5초 내외: 둘 다 있고 길이가 맞으며, 채널·시리즈·화수·책 제목이 한눈에 들어오는 브랜딩인가', 10),
          ('템포: 15분 이하, 데드에어 제거, 점프컷 리듬, 그리기·타이핑 배속 처리로 실제 스트리머 편집본처럼 빠르게 흘러가는가', 20),
          ('편집 연출: 자막 가독성, 강조 자막·효과음·줌인·채팅 말풍선의 타이밍·빈도·재미 (과하지도 부족하지도 않은가)', 20),
          ('내용 전달: 잘라낸 뒤에도 책 내용과 방송 흐름이 이해되는가 (맥락 손실, 갑작스러운 점프, 대답만 있고 질문이 없는 곳)', 15),
          ('보랏빛 소: 책의 상징이 실제 이미지로 화면에 충분히, 의미 있게 등장하는가 (낙서만이 아니라)', 10),
          ('업로드 완성도: 엔드카드, 챕터, 라이브 다시보기 편집본다운 느낌, 깨진 화면·잘린 글자·싱크 문제 없음', 10)]


def frame(t, w=1280):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{max(0, t):.3f}', '-i', VID, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'], capture_output=True).stdout
    im = Image.open(io.BytesIO(raw)).convert('RGB')
    return im if w is None else im.resize((w, int(w * 9 / 16)), Image.LANCZOS)


def label(im, text):
    d = ImageDraw.Draw(im); w_ = d.textlength(text, font=KF); d.rectangle([0, 0, w_ + 16, 30], fill=(0, 0, 0)); d.text((8, 4), text, fill=(255, 255, 0), font=KF)
    return im


def mmss(t): return f'{int(t // 60)}:{t % 60:04.1f}'


def sheet(times, cols=4, w=480, labels=None):
    ims = [label(frame(t, w), (labels[i] + ' ' if labels else '') + mmss(t)) for i, t in enumerate(times)]
    h = ims[0].height; rows = (len(ims) + cols - 1) // cols
    S = Image.new('RGB', (cols * w, rows * h))
    for i, im in enumerate(ims): S.paste(im, ((i % cols) * w, (i // cols) * h))
    return S


def save(im, name):
    p = os.path.join(OUT, name); im.convert('RGB').save(p, quality=85); return p


imgs = []
c1 = E['title'][0]
imgs.append((f'콜드 오픈 0~{c1:.1f}초: 0.8초 간격 12컷', save(sheet(list(np.linspace(0.3, c1 - 0.15, 12))), 'cold.jpg')))
imgs.append((f'타이틀 카드 {E["title"][0]:.1f}~{E["title"][1]:.1f}초: 0.6초 간격 8컷', save(sheet(list(np.linspace(E['title'][0] + 0.2, E['title'][1] - 0.1, 8))), 'title.jpg')))
imgs.append(('본편 균등 샘플 24컷', save(sheet(list(np.linspace(E['t_main'] + 1, E['end'][0] - 1, 24))), 'main_sheet.jpg')))
ov = E['overlays']
ins = [o for o in ov if 'video' in o]
emph = [o for o in ov if '/emph_' in o.get('png', '')]
chat = [o for o in ov if '/chat_' in o.get('png', '')]
ff = [m for m in E['main'] if m['speed'] > 1]
zooms = [m for m in E['main'] if m.get('zoom')]
alerts = [m for m in E['main'] if m.get('fill') == 'alert']
sis = [s for s in E['subs'] if s[3] == 'sis']
K = lambda kind: [o for o in ov if o.get('kind') == kind]
ins = [o for o in ov if 'video' in o and o.get('kind', 'insert') == 'insert'] or ins
broll = [o for o in ov if o.get('kind') == 'broll' and ('video' in o or '/card_' in o.get('png', ''))]
picks = []
if ins: picks += [('보랏빛 소 사진 전체 화면 인서트', ins[0]['t0'] + 0.6), ('인서트 끝', ins[0]['t1'] - 0.4)]
for o in broll[:4]: picks.append(('실사 B-roll', o['t0'] + 1.0))
for o in K('corner')[:2]: picks.append(('코너 라벨', o['t0'] + 0.5))
for o in K('state')[:2]: picks.append(('상태 라벨', o['t0'] + 0.6))
for o in K('live')[:1]: picks.append(('생방송 라벨', o['t0'] + 0.8))
for st in ('narr', 'thesis', 'result'):
    for o in [x for x in emph if x.get('style') == st][:2]: picks.append(({'narr': '편집자 손글씨 내레이션', 'thesis': '테제 카드', 'result': '결산 카드'}[st], o['t0'] + 0.9))
for z in [m for m in E['main'] if m.get('zoom') == 'chat'][:2]: picks.append(('채팅창 줌 + 채팅형 자막', z['o1'] - 0.8))   # after any photo that opens the part
for z in [m for m in E['main'] if isinstance(m.get('zoom'), list)][:1]: picks.append(('그림 따라가는 패닝', z['o0'] + 0.5 * (z['o1'] - z['o0'])))
for o in [x for x in emph if x.get('style', 'key') in ('key', 'gag', 'tag')][::3][:4]: picks.append(('강조 자막', o['t0'] + 0.35))
for o in chat[:3]: picks.append(('채팅 말풍선', o['t0'] + 0.6))
for m in ff[:2]: picks.append((f'배속 ×{m["speed"]:g}', m['o0'] + 0.4))
for m in zooms[:3]: picks.append((f'줌인({m["zoom"]})', m['o0'] + 0.5))
if alerts: picks.append(('후원 알림', alerts[0]['o0'] + 1.5))
if sis: picks.append(('동생 등장', sis[0][0] + 0.8))
picks.append(('엔드카드', E['end'][0] + 3.0))
for i in range(0, len(picks), 8):
    grp = picks[i:i + 8]
    imgs.append(('주요 장면: ' + ' / '.join(n for n, _ in grp), save(sheet([t for _, t in grp], labels=[n for n, _ in grp]), f'keys_{i // 8}.jpg')))
for name, t in [('콜드 오픈 마지막 컷(증거 화면)', c1 - 1.0), ('타이틀 카드', E['title'][0] + 3.0)] + ([('보랏빛 소 인서트', ins[0]['t0'] + 1.5)] if ins else []):
    imgs.append((f'{name} 원본 크기 @ {mmss(t)}', save(frame(t), f'full_{len(imgs):02d}.jpg')))

# charts: shot lengths, what each part of the timeline is, loudness over time (the reviewers cannot hear)
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
plt.rcParams['font.family'] = 'AppleGothic'; plt.rcParams['axes.unicode_minus'] = False
shots = [m['o1'] - m['o0'] for m in E['main']]
fig, ax = plt.subplots(2, 1, figsize=(12, 5.2), dpi=110, gridspec_kw={'height_ratios': [1, 1.3]})
col = {None: '#7c3aed', 'timelapse': '#f59e0b', 'alert': '#ef4444', 'walk-off': '#10b981', 'walk-in': '#10b981', 'extra in': '#ec4899', 'extra out': '#ec4899', 'doorbell': '#06b6d4'}
for c in E['cold']: ax[0].barh(0, c['o1'] - c['o0'], left=c['o0'], color='#111', edgecolor='w')
ax[0].barh(0, E['title'][1] - E['title'][0], left=E['title'][0], color='#ffb35c', edgecolor='w')
for m in E['main']: ax[0].barh(0, m['o1'] - m['o0'], left=m['o0'], color=col.get(m.get('fill'), '#999'), edgecolor='w', linewidth=0.3)
ax[0].barh(0, E['end'][1] - E['end'][0], left=E['end'][0], color='#555')
ax[0].set_yticks([]); ax[0].set_xlim(0, T); ax[0].set_title('편집 타임라인: 검정=콜드오픈, 주황=타이틀, 보라=대사 컷, 노랑=그리기 배속, 빨강=후원, 초록=자리 비움, 분홍=동생, 회색=엔드카드')
ax[1].hist(shots, bins=40, color='#7c3aed'); ax[1].set_xlabel('본편 컷 길이(초)'); ax[1].set_ylabel('컷 수')
ax[1].set_title(f'본편 컷 {len(shots)}개, 중앙값 {np.median(shots):.1f}초, 평균 {np.mean(shots):.1f}초')
fig.tight_layout(); p = os.path.join(OUT, 'chart_cuts.png'); fig.savefig(p); plt.close(fig); imgs.append(('증거 차트: 편집 타임라인과 컷 길이', p))
lo = subprocess.run(['ffmpeg', '-hide_banner', '-i', VID, '-af', 'ebur128=metadata=1,ametadata=print:key=lavfi.r128.M', '-f', 'null', '-'], capture_output=True, text=True).stderr
ts_, ms_ = [], []; cur = None
for ln in lo.splitlines():
    if 'pts_time:' in ln: cur = float(ln.split('pts_time:')[1].split()[0])
    elif 'lavfi.r128.M=' in ln and cur is not None: ts_.append(cur); ms_.append(max(-50, float(ln.split('=')[1])))
fig, ax = plt.subplots(figsize=(12, 3.0), dpi=110)
ax.plot(ts_, ms_, lw=0.6, color='#333'); ax.axvspan(E['title'][0], E['title'][1], color='#ffb35c', alpha=.35, label='타이틀+징글')
ax.axvspan(0, E['title'][0], color='#111', alpha=.12, label='콜드 오픈'); ax.axvspan(E['end'][0], T, color='#555', alpha=.2, label='엔드카드')
ax.set_ylim(-50, -5); ax.set_xlim(0, T); ax.set_ylabel('순간 라우드니스(LUFS)'); ax.set_xlabel('초'); ax.legend(loc='lower right', fontsize=8)
ax.set_title('전체 라우드니스 (리뷰어는 소리를 못 들으므로 측정치)'); fig.tight_layout(); p = os.path.join(OUT, 'chart_loud.png'); fig.savefig(p); plt.close(fig)
imgs.append(('증거 차트: 라우드니스 곡선', p))
fig, ax = plt.subplots(figsize=(12, 2.6), dpi=110)
sel = [(t, m) for t, m in zip(ts_, ms_) if E['title'][0] - 1 <= t <= E['title'][1] + 1.5]
if sel: ax.plot([t for t, _ in sel], [m for _, m in sel], color='#e4572e'); ax.axvspan(E['title'][0], E['title'][1], color='#ffb35c', alpha=.35)
ax.set_title('타이틀 구간 확대: 시그니처 징글 라우드니스 (징글 시작 = 타이틀 시작)'); ax.set_ylim(-50, -5); fig.tight_layout(); p = os.path.join(OUT, 'chart_jingle.png'); fig.savefig(p); plt.close(fig)
imgs.append(('증거 차트: 징글 구간', p))

# text: transcript of the edit with what the editor did at each line
emph_by_t = {round(o['t0'], 2): os.path.basename(o['png'])[5:-4] for o in emph}
zoom_at = lambda t: next((m.get('zoom') for m in E['main'] + E['cold'] if m['o0'] <= t < m['o1'] and m.get('zoom')), None)
rows = []
ST = E.get('sub_text', {})   # captions a cold-open shot cut short: the transcript shows what is on screen and heard
for i, (o0, o1, lid, who) in enumerate(E['subs']):
    tag = []
    z = zoom_at(o0)
    if z: tag.append(f'줌:{z}')
    for k, v in emph_by_t.items():
        if o0 <= k < o1 + 0.6 and v == lid: tag.append('강조자막:' + next((x.get('style', '') for x in emph if x['t0'] == k), ''))
    tone = next((x.get('tone') for x in ov if x.get('kind') == 'sub' and abs(x['t0'] - o0) < 0.01), None)
    if tone and tone != 'plain': tag.append('자막톤:' + tone)
    for x in ov:
        if x.get('kind') in ('state', 'corner') and x.get('anim') and o0 - 0.3 <= x['t0'] < o1: tag.append(('상태라벨:' if x['kind'] == 'state' else '코너라벨:') + x.get('text', ''))
        if x.get('kind') == 'broll' and o0 <= x['t0'] < o1 and ('video' in x or '/card_' in x.get('png', '')): tag.append('실사사진')
    rows.append(f"[{mmss(o0)}] {'동생' if who == 'sis' else '케이트'}: {ST.get(str(i), L[lid]['text'])}" + (f"  <{', '.join(tag)}>" if tag else ''))
S = E['stats']
loud = subprocess.run(['ffmpeg', '-hide_banner', '-i', VID, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
I = [l for l in loud.splitlines() if 'I:' in l][-1].strip()
facts = f"""측정치와 사실(리뷰어는 소리를 못 들음):
- 원본 라이브 {S.get('source_min', 29.7):.1f}분 → 편집본 {T / 60:.2f}분. 대사 {S['lines_total']}줄 중 {S['lines_kept']}줄 유지(대사 {S['speech_min']:.1f}분), 본편 점프컷 {S['cuts']}개.
- 콜드 오픈 {E['title'][0]:.2f}초, 타이틀 카드 {E['title'][1] - E['title'][0]:.1f}초, 시그니처 징글 5.0초(타이틀 시작과 동시에 시작, 마지막 0.6초 페이드).
- 징글: {{JDESC}}. 매 화 같은 곡.
- 본편 BGM: 원본 방송과 같은 Tokyo Sunset(HoliznaCC0, CC0), 대사보다 약 19dB 낮게 연속 재생(컷마다 끊기지 않게 원본 음악을 빼고 다시 깔았음). 엔드카드에서 커짐.
- 효과음(합성): 강조 자막 뿅/딩/뾰잉, 코너 라벨 휙, 콜드 오픈 끝 레코드 스크래치, 타이틀 진입 휙{', 줌인 휙' if S.get('sfx') is None else ''}. 효과음 {len(E['sounds'])}개.
- 배속 구간(그리기·타이핑): {S['fills'].get('timelapse', 0):.0f}초 분량, ×2~×8, 화면에 ▶▶ 배지. 후원 알림 {S['fills'].get('alert', 0):.0f}초는 원속도 유지.
- 줌인 컷 {S['zooms']}개, 강조 자막 {S['emph']}개(손글씨 내레이션 {S.get('narr', 0)}개 포함), 채팅 말풍선 {S['chat']}개, 보랏빛 소 사진 인서트 {S['inserts']}개, 실사 B-roll {S.get('broll', 0)}개.
- 상태 라벨 {S.get('states', 0)}개, 코너 라벨 {S.get('corners', 0)}개, 채팅창 줌 {S.get('chatzoom', 0)}개, 자막 톤(외침/중얼/채팅형) {S.get('tones', {})}, 엔드카드 아래 보너스 클립 {'있음' if S.get('end_clip') else '없음'}.
- 최종 라우드니스 {I} (목표 -16 LUFS).
- 챕터: {' / '.join(E['chapters_ko'])}
"""
if E.get('jingle'):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import jingles
    JDESC = '채널 전용 오리지널 곡, 실제 악기 음원(MuseScore General)으로 연주: ' + jingles.CANDIDATES[E['jingle']].__doc__.replace(' — ', ': ')
else: JDESC = '채널 전용으로 합성한 오리지널 곡(F장조 120bpm, 뮤직박스 리드·패드·베이스·가벼운 드럼, C-F-A-G / F-C 모티프)'
facts = facts.replace('{JDESC}', JDESC)
ssot_p = os.path.join(D, 'ssot.txt'); note_p = os.path.join(D, 'review_note.txt')
SSOT = ('SSOT(유저 원문 요구사항): ' + open(ssot_p).read()) if os.path.exists(ssot_p) else ''
NOTE = open(note_p).read() if os.path.exists(note_p) else ''
total = sum(p for _, p in RUBRIC)
RUB = f'채점 기준 (총 {total}점):\n' + '\n'.join(f'{i + 1}. {t} — {p}점' for i, (t, p) in enumerate(RUBRIC))
keys_json = '{' + ', '.join(f'"{i + 1}": n' for i in range(len(RUBRIC))) + '}'
PROMPT = f"""당신은 버튜버·스트리머 유튜브 편집본(다시보기 하이라이트 편집)을 많이 본 냉정한 외부 리뷰어입니다. 아래는 30분 라이브 다시보기를 빠른 템포로 편집한 영상({VER})입니다.
목표: 실제 스트리머들이 유튜브에 올리는 '편집본'처럼, 원본 방송 느낌은 살리고 템포는 빠르게. 영상 길이 {T:.0f}초, 1920x1080 30fps.
{SSOT}

제공 자료: 콜드 오픈·타이틀 연속 컷, 본편 균등 샘플, 주요 장면, 원본 크기 프레임, 증거 차트(편집 타임라인·컷 길이·라우드니스), 편집본 대본(편집된 시각 기준), 측정치.
{NOTE}

편집본 대본 (<>는 편집자가 그 대사에 넣은 연출):
{chr(10).join(rows)}

{facts}
{RUB}

엄격하게 채점하세요. 보이는 결함(맥락 끊김, 어색한 자막/연출, 깨진 화면, 너무 많거나 적은 효과)을 구체적으로 지적하세요.
반드시 아래 JSON 한 개만 출력:
{{"scores": {keys_json}, "total": n, "verdict": "한 줄 총평", "defects": [{{"what": "결함", "where": "시점/위치", "fix": "구체적 개선안", "impact": "high|mid|low"}}], "best": ["잘 된 점 3개 이내"]}}
"""
open(os.path.join(OUT, 'prompt.txt'), 'w').write(PROMPT)
json.dump({'imgs': imgs}, open(os.path.join(OUT, 'content.json'), 'w'), ensure_ascii=False)
if os.environ.get('REVIEW_DRYRUN'): print('dry run ->', OUT); sys.exit(0)

C = []
for cap, p in imgs:
    C.append({'type': 'text', 'text': f'[이미지] {cap}'})
    mt = 'image/png' if p.endswith('.png') else 'image/jpeg'
    C.append({'type': 'image', 'source': {'type': 'base64', 'media_type': mt, 'data': base64.b64encode(open(p, 'rb').read()).decode()}})
C.append({'type': 'text', 'text': PROMPT})


def call(model):
    body = {'model': model, 'max_tokens': 4000, 'messages': [{'role': 'user', 'content': C}]}
    for att in range(3):
        try:
            req = urllib.request.Request(os.environ['ANTHROPIC_BASE_URL'] + '/v1/messages', data=json.dumps(body).encode(), headers={'content-type': 'application/json', 'x-api-key': os.environ['ANTHROPIC_API_KEY'], 'anthropic-version': '2023-06-01'})
            r = json.load(urllib.request.urlopen(req, timeout=600))
            txt = ''.join(x.get('text', '') for x in r.get('content', []))
            return model, json.loads(txt[txt.find('{'): txt.rfind('}') + 1]), txt
        except Exception as e:
            err = e.read()[:300].decode() if hasattr(e, 'read') else str(e)
            print(model, 'attempt', att, err, flush=True)
    return model, None, ''


MODELS = os.environ.get('REVIEW_MODELS', 'gpt-6-astra,grok-4.7,gemini-3.8-flash-high').split(',')
TAG = os.environ.get('REVIEW_TAG', '')
res = {}
with ThreadPoolExecutor(len(MODELS)) as ex:
    for m, j, txt in ex.map(call, MODELS):
        res[m] = j; open(os.path.join(OUT, f'{m}{TAG}.txt'), 'w').write(txt)
tot = [j['total'] for j in res.values() if j]
summary = {'version': VER, 'scores': {m: (j['total'] if j else None) for m, j in res.items()}, 'mean': round(sum(tot) / len(tot), 1) if tot else None,
           'by_criterion': {m: (j['scores'] if j else None) for m, j in res.items()}}
json.dump({'summary': summary, 'reviews': res}, open(os.path.join(OUT, f'review{TAG}.json'), 'w'), ensure_ascii=False, indent=1)
print(json.dumps(summary, ensure_ascii=False))
for m, j in res.items():
    if not j: continue
    print(f'\n== {m}: {j["total"]} — {j.get("verdict")}')
    for d in j.get('defects', [])[:8]: print(f"  [{d.get('impact')}] {d.get('what')} @ {d.get('where')} → {d.get('fix')}")
