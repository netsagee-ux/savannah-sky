'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { CourseCard } from './ui';
import type { Course } from '@/lib/data';

export default function Catalog({ courses }: { courses: Course[] }) {
  const [level, setLevel] = useState('All courses');
  const [query, setQuery] = useState('');
  const levels = ['All courses', ...new Set(courses.map(course => course.level).filter(Boolean))];
  const filtered = courses.filter(course => (level === 'All courses' || course.level === level)
    && (course.title + ' ' + course.description).toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <div className="catalog-tools">
        <div className="level-options" role="group" aria-label="Filter courses by level">
          {levels.map(option => <button key={option} aria-pressed={level === option} onClick={() => setLevel(option)}>{option}</button>)}
        </div>
        <label className="catalog-search"><Search size={17} /><input type="search" aria-label="Search courses" placeholder="Search courses" value={query} onChange={event => setQuery(event.target.value)} /></label>
      </div>
      <span className="sr-only" role="status">{filtered.length} {filtered.length === 1 ? 'course' : 'courses'} shown</span>
      <div className="course-grid">{filtered.map(course => <CourseCard key={course.id} course={course} index={courses.indexOf(course)} />)}</div>
      {!filtered.length && <div className="empty"><h2>No matching courses.</h2><button className="studio-button" onClick={() => { setQuery(''); setLevel('All courses'); }}>Show all courses</button></div>}
    </>
  );
}
