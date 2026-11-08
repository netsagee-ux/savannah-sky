import {getChatGPTUser} from '@/app/chatgpt-auth';
import {db,enrolled} from '@/lib/server';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}) {
  const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
  try {
    const {id}=await params;
    if (!await getChatGPTUser()) return Response.json({error:'Sign in to learn.'},{status:401,headers});
    if (!await enrolled(id)) return Response.json({error:'Course access required.'},{status:403,headers});
    const first=await db().prepare('SELECT id FROM lessons WHERE course_id=? ORDER BY position,id LIMIT 1').bind(id).first<{id:string}>();
    const path=first ? '/learn/'+encodeURIComponent(first.id) : '/courses/'+encodeURIComponent(id);
    return new Response(null,{status:302,headers:{...headers,Location:new URL(path,req.url).href}});
  } catch {return Response.json({error:'Course access is unavailable.'},{status:503,headers});}
}
