"""The streaming book as a finished upload, cut like the edit (edit/README.md): a ~10 s cold open from its own best moments
→ a 5 s title card on the book's own opening tune → the recording → an end card on the book's own closing tune. The live and
the book never share a tune or a card: the book has its own pair (edit/jingles.py book_night_open / book_night_close).
usage: python book/assemble.py <build dir> <episode book dir> <out dir>
  reads the beats' ASSEMBLY = {'cold': [(line id, from_word, to_word | None), ...], 'title': {...}, 'end': {...}}
  -> <out>/upload.mp4 (1080p30, -16 LUFS), offset.txt (seconds added before the recording: shift chapters and captions)"""
import importlib.util, json, os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(KIT, 'edit')); sys.path.insert(0, os.path.join(KIT, 'engine'))
import jingles
import themes as TH

FPS = 30


def sh(*a): subprocess.run(a, check=True)


def enc(*extra):   # one format for every part so the concat is clean
    return ['-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', str(FPS), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', *extra]


def words(audio, lid):
    p = os.path.join(audio, lid + '.words.json')
    return json.load(open(p)) if os.path.exists(p) else []


def span(ev, audio, lid, w0=None, w1=None):
    """(start, end) of a line in the recording, optionally from word w0 to word w1 (substrings of the aligned words)"""
    v = {x[1]: (x[2], x[3]) for x in ev['voices']}[lid]
    t0, d = v; a, b = t0, t0 + d
    ws = words(audio, lid)
    if w0 and ws:
        k = next((w for w in ws if w0 in w['w']), None)
        if k: a = t0 + k['s'] - 0.08
    if w1 and ws:
        k = next((w for w in ws if w1 in w['w']), None)
        if k: b = t0 + k['e'] + 0.12
    return max(0, a - 0.12), b + 0.22


EDIT_PLAN = """# written by book/assemble.py: only the cold open of this plan is used; the rest keeps edit/cut.py running
import json as _j, os as _o
_C = _j.load(open(_o.path.join(_o.path.dirname(_o.path.abspath(__file__)), 'cold.json')))
COLD_OPEN, COLD_LEN, Z, HEAD = _C['shots'], _C.get('len', 10.0), _C['Z'], tuple(_C.get('head', (1600, 640)))
TONE, HL = _C.get('tone', {}), _C.get('hl', {})
_ids = [l['id'] for l in _j.load(open(_o.path.join(_o.path.dirname(_o.path.abspath(__file__)), 'lines.json')))]
DROP = set(_ids[1:])
TITLE = {'channel': '', 'series': '', 'ep': '', 'title': '', 'sub': '', 'bg': _C['bg'], 'cow': [0.5, 0.5, 0.01, 0.01]}
END = {'next': '', 'next_title': '', 'next_sub': '', 'full': '', 'ask': '', 'bye': '', 'dur': 1.0}
ZOOM, EMPH, CHAT, JUMP_CARDS, CORNERS, STATE, BROLL, INSERTS, CHATZOOM = {}, {}, {}, {}, {}, [], [], [], []
CHAPTERS, CHAPTERS_EN, LIVE, MAIN_LEAD, JINGLE, OUTRO = [(_ids[0], '')], [''], None, 0.0, None, None
"""


def cold_by_edit(C, bdir, ep, tmp):
    """the cold open cut by the edit engine itself (edit/cut.py) from this recording, so the book's first 10 s use the same
    emphasis as the edit: punch-ins on her face or the picture, a caption per line, a freeze with a gag caption, a record
    scratch and a whip into the title. C = {'shots': COLD_OPEN, 'len', 'Z': zoom boxes in the recording's frame, 'bg'}."""
    d = os.path.join(tmp, 'cold_ep'); os.makedirs(d, exist_ok=True)
    open(os.path.join(d, 'edit_plan.py'), 'w').write(EDIT_PLAN)
    json.dump(C, open(os.path.join(d, 'cold.json'), 'w'), ensure_ascii=False)
    shutil.copy(os.path.join(ep, 'lines.json'), os.path.join(d, 'lines.json'))
    o = os.path.join(tmp, 'cold_cut')
    r = subprocess.run([sys.executable, os.path.join(KIT, 'edit', 'cut.py'), d, bdir, o], capture_output=True, text=True)
    if r.returncode: raise SystemExit('edit/cut.py failed:\n' + r.stdout[-2000:] + r.stderr[-2000:])
    m = re.search(r'cold ([0-9.]+)s', r.stdout); n = float(m.group(1))
    src = next(os.path.join(o, f) for f in ('final_edit.mp4', 'edit.mp4', 'final.mp4') if os.path.exists(os.path.join(o, f)))
    cold = os.path.join(tmp, 'cold_edit.mp4')
    sh('ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-t', f'{n:.3f}', '-af', f'afade=t=out:st={n - 0.05:.3f}:d=0.05', *enc(), cold)
    print('cold open by edit/cut.py', f'{n:.2f}s')
    return cold


def main():
    bdir, ep, out = sys.argv[1:4]; os.makedirs(out, exist_ok=True)
    spec = importlib.util.spec_from_file_location('beats', os.path.join(ep, 'beats.py')); mod = importlib.util.module_from_spec(spec)
    sys.path.insert(0, ep); spec.loader.exec_module(mod)
    A = mod.ASSEMBLY; ev = json.load(open(os.path.join(bdir, 'events.json')))
    audio = A.get('audio') or os.path.join(os.path.dirname(bdir), 'audio')
    main_mp4 = os.path.join(bdir, 'final.mp4')
    with tempfile.TemporaryDirectory() as tmp:
        parts = []
        # 1. cold open. 'cold_open' = the edit's grammar (edit/cut.py COLD_OPEN: punch-ins, captions, a freeze, a record scratch);
        #    the older 'cold' list = whole words from the recording, hard cuts with a 3-frame dip
        if A.get('cold_open'):
            parts.append(cold_by_edit(A['cold_open'], bdir, ep, tmp))
        for k, c in enumerate(A.get('cold', []) if not A.get('cold_open') else []):
            a, b = span(ev, audio, *c)
            o = os.path.join(tmp, f'cold_{k}.mp4')
            sh('ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{a:.3f}', '-t', f'{b - a:.3f}', '-i', main_mp4,
               '-vf', f'fade=t=in:st=0:d=0.1,fade=t=out:st={b - a - 0.1:.3f}:d=0.1', '-af', f'afade=t=in:d=0.05,afade=t=out:st={b - a - 0.08:.3f}:d=0.08', *enc(), o)
            parts.append(o)
        # 2. title + 3. end cards: HTML clips (edit/cards.mjs), each on its own tune
        cards = {'clips': []}
        for key in ('title', 'end'):
            cards['clips'].append({'out': os.path.join(tmp, f'{key}_v.mp4'), 'w': 1920, 'h': 1080, 'fps': FPS, 'dur': A[key]['dur'], 'html': A[key]['html']})
        jf = os.path.join(tmp, 'cards.json'); json.dump(cards, open(jf, 'w'), ensure_ascii=False)
        sh('node', os.path.join(KIT, 'edit', 'cards.mjs'), jf)
        tunes = {'title': jingles.render(A['title']['tune'], os.path.join(tmp, 'title.wav'), dur=A['title']['dur']),
                 'end': jingles.render(A['end']['tune'], os.path.join(tmp, 'end.wav'), dur=A['end']['dur'])}
        for key in ('title', 'end'):
            o = os.path.join(tmp, f'{key}.mp4')
            sh('ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(tmp, f'{key}_v.mp4'), '-i', tunes[key], '-map', '0:v', '-map', '1:a', '-shortest', *enc(), o)
            cards[key] = o
        m = os.path.join(tmp, 'main.mp4')
        sh('ffmpeg', '-y', '-loglevel', 'error', '-i', main_mp4, '-vf', 'fade=t=in:st=0:d=0.25', *enc(), m)
        seq = parts + [cards['title'], m, cards['end']]
        lst = os.path.join(tmp, 'list.txt'); open(lst, 'w').write(''.join(f"file '{p}'\n" for p in seq))
        cat = os.path.join(tmp, 'cat.mp4')
        sh('ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', cat)
        up = os.path.join(out, 'upload.mp4')
        sh('ffmpeg', '-y', '-loglevel', 'error', '-i', cat, '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', up)
        dur = lambda p: float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], capture_output=True, text=True).stdout)
        off = sum(dur(p) for p in parts) + dur(cards['title'])
        open(os.path.join(out, 'offset.txt'), 'w').write(f'{off:.3f}\n')
        print('upload', up, f'{dur(up):.1f}s', 'cold', f'{sum(dur(p) for p in parts):.1f}s', 'offset', f'{off:.2f}s')


if __name__ == '__main__':
    main()
