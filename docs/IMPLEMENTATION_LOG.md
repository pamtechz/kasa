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
