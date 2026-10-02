export function safeHttps(value:string):string|null {
 if(!value)return null;
 let u:URL;try{u=new URL(value)}catch{throw Error('Enter a valid HTTPS link.');}
 if(u.protocol!=='https:'||u.username||u.password||value.length>2000)throw Error('Use an HTTPS link without embedded credentials.');
 return u.href;
}
export async function verifySignature(body:string,header:string,secret:string,now=Date.now()):Promise<boolean>{
 const parts=header.split(',').map(v=>v.split('='));const ts=parts.find(p=>p[0]==='t')?.[1];
 if(!ts||!/^\d+$/.test(ts)||Math.abs(now/1000-Number(ts))>300)return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 for(const [type,sig] of parts){if(type!=='v1'||!sig||!/^[a-f0-9]{64}$/i.test(sig))continue;
 const bytes=Uint8Array.from(sig.match(/../g)!,x=>parseInt(x,16));
 if(await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(ts+'.'+body)))return true;
 }return false;
}
export function validPaidSession(session:any,order:any){return session.id===order.session_id&&session.payment_status==='paid'&&session.status==='complete'&&session.amount_total===order.amount&&session.currency===order.currency&&session.metadata?.orderId===order.id&&session.metadata?.courseId===order.course_id&&session.customer_email?.toLowerCase()===order.email&&session.livemode===(order.mode==='live');}
