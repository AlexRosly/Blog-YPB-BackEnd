# Existing article media edits

Backend base: Blog-YPB-BackEnd 7b9fbe38aff1664221bc45a1d13145d90ab2a691.
Feature off by default. Backend first, Adminka second. Do not reset local deployments
or force-apply a patch. No migration. No writes to other articles.

## Authorization gate (required before enabling)
The inspected Blog API has no in-app administrator token verification on its legacy
post router; CORS is not admin authentication. The new route must be reached through
the trusted gateway. On the gateway, strip any client-supplied X-Blog-Media-Gateway.
Validate the normal Adminka bearer token with its legitimate issuer, including expiry
and permission to edit the blog. Only then inject a random server-side secret for this
route and forward over a private network or TLS. Never expose this secret in JS, CORS,
logs, or public config. Do not enable based on a frontend login flag alone. Confirm what
admin auth service verifies the token before rollout; no auth or proxy changes are
included in the patch. Restrict direct backend access to the trusted proxy. Keep the
same credentials as normal admin login; do not send token to alternate media hosts.

Set BLOG_MEDIA_GATEWAY_SECRET (at least 32 characters, generated randomly) in the
backend and authenticated gateway, and BLOG_EXISTING_ARTICLE_MEDIA=true in the backend.
If the gateway is not ready, leave disabled. GET /blog/api/post/capabilities advertises
existingArticleMedia only when both backend switches are set. Proxy configuration and
verification of actual authorized/anonymous requests remain separate deployment steps.

## Request / integrity
PATCH /blog/api/post/update-post-media/:id accepts multipart fields title, description,
author, markup, revision, and media, plus repeated image blobs (up to 12, 500 KB each,
JPEG/PNG/WebP). revision must be the ISO string from the existing row's updatedAt.
media holds cover {alt,caption} and inline descriptors in the actual HTML image order.
Each existing image index (1 onward) must occur exactly once; ambiguous legacy articles
and unsupported sources fail closed. A caption-only edit uses zero file parts. Server
replaces each staged blob source with a durable uploaded URL, writes markup and ordered
metadata in one conditional Mongo update and updates changeDate, never publicationDate,
country, heading or articleUrl. URL/ID of existing cover and retained photos stay the same.
Cloudinary upload uses new random IDs with overwrite disabled. Known failures clean up
only newly uploaded files. Unknown database write outcome does not delete those objects:
check the article before retrying and reconcile orphaned objects off the request path.
No file-deletion, unsafe legacy reconciliation, or public-site changes in this scope.

The ordinary JSON path is unchanged. Create now normalizes a single alt/caption into a
one-item list and stores full context on the post, avoiding the one-letter bug on future
single covers. Previously stored single letters are not guessed or bulk rewritten.

## Checks before release
1. Install dependencies and run node --test on a supported Node runtime (18 or newer).
2. On staging with test Mongo and Cloudinary, verify missing/invalid bearer and
   spoofed trusted header fail; confirm verified blog admin can use this exact PATCH.
3. Create a fixture with cover and inline photos; edit with one new image above an
   existing image, inspect resumed editor and public page for correct image positions,
   descriptions, links and metadata. Change the cover alt and clear a caption
   without a file upload. Compare URL, country and publication date.
4. Simulate upload failure and concurrent save. Confirm no partial post write and
   no lost existing images. Check original text-only save and new post still work.
5. Once deployed, verify a known article by read first. For Montréal, repair D by
   supplying full descriptive alt and either a descriptive or blank caption; insert
   two selected photos only after reuse permission is established. Keep SEO, credits,
   existing body and GPTiti note; confirm before/after URL and Canada-only listing.
No production test post. Rollback: disable the flag first. Existing saved links/media
continue to render with the previous public reader using the same stored schema.
