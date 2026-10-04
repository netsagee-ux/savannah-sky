# Vercel migration

The application now uses the Next.js Node runtime. `vercel.json` explicitly selects Next.js, `npm ci`, `npm run build`, and `.next`. Use the repository root as the Vercel root directory.

Required production services:

- Turso/libSQL: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
- Clerk: `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. Enable email verification. Only a verified primary email can receive course access. Existing Sites identity headers are no longer trusted.
- Private Vercel Blob storage: connect the private `savannah-sky-private` store to this project. Vercel supplies `BLOB_READ_WRITE_TOKEN`. The adapter preserves object paths and serves files through the existing access-checked routes. Never create a public store for course files. R2/S3 remains an optional fallback when Blob is not configured (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`).
- `ADMIN_EMAIL`: academy administrator's verified email.
- `APP_ENCRYPTION_KEY`: base64-encoded 32-byte key. Preserve the existing value if migrating encrypted payment settings.
- Keep `PUBLIC_PAYMENTS_READY` unset until Stripe live checkout and signed webhook have been tested.

After connecting the production database, run `node --env-file=.env.local scripts/migrate-vercel.mjs`. This applies schema migrations transactionally and records each one. Existing production content must be exported and imported separately; migrations do not copy existing student records or purchases.

Connect Stripe through the existing admin payment settings and configure the `/api/stripe/webhook` endpoint. Do not enable live checkout until verified. Existing profiles/progress/order ownership must be mapped from old platform user IDs to Clerk IDs during data migration; enrolments match verified email addresses.

Vercel's function request limit prevents the original 25 MB video upload. This version limits uploads to 3 MB per asset; large videos should use the existing hosted course/video link fields until direct-to-storage upload is implemented. Keep a lesson's total upload under 4 MB.

Production release gates: Next build passes; deployment homepage responds successfully; configured login works; admin is denied to other accounts; course thumbnails load; unpaid users cannot access course links; a verified Stripe payment grants exactly one enrolment; revocation removes access.

## Storefront follow-up
Administrator fallback is explicitly set to Netsagee@gmail.com; ADMIN_EMAIL can override it. The Clerk primary email must be verified. Public navigation has no admin links.

After schema migration, run `node --env-file=.env.local scripts/seed-academy.mjs` to add three unpublished draft courses, with proposed GBP prices of £49, £79 and £39. This never overwrites existing courses. Add real training content, thumbnail, prerequisites and access terms before publication.

Stripe can be configured using STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in Vercel instead of the admin encrypted settings. Register checkout.session.completed and checkout.session.async_payment_succeeded at https://savannah-sky-k4rz-three.vercel.app/api/stripe/webhook. Environment configuration takes precedence over stored settings. Use test keys and admin test checkout first; PUBLIC_PAYMENTS_READY remains false until live setup is verified. There is no client-side payment verification or automatic access from an unverified redirect.
