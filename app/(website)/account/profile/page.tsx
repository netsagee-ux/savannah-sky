import {UserProfile} from '@clerk/nextjs';
import {redirect} from 'next/navigation';
import {requireChatGPTUser} from '@/app/chatgpt-auth';
import {handoverComplete} from '@/lib/server';

export const dynamic='force-dynamic';

export default async function Profile(){
  const user=await requireChatGPTUser('/account/profile');
  if(user.email!=='netsagee@gmail.com'||!await handoverComplete())redirect('/dashboard');
  return <section className="studio-wrap section"><h1>Temporary account settings</h1>
    <p>The salon owns the dashboard. You can manage your own academy sign-in here.</p>
    <UserProfile routing="hash"/>
  </section>;
}
