import { redirect } from 'next/navigation';
import { chatGPTSignInPath } from '@/app/chatgpt-auth';
export default async function Page({searchParams}: {searchParams: Promise<{redirect_url?:string}>}) {
  const params = await searchParams;
  redirect(chatGPTSignInPath(typeof params.redirect_url === 'string' ? params.redirect_url : '/dashboard'));
}
