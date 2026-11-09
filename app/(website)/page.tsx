import { ArrowRight, ArrowUpRight, BookOpen, Check, MonitorPlay, NotebookPen, Plus, UserRound } from 'lucide-react';
import { NailTool, type ToolName } from '@/components/academy-icons';
import { courseImage } from '@/components/ui';
import NailStudy from '@/components/nail-study';
import Reviews from '@/components/reviews';
import StudentStory from '@/components/student-story';
import { previews, type Course } from '@/lib/data';
import { catalog } from '@/lib/server';
import './atelier-home.css';
import './silk-home.css';

export const dynamic = 'force-dynamic';

const techniques: { name: string; tool: ToolName }[] = [
  { name: 'Gel polish', tool: 'polish' }, { name: 'Builder gel', tool: 'builder' },
  { name: 'Fine-line art', tool: 'liner' }, { name: 'French tips', tool: 'swatches' },
];

const questions = [
  ['Can I learn on my phone?', 'Yes. Open My learning on your phone, tablet or computer. You’ll need an internet connection to stream lessons.'],
  ['How long will I have access?', 'Access and support vary by course. Check the course details or ask Carla before you enrol.'],
  ['Will I receive a certificate?', 'Finishing all published lessons and knowledge checks gives you a completion record. CPD accreditation is listed on each accredited course page.'],
];

export default async function Home() {
  let courses: Course[] = previews;
  try {
    const published = await catalog();
    courses = published as Course[];
  } catch { /* Keep the editorial catalogue available during an outage. */ }

  return (
    <>
      <section className="silk-hero" aria-labelledby="silk-title">
        <picture className="silk-photo">
          <source media="(max-width: 760px)" srcSet="/silk-manicure-mobile.webp" />
          <img src="/silk-manicure-wide.webp" srcSet="/silk-manicure-medium.webp 1050w, /silk-manicure-wide.webp 1774w"
            sizes="100vw" width={1774} height={887} fetchPriority="high" alt="Sheer blush French manicure with a fine gold accent on ivory silk" />
        </picture>
        <div className="silk-layout"><div className="silk-copy">
          <span className="silk-kicker">Online nail training</span>
          <h1 id="silk-title">Nail artistry,<br /><em>step by step.</em></h1>
          <p>Join Carla at the nail desk. Learn gel polish, shaping and hand-painted details at your own pace.</p>
          <a className="silk-button" href="#collection">Explore courses <ArrowRight size={18} aria-hidden="true" /></a>
        </div></div>
      </section>

      <div className="technique-band"><div className="technique-window" aria-label="Nail techniques">
          <div className="technique-track">{[0, 1, 2, 3].map(copy =>
            <ul className="technique-repeat" key={copy} aria-hidden={copy !== 0 || undefined}>
              {techniques.map(item => <li key={item.name}><NailTool name={item.tool} size={24} />{item.name}</li>)}
            </ul>
          )}</div>
        </div></div>

      <section id="collection" className="course-edit studio-wrap" aria-labelledby="collection-title">
        <div className="course-edit-heading"><h2 id="collection-title">The course <em>collection.</em></h2>
          <a className="studio-text-link" href="/courses">All courses <ArrowUpRight size={16} aria-hidden="true" /></a>
        </div>
        <div className="course-edit-list">{courses.slice(0, 3).map((course, index) =>
          <a className="course-edit-piece" key={course.id} href={'/courses/' + encodeURIComponent(course.id)}>
            <div className="course-edit-photo"><img src={courseImage(course,index,480)}
              srcSet={course.thumbnail_key || course.thumbnail_id ? undefined : courseImage(course,index,480)+' 480w, '+courseImage(course,index,960)+' 960w'}
              sizes="(max-width: 650px) 26vw, 30vw" width={480} height={480} loading="lazy" alt=""
              style={course.id === 'builder-gel' ? {objectPosition: '50% 76%'} : undefined} /></div>
            <div className="course-edit-info"><span>{course.level}</span><h3>{course.title}</h3></div>
            <span className="course-edit-arrow" aria-hidden="true"><ArrowUpRight size={19}/></span>
          </a>
        )}</div>
      </section>

      <section id="educator" className="carla-studio" aria-labelledby="carla-title">
        <div className="studio-wrap carla-layout">
          <div className="carla-pictures">
            <img className="educator-photo" src="/academy-portrait-960.webp" srcSet="/academy-portrait-480.webp 480w, /academy-portrait-960.webp 960w"
              sizes="(max-width: 750px) 90vw, 43vw" width={960} height={1440} loading="lazy" alt="Carla at her teaching desk at Savannah Sky Salon" />
            <img className="studio-glimpse" src="/salon-lounge-480.webp" width={480} height={640} loading="lazy" alt="A corner of Savannah Sky Salon" />
          </div>
          <div className="carla-note"><span className="studio-kicker">Meet your educator</span><h2 id="carla-title">At the table<br /><em>with Carla.</em></h2>
            <p>I left school without a single GCSE. Today I own a salon and teach the craft I love. I want you to feel you can pull up a chair, ask a question and try again.</p>
            <a className="studio-button light-button" href="/about">Read my story <ArrowUpRight size={17} /></a>
          </div>
        </div>
      </section>

      <NailStudy />

      <section className="studio-wrap kit-section home-space" aria-labelledby="kit-title">
        <div><span className="studio-kicker">Before your first class</span><h2 id="kit-title">Set up your <em>desk.</em></h2><p>A little preparation gives you room to concentrate on the technique.</p></div>
        <div className="kit-list">
          <p><Check aria-hidden="true" /><span><strong>Check your kit list</strong>Read the equipment and experience requirements on your chosen course before buying supplies.</span></p>
          <p><Check aria-hidden="true" /><span><strong>Give yourself a clear view</strong>Set your screen beside your practice space so you can pause a close-up and try it yourself.</span></p>
          <p><Check aria-hidden="true" /><span><strong>Keep your questions nearby</strong>Make a note of anything you want to ask Carla as you practise.</span></p>
        </div>
      </section>

      <StudentStory />
      <Reviews />

      <section className="studio-wrap enrol-guide home-space" aria-labelledby="enrol-title">
        <div className="edit-head"><div><span className="studio-kicker">Enrolment</span><h2 id="enrol-title">From course to <em>first lesson.</em></h2></div></div>
        <ol className="enrol-steps">
          <li><BookOpen /><h3>Choose a course</h3><p>Check the level, price and lesson plan.</p></li>
          <li><UserRound /><h3>Pay by card</h3><p>Sign in with your student email and pay securely with SumUp.</p></li>
          <li><MonitorPlay /><h3>Open your lessons</h3><p>Once payment is confirmed, open your course in My learning.</p></li>
        </ol>
      </section>

      <section className="returning-students" aria-labelledby="returning-title"><div className="studio-wrap returning-inner">
        <NotebookPen size={32} strokeWidth={1.4} /><div><h2 id="returning-title">Already a student?</h2><p>Pick up your next lesson or find your purchase history.</p></div>
        <a className="studio-text-link" href="/dashboard">My learning <ArrowUpRight size={16} /></a>
      </div></section>

      <section className="studio-wrap home-questions home-space" aria-labelledby="questions-title">
        <div><h2 id="questions-title">Course <em>questions.</em></h2><a className="studio-text-link" href="/faq">Read all FAQs <ArrowRight size={16} /></a></div>
        <div className="question-list">{questions.map(([question, answer]) =>
          <details key={question}><summary>{question}<Plus size={17} /></summary><p>{answer}</p></details>
        )}</div>
      </section>

      <section className="home-contact" aria-labelledby="support-title"><div className="studio-wrap home-contact-inner">
        <img src="/salon-reception-480.webp" alt="Reception at Savannah Sky Salon" width={480} height={640} loading="lazy" />
        <div><span className="studio-kicker">Course advice</span><h2 id="support-title">Which course <em>fits you?</em></h2><p>Compare course levels, techniques and lesson plans.</p>
          <a className="studio-button" href="/courses">Find my course <ArrowUpRight size={17} /></a></div>
      </div></section>
    </>
  );
}
