"""Tests for export.py audiobook helpers: chapter metadata and YouTube chapter lines (no audio, no ffmpeg)."""
import os, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(tempfile.mkdtemp())   # export.py makes out/ in the working folder on import
import export  # noqa: E402

TL = {'title': 'T', 'total': 125.5, 'scenes': [
    {'id': 'a', 'chip': '프롤로그', 'title': '책 한 권', 'start': 0.0},
    {'id': 'b', 'chip': '1 · 이상한 고리', 'title': '이상한 고리', 'start': 61.2},
    {'id': 'c', 'chip': '2 · 게임', 'title': 'MU = 퍼즐; #1', 'start': 3700.4}]}


class Audiobook(unittest.TestCase):
    def test_chapters_cover_the_whole_timeline(self):
        m = export.chapters_meta(TL, {'title': '괴델', 'book': {'author': '호프스태터', 'title': 'GEB'}})
        self.assertTrue(m.startswith(';FFMETADATA1\n'))
        self.assertEqual(m.count('[CHAPTER]'), 3)
        self.assertIn('START=0\nEND=61200\n', m)
        self.assertIn('START=61200\nEND=3700400\n', m)
        self.assertIn('START=3700400\nEND=125500\n', m)   # last chapter ends at the total
        self.assertIn('artist=호프스태터', m)

    def test_title_does_not_repeat_the_chip(self):
        self.assertEqual(export.chapter_title(TL['scenes'][1]), '1 · 이상한 고리')
        self.assertEqual(export.chapter_title(TL['scenes'][0]), '프롤로그 — 책 한 권')

    def test_metadata_special_characters_are_escaped(self):
        m = export.chapters_meta(TL, {})
        self.assertIn(r'title=2 · 게임 — MU \= 퍼즐\; \#1', m)

    def test_youtube_lines_start_at_zero_and_show_hours(self):
        lines = export.youtube_chapters(TL).splitlines()
        self.assertEqual(lines[0], '0:00 프롤로그 — 책 한 권')
        self.assertEqual(lines[1], '1:01 1 · 이상한 고리')
        self.assertTrue(lines[2].startswith('1:01:40 '))


if __name__ == '__main__':
    unittest.main()
