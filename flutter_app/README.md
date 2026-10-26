# KASA School + Life Marathon (Flutter mobile)

## Scope

This is an **Android/iOS Flutter web-backed shell** for exact UI/operations parity with the existing Next.js School and Marathon websites. It does **not** claim to be a fully reimplemented native Flutter UI. It loads the deployed first-party KASA website in a first-party-only WebView, preserving existing Firebase login, role-aware menus, dynamic forms, checklist, updates, and the web's offline sync behavior. It does **not** introduce a duplicate database, user profile, or privileged API credential.

Native Firebase Cloud Messaging (FCM) connects through the website's authenticated `/api/mobile/push-devices` endpoint. In-app banners show foreground updates; the OS handles push notifications while the app is backgrounded. Tap a notification to open its permitted KASA internal route.

## Build prerequisites

1. Install Flutter 3.32+ (with Dart 3.8+), Android SDK and, for iOS, Xcode on macOS.
2. In this directory run `flutter create --platforms=android,ios --project-name kasa_mobile .` to generate Android/iOS runner projects **without replacing the supplied Dart sources**.
3. Register Android and iOS apps **in the same Firebase project used by the deployed School website**. Run `flutterfire configure` or add the platform configuration files securely, then follow FlutterFire's current platform initialization instructions. No admin/private key belongs in the mobile app.
4. Android: ensure `android.permission.INTERNET` and `android.permission.POST_NOTIFICATIONS` are declared in the generated `android/app/src/main/AndroidManifest.xml`; configure a valid Firebase Android application ID and Google Services plugin. For iOS, configure APNs capability, Push Notifications and Background Modes with valid Apple signing.
5. `flutter pub get`, `flutter test`, `flutter analyze`, and `flutter build apk --release --dart-define=KASA_PORTAL_URL=https://kasaschool.vercel.app`.

The public portal domain may be changed by `--dart-define` only to a trusted deployment that already has the proper Firebase configuration. Android/iOS FCM integration **cannot be tested** until signed platform applications and Firebase registrations exist. Android sign-in is currently best supported with email and password in the WebView; external OAuth flows need platform-specific deep-link testing.

## Notifications

- The authenticated website uses its existing Firebase ID token to register the device's native FCM token; Flutter itself does not access an authenticated school session.
- School and Marathon use one device record per token in the existing Firebase project. The server derives access from `profiles/{uid}` and checks live account status and Marathon role immediately before delivery.
- New P1 tasks and tasks marked blocked or P1 generate immediate best-effort generic notifications; the scheduled server endpoint aggregates overdue and 0–5 day due tasks into **one daily summary**, not one noisy notification per task.
- The daily job is scheduled in the root `vercel.json` for **06:00 UTC / 08:00 Africa/Lusaka**. Set the Vercel `CRON_SECRET` secret and confirm the deployment plan allows the job. No API client should know that secret.
- No notification is pushed without a user's OS notification permission. The push service never includes task titles, student details or sensitive information.
- Push must be validated end-to-end after Firebase Cloud Messaging and APNs (iOS) credentials are provisioned. This source change alone does not activate live delivery. Serverless sends are best-effort; a production-grade outbox/retry worker can be added if guaranteed delivery is required.
- To remove an individual token for a logged-in device, POST and DELETE `/api/mobile/push-devices` accept a bearer token from the current signed-in website. Before production rollout implement sign-out/uninstall/device-removal reconciliation in all web sign-out surfaces; until then, notifications intentionally contain no sensitive task data.

## Known limitations

The entire web feature set is *displayed and executed from the website*, not rewritten screen by screen in Dart. Network-dependent School operations follow the web application's connectivity behavior. Offline Marathon edits use the site's existing browser IndexedDB queue and service worker, subject to device WebView capabilities. Device camera, payment popups, file pickers, downloads, third-party OAuth, WebView cookies and offline data retention need physical-device acceptance tests. The current repository does not contain generated native Android/iOS runner directories, signing credentials or an installable APK.
