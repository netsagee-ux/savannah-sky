import {ClerkProvider} from '@clerk/nextjs';

export default function AccountLayout({children,staff=false}:{children:React.ReactNode;staff?:boolean}){
  if(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)return children;
  return <ClerkProvider signInUrl={staff?'/admin/login':'/sign-in'} signUpUrl={staff?'/admin/login/activate':'/sign-up'}
    localization={{signIn:{start:{
      ...(staff?{title:'Staff sign-in',subtitle:'Use the email address linked to your academy workspace.'}:{}),
      titleCombined:staff?'Staff sign-in':'Student sign-in',
      subtitleCombined:staff?'Use the email address linked to your academy workspace.':'Use your email to open your courses and orders.',
    }},...(staff?{signUp:{start:{title:'Set up staff sign-in',subtitle:'Use your invited educator email to create your account.'}}}:{})}}>{children}</ClerkProvider>;
}

export function StudentLayout({children}:{children:React.ReactNode}){
  return <AccountLayout>{children}</AccountLayout>;
}
