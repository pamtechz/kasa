# KASA Marathon Command Center — Multi-event Budget Integration Contract
Status: feature branch / review; no live data migration or production release implied.

## Collaboration boundary
- Other teams should continue their PRs independently. This feature intentionally avoids admissions, Cloudflare R2, school finance, Firebase authentication implementation, security middleware and Firestore rules.
- Shared identity remains Firebase Auth + profiles/{uid} + active Marathon second role. No separate identities, roles stored in a shadow database, or client-side direct Firestore access.
- New paths: /marathon/events and /marathon/budget, plus API /api/marathon/events/**. Existing /marathon/operations remains the checklist view.
- Existing March 2027 checklist source and audit trail remain unchanged. Legacy tasks without eventId resolve to the fixed March 2027 event only; new events require explicit eventId.
- No bulk task migration is executed automatically by deploy/build. /marathon/super still applies the established checklist import only to the March 2027 source data.
- Review frontend routing carefully: MarathonContentSwitch must NOT mount MarathonWorkspace under /marathon/events or /marathon/budget. MarathonLink must let Next navigate normally to those pages.
- PR reviewers: reconcile against any concurrently merged Marathon navigation, roles, finance, notifications and storage code. Do not overwrite those team changes via force pushes.

## Data contracts (Firestore; server Admin SDK only)
- marathonEvents/{eventId}: {name,preparationStart,eventDate,closeoutDate,status,targetRunners,registrationFeeMinor,currency:'ZMW',adminUids,budgetEditorUids,budgetViewerUids,budgetApproverUids,revision,createdBy,createdAt,updatedBy,updatedAt}.
- marathonEvents/{eventId}/budgetLines/{lineId}: {category,description,quantity,unitCostMinor,months,plannedMinor,actualPaidMinor,status,taskId,startDate,endDate,notes,revision,createdBy,createdAt,updatedBy,updatedAt,approvedBy?,approvedAt?}.
- marathonTasks/{id}.eventId: optional during backwards-compatible migration. Absence means KASA Life Marathon 21 March 2027 ONLY. New tasks must write explicit eventId; never replicate completion dates or actors into a new event.
- marathonAudit records: all financial and event mutations append immutable audit entries tagged eventId. Do not treat an event/financial approval as an actual bank transfer.
- Cost values use integer ngwee (1 K = 100 units), so K3,137.54 = 313754, and K450 = 45000. Planned direct cost is qty x unitCostMinor x months; display 10% contingency separately. Distinguish registrations target from collected cash.
- Event ID for existing edition: kasa-life-2027-march. New edition: ev-<UUID>. Task ID and source import ID formats unchanged.

## Authorization contract
- Every event/budget API checks the authenticated, active, verified Marathon member via marathonIdentity (server enforced).
- Only the KASA School super administrator may create an event, edit its configuration, or grant event/budget permissions.
- Super administrator has complete budget access.
- For other members: read = explicitly present in event adminUids/editorUids/viewerUids/approverUids; write = active eligible Marathon role AND in adminUids/editorUids; approve and record actual payment = active eligible role AND in adminUids/approverUids.
- Ordinary client/viewer roles are never allowed to edit or approve budget data; assigned readers may view.
- Legacy March 2027 task editors keep their existing edit roles until explicit reassignment; tasks of other events can only be edited by assigned event admins with an eligible Marathon editor role.
- Event completed, cancelled or archived rejects new spending or task mutations. Server validation enforces event preparation/closeout window for new task/budget dates.

## Budget seed
- 80 itemised preliminary lines imported only on explicit super admin action from the approved KASA Life Marathon 2027 spreadsheet; **not** approved spend or quoted supplier pricing.
- Target 6,000 participants x K450 = K2,700,000 registration target.
- 80 lines reconcile to direct costs of K5,614,387.54; separate 10% contingency K561,438.75; overall working budget K6,175,826.29.
- Explicitly includes website development K20,000, four-year hosting/domain K3,137.54, five months of K250 talk time and five months of K500 transport.
- Import protects existing seed lines from overwrite; **do not seed** an event with prior budget records.
- Supplier quotations and grants remain estimates until recorded and independently verified.

## Integration test and rollout checklist
1. TypeScript, ESLint, Next build and all source/security tests pass on the feature head. Test with Firebase emulator; no real project credentials in CI logs.
2. Confirm both desktop and mobile navigation, event switch, reload, backlink and non-2027 zero-state. Verify all 186 original March actions remain visible and unchanged.
3. As super admin, create an additional event in the same calendar year; verify separate checklist, due dates, budget, permissions and reports; switching back preserves March history.
4. Verify a viewer, unassigned active member, school student, revoked user and anonymous user cannot modify budgets even by direct POST/PATCH API.
5. Confirm a budget editor cannot approve, record payment, change an approved amount or create an event. Confirm reviewer can view only if explicitly assigned.
6. Test simultaneous edits to the same line: expectedRevision must return HTTP 409 to the losing edit. Check immutable audit details.
7. Check cross-event task links rejected; out-of-window dates rejected; invalid monetary values rejected; completed events locked for writes.
8. Import 80 rows only once in Firebase emulator. Validate amounts match the published draft and avoid writes to other events.
9. Before production merge: reconcile with all open AI-team PRs, request their review, confirm the actual production project/role identities, build preview and explicitly approve promotion.
