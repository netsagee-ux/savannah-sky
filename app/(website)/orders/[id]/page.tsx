import {notFound} from 'next/navigation';
import {requireChatGPTUser} from '@/app/chatgpt-auth';
import ActivateCourse from '@/components/activate-course';
import SumUpCard from '@/components/sumup-card';
import {studentOrder} from '@/lib/course-orders';
import {paidInvitationPath} from '@/lib/course-invitation';
import {syncSumUp} from '@/lib/sumup';
export const dynamic='force-dynamic';

export default async function OrderPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const path='/orders/'+encodeURIComponent(id);
  const user=await requireChatGPTUser(path);
  let order=await studentOrder(id,user);
  if(!order)notFound();
  let checkingFailed=false;
  if(order.mode==='sumup' && order.status==='pending' && order.session_id){
    try{await syncSumUp(id);order=await studentOrder(id,user);}
    catch{checkingFailed=true;}
  }
  if(!order)notFound();
  const course='/courses/'+encodeURIComponent(order.course_id);
  const paid=order.status==='paid';
  const activation=paid && order.user_id.startsWith('guest/');
  const invitation=paid && !activation ? await paidInvitationPath(id) : null;
  return <section className="studio-wrap order-room"><a className="underlink" href={course}>Back to course</a>
    <p className="studio-kicker">Your enrolment</p><h1>{order.title}</h1>
    {order.amount>0&&<p className="order-total">£{(order.amount/100).toFixed(2)}</p>}
    {paid?<><h2>Payment confirmed</h2>{activation?<><p>Use the one-time password sent to your order email.</p><ActivateCourse id={id}/></>:invitation?<><p>Your lessons are ready. Sign in with this account whenever you want to return.</p><a className="button" href={invitation}>Open my course</a></>:<p>Check your access in <a href="/dashboard">My learning</a>.</p>}</>:
      checkingFailed?<><h2>Checking your payment</h2><p>We couldn’t reach SumUp. If you’ve already paid, check again before making another payment.</p><a className="button" href={path}>Check again</a></>:
      order.mode==='sumup' && order.status==='pending' && order.session_id?<><h2>Pay securely by card</h2><p>Course access will be added to {user.email}.</p><SumUpCard checkoutId={order.session_id}/></>:
      order.mode==='sumup'?<><h2>{order.status==='pending'?'Finish setting up your checkout':'Checkout '+order.status}</h2><a className="button" href={course+'#enrol'}>Return to enrolment</a></>:
      <><h2>Earlier order</h2><p>Contact the academy with your order reference to check its status.</p><a className="underlink" href="/contact">Contact the academy</a></>}
    <small>Order reference {order.id}</small>
  </section>;
}
