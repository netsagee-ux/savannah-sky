const env=process.env;
import {db,enrolled} from '@/lib/server';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {signPlayback,videoBookmark} from '@/lib/video-security';

export async function POST(req:Request){
  const headers={'Cache-Control':'private, no-store'};
  const reply=(body:object,status=200)=>Response.json(body,{status,headers});
  if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Invalid origin'},403);
  try{
    const user=await getChatGPTUser();
    if(!user)return reply({error:'Please sign in to watch this lesson.'},401);
    const body=await req.json().catch(()=>null) as {lessonId?:unknown}|null;
    if(typeof body?.lessonId!=='string')return reply({error:'Choose a lesson.'},400);
    const lesson=await db().prepare('SELECT id,course_id,video_key FROM lessons WHERE id=?').bind(body.lessonId)
      .first<{id:string;course_id:string;video_key:string|null}>();
    if(!lesson||!await enrolled(lesson.course_id))return reply({error:'Course access is required.'},403);
    if(!lesson.video_key)return reply({error:'This lesson has no uploaded video.'},404);
    const secret=env.APP_ENCRYPTION_KEY;
    if(!secret)throw Error('Playback is not configured.');
    const expires=Math.floor(Date.now()/1000)+7200;
    const bookmark=await videoBookmark(user.userId,lesson.id,lesson.video_key);
    const [saved,signature]=await Promise.all([
      db().prepare('SELECT value FROM settings WHERE id=?').bind(bookmark).first<{value:string}>(),
      signPlayback(user,lesson.id,expires,secret),
    ]);
    return reply({url:'/api/video/'+encodeURIComponent(lesson.id)+'?expires='+expires+'&signature='+signature,
      expires,bookmark,seconds:Number(saved?.value)||0});
  }catch{return reply({error:'Unable to open the video. Please try again.'},503);}
}
