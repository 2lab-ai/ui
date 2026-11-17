"""Stream kit checks that need no GPU, network or voice: theme loading, the rubric, the IME, and a tiny build end to end.
run: python -m pytest explainer/stream/test_stream_kit.py   (or python explainer/stream/test_stream_kit.py)"""
import json, math, os, sys, tempfile, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'engine'))
import themes as TH
from hangul import simulate, keys_for


def test_every_theme_loads_and_the_defaults_compose():
    for kind in TH.KINDS:
        for ident in os.listdir(os.path.join(TH.THEMES, kind)):
            t = TH.load_one(kind, ident)
            assert t['_id'] == ident
    cfg = TH.load()
    for k in ('win', 'canvas', 'tools', 'chat', 'label', 'main', 'sis', 'fps'):
        assert k in cfg['layout'], k


def test_rubric_lines_of_the_default_themes_sum_to_100():
    cfg = TH.load()
    assert sum(p for kind in TH.KINDS for _, p in cfg[kind].get('review', [])) == 100


def test_streamer_cast_names_a_model_rig_and_voice_per_role():
    cast = TH.load_one('streamer', 'kate')['cast']
    for role in ('main', 'sis'):
        c = cast[role]
        assert c['model'].startswith('cache:') and c['voice'] and os.path.exists(os.path.join(HERE, 'engine', 'rigs', c['rig'] + '.py'))
    # owner (2026-11-17): the main streamer's head only sways a little while she talks
    assert cast['main']['motion']['talk_sway'] <= 0.5


def test_stage_config_points_into_the_served_roots():
    st = TH.stage_config(TH.load())
    assert st['bg'].startswith('/cache/') and all(c.startswith('/themes/') for c in st['css'])
    assert st['models']['main']['model'].endswith('.model3.json')


def test_ime_ends_on_the_intended_text():
    for text in ['아주 작은 습관의 힘', '매일 1%씩 1년이면?', '언니 바보 ㅋ']:
        states = simulate(keys_for(text))
        assert states[-1][0] + states[-1][1] == text


def _wav(path, sec):
    sr = 48000; t = np.arange(int(sr * sec)) / sr
    a = (0.3 * np.sin(2 * math.pi * 220 * t) * (0.5 + 0.5 * np.sin(2 * math.pi * 3 * t))).astype(np.float32)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((a * 32767).astype(np.int16).tobytes())


BEATS = '''
TAIL = 1.0
CLOCK0 = 22 * 3600
STREAM_TITLE = 'test'
REVIEW = {'keys': [['hello', ['line', 'a1']]], 'lip_main': 'a1'}
def script(B, rng):
    B.t = 0.5
    B.say('a1', gaze='cam', expr='smile')
    B.msg('x', 'ㅎㅇ', at=0.6)
    B.text_box(40, 40, size=34)
    B.type('가나', t0=B.t)
    B.commit_box()
    B.say('b1', gaze='cam', expr='sneaky')
'''


def test_tiny_build_writes_a_timeline_without_names():
    import build
    with tempfile.TemporaryDirectory() as d:
        audio = os.path.join(d, 'audio'); os.makedirs(audio)
        for lid, who, sec in [('a1', 'main', 1.2), ('b1', 'sis', 0.9)]:
            _wav(os.path.join(audio, lid + '.wav'), sec)
            json.dump({'id': lid, 'who': who, 'dur': sec, 'said': '안녕하세요'}, open(os.path.join(audio, lid + '.json'), 'w'), ensure_ascii=False)
        bp = os.path.join(d, 'beats.py'); open(bp, 'w').write(BEATS)
        out = os.path.join(d, 'out')
        build.build(bp, audio, out, TH.load())
        tl = json.load(open(os.path.join(out, 'timeline.json'))); ev = json.load(open(os.path.join(out, 'events.json')))
        assert tl['frames'] > 30 and tl['layout']['canvas'] and tl['stage']['title'] == 'test'
        assert all(c['u'] == '' for c in tl['chat'])          # owner: chat shows messages only, never a nickname
        assert any(o['op'] == 'tb' for o in tl['ops']) and any(s[1] == 'key' for s in ev['sfx'])
        assert ev['mix']['bgm'].endswith('.mp3') and ev['review']['lip_main'] == 'a1'
        assert len(tl['main']['p']['ParamAngleX']) == tl['frames']


if __name__ == '__main__':
    for name, fn in list(globals().items()):
        if name.startswith('test_'): fn(); print('ok', name)
