import Link from 'next/link';
import './policy.css';

export const metadata = {title: 'Payments, cancellations and refunds'};

export default function PaymentPolicy() {
  return <article className="studio-wrap payment-policy">
    <p className="studio-kicker">Customer information</p>
    <h1>Payments, cancellations and refunds</h1>
    <p>This policy covers classroom bookings and shop purchases made on the Savannah Sky website.</p>

    <h2>Choosing how to pay</h2>
    <p>You’ll see the total in pounds before you pay, including any delivery charge and discount. SumUp processes the payment. Its checkout shows the methods available for your order.</p>
    <p>If PayPal appears, you can open your wallet and see whether PayPal offers Pay in 3. It is a credit agreement for eligible UK residents aged 18 or over. PayPal decides whether to approve a purchase and shows the amount due today, future payments and terms before you agree. Consider whether you can afford each payment. Missing payments may affect future borrowing.</p>
    <p>You can pay in full without applying for credit. If you choose instalments, PayPal manages the agreement and collects the repayments. The academy does not collect your credit application or card details. <a href="https://www.paypal.com/uk/digital-wallet/paypal-payin3/terms">Read PayPal’s UK Pay in 3 terms</a>.</p>

    <h2>When your order is confirmed</h2>
    <p>Your classroom booking or paid shop order is confirmed once SumUp confirms the full order payment to the academy. If you use instalments, you can book your class or receive your goods while you make the remaining repayments to PayPal. Carla will confirm your class date separately.</p>
    <p>If you leave checkout or it still shows a pending payment, open the order in your account and check its status before paying again.</p>

    <h2>Cancelling a course booking</h2>
    <p>If you booked online as a consumer, you normally have 14 days from the day after booking to cancel. If you expressly ask us to start teaching in that period and then cancel, you may have to pay for the teaching already provided. If the service is completed during that period, the right to cancel ends early only where you expressly requested the early start and acknowledged that consequence.</p>
    <p>To cancel or ask about moving a class, contact Carla with your booking reference. If the academy cancels your class, you can choose a replacement date or a refund for the cancelled class.</p>

    <h2>Returning shop goods</h2>
    <p>For most online consumer purchases, tell us within 14 days of receiving the goods if you change your mind. You then have another 14 days to send them back. Contact us with your order reference for return instructions. When you cancel the whole order, the refund includes standard outbound delivery.</p>
    <p>We refund eligible returns within 14 days of receiving the goods back or receiving evidence you sent them, whichever comes first. We may deduct for loss in value caused by handling beyond what you would reasonably do in a shop. The change-of-mind right has exceptions, including genuinely personalised goods and sealed goods that are unsuitable for return for health or hygiene reasons once unsealed. If an item is faulty, damaged or different from its description, please tell us so we can put it right. Your statutory rights still apply.</p>

    <h2>Refunds and repayments</h2>
    <p>We return approved refunds through the original payment method. PayPal applies any full or partial refund to your plan and shows your revised balance in your wallet. Follow the schedule shown there until PayPal confirms a change. Contact PayPal directly if a repayment is due and you need help.</p>
    <p>For a booking, delivery, cancellation or refund, <Link href="/contact#ask">contact the academy</Link> with your order reference. Please keep card numbers, passwords and verification codes out of your message.</p>
  </article>;
}
