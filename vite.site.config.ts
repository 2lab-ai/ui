import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * The docs live at https://2lab.ai/ui: the site is built for the base `/ui/` and lands in `site-dist/ui/`, so the ui
 * Vercel project serves the same paths the 2lab.ai site proxies (`/ui/:path*`). `SITE_BASE=/` builds it for a root.
 */
const base = process.env.SITE_BASE ?? '/ui/';
const dir = base.replace(/^\/+|\/+$/g, '');

export default defineConfig({
  base,
  root: resolve(__dirname, 'site'),
  publicDir: resolve(__dirname, 'site/public'),
  resolve: { alias: { '@2lab.ai/ui': resolve(__dirname, 'src') } },
  build: { outDir: resolve(__dirname, 'site-dist', dir), emptyOutDir: true, target: 'es2022' },
});
