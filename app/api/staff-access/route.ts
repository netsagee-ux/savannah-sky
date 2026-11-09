import {getChatGPTUser} from '@/app/chatgpt-auth';
import {db,owner,staffEmail,educatorInviteKey} from '@/lib/server';

const prefix='staff-request:';
const headers={'Cache-Control':'private, no-store'};
function reply(body:object,status=200){return Response.json(body,{status,headers});}

export async function POST(req:Request){
  if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Invalid origin.'},403);
  const user=await getChatGPTUser();
  if(!user)return reply({error:'Sign in with your verified email first.'},401);
  try{
    const data=await req.json().catch(()=>null) as {action?:string;request?:string;current?:string}|null;
    const dbh=db();
    if(data?.action==='request'){
      const id=prefix+user.userId;
      await dbh.prepare('INSERT INTO settings(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value')
        .bind(id,user.email.toLowerCase()).run();
      return reply({message:'Your request is with the academy owner. Return here after approval.'});
    }
    if(!await owner())return reply({error:'Academy owner access required.'},403);
    if(data?.action==='revoke-invite'){
      await dbh.prepare("INSERT INTO settings(id,value) VALUES(?,'revoked') ON CONFLICT(id) DO UPDATE SET value='revoked'").bind(educatorInviteKey).run();
      return reply({message:'Educator invitation revoked.'});
    }
    const id=data?.request;
    if(!id?.startsWith(prefix)||!['approve','dismiss'].includes(data?.action||''))return reply({error:'Select a staff request.'},400);
    const request=await dbh.prepare('SELECT value FROM settings WHERE id=?').bind(id).first<{value:string}>();
    if(!request)return reply({error:'This request has already been handled.'},409);
    if(data?.action==='dismiss'){
      await dbh.prepare('DELETE FROM settings WHERE id=? AND value=?').bind(id,request.value).run();
      return reply({message:'Request dismissed.'});
    }
    // Confirm the exact educator slot the owner saw before replacing any existing permission.
    const current=typeof data?.current==='string'?data.current:null;
    if(current===null||current!==await staffEmail())return reply({error:'Staff access has changed. Refresh before approving.'},409);
    const changes=await dbh.batch([
      dbh.prepare(`INSERT INTO settings(id,value) SELECT 'academy_staff_email',value FROM settings
        WHERE id=? AND value=? AND coalesce((SELECT value FROM settings WHERE id='academy_staff_email'),'')=?
        ON CONFLICT(id) DO UPDATE SET value=excluded.value`).bind(id,request.value,current),
      dbh.prepare("DELETE FROM settings WHERE id=? AND value=? AND EXISTS(SELECT 1 FROM settings WHERE id='academy_staff_email' AND value=?)")
        .bind(id,request.value,request.value),
    ]);
    if(!changes[0].meta.changes)return reply({error:'Refresh the current staff requests.'},409);
    return reply({message:'Staff access approved. The educator can now open Lessons.'});
  }catch{return reply({error:'Staff access could not be updated. Please try again.'},503);}
}
