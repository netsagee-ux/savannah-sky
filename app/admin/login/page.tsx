import {SignIn} from '@clerk/nextjs';
import {redirect} from 'next/navigation';
import {admin} from '@/lib/server';
import {getChatGPTUser} from '@/app/chatgpt-auth';

export const dynamic='force-dynamic';
export const metadata={title:'Academy staff sign-in'};

export default async function AdminLogin() {
  if(await admin()) redirect('/admin');
  const user=await getChatGPTUser();
  return <section className="standalone-login academy-staff-login">
    <div className="login-card">
      <span className="eyebrow">ACADEMY MANAGEMENT</span>
      <h1>Staff sign-in</h1>
      <p>Manage course recordings, review sales and look after your students.</p>
      {user ? <><p className="notice">{user.email} does not have academy management access.</p><a className="button" href="/sign-out">Switch account</a></>
        : process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
        ? <SignIn withSignUp routing="hash" forceRedirectUrl="/admin" appearance={{variables:{colorPrimary:'#512634'}}}/>
        : <p role="status">Staff sign-in is temporarily unavailable.</p>}
      <a className="underlink" href="/sign-in">Go to student sign-in</a>
    </div>
  </section>;
}
