import {receiptsConfigured,sendOrderReceipt} from '@/lib/order-receipt';
import {academyWhatsApp,internationalNumber,confirmManualPayment,coursePassword} from '@/lib/course-orders';import {admin,db} from '@/lib/server';
import {paymentConfig,savePaymentConfig,stripe,publicPaymentsReady,fulfill} from '@/lib/payments';
export async function GET(request:Request) {
  if(!await admin()) return Response.json({error:'Administrator access required'},{status:403});
  try {
    const config=await paymentConfig();
    const term=new URL(request.url).searchParams.get('order')?.trim().toLowerCase().slice(0,254);
    const query=db().prepare(`SELECT o.id,o.email,o.title,o.amount,o.status,o.mode,o.created_at,o.paid_at,
      (SELECT s.value FROM settings s WHERE s.id='order_callback:'||o.id) AS callback,
      (o.user_id LIKE 'guest/%' AND o.status='paid' AND o.mode='whatsapp') AS awaitingClaim,
      EXISTS(SELECT 1 FROM enrollments e WHERE e.course_id=o.course_id AND
        (e.id='buyer/'||o.user_id||'/'||o.course_id OR (e.id NOT LIKE 'buyer/%' AND e.email=o.email
          AND o.user_id NOT LIKE 'guest/%' AND o.user_id NOT LIKE 'withdrawn/%'))) AS accessActive,
      EXISTS(SELECT 1 FROM settings s WHERE s.id='order_receipt:'||o.id) AS receiptSent
      FROM orders o `+(term?'WHERE o.id=? OR o.email=? ':'')+'ORDER BY o.created_at DESC LIMIT 200');
    const orders=await (term?query.bind(term,term):query).all();
    return Response.json({receiptConfigured:receiptsConfigured(),whatsapp:await academyWhatsApp(),connected:!!config,
      mode:config?.mode,account:config?.account,webhookConfigured:!!config?.webhook,publicReady:publicPaymentsReady(),orders:orders.results},
      {headers:{'Cache-Control':'private, no-store'}});
  } catch {return Response.json({error:'Payment settings are temporarily unavailable.'},{status:503});}
}
export async function POST(req:Request){if(!await admin())return Response.json({error:'Administrator access required'},{status:403});if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Invalid origin'},{status:403});try{const body:any=await req.json();if(body.action==='whatsapp'){const number=internationalNumber(String(body.number||''));if(!number)throw Error('Enter the business WhatsApp number with its country code.');await db().prepare("INSERT INTO settings(id,value) VALUES ('academy_whatsapp',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value").bind(number).run();return Response.json({ok:true});}
if(body.action==='course-password'){
 const password=await coursePassword(String(body.id));
 return Response.json({password},{headers:{'Cache-Control':'private, no-store'}});
}
if(body.action==='quote'){
 const pounds=String(body.price||'').trim();
 if(!/^\d{1,5}(?:\.\d{1,2})?$/.test(pounds))throw Error('Enter a GBP fee.');
 const amount=Math.round(Number(pounds)*100);
 if(amount<50||amount>1000000)throw Error('Enter a fee between £0.50 and £10,000.');
 const change=await db().prepare("UPDATE orders SET amount=?,status='pending' WHERE id=? AND mode='whatsapp' AND status='requested'").bind(amount,String(body.id)).run();
 if(!change.meta.changes)throw Error('Refresh the order before setting its fee.');
 return Response.json({ok:true,message:'Fee saved. Send the payment details to the student on WhatsApp.'});
}
if(body.action==='withdraw-claim'){
 const change=await db().prepare("UPDATE orders SET user_id='withdrawn/'||id WHERE id=? AND user_id LIKE 'guest/%' AND status='paid' AND mode='whatsapp'").bind(String(body.id)).run();
 if(!change.meta.changes)throw Error('Refresh this order. If the student has signed in, revoke access in Students.');
 return Response.json({ok:true,message:'Course invitation withdrawn.'});
}
if(body.action==='confirm-whatsapp'){
 const receipt=await confirmManualPayment(String(body.id));
 return Response.json({ok:true,message:receipt==='sent'?'Payment confirmed. The confirmation email was accepted for sending.':'Payment confirmed. Copy the course link into the buyer’s WhatsApp chat.'});
}
if(body.action==='send-receipt'){
 const result=await sendOrderReceipt(String(body.id));
 if(result!=='sent')throw Error(result==='ineligible'?'Choose a confirmed live order.':result==='unconfigured'?'Configure the receipt sender first.':'Email could not be confirmed. Course access is active. Retry the email.');
 return Response.json({ok:true,message:'The confirmation email was accepted for sending.'});
}
if(body.action==='reconcile'){const c=await paymentConfig();if(!c)throw Error('Connect Stripe first.');const order:any=await db().prepare('SELECT * FROM orders WHERE id=?').bind(String(body.id)).first();if(!order?.session_id)throw Error('This order has no payment session.');if(order.mode!==c.mode)throw Error('Reconnect the matching Stripe mode first.');const session=await stripe('checkout/sessions/'+encodeURIComponent(order.session_id),c.secret);if(!await fulfill(session))throw Error('Stripe has not confirmed a matching successful payment.');return Response.json({ok:true});}
if(body.action==='disconnect'){await db().prepare('DELETE FROM settings WHERE id=?').bind('stripe').run();return Response.json({ok:true});}
const old=await paymentConfig();const secret=String(body.secret||old?.secret||'').trim(),webhook=String(body.webhook||old?.webhook||'').trim();if(!/^sk_(test|live)_[A-Za-z0-9]+$/.test(secret))throw Error('Enter a valid Stripe secret key.');if(!/^whsec_[A-Za-z0-9]+$/.test(webhook))throw Error('Enter the webhook signing secret.');const account=await stripe('account',secret);if(old&&secret!==old.secret&&!body.webhook)throw Error('When changing the API key, enter its matching webhook secret too.');await savePaymentConfig({secret,webhook,mode:secret.startsWith('sk_live_')?'live':'test',account:account.business_profile?.name||account.id});return Response.json({ok:true});}catch(e){return Response.json({error:(e as Error).message},{status:400});}}
