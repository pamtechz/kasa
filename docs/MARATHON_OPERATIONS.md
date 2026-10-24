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
- Source data: `src/data/marathon-seed.json`, containing the 186 actions and 15 workstreams from the updated KASA Life Marathon 2027 Full Checklist. The original 130-action sheet snapshot is retained in `src/data/marathon-seed-2026-10-23.json` for safe upgrades. **An authenticated school super admin reviews and applies the versioned Firestore import from `/marthon/super`; deployment alone does not seed the database.**
- Existing activities can be marked done, re-opened, backdated with actual completion timestamps and supported by notes/evidence. The mutation timestamp and actor are recorded separately in the audit log.
- Offline: the scoped `/marthon-sw.js` worker caches Marathon shell routes; IndexedDB holds user-specific snapshots and queued edits. On reconnect, server submission checks UUID mutation IDs and source revisions. Conflicts are retained for manual review. Account grants, new-task creation, initial import and recommendation submission require internet.

## Release checks
1. Pass GitHub CI (security boundary tests, source tests, lint/typecheck and Firestore emulator rules) and Vercel preview build.
2. Log in as an existing school super admin. Visit **Marathon → Settings & roles**, enter the verified email of an *existing* KASA School user, and assign `kasaClient` or another second role.
3. Confirm `profiles/{uid}.role` and all school account details remain unchanged; only `marathonAccess` changes. Test multiple existing primary roles.
4. Confirm unassigned, inactive and unverified users receive 403/401 from every Marathon API, and `kasaAdmin` cannot assign or revoke roles.
5. Revoke Marathon access; verify the same school credentials still work on the school portal but Marathon requests return 403.
6. Review and apply the updated checklist from `/marthon/super`. For an empty database verify 186 tasks, 15 sections and five source-reported Done tasks with unknown actual completion dates. For a legacy import verify 85 retained IDs, 101 additions and 45 recoverable archives. Test historical completion plus offline replay before production promotion.

The real production Firebase database has not been seeded or modified merely by committing this code.


## Offline recovery and completion history

Open **Offline edits** to inspect queued changes. Conflicts show the online field values beside the device changes. **Apply my changes** retries against the version that was reviewed; another online update still causes a conflict. **Discard device edit** keeps the online record. A conflict on one action does not stop independent actions syncing.

If an editor loses edit permission, a rejected queued change stops automatic retries and remains available to discard in **Offline edits**. Connection failures and uncertain server responses keep the original submitted request for a safe retry.

Each request is persisted before submission. Requests awaiting confirmation retain their original mutation ID and payload across reloads; later local changes are preserved separately until acknowledgement. All queue read/merge/write operations are atomic, and a write is reported as saved only after IndexedDB commits. Cached server snapshots are overlaid with queued changes on refresh. Online saves remain available when a browser disables device storage.

Editing notes, evidence or another field on an already completed task preserves its completion actor and entry timestamp. An explicit change to the completion date, or a new transition to Done, records the new completion attribution. The drawer sends the completion date only when the user actually changes it, preserving the original seconds on unrelated edits. Quick completion controls toggle Done / Not done.

The recommendation desk has status filtering for reviewers and cursor pagination. Other users can page through their own recommendations only. CSV output neutralizes formula-like input. School finance users return to `/dashboard/finance`.

Local verification: 82 source/runtime tests, lint, TypeScript and production build passed on Node 22. Browser fixtures verified phone, tablet and desktop layouts, offline queue persistence, conflict recovery alongside independent updates, and 205 paginated recommendations. Real-account sign-in and the current live Firestore import require separate production verification.

The production audit passes the high-severity threshold after same-major gRPC and PostCSS updates. Eight pre-existing moderate findings remain in Firebase Admin's transitive dependencies; their upstream major-version migration is outside this Marathon reliability change.


## Updated Word checklist import

The source document identifies the event as 21 March 2027 at Showgrounds, Polo Field B, Lusaka. It supplies 186 task rows; blank follow-up-register rows are not actions. Five tasks have Done remarks despite empty checkbox symbols. They are imported as Done with no invented actual completion date or completion actor. Editing notes later preserves an unknown completion date; recording an explicit backdate records the real editor and entry time.

The organiser explicitly approved changing the 65 January–March 2026 deadlines to 2027. Original deadline text is retained in `sourceDeadline`, with a correction explanation on each affected task. Race-day tasks use the explicit event date and identify that date basis; other blank dates and ongoing activities retain no fixed deadline.

Import GET and POST both require the existing verified, active school super admin. Review returns counts and a fingerprint of the source and affected records. Apply requires that exact reviewed source version and fingerprint; concurrent edits return 409 and require a fresh review. The import runs in one Firestore transaction and does not change Auth, profiles, roles or security rules.

Existing titles, responsible people and deadlines are updated only if they still match the preceding source snapshot. User changes to those fields are retained and reported. Existing progress, actual completion attribution, evidence, notes, manual priorities and manual archives are preserved. Source tasks omitted by this revision move to the recoverable archive; manually created actions remain untouched. Unrecognised ID collisions halt the entire transaction.

Each changed existing task has a recovery copy under `marathonImports/{version}/before/{taskId}`. Import history also stores the preceding source metadata, and `marathonAudit` records the authenticated importing user and counts. Browser access to these internal recovery records is denied by the existing rules. Repeating the same import is a no-op; an older deployment cannot reapply a previously superseded version.

An authorised deployment operator can also use `scripts/seed-marathon.mjs` with the existing server service account. It requires an explicit live project and exact bundled source version, verifies the default database metadata, and refuses emulator targets. Run `--dry-run` first, review its counts, and supply its exact `--plan-hash` with `--apply`. The service principal is recorded as `service:<client email>`; it does not impersonate a school user or grant roles. No credentials are passed in command arguments or printed. A one-off deployment build may invoke this guarded operator job without changing the normal application build command.

## Checklist categories

The 186 source actions belong to the 15 workstreams in the uploaded checklist. The existing `section` field is the category; category IDs in links are stable slugs and do not change task IDs or import provenance.

The Categories page shows active action counts and completed progress for every workstream. Operations groups actions in checklist order and sorts urgency and due dates within each category. Category selection combines with status, priority, responsible team and search. Timeline entries, recommendation choices and exports retain category context.

New actions require a known category in both the form and API. Editors can change categories using the normal revision check, audit log and offline queue; viewers retain read-only access. Conflict review displays the online and device categories. Older records with a missing or unknown category remain visible under Needs a category. The first edit captures the baseline for records imported before category snapshots existed, so later source updates preserve manual category choices.

The operator CLI reports live category counts and rejects uncategorized active records after an apply or an already-imported dry run. Dry-run verification performs reads only.

Category-filtered operations URLs support offline navigation using a cached HTML shell. The worker caches a shared query-free shell only for plain navigation or a single category slug; other query parameters and API requests remain excluded. When an offline root-shell fallback is used, the client restores the requested Marathon view from the address and reads its category parameter.
