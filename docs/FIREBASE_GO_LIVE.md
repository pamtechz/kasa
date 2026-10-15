# KASA — Firebase initialization, bootstrap and go-live

## First administrator
Link: https://kasaschool.vercel.app/bootstrap
Alternate CLI bootstrap: https://github.com/pamtechz/kasa/blob/main/scripts/bootstrap-admin.mjs

1. Confirm Firebase Authentication has Email/Password enabled and `kasaschool.vercel.app` is authorized.
2. In Vercel KASA project settings, configure public Firebase web settings, server-side service-account credentials, `BOOTSTRAP_ADMIN_EMAIL` (verified email of intended super admin), App Check site key and 32+ character rate-limit salt. Keep secrets out of source code.
3. Register / verify the nominated email at `/login`. Open `/bootstrap` while signed in and initialize the one-time role. Bootstrap requires a verified token, exact allowlisted email, App Check and Firestore atomic singleton.
4. If bootstrap succeeds, go to `/dashboard/setup` and seed missing content. Do not open public applications until forms and CDF requirements are reviewed.
5. Deploy `firestore.rules` and `storage.rules` using an authorized Firebase CLI environment; rules deny all direct client Firestore/Storage access. Application APIs use Firebase Admin and server-side authorization.
6. Go to `/dashboard/programmes`, `/dashboard/announcements`, `/dashboard/forms`, `/dashboard/intake` and confirm the data, course claims and dates.
7. Test registration, file type limits, administrative document review, PDF letters, agent referrals and rejected unauthorized requests. Open enrollment only after acceptance tests.

## Admin-controlled admissions
Firestore document: `settings/intake`, field `policy`.
- `applicationsOpen`: false until KASA administrator turns on.
- `opensAt`, `closesAt`: optional ISO instants interpreted by server, stored in UTC.
- `formOverrides`: map from form slug to enabled flag; false closes the form.
- `cdfRequiredDocuments`: administrator-defined checklist, reviewed against constituency requirements.
- `notice`: public explanation during closure.
- Published forms are subject to BOTH their publication status and the intake policy.
- `KASA_APPLICATIONS_ENABLED` is a retired variable and must not control application windows.

## Non-destructive Firestore seed
Use `/dashboard/setup` → **Seed missing Firestore records** after signing in as super admin. The server-side operation creates missing course, announcement and draft-form documents, and only if missing seeds website contacts/intake policy. It never overwrites edited records.
Source records are in `src/data/kasa-starter-content.json`.
Offline scripts: `npm run seed` seeds initial draft forms; `npm run seed:catalog` seeds the proposed programmes, prices and announcements without overwriting records. Run with server-only Firebase Admin credentials on a trusted computer; do not commit `.env.local`.\nExample on Node 22: `node --env-file=.env.local scripts/seed-catalog.mjs`. The connected app cannot automatically seed the database until valid Firebase credentials and authorized super-admin bootstrap are verified.\nIn the dynamic form builder, set question Options data source to **Published Firestore programmes** or **Admin-managed intakes**. These lists update without changing frontend code.
Pricing source: user-uploaded `Fee Structure 2 -4.pdf`, label **2027 proposed fees**. Curricular source: `Curriculum on Headed Paper_merged.pdf`, label **proposed curriculum**.
No externally accredited award is assumed.

## Secure CDF documentation and payment
CDF stands for Constituency Development Fund: government-sponsored training payment/finance, distinct from cash received by KASA. A staff verifier uploads and verifies required documents under the student application before recording an independently confirmed official approval reference. A CDF acceptance letter by itself is insufficient.
A self-funded student requires a verified payment reference, paid amount, explicit enrollment confirmation and an admin-configured minimum successful-enrollment payment threshold for agent commission.
Agent commissions are **not** transferred automatically.

## Known operational blockers\n- Vercel reported a daily deployment quota error `api-deployments-free-per-day` (HTTP 402). New releases cannot be verified or deployed until the quota resets or the owner resolves billing/limits.\n- Pending quality runs require the custom `KASAINSTITUTE` runner label and repo/org authorization; check https://github.com/pamtechz/kasa/settings/actions/runners .
- Revalidate the Firebase Admin service-account private key format and authorization (a previous Vercel preview failed parsing an uploaded key).
- Verify GitHub Actions self-hosted `KASAINSTITUTE` runner is assigned at repository/organization scope, active and has the `self-hosted` label.
- CDF government sponsorship decisions and eligible-programme status must be checked against current official records, never inferred from a course title.
