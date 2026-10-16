# KASA — Fix local Firebase configuration and bootstrap hydration warnings

Updated 16 October 2026. Applies to the KASA Next.js 15.5.28 application on Windows with Node.js 22.

## 1. Why Chrome shows `cz-shortcut-listen="true"` on `<body>`

The screenshot reports an HTML attribute which KASA does **not** generate in `src/app/layout.tsx` or the React tree. Such an attribute is typically injected into the page by a browser extension before React hydrates. It is a *root attribute mismatch*, not evidence that your KASA Firebase logic is incorrect.

KASA now sets `suppressHydrationWarning` on **`<body>` only**, so a third-party-injected body attribute does not generate that warning. The suppression does not cover arbitrary nested mismatches.

To verify the cause, open the same page in an Incognito/Private window with extensions disabled and reload. If other hydration errors still occur, investigate the reported component and markup rather than suppressing warnings globally.

## 2. Vercel Firebase keys are not local Firebase keys

If you run `npm run dev` at `localhost:3000` or `localhost:3001`, Next.js loads values from `.env.local` in the project's root and from your operating system's environment, **not** from the Vercel project's stored Production or Preview variables. `NEXT_PUBLIC_*` variables are substituted into browser bundles at compile time: after changing `.env.local`, completely stop and restart the dev server.

In the Firebase Console, choose **Project settings → General → Your apps → Web app → SDK setup/config**. Copy the values **for the KASA Firebase project** into a new, uncommitted `.env.local`, using `.env.example` as the list of names:

```dotenv
# Public Firebase Web app settings: supply real values on your own computer
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY=

# The following are server-only. Never expose, post or commit their values.
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_STORAGE_BUCKET=
RATE_LIMIT_SALT=
BOOTSTRAP_ADMIN_EMAIL=
APP_URL=http://localhost:3000
```

The Firebase web API key is an application identifier rather than a Firebase Admin private key, but keep the server credentials confidential. The Admin `FIREBASE_PRIVATE_KEY` must come from your server-side Firebase service account, not from the web SDK configuration.

**Do not paste your private key in ChatGPT, Discord, GitHub issues or browser screenshots.**

## 3. Local diagnostics

Run these commands from your updated KASA main branch:

```powershell
git switch main
git pull --ff-only origin main
npm install
npm run doctor:firebase
npm run test:source
npm run typecheck
npm run build
npm run dev
```

`npm run doctor:firebase` reads your local `.env.local` using Node 22 and prints **only missing/configured variable names**. It deliberately does not echo API key or service account values. It also detects a mismatched client/server Firebase project ID and warns about a too-short rate-limit salt. This is a configuration check, not proof that Firebase Auth or Firestore rules are working.

To test the local server's real Firestore connectivity, open `http://localhost:3000/api/setup/health`. A `connected` response means a server-side Firestore read succeeded. A `configuration_required` response means the app does not yet have all required server-side settings. For the setup API, `unavailable` means a real Firestore request failed. The response never discloses private credentials.

If you use port 3001, update `APP_URL=http://localhost:3001` in `.env.local` and restart `npm run dev -- --port 3001`.

## 4. Firebase Authentication and App Check

In Firebase Authentication, enable **Email/Password**, create and verify the intended administrator's account, and include **localhost** in Authorized domains for local testing if the project does not already allow it.

KASA's server bypasses App Check for `next dev` but enforces App Check in production. The bootstrap page now matches this policy. On production, register the real production domain and any reCAPTCHA/App Check hostnames in the appropriate Firebase/Google console settings. Never disable production App Check to hide a bad configuration.

The authorized first administrator email `BOOTSTRAP_ADMIN_EMAIL` remains server-only; possessing browser settings is never sufficient to become an administrator. Starter forms, programmes and announcements are inserted only after an authorized bootstrap and explicit seed action. Presence of environment variables does **not** seed Firestore.

## 5. Preserve the deployment restriction

KASA's `vercel.json` disables automatic Git deployments. Do not start a Vercel preview, production or staging deployment unless specifically authorized. All instructions above are for **local development only**.
