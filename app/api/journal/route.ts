import {admin} from '@/lib/server';
import {sameSiteOrigin} from '@/lib/request-origin';
import {journalPosts,saveJournalPost} from '@/lib/journal';

const headers={'Cache-Control':'private, no-store'};
export async function GET(){
  if(!await admin())return Response.json({error:'Staff access required.'},{status:403,headers});
  return Response.json({posts:await journalPosts(true)},{headers});
}
export async function POST(request:Request){
  if(!sameSiteOrigin(request)||!await admin())return Response.json({error:'Staff access required.'},{status:403,headers});
  const result=await saveJournalPost(await request.json().catch(()=>null));
  if(result==='invalid')return Response.json({error:'Enter a title and post text within the displayed limits.'},{status:400,headers});
  if(result==='conflict')return Response.json({error:'This post was changed elsewhere. Reopen its latest version before saving.'},{status:409,headers});
  return Response.json({ok:true},{headers});
}
