# KASA role-based access control and Firestore security audit

**Architecture reviewed:** `pamtechz/kasa`, Next.js API routes using Firebase Admin SDK, Firebase Authentication, Firestore, Storage, and the portal navigation. Six active user roles are defined: `super_admin`, `admin`, `reviewer`, `finance`, `agent`, `student`.

## Enforcement layers

1. **Authentication:** `src/lib/security.ts` verifies Firebase ID tokens with revocation checking and requires an email-verified account, then loads the active profile from Firestore. A token claim stating `role: super_admin` has no effect without a matching active database profile.
2. **Authorization:** The central `src/lib/permissions.ts` feature matrix and `routeCapability()` map determine permitted operations. `operator()` checks them for every `/api/admin/*` and `/api/agent/*` call. Handlers enforce further restrictions such as submission ownership, financial states and protected super-admin accounts. An unknown privileged API path is denied.
3. **UI hiding:** `src/components/Portal.tsx` renders only capability-appropriate navigation items. This protects navigation usability, **not data**: direct HTTP calls still require server permission checks.
4. **Firestore browser rules:** Public *published* forms, programmes and announcements, and active campaigns, can be read. A signed-in user can get their own profile, but cannot write it directly. All sensitive collections and unknown collections are denied to every Firebase client identity, including users with forged admin claims.
5. **Storage:** `public/*` is readable; all direct uploads/writes and all private files are denied. Uploads, signed downloads and verification go through authorized server APIs.

Firebase Admin SDK intentionally **bypasses Firestore/Storage Security Rules**. Do not grant a broad `isAdmin()` Firestore rule in an attempt to authorize Next.js APIs; it would instead expose the entire database to browser clients, and would still not secure Admin SDK server requests.

## Role-operation policy

| Operation or module | Super admin | Admin | Reviewer | Finance | Agent | Student |
|---|---|---|---|---|---|---|
| Dashboard, account, notifications | Yes | Yes | Yes | Yes | Agent workspace | Student workspace |
| Application review | Full | Full | Review only | No | Own referrals: limited data | Own applications |
| Acceptance / enrollment documents | Manage | Manage | Review, upload, verify | No | No | Own download/upload |
| Forms, programmes and site | Manage | Manage | Read via API | No | Public published | Public published |
| Intake, settings, automations | Manage | Manage | Read selected settings | No | No | No |
| Agent management | Manage | Manage | Read | No | Own referrals | No |
| Finance ledger | Read/write | Read/write | Read only | Read/write | No | No |
| Commissions | Manage | Manage | Read only | Read only | Own payout request | No |
| Staff roles and data seeding | Full | No | No | No | No | No |

**Important:** This matrix reflects the *documented intended authorizations* and the newly enforced core routes. Financial posting still requires server validation of evidence and transitions; permissions alone never certify a payment. Public application intake and document claims have separate App Check, rate-limit, validated-receipt, ownership and status checks.

## Collection-level browser rules

- Public read-only: `forms`, `programmes`, `announcements`, `adCampaigns`, each filtered by `published` or `active`.
- Own-profile GET only: `profiles/{uid}`.
- Deny all browser read/write: `submissions`, `settings`, `applicationDedupe`, `fileClaims`, `notificationOutbox`, `fundingVerifications`, `commissionPayments`, `payoutRequests`, `rateLimits`, `auditLogs`, `siteContent`.
- Deny any unknown collection, document or subcollection using the final recursive rule.

**Query behavior:** Firestore rules do not filter query results after retrieval; queries of public collections must include compatible `published == true` or `active == true` constraints. Directly querying the whole collection is denied.

## Findings addressed in this change

- Previously staff navigation assumed every non-agent could view Applications, including finance staff whose API access was denied. Capability-based links now show finance staff Finance Ledger and hide unsupported application screens.
- Previously agent application listings spread the full application object and merely masked selected fields. Unlisted fields such as bearer download tokens could still reach agents. The server now returns a strict allowlist of basic referral metadata.
- Server-side authorization rules were repeated across handlers, risking future drift. A shared route-and-method policy now acts as an additional default-deny guard, while existing endpoint checks remain in place.
- Firestore rules are explicit about sensitive collections and use a recursive deny-all to cover future collections and nested paths.

## Additional risks and rollout gates

The existing application must still be validated using authenticated browser sessions and live-like Firebase test data. The emulator tests establish Firestore/Storage policy, **not complete HTTP route end-to-end behavior**. The source review does not prove payment-provider settlement, correct financial tariffs, exhaustive document validation, historical data cleanup, or secure credential migration.

Before production Firebase rules deployment:
1. Verify exact project ID and current live rules, and export a restorable backup of database and Storage objects.
2. Run both `Quality checks` and `Firebase rules integration` to completion for the exact release SHA.
3. Test every role in a non-production Firebase project: sign-in, direct API calls, forbidden edits, published content, application ownership, agent scoping, PDFs, uploads, CDF review, finance approvals, and notifications.
4. Confirm production `APP_URL`, App Check and other environment configuration. Ensure server-only Firebase service account values are never in browser bundles.
5. Deploy rules and the matching application in a controlled operation with monitoring and rollback.
6. Verify expected 401/403 responses, role-safe UI, and legitimate workflow success. Record approver and deployment artifact identifiers.

**Status:** This document is a repository audit and implementation record, not evidence that these revised rules have been deployed to the live Firebase project.
