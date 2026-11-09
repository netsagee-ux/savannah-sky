// Keep existing function names so course access checks share one verified identity source.
import {auth, currentUser} from '@clerk/nextjs/server';
import {cache} from 'react';
import {redirect} from 'next/navigation';
export type ChatGPTUser={userId:string;sessionId:string;displayName:string;email:string;fullName:string|null};
export const getChatGPTUser=cache(async function getChatGPTUser():Promise<ChatGPTUser|null>{
 if(!process.env.CLERK_SECRET_KEY||!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)return null;
 const session=await auth();
 if(!session.userId||!session.sessionId)return null;
 const user=await currentUser();
 const primary=user?.emailAddresses.find(e=>e.id===user.primaryEmailAddressId);
 if(!user||!session.sessionId||session.userId!==user.id||!primary||primary.verification?.status!=='verified')return null;
 return {userId:user.id,sessionId:session.sessionId,email:primary.emailAddress.toLowerCase(),fullName:user.fullName,displayName:user.fullName||primary.emailAddress};
});
export async function requireChatGPTUser(returnTo:string){const user=await getChatGPTUser();if(user)return user;redirect(chatGPTSignInPath(returnTo));}
export function chatGPTSignInPath(returnTo:string){return '/sign-in?redirect_url='+encodeURIComponent(safeReturn(returnTo));}
export function chatGPTSignOutPath(){return '/sign-out';}
function safeReturn(value:string){try{const u=new URL(value,'https://app.local');return u.origin==='https://app.local'&&value.startsWith('/')&&!value.startsWith('//')?u.pathname+u.search+u.hash:'/dashboard';}catch{return '/dashboard';}}
