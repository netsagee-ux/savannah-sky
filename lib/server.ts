import {database} from './vercel-database';
import {objectStorage} from './vercel-storage';
import {createHash} from 'node:crypto';
import {getChatGPTUser} from '@/app/chatgpt-auth';
export function db(){return database();}
export function bucket(){return objectStorage();}
// Match the academy co-owner's verified address without publishing their inbox.
const academyCoOwnerDigest='bb3bfec9796f93955bd0642392bd948619ce4dcb0aac8f6ba6c9b7bfb4038a4f';

export function isOwnerEmail(address:string){
 const email=address.trim().toLowerCase();
 if(!email)return false;
 return email==='netsagee@gmail.com' || createHash('sha256').update(email).digest('hex')===academyCoOwnerDigest;
}
export async function admin(){
 const user=await getChatGPTUser();
 return Boolean(user && isOwnerEmail(user.email));
}
// An order-backed enrolment follows the verified buyer, including after an email change.
export const enrolmentOwner = `(e.id='buyer/'||?||'/'||e.course_id OR
 (e.id NOT LIKE 'buyer/%' AND (EXISTS (SELECT 1 FROM orders o WHERE o.email=e.email AND o.course_id=e.course_id AND o.status='paid' AND o.mode IN ('live','whatsapp','sumup') AND o.user_id=?) OR
 (e.email=? AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.email=e.email AND o.course_id=e.course_id AND o.status='paid' AND o.mode IN ('live','whatsapp','sumup') AND o.user_id NOT LIKE 'guest/%' AND o.user_id NOT LIKE 'withdrawn/%')))))`;
export async function enrolled(courseId:string) {
 const user=await getChatGPTUser();
 if(!user)return false;
 if(await admin())return true;
 return Boolean(await db().prepare('SELECT e.id FROM enrollments e WHERE e.course_id=? AND '+enrolmentOwner)
  .bind(courseId,user.userId,user.userId,user.email.toLowerCase()).first());
}
export async function catalog(){return (await db().prepare(`SELECT c.id,c.title,c.description,c.level,c.price,
 (SELECT value FROM settings WHERE id='cpd:'||c.id) AS cpd,
 CASE WHEN c.thumbnail_key IS NOT NULL THEN c.id END AS thumbnail_key,
 (SELECT l.id FROM lessons l WHERE l.course_id=c.id AND l.thumbnail_key IS NOT NULL ORDER BY l.position,l.id LIMIT 1) AS thumbnail_id
 FROM courses c WHERE c.published=1 ORDER BY c.rowid`).all()).results;}
