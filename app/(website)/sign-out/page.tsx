import {staffDestination} from '@/lib/staff-navigation';
import {SignOutButton} from '@clerk/nextjs';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{staff?:string;next?:string}>}){const params=await searchParams;const after=params.staff==='1'?'/admin/login?next='+encodeURIComponent(staffDestination(params.next)):'/';return <section className="section"><h1>Sign out of your account</h1>{process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?<SignOutButton redirectUrl={after}><button className="button">Sign out</button></SignOutButton>:<a href="/">Return home</a>}</section>}
