// Consumer smoke test: compiled against the installed package (packed tarball or registry), not the source.
import { type ContextWindowData, fmtTokens, UiContextWindow } from '@2lab.ai/ui';
import { UiAgentInbox } from '@2lab.ai/ui/agent-inbox';
import { UiAgentQueue } from '@2lab.ai/ui/agent-queue';
import { UiAgentRun } from '@2lab.ai/ui/agent-run';
import { type AgentSteeringData, steerEnterAction, UiAgentSteering } from '@2lab.ai/ui/agent-steering';
import { type AgentTreeData, buildTree, UiAgentTree } from '@2lab.ai/ui/agent-tree';
import { UiAiAnswer } from '@2lab.ai/ui/ai-answer';
import { type ApprovalCardData, toPreview, UiApprovalCard } from '@2lab.ai/ui/approval-card';
import { type CompactBreakdownData, fmtShare, UiCompactBreakdown } from '@2lab.ai/ui/compact-breakdown';
import { UiContextWindow as UiContextWindowSub } from '@2lab.ai/ui/context-window';
import { type DialogCloseDetail, dialogSize, UiDialog } from '@2lab.ai/ui/dialog';
import { type DisclosureToggle, UiDisclosure } from '@2lab.ai/ui/disclosure';
import { clampDrawerWidth, type DrawerMode, UiDrawer } from '@2lab.ai/ui/drawer';
import { type IconName, icon } from '@2lab.ai/ui/icons';
import { KIT_CLASSES, kitCss } from '@2lab.ai/ui/kit';
import { UiMemoryPanel } from '@2lab.ai/ui/memory-panel';
import { applyMenuSelect, type MenuData, UiMenu } from '@2lab.ai/ui/menu';
import type { ModelPickerData } from '@2lab.ai/ui/model-picker';
import { UiModelPicker } from '@2lab.ai/ui/model-picker';
import { type SegmentedData, segmentedOptions, UiSegmented } from '@2lab.ai/ui/segmented';
import { type TabsData, tabItems, UiTabs } from '@2lab.ai/ui/tabs';
import { type ToasterData, toast, UiToaster } from '@2lab.ai/ui/toaster';
import { type ToolCallData, UiToolCallCard, UiToolCallGroup } from '@2lab.ai/ui/tool-call-card';
import { tooltipDelay, UiTooltip } from '@2lab.ai/ui/tooltip';

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
const steer: AgentSteeringData = { running: true, items: [{ id: 'q1', text: 'note', state: 'queued' }] };
const composer: HTMLElementTagNameMap['ui-agent-steering'] = document.createElement('ui-agent-steering');
const run: AgentTreeData = { nodes: [{ id: 'm', name: 'Main', status: 'running' }], density: 'compact' };
const agents: HTMLElementTagNameMap['ui-agent-tree'] = document.createElement('ui-agent-tree');
// Primitives, the icon set and the kit.
const seg: SegmentedData = { options: [{ value: 'd', label: 'Day' }], value: 'd' };
const tabs: TabsData = { tabs: [{ id: 'a', label: 'A' }], value: 'a' };
const menu: MenuData = { items: [{ kind: 'radio', value: 'a', label: 'A' }] };
const closed: DialogCloseDetail = { reason: 'escape' };
const mode: DrawerMode = 'dock';
const toggled: DisclosureToggle = { open: true };
const glyph: IconName = 'gear';
const dlg: HTMLElementTagNameMap['ui-dialog'] = document.createElement('ui-dialog');
const drawer: HTMLElementTagNameMap['ui-drawer'] = document.createElement('ui-drawer');
const classes = [
  UiAgentInbox,
  UiAgentQueue,
  UiAgentRun,
  UiAgentSteering,
  UiAgentTree,
  UiAiAnswer,
  UiApprovalCard,
  UiCompactBreakdown,
  UiContextWindowSub,
  UiMemoryPanel,
  UiModelPicker,
  UiToaster,
  UiToolCallCard,
  UiToolCallGroup,
  UiSegmented,
  UiTabs,
  UiMenu,
  UiTooltip,
  UiDialog,
  UiDrawer,
  UiDisclosure,
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
  steer.items?.length,
  composer.tagName,
  steerEnterAction({ key: 'Enter', shiftKey: false, metaKey: false, ctrlKey: false, altKey: false }),
  buildTree(run.nodes).all.length,
  agents.tagName,
  segmentedOptions(seg).length,
  tabItems(tabs).length,
  applyMenuSelect(menu.items, 0)[0].checked,
  closed.reason,
  dialogSize('lg'),
  clampDrawerWidth(100, 320, 960, 1280),
  mode,
  toggled.open,
  tooltipDelay('200'),
  icon(glyph).length,
  KIT_CLASSES.length,
  kitCss.length,
  dlg.tagName,
  drawer.tagName,
);
