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
];

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
      },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
    },
  },
});
