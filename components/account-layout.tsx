import {ClerkProvider} from '@clerk/nextjs';

export default function AccountLayout({children,staff=false}:{children:React.ReactNode;staff?:boolean}){
  if(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)return children;
  return <ClerkProvider signInUrl={staff?'/admin/login':'/sign-in'} signUpUrl="/sign-up"
    localization={{signIn:{start:{
      ...(staff?{title:'Staff sign-in',subtitle:'Enter your own educator email. Your sign-in code goes straight to that inbox.'}:{}),
      titleCombined:staff?'Staff sign-in':'Student sign-in',
      subtitleCombined:staff?'Enter your own educator email. Your sign-in code goes straight to that inbox.':'Use your email to open your courses and orders.',
    }}}}>{children}</ClerkProvider>;
}

export function StudentLayout({children}:{children:React.ReactNode}){
  return <AccountLayout>{children}</AccountLayout>;
}
