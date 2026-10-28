import type { AgentTreeStatus } from './logic';

/**
 * UI copy. English by default, Korean with `lang="ko"` — the soma-work agent tree's wording (실행 중 · 완료 · 실패 ·
 * 중단 · 입력 대기 · 확인 불가 · 툴 N · 하위 N).
 */
const en = {
  title: 'Agents',
  status: {
    running: 'Running',
    waiting: 'Waiting',
    needs_you: 'Needs you',
    done: 'Done',
    failed: 'Failed',
    cancelled: 'Cancelled',
    unknown: 'Unknown',
  } satisfies Record<AgentTreeStatus, string>,
  agents: (n: number) => (n === 1 ? '1 agent' : `${n} agents`),
  running: (n: number) => `${n} running`,
  needsYou: (n: number) => `${n} needs you`,
  failed: (n: number) => `${n} failed`,
  tools: (n: number) => (n === 1 ? '1 tool' : `${n} tools`),
  tok: (s: string) => `${s} tok`,
  /** The folded branch's badge, read aloud. */
  folded: (n: number) => (n === 1 ? '1 sub-agent folded' : `${n} sub-agents folded`),
  below: (n: number) => (n === 1 ? '1 sub-agent' : `${n} sub-agents`),
  worstBelow: (status: string) => `${status.toLowerCase()} below`,
  branchCost: (branch: string, own: string) => `${branch} for this branch with its sub-agents (own ${own})`,
  branchTip: (n: number) => `This branch, with its ${n === 1 ? 'sub-agent' : `${n} sub-agents`}`,
  own: (s: string) => `own ${s}`,
  empty: 'No agents yet.',
  jump: (label: string) => `${label} — show it in the tree`,
};

export type AgentTreeStrings = typeof en;

const ko: AgentTreeStrings = {
  title: '에이전트',
  status: {
    running: '실행 중',
    waiting: '대기',
    needs_you: '입력 대기',
    done: '완료',
    failed: '실패',
    cancelled: '중단',
    unknown: '확인 불가',
  },
  agents: (n: number) => `에이전트 ${n}`,
  running: (n: number) => `실행 ${n}`,
  needsYou: (n: number) => `입력 대기 ${n}`,
  failed: (n: number) => `실패 ${n}`,
  tools: (n: number) => `툴 ${n}`,
  tok: (s: string) => `${s} tok`,
  folded: (n: number) => `하위 ${n} 접힘`,
  below: (n: number) => `하위 ${n}`,
  worstBelow: (status: string) => `하위에 ${status}`,
  branchCost: (branch: string, own: string) => `하위 에이전트 포함 ${branch} (자신 ${own})`,
  branchTip: (n: number) => `하위 에이전트 ${n}개를 포함한 브랜치 합계`,
  own: (s: string) => `자신 ${s}`,
  empty: '아직 에이전트가 없어요',
  jump: (label: string) => `${label} — 트리에서 보기`,
};

export const STRINGS = { en, ko };

export type AgentTreeLang = keyof typeof STRINGS;

export function agentTreeStrings(lang: string | null | undefined): AgentTreeStrings {
  return lang === 'ko' ? STRINGS.ko : STRINGS.en;
}
