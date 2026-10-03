import {SignIn} from '@clerk/nextjs';
export const dynamic='force-dynamic';
export default function Page(){return <section className="section student-login">{process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?<SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard"/>:<div className="notice"><h1>Student sign-in is being connected.</h1><p>Please contact the academy for course enquiries.</p><a className="button" href="/contact">Contact the academy</a></div>}</section>}
