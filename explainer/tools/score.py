"""Score: one original cue per musical section, so the music follows the story instead of looping one track.
Run inside a project folder after the real timeline exists (a draft timeline works for planning).

    python score.py [--plan] [--target 35] [--lufs -20]     # --plan: out/cue_plan.md only, nothing rendered

- Every chapter (scene) gets a mood: script.json scene "mood" (wonder curious tension triumph melancholy playful
  reflective urgent warm mystery epic-calm nostalgic), else one is guessed from the scene's words, else the chapter's
  place in the video decides. A sentence may carry "music": "<mood>" to change cue exactly there (a turn in the story); that mood then
  holds to the end of the chapter.
- A chapter is cut into sections of about --target seconds at sentence starts; each section gets a different cue from
  explainer/music/cues.json. Inside a chapter the cues stay related (same mood family, a near key, the same pad when
  possible) and cross-fade over 2.5 s at a sentence gap; a new chapter starts a new key and instrument on its title
  card after the old cue has ended on its cadence. No cue is used twice in one video.
- Writes score.wav (48 kHz stereo, --lufs integrated, default -20) and out/cue_sheet.md + score.json (time, section,
  cue, mood, key, tempo, instruments). export.py mix then ducks it under the voice as before.
"""
import json, os, sys, tempfile, time, zlib
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import music_lib as ML

XF = 2.5   # cross-fade inside a chapter (s)
# Across videos: the same mood must not open every video with the same cue (research 2026-11-10: three of ten probes
# got mystery-01 with seed 0). Each project rotates the catalogue by its own key, and a history of cues used by earlier
# videos makes recently used cues cost more.
HISTORY = os.path.join(ML.CACHE, 'history.json')

def wav_sig(path):
    """size + hash of the first MB: survives copying the project (mtime does not)."""
    import hashlib
    with open(path, 'rb') as f: head = f.read(1 << 20)
    return f"{os.path.getsize(path)}:{hashlib.sha1(head).hexdigest()[:16]}"

def load_history():
    try: h = json.load(open(HISTORY))
    except Exception: h = {}
    if not isinstance(h, dict): h = {}
    h.setdefault('videos', []); return h

def history_lock():
    """an exclusive lock around read-modify-write of history.json (two projects scored at the same moment)"""
    import fcntl
    os.makedirs(os.path.dirname(HISTORY), exist_ok=True)
    f = open(HISTORY + '.lock', 'w'); fcntl.flock(f, fcntl.LOCK_EX); return f

def save_history(project, cues):
    h = load_history(); h['videos'] = [v for v in h['videos'] if v.get('project') != project][-49:]
    h['videos'].append({'project': project, 'at': int(time.time()), 'cues': sorted(set(cues))})
    os.makedirs(os.path.dirname(HISTORY), exist_ok=True)
    tmp = f'{HISTORY}.{os.getpid()}'; json.dump(h, open(tmp, 'w'), indent=1); os.replace(tmp, HISTORY)   # atomic
NEAR = {'wonder': ['epic-calm', 'reflective', 'mystery'], 'curious': ['playful', 'warm', 'mystery'],
        'tension': ['urgent', 'mystery', 'melancholy'], 'triumph': ['epic-calm', 'warm', 'wonder'],
        'melancholy': ['reflective', 'nostalgic', 'tension'], 'playful': ['curious', 'warm', 'triumph'],
        'reflective': ['melancholy', 'warm', 'wonder'], 'urgent': ['tension', 'triumph', 'mystery'],
        'warm': ['nostalgic', 'reflective', 'triumph'], 'mystery': ['tension', 'wonder', 'curious'],
        'epic-calm': ['wonder', 'triumph', 'reflective'], 'nostalgic': ['warm', 'melancholy', 'reflective']}
WORDS = {   # Korean cue words -> mood (a scene's text votes; ties go to the chapter's place)
    'tension': ['위기', '실패', '폭발', '위험', '두려', '불안', '갈등', '전쟁', '싸움', '경고', '파산', '추락', '모순', '역설'],
    'urgent': ['서둘', '급하', '마감', '시간이 없', '속도', '빨리', '지옥', '밤새', '24시간', '긴급'],
    'triumph': ['성공', '승리', '착륙', '해냈', '돌파', '최초', '우승', '환호', '기록'],
    'melancholy': ['죽음', '슬픔', '잃어', '잃은', '외로', '눈물', '이별', '상처', '고통', '후회'],
    'playful': ['장난', '농담', '웃음', '웃기', '게임', '놀이', '재미', '엉뚱', '말장난', '퍼즐'],
    'reflective': ['생각해', '돌아보', '의미', '깨달', '질문', '마음', '조용', '천천히'],
    'warm': ['가족', '친구', '사랑', '함께', '고마', '따뜻', '아이들', '엄마', '아빠'],
    'mystery': ['비밀', '수수께끼', '이상한', '미스터리', '숨겨', '정체', '알 수 없', '무한'],
    'wonder': ['우주', '별빛', '별들', '미래', '꿈을', '상상', '아름다', '놀라운', '신비', '로켓'],
    'curious': ['왜 ', '어떻게', '궁금', '실험', '발견', '탐구', '규칙', '원리'],
    'epic-calm': ['역사', '문명', '세대', '거대한', '시대', '인류', '산맥', '바다'],
    'nostalgic': ['어린 시절', '어릴', '추억', '옛날', '그때', '고향', '처음으로'],
}
ARC = ['curious', 'warm', 'mystery', 'playful', 'tension', 'epic-calm', 'nostalgic', 'triumph', 'melancholy', 'urgent', 'wonder', 'reflective']

def chapter_moods(script, tl):
    out, prev = [], None
    n = len(tl['scenes'])
    for i, sc in enumerate(tl['scenes']):
        src = next((s for s in script['scenes'] if s['id'] == sc['id']), {})
        m = src.get('mood')
        if m not in ML.MOODS:
            text = ' '.join(s['text'] for s in sc['sentences'])
            votes = {k: sum(text.count(w) for w in ws) for k, ws in WORDS.items()}
            best = max(votes, key=votes.get)
            if votes[best] >= 2 and best != prev: m = best
            elif i == 0: m = 'wonder' if prev != 'wonder' else 'curious'
            elif i == n - 1: m = 'reflective'
            else: m = next(x for x in ARC[i % len(ARC):] + ARC if x != prev)
        out.append(m); prev = m
    return out

def sections(sc, src, target, shortest=10.0):
    """Cut a scene into sections at sentence starts, about `target` s each. A sentence with "music" forces a cut exactly
    there and its mood holds to the end of the chapter (the story turned). Automatic cuts that would leave a section
    shorter than `shortest` s are dropped; forced cuts are never moved."""
    sents = sc['sentences']; start, end = sc['start'], sc['start'] + sc['dur']
    srcs = src.get('sentences', []) if src else []
    forced_at = {k: srcs[k]['music'] for k in range(1, min(len(srcs), len(sents))) if srcs[k].get('music') in ML.MOODS}
    cuts, last = [(start, None)], start
    for k, s in enumerate(sents[1:], 1):
        if k in forced_at or (s['start'] - last >= target and end - s['start'] >= target * 0.5):
            cuts.append((s['start'], forced_at.get(k))); last = s['start']
    # forced cuts never move (the story turns there); an automatic cut that would leave a section under `shortest`
    # seconds is dropped instead. A forced section may be short: compose() still lands its home chord.
    keep = []
    for i, (c, m) in enumerate(cuts):
        if m or i == 0: keep.append((c, m)); continue
        nxt = next((cc for cc, mm in cuts[i + 1:] if mm), end)
        if c - keep[-1][0] < shortest or min(nxt, end) - c < shortest: continue
        keep.append((c, m))
    merged = keep
    out, held = [], None
    for i, (c, m) in enumerate(merged):
        e = merged[i + 1][0] if i + 1 < len(merged) else end
        held = m or held
        out.append({'start': c, 'end': e, 'mood': held, 'forced': bool(m)})
    return out

def related(a, b):
    d = (a - b) % 12
    return d in (0, 5, 7, 3, 9)

def plan(script, tl, target=35.0, project='', history=None):
    cues = ML.catalogue(); used = set(); out = []; prev_ch = None
    recent = {}   # cue id -> how many of the last 10 other videos used it
    for v in (history or {}).get('videos', [])[-10:]:
        if v.get('project') != project:
            for cid in v.get('cues', []): recent[cid] = recent.get(cid, 0) + 1
    spin = lambda cid: zlib.crc32(f'{project}:{cid}'.encode())   # this project's own order among equals
    moods = chapter_moods(script, tl)
    for ci, sc in enumerate(tl['scenes']):
        src = next((s for s in script['scenes'] if s['id'] == sc['id']), {})
        secs = sections(sc, src, target); anchor = None; prev = None
        for si, sec in enumerate(secs):
            base = sec['mood'] or moods[ci]
            mood = base if (sec['forced'] or si % 2 == 0) else NEAR[base][(si // 2) % 3]
            pool = ([c for c in cues if c['mood'] == mood and c['id'] not in used]
                    or [c for c in cues if c['mood'] in NEAR[mood] and c['id'] not in used]
                    or [c for c in cues if c['mood'] == mood])   # the family is used up: reuse, rendered with another seed
            def cost(c):
                k = 0
                if prev is not None: k += 0 if related(c['key'], prev['key']) else 6
                if anchor is not None: k += 0 if c['pad'] == anchor else 2
                if si == 0 and prev_ch is not None: k += (8 if c['key'] == prev_ch['key'] else 0) + (5 if c['pad'] == prev_ch['pad'] else 0)
                if prev is not None and c['tex'] == prev['tex'] and c['pat'] == prev['pat']: k += 4
                if prev is not None and c['key'] == prev['key'] and c['pad'] == prev['pad']: k += 5   # too close to the last cue
                return k + (abs(c['bpm'] - prev['bpm']) / 20 if prev else 0)
            c = min(pool, key=lambda c: (cost(c) + 3 * recent.get(c['id'], 0), spin(c['id'])))
            used.add(c['id']); anchor = anchor or c['pad']; prev = c
            reuse = sum(1 for p in out if p['cue'] == c['id'])
            out.append({'scene': sc['id'], 'chapter': ci, 'section': si, 'start': round(sec['start'], 3), 'end': round(sec['end'], 3),
                        'mood': c['mood'], 'asked': mood, 'cue': c['id'], 'seed': reuse * 1000 + zlib.crc32(project.encode()) % 997, 'name': c['name'], 'chapter_start': si == 0})
        prev_ch = prev
    return out

def assemble(pl, total, lufs=-20.0):
    n = int((total + 1) * ML.SR); mixb = np.zeros((n, 2), np.float32)
    cat = {c['id']: c for c in ML.catalogue()}
    with tempfile.TemporaryDirectory() as td:
        for i, s in enumerate(pl):
            nxt = pl[i + 1] if i + 1 < len(pl) else None
            joined = nxt is not None and not nxt['chapter_start']           # cross-fade into the next section
            t0 = s['start'] - (XF / 2 if not s['chapter_start'] else 0.0)
            t1 = s['end'] + (XF / 2 if joined else 0.0)
            path = os.path.join(td, f'{i}.wav')
            ML.render(cat[s['cue']], t1 - t0, path, seed=s.get('seed', 0))
            a, _ = ML.wav_read(path)
            L = len(a); env = np.ones(L, np.float32); x = int(XF * ML.SR)
            if not s['chapter_start'] and L > x: env[:x] *= np.sin(np.linspace(0, np.pi / 2, x)) ** 1
            if joined and L > x: env[-x:] *= np.cos(np.linspace(0, np.pi / 2, x))
            a0 = int(max(0, t0) * ML.SR); seg = a[: max(0, min(L, n - a0))] * env[: max(0, min(L, n - a0)), None]
            mixb[a0:a0 + len(seg)] += seg
            print(f"{s['start']:7.1f}-{s['end']:7.1f}  {s['scene']:10s} {s['mood']:10s} {s['cue']:14s} {s['name']}", flush=True)
    mixb = mixb[: int(total * ML.SR)]
    raw = 'score_raw.wav'; ML.wav_write(raw, mixb)
    import subprocess
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', f'loudnorm=I={lufs}:TP=-3:LRA=11', '-ar', str(ML.SR), '-ac', '2', 'score.wav'], check=True)
    os.remove(raw)

def cue_sheet(pl):
    lines = ['# Cue sheet', '', f'{len(pl)} sections, {len({p["cue"] for p in pl})} distinct cues, '
             f'{len({p["mood"] for p in pl})} moods', '', '| time | chapter | mood | cue | music |', '|---|---|---|---|---|']
    # mood = the cue's own mood (asked for something else only when that family was used up)
    for p in pl:
        m, s = divmod(int(p['start']), 60)
        asked = f" (asked {p['asked']})" if p.get('asked') and p['asked'] != p['mood'] else ''
        again = f" · again, seed {p['seed']}" if p.get('seed', 0) >= 1000 else ''
        lines.append(f"| {m}:{s:02d} | {p['scene']}{' (new chapter)' if p['chapter_start'] else ''} | {p['mood']}{asked} | {p['cue']}{again} | {p['name']} |")
    return '\n'.join(lines) + '\n'

if __name__ == '__main__':
    a = sys.argv[1:]
    target = float(a[a.index('--target') + 1]) if '--target' in a else 35.0
    lufs = float(a[a.index('--lufs') + 1]) if '--lufs' in a else -20.0
    script, tl = json.load(open('script.json')), json.load(open('timeline.json'))
    pj = json.load(open('project.json')) if os.path.exists('project.json') else {}
    project = pj.get('slug') or script.get('title') or os.path.basename(os.getcwd())
    lock = history_lock()   # plan and reserve under one lock: the next project scored now sees these cues
    before = [v for v in load_history()['videos'] if v.get('project') == project]   # restored if this render fails
    pl = plan(script, tl, target, project, load_history())
    os.makedirs('out', exist_ok=True)
    if '--plan' in a:   # a proposal only: score.json/score.wav (the rendered score and its provenance) stay untouched
        open('out/cue_plan.md', 'w').write(cue_sheet(pl)); print(cue_sheet(pl)); sys.exit(0)
    # Record the cues before rendering (minutes): a second video scored meanwhile must see them. Saving after the
    # render let two projects started together pick the same opening chain (2026-11-10: Musk v2 and ten-books v2 both
    # opened on curious-02 then playful-03).
    save_history(project, [p['cue'] for p in pl]); lock.close()
    try:
        assemble(pl, tl['total'], lufs)
    except BaseException:   # a failed or stopped render must not reserve its cues for the next ten videos
        lock = history_lock(); h = load_history(); h['videos'] = [v for v in h['videos'] if v.get('project') != project] + before
        json.dump(h, open(HISTORY, 'w'), indent=1); lock.close(); raise   # the last good score.wav keeps its entry
    open('out/cue_sheet.md', 'w').write(cue_sheet(pl))
    # export.py mix uses the gentle docent ducking only for the score.wav this file describes (music.py rewrites it);
    # written after the render, atomically
    tmp = f'score.json.{os.getpid()}'
    json.dump({'sections': pl, 'score_wav': wav_sig('score.wav')}, open(tmp, 'w'), ensure_ascii=False, indent=1); os.replace(tmp, 'score.json')
    print(f"score.wav: {len(pl)} sections, {len({p['cue'] for p in pl})} distinct cues, total {tl['total']:.1f}s")
