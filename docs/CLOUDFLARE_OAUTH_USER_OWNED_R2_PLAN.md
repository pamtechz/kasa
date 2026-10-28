# KASA customer-owned Cloudflare R2 authorization

## Target connection experience

**Desired:** KASA account → Connect my Cloudflare → sign in at Cloudflare →
review requested permissions and select a Cloudflare account/bucket →
authorize KASA → return to KASA → upload to the selected user-owned bucket.

KASA retains metadata, owner, submission association, grants, and audit events
in Firebase Firestore; user-owned R2 is the source of the file bytes.
Uploads belonging to a KASA business process require clear consent for KASA
staff to open that specific file or document group. Unrelated personal files
are not visible to KASA. The user can disconnect, revoke sharing, or manage
Cloudflare OAuth authorizations; revoke must terminate newly issued links.
Existing signed reads may remain usable for up to their 90-second lifetime.
Never promise retention of official CDF documents solely in a revocable user
bucket; preserve institutional evidence under KASA's separate retention rules.

## Verified Cloudflare platform constraints (28 October 2026)

- Cloudflare provides public third-party OAuth clients and Authorization Code
  authentication with account selection, scopes, and revocation.
- A public client must be registered in the Cloudflare dashboard and meet its
  domain-verification and public-client requirements. Configure its redirect
  URI to a KASA HTTPS callback. Keep OAuth client secrets server-side.
- The Cloudflare R2 S3-compatible API requires SigV4 access-key credentials,
  not a raw OAuth bearer token. The current KASA presigned browser-to-R2
  upload implementation cannot accept an OAuth access token as if it were
  a S3 secret key.
- Cloudflare separately provides an R2 REST API with object operations.
  A Cloudflare-OAuth integration must verify that the user's approved R2
  scope works with those REST operations before enabling storage.
  REST API rate limits and server relay limits matter, especially for
  large files. A direct browser upload option requires an authenticated
  Worker gateway or an independently authorized scoped-S3 credential grant.
- Never generate long-lived S3 tokens from OAuth without an explicitly
  supported Cloudflare API flow and user consent. Do not ask users to
  authorize all of Cloudflare or all their buckets.
- The manual bucket-scoped R2 token pathway remains a fallback until a
  working public OAuth client and end-to-end R2 REST upload/read integration
  can be verified.

Cloudflare primary references:
https://developers.cloudflare.com/fundamentals/oauth/create-an-oauth-client/
https://developers.cloudflare.com/fundamentals/oauth/authorizing-an-application/
https://developers.cloudflare.com/fundamentals/oauth/integrate-with-cloudflare/
https://developers.cloudflare.com/r2/api/
https://developers.cloudflare.com/r2/api/tokens/
https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/objects/methods/upload/

## Implementation gates for OAuth onboarding

1. KASA registers a Cloudflare **public** OAuth client under its company
   account and completes verified publisher-domain requirements.
2. Retrieve supported current OAuth scopes and confirm precise R2 permissions,
   eligible buckets and whether Cloudflare's object REST API accepts them.
3. Implement state/nonce, redirect URI exact-match, Authorization Code+PKCE,
   encrypted short-lived access/refresh tokens, server-side token storage,
   refresh/revoke, account/bucket selection, and safe failed-authorization UX.
4. Implement authorized R2 API upload and per-object read for user buckets.
   Use an authenticated edge gateway for large direct uploads if REST proxying
   through Vercel exceeds size/time limits. Do not leak OAuth bearer tokens
   to browsers or to R2 signed URLs.
5. Verify real uploads, read, revoke, disconnection, expiry, CORS, replay,
   tenant isolation, KASA grant boundaries, billing/ownership, retention and
   operational fallback with independent Cloudflare users.
6. Only then replace the manual-token connect screen with **Connect with
   Cloudflare** as the primary option. Maintain manual API token connection as
   an advanced recovery method.

## Current deliverable

User-owned bucket setup via scoped S3 API credentials is implemented.
KASA can read personal documents only when the user explicitly clicks
**Share with KASA**; authorized staff can list and open these grants in
their profile workspace. This is a separate file consent from the future
Cloudflare account-level OAuth authorization, and should remain so.
