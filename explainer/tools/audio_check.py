"""QA: transcribe the narration (mlx-whisper large-v3-turbo) and diff it against the script; word timing vs timeline.

    python audio_check.py [--sentences] [--scene id ...]

- Whisper writes numbers as digits ("1898"); the script's spoken form says 천팔백구십팔. Both sides are put through
  ko_say before the diff, so a correct reading of a number is no longer a mismatch (research 2026-11-10).
- Names: project.json "names" (a list) and the say_lexicon spellings are given to whisper as a hint, so 퀴퀘그 and
  마리 퀴리 are heard as written instead of being "corrected".
- --sentences also transcribes every sentence on its own (the make-3b1b §3 "number sentences alone" check, for all
  of them) and gives each a verdict: ok (>= 0.9 after normalising) or CHECK (listen, then --redo scene:k).
Writes out/qa_words.json; exit 1 when a sentence is CHECK.
"""
import json, os, re, sys, difflib, subprocess, tempfile
import mlx_whisper
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ko_say import to_say, load_lexicon
HERE = os.getcwd()   # the project folder
ARGS = sys.argv[1:]
if not os.path.exists(os.path.join(HERE, 'narration.wav')): sys.exit('no narration.wav yet: run narrate_soma.py first (audio_check compares the voice with the script)')
tl = json.load(open(os.path.join(HERE, 'timeline.json')))
pj = json.load(open(os.path.join(HERE, 'project.json'))) if os.path.exists(os.path.join(HERE, 'project.json')) else {}
LEX = load_lexicon(HERE)
NAMES = list(pj.get('names', [])) + [v for v in (pj.get('say_lexicon') or {}).values() if isinstance(v, str)]
PROMPT = ', '.join(dict.fromkeys(NAMES))[:400] or None
ONLY = [a for a in ARGS[ARGS.index('--scene') + 1:] if not a.startswith('--')] if '--scene' in ARGS else []

def spoken(s):
    try: return to_say(s, LEX)
    except Exception: return s
norm = lambda s: re.sub(r'[^\w]', '', spoken(s))

def hear(a, b):
    fd, wav = tempfile.mkstemp(suffix='.wav'); os.close(fd)   # one file per call: parallel checks do not collide
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(max(0, a)), '-t', str(b - a), '-i', os.path.join(HERE, 'narration.wav'), '-ar', '16000', '-ac', '1', wav], check=True)
    try: return mlx_whisper.transcribe(wav, path_or_hf_repo='mlx-community/whisper-large-v3-turbo', language='ko', word_timestamps=True, initial_prompt=PROMPT)
    finally: os.remove(wav)

report, bad = [], 0
for sc in tl['scenes']:
    if ONLY and sc['id'] not in ONLY: continue
    a, b = sc['start'], sc['start'] + sc['dur']
    r = hear(a, b)
    heard = ''.join(s['text'] for s in r['segments'])
    said = ' '.join(s['say'] for s in sc['sentences'])
    ratio = difflib.SequenceMatcher(None, norm(said), norm(heard)).ratio()
    words = [w for s in r['segments'] for w in s.get('words', [])]
    offs = []
    for s in sc['sentences']:
        first = norm(s['say'].split()[0])[:2]
        cand = [w for w in words if norm(w['word']).startswith(first) and abs(a + w['start'] - s['start']) < 2.0]
        if cand: offs.append(min((a + w['start'] - s['start'] for w in cand), key=abs))
    sm = difflib.SequenceMatcher(None, norm(said), norm(heard))
    diffs = [(norm(said)[i1:i2], norm(heard)[j1:j2]) for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag != 'equal']
    rep = {'id': sc['id'], 'match': round(ratio, 3), 'timing_max_abs_off': round(max(map(abs, offs)), 2) if offs else None,
           'timing_mean_off': round(sum(offs) / len(offs), 2) if offs else None, 'aligned_sentences': f'{len(offs)}/{len(sc["sentences"])}', 'diffs': diffs[:12]}
    if '--sentences' in ARGS:
        rep['sentences'] = []
        for k, s in enumerate(sc['sentences']):
            h = ''.join(x['text'] for x in hear(s['start'] - 0.15, s['end'] + 0.25)['segments'])
            q = difflib.SequenceMatcher(None, norm(s['say']), norm(h)).ratio()
            v = 'ok' if q >= 0.9 else 'CHECK'; bad += v == 'CHECK'
            rep['sentences'].append({'k': k, 'match': round(q, 3), 'verdict': v, 'heard': h.strip()[:80]})
    report.append(rep); print(json.dumps(rep, ensure_ascii=False))
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
json.dump(report, open(os.path.join(HERE, 'out', 'qa_words.json'), 'w'), ensure_ascii=False, indent=1)
if bad: print(f'{bad} sentence(s) to CHECK: listen, then narrate_soma.py --redo scene:k'); sys.exit(1)
