import { notFound } from 'next/navigation';
import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { academyWhatsApp, chatLink, studentOrder } from '@/lib/course-orders';
import { enrolled } from '@/lib/server';
import { studentCoursePath } from '@/lib/student-course-link';
import CheckoutButton from '@/components/checkout-button';
import OrderRefresh from '@/components/order-refresh';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function OrderPage({params,searchParams}: {params: Promise<{id: string}>; searchParams: Promise<{handoff?: string}>}) {
  const {id} = await params;
  const user = await requireChatGPTUser('/orders/' + encodeURIComponent(id));
  const order = await studentOrder(id,user);
  if (!order) notFound();
  const paid = order.status === 'paid';
  const hasAccess = paid && ['whatsapp','live'].includes(order.mode) && await enrolled(order.course_id);
  const offerCard = !paid && order.mode === 'live';
  const contact = paid || offerCard ? '' : await academyWhatsApp();
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') || '';
  const origin = new URL('https://' + host).origin;
  const whatsapp = contact ? chatLink(contact,order,origin) : undefined;
  const handoff = (await searchParams).handoff === '1';
  return <section className="studio-wrap order-room"><span className="studio-kicker">Your enrolment</span>
    <h1>{order.title}</h1><p className="order-total">£{(order.amount / 100).toFixed(2)}</p>
    <div role="status"><h2>{paid ? 'Payment confirmed' : 'Awaiting payment'}</h2>
    <p>{paid ? (hasAccess ? 'Open your next lesson using the account you used to pay. You can return here to practise again.' : order.mode === 'test' ? 'This is a test order.' : 'Course access is inactive. Contact the academy with your order reference.') : order.mode === 'live' ? 'Complete your payment securely to unlock your lessons.' : 'Arrange your payment in the academy WhatsApp chat using this order reference. Your private course link will appear here after the academy verifies the funds.'}</p></div>
    {paid ? <a className="button" href={hasAccess ? studentCoursePath(order.id) : '/dashboard'}>{hasAccess ? 'Open my course' : 'My learning'}</a>
      : <>{offerCard && <CheckoutButton courseId={order.course_id} orderId={id}/>}
        {whatsapp && <a className="button outline" href={whatsapp}>Open academy WhatsApp</a>}
        <OrderRefresh handoff={handoff ? whatsapp : undefined}/></>}
    <small>Order reference {order.id}</small>
  </section>;
}
