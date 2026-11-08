import { Footer, Header } from '@/components/shell';
import './academy.css';

export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return <div className="academy">
    <Header />
    <main id="main">{children}</main>
    <Footer />
  </div>;
}
