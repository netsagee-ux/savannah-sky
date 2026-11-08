import { getChatGPTUser } from '@/app/chatgpt-auth';
import { db, enrolled } from '@/lib/server';
import { hasCourseDelivery, hasCoursePrice } from '@/lib/payments';

import { academyWhatsApp, chatLink, guestBuyer, internationalNumber, GuestOrderLimit, pendingOrder } from '@/lib/course-orders';

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
    const { courseId } = payload;
    if (!user && payload.handoff !== true) return Response.json({error:'Sign in to open this order.'},{status:401});
    if (!user && (!process.env.CLERK_SECRET_KEY || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)) {
      return Response.json({error:'Student verification is temporarily unavailable.'},{status:503});
    }
    if (user && typeof payload.email === 'string' && user.email !== payload.email.trim().toLowerCase()) {
      return Response.json({error:'Your signed-in email has changed. Refresh this course before ordering.'},{status:409});
    }
    const buyer = user || guestBuyer(payload.email, payload.intent);
    if (!buyer) return Response.json({error:'Enter the email you will use to watch your lessons.'},{status:400});
    if (payload.handoff !== true || payload.test || payload.orderId) {
      return Response.json({error:'Order this course through the academy WhatsApp.'},{status:409});
    }
    const course = await db().prepare('SELECT id,title,price,course_url FROM courses WHERE id=? AND published=1')
      .bind(courseId).first<OrderCourse>();
    if (!course) {
      return Response.json({ error: 'This course is not available for online payment.' }, { status: 409 });
    }
    if (user && await enrolled(course.id)) {
      return Response.json({ error: 'This course is already in My learning.', enrolled: true }, { status: 409 });
    }
    if (!await hasCourseDelivery(course)) {
      return Response.json({ error: 'This course is still being prepared.' }, { status: 409 });
    }

    const number = await academyWhatsApp();
    const needsCallback = !number;
    const phone = typeof payload.callback === 'string' ? internationalNumber(payload.callback) : '';
    if (needsCallback && !phone) return Response.json({error:'Enter your WhatsApp number with its country code so the academy can send payment details.', callbackRequired:true},{status:400});
    const order = await pendingOrder(buyer, {...course, price:hasCoursePrice(course.price)?course.price:0}, 'whatsapp', needsCallback ? phone : '');
    if (needsCallback) return Response.json({callbackSaved:true,orderId:order.id});
    if (order.mode === 'live') return Response.json({existingCardOrder:order.id});
    return Response.json({url:chatLink(number,order,origin),orderId:order.id,guest:!user});
  } catch (error) {
    if (error instanceof GuestOrderLimit) return Response.json({error:error.message},{status:429});
    return Response.json({ error: 'Checkout could not open. Please try again in a moment.' }, { status: 503 });
  }
}
