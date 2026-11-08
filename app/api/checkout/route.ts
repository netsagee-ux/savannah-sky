import { getChatGPTUser } from '@/app/chatgpt-auth';
import { admin, db, enrolled } from '@/lib/server';
import { hasCourseDelivery, hasCoursePrice, paymentConfig, publicPaymentsReady, stripe } from '@/lib/payments';

import { academyWhatsApp, chatLink, guestBuyer, internationalNumber, GuestOrderLimit, ownedOrder, pendingOrder } from '@/lib/course-orders';

type OrderCourse = { id: string; title: string; price: number | null; course_url: string | null };

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (request.headers.get('origin') !== origin) return Response.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await getChatGPTUser();

  try {
    const payload = await request.json() as { courseId?: unknown; test?: unknown; handoff?: boolean; orderId?: string; email?: unknown; intent?: unknown; callback?: unknown } | null;
    if (typeof payload?.courseId !== 'string' || !payload.courseId) {
      return Response.json({ error: 'Choose a course before checking out.' }, { status: 400 });
    }
    const { courseId, test } = payload;
    if (!user && payload.handoff !== true) return Response.json({error:'Sign in to open this order.'},{status:401});
    if (!user && (!process.env.CLERK_SECRET_KEY || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)) {
      return Response.json({error:'Student verification is temporarily unavailable.'},{status:503});
    }
    if (user && typeof payload.email === 'string' && user.email !== payload.email.trim().toLowerCase()) {
      return Response.json({error:'Your signed-in email has changed. Refresh this course before ordering.'},{status:409});
    }
    const buyer = user || guestBuyer(payload.email, payload.intent);
    if (!buyer) return Response.json({error:'Enter the email you will use to watch your lessons.'},{status:400});
    const testing = test === true && await admin();
    const course = await db().prepare('SELECT id,title,price,course_url FROM courses WHERE id=? AND (published=1 OR ?=1)')
      .bind(courseId, testing ? 1 : 0).first<OrderCourse>();
    if (!course || (!payload.handoff && !hasCoursePrice(course.price))) {
      return Response.json({ error: 'This course is not available for online payment.' }, { status: 409 });
    }
    if (!testing && user && await enrolled(course.id)) {
      return Response.json({ error: 'This course is already in My learning.', enrolled: true }, { status: 409 });
    }
    if (!testing && !await hasCourseDelivery(course)) {
      return Response.json({ error: 'This course is still being prepared.' }, { status: 409 });
    }
    if (!testing && payload.handoff) {
      const number = await academyWhatsApp();
      const needsCallback = !number;
      const phone = typeof payload.callback === 'string' ? internationalNumber(payload.callback) : '';
      if (needsCallback && !phone) return Response.json({error:'Enter your WhatsApp number with its country code so the academy can send payment details.', callbackRequired:true},{status:400});
      const order = await pendingOrder(buyer, {...course, price:hasCoursePrice(course.price)?course.price:0}, 'whatsapp', needsCallback ? phone : '');
      if (needsCallback) return Response.json({callbackSaved:true,orderId:order.id});
      if (order.mode === 'live') return Response.json({existingCardOrder:order.id});
      return Response.json({url:chatLink(number,order,origin),orderId:order.id,guest:!user});
    }
    if (!user || (!testing && !payload.orderId)) {
      return Response.json({error:'Start a new course order through the academy WhatsApp.'},{status:409});
    }
    const config = await paymentConfig();
    if (!config || config.mode !== (testing ? 'test' : 'live') || (!testing && !publicPaymentsReady())) {
      return Response.json({ error: 'Secure payment is unavailable.' }, { status: 503 });
    }
    const email = user.email.toLowerCase();
    const existing = payload.orderId ? await ownedOrder(payload.orderId,user.userId) : null;
    if (payload.orderId && (!existing || existing.course_id !== course.id || existing.email !== email || existing.amount !== course.price || existing.status !== 'pending' || existing.mode !== 'live' || testing)) {
      return Response.json({error:'Reopen the course to check its current price and availability.'}, {status:409});
    }
    const id = existing?.id || crypto.randomUUID();
    let attempt = id;
    if (existing?.session_id) {
      const previous = await stripe('checkout/sessions/'+encodeURIComponent(existing.session_id),config.secret);
      if (previous.status === 'open' && previous.url) return Response.json({url:previous.url});
      if (previous.status !== 'expired') return Response.json({error:'Payment is being verified. Check My learning.'},{status:409});
      attempt = id + '-' + existing.session_id;
    }
    if (!existing) await db().prepare('INSERT INTO orders(id,user_id,email,course_id,title,amount,currency,status,mode,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(id, user.userId, email, course.id, course.title, course.price, 'gbp', 'pending', config.mode, new Date().toISOString()).run();
    const form = new URLSearchParams({
      mode: 'payment', customer_email: email, 'line_items[0][price_data][currency]': 'gbp',
      'line_items[0][price_data][unit_amount]': String(course.price),
      'line_items[0][price_data][product_data][name]': course.title, 'line_items[0][quantity]': '1',
      'metadata[orderId]': id, 'metadata[courseId]': course.id,
      success_url: origin + '/payment-result?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: existing ? origin+'/orders/'+id : origin + '/courses/' + encodeURIComponent(course.id) + '#enrol',
    });
    const session = await stripe('checkout/sessions', config.secret, form, attempt);
    await db().prepare('UPDATE orders SET session_id=? WHERE id=?').bind(session.id, id).run();
    return Response.json({ url: session.url });
  } catch (error) {
    if (error instanceof GuestOrderLimit) return Response.json({error:error.message},{status:429});
    return Response.json({ error: 'Checkout could not open. Please try again in a moment.' }, { status: 503 });
  }
}
