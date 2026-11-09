import { Intro, CTA } from '@/components/ui';
import Catalog from '@/components/catalog';
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
    <>
      <Intro kicker="Course directory" title="Nail training courses."
        text="Explore CPD-accredited nail training. Start from scratch with our beginner courses or build on your existing qualification with a conversion course."
        image={{ src: '/nail-floral-960.webp', alt: 'A close look at a handmade floral set by Savannah Sky' }} />
      <section className="studio-wrap directory" aria-label="Browse courses">
        {unavailable?<div className="empty"><h2>The course list is temporarily unavailable.</h2><a className="underlink" href="/courses">Try again</a></div>:<Catalog courses={courses} />}
      </section>
      <CTA />
    </>
  );
}
