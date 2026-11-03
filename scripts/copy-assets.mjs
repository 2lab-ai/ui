// After the lib and server builds: write dist/tokens.css from the server entry's tokensCss (src/core/tokens.ts), and
// dist/ui-kit.css from the built kit module (kitCss — one source for the string export and the file).
import { writeFileSync } from 'node:fs';

// The server entry carries no element, so it loads in Node: its tokensCss is the one generator (src/core/tokens.ts).
const { tokensCss: css } = await import(new URL('../dist/server.js', import.meta.url).href);
if (typeof css !== 'string' || !css.includes('--ui-text:') || !css.includes('[data-palette="mono"]'))
  throw new Error('dist/server.js does not export the tokensCss with its mono palette');
writeFileSync(new URL('../dist/tokens.css', import.meta.url), css);
console.log('dist/tokens.css', css.length, 'bytes');

const { kitCss } = await import(new URL('../dist/kit.js', import.meta.url).href);
if (typeof kitCss !== 'string' || !kitCss.includes('.ui-btn')) throw new Error('dist/kit.js does not export kitCss');
writeFileSync(new URL('../dist/ui-kit.css', import.meta.url), kitCss);
console.log('dist/ui-kit.css', kitCss.length, 'bytes');
