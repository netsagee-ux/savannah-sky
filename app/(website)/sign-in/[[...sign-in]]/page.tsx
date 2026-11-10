import { SignIn } from '@clerk/nextjs';
import {redirect} from 'next/navigation';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isOwnerEmail} from '@/lib/server';
import {accountLanding,accountContinue} from '@/lib/account-navigation';
import AuthFrame from '@/components/auth-frame';
import './entry.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your account' };

export default async function Page({searchParams,params}:{
  searchParams:Promise<{redirect_url?:string}>;params:Promise<{'sign-in'?:string[]}>
}) {
  const [{redirect_url:requested},segments,user]=await Promise.all([searchParams,params,getChatGPTUser()]);
  if(user)redirect(accountLanding(await isOwnerEmail(user.email),requested));
  const after=accountContinue(requested);
  // New attempts keep the return address through every step. Existing path-based attempts can finish.
  const routing=segments['sign-in']?.length?{routing:'path' as const,path:'/sign-in'}:{routing:'hash' as const};
  return <AuthFrame>
    {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
      ? <SignIn withSignUp {...routing} forceRedirectUrl={after} signUpForceRedirectUrl={after}
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
      : <div className="notice" role="status"><h1>Sign-in is unavailable.</h1><p>Please try again later.</p></div>}
  </AuthFrame>;
}
