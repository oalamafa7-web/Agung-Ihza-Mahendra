import { Session, SOPTemplate, SessionStats, BlockStat, OperatorStat, OperatorRow, SOPBlock } from '../types';

export const norm = (s: unknown): string =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export const cleanT = (t: string): string => String(t).replace(/\s*:\s*$/, '').trim();

export const key = (bi: number, ii: number, n: string): string => `${bi}|${ii}|${n}`;

export const num = (v: unknown): number | null => {
  if (v === '' || v == null || isNaN(Number(v))) return null;
  return Number(v);
};

export const fmtN = (v: number | null | undefined): string =>
  v == null ? '-' : Number(v).toLocaleString('id-ID');

export const pctTxt = (x: number): string => `${(x * 100).toFixed(1)}%`;

export const cls = (x: number): 'g' | 'y' | 'r' => (x >= 0.9 ? 'g' : x >= 0.6 ? 'y' : 'r');

const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const fmtD = (d: string | null | undefined): string => {
  const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[3])} ${BLN[Number(m[2]) - 1]} ${m[1]}` : d || '-';
};

const pad = (n: number | string): string => String(n).padStart(2, '0');

export const toYMD = (v: unknown): string => {
  if (v == null || v === '') return '';
  const s = String(v).trim();
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return s;
};

export const procs = (s: Session): string[] => [...new Set(s.ops.map((o) => o.process))];

export const autoMatch = (title: string, P: string[]): string => {
  const t = norm(cleanT(title).replace(/\s*-\s*[A-Za-z ,&/]+$/, ''));
  if (t.length < 5) return '';
  return (
    P.find((p) => norm(p) === t) ||
    P.find((p) => {
      const q = norm(p);
      return q.length >= 5 && (q.includes(t) || t.includes(q));
    }) ||
    ''
  );
};

export const blockProc = (s: Session, bi: number, b: SOPBlock, P?: string[]): string => {
  const pList = P || procs(s);
  if (s.map && Object.prototype.hasOwnProperty.call(s.map, bi)) {
    return s.map[bi];
  }
  if (b.m) {
    const f = pList.find((p) => norm(p) === norm(b.m));
    if (f) return f;
  }
  return autoMatch(b.t, pList);
};

export const tplOf = (s: Session, templates: SOPTemplate[]): SOPTemplate =>
  templates.find((t) => t.key === s.tpl) || {
    key: 'unknown',
    name: '(Template tidak ditemukan)',
    blocks: [],
  };

export const stats = (s: Session, templates: SOPTemplate[]): SessionStats => {
  const t = tplOf(s, templates);
  const P = procs(s);
  let total = 0;
  let done = 0;
  const per: Record<string, OperatorStat> = {};

  const blocks: BlockStat[] = t.blocks.map((b, bi) => {
    const p = blockProc(s, bi, b, P);
    const ops = p ? [...new Set(s.ops.filter((o) => o.process === p).map((o) => o.name))] : [];
    let d = 0;
    ops.forEach((n) => {
      per[n] = per[n] || { name: n, tot: 0, done: 0, proc: [] };
      per[n].tot += b.i.length;
      per[n].proc.push(cleanT(b.t));
      b.i.forEach((_, ii) => {
        if (s.checks[key(bi, ii, n)]) {
          d++;
          per[n].done++;
        }
      });
    });
    const tot = ops.length * b.i.length;
    total += tot;
    done += d;
    return { b, bi, p, ops, tot, done: d, pct: tot ? d / tot : 0 };
  });

  const active = blocks.filter((x) => x.ops.length > 0);
  const used = new Set(active.map((x) => x.p));

  return {
    blocks,
    active,
    used,
    total,
    done,
    pending: total - done,
    pct: total ? done / total : 0,
    opCount: Object.keys(per).length,
    procCount: active.length,
    per: Object.values(per),
  };
};

export const sopOps = (s: Session, st: SessionStats): OperatorRow[] =>
  s.ops.filter((o) => st.used.has(o.process));
