# Savannah Sky Academy operations

## Prepare a course

1. Open **My account** and sign in with either designated owner email. The academy workspace opens automatically. Open **Lessons** to manage recordings.
2. In **Courses**, create a draft with its final GBP price, level, description, requirements, duration and access terms. Add a public cover photograph if available.
3. Select **Save course & add lessons**, or open **Manage lessons & videos** on an existing course, and upload the original MP4 or WebM. Set the teaching order and add lesson notes or a knowledge check. A private Vercel Blob store supports direct uploads up to 1 GiB per lesson. Without direct Blob uploads the dashboard sends encrypted recording parts to the private academy database, up to 256 MiB per lesson. Thumbnails accept JPG, PNG and WebP up to 3 MiB. For an interrupted database upload, leave the editor open and press **Save lesson** again. Uploaded parts are reused.
4. Preview the lesson from the admin lesson list. Upload original recordings for programmes that previously used links to an external video host.
5. Set the CPD accreditation flag for the course when applicable. Publish the priced course once its teaching material is ready. A course can contain private recordings, written lessons or quizzes.

## Take payments with the existing SumUp merchant

1. Sign in at `/sign-in` with your verified academy owner account and open **Payments**.
2. In **Payments → Connect merchant account**, enter the merchant code and live secret API key from the academy’s SumUp account. The server checks the merchant with SumUp and encrypts the credentials. The secret key cannot be read back through the dashboard.
3. A student signs in, chooses a priced course, then pays in the embedded SumUp card form. The price is read from the academy database. A webhook or return to the order page triggers independent verification of the checkout, merchant, amount, currency and order reference.
4. A confirmed payment activates the course for the purchasing account. Opening lessons requires both an active enrolment and a paid order for that account and course. The buyer can open it immediately under **My learning**. Staff can search for the paid order, copy the private invitation, or open an addressed email draft. A forwarded link requires the original buyer’s verified account.
5. For automatic confirmation emails, configure `RESEND_API_KEY`, `ACADEMY_RECEIPT_FROM` and `ACADEMY_PUBLIC_URL`. The staff ledger shows whether an email was accepted. Access is granted even if email delivery is unavailable.

**Dashboard totals** show gross confirmed course sales in GBP, paid orders and distinct paying customers across the academy’s order history. Storefront totals exclude test orders and pending orders. They represent gross sales before refunds or processing fees. Process refunds in the provider account and revoke lesson access in **Students** when appropriate. Earlier paid enrolments and protected invitations remain available.

## Private playback

Keep course recordings in private storage. A playback URL is signed for a specific lesson, student account and sign-in session and expires after two hours. The server checks the signature, signed-in identity and current enrolment for every stream and seek request. Revoking access blocks subsequent requests. Uploaded thumbnails are public and should contain only material suitable for the catalogue.

Store production credentials in the deployment environment. See VERCEL-SETUP.md for the runtime configuration.
