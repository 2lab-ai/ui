"""Does the streaming book carry the whole book? Checks an episode's book/ folder before any voice is made.
usage: python book/coverage.py <episode>/book [--min 0.8]
  coverage.json = [{"part": "책의 장/부", "section": "절 또는 사례", "lines": ["k012", ...], "pages": ["p07", ...]}]
                  every section of the book (from research_book.md, in book order) with the lines and pages that explain it
  lines.json    = the script; a line with "j": 1 is a joke, an exaggeration or an aside (owner: 20-30% of the lines)
  pages/pages.json = the prepared pages
Prints the sections nothing explains, the share covered, the spoken length (cwon ~4 syllables/s), the joke share and the
pages per minute; exits 1 when the share is under --min or a line/page id does not exist."""
import json, os, re, sys

d = sys.argv[1]
MIN = float(sys.argv[sys.argv.index('--min') + 1]) if '--min' in sys.argv else 0.8
cov = json.load(open(os.path.join(d, 'coverage.json')))
lines = json.load(open(os.path.join(d, 'lines.json')))
pages = json.load(open(os.path.join(d, 'pages', 'pages.json'))) if os.path.exists(os.path.join(d, 'pages', 'pages.json')) else []
L = {l['id']: l for l in lines}; P = {p['id'] for p in pages}
bad = [(c['section'], x) for c in cov for x in c.get('lines', []) if x not in L] + [(c['section'], x) for c in cov for x in c.get('pages', []) if x not in P]
miss = [c for c in cov if not c.get('lines')]
share = 1 - len(miss) / max(1, len(cov))
syl = lambda s: len(re.findall(r'[가-힣0-9]', s))
total = sum(syl(l.get('say') or l['text']) for l in lines)
est = total / 4.0 + 0.35 * len(lines)
jokes = sum(1 for l in lines if l.get('j'))
kinds = {}
for p in pages: kinds[p.get('kind', 'photo')] = kinds.get(p.get('kind', 'photo'), 0) + 1
part = None
for c in cov:
    if c['part'] != part: part = c['part']; print(f'\n[{part}]')
    print(f"  {'✓' if c.get('lines') else '✗'} {c['section']}  ({len(c.get('lines', []))} lines, {len(c.get('pages', []))} pages)")
print(f'\nsections {len(cov)}, covered {len(cov) - len(miss)} = {share:.0%} (min {MIN:.0%})')
print(f'lines {len(lines)}, syllables {total}, spoken ≈ {est / 60:.1f} min (+ page turns and marks)')
print(f'joke/aside lines {jokes} = {jokes / max(1, len(lines)):.0%} (owner: 20-30%)')
print(f'pages {len(pages)} {kinds}, ≈ {len(pages) / max(1e-6, est / 60):.1f} a minute; news/article pages {kinds.get("article", 0)}')
for s, x in bad: print('  unknown id', x, 'in', s)
sys.exit(1 if bad or share < MIN else 0)
