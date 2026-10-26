# KASA School + Life Marathon (Flutter mobile)

## Scope

This is an **Android/iOS Flutter web-backed shell** for exact UI/operations parity with the existing Next.js School and Marathon websites. It does **not** claim to be a fully reimplemented native Flutter UI. It loads the deployed first-party KASA website in a first-party-only WebView, preserving existing Firebase login, role-aware menus, dynamic forms, checklist, updates, and the web's offline sync behavior. It does **not** introduce a duplicate database, user profile, or privileged API credential.

Native Firebase Cloud Messaging (FCM) connects through the website's authenticated `/api/mobile/push-devices` endpoint. In-app banners show foreground updates; the OS handles push notifications while the app is backgrounded. Tap a notification to open its permitted KASA internal route.

## Build prerequisites

1. Install Flutter 3.32+ (with Dart 3.8+), Android SDK and, for iOS, Xcode on macOS.
2. In this directory run `flutter create --platforms=android,ios --org com.pamtech --project-name kasa_mobile .` to generate Android/iOS runner projects **without replacing the supplied Dart sources**.
3. Register Android and iOS apps **in the same Firebase project used by the deployed School website**. Run `flutterfire configure` or add the platform configuration files securely, then follow FlutterFire's current platform initialization instructions. No admin/private key belongs in the mobile app.
4. Android: run `dart run tool/configure_android.dart` after generation to add `android.permission.INTERNET` and `android.permission.POST_NOTIFICATIONS` to the release manifest. Use the Android application ID `com.pamtech.kasa` when registering the Firebase Android app, then add the matching Google Services file and plugin. For iOS, configure APNs capability, Push Notifications and Background Modes with valid Apple signing.
5. `flutter pub get`, `flutter test`, `flutter analyze`, and `flutter build apk --release --dart-define=KASA_PORTAL_URL=https://kasaschool.vercel.app`.

Android native file selection is wired through `webview_flutter_android` and the platform file picker, so KASA document and image inputs can open a phone file selector. Device acceptance testing remains required for large uploads, camera capture, and content providers.\n\nThe public portal domain may be changed by `--dart-define` only to a trusted deployment that already has the proper Firebase configuration. Android/iOS FCM integration **cannot be tested** until signed platform applications and Firebase registrations exist. Android sign-in is currently best supported with email and password in the WebView; external OAuth flows need platform-specific deep-link testing.

## Android release credentials and acceptance gate

**Debug APK is not a Firebase-enabled signed release.** The normal pull-request CI produces a test/debug APK without an Android Firebase configuration. The separate **KASA Android signed release verification** workflow is manual and deliberately refuses to build until the real Firebase app and signing credentials are configured.

1. In the **same Firebase project as KASA School**, open **Firebase Console → Project settings → General → Your apps → Add app → Android**. Register the precise package **`com.pamtech.kasa`**, download its `google-services.json` and check that it contains an Android client for exactly that package. Never use the Web App ID as an Android app ID. Existing Android package registrations should be reused, not duplicated.
2. In the GitHub repository settings, create the repository variable **`KASA_FIREBASE_PROJECT_ID`** containing the *same* project ID. Create the following **Actions repository secrets**: `KASA_FIREBASE_ANDROID_JSON_B64` (base64 of the registered `google-services.json`), `KASA_ANDROID_KEYSTORE_B64` (base64 of the protected upload keystore), `KASA_ANDROID_KEY_ALIAS`, `KASA_ANDROID_KEY_PASSWORD` and `KASA_ANDROID_STORE_PASSWORD`. Never copy the Firebase Admin private key or signing credentials into code, the APK or a PR comment.
3. Generate and safeguard an **Android upload signing key** in an approved location (or use the institution's existing key). Keep encrypted backups and recovery ownership documented. The keystore fingerprint can be used to configure future integrations or Play App Signing.
4. After the vetted PR is approved and merged into **main**, manually run **Actions → KASA Android signed release verification → Run workflow** on main. The workflow refuses to access signing secrets from other branches. CI creates the Flutter Android runner, loads the encrypted configuration only on the ephemeral runner, checks project and package agreement, applies Google Services Gradle integration, configures non-debug signing, builds, verifies the APK package and signature, and uploads a short-lived artifact. No APK is automatically published or distributed.
5. On a real Android phone with Google Play services, install the signed APK, sign in with a verified School account, approve notifications, check device registration through the authenticated website, and send a **targeted Firebase test notification** while the app is backgrounded. Test foreground, terminated app, sign-out, account switching and Marathon permission revocation. Confirm actions appear only for authorized School/Marathon accounts; never use real student data in test pushes.

Without steps 1–5, Android Cloud Messaging and sign-in/device acceptance remain unverified. An iOS build additionally requires a separately registered iOS bundle ID, Apple signing and APNs key; this Android pipeline does not certify iOS. Firebase registration must be performed by an identity with the necessary permissions on the School Firebase project.

## Notifications

- The authenticated website uses its existing Firebase ID token to register the device's native FCM token; Flutter itself does not access an authenticated school session.
- School and Marathon use one device record per token in the existing Firebase project. The server derives access from `profiles/{uid}` and checks live account status and Marathon role immediately before delivery.
- New P1 tasks and tasks marked blocked or P1 generate immediate best-effort generic notifications; the scheduled server endpoint aggregates overdue and 0–5 day due tasks into **one daily summary**, not one noisy notification per task.
- The daily job is scheduled in the root `vercel.json` for **06:00 UTC / 08:00 Africa/Lusaka**. Set the Vercel `CRON_SECRET` secret and confirm the deployment plan allows the job. No API client should know that secret.
- No notification is pushed without a user's OS notification permission. The push service never includes task titles, student details or sensitive information.
- Push must be validated end-to-end after Firebase Cloud Messaging and APNs (iOS) credentials are provisioned. This source change alone does not activate live delivery. Serverless sends are best-effort; a production-grade outbox/retry worker can be added if guaranteed delivery is required.
- To remove an individual token for a logged-in device, POST and DELETE `/api/mobile/push-devices` accept a bearer token from the current signed-in website. The web bridge attempts to unregister on sign-out or account switch. Delivery ignores tokens not refreshed within 35 days; offline sign-outs cannot guarantee immediate deregistration, so notifications intentionally contain no sensitive task data.

## Known limitations

The entire web feature set is *displayed and executed from the website*, not rewritten screen by screen in Dart. Network-dependent School operations follow the web application's connectivity behavior. Offline Marathon edits use the site's existing browser IndexedDB queue and service worker, subject to device WebView capabilities. Device camera, payment popups, file pickers, downloads, third-party OAuth, WebView cookies and offline data retention need physical-device acceptance tests. The repository does not contain generated Android/iOS runner directories or signing credentials. GitHub Actions generates Android runner files and provides a debug APK artifact for review; that debug artifact does not establish live Firebase Messaging functionality.
