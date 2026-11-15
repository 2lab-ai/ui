"""Scaffold or refresh an explainer video project from this repo.

    python explainer/tools/new_video.py <project_dir> [--theme mono-black|sketch|3b1b] [--from explainer/examples/<name>]
                                                    [--slug <file-name>] [--title "<title>"] [--docent]
                                                    [--format landscape|short]

- copies engine/engine.js, engine/docent.js and engine/video.html into the project (refreshing them is safe: scenes
  are untouched)
- writes theme.json. `mono-black` is the Modern Mono design of @2lab.ai/ui (src/core/tokens.json designs.modern-mono):
  near-black canvas, white type, colour only on the marks that mean something. `sketch` is the book-docent page: flat
  light-blue paper, black ink, purple handwritten keywords (Gaegu), for docent.js stick-figure videos. `3b1b` is the
  classic manim palette.
- fetches the theme's fonts into <project>/fonts (cached in ~/.cache/2lab-explainer-fonts)
- --from copies an example's script.json, scenes.js, formulas.py, project.json and img/ (only files the project lacks)
- fetches public-domain images listed in project.json "commons" (Wikimedia Commons titles) into <project>/img
- records the repo commit it was made from in project.json "ui_commit"
- a new sketch project (or --docent) gets project.json "colour": false (ink mode), "subtitles": "off", "chip": false
  and "concept": "letter" (the default concept; set "lecture" by hand): docent videos show the drawing in ink only,
  the narration goes to YouTube as captions (export.py srt)
- --format short writes project.json "format": "short": a vertical YouTube Short, 1080x1920 (frame.py). Without it a
  project renders at 1920x1080
- a docent project (sketch, or --docent) without a scenes.js gets a starter one: the sign title card and the letter
  cast block, the narrator ('me') and 오빠 ('oppa'), cast even when he is never drawn so no one else takes his look
  (TEMPLATES T1 and B; lint letter-cast)
"""
import json, os, shutil, subprocess, sys, tempfile, urllib.parse, urllib.request
from frame import frame_size

HERE = os.path.dirname(os.path.abspath(__file__))
EXPLAINER = os.path.dirname(HERE)
REPO = os.path.dirname(EXPLAINER)
UA = 'explainer-kit/1.0 (+https://github.com/2lab-ai/ui)'
FONT_CACHE = os.path.expanduser('~/.cache/2lab-explainer-fonts')
FONTS = {
    'Pretendard.ttf': 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/variable/PretendardVariable.ttf',
    'lmroman10-regular.otf': 'https://mirrors.ctan.org/fonts/lm/fonts/opentype/public/lm/lmroman10-regular.otf',
    'NotoSerifKR.ttf': 'https://github.com/google/fonts/raw/main/ofl/notoserifkr/NotoSerifKR%5Bwght%5D.ttf',
    'NotoSansKR.ttf': 'https://github.com/google/fonts/raw/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf',
    'Gaegu-Regular.ttf': 'https://github.com/google/fonts/raw/main/ofl/gaegu/Gaegu-Regular.ttf',   # OFL 1.1
    'Gaegu-Bold.ttf': 'https://github.com/google/fonts/raw/main/ofl/gaegu/Gaegu-Bold.ttf',
}


def blend(a, b, t):
    """mix #rrggbb a over b, t = share of a."""
    pa, pb = [int(a[i:i + 2], 16) for i in (1, 3, 5)], [int(b[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(x * t + y * (1 - t)):02x}' for x, y in zip(pa, pb))


def rgba(h, a):
    return f'rgba({int(h[1:3], 16)},{int(h[3:5], 16)},{int(h[5:7], 16)},{a})'


def theme(name):
    if name == '3b1b':
        return {'id': '3b1b', 'titleWeight': 500, 'colors': {}, 'fonts': {
            'text': 'LMRoman, NotoSerifKR, Georgia, serif', 'sans': 'NotoSansKR, "Apple SD Gothic Neo", sans-serif',
            'load': ['400 40px LMRoman', '400 40px NotoSerifKR', '500 40px NotoSerifKR', '500 40px NotoSansKR', '700 40px NotoSansKR']},
            'fontFiles': ['lmroman10-regular.otf', 'NotoSerifKR.ttf', 'NotoSansKR.ttf', 'Pretendard.ttf']}
    if name == 'sketch':
        # Book-docent page (docent.js): flat light-blue paper, black ink, purple handwritten keywords, red marks.
        # Measured from the Productive Peter reference (page #bcd0e8); hues darkened to read on the light page.
        ink = '#151515'
        hand = 'Gaegu, Pretendard, "Apple SD Gothic Neo", sans-serif'
        sans = 'Pretendard, "Apple SD Gothic Neo", sans-serif'
        return {'id': 'sketch', 'titleWeight': 700, 'fontFiles': ['Pretendard.ttf', 'Gaegu-Regular.ttf', 'Gaegu-Bold.ttf'],
                'fonts': {'text': hand, 'sans': sans, 'hand': hand,
                          'load': ['400 40px Gaegu', '700 40px Gaegu'] + [f'{w} 40px Pretendard' for w in (400, 500, 600, 700)]},
                'colors': {
                    'bg': '#bcd0e8', 'ink': ink, 'text': ink, 'white': ink, 'dim': '#4b5a70',
                    'grey': '#7d8ea8', 'track': '#5f7190', 'grid': '#aec3dd', 'gridFaint': '#b5c9e2',
                    'key': '#5a3ec8', 'blue': '#5a3ec8', 'purple': '#5a3ec8', 'magenta': '#c13fbf',
                    'yellow': '#c98a00', 'green': '#2e8b57', 'red': '#d2323c', 'orange': '#d9661c', 'teal': '#167f86',
                    'panel': 'rgba(250,251,253,0.92)', 'panelText': ink, 'boxFill': 'rgba(255,255,255,0.35)',
                    'paper': '#f6f3ea', 'paperLine': '#9fb2cc', 'paperInk': ink, 'paperMath': ink}}
    if name != 'mono-black': sys.exit(f'unknown theme {name} (mono-black | sketch | 3b1b)')
    t = json.load(open(os.path.join(REPO, 'src', 'core', 'tokens.json')))['designs']['modern-mono']
    bg, text, tert = t['bg'], t['text'], t['text-tertiary']
    sans = 'Pretendard, "Apple SD Gothic Neo", sans-serif'
    return {'id': 'mono-black', 'design': 'modern-mono', 'titleWeight': 600, 'fontFiles': ['Pretendard.ttf'],
            'fonts': {'text': sans, 'sans': sans, 'load': [f'{w} 40px Pretendard' for w in (400, 500, 600, 700)]},
            'colors': {
                # canvas and type
                'bg': bg, 'text': text, 'white': text, 'dim': t['text-secondary'],
                'grey': blend(tert, bg, 0.38), 'track': blend(tert, bg, 0.5), 'grid': t['surface'], 'gridFaint': t['surface-raised'],
                # concept colours: only on the marks that mean something (the design's semantic hues)
                'yellow': t['yellow'], 'green': t['green'], 'red': t['red'], 'orange': t['orange'],
                'blue': t['purple'],          # lavender: the design's one cool accent
                'teal': text, 'purple': text,  # secondary concepts go white, as the mono palette does
                # panels
                'panel': rgba(t['surface-raised'], 0.9), 'panelText': text, 'boxFill': rgba(text, 0.03),
                'paper': t['surface-raised'], 'paperLine': t['border'], 'paperInk': text, 'paperMath': text}}


STARTER = """// scenes.js — {title}. One draw function per scene id of script.json: SCENES.<id> = (t, q) => shots(t, [...]).
// First the cast block (TEMPLATES T1: one cast() per person, REFERENCE §2), then the assets the kit lacks (TEMPLATES A),
// then the scenes. A letter video always casts its narrator and 오빠, even when he is never drawn: his look stays his
// (lint cast-lookalike, letter-cast). The book shot: TEMPLATES B. The original's cover appears at least once in the
// video: the pair (realCoverPair, the original left, the Korean edition in front) on a desk line, where the line
// introduces the book; the other book shots may hold up the Korean edition alone (holdCover). A Korean original is the
// exception: its Korean cover is the original, shown alone (REFERENCE §4).
TITLE_CARD = signCard;
cast('me', { name: '나', hair: 'long', h: 0.94 });                          // the narrator: never tagged, never named
cast('oppa', { name: '오빠', hair: 'short', glasses: 'square', h: 1.08 });   // the listener: short hair + square glasses

// SCENES.s1 = (t, q) => shots(t, [
//   [q.s(0), (t, lt) => {   // both editions, once in the video: the pair on a desk drawn in lines, the original first
//     const top = 870 - 190;                                                    // lines are support, not a thing
//     inkLine(880, top, 1400, top, { w: 6, p: dp(lt, 0, 0.3) });
//     for (const x of [920, 1360]) inkLine(x, top, x, 870, { w: 4.4, p: dp(lt, 0.05, 0.3) });
//     const pr = realCoverPair('cover_<book>_<lang>', 'cover_<book>_ko', 1140, top, 360, { p: dp(lt, 0.1, 0.6) });
//     person('me', pr.x - 118 * 1.4 * CAST.me.h, 870, { s: 1.4, pose: 'reach', face: 'happy', p: dp(lt, 0, 0.5) });
//   }],
//   [q.s(1), (t, lt) => {   // she holds the Korean edition up while 오빠 looks
//     const me = person('me', 560, 870, { s: 1.5, pose: 'showBook', face: 'happy', p: dp(lt, 0, 0.5) });
//     holdCover(me, 'cover_<book>_ko', { h: 300, p: dp(lt, 0.1, 0.5) });
//     person('oppa', 1380, 870, { s: 1.5, flip: true, face: 'smile', p: dp(lt, 0.2, 0.5) });
//   }],
// ]);
"""


def write_starter(proj, title):
    """a docent project's starter scenes.js (only when it has none): True when written"""
    path = os.path.join(proj, 'scenes.js')
    if os.path.exists(path): return False
    with open(path, 'w', encoding='utf-8') as f: f.write(STARTER.replace('{title}', title))
    return True


def fetch(url, dst):
    """download to a unique temp file beside dst, check the length, then move into place atomically:
    an interrupted or short download never looks finished, and concurrent scaffolds do not collide."""
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    fd, tmp = tempfile.mkstemp(prefix=os.path.basename(dst) + '.', suffix='.part', dir=os.path.dirname(dst) or '.')
    try:
        with urllib.request.urlopen(req, timeout=120) as r, os.fdopen(fd, 'wb') as f:
            want = r.headers.get('Content-Length')
            shutil.copyfileobj(r, f)
            got = f.tell()
        if want is not None and got != int(want): raise IOError(f'{url}: got {got} of {want} bytes')
        if got == 0: raise IOError(f'{url}: empty response')
        os.replace(tmp, dst)
    finally:
        if os.path.exists(tmp): os.remove(tmp)


def commons(title, dst, width=1400):
    q = urllib.parse.urlencode({'action': 'query', 'titles': title, 'prop': 'imageinfo', 'iiprop': 'url|extmetadata',
                                'iiurlwidth': width, 'format': 'json'})
    req = urllib.request.Request('https://commons.wikimedia.org/w/api.php?' + q, headers={'User-Agent': UA})
    page = next(iter(json.load(urllib.request.urlopen(req, timeout=60))['query']['pages'].values()))
    info = page['imageinfo'][0]
    lic = info.get('extmetadata', {}).get('LicenseShortName', {}).get('value', '?')
    fetch(info.get('thumburl') or info['url'], dst)
    return lic


def main():
    a = sys.argv[1:]
    if not a or a[0].startswith('--'): sys.exit(__doc__)
    proj = os.path.abspath(a[0]); os.makedirs(proj, exist_ok=True)
    opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    th = theme(opt('--theme', 'mono-black'))
    src = opt('--from')
    if src:
        for f in ('script.json', 'scenes.js', 'formulas.py', 'project.json'):
            if os.path.exists(os.path.join(src, f)) and not os.path.exists(os.path.join(proj, f)):
                shutil.copy(os.path.join(src, f), proj)
        isrc = os.path.join(src, 'img')
        if os.path.isdir(isrc):   # the example's own images (docent-lab's book covers, project.json "images")
            os.makedirs(os.path.join(proj, 'img'), exist_ok=True)
            for f in os.listdir(isrc):
                if not os.path.exists(os.path.join(proj, 'img', f)): shutil.copy(os.path.join(isrc, f), os.path.join(proj, 'img', f))
    for f in ('engine.js', 'docent.js', 'video.html'):
        shutil.copy(os.path.join(EXPLAINER, 'engine', f), proj)
    json.dump({k: v for k, v in th.items() if k != 'fontFiles'}, open(os.path.join(proj, 'theme.json'), 'w'), indent=1)
    os.makedirs(os.path.join(proj, 'fonts'), exist_ok=True); os.makedirs(FONT_CACHE, exist_ok=True)
    for f in th['fontFiles']:
        c = os.path.join(FONT_CACHE, f)
        if not os.path.exists(c): fetch(FONTS[f], c)
        shutil.copy(c, os.path.join(proj, 'fonts', f))
    pj_path = os.path.join(proj, 'project.json')
    pj = json.load(open(pj_path)) if os.path.exists(pj_path) else {}
    # docent projects (the sketch page, or --docent for a mono-black book) start minimal like the reference: ink mode
    # ("colour": false), no burned subtitles (export.py srt -> YouTube captions) and no chapter chip. Only for a new
    # project or an explicit --docent: an older project's project.json has none of these keys, so refreshing its engine
    # keeps its colours, subtitles and chip.
    # "concept": "letter" too, the default concept (CONCEPTS): the lint's letter-cast needs it to fire (run-4 fix round:
    # no new project carried it, so the check that keeps 오빠's look never ran); "lecture" is set by hand
    if '--docent' in sys.argv or (th['id'] == 'sketch' and not pj.get('ui_commit')):
        pj.setdefault('colour', False); pj.setdefault('subtitles', 'off'); pj.setdefault('chip', False); pj.setdefault('concept', 'letter')
    if ('--docent' in sys.argv or th['id'] == 'sketch') and write_starter(proj, opt('--title') or pj.get('title') or os.path.basename(proj)):
        print(f'{proj}/scenes.js: the starter (TITLE_CARD = signCard, cast me + oppa: TEMPLATES T1 and B)')
    if opt('--slug'): pj['slug'] = opt('--slug')
    pj.setdefault('slug', os.path.basename(proj))
    if opt('--title'): pj['title'] = opt('--title')
    if opt('--format'): pj['format'] = opt('--format')
    try: w, h = frame_size(pj)
    except ValueError as e: sys.exit(str(e))
    pj['theme'] = th['id']
    try:
        pj['ui_commit'] = subprocess.run(['git', '-C', REPO, 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True).stdout.strip()
        if not pj['ui_commit'] and os.path.exists(os.path.join(REPO, 'KIT_COMMIT')):   # a frozen copy (git archive) carries its commit in a file
            pj['ui_commit'] = open(os.path.join(REPO, 'KIT_COMMIT')).read().split()[0]
        if subprocess.run(['git', '-C', REPO, 'status', '--porcelain', '--', 'explainer/engine'], capture_output=True, text=True).stdout.strip():
            pj['ui_commit'] += '+dirty'   # the engine copied has uncommitted edits: the commit alone does not describe it
    except OSError:
        pass
    imgs = pj.get('commons', {})
    if imgs:
        os.makedirs(os.path.join(proj, 'img'), exist_ok=True)
        for name, title in imgs.items():
            dst = os.path.join(proj, 'img', name + '.jpg')
            if not os.path.exists(dst):
                print(f'image {name}: {title} ({commons(title, dst)})')
        pj['images'] = list(dict.fromkeys(list(pj.get('images') or []) + list(imgs)))   # keep a project's own images (real covers)
    json.dump(pj, open(pj_path, 'w'), ensure_ascii=False, indent=1)
    print(f'{proj}: theme {th["id"]}, {w}x{h}, engine from {pj.get("ui_commit", "?")}')


if __name__ == '__main__':
    main()
