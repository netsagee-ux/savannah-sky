'use client';

import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

export type CourseEntry = { id: string; title: string; level: string; fee: string | null };

// All editorial covers come from the salon's own portfolio.
const covers = ['salon-mint-tips', 'nail-botanical', 'nail-red', 'nail-floral', 'salon-pink-glaze', 'nail-sculpted'];
function coverFor(title: string, index: number) {
  if (/art\b/i.test(title)) return 'nail-floral';
  if (/builder/i.test(title)) return 'nail-botanical';
  if (/acrylic/i.test(title)) return 'nail-red';
  if (/gel polish/i.test(title)) return 'salon-mint-tips';
  return covers[index % covers.length];
}

export default function CourseEdit({ courses }: { courses: CourseEntry[] }) {
  const [level, setLevel] = useState('');
  if (!courses.length) return <p className="course-note">Visit the <a href="/courses">course directory</a> for the latest courses and enrolment details.</p>;
  const levels = [...new Set(courses.map(course => course.level))];
  const filtered = courses.filter(course => !level || course.level === level);
  const selected = level ? filtered : filtered.slice(0, 3);
  return <>
    <div className="edit-tools">
      <div className="edit-filters" role="group" aria-label="Choose a course level">
        {['', ...levels].map(item => <button key={item} type="button" aria-pressed={item === level}
          onClick={() => setLevel(item)}>{item || 'Featured'}</button>)}
      </div>
      {level === 'Conversion' && <p>For already qualified nail technicians.</p>}
      {level === 'Beginner' && <p>No previous nail qualification needed.</p>}
    </div>
    <span className="sr-only" role="status">{selected.length} {level.toLowerCase() || 'featured'} courses shown</span>
    <div className="edit-cards">{selected.map(course => {
      const cover = coverFor(course.title, courses.indexOf(course));
      const [small, large] = cover === 'salon-mint-tips' ? [640, 1200] : [480, 960];
      return <a key={course.id} className="edit-card" href={'/courses/' + encodeURIComponent(course.id)}>
        <div className="card-photo"><img src={'/' + cover + '-' + small + '.webp'}
          srcSet={'/' + cover + '-' + small + '.webp ' + small + 'w, /' + cover + '-' + large + '.webp ' + large + 'w'}
          sizes="(max-width: 620px) 28vw, 31vw" width={480} height={410} loading="lazy" alt="" /></div>
        <div className="card-info"><div className="card-meta"><span>{course.level}</span>{course.fee && <span>{course.fee}</span>}</div>
          <h3>{course.title}</h3></div><ArrowUpRight className="card-arrow" size={18} aria-hidden="true" />
      </a>;
    })}</div>
  </>;
}
