import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
export function db(){if(!env.DB)throw new Error('Storage unavailable');return env.DB;}
export function bucket(){return (env as unknown as {BUCKET:R2Bucket}).BUCKET;}
export async function admin(){const u=await getChatGPTUser();const allowed=(env as unknown as {ADMIN_EMAIL?:string}).ADMIN_EMAIL;return !!u&&!!allowed&&u.email.toLowerCase()===allowed.toLowerCase();}
export async function enrolled(courseId:string){const u=await getChatGPTUser();if(!u)return false;if(await admin())return true;return !!await db().prepare('SELECT id FROM enrollments WHERE email = ? AND course_id = ?').bind(u.email.toLowerCase(),courseId).first();}
export async function catalog(){return (await db().prepare('SELECT c.id,c.title,c.description,c.level,c.price,c.payment_url,c.outcomes,c.requirements,c.duration,c.access_policy,c.published,CASE WHEN c.thumbnail_key IS NOT NULL THEN c.id ELSE NULL END AS thumbnail_key, (SELECT l.id FROM lessons l WHERE l.course_id=c.id AND l.thumbnail_key IS NOT NULL ORDER BY l.position,l.id LIMIT 1) AS thumbnail_id FROM courses c WHERE c.published = 1').all()).results;}
