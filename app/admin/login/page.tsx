import {redirect} from 'next/navigation';
import {chatGPTSignInPath} from '@/app/chatgpt-auth';
import {accountReturn} from '@/lib/account-navigation';

export default async function LegacyLogin({searchParams}:{searchParams:Promise<{next?:string}>}){
  const {next}=await searchParams;
  redirect(next?chatGPTSignInPath(accountReturn(next)):'/sign-in');
}
