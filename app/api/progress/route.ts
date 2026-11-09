import {db,enrolled} from '@/lib/server';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {videoBookmark} from '@/lib/video-security';

export async function POST(req:Request) {
  const reply=(body:object,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
  if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Invalid origin.'},403);
  try{
    const user=await getChatGPTUser();
    if(!user)return reply({error:'Please sign in.'},401);
    const data=await req.json().catch(()=>null) as Record<string,unknown>|null;
    if(typeof data?.lessonId!=='string')return reply({error:'Choose a lesson.'},400);
    const database=db();
    const lesson=await database.prepare('SELECT id,course_id,video_key,question,answer FROM lessons WHERE id=?').bind(data.lessonId)
      .first<{id:string;course_id:string;video_key:string|null;question:string|null;answer:number|null}>();
    if(!lesson||!await enrolled(lesson.course_id))return reply({error:'Course access is required.'},403);
    if(data.action==='bookmark'){
      if(typeof data.seconds!=='number'||!Number.isSafeInteger(data.seconds)||data.seconds<0||data.seconds>604800)return reply({error:'Invalid playback time.'},400);
      if(!lesson.video_key || typeof data.bookmark!=='string' || data.bookmark!==await videoBookmark(user.userId,lesson.id,lesson.video_key))
        return reply({error:'Reopen the current recording.'},409);
      await database.prepare('INSERT INTO settings(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value')
        .bind(data.bookmark,String(data.seconds)).run();
      return reply({ok:true});
    }
    if(data.action!==undefined && data.action!=='complete')return reply({error:'Invalid progress action.'},400);
    if(lesson.question && (!Number.isInteger(data.answer)||data.answer!==lesson.answer))
      return reply({error:'Not quite. Revisit the lesson and try again.'},400);
    await database.prepare('INSERT OR IGNORE INTO progress(id,user_id,lesson_id,completed_at) VALUES(?,?,?,?)')
      .bind(user.userId+':'+lesson.id,user.userId,lesson.id,new Date().toISOString()).run();
    return reply({ok:true});
  }catch{return reply({error:'Unable to save progress. Please retry.'},503);}
}
