"""export.py cover checks: bare page share, the running-time corner and the COVER report limits (REFERENCE §10)."""
import os, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import export  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

PAGE = (164, 172, 220)


def png(draw=None):
    im = Image.new('RGB', (1920, 1080), PAGE)
    if draw: draw(ImageDraw.Draw(im))
    f = tempfile.NamedTemporaryFile(suffix='.png', delete=False); im.save(f.name); return f.name


class PageShare(unittest.TestCase):
    def test_empty_page_is_all_page(self):
        self.assertAlmostEqual(export.page_share(png()), 1.0, places=2)

    def test_solid_half_is_half(self):
        p = png(lambda d: d.rectangle((0, 0, 959, 1079), fill=(20, 20, 20)))
        self.assertAlmostEqual(export.page_share(p), 0.5, delta=0.02)

    def test_pale_fill_counts_as_page(self):   # a fill 1.45:1 against the page vanishes at 168 px
        p = png(lambda d: d.rectangle((0, 0, 959, 1079), fill=(176, 186, 226)))
        self.assertGreater(export.page_share(p), export.PAGE_MAX)


class Corner(unittest.TestCase):
    def test_ink_in_corner(self):
        p = png(lambda d: d.rectangle((1700, 1000, 1900, 1070), fill=(0, 0, 0)))
        self.assertGreater(export.corner_ink(p), 0.004)

    def test_clear_corner(self):
        p = png(lambda d: d.rectangle((100, 100, 900, 1000), fill=(0, 0, 0)))
        self.assertLess(export.corner_ink(p), 0.004)


class Report(unittest.TestCase):
    def test_limits(self):
        rep = {'texts': [{'str': '아주 긴 커버 문장입니다', 'chars': 11, 'size': 120}], 'ink': [300, 400, 1500, 700], 'W': 1920, 'H': 1080}
        w = ' '.join(export.cover_warnings(rep))
        self.assertIn('characters', w); self.assertIn('px', w); self.assertIn('of the height', w)

    def test_clean(self):
        rep = {'texts': [{'str': '시간이 샌다', 'chars': 5, 'size': 240}], 'ink': [200, 100, 1700, 1080], 'W': 1920, 'H': 1080}
        self.assertEqual(export.cover_warnings(rep), [])


if __name__ == '__main__':
    unittest.main()
