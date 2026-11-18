"""Storyboard for a page-driven stream (the streaming book, book/README.md): one script file holds the pages, the lines,
the marks on the pages and which part of the book each line explains, so lines.json, pages.json and the beats can never drift.

    python engine/storyboard.py <ep>/book/script.py              -> lines.json, pages/pages.json, story.json, coverage.json
    python engine/storyboard.py <ep>/book/script.py --fake <dir> -> also fake takes (syllables / 4 + 0.35 s) for a dry build

script.py defines
    TOC      = ['part title', ...]                       the contents panel (streaming theme studio)
    SECTIONS = [('part', 'section of the book', 'key'), ...]   every section of the book, in the book's order
    PAGES    = {'p01': {page spec for engine/pages.mjs}, ...}
    SEQ      = [('part', i) | ('page', 'p01') | ('pause', s) | ('think', s) |
                (text, {opts}) ...]        a line; opts: say, dir, tts, j (1 = joke / exaggeration / aside), sec (section key),
                                           gaze ('cam' | 'screen' | 'think' | 'down'), expr, gap, m (marks, below)
    marks: ('u', i[, frac]) underline marks[i]   ('uu', i) double   ('c', i) circle   ('x', i) cross   ('s', i) strike
           ('bx', i) box        ('h',) underline the headline     ('cb',) circle the big number   ('ci'|'ui'|'ti'|'xi', i) item i
           ('ct',) circle the article title       ('bimg', k) box image k      ('a', x0, y0, x1, y1) arrow
           ('n', x, y, 'text') a typed note       ('bell', x0, x1, base, height) a bell curve   ('cv', [(x, y), ...]) a free line
           the last number in a mark, when it is a float in 0..1, is where in the line it lands (default 0.35)
beats.py:  from storyboard import play;  def script(B, rng): play(B, rng, HERE)"""
import importlib.util, json, math, os, re, sys, wave

HERE = os.path.dirname(os.path.abspath(__file__))
THEMES = os.path.join(os.path.dirname(HERE), 'themes')


def _load(path):
    spec = importlib.util.spec_from_file_location('book_script', path)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


def syllables(s):
    return len(re.findall(r'[가-힣0-9]', s))


_CREDITS = {}


def photo_credit(path):
    """'author, licence' for a picture, from the CREDITS.md in its folder ('## Footer credits' lines '- `f`: 사진: A, L',
    or file lines '- `f` — "title" (what) — author — [licence](url) — …'). None when the file is not listed."""
    d, f = os.path.dirname(os.path.abspath(path)), os.path.basename(path)
    if d not in _CREDITS:
        c = {}; cp = os.path.join(d, 'CREDITS.md')
        for ln in (open(cp).read().splitlines() if os.path.exists(cp) else []):
            m1 = re.match(r'-\s*`([^`]+)`:\s*사진:\s*(.+)$', ln)
            if m1: c[m1.group(1)] = m1.group(2).strip(); continue
            m2 = re.match(r'-\s*`([^`]+)`\s*—\s*".*?"\s*\(.*?\)\s*—\s*(.+?)\s*—\s*\[([^\]]+)\]', ln)
            if m2 and m2.group(1) not in c: c[m2.group(1)] = f'{m2.group(2).strip()}, {m2.group(3).strip()}'
        _CREDITS[d] = c
    return _CREDITS[d].get(f)


def split_sentences(t):
    """'A. B? C.' -> ['A.', 'B?', 'C.'] — a sentence of fewer than 6 syllables stays with the next one"""
    raw = [x for x in re.split(r'(?<=[.?!])\s+', t.strip()) if x]
    out = []
    for x in raw:
        if out and syllables(out[-1]) < 6: out[-1] = out[-1] + ' ' + x
        else: out.append(x)
    if len(out) > 1 and syllables(out[-1]) < 6:
        last = out.pop(); out[-1] += ' ' + last
    return out


def compile_script(path):
    m = _load(path); d = os.path.dirname(os.path.abspath(path))
    keys = {k for _, _, k in m.SECTIONS}
    lines, story, n, page = [], [], 0, None
    for ev in m.SEQ:
        if isinstance(ev[0], str) and ev[0] in ('part', 'page', 'pause', 'think') and len(ev) == 2 and not isinstance(ev[1], dict):
            if ev[0] == 'page':
                assert ev[1] in m.PAGES, ev[1]; page = ev[1]
            story.append({'ev': ev[0], 'v': ev[1]}); continue
        text, o = ev[0], (ev[1] if len(ev) > 1 else {})
        n += 1
        if o.get('sec') and o['sec'] not in keys: raise SystemExit(f'k{n:03d}: unknown section {o["sec"]}')
        # a long line is voiced sentence by sentence (shorter takes are cleaner); its marks move to the sentence they land in
        parts_t, parts_s = split_sentences(text), split_sentences(o.get('say') or text)
        if len(parts_t) != len(parts_s) or o.get('tts'): parts_t, parts_s = [text], [o.get('say') or text]
        for i in range(len(parts_s) - 1, 0, -1):     # a sentence opening with 아/어 stays glued to the one before (the pad eats it)
            if re.match(r'^\s*[아어]', parts_s[i]):
                parts_s[i - 1] += ' ' + parts_s.pop(i); parts_t[i - 1] += ' ' + parts_t.pop(i)
        w = [max(1, syllables(x)) for x in parts_s]; edges = [sum(w[:i]) / sum(w) for i in range(len(w) + 1)]
        marks = [list(x) for x in o.get('m', [])]
        for i, (pt, ps) in enumerate(zip(parts_t, parts_s)):
            lid = f'k{n:03d}' + ('' if len(parts_t) == 1 else 'abcdefghij'[i])
            L = {'id': lid, 'who': 'main', 'text': pt, 'dir': o.get('dir', 'calm, close, explaining')}
            if ps != pt: L['say'] = ps
            for k in ('tts', 'j', 'sec'):
                if o.get(k) is not None: L[k] = o[k]
            if re.match(r'^\s*[아어]', ps): raise SystemExit(f'{lid} starts with 아/어 (merges with the pad): {pt}')
            lines.append(L)
            mine = []
            for mk in marks:
                f = _frac(mk)
                if edges[i] <= f < edges[i + 1] or (i == len(parts_t) - 1 and f >= edges[-1]):
                    loc = (f - edges[i]) / max(1e-6, edges[i + 1] - edges[i])
                    mine.append((mk[:-1] if isinstance(mk[-1], float) and 0 <= mk[-1] <= 1 else mk) + [round(min(0.95, loc), 3)])
            last = i == len(parts_t) - 1
            story.append({'ev': 'line', 'id': lid, 'page': page, 'm': mine, 'gaze': o.get('gaze', 'cam'),
                          'expr': o.get('expr'), 'gap': o.get('gap', 0.35) if last else 0.3})
    os.makedirs(os.path.join(d, 'pages'), exist_ok=True)
    # a picture that is not there yet (still being licensed) drops out of its page instead of failing the page build
    pdir = os.path.join(d, 'pages')
    def keep(img, pid):
        if img and not os.path.isfile(os.path.join(pdir, img)): print(f'  {pid}: no picture {img} (page without it)'); return ''
        return img
    for pid, P in m.PAGES.items():
        if P.get('image'):
            if not keep(P['image'], pid): P.pop('image')
        for side in ('left', 'right'):
            if isinstance(P.get(side), dict) and P[side].get('image'): P[side]['image'] = keep(P[side]['image'], pid)
    # every photo on a page carries its credit at the bottom (licence terms of CC BY): read from the CREDITS.md next to it
    for pid, P in m.PAGES.items():
        imgs = [P.get('image')] + [P[k].get('image') for k in ('left', 'right') if isinstance(P.get(k), dict)]
        cr = [c for c in (photo_credit(os.path.join(pdir, i)) for i in imgs if i) if c]
        if cr:
            line = '사진: ' + ' / '.join(dict.fromkeys(cr))
            foot = re.sub(r'\s*·?\s*사진:[^·]*|\s*·?\s*props/CREDITS\.md', '', P.get('foot', '')).strip(' ·')
            P['foot'] = (foot + ' · ' if foot else '') + line
    json.dump(lines, open(os.path.join(d, 'lines.json'), 'w'), ensure_ascii=False, indent=0)
    json.dump([dict(v, id=k) for k, v in m.PAGES.items()], open(os.path.join(d, 'pages', 'pages.json'), 'w'), ensure_ascii=False, indent=0)
    json.dump({'toc': m.TOC, 'story': story}, open(os.path.join(d, 'story.json'), 'w'), ensure_ascii=False)
    cov = []
    for part, sec, key in m.SECTIONS:
        ls = [l['id'] for l in lines if l.get('sec') == key]
        pg = sorted({s['page'] for s in story if s['ev'] == 'line' and s['id'] in ls and s['page']})
        cov.append({'part': part, 'section': sec, 'key': key, 'lines': ls, 'pages': pg})
    json.dump(cov, open(os.path.join(d, 'coverage.json'), 'w'), ensure_ascii=False, indent=0)
    unused = set(m.PAGES) - {s['v'] for s in story if s['ev'] == 'page'}
    print(f'lines {len(lines)}, syllables {sum(syllables(l.get("say") or l["text"]) for l in lines)}, pages {len(m.PAGES)}'
          + (f', unused pages {sorted(unused)}' if unused else ''))
    return lines


def fake_audio(lines, out):
    """takes of the right length for a dry build: syllables / 4 + 0.35 s, a voiced hum so the mouth moves"""
    import numpy as np
    os.makedirs(out, exist_ok=True); sr = 48000
    for L in lines:
        said = L.get('say') or L['text']; dur = round(syllables(said) / 4.0 + 0.35, 2)
        t = np.arange(int(sr * dur)) / sr
        a = 0.25 * np.sin(2 * math.pi * 190 * t) * (0.55 + 0.45 * np.sin(2 * math.pi * 4 * t)) ** 2
        with wave.open(os.path.join(out, L['id'] + '.wav'), 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((a * 32767).astype(np.int16).tobytes())
        json.dump({'id': L['id'], 'who': L['who'], 'dur': dur, 'said': re.sub(r'\[[^\]]+\]', '', said)}, open(os.path.join(out, L['id'] + '.json'), 'w'), ensure_ascii=False)


# ------------------------------------------------------------------------------------------------ playing it (beats)
def _frac(mk, default=0.35):
    x = mk[-1]
    return float(x) if isinstance(x, float) and 0 <= x <= 1 else default


def _mark(K, mk, bx):
    k = mk[0]; M = bx.get('marks') or []; I = bx.get('items') or []
    if k == 'u': return K.underline(M[mk[1]])
    if k == 'uu': return K.underline(M[mk[1]], double=True)
    if k == 'c': return K.circle(M[mk[1]], seed=mk[1])
    if k == 'x': return K.cross(M[mk[1]])
    if k == 's': return K.strike(M[mk[1]])
    if k == 'bx': return K.box(M[mk[1]])
    if k == 'h': return K.underline(bx['head'], pad=2, gap=4)
    if k == 'cb': return K.circle(bx['big'], pad=10)
    if k == 'ct': return K.box(bx['title'], pad=6)
    if k == 'ci': return K.circle(I[mk[1]], pad=6, seed=mk[1])
    if k == 'ui': return K.underline(I[mk[1]])
    if k == 'ti': b = I[mk[1]]; return K.tick(b['x'] + b['w'] + 14, b['y'] + b['h'] * 0.55)
    if k == 'xi': return K.cross(I[mk[1]], pad=2)
    if k == 'bimg': return K.box(bx['images'][mk[1]], pad=6)
    if k == 'a': return K.arrow((mk[1], mk[2]), (mk[3], mk[4]))
    if k == 'n': return K.note(mk[1], mk[2], mk[3])
    if k == 'bell':
        from marks import bell
        return K.curve(bell(mk[1], mk[2], mk[3], mk[4]))
    if k == 'cv': return K.curve([tuple(p) for p in mk[1]])
    raise ValueError(mk)


def play(B, rng, book_dir, first_at=1.2):
    """drive the Builder from story.json: page turns (Ctrl+A, Delete, paste), lines, marks on their words, parts"""
    from marks import Marker
    S = json.load(open(os.path.join(book_dir, 'story.json')))
    rel = os.path.relpath(os.path.join(book_dir, 'pages', 'out'), THEMES).replace(os.sep, '/')
    lines = {l['id']: l for l in json.load(open(os.path.join(book_dir, 'lines.json')))}
    boxes = {}
    K = Marker(B)
    B.t = first_at; min_next = 0.0; turned = 0; last_end = 0.0; pending_part = None
    for ev in S['story']:
        e = ev['ev']
        if e == 'part': pending_part = ev['v']        # lit when the part's first page lands, not while the last page is still up
        elif e == 'pause': B.t += ev['v']
        elif e == 'think':
            B.think.append((B.t, B.t + ev['v'])); B.gaze.append((B.t, B.t + ev['v'], 'think', 'main')); B.t += ev['v']
        elif e == 'page':
            pid = ev['v']; boxes[pid] = json.load(open(os.path.join(book_dir, 'pages', 'out', pid + '.boxes.json')))
            t_go = max(last_end - 0.6, B.hand_t) if turned else 0.4   # the hand starts on the last words of the page before
            B.hand_at(t_go)
            if turned: B.clear_canvas()
            t_img = B.paste_image(f'{rel}/{pid}.png', 0, 0, 1100, 700, hold=0.45)
            if pending_part is not None: B.chapter(pending_part, at=t_img); pending_part = None
            K._pen()                                                    # the red pencil, ready before the first mark
            B.gaze.append((t_go, t_img + 0.5, 'screen', 'main'))
            min_next = t_img - 1.4 if turned else 0.0                   # she keeps talking while the page lands
            turned += 1; page = pid
        elif e == 'line':
            L = lines[ev['id']]
            at = max(B.t, min_next)
            t0, t1 = B.say(ev['id'], gap=ev['gap'], gaze=ev['gaze'], expr=ev['expr'], at=at)
            last_end = t1
            for m_ in re.finditer(r'\[(laughs[^\]]*)\]', L.get('tts') or ''):
                before = re.sub(r'<[^>]+>|\[[^\]]+\]', '', L['tts'][:m_.start()])
                B.laughs.append((t0 + (t1 - t0) * syllables(before) / max(1, syllables(L['text'])), 'main', 0.75 if 'softly' in m_.group(1) else 1.0))
            for mk in ev['m']:
                tm = t0 + (t1 - t0) * _frac(mk)
                B.hand_at(tm); h0 = B.hand_t
                tend = _mark(K, mk, boxes[ev['page']])
                B.gaze.append((h0 - 0.2, (tend or B.hand_t) + 0.25, 'screen', 'main'))
    B.t = max(B.t, B.hand_t) + 0.5
    return B.t


def check_marks(book_dir):
    """every mark must point at a box its page really has (run after pages.mjs): prints the line, the mark and the marked text"""
    S = json.load(open(os.path.join(book_dir, 'story.json'))); L = {l['id']: l for l in json.load(open(os.path.join(book_dir, 'lines.json')))}
    bad = 0
    for ev in S['story']:
        if ev['ev'] != 'line' or not ev['m']: continue
        bx = json.load(open(os.path.join(book_dir, 'pages', 'out', ev['page'] + '.boxes.json')))
        for mk in ev['m']:
            k = mk[0]; lst = {'u': 'marks', 'uu': 'marks', 'c': 'marks', 'x': 'marks', 's': 'marks', 'bx': 'marks', 'ci': 'items', 'ui': 'items', 'ti': 'items', 'xi': 'items', 'bimg': 'images'}.get(k)
            one = {'h': 'head', 'cb': 'big', 'ct': 'title'}.get(k)
            if lst and not (isinstance(mk[1], int) and mk[1] < len(bx.get(lst) or [])):
                bad += 1; print('BAD', ev['page'], ev['id'], mk, '|', L[ev['id']]['text'][:50], '| has', len(bx.get(lst) or []), lst)
            elif one and not bx.get(one):
                bad += 1; print('BAD', ev['page'], ev['id'], mk, '| page has no', one)
    print('marks checked, bad', bad)
    return bad


if __name__ == '__main__':
    p = sys.argv[1]
    if '--check' in sys.argv: sys.exit(1 if check_marks(os.path.dirname(os.path.abspath(p))) else 0)
    ls = compile_script(p)
    if '--fake' in sys.argv: fake_audio(ls, sys.argv[sys.argv.index('--fake') + 1]); print('fake takes', len(ls))
