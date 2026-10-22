# KASA authorization policy

The primary data boundary is the Next.js backend with Firebase Admin SDK. **Firebase Admin bypasses Firestore and Storage Rules.** Client-side UI visibility and Firestore Rules cannot replace an authorization check on every backend route.

## Role-to-operation matrix

| Operation | Super admin | Admin | Reviewer | Finance | Agent | Student |
| --- | --- | --- | --- | --- | --- | --- |
| Read application registers | Yes | Yes | Yes | No | Own referrals only | Own linked submissions via student API |
| Review applications | Yes | Yes | Yes | No | No | No |
| Delete applications | Yes | Yes | No | No | No | No |
| Read public content and form configuration | Yes | Yes | Yes | Public | Public | Public |
| Manage forms, programmes, content and intake | Yes | Yes | No | No | No | No |
| View finance ledger | Yes | Yes | Yes | Yes | No | No |
| Record finance verification | Yes | Yes | No | Yes | No | No |
| Manage commissions | Yes | Yes | No | No | No | No |
| Manage staff roles and bootstrapping | Yes | No | No | No | No | No |

Actual ownership restrictions, status transitions and audit checks remain required in each handler. Roles are loaded from **active, verified Firestore profiles**, not trusted from user-supplied request bodies or Auth custom claims.

## Client rules
- Public may read published forms, programmes, announcements and active ad campaigns.
- Signed-in users may get **only their own** profile; all direct browser administrative mutations and collection scans are denied.
- Public Storage branding is readable; direct Storage writes and all private reads are denied.
- All private document download/upload occurs through server endpoints with authentication and record ownership checks.

## UI
The dashboard navigation uses `src/lib/permissions.ts`, filters links by role and rejects unauthorized deep-link navigation. This is a usability measure; server API denials remain authoritative.

## Limitations and next hardening
This phase centralizes a subset of core administrative route permissions. Additional nested routes, agent-specific ownership policies and all feature toggle states require full endpoint-by-endpoint audit and emulator/E2E coverage before treating the system as fully least-privilege. No production Firestore rules were published by these source changes.
