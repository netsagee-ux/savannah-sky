import {SignOutButton} from '@clerk/nextjs';
export const dynamic='force-dynamic';
export default function Page(){return <section className="section"><h1>Sign out of your account</h1>{process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?<SignOutButton redirectUrl="/"><button className="button">Sign out</button></SignOutButton>:<a href="/">Return home</a>}</section>}
