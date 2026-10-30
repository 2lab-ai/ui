import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const COMPONENTS = [
  'agent-inbox',
  'agent-run',
  'ai-answer',
  'context-window',
  'model-picker',
  'memory-panel',
  'agent-queue',
  'tool-call-card',
  'compact-breakdown',
  'approval-card',
  'toaster',
  'agent-steering',
  'agent-tree',
  'segmented',
  'tabs',
  'menu',
  'tooltip',
  'dialog',
  'drawer',
  'disclosure',
  'app-bar',
  'stat-strip',
  'bar-chart',
  'file-card',
  'artifact-viewer',
  'composer',
];
/** Non-element entries: the icon set and the CSS kit (as a string; copy-assets also writes dist/ui-kit.css). */
const MODULES = ['icons', 'kit'];

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    minify: false,
    sourcemap: true,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        ...Object.fromEntries(COMPONENTS.map((c) => [c, resolve(__dirname, `src/components/${c}/index.ts`)])),
        ...Object.fromEntries(MODULES.map((m) => [m, resolve(__dirname, `src/${m}/index.ts`)])),
      },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
    },
  },
});
