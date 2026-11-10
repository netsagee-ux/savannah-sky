import {redirect} from 'next/navigation';
import {auth} from '@clerk/nextjs/server';
import {getChatGPTUser,chatGPTSignInPath} from '@/app/chatgpt-auth';
import {isOwnerEmail} from '@/lib/server';
import {accountLanding,accountReturn} from '@/lib/account-navigation';

export const dynamic='force-dynamic';

export default async function ContinueAccount({searchParams}:{searchParams:Promise<{next?:string}>}){
  const next=accountReturn((await searchParams).next);
  const user=await getChatGPTUser();
  if(user)redirect(accountLanding(await isOwnerEmail(user.email),next));
  if(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && (await auth()).userId){
    return <section className="studio-wrap section"><h1>Verify your email</h1><p>Verify your primary email address to open your account.</p><a className="underlink" href="/sign-out">Sign out and try again</a></section>;
  }
  redirect(chatGPTSignInPath(next));
}
