import {createHmac} from 'node:crypto';
import { db } from './server';
import { paidInvitationPath } from './course-invitation';

type PaidOrder = { activatedWithPassword:number; email: string; title: string; amount: number; course_id: string };
export type ReceiptStatus = 'sent' | 'pending' | 'unconfigured' | 'ineligible';

export function activationPassword(id:string) {
  const key=process.env.APP_ENCRYPTION_KEY;
  if (!key) throw Error('Course activation is temporarily unavailable.');
  const hex=createHmac('sha256',key).update('academy-course-activation/v1/'+id).digest('hex').slice(0,16).toUpperCase();
  return hex.match(/.{4}/g)!.join('-');
}

export function receiptsConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.ACADEMY_RECEIPT_FROM);
}

export async function sendOrderReceipt(id: string): Promise<ReceiptStatus> {
  if (!receiptsConfigured()) return 'unconfigured';
  try {
    const database = db();
    const order = await database.prepare(
      "SELECT email,title,amount,course_id,EXISTS(SELECT 1 FROM settings WHERE id='order_activation:'||orders.id) AS activatedWithPassword FROM orders WHERE id=? AND status='paid' AND mode IN ('whatsapp','live') AND user_id NOT LIKE 'withdrawn/%'"
    ).bind(id).first<PaidOrder>();
    if (!order) return 'ineligible';

    const key = 'order_receipt:' + id;
    if (await database.prepare('SELECT id FROM settings WHERE id=?').bind(key).first()) return 'sent';

    const base = process.env.ACADEMY_PUBLIC_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : '');
    const path = await paidInvitationPath(id);
    if (!path) return 'ineligible';
    const instructions = base ? 'Open your private course: ' + new URL(path, base).href : 'Sign in to Savannah Sky and open My learning.';
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
      headers: {
        Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'academy-receipt/' + id,
      },
      body: JSON.stringify({
        from: process.env.ACADEMY_RECEIPT_FROM, to: [order.email], subject: 'Your Savannah Sky course payment is confirmed',
        text: [
          'We’ve received your payment for ' + order.title + '.',
          'Amount paid: £' + (order.amount / 100).toFixed(2), 'Order reference: ' + id,
          '', instructions, 'Student login: '+order.email, ...(order.activatedWithPassword ? ['One-time course password: '+activationPassword(id),'Verify your email and enter this password on your first visit.'] : ['Sign in with your order email to open your lessons.']), '', 'Savannah Sky Training Academy',
        ].join('\n'),
      }),
    });
    if (!response.ok) return 'pending';
    const accepted = await response.json() as { id?: string };
    if (!accepted.id) return 'pending';
    await database.prepare('INSERT OR IGNORE INTO settings(id,value) VALUES(?,?)').bind(key, accepted.id).run();
    return 'sent';
  } catch {
    // Payment and course access have already been committed. Staff can retry the receipt.
    return 'pending';
  }
}
