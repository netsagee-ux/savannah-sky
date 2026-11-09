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
    courses = published as Course[];
  } catch { /* Show the academy's editorial previews when the catalogue is unavailable. */ }
  return (
    <>
      <Intro kicker="Course directory" title="Nail training courses."
        text="Explore CPD-accredited nail training. Start from scratch with our beginner courses or build on your existing qualification with a conversion course."
        image={{ src: '/nail-floral-960.webp', alt: 'A close look at a handmade floral set by Savannah Sky' }} />
      <section className="studio-wrap directory" aria-label="Browse courses">
        <Catalog courses={courses} />
      </section>
      <CTA />
    </>
  );
}
