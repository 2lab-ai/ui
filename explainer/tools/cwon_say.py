"""One-off cwon voice: text in, one clean wav (or mp3/m4a) out. Same pipeline as narrate_soma.py, without a video project.

    python cwon_say.py "하루마다 주면 2.71원. Claude가 GitHub에 올렸어요." -o hello.wav --lex '{"Claude": "클로드", "GitHub": "깃허브"}'
    python cwon_say.py -f script.txt -o voice.mp3 --lex-file lexicon.json

1. Split the text into sentences (. ? ! … and line breaks).
2. Spoken form per sentence with ko_say.py: digits, %, π and the like become Hangul (2.71원 -> 이 쩜 칠 일 원), and
   Latin words come only from the lexicon (which may also respell Hangul words the voice gets wrong: {"회의": "훼이"}).
   Anything left (an English word not in the lexicon, 3:00, 1~2개, =) stops
   the run before any GPU job, and the missing words are printed as a lexicon template to fill in.
3. Each sentence is one turn on blade-4090 (soma-voice, Fish Speech S2 Pro), padded "아아. [pause] … [pause] 아아."; the
   filler is cut off again and the cut-off parts must be heard as filler by whisper (else a new take, up to 3 rounds).
4. Sentences are level-matched, joined with pauses (0.5 s, 0.7 s after a question), set to -16 LUFS by default.
5. Hearing check: whisper transcribes every sentence alone; a sentence whose words it did not hear is marked CHECK
   (re-roll it with --redo k, or respell the word in the lexicon as it is pronounced). --no-check skips it.

Takes are cached in <out>.cwon/cache_voice (re-running only synthesises changed sentences); --redo k re-rolls sentence k.
Needs the tunnel: ssh -f -N -L 19999:127.0.0.1:9999 blade-4090-ps (or SOMA_VOICE_URL), ffmpeg, numpy, mlx-whisper.
"""
import argparse, json, os, re, subprocess, sys

TOOLS = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TOOLS)
from ko_say import leftovers, to_say  # noqa: E402

SENT = re.compile(r'(?<=[.?!…])\s+|\n+')
LATIN_WORD = re.compile(r'[A-Za-z][A-Za-z0-9+#&.\'-]*[A-Za-z0-9+#]|[A-Za-z]')


def sentences(text):
    """text -> sentences: split after . ? ! … and at line breaks; blank pieces dropped."""
    return [s.strip() for s in SENT.split(text) if s and s.strip()]


def plan(text, lexicon):
    """[(sentence, spoken)] plus problems: {sentence index: leftover chars} and the Latin words missing from the lexicon."""
    rows, bad, missing = [], {}, []
    for k, s in enumerate(sentences(text)):
        try:
            say = to_say(s, lexicon)
        except ValueError as e:
            bad[k] = str(e); rows.append((s, s)); continue
        rows.append((s, say))
        left = leftovers(say)
        if left:
            bad[k] = ''.join(left)
            for w in LATIN_WORD.findall(say):
                if w not in missing: missing.append(w)
    return rows, bad, missing


def squash(t, lexicon=None):
    """for comparing: whisper's digits read out the same way, then Hangul only, no spaces."""
    try:
        t = to_say(t, lexicon)
    except ValueError:
        pass
    return re.sub(r'[^가-힣]', '', t)


def words_off(said, heard, lexicon=None, meant=None):
    """(similarity 0..1, words whisper did not hear). Compared with the spoken form and with what was meant (the text
    before Hangul respellings such as 회의 -> 훼이); the closer of the two counts."""
    import difflib
    best = None
    for ref in filter(None, [said, meant]):
        a, b = squash(ref), squash(heard, lexicon)
        ratio = difflib.SequenceMatcher(None, a, b).ratio() if a else 1.0
        hb = set(re.sub(r'[^가-힣 ]', '', to_say_safe(heard, lexicon)).split())
        off = [w for w in re.sub(r'[^가-힣 ]', '', ref).split() if w not in hb and not any(w in x or x in w for x in hb if len(x) > 1)]
        if best is None or (ratio, -len(off)) > (best[0], -len(best[1])): best = (ratio, off)
    return best


def to_say_safe(t, lexicon):
    try:
        return to_say(t, lexicon)
    except ValueError:
        return t


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('text', nargs='?', help='the text (or use -f)')
    ap.add_argument('-f', '--file', help='read the text from a file')
    ap.add_argument('-o', '--out', required=True, help='output .wav / .mp3 / .m4a')
    ap.add_argument('--lex', default='{}', help='JSON {"Claude": "클로드", "회의": "훼이"}: Hangul pronunciation of every Latin '
                    'word, and respellings of Hangul words the voice gets wrong')
    ap.add_argument('--lex-file', help='JSON file with the same lexicon')
    ap.add_argument('--voice', default='cwon')
    ap.add_argument('--seed', type=int, default=100, help='take seed of sentence 0 (sentence k uses seed+k)')
    ap.add_argument('--redo', default='', help='comma list of sentence indexes to re-roll with a new take')
    ap.add_argument('--lufs', type=float, default=-16.0)
    ap.add_argument('--no-pad', action='store_true'); ap.add_argument('--no-verify', action='store_true')
    ap.add_argument('--dry-run', action='store_true', help='print the spoken form and stop (no GPU)')
    ap.add_argument('--no-check', action='store_true', help='skip the sentence-level hearing check at the end')
    a = ap.parse_args()
    text = open(a.file).read() if a.file else a.text
    if not text: ap.error('give the text or -f FILE')
    lexicon = json.loads(a.lex)
    if a.lex_file: lexicon.update(json.load(open(a.lex_file)))
    rows, bad, missing = plan(text, lexicon)
    for k, (s, say) in enumerate(rows):
        print(f'{k:3d}  {say}' + (f'   <-- {bad[k]}' if k in bad else ''))
    if bad:
        if missing:
            print('\nLatin words without a Hangul pronunciation; add them with --lex / --lex-file:')
            print(json.dumps({w: '?' for w in missing}, ensure_ascii=False))
        sys.exit(f'{len(bad)} sentence(s) would reach the TTS with raw characters; nothing was synthesised')
    if a.dry_run: return

    out = os.path.abspath(a.out)
    work = os.path.splitext(out)[0] + '.cwon'
    os.makedirs(work, exist_ok=True)
    seeds_path = os.path.join(work, 'seeds.json')
    seeds = json.load(open(seeds_path)) if os.path.exists(seeds_path) else {}
    for k in filter(None, a.redo.split(',')):
        seeds[k] = seeds.get(k, a.seed + int(k)) + 1000
    json.dump(seeds, open(seeds_path, 'w'))
    # narrate_soma keeps its cache and job folders under the current directory and reads its flags from argv
    os.chdir(work)
    sys.argv = [sys.argv[0], '--voice', a.voice] + (['--no-pad'] if a.no_pad else []) + (['--no-verify'] if a.no_verify else [])
    import narrate_soma as N
    import numpy as np
    items = [(say, seeds.get(str(k), a.seed + k)) for k, (_s, say) in enumerate(rows)]
    clips = [N.trim(N.wav_read(p)) for p in N.synth_scene(items, 'say')]
    target = float(np.median([N.level(c) for c in clips]))
    pieces = []
    for k, c in enumerate(clips):
        pieces.append(c * (10 ** (np.clip(target - N.level(c), -6, 6) / 20)))
        if k + 1 < len(clips):
            pieces.append(np.zeros(int((N.GAP_Q if rows[k][1].rstrip().endswith('?') else N.GAP) * N.SR), np.float32))
    raw = os.path.join(work, 'raw.wav'); N.wav_write(raw, np.concatenate(pieces))
    m = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', raw, '-af', 'ebur128', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    lufs = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', m)[-1])
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', f'volume={a.lufs - lufs:.2f}dB,alimiter=limit=0.89:level=false',
                    '-ar', str(N.SR), '-ac', '1', out], check=True)
    dur = sum(len(p) for p in pieces) / N.SR
    print(f'{out}: {len(clips)} sentences, {dur:.1f} s, {lufs:.1f} -> {a.lufs} LUFS (takes in {work})')
    if a.no_check: return
    # hearing check: whisper each sentence alone; a word it did not hear is a word the listener may not hear either
    import mlx_whisper
    flagged = []
    for k, c in enumerate(clips):
        x = np.concatenate([np.zeros(N.SR // 10, np.float32), c, np.zeros(N.SR // 10, np.float32)])[::3]
        heard = mlx_whisper.transcribe(x, path_or_hf_repo='mlx-community/whisper-large-v3-turbo', language='ko', temperature=0.0,
                                       condition_on_previous_text=False)['text'].strip()
        meant = to_say_safe(rows[k][0], {w: v for w, v in lexicon.items() if re.search(r'[A-Za-z]', w)})
        ratio, off = words_off(rows[k][1], heard, lexicon, meant)
        mark = 'ok ' if ratio >= 0.9 and not off else 'CHECK'
        if mark != 'ok ': flagged.append(k)
        print(f'{mark} {k:3d}  {ratio:.2f}  heard: {heard}' + (f'   (not heard: {" ".join(off)})' if off else ''))
    if flagged:
        print(f'listen to sentence(s) {flagged}: re-roll with --redo {",".join(map(str, flagged))}, or respell the word as it is '
              f'pronounced in the lexicon ({{"회의": "훼이"}}, {{"GitHub": "기터브"}}); the text stays as written')


if __name__ == '__main__':
    main()
