import Link from 'next/link';
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
  ['Are the courses online or in person?', 'All current courses are taught in person with Carla. Online courses are coming soon. You can check your booking and any supporting materials on your phone.'],
  ['When do I choose a class date?', 'After payment, open your booking for date options and joining instructions. Carla will confirm your place on the date you agree together.'],
  ['Is my course CPD accredited?', 'Look for the CPD accreditation details on the course page. You can also view your completion record in My learning once you finish your lessons and knowledge checks.'],
];

const enrolment = [
  { icon: BookOpen, title: 'Find your level', text: 'Open a course to see its entry requirements, kit list and what you’ll cover in class.' },
  { icon: CreditCard, title: 'Book your training', text: 'When enrolment is open, sign in with your student email and pay securely by card through SumUp.' },
  { icon: Play, title: 'Arrange your date', text: 'Open your paid booking for class dates, then confirm your preferred date with Carla.' },
];

async function courseEntries(): Promise<CourseEntry[]> {
  try {
    const rows = await catalog() as Course[];
    return rows.map(course => ({
      id: course.id, title: course.title,
      level: isConversion(course) ? 'Conversion' : course.level || 'Classroom course',
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
          <span className="folio-label">In-person nail training with Carla</span>
          <h1 id="home-title">The art of<br /><em>doing nails.</em></h1>
          <p>Join Carla at the salon for hands-on nail training. Online courses are coming soon.</p>
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
        <Link className="folio-link" href="/courses">All courses <ArrowUpRight size={16} aria-hidden="true" /></Link>
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
        <Link className="folio-link" href="/about">Carla’s story <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </div>
    </section>

    <StudentStory />

    <section className="folio-wrap folio-section" aria-labelledby="lessons-title">
      <div className="folio-heading"><div><span className="folio-label">In the classroom</span><h2 id="lessons-title">Booking your <em>place.</em></h2></div></div>
      <ol className="lesson-path">{enrolment.map(({ icon: Icon, title, text }) => <li key={title}>
        <Icon aria-hidden="true" size={24} strokeWidth={1.45} /><h3>{title}</h3><p>{text}</p>
      </li>)}</ol>
    </section>

    <section className="home-shop" aria-labelledby="shop-title"><div className="folio-wrap shop-spread">
      <div><span className="folio-label">The academy shop</span><h2 id="shop-title">At your <em>nail desk.</em></h2>
        <p>Check your course kit list first, then visit the shop for student kits and nail supplies.</p>
        <Link className="folio-button" href="/shop">Visit the shop <ArrowUpRight size={17} aria-hidden="true" /></Link></div>
      <img src="/salon-colour-swatches-960.webp" srcSet="/salon-colour-swatches-480.webp 480w, /salon-colour-swatches-960.webp 960w" sizes="(max-width: 720px) 90vw, (max-width: 1580px) 42vw, 650px" width={960} height={1023} loading="lazy" alt="Fans of warm-toned polish swatches at Savannah Sky Salon" />
    </div></section>

    <Reviews />

    <section className="folio-wrap folio-section course-questions" aria-labelledby="questions-title">
      <div><span className="folio-label">Before you enrol</span><h2 id="questions-title">Good to <em>know.</em></h2>
        <Link className="folio-link" href="/faq">All course FAQs <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
      <div>{questions.map(([q, a]) => <details key={q}><summary>{q}<Plus size={18} aria-hidden="true" /></summary><p>{a}</p></details>)}</div>
    </section>

    <section className="student-door" aria-labelledby="student-title"><div className="folio-wrap">
      <div><span className="folio-label">Student workspace</span><h2 id="student-title">Already <em>booked?</em></h2></div>
      <a className="folio-button" href="/dashboard">My bookings <ArrowRight size={17} aria-hidden="true" /></a>
    </div></section>
  </div>;
}
