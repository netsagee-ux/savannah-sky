# Savannah Sky Academy operations

## Prepare a course

1. Use the academy administrator’s verified Clerk account to open `/admin`.
2. In **Courses**, create a draft with its final GBP price, level, description, requirements, duration and access terms. Add a public cover photograph if available.
3. In **Lessons**, choose that course and upload the original MP4 or WebM. Set the teaching order and add lesson notes or a knowledge check. A private Vercel Blob store supports direct uploads up to 1 GiB per lesson. The R2 form accepts video files up to 3 MiB. Thumbnails accept JPG, PNG and WebP up to 3 MiB.
4. Preview the lesson from the admin lesson list. Upload original recordings for programmes that previously used links to an external video host.
5. In **Payments**, enter the academy’s business WhatsApp number with its country code. Publish the priced course when its lessons are ready.

## Process an order

A signed-in student chooses **Enrol via WhatsApp**. Their chat contains the course, price, order reference and a link back to their personal order page. The student sends the prepared message. Opening a chat creates a pending order.

- **Payment arranged in chat.** Match the reference, amount and student in **Payments** to the funds actually received. Select **Confirm received payment** on that order. The order and enrolment update together.
- **Card payment.** With live Stripe configured and enabled, the student can open **Pay securely** on their order page. The server verifies the order, amount, currency, buyer email and completed Stripe session before activating access. Configure the two Checkout events listed in VERCEL-SETUP.md. Admin can reconcile delayed Stripe notifications from **Payments**.
- **Student confirmation.** The private order page displays payment status. Confirmed courses appear in **My learning**, where the student can watch lessons, save progress and open their completion record.
- **Refunds.** Process refunds in Stripe or through the agreed payment method. In **Students**, revoke the corresponding course access when appropriate.

## Private playback

Keep course recordings in private storage. A playback URL is signed for a specific lesson and student account and expires after two hours. The server checks the signature, signed-in identity and current enrolment for every stream and seek request. Revoking access blocks subsequent requests. Uploaded thumbnails are public and should contain only material suitable for the catalogue.

Card test payments do not create paid enrolments. Store production secrets in the deployment environment or the encrypted admin payment settings. See VERCEL-SETUP.md for the runtime configuration.
