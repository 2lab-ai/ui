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
  'hovercard',
  'dialog',
  'drawer',
  'disclosure',
  'app-bar',
  'stat-strip',
  'bar-chart',
  'file-card',
  'artifact-viewer',
  'composer',
  'log-scroller',
  'goal-card',
  'choice-form',
  'task-plan',
  'task-runs',
  'status-bar',
  'deck-nav',
  'conversation',
  'work-log',
  'setting-row',
  'settings-nav',
  'knowledge-pages',
  'episode-log',
  'auth-card',
  'elapsed',
  'media-grid',
  'meter',
  'breadcrumbs',
];
/**
 * `@2lab.ai/ui/server` is not here: vite.server.config.ts builds it (ESM + CommonJS, self-contained) into the same
 * dist/ right after this build.
 * Non-element entries: the icon set, the CSS kit (as a string; copy-assets also writes dist/ui-kit.css) and the sound
 * policy. `sound-cuelume` is its own entry so Cuelume (bundled from the devDependency) loads only when a page asks.
 */
const MODULES = ['icons', 'kit', 'sound'];

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
        'sound-cuelume': resolve(__dirname, 'src/sound/cuelume.ts'),
      },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
    },
  },
});
