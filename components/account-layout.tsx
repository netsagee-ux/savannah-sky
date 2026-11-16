import {ClerkProvider} from '@clerk/nextjs';
import {headers} from 'next/headers';
import {academyAuthDomain} from '@/lib/academy-auth-domain';

export default async function AccountLayout({children}:{children:React.ReactNode}){
  if(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)return children;
  const domain = academyAuthDomain((await headers()).get('host'));
  return <ClerkProvider {...domain} signInUrl="/sign-in"
    localization={{signIn:{start:{title:'Your account',titleCombined:'Your account',
      subtitle:'Enter your email to continue.',subtitleCombined:'Enter your email to sign in or create an account.'}}}}>
    {children}
  </ClerkProvider>;
}

export {AccountLayout as StudentLayout};
