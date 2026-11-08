import { ArrowRight, ArrowUpRight, BookOpen, Check, MonitorPlay, NotebookPen, Plus, UserRound } from 'lucide-react';
import { NailTool, type ToolName } from '@/components/academy-icons';
import BrandGallery from '@/components/brand-gallery';
import Catalog from '@/components/catalog';
import NailStudy from '@/components/nail-study';
import Reviews from '@/components/reviews';
import StudentStory from '@/components/student-story';
import { previews, type Course } from '@/lib/data';
import { catalog } from '@/lib/server';
import './atelier-home.css';

export const dynamic = 'force-dynamic';

const techniques: { name: string; tool: ToolName }[] = [
  { name: 'Gel polish', tool: 'polish' }, { name: 'Builder gel', tool: 'builder' },
  { name: 'Fine-line art', tool: 'liner' }, { name: 'French tips', tool: 'swatches' },
];

const questions = [
  ['Can I learn on my phone?', 'Yes. Open My learning on your phone, tablet or computer. You’ll need an internet connection to stream lessons.'],
  ['How long will I have access?', 'Access and support vary by course. Check the course details or ask Carla before you enrol.'],
  ['Will I receive a certificate?', 'Finishing all published lessons and knowledge checks gives you a completion record. Ask the academy about accreditation or insurance eligibility for the specific course.'],
];

export default async function Home() {
  let courses: Course[] = previews;
  try {
    const published = await catalog();
    if (published.length) courses = published as Course[];
  } catch { /* Keep the editorial catalogue available during an outage. */ }

  return (
    <>
      <section className="atelier-cover" aria-labelledby="cover-title">
        <div className="atelier-stage">
          <div className="atelier-heading">
            <span className="studio-kicker">Savannah Sky Training Academy</span>
            <h1 id="cover-title">Nail artistry,<br /><em>up close.</em></h1>
            <p>Online nail courses with Carla, from your first gel set to the finishing details.</p>
            <div className="atelier-actions">
              <a className="studio-button" href="#collection">Explore courses <ArrowRight size={17} /></a>
              <a className="meet-link" href="#educator">Meet Carla <ArrowUpRight size={15} /></a>
            </div>
          </div>
          <BrandGallery />
        </div>
        <div className="technique-band"><div className="technique-window" aria-label="Nail techniques">
          <div className="technique-track">{[0, 1, 2, 3].map(copy =>
            <ul className="technique-repeat" key={copy} aria-hidden={copy !== 0 || undefined}>
              {techniques.map(item => <li key={item.name}><NailTool name={item.tool} size={24} />{item.name}</li>)}
            </ul>
          )}</div>
        </div></div>
      </section>

      <section id="collection" className="studio-wrap atelier-collection home-space" aria-labelledby="collection-title">
        <div className="edit-head"><div><span className="studio-kicker">Online training</span><h2 id="collection-title">The course <em>collection.</em></h2></div>
          <a className="studio-text-link" href="/courses">All courses <ArrowRight size={16} /></a></div>
        <Catalog courses={courses} featured />
      </section>

      <NailStudy />

      <section id="educator" className="carla-studio" aria-labelledby="carla-title">
        <div className="studio-wrap carla-layout">
          <div className="carla-pictures">
            <img className="educator-photo" src="/academy-portrait-960.webp" srcSet="/academy-portrait-480.webp 480w, /academy-portrait-960.webp 960w"
              sizes="(max-width: 750px) 90vw, 43vw" width={960} height={1440} loading="lazy" alt="Carla at her teaching desk at Savannah Sky Salon" />
          </div>
          <div className="carla-note"><span className="studio-kicker">Meet your educator</span><h2 id="carla-title">At the table<br /><em>with Carla.</em></h2>
            <p>I left school without a single GCSE. Today I own a salon and teach the craft I love. I want you to feel you can pull up a chair, ask a question and try again.</p>
            <a className="studio-button light-button" href="/about">Read my story <ArrowUpRight size={17} /></a>
          </div>
        </div>
      </section>

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
          <li><UserRound /><h3>Sign in and pay</h3><p>For an open course, use your student account and pay securely with Stripe.</p></li>
          <li><MonitorPlay /><h3>Open your lessons</h3><p>Once payment is confirmed, your course appears in My learning.</p></li>
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
        <div><span className="studio-kicker">Course advice</span><h2 id="support-title">Which course <em>fits you?</em></h2><p>Tell Carla what you’ve tried and what you’d like to learn next.</p>
          <a className="studio-button" href="/contact">Ask Carla <ArrowUpRight size={17} /></a></div>
      </div></section>
    </>
  );
}
