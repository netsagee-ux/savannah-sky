// Direct PayPal Checkout. Only server routes can read merchant credentials.
import {createCipheriv,createDecipheriv,createHmac,randomBytes} from 'node:crypto';
import {db} from './server';

const configId='paypal:business:v1';
const base='https://api-m.paypal.com';
const validId=(value:unknown):value is string=>typeof value==='string' && /^[A-Za-z0-9]{8,32}$/.test(value);
type Credentials={client:string;secret:string;merchant:string};
export type PayPalPurchase={kind:"course"|"shop";id:string;amount:number;merchant:string;session_id:string|null;created_at:string};
type Money={currency_code:string;value:string};
type Capture={id:string;status:string;amount:Money;final_capture?:boolean};
type Remote={id:string;status:string;intent:string;purchase_units:{reference_id:string;custom_id?:string;payee:{merchant_id:string};amount:Money;payments?:{captures?:Capture[]}}[];links?:{rel:string;href:string}[]};
type Shipping={name:string;street:string;line2:string;town:string;postcode:string};
export class PayPalError extends Error {constructor(message:string,readonly status=503){super(message);}}
const money=(pence:number)=>(pence/100).toFixed(2);
const moneyMatches=(value:Money|undefined,pence:number)=>value?.currency_code==='GBP' && value.value===money(pence);
const key=()=>{if(!process.env.APP_ENCRYPTION_KEY)throw new PayPalError('Payment settings are temporarily unavailable.');return createHmac('sha256',process.env.APP_ENCRYPTION_KEY).update(configId).digest();};

async function credentials():Promise<Credentials|null>{
  const row=await db().prepare('SELECT value FROM settings WHERE id=?').bind(configId).first<{value:string}>();
  if(!row)return null;
  const b=Buffer.from(row.value,'base64'),cipher=createDecipheriv('aes-256-gcm',key(),b.subarray(0,12));
  cipher.setAAD(Buffer.from(configId));cipher.setAuthTag(b.subarray(12,28));
  return JSON.parse(Buffer.concat([cipher.update(b.subarray(28)),cipher.final()]).toString());
}
export async function directPayPalStatus(){return (await credentials())?.merchant??null;}
async function token(c:Pick<Credentials,'client'|'secret'>){
  const response=await fetch(base+'/v1/oauth2/token',{method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000),
    headers:{Authorization:'Basic '+Buffer.from(c.client+':'+c.secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
  if(!response.ok)throw new PayPalError('PayPal could not verify the live app credentials.',response.status===401?400:503);
  const result=await response.json() as {access_token?:unknown}|null;if(typeof result?.access_token!=='string'||!result.access_token)throw new PayPalError('PayPal could not confirm access.');
  return result.access_token as string;
}
async function api<T>(access:string,path:string,body?:object,requestId?:string):Promise<T>{
  const response=await fetch(base+path,{method:body?'POST':'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),
    headers:{Authorization:'Bearer '+access,'Content-Type':'application/json',Prefer:'return=representation',...(requestId?{'PayPal-Request-Id':requestId}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok)throw new PayPalError('PayPal could not complete this request. Please check the order before retrying.',response.status);
  return response.json() as Promise<T>;
}
export async function connectPayPal(client:string,secret:string){
  if(!/^[\w-]{12,256}$/.test(client)||!/^\S{12,256}$/.test(secret))throw new PayPalError('Enter the Client ID and Secret from your live PayPal Business app.',400);
  const observed=await db().prepare('SELECT value FROM settings WHERE id=?').bind(configId).first<{value:string}>();
  const previous=await credentials();
  const access=await token({client,secret}),reference=crypto.randomUUID();
  // With no explicit payee, PayPal returns the business which owns these credentials.
  const probe=await api<Remote>(access,'/v2/checkout/orders',{intent:'CAPTURE',purchase_units:[{reference_id:reference,amount:{currency_code:'GBP',value:'1.00'}}]},reference);
  if(!validId(probe.id))throw new PayPalError('PayPal could not verify the business account.');
  const confirmed=await api<Remote>(access,'/v2/checkout/orders/'+probe.id);
  const unit=confirmed.purchase_units?.[0],merchant=unit?.payee?.merchant_id;
  if(confirmed.id!==probe.id||confirmed.intent!=='CAPTURE'||confirmed.status!=='CREATED'||confirmed.purchase_units?.length!==1||unit.reference_id!==reference||!validId(merchant??'')||!moneyMatches(unit.amount,100))
    throw new PayPalError('PayPal could not verify the receiving business for GBP payments.');
  if(previous&&previous.merchant!==merchant)throw new PayPalError('Use the original PayPal business so existing orders and refunds remain accessible.',409);
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);cipher.setAAD(Buffer.from(configId));
  const bytes=Buffer.concat([cipher.update(JSON.stringify({client,secret,merchant})),cipher.final()]);
  const packed=Buffer.concat([iv,cipher.getAuthTag(),bytes]).toString('base64');
  const result=observed?await db().prepare('UPDATE settings SET value=? WHERE id=? AND value=?').bind(packed,configId,observed.value).run():
    await db().prepare('INSERT OR IGNORE INTO settings(id,value) VALUES(?,?)').bind(configId,packed).run();
  if(!result.meta.changes)throw new PayPalError('Another staff member updated this connection. Refresh before trying again.',409);
}
export function isPayPalMerchant(marker:string){return marker.startsWith('paypal:');}
export async function payPalMerchant(){
  const id=await directPayPalStatus();if(!id)throw new PayPalError('Connect the academy PayPal Business account first.',409);
  return 'paypal:'+id;
}
async function accessFor(order:Pick<PayPalPurchase,'merchant'>){
  const c=await credentials();
  if(!c||order.merchant!=='paypal:'+c.merchant)throw new PayPalError('This order belongs to a different payment account.',409);
  return token(c);
}
function verify(remote:Remote,order:PayPalPurchase){
  const unit=remote.purchase_units?.[0];
  if(!validId(remote.id)||remote.intent!=='CAPTURE'||remote.purchase_units?.length!==1||
      (order.session_id&&order.session_id!==remote.id)||unit?.reference_id!==order.kind+'-'+order.id||unit?.custom_id!==order.kind+'-'+order.id||
      'paypal:'+unit?.payee?.merchant_id!==order.merchant||!moneyMatches(unit?.amount,order.amount))
    throw new PayPalError('PayPal returned different order details.',409);
  return unit;
}
export async function createPayPal(order:PayPalPurchase,title:string,origin:string,path:string,shipping?:Shipping){
  const access=await accessFor(order);
  const home=new URL(process.env.ACADEMY_PUBLIC_URL||origin);
  if(home.protocol!=='https:')throw new PayPalError('Secure checkout requires HTTPS.');
  const returnUrl=new URL(path,home.origin).href;
  const reference=order.kind+'-'+order.id;
  const unit={reference_id:reference,custom_id:reference,invoice_id:reference,description:title.slice(0,127),
    amount:{currency_code:'GBP',value:money(order.amount)},...(shipping?{shipping:{name:{full_name:shipping.name},address:{address_line_1:shipping.street,address_line_2:shipping.line2||undefined,admin_area_2:shipping.town,postal_code:shipping.postcode,country_code:'GB'}}}:{})};
  const remote=await api<Remote>(access,'/v2/checkout/orders',{intent:'CAPTURE',purchase_units:[unit],payment_source:{paypal:{experience_context:{
    user_action:'CONTINUE',shipping_preference:shipping?'SET_PROVIDED_ADDRESS':'NO_SHIPPING',return_url:returnUrl,cancel_url:returnUrl}}}},reference);
  if(!validId(remote.id))throw new PayPalError('PayPal did not return a checkout.');
  verify(await api<Remote>(access,'/v2/checkout/orders/'+remote.id),order);
  return remote.id;
}
export async function readPayPal(order:PayPalPurchase){
  if(!order.session_id||!validId(order.session_id))throw new PayPalError('Return to checkout to open this PayPal order.',409);
  const access=await accessFor(order),remote=await api<Remote>(access,'/v2/checkout/orders/'+order.session_id);
  const unit=verify(remote,order),captures=unit.payments?.captures??[],capture=captures[0];
  if(captures.length>1 || (capture&&(!validId(capture.id)||!moneyMatches(capture.amount,order.amount))))
    throw new PayPalError('The captured payment does not match the full order.',409);
  const approval=remote.links?.find(l=>l.rel==='payer-action'||l.rel==='approve')?.href;
  let approvalURL:string|null=null;
  if(approval){const url=new URL(approval);if(url.origin==='https://www.paypal.com' && !url.username && !url.password)approvalURL=url.href;}
  return {status:remote.status,capture,approvalURL};
}
const claimKey=(order:PayPalPurchase)=>'paypal:capture:'+order.kind+':'+order.id;
const ttl=3*60*60*1000;
export async function expireUncapturedPayPal(order:PayPalPurchase){
  // A buyer can change payment method until the first capture request starts.
  const database=db(),id=claimKey(order);
  await database.prepare("INSERT OR IGNORE INTO settings(id,value) VALUES(?,'expired')").bind(id).run();
  const claim=await database.prepare('SELECT value FROM settings WHERE id=?').bind(id).first<{value:string}>();
  return claim?.value==='expired';
}
export async function statePayPal(order:PayPalPurchase,allowCapture=false){
  const database=db(),claim=claimKey(order),expired=Date.now()-Date.parse(order.created_at)>ttl;
  // The capture claim and local expiry compete for the same unique row. A slow
  // or retried capture can never run after this reservation has been released.
  if(expired)await database.prepare("INSERT OR IGNORE INTO settings(id,value) VALUES(?,'expired')").bind(claim).run();
  const lock=async()=>(await database.prepare('SELECT value FROM settings WHERE id=?').bind(claim).first<{value:string}>())?.value;
  if(await lock()==='expired')return {status:'expired' as const,approvalURL:null};
  if(!order.session_id)return {status:'pending' as const,approvalURL:null};
  let remote=await readPayPal(order);
  if(allowCapture && remote.status==='APPROVED' && !remote.capture){
    await database.prepare("INSERT OR IGNORE INTO settings(id,value) VALUES(?,'capturing')").bind(claim).run();
    if(await lock()!=='capturing')return {status:'expired' as const,approvalURL:null};
    try{await api(await accessFor(order),'/v2/checkout/orders/'+order.session_id+'/capture',{},'capture-'+order.kind+'-'+order.id);}
    catch(e){if(!(e instanceof PayPalError)||![409,422].includes(e.status))throw e;}
    remote=await readPayPal(order);
  }
  if(remote.status==='COMPLETED'&&remote.capture?.status==='COMPLETED')return {status:'paid' as const,approvalURL:null};
  if(remote.status==='VOIDED'||['DECLINED','FAILED','DENIED'].includes(remote.capture?.status??''))return {status:'failed' as const,approvalURL:null};
  return {status:'pending' as const,approvalURL:remote.approvalURL,approved:remote.status==='APPROVED'&&!remote.capture};
}
export async function refundPayPal(order:PayPalPurchase,attempt:string,captureId:string){
  const remote=await readPayPal(order);
  if(!remote.capture||remote.capture.id!==captureId)throw new PayPalError('PayPal could not confirm the original captured payment.',409);
  if(remote.capture.status==='REFUNDED')return true;
  if(!['COMPLETED','PARTIALLY_REFUNDED'].includes(remote.capture.status))return false;
  // Omitting the amount requests the remaining refundable balance. All retries
  // use one request ID; only a fully refunded capture releases inventory.
  try{await api(await accessFor(order),'/v2/payments/captures/'+remote.capture.id+'/refund',{},attempt);}
  catch(e){if(!(e instanceof PayPalError)||![409,422].includes(e.status))throw e;}
  return (await readPayPal(order)).capture?.status==='REFUNDED';
}
