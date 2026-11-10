import { CTA } from '@/components/ui';
import Catalog from '@/components/catalog';
import './directory.css';
import { catalog } from '@/lib/server';
import { courseSummary, type Course } from '@/lib/data';

export const revalidate = 60;
export const metadata = { title: 'Nail training courses' };

export default async function Courses() {
  let courses:Course[]=[];
  let unavailable=false;
  try {
    const published = await catalog();
    courses = (published as Course[]).map(course=>({...course,description:courseSummary(course.description)}));
  } catch { unavailable=true; }
  return (
    <div className="collection-page">
      <header className="collection-intro">
        <div className="collection-heading">
          <span className="overline">Savannah Sky Academy</span>
          <h1>The course<br/><em>collection.</em></h1>
          <p>Start with the foundations or build on your qualification. Find your next nail course with Carla.</p>
          <a className="underlink" href="#course-directory">Browse the courses <span aria-hidden="true">↓</span></a>
        </div>
        <div className="collection-plate"><img src="/nail-botanical-960.webp"
          srcSet="/nail-botanical-480.webp 480w, /nail-botanical-960.webp 960w, /nail-botanical-1368.webp 1368w"
          sizes="(max-width:640px) 100vw, 46vw" width={960} height={960} alt="Fine botanical nail art from Savannah Sky Salon" fetchPriority="high"/></div>
      </header>
      <section id="course-directory" className="studio-wrap directory" aria-label="Browse courses">
        {unavailable?<div className="empty"><h2>The course list is temporarily unavailable.</h2><a className="underlink" href="/courses">Try again</a></div>:<Catalog courses={courses} />}
      </section>
      <CTA />
    </div>
  );
}
