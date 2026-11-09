"""Export: mix (music ducked under voice), stills, the MP4 (Playwright frames -> ffmpeg, parallel slices) and the
audiobook (the mix as an M4A with one chapter marker per scene, plus out/chapters.txt for the YouTube description).
usage: python export.py mix | stills [t1 t2 ...] | video [--slices N] [--from T --to T --out name]
                        | audiobook [--cover still.jpg] [--out name]"""
import asyncio, base64, json, os, subprocess, sys, threading, http.server, functools, socketserver

HERE = os.getcwd()   # the project folder (video.html, timeline.json, narration.wav, score.wav)
OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
FPS = 30

def total():
    return json.load(open(os.path.join(HERE, 'timeline.json')))['total']

def mix():
    T = total()
    flt = (f"[1:a]aformat=channel_layouts=stereo,volume=0.42,afade=t=out:st={T-4:.2f}:d=4[m];"
           f"[0:a]aformat=channel_layouts=stereo,asplit=2[v][sc];"
           f"[m][sc]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=600[md];"
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
        t = 0 if i == 0 else int(sc['start'])
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
        await browser.close()
        if errs: print('PAGE ERRORS', path, errs[:3])

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
    elif cmd == 'audiobook':
        args = sys.argv[2:]
        audiobook(cover=args[args.index('--cover') + 1] if '--cover' in args else None,
                  name=args[args.index('--out') + 1] if '--out' in args else None)
