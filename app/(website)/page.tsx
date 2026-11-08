import { ArrowRight, ArrowUpRight, Plus } from 'lucide-react';
import BrandGallery from '@/components/brand-gallery';
import Reviews from '@/components/reviews';
import StudentStory from '@/components/student-story';
import { CourseCard } from '@/components/ui';
import { previews, type Course } from '@/lib/data';
import { catalog } from '@/lib/server';

export const dynamic = 'force-dynamic';

const questions = [
  ['Which course should I start with?', 'If you’re new to nails, look for a beginner course and check the equipment list. If you already work with gel, use the course outline to find the next technique you’d like to practise.'],
  ['Where do I find my lessons?', 'Once your enrolment is confirmed, sign in to My learning to find your lessons and saved progress. You can return on your phone, tablet or computer.'],
  ['Can I ask a question after training?', 'Carla wants students to feel comfortable asking questions as they practise. Each course page sets out the support included. You can also contact the academy.'],
];

export default async function Home() {
  let courses: Course[] = previews;
  try {
    const published = await catalog();
    if (published.length) courses = published as Course[];
  } catch { /* The programme previews are available while the catalogue is offline. */ }

  return (
    <>
      <section className="studio-cover" aria-labelledby="cover-title">
        <div className="cover-inner">
          <div className="cover-message">
            <span className="overline cover-label">Savannah Sky Training Academy</span>
            <h1 id="cover-title">Where nail techs<br />come to grow,<br /><em>not just to learn.</em></h1>
            <p>Online nail training with Carla. Pull up a chair, ask questions and build your confidence, one set at a time.</p>
            <div className="cover-actions">
              <a className="studio-button cream" href="/courses">Explore courses <ArrowRight size={17} /></a>
              <a className="cover-link" href="/about">Meet Carla <ArrowUpRight size={15} /></a>
            </div>
          </div>
          <BrandGallery />
        </div>
      </section>

      <section id="collection" className="studio-wrap course-collection">
        <div className="section-topline"><div><span className="overline">Online courses</span><h2>At the nail desk.</h2></div>
          <a className="studio-text-link" href="/courses">View all courses <ArrowRight size={17} /></a>
        </div>
        <div className="course-grid">{courses.slice(0, 3).map((course, index) => <CourseCard course={course} index={index} key={course.id} />)}</div>
      </section>

      <section className="founder-feature">
        <div className="studio-wrap founder-layout">
          <img className="founder-photo" src="/academy-portrait-960.webp"
            srcSet="/academy-portrait-480.webp 480w, /academy-portrait-960.webp 960w"
            sizes="(max-width: 720px) 90vw, 40vw" width={960} height={1440} loading="lazy" alt="Carla at her desk in the Savannah Sky salon" />
          <div className="founder-words"><span className="overline">Meet your educator</span>
            <h2>A seat at<br /><em>Carla’s table.</em></h2>
            <p>I left school without a single GCSE. Today I own a salon and I’m building the academy around the kind of support that helped me find my confidence.</p>
            <p>There’s room here to ask a question, get a technique wrong and try again. I want you to feel you can come back to me as you grow.</p>
            <a className="studio-text-link" href="/about">Read my story <ArrowRight size={17} /></a>
          </div>
        </div>
      </section>

      <StudentStory />
      <Reviews />

      <section className="studio-wrap home-questions">
        <div><span className="overline">Before you begin</span><h2>Your questions,<br /><em>answered.</em></h2>
          <a className="studio-text-link" href="/faq">All course FAQs <ArrowRight size={17} /></a></div>
        <div className="question-list">{questions.map(([question, answer]) =>
          <details key={question}><summary>{question}<Plus size={18} /></summary><p>{answer}</p></details>
        )}</div>
      </section>
    </>
  );
}
