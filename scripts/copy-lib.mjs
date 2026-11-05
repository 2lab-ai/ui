// Ship the built library with the docs site: https://2lab.ai/ui/lib/index.js (+ per-component files, tokens.css).
// The site's base decides the folder (vite.site.config.ts): /ui/ → site-dist/ui/lib/.
import { cpSync, existsSync } from 'node:fs';

const dir = (process.env.SITE_BASE ?? '/ui/').replace(/^\/+|\/+$/g, '');
const from = new URL('../dist/', import.meta.url);
const to = new URL(`../site-dist/${dir ? `${dir}/` : ''}lib/`, import.meta.url);
if (!existsSync(from)) throw new Error('dist/ missing — run npm run build first');
cpSync(from, to, { recursive: true, filter: (p) => !p.endsWith('.map') });
console.log(`site-dist/${dir ? `${dir}/` : ''}lib ready`);
