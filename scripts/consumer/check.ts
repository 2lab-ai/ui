// Consumer smoke test: compiled against the installed package (packed tarball or registry), not the source.
import { type ContextWindowData, fmtTokens, UiContextWindow } from '@2lab.ai/ui';
import { UiAgentInbox } from '@2lab.ai/ui/agent-inbox';
import { UiAgentQueue } from '@2lab.ai/ui/agent-queue';
import { UiAgentRun } from '@2lab.ai/ui/agent-run';
import { type AgentSteeringData, steerEnterAction, UiAgentSteering } from '@2lab.ai/ui/agent-steering';
import { type AgentTreeData, buildTree, UiAgentTree } from '@2lab.ai/ui/agent-tree';
import { UiAiAnswer } from '@2lab.ai/ui/ai-answer';
import { type AppBarData, appBarInitials, UiAppBar } from '@2lab.ai/ui/app-bar';
import { type ApprovalCardData, toPreview, UiApprovalCard } from '@2lab.ai/ui/approval-card';
import { type ArtifactViewerData, stepIndex, UiArtifactViewer } from '@2lab.ai/ui/artifact-viewer';
import { type BarChartData, niceScale, UiBarChart } from '@2lab.ai/ui/bar-chart';
import { type ChoiceFormData, UiChoiceForm } from '@2lab.ai/ui/choice-form';
import { type CompactBreakdownData, fmtShare, UiCompactBreakdown } from '@2lab.ai/ui/compact-breakdown';
import { type ComposerData, composerEnterAction, UiComposer } from '@2lab.ai/ui/composer';
import { UiContextWindow as UiContextWindowSub } from '@2lab.ai/ui/context-window';
import { type ConversationData, initialOf, UiConversation } from '@2lab.ai/ui/conversation';
import { type DeckNavData, deckClamp, UiDeckNav } from '@2lab.ai/ui/deck-nav';
import { type DialogCloseDetail, dialogSize, UiDialog } from '@2lab.ai/ui/dialog';
import { type DisclosureToggle, UiDisclosure } from '@2lab.ai/ui/disclosure';
import { clampDrawerWidth, type DrawerMode, UiDrawer } from '@2lab.ai/ui/drawer';
import { type FileItem, fileMeta, UiFileCard } from '@2lab.ai/ui/file-card';
import { GOAL_ARM_MS, type GoalCardData, UiGoalCard } from '@2lab.ai/ui/goal-card';
import { type IconName, icon } from '@2lab.ai/ui/icons';
import { KIT_CLASSES, kitCss } from '@2lab.ai/ui/kit';
import { type LogScrollerData, logJumpText, UiLogScroller } from '@2lab.ai/ui/log-scroller';
import { UiMemoryPanel } from '@2lab.ai/ui/memory-panel';
import { applyMenuSelect, type MenuData, UiMenu } from '@2lab.ai/ui/menu';
import type { ModelPickerData } from '@2lab.ai/ui/model-picker';
import { UiModelPicker } from '@2lab.ai/ui/model-picker';
import { type SegmentedData, segmentedOptions, UiSegmented } from '@2lab.ai/ui/segmented';
import { fmtMetric, type StatStripData, UiStatStrip } from '@2lab.ai/ui/stat-strip';
import { STATUS_ARM_MS, type StatusBarData, UiStatusBar } from '@2lab.ai/ui/status-bar';
import { type TabsData, tabItems, UiTabs } from '@2lab.ai/ui/tabs';
import { type TaskPlanData, taskFateCounts, UiTaskPlan } from '@2lab.ai/ui/task-plan';
import { type TaskRunsData, taskRunTotals, UiTaskRuns } from '@2lab.ai/ui/task-runs';
import { type ToasterData, toast, UiToaster } from '@2lab.ai/ui/toaster';
import { type ToolCallData, UiToolCallCard, UiToolCallGroup } from '@2lab.ai/ui/tool-call-card';
import { tooltipDelay, UiTooltip } from '@2lab.ai/ui/tooltip';
import { normGroups, UiWorkLog, type WorkLogData } from '@2lab.ai/ui/work-log';

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
// 0.6.0 surfaces.
const bar: AppBarData = { brand: { label: 'Workbench' }, status: { tone: 'done', label: 'Live' }, theme: 'light' };
const stats: StatStripData = { metrics: [{ key: 's', label: 'Sessions', value: 12 }] };
const chart: BarChartData = { title: 'Sessions', bars: [{ label: 'Mon', value: 3 }] };
const file: FileItem = { id: 'f', name: 'report.md', size: 2048 };
const shelf: ArtifactViewerData = { items: [file], layout: 'grid' };
const draft: ComposerData = { placeholder: 'Write a message…', maxLength: 4000 };
const appBar: HTMLElementTagNameMap['ui-app-bar'] = document.createElement('ui-app-bar');
const viewer: HTMLElementTagNameMap['ui-artifact-viewer'] = document.createElement('ui-artifact-viewer');
const composerEl: HTMLElementTagNameMap['ui-composer'] = document.createElement('ui-composer');
// Surfaces II (0.7.0).
const logCfg: LogScrollerData = { hasMore: true };
const log: HTMLElementTagNameMap['ui-log-scroller'] = document.createElement('ui-log-scroller');
const form: ChoiceFormData = { questions: [] };
const goal: GoalCardData = {};
const plan: TaskPlanData = { steps: [] };
const runs: TaskRunsData = { runs: [] };
const statusBar: StatusBarData = { status: 'running' };
const deck: DeckNavData = { index: 0, count: 3 };
const talk: ConversationData = { turns: [{ id: 't1', role: 'user', text: 'Hi', name: 'Ada' }] };
const work: WorkLogData = { groups: [{ id: 'g1', title: 'Build', entries: [] }] };
const convo: HTMLElementTagNameMap['ui-conversation'] = document.createElement('ui-conversation');
const worklog: HTMLElementTagNameMap['ui-work-log'] = document.createElement('ui-work-log');
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
  UiAppBar,
  UiStatStrip,
  UiBarChart,
  UiFileCard,
  UiArtifactViewer,
  UiComposer,
  UiLogScroller,
  UiChoiceForm,
  UiGoalCard,
  UiTaskPlan,
  UiTaskRuns,
  UiStatusBar,
  UiDeckNav,
  UiConversation,
  UiWorkLog,
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
  bar.status?.label,
  appBarInitials('Mina Park'),
  stats.metrics.length,
  fmtMetric(1234),
  chart.bars.length,
  niceScale(17).max,
  fileMeta(file, 0),
  shelf.items.length,
  stepIndex(0, 1, 3),
  draft.maxLength,
  composerEnterAction({ key: 'Enter', shiftKey: true, metaKey: false, ctrlKey: false, altKey: false }),
  appBar.tagName,
  viewer.tagName,
  composerEl.tagName,
  logCfg.hasMore,
  log.tagName,
  logJumpText(2),
  form.questions.length,
  goal,
  GOAL_ARM_MS,
  plan.steps.length,
  taskFateCounts(plan.steps),
  runs.runs.length,
  taskRunTotals(runs.runs),
  statusBar.status,
  STATUS_ARM_MS,
  deck.count,
  deckClamp(5, deck.count),
  talk.turns.length,
  initialOf('Ada'),
  convo.tagName,
  normGroups(work.groups).length,
  worklog.tagName,
);
