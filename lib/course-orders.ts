import {timingSafeEqual} from 'node:crypto';
import { db } from './server';
import { activationPassword, sendOrderReceipt } from './order-receipt';

export type AcademyOrder = {
  id: string; user_id: string; email: string; course_id: string; title: string; amount: number;
  mode: string; status: string; session_id: string | null;
};

export async function ownedOrder(id: string, userId: string) {
  return db().prepare('SELECT id,user_id,email,course_id,title,amount,mode,status,session_id FROM orders WHERE id=? AND user_id=?')
    .bind(id,userId).first<AcademyOrder>();
}

type Buyer = {userId: string; email: string};

// Only a verified Clerk identity reaches this function. Insert before updating the
// owner in the same write transaction so reopening a link cannot restore revoked access.
export async function claimPaidOrders(buyer: Buyer, id?: string, password?: string) {
  const approved = id && password ? await verifyCoursePassword(id, buyer.email, password) : false;
  const database = db();
  const where = "user_id LIKE 'guest/%' AND mode='whatsapp' AND status='paid' AND email=?" + (id ? ' AND id=?' : '') +
    (approved ? '' : " AND NOT EXISTS (SELECT 1 FROM settings s WHERE s.id='order_activation:'||orders.id)");
  const args = id ? [buyer.email.toLowerCase(), id] : [buyer.email.toLowerCase()];
  if (!await database.prepare('SELECT id FROM orders WHERE ' + where + ' LIMIT 1').bind(...args).first()) return;
  // An earlier release used email-keyed grants. Migrate former owners of the
  // affected courses before attaching the new buyer, preserving separate revocation.
  const matchingCourses='SELECT course_id FROM orders WHERE '+where;
  await database.batch([
    database.prepare(`INSERT OR IGNORE INTO enrollments(id,email,course_id)
      SELECT 'buyer/'||paid.user_id||'/'||paid.course_id,paid.email,paid.course_id
      FROM orders paid JOIN enrollments legacy ON legacy.email=paid.email AND legacy.course_id=paid.course_id
      WHERE legacy.id NOT LIKE 'buyer/%' AND paid.status='paid' AND paid.mode IN ('live','whatsapp','sumup')
        AND paid.user_id NOT LIKE 'guest/%' AND paid.user_id NOT LIKE 'withdrawn/%'
        AND legacy.email=? AND legacy.course_id IN (`+matchingCourses+')').bind(buyer.email.toLowerCase(), ...args),
    database.prepare("DELETE FROM enrollments WHERE id NOT LIKE 'buyer/%' AND email=? AND course_id IN ("+matchingCourses+')')
      .bind(buyer.email.toLowerCase(), ...args),
    database.prepare("INSERT OR IGNORE INTO enrollments(id,email,course_id) SELECT 'buyer/'||?||'/'||course_id,email,course_id FROM orders WHERE " + where)
      .bind(buyer.userId, ...args),
    database.prepare('UPDATE orders SET user_id=? WHERE ' + where).bind(buyer.userId, ...args),
  ]);
}

export async function studentOrder(id: string, buyer: Buyer) {
  await claimPaidOrders(buyer, id);
  return db().prepare(`SELECT id,user_id,email,course_id,title,amount,mode,status,session_id FROM orders WHERE id=? AND
    (user_id=? OR (user_id LIKE 'guest/%' AND mode='whatsapp' AND status IN ('requested','pending','paid') AND email=?))`)
    .bind(id, buyer.userId, buyer.email.toLowerCase()).first<AcademyOrder>();
}

// A paid guest receives this one-time password in their original payment conversation.
// The order leaves the guest namespace atomically on activation, invalidating the password.
export async function coursePassword(id: string, email?: string) {
  const row = await db().prepare(`SELECT o.email FROM orders o JOIN settings s ON s.id='order_activation:'||o.id
    WHERE o.id=? AND o.status='paid' AND o.mode='whatsapp' AND o.user_id LIKE 'guest/%'`)
    .bind(id).first<{email:string}>();
  if (!row || (email && row.email !== email.toLowerCase())) return null;
  return activationPassword(id);
}

async function verifyCoursePassword(id:string, email:string, input:string) {
  const password=await coursePassword(id,email);
  const value=input.trim().toUpperCase().replace(/[- ]/g,'');
  if (!password || !/^[0-9A-F]{16}$/.test(value)) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(password.replaceAll('-','')));
}

// Older releases keyed access by email. Transfer those paid entitlements before replacing the legacy row.
export async function recordVerifiedPayment(order: AcademyOrder) {
  if (order.status !== 'paid') {
    if (order.status !== 'pending') throw Error('This order is no longer pending.');
    const database = db();
    const statements = [];
    if ((['live','whatsapp','sumup'].includes(order.mode)) && !order.user_id.startsWith('guest/')) {
      const legacyId = order.email + ':' + order.course_id;
      statements.push(
        database.prepare(`INSERT OR IGNORE INTO enrollments(id,email,course_id)
          SELECT 'buyer/'||o.user_id||'/'||o.course_id,o.email,o.course_id
          FROM enrollments legacy JOIN orders o ON o.email=legacy.email AND o.course_id=legacy.course_id
          WHERE legacy.id=? AND o.user_id NOT LIKE 'guest/%' AND o.user_id NOT LIKE 'withdrawn/%' AND o.status='paid' AND o.mode IN ('live','whatsapp','sumup')
            AND EXISTS (SELECT 1 FROM orders WHERE id=? AND mode=? AND status='pending')`).bind(legacyId,order.id,order.mode),
        database.prepare("DELETE FROM enrollments WHERE id=? AND EXISTS (SELECT 1 FROM orders WHERE id=? AND mode=? AND status='pending')")
          .bind(legacyId,order.id,order.mode),
        database.prepare(`INSERT OR IGNORE INTO enrollments(id,email,course_id)
          SELECT 'buyer/'||user_id||'/'||course_id,email,course_id FROM orders WHERE id=? AND mode=? AND status='pending'`)
          .bind(order.id,order.mode),
      );
    }
    statements.push(database.prepare("UPDATE orders SET status='paid',paid_at=? WHERE id=? AND mode=? AND status='pending'")
      .bind(new Date().toISOString(),order.id,order.mode));
    const results = await database.batch(statements);
    if (!results[results.length - 1].meta.changes) {
      const current = await database.prepare('SELECT mode,status FROM orders WHERE id=?').bind(order.id).first<AcademyOrder>();
      if (current?.mode !== order.mode || current.status !== 'paid') throw Error('The payment method or order status has changed. Refresh the order.');
    }
  }
  return order.mode === 'test' ? 'ineligible' : sendOrderReceipt(order.id);
}

export async function confirmManualPayment(id: string) {
  const order = await db().prepare("SELECT * FROM orders WHERE id=? AND mode='whatsapp'").bind(id).first<AcademyOrder>();
  if (!order || !['pending','paid'].includes(order.status)) throw Error('Choose a pending WhatsApp order.');
  return recordVerifiedPayment(order);
}
