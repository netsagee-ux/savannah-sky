import { ArrowRight, BookOpen, Lightbulb, Play } from 'lucide-react';
import { isConversion,accredited,type Course } from '@/lib/data';
import { NailTool, type ToolName } from './academy-icons';

type IntroProps = { kicker: string; title: string; text?: string; image?: { src: string; alt: string } };

export function Intro({ kicker, title, text, image }: IntroProps) {
  return (
    <section className={'intro-band' + (image ? ' has-image' : '')}>
      <div className="studio-wrap intro-inner">
        <div><span className="overline">{kicker}</span><h1>{title}</h1>{text && <p>{text}</p>}</div>
        {image && <img src={image.src} alt={image.alt} width={780} height={510} />}
      </div>
    </section>
  );
}

const previewLooks: Record<string, string> = {
  'gel-foundations': 'sculpted', 'builder-gel': 'botanical', 'nail-art': 'floral',
};

export function courseImage(course: Course, index = 0, size = 960) {
  if (course.thumbnail_key) return '/api/course-thumbnail/' + course.id;
  if (course.thumbnail_id) return '/api/thumbnail/' + course.thumbnail_id;
  const look = previewLooks[course.id] ?? ['sculpted', 'botanical', 'floral'][index % 3];
  return '/nail-' + look + '-' + size + '.webp';
}

const courseTools: Record<string, ToolName> = {
  'gel-foundations': 'polish', 'builder-gel': 'builder', 'nail-art': 'liner',
};

export function CourseCard({ course, index = 0 }: { course: Course; index?: number }) {
  const hasThumbnail = Boolean(course.thumbnail_key || course.thumbnail_id);
  const image = courseImage(course,index,480);
  return (
    <a className="programme" href={'/courses/' + course.id}>
      <div className="programme-image">
        <img src={image} style={image.startsWith('/nail-botanical-') ? {objectPosition: '50% 50%'} : undefined}
          srcSet={hasThumbnail ? undefined : courseImage(course, index, 480) + ' 480w, ' + courseImage(course, index, 960) + ' 960w'}
          sizes="(max-width: 720px) 90vw, 30vw" width={480} height={440} loading="lazy" alt="" />
        <span className="programme-level"><NailTool name={courseTools[course.id] ?? 'swatches'} size={16} />{isConversion(course)?'Qualified technicians only':course.level==='Beginner'?'Beginner friendly':course.level}{accredited(course)?' · CPD accredited':''}</span>
      </div>
      <div className="programme-copy">
        <h3>{course.title}</h3>
        <p>{course.description}</p>
        <div className="programme-foot">
          <span>{course.preview ? 'Course preview' : course.price != null ? '£' + (course.price / 100).toFixed(2) : 'View lessons'}</span>
          <span className="programme-open" aria-hidden="true"><ArrowRight size={17} /></span>
        </div>
      </div>
    </a>
  );
}

const benefits = [
  { Icon: Play, title: 'Practise without pressure', text: 'Revisit a technique and give yourself time to get comfortable with it.' },
  { Icon: BookOpen, title: 'See your progress', text: 'Your learning dashboard keeps your lessons and progress together.' },
  { Icon: Lightbulb, title: 'Choose your next step', text: 'Check the level, equipment and support on each course page before you begin.' },
];

export function Benefits() {
  return <div className="benefits">{benefits.map(({ Icon, title, text }) =>
    <div key={title}><Icon size={25} strokeWidth={1.4} /><h3>{title}</h3><p>{text}</p></div>
  )}</div>;
}

export function CTA() {
  return (
    <section className="studio-invitation"><div className="studio-wrap">
      <div><span className="overline">Student support</span><h2>Talk to the academy.</h2></div>
      <a className="studio-button cream" href="/contact">Get in touch <ArrowRight size={17} /></a>
    </div></section>
  );
}
