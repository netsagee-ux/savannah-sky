import {database} from './vercel-database';
import {objectStorage} from './vercel-storage';
import {createHash} from 'node:crypto';
import {getChatGPTUser} from '@/app/chatgpt-auth';
export function db(){return database();}
export function bucket(){return objectStorage();}
// Match the academy co-owner's verified address without publishing their inbox.
const academyCoOwnerDigest='bb3bfec9796f93955bd0642392bd948619ce4dcb0aac8f6ba6c9b7bfb4038a4f';

export function isSalonOwner(address:string) {
  return createHash('sha256').update(address.trim().toLowerCase()).digest('hex')===academyCoOwnerDigest;
}

const handoverKey='academy:owner-handover';
export async function handoverComplete() {
  return Boolean(await db().prepare('SELECT id FROM settings WHERE id=?').bind(handoverKey).first());
}
export async function completeOwnerHandover() {
  const user=await getChatGPTUser();
  if(!user || !isSalonOwner(user.email))return false;
  await db().prepare('INSERT OR IGNORE INTO settings(id,value) VALUES(?,?)')
    .bind(handoverKey,JSON.stringify({owner:user.userId,completed:new Date().toISOString()})).run();
  return true;
}
export async function isOwnerEmail(address:string) {
  if(isSalonOwner(address))return true;
  if(address.trim().toLowerCase()!=='netsagee@gmail.com')return false;
  return !await handoverComplete();
}
export async function admin(){
  const user=await getChatGPTUser();
  return user ? isOwnerEmail(user.email) : false;
}
// Both the paid order and its active enrolment must belong to this learner.
// Match older email-keyed enrolments through the original buyer's paid order.
export const enrolmentOwner = `EXISTS (
 SELECT 1 FROM orders paid WHERE paid.user_id=? AND paid.course_id=e.course_id
 AND paid.status='paid' AND paid.amount>0 AND paid.mode IN ('sumup','live','whatsapp')
 AND (e.id='buyer/'||paid.user_id||'/'||paid.course_id OR
      (e.id NOT LIKE 'buyer/%' AND e.email=paid.email)))`;
export async function enrolled(courseId:string) {
 const user=await getChatGPTUser();
 if(!user)return false;
 if(await isOwnerEmail(user.email))return true;
 return Boolean(await db().prepare('SELECT e.id FROM enrollments e WHERE e.course_id=? AND '+enrolmentOwner)
  .bind(courseId,user.userId).first());
}
export async function catalog(){return (await db().prepare(`SELECT c.id,c.title,c.description,c.level,c.price,
 (SELECT value FROM settings WHERE id='cpd:'||c.id) AS cpd,
 CASE WHEN c.thumbnail_key IS NOT NULL THEN c.id END AS thumbnail_key,
 (SELECT l.id FROM course_lessons l WHERE l.course_id=c.id AND l.thumbnail_key IS NOT NULL ORDER BY l.position,l.id LIMIT 1) AS thumbnail_id
 FROM courses c WHERE c.published=1 AND NOT EXISTS(SELECT 1 FROM settings s WHERE s.id='course-format:'||c.id AND s.value='online') ORDER BY c.rowid`).all()).results;}
