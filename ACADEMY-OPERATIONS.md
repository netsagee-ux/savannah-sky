# Savannah Sky Academy operations

## Prepare a course

1. Use the academy administrator’s verified Clerk account to open `/admin`.
2. In **Courses**, create a draft with its final GBP price, level, description, requirements, duration and access terms. Add a public cover photograph if available.
3. Select **Save course & add lessons**, or open **Manage lessons & videos** on an existing course, and upload the original MP4 or WebM. Set the teaching order and add lesson notes or a knowledge check. A private Vercel Blob store supports direct uploads up to 1 GiB per lesson. Without direct Blob uploads the dashboard sends encrypted recording parts to the private academy database, up to 256 MiB per lesson. Thumbnails accept JPG, PNG and WebP up to 3 MiB.
4. Preview the lesson from the admin lesson list. Upload original recordings for programmes that previously used links to an external video host.
5. In **Payments**, enter the academy’s business WhatsApp number with its country code. Publish the priced course when its lessons are ready.

## Process an order

A new student enters the email they will verify after payment and chooses **Order via WhatsApp**. Their chat contains the course, price, order reference and a link back to their personal order page. The student sends the prepared message. Opening the chat creates a pending order. Returning students can order from their verified accounts.

- **Payment arranged in chat.** Match the reference, amount and student in **Payments** to the funds actually received. Select **Confirm received payment** on that order. A signed-in buyer gains access immediately. For a guest order, send the one-time course password and the order email with the AES-256-GCM encrypted invitation. The student signs in with that email and enters the password once. On the paid order, choose **Copy WhatsApp reply**, paste it into the buyer’s original chat and send it. The link opens the next lesson for that buyer’s verified account and can be used again for revision.
- **Requests without a listed fee or business number.** Students leave their WhatsApp number on the course page. Open their request in Payments, choose **Set fee** when needed, and use **Message student on WhatsApp** to send payment details. Match the actual funds before confirming.
- **Earlier card orders.** New checkout is WhatsApp only. Staff can reconcile earlier card transactions. An expired, unpaid legacy session can move to WhatsApp after verification.
- **Student confirmation.** The private order page displays payment status. Confirmed courses appear in **My learning**, where the student can watch lessons, save progress and open their completion record.
- **Email confirmation.** Set `RESEND_API_KEY` and `ACADEMY_RECEIPT_FROM` in the Vercel production environment. Use an address on the academy’s verified sending domain. Set `ACADEMY_PUBLIC_URL` to point students to a custom domain if needed. After a real order is confirmed, **Payments** shows whether the provider accepted the email. If sending failed, use **Send confirmation email** on the paid order. Access is available as soon as the payment is recorded.
- **Refunds.** Process refunds in Stripe or through the agreed payment method. For a paid invitation the student has yet to claim, use **Withdraw invitation** in Payments. For active enrolments, in **Students** revoke the corresponding course access when appropriate.

## Private playback

Keep course recordings in private storage. A playback URL is signed for a specific lesson, student account and sign-in session and expires after two hours. The server checks the signature, signed-in identity and current enrolment for every stream and seek request. Revoking access blocks subsequent requests. Uploaded thumbnails are public and should contain only material suitable for the catalogue.

Store production credentials in the deployment environment. See VERCEL-SETUP.md for the runtime configuration.
