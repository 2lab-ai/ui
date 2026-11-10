"""Library score: real, human-composed music under the narration instead of the generated MIDI cues. Run inside a
project folder after the real timeline exists.

    python library_score.py [--fetch] [--lufs -21] [--plan]
    python library_score.py --measure        # after adding tracks: internal silences -> `holes`, bed: false

Why (owner, 2026-11-10: "음악 너무 개쓰레기같음"): the score.py cues are General MIDI instruments (marimba, xylophone,
kalimba arpeggios) that change every ~35 s; under a documentary voice they sound like a toy. Narrated documentaries
use sparse, textural beds with no lead melody, few attacks, controlled dynamics, one piece per scene, kept 20-25 dB
under the voice with a small dip in the speech band (sources in music/library.json "sources").

- The catalogue is `explainer/music/library.json`: CC BY tracks (Lee Rosevere, "Music for Podcasts" 3-6, made for
  spoken word), each measured (percussive share, attacks per second, energy in 1-4 kHz, dynamics) and tagged with
  moods. Only `bed: true` tracks without `holes` are used: no drums, few attacks, little speech-band energy, no
  novelty tunes, and no internal silence (a run >= 1 s more than 20 dB under the track's median level).
- The audio lives in ~/.cache/2lab-explainer-music/library/ (not in git); the tracks a score needs are downloaded from
  archive.org on first use, `--fetch` downloads all of them.
- Each chapter (scene) gets one track whose moods match the chapter's "mood" (script.json, or guessed from its words as
  score.py does); a chapter longer than its track chains a second matching track with a 4 s cross-fade at a sentence
  gap; a sentence with "music": "<mood>" changes track exactly there (a turn in the first 5 s sets the chapter's mood).
  A chapter break is a 3 s cross-fade centred on the break: the new track starts 1.5 s before its title card. The
  video's last track runs to the end; export.py mix fades it. No track twice in one video while beds last (23 beds:
  ~20 chapters; past that the least costly comes back, with a warning); tracks used by the last 10 videos cost more
  (history.json, shared with score.py).
- Only a track's audible body is placed (library.json body_start/body_end: quiet intros and fade-out tails cut; the
  first mix had 12-23 s near-silences where a track's outro fell under the voice), and a section never needs more
  than that body, cross-fades included. Each track is normalised to --lufs, the bed gets a 3 dB dip around 2.5 kHz
  (consonants), and the sum is written as score.wav + score.json (so export.py mix uses the gentle docent ducking),
  then out/cue_sheet.md + out/music_credits.txt (the CC BY attribution lines for the YouTube description and the
  audiobook) — only after the render, so the credits always name the tracks in score.wav. `--plan` writes
  out/cue_plan.md and nothing else.
"""
import json, os, re, shutil, subprocess, sys, tempfile, urllib.parse, urllib.request
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from score import wav_sig, load_history, history_lock, HISTORY, chapter_moods

HERE = os.path.dirname(os.path.abspath(__file__))
CATALOGUE = os.path.join(os.path.dirname(HERE), 'music', 'library.json')
CACHE = os.path.expanduser('~/.cache/2lab-explainer-music/library')
SR = 48000
XF = 4.0          # cross-fade inside a chapter (s)
H = 1.5           # half of the chapter-break cross-fade (s)
FADE_IN = 1.5     # the video's first track
# script.json moods (REFERENCE §7) -> the library's mood families, in order of preference
FAMILY = {'tension': ['dark', 'melancholy'], 'urgent': ['dark', 'curious'], 'mystery': ['dark', 'reflective'],
          'melancholy': ['melancholy', 'reflective'], 'nostalgic': ['nostalgic', 'melancholy', 'reflective'],
          'reflective': ['reflective', 'melancholy'], 'curious': ['curious', 'reflective'], 'playful': ['curious', 'warm'],
          'warm': ['warm', 'hopeful'], 'triumph': ['hopeful', 'warm'], 'epic-calm': ['reflective', 'wonder', 'warm'],
          'wonder': ['wonder', 'reflective', 'hopeful']}


def catalogue():
    with open(CATALOGUE) as f: out = [t for t in json.load(f)['tracks'] if t.get('bed') and not t.get('holes')]
    for t in out:   # the audible body: quiet intros and long fade-out tails are not placed under a chapter
        t['use'] = t.get('body_end', t['dur']) - t.get('body_start', 0.0)
    return out


def path_of(t):
    return os.path.join(CACHE, t['file'])


def download(url, dest):
    """url -> dest, all or nothing: a per-process part file (two projects fetching the same track never share one), a
    60 s timeout, and a short body is an error (http.client does not raise when the connection ends early; a
    truncated track in the cache would leave a silent hole in every bed that uses it)."""
    part = f'{dest}.{os.getpid()}.part'
    try:
        with urllib.request.urlopen(url, timeout=60) as r, open(part, 'wb') as f:
            shutil.copyfileobj(r, f); want = r.headers.get('Content-Length')
        got = os.path.getsize(part)
        if want is not None and got != int(want): raise IOError(f'{url}: got {got} of {want} bytes')
        os.replace(part, dest)
    finally:
        if os.path.exists(part): os.remove(part)


def fetch(tracks):
    for t in tracks:
        p = path_of(t)
        if os.path.exists(p): continue
        os.makedirs(os.path.dirname(p), exist_ok=True)
        item = t['source'].rstrip('/').split('/')[-1]
        print('fetch', t['title'], flush=True)
        download(f"https://archive.org/download/{item}/" + urllib.parse.quote(os.path.basename(t['file'])), p)


def decode(path):
    """any audio file -> float32 stereo at 48 kHz"""
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).reshape(-1, 2).copy()


def lufs_of(x):
    with tempfile.NamedTemporaryFile(suffix='.wav') as f:
        write_wav(f.name, x)
        m = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', f.name, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', m)[-1])


def write_wav(path, x):
    import wave
    y = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(y.tobytes())


def holes(x, sr=None, depth=20.0, shortest=1.0):
    """internal silences of a track body (mono or stereo samples): stretches more than `depth` dB under the body's
    median level lasting >= `shortest` s, as (start, length) in seconds. Quarter-second windows every 1/16 s, so a
    silence is found wherever it starts. A bed with a hole stops dead under the voice (2026-11-10: five sparse tracks
    dropped to -30..-59 dB for 1.5-2.5 s, the Musk v2b mix went silent mid-sentence at 22:08)."""
    sr = sr or SR; x = x.mean(axis=1) if x.ndim == 2 else x
    win, hop = sr // 4, sr // 16
    if len(x) < win: return []
    c = np.concatenate([[0.0], np.cumsum(x.astype(np.float64) ** 2)])
    starts = np.arange(0, len(x) - win + 1, hop)
    r = 10 * np.log10((c[starts + win] - c[starts]) / win + 1e-18)
    med = float(np.median(r)); quiet = r < med - depth; out = []; i = 0; n = len(r)
    while i < n:
        if quiet[i]:
            j = i
            while j < n and quiet[j]: j += 1
            length = (starts[j - 1] + win - starts[i]) / sr   # the quiet windows cover this much audio (up to one hop
            if length >= shortest - hop / sr: out.append((round(starts[i] / sr, 3), round(length, 3)))   # short of it)
            i = j
        else: i += 1
    return out


def body(t):
    x = decode(path_of(t)); return x[int(t.get('body_start', 0) * SR):int(t.get('body_end', len(x) / SR) * SR)]


def measure(tracks_json=None):
    """--measure: write each cached track's `holes` (count) into music/library.json. `bed` (the listening criteria) is
    left alone; catalogue() skips any track with holes, so a re-measure that finds none brings a bed back."""
    path = tracks_json or CATALOGUE
    with open(path) as f: lib = json.load(f)
    for t in lib['tracks']:
        if not os.path.exists(path_of(t)): print(f"{t['id']}: not cached, not measured (--fetch)"); continue
        t['holes'] = len(holes(body(t)))
        if t.get('bed') and t['holes']: print(f"{t['id']}: {t['holes']} internal silences -> not used as a bed")
    def dump(f):
        with open(f, 'w', encoding='utf-8') as fh: fh.write(json.dumps(lib, ensure_ascii=False, indent=1))
    write_atomic(path, dump)


def speech_dip(x, f0=2500.0, gain_db=-3.0, q=0.8):
    """peaking EQ (RBJ biquad) so the bed leaves room for consonants"""
    from scipy.signal import lfilter
    A = 10 ** (gain_db / 40); w = 2 * np.pi * f0 / SR; al = np.sin(w) / (2 * q)
    b = np.array([1 + al * A, -2 * np.cos(w), 1 - al * A]); a = np.array([1 + al / A, -2 * np.cos(w), 1 - al / A])
    return lfilter(b / a[0], a / a[0], x, axis=0).astype(np.float32)


def chapters(script, tl):
    out = []; moods = chapter_moods(script, tl)   # script.json "mood", or guessed from the words as score.py does
    for i, sc in enumerate(tl['scenes']):
        src = next((s for s in script['scenes'] if s['id'] == sc['id']), {})
        start = sc['start']; end = tl['scenes'][i + 1]['start'] if i + 1 < len(tl['scenes']) else tl['total']
        turns = [(sc['sentences'][k]['start'], s['music']) for k, s in enumerate(src.get('sentences', [])) if s.get('music') and k < len(sc['sentences'])]
        gaps = [(a['end'] + b['start']) / 2 for a, b in zip(sc['sentences'], sc['sentences'][1:])]
        out.append({'id': sc['id'], 'start': start, 'end': end, 'mood': moods[i], 'turns': turns, 'gaps': gaps})
    return out


def plan(chs, project, history):
    cues = catalogue(); used = set(); out = []
    recent = {}
    for v in (history or {}).get('videos', [])[-10:]:
        if v.get('project') != project:
            for cid in v.get('cues', []): recent[cid] = recent.get(cid, 0) + 1

    def pick(mood, need, avoid_last=None):
        fam = FAMILY.get(mood, ['reflective'])
        def cost(t):
            rank = min([fam.index(m) for m in t['moods'] if m in fam], default=9)
            short = max(0.0, need - t['use']) / 60            # minutes the track falls short of the section
            return (rank * 3 + short * 2 + recent.get(t['id'], 0) * 4 + (t['id'] in used) * 100
                    + (t['id'] == avoid_last) * 1000, t['id'])
        t = min(cues, key=cost)
        if t['id'] in used: print(f"every bed is used: {t['id']} plays twice in this video", file=sys.stderr)
        used.add(t['id']); return t

    for ch in chs:
        # sections: the chapter, cut at forced turns; a section longer than its track chains another at a gap
        bounds = [[ch['start'], ch['mood']]]
        for t, m in sorted(ch['turns']):
            if m not in FAMILY: print(f"{ch['id']}: unknown music mood {m!r} ignored (moods: {' '.join(FAMILY)})", file=sys.stderr); continue
            if ch['end'] - t < 5: continue                 # a turn in the chapter's last seconds: the next chapter changes anyway
            if t - bounds[-1][0] < 5: bounds[-1][1] = m   # too close to the last change: that section takes the turn's mood
            else: bounds.append([t, m])
        for j, (s0, mood) in enumerate(bounds):
            s1 = bounds[j + 1][0] if j + 1 < len(bounds) else ch['end']
            t0 = s0; last = None
            while t0 < s1 - 1:
                tr = pick(mood, s1 - t0, last)
                # the section plus its cross-fades (up to H before a chapter start, up to XF after) must fit the body
                t1 = min(s1, t0 + tr['use'] - XF - (H if t0 == ch['start'] else 0.0))
                if t1 < s1:   # the track runs out: change at a sentence gap before it does, leaving the next track
                    gaps = [g for g in ch['gaps'] if t0 + 30 < g < t1]   # >= 25 s (no stub cue, no silent tail)
                    roomy = [g for g in gaps if s1 - g >= 25]
                    t1 = roomy[-1] if roomy else (gaps[-1] if gaps else t1)
                out.append({'scene': ch['id'], 'start': round(t0, 3), 'end': round(t1, 3), 'mood': mood, 'cue': tr['id'],
                            'title': tr['title'], 'artist': tr['artist'], 'license': tr['license'], 'source': tr['source'],
                            'chapter_start': t0 == ch['start']})
                last = tr['id']; t0 = t1
    return out


def extent(pl, k):
    """(pre, post, fade_in, fade_out) of section k, in seconds. Inside a chapter the next track cross-fades over XF s
    after the change; across a chapter break the old track runs H s past the break and the new one starts H s before
    it (a 2H cross-fade centred on the title card, so the title card carries music at full bed level). The video's
    first track fades in over FADE_IN; its last runs to the end unfaded (export.py mix fades the whole mix)."""
    p = pl[k]; nxt = pl[k + 1] if k + 1 < len(pl) else None
    same_chapter = nxt is not None and nxt['scene'] == p['scene']
    pre = H if (p['chapter_start'] and k > 0) else 0.0
    post = XF if same_chapter else (H if nxt is not None else 0.0)
    fi = (2 * H if pre else FADE_IN) if p['chapter_start'] else XF
    fo = XF if same_chapter else (2 * H if nxt is not None else 0.0)
    return pre, post, fi, fo


def assemble(pl, total, lufs):
    """Place each section's track body (see extent()), normalised to `lufs`; dip the speech band; normalise the bed."""
    n = int((total + 1) * SR); bed = np.zeros((n, 2), np.float32); cache = {}
    cat = {t['id']: t for t in catalogue()}
    for k, p in enumerate(pl):
        if p['cue'] not in cache:
            x = body(cat[p['cue']])
            cache[p['cue']] = x * (10 ** ((lufs - lufs_of(x)) / 20))
        x = cache[p['cue']]
        pre, post, fi, fo = extent(pl, k)
        L = int((p['end'] - p['start'] + pre + post) * SR)
        if len(x) < L - SR // 100:   # plan() budgets every section to fit; a short file is a broken cache entry
            raise RuntimeError(f"{p['cue']}: {len(x) / SR:.1f} s of audio for a {L / SR:.1f} s section — delete {path_of(cat[p['cue']])} and run again")
        L = min(L, len(x))
        seg = x[:L].copy(); fi_n, fo_n = min(int(fi * SR), L), min(int(fo * SR), L)
        seg[:fi_n] *= np.linspace(0, 1, fi_n)[:, None]
        if fo_n: seg[L - fo_n:] *= np.linspace(1, 0, fo_n)[:, None]
        a = max(0, int((p['start'] - pre) * SR)); seg = seg[:max(0, n - a)]
        bed[a:a + len(seg)] += seg
    bed = speech_dip(bed)
    bed *= 10 ** ((lufs - lufs_of(bed)) / 20)
    return bed


def cue_sheet(pl):
    lines = ['# Cue sheet (library score)', '', f"{len(pl)} sections, {len({p['cue'] for p in pl})} distinct tracks", '',
             '| time | chapter | mood | track | license |', '|---|---|---|---|---|']
    for p in pl:
        m, s = divmod(int(p['start']), 60)
        lines.append(f"| {m}:{s:02d} | {p['scene']}{' (new chapter)' if p['chapter_start'] else ''} | {p['mood']} | {p['artist']} — {p['title']} | {p['license']} |")
    return '\n'.join(lines) + '\n'


def credits(pl):
    seen = []
    for p in pl:
        line = f"'{p['title']}' by {p['artist']} — {p['license']} ({p['source']})"
        if line not in seen: seen.append(line)
    return 'Music:\n' + '\n'.join(seen) + '\n'


def write_atomic(path, write):
    tmp = f'{path}.{os.getpid()}.tmp'
    try: write(tmp); os.replace(tmp, path)
    finally:
        if os.path.exists(tmp): os.remove(tmp)


if __name__ == '__main__':
    a = sys.argv[1:]
    lufs = float(a[a.index('--lufs') + 1]) if '--lufs' in a else -20.0
    if '--fetch' in a: fetch(catalogue())
    if '--measure' in a: measure(); sys.exit(0)
    script, tl = json.load(open('script.json')), json.load(open('timeline.json'))
    pj = json.load(open('project.json')) if os.path.exists('project.json') else {}
    project = pj.get('slug') or script.get('title') or os.path.basename(os.getcwd())   # the same key as score.py
    lock = history_lock(); before = [v for v in load_history()['videos'] if v.get('project') == project]
    pl = plan(chapters(script, tl), project, load_history())
    os.makedirs('out', exist_ok=True)
    if '--plan' in a:   # a proposal only: score.wav, score.json, the cue sheet and the credits stay untouched
        open('out/cue_plan.md', 'w').write(cue_sheet(pl)); print(cue_sheet(pl)); sys.exit(0)
    from score import save_history
    save_history(project, [p['cue'] for p in pl]); lock.close()   # reserve now: a project scored meanwhile sees them
    try:
        cat = {t['id']: t for t in catalogue()}
        fetch([cat[c] for c in dict.fromkeys(p['cue'] for p in pl)])   # only what this score needs, once
        bed = assemble(pl, tl['total'], lufs)
        write_atomic('score.wav', lambda f: write_wav(f, bed))
    except BaseException:   # a failed or stopped render must not reserve its tracks for the next ten videos
        lock = history_lock(); h = load_history(); h['videos'] = [v for v in h['videos'] if v.get('project') != project] + before
        json.dump(h, open(HISTORY, 'w'), indent=1); lock.close(); raise
    def dump(f):
        with open(f, 'w') as fh: json.dump({'kind': 'library', 'sections': pl, 'score_wav': wav_sig('score.wav')}, fh, ensure_ascii=False, indent=1)
    write_atomic('score.json', dump)
    # after the render: the cue sheet and the credits always describe the score.wav beside them
    open('out/cue_sheet.md', 'w').write(cue_sheet(pl)); open('out/music_credits.txt', 'w').write(credits(pl))
    print(f"score.wav: {len(pl)} sections, {len({p['cue'] for p in pl})} distinct tracks, total {tl['total']:.1f}s; credits in out/music_credits.txt")
