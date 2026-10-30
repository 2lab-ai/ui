import type { ComponentDoc } from './types';

/** Sidebar order (affectui-style: the screen first, then components). */
export const ORDER = [
  'agent-run',
  'agent-inbox',
  'agent-tree',
  'approval-card',
  'agent-steering',
  'composer',
  'ai-answer',
  'tool-call-card',
  'file-card',
  'artifact-viewer',
  'conversation',
  'work-log',
  'choice-form',
  'goal-card',
  'task-plan',
  'task-runs',
  'agent-queue',
  'context-window',
  'compact-breakdown',
  'stat-strip',
  'bar-chart',
  'toaster',
  'memory-panel',
  'model-picker',
  'app-bar',
  'status-bar',
  'deck-nav',
  'segmented',
  'tabs',
  'menu',
  'tooltip',
  'dialog',
  'drawer',
  'disclosure',
  'log-scroller',
];

const modules = import.meta.glob<{ doc: ComponentDoc }>('../components/*/docs.ts', { eager: true });

export const DOCS: ComponentDoc[] = Object.values(modules)
  .map((m) => m.doc)
  .filter(Boolean)
  .sort((a, b) => ORDER.indexOf(a.slug) - ORDER.indexOf(b.slug));

export function docBySlug(slug: string): ComponentDoc | undefined {
  return DOCS.find((d) => d.slug === slug);
}
