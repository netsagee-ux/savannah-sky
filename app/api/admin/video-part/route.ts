import {sameSiteOrigin} from '@/lib/request-origin';
import {admin, db} from '@/lib/server';
import {classroomVideoCourse, classroomVideoLimit, lessonVideoTypes, mediaPartBytes} from '@/lib/lesson-upload';
import {storeMediaPart} from '@/lib/classroom-media';

export async function POST(request:Request) {
  if(!await admin())return Response.json({error:'Administrator access required.'},{status:403});
  const url=new URL(request.url);
  if(!sameSiteOrigin(request))return Response.json({error:'Invalid origin.'},{status:403});
  const id=url.searchParams.get('key')||'', course=classroomVideoCourse(id);
  const size=Number(url.searchParams.get('size')),part=Number(url.searchParams.get('part'));
  const type=request.headers.get('Content-Type')||'';
  if(!course || !url.searchParams.has('part') || !Number.isSafeInteger(size) || size<1 || size>classroomVideoLimit ||
    !Number.isSafeInteger(part) || part<0 || part>=Math.ceil(size/mediaPartBytes) || !lessonVideoTypes.includes(type))
    return Response.json({error:'Invalid recording or upload part.'},{status:400});
  const expected=Math.min(mediaPartBytes,size-part*mediaPartBytes);
  if(Number(request.headers.get('content-length')??expected)!==expected)return Response.json({error:'Incorrect part size.'},{status:400});
  try {
    if(!await db().prepare('SELECT id FROM courses WHERE id=?').bind(course).first())return Response.json({error:'Course not found.'},{status:404});
    const bytes=Buffer.from(await request.arrayBuffer());
    if(bytes.length!==expected)return Response.json({error:'Incorrect part size.'},{status:400});
    await storeMediaPart(id,{size,type},part,bytes);
    return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  } catch {return Response.json({error:'The recording could not be saved. Retry this upload.'},{status:503});}
}
