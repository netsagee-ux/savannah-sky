import {ClerkProvider} from '@clerk/nextjs';

export default function AccountLayout({children,staff=false}:{children:React.ReactNode;staff?:boolean}){
  if(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)return children;
  return <ClerkProvider signInUrl={staff?'/admin/login':'/sign-in'} signUpUrl="/sign-up"
    localization={{signIn:{start:{
      titleCombined:staff?'Academy staff sign-in':'Student sign-in',
      subtitleCombined:staff?'Use your verified educator email to manage lessons.':'Use your email to open your courses and orders.',
    }}}}>{children}</ClerkProvider>;
}

export function StudentLayout({children}:{children:React.ReactNode}){
  return <AccountLayout>{children}</AccountLayout>;
}
