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


def test_seg_at_buckets_give_the_same_answer_as_a_linear_scan():
    from common import seg_at
    r = np.random.default_rng(3)
    segs = [(float(a), float(a + d), int(k), w) for k, (a, d, w) in
            enumerate(zip(r.uniform(-1, 300, 400), r.uniform(0.1, 12, 400), r.choice(['main', 'sis'], 400)))]
    def linear(t, who, default):
        v = default
        for t0, t1, val, w in segs:
            if w == who and t0 <= t < t1: v = val
        return v
    for t in r.uniform(-2, 315, 2000):
        for who in ('main', 'sis'):
            assert seg_at(segs, t, who, -1) == linear(t, who, -1)
    segs.append((0.0, 400.0, 999, 'main'))   # a list that grows is re-indexed
    assert seg_at(segs, 150.0, 'main', -1) == 999


def test_book_night_composes_to_100_and_its_episode_ledger_points_at_real_episodes():
    cfg = TH.load('default', 'kate', 'book-night')
    assert sum(p for kind in TH.KINDS for _, p in cfg[kind].get('review', [])) == 100
    d = cfg['content']['_dir']
    led = json.load(open(os.path.join(d, cfg['content']['series']['ledger'])))
    nos = [e['no'] for e in led['episodes']]
    assert nos == list(range(1, len(nos) + 1)) and led['episodes'][0].get('first_stream')
    for e in led['episodes']:
        for f in ('beats.py', 'lines.json', 'research.md'):
            assert os.path.exists(os.path.join(d, e['folder'], f)), (e['folder'], f)
        assert e['book'] and e['core'] and e['callbacks'] and e['lore_used']
    used = [x for e in led['episodes'] for x in e['lore_used']]
    assert len(used) == len(set(used))   # a lore hint is never spent twice


def test_ime_ends_on_book_night_text():
    for text in ['책듣는밤 1화', '소 다리 다섯 개였음 ㅋ', '오타쿠: 취미 < ? < 집착', 'TV 광고', '제일 싼 / 비싼 / 빠른 / 느린']:
        states = simulate(keys_for(text))
        assert states[-1][0] + states[-1][1] == text


LONG_BEATS = """
TAIL = 1.0
CLOCK0 = 22 * 3600
STREAM_TITLE = 'long'
STRINGS = {'brb_title': '택배 받으러 잠깐!', 'brb_emoji': '📦'}
VIEWERS = (40, 140)
def script(B, rng):
    B.t = 0.5
    B.pick_tool('pencil')
    B.pick_color('purple')
    B.stroke([(10, 10), (60, 40), (120, 30)])
    B.say('a1', gaze='cam')
    B.hand_at(B.t)
    B.clear_canvas()
    B.sfx.append((B.hand_t + 0.2, 'bell', None)); B.sfx.append((B.hand_t + 0.5, 'doorlock', None))
    B.t = B.hand_t + 1.0
"""


def test_long_form_builder_calls_page_turn_colour_banner_and_viewers():
    import build
    with tempfile.TemporaryDirectory() as d:
        audio = os.path.join(d, 'audio'); os.makedirs(audio)
        _wav(os.path.join(audio, 'a1.wav'), 1.0)
        json.dump({'id': 'a1', 'who': 'main', 'dur': 1.0, 'said': '안녕'}, open(os.path.join(audio, 'a1.json'), 'w'), ensure_ascii=False)
        bp = os.path.join(d, 'beats.py'); open(bp, 'w').write(LONG_BEATS)
        out = os.path.join(d, 'out')
        build.build(bp, audio, out, TH.load('default', 'kate', 'book-night'))
        tl = json.load(open(os.path.join(out, 'timeline.json'))); ev = json.load(open(os.path.join(out, 'events.json')))
        cv = tl['layout']['canvas']
        assert any(o['op'] == 'color' and o['c'] == '#a349a4' for o in tl['ops'])
        assert all(o.get('c') == '#a349a4' for o in tl['ops'] if o['op'] == 'seg')
        assert any(o['op'] == 'erase' and o['w'] == cv['w'] and o['h'] == cv['h'] for o in tl['ops'])
        assert tl['stage']['strings']['brb_title'] == '택배 받으러 잠깐!' and tl['stage']['strings']['chat_title'] == '채팅'
        assert tl['viewers'][0] <= 45
        kinds = [s[1] for s in ev['sfx']]
        assert 'bell' in kinds and 'doorlock' in kinds and 'delete' in kinds and 'ctrl' in kinds


if __name__ == '__main__':
    for name, fn in list(globals().items()):
        if name.startswith('test_'): fn(); print('ok', name)
