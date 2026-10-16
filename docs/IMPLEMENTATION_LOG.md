# KASA — Implementation and verification log
Last reviewed 15 October 2026. Every new pull request must update this log.

## Previously merged
- Initial Firebase/Next.js/Vercel enrollment app: dynamic forms, application statuses, admin/agent accounts, referrals, PDF letters and audit records.
- PR #1: Vercel TypeScript, Next.js prerender and admissions authorization fixes.
- PR #2: Firebase Admin runtime interoperability, controlled unconfigured-state responses.
- PR #3: Published form catalog and initial fail-closed applications flag.
- PR #4: KASA white crest, admin website-content editor, funding-channel commission statuses, staff and agent roles, internal automation rules; production merged at `f3008add`.

## Current work — `feat/2026-10-kasa-multipage-intake-firestore`
Request IDs: KASA-006, KASA-012–018.
Changes in branch (verification outcome to be appended when build/merge completes):
1. Firestore `settings/intake.policy` controls application opening, closing, dates and form overrides. Missing settings defaults closed; removed environment-flag control.
2. Publication catalog and submission transaction both re-check intake state, preventing stale in-flight submissions after closure.
3. Multi-page public website for courses, fees, about, admissions, agents, announcements and contact.
4. Secure admin CRUD for programme/fee and announcement records with publication states.
5. Starter dataset from user-supplied 2026 curriculum and 2027 proposed fee documents. Only missing records are created.
6. One-time verified-email first-admin `/bootstrap` workflow; no public unguarded role assignment.
7. Staff CDF document upload/verification with required-doc checklist, official approval evidence and separate funding method.
8. Self-funded commissions require verified successful enrollment and configured payment threshold.
9. Administrative screens for intake controls, data seeding and programme/announcement management.
10. Firestore-powered programme and intake choice sources for the editable application builder.\n11. Admin-editable privacy and application terms, published as dedicated pages.\n12. Verified-email student sign-in, own-status portal and secure legacy-application claiming; optional automatic linking on authenticated submission.\n13. Documentation, traceability and delivery gates.

## Deployment gates
- **Build and TypeScript check:** NOT PASSED/VERIFIED for the full current branch; earlier intermediate previews failed on a Firestore document typing error, which was corrected. A fresh full build remains required.
- **Vercel:** New deployments are currently rejected with HTTP 402 `api-deployments-free-per-day` (more than 100 per day); the user must wait for the quota reset or resolve their plan quota. Existing production remains on the previous merged release.\n- **GitHub self-hosted runner:** user confirms KASAINSTITUTE online; existing workflow jobs have been observed queued. Runner label and scope require operational verification.
- **Firebase Auth/Firestore/Storage/App Check:** credentials exist in Vercel, but that is not proof of live integration; first-admin bootstrap, real Firestore seed, rules deployment and end-to-end tests must be verified before public intake opens.
- **Firestore seeded:** Not yet confirmed; server-side /admin/seed feature is a preparation step, not a claim of execution.
- **CDF official approvals and payments:** No live transactions or external government approval has been verified by this work.
- **Email/SMS/WhatsApp/payout automation:** Not active.
- **Published site:** Existing production deployment may continue while feature branch is tested.

## Audit semantics
- Document uploads/reviews and application changes create audit records.
- Public reads return only published programme/announcement content.
- Applicant records and private files remain server-side. Agent responses explicitly redact applicant answers and sensitive funding/documents.
- `cdf_approved` means official decision verified with complete required documents; it does not mean funds cleared into KASA's bank account.
- `payment_verified` means staff independently verified actual required student payment and successful enrollment.
- Commission is reserved once for a verified attributed record and marked paid only with an admin-recorded transfer reference.

## Instructions for future maintainers
Read `docs/REQUIREMENTS_REGISTER.md` and this log before coding. Update both for scope or status changes; don't silently change dates, fee values, user roles, funding conditions or qualification wording.

## 15 October 2026 — Bootstrap production 404 follow-up
- Confirmed `https://kasaschool.vercel.app/bootstrap` returned HTTP 404 because the new route existed only in feature PR #5.
- Delivered a minimal, independently mergeable security fix as GitHub PR #6. Merged to `main` at `c0d15ffe2d31bf77b07191eea85f39e6e7b8b7e5` (protected bootstrap API and page, login link).
- Verified `/bootstrap` returns HTTP 200 on the linked Vercel preview; the preview `/api/bootstrap` returned 503 because the preview environment is not fully configured with Firebase public web settings.
- The production domain was still serving an older release after merge. An explicit production deployment attempt failed with Vercel HTTP 402 `api-deployments-free-per-day` (daily quota exceeded), retry after approximately 24 hours or use plan/billing options; deployment success **not** claimed.
- GitHub Actions jobs still queued: check whether the repository can use the online `KASAINSTITUTE` self-hosted runner and whether its required labels are configured.
- PR #5 remains unmerged until its full Next.js/TypeScript build and Firebase security checks pass, with the bootstrap fix preserved in its branch.

## 15 October 2026 — Feature release validation and merge gate
- Feature branch tested at Git commit `c4b09ae4c6c4356d9bfd21adf06d0b98e2178209` using Vercel staging deployment `dpl_A8ovFr9hZ3HuRPQERVQhU7RrikkP`. Deployment READY; Next.js production compilation and TypeScript checking completed, 51 static pages generated.
- Verified HTTP 200 for homepage, `/bootstrap`, `/about`, `/programmes`, `/fees`, `/admissions`, `/agents`, `/announcements`, `/contact`, `/privacy`, `/my-applications`, `/login`, and the logo PNG.
- Staging `/api/status` returned `configuration_required` and Firestore routes returned controlled 503 because staging does not have complete Firebase credentials. This is an expected fail-closed response, not evidence that production Firebase works.
- GitHub Actions checks on the requested self-hosted KASAINSTITUTE runner are queued/cancelled; no successful Actions run is claimed. Repository runner assignment and labels require verification.
- Firestore seed not executed and bootstrap not verified end-to-end. Do not claim live admissions, CDF approvals, email delivery or commission transfers.
- After merge, verify a new production deployment, `/bootstrap`, and complete a signed-in administrator bootstrap, Firestore initialization, authorization tests and controlled applicant submission before opening intake.

## 15 October 2026 — PR #5 MERGED; production deployment quota blocker
- PR #5 was squash-merged successfully into `main` at commit `2bf4ec335d99fb9583e3e72a8e6ca7e53ac27d07`. Earlier notes saying PR #5 was open/unmerged describe an earlier point in time and are **superseded**.
- Pre-merge Vercel staging deployment `dpl_A8ovFr9hZ3HuRPQERVQhU7RrikkP` was **READY**, with successful production compilation, TypeScript checking, generation of 51 static pages, and HTTP 200 smoke checks for bootstrap and the principal information pages.
- After merging, an explicit deployment of the exact `main` SHA to production was attempted, but Vercel rejected it with HTTP 402 `api-deployments-free-per-day` and a retry-after indication of 86400 seconds. **The new merged release is not deployed to production.** The production domain continues to serve the earlier release `f3008add` until a new deployment succeeds.
- The preview has insufficient Firebase environment configuration, so neither the live first-admin bootstrap nor actual Firestore seeding can be verified there. Live Firebase integration remains outstanding.
- Self-hosted `KASAINSTITUTE` GitHub Actions jobs remain queued/cancelled rather than green. Check the registered runner's repository assignment, online service status and labels.
- **Next action:** once the Vercel deployment allowance resets or its owner resolves the limit, deploy production commit `2bf4ec33`. Then verify `https://kasaschool.vercel.app/bootstrap`, `/api/status`, Firebase Authentication and App Check, followed by super-admin bootstrap, non-destructive Firestore seed, security-rule tests and a controlled application test before admin opens intake.

## 15 October 2026 — Follow-up stability and deployment
- Rechecked production deployment: latest production was still commit `f3008add`, not the merged `main` release; `/bootstrap` returned 404.
- Direct deployment attempt with current main commit `5a4cf19e` was denied by Vercel HTTP 402 `api-deployments-free-per-day`. Deployment allowance is the external blocker; do not claim publication or run Firebase seeding against an unverified production release.
- The live old release's `/api/status` returned `acceptingApplications: true` but public forms list was empty, so this is **not** proof of an operational admissions workflow. The new Firestore-controlled intake defaults closed.
- Fixed self-hosted Actions workflow selection: a runner named `KASAINSTITUTE` need not have that name as a custom label. The workflow now requires the built-in `self-hosted` label, still excluding GitHub-hosted jobs. For exclusive runner pinning, add the `KASAINSTITUTE` custom label in GitHub runner settings and restore it explicitly.
- CDF document upload now repeats the application-status lock **inside** the same transaction that saves document metadata, preventing a concurrent approval/rejection from accepting a late replacement.
- After this change is merged: inspect GitHub Actions job assignment and ensure the runner has access to pamtechz/kasa; verify Vercel production deployment when quota allows; execute authorized bootstrap and Firestore seed only after Firebase/Auth/App Check tests.

## 16 October 2026 — Bootstrap UX, Firebase diagnostic and no-deploy safeguard
- User screenshots show the first-admin page with a legacy heading/crest layout and **Not signed in** state; `BOOTSTRAP_ADMIN_EMAIL` is registered in Vercel environment variables (its secret value has not been read or displayed).
- Vercel Production has server credentials and Firebase browser environment keys; Preview has server credentials but lacks `NEXT_PUBLIC_FIREBASE_*` web-app keys. This explains why preview sign-in can be unavailable.
- Production's `/api/status` returned `ready`, but that reflects a configuration check, **not a confirmed end-to-end connection**. Production's published form catalogue returned `forms: []`; starter data creation was never confirmed. The old production `/api/public/content` returned 404 because it predates the multi-page release.
- Added an anonymous non-sensitive Firestore health route that performs a real read of `settings/bootstrap`; an authenticated admin status route checks whether programmes, announcements, forms, site settings, intake policy and bootstrap records are present, using existence reads only.
- Redesigned `/bootstrap` responsively; corrected `/login?next=/bootstrap` to return after verified sign-in without granting any role; added public site-controlled bootstrap copy, editable in Website content studio.
- Added admin setup dashboard indicators and recheck after the explicit **Seed missing Firestore records** action. No automatic data writes occur on site load.
- User explicitly prohibited Vercel deployments without permission. Preview deployments were disabled on the Vercel project before branch development. **No deployment was requested, triggered or promoted during this work.** This branch remains unmerged to prevent an automatic production deployment.
- Actual Firestore seeding and first-admin activation remain **not performed**: they require the authorized user and valid Firebase Authentication/App Check configuration.
- See `docs/ADMIN_SETUP_AND_FIRESTORE.md` for the operator checklist and current release gate.

- Follow-up: updated the trusted `scripts/bootstrap-admin.mjs` to create the same single-use `settings/bootstrap` record as the web flow, transactionally and idempotently, so Firestore diagnostics do not falsely report a missing bootstrap after CLI setup. Added local no-deploy, non-destructive draft-form and catalog seeding instructions.
- A successful environment-variable name check or HTTP 200 response **does not** imply that the real administrator is signed in or the starter content exists. No Firebase mutation was executed from this conversation.

## 16 October 2026 — App Check build failure and responsive usability corrections
- User reported Next.js 16.4.2/Turbopack: `Export getLimitedUseToken doesn't exist in target module` at `src/lib/firebase-client.ts`. The reported module suggests `getToken`; the repository declares Firebase `^12.0.0`.
- Replaced the nonexistent browser import/call with modular Firebase App Check `getToken`. Server `requireAppCheck` now verifies this **standard (reusable) App Check token** without `consume:true`. This preserves App Check attestation but does **not** provide single-use token replay protection. Existing role checks, origin checks and rate limits remain; a future limited-use token upgrade must be implemented on both client and server together when the deployed SDK supports it.
- Responsive improvements: mobile homepage navigation instead of hidden links; public navigation Escape/route handling; dashboard sidebar navigation/accessibility with Escape and body-scroll protection; compact mobile admin panels, metrics, form grids, file upload controls, data tables and detail drawers; visible keyboard focus, and reduced-motion support.
- Dynamic application form now exposes an accessible progressbar and focuses the next section heading, clears stale validation errors on changed answers and checks supported attachment MIME types before upload.
- Added `npm run test:source`, using Node's built-in test runner, for App Check imports/verification and mobile navigation accessibility markers; all equivalent connector-side source assertions passed. The self-hosted quality workflow runs these before npm install.
- **Do not claim full build completion**: a real `npm run typecheck` and `npm run build` after dependency installation remains necessary. There is no package lock committed. The user's local Next.js version is 16.4.2 while the repository declares Next.js `^15.5.28`; reinstall declared dependencies for a reproducible check before changing the framework version.
- User's prohibition on Vercel deployments remains effective; no Vercel build/deploy was requested. PR #9 remains unmerged to prevent automatic production deployment.

- CI concurrency: newer commits on the same PR branch now cancel superseded queued/in-progress self-hosted runs, avoiding a backlog of obsolete checks. The latest run still needs a reachable authorized runner to execute.

## 16 October 2026 — Null Auth crash, EDURMS parity and controlled Git merging
- Reproduced the unsafe code path in `src/app/(site)/my-applications/page.tsx`: `signOut(auth)` could run when `auth` was null because `firebase-client.ts` falsely cast null as non-null `Auth`. Firebase Auth now has the honest `Auth|null` type with `requireClientAuth()` and `signOutClient()` guards.
- Student portal displays checking/guest/ready/unavailable sessions, never displays private account details without a verified signed-in user, and recovers gracefully when Auth is unavailable. It guards sign-out, reference claims, and API responses.
- Dashboard handles missing Auth, disabled/unauthorized staff profiles and invalid sessions with an actionable recovery view instead of an indefinite spinner. Sidebar preference persists locally. Login validates actual Auth at action time, formats common Firebase errors and allows only explicit safe internal return routes.
- Compared `pamtechz/EDURMS` (`src/app/auth/login/page.tsx`, `src/app/dashboard/layout.tsx`, `src/components/ui/sidebar.tsx`, `docs/AUTHENTICATION_INTERFACES.md`). Adopted nullable service handling, session error recovery, role-aware navigation and mobile-friendly controls; no school-specific data or authorization rules were copied.
- `vercel.json` contains `git.deploymentEnabled:false` to prevent GitHub merges from triggering Vercel deployments. Future deployments still require explicit authorization. No Vercel deployment was requested.
- Regression tests cover nullable Auth, safe sign-out, supported App Check imports, portal navigation and Vercel Git auto-deploy being disabled.
- **Verification:** source-level assertions performed; full installed Next.js build, Firebase Auth/Firestore E2E and self-hosted CI remain unverified while the runner is queued. Do not claim these checks passed.

## 16 October 2026 — Legitimate repeat enrollment and catalogue consistency
- Replaced the lifelong per-form contact-only deduplication key with a composite key including the administrator-configured published `programmes` and `intakes` field selections. Submitting twice for the same form, contact, course and intake is rejected; a student may apply to a distinct course or later intake.
- The legacy contact-only fingerprint is checked in the same Firestore transaction, and its earlier submission is read to distinguish an actual same-scope duplicate from a legitimate new choice. The original stored submissions are unchanged.
- The intake policy validates unique IDs and distinct names among active intakes; public course and intake options remain Firestore-derived, not hardcoded. Missing options produce a clear applicant message rather than an unusable blank dropdown.
- Public application links refresh on a short shared cache, a periodic interval and browser focus, so administrators' openings/closures do not leave stale CTAs indefinitely. The server still independently checks the intake policy at submission time.
- Staged attachments cannot be reused for two fields in one submission; metadata checks reject files older than seven days or timestamps in the future. Existing size, type and one-time application claim checks remain.
- Four focused executable Node 22 tests for course/intake fingerprint semantics passed using a local mirror of the implementation. Added repository regression tests for the route's legacy check, upload safeguards and public availability refresh; the entire Next.js dependency build and live Firestore transaction integration remain **unverified** while the self-hosted runner is queued.
- **Vercel:** `git.deploymentEnabled:false` remains in `vercel.json`. No deployment initiated or requested. Code is eligible for GitHub merge without authorizing publication.

- Follow-up normalization fix: `applicantFingerprint` now preserves significant punctuation in email addresses (e.g. `a-b@example.com` is not equivalent to `ab@example.com`); telephone punctuation remains normalized. Legacy dedupe queries use the older stripped representation to recognize existing indexed applications. Added source regression coverage.

## 16 October 2026 — Windows local development and Next.js manifest collision
- User's **local** `npm run test:source` passed (4/4), `npm run typecheck` succeeded, and `npm run build` on Next.js 15.5.28 compiled and generated all 51 static pages; this was before the local-dev isolation patch and does not verify the new branch's complete build.
- Git problem: `git switch --track origin/fix/bootstrap-setup-visibility-admin-content` failed because a local branch with that name already existed. The following `git pull --ff-only origin main` was run without confirming the current branch and failed due to divergence. Safe recovery: inspect local changes, `git switch main`, then `git pull --ff-only origin main`; preserve unmerged local commits and investigate if local main itself diverges.
- Runtime problem: the Next development process moved from occupied port 3000 (PID 25828) to port 3001; `.next/routes-manifest.json` was missing and `/fees` returned HTTP 500. The completed production build and competing local Next processes point to an artifact-directory race/cache issue, not a proven error in the fees route.
- Changed `npm run dev` to a small cross-platform Node.js launcher that refuses an occupied port and sets `KASA_NEXT_LOCAL_DEV=1` plus an explicit valid port. `next.config.ts` now writes dev assets to `.next-dev-<port>` and production assets to `.next`. Running build while a new dev server is active will not overwrite its route manifest. Existing old-process output remains subject to interference until those old processes are stopped.
- Added `npm run doctor` (read-only Node/Git/cache status), `npm run audit:production`, `.next-dev-*/` to gitignore and focused regression tests for port selection/output isolation. 10 focused dev-port parser assertions passed in a local Node 22 mirror; full repository `npm run test:source`, TypeScript and Next.js build after the patch remain pending.
- User's npm install reported 19 advisories (9 moderate, 10 high) **without the dependency paths**. Do not promise remediation without the actual `npm audit` output. Recommended a scoped production audit and verified compatible dependency upgrades; do not automatically use `npm audit fix --force`.
- Cross-project pattern: EDURMS uses an explicit runtime/lockfile CI approach and isolates generated development type state. KASA implements analogous separated build output and recommends committing a real, registry-generated `package-lock.json` for deterministic `npm ci` in future CI.
- Detailed non-destructive Windows recovery: `docs/LOCAL_DEVELOPMENT_RECOVERY.md`. **Deployment remains forbidden without the user's explicit permission**; automatic Vercel Git deployments remain disabled by `vercel.json`.

## 16 October 2026 — Browser-extension hydration attribute and localhost Firebase setup
- User's React hydration warning showed `cz-shortcut-listen="true"` added to server-rendered `<body>`; that attribute is not authored by KASA and is characteristic of a browser-extension mutation. Added **body-only** `suppressHydrationWarning` for this shallow attribute, not global suppression of React hydration errors. Recommend checking in a browser session with extensions disabled to confirm.
- User's localhost bootstrap page showed missing Firebase web configuration. The keys stored in Vercel are not inherited by locally run Next.js. Browser settings must exist in the local, uncommitted `.env.local`, with required literal `NEXT_PUBLIC_FIREBASE_*` references substituted at build/dev time and a full dev restart after changes.
- Updated `firebase-client.ts` to expose only missing **variable names** and refuse partially initialized Firebase apps; kept `auth: Auth|null` and null-safe sign-out. The bootstrap and login screens show actionable local instructions with missing names, not private values.
- Updated local bootstrap to omit App Check tokens only in `NODE_ENV=development`, consistent with server `requireAppCheck`; production still requires valid App Check tokens. Firestore readiness no longer requires a **production-only** App Check key in local development; other private Firebase Admin credentials remain necessary for server connectivity.
- Added `npm run doctor:firebase` (requires local `.env.local`, prints configured/missing variable names only, warns about project mismatch and rate-limit salt), `docs/LOCAL_FIREBASE_AND_HYDRATION.md` and source regression tests.
- No live Firebase record was modified and no Vercel build, staging, preview or production deployment was initiated. Full Next.js build and live Auth/App Check/Firestore E2E verification remain pending.

## 16 October 2026 — Missing Next Webpack chunk and Git update blockage (KASA-027)
- User's attached PowerShell output shows Next.js 15.5.28 successfully compiled the optimized build and generated **51/51 pages**. A separate runtime request to `/api/setup/health` failed to load `./3897.js` from `.next/server/webpack-runtime.js`, suggesting a stale/incomplete shared build artifact, not necessarily a Firebase API error.
- Local update remained on old commit `a12050e8` after `git pull --ff-only origin main` was **aborted** because tracked `.env.example` and `next-env.d.ts` were modified. The resulting `npm error Missing script: doctor:firebase` is consistent with running an outdated `package.json`. Preserving/stashing the local edits and pulling current main resolves the version discrepancy without any forced reset.
- User ran 19/19 source tests successfully and a full 51-page build before the report's later `npm run dev` failure; those results describe the user's earlier local checkout, **not** complete testing of this fix.
- Existing launcher probed IPv4 `0.0.0.0` but Next.js could bind IPv6 `::`, so the probe could pass while the child failed with `EADDRINUSE :::3000`. The launcher now probes the **same hostname** explicitly passed to Next, defaulting to `0.0.0.0` to retain LAN access. Explicit `--hostname` works with an alternate port.
- Added guarded `npm run clean:next` which lists/removes only generated `.next` / `.next-dev-<port>` folders when invoked with explicit `--yes`; it refuses non-KASA directories and symlink targets. The operator must stop all Next.js processes before cleaning.
- Enhanced `npm run doctor` to display tracked modified **file names only** and count Git commits ahead of/behind `origin/main`, without revealing file contents or secrets.
- Added focused source regression tests for matching hostname probe and listener, cache cleanup allowlist and Git diagnostics. Local Next.js full build and self-hosted runner CI remain unverified after these changes.
- Windows recovery instructions in `docs/LOCAL_DEVELOPMENT_RECOVERY.md`: stash the two tracked edits, update main, stop verified KASA ports, clean only generated caches, build and dev on a selected explicit port.
- No Vercel preview/staging/production deployment initiated or authorized. `vercel.json` continues to prohibit automatic Git deployments.
