const env=process.env;
import {db} from './server';
import {validPaidSession} from './payment-security';
const runtime=env as unknown as {APP_ENCRYPTION_KEY?:string;PUBLIC_PAYMENTS_READY?:string};
async function encryptionKey(){if(!runtime.APP_ENCRYPTION_KEY)throw Error('Payment configuration storage is not ready.');return crypto.subtle.importKey('raw',Uint8Array.from(atob(runtime.APP_ENCRYPTION_KEY),c=>c.charCodeAt(0)),'AES-GCM',false,['encrypt','decrypt']);}
export async function savePaymentConfig(value:object){const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await encryptionKey(),new TextEncoder().encode(JSON.stringify(value)));const payload=JSON.stringify({iv:Array.from(iv),data:Array.from(new Uint8Array(encrypted))});await db().prepare('INSERT INTO settings(id,value) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').bind('stripe',payload).run();}
export async function paymentConfig():Promise<{secret:string;webhook:string;mode:string;account:string}|null>{if(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_WEBHOOK_SECRET){return {secret:process.env.STRIPE_SECRET_KEY,webhook:process.env.STRIPE_WEBHOOK_SECRET,mode:process.env.STRIPE_SECRET_KEY.startsWith('sk_live_')?'live':'test',account:'Environment configuration'}}const row=await db().prepare('SELECT value FROM settings WHERE id=?').bind('stripe').first<{value:string}>();if(!row)return null;const p=JSON.parse(row.value);const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(p.iv)},await encryptionKey(),new Uint8Array(p.data));return JSON.parse(new TextDecoder().decode(bytes));}
export async function stripe(path:string,secret:string,body?:URLSearchParams,idempotency?:string){const response=await fetch('https://api.stripe.com/v1/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+secret,...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(idempotency?{'Idempotency-Key':idempotency}:{})},body});const result:any=await response.json();if(!response.ok)throw Error('Stripe could not process this request. Check account configuration and try again.');return result;}
export function publicPaymentsReady(){return runtime.PUBLIC_PAYMENTS_READY==='true';}
export async function fulfill(session:any){const order:any=await db().prepare('SELECT * FROM orders WHERE session_id=?').bind(session.id).first();if(!order||!validPaidSession(session,order))return false;if(order.status==='paid')return true;
 // A single D1 transaction makes payment recording and access activation atomic.
 const statements=[];
 // Insert before updating within the transaction, and only for a still-pending order.
 if(order.mode==='live')statements.push(db().prepare("INSERT OR IGNORE INTO enrollments(id,email,course_id) SELECT ?,?,? FROM orders WHERE id=? AND status='pending'").bind(order.email+':'+order.course_id,order.email,order.course_id,order.id));
 statements.push(db().prepare("UPDATE orders SET status='paid',paid_at=? WHERE id=? AND status='pending'").bind(new Date().toISOString(),order.id));
 await db().batch(statements);return true;
}
