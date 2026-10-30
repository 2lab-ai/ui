import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * `@2lab.ai/ui/server` — the one entry with no element in it, built twice: `dist/server.js` (ESM) and
 * `dist/server.cjs` (CommonJS, the `require` condition) so a CommonJS server can render the auth card. Self-contained:
 * it shares no chunk with the element build (runs after it, into the same `dist/`).
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2022',
    minify: false,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/server/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'cjs' ? 'server.cjs' : 'server.js'),
    },
    rollupOptions: { output: { exports: 'named' } },
  },
});
