import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {shopDatabase} from './shop-schema';
import {SumUpError,checkoutMerchant,createMerchantCheckout,lookupMerchantCheckout,checkoutMatches} from './sumup';
import type {BasketLine,Delivery,OrderLine,Product,ShopOrder} from './shop-types';
const productColumns='id,title,description,price,published,(photo IS NOT NULL) AS has_photo,updated_at';
export const shopId=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function products(all=false){
  return (await (await shopDatabase()).prepare('SELECT '+productColumns+' FROM shop_products '+(all?'':'WHERE published=1 ')+'ORDER BY title').all<Product>()).results;
}
export async function postage(){
  const row=await (await shopDatabase()).prepare("SELECT value FROM settings WHERE id='shop:postage'").first<{value:string}>();
  return row?Number(row.value):null;
}
function address(value:Partial<Delivery>|undefined):Delivery{
  const field=(k:keyof Delivery,required=true)=>{const v=value?.[k];if(typeof v!=='string'||v.trim().length>150||(required&&!v.trim()))throw new SumUpError('Check the delivery name and address.',400);return v.trim();};
  const postcode=field('postcode').toUpperCase().replace(/\s+/g,'');
  if(!/^(?:GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/.test(postcode))throw new SumUpError('Enter a UK postcode.',400);
  return {name:field('name'),street:field('street'),line2:field('line2',false),town:field('town'),postcode:postcode.slice(0,-3)+' '+postcode.slice(-3)};
}
function deliveryKey(){
  if(!process.env.APP_ENCRYPTION_KEY)throw new SumUpError('Shop checkout is temporarily unavailable.');
  return createHash('sha256').update('academy-shop-delivery/v1/'+process.env.APP_ENCRYPTION_KEY).digest();
}
function seal(id:string,value:Delivery){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',deliveryKey(),iv);cipher.setAAD(Buffer.from(id));
  const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64');
}
export function deliveryFor(order:ShopOrder):Delivery{
  const b=Buffer.from(order.delivery,'base64'),cipher=createDecipheriv('aes-256-gcm',deliveryKey(),b.subarray(0,12));
  cipher.setAAD(Buffer.from(order.id));cipher.setAuthTag(b.subarray(12,28));
  return JSON.parse(Buffer.concat([cipher.update(b.subarray(28)),cipher.final()]).toString('utf8'));
}
export async function shopOrder(id:string,userId?:string){
  return (await shopDatabase()).prepare('SELECT * FROM shop_orders WHERE id=?'+(userId?' AND user_id=?':''))
    .bind(...(userId?[id,userId]:[id])).first<ShopOrder>();
}
export async function buyerOrders(userId:string){
  return (await (await shopDatabase()).prepare('SELECT id,items,status,amount,dispatched_at,created_at FROM shop_orders WHERE user_id=? ORDER BY created_at DESC LIMIT 100').bind(userId).all<ShopOrder>()).results;
}
type Purchase={attempt:string;items:BasketLine[];delivery:Delivery;total:number};
export async function startShopOrder(user:{userId:string;email:string},body:Purchase,origin:string){
  if(!body||!shopId.test(body.attempt)||!Array.isArray(body.items)||!body.items.length||body.items.length>30)throw new SumUpError('Check your basket.',400);
  const ids=new Set<string>();
  const cart=body.items.map(line=>{
    if(!line||!shopId.test(line.id)||ids.has(line.id)||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>20)throw new SumUpError('Check the quantities in your basket.',400);
    ids.add(line.id);return {id:line.id,quantity:line.quantity};
  }).sort((a,b)=>a.id.localeCompare(b.id));
  const to=address(body.delivery), fingerprint=createHash('sha256').update(JSON.stringify([cart,to,body.total])).digest('hex');
  const database=await shopDatabase(),id=body.attempt,path='/shop/orders/'+id;
  let order=await shopOrder(id);
  if(order&&(order.user_id!==user.userId||order.fingerprint!==fingerprint))throw new SumUpError('Start a new checkout for this basket.',409);
  if(order&&(order.status!=='pending'||order.session_id))return path;
  const merchant=await checkoutMerchant();
  if(!order){
    const [catalogue,shipping]=await Promise.all([products(),postage()]);
    if(shipping===null)throw new SumUpError('Delivery has not opened yet.',409);
    const lines:OrderLine[]=cart.map(line=>{const p=catalogue.find(p=>p.id===line.id);if(!p)throw new SumUpError('An item is no longer available. Refresh your basket.',409);return {...line,title:p.title,price:p.price};});
    const amount=lines.reduce((sum,l)=>sum+l.price*l.quantity,shipping);
    if(!Number.isSafeInteger(body.total)||amount!==body.total||amount>1000000)throw new SumUpError('Review the current prices and delivery charge before paying.',409);
    await database.prepare('INSERT OR IGNORE INTO shop_orders(id,user_id,email,items,shipping,amount,delivery,fingerprint,merchant,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .bind(id,user.userId,user.email,JSON.stringify(lines),shipping,amount,seal(id,to),fingerprint,merchant.code,new Date().toISOString()).run();
    order=await shopOrder(id);
  }
  if(!order||order.user_id!==user.userId||order.fingerprint!==fingerprint||order.merchant!==merchant.code)throw new SumUpError('Refresh your order before continuing.',409);
  if(order.status!=='pending'||order.session_id)return path;
  const checkout=await createMerchantCheckout(merchant,order,'Savannah Sky shop',origin,path,'/api/shop/webhook');
  await applyShopStatus(order,checkout);
  return path;
}
async function applyShopStatus(order:ShopOrder,checkout:Awaited<ReturnType<typeof lookupMerchantCheckout>>){
  if(!checkoutMatches(checkout,order))throw new SumUpError('Payment details do not match the shop order.',409);
  const status=checkout.status==='PAID'?'paid':['EXPIRED','FAILED','CANCELLED'].includes(checkout.status)?checkout.status.toLowerCase():'pending';
  const sql="UPDATE shop_orders SET session_id=?,status=?,paid_at=CASE WHEN ?='paid' THEN ? ELSE paid_at END WHERE id=? AND status='pending' AND (session_id IS NULL OR session_id=?)";
  await (await shopDatabase()).prepare(sql).bind(checkout.id,status,status,new Date().toISOString(),order.id,checkout.id).run();
  const saved=await shopOrder(order.id);
  if(!saved||saved.session_id!==checkout.id)throw new SumUpError('This checkout does not match the order.',409);
  return saved.status;
}
export async function syncShopOrder(id:string,notified?:string){
  const order=await shopOrder(id);
  if(!order)return null;
  if(notified&&order.session_id&&notified!==order.session_id)throw new SumUpError('Wrong checkout for this order.',409);
  if(order.status!=='pending')return order.status;
  const checkoutId=order.session_id||notified;if(!checkoutId)return 'pending';
  const merchant=await checkoutMerchant();
  if(order.merchant!==merchant.code)throw new SumUpError('Payment confirmation is temporarily unavailable.');
  const checkout=await lookupMerchantCheckout(merchant,checkoutId);
  if(checkout.id!==checkoutId)throw new SumUpError('Unexpected checkout.',409);
  return applyShopStatus(order,checkout);
}
