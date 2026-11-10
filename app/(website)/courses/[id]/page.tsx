import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft, LockKeyhole, Play} from 'lucide-react';
import CheckoutButton from '@/components/checkout-button';
import {courseImage} from '@/components/ui';
import QualificationForm from '@/components/qualification-form';
import {qualification} from '@/lib/qualifications';
import {isConversion,accredited,type Course} from '@/lib/data';
import {merchantStatus} from '@/lib/sumup';
import {hasCoursePrice} from '@/lib/payments';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {db,enrolled} from '@/lib/server';
import './course.css';

export const dynamic='force-dynamic';
type Lesson = {id:string;title:string;has_video:number;has_quiz:number;position:number};

export default async function Detail({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const database=db();
  const authConfigured=Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const [outline,account,merchant]=await Promise.all([
    database.batch([
      database.prepare("SELECT courses.*,(SELECT value FROM settings WHERE id='course-format:'||courses.id) AS format,(SELECT value FROM settings WHERE id='cpd:'||courses.id) AS cpd FROM courses WHERE id=?").bind(id),
      database.prepare("SELECT id,title,position,(video_key IS NOT NULL AND video_key<>'') AS has_video,(NULLIF(question,'') IS NOT NULL) AS has_quiz FROM lessons WHERE course_id=? ORDER BY position,id").bind(id),
    ],'read'),
    getChatGPTUser().then(user=>({user})).catch(()=>null),
    authConfigured?merchantStatus().catch(()=>null):null,
  ]);
  const course=outline[0].results[0] as Course|undefined;
  if(!course)notFound();
  const conversion=isConversion(course);
  // The public outline remains readable while account services recover.
  const viewer=await (async()=>{
    if(!account)return null;
    const {user}=account;
    const access=user?await enrolled(id):false;
    const proof=conversion&&user&&!access?await qualification(id,user.userId):null;
    return {user,access,proof};
  })().catch(()=>null);
  const access=viewer?.access===true, user=viewer?.user, proof=viewer?.proof;
  if(!course.published && !access)notFound();
  const lessons=outline[1].results as Lesson[];
  const priced=hasCoursePrice(course.price);
  const classroom=course.format!=='online';
  const paymentsOpen=Boolean(classroom && viewer && !access && priced && process.env.APP_ENCRYPTION_KEY && merchant?.code);
  const enquiry='/contact?course='+encodeURIComponent(course.title)+'#ask';
  const firstLesson=lessons[0];
  const learning=firstLesson?'/learn/'+encodeURIComponent(firstLesson.id):'/dashboard';

  const detail=<section className="studio-wrap practice-detail">
    <Link className="studio-text-link" href="/courses"><ArrowLeft size={16}/>All courses</Link>
    <header className="practice-heading"><span className="studio-kicker">{conversion?'Conversion · Qualified nail technicians only':course.level==='Beginner'?'Beginner friendly · No previous experience needed':course.level}{accredited(course)?' · CPD accredited':''}</span>
      <h1>{course.title}</h1><p><strong>{classroom?'In-person classroom training':'Online course · coming soon'}</strong></p><p>{course.description}</p>
    </header>
    <div className="practice-grid">
      <section className="practice-lessons" id="materials" aria-label="Course information">
        <img className="class-cover" src={courseImage(course)} width={960} height={560} alt="" />
        {classroom&&<><h2>Your classroom training</h2><p>Train in person with Carla. When your payment is confirmed, open your booking for available dates and joining instructions. Carla will confirm your chosen date with you.</p></>}
        {lessons.length>0&&<><div className="practice-list-head"><h2>{classroom?'Supporting materials':'Course outline'}</h2></div>
        <ol className="practice-list">{lessons.map((lesson,i)=><li key={lesson.id}><span className="practice-index">{String(i+1).padStart(2,'0')}</span><div>
          {access?<a href={'/learn/'+encodeURIComponent(lesson.id)}>{lesson.title}</a>:<strong>{lesson.title}</strong>}
          <small>{lesson.has_video?'Practice video':lesson.has_quiz?'Knowledge check':'Reading'}</small>
        </div>{access?<Play size={17}/>:<LockKeyhole size={16} aria-label="Locked"/>}</li>)}</ol></>}
      </section>
      <aside id="enrol" className="practice-enrol" aria-label="Student enrolment">
        <span className="studio-kicker">{classroom?'Classroom booking':'Student access'}</span>
        <h2>{access?'Your course':!classroom?'Coming soon':priced?'£'+(course.price!/100).toFixed(2):'Ask about this class'}</h2>
        {conversion&&!access&&<p>A nail qualification is required. The academy reviews your certificate before you can pay.</p>}
        {!viewer?<><p role="status">Your account access couldn’t be checked just now.</p><form method="get" action={'/courses/'+encodeURIComponent(id)+'#enrol'}><button className="underlink" type="submit">Check access again</button></form></>:
          access?<><a className="button" href="/dashboard?view=student">My bookings</a>{firstLesson&&<a className="underlink" href={learning}>Open supporting materials</a>}</>:
          !classroom?<p>Online courses are coming soon.</p>:
          conversion&&proof?.status!=='approved'?<>
            {user?(proof?.status==='pending'?<p role="status">Your qualification is awaiting review.</p>:<>{proof?.status==='resubmit'&&<p>Please submit a clearer copy of your qualification.</p>}<QualificationForm courseId={id}/></>):<a className="button" href={'/sign-in?redirect_url='+encodeURIComponent('/courses/'+id+'#enrol')}>Sign in to submit qualification</a>}
          </>:paymentsOpen?<><p>Pay your course fee securely by card through SumUp.</p>
            {user?<CheckoutButton courseId={id}/>:<a className="button" href={'/sign-in?redirect_url='+encodeURIComponent('/courses/'+id+'#enrol')}>Sign in to book</a>}</>:
          <><p>Contact Carla about booking this class while card booking is unavailable.</p><a className="underlink" href={enquiry}>Ask about this class</a></>}
          {classroom&&!access&&<p><a className="underlink" href={'/contact?topic=instalments&course='+encodeURIComponent(course.title)+'#ask'}>Ask about payment plans</a></p>}
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
