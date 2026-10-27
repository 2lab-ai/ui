// After the lib build: write dist/tokens.css from src/core/tokens.json (same generator as src/core/tokens.ts).
import { readFileSync, writeFileSync } from 'node:fs';

const t = JSON.parse(readFileSync(new URL('../src/core/tokens.json', import.meta.url), 'utf8'));
const vars = (set) =>
  Object.entries(set)
    .map(([k, v]) => `--ui-${k}: ${v};`)
    .join(' ');
const css = `/* @2lab-ai/ui design tokens — data-theme="dark|light" on any ancestor switches */
:root, [data-theme="light"] { ${vars(t.shared)} ${vars(t.light)} color-scheme: light; }
[data-theme="dark"] { ${vars(t.dark)} color-scheme: dark; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${vars(t.dark)} color-scheme: dark; } }
`;
writeFileSync(new URL('../dist/tokens.css', import.meta.url), css);
console.log('dist/tokens.css', css.length, 'bytes');
