# Cloudflare R2 files with Firebase identity and metadata

The authoritative current design and release checklist are in
[CLOUDFLARE_OAUTH_USER_OWNED_R2_PLAN.md](CLOUDFLARE_OAUTH_USER_OWNED_R2_PLAN.md).
The prior shared institutional upload rollout is superseded by the owner's
explicit external-storage-only requirement.

| Surface | New file destination | KASA control |
| --- | --- | --- |
| Profile photos and private documents | Uploader's OAuth-authorized private bucket | Verified metadata; private files shared explicitly |
| Anonymous application images and attachments | Applicant's authorized private bucket | App Check; applicant storage cookie; owner/form verification; submission consent |
| Student CDF and staff-submitted evidence | Uploader's authorized private bucket | Role/application access checks; locked financial statuses; completion consent |
| Official acceptance-pack PDF | Administrator's authorized bucket | Admin-only publication of that administrator's completed PDF |
| Official blank enrollment PDF | Administrator's authorized bucket | Admin-only publication; direct provider download redirect |
| Advertising banner | Administrator's authorized bucket | Admin-only explicit public publication; direct provider image redirect |

Every new file is a browser PUT to Cloudflare S3. KASA upload endpoints accept
JSON only. Middleware refuses browser multipart, PDF, image and octet-stream
write requests; retired binary POST endpoints return `DIRECT_UPLOAD_REQUIRED`.
The OAuth REST object-upload proxy and Firebase upload fallbacks are removed.
Cloudinary URL-entry controls are replaced by file pickers and authorization.
Previously stored Cloudinary URLs, Firebase objects and platform-R2 references
remain readable. No historical objects are deleted or bulk-migrated.

Presigned PUTs sign `If-None-Match: *`, preventing URL reuse from overwriting a
completed object. Completion verifies MIME, size and the first eight bytes,
then atomically updates file/application metadata. Keys and OAuth tokens remain
encrypted in server-only Firestore collections. Direct upload requests contain
no KASA cookies or Firebase ID/App Check tokens. New platform-bucket initiation
is rejected even if historical `R2_PLATFORM_*` values exist.

Manual BYOB credentials remain accepted by the historical connection API for
existing clients. The ordinary website journey never asks for keys. Owner OAuth
connections are preferred automatically and the normal file controls use one
shared authorization component. Disconnected connections cannot mint new URLs;
existing URLs expire within 90 seconds for reads or three minutes for PUTs.

Deploy the additive server-only guest-session Firestore deny rule and retain
the existing `r2Files` owner/status/createdAt index before enabling the release.
Existing authorized read/verification APIs and financial workflow rules remain
in effect. Owner-managed evidence is revocable; KASA keeps references, audit and
verification records but cannot retain file availability against the owner's
revocation. New uploads have no Firebase or shared-bucket fallback.
