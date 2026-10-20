/**
 * 数据契约 —— 严格对应 public/data/*.json
 * 规格见 TRAE-BUILD-SPEC.md 第 3 节
 */

export type CommitType =
  | "feat" | "fix" | "refactor" | "perf" | "docs" | "test"
  | "ci" | "chore" | "style" | "build" | "revert" | "release"
  | "merge" | "other";

export interface Layer {
  seq: number;
  sha: string;
  repo: string;
  repoShort: string;
  fork: boolean;
  message: string;
  body: string;
  author: string;
  authorEmail: string;
  date: string;
  localDate: string;
  localHour: number;
  night: boolean;
  weekend: boolean;
  own: boolean;
  type: CommitType;
  color: string;
  prefix: string;
  additions: number;
  deletions: number;
  files: number;
  big: boolean;
  creature: boolean;
}

export interface TowerStats {
  typeCount: Record<string, number>;
  repoCount: Record<string, number>;
  byDate: Record<string, number>;
  byHour: Record<string, number>;
  nightCount: number;
  weekendCount: number;
  ownCount: number;
  totalLinesChanged: number;
  busiestDate: string;
  busiestDateCount: number;
  biggestCommits: Array<{
    sha: string; repo: string; message: string;
    additions: number; deletions: number; date: string;
  }>;
  topRepos: Array<[string, number]>;
}

export interface TowerMeta {
  kind: "account" | "repo";
  login: string;
  name?: string;
  avatar?: string;
  profile?: string;
  accountCreated?: string;
  publicRepos?: number;
  repoCount?: number;
  totalCommitsAllRepos?: number;
  ownCommitsTotal?: number;
  ownRatio?: number;
  repo?: string;
  full?: string;
  description?: string;
  htmlUrl?: string;
  fork?: boolean;
  parent?: string | null;
  totalCommits?: number;
  generatedAt: string;
  layerCount: number;
  spanStart: string | null;
  spanEnd: string | null;
  limitMark: number;
}

export interface RepoBookEntry {
  name: string;
  total: number;
  own: number;
  fork: boolean;
}

export interface TowerData {
  meta: TowerMeta;
  stats: TowerStats;
  layers: Layer[];
  repoBook?: RepoBookEntry[];
}

export const LIMIT_MARK = 1024;
