import {getChatGPTUser} from '@/app/chatgpt-auth';
import {admin,bucket,db} from '@/lib/server';
import {isConversion} from '@/lib/data';
import {qualificationKey,type Qualification} from '@/lib/qualifications';
import {imageContentType} from '@/lib/video-security';
const reply=(data:object,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private,no-store'}});
export async function GET(req:Request){
  if(!await admin())return reply({error:'Staff access required.'},403);
  const id=new URL(req.url).searchParams.get('id'),database=db();
  if(!id){
    const rows=await database.prepare("SELECT id,value FROM settings WHERE id LIKE 'qualification:%' AND json_extract(value,'$.status')='pending' ORDER BY rowid LIMIT 200").all<{id:string;value:string}>();
    return reply({requests:rows.results.map(r=>{const q=JSON.parse(r.value) as Qualification;return {id:r.id,course:q.course,email:q.email};})});
  }
  if(!/^qualification:[a-f0-9]{64}$/.test(id))return reply({error:'Invalid request.'},400);
  const row=await database.prepare('SELECT value FROM settings WHERE id=?').bind(id).first<{value:string}>();
  const q:Qualification|null=row?JSON.parse(row.value):null;
  if(!q?.proof||q.status!=='pending')return new Response(null,{status:404});
  const file=await bucket().get(q.proof);if(!file)return new Response(null,{status:404});
  return new Response(file.body as BodyInit,{headers:{'Content-Type':q.mime||'application/octet-stream','Content-Disposition':'attachment; filename="qualification.'+(q.mime==='application/pdf'?'pdf':q.mime==='image/png'?'png':'jpg')+'"','X-Content-Type-Options':'nosniff','Cache-Control':'private,no-store'}});
}
export async function POST(req:Request){
  if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Invalid origin.'},403);
  const user=await getChatGPTUser();if(!user)return reply({error:'Sign in first.'},401);
  if(Number(req.headers.get('content-length')||0)>3*1024*1024)return reply({error:'Choose a file up to 2 MB.'},413);
  try{
    const f=await req.formData(),action=String(f.get('action')),database=db();
    if(action==='approve'||action==='resubmit'){
      if(!await admin())return reply({error:'Staff access required.'},403);
      const id=String(f.get('id'));if(!/^qualification:[a-f0-9]{64}$/.test(id))return reply({error:'Invalid request.'},400);
      const row=await database.prepare('SELECT value FROM settings WHERE id=?').bind(id).first<{value:string}>();
      if(!row)return reply({error:'Request not found.'},404);
      const q:Qualification=JSON.parse(row.value);if(q.status!=='pending')return reply({error:'Request already reviewed.'},409);
      const next={course:q.course,email:q.email,status:action==='approve'?'approved':'resubmit'};
      const result=await database.prepare('UPDATE settings SET value=? WHERE id=? AND value=?').bind(JSON.stringify(next),id,row.value).run();
      if(!result.meta.changes)return reply({error:'Refresh the requests.'},409);
      if(q.proof)await bucket().delete(q.proof).catch(()=>console.error('Qualification file cleanup pending'));
      return reply({ok:true});
    }
    if(action!=='submit')return reply({error:'Choose an action.'},400);
    const courseId=String(f.get('courseId')),course=await database.prepare('SELECT id,title,level FROM courses WHERE id=? AND published=1').bind(courseId).first<{id:string;title:string;level:string}>();
    if(!course||!isConversion(course))return reply({error:'Select a published conversion course.'},400);
    const id=qualificationKey(courseId,user.userId),old=await database.prepare('SELECT value FROM settings WHERE id=?').bind(id).first<{value:string}>();
    if(old&&JSON.parse(old.value).status!=='resubmit')return reply({error:'Your qualification has already been submitted.'},409);
    const file=f.get('proof');if(!(file instanceof File)||!file.size||file.size>2*1024*1024)return reply({error:'Choose a JPG, PNG or PDF up to 2 MB.'},400);
    const bytes=await file.arrayBuffer(),data=new Uint8Array(bytes);
    const mime=Buffer.from(data.subarray(0,5)).toString()==='%PDF-'?'application/pdf':imageContentType(data);
    if(!mime||!['image/jpeg','image/png','application/pdf'].includes(mime))return reply({error:'Use a JPG, PNG or PDF.'},400);
    const proof='classroom-assets/qualifications/'+crypto.randomUUID();await bucket().put(proof,bytes,{httpMetadata:{contentType:mime}});
    const value=JSON.stringify({course:course.title,email:user.email,status:'pending',proof,mime});
    try{const saved=old?await database.prepare('UPDATE settings SET value=? WHERE id=? AND value=?').bind(value,id,old.value).run():
      await database.prepare('INSERT OR IGNORE INTO settings(id,value) VALUES(?,?)').bind(id,value).run();
      if(!saved.meta.changes){await bucket().delete(proof);return reply({error:'A submission already exists.'},409);}
    }catch(e){await bucket().delete(proof);throw e;}
    return reply({ok:true});
  }catch{return reply({error:'Unable to save the qualification. Please try again.'},503);}
}
