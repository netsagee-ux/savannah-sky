import {SignUp} from '@clerk/nextjs';
export const dynamic='force-dynamic';
export default function Page(){return <section className="section student-login">{process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?<SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/dashboard"/>:<p>Student accounts are being connected. Please contact the academy.</p>}</section>}
