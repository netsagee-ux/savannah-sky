import { db } from './server';
import { sendOrderReceipt } from './order-receipt';

export function internationalNumber(value: string) {
  const number = value.trim().replace(/[\s()-]/g, '').replace(/^\+/, '');
  return /^[1-9]\d{7,14}$/.test(number) ? number : '';
}

export async function academyWhatsApp() {
  const row = await db().prepare("SELECT value FROM settings WHERE id='academy_whatsapp'").first<{value: string}>();
  return internationalNumber(row?.value ?? process.env.ACADEMY_WHATSAPP_NUMBER ?? '');
}

export type AcademyOrder = {
  id: string; user_id: string; email: string; course_id: string; title: string; amount: number;
  mode: string; status: string; session_id: string | null;
};

export async function ownedOrder(id: string, userId: string) {
  return db().prepare('SELECT id,user_id,email,course_id,title,amount,mode,status,session_id FROM orders WHERE id=? AND user_id=?')
    .bind(id,userId).first<AcademyOrder>();
}

type Buyer = {userId: string; email: string};

export function guestBuyer(email: unknown, intent: unknown): Buyer | null {
  if (typeof email !== 'string' || typeof intent !== 'string') return null;
  const address = email.trim().toLowerCase();
  if (address.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)
      || !/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(intent)) return null;
  return {userId: 'guest/' + intent.toLowerCase(), email: address};
}

// Only a verified Clerk identity reaches this function. Insert before updating the
// owner in the same write transaction so reopening a link cannot restore revoked access.
export async function claimPaidOrders(buyer: Buyer, id?: string) {
  const database = db();
  const where = "user_id LIKE 'guest/%' AND mode='whatsapp' AND status='paid' AND email=?" + (id ? ' AND id=?' : '');
  const args = id ? [buyer.email.toLowerCase(), id] : [buyer.email.toLowerCase()];
  if (!await database.prepare('SELECT id FROM orders WHERE ' + where + ' LIMIT 1').bind(...args).first()) return;
  // An earlier release used email-keyed grants. Migrate former owners of the
  // affected courses before attaching the new buyer, preserving separate revocation.
  const matchingCourses='SELECT course_id FROM orders WHERE '+where;
  await database.batch([
    database.prepare(`INSERT OR IGNORE INTO enrollments(id,email,course_id)
      SELECT 'buyer/'||paid.user_id||'/'||paid.course_id,paid.email,paid.course_id
      FROM orders paid JOIN enrollments legacy ON legacy.email=paid.email AND legacy.course_id=paid.course_id
      WHERE legacy.id NOT LIKE 'buyer/%' AND paid.status='paid' AND paid.mode IN ('live','whatsapp')
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
    (user_id=? OR (user_id LIKE 'guest/%' AND mode='whatsapp' AND status='pending' AND email=?))`)
    .bind(id, buyer.userId, buyer.email.toLowerCase()).first<AcademyOrder>();
}

export class GuestOrderLimit extends Error {}

export function chatLink(number: string, order: AcademyOrder, origin: string) {
  if (!internationalNumber(number)) throw Error('Set the academy WhatsApp number first.');
  const message = 'Hello Savannah Sky. I’d like to enrol in ' + order.title + ' (£' + (order.amount / 100).toFixed(2)
    + '). My order reference is ' + order.id + '.\nMy order: ' + origin + '/orders/' + encodeURIComponent(order.id);
  return 'https://wa.me/' + internationalNumber(number) + '?text=' + encodeURIComponent(message);
}

export async function pendingOrder(user: {userId: string; email: string}, course: {id: string; title: string; price: number}, mode: 'live' | 'whatsapp') {
  const email = user.email.toLowerCase();
  const match = "user_id=? AND email=? AND course_id=? AND amount=? AND mode IN ('whatsapp','live') AND status='pending'";
  const matchArgs = [user.userId,email,course.id,course.price];
  // The existence check is inside the write so repeated clicks and concurrent tabs use one order.
  const guest = user.userId.startsWith('guest/');
  // Bound anonymous outstanding orders for an address while allowing a retry of the same intent.
  const quota = guest ? " AND (SELECT COUNT(*) FROM orders WHERE email=? AND user_id LIKE 'guest/%' AND created_at>=?) < 6" : '';
  const quotaArgs = guest ? [email, new Date(Date.now() - 3600000).toISOString()] : [];
  await db().prepare('INSERT INTO orders(id,user_id,email,course_id,title,amount,currency,status,mode,created_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM orders WHERE '+match+')'+quota)
    .bind(crypto.randomUUID(), user.userId, email, course.id, course.title, course.price, 'gbp', 'pending', mode, new Date().toISOString(), ...matchArgs, ...quotaArgs).run();
  const order = await db().prepare('SELECT * FROM orders WHERE '+match+' ORDER BY created_at DESC LIMIT 1').bind(...matchArgs).first<AcademyOrder>();
  if (!order && guest) throw new GuestOrderLimit('Please sign in with your email to place another order, or try again later.');
  if (!order) throw Error('Reopen this course to see its current order status.');
  return order;
}

// Older releases keyed access by email. Transfer those paid entitlements before replacing the legacy row.
export async function recordVerifiedPayment(order: AcademyOrder) {
  if (order.status !== 'paid') {
    if (order.status !== 'pending') throw Error('This order is no longer pending.');
    const database = db();
    const statements = [];
    if ((order.mode === 'live' || order.mode === 'whatsapp') && !order.user_id.startsWith('guest/')) {
      const legacyId = order.email + ':' + order.course_id;
      statements.push(
        database.prepare(`INSERT OR IGNORE INTO enrollments(id,email,course_id)
          SELECT 'buyer/'||o.user_id||'/'||o.course_id,o.email,o.course_id
          FROM enrollments legacy JOIN orders o ON o.email=legacy.email AND o.course_id=legacy.course_id
          WHERE legacy.id=? AND o.user_id NOT LIKE 'guest/%' AND o.user_id NOT LIKE 'withdrawn/%' AND o.status='paid' AND o.mode IN ('live','whatsapp')
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
