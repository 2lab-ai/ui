"""Asset gallery: draw every cast look, animal and prop on labelled sheets, so a person can review them BEFORE any
scene uses them (make-docent-book §4 gate). Run inside a project folder (needs timeline.json; a draft one is fine).

    python gallery.py [cast] [animals] [props] [figures]     # default: cast animals

Writes out/gallery_<kind>_<page>.jpg. Look at every sheet: each person must be told apart by silhouette alone (hair
or hat, height, outfit, accent colour), each animal must be named by a stranger in 2 seconds, nothing may be broken
or half drawn. Fix the look in scenes.js (cast(...)) or the primitive in docent.js, re-render, then write the scenes.
"""
import asyncio, base64, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from export import serve, open_page, OUT

JS = """([kind, pg]) => { DOCENT_FRAME(0); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H); const n = docentGallery(kind, pg);
  hand(kind + (n > 8 ? ' ' + (pg + 1) : ''), 80, 60, { size: 40, align: 'left', color: C.dim });
  return [n, document.getElementById('c').toDataURL('image/jpeg', 0.92).slice(23)]; }"""

async def main(kinds):
    from playwright.async_api import async_playwright
    srv, port = serve(); paths = []
    async with async_playwright() as pw:
        browser, page, errs = await open_page(pw, port)
        for kind in kinds:
            pg = 0
            while True:
                n, b64 = await page.evaluate(JS, [kind, pg])
                if n == 0: print(f'{kind}: nothing to show'); break
                p = os.path.join(OUT, f'gallery_{kind}_{pg + 1}.jpg'); open(p, 'wb').write(base64.b64decode(b64)); paths.append(p)
                pg += 1
                if pg * (12 if kind == 'props' else 8) >= n: break
        miss = await page.evaluate('[...MISS]')
        await browser.close()
    srv.shutdown()
    if errs: print('PAGE ERRORS:', errs)
    if miss: print('MISSING:', miss)
    print('\n'.join(paths))

if __name__ == '__main__':
    asyncio.run(main(sys.argv[1:] or ['cast', 'animals']))
