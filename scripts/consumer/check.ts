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
import {
  type ArtifactClosedDetail,
  type ArtifactViewerData,
  peekHtml,
  stepIndex,
  UiArtifactViewer,
} from '@2lab.ai/ui/artifact-viewer';
import { type AuthCardData, authCardHtml, UiAuthCard } from '@2lab.ai/ui/auth-card';
import { type BarChartData, niceScale, UiBarChart } from '@2lab.ai/ui/bar-chart';
import { type ChoiceFormData, choiceFormLocked, UiChoiceForm } from '@2lab.ai/ui/choice-form';
import { type CompactBreakdownData, fmtShare, UiCompactBreakdown } from '@2lab.ai/ui/compact-breakdown';
import { type ComposerData, composerEnterAction, UiComposer } from '@2lab.ai/ui/composer';
import { UiContextWindow as UiContextWindowSub } from '@2lab.ai/ui/context-window';
import { type ConversationData, initialOf, UiConversation } from '@2lab.ai/ui/conversation';
import { type DeckNavData, deckClamp, UiDeckNav } from '@2lab.ai/ui/deck-nav';
import {
  type DialogCloseDetail,
  type DialogClosedDetail,
  type DialogViewport,
  dialogSize,
  UiDialog,
} from '@2lab.ai/ui/dialog';
import { type DisclosureToggle, UiDisclosure } from '@2lab.ai/ui/disclosure';
import { clampDrawerWidth, DRAWER_MORPH_MS, type DrawerMode, type DrawerViewport, UiDrawer } from '@2lab.ai/ui/drawer';
import { type ElapsedData, elapsedText, UiElapsed } from '@2lab.ai/ui/elapsed';
import { EPISODE_ARM_MS, type EpisodeLogData, episodeDays, UiEpisodeLog } from '@2lab.ai/ui/episode-log';
import { type FileItem, fileMeta, UiFileCard } from '@2lab.ai/ui/file-card';
import { GOAL_ARM_MS, type GoalCardData, goalMetaHtml, UiGoalCard } from '@2lab.ai/ui/goal-card';
import { type HovercardDetail, hovercardDelay, UiHovercard } from '@2lab.ai/ui/hovercard';
import { type IconName, icon } from '@2lab.ai/ui/icons';
import { KIT_CLASSES, kitCss } from '@2lab.ai/ui/kit';
import { filterPages, type KnowledgePagesData, UiKnowledgePages } from '@2lab.ai/ui/knowledge-pages';
import { type LogScrollerData, logJumpText, UiLogScroller } from '@2lab.ai/ui/log-scroller';
import { UiMemoryPanel } from '@2lab.ai/ui/memory-panel';
import { applyMenuSelect, type MenuData, UiMenu } from '@2lab.ai/ui/menu';
import type { ModelPickerData } from '@2lab.ai/ui/model-picker';
import { UiModelPicker } from '@2lab.ai/ui/model-picker';
import { type SegmentedData, segmentedOptions, UiSegmented } from '@2lab.ai/ui/segmented';
import {
  authCardCss,
  type AuthCardData as ServerAuthCardData,
  authCardHtml as serverAuthCardHtml,
} from '@2lab.ai/ui/server';
import { type SettingRowData, UiSettingRow } from '@2lab.ai/ui/setting-row';
import { applySettingsFilter, type SettingsNavData, settingMatches, UiSettingsNav } from '@2lab.ai/ui/settings-nav';
import { bindSound, playSound, type SoundCue, type SoundPlayer, setSound } from '@2lab.ai/ui/sound';
import { cuelumeSound, type SoundTheme, setSoundTheme, unlockSound } from '@2lab.ai/ui/sound-cuelume';
import { fmtMetric, type StatStripData, UiStatStrip } from '@2lab.ai/ui/stat-strip';
import { STATUS_ARM_MS, type StatusBarData, UiStatusBar } from '@2lab.ai/ui/status-bar';
import { type TabsData, tabItems, UiTabs } from '@2lab.ai/ui/tabs';
import { type TaskPlanData, taskFateCounts, UiTaskPlan } from '@2lab.ai/ui/task-plan';
import { type TaskRunsData, taskRunTotals, UiTaskRuns } from '@2lab.ai/ui/task-runs';
import { type ToasterData, toast, UiToaster } from '@2lab.ai/ui/toaster';
import { type ToolCallData, UiToolCallCard, UiToolCallGroup } from '@2lab.ai/ui/tool-call-card';
import { tooltipDelay, UiTooltip } from '@2lab.ai/ui/tooltip';
import { normGroups, UiWorkLog, type WorkLogData, workMetaHtml } from '@2lab.ai/ui/work-log';

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
const hidden: DialogClosedDetail = { reason: 'hide' };
const gone: ArtifactClosedDetail = { reason: 'host' };
// The server entry's types are the auth card's own.
const serverAuth: ServerAuthCardData = {
  title: 'Sign in',
  providers: [{ id: 'sso', label: 'Continue', href: '/auth/sso' }],
};
const vvs: [DialogViewport, DrawerViewport] = ['visual', 'layout'];
const peekDetail: HovercardDetail = { trigger: document.createElement('button') };
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
// Page parts and a live time (0.9.0).
const row: SettingRowData = { key: 'theme', label: 'Theme', status: { state: 'saved' }, locked: null };
const nav: SettingsNavData = { sections: [{ id: 'general', label: 'General' }] };
const pages: KnowledgePagesData = { pages: [{ id: 'p1', title: 'Deploy checklist', aliases: ['deploy'] }] };
const episodes: EpisodeLogData = { days: [{ date: '2026-10-30', entries: [{ time: '09:12', text: 'Noted' }] }] };
const auth: AuthCardData = { title: 'Sign in', providers: [{ id: 'sso', label: 'Continue', href: '/auth/sso' }] };
const timer: ElapsedData = { since: 0, format: 'clock' };
const navEl: HTMLElementTagNameMap['ui-settings-nav'] = document.createElement('ui-settings-nav');
const authEl: HTMLElementTagNameMap['ui-auth-card'] = document.createElement('ui-auth-card');
// Sound: the policy from the root and the subpath is one API; the Cuelume player has the SoundPlayer shape.
const player: SoundPlayer = cuelumeSound;
const cue: SoundCue = 'tap';
const theme: SoundTheme = 'mech';
setSound({ player, enabled: false });
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
  UiHovercard,
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
  UiSettingRow,
  UiSettingsNav,
  UiKnowledgePages,
  UiEpisodeLog,
  UiAuthCard,
  UiElapsed,
];
console.log(
  typeof bindSound,
  typeof playSound,
  cue,
  theme,
  typeof setSoundTheme,
  typeof unlockSound,
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
  vvs.join(),
  DRAWER_MORPH_MS,
  clampDrawerWidth(100, 320, 960, 1280),
  mode,
  toggled.open,
  tooltipDelay('200'),
  hovercardDelay('200'),
  peekDetail.trigger.tagName,
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
  row.label,
  nav.sections.length,
  settingMatches('Default model', 'model'),
  typeof applySettingsFilter,
  filterPages(pages.pages, 'deploy').length,
  episodeDays(episodes.days).length,
  EPISODE_ARM_MS,
  authCardHtml(auth).length,
  serverAuthCardHtml(serverAuth, { page: true }).length,
  authCardCss.length,
  hidden.reason,
  gone.reason,
  peekHtml(file, 'en').length,
  choiceFormLocked('Only the session owner can answer'),
  goalMetaHtml(['Day 3', { label: 'Budget', value: '$4.20' }]).length,
  workMetaHtml(['Done in 3m']).length,
  elapsedText(timer, 61_000),
  navEl.tagName,
  authEl.tagName,
);
