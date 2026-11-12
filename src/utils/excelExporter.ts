import * as XLSX from 'xlsx';
import { Session, SOPTemplate } from '../types';
import { stats, tplOf, sopOps, cleanT, fmtD, pctTxt, key } from './sopUtils';

export function exportSessionToExcel(session: Session, templates: SOPTemplate[]) {
  const st = stats(session, templates);
  const t = tplOf(session, templates);
  const A = st.active;
  const ops = sopOps(session, st);
  const wb = XLSX.utils.book_new();

  // Tab 1: Summary
  const sum: (string | number)[][] = [
    ['PERFORMANCE ASSESSMENT SOP - LINE PRODUCTION'],
    [],
    ['Factory', session.factory || '-'],
    ['Line', session.line],
    ['Produk / SOP', t.name],
    ['Tanggal', fmtD(session.date)],
    ['File #', session.file || '-'],
    ['Style #', session.style || '-'],
    ['File Sumber', `${session.fileName} (${session.sheet})`],
    [],
    ['Total Operator', st.opCount],
    ['Proses SOP Aktif', st.procCount],
    ['Total Check Point', st.total],
    ['Sudah Sesuai (☑)', st.done],
    ['Belum Sesuai (☐)', st.pending],
    ['% Compliance Rata-rata', pctTxt(st.pct)],
    [],
    ['Proses SOP', 'Proses Database', 'Tgl Mulai', 'Operator', 'Check Point', 'Sudah Sesuai', '% Compliance'],
    ...A.map((x) => [
      cleanT(x.b.t),
      x.p,
      (session.bdate || {})[x.bi] || '-',
      x.ops.length,
      x.tot,
      x.done,
      pctTxt(x.pct),
    ]),
  ];
  const wsSum = XLSX.utils.aoa_to_sheet(sum);
  wsSum['!cols'] = [{ wch: 32 }, { wch: 32 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsSum, 'Summary');

  // Tab 2: Checklist
  const ck: (string | number)[][] = [];
  A.forEach((x) => {
    ck.push([`${x.bi + 1}. ${cleanT(x.b.t)}`, `Tgl Mulai: ${(session.bdate || {})[x.bi] || '-'}`]);
    ck.push(['No.', 'Check Point', 'PIC', ...x.ops]);
    x.b.i.forEach(([tx, p], ii) => {
      ck.push([
        ii + 1,
        tx,
        p,
        ...x.ops.map((n) => (session.checks[key(x.bi, ii, n)] ? '☑' : '☐')),
      ]);
    });
    ck.push([]);
  });
  const wsC = XLSX.utils.aoa_to_sheet(ck);
  wsC['!cols'] = [{ wch: 6 }, { wch: 65 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsC, 'Checklist');

  // Tab 3: Operator
  const opData: (string | number)[][] = [
    ['Operator', 'Proses SOP', 'Sudah Sesuai', 'Total Check', '% Compliance'],
    ...st.per.map((o) => [
      o.name,
      o.proc.join(', '),
      o.done,
      o.tot,
      pctTxt(o.tot ? o.done / o.tot : 0),
    ]),
  ];
  const wsOp = XLSX.utils.aoa_to_sheet(opData);
  wsOp['!cols'] = [{ wch: 24 }, { wch: 45 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsOp, 'Operator');

  // Tab 4: Database Raw
  const dbData: (string | number | null)[][] = [
    [
      'Seq',
      'Process',
      'Machine',
      'Counter#',
      'Machine Code',
      'User ID',
      'User Name',
      'Target Qty',
      'Actual Qty',
      'Avg Qty',
      'Work Time',
      ...(session.hours || []),
    ],
    ...ops.map((o) => [
      o.seq,
      o.process,
      o.machine,
      o.counter,
      o.mc,
      o.uid,
      o.name,
      o.target,
      o.actual,
      o.avg,
      o.wt,
      ...o.h,
    ]),
  ];
  const wsDb = XLSX.utils.aoa_to_sheet(dbData);
  XLSX.utils.book_append_sheet(wb, wsDb, 'Database');

  const safeFactory = (session.factory || 'Factory').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeLine = session.line.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeTpl = t.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = session.date || 'NoDate';
  XLSX.writeFile(wb, `Assessment_${safeFactory}_${safeLine}_${safeTpl}_${dateStr}.xlsx`);
}
