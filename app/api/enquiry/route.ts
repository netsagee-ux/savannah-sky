import { db } from '@/lib/server';

const interests = ['Choosing a course', 'Course availability', 'Student support', 'Something else', 'Payment plans', 'Class dates'];

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return Response.json({ error: 'Invalid origin' }, { status: 403 });
  }
  const raw = await request.json().catch(() => null);
  const data = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const interest = data.interest === undefined ? '' : data.interest;
  const name = typeof data?.name === 'string' ? data.name.trim() : '';
  const email = typeof data?.email === 'string' ? data.email.trim() : '';
  const message = typeof data?.message === 'string' ? data.message.trim() : '';
  if (!name || name.length > 100 || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || message.length < 10 || message.length > 3000 || (typeof interest !== 'string' || (interest && !interests.includes(interest)))) {
    return Response.json({ error: 'Please check your details' }, { status: 400 });
  }
  try {
    await db().prepare('INSERT INTO enquiries (id,name,email,message,created_at) VALUES (?,?,?,?,?)')
      .bind(crypto.randomUUID(), name, email, (interest || 'Enquiry') + ' — ' + message, new Date().toISOString()).run();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Unable to save enquiry' }, { status: 503 });
  }
}
