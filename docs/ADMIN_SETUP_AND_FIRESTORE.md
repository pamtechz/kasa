# KASA — Administrator setup and Firestore verification

Last updated: 16 October 2026.

## Why a bootstrap page may show "Not signed in"
The nominated first administrator must **register through Firebase Authentication**, verify the email address, and sign in before returning to `/bootstrap`. Merely setting `BOOTSTRAP_ADMIN_EMAIL` in Vercel does not create a Firebase Authentication user or seed Firestore.

`BOOTSTRAP_ADMIN_EMAIL` is a **server-side allowlist**, deliberately not editable by anonymous users or through the website editor until an administrator already exists. Its value must exactly equal the verified Firebase Auth email. Never publish its value. After successful one-time bootstrap, super-admin staff appointments are managed by KASA's authorized staff administration UI.

The bootstrap page heading, introduction and checklist are editable from the authenticated administrator's Website content page. These text settings live in `settings/site`; security rules and account authorization are not editable page content.

## Check actual Firebase connectivity without exposing secrets
`GET /api/setup/health` checks configuration validity and performs a real Firestore read. It returns only a safe connectivity state and whether the initial bootstrap record exists; it never returns account emails, secret values or applicant information.

`GET /api/admin/setup/status` is accessible only to approved KASA administrators and reports whether the following collections/documents contain records:
- Firestore `programmes`
- Firestore `announcements`
- Firestore `forms`
- `settings/intake`
- `settings/site`
- `settings/bootstrap`

The admin page `/dashboard/setup` displays these indicators and provides **Seed missing Firestore records**. The seed endpoint can only be called by a signed-in super administrator and never overwrites existing documents.

### Trusted command-line bootstrap alternative
The updated `scripts/bootstrap-admin.mjs` uses the same `settings/bootstrap` singleton marker as the website. It is atomic, idempotent for the same administrator, and refuses to overwrite an existing administrator binding. It does not create a Firebase Authentication user; registration and email verification come first.

On a trusted machine with Node 22 and local Firebase Admin credentials:
```powershell
git pull --ff-only origin main
npm install
node --env-file=.env.local scripts/bootstrap-admin.mjs
node --env-file=.env.local scripts/seed-forms.mjs
node --env-file=.env.local scripts/seed-catalog.mjs
```
These commands are only for an operator who has installed and configured the **local** private environment. Until this change is merged, obtain the updated CLI file from the feature branch. The last two seed commands create missing draft forms and course/announcement records; they do not publish application forms, activate intakes or overwrite existing documents.

### Initial seeding procedure
1. Configure Firebase credentials and domain(s) in Firebase Console and Vercel.
2. Register the nominated admin's email via `/login?next=/bootstrap`, verify the email and sign in.
3. Initialize the super-admin account via `/bootstrap`. It requires an App Check token and an exact match to the server-side allowlist.
4. Open `/dashboard/setup`, inspect collection status, select **Seed missing Firestore records**, and verify the result. The initial content consists of **15 programme/course records, 3 announcements, draft form templates, and default settings**.
5. Check `/dashboard/programmes`, `/dashboard/announcements` and `/dashboard/forms`. **Draft forms do not appear on the public website until published**, even when they are present in Firestore.
6. Open `/dashboard/intake` only after admissions, CDF checks and security testing are approved.

### Preview environment
When Preview has no `NEXT_PUBLIC_FIREBASE_*` web-app variables, the browser sign-in cannot work in that deployment. This does not prove Production is misconfigured. Firebase web-app settings should be available to the specific environment being tested, but their values must match its configured Firebase project.

## Deployment policy — user instruction
**Never initiate, promote or request any KASA Vercel deployment unless the user explicitly instructs it.** This includes previews, production and staging. Code review, documentation and GitHub development can continue without deployment. Pull requests must not be merged to `main` when doing so might automatically deploy, unless the user authorizes the release and deployment behavior. Preview auto-deployments were disabled in the KASA Vercel project on 16 October 2026 to avoid unnecessary builds; confirm project settings before reenabling them.

Deployment-free verification: static code review, locally run `npm run typecheck`/`npm run build` where Node 22 dependencies are installed, and the existing self-hosted GitHub Actions runner if assigned. Do not claim checks passed unless they actually executed.
