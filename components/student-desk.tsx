import {ArrowUpRight, BookOpen} from 'lucide-react';
import {studentCoursePath} from '@/lib/student-course-link';

export type DeskCourse = {booking_id?:string|null; id:string; title:string; level:string; thumbnail_key:string|null; total:number; completed:number; next_lesson:string|null};
export type DeskOrder = {classroom?:number; id:string; title:string; amount:number; status:string; mode:string; created_at:string; session_id:string|null; invitation:string|null};

export default function StudentDesk({name,email,courses,orders,failed,staff=false,retiredDeveloper=false}: {
  name:string; email:string; courses:DeskCourse[]; orders:DeskOrder[]; failed:boolean; staff?:boolean; retiredDeveloper?:boolean;
}) {
  return <div className="student-desk-inner" aria-label="Student workspace">
    <header className="desk-heading"><p className="studio-kicker">Student workspace</p><h1>My bookings &amp; learning</h1>
      <nav aria-label="Student workspace"><a href="#my-courses">My courses</a><a href="#orders">Orders</a><a href="#account">Account</a>{staff&&<a href="/admin?tab=Lessons">Manage course videos</a>}</nav></header>
    {failed && <p className="notice" role="alert">Your account could not be loaded. Refresh to try again.</p>}
    <section id="my-courses"><div className="desk-section-head"><h2>Course library</h2><span>{courses.length} active</span></div>
      {courses.length ? <div className="desk-courses">{courses.map(course=>{
        const complete=Number(course.total)>0 && Number(course.total)===Number(course.completed);
        return <article className="desk-course" key={course.id}>
          <img src={course.thumbnail_key?'/api/course-thumbnail/'+course.id:'/nail-sculpted-480.webp'} alt="" width={480} height={360}/>
          <div><small>{course.level}</small><h3>{course.title}</h3>
            {course.booking_id&&<a className="button" href={'/orders/'+encodeURIComponent(course.booking_id)}>View class dates <ArrowUpRight size={16}/></a>}
            {(!course.booking_id||course.total>0)&&<><progress aria-label={course.title+' progress'} value={course.completed} max={Math.max(1,course.total)}/>
            <p>{course.completed} of {course.total} lessons complete</p>
            <a className="button" href={course.next_lesson?'/learn/'+course.next_lesson:'/courses/'+course.id}>{complete?'Revisit lessons':course.completed?'Continue learning':course.booking_id?'Class materials':'Start course'} <ArrowUpRight size={16}/></a></>}
            {complete&&<a className="underlink" href={'/certificate/'+course.id}>Completion record</a>}
          </div></article>;
      })}</div>:!failed && <div className="desk-empty"><BookOpen size={24}/><h3>No active courses yet</h3><p>Once SumUp confirms your payment, your course appears here.</p><a className="button" href="/courses">Browse courses</a></div>}
    </section>
    <section id="orders"><div className="desk-section-head"><h2>My orders</h2></div>
      {orders.length ? <ul className="desk-orders">{orders.map(order=>{
        const paid=order.status==='paid' && order.mode!=='test';
        const path=order.classroom?'/orders/'+encodeURIComponent(order.id):paid&&order.invitation?studentCoursePath(order.invitation):!paid&&['live','test'].includes(order.mode)&&order.session_id?'/payment-result?session_id='+encodeURIComponent(order.session_id):'/orders/'+encodeURIComponent(order.id);
        return <li key={order.id}><div><small>{new Date(order.created_at).toLocaleDateString('en-GB')} · Ref {order.id.slice(0,8)}</small><h3>{order.title}</h3>
          <p>{order.status==='requested'?'Fee requested':'£'+(order.amount/100).toFixed(2)} · {order.mode==='test'?'Test order':paid?'Payment confirmed':order.status==='pending'?'Awaiting payment':order.status}</p></div>
          <a href={path} className="underlink">{paid?(order.classroom?'View class booking':'Open my course'):'View order'} <ArrowUpRight size={15}/></a></li>;
      })}</ul>:<p>{failed?'Order history is unavailable.':'No orders yet.'}</p>}
    </section>
    <section id="account"><div className="desk-section-head"><h2>My account</h2></div><div className="desk-account"><div>{name!==email&&<strong>{name}</strong>}<p>{email}</p>{retiredDeveloper&&<a className="underlink" href="/account/profile">Manage temporary account</a>}</div><a className="underlink" href="/sign-out" target="_top">Sign out</a></div></section>
  </div>;
}
