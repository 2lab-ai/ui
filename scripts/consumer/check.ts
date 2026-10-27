// Consumer smoke test: compiled against the packed tarball, not the source.
import { type ContextWindowData, fmtTokens, UiContextWindow } from '@2lab-ai/ui';
import { UiAgentRun } from '@2lab-ai/ui/agent-run';
import type { ModelPickerData } from '@2lab-ai/ui/model-picker';

const d: ContextWindowData = { window: 1000 };
const m: Partial<ModelPickerData> = {};
const el: HTMLElementTagNameMap['ui-memory-panel'] = document.createElement('ui-memory-panel');
console.log(UiContextWindow.name, UiAgentRun.name, fmtTokens(1500), d.window, m, el.tagName);
