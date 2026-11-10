import {ClerkProvider} from '@clerk/nextjs';

export default function AccountLayout({children}:{children:React.ReactNode}){
  if(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)return children;
  return <ClerkProvider signInUrl="/sign-in"
    localization={{signIn:{start:{title:'Your account',titleCombined:'Your account',
      subtitle:'Enter your email to continue.',subtitleCombined:'Enter your email to sign in or create an account.'}}}}>
    {children}
  </ClerkProvider>;
}

export {AccountLayout as StudentLayout};
