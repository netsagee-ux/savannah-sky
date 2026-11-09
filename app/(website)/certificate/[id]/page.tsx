import {notFound} from 'next/navigation';
import {requireChatGPTUser} from '@/app/chatgpt-auth';
import {db,enrolled} from '@/lib/server';
import Print from '@/components/print-button';

export const dynamic='force-dynamic';

export default async function Certificate({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const user=await requireChatGPTUser('/certificate/'+encodeURIComponent(id));
  if(!await enrolled(id))return <section className="section empty">
    <h2>This completion record is private.</h2><a className="button" href="/dashboard">My learning</a>
  </section>;

  const database=db();
  const [course,lessons]=await Promise.all([
    database.prepare('SELECT title FROM courses WHERE id=?').bind(id).first<{title:string}>(),
    database.prepare(`SELECT l.id,p.completed_at FROM lessons l
      LEFT JOIN progress p ON p.lesson_id=l.id AND p.user_id=? WHERE l.course_id=? ORDER BY l.position,l.id`)
      .bind(user.userId,id).all<{id:string;completed_at:string|null}>(),
  ]);
  if(!course)notFound();
  const total=lessons.results.length;
  const completed=lessons.results.flatMap(lesson=>lesson.completed_at?[lesson.completed_at]:[]);
  const next=lessons.results.find(lesson=>!lesson.completed_at);
  if(!total || next)return <section className="section empty">
    <h2>A little more learning to go.</h2><p>{completed.length} of {total} lessons complete. Complete all lessons and knowledge checks to unlock your record.</p>
    <a className="button" href={next?'/learn/'+encodeURIComponent(next.id):'/dashboard'}>{next?'Continue learning':'My learning'}</a>
  </section>;

  const date=new Date(completed.sort().at(-1)!).toLocaleDateString('en-GB');
  return <div className="certificate"><span className="brand">savannah sky<span>NAIL EDUCATION</span></span><hr/>
    <span className="eyebrow">CELEBRATING YOUR PROGRESS</span><h1>Certificate of completion</h1>
    <p>This confirms that</p><p className="name">{user.fullName||user.email}</p>
    <p>has completed the published lessons and knowledge checks for</p><h2>{course.title}</h2>
    <p>Completed {date}</p><p className="quiet">This record covers the online lessons. Your course details explain any practical assessments required for your academy certificate.</p>
    <Print/>
  </div>;
}
