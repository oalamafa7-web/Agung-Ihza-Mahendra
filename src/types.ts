export interface OperatorRow {
  seq: string;
  process: string;
  machine: string;
  counter: string;
  mc: string;
  uid: string;
  name: string;
  target: number | null;
  actual: number | null;
  avg: number | null;
  wt: number | null;
  h: (number | null)[];
}

export type SOPItem = [instruction: string, pic: string];

export interface SOPBlock {
  t: string; // Title / process name
  m?: string; // Target database process mapping
  i: SOPItem[]; // List of checkpoints
}

export interface SOPTemplate {
  key: string;
  name: string;
  builtin?: boolean;
  blocks: SOPBlock[];
}

export interface Session {
  id: string;
  factory?: string;
  line: string;
  date: string;
  file: string;
  style: string;
  fileName: string;
  sheet: string;
  ops: OperatorRow[];
  hours: string[];
  tpl: string;
  map: Record<number, string>;
  checks: Record<string, 1>;
  bdate: Record<number, string>;
  created: number;
}

export interface BlockStat {
  b: SOPBlock;
  bi: number;
  p: string;
  ops: string[];
  tot: number;
  done: number;
  pct: number;
}

export interface OperatorStat {
  name: string;
  tot: number;
  done: number;
  proc: string[];
}

export interface SessionStats {
  blocks: BlockStat[];
  active: BlockStat[];
  used: Set<string>;
  total: number;
  done: number;
  pending: number;
  pct: number;
  opCount: number;
  procCount: number;
  per: OperatorStat[];
}
