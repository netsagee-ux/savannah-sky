import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import './refinement.css';
import './brand.css';

export const viewport: Viewport = { themeColor: '#fffaf5' };

export const metadata: Metadata = {
  title: { default: 'Savannah Sky | Nail Education', template: '%s | Savannah Sky' },
  description: 'Where nail techs come to grow, not just to learn. Discover online nail courses and meet Carla, the founder of Savannah Sky Training Academy.',
  icons: { icon: '/favicon.svg' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <a href="#main" className="skip">Skip to content</a>
        {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
          ? <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up" localization={{
              signIn: { start: {
                titleCombined: 'Student sign-in',
                subtitleCombined: 'Use your email to open your courses and orders.',
              } },
            }}>{children}</ClerkProvider>
          : children}
      </body>
    </html>
  );
}
