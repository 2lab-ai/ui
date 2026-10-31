// Release gate: every package.json export target exists, and every relative import inside dist/**/*.d.ts and
// dist/*.js resolves to a file on disk (catches declaration paths that point at files the bundler never emitted).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const errors = [];
for (const [key, val] of Object.entries(pkg.exports)) {
  for (const target of typeof val === 'string' ? [val] : Object.values(val)) {
    if (!existsSync(join(root, target))) errors.push(`exports["${key}"] → ${target} missing`);
  }
}
// node10 consumers reach subpath types through typesVersions: those targets must exist too.
for (const map of Object.values(pkg.typesVersions ?? {}))
  for (const [key, targets] of Object.entries(map))
    for (const target of targets)
      if (!existsSync(join(root, target))) errors.push(`typesVersions["${key}"] → ${target} missing`);
const SPEC = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]+)\1/g;
let checked = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.d.ts') || (p.endsWith('.js') && dirname(p) === resolve(root, 'dist'))) scan(p);
  }
}
function scan(file) {
  for (const m of readFileSync(file, 'utf8').matchAll(SPEC)) {
    checked++;
    const spec = m[2];
    const base = join(dirname(file), spec);
    const ok = file.endsWith('.d.ts') ? existsSync(base.replace(/\.js$/, '.d.ts')) : existsSync(base);
    if (!ok) errors.push(`${file.slice(root.length)}: '${spec}' does not resolve`);
  }
}
walk(join(root, 'dist'));
if (errors.length) {
  console.error(`check-dist: ${errors.length} problem(s)\n${errors.join('\n')}`);
  process.exit(1);
}
console.log(`check-dist: ${Object.keys(pkg.exports).length} exports ok, ${checked} relative imports resolve`);
