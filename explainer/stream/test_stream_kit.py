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


PASTE_BEATS = """
TAIL = 1.0
CLOCK0 = 22 * 3600
STREAM_TITLE = 'paste'
def script(B, rng):
    B.t = 0.5
    B.say('a1', gaze='cam')
    B.hand_at(B.t)
    t = B.paste_image('content/book-night/episodes/01-purple-cow/props/purple_cow_field.jpg', 60, 385, 430, 307)
    B.t = max(B.t, B.hand_t) + 1.0
"""


def test_paste_image_draws_a_served_picture_inside_a_selection_and_drops_it():
    import build
    with tempfile.TemporaryDirectory() as d:
        audio = os.path.join(d, 'audio'); os.makedirs(audio)
        _wav(os.path.join(audio, 'a1.wav'), 1.0)
        json.dump({'id': 'a1', 'who': 'main', 'dur': 1.0, 'said': '안녕'}, open(os.path.join(audio, 'a1.json'), 'w'), ensure_ascii=False)
        bp = os.path.join(d, 'beats.py'); open(bp, 'w').write(PASTE_BEATS)
        out = os.path.join(d, 'out')
        build.build(bp, audio, out, TH.load('default', 'kate', 'book-night'))
        tl = json.load(open(os.path.join(out, 'timeline.json'))); ev = json.load(open(os.path.join(out, 'events.json')))
        img = [o for o in tl['ops'] if o['op'] == 'img']
        assert len(img) == 1 and tl['images'] == [img[0]['src']]
        u = img[0]['src']; assert u.startswith('/themes/')
        assert os.path.isfile(os.path.join(HERE, 'themes', u[len('/themes/'):]))       # render.mjs serves /themes/ from here
        sels = [o for o in tl['ops'] if o['op'] == 'sel']
        assert any(o['w'] == 430 and o['h'] == 307 and o['f'] == img[0]['f'] for o in sels)   # the pasted picture stays selected
        assert sels[-1]['w'] == 0 and sels[-1]['f'] > img[0]['f']                             # until a click outside drops it
        assert 'ctrl' in [s[1] for s in ev['sfx']]


def _fake_edit(d):
    """a tiny live build + episode for edit/cut.py: four lines, drawing in one gap, a donation in another, one line dropped"""
    ep = os.path.join(d, 'ep'); bd = os.path.join(d, 'build'); os.makedirs(ep); os.makedirs(bd)
    voices = [['main', 'a1', 1.0, 2.0], ['main', 'a2', 3.2, 1.5], ['main', 'a3', 12.0, 2.0], ['main', 'a4', 20.0, 2.0], ['sis', 'a5', 30.0, 1.0]]
    json.dump({'T': 40.0, 'voices': voices, 'sfx': [], 'afk': None, 'sis': [], 'review': {}}, open(os.path.join(bd, 'events.json'), 'w'))
    ops = [{'f': int(t * 30), 'op': 'seg'} for t in np.arange(5.0, 11.0, 0.1)]          # drawing between a2 and a3
    json.dump({'ops': ops, 'alerts': [{'f0': 16 * 30, 'f1': 23 * 30}]}, open(os.path.join(bd, 'timeline.json'), 'w'))
    json.dump({'photo': 4.0}, open(os.path.join(bd, 'marks.json'), 'w'))
    json.dump([{'id': f'a{k}', 'text': f'line {k}'} for k in range(1, 6)], open(os.path.join(ep, 'lines.json'), 'w'))
    open(os.path.join(ep, 'edit_plan.py'), 'w').write("""
DROP = {'a5'}
ZOOM = {'a4': 'face'}
Z = {'face': (900, 506, 1020, 574)}
COLD_OPEN = [{'line': 'a4', 'zoom': 'face'}, {'at': ['line', 'a1', 0.5], 'dur': 0.1, 'hold': 'fill'}]
COLD_LEN = 10.0
EMPH = {}; CHAT = {}
""")
    return ep, bd


def test_edit_cut_keeps_lines_whole_speeds_up_drawing_keeps_the_donation_and_fills_the_cold_open():
    sys.path.insert(0, os.path.join(HERE, 'edit'))
    import cut
    with tempfile.TemporaryDirectory() as d:
        ep, bd = _fake_edit(d)
        P = cut.load_plan(os.path.join(ep, 'edit_plan.py')); C = cut.Cut(ep, bd, P)
        segs = C.main_segments()
        lines = [l for s in segs for l in s['lines']]
        assert lines == ['a1', 'a2', 'a3', 'a4']                                        # a5 dropped, order kept
        for s in segs:                                                                  # a kept line is never cut inside
            for l in s['lines']:
                _, t0, dd = C.V[l]; assert s['s0'] <= t0 and t0 + dd <= s['s1'] and s['speed'] == 1.0
        tl = [s for s in segs if s.get('fill') == 'timelapse']
        assert len(tl) == 1 and tl[0]['speed'] >= 2.0 and 4.8 < tl[0]['s0'] < 5.2           # the drawing, sped up
        al = [s for s in segs if s.get('fill') == 'alert']
        assert len(al) == 1 and al[0]['speed'] == 1.0 and abs(al[0]['s0'] - 15.8) < 0.01     # the donation at 1x
        assert all(b['s0'] >= a['s1'] - 1e-6 for a, b in zip(segs, segs[1:]))               # no overlap, source order
        assert next(s for s in segs if 'a4' in s['lines'])['zoom'] == 'face'
        cold = C.cold_segments()
        assert abs(sum(s['s1'] - s['s0'] + s['hold'] for s in cold) - 10.0) < 1e-6        # the freeze fills to COLD_LEN


def test_edit_jingle_is_five_seconds_and_effects_exist():
    sys.path.insert(0, os.path.join(HERE, 'edit'))
    import sound
    j = sound.jingle()
    assert abs(len(j) / sound.SR - 5.0) < 1e-3 and np.max(np.abs(j)) <= 0.9
    assert np.max(np.abs(j[-int(0.05 * sound.SR):])) < 0.05                               # it ends faded
    for fn in (sound.whoosh, sound.pop, sound.ding, sound.boing, sound.scratch, sound.whip):
        x = fn(); assert len(x) > 1000 and np.isfinite(x).all()


def test_edit_reference_marks_chat_punch_in_pan_and_head_mapping():
    """RESEARCH.md §4: a chat punch-in becomes a zoom on the chat box, a pan eases between two boxes of one size,
    a state label's anchor follows the punch-in, and every caption tone and mark style renders to HTML"""
    sys.path.insert(0, os.path.join(HERE, 'edit'))
    import cut
    with tempfile.TemporaryDirectory() as d:
        ep, bd = _fake_edit(d)
        open(os.path.join(ep, 'edit_plan.py'), 'a').write("CHATZOOM = ['a2']\nZ['chat'] = (1294, 255, 560, 315)\n")
        P = cut.load_plan(os.path.join(ep, 'edit_plan.py')); C = cut.Cut(ep, bd, P)
        assert next(s for s in C.main_segments() if 'a2' in s['lines'])['zoom'] == 'chat'
        assert P.ZOOM == {'a4': 'face'}                                                   # the plan itself is not changed
    Z = {'a': (0, 0, 640, 360), 'b': (400, 300, 640, 360), 'c': (0, 0, 960, 540)}
    f = cut.crop(Z, ('a', 'b'), 2.0)
    assert 'crop=640:360' in f and "x='0+(400)*" in f and "y='0+(300)*" in f and 'min(1\\,t/2.000)' in f
    try: cut.crop(Z, ('a', 'c'), 1.0); assert False, 'a pan between two sizes must fail'
    except AssertionError as e: assert 'differ' in str(e)
    assert cut.map_pt(Z, None, 100, 200) == (100, 200)
    assert cut.map_pt(Z, 'b', 720, 480) == (960.0, 540.0)                                # the middle of the box lands in the middle
    for tone in ('plain', 'shout', 'mutter', 'chat'): assert '<body' in cut.html_sub('줄', 'main', tone)
    assert '#ffe14d' in cut.html_sub('리마커블이에요', 'main', 'plain', '리마커블')            # the key phrase is coloured
    for st in ('key', 'tag', 'gag', 'narr', 'result', 'thesis'): assert '<body' in cut.html_emph('위\n아래', st)
    assert '제일 좋아하는 말' in cut.html_emph('제일 좋아하는 말|안전한 게 제일 위험하다', 'thesis')
    for h in (cut.html_state('긴장'), cut.html_corner('코너'), cut.html_live('생방송'), cut.html_photo_card('file:///x.jpg', '실제'),
              cut.html_end_over({'next': 'n', 'next_title': 't', 'next_sub': 's', 'full': 'f'}, 'file:///x.jpg')): assert '<body' in h


def test_jingle_candidates_write_valid_midi_and_render_when_the_soundfont_is_there():
    """edit/jingles.py: every candidate builds a format-1 MIDI file with notes inside its 5 s; with fluidsynth and the
    SoundFont present, one renders to 5.0 s of 48 kHz stereo at the shared level"""
    sys.path.insert(0, os.path.join(HERE, 'edit'))
    import jingles, shutil
    assert len(jingles.CANDIDATES) >= 10
    assert jingles.nm('C5') == 72 and jingles.nm('Bb3') == 58 and jingles.nm('F#4') == 66
    with tempfile.TemporaryDirectory() as d:
        for name, fn in jingles.CANDIDATES.items():
            s = fn(); p = os.path.join(d, name + '.mid'); s.midi(p)
            b = open(p, 'rb').read(); assert b[:4] == b'MThd' and b'MTrk' in b, name
            beats = jingles.DUR * s.bpm / 60
            ons = [at for at, st, _, v in s.ev if st & 0xF0 == 0x90]
            assert ons and min(ons) >= 0 and max(ons) < beats, (name, max(ons), beats)
        if shutil.which('fluidsynth') and os.path.exists(jingles.SF2):
            w = jingles.render('lofi_keys', os.path.join(d, 'j.wav'))
            r = wave.open(w); assert r.getframerate() == 48000 and r.getnchannels() == 2 and abs(r.getnframes() / 48000 - 5.0) < 1e-3

if __name__ == '__main__':
    for name, fn in list(globals().items()):
        if name.startswith('test_'): fn(); print('ok', name)
