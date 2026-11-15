"""The docent kit on the real engine (docent.js on Node + Skia, noderender/): the real covers' timing, the held cover,
animal() options and the assets harvested from the run-4 probes (research 2026-11-15). Skipped when node or
@napi-rs/canvas is not installed (npm install in explainer/noderender)."""
import json, os, shutil, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
EX = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from test_budget_engine import node_ok, evaluate  # noqa: E402

SCENES = r"""
cast('me', { name: '나', hair: 'long', h: 0.94 });
SCENES.s = (t, q) => shots(t, [[0.0, (t, lt) => person('me', 600, 870, {})]]);
"""


@unittest.skipUnless(node_ok(), 'node or @napi-rs/canvas missing (npm install in explainer/noderender)')
class Kit(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import new_video
        cls.proj = tempfile.mkdtemp()
        for f in ('engine.js', 'docent.js', 'video.html'): shutil.copy(os.path.join(EX, 'engine', f), cls.proj)
        th = new_video.theme('sketch'); json.dump({k: v for k, v in th.items() if k != 'fontFiles'}, open(os.path.join(cls.proj, 'theme.json'), 'w'))
        sents = [{'text': '가', 'start': 0.1, 'end': 9.5, 'dur': 9.9}]
        json.dump({'total': 10, 'scenes': [{'id': 's', 'chip': '1', 'title': 't', 'subtitle': '', 'start': 0, 'lead': 0, 'dur': 10,
                                            'sentences': sents, 'words': []}]}, open(os.path.join(cls.proj, 'timeline.json'), 'w'))
        open(os.path.join(cls.proj, 'scenes.js'), 'w').write(SCENES)

    def run_js(self, expr, arg=None):
        return evaluate(self.proj, expr, arg, False)

    def test_cover_pair_is_whole_by_p_0_6(self):   # run 4: the Korean cover was a grey ghost at the shot's start + 0.8 s
        probe = """(p) => { DOCENT_FRAME(0); realCoverPair('cover_a', 'cover_b', 960, 800, 400, { p }); return DOCENT.partial; }"""
        self.assertEqual(self.run_js(probe, 0.6), [])
        self.assertEqual(self.run_js(probe, 1.0), [])
        self.assertEqual(self.run_js(probe, 0.45), ['cover:cover_b'])   # A is whole, B still drawing
        self.assertEqual(sorted(self.run_js(probe, 0.3)), ['cover:cover_a', 'cover:cover_b'])

    def test_covers_report_their_opacity(self):   # lint cover-late reads docentReport().covers
        probe = """(p) => { DOCENT_FRAME(0); realCoverPair('cover_a', 'cover_b', 960, 800, 400, { p }); return docentReport().covers; }"""
        self.assertEqual(self.run_js(probe, 0.6), [['cover_a', 1], ['cover_b', 1]])
        a, b = self.run_js(probe, 0.3)
        self.assertLess(b[1], 0.9)
        # B not started yet: listed at 0, so the lint sees the cover the shot will show is not there (fix round, F1)
        self.assertEqual(self.run_js(probe, 0.1)[1], ['cover_b', 0])
        self.assertEqual(self.run_js("""() => { DOCENT_FRAME(0); realCover('cover_a', 960, 800, 400, { p: 0 }); return [docentReport().covers, DOCENT.partial]; }"""),
                         [[['cover_a', 0]], []])   # listed, but not half-drawn: nothing is on screen

    def test_people_carry_their_height_and_whether_the_scene_drew_them(self):   # lint crowd-row
        probe = """() => { DOCENT_FRAME(0); figure(300, 870, { s: 1, crowd: true }); person('me', 700, 870, { s: 1.5 });
          bubble(1100, 200, 400, 300, { tail: [700, 400], body: (x, y, w, h) => figure(x + w / 2, y + h - 20, { s: 0.4 }) });
          return docentReport().people.map((p) => [p.top, p.hpx]); }"""
        (t1, h1), (t2, h2), (t3, h3) = self.run_js(probe)
        self.assertEqual((t1, t2, t3), (True, True, False))   # the figure inside a bubble's picture is not the scene's
        self.assertAlmostEqual(h1, 338, delta=12); self.assertAlmostEqual(h2, 1.5 * 0.94 * 360, delta=25)
        night = """() => { DOCENT_FRAME(0); letterNight({}); return docentReport().people.map((p) => p.top); }"""
        self.assertEqual(self.run_js(night), [False])   # a letter place's own person

    def test_animal_passes_its_own_options(self):   # run 4: run: 1 and mood: 'sad' never reached the drawing
        probe = """() => { ANIMALS.__probe = (T, o, q) => { globalThis.__seen = { ...o }; return { head: T(0, -100), r: 20, mouth: T(10, -90), top: T(0, -120) }; };
          DOCENT_FRAME(0); animal('__probe', 900, 800, { s: 2, dir: -3, run: 1, mood: 'sad', banana: true, t: 1.5, p: 0.5 });
          const seen = globalThis.__seen; delete ANIMALS.__probe; return seen; }"""
        o = self.run_js(probe)
        self.assertEqual((o['run'], o['mood'], o['banana'], o['t']), (1, 'sad', True, 1.5))
        self.assertEqual((o['s'], o['dir'], o['p']), (2, -1, 0.5))           # the computed ones still win
        self.assertAlmostEqual(o['w'], 4 * 2 ** 0.5, places=3)

    def test_hold_cover_beside_the_body_never_over_the_face(self):
        probe = """([flip, pose, side]) => { DOCENT_FRAME(0); const f = person('me', 960, 870, { s: 1.5, pose, flip });
          const b = holdCover(f, 'cover_a', { h: 280, side }); const r = docentReport();
          return { b, head: f.head, r: f.r, hand: f.hands[side === 'back' ? 0 : 1], things: r.things, partial: r.partial }; }"""
        for flip in (False, True):
            for pose, side in (('showBook', 'front'), ('stand', 'front'), ('cheer', 'back')):
                r = self.run_js(probe, [flip, pose, side])
                b, (hx, hy), R = r['b'], r['head'], r['r']
                out = (-1 if flip else 1) * (-1 if side == 'back' else 1)
                self.assertAlmostEqual(b['h'], 280)
                beside = b['y'] < hy + R * 1.3 and b['y'] + b['h'] > hy - R * 1.3
                if beside: self.assertTrue(b['x'] >= hx + R * 1.39 if out > 0 else b['x'] + b['w'] <= hx - R * 1.39, (flip, pose, b))
                self.assertGreater((b['x'] + b['w'] / 2 - hx) * out, 0, (flip, pose))   # on the hand's side of the body
                if pose == 'showBook':   # the hand on the cover's inner edge: it is held, not floating beside her
                    self.assertLessEqual(b['x'] - 2, r['hand'][0]); self.assertLessEqual(r['hand'][0], b['x'] + b['w'] + 2)
                    self.assertTrue(b['y'] < r['hand'][1] < b['y'] + b['h'])
                self.assertEqual(r['partial'], [])
                self.assertEqual(sorted(t.split('#')[0] for t in r['things']), ['book', 'person'])   # one thing, as realCover


    # ---- the assets harvested from the run-4 probes ----
    INKED = """([draw, box]) => { DOCENT_FRAME(0); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
      const r = (new Function('return ' + draw))()(); const b = box || [0, 0, W, H];
      const d = ctx.getImageData(b[0], b[1], b[2] - b[0], b[3] - b[1]).data; let n = 0, h = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i] + d[i + 1] + d[i + 2] < 200) n++; h = (h * 31 + d[i] + 7 * d[i + 1] + 13 * d[i + 2]) % 1000000007; }
      return { n, h, r: r && r.head ? { head: r.head, r: r.r, box: r.box } : null }; }"""

    def inked(self, draw, box=None):
        """draw (a JS function body returning anchors or nothing) on a clear page: dark pixels and a hash of the box"""
        return self.run_js(self.INKED, [draw, box])

    def test_kit_has_the_run4_assets(self):
        r = self.run_js("""() => ({ a: Object.keys(ANIMALS), p: Object.keys(PROPS), q: Object.keys(POSES) })""")
        for a in ('fox', 'lion', 'wolf', 'monkey'): self.assertIn(a, r['a'])
        for p in ('plane', 'dna', 'diary'): self.assertIn(p, r['p'])
        for q in ('reachDown', 'linked', 'showBook'): self.assertIn(q, r['q'])

    def test_animals_draw_body_and_head_first(self):   # the p05 fox was a headless body, the p07 lion two arcs, 0.5 s in
        for kind in ('fox', 'lion', 'wolf', 'monkey'):
            whole = self.inked(f"() => animal('{kind}', 960, 800, {{ s: 1.2 }})")
            hx, hy = whole['r']['head']; R = whole['r']['r']
            box = [int(hx - R), int(hy - R), int(hx + R), int(hy + R)]
            head_whole = self.inked(f"() => animal('{kind}', 960, 800, {{ s: 1.2 }})", box)['n']
            early = self.inked(f"() => animal('{kind}', 960, 800, {{ s: 1.2, p: 0.45 }})", box)['n']   # q(0), q(1) done; legs, tail, details not
            self.assertGreater(early, 0.6 * head_whole, (kind, early, head_whole))
            self.assertLess(self.inked(f"() => animal('{kind}', 960, 800, {{ s: 1.2, p: 0.45 }})")['n'], whole['n'], kind)

    def test_animal_options_change_the_drawing(self):
        same = lambda a, b: self.inked(a)['h'] == self.inked(b)['h']
        self.assertTrue(same("() => animal('fox', 960, 800, {})", "() => animal('fox', 960, 800, { run: 0 })"))
        self.assertFalse(same("() => animal('fox', 960, 800, {})", "() => animal('fox', 960, 800, { run: 1 })"))
        self.assertFalse(same("() => animal('lion', 960, 800, {})", "() => animal('lion', 960, 800, { mood: 'sad' })"))
        self.assertFalse(same("() => animal('monkey', 960, 800, {})", "() => animal('monkey', 960, 800, { banana: true })"))
        self.assertFalse(same("() => animal('monkey', 960, 800, {})", "() => animal('monkey', 960, 800, { mood: 'stern' })"))
        self.assertFalse(same("() => prop('plane', 960, 800, 1)", "() => prop('plane', 960, 800, 1, { crash: true })"))
        self.assertFalse(same("() => prop('diary', 960, 800, 1)", "() => prop('diary', 960, 800, 1, { lines: 0 })"))

    def test_the_monkey_is_line_art(self):   # p09: its solid ink coat was the heaviest mass in the clip
        for o in ('{ s: 1.5 }', '{ s: 1.5, banana: true }'):
            m = self.inked(f"() => animal('monkey', 960, 900, {o})")
            x0, y0, x1, y1 = m['r']['box']
            self.assertLess(m['n'] / ((x1 - x0) * (y1 - y0)), 0.12, o)   # ink lines on the page (the p09 coat: ~40 % ink)

    BESIDE = """(o) => { DOCENT_FRAME(0); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
      const a = animal('monkey', 960, 900, o), R = a.r, [hx, hy] = a.head, dir = o.dir || 1;
      const x0 = Math.round(dir > 0 ? hx + R + 10 : hx - R - 10 - 190), y0 = Math.round(hy - 160);   // beside the head, its front
      const d = ctx.getImageData(x0, y0, 190, 300).data; let dark = 0, yellow = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i] + d[i + 1] + d[i + 2] < 200) dark++; if (d[i] - d[i + 2] > 50 && d[i + 1] - d[i + 2] > 30) yellow++; }
      return { dark, yellow }; }"""

    def test_the_banana_reads_in_ink(self):   # fix round F7, r09: in ink mode the yellow fill was page and the banana vanished
        for d in (1, -1):
            plain = self.run_js(self.BESIDE, {'s': 1.5, 'dir': d})
            held = self.run_js(self.BESIDE, {'s': 1.5, 'dir': d, 'banana': True, 'mood': 'stern'})
            self.assertLess(plain['dark'], 1000, plain)   # beside the head at the front: the ear's edge, little else
            self.assertGreater(held['dark'] - plain['dark'], 2500, (plain, held))   # the banana out of the body's outline: outline, ridges, tip
            self.assertEqual(held['yellow'], 0)   # ink alone, no colour needed
        coloured = evaluate(self.proj, self.BESIDE, {'s': 1.5, 'banana': True}, True)   # a colour project keeps it yellow
        self.assertGreater(coloured['yellow'], 1000, coloured)

    HOLD = """([d, ha, hb, flip, hold, p]) => { DOCENT_FRAME(0); MISS.clear(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
      const a = figure(700, 870, { s: 1.3, h: ha, holdHand: hold ? 'right' : null });
      const b = figure(700 + d, 870, { s: 1.3, h: hb, flip, holdHand: hold ? 'left' : null });
      const g = holdHands(b, a, { p });   // either order
      const ink = (x, y, r) => { const q = ctx.getImageData(Math.round(x - r), Math.round(y - r), 2 * r, 2 * r).data; let n = 0;
        for (let i = 0; i < q.length; i += 4) if (q[i] + q[i + 1] + q[i + 2] < 200) n++; return n; };
      const all = ctx.getImageData(0, 0, W, H).data; let n = 0; for (let i = 0; i < all.length; i += 4) if (all[i] + all[i + 1] + all[i + 2] < 200) n++;
      return { g, ha: a.hands, hb: b.hands, sa: a.arms.sh, sb: b.arms.sh, offA: a.arms.off, offB: b.arms.off, near: g ? ink(g[0], g[1], 5) : 0, n,
               miss: [...MISS].filter((m) => m.startsWith('holdHands')) }; }"""

    def test_hold_hands_meet_at_one_grip(self):   # fix round F12, r09: linked hands of h 1.04 / 0.92 missed by ~26 px
        for d, ha, hb, flip in ((208, 1.04, 0.92, True), (240, 0.94, 1.08, False), (190, 0.92, 1.04, True)):
            r = self.run_js(self.HOLD, [d, ha, hb, flip, True, 1])
            gx, gy = r['g']
            inner_a, inner_b = r['ha'][1], r['hb'][1 if flip else 0]   # a faces right: its right arm; b's left-side arm
            self.assertEqual(inner_a, r['g']); self.assertEqual(inner_b, r['g'])   # both hands at the same point
            sa, sb = r['sa'][1], r['sb'][1 if flip else 0]
            self.assertTrue(sa[0] < gx < sb[0], (sa, r['g'], sb))                   # between the two people
            self.assertGreater(gy, max(sa[1], sb[1]) + 20)                          # below both shoulders
            for (sx, sy), h in ((sa, ha), (sb, hb)):
                self.assertLessEqual(((gx - sx) ** 2 + (gy - sy) ** 2) ** 0.5, 112 * 1.3 * h * 0.96)   # in reach: a bent arm
            self.assertGreater(r['near'], 15, r)                                     # ink at the grip: the arms end there
            self.assertEqual(r['miss'], [])
        # the old way: the linked pose places each hand from its own height
        lk = self.run_js("""() => { DOCENT_FRAME(0); const a = figure(700, 870, { s: 1.3, h: 1.04, pose: 'linked' });
          const b = figure(700 + 90 * 1.3 * 2, 870, { s: 1.3, h: 0.92, pose: 'linked', flip: true }); return [a.hands[1], b.hands[1]]; }""")
        self.assertGreater(abs(lk[0][1] - lk[1][1]), 15)

    def test_hold_hand_leaves_that_arm_to_hold_hands(self):
        r = self.run_js(self.HOLD, [208, 1.04, 0.92, True, True, 1])
        self.assertEqual((r['offA'], r['offB']), (1, 1))   # a faces right: right arm (ra); b flipped: its screen-left arm is ra
        self.assertEqual(self.run_js(self.HOLD, [208, 1.04, 0.92, False, True, 1])['offB'], 0)
        off = self.run_js(self.HOLD, [208, 1.04, 0.92, True, True, 0])   # p 0: the two inner arms not drawn yet
        whole = self.run_js(self.HOLD, [208, 1.04, 0.92, True, True, 1])
        self.assertEqual(off['near'], 0); self.assertGreater(whole['n'], off['n'] + 300)
        plain = self.run_js(self.HOLD, [208, 1.04, 0.92, True, False, 0])   # without holdHand the figures draw both arms
        self.assertGreater(plain['n'], off['n'] + 300)

    def test_hold_hands_without_hold_hand_is_reported(self):   # a third arm would show
        r = self.run_js(self.HOLD, [208, 1.04, 0.92, True, False, 1])
        self.assertEqual(len(r['miss']), 2, r['miss']); self.assertIn("holdHand: 'right'", ' '.join(r['miss']))

    def test_props_draw_on_in_stages(self):
        for name in ('plane', 'dna', 'diary'):
            n0, n1, n2 = (self.inked(f"() => prop('{name}', 960, 800, 1.6, {{ p: {p} }})")['n'] for p in (0, 0.35, 1))
            self.assertEqual(n0, 0, name); self.assertGreater(n1, 0, name); self.assertLess(n1, 0.85 * n2, name)

    def test_props_follow_the_size_contract(self):   # (x, y) = bottom centre, s = 1 ≈ 160 px tall
        probe = """(name) => { DOCENT_FRAME(0); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
          prop(name, 960, 800, 1); const d = ctx.getImageData(0, 0, W, H).data; let top = H, bot = 0;
          for (let y = 0; y < H; y++) for (let x = 600; x < 1320; x += 2) { const i = (y * W + x) * 4; if (d[i] + d[i + 1] + d[i + 2] < 200) { top = Math.min(top, y); bot = Math.max(bot, y); } }
          return [top, bot]; }"""
        for name, tall in (('plane', 160), ('dna', 160), ('diary', 160)):
            top, bot = self.run_js(probe, name)
            self.assertAlmostEqual(bot - top, tall, delta=0.25 * tall, msg=(name, top, bot))
            self.assertLess(abs(bot - 800), 0.25 * tall, (name, bot))   # it stands on y (a ribbon may hang a little below)


if __name__ == '__main__':
    unittest.main()
