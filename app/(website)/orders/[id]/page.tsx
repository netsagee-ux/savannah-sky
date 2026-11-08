import ActivateCourse from '@/components/activate-course';
import { notFound } from 'next/navigation';
import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { academyWhatsApp, chatLink, studentOrder } from '@/lib/course-orders';
import { enrolled } from '@/lib/server';
import { paidInvitationPath } from '@/lib/course-invitation';
import OrderRefresh from '@/components/order-refresh';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function OrderPage({params,searchParams}: {params: Promise<{id: string}>; searchParams: Promise<{handoff?: string}>}) {
  const {id} = await params;
  const user = await requireChatGPTUser('/orders/' + encodeURIComponent(id));
  const order = await studentOrder(id,user);
  if (!order) notFound();
  const paid = order.status === 'paid';
  const activation = paid && order.user_id.startsWith('guest/');
  const quoted = order.status !== 'requested';
  const hasAccess = !activation && paid && ['whatsapp','live'].includes(order.mode) && await enrolled(order.course_id);
  const invitation = hasAccess ? await paidInvitationPath(id) : null;
  const contact = paid ? '' : await academyWhatsApp();
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') || '';
  const origin = new URL('https://' + host).origin;
  const whatsapp = contact ? chatLink(contact,order,origin) : undefined;
  const handoff = (await searchParams).handoff === '1';
  return <section className="studio-wrap order-room"><span className="studio-kicker">Your enrolment</span>
    <h1>{order.title}</h1>{quoted&&<p className="order-total">£{(order.amount / 100).toFixed(2)}</p>}
    <div role="status"><h2>{paid ? 'Payment confirmed' : quoted ? 'Awaiting payment' : 'Fee requested'}</h2>
    <p>{activation ? 'Enter the one-time password the academy sent you after payment.' : !quoted ? 'The academy will send your fee and payment instructions on WhatsApp.' : paid ? (hasAccess ? 'Open your next lesson using the account you used to pay. You can return here to practise again.' : order.mode === 'test' ? 'This is a test order.' : 'Course access is inactive. Contact the academy with your order reference.') : order.mode === 'live' ? 'Contact the academy on WhatsApp with this reference to check your earlier payment before paying.' : 'Arrange your payment in the academy WhatsApp chat using this order reference. Your private course link will appear here after the academy verifies the funds.'}</p></div>
    {activation ? <ActivateCourse id={id}/> : paid ? <a className="button" href={invitation || '/dashboard'}>{hasAccess ? 'Open my course' : 'My learning'}</a>
      : <>
        {whatsapp && <a className="button outline" href={whatsapp}>Open academy WhatsApp</a>}
        <OrderRefresh handoff={handoff ? whatsapp : undefined}/></>}
    <small>Order reference {order.id}</small>
  </section>;
}
