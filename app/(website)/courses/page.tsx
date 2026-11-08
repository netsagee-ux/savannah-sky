import { Intro, CTA } from '@/components/ui';
import Catalog from '@/components/catalog';
import { catalog } from '@/lib/server';
import { previews, type Course } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nail training courses' };

export default async function Courses() {
  let courses = previews;
  try {
    const published = await catalog();
    if (published.length) courses = published as Course[];
  } catch { /* Show the academy's editorial previews when the catalogue is unavailable. */ }
  return (
    <>
      <Intro kicker="Course directory" title="Nail training courses."
        text="From your first gel application to the finishing touches on a set. Explore each course, its level and the techniques you’ll practise."
        image={{ src: '/nail-floral-960.webp', alt: 'A close look at a handmade floral set by Savannah Sky' }} />
      <section className="studio-wrap directory" aria-label="Browse courses">
        <Catalog courses={courses} />
        {courses[0]?.preview && <p className="catalog-notice">These programmes are available to preview. Enrolment and pricing will be confirmed when each course opens.</p>}
      </section>
      <CTA />
    </>
  );
}
