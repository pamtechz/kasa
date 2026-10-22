# KASA Phase 1 production release checklist

## Verified technical checks

Record the **exact branch SHA** and review all GitHub Actions checks for that SHA. Two distinct workflows must pass: `Quality checks` and `Firebase rules integration`. Verify a Vercel preview generated from the identical commit, remembering that a preview does not validate live Firebase rules, production environment variables, or end-user permissions.

## Read-only security exposure assessment

On a trusted administration workstation with an authorized Firebase Admin service account, first confirm your backup and project identity. Use Node.js 22 and run:

```powershell
node scripts/audit-phase1-security.mjs --project <YOUR_ACTUAL_FIREBASE_PROJECT_ID> --confirm-read-only
```

Do not put credentials on the command line. The audit outputs **aggregate counts only** of possible password-bearing notifications, legacy download tokens, linked/unlinked applications and unverified Auth accounts. It never modifies any records. Do not copy confidential Firestore records into tickets, ChatGPT or GitHub issues. A matching-project guard prevents accidental cross-project scans.

A clean report does **not** establish that no credentials leaked: users may have received messages outside Firestore, and prior deleted content cannot be discovered by a current snapshot. A qualified administrator should investigate and document incident-response actions, force resets or revoke identities if necessary, and rotate legacy application tokens only through a coordinated applicant recovery process.

## Backup and controlled rollout

1. Have an authorized administrator verify the exact Firebase project and take/export a recoverable Firestore backup; verify that it can be restored and that the Storage objects and rules are covered in the separate backup plan. Record backup location securely, not in source control.
2. Confirm full representative tests in an isolated project: anonymous application, verified-account claim, agent submission and commission approval, student document uploads, admin reviews, PDF/ID access, notifications, and rollback. The rules emulator alone does **not** exercise these API routes.
3. Confirm Vercel production environment configuration, including Firebase Admin credentials and App Check. WhatsApp webhook features require real approved Meta credentials. Never substitute dummy production credentials.
4. Use a protected maintenance window to deploy reviewed Firestore/Storage rules and the matching application version as a controlled pair. The GitHub merge alone does not deploy Firebase rules or the Vercel production app (`vercel.json` disables automatic Git deployments).
5. Check health and permission-denied/error logs after deployment with real least-privilege test accounts. Record release SHA, release approver, deployed rule versions, recovery point and time.
6. If authorization or enrollment fails, pause intake, restore the previously approved Firebase rules and roll back the corresponding Vercel deployment; reconcile any intervening data changes before reopening admissions.

**Go/no-go decision:** Do not merge or deploy the security branch on CI success alone; actual exposure remediation and release ownership must be verified and signed off.
