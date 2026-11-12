import * as XLSX from 'xlsx';
import { Session, SOPBlock, SOPTemplate, OperatorRow } from '../types';
import { norm, cleanT, num, toYMD, autoMatch } from './sopUtils';

const COLS: Record<string, string[]> = {
  dt: ['dt', 'date', 'tanggal'],
  factory: ['factory', 'pabrik', 'plant', 'fac'],
  line: ['line'],
  file: ['file', 'fileno'],
  style: ['style', 'styleno'],
  seq: ['seq'],
  process: ['process', 'proses'],
  machine: ['machine', 'mesin'],
  counter: ['counter', 'counterno'],
  mc: ['machinecode'],
  uid: ['userid', 'nik'],
  name: ['username', 'nama', 'operator'],
  target: ['targetqty', 'target'],
  actual: ['actualqty', 'actual', 'output'],
  avg: ['avgqty', 'avg'],
  wt: ['worktime'],
};

export function findHeader(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const n = (rows[i] || []).map((c) => norm(c));
    if (n.includes('process') && (n.includes('username') || n.includes('nama') || n.includes('operator'))) {
      return i;
    }
  }
  return -1;
}

export function parseDB(
  rows: unknown[][],
  h: number,
  sheetName: string,
  fileName: string,
  templates: SOPTemplate[]
): Session {
  const H = rows[h] || [];
  const idx: Record<string, number> = {};

  H.forEach((c, i) => {
    const n = norm(c);
    for (const k in COLS) {
      if (idx[k] === undefined && COLS[k].includes(n)) {
        idx[k] = i;
      }
    }
  });

  const used = Object.values(idx);
  const hourCols: { i: number; l: string }[] = [];

  H.forEach((c, i) => {
    const s = String(c ?? '');
    if (/\d{1,2}[:.]\d{2}/.test(s) && !used.includes(i)) {
      hourCols.push({
        i,
        l: s.replace(/\s*\n\s*/g, '-').replace(/\s*~\s*/g, '-'),
      });
    }
  });

  const ops: OperatorRow[] = [];
  const first: Record<string, unknown> = {};

  for (let r = h + 1; r < rows.length; r++) {
    const R = rows[r] || [];
    const g = (k: string) => (idx[k] === undefined ? '' : R[idx[k]] ?? '');

    ['dt', 'line', 'file', 'style', 'factory'].forEach((k) => {
      const v = g(k);
      if (first[k] === undefined && v !== '') first[k] = v;
    });

    const process = String(g('process')).trim();
    const name = String(g('name')).trim();
    if (!process || !name) continue;

    ops.push({
      seq: String(g('seq')).trim(),
      process,
      machine: String(g('machine')).trim(),
      counter: String(g('counter')).trim(),
      mc: String(g('mc')).trim(),
      uid: String(g('uid')).trim(),
      name,
      target: num(g('target')),
      actual: num(g('actual')),
      avg: num(g('avg')),
      wt: num(g('wt')),
      h: hourCols.map((c) => num(R[c.i])),
    });
  }

  const keep = hourCols.map((_, j) => ops.some((o) => o.h[j] !== null));
  ops.forEach((o) => {
    o.h = o.h.filter((_, j) => keep[j]);
  });

  let line = String(first.line || '').trim();
  if (!line) {
    const c = ops.find((o) => /^[\w]+-/.test(o.counter));
    line = c ? c.counter.split('-')[0] : sheetName.trim();
  }

  const factory = String(first.factory || '').trim() || 'Factory 1';

  // Format date if numeric date code
  let parsedDate = '';
  if (first.dt != null && first.dt !== '') {
    if (typeof first.dt === 'number') {
      const d = XLSX.SSF.parse_date_code(first.dt);
      if (d) parsedDate = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    } else {
      parsedDate = toYMD(first.dt);
    }
  }

  const uniqueProcs = [...new Set(ops.map((o) => o.process))];

  return {
    id: 's' + Date.now() + Math.random().toString(36).slice(2, 7),
    factory,
    line,
    date: parsedDate,
    file: String(first.file || '').trim(),
    style: String(first.style || '').trim(),
    fileName,
    sheet: sheetName.trim(),
    ops,
    hours: hourCols.filter((_, j) => keep[j]).map((c) => c.l),
    tpl: guessTpl(sheetName, uniqueProcs, templates),
    map: {},
    checks: {},
    bdate: {},
    created: Date.now(),
  };
}

export function parseSOP(rows: unknown[][]): SOPBlock[] {
  const blocks: SOPBlock[] = [];
  const map: Record<string, string> = {};

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length - 2; c++) {
      if (
        String(row[c]).trim() === 'No.' &&
        String(row[c + 2]).trim().toUpperCase() === 'PIC' &&
        String(row[c + 1]).trim()
      ) {
        const rawTitle = String(row[c + 1]).trim();
        const b: SOPBlock & { _raw?: string } = {
          t: cleanT(rawTitle),
          m: '',
          i: [],
          _raw: rawTitle,
        };
        let k = r + 1;
        while (k < rows.length) {
          const x = rows[k] || [];
          const no = x[c];
          if (no === '' || no == null || isNaN(Number(no))) break;
          b.i.push([
            String(x[c + 1] ?? '').replace(/\s*\n\s*/g, ' ').trim(),
            String(x[c + 2] ?? '').trim(),
          ]);
          k++;
        }
        if (b.i.length) blocks.push(b);
        break;
      }
      if (
        /^proses di/i.test(String(row[c]).trim()) &&
        /^proses di/i.test(String(row[c + 1]).trim())
      ) {
        for (let k = r + 1; k < rows.length; k++) {
          const a = String((rows[k] || [])[c] ?? '').trim();
          if (!a) break;
          map[norm(a)] = String((rows[k] || [])[c + 1] ?? '').trim();
        }
      }
    }
  }

  blocks.forEach((b: SOPBlock & { _raw?: string }) => {
    if (b._raw) {
      b.m = map[norm(b._raw)] || '';
      delete b._raw;
    }
  });

  return blocks;
}

export function guessTpl(sheetName: string, P: string[], templates: SOPTemplate[]): string {
  const sn = norm(sheetName);
  const PN = P.map(norm);
  let best = templates[0]?.key || '';
  let score = -1;

  templates.forEach((t) => {
    let sc = 0;
    if (norm(t.name) && sn.includes(norm(t.name))) sc += 100;
    t.blocks.forEach((b) => {
      if (b.m && PN.includes(norm(b.m))) sc += 2;
      else if (autoMatch(b.t, P)) sc += 1;
    });
    if (sc > score) {
      score = sc;
      best = t.key;
    }
  });

  return best;
}

export async function parseExcelFiles(
  files: File[],
  templates: SOPTemplate[]
): Promise<{ sessions: Session[]; newTemplates: SOPTemplate[] }> {
  const newSessions: Session[] = [];
  const updatedTemplates: SOPTemplate[] = [...templates];

  for (const f of files) {
    try {
      const buffer = await f.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheets = wb.SheetNames.map((sn) => ({
        sn,
        rows: XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: true }) as unknown[][],
      }));

      // First pass: extract SOP templates
      sheets.forEach(({ sn, rows }) => {
        if (findHeader(rows) >= 0) return;
        const blocks = parseSOP(rows);
        if (blocks.length) {
          const exIdx = updatedTemplates.findIndex((t) => norm(t.name) === norm(sn));
          if (exIdx >= 0) {
            updatedTemplates[exIdx] = { ...updatedTemplates[exIdx], blocks };
          } else {
            updatedTemplates.push({
              key: 'tpl_' + norm(sn) + '_' + Date.now(),
              name: sn.trim(),
              blocks,
            });
          }
        }
      });

      // Second pass: extract database line sessions
      sheets.forEach(({ sn, rows }) => {
        const h = findHeader(rows);
        if (h < 0) return;
        const s = parseDB(rows, h, sn, f.name, updatedTemplates);
        if (s.ops.length) {
          newSessions.push(s);
        }
      });
    } catch (err) {
      console.error('Error parsing file:', f.name, err);
      throw err;
    }
  }

  return { sessions: newSessions, newTemplates: updatedTemplates };
}
