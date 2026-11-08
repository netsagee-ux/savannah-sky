import { db } from './server';

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

export function chatLink(number: string, order: AcademyOrder, origin: string) {
  if (!internationalNumber(number)) throw Error('Set the academy WhatsApp number first.');
  const message = 'Hello Savannah Sky. I’d like to enrol in ' + order.title + ' (£' + (order.amount / 100).toFixed(2)
    + '). My order reference is ' + order.id + '.\nMy order: ' + origin + '/orders/' + encodeURIComponent(order.id);
  return 'https://wa.me/' + internationalNumber(number) + '?text=' + encodeURIComponent(message);
}

export async function pendingOrder(user: {userId: string; email: string}, course: {id: string; title: string; price: number}, mode: 'live' | 'whatsapp') {
  const email = user.email.toLowerCase();
  const match = "user_id=? AND email=? AND course_id=? AND amount=? AND mode=? AND status='pending'";
  const matchArgs = [user.userId,email,course.id,course.price,mode];
  // The existence check is inside the write so repeated clicks and concurrent tabs use one order.
  await db().prepare('INSERT INTO orders(id,user_id,email,course_id,title,amount,currency,status,mode,created_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM orders WHERE '+match+')')
    .bind(crypto.randomUUID(), user.userId, email, course.id, course.title, course.price, 'gbp', 'pending', mode, new Date().toISOString(), ...matchArgs).run();
  const order = await db().prepare('SELECT * FROM orders WHERE '+match+' ORDER BY created_at DESC LIMIT 1').bind(...matchArgs).first<AcademyOrder>();
  if (!order) throw Error('Reopen this course to see its current order status.');
  return order;
}

export async function confirmManualPayment(id: string) {
  const order = await db().prepare("SELECT * FROM orders WHERE id=? AND mode='whatsapp'").bind(id).first<AcademyOrder>();
  if (!order || !['pending','paid'].includes(order.status)) throw Error('Choose a pending WhatsApp order.');
  if (order.status === 'paid') return;
  await db().batch([
    db().prepare("INSERT OR IGNORE INTO enrollments(id,email,course_id) SELECT ?,email,course_id FROM orders WHERE id=? AND mode='whatsapp' AND status='pending'")
      .bind(order.email + ':' + order.course_id, id),
    db().prepare("UPDATE orders SET status='paid',paid_at=? WHERE id=? AND mode='whatsapp' AND status='pending'")
      .bind(new Date().toISOString(),id),
  ]);
}
