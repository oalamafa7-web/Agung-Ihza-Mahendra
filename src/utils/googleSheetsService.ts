import { Session, SOPTemplate } from '../types';
import { findHeader, parseDB, parseSOP } from './excelParser';
import { cleanT, fmtD, key, norm, pctTxt, sopOps, stats, tplOf } from './sopUtils';

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
  owners?: { displayName?: string; emailAddress?: string }[];
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: { sheetId: number; title: string }[];
}

export class GoogleAuthExpiredError extends Error {
  constructor(message = 'Sesi login Google telah berakhir. Silakan masuk kembali.') {
    super(message);
    this.name = 'GoogleAuthExpiredError';
  }
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  return trimmed;
}

async function googleFetch(url: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (res.status === 401) {
    throw new GoogleAuthExpiredError();
  }

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      errMsg = errBody?.error?.message || errMsg;
    } catch {
      // ignore json parse error
    }
    throw new Error(errMsg);
  }

  return res.json();
}

/**
 * List Google Spreadsheets from Google Drive
 */
export async function listGoogleSpreadsheets(
  accessToken: string,
  searchQuery = ''
): Promise<DriveSpreadsheetFile[]> {
  const escaped = searchQuery.trim().replace(/'/g, "\\'");
  const qParts = [
    "mimeType='application/vnd.google-apps.spreadsheet'",
    'trashed=false',
  ];
  if (escaped) {
    qParts.push(`name contains '${escaped}'`);
  }

  const params = new URLSearchParams({
    q: qParts.join(' and '),
    fields: 'files(id,name,modifiedTime,webViewLink,owners(displayName,emailAddress))',
    orderBy: 'modifiedTime desc',
    pageSize: '25',
    includeItemsFromAllDrives: 'true',
    supportsAllDrives: 'true',
  });

  const data = await googleFetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    accessToken
  );

  return Array.isArray(data.files) ? data.files : [];
}

/**
 * Fetch spreadsheet metadata including actual sheet tab names
 */
export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetIdOrUrl: string
): Promise<SpreadsheetMetadata> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl);
  const data = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?fields=spreadsheetId,properties.title,spreadsheetUrl,sheets.properties(sheetId,title)`,
    accessToken
  );

  return {
    spreadsheetId: data.spreadsheetId || spreadsheetId,
    title: data.properties?.title || 'Untitled Spreadsheet',
    spreadsheetUrl:
      data.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    sheets: (data.sheets || []).map((s: any) => ({
      sheetId: s.properties?.sheetId ?? 0,
      title: s.properties?.title || 'Sheet',
    })),
  };
}

/**
 * Import sessions and/or SOP templates from selected Google Sheet tabs
 */
export async function importFromGoogleSheet(
  accessToken: string,
  spreadsheetIdOrUrl: string,
  templates: SOPTemplate[],
  selectedTabNames?: string[]
): Promise<{
  sessions: Session[];
  newTemplates: SOPTemplate[];
  metadata: SpreadsheetMetadata;
}> {
  const metadata = await getSpreadsheetMetadata(accessToken, spreadsheetIdOrUrl);
  const tabsToRead =
    selectedTabNames && selectedTabNames.length > 0
      ? metadata.sheets.filter((s) => selectedTabNames.includes(s.title))
      : metadata.sheets;

  if (tabsToRead.length === 0) {
    throw new Error('Tidak ada tab sheet yang dipilih untuk diimpor.');
  }

  const params = new URLSearchParams({
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  tabsToRead.forEach((tab) => {
    const safeTitle = `'${tab.title.replace(/'/g, "''")}'`;
    params.append('ranges', safeTitle);
  });

  const batchData = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      metadata.spreadsheetId
    )}/values:batchGet?${params.toString()}`,
    accessToken
  );

  const valueRanges: { range: string; values?: unknown[][] }[] =
    batchData.valueRanges || [];

  const updatedTemplates: SOPTemplate[] = [...templates];
  const newSessions: Session[] = [];

  // First pass: extract SOP template definitions
  tabsToRead.forEach((tab, index) => {
    const rows = valueRanges[index]?.values || [];
    if (rows.length === 0 || findHeader(rows) >= 0) return;

    const blocks = parseSOP(rows);
    if (blocks.length > 0) {
      const exIdx = updatedTemplates.findIndex(
        (t) => norm(t.name) === norm(tab.title)
      );
      if (exIdx >= 0) {
        updatedTemplates[exIdx] = { ...updatedTemplates[exIdx], blocks };
      } else {
        updatedTemplates.push({
          key: 'tpl_' + norm(tab.title) + '_' + Date.now(),
          name: tab.title.trim(),
          blocks,
        });
      }
    }
  });

  // Second pass: extract production line database sessions
  tabsToRead.forEach((tab, index) => {
    const rows = valueRanges[index]?.values || [];
    const h = findHeader(rows);
    if (h < 0) return;

    const s = parseDB(rows, h, tab.title, metadata.title, updatedTemplates);
    if (s.ops.length > 0) {
      s.googleSheetId = metadata.spreadsheetId;
      s.googleSheetUrl = metadata.spreadsheetUrl;
      newSessions.push(s);
    }
  });

  return {
    sessions: newSessions,
    newTemplates: updatedTemplates,
    metadata,
  };
}

/**
 * Build 4-tab 2D arrays matching Excel export structure
 */
function buildSessionSheetPayloads(session: Session, templates: SOPTemplate[]) {
  const st = stats(session, templates);
  const t = tplOf(session, templates);
  const A = st.active;
  const ops = sopOps(session, st);

  // Tab 1: Summary
  const summaryRows: (string | number)[][] = [
    ['PERFORMANCE ASSESSMENT SOP - LINE PRODUCTION'],
    [],
    ['Factory', session.factory || '-'],
    ['Line', session.line],
    ['Produk / SOP', t.name],
    ['Tanggal', fmtD(session.date)],
    ['File #', session.file || '-'],
    ['Style #', session.style || '-'],
    ['Sumber Data', `${session.fileName} (${session.sheet})`],
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

  // Tab 2: Checklist
  const checklistRows: (string | number)[][] = [];
  A.forEach((x) => {
    checklistRows.push([
      `${x.bi + 1}. ${cleanT(x.b.t)}`,
      `Tgl Mulai: ${(session.bdate || {})[x.bi] || '-'}`,
    ]);
    checklistRows.push(['No.', 'Check Point', 'PIC', ...x.ops]);
    x.b.i.forEach(([tx, p], ii) => {
      checklistRows.push([
        ii + 1,
        tx,
        p,
        ...x.ops.map((n) => (session.checks[key(x.bi, ii, n)] ? '☑' : '☐')),
      ]);
    });
    checklistRows.push([]);
  });
  if (checklistRows.length === 0) {
    checklistRows.push(['Belum ada proses SOP terpetakan untuk sesi ini.']);
  }

  // Tab 3: Operator
  const operatorRows: (string | number)[][] = [
    ['Operator', 'Proses SOP', 'Sudah Sesuai', 'Total Check', '% Compliance'],
    ...st.per.map((o) => [
      o.name,
      o.proc.join(', '),
      o.done,
      o.tot,
      pctTxt(o.tot ? o.done / o.tot : 0),
    ]),
  ];

  // Tab 4: Database
  const databaseRows: (string | number | string)[][] = [
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
      o.target ?? '',
      o.actual ?? '',
      o.avg ?? '',
      o.wt ?? '',
      ...o.h.map((v) => (v == null ? '' : v)),
    ]),
  ];

  return [
    { title: 'Summary', values: summaryRows },
    { title: 'Checklist', values: checklistRows },
    { title: 'Operator', values: operatorRows },
    { title: 'Database', values: databaseRows },
  ];
}

/**
 * Create a brand-new Google Spreadsheet for an audit session
 */
export async function createGoogleSheetFromSession(
  accessToken: string,
  session: Session,
  templates: SOPTemplate[]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; title: string }> {
  const t = tplOf(session, templates);
  const title = `SOP Assessment - ${session.factory || 'Factory 1'} - ${session.line} (${t.name}) - ${
    session.date || 'NoDate'
  }`;

  const tabs = buildSessionSheetPayloads(session, templates);

  const created = await googleFetch(
    'https://sheets.googleapis.com/v4/spreadsheets',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        properties: { title },
        sheets: tabs.map((tab) => ({ properties: { title: tab.title } })),
      }),
    }
  );

  const spreadsheetId = created.spreadsheetId;
  const spreadsheetUrl =
    created.spreadsheetUrl ||
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: tabs.map((tab) => ({
          range: `'${tab.title}'!A1`,
          majorDimension: 'ROWS',
          values: tab.values,
        })),
      }),
    }
  );

  return { spreadsheetId, spreadsheetUrl, title };
}

/**
 * Overwrite / sync an existing Google Spreadsheet with current session audit results.
 * Note: Caller MUST present an explicit user confirmation dialog before invoking this!
 */
export async function updateExistingGoogleSheet(
  accessToken: string,
  spreadsheetIdOrUrl: string,
  session: Session,
  templates: SOPTemplate[]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; title: string }> {
  const metadata = await getSpreadsheetMetadata(accessToken, spreadsheetIdOrUrl);
  const tabs = buildSessionSheetPayloads(session, templates);
  const existingTitles = new Set(metadata.sheets.map((s) => s.title));

  // Add any missing target tabs
  const missingTabs = tabs.filter((tab) => !existingTitles.has(tab.title));
  if (missingTabs.length > 0) {
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        metadata.spreadsheetId
      )}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: missingTabs.map((tab) => ({
            addSheet: { properties: { title: tab.title } },
          })),
        }),
      }
    );
  }

  // Clear existing data in target tabs before writing fresh data
  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      metadata.spreadsheetId
    )}/values:batchClear`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        ranges: tabs.map((tab) => `'${tab.title}'`),
      }),
    }
  );

  // Write updated values
  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      metadata.spreadsheetId
    )}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: tabs.map((tab) => ({
          range: `'${tab.title}'!A1`,
          majorDimension: 'ROWS',
          values: tab.values,
        })),
      }),
    }
  );

  return {
    spreadsheetId: metadata.spreadsheetId,
    spreadsheetUrl: metadata.spreadsheetUrl,
    title: metadata.title,
  };
}
