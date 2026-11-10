const env=process.env;
import {bucket,db} from './server';
import {recordVerifiedPayment,type AcademyOrder} from './course-orders';
import {validPaidSession} from './payment-security';
const runtime=env as unknown as {APP_ENCRYPTION_KEY?:string;PUBLIC_PAYMENTS_READY?:string};
async function encryptionKey(){if(!runtime.APP_ENCRYPTION_KEY)throw Error('Payment configuration storage is not ready.');return crypto.subtle.importKey('raw',Uint8Array.from(atob(runtime.APP_ENCRYPTION_KEY),c=>c.charCodeAt(0)),'AES-GCM',false,['encrypt','decrypt']);}
export async function savePaymentConfig(value:object){const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await encryptionKey(),new TextEncoder().encode(JSON.stringify(value)));const payload=JSON.stringify({iv:Array.from(iv),data:Array.from(new Uint8Array(encrypted))});await db().prepare('INSERT INTO settings(id,value) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').bind('stripe',payload).run();}
export async function paymentConfig():Promise<{secret:string;webhook:string;mode:string;account:string}|null>{if(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_WEBHOOK_SECRET){return {secret:process.env.STRIPE_SECRET_KEY,webhook:process.env.STRIPE_WEBHOOK_SECRET,mode:process.env.STRIPE_SECRET_KEY.startsWith('sk_live_')?'live':'test',account:'Environment configuration'}}const row=await db().prepare('SELECT value FROM settings WHERE id=?').bind('stripe').first<{value:string}>();if(!row)return null;const p=JSON.parse(row.value);const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(p.iv)},await encryptionKey(),new Uint8Array(p.data));return JSON.parse(new TextDecoder().decode(bytes));}
export async function stripe(path:string,secret:string,body?:URLSearchParams,idempotency?:string){const response=await fetch('https://api.stripe.com/v1/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+secret,...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(idempotency?{'Idempotency-Key':idempotency}:{})},body});const result:any=await response.json();if(!response.ok)throw Error('Stripe could not process this request. Check account configuration and try again.');return result;}
export function hasCoursePrice(price: number | null): price is number {
 return typeof price === 'number' && Number.isInteger(price) && price >= 50;
}

export async function hasCourseDelivery(course: { id: string; course_url?: string | null }) {
 if (!process.env.APP_ENCRYPTION_KEY) return false;
 const videos=await db().prepare(
  "SELECT video_key FROM lessons WHERE course_id=? AND NULLIF(TRIM(video_key),'') IS NOT NULL ORDER BY position,id"
 ).bind(course.id).all<{video_key:string}>();
 for(const lesson of videos.results) {
  if((await bucket().head(lesson.video_key))?.size) return true;
 }
 if (videos.results.length) return false;
 // Reading and quiz courses are deliverable without a video upload. An old
 // external recording link is not a private lesson that we can sell access to.
 const lecture = await db().prepare(`SELECT id FROM lessons WHERE course_id=?
   AND NULLIF(TRIM(video_url),'') IS NULL
   AND (NULLIF(TRIM(body),'') IS NOT NULL OR NULLIF(TRIM(question),'') IS NOT NULL OR EXISTS(SELECT 1 FROM settings WHERE id GLOB 'lesson-photo/'||lessons.id||'/*')) LIMIT 1`)
   .bind(course.id).first();
 return Boolean(lecture);
}

export async function fulfill(session: {id: string}) {
 const order = await db().prepare('SELECT * FROM orders WHERE session_id=?').bind(session.id).first<AcademyOrder>();
 if (!order || !['live','test'].includes(order.mode) || !['pending','paid'].includes(order.status) || !validPaidSession(session,order)) return false;
 await recordVerifiedPayment(order);
 return true;
}
