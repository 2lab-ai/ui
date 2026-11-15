"""The emphasis-budget counts measured on the real engine (docent.js), not on synthetic reports: words and red marks
drawn inside other primitives count, so does a bubble's speech; a prop's own lettering does not; a list's items are counted,
ink mode strips colours only in a project with "colour": false. Runs the engine on Node + Skia (noderender/); skipped
when node or @napi-rs/canvas is not installed (npm install in explainer/noderender)."""
import json, os, shutil, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
EX = os.path.dirname(HERE)
sys.path.insert(0, HERE)
PAGE = os.path.join(EX, 'noderender', 'page.js')


def node_ok():
    if not shutil.which('node'): return False
    env = dict(os.environ, NODE_PATH=os.path.join(EX, 'noderender', 'node_modules'))
    return subprocess.run(['node', '-e', "require('@napi-rs/canvas')"], cwd=os.path.join(EX, 'noderender'), env=env, capture_output=True).returncode == 0


SCENES = r"""
cast('a', { name: '갑', hair: 'short', outfit: 'suit', accent: 'red' });
SCENES.s = (t, q) => shots(t, [
  [0.0, (t, lt) => { const v = person('a', 700, 880, {}); think(v, null, { w: 400, h: 240, body: (x, y) => hand('내 판단', x + 200, y + 120, { size: 60 }) }); }],
  [2.0, (t, lt) => { const v = person('a', 700, 880, {}); say(v, '말풍선도 단어'); prop('calendar', 1300, 860, 1.2, { label: '월' }); }],
  [4.0, (t, lt) => { scrollList(600, 150, 600, '규칙', ['하나', '둘', '셋', '넷'], { mark: [2] }); }],
  [6.0, (t, lt) => { inkPath([[300, 300], [600, 700]], { color: MARK(), w: 6 }); cross(900, 300, 200, 200); }],
  [8.0, (t, lt) => { hand('나', 500, 400); hand('너', 900, 400); hand('우리', 1300, 400); }],
  [11.0, (t, lt) => { person('a', 700, 880, {}); prop('clock', 700, 760, 1.0); }],
  [13.0, (t, lt) => { person('a', 700, 880, {}); prop('clock', 700, 760, 1.0, { bodyOk: true }); prop('openbook', 1300, 800, 1.0); person('b', 1300, 880, {}); prop('openbook', 1300, 800, 1.0); }],
  [15.0, (t, lt) => { person('a', 500, 880, {}); prop('clock', 500, 820, 2.4, { faceOk: true }); person('b', 1300, 880, {}); prop('stairs', 1180, 900, 2.0); }],
]);
"""


def evaluate(proj, expr, arg, colour, before=None):
    """run expr(arg) on the engine page of proj (project.json "colour": colour; None = the key left out)."""
    pj = {'slug': 't', 'theme': 'sketch'}
    if colour is not None: pj['colour'] = colour
    json.dump(pj, open(os.path.join(proj, 'project.json'), 'w'))
    env = dict(os.environ, NODE_PATH=os.path.join(EX, 'noderender', 'node_modules'))
    msg = json.dumps({'id': 1, 'expr': expr, 'arg': arg})
    if before is not None:   # render another frame first, in the same page: counts must not carry over
        msg = json.dumps({'id': 0, 'expr': '(t) => { renderAt(t); return 0; }', 'arg': before}) + '\n' + msg
    out = subprocess.run(['node', PAGE, proj], input=msg + '\n', capture_output=True, text=True, env=env, timeout=120).stdout.splitlines()
    rep = [json.loads(l) for l in out if l.startswith('{')][-1]
    assert 'value' in rep, rep
    return rep['value']


def report(proj, t, colour, before=None):
    return evaluate(proj, '(t) => { renderAt(t); return docentReport(); }', t, colour, before)


# Every paint call under docent.js's ink-mode wrapper, recorded with the colour it really paints: recorders go under
# the wrapper (docent.js wraps whatever ctx.fill/stroke/… are when the next frame starts), then each animal, prop and
# hat is drawn alone. Returns {label: [colours that are neither ink nor page]} and the number of paints per label.
TONES = r"""(hats) => {
  if (!ctx.__tones) {
    const proto = Object.getPrototypeOf(ctx);
    for (const [m, prop] of [['fill', 'fillStyle'], ['fillRect', 'fillStyle'], ['fillText', 'fillStyle'],
      ['stroke', 'strokeStyle'], ['strokeRect', 'strokeStyle'], ['strokeText', 'strokeStyle']]) {
      const orig = proto[m];
      ctx[m] = function (...a) { if (ctx.__tones.on && this.globalAlpha > 0.01) ctx.__tones.seen.push(String(this[prop])); return orig.apply(this, a); };
    }
    ctx.__tones = { on: false, seen: [] }; delete ctx.__docentInk;
  }
  renderAt(0.5);
  const off = {}, n = {};
  const check = (label, draw) => {
    ctx.__tones.seen = []; ctx.__tones.on = true;
    try { draw(); } finally { ctx.__tones.on = false; }
    n[label] = ctx.__tones.seen.length;
    const bad = [...new Set(ctx.__tones.seen)].filter((c) => !docentSame(c, INK()) && !docentSame(c, PAPER()) && !/,\s*0\)$/.test(c));   // see-through paints nothing
    if (bad.length) off[label] = bad;
  };
  for (const k of Object.keys(ANIMALS)) check('animal:' + k, () => animal(k, 960, 800, { s: 0.8 }));
  for (const k of Object.keys(PROPS)) check('prop:' + k, () => prop(k, 960, 800, 1));
  for (const hat of hats) check('hat:' + hat, () => figure(960, 860, { hat, hair: 'short', beard: true, glasses: true, tie: true, outfit: 'suit', accent: 'red' }));
  check('crab', () => crab(960, 800)); check('ant', () => ant(960, 800));
  return { off, n };
}"""
HATS = ['top', 'cap', 'beanie', 'bowler', 'crown', 'laurel']


@unittest.skipUnless(node_ok(), 'node or @napi-rs/canvas missing (npm install in explainer/noderender)')
class BudgetOnEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import new_video
        cls.proj = tempfile.mkdtemp()
        for f in ('engine.js', 'docent.js', 'video.html'): shutil.copy(os.path.join(EX, 'engine', f), cls.proj)
        th = new_video.theme('sketch'); json.dump({k: v for k, v in th.items() if k != 'fontFiles'}, open(os.path.join(cls.proj, 'theme.json'), 'w'))
        sents = [{'text': '가', 'start': 0.1, 'end': 16.5, 'dur': 16.9}]
        json.dump({'total': 17, 'scenes': [{'id': 's', 'chip': '1', 'title': 't', 'subtitle': '', 'start': 0, 'lead': 0, 'dur': 17,
                                            'sentences': sents, 'words': []}]}, open(os.path.join(cls.proj, 'timeline.json'), 'w'))
        open(os.path.join(cls.proj, 'scenes.js'), 'w').write(SCENES)

    def test_word_inside_a_thought_and_speech_count_prop_lettering_does_not(self):
        self.assertEqual(report(self.proj, 1.5, False)['words'], ['내 판단'])
        self.assertEqual(report(self.proj, 3.5, False)['words'], ['말풍선도 단어'])   # not the calendar's own label

    def test_budget_only_in_ink_mode(self):
        self.assertTrue(report(self.proj, 1.5, False)['budget']); self.assertFalse(report(self.proj, 1.5, None)['budget'])

    def test_list_items_and_a_mark_inside_the_list(self):
        r = report(self.proj, 5.5, False)
        self.assertEqual(r['listItems'], 4); self.assertEqual(r['marks'], ['ring'])

    def test_counts_reset_every_frame(self):
        self.assertEqual(report(self.proj, 9.5, False, before=5.5)['listItems'], 0)
        self.assertEqual(report(self.proj, 1.5, False, before=9.5)['words'], ['내 판단'])

    def test_people_register_as_figures(self):   # PR #64 round 1: a trailing comment swallowed figs.push and mouths.push
        r = report(self.proj, 12.5, False)
        self.assertEqual(len(r['people']), 1)
        self.assertEqual(r['figures'], 1)

    def test_prop_over_a_torso(self):   # an hourglass or clock for a chest (Stoic run Gate C)
        self.assertTrue(report(self.proj, 12.5, False)['propBody'])
        self.assertEqual(report(self.proj, 14.5, False)['propBody'], [])   # bodyOk: hugging it is the point; a book held to read
        big = report(self.proj, 16.5, False)['propBody']   # a giant clock still counts (faceOk only skips the face test);
        self.assertEqual(len(big), 1, big)                  # stairs beside the figure, centred elsewhere, do not
        self.assertIn("'clock'", big[0])

    def test_hand_drawn_red_line_is_a_mark(self):
        self.assertEqual(sorted(report(self.proj, 7.5, False)['marks']), ['cross', 'red line'])

    def test_three_words(self):
        self.assertEqual(len(report(self.proj, 9.5, False)['words']), 3)

    def test_ink_mode_paints_only_ink_and_page(self):
        # 총균쇠 Gate C (2026-11-15): the kit horse kept a brown mane (a dark fill passed as ink-dark and kept its own
        # colour) and a cream blaze (a pale neutral line was not a 'colour' and kept its cream) in a "colour": false project
        r = evaluate(self.proj, TONES, HATS, False)
        self.assertEqual(r['off'], {})
        self.assertTrue(all(r['n'].values()), [k for k, v in r['n'].items() if not v])   # every one painted something
        old = evaluate(self.proj, TONES, HATS, None)['off']   # without ink mode the colours are there: the recorder sees them
        self.assertIn('animal:horse', old)

    def test_two_tones_on_a_dark_page(self):   # mono-black --docent: the ink is light, the page near-black
        probe = """() => { const bg = C.bg, ink = C.ink; C.bg = '#050505'; C.ink = '#f5f5f7';
          try { return [['#4e3725', false], ['#f4bb20', false], ['#ffffff', false], ['#141416', true], ['#9a99a7', true], ['#f5f5f7', true]]
            .map(([c, line]) => docentToneOf(c, line)); } finally { C.bg = bg; C.ink = ink; } }"""
        self.assertEqual(evaluate(self.proj, probe, None, False), ['page', 'page', 'page', 'page', 'ink', None])

    def test_ink_mode_only_when_asked(self):
        ink, old = report(self.proj, 1.5, False), report(self.proj, 1.5, None)
        self.assertEqual(ink['colours'], [])        # the red suit paints as ink and page
        self.assertEqual(old['colours'], [])        # an older project: colours kept, and not reported (no ink mode)


class Srt(unittest.TestCase):
    def test_millisecond_rounding_carries(self):
        import export
        tmp = tempfile.mkdtemp(); cwd = os.getcwd()
        try:
            os.chdir(tmp)
            json.dump({'slug': 'x'}, open('project.json', 'w'))
            json.dump({'scenes': [{'sentences': [{'text': 'a', 'start': 1.8, 'end': 1.9996, 'dur': 0.4},
                                                 {'text': 'b', 'start': 59.9996, 'end': 3600.0004, 'dur': 1}]}]}, open('timeline.json', 'w'))
            export.HERE = tmp; export.OUT = os.path.join(tmp, 'out'); os.makedirs(export.OUT, exist_ok=True)
            export.srt()
            txt = open(os.path.join(export.OUT, 'x.srt')).read()
        finally:
            os.chdir(cwd)
        self.assertIn('00:00:01,800 --> 00:00:02,000', txt)
        self.assertIn('00:01:00,000 --> 01:00:00,000', txt)


if __name__ == '__main__':
    unittest.main()
