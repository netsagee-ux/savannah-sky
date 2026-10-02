# Savannah Sky Academy operations

## What is implemented
- Published/draft courses and prices in GBP; searchable public catalogue.
- Create/edit lessons, order them, upload MP4/WebM (25 MiB maximum), add HTTPS training and resource links, optional three-choice knowledge checks.
- Server-authorized student enrollment, protected uploaded video streaming, saved progress, and completion records.
- Owner admin: manual access activation/revocation, student progress, enquiries, encrypted Stripe configuration and order reconciliation.
- Stripe hosted Checkout; signed webhook verification; server-retrieved session verification; transactional, idempotent live enrollment; student purchase history.

## Payment setup and launch gate
The deployed site is owner-private. Live checkout remains disabled: Stripe and students cannot reach a private academy without platform authorization. Do not set PUBLIC_PAYMENTS_READY until public access has been explicitly authorized and webhook reachability tested.

1. In Admin → Payments, enter your own Stripe test secret key and the signing secret for `/api/stripe/webhook`. Keys are encrypted with the runtime APP_ENCRYPTION_KEY using AES-GCM, never returned by APIs or committed to source. Preserve this encryption key across deployments.
2. Register `checkout.session.completed` and `checkout.session.async_payment_succeeded` in Stripe. The private preview cannot receive external callbacks; a returned test checkout can still be verified by the return page or admin reconciliation.
3. Add an actual course priced at least £0.50. Admin test checkout supports draft courses. Use Stripe test cards; test transactions do not unlock real courses.
4. After owner approval to change the site's audience, verify public webhook delivery, then connect matching live keys. Have an engineer set runtime PUBLIC_PAYMENTS_READY=true and deploy. Run an authorized small real payment and refund before launch. Verify its order, enrollment, student login, protected video, quiz, and completion record.
5. Reconcile pending orders only via the server's Stripe verification. Never grant access solely from a customer-supplied redirect or screenshot.

Refunds/disputes are managed in Stripe; review/revoke access in Students as appropriate. They are not automatically synchronized. External Stripe Payment Links remain a separate manual-enrollment option; they do not feed the automatic order system. External course/video links are governed by the external host's privacy controls.

## Authentication and ownership
Sign-in uses ChatGPT accounts. ADMIN_EMAIL currently designates the site's owner. Before a business handover, arrange the actual academy administrator and explicitly authorized site audience. This version does not implement standalone email/password registration, tax calculation, marketing emails, or accreditation. Completion records are not accreditation certificates.

## Validation in this change
- TypeScript typecheck.
- Security tests for HTTPS links, signed/tampered/expired webhook payloads, and strict paid session matching.
- Fresh SQLite migration replay and duplicate fulfillment/revocation transaction checks.
- Production compilation and Sites deployment status.

Real Stripe transaction testing and browser end-to-end verification remain required before accepting students; no live Stripe account or usable browser preview was available in this session.

## Private video access and thumbnails
Videos uploaded in Admin → Lessons remain in the private R2 bucket. Each playback request requires a signed-in enrolled user or the configured administrator. The video-access API issues an HMAC-signed playback URL bound to that user and lesson, valid for two hours. Every byte-range request checks both the signature and current enrollment; revoking enrollment invalidates access immediately even if the URL has not expired. Links do not grant access to another account. This is access control, not DRM: an authorized viewer can still record the screen.

A thumbnail is uploaded separately (JPG/PNG/WebP, up to 3 MiB); bytes are checked before accepting it. Published course thumbnails may be viewed before purchase, but raw video storage keys are never included in the public course catalogue. Course and lesson thumbnails stay separate from protected video bytes. Uploaded lesson videos are limited to 25 MiB per file in this version; R2 does not provide adaptive video transcoding. For longer recordings, split the recording into lessons or arrange a dedicated streaming integration before launch. Existing external video links retain their external provider's access rules; use uploaded video for in-site authorization.

## Separate sign-in areas
- `/login`: student entry, using the platform's ChatGPT sign-in; `/dashboard`: enrolled courses, next unfinished lesson, last 100 orders and account details.
- `/admin/login`: administrator entry; `/admin`: separate management shell without the marketing header/footer. Both admin pages and every management API retain server authorization.

## Performance work
Supplied image originals are preserved; resized WebP variants are used on the website. Primary variants total 397,772 bytes versus 1,549,562 original bytes (74.3% smaller, not a Lighthouse score). Fonts are self-hosted subsets (83,644 bytes combined); CSS no longer depends on a Google Fonts import. The main image is prioritized, below-fold images are lazy-loaded, and no video bytes load before the enrolled student presses play. An actual 95+ mobile/desktop performance score has NOT been verified: this private site cannot be assessed as the intended page by anonymous PageSpeed checks, and the required browser-control capability is unavailable. Measure with an authenticated browser session before public launch.

## Course-level delivery and identity update
Admin → Courses now includes a private HTTPS course link and a separate public thumbnail upload. Catalog queries explicitly exclude course_url. The access endpoint checks sign-in and current enrolment on every request and responds with a non-cacheable redirect. Enrolled users can open their purchased course from course details or My courses. Course thumbnails appear on the home directory, catalogue, detail page and student account. Existing lesson videos and thumbnails are preserved. External destinations retain their own access controls; copied destination links cannot be revoked by this academy.

Validated with type checking, eight security tests including unpaid/revoked access checks, and fresh migration replay. Browser visual QA was unavailable because the required browser-control skill was not installed. Live Stripe payments remain gated by existing payment configuration and public launch requirements.

## Minimal interface update
Removed the announcement bar, repeated academy labels, oversized wordmark and decorative rules. Added a transparent logo, system UI typography, a single-row mobile header, rounded controls, subtle repeating image motion and a global pause control. Added administrator-only review management using the existing settings table; only published real reviews appear on the home page, with a seamless ticker when two or more reviews exist. No invented testimonials were seeded.

This update could not be published in the current environment: the configured network proxy was unavailable and automatic approval review rejected the required escalated Sites workflow because it executes scripts in /root/.codex. The deployed site therefore still contains the prior version until publishing is authorized and available.
