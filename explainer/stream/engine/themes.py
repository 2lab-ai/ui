"""Theme loading: themes/<kind>/<id>/theme.json for kind in streaming | streamer | content.
An id may also be a path to a theme folder. The merged layout is the stage geometry the builder and the page share."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
KIT = os.path.dirname(HERE)
THEMES = os.path.join(KIT, 'themes')
CACHE = os.environ.get('STREAM_CACHE', os.path.expanduser('~/.cache/2lab-stream'))
KINDS = ('streaming', 'streamer', 'content')
DEFAULTS = {'streaming': 'default', 'streamer': 'kate', 'content': 'reading-book'}


def theme_dir(kind, ident):
    if os.path.isdir(ident): return os.path.abspath(ident)
    d = os.path.join(THEMES, kind, ident)
    if not os.path.isdir(d): raise SystemExit(f'no {kind} theme "{ident}" (looked in {d})')
    return d


def load_one(kind, ident):
    d = theme_dir(kind, ident)
    t = json.load(open(os.path.join(d, 'theme.json')))
    t['_dir'] = d; t['_id'] = os.path.basename(d)
    return t


def load(streaming=None, streamer=None, content=None):
    """-> {'streaming': {...}, 'streamer': {...}, 'content': {...}, 'layout': {...}}"""
    cfg = {k: load_one(k, v or DEFAULTS[k]) for k, v in zip(KINDS, (streaming, streamer, content))}
    lay = {'fps': 30, 'w': 1920, 'h': 1080}
    lay.update(cfg['content'].get('layout', {}))      # the activity on the left (Paint window, canvas, tool positions)
    lay.update(cfg['streaming'].get('layout', {}))    # chat box, title label
    lay.update(cfg['streamer'].get('layout', {}))     # where the main streamer and the extra stand
    cfg['layout'] = lay
    return cfg


def url(cfg_kind, rel):
    """a theme-relative file as the page sees it (render.mjs serves /themes/ and /cache/)"""
    if rel.startswith('cache:'): return '/cache/' + rel[6:]
    return '/themes/' + os.path.relpath(os.path.join(cfg_kind['_dir'], rel), THEMES).replace(os.sep, '/')


def cache_path(rel):
    """'cache:sfx/keys.mp3' -> absolute path in the asset cache"""
    return os.path.join(CACHE, rel[6:] if rel.startswith('cache:') else rel)


def stage_config(cfg):
    """what stage.js needs besides the per-frame arrays: overlay CSS, strings, background, models"""
    st, sr, ct = cfg['streaming'], cfg['streamer'], cfg['content']
    models = {}
    for role in ('main', 'sis'):
        m = sr['cast'].get(role)
        if not m: continue
        models[role] = {'model': url(sr, m['model']), 'hide_parts': m.get('hide_parts', []), 'tint': m.get('tint')}
    return {
        'css': [url(st, c) for c in st.get('css', [])] + [url(ct, c) for c in ct.get('css', [])],
        'strings': dict(st.get('strings', {})),
        'bg': url(st, st['room_still']) if st.get('room_still') else url(sr, sr['room']['background']),
        # a streaming theme may move the streamer to another room: a looping video behind her (frames in the asset cache)
        'bg_loop': st.get('room_loop'),
        'models': models,
    }
