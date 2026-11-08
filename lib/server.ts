import {database} from './vercel-database';
import {objectStorage} from './vercel-storage';
const env=process.env;
import {getChatGPTUser} from '@/app/chatgpt-auth';
export function db(){return database();}
export function bucket(){return objectStorage();}
export async function admin(){const u=await getChatGPTUser();const allowed=((env as unknown as {ADMIN_EMAIL?:string}).ADMIN_EMAIL||'Netsagee@gmail.com');return !!u&&!!allowed&&u.email.toLowerCase()===allowed.toLowerCase();}
// An order-backed enrolment follows the verified buyer, including after an email change.
export const enrolmentOwner = `(e.id='buyer/'||?||'/'||e.course_id OR
 (e.id NOT LIKE 'buyer/%' AND (EXISTS (SELECT 1 FROM orders o WHERE o.email=e.email AND o.course_id=e.course_id AND o.status='paid' AND o.mode IN ('live','whatsapp') AND o.user_id=?) OR
 (e.email=? AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.email=e.email AND o.course_id=e.course_id AND o.status='paid' AND o.mode IN ('live','whatsapp'))))))`;
export async function enrolled(courseId:string) {
 const user=await getChatGPTUser();
 if(!user)return false;
 if(await admin())return true;
 return Boolean(await db().prepare('SELECT e.id FROM enrollments e WHERE e.course_id=? AND '+enrolmentOwner)
  .bind(courseId,user.userId,user.userId,user.email.toLowerCase()).first());
}
export async function catalog(){return (await db().prepare('SELECT c.id,c.title,c.description,c.level,c.price,c.outcomes,c.requirements,c.duration,c.access_policy,c.published,CASE WHEN c.thumbnail_key IS NOT NULL THEN c.id ELSE NULL END AS thumbnail_key, (SELECT l.id FROM lessons l WHERE l.course_id=c.id AND l.thumbnail_key IS NOT NULL ORDER BY l.position,l.id LIMIT 1) AS thumbnail_id FROM courses c WHERE c.published = 1').all()).results;}
