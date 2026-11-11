import {courseInformationColumns,extraCourseFields} from '@/lib/course-information';
import {sameSiteOrigin} from '@/lib/request-origin';
import {prepareLessonPhotos} from '@/lib/save-lesson-photos';
import {readQuiz,validateQuiz} from '@/lib/lesson-quiz';
import {revalidatePath} from 'next/cache';
import {merchantStatus,salesSummary} from '@/lib/sumup';
import {head as blobHead} from '@vercel/blob';
import {classroomVideoCourse,lessonUploadCourse,lessonVideoTypes,maxLessonBytes} from '@/lib/lesson-upload';
import {imageContentType} from '@/lib/video-security';import {safeHttps} from '@/lib/payment-security';import {admin,db,bucket} from '@/lib/server';
export async function GET(request:Request){
  if(!await admin())return Response.json({error:'Administrator access required'},{status:403});
  try{
    const params=new URL(request.url).searchParams;
    const tab=params.get('tab'),courseId=params.get('courseId');
    const all=!tab,store=db();
    const fullCourses=`SELECT c.*,${courseInformationColumns},(SELECT value FROM settings WHERE id='course-format:'||c.id) AS format,
      (SELECT value FROM settings WHERE id='class-dates:'||c.id) AS class_dates,(SELECT value FROM settings WHERE id='cpd:'||c.id) AS cpd,
      (SELECT count(*) FROM lessons l WHERE l.course_id=c.id) AS lesson_count,
      (SELECT count(*) FROM lessons l WHERE l.course_id=c.id AND nullif(l.video_key,'') IS NOT NULL) AS videos
      FROM courses c ORDER BY c.title`;
    const lessons=store.prepare("SELECT l.*,(SELECT value FROM settings WHERE id='quiz:'||l.id) AS quiz_json,(SELECT json_group_array(json_object('id',substr(id,-36),'caption',json_extract(value,'$.caption'))) FROM (SELECT id,value FROM settings WHERE id GLOB 'lesson-photo/'||l.id||'/*' ORDER BY rowid)) AS photos_json,c.title AS course_title FROM lessons l JOIN courses c ON c.id=l.course_id "+
      (all?'':'WHERE l.course_id=? ')+'ORDER BY c.title,l.position,l.id');
    const students=`SELECT e.*,c.title,(SELECT COUNT(*) FROM lessons l WHERE l.course_id=e.course_id) AS total,
      (SELECT COUNT(*) FROM progress p JOIN lessons l ON l.id=p.lesson_id WHERE
        (e.id='buyer/'||p.user_id||'/'||e.course_id OR (e.id NOT LIKE 'buyer/%' AND EXISTS(SELECT 1 FROM profiles u WHERE u.id=p.user_id AND u.email=e.email)))
        AND l.course_id=e.course_id) AS completed FROM enrollments e JOIN courses c ON c.id=e.course_id`;
    const [merchant,metrics,courses,enquiries,enrollments,recordings]=await Promise.all([
      all||tab==='Courses'?merchantStatus().catch(()=>null):null,all||tab==='Courses'||tab==='Payments'?salesSummary().catch(()=>null):null,
      all||tab==='Courses'||(tab==='Lessons'&&!courseId)?store.prepare(fullCourses).all():tab==='Lessons'?store.prepare(`SELECT c.id,c.title,c.level,c.published,c.thumbnail_key,
        (SELECT count(*) FROM lessons l WHERE l.course_id=c.id) AS lesson_count FROM courses c ORDER BY c.title`).all():null,
      all||tab==='Enquiries'?store.prepare('SELECT * FROM enquiries ORDER BY created_at DESC LIMIT 100').all():null,
      all||tab==='Students'?store.prepare(students).all():null,
      all?lessons.all():tab==='Lessons'&&courseId?lessons.bind(courseId).all():null,
    ]);
    return Response.json({sumupReady:merchant?Boolean(merchant.code):undefined,metrics,courses:courses?.results||[],
      enquiries:enquiries?.results||[],enrollments:enrollments?.results||[],lessons:recordings?.results||[],
      directVideoUpload:Boolean(process.env.BLOB_READ_WRITE_TOKEN||process.env.BLOB_STORE_ID)},{headers:{'Cache-Control':'private, no-store'}});
  }catch{return Response.json({error:'Academy data could not be loaded.'},{status:503});}
}
export async function POST(req:Request){if(!await admin())return Response.json({error:'Administrator access required'},{status:403});try{if(!sameSiteOrigin(req))return Response.json({error:'Reopen the academy dashboard to save from this website.',code:'invalid_origin'},{status:403});if(Number(req.headers.get('content-length')||0)>4*1024*1024)return Response.json({error:'Upload lesson videos separately and keep thumbnails under 3 MB.'},{status:413});const f=await req.formData();const s=(k:string)=>String(f.get(k)||'').trim();const action=s('action');
const creationId=!s('id') && (action==='course'||action==='lesson') ? s('creationId') : '';
if(creationId && !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(creationId))throw Error('Reopen the editor and try saving again.');
async function wasCreated(){
  if(!creationId)return false;
  if(action==='course')return Boolean(await db().prepare('SELECT id FROM courses WHERE id=?').bind(creationId).first());
  return Boolean(await db().prepare('SELECT id FROM lessons WHERE id=? AND course_id=?').bind(creationId,s('courseId')).first());
}
function creationResult(){
  revalidateListings();
  return Response.json(action==='course'?{ok:true,courseId:creationId}:{ok:true});
}
if(await wasCreated())return creationResult();
if(action==='course'){
for(const [name,{label}] of Object.entries(extraCourseFields)){
  if(s(name).length>3000)throw Error(`Keep ${label} within 3,000 characters.`);
}
if(f.has('format')&&!['classroom','online'].includes(s('format')))throw Error('Choose a course format.');
if(s('classDates').length>3000)throw Error('Keep class dates and joining instructions within 3,000 characters.');
if(!s('title')||s('title').length>120||!s('description')||s('description').length>2000)throw Error('Please add a title and description.');if(s('outcomes').length>3000||s('requirements').length>3000||s('duration').length>200||s('accessPolicy').length>1000)throw Error('Please shorten the course information.');const url=s('paymentUrl');if(url&&(!url.startsWith('https://buy.stripe.com/')||new URL(url).hostname!=='buy.stripe.com'))throw Error('Use a Stripe payment link beginning https://buy.stripe.com/.');const price=s('price')?Math.round(Number(s('price'))*100):null;if(price!==null&&(!Number.isFinite(price)||price<0||price>1000000))throw Error('Please check the price.');if(!['Beginner','Intermediate','Creative','Conversion'].includes(s('level')))throw Error('Choose a valid course level.');const courseUrl=safeHttps(s('courseUrl'));const id=s('id')||creationId||crypto.randomUUID();const old=s('id')?await db().prepare('SELECT thumbnail_key,course_url,payment_url FROM courses WHERE id=?').bind(id).first<any>():null;if(s('id')&&!old)throw Error('Course not found.');let thumbnailKey=s('removeCourseThumbnail')==='1'?null:old?.thumbnail_key||null;let uploaded:string|null=null;const thumbnail=f.get('courseThumbnail');if(thumbnail instanceof File&&thumbnail.size){if(thumbnail.size>3*1024*1024)throw Error('Use a thumbnail up to 3 MB.');const bytes=await thumbnail.arrayBuffer();const type=imageContentType(new Uint8Array(bytes));if(!type)throw Error('Use a JPG, PNG or WebP thumbnail.');uploaded=newAssetKey('course-thumbnails');await bucket().put(uploaded,bytes,{httpMetadata:{contentType:type}});thumbnailKey=uploaded;}try{const values=[s('title'),s('description'),s('level'),price,url||old?.payment_url||null,s('outcomes')||null,s('requirements')||null,s('duration')||null,s('accessPolicy')||null,s('published')==='1'?1:0,courseUrl||old?.course_url||null,thumbnailKey];const details=s('id')?db().prepare('UPDATE courses SET title=?,description=?,level=?,price=?,payment_url=?,outcomes=?,requirements=?,duration=?,access_policy=?,published=?,course_url=?,thumbnail_key=? WHERE id=?').bind(...values,id):db().prepare('INSERT INTO courses (title,description,level,price,payment_url,outcomes,requirements,duration,access_policy,published,course_url,thumbnail_key,id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(...values,id);const statements=[details];
for(const [field,prefix] of [['format','course-format:'],['classDates','class-dates:']]){
  if(f.has(field))statements.push(db().prepare('INSERT INTO settings(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').bind(prefix+id,s(field)));
}
for(const name of Object.keys(extraCourseFields)){
  if(f.has(name))statements.push(db().prepare('INSERT INTO settings(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').bind('course-info:'+name+':'+id,s(name)));
}
if(f.has('cpd'))statements.push(db().prepare('INSERT INTO settings(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').bind('cpd:'+id,s('cpd')==='1'?'1':'0'));await db().batch(statements);}catch(e){if(uploaded)await bucket().delete(uploaded);if(await wasCreated())return creationResult();throw e;}if(old?.thumbnail_key&&old.thumbnail_key!==thumbnailKey){try{await bucket().delete(old.thumbnail_key)}catch{console.error('Old course thumbnail cleanup failed')}}revalidateListings();return Response.json({ok:true,courseId:id});}else if(action==='visibility'){await db().prepare('UPDATE courses SET published=? WHERE id=?').bind(s('published')==='1'?1:0,s('id')).run();}else if(action==='enrol'){return Response.json({error:'Confirm the student’s paid order in Payments to activate access.'},{status:409});}else if(action==='revoke'){await db().prepare('DELETE FROM enrollments WHERE id=?').bind(s('id')).run();}else if(action==='lesson'){const c=await db().prepare('SELECT id FROM courses WHERE id=?').bind(s('courseId')).first();if(!c||!s('title')||s('title').length>120||s('body').length>20000)throw Error('Choose a course and add lesson content.');const position=Number(s('position'));
if(!Number.isInteger(position)||position<0||position>1000)throw Error('Check the lesson position.');
const videoUrl=safeHttps(s('videoUrl')),resourceUrl=safeHttps(s('resourceUrl'));const old=s('id')?await db().prepare("SELECT l.*,(SELECT value FROM settings WHERE id='quiz:'||l.id) AS quiz_json FROM lessons l WHERE id=?").bind(s('id')).first<any>():null;if(s('id')&&!old)throw Error('Lesson not found.');if(old&&old.course_id!==s('courseId'))throw Error('An existing lesson cannot be moved between courses.');const video=f.get('video'),thumbnail=f.get('thumbnail');let key:string|null=(old?.video_key as string)||null,thumbnailKey:string|null=(old?.thumbnail_key as string)||null;const uploaded:string[]=[];
if(s('removeVideo')==='1')key=null;if(['1','private'].includes(s('removeThumbnail')))thumbnailKey=null;
if(video instanceof File&&video.size&&(video.size>3*1024*1024||!['video/mp4','video/webm'].includes(video.type)))throw Error('Upload an MP4 or WebM video up to 3 MB.');
const staged=s('uploadedVideoKey');
if(staged && classroomVideoCourse(staged)){
  if(classroomVideoCourse(staged)!==s('courseId')||(video instanceof File&&video.size))throw Error('Invalid lesson upload.');
  if(!await bucket().head(staged))throw Error('Finish uploading all parts before attaching this recording.');
  if(await db().prepare('SELECT id FROM lessons WHERE video_key=? AND id<>?').bind(staged,s('id')||creationId).first())throw Error('This video belongs to another lesson.');
  key=staged;
} else if(staged){
  if(!(process.env.BLOB_READ_WRITE_TOKEN||process.env.BLOB_STORE_ID)||lessonUploadCourse(staged)!==s('courseId')||(video instanceof File&&video.size))throw Error('Invalid lesson upload.');
  const stored=await blobHead(staged);
  if(stored.pathname!==staged||!new URL(stored.url).hostname.endsWith('.private.blob.vercel-storage.com')||!lessonVideoTypes.includes(stored.contentType)||stored.size<1||stored.size>maxLessonBytes)throw Error('Choose a private MP4 or WebM upload.');
  if(await db().prepare('SELECT id FROM lessons WHERE video_key=? AND id<>?').bind(staged,s('id')||creationId).first())throw Error('This upload is already attached to another lesson.');
  key=staged;
}
const id=s('id')||creationId||crypto.randomUUID();
const previous=readQuiz(old);
const quiz=f.has('quiz')?validateQuiz(JSON.parse(s('quiz'))):f.has('question')?
  validateQuiz([...(s('question')?[{question:s('question'),options:[s('option0'),s('option1'),s('option2')],answer:Number(s('answer'))}]:[]),...previous.slice(1)]):previous;
const first=quiz[0];
const photos=await prepareLessonPhotos(f,s('courseId'),id,s('removeThumbnail')==='private'?old?.thumbnail_key||null:null);
if(!photos.count&&!quiz.length&&!s('body')&&!key&&!(video instanceof File&&video.size)&&!videoUrl&&!old?.video_url)throw Error('Add a photo, recording, lesson notes or a quiz before saving.');
let thumbnailBytes:ArrayBuffer|null=null,thumbnailType:string|null=null;
if(thumbnail instanceof File&&thumbnail.size){if(thumbnail.size>3*1024*1024)throw Error('Use a thumbnail up to 3 MB.');thumbnailBytes=await thumbnail.arrayBuffer();thumbnailType=imageContentType(new Uint8Array(thumbnailBytes));if(!thumbnailType)throw Error('Use a JPG, PNG or WebP thumbnail.');}
try{
if(video instanceof File&&video.size){key=newAssetKey('lessons');uploaded.push(key);await bucket().put(key,video.stream(),{httpMetadata:{contentType:video.type}});}
if(thumbnailBytes&&thumbnailType){thumbnailKey=newAssetKey('thumbnails');uploaded.push(thumbnailKey);await bucket().put(thumbnailKey,thumbnailBytes,{httpMetadata:{contentType:thumbnailType}});}
const values=[s('title'),s('body'),key,thumbnailKey,videoUrl||old?.video_url||null,resourceUrl||old?.resource_url||null,first?.question||null,first?JSON.stringify(first.options):null,first?.answer??null,position];
const database=db();
const details=old?database.prepare('UPDATE lessons SET title=?,body=?,video_key=?,thumbnail_key=?,video_url=?,resource_url=?,question=?,options=?,answer=?,position=? WHERE id=?').bind(...values,id):
  database.prepare('INSERT INTO lessons (title,body,video_key,thumbnail_key,video_url,resource_url,question,options,answer,position,id,course_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(...values,id,s('courseId'));
await database.batch([...photos.statements,details,database.prepare('INSERT INTO settings(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').bind('quiz:'+id,JSON.stringify(quiz))]);
}catch(e){if(uploaded.length)await bucket().delete(uploaded);if(await wasCreated())return creationResult();if(e instanceof Error&&e.message.includes('malformed JSON'))throw Error('The lesson photos changed in another session. Reopen the lesson to see the latest version.');throw e;}
const unused=[old?.video_key&&old.video_key!==key?String(old.video_key):null,old?.thumbnail_key&&old.thumbnail_key!==thumbnailKey?String(old.thumbnail_key):null].filter((v):v is string=>!!v);if(unused.length){try{await bucket().delete(unused)}catch{console.error('Old lesson assets could not be removed');}}
}else throw Error('Unknown action');if(action==='lesson'||action==='visibility')revalidateListings();return Response.json({ok:true});}catch(e){return Response.json({error:(e as Error).message||'Unable to save. Please try again.'},{status:400})}}

function newAssetKey(folder:string) {
  const hasStore=process.env.BLOB_READ_WRITE_TOKEN||process.env.BLOB_STORE_ID||process.env.R2_ENDPOINT;
  return (hasStore?'':'classroom-assets/')+folder+'/'+crypto.randomUUID();
}

function revalidateListings(){revalidatePath('/');revalidatePath('/courses');}
