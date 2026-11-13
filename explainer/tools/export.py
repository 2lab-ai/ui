"""Export: mix (music ducked under voice), stills, the MP4 (Playwright frames -> ffmpeg, parallel slices) and the
audiobook (the mix as an M4A with one chapter marker per scene, plus out/chapters.txt for the YouTube description).
usage: python export.py mix | stills [t1 t2 ...] | video [--slices N] [--from T --to T --out name]
                        | audiobook [--cover still.jpg] [--out name] | srt [--out name] | cover [--at T] [--out name]
cover: the YouTube thumbnail as out/cover.jpg (1280x720, under 2 MB) from scenes.js COVER (REFERENCE §10), plus
out/cover_b.jpg / cover_c.jpg from COVER_B / COVER_C for Test & Compare; without COVER,
the still at --at T. out/cover_check.jpg shows it at 1280, 320 and 168 px wide: the cover must read at 168 px (the size
of a search result on a phone).
srt: the subtitles as out/<slug>.srt (one cue per sentence, its `text`) for the YouTube caption track — docent videos
do not burn them in (project.json "subtitles": "off")."""
import asyncio, base64, json, os, subprocess, sys, threading, http.server, functools, socketserver

HERE = os.getcwd()   # the project folder (video.html, timeline.json, narration.wav, score.wav)
OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
FPS = 30

def total():
    return json.load(open(os.path.join(HERE, 'timeline.json')))['total']

def open_gaps(T, min_gap=1.2):
    """Stretches with no voice for >= min_gap s (before the first sentence, between sentences, after the last)."""
    sents = sorted((s['start'], s['end']) for sc in json.load(open(os.path.join(HERE, 'timeline.json')))['scenes'] for s in sc['sentences'])
    gaps, prev = [], 0.0
    for a, b in sents + [(T + 10, T + 10)]:
        if a - prev >= min_gap: gaps.append((prev, min(a, T + 10)))
        prev = max(prev, b)
    return gaps

def open_envelope(T, lift_db=6.0):
    """ffmpeg volume expression: 1 under the voice, 10^(lift/20) in open gaps; 0.6 s rise after the voice stops, back
    down 0.25 s before it starts again."""
    k = 10 ** (lift_db / 20) - 1
    terms = [f"clip((t-{a + 0.15:.2f})/0.6,0,1)*clip(({b - 0.25:.2f}-t)/0.5,0,1)" for a, b in open_gaps(T) if b - a >= 1.2]
    return f"1+{k:.3f}*({'+'.join(terms)})" if terms else '1'

def mix():
    T = total()
    # Docent scores from score.py (score.json beside score.wav, cues at -20 LUFS): music ~20 dB under the voice while it
    # speaks, gentle ~4 dB swells in the gaps (research 2026-11-10: ratio 6 / release 600 ms pumped 8-15 dB between
    # sentences; this setting measured 20.4-21.6 dB under, 3.9-4.4 dB swell on 3 probes). music.py scores keep the
    # original balance.
    sj, sw = os.path.join(HERE, 'score.json'), os.path.join(HERE, 'score.wav')
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from score import wav_sig
        sjd = json.load(open(sj)); gentle = sjd.get('score_wav') == wav_sig(sw); library = gentle and sjd.get('kind') == 'library'
    except Exception: gentle = library = False
    print('mix: ' + (('library score (library_score.py)' if library else 'docent score (score.py)') + ': gentle ducking, music ~20 dB under the voice' if gentle else 'classic ducking (music.py score)'))
    vol, duck = (0.20, 'threshold=0.05:ratio=2.5:attack=150:release=1200') if gentle else (0.42, 'threshold=0.03:ratio=6:attack=40:release=600')
    # Docent scores also breathe with the picture: in every open stretch (title cards, chapter breaks, the end; a gap of
    # >= 1.2 s between sentences) the music rises +6 dB and settles back 0.25 s before the voice returns, and the end
    # fades over 1.5 s (2026-11-10 review: the bed was flat, near-silent on title cards and gone in the last seconds).
    # library_score.py beds (recorded music, denser than the MIDI cues) sit lower under the voice, so their open
    # stretches lift +10.5 dB to reach the same ~-30 dBFS on title cards (2026-11-10: +6 dB left them at -33.5, +9 at -30.8)
    env, fade = (open_envelope(T, 10.5 if library else 6.0), 1.5) if gentle else ('1', 4.0)
    flt = (f"[1:a]aformat=channel_layouts=stereo,volume={vol},volume='{env}':eval=frame,afade=t=out:st={T-fade:.2f}:d={fade}[m];"
           f"[0:a]aformat=channel_layouts=stereo,asplit=2[v][sc];"
           f"[m][sc]sidechaincompress={duck}[md];"
           f"[v][md]amix=inputs=2:normalize=0,volume=1.41,alimiter=limit=0.95[out]")
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(HERE, 'narration.wav'), '-i', os.path.join(HERE, 'score.wav'),
                    '-filter_complex', flt, '-map', '[out]', '-t', f'{T:.3f}', '-ar', '48000', os.path.join(HERE, 'mix.wav')], check=True)
    print('mix.wav', T)

def _meta_escape(v):
    """ffmetadata values: escape = ; # \\ and newlines with a backslash."""
    return ''.join('\\' + c if c in '=;#\\\n' else c for c in str(v))

def chapter_title(sc):
    """'2 · 의미 없는 게임' chips already carry the number; a scene title is added when it says more."""
    chip, title = sc.get('chip') or '', sc.get('title') or ''
    return f'{chip} — {title}' if title and title not in chip else (chip or title)

def chapters_meta(tl, pj):
    """timeline.json + project.json -> ffmetadata text with one [CHAPTER] per scene (milliseconds)."""
    book = pj.get('book') or {}
    head = [';FFMETADATA1', f"title={_meta_escape(pj.get('title') or tl.get('title') or 'explainer')}",
            f"artist={_meta_escape(book.get('author') or pj.get('narrator') or 'soma-voice')}",
            f"album={_meta_escape(book.get('title') or pj.get('title') or '')}", 'genre=Audiobook']
    out = head[:]
    scenes = tl['scenes']
    for i, sc in enumerate(scenes):
        a = int(round(sc['start'] * 1000))
        b = int(round((scenes[i + 1]['start'] if i + 1 < len(scenes) else tl['total']) * 1000))
        b = max(a, b)   # ffmpeg rejects the whole file if a chapter ends before it starts
        out += ['[CHAPTER]', 'TIMEBASE=1/1000', f'START={a}', f'END={b}', f'title={_meta_escape(chapter_title(sc))}']
    return '\n'.join(out) + '\n'

def youtube_chapters(tl):
    """'0:00 title' lines (YouTube needs the first at 0:00 and at least 10 s per chapter)."""
    lines = []
    for i, sc in enumerate(tl['scenes']):
        t = 0 if i == 0 else int(round(sc['start']))
        h, m, s_ = t // 3600, t // 60 % 60, t % 60
        stamp = f'{h}:{m:02d}:{s_:02d}' if h else f'{m}:{s_:02d}'
        lines.append(f'{stamp} {chapter_title(sc)}')
    return '\n'.join(lines) + '\n'

def audiobook(cover=None, name=None):
    tl = json.load(open(os.path.join(HERE, 'timeline.json')))
    pj_path = os.path.join(HERE, 'project.json')
    pj = json.load(open(pj_path)) if os.path.exists(pj_path) else {}
    name = name or pj.get('slug', 'explainer')
    meta = os.path.join(OUT, 'chapters.ffmeta'); open(meta, 'w', encoding='utf-8').write(chapters_meta(tl, pj))
    open(os.path.join(OUT, 'chapters.txt'), 'w', encoding='utf-8').write(youtube_chapters(tl))
    dst = os.path.join(OUT, f'{name}.m4a')
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(HERE, 'mix.wav'), '-i', meta]
    if cover: cmd += ['-i', cover]
    cmd += ['-map', '0:a', '-map_metadata', '1', '-map_chapters', '1']
    if cover: cmd += ['-map', '2:v', '-c:v', 'mjpeg', '-disposition:v:0', 'attached_pic']
    cmd += ['-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', dst]
    subprocess.run(cmd, check=True)
    print(dst, f"{len(tl['scenes'])} chapters", os.path.join(OUT, 'chapters.txt'))

def srt(name=None):
    """out/<slug>.srt: one cue per sentence (the subtitle `text`), timed from timeline.json."""
    tl = json.load(open(os.path.join(HERE, 'timeline.json')))
    name = name or json.load(open(os.path.join(HERE, 'project.json'))).get('slug', 'explainer')
    def ts(x):   # whole milliseconds first, then split: 1.9996 s is 00:00:02,000, not 00:00:01,000 (trinity review)
        ms = int(round(x * 1000)); return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
    cues = [(s['start'], s.get('end', s['start'] + s['dur']), s['text']) for sc in tl['scenes'] for s in sc['sentences']]
    path = os.path.join(OUT, f'{name}.srt')
    with open(path, 'w', encoding='utf-8') as f:
        for i, (a, b, text) in enumerate(cues, 1): f.write(f"{i}\n{ts(a)} --> {ts(b)}\n{text}\n\n")
    print(path, f'{len(cues)} cues')

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def serve():
    handler = functools.partial(Quiet, directory=HERE)
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), handler); srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]

async def open_page(pw, port):
    browser = await pw.chromium.launch(args=['--disable-gpu-vsync', '--force-color-profile=srgb'])
    page = await browser.new_page(viewport={'width': 1920, 'height': 1080}, device_scale_factor=1)
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    await page.goto(f'http://127.0.0.1:{port}/video.html?export=1')
    await page.wait_for_function('window.READY === true', timeout=60000)
    return browser, page, errs

async def frame_jpeg(page, t, q=0.93):
    b64 = await page.evaluate("([t, q]) => { renderAt(t); return document.getElementById('c').toDataURL('image/jpeg', q).slice(23); }", [t, q])
    return base64.b64decode(b64)

async def stills(times, prefix='still'):
    from playwright.async_api import async_playwright
    srv, port = serve()
    async with async_playwright() as pw:
        browser, page, errs = await open_page(pw, port)
        paths = []
        for t in times:
            p = os.path.join(OUT, f'{prefix}_{t:07.2f}.jpg'); open(p, 'wb').write(await frame_jpeg(page, t)); paths.append(p)
        miss = await page.evaluate('window.missingCues()')
        await browser.close()
    srv.shutdown()
    if errs: print('PAGE ERRORS:', errs)
    if miss: print('MISSING CUES:', miss)
    print('\n'.join(paths))

async def cover(at=None, name='cover'):
    from playwright.async_api import async_playwright
    srv, port = serve()
    async with async_playwright() as pw:
        browser, page, errs = await open_page(pw, port)
        jobs = []
        for fn, nm in (('COVER', name), ('COVER_B', name + '_b'), ('COVER_C', name + '_c')):
            drew = await page.evaluate("(fn) => typeof renderCover === 'function' && renderCover(fn)", fn)
            if not drew:
                if fn != 'COVER': continue
                if at is None: sys.exit('cover: scenes.js has no COVER and no --at T was given (REFERENCE §10)')
                await page.evaluate("(t) => renderAt(t)", at)
            rep = await page.evaluate("() => typeof coverReport === 'function' ? coverReport() : null") if drew else None
            jobs.append((nm, rep, await page.evaluate("() => document.getElementById('c').toDataURL('image/png').slice(22)")))
        await browser.close()
    srv.shutdown()
    if errs: print('PAGE ERRORS:', errs)
    for nm, rep, b64 in jobs: save_cover(nm, rep, b64)

def save_cover(name, rep, b64):
    big = os.path.join(OUT, f'{name}_1920.png'); open(big, 'wb').write(base64.b64decode(b64))
    path = os.path.join(OUT, f'{name}.jpg')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', big, '-vf', 'scale=1280:720:flags=lanczos', '-q:v', '2', path], check=True)
    check = os.path.join(OUT, f'{name}_check.jpg')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', big, '-filter_complex',
                    '[0]scale=1280:720:flags=lanczos[a];[0]scale=320:180:flags=lanczos,pad=320:720:0:0:white[b];'
                    '[0]scale=168:94:flags=lanczos,pad=168:720:0:0:white[c];[a][b][c]hstack=inputs=3', '-q:v', '3', check], check=True)
    warns = cover_warnings(rep)
    if corner_ink(big) > 0.004: warns.append('ink in the bottom-right corner: YouTube draws the running time there')
    bare = page_share(big)
    if bare > PAGE_MAX: warns.append(f'{100 * bare:.0f} % of the cover is bare page (keep ≤ {100 * PAGE_MAX:.0f} %): make the subject '
                                      'bigger, or give the thing that carries the tension a solid fill (ink, or the one MARK accent)')
    os.remove(big)
    size = os.path.getsize(path)
    if size >= 2 * 1024 * 1024: sys.exit(f'cover: {path} is {size} bytes; YouTube takes under 2 MB')
    for w in warns: print(f'WARNING {name}:', w)
    print(path); print(check)

def cover_warnings(rep):
    """REFERENCE §10 limits, from what COVER drew: ≤ 8 characters of cover text, text ≥ 160 px tall at 1080p (≈ 14 px at
    168 px wide), ink spanning ≥ half the height (one big subject, not a small figure on an empty page)."""
    if not rep: return []
    out, texts = [], rep.get('texts') or []
    if not texts: out.append('no coverText(): a cover without words gave reviewers nothing to read at 168 px (research 2026-11-14)')
    total = sum(t['chars'] for t in texts)
    if total > 8: out.append(f"cover text is {total} characters in all ({' / '.join(t['str'] for t in texts)}): keep ≤ 8, it must read at 168 px")
    for t in texts:
        if t['size'] < 160: out.append(f"\"{t['str']}\" is {t['size']} px (use 200-320 at 1080p; under 160 it blurs at 168 px)")
    ink = rep.get('ink')   # the drawing only: coverText() words are not counted
    if not ink: out.append('nothing drawn but words: one subject (a figure doing the hook\'s verb, or one object) must fill ≥ 50 % of the height')
    if ink and (ink[3] - ink[1]) < 0.5 * rep['H']: out.append(f"ink spans {100 * (ink[3] - ink[1]) / rep['H']:.0f} % of the height (make the subject bigger: ≥ 50 %)")
    if ink and (ink[1] < 12 or ink[0] < 12 or ink[2] > rep['W'] - 12):
        out.append('something touches the top or a side edge: a head or a stem cut by the frame reads as something else (only the bottom edge may cut the subject)')
    return out

def corner_ink(png):
    """Share of the bottom-right 330 × 140 px of a 1920 × 1080 cover (where YouTube draws the running time) that is not
    page: measured against the cover's own page colour, so a dark page (mono-black) is not counted as ink."""
    from PIL import Image
    im = Image.open(png).convert('RGB'); w, h = im.size
    pr, pg, pb = page_colour(im)
    b = im.crop((w - int(330 * w / 1920), h - int(140 * h / 1080), w, h)).tobytes()
    px = [(b[i], b[i + 1], b[i + 2]) for i in range(0, len(b), 3)]
    return sum(abs(r - pr) + abs(g - pg) + abs(bl - pb) >= 60 for r, g, bl in px) / max(1, len(px))

PAGE_MAX = 0.75   # verification 2026-11-14: covers with 77-84 % bare page scored focal 3-4 of 5; the one at 65 % scored 5

def page_colour(im):
    """The cover's page: its most common colour (5-bit bins) on a 320 × 180 copy."""
    from collections import Counter
    b = im.convert('RGB').resize((320, 180)).tobytes()
    return tuple(c * 8 + 4 for c in Counter((b[i] >> 3, b[i + 1] >> 3, b[i + 2] >> 3) for i in range(0, len(b), 3)).most_common(1)[0][0])

def page_share(png):
    """Share of a cover that is bare page: pixels within a small distance of its most common colour, on a 320 × 180 copy.
    Pale fills count as page: at 168 px wide they vanish into it (fills measured 1.45:1 against the page)."""
    from PIL import Image
    im = Image.open(png).convert('RGB')
    pr, pg, pb = page_colour(im)
    b = im.resize((320, 180)).tobytes()
    px = [(b[i], b[i + 1], b[i + 2]) for i in range(0, len(b), 3)]
    return sum(abs(r - pr) + abs(g - pg) + abs(bl - pb) < 40 for r, g, bl in px) / len(px)

async def render_slice(port, f0, f1, path):
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        browser, page, errs = await open_page(pw, port)
        enc = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-',
                                '-vf', 'scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p',
                                '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-color_range', 'tv',
                                '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-r', str(FPS), path], stdin=subprocess.PIPE)
        for i in range(f0, f1):
            enc.stdin.write(await frame_jpeg(page, i / FPS))
        enc.stdin.close(); enc.wait()
        miss = await page.evaluate('window.missingCues()')
        await browser.close()
        if errs: print('PAGE ERRORS', path, errs[:3])
        if miss: print('MISSING CUES', path, miss[:10])

async def video(slices=12, t_from=0.0, t_to=None, name=None):
    name = name or json.load(open(os.path.join(HERE, 'project.json'))).get('slug', 'explainer')
    T = total() if t_to is None else t_to
    f_from, f_to = int(round(t_from * FPS)), int(round(T * FPS))
    srv, port = serve()
    n = f_to - f_from; step = (n + slices - 1) // slices
    parts = []
    jobs = []
    for k in range(slices):
        a = f_from + k * step; b = min(f_to, a + step)
        if a >= b: break
        p = os.path.join(OUT, f'part_{k:02d}.mp4'); parts.append(p)
        jobs.append(render_slice(port, a, b, p))
    await asyncio.gather(*jobs)
    srv.shutdown()
    lst = os.path.join(OUT, 'parts.txt'); open(lst, 'w').write(''.join(f"file '{os.path.basename(p)}'\n" for p in parts))  # relative: no quoting issues
    silent = os.path.join(OUT, 'silent.mp4')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', silent], check=True)
    final = os.path.join(OUT, f'{name}.mp4')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', silent, '-ss', f'{t_from:.3f}', '-t', f'{T - t_from:.3f}', '-i', os.path.join(HERE, 'mix.wav'),
                    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', final], check=True)
    for p in parts: os.remove(p)
    os.remove(silent); os.remove(lst)
    print(final)

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'mix': mix()
    elif cmd == 'stills': asyncio.run(stills([float(x) for x in sys.argv[2:]]))
    elif cmd == 'video':
        args = sys.argv[2:]; kw = {}
        if '--slices' in args: kw['slices'] = int(args[args.index('--slices') + 1])
        if '--from' in args: kw['t_from'] = float(args[args.index('--from') + 1])
        if '--to' in args: kw['t_to'] = float(args[args.index('--to') + 1])
        if '--out' in args: kw['name'] = args[args.index('--out') + 1]
        asyncio.run(video(**kw))
    elif cmd == 'cover':
        args = sys.argv[2:]
        asyncio.run(cover(at=float(args[args.index('--at') + 1]) if '--at' in args else None,
                          name=args[args.index('--out') + 1] if '--out' in args else 'cover'))
    elif cmd == 'srt':
        args = sys.argv[2:]; srt(name=args[args.index('--out') + 1] if '--out' in args else None)
    elif cmd == 'audiobook':
        args = sys.argv[2:]
        audiobook(cover=args[args.index('--cover') + 1] if '--cover' in args else None,
                  name=args[args.index('--out') + 1] if '--out' in args else None)
