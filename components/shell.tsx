import { ArrowUpRight } from 'lucide-react';
import Brand from './brand';
import { NailTool } from './academy-icons';
import MobileMenu from './mobile-menu';

const pages = [
  ['/courses', 'Courses'], ['/about', 'Meet Carla'], ['/faq', 'FAQs'], ['/contact', 'Contact'],
];

export function Header() {
  return (
    <header className="academy-header">
      <div className="header-inner">
        <a href="/" className="studio-brand" aria-label="Savannah Sky Training Academy home"><Brand /></a>
        <nav className="studio-nav" aria-label="Main navigation">
          {pages.map(([href, label]) => <a href={href} key={href}>{label}</a>)}
        </nav>
        <div className="studio-tools">
          <a className="student-link" href="/dashboard"><NailTool name="swatches" size={20} /> My learning</a>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="academy-footer">
      <div className="studio-wrap">
        <div className="footer-directory">
          <div className="footer-identity">
            <a href="/" className="studio-brand" aria-label="Savannah Sky Training Academy home"><Brand /></a>
            <p>Where nail techs come to grow, not just to learn.</p>
          </div>
          <div><h2>The academy</h2>{pages.map(([href, label]) => <a href={href} key={href}>{label}</a>)}</div>
          <div><h2>Students</h2><a href="/dashboard">My learning</a><a href="/sign-in">Sign in</a><a href="/sign-up">Create account</a></div>
          <div><h2>Follow the salon</h2>
            <a href="https://www.instagram.com/savannahskyaromasandbeauty/" target="_blank" rel="noopener noreferrer">Instagram <ArrowUpRight size={14} /></a>
            <a href="https://www.facebook.com/Savannahskyaromas/" target="_blank" rel="noopener noreferrer">Facebook <ArrowUpRight size={14} /></a>
          </div>
        </div>
        <div className="footer-small"><span>© {new Date().getFullYear()} Savannah Sky Training Academy</span></div>
      </div>
    </footer>
  );
}
