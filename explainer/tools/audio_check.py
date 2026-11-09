"""QA: transcribe each scene take (mlx-whisper large-v3-turbo) and diff against the script; word timing vs timeline."""
import json, os, re, sys, difflib, subprocess, tempfile
import mlx_whisper
HERE = os.getcwd()   # the project folder
tl = json.load(open(os.path.join(HERE, 'timeline.json')))
norm = lambda s: re.sub(r'[^\w]', '', s)
report = []
for sc in tl['scenes']:
    a, b = sc['start'], sc['start'] + sc['dur']
    wav = os.path.join(tempfile.gettempdir(), f'qa_{sc["id"]}.wav')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(a), '-t', str(b - a), '-i', os.path.join(HERE, 'narration.wav'), '-ar', '16000', '-ac', '1', wav], check=True)
    r = mlx_whisper.transcribe(wav, path_or_hf_repo='mlx-community/whisper-large-v3-turbo', language='ko', word_timestamps=True)
    heard = ''.join(s['text'] for s in r['segments'])
    said = ' '.join(s['say'] for s in sc['sentences'])
    ratio = difflib.SequenceMatcher(None, norm(said), norm(heard)).ratio()
    # timing: first heard word of each sentence vs timeline start
    words = [w for s in r['segments'] for w in s.get('words', [])]
    offs = []
    for s in sc['sentences']:
        first = norm(s['say'].split()[0])[:2]
        cand = [w for w in words if norm(w['word']).startswith(first) and abs(a + w['start'] - s['start']) < 2.0]
        if cand: offs.append(min((a + w['start'] - s['start'] for w in cand), key=abs))
    sm = difflib.SequenceMatcher(None, norm(said), norm(heard))
    diffs = [(said_n[i1:i2], heard_n[j1:j2]) for said_n, heard_n in [(norm(said), norm(heard))] for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag != 'equal']
    rep = {'id': sc['id'], 'match': round(ratio, 3), 'timing_max_abs_off': round(max(map(abs, offs)), 2) if offs else None,
           'timing_mean_off': round(sum(offs) / len(offs), 2) if offs else None, 'aligned_sentences': f'{len(offs)}/{len(sc["sentences"])}', 'diffs': diffs[:12]}
    report.append(rep); print(json.dumps(rep, ensure_ascii=False))
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
json.dump(report, open(os.path.join(HERE, 'out', 'qa_words.json'), 'w'), ensure_ascii=False, indent=1)
