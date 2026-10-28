# Direct uploads to owner-authorized Cloudflare storage

This design supersedes the shared institutional-bucket and REST upload-proxy
proposal in the earlier draft of PR #43. The user explicitly requires every
uploader, including administrators, to use external storage they authorize.
KASA must not pool users' file storage costs or accept binary uploads.

## Journey

1. Choose **Connect with Cloudflare** where a file is needed.
2. Cloudflare handles sign-in and permission consent. KASA never asks for a
   Cloudflare password, account ID, bucket name, or secret key in the normal UI.
3. A single authorized account is selected automatically; members with multiple
   accounts choose one. KASA creates a private, deterministic `kasa-files-*`
   bucket in that account and merges a narrowly scoped CORS rule for the app
   origin, preserving unrelated rules. It never enables public bucket access.
4. Cloudflare's supported Account API Token Provisioning API issues an expiring,
   bucket-only Object Read & Write token, bounded by the authorizing member's
   permissions and OAuth consent. KASA encrypts its derived S3 credentials on
   the server, tied to the connection and OAuth session generation. The token
   expires after one hour. Refresh requires a still-valid provider grant.
5. KASA issues a write-once, three-minute presigned PUT for one random object.
   The browser sends bytes directly to `*.r2.cloudflarestorage.com`, omitting
   KASA cookies and Firebase tokens. KASA receives only JSON metadata.
6. Completion checks object size/type with HEAD and an eight-byte range read.
   KASA stores the verified object reference and permissions in Firestore.
7. Private reads are provider URLs valid for 90 seconds. Public banners and
   official blank-form download endpoints redirect to the provider; they do
   not stream file bodies through Vercel. Generating personalized PDFs remains
   server-side and may read the externally stored official PDF template.

Private documents require explicit per-file sharing. Submitting application
attachments or CDF evidence grants admissions access to those files, without
copying them into a KASA bucket. Official assets are published only through
admin-authorized attachment endpoints. Disconnect destroys locally held OAuth
and derived credentials, disables OAuth connections, and leaves all objects in
Cloudflare. Already issued links may work for their short remaining lifetime.
External owners can delete files or revoke access; KASA cannot promise permanent
availability of owner-revocable evidence. Existing Firebase, Cloudinary and
institutional R2 objects remain readable through their historical handlers.

## Applicants without a KASA account

An App Check-protected, rate-limited endpoint creates a seven-day applicant
storage session. A random HttpOnly Secure SameSite=Lax `__Host-` cookie proves
ownership; only its hash identifies the server-side session. It cannot confer
KASA staff privileges and can initiate only application-attachment uploads.
OAuth state is PKCE-protected, single-use, cookie-bound and returns to an
allowlisted application path. Application progress is kept in this tab's
sessionStorage, keyed by form version, restored after OAuth and removed after
submission. It is not persisted to localStorage or an anonymous KASA draft DB.

## Cloudflare client configuration: outstanding release gate

Use an actual Cloudflare public OAuth application (private applications only
work for members of the owning Cloudflare account). Complete Cloudflare's
publisher-domain requirements. Use Authorization Code + refresh token grants,
PKCE S256, and the token-endpoint authentication method matching KASA's backend
(`client_secret_basic`). Register the exact HTTPS callback URI.

Production callback:
`https://kasaschool.vercel.app/api/r2/oauth/callback`

Preview requires its own registered origin/callback and matching Vercel Preview
`CLOUDFLARE_OAUTH_REDIRECT_URI`; never redirect a preview authorization into the
production callback. OAuth cookies are host-bound.

Select the currently supported OAuth scope IDs corresponding to:

- Account Read (authorized-account discovery).
- Workers R2 Storage Write, including bucket creation/configuration and the
  bucket object read/write permission needed in the provisioned token.
- Account API Tokens Write (and any required discovery/read permission), so the
  owner can consent to provision the expiring, bucket-only S3 token.
- `offline_access` for refresh.

Obtain exact current IDs from Cloudflare's authenticated `GET /oauth/scopes`
catalog and the client dashboard. Do not invent scope IDs or use old colon
syntax from the CLI changelog as if it were an accepted third-party-client ID.
The owner also needs Cloudflare API Token Provisioning membership capability
and R2 enabled in the selected external account. KASA does not upgrade plans.

On 28 October the Vercel Production scope value contained unrelated streaming,
images and cache scopes, without the required R2/account-token permissions.
The Production callback value was corrected from the site root to the callback
above. The scopes and callback are still absent from Preview. Cloudflare-side
client registration and real consent cannot be inferred from Vercel variables.

Required server settings are the four `CLOUDFLARE_OAUTH_*` values and the existing
`R2_CREDENTIALS_KEY`. No `R2_PLATFORM_*` values are required for new uploads.
Keep historical platform credentials only if old platform objects need reads.
No new file is copied or migrated automatically.

## Verification before release

Keep PR #43 a draft until current-head CI and preview pass, Firestore rules and
the existing `r2Files` ordered index are deployed, and an independently owned
Cloudflare account proves: consent, bucket/CORS provisioning, token issuance,
direct PUT, completion, profile image, personal sharing/revoke, application
attachments, student/staff CDF, banners, acceptance PDF, blank enrollment PDF,
provider revocation, disconnect, cancellation return, and all legacy reads.
Confirm in browser network tools that file bodies never target the KASA origin.
The local browser tests use provider fixtures; they do not certify a real grant.

Sources verified 28 October 2026:
- https://developers.cloudflare.com/changelog/post/2026-10-01-account-api-token-provisioning/
- https://developers.cloudflare.com/api/resources/accounts/subresources/tokens/methods/create/
- https://developers.cloudflare.com/r2/api/tokens/
- https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- https://developers.cloudflare.com/fundamentals/oauth/create-an-oauth-client/
- https://developers.cloudflare.com/api/typescript/resources/iam/subresources/oauth_scopes/methods/list/

Storage ownership does not make a provider free: each owner is responsible for
its storage and operation usage. Firestore metadata and Vercel control requests
also retain their normal quotas. This design avoids pooled file storage and
upload relay costs; it does not promise universally zero service charges.
