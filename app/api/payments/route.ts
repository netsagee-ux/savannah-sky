import {saveMerchant,merchantStatus,syncSumUp} from '@/lib/sumup';
import {paidInvitationPath} from '@/lib/course-invitation';
import {receiptsConfigured,sendOrderReceipt} from '@/lib/order-receipt';
import {confirmManualPayment,coursePassword} from '@/lib/course-orders';import {admin,db,owner,staffEmail} from '@/lib/server';
import {paymentConfig,stripe,fulfill} from '@/lib/payments';
export async function GET(request:Request) {
  if(!await admin()) return Response.json({error:'Administrator access required'},{status:403});
  try {
    const term=new URL(request.url).searchParams.get('order')?.trim().toLowerCase().slice(0,254);
    const query=db().prepare(`SELECT o.id,o.email,o.title,o.amount,o.status,o.mode,o.created_at,o.paid_at,
      (o.user_id LIKE 'guest/%' AND o.status='paid' AND o.mode='whatsapp') AS awaitingClaim,
      EXISTS(SELECT 1 FROM enrollments e WHERE e.course_id=o.course_id AND
        (e.id='buyer/'||o.user_id||'/'||o.course_id OR (e.id NOT LIKE 'buyer/%' AND e.email=o.email
          AND o.user_id NOT LIKE 'guest/%' AND o.user_id NOT LIKE 'withdrawn/%'))) AS accessActive,
      EXISTS(SELECT 1 FROM settings s WHERE s.id='order_receipt:'||o.id) AS receiptSent
      FROM orders o `+(term?'WHERE o.id=? OR o.email=? ':'')+'ORDER BY o.created_at DESC LIMIT 200');
    const orders=await (term?query.bind(term,term):query).all();
    return Response.json({receiptConfigured:receiptsConfigured(),merchant:await merchantStatus(),staffEmail:await staffEmail(),canManageStaff:await owner(),orders:orders.results},
      {headers:{'Cache-Control':'private, no-store'}});
  } catch {return Response.json({error:'Payment settings are temporarily unavailable.'},{status:503});}
}
export async function POST(req:Request){if(!await admin())return Response.json({error:'Administrator access required'},{status:403});if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Invalid origin'},{status:403});try{const body:any=await req.json();if(body.action==='connect-sumup'){
 await saveMerchant(String(body.code||''),String(body.key||''));
 return Response.json({ok:true,message:'Your SumUp merchant account is connected.'});
}
if(body.action==='staff-access'){
 if(!await owner())return Response.json({error:'Only the academy owner can manage staff access.'},{status:403});
 const email=String(body.email||'').trim().toLowerCase();
 if(email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254))throw Error('Enter a valid staff email address.');
 await db().prepare("INSERT INTO settings(id,value) VALUES('academy_staff_email',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value").bind(email).run();
 return Response.json({ok:true,message:email?'Staff access saved. Sign in with that verified email.':'Staff access removed.'});
}
if(body.action==='verify-sumup'){
 const status=await syncSumUp(String(body.id));
 if(!status)throw Error('SumUp order not found.');
 return Response.json({ok:true,message:'SumUp payment status: '+status});
}
if(body.action==='course-password'){
 const path=await paidInvitationPath(String(body.id));
 if(!path) return Response.json({error:'Confirm the payment and active invitation first.'},{status:409});
 const password=await coursePassword(String(body.id));
 return Response.json({password,path},{headers:{'Cache-Control':'private, no-store'}});
}
if(body.action==='quote'){
 const pounds=String(body.price||'').trim();
 if(!/^\d{1,5}(?:\.\d{1,2})?$/.test(pounds))throw Error('Enter a GBP fee.');
 const amount=Math.round(Number(pounds)*100);
 if(amount<50||amount>1000000)throw Error('Enter a fee between £0.50 and £10,000.');
 const change=await db().prepare("UPDATE orders SET amount=?,status='pending' WHERE id=? AND mode='whatsapp' AND status='requested'").bind(amount,String(body.id)).run();
 if(!change.meta.changes)throw Error('Refresh the order before setting its fee.');
 return Response.json({ok:true,message:'Historical order fee saved.'});
}
if(body.action==='withdraw-claim'){
 const change=await db().prepare("UPDATE orders SET user_id='withdrawn/'||id WHERE id=? AND user_id LIKE 'guest/%' AND status='paid' AND mode='whatsapp'").bind(String(body.id)).run();
 if(!change.meta.changes)throw Error('Refresh this order. If the student has signed in, revoke access in Students.');
 return Response.json({ok:true,message:'Course invitation withdrawn.'});
}
if(body.action==='confirm-whatsapp'){
 const id=String(body.id);
 const receipt=await confirmManualPayment(id);
 await paidInvitationPath(id);
 return Response.json({ok:true,message:receipt==='sent'?'Payment confirmed. The confirmation email was accepted for sending.':'Payment confirmed. The private course link is ready.'});
}
if(body.action==='send-receipt'){
 const result=await sendOrderReceipt(String(body.id));
 if(result!=='sent')throw Error(result==='ineligible'?'Choose a confirmed live order.':result==='unconfigured'?'Configure the receipt sender first.':'Email could not be confirmed. Course access is active. Retry the email.');
 return Response.json({ok:true,message:'The confirmation email was accepted for sending.'});
}
if(body.action==='reconcile'){const c=await paymentConfig();if(!c)throw Error('Connect Stripe first.');const order:any=await db().prepare('SELECT * FROM orders WHERE id=?').bind(String(body.id)).first();if(!order?.session_id)throw Error('This order has no payment session.');if(order.mode!==c.mode)throw Error('Reconnect the matching Stripe mode first.');const session=await stripe('checkout/sessions/'+encodeURIComponent(order.session_id),c.secret);if(order.mode==='live' && order.status==='pending' && session.status==='expired' && session.payment_status==='unpaid'){
  await db().prepare("UPDATE orders SET status='expired' WHERE id=? AND mode='live' AND status='pending' AND session_id=?").bind(order.id,order.session_id).run();
  return Response.json({ok:true,message:'The earlier checkout expired. The student can start a new payment on the course page.'});
}if(!await fulfill(session))throw Error('Stripe has not confirmed a matching successful payment.');return Response.json({ok:true});}
return Response.json({error:'Unknown payment action.'},{status:400});
}catch(e){return Response.json({error:(e as Error).message},{status:400});}}
