# KASA Role and Access-Control Architecture (Phase 2)

## Sources of authority and enforceable boundaries

The six live `profiles.role` values are `super_admin`, `admin`, `reviewer`, `finance`, `agent`, and `student`. Authoritative permission assignments reside in `src/lib/access-policy.ts`. The source of identity is a **verified Firebase Authentication ID token**, re-verified server-side. The source of authorization is the active account profile stored server-side in Firestore, **not** custom claims or a role submitted by a browser. A suspended account cannot pass the operator guard.

Firestore and Cloud Storage rules apply only to client-SDK access. **Firebase Admin SDK calls bypass those rules** and therefore `operator()` checks both the original endpoint's explicit allowed-role list and the shared route/method capability. Unknown Admin and Agent routes and verbs fail closed. Additional object-level checks and status transitions must remain in each endpoint.

## Operational roles

| Area | Super administrator | Administrator | Reviewer | Finance | Agent | Student |
|---|---|---|---|---|---|---|
| Staff roles, security and bootstrap | Manage | No | No | No | No | No |
| Forms, site, adverts, intake, programmes and settings | Manage | Manage | Read via authorized APIs | No | Public only | Public only |
| Application listing | All | All | All | Via scoped finance ledger | Own referred only | Own linked only |
| Create candidate submission | Yes | Yes | Submitted only | No | Submitted with own agent UID | Public form / claim |
| Review/transition applications | Yes | Yes | Non-financial states | No | No | No |
| Approve funding and pay commissions | Yes | Yes | No | Receipt recording only | No | No |
| Finance ledger/receipts | Read/write | Read/write | Read-only | Read/write | No | No |
| Commission ledger | Read/settle | Read/settle | Read-only | No | Own read-only | No |
| CDF documents | Staff review | Staff review | Staff review | No | No | Own upload/view |
| Broadcast notifications | Yes | Yes | Read and mark | Read and mark | Read and mark | Read and mark |
| Agent referrals and payout requests | Yes | Yes | Reporting only | No | Own scoped | Own student referrals |
| Student ID and PDF forms | Authorized server endpoints | Authorized server endpoints | Authorized server endpoints | No | No | Owner authenticated access |

*Operational note:* Reviewer read access to certain administration APIs does not imply access to an editing page; editing controls/pages are withheld until a safe read-only interface exists. Each endpoint should still validate its own data, scope and workflow rules.

## Firestore and Storage enforcement

Public, published forms/programmes/announcements and active advertising may be read by anonymous users. Active verified administrators/reviewers can inspect draft catalogue records from the Firestore client SDK, but **no browser role** can write these collections.

Only a verified owner can directly get their active profile. No browser can create, change, list or delete profiles. The following collections, and any future collection, are inaccessible to browsers regardless of claimed role: `submissions`, `settings`, `notificationOutbox`, `fundingVerifications`, `commissionPayments`, `fileClaims`, `applicationDedupe`, `rateLimits`, `auditLogs`, `agentPayoutRequests`. These documents contain private applicant/financial data that Firestore rules cannot field-redact.

Cloud Storage: public-branding paths are publicly readable and never browser-writable; all private staging, intake evidence and acceptance documents are accessible only by checked API handlers via the Admin SDK. Short-lived URLs returned by authenticated endpoints must not be treated as permanent identity tokens.

## Feature hiding and defense in depth

Navigation and page guards call the same capability functions as the server. Features a role cannot use are not rendered; navigating directly to their URLs displays access denied. **Hiding UI elements is only a usability measure**, never authorization. Direct requests with edited methods, bodies, roles and URLs are independently rejected by `operator()` and any endpoint-specific state/ownership guards.

## Verification and rollout

`scripts/tests/role-permissions.test.mjs` inventories every Admin and Agent route and checks role operations, unknown route denial, and UI permission gating. `scripts/integration/firebase-rules.integration.mjs` tests Firestore/Storage with real local emulators including forged claims, disabled profiles and draft content.

Run both CI workflows on the exact branch commit, then verify real login/account assignment, reviewer financial denial, finance receipt recording, agent scoping, learner documents, notifications and all navigation paths with distinct test accounts. **Do not publish new Firebase rules to production until backup, project identity and rollback are verified.** Production Firebase rules are deployed separately from Vercel and GitHub.
