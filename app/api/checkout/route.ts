import { getChatGPTUser } from '@/app/chatgpt-auth';
import { admin, db, enrolled } from '@/lib/server';
import { hasCourseDelivery, hasCoursePrice, paymentConfig, publicPaymentsReady, stripe } from '@/lib/payments';

type OrderCourse = { id: string; title: string; price: number | null; course_url: string | null };

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (request.headers.get('origin') !== origin) return Response.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in to enrol.' }, { status: 401 });

  try {
    const payload = await request.json() as { courseId?: unknown; test?: unknown } | null;
    if (typeof payload?.courseId !== 'string' || !payload.courseId) {
      return Response.json({ error: 'Choose a course before checking out.' }, { status: 400 });
    }
    const { courseId, test } = payload;
    const testing = test === true && await admin();
    const course = await db().prepare('SELECT id,title,price,course_url FROM courses WHERE id=? AND (published=1 OR ?=1)')
      .bind(courseId, testing ? 1 : 0).first<OrderCourse>();
    if (!course || !hasCoursePrice(course.price)) {
      return Response.json({ error: 'This course is not available for online payment.' }, { status: 409 });
    }
    if (!testing && await enrolled(course.id)) {
      return Response.json({ error: 'This course is already in My learning.', enrolled: true }, { status: 409 });
    }
    if (!testing && !await hasCourseDelivery(course)) {
      return Response.json({ error: 'This course is still being prepared.' }, { status: 409 });
    }
    const config = await paymentConfig();
    if (!config || config.mode !== (testing ? 'test' : 'live') || (!testing && !publicPaymentsReady())) {
      return Response.json({ error: 'Enrolment is not open yet. Ask the academy about the next opening.' }, { status: 503 });
    }

    const id = crypto.randomUUID();
    const email = user.email.toLowerCase();
    await db().prepare('INSERT INTO orders(id,user_id,email,course_id,title,amount,currency,status,mode,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(id, user.userId, email, course.id, course.title, course.price, 'gbp', 'pending', config.mode, new Date().toISOString()).run();
    const form = new URLSearchParams({
      mode: 'payment', customer_email: email, 'line_items[0][price_data][currency]': 'gbp',
      'line_items[0][price_data][unit_amount]': String(course.price),
      'line_items[0][price_data][product_data][name]': course.title, 'line_items[0][quantity]': '1',
      'metadata[orderId]': id, 'metadata[courseId]': course.id,
      success_url: origin + '/payment-result?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: origin + '/courses/' + encodeURIComponent(course.id) + '#enrol',
    });
    const session = await stripe('checkout/sessions', config.secret, form, id);
    await db().prepare('UPDATE orders SET session_id=? WHERE id=?').bind(session.id, id).run();
    return Response.json({ url: session.url });
  } catch {
    return Response.json({ error: 'Checkout could not open. Please try again in a moment.' }, { status: 503 });
  }
}
