import {SignIn} from '@clerk/nextjs';
import {redirect} from 'next/navigation';
import {admin,db} from '@/lib/server';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {staffDestination} from '@/lib/staff-navigation';
import StaffRequest from '@/components/staff-request';

export const dynamic='force-dynamic';
export const metadata={title:'Academy staff sign-in'};

export default async function AdminLogin({searchParams}:{searchParams:Promise<{next?:string}>}){
  const next=staffDestination((await searchParams).next);
  if(await admin())redirect(next);
  const user=await getChatGPTUser();
  const pending=user && await db().prepare('SELECT id FROM settings WHERE id=? AND value=?')
    .bind('staff-request:'+user.userId,user.email).first().catch(()=>null);
  return <section className="standalone-login academy-staff-login"><div className="login-card">
    <span className="eyebrow">Academy management</span><h1>Staff sign-in</h1>
    {user?<><p>Signed in as {user.email}.</p>{pending?<><p>Your request is waiting for the academy owner to approve it.</p>
      <a className="button" href={'/admin/login?next='+encodeURIComponent(next)}>Check access</a></>:
      <><p>Request educator access to upload course videos and manage lessons.</p><StaffRequest/></>}
      <a className="underlink" href={'/sign-out?staff=1&next='+encodeURIComponent(next)}>Use another email</a></>:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?<><p>Use your educator email. After signing in you’ll return to your workspace.</p>
        <SignIn withSignUp routing="hash" forceRedirectUrl={next} signUpForceRedirectUrl={next}
          appearance={{variables:{colorPrimary:'#512634'}}}/></>:
      <p role="status">Staff sign-in is temporarily unavailable.</p>}
    <a className="underlink" href="/sign-in">Go to student sign-in</a>
  </div></section>;
}
