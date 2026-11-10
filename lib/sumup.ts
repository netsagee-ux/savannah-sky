import {createCipheriv,createDecipheriv,createHmac,randomBytes} from 'node:crypto';
import {db,enrolmentOwner} from './server';
import {recordVerifiedPayment,type AcademyOrder} from './course-orders';
import {paidInvitationPath} from './course-invitation';

type Merchant={code:string;key:string};
type Checkout={id:string;checkout_reference:string;amount:number;currency:string;merchant_code:string;status:string};
type SumUpOrder=AcademyOrder & {merchant:string};
const api='https://api.sumup.com';
const settingsId='sumup:merchant:v1';

export class SumUpError extends Error {
  constructor(message:string,readonly status=503){super(message);}
}

async function callSumUp(merchant:Merchant,path:string,method:'GET'|'POST'|'DELETE',body?:object){
  const response=await fetch(api+path,{method,cache:'no-store',redirect:'error',
    signal:AbortSignal.timeout(9000),headers:{Authorization:'Bearer '+merchant.key,...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok)throw new SumUpError('SumUp could not complete this request.',response.status);
  return response;
}
async function request<T>(merchant:Merchant,path:string,body?:object):Promise<T>{
  const response=await callSumUp(merchant,path,body?'POST':'GET',body);
  return response.json() as Promise<T>;
}

function configKey(){
  const secret=process.env.APP_ENCRYPTION_KEY;
  if(!secret)throw new SumUpError('Payment settings are temporarily unavailable.');
  return createHmac('sha256',secret).update(settingsId).digest();
}
function fromEnvironment():Merchant|null{
  return process.env.SUMUP_API_KEY && process.env.SUMUP_MERCHANT_CODE
    ?{code:process.env.SUMUP_MERCHANT_CODE.trim().toUpperCase(),key:process.env.SUMUP_API_KEY.trim()}:null;
}
async function stored():Promise<Merchant|null>{
  const env=fromEnvironment();
  if(env)return env;
  const row=await db().prepare('SELECT value FROM settings WHERE id=?').bind(settingsId).first<{value:string}>();
  if(!row)return null;
  const bytes=Buffer.from(row.value,'base64');
  const cipher=createDecipheriv('aes-256-gcm',configKey(),bytes.subarray(0,12));
  cipher.setAAD(Buffer.from(settingsId));
  cipher.setAuthTag(bytes.subarray(12,28));
  return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString()) as Merchant;
}
async function verifyMerchant(merchant:Merchant){
  const account=await request<{merchant_code:string;sandbox?:boolean;default_currency:string}>(merchant,'/v1/merchants/'+encodeURIComponent(merchant.code));
  if(account.default_currency!=='GBP')throw new SumUpError('Connect the GBP merchant account that receives the academy course fees.',400);
  if(account.merchant_code!==merchant.code || account.sandbox===true)throw new SumUpError('Connect a verified live merchant account to accept course payments.',400);
}

async function verifyCheckoutAccess(merchant:Merchant){
  const reference='setup-'+crypto.randomUUID();
  // This checkout is never processed or presented to a payer. Expiry also covers an interrupted setup.
  const checkout=await request<Checkout>(merchant,'/v0.1/checkouts',{
    checkout_reference:reference,merchant_code:merchant.code,amount:1,currency:'GBP',
    description:'Academy connection check',valid_until:new Date(Date.now()+5*60_000).toISOString(),
  });
  if(!checkout || typeof checkout.id!=='string' || !/^[\w-]{1,128}$/.test(checkout.id) || checkout.checkout_reference!==reference)
    throw new SumUpError('SumUp could not confirm the connection check.');
  const path='/v0.1/checkouts/'+encodeURIComponent(checkout.id);
  try{
    const verified=await request<Checkout>(merchant,path);
    if(verified.id!==checkout.id || verified.checkout_reference!==reference || verified.merchant_code!==merchant.code ||
      verified.amount!==1 || verified.currency!=='GBP' || verified.status!=='PENDING')
      throw new SumUpError('SumUp returned unexpected checkout details.');
  } finally {
    await callSumUp(merchant,path,'DELETE');
  }
}
export async function merchantStatus(){
  const merchant=await stored();
  return {code:merchant?.code??null,fromEnvironment:!!fromEnvironment()};
}
export async function saveMerchant(code:string,key:string){
  if(fromEnvironment())throw new SumUpError('This connection is managed in the hosting settings.',409);
  const merchant={code:code.trim().toUpperCase(),key:key.trim()};
  if(!/^[A-Z0-9]{6,16}$/.test(merchant.code)||!/^sup_sk_[A-Za-z0-9_-]{12,220}$/.test(merchant.key))
    throw new SumUpError('Enter the merchant code and secret API key from your SumUp account.',400);
  const observed=await db().prepare('SELECT value FROM settings WHERE id=?').bind(settingsId).first<{value:string}>();
  const existing=await stored();
  if(existing && existing.code!==merchant.code)throw new SumUpError('Use the existing merchant code when updating its key.',409);
  try {await verifyMerchant(merchant);}
  catch(e){if(e instanceof SumUpError && e.status===400)throw e;throw new SumUpError('SumUp could not verify this merchant. Check the code and the permissions on the API key.',400);}
  const encryptionKey=configKey();
  try {await verifyCheckoutAccess(merchant);}
  catch(e){
    if(e instanceof SumUpError && [401,403].includes(e.status))
      throw new SumUpError('SumUp recognised this account but denied access to online checkouts. Check that online payments are enabled for this merchant and try its live secret API key.',400);
    throw new SumUpError('SumUp could not complete the online checkout check. Please try again.');
  }
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey,iv);
  cipher.setAAD(Buffer.from(settingsId));
  const data=Buffer.concat([cipher.update(JSON.stringify(merchant),'utf8'),cipher.final()]);
  const packed=Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64');
  const saved=observed?await db().prepare('UPDATE settings SET value=? WHERE id=? AND value=?').bind(packed,settingsId,observed.value).run():
    await db().prepare('INSERT OR IGNORE INTO settings(id,value) VALUES(?,?)').bind(settingsId,packed).run();
  if(!saved.meta.changes)throw new SumUpError('Another staff member updated the merchant. Refresh before changing its key.',409);
}
const orderSelect=`SELECT o.*,s.value AS merchant FROM orders o JOIN settings s ON s.id='sumup:order:'||o.id WHERE o.mode='sumup' AND `;
async function orderById(id:string){
  return db().prepare(orderSelect+'o.id=?').bind(id).first<SumUpOrder>();
}
export function checkoutMatches(checkout:Checkout,order:Pick<SumUpOrder,'id'|'merchant'|'amount'|'session_id'>){
  return checkout.checkout_reference===order.id && checkout.merchant_code===order.merchant && checkout.currency==='GBP' &&
    Number.isFinite(checkout.amount) && Math.abs(checkout.amount*100-order.amount)<0.000001 &&
    typeof checkout.id==='string' && /^[a-zA-Z0-9_-]{1,128}$/.test(checkout.id) && (!order.session_id || order.session_id===checkout.id);
}
async function bindCheckout(order:SumUpOrder,checkout:Checkout){
  if(!checkoutMatches(checkout,order))throw new SumUpError('Payment details do not match this order.',409);
  if(!order.session_id){
    const changed=await db().prepare("UPDATE orders SET session_id=? WHERE id=? AND mode='sumup' AND status='pending' AND (session_id IS NULL OR session_id=?)")
      .bind(checkout.id,order.id,checkout.id).run();
    if(!changed.meta.changes && (await orderById(order.id))?.session_id!==checkout.id)throw new SumUpError('Refresh this order before trying again.',409);
  }
}
async function applyStatus(order:SumUpOrder,checkout:Checkout){
  await bindCheckout(order,checkout);
  if(checkout.status==='PAID'){
    await recordVerifiedPayment(order);
    await paidInvitationPath(order.id);
    return 'paid';
  }
  if(['EXPIRED','FAILED','CANCELLED'].includes(checkout.status)){
    await db().prepare("UPDATE orders SET status=? WHERE id=? AND status='pending' AND mode='sumup' AND session_id=?")
      .bind(checkout.status.toLowerCase(),order.id,checkout.id).run();
    return checkout.status.toLowerCase();
  }
  return 'pending';
}

export async function checkoutMerchant(){
  const merchant=await stored();
  if(!merchant)throw new SumUpError('The academy has not connected its SumUp account.');
  if(fromEnvironment())await verifyMerchant(merchant);
  return merchant;
}
export function lookupMerchantCheckout(merchant:Merchant,id:string){
  return request<Checkout>(merchant,'/v0.1/checkouts/'+encodeURIComponent(id));
}
export async function createMerchantCheckout(merchant:Merchant,order:Pick<SumUpOrder,'id'|'merchant'|'amount'|'session_id'>,title:string,origin:string,orderPath:string,webhook:string){
  const base=process.env.ACADEMY_PUBLIC_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://'+process.env.VERCEL_PROJECT_PRODUCTION_URL : origin);
  const callbackOrigin=new URL(base).origin;
  let checkout:Checkout;
  try {
    checkout=await request<Checkout>(merchant,'/v0.1/checkouts',{checkout_reference:order.id,merchant_code:merchant.code,amount:order.amount/100,currency:'GBP',
      description:title,return_url:callbackOrigin+webhook+'?order='+encodeURIComponent(order.id),redirect_url:callbackOrigin+orderPath,
      valid_until:new Date(Date.now()+60*60*1000).toISOString()});
  } catch(error) {
    // A retry may follow a successful remote create whose response was lost.
    if(error instanceof SumUpError && error.status<500 && error.status!==409)throw error;
    const found=await request<Checkout[]>(merchant,'/v0.1/checkouts?checkout_reference='+encodeURIComponent(order.id));
    const previous=found.find(entry=>checkoutMatches(entry,order));
    if(!previous)throw error;
    checkout=previous;
  }
  return checkout;
}

export async function startSumUp(user:{userId:string;email:string},course:{id:string;price:number;title:string},origin:string){
  const merchant=await stored();
  if(!merchant)throw new SumUpError('Online enrolment opens when the academy connects its SumUp account.');
  // Environment credentials can be changed outside the verified staff form.
  if(fromEnvironment())await verifyMerchant(merchant);
  const dbh=db(),id=crypto.randomUUID(),email=user.email.toLowerCase();
  const pending="user_id=? AND course_id=? AND mode='sumup' AND status='pending'";
  await dbh.batch([
    dbh.prepare(`INSERT INTO orders(id,user_id,email,course_id,title,amount,currency,status,mode,created_at)
      SELECT ?,?,?,?,?,?,'gbp','pending','sumup',? WHERE NOT EXISTS(SELECT 1 FROM orders WHERE `+pending+
      ") AND NOT EXISTS(SELECT 1 FROM enrollments e WHERE e.course_id=? AND "+enrolmentOwner+")")
      .bind(id,user.userId,email,course.id,course.title,course.price,new Date().toISOString(),user.userId,course.id,course.id,user.userId),
    dbh.prepare("INSERT INTO settings(id,value) SELECT 'sumup:order:'||id,? FROM orders WHERE id=?").bind(merchant.code,id),
  ]);
  const order=await dbh.prepare(orderSelect+pending).bind(user.userId,course.id).first<SumUpOrder>();
  if(!order)throw new SumUpError('Check My learning for your course.',409);
  if(order.merchant!==merchant.code)throw new SumUpError('Contact the academy about this pending order.',409);
  const orderPath='/orders/'+encodeURIComponent(order.id);
  if(order.session_id)return orderPath;
  const checkout=await createMerchantCheckout(merchant,order,order.title,origin,orderPath,'/api/sumup/webhook');
  await applyStatus(order,checkout);
  return orderPath;
}

export async function syncSumUp(id:string,notifiedCheckout?:string){
  const order=await orderById(id);
  if(!order || (notifiedCheckout && order.session_id && order.session_id!==notifiedCheckout))return null;
  if(order.status!=='pending')return order.status;
  const checkoutId=order.session_id||notifiedCheckout;
  if(!checkoutId)return 'pending';
  const merchant=await stored();
  if(!merchant || order.merchant!==merchant.code)throw new SumUpError('Payment confirmation is temporarily unavailable.');
  if(fromEnvironment())await verifyMerchant(merchant);
  const remote=await request<Checkout>(merchant,'/v0.1/checkouts/'+encodeURIComponent(checkoutId));
  if(remote.id!==checkoutId || !checkoutMatches(remote,order))throw new SumUpError('The payment does not match this order.',409);
  return applyStatus(order,remote);
}

export async function salesSummary(){
  const database=db();
  const shop=await database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='shop_orders'").first();
  const ledgers="SELECT user_id,email,amount,paid_at FROM orders WHERE status='paid' AND mode IN ('live','whatsapp','sumup') AND lower(currency)='gbp'"+
    (shop?" UNION ALL SELECT user_id,email,amount,paid_at FROM shop_orders WHERE status='paid'":"");
  return database.prepare(`WITH payments AS (`+ledgers+`) SELECT COUNT(*) AS sales,COALESCE(SUM(amount),0) AS gross,
    COUNT(DISTINCT CASE WHEN user_id LIKE 'guest/%' OR user_id LIKE 'withdrawn/%'
      THEN COALESCE((SELECT p.user_id FROM payments p WHERE lower(p.email)=lower(o.email)
        AND p.user_id NOT LIKE 'guest/%' AND p.user_id NOT LIKE 'withdrawn/%' ORDER BY p.paid_at DESC LIMIT 1),'email:'||lower(o.email))
      ELSE user_id END) AS customers FROM payments o`).first<{sales:number;gross:number;customers:number}>();
}
