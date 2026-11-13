import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { OperatorRow, Session, SOPBlock, SOPTemplate } from '../types';

const BOOTSTRAPPED_ADMIN_EMAIL = 'oalamafa7@gmail.com';

export function sanitizeFirestoreId(raw: string, prefix = 'id'): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 128);
  return cleaned.length > 0 ? cleaned : `${prefix}_${Date.now()}`;
}

function clampStr(val: unknown, maxLen: number, fallback = ''): string {
  const str = typeof val === 'string' ? val : val == null ? fallback : String(val);
  return str.slice(0, maxLen);
}

function sanitizeNumberRecord(obj: Record<string, any> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!obj || typeof obj !== 'object') return out;
  Object.entries(obj).forEach(([k, v]) => {
    if (k && v !== undefined && v !== null) {
      out[String(k)] = String(v).slice(0, 200);
    }
  });
  return out;
}

function sanitizeChecksRecord(obj: Record<string, 1> | undefined): Record<string, 1> {
  const out: Record<string, 1> = {};
  if (!obj || typeof obj !== 'object') return out;
  Object.entries(obj).forEach(([k, v]) => {
    if (k && v) {
      out[String(k).slice(0, 200)] = 1;
    }
  });
  return out;
}

function sanitizeOps(ops: OperatorRow[] | undefined): OperatorRow[] {
  if (!Array.isArray(ops)) return [];
  return ops.slice(0, 200).map((op) => ({
    seq: clampStr(op?.seq, 32, ''),
    process: clampStr(op?.process, 120, ''),
    machine: clampStr(op?.machine, 80, ''),
    counter: clampStr(op?.counter, 60, ''),
    mc: clampStr(op?.mc, 60, ''),
    uid: clampStr(op?.uid, 64, ''),
    name: clampStr(op?.name, 120, ''),
    target: typeof op?.target === 'number' && Number.isFinite(op.target) ? op.target : null,
    actual: typeof op?.actual === 'number' && Number.isFinite(op.actual) ? op.actual : null,
    avg: typeof op?.avg === 'number' && Number.isFinite(op.avg) ? op.avg : null,
    wt: typeof op?.wt === 'number' && Number.isFinite(op.wt) ? op.wt : null,
    h: Array.isArray(op?.h)
      ? op.h.slice(0, 24).map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : null))
      : [],
  }));
}

function sanitizeHours(hours: string[] | undefined): string[] {
  if (!Array.isArray(hours)) return [];
  return hours.slice(0, 24).map((h) => clampStr(h, 32, ''));
}

function toStringKeyRecord<T>(obj: Record<string, T> | undefined): Record<number, T> {
  const out: Record<number, T> = {};
  if (!obj || typeof obj !== 'object') return out;
  Object.entries(obj).forEach(([k, v]) => {
    const idx = Number(k);
    if (!Number.isNaN(idx) && v !== undefined && v !== null) {
      out[idx] = v;
    }
  });
  return out;
}

/**
 * Create or update private & public profile documents for the authenticated user
 */
export async function syncUserProfile(user: User): Promise<void> {
  if (!user.uid || !user.email) return;

  const uid = sanitizeFirestoreId(user.uid, 'user');
  const displayName = clampStr(user.displayName || user.email.split('@')[0] || 'Auditor', 120) || 'Auditor';
  const email = clampStr(user.email, 200);

  const privatePath = `users/${uid}/private/profile`;
  const privateRef = doc(db, 'users', uid, 'private', 'profile');

  try {
    const snap = await getDoc(privateRef);
    if (!snap.exists()) {
      const initialRole = email === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified ? 'admin' : 'auditor';
      await setDoc(privateRef, {
        uid,
        email,
        displayName,
        role: initialRole,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(privateRef, {
        displayName,
        email,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }

  const publicPath = `users/${uid}/public/profile`;
  const publicRef = doc(db, 'users', uid, 'public', 'profile');
  try {
    const pubSnap = await getDoc(publicRef);
    if (!pubSnap.exists()) {
      await setDoc(publicRef, {
        uid,
        displayName,
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(publicRef, {
        displayName,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, publicPath);
  }
}

function docToSession(data: Record<string, any>, docId: string): Session {
  return {
    id: String(data.id || docId),
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : undefined,
    ownerName: typeof data.ownerName === 'string' ? data.ownerName : undefined,
    isShared: Boolean(data.isShared),
    factory: String(data.factory || 'Factory 1'),
    line: String(data.line || ''),
    date: String(data.date || ''),
    file: String(data.file || ''),
    style: String(data.style || ''),
    fileName: String(data.fileName || ''),
    sheet: String(data.sheet || ''),
    ops: Array.isArray(data.ops) ? data.ops : [],
    hours: Array.isArray(data.hours) ? data.hours : [],
    tpl: String(data.tpl || 'tshirt'),
    map: toStringKeyRecord<string>(data.map),
    checks: (data.checks && typeof data.checks === 'object' ? data.checks : {}) as Record<string, 1>,
    bdate: toStringKeyRecord<string>(data.bdate),
    created: typeof data.created === 'number' ? data.created : Date.now(),
    ...(typeof data.googleSheetId === 'string' && data.googleSheetId
      ? { googleSheetId: data.googleSheetId }
      : {}),
    ...(typeof data.googleSheetUrl === 'string' && data.googleSheetUrl
      ? { googleSheetUrl: data.googleSheetUrl }
      : {}),
  };
}

/**
 * Subscribe to owned and shared sessions in real time
 */
export function subscribeFirestoreSessions(
  uid: string,
  onSessionsUpdate: (sessions: Session[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const ownedMap = new Map<string, Session>();
  const sharedMap = new Map<string, Session>();

  const emitMerged = () => {
    const merged = new Map<string, Session>();
    sharedMap.forEach((s, id) => merged.set(id, s));
    ownedMap.forEach((s, id) => merged.set(id, s));
    const list = Array.from(merged.values()).sort((a, b) => (b.created || 0) - (a.created || 0));
    onSessionsUpdate(list);
  };

  const ownedQuery = query(collection(db, 'sessions'), where('ownerId', '==', uid));
  const sharedQuery = query(collection(db, 'sessions'), where('isShared', '==', true));

  const unsubOwned = onSnapshot(
    ownedQuery,
    (snapshot) => {
      ownedMap.clear();
      snapshot.forEach((d) => {
        ownedMap.set(d.id, docToSession(d.data(), d.id));
      });
      emitMerged();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'sessions');
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );

  const unsubShared = onSnapshot(
    sharedQuery,
    (snapshot) => {
      sharedMap.clear();
      snapshot.forEach((d) => {
        sharedMap.set(d.id, docToSession(d.data(), d.id));
      });
      emitMerged();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'sessions');
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );

  return () => {
    unsubOwned();
    unsubShared();
  };
}

/**
 * Create or update a session document in Firestore following security blueprint constraints
 */
export async function upsertSessionToFirestore(
  session: Session,
  user: User,
  defaultShared = true
): Promise<void> {
  const sessionId = sanitizeFirestoreId(session.id, 'sess');
  const path = `sessions/${sessionId}`;
  const ref = doc(db, 'sessions', sessionId);

  const sanitizedMap = sanitizeNumberRecord(session.map as unknown as Record<string, any>);
  const sanitizedBdate = sanitizeNumberRecord(session.bdate as unknown as Record<string, any>);
  const sanitizedChecks = sanitizeChecksRecord(session.checks);
  const sanitizedOps = sanitizeOps(session.ops);
  const sanitizedHours = sanitizeHours(session.hours);

  const isShared = session.isShared !== undefined ? Boolean(session.isShared) : defaultShared;

  const optionalSheetFields: Record<string, string> = {};
  if (session.googleSheetId && session.googleSheetId.trim()) {
    optionalSheetFields.googleSheetId = clampStr(session.googleSheetId.trim(), 128);
  }
  if (session.googleSheetUrl && session.googleSheetUrl.trim()) {
    optionalSheetFields.googleSheetUrl = clampStr(session.googleSheetUrl.trim(), 300);
  }

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const ownerName =
        clampStr(user.displayName || user.email?.split('@')[0] || 'Auditor', 120) || 'Auditor';
      await setDoc(ref, {
        id: sessionId,
        ownerId: user.uid,
        ownerName,
        isShared,
        factory: clampStr(session.factory || 'Factory 1', 80) || 'Factory 1',
        line: clampStr(session.line || 'Line', 60) || 'Line',
        date: clampStr(session.date || '', 32),
        file: clampStr(session.file || '', 120),
        style: clampStr(session.style || '', 120),
        fileName: clampStr(session.fileName || '', 200),
        sheet: clampStr(session.sheet || '', 100),
        tpl: clampStr(session.tpl || 'tshirt', 100) || 'tshirt',
        ops: sanitizedOps,
        hours: sanitizedHours,
        map: sanitizedMap,
        checks: sanitizedChecks,
        bdate: sanitizedBdate,
        created: typeof session.created === 'number' ? session.created : Date.now(),
        ...optionalSheetFields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = snap.data();
      const isDocOwner = existingData.ownerId === user.uid;

      if (isDocOwner || existingData.ownerId == null) {
        await updateDoc(ref, {
          factory: clampStr(session.factory || 'Factory 1', 80) || 'Factory 1',
          line: clampStr(session.line || 'Line', 60) || 'Line',
          date: clampStr(session.date || '', 32),
          file: clampStr(session.file || '', 120),
          style: clampStr(session.style || '', 120),
          fileName: clampStr(session.fileName || '', 200),
          sheet: clampStr(session.sheet || '', 100),
          ops: sanitizedOps,
          hours: sanitizedHours,
          tpl: clampStr(session.tpl || 'tshirt', 100) || 'tshirt',
          map: sanitizedMap,
          checks: sanitizedChecks,
          bdate: sanitizedBdate,
          isShared,
          ...optionalSheetFields,
          updatedAt: serverTimestamp(),
        });
      } else if (existingData.isShared === true) {
        // Tier 2 collaborator update: checklist, process mapping, block start dates
        await updateDoc(ref, {
          checks: sanitizedChecks,
          map: sanitizedMap,
          bdate: sanitizedBdate,
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteSessionsFromFirestore(ids: string[]): Promise<void> {
  for (const rawId of ids) {
    const sessionId = sanitizeFirestoreId(rawId, 'sess');
    const path = `sessions/${sessionId}`;
    try {
      await deleteDoc(doc(db, 'sessions', sessionId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

function blocksToFirestore(blocks: SOPBlock[]): Record<string, any>[] {
  return (blocks || []).slice(0, 80).map((b) => ({
    t: clampStr(b.t || 'Proses', 120) || 'Proses',
    ...(b.m ? { m: clampStr(b.m, 120) } : {}),
    items: (b.i || []).slice(0, 60).map((item) => ({
      text: clampStr(Array.isArray(item) ? item[0] : '', 300),
      pic: clampStr(Array.isArray(item) ? item[1] : '', 60),
    })),
  }));
}

function blocksFromFirestore(rawBlocks: any[]): SOPBlock[] {
  if (!Array.isArray(rawBlocks)) return [];
  return rawBlocks.map((b) => ({
    t: String(b?.t || ''),
    ...(b?.m ? { m: String(b.m) } : {}),
    i: Array.isArray(b?.items)
      ? b.items.map((it: any) => [String(it?.text || ''), String(it?.pic || '')] as [string, string])
      : [],
  }));
}

/**
 * Subscribe to owned and shared custom SOP templates in real time
 */
export function subscribeFirestoreTemplates(
  uid: string,
  onTemplatesUpdate: (templates: SOPTemplate[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const ownedMap = new Map<string, SOPTemplate>();
  const sharedMap = new Map<string, SOPTemplate>();

  const emitMerged = () => {
    const merged = new Map<string, SOPTemplate>();
    sharedMap.forEach((t, id) => merged.set(id, t));
    ownedMap.forEach((t, id) => merged.set(id, t));
    onTemplatesUpdate(Array.from(merged.values()));
  };

  const toTpl = (data: Record<string, any>, id: string): SOPTemplate => ({
    firestoreId: id,
    key: String(data.key || id),
    name: String(data.name || 'Custom Template'),
    builtin: false,
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : undefined,
    isShared: Boolean(data.isShared),
    blocks: blocksFromFirestore(data.blocks),
  });

  const unsubOwned = onSnapshot(
    query(collection(db, 'templates'), where('ownerId', '==', uid)),
    (snap) => {
      ownedMap.clear();
      snap.forEach((d) => ownedMap.set(d.id, toTpl(d.data(), d.id)));
      emitMerged();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'templates');
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );

  const unsubShared = onSnapshot(
    query(collection(db, 'templates'), where('isShared', '==', true)),
    (snap) => {
      sharedMap.clear();
      snap.forEach((d) => sharedMap.set(d.id, toTpl(d.data(), d.id)));
      emitMerged();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'templates');
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );

  return () => {
    unsubOwned();
    unsubShared();
  };
}

export async function saveCustomTemplateToFirestore(
  tpl: SOPTemplate,
  user: User,
  isShared = true
): Promise<void> {
  if (tpl.builtin) return;
  const templateId = sanitizeFirestoreId(tpl.firestoreId || `tpl_${tpl.key}`, 'tpl');
  const path = `templates/${templateId}`;
  const ref = doc(db, 'templates', templateId);

  const fsBlocks = blocksToFirestore(tpl.blocks);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: templateId,
        ownerId: user.uid,
        isShared,
        key: clampStr(tpl.key, 100) || templateId,
        name: clampStr(tpl.name, 120) || 'Custom SOP',
        builtin: false,
        blocks: fsBlocks,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (snap.data().ownerId === user.uid) {
      await updateDoc(ref, {
        name: clampStr(tpl.name, 120) || 'Custom SOP',
        blocks: fsBlocks,
        isShared,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCustomTemplateFromFirestore(templateKeyOrId: string): Promise<void> {
  const templateId = sanitizeFirestoreId(
    templateKeyOrId.startsWith('tpl_') ? templateKeyOrId : `tpl_${templateKeyOrId}`,
    'tpl'
  );
  const path = `templates/${templateId}`;
  try {
    await deleteDoc(doc(db, 'templates', templateId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
