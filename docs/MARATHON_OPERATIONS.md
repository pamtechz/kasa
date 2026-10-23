# KASA Life Marathon operations module

Routes: **/marthon** (requested spelling), **/marthon/login**, /marthon/operations, /marthon/timeline, /marthon/recommendations, /marthon/activity, /marthon/archive, /marthon/team and /marthon/super. /marathon redirects to /marthon.

## Architecture
Existing kasaschool.vercel.app Next.js app, existing Firebase Authentication and Firebase Admin/Firestore backend. Marathon uses separate document collections: `marathonTasks`, `marathonMembers`, `marathonSuggestions`, `marathonAudit`, and `marathonMeta`. The existing main KASA `profiles.role` remains unchanged. Global active super administrators inherit Marathon super-admin access.

## Roles
- `super_admin`: main KASA super admin; only this role can import source data and assign/edit Marathon-specific memberships.
- `kasaAdmin`: manage Marathon tasks and review proposals; cannot import source or change memberships.
- `kasaOperations`: edit tasks and review proposals.
- `kasaEditor`: edit tasks.
- `kasaReviewer`: read tasks and review proposals, but not modify task statuses directly.
- `kasaClient`: read tasks and recommend changes, but not change official checklist records.

All operations require a valid, email-verified Firebase ID token, active account and server-side Marathon membership (except global super admin). Direct Firestore writes remain denied by the existing `firestore.rules`: the Next.js API uses Firebase Admin SDK and checks roles on every request.

## Seed and historical completion
`src/data/marathon-seed.json` is an exact migrated task register from the native Google Sheet `1bRilxxldCNU3KkZ4Oobu5_Tr8Fu5f1niIDU9Mx4DF04`, tab `Actions`: 130 uniquely identified rows. This snapshot is not automatically rewritten from or into Google Sheets. The *Import source checklist* button in /marthon/super executes a super-admin-only, idempotent seed to the existing Firestore project. Existing task IDs and prior edits are never overwritten. This button must be clicked once by an authenticated super administrator; committing source files or deploying Vercel does not by itself write Firestore data.

Completion can be backdated via *Actual completion date and time*. The server separately records actual completion time, identity and edit-submission time. Do not infer completion from the Sheet's former "To confirm" status; staff must verify and enter historical results and supporting evidence.

## Offline operations
Service Worker caches public Marathon route shells and static Next assets after first online visit. IndexedDB stores an authenticated-user-scoped snapshot and pending PATCHes for existing tasks. A client edits cached task records offline, sees *pending* indicators, and automatically attempts server replay after reconnection. Mutations use original document revision and UUID mutation IDs for idempotency. A 409 conflict leaves the local queue intact for human reconciliation (no last-write-wins). Creating tasks, managing accounts, import and recommendations require connectivity. Browser offline snapshots are not shared across users and should not contain sensitive evidence or participant PII. Do not use browser storage for personal data in future extensions.

## Launch checklist
1. Verify Vercel has valid existing Firebase browser and Admin settings; do not expose service-account credentials.
2. Build / typecheck, run source and Firestore rule tests, verify all Marathon API role-denial paths.
3. Deploy as a Vercel preview first. Ensure /marthon/login works, /marathon redirects, and the existing school routes remain unaffected.
4. With a verified super admin, open /marthon/super and click the import button. Confirm total of 130 records and test update/backdated completion.
5. Invite registered verified accounts to Marathon roles. Test client read + suggestion and confirm they cannot POST/PATCH tasks or import.
6. On a test account, go offline after first visit, update a task, reconnect and verify automatic replay and audit trail; test 409 conflicts separately.
7. Promote only a reviewed, successful deployment to kasaschool.vercel.app. Repeat permissions tests on production.

This module intentionally keeps its initial source data snapshot in the repository; full bidirectional Google Sheets synchronisation would require an authenticated Sheets integration with explicit conflict-resolution rules.
