# Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Identity Integrity (`ownerId` & `uid`):** Every user-owned document in `/sessions/{sessionId}`, `/templates/{templateId}`, and `/users/{userId}/*` MUST bind `ownerId` (or `uid`) strictly to `request.auth.uid` upon creation and keep it immutable on update.
2. **Verified Email Enforcement:** All authenticated read and write operations MUST verify `request.auth.token.email_verified == true`. Matching `request.auth.token.email` without `email_verified == true` is strictly forbidden.
3. **PII Isolation (Split Collection):** User email addresses and private profile metadata live exclusively under `/users/{userId}/private/profile`, readable only by `userId` (`isOwner(userId)`) or a verified `isAdmin()`. Public display names live separately under `/users/{userId}/public/profile`.
4. **Privilege Escalation Prevention:** Users cannot self-assign `role: 'admin'` in `/users/{userId}/private/profile` or create/modify `/admins/{userId}` unless they are already a verified admin or bootstrapped admin.
5. **Path Variable Hardening (`isValidId`):** Every single-document `get`, `create`, `update`, and `delete` enforces `id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`.
6. **Strict Schema & No Ghost Fields:** Every `create` enforces both `hasAll([...])` and `hasOnly([...])`; every `update` begins with `isValid[Entity](incoming(), ...)` and restricts changed fields with `incoming().diff(existing()).affectedKeys().hasOnly([...])`.
7. **Temporal & Array Integrity:** Every `createdAt` equals `request.time` on `create` and stays immutable on `update`; every `updatedAt` equals `request.time`; all arrays (`ops`, `hours`, `blocks`) are bounded in size and type-checked at index `0`.
8. **Secure List Queries:** `allow list` rules NEVER use `get()`/`exists()` and NEVER rely on blanket `isSignedIn()`. All list rules explicitly check `resource.data.ownerId == request.auth.uid || resource.data.isShared == true`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Vector | Target Path | Malicious Payload / Operation | Expected Result |
|---|---|---|---|---|
| 1 | **Identity Spoofing** | `/sessions/sess_01` (`create`) | `{ id: "sess_01", ownerId: "victim_uid", ... }` signed in as `attacker_uid` | `PERMISSION_DENIED` |
| 2 | **Shadow / Ghost Field Injection** | `/sessions/sess_02` (`create`) | Valid session fields + `{ isAdminOverride: true }` | `PERMISSION_DENIED` |
| 3 | **Self-Assigned Admin Role** | `/users/attacker_uid/private/profile` (`create`) | `{ uid: "attacker_uid", email: "a@b.com", displayName: "A", role: "admin", ... }` | `PERMISSION_DENIED` |
| 4 | **Unverified Email Admin Spoof** | `/admins/attacker_uid` (`create`) | Token with `email: "oalamafa7@gmail.com"`, `email_verified: false` | `PERMISSION_DENIED` |
| 5 | **Path ID Poisoning** | `/sessions/bad$id..1500chars` (`create`) | Oversized or non-alphanumeric document ID | `PERMISSION_DENIED` |
| 6 | **Value Poisoning on Whitelisted Key** | `/sessions/sess_01` (`update`) | `checks: "not-a-map"` (invalid type for `checks`) | `PERMISSION_DENIED` |
| 7 | **Timestamp Forgery** | `/sessions/sess_03` (`create`) | `createdAt: Timestamp(1999-01-01)` instead of `serverTimestamp()` (`request.time`) | `PERMISSION_DENIED` |
| 8 | **Immutable Owner Hijack** | `/sessions/sess_01` (`update`) | Update payload changing `ownerId` from `owner_uid` to `attacker_uid` | `PERMISSION_DENIED` |
| 9 | **PII Cross-User Read** | `/users/victim_uid/private/profile` (`get`) | Signed in as `other_verified_uid` reading victim's email | `PERMISSION_DENIED` |
| 10 | **Unbounded Array Exhaustion** | `/sessions/sess_04` (`create`) | `ops` array with 201+ items or `ops[0]` set to `"string"` | `PERMISSION_DENIED` |
| 11 | **Private Session Scraping (List)** | `/sessions` (`list`) | Query without `where('ownerId', '==', uid)` or `where('isShared', '==', true)` | `PERMISSION_DENIED` |
| 12 | **Tier 2 Unauthorized Ops Overwrite** | `/sessions/shared_01` (`update`) | Non-owner updating `ops` or `isShared: false` on a shared session | `PERMISSION_DENIED` |

---

## 3. Test Runner Specification (`firestore.rules.test.ts`)

```ts
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, serverTimestamp, Timestamp } from 'firebase/firestore';
import fs from 'node:fs';

let testEnv: RulesTestEnvironment;

const baseSession = (id: string, ownerId: string) => ({
  id,
  ownerId,
  ownerName: 'Auditor Test',
  isShared: false,
  factory: 'Factory 1',
  line: 'Line 01',
  date: '2026-11-13',
  file: 'PO-001',
  style: 'T-Shirt',
  fileName: 'line01.xlsx',
  sheet: 'Database',
  tpl: 'tshirt',
  ops: [{ seq: '1', name: 'Ani' }],
  hours: ['08:00'],
  map: {},
  checks: {},
  bdate: {},
  created: Date.now(),
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

async function runDirtyDozenSuite() {
  testEnv = await initializeTestEnvironment({
    projectId: 'gen-lang-client-0106002464',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') },
  });

  const attacker = testEnv.authenticatedContext('attacker_uid', { email: 'attacker@example.com', email_verified: true });
  const victim = testEnv.authenticatedContext('victim_uid', { email: 'victim@example.com', email_verified: true });
  const unverifiedSpoof = testEnv.authenticatedContext('spoof_uid', { email: 'oalamafa7@gmail.com', email_verified: false });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, 'users/victim_uid/private/profile'), {
      uid: 'victim_uid', email: 'victim@example.com', displayName: 'Victim', role: 'auditor',
      createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });
    await setDoc(doc(adminDb, 'sessions/sess_01'), {
      ...baseSession('sess_01', 'victim_uid'),
      createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });
    await setDoc(doc(adminDb, 'sessions/shared_01'), {
      ...baseSession('shared_01', 'victim_uid'),
      isShared: true, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });
  });

  // 1. Identity Spoofing
  await assertFails(setDoc(doc(attacker.firestore(), 'sessions/sess_atk_1'), baseSession('sess_atk_1', 'victim_uid')));
  // 2. Shadow / Ghost Field Injection
  await assertFails(setDoc(doc(attacker.firestore(), 'sessions/sess_02'), { ...baseSession('sess_02', 'attacker_uid'), isAdminOverride: true }));
  // 3. Self-Assigned Admin Role
  await assertFails(setDoc(doc(attacker.firestore(), 'users/attacker_uid/private/profile'), {
    uid: 'attacker_uid', email: 'attacker@example.com', displayName: 'Attacker', role: 'admin',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
  // 4. Unverified Email Admin Spoof
  await assertFails(setDoc(doc(unverifiedSpoof.firestore(), 'admins/spoof_uid'), {
    uid: 'spoof_uid', email: 'oalamafa7@gmail.com', createdAt: serverTimestamp(),
  }));
  // 5. Path ID Poisoning
  await assertFails(setDoc(doc(attacker.firestore(), 'sessions/bad$id..invalid'), baseSession('bad$id..invalid', 'attacker_uid')));
  // 6. Value Poisoning on Whitelisted Key
  await assertFails(updateDoc(doc(victim.firestore(), 'sessions/sess_01'), { checks: 'not-a-map', updatedAt: serverTimestamp() }));
  // 7. Timestamp Forgery
  await assertFails(setDoc(doc(attacker.firestore(), 'sessions/sess_03'), {
    ...baseSession('sess_03', 'attacker_uid'), createdAt: Timestamp.fromMillis(915148800000),
  }));
  // 8. Immutable Owner Hijack
  await assertFails(updateDoc(doc(victim.firestore(), 'sessions/sess_01'), { ownerId: 'attacker_uid', updatedAt: serverTimestamp() }));
  // 9. PII Cross-User Read
  await assertFails(getDoc(doc(attacker.firestore(), 'users/victim_uid/private/profile')));
  // 10. Unbounded Array Exhaustion
  await assertFails(setDoc(doc(attacker.firestore(), 'sessions/sess_04'), {
    ...baseSession('sess_04', 'attacker_uid'), ops: Array.from({ length: 201 }, () => ({ name: 'x' })),
  }));
  // 11. Private Session Scraping (unfiltered list)
  await assertFails(getDocs(collection(attacker.firestore(), 'sessions')));
  // 12. Tier 2 Unauthorized Ops Overwrite on shared session
  await assertFails(updateDoc(doc(attacker.firestore(), 'sessions/shared_01'), {
    ops: [], isShared: false, updatedAt: serverTimestamp(),
  }));

  // Valid owner query & collaborator checklist update must succeed
  await assertSucceeds(getDocs(query(collection(victim.firestore(), 'sessions'), where('ownerId', '==', 'victim_uid'))));
  await assertSucceeds(updateDoc(doc(attacker.firestore(), 'sessions/shared_01'), {
    checks: { '0|0|Ani': 1 }, updatedAt: serverTimestamp(),
  }));

  await testEnv.cleanup();
}

runDirtyDozenSuite();
```
