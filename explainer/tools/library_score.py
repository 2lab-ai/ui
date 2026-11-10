"""Library score: real, human-composed music under the narration instead of the generated MIDI cues. Run inside a
project folder after the real timeline exists.

    python library_score.py [--fetch] [--lufs -21] [--plan]

Why (owner, 2026-11-10: "음악 너무 개쓰레기같음"): the score.py cues are General MIDI instruments (marimba, xylophone,
kalimba arpeggios) that change every ~35 s; under a documentary voice they sound like a toy. Narrated documentaries
use sparse, textural beds with no lead melody, few attacks, controlled dynamics, one piece per scene, kept 20-25 dB
under the voice with a small dip in the speech band (sources in music/library.json "sources").

- The catalogue is `explainer/music/library.json`: CC BY tracks (Lee Rosevere, "Music for Podcasts" 3-6, made for
  spoken word), each measured (percussive share, attacks per second, energy in 1-4 kHz, dynamics) and tagged with
  moods. Only `bed: true` tracks are used: no drums, few attacks, little speech-band energy, no novelty tunes.
- The audio lives in ~/.cache/2lab-explainer-music/library/ (not in git); the tracks a score needs are downloaded from
  archive.org on first use, `--fetch` downloads all of them.
- Each chapter (scene) gets one track whose moods match the chapter's "mood" (script.json); a chapter longer than its
  track chains a second matching track with a 4 s cross-fade at a sentence gap; a sentence with "music": "<mood>"
  changes track exactly there. A track starts at its own beginning on the chapter's title card, fades in over 1.5 s
  and fades out over 3 s before the next chapter. No track twice in one video; tracks used by the last 10 videos
  cost more (history.json, shared with score.py).
- Only a track's audible body is used (library.json body_start/body_end: quiet intros and fade-out tails cut; the
  first mix had 12-15 s near-silences where a track's outro fell under the voice). Each track is normalised to --lufs before placing, the bed gets a 3 dB dip around 2.5 kHz (consonants), and the
  sum is written as score.wav + score.json (so export.py mix uses the gentle docent ducking) + out/cue_sheet.md +
  out/music_credits.txt (the CC BY attribution lines for the YouTube description and the audiobook).
"""
import json, os, re, subprocess, sys, tempfile, urllib.parse, urllib.request
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from score import wav_sig, load_history, history_lock, HISTORY, chapter_moods

HERE = os.path.dirname(os.path.abspath(__file__))
CATALOGUE = os.path.join(os.path.dirname(HERE), 'music', 'library.json')
CACHE = os.path.expanduser('~/.cache/2lab-explainer-music/library')
SR = 48000
XF = 4.0          # cross-fade inside a chapter (s)
FADE_IN, FADE_OUT = 1.5, 3.0
# script.json moods (REFERENCE §7) -> the library's mood families, in order of preference
FAMILY = {'tension': ['dark', 'melancholy'], 'urgent': ['dark', 'curious'], 'mystery': ['dark', 'reflective'],
          'melancholy': ['melancholy', 'reflective'], 'nostalgic': ['nostalgic', 'melancholy', 'reflective'],
          'reflective': ['reflective', 'melancholy'], 'curious': ['curious', 'reflective'], 'playful': ['curious', 'warm'],
          'warm': ['warm', 'hopeful'], 'triumph': ['hopeful', 'warm'], 'epic-calm': ['reflective', 'wonder', 'warm'],
          'wonder': ['wonder', 'reflective', 'hopeful']}


def catalogue():
    out = [t for t in json.load(open(CATALOGUE))['tracks'] if t.get('bed')]
    for t in out:   # the audible body: quiet intros and long fade-out tails are not placed under a chapter
        t['use'] = t.get('body_end', t['dur']) - t.get('body_start', 0.0)
    return out


def path_of(t):
    return os.path.join(CACHE, t['file'])


def fetch(tracks):
    for t in tracks:
        p = path_of(t)
        if os.path.exists(p): continue
        os.makedirs(os.path.dirname(p), exist_ok=True)
        item = t['source'].rstrip('/').split('/')[-1]
        url = f"https://archive.org/download/{item}/" + urllib.parse.quote(os.path.basename(t['file']))
        print('fetch', t['title']); urllib.request.urlretrieve(url, p + '.part'); os.replace(p + '.part', p)


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
        t = min(cues, key=cost); used.add(t['id']); return t

    for ch in chs:
        # sections: the chapter, cut at forced turns; a section longer than its track chains another at a gap
        bounds = [(ch['start'], ch['mood'])] + [(t, m) for t, m in ch['turns'] if t > ch['start'] + 5]
        for j, (s0, mood) in enumerate(bounds):
            s1 = bounds[j + 1][0] if j + 1 < len(bounds) else ch['end']
            t0 = s0; last = None
            while t0 < s1 - 1:
                tr = pick(mood, s1 - t0, last)
                t1 = min(s1, t0 + tr['use'] - FADE_OUT)
                if t1 < s1:   # the track runs out: change at a sentence gap before it does, leaving the next track
                    gaps = [g for g in ch['gaps'] if t0 + 30 < g < t1]   # >= 25 s (no stub cue, no silent tail)
                    roomy = [g for g in gaps if s1 - g >= 25]
                    t1 = roomy[-1] if roomy else (gaps[-1] if gaps else t1)
                out.append({'scene': ch['id'], 'start': round(t0, 3), 'end': round(t1, 3), 'mood': mood, 'cue': tr['id'],
                            'title': tr['title'], 'artist': tr['artist'], 'license': tr['license'], 'source': tr['source'],
                            'chapter_start': t0 == ch['start']})
                last = tr['id']; t0 = t1
    return out


def assemble(pl, total, lufs):
    """Place each section's track. Inside a chapter the next track cross-fades over XF s after the change; across a
    chapter break the old track runs 1.5 s past the break and the new one starts 1.5 s before it (a 3 s cross-fade
    centred on the title card), so the title card carries music at full bed level."""
    n = int((total + 1) * SR); bed = np.zeros((n, 2), np.float32); cache = {}
    cat = {t['id']: t for t in catalogue()}
    H = 1.5   # half of the chapter-break cross-fade
    for k, p in enumerate(pl):
        if p['cue'] not in cache:
            x = decode(path_of(cat[p['cue']]))
            t = cat[p['cue']]; x = x[int(t.get('body_start', 0) * SR):int(t.get('body_end', len(x) / SR) * SR)]
            cache[p['cue']] = x * (10 ** ((lufs - lufs_of(x)) / 20))
        x = cache[p['cue']]
        nxt = pl[k + 1] if k + 1 < len(pl) else None
        same_chapter = nxt is not None and nxt['scene'] == p['scene']
        pre = H if (p['chapter_start'] and k > 0) else 0.0
        post = XF if same_chapter else (H if nxt is not None else 0.0)
        fi = (2 * H if pre else FADE_IN) if p['chapter_start'] else XF
        fo = XF if same_chapter else (2 * H if nxt is not None else FADE_OUT)
        L = min(len(x), int((p['end'] - p['start'] + pre + post) * SR))
        seg = x[:L].copy(); fi_n, fo_n = min(int(fi * SR), L), min(int(fo * SR), L)
        seg[:fi_n] *= np.linspace(0, 1, fi_n)[:, None]
        seg[L - fo_n:] *= np.linspace(1, 0, fo_n)[:, None]
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


if __name__ == '__main__':
    a = sys.argv[1:]
    lufs = float(a[a.index('--lufs') + 1]) if '--lufs' in a else -20.0
    if '--fetch' in a: fetch(catalogue())
    script, tl = json.load(open('script.json')), json.load(open('timeline.json'))
    pj = json.load(open('project.json')) if os.path.exists('project.json') else {}
    project = pj.get('slug') or os.path.basename(os.getcwd())
    lock = history_lock(); before = [v for v in load_history()['videos'] if v.get('project') == project]
    pl = plan(chapters(script, tl), project, load_history())
    os.makedirs('out', exist_ok=True)
    open('out/cue_sheet.md', 'w').write(cue_sheet(pl)); open('out/music_credits.txt', 'w').write(credits(pl))
    if '--plan' in a: print(cue_sheet(pl)); sys.exit(0)
    from score import save_history
    save_history(project, [p['cue'] for p in pl]); lock.close()
    try:
        cat = {t['id']: t for t in catalogue()}
        fetch([cat[c] for c in dict.fromkeys(p['cue'] for p in pl)])   # only what this score needs, once
        bed = assemble(pl, tl['total'], lufs)
    except BaseException:
        lock = history_lock(); h = load_history(); h['videos'] = [v for v in h['videos'] if v.get('project') != project] + before
        json.dump(h, open(HISTORY, 'w'), indent=1); lock.close(); raise
    write_wav('score.wav', bed)
    tmp = f'score.json.{os.getpid()}'
    json.dump({'kind': 'library', 'sections': pl, 'score_wav': wav_sig('score.wav')}, open(tmp, 'w'), ensure_ascii=False, indent=1)
    os.replace(tmp, 'score.json')
    print(f"score.wav: {len(pl)} sections, {len({p['cue'] for p in pl})} distinct tracks, total {tl['total']:.1f}s; credits in out/music_credits.txt")
