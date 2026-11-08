import { redirect } from 'next/navigation';
import { getChatGPTUser, chatGPTSignInPath } from '@/app/chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function Login() {
  redirect(await getChatGPTUser() ? '/dashboard' : chatGPTSignInPath('/dashboard'));
}
