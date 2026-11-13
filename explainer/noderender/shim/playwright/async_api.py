"""playwright stand-in for the explainer tools where no browser can start: each page is a Node + Skia process
(noderender/page.js) running the project's engine.js / docent.js / scenes.js from the current folder."""
import asyncio, json, os

PAGE_JS = os.environ.get('NODERENDER_JS', os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'page.js'))


class Page:
    def __init__(self):
        self.proc = None; self.handlers = {}; self._id = 0; self.lock = asyncio.Lock()

    def on(self, ev, fn):
        self.handlers.setdefault(ev, []).append(fn)

    def _errs(self, msg):
        for e in msg.get('errors') or []:
            for fn in self.handlers.get('pageerror', []): fn(e)

    async def _read(self):
        line = await self.proc.stdout.readline()
        if not line: raise RuntimeError('noderender page exited')
        return json.loads(line)

    async def goto(self, url, **kw):
        self.proc = await asyncio.create_subprocess_exec('node', PAGE_JS, os.getcwd(), stdin=asyncio.subprocess.PIPE,
                                                         stdout=asyncio.subprocess.PIPE, limit=1 << 30)
        self._errs(await self._read())

    async def evaluate(self, expr, arg=None):
        async with self.lock:
            self._id += 1
            self.proc.stdin.write((json.dumps({'id': self._id, 'expr': expr, 'arg': arg}) + '\n').encode())
            await self.proc.stdin.drain()
            msg = await self._read()
        self._errs(msg)
        if 'error' in msg: raise RuntimeError(msg['error'])
        return msg.get('value')

    async def wait_for_function(self, expr, timeout=30000, **kw):
        loop = asyncio.get_event_loop(); t0 = loop.time()
        while True:
            if await self.evaluate(expr): return True
            if (loop.time() - t0) * 1000 > timeout: raise TimeoutError(expr)
            await asyncio.sleep(0.05)

    async def close(self):
        if self.proc and self.proc.returncode is None:
            try: self.proc.stdin.close()
            except Exception: pass
            try: await asyncio.wait_for(self.proc.wait(), 5)
            except Exception: self.proc.kill()


class Browser:
    def __init__(self): self.pages = []
    async def new_page(self, **kw):
        p = Page(); self.pages.append(p); return p
    async def close(self):
        for p in self.pages: await p.close()


class BrowserType:
    async def launch(self, **kw): return Browser()


class PW:
    chromium = BrowserType(); firefox = BrowserType(); webkit = BrowserType()


class _Ctx:
    async def __aenter__(self): return PW()
    async def __aexit__(self, *a): return False


def async_playwright():
    return _Ctx()
