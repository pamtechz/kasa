# KASA Life Marathon — dual-role profile access

The Marathon workspace uses **the same Firebase project, Firestore database, Firebase Authentication identities and `profiles/{uid}` documents** as the KASA School app. No separate user database, duplicate login identity or `marathonMembers` collection is used.

The school profile has its original `role` (for example `admin`, `student`, `agent`) and may have an additional optional `marathonAccess` object:

```json
{
  "role": "admin",
  "active": true,
  "marathonAccess": {
    "role": "kasaAdmin",
    "active": true,
    "assignedBy": "verified-super-admin-uid",
    "assignedAt": "ISO-8601",
    "updatedBy": "verified-super-admin-uid",
    "updatedAt": "ISO-8601"
  }
}
```

School `role` is unchanged when Marathon access is added, modified or revoked. The **only** permitted role grantor is the existing active, email-verified KASA School `super_admin`. All Marathon role controls live in `/marthon/settings` (also `/marthon/team`) within the Marathon application, not in the root school user-management screens. The school super admin automatically has full Marathon permissions without `marathonAccess`.

Second-role options: `kasaAdmin` (edit and review), `kasaOperations` (edit and review), `kasaEditor` (edit), `kasaReviewer` (read and review recommendations), and `kasaClient` (read and recommend). These roles do **not** confer school app permissions or permission to grant Marathon roles.

The app uses its existing Firebase Auth login at `/marthon/login`; users can sign in with the same email and password as school. Marathon APIs verify the Firebase ID token, email verification and `profiles/{uid}.active===true`, then check `marathonAccess.active===true` and the secondary role. For the global school super admin, only the active profile and school `role` are required. Missing profiles, inactive school accounts and unassigned/inactive Marathon access fail closed.

Access controls are enforced server-side on all Marathon APIs, not merely hidden in the UI. Direct Firestore access remains denied by the existing rules. Role assignments update only `marathonAccess` within the existing profile, transactionally with `marathonAudit` records. There is no client API that writes the school `role`.

## Existing Marathon functionality
- `/marthon` dashboard, `/marthon/operations`, `/marthon/timeline`, `/marthon/recommendations`, `/marthon/archive`, `/marthon/activity`, `/marthon/super` and Marathon-specific role settings; `/marathon` is an alias.
- Source data: `src/data/marathon-seed.json`, containing 130 uniquely identified KASA Life Marathon actions from the previously approved Google Sheet. **Super admin must explicitly invoke initial Firestore import; deployment alone does not seed the database.** The source snapshot is not a live bidirectional Sheets connector.
- Existing activities can be marked done, re-opened, backdated with actual completion timestamps and supported by notes/evidence. The mutation timestamp and actor are recorded separately in the audit log.
- Offline: the scoped `/marthon-sw.js` worker caches Marathon shell routes; IndexedDB holds user-specific snapshots and queued edits. On reconnect, server submission checks UUID mutation IDs and source revisions. Conflicts are retained for manual review. Account grants, new-task creation, initial import and recommendation submission require internet.

## Release checks
1. Pass GitHub CI (security boundary tests, source tests, lint/typecheck and Firestore emulator rules) and Vercel preview build.
2. Log in as an existing school super admin. Visit **Marathon → Settings & roles**, enter the verified email of an *existing* KASA School user, and assign `kasaClient` or another second role.
3. Confirm `profiles/{uid}.role` and all school account details remain unchanged; only `marathonAccess` changes. Test multiple existing primary roles.
4. Confirm unassigned, inactive and unverified users receive 403/401 from every Marathon API, and `kasaAdmin` cannot assign or revoke roles.
5. Revoke Marathon access; verify the same school credentials still work on the school portal but Marathon requests return 403.
6. Import approved source checklist from `/marthon/super`, verify 130 records without destructive overwrites, and test historical completion plus offline replay before production promotion.

The real production Firebase database has not been seeded or modified merely by committing this code.
