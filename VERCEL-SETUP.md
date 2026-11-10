# Vercel migration

The application now uses the Next.js Node runtime. `vercel.json` explicitly selects Next.js, `npm ci`, `npm run build`, and `.next`. Use the repository root as the Vercel root directory.

Production configuration

- Turso/libSQL: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
- Clerk: `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. Enable email verification. Only a verified primary email can receive course access. Existing Sites identity headers are no longer trusted.
- For larger recordings, connect the private `savannah-sky-private` store to this project. Vercel supplies `BLOB_READ_WRITE_TOKEN`. The adapter preserves object paths and serves files through the existing access-checked routes. Never create a public store for course files. R2/S3 remains an optional fallback when Blob is not configured (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`).
- `APP_ENCRYPTION_KEY`: base64-encoded 32-byte key. Preserve this key when moving the deployment. It protects invitations, activation codes, private database uploads, playback and historical payment credentials.
- Course checkout uses the existing SumUp merchant. Save the live credentials under Admin → Payments, or configure SUMUP_MERCHANT_CODE and SUMUP_API_KEY as server-only production variables.

After connecting the production database, run `node --env-file=.env.local scripts/migrate-vercel.mjs`. This applies schema migrations transactionally and records each one. Existing production content must be exported and imported separately; migrations do not copy existing student records or purchases.

Existing profiles/progress/order ownership must be mapped from old platform user IDs to Clerk IDs during data migration; paid enrolments follow the verified buyer account, and manually assigned legacy enrolments match verified email addresses.

Use the configured academy host for checkout. The old savannah-sky.vercel.app hostname redirects course and sign-in paths to savannah-sky-k4rz-three.vercel.app.

Admin → Lessons sends MP4 and WebM recordings up to 1 GiB directly to the connected private Vercel Blob store. Set `BLOB_READ_WRITE_TOKEN` or supply Vercel’s Blob store ID and OIDC credentials. Without direct Blob uploads the dashboard stores recordings in AES-256-GCM encrypted chunks in the academy database, up to 256 MiB per recording. Thumbnails are limited to 3 MiB. Replace legacy externally hosted course material with a privately uploaded recording before opening enrolment.

Production release gates: Next build passes; deployment homepage responds successfully; configured login works; admin is denied to other accounts; course thumbnails load; unpaid users cannot access course links; a verified SumUp payment grants exactly one enrolment; revocation removes access.

## Storefront follow-up
Everyone signs in at `/sign-in`. The two designated owners are matched against their verified primary email on the server and enter the academy workspace. Other accounts open My learning. Previously saved staff assignments do not grant access.

After schema migration, run `node --env-file=.env.local scripts/seed-academy.mjs` to add three unpublished draft courses, with proposed GBP prices of £49, £79 and £39. This never overwrites existing courses. Add real training content, thumbnail, prerequisites and access terms before publication.

For existing card transactions, keep the previous Stripe credentials and signed webhook available for reconciliation. Staff can check an earlier order under Payments. New card orders use SumUp.
