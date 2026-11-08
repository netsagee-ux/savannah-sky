import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, LockKeyhole, Play } from 'lucide-react';
import CheckoutButton from '@/components/checkout-button';
import { courseImage } from '@/components/ui';
import { previews, type Course } from '@/lib/data';
import { academyWhatsApp } from '@/lib/course-orders';
import { hasCourseDelivery, hasCoursePrice } from '@/lib/payments';
import { db, enrolled } from '@/lib/server';

export const dynamic = 'force-dynamic';

type CourseDetail = Course & { course_url?: string | null };
type Lesson = { id: string; title: string; thumbnail_key: string | null };

export default async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let access = false;
  try { access = await enrolled(id); } catch { /* Public course information remains available. */ }
  let course: CourseDetail | undefined = previews.find(item => item.id === id);
  let lessons: Lesson[] = [];
  let checkoutReady = false;
  try {
    const published = await db().prepare('SELECT * FROM courses WHERE id=? AND (published=1 OR ?=1)').bind(id, access ? 1 : 0).first<CourseDetail>();
    if (published) {
      course = published;
      lessons = (await db().prepare('SELECT id,title,thumbnail_key FROM lessons WHERE course_id=? ORDER BY position,id').bind(id).all<Lesson>()).results;
      if (!access && published.published && hasCoursePrice(published.price)
          && process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
        checkoutReady = Boolean(await academyWhatsApp()) && await hasCourseDelivery(published);
      }
    }
  } catch { /* Offer an enquiry when a checkout dependency is unavailable. */ }
  if (!course) notFound();

  return <section className="studio-wrap course-spread">
    <a className="studio-text-link" href="/courses"><ArrowLeft size={16} />All courses</a>
    <div className="course-spread-grid">
      <header className="course-heading"><span className="studio-kicker">{course.level} · Online course</span>
        <h1>{course.title}</h1><p>{course.description}</p></header>
      <aside id="enrol" className="enrol-card" aria-label="Course enrolment">
        <span className="studio-kicker">{access ? 'Your course' : 'Enrolment'}</span>
        <h2>{access ? 'Ready to learn.' : course.price != null ? '£' + (course.price / 100).toFixed(2) : 'Course outline'}</h2>
        {course.duration && <p>{course.duration}</p>}
        <p>{access ? 'Open your training or return to your student dashboard.' : checkoutReady ? 'Start your order in WhatsApp. Your lessons unlock in this account after payment is verified.' : 'This outline is available to browse. Enrolment is currently closed.'}</p>
        {access ? <a className="button" href={lessons[0] ? '/learn/' + encodeURIComponent(lessons[0].id) : '/dashboard'}>Go to your learning</a>
          : checkoutReady ? <CheckoutButton courseId={id} /> : <a className="button" href={'/contact?course='+encodeURIComponent(course.title)+'#ask'}>Ask about availability <ArrowUpRight size={16} /></a>}
        {checkoutReady && <small><LockKeyhole size={13} /> Private student access</small>}
      </aside>
      <div className="course-syllabus">
        <img className="course-cover-img" src={courseImage(course)} width={960} height={560} alt="Nail work from Savannah Sky" />
        {course.outcomes && <div><h2>What you’ll learn</h2><ul>{course.outcomes.split('\n').filter(Boolean).map((line,i) => <li key={i}>{line}</li>)}</ul></div>}
        {course.requirements && <div><h2>Before you begin</h2><p>{course.requirements}</p></div>}
        {course.access_policy && <div><h2>Access &amp; support</h2><p>{course.access_policy}</p></div>}
        <div><h2>Lesson plan</h2>{lessons.length ? lessons.map((lesson,i) => {
          const content = <>{lesson.thumbnail_key && <img className="lesson-thumbnail" src={'/api/thumbnail/' + lesson.id} alt="" loading="lazy" width={96} height={54} />}
            <span>{i+1}</span><strong>{lesson.title}</strong>{access ? <Play size={16} /> : <LockKeyhole size={16} />}</>;
          return access ? <a className="lesson-row" key={lesson.id} href={'/learn/' + lesson.id}>{content}</a> : <div className="lesson-row" key={lesson.id}>{content}</div>;
        }) : <p>Lesson details will appear here when published.</p>}</div>
      </div>
    </div>
  </section>;
}
