import { SignIn } from '@clerk/nextjs';
import AuthFrame from '@/components/auth-frame';
import './entry.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Student sign-in' };

export default function Page() {
  return <AuthFrame>
    {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
      ? <SignIn withSignUp routing="path" path="/sign-in" fallbackRedirectUrl="/dashboard"
          fallback={<p role="status" className="entry-loading">Loading secure sign-in…</p>}
          appearance={{
            variables: {
              colorPrimary: '#512634',
              colorForeground: '#39292c',
              colorMutedForeground: '#685853',
              fontFamily: 'Bricolage Grotesque, Arial, sans-serif',
              borderRadius: '0.6rem',
            },
            elements: {
              rootBox: 'entry-widget',
              cardBox: 'entry-widget-box',
              card: 'entry-widget-card',
              header: 'entry-widget-header',
              headerTitle: 'entry-widget-title',
              headerSubtitle: 'entry-widget-subtitle',
              formFieldInput: 'entry-widget-input',
              formButtonPrimary: 'entry-widget-continue',
              footer: 'entry-widget-footer',
            },
          }} />
      : <div className="notice" role="status"><h1>Student sign-in is unavailable.</h1><p>Please try again later.</p></div>}
  </AuthFrame>;
}
