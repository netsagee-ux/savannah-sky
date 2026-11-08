import {notFound} from 'next/navigation';
import {ArrowLeft, LockKeyhole, Play} from 'lucide-react';
import CheckoutButton from '@/components/checkout-button';
import {courseImage} from '@/components/ui';
import type {Course} from '@/lib/data';
import {academyWhatsApp} from '@/lib/course-orders';
import {hasCourseDelivery,hasCoursePrice} from '@/lib/payments';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {db,enrolled} from '@/lib/server';
import './course.css';

export const dynamic='force-dynamic';
type Lesson = {id:string;title:string;has_video:number;position:number};

export default async function Detail({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const access=await enrolled(id);
  const database=db();
  const course=await database.prepare('SELECT * FROM courses WHERE id=? AND (published=1 OR ?=1)')
    .bind(id,access?1:0).first<Course>();
  if(!course)notFound();
  const lessons=(await database.prepare("SELECT id,title,position,(video_key IS NOT NULL AND video_key<>'') AS has_video FROM lessons WHERE course_id=? ORDER BY position,id").bind(id).all<Lesson>()).results;
  const firstVideo=lessons.find(lesson=>lesson.has_video);
  const videos=lessons.filter(lesson=>lesson.has_video).length;
  const priced=hasCoursePrice(course.price);
  const user=await getChatGPTUser();
  const ready=!access && Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) && await hasCourseDelivery(course);
  const callback=ready&&!await academyWhatsApp();
  const learning=firstVideo?'/learn/'+encodeURIComponent(firstVideo.id):'/dashboard';

  return <section className="studio-wrap practice-detail">
    <a className="studio-text-link" href="/courses"><ArrowLeft size={16}/>All courses</a>
    <header className="practice-heading"><span className="studio-kicker">{course.level} · Online course</span>
      <h1>{course.title}</h1><p>{course.description}</p>
    </header>
    <div className="practice-grid">
      <section className="practice-lessons" aria-label="Course lessons">
        {firstVideo && <a className="practice-film" href={access?learning:'#enrol'} aria-label={access?'Watch '+firstVideo.title:'Enrol to watch '+firstVideo.title}>
          <img src={courseImage(course)} width={960} height={560} alt="" />
          <div className="practice-film-caption"><span className="practice-indicator">{access?<Play size={17}/>:<LockKeyhole size={17}/>}</span><div>
            <small>{access?'Watch lesson':'Private video lesson'}</small><strong>{firstVideo.title}</strong></div></div>
        </a>}
        <div className="practice-list-head"><h2>Course lessons</h2><span>{videos} {videos===1?'video':'videos'}</span></div>
        <ol className="practice-list">{lessons.map((lesson,i)=><li key={lesson.id}><span className="practice-index">{String(i+1).padStart(2,'0')}</span><div>
          {access?<a href={'/learn/'+encodeURIComponent(lesson.id)}>{lesson.title}</a>:<strong>{lesson.title}</strong>}
          <small>{lesson.has_video?'Video lesson':'Reading'}{lesson.id==='studio-'+id?' · Illustrated practice':''}</small>
        </div>{access?<Play size={17}/>:<LockKeyhole size={16} aria-label="Locked"/>}</li>)}</ol>
        {!lessons.length&&<p>The academy is preparing the first lesson.</p>}
      </section>
      <aside id="enrol" className="practice-enrol" aria-label="Student enrolment">
        <span className="studio-kicker">Student access</span>
        <h2>{access?'Your course':priced?'£'+(course.price!/100).toFixed(2):'Join this course'}</h2>
        {access?<a className="button" href={learning}>Open my lessons <Play size={16}/></a>:ready?<>
          <p>{callback?'Leave your WhatsApp number to receive payment details.':priced?'Arrange payment with the academy on WhatsApp.':'Open WhatsApp for the course fee and payment details.'} Your lessons unlock after payment is confirmed.</p>
          <CheckoutButton courseId={id} guest={!user} callback={callback}/>
        </>:<p>Course ordering is temporarily unavailable. Please check back shortly.</p>}
      </aside>
      {(course.outcomes||course.requirements||course.access_policy||course.duration)&&<section className="practice-notes">
        {course.outcomes&&<><h2>What you’ll learn</h2><ul>{course.outcomes.split('\n').filter(Boolean).map((line,i)=><li key={i}>{line}</li>)}</ul></>}
        {course.requirements&&<><h2>Before you begin</h2><p>{course.requirements}</p></>}
        {course.duration&&<p>{course.duration}</p>}
        {course.access_policy&&<><h2>Access &amp; support</h2><p>{course.access_policy}</p></>}
      </section>}
    </div>
  </section>;
}
