import { ArrowDownRight, ArrowRight, ArrowUpRight, BookOpen, CreditCard, Play, Plus } from 'lucide-react';
import CourseEdit, { type CourseEntry } from '@/components/home-course-edit';
import HomeSalonPhotos from '@/components/home-salon-photos';
import NailStudy from '@/components/nail-study';
import Reviews from '@/components/reviews';
import StudentStory from '@/components/student-story';
import { courseFee, isConversion, type Course } from '@/lib/data';
import { catalog } from '@/lib/server';
import './atelier-home.css';

export const revalidate = 60;

const questions = [
  ['Do I need a qualification to start?', 'Our beginner courses are open to complete beginners. Conversion courses are for nail technicians who already hold a relevant qualification. You’ll find the entry requirements on each course page.'],
  ['Can I watch the lessons on my phone?', 'Yes. Sign in to My learning on your phone, tablet or laptop. You’ll need an internet connection to stream your lessons.'],
  ['How long can I access my course?', 'The access period and support available depend on the course. Read the course details before enrolling, or get in touch with Carla.'],
  ['Is my course CPD accredited?', 'Look for the CPD accreditation details on the course page. You can also view your completion record in My learning once you finish your lessons and knowledge checks.'],
];

const enrolment = [
  { icon: BookOpen, title: 'Find your level', text: 'Open a course to see its entry requirements, kit list and lesson plan.' },
  { icon: CreditCard, title: 'Enrol online', text: 'When enrolment is open, sign in with your student email and pay securely by card through SumUp.' },
  { icon: Play, title: 'Start practising', text: 'Once payment is confirmed, your lessons are ready in My learning. Come back to the same account to carry on.' },
];

async function courseEntries(): Promise<CourseEntry[]> {
  try {
    const rows = await catalog() as Course[];
    return rows.map(course => ({
      id: course.id, title: course.title,
      level: isConversion(course) ? 'Conversion' : course.level || 'Online course',
      fee: course.price != null ? courseFee(course.price) : null,
    }));
  } catch {
    return [];
  }
}

export default async function Home() {
  const courses = await courseEntries();
  return <div className="salon-home">
    <section className="cover" aria-labelledby="home-title">
      <div className="cover-layout">
        <div className="cover-copy">
          <span className="folio-label">Online nail training with Carla</span>
          <h1 id="home-title">The art of<br /><em>doing nails.</em></h1>
          <p>Pull up a chair. Learn the shape, the finish and the little details that make a set your own.</p>
          <a className="folio-button" href="#collection">Discover the courses <ArrowRight size={18} aria-hidden="true" /></a>
        </div>
        <HomeSalonPhotos />
      </div>
    </section>

    <nav className="home-index" aria-label="Explore the homepage"><div>
      <a href="#collection">Courses <ArrowDownRight size={14} aria-hidden="true" /></a>
      <a href="#salon-work">Portfolio <ArrowDownRight size={14} aria-hidden="true" /></a>
      <a href="#educator">Meet Carla <ArrowDownRight size={14} aria-hidden="true" /></a>
    </div></nav>

    <section className="folio-wrap folio-section" id="collection" aria-labelledby="course-edit-title">
      <div className="folio-heading">
        <div><span className="folio-label">The curriculum</span><h2 id="course-edit-title">Find your <em>course.</em></h2></div>
        <a className="folio-link" href="/courses">All courses <ArrowUpRight size={16} aria-hidden="true" /></a>
      </div>
      <CourseEdit courses={courses} />
    </section>

    <NailStudy />

    <section className="folio-wrap founder folio-section" id="educator" aria-labelledby="founder-title">
      <figure className="founder-photo">
        <img src="/academy-graduation-960.webp" srcSet="/academy-graduation-480.webp 480w, /academy-graduation-960.webp 960w" sizes="(max-width: 720px) 90vw, (max-width: 1580px) 40vw, 620px" width={960} height={1598} loading="lazy" alt="Carla and a student celebrating her certificate at Savannah Sky" />
        <figcaption>Graduation day at Savannah Sky</figcaption>
      </figure>
      <div className="founder-copy"><span className="folio-label">Meet your educator</span><h2 id="founder-title">A seat at<br /><em>Carla’s table.</em></h2>
        <p>Carla left school without a GCSE. Today she runs her own salon and teaches the craft that changed her life.</p>
        <p>She built Savannah Sky for anyone who wants a place to ask questions, make mistakes and grow in confidence. There’s room for you here.</p>
        <a className="folio-link" href="/about">Carla’s story <ArrowUpRight size={16} aria-hidden="true" /></a>
      </div>
    </section>

    <StudentStory />

    <section className="folio-wrap folio-section" aria-labelledby="lessons-title">
      <div className="folio-heading"><div><span className="folio-label">Learning online</span><h2 id="lessons-title">Your first <em>lesson.</em></h2></div></div>
      <ol className="lesson-path">{enrolment.map(({ icon: Icon, title, text }) => <li key={title}>
        <Icon aria-hidden="true" size={24} strokeWidth={1.45} /><h3>{title}</h3><p>{text}</p>
      </li>)}</ol>
    </section>

    <section className="home-shop" aria-labelledby="shop-title"><div className="folio-wrap shop-spread">
      <div><span className="folio-label">The academy shop</span><h2 id="shop-title">At your <em>nail desk.</em></h2>
        <p>Check your course kit list first, then visit the shop for student kits and nail supplies.</p>
        <a className="folio-button" href="/shop">Visit the shop <ArrowUpRight size={17} aria-hidden="true" /></a></div>
      <img src="/salon-colour-swatches-960.webp" srcSet="/salon-colour-swatches-480.webp 480w, /salon-colour-swatches-960.webp 960w" sizes="(max-width: 720px) 90vw, (max-width: 1580px) 42vw, 650px" width={960} height={1023} loading="lazy" alt="Fans of warm-toned polish swatches at Savannah Sky Salon" />
    </div></section>

    <Reviews />

    <section className="folio-wrap folio-section course-questions" aria-labelledby="questions-title">
      <div><span className="folio-label">Before you enrol</span><h2 id="questions-title">Good to <em>know.</em></h2>
        <a className="folio-link" href="/faq">All course FAQs <ArrowUpRight size={16} aria-hidden="true" /></a></div>
      <div>{questions.map(([q, a]) => <details key={q}><summary>{q}<Plus size={18} aria-hidden="true" /></summary><p>{a}</p></details>)}</div>
    </section>

    <section className="student-door" aria-labelledby="student-title"><div className="folio-wrap">
      <div><span className="folio-label">Student workspace</span><h2 id="student-title">Back for your <em>next lesson?</em></h2></div>
      <a className="folio-button" href="/dashboard">My learning <ArrowRight size={17} aria-hidden="true" /></a>
    </div></section>
  </div>;
}
