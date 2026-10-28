// Consumer smoke test: compiled against the installed package (packed tarball or registry), not the source.
import { type ContextWindowData, fmtTokens, UiContextWindow } from '@2lab.ai/ui';
import { UiAgentInbox } from '@2lab.ai/ui/agent-inbox';
import { UiAgentQueue } from '@2lab.ai/ui/agent-queue';
import { UiAgentRun } from '@2lab.ai/ui/agent-run';
import { UiAiAnswer } from '@2lab.ai/ui/ai-answer';
import { type ApprovalCardData, toPreview, UiApprovalCard } from '@2lab.ai/ui/approval-card';
import { type CompactBreakdownData, fmtShare, UiCompactBreakdown } from '@2lab.ai/ui/compact-breakdown';
import { UiContextWindow as UiContextWindowSub } from '@2lab.ai/ui/context-window';
import { UiMemoryPanel } from '@2lab.ai/ui/memory-panel';
import type { ModelPickerData } from '@2lab.ai/ui/model-picker';
import { UiModelPicker } from '@2lab.ai/ui/model-picker';
import { type ToasterData, toast, UiToaster } from '@2lab.ai/ui/toaster';
import { type ToolCallData, UiToolCallCard, UiToolCallGroup } from '@2lab.ai/ui/tool-call-card';

const d: ContextWindowData = { window: 1000 };
const m: Partial<ModelPickerData> = {};
const el: HTMLElementTagNameMap['ui-memory-panel'] = document.createElement('ui-memory-panel');
const call: ToolCallData = { name: 'Read', status: 'interrupted' };
const group: HTMLElementTagNameMap['ui-tool-call-group'] = document.createElement('ui-tool-call-group');
const split: CompactBreakdownData = {
  title: 'Spend by model',
  unit: 'usd',
  parts: [{ key: 'a', label: 'a', value: 1 }],
};
const card: HTMLElementTagNameMap['ui-compact-breakdown'] = document.createElement('ui-compact-breakdown');
const ask: ApprovalCardData = { kind: 'permission', id: 'ap1', tool: 'Bash', input: { command: 'ls' } };
const approval: HTMLElementTagNameMap['ui-approval-card'] = document.createElement('ui-approval-card');
const stackCfg: ToasterData = { placement: 'bottom-right', visible: 3 };
const stack: HTMLElementTagNameMap['ui-toaster'] = document.createElement('ui-toaster');
const classes = [
  UiAgentInbox,
  UiAgentQueue,
  UiAgentRun,
  UiAiAnswer,
  UiApprovalCard,
  UiCompactBreakdown,
  UiContextWindowSub,
  UiMemoryPanel,
  UiModelPicker,
  UiToaster,
  UiToolCallCard,
  UiToolCallGroup,
];
console.log(
  UiContextWindow.name,
  classes.length,
  fmtTokens(1500),
  d.window,
  m,
  el.tagName,
  call.name,
  group.tagName,
  split.parts.length,
  card.tagName,
  fmtShare(0.4),
  ask.id,
  approval.tagName,
  toPreview({ command: 'ls' }).command,
  stackCfg.visible,
  stack.tagName,
  typeof toast.success,
);
