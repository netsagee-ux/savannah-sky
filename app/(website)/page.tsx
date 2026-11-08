import { ArrowRight, ArrowUpRight, Plus } from 'lucide-react';
import { NailTool, Petal, type ToolName } from '@/components/academy-icons';
import BrandGallery from '@/components/brand-gallery';
import { MotionControl } from '@/components/motion';
import Reviews from '@/components/reviews';
import StudentStory from '@/components/student-story';
import { CourseRow } from '@/components/ui';
import { previews, type Course } from '@/lib/data';
import { catalog } from '@/lib/server';
import './atelier-home.css';

export const dynamic = 'force-dynamic';

const techniques: { name: string; tool: ToolName }[] = [
  { name: 'Gel polish', tool: 'polish' }, { name: 'Builder gel', tool: 'builder' },
  { name: 'Fine-line art', tool: 'liner' }, { name: 'French tips', tool: 'swatches' },
];

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
      <section className="atelier-cover" aria-labelledby="cover-title">
        <div className="atelier-stage">
          <div className="atelier-heading">
            <span className="studio-kicker"><span />Savannah Sky Training Academy</span>
            <h1 id="cover-title">Nail artistry,<br /><em>up close.</em></h1>
            <p>Online nail training with Carla. From your first gel set to the fine lines that make it yours.</p>
            <div className="atelier-actions">
              <a className="studio-button" href="/courses">Explore courses <ArrowUpRight size={18} /></a>
              <a className="meet-link" href="/about"><img src="/academy-portrait-480.webp" width={36} height={36} alt="" />Meet Carla</a>
            </div>
          </div>
          <BrandGallery />
          <Petal className="cover-flower" />
        </div>
      </section>

      <div className="technique-band">
        <div className="technique-window" aria-label="Techniques taught at the academy">
          <div className="technique-track">{[0, 1, 2, 3].map(copy =>
            <ul className="technique-repeat" key={copy} aria-hidden={copy !== 0 || undefined}>
              {techniques.map(item => <li key={item.name}><NailTool name={item.tool} size={26} />{item.name}</li>)}
            </ul>
          )}</div>
        </div>
        <MotionControl />
      </div>

      <section id="collection" className="studio-wrap syllabus">
        <div className="syllabus-intro"><span className="studio-kicker"><span />Online courses</span>
          <h2>Choose your<br /><em>technique.</em></h2>
          <a className="studio-text-link" href="/courses">All courses <ArrowRight size={17} /></a>
        </div>
        <div className="syllabus-list">{courses.slice(0, 3).map((course, index) => <CourseRow course={course} index={index} key={course.id} />)}</div>
      </section>

      <section className="carla-studio" aria-labelledby="carla-title">
        <div className="studio-wrap carla-layout">
          <div className="carla-pictures">
            <img className="educator-photo" src="/academy-portrait-960.webp"
              srcSet="/academy-portrait-480.webp 480w, /academy-portrait-960.webp 960w"
              sizes="(max-width: 750px) 80vw, 39vw" width={960} height={1440} loading="lazy" alt="Carla at her own nail desk in Savannah Sky Salon" />
            <figure className="salon-snapshot"><img src="/salon-lounge-480.webp" alt="The pink lounge and illuminated mirror at the salon" width={480} height={640} loading="lazy" /><figcaption>Savannah Sky Salon</figcaption></figure>
          </div>
          <div className="carla-note"><span className="studio-kicker"><span />Meet your educator</span>
            <h2 id="carla-title">At the table<br /><em>with Carla.</em></h2>
            <p>I left school without a single GCSE. Today I own a salon and teach the craft I love. I want you to feel you can pull up a chair, ask a question and try again.</p>
            <a className="studio-button light-button" href="/about">Read my story <ArrowUpRight size={18} /></a>
          </div>
        </div>
      </section>

      <StudentStory />
      <Reviews />

      <section className="studio-wrap home-questions">
        <div><span className="studio-kicker"><span />Student support</span><h2>Before you<br /><em>begin.</em></h2>
          <a className="studio-text-link" href="/faq">All course FAQs <ArrowRight size={17} /></a></div>
        <div className="question-list">{questions.map(([question, answer]) =>
          <details key={question}><summary>{question}<Plus size={18} /></summary><p>{answer}</p></details>
        )}</div>
      </section>
    </>
  );
}
