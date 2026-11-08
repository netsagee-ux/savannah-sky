import { ArrowRight, ArrowUpRight, Plus } from 'lucide-react';
import BrandGallery from '@/components/brand-gallery';
import { MotionControl } from '@/components/motion';
import Reviews from '@/components/reviews';
import StudentStory from '@/components/student-story';
import { CourseCard } from '@/components/ui';
import { previews, type Course } from '@/lib/data';
import { catalog } from '@/lib/server';
import './studio-home.css';

export const dynamic = 'force-dynamic';

const questions = [
  ['Where should I start?', 'If this is your first set, look for a beginner course. If you already work with gel, check the course outline for the technique you want to practise next.'],
  ['How do I find my lessons?', 'Once your enrolment is confirmed, sign in to My learning. Your lessons and saved progress are there on your phone, tablet or computer.'],
  ['Can I ask Carla a question?', 'Yes. Contact the academy if you’re unsure about a course or the equipment you’ll need. Each course page explains the support included.'],
];

export default async function Home() {
  let courses: Course[] = previews;
  try {
    const published = await catalog();
    if (published.length) courses = published as Course[];
  } catch { /* Keep course previews available when the catalogue is offline. */ }

  return (
    <>
      <section className="campaign" aria-labelledby="cover-title">
        <div className="campaign-scene">
          <img className="campaign-portrait" src="/academy-portrait-960.webp"
            srcSet="/academy-portrait-480.webp 480w, /academy-portrait-960.webp 960w, /academy-portrait-1440.webp 1440w"
            sizes="(max-width: 700px) 100vw, 65vw" width={1024} height={1536} fetchPriority="high"
            alt="Carla at her nail desk in Savannah Sky Salon" />
        </div>
        <div className="studio-wrap campaign-inner">
          <div className="campaign-copy">
            <span className="studio-kicker">Savannah Sky Training Academy</span>
            <h1 id="cover-title">Nail education,<br /><em>with Carla.</em></h1>
            <p>Where nail techs come to grow, not just to learn.</p>
            <div className="campaign-actions">
              <a className="studio-button" href="/courses">Explore courses <ArrowRight size={17} /></a>
              <a className="campaign-link" href="/contact">Ask about training <ArrowUpRight size={15} /></a>
            </div>
          </div>
        </div>
        <div className="campaign-motion"><MotionControl /></div>
      </section>

      <section id="collection" className="studio-wrap home-collection" aria-labelledby="collection-title">
        <div className="collection-heading">
          <div><span className="studio-kicker">Learn at your own pace</span><h2 id="collection-title">The courses<span>.</span></h2></div>
          <a className="studio-text-link" href="/courses">View all courses <ArrowRight size={17} /></a>
        </div>
        <div className="course-grid">{courses.slice(0, 3).map((course, index) => <CourseCard course={course} index={index} key={course.id} />)}</div>
      </section>

      <section className="studio-story" aria-labelledby="carla-title">
        <div className="studio-wrap story-grid">
          <img src="/salon-lounge-960.webp" srcSet="/salon-lounge-480.webp 480w, /salon-lounge-960.webp 960w"
            sizes="(max-width: 700px) 90vw, 43vw" width={960} height={1280} loading="lazy" alt="Blush armchairs beside the illuminated arch mirror at Savannah Sky Salon" />
          <div className="story-copy"><span className="studio-kicker">From Carla, your educator</span>
            <h2 id="carla-title">“What you did yesterday will be your past, but it does not <em>define you.</em>”</h2>
            <p>I left school without a single GCSE. Today I own a salon and teach the craft I love. There’s a seat at my table for you, wherever you’re starting from.</p>
            <a className="studio-text-link" href="/about">Meet Carla <ArrowRight size={17} /></a>
          </div>
        </div>
      </section>

      <BrandGallery />
      <StudentStory />
      <Reviews />

      <section className="studio-wrap home-questions">
        <div><span className="studio-kicker">Student support</span><h2>Before you <em>begin.</em></h2>
          <a className="studio-text-link" href="/faq">All course FAQs <ArrowRight size={17} /></a></div>
        <div className="question-list">{questions.map(([question, answer]) =>
          <details key={question}><summary>{question}<Plus size={18} /></summary><p>{answer}</p></details>
        )}</div>
      </section>
    </>
  );
}
