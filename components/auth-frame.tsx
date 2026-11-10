import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';

export default function AuthFrame({children}: {children: ReactNode}) {
  return <div className="student-entry">
    <div className="entry-spread">
      <section className="entry-form" aria-label="Your account">{children}</section>
      <a className="entry-courses" href="/courses">
        <picture>
          <source media="(max-width: 760px)" srcSet="/nail-floral-480.webp" />
          <img src="/nail-floral-960.webp" alt="" width={960} height={960} />
        </picture>
        <span className="entry-courses-caption">Explore the courses <ArrowUpRight size={19} aria-hidden="true" /></span>
      </a>
    </div>
  </div>;
}
