// Private database-backed uploads for installations without a direct Blob upload store.
import {createCipheriv,createDecipheriv,createHmac,createHash,randomBytes} from 'node:crypto';
import {database} from './vercel-database';
import {mediaPartBytes} from './lesson-upload';

type Metadata={size:number;type:string};
let schema:Promise<unknown>|undefined;
function ready(){
  const db=database();
  return schema??=db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS classroom_files (id TEXT PRIMARY KEY,size INTEGER NOT NULL,type TEXT NOT NULL,created_at INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS classroom_parts (file_id TEXT NOT NULL, position INTEGER NOT NULL, digest TEXT NOT NULL, content BLOB NOT NULL, PRIMARY KEY(file_id,position))'),
  ]).catch(error=>{schema=undefined;throw error;});
}
function key(){
  if(!process.env.APP_ENCRYPTION_KEY)throw Error('Private media key unavailable.');
  return createHmac('sha256',process.env.APP_ENCRYPTION_KEY).update('academy/private-media/v1').digest();
}
function seal(id:string,part:number,bytes:Buffer){
  const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',key(),iv);
  cipher.setAAD(Buffer.from(id+'/'+part));
  const data=Buffer.concat([cipher.update(bytes),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),data]);
}
function unseal(id:string,part:number,bytes:Buffer){
  const cipher=createDecipheriv('aes-256-gcm',key(),bytes.subarray(0,12));
  cipher.setAAD(Buffer.from(id+'/'+part));cipher.setAuthTag(bytes.subarray(12,28));
  return Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]);
}
export async function storeMediaPart(id:string,meta:Metadata,part:number,bytes:Buffer){
  await ready();
  const db=database(), digest=createHash('sha256').update(bytes).digest('hex');
  if(part===0){
    // Clear abandoned uploads without touching any referenced video or thumbnail.
    const stale=`SELECT id FROM classroom_files f WHERE created_at<? AND NOT EXISTS(SELECT 1 FROM lessons WHERE video_key=f.id OR thumbnail_key=f.id)
      AND NOT EXISTS(SELECT 1 FROM courses WHERE thumbnail_key=f.id)`;
    const cutoff=Date.now()-7*86400000;
    await db.batch([db.prepare('DELETE FROM classroom_parts WHERE file_id IN ('+stale+')').bind(cutoff),
      db.prepare('DELETE FROM classroom_files WHERE id IN ('+stale+')').bind(cutoff),
      db.prepare('INSERT OR IGNORE INTO classroom_files(id,size,type,created_at) VALUES(?,?,?,?)').bind(id,meta.size,meta.type,Date.now())]);
  }
  const existing=await db.prepare('SELECT size,type FROM classroom_files WHERE id=?').bind(id).first<Metadata>();
  if(!existing || existing.size!==meta.size || existing.type!==meta.type)throw Error('Restart this upload with its original file.');
  const write=await db.prepare('INSERT OR IGNORE INTO classroom_parts(file_id,position,digest,content) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM classroom_files WHERE id=?)')
    .bind(id,part,digest,seal(id,part,bytes),id).run();
  if(!write.meta.changes){
    const previous=await db.prepare('SELECT digest FROM classroom_parts WHERE file_id=? AND position=?').bind(id,part).first<{digest:string}>();
    if(previous?.digest!==digest)throw Error('The uploaded file changed. Choose it again.');
  }
}
export async function classroomHead(id:string){
  await ready();
  return database().prepare(`SELECT size,type FROM classroom_files f WHERE id=? AND
    (SELECT COUNT(*) FROM classroom_parts WHERE file_id=f.id)=CAST((size+?-1)/? AS INTEGER)`).bind(id,mediaPartBytes,mediaPartBytes).first<Metadata>();
}
export async function classroomGet(id:string,options?:{range:{offset:number;length:number}}){
  const file=await classroomHead(id);
  if(!file)return null;
  const offset=options?.range.offset??0, end=offset+(options?.range.length??file.size);
  let part=Math.floor(offset/mediaPartBytes);
  return {size:file.size,writeHttpMetadata:(h:Headers)=>h.set('Content-Type',file.type),body:new ReadableStream<Uint8Array>({
    async pull(controller){
      if(part*mediaPartBytes>=end){controller.close();return;}
      const row=await database().prepare('SELECT content FROM classroom_parts WHERE file_id=? AND position=?').bind(id,part).first<{content:ArrayBuffer}>();
      if(!row)throw Error('Private recording unavailable.');
      const data=unseal(id,part,Buffer.from(row.content)), start=part++*mediaPartBytes;
      controller.enqueue(data.subarray(Math.max(0,offset-start),Math.min(data.length,end-start)));
    },
  })};
}
export async function classroomDelete(id:string){
  await ready();
  const db=database();
  await db.batch([db.prepare('DELETE FROM classroom_parts WHERE file_id=?').bind(id),db.prepare('DELETE FROM classroom_files WHERE id=?').bind(id)]);
}
