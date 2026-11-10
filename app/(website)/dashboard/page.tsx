import {redirect} from 'next/navigation';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import StudentDesk, {type DeskCourse, type DeskOrder} from '@/components/student-desk';
import {claimPaidOrders} from '@/lib/course-orders';
import {db, isOwnerEmail, enrolmentOwner} from '@/lib/server';

export const dynamic='force-dynamic';
export const metadata={title:'My learning & orders'};

export default async function Dashboard({searchParams}:{searchParams:Promise<{view?:string}>}){
  const user=await getChatGPTUser();
  if(!user)redirect('/sign-in?redirect_url=%2Fdashboard');
  const isOwner=isOwnerEmail(user.email);
  if(isOwner && (await searchParams).view!=='student')redirect('/admin');
  const email=user.email.toLowerCase(), uid=user.userId;
  let courses:DeskCourse[]=[],orders:DeskOrder[]=[],failed=false;
  try {
    await claimPaidOrders(user);
    const database=db();
    const [,library,history]=await Promise.all([
      database.prepare('INSERT INTO profiles(id,email,name) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name')
        .bind(uid,email,user.displayName).run(),
      database.prepare(`SELECT DISTINCT c.id,c.title,c.level,c.thumbnail_key,
        (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id) AS total,
        (SELECT COUNT(*) FROM progress p JOIN lessons l ON l.id=p.lesson_id WHERE l.course_id=c.id AND p.user_id=?) AS completed,
        (SELECT l.id FROM lessons l WHERE l.course_id=c.id ORDER BY EXISTS
          (SELECT 1 FROM progress p WHERE p.user_id=? AND p.lesson_id=l.id),l.position,l.id LIMIT 1) AS next_lesson
        FROM courses c JOIN enrollments e ON e.course_id=c.id WHERE `+enrolmentOwner).bind(uid,uid,uid).all<DeskCourse>(),
      database.prepare(`SELECT id,title,amount,status,mode,created_at,session_id,
        (SELECT value FROM settings WHERE id='course_invite:'||orders.id) AS invitation
        FROM orders WHERE user_id=? OR (user_id LIKE 'guest/%' AND email=? AND status IN ('paid','requested','pending'))
        ORDER BY created_at DESC LIMIT 100`).bind(uid,email).all<DeskOrder>(),
    ]);
    courses=library.results;
    orders=history.results;
  } catch {failed=true;}
  return <StudentDesk name={user.displayName} email={user.email} courses={courses} orders={orders} failed={failed} staff={isOwner}/>;
}
