// Make emitted .d.ts files resolvable under moduleResolution node16/nodenext: relative specifiers get an explicit
// `.js` (file) or `/index.js` (folder) extension, matching what tsc would resolve for `bundler` consumers.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const SPEC = /(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]+)\2/g;
let files = 0;
let rewrites = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.d.ts')) fix(p);
  }
}
function fix(file) {
  const src = readFileSync(file, 'utf8');
  const out = src.replace(SPEC, (m, lead, q, spec) => {
    if (/\.(js|mjs|cjs|json|css)$/.test(spec)) return m;
    const base = join(dirname(file), spec);
    let next = null;
    if (existsSync(`${base}.d.ts`)) next = `${spec}.js`;
    else if (existsSync(join(base, 'index.d.ts'))) next = `${spec}/index.js`;
    if (!next) return m;
    rewrites++;
    return `${lead}${q}${next}${q}`;
  });
  if (out !== src) {
    writeFileSync(file, out);
    files++;
  }
}
walk(dist);
console.log(`fix-dts: ${rewrites} specifiers in ${files} files`);
