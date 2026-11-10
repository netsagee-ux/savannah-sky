import {SignIn,SignUp} from '@clerk/nextjs';
import {redirect} from 'next/navigation';
import {db,staffAccessFor} from '@/lib/server';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {staffDestination} from '@/lib/staff-navigation';
import StaffRequest from '@/components/staff-request';

const appearance={
  variables:{colorPrimary:'#642a40',colorForeground:'#37292b',colorMutedForeground:'#675651',
    fontFamily:'Bricolage Grotesque, Arial, sans-serif',fontSize:'1rem',borderRadius:'.65rem'},
  elements:{rootBox:'staff-auth-root',cardBox:'staff-auth-box',card:'staff-auth-card',header:'staff-auth-header',
    headerTitle:'staff-auth-title',headerSubtitle:'staff-auth-subtitle',formFieldInput:'staff-auth-input',
    formButtonPrimary:'staff-auth-submit',footer:'staff-auth-footer'},
};

export default async function StaffEntry({next,activate=false}:{next?:string;activate?:boolean}){
  const destination=staffDestination(next);
  const query='?next='+encodeURIComponent(destination);
  const login='/admin/login'+query, setup='/admin/login/activate'+query;
  const configured=Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const user=await getChatGPTUser().catch(()=>undefined);
  const allowed=user?await staffAccessFor(user).catch(()=>undefined):false;
  if(allowed)redirect(destination);
  const pending=user && allowed===false?await db().prepare('SELECT id FROM settings WHERE id=? AND value=?')
    .bind('staff-request:'+user.userId,user.email).first().catch(()=>undefined):null;
  const fallback=<div className="staff-entry-state"><h1>{activate?'Set up staff sign-in':'Staff sign-in'}</h1><p role="status">Loading secure sign-in…</p></div>;
  let content;
  if(!configured || user===undefined || allowed===undefined || pending===undefined){
    content=<div className="staff-entry-state"><h1>Staff sign-in</h1><p role="status">We couldn’t check workspace access just now. Please try again.</p><a className="button" href={activate?setup:login}>Try again</a></div>;
  } else if(user){
    content=<div className="staff-entry-state">
      <h1>{pending?'Request received':'Educator access'}</h1>
      <p>Signed in as <strong>{user.email}</strong>.</p>
      {pending?<><p>Your request is waiting for the academy owner’s approval.</p><a className="button" href={login}>Check access</a></>:
        <><p>Request staff access to manage courses and upload lessons.</p><StaffRequest/></>}
      <a className="underlink" href={'/sign-out?staff=1&next='+encodeURIComponent(destination)}>Use another email</a>
    </div>;
  } else if(activate){
    content=<SignUp routing="hash" signInUrl={login} forceRedirectUrl={destination} signInForceRedirectUrl={destination}
      fallback={fallback} appearance={appearance}/>;
  } else {
    content=<><SignIn withSignUp routing="hash" signUpUrl={setup} forceRedirectUrl={destination} signUpForceRedirectUrl={destination}
      fallback={fallback} appearance={appearance}/>
      <p className="staff-setup-link">First time here? <a className="underlink" href={setup}>Set up staff sign-in</a></p></>;
  }
  return <div className="staff-entry">
    <section className="staff-entry-panel" aria-label="Educator access">{content}</section>
    <picture className="staff-entry-photo">
      <img src="/salon-pink-glaze-480.webp" srcSet="/salon-pink-glaze-480.webp 480w, /salon-pink-glaze-960.webp 960w"
        sizes="(max-width: 760px) 100vw, 45vw" width={480} height={640} alt="A close-up of a soft pink manicure with fine shimmer at Savannah Sky Salon" />
    </picture>
  </div>;
}
