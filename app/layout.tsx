import type { Metadata, Viewport } from 'next';
import './globals.css';
import './refinement.css';
import './brand.css';

export const viewport: Viewport = { themeColor: '#fffaf5' };

export const metadata: Metadata = {
  title: { default: 'Savannah Sky | Nail Education', template: '%s | Savannah Sky' },
  description: 'Explore in-person nail courses with Carla at Savannah Sky Training Academy. Online courses are coming soon.',
  icons: { icon: '/favicon.svg' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <a href="#main" className="skip">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
