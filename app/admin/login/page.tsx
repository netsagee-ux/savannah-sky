import {SignIn} from '@clerk/nextjs';
import {redirect} from 'next/navigation';
import {admin,db} from '@/lib/server';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {staffDestination} from '@/lib/staff-navigation';
import StaffRequest from '@/components/staff-request';
import './staff-entry.css';

export const dynamic='force-dynamic';
export const metadata={title:'Staff sign-in'};

export default async function AdminLogin({searchParams}:{searchParams:Promise<{next?:string}>}){
  const next=staffDestination((await searchParams).next);
  if(await admin())redirect(next);
  const user=await getChatGPTUser();
  const pending=user && await db().prepare('SELECT id FROM settings WHERE id=? AND value=?')
    .bind('staff-request:'+user.userId,user.email).first().catch(()=>null);
  return <div className="staff-entry">
    <section className="staff-entry-panel" aria-label="Educator access">
      {user?<div className="staff-entry-state">
        <h1>{pending?'Request received':'Educator access'}</h1>
        <p>Signed in as <strong>{user.email}</strong>.</p>
        {pending?<><p>Your request is waiting for the academy owner’s approval.</p>
          <a className="button" href={'/admin/login?next='+encodeURIComponent(next)}>Check access</a></>:
          <><p>Request staff access to manage courses and upload lessons.</p><StaffRequest/></>}
        <a className="underlink" href={'/sign-out?staff=1&next='+encodeURIComponent(next)}>Use another email</a>
      </div>:process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?
        <SignIn withSignUp routing="hash" forceRedirectUrl={next} signUpForceRedirectUrl={next}
          fallback={<div className="staff-entry-state"><h1>Staff sign-in</h1><p role="status">Loading secure sign-in…</p></div>}
          appearance={{
            variables:{colorPrimary:'#642a40',colorForeground:'#37292b',colorMutedForeground:'#675651',
              fontFamily:'Bricolage Grotesque, Arial, sans-serif',fontSize:'1rem',borderRadius:'.65rem'},
            elements:{rootBox:'staff-auth-root',cardBox:'staff-auth-box',card:'staff-auth-card',header:'staff-auth-header',
              headerTitle:'staff-auth-title',headerSubtitle:'staff-auth-subtitle',formFieldInput:'staff-auth-input',
              formButtonPrimary:'staff-auth-submit',footer:'staff-auth-footer'}
          }}/>:
        <div className="staff-entry-state"><h1>Staff sign-in</h1><p role="status">Staff sign-in is temporarily unavailable. Please try again later.</p></div>}
    </section>
    <picture className="staff-entry-photo">
      <img src="/salon-pink-glaze-480.webp" srcSet="/salon-pink-glaze-480.webp 480w, /salon-pink-glaze-960.webp 960w"
        sizes="(max-width: 760px) 100vw, 45vw" width={480} height={640} alt="A close-up of a soft pink manicure with fine shimmer at Savannah Sky Salon" />
    </picture>
  </div>;
}
