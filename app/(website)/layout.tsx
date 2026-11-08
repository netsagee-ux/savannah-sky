import { MotionProvider } from '@/components/motion';
import { Footer, Header } from '@/components/shell';
import './academy.css';

export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <MotionProvider>
      <div className="academy">
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </div>
    </MotionProvider>
  );
}
