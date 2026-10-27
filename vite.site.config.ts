import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(__dirname, 'site'),
  publicDir: resolve(__dirname, 'site/public'),
  resolve: { alias: { '@2lab.ai/ui': resolve(__dirname, 'src') } },
  build: { outDir: resolve(__dirname, 'site-dist'), emptyOutDir: true, target: 'es2022' },
});
