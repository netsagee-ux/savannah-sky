import {SignUp} from '@clerk/nextjs';
import AuthFrame from '@/components/auth-frame';
export const dynamic='force-dynamic';
export default function Page(){return <AuthFrame signup>{process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?<SignUp appearance={{variables:{colorPrimary:'#755267',borderRadius:'0.9rem',fontFamily:'Inter, sans-serif'},elements:{card:{boxShadow:'none',border:'none',background:'transparent'},cardBox:{boxShadow:'none',width:'100%',maxWidth:'400px'},rootBox:{width:'100%'},formButtonPrimary:{minHeight:'48px',boxShadow:'none',textTransform:'none'},headerTitle:{fontSize:'24px',fontWeight:600}}}} routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/dashboard"/>:<p>Student accounts are being connected.</p>}</AuthFrame>}
