// Consumer smoke test: compiled against the installed package (packed tarball or registry), not the source.
import { type ContextWindowData, fmtTokens, UiContextWindow } from '@2lab.ai/ui';
import { UiAgentInbox } from '@2lab.ai/ui/agent-inbox';
import { UiAgentQueue } from '@2lab.ai/ui/agent-queue';
import { UiAgentRun } from '@2lab.ai/ui/agent-run';
import { UiAiAnswer } from '@2lab.ai/ui/ai-answer';
import { UiContextWindow as UiContextWindowSub } from '@2lab.ai/ui/context-window';
import { UiMemoryPanel } from '@2lab.ai/ui/memory-panel';
import type { ModelPickerData } from '@2lab.ai/ui/model-picker';
import { UiModelPicker } from '@2lab.ai/ui/model-picker';
import { type ToolCallData, UiToolCallCard, UiToolCallGroup } from '@2lab.ai/ui/tool-call-card';

const d: ContextWindowData = { window: 1000 };
const m: Partial<ModelPickerData> = {};
const el: HTMLElementTagNameMap['ui-memory-panel'] = document.createElement('ui-memory-panel');
const call: ToolCallData = { name: 'Read', status: 'interrupted' };
const group: HTMLElementTagNameMap['ui-tool-call-group'] = document.createElement('ui-tool-call-group');
const classes = [
  UiAgentInbox,
  UiAgentQueue,
  UiAgentRun,
  UiAiAnswer,
  UiContextWindowSub,
  UiMemoryPanel,
  UiModelPicker,
  UiToolCallCard,
  UiToolCallGroup,
];
console.log(UiContextWindow.name, classes.length, fmtTokens(1500), d.window, m, el.tagName, call.name, group.tagName);
