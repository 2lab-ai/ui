"""External review panel: frames + strips + evidence charts + transcript + audio facts -> 3 engines via llmux -> scores.
usage: python review.py <build dir> <lines.json> <label>
What to show comes from events.json "review": the beats' REVIEW (keyframes, strips, gaze picks, lip-sync lines) plus the
rubric lines of the three themes. <build dir>/ssot.txt (the request, verbatim) and review_note.txt (what the video does, so
reviewers do not guess) are added when present. Keep the note true to THIS render: a stale line gets quoted back as a defect.
Env: REVIEW_MODELS (comma list), REVIEW_TAG (file suffix), REVIEW_DRYRUN=1 (build the packet, call nobody)."""
import base64, io, json, os, subprocess, sys, urllib.request, wave
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image, ImageDraw, ImageFont

B = sys.argv[1]; LINES = {l['id']: l for l in json.load(open(sys.argv[2]))}; VER = sys.argv[3]
VID = os.path.join(B, 'final.mp4')
ev = json.load(open(os.path.join(B, 'events.json')))
RV = ev.get('review', {}); MX = ev.get('mix', {})
T = ev['T']
OUT = os.path.join(B, 'review'); os.makedirs(OUT, exist_ok=True)
try:
    KFONT = ImageFont.truetype('/System/Library/Fonts/AppleSDGothicNeo.ttc', 20)
except OSError:
    KFONT = ImageFont.load_default()


def frame(t, w=1280):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{max(0, t):.3f}', '-i', VID, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'], capture_output=True).stdout
    im = Image.open(io.BytesIO(raw)).convert('RGB')
    return im if w is None else im.resize((w, int(w * 9 / 16)), Image.LANCZOS)


def label(im, text):
    d = ImageDraw.Draw(im); w_ = d.textlength(text, font=KFONT); d.rectangle([0, 0, w_ + 16, 30], fill=(0, 0, 0)); d.text((8, 4), text, fill=(255, 255, 0), font=KFONT)
    return im


def sheet(times, cols=4, w=480):
    ims = [label(frame(t, w), f'{int(t // 60)}:{t % 60:04.1f}') for t in times]
    h = ims[0].height; rows = (len(ims) + cols - 1) // cols
    S = Image.new('RGB', (cols * w, rows * h))
    for i, im in enumerate(ims): S.paste(im, ((i % cols) * w, (i // cols) * h))
    return S


def strip(t0, box, n=8, step=2 / 30, size=240):
    ims = []
    for k in range(n):
        im = frame(t0 + k * step, None).crop(tuple(box)).resize((size, int(size * (box[3] - box[1]) / (box[2] - box[0]))), Image.LANCZOS)
        ims.append(label(im, f'+{k * step:.2f}s'))
    S = Image.new('RGB', (size * n, ims[0].height))
    for i, im in enumerate(ims): S.paste(im, (i * size, 0))
    return S


def save(im, name):
    p = os.path.join(OUT, name); im.save(p, quality=85); return p


V = {lid: (who, t0, d) for who, lid, t0, d in ev['voices']}
TLJ = json.load(open(os.path.join(B, 'timeline.json')))


def at(spec):
    """['line', id, frac(, offset s)] | ['t', sec] | ['afk', 0|1, offset] | ['extra', 0|1, offset] | ['first_draw', offset] -> seconds"""
    kind = spec[0]
    if kind == 'line': _, t0, d = V[spec[1]]; return t0 + d * (spec[2] if len(spec) > 2 else 0.5) + (spec[3] if len(spec) > 3 else 0)
    if kind == 't': return float(spec[1])
    if kind == 'afk': return ev['afk'][spec[1]] + (spec[2] if len(spec) > 2 else 0)
    if kind == 'extra': return ev['sis'][0][spec[1]] + (spec[2] if len(spec) > 2 else 0)
    if kind == 'first_draw':
        segs = [o['f'] / 30 for o in TLJ['ops'] if o['op'] == 'seg']
        return (segs[len(segs) // 6] if segs else T / 4) + (spec[1] if len(spec) > 1 else 0)
    raise ValueError(spec)


imgs = [('전체 흐름: 균등 샘플 24컷', save(sheet(list(np.linspace(1.0, T - 1.0, 24))), 'sheet.jpg'))]
for name, spec in RV.get('keys', []):
    try: t = at(spec)
    except (KeyError, IndexError, TypeError): print('skip key', name, spec); continue
    imgs.append((f'{name} @ {int(t // 60)}:{t % 60:04.1f}', save(frame(t), f'key_{len(imgs):02d}.jpg')))
for k, s in enumerate(RV.get('strips', [])):
    try: t = at(s['at'])
    except (KeyError, IndexError, TypeError): print('skip strip', s.get('label')); continue
    imgs.append((s['label'], save(strip(t, s['box'], n=s.get('n', 8), step=s.get('step', 2 / 30), size=s.get('size', 240)), f'strip_{k:02d}.jpg')))
if RV.get('gaze'):
    box = RV.get('gaze_box', [1380, 470, 1880, 1080])
    ims = [label(frame(at(spec), None).crop(tuple(box)).resize((300, 366)), n) for n, spec in RV['gaze']]
    S = Image.new('RGB', (300 * len(ims), 366))
    for i, im in enumerate(ims): S.paste(im, (i * 300, 0))
    imgs.append(('시선 목표 비교: ' + ' / '.join(n for n, _ in RV['gaze']), save(S, 'gaze_compare.jpg')))

# evidence charts: what the reviewers cannot hear, drawn from the same data the video was made from
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
plt.rcParams['font.family'] = 'AppleGothic'; plt.rcParams['axes.unicode_minus'] = False


def clip_env(lid, fps=30):
    w = wave.open(os.path.join(MX['audio_dir'], lid + '.wav')); a = np.frombuffer(w.readframes(w.getnframes()), np.int16) / 32768; sr = w.getframerate()
    hop = sr // fps; n = len(a) // hop
    return np.array([20 * np.log10(np.sqrt(np.mean(a[i * hop:(i + 1) * hop] ** 2)) + 1e-7) for i in range(n)])


def lip_chart(lid, fname, title):
    who, t0, d = V[lid]; f0 = int(round(t0 * 30))
    env = clip_env(lid) + (20 * np.log10(MX.get('extra', {}).get('gain', 0.45)) if who == 'sis' else 0.0); n = len(env)
    P = TLJ[who]['p']
    mouth = np.max(np.array([P['Param' + k][f0:f0 + n] for k in 'AIUEO']), axis=0) if 'ParamA' in P else np.array(P['ParamMouthOpenY'][f0:f0 + n])
    tt = np.arange(n) / 30
    fig, ax = plt.subplots(figsize=(12, 3.2), dpi=110); ax2 = ax.twinx()
    ax.plot(tt, env, color='#888', lw=1.2, label='음성 크기(dB, 믹스에 들어간 레벨)'); ax2.plot(tt, mouth[:n], color='#e4572e', lw=2, label='아바타 입 벌림(렌더에 쓴 값)')
    ax.set_ylim(-70, -5); ax2.set_ylim(0, 1.1); ax.set_xlabel('초'); ax.set_title(title + ' — ' + LINES[lid]['text'])
    h1, l1 = ax.get_legend_handles_labels(); h2, l2 = ax2.get_legend_handles_labels(); ax.legend(h1 + h2, l1 + l2, loc='upper right', fontsize=8)
    fig.tight_layout(); p = os.path.join(OUT, fname); fig.savefig(p); plt.close(fig); return p


def key_chart(fname):
    ops = [o for o in TLJ['ops'] if o['op'] == 'tb']
    keys = [s_[0] for s_ in ev['sfx'] if s_[1] in ('key', 'space', 'enter', 'back', 'shift')]
    t_first = ops[0]['f'] / 30; win = [(o['f'] / 30, o['s'] + o.get('c', '')) for o in ops if o['f'] / 30 < t_first + 4.0]
    fig, ax = plt.subplots(figsize=(12, 3.0), dpi=110)
    for k in keys:
        if t_first - 0.2 <= k <= t_first + 4.0: ax.axvline(k, ymin=0.55, ymax=0.95, color='#1f77b4', lw=1.2)
    for t_, txt in win: ax.plot([t_], [0.3], 'o', color='#e4572e', ms=4); ax.text(t_, 0.12, txt[-3:], rotation=60, fontsize=7, ha='left')
    ax.set_ylim(0, 1); ax.set_yticks([0.3, 0.75]); ax.set_yticklabels(['글자 상자 변화(프레임)', '키 소리(오디오)']); ax.set_xlabel('초')
    ax.set_title('타건음 ↔ 글자 변화 정렬 (첫 타이핑 4초, 한글 조합 단계 표시)'); fig.tight_layout(); p = os.path.join(OUT, fname); fig.savefig(p); plt.close(fig); return p


ROLE = RV.get('roles', {})
try:
    if RV.get('lip_main') in V: imgs.append((f'증거 차트: {ROLE.get("main", "메인")} 립싱크 — 실제 음성 크기 vs 입 벌림', lip_chart(RV['lip_main'], 'chart_lip_main.png', '메인 립싱크')))
    if RV.get('lip_extra') in V: imgs.append((f'증거 차트: {ROLE.get("sis", "엑스트라")} — 음성 크기 vs 입 벌림', lip_chart(RV['lip_extra'], 'chart_lip_extra.png', '엑스트라 립싱크')))
    if any(o['op'] == 'tb' for o in TLJ['ops']): imgs.append(('증거 차트: 키보드 소리와 글자 입력 동기', key_chart('chart_keys.png')))
except Exception as e:
    print('chart error', e)

# audio facts
sfx = ev['sfx']
nk = sum(1 for s in sfx if s[1] in ('key', 'space', 'enter', 'back', 'shift', 'delete'))
nm = sum(1 for s in sfx if s[1] in ('mdown', 'mup'))
loud = subprocess.run(['ffmpeg', '-hide_banner', '-i', VID, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
I = [l for l in loud.splitlines() if 'I:' in l][-1].strip()
transcript = [f"[{int(t0 // 60)}:{t0 % 60:04.1f}] {ROLE.get(who, who)}: {LINES[lid]['text']}   (연기 지시: {LINES[lid].get('dir', '')})" for who, lid, t0, d in ev['voices']]
facts = '오디오(리뷰어는 소리를 못 들으므로 측정치로 대신 제공):\n' + '\n'.join('- ' + f.format(keys=nk, clicks=nm) for f in RV.get('facts', [])) + f'\n- 최종 라우드니스: {I}\n'
rub = RV.get('rubric', [])
total = sum(p for _, p in rub)
RUBRIC = f'채점 기준 (총 {total}점):\n' + '\n'.join(f'{i + 1}. {t} — {p}점' for i, (t, p) in enumerate(rub))
ssot_p = os.path.join(B, 'ssot.txt'); note_p = os.path.join(B, 'review_note.txt')
TODAY = ('SSOT(유저 원문 요구사항): ' + open(ssot_p).read()) if os.path.exists(ssot_p) else ''
NOTE = open(note_p).read() if os.path.exists(note_p) else ''
keys_json = '{' + ', '.join(f'"{i + 1}": n' for i in range(len(rub))) + '}'
# the streaming theme may set the goal (a solo recording is not trying to pass as a live VOD; studio: a dense book explainer)
GOAL = RV.get('goal') or "아래는 방송 다시보기 형식 영상 데모({ver})입니다.\n목표: 보는 사람이 '진짜 버튜버 라이브 영상 녹화본인가?' 하고 의문이 들 정도여야 함."
PROMPT = f"""당신은 버튜버 방송과 영상 제작을 잘 아는 냉정한 외부 리뷰어입니다. {GOAL.format(ver=VER)} 영상 길이 {T:.0f}초, 1920x1080 30fps.
{TODAY}

제공 자료: 아래 이미지들(균등 샘플 시트, 핵심 장면 키프레임, 연속 프레임 스트립, 증거 차트)과 대본 타임라인, 오디오 측정치.
{NOTE}

대본 타임라인:
{chr(10).join(transcript)}

{facts}
{RUBRIC}

엄격하게 채점하세요. 보이는 결함(부자연스러운 부분, 실제 방송과 다른 부분, 깨진 UI, 어색한 그림)을 구체적으로 지적하세요.
반드시 아래 JSON 한 개만 출력:
{{"scores": {keys_json}, "total": n, "verdict": "한 줄 총평", "defects": [{{"what": "결함", "where": "시점/위치", "fix": "구체적 개선안", "impact": "high|mid|low"}}], "best": ["잘 된 점 3개 이내"]}}
"""
open(os.path.join(OUT, 'prompt.txt'), 'w').write(PROMPT)
json.dump({'imgs': imgs, 'note': NOTE}, open(os.path.join(OUT, 'content.json'), 'w'), ensure_ascii=False)
if os.environ.get('REVIEW_DRYRUN'): sys.exit(0)

C = []
for cap, p in imgs:
    C.append({'type': 'text', 'text': f'[이미지] {cap}'})
    C.append({'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/jpeg', 'data': base64.b64encode(open(p, 'rb').read()).decode()}})
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
