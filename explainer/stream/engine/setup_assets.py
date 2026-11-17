"""Fetch everything the stream kit needs into the asset cache (~/.cache/2lab-stream, or $STREAM_CACHE). Idempotent.
usage: python setup_assets.py [--check]
Nothing here is committed to the repo: the Cubism Core is proprietary (never redistribute it), the Live2D samples and the
stock photos may be used but not re-published as files. Each streamer theme lists its own room files under "sources"."""
import glob, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import themes as TH

C = TH.CACHE
CORE = 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js'
SAMPLES = 'https://github.com/Live2D/CubismWebSamples.git'
SAMPLES_REV = 'b1de66b0b1f1cb881d95fb6158622aeb6a2827bd'   # the revision the kit was built on (Mao, Hiyori)
NODE_DEPS = {'pixi.js': '6.5.10', 'pixi-live2d-display': '0.4.0', 'playwright': '^1.56.0'}
FONT = 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff2/Pretendard-{w}.woff2'
WEIGHTS = ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold']
# the edit's caption faces (edit/cut.py), all SIL OFL 1.1 from google/fonts: a heavy display face for corner labels and shouts,
# a round face for state labels and the extra, a handwriting face for the editor's narration, a serif for the thesis card
GF = 'https://raw.githubusercontent.com/google/fonts/main/ofl/'
EDIT_FONTS = {'BlackHanSans-Regular.ttf': GF + 'blackhansans/BlackHanSans-Regular.ttf', 'Jua-Regular.ttf': GF + 'jua/Jua-Regular.ttf',
              'NanumPenScript-Regular.ttf': GF + 'nanumpenscript/NanumPenScript-Regular.ttf',
              'NanumMyeongjo-ExtraBold.ttf': GF + 'nanummyeongjo/NanumMyeongjo-ExtraBold.ttf'}
# the SoundFont edit/jingles.py plays the signature-jingle candidates on (MuseScore General, MIT, ~215 MB); fluidsynth renders it
SF2 = 'https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/MuseScore_General.sf2'
UA = {'User-Agent': 'Mozilla/5.0 (2lab stream kit setup)'}


def get(url, dst):
    if os.path.exists(dst) and os.path.getsize(dst) > 0: return False
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.run(['curl', '-fsSL', '--retry', '2', '-A', UA['User-Agent'], '-o', dst + '.part', url], check=True)   # curl: redirects + CDNs that refuse urllib
    os.replace(dst + '.part', dst)
    print('got', os.path.relpath(dst, C), f'{os.path.getsize(dst) // 1024} KB'); return True


def fit(path, spec):
    """crop a photo to the stage aspect, optionally mirror it, resize, then grade (theme "fit"; order matters)"""
    from PIL import Image, ImageEnhance, ImageFilter, ImageOps
    im = Image.open(path).convert('RGB')
    if spec.get('mirror'): im = ImageOps.mirror(im)
    if spec.get('box'): im = im.crop(tuple(spec['box']))   # an explicit framing (pixels of the mirrored source)
    else:
        w, h = im.size; aw, ah = spec.get('aspect', [16, 9]); ch = int(w * ah / aw)
        if ch <= h:
            top = (h - ch) // 2 + spec.get('offset_y', 0); top = max(0, min(h - ch, top)); im = im.crop((0, top, w, top + ch))
    im = im.resize(tuple(spec.get('size', [1920, 1080])), Image.LANCZOS)
    if spec.get('color'): im = ImageEnhance.Color(im).enhance(spec['color'])
    if spec.get('rgb_gain'):
        im = Image.merge('RGB', [c.point(lambda v, g=g: min(255, int(v * g))) for c, g in zip(im.split(), spec['rgb_gain'])])
    if spec.get('unsharp'): im = im.filter(ImageFilter.UnsharpMask(**spec['unsharp']))
    if spec.get('brightness'): im = ImageEnhance.Brightness(im).enhance(spec['brightness'])
    im.save(path, quality=92)


def models_needed():
    out = set()
    for f in glob.glob(os.path.join(TH.THEMES, 'streamer', '*', 'theme.json')):
        for c in json.load(open(f))['cast'].values():
            p = c['model']
            if p.startswith('cache:cubism/Samples/Resources/'): out.add(p.split('/')[3])
    return sorted(out)


def setup():
    os.makedirs(C, exist_ok=True)
    get(CORE, os.path.join(C, 'live2dcubismcore.min.js'))
    cub = os.path.join(C, 'cubism')
    if not os.path.isdir(os.path.join(cub, '.git')):
        subprocess.run(['git', 'clone', '-q', '--filter=blob:none', '--sparse', SAMPLES, cub], check=True)
    subprocess.run(['git', '-C', cub, 'sparse-checkout', 'set'] + [f'Samples/Resources/{m}' for m in models_needed()], check=True)
    subprocess.run(['git', '-C', cub, 'checkout', '-q', SAMPLES_REV], check=True)
    nd = os.path.join(C, 'node')
    if not os.path.isdir(os.path.join(nd, 'node_modules', 'pixi-live2d-display')):
        os.makedirs(nd, exist_ok=True)
        json.dump({'name': 'stream-kit-cache', 'private': True, 'dependencies': NODE_DEPS}, open(os.path.join(nd, 'package.json'), 'w'), indent=1)
        subprocess.run(['npm', 'install', '--silent', '--no-audit', '--no-fund'], cwd=nd, check=True)
        subprocess.run(['npx', 'playwright', 'install', 'chromium'], cwd=nd, check=True)
    for w in WEIGHTS: get(FONT.format(w=w), os.path.join(C, 'fonts', 'pretendard', f'Pretendard-{w}.woff2'))
    for name, url in EDIT_FONTS.items(): get(url, os.path.join(C, 'fonts', 'edit', name))
    get(SF2, os.path.join(C, 'soundfonts', 'MuseScore_General.sf2'))
    for f in glob.glob(os.path.join(TH.THEMES, 'streamer', '*', 'theme.json')):
        for rel, src in json.load(open(f)).get('sources', {}).items():
            dst = os.path.join(C, rel)
            if get(src['url'], dst) and src.get('fit'): fit(dst, src['fit'])


def check():
    """exit 1 and list what is missing (the skill's preflight)"""
    need = [os.path.join(C, 'live2dcubismcore.min.js'), os.path.join(C, 'node', 'node_modules', 'pixi-live2d-display'), os.path.join(C, 'node', 'node_modules', 'playwright')]
    need += [os.path.join(C, 'cubism', 'Samples', 'Resources', m) for m in models_needed()]
    need += [os.path.join(C, 'fonts', 'pretendard', f'Pretendard-{w}.woff2') for w in WEIGHTS]
    need += [os.path.join(C, 'fonts', 'edit', name) for name in EDIT_FONTS] + [os.path.join(C, 'soundfonts', 'MuseScore_General.sf2')]
    for f in glob.glob(os.path.join(TH.THEMES, 'streamer', '*', 'theme.json')):
        need += [os.path.join(C, rel) for rel in json.load(open(f)).get('sources', {})]
    miss = [p for p in need if not os.path.exists(p)]
    for p in miss: print('missing', p)
    print('assets ok' if not miss else f'{len(miss)} missing: run python setup_assets.py')
    return 0 if not miss else 1


if __name__ == '__main__':
    sys.exit(check() if '--check' in sys.argv else (setup() or check()))
