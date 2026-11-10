import {notFound} from 'next/navigation';
import {ArrowLeft, LockKeyhole, Play} from 'lucide-react';
import CheckoutButton from '@/components/checkout-button';
import {courseImage} from '@/components/ui';
import QualificationForm from '@/components/qualification-form';
import {qualification} from '@/lib/qualifications';
import {isConversion,accredited,type Course} from '@/lib/data';
import {merchantStatus} from '@/lib/sumup';
import {hasCourseDelivery,hasCoursePrice} from '@/lib/payments';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {db,enrolled} from '@/lib/server';
import './course.css';

export const dynamic='force-dynamic';
type Lesson = {id:string;title:string;has_video:number;has_quiz:number;position:number};

export default async function Detail({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const database=db();
  const [course,lessonRows]=await Promise.all([
    database.prepare("SELECT courses.*,(SELECT value FROM settings WHERE id='cpd:'||courses.id) AS cpd FROM courses WHERE id=?").bind(id).first<Course>(),
    database.prepare("SELECT id,title,position,(video_key IS NOT NULL AND video_key<>'') AS has_video,(NULLIF(question,'') IS NOT NULL) AS has_quiz FROM lessons WHERE course_id=? ORDER BY position,id").bind(id).all<Lesson>(),
  ]);
  if(!course)notFound();
  const conversion=isConversion(course);
  // The public outline remains readable while account services recover.
  const viewer=await (async()=>{
    const user=await getChatGPTUser();
    const access=user?await enrolled(id):false;
    const proof=conversion&&user&&!access?await qualification(id,user.userId):null;
    return {user,access,proof};
  })().catch(()=>null);
  const access=viewer?.access===true, user=viewer?.user, proof=viewer?.proof;
  if(!course.published && !access)notFound();
  const lessons=lessonRows.results;
  const firstVideo=lessons.find(lesson=>lesson.has_video);
  const videos=lessons.filter(lesson=>lesson.has_video).length;
  const priced=hasCoursePrice(course.price);
  const merchant=viewer && !access && priced && lessons.length>0 && process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    ? await merchantStatus().catch(()=>null) : null;
  const paymentsOpen=Boolean(merchant?.code) && await hasCourseDelivery(course).catch(()=>false);
  const enquiry='/contact?course='+encodeURIComponent(course.title)+'#ask';
  const firstLesson=lessons[0];
  const learning=firstLesson?'/learn/'+encodeURIComponent(firstLesson.id):'/dashboard';

  const detail=<section className="studio-wrap practice-detail">
    <a className="studio-text-link" href="/courses"><ArrowLeft size={16}/>All courses</a>
    <header className="practice-heading"><span className="studio-kicker">{conversion?'Conversion · Qualified nail technicians only':course.level==='Beginner'?'Beginner friendly · No previous experience needed':course.level}{accredited(course)?' · CPD accredited':''}</span>
      <h1>{course.title}</h1><p>{course.description}</p>
    </header>
    <div className="practice-grid">
      <section className="practice-lessons" aria-label="Course lessons">
        {firstVideo && <a className="practice-film" href={access?'/learn/'+encodeURIComponent(firstVideo.id):'#enrol'} aria-label={access?'Watch '+firstVideo.title:'Enrol to watch '+firstVideo.title}>
          <img src={courseImage(course)} width={960} height={560} alt="" />
          <div className="practice-film-caption"><span className="practice-indicator">{access?<Play size={17}/>:<LockKeyhole size={17}/>}</span><div>
            <small>{access?'Watch lesson':'Private video lesson'}</small><strong>{firstVideo.title}</strong></div></div>
        </a>}
        <div className="practice-list-head"><h2>Course lessons</h2><span>{videos} {videos===1?'video':'videos'}</span></div>
        <ol className="practice-list">{lessons.map((lesson,i)=><li key={lesson.id}><span className="practice-index">{String(i+1).padStart(2,'0')}</span><div>
          {access?<a href={'/learn/'+encodeURIComponent(lesson.id)}>{lesson.title}</a>:<strong>{lesson.title}</strong>}
          <small>{lesson.has_video?'Video lesson':lesson.has_quiz?'Knowledge check':'Reading'}{lesson.id==='studio-'+id?' · Illustrated practice':''}</small>
        </div>{access?<Play size={17}/>:<LockKeyhole size={16} aria-label="Locked"/>}</li>)}</ol>
        {!lessons.length&&<p>The academy is preparing the first lesson.</p>}
      </section>
      <aside id="enrol" className="practice-enrol" aria-label="Student enrolment">
        <span className="studio-kicker">Student access</span>
        <h2>{access?'Your course':priced?'£'+(course.price!/100).toFixed(2):'Join this course'}</h2>
        {conversion&&!access&&<p>A nail qualification is required. The academy reviews your certificate before you can pay.</p>}
        {!viewer?<><p role="status">Your account access couldn’t be checked just now. Please try again to open your lessons.</p><form method="get" action={'/courses/'+encodeURIComponent(id)+'#enrol'}><button className="underlink" type="submit">Check access again</button></form></>:access?<a className="button" href={learning}>Open my lessons <Play size={16}/></a>:conversion&&proof?.status!=='approved'?<>
          {user?(proof?.status==='pending'?<p role="status">Your qualification is awaiting review.</p>:<>{proof?.status==='resubmit'&&<p>Please submit a clearer copy of your qualification.</p>}<QualificationForm courseId={id}/></>):<a className="button" href={'/sign-in?redirect_url='+encodeURIComponent('/courses/'+id+'#enrol')}>Sign in to submit qualification</a>}
          {!paymentsOpen&&<p>Online enrolment opens soon.</p>}
        </>:paymentsOpen?<>
          <p>Pay securely by card with SumUp. Your lessons open in your student account as soon as payment is confirmed.</p>
          {user?<CheckoutButton courseId={id}/>:<a className="button" href={'/sign-in?redirect_url='+encodeURIComponent('/courses/'+id+'#enrol')}>Sign in to enrol</a>}
        </>:<><p>{!lessons.length?'Online lessons are in preparation.':merchant && !merchant.code?'Card enrolment will open once the academy connects SumUp.':'Online enrolment opens soon.'}</p><a className="underlink" href={enquiry}>Ask the academy about this course</a></>}

      </aside>
      {(course.outcomes||course.requirements||course.access_policy||course.duration)&&<section className="practice-notes">
        {course.outcomes&&<><h2>What you’ll learn</h2><ul>{course.outcomes.split('\n').map(line=>line.trim()).filter(Boolean).map((line,i)=><li key={i}>{line}</li>)}</ul></>}
        {course.requirements&&<><h2>Before you begin</h2><p>{course.requirements}</p></>}
        {course.duration&&<p>{course.duration}</p>}
        {course.access_policy&&<><h2>Access &amp; support</h2><p>{course.access_policy}</p></>}
      </section>}
    </div>
  </section>;
  return detail;
}
