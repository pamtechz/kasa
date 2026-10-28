# KASA Cloudflare R2 + Firebase (BYOB) — rollout guide

## Source of truth and migration policy
Firebase Authentication remains the **only sign-in provider** and Cloud Firestore remains the **authoritative database**. R2 stores object bytes only.

Do **not** run the previous Supabase SQL starter against KASA. Do **not** delete Firebase Storage files or historic Cloudinary links until they have been migrated and verified.

| Firestore collection | Purpose | Client access |
|---|---|---|
| `r2Connections/{uuid}` | Bucket name, account ID, jurisdiction, label, owner UID, active/disconnected | DENIED (server API only) |
| `r2ConnectionSecrets/{uuid}` | AES-256-GCM encrypted scoped keys | DENIED |
| `r2Files/{uuid}` | Owner, connection ID, object key, pending/ready state, size, MIME, purpose, grants | DENIED |
| `profiles/{uid}.photoAssetId` | Reference to owned ready profile image | Owner profile read only |
| `submissions/{id}.documents[kind].r2FileId` | Verified CDF document reference. Legacy `path` retained | DENIED |

Private **signed URLs are never stored** in Firestore; only stable object keys/IDs. Completed uploads are independently checked with R2 HEAD and eight-byte Range GET before becoming visible. MIME sniffing is not a malware scanner.

## Required Vercel environment configuration
- `R2_CREDENTIALS_KEY`: **persistent, random 32-byte key, base64-encoded**. Generate once using `openssl rand -base64 32`. Set as Vercel encrypted production/preview environment variable. Retain a secure recovery copy, rotate only using a re-encryption migration. Not the Cloudflare API key.
- `R2_PLATFORM_ACCOUNT_ID`: 32-character Cloudflare account ID.
- `R2_PLATFORM_BUCKET`: private, KASA-operated bucket for admissions evidence.
- `R2_PLATFORM_ACCESS_KEY_ID` and `R2_PLATFORM_SECRET_ACCESS_KEY`: token scoped to this bucket with Object Read & Write permissions.
- `R2_PLATFORM_JURISDICTION`: `default`, `eu`, `us`, or `fedramp` (optional).

If KASA platform R2 is not configured, **CDF upload remains on Firebase Storage**. Private BYOB connections additionally require `R2_CREDENTIALS_KEY`; no temporary fallback encryption is allowed.

## Cloudflare R2 bucket preparation
1. Create a **private** R2 bucket, and generate an **Object Read & Write token restricted to this bucket** in Cloudflare Storage & databases > R2 > API Tokens.
2. Configure bucket CORS for your actual site origin:
```json
[
  {
    "AllowedOrigins": ["https://kasaschool.vercel.app"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type", "If-None-Match"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```
For preview domains add an explicit allowed origin, never wildcard in production.
3. Set the environment values and redeploy. Open **My Profile & Account > Cloudflare R2 storage** to test a personal bucket connection.
4. Upload an image or document and confirm Firestore `r2Files.status=ready`. Check signed reads and access denial with another user.
5. With a platform bucket configured, upload CDF evidence as a student and as an authorized admissions staff member. Confirm the submission document reference and verification workflow, including old Firebase files.
6. Disable BYOB connection and confirm **no R2 objects are deleted**. Old objects become unavailable through KASA after secret deletion, exactly as the UI warns.

## Ownership, privacy and data portability
- Personal BYOB bucket keys are encrypted at rest using AES-GCM associated data bound to the connection ID. Only the backend accesses the secrets. Tokens are never sent back to clients.
- A signed read URL is a short-lived bearer URL (90 seconds). Access requires the owner or an explicit active-KASA-UID share; all other reads return 403.
- **Institutional student/CDF evidence always goes to the KASA platform bucket**, regardless of an individual's own BYOB bucket: retention and lawful audit cannot depend on the applicant's revocable personal key.
- Customers can revoke their own Cloudflare R2 token and take their objects outside KASA. Bucket disconnection deletes stored keys, not bytes. KASA keeps historical Firestore references for audit.
- Public read URLs are **intentionally not enabled** for private or CDF buckets: publishing a bucket can expose all its objects. A separate verified public bucket/domain and security review will be needed before adding public R2 URLs.
- This is not zero-knowledge or end-to-end encryption of user files; BYOB controls where object bytes live.

## Existing storage migration
- Preserve `photoUrl` for legacy Cloudinary profile images and Firebase `path` for old attachments.
- New profile photos set `profiles/{uid}.photoAssetId` and no longer require external Cloudinary registration. Signed photo previews expire and refresh.
- New CDF evidence uses R2 only when institutional keys are configured; old mobile clients can temporarily still submit to the Firebase upload API.
- Migrate historic files in controlled **owner-approved batches**. Download from the legacy provider server-side with independent authorization, verify bytes and checksums, upload to the **correct** private R2 bucket, then transactionally switch the Firestore object reference; preserve original references and audit events for rollback.
- Before disabling legacy uploads, separately review the unauthenticated public form-upload flow (App Check, staged attachments) and PDFs uploaded through acceptance-letter settings.
- Enable lifecycle cleanup for stale `r2Files` pending assets (5+ minutes) and unused uploaded objects; monitor storage costs and quota limits. Current code does not perform bulk migration or malware scanning.

## Security and release gates
All presigned PUTs sign `If-None-Match: *`. R2 evaluates this condition atomically, so the same capability cannot replace an existing object, even before its URL expires. Removing or changing the header invalidates the signature. Include `If-None-Match` in CORS on existing buckets before using the updated uploader. Pre-upgrade pending uploads must be restarted; existing ready references remain readable. Student CDF upload initiation and completion both require Firebase App Check, matching the legacy student upload route.

Provider reference: https://developers.cloudflare.com/r2/api/s3/extensions/#conditional-operations-in-putobject

No master secrets in Flutter, browser bundles, source control, Firestore profile reads or R2 URL response bodies. Verify authorization, key rotation, R2 jurisdiction, CORS and typed file constraints. R2 signing uses AWS SigV4 query authorization scoped to the fixed Cloudflare endpoint (never an arbitrary user URL). No live connection can be tested until valid keys are provided through secure Vercel/BYOB settings.
