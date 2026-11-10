import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import Brand from './brand';
import AcademyWordmark from './academy-wordmark';
import { academyPages } from './academy-navigation';
import MobileMenu from './mobile-menu';

export function Header() {
  return <header className="academy-mast">
    <div className="mast-row">
      <nav className="mast-nav" aria-label="Academy navigation">
        {academyPages.slice(0, 3).map(page => <Link href={page.href} key={page.href}>{page.label}</Link>)}
      </nav>
      <Link className="mast-brand" href="/" aria-label="Savannah Sky Training Academy home"><AcademyWordmark /></Link>
      <div className="mast-actions">
        <nav className="mast-nav" aria-label="Help and contact">
          {academyPages.slice(3).map(page => <Link href={page.href} key={page.href}>{page.label}</Link>)}
        </nav>
        <a className="mast-account" href="/dashboard">
          My account <ArrowUpRight size={15} aria-hidden="true" />
        </a>
        <MobileMenu />
      </div>
    </div>
  </header>;
}

export function Footer() {
  return (
    <footer className="academy-footer">
      <div className="studio-wrap">
        <div className="footer-directory">
          <div className="footer-identity">
            <Link href="/" className="studio-brand" aria-label="Savannah Sky Training Academy home"><Brand /></Link>
            <p>Where nail techs come to grow, not just to learn.</p>
          </div>
          <div><h2>The academy</h2>{academyPages.map(({href, label}) => <Link href={href} key={href}>{label}</Link>)}</div>
          <div><h2>Students</h2><a href="/dashboard">My learning</a><a href="/shop/orders">My shop orders</a></div>
          <div><h2>Follow the salon</h2>
            <a href="https://www.instagram.com/savannahskysalon/" target="_blank" rel="noopener noreferrer">Instagram <ArrowUpRight size={14} /></a>
            <a href="https://www.facebook.com/Savannahskyaromas/" target="_blank" rel="noopener noreferrer">Facebook <ArrowUpRight size={14} /></a>
          </div>
        </div>
        <div className="footer-small"><span>© {new Date().getFullYear()} Savannah Sky Training Academy</span></div>
      </div>
    </footer>
  );
}
