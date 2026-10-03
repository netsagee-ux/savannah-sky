// Keep existing function names so course access checks share one verified identity source.
import {currentUser} from '@clerk/nextjs/server';
import {redirect} from 'next/navigation';
export type ChatGPTUser={userId:string;displayName:string;email:string;fullName:string|null};
export async function getChatGPTUser():Promise<ChatGPTUser|null>{
 if(!process.env.CLERK_SECRET_KEY||!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)return null;
 const user=await currentUser();
 const primary=user?.emailAddresses.find(e=>e.id===user.primaryEmailAddressId);
 if(!user||!primary||primary.verification?.status!=='verified')return null;
 return {userId:user.id,email:primary.emailAddress.toLowerCase(),fullName:user.fullName,displayName:user.fullName||primary.emailAddress};
}
export async function requireChatGPTUser(returnTo:string){const user=await getChatGPTUser();if(user)return user;redirect(chatGPTSignInPath(returnTo));}
export function chatGPTSignInPath(returnTo:string){return '/sign-in?redirect_url='+encodeURIComponent(safeReturn(returnTo));}
export function chatGPTSignOutPath(){return '/sign-out';}
function safeReturn(value:string){try{const u=new URL(value,'https://app.local');return u.origin==='https://app.local'&&value.startsWith('/')&&!value.startsWith('//')?u.pathname+u.search:'/dashboard';}catch{return '/dashboard';}}
