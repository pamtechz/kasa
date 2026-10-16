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
