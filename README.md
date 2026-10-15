# KASA Enrollment Network

A Vercel-ready, mobile-first Next.js web app for KASA district-agent recruitment, configurable enrollment forms, admissions tracking, CDF sponsorship verification, acceptance letters and controlled commissions. **Firebase is the sole database/authentication/storage provider.**

## What it does

- Public KASA landing page and mobile-friendly application forms.
- Forms, sections, questions, choices, conditional visibility and publication controlled from Firestore via a protected admin builder. Draft/published status and versioning. Submitted applications preserve a snapshot of the questions.
- Distinct **agent recruitment** and **student enrollment** draft templates to seed into Firestore. Live fields are not compiled into the public app.
- Google Forms Apps Script template export (`scripts/google-form-export.gs`) and secure admin JSON import. The reference form was not automatically copied because Google returned `403` when retrieving its contents.
- Applicants get a unique submission reference. Duplicate contact entries for a single form are blocked using salted digests, with per-IP Firestore rate limiting.
- Private PDF/JPG/PNG uploads, max 4 MB each, validated server-side (type signatures, metadata, one-time claims). PDFs never live in public Firebase Storage.
- Staff dashboards, agent referral codes and district assignments. Agents see only their own referral status, **not** full applicant answers or uploaded documents.
- Multi-stage review: submitted → under review → accepted → acceptance letter issued → CDF submitted → CDF approved → commission paid. Rejection and information-request paths are available.
- Commission is **not payable until** authorized staff records a verified official CDF reference, verifies agent involvement, and sets a positive commission amount. A payment reference is required to mark it paid. No money is transferred automatically.
- Dynamic acceptance-letter text and answer-to-placeholder mappings, with secure PDF download after the issued stage.
- Every privileged endpoint authenticates an email-verified Firebase ID token against an active server-stored staff profile. Strong denial-by-default Firestore and Storage rules, server-side checks, Firebase App Check + replay protection for public POST operations, same-origin checks, no public PII read endpoint, basic request rate limits and audit records.
- CI quality workflow uses **self-hosted KASAINSTITUTE** runners; Vercel Git integration manages deploy previews and production when a repository is connected.

## Requirements

- Node.js 22.x
- A **new or dedicated Firebase project** for KASA, with Firestore, Firebase Authentication (Email/Password), App Check (reCAPTCHA v3), and Cloud Storage configured.
- A Vercel account/project with environment variables securely configured.
- The Firebase Admin service account must have permissions to access Firestore, Storage and verify App Check tokens. Never embed it in client-side code, Git or public URLs.

## Local installation

```bash
npm install
cp .env.example .env.local
# Populate .env.local with your own Firebase configuration.
npm run dev
```

`npm run build` and `npm run typecheck` require dependencies from the npm registry. This package was authored in an isolated environment where registry access was unavailable, so full Next.js build and end-to-end cloud tests remain pending.

### Environment configuration

The Firebase Web SDK values prefixed `NEXT_PUBLIC_` are public **identifiers**; the private service account values must remain server-side secrets. `FIREBASE_PRIVATE_KEY` can be the JSON `private_key` value with literal `\\n` escapes or actual newlines.

`APP_URL` must match your deployment's actual origin. For Vercel preview deployments, enabling `VERCEL_URL` allows the preview host automatically, but add preview domains to Firebase Authentication's **Authorized domains** and App Check's approved reCAPTCHA domains as appropriate.

`RATE_LIMIT_SALT` must be a secret random 32+ character string, unique per environment. Changing it resets hashed duplicate/rate keys' namespaces. Do not reuse public API keys as the salt.

### Security controls to enable in Firebase

1. Enable Email/Password authentication and configure approved domains, email verification settings and an appropriate password policy.
2. Create Firestore in the desired region. Deploy `firestore.rules` and `firestore.indexes.json` (deny direct client access).
3. Enable Cloud Storage (private bucket) and deploy `storage.rules` (deny direct client access).
4. Configure App Check for the web app using reCAPTCHA v3; set `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`. App Check is enforced **in production** on public submission/upload endpoints. Local dev skips App Check to ease development. The server uses limited-use tokens with replay consumption; ensure the service account can verify them.
5. Enable the Firestore TTL policy for `rateLimits.expiresAt` to remove old throttle counters. Set a bucket lifecycle rule to purge unused `staging/` objects after an appropriate period only after implementing migration of *claimed* attachments to permanent paths; do **not** blindly purge all staging files, as the app currently stores accepted attachments there.
6. Use least-privilege service account access where possible, limit console membership, enable MFA for all administrator account holders at the identity provider/organization level, and consider identity-platform MFA for the application. **Application-level MFA is not yet implemented.**
7. Configure a written data retention/deletion policy, incident response processes, encrypted backups and compliance review before collecting sensitive national identification or financial documents.

### First administrator

An unapproved registered account cannot access the dashboard.

1. Open `/login` → create an account and **verify its email**.
2. Set `BOOTSTRAP_ADMIN_EMAIL` in your *local environment* to that verified account's email.
3. Run `npm run bootstrap`. It applies the `super_admin` role to that **pre-existing** Firebase Authentication user. Keep this script off client machines and never expose service-account credentials.
4. Run `npm run seed`. It creates **two unpublished draft** templates in Firestore.
5. Log in and go to **Form builder** to review or change each form, then publish.
6. Go to Settings to configure commission and the acceptance-letter template. Publish only after policies and official CDF eligibility are checked.

## Copying the actual Google Form

The linked Google Form title is **KASA Enrollment Form**, but the connected Google Drive service returned **403 Forbidden** for its form contents. The original form is not changed or deleted.

1. Open the original Google Form as its owner.
2. Use the Form's Apps Script editor (or open a script **bound to that Form**).
3. Paste `scripts/google-form-export.gs`, run `exportKasaFormSchema`, authorize the read-only FormApp scope and copy the JSON from the execution log.
4. In KASA Admin → Form builder → **Import an existing form template**, paste the JSON. Review any question-type placeholders and set the correct options and required flags before publishing.
5. Google Forms features without a one-to-one web equivalent (grids, scales, advanced validation, file-upload details) require manual inspection. The editor supports text, paragraph, email, phone, number, date, select, radio, checkbox and private file upload.

All fields and sections are editable after import; no production form is hard-coded. The starter templates are seed data, not frontend constants.

## Agent referral flow

After screening an agent-recruitment application, instruct the successful candidate to register and verify an email account. In **District agents**, an admin assigns this existing account to a district and activates its agent code. A student enrollment link can use `https://YOURDOMAIN/apply/student-enrollment?agent=KASA-XXXXXXXXXX`. Public submissions verify that the referral code belongs to an active agent. A later commission still requires independent verification of that agent's involvement; possession of a code alone does not entitle anyone to commission.

## Acceptance-letter workflow

1. Review an applicant, then mark `accepted`.
2. After KASA's actual admission decision, advance to `letter_issued`.
3. Configure template placeholders `{{applicant}}`, `{{course}}`, `{{intake}}`, `{{reference}}`, `{{date}}` under Settings and map them to the **question IDs** used in that form.
4. Download the secure PDF from that application drawer. **Email dispatch and public letter verification are not yet implemented.**

## Recommended deployment

1. Create a new repository for this app (do **not** reuse an unrelated KASA repo).
2. Commit this source to the repository and connect it to Vercel as a Next.js project. Select Node 22.
3. Configure `.env.example` entries in Vercel Settings → Environment Variables. Store the server private key and rate-limit salt as **sensitive** secrets; never prefix them with `NEXT_PUBLIC_`.
4. Configure Firebase Authentication's authorized domain(s) and App Check's reCAPTCHA allowed domains.
5. Deploy a protected preview and test recruitment, approval, private file access, PDF generation, authenticated role boundaries and rejection of illegitimate App Check tokens.
6. Promote only after backend credentials, Firestore/Storage rules, CDF eligibility and identity verification are confirmed. Do not treat Vercel deployment success alone as evidence of operational security.

## Remaining work before full production rollout

- Run `npm install`, `npm run typecheck`, `npm run build` and integration/security tests on a connected machine/runner. Then commit the generated `package-lock.json` and change the CI install step to `npm ci`.
- Add an email sender or notification provider to deliver acceptance letters automatically.
- Implement server-side pagination/search and aggregate counters for districts with many thousands of applications. Current admin lists are capped at 300 records.
- Implement administrative user-role management beyond agent appointments, document preview scanning/antivirus, permanent attachment storage organization, retention/deletion requests, consent versioning, export/reporting, official CDF approval evidence review and applicant status lookup.
- Configure application-level multi-factor authentication, automated backups, and a production security assessment. No web application can truthfully promise “all security features” or full compliance without infrastructure configuration and testing.

## Status

**Source-code prototype / deployment-ready structure** (not deployed, not production-certified). The original form's exact questions remain unimported because its contents were not accessible. The app requires your Firebase project credentials and Vercel setup to become live.

## Production readiness and runtime compatibility

The Vercel frontend can deploy before Firebase is connected. All `/api/*` routes return HTTP 503 with a clear JSON message until `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, and `FIREBASE_STORAGE_BUCKET` are configured. The public Firebase web values (including App Check) must also be configured in Vercel for enrollment and staff login. Do not publish or accept applications until Firebase rules, Authentication and App Check have been deployed and tested.

Keep `firebase-admin` at version 13.10.0 for this Next.js/Vercel runtime until the upstream `jwks-rsa`/`jose` ESM interoperability issue is resolved and integration-tested; the v14 transitive combination can throw `ERR_REQUIRE_ESM` during serverless startup. Never put a service-account private key in a `NEXT_PUBLIC_*` variable or commit one to Git.

## Published forms and public readiness

Public recruitment links and the training application buttons are now driven by the **published Firestore forms**, not fixed Google Forms or hardcoded slugs. Publishing or unpublishing a form automatically changes the home page and the public form catalog. The metadata-only `GET /api/public/forms` endpoint excludes drafts, form answers and applicant data.

`GET /api/status` is a public status check; it never returns credentials. A missing or inconsistent Firebase configuration, App Check site key, or 32-character rate-limit salt keeps private and public application APIs closed with HTTP 503. Required public and server Firestore project and Storage bucket values must match. After configuration, deploy and test Firestore/Storage deny-by-default rules, the initial admin account and editable forms before publishing links. Readiness is a configuration check, **not** an end-to-end security certification.

## Required production activation checklist

The API remains closed after configuring Firebase until **FireStore-controlled intake policy** is explicitly set in Vercel. Keep it `false` during setup, staging, rules deployment, App Check configuration, and testing. To open for real applicants, an authorized KASA administrator should verify that:

1. Authentication registration, email verification, and approval-based staff access work.
2. Firestore and Storage deny direct client reads/writes; authorized server endpoints function.
3. The custom form template is imported and reviewed, then published from the admin console.
4. Applicant and agent records, secure uploads, CDF verification, letter generation, and commission permissions have passed real Firebase integration tests.
5. Data retention, backups, privacy notices, and a support contact are approved by KASA.

Then set KASA administrator opening in `/dashboard/intake` for production and redeploy. The public `/api/status` response switches to `ready`; monitor runtime logs and test a controlled submission before broad advertising. If an incident occurs, set this variable back to `false` and redeploy to prevent further submissions.
