// Ship the built library with the demo site: https://ui.2lab.ai/lib/index.js (+ per-component files, tokens.css).
import { cpSync, existsSync } from 'node:fs';

const from = new URL('../dist/', import.meta.url);
const to = new URL('../site-dist/lib/', import.meta.url);
if (!existsSync(from)) throw new Error('dist/ missing — run npm run build first');
cpSync(from, to, { recursive: true, filter: (p) => !p.endsWith('.map') });
console.log('site-dist/lib ready');
